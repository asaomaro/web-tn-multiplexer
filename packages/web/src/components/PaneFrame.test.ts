import type { Pane } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { ActionDispatcherKey, TerminalRegistryKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useSettingsStore } from "../store/settings.js";
import { useViewStore } from "../store/view.js";
import PaneFrame from "./PaneFrame.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});
afterEach(() => {
  document.body.innerHTML = "";
});

function makePane(id: string, overrides: Partial<Pane> = {}): Pane {
  return { id, tabId: "t1", label: null, cwd: "/", shell: "/bin/bash", cols: 80, rows: 24, status: "running", failure: null, busy: false, title: "", rightClick: "herdr", agent: null, agentSession: null, ...overrides };
}

function mountFrame(opts: { enabled?: boolean; withPinia?: boolean } = {}) {
  const actions = { openContextMenu: vi.fn() };
  const registry = { focus: vi.fn() };
  const wrapper = mount(PaneFrame, {
    attachTo: document.body,
    props: { paneId: "p1", ...(opts.enabled === false ? {} : { enabled: true }) },
    global: {
      plugins: opts.withPinia === false ? [] : [pinia],
      provide: { [ActionDispatcherKey as symbol]: actions, [TerminalRegistryKey as symbol]: registry },
    },
    slots: { default: '<div class="fake-leaf"><textarea class="fake-terminal"></textarea></div>' },
  });
  return { wrapper, actions, registry };
}

describe("PaneFrame（pane の枠。M7 の後半・D110）", () => {
  it("enabled でなければ枠を描かず、ストアにも触れない（モバイル・Pinia の無い単体テストでも mount できる）", () => {
    const { wrapper } = mountFrame({ enabled: false, withPinia: false });
    expect(wrapper.find(".pane-frame-edge").exists()).toBe(false);
    expect(wrapper.find(".pane-frame").classes()).not.toContain("pane-frame-enabled");
    expect(wrapper.find(".pane-frame-body .fake-leaf").exists()).toBe(true);
  });

  it("枠は中身（葉）を包まない（葉の兄弟。操作できる要素の入れ子にしない）", () => {
    const { wrapper } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge").element;
    const leaf = wrapper.get(".fake-leaf").element;
    expect(edge.contains(leaf)).toBe(false);
    expect(wrapper.find(".pane-frame").classes()).toContain("pane-frame-enabled");
  });

  it("枠の右クリックは、rightClick が 'pane' の pane でも、その pane のメニューを開く（ブラウザの既定のメニューは止める）", async () => {
    useSessionStore(pinia).paneUpserted(makePane("p1", { rightClick: "pane" }));
    const { wrapper, actions } = mountFrame();
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 12, clientY: 34 });
    wrapper.get(".pane-frame-edge").element.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(actions.openContextMenu).toHaveBeenCalledWith({ kind: "pane", paneId: "p1" }, { x: 12, y: 34 });
  });

  it("中身（端末）の上の右クリックは枠では扱わない（端末の右クリックは MouseBridge の担当）", () => {
    const { wrapper, actions } = mountFrame();
    wrapper.get(".fake-terminal").element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(actions.openContextMenu).not.toHaveBeenCalled();
  });

  it("枠の押下は pane を選び、端末にフォーカスする（枠そのものはフォーカスを取らない。M1）", () => {
    const { wrapper, registry } = mountFrame();
    const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 2 });
    wrapper.get(".pane-frame-edge").element.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(useViewStore(pinia).focusedPaneId).toBe("p1");
    expect(registry.focus).toHaveBeenCalledWith("p1");
  });

  it("キーボード：枠は menu button で、Enter・Space・↓・Shift+F10・ContextMenu キーでメニューを開く", async () => {
    const { wrapper, actions } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge");
    expect(edge.attributes()).toMatchObject({ role: "button", "aria-haspopup": "menu" });
    const opened: unknown[] = [];
    for (const init of [{ key: "Enter" }, { key: " " }, { key: "ArrowDown" }, { key: "F10", shiftKey: true }, { key: "ContextMenu" }]) {
      actions.openContextMenu.mockClear();
      const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      edge.element.dispatchEvent(ev);
      opened.push([init.key, ev.defaultPrevented, actions.openContextMenu.mock.calls.length]);
    }
    expect(opened).toEqual([
      ["Enter", true, 1],
      [" ", true, 1],
      ["ArrowDown", true, 1],
      ["F10", true, 1],
      ["ContextMenu", true, 1],
    ]);
    expect(actions.openContextMenu).toHaveBeenLastCalledWith({ kind: "pane", paneId: "p1" }, expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it("キーボード：開くキーは window の keydown（端末の外のキーの処理）へ渡さず、ほかのキー（Tab・prefix 等）は渡す", () => {
    const { wrapper, actions } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge").element;
    const onWindowKeydown = vi.fn();
    window.addEventListener("keydown", onWindowKeydown);
    edge.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
    expect(onWindowKeydown).not.toHaveBeenCalled();
    for (const init of [{ key: "Tab" }, { key: "b", ctrlKey: true }, { key: "F10" }, { key: "Enter", ctrlKey: true }]) {
      edge.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    }
    window.removeEventListener("keydown", onWindowKeydown);
    expect(onWindowKeydown).toHaveBeenCalledTimes(4);
    expect(actions.openContextMenu).toHaveBeenCalledTimes(1);
  });

  it("aria-label に pane の名前、aria-expanded はその pane のメニューが開いている間だけ true", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { label: "build" }));
    const { wrapper } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge");
    expect(edge.attributes("aria-label")).toBe("pane「build」のメニュー");
    expect(edge.attributes("aria-expanded")).toBe("false");
    view.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 0, y: 0 });
    await wrapper.vm.$nextTick();
    expect(edge.attributes("aria-expanded")).toBe("true");
    view.openContextMenu({ kind: "pane", paneId: "p2" }, { x: 0, y: 0 });
    await wrapper.vm.$nextTick();
    expect(edge.attributes("aria-expanded")).toBe("false");
  });

  // 20260920-ui-selection-visuals の AC7：ポインタを重ねるたびに出る説明のツールチップを外す。
  it("枠に title 属性を置かない（aria-label は残す）", () => {
    const session = useSessionStore(pinia);
    session.paneUpserted(makePane("p1", { label: "build" }));
    const { wrapper } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge");
    expect(edge.attributes("title")).toBeUndefined();
    expect(edge.attributes("aria-label")).toBe("pane「build」のメニュー");
  });

  // AC8：枠は role="button" のメニューボタンなので、そこに aria-current を置くと「ボタンが current」になる。
  // pane そのものを指すのは外側の要素（role="group" ＋ pane の名前）。
  it("選ばれている pane の外側の要素に role=group・pane の名前・aria-current を付ける", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", { label: "build" }));
    view.focusPane("p2");
    const { wrapper } = mountFrame();
    const frame = wrapper.get(".pane-frame");
    expect(frame.attributes("role")).toBe("group");
    expect(frame.attributes("aria-label")).toBe("pane「build」"); // メニューの名前は流用しない
    expect(frame.attributes("aria-current")).toBeUndefined(); // 選ばれていない間は属性ごと出さない
    view.focusPane("p1");
    await wrapper.vm.$nextTick();
    expect(frame.attributes("aria-current")).toBe("true");
  });

  it("enabled でなければ role も aria も付けない（モバイルではストアに触れないため）", () => {
    const { wrapper } = mountFrame({ enabled: false, withPinia: false });
    const frame = wrapper.get(".pane-frame");
    expect(frame.attributes("role")).toBeUndefined();
    expect(frame.attributes("aria-label")).toBeUndefined();
    expect(frame.attributes("aria-current")).toBeUndefined();
  });
});

