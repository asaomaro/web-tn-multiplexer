import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionPort } from "../net/ports.js";
import type { KeyInput, Mode } from "./actions.js";
import { KeyInputController, type ActionPort, type FocusPort, type KeyboardEventLike, type ModeSink } from "./KeyInputController.js";
import { KeyRouter, type KeyRouterClock } from "./KeyRouter.js";
import { DEFAULT_KEYMAP } from "./keymap.js";

function ev(partial: Partial<KeyboardEventLike> & { key: string }): KeyboardEventLike {
  return {
    code: "",
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    type: "keydown",
    isComposing: false,
    keyCode: 0,
    preventDefault: vi.fn(),
    ...partial,
  };
}

function realClock(): KeyRouterClock {
  return { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
}

function makeFakeConnection(): ConnectionPort & { sent: [string, string | Uint8Array][] } {
  return {
    sent: [],
    request: vi.fn().mockRejectedValue(new Error("not implemented")),
    sendInput(paneId, bytes) {
      this.sent.push([paneId, bytes]);
    },
    login: vi.fn(),
    logout: vi.fn(),
    connect: vi.fn(),
  };
}

function makeFakeAction(): ActionPort & { runs: unknown[] } {
  return { runs: [], run(a) { this.runs.push(a); } };
}
function makeFakeFocus(paneId: string | null): FocusPort {
  return { focusedPaneId: () => paneId };
}
function makeFakeModeSink(): ModeSink & { modes: Mode[] } {
  return { modes: [], onModeChange(m) { this.modes.push(m); } };
}

describe("KeyInputController — dispatch（handleDomKey 経由）", () => {
  it("pass は true を返す（terminal モードで割り当ての無いキー）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    expect(controller.handleDomKey(ev({ key: "a" }))).toBe(true);
  });

  it("consume は false を返す（prefix 中の割り当ての無いキー）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    controller.handleDomKey(ev({ key: "b", ctrlKey: true })); // prefix へ
    expect(controller.handleDomKey(ev({ key: "Q" }))).toBe(false);
  });

  it("send は FocusPort.focusedPaneId() を宛先にして Connection.sendInput を呼ぶ", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p7"), mode: makeFakeModeSink() });
    controller.handleDomKey(ev({ key: "b", ctrlKey: true })); // prefix へ
    controller.handleDomKey(ev({ key: "b", ctrlKey: true })); // もう一度 → \x02 を送る
    expect(connection.sent).toEqual([["p7", "\x02"]]);
  });

  it("action は ActionPort.run を呼ぶ", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const action = makeFakeAction();
    controller.bind({ action, focus: makeFakeFocus(null), mode: makeFakeModeSink() });
    controller.handleDomKey(ev({ key: "b", ctrlKey: true }));
    controller.handleDomKey(ev({ key: "v" }));
    expect(action.runs).toEqual([{ type: "split", dir: "right" }]);
  });

  it("モードの変化を ModeSink へ転送する", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const modeSink = makeFakeModeSink();
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus(null), mode: modeSink });
    controller.handleDomKey(ev({ key: "b", ctrlKey: true }));
    expect(modeSink.modes).toEqual(["prefix"]);
  });

  it("injectKey は handleDomKey と同じ経路（モバイルの追加キー）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    const ctrlB: KeyInput = { key: "b", code: "KeyB", ctrl: true, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(ctrlB);
    controller.injectKey(ctrlB);
    expect(connection.sent).toEqual([["p1", "\x02"]]);
  });

  it("injectKey は pass の決定を対応表のバイト列で送る（ExtraKeys の矢印キー等。04）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    const arrowUp: KeyInput = { key: "ArrowUp", code: "ArrowUp", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(arrowUp);
    expect(connection.sent).toEqual([["p1", "\x1b[A"]]);
  });

  it("injectKey は対応表に無い pass のキーには何もしない", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    const plainA: KeyInput = { key: "a", code: "KeyA", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(plainA);
    expect(connection.sent).toEqual([]);
  });

  it("setMode はダイアログの開閉等、外から直接モードを変える", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const modeSink = makeFakeModeSink();
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus(null), mode: modeSink });
    controller.setMode("dialog");
    expect(router.mode).toBe("dialog");
    expect(modeSink.modes).toEqual(["dialog"]);
  });
});

