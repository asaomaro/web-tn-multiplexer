import type { Pane, Tab, Workspace } from "@wtm/protocol";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionState } from "../net/ports.js";
import { useSessionStore } from "./session.js";
import { StoreAdapter } from "./StoreAdapter.js";
import { useViewStore } from "./view.js";

let pinia: Pinia;

beforeEach(() => {
  sessionStorage.clear(); // restoreView が内部で読み書きするため（applySnapshot のテスト間の汚染を防ぐ）
  pinia = createPinia();
});

function makeWorkspace(id: string): Workspace {
  return { id, label: id, cwd: "/", tabIds: [], activeTabId: "", groupId: null, git: null };
}
function makeTab(id: string, workspaceId: string): Tab {
  return { id, workspaceId, label: id, layout: { type: "pane", paneId: "p1" }, focusedPaneId: "p1", zoomedPaneId: null, sizeOwnerClientId: null };
}
function makePane(id: string, tabId: string): Pane {
  return { id, tabId, label: null, cwd: "/", shell: "/bin/bash", cols: 80, rows: 24, status: "running", failure: null, busy: false, title: "", rightClick: "herdr", agent: null };
}

function makeAdapter(overrides: Partial<{ onPaneExited: (p: string, c: number) => void; onClientError: (c: string, m: string) => void }> = {}) {
  const onAuthRequired = vi.fn();
  const onConnectionState = vi.fn();
  const adapter = new StoreAdapter({ pinia, onAuthRequired, onConnectionState, ...overrides });
  return { adapter, onAuthRequired, onConnectionState };
}

