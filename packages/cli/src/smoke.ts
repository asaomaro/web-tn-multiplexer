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
import { composeServer, NodePtyBackend, type ComposedServer } from "@wtm/server";

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

/** `cond` が真になるまで待つ（100ms ごと・上限つき）。 */
async function until(cond: () => boolean, message: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** 出力の中に、印だけの行（コマンドを打った行ではなく実行された結果の行）があるか。 */
function hasOutputLine(text: string, marker: string): boolean {
  return text.split(/\r?\n/).some((l) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trim() === marker);
}

/**
 * 20260926-pane-direct-connect: ビルド済みの `wtmctl pane attach` を本物の端末（node-pty の PTY）の中で動かし、
 * 大きさが PTY の大きさに揃うこと・打鍵の往復・大きさの追従・`Ctrl+B q` で終了コード 0・pane が残ることを確かめる。
 */
async function smokeAttach(server: ComposedServer, paneId: string, url: string, env: NodeJS.ProcessEnv): Promise<void> {
  const ptyEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) ptyEnv[k] = v;
  const pty = new NodePtyBackend().spawn({
    shell: process.execPath,
    args: [CLI_ENTRY, "pane", "attach", paneId, "--url", url],
    cwd: process.cwd(),
    env: ptyEnv,
    cols: 100,
    rows: 30,
  });
  let out = "";
  pty.onData((d) => {
    out += d;
  });
  let exitCode: number | null = null;
  pty.onExit((e) => {
    exitCode = e.exitCode;
  });
  const size = (): string => {
    const p = server.session.getPane(paneId);
    return p ? `${p.cols}x${p.rows}` : "gone";
  };
  try {
    await until(() => size() === "100x30" && out.includes("\x1b[?1049h"), `pane attach did not take the terminal size (pane ${size()}): ${JSON.stringify(out.slice(-300))}`);
    const marker = `wtmctl-smoke-attach-${Date.now()}`;
    pty.write(`echo ${marker}\r`);
    await until(() => hasOutputLine(out, marker), `pane attach did not round-trip the input: ${JSON.stringify(out.slice(-300))}`);
    pty.resize(90, 25);
    await until(() => size() === "90x25", `pane attach did not follow the terminal resize (pane ${size()})`);
    pty.write("\x02q");
    await until(() => exitCode !== null, "pane attach did not exit after Ctrl+B q");
    if (exitCode !== 0) throw new Error(`pane attach exited with ${exitCode} after Ctrl+B q: ${JSON.stringify(out.slice(-300))}`);
    if (!server.session.getPane(paneId)) throw new Error("the pane was closed by detaching");
    // 切り離したら手元の端末を戻している（最後に代替画面から出る列を書いた）。
    if (out.lastIndexOf("\x1b[?1049l") < out.lastIndexOf(marker)) throw new Error(`pane attach did not leave the alternate screen: ${JSON.stringify(out.slice(-300))}`);
  } finally {
    if (exitCode === null) pty.kill();
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

    // エージェントを起動していないので空の一覧になる（`agent` コマンド群の配線とセッション再利用の確認）。
    const agents = await runCli(["agent", "list", "--url", url], env);
    if (agents.exitCode !== 0) throw new Error(`agent list failed (exit ${agents.exitCode}): ${agents.stderr}`);
    const listed = JSON.parse(agents.stdout) as { agents: unknown[] };
    if (!Array.isArray(listed.agents) || listed.agents.length !== 0) throw new Error(`agent list should be an empty agents array: ${agents.stdout}`);
    console.log("smoke(cli): wtmctl agent list ok (no agents)");

    // 20260926-agent-prompt-send-keys: ビルド済みの RPC（agent.prompt / agent.send_keys）までの配線を確かめる。
    // 検出したエージェントは居ないので状態を注入する（前面はシェルなので AgentMonitor は上書きしない）。prompt はシェルに
    // 「本文 → 300ms → Enter」で届くので、echo の往復で確定されたことを見る。
    server.session.updatePaneRuntime(pane.id, {
      agent: { instanceId: "smoke-agent", kind: "claude", label: "Claude Code", state: "idle", completionSeq: 0, serverSeenSeq: 0, verified: true, since: Date.now() },
    });
    // 20260926-agent-start-rename: agent.rename の RPC と名前による対象指定の配線（名前を付ける → 名前で引く → 外す）。
    const renamed = await runCli(["agent", "rename", pane.id, "smoke-agent", "--url", url], env);
    if (renamed.exitCode !== 0) throw new Error(`agent rename failed (exit ${renamed.exitCode}): ${renamed.stderr}`);
    const byName = await runCli(["agent", "get", "smoke-agent", "--url", url], env);
    const named = JSON.parse(byName.stdout || "{}") as { agent?: { paneId?: string; name?: string | null } };
    if (byName.exitCode !== 0 || named.agent?.paneId !== pane.id || named.agent?.name !== "smoke-agent") {
      throw new Error(`agent get by name failed (exit ${byName.exitCode}): ${byName.stdout} ${byName.stderr}`);
    }
    const cleared = await runCli(["agent", "rename", "smoke-agent", "--clear", "--url", url], env);
    const unnamed = JSON.parse(cleared.stdout || "{}") as { agent?: { name?: string | null } };
    if (cleared.exitCode !== 0 || unnamed.agent?.name !== null) throw new Error(`agent rename --clear failed (exit ${cleared.exitCode}): ${cleared.stdout} ${cleared.stderr}`);
    const gone = await runCli(["agent", "get", "smoke-agent", "--url", url], env);
    if (gone.exitCode !== 1 || !gone.stderr.includes("agent_not_found")) throw new Error(`the cleared name should not resolve (exit ${gone.exitCode}): ${gone.stderr}`);
    const byId = await runCli(["agent", "get", pane.id, "--url", url], env);
    if (byId.exitCode !== 0 || (JSON.parse(byId.stdout) as { agent: { name: string | null } }).agent.name !== null) {
      throw new Error(`agent get by pane id should show no name after --clear (exit ${byId.exitCode}): ${byId.stdout} ${byId.stderr}`);
    }
    console.log("smoke(cli): wtmctl agent rename ok (named, resolved by name, cleared)");
    const keys = await runCli(["agent", "send-keys", pane.id, "C-c", "--url", url], env);
    if (keys.exitCode !== 0) throw new Error(`agent send-keys failed (exit ${keys.exitCode}): ${keys.stderr}`);
    console.log("smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)");
    const promptMarker = `wtmctl-smoke-prompt-${Date.now()}`;
    const prompted = await runCli(["agent", "prompt", pane.id, `echo ${promptMarker}`, "--url", url], env);
    if (prompted.exitCode !== 0) throw new Error(`agent prompt failed (exit ${prompted.exitCode}): ${prompted.stderr}`);
    let sawPrompt = false;
    const promptDeadline = Date.now() + 8_000;
    while (Date.now() < promptDeadline && !sawPrompt) {
      const read = await runCli(["pane", "read", pane.id, "--url", url], env);
      if (read.exitCode !== 0) throw new Error(`pane read failed (exit ${read.exitCode}): ${read.stderr}`);
      // 入力の行（echo …）だけでなく、実行された結果の行（マーカーだけの行）が出ていること。
      if (read.stdout.split("\n").some((l) => l.trim() === promptMarker)) sawPrompt = true;
      else await new Promise((r) => setTimeout(r, 200));
    }
    if (!sawPrompt) throw new Error(`agent prompt was not submitted (marker "${promptMarker}" never printed)`);
    console.log("smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)");

    // 20260926-pane-direct-connect: 端末でなければ繋がない（execFile の stdin は端末ではない）。
    const notTty = await runCli(["pane", "attach", pane.id, "--url", url], env);
    if (notTty.exitCode !== 1 || !notTty.stderr.includes("not_a_tty")) {
      throw new Error(`pane attach without a terminal should fail with not_a_tty (exit ${notTty.exitCode}): ${notTty.stderr}`);
    }
    console.log("smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)");
    await smokeAttach(server, pane.id, url, env);
    console.log("smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)");

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
