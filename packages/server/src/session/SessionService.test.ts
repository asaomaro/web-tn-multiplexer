import type { AgentInfo, HostInfo } from "@wtm/protocol";
import { RpcError } from "@wtm/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import type { Disposable } from "../util/Disposable.js";
import { MemoryLogger } from "../log/Logger.js";
import { EventBus } from "../bus/EventBus.js";
import type { CreatePaneOptions, TerminalManager } from "../terminal/TerminalManager.js";
import type { TerminalHost } from "../terminal/TerminalHost.js";
import type { PersistScheduler } from "./PersistScheduler.js";
import { SessionModel } from "./SessionModel.js";
import { SessionService } from "./SessionService.js";
import type { SessionFileData } from "../persist/SessionFile.js";

/** 即座に失敗させたい pane の id を登録しておける偽の TerminalManager（T17「テスト方針」）。 */
class FakeTerminalHost implements TerminalHost {
  readonly pid = 4242;
  readonly mirror = {} as TerminalHost["mirror"];
  readonly fanout = {} as TerminalHost["fanout"];
  private readonly exitListeners = new Set<(code: number) => void>();
  disposed = false;
  resized: { cols: number; rows: number } | null = null;

  constructor(
    readonly paneId: string,
    failWithCode: number | null,
  ) {
    if (failWithCode !== null) {
      queueMicrotask(() => {
        for (const fn of [...this.exitListeners]) fn(failWithCode);
      });
    }
  }
  write(): void {
    // no-op
  }
  resize(cols: number, rows: number): void {
    this.resized = { cols, rows };
  }
  lastOutputAt(): number {
    return Date.now();
  }
  onExit(cb: (code: number) => void): Disposable {
    this.exitListeners.add(cb);
    return { dispose: () => this.exitListeners.delete(cb) };
  }
  dispose(): void {
    this.disposed = true;
  }
  fireExit(code: number): void {
    for (const fn of [...this.exitListeners]) fn(code);
  }
}

class FakeTerminalManager implements TerminalManager {
  readonly hosts = new Map<string, FakeTerminalHost>();
  readonly createOptions: CreatePaneOptions[] = [];
  /** 次に create するとき、この終了コードで即座に失敗させる（null なら成功）。 */
  nextSpawnFailure: number | null = null;

  create(paneId: string, opts: CreatePaneOptions): TerminalHost {
    this.createOptions.push(opts);
    const host = new FakeTerminalHost(paneId, this.nextSpawnFailure);
    this.nextSpawnFailure = null;
    this.hosts.set(paneId, host);
    return host;
  }
  get(paneId: string): TerminalHost | undefined {
    return this.hosts.get(paneId);
  }
  resize(paneId: string, cols: number, rows: number): void {
    this.hosts.get(paneId)?.resize(cols, rows);
  }
  dispose(paneId: string): void {
    this.hosts.get(paneId)?.dispose();
    this.hosts.delete(paneId);
  }
}

class FakePersistScheduler implements PersistScheduler {
  touchCount = 0;
  touch(): void {
    this.touchCount++;
  }
  async flush(): Promise<void> {
    // no-op
  }
  cancel(): void {}
}

const HOST_INFO: HostInfo = { os: "linux", windowsBuild: null, hostname: "test-host" };

function makeService(terminals: FakeTerminalManager, bus: EventBus, persist: FakePersistScheduler, shell?: string) {
  return new SessionService({
    shell,
    model: new SessionModel(),
    terminals,
    bus,
    persist,
    serverVersion: "0.1.0-test",
    host: HOST_INFO,
    scrollbackLines: 1000,
    spawnGraceMs: 5, // テストを速く保つ（本番の既定は 300ms。D37）
    defaultCwd: "/home/u",
    logger: new MemoryLogger(),
  });
}

