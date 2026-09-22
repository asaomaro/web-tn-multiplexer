import type { Page } from "@playwright/test";
import type { AppServer } from "../support/appServer.js";
import { expect, test } from "../support/fixtures.js";
import { focusTerminal, prefixKey } from "../support/keys.js";

/**
 * タブバーと pane の枠の外観設定（20260922-tabbar-pane-appearance）の E2E。
 *
 * **判定はブラウザの側で行う**（条項 `.aidev/conventions/e2e-observe-browser.md`）：
 * - 位置・自動非表示・右端の表示は **DOM**（クラス・テキスト・`getComputedStyle` の bounding box）。
 * - pane の枠・外周・隙間は **`getComputedStyle` の border/outline/background 色**。
 * - 保存の永続性は `page.reload()` 後の DOM で確かめる（テスト自身の WebSocket クライアントではない）。
 */

async function openApp(page: Page, appServer: AppServer): Promise<void> {
  await page.goto(`${appServer.origin}/#token=${appServer.token}`);
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 15_000 });
}

async function openSettings(page: Page): Promise<void> {
  await focusTerminal(page);
  await prefixKey(page, "s");
  await expect(page.locator("dialog.settings-dialog")).toHaveAttribute("open", "");
}

const dialog = (page: Page) => page.locator("dialog.settings-dialog");
const displaySection = (page: Page) => dialog(page).locator('section[aria-labelledby="settings-display"]');

test("tab バーの位置を「下」に変えると、実際に画面の下側へ移る（AC1・AC10：再読み込みでも保たれる）", async ({ page, appServer }) => {
  await openApp(page, appServer);
  await openSettings(page);
  const select = displaySection(page).locator("select.settings-select").first();
  await select.selectOption("bottom");
  await page.keyboard.press("Escape");

  const tabBarBox = (await page.locator(".tab-bar").boundingBox())!;
  const panesBox = (await page.locator(".app-panes").boundingBox())!;
  expect(tabBarBox.y, "tab バーが pane 領域より下にある").toBeGreaterThan(panesBox.y);

  await page.reload();
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 15_000 });
  const tabBarBoxAfter = (await page.locator(".tab-bar").boundingBox())!;
  const panesBoxAfter = (await page.locator(".app-panes").boundingBox())!;
  expect(tabBarBoxAfter.y).toBeGreaterThan(panesBoxAfter.y);
});

test("「tab が1つなら隠す」を入にすると tab バーが消え、tab を増やすとまた出る（AC2）", async ({ page, appServer }) => {
  await openApp(page, appServer);
  await expect(page.locator(".tab-bar")).toBeVisible();
  await openSettings(page);
  const sw = displaySection(page).locator('[role="switch"]').nth(1); // [記号表示, 自動非表示, ...]
  await sw.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".tab-bar")).toBeHidden();

  await focusTerminal(page);
  await prefixKey(page, "c"); // 新規 tab（`bindings.ts` の `new_tab`。既定 prefix+c。名前入力のダイアログが開く）
  await page.locator(".name-dialog-input").press("Enter"); // 既定名のまま確定
  await expect(page.locator(".tab-bar")).toBeVisible();
});

test("右端に固定文字列エントリを追加し区切り文字を変えると、実際にその文字列が出る（AC3・AC4）", async ({ page, appServer }) => {
  await openApp(page, appServer);
  await openSettings(page);
  const fs = dialog(page).locator(".tabbar-right-fieldset");
  await fs.locator("select.settings-select").first().selectOption("text"); // 追加する種類
  await fs.locator("[data-add-entry]").click();
  const textInput = fs.locator('input[aria-label="固定文字列"]');
  await textInput.fill("hello-e2e");
  await textInput.blur();
  await fs.locator('input[aria-label="区切り文字"]').fill("|");
  await fs.locator('input[aria-label="区切り文字"]').blur();
  await page.keyboard.press("Escape");
  await expect(page.locator(".tab-bar-right")).toContainText("hello-e2e");
});

