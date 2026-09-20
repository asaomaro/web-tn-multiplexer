import type { AgentInfo, HostInfo, Pane, SessionFocus, SessionLimits, SessionSnapshot, Tab, Workspace } from "@wtm/protocol";
import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 構造と状態の保持（architecture.md「store/session」）。出力（バイト列）は持たない（規則 5）。
 * `SessionSnapshot` と `ServerEvent` の反映は `store/StoreAdapter` が行う——ここはミューテーションだけを持つ。
 */
export const useSessionStore = defineStore("session", () => {
  const protocolVersion = ref<1 | null>(null);
  const serverVersion = ref("");
  const host = ref<HostInfo | null>(null);
  /** `client.hello` の応答の `clientId`（このブラウザ自身。サイズ権限の判定に使う）。 */
  const clientId = ref<string | null>(null);
  const workspaces = ref(new Map<string, Workspace>());
  const tabs = ref(new Map<string, Tab>());
  const panes = ref(new Map<string, Pane>());
  const focus = ref<SessionFocus | null>(null);
  const limits = ref<SessionLimits>({ scrollbackLines: 5000 });

  function applySnapshot(s: SessionSnapshot, myClientId: string): void {
    protocolVersion.value = s.protocol;
    serverVersion.value = s.serverVersion;
    host.value = s.host;
    clientId.value = myClientId;
    workspaces.value = new Map(s.workspaces.map((w) => [w.id, w]));
    tabs.value = new Map(s.tabs.map((t) => [t.id, t]));
    panes.value = new Map(s.panes.map((p) => [p.id, p]));
    focus.value = s.focus;
    limits.value = s.limits;
  }

  /** このクライアントがその tab のサイズ権限を持っているか（design「サイズ権限」）。 */
  function hasSizeAuthority(tabId: string): boolean {
    return clientId.value !== null && tabs.value.get(tabId)?.sizeOwnerClientId === clientId.value;
  }

  function workspaceUpserted(w: Workspace): void {
    workspaces.value.set(w.id, w);
  }
  function workspaceClosed(workspaceId: string): void {
    workspaces.value.delete(workspaceId);
  }
  function tabUpserted(t: Tab): void {
    tabs.value.set(t.id, t);
  }
  function tabClosed(tabId: string): void {
    tabs.value.delete(tabId);
  }
  function paneUpserted(p: Pane): void {
    panes.value.set(p.id, p);
  }
  function paneClosed(paneId: string): void {
    panes.value.delete(paneId);
  }
  function paneAgentStatusChanged(paneId: string, agent: AgentInfo | null): void {
    const p = panes.value.get(paneId);
    if (p) panes.value.set(paneId, { ...p, agent });
  }
  function paneSizeChanged(paneId: string, cols: number, rows: number): void {
    const p = panes.value.get(paneId);
    if (p) panes.value.set(paneId, { ...p, cols, rows });
  }
  function sessionFocusChanged(f: SessionFocus | null): void {
    focus.value = f;
  }

  /** その workspace 配下の全 pane（集約の計算に使う。`store/seen` の `aggregate` と組み合わせる）。 */
  function panesInWorkspace(workspaceId: string): Pane[] {
    const result: Pane[] = [];
    for (const pane of panes.value.values()) {
      if (tabs.value.get(pane.tabId)?.workspaceId === workspaceId) result.push(pane);
    }
    return result;
  }

  return {
    protocolVersion,
    serverVersion,
    host,
    clientId,
    workspaces,
    tabs,
    panes,
    focus,
    limits,
    applySnapshot,
    hasSizeAuthority,
    workspaceUpserted,
    workspaceClosed,
    tabUpserted,
    tabClosed,
    paneUpserted,
    paneClosed,
    paneAgentStatusChanged,
    paneSizeChanged,
    sessionFocusChanged,
    panesInWorkspace,
  };
});
