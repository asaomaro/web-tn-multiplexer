import { z } from "zod";
import type { Pane, SessionSnapshot, Tab, Workspace, WorktreeEntry } from "./model.js";

/**
 * 方式（method）の定義。design.md「WebSocket の通信」の表と、architecture.md「方式の追加と変更」
 * （D30：`client.view` から購読を分離し `pane.subscribe` / `pane.unsubscribe` を新設）を反映する。
 */

const paneId = z.string().min(1);
const workspaceId = z.string().min(1);
const tabId = z.string().min(1);
const splitId = z.string().min(1);
const clientKind = z.enum(["desktop", "mobile"]);
const splitDirection = z.enum(["right", "down"]);
const dir = z.enum(["left", "right", "up", "down"]);
const rightClickTarget = z.enum(["herdr", "pane"]);
const zoomMode = z.enum(["toggle", "on", "off"]);

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

export const WorkspaceCloseParams = z.object({ workspaceId });
export type WorkspaceCloseParams = z.infer<typeof WorkspaceCloseParams>;

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

export const METHOD_SCHEMAS = {
  "client.hello": ClientHelloParams,
  "client.view": ClientViewParams,
  "client.fit": ClientFitParams,
  "client.detach": ClientDetachParams,
  "pane.subscribe": PaneSubscribeParams,
  "pane.unsubscribe": PaneUnsubscribeParams,
  "workspace.create": WorkspaceCreateParams,
  "workspace.rename": WorkspaceRenameParams,
  "workspace.focus": WorkspaceFocusParams,
  "workspace.close": WorkspaceCloseParams,
  "tab.create": TabCreateParams,
  "tab.rename": TabRenameParams,
  "tab.focus": TabFocusParams,
  "tab.close": TabCloseParams,
  "pane.split": PaneSplitParams,
  "pane.close": PaneCloseParams,
  "pane.focus": PaneFocusParams,
  "pane.rename": PaneRenameParams,
  "pane.focus_direction": PaneFocusDirectionParams,
  "pane.swap": PaneSwapParams,
  "pane.zoom": PaneZoomParams,
  "pane.resize": PaneResizeParams,
  "pane.input.set": PaneInputSetParams,
  "layout.set_split_ratio": LayoutSetSplitRatioParams,
  "worktree.list": WorktreeListParams,
  "worktree.create": WorktreeCreateParams,
} as const;

export type MethodName = keyof typeof METHOD_SCHEMAS;

export interface MethodResultMap {
  "client.hello": ClientHelloResult;
  "client.view": Record<string, never>;
  "client.fit": Record<string, never>;
  "client.detach": Record<string, never>;
  "pane.subscribe": PaneSubscribeResult;
  "pane.unsubscribe": Record<string, never>;
  "workspace.create": WorkspaceCreateResult;
  "workspace.rename": Record<string, never>;
  "workspace.focus": Record<string, never>;
  "workspace.close": Record<string, never>;
  "tab.create": TabCreateResult;
  "tab.rename": Record<string, never>;
  "tab.focus": Record<string, never>;
  "tab.close": Record<string, never>;
  "pane.split": PaneSplitResult;
  "pane.close": Record<string, never>;
  "pane.focus": Record<string, never>;
  "pane.rename": Record<string, never>;
  "pane.focus_direction": PaneFocusDirectionResult;
  "pane.swap": PaneSwapResult;
  "pane.zoom": Record<string, never>;
  "pane.resize": Record<string, never>;
  "pane.input.set": Record<string, never>;
  "layout.set_split_ratio": Record<string, never>;
  "worktree.list": WorktreeListResult;
  "worktree.create": WorktreeCreateResult;
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
