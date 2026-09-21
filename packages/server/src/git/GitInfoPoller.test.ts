import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HostInfo } from "@wtm/protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Disposable } from "../util/Disposable.js";
import { MemoryLogger } from "../log/Logger.js";
import { EventBus } from "../bus/EventBus.js";
import type { CreatePaneOptions, TerminalManager } from "../terminal/TerminalManager.js";
import type { TerminalHost } from "../terminal/TerminalHost.js";
import type { PersistScheduler } from "../session/PersistScheduler.js";
import { SessionModel } from "../session/SessionModel.js";
import { SessionService } from "../session/SessionService.js";
import { makeTempDir } from "../persist/atomicFile.js";
import { ChildProcessGitRunner } from "../infra/GitRunner.js";
import { DefaultGitInfoPoller } from "./GitInfoPoller.js";

class AlwaysUpHost implements TerminalHost {
  readonly pid = 1;
  readonly mirror = {} as TerminalHost["mirror"];
  readonly fanout = {} as TerminalHost["fanout"];
  constructor(readonly paneId: string) {}
  write(): void {}
  resize(): void {}
  lastOutputAt(): number {
    return Date.now();
  }
  onExit(): Disposable {
    return { dispose: () => undefined };
  }
  dispose(): void {}
}
class AlwaysUpTerminalManager implements TerminalManager {
  create(paneId: string, _opts: CreatePaneOptions): TerminalHost {
    return new AlwaysUpHost(paneId);
  }
  get(): TerminalHost | undefined {
    return undefined;
  }
  resize(): void {}
  dispose(): void {}
}
class NoopPersist implements PersistScheduler {
  touch(): void {}
  async flush(): Promise<void> {}
  cancel(): void {}
}

const HOST_INFO: HostInfo = { os: "linux", windowsBuild: null, hostname: "test" };

async function runGit(cwd: string, args: string[]): Promise<void> {
  await new ChildProcessGitRunner().run(cwd, args, 5000);
}

describe("DefaultGitInfoPoller", () => {
  let repoDir: string;
  let service: SessionService;

  beforeEach(async () => {
    repoDir = await makeTempDir("wtm-gitpoller-");
    await runGit(repoDir, ["init", "-b", "main"]);
    await runGit(repoDir, ["config", "user.email", "t@example.com"]);
    await runGit(repoDir, ["config", "user.name", "t"]);
    await writeFile(join(repoDir, "a.txt"), "hello");
    await runGit(repoDir, ["add", "a.txt"]);
    await runGit(repoDir, ["commit", "-m", "init"]);

    service = new SessionService({
      model: new SessionModel(),
      terminals: new AlwaysUpTerminalManager(),
      bus: new EventBus(),
      persist: new NoopPersist(),
      serverVersion: "test",
      host: HOST_INFO,
      scrollbackLines: 1000,
      spawnGraceMs: 1,
      defaultCwd: repoDir,
      logger: new MemoryLogger(),
    });
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("sets the branch for a workspace whose cwd is a git repo", async () => {
    await service.createWorkspace(repoDir, "repo");
    const poller = new DefaultGitInfoPoller(service, new ChildProcessGitRunner());
    await poller.pollNow();
    const ws = service.snapshot().workspaces[0]!;
    expect(ws.git).toMatchObject({ branch: "main" });
  });

  it("leaves git null for a workspace whose cwd is not a git repo", async () => {
    const plainDir = await mkdirTemp();
    await service.createWorkspace(plainDir, "plain");
    const poller = new DefaultGitInfoPoller(service, new ChildProcessGitRunner());
    await poller.pollNow();
    const ws = service.snapshot().workspaces.find((w) => w.cwd === plainDir)!;
    expect(ws.git).toBeNull();
    await rm(plainDir, { recursive: true, force: true });
  });

  it("reports ahead when a commit exists only on the local branch relative to its upstream", async () => {
    // 「上流」をローカルブランチ base（現在の HEAD）にし、main だけ 1 コミット進める
    // （リモートを使わずに ahead=1・behind=0 を作れる、最も単純な形）。
    await runGit(repoDir, ["branch", "base"]);
    await runGit(repoDir, ["branch", "--set-upstream-to=base", "main"]);
    await writeFile(join(repoDir, "b.txt"), "world");
    await runGit(repoDir, ["add", "b.txt"]);
    await runGit(repoDir, ["commit", "-m", "second"]);

    await service.createWorkspace(repoDir, "repo");
    const poller = new DefaultGitInfoPoller(service, new ChildProcessGitRunner());
    await poller.pollNow();
    const ws = service.snapshot().workspaces[0]!;
    expect(ws.git).toMatchObject({ branch: "main", ahead: 1, behind: 0 });
  });

  it("does not touch the workspace record when the git info has not changed (SessionService.updateWorkspaceGit の早期リターン)", async () => {
    await service.createWorkspace(repoDir, "repo");
    const poller = new DefaultGitInfoPoller(service, new ChildProcessGitRunner());
    await poller.pollNow();
    const first = service.snapshot().workspaces[0]!;
    await poller.pollNow();
    const second = service.snapshot().workspaces[0]!;
    expect(second).toBe(first); // 同一参照のまま＝モデルを書き換えていない
  });
});

async function mkdirTemp(): Promise<string> {
  const dir = await makeTempDir("wtm-gitpoller-plain-");
  await mkdir(dir, { recursive: true });
  return dir;
}
