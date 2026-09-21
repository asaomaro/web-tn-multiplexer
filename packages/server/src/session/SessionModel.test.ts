import { describe, expect, it } from "vitest";
import { NotFoundError, SessionModel, type NewPaneInit } from "./SessionModel.js";

const init: NewPaneInit = { cwd: "/home/u", shell: "/bin/bash", cols: 80, rows: 24 };

describe("SessionModel — creation", () => {
  it("creates a workspace with its first tab and pane", () => {
    const model = new SessionModel();
    const { workspace, tab, pane } = model.createWorkspace("/home/u", "api", init);
    expect(workspace.id).toBe("w1");
    expect(tab.id).toBe("t1");
    expect(pane.id).toBe("p1");
    expect(workspace.tabIds).toEqual(["t1"]);
    expect(workspace.activeTabId).toBe("t1");
    expect(tab.focusedPaneId).toBe("p1");
    expect(tab.layout).toEqual({ type: "pane", paneId: "p1" });
    expect(model.getFocus()).toEqual({ workspaceId: "w1", tabId: "t1", paneId: "p1" });
  });

  it("allocates ids that keep increasing across workspaces", () => {
    const model = new SessionModel();
    model.createWorkspace("/a", "a", init);
    const second = model.createWorkspace("/b", "b", init);
    expect(second.workspace.id).toBe("w2");
    expect(second.tab.id).toBe("t2");
    expect(second.pane.id).toBe("p2");
  });

  it("creates a tab inside a workspace and focuses it", () => {
    const model = new SessionModel();
    const { workspace } = model.createWorkspace("/home/u", "api", init);
    const { tab, pane } = model.createTab(workspace.id, "logs", init);
    expect(tab.workspaceId).toBe(workspace.id);
    expect(model.getWorkspace(workspace.id)?.tabIds).toEqual(["t1", tab.id]);
    expect(model.getWorkspace(workspace.id)?.activeTabId).toBe(tab.id);
    expect(model.getFocus()?.paneId).toBe(pane.id);
  });

  it("throws NotFoundError for an unknown workspace id", () => {
    const model = new SessionModel();
    expect(() => model.createTab("w99", "x", init)).toThrow(NotFoundError);
  });
});

describe("SessionModel — split / close panes", () => {
  it("splits a pane and tracks both panes in the tab layout", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    const newPaneId = model.reserveNextPaneId();
    const { pane: newPane } = model.splitPane(pane.id, "right", undefined, newPaneId, init);
    const updatedTab = model.getTab(tab.id)!;
    expect(updatedTab.layout).toEqual({
      type: "split",
      id: "s1",
      dir: "right",
      ratio: 0.5,
      a: { type: "pane", paneId: pane.id },
      b: { type: "pane", paneId: newPane.id },
    });
    expect(updatedTab.focusedPaneId).toBe(newPane.id); // 新しい pane にフォーカスが移る
  });

  it("closing one of two panes collapses the split without closing the tab", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    const newPaneId = model.reserveNextPaneId();
    const { pane: newPane } = model.splitPane(pane.id, "right", undefined, newPaneId, init);

    const result = model.closePane(newPane.id);
    expect(result).toEqual({ removedPaneIds: [newPane.id], removedTabIds: [], closedWorkspaceId: null });
    expect(model.getTab(tab.id)?.layout).toEqual({ type: "pane", paneId: pane.id });
    expect(model.getTab(tab.id)?.focusedPaneId).toBe(pane.id); // 消えた方にフォーカスがあったので移る
    expect(model.getPane(newPane.id)).toBeUndefined();
  });

  it("closing the last pane in a tab closes the tab too, without double-counting", () => {
    const model = new SessionModel();
    const { tab, pane, workspace } = model.createWorkspace("/home/u", "api", init);
    model.createTab(workspace.id, "second", init); // 2 つ目の tab を作っておく（workspace は残る）

    const result = model.closePane(pane.id);
    expect(result.removedPaneIds).toEqual([pane.id]); // 二重カウントしない
    expect(result.removedTabIds).toEqual([tab.id]);
    expect(result.closedWorkspaceId).toBeNull();
    expect(model.getTab(tab.id)).toBeUndefined();
    expect(model.getWorkspace(workspace.id)?.tabIds).not.toContain(tab.id);
  });

  it("closing the last pane in the last tab closes the workspace (D18 cascade)", () => {
    const model = new SessionModel();
    const { pane, tab, workspace } = model.createWorkspace("/home/u", "api", init);
    const result = model.closePane(pane.id);
    expect(result.removedPaneIds).toEqual([pane.id]);
    expect(result.removedTabIds).toEqual([tab.id]);
    expect(result.closedWorkspaceId).toBe(workspace.id);
    expect(model.getWorkspace(workspace.id)).toBeUndefined();
    expect(model.isEmpty()).toBe(true);
  });

  it("does not auto-create a workspace on its own when the last one closes (D24 is SessionService's job)", () => {
    const model = new SessionModel();
    const { pane } = model.createWorkspace("/home/u", "api", init);
    model.closePane(pane.id);
    expect(model.isEmpty()).toBe(true); // SessionModel はここで止まる。自動作成は SessionService.closePane が行う
  });

  it("closing a whole tab removes all of its panes", () => {
    const model = new SessionModel();
    const { tab, pane, workspace } = model.createWorkspace("/home/u", "api", init);
    const newPaneId = model.reserveNextPaneId();
    model.splitPane(pane.id, "right", undefined, newPaneId, init);
    model.createTab(workspace.id, "second", init); // avoid cascading to workspace close

    const result = model.closeTab(tab.id);
    expect(result.removedPaneIds.sort()).toEqual([pane.id, newPaneId].sort());
    expect(model.getPane(pane.id)).toBeUndefined();
    expect(model.getPane(newPaneId)).toBeUndefined();
  });
});

