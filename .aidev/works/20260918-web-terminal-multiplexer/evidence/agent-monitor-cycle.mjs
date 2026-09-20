// AgentMonitor の「1 周期」の所要時間を、16 pane 分で実測する（02-agent-detection T9・AC17）。
// design.md「判定そのものは数ms（推測）」の裏取り。実物の PTY（16 個）と実物の /proc 走査
// （LinuxProcessInspector.foregroundJob。D48 の全 /proc スキャンのフォールバック）、実物の herdr
// マニフェスト（third_party/herdr/agent-detection）を使う。
//
// 実行: `pnpm run build`（packages/server）してから `node agent-monitor-cycle.mjs`
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDist = resolve(here, "../../../../packages/server/dist");
const serverRoot = resolve(here, "../../../../packages/server");

const { NodePtyBackend } = await import(join(serverDist, "pty/NodePtyBackend.js"));
const { LinuxProcessInspector } = await import(join(serverDist, "platform/LinuxProcessInspector.js"));
const { DefaultManifestStore } = await import(join(serverDist, "agent/ManifestStore.js"));
const { FsManifestSource } = await import(join(serverDist, "infra/FsManifestSource.js"));
const { evaluate } = await import(join(serverDist, "agent/ManifestEngine.js"));
const { MemoryLogger } = await import(join(serverDist, "log/Logger.js"));

const PANE_COUNT = 16;
const manifestDir = join(serverRoot, "../../third_party/herdr/agent-detection");

async function main() {
  console.log(`環境: ${process.platform} / node ${process.version} / システムの総プロセス数（起動時点）: ${await countProcEntries()}`);

  const logger = new MemoryLogger();
  const manifestStore = await DefaultManifestStore.load(new FsManifestSource(manifestDir), logger);
  const claudeManifest = manifestStore.get("claude");
  if (!claudeManifest) throw new Error("claude manifest が読み込めなかった");

  // 16 pane 分の実物の PTY（対話シェル）を用意する。
  const backend = new NodePtyBackend();
  const ptys = Array.from({ length: PANE_COUNT }, () =>
    backend.spawn({ shell: "/bin/bash", args: ["--norc", "--noprofile"], cwd: process.cwd(), env: process.env, cols: 80, rows: 24 }),
  );
  await sleep(300); // シェルの起動を待つ

  try {
    const inspector = new LinuxProcessInspector();
    // 判定に渡す画面（60行。AgentMonitor.DETECTION_LINES と同じ想定）。claude の working ルールに当たる内容。
    const screenLines = Array.from({ length: 59 }, (_, i) => `line ${i}`).concat(["✻ Thinking… (esc to interrupt)"]);

    const results = [];
    for (const label of ["1周目（コールドキャッシュ）", "2周目", "3周目"]) {
      const t0 = performance.now();
      // AgentMonitor.tick() と同じ形：pane ごとに並行して foregroundJob → evaluate を行う。
      await Promise.all(
        ptys.map(async (pty) => {
          const job = await inspector.foregroundJob(pty.pid);
          void job; // 対話シェルは子プロセスが無いのでシェル自身が前面（実測の対象は /proc 走査のコスト）
          const snapshot = { lines: screenLines, oscTitle: "", oscProgress: null };
          evaluate(snapshot, claudeManifest);
        }),
      );
      const elapsed = performance.now() - t0;
      results.push(elapsed);
      console.log(`${label}: ${elapsed.toFixed(2)}ms（16 pane 分・並行）`);
    }
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    console.log(`平均: ${avg.toFixed(2)}ms`);
  } finally {
    for (const pty of ptys) pty.kill();
  }
}

async function countProcEntries() {
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir("/proc");
    return entries.filter((n) => /^[0-9]+$/.test(n)).length;
  } catch {
    return -1;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

await main();
