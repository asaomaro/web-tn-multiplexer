import { homedir, platform } from "node:os";
import { join } from "node:path";
import { isLoopbackHost, unbracketHost } from "./util/net.js";

/** design.md「起動オプション（wtm serve）」の既定値。 */
export const DEFAULTS = {
  host: "127.0.0.1",
  port: 7780,
  scrollbackLines: 5000, // D20
  scrollbackLinesMax: 10000, // D20
} as const;

export interface ServeOptions {
  host: string;
  port: number;
  cert: string | undefined;
  key: string | undefined;
  /** `--origin` で追加された許可 Origin（複数指定可）。 */
  extraOrigins: string[];
  stateDir: string;
  scrollbackLines: number;
  shell: string | undefined;
  /** 20260924-worktree-dir-config。既定値の解決はしない（`shell` と同じ。既定は `defaultWorktreeRoot()` 側に委ねる）。 */
  worktreeDir: string | undefined;
}

export interface RawServeArgs {
  host?: string;
  port?: string;
  cert?: string;
  key?: string;
  origin?: string[];
  stateDir?: string;
  scrollback?: string;
  shell?: string;
  worktreeDir?: string;
}

/** Linux/macOS は XDG の state ディレクトリ、Windows は `%LOCALAPPDATA%`（design「起動オプション」）。 */
export function defaultStateDir(env: NodeJS.ProcessEnv = process.env, os: NodeJS.Platform = platform()): string {
  if (os === "win32") {
    const base = env["LOCALAPPDATA"] ?? join(homedir(), "AppData", "Local");
    return join(base, "web-tn-multiplexer");
  }
  const base = env["XDG_STATE_HOME"] ?? join(homedir(), ".local", "state");
  return join(base, "web-tn-multiplexer");
}

export class ConfigError extends Error {
  /** `main.ts` が終了コード 2 で使う理由の要約。 */
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "ConfigError";
    this.hint = hint;
  }
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new ConfigError(`invalid --port: ${raw}`, "1〜65535 の整数を指定してください。");
  }
  return n;
}

function parseScrollback(raw: string | undefined): number {
  if (raw === undefined) return DEFAULTS.scrollbackLines;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new ConfigError(`invalid --scrollback: ${raw}`, "0 以上の整数を指定してください。");
  }
  return Math.min(n, DEFAULTS.scrollbackLinesMax);
}

/**
 * `--origin` を、ブラウザが送る Origin と同じ形にそろえる（`URL.origin`：ホスト名の小文字化・既定ポートと末尾の `/` の除去）。
 * `https://x:443` や `https://x/` を渡しても、ブラウザの `https://x` と一致させるため。
 */
function parseOrigin(raw: string): string {
  let url: URL | undefined;
  try {
    url = new URL(raw);
  } catch {
    url = undefined;
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new ConfigError(`invalid --origin: ${raw}`, "--origin には完全な Origin（https://host:port の形）を指定してください。");
  }
  return url.origin;
}

/**
 * 起動オプションを解釈・検証する。**ループバック以外で証明書が無ければ `ConfigError`**
 * （zellij 方式。design.md「認証と TLS」・research.md F9.1）。
 */
export function resolveServeOptions(args: RawServeArgs, env: NodeJS.ProcessEnv = process.env): ServeOptions {
  // `--host [::1]` のような角括弧付きの IPv6 は角括弧を外す（`listen()` は角括弧付きを名前として引き、`ENOTFOUND` で
  // 落ちる）。以後の `isLoopbackHost`・`isWildcardHost` は角括弧の無い形だけを見る（D102）。
  const host = unbracketHost(args.host ?? DEFAULTS.host);
  const port = parsePort(args.port, DEFAULTS.port);
  const hasCert = Boolean(args.cert && args.key);

  if (!isLoopbackHost(host) && !hasCert) {
    throw new ConfigError(
      `cannot bind to non-loopback host "${host}" without a certificate`,
      "--cert と --key で TLS 証明書を指定するか、--host を localhost / 127.0.0.1 にしてください。",
    );
  }
  if ((args.cert && !args.key) || (!args.cert && args.key)) {
    throw new ConfigError("--cert and --key must be given together", "--cert と --key は両方指定してください。");
  }

  return {
    host,
    port,
    cert: args.cert,
    key: args.key,
    extraOrigins: (args.origin ?? []).map(parseOrigin),
    stateDir: args.stateDir ?? defaultStateDir(env),
    scrollbackLines: parseScrollback(args.scrollback),
    shell: args.shell,
    worktreeDir: args.worktreeDir,
  };
}

/**
 * 待ち受け（bind）の段階の失敗か（D102。D103 で `main.ts` から `listenFailureHint` の隣へ移した——判定を 1 か所に）。
 * `listen()` は bind の後に token の保存・復元も行うので、`code` だけで見ると状態ディレクトリの書き込みの `EACCES` 等を
 * 「ポートの権限」と取り違える。`syscall` が `listen`・`bind`・`getaddrinfo`（bind・名前解決）のものだけを拾う。
 */
