import { TERMINAL_PALETTES, type HostInfo } from "@wtm/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Disposable } from "../../util/Disposable.js";
import { MemoryLogger } from "../../log/Logger.js";
import { EventBus } from "../../bus/EventBus.js";
import type { CreatePaneOptions, TerminalManager } from "../../terminal/TerminalManager.js";
import type { TerminalHost } from "../../terminal/TerminalHost.js";
import type { OutputFanout, ClientSink } from "../../terminal/OutputFanout.js";
import type { PersistScheduler } from "../../session/PersistScheduler.js";
import { SessionModel } from "../../session/SessionModel.js";
import { SessionService } from "../../session/SessionService.js";
import { DefaultClientRegistry } from "../../clients/ClientRegistry.js";
import { DefaultSizeAuthority } from "../../clients/SizeAuthority.js";
import { answerPaletteFor } from "../../clients/answerPalette.js";
import { ControlSurface } from "../ControlSurface.js";
import { registerAllMethods } from "./index.js";
import type { WorktreeService } from "../../git/WorktreeService.js";
import type { AgentIntegrationService } from "../../agent/AgentIntegrationService.js";
import type { NewCwdDeps } from "../../session/newCwd.js";
import type { WorkspaceLabelDeps } from "../../session/workspaceLabel.js";

class FakeFanout implements OutputFanout {
  readonly subscribed: string[] = [];
  readonly unsubscribed: string[] = [];
  subscribe(sink: ClientSink): void {
    this.subscribed.push(sink.clientId);
  }
  unsubscribe(clientId: string): void {
    this.unsubscribed.push(clientId);
  }
  push(): void {
    // no-op
  }
  retryStale(): void {
    // no-op
  }
}

class FakeHost implements TerminalHost {
  readonly pid = 1;
  readonly mirror = {} as TerminalHost["mirror"];
  readonly fanout = new FakeFanout();
  private readonly exitListeners = new Set<(code: number) => void>();
  constructor(
    readonly paneId: string,
    failWithCode: number | null,
  ) {
    if (failWithCode !== null) {
      queueMicrotask(() => this.fireExit(failWithCode));
    }
  }
  write(): void {}
  resize(): void {}
  lastOutputAt(): number {
    return Date.now();
  }
  onExit(cb: (code: number) => void): Disposable {
    this.exitListeners.add(cb);
    return { dispose: () => this.exitListeners.delete(cb) };
  }
  dispose(): void {}
  fireExit(code: number): void {
    for (const fn of [...this.exitListeners]) fn(code);
  }
}

class FakeTerminalManager implements TerminalManager {
  readonly hosts = new Map<string, FakeHost>();
  /** 次に create するとき、この終了コードで即座に失敗させる（null なら成功）。 */
  nextSpawnFailure: number | null = null;
  create(paneId: string, _opts: CreatePaneOptions): TerminalHost {
    const host = new FakeHost(paneId, this.nextSpawnFailure);
    this.nextSpawnFailure = null;
    this.hosts.set(paneId, host);
    return host;
  }
  get(paneId: string): TerminalHost | undefined {
    return this.hosts.get(paneId);
  }
  resize(): void {
    // no-op
  }
  dispose(paneId: string): void {
    this.hosts.delete(paneId);
  }
}

class NoopPersist implements PersistScheduler {
  touch(): void {}
  async flush(): Promise<void> {}
  cancel(): void {}
}

const HOST_INFO: HostInfo = { os: "linux", windowsBuild: null, hostname: "test" };
const fakeSink = (clientId: string): ClientSink => ({ clientId, sendOutput: () => undefined, sendSnapshot: () => undefined, bufferedAmount: 0 });

function makeContext(newCwdDeps?: NewCwdDeps) {
  // 名前を確かめるテストがあるので、手元の fs に依存させない（20260921-workspace-auto-label。git のリポジトリは無い）。
  const workspaceLabelDeps: WorkspaceLabelDeps = { stat: async () => null, readFile: async () => null, home: () => "/home/u" };
  const terminals = new FakeTerminalManager();
  const session = new SessionService({
    model: new SessionModel(),
    terminals,
    bus: new EventBus(),
    persist: new NoopPersist(),
    serverVersion: "test",
    host: HOST_INFO,
    scrollbackLines: 1000,
    spawnGraceMs: 1,
    defaultCwd: "/home/u",
    newCwdDeps,
    workspaceLabelDeps,
    logger: new MemoryLogger(),
  });
  const clients = new DefaultClientRegistry();
  const sizeAuthority = new DefaultSizeAuthority(clients, session);
  const surface = new ControlSurface(new MemoryLogger());
  registerAllMethods(surface, { session, clients, sizeAuthority, terminals, worktrees: stubWorktrees(), agentIntegrations: stubAgentIntegrations() });
  return { terminals, session, clients, surface };
}

