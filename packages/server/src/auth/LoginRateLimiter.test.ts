import { describe, expect, it, vi } from "vitest";
import { DefaultLoginRateLimiter } from "./LoginRateLimiter.js";

class FakeClock {
  private t = 0;
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

describe("DefaultLoginRateLimiter", () => {
  it("is not blocked before any failures", () => {
    const limiter = new DefaultLoginRateLimiter();
    expect(limiter.isBlocked("1.2.3.4")).toBe(false);
  });

  it("blocks after 5 failures within a minute, and only for that ip", () => {
    const clock = new FakeClock();
    const limiter = new DefaultLoginRateLimiter(clock);
    for (let i = 0; i < 5; i++) limiter.registerFailure("1.2.3.4");
    expect(limiter.isBlocked("1.2.3.4")).toBe(true);
    expect(limiter.isBlocked("5.6.7.8")).toBe(false);
  });

  it("unblocks once the minute window passes, but the hour window still counts", () => {
    const clock = new FakeClock();
    const limiter = new DefaultLoginRateLimiter(clock);
    for (let i = 0; i < 5; i++) limiter.registerFailure("1.2.3.4");
    clock.advance(61_000);
    expect(limiter.isBlocked("1.2.3.4")).toBe(false); // 分の窓は抜けた
  });

  it("blocks after 20 failures within an hour even if spread out", () => {
    const clock = new FakeClock();
    const limiter = new DefaultLoginRateLimiter(clock);
    for (let i = 0; i < 20; i++) {
      limiter.registerFailure("1.2.3.4");
      clock.advance(2 * 60_000); // 2 分おき。分の上限には引っかからない
    }
    expect(limiter.isBlocked("1.2.3.4")).toBe(true);
  });

  it("forgets failures older than an hour", () => {
    const clock = new FakeClock();
    const limiter = new DefaultLoginRateLimiter(clock);
    for (let i = 0; i < 20; i++) limiter.registerFailure("1.2.3.4");
    clock.advance(3_700_000); // 1 時間より後
    expect(limiter.isBlocked("1.2.3.4")).toBe(false);
  });
});

describe("DefaultLoginRateLimiter の既定の時計（D106）", () => {
  it("単調な時計（performance.now）で数える——壁時計（Date.now）が進んでも戻っても、窓は変わらない", () => {
    const wall = vi.spyOn(Date, "now").mockReturnValue(50_000_000);
    let mono = 5_000;
    const perf = vi.spyOn(performance, "now").mockImplementation(() => mono);
    try {
      const limiter = new DefaultLoginRateLimiter();
      for (let i = 0; i < 5; i++) limiter.registerFailure("1.2.3.4");
      wall.mockReturnValue(50_000_000 + 2 * 3_600_000); // 壁時計が 2 時間進む（時刻の合わせ直し）
      expect(limiter.isBlocked("1.2.3.4")).toBe(true); // 単調な時計ではまだ 1 分の窓の中
      wall.mockReturnValue(50_000_000 - 3_600_000); // 壁時計が戻る
      mono += 61_000;
      expect(limiter.isBlocked("1.2.3.4")).toBe(false); // 単調な時計で 1 分が過ぎた（分の窓は抜けた）
    } finally {
      wall.mockRestore();
      perf.mockRestore();
    }
  });
});
