import type { Terminal } from "@xterm/xterm";
import { getCellSize, type CellSize } from "../term/measure.js";

export interface TouchScrollOptions {
  /** タッチを監視する要素（`MobileShell.vue` が pane の領域に取り付ける。T5）。 */
  element: HTMLElement;
  term: Terminal;
  /** テスト用の差し替え（happy-dom にはレイアウトが無く、実物のセル寸法は測れない）。 */
  getCellSize?: (term: Terminal) => CellSize;
}

/** 縦横どちらのジェスチャかを判定するまでの猶予（px）。 */
const DIRECTION_THRESHOLD_PX = 8;

/**
 * xterm.js 6.0.0 のタッチスクロール不具合（U4。D83）を補う自前のタッチ処理
 * （architecture「mobile/*」・design「スクロールと入力」）。縦方向優位のジェスチャだけを
 * `Terminal.scrollLines()` に変換する——横方向優位（選択操作等）は素通しする。
 *
 * 符号の向き：指を上へ動かす（`clientY` が減る）＝新しい内容へ進む＝`scrollLines` に正の値。
 * 指を下へ動かす（`clientY` が増える）＝scrollback を遡る＝負の値
 * （モバイル OS の「自然なスクロール」と同じ向き）。
 *
 * **`touch-action` の注意**：判定が「縦優位」と決まるまでの数 px は、ブラウザのネイティブな
 * タッチ操作（プルリフレッシュ等）と競合しうる。呼び出し側（`MobileShell.vue`）が
 * 監視対象の要素に `touch-action: pan-x` 相当の CSS を当てて、縦方向のネイティブジェスチャを
 * 最初から無効にしておくことを前提にする（この部品自体は CSS を持たない）。
 */
export class TouchScroll {
  private readonly element: HTMLElement;
  private readonly term: Terminal;
  private readonly getCellSizeImpl: (term: Terminal) => CellSize;
  private startX = 0;
  private startY = 0;
  private lastY = 0;
  private direction: "vertical" | "horizontal" | null = null;
  private accumulatedPx = 0;

  constructor(opts: TouchScrollOptions) {
    this.element = opts.element;
    this.term = opts.term;
    this.getCellSizeImpl = opts.getCellSize ?? getCellSize;
    this.element.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.element.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.element.addEventListener("touchend", this.onTouchEnd, { passive: true });
    this.element.addEventListener("touchcancel", this.onTouchEnd, { passive: true });
  }

  dispose(): void {
    this.element.removeEventListener("touchstart", this.onTouchStart);
    this.element.removeEventListener("touchmove", this.onTouchMove as EventListener);
    this.element.removeEventListener("touchend", this.onTouchEnd);
    this.element.removeEventListener("touchcancel", this.onTouchEnd);
  }

  private readonly onTouchStart = (ev: TouchEvent): void => {
    if (ev.touches.length !== 1) return; // ピンチ等の複数指は対象外
    const t = ev.touches[0]!;
    this.startX = t.clientX;
    this.startY = t.clientY;
    this.lastY = t.clientY;
    this.direction = null;
    this.accumulatedPx = 0;
  };

  private readonly onTouchMove = (ev: TouchEvent): void => {
    if (ev.touches.length !== 1) return;
    const t = ev.touches[0]!;
    if (this.direction === null) {
      const dx = Math.abs(t.clientX - this.startX);
      const dy = Math.abs(t.clientY - this.startY);
      if (Math.max(dx, dy) < DIRECTION_THRESHOLD_PX) return; // まだ縦横を判定しない
      this.direction = dy > dx ? "vertical" : "horizontal";
    }
    if (this.direction !== "vertical") return; // 横方向優位は素通し（選択操作等に譲る）
    ev.preventDefault();
    const deltaY = t.clientY - this.lastY;
    this.lastY = t.clientY;
    this.accumulatedPx += deltaY;

    const cellHeight = this.getCellSizeImpl(this.term).height;
    if (cellHeight <= 0) return;
    const lines = Math.trunc(this.accumulatedPx / cellHeight);
    if (lines === 0) return;
    this.accumulatedPx -= lines * cellHeight;
    this.term.scrollLines(-lines);
  };

  private readonly onTouchEnd = (): void => {
    this.direction = null;
  };
}
