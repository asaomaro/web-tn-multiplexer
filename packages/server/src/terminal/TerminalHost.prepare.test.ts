import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PtyProcess } from "../pty/PtyBackend.js";
import { DefaultTerminalHost } from "./TerminalHost.js";

/**
 * `writeModal` の `prepare`（20260926-agent-start の review ラウンド 1）。flush の後・`build` の前に待ち、その間の入力は後回しにし、
 * reject すれば何も書かない。
 */
class FakePty implements PtyProcess {
  readonly pid = 1;
  readonly writes: string[] = [];
  onData() {
    return { dispose: () => {} };
  }
  onExit() {
    return { dispose: () => {} };
  }
  write(data: string | Uint8Array): void {
    this.writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
  }
  resize(): void {}
  pause(): void {}
  resume(): void {}
  kill(): void {}
}

function setup(): { pty: FakePty; host: DefaultTerminalHost } {
  const pty = new FakePty();
  return { pty, host: new DefaultTerminalHost("p1", pty, 80, 24, 1000) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DefaultTerminalHost.writeModal の prepare", () => {
  it("prepare を待つ間に届いた write は後回しになり、prepare の後の部分より後に書かれる", async () => {
    const { pty, host } = setup();
    let release!: () => void;
    const prepare = vi.fn(() => new Promise<void>((r) => (release = r)));
    const build = vi.fn(() => ["A", "B"]);
    const done = host.writeModal({ prepare, build, delayMs: 0 });
    await vi.advanceTimersByTimeAsync(0);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
    host.write("typed");
    expect(pty.writes).toEqual([]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    await done;
    expect(pty.writes).toEqual(["A", "B", "typed"]);
  });

  it("prepare が reject したら build を呼ばず何も書かずに reject し、後回しの入力はその後に書く", async () => {
    const { pty, host } = setup();
    let fail!: (err: Error) => void;
    const build = vi.fn(() => ["A"]);
    const done = host.writeModal({
      prepare: () => new Promise<void>((_r, rej) => (fail = rej)),
      build,
      delayMs: 0,
    });
    const result = done.then(
      () => "resolved",
      (err: Error) => err.message,
    );
    await vi.advanceTimersByTimeAsync(0);
    host.write("typed");
    fail(new Error("not idle"));
    expect(await result).toBe("not idle");
    expect(build).not.toHaveBeenCalled();
    expect(pty.writes).toEqual(["typed"]);
    host.write("after");
    expect(pty.writes).toEqual(["typed", "after"]);
  });

  it("prepare が無ければ今までどおり build の部分を書く", async () => {
    const { pty, host } = setup();
    await Promise.all([
      host.writeModal({ build: () => ["X"], delayMs: 0 }),
      vi.runAllTimersAsync(),
    ]);
    expect(pty.writes).toEqual(["X"]);
  });
});
