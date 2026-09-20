import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { useVisualViewportHeight } from "./useVisualViewport.js";

function fakeVisualViewport(initialHeight: number) {
  const listeners = new Set<() => void>();
  const vv = {
    height: initialHeight,
    scale: 1,
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
  } as unknown as VisualViewport;
  /** 大きさ（と拡大率）が変わった（`resize` を送る）。 */
  function resizeTo(height: number, scale = 1): void {
    Object.assign(vv as unknown as { height: number; scale: number }, { height, scale });
    for (const cb of listeners) cb();
  }
  return { vv, resizeTo, listeners };
}

function mountHost() {
  let exposed: ReturnType<typeof useVisualViewportHeight> | undefined;
  const Host = defineComponent({
    setup() {
      exposed = useVisualViewportHeight();
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { wrapper, height: exposed! };
}

const originalVisualViewport = window.visualViewport;
afterEach(() => {
  Object.defineProperty(window, "visualViewport", { value: originalVisualViewport, configurable: true });
});

describe("useVisualViewportHeight", () => {
  it("visualViewport が無ければ window.innerHeight を初期値にする", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    const { height } = mountHost();
    expect(height.value).toBe(window.innerHeight);
  });

  it("visualViewport があればその高さを初期値にし、resize イベントで更新する", async () => {
    const { vv, resizeTo } = fakeVisualViewport(600);
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    const { height } = mountHost();
    expect(height.value).toBe(600);

    resizeTo(350); // ソフトキーボードが開いた想定
    expect(height.value).toBe(350);

    resizeTo(600); // 閉じた
    expect(height.value).toBe(600);
  });

  it("ピンチで拡大しても高さを変えない（拡大率を掛け戻す）。拡大したままのソフトキーボードの開閉には追従する（D108 の独立点検 #1）", () => {
    const { vv, resizeTo } = fakeVisualViewport(664);
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    const { height } = mountHost();
    expect(height.value).toBe(664);

    resizeTo(442.66668701171875, 1.5); // 1.5 倍に拡大（Chromium は float32 の精度で返す）
    expect(height.value).toBe(664);
    resizeTo(332, 2); // 2 倍
    expect(height.value).toBe(664);

    resizeTo(182, 2); // 2 倍のままソフトキーボードが開いた（拡大していなければ 364px ぶん見えている）
    expect(height.value).toBe(364);
    resizeTo(664, 1); // 閉じて拡大も戻した
    expect(height.value).toBe(664);
  });

  it("拡大したまま開いても、拡大していないときの高さで始める", () => {
    const { vv } = fakeVisualViewport(332);
    (vv as unknown as { scale: number }).scale = 2;
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    const { height } = mountHost();
    expect(height.value).toBe(664);
  });

  it("窓の resize でも読み直す（visualViewport が無い環境のフォールバックでも、回転・窓の大きさに追従する。D108）", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    const original = window.innerHeight;
    try {
      const { wrapper, height } = mountHost();
      Object.defineProperty(window, "innerHeight", { value: 342, configurable: true });
      window.dispatchEvent(new Event("resize"));
      expect(height.value).toBe(342);

      wrapper.unmount(); // 外した後は読まない
      Object.defineProperty(window, "innerHeight", { value: 664, configurable: true });
      window.dispatchEvent(new Event("resize"));
      expect(height.value).toBe(342);
    } finally {
      Object.defineProperty(window, "innerHeight", { value: original, configurable: true });
    }
  });

  it("unmount で resize の listener を外す", () => {
    const { vv, listeners } = fakeVisualViewport(600);
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    const { wrapper } = mountHost();
    expect(listeners.size).toBe(1);
    wrapper.unmount();
    expect(listeners.size).toBe(0);
  });
});
