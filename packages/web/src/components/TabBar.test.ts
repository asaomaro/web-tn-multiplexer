import type { MethodName, ParamsOf, ResultOf, Tab, Workspace } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import type { Action } from "../keys/actions.js";
import type { ConnectionPort } from "../net/ports.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import TabBar from "./TabBar.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

function makeWorkspace(id: string, tabIds: string[]): Workspace {
  return { id, label: id, cwd: "/", tabIds, activeTabId: tabIds[0] ?? "", groupId: null, git: null };
}
function makeTab(id: string, workspaceId: string, overrides: Partial<Tab> = {}): Tab {
  return { id, workspaceId, label: id, layout: { type: "pane", paneId: "p1" }, focusedPaneId: "p1", zoomedPaneId: null, sizeOwnerClientId: null, ...overrides };
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

function mountTabBar(conn: ConnectionPort, actions?: { openContextMenu: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn> }) {
  return mount(TabBar, {
    global: {
      plugins: [pinia],
      provide: {
        [ConnectionKey as symbol]: conn,
        [ActionDispatcherKey as symbol]: actions ?? { openContextMenu: vi.fn(), run: vi.fn() },
      },
    },
  });
}

describe("TabBar", () => {
  it("現在の workspace の tabIds の順で並べる", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t2", "t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    session.tabUpserted(makeTab("t2", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    const labels = wrapper.findAll(".tab-bar-item").map((el) => el.find(".tab-bar-label").text());
    expect(labels).toEqual(["t2", "t1"]);
  });

  it("現在の tab に active クラスと aria-selected を付ける", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    const item = wrapper.get(".tab-bar-item");
    expect(item.classes()).toContain("tab-bar-item-active");
    expect(item.attributes("aria-selected")).toBe("true");
  });

  it("拡大中の tab には Z を出す", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1", { zoomedPaneId: "p1" }));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.find(".tab-bar-zoomed").text()).toBe("Z");
  });

  it("状態の印は出さない", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.find(".sidebar-state-icon").exists()).toBe(false);
  });

  it("クリックで切り替え、tab.focus を送る", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1", "t2"]));
    session.tabUpserted(makeTab("t1", "w1"));
    session.tabUpserted(makeTab("t2", "w1", { focusedPaneId: "p2" }));
    view.setView("w1", "t1");
    const conn = makeConnection();
    const wrapper = mountTabBar(conn);
    await wrapper.findAll(".tab-bar-item")[1]!.trigger("click");
    expect(view.tabId).toBe("t2");
    expect(view.focusedPaneId).toBe("p2");
    expect(conn.requests).toEqual([["tab.focus", { tabId: "t2" }]]);
  });

  it("右クリックで tab を対象に openContextMenu を呼ぶ", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const openContextMenu = vi.fn();
    const wrapper = mountTabBar(makeConnection(), { openContextMenu, run: vi.fn() });
    await wrapper.get(".tab-bar-item").trigger("contextmenu", { clientX: 3, clientY: 4 });
    expect(openContextMenu).toHaveBeenCalledWith({ kind: "tab", tabId: "t1" }, { x: 3, y: 4 });
  });

  it("ホイールで tabDelta アクションを送る（D56 の訂正 11）", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const run = vi.fn();
    const wrapper = mountTabBar(makeConnection(), { openContextMenu: vi.fn(), run });
    await wrapper.get(".tab-bar").trigger("wheel", { deltaY: 100 });
    expect(run).toHaveBeenCalledWith({ type: "tabDelta", delta: 1 } satisfies Action);
    await wrapper.get(".tab-bar").trigger("wheel", { deltaY: -100 });
    expect(run).toHaveBeenCalledWith({ type: "tabDelta", delta: -1 } satisfies Action);
  });
});