describe("SessionService — `--shell`（T27）", () => {
  it("--shell を渡すと、workspace・tab・分割のどの新しい pane もそのシェルで起動する", async () => {
    const terminals = new FakeTerminalManager();
    const service = makeService(terminals, new EventBus(), new FakePersistScheduler(), "/usr/bin/zsh");
    const { workspace, pane } = await service.createWorkspace("/home/u/api", "api");
    await service.createTab(workspace.id, undefined);
    await service.splitPane(pane.id, "right", undefined);
    expect(terminals.createOptions.map((o) => o.shell)).toEqual(["/usr/bin/zsh", "/usr/bin/zsh", "/usr/bin/zsh"]);
    expect(service.snapshot().panes.map((p) => p.shell)).toEqual(["/usr/bin/zsh", "/usr/bin/zsh", "/usr/bin/zsh"]); // 保存にも残る
  });

  it("再起動後の復元でも、保存された shell ではなく --shell で起動する", async () => {
    const terminals = new FakeTerminalManager();
    const service = makeService(terminals, new EventBus(), new FakePersistScheduler(), "/usr/bin/zsh");
    const data: SessionFileData = {
      schema: 1,
      savedAt: "2026-09-18T00:00:00Z",
      nextId: { w: 2, t: 2, p: 2, s: 1, a: 1 },
      workspaces: [
        {
          id: "w1",
          label: "api",
          cwd: "/home/u/api",
          activeTabId: "t1",
          tabs: [
            {
              id: "t1",
              label: "main",
              focusedPaneId: "p1",
              zoomedPaneId: null,
              layout: { type: "pane", paneId: "p1" },
              panes: [{ id: "p1", label: null, cwd: "/home/u/api", shell: "" }],
            },
          ],
        },
      ],
      focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
    };
    await service.restore(data);
    expect(terminals.createOptions.map((o) => o.shell)).toEqual(["/usr/bin/zsh"]);
  });

  it("--shell を渡さなければ shell を指定しない（TerminalManager が OS の既定を使う）", async () => {
    const terminals = new FakeTerminalManager();
    const service = makeService(terminals, new EventBus(), new FakePersistScheduler());
    await service.createWorkspace("/home/u/api", "api");
    expect(terminals.createOptions[0]?.shell).toBeUndefined();
  });
});

describe("SessionService — workspace creation", () => {
  let terminals: FakeTerminalManager;
  let bus: EventBus;
  let persist: FakePersistScheduler;
  let service: SessionService;

  beforeEach(() => {
    terminals = new FakeTerminalManager();
    bus = new EventBus();
    persist = new FakePersistScheduler();
    service = makeService(terminals, bus, persist);
  });

  it("creates a workspace, emits workspace.created and pane.created, and schedules a save", async () => {
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    const { workspace, pane } = await service.createWorkspace("/home/u/api", "api");
    expect(workspace.cwd).toBe("/home/u/api");
    expect(pane.status).toBe("running");
    expect(events).toEqual(["workspace.created", "tab.created", "pane.created"]); // D88
    expect(persist.touchCount).toBe(1);
    expect(terminals.get(pane.id)).toBeDefined();
  });

  it("throws spawn_failed and does not commit anything when the shell fails to start (D37)", async () => {
    terminals.nextSpawnFailure = 1; // execvp 失敗を模する
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    await expect(service.createWorkspace("/home/u", "api")).rejects.toThrow(RpcError);
    expect(events).toEqual([]); // 何もイベントを出さない
    expect(persist.touchCount).toBe(0);
    expect(service.snapshot().workspaces).toEqual([]); // モデルにも残らない
  });

  it("treats an immediate exit code 0 as a successful spawn, then immediately closes it and auto-recreates (D37 + D18 + D24)", async () => {
    // レビュー指摘で発覚: 猶予中に code 0 で即終了した pane は、以前は永久に「running」のまま残る
    // zombie になっていた（onExit の登録が終了イベントより後で、二度と発火しないため）。
    // 直した今は、成功として一度モデルへコミットしたあと、その場で D18 の連鎖（closePane）が起き、
    // 唯一の workspace だったので D24 ですぐ作り直される。
    terminals.nextSpawnFailure = 0;
    const { workspace } = await service.createWorkspace("/home/u", "api");
    expect(service.snapshot().workspaces.map((w) => w.id)).not.toContain(workspace.id);
    expect(service.snapshot().workspaces.length).toBe(1); // D24 で作り直された別の workspace
  });
});

