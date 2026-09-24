import { z } from "zod";
import type { AgentIntegrationKind, Pane, SessionSnapshot, Tab, Workspace, WorkspaceGroup, WorktreeEntry } from "./model.js";
import { THEME_NAMES } from "./theme.js";

/**
 * 方式（method）の定義。design.md「WebSocket の通信」の表と、architecture.md「方式の追加と変更」
 * （D30：`client.view` から購読を分離し `pane.subscribe` / `pane.unsubscribe` を新設）を反映する。
 */

const paneId = z.string().min(1);
const workspaceId = z.string().min(1);
const tabId = z.string().min(1);
const splitId = z.string().min(1);
// 20260923-workspace-grouping（タスク点検の指摘：groupId もほかの id と同じく共有 const にする）。
const groupId = z.string().min(1);
// `"external"` = 画面を持たない外部クライアント（`wtmctl`。20260923-external-control-api の design D4）。
const clientKind = z.enum(["desktop", "mobile", "external"]);
const splitDirection = z.enum(["right", "down"]);
const dir = z.enum(["left", "right", "up", "down"]);
const rightClickTarget = z.enum(["herdr", "pane"]);
const zoomMode = z.enum(["toggle", "on", "off"]);
// `tab.move`（20260923-missing-keybinding-actions）の方向。herdr の `insert_index` ではなく、対象 tab と
// 隣（巡回込み）を入れ替える方向だけを渡す（design「検討した代替案」）。
const tabMoveDirection = z.enum(["previous", "next"]);

// --- client -----------------------------------------------------------

export const ClientHelloParams = z.object({
  protocol: z.literal(1),
  kind: clientKind,
});
export type ClientHelloParams = z.infer<typeof ClientHelloParams>;
export interface ClientHelloResult {
  clientId: string;
  snapshot: SessionSnapshot;
}

export const ClientViewParams = z.object({
  workspaceId,
  tabId,
  visible: z.array(z.object({ paneId, cols: z.number().int().positive(), rows: z.number().int().positive() })),
});
export type ClientViewParams = z.infer<typeof ClientViewParams>;

export const ClientFitParams = z.object({ enabled: z.boolean() });
export type ClientFitParams = z.infer<typeof ClientFitParams>;

/**
 * このブラウザがいま表示しているテーマ（20260921-theme-settings の design D1）。サーバは色の問い合わせ（OSC 4/10/11/12）の答えに使う
 * だけで、保存もほかのクライアントへの配布もしない。名前を送る（配色は protocol の `TERMINAL_PALETTES` から引く）。
 */
export const ClientThemeParams = z.object({ theme: z.enum(THEME_NAMES) });
export type ClientThemeParams = z.infer<typeof ClientThemeParams>;

export const ClientDetachParams = z.object({});
export type ClientDetachParams = z.infer<typeof ClientDetachParams>;

// --- pane subscription (D30) ------------------------------------------

export const PaneSubscribeParams = z.object({
  paneId,
  scrollbackLines: z.number().int().nonnegative(),
});
export type PaneSubscribeParams = z.infer<typeof PaneSubscribeParams>;
export interface PaneSubscribeResult {
  cols: number;
  rows: number;
}

export const PaneUnsubscribeParams = z.object({ paneId });
export type PaneUnsubscribeParams = z.infer<typeof PaneUnsubscribeParams>;

// --- 新しく開く場所（20260921-new-terminal-cwd。herdr の `terminal.new_cwd`） ----------------

/**
 * 新しい workspace・tab・分割を**どこで開くかの方針**（ブラウザごとの設定。design D1）。場所を決めるのはサーバ（design D2）。
 * - `follow`: 元の pane の「いまの場所」を引き継ぐ（**ブラウザの設定の既定**）。`sourcePaneId` は元の pane（分割では `pane.split` の
 *   `paneId` が元なので付けない）。
 * - `home`: ホームディレクトリ。 `current`: サーバを起動した場所。 `path`: 指定した場所（`~` はホーム）。
 *   **空文字・相対パスもスキーマは通す**——サーバが「使えない場所」として扱い、代わりの場所で開いて知らせる（design の異常系）。
 *   ここで弾くと、「指定した場所」を選んだまま何も入れていないブラウザの作成が失敗してしまう。
 *
 * **`newCwd` が無い要求は `follow` ではなく「今までどおり」**（古いクライアント・テストのクライアント。design D5）。
 * **場所を明示する `cwd`（worktree を開く）とは別物**——`cwd` があればこちらは見ない（design D5）。
 */
