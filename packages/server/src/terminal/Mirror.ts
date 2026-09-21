// `@xterm/headless`・`@xterm/addon-serialize` は minify された CJS バンドルで、Node の ESM ローダ
// （cjs-module-lexer）が named export を静的解析できない（`import { Terminal } from "..."` が
// 実行時に失敗する。vitest/esbuild の変換では見逃していたが、`node dist/*.js` の直接実行で顕在化した）。
// default（名前空間オブジェクト）を受けて実行時に取り出す。
import xtermHeadless from "@xterm/headless";
import xtermAddonSerialize from "@xterm/addon-serialize";
import { win32 } from "node:path";
import { DEFAULT_THEME, type TerminalPalette } from "@wtm/protocol";
import type { Disposable } from "../util/Disposable.js";

const { Terminal } = xtermHeadless;
const { SerializeAddon } = xtermAddonSerialize;
type Terminal = InstanceType<typeof xtermHeadless.Terminal>;
type SerializeAddon = InstanceType<typeof xtermAddonSerialize.SerializeAddon>;

export interface MirrorSnapshot {
  cols: number;
  rows: number;
  text: string;
}

/**
 * サーバ側の端末エミュレータの包み（architecture.md「Mirror」）。
 * `@xterm/headless` 6.0.0 ＋ `@xterm/addon-serialize` 0.14.0（design E1・E2）。
 */
export interface Mirror {
  write(chunk: string, done?: () => void): void;
  pendingBytes(): number;
  onDrained(cb: () => void): Disposable;
  serialize(scrollbackLines: number): MirrorSnapshot;
  bottomLines(n: number): string[];
  title(): string;
  progress(): string | null;
  cwdHint(): string | null;
  onResponse(cb: (data: string) => void): Disposable;
  resize(cols: number, rows: number): void;
  dispose(): void;
}

const DRAIN_LOW_WATERMARK = 256 * 1024; // 256KB（design「流量制御」）

export class XtermMirror implements Mirror {
  private readonly term: Terminal;
  private readonly serializeAddon: SerializeAddon;
  private pending = 0;
  private readonly drainListeners = new Set<() => void>();
  private readonly responseListeners = new Set<(data: string) => void>();
  private latestTitle = "";
  private latestProgress: string | null = null;
  private latestCwd: string | null = null;
  private readonly disposables: Disposable[] = [];

  /**
   * `palette` は色の問い合わせに答える配色を返す関数（20260921-theme-settings の design D6）。**答える瞬間に呼ぶ**——その pane を操作している
   * ブラウザがテーマを変えたら次の答えから変わる。既定は今までの答え（dracula）。**投げてはならない**——xterm headless は OSC のハンドラを
   * try/catch で囲わないので、投げると書き込みの列が止まり（PTY は pause されたまま戻らない）、サーバも落ちる（`answerPaletteFor` は投げない）。
   */
  constructor(
    cols: number,
    rows: number,
    scrollback: number,
    private readonly palette: () => TerminalPalette = () => DEFAULT_THEME,
  ) {
    this.term = new Terminal({ cols, rows, scrollback, allowProposedApi: true });
    this.serializeAddon = new SerializeAddon();
    this.term.loadAddon(this.serializeAddon);

    // 端末アプリからの問い合わせへの応答（DA1・DA2・CPR・DECRQM・DECRQSS）は headless が標準で onData に出す（E1）。
    this.disposables.push(this.term.onData((data) => this.emitResponse(data)));
    this.disposables.push(this.term.onTitleChange((title) => (this.latestTitle = sanitizeOsc(title))));

    // 色の問い合わせ（OSC 4/10/11/12）には headless は応答しないので、`palette()` の配色で応答する（D17・20260921-theme-settings の design D6）。
    this.disposables.push(this.term.parser.registerOscHandler(10, (data) => this.handleColorQuery(data, "foreground", 10)));
    this.disposables.push(this.term.parser.registerOscHandler(11, (data) => this.handleColorQuery(data, "background", 11)));
    this.disposables.push(this.term.parser.registerOscHandler(12, (data) => this.handleColorQuery(data, "cursor", 12)));
    this.disposables.push(this.term.parser.registerOscHandler(4, (data) => this.handlePaletteQuery(data)));

    // OSC 9;4 は進捗（Windows Terminal/ConEmu 方式）。design「OSC の取得」。
    this.disposables.push(
      this.term.parser.registerOscHandler(9, (data) => {
        if (data.startsWith("4;")) {
          this.latestProgress = data;
          return true;
        }
        return false; // 通常の通知（OSC 9）は関与しない
      }),
    );
    // OSC 7 は cwd（file://host/path）。design「OSC の取得」。
    this.disposables.push(
      this.term.parser.registerOscHandler(7, (data) => {
        this.latestCwd = parseOsc7(data);
        return true;
      }),
    );
  }