describe("SessionService — tabs and panes", () => {
  let terminals: FakeTerminalManager;
  let bus: EventBus;
  let persist: FakePersistScheduler;
  let service: SessionService;

  beforeEach(() => {
    terminals = new FakeTerminalManager();
    bus = new EventBus();
    persist = new FakePersistScheduler();
    service = makeService(terminals, bus, persist);
  });

  it("splits a pane and emits pane.created + layout.updated", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    const { pane: newPane } = await service.splitPane(pane.id, "right", undefined);
    expect(events).toEqual(["pane.created", "layout.updated"]);
    expect(newPane.cwd).toBe(pane.cwd); // 分割元の cwd を引き継ぐ
  });

  it("supports at least 16 panes in one session, each independently addressable (AC17「規模」・test 工程で確認)", async () => {
    const { pane: first, tab } = await service.createWorkspace("/home/u", "api");
    const paneIds = [first.id];
    let source = first;
    for (let i = 1; i < 16; i++) {
      const { pane } = await service.splitPane(source.id, i % 2 === 0 ? "right" : "down", undefined);
      paneIds.push(pane.id);
      source = pane;
    }
    expect(paneIds.length).toBe(16);
    expect(new Set(paneIds).size).toBe(16); // 全て別 id
    const snapshot = service.snapshot();
    expect(snapshot.panes.map((p) => p.id).sort()).toEqual([...paneIds].sort());
    expect(snapshot.tabs.find((t) => t.id === tab.id)).toBeDefined();
    // 個別に操作できる（サーバ側が人為的な上限を課していないことの確認。実際の応答性は 03-web-desktop 側の e2e 計測に引き継ぐ）。
    service.resizePane(paneIds[7]!, 100, 30);
    expect(service.getPane(paneIds[7]!)?.cols).toBe(100);
    expect(service.getPane(paneIds[0]!)?.cols).not.toBe(100); // 他の pane には影響しない
  });

  it("rolls back a failed split without touching the layout", async () => {
    const { pane, tab } = await service.createWorkspace("/home/u", "api");
    terminals.nextSpawnFailure = 1;
    await expect(service.splitPane(pane.id, "right", undefined)).rejects.toThrow(RpcError);
    expect(service.snapshot().tabs.find((t) => t.id === tab.id)?.layout).toEqual({ type: "pane", paneId: pane.id });
  });

  it("disposes the orphaned PTY if the source pane is closed during the split's spawn grace window (レビュー指摘・round2)", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const beforeIds = new Set(terminals.hosts.keys());

    const splitPromise = service.splitPane(pane.id, "right", undefined);
    // spawnForPane は terminals.create() を同期的に呼ぶので、この時点で新しい pane の PTY は
    // 既にフェイク側の hosts に入っている（猶予期間の待ちに入る前）。
    const newPaneId = [...terminals.hosts.keys()].find((id) => !beforeIds.has(id));
    expect(newPaneId).toBeDefined();
    const newHost = terminals.get(newPaneId!) as FakeTerminalHost;

    // 分割元の pane を、猶予期間中（spawn の await 中）に別の RPC で閉じる。
    void service.closePane(pane.id);

    await expect(splitPromise).rejects.toThrow(); // model.splitPane が NotFoundError を投げる
    expect(newHost.disposed).toBe(true); // 孤児化せず破棄されている
  });

  it("closing the only pane closes the tab and workspace, disposes the PTY, and auto-creates a replacement (D24)", async () => {
    const { pane, workspace } = await service.createWorkspace("/home/u", "api");
    const host = terminals.get(pane.id) as FakeTerminalHost;
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    await service.closePane(pane.id);

    expect(host.disposed).toBe(true);
    expect(events).toEqual(["pane.closed", "tab.closed", "workspace.closed", "workspace.created", "tab.created", "pane.created"]); // D88
    expect(service.snapshot().workspaces.length).toBe(1);
    expect(service.snapshot().workspaces[0]!.id).not.toBe(workspace.id); // 新しく作られた別の workspace
  });

  it("closes only the pane (not the tab) when siblings remain, and emits layout.updated", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: sibling } = await service.splitPane(pane.id, "right", undefined);
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    await service.closePane(sibling.id);

    expect(events).toEqual(["pane.closed", "layout.updated"]);
    expect(service.snapshot().panes.map((p) => p.id)).toEqual([pane.id]);
  });

  it("disposes the shell when a shell exits on its own (D18)", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const host = terminals.get(pane.id) as FakeTerminalHost;
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    host.fireExit(0);
    await new Promise((r) => setTimeout(r, 20)); // closePane は onExit ハンドラの中から非同期に呼ばれる

    expect(events).toContain("pane.exited");
    expect(events).toContain("workspace.closed");
    expect(host.disposed).toBe(true);
  });

  it("closeTab publishes pane.closed for every pane it takes with it, then tab.closed (D42)", async () => {
    // T14/T17 は closePane 経由の連鎖しか自動テストで確かめていなかった。closeTab を直接呼ぶ
    // 経路（複数 pane を抱えた tab を丸ごと閉じる）でも同じ順で全てのイベントが出ることを確かめる。
    const { pane, tab, workspace } = await service.createWorkspace("/home/u", "api");
    const { pane: sibling } = await service.splitPane(pane.id, "right", undefined);
    await service.createTab(workspace.id, "second"); // workspace は残るようにしておく
    const paneHost = terminals.get(pane.id) as FakeTerminalHost;
    const siblingHost = terminals.get(sibling.id) as FakeTerminalHost;
    const events: { event: string; paneId?: string; tabId?: string }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { paneId?: string; tabId?: string }) }));

    await service.closeTab(tab.id);

    const paneClosed = events.filter((e) => e.event === "pane.closed").map((e) => e.paneId);
    expect(paneClosed.sort()).toEqual([pane.id, sibling.id].sort());
    expect(events.map((e) => e.event)).not.toContain("workspace.closed"); // 他の tab が残っている
    const tabClosedIdx = events.findIndex((e) => e.event === "tab.closed");
    expect(events[tabClosedIdx]).toEqual({ event: "tab.closed", tabId: tab.id });
    expect(paneClosed.every((_id, i) => events.findIndex((e) => e.paneId === paneClosed[i]) < tabClosedIdx)).toBe(true);
    expect(paneHost.disposed).toBe(true);
    expect(siblingHost.disposed).toBe(true);
  });

  it("createTab emits workspace.updated with the new tabIds (05-e2e-docs T2 の E2E で発見。D88)", async () => {
    // `TabBar.vue` 等は `workspace.tabIds` から tab の一覧を出すため、`tab.created` だけでは
    // 新しい tab がタブバーに現れない（実際に real Chromium で再現した不具合）。
    const { workspace } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    const { tab: newTab } = await service.createTab(workspace.id, "second");

    expect(events).toEqual(["tab.created", "pane.created", "workspace.updated"]);
    expect(service.snapshot().workspaces.find((w) => w.id === workspace.id)?.tabIds).toContain(newTab.id);
  });

  it("closeTab emits workspace.updated (not workspace.closed) when a sibling tab remains (D88)", async () => {
    const { workspace } = await service.createWorkspace("/home/u", "api");
    const { tab: secondTab } = await service.createTab(workspace.id, "second");
    const events: { event: string; workspace?: { id: string; tabIds: string[] } }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspace?: { id: string; tabIds: string[] } }) }));

    await service.closeTab(secondTab.id);

    const wsUpdated = events.filter((e) => e.event === "workspace.updated");
    expect(wsUpdated).toHaveLength(1);
    expect(wsUpdated[0]!.workspace?.tabIds).not.toContain(secondTab.id);
    expect(events.map((e) => e.event)).not.toContain("workspace.closed");
  });

  it("closePane emits workspace.updated when closing the last pane cascades into closing its tab, but a sibling tab keeps the workspace alive (D88)", async () => {
    const { workspace } = await service.createWorkspace("/home/u", "api");
    const { tab: secondTab, pane: secondTabPane } = await service.createTab(workspace.id, "second");
    const events: { event: string; workspace?: { id: string; tabIds: string[] } }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspace?: { id: string; tabIds: string[] } }) }));

    await service.closePane(secondTabPane.id); // second tab の唯一の pane → tab も連鎖して閉じる

    const wsUpdated = events.filter((e) => e.event === "workspace.updated");
    expect(wsUpdated).toHaveLength(1);
    expect(wsUpdated[0]!.workspace?.tabIds).not.toContain(secondTab.id);
    expect(events.map((e) => e.event)).not.toContain("workspace.closed");
  });

  it("closeWorkspace publishes pane.closed/tab.closed for every pane and tab it takes with it (D42)", async () => {
    const { pane, tab, workspace } = await service.createWorkspace("/home/u", "api");
    const { pane: sibling } = await service.splitPane(pane.id, "right", undefined); // tab に 2 pane
    const { tab: secondTab, pane: secondTabPane } = await service.createTab(workspace.id, "second"); // workspace に 2 tab
    const hosts = [pane.id, sibling.id, secondTabPane.id].map((id) => terminals.get(id) as FakeTerminalHost);
    const events: { event: string; paneId?: string; tabId?: string; workspaceId?: string }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as Record<string, string>) }));

    await service.closeWorkspace(workspace.id);

    const paneClosed = events.filter((e) => e.event === "pane.closed").map((e) => e.paneId);
    expect(paneClosed.sort()).toEqual([pane.id, sibling.id, secondTabPane.id].sort());
    const tabClosed = events.filter((e) => e.event === "tab.closed").map((e) => e.tabId);
    expect(tabClosed.sort()).toEqual([tab.id, secondTab.id].sort());
    const wsClosedIdx = events.findIndex((e) => e.event === "workspace.closed" && e.workspaceId === workspace.id);
    expect(wsClosedIdx).toBeGreaterThan(-1);
    // pane.closed → tab.closed → workspace.closed の順（design「連鎖して閉じるとき」）。
    expect(events.findIndex((e) => e.event === "pane.closed")).toBeLessThan(events.findIndex((e) => e.event === "tab.closed"));
    expect(events.findIndex((e) => e.event === "tab.closed")).toBeLessThan(wsClosedIdx);
    for (const host of hosts) expect(host.disposed).toBe(true);
    // D24：workspace が 0 個になったので自動で 1 つ作り直す。
    expect(service.snapshot().workspaces.length).toBe(1);
    expect(service.snapshot().workspaces[0]!.id).not.toBe(workspace.id);
  });
});

