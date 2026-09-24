import type {
  AgentInfo,
  AgentIntegrationKind,
  Dir,
  GitInfo,
  GroupId,
  HostInfo,
  NewCwd,
  Pane,
  PaneId,
  RightClickTarget,
  SessionSnapshot,
  SplitDirection,
  SplitId,
  Tab,
  TabId,
  Workspace,
  WorkspaceGroup,
  WorkspaceId,
} from "@wtm/protocol";
import { RpcError } from "@wtm/protocol";
import type { SessionFileData, SessionFilePane, SessionFileTab, SessionFileWorkspace } from "../persist/SessionFile.js";
import type { TerminalManager } from "../terminal/TerminalManager.js";
import type { EventBus } from "../bus/EventBus.js";
import { NotFoundError, SessionModel } from "./SessionModel.js";
import { resumeCommandFor } from "../agent/resumeCommand.js";
import { resolveNewCwd, type NewCwdDeps } from "./newCwd.js";
import { autoWorkspaceLabel, defaultWorkspaceLabelDeps, folderLabelOf, type WorkspaceLabelDeps } from "./workspaceLabel.js";
import { monotonicNow } from "../log/LogThrottle.js";
import type { PersistScheduler } from "./PersistScheduler.js";
import type { Logger } from "../log/Logger.js";

/** クライアントが 1 台も無いときの既定サイズ（design「サイズ権限」。herdr の headless_cols/rows と同じ考え方）。 */
const HEADLESS_COLS = 120;
const HEADLESS_ROWS = 40;
/** D37：シェルの起動が「短い猶予の間に終了するか」で失敗を判定する。 */
const DEFAULT_SPAWN_GRACE_MS = 300;

export interface PaneRuntimePatch {
  busy?: boolean;
  cwd?: string;
  title?: string;
  agent?: AgentInfo | null;
}

/**
 * 復元で自動の名前を決めるのにかける合計の時間（20260921-workspace-auto-label の review ラウンド 2）。1 つずつ決めるので、遅いだけの fs でも
 * 数に比例して `/ws` の受け付けが遅れる——超えたら残りは根を探さずフォルダ名にする（最悪でもこれと 1 回分の上限の和）。
 */
const RESTORE_LABEL_BUDGET_MS = 1000;

export interface SessionServiceOptions {
  model: SessionModel;
  terminals: TerminalManager;
  bus: EventBus;
  persist: PersistScheduler;
  serverVersion: string;
  host: HostInfo;
  scrollbackLines: number;
  spawnGraceMs?: number;
  defaultCwd: string;
  /** `--shell`（新しい pane のシェル）。省略時は OS の既定（`ProcessInspector.defaultShell()`。T27）。 */
  shell?: string | undefined;
  logger: Logger;
  /**
   * 新しく開く場所の方針（`newCwd`）を場所に変える依存（20260921-new-terminal-cwd の design D6。`composeServer` が `makeNewCwdDeps` で作る）。
   * **任意**——無ければ `newCwd` を見ない（今までどおり）。
   */
  newCwdDeps?: NewCwdDeps | undefined;
  /**
   * workspace の自動の名前を決める依存（20260921-workspace-auto-label の design D3）。省略時は本物の fs と `os.homedir`。
   * テストは偽物を渡して、手元のファイルシステムに依存させない。
   */
  workspaceLabelDeps?: WorkspaceLabelDeps | undefined;
  /** 復元の合計の期限を測る時計（ms）。既定は単調な `monotonicNow`（壁時計は戻りうる。D103 の独立点検 #8）。テストで差し替える。 */
  clock?: { now(): number } | undefined;
  /**
   * 公式フック連携（20260923-agent-session-resume）の report を受け取るローカル socket のパス。
   * pane 起動時に `WTM_AGENT_REPORT_SOCKET` として環境変数に渡す。未設定（socket の起動に失敗した等）
   * なら渡さない——hook 側は env が無ければ無害に何もしない（design「5. hook スクリプト」）。
   */
  agentReportSocketPath?: string | undefined;
  /**
   * 自動再開の可否を都度読む（設定画面から切り替えられるため、構築時に固定値で受け取らない。
   * design D3）。省略時は既定 ON（herdr の `resume_agents_on_restore` の既定に合わせる）。
   */
  getAutoResumeEnabled?: (() => boolean) | undefined;
}

/**
 * モデルを書き換える唯一の入口（architecture.md「SessionService」・依存の規則 3）。
 * 検証 → モデルの変更 → 端末の生成・破棄 → イベント → 保存の予約、の順で行う。
 */
export class SessionService {
  private readonly model: SessionModel;
  private readonly terminals: TerminalManager;
  private readonly bus: EventBus;
  private readonly persist: PersistScheduler;
  private readonly serverVersion: string;
  private readonly host: HostInfo;
  private readonly scrollbackLines: number;
  private readonly spawnGraceMs: number;
  private readonly defaultCwd: string;
  private readonly shell: string | undefined;
  private readonly logger: Logger;
  private readonly newCwdDeps: NewCwdDeps | undefined;
  private readonly workspaceLabelDeps: WorkspaceLabelDeps;
  private readonly agentReportSocketPath: string | undefined;
  private readonly getAutoResumeEnabled: () => boolean;
  /**
   * 上限を超えたまままだ返っていない、根を探す問い合わせの数（review ラウンド 1・2）。0 でない間は新しく根を探さずフォルダ名にする——応答しない fs
   * （止まった NFS 等）への stat は取り消せず libuv のスレッドを塞ぐので、重ねてサーバ全体の fs を止めない。遅いだけなら返った時点で元に戻る。
   */
  private labelLookupsStuck = 0;
  private readonly clock: { now(): number };
  /**
   * workspace ごとの名前変更の世代（20260921-workspace-auto-label の design D9）。名前変更のたびに進め、自動の名前に戻す待ち（await）から
   * 戻ったときに世代が変わっていれば、後から来た名前変更が勝つ（古い結果を捨てる）。workspace が閉じたら消す。
   */
  private readonly labelGen = new Map<WorkspaceId, number>();

