import { TERMINAL_PALETTES, type HostInfo } from "@wtm/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Disposable } from "../util/Disposable.js";
import { MemoryLogger } from "../log/Logger.js";
import { EventBus } from "../bus/EventBus.js";
import type { CreatePaneOptions, TerminalManager } from "../terminal/TerminalManager.js";
import type { TerminalHost } from "../terminal/TerminalHost.js";
import type { PersistScheduler } from "../session/PersistScheduler.js";
import { SessionModel } from "../session/SessionModel.js";
import { SessionService } from "../session/SessionService.js";
import { DefaultClientRegistry } from "./ClientRegistry.js";
import { DefaultSizeAuthority } from "./SizeAuthority.js";
import { answerPaletteFor } from "./answerPalette.js";

/** 常に成功する、必要最小限の偽の PTY（SizeAuthority の権限ロジックだけを見る）。 */
class AlwaysUpHost implements TerminalHost {
  readonly pid = 1;
  readonly mirror = {} as TerminalHost["mirror"];
  readonly fanout = {} as TerminalHost["fanout"];
  resized: { cols: number; rows: number } | null = null;
  constructor(readonly paneId: string) {}
  write(): void {}
  writeModal(): Promise<void> {
    return Promise.resolve();
  }
  resize(cols: number, rows: number): void {
    this.resized = { cols, rows };
  }
  lastOutputAt(): number {
    return Date.now();
  }
  onExit(): Disposable {
    return { dispose: () => undefined };
  }
  dispose(): void {}
}
class AlwaysUpTerminalManager implements TerminalManager {
  readonly hosts = new Map<string, AlwaysUpHost>();
  create(paneId: string, _opts: CreatePaneOptions): TerminalHost {
    const host = new AlwaysUpHost(paneId);
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
    this.hosts.delete(paneId);
  }
}
class NoopPersist implements PersistScheduler {
  touch(): void {}
  async flush(): Promise<void> {}
  cancel(): void {}
}

const HOST_INFO: HostInfo = { os: "linux", windowsBuild: null, hostname: "test" };

function makeContext() {
  const terminals = new AlwaysUpTerminalManager();
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
    logger: new MemoryLogger(),
  });
  const clients = new DefaultClientRegistry();
  const authority = new DefaultSizeAuthority(clients, session);
  return { terminals, session, clients, authority };
}

describe("DefaultSizeAuthority — taking ownership", () => {
  let ctx: Awaited<ReturnType<typeof makeContext>>;
  beforeEach(async () => {
    ctx = makeContext();
  });

  it("a desktop client claims ownership on interaction and its view size is applied", async () => {
    const { session, clients, authority, terminals } = ctx;
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("desktop");
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 100, rows: 30 }] });

    authority.noteInteraction(client, pane.id);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(client);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 100, rows: 30 });
    expect(terminals.hosts.get(pane.id)?.resized).toEqual({ cols: 100, rows: 30 });
  });

  it("a mobile client without fit does not claim ownership", async () => {
    const { session, clients, authority } = ctx;
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("mobile");
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });

    authority.noteInteraction(client, pane.id);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)?.cols).not.toBe(40);
  });

  it("an external client (wtmctl) does not claim ownership on interaction, same as a mobile client without fit (20260923-external-control-api D4)", async () => {
    const { session, clients, authority } = ctx;
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("external");
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });

    authority.noteInteraction(client, pane.id);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)?.cols).not.toBe(40);
  });

  it("a mobile client with fit enabled can claim ownership", async () => {
    const { session, clients, authority } = ctx;
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("mobile");
    clients.setFit(client, true);
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });

    authority.noteInteraction(client, pane.id);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(client);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });
  });

  it("onViewChanged claims an unowned tab for the first client that reports a view", async () => {
    const { session, clients, authority } = ctx;
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("desktop");
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 90, rows: 28 }] });

    authority.onViewChanged(client);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(client);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 90, rows: 28 });
  });

  it("onViewChanged does not steal ownership from another client's tab", async () => {
    const { session, clients, authority } = ctx;
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const owner = clients.register("desktop");
    clients.setView(owner, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 80, rows: 24 }] });
    authority.onViewChanged(owner);

    const other = clients.register("desktop");
    clients.setView(other, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 200, rows: 60 }] });
    authority.onViewChanged(other);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(owner);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 80, rows: 24 }); // 他人のサイズでは動かない
  });
});

