import type {
  AgentInfo,
  AgentIntegrationKind,
  AgentSessionRef,
  Dir,
  GitInfo,
  HostInfo,
  IdKind,
  NextIdCounters,
  Pane,
  PaneId,
  PaneStatus,
  RightClickTarget,
  SessionFocus,
  SessionLimits,
  SessionSnapshot,
  SplitDirection,
  SplitId,
  Tab,
  TabId,
  Workspace,
  WorkspaceId,
} from "@wtm/protocol";
import { formatId } from "@wtm/protocol";
import * as Layout from "./LayoutTree.js";
import type { SessionFileWorkspace } from "../persist/SessionFile.js";

/** 新しい pane を作るときに、呼び出し側（SessionService）が用意して渡す実行時の情報。 */
export interface NewPaneInit {
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  label?: string | null;
  status?: PaneStatus;
  failure?: string | null;
}

export interface CreateWorkspaceResult {
  workspace: Workspace;
  tab: Tab;
  pane: Pane;
}
export interface CreateTabResult {
  tab: Tab;
  pane: Pane;
}
export interface SplitPaneResult {
  pane: Pane;
}
/** pane/tab/workspace を閉じたときに、実際に消えた id を呼び出し側へ返す（PTY の破棄・購読の後始末に使う）。
 *  workspace が 0 個になったときの自動作成（D24）は、PTY の起動を伴うため `SessionService` の責務にした
 *  （SessionModel は副作用なし。「はじめに作りかけた版で SessionModel に持たせたのは層の越境だった」ので直した）。 */
export interface RemovalResult {
  removedPaneIds: PaneId[];
  /** 連鎖で一緒に消えた tab の id（閉じた順）。要求した pane/tab/workspace 自身の閉鎖で消えた tab も含む
   *  （D42：直接 `closeWorkspace` した場合は複数になりうるため、単数の `closedTabId` から複数形に直した）。 */
  removedTabIds: TabId[];
  closedWorkspaceId: WorkspaceId | null;
}

export class NotFoundError extends Error {
  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

/**
 * workspace / tab / pane の保持と操作（architecture.md「SessionModel」）。
 * **副作用なし**：PTY の起動・破棄、イベントの発行、永続化はここでは行わない（`SessionService` の責務。T17）。
 * ここが持つのは、レイアウト木（`LayoutTree`。純関数）を使ったデータの整合性だけ。
 */
export class SessionModel {
  private readonly workspaces = new Map<WorkspaceId, Workspace>();
  private readonly tabs = new Map<TabId, Tab>();
  private readonly panes = new Map<PaneId, Pane>();
  private nextIdCounters: NextIdCounters = { w: 1, t: 1, p: 1, s: 1, a: 1 };
  private focus: SessionFocus | null = null;

  // --- id -----------------------------------------------------------------

  nextId(kind: IdKind): string {
    const n = this.nextIdCounters[kind];
    this.nextIdCounters = { ...this.nextIdCounters, [kind]: n + 1 };
    return formatId(kind, n);
  }

  getNextIdCounters(): NextIdCounters {
    return { ...this.nextIdCounters };
  }

  /** 復元時に、保存されていた `nextId` を引き継ぐ（新規採番と衝突しないように）。 */
  setNextIdCounters(counters: NextIdCounters): void {
    this.nextIdCounters = { ...counters };
  }

  // --- lookups --------------------------------------------------------------

