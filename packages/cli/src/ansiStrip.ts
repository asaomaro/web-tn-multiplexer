/**
 * ANSI エスケープシーケンスの簡易除去（design.md「`stripAnsi`」節、decisions.md D8）。
 * `pane read` の既定表示（`--raw` 無し）で使う。
 *
 * 対象は ECMA-48 の CSI（Control Sequence Introducer）と OSC（Operating System Command）。
 * - CSI: `ESC [` の後、パラメータバイト（`0-9 : ; < = > ?`）・中間バイト（` ` 〜 `/`）に続けて、
 *   終端バイト（`@` 〜 `~`）で終わる（SGR の色指定・カーソル移動等）。
 * - OSC: `ESC ]` の後、BEL（`\x07`）か ST（`ESC \`）で終わる（端末タイトルの設定等）。
 *
 * 未終端（BEL/ST が来る前に文字列が終わる）のシーケンスはマッチしないため、除去されずそのまま残る
 * （例外は投げない。design「`stripAnsi`」節の明記どおり）。
 */

const CSI_RE = /\u001B\[[0-9:;<=>?]*[ -/]*[@-~]/g;
const OSC_RE = /\u001B\][\s\S]*?(?:\u0007|\u001B\\)/g;

export function stripAnsi(text: string): string {
  return text.replace(OSC_RE, "").replace(CSI_RE, "");
}
