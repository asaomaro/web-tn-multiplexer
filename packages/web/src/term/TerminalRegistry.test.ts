import type { MethodName, ParamsOf, ResultOf } from "@wtm/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyInputController } from "../keys/KeyInputController.js";
import { KeyRouter, type KeyRouterClock } from "../keys/KeyRouter.js";
import { DEFAULT_KEYMAP } from "../keys/keymap.js";
import type { ConnectionPort } from "../net/ports.js";
import { MouseBridge } from "./MouseBridge.js";
import { RendererPool, type WebglAddonLike } from "./RendererPool.js";
import { TerminalRegistry } from "./TerminalRegistry.js";

function realClock(): KeyRouterClock {
  return { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
}

function makeConnection(): ConnectionPort & { sentInput: [string, string | Uint8Array][]; requests: [MethodName, unknown][] } {
  return {
    sentInput: [],
    requests: [],
    sendInput(paneId, bytes) {
      this.sentInput.push([paneId, bytes]);
    },
    request<M extends MethodName>(method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
      this.requests.push([method, params]);
      return Promise.resolve({} as ResultOf<M>);
    },
    login: vi.fn(),
    logout: vi.fn(),
    connect: vi.fn(),
  };
}

class FakeWebglAddon implements WebglAddonLike {
  activate(): void {}
  dispose(): void {}
  onContextLoss(): { dispose(): void } {
    return { dispose: () => undefined };
  }
}

function makeRegistry(opts: { capacity: number; now?: () => number; hasSizeAuthority?: (paneId: string) => boolean; getScrollbackLines?: () => number }) {
  const conn = makeConnection();
  const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
  const keys = new KeyInputController(router, conn);
  const renderers = new RendererPool({ capacity: 100, createWebglAddon: () => new FakeWebglAddon() });
  const mouseBridges: MouseBridge[] = [];
  const registry = new TerminalRegistry({
    capacity: opts.capacity,
    conn,
    renderers,
    keys,
    ...(opts.now ? { now: opts.now } : {}),
    ...(opts.hasSizeAuthority ? { hasSizeAuthority: opts.hasSizeAuthority } : {}),
    ...(opts.getScrollbackLines ? { getScrollbackLines: opts.getScrollbackLines } : {}),
    createMouseBridge: (term, paneId) => {
      const bridge = new MouseBridge({ term, paneId, ui: { toast: () => undefined, openContextMenu: () => undefined }, getRightClickTarget: () => "herdr" });
      mouseBridges.push(bridge);
      return bridge;
    },
  });
  return { registry, conn, renderers, mouseBridges };
}

describe("TerminalRegistry", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("acquire: 無ければ作り、pane.subscribe を予約する", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    expect(entry.paneId).toBe("p1");
    expect(registry.takePendingSubscriptions(["p1"])).toEqual(["p1"]);
    entry.term.dispose();
  });

  // 20260920-agent-notifications の AC3：知らせる直前に「その pane を見ているか」を引く口。
  describe("isVisible（通知の抑止に使う）", () => {
    it("acquire で表示中になり、release で外れる", () => {
      const { registry } = makeRegistry({ capacity: 24 });
      expect(registry.isVisible("p1")).toBe(false); // 作る前
      const entry = registry.acquire("p1");
      expect(registry.isVisible("p1")).toBe(true);
      registry.release("p1");
      expect(registry.isVisible("p1")).toBe(false); // 端末は生きているが、画面には出ていない
      expect(registry.get("p1")).toBeDefined();
      entry.term.dispose();
    });

    it("知らない pane は表示中ではない", () => {
      const { registry } = makeRegistry({ capacity: 24 });
      expect(registry.isVisible("missing")).toBe(false);
    });

    it("複数を開いていれば、それぞれ独立に判定する（分割している tab）", () => {
      const { registry } = makeRegistry({ capacity: 24 });
      const p1 = registry.acquire("p1");
      const p2 = registry.acquire("p2");
      registry.release("p1");
      expect(registry.isVisible("p1")).toBe(false);
      expect(registry.isVisible("p2")).toBe(true);
      p1.term.dispose();
      p2.term.dispose();
    });
  });

  it("acquire: 既にあれば同じ entry を返し、再購読しない", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const first = registry.acquire("p1");
    registry.takePendingSubscriptions(["p1"]);
    const second = registry.acquire("p1");
    expect(second).toBe(first);
    expect(registry.takePendingSubscriptions(["p1"])).toEqual([]);
    first.term.dispose();
  });

  describe("接続が替わったときの購読し直し（D107：サーバは接続ごとに新しい clientId に購読を持つ）", () => {
    it("markAllUnsubscribed の後は、生きている端末を表示したときに購読し直す（xterm.js は作り直さない）", () => {
      const { registry } = makeRegistry({ capacity: 24 });
      const p1 = registry.acquire("p1");
      const p2 = registry.acquire("p2");
      expect(registry.takePendingSubscriptions(["p1", "p2"])).toEqual(["p1", "p2"]);
      expect(registry.takePendingSubscriptions(["p1", "p2"])).toEqual([]); // 同じ接続では 2 度送らない

      registry.markAllUnsubscribed(); // 新しい接続の hello が通った
      expect(registry.takePendingSubscriptions(["p1", "p2"])).toEqual(["p1", "p2"]);
      expect(registry.get("p1")).toBe(p1);
      expect(registry.get("p2")).toBe(p2);
      p1.term.dispose();
      p2.term.dispose();
    });

    it("隠れている端末は、次に表示されるまで購読しない（再接続の直後に LRU の全部の SNAPSHOT を取り寄せない）", () => {
      const { registry } = makeRegistry({ capacity: 24 });
      registry.acquire("p1");
      registry.acquire("p2");
      registry.takePendingSubscriptions(["p1", "p2"]);
      registry.release("p2"); // 別の tab へ移って隠れた（LRU には残る）

      registry.markAllUnsubscribed();
      expect(registry.takePendingSubscriptions(["p1"])).toEqual(["p1"]);
      // p2 はまだ未購読のまま残っている——表示されたら購読する。
      registry.acquire("p2");
      expect(registry.takePendingSubscriptions(["p2"])).toEqual(["p2"]);
    });

    it("破棄した端末は、未購読の印も消す（後で同じ id を表示しても、新しく作った分として 1 回だけ購読する）", async () => {
      const { registry } = makeRegistry({ capacity: 1 });
      registry.acquire("p1");
      registry.takePendingSubscriptions(["p1"]);
      registry.release("p1");
      registry.markAllUnsubscribed();
      registry.acquire("p2"); // 容量 1：隠れた p1 は破棄される
      expect(registry.get("p1")).toBeUndefined();
      expect(registry.takePendingSubscriptions(["p1", "p2"])).toEqual(["p2"]);
    });
  });

  it("term.onData は ConnectionPort.sendInput(paneId, …) につながる", async () => {
    const { registry, conn } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    entry.term.input("a", false); // xterm.js の内部から onData を発火させる公開 API
    await new Promise((r) => setTimeout(r, 0));
    expect(conn.sentInput).toEqual([["p1", "a"]]);
    entry.term.dispose();
  });

  it("setInputEnabled(false) の間は入力を送らず、true に戻すと再び送る（D95：切断中は入力を止める）", async () => {
    const { registry, conn } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    registry.setInputEnabled(false);
    entry.term.input("a", true);
    entry.term.paste("pasted");
    await new Promise((r) => setTimeout(r, 0));
    expect(conn.sentInput).toEqual([]);

    registry.setInputEnabled(true);
    entry.term.input("b", true);
    await new Promise((r) => setTimeout(r, 0));
    expect(conn.sentInput).toEqual([["p1", "b"]]);
    entry.term.dispose();
  });

  it("入力を止めている間に作った xterm.js も止まった状態で始まり、disableStdin（readOnly）は使わない（D95）", async () => {
    const { registry, conn } = makeRegistry({ capacity: 24 });
    registry.setInputEnabled(false);
    const entry = registry.acquire("p2");
    expect(entry.term.options.disableStdin).toBe(false); // モバイルのソフトキーボードを閉じさせない
    entry.term.input("a", true);
    await new Promise((r) => setTimeout(r, 0));
    expect(conn.sentInput).toEqual([]);
    entry.term.dispose();
  });

  it("フォーカスの報告（CSI I/O）はサイズ権限を持たないクライアントでは送らない", async () => {
    const { registry, conn } = makeRegistry({ capacity: 24, hasSizeAuthority: () => false });
    const entry = registry.acquire("p1");
    await new Promise<void>((resolve) => entry.term.write("\x1b[?1004h", () => resolve()));
    entry.term.input("\x1b[I", false);
    entry.term.input("a", false);
    await new Promise((r) => setTimeout(r, 0));
    expect(conn.sentInput).toEqual([["p1", "a"]]); // フォーカス報告だけ抜けている
    entry.term.dispose();
  });

  it("サイズ権限を持つクライアントではフォーカスの報告も送る", async () => {
    const { registry, conn } = makeRegistry({ capacity: 24, hasSizeAuthority: () => true });
    const entry = registry.acquire("p1");
    await new Promise<void>((resolve) => entry.term.write("\x1b[?1004h", () => resolve()));
    entry.term.input("\x1b[I", false);
    await new Promise((r) => setTimeout(r, 0));
    // xterm.js は開いた直後の内部状態から余分な "\x1b[O" を 1 回出すことがある（実測）ので、
    // 「意図的に送った \x1b[I が含まれる」ことだけを確かめる（サイズ権限が無いケースとの非対称を見る）。
    expect(conn.sentInput).toContainEqual(["p1", "\x1b[I"]);
    entry.term.dispose();
  });

  it("get: 副作用が無い（作らない）", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    expect(registry.get("p1")).toBeUndefined();
    registry.acquire("p1");
    expect(registry.get("p1")?.paneId).toBe("p1");
  });

  it("release: 表示から外すが保持は続ける（LRU の対象になるだけ）", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    registry.release("p1");
    expect(registry.get("p1")).toBe(entry); // まだ保持している
  });

  it("evictIfNeeded: 容量超過で表示していない最古のものを破棄し pane.unsubscribe を送る", async () => {
    const { registry, conn } = makeRegistry({ capacity: 2 });
    registry.acquire("p1");
    registry.release("p1"); // 表示していない・最古
    registry.acquire("p2");
    registry.release("p2");
    registry.acquire("p3"); // 3 つ目で容量超過（表示中）
    await new Promise((r) => setTimeout(r, 0));
    expect(registry.get("p1")).toBeUndefined(); // 破棄された
    expect(registry.get("p2")).toBeDefined();
    expect(registry.get("p3")).toBeDefined();
    expect(conn.requests).toContainEqual(["pane.unsubscribe", { paneId: "p1" }]);
  });

  it("evictIfNeeded: 表示中のものは破棄しない（容量を超えたままでも）", () => {
    const { registry } = makeRegistry({ capacity: 1 });
    registry.acquire("p1"); // 表示中
    registry.acquire("p2"); // 表示中（p1 も表示中なので破棄されない）
    expect(registry.get("p1")).toBeDefined();
    expect(registry.get("p2")).toBeDefined();
  });

  it("focus: 該当 pane の term.focus を呼ぶ", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    const spy = vi.spyOn(entry.term, "focus");
    registry.focus("p1");
    expect(spy).toHaveBeenCalled();
  });

  it("onOutput/onSnapshot/onSizeChanged は該当 pane の term に反映する", async () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    registry.onSnapshot("p1", 80, 24, "hello");
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));
    expect(entry.term.cols).toBe(80);
    expect(entry.term.rows).toBe(24);
    expect(entry.term.buffer.active.getLine(0)?.translateToString(true)).toBe("hello");

    registry.onOutput("p1", new TextEncoder().encode(" world"));
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));
    expect(entry.term.buffer.active.getLine(0)?.translateToString(true)).toBe("hello world");

    registry.onSizeChanged("p1", 40, 10);
    expect(entry.term.cols).toBe(40);
    expect(entry.term.rows).toBe(10);
  });

  it("onSnapshot: まだ処理していない書き込みが残っていても、SNAPSHOT の前の古い出力を重ねない（D107：消すのは書き込みの列の中で行う）", async () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    registry.onSnapshot("p1", 80, 24, "first");
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));

    // 切断の前に届いた出力（xterm.js はまだ処理していない）の直後に、再接続の SNAPSHOT が届く。SNAPSHOT は、その出力を
    // 含むサーバのミラーの画面そのもの。`term.reset()` をその場で呼ぶと、残っていた書き込みが消した後の画面に流れ込み、
    // SNAPSHOT の前に古い行が重なっていた。
    registry.onOutput("p1", new TextEncoder().encode("\r\nold-line-1\r\nold-line-2"));
    registry.onSnapshot("p1", 80, 24, "first\r\nold-line-1\r\nold-line-2");
    registry.onOutput("p1", new TextEncoder().encode("\r\nnew-line")); // SNAPSHOT の後の出力（溜め置き・以後の OUTPUT）
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));

    const buffer = entry.term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
    expect(lines.filter((l) => l !== "")).toEqual(["first", "old-line-1", "old-line-2", "new-line"]);
    expect(entry.term.cols).toBe(80);
    expect(entry.term.rows).toBe(24);
  });

  it("onSnapshot: SNAPSHOT の大きさにしてから書き、scrollback も SNAPSHOT のものだけにする（切断の前の scrollback と重ねない）", async () => {
    const { registry } = makeRegistry({ capacity: 24 });
    const entry = registry.acquire("p1");
    const before = Array.from({ length: 40 }, (_, i) => `before-${i}`).join("\r\n");
    registry.onSnapshot("p1", 80, 10, before);
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));
    expect(entry.term.buffer.active.length).toBeGreaterThan(10); // scrollback がある

    const restored = Array.from({ length: 30 }, (_, i) => `restored-${i}`).join("\r\n");
    registry.onSnapshot("p1", 60, 12, restored);
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));
    const buffer = entry.term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
    expect(lines.filter((l) => l !== "")).toEqual(Array.from({ length: 30 }, (_, i) => `restored-${i}`));
    expect(entry.term.cols).toBe(60);
    expect(entry.term.rows).toBe(12);
  });

  it("xterm.js は pane.subscribe で求める行数（getScrollbackLines）の scrollback で作る。SNAPSHOT の scrollback を 1,000 行で切らない（D107）", async () => {
    let lines = 5000;
    const { registry } = makeRegistry({ capacity: 24, getScrollbackLines: () => lines });
    const entry = registry.acquire("p1");
    expect(entry.term.options.scrollback).toBe(5000);

    // 3,000 行の scrollback を持つ SNAPSHOT（以前は xterm.js の既定の 1,000 行を超える分を捨てていた）。
    const text = Array.from({ length: 3000 + 24 }, (_, i) => `line-${i}`).join("\r\n");
    registry.onSnapshot("p1", 80, 24, text);
    await new Promise<void>((resolve) => entry.term.write("", () => resolve()));
    expect(entry.term.buffer.active.getLine(0)?.translateToString(true)).toBe("line-0");
    expect(entry.term.buffer.active.length).toBe(3000 + 24);

    lines = 10000; // 作るときの値を使う（`--scrollback 10000` のサーバ・モバイルの 1,000 も同じ口）
    expect(registry.acquire("p2").term.options.scrollback).toBe(10000);
  });

  it("getScrollbackLines を省くと xterm.js の既定（1,000 行）のまま", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    expect(registry.acquire("p1").term.options.scrollback).toBe(1000);
  });

  it("存在しない pane への onOutput/onSnapshot/onSizeChanged は例外を投げない（破棄済み・未購読）", () => {
    const { registry } = makeRegistry({ capacity: 24 });
    expect(() => {
      registry.onOutput("ghost", new Uint8Array());
      registry.onSnapshot("ghost", 1, 1, "");
      registry.onSizeChanged("ghost", 1, 1);
    }).not.toThrow();
  });
});
