export interface PersistScheduler {
  /** 保存の予約。500ms まとめる（architecture.md「PersistScheduler」）。 */
  touch(): void;
  /** 予約を待たずに即座に保存する（終了時に呼ぶ）。 */
  flush(): Promise<void>;
  /**
   * 予約を取り消す（保存しない）。復元を済ませる前に起動に失敗したとき、作りかけの状態を `session.json` へ書かないために
   * 使う（D102）。進行中の保存は止めない。進行中の保存の後に予定した追加の保存も取り消し、それを待つ `flush()` は
   * 保存せずに解決する。
   */
  cancel(): void;
}

export class DefaultPersistScheduler implements PersistScheduler {
  private timer: NodeJS.Timeout | null = null;
  /** 進行中の保存（レビュー指摘：以前は `this.timer = null` を `save()` の前に行っていたため、
   *  その隙間で `flush()` が呼ばれると2回同時に `save()` が走りえた）。 */
  private inFlight: Promise<void> | null = null;
  /** 進行中の保存が終わった後に行う追加の保存。進行中の保存はその開始時点の状態を書くので、相乗りするとその後の変更が
   *  落ちる（20260926-persist-flush-drops-changes）。保存中の要求はすべてこれ1つにまとめる。 */
  private queued: Promise<void> | null = null;

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

  /** 何も走っていなければすぐ保存し、保存中なら追加の保存（無ければ決める）に相乗りする。 */
  private runSave(): Promise<void> {
    // 進行中の保存が終わってから追加の保存が始まるまでの隙間でも、別の保存を始めない。
    if (this.queued) return this.queued;
    if (!this.inFlight) return this.startSave();
    const q: Promise<void> = this.inFlight
      .catch(() => undefined)
      .then(() => {
        if (this.queued !== q) return; // cancel() で取り消された
        this.queued = null;
        return this.startSave();
      });
    this.queued = q;
    return q;
  }

  private startSave(): Promise<void> {
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
    this.queued = null; // まだ始まっていない追加の保存も予約と同じく取り消す
  }

  async flush(): Promise<void> {
    // cancel() は呼ばない（追加の保存まで取り消すと、相乗りした flush が保存されずに解決する）。
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runSave();
  }
}
