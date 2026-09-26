/**
 * 画面履歴（20260926-screen-history-replay）の中身の扱い：流す前の安全化・大きさの切り詰め・区切りの行。
 * herdr の pane screen history（`[experimental] pane_history`）に当たる。design「`terminal/historyAnsi.ts`」。
 */

/** pane ごとの保存量の上限（ANSI の UTF-8 バイト数。decisions D5）。 */
export const PANE_HISTORY_MAX_PANE_BYTES = 2 * 1024 * 1024;

const ESC = 0x1b;
const BEL = 0x07;

/** 残す CSI（SGR とカーソルの移動・消去。`@xterm/addon-serialize` の直列化が使う範囲だけ。research F2・decisions D4）。 */
// eslint-disable-next-line no-control-regex -- ESC から始まる並びを照合する
const ALLOWED_CSI = /^\x1b\[[0-9;:]*[ABCDXm]$/;

/**
 * 許可リストで安全化する（decisions D4）。残すのは印字できる文字・CR・LF・TAB と `CSI [0-9;:]* [ABCDXm]` だけ。
 * それ以外の `ESC` で始まる並び（問い合わせ・モード・OSC・DCS 等）は並びごと落とし、他の C0・DEL・C1 は 1 文字ずつ落とす。
 * ミラーは問い合わせに答えて新しいシェルへ書き込むので（research F4）、保存ファイルが書き換えられていても入力に化けさせない。冪等。
 */
export function sanitizeHistoryAnsi(s: string): string {
  let out = "";
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === ESC) {
      const end = escapeSequenceEnd(s, i);
      const seq = s.slice(i, end);
      if (ALLOWED_CSI.test(seq)) out += seq;
      i = end;
      continue;
    }
    if (
      c === 0x0a ||
      c === 0x0d ||
      c === 0x09 ||
      (c >= 0x20 && c !== 0x7f && !(c >= 0x80 && c <= 0x9f))
    ) {
      out += s[i];
    }
    i++;
  }
  return out;
}

/** `s[start]` の `ESC` から始まる並びの終わり（次の文字の位置）。途中で終わっていれば文字列の末尾。 */
function escapeSequenceEnd(s: string, start: number): number {
  const n = s.length;
  let i = start + 1;
  if (i >= n) return n;
  const kind = s[i]!;
  if (kind === "[") {
    i++;
    while (i < n && isInRange(s.charCodeAt(i), 0x30, 0x3f)) i++; // 引数
    while (i < n && isInRange(s.charCodeAt(i), 0x20, 0x2f)) i++; // 中間
    if (i < n && isInRange(s.charCodeAt(i), 0x40, 0x7e)) return i + 1; // 終端
    return i; // 終端の無い（壊れた）CSI はそこまでを捨てる
  }
  if (kind === "]" || kind === "P" || kind === "_" || kind === "^" || kind === "X") {
    // 文字列型（OSC・DCS・APC・PM・SOS）：BEL か ST（ESC \）まで。無ければ末尾まで。
    i++;
    while (i < n) {
      const c = s.charCodeAt(i);
      if (c === BEL) return i + 1;
      if (c === ESC) return i + 1 < n && s[i + 1] === "\\" ? i + 2 : i;
      i++;
    }
    return n;
  }
  // その他（`ESC c`〔RIS〕・`ESC ( B` 等）：中間文字と終端の 1 文字。
  while (i < n && isInRange(s.charCodeAt(i), 0x20, 0x2f)) i++;
  if (i < n && isInRange(s.charCodeAt(i), 0x30, 0x7e)) return i + 1;
  return i;
}

function isInRange(c: number, lo: number, hi: number): boolean {
  return c >= lo && c <= hi;
}

/**
 * UTF-8 で `maxBytes` を超えたら、古い側（先頭）を捨てて行の境目（`\r\n` の後ろ）から残す（decisions D5）。
 * 超えていなければそのまま。境目が見つからなければ空。
 */
export function truncateHistoryAnsi(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.byteLength <= maxBytes) return s;
  const cut = buf.byteLength - maxBytes;
  // 切り口がちょうど行の頭（直前が CRLF）なら、そこから残す（1 行余計に捨てない。T1 の独立点検）。
  if (buf[cut - 2] === 0x0d && buf[cut - 1] === 0x0a) return buf.subarray(cut).toString("utf8");
  const tail = buf.subarray(cut).toString("utf8"); // 先頭が文字の途中なら置換文字になるが、次の行の境目で捨てる
  const nl = tail.indexOf("\r\n");
  return nl < 0 ? "" : tail.slice(nl + 2);
}

/**
 * 流す内容：保存した画面（安全化済み）の後ろに「前回のセッションの画面」の区切りの行（薄い色）。空なら ""（区切りも出さない。AC12）。
 * 時刻は保存した時刻をこのサーバのローカル時刻で `YYYY-MM-DD HH:MM`。読めなければ時刻を省く（decisions D3）。
 */
export function historyReplayText(ansi: string, savedAt: string): string {
  if (ansi === "") return "";
  const when = formatLocalMinute(savedAt);
  const label =
    when === null
      ? "--- 前回のセッションの画面 ---"
      : `--- 前回のセッションの画面（${when} に保存）---`;
  return `${ansi}\x1b[0m\r\n\x1b[2m${label}\x1b[0m\r\n`;
}

function formatLocalMinute(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (v: number): string => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
