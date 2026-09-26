import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryLogger } from "../log/Logger.js";
import type {
  PaneHistoryFile,
  PaneHistoryFileData,
  PaneHistoryLoadResult,
} from "../persist/PaneHistoryFile.js";
import type { TerminalHost } from "../terminal/TerminalHost.js";
import { PaneHistoryRecorder } from "./PaneHistoryRecorder.js";

/** 取り出しの回数と中身を操れる偽の端末（ミラーは `historyAnsi`・`flush` だけ）。 */
class FakeHost {
  ansi = "";
  lastOutput = 0;
  captures = 0;
  flushHangs = false;
  throwOnCapture = false;
  readonly mirror = {
    flush: (): Promise<void> =>
      this.flushHangs ? new Promise<void>(() => undefined) : Promise.resolve(),
    historyAnsi: (): string => {
      if (this.throwOnCapture) throw new Error("disposed");
      this.captures++;
      return this.ansi;
    },
  };
  lastOutputAt(): number {
    return this.lastOutput;
  }
}

class FakeFile implements PaneHistoryFile {
  readonly path = "/state/session-history.json";
  saved: PaneHistoryFileData[] = [];
  failNext = false;
  /** save の完了を止める（直列のテスト用）。 */
  gate: Promise<void> | null = null;
  async load(): Promise<PaneHistoryLoadResult> {
    return { kind: "missing" };
  }
  async save(data: PaneHistoryFileData): Promise<void> {
    if (this.gate) await this.gate;
    if (this.failNext) {
      this.failNext = false;
      throw new Error("EACCES: permission denied");
    }
    this.saved.push(structuredClone(data));
  }
  async clear(): Promise<boolean> {
    return false;
  }
}

