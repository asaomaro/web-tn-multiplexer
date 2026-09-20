import type { Terminal } from "@xterm/xterm";

/** セル（1 文字分）の CSS 上の寸法。 */
export interface CellSize {
  width: number;
  height: number;
}

export interface Dimensions {
  cols: number;
  rows: number;
}

/**
 * 枠の大きさ（CSS px）とセルの寸法から cols/rows を求める純関数（architecture.md「term/measure」）。
 * xterm.js のセルの寸法の取得自体は呼び出し側（`term/ViewSync`）が行う（この部品は DOM も xterm.js も参照しない）。
 */
export function measure(containerWidth: number, containerHeight: number, cell: CellSize): Dimensions {
  const cols = Math.max(1, Math.floor(containerWidth / cell.width));
  const rows = Math.max(1, Math.floor(containerHeight / cell.height));
  return { cols, rows };
}

/**
 * 実物のセルの寸法を xterm.js から読む（`term/ViewSync`・`mobile/TouchScroll` で共有。T2）。
 * xterm.js は公開 API でこれを出していないため、`@xterm/addon-fit` と同じ内部 API を読む
 * （happy-dom 等レイアウトの無い環境では 0 のままなので、既定値にフォールバックする）。
 */
export function getCellSize(term: Terminal): CellSize {
  const core = (term as unknown as { _core?: { _renderService?: { dimensions?: { css?: { cell?: CellSize } } } } })._core;
  const cell = core?._renderService?.dimensions?.css?.cell;
  return cell && cell.width > 0 && cell.height > 0 ? cell : { width: 9, height: 18 };
}