  constructor(opts: SessionServiceOptions) {
    this.model = opts.model;
    this.terminals = opts.terminals;
    this.bus = opts.bus;
    this.persist = opts.persist;
    this.serverVersion = opts.serverVersion;
    this.host = opts.host;
    this.scrollbackLines = opts.scrollbackLines;
    this.spawnGraceMs = opts.spawnGraceMs ?? DEFAULT_SPAWN_GRACE_MS;
    this.defaultCwd = opts.defaultCwd;
    this.shell = opts.shell;
    this.logger = opts.logger;
    this.newCwdDeps = opts.newCwdDeps;
    this.clock = opts.clock ?? { now: monotonicNow };
    this.agentReportSocketPath = opts.agentReportSocketPath;
    this.getAutoResumeEnabled = opts.getAutoResumeEnabled ?? (() => true);
    const labelDeps = opts.workspaceLabelDeps ?? defaultWorkspaceLabelDeps;
    this.workspaceLabelDeps = {
      ...labelDeps,
      onTimeout: (settled) => {
        this.labelLookupsStuck++;
        // 数を戻す処理はログより先に付ける——warn が投げても数が戻る（review ラウンド 3）。
        void settled.then(() => {
          this.labelLookupsStuck--;
        });
        this.logger.warn("workspace label lookup timed out; using folder names until it returns", { stuck: this.labelLookupsStuck });
        labelDeps.onTimeout?.(settled);
      },
    };
  }

  /**
   * 新しい pane の場所。`newCwd` が無い・依存が無ければ `fallback`（今までどおり）を**同期で**返し、あれば `newCwd.ts` の規則で決める
   * Promise を返す（20260921-new-terminal-cwd）。呼ぶ側は **Promise のときだけ `await` する**——方針の無い要求では、以前と同じく
   * 起動（`spawnForPane`）までを同期で進め、猶予の競走の起点を変えない（`SessionService.test.ts` の分割の孤児のテストが前提にしている）。
   * **例外：workspace の作成で名前を決めるとき**は、起動の前に名前を待つ（20260921-workspace-auto-label の design D4b・decisions D1）。
   * **場所を明示する `cwd`（worktree）はここを通さない**——呼ぶ側で先に使う（design D5）。
   */
  private placeFor(
    newCwd: NewCwd | undefined,
    sourcePaneId: PaneId | undefined,
    fallback: string,
  ): { cwd: string; fellBack: boolean } | Promise<{ cwd: string; fellBack: boolean }> {
    if (!newCwd || !this.newCwdDeps) return { cwd: fallback, fellBack: false };
    return resolveNewCwd(newCwd, sourcePaneId, fallback, this.newCwdDeps);
  }

  snapshot(): SessionSnapshot {
    return this.model.buildSnapshot(this.serverVersion, this.host, { scrollbackLines: this.scrollbackLines });
  }

  // --- 読み取り専用のアクセサ（`SizeAuthority`・`AgentMonitor` 等、読むだけの相手向け） -------

  getWorkspace(id: WorkspaceId): Workspace | undefined {
    return this.model.getWorkspace(id);
  }
  getTab(id: TabId): Tab | undefined {
    return this.model.getTab(id);
  }
  getPane(id: PaneId): Pane | undefined {
    return this.model.getPane(id);
  }

  /** tab ごとのサイズ権限（`SizeAuthority`。design「サイズ権限」）。イベントは出さない内部の帳簿なので、
   *  ここだけ意図的に `SessionModel` を直接書き換える薄い通り道にする。 */
  setTabSizeOwner(tabId: TabId, clientId: string | null): void {
    this.model.setTabSizeOwner(tabId, clientId);
  }

  /** `session.json` の保存に使う（`nextId` の引き継ぎ。design「永続化の形式」）。 */
  getNextIdCounters(): ReturnType<SessionModel["getNextIdCounters"]> {
    return this.model.getNextIdCounters();
  }

  /** 検出したエージェントのインスタンス id を払い出す（`"a1"` 等。02-agent-detection の `AgentTracker` が使う。T8）。
   *  `nextId` は `session.json` に永続化されるので、再起動後も重複しない（design「done」の注記）。 */
  allocateAgentInstanceId(): string {
    const id = this.model.nextId("a");
    this.persist.touch();
    return id;
  }

  // --- workspace ------------------------------------------------------------

  async createWorkspace(
    cwd: string | undefined,
    label: string | undefined,
    newCwd?: NewCwd,
  ): Promise<{ workspace: Workspace; tab: Tab; pane: Pane; cwdFallback?: true }> {
    // **明示した `cwd`（worktree を開く）が方針に勝ち、代わりへは回さない**（design D5。使えなければ今までどおり spawn_failed）。
    const pending = cwd !== undefined ? { cwd, fellBack: false } : this.placeFor(newCwd, followSource(newCwd), this.defaultCwd);
    const place = pending instanceof Promise ? await pending : pending;
    const resolvedCwd = place.cwd;
    // 名前が無い（空白だけを含む）なら、開く場所から自動の名前を決めて**から**予約と起動へ進む（20260921-workspace-auto-label の design D4b）。
    // 起動の成功から commit までの間に await を挟むと、その間に終わったシェルの pane を `closePaneAfterExit` が見つけられず残る
    // （decisions D1）。名前を渡したとき（worktree）は待たない。
    const named = label?.trim() ? { label, autoLabel: false } : this.autoLabelFor(resolvedCwd);
    const naming = named instanceof Promise ? await named : named;
    // D37「成功を確認してからモデルを更新する順にする」：先に id とオブジェクトだけ用意し（reserve）、
    // spawn の成功を確認してから初めて Map へ入れる（commit）。レビュー指摘：以前は逆順で、
    // 猶予期間中に他クライアントが「存在するはずの無い」workspace を読めてしまっていた。
    const reserved = this.model.reserveWorkspace(resolvedCwd, naming.label, naming.autoLabel, {
      cwd: resolvedCwd,
      shell: this.shell ?? "",
      cols: HEADLESS_COLS,
      rows: HEADLESS_ROWS,
    });
    const spawn = await this.spawnForPane(reserved.pane.id, resolvedCwd);
    if (!spawn.ok) {
      // まだ Map に入れていないので、モデル側のロールバックは不要（イベントも出していない）。
      throw new RpcError("spawn_failed", `failed to start a shell for workspace ${reserved.workspace.id}`);
    }
    this.model.commitWorkspace(reserved);
    this.bus.publish({ event: "workspace.created", data: { workspace: reserved.workspace } });
    // `workspace.create` は最初の tab も一緒に作る（design「`workspace.create`」の応答に `tab` を含む）。
    // 応答の `tab` だけでは、この操作を出した本人以外のクライアント（複数タブ・複数ブラウザ。AC9）が
    // `session.tabs` にその tab を持てない——`tab.created` を必ず別途 publish する（05-e2e-docs T2 の
    // E2E で発見。D88）。
    this.bus.publish({ event: "tab.created", data: { tab: reserved.tab } });
    this.bus.publish({ event: "pane.created", data: { pane: reserved.pane } });
    this.persist.touch();
    if (spawn.alreadyExited) await this.closePaneAfterExit(reserved.pane.id, 0); // D37：猶予中に code 0 で即終了していた
    return { workspace: reserved.workspace, tab: reserved.tab, pane: reserved.pane, ...(place.fellBack ? { cwdFallback: true as const } : {}) };
  }

