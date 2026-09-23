import { watch } from "vue";

/**
 * 全画面のとき、ブラウザ・OS 予約キーの一部を `navigator.keyboard.lock()` で受け取れるようにする
 * （20260922-keybinding-usability。design「US4」）。`ThemeController`（`theme/ThemeController.ts`）
 * と同型：`start()` が `fullscreenchange` を聞き始め、`stop()` で後始末する。
 */

/**
 * requirements.md の対象（20260921-keybinding-customization の research.md F27 由来）が挙げた
 * 予約キーの物理コード（`code`）。`Ctrl+Shift+T/N/W` も同じキーを使うので重複しない。
 */
export const LOCKED_CODES: readonly string[] = ["KeyT", "KeyN", "KeyW", "Tab", "PageUp", "PageDown"];

export interface KeyboardLockControllerOptions {
  settings: { keyboardLockInFullscreen: boolean };
  doc: Pick<Document, "addEventListener" | "removeEventListener"> & {
    fullscreenElement: Element | null;
  };
  /** `navigator.keyboard`。無い環境（Firefox・Safari 等）では null（feature-detect）。 */
  keyboard: { lock(codes?: string[]): Promise<void>; unlock(): void } | null;
}

export class KeyboardLockController {
  private readonly stops: (() => void)[] = [];

  constructor(private readonly opts: KeyboardLockControllerOptions) {}

  /** `fullscreenchange` と設定の変化を聞き始め、いまの状態に同期する。 */
  start(): void {
    const { doc, settings } = this.opts;
    const onChange = (): void => this.sync();
    doc.addEventListener("fullscreenchange", onChange);
    this.stops.push(() => doc.removeEventListener("fullscreenchange", onChange));
    const stopWatch = watch(() => settings.keyboardLockInFullscreen, () => this.sync());
    this.stops.push(stopWatch);
    this.sync();
  }

  /** 聞くのをやめる（テスト用）。 */
  stop(): void {
    for (const stop of this.stops.splice(0)) stop();
  }

  /** いまの設定・全画面状態に合わせて lock/unlock する。API が無い・失敗する環境では何もしない（AC14）。 */
  private sync(): void {
    const { doc, settings, keyboard } = this.opts;
    if (keyboard === null) return;
    const shouldLock = settings.keyboardLockInFullscreen && doc.fullscreenElement !== null;
    try {
      if (shouldLock) void keyboard.lock([...LOCKED_CODES]).catch(() => undefined);
      else keyboard.unlock();
    } catch {
      // AC14：例外を投げない。
    }
  }
}