describe("SessionService — runtime updates", () => {
  let terminals: FakeTerminalManager;
  let bus: EventBus;
  let persist: FakePersistScheduler;
  let service: SessionService;

  beforeEach(() => {
    terminals = new FakeTerminalManager();
    bus = new EventBus();
    persist = new FakePersistScheduler();
    service = makeService(terminals, bus, persist);
  });

  it("allocateAgentInstanceId returns monotonically unique ids and schedules a save (T8)", async () => {
    const a1 = service.allocateAgentInstanceId();
    const a2 = service.allocateAgentInstanceId();
    expect(a1).not.toBe(a2);
    expect(a1).toMatch(/^a\d+$/);
    expect(persist.touchCount).toBeGreaterThanOrEqual(2);
    // session.json の nextId に反映され、再起動後も重複しない（getNextIdCounters 経由で確認）。
    expect(service.getNextIdCounters().a).toBeGreaterThan(2);
  });

  it("resizePane updates the model, resizes the pty, and emits pane.size_changed", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: { event: string; data: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    service.resizePane(pane.id, 100, 30);
    expect(events).toEqual([{ event: "pane.size_changed", data: { paneId: pane.id, cols: 100, rows: 30 } }]);
    expect((terminals.get(pane.id) as FakeTerminalHost).resized).toEqual({ cols: 100, rows: 30 });
  });

  it("resizePane is a no-op when the size does not change", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    service.resizePane(pane.id, pane.cols, pane.rows);
    expect(events).toEqual([]);
  });

  it("updatePaneRuntime emits pane.agent_status_changed when the agent changes", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: { event: string; data: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    const agent: AgentInfo = {
      instanceId: "a1",
      kind: "claude",
      label: "Claude Code",
      state: "working",
      completionSeq: 0,
      serverSeenSeq: 0,
      verified: true,
      since: Date.now(),
    };
    service.updatePaneRuntime(pane.id, { agent });
    expect(events.map((e) => e.event)).toEqual(["pane.agent_status_changed"]);
  });

  it("updatePaneRuntime は agent の中身が実際に変わっていなければ pane.agent_status_changed を出さない\
（review 指摘。should。busy/title/cwd と同じ「実際に変わったときだけ発行する」規約に揃えた。AgentTracker が\
公開されない内部フラグ（visibleIdle 等）だけの変化で新しい AgentInfo オブジェクトを返すことがあるため、\
オブジェクトの参照ではなくフィールドで比較する）", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const agent: AgentInfo = {
      instanceId: "a1",
      kind: "claude",
      label: "Claude Code",
      state: "working",
      completionSeq: 0,
      serverSeenSeq: 0,
      verified: true,
      since: 12345,
    };
    service.updatePaneRuntime(pane.id, { agent });

    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    // 内容は全フィールド同一だが、別オブジェクト（AgentTracker.update が毎回新しいオブジェクトを返すのと同じ形）。
    service.updatePaneRuntime(pane.id, { agent: { ...agent } });
    expect(events).toEqual([]);

    // busy 等と同時に渡っても、agent の中身が同じなら agent_status_changed だけは出ない。
    service.updatePaneRuntime(pane.id, { agent: { ...agent }, busy: true });
    expect(events).toEqual(["pane.updated"]); // busy が変わった分だけ

    // 実際にフィールドが変われば、通常どおり発行される。
    service.updatePaneRuntime(pane.id, { agent: { ...agent, state: "idle", completionSeq: 1 } });
    expect(events).toEqual(["pane.updated", "pane.agent_status_changed"]);
  });

  it("updatePaneRuntime schedules a save only when cwd changes", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    persist.touchCount = 0;
    service.updatePaneRuntime(pane.id, { busy: true });
    expect(persist.touchCount).toBe(0);
    service.updatePaneRuntime(pane.id, { cwd: "/new/dir" });
    expect(persist.touchCount).toBe(1);
  });

  it("focusPane emits session.focus_changed", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: pane2 } = await service.createWorkspace("/home/u", "second");
    const events: { event: string; data: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    service.focusPane(pane.id);
    expect(events).toEqual([{ event: "session.focus_changed", data: { focus: expect.objectContaining({ paneId: pane.id }) } }]);
    void pane2;
  });
});

