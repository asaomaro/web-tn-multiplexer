import { describe, expect, it, vi } from "vitest";
import { LOG_THROTTLE_MAX_LINES, LOG_THROTTLE_WINDOW_MS, LogThrottle } from "./LogThrottle.js";

describe("LogThrottle（認証前に起こせるログの間引き。D103）", () => {
  it("窓の中では上限の行数まで書かせ、超えた件数を次の窓の最初の行に渡す", () => {
    let t = 5_000;
    const throttle = new LogThrottle({ now: () => t });
    const taken = Array.from({ length: LOG_THROTTLE_MAX_LINES + 7 }, () => throttle.take());
    expect(taken.filter((x) => x !== undefined)).toHaveLength(LOG_THROTTLE_MAX_LINES);
    expect(taken[0]).toEqual({ suppressed: 0 });
    t += LOG_THROTTLE_WINDOW_MS - 1;
    expect(throttle.take()).toBeUndefined(); // まだ同じ窓
    t += 1;
    expect(throttle.take()).toEqual({ suppressed: 8 });
    expect(throttle.take()).toEqual({ suppressed: 0 }); // 渡した件数は数え直す
  });

  it("窓の長さ・上限を差し替えられる", () => {
    let t = 0;
    const throttle = new LogThrottle({ now: () => t, windowMs: 10, maxLines: 1 });
    expect(throttle.take()).toEqual({ suppressed: 0 });
    expect(throttle.take()).toBeUndefined();
    t = 10;
    expect(throttle.take()).toEqual({ suppressed: 1 });
  });

  it("既定の時計は単調（performance.now）で、壁時計（Date.now）が戻っても窓が終わらなくならない（D103 の独立点検 #8）", () => {
    const wall = vi.spyOn(Date, "now");
    let mono = 1_000;
    const perf = vi.spyOn(performance, "now").mockImplementation(() => mono);
    try {
      wall.mockReturnValue(10_000_000);
      const throttle = new LogThrottle({ maxLines: 1 });
      expect(throttle.take()).toEqual({ suppressed: 0 });
      expect(throttle.take()).toBeUndefined();
      // 壁時計が 1 時間戻っても、単調な時計で 60 秒経てば次の窓になる。
      wall.mockReturnValue(10_000_000 - 3_600_000);
      mono += LOG_THROTTLE_WINDOW_MS;
      expect(throttle.take()).toEqual({ suppressed: 1 });
    } finally {
      wall.mockRestore();
      perf.mockRestore();
    }
  });
});
