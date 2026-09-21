import type { Pane, Tab, Workspace } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey, TerminalRegistryKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import ContextMenu from "./ContextMenu.vue";

let pinia: Pinia;

beforeEach(() => {
  // view ストアは初期化時に `wtm.prefs.v1`（localStorage）を読む。消さないと
  // 同じワーカーで先に走ったファイルの選択が持ち越される（20260920-sidebar-tabbar-controls）。
  localStorage.clear();
  pinia = createPinia();
});

function makeActions() {
  return {
    renamePaneById: vi.fn(),
    clearPaneName: vi.fn(),
    splitPane: vi.fn(),
    zoomPane: vi.fn(),
    setRightClickTarget: vi.fn(),
    pasteIntoPane: vi.fn(),
    closePaneById: vi.fn(),
    newTabInWorkspace: vi.fn(),
    renameTabById: vi.fn(),
    closeTabById: vi.fn(),
    renameWorkspaceById: vi.fn(),
    closeWorkspaceById: vi.fn(),
    run: vi.fn(),
  };
}

function makePane(id: string, overrides: Partial<Pane> = {}): Pane {
  return { id, tabId: "t1", label: null, cwd: "/", shell: "/bin/bash", cols: 80, rows: 24, status: "running", failure: null, busy: false, title: "", rightClick: "herdr", agent: null, ...overrides };
}
function makeTab(id: string, workspaceId: string): Tab {
  return { id, workspaceId, label: id, layout: { type: "pane", paneId: "p1" }, focusedPaneId: "p1", zoomedPaneId: null, sizeOwnerClientId: null };
}
function makeWorkspace(id: string): Workspace {
  return { id, label: id, cwd: "/", tabIds: [], activeTabId: "", groupId: null, git: null };
}

function mountMenu(actions: ReturnType<typeof makeActions>, registry?: { focus: (paneId: string) => void }) {
  return mount(ContextMenu, {
    global: { plugins: [pinia], provide: { [ActionDispatcherKey as symbol]: actions, ...(registry ? { [TerminalRegistryKey as symbol]: registry } : {}) } },
    attachTo: document.body,
  });
}

describe("ContextMenu — pane", () => {
  it("名前が無ければ「名前の消去」を出さない", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { label: null }));
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    const labels = wrapper.findAll("li").map((li) => li.text());
    expect(labels).not.toContain("名前の消去");
  });

  it("名前があれば「名前の消去」を出す", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { label: "my pane" }));
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    expect(wrapper.findAll("li").map((li) => li.text())).toContain("名前の消去");
  });

  it("フォーカス中の pane との入れ替えは出さない（D69。プロトコルの制約）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1"));
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    expect(wrapper.findAll("li").map((li) => li.text()).join("")).not.toContain("入れ替え");
  });

  it("項目をクリックすると対応する ActionDispatcher のメソッドを、指定した paneId で呼ぶ", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { label: "x" }));
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    const actions = makeActions();
    const wrapper = mountMenu(actions);
    const items = wrapper.findAll("li");
    await items[0]!.trigger("click"); // 名前の変更
    expect(actions.renamePaneById).toHaveBeenCalledWith("p1");
  });

  it("右クリックの宛先の切替は現在の値に応じてラベルと引数が変わる", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { rightClick: "herdr" }));
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    expect(wrapper.findAll("li").map((li) => li.text())).toContain("右クリックを pane に送る");
  });

  it("クリックするとメニューを閉じる", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { label: "x" }));
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    await wrapper.findAll("li")[0]!.trigger("click");
    expect(view.contextMenu).toBeNull();
  });
});

describe("ContextMenu — tab", () => {
  it("新規・名前の変更・閉じるの 3 項目", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.tabUpserted(makeTab("t1", "w1"));
    view.openContextMenu({ kind: "tab", tabId: "t1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    expect(wrapper.findAll("li").map((li) => li.text())).toEqual(["新規", "名前の変更", "閉じる"]);
  });

  it("「新規」はその tab の workspace を対象にする", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.tabUpserted(makeTab("t1", "w9"));
    view.openContextMenu({ kind: "tab", tabId: "t1" }, { x: 0, y: 0 });
    const actions = makeActions();
    const wrapper = mountMenu(actions);
    await wrapper.findAll("li")[0]!.trigger("click");
    expect(actions.newTabInWorkspace).toHaveBeenCalledWith("w9");
  });
});