  write(chunk: string, done?: () => void): void {
    this.pending += Buffer.byteLength(chunk, "utf8");
    this.term.write(chunk, () => {
      this.pending -= Buffer.byteLength(chunk, "utf8");
      if (this.pending < 0) this.pending = 0;
      if (this.pending <= DRAIN_LOW_WATERMARK) {
        for (const fn of [...this.drainListeners]) fn();
      }
      done?.();
    });
  }

  pendingBytes(): number {
    return this.pending;
  }

  onDrained(cb: () => void): Disposable {
    this.drainListeners.add(cb);
    return { dispose: () => this.drainListeners.delete(cb) };
  }

  serialize(scrollbackLines: number): MirrorSnapshot {
    const text = this.serializeAddon.serialize({ scrollback: scrollbackLines });
    return { cols: this.term.cols, rows: this.term.rows, text };
  }

  bottomLines(n: number): string[] {
    const buf = this.term.buffer.active;
    const out: string[] = [];
    const start = Math.max(0, buf.baseY + this.term.rows - n);
    for (let y = start; y < buf.baseY + this.term.rows; y++) {
      const line = buf.getLine(y);
      if (line) out.push(line.translateToString(true));
    }
    return out;
  }

  title(): string {
    return this.latestTitle;
  }
  progress(): string | null {
    return this.latestProgress;
  }
  cwdHint(): string | null {
    return this.latestCwd;
  }

  onResponse(cb: (data: string) => void): Disposable {
    this.responseListeners.add(cb);
    return { dispose: () => this.responseListeners.delete(cb) };
  }

  resize(cols: number, rows: number): void {
    this.term.resize(Math.max(1, cols), Math.max(1, rows));
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.term.dispose();
  }

  private emitResponse(data: string): void {
    for (const fn of [...this.responseListeners]) fn(data);
  }

  private handleColorQuery(data: string, key: "foreground" | "background" | "cursor", oscNumber: 10 | 11 | 12): boolean {
    if (data !== "?") return false; // 問い合わせ以外（実際に色を設定する OSC）は関与しない
    this.emitResponse(`\x1b]${oscNumber};${hexToXtermRgb(this.palette()[key])}\x07`);
    return true;
  }

  private handlePaletteQuery(data: string): boolean {
    // 形式: "<idx>;?"（複数指定 "<idx>;?;<idx2>;?..." も許容する）
    const parts = data.split(";");
    let ansi: TerminalPalette["ansi"] | undefined; // 最初の問い合わせで 1 回だけ引く（設定の OSC 4 では引かない。1 回の中で配色を揃える）
    let matched = false;
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const idxStr = parts[i];
      const query = parts[i + 1];
      if (query !== "?" || idxStr === undefined) continue;
      const idx = Number(idxStr);
      ansi ??= this.palette().ansi;
      if (!Number.isInteger(idx) || idx < 0 || idx >= ansi.length) continue;
      const color = ansi[idx];
      if (color === undefined) continue;
      this.emitResponse(`\x1b]4;${idx};${hexToXtermRgb(color)}\x07`);
      matched = true;
    }
    return matched;
  }
}

/** `#RRGGBB` → `rgb:RRRR/GGGG/BBBB`（xterm の色応答の慣習。各バイトを 16 bit に複製する）。 */
function hexToXtermRgb(hex: string): string {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) return "rgb:0000/0000/0000";
  const [, r, g, b] = m;
  return `rgb:${r}${r}/${g}${g}/${b}${b}`;
}

/**
 * OSC 7 の `file://host/path`（または `file:///path`）から、この端末上のパスを取り出す。
 * サーバが Windows なら `file://host/C:/Users/u` の pathname（`/C:/Users/u`）を `C:\Users\u` に直す——そのままでは
 * 使えない場所になり、新しく開く場所の「引き継ぐ」も `Pane.cwd` も追従しない（20260921-new-terminal-cwd の独立点検）。
 */
export function parseOsc7(data: string, platform: NodeJS.Platform = process.platform): string | null {
  try {
    const url = new URL(data);
    if (url.protocol !== "file:") return null;
    const path = decodeURIComponent(url.pathname);
    if (platform === "win32" && /^\/[A-Za-z]:(\/|$)/.test(path)) {
      return win32.normalize(`${path.slice(1, 3)}\\${path.slice(4)}`);
    }
    return path;
  } catch {
    return null;
  }
}

/** タイトルに紛れ込みうる制御文字を落とす（design「安全化済み」）。 */
function sanitizeOsc(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}
