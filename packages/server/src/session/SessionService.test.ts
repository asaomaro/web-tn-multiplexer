import type { AgentInfo, HostInfo, LayoutNode } from "@wtm/protocol";
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
import type { NewCwdDeps } from "./newCwd.js";
import type { WorkspaceLabelDeps } from "./workspaceLabel.js";
import type { SessionFileData } from "../persist/SessionFile.js";

/** 即座に失敗させたい pane の id を登録しておける偽の TerminalManager（T17「テスト方針」）。 */
class FakeTerminalHost implements TerminalHost {
  readonly pid = 4242;
  readonly mirror = {} as TerminalHost["mirror"];
  readonly fanout = {} as TerminalHost["fanout"];
  private readonly exitListeners = new Set<(code: number) => void>();
  disposed = false;
  resized: { cols: number; rows: number } | null = null;
  /** 20260923-agent-session-resume：復元時の resume コマンド投入を確かめるため、書き込みを記録する。 */
  writes: (string | Uint8Array)[] = [];

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
  write(input: string | Uint8Array): void {
    this.writes.push(input);
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

/**
 * 名前を決める偽の依存（20260921-workspace-auto-label）。`gitRoots` の下（とその階層）は git のリポジトリ（`.git/HEAD` がある）とみなす。
 * `/home/u` はホーム。stat を保留にしたいテストは `stat` を差し替える。
 */
function fakeLabelDeps(gitRoots: string[] = []): WorkspaceLabelDeps {
  const files = new Set(gitRoots.map((r) => `${r}/.git/HEAD`));
  const dirs = new Set(gitRoots.map((r) => `${r}/.git`));
  return {
    stat: async (p) => (files.has(p) ? { isDirectory: false, isFile: true } : dirs.has(p) ? { isDirectory: true, isFile: false } : null),
    readFile: async () => null,
    home: () => "/home/u",
  };
}

function makeService(
  terminals: FakeTerminalManager,
  bus: EventBus,
  persist: FakePersistScheduler,
  shell?: string,
  workspaceLabelDeps?: WorkspaceLabelDeps,
) {
  return new SessionService({
    shell,
    workspaceLabelDeps,
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
      nextId: { w: 2, t: 2, p: 2, s: 1, a: 1, g: 1 },
      groups: [],
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

  // 20260923-pane-name-dnd-swap：ドラッグでの入れ替え。design「3. サーバ側」。
  it("swapPaneWith: 入れ替えに成功すると layout.updated を publish し保存を予約する", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: other } = await service.splitPane(pane.id, "right", undefined);
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    persist.touchCount = 0;

    const ok = service.swapPaneWith(pane.id, other.id);

    expect(ok).toBe(true);
    expect(events).toEqual(["layout.updated"]);
    expect(persist.touchCount).toBe(1);
  });

  it("swapPaneWith: 何も起きなかったときは publish も保存の予約もしない", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    persist.touchCount = 0;

    const ok = service.swapPaneWith(pane.id, pane.id); // 同じ pane 同士

    expect(ok).toBe(false);
    expect(events).toEqual([]);
    expect(persist.touchCount).toBe(0);
  });

  // 20260924-pane-dnd-split-move：ドラッグでの分割。design「振る舞いの詳細 > サーバ側」。
  it("moveToEdge: 成功すると layout.updated を publish し保存を予約する", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: other } = await service.splitPane(pane.id, "right", undefined);
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    persist.touchCount = 0;

    const ok = service.moveToEdge(other.id, pane.id, "top");

    expect(ok).toBe(true);
    expect(events).toEqual(["layout.updated"]);
    expect(persist.touchCount).toBe(1);
  });

  it("moveToEdge: 何も起きなかったときは publish も保存の予約もしない", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    persist.touchCount = 0;

    const ok = service.moveToEdge(pane.id, pane.id, "top"); // 自分自身の縁

    expect(ok).toBe(false);
    expect(events).toEqual([]);
    expect(persist.touchCount).toBe(0);
  });

  // 20260924-pane-dnd-split-move：ドラッグでの分割解除。ドロップ先のプロセスは実際に終了する。
  it("replacePane: ドロップ先のプロセスを破棄し、pane.closed → layout.updated の順に publish する", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: other } = await service.splitPane(pane.id, "right", undefined);
    const host = terminals.get(other.id) as FakeTerminalHost;
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    persist.touchCount = 0;

    const ok = service.replacePane(pane.id, other.id);

    expect(ok).toBe(true);
    expect(host.disposed).toBe(true);
    expect(events).toEqual(["pane.closed", "layout.updated"]);
    expect(persist.touchCount).toBe(1);
  });

  // 20260925-pane-replace-focus-hint。
  it("replacePane: 発行する pane.closed の successorPaneId は生存した pane（ドラッグした pane）を指す（AC2）", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: other } = await service.splitPane(pane.id, "right", undefined);
    const paneClosedData: { paneId: string; successorPaneId?: string }[] = [];
    bus.subscribe((e) => {
      if (e.event === "pane.closed") paneClosedData.push(e.data);
    });

    service.replacePane(pane.id, other.id);

    expect(paneClosedData).toEqual([{ paneId: other.id, successorPaneId: pane.id }]);
  });

  // `toEqual` は「キーが無い」と「値が undefined」を区別しないため、`successorPaneId` の
  // **キー自体が無い**ことは `Object.hasOwn` で確認する（taskcheck T3 round1 の must 指摘：
  // 元の `toEqual({ successorPaneId: undefined })` は無効な回帰テストだった）。
  it("closePane: 発行する pane.closed に successorPaneId のキー自体が含まれない（回帰。AC3）", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const { pane: other } = await service.splitPane(pane.id, "right", undefined);
    const paneClosedData: { paneId: string; successorPaneId?: string }[] = [];
    bus.subscribe((e) => {
      if (e.event === "pane.closed") paneClosedData.push(e.data);
    });

    await service.closePane(other.id);

    expect(paneClosedData).toHaveLength(1);
    expect(Object.hasOwn(paneClosedData[0]!, "successorPaneId")).toBe(false);
  });

  it("closeTab: 発行する pane.closed に successorPaneId のキー自体が含まれない（回帰。AC3）", async () => {
    const { workspace } = await service.createWorkspace("/home/u", "api");
    const { tab, pane: tabPane } = await service.createTab(workspace.id, undefined);
    await service.splitPane(tabPane.id, "right", undefined); // この tab に2枚目の pane を作る
    const paneClosedData: { paneId: string; successorPaneId?: string }[] = [];
    bus.subscribe((e) => {
      if (e.event === "pane.closed") paneClosedData.push(e.data);
    });

    await service.closeTab(tab.id);

    expect(paneClosedData.length).toBeGreaterThan(0);
    for (const data of paneClosedData) expect(Object.hasOwn(data, "successorPaneId")).toBe(false);
  });

  it("closeWorkspace: 発行する pane.closed に successorPaneId のキー自体が含まれない（回帰。AC3）", async () => {
    const { workspace, pane } = await service.createWorkspace("/home/u", "api");
    await service.splitPane(pane.id, "right", undefined);
    const paneClosedData: { paneId: string; successorPaneId?: string }[] = [];
    bus.subscribe((e) => {
      if (e.event === "pane.closed") paneClosedData.push(e.data);
    });

    await service.closeWorkspace(workspace.id);

    expect(paneClosedData.length).toBeGreaterThan(0);
    for (const data of paneClosedData) expect(Object.hasOwn(data, "successorPaneId")).toBe(false);
  });

  it("replacePane: 何も起きなかったときはプロセスを破棄せず publish も保存の予約もしない", async () => {
    const { pane } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));
    persist.touchCount = 0;

    const ok = service.replacePane(pane.id, pane.id); // 自分自身

    expect(ok).toBe(false);
    expect(events).toEqual([]);
    expect(persist.touchCount).toBe(0);
  });

  // 20260924-pane-move-cross-tab：D&D での別 tab・別 workspace への移動。
  // design「振る舞いの詳細 > 複数クライアントでの同期」・decisions.md D3（pane.updated の追加）。
  describe("moveToTab", () => {
    it("移動元 tab に他の pane が残るとき: pane.updated → layout.updated（移動元）→ layout.updated（移動先）の順に publish する", async () => {
      const { pane: p1, tab: t1 } = await service.createWorkspace("/home/u", "api");
      const { pane: p2 } = await service.splitPane(p1.id, "right", undefined);
      const { tab: t2 } = await service.createTab(t1.workspaceId, undefined);
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const ok = service.moveToTab(p2.id, t2.id);

      expect(ok).toBe(true);
      expect(events).toEqual(["pane.updated", "layout.updated", "layout.updated"]);
      expect(service.snapshot().panes.find((p) => p.id === p2.id)?.tabId).toBe(t2.id);
      expect(persist.touchCount).toBe(1);
    });

    it("移動元 tab がその1枚だけの pane を失って空になるとき: workspace が生き残れば tab.closed → workspace.updated を publish する", async () => {
      const { tab: t1 } = await service.createWorkspace("/home/u", "api");
      const { tab: t2, pane: p2 } = await service.createTab(t1.workspaceId, undefined);
      const { tab: t3 } = await service.createTab(t1.workspaceId, undefined);
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const ok = service.moveToTab(p2.id, t3.id);

      expect(ok).toBe(true);
      expect(events).toEqual(["pane.updated", "tab.closed", "workspace.updated", "layout.updated"]);
      expect(service.snapshot().tabs.map((t) => t.id)).not.toContain(t2.id);
      expect(service.snapshot().workspaces.map((w) => w.id)).toContain(t1.workspaceId); // workspace は生き残る
    });

    it("移動元 workspace も連鎖して空になるとき（D18）: tab.closed → workspace.closed を publish する", async () => {
      const { workspace: w1, pane: p1, tab: t1 } = await service.createWorkspace("/home/u", "api");
      const { workspace: w2, tab: t2 } = await service.createWorkspace("/home/u/other", "other");
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const ok = service.moveToTab(p1.id, t2.id);

      expect(ok).toBe(true);
      expect(events).toEqual(["pane.updated", "tab.closed", "workspace.closed", "layout.updated"]);
      expect(service.snapshot().tabs.map((t) => t.id)).not.toContain(t1.id);
      expect(service.snapshot().workspaces.map((w) => w.id)).not.toContain(w1.id);
      expect(service.snapshot().workspaces.map((w) => w.id)).toContain(w2.id);
    });

    it("自分自身の tab など何も起きなかったときは publish も保存の予約もしない", async () => {
      const { pane, tab } = await service.createWorkspace("/home/u", "api");
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const ok = service.moveToTab(pane.id, tab.id); // 自分自身の tab

      expect(ok).toBe(false);
      expect(events).toEqual([]);
      expect(persist.touchCount).toBe(0);
    });
  });

  describe("moveToNewTab", () => {
    it("別 workspace への移動: pane.updated → tab.created → workspace.updated（移動先）→ layout.updated（移動元。生きていれば）の順に publish する", async () => {
      const { pane: p1, tab: t1 } = await service.createWorkspace("/home/u", "api");
      const { pane: p2 } = await service.splitPane(p1.id, "right", undefined);
      const { workspace: w2 } = await service.createWorkspace("/home/u/other", "other");
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const newTab = service.moveToNewTab(p2.id, w2.id);

      expect(newTab).not.toBeNull();
      expect(newTab?.workspaceId).toBe(w2.id);
      expect(events).toEqual(["pane.updated", "tab.created", "workspace.updated", "layout.updated"]);
      expect(service.snapshot().panes.find((p) => p.id === p2.id)?.tabId).toBe(newTab?.id);
      expect(service.snapshot().tabs.map((t) => t.id)).toContain(t1.id); // 移動元 tab は生き残る（p1 が残る）
    });

    it("同一 workspace 内で、移動元 tab がその1枚だけの pane を失っても正しく畳まれる（他の tab は残る）", async () => {
      const { workspace: w1, tab: t1, pane: p1 } = await service.createWorkspace("/home/u", "api");
      const { tab: t2 } = await service.createTab(w1.id, undefined);
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const newTab = service.moveToNewTab(p1.id, w1.id); // 移動先 workspace == 移動元 workspace

      expect(newTab).not.toBeNull();
      // 移動元と移動先が同じ workspace なので、workspace.updated は1回だけ（二重に発行しない。D3 の続き）。
      expect(events).toEqual(["pane.updated", "tab.created", "workspace.updated", "tab.closed"]);
      expect(service.snapshot().tabs.map((t) => t.id)).not.toContain(t1.id); // 唯一の pane を失った移動元 tab は畳まれる
      expect(service.snapshot().tabs.map((t) => t.id)).toContain(t2.id); // 他の tab は残る
      expect(service.snapshot().workspaces.map((w) => w.id)).toContain(w1.id);
    });

    it("存在しない workspace など何も起きなかったときは publish も保存の予約もしない", async () => {
      const { pane } = await service.createWorkspace("/home/u", "api");
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const newTab = service.moveToNewTab(pane.id, "w-nope");

      expect(newTab).toBeNull();
      expect(events).toEqual([]);
      expect(persist.touchCount).toBe(0);
    });

    it("移動元 workspace も連鎖して空になるとき（D18）: tab.closed → workspace.closed を publish する（moveToTab と同じ分岐。taskcheck 指摘）", async () => {
      const { workspace: w1, pane: p1, tab: t1 } = await service.createWorkspace("/home/u", "api");
      const { workspace: w2 } = await service.createWorkspace("/home/u/other", "other");
      const events: string[] = [];
      bus.subscribe((e) => events.push(e.event));
      persist.touchCount = 0;

      const newTab = service.moveToNewTab(p1.id, w2.id); // w1 の唯一の tab の唯一の pane を、別 workspace へ

      expect(newTab).not.toBeNull();
      expect(events).toEqual(["pane.updated", "tab.created", "workspace.updated", "tab.closed", "workspace.closed"]);
      expect(service.snapshot().tabs.map((t) => t.id)).not.toContain(t1.id);
      expect(service.snapshot().workspaces.map((w) => w.id)).not.toContain(w1.id);
      expect(service.snapshot().workspaces.map((w) => w.id)).toContain(w2.id);
    });
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

  it("moveTab emits workspace.updated with the reordered tabIds (20260923-missing-keybinding-actions)", async () => {
    const { workspace, tab: firstTab } = await service.createWorkspace("/home/u", "api");
    const { tab: secondTab } = await service.createTab(workspace.id, "second");
    const events: { event: string; workspace?: { id: string; tabIds: string[] } }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspace?: { id: string; tabIds: string[] } }) }));

    service.moveTab(firstTab.id, "next");

    const wsUpdated = events.filter((e) => e.event === "workspace.updated");
    expect(wsUpdated).toHaveLength(1);
    expect(wsUpdated[0]!.workspace?.tabIds).toEqual([secondTab.id, firstTab.id]);
  });

  it("moveTab does not emit workspace.updated when the workspace has only one tab (AC5)", async () => {
    const { workspace, tab } = await service.createWorkspace("/home/u", "api");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    service.moveTab(tab.id, "next");

    expect(events).toEqual([]);
    expect(service.snapshot().workspaces.find((w) => w.id === workspace.id)?.tabIds).toEqual([tab.id]);
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

// 20260923-workspace-grouping。
describe("SessionService — workspace grouping and ordering", () => {
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

  it("moveWorkspace emits workspace.order_changed with the reordered ids", async () => {
    const { workspace: w1 } = await service.createWorkspace("/a", "a");
    const { workspace: w2 } = await service.createWorkspace("/b", "b");
    const events: { event: string; workspaceIds?: string[] }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspaceIds?: string[] }) }));

    service.moveWorkspace(w1.id, "next");

    const orderChanged = events.filter((e) => e.event === "workspace.order_changed");
    expect(orderChanged).toHaveLength(1);
    expect(orderChanged[0]!.workspaceIds).toEqual([w2.id, w1.id]);
  });

  it("moveWorkspace does not emit anything when there is only one workspace", async () => {
    await service.createWorkspace("/a", "a");
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    service.moveWorkspace((await service.snapshot()).workspaces[0]!.id, "next");

    expect(events).toEqual([]);
  });

  it("moveWorkspacesTo moves a block of ids together and emits workspace.order_changed once", async () => {
    const { workspace: w1 } = await service.createWorkspace("/a", "a");
    const { workspace: w2 } = await service.createWorkspace("/b", "b");
    const { workspace: w3 } = await service.createWorkspace("/c", "c");
    const events: { event: string; workspaceIds?: string[] }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspaceIds?: string[] }) }));

    service.moveWorkspacesTo([w2.id, w3.id], w1.id);

    const orderChanged = events.filter((e) => e.event === "workspace.order_changed");
    expect(orderChanged).toHaveLength(1);
    expect(orderChanged[0]!.workspaceIds).toEqual([w2.id, w3.id, w1.id]);
  });

  it("group.* CRUD: create/rename/toggleGroupCollapsed publish group.created/group.updated; add/removeFromGroup publish workspace.updated", async () => {
    const { workspace } = await service.createWorkspace("/a", "a");
    const events: { event: string; group?: { id: string; label: string; collapsed: boolean }; workspace?: { groupId: string | null } }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { group?: { id: string; label: string; collapsed: boolean }; workspace?: { groupId: string | null } }) }));

    const group = service.createGroup("backend");
    expect(events.at(-1)).toEqual({ event: "group.created", group });

    service.renameGroup(group.id, "frontend");
    expect(events.at(-1)?.event).toBe("group.updated");
    expect(events.at(-1)?.group?.label).toBe("frontend");

    service.toggleGroupCollapsed(group.id);
    expect(events.at(-1)).toEqual({ event: "group.updated", group: { id: group.id, label: "frontend", collapsed: true } });
    service.toggleGroupCollapsed(group.id); // もう一度で戻る（競合しない。タスク点検の指摘）
    expect(events.at(-1)).toEqual({ event: "group.updated", group: { id: group.id, label: "frontend", collapsed: false } });

    service.addToGroup(workspace.id, group.id);
    expect(events.at(-1)?.event).toBe("workspace.updated");
    expect(events.at(-1)?.workspace?.groupId).toBe(group.id);

    service.removeFromGroup(workspace.id);
    expect(events.at(-1)?.event).toBe("workspace.updated");
    expect(events.at(-1)?.workspace?.groupId).toBeNull();
  });

  it("deleteGroup publishes group.deleted, then workspace.updated for every member whose groupId is cleared", async () => {
    const { workspace: w1 } = await service.createWorkspace("/a", "a");
    const { workspace: w2 } = await service.createWorkspace("/b", "b");
    const group = service.createGroup("backend");
    service.addToGroup(w1.id, group.id);
    service.addToGroup(w2.id, group.id);
    const events: { event: string; groupId?: string; workspace?: { id: string; groupId: string | null } }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { groupId?: string; workspace?: { id: string; groupId: string | null } }) }));

    service.deleteGroup(group.id);

    expect(events[0]).toEqual({ event: "group.deleted", groupId: group.id });
    const wsUpdated = events.filter((e) => e.event === "workspace.updated");
    expect(wsUpdated.map((e) => e.workspace?.id).sort()).toEqual([w1.id, w2.id].sort());
    for (const e of wsUpdated) expect(e.workspace?.groupId).toBeNull();
  });

  it("closeWorkspace(closeLinkedWorktrees=true) also closes every linked worktree sharing the same repoKey (herdr の close_group 相当)", async () => {
    const { workspace: main, pane: mainPane } = await service.createWorkspace("/repo", "main");
    const { workspace: wt, pane: wtPane } = await service.createWorkspace("/repo-wt", "wt");
    service.updateWorkspaceGit(main.id, { branch: "main", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: false });
    service.updateWorkspaceGit(wt.id, { branch: "feature", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: true });
    const [mainHost, wtHost] = [mainPane.id, wtPane.id].map((id) => terminals.get(id) as FakeTerminalHost); // dispose 前に控える
    const events: { event: string; workspaceId?: string }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspaceId?: string }) }));

    await service.closeWorkspace(main.id, true);

    const closedIds = events.filter((e) => e.event === "workspace.closed").map((e) => e.workspaceId);
    expect(closedIds.sort()).toEqual([main.id, wt.id].sort());
    expect(mainHost!.disposed).toBe(true);
    expect(wtHost!.disposed).toBe(true);
  });

  it("closeWorkspace(closeLinkedWorktrees=true) closes only the target when it has no linked worktrees", async () => {
    const { workspace } = await service.createWorkspace("/plain", "plain");
    const events: { event: string; workspaceId?: string }[] = [];
    bus.subscribe((e) => events.push({ event: e.event, ...(e.data as { workspaceId?: string }) }));

    await service.closeWorkspace(workspace.id, true);

    expect(events.filter((e) => e.event === "workspace.closed").map((e) => e.workspaceId)).toEqual([workspace.id]);
  });

  it("closeWorkspace without closeLinkedWorktrees (既定 false) leaves the linked worktree open (回帰なし)", async () => {
    const { workspace: main } = await service.createWorkspace("/repo", "main");
    const { workspace: wt } = await service.createWorkspace("/repo-wt", "wt");
    service.updateWorkspaceGit(main.id, { branch: "main", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: false });
    service.updateWorkspaceGit(wt.id, { branch: "feature", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: true });

    await service.closeWorkspace(main.id);

    expect(service.snapshot().workspaces.map((w) => w.id)).toContain(wt.id);
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

  // 20260923-workspace-grouping。タスク点検の指摘：sameGit が repoKey/isLinkedWorktree を比較して
  // いなかったため、branch/ahead/behind が同じまま repoKey/isLinkedWorktree だけ変わるケース
  // （worktree 自動グループの判定の要）で更新が握りつぶされていた。
  it("updateWorkspaceGit emits workspace.updated when only repoKey changes (branch/ahead/behind unchanged)", async () => {
    const { workspace } = await service.createWorkspace("/repo", "repo");
    service.updateWorkspaceGit(workspace.id, { branch: "main", ahead: 0, behind: 0, repoKey: null, isLinkedWorktree: false });
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    service.updateWorkspaceGit(workspace.id, { branch: "main", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: false });

    expect(events).toEqual(["workspace.updated"]);
    expect(service.snapshot().workspaces[0]!.git?.repoKey).toBe("/repo/.git");
  });

  it("updateWorkspaceGit emits workspace.updated when only isLinkedWorktree changes", async () => {
    const { workspace } = await service.createWorkspace("/repo-wt", "wt");
    service.updateWorkspaceGit(workspace.id, { branch: "feature", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: false });
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    service.updateWorkspaceGit(workspace.id, { branch: "feature", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: true });

    expect(events).toEqual(["workspace.updated"]);
    expect(service.snapshot().workspaces[0]!.git?.isLinkedWorktree).toBe(true);
  });

  it("updateWorkspaceGit is a no-op when nothing (including repoKey/isLinkedWorktree) changes", async () => {
    const { workspace } = await service.createWorkspace("/repo", "repo");
    const git = { branch: "main", ahead: 0, behind: 0, repoKey: "/repo/.git", isLinkedWorktree: false };
    service.updateWorkspaceGit(workspace.id, git);
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.event));

    service.updateWorkspaceGit(workspace.id, { ...git });

    expect(events).toEqual([]);
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
      nextId: { w: 2, t: 2, p: 3, s: 1, a: 1, g: 1 },
      groups: [],
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

  // 20260923-workspace-grouping。
  it("restore rebuilds manual groups and each workspace's groupId, and new group ids continue from nextId.g", async () => {
    const terminals = new FakeTerminalManager();
    const bus = new EventBus();
    const persist = new FakePersistScheduler();
    const service = makeService(terminals, bus, persist);

    const data: SessionFileData = {
      schema: 1,
      savedAt: "2026-09-18T00:00:00Z",
      nextId: { w: 2, t: 2, p: 2, s: 1, a: 1, g: 3 },
      groups: [
        { id: "g1", label: "backend", collapsed: true },
        { id: "g2", label: "frontend", collapsed: false },
      ],
      workspaces: [
        {
          id: "w1",
          label: "api",
          cwd: "/home/u/api",
          activeTabId: "t1",
          groupId: "g1",
          tabs: [
            {
              id: "t1",
              label: "agents",
              focusedPaneId: "p1",
              zoomedPaneId: null,
              layout: { type: "pane", paneId: "p1" },
              panes: [{ id: "p1", label: null, cwd: "/home/u/api", shell: "/bin/bash" }],
            },
          ],
        },
      ],
      focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
    };

    await service.restore(data);

    const snap = service.snapshot();
    expect(snap.groups).toEqual([
      { id: "g1", label: "backend", collapsed: true },
      { id: "g2", label: "frontend", collapsed: false },
    ]);
    expect(snap.workspaces[0]!.groupId).toBe("g1");
    const created = service.createGroup("ops");
    expect(created.id).toBe("g3"); // 保存されていた nextId.g から続く
  });

  // 以前の版の保存には groups・groupId が無い——復元しても空のまま（`autoLabel` と同じ後方互換）。
  it("restoring a legacy file with no groups/groupId leaves groups empty and workspace.groupId null", async () => {
    const terminals = new FakeTerminalManager();
    const bus = new EventBus();
    const persist = new FakePersistScheduler();
    const service = makeService(terminals, bus, persist);

    const data: SessionFileData = {
      schema: 1,
      savedAt: "2026-09-18T00:00:00Z",
      nextId: { w: 2, t: 2, p: 2, s: 1, a: 1, g: 1 },
      groups: [],
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
              layout: { type: "pane", paneId: "p1" },
              panes: [{ id: "p1", label: null, cwd: "/home/u/api", shell: "/bin/bash" }],
            },
          ],
        },
      ],
      focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
    };

    await service.restore(data);

    const snap = service.snapshot();
    expect(snap.groups).toEqual([]);
    expect(snap.workspaces[0]!.groupId).toBeNull();
  });
});

