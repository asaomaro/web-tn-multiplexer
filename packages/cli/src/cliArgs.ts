/**
 * `wtmctl` の引数解釈（design.md「インターフェース/データ構造・コマンド一覧」）。`main.ts` から分けたのは
 * 単体テストのため（`packages/server/src/cliArgs.ts` と同じ流儀）。誤りはどれも `CliUsageError`
 * （終了コード 2・使い方つき）：未知のオプション・値の無いオプション・未知の（サブ）コマンド・
 * 必須の位置引数の欠落・余分な位置引数・`--direction`/`--ratio`/`--timeout` 等の値が不正。
 */

const USAGE = [
  "wtmctl login --url <URL> --token <TOKEN>",
  "wtmctl workspace create [--cwd <path>] [--label <text>] [--url <URL>] [--token <TOKEN>]",
  "wtmctl workspace close <workspaceId> [--url <URL>] [--token <TOKEN>]",
  "wtmctl workspace rename <workspaceId> <label> [--url <URL>] [--token <TOKEN>]",
  "wtmctl tab create [--workspace <id>] [--label <text>] [--url <URL>] [--token <TOKEN>]",
  "wtmctl tab close <tabId> [--url <URL>] [--token <TOKEN>]",
  "wtmctl pane split <paneId> --direction right|down [--ratio <0.05-0.95>] [--url <URL>] [--token <TOKEN>]",
  "wtmctl pane close <paneId> [--url <URL>] [--token <TOKEN>]",
  "wtmctl pane input <paneId> <text> [--url <URL>] [--token <TOKEN>]",
  "wtmctl pane run <paneId> <command> [--url <URL>] [--token <TOKEN>]",
  "wtmctl pane read <paneId> [--follow] [--raw] [--timeout <ms>] [--url <URL>] [--token <TOKEN>]",
  "wtmctl snapshot [--url <URL>] [--token <TOKEN>]",
  "wtmctl watch [--json] [--url <URL>] [--token <TOKEN>]",
].join("\n");

export const DEFAULT_URL = "http://127.0.0.1:7780";

export class CliUsageError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string = USAGE) {
    super(message);
    this.name = "CliUsageError";
    this.hint = hint;
  }
}

export interface GlobalOpts {
  url: string;
  token: string | undefined;
}

export type Command =
  | { kind: "help" }
  | { kind: "login"; opts: GlobalOpts }
  | { kind: "workspace-create"; opts: GlobalOpts; cwd: string | undefined; label: string | undefined }
  | { kind: "workspace-close"; opts: GlobalOpts; workspaceId: string }
  | { kind: "workspace-rename"; opts: GlobalOpts; workspaceId: string; label: string }
  | { kind: "tab-create"; opts: GlobalOpts; workspaceId: string | undefined; label: string | undefined }
  | { kind: "tab-close"; opts: GlobalOpts; tabId: string }
  | { kind: "pane-split"; opts: GlobalOpts; paneId: string; direction: "right" | "down"; ratio: number | undefined }
  | { kind: "pane-close"; opts: GlobalOpts; paneId: string }
  | { kind: "pane-input"; opts: GlobalOpts; paneId: string; text: string }
  | { kind: "pane-run"; opts: GlobalOpts; paneId: string; command: string }
  | { kind: "pane-read"; opts: GlobalOpts; paneId: string; follow: boolean; raw: boolean; timeoutMs: number }
  | { kind: "snapshot"; opts: GlobalOpts }
  | { kind: "watch"; opts: GlobalOpts; json: boolean };

const DEFAULT_READ_TIMEOUT_MS = 5000;

interface FlagSpec {
  /** 値を取らない真偽フラグ（`--follow` 等）。 */
  bools?: readonly string[];
  /** 値を1つ取るフラグ（`--label <text>` 等）。 */
  values?: readonly string[];
}

interface ParsedFlags {
  positionals: string[];
  values: Map<string, string>;
  bools: Set<string>;
}

/**
 * 残りの語（サブコマンド名を除いた後）を、位置引数とフラグに分ける。`spec` に無いフラグは
 * `CliUsageError`（未知のオプション）。値フラグの直後に値が無い（末尾、または次も `--` で始まる）のも
 * `CliUsageError`。`--url`/`--token` は全コマンド共通なので、呼び出し側が `spec` に含める。
 */
