import { describe, expect, it, vi } from "vitest";
import type { Action, KeyDecision, KeyInput, Mode, SubModeInterpreter } from "./KeyRouter.js";
import { comboKey, KeyRouter, type KeyRouterClock } from "./KeyRouter.js";
import { DEFAULT_KEYMAP } from "./keymap.js";
import { NavigateMode } from "./NavigateMode.js";
import { ResizeMode } from "./ResizeMode.js";

function key(partial: Partial<KeyInput> & { key: string }): KeyInput {
  return {
    code: "",
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    type: "keydown",
    composing: false,
    ...partial,
  };
}

function ctrlB(): KeyInput {
  return key({ key: "b", ctrl: true });
}

/** 実物の setTimeout/clearTimeout（vitest の偽の時計で制御する）。 */
function realClock(): KeyRouterClock {
  return { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
}

function fakeSubMode(): SubModeInterpreter & { calls: KeyInput[]; nextResult: { action?: Action; exit?: boolean } } {
  return {
    calls: [],
    nextResult: {},
    handle(k) {
      this.calls.push(k);
      return this.nextResult;
    },
  };
}

describe("comboKey", () => {
  it("修飾キーを ctrl/alt/meta の順で前置する", () => {
    expect(comboKey({ key: "b", ctrl: true, alt: false, meta: false, shift: false })).toBe("ctrl+b");
    expect(comboKey({ key: "x", ctrl: true, alt: true, meta: true, shift: false })).toBe("ctrl+alt+meta+x");
  });

  it("文字キーはシフトで大文字になるので shift+ を付けない", () => {
    expect(comboKey({ key: "H", ctrl: false, alt: false, meta: false, shift: true })).toBe("H");
    expect(comboKey({ key: "h", ctrl: false, alt: false, meta: false, shift: false })).toBe("h");
  });

  it("Tab 等シフトで .key が変わらないキーは shift+ を明示する", () => {
    expect(comboKey({ key: "Tab", ctrl: false, alt: false, meta: false, shift: true })).toBe("shift+Tab");
    expect(comboKey({ key: "Tab", ctrl: false, alt: false, meta: false, shift: false })).toBe("Tab");
  });
});

describe("KeyRouter — terminal モード", () => {
  it("既定は terminal で、Ctrl+B 以外は pass する", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    expect(router.mode).toBe("terminal");
    expect(router.handle(key({ key: "a" }))).toEqual<KeyDecision>({ kind: "pass" });
    expect(router.handle(key({ key: "c", ctrl: true }))).toEqual<KeyDecision>({ kind: "pass" }); // Ctrl+C
    expect(router.handle(key({ key: "Escape" }))).toEqual<KeyDecision>({ kind: "pass" });
  });

  it("Ctrl+B で prefix へ入り、そのキー自体は consume する", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    expect(router.handle(ctrlB())).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("prefix");
  });

  it("keydown 以外・IME 変換中は常に pass する（Ctrl+B でも prefix に入らない）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    expect(router.handle(key({ key: "b", ctrl: true, type: "keyup" }))).toEqual<KeyDecision>({ kind: "pass" });
    expect(router.mode).toBe("terminal");
    expect(router.handle(key({ key: "b", ctrl: true, composing: true }))).toEqual<KeyDecision>({ kind: "pass" });
    expect(router.mode).toBe("terminal");
  });
});

