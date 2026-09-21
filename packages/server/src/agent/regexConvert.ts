/**
 * herdr の判定ルール（Rust の `regex` クレートの構文）を JavaScript の `RegExp` へ変換する（design U2・D46・T2）。
 * Rust 側の構文は herdr のソース（`da6bcd5`。Apache-2.0・D5）の判定ルール 23 ファイルを実測して
 * 洗い出した（`decisions.md` D47）。ここで扱うのは、その実測で見つかった範囲だけ——
 * Rust 正規表現の構文全体を汎用的に変換するものではない。
 *
 * 変換できない式は例外を投げず `{ ok: false, reason }` を返す（呼び出し側＝`ManifestStore`（T3）が、
 * そのルールだけを無効にしてログに残すため。design「読めないファイルはそのエージェントだけ無効にする」）。
 */

export type RegexConvertResult = { ok: true; regex: RegExp } | { ok: false; reason: string };

/** 変換後に必ず付ける flag（Unicode モード。`\u{…}`・`\p{…}` を使うために要る）。 */
const BASE_FLAGS = "u";

/** 先頭のインライン flag（`(?i)`・`(?m)`・`(?s)` または `(?ims)` のような組み合わせ）。
 *  実測した 23 ファイルでは必ず式の先頭にしか現れない（`decisions.md` D47）ので、それ以外の位置は変換しない。 */
const LEADING_INLINE_FLAGS_RE = /^\(\?([ims]+)\)/;
const SUPPORTED_INLINE_FLAG_CHARS = new Set(["i", "m", "s"]);

export function convertRustRegex(pattern: string): RegexConvertResult {
  let rest = pattern;
  const flags = new Set<string>(BASE_FLAGS);

  const leadingFlags = LEADING_INLINE_FLAGS_RE.exec(rest);
  if (leadingFlags) {
    const chars = leadingFlags[1]!;
    for (const ch of chars) {
      if (!SUPPORTED_INLINE_FLAG_CHARS.has(ch)) {
        return { ok: false, reason: `unsupported inline flag '${ch}' in "(?${chars})"` };
      }
      flags.add(ch);
    }
    rest = rest.slice(leadingFlags[0].length);
  }
  // 先頭以外に残った `(?i)` 等は未対応（JS には式の途中だけ効かせる同等の構文が無い。ES2025 の
  // modifier group `(?i:...)` は使えるが、herdr 側がそこまでの構文を使っていないので扱わない）。
  if (/\(\?[ims]+\)/.test(rest)) {
    return { ok: false, reason: "inline flag group appears outside the leading position" };
  }

  // \x{HHHH}（Rust）→ \u{HHHH}（JS。u フラグ必須）。桁数はそのまま素通しする（両方とも可変長 1〜6 桁を許す）。
  rest = rest.replace(/\\x\{([0-9a-fA-F]+)\}/g, "\\u{$1}");
  // \A（Rust。ヘイスタックの絶対先頭。multiline でも動かない）→ 「直前に何も無い」の否定後読みで表す。
  // \z（同・絶対末尾）→ 「直後に何も無い」の否定先読み。どちらも m フラグの影響を受けない
  // （JS の ^/$ は m フラグで行境界に化けるが、これらの読みは常に文字列全体の端を指す）。
  rest = rest.replace(/\\A/g, "(?<![^])").replace(/\\z/g, "(?![^])");

  try {
    return { ok: true, regex: new RegExp(rest, [...flags].sort().join("")) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
