import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTempDir } from "../persist/atomicFile.js";
import { FsAgentIntegrationInstaller } from "./AgentIntegrationInstaller.js";

// テストは常に `CLAUDE_CONFIG_DIR`/`CODEX_HOME` を一時ディレクトリへ向け、実際の
// `~/.claude`/`~/.codex` には一切触れない（このテストが誤って利用者の環境を書き換えないため）。

describe("FsAgentIntegrationInstaller", () => {
  let workDir: string;
  let hookScriptSource: string;
  let claudeDir: string;
  let codexDir: string;

  beforeEach(async () => {
    workDir = await makeTempDir("wtm-integration-installer-");
    hookScriptSource = join(workDir, "agent-hook-report.cjs");
    await writeFile(hookScriptSource, "// fake hook script\n");
    claudeDir = join(workDir, "claude-home");
    codexDir = join(workDir, "codex-home");
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  function makeInstaller(env: Partial<NodeJS.ProcessEnv> = {}) {
    return new FsAgentIntegrationInstaller(
      hookScriptSource,
      { PATH: "", CLAUDE_CONFIG_DIR: claudeDir, CODEX_HOME: codexDir, ...env } as NodeJS.ProcessEnv,
      join(workDir, "unused-home"),
    );
  }

  it("reports not installed / cliDetected false before anything is set up", async () => {
    const installer = makeInstaller();
    expect(await installer.status("claude")).toEqual({ cliDetected: false, installed: false });
  });

  it("installs into a fresh (missing) settings.json for Claude Code", async () => {
    const installer = makeInstaller();
    const result = await installer.install("claude");
    expect(result).toEqual({ ok: true, message: null });

    const status = await installer.status("claude");
    expect(status.installed).toBe(true);

    const settings = JSON.parse(await readFile(join(claudeDir, "settings.json"), "utf8"));
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain("wtm-agent-report.cjs");
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain("claude");
    expect(settings.hooks.SessionStart[0].hooks[0].async).toBe(true);

    // hook スクリプトが実際にコピーされている
    const copied = await readFile(join(claudeDir, "hooks", "wtm-agent-report.cjs"), "utf8");
    expect(copied).toContain("fake hook script");
  });

  it("installs into the dedicated hooks.json for Codex without touching config.toml", async () => {
    const installer = makeInstaller();
    const result = await installer.install("codex");
    expect(result).toEqual({ ok: true, message: null });

    const hooksJson = JSON.parse(await readFile(join(codexDir, "hooks.json"), "utf8"));
    expect(hooksJson.hooks.SessionStart[0].hooks[0].command).toContain("codex");
  });

  it("is idempotent: installing twice does not duplicate the entry", async () => {
    const installer = makeInstaller();
    await installer.install("claude");
    const second = await installer.install("claude");
    expect(second).toEqual({ ok: true, message: "既に導入済みです" });

    const settings = JSON.parse(await readFile(join(claudeDir, "settings.json"), "utf8"));
    expect(settings.hooks.SessionStart).toHaveLength(1);
  });

  it("preserves unrelated existing settings and hooks (non-destructive merge)", async () => {
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      join(claudeDir, "settings.json"),
      JSON.stringify({
        someOtherSetting: true,
        hooks: { SessionStart: [{ matcher: "compact", hooks: [{ type: "command", command: "echo hi" }] }] },
      }),
    );
    const installer = makeInstaller();
    await installer.install("claude");

    const settings = JSON.parse(await readFile(join(claudeDir, "settings.json"), "utf8"));
    expect(settings.someOtherSetting).toBe(true);
    expect(settings.hooks.SessionStart).toHaveLength(2);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe("echo hi");
  });

  it("refuses to write over a corrupt settings.json", async () => {
    await mkdir(claudeDir, { recursive: true });
    await writeFile(join(claudeDir, "settings.json"), "{ not json");
    const installer = makeInstaller();

    const result = await installer.install("claude");
    expect(result.ok).toBe(false);
    expect(await readFile(join(claudeDir, "settings.json"), "utf8")).toBe("{ not json");
  });

  it("uninstall removes only our entry and the copied script, leaving other hooks intact", async () => {
    const installer = makeInstaller();
    await installer.install("claude");
    await mkdir(join(claudeDir, "hooks"), { recursive: true });
    const settingsPath = join(claudeDir, "settings.json");
    const before = JSON.parse(await readFile(settingsPath, "utf8"));
    before.hooks.SessionStart.push({ matcher: "compact", hooks: [{ type: "command", command: "echo hi" }] });
    await writeFile(settingsPath, JSON.stringify(before));

    const result = await installer.uninstall("claude");
    expect(result).toEqual({ ok: true, message: null });

    const after = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(after.hooks.SessionStart).toHaveLength(1);
    expect(after.hooks.SessionStart[0].hooks[0].command).toBe("echo hi");
    await expect(readFile(join(claudeDir, "hooks", "wtm-agent-report.cjs"))).rejects.toThrow();
  });

  it("uninstall reports 未導入 when nothing was installed", async () => {
    const installer = makeInstaller();
    expect(await installer.uninstall("claude")).toEqual({ ok: true, message: "未導入でした" });
  });
});
