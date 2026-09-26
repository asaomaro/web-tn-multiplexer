import { describe, expect, it } from "vitest";
import { historyReplayText, sanitizeHistoryAnsi, truncateHistoryAnsi } from "./historyAnsi.js";

describe("sanitizeHistoryAnsi（流す前の安全化。20260926-screen-history-replay の AC8・decisions D4）", () => {
  it("直列化の出力に現れるもの（文字・CRLF・TAB・SGR・カーソルの移動と消去）はそのまま残す", () => {
    const s =
      "\x1b[31mred\x1b[0m 日本語\r\n\x1b[38;2;1;2;3mtrue\x1b[48:5:17m\x1b[5X\x1b[3C\x1b[1D\x1b[A\x1b[B\ttab\r\n";
    expect(sanitizeHistoryAnsi(s)).toBe(s);
  });

  it.each([
    ["DA1", "\x1b[c"],
    ["DA2", "\x1b[>c"],
    ["CPR", "\x1b[6n"],
    ["DECRQM", "\x1b[?25$p"],
    ["明暗の問い合わせ", "\x1b[?996n"],
    ["代替画面", "\x1b[?1049h"],
    ["bracketed paste", "\x1b[?2004h"],
    ["マウス報告", "\x1b[?1000h"],
    ["カーソルの位置指定", "\x1b[5;5H"],
    ["画面の消去", "\x1b[2J"],
    ["スクロール領域", "\x1b[1;5r"],
    ["OSC（BEL 終わり）", "\x1b]11;?\x07"],
    ["OSC（ST 終わり）", "\x1b]0;title\x1b\\"],
    ["OSC 52（クリップボード）", "\x1b]52;c;aGVsbG8=\x07"],
    ["DCS", "\x1bP$qm\x1b\\"],
    ["APC", "\x1b_Gf=100;AAAA\x1b\\"],
    ["RIS", "\x1bc"],
    ["文字集合", "\x1b(0"],
    ["DECSC", "\x1b7"],
    ["C1 の CSI", "\x9b"],
    ["BEL", "\x07"],
    ["DEL", "\x7f"],
    ["REP（文字の繰り返し）", "\x1b[5b"],
  ])("%s を並びごと落とし、前後の文字は残す", (_name, seq) => {
    expect(sanitizeHistoryAnsi(`a${seq}b`)).toBe("ab");
  });

  it.each([
    ["終端の無い CSI", "\x1b[12"],
    ["終端の無い OSC", "\x1b]0;never ends"],
    ["末尾の ESC", "\x1b"],
  ])("途中で切れた %s は末尾まで落とす", (_name, seq) => {
    expect(sanitizeHistoryAnsi(`a${seq}`)).toBe("a");
  });

  it("文字列型の途中に ST でない ESC が来たら、文字列型はそこで終え、続く ESC の並びも別に判定して落とす", () => {
    expect(sanitizeHistoryAnsi("a\x1b]0;x\x1b[6nb")).toBe("ab");
    expect(sanitizeHistoryAnsi("a\x1b]0;x\x1b[31mb")).toBe("a\x1b[31mb");
  });

  it("C1 は 0x9B 以外もすべて落とし、サロゲートの対（絵文字）は残す", () => {
    expect(sanitizeHistoryAnsi("a\x80\x90\x9b\x9c\x9d\x9fb😀")).toBe("ab😀");
  });

  it("冪等", () => {
    const s = "x\x1b[c\x1b[31my\x1b]0;t\x07z\x9b6n";
    expect(sanitizeHistoryAnsi(sanitizeHistoryAnsi(s))).toBe(sanitizeHistoryAnsi(s));
  });
});

describe("truncateHistoryAnsi（pane ごとの上限。AC7・decisions D5）", () => {
  it("上限以下ならそのまま", () => {
    expect(truncateHistoryAnsi("abc\r\ndef", 100)).toBe("abc\r\ndef");
  });

  it("超えたら古い側を捨て、行の境目から残す（UTF-8 のバイト数で数える）", () => {
    const s = "一行目\r\n二行目\r\n三行目";
    const out = truncateHistoryAnsi(s, Buffer.byteLength("行目\r\n三行目", "utf8"));
    expect(out).toBe("三行目");
    expect(Buffer.byteLength(out, "utf8")).toBeLessThanOrEqual(
      Buffer.byteLength("行目\r\n三行目", "utf8"),
    );
  });

  it("切り口がちょうど行の頭なら、そこから残す（1 行余計に捨てない）", () => {
    expect(truncateHistoryAnsi("aa\r\nbb\r\ncc", 6)).toBe("bb\r\ncc");
  });

  it("境目が無ければ空", () => {
    expect(truncateHistoryAnsi("x".repeat(50), 10)).toBe("");
  });
});

describe("historyReplayText（区切りの行。AC2・AC12・decisions D3）", () => {
  it("内容の後ろに、属性を戻してから薄い色の区切りの行を足す", () => {
    const d = new Date(2026, 8, 26, 9, 5); // ローカル時刻
    expect(historyReplayText("\x1b[31mred", d.toISOString())).toBe(
      "\x1b[31mred\x1b[0m\r\n\x1b[2m--- 前回のセッションの画面（2026-09-26 09:05 に保存）---\x1b[0m\r\n",
    );
  });

  it("時刻が読めなければ時刻を省く", () => {
    expect(historyReplayText("x", "not a date")).toBe(
      "x\x1b[0m\r\n\x1b[2m--- 前回のセッションの画面 ---\x1b[0m\r\n",
    );
  });

  it("空なら区切りも出さない", () => {
    expect(historyReplayText("", "2026-09-26T00:00:00Z")).toBe("");
  });
});