describe("registerAllMethods — client / workspace / tab / pane flow", () => {
  let ctx: Awaited<ReturnType<typeof makeContext>>;
  let clientId: string;

  beforeEach(() => {
    ctx = makeContext();
    clientId = ctx.clients.register();
  });

  it("client.theme は表示しているテーマを覚える。知らない名前は invalid_params（20260921-theme-settings）", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    expect(ctx.clients.get(clientId)?.theme).toBeNull();
    expect((await ctx.surface.invoke(c, "client.theme", { theme: "gruvbox-light" })).ok).toBe(true);
    expect(ctx.clients.get(clientId)?.theme).toBe("gruvbox-light");
    const bad = await ctx.surface.invoke(c, "client.theme", { theme: "terminal" });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("unreachable");
    expect(bad.error.code).toBe("invalid_params");
    expect(ctx.clients.get(clientId)?.theme).toBe("gruvbox-light");
  });

  it("作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13）", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(1_000);
      const creator = ctx.clients.register("desktop");
      const other = ctx.clients.register("desktop");
      ctx.clients.setTheme(creator, "catppuccin-latte");
      ctx.clients.setTheme(other, "vesper");
      const { workspace, pane } = await ctx.session.createWorkspace("/home/u", "w");
      const deps = { getPane: (id: string) => ctx.session.getPane(id), getTab: (id: string) => ctx.session.getTab(id), clients: ctx.clients };
      for (const [method, params] of [
        ["tab.create", { workspaceId: workspace.id }],
        ["workspace.create", { cwd: "/home/u" }],
        ["pane.split", { paneId: pane.id, direction: "right" }],
      ] as const) {
        vi.setSystemTime(Date.now() + 1_000);
        ctx.clients.touch(other); // 別の人が後から操作した
        vi.setSystemTime(Date.now() + 1_000);
        const pending = ctx.surface.invoke({ clientId: creator, sink: fakeSink(creator) }, method, params as never);
        // 作っている途中（まだモデルに入っていない pane）の問い合わせにも、作った人の配色で答える。
        expect(answerPaletteFor("not-yet-committed", deps), method).toBe(TERMINAL_PALETTES["catppuccin-latte"]);
        expect((await pending).ok, method).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("client.hello sets the kind and returns a snapshot", async () => {
    const result = await ctx.surface.invoke({ clientId, sink: fakeSink(clientId) }, "client.hello", { protocol: 1, kind: "mobile" });
    expect(result.ok).toBe(true);
    expect(ctx.clients.get(clientId)?.kind).toBe("mobile");
    if (!result.ok) throw new Error("unreachable");
    expect((result.result as { snapshot: { workspaces: unknown[] } }).snapshot.workspaces).toEqual([]);
  });

  it("モバイルは client.view だけでは権限を取らず、client.fit を有効にすると取り、無効にすると手放す（D13・D106）", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    await ctx.surface.invoke(c, "client.hello", { protocol: 1, kind: "mobile" });
    const { tab, pane } = await ctx.session.createWorkspace("/home/u", "api");
    const sizeBefore = { cols: ctx.session.getPane(pane.id)!.cols, rows: ctx.session.getPane(pane.id)!.rows };

    const view = { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] };
    expect((await ctx.surface.invoke(c, "client.view", view)).ok).toBe(true);
    expect(ctx.session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(ctx.session.getPane(pane.id)).toMatchObject(sizeBefore);

    expect((await ctx.surface.invoke(c, "client.fit", { enabled: true })).ok).toBe(true);
    expect(ctx.session.getTab(tab.id)?.sizeOwnerClientId).toBe(clientId);
    expect(ctx.session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });

    expect((await ctx.surface.invoke(c, "client.fit", { enabled: false })).ok).toBe(true);
    expect(ctx.session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    await ctx.surface.invoke(c, "client.view", { ...view, visible: [{ paneId: pane.id, cols: 30, rows: 15 }] });
    expect(ctx.session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 }); // 手放した後の申告では動かさない
  });

  it("client.hello で fit なしのモバイルに変わったら、デスクトップとして持っていた権限を手放す（D106）", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    await ctx.surface.invoke(c, "client.hello", { protocol: 1, kind: "desktop" });
    const { tab, pane } = await ctx.session.createWorkspace("/home/u", "api");
    await ctx.surface.invoke(c, "client.view", { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 60, rows: 30 }] });
    expect(ctx.session.getTab(tab.id)?.sizeOwnerClientId).toBe(clientId);

    expect((await ctx.surface.invoke(c, "client.hello", { protocol: 1, kind: "mobile" })).ok).toBe(true);

    expect(ctx.session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(ctx.session.getPane(pane.id)).toMatchObject({ cols: 60, rows: 30 });
  });

  it("workspace.create → tab.create → pane.split round trip, and pane.focus notes size ownership", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    const wsResult = await ctx.surface.invoke(c, "workspace.create", { cwd: "/home/u/api", label: "api" });
    expect(wsResult.ok).toBe(true);
    if (!wsResult.ok) throw new Error("unreachable");
    const { workspace, tab, pane } = wsResult.result as { workspace: { id: string }; tab: { id: string }; pane: { id: string } };

    const tabResult = await ctx.surface.invoke(c, "tab.create", { workspaceId: workspace.id, label: "logs" });
    expect(tabResult.ok).toBe(true);

    const splitResult = await ctx.surface.invoke(c, "pane.split", { paneId: pane.id, direction: "right" });
    expect(splitResult.ok).toBe(true);
    if (!splitResult.ok) throw new Error("unreachable");
    const newPane = (splitResult.result as { pane: { id: string } }).pane;

    const focusResult = await ctx.surface.invoke(c, "pane.focus", { paneId: newPane.id });
    expect(focusResult.ok).toBe(true);
    expect(ctx.session.getTab(tab.id)).toBeDefined();
  });

  it("pane.focus on an unknown pane returns not_found", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    const result = await ctx.surface.invoke(c, "pane.focus", { paneId: "p999" });
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: expect.stringContaining("p999") } });
  });

  it("a shell that fails to start turns workspace.create into spawn_failed", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    ctx.terminals.nextSpawnFailure = 1; // execvp 失敗を模する（D37）
    const result = await ctx.surface.invoke(c, "workspace.create", { cwd: "/home/u", label: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("spawn_failed");
  });

  it("pane.subscribe wires the client sink into the pane's fanout and returns its size", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    const wsResult = await ctx.surface.invoke(c, "workspace.create", { cwd: "/home/u", label: "api" });
    if (!wsResult.ok) throw new Error("unreachable");
    const { pane } = wsResult.result as { pane: { id: string; cols: number; rows: number } };

    const subResult = await ctx.surface.invoke(c, "pane.subscribe", { paneId: pane.id, scrollbackLines: 500 });
    expect(subResult).toEqual({ ok: true, result: { cols: pane.cols, rows: pane.rows } });
    const fanout = ctx.terminals.get(pane.id)!.fanout as FakeFanout;
    expect(fanout.subscribed).toEqual([clientId]);
    expect(ctx.clients.subscriptions(clientId)).toEqual([pane.id]);

    await ctx.surface.invoke(c, "pane.unsubscribe", { paneId: pane.id });
    expect(fanout.unsubscribed).toEqual([clientId]);
    expect(ctx.clients.subscriptions(clientId)).toEqual([]);
  });

  it("pane.subscribe on an unknown pane returns not_found", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    const result = await ctx.surface.invoke(c, "pane.subscribe", { paneId: "p999", scrollbackLines: 100 });
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: expect.stringContaining("p999") } });
  });

  it("workspace.close cascades and, when it was the last workspace, a new one appears (D24)", async () => {
    const c = { clientId, sink: fakeSink(clientId) };
    const wsResult = await ctx.surface.invoke(c, "workspace.create", { cwd: "/home/u", label: "api" });
    if (!wsResult.ok) throw new Error("unreachable");
    const { workspace } = wsResult.result as { workspace: { id: string } };

    const closeResult = await ctx.surface.invoke(c, "workspace.close", { workspaceId: workspace.id });
    expect(closeResult).toEqual({ ok: true, result: {} });
    expect(ctx.session.snapshot().workspaces.length).toBe(1);
    expect(ctx.session.snapshot().workspaces[0]!.id).not.toBe(workspace.id);
  });
});

