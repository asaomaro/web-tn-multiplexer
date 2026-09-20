import type { Terminal } from "@xterm/xterm";
import type { ConnectionPort } from "../net/ports.js";
import { readClipboard } from "../term/clipboard.js";
import type { KeyInput, Mode } from "./actions.js";
import type { KeyRouter } from "./KeyRouter.js";

export interface Disposable {
  dispose(): void;
}

export interface ActionPort {
  run(action: import("./actions.js").Action): void;
}
export interface FocusPort {
  focusedPaneId(): string | null;
}
export interface ModeSink {
  onModeChange(m: Mode): void;
}

/** `Terminal.attachCustomKeyEventHandler` に渡す形の最小限（テストで差し替える）。 */
export interface KeyboardEventLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  type: string;
  isComposing: boolean;
  keyCode: number;
  preventDefault(): void;
}

function toKeyInput(ev: KeyboardEventLike): KeyInput {
  return {
    key: ev.key,
    code: ev.code,
    ctrl: ev.ctrlKey,
    alt: ev.altKey,
    shift: ev.shiftKey,
    meta: ev.metaKey,
    type: ev.type === "keyup" ? "keyup" : ev.type === "keypress" ? "keypress" : "keydown",
    composing: ev.isComposing || ev.keyCode === 229,
  };
}

/** `Ctrl+Shift+V`（Windows/Linux）。macOS の `Cmd+V` はブラウザの標準の貼り付けなので、xterm.js が自分で拾う（design「貼り付け」）。 */
function isManualPasteShortcut(ev: KeyboardEventLike): boolean {
  return ev.type === "keydown" && !ev.isComposing && ev.ctrlKey && ev.shiftKey && !ev.altKey && !ev.metaKey && ev.key.toLowerCase() === "v";
}

/**
 * `pass`（端末の既定動作）の決定を `injectKey` で再現するための、制御シーケンスへの変換（04-mobile T3）。
 * `injectKey` には合成できる実物の `KeyboardEvent` が無い（xterm.js へ渡して既定動作をさせられない）ため、
 * 対応するバイト列を直接送る。**DECCKM（アプリケーションカーソルキーモード）等は見ない簡略化**
 * ——`KeyInputController` は `paneId → Terminal` を持たない設計（`attach` のたびに呼び出し側から渡される
 * だけ）なので、モードを問い合わせるには設計を変える必要があり、MVP では見送った（decisions.md）。
 */
const INJECT_PASSTHROUGH_BYTES: Partial<Record<string, string>> = {
  Escape: "\x1b",
  Tab: "\t",
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowRight: "\x1b[C",
  ArrowLeft: "\x1b[D",
  PageUp: "\x1b[5~",
  PageDown: "\x1b[6~",
};

/**
 * `Ctrl`/`Alt` の one-shot / lock（`setPendingModifier`）を、実際にソフトキーボードで打った 1 文字に
 * 重ねてバイト列へ変換する（04-mobile T3）。`Ctrl+<英字>` は制御コード（1〜26。`Ctrl+C` → `\x03` 等の
 * 標準的な対応）、`Alt+<1文字>` は ESC 前置（多くの端末エミュレータの慣習）。変換できないキー
 * （矢印・Enter 等との組み合わせ）は `null` を返し、呼び出し側は既定動作へフォールバックする。
 */
function modifiedByte(key: string, mod: PendingModifier): string | null {
  if (key.length !== 1) return null;
  if (mod.ctrl) {
    const code = key.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 95) return String.fromCharCode(code - 64); // A-Z・[ \ ] ^ _
    return null;
  }
  if (mod.alt) return `\x1b${key}`;
  return null;
}

/**
 * 各 xterm.js の `attachCustomKeyEventHandler`（`attach`）と、端末以外にフォーカスがあるときの `handleDomKey`、
 * モバイルの追加キー（`injectKey`）を受ける（architecture.md「keys/KeyInputController.ts」）。
 */
/** `KeyInputController.setPendingModifier` の引数（04-mobile T3。ExtraKeys の Ctrl/Alt）。 */
export interface PendingModifier {
  ctrl: boolean;
  alt: boolean;
}