test("pane の枠：既定（自動）は単独 pane では出ず、分割すると非選択の pane にも出る。「なし」にすると分割中でも出ない（AC5・AC9）", async ({
  page,
  appServer,
}) => {
  // **選択中の pane は既存の強調（`pane-frame-edge-current`）で常に枠色を持つ**（20260921 由来。この work とは
  // 無関係）ので、判定はこの work が足した専用クラス `pane-frame-edge-bordered` の有無で行う（選択の強調と
  // 混同しない）。**単独 pane はその画面で唯一の pane なので常に選択中**——「常に」設定の効果は非選択の
  // pane（＝分割中）でしか目視できないため、「自動」と「なし」の対比を分割中の非選択 pane で確かめる
  // （3値のうち「常に」を含む網羅は単体テスト `PaneLayout.test.ts` で確認済み）。
  await openApp(page, appServer);
  const edge = page.locator(".pane-frame-edge").first();
  await expect(edge, "既定（自動）・単独 pane では bordered クラスを持たない").not.toHaveClass(/pane-frame-edge-bordered/);

  await focusTerminal(page);
  await prefixKey(page, "v"); // 縦の分割
  await expect(page.locator(".pane-frame-edge")).toHaveCount(2);
  const nonSelectedEdge = page.locator(".pane-frame-edge:not(.pane-frame-edge-current)").first();
  await expect(nonSelectedEdge, "分割中は非選択の pane にも bordered クラスが付く（自動）").toHaveClass(/pane-frame-edge-bordered/);

  await openSettings(page);
  await displaySection(page).locator("select.settings-select").nth(1).selectOption("off"); // pane の枠：なし
  await page.keyboard.press("Escape");
  await expect(nonSelectedEdge, "「なし」にすると分割中でも bordered クラスが消える").not.toHaveClass(/pane-frame-edge-bordered/);
});

test("pane 領域の外周：切ると outline が消え、入れると戻る（AC6）", async ({ page, appServer }) => {
  await openApp(page, appServer);
  const panes = page.locator(".app-panes");
  const before = await panes.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(before, "既定（入）は outline がある").not.toBe("none");

  await openSettings(page);
  const sw = displaySection(page).locator('[role="switch"]').nth(2); // [記号表示, 自動非表示, 外周, ...]
  await sw.click();
  await page.keyboard.press("Escape");
  await expect(panes).toHaveCSS("outline-style", "none");
});

test("pane 間の隙間：切ると分割線の背景が地の色になる（AC7）", async ({ page, appServer }) => {
  await openApp(page, appServer);
  await focusTerminal(page);
  await prefixKey(page, "v");
  const splitter = page.locator(".splitter");
  await expect(splitter).toHaveCount(1);
  const before = await splitter.evaluate((el) => getComputedStyle(el).backgroundColor);

  await openSettings(page);
  const sw = displaySection(page).locator('[role="switch"]').nth(3); // [記号表示, 自動非表示, 外周, 隙間, ...]
  await sw.click();
  await page.keyboard.press("Escape");
  const after = await splitter.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(after, "隙間を切ると分割線の色が変わる").not.toBe(before);
});

test("pane の枠へエージェント名表示：入にすると、手動名が付いた pane にその名前が見える（AC8）", async ({ page, appServer }) => {
  const client = await appServer.openClient();
  const p1 = client.helloSnapshot()!.panes[0]!.id;
  await client.request("pane.rename", { paneId: p1, label: "my-pane-e2e" });
  await openApp(page, appServer);
  await expect(page.locator(".pane-frame-label")).toHaveCount(0); // 既定（切）では出ない

  await openSettings(page);
  const sw = displaySection(page).locator('[role="switch"]').nth(4); // [記号表示, 自動非表示, 外周, 隙間, エージェント名表示]
  await sw.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pane-frame-label")).toHaveText("my-pane-e2e");
});
