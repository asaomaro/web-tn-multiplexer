import { access, copyFile, mkdir, readFile, rm, constants as fsConstants } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AgentIntegrationKind } from "@wtm/protocol";
import { writeFileAtomic } from "../persist/atomicFile.js";

/** 導入・解除・状態判定（20260923-agent-session-resume design「振る舞いの詳細・導入/解除」）。 */
export interface AgentIntegrationInstaller {
  status(kind: AgentIntegrationKind): Promise<{ cliDetected: boolean; installed: boolean }>;
  install(kind: AgentIntegrationKind): Promise<{ ok: boolean; message: string | null }>;
  uninstall(kind: AgentIntegrationKind): Promise<{ ok: boolean; message: string | null }>;
}

/** 本製品の hook エントリだと分かる目印。install/uninstall/status のすべてがこれで一致を見る（design D4）。 */
const HOOK_SCRIPT_NAME = "wtm-agent-report.cjs";
const MATCHER = "startup|resume";

interface KindPaths {
  /** hooks を書き込む対象ファイル（Claude Code: `settings.json`、Codex: 専用の `hooks.json`。design D7）。 */
  configFile: string;
  /** hook スクリプトのコピー先ディレクトリ。 */
  hooksDir: string;
  /** PATH 上で探す実行ファイル名（`cliDetected` は情報提供のみ。design「エラー処理」）。 */
  binName: string;
}

function pathsFor(kind: AgentIntegrationKind, env: NodeJS.ProcessEnv, home: string): KindPaths {
  if (kind === "claude") {
    const dir = env.CLAUDE_CONFIG_DIR || join(home, ".claude"); // research.md F4.5
    return { configFile: join(dir, "settings.json"), hooksDir: join(dir, "hooks"), binName: "claude" };
  }
  const dir = env.CODEX_HOME || join(home, ".codex"); // research.md F5.5
  return { configFile: join(dir, "hooks.json"), hooksDir: join(dir, "hooks"), binName: "codex" };
}

type JsonObject = Record<string, unknown>;

async function readJsonObject(path: string): Promise<{ ok: true; data: JsonObject } | { ok: false }> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (isEnoent(err)) return { ok: true, data: {} };
    return { ok: false };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false };
    return { ok: true, data: parsed as JsonObject };
  } catch {
    return { ok: false };
  }
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}

/** `hooks.SessionStart` 配列を取り出す。存在しない・形が違えば空配列（＝「本製品のエントリは無い」扱い）。 */
function sessionStartEntries(root: JsonObject): unknown[] {
  const hooks = root.hooks;
  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) return [];
  const arr = (hooks as JsonObject).SessionStart;
  return Array.isArray(arr) ? arr : [];
}

function commandsOf(entry: unknown): string[] {
  if (typeof entry !== "object" || entry === null) return [];
  const hooks = (entry as JsonObject).hooks;
  if (!Array.isArray(hooks)) return [];
  return hooks
    .map((h) => (typeof h === "object" && h !== null ? (h as JsonObject).command : undefined))
    .filter((c): c is string => typeof c === "string");
}

function isOurs(entry: unknown): boolean {
  return commandsOf(entry).some((c) => c.includes(HOOK_SCRIPT_NAME));
}

function hookScriptPathFor(paths: KindPaths): string {
  return join(paths.hooksDir, HOOK_SCRIPT_NAME);
}

function buildEntry(paths: KindPaths, kind: AgentIntegrationKind): JsonObject {
  const scriptPath = hookScriptPathFor(paths);
  return {
    matcher: MATCHER,
    // 素の二重引用符で囲む（`JSON.stringify` の `\`エスケープは POSIX シェル・cmd.exe のどちらの
    // クォート規則とも一致しない。パスに空白を含む場合の対策としては、これで両方に通る）。
    hooks: [{ type: "command", command: `node "${scriptPath}" ${kind}`, async: true }],
  };
}

async function isOnPath(binName: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  const dirs = (env.PATH ?? "").split(delimiter).filter(Boolean);
  const candidates = process.platform === "win32" ? [binName, `${binName}.cmd`, `${binName}.exe`, `${binName}.bat`] : [binName];
  for (const dir of dirs) {
    for (const name of candidates) {
      try {
        await access(join(dir, name), fsConstants.X_OK);
        return true;
      } catch {
        // 次の候補へ
      }
    }
  }
  return false;
}

export class FsAgentIntegrationInstaller implements AgentIntegrationInstaller {
  constructor(
    /** 同梱の hook スクリプト本体（`packages/server/assets/agent-hook-report.cjs`）のパス。 */
    private readonly hookScriptSource: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly home: string = homedir(),
  ) {}

  async status(kind: AgentIntegrationKind): Promise<{ cliDetected: boolean; installed: boolean }> {
    const paths = pathsFor(kind, this.env, this.home);
    const [cliDetected, read] = await Promise.all([isOnPath(paths.binName, this.env), readJsonObject(paths.configFile)]);
    const installed = read.ok && sessionStartEntries(read.data).some(isOurs);
    return { cliDetected, installed };
  }

  async install(kind: AgentIntegrationKind): Promise<{ ok: boolean; message: string | null }> {
    const paths = pathsFor(kind, this.env, this.home);
    const read = await readJsonObject(paths.configFile);
    if (!read.ok) return { ok: false, message: `設定ファイルを解釈できませんでした（${paths.configFile}）` };
    const root = read.data;
    const entries = sessionStartEntries(root);
    if (entries.some(isOurs)) return { ok: true, message: "既に導入済みです" };

    await mkdir(paths.hooksDir, { recursive: true });
    await copyFile(this.hookScriptSource, hookScriptPathFor(paths));

    const hooks = typeof root.hooks === "object" && root.hooks !== null && !Array.isArray(root.hooks) ? (root.hooks as JsonObject) : {};
    const updated: JsonObject = { ...root, hooks: { ...hooks, SessionStart: [...entries, buildEntry(paths, kind)] } };
    await mkdir(dirname(paths.configFile), { recursive: true });
    await writeFileAtomic(paths.configFile, JSON.stringify(updated, null, 2));
    return { ok: true, message: null };
  }

  async uninstall(kind: AgentIntegrationKind): Promise<{ ok: boolean; message: string | null }> {
    const paths = pathsFor(kind, this.env, this.home);
    const read = await readJsonObject(paths.configFile);
    if (!read.ok) return { ok: false, message: `設定ファイルを解釈できませんでした（${paths.configFile}）` };
    const root = read.data;
    const entries = sessionStartEntries(root);
    if (!entries.some(isOurs)) return { ok: true, message: "未導入でした" };

    const remaining = entries.filter((e) => !isOurs(e));
    const hooks = typeof root.hooks === "object" && root.hooks !== null && !Array.isArray(root.hooks) ? (root.hooks as JsonObject) : {};
    const updated: JsonObject = { ...root, hooks: { ...hooks, SessionStart: remaining } };
    await writeFileAtomic(paths.configFile, JSON.stringify(updated, null, 2));
    await rm(hookScriptPathFor(paths), { force: true });
    return { ok: true, message: null };
  }
}
