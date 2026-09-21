import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast, mixHex, relativeLuminance } from "./color.js";

describe("relativeLuminance / contrastRatio", () => {
  it("白と黒の比は 21、同じ色は 1", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 10);
    expect(contrastRatio("#282a36", "#282a36")).toBe(1);
  });

  it("順序に依らない（明るいほうを分子にする）", () => {
    expect(contrastRatio("#f8f8f2", "#282a36")).toBeCloseTo(
      contrastRatio("#282a36", "#f8f8f2"),
      12,
    );
  });

  it("既知の値：design「依拠する既存の事実」の dracula の 2 つ（4.41・4.27）", () => {
    // #f8f8f2 on #6272a4 は 4.41（WCAG 1.4.3 の 4.5 を割る）。
    expect(contrastRatio("#f8f8f2", "#6272a4")).toBeCloseTo(4.41, 2);
    // #f8f8f2 を 0.6 に薄めて #44475a に重ねると 4.27。
    expect(contrastRatio(mixHex("#f8f8f2", "#44475a", 0.6), "#44475a")).toBeCloseTo(4.27, 2);
    expect(contrastRatio("#f8f8f2", "#282a36")).toBeCloseTo(13.36, 2);
  });

  it("暗い成分は WCAG の式の直線の部分（s <= 0.03928 なら s / 12.92）を通る", () => {
    expect(relativeLuminance("#0a0a0a")).toBeCloseTo(10 / 255 / 12.92, 8);
  });

  it("大文字の 16 進も読む。#rrggbb でなければ投げる", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(() => relativeLuminance("#fff")).toThrow();
    expect(() => relativeLuminance("rgba(0,0,0,0.4)")).toThrow();
  });
});

describe("mixHex", () => {
  it("t=1 で a、t=0 で b", () => {
    expect(mixHex("#ff0000", "#0000ff", 1)).toBe("#ff0000");
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#0000ff");
  });

  it("各成分を四捨五入する（design のインターフェース）", () => {
    // 0xff * 0.5 = 127.5 → 128（切り捨てなら 127）。
    expect(mixHex("#ff0000", "#000000", 0.5)).toBe("#800000");
    // 0x62*0.98 = 96.04 → 96(0x60)、0x72*0.98 = 111.72 → 112(0x70)、0xa4*0.98 = 160.72 → 161(0xa1)。
    expect(mixHex("#000000", "#6272a4", 0.02)).toBe("#6070a1");
    // 250 * 0.93 = 232.5 は浮動小数では 232.49999999999997 になる。それでも四捨五入で 233（0xe9）。
    expect(mixHex("#000000", "#fafafa", 0.07)).toBe("#e9e9e9");
  });

  it("割合が 0〜1 の外・NaN なら投げる（#rrggbb でない文字列を返さない）", () => {
    expect(() => mixHex("#ffffff", "#000000", 1.5)).toThrow();
    expect(() => mixHex("#ffffff", "#000000", -0.1)).toThrow();
    expect(() => mixHex("#ffffff", "#000000", Number.NaN)).toThrow();
  });
});

describe("ensureContrast", () => {
  it("足りていればそのまま返す", () => {
    expect(ensureContrast("#f8f8f2", ["#282a36"], 4.5, "#ffffff")).toBe("#f8f8f2");
  });

  it("足りなければ toward へ 1% ずつ寄せ、最初に足りた色を返す（decisions D1 の #6070a1）", () => {
    const got = ensureContrast("#6272a4", ["#f8f8f2"], 4.5, "#000000");
    expect(got).toBe("#6070a1");
    expect(contrastRatio("#f8f8f2", got)).toBeGreaterThanOrEqual(4.5);
    // 1 つ手前（1%）では足りない＝最初に足りた色であること。
    expect(contrastRatio("#f8f8f2", mixHex("#000000", "#6272a4", 0.01))).toBeLessThan(4.5);
  });

  it("全ての相手に対して足りる最初の色を 1% 刻みで選ぶ（いちばん厳しい相手で決まる。相手の順に依らない）", () => {
    // #ff5555 を白へ 41% 寄せた #ff9b9b で初めて #44475a に 4.5 を越える（2% 刻みなら #ff9c9c になる）。
    expect(ensureContrast("#ff5555", ["#282a36", "#44475a"], 4.5, "#ffffff")).toBe("#ff9b9b");
    expect(ensureContrast("#ff5555", ["#44475a", "#282a36"], 4.5, "#ffffff")).toBe("#ff9b9b");
    // 1 つ手前（40%）では #44475a に足りない。
    expect(contrastRatio(mixHex("#ffffff", "#ff5555", 0.4), "#44475a")).toBeLessThan(4.5);
    expect(contrastRatio("#ff9b9b", "#282a36")).toBeGreaterThanOrEqual(4.5);
  });

  it("大文字で渡しても小文字の #rrggbb で返す", () => {
    expect(ensureContrast("#F8F8F2", ["#282a36"], 4.5, "#ffffff")).toBe("#f8f8f2");
  });

  it("alpha を与えると、相手の上に薄めて重ねた色で比べる（薄めて描く文字の検査）", () => {
    // #c0c0c0 は #44475a に不透明なら 5.03 で足りるが、0.7 に薄めると足りない。薄めても 4.5 に届くまで白へ寄せる。
    expect(ensureContrast("#c0c0c0", ["#44475a"], 4.5, "#ffffff")).toBe("#c0c0c0");
    const got = ensureContrast("#c0c0c0", ["#44475a"], 4.5, "#ffffff", 0.7);
    expect(got).toBe("#e5e5e5");
    expect(contrastRatio(mixHex(got, "#44475a", 0.7), "#44475a")).toBeGreaterThanOrEqual(4.5);
  });

  it("届かなければ toward を返す", () => {
    expect(ensureContrast("#777777", ["#ffffff", "#000000"], 21, "#000000")).toBe("#000000");
  });
});
