import { monotonicNow } from "../log/LogThrottle.js";

/** ログインの失敗回数の計数（architecture.md「LoginRateLimiter」・design.md「ログインの試行回数の制限」）。 */
export interface LoginRateLimiter {
  registerFailure(ip: string): void;
  isBlocked(ip: string): boolean;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const MINUTE_LIMIT = 5;
const HOUR_LIMIT = 20;

export class DefaultLoginRateLimiter implements LoginRateLimiter {
  private readonly failuresByIp = new Map<string, number[]>();

  /**
   * `clock` は ms の時計。既定は単調な `performance.now()`（`monotonicNow`）——窓の長さを測るだけなので壁時計である必要は
   * 無く、`Date.now()` は時刻の合わせ直しで戻りうる（進めば失敗の記録が 1 時間より古く見えて制限がすぐ解け、戻れば解ける
   * まで長引く）。D103 の `LogThrottle`・`OriginRejectionLog` と同じ（D106）。テストで差し替える。
   */
  constructor(private readonly clock: { now(): number } = { now: monotonicNow }) {}

  registerFailure(ip: string): void {
    const arr = this.failuresByIp.get(ip) ?? [];
    arr.push(this.clock.now());
    this.failuresByIp.set(ip, arr);
  }

  isBlocked(ip: string): boolean {
    const now = this.clock.now();
    const pruned = (this.failuresByIp.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
    // 空になった IP のエントリは消す（レビュー指摘：残したままだと、失敗した IP が無制限に溜まり続ける）。
    if (pruned.length === 0) this.failuresByIp.delete(ip);
    else this.failuresByIp.set(ip, pruned);
    const inLastMinute = pruned.filter((t) => now - t < MINUTE_MS).length;
    return inLastMinute >= MINUTE_LIMIT || pruned.length >= HOUR_LIMIT;
  }
}