describe("KeyRouter — prefix モード", () => {
  it("もう一度 Ctrl+B で \\x02 を送り、terminal へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(ctrlB())).toEqual<KeyDecision>({ kind: "send", bytes: "\x02" });
    expect(router.mode).toBe("terminal");
  });

  it("Esc は何もせず terminal へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "Escape" }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("terminal");
  });

  it("割り当ての無いキーは何もせず terminal へ戻る（端末へも送らない）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "Q" }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("terminal");
  });

  it("修飾キー単体（Shift/Control/Alt/Meta）は prefix を維持したまま無視する（D81）——Shift+T 等は " +
    "ブラウザが Shift 単体の keydown を本命のキーより先に必ず送るため、これを「割り当ての無いキー」として" +
    "扱うと prefix+shift+<文字> が全滅する（実機の Chromium を使う test 工程の実地の確認で発見）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "Shift", shift: true }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("prefix"); // ここではまだ抜けない
    expect(router.handle(key({ key: "T", shift: true }))).toEqual<KeyDecision>({ kind: "action", action: { type: "renameTab" } });
    expect(router.mode).toBe("terminal");
  });

  it("動作キーは action を返し、terminal へ戻る（enterMode 以外）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "v" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "split", dir: "right" } });
    expect(router.mode).toBe("terminal");
  });

  it("tabIndex（1〜9）が正しく引ける", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "3" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "tabIndex", index: 3 } });
  });

  it("enterMode（navigate/copy/resize）はそのモードへ遷移する（terminal へは戻らない）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "w" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "enterMode", mode: "navigate" } });
    expect(router.mode).toBe("navigate");
  });

  // `s` は 20260920-agent-notifications で「通知の設定」になった（`shift+r` が未対応のまま残る）。
  it("後続のキー（例 shift+r）は notYet の action を返し、terminal へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "R", shift: true }))).toEqual<KeyDecision>({ kind: "action", action: { type: "notYet", work: "外観と設定" } });
    expect(router.mode).toBe("terminal");
  });

  it("prefix+s は通知の設定、prefix+o は次の知らせへ移る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.handle(ctrlB());
    expect(router.handle(key({ key: "s" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "notifySettings" } });
    router.handle(ctrlB());
    expect(router.handle(key({ key: "o" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "nextNotification" } });
  });

  it("3 秒経つと自動で terminal へ戻る（D21。herdr には無いが AC-I1 のために維持）", () => {
    vi.useFakeTimers();
    try {
      const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
      router.handle(ctrlB());
      expect(router.mode).toBe("prefix");
      vi.advanceTimersByTime(2999);
      expect(router.mode).toBe("prefix");
      vi.advanceTimersByTime(1);
      expect(router.mode).toBe("terminal");
    } finally {
      vi.useRealTimers();
    }
  });

  it("修飾キー単体は 3 秒のタイマーに触らない（D81。消費もリセットもしない）", () => {
    vi.useFakeTimers();
    try {
      const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
      router.handle(ctrlB());
      vi.advanceTimersByTime(2000);
      router.handle(key({ key: "Shift", shift: true })); // ここでタイマーが消えたり延びたりしない
      expect(router.mode).toBe("prefix");
      vi.advanceTimersByTime(999);
      expect(router.mode).toBe("prefix");
      vi.advanceTimersByTime(1); // enterPrefix から通算 3000ms で戻る
      expect(router.mode).toBe("terminal");
    } finally {
      vi.useRealTimers();
    }
  });

  it("キー入力があれば 3 秒のタイマーを解除する（二重に戻さない）", () => {
    vi.useFakeTimers();
    try {
      const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
      const modes: Mode[] = [];
      router.onModeChange((m) => modes.push(m));
      router.handle(ctrlB());
      router.handle(key({ key: "v" })); // action で戻る
      vi.advanceTimersByTime(3000); // タイマーは解除済みなので、ここで再度 terminal 通知が来ない
      expect(modes).toEqual(["prefix", "terminal"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("KeyRouter — copy モード中の prefix（D56 の訂正 1・5）", () => {
  it("copy モード中に Ctrl+B で prefix へ入り、動作キーの後は copy へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock(), { copy: fakeSubMode() });
    router.setMode("copy");
    expect(router.handle(ctrlB())).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("prefix");
    expect(router.handle(key({ key: "v" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "split", dir: "right" } });
    expect(router.mode).toBe("copy");
  });

  it("copy モード中に Ctrl+B をもう一度で \\x02 を送り、copy へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock(), { copy: fakeSubMode() });
    router.setMode("copy");
    router.handle(ctrlB());
    expect(router.handle(ctrlB())).toEqual<KeyDecision>({ kind: "send", bytes: "\x02" });
    expect(router.mode).toBe("copy");
  });
});

describe("KeyRouter — navigate/resize/copy モードへの委譲", () => {
  it("サブモードの interpreter へキーを渡し、action をそのまま伝える", () => {
    const nav = fakeSubMode();
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock(), { navigate: nav });
    router.setMode("navigate");
    nav.nextResult = { action: { type: "navigate", op: "down" } };
    const k = key({ key: "j" });
    expect(router.handle(k)).toEqual<KeyDecision>({ kind: "action", action: { type: "navigate", op: "down" } });
    expect(nav.calls).toEqual([k]);
    expect(router.mode).toBe("navigate");
  });

  it("interpreter が exit を返したら terminal へ戻る", () => {
    const nav = fakeSubMode();
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock(), { navigate: nav });
    router.setMode("navigate");
    nav.nextResult = { exit: true };
    expect(router.handle(key({ key: "Enter" }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("terminal");
  });

  it("interpreter が無いモードでは Esc だけ terminal へ戻し、ほかは consume する", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.setMode("resize");
    expect(router.handle(key({ key: "h" }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("resize");
    expect(router.handle(key({ key: "Escape" }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("terminal");
  });
});

describe("KeyRouter — setMode / onModeChange", () => {
  it("setMode は外から直接モードを変える（ダイアログの開閉等）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const modes: Mode[] = [];
    router.onModeChange((m) => modes.push(m));
    router.setMode("dialog");
    expect(router.mode).toBe("dialog");
    router.setMode("terminal");
    expect(modes).toEqual(["dialog", "terminal"]);
  });

  it("dialog モードではキーを consume する（部品自身が扱う想定）", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    router.setMode("dialog");
    expect(router.handle(key({ key: "Enter" }))).toEqual<KeyDecision>({ kind: "consume" });
  });

  it("同じモードへの setMode は通知しない", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
    const modes: Mode[] = [];
    router.onModeChange((m) => modes.push(m));
    router.setMode("terminal");
    expect(modes).toEqual([]);
  });
});

describe("KeyRouter — 実物の NavigateMode/ResizeMode との結合", () => {
  it("prefix+w → navigate → h で pane 移動 → Enter で決定して terminal へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock(), { navigate: new NavigateMode() });
    router.handle(ctrlB());
    expect(router.handle(key({ key: "w" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "enterMode", mode: "navigate" } });
    expect(router.mode).toBe("navigate");
    expect(router.handle(key({ key: "h" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "navigate", op: "paneDir", dir: "left" } });
    expect(router.mode).toBe("navigate");
    expect(router.handle(key({ key: "Enter" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "navigate", op: "activate" } });
    expect(router.mode).toBe("terminal");
  });

  it("prefix+r → resize → l で 0.05 → 素の r で terminal へ戻る", () => {
    const router = new KeyRouter(DEFAULT_KEYMAP, realClock(), { resize: new ResizeMode() });
    router.handle(ctrlB());
    router.handle(key({ key: "r" }));
    expect(router.mode).toBe("resize");
    expect(router.handle(key({ key: "l" }))).toEqual<KeyDecision>({ kind: "action", action: { type: "resizeBy", dir: "right", amount: 0.05 } });
    expect(router.handle(key({ key: "r" }))).toEqual<KeyDecision>({ kind: "consume" });
    expect(router.mode).toBe("terminal");
  });
});