  /** 開く場所から自動の名前を決める。`autoWorkspaceLabel` は投げないが、万一 reject しても作成を失敗させない（design のエラー処理の表）。 */
  private async autoLabelFor(cwd: string): Promise<{ label: string; autoLabel: true }> {
    // 上限を超えた問い合わせがまだ返っていない間は、fs に問い合わせない（`labelLookupsStuck`）。
    if (this.labelLookupsStuck > 0) return { label: folderLabelOf(cwd, this.workspaceLabelDeps), autoLabel: true };
    const label = await autoWorkspaceLabel(cwd, this.workspaceLabelDeps).catch(() => folderLabelOf(cwd, this.workspaceLabelDeps));
    return { label, autoLabel: true };
  }

  /**
   * 名前を付ける（文字列）か、自動の名前に戻す（null・空白だけ。20260921-workspace-auto-label の design D5・D10）。**要求の時点で workspace が
   * 無ければ `RpcError("not_found")` で拒否する**（待つ前に確かめる）。自動の名前は `ws.cwd` から決め直し、待っている間に別の名前変更が来たら
   * そちらが勝つ（design D9）。待っている間に workspace が閉じられたら何もしない（保存も予約しない）。
   */
  async renameWorkspace(id: WorkspaceId, label: string | null): Promise<void> {
    const ws = this.requireWorkspace(id);
    const gen = (this.labelGen.get(id) ?? 0) + 1;
    this.labelGen.set(id, gen);
    const named = label?.trim() ? { label, autoLabel: false } : await this.autoLabelFor(ws.cwd);
    if (this.labelGen.get(id) !== gen || !this.model.getWorkspace(id)) return;
    const updated = this.model.renameWorkspace(id, named.label, named.autoLabel);
    this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
    this.persist.touch();
  }

  focusWorkspace(id: WorkspaceId): void {
    this.model.focusWorkspace(id);
    this.bus.publish({ event: "session.focus_changed", data: { focus: this.model.getFocus() } });
    this.persist.touch(); // focus は session.json に永続化される（レビュー指摘：抜けていた）
  }

  /**
   * `closeLinkedWorktrees`（20260923-workspace-grouping。herdr の `close_group` 相当）：true かつ
   * `id` が worktree 自動グループの本体なら、束ねられた worktree も連鎖して閉じる。対象を
   * **モデルを書き換える前に**問い合わせる（`linkedWorktreeGroupMembers` は副作用なし）——
   * 本体を先に閉じてから子を探すと git 情報の手掛かりが失われる。それぞれの workspace は
   * 既存の1件ずつのクローズ処理をそのまま繰り返す（design には無いエッジケース。
   * 複数 workspace の確認は client 側の `confirmClose` が既に同じ形でループしている）。
   */
  async closeWorkspace(id: WorkspaceId, closeLinkedWorktrees = false): Promise<void> {
    const targets = closeLinkedWorktrees ? [id, ...this.model.linkedWorktreeGroupMembers(id)] : [id];
    for (const targetId of targets) await this.closeWorkspaceOne(targetId);
    await this.recreateIfEmpty(); // D24
  }

  private async closeWorkspaceOne(id: WorkspaceId): Promise<void> {
    const result = this.model.closeWorkspace(id);
    for (const paneId of result.removedPaneIds) this.terminals.dispose(paneId);
    // design「連鎖して閉じるときは pane.closed → tab.closed → workspace.closed の順」（D42 で漏れを修正）。
    for (const paneId of result.removedPaneIds) this.bus.publish({ event: "pane.closed", data: { paneId } });
    for (const tabId of result.removedTabIds) this.bus.publish({ event: "tab.closed", data: { tabId } });
    this.bus.publish({ event: "workspace.closed", data: { workspaceId: id } });
    this.labelGen.delete(id);
    this.persist.touch();
  }

  // --- workspace の並べ替えとグループ（20260923-workspace-grouping） ----------------------

  /** `workspace.move`。無変化（`model.moveWorkspace` が null）なら何も配布しない
   *  （`moveTab` と同じ形。design「エラー処理 / 異常系」）。動いた全順序を
   *  `workspace.order_changed` で配る（decisions.md D5：個々の Workspace は変わらないため）。 */
  moveWorkspace(id: WorkspaceId, direction: "previous" | "next"): void {
    const updated = this.model.moveWorkspace(id, direction);
    if (updated) {
      this.bus.publish({ event: "workspace.order_changed", data: { workspaceIds: updated.map((w) => w.id) } });
      this.persist.touch();
    }
  }

  /** `workspace.move_to`（D&D。単一・グループ一括の両方を同じ経路で扱う）。 */
  moveWorkspacesTo(workspaceIds: WorkspaceId[], beforeWorkspaceId: WorkspaceId | null): void {
    const updated = this.model.moveWorkspacesTo(workspaceIds, beforeWorkspaceId);
    if (updated) {
      this.bus.publish({ event: "workspace.order_changed", data: { workspaceIds: updated.map((w) => w.id) } });
      this.persist.touch();
    }
  }

  createGroup(label: string): WorkspaceGroup {
    const group = this.model.createGroup(label);
    this.bus.publish({ event: "group.created", data: { group } });
    this.persist.touch();
    return group;
  }