function setup(opts: { maxPaneBytes?: number; maxFileBytes?: number } = {}) {
  let clock = 1_000;
  const hosts = new Map<string, FakeHost>();
  let ids: string[] = [];
  const file = new FakeFile();
  const logger = new MemoryLogger();
  const recorder = new PaneHistoryRecorder({
    file,
    terminals: { get: (id: string) => hosts.get(id) as unknown as TerminalHost | undefined },
    paneIds: () => ids,
    logger,
    now: () => clock,
    flushTimeoutMs: 20,
    ...opts,
  });
  return {
    recorder,
    file,
    logger,
    hosts,
    setIds: (next: string[]) => (ids = next),
    tick: (ms = 1) => (clock += ms),
    addHost: (id: string, ansi: string) => {
      const h = new FakeHost();
      h.ansi = ansi;
      h.lastOutput = clock;
      hosts.set(id, h);
      return h;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PaneHistoryRecorder（画面履歴の保存。20260926-screen-history-replay の design「保存」）", () => {
  it("pane の順に取り出して書く。空の pane は積まない（AC1）", async () => {
    const t = setup();
    t.addHost("p1", "one");
    t.addHost("p2", "");
    t.addHost("p3", "three");
    t.setIds(["p1", "p2", "p3"]);
    t.tick();
    await t.recorder.save();
    expect(t.file.saved).toHaveLength(1);
    expect(t.file.saved[0]!.panes.map((p) => [p.paneId, p.ansi])).toEqual([
      ["p1", "one"],
      ["p3", "three"],
    ]);
    expect(t.file.saved[0]!.schema).toBe(1);
    expect(t.file.saved[0]!.savedAt).toBe(new Date(1_001).toISOString());
  });

  it("出力の無かった pane は取り直さず、何も変わっていなければ書かない（AC3）", async () => {
    const t = setup();
    const h1 = t.addHost("p1", "one");
    const h2 = t.addHost("p2", "two");
    t.setIds(["p1", "p2"]);
    t.tick();
    await t.recorder.save();
    expect([h1.captures, h2.captures]).toEqual([1, 1]);

    t.tick(10);
    await t.recorder.save();
    expect([h1.captures, h2.captures]).toEqual([1, 1]); // 取り直さない
    expect(t.file.saved).toHaveLength(1); // 書かない

    // p2 だけ出力があった → p2 だけ取り直して書く。
    h2.ansi = "two!";
    h2.lastOutput = t.tick(5);
    t.tick();
    await t.recorder.save();
    expect([h1.captures, h2.captures]).toEqual([1, 2]);
    expect(t.file.saved).toHaveLength(2);
    expect(t.file.saved[1]!.panes.map((p) => p.ansi)).toEqual(["one", "two!"]);
  });

  it("出力はあったが通常の画面の内容が同じなら書き直さない（代替画面のアプリ・スピナーの pane。review ラウンド 1）", async () => {
    const t = setup();
    const h = t.addHost("p1", "same");
    t.setIds(["p1"]);
    t.tick();
    await t.recorder.save();
    h.lastOutput = t.tick(5);
    t.tick();
    await t.recorder.save();
    expect(h.captures).toBe(2); // 取り直しはした
    expect(t.file.saved).toHaveLength(1); // 書かない
    // 取り出しの時刻は進めてある：その後に出力が無ければ取り直さない（直列化の重さを避ける。decisions D2）。
    t.tick();
    await t.recorder.save();
    expect(h.captures).toBe(2);
    // 停止時（force）には、内容が同じでも取り出した時刻を savedAt にして書く（区切りの行の時刻が古くならない）。
    const stopAt = t.tick(100);
    await t.recorder.save({ force: true });
    expect(t.file.saved).toHaveLength(2);
    expect(t.file.saved[1]!.panes[0]!.savedAt).toBe(new Date(stopAt).toISOString());
    t.file.saved.pop();
    // その後に内容が変われば書く。
    h.ansi = "changed";
    h.lastOutput = t.tick(5);
    t.tick();
    await t.recorder.save();
    expect(t.file.saved).toHaveLength(2);
  });

  it("取り出しと同じ時刻の出力は、次の保存で取り直す（取りこぼさない）", async () => {
    const t = setup();
    const h = t.addHost("p1", "a");
    t.setIds(["p1"]);
    t.tick();
    await t.recorder.save(); // 取り出しの時刻 = 1001
    h.lastOutput = 1_001; // 同じミリ秒に届いた出力
    h.ansi = "ab";
    await t.recorder.save();
    expect(h.captures).toBe(2);
    expect(t.file.saved.at(-1)!.panes[0]!.ansi).toBe("ab");
  });

  it("pane が閉じたら、その pane を除いて書き直す", async () => {
    const t = setup();
    t.addHost("p1", "one");
    t.addHost("p2", "two");
    t.setIds(["p1", "p2"]);
    t.tick();
    await t.recorder.save();
    t.setIds(["p1"]);
    await t.recorder.save();
    expect(t.file.saved).toHaveLength(2);
    expect(t.file.saved[1]!.panes.map((p) => p.paneId)).toEqual(["p1"]);
  });

  it("force は出力が無くても取り直して書く（停止時）", async () => {
    const t = setup();
    const h = t.addHost("p1", "one");
    t.setIds(["p1"]);
    t.tick();
    await t.recorder.save();
    await t.recorder.save({ force: true });
    expect(h.captures).toBe(2);
    expect(t.file.saved).toHaveLength(2);
  });

  it("pane ごとの上限を超えたら古い側を捨てて保存する（AC7）", async () => {
    const t = setup({ maxPaneBytes: 8 });
    t.addHost("p1", "old-line\r\nnew\r\nend");
    t.setIds(["p1"]);
    t.tick();
    await t.recorder.save();
    expect(t.file.saved[0]!.panes[0]!.ansi).toBe("new\r\nend");
  });

  it("ファイル全体の上限を超える pane はその pane だけ積まず、次の pane へ進み、警告を 1 度だけ出す（AC7）", async () => {
    const entryBytes = (id: string, ansi: string) =>
      Buffer.byteLength(
        JSON.stringify({ paneId: id, savedAt: new Date(1_001).toISOString(), ansi }),
      ) + 1;
    const small = "s";
    const big = "b".repeat(200);
    const t = setup({ maxFileBytes: 1024 + entryBytes("p1", small) + entryBytes("p3", small) });
    t.addHost("p1", small);
    t.addHost("p2", big);
    t.addHost("p3", small);
    t.setIds(["p1", "p2", "p3"]);
    t.tick();
    await t.recorder.save();
    expect(t.file.saved[0]!.panes.map((p) => p.paneId)).toEqual(["p1", "p3"]);
    await t.recorder.save({ force: true });
    expect(
      t.logger.lines.filter((l) => l.level === "warn" && l.msg.includes("size limit")),
    ).toHaveLength(1);
  });

  it("書けなくても投げずにログに残し、次の保存で書き直す（AC13）", async () => {
    const t = setup();
    t.addHost("p1", "one");
    t.setIds(["p1"]);
    t.tick();
    t.file.failNext = true;
    await expect(t.recorder.save()).resolves.toBeUndefined();
    expect(
      t.logger.lines.some((l) => l.level === "warn" && l.msg === "pane history save failed"),
    ).toBe(true);
    expect(t.file.saved).toHaveLength(0);
    await t.recorder.save(); // 変化は無いが、前回が失敗なので書き直す
    expect(t.file.saved).toHaveLength(1);
  });

  it("ミラーの処理が返らない・取り出しが投げる pane は飛ばし、前回の取り出しがあればそれを使う", async () => {
    const t = setup();
    const h1 = t.addHost("p1", "one");
    const h2 = t.addHost("p2", "two");
    t.setIds(["p1", "p2"]);
    t.tick();
    await t.recorder.save();
    h1.flushHangs = true;
    h1.ansi = "one!"; // 上限を過ぎた後に取り出していれば、こちらが書かれる
    h2.throwOnCapture = true;
    h1.lastOutput = h2.lastOutput = t.tick(5);
    t.tick();
    await t.recorder.save({ force: true });
    expect(t.file.saved.at(-1)!.panes.map((p) => [p.paneId, p.ansi])).toEqual([
      ["p1", "one"],
      ["p2", "two"],
    ]);
    // 端末が無くなった pane（PTY が終わった）も、前回の取り出しを使う。
    t.hosts.delete("p1");
    const before = t.file.saved.length;
    await t.recorder.save({ force: true });
    expect(t.file.saved).toHaveLength(before + 1); // 書いた（途中で投げて何も書かなかった、ではない）
    expect(t.file.saved.at(-1)!.panes.map((p) => [p.paneId, p.ansi])).toEqual([
      ["p1", "one"],
      ["p2", "two"],
    ]);
    expect(t.logger.lines.filter((l) => l.level === "warn")).toEqual([]);
  });

  it("保存は直列に並ぶ（前の保存が終わってから次を始める）", async () => {
    const t = setup();
    const h = t.addHost("p1", "one");
    t.setIds(["p1"]);
    t.tick();
    let open!: () => void;
    t.file.gate = new Promise<void>((resolve) => (open = resolve));
    const first = t.recorder.save();
    const second = t.recorder.save({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(h.captures).toBe(1); // 2 つ目はまだ取り出していない
    t.file.gate = null;
    open();
    await Promise.all([first, second]);
    expect(h.captures).toBe(2);
    expect(t.file.saved).toHaveLength(2);
  });

  it("start は間隔ごとに保存し、stop で止める（AC3）", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.addHost("p1", "one");
    t.setIds(["p1"]);
    const spy = vi.spyOn(t.recorder, "save");
    t.recorder.start(30_000);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(spy).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    t.recorder.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