export const NewCwd = z.discriminatedUnion("policy", [
  z.object({ policy: z.literal("follow"), sourcePaneId: paneId.optional() }),
  z.object({ policy: z.literal("home") }),
  z.object({ policy: z.literal("current") }),
  z.object({ policy: z.literal("path"), path: z.string() }),
]);
export type NewCwd = z.infer<typeof NewCwd>;

/**
 * 作成の結果に載る。**「引き継ぐ」以外の方針で決めた場所が使えず、代わりの場所で開いたときだけ `true`**（知らせるかどうかは
 * サーバが決める。design D9）。それ以外のときは載らない。
 */
export interface CwdFallbackResult {
  cwdFallback?: true;
}

// --- workspace ----------------------------------------------------------

export const WorkspaceCreateParams = z.object({
  /** 場所を明示する（worktree を開く）。**`newCwd` に勝ち、代わりの場所へは回さない**（使えなければ失敗する）。 */
  cwd: z.string().optional(),
  label: z.string().optional(),
  newCwd: NewCwd.optional(),
});
export type WorkspaceCreateParams = z.infer<typeof WorkspaceCreateParams>;
export interface WorkspaceCreateResult extends CwdFallbackResult {
  workspace: Workspace;
  tab: Tab;
  pane: Pane;
}

/** `label: null` で自動の名前に戻す（pane の名前と同じ形。20260921-workspace-auto-label の design D5）。 */
export const WorkspaceRenameParams = z.object({ workspaceId, label: z.string().min(1).nullable() });
export type WorkspaceRenameParams = z.infer<typeof WorkspaceRenameParams>;

export const WorkspaceFocusParams = z.object({ workspaceId });
export type WorkspaceFocusParams = z.infer<typeof WorkspaceFocusParams>;

// `closeLinkedWorktrees`（20260923-workspace-grouping。herdr の `close_group` 相当）：true かつ
// 対象が worktree 自動グループの本体なら、束ねられた worktree も連鎖して閉じる。**省略可**——
// `z.boolean().default(false)` にすると `z.infer` の TS 型で必須フィールドになり、既存の呼び出し元
// （例: `packages/cli/src/commands/workspace.ts`）が型エラーになる（タスク点検の指摘）。既定は
// `SessionService.closeWorkspace(id, closeLinkedWorktrees = false)` 側の JS 既定引数が担う。
export const WorkspaceCloseParams = z.object({ workspaceId, closeLinkedWorktrees: z.boolean().optional() });
export type WorkspaceCloseParams = z.infer<typeof WorkspaceCloseParams>;

// --- workspace のグルーピングと並べ替え（20260923-workspace-grouping） --------------------------

// キーバインド用（delta 指定。tab.move と同じ形）。値は tabMoveDirection と同じだが、
// 対象の種類が違う（tab ではなく workspace）ので別の const として持つ——スキーマの意味を
// 「tab の方向」に固定させないため。
const workspaceMoveDirection = z.enum(["previous", "next"]);
export const WorkspaceMoveParams = z.object({ workspaceId, direction: workspaceMoveDirection });
export type WorkspaceMoveParams = z.infer<typeof WorkspaceMoveParams>;

// D&D 用（anchor 指定）。`workspaceIds` が複数なら、グループの一括移動（herdr の
// `WorkspaceMoveBlockParams` 相当）。単一なら通常の1件ドラッグ。
export const WorkspaceMoveToParams = z.object({
  workspaceIds: z.array(workspaceId).min(1),
  beforeWorkspaceId: workspaceId.nullable(), // null なら末尾へ
});
export type WorkspaceMoveToParams = z.infer<typeof WorkspaceMoveToParams>;

export const GroupCreateParams = z.object({ label: z.string().min(1) });
export type GroupCreateParams = z.infer<typeof GroupCreateParams>;
export interface GroupCreateResult {
  group: WorkspaceGroup;
}

export const GroupRenameParams = z.object({ groupId, label: z.string().min(1) });
export type GroupRenameParams = z.infer<typeof GroupRenameParams>;

export const GroupDeleteParams = z.object({ groupId }); // メンバーは外れるだけ（消えない）
export type GroupDeleteParams = z.infer<typeof GroupDeleteParams>;

