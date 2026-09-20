import { test as base } from "@playwright/test";
import { startAppServer, type AppServer } from "./appServer.js";

/** `appServer` を追加した Playwright Test の `test`（05-e2e-docs T1）。全 spec はこれを import して使う。 */
export const test = base.extend<{ appServer: AppServer }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright は第 1 引数が分割代入パターンであることを要求する。
  appServer: async ({}, use) => {
    const server = await startAppServer();
    await use(server);
    await server.close();
  },
});

export { expect } from "@playwright/test";