  renameGroup(id: GroupId, label: string): void {
    const group = this.model.renameGroup(id, label);
    this.bus.publish({ event: "group.updated", data: { group } });
    this.persist.touch();
  }

  toggleGroupCollapsed(id: GroupId): void {
    const group = this.model.toggleGroupCollapsed(id);
    this.bus.publish({ event: "group.updated", data: { group } });
    this.persist.touch();
  }

  /** メンバーの `groupId` が null に戻る（`SessionModel.deleteGroup`）ので、それぞれ
   *  `workspace.updated` で知らせる——**削除する前に**対象を控える（削除後は `groupId` が
   *  既に外れていて探せない）。 */
  deleteGroup(id: GroupId): void {
    const members = this.model.listWorkspaces().filter((w) => w.groupId === id);
    this.model.deleteGroup(id);
    this.bus.publish({ event: "group.deleted", data: { groupId: id } });
    for (const ws of members) {
      const updated = this.model.getWorkspace(ws.id);
      if (updated) this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
    }
    this.persist.touch();
  }

  addToGroup(workspaceId: WorkspaceId, groupId: GroupId): void {
    const updated = this.model.addToGroup(workspaceId, groupId);
    this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
    this.persist.touch();
  }

  removeFromGroup(workspaceId: WorkspaceId): void {
    const updated = this.model.removeFromGroup(workspaceId);
    this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
    this.persist.touch();
  }

  // --- tab --------------------------------------------------------------------

  async createTab(
    workspaceId: WorkspaceId | undefined,
    label: string | undefined,
    newCwd?: NewCwd,
  ): Promise<{ tab: Tab; pane: Pane; cwdFallback?: true }> {
    const wsId = workspaceId ?? this.model.getFocus()?.workspaceId;
    if (!wsId) throw new RpcError("not_found", "no workspace to create a tab in");
    const ws = this.requireWorkspace(wsId);
    // 1 段目の代わりは workspace の場所（以前と同じ）。**`Workspace.cwd` は書き換えない**（git の情報と worktree が使う）。
    const pending = this.placeFor(newCwd, followSource(newCwd), ws.cwd);
    const place = pending instanceof Promise ? await pending : pending;
    // 新しい pane の記録（`Pane.cwd`）も決めた場所にする——起動の場所と記録を食い違わせない（design「振る舞いの詳細」）。
    const reserved = this.model.reserveTab(ws.id, label, { cwd: place.cwd, shell: this.shell ?? "", cols: HEADLESS_COLS, rows: HEADLESS_ROWS });
    const spawn = await this.spawnForPane(reserved.pane.id, place.cwd);
    if (!spawn.ok) {
      throw new RpcError("spawn_failed", `failed to start a shell for tab ${reserved.tab.id}`);
    }
    try {
      this.model.commitTab(reserved); // 猶予中に workspace 自体が閉じられていたら NotFoundError
    } catch (err) {
      this.terminals.dispose(reserved.pane.id); // 孤児化した PTY を破棄してから伝える
      throw err;
    }
    this.bus.publish({ event: "tab.created", data: { tab: reserved.tab } });
    this.bus.publish({ event: "pane.created", data: { pane: reserved.pane } });
    // `commitTab` は workspace の `tabIds`/`activeTabId` も更新する（`SessionModel.commitTab`）が、
    // それを知らせる `workspace.updated` が無かった——サイドバー・tab バー等、`workspace.tabIds` を
    // 読む側（`TabBar.vue` 等）が新しい tab を認識できないまま止まっていた（同上・D88）。
    const updatedWs = this.model.getWorkspace(ws.id);
    if (updatedWs) this.bus.publish({ event: "workspace.updated", data: { workspace: updatedWs } });
    this.persist.touch();
    if (spawn.alreadyExited) await this.closePaneAfterExit(reserved.pane.id, 0);
    return { tab: reserved.tab, pane: reserved.pane, ...(place.fellBack ? { cwdFallback: true as const } : {}) };
  }

  renameTab(id: TabId, label: string): void {
    const tab = this.model.renameTab(id, label);
    this.bus.publish({ event: "tab.updated", data: { tab } });
    this.persist.touch();
  }

  focusTab(id: TabId): void {
    this.model.focusTab(id);
    this.bus.publish({ event: "session.focus_changed", data: { focus: this.model.getFocus() } });
    this.persist.touch();
  }

  /** `tab.move`（20260923-missing-keybinding-actions）。tabIds.length<=1 等で無変化なら `model.moveTab` が
   * `null` を返し、`workspace.updated` を発行しない（design「エラー処理 / 異常系」）。 */
  moveTab(id: TabId, direction: "previous" | "next"): void {
    const updated = this.model.moveTab(id, direction);
    if (updated) {
      this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
      this.persist.touch();
    }
  }

  async closeTab(id: TabId): Promise<void> {
    const workspaceId = this.requireTab(id).workspaceId; // tab が消える前に控える（下の workspace.updated 用。D88）
    const result = this.model.closeTab(id);
    for (const paneId of result.removedPaneIds) this.terminals.dispose(paneId);
    // design「連鎖して閉じるときは pane.closed → tab.closed → workspace.closed の順」（D42 で漏れを修正）。
    for (const paneId of result.removedPaneIds) this.bus.publish({ event: "pane.closed", data: { paneId } });
    for (const tabId of result.removedTabIds) this.bus.publish({ event: "tab.closed", data: { tabId } });
    if (result.closedWorkspaceId) {
      this.bus.publish({ event: "workspace.closed", data: { workspaceId: result.closedWorkspaceId } });
      this.labelGen.delete(result.closedWorkspaceId);
    } else {
      // workspace 自体は生き残った＝`model.closeTab` が `tabIds`/`activeTabId` を更新している
      // （`SessionModel.closeTabInternal`）。その変化を知らせる（D88。上の createTab と対）。
      const updatedWs = this.model.getWorkspace(workspaceId);
      if (updatedWs) this.bus.publish({ event: "workspace.updated", data: { workspace: updatedWs } });
    }
    this.persist.touch();
    await this.recreateIfEmpty(); // D24
  }

  // --- pane -------------------------------------------------------------------