describe("ContextMenu — workspace", () => {
  it("名前の変更・閉じるの 2 項目のみ（herdr の worktree 対応は本製品では扱わない。D56 の訂正 10）", () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    view.openContextMenu({ kind: "workspace", workspaceId: "w1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    expect(wrapper.findAll("li").map((li) => li.text())).toEqual(["名前の変更", "閉じる"]);
  });
});

// 20260920-sidebar-tabbar-controls の AC4：サイドバーの「メニュー」から開く、どこにも属さない全体の操作。
describe("ContextMenu — global", () => {
  it("キー割り当て・移動・切り離しの 3 項目を、この順で出す", () => {
    const view = useViewStore(pinia);
    view.openContextMenu({ kind: "global" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    expect(wrapper.findAll("li").map((li) => li.text())).toEqual(["キー割り当て", "移動", "切り離し"]);
  });

  it("選ぶと、キー操作と同じ action が `run` に渡る", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    view.openContextMenu({ kind: "global" }, { x: 0, y: 0 });
    const wrapper = mountMenu(actions);
    await wrapper.findAll("li")[1]!.trigger("click"); // 「移動」
    expect(actions.run).toHaveBeenCalledWith({ type: "goto" });
  });

  it("Esc で閉じたときは何も実行しない（AC-I2）", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    view.openContextMenu({ kind: "global" }, { x: 0, y: 0 });
    const wrapper = mountMenu(actions);
    await wrapper.get('[role="menu"]').trigger("keydown", { key: "Escape" });
    expect(actions.run).not.toHaveBeenCalled();
    expect(view.contextMenu).toBeNull();
  });
});

describe("ContextMenu — キーボード（APG の Menu）", () => {
  it("Esc で閉じる", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    view.openContextMenu({ kind: "workspace", workspaceId: "w1" }, { x: 0, y: 0 });
    const wrapper = mountMenu(makeActions());
    await wrapper.get('[role="menu"]').trigger("keydown", { key: "Escape" });
    expect(view.contextMenu).toBeNull();
  });

  it("矢印キーで選択を動かし、Enter で実行する", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    view.openContextMenu({ kind: "workspace", workspaceId: "w1" }, { x: 0, y: 0 });
    const actions = makeActions();
    const wrapper = mountMenu(actions);
    const menu = wrapper.get('[role="menu"]');
    await menu.trigger("keydown", { key: "ArrowDown" }); // 名前の変更 → 閉じる
    await menu.trigger("keydown", { key: "Enter" });
    expect(actions.closeWorkspaceById).toHaveBeenCalledWith("w1");
  });

  it("外側のクリックで閉じる", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    view.openContextMenu({ kind: "workspace", workspaceId: "w1" }, { x: 0, y: 0 });
    mountMenu(makeActions());
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(view.contextMenu).toBeNull();
  });
});

describe("ContextMenu — 閉じたときのフォーカスの戻し先（APG の Menu。D110）", () => {
  /** メニューを開く前にフォーカスしていた要素（右クリックした端末・キーボードで開いた pane の枠の代わり）。 */
  function focusInvoker(): HTMLButtonElement {
    const invoker = document.createElement("button");
    invoker.textContent = "invoker";
    document.body.appendChild(invoker);
    invoker.focus();
    return invoker;
  }

  async function openPaneMenu(): Promise<{ wrapper: ReturnType<typeof mountMenu>; actions: ReturnType<typeof makeActions>; invoker: HTMLButtonElement; registry: { focus: ReturnType<typeof vi.fn> } }> {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1"));
    const actions = makeActions();
    const registry = { focus: vi.fn() };
    const wrapper = mountMenu(actions, registry);
    const invoker = focusInvoker();
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.get('[role="menu"]').element)); // 開くとメニューへ移る
    return { wrapper, actions, invoker, registry };
  }

  it("Esc で閉じると、開く前にフォーカスしていた要素へ戻す", async () => {
    const { wrapper, invoker } = await openPaneMenu();
    await wrapper.get('[role="menu"]').trigger("keydown", { key: "Escape" });
    expect(useViewStore(pinia).contextMenu).toBeNull();
    expect(document.activeElement).toBe(invoker);
    wrapper.unmount();
    invoker.remove();
  });

  it("項目を選ぶと、開く前の要素へ戻してから実行する（フォーカスを移す項目は、その後に移し直せる）", async () => {
    const { wrapper, actions, invoker } = await openPaneMenu();
    let focusedWhenRun: Element | null = null;
    actions.zoomPane.mockImplementation(() => {
      focusedWhenRun = document.activeElement;
    });
    await wrapper.findAll("li").find((li) => li.text() === "拡大表示")!.trigger("click");
    expect(actions.zoomPane).toHaveBeenCalledWith("p1");
    expect(focusedWhenRun).toBe(invoker);
    expect(document.activeElement).toBe(invoker);
    wrapper.unmount();
    invoker.remove();
  });

  it("外側のクリックで閉じたときは戻さない（フォーカスはクリックした先へ移る）", async () => {
    const { wrapper, invoker } = await openPaneMenu();
    const menuEl = wrapper.get('[role="menu"]').element;
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(useViewStore(pinia).contextMenu).toBeNull();
    expect(document.activeElement).not.toBe(invoker);
    expect(menuEl.isConnected).toBe(false);
    wrapper.unmount();
    invoker.remove();
  });

  it("戻す先が文書から外れていれば（閉じた pane の端末等）、選ばれている pane の端末へフォーカスする（独立点検 #4）", async () => {
    const { wrapper, invoker, registry } = await openPaneMenu();
    useViewStore(pinia).focusPane("p7");
    invoker.remove();
    const focus = vi.spyOn(invoker, "focus");
    await wrapper.get('[role="menu"]').trigger("keydown", { key: "Escape" });
    expect(focus).not.toHaveBeenCalled();
    expect(registry.focus).toHaveBeenCalledWith("p7");
    wrapper.unmount();
  });
});