export const GroupAddMemberParams = z.object({ groupId, workspaceId });
export type GroupAddMemberParams = z.infer<typeof GroupAddMemberParams>;

export const GroupRemoveMemberParams = z.object({ workspaceId }); // 現在のグループから外す
export type GroupRemoveMemberParams = z.infer<typeof GroupRemoveMemberParams>;

// 折りたたみ状態の切り替え（decisions.md D7。design のデータ構造〔WorkspaceGroup.collapsed〕には
// あったが、それを変更する RPC が design に無かったための追加）。**値を渡さずサーバに反転させる**
// （タスク点検の指摘：クライアントが今の値を読んで反転して送る形だと、応答が返る前に連続で
// 呼ばれたとき〔すばやい2回クリック〕両方が同じ古い値から同じ反転値を送ってしまい、2回目が
// 効かなくなる。`pane.zoom` の `mode: "toggle"` と同じ「サーバに決めさせる」考え方に揃えた）。
export const GroupToggleCollapsedParams = z.object({ groupId });
export type GroupToggleCollapsedParams = z.infer<typeof GroupToggleCollapsedParams>;

// --- tab ------------------------------------------------------------------

export const TabCreateParams = z.object({
  workspaceId: workspaceId.optional(),
  label: z.string().optional(),
  newCwd: NewCwd.optional(),
});
export type TabCreateParams = z.infer<typeof TabCreateParams>;
export interface TabCreateResult extends CwdFallbackResult {
  tab: Tab;
  pane: Pane;
}

export const TabRenameParams = z.object({ tabId, label: z.string().min(1) });
export type TabRenameParams = z.infer<typeof TabRenameParams>;

export const TabFocusParams = z.object({ tabId });
export type TabFocusParams = z.infer<typeof TabFocusParams>;

export const TabCloseParams = z.object({ tabId });
export type TabCloseParams = z.infer<typeof TabCloseParams>;

// `tab.move`（20260923-missing-keybinding-actions。herdr の move_tab_previous/move_tab_next 相当）：
// 対象 tab を同じ workspace 内で隣（巡回込み）と入れ替える。結果は `workspace.updated` で配る
// （`tab.rename`/`tab.close` と同じ「空の成功応答＋イベントで実体を配る」形）。
export const TabMoveParams = z.object({ tabId, direction: tabMoveDirection });
export type TabMoveParams = z.infer<typeof TabMoveParams>;

// --- pane -------------------------------------------------------------------

export const PaneSplitParams = z.object({
  paneId,
  direction: splitDirection,
  ratio: z.number().min(0.05).max(0.95).optional(),
  newCwd: NewCwd.optional(),
});
export type PaneSplitParams = z.infer<typeof PaneSplitParams>;
export interface PaneSplitResult extends CwdFallbackResult {
  pane: Pane;
}

export const PaneCloseParams = z.object({ paneId });
export type PaneCloseParams = z.infer<typeof PaneCloseParams>;

export const PaneFocusParams = z.object({ paneId });
export type PaneFocusParams = z.infer<typeof PaneFocusParams>;

export const PaneRenameParams = z.object({ paneId, label: z.string().nullable() });
export type PaneRenameParams = z.infer<typeof PaneRenameParams>;

export const PaneFocusDirectionParams = z.object({ paneId, direction: dir });
export type PaneFocusDirectionParams = z.infer<typeof PaneFocusDirectionParams>;
export interface PaneFocusDirectionResult {
  paneId: string;
}

export const PaneSwapParams = z.object({ paneId, direction: dir });
export type PaneSwapParams = z.infer<typeof PaneSwapParams>;
export interface PaneSwapResult {
  paneId: string;
}

/**
 * 任意の2つの pane を入れ替える（20260923-pane-name-dnd-swap。ドラッグでの入れ替え用）。
 * 既存の `pane.swap`（方向ベース。隣接する pane のみ）とは別方式——キーボード操作の意味を変えない
 * ため（decisions.md D4）。
 */
export const PaneSwapWithParams = z.object({ paneId, otherPaneId: paneId });
export type PaneSwapWithParams = z.infer<typeof PaneSwapWithParams>;
export interface PaneSwapWithResult {
  /** 同一 tab でない・同じ pane 同士等、何も起きなかったときは false（design「エラー処理」）。 */
  ok: boolean;
}

export const PaneZoomParams = z.object({ paneId, mode: zoomMode });
export type PaneZoomParams = z.infer<typeof PaneZoomParams>;

