import type { Disposable } from "../util/Disposable.js";
export type { Disposable };

export interface PtySpawnOptions {
  shell: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
}

/** design.md「PTY（node-pty）」・architecture.md「PtyBackend」interface。差し替え点（D9）。 */
export interface PtyProcess {
  readonly pid: number;
  onData(cb: (chunk: string) => void): Disposable;
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): Disposable;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  /** E4。ミラーの処理が遅れたときに PTY 自体を止める（design「流量制御」）。 */
  pause(): void;
  resume(): void;
  kill(): void;
}

export interface PtyBackend {
  spawn(opts: PtySpawnOptions): PtyProcess;
}
