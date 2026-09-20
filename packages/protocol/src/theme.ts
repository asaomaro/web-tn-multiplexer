/**
 * 既定のテーマの色。design.md「ブラウザ側での問い合わせの握りつぶし」・D17 参照。
 * サーバのミラー（headless）は色の問い合わせ（OSC 4/10/11/12）に標準では応答しないため、
 * サーバ側でこの色を使って応答を作る。ブラウザ側の xterm.js のテーマにも同じ値を使う。
 */
export interface TerminalPalette {
  foreground: string;
  background: string;
  cursor: string;
  /** OSC 4 のインデックスカラー（0〜15）。 */
  ansi: [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string,
  ];
}

/** Dracula 系の暗い既定テーマ（herdr の既定に近い色調。research.md F7 の H24 は後続扱いなので固定 1 種）。 */
export const DEFAULT_THEME: TerminalPalette = {
  foreground: "#f8f8f2",
  background: "#282a36",
  cursor: "#f8f8f2",
  ansi: [
    "#21222c", "#ff5555", "#50fa7b", "#f1fa8c",
    "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2",
    "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5",
    "#d6acff", "#ff92df", "#a4ffff", "#ffffff",
  ],
};