  getWorkspace(id: WorkspaceId): Workspace | undefined {
    return this.workspaces.get(id);
  }
  getTab(id: TabId): Tab | undefined {
    return this.tabs.get(id);
  }
  getPane(id: PaneId): Pane | undefined {
    return this.panes.get(id);
  }
  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()];
  }
  listTabs(): Tab[] {
    return [...this.tabs.values()];
  }
  listPanes(): Pane[] {
    return [...this.panes.values()];
  }
  getFocus(): SessionFocus | null {
    return this.focus;
  }

  private requireWorkspace(id: WorkspaceId): Workspace {
    const ws = this.workspaces.get(id);
    if (!ws) throw new NotFoundError("workspace", id);
    return ws;
  }
  private requireTab(id: TabId): Tab {
    const tab = this.tabs.get(id);
    if (!tab) throw new NotFoundError("tab", id);
    return tab;
  }
  private requirePane(id: PaneId): Pane {
    const pane = this.panes.get(id);
    if (!pane) throw new NotFoundError("pane", id);
    return pane;
  }

  // --- creation ---------------------------------------------------------------

  /** `Pane` オブジェクトの組み立て（`createWorkspace`/`createTab`/`splitPane`/`restoreWorkspace` で共通）。 */
  private makePane(id: PaneId, tabId: TabId, init: NewPaneInit): Pane {
    return {
      id,
      tabId,
      label: init.label ?? null,
      cwd: init.cwd,
      shell: init.shell,
      cols: init.cols,
      rows: init.rows,
      status: init.status ?? "running",
      failure: init.failure ?? null,
      busy: false,
      title: "",
      rightClick: "herdr",
      agent: null,
      agentSession: null,
    };
  }

  /**
   * `workspace.create` の前半：id を払い出しオブジェクトを組み立てるだけで、まだ Map には入れない
   * （呼び出し側が PTY の起動を確認してから `commitWorkspace` で入れる。D37「成功を確認してから
   * モデルを更新する順にする」——`splitPane` の `reserveNextPaneId` と同じ考え方を workspace/tab にも揃えた）。
   */
  reserveWorkspace(cwd: string, label: string, autoLabel: boolean, init: NewPaneInit): CreateWorkspaceResult {
    const workspaceId = this.nextId("w");
    const tabId = this.nextId("t");
    const paneId = this.nextId("p");

    const pane = this.makePane(paneId, tabId, init);
    const tab: Tab = {
      id: tabId,
      workspaceId,
      label: "1",
      layout: { type: "pane", paneId },
      focusedPaneId: paneId,
      zoomedPaneId: null,
      sizeOwnerClientId: null,
    };
    const workspace: Workspace = {
      id: workspaceId,
      label,
      cwd,
      tabIds: [tabId],
      activeTabId: tabId,
      groupId: null,
      git: null,
      autoLabel,
    };
    return { workspace, tab, pane };
  }

  /** `reserveWorkspace` が組み立てたオブジェクトを実際に Map へ入れ、focus する。 */
  commitWorkspace(result: CreateWorkspaceResult): void {
    this.workspaces.set(result.workspace.id, result.workspace);
    this.tabs.set(result.tab.id, result.tab);
    this.panes.set(result.pane.id, result.pane);
    this.focus = { workspaceId: result.workspace.id, tabId: result.tab.id, paneId: result.pane.id };
  }

  /** workspace を、最初の tab・pane ごと作る（`workspace.create`）。PTY の起動確認が要らない
   *  呼び出し元（テスト等）向けの一括版。実運用の `SessionService` は `reserveWorkspace`/`commitWorkspace` を使う。
   *  名前は既定で付けた名前（`autoLabel: false`。テストが名前を渡して作るため）。 */
  createWorkspace(cwd: string, label: string, init: NewPaneInit, autoLabel = false): CreateWorkspaceResult {
    const result = this.reserveWorkspace(cwd, label, autoLabel, init);
    this.commitWorkspace(result);
    return result;
  }

  /** `autoLabel` は省略できない——入れ忘れると自動の名前が付けた名前として固定される（20260921-workspace-auto-label の design D2）。 */
  renameWorkspace(id: WorkspaceId, label: string, autoLabel: boolean): Workspace {
    const ws = this.requireWorkspace(id);
    const updated = { ...ws, label, autoLabel };
    this.workspaces.set(id, updated);
    return updated;
  }

  focusWorkspace(id: WorkspaceId): void {
    const ws = this.requireWorkspace(id);
    const tab = this.requireTab(ws.activeTabId);
    this.setFocus(ws.id, tab.id, tab.focusedPaneId);
  }

  /** `tab.create` の前半。workspace を省略すると、直近にフォーカスした workspace を使う。
   *  まだ Map には入れない（`commitTab` で入れる。`reserveWorkspace` と同じ理由）。 */
  reserveTab(workspaceId: WorkspaceId | undefined, label: string | undefined, init: NewPaneInit): CreateTabResult {
    const wsId = workspaceId ?? this.focus?.workspaceId;
    if (!wsId) throw new NotFoundError("workspace", "(none focused)");
    const ws = this.requireWorkspace(wsId); // 予約時点では存在を確認するだけ（実際に生きているかは commit 時に取り直す）

    const tabId = this.nextId("t");
    const paneId = this.nextId("p");
    const pane = this.makePane(paneId, tabId, init);
    const tab: Tab = {
      id: tabId,
      workspaceId: ws.id,
      label: label ?? String(ws.tabIds.length + 1),
      layout: { type: "pane", paneId },
      focusedPaneId: paneId,
      zoomedPaneId: null,
      sizeOwnerClientId: null,
    };
    return { tab, pane };
  }

  /**
   * `reserveTab` が組み立てたオブジェクトを実際に Map へ入れる。
   * PTY の起動確認の間（`await`）に workspace が閉じられている可能性があるので、workspace の存在を
   * ここで**取り直して**確認する（`reserveTab` 時点の参照を使い回さない）。無ければ `NotFoundError`
   * ——呼び出し側（`SessionService`）は孤児化した PTY を破棄する。
   */
  commitTab(result: CreateTabResult): void {
    const ws = this.requireWorkspace(result.tab.workspaceId);
    this.tabs.set(result.tab.id, result.tab);
    this.panes.set(result.pane.id, result.pane);
    this.workspaces.set(ws.id, { ...ws, tabIds: [...ws.tabIds, result.tab.id], activeTabId: result.tab.id });
    this.setFocus(ws.id, result.tab.id, result.pane.id);
  }

  /** `tab.create`。PTY の起動確認が要らない呼び出し元（テスト等）向けの一括版。
   *  実運用の `SessionService` は `reserveTab`/`commitTab` を使う。 */
  createTab(workspaceId: WorkspaceId | undefined, label: string | undefined, init: NewPaneInit): CreateTabResult {
    const result = this.reserveTab(workspaceId, label, init);
    this.commitTab(result);
    return result;
  }

  renameTab(id: TabId, label: string): Tab {
    const tab = this.requireTab(id);
    const updated = { ...tab, label };
    this.tabs.set(id, updated);
    return updated;
  }

  focusTab(id: TabId): void {
    const tab = this.requireTab(id);
    const ws = this.requireWorkspace(tab.workspaceId);
    this.workspaces.set(ws.id, { ...ws, activeTabId: tab.id });
    this.setFocus(ws.id, tab.id, tab.focusedPaneId);
  }

  /** `pane.split`。`newPaneId` は呼び出し側が発行済みの id（`SessionService` が spawn 前に確保する）。 */
  splitPane(paneId: PaneId, direction: SplitDirection, ratio: number | undefined, newPaneId: PaneId, init: NewPaneInit): SplitPaneResult {
    const target = this.requirePane(paneId);
    const tab = this.requireTab(target.tabId);
    const splitId = this.nextId("s");

    const newPane = this.makePane(newPaneId, tab.id, init);
    const layout = Layout.split(tab.layout, paneId, direction, newPaneId, splitId, ratio ?? 0.5);
    this.panes.set(newPaneId, newPane);
    // 分割したら zoom を解除する（herdr の `Tab::split_pane_with_runtime` が `zoomed = false` にするのと同じ。D100）。
    // 解除しないと、新しい pane は zoom 中の別の pane に隠れたまま焦点だけが移る。
    this.tabs.set(tab.id, { ...tab, layout, zoomedPaneId: null });
    this.setFocus(tab.workspaceId, tab.id, newPaneId, { setTabFocusedPane: true });
    return { pane: newPane };
  }

  /** 新しい pane の id を、split の前に確保したいとき用（spawn の cwd 決定などで先に id が要る場合）。 */
  reserveNextPaneId(): PaneId {
    return this.nextId("p");
  }

  closePane(paneId: PaneId): RemovalResult {
    const pane = this.requirePane(paneId);
    const tab = this.requireTab(pane.tabId);
    const newLayout = Layout.remove(tab.layout, paneId);
    if (newLayout === null) {
      // 最後の pane だった → tab を閉じる（D18 の連鎖）。closeTabInternal が tab.layout から
      // 改めて葉を数えるので、ここでは pane をまだ消さない（二重カウントを避ける）。
      return this.closeTabInternal(tab.id);
    }
    this.panes.delete(paneId);
    const nextFocused = tab.focusedPaneId === paneId ? Layout.leaves(newLayout)[0] ?? paneId : tab.focusedPaneId;
    this.tabs.set(tab.id, {
      ...tab,
      layout: newLayout,
      focusedPaneId: nextFocused,
      zoomedPaneId: null, // pane を閉じたら zoom を解除する（herdr の `Tab::detach_pane` と同じ。D100）
    });
    if (nextFocused !== tab.focusedPaneId) this.setFocus(tab.workspaceId, tab.id, nextFocused);
    return { removedPaneIds: [paneId], removedTabIds: [], closedWorkspaceId: null };
  }

  closeTab(id: TabId): RemovalResult {
    return this.closeTabInternal(id);
  }

  /**
   * `tab.move`（20260923-missing-keybinding-actions。herdr の move_tab_previous/move_tab_next 相当）。
   * 対象 tab を1つ隣へ動かす（巡回込み）。`tabIds` が1個以下なら意味の無い変化なので `null` を返す
   * （design「エラー処理 / 異常系」。SessionService はこのとき `workspace.updated` を発行しない）。
   *
   * **単純な2要素 swap ではない**（coding 中に見つけた design/research の誤り。decisions.md D10）。
   * 先頭の tab を「前へ」・末尾の tab を「後ろへ」動かすときは、対象を配列の反対の端へ移し、
   * 間の要素は1つずつ詰める（herdr の `Workspace::move_tab`＝`remove(source)` して `insert(target)` と
   * 同じ結果。`herdr:src/workspace.rs:591-611`）。内側（先頭/末尾以外）のときは結果的に隣接swapと
   * 一致する。`splice` の remove→insert がこの両方を同じ式で表す。
   * `activeTabId` は id で指しているので、並べ替えでは変わらない（herdr の `active_tab`〔インデックス〕
   * を都度引き直す必要が無い。design「検討した代替案」）。
   */
  moveTab(id: TabId, direction: "previous" | "next"): Workspace | null {
    const tab = this.requireTab(id);
    const ws = this.requireWorkspace(tab.workspaceId);
    if (ws.tabIds.length <= 1) return null;
    const idx = ws.tabIds.indexOf(id);
    const last = ws.tabIds.length - 1;
    const newIdx = direction === "next" ? (idx === last ? 0 : idx + 1) : idx === 0 ? last : idx - 1;
    const tabIds = [...ws.tabIds];
    tabIds.splice(idx, 1);
    tabIds.splice(newIdx, 0, id);
    const updated = { ...ws, tabIds };
    this.workspaces.set(ws.id, updated);
    return updated;
  }

  private closeTabInternal(id: TabId): RemovalResult {
    const tab = this.requireTab(id);
    const ws = this.requireWorkspace(tab.workspaceId);
    const removedPaneIds = Layout.leaves(tab.layout);
    for (const pid of removedPaneIds) this.panes.delete(pid);
    this.tabs.delete(id);

    const remainingTabIds = ws.tabIds.filter((t) => t !== id);
    if (remainingTabIds.length === 0) {
      // 最後の tab だった → workspace を閉じる（D18 の連鎖）。
      const wsResult = this.closeWorkspaceInternal(ws.id, { skipTabCleanup: true });
      return this.mergeRemoval({ removedPaneIds, removedTabIds: [id], closedWorkspaceId: null }, wsResult);
    }
    const activeTabId = ws.activeTabId === id ? remainingTabIds[0]! : ws.activeTabId;
    this.workspaces.set(ws.id, { ...ws, tabIds: remainingTabIds, activeTabId });
    if (activeTabId !== ws.activeTabId) {
      const nextTab = this.requireTab(activeTabId);
      this.setFocus(ws.id, activeTabId, nextTab.focusedPaneId);
    }
    return { removedPaneIds, removedTabIds: [id], closedWorkspaceId: null };
  }

  /** workspace が 0 個になったときの自動作成（D24）は SessionService の責務（PTY を起動できるのはそちら）。
   *  `SessionModel` はここでは何もせず、0 個で終わっても構わない。焦点が消えたら null にするだけ。 */
  closeWorkspace(id: WorkspaceId): RemovalResult {
    return this.closeWorkspaceInternal(id, { skipTabCleanup: false });
  }

  private closeWorkspaceInternal(id: WorkspaceId, opts: { skipTabCleanup: boolean }): RemovalResult {
    const ws = this.requireWorkspace(id);
    const removedPaneIds: PaneId[] = [];
    const removedTabIds: TabId[] = [];
    if (!opts.skipTabCleanup) {
      for (const tabId of ws.tabIds) {
        const tab = this.tabs.get(tabId);
        if (!tab) continue;
        removedPaneIds.push(...Layout.leaves(tab.layout));
        for (const pid of Layout.leaves(tab.layout)) this.panes.delete(pid);
        this.tabs.delete(tabId);
        removedTabIds.push(tabId);
      }
    }
    this.workspaces.delete(id);
    if (this.focus?.workspaceId === id) {
      this.focus = null;
      const first = this.workspaces.values().next();
      if (!first.done) {
        const w = first.value;
        const t = this.requireTab(w.activeTabId);
        this.focus = { workspaceId: w.id, tabId: t.id, paneId: t.focusedPaneId };
      }
    }
    return { removedPaneIds, removedTabIds, closedWorkspaceId: id };
  }

  /** tab を閉じた結果（a）に、それが引き起こした workspace の閉鎖の結果（b）を重ねる。 */
  private mergeRemoval(a: RemovalResult, b: RemovalResult): RemovalResult {
    return {
      removedPaneIds: [...a.removedPaneIds, ...b.removedPaneIds],
      removedTabIds: [...a.removedTabIds, ...b.removedTabIds],
      closedWorkspaceId: b.closedWorkspaceId ?? a.closedWorkspaceId,
    };
  }

  // --- pane operations --------------------------------------------------------

  focusPane(paneId: PaneId): void {
    const pane = this.requirePane(paneId);
    const tab = this.requireTab(pane.tabId);
    this.tabs.set(tab.id, { ...tab, focusedPaneId: paneId });
    const ws = this.requireWorkspace(tab.workspaceId);
    this.workspaces.set(ws.id, { ...ws, activeTabId: tab.id });
    this.setFocus(ws.id, tab.id, paneId);
  }

  renamePane(id: PaneId, label: string | null): Pane {
    const pane = this.requirePane(id);
    const updated = { ...pane, label };
    this.panes.set(id, updated);
    return updated;
  }

  setRightClick(id: PaneId, target: RightClickTarget): void {
    const pane = this.requirePane(id);
    this.panes.set(id, { ...pane, rightClick: target });
  }

  focusDirection(paneId: PaneId, direction: Dir): PaneId {
    const pane = this.requirePane(paneId);
    const tab = this.requireTab(pane.tabId);
    const neighbor = Layout.neighbor(tab.layout, paneId, direction);
    const target = neighbor ?? paneId;
    if (target !== paneId) this.focusPane(target);
    return target;
  }

  swapPane(paneId: PaneId, direction: Dir): PaneId {
    const pane = this.requirePane(paneId);
    const tab = this.requireTab(pane.tabId);
    const neighbor = Layout.neighbor(tab.layout, paneId, direction);
    if (!neighbor) return paneId;
    const newLayout = Layout.swap(tab.layout, paneId, neighbor);
    this.tabs.set(tab.id, { ...tab, layout: newLayout });
    return neighbor;
  }

  /**
   * 任意の2つの pane を入れ替える（20260923-pane-name-dnd-swap。ドラッグでの入れ替え用。
   * `swapPane` と違い隣接である必要は無い。design D4）。同一 tab の別 pane でなければ何もせず false。
   */
  swapPaneWith(paneId: PaneId, otherPaneId: PaneId): boolean {
    if (paneId === otherPaneId) return false;
    const pane = this.requirePane(paneId);
    const other = this.panes.get(otherPaneId);
    if (!other || other.tabId !== pane.tabId) return false;
    const tab = this.requireTab(pane.tabId);
    this.tabs.set(tab.id, { ...tab, layout: Layout.swap(tab.layout, paneId, otherPaneId) });
    return true;
  }

  zoomPane(paneId: PaneId, mode: "toggle" | "on" | "off"): void {
    const pane = this.requirePane(paneId);
    const tab = this.requireTab(pane.tabId);
    const next = mode === "toggle" ? (tab.zoomedPaneId === paneId ? null : paneId) : mode === "on" ? paneId : null;
    this.tabs.set(tab.id, { ...tab, zoomedPaneId: next });
  }

  cyclePane(fromPaneId: PaneId, delta: 1 | -1): PaneId {
    const pane = this.requirePane(fromPaneId);
    const tab = this.requireTab(pane.tabId);
    const next = Layout.cycleOrder(tab.layout, fromPaneId, delta);
    this.focusPane(next);
    return next;
  }

  setSplitRatio(tabId: TabId, splitId: SplitId, ratio: number): void {
    const tab = this.requireTab(tabId);
    this.tabs.set(tabId, { ...tab, layout: Layout.setRatio(tab.layout, splitId, ratio) });
  }

  resizeByDirection(paneId: PaneId, direction: Dir, amount: number): void {
    const pane = this.requirePane(paneId);
    const tab = this.requireTab(pane.tabId);
    this.tabs.set(tab.id, { ...tab, layout: Layout.resizeBy(tab.layout, paneId, direction, amount) });
  }

  /** pane の文字セル数（PTY・ミラーの resize と対にする。cols/rows の実値そのものの変更）。 */
  setPaneSize(paneId: PaneId, cols: number, rows: number): void {
    const pane = this.requirePane(paneId);
    this.panes.set(paneId, { ...pane, cols, rows });
  }

  /** サイズ権限を持つクライアントの id（design「サイズ権限」）。 */
  setTabSizeOwner(tabId: TabId, clientId: string | null): void {
    const tab = this.requireTab(tabId);
    this.tabs.set(tabId, { ...tab, sizeOwnerClientId: clientId });
  }

  updatePaneRuntime(paneId: PaneId, patch: { busy?: boolean; cwd?: string; title?: string; agent?: AgentInfo | null; agentSession?: AgentSessionRef | null }): Pane {
    const pane = this.requirePane(paneId);
    const updated: Pane = {
      ...pane,
      busy: patch.busy ?? pane.busy,
      cwd: patch.cwd ?? pane.cwd,
      title: patch.title ?? pane.title,
      agent: patch.agent !== undefined ? patch.agent : pane.agent,
      agentSession: patch.agentSession !== undefined ? patch.agentSession : pane.agentSession,
    };
    this.panes.set(paneId, updated);
    return updated;
  }

  /** 公式フック連携（20260923-agent-session-resume）が報告した会話参照を反映する。 */
  setAgentSession(paneId: PaneId, agentSession: AgentSessionRef | null): Pane {
    const pane = this.requirePane(paneId);
    const updated: Pane = { ...pane, agentSession };
    this.panes.set(paneId, updated);
    return updated;
  }

  markPaneFailed(paneId: PaneId, failure: string): Pane {
    const pane = this.requirePane(paneId);
    const updated: Pane = { ...pane, status: "failed", failure };
    this.panes.set(paneId, updated);
    return updated;
  }

  updateWorkspaceGit(workspaceId: WorkspaceId, git: GitInfo | null): Workspace {
    const ws = this.requireWorkspace(workspaceId);
    const updated = { ...ws, git };
    this.workspaces.set(workspaceId, updated);
    return updated;
  }

  private setFocus(workspaceId: WorkspaceId, tabId: TabId, paneId: PaneId, opts?: { setTabFocusedPane?: boolean }): void {
    this.focus = { workspaceId, tabId, paneId };
    if (opts?.setTabFocusedPane) {
      const tab = this.tabs.get(tabId);
      if (tab) this.tabs.set(tabId, { ...tab, focusedPaneId: paneId });
    }
  }

  // --- snapshot / restore -----------------------------------------------------

  buildSnapshot(serverVersion: string, host: HostInfo, limits: SessionLimits): SessionSnapshot {
    return {
      protocol: 1,
      serverVersion,
      host,
      workspaces: this.listWorkspaces(),
      tabs: this.listTabs(),
      panes: this.listPanes(),
      focus: this.focus,
      limits,
    };
  }

  isEmpty(): boolean {
    return this.workspaces.size === 0;
  }

  /**
   * `session.json` から、保存されていた id をそのまま使って組み立てる（副作用なし。id は払い出さない）。
   * pane は既定で `status: 'running'` とし、実際にシェルを起動できたかどうかは `SessionService` が
   * `markPaneFailed` で反映する（design「再起動後の復元」）。
   */
  restoreWorkspace(data: SessionFileWorkspace, autoLabel: boolean): void {
    const workspace: Workspace = {
      id: data.id,
      label: data.label,
      cwd: data.cwd,
      tabIds: data.tabs.map((t) => t.id),
      activeTabId: data.activeTabId,
      groupId: null,
      git: null,
      autoLabel, // 呼ぶ側（`SessionService.restore`）が決める
    };
    this.workspaces.set(workspace.id, workspace);
    for (const tabData of data.tabs) {
      const tab: Tab = {
        id: tabData.id,
        workspaceId: workspace.id,
        label: tabData.label,
        layout: tabData.layout,
        focusedPaneId: tabData.focusedPaneId,
        zoomedPaneId: tabData.zoomedPaneId,
        sizeOwnerClientId: null,
      };
      this.tabs.set(tab.id, tab);
      for (const paneData of tabData.panes) {
        const pane = this.makePane(paneData.id, tab.id, {
          label: paneData.label,
          cwd: paneData.cwd,
          shell: paneData.shell,
          cols: 120,
          rows: 40,
        });
        // 会話参照は `makePane` の対象外（新規作成では持たない情報）なので、復元のときだけ載せる
        // （20260923-agent-session-resume design D2。無ければ以前の版の保存データ、または
        // そもそも報告が無かった pane で、null のままでよい）。
        if (paneData.agentSession) {
          pane.agentSession = {
            // 持続化は将来のエージェント種別も見越して `kind: string`（design D2）。ここでのキャストは
            // 表示・引き回し用のもので、実際に resume コマンドを引けるかどうかは復元処理側
            // （T5 の解決テーブル）が未知の kind を無害に無視することで安全側に倒す。
            kind: paneData.agentSession.kind as AgentIntegrationKind,
            sessionId: paneData.agentSession.sessionId,
            reportedAt: paneData.agentSession.reportedAt,
          };
        }
        this.panes.set(pane.id, pane);
      }
    }
  }
}