describe("SessionModel — focus / navigation", () => {
  it("focusPane updates tab.focusedPaneId, workspace.activeTabId, and session focus", () => {
    const model = new SessionModel();
    const { workspace, pane: p1 } = model.createWorkspace("/home/u", "api", init);
    const { tab: t2, pane: p2 } = model.createTab(workspace.id, "logs", init);
    model.focusTab(model.getWorkspace(workspace.id)!.tabIds[0]!); // 戻って t1 を選ぶ
    model.focusPane(p2.id);
    expect(model.getTab(t2.id)?.focusedPaneId).toBe(p2.id);
    expect(model.getWorkspace(workspace.id)?.activeTabId).toBe(t2.id);
    expect(model.getFocus()).toEqual({ workspaceId: workspace.id, tabId: t2.id, paneId: p2.id });
    void p1;
  });

  it("focusDirection moves to the neighbor and swapPane exchanges positions", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    const newPaneId = model.reserveNextPaneId();
    const { pane: right } = model.splitPane(pane.id, "right", undefined, newPaneId, init);

    const moved = model.focusDirection(right.id, "left");
    expect(moved).toBe(pane.id);
    expect(model.getTab(tab.id)?.focusedPaneId).toBe(pane.id);

    const swappedWith = model.swapPane(pane.id, "right");
    expect(swappedWith).toBe(right.id);
    expect(model.getTab(tab.id)?.layout).toMatchObject({
      a: { paneId: right.id },
      b: { paneId: pane.id },
    });
  });

  it("cyclePane focuses the next pane in depth-first order, wrapping at the ends", () => {
    const model = new SessionModel();
    const { pane } = model.createWorkspace("/home/u", "api", init);
    const p2 = model.reserveNextPaneId();
    model.splitPane(pane.id, "right", undefined, p2, init);
    const next = model.cyclePane(pane.id, 1);
    expect(next).toBe(p2);
    const wrapped = model.cyclePane(p2, 1);
    expect(wrapped).toBe(pane.id);
  });

  it("zoomPane toggles the zoomed pane id", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    model.zoomPane(pane.id, "toggle");
    expect(model.getTab(tab.id)?.zoomedPaneId).toBe(pane.id);
    model.zoomPane(pane.id, "toggle");
    expect(model.getTab(tab.id)?.zoomedPaneId).toBeNull();
  });

  it("zoom 中に分割すると zoom を解除する（herdr の split_pane_with_runtime と同じ。D100）", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    const p2 = model.reserveNextPaneId();
    model.splitPane(pane.id, "right", undefined, p2, init);
    model.zoomPane(pane.id, "on");
    const p3 = model.reserveNextPaneId();
    model.splitPane(pane.id, "down", undefined, p3, init);
    expect(model.getTab(tab.id)?.zoomedPaneId).toBeNull();
    expect(model.getTab(tab.id)?.focusedPaneId).toBe(p3);

    // zoom 中の pane とは別の pane を分割しても解除する。
    model.zoomPane(pane.id, "on");
    const p4 = model.reserveNextPaneId();
    model.splitPane(p2, "down", undefined, p4, init);
    expect(model.getTab(tab.id)?.zoomedPaneId).toBeNull();
  });

  it("zoom 中にどの pane を閉じても zoom を解除する（herdr の detach_pane と同じ。D100）", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    const p2 = model.reserveNextPaneId();
    model.splitPane(pane.id, "right", undefined, p2, init);
    const p3 = model.reserveNextPaneId();
    model.splitPane(p2, "down", undefined, p3, init);
    model.zoomPane(pane.id, "on");
    model.closePane(p3); // zoom 中の pane とは別の pane を閉じた
    expect(model.getTab(tab.id)?.zoomedPaneId).toBeNull();
  });
});

