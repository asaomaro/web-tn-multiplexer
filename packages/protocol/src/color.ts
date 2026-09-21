/**
 * 色の計算（20260921-theme-settings）。WCAG 2.x の相対輝度とコントラスト比、混色、足りない色を寄せる処理。
 * **画面の枠の色の組み立て（web の `theme/uiTokens.ts`）と端末の配色の規則（`theme.ts` の `finalizePalette`）の両方がここを使う**
 * （規則を 1 か所に置く。design D2・D3）。色は `#rrggbb` だけを扱う。
 */

function channels(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) throw new Error(`色は #rrggbb で渡す: ${hex}`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

/** WCAG 2.x の相対輝度（0〜1）。 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x のコントラスト比（1〜21）。 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * a を t、b を 1-t の割合で混ぜる（t=1 で a、0 で b。t は 0〜1）。各成分は四捨五入——浮動小数の誤差でちょうど .5 が .4999… になって
 * 下がらないよう、1e-9 を足してから丸める（成分は t の小数の桁数ぶんの精度しか持たないので、本当の .4999… を持ち上げることは無い）。
 */
export function mixHex(a: string, b: string, t: number): string {
  if (!(t >= 0 && t <= 1)) throw new Error(`混ぜる割合は 0〜1: ${t}`);
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca
    .map((x, i) =>
      Math.round(x * t + cb[i]! * (1 - t) + 1e-9)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * color を toward へ 0〜100% の 1% 刻みで混ぜ、**全ての相手 a について** `contrastRatio(mixHex(候補, a, alpha), a) >= ratio` になる最初の色を返す
 * （足りていればそのまま。返す色は小文字の #rrggbb）。`alpha` は候補を相手の上に重ねる不透明度——薄めて描く文字（`opacity`）の検査に
 * 使う。届かなければ toward。
 */
export function ensureContrast(
  color: string,
  against: readonly string[],
  ratio: number,
  toward: "#000000" | "#ffffff",
  alpha = 1,
): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = mixHex(toward, color, step / 100);
    if (against.every((a) => contrastRatio(mixHex(candidate, a, alpha), a) >= ratio))
      return candidate;
  }
  return toward;
}
