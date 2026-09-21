import type { AgentInfo, MethodName, ParamsOf, Pane, ResultOf, Tab, Workspace } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import type { ConnectionPort } from "../net/ports.js";
import { useSessionStore } from "../store/session.js";
import { readPrefs, useViewStore, writePrefs } from "../store/view.js";
import Sidebar from "./Sidebar.vue";

let pinia: Pinia;

beforeEach(() => {
  // 並び順は localStorage に残る（20260920-sidebar-tabbar-controls）。消さないと前のテストの選択が持ち越される。
  localStorage.clear();
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

function makeActions() {
  return { openContextMenu: vi.fn(), run: vi.fn() };
}

function mountSidebar(conn: ConnectionPort, actions?: { openContextMenu: ReturnType<typeof vi.fn>; run?: ReturnType<typeof vi.fn> }) {
  return mount(Sidebar, {
    global: {
      plugins: [pinia],
      provide: {
        [ConnectionKey as symbol]: conn,
        [ActionDispatcherKey as symbol]: actions ?? makeActions(),
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

  // 20260921-herdr-settings-gaps の D2：状態の印は `StateIcon`。`data-state` だけでは以前の素の `<span>` でも通るので、
  // 字形と読み上げの名前まで見る（戻すと点すら描かれない——呼ぶ側の CSS は消してある）。
  it("状態の印は字形と読み上げの名前を持つ（StateIcon）", () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    session.paneUpserted(makePane("p1", "t1", makeAgent({ state: "blocked" })));
    const icon = mountSidebar(makeConnection()).find('.sidebar-spaces .sidebar-state-icon[data-state="blocked"]');
    expect(icon.text()).toBe("×");
    expect(icon.attributes("role")).toBe("img");
    expect(icon.attributes("aria-label")).toBe("入力待ち");
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

// 20260920-sidebar-tabbar-controls：マウスで触れる導線を足す（キー操作は変えず、同じ `run` を通す）。
describe("Sidebar — ボタン", () => {
  it("折りたたみのボタンは畳んでも出し、aria-expanded で状態を伝える（AC1・AC2）", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountSidebar(makeConnection(), actions);
    const btn = wrapper.get(".sidebar-collapse-btn");
    expect(btn.attributes("aria-expanded")).toBe("true");
    await btn.trigger("click");
    expect(actions.run).toHaveBeenCalledWith({ type: "toggleSidebar" });

    view.toggleSidebar(); // 畳んだ状態でも押せないと戻れなくなる
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sidebar-collapse-btn").exists()).toBe(true);
    expect(wrapper.get(".sidebar-collapse-btn").attributes("aria-expanded")).toBe("false");
  });

  it("「新規」はキーの prefix+shift+N と同じ action を送る（AC3）", async () => {
    const actions = makeActions();
    const wrapper = mountSidebar(makeConnection(), actions);
    await wrapper.findAll(".sidebar-section-footer .sidebar-btn")[0]!.trigger("click");
    expect(actions.run).toHaveBeenCalledWith({ type: "newWorkspace" });
  });

  it("「メニュー」は global のメニューを開き、開いている間は aria-expanded が true（AC4）", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountSidebar(makeConnection(), actions);
    const btn = wrapper.get(".sidebar-section-footer .sidebar-btn-right");
    expect(btn.attributes("aria-expanded")).toBe("false");
    await btn.trigger("click");
    expect(actions.openContextMenu).toHaveBeenCalledWith({ kind: "global" }, expect.anything());
    // 実際に開くのは `ActionDispatcher` なので、ここではストアを直接動かして表示を確かめる。
    view.openContextMenu({ kind: "global" }, { x: 0, y: 0 });
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".sidebar-section-footer .sidebar-btn-right").attributes("aria-expanded")).toBe("true");
  });

  // 帯ごとに分けて確かめる。1 つの it にまとめると、片方の `v-if` を外しても
  // もう片方の失敗に隠れて素通りする（独立点検で実際にそうなっていた）。
  it("折りたたむと spaces のフッタが消える（AC11）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-section-footer").exists()).toBe(true);
    view.toggleSidebar();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sidebar-section-footer").exists()).toBe(false);
  });

  it("折りたたむと agents の見出しが消える（AC11）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountSidebar(makeConnection());
    expect(wrapper.find(".sidebar-section-header").exists()).toBe(true);
    view.toggleSidebar();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sidebar-section-header").exists()).toBe(false);
  });

  it("折りたたんでも、折りたたみの帯は残り押せる（AC1・AC11）", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountSidebar(makeConnection(), actions);
    view.toggleSidebar();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sidebar-footer").exists()).toBe(true);
    await wrapper.get(".sidebar-collapse-btn").trigger("click"); // 畳んだ状態からも戻せる
    expect(actions.run).toHaveBeenCalledWith({ type: "toggleSidebar" });
  });

  // AC7：herdr と同じく「順序名そのものがボタン」。表示が現在値で、押すと切り替わる。
  it("ソートのボタンは現在の並び順を表示し、押すと切り替わる（AC7）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountSidebar(makeConnection());
    const btn = wrapper.get(".sidebar-sort-btn");
    expect(btn.text()).toBe("グループ順"); // 内部の値（grouped / priority）はそのまま出さない
    await btn.trigger("click");
    expect(view.agentSort).toBe("priority");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".sidebar-sort-btn").text()).toBe("優先度順");
    await wrapper.get(".sidebar-sort-btn").trigger("click");
    expect(view.agentSort).toBe("grouped");
  });
});