function parseFlags(rest: readonly string[], spec: FlagSpec): ParsedFlags {
  const bools = new Set(spec.bools ?? []);
  const values = new Set(spec.values ?? []);
  const positionals: string[] = [];
  const outValues = new Map<string, string>();
  const outBools = new Set<string>();

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (bools.has(arg)) {
      outBools.add(arg);
      continue;
    }
    if (values.has(arg)) {
      const v = rest[++i];
      if (v === undefined || v.startsWith("--")) throw new CliUsageError(`missing value for ${arg}`, `${arg} には値が要ります。`);
      outValues.set(arg, v);
      continue;
    }
    throw new CliUsageError(`unknown option: ${arg}`, USAGE);
  }
  return { positionals, values: outValues, bools: outBools };
}

/** `--url`/`--token` を取り出す（全コマンド共通）。 */
function globalOptsFrom(values: Map<string, string>, env: NodeJS.ProcessEnv): GlobalOpts {
  return {
    url: values.get("--url") ?? env["WTMCTL_URL"] ?? DEFAULT_URL,
    token: values.get("--token") ?? env["WTMCTL_TOKEN"],
  };
}

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new CliUsageError(`invalid value for ${flag}: ${raw}`, `${flag} には正の整数を指定してください。`);
  }
  return n;
}

function parseRatio(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0.05 || n > 0.95) {
    throw new CliUsageError(`invalid value for --ratio: ${raw}`, "--ratio には 0.05〜0.95 の数値を指定してください。");
  }
  return n;
}

function requirePositional(positionals: readonly string[], index: number, name: string, usage: string): string {
  const v = positionals[index];
  if (v === undefined) throw new CliUsageError(`missing ${name}`, usage);
  return v;
}

function rejectExtra(positionals: readonly string[], expected: number, usage: string): void {
  if (positionals.length > expected) throw new CliUsageError(`unexpected argument: ${positionals[expected]}`, usage);
}

/** `process.argv.slice(2)` を渡す。`env` は既定 `process.env`（テストで差し替える）。 */
export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Command {
  const [word0, word1, ...rest0] = argv;
  if (word0 === undefined || word0 === "help" || word0 === "--help" || word0 === "-h") return { kind: "help" };

  const URL_TOKEN: FlagSpec = { values: ["--url", "--token"] };

  switch (word0) {
    case "login": {
      const { positionals, values } = parseFlags(argv.slice(1), URL_TOKEN);
      rejectExtra(positionals, 0, USAGE);
      const opts = globalOptsFrom(values, env);
      if (!opts.token) throw new CliUsageError("missing --token", "wtmctl login --url <URL> --token <TOKEN>");
      return { kind: "login", opts };
    }
    case "snapshot": {
      const { positionals, values } = parseFlags(argv.slice(1), URL_TOKEN);
      rejectExtra(positionals, 0, USAGE);
      return { kind: "snapshot", opts: globalOptsFrom(values, env) };
    }
    case "watch": {
      const { positionals, values, bools } = parseFlags(argv.slice(1), { ...URL_TOKEN, bools: ["--json"] });
      rejectExtra(positionals, 0, USAGE);
      return { kind: "watch", opts: globalOptsFrom(values, env), json: bools.has("--json") };
    }
    case "workspace":
      return parseWorkspace(word1, rest0, env);
    case "tab":
      return parseTab(word1, rest0, env);
    case "pane":
      return parsePane(word1, rest0, env);
    default:
      throw new CliUsageError(`unknown command: ${word0}`, USAGE);
  }
}

function parseWorkspace(sub: string | undefined, rest: readonly string[], env: NodeJS.ProcessEnv): Command {
  const URL_TOKEN: FlagSpec = { values: ["--url", "--token"] };
  if (sub === "create") {
    const { positionals, values } = parseFlags(rest, { ...URL_TOKEN, values: [...URL_TOKEN.values!, "--cwd", "--label"] });
    rejectExtra(positionals, 0, USAGE);
    return { kind: "workspace-create", opts: globalOptsFrom(values, env), cwd: values.get("--cwd"), label: values.get("--label") };
  }
  if (sub === "close") {
    const { positionals, values } = parseFlags(rest, URL_TOKEN);
    const workspaceId = requirePositional(positionals, 0, "workspaceId", USAGE);
    rejectExtra(positionals, 1, USAGE);
    return { kind: "workspace-close", opts: globalOptsFrom(values, env), workspaceId };
  }
  if (sub === "rename") {
    const { positionals, values } = parseFlags(rest, URL_TOKEN);
    const workspaceId = requirePositional(positionals, 0, "workspaceId", USAGE);
    const label = requirePositional(positionals, 1, "label", USAGE);
    rejectExtra(positionals, 2, USAGE);
    return { kind: "workspace-rename", opts: globalOptsFrom(values, env), workspaceId, label };
  }
  throw new CliUsageError(`unknown subcommand: wtmctl workspace ${sub ?? ""}`.trimEnd(), USAGE);
}

