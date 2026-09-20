/**
 * `navigator.clipboard` への書き込み（architecture.md「term/clipboard」）。M4（選択終了時のコピー）と
 * copy モードの yank（T18）で共用する。失敗の知らせ（トースト）は呼び出し側（`UiPort` を持つ側）が出す
 * ——この部品は Vue にも UI にも依存しない（規則 4）。
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** メニューの「貼り付け」（design「マウス操作」）。Chromium は許可を求めることがある（research.md F10.10）。 */
export async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
