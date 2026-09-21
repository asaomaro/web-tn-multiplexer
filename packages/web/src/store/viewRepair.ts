import type { Pane, Tab, Workspace } from "@wtm/protocol";
import { depthFirstPaneIds } from "../term/layoutOrder.js";

export interface ViewTarget {
  workspaceId: string | null;
  tabId: string | null;
  focusedPaneId: string | null;
}

export interface SessionLike {
  workspaces: ReadonlyMap<string, Workspace>;
  tabs: ReadonlyMap<string, Tab>;
  panes: ReadonlyMap<string, Pane>;
}

/**
 * このブラウザの表示（workspace / tab / 焦点の pane）が、もう存在しないものを指していたら、残っているものへ
 * 移した結果を返す（D97）。直す必要が無ければ null。pane / tab / workspace を閉じた直後（自分が閉じた場合も、
 * 別のブラウザが閉じた場合も）に、何も表示されない・どの端末にもフォーカスが無い状態にしないためのもの。
 *
 * **選び方はサーバの規則をそのまま写す**（`SessionModel`：閉じた pane の代わりはレイアウト木の最初の葉、閉じた
 * tab の代わりは残りの tab の先頭、閉じた workspace の代わりは残りの workspace の先頭）。クライアントが持つ
 * `tab.focusedPaneId`・`workspace.activeTabId` は、焦点の移動では更新されない（サーバは `session.focus_changed`
 * しか送らない）古い値なので、閉じたものの代わりを選ぶときには使わない——使うとサーバの選んだものとずれる。
 * 別の workspace へ移るときだけは、その workspace の「最後に見ていた tab / pane」の手がかりとして使う。
 *
 * **生きている pane を 1 つも持たない tab は無いものとして扱う**（workspace も同様）。workspace を閉じる連鎖では
 * pane.closed が全て先に届き、tab.closed・workspace.closed が後から 1 つずつ届く——その途中で「中身の無い、
 * これから閉じられる tab」へ表示を移すと、閉じた pane の xterm.js を作って購読しに行ってしまう。
 */
export function repairView(cur: ViewTarget, s: SessionLike): ViewTarget | null {
  const liveLeaves = (t: Tab): string[] => depthFirstPaneIds(t.layout).filter((id) => s.panes.get(id)?.tabId === t.id);
  const aliveTab = (id: string | null | undefined, workspaceId: string): Tab | null => {
    const t = id ? s.tabs.get(id) : undefined;
    return t && t.workspaceId === workspaceId && liveLeaves(t).length > 0 ? t : null;
  };
  /** workspace の tab を、サーバと同じ `tabIds` の順で（`tabIds` にまだ載っていない新しい tab は後ろに）。 */
  const tabsOf = (w: Workspace): string[] => [...w.tabIds, ...[...s.tabs.values()].filter((t) => t.workspaceId === w.id && !w.tabIds.includes(t.id)).map((t) => t.id)];
  const firstAliveTab = (w: Workspace): Tab | null => {
    for (const id of tabsOf(w)) {
      const t = aliveTab(id, w.id);
      if (t) return t;
    }
    return null;
  };

  const curWs = cur.workspaceId ? s.workspaces.get(cur.workspaceId) : undefined;
  let ws: Workspace | undefined;
  let tab: Tab | null;
  if (curWs && firstAliveTab(curWs)) {
    ws = curWs;
    // 同じ workspace の中：今の tab が生きていればそのまま、閉じられていたら残りの先頭（サーバの規則）。
    tab = aliveTab(cur.tabId, ws.id) ?? firstAliveTab(ws);
  } else {
    ws = [...s.workspaces.values()].find((w) => firstAliveTab(w) !== null);
    if (!ws) return null; // 表示できるものが無い（最後の workspace を閉じ、サーバが作り直すまでの間。D24）
    // 別の workspace へ移る：その workspace の最後に見ていた tab（無ければ先頭）。
    tab = aliveTab(ws.activeTabId, ws.id) ?? firstAliveTab(ws);
  }
  if (!tab) return null;

  const live = liveLeaves(tab);
  let focusedPaneId: string;
  if (tab.id === cur.tabId) {
    // 同じ tab の中：今の pane が生きていればそのまま、閉じられていたら最初の葉（サーバの規則）。
    focusedPaneId = cur.focusedPaneId && live.includes(cur.focusedPaneId) ? cur.focusedPaneId : live[0]!;
  } else {
    focusedPaneId = live.includes(tab.focusedPaneId) ? tab.focusedPaneId : live[0]!;
  }

  if (ws.id === cur.workspaceId && tab.id === cur.tabId && focusedPaneId === cur.focusedPaneId) return null;
  return { workspaceId: ws.id, tabId: tab.id, focusedPaneId };
}
