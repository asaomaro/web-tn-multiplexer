export interface PersistScheduler {
  /** 保存の予約。500ms まとめる（architecture.md「PersistScheduler」）。 */
  touch(): void;
  /** 予約を待たずに即座に保存する（終了時に呼ぶ）。 */
  flush(): Promise<void>;
  /**
   * 予約を取り消す（保存しない）。復元を済ませる前に起動に失敗したとき、作りかけの状態を `session.json` へ書かないために
   * 使う（D102）。進行中の保存は止めない。
   */
  cancel(): void;
}

export class DefaultPersistScheduler implements PersistScheduler {
  private timer: NodeJS.Timeout | null = null;
  /** 進行中の保存（レビュー指摘：以前は `this.timer = null` を `save()` の前に行っていたため、
   *  その隙間で `flush()` が呼ばれると2回同時に `save()` が走りうった。1つの保存に相乗りさせる）。 */
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly save: () => Promise<void>,
    private readonly delayMs = 500,
  ) {}

  touch(): void {
    if (this.timer) return; // 既に予約済み
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runSave().catch(() => {
        // SessionFile 側でログに残す想定。ここで再送はしない（次の touch で改めて保存される）。
      });
    }, this.delayMs);
    this.timer.unref?.();
  }

  /** 進行中の保存があればそれに相乗りし、無ければ新しく始める。 */
  private runSave(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const p = this.save().finally(() => {
      if (this.inFlight === p) this.inFlight = null;
    });
    this.inFlight = p;
    return p;
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runSave();
  }
}
