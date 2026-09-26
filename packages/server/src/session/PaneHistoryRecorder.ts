import type { Logger } from "../log/Logger.js";
import {
  PANE_HISTORY_MAX_FILE_BYTES,
  type PaneHistoryFile,
  type PaneHistoryFileData,
} from "../persist/PaneHistoryFile.js";
import { PANE_HISTORY_MAX_PANE_BYTES, truncateHistoryAnsi } from "../terminal/historyAnsi.js";
import type { TerminalManager } from "../terminal/TerminalManager.js";
import { withTimeout } from "./withTimeout.js";

/** 定期保存の間隔（decisions D2）。 */
export const PANE_HISTORY_SAVE_INTERVAL_MS = 30_000;
/** ファイル全体の上限から、項目以外（`schema`・`savedAt`・括弧）の分として引く余白。 */
const FILE_ENVELOPE_BYTES = 1024;

export interface PaneHistoryRecorderOptions {
  file: PaneHistoryFile;
  terminals: Pick<TerminalManager, "get">;
  /** 保存する pane の id（モデルの順）。 */
  paneIds: () => readonly string[];
  logger: Logger;
  /** 既定 `Date.now`（`TerminalHost.lastOutputAt()` と同じ時計）。 */
  now?: () => number;
  maxPaneBytes?: number;
  maxFileBytes?: number;
  /** ミラーが書き込みを処理し終えるのを待つ上限（ms）。既定 1000。 */
  flushTimeoutMs?: number;
}

interface Capture {
  /** 取り出しを始めた時刻（`now()`）。これより前の出力は `ansi` に入っている。 */
  at: number;
  savedAt: string;
  ansi: string;
  /** 内容が変わるたびに進める（書き直すかの比較に使う。取り直しても内容が同じなら進めない。review ラウンド 1）。 */
  version: number;
}

/**
 * 画面履歴の取り出しと保存（20260926-screen-history-replay。design「保存」）。`session.json` の保存とは別に、定期（`start`）と
 * 停止時（`save({ force: true })`）に `session-history.json` を書く。出力の無かった pane は前回の取り出しを使い、何も変わって
 * いなければ書かない（decisions D2）。`save` は直列に並び、投げない（失敗はログ。AC13）。
 */
export class PaneHistoryRecorder {
  private readonly file: PaneHistoryFile;
  private readonly terminals: Pick<TerminalManager, "get">;
  private readonly paneIds: () => readonly string[];
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly maxPaneBytes: number;
  private readonly maxFileBytes: number;
  private readonly flushTimeoutMs: number;
  private readonly cache = new Map<string, Capture>();
  /** 最後に書けた内容の pane の並び（`id@version`）。同じなら書き直さない。 */
  private lastWrittenKey: string | null = null;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setInterval> | null = null;
  private warnedFileLimit = false;

  constructor(opts: PaneHistoryRecorderOptions) {
    this.file = opts.file;
    this.terminals = opts.terminals;
    this.paneIds = opts.paneIds;
    this.logger = opts.logger;
    this.now = opts.now ?? Date.now;
    this.maxPaneBytes = opts.maxPaneBytes ?? PANE_HISTORY_MAX_PANE_BYTES;
    this.maxFileBytes = opts.maxFileBytes ?? PANE_HISTORY_MAX_FILE_BYTES;
    this.flushTimeoutMs = opts.flushTimeoutMs ?? 1000;
  }

  start(intervalMs = PANE_HISTORY_SAVE_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.save(), intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 前の保存が終わってから保存する。`force` は出力の有無にかかわらず取り直して書く（停止時）。 */
  save(opts: { force?: boolean } = {}): Promise<void> {
    const p = this.chain.then(() => this.saveNow(opts.force === true));
    this.chain = p.catch(() => undefined);
    return p;
  }

  private async saveNow(force: boolean): Promise<void> {
    try {
      const ids = this.paneIds();
      let changed = false;
      for (const id of ids) {
        if (await this.capture(id, force)) changed = true;
        await new Promise<void>((resolve) => setImmediate(resolve)); // 直列化は重い（research F5）。pane の間で他の処理を通す
      }
      const idSet = new Set(ids);
      for (const id of [...this.cache.keys()]) if (!idSet.has(id)) this.cache.delete(id);

      const entries: PaneHistoryFileData["panes"] = [];
      let bytes = FILE_ENVELOPE_BYTES;
      let dropped = 0;
      for (const id of ids) {
        const c = this.cache.get(id);
        if (!c || c.ansi === "") continue;
        const entry = { paneId: id, savedAt: c.savedAt, ansi: c.ansi };
        const size = Buffer.byteLength(JSON.stringify(entry), "utf8") + 1;
        if (bytes + size > this.maxFileBytes) {
          dropped++;
          continue;
        }
        bytes += size;
        entries.push(entry);
      }
      if (dropped > 0 && !this.warnedFileLimit) {
        this.warnedFileLimit = true;
        this.logger.warn("pane history exceeds the file size limit; some panes are not saved", {
          dropped,
          maxFileBytes: this.maxFileBytes,
        });
      }
      const key = entries.map((e) => `${e.paneId}@${this.cache.get(e.paneId)!.version}`).join(",");
      if (!force && !changed && key === this.lastWrittenKey) return; // 何も変わっていない（AC3）
      const data: PaneHistoryFileData = {
        schema: 1,
        savedAt: new Date(this.now()).toISOString(),
        panes: entries,
      };
      try {
        await this.file.save(data);
        this.lastWrittenKey = key;
      } catch (err) {
        this.lastWrittenKey = null; // 次回は書き直す
        this.logger.warn("pane history save failed", {
          path: this.file.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (err) {
      // 想定外（paneIds が投げた等）。保存の失敗と同じくログに残して止めない。
      this.logger.warn("pane history save failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** pane 1 つを取り出す（出力が無ければ前回のまま）。内容が変わったら true（取り直しても同じなら false）。 */
  private async capture(id: string, force: boolean): Promise<boolean> {
    const host = this.terminals.get(id);
    if (!host) return false;
    const prev = this.cache.get(id);
    if (!force && prev && host.lastOutputAt() < prev.at) return false;
    const at = this.now();
    // 届いている出力をミラーが処理し終えてから読む。pane が閉じて返らないときは上限で諦める（前回のまま）。
    const flushed = await withTimeout(async () => {
      await host.mirror.flush();
      return true;
    }, this.flushTimeoutMs);
    if (flushed === null) return false;
    let ansi: string;
    try {
      ansi = truncateHistoryAnsi(host.mirror.historyAnsi(), this.maxPaneBytes);
    } catch {
      return false; // 閉じた（dispose 済み）等
    }
    if (prev && prev.ansi === ansi) {
      // 出力はあったが通常の画面は同じ（代替画面のアプリ・スピナー等）。次の比較の基準だけ進め、書き直さない。
      this.cache.set(id, { ...prev, at, savedAt: new Date(at).toISOString() }); // version は据え置く（key が変わらない）
      return false;
    }
    this.cache.set(id, {
      at,
      savedAt: new Date(at).toISOString(),
      ansi,
      version: (prev?.version ?? 0) + 1,
    });
    return true;
  }
}