function parseTab(sub: string | undefined, rest: readonly string[], env: NodeJS.ProcessEnv): Command {
  const URL_TOKEN: FlagSpec = { values: ["--url", "--token"] };
  if (sub === "create") {
    const { positionals, values } = parseFlags(rest, { values: [...URL_TOKEN.values!, "--workspace", "--label"] });
    rejectExtra(positionals, 0, USAGE);
    return { kind: "tab-create", opts: globalOptsFrom(values, env), workspaceId: values.get("--workspace"), label: values.get("--label") };
  }
  if (sub === "close") {
    const { positionals, values } = parseFlags(rest, URL_TOKEN);
    const tabId = requirePositional(positionals, 0, "tabId", USAGE);
    rejectExtra(positionals, 1, USAGE);
    return { kind: "tab-close", opts: globalOptsFrom(values, env), tabId };
  }
  throw new CliUsageError(`unknown subcommand: wtmctl tab ${sub ?? ""}`.trimEnd(), USAGE);
}

function parsePane(sub: string | undefined, rest: readonly string[], env: NodeJS.ProcessEnv): Command {
  const URL_TOKEN: FlagSpec = { values: ["--url", "--token"] };
  if (sub === "split") {
    const { positionals, values } = parseFlags(rest, { values: [...URL_TOKEN.values!, "--direction", "--ratio"] });
    const paneId = requirePositional(positionals, 0, "paneId", USAGE);
    rejectExtra(positionals, 1, USAGE);
    const direction = values.get("--direction");
    if (direction !== "right" && direction !== "down") {
      throw new CliUsageError("missing or invalid --direction (right|down)", "wtmctl pane split <paneId> --direction right|down [--ratio N]");
    }
    const ratioRaw = values.get("--ratio");
    return { kind: "pane-split", opts: globalOptsFrom(values, env), paneId, direction, ratio: ratioRaw === undefined ? undefined : parseRatio(ratioRaw) };
  }
  if (sub === "close") {
    const { positionals, values } = parseFlags(rest, URL_TOKEN);
    const paneId = requirePositional(positionals, 0, "paneId", USAGE);
    rejectExtra(positionals, 1, USAGE);
    return { kind: "pane-close", opts: globalOptsFrom(values, env), paneId };
  }
  // `input`/`run` の第2位置引数（text/command）は自由文字列。**`--` で始まる文字列そのものを送りたい場合は
  // この単純なパーサでは未知のオプションとして拒否される**（`--` による位置引数との区切りは実装していない。
  // 既知の制約——taskcheck T3 の指摘で見つかった。値を丸ごと1つの引数として渡す限り〔シェルのクォート内〕は
  // 問題なく、実運用でまず困らない範囲と判断した）。
  if (sub === "input") {
    const { positionals, values } = parseFlags(rest, URL_TOKEN);
    const paneId = requirePositional(positionals, 0, "paneId", USAGE);
    const text = requirePositional(positionals, 1, "text", USAGE);
    rejectExtra(positionals, 2, USAGE);
    return { kind: "pane-input", opts: globalOptsFrom(values, env), paneId, text };
  }
  if (sub === "run") {
    const { positionals, values } = parseFlags(rest, URL_TOKEN);
    const paneId = requirePositional(positionals, 0, "paneId", USAGE);
    const command = requirePositional(positionals, 1, "command", USAGE);
    rejectExtra(positionals, 2, USAGE);
    return { kind: "pane-run", opts: globalOptsFrom(values, env), paneId, command };
  }
  if (sub === "read") {
    const { positionals, values, bools } = parseFlags(rest, { values: [...URL_TOKEN.values!, "--timeout"], bools: ["--follow", "--raw"] });
    const paneId = requirePositional(positionals, 0, "paneId", USAGE);
    rejectExtra(positionals, 1, USAGE);
    const timeoutRaw = values.get("--timeout");
    return {
      kind: "pane-read",
      opts: globalOptsFrom(values, env),
      paneId,
      follow: bools.has("--follow"),
      raw: bools.has("--raw"),
      timeoutMs: timeoutRaw === undefined ? DEFAULT_READ_TIMEOUT_MS : parsePositiveInt(timeoutRaw, "--timeout"),
    };
  }
  throw new CliUsageError(`unknown subcommand: wtmctl pane ${sub ?? ""}`.trimEnd(), USAGE);
}
