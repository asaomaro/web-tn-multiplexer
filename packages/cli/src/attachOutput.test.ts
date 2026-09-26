import { describe, expect, it } from "vitest";
import { TerminalQueryFilter } from "./attachOutput.js";

const E = "\x1b";
const filter = (s: string): string => new TerminalQueryFilter().filter(s);

describe("TerminalQueryFilter（出力から端末への問い合わせを取り除く。20260926-pane-direct-connect D8）", () => {
  it.each([
    ["DA1", `${E}[c`],
    ["DA1（0）", `${E}[0c`],
    ["DA2", `${E}[>c`],
    ["DA3", `${E}[=c`],
    ["DSR", `${E}[5n`],
    ["CPR", `${E}[6n`],
    ["DECXCPR", `${E}[?6n`],
    ["明暗の問い合わせ", `${E}[?996n`],
    ["DECRQM", `${E}[?2004$p`],
    ["DECRQM（ANSI）", `${E}[4$p`],
    ["XTVERSION", `${E}[>q`],
    ["kitty keyboard のフラグ", `${E}[?u`],
    ["窓の大きさの報告", `${E}[14t`],
    ["文字の大きさの報告", `${E}[16;0t`],
    ["DECID", `${E}Z`],
    ["DECRQSS", `${E}P$qm${E}\\`],
    ["XTGETTCAP", `${E}P+q544e${E}\\`],
    ["前景色（BEL）", `${E}]10;?\x07`],
    ["背景色（ST）", `${E}]11;?${E}\\`],
    ["カーソル色", `${E}]12;?\x07`],
    ["パレット", `${E}]4;1;?\x07`],
    ["パレット（2 組目）", `${E}]4;1;#ff0000;2;?\x07`],
    ["クリップボードの読み出し", `${E}]52;c;?\x07`],
    ["XTQMODKEYS", `${E}[?4m`],
    ["XTSMGRAPHICS の読み出し", `${E}[?1;1;0S`],
    ["DECRQPSR", `${E}[1$w`],
    ["ENQ", "\x05"],
  ])("%s を取り除き、前後の文字は残す", (_name, seq) => {
    expect(filter(`a${seq}b`)).toBe("ab");
  });

  it.each([
    ["SGR", `${E}[1;31m`],
    ["カーソルの移動", `${E}[10;5H`],
    ["代替画面", `${E}[?1049h`],
    ["bracketed paste", `${E}[?2004h`],
    ["kitty keyboard の push", `${E}[>1u`],
    ["窓のタイトルの退避", `${E}[22;0t`],
    ["タイトル", `${E}]0;title\x07`],
    ["前景色の設定", `${E}]10;#ffffff\x07`],
    ["パレットの設定", `${E}]4;1;#ff0000\x07`],
    ["クリップボードへの書き込み", `${E}]52;c;aGk=\x07`],
    ["ハイパーリンク", `${E}]8;;https://example.com${E}\\x${E}]8;;${E}\\`],
    ["文字集合", `${E}(B`],
    ["キーパッド", `${E}>`],
    ["その他の DCS", `${E}Pqsixel${E}\\`],
    ["XTMODKEYS の無効化（CSI > Pp n）", `${E}[>4n`],
    ["DECCARA（CSI … $ t）", `${E}[14;1;20;80;1$t`],
    ["XTSMGRAPHICS の設定", `${E}[?1;3;256S`],
    ["中間文字つきの CSI（CSI 14 SP t）", `${E}[14 t`],
  ])("%s は残す", (_name, seq) => {
    expect(filter(`a${seq}b`)).toBe(`a${seq}b`);
  });

  it("出力の区切りをまたぐ列は次の出力まで持ち越して判定する", () => {
    const f = new TerminalQueryFilter();
    expect(f.filter(`x${E}`)).toBe("x");
    expect(f.filter("[6")).toBe("");
    expect(f.filter("ny")).toBe("y");
    expect(f.filter(`${E}]11;`)).toBe("");
    expect(f.filter(`?${E}`)).toBe("");
    expect(f.filter("\\z")).toBe("z");
    expect(f.filter(`${E}[3`)).toBe("");
    expect(f.filter("1mw")).toBe(`${E}[31mw`);
  });

  it("文字列の列の中で \\ 以外が続く ESC は文字列を打ち切り、続く問い合わせも取り除く", () => {
    const f = new TerminalQueryFilter();
    expect(f.filter(`a${E}]0;t${E}[6n text`)).toBe(`a${E}]0;t text`);
    expect(f.filter("more\x07z")).toBe("more\x07z");
  });

  it("reset で持ち越しを捨てる（描き直しの前の書きかけの列に続きを取り込ませない）", () => {
    const f = new TerminalQueryFilter();
    expect(f.filter(`a${E}]0;ti`)).toBe("a");
    f.reset();
    expect(f.filter(`${E}[H${E}[2Jscreen`)).toBe(`${E}[H${E}[2Jscreen`);
  });

  it("閉じない列を溜め続けない（上限を超えたらそのまま書く）", () => {
    const f = new TerminalQueryFilter();
    const long = `${E}]0;` + "t".repeat(70 * 1024);
    expect(f.filter(long)).toBe(long);
    expect(f.filter("after")).toBe("after");
  });

  it("壊れた CSI は問い合わせではないものとしてそのまま書く", () => {
    expect(filter(`a${E}[1\nb`)).toBe(`a${E}[1\nb`);
  });
});