export const PaneResizeParams = z.object({ paneId, direction: dir, amount: z.number() });
export type PaneResizeParams = z.infer<typeof PaneResizeParams>;

export const PaneInputSetParams = z.object({ paneId, rightClick: rightClickTarget });
export type PaneInputSetParams = z.infer<typeof PaneInputSetParams>;

// --- layout -----------------------------------------------------------------

export const LayoutSetSplitRatioParams = z.object({
  tabId,
  splitId,
  ratio: z.number().min(0.05).max(0.95),
});
export type LayoutSetSplitRatioParams = z.infer<typeof LayoutSetSplitRatioParams>;

// --- registry (params の型から result の型を引くための対応表) ---------------

// --- worktree（20260920-git-worktree-actions）---------------------------

/**
 * `worktree.list` は**「開く」と「作る」の両方の入口**（herdr と同じ）。
 * 作るときも先に呼ぶのは、パスのプレビューに `worktreeRoot` と `repoName` が要るため。
 */
export const WorktreeListParams = z.object({ workspaceId });
export type WorktreeListParams = z.infer<typeof WorktreeListParams>;
export interface WorktreeListResult {
  /** 作成先の根（`/` 区切りに正規化済み）。 */
  worktreeRoot: string;
  /** 作成先の 2 段目に使うリポジトリの名前。 */
  repoName: string;
  /** 自動生成したブランチ名の候補（入力欄の初期値）。 */
  suggestedBranch: string;
  entries: WorktreeEntry[];
}

/** 作るだけで workspace は開かない（開くのは `workspace.create` の仕事）。 */
export const WorktreeCreateParams = z.object({ workspaceId, branch: z.string().min(1) });
export type WorktreeCreateParams = z.infer<typeof WorktreeCreateParams>;
export interface WorktreeCreateResult {
  /** 作られた作業ツリーのパス。呼び出し側はここを cwd に `workspace.create` する。 */
  path: string;
}

// --- agent integration（20260923-agent-session-resume。6つ追加: 20260923-other-agents-session-resume）---

/** `model.ts` の `AgentIntegrationKind` と値を揃える（別の型なので同期がずれないよう並びも揃える）。 */
const agentIntegrationKind = z.enum(["claude", "codex", "cursor", "copilot", "devin", "droid", "grok", "qwen"]);

export const AgentIntegrationStatusParams = z.object({});
export type AgentIntegrationStatusParams = z.infer<typeof AgentIntegrationStatusParams>;

/** 対象1エージェント分の状態（design「3. RPC 方式」）。 */
export interface AgentIntegrationStatus {
  /** PATH 上に実行ファイルが見つかるか（情報提供のみ。無くても導入操作は妨げない）。 */
  cliDetected: boolean;
  /** 対象の hooks 設定に本製品のフックが登録されているか（都度判定。design D4）。 */
  installed: boolean;
}
export interface AgentIntegrationStatusResult {
  /** herdr の `resume_agents_on_restore` に相当（design D3）。 */
  autoResumeEnabled: boolean;
  agents: Record<AgentIntegrationKind, AgentIntegrationStatus>;
}

export const AgentIntegrationInstallParams = z.object({ kind: agentIntegrationKind });
export type AgentIntegrationInstallParams = z.infer<typeof AgentIntegrationInstallParams>;
export interface AgentIntegrationInstallResult {
  ok: boolean;
  /** 失敗理由、または「既に導入済みです」等の補足（無ければ null）。 */
  message: string | null;
}

export const AgentIntegrationUninstallParams = z.object({ kind: agentIntegrationKind });
export type AgentIntegrationUninstallParams = z.infer<typeof AgentIntegrationUninstallParams>;
export type AgentIntegrationUninstallResult = AgentIntegrationInstallResult;

export const AgentIntegrationSetAutoResumeParams = z.object({ enabled: z.boolean() });
export type AgentIntegrationSetAutoResumeParams = z.infer<typeof AgentIntegrationSetAutoResumeParams>;