// 入口が `newCwd` を落とさず `SessionService` へ渡すこと（20260921-new-terminal-cwd の T4）。場所を決める規則そのものは
// `session/newCwd.test.ts`、作成との結び付きは `session/SessionService.test.ts` が見るので、ここは 3 つの入口の結線だけ。
describe("registerAllMethods — 新しく開く場所（newCwd）", () => {
  const deps: NewCwdDeps = {
    liveCwd: async () => null,
    hintCwd: () => null,
    recordedCwd: () => undefined,
    home: () => "/home/me",
    currentDir: "/srv/start",
    isUsableDir: async (path) => path !== "/nope",
  };

  it("3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す", async () => {
    const ctx = makeContext(deps);
    const clientId = ctx.clients.register();
    const c = { clientId, sink: fakeSink(clientId) };
    const home = { policy: "home" } as const;

    const wsResult = await ctx.surface.invoke(c, "workspace.create", { label: "a", newCwd: home });
    if (!wsResult.ok) throw new Error(JSON.stringify(wsResult.error));
    const created = wsResult.result as {
      workspace: { id: string; cwd: string };
      pane: { id: string; cwd: string };
    };
    expect(created.pane.cwd).toBe("/home/me");
    expect(created.workspace.cwd).toBe("/home/me");

    const tabResult = await ctx.surface.invoke(c, "tab.create", {
      workspaceId: created.workspace.id,
      newCwd: { policy: "current" },
    });
    if (!tabResult.ok) throw new Error(JSON.stringify(tabResult.error));
    expect((tabResult.result as { pane: { cwd: string } }).pane.cwd).toBe("/srv/start");

    const splitResult = await ctx.surface.invoke(c, "pane.split", {
      paneId: created.pane.id,
      direction: "right",
      newCwd: { policy: "path", path: "/nope" },
    });
    if (!splitResult.ok) throw new Error(JSON.stringify(splitResult.error));
    // 使えない場所は分割の以前の場所（元の pane の記録された場所）で開き、知らせる印を返す（AC9）。
    expect(splitResult.result).toMatchObject({ pane: { cwd: "/home/me" }, cwdFallback: true });
  });
});