describe("StoreAdapter", () => {
  it("applySnapshot は session ストアへ反映する", () => {
    const { adapter } = makeAdapter();
    adapter.applySnapshot(
      {
        protocol: 1,
        serverVersion: "test",
        host: { os: "linux", windowsBuild: null, hostname: "h" },
        workspaces: [makeWorkspace("w1")],
        tabs: [],
        panes: [],
        focus: null,
        limits: { scrollbackLines: 5000 },
      },
      "c1",
    );
    expect(useSessionStore(pinia).workspaces.has("w1")).toBe(true);
    expect(useSessionStore(pinia).clientId).toBe("c1");
  });

  it("applySnapshot は view.restoreView も呼ぶ（T26。前回のタブが無ければサーバの focus に従う）", () => {
    const { adapter } = makeAdapter();
    adapter.applySnapshot(
      {
        protocol: 1,
        serverVersion: "test",
        host: { os: "linux", windowsBuild: null, hostname: "h" },
        workspaces: [makeWorkspace("w1")],
        tabs: [makeTab("t1", "w1")],
        panes: [makePane("p1", "t1")],
        focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
        limits: { scrollbackLines: 5000 },
      },
      "c1",
    );
    const view = useViewStore(pinia);
    expect(view.workspaceId).toBe("w1");
    expect(view.tabId).toBe("t1");
    expect(view.focusedPaneId).toBe("p1");
  });

  it("sessionStorage に前回の tab があれば、その tab の focusedPaneId へフォーカスする（review で発見した不具合の回帰テスト：" +
    "F5 で再読み込みしても手でクリックし直さずにキーボード操作を再開できる。AC-I3）", () => {
    // 1 回目：applySnapshot が restoreView 経由で sessionStorage に w1/t1 を書く（サーバの focus に従って）。
    const { adapter } = makeAdapter();
    adapter.applySnapshot(
      {
        protocol: 1,
        serverVersion: "test",
        host: { os: "linux", windowsBuild: null, hostname: "h" },
        workspaces: [makeWorkspace("w1")],
        tabs: [makeTab("t1", "w1")],
        panes: [makePane("p1", "t1")],
        focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
        limits: { scrollbackLines: 5000 },
      },
      "c1",
    );

    // 2 回目（ページの再読み込みを模す）：新しい pinia（＝新しい view ストア）で、同じ sessionStorage を読む。
    // サーバの focus はあえて別の tab（w2/t2）にして、「前回の tab（w1/t1）が優先される」ことも確かめる。
    const pinia2 = createPinia();
    const adapter2 = new StoreAdapter({ pinia: pinia2, onAuthRequired: vi.fn(), onConnectionState: vi.fn() });
    adapter2.applySnapshot(
      {
        protocol: 1,
        serverVersion: "test",
        host: { os: "linux", windowsBuild: null, hostname: "h" },
        workspaces: [makeWorkspace("w1"), makeWorkspace("w2")],
        tabs: [makeTab("t1", "w1"), makeTab("t2", "w2")],
        panes: [makePane("p1", "t1"), makePane("p2", "t2")],
        focus: { workspaceId: "w2", tabId: "t2", paneId: "p2" },
        limits: { scrollbackLines: 5000 },
      },
      "c2",
    );
    const view2 = useViewStore(pinia2);
    expect(view2.workspaceId).toBe("w1"); // 前回の tab（サーバの focus の w2 ではない）
    expect(view2.tabId).toBe("t1");
    expect(view2.focusedPaneId).toBe("p1"); // その tab の focusedPaneId（不具合修正前は null のままだった）
  });

  it.each([
    ["workspace.created", { workspace: makeWorkspace("w1") }],
    ["workspace.updated", { workspace: makeWorkspace("w1") }],
  ] as const)("%s は workspaceUpserted を呼ぶ", (event, data) => {
    const { adapter } = makeAdapter();
    adapter.applyEvent({ event, data } as never);
    expect(useSessionStore(pinia).workspaces.has("w1")).toBe(true);
  });

  it("workspace.closed", () => {
    const { adapter } = makeAdapter();
    useSessionStore(pinia).workspaceUpserted(makeWorkspace("w1"));
    adapter.applyEvent({ event: "workspace.closed", data: { workspaceId: "w1" } });
    expect(useSessionStore(pinia).workspaces.has("w1")).toBe(false);
  });

  it("tab.created/updated/layout.updated/closed", () => {
    const { adapter } = makeAdapter();
    adapter.applyEvent({ event: "tab.created", data: { tab: makeTab("t1", "w1") } });
    expect(useSessionStore(pinia).tabs.has("t1")).toBe(true);
    adapter.applyEvent({ event: "layout.updated", data: { tab: makeTab("t1", "w1") } });
    expect(useSessionStore(pinia).tabs.has("t1")).toBe(true);
    adapter.applyEvent({ event: "tab.closed", data: { tabId: "t1" } });
    expect(useSessionStore(pinia).tabs.has("t1")).toBe(false);
  });

  it("pane.created/updated/closed", () => {
    const { adapter } = makeAdapter();
    adapter.applyEvent({ event: "pane.created", data: { pane: makePane("p1", "t1") } });
    expect(useSessionStore(pinia).panes.has("p1")).toBe(true);
    adapter.applyEvent({ event: "pane.closed", data: { paneId: "p1" } });
    expect(useSessionStore(pinia).panes.has("p1")).toBe(false);
  });

  it("表示中の pane が閉じられたら、残りの pane へ焦点を移す（D97）", () => {
    const { adapter } = makeAdapter();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ ...makeWorkspace("w1"), tabIds: ["t1"], activeTabId: "t1" });
    session.tabUpserted({ ...makeTab("t1", "w1"), layout: { type: "split", id: "s1", dir: "right", ratio: 0.5, a: { type: "pane", paneId: "p1" }, b: { type: "pane", paneId: "p2" } }, focusedPaneId: "p2" });
    session.paneUpserted(makePane("p1", "t1"));
    session.paneUpserted(makePane("p2", "t1"));
    view.setView("w1", "t1");
    view.focusPane("p2");
    adapter.applyEvent({ event: "pane.closed", data: { paneId: "p2" } });
    expect(view.focusedPaneId).toBe("p1");
  });

  it("表示中の tab が閉じられたら残りの tab を、workspace が閉じられたら残りの workspace を表示する（D97）", () => {
    const { adapter } = makeAdapter();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ ...makeWorkspace("w1"), tabIds: ["t1", "t2"], activeTabId: "t2" });
    session.workspaceUpserted({ ...makeWorkspace("w9"), tabIds: ["t9"], activeTabId: "t9" });
    session.tabUpserted(makeTab("t1", "w1"));
    session.tabUpserted({ ...makeTab("t2", "w1"), layout: { type: "pane", paneId: "p2" }, focusedPaneId: "p2" });
    session.tabUpserted({ ...makeTab("t9", "w9"), layout: { type: "pane", paneId: "p9" }, focusedPaneId: "p9" });
    session.paneUpserted(makePane("p1", "t1"));
    session.paneUpserted(makePane("p2", "t2"));
    session.paneUpserted(makePane("p9", "t9"));
    view.setView("w1", "t2");
    view.focusPane("p2");

    adapter.applyEvent({ event: "pane.closed", data: { paneId: "p2" } });
    adapter.applyEvent({ event: "tab.closed", data: { tabId: "t2" } });
    expect([view.workspaceId, view.tabId, view.focusedPaneId]).toEqual(["w1", "t1", "p1"]);

    adapter.applyEvent({ event: "pane.closed", data: { paneId: "p1" } });
    adapter.applyEvent({ event: "tab.closed", data: { tabId: "t1" } });
    adapter.applyEvent({ event: "workspace.closed", data: { workspaceId: "w1" } });
    expect([view.workspaceId, view.tabId, view.focusedPaneId]).toEqual(["w9", "t9", "p9"]);
  });

  it("ダイアログを開いている間に焦点の pane が閉じられても、焦点は動かさず（ダイアログからフォーカスを奪わない）、閉じたときの戻り先だけを差し替える（D97・独立点検の指摘）", () => {
    const { adapter } = makeAdapter();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ ...makeWorkspace("w1"), tabIds: ["t1"], activeTabId: "t1" });
    session.tabUpserted({ ...makeTab("t1", "w1"), layout: { type: "split", id: "s1", dir: "right", ratio: 0.5, a: { type: "pane", paneId: "p1" }, b: { type: "pane", paneId: "p2" } }, focusedPaneId: "p2" });
    session.paneUpserted(makePane("p1", "t1"));
    session.paneUpserted(makePane("p2", "t1"));
    view.setView("w1", "t1");
    view.focusPane("p2");
    view.openDialogWithContext({ kind: "help" });

    adapter.applyEvent({ event: "pane.closed", data: { paneId: "p2" } });
    expect(view.focusedPaneId).toBe("p2"); // ダイアログを開いている間は焦点を動かさない
    view.closeDialog();
    expect(view.focusedPaneId).toBe("p1"); // 閉じたら、残りの pane へ戻る
  });

  it("pane.agent_status_changed / pane.size_changed", () => {
    const { adapter } = makeAdapter();
    useSessionStore(pinia).paneUpserted(makePane("p1", "t1"));
    adapter.applyEvent({ event: "pane.agent_status_changed", data: { paneId: "p1", agent: null } });
    adapter.applyEvent({ event: "pane.size_changed", data: { paneId: "p1", cols: 100, rows: 30 } });
    expect(useSessionStore(pinia).panes.get("p1")).toMatchObject({ cols: 100, rows: 30 });
  });

  it("session.focus_changed", () => {
    const { adapter } = makeAdapter();
    adapter.applyEvent({ event: "session.focus_changed", data: { focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" } } });
    expect(useSessionStore(pinia).focus).toEqual({ workspaceId: "w1", tabId: "t1", paneId: "p1" });
  });

  it("pane.exited は注入した onPaneExited へ（省略時は例外を投げない）", () => {
    const onPaneExited = vi.fn();
    const { adapter } = makeAdapter({ onPaneExited });
    adapter.applyEvent({ event: "pane.exited", data: { paneId: "p1", exitCode: 0 } });
    expect(onPaneExited).toHaveBeenCalledWith("p1", 0);

    const { adapter: adapter2 } = makeAdapter();
    expect(() => adapter2.applyEvent({ event: "pane.exited", data: { paneId: "p1", exitCode: 0 } })).not.toThrow();
  });

  it("client.error は注入した onClientError へ", () => {
    const onClientError = vi.fn();
    const { adapter } = makeAdapter({ onClientError });
    adapter.applyEvent({ event: "client.error", data: { code: "invalid_params", message: "bad" } });
    expect(onClientError).toHaveBeenCalledWith("invalid_params", "bad");
  });

  it("onOriginRejectSuspected は注入したコールバックを呼ぶ。省いていても例外を投げない（D107）", () => {
    const onOriginRejectSuspected = vi.fn();
    const adapter = new StoreAdapter({ pinia, onAuthRequired: vi.fn(), onConnectionState: vi.fn(), onOriginRejectSuspected });
    adapter.onOriginRejectSuspected(true);
    adapter.onOriginRejectSuspected(false);
    expect(onOriginRejectSuspected.mock.calls).toEqual([[true], [false]]);
    expect(() => makeAdapter().adapter.onOriginRejectSuspected(true)).not.toThrow();
  });

  it("onAuthRequired / onConnectionState は注入したコールバックをそのまま呼ぶ", () => {
    const { adapter, onAuthRequired, onConnectionState } = makeAdapter();
    adapter.onAuthRequired();
    expect(onAuthRequired).toHaveBeenCalled();
    const state: ConnectionState = "reconnecting";
    adapter.onConnectionState(state);
    expect(onConnectionState).toHaveBeenCalledWith("reconnecting");
  });
});
