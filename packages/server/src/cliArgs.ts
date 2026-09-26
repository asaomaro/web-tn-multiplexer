import { ConfigError, type RawServeArgs } from "./config.js";

export interface ParsedArgs {
  command: "serve" | "token-reset" | "session-list" | "session-delete" | "help";
  serve: RawServeArgs;
  stateDir?: string | undefined;
  /** `--session`（serve・token reset。20260926-named-session）。serve では `serve.session` にも入る。 */
  session?: string | undefined;
  /** `wtm session delete <name>` の名前。 */
  sessionTarget?: string | undefined;
  /** `--json`（session だけ）。 */
  json?: boolean;
}

const USAGE =
  "使い方: wtm serve [--host H] [--port P] [--cert F] [--key F] [--origin O]... [--state-dir D] [--session NAME] [--scrollback N] [--shell S] [--worktree-dir D] / wtm token reset [--state-dir D] [--session NAME] / wtm session list [--state-dir D] [--json] / wtm session delete NAME [--state-dir D] [--json]";

/**
 * CLI の引数を解釈する（`wtm serve [...]` / `wtm token reset [--state-dir D] [--session NAME]` / `wtm session list|delete`）。`main.ts` から分けたのは単体テストのため
 * （`main.ts` は読み込むと起動する）。誤りはどれも `ConfigError`（終了コード 2・使い方つき）：
 * - 未知のオプション・値の無いオプション。
 * - 未知のコマンド・サブコマンド（`wtm token rest` 等。以前は help を出して終了コード 0 だった。D103 の独立点検 #6）。
 *   コマンドが無い・`help`・`--help`・`-h` だけが help。
 * - `wtm serve` の余分な語、`wtm token reset` での `wtm serve` のオプション（`--host` 等。`--state-dir` と `--session` だけ使える）。
 * - `--json` は `wtm session` だけ、`--session` は `wtm serve`・`wtm token reset` だけ（20260926-named-session）。名前の規則は
 *   ここでは見ない（状態ディレクトリを決める `resolveSessionStateDir` が見る）。
 * オプションとサブコマンドの語の順は問わない（`wtm token --state-dir D reset` も `reset` を拾う）。**以前は `reset` も
 * オプションとして読み `unknown option: reset` で終わり、`wtm token reset` が一度も動かなかった**（D103）。
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const serve: RawServeArgs = { origin: [] };
  if (command === undefined || command === "help" || command === "--help" || command === "-h") return { command: "help", serve };
  if (command !== "serve" && command !== "token" && command !== "session") throw new ConfigError(`unknown command: ${command}`, USAGE);
  let stateDir: string | undefined;
  let session: string | undefined;
  let json = false;
  const words: string[] = [];
  const serveOnlyOptions: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (!arg.startsWith("-")) {
      words.push(arg);
      continue;
    }
    const next = (): string => {
      const v = rest[++i];
      if (v === undefined) throw new ConfigError(`missing value for ${arg}`, `${arg} には値が要ります。`);
      return v;
    };
    if (arg !== "--state-dir" && arg !== "--session" && arg !== "--json") serveOnlyOptions.push(arg);
    switch (arg) {
      case "--host":
        serve.host = next();
        break;
      case "--port":
        serve.port = next();
        break;
      case "--cert":
        serve.cert = next();
        break;
      case "--key":
        serve.key = next();
        break;
      case "--origin":
        serve.origin!.push(next());
        break;
      case "--state-dir":
        stateDir = next();
        serve.stateDir = stateDir;
        break;
      case "--session":
        session = next();
        serve.session = session;
        break;
      case "--json":
        json = true;
        break;
      case "--scrollback":
        serve.scrollback = next();
        break;
      case "--shell":
        serve.shell = next();
        break;
      case "--worktree-dir":
        serve.worktreeDir = next();
        break;
      default:
        throw new ConfigError(`unknown option: ${arg}`, USAGE);
    }
  }

  if (command !== "session" && json) throw new ConfigError(`--json is not an option of wtm ${command === "token" ? "token reset" : command}`, USAGE);
  if (command === "serve") {
    if (words.length > 0) throw new ConfigError(`unexpected argument for wtm serve: ${words[0]}`, USAGE);
    return { command: "serve", serve, stateDir, session };
  }
  if (command === "session") return parseSessionCommand(words, serveOnlyOptions, session, stateDir, json, serve);
  if (words.length === 0) throw new ConfigError("missing subcommand: wtm token <reset>", USAGE);
  if (words[0] !== "reset" || words.length > 1) throw new ConfigError(`unknown subcommand: wtm token ${words.join(" ")}`, USAGE);
  if (serveOnlyOptions.length > 0) {
    throw new ConfigError(
      `${serveOnlyOptions[0]} is not an option of wtm token reset`,
      `wtm token reset で使えるオプションは --session と --state-dir だけです（${serveOnlyOptions[0]} は wtm serve のオプション）。`,
    );
  }
  return { command: "token-reset", serve, stateDir, session };
}

/** `wtm session list` / `wtm session delete <name>`（20260926-named-session）。使えるオプションは --state-dir と --json だけ。 */
function parseSessionCommand(
  words: readonly string[],
  serveOnlyOptions: readonly string[],
  session: string | undefined,
  stateDir: string | undefined,
  json: boolean,
  serve: RawServeArgs,
): ParsedArgs {
  const bad = serveOnlyOptions[0] ?? (session !== undefined ? "--session" : undefined);
  if (bad !== undefined) {
    throw new ConfigError(`${bad} is not an option of wtm session`, `wtm session で使えるオプションは --state-dir と --json だけです。${USAGE}`);
  }
  const [sub, ...args] = words;
  if (sub === "list" && args.length === 0) return { command: "session-list", serve, stateDir, json };
  if (sub === "delete" && args.length === 1) return { command: "session-delete", serve, stateDir, json, sessionTarget: args[0] };
  if (sub === undefined) throw new ConfigError("missing subcommand: wtm session <list|delete>", USAGE);
  if (sub === "delete" && args.length === 0) throw new ConfigError("missing session name: wtm session delete <name>", USAGE);
  throw new ConfigError(`unknown subcommand: wtm session ${words.join(" ")}`, USAGE);
}