// 名前変更は await してから応答し、null は自動の名前に戻す（20260921-workspace-auto-label）。
describe("registerAllMethods — workspace.rename", () => {
  it("名前を付け、null で自動の名前に戻し、無い workspace は not_found を返す", async () => {
    const ctx = makeContext();
    const clientId = ctx.clients.register();
    const c = { clientId, sink: fakeSink(clientId) };
    const { workspace } = await ctx.session.createWorkspace("/srv/app", undefined);
    expect((await ctx.surface.invoke(c, "workspace.rename", { workspaceId: workspace.id, label: "mine" })).ok).toBe(true);
    expect(ctx.session.snapshot().workspaces[0]).toMatchObject({ label: "mine", autoLabel: false });
    const back = await ctx.surface.invoke(c, "workspace.rename", { workspaceId: workspace.id, label: null });
    expect(back).toEqual({ ok: true, result: {} });
    // 応答の時点で自動の名前に戻っている（await してから応答する）。
    expect(ctx.session.snapshot().workspaces[0]).toMatchObject({ label: "app", autoLabel: true });
    const missing = await ctx.surface.invoke(c, "workspace.rename", { workspaceId: "w999", label: null });
    expect(missing).toEqual({ ok: false, error: { code: "not_found", message: expect.stringContaining("w999") } });
  });
});

/** worktree の方式は別のテストで確かめるので、ここでは呼ばれない代役を置く（20260920-git-worktree-actions）。 */
function stubWorktrees(): WorktreeService {
  return {
    list: () => Promise.reject(new Error("not used in this test")),
    create: () => Promise.reject(new Error("not used in this test")),
  };
}

function stubAgentIntegrations(): AgentIntegrationService {
  return {
    getAutoResumeEnabled: () => true,
    status: () => Promise.reject(new Error("not used in this test")),
    install: () => Promise.reject(new Error("not used in this test")),
    uninstall: () => Promise.reject(new Error("not used in this test")),
    setAutoResume: () => Promise.reject(new Error("not used in this test")),
  };
}
