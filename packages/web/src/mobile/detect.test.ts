import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isCoarsePointer, isMobileViewport } from "./detect.js";

/**
 * happy-dom の `matchMedia` は呼んだ時点の `window.innerWidth` を静的に評価するだけで、
 * リサイズ後の "change" イベントは自分では発火しない（実測で確認）。`window.matchMedia` 自体を
 * 差し替えて、テストから "change" を手動で発火できるフェイクにする。
 */
function fakeMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(ev: MediaQueryListEvent) => void>();
  const state = {
    matches: initialMatches,
    media: "",
    addEventListener: (_type: string, cb: (ev: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: (ev: MediaQueryListEvent) => void) => listeners.delete(cb),
  };
  const mql = state as unknown as MediaQueryList;
  function fire(matches: boolean): void {
    state.matches = matches;
    for (const cb of listeners) cb({ matches } as MediaQueryListEvent);
  }
  return { mql, fire, listeners };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isMobileViewport", () => {
  it("matchMedia の初期値を返し、change イベントで更新する", async () => {
    const { mql, fire } = fakeMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql);

    let exposedValue: boolean | undefined;
    const Host = defineComponent({
      setup() {
        const matches = isMobileViewport();
        return () => {
          exposedValue = matches.value;
          return h("div");
        };
      },
    });
    const wrapper = mount(Host);
    expect(exposedValue).toBe(false);

    fire(true);
    await wrapper.vm.$nextTick();
    expect(exposedValue).toBe(true);

    fire(false);
    await wrapper.vm.$nextTick();
    expect(exposedValue).toBe(false);
  });

  it("768px 未満（767px 以下）を境目にする", () => {
    const { mql } = fakeMatchMedia(false);
    const spy = vi.spyOn(window, "matchMedia").mockReturnValue(mql);
    const Host = defineComponent({
      setup() {
        isMobileViewport();
        return () => h("div");
      },
    });
    mount(Host);
    expect(spy).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("unmount で change の listener を外す", async () => {
    const { mql, listeners } = fakeMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql);
    const Host = defineComponent({
      setup() {
        isMobileViewport();
        return () => h("div");
      },
    });
    const wrapper = mount(Host);
    expect(listeners.size).toBe(1);
    wrapper.unmount();
    expect(listeners.size).toBe(0);
  });
});

describe("isCoarsePointer", () => {
  it("matchMedia('(pointer: coarse)') の結果をそのまま返す", () => {
    const spy = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect(isCoarsePointer()).toBe(true);
    expect(spy).toHaveBeenCalledWith("(pointer: coarse)");

    spy.mockReturnValue({ matches: false } as MediaQueryList);
    expect(isCoarsePointer()).toBe(false);
  });
});