  async splitPane(
    paneId: PaneId,
    direction: SplitDirection,
    ratio: number | undefined,
    newCwd?: NewCwd,
  ): Promise<{ pane: Pane; cwdFallback?: true }> {
    const source = this.requirePane(paneId);
    // 「引き継ぐ」の元は分割する pane そのもの。1 段目の代わりはその記録された場所（以前と同じ）。
    const pending = this.placeFor(newCwd, paneId, source.cwd);
    const place = pending instanceof Promise ? await pending : pending;
    // 場所を決める間（await の間）に分割元が閉じられていたら、シェルを起動する前に失敗する（`createTab` は `reserveTab` で確かめ直す）。
    this.requirePane(paneId);
    const newPaneId = this.model.reserveNextPaneId();
    const spawn = await this.spawnForPane(newPaneId, place.cwd);
    if (!spawn.ok) throw new RpcError("spawn_failed", `failed to start a shell for a new pane split from ${paneId}`);
    let pane: Pane;
    try {
      // 猶予中（await の間）に分割元の pane/tab が別の RPC で閉じられていたら、ここで NotFoundError
      // （`requirePane`/`requireTab`）。その場合は孤児化した PTY を破棄してから伝える
      // （`createTab` の `commitTab` 失敗時と同じ理由・同じ形。レビュー指摘・round2）。
      ({ pane } = this.model.splitPane(paneId, direction, ratio, newPaneId, { cwd: place.cwd, shell: this.shell ?? "", cols: source.cols, rows: source.rows }));
    } catch (err) {
      this.terminals.dispose(newPaneId);
      throw err;
    }
    this.bus.publish({ event: "pane.created", data: { pane } });
    this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(source.tabId) } });
    this.persist.touch();
    if (spawn.alreadyExited) await this.closePaneAfterExit(pane.id, 0);
    return { pane, ...(place.fellBack ? { cwdFallback: true as const } : {}) };
  }

  async closePane(paneId: PaneId): Promise<void> {
    const pane = this.model.getPane(paneId);
    const tabId = pane?.tabId;
    const workspaceId = tabId ? this.model.getTab(tabId)?.workspaceId : undefined; // tab が消える前に控える（D88）
    const result = this.model.closePane(paneId);
    for (const pid of result.removedPaneIds) this.terminals.dispose(pid);
    for (const pid of result.removedPaneIds) this.bus.publish({ event: "pane.closed", data: { paneId: pid } });
    for (const tid of result.removedTabIds) this.bus.publish({ event: "tab.closed", data: { tabId: tid } });
    if (result.closedWorkspaceId) {
      this.bus.publish({ event: "workspace.closed", data: { workspaceId: result.closedWorkspaceId } });
      this.labelGen.delete(result.closedWorkspaceId);
    } else if (result.removedTabIds.length > 0 && workspaceId) {
      // pane を閉じた結果、tab ごと連鎖して閉じたが workspace は生き残った（D18 の連鎖・closeTab と同じ形。D88）。
      const updatedWs = this.model.getWorkspace(workspaceId);
      if (updatedWs) this.bus.publish({ event: "workspace.updated", data: { workspace: updatedWs } });
    }
    if (result.removedTabIds.length === 0 && tabId) {
      // tab は生きているので、レイアウトが変わったことを知らせる。
      const stillThere = this.model.getTab(tabId);
      if (stillThere) this.bus.publish({ event: "layout.updated", data: { tab: stillThere } });
    }
    this.persist.touch();
    await this.recreateIfEmpty(); // D24
  }

  focusPane(paneId: PaneId): void {
    this.model.focusPane(paneId);
    this.bus.publish({ event: "session.focus_changed", data: { focus: this.model.getFocus() } });
    this.persist.touch();
  }

  renamePane(id: PaneId, label: string | null): void {
    const pane = this.model.renamePane(id, label);
    this.bus.publish({ event: "pane.updated", data: { pane } });
    this.persist.touch();
  }

  setPaneRightClick(id: PaneId, target: RightClickTarget): void {
    this.model.setRightClick(id, target);
    this.bus.publish({ event: "pane.updated", data: { pane: this.requirePane(id) } });
  }

  focusPaneDirection(paneId: PaneId, direction: Dir): PaneId {
    const target = this.model.focusDirection(paneId, direction);
    this.bus.publish({ event: "session.focus_changed", data: { focus: this.model.getFocus() } });
    this.persist.touch();
    return target;
  }

  swapPane(paneId: PaneId, direction: Dir): PaneId {
    const other = this.model.swapPane(paneId, direction);
    if (other !== paneId) {
      const pane = this.requirePane(paneId);
      this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
      this.persist.touch();
    }
    return other;
  }

  /** 任意の2つの pane を入れ替える（20260923-pane-name-dnd-swap。design「3. サーバ側」）。 */
  swapPaneWith(paneId: PaneId, otherPaneId: PaneId): boolean {
    const ok = this.model.swapPaneWith(paneId, otherPaneId);
    if (ok) {
      const pane = this.requirePane(paneId);
      this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
      this.persist.touch();
    }
    return ok;
  }

  /**
   * 名前ラベルのドラッグを pane の縁へドロップしての分割（20260924-pane-dnd-split-move。
   * `swapPaneWith` と同じ形——レイアウトだけを書き換え、`layout.updated` を1回配布する）。
   */
  moveToEdge(paneId: PaneId, targetPaneId: PaneId, edge: "top" | "bottom" | "left" | "right"): boolean {
    const ok = this.model.moveToEdge(paneId, targetPaneId, edge);
    if (ok) {
      const pane = this.requirePane(paneId);
      this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
      this.persist.touch();
    }
    return ok;
  }

  /**
   * 名前ラベルのドラッグを pane の中央へドロップしての分割解除（20260924-pane-dnd-split-move。
   * design「振る舞いの詳細 > サーバ側」。`targetPaneId` のプロセスを実際に終了させる点は
   * `closePane` と同じ経路——ただし `replacePane` は要求した pane（`paneId`）自身が必ず生き残るため、
   * `closePane` のような tab/workspace の連鎖的な消滅・`recreateIfEmpty`（D24）は起こりえない。
   */
  replacePane(paneId: PaneId, targetPaneId: PaneId): boolean {
    const pane = this.requirePane(paneId);
    const result = this.model.replacePane(paneId, targetPaneId);
    if (!result) return false;
    for (const pid of result.removedPaneIds) this.terminals.dispose(pid);
    for (const pid of result.removedPaneIds) this.bus.publish({ event: "pane.closed", data: { paneId: pid } });
    this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
    this.persist.touch();
    return true;
  }

  zoomPane(paneId: PaneId, mode: "toggle" | "on" | "off"): void {
    const pane = this.requirePane(paneId);
    this.model.zoomPane(paneId, mode);
    this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
    this.persist.touch();
  }

  resizePaneByDirection(paneId: PaneId, direction: Dir, amount: number): void {
    const pane = this.requirePane(paneId);
    this.model.resizeByDirection(paneId, direction, amount);
    this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
    this.persist.touch();
  }

  setSplitRatio(tabId: TabId, splitId: SplitId, ratio: number): void {
    this.model.setSplitRatio(tabId, splitId, ratio);
    this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(tabId) } });
    this.persist.touch();
  }

  /** サイズ権限（`SizeAuthority`。T18）が決めたサイズを、PTY・ミラー・モデルへ反映する。 */
  resizePane(paneId: PaneId, cols: number, rows: number): void {
    const pane = this.model.getPane(paneId);
    if (!pane) return;
    if (pane.cols === cols && pane.rows === rows) return;
    this.model.setPaneSize(paneId, cols, rows);
    this.terminals.resize(paneId, cols, rows);
    this.bus.publish({ event: "pane.size_changed", data: { paneId, cols, rows } });
  }

  updatePaneRuntime(paneId: PaneId, patch: PaneRuntimePatch): void {
    const pane = this.model.getPane(paneId);
    if (!pane) return;
    // 値が実際に変わったときだけ発行する（レビュー指摘：以前は busy/title が「渡されただけ」で毎回
    // 発行していたため、AgentMonitor の周期呼び出し（500ms〜1s毎）のたびに変化が無くても全クライアントへ
    // ブロードキャストしていた）。
    const busyChanged = patch.busy !== undefined && patch.busy !== pane.busy;
    const titleChanged = patch.title !== undefined && patch.title !== pane.title;
    const cwdChanged = patch.cwd !== undefined && patch.cwd !== pane.cwd;
    // agent も同様に、公開している AgentInfo の中身が実際に変わったときだけ発行する（review 指摘。should）。
    // `AgentTracker.update()` は herdr 由来のヒステリシス（D46・D50）の都合で、visibleIdle/visibleBlocker/
    // visibleWorking だけが変わって state 等は同じ、という新しい `AgentInfo` オブジェクトを返すことがある
    // （その3フラグは `AgentInfo`（`@wtm/protocol`）には含まれない、判定内部だけの情報）。busy/title と
    // 同じ「実際に変わったときだけ発行する」規約に揃える。
    const agentChanged = patch.agent !== undefined && !sameAgent(pane.agent, patch.agent);
    // 画面判定でエージェントが消えたら（非 null → null）、報告されていた会話参照も一緒に捨てる
    // （20260923-agent-session-resume design D9）。エージェントを終了して別の作業をしている pane が、
    // 次のサーバ再起動で勝手に古い会話を再開してしまう事故を防ぐ。
    const clearsAgentSession = patch.agent === null && pane.agent !== null && pane.agentSession !== null;
    const fullPatch = clearsAgentSession ? { ...patch, agentSession: null } : patch;
    const updated = this.model.updatePaneRuntime(paneId, fullPatch);
    if (agentChanged) {
      this.bus.publish({ event: "pane.agent_status_changed", data: { paneId, agent: updated.agent } });
    }
    if (busyChanged || titleChanged || cwdChanged) {
      this.bus.publish({ event: "pane.updated", data: { pane: updated } });
    }
    // 会話参照の消滅も保存契機にする（design D8）——さもないと、サーバが不意に落ちたときに
    // 「もう有効ではない」という事実が session.json に反映されないまま残ることがある。
    if (cwdChanged || clearsAgentSession) this.persist.touch();
  }

  updateWorkspaceGit(workspaceId: WorkspaceId, git: GitInfo | null): void {
    const ws = this.model.getWorkspace(workspaceId);
    if (!ws) return;
    if (sameGit(ws.git, git)) return;
    const updated = this.model.updateWorkspaceGit(workspaceId, git);
    this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
  }

  // --- lifecycle: シェルの終了（D18） ----------------------------------------

  /** `pane.exited` を出し、モデルにまだ pane があれば D18 の連鎖（closePane）を起こす。
   *  通常の（猶予後の）終了と、D37 の猶予中に code 0 で即終了した場合の両方から呼ぶ共通処理。
   *  呼び出し側が `await` できる場所（create 系）では待ってから RPC を返し、`wireExit` のような
   *  イベント駆動の呼び出し元は fire-and-forget で `.catch` する。 */
  private async closePaneAfterExit(paneId: PaneId, exitCode: number): Promise<void> {
    this.bus.publish({ event: "pane.exited", data: { paneId, exitCode } });
    const pane = this.model.getPane(paneId);
    if (!pane) return; // 既にモデルから消えている（closePane 等で先に処理済み、またはまだコミット前）
    await this.closePane(paneId);
  }

  private wireExit(paneId: PaneId): void {
    const host = this.terminals.get(paneId);
    // 起動直後の失敗（D37）は spawnForPane 側が別途処理するので、ここでは通常の終了だけを扱う。
    host?.onExit((exitCode) => {
      this.closePaneAfterExit(paneId, exitCode).catch((err: unknown) => {
        // D24 の自動作成が失敗した等、ここで例外を投げても受け取る相手がいない。
        this.logger.error("closePane after exit failed", { paneId, error: String(err) });
      });
    });
  }

  /**
   * pane 起動時に渡す環境変数（20260923-agent-session-resume design「6. フック登録の書式」）。
   * `WTM_PANE_ID`・`WTM_AGENT_REPORT_SOCKET` は、この pane の中で Claude Code/Codex が起動されたときに、
   * hook スクリプトが「どの pane の・どの会話か」を報告するために使う。socket が無い（起動に失敗した等）
   * 環境では `WTM_AGENT_REPORT_SOCKET` を渡さない——hook 側は env が無ければ無害に何もしない。
   * 全 pane に常に付ける（起動時点でその pane が Claude Code/Codex を動かすかは分からないため）。
   */
  private envForPane(paneId: PaneId): Record<string, string> {
    const env: Record<string, string> = { ...(process.env as Record<string, string>), WTM_PANE_ID: paneId };
    if (this.agentReportSocketPath) env.WTM_AGENT_REPORT_SOCKET = this.agentReportSocketPath;
    return env;
  }

  /**
   * 公式フック連携（20260923-agent-session-resume）からの報告を反映する。`paneId` が存在しなければ
   * 何もしない（report 経路は best-effort。design「振る舞いの詳細・会話IDの報告受信」）。
   */
  reportAgentSession(paneId: PaneId, kind: AgentIntegrationKind, sessionId: string): void {
    const pane = this.model.getPane(paneId);
    if (!pane) return;
    // `reportedAt` は壁時計の epoch ms（protocol の doc comment）。`this.clock` は復元の期限計測用の
    // 単調時計（`monotonicNow`）なので、ここでは使わない（`AgentInfo.since` と同じ `Date.now()` に揃える）。
    this.model.setAgentSession(paneId, { kind, sessionId, reportedAt: Date.now() });
    this.persist.touch();
  }

  /**
   * pane 用の PTY を起動し、短い猶予（D37）の間に失敗しなかったかを確かめる。
   * 成功のときだけ `onExit` の配線（D18 の連鎖）も済ませる——ただし `alreadyExited` が true
   * （猶予中に code 0 で即終了していた）ときは配線しない。`TerminalHost.onExit` は一度きり・同期発火で
   * リプレイしないため、既に一度発火した終了イベントに対して後から登録した listener は永久に呼ばれず、
   * pane が閉じられないまま残ってしまう（レビュー指摘）。この場合は呼び出し側が、pane をモデルへ
   * コミットした直後に `closePaneAfterExit` を自分で呼ぶ。
   */
  private async spawnForPane(paneId: PaneId, cwd: string): Promise<{ ok: boolean; alreadyExited: boolean }> {
    const host = this.terminals.create(paneId, {
      cwd,
      cols: HEADLESS_COLS,
      rows: HEADLESS_ROWS,
      ...(this.shell ? { shell: this.shell } : {}),
      env: this.envForPane(paneId),
    });
    const result = await raceSpawn(host, this.spawnGraceMs);
    if (!result.ok) {
      this.terminals.dispose(paneId);
      return { ok: false, alreadyExited: false };
    }
    if (!result.alreadyExited) this.wireExit(paneId);
    return { ok: true, alreadyExited: result.alreadyExited };
  }

  // --- 起動と再起動後の復元 ----------------------------------------------------

  /** 起動時に呼ぶ：workspace が無ければ 1 つ作る（design「起動と再起動後の復元」）。 */
  async ensureNotEmpty(): Promise<void> {
    if (!this.model.isEmpty()) return;
    await this.createWorkspace(this.defaultCwd, undefined); // 名前を渡さない＝開く場所から自動の名前（20260921-workspace-auto-label）
  }

  /** D24：workspace が 0 個になったら自動で 1 つ作り直す（herdr と異なる意図的な挙動。decisions.md
   *  D24・D36）。PTY の起動を伴うので、この層（SessionService）で実物の workspace を作る。
   *  `closeWorkspace`/`closeTab`/`closePane` の3箇所から同じ形で呼ぶ（レビュー指摘：重複していた）。 */
  private async recreateIfEmpty(): Promise<void> {
    if (this.model.isEmpty()) await this.createWorkspace(this.defaultCwd, undefined); // 自動の名前（同上）
  }

  /** `session.json` から復元する。失敗した pane は閉じずに `status: 'failed'` にする。 */
  async restore(data: SessionFileData): Promise<void> {
    this.model.setNextIdCounters(data.nextId);
    for (const groupData of data.groups) this.model.restoreGroup(groupData); // 20260923-workspace-grouping
    // 名前を先に決めてから入れる（20260921-workspace-auto-label の design D6・D10）。自動の名前はその場所から決め直し（保存した後に git の状態が
    // 変わっていれば新しい名前になる）、付けた名前はそのまま。**1 つずつ決める**——一度に始めると上限のタイマーも一斉に始まって workspace が
    // 多いと全部が上限に達し（T6 の点検）、応答しないマウントの上に並んでいると止まった stat が libuv のスレッドを塞ぎ合う（review ラウンド 1）。
    // 1 つが上限を超えたら、それが返るまで残りはフォルダ名（`autoLabelFor`）。**合計の期限を過ぎたら残りもフォルダ名**（review ラウンド 2）。
    // 期限を過ぎてフォルダ名にしたときは、警告を 1 度だけ出す（review ラウンド 3）。
    const deadline = this.clock.now() + RESTORE_LABEL_BUDGET_MS;
    let warnedOverBudget = false;
    const restored: (SessionFileWorkspace & { autoLabel: boolean })[] = [];
    for (const [i, wsData] of data.workspaces.entries()) {
      const overBudget = (): boolean => {
        if (this.clock.now() < deadline) return false;
        if (!warnedOverBudget) {
          warnedOverBudget = true;
          this.logger.warn("workspace label lookup over restore budget; using folder names for the rest", {
            budgetMs: RESTORE_LABEL_BUDGET_MS,
            remaining: data.workspaces.slice(i).filter((ws) => isAutoLabel(ws)).length, // フォルダ名になる自動の名前の数（付けた名前は数えない）
          });
        }
        return true;
      };
      restored.push({ ...wsData, ...(await this.restoredLabel(wsData, overBudget)) });
    }
    for (const wsData of restored) this.restoreWorkspace(wsData, wsData.autoLabel);
    for (const wsData of data.workspaces) {
      for (const tabData of wsData.tabs) {
        for (const paneData of tabData.panes) {
          await this.restorePaneProcess(paneData.id, paneData.cwd, paneData.agentSession);
        }
      }
    }
    if (data.focus) {
      try {
        this.model.focusPane(data.focus.paneId);
      } catch {
        // 保存されていた focus の pane が読めなかった（未対応）。既定のフォーカスのままにする。
      }
    }
  }

  /**
   * 復元する名前。保存した印があればそれ、無ければ（以前の版）`"1"`（以前の既定の名前）を自動とみなす。空・空白だけの名前も自動（design D10）。
   * 利用者が自分で「1」と付けていた workspace も自動になる（以前の保存には区別が無い。requirements の割り切り）。`overBudget` は自動の名前のときだけ
   * 呼ぶ（復元の合計の期限を過ぎたか。過ぎていれば `restore` が警告を 1 度だけ出す）。
   */
  private async restoredLabel(wsData: SessionFileWorkspace, overBudget: () => boolean): Promise<{ label: string; autoLabel: boolean }> {
    if (!isAutoLabel(wsData)) return { label: wsData.label, autoLabel: false };
    if (overBudget()) return { label: folderLabelOf(wsData.cwd, this.workspaceLabelDeps), autoLabel: true };
    return this.autoLabelFor(wsData.cwd);
  }

  private restoreWorkspace(wsData: SessionFileWorkspace, autoLabel: boolean): void {
    // SessionModel には「既存の id を使って作る」専用口が無いので、内部の Map へ直接組み立てる代わりに
    // 通常の作成 API は使わず、復元専用の経路で入れる（実装は SessionModel.restoreFrom に委譲）。
    this.model.restoreWorkspace(wsData, autoLabel);
  }

  private async restorePaneProcess(
    paneId: PaneId,
    cwd: string,
    agentSession?: { kind: string; sessionId: string } | undefined,
  ): Promise<void> {
    const spawn = await this.spawnForPane(paneId, cwd);
    if (!spawn.ok) {
      this.model.markPaneFailed(paneId, "シェルの起動に失敗しました");
      return;
    }
    // 復元対象の pane は restoreWorkspace で既にモデルに入っているので、すぐ連鎖してよい。
    if (spawn.alreadyExited) {
      await this.closePaneAfterExit(paneId, 0);
      return;
    }
    this.maybeResumeAgentSession(paneId, agentSession);
  }

  /**
   * 保存されていた会話参照があれば、シェルの起動（上）に**続けて**再開コマンドを投入する
   * （20260923-agent-session-resume design D10：起動そのものの分岐は増やさず、成功した後に
   * pane へ書き込むだけにする。無効な参照はコマンド自身がエラーで終わり、普通のシェルに戻る。AC6）。
   * 同一 cwd・同一種別の pane が複数あっても、pane ごとに一意な `sessionId` を持つため
   * 重複排除はしない（design D11）。
   */
  private maybeResumeAgentSession(paneId: PaneId, agentSession: { kind: string; sessionId: string } | undefined): void {
    if (!agentSession) return;
    if (!this.getAutoResumeEnabled()) return;
    const command = resumeCommandFor(agentSession.kind, agentSession.sessionId);
    if (!command) return;
    this.terminals.get(paneId)?.write(`${command}\r`);
  }

  // --- helpers ------------------------------------------------------------

  private requireWorkspace(id: WorkspaceId): Workspace {
    const ws = this.model.getWorkspace(id);
    if (!ws) throw new RpcError("not_found", `workspace not found: ${id}`);
    return ws;
  }
  private requireTab(id: TabId): Tab {
    const tab = this.model.getTab(id);
    if (!tab) throw new RpcError("not_found", `tab not found: ${id}`);
    return tab;
  }
  private requirePane(id: PaneId): Pane {
    const pane = this.model.getPane(id);
    if (!pane) throw new RpcError("not_found", `pane not found: ${id}`);
    return pane;
  }
}

