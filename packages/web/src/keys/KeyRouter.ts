import type { Action, KeyDecision, KeyInput, Mode } from "./actions.js";
import type { Keymap } from "./keymap.js";

export type { Action, CopyCommand, Dir, KeyDecision, KeyInput, Mode } from "./actions.js";

const PREFIX_TIMEOUT_MS = 3000; // AC-I1「一定時間の経過で解除」（D21）。herdr 自身には時間切れが無い（D55/D56）。

export interface KeyRouterClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

/**
 * `navigate` / `copy` / `resize` モードの内部状態とキーの解釈（`keys/NavigateMode`・`CopyMode`・`ResizeMode`。T7・T8）。
 * `KeyRouter` はモードの持ち主のまま、解釈だけをこれらに委ねる（architecture「keys/KeyRouter.ts」）。
 */
export interface SubModeInterpreter {
  /** `exit: true` なら terminal モードへ戻す（呼び出し側は自身の内部状態をリセットしてよい）。 */
  handle(k: KeyInput): { action?: Action; exit?: boolean };
}

export interface SubModeInterpreters {
  navigate?: SubModeInterpreter;
  copy?: SubModeInterpreter;
  resize?: SubModeInterpreter;
}

/** `KeyInput` を `keymap.ts` のキー表記に正規化する（大文字はシフトを含む。Tab 等は明示的に `shift+` を足す）。 */
const SHIFT_INSENSITIVE_KEYS = new Set(["Tab", "Enter", "Escape", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", "Backspace", "Delete"]);

/**
 * 修飾キー単体の `KeyboardEvent.key`（D81）。`Shift+T` 等を押すと、ブラウザは本命のキーより**先に
 * `Shift` 単体の keydown を必ず発火する**（合成入力に限らず実機のキーボードでも同じ順）。これを
 * `DEFAULT_KEYMAP` に無い「割り当ての無いキー」として扱うと、prefix 中に修飾キー単体の keydown が
 * 先に届いて prefix を抜けてしまい、本命の `Shift+<文字>`（`P`/`T`/`X`/`N`/`W`/`D`/`H`/`J`/`K`/`L`/`R`）が
 * 全滅する（実機の Chromium を使う test 工程の実地の確認で発見）。
 */
const MODIFIER_ONLY_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph"]);

export function comboKey(k: Pick<KeyInput, "key" | "ctrl" | "alt" | "meta" | "shift">): string {
  const mods: string[] = [];
  if (k.ctrl) mods.push("ctrl");
  if (k.alt) mods.push("alt");
  if (k.meta) mods.push("meta");
  if (k.shift && SHIFT_INSENSITIVE_KEYS.has(k.key)) mods.push("shift");
  return [...mods, k.key].join("+");
}

/**
 * prefix（`Ctrl+B`）の状態機械（architecture.md「keys/KeyRouter.ts」）。Vue にも DOM にも依存しない。
 * herdr のソースで確定させた挙動（D55・D56）: prefix 中にもう一度 prefix を押すと `\x02` を端末へ送る、
 * 割り当ての無いキーは黙って捨てる、copy モード中も prefix が効き元の copy モードへ戻る。
 * prefix の 3 秒の時間切れは herdr には無いが、AC-I1 の要求により本製品では維持する。
 */
export class KeyRouter {
  private currentMode: Mode = "terminal";
  /** prefix から戻る先（terminal のことが多いが、copy モード中に prefix へ入った場合は copy）。 */
  private returnMode: Mode = "terminal";
  private prefixTimer: unknown = null;
  private readonly modeListeners = new Set<(m: Mode) => void>();

  constructor(
    private readonly keymap: Keymap,
    private readonly clock: KeyRouterClock,
    private readonly subModes: SubModeInterpreters = {},
  ) {}

  get mode(): Mode {
    return this.currentMode;
  }

  handle(k: KeyInput): KeyDecision {
    // keydown 以外・IME の変換中は prefix と判定しない（design「キー操作」）。どのモードでも同様に扱う。
    if (k.type !== "keydown" || k.composing) return { kind: "pass" };

    const combo = comboKey(k);

    if (this.currentMode === "prefix") return this.handleInPrefix(combo, k.key);

    if (this.currentMode === "terminal" || this.currentMode === "copy") {
      if (combo === "ctrl+b") return this.enterPrefix();
      if (this.currentMode === "terminal") return { kind: "pass" };
      return this.delegateToSubMode(this.subModes.copy, k);
    }

    if (this.currentMode === "navigate") return this.delegateToSubMode(this.subModes.navigate, k);
    if (this.currentMode === "resize") return this.delegateToSubMode(this.subModes.resize, k);

    // dialog: ダイアログの部品自身がキーを扱う（フォーカスが移っているので通常ここへは来ない）。
    return { kind: "consume" };
  }

  setMode(m: Mode): void {
    this.clearPrefixTimer();
    this.setModeInternal(m);
  }

  onModeChange(cb: (m: Mode) => void): void {
    this.modeListeners.add(cb);
  }

  private handleInPrefix(combo: string, key: string): KeyDecision {
    // 修飾キー単体の keydown（D81）：prefix を維持したまま無視する（timer にも触らない——`Shift+T` の
    // `Shift` だけで 3 秒の猶予を消費・リセットしないため）。
    if (MODIFIER_ONLY_KEYS.has(key)) return { kind: "consume" };
    this.clearPrefixTimer();
    if (combo === "ctrl+b") {
      this.setModeInternal(this.returnMode);
      return { kind: "send", bytes: "\x02" };
    }
    if (combo === "Escape") {
      this.setModeInternal(this.returnMode);
      return { kind: "consume" };
    }
    const action = this.keymap.get(combo);
    if (!action) {
      this.setModeInternal(this.returnMode);
      return { kind: "consume" };
    }
    this.setModeInternal(action.type === "enterMode" ? action.mode : this.returnMode);
    return { kind: "action", action };
  }

  private enterPrefix(): KeyDecision {
    this.returnMode = this.currentMode;
    this.setModeInternal("prefix");
    this.prefixTimer = this.clock.setTimeout(() => {
      this.prefixTimer = null;
      this.setModeInternal(this.returnMode);
    }, PREFIX_TIMEOUT_MS);
    return { kind: "consume" };
  }

  private delegateToSubMode(interpreter: SubModeInterpreter | undefined, k: KeyInput): KeyDecision {
    if (!interpreter) {
      if (k.key === "Escape") {
        this.setModeInternal("terminal");
        return { kind: "consume" };
      }
      return { kind: "consume" };
    }
    const result = interpreter.handle(k);
    if (result.exit) this.setModeInternal("terminal");
    return result.action ? { kind: "action", action: result.action } : { kind: "consume" };
  }

  private setModeInternal(m: Mode): void {
    if (this.currentMode === m) return;
    this.currentMode = m;
    for (const cb of this.modeListeners) cb(m);
  }

  private clearPrefixTimer(): void {
    if (this.prefixTimer !== null) {
      this.clock.clearTimeout(this.prefixTimer);
      this.prefixTimer = null;
    }
  }
}
