import { mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RESIZE_COMMIT_INTERVAL_MS } from "../term/resizeThrottle.js";
import { usePaneArea } from "./usePaneArea.js";

/** `ResizeObserver` の代わり（happy-dom には無い）。`fire()` で大きさの変化を知らせる。 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed = new Set<Element>();
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }
  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function sized(width: number, height: number): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect;
  return el;
}

/** `usePaneArea` は `onBeforeUnmount` を使うので、コンポーネントの `setup()` から呼ぶ。 */
function mountHost(container: Ref<HTMLElement | null>, commit: () => void) {
  let exposed!: ReturnType<typeof usePaneArea>;
  const Host = defineComponent({
    setup() {
      exposed = usePaneArea({ container, commit });
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { wrapper, ...exposed };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeResizeObserver.instances = [];
});

/**
 * 04-mobile T9・D108（統合 review ラウンド1 で発見）：モバイルの `client.view` の大きさを、縮小の枠（naturalSize × scale。
 * naturalSize はサーバの PTY の大きさ × セルの寸法）の中の葉ではなく、表示領域の大きさで測り、その変化に追従させる。
 */
describe("usePaneArea — 表示領域で測る（D108）", () => {
  it("measureSinglePane は葉ではなく表示領域の大きさを返す（葉は縮小の枠の中にあり、PTY の大きさで決まる）", () => {
    const container = ref<HTMLElement | null>(sized(390, 600));
    const { measureSinglePane: measure } = mountHost(container, vi.fn());
    const leafInScaledBox = sized(390, 311); // 120×40 の PTY を 0.445 倍に縮めた枠の中の葉
    expect(measure("p1", leafInScaledBox)).toEqual({ width: 390, height: 600 });

    container.value = sized(750, 300); // 回転（表示領域の要素の大きさが変わった）
    expect(measure("p1", leafInScaledBox)).toEqual({ width: 750, height: 300 });
  });

  it("表示領域が無いとき（実際には起きない）だけ葉を測る", () => {
    const { measureSinglePane: measure } = mountHost(ref<HTMLElement | null>(null), vi.fn());
    expect(measure("p1", sized(200, 100))).toEqual({ width: 200, height: 100 });
  });
});

describe("usePaneArea — 表示領域の変化への追従（D108）", () => {
  it("表示領域を ResizeObserver で見て、変化があれば 100ms に 1 回まで（まとめて）commit し直す。最後の変化の分は必ず送る", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.useFakeTimers();
    const container = ref<HTMLElement | null>(sized(390, 600));
    const commit = vi.fn();
    mountHost(container, commit);
    expect(FakeResizeObserver.instances).toHaveLength(1);
    const ro = FakeResizeObserver.instances[0]!;
    expect(ro.observed).toEqual(new Set([container.value]));
    expect(RESIZE_COMMIT_INTERVAL_MS).toBe(100); // デスクトップの followResize と共有する間隔（term/resizeThrottle.ts。D107・D108）

    ro.fire(); // 回転・ソフトキーボードのアニメーションで続けて届く
    ro.fire();
    vi.advanceTimersByTime(50);
    ro.fire();
    vi.advanceTimersByTime(49);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);

    ro.fire(); // 間隔の後の変化は、また 1 回にまとめる
    vi.advanceTimersByTime(RESIZE_COMMIT_INTERVAL_MS);
    expect(commit).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("表示領域の要素が替わったら古い要素を見るのをやめ、新しい要素を見る", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const first = sized(390, 600);
    const container = ref<HTMLElement | null>(first);
    const { wrapper } = mountHost(container, vi.fn());
    const ro = FakeResizeObserver.instances[0]!;
    const second = sized(750, 300);
    container.value = second;
    await wrapper.vm.$nextTick();
    expect(ro.observed).toEqual(new Set([second]));
  });

  it("unmount で見るのをやめ、待っている commit も捨てる", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.useFakeTimers();
    const commit = vi.fn();
    const { wrapper } = mountHost(ref<HTMLElement | null>(sized(390, 600)), commit);
    const ro = FakeResizeObserver.instances[0]!;
    ro.fire();
    wrapper.unmount();
    vi.advanceTimersByTime(1000);
    expect(ro.disconnected).toBe(true);
    expect(commit).not.toHaveBeenCalled();
  });
});