// 20260922-appearance-settings-rest T4（design「振る舞いの詳細」US4）。
describe("PaneFrame — エージェント名の可視表示（AC11・AC12）", () => {
  it("既定（設定が無効）では、名前があっても画面に出さない（aria-label だけ。AC12）", () => {
    useSessionStore(pinia).paneUpserted(makePane("p1", { label: "build" }));
    const { wrapper } = mountFrame();
    expect(wrapper.find(".pane-frame-name").exists()).toBe(false);
    expect(wrapper.get(".pane-frame-edge").attributes("aria-label")).toBe("pane「build」のメニュー");
  });

  it("設定を有効にすると、名前が可視のテキストで出る（AC11）", async () => {
    const settings = useSettingsStore(pinia);
    useSessionStore(pinia).paneUpserted(makePane("p1", { label: "build" }));
    const { wrapper } = mountFrame();
    settings.setPaneAgentNameVisible(true);
    await wrapper.vm.$nextTick();
    const name = wrapper.get(".pane-frame-name");
    expect(name.text()).toBe("build");
    expect(name.attributes("aria-hidden")).toBe("true"); // aria-label と二重に読み上げない
  });

  it("設定が有効でも、名前が無い pane では何も出さない", async () => {
    const settings = useSettingsStore(pinia);
    useSessionStore(pinia).paneUpserted(makePane("p1")); // label なし・agent なし
    const { wrapper } = mountFrame();
    settings.setPaneAgentNameVisible(true);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".pane-frame-name").exists()).toBe(false);
  });

  it("有効にした後、無効に戻すと消える", async () => {
    const settings = useSettingsStore(pinia);
    useSessionStore(pinia).paneUpserted(makePane("p1", { label: "build" }));
    const { wrapper } = mountFrame();
    settings.setPaneAgentNameVisible(true);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".pane-frame-name").exists()).toBe(true);
    settings.setPaneAgentNameVisible(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".pane-frame-name").exists()).toBe(false);
  });

  it("enabled でなければ設定に触れず、名前も出さない（モバイル）", () => {
    const { wrapper } = mountFrame({ enabled: false, withPinia: false });
    expect(wrapper.find(".pane-frame-name").exists()).toBe(false);
  });
});