// 20260921-new-terminal-cwd：新しく開く場所の方針（herdr の `terminal.new_cwd`）。場所の規則そのものは `newCwd.test.ts`。
// ここで見るのは、3 つの作成が決めた場所で**起動し、記録（Pane.cwd）もその場所にし**、`cwdFallback` を返し、`cwd` が勝つこと。
describe("SessionService — 新しく開く場所（newCwd）", () => {
  /** 使える場所と、pane ごとの「いまの場所」を持つ偽の deps。 */
  function makeNewCwdService(live: Record<string, string> = {}, usable = ["/home/u", "/home/u/api", "/srv/live", "/tmp/picked", "/start"]) {
    const terminals = new FakeTerminalManager();
    const model = new SessionModel();
    const set = new Set(usable);
    const newCwdDeps: NewCwdDeps = {
      liveCwd: async (id) => live[id] ?? null,
      hintCwd: () => null,
      recordedCwd: (id) => model.getPane(id)?.cwd,
      home: () => "/home/u",
      currentDir: "/start",
      isUsableDir: async (path) => set.has(path),
    };
    const service = new SessionService({
      model,
      terminals,
      bus: new EventBus(),
      persist: new FakePersistScheduler(),
      serverVersion: "0.1.0-test",
      host: HOST_INFO,
      scrollbackLines: 1000,
      spawnGraceMs: 5,
      defaultCwd: "/start",
      logger: new MemoryLogger(),
      newCwdDeps,
      workspaceLabelDeps: fakeLabelDeps(["/home/u/api"]), // /home/u/api は git のリポジトリ（20260921-workspace-auto-label）
    });
    return { service, terminals, model, live };
  }

  it("引き継ぐ：新しい workspace は、元の pane のいまの場所で起動し、workspace と pane の記録もそこになる（AC1）", async () => {
    const h = makeNewCwdService();
    const { pane } = await h.service.createWorkspace("/home/u/api", "api");
    h.live[pane.id] = "/srv/live";
    const r = await h.service.createWorkspace(undefined, undefined, { policy: "follow", sourcePaneId: pane.id });
    expect(h.terminals.createOptions.at(-1)!.cwd).toBe("/srv/live");
    expect(r.workspace.cwd).toBe("/srv/live");
    expect(r.pane.cwd).toBe("/srv/live");
    expect(r.cwdFallback).toBeUndefined();
  });

  // 20260921-workspace-auto-label：自動の名前は、方針で決めた場所（`cd` した先・代わりの場所）から付く。
  it("引き継ぐで開いた新しい workspace の名前は、元の pane のいまの場所の名前。代わりの場所に回ったらその場所の名前", async () => {
    const h = makeNewCwdService();
    const { pane } = await h.service.createWorkspace("/home/u", "home");
    h.live[pane.id] = "/home/u/api";
    const followed = await h.service.createWorkspace(undefined, undefined, { policy: "follow", sourcePaneId: pane.id });
    expect(followed.workspace).toMatchObject({ label: "api", autoLabel: true });
    const fellBack = await h.service.createWorkspace(undefined, undefined, { policy: "path", path: "/nope" });
    expect(fellBack.workspace).toMatchObject({ cwd: "/start", label: "start", autoLabel: true });
  });

  it("引き継ぐ：新しい tab は元の pane のいまの場所で起動し、pane の記録もそこ。workspace の場所は変えない（AC2）", async () => {
    const h = makeNewCwdService();
    const { workspace, pane } = await h.service.createWorkspace("/home/u/api", "api");
    h.live[pane.id] = "/srv/live";
    const r = await h.service.createTab(workspace.id, undefined, { policy: "follow", sourcePaneId: pane.id });
    expect(h.terminals.createOptions.at(-1)!.cwd).toBe("/srv/live");
    expect(r.pane.cwd, "記録も起動と同じ場所").toBe("/srv/live");
    expect(h.model.getWorkspace(workspace.id)!.cwd, "Workspace.cwd は書き換えない（git の情報と worktree が使う）").toBe("/home/u/api");
  });

  it("引き継ぐ：分割は分割する pane のいまの場所で起動し、記録もそこ（AC3）", async () => {
    const h = makeNewCwdService();
    const { workspace, pane } = await h.service.createWorkspace("/home/u/api", "api");
    h.live[pane.id] = "/srv/live";
    const r = await h.service.splitPane(pane.id, "right", undefined, { policy: "follow" });
    expect(h.terminals.createOptions.at(-1)!.cwd).toBe("/srv/live");
    expect(r.pane.cwd).toBe("/srv/live");
    expect(h.model.getWorkspace(workspace.id)!.cwd, "Workspace.cwd は書き換えない").toBe("/home/u/api");
  });

  it("ホーム・起動した場所・指定した場所で起動する（AC6〜AC8）", async () => {
    const h = makeNewCwdService();
    const { workspace, pane } = await h.service.createWorkspace("/home/u/api", "api");
    await h.service.createTab(workspace.id, undefined, { policy: "home" });
    await h.service.splitPane(pane.id, "down", undefined, { policy: "current" });
    await h.service.createWorkspace(undefined, undefined, { policy: "path", path: "/tmp/picked" });
    expect(h.terminals.createOptions.slice(-3).map((o) => o.cwd)).toEqual(["/home/u", "/start", "/tmp/picked"]);
  });

  it("指定した場所が使えなければ以前と同じ場所で起動し、cwdFallback を返す（AC9）", async () => {
    const h = makeNewCwdService();
    const { workspace, pane } = await h.service.createWorkspace("/home/u/api", "api");
    const tab = await h.service.createTab(workspace.id, undefined, { policy: "path", path: "/nope" });
    expect(tab.pane.cwd, "tab は workspace の場所").toBe("/home/u/api");
    expect(tab.cwdFallback).toBe(true);
    const split = await h.service.splitPane(pane.id, "right", undefined, { policy: "path", path: "/nope" });
    expect(split.pane.cwd, "分割は元の pane の記録").toBe("/home/u/api");
    expect(split.cwdFallback).toBe(true);
    const created = await h.service.createWorkspace(undefined, undefined, { policy: "path", path: "/nope" });
    expect(h.terminals.createOptions.at(-1)!.cwd, "workspace はサーバを起動した場所").toBe("/start");
    expect(created.workspace.cwd).toBe("/start");
    expect(created.cwdFallback).toBe(true);
  });

  it("引き継ぐで代わりへ回っても cwdFallback は返さない（知らせない。AC5）", async () => {
    const h = makeNewCwdService();
    const { workspace } = await h.service.createWorkspace("/home/u/api", "api");
    const r = await h.service.createTab(workspace.id, undefined, { policy: "follow" }); // 元の pane が無い
    expect(r.pane.cwd).toBe("/home/u/api");
    expect(r.cwdFallback).toBeUndefined();
  });

  // **worktree を開く経路**（AC11・design D5）。明示した場所が方針に勝ち、代わりへも回さない。
  it("明示した cwd は newCwd に勝ち、検証も代わりもしない", async () => {
    const h = makeNewCwdService();
    const r = await h.service.createWorkspace("/repo/.wtm/worktrees/feat", "feat", { policy: "home" });
    expect(h.terminals.createOptions.at(-1)!.cwd).toBe("/repo/.wtm/worktrees/feat"); // 偽の isUsableDir では使えない場所でも
    expect(r.workspace.cwd).toBe("/repo/.wtm/worktrees/feat");
    expect(r.cwdFallback).toBeUndefined();
  });

  // 本番の `SessionService` は必ず deps を持つので、`newCwd` を載せないクライアント（テストのクライアント・古い web）はこの組（design D5）。
  it("newCwdDeps があっても、要求に newCwd が無ければ今までどおり", async () => {
    const h = makeNewCwdService();
    const { workspace, pane } = await h.service.createWorkspace("/home/u/api", "api");
    h.live[pane.id] = "/srv/live"; // 読み直せば別の場所になる状態でも見ない
    const tab = await h.service.createTab(workspace.id, undefined);
    const split = await h.service.splitPane(pane.id, "right", undefined);
    const created = await h.service.createWorkspace(undefined, undefined);
    expect(h.terminals.createOptions.slice(-3).map((o) => o.cwd)).toEqual(["/home/u/api", "/home/u/api", "/start"]);
    expect([tab.cwdFallback, split.cwdFallback, created.cwdFallback]).toEqual([undefined, undefined, undefined]);
  });

  it("newCwdDeps が無ければ newCwd を見ない（今までどおり）", async () => {
    const terminals = new FakeTerminalManager();
    const service = makeService(terminals, new EventBus(), new FakePersistScheduler());
    const { workspace } = await service.createWorkspace(undefined, undefined, { policy: "home" });
    expect(terminals.createOptions.at(-1)!.cwd, "defaultCwd").toBe("/home/u");
    await service.createTab(workspace.id, undefined, { policy: "path", path: "/tmp/picked" });
    expect(terminals.createOptions.at(-1)!.cwd, "workspace の場所").toBe("/home/u");
  });

  // 方針を決める間（await の間）に分割元が閉じられたら、シェルを起動する前に失敗し、孤児の PTY を残さない。
  it("方針を決める間に分割元が閉じられたら、分割のシェルを起動せずに失敗する", async () => {
    const h = makeNewCwdService();
    const { pane } = await h.service.createWorkspace("/home/u/api", "api");
    const spawnsBefore = h.terminals.createOptions.length;
    const splitting = h.service.splitPane(pane.id, "right", undefined, { policy: "follow" });
    const closing = h.service.closePane(pane.id); // 唯一の pane なので、D24 で代わりの workspace が自動で作られる（その PTY は正当）
    await expect(splitting).rejects.toThrow();
    await closing;
    expect(h.terminals.createOptions.length, "起動したのは D24 の代わりの workspace だけ").toBe(spawnsBefore + 1);
    // **モデルに無い pane の PTY が生きたまま残っていない**（分割で起動した PTY は破棄されている）。
    const orphans = [...h.terminals.hosts.entries()].filter(([id, host]) => !(host as FakeTerminalHost).disposed && !h.model.getPane(id));
    expect(orphans.map(([id]) => id)).toEqual([]);
  });
});