// AC7〜AC9：並び順。`grouped` は並べ替えない（サーバが返す順がそのままグループになる）。
describe("Sidebar — agents の並び順", () => {
  function seedThreeAgents(): void {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    // 挿入順は idle → blocked → working。since は idle が最新。
    session.paneUpserted(makePane("p-idle", "t1", makeAgent({ instanceId: "a1", state: "idle", since: 300 })));
    session.paneUpserted(makePane("p-blocked", "t1", makeAgent({ instanceId: "a2", state: "blocked", since: 100 })));
    session.paneUpserted(makePane("p-working", "t1", makeAgent({ instanceId: "a3", state: "working", since: 200 })));
  }

  it("grouped（既定）では並べ替えない（AC9）", () => {
    seedThreeAgents();
    const wrapper = mountSidebar(makeConnection());
    const states = wrapper.findAll(".sidebar-agents .sidebar-row .sidebar-state-icon").map((el) => el.attributes("data-state"));
    expect(states).toEqual(["idle", "blocked", "working"]);
  });

  it("priority では状態の優先度の降順に並ぶ（AC8）", async () => {
    seedThreeAgents();
    const view = useViewStore(pinia);
    view.toggleAgentSort();
    const wrapper = mountSidebar(makeConnection());
    await wrapper.vm.$nextTick();
    const states = wrapper.findAll(".sidebar-agents .sidebar-row .sidebar-state-icon").map((el) => el.attributes("data-state"));
    expect(states).toEqual(["blocked", "working", "idle"]);
  });

  it("priority で優先度が同じなら、状態が最近変わったものが上（AC8）", async () => {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.tabUpserted(makeTab("t1", "w1"));
    // 並びが見分けられるよう、エージェント名を別にする（2 行目に出る）。
    session.paneUpserted(makePane("p-old", "t1", makeAgent({ instanceId: "a1", label: "古いほう", state: "working", since: 100 })));
    session.paneUpserted(makePane("p-new", "t1", makeAgent({ instanceId: "a2", label: "新しいほう", state: "working", since: 900 })));
    const view = useViewStore(pinia);
    view.toggleAgentSort();
    const wrapper = mountSidebar(makeConnection());
    await wrapper.vm.$nextTick();
    const rows = wrapper.findAll(".sidebar-agents .sidebar-row");
    expect(rows.length).toBe(2);
    expect(rows[0]!.text()).toContain("新しいほう"); // 挿入順では「古いほう」が先
    expect(rows[1]!.text()).toContain("古いほう");
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

// 20260921-herdr-settings-gaps の AC1・AC-I5：幅は**ドラッグを終えたときに 1 回**保存する（途中では書かない）。
// E2E が通すのは `pointerup` の経路だけなので、ほかの終わり方はここで 1 つずつ固定する。
describe("Sidebar — 幅を覚える", () => {
  function setup() {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    const wrapper = mountSidebar(makeConnection());
    return { wrapper, divider: wrapper.find(".sidebar-divider") };
  }
  const saved = (): unknown => readPrefs()["sidebarWidth"];

  it("ドラッグの途中では保存しない", async () => {
    const { divider } = setup();
    await divider.trigger("pointerdown", { clientX: 240 });
    await divider.trigger("pointermove", { clientX: 300 });
    expect(saved()).toBeUndefined();
  });

  it.each(["pointerup", "pointercancel", "lostpointercapture"])("%s でドラッグを終えると、見えている幅を保存する", async (ev) => {
    const { divider } = setup();
    await divider.trigger("pointerdown", { clientX: 240 });
    await divider.trigger("pointermove", { clientX: 300 });
    await divider.trigger(ev);
    expect(saved()).toBe(300);
  });

  it("終えた後の pointermove では幅も保存値も変わらない（pointerup の後の lostpointercapture でも 2 度書かない）", async () => {
    const { wrapper, divider } = setup();
    await divider.trigger("pointerdown", { clientX: 240 });
    await divider.trigger("pointermove", { clientX: 300 });
    await divider.trigger("pointerup");
    writePrefs({ sidebarWidth: 999 }); // 2 度目に書いたら上書きされて分かる印
    await divider.trigger("lostpointercapture");
    await divider.trigger("pointermove", { clientX: 200 });
    expect(saved()).toBe(999);
    expect((wrapper.find(".sidebar").element as HTMLElement).style.width).toBe("300px");
  });

  it("ダブルクリックで既定に戻したときも保存する", async () => {
    vi.useFakeTimers();
    try {
      const { divider } = setup();
      await divider.trigger("pointerdown", { clientX: 240 });
      await divider.trigger("pointermove", { clientX: 300 });
      await divider.trigger("pointerup");
      await divider.trigger("pointerdown", { clientX: 300 }); // 2 回目（350ms 以内）
      expect(saved()).toBe(240);
    } finally {
      vi.useRealTimers();
    }
  });

  // AC-I5：`showModal()` でポインタの捕捉がどうなるかは確かめた出所が無いので、こちらで終わらせる。
  it("ドラッグ中にダイアログが開いたら、その時点で終えて保存し、以後の pointermove を無視する", async () => {
    const { wrapper, divider } = setup();
    await divider.trigger("pointerdown", { clientX: 240 });
    await divider.trigger("pointermove", { clientX: 320 });
    useViewStore(pinia).openDialogWithContext({ kind: "settings" });
    await wrapper.vm.$nextTick();
    expect(saved()).toBe(320);
    await divider.trigger("pointermove", { clientX: 200 });
    expect((wrapper.find(".sidebar").element as HTMLElement).style.width, "終えた後は動かない").toBe("320px");
  });

  // 起点はストアの幅。既定の 240 から 1 回だけ動かすテストでは、起点を既定に固定する・累積で足す、の壊れ方を見分けられない。
  it("ドラッグの起点は保存された幅で、pointermove は起点からの移動量で決まる", async () => {
    writePrefs({ sidebarWidth: 280 });
    pinia = createPinia();
    const { wrapper, divider } = setup();
    await divider.trigger("pointerdown", { clientX: 100 });
    await divider.trigger("pointermove", { clientX: 120 });
    await divider.trigger("pointermove", { clientX: 150 });
    expect((wrapper.find(".sidebar").element as HTMLElement).style.width).toBe("330px");
  });

  it("畳んでいる間は、境目を動かしても幅も保存値も変わらない", async () => {
    const { wrapper, divider } = setup();
    useViewStore(pinia).toggleSidebar();
    await wrapper.vm.$nextTick();
    writePrefs({ sidebarWidth: 240 });
    await divider.trigger("pointerdown", { clientX: 40 });
    await divider.trigger("pointermove", { clientX: 140 });
    await divider.trigger("pointerup");
    expect(saved()).toBe(240);
    expect(useViewStore(pinia).sidebarWidth).toBe(240);
  });

  it("ドラッグしていないときにダイアログが開いても保存しない", async () => {
    const { wrapper } = setup();
    useViewStore(pinia).openDialogWithContext({ kind: "settings" });
    await wrapper.vm.$nextTick();
    expect(saved()).toBeUndefined();
  });

  it("保存された幅で開く（AC1）", () => {
    writePrefs({ sidebarWidth: 280 });
    pinia = createPinia(); // ストアは作る時点で読む
    const { wrapper } = setup();
    expect((wrapper.find(".sidebar").element as HTMLElement).style.width).toBe("280px");
  });
});