describe("DefaultSizeAuthority — transfer on disconnect", () => {
  it("transfers ownership to the client that last interacted while viewing the same tab", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");

    const owner = clients.register("desktop");
    clients.setView(owner, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 80, rows: 24 }] });
    authority.noteInteraction(owner, pane.id);

    const watcher = clients.register("desktop");
    clients.setView(watcher, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 111, rows: 33 }] });
    clients.touch(watcher); // 見ているが、まだ操作の権限を取ってはいない

    clients.unregister(owner);
    authority.onClientGone(owner);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(watcher);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 111, rows: 33 });
  });

  it("clears ownership (without changing the pane size) when nobody else is viewing the tab", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const owner = clients.register("desktop");
    clients.setView(owner, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 80, rows: 24 }] });
    authority.noteInteraction(owner, pane.id);
    const sizeBefore = { cols: session.getPane(pane.id)!.cols, rows: session.getPane(pane.id)!.rows };

    clients.unregister(owner);
    authority.onClientGone(owner);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)).toMatchObject(sizeBefore);
  });

  it("picks the most recently interacted viewer when several are watching the same tab", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const owner = clients.register("desktop");
    clients.setView(owner, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 80, rows: 24 }] });
    authority.noteInteraction(owner, pane.id);

    const older = clients.register("desktop");
    clients.setView(older, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 70, rows: 20 }] });
    clients.touch(older);

    await new Promise((r) => setTimeout(r, 5));

    const newer = clients.register("desktop");
    clients.setView(newer, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 130, rows: 40 }] });
    clients.touch(newer);

    clients.unregister(owner);
    authority.onClientGone(owner);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(newer);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 130, rows: 40 });
  });
});

/**
 * D106（統合 review ラウンド1 の must）：`onViewChanged` だけが資格（デスクトップか、fit を有効にしたモバイル）を確かめず、
 * 誰も権限を持たない tab を fit していないモバイルにも渡していた。デスクトップを閉じた後にスマートフォンで開くだけで、PTY が
 * スマートフォンの大きさに縮んだ（D13・design「モバイル」の「既定ではサイズ権限を取らず」に反する）。
 */
describe("DefaultSizeAuthority — モバイルは既定でサイズを決めない（D13・D106）", () => {
  it("fit していないモバイルは、誰も権限を持たない tab に client.view を送っても権限を取らず、PTY の大きさも変えない", async () => {
    const { session, clients, authority, terminals } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const sizeBefore = { cols: session.getPane(pane.id)!.cols, rows: session.getPane(pane.id)!.rows };
    const mobile = clients.register("mobile");
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });

    authority.onViewChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)).toMatchObject(sizeBefore);
    expect(terminals.hosts.get(pane.id)?.resized).toBeNull(); // PTY へ resize を一度も送っていない
  });

  it("fit していないモバイルの入力でも操作の時刻は進み（権限は取らない）、色の問い合わせには後から入力したモバイルの配色で答える（20260921-theme-settings の decisions D7）", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(1_000);
      const { session, clients, authority } = makeContext();
      const { tab, pane } = await session.createWorkspace("/home/u", "api");
      const first = clients.register("mobile");
      vi.setSystemTime(2_000);
      const second = clients.register("mobile"); // 後から接続した
      for (const [c, theme] of [
        [first, "nord"],
        [second, "one-light"],
      ] as const) {
        clients.setView(c, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
        clients.setTheme(c, theme);
      }
      vi.setSystemTime(3_000);
      authority.noteInteraction(first, pane.id); // 先に接続したほうが後から入力した

      expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
      expect(clients.get(first)?.lastInteractionAt).toBe(3_000);
      const deps = { getPane: (id: string) => session.getPane(id), getTab: (id: string) => session.getTab(id), clients };
      expect(answerPaletteFor(pane.id, deps)).toBe(TERMINAL_PALETTES.nord);
    } finally {
      vi.useRealTimers();
    }
  });

  it("デスクトップを閉じた後にモバイル（fit なし）だけが見ている tab：権限は無いまま、大きさはデスクトップのときのまま", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 100, rows: 30 }] });
    authority.onViewChanged(desktop);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 100, rows: 30 });

    clients.unregister(desktop);
    authority.onClientGone(desktop);
    const mobile = clients.register("mobile");
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(mobile);
    authority.noteInteraction(mobile, pane.id); // 入力しても（fit なしなので）取らない

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)).toMatchObject({ cols: 100, rows: 30 });
  });

  it("fit なしのモバイルが先に client.view を送っていても、後から来たデスクトップが権限を取り、その大きさになる", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const mobile = clients.register("mobile");
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(mobile);

    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 120, rows: 35 }] });
    authority.onViewChanged(desktop);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 120, rows: 35 });
  });

  it("fit を有効にしたモバイルは、誰も権限を持たない tab の権限を client.view で取る", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const mobile = clients.register("mobile");
    clients.setFit(mobile, true);
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });

    authority.onViewChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(mobile);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });
  });

  it("見ている途中で fit を有効にすると（onFitChanged）、その時点で権限を取り、申告済みの大きさを当てる", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const mobile = clients.register("mobile");
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(mobile);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();

    clients.setFit(mobile, true);
    authority.onFitChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(mobile);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });
  });

  it("fit を有効にすると、デスクトップが権限を持つ tab でも権限を取る（design「client.fit でサイズ権限を取る」）", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 100, rows: 30 }] });
    authority.noteInteraction(desktop, pane.id);
    const mobile = clients.register("mobile");
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(mobile);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop); // fit 前は奪わない

    clients.setFit(mobile, true);
    authority.onFitChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(mobile);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });
  });

  it("fit を無効にすると権限を手放し、同じ tab を見ているデスクトップへ移す", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 100, rows: 30 }] });
    const mobile = clients.register("mobile");
    clients.setFit(mobile, true);
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onFitChanged(mobile);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(mobile);

    clients.setFit(mobile, false);
    authority.onFitChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 100, rows: 30 });
  });

  it("fit を無効にして誰も資格のあるクライアントが見ていなければ、権限を無しにしてサイズを保ち、以後の client.view でも変えない", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const mobile = clients.register("mobile");
    clients.setFit(mobile, true);
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(mobile);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(mobile);

    clients.setFit(mobile, false);
    authority.onFitChanged(mobile);
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 30, rows: 15 }] });
    authority.onViewChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });
  });

  it("権限を持ったまま資格を失ったモバイルの client.view は、大きさを当てずに権限を手放す（onFitChanged を経ない経路の保険）", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const mobile = clients.register("mobile");
    clients.setFit(mobile, true);
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(mobile);

    clients.setFit(mobile, false); // onFitChanged を呼ばない
    clients.setView(mobile, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 30, rows: 15 }] });
    authority.onViewChanged(mobile);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)).toMatchObject({ cols: 40, rows: 20 });
  });

  it("デスクトップは fit を送らなくても、誰も権限を持たない tab の権限を client.view で取る（従来どおり）", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 90, rows: 28 }] });

    authority.onViewChanged(desktop);
    authority.onFitChanged(desktop); // デスクトップの fit:false は何も変えない

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 90, rows: 28 });
  });
});

