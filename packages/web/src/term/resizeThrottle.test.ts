import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrailingThrottle, RESIZE_COMMIT_INTERVAL_MS } from "./resizeThrottle.js";

afterEach(() => {
  vi.useRealTimers();
});

/** D107・D108 の大きさの変化の間引き（`PaneLayout` の `followResize` とモバイルの `usePaneArea` で共有）。 */
describe("createTrailingThrottle", () => {
  it("最初の schedule から 100ms 後に 1 回だけ呼び、その間の schedule はまとめる。呼んだ後の schedule は新しい予約になる", () => {
    vi.useFakeTimers();
    expect(RESIZE_COMMIT_INTERVAL_MS).toBe(100);
    const fn = vi.fn();
    const throttle = createTrailingThrottle(fn);
    throttle.schedule();
    throttle.schedule();
    vi.advanceTimersByTime(50);
    throttle.schedule();
    vi.advanceTimersByTime(49);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);

    throttle.schedule(); // 間隔の後の変化（最後の変化の分は必ず呼ぶ）
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel で待っている予約を捨てる。その後の schedule はまた効く", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttle = createTrailingThrottle(fn);
    throttle.schedule();
    throttle.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    throttle.cancel(); // 待っていなくても投げない
    throttle.schedule();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("間隔を指定できる", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttle = createTrailingThrottle(fn, 30);
    throttle.schedule();
    vi.advanceTimersByTime(29);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