// 枠・隙間の太さ（AC9）の実際の反映は、happy-dom が `var()` を解決しないため単体テストでは
// 確かめられない（`getComputedStyle` の戻り値が信頼できない）。E2E（T8）で実測する。

// AC4・AC5：強調はマウスの位置ではなく選択で決まる（以前は `:hover` だけが枠を塗っていた）。
describe("PaneFrame — 強調は選ばれている pane に付く", () => {
  it("選ばれている pane の枠にだけ強調のクラスが付き、選び直すと移る", async () => {
    const view = useViewStore(pinia);
    view.focusPane("p2");
    const { wrapper } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge");
    expect(edge.classes()).not.toContain("pane-frame-edge-current");
    view.focusPane("p1");
    await wrapper.vm.$nextTick();
    expect(edge.classes()).toContain("pane-frame-edge-current");
    view.focusPane("p2");
    await wrapper.vm.$nextTick();
    expect(edge.classes()).not.toContain("pane-frame-edge-current");
  });
});

describe("PaneFrame — Tab で止まるのは選ばれている pane の枠だけ（roving tabindex。独立点検 #2）", () => {
  it("選ばれている pane の枠は tabindex 0、ほかは -1。選び直すと入れ替わる", async () => {
    const view = useViewStore(pinia);
    view.focusPane("p2");
    const { wrapper } = mountFrame();
    const edge = wrapper.get(".pane-frame-edge");
    expect(edge.attributes("tabindex")).toBe("-1");
    view.focusPane("p1");
    await wrapper.vm.$nextTick();
    expect(edge.attributes("tabindex")).toBe("0");
    view.focusPane("p2");
    await wrapper.vm.$nextTick();
    expect(edge.attributes("tabindex")).toBe("-1");
  });
});

describe("PaneFrame — 枠の中にフォーカスがあるまま消えたら、選ばれている pane の端末へ移す（独立点検 #4）", () => {
  /** `PaneLayout` の描き直しで枠が外れるのと同じく、親の `v-if` で外す。 */
  function mountToggleable() {
    const actions = { openContextMenu: vi.fn() };
    const registry = { focus: vi.fn() };
    const show = ref(true);
    const Host = defineComponent({
      components: { PaneFrame },
      setup: () => ({ show }),
      template: '<div><PaneFrame v-if="show" pane-id="p1" enabled><textarea class="fake-terminal"></textarea></PaneFrame></div>',
    });
    const wrapper = mount(Host, {
      attachTo: document.body,
      global: { plugins: [pinia], provide: { [ActionDispatcherKey as symbol]: actions, [TerminalRegistryKey as symbol]: registry } },
    });
    return { wrapper, registry, hide: () => (show.value = false) };
  }

  it("枠そのものにフォーカスがあるまま外れる（選ばれていない pane を閉じた）と、選ばれている pane の端末へフォーカスする", async () => {
    useViewStore(pinia).focusPane("p9");
    const { wrapper, registry, hide } = mountToggleable();
    (wrapper.get(".pane-frame-edge").element as HTMLElement).focus();
    hide();
    await vi.waitFor(() => expect(registry.focus).toHaveBeenCalledWith("p9"));
  });

  it("中の端末にフォーカスがあるまま外れても同じ", async () => {
    useViewStore(pinia).focusPane("p9");
    const { wrapper, registry, hide } = mountToggleable();
    (wrapper.get(".fake-terminal").element as HTMLElement).focus();
    hide();
    await vi.waitFor(() => expect(registry.focus).toHaveBeenCalledWith("p9"));
  });

  it("枠の外にフォーカスがあれば何もしない（フォーカスを奪わない）", async () => {
    useViewStore(pinia).focusPane("p9");
    const { registry, hide } = mountToggleable();
    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();
    hide();
    await new Promise((r) => setTimeout(r, 10));
    expect(registry.focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(other);
  });
});