describe("KeyInputController — setPendingModifier（ExtraKeys の Ctrl/Alt。04-mobile T3）", () => {
  it("one-shot：次の 1 回だけ ctrl を重ね、そのあとは消える（injectKey 経由）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    controller.setPendingModifier({ ctrl: true, alt: false });

    const c: KeyInput = { key: "c", code: "KeyC", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(c); // Ctrl+C → \x03
    controller.injectKey(c); // one-shot は使い切ったので、ただの "c" は pass（対応表に無い）→ 何もしない
    expect(connection.sent).toEqual([["p1", "\x03"]]);
  });

  it("lock：明示的に解除するまで何度でも重なる", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    controller.setPendingModifier({ ctrl: true, alt: false }, { locked: true });

    const c: KeyInput = { key: "c", code: "KeyC", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    const d: KeyInput = { key: "d", code: "KeyD", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(c);
    controller.injectKey(d);
    expect(connection.sent).toEqual([
      ["p1", "\x03"], // Ctrl+C
      ["p1", "\x04"], // Ctrl+D
    ]);

    controller.setPendingModifier(null);
    controller.injectKey(c);
    expect(connection.sent).toHaveLength(2); // 解除後は増えない（"c" は対応表に無いので pass のまま何もしない）
  });

  it("Alt は ESC を前置する", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    controller.setPendingModifier({ ctrl: false, alt: true });
    const f: KeyInput = { key: "f", code: "KeyF", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(f);
    expect(connection.sent).toEqual([["p1", "\x1bf"]]);
  });

  it("Prefix ボタン自体（既に ctrl:true を持つ注入）には pending の Alt を重ねない（レビューで発見）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    const modeSink = makeFakeModeSink();
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: modeSink });
    controller.setPendingModifier({ ctrl: false, alt: true }, { locked: true }); // Alt が armed のまま

    const ctrlB: KeyInput = { key: "b", code: "KeyB", ctrl: true, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(ctrlB); // ExtraKeys の Prefix ボタン
    expect(modeSink.modes).toEqual(["prefix"]); // ctrl+alt+b に化けず、正しく prefix へ入る
    expect(connection.sent).toEqual([]); // 対応表に無い壊れたキーとして握りつぶされていない

    // Alt の armed 状態は消費されずに残っている（次の実際のキーへ重なる）。prefix に入ったままだと
    // 次のキーは prefix の割り当てとして解釈されてしまうので、いったん terminal モードへ戻して確かめる。
    controller.setMode("terminal");
    const f: KeyInput = { key: "f", code: "KeyF", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
    controller.injectKey(f);
    expect(connection.sent).toEqual([["p1", "\x1bf"]]);
  });

  it("実物の xterm.js 経由（handleTerminalKey）でも、ソフトキーボードで打った 1 文字に重なる", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    const term = new Terminal({ cols: 40, rows: 10, allowProposedApi: true });
    term.open(document.createElement("div"));
    const { handler } = attachAndCapture(controller, term, "p9");

    controller.setPendingModifier({ ctrl: true, alt: false });
    const result = handler(ev({ key: "c" }) as unknown as KeyboardEvent);
    expect(result).toBe(false); // ここで処理済み（xterm.js の既定動作には委ねない）
    expect(connection.sent).toEqual([["p9", "\x03"]]);
    term.dispose();
  });

  it("実物の Ctrl キー（ev.ctrlKey）が既に押されているときは pending modifier を使わず、既定どおり pass する", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    const term = new Terminal({ cols: 40, rows: 10, allowProposedApi: true });
    term.open(document.createElement("div"));
    const { handler } = attachAndCapture(controller, term, "p9");

    controller.setPendingModifier({ ctrl: true, alt: false });
    const result = handler(ev({ key: "c", ctrlKey: true }) as unknown as KeyboardEvent);
    expect(result).toBe(true); // 実物の Ctrl が既に付いているので、xterm.js 自身の処理に任せる
    expect(connection.sent).toEqual([]);
    term.dispose();
  });
});

/** `controller.attach(term, paneId)` が `term.attachCustomKeyEventHandler` に渡した関数を捕まえる。 */
function attachAndCapture(controller: KeyInputController, term: Terminal, paneId: string): { handler: (ev: KeyboardEvent) => boolean; disposable: { dispose(): void } } {
  const spy = vi.spyOn(term, "attachCustomKeyEventHandler");
  const disposable = controller.attach(term, paneId);
  const handler = spy.mock.calls[0]?.[0];
  if (!handler) throw new Error("attachCustomKeyEventHandler was not called");
  return { handler, disposable };
}

