import type { BrowserContext, Page } from "@playwright/test";

/** clipboard 権限を付与する（M4・`Ctrl+Shift+V`・copy モードの yank の検証で共通して使う。
 *  05-e2e-docs T4 で初出、T6 でも使うため共有ヘルパーへ移した。2 つの spec に同じ 3 行が
 *  重複していたのを review で発見・整理）。 */
export async function grantClipboard(context: BrowserContext, origin: string): Promise<void> {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
}

/** `Ctrl+B` の直後に 1 キー送る（design「キー操作」の prefix。すべての spec で使う共通操作）。 */
export async function prefixKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+b");
  await page.keyboard.press(key);
}

/** 端末（xterm.js）へフォーカスし、キーボードでの入力を受けられる状態にする。 */
export async function focusTerminal(page: Page): Promise<void> {
  await page.locator(".xterm-helper-textarea").first().click();
}

/** 端末へ 1 行入力して Enter を押す（`keyboard.type` の埋め込み `\n` は Enter として確実には届かない。smoke.ts 参照）。 */
export async function typeLine(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}