export function isBindFailure(err: unknown): err is NodeJS.ErrnoException {
  const e = err as NodeJS.ErrnoException | null;
  return e instanceof Error && (e.syscall === "listen" || e.syscall === "bind" || e.syscall === "getaddrinfo");
}

/**
 * `listen()` の失敗の案内（`main.ts` が終了コード 2 の `ConfigError` にする）。待ち受けの段階の失敗（`isBindFailure`）で、
 * 利用者が直せるもの（`listenFailureHint`）だけに案内を返し、それ以外（bind の後の失敗・想定外の失敗）は `undefined`。
 */
export function bindFailureHint(err: unknown): string | undefined {
  return isBindFailure(err) ? listenFailureHint(err.code) : undefined;
}

/**
 * 同じ状態ディレクトリを別の wtm が使っている（`wtm.lock`。D103）。`wtm serve` は起動を、`wtm token reset` は
 * `auth.json` の書き換えを断る（終了コード 2）。`otherHost` は、ロックの持ち主が別のホスト（別のマシン・別のコンテナ）で
 * pid の生死を確かめられなかったときのホスト名。
 */
export function stateDirInUseError(
  inUse: { pid: number; lockPath: string; otherHost?: string | undefined },
  stateDir: string,
  command: "serve" | "token-reset",
): ConfigError {
  const who = inUse.otherHost !== undefined ? `pid ${inUse.pid} on ${inUse.otherHost}` : `pid ${inUse.pid}`;
  const stale =
    inUse.otherHost !== undefined
      ? `ロックは別のホスト（または別のコンテナ）${inUse.otherHost} の pid ${inUse.pid} のもので、その生死はここからは確かめられません。` +
        `そちらで wtm が動いていなければ（落ちて残ったロック。コンテナを作り直してホスト名が変わった等）、${inUse.lockPath} を消してからやり直してください。`
      : `pid ${inUse.pid} が wtm でなければ（前の wtm が落ちた後に pid が再利用された）、${inUse.lockPath} を消してからやり直してください。`;
  if (command === "serve") {
    return new ConfigError(
      `the state dir ${stateDir} is already in use by another wtm (${who})`,
      [
        "同じ --state-dir を別の wtm（wtm serve か wtm token reset）が使っています（wtm serve を 2 つ動かすと全シェルを二重に起動し、session.json・auth.json を互いに上書きします）。",
        "別のポートで並行して動かすなら、--state-dir に別のディレクトリを指定してください。",
        stale,
      ].join(""),
    );
  }
  return new ConfigError(
    `cannot reset the token: the state dir ${stateDir} is in use by a running wtm (${who})`,
    [
      "wtm serve が動いている間は token を作り直せません（動いている側は古い token のまま新しい token を受け付けず、",
      "次のログイン等で auth.json を古い token に書き戻します）。wtm serve を止めてから wtm token reset を実行し、もう一度起動してください。",
      stale,
    ].join(""),
  );
}

/**
 * 待ち受け（bind）の失敗の案内（`main.ts` が終了コード 2 の `ConfigError` にする。design「エラー処理 / 異常系」・D102）。
 * 利用者の設定・環境で直せる失敗（`EADDRINUSE`・`EACCES`・`EADDRNOTAVAIL`・`ENOTFOUND`・`EAI_AGAIN`）だけに案内を返し、
 * それ以外（想定外の失敗）は `undefined`——呼び出し側はそのまま投げ直す（終了コード 1。原因を握りつぶさない）。
 */
export function listenFailureHint(code: string | undefined): string | undefined {
  switch (code) {
    case "EADDRINUSE":
      return [
        "そのポートは別のプロセスが使っています。",
        "--port で別のポートを指定してください。",
        // 同じ state-dir の wtm はポートを変えても 2 つ目が `wtm.lock` で止まる（D103）ので、状態ディレクトリも分けるよう添える。
        "wtm を並行して動かすなら --state-dir も分けてください。",
      ].join("");
    case "EACCES":
      return [
        "そのポートで待ち受ける権限がありません。",
        "Linux では 1024 未満のポート（443 等）は root 等の特権が要ります——1024 以上（既定の 7780・8443 等）を使ってください。",
        "Windows では、Hyper-V・WSL 等が予約した除外ポート範囲のポートは使えません",
        "（`netsh interface ipv4 show excludedportrange protocol=tcp` で確かめ、範囲の外のポートを指定してください）。",
      ].join("");
    case "EADDRNOTAVAIL":
      return "--host がこのマシンのアドレスではありません。このマシンの IP か、全インタフェースの 0.0.0.0 を指定してください。";
    case "ENOTFOUND":
    case "EAI_AGAIN": // 名前解決の一時的な失敗（DNS に届かない等）。ENOTFOUND と同じく --host の見直しを案内する
      return "--host の名前を解決できませんでした。IP アドレス（0.0.0.0・127.0.0.1 等）で指定してください。";
    default:
      return undefined;
  }
}
