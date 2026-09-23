#!/usr/bin/env node
/**
 * `wtmctl` の起動確認（design.md「対象範囲」T14、`aidev-50-test`「この work が新しい入口を足したなら
 * smokeCommands に1行足す」）。`packages/server/src/smoke.ts` と同じ形（実サーバを空きポートで起動し、
 * ビルド済みの成果物〔`dist/main.js`〕を**子プロセスとして実際に起動して**一巡を確かめる。exit 0=pass、
 * 例外・想定外の結果で exit 1）。
 *
 * `packages/server/src/smoke.ts` との違い：あちらは生の WebSocket 接続でプロトコル層を確かめるのに対し、
 * こちらは `node dist/main.js <args>` を子プロセスとして呼び、**利用者が実際に打つコマンドそのもの**が
 * 動くかを確かめる（CLI 引数解析・セッションキャッシュ・終了コードまで含めた「最初の使える状態」）。
 * セッションキャッシュ（既定 `~/.wtmctl/session.json`）は `HOME`（Windows は `USERPROFILE`）を差し替えて
 * 一時ディレクトリへ逃がし、実行者の実際のキャッシュに触れない。
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { composeServer } from "@wtm/server";

async function getFreePort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close((err) => (err ? rejectPromise(err) : resolvePromise(port)));
    });
    probe.on("error", rejectPromise);
  });
}

const execFileAsync = promisify(execFile);
const CLI_ENTRY = fileURLToPath(new URL("./main.js", import.meta.url));

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_ENTRY, ...args], { env, timeout: 15_000 });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: typeof e.code === "number" ? e.code : 1 };
  }
}

async function main(): Promise<void> {
  const serverStateDir = await mkdtemp(join(tmpdir(), "wtmctl-smoke-state-"));
  const homeDir = await mkdtemp(join(tmpdir(), "wtmctl-smoke-home-"));
  console.log(`smoke(cli): temp server state dir ${serverStateDir}, sandboxed HOME ${homeDir}`);

  const port = await getFreePort();
  const server = await composeServer({ host: "127.0.0.1", port: String(port), stateDir: serverStateDir, origin: [] });
  await server.listen();
  try {
    const { host } = server.options;
    if (!server.freshToken) throw new Error("expected a freshly generated token");
    const token = server.freshToken;
    const url = `http://${host}:${port}`;
    console.log(`smoke(cli): server listening on ${url}`);

    // `USERPROFILE` は Windows 版 Node の `os.homedir()` が見る変数（`HOME` だけ差し替えても Windows では効かない）。
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };

    const created = await runCli(["workspace", "create", "--cwd", process.cwd(), "--label", "smoke", "--url", url, "--token", token], env);
    if (created.exitCode !== 0) throw new Error(`workspace create failed (exit ${created.exitCode}): ${created.stderr}`);
    const { pane } = JSON.parse(created.stdout) as { pane: { id: string } };
    console.log(`smoke(cli): wtmctl workspace create ok (pane ${pane.id})`);

    // 2回目以降は --token を渡さない：セッションキャッシュが再利用されることの確認を兼ねる（AC7）。
    const marker = `wtmctl-smoke-${Date.now()}`;
    const ran = await runCli(["pane", "run", pane.id, `echo ${marker}`, "--url", url], env);
    if (ran.exitCode !== 0) throw new Error(`pane run failed (exit ${ran.exitCode}): ${ran.stderr}`);
    console.log("smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)");

    let sawMarker = false;
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline && !sawMarker) {
      const read = await runCli(["pane", "read", pane.id, "--url", url], env);
      if (read.exitCode !== 0) throw new Error(`pane read failed (exit ${read.exitCode}): ${read.stderr}`);
      if (read.stdout.includes(marker)) sawMarker = true;
      else await new Promise((r) => setTimeout(r, 200));
    }
    if (!sawMarker) throw new Error(`pane read never showed marker "${marker}"`);
    console.log("smoke(cli): wtmctl pane read ok (echo round trip confirmed)");

    const snap = await runCli(["snapshot", "--url", url], env);
    if (snap.exitCode !== 0) throw new Error(`snapshot failed (exit ${snap.exitCode}): ${snap.stderr}`);
    const snapshot = JSON.parse(snap.stdout) as { panes: { id: string }[] };
    if (!snapshot.panes.some((p) => p.id === pane.id)) throw new Error("snapshot did not include the created pane");
    console.log("smoke(cli): wtmctl snapshot ok");

    console.log("smoke(cli): PASS");
    process.exitCode = 0;
  } finally {
    await server.close();
    await rm(serverStateDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error("smoke(cli): FAIL", err);
  process.exitCode = 1;
});
