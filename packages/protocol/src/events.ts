import type { AgentInfo, Pane, SessionFocus, Tab, Workspace } from "./model.js";

/**
 * イベント（design.md「WebSocket の通信」のイベント表。architecture.md の独立点検で data の形を確定）。
 */

export interface WorkspaceCreatedEvent {
  event: "workspace.created";
  data: { workspace: Workspace };
}
export interface WorkspaceUpdatedEvent {
  event: "workspace.updated";
  data: { workspace: Workspace };
}
export interface WorkspaceClosedEvent {
  event: "workspace.closed";
  data: { workspaceId: string };
}
export interface TabCreatedEvent {
  event: "tab.created";
  data: { tab: Tab };
}
export interface TabUpdatedEvent {
  event: "tab.updated";
  data: { tab: Tab };
}
export interface TabClosedEvent {
  event: "tab.closed";
  data: { tabId: string };
}
export interface LayoutUpdatedEvent {
  event: "layout.updated";
  data: { tab: Tab };
}
export interface PaneCreatedEvent {
  event: "pane.created";
  data: { pane: Pane };
}
export interface PaneUpdatedEvent {
  event: "pane.updated";
  data: { pane: Pane };
}
export interface PaneExitedEvent {
  event: "pane.exited";
  data: { paneId: string; exitCode: number };
}
export interface PaneClosedEvent {
  event: "pane.closed";
  data: { paneId: string };
}
export interface PaneAgentStatusChangedEvent {
  event: "pane.agent_status_changed";
  data: { paneId: string; agent: AgentInfo | null };
}
export interface PaneSizeChangedEvent {
  event: "pane.size_changed";
  data: { paneId: string; cols: number; rows: number };
}
export interface SessionFocusChangedEvent {
  event: "session.focus_changed";
  data: { focus: SessionFocus | null };
}
export interface ClientErrorEvent {
  event: "client.error";
  data: { code: string; message: string };
}

export type ServerEvent =
  | WorkspaceCreatedEvent
  | WorkspaceUpdatedEvent
  | WorkspaceClosedEvent
  | TabCreatedEvent
  | TabUpdatedEvent
  | TabClosedEvent
  | LayoutUpdatedEvent
  | PaneCreatedEvent
  | PaneUpdatedEvent
  | PaneExitedEvent
  | PaneClosedEvent
  | PaneAgentStatusChangedEvent
  | PaneSizeChangedEvent
  | SessionFocusChangedEvent
  | ClientErrorEvent;

export type ServerEventName = ServerEvent["event"];
