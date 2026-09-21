import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewStore } from "../store/view.js";
import Toast from "./Toast.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

/** フェイクタイマーの下でマイクロタスクだけを進める（D58：`vi.waitFor` は使わない）。 */
async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("Toast — 一覧表示・クリックで消す", () => {
  it("view.toasts を並べ、クリックで dismissToast を呼ぶ", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    const id = view.toast("test message");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("test message");
    await wrapper.get(".toast").trigger("click");
    expect(view.toasts.find((t) => t.id === id)).toBeUndefined();
  });
});

describe("Toast — 自動で消える", () => {
  it("一定時間で自動的に消える", async () => {
    vi.useFakeTimers();
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    const id = view.toast("auto dismiss me");
    await wrapper.vm.$nextTick();
    expect(view.toasts.some((t) => t.id === id)).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    await flush();
    expect(view.toasts.some((t) => t.id === id)).toBe(false);
  });
});

describe("Toast — 初回 pane フォーカスの案内", () => {
  it("最初に pane へフォーカスが入ったら一度だけ案内を出す", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    expect(view.toasts).toHaveLength(0);
    view.focusPane("p1");
    await wrapper.vm.$nextTick();
    expect(view.toasts.map((t) => t.message)).toContain("Ctrl+B ? でキー一覧");

    const countAfterFirst = view.toasts.length;
    view.focusPane("p2");
    await wrapper.vm.$nextTick();
    expect(view.toasts).toHaveLength(countAfterFirst); // 増えない（一度だけ）
  });

  it("localStorage に既に表示済みが記録されていれば出さない", async () => {
    localStorage.setItem("wtm.hint.prefixHelp.v1", "1");
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    view.focusPane("p1");
    await wrapper.vm.$nextTick();
    expect(view.toasts).toHaveLength(0);
  });
});

// 20260920-agent-notifications：席を外している間に出た知らせが 4 秒で消えては意味が無い。
describe("Toast — sticky（消えない知らせ）", () => {
  it("sticky は時間が経っても消えない（普通のトーストは消える）", async () => {
    vi.useFakeTimers();
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    const normal = view.toast("ふつう");
    const sticky = view.toast("知らせ", { kind: "sticky" });
    await wrapper.vm.$nextTick();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(view.toasts.find((t) => t.id === normal), "ふつうのトーストは消えた").toBeUndefined();
    expect(view.toasts.find((t) => t.id === sticky), "sticky は残っている").toBeDefined();
  });

  it("sticky には閉じるボタンが付き、キーボードから押せる（Tab の順に入る）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    const id = view.toast("知らせ", { kind: "sticky" });
    await wrapper.vm.$nextTick();

    const close = wrapper.get(".toast-close");
    expect(close.element.tagName).toBe("BUTTON"); // `<div>` だと Tab で辿れない
    expect(close.attributes("aria-label")).toBe("閉じる");
    await close.trigger("click");
    expect(view.toasts.find((t) => t.id === id)).toBeUndefined();
  });

  it("ふつうのトーストには閉じるボタンを付けない（4 秒で消えるので要らない）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    view.toast("ふつう");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".toast-close").exists()).toBe(false);
  });

  it("行動ボタンを押しても、トースト本体の「消す」が走らない（@click.stop）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    const run = vi.fn();
    const id = view.toast("許可しますか", { kind: "sticky", actions: [{ label: "許可する", run }] });
    await wrapper.vm.$nextTick();

    await wrapper.get(".toast-action").trigger("click");
    expect(run).toHaveBeenCalledOnce();
    expect(view.toasts.find((t) => t.id === id), "ボタンを押しただけでは消えない").toBeDefined();
  });

  it("行動ボタンは並べた順に出る", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    view.toast("許可しますか", { kind: "sticky", actions: [{ label: "許可する", run: vi.fn() }, { label: "あとで", run: vi.fn() }] });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".toast-action").map((b) => b.text())).toEqual(["許可する", "あとで"]);
  });

  it("wrap を付けたトーストだけ畳まない（案内の例外）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mount(Toast, { global: { plugins: [pinia] } });
    view.toast("知らせ", { kind: "sticky" });
    view.toast("案内", { kind: "sticky", wrap: true });
    await wrapper.vm.$nextTick();
    const toasts = wrapper.findAll(".toast");
    expect(toasts[0]!.classes()).not.toContain("toast-wrap");
    expect(toasts[1]!.classes()).toContain("toast-wrap");
  });
});
