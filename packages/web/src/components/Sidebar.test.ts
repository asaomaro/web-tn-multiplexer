import type { AgentInfo, MethodName, ParamsOf, Pane, ResultOf, Tab, Workspace } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import type { ConnectionPort } from "../net/ports.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import Sidebar from "./Sidebar.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

function makeWorkspace(id: string, overrides: Partial<Workspace> = {}): Workspace {
  return { id, label: id, cwd: "/", tabIds: ["t1"], activeTabId: "t1", groupId: null, git: null, ...overrides };
}
function makeTab(id: string, workspaceId: string, focusedPaneId = "p1"): Tab {
  return { id, workspaceId, label: id, layout: { type: "pane", paneId: focusedPaneId }, focusedPaneId, zoomedPaneId: null, sizeOwnerClientId: null };
}
function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return { instanceId: "a1", kind: "claude", label: "Claude Code", state: "working", completionSeq: 0, serverSeenSeq: 0, verified: true, since: 0, ...overrides };
}
function makePane(id: string, tabId: string, agent: AgentInfo | null = null): Pane {
  return { id, tabId, label: null, cwd: "/", shell: "/bin/bash", cols: 80, rows: 24, status: "running", failure: null, busy: false, title: "", rightClick: "herdr", agent };
}

function makeConnection(): ConnectionPort & { requests: [MethodName, unknown][] } {
  return {
    requests: [],
    request<M extends MethodName>(method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
      this.requests.push([method, params]);
      return Promise.resolve({} as ResultOf<M>);
    },
    sendInput: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    connect: vi.fn(),
  };
}

function mountSidebar(conn: ConnectionPort, actions?: { openContextMenu: ReturnType<typeof vi.fn> }) {
  return mount(Sidebar, {
    global: {
      plugins: [pinia],
      provide: {
        [ConnectionKey as symbol]: conn,
        [ActionDispatcherKey as symbol]: actions ?? { openContextMenu: vi.fn() },
      },
    },
  });
}

describe("Sidebar — spaces", () => {
  it("workspace の行に状態の印と名前を出す", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { label: "my-project" }));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", makeAgent({ state: "blocked" })));
    const wrapper = mountSidebar(makeConnection());
    const row = wrapper.find(".sidebar-spaces .sidebar-row");
    expect(row.text()).toContain("my-project");
    expect(row.find(".sidebar-state-icon").attributes("data-state")).toBe("blocked");
  });

  it("git の ahead/behind が両方 0 なら 2 行目を出さない", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { git: { branch: "main", ahead: 0, behind: 0 } }));
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-row-line2").exists()).toBe(false);
  });

  it("git の ahead/behind のどちらかが 0 でなければ 2 行目にブランチと件数を出す", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { git: { branch: "main", ahead: 2, behind: 1 } }));
    const wrapper = mountSidebar(makeConnection());
    const line2 = wrapper.find(".sidebar-row-line2");
    expect(line2.text()).toContain("main");
    expect(line2.text()).toContain("↑2");
    expect(line2.text()).toContain("↓1");
  });

  it("クリックで workspace の active tab へ切り替え、workspace.focus を送る", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { activeTabId: "t1" }));
    session.tabUpserted(makeTab("t1", "w1", "p1"));
    const conn = makeConnection();
    const wrapper = mountSidebar(conn);
    await wrapper.find(".sidebar-spaces .sidebar-row").trigger("click");
    expect(view.workspaceId).toBe("w1");
    expect(view.tabId).toBe("t1");
    expect(view.focusedPaneId).toBe("p1");
    expect(conn.requests).toEqual([["workspace.focus", { workspaceId: "w1" }]]);
  });

  it("右クリックで UiPort.openContextMenu を呼ぶ（workspace 対象）", async () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    const openContextMenu = vi.fn();
    const wrapper = mountSidebar(makeConnection(), { openContextMenu });
    await wrapper.find(".sidebar-spaces .sidebar-row").trigger("contextmenu", { clientX: 5, clientY: 6 });
    expect(openContextMenu).toHaveBeenCalledWith({ kind: "workspace", workspaceId: "w1" }, { x: 5, y: 6 });
  });

  it("navigate モードで選択中の workspace に選択スタイルを付ける", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    view.onModeChange("navigate");
    view.setNavigateSelection("w1");
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-spaces .sidebar-row").classes()).toContain("sidebar-row-selected");
  });

  // 20260920-ui-selection-visuals：以前は「表示中」を示す見た目が無く、navigate モード中のカーソルだけだった（AC1）。
  it("表示中の workspace の行に、モードに関係なく表示中のスタイルと aria-current を付ける", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.workspaceUpserted(makeWorkspace("w2"));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountSidebar(makeConnection());
    const rows = wrapper.findAll(".sidebar-spaces .sidebar-row");
    expect(rows[0]!.classes()).toContain("sidebar-row-current");
    expect(rows[0]!.attributes("aria-current")).toBe("true");
    // 表示中でない行には**属性ごと**付けない（`aria-current` は既定 false で、AT に露出してはいけない）。
    expect(rows[1]!.classes()).not.toContain("sidebar-row-current");
    expect(rows[1]!.attributes("aria-current")).toBeUndefined();
  });

  // AC2：表示中（面）と navigate のカーソル（線）は別の表し方なので、同じ行で重なっても両方読める。
  it("表示中かつ navigate で選択中の行には、2 つのクラスが同時に付く", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    view.onModeChange("navigate");
    view.setNavigateSelection("w1");
    const wrapper = mountSidebar(makeConnection());
    const classes = wrapper.find(".sidebar-spaces .sidebar-row").classes();
    expect(classes).toContain("sidebar-row-current");
    expect(classes).toContain("sidebar-row-selected");
  });

  // AC3：`↑n ↓n` は縮めると意味を失うので、縮ませない印を付ける（省略の対象はブランチ名だけ）。
  it("2 行目の ↑n ↓n に、縮ませない印（sidebar-git-counts）を付ける", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { git: { branch: "main", ahead: 2, behind: 1 } }));
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-row-line2 .sidebar-git-counts").text()).toBe("↑2 ↓1");
  });
});