describe("KeyInputController — attach（実物の xterm.js）", () => {
  let term: Terminal;
  beforeEach(() => {
    term = new Terminal({ cols: 40, rows: 10, allowProposedApi: true });
    term.open(document.createElement("div"));
  });
  afterEach(() => {
    term.dispose();
  });

  it("Ctrl+Shift+V は preventDefault し、クリップボードから読んで term.paste する", async () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const pasteSpy = vi.spyOn(term, "paste").mockImplementation(() => undefined);
    vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("pasted text");
    const { handler } = attachAndCapture(controller, term, "p1");

    const e = ev({ key: "v", ctrlKey: true, shiftKey: true });
    const result = handler(e as unknown as KeyboardEvent);
    expect(result).toBe(false);
    expect(e.preventDefault).toHaveBeenCalled();
    await vi.waitFor(() => expect(pasteSpy).toHaveBeenCalledWith("pasted text"));
  });

  it("Cmd+V（meta）は pass する——ブラウザの標準の貼り付けを xterm.js 自身に任せる", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const { handler } = attachAndCapture(controller, term, "p1");
    const e = ev({ key: "v", metaKey: true });
    expect(handler(e as unknown as KeyboardEvent)).toBe(true);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it("prefix 中の動作キーは attach に渡した paneId 自体が send の宛先になる", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const connection = makeFakeConnection();
    const controller = new KeyInputController(router, connection);
    const { handler } = attachAndCapture(controller, term, "p9");
    handler(ev({ key: "b", ctrlKey: true }) as unknown as KeyboardEvent);
    handler(ev({ key: "b", ctrlKey: true }) as unknown as KeyboardEvent);
    expect(connection.sent).toEqual([["p9", "\x02"]]);
  });

  it("false を返す決定（action・consume・send）は必ず preventDefault する——さもないとブラウザの既定動作で" +
    "そのキー自身が端末の隠し textarea へ素の文字として二重に入力されてしまう（実地の Playwright で発見。D89）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const { handler } = attachAndCapture(controller, term, "p1");

    // prefix に入る（Ctrl+B）。この 1 打目も consume（false）を返す——ここで漏れると `\x02` を
    // 送る前に "b" が literal で入力されてしまう。
    const enterPrefix = ev({ key: "b", ctrlKey: true });
    expect(handler(enterPrefix as unknown as KeyboardEvent)).toBe(false);
    expect(enterPrefix.preventDefault).toHaveBeenCalledTimes(1);

    // action（例：split）を返す 2 打目。ここが D89 の本体——以前は preventDefault されず、
    // "v" がそのまま端末へ literal input として漏れていた。
    const actionKey = ev({ key: "v" });
    expect(handler(actionKey as unknown as KeyboardEvent)).toBe(false);
    expect(actionKey.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("consume（prefix 中の割り当ての無いキー）も preventDefault する（D89）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const { handler } = attachAndCapture(controller, term, "p1");
    handler(ev({ key: "b", ctrlKey: true }) as unknown as KeyboardEvent); // prefix に入る
    const unmapped = ev({ key: "!" }); // DEFAULT_KEYMAP に無いキー
    expect(handler(unmapped as unknown as KeyboardEvent)).toBe(false);
    expect(unmapped.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("pass（terminal モードで割り当ての無いキー）は preventDefault しない——端末自身の既定動作に委ねる", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const { handler } = attachAndCapture(controller, term, "p1");
    const passKey = ev({ key: "a" }); // prefix に入っていない状態の通常キー
    expect(handler(passKey as unknown as KeyboardEvent)).toBe(true);
    expect(passKey.preventDefault).not.toHaveBeenCalled();
  });

  it("dispose すると既定（常に pass）のハンドラを登録し直す", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    const disposable = controller.attach(term, "p1");
    const spy = vi.spyOn(term, "attachCustomKeyEventHandler");
    disposable.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
    const resetHandler = spy.mock.calls[0]?.[0];
    expect(resetHandler?.(ev({ key: "a" }) as unknown as KeyboardEvent)).toBe(true);
  });
});