export class KeyInputController {
  private action: ActionPort | null = null;
  private focus: FocusPort | null = null;
  private modeSink: ModeSink | null = null;
  private pendingModifier: PendingModifier | null = null;
  private pendingModifierLocked = false;

  constructor(
    private readonly router: KeyRouter,
    private readonly connection: ConnectionPort,
  ) {
    this.router.onModeChange((m) => this.modeSink?.onModeChange(m));
  }

  bind(ports: { action: ActionPort; focus: FocusPort; mode: ModeSink }): void {
    this.action = ports.action;
    this.focus = ports.focus;
    this.modeSink = ports.mode;
  }

  /**
   * モバイルの Ctrl/Alt キー（`ExtraKeys`。04）：`locked` が無ければ次の 1 回の実キー入力にだけ
   * 重ねて消える（one-shot）、あれば `null` を渡して解除するまでずっと重ねる（lock）。
   * `handleTerminalKey`/`handleDomKey`/`injectKey` のいずれの経路の次のキーにも効く
   * （どこから実際に入力されるかを `ExtraKeys` 側は気にしなくてよい）。
   */
  setPendingModifier(mod: PendingModifier | null, opts?: { locked?: boolean }): void {
    this.pendingModifier = mod;
    this.pendingModifierLocked = !!opts?.locked;
  }

  /**
   * 既に実物の ctrl/alt を持つキー（例：`ExtraKeys` の Prefix ボタン自体が送る `ctrl+b`）には重ねない
   * （04-mobile レビューで発見。`Alt` を armed にしたまま Prefix ボタンを押すと `ctrl+alt+b` になり、
   * `KeyRouter` の `combo === "ctrl+b"` 判定に一致せず、対応表にも無いキーとして黙って握りつぶされ、
   * prefix に入れなくなる不具合があった）。pending の状態自体はここでは消費しない——「次に実際に入力される
   * 無修飾のキー」に重ねるための状態であり、Prefix のような既に完成した特殊キーの注入で消費してしまうと、
   * 直後に打つはずだった本来のキーから Ctrl/Alt が失われる。
   */
  private applyPendingModifier(k: KeyInput): KeyInput {
    if (!this.pendingModifier || k.type !== "keydown" || k.ctrl || k.alt) return k;
    const merged: KeyInput = { ...k, ctrl: this.pendingModifier.ctrl, alt: this.pendingModifier.alt };
    if (!this.pendingModifierLocked) this.pendingModifier = null; // one-shot はここで使い切る
    return merged;
  }

  /** xterm.js インスタンスごとに 1 回呼ぶ（`TerminalRegistry.acquire`。T12）。 */
  attach(term: Terminal, paneId: string): Disposable {
    term.attachCustomKeyEventHandler((ev) => this.handleTerminalKey(ev as unknown as KeyboardEventLike, term, paneId));
    return { dispose: () => term.attachCustomKeyEventHandler(() => true) };
  }

  /** 端末以外（サイドバー等）にフォーカスがあるときの keydown。`true` なら既定の動作のままでよい。 */
  handleDomKey(ev: KeyboardEventLike): boolean {
    if (isManualPasteShortcut(ev)) return true; // 端末にフォーカスが無ければ貼り付け先が無い
    const decision = this.router.handle(this.applyPendingModifier(toKeyInput(ev)));
    return this.dispatch(decision, null);
  }

