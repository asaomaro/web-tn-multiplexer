#!/usr/bin/env node
/**
 * 起動確認（design「起動確認」・T22・T26）。空きポート・一時ディレクトリでサーバを起動し、
 * 正規のログイン → client.hello → workspace.create → pane.subscribe → 入力の往復（実物のシェルで echo）
 * を確かめ、続けてビルドした Web UI を Playwright の実物の Chromium で開いて一巡（token での自動ログイン →
 * 接続 → 既存 pane の表示 → キー入力）を確かめてから終了する（テスト方針「実地の確認」）。
 * 「ビルドした成果物が最初の使える状態に到達したか」を見るためのもので、ユニットテストの代わりにはしない。
 *
 * Web UI の確認には `playwright`（`packages/server/package.json` の devDependency）を使う。
 * ブラウザ本体は `playwright install chromium` で別途取得する必要がある（`node_modules` には同梱されない）。
 */
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdtemp } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { decodeFrame, encodeInputFrame, FRAME_TYPE } from "@wtm/protocol";
import { chromium } from "playwright";
import WebSocket from "ws";
import { composeServer } from "./composeServer.js";

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
    probe.on("error", reject);
  });
}

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

/**
 * 生の WebSocket クライアント（`net/Connection.ts` と同じ形：**1 つの持続的な `message` ハンドラ**が
 * 応答を id で振り分け、pane の OUTPUT は pane ごとにずっと溜め続ける）。
 *
 * 前の実装は `ws.once("message", ...)` を都度張り直す方式だった（`request` を打つたび・`waitForOutput` の
 * ループの各周回ごとに）——**何も待っていない間に届いた message を取りこぼす**バグがあった。
 * Web UI の確認（T26）でブラウザの起動・操作に数秒かかるようになり、その間は誰も `message` を
 * listen していなかったため、ブラウザが打った入力の echo がまさにその隙間で届いて消えていた
 * （実機の Chromium を使う smoke で発見。「echo 済みのはずなのに `waitForOutput` が毎回タイムアウトする」
 * という形で症状が出た——`ws.on` で全メッセージを可視化して初めて、届いてはいるが誰も見ていないと分かった）。
 */
