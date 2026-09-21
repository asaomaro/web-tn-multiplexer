/** 既定の窓の長さ（ms）。 */
export const LOG_THROTTLE_WINDOW_MS = 60_000;
/** 既定の、1 つの窓で書く行数の上限。 */
export const LOG_THROTTLE_MAX_LINES = 20;

export interface LogThrottleOptions {
  windowMs?: number;
  maxLines?: number;
  /**
   * 時計（ms）。既定は単調な `performance.now()`——`Date.now()` は時刻の合わせ直し（NTP・手動）で戻りうり、戻ると窓が
   * 終わらず（ログを書かない状態が続く）、進むと窓がすぐ終わる（D103 の独立点検 #8）。テストで差し替える。
   */
  now?: () => number;
}

/**
 * 認証の前に誰でも何度でも起こせる経路のログを、窓（既定 60 秒）ごとに上限（既定 20 行）までに抑える（D102・D103）。
 * `server.log` はローテーションしないので、相手が 1 リクエストごとに 1 行を書かせられないようにする。
 * `take()` が書いてよいかを答え、書くときはそれまでに上限で書かなかった件数（`suppressed`）を返す——呼び出し側は
 * その件数を行に添える（`OriginRejectionLog` の `suppressedOverall`・`HttpServer`／`WsServerWs` の想定外の失敗の行）。
 */
export class LogThrottle {
  private readonly windowMs: number;
  private readonly maxLines: number;
  private readonly now: () => number;
  private windowStart = Number.NEGATIVE_INFINITY;
  private linesInWindow = 0;
  private suppressed = 0;

  constructor(opts: LogThrottleOptions = {}) {
    this.windowMs = opts.windowMs ?? LOG_THROTTLE_WINDOW_MS;
    this.maxLines = opts.maxLines ?? LOG_THROTTLE_MAX_LINES;
    this.now = opts.now ?? monotonicNow;
  }

  /** 書いてよければ `{ suppressed }`（前に書いてから上限で書かなかった件数）を返す。書かないなら `undefined`（件数に数える）。 */
  take(): { suppressed: number } | undefined {
    const now = this.now();
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.linesInWindow = 0;
    }
    if (this.linesInWindow >= this.maxLines) {
      this.suppressed += 1;
      return undefined;
    }
    this.linesInWindow += 1;
    const suppressed = this.suppressed;
    this.suppressed = 0;
    return { suppressed };
  }
}

/** 単調な時計（ms。プロセスの起動からの経過）。窓の長さを測るだけなので、壁時計である必要は無い。 */
export function monotonicNow(): number {
  return performance.now();
}