  /**
   * モバイルの追加キーの列（`ExtraKeys`。04）から、DOM イベントを経由せずに直接キーを注入する。
   * `pass`（端末の既定動作）の決定は `injectKey` には合成できる `KeyboardEvent` が無いため、
   * {@link INJECT_PASSTHROUGH_BYTES} の対応表で直接バイト列を送る（対応表に無いキーは何もしない）。
   */
  injectKey(k: KeyInput): void {
    const activeModifier = this.pendingModifier; // applyPendingModifier が one-shot なら消してしまう前に控える
    const applied = this.applyPendingModifier(k);
    const decision = this.router.handle(applied);
    if (decision.kind === "pass") {
      const target = this.focus?.focusedPaneId() ?? null;
      // pending modifier（Ctrl/Alt。ExtraKeys）が理由でここに来た場合を先に試す。元のキーに実物の
      // ctrl/alt が付いていなければ、Ctrl+<英字> 等への変換を試みる（modifiedByte。無ければ対応表へ）。
      const byModifier = activeModifier && !k.ctrl && !k.alt ? modifiedByte(k.key, activeModifier) : null;
      const bytes = byModifier ?? INJECT_PASSTHROUGH_BYTES[applied.key];
      if (bytes && target) this.connection.sendInput(target, bytes);
      return;
    }
    this.dispatch(decision, null);
  }

  setMode(m: Mode): void {
    this.router.setMode(m);
  }

  /**
   * `false`（＝ここで処理済み・端末の既定動作をさせない）を返す全ての経路で、必ず
   * `ev.preventDefault()` を呼んでから返す（05-e2e-docs T2 の E2E で発見。D89）。xterm.js の
   * `attachCustomKeyEventHandler` は「`false` を返せば xterm 側の既定処理はしない」だけで、
   * ブラウザ自身の既定動作（フォーカス中の `<textarea>`（`xterm-helper-textarea`）への文字の挿入）
   * は**呼び出し側が `preventDefault()` しない限り止まらない**（`addEventListener` に渡した関数の
   * 戻り値はブラウザから無視される。xterm.js の `_keyDown` も戻り値だけで早期 return し、
   * 自分では `preventDefault()` しない——公式ドキュメントで「呼び出し側の責務」と明記されている）。
   * これを怠っていたため、prefix の 2 打目のキー（`v`・`-`・`h`・`l` 等、ほぼ全ての割り当てキー）が
   * **アクションとして処理されると同時に、素の文字として端末へ入力されてもいた**（`?` のように
   * 同じ tick 内でダイアログが開きフォーカスが移る決定は、たまたま既定動作が無害化されて隠れていた）。
   */
  private handleTerminalKey(ev: KeyboardEventLike, term: Terminal, paneId: string): boolean {
    const passThrough = this.resolveTerminalKey(ev, term, paneId);
    if (!passThrough) ev.preventDefault();
    return passThrough;
  }

  private resolveTerminalKey(ev: KeyboardEventLike, term: Terminal, paneId: string): boolean {
    if (isManualPasteShortcut(ev)) {
      void readClipboard().then((text) => {
        if (text) term.paste(text);
      });
      return false;
    }
    const raw = toKeyInput(ev);
    const activeModifier = this.pendingModifier; // applyPendingModifier が one-shot なら消してしまう前に控える
    const decision = this.router.handle(this.applyPendingModifier(raw));
    if (decision.kind === "pass" && activeModifier && !raw.ctrl && !raw.alt) {
      // 実物の Ctrl/Alt キーではなく ExtraKeys の pending modifier が理由で "pass" になった場合、
      // xterm.js の既定動作（未修飾のキーとして処理される）に任せると Ctrl/Alt が失われる——
      // ここで直接バイト列に変換して送る（modifiedByte）。変換できなければ諦めて既定動作へ委ねる。
      const bytes = modifiedByte(raw.key, activeModifier);
      if (bytes) {
        this.connection.sendInput(paneId, bytes);
        return false;
      }
    }
    return this.dispatch(decision, paneId);
  }

  /** `KeyDecision` を実際の効果にする。戻り値は xterm.js の `attachCustomKeyEventHandler` と同じ意味
   *  （`true`＝既定の動作のまま・`false`＝ここで処理済み）。 */
  private dispatch(decision: ReturnType<KeyRouter["handle"]>, paneId: string | null): boolean {
    switch (decision.kind) {
      case "pass":
        return true;
      case "consume":
        return false;
      case "send": {
        const target = paneId ?? this.focus?.focusedPaneId() ?? null;
        if (target) this.connection.sendInput(target, decision.bytes);
        return false;
      }
      case "action":
        this.action?.run(decision.action);
        return false;
    }
  }
}
