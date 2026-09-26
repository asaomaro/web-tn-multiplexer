import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PtyProcess } from "../pty/PtyBackend.js";
import { DefaultTerminalHost } from "./TerminalHost.js";

/**
 * `writeModal` と送信中の入力の後回し（20260926-agent-prompt-send-keys design.md「`TerminalHost.writeModal` と後回し」）。
 * 偽の PTY の出力をミラーへ流してモードを切り替え、書き込みを記録する。時間はフェイクタイマーで進める
 * （ミラー〔@xterm/headless〕の書き込みの処理もタイマーで進むので、`advanceTimersByTimeAsync` で一緒に進める）。
 */
class FakePty implements PtyProcess {
  readonly pid = 1;
  readonly writes: string[] = [];
  private readonly dataCbs = new Set<(chunk: string) => void>();
  private readonly exitCbs = new Set<(e: { exitCode: number }) => void>();
  onData(cb: (chunk: string) => void) {
    this.dataCbs.add(cb);
    return { dispose: () => this.dataCbs.delete(cb) };
  }
  onExit(cb: (e: { exitCode: number }) => void) {
    this.exitCbs.add(cb);
    return { dispose: () => this.exitCbs.delete(cb) };
  }
  write(data: string | Uint8Array): void {
    this.writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
  }
  resize(): void {}
  pause(): void {}
  resume(): void {}
  kill(): void {}
  /** アプリの出力（ミラーへ流れる）。 */
  output(chunk: string): void {
    for (const cb of [...this.dataCbs]) cb(chunk);
  }
  exit(code: number): void {
    for (const cb of [...this.exitCbs]) cb({ exitCode: code });
  }
}

function setup(): { pty: FakePty; host: DefaultTerminalHost } {
  const pty = new FakePty();
  const host = new DefaultTerminalHost("p1", pty, 80, 24, 1000);
  return { pty, host };
}

const PROMPT = { build: () => ["TEXT", "\r"], delayMs: 300 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DefaultTerminalHost.writeModal", () => {
  it("モード付き入力が無いときの write は、今までどおり即座に（同期で）書く", () => {
    const { pty, host } = setup();
    host.write("a");
    host.write(new TextEncoder().encode("b"));
    expect(pty.writes).toEqual(["a", "b"]);
    host.dispose();
  });

  it("部分の間に delayMs を置く: 本文の後 299ms では Enter が無く、300ms で書かれてから解決する（AC2）", async () => {
    const { pty, host } = setup();
    let resolved = false;
    const done = host.writeModal(PROMPT).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(pty.writes).toEqual(["TEXT"]);
    await vi.advanceTimersByTimeAsync(299);
    expect(pty.writes).toEqual(["TEXT"]);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(pty.writes).toEqual(["TEXT", "\r"]);
    expect(resolved).toBe(true);
    host.dispose();
  });

  it("送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3）", async () => {
    const { pty, host } = setup();
    const done = host.writeModal(PROMPT);
    host.write("x"); // flush を待っている間
    await vi.advanceTimersByTimeAsync(100);
    host.write("y"); // 遅延の間
    host.write("z");
    expect(pty.writes).toEqual(["TEXT"]);
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(pty.writes).toEqual(["TEXT", "\r", "x", "y", "z"]);
    host.write("after");
    expect(pty.writes.at(-1)).toBe("after");
    host.dispose();
  });

  it("build は送る瞬間のモードで呼ばれる: 直前の出力の bracketed paste の切り替えも flush してから読む（AC1）", async () => {
    const { pty, host } = setup();
    const seen: boolean[] = [];
    const build = (modes: { bracketedPaste: boolean }) => {
      seen.push(modes.bracketedPaste);
      return [modes.bracketedPaste ? "WRAPPED" : "PLAIN"];
    };
    pty.output("\x1b[?2004h"); // 書いた直後（ミラーの処理前）に送る
    const first = host.writeModal({ build, delayMs: 0 });
    await vi.advanceTimersByTimeAsync(0);
    await first;
    pty.output("\x1b[?2004l");
    const second = host.writeModal({ build, delayMs: 0 });
    await vi.advanceTimersByTimeAsync(0);
    await second;
    expect(seen).toEqual([true, false]);
    expect(pty.writes).toEqual(["WRAPPED", "PLAIN"]);
    host.dispose();
  });

  it("送信中に来た別のモード付き入力は、それまでに後回しにした入力の後で、順番に処理される", async () => {
    const { pty, host } = setup();
    const a = host.writeModal({ build: () => ["A1", "A2"], delayMs: 300 });
    host.write("raw");
    const b = host.writeModal({ build: () => ["B1", "B2"], delayMs: 300 });
    host.write("raw2");
    await vi.advanceTimersByTimeAsync(700);
    await Promise.all([a, b]);
    expect(pty.writes).toEqual(["A1", "A2", "raw", "B1", "B2", "raw2"]);
    host.dispose();
  });

  it("送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く", async () => {
    const { pty, host } = setup();
    const a = host.writeModal(PROMPT);
    const aResult = a.catch((e: Error) => e.message);
    host.write("queued");
    const b = host.writeModal({ build: () => ["B"], delayMs: 0 });
    const bResult = b.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // Enter までの待ち
    host.dispose();
    expect(vi.getTimerCount()).toBe(0); // 待ちのタイマーを解除した
    expect(await aResult).toBe("terminal closed");
    expect(await bResult).toBe("terminal closed");
    await vi.advanceTimersByTimeAsync(1000);
    expect(pty.writes).toEqual(["TEXT"]);
    host.write("late");
    expect(pty.writes).toEqual(["TEXT", "late"]);
    await expect(host.writeModal(PROMPT)).rejects.toThrow("terminal closed");
  });

  it("flush を待っている間に PTY が終了したら reject し、何も書かない", async () => {
    const { pty, host } = setup();
    const a = host.writeModal(PROMPT).catch((e: Error) => e.message);
    pty.exit(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await a).toBe("terminal closed");
    expect(pty.writes).toEqual([]);
    host.dispose();
  });

  it("build が投げたら reject し、後回しの入力はそのまま処理を続ける", async () => {
    const { pty, host } = setup();
    const a = host
      .writeModal({
        build: () => {
          throw new Error("boom");
        },
        delayMs: 0,
      })
      .catch((e: Error) => e.message);
    host.write("next");
    await vi.advanceTimersByTimeAsync(0);
    expect(await a).toBe("boom");
    expect(pty.writes).toEqual(["next"]);
    host.write("free");
    expect(pty.writes).toEqual(["next", "free"]);
    host.dispose();
  });
});