async function raceSpawn(
  host: { onExit(cb: (code: number) => void): { dispose(): void } },
  graceMs: number,
): Promise<{ ok: boolean; alreadyExited: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      disposable.dispose();
      resolve({ ok: true, alreadyExited: false });
    }, graceMs);
    const disposable = host.onExit((code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // 0 での即終了は「起動には成功した」とみなす（D37）。ただし既にプロセスは終了しているので、
      // 呼び出し側は `alreadyExited` を見て D18 の連鎖を自分で起こす必要がある（レビュー指摘）。
      resolve({ ok: code === 0, alreadyExited: true });
    });
  });
}

function sameGit(a: GitInfo | null, b: GitInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // repoKey/isLinkedWorktree も比較する（20260923-workspace-grouping。タスク点検の指摘）——
  // branch/ahead/behind が変わらず repoKey/isLinkedWorktree だけ変わる場合（worktree 自動グループの
  // 判定に使う中心的なフィールド）を早期リターンで握りつぶすと、サーバの状態更新・
  // `workspace.updated` の配布ごと止まってしまう。
  return a.branch === b.branch && a.ahead === b.ahead && a.behind === b.behind && a.repoKey === b.repoKey && a.isLinkedWorktree === b.isLinkedWorktree;
}

/** `AgentInfo`（公開している側の全フィールド）が実際に変わったかを見る（`updatePaneRuntime` のレビュー指摘）。 */
function sameAgent(a: AgentInfo | null, b: AgentInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.instanceId === b.instanceId &&
    a.kind === b.kind &&
    a.label === b.label &&
    a.state === b.state &&
    a.completionSeq === b.completionSeq &&
    a.serverSeenSeq === b.serverSeenSeq &&
    a.verified === b.verified &&
    a.since === b.since
  );
}

/**
 * 保存された workspace の名前が自動の名前か（20260921-workspace-auto-label の design D6・D10）。保存した印があればそれ、無ければ（以前の版）`"1"` を
 * 自動とみなす。空・空白だけの名前も自動。
 */
function isAutoLabel(wsData: SessionFileWorkspace): boolean {
  return (wsData.autoLabel ?? wsData.label === "1") || !wsData.label.trim();
}

/** 「引き継ぐ」の元の pane（`newCwd.sourcePaneId`）。ほかの方針では元の pane を使わない。 */
function followSource(newCwd: NewCwd | undefined): PaneId | undefined {
  return newCwd?.policy === "follow" ? newCwd.sourcePaneId : undefined;
}

export { NotFoundError };
export type { SessionFileData, SessionFilePane, SessionFileTab, SessionFileWorkspace };
