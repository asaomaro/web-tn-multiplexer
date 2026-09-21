import type { PaneId, SplitId, TabId, WorkspaceId, AgentInstanceId } from "./ids.js";

/** サーバが判定する 4 状態。5 つ目の `done`（未読の完了）はブラウザが既読から導く（design.md「概要」）。 */
export type AgentState = "blocked" | "working" | "idle" | "unknown";
/** 表示用の状態。`done` は `state === 'idle' && completionSeq > seenSeq` のときにブラウザが導出する。 */
export type DisplayState = AgentState | "done";

export type SplitDirection = "right" | "down";
export type Dir = "left" | "right" | "up" | "down";
export type RightClickTarget = "herdr" | "pane";

export interface GitInfo {
  branch: string | null;
  ahead: number;
  behind: number;
}

export interface Workspace {
  id: WorkspaceId;
  label: string;
  cwd: string;
  tabIds: TabId[];
  /** サーバ全体で最後に選ばれた tab（design.md「フォーカスと表示」）。 */
  activeTabId: TabId;
  /** 後続「workspace のグルーピング」用に予約。MVP では常に null（decisions.md D6）。 */
  groupId: string | null;
  /** サイドバーの Space パネルの 2 行目。git 管理外なら null。 */
  git: GitInfo | null;
}

export interface Tab {
  id: TabId;
  workspaceId: WorkspaceId;
  label: string;
  layout: LayoutNode;
  /** サーバ全体で最後にフォーカスされた pane。 */
  focusedPaneId: PaneId;
  zoomedPaneId: PaneId | null;
  /** サイズ権限を持つクライアントの id（design.md「サイズ権限」）。 */
  sizeOwnerClientId: string | null;
}

export type LayoutNode =
  | { type: "pane"; paneId: PaneId }
  | { type: "split"; id: SplitId; dir: SplitDirection; ratio: number; a: LayoutNode; b: LayoutNode };

export type PaneStatus = "running" | "failed";

export interface Pane {
  id: PaneId;
  tabId: TabId;
  label: string | null;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  /** `failed` は再起動後の復元でシェルを起動できなかったことを表す（D18 の例外）。 */
  status: PaneStatus;
  failure: string | null;
  /** 前面プロセスがシェル以外か（閉じる前の確認・herdr の busy 相当）。 */
  busy: boolean;
  /** 最新の OSC 0/2（安全化済み）。 */
  title: string;
  rightClick: RightClickTarget;
  agent: AgentInfo | null;
}

export interface AgentInfo {
  /** 検出のたびに振る id（再起動後も重複しない）。既読の記録のキーに使う。 */
  instanceId: AgentInstanceId;
  /** herdr の agent id（'claude' | 'codex' | …）。 */
  kind: string;
  label: string;
  state: AgentState;
  /** working → idle になるたびに 1 増やす（done の判定に使う）。 */
  completionSeq: number;
  /** サーバ側の既読。pane.focus を受けたら completionSeq に揃える。再起動をまたがない（メモリのみ）。 */
  serverSeenSeq: number;
  /** MVP で検証済み（Claude Code・Codex）かどうか。 */
  verified: boolean;
  /** 状態が変わった時刻（epoch ms）。 */
  since: number;
}

export interface HostInfo {
  os: "linux" | "windows";
  windowsBuild: number | null;
  hostname: string;
}

export interface SessionFocus {
  workspaceId: WorkspaceId;
  tabId: TabId;
  paneId: PaneId;
}

export interface SessionLimits {
  scrollbackLines: number;
}

export interface SessionSnapshot {
  protocol: 1;
  serverVersion: string;
  host: HostInfo;
  workspaces: Workspace[];
  tabs: Tab[];
  panes: Pane[];
  focus: SessionFocus | null;
  limits: SessionLimits;
}

/**
 * `git worktree list --porcelain` の 1 エントリ（20260920-git-worktree-actions）。
 * **bare と prunable はサーバ側で落とす**ので、ここに来るのは「開ける」ものだけ。
 */
export interface WorktreeEntry {
  path: string;
  /** detached HEAD なら null。 */
  branch: string | null;
}
