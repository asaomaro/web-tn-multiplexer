import type { MethodName, ParamsOf, ResultOf, Tab, Workspace } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import type { Action } from "../keys/actions.js";
import type { ConnectionPort } from "../net/ports.js";
import { useSessionStore } from "../store/session.js";
import { useSettingsStore } from "../store/settings.js";
import { useViewStore } from "../store/view.js";
import TabBar from "./TabBar.vue";

let pinia: Pinia;

beforeEach(() => {
  // view ストアは初期化時に `wtm.prefs.v1`（localStorage）を読む。消さないと
  // 同じワーカーで先に走ったファイルの選択が持ち越される（20260920-sidebar-tabbar-controls）。
  localStorage.clear();
  pinia = createPinia();
});

function makeWorkspace(id: string, tabIds: string[]): Workspace {
  return { id, label: id, cwd: "/", tabIds, activeTabId: tabIds[0] ?? "", groupId: null, git: null, autoLabel: false };
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

function mountTabBar(
  conn: ConnectionPort,
  actions?: { openContextMenu: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn>; newTabInWorkspace?: ReturnType<typeof vi.fn> },
) {
  return mount(TabBar, {
    global: {
      plugins: [pinia],
      provide: {
        [ConnectionKey as symbol]: conn,
        [ActionDispatcherKey as symbol]: actions ?? { openContextMenu: vi.fn(), run: vi.fn(), newTabInWorkspace: vi.fn() },
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

// 20260920-sidebar-tabbar-controls の AC6：これまで新しいタブを作る導線は prefix+c と
// 「タブの右クリック → 新規」だけで、後者はタブが 1 つも無いと対象ごと消えていた。
describe("TabBar — 新しいタブのボタン", () => {
  it("押すと、表示中の workspace を宛先に newTabInWorkspace を呼ぶ（名前入力を開くのは dispatcher の責務）", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const newTabInWorkspace = vi.fn();
    const wrapper = mountTabBar(makeConnection(), { openContextMenu: vi.fn(), run: vi.fn(), newTabInWorkspace });
    await wrapper.get(".tab-bar-new").trigger("click");
    expect(newTabInWorkspace).toHaveBeenCalledWith("w1");
  });

  it("タブが 1 つも無くても押せる（右クリックの導線が消える場面こそ要る）", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", []));
    view.setView("w1", "");
    const newTabInWorkspace = vi.fn();
    const wrapper = mountTabBar(makeConnection(), { openContextMenu: vi.fn(), run: vi.fn(), newTabInWorkspace });
    expect(wrapper.findAll(".tab-bar-item").length).toBe(0);
    const btn = wrapper.get(".tab-bar-new");
    expect(btn.attributes("disabled")).toBeUndefined();
    await btn.trigger("click");
    expect(newTabInWorkspace).toHaveBeenCalledWith("w1");
  });

  it("表示中の workspace が無いときは押せない", () => {
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.get(".tab-bar-new").attributes("disabled")).toBeDefined();
  });

  it("role=tablist が持つのは tab だけ（＋ はその外）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    const list = wrapper.get('[role="tablist"]');
    expect(list.findAll(".tab-bar-new").length).toBe(0);
    expect(list.findAll('[role="tab"]').length).toBe(1);
  });
});

describe("TabBar — 位置・自動非表示・右端のエントリ（20260922-tabbar-pane-appearance）", () => {
  it("既定（position 省略）は上端の境界線（tab-bar-top）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.get(".tab-bar").classes()).toContain("tab-bar-top");
  });

  it("position=bottom のとき、下端の境界線（tab-bar-bottom）になる（AC1）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mount(TabBar, {
      props: { position: "bottom" },
      global: {
        plugins: [pinia],
        provide: {
          [ConnectionKey as symbol]: makeConnection(),
          [ActionDispatcherKey as symbol]: { openContextMenu: vi.fn(), run: vi.fn(), newTabInWorkspace: vi.fn() },
        },
      },
    });
    expect(wrapper.get(".tab-bar").classes()).toContain("tab-bar-bottom");
    // クラス（境界線の位置）だけでなく、実際に視覚順を入れ替える `order` も確かめる（E2E で発見：クラスだけでは
    // 見た目の位置が変わらない実装ミスを、単体テストが見落としていた）。`.app-main` の flex の並びは
    // `order` を比較するので、数値で入れ替わることを直接確認する。
    expect(wrapper.get(".tab-bar").attributes("style")).toContain("order: 1");
  });

  it("既定（position 省略）は order:0（先頭のまま）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.get(".tab-bar").attributes("style")).toContain("order: 0");
  });

  it("tab が 1 つで hideTabBarWhenSingleTab が入なら、バー自体が消える（AC2）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    const settings = useSettingsStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    settings.setHideTabBarWhenSingleTab(true);
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.find(".tab-bar").exists()).toBe(false);
  });

  it("tab が 2 つに増えると、hideTabBarWhenSingleTab が入でもまた表示される（AC2）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    const settings = useSettingsStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1", "t2"]));
    session.tabUpserted(makeTab("t1", "w1"));
    session.tabUpserted(makeTab("t2", "w1"));
    view.setView("w1", "t1");
    settings.setHideTabBarWhenSingleTab(true);
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.find(".tab-bar").exists()).toBe(true);
  });

  it("右端に zoom・hostname・text エントリを区切り文字でつなげて表示する（AC3・AC4）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    const settings = useSettingsStore(pinia);
    session.host = { os: "linux", hostname: "myhost", windowsBuild: null };
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1", { zoomedPaneId: "p1" }));
    view.setView("w1", "t1");
    settings.setTabBarRight([{ kind: "zoom" }, { kind: "hostname" }, { kind: "text", text: "hi" }]);
    settings.setTabBarRightSeparator(" · ");
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.get(".tab-bar-right").text()).toBe("Z · myhost · hi");
  });

  it("zoom していない tab では zoom エントリは空文字（区切り文字だけがつながる）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    const settings = useSettingsStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    settings.setTabBarRight([{ kind: "zoom" }, { kind: "text", text: "hi" }]);
    const wrapper = mountTabBar(makeConnection());
    // `.text()` は前後の空白を trim する（vue-test-utils の既定）ので、内部の実際の中身は
    // `.element.textContent` で確かめる（zoom の空文字 + 区切り文字 " " + "hi" = " hi"）。
    expect(wrapper.get(".tab-bar-right").element.textContent).toBe(" hi");
  });

  it("右端のエントリが無ければ .tab-bar-right 自体を描かない", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.find(".tab-bar-right").exists()).toBe(false);
  });

  it("datetime エントリは formatDatetime のプリセットで表示する（AC3）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    const settings = useSettingsStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    settings.setTabBarRight([{ kind: "datetime", format: "date" }]);
    const wrapper = mountTabBar(makeConnection());
    expect(wrapper.get(".tab-bar-right").text()).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});
