import type { ServerEvent, SessionSnapshot } from "@wtm/protocol";
import type { Pinia } from "pinia";
import type { ConnectionState, StorePort } from "../net/ports.js";
import { useSessionStore } from "./session.js";
import { useViewStore } from "./view.js";
import { repairView } from "./viewRepair.js";

export interface StoreAdapterOptions {
  pinia: Pinia;
  onAuthRequired: () => void;
  onConnectionState: (s: ConnectionState) => void;
  /** `pane.exited`（シェルの終了。design「エラー処理」）。省略可——直後に `pane.closed` が届く。 */
  onPaneExited?: (paneId: string, exitCode: number) => void;
  /** `client.error`（要求 id の無い不正なフレームへの通知）。省略可。 */
  onClientError?: (code: string, message: string) => void;
  /** `StorePort.onOriginRejectSuspected`（D107）。省略可（省けば手がかりを出さない）。 */
  onOriginRejectSuspected?: (suspected: boolean) => void;
}

/**
 * `StorePort` の実装（architecture.md「store/StoreAdapter」）。snapshot とイベントを各ストアに反映する。
 * 認証・接続状態（`onAuthRequired`/`onConnectionState`）は `store/view`（T16）の関心事だが、
 * `store/session`（T14）が先に作られる依存の順序（T14→T16）に合わせ、注入したコールバックへ委ねる
 * （T26 で `store/view` の該当メソッドを bind する）。
 */
export class StoreAdapter implements StorePort {
  constructor(private readonly opts: StoreAdapterOptions) {}

  applySnapshot(s: SessionSnapshot, clientId: string): void {
    const session = useSessionStore(this.opts.pinia);
    session.applySnapshot(s, clientId);
    // `client.hello` のたび（初回・再接続のたび）に表示を復元する（design「フォーカスと表示」）。
    // `view.restoreView`（T16）はここまで呼び出し元が無かった——T26 で結線した。
    useViewStore(this.opts.pinia).restoreView((workspaceId, tabId) => {
      const tab = session.tabs.get(tabId);
      return tab && tab.workspaceId === workspaceId ? tab.focusedPaneId : null;
    }, session.focus);
  }

  applyEvent(e: ServerEvent): void {
    this.applyEventToSession(e);
    this.applyViewRepair();
  }

  /**
   * 表示中の pane / tab / workspace が閉じられていたら、残っているものへ表示と焦点を移す（D97）。
   * 構造のイベント以外では何も変わらない（`repairView` が null を返す）ので、毎回呼んでよい。
   * ダイアログを開いている間は、焦点そのものではなく「閉じたときに戻す先」を差し替える（焦点を動かすと
   * `TerminalPane` が `term.focus()` してダイアログからフォーカスを奪うため）。
   */
  private applyViewRepair(): void {
    const session = useSessionStore(this.opts.pinia);
    const view = useViewStore(this.opts.pinia);
    const dialogOpen = view.openDialog !== null;
    const focused = dialogOpen ? (view.preDialogFocusPaneId ?? view.focusedPaneId) : view.focusedPaneId;
    const next = repairView({ workspaceId: view.workspaceId, tabId: view.tabId, focusedPaneId: focused }, session);
    if (!next) return;
    if (next.workspaceId && next.tabId && (next.workspaceId !== view.workspaceId || next.tabId !== view.tabId)) view.setView(next.workspaceId, next.tabId);
    if (next.focusedPaneId === focused) return;
    if (dialogOpen) view.retargetPreDialogFocus(next.focusedPaneId);
    else view.focusPane(next.focusedPaneId);
  }

  private applyEventToSession(e: ServerEvent): void {
    const session = useSessionStore(this.opts.pinia);
    switch (e.event) {
      case "workspace.created":
      case "workspace.updated":
        session.workspaceUpserted(e.data.workspace);
        return;
      case "workspace.closed":
        session.workspaceClosed(e.data.workspaceId);
        return;
      case "tab.created":
      case "tab.updated":
        session.tabUpserted(e.data.tab);
        return;
      case "layout.updated":
        session.tabUpserted(e.data.tab);
        return;
      case "tab.closed":
        session.tabClosed(e.data.tabId);
        return;
      case "pane.created":
      case "pane.updated":
        session.paneUpserted(e.data.pane);
        return;
      case "pane.closed":
        session.paneClosed(e.data.paneId);
        return;
      case "pane.agent_status_changed":
        session.paneAgentStatusChanged(e.data.paneId, e.data.agent);
        return;
      case "pane.size_changed":
        session.paneSizeChanged(e.data.paneId, e.data.cols, e.data.rows);
        return;
      case "session.focus_changed":
        session.sessionFocusChanged(e.data.focus);
        return;
      case "pane.exited":
        this.opts.onPaneExited?.(e.data.paneId, e.data.exitCode);
        return;
      case "client.error":
        this.opts.onClientError?.(e.data.code, e.data.message);
        return;
    }
  }

  onAuthRequired(): void {
    this.opts.onAuthRequired();
  }

  onConnectionState(s: ConnectionState): void {
    this.opts.onConnectionState(s);
  }

  onOriginRejectSuspected(suspected: boolean): void {
    this.opts.onOriginRejectSuspected?.(suspected);
  }
}