function createSmokeClient(ws: WebSocket) {
  const pending = new Map<string, PendingRequest>();
  const paneOutput = new Map<string, string>();

  ws.on("message", (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      const decoded = decodeFrame(new Uint8Array(data));
      if (decoded.type === FRAME_TYPE.OUTPUT) {
        paneOutput.set(decoded.paneId, (paneOutput.get(decoded.paneId) ?? "") + new TextDecoder().decode(decoded.chunk));
      }
      return;
    }
    const msg = JSON.parse(data.toString("utf8")) as { id?: string; result?: unknown; error?: unknown };
    if (!msg.id) return; // id の無いもの（イベント）は今のところ読み捨てる
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(`request ${msg.id} failed: ${JSON.stringify(msg.error)}`));
    else req.resolve(msg.result);
  });

  function requestResponse(id: string, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timed out waiting for response to ${method} (id=${id})`));
      }, 10_000);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** 既に溜まっている分を含めて、そのうち `needle` が現れるまで待つ（ポーリング。取りこぼしが起きない）。 */
  async function waitForOutput(paneId: string, needle: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if ((paneOutput.get(paneId) ?? "").includes(needle)) return;
      if (Date.now() >= deadline) {
        throw new Error(`timed out waiting for "${needle}" in pane ${paneId} output; got: ${JSON.stringify((paneOutput.get(paneId) ?? "").slice(-500))}`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return { requestResponse, waitForOutput };
}

/**
 * ビルドした Web UI を実物の Chromium で開いて一巡を確かめる（T26）。`#token=` での自動ログイン
 * （`LoginView.vue`）→ 接続 → 直前に作った pane（`paneId`）が表示されるまで待つ → その pane にキー入力する。
 * 実際に PTY まで届いたかどうかは、DOM から canvas 描画の文字を読み取るのではなく（xterm.js は既定で
 * DOM に文字を残さない——アクセシビリティツリーも `screenReaderMode` が既定 off なので存在しない。
 * 実機の Chromium で確認済み）、**呼び出し側が既に持っている生 WebSocket 接続の OUTPUT** で確かめる
 * （`waitForOutput` を呼ぶのは呼び出し側）。ここでは「ブラウザがログイン・接続・pane の表示・タブの
 * タイトル（H14）まで到達したか」だけを見る。
 */
async function checkWebUiRendersAndAcceptsInput(origin: string, token: string, paneId: string, marker: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/#token=${token}`);
    // ログイン画面が一瞬でも出ていたら、自動ログインより先に来てしまっている（#token 検出の失敗）。
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 15_000 });
    if (await page.locator(".login-view").count()) throw new Error("still showing LoginView after #token auto-login");
    console.log("smoke(web): auto-login (#token) → connect → pane 表示 ok");

    // 端末の描画用 canvas が `.xterm-screen` の枠の中に重なっていること（xterm.css が効いていること）。
    // 効いていないと canvas が通常のフローで縦に積まれ、文字を描いた canvas が画面外へ押し出される——
    // バイト列の往復だけを見る確認では気づけなかった（D96）。
    const layout = await page.evaluate(() => {
      const screen = document.querySelector(".xterm-screen")?.getBoundingClientRect();
      const canvases = Array.from(document.querySelectorAll(".xterm-screen canvas")).map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      const helper = document.querySelector(".xterm-helper-textarea");
      return {
        screen: screen ? { top: screen.top, bottom: screen.bottom } : null,
        canvasTops: canvases.map((r) => r.top),
        canvasBottoms: canvases.map((r) => r.bottom),
        helperOpacity: helper ? getComputedStyle(helper).opacity : null,
      };
    });
    if (!layout.screen || layout.canvasTops.length === 0) throw new Error(`terminal has no visible canvas: ${JSON.stringify(layout)}`);
    const outside = layout.canvasTops.some((t, i) => t < layout.screen!.top - 1 || layout.canvasBottoms[i]! > layout.screen!.bottom + 1);
    if (outside) throw new Error(`terminal canvas is outside .xterm-screen (xterm.css missing?): ${JSON.stringify(layout)}`);
    if (layout.helperOpacity !== "0") throw new Error(`xterm helper textarea is visible (xterm.css missing?): ${JSON.stringify(layout)}`);
    console.log("smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）");

    const expectedTitle = `${hostname()}: smoke`;
    await page.waitForFunction((t) => document.title === t, expectedTitle, { timeout: 5000 });
    console.log(`smoke(web): tab title ok ("${expectedTitle}"。H14/AC4）`);

    await page.locator(".xterm-helper-textarea").click();
    // `keyboard.type()` の埋め込み `\n` は Enter キー押下として確実には届かない（実機の Chromium で確認済み
    // ——タイプはされてもコマンドが実行されず、シェルの出力が一切戻ってこなかった）。改行は別に明示的に送る。
    await page.keyboard.type(`echo ${marker}`);
    await page.keyboard.press("Enter");
    console.log(`smoke(web): typed into pane ${paneId}`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const stateDir = await mkdtemp(join(tmpdir(), "wtm-smoke-"));
  const port = await getFreePort();
  console.log(`smoke: starting server on 127.0.0.1:${port} (state dir ${stateDir})`);

  const server = await composeServer({ host: "127.0.0.1", port: String(port), stateDir, origin: [] });
  await server.listen();

  let ws: WebSocket | undefined;
  try {
    const manifestSummaries = server.manifestStore.summaries();
    const failed = manifestSummaries.filter((s) => !s.ok);
    if (manifestSummaries.length === 0) throw new Error("agent manifests: no entries loaded (index.toml missing or empty?)");
    if (failed.length > 0) throw new Error(`agent manifests: ${failed.length}/${manifestSummaries.length} failed to load: ${JSON.stringify(failed)}`);
    console.log(`smoke: agent manifests ok (${manifestSummaries.length}/${manifestSummaries.length})`);

    // token は `listen()` が待ち受けに成功してから作られる（それまでは undefined。D102）。
    const token = server.freshToken;
    if (!token) throw new Error("expected a freshly generated token");

    const origin = `http://127.0.0.1:${port}`;
    const loginRes = await fetch(`${origin}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, host: `127.0.0.1:${port}` },
      body: JSON.stringify({ token }),
    });
    if (loginRes.status !== 204) throw new Error(`login failed: HTTP ${loginRes.status}`);
    const setCookie = loginRes.headers.get("set-cookie");
    if (!setCookie) throw new Error("login did not set a cookie");
    const cookie = setCookie.split(";")[0]!;
    console.log("smoke: login ok");

    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie, origin, host: `127.0.0.1:${port}` } });
    await new Promise<void>((resolve, reject) => {
      ws!.once("open", () => resolve());
      ws!.once("error", reject);
    });
    console.log("smoke: websocket connected");

    const client = createSmokeClient(ws);

    await client.requestResponse("1", "client.hello", { protocol: 1, kind: "desktop" });
    console.log("smoke: client.hello ok");

    const created = (await client.requestResponse("2", "workspace.create", { cwd: process.cwd(), label: "smoke" })) as {
      pane: { id: string };
    };
    console.log(`smoke: workspace.create ok (pane ${created.pane.id})`);

    await client.requestResponse("3", "pane.subscribe", { paneId: created.pane.id, scrollbackLines: 200 });
    console.log("smoke: pane.subscribe ok");

    const marker = `wtm-smoke-${Date.now()}`;
    ws.send(encodeInputFrame(created.pane.id, new TextEncoder().encode(`echo ${marker}\n`)));
    await client.waitForOutput(created.pane.id, marker, 8000);
    console.log("smoke: echo round trip ok");

    // ここまでは生の WebSocket 接続だけの確認（プロトコル層）。ここから先は、ビルドした Web UI を
    // 実物のブラウザで開いて確かめる（T26。design「起動確認」に「配信の確認」を追加）。
    // 対象は同じ pane（`created.pane.id`）——`client.hello` の snapshot の focus が最後に作った workspace
    // （この smoke 自身が作った「smoke」workspace）を指すので、ブラウザは自動でこの pane を表示する。
    const webMarker = `wtm-smoke-web-${Date.now()}`;
    await checkWebUiRendersAndAcceptsInput(origin, token, created.pane.id, webMarker);
    await client.waitForOutput(created.pane.id, webMarker, 8000);
    console.log("smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）");

    console.log("smoke: PASS");
    process.exitCode = 0;
  } finally {
    ws?.close();
    await server.close();
  }
}

main().catch((err: unknown) => {
  console.error("smoke: FAIL", err);
  process.exitCode = 1;
});
