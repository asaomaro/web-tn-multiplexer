import { z } from "zod";
import type { Pane, SessionSnapshot, Tab, Workspace } from "./model.js";

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

// --- workspace ----------------------------------------------------------

export const WorkspaceCreateParams = z.object({
  cwd: z.string().optional(),
  label: z.string().optional(),
});
export type WorkspaceCreateParams = z.infer<typeof WorkspaceCreateParams>;
export interface WorkspaceCreateResult {
  workspace: Workspace;
  tab: Tab;
  pane: Pane;
}

export const WorkspaceRenameParams = z.object({ workspaceId, label: z.string().min(1) });
export type WorkspaceRenameParams = z.infer<typeof WorkspaceRenameParams>;

export const WorkspaceFocusParams = z.object({ workspaceId });
export type WorkspaceFocusParams = z.infer<typeof WorkspaceFocusParams>;

export const WorkspaceCloseParams = z.object({ workspaceId });
export type WorkspaceCloseParams = z.infer<typeof WorkspaceCloseParams>;

// --- tab ------------------------------------------------------------------

export const TabCreateParams = z.object({
  workspaceId: workspaceId.optional(),
  label: z.string().optional(),
});
export type TabCreateParams = z.infer<typeof TabCreateParams>;
export interface TabCreateResult {
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
});
export type PaneSplitParams = z.infer<typeof PaneSplitParams>;
export interface PaneSplitResult {
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