/**
 * D106 の独立点検：「この端末に合わせる」は幅で決まる 1 列の画面（`isMobileViewport`）に出るので、`client.hello` の種別が
 * デスクトップの窓からも `client.fit` が届く。有効にしたら種別を問わず権限を取る。また `client.hello` はいつでも種別を
 * 変えられるので、資格を失う種別に変わったら権限を手放す。
 */
describe("DefaultSizeAuthority — fit と種別の変化（D106 の独立点検）", () => {
  it("デスクトップも fit を有効にすると、他のデスクトップが持つ tab の権限を取る（幅を狭めた窓の「この端末に合わせる」）", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const wide = clients.register("desktop");
    clients.setView(wide, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 160, rows: 45 }] });
    authority.noteInteraction(wide, pane.id);
    const narrow = clients.register("desktop");
    clients.setView(narrow, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 60, rows: 30 }] });
    authority.onViewChanged(narrow);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(wide);

    clients.setFit(narrow, true);
    authority.onFitChanged(narrow);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(narrow);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 60, rows: 30 });
  });

  it("デスクトップは fit を無効にしても資格が残り、持っている権限を手放さない", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const other = clients.register("desktop");
    clients.setView(other, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 160, rows: 45 }] });
    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 60, rows: 30 }] });
    clients.setFit(desktop, true);
    authority.onFitChanged(desktop);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop);

    clients.setFit(desktop, false);
    authority.onFitChanged(desktop);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 60, rows: 30 });
  });

  it("デスクトップとして権限を取った後に fit なしのモバイルとして hello し直すと（onKindChanged）、同じ tab を見ているデスクトップへ移す", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("desktop");
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 60, rows: 30 }] });
    authority.noteInteraction(client, pane.id);
    const desktop = clients.register("desktop");
    clients.setView(desktop, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 150, rows: 42 }] });
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(client);

    clients.setKind(client, "mobile");
    authority.onKindChanged(client);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(desktop);
    expect(session.getPane(pane.id)).toMatchObject({ cols: 150, rows: 42 });
  });

  it("資格を失う種別に変わって、同じ tab を見ている資格のあるクライアントが居なければ、権限を無しにしてサイズを保つ", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("desktop");
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 60, rows: 30 }] });
    authority.onViewChanged(client);

    clients.setKind(client, "mobile");
    authority.onKindChanged(client);
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 40, rows: 20 }] });
    authority.onViewChanged(client);

    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBeNull();
    expect(session.getPane(pane.id)).toMatchObject({ cols: 60, rows: 30 });
  });

  it("fit を有効にしたままモバイルへ変わっても資格が残るので手放さない（資格のある種別に変わっても何もしない）", async () => {
    const { session, clients, authority } = makeContext();
    const { tab, pane } = await session.createWorkspace("/home/u", "api");
    const client = clients.register("desktop");
    clients.setFit(client, true);
    clients.setView(client, { workspaceId: tab.workspaceId, tabId: tab.id, visible: [{ paneId: pane.id, cols: 60, rows: 30 }] });
    authority.onViewChanged(client);

    clients.setKind(client, "mobile");
    authority.onKindChanged(client);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(client);

    const mobile = clients.register("mobile");
    authority.onKindChanged(mobile); // 何も持っていない・資格の無いクライアントでも何も起きない
    clients.setKind(mobile, "desktop");
    authority.onKindChanged(mobile);
    expect(session.getTab(tab.id)?.sizeOwnerClientId).toBe(client);
  });
});
