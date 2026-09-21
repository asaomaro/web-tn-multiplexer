import type { PaneId, TerminalPalette } from "@wtm/protocol";
import type { PtyProcess } from "../pty/PtyBackend.js";
import type { Disposable } from "../util/Disposable.js";
import { DefaultOutputFanout, type OutputFanout } from "./OutputFanout.js";
import { XtermMirror, type Mirror } from "./Mirror.js";

/** pane 1 つ分の端末（architecture.md「TerminalHost」）。PTY・ミラー・配信・流量制御をまとめる（D26）。 */
export interface TerminalHost {
  readonly paneId: PaneId;
  readonly pid: number;
  readonly mirror: Mirror;
  readonly fanout: OutputFanout;
  write(input: Uint8Array | string): void;
  resize(cols: number, rows: number): void;
  lastOutputAt(): number;
  onExit(cb: (code: number) => void): Disposable;
  dispose(): void;
}

const PAUSE_THRESHOLD_BYTES = 1024 * 1024; // 1MB（design「流量制御」）
const enc = new TextEncoder();

export class DefaultTerminalHost implements TerminalHost {
  readonly mirror: Mirror;
  readonly fanout: OutputFanout;
  private lastOutput = Date.now();
  private readonly exitListeners = new Set<(code: number) => void>();
  private readonly disposables: Disposable[] = [];
  private paused = false;
  private disposed = false;

  constructor(
    readonly paneId: PaneId,
    private readonly pty: PtyProcess,
    cols: number,
    rows: number,
    scrollbackLines: number,
    /** 色の問い合わせに答える配色（20260921-theme-settings の design D6）。省けば今までどおり dracula。 */
    palette?: () => TerminalPalette,
  ) {
    this.mirror = new XtermMirror(cols, rows, scrollbackLines, palette);
    this.fanout = new DefaultOutputFanout(paneId, this.mirror);

    // PTY の出力は、同じ呼び出しの中で Mirror と OutputFanout の両方に渡す（design「流量制御と文字列の変換」）。
    this.disposables.push(
      pty.onData((chunk) => {
        this.lastOutput = Date.now();
        this.mirror.write(chunk);
        this.fanout.push(enc.encode(chunk));
        if (!this.paused && this.mirror.pendingBytes() > PAUSE_THRESHOLD_BYTES) {
          this.paused = true;
          this.pty.pause();
        }
      }),
    );
    this.disposables.push(
      this.mirror.onDrained(() => {
        if (this.paused) {
          this.paused = false;
          this.pty.resume();
        }
        this.fanout.retryStale();
      }),
    );
    // 端末からの問い合わせへの応答は、ミラーが作ったものを PTY へ戻す（D17）。
    this.disposables.push(this.mirror.onResponse((data) => this.pty.write(data)));
    this.disposables.push(
      pty.onExit((e) => {
        for (const fn of [...this.exitListeners]) fn(e.exitCode);
      }),
    );
  }

  get pid(): number {
    return this.pty.pid;
  }

  write(input: Uint8Array | string): void {
    this.pty.write(input);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
    this.mirror.resize(cols, rows);
  }

  lastOutputAt(): number {
    return this.lastOutput;
  }

  onExit(cb: (code: number) => void): Disposable {
    this.exitListeners.add(cb);
    return { dispose: () => this.exitListeners.delete(cb) };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of this.disposables) d.dispose();
    this.mirror.dispose();
    try {
      this.pty.kill();
    } catch {
      // 既に終了しているプロセスへの kill は無視する。
    }
  }
}
