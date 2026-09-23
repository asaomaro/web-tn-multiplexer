import { describe, expect, it } from "vitest";
import { stripAnsi } from "./ansiStrip.js";

const ESC = "\u001B";
const BEL = "\u0007";

describe("stripAnsi", () => {
  it("プレーンテキストはそのまま", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("空文字列はそのまま", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("SGR の色指定（CSI）を除去する", () => {
    expect(stripAnsi(`${ESC}[31mred${ESC}[0m`)).toBe("red");
  });

  it("複数パラメータの SGR（256色指定）を除去する", () => {
    expect(stripAnsi(`${ESC}[38;5;196mtext${ESC}[m`)).toBe("text");
  });

  it("カーソル移動・画面クリアの CSI を除去する", () => {
    expect(stripAnsi(`${ESC}[2J${ESC}[H${ESC}[1;1Hvisible`)).toBe("visible");
  });

  it("OSC（BEL 終端）でタイトル設定を除去する", () => {
    expect(stripAnsi(`${ESC}]0;my title${BEL}rest`)).toBe("rest");
  });

  it("OSC（ST=ESC\\\\ 終端）でタイトル設定を除去する", () => {
    expect(stripAnsi(`${ESC}]0;my title${ESC}\\rest`)).toBe("rest");
  });

  it("CSI と OSC が混在していても両方除去する", () => {
    expect(stripAnsi(`${ESC}]0;title${BEL}${ESC}[1mbold${ESC}[0m plain`)).toBe("bold plain");
  });

  it("連続するエスケープシーケンスをすべて除去する", () => {
    expect(stripAnsi(`${ESC}[1m${ESC}[31m${ESC}[4mstyled${ESC}[0m`)).toBe("styled");
  });

  describe("未終端・不完全なシーケンス（変異的なケース。例外を投げずそのまま残す）", () => {
    it("BEL/ST の来ない OSC はそのまま残る", () => {
      const input = `${ESC}]0;incomplete-no-terminator`;
      expect(() => stripAnsi(input)).not.toThrow();
      expect(stripAnsi(input)).toBe(input);
    });

    it("終端バイトの無い CSI（文字列がそこで切れている）はそのまま残る", () => {
      const input = `text${ESC}[31`;
      expect(() => stripAnsi(input)).not.toThrow();
      expect(stripAnsi(input)).toBe(input);
    });

    it("`ESC[` だけ（終端バイト無し）はそのまま残る", () => {
      const input = `${ESC}[`;
      expect(() => stripAnsi(input)).not.toThrow();
      expect(stripAnsi(input)).toBe(input);
    });

    it("素の ESC 単体（CSI でも OSC でもない）はそのまま残る", () => {
      const input = `a${ESC}b`;
      expect(() => stripAnsi(input)).not.toThrow();
      expect(stripAnsi(input)).toBe(input);
    });

    it("完全な OSC の直後に未終端の OSC が続く場合、完全な方だけ除去する", () => {
      const input = `${ESC}]0;done${BEL}kept${ESC}]0;unterminated`;
      expect(stripAnsi(input)).toBe(`kept${ESC}]0;unterminated`);
    });
  });

  it("エスケープしか無い文字列は空になる", () => {
    expect(stripAnsi(`${ESC}[31m${ESC}[0m`)).toBe("");
  });
});
