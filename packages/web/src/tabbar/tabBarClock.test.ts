import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabBarClock } from "./tabBarClock.js";

function mountHost(initialActive: boolean) {
  let exposed: { now: Ref<Date>; active: Ref<boolean> } | undefined;
  const Host = defineComponent({
    setup() {
      const active = ref(initialActive);
      const now = useTabBarClock(active);
      exposed = { now, active };
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { wrapper, ...exposed! };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useTabBarClock — tab バー右端の日時エントリ用の時計（design「振る舞いの詳細 / tab バー右端のエントリ」）", () => {
  it("active なら 1 秒ごとに now が更新される", () => {
    const { now } = mountHost(true);
    const first = now.value;
    vi.advanceTimersByTime(1000);
    expect(now.value.getTime()).toBeGreaterThan(first.getTime());
  });

  it("active でなければタイマーを張らない（1 秒進めても now は変わらない）", () => {
    const { now } = mountHost(false);
    const first = now.value;
    vi.advanceTimersByTime(5000);
    expect(now.value).toBe(first);
  });

  it("active が false→true に変わったらタイマーが動き出す", async () => {
    const { now, active } = mountHost(false);
    vi.advanceTimersByTime(3000);
    expect(now.value).not.toBeUndefined();
    active.value = true;
    await nextTick(); // watch は既定で pre-flush（マイクロタスク）——同期では start() がまだ呼ばれていない
    vi.advanceTimersByTime(1000);
    const afterStart = now.value;
    vi.advanceTimersByTime(1000);
    expect(now.value.getTime()).toBeGreaterThan(afterStart.getTime());
  });

  it("active が true→false に変わったらタイマーが止まる（それ以降 now が変わらない）", async () => {
    const { now, active } = mountHost(true);
    vi.advanceTimersByTime(1000);
    active.value = false;
    await nextTick(); // watch のコールバック（stop()）を先に走らせる
    const stopped = now.value;
    vi.advanceTimersByTime(5000);
    expect(now.value).toBe(stopped);
  });

  it("アンマウントするとタイマーが止まる（GC を妨げない）", () => {
    const { wrapper, now } = mountHost(true);
    vi.advanceTimersByTime(1000);
    wrapper.unmount();
    const beforeMore = now.value;
    vi.advanceTimersByTime(5000);
    expect(now.value).toBe(beforeMore); // unmount 後は誰も読まないが、内部のタイマーも張られたままにならない
  });
});