describe("SessionService — startup and restore", () => {
  it("ensureNotEmpty creates a workspace only when the model is empty", async () => {
    const terminals = new FakeTerminalManager();
    const bus = new EventBus();
    const persist = new FakePersistScheduler();
    const service = makeService(terminals, bus, persist);
    await service.ensureNotEmpty();
    expect(service.snapshot().workspaces.length).toBe(1);
    await service.ensureNotEmpty(); // 既にあるので何もしない
    expect(service.snapshot().workspaces.length).toBe(1);
  });

  it("restore recreates workspaces/tabs/panes and marks a failed shell without throwing", async () => {
    const terminals = new FakeTerminalManager();
    const bus = new EventBus();
    const persist = new FakePersistScheduler();
    const service = makeService(terminals, bus, persist);

    const data: SessionFileData = {
      schema: 1,
      savedAt: "2026-09-18T00:00:00Z",
      nextId: { w: 2, t: 2, p: 3, s: 1, a: 1 },
      workspaces: [
        {
          id: "w1",
          label: "api",
          cwd: "/home/u/api",
          activeTabId: "t1",
          tabs: [
            {
              id: "t1",
              label: "agents",
              focusedPaneId: "p1",
              zoomedPaneId: null,
              layout: {
                type: "split",
                id: "s1",
                dir: "right",
                ratio: 0.5,
                a: { type: "pane", paneId: "p1" },
                b: { type: "pane", paneId: "p2" },
              },
              panes: [
                { id: "p1", label: null, cwd: "/home/u/api", shell: "/bin/bash" },
                { id: "p2", label: null, cwd: "/home/u/api", shell: "/bin/bash" },
              ],
            },
          ],
        },
      ],
      focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
    };

    terminals.nextSpawnFailure = 1; // p1 の起動を失敗させる（p2 は成功する）
    await service.restore(data);

    const snap = service.snapshot();
    expect(snap.workspaces.map((w) => w.id)).toEqual(["w1"]);
    const p1 = snap.panes.find((p) => p.id === "p1")!;
    const p2 = snap.panes.find((p) => p.id === "p2")!;
    expect(p1.status).toBe("failed");
    expect(p1.failure).toBeTruthy();
    expect(p2.status).toBe("running");
    expect(snap.focus).toEqual({ workspaceId: "w1", tabId: "t1", paneId: "p1" });

    // 復元後の新規採番が、保存されていた nextId から続く。
    const { workspace } = await service.createWorkspace("/home/u", "new");
    expect(workspace.id).toBe("w2");
  });
});