// 20260921-workspace-auto-label：名前を渡さない作成は、開く場所から自動の名前を付ける（design D4b・D10）。
describe("SessionService — workspace の自動の名前", () => {
  function setup(gitRoots: string[] = ["/r"]) {
    const terminals = new FakeTerminalManager();
    const bus = new EventBus();
    const created: string[] = [];
    bus.subscribe((e) => {
      if (e.event === "workspace.created") created.push(e.data.workspace.label);
    });
    const service = makeService(terminals, bus, new FakePersistScheduler(), undefined, fakeLabelDeps(gitRoots));
    return { terminals, bus, created, service };
  }

  it("名前を渡さないと、git の中なら根の名前・外ならフォルダ名・ホームなら ~ で、最初から付いている（AC1・AC3・AC9）", async () => {
    const h = setup();
    const inRepo = await h.service.createWorkspace("/r/src/deep", undefined);
    const outside = await h.service.createWorkspace("/srv/app", undefined);
    const home = await h.service.createWorkspace("/home/u", undefined);
    expect([inRepo.workspace.label, outside.workspace.label, home.workspace.label]).toEqual(["r", "app", "~"]);
    expect([inRepo.workspace.autoLabel, outside.workspace.autoLabel, home.workspace.autoLabel]).toEqual([true, true, true]);
    expect(h.created, "workspace.created にも最初から自動の名前（「1」を経ない）").toEqual(["r", "app", "~"]);
  });

  it("名前を渡せば付けた名前。空白だけの名前は自動の名前（design D10）", async () => {
    const h = setup();
    const named = await h.service.createWorkspace("/r/src", "feat/x");
    const blank = await h.service.createWorkspace("/r/src", "   ");
    expect(named.workspace).toMatchObject({ label: "feat/x", autoLabel: false });
    expect(blank.workspace).toMatchObject({ label: "r", autoLabel: true });
  });

  it("起動時の最初の workspace と、最後を閉じた後の作り直しも自動の名前（AC4）", async () => {
    const terminals = new FakeTerminalManager();
    const service = new SessionService({
      model: new SessionModel(),
      terminals,
      bus: new EventBus(),
      persist: new FakePersistScheduler(),
      serverVersion: "0.1.0-test",
      host: HOST_INFO,
      scrollbackLines: 1000,
      spawnGraceMs: 5,
      defaultCwd: "/r/packages/e2e",
      logger: new MemoryLogger(),
      workspaceLabelDeps: fakeLabelDeps(["/r"]),
    });
    await service.ensureNotEmpty();
    const [first] = service.snapshot().workspaces;
    expect(first).toMatchObject({ label: "r", autoLabel: true });
    await service.closeWorkspace(first!.id); // D24：最後を閉じると作り直す
    const [again] = service.snapshot().workspaces;
    expect(again!.id).not.toBe(first!.id);
    expect(again).toMatchObject({ label: "r", autoLabel: true });
  });

  // 起動の成功から commit までの間に await を挟まない（decisions D1）——名前を決めている間は、シェルを起動せず何も知らせない。
  it("名前を決めている間は起動も知らせもせず、決まってから起動する", async () => {
    const h = setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const base = fakeLabelDeps(["/r"]);
    const slow: WorkspaceLabelDeps = { ...base, timeoutMs: 60_000, stat: async (p) => (await gate, base.stat(p)) };
    const service = makeService(h.terminals, h.bus, new FakePersistScheduler(), undefined, slow);
    const creating = service.createWorkspace("/r/src", undefined);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.terminals.createOptions, "名前が決まる前にシェルを起動しない").toEqual([]);
    expect(h.created).toEqual([]);
    release();
    const { workspace } = await creating;
    expect(h.terminals.createOptions).toHaveLength(1);
    expect(workspace.label).toBe("r");
  });

  describe("名前変更（design D5・D9・D10）", () => {
    it("付けた名前は autoLabel: false、null と空白だけは開いた場所から決め直した自動の名前に戻る（AC6）", async () => {
      const h = setup();
      const updated: { label: string; autoLabel: boolean }[] = [];
      h.bus.subscribe((e) => {
        if (e.event === "workspace.updated") updated.push({ label: e.data.workspace.label, autoLabel: e.data.workspace.autoLabel });
      });
      const { workspace } = await h.service.createWorkspace("/r/src", undefined);
      await h.service.renameWorkspace(workspace.id, "mine");
      await h.service.renameWorkspace(workspace.id, null);
      await h.service.renameWorkspace(workspace.id, "again");
      await h.service.renameWorkspace(workspace.id, "  ");
      expect(updated).toEqual([
        { label: "mine", autoLabel: false },
        { label: "r", autoLabel: true },
        { label: "again", autoLabel: false },
        { label: "r", autoLabel: true },
      ]);
    });

    it("名前変更は、名前を入れたときに保存を予約する（null で戻すときも）", async () => {
      const persist = new FakePersistScheduler();
      const service = makeService(new FakeTerminalManager(), new EventBus(), persist, undefined, fakeLabelDeps(["/r"]));
      const { workspace } = await service.createWorkspace("/r/src", "mine");
      const before = persist.touchCount;
      await service.renameWorkspace(workspace.id, null);
      expect(persist.touchCount - before).toBe(1);
    });

    it("要求の時点で無い workspace は not_found で拒否する", async () => {
      const h = setup();
      await expect(h.service.renameWorkspace("w999", "x")).rejects.toThrow(/w999/);
      await expect(h.service.renameWorkspace("w999", null)).rejects.toThrow(/w999/);
    });

    // 自動の名前を決めている間に付けた名前が来たら、後から来た付けた名前が勝つ（古い自動の名前で上書きしない）。
    /** 名前を決める stat を `release` まで保留する service（作成は名前を渡して deps を通らないようにする）。 */
    function gated() {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => (release = r));
      const base = fakeLabelDeps(["/r"]);
      const slow: WorkspaceLabelDeps = { ...base, timeoutMs: 60_000, stat: async (path) => (await gate, base.stat(path)) };
      const terminals = new FakeTerminalManager();
      const bus = new EventBus();
      const persist = new FakePersistScheduler();
      const service = makeService(terminals, bus, persist, undefined, slow);
      return { service, bus, persist, release: () => release() };
    }

    it("自動の名前に戻す待ちの間に名前を付けたら、付けた名前が勝つ（捨てた結果では保存を予約しない）", async () => {
      const h = gated();
      const { workspace } = await h.service.createWorkspace("/r/src", "first");
      const touches = h.persist.touchCount;
      const toAuto = h.service.renameWorkspace(workspace.id, null);
      await h.service.renameWorkspace(workspace.id, "later");
      h.release();
      await toAuto;
      expect(h.service.snapshot().workspaces[0]).toMatchObject({ label: "later", autoLabel: false });
      expect(h.persist.touchCount - touches, "付けた名前の 1 回だけ").toBe(1);
    });

    it("自動の名前に戻す待ちの間に workspace が閉じられたら、何もしない（投げない）", async () => {
      const h = gated();
      await h.service.createWorkspace("/srv/keep", "keep"); // 閉じても D24 の作り直しが走らないように 2 つにする
      const { workspace } = await h.service.createWorkspace("/r/src", "first");
      const events: string[] = [];
      h.bus.subscribe((e) => events.push(e.event));
      const toAuto = h.service.renameWorkspace(workspace.id, null);
      await h.service.closeWorkspace(workspace.id);
      h.release();
      await expect(toAuto).resolves.toBeUndefined();
      expect(events.filter((e) => e === "workspace.updated")).toEqual([]);
    });
  });

  describe("復元（design D6・D10）", () => {
    function workspaceData(id: string, label: string, cwd: string, autoLabel?: boolean) {
      return {
        id,
        label,
        ...(autoLabel !== undefined ? { autoLabel } : {}),
        cwd,
        activeTabId: `t-${id}`,
        tabs: [
          {
            id: `t-${id}`,
            label: "1",
            focusedPaneId: `p-${id}`,
            zoomedPaneId: null,
            layout: { type: "pane" as const, paneId: `p-${id}` },
            panes: [{ id: `p-${id}`, label: null, cwd, shell: "/bin/sh" }],
          },
        ],
      };
    }

    it("自動の名前は場所から決め直し、付けた名前はそのまま。以前の版の「1」と空白だけの名前は自動（AC5〜AC7）", async () => {
      // 保存した後に /r/sub が git のリポジトリになった（親で git init した）状態を、偽の fs で表す。
      const h = setup(["/r"]);
      await h.service.restore({
        schema: 1,
        savedAt: "2026-09-21T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [
          workspaceData("w1", "sub", "/r/sub", true), // 自動（保存した印）→ 決め直して r
          workspaceData("w2", "mine", "/r/sub", false), // 付けた名前 → git の状態が変わってもそのまま
          workspaceData("w3", "1", "/srv/app"), // 以前の版の既定の名前 → 自動
          workspaceData("w4", "feat/x", "/r/sub"), // 以前の版の付けた名前（worktree のブランチ名等）→ そのまま
          workspaceData("w5", "  ", "/srv/app", false), // 空白だけ → 自動
          workspaceData("w6", "1", "/r/sub", false), // 新しい版で利用者が「1」と付けた（印がある）→ 付けた名前のまま
        ],
        focus: null,
      });
      expect(h.service.snapshot().workspaces.map((w) => [w.id, w.label, w.autoLabel])).toEqual([
        ["w1", "r", true],
        ["w2", "mine", false],
        ["w3", "app", true],
        ["w4", "feat/x", false],
        ["w5", "app", true],
        ["w6", "1", false],
      ]);
    });
  });

  // 20260923-agent-session-resume：design「復元」・decisions D8〜D11。
  describe("復元 — 公式フック連携の会話再開（design D9〜D11）", () => {
    function paneData(id: string, cwd: string, agentSession?: { kind: string; sessionId: string; reportedAt: number }) {
      return { id, label: null, cwd, shell: "/bin/sh", ...(agentSession ? { agentSession } : {}) };
    }
    function oneWorkspace(id: string, cwd: string, panes: ReturnType<typeof paneData>[]) {
      return {
        id,
        label: id,
        cwd,
        activeTabId: `t-${id}`,
        tabs: [{ id: `t-${id}`, label: "1", focusedPaneId: panes[0]!.id, zoomedPaneId: null, layout: buildLayout(panes.map((p) => p.id)), panes }],
      };
    }
    function buildLayout(paneIds: string[]): LayoutNode {
      if (paneIds.length === 1) return { type: "pane", paneId: paneIds[0]! };
      const [first, ...rest] = paneIds;
      return { type: "split", id: `s-${first}`, dir: "right", ratio: 0.5, a: { type: "pane", paneId: first! }, b: buildLayout(rest) };
    }

    function setup(getAutoResumeEnabled?: () => boolean) {
      const terminals = new FakeTerminalManager();
      const service = new SessionService({
        model: new SessionModel(),
        terminals,
        bus: new EventBus(),
        persist: new FakePersistScheduler(),
        serverVersion: "0.1.0-test",
        host: HOST_INFO,
        scrollbackLines: 1000,
        spawnGraceMs: 5,
        defaultCwd: "/home/u",
        logger: new MemoryLogger(),
        ...(getAutoResumeEnabled ? { getAutoResumeEnabled } : {}),
      });
      return { terminals, service };
    }

    it("保存されていた会話IDで claude --resume <id> を投入する（AC1）", async () => {
      const { terminals, service } = setup();
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [oneWorkspace("w1", "/r", [paneData("p1", "/r", { kind: "claude", sessionId: "abc-123", reportedAt: 1 })])],
        focus: null,
      });
      const host = terminals.hosts.get("p1") as FakeTerminalHost;
      expect(host.writes).toEqual(["claude --resume abc-123\r"]);
    });

    it("codex は codex resume <id> を投入する（AC2）", async () => {
      const { terminals, service } = setup();
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [oneWorkspace("w1", "/r", [paneData("p1", "/r", { kind: "codex", sessionId: "thr_1", reportedAt: 1 })])],
        focus: null,
      });
      const host = terminals.hosts.get("p1") as FakeTerminalHost;
      expect(host.writes).toEqual(["codex resume thr_1\r"]);
    });

    it("会話IDが無い pane には何も投入しない（AC3・AC4）", async () => {
      const { terminals, service } = setup();
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [oneWorkspace("w1", "/r", [paneData("p1", "/r")])],
        focus: null,
      });
      const host = terminals.hosts.get("p1") as FakeTerminalHost;
      expect(host.writes).toEqual([]);
    });

    it("未知の kind（将来の永続化データ・手編集等）は無害に無視する（AC6 と同じフォールバック）", async () => {
      const { terminals, service } = setup();
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [oneWorkspace("w1", "/r", [paneData("p1", "/r", { kind: "gemini", sessionId: "x", reportedAt: 1 })])],
        focus: null,
      });
      const host = terminals.hosts.get("p1") as FakeTerminalHost;
      expect(host.writes).toEqual([]);
    });

    it("自動再開が無効なら投入しない（design D3・AC-I4）", async () => {
      const { terminals, service } = setup(() => false);
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [oneWorkspace("w1", "/r", [paneData("p1", "/r", { kind: "claude", sessionId: "abc-123", reportedAt: 1 })])],
        focus: null,
      });
      const host = terminals.hosts.get("p1") as FakeTerminalHost;
      expect(host.writes).toEqual([]);
    });

    it("同一 cwd・同一種別の複数 pane でも、pane ごとに一意な ID で全 pane に投入する（AC5・design D11。重複排除はしない）", async () => {
      const { terminals, service } = setup();
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [
          oneWorkspace("w1", "/r", [
            paneData("p1", "/r", { kind: "claude", sessionId: "session-a", reportedAt: 1 }),
            paneData("p2", "/r", { kind: "claude", sessionId: "session-b", reportedAt: 2 }),
          ]),
        ],
        focus: null,
      });
      expect((terminals.hosts.get("p1") as FakeTerminalHost).writes).toEqual(["claude --resume session-a\r"]);
      expect((terminals.hosts.get("p2") as FakeTerminalHost).writes).toEqual(["claude --resume session-b\r"]);
    });

    it("シェルの起動が失敗した pane には投入せず、現状どおり failed にする", async () => {
      const { terminals, service } = setup();
      terminals.nextSpawnFailure = 1;
      await service.restore({
        schema: 1,
        savedAt: "2026-09-23T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [oneWorkspace("w1", "/r", [paneData("p1", "/r", { kind: "claude", sessionId: "abc-123", reportedAt: 1 })])],
        focus: null,
      });
      expect(service.getPane("p1")?.status).toBe("failed");
      // 起動に失敗した pane は `spawnForPane` が `terminals.dispose()` する（破棄されてマップから消える）ので、
      // resume コマンドを書き込む先自体が無い（=投入していないことの証拠）。
      expect(terminals.hosts.has("p1")).toBe(false);
    });
  });

  describe("報告の受信（reportAgentSession。design「振る舞いの詳細・会話IDの報告受信」）", () => {
    function setup() {
      const terminals = new FakeTerminalManager();
      const persist = new FakePersistScheduler();
      const service = makeService(terminals, new EventBus(), persist);
      return { terminals, persist, service };
    }

    it("報告を pane.agentSession へ反映し、保存を予約する", async () => {
      const { service, persist } = setup();
      const { pane } = await service.createWorkspace("/r", "w1");
      persist.touchCount = 0;

      service.reportAgentSession(pane.id, "claude", "abc-123");

      expect(service.getPane(pane.id)?.agentSession).toMatchObject({ kind: "claude", sessionId: "abc-123" });
      expect(persist.touchCount).toBe(1);
    });

    it("存在しない pane への報告は無視する（report 経路は best-effort）", () => {
      const { service, persist } = setup();
      expect(() => service.reportAgentSession("unknown", "claude", "abc-123")).not.toThrow();
      expect(persist.touchCount).toBe(0);
    });

    it("画面判定でエージェントが消えたら（非 null → null）、会話参照も一緒に消す（design D9）", async () => {
      const { service, persist } = setup();
      const { pane } = await service.createWorkspace("/r", "w1");
      service.reportAgentSession(pane.id, "claude", "abc-123");
      service.updatePaneRuntime(pane.id, {
        agent: { instanceId: "a1", kind: "claude", label: "Claude Code", state: "working", completionSeq: 0, serverSeenSeq: 0, verified: true, since: 1 },
      });
      persist.touchCount = 0;

      service.updatePaneRuntime(pane.id, { agent: null });

      expect(service.getPane(pane.id)?.agentSession).toBeNull();
      expect(persist.touchCount, "会話参照の消滅も保存契機にする（design D8）").toBe(1);
    });

    it("agent の kind・state が変わるだけでは会話参照を消さない", async () => {
      const { service } = setup();
      const { pane } = await service.createWorkspace("/r", "w1");
      service.reportAgentSession(pane.id, "claude", "abc-123");
      service.updatePaneRuntime(pane.id, {
        agent: { instanceId: "a1", kind: "claude", label: "Claude Code", state: "working", completionSeq: 0, serverSeenSeq: 0, verified: true, since: 1 },
      });

      service.updatePaneRuntime(pane.id, {
        agent: { instanceId: "a1", kind: "claude", label: "Claude Code", state: "idle", completionSeq: 1, serverSeenSeq: 0, verified: true, since: 2 },
      });

      expect(service.getPane(pane.id)?.agentSession).toMatchObject({ sessionId: "abc-123" });
    });

    // 20260923-other-agents-session-resume（design AC5）。新規ロジックは無く、既存の
    // `reportAgentSession`/`agentSession` の仕組みがそのまま8 kind 分に対応することの確認テスト。
    it("8 kind すべてで agentSession へ正しく反映される", async () => {
      const { service } = setup();
      const kinds = ["claude", "codex", "cursor", "copilot", "devin", "droid", "grok", "qwen"] as const;
      for (const kind of kinds) {
        const { pane } = await service.createWorkspace("/r", kind);
        service.reportAgentSession(pane.id, kind, `${kind}-session`);
        expect(service.getPane(pane.id)?.agentSession).toMatchObject({ kind, sessionId: `${kind}-session` });
      }
    });

    it("同一 cwd・同一 kind の pane が複数あっても、pane ごとに別々の sessionId を保持する（AC5）", async () => {
      const { service } = setup();
      const { pane: pane1 } = await service.createWorkspace("/same/cwd", "w1");
      const { pane: pane2 } = await service.splitPane(pane1.id, "right", undefined);
      const { pane: pane3 } = await service.splitPane(pane1.id, "down", undefined);

      service.reportAgentSession(pane1.id, "claude", "session-1");
      service.reportAgentSession(pane2.id, "claude", "session-2");
      service.reportAgentSession(pane3.id, "claude", "session-3");

      expect(service.getPane(pane1.id)?.agentSession).toMatchObject({ sessionId: "session-1" });
      expect(service.getPane(pane2.id)?.agentSession).toMatchObject({ sessionId: "session-2" });
      expect(service.getPane(pane3.id)?.agentSession).toMatchObject({ sessionId: "session-3" });
    });
  });

  // 応答しないファイルシステムへの stat は取り消せず libuv のスレッドを塞ぐので、上限を超えた問い合わせが返るまでは根を探さない（review ラウンド 1・2）。
  describe("名前を決める処理が上限を超えた後", () => {
    function stuckDeps() {
      const calls: string[] = [];
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => (release = r));
      let hang = true;
      const base = fakeLabelDeps(["/r"]);
      const deps: WorkspaceLabelDeps = {
        ...base,
        timeoutMs: 20,
        stat: (p) => {
          calls.push(p);
          // 止まっている間の問い合わせは、release するまで返らない（止まった NFS の stat の代わり）。
          return hang ? gate.then(() => base.stat(p)) : base.stat(p);
        },
      };
      return {
        deps,
        calls,
        release: () => {
          hang = false;
          release();
        },
      };
    }

    it("上限を超えた問い合わせが返るまでは fs に問い合わせずフォルダ名にし、返ったらまた根を探す", async () => {
      const s = stuckDeps();
      const service = makeService(new FakeTerminalManager(), new EventBus(), new FakePersistScheduler(), undefined, s.deps);
      const first = await service.createWorkspace("/r/src", undefined);
      expect(first.workspace.label, "上限を超えたのでフォルダ名").toBe("src");
      const asked = s.calls.length;
      const second = await service.createWorkspace("/r/src", undefined);
      expect(second.workspace).toMatchObject({ label: "src", autoLabel: true });
      expect(s.calls.length, "止まった問い合わせが返るまでは問い合わせない").toBe(asked);
      s.release(); // 止まっていた stat が返る（遅いだけだった）
      await new Promise((r) => setTimeout(r, 10));
      const third = await service.createWorkspace("/r/src", undefined);
      expect(third.workspace.label, "返ったらまた根を探す").toBe("r");
    });

    // 数を戻す処理はログより先に付ける——warn が投げても、止まった問い合わせが返ったら数が戻る（review ラウンド 3）。
    it("上限を超えたときのログが投げても、問い合わせが返ったらまた根を探す", async () => {
      const s = stuckDeps();
      const logger = new MemoryLogger();
      logger.warn = () => {
        throw new Error("warn failed");
      };
      const service = new SessionService({
        model: new SessionModel(),
        terminals: new FakeTerminalManager(),
        bus: new EventBus(),
        persist: new FakePersistScheduler(),
        serverVersion: "0.1.0-test",
        host: HOST_INFO,
        scrollbackLines: 1000,
        spawnGraceMs: 5,
        defaultCwd: "/home/u",
        logger,
        workspaceLabelDeps: s.deps,
      });
      const first = await service.createWorkspace("/r/src", undefined);
      expect(first.workspace.label, "上限を超えたのでフォルダ名").toBe("src");
      s.release();
      await new Promise((r) => setTimeout(r, 10));
      const second = await service.createWorkspace("/r/src", undefined);
      expect(second.workspace.label, "warn が投げても数が戻り、また根を探す").toBe("r");
    });

    // 1 つずつ決めるので、遅いだけの fs でも数に比例して `/ws` の受け付けが遅れる——合計の期限（1 秒）を過ぎたら残りはフォルダ名（review ラウンド 2）。
    it("復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ）", async () => {
      let now = 0;
      const calls: string[] = [];
      const logger = new MemoryLogger();
      const base = fakeLabelDeps(["/r"]);
      const deps: WorkspaceLabelDeps = {
        ...base,
        stat: (p) => {
          calls.push(p);
          now += 400; // 上限（200ms）には達しないが遅い stat（時計だけを進める）
          return base.stat(p);
        },
      };
      const service = new SessionService({
        model: new SessionModel(),
        terminals: new FakeTerminalManager(),
        bus: new EventBus(),
        persist: new FakePersistScheduler(),
        serverVersion: "0.1.0-test",
        host: HOST_INFO,
        scrollbackLines: 1000,
        spawnGraceMs: 5,
        defaultCwd: "/home/u",
        logger,
        workspaceLabelDeps: deps,
        clock: { now: () => now },
      });
      const ws = (id: string, cwd: string) => ({
        id,
        label: "1",
        cwd,
        activeTabId: `t-${id}`,
        tabs: [{ id: `t-${id}`, label: "1", focusedPaneId: `p-${id}`, zoomedPaneId: null, layout: { type: "pane" as const, paneId: `p-${id}` }, panes: [{ id: `p-${id}`, label: null, cwd, shell: "/bin/sh" }] }],
      });
      await service.restore({
        schema: 1,
        savedAt: "2026-09-21T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        // w3 は付けた名前（期限を過ぎても決め直さない・フォルダ名にしない——期限は自動の名前のときだけ見る。review ラウンド 4）。
        workspaces: [ws("w1", "/r/a"), ws("w2", "/r/b"), { ...ws("w3", "/r/c"), label: "mine", autoLabel: false }, ws("w4", "/r/d")],
        focus: null,
      });
      expect(service.snapshot().workspaces.map((w) => w.label), "w1 は根を探して r、期限を過ぎた w2・w4 はフォルダ名、w3 は付けた名前").toEqual(["r", "b", "mine", "d"]);
      expect(calls.every((p) => p.startsWith("/r/a") || p === "/r/.git" || p === "/r/.git/HEAD"), "w2・w3 は問い合わせない").toBe(true);
      const overBudget = logger.lines.filter((l) => l.level === "warn" && l.msg.startsWith("workspace label lookup over restore budget"));
      expect(overBudget, "期限を過ぎたら警告を 1 度だけ（w2・w3 の 2 つとも過ぎているが 1 度）").toEqual([
        { level: "warn", msg: "workspace label lookup over restore budget; using folder names for the rest", fields: { budgetMs: 1000, remaining: 2 } },
      ]);
    });

    it("復元では 1 つずつ決め、1 つが上限を超えたら残りは問い合わせずフォルダ名にする", async () => {
      const s = stuckDeps();
      const service = makeService(new FakeTerminalManager(), new EventBus(), new FakePersistScheduler(), undefined, s.deps);
      const ws = (id: string, cwd: string) => ({
        id,
        label: "1",
        cwd,
        activeTabId: `t-${id}`,
        tabs: [{ id: `t-${id}`, label: "1", focusedPaneId: `p-${id}`, zoomedPaneId: null, layout: { type: "pane" as const, paneId: `p-${id}` }, panes: [{ id: `p-${id}`, label: null, cwd, shell: "/bin/sh" }] }],
      });
      await service.restore({
        schema: 1,
        savedAt: "2026-09-21T00:00:00Z",
        nextId: { w: 10, t: 10, p: 10, s: 1, a: 1, g: 1 },
        groups: [],
        workspaces: [ws("w1", "/r/a"), ws("w2", "/r/b"), ws("w3", "/r/c")],
        focus: null,
      });
      expect(service.snapshot().workspaces.map((w) => w.label)).toEqual(["a", "b", "c"]);
      expect(s.calls, "止まった 1 つ（w1 の最初の stat）の後は問い合わせない").toEqual(["/r/a"]);
    });
  });
});