export const METHOD_SCHEMAS = {
  "client.hello": ClientHelloParams,
  "client.view": ClientViewParams,
  "client.fit": ClientFitParams,
  "client.theme": ClientThemeParams,
  "client.detach": ClientDetachParams,
  "pane.subscribe": PaneSubscribeParams,
  "pane.unsubscribe": PaneUnsubscribeParams,
  "workspace.create": WorkspaceCreateParams,
  "workspace.rename": WorkspaceRenameParams,
  "workspace.focus": WorkspaceFocusParams,
  "workspace.close": WorkspaceCloseParams,
  "workspace.move": WorkspaceMoveParams,
  "workspace.move_to": WorkspaceMoveToParams,
  "group.create": GroupCreateParams,
  "group.rename": GroupRenameParams,
  "group.delete": GroupDeleteParams,
  "group.add_member": GroupAddMemberParams,
  "group.remove_member": GroupRemoveMemberParams,
  "group.toggle_collapsed": GroupToggleCollapsedParams,
  "tab.create": TabCreateParams,
  "tab.rename": TabRenameParams,
  "tab.focus": TabFocusParams,
  "tab.close": TabCloseParams,
  "tab.move": TabMoveParams,
  "pane.split": PaneSplitParams,
  "pane.close": PaneCloseParams,
  "pane.focus": PaneFocusParams,
  "pane.rename": PaneRenameParams,
  "pane.focus_direction": PaneFocusDirectionParams,
  "pane.swap": PaneSwapParams,
  "pane.swap_with": PaneSwapWithParams,
  "pane.zoom": PaneZoomParams,
  "pane.resize": PaneResizeParams,
  "pane.input.set": PaneInputSetParams,
  "layout.set_split_ratio": LayoutSetSplitRatioParams,
  "worktree.list": WorktreeListParams,
  "worktree.create": WorktreeCreateParams,
  "agent_integration.status": AgentIntegrationStatusParams,
  "agent_integration.install": AgentIntegrationInstallParams,
  "agent_integration.uninstall": AgentIntegrationUninstallParams,
  "agent_integration.set_auto_resume": AgentIntegrationSetAutoResumeParams,
} as const;

export type MethodName = keyof typeof METHOD_SCHEMAS;

export interface MethodResultMap {
  "client.hello": ClientHelloResult;
  "client.view": Record<string, never>;
  "client.fit": Record<string, never>;
  "client.theme": Record<string, never>;
  "client.detach": Record<string, never>;
  "pane.subscribe": PaneSubscribeResult;
  "pane.unsubscribe": Record<string, never>;
  "workspace.create": WorkspaceCreateResult;
  "workspace.rename": Record<string, never>;
  "workspace.focus": Record<string, never>;
  "workspace.close": Record<string, never>;
  "workspace.move": Record<string, never>;
  "workspace.move_to": Record<string, never>;
  "group.create": GroupCreateResult;
  "group.rename": Record<string, never>;
  "group.delete": Record<string, never>;
  "group.add_member": Record<string, never>;
  "group.remove_member": Record<string, never>;
  "group.toggle_collapsed": Record<string, never>;
  "tab.create": TabCreateResult;
  "tab.rename": Record<string, never>;
  "tab.focus": Record<string, never>;
  "tab.close": Record<string, never>;
  "tab.move": Record<string, never>;
  "pane.split": PaneSplitResult;
  "pane.close": Record<string, never>;
  "pane.focus": Record<string, never>;
  "pane.rename": Record<string, never>;
  "pane.focus_direction": PaneFocusDirectionResult;
  "pane.swap": PaneSwapResult;
  "pane.swap_with": PaneSwapWithResult;
  "pane.zoom": Record<string, never>;
  "pane.resize": Record<string, never>;
  "pane.input.set": Record<string, never>;
  "layout.set_split_ratio": Record<string, never>;
  "worktree.list": WorktreeListResult;
  "worktree.create": WorktreeCreateResult;
  "agent_integration.status": AgentIntegrationStatusResult;
  "agent_integration.install": AgentIntegrationInstallResult;
  "agent_integration.uninstall": AgentIntegrationUninstallResult;
  "agent_integration.set_auto_resume": Record<string, never>;
}

export type ParamsOf<M extends MethodName> = z.infer<(typeof METHOD_SCHEMAS)[M]>;
export type ResultOf<M extends MethodName> = MethodResultMap[M];

// --- envelope (newline-delimited JSON over the single WebSocket) -----------

export interface RequestEnvelope<M extends MethodName = MethodName> {
  id: string;
  method: M;
  params: ParamsOf<M>;
}

export interface SuccessEnvelope<M extends MethodName = MethodName> {
  id: string;
  result: ResultOf<M>;
}

export interface ErrorEnvelope {
  id: string;
  error: { code: string; message: string };
}