describe("SessionModel — misc mutations", () => {
  it("renamePane / renameTab / renameWorkspace update the label", () => {
    const model = new SessionModel();
    const { workspace, tab, pane } = model.createWorkspace("/home/u", "api", init);
    model.renamePane(pane.id, "reviewer");
    model.renameTab(tab.id, "agents");
    model.renameWorkspace(workspace.id, "renamed");
    expect(model.getPane(pane.id)?.label).toBe("reviewer");
    expect(model.getTab(tab.id)?.label).toBe("agents");
    expect(model.getWorkspace(workspace.id)?.label).toBe("renamed");
  });

  it("setRightClick and updatePaneRuntime patch only the given fields", () => {
    const model = new SessionModel();
    const { pane } = model.createWorkspace("/home/u", "api", init);
    model.setRightClick(pane.id, "pane");
    expect(model.getPane(pane.id)?.rightClick).toBe("pane");

    model.updatePaneRuntime(pane.id, { busy: true });
    expect(model.getPane(pane.id)?.busy).toBe(true);
    expect(model.getPane(pane.id)?.cwd).toBe(init.cwd); // 触れていない欄は変わらない

    model.updatePaneRuntime(pane.id, { cwd: "/new/dir" });
    expect(model.getPane(pane.id)?.busy).toBe(true); // 前の busy は保たれる
    expect(model.getPane(pane.id)?.cwd).toBe("/new/dir");
  });

  it("updatePaneRuntime can explicitly clear the agent to null", () => {
    const model = new SessionModel();
    const { pane } = model.createWorkspace("/home/u", "api", init);
    const agent = {
      instanceId: "a1",
      kind: "claude",
      label: "Claude Code",
      state: "working" as const,
      completionSeq: 0,
      serverSeenSeq: 0,
      verified: true,
      since: Date.now(),
    };
    model.updatePaneRuntime(pane.id, { agent });
    expect(model.getPane(pane.id)?.agent).toEqual(agent);
    model.updatePaneRuntime(pane.id, { agent: null });
    expect(model.getPane(pane.id)?.agent).toBeNull();
  });

  it("markPaneFailed sets status and failure", () => {
    const model = new SessionModel();
    const { pane } = model.createWorkspace("/home/u", "api", init);
    model.markPaneFailed(pane.id, "shell not found");
    expect(model.getPane(pane.id)).toMatchObject({ status: "failed", failure: "shell not found" });
  });

  it("updateWorkspaceGit sets the git info", () => {
    const model = new SessionModel();
    const { workspace } = model.createWorkspace("/home/u", "api", init);
    model.updateWorkspaceGit(workspace.id, { branch: "main", ahead: 1, behind: 0 });
    expect(model.getWorkspace(workspace.id)?.git).toEqual({ branch: "main", ahead: 1, behind: 0 });
  });

  it("setSplitRatio and resizeByDirection change the layout ratio", () => {
    const model = new SessionModel();
    const { tab, pane } = model.createWorkspace("/home/u", "api", init);
    const p2 = model.reserveNextPaneId();
    model.splitPane(pane.id, "right", undefined, p2, init);
    const splitId = (model.getTab(tab.id)!.layout as { id: string }).id;
    model.setSplitRatio(tab.id, splitId, 0.8);
    expect(model.getTab(tab.id)?.layout).toMatchObject({ ratio: 0.8 });
    model.resizeByDirection(pane.id, "left", 0.1);
    const layout = model.getTab(tab.id)?.layout as { ratio: number };
    expect(layout.ratio).toBeCloseTo(0.7, 10);
  });

  it("setPaneSize updates cols/rows", () => {
    const model = new SessionModel();
    const { pane } = model.createWorkspace("/home/u", "api", init);
    model.setPaneSize(pane.id, 120, 40);
    expect(model.getPane(pane.id)).toMatchObject({ cols: 120, rows: 40 });
  });
});

describe("SessionModel — snapshot and id counters", () => {
  it("buildSnapshot reflects all workspaces/tabs/panes and the focus", () => {
    const model = new SessionModel();
    const { workspace } = model.createWorkspace("/home/u", "api", init);
    const snapshot = model.buildSnapshot("0.1.0", { os: "linux", windowsBuild: null, hostname: "h" }, { scrollbackLines: 5000 });
    expect(snapshot.protocol).toBe(1);
    expect(snapshot.workspaces.map((w) => w.id)).toEqual([workspace.id]);
    expect(snapshot.tabs.length).toBe(1);
    expect(snapshot.panes.length).toBe(1);
    expect(snapshot.focus).toEqual(model.getFocus());
  });

  it("setNextIdCounters lets restore continue numbering without collisions", () => {
    const model = new SessionModel();
    model.setNextIdCounters({ w: 5, t: 5, p: 5, s: 5, a: 5 });
    const { workspace } = model.createWorkspace("/home/u", "api", init);
    expect(workspace.id).toBe("w5");
    expect(model.getNextIdCounters().w).toBe(6);
  });
});
