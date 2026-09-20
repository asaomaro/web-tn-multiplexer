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
