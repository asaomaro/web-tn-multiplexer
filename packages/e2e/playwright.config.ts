import { defineConfig, devices } from "@playwright/test";

/**
 * E2E の設定（05-e2e-docs T1）。各 spec が `support/fixtures.ts` の fixture（`support/appServer.ts`）で自分専用のサーバ（空きポート・
 * 一時 state dir）を起動するため、`baseURL`/`webServer` は使わない（1 つの固定サーバを外側で立てる方式は
 * AC9（複数クライアント）以外のテストで無駄に状態を共有してしまう）。
 *
 * **spec は 1 つずつ走らせる（`workers: 1`。05-e2e-docs T13・decisions.md D104）**。どの spec も実物のサーバ（PTY・シェル）と
 * Chromium（GPU の無い環境ではソフトウェアの GL で描く）を 1 組ずつ動かすので、並列にすると CPU を取り合い、キー入力・描画・
 * エージェントの判定の周期が遅れて時間切れで落ちる（以前の `fullyParallel: true`＋既定のワーカー数では、12 CPU の検証環境で
 * 6 ワーカーになり、大量出力（`yes`）を流す性能計測の spec を除いても毎回 3〜8 件落ちた）。1 つずつなら性能計測
 * （`performance.spec.ts`）も他の spec と重ならず、計測値に他の spec の負荷が混ざらない。`--workers` で増やすと、どちらも
 * 崩れる（計測値は他の spec の負荷を含んだものになる）。
 */
export default defineConfig({
  testDir: "./src/specs",
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
});
