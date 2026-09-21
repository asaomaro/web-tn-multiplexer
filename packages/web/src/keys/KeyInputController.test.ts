import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionPort } from "../net/ports.js";
import type { KeyInput, Mode } from "./actions.js";
import { KeyInputController, type ActionPort, type FocusPort, type KeyboardEventLike, type ModeSink } from "./KeyInputController.js";
import { KeyRouter, type KeyRouterClock } from "./KeyRouter.js";
import { emptyKeyPrefs, type KeyPrefs } from "./keyPrefs.js";
import { DEFAULT_KEYMAP, resolveKeymap } from "./keymap.js";
import { NavigateMode } from "./NavigateMode.js";
import { ResizeMode } from "./ResizeMode.js";

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

// ---------------------------------------------------------------------------------------------------------------------
// 20260921-keybinding-customization：直接のキー・prefix の変更・AltGraph・繰り返し・Prefix ボタン
// ---------------------------------------------------------------------------------------------------------------------

function routerWith(partial: Partial<KeyPrefs>, subModes = {}): KeyRouter {
  return new KeyRouter(resolveKeymap({ ...emptyKeyPrefs(), ...partial }).keymap, realClock(), subModes);
}

/** xterm.js の `attachCustomKeyEventHandler` に渡された関数を取り出す（`attach` が登録する）。 */
function attachedHandler(controller: KeyInputController): (e: KeyboardEventLike) => boolean {
  let handler: ((e: KeyboardEventLike) => boolean) | null = null;
  const term = { attachCustomKeyEventHandler: (h: (e: KeyboardEventLike) => boolean) => { handler = h; } } as unknown as Terminal;
  controller.attach(term, "p1");
  return (e) => handler!(e);
}

