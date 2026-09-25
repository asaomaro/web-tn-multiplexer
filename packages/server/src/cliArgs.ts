import { ConfigError, type RawServeArgs } from "./config.js";

export interface ParsedArgs {
  command: "serve" | "token-reset" | "help";
  serve: RawServeArgs;
  stateDir?: string | undefined;
}

const USAGE =
  "使い方: wtm serve [--host H] [--port P] [--cert F] [--key F] [--origin O]... [--state-dir D] [--scrollback N] [--shell S] [--worktree-dir D] / wtm token reset [--state-dir D]";

/**
 * CLI の引数を解釈する（`wtm serve [...]` / `wtm token reset [--state-dir D]`）。`main.ts` から分けたのは単体テストのため
 * （`main.ts` は読み込むと起動する）。誤りはどれも `ConfigError`（終了コード 2・使い方つき）：
 * - 未知のオプション・値の無いオプション。
 * - 未知のコマンド・サブコマンド（`wtm token rest` 等。以前は help を出して終了コード 0 だった。D103 の独立点検 #6）。
 *   コマンドが無い・`help`・`--help`・`-h` だけが help。
 * - `wtm serve` の余分な語、`wtm token reset` での `wtm serve` のオプション（`--host` 等。`--state-dir` だけ使える）。
 * オプションとサブコマンドの語の順は問わない（`wtm token --state-dir D reset` も `reset` を拾う）。**以前は `reset` も
 * オプションとして読み `unknown option: reset` で終わり、`wtm token reset` が一度も動かなかった**（D103）。
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const serve: RawServeArgs = { origin: [] };
  if (command === undefined || command === "help" || command === "--help" || command === "-h") return { command: "help", serve };
  if (command !== "serve" && command !== "token") throw new ConfigError(`unknown command: ${command}`, USAGE);
  let stateDir: string | undefined;
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
    if (arg !== "--state-dir") serveOnlyOptions.push(arg);
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

  if (command === "serve") {
    if (words.length > 0) throw new ConfigError(`unexpected argument for wtm serve: ${words[0]}`, USAGE);
    return { command: "serve", serve, stateDir };
  }
  if (words.length === 0) throw new ConfigError("missing subcommand: wtm token <reset>", USAGE);
  if (words[0] !== "reset" || words.length > 1) throw new ConfigError(`unknown subcommand: wtm token ${words.join(" ")}`, USAGE);
  if (serveOnlyOptions.length > 0) {
    throw new ConfigError(
      `${serveOnlyOptions[0]} is not an option of wtm token reset`,
      `wtm token reset で使えるオプションは --state-dir だけです（${serveOnlyOptions[0]} は wtm serve のオプション）。`,
    );
  }
  return { command: "token-reset", serve, stateDir };
}