describe("Sidebar — agents", () => {
  // AC1：agents 区画の行が指すのは pane なので、workspace の「表示中」は付けない。
  it("表示中の workspace に属する agents の行にも、表示中のスタイルは付かない", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", makeAgent()));
    view.setView("w1", "t1");
    const wrapper = mountSidebar(makeConnection());
    const row = wrapper.find(".sidebar-agents .sidebar-row");
    expect(row.classes()).not.toContain("sidebar-row-current");
    expect(row.attributes("aria-current")).toBeUndefined();
  });

  it("エージェントの行に状態・workspace・tab・エージェント名を出す", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { label: "proj" }));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", makeAgent({ label: "Claude Code", state: "working" })));
    const wrapper = mountSidebar(makeConnection());
    const row = wrapper.find(".sidebar-agents .sidebar-row");
    expect(row.text()).toContain("proj");
    expect(row.text()).toContain("t1");
    expect(row.text()).toContain("Claude Code");
    expect(row.find(".sidebar-state-icon").attributes("data-state")).toBe("working");
  });

  it("verified が false なら「未検証」を出す", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", makeAgent({ verified: false })));
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-unverified").exists()).toBe(true);
  });

  it("verified が true なら「未検証」を出さない", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", makeAgent({ verified: true })));
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-unverified").exists()).toBe(false);
  });

  it("エージェントの居ない pane は一覧に出さない", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", null));
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.findAll(".sidebar-agents .sidebar-row")).toHaveLength(0);
  });

  it("クリックでその pane の tab へ切り替えてフォーカスし、pane.focus を送る", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t2", "w1", "p9"));
    session.paneUpserted(makePane("p9", "t2", makeAgent()));
    const conn = makeConnection();
    const wrapper = mountSidebar(conn);
    await wrapper.find(".sidebar-agents .sidebar-row").trigger("click");
    expect(view.workspaceId).toBe("w1");
    expect(view.tabId).toBe("t2");
    expect(view.focusedPaneId).toBe("p9");
    expect(conn.requests).toEqual([["pane.focus", { paneId: "p9" }]]);
  });
});

describe("Sidebar — 折りたたみ", () => {
  it("view.sidebarCollapsed のときラベル類を出さない", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { label: "proj" }));
    view.toggleSidebar();
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar").classes()).toContain("sidebar-collapsed");
    expect(wrapper.find(".sidebar-label").exists()).toBe(false);
  });
});

describe("Sidebar — 幅のドラッグとダブルクリックでの復元（D56 の訂正 11）", () => {
  it("ドラッグで幅が変わる", async () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    const wrapper = mountSidebar(makeConnection());
    const divider = wrapper.find(".sidebar-divider");
    await divider.trigger("pointerdown", { clientX: 240 });
    await divider.trigger("pointermove", { clientX: 300 });
    expect((wrapper.find(".sidebar").element as HTMLElement).style.width).toBe("300px");
  });

  it("ダブルクリック（350ms 以内の 2 回目の pointerdown）で既定幅へ戻す", async () => {
    vi.useFakeTimers();
    try {
      const session = useSessionStore(pinia);
      session.workspaceUpserted(makeWorkspace("w1"));
      const wrapper = mountSidebar(makeConnection());
      const divider = wrapper.find(".sidebar-divider");
      await divider.trigger("pointerdown", { clientX: 240 });
      await divider.trigger("pointermove", { clientX: 300 });
      await divider.trigger("pointerup");
      await divider.trigger("pointerdown", { clientX: 300 }); // 2 回目（350ms 以内）
      expect((wrapper.find(".sidebar").element as HTMLElement).style.width).toBe("240px");
    } finally {
      vi.useRealTimers();
    }
  });
});