describe("KeyInputController — 直接のキー（AC5）", () => {
  const direct: Partial<KeyPrefs> = { bindings: { split_vertical: ["prefix+v", "ctrl+alt+d"], zoom: ["f5"] } };

  it("xterm の入口：直接のキーは action を実行し、端末へ届かない（false＋preventDefault。何も送らない）", () => {
    const connection = makeFakeConnection();
    const action = makeFakeAction();
    const controller = new KeyInputController(routerWith(direct), connection);
    controller.bind({ action, focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    const handler = attachedHandler(controller);
    const e = ev({ key: "d", ctrlKey: true, altKey: true });
    expect(handler(e)).toBe(false);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(action.runs).toEqual([{ type: "split", dir: "right" }]);
    expect(connection.sent).toEqual([]);
    // 割り当てのない ctrl+alt+y は端末の入力（true）
    const other = ev({ key: "y", ctrlKey: true, altKey: true });
    expect(handler(other)).toBe(true);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it("端末以外にフォーカスがあるとき（handleDomKey）も効く", () => {
    const action = makeFakeAction();
    const controller = new KeyInputController(routerWith(direct), makeFakeConnection());
    controller.bind({ action, focus: makeFakeFocus(null), mode: makeFakeModeSink() });
    expect(controller.handleDomKey(ev({ key: "F5" }))).toBe(false);
    expect(action.runs).toEqual([{ type: "zoom" }]);
  });

  it("押しっぱなしの繰り返し（repeat）は、割り当てのある直接のキーなら 1 回しか実行しない（false で食う）", () => {
    const action = makeFakeAction();
    const controller = new KeyInputController(routerWith(direct), makeFakeConnection());
    controller.bind({ action, focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    const handler = attachedHandler(controller);
    expect(handler(ev({ key: "d", ctrlKey: true, altKey: true }))).toBe(false);
    const repeated = ev({ key: "d", ctrlKey: true, altKey: true, repeat: true });
    expect(handler(repeated)).toBe(false);
    expect(repeated.preventDefault).toHaveBeenCalled();
    expect(action.runs).toHaveLength(1);
  });

  it("ダイアログの中（dialog モード）では直接のキーを引かない", () => {
    const action = makeFakeAction();
    const controller = new KeyInputController(routerWith(direct), makeFakeConnection());
    controller.bind({ action, focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    controller.setMode("dialog");
    controller.handleDomKey(ev({ key: "d", ctrlKey: true, altKey: true }));
    expect(action.runs).toEqual([]);
  });
});

describe("KeyInputController — prefix の変更（AC3）", () => {
  it("旧い prefix（ctrl+b）は端末へ素通し（true）・新しい prefix で prefix に入り、2 度押しでそのキー自身を送る", () => {
    const connection = makeFakeConnection();
    const controller = new KeyInputController(routerWith({ prefix: "ctrl+a" }), connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p9"), mode: makeFakeModeSink() });
    const handler = attachedHandler(controller);
    expect(handler(ev({ key: "b", ctrlKey: true }))).toBe(true);
    expect(handler(ev({ key: "a", ctrlKey: true }))).toBe(false); // prefix へ
    expect(handler(ev({ key: "a", ctrlKey: true }))).toBe(false); // 2 度押し
    expect(connection.sent).toEqual([["p1", "\x01"]]);
  });
});

describe("KeyInputController — IME の変換中（keyInputOf 経由）", () => {
  it("keyCode 229 は変換中として prefix に入らない", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    expect(controller.handleDomKey(ev({ key: "b", ctrlKey: true, keyCode: 229 }))).toBe(true);
    expect(router.mode).toBe("terminal");
  });
});

describe("KeyInputController.injectPrefix — モバイルの Prefix ボタン（AC11）", () => {
  it("既定の prefix（ctrl+b）で prefix に入り、もう一度押すと \x02 を送る", () => {
    const connection = makeFakeConnection();
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, connection);
    controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    controller.injectPrefix();
    expect(router.mode).toBe("prefix");
    controller.injectPrefix();
    expect(connection.sent).toEqual([["p1", "\x02"]]);
  });

  it("変えた prefix（alt+x・F5）を注入する", () => {
    for (const [prefix, bytes] of [["alt+x", "\x1bx"], ["f5", "\x1b[15~"]] as const) {
      const connection = makeFakeConnection();
      const router = routerWith({ prefix });
      const controller = new KeyInputController(router, connection);
      controller.bind({ action: makeFakeAction(), focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
      controller.injectPrefix();
      expect(router.mode, prefix).toBe("prefix");
      controller.injectPrefix();
      expect(connection.sent, prefix).toEqual([["p1", bytes]]);
    }
  });

  it("待機中の Ctrl/Alt（ExtraKeys）は重ねない：F キーの prefix でも prefix に入れ、待機は消費しない（次の実キーに残る）", () => {
    const router = routerWith({ prefix: "f5" });
    const action = makeFakeAction();
    const controller = new KeyInputController(router, makeFakeConnection());
    controller.bind({ action, focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
    controller.setPendingModifier({ ctrl: true, alt: false });
    controller.injectPrefix();
    expect(router.mode).toBe("prefix");
    // 待機が消費されていれば `v` は prefix の後の v（右へ分割）として引かれる。残っていれば ctrl+v（割り当てなし）で、何も実行されずに prefix を抜ける。
    controller.injectKey({ key: "v", code: "KeyV", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false });
    expect(router.mode).toBe("terminal");
    expect(action.runs).toEqual([]);
  });

  it("navigate・resize・dialog モードでは何もしない（そのモードのキーは修飾キーを見ないので、変えた prefix が pane の移動・resize になってしまう）", () => {
    for (const mode of ["navigate", "resize", "dialog"] as const) {
      const connection = makeFakeConnection();
      const action = makeFakeAction();
      // **実物のモードの解釈を渡す**——渡さないと解釈の無いモードは何を受けても consume するので、注入したキー（`j`）が pane の移動・resize になる不具合が見えない。
      const router = routerWith({ prefix: "alt+j" }, { navigate: new NavigateMode(), resize: new ResizeMode() });
      const controller = new KeyInputController(router, connection);
      controller.bind({ action, focus: makeFakeFocus("p1"), mode: makeFakeModeSink() });
      router.setMode(mode);
      controller.injectPrefix();
      expect(router.mode, mode).toBe(mode);
      expect(action.runs, mode).toEqual([]);
      expect(connection.sent, mode).toEqual([]);
    }
  });

  it("copy モードでも prefix に入れる（戻り先は copy）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const controller = new KeyInputController(router, makeFakeConnection());
    router.setMode("copy");
    controller.injectPrefix();
    expect(router.mode).toBe("prefix");
  });
});
