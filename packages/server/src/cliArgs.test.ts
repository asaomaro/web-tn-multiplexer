import { describe, expect, it } from "vitest";
import { parseArgs } from "./cliArgs.js";
import { ConfigError } from "./config.js";

/** 投げた ConfigError の message（投げなければ失敗）。 */
function configErrorOf(argv: string[]): ConfigError {
  try {
    parseArgs(argv);
  } catch (err) {
    if (err instanceof ConfigError) return err;
    throw err;
  }
  throw new Error(`no ConfigError for ${argv.join(" ")}`);
}

describe("parseArgs（CLI の引数）", () => {
  it("serve のオプションを読む（--origin は複数）", () => {
    const parsed = parseArgs(["serve", "--host", "0.0.0.0", "--port", "8443", "--origin", "https://a", "--origin", "https://b", "--state-dir", "/s"]);
    expect(parsed.command).toBe("serve");
    expect(parsed.serve).toMatchObject({ host: "0.0.0.0", port: "8443", origin: ["https://a", "https://b"], stateDir: "/s" });
  });

  it("token reset はサブコマンドの語を読み飛ばしてから --state-dir を読む（以前は unknown option: reset で一度も動かなかった。D103）", () => {
    expect(parseArgs(["token", "reset"])).toMatchObject({ command: "token-reset", stateDir: undefined });
    expect(parseArgs(["token", "reset", "--state-dir", "/s"])).toMatchObject({ command: "token-reset", stateDir: "/s" });
  });

  it("オプションとサブコマンドの語の順は問わない（wtm token --state-dir D reset。独立点検 #6）", () => {
    expect(parseArgs(["token", "--state-dir", "/s", "reset"])).toMatchObject({ command: "token-reset", stateDir: "/s" });
  });

  it("未知のコマンド・サブコマンドは help ではなく ConfigError（終了コード 2・使い方つき。独立点検 #6）", () => {
    for (const argv of [["token", "rest"], ["token", "reset", "now"], ["token"], ["tokne", "reset"], ["serve", "extra"]]) {
      const err = configErrorOf(argv);
      expect(err.hint, argv.join(" ")).toContain("使い方");
    }
    expect(configErrorOf(["token", "rest"]).message).toContain("unknown subcommand: wtm token rest");
    expect(configErrorOf(["tokne", "reset"]).message).toContain("unknown command: tokne");
  });

  it("token reset に wtm serve のオプションを渡すと ConfigError（使えるのは --state-dir だけ。独立点検 #6）", () => {
    const err = configErrorOf(["token", "reset", "--host", "0.0.0.0"]);
    expect(err.message).toContain("--host is not an option of wtm token reset");
    expect(err.hint).toContain("--state-dir だけ");
    expect(configErrorOf(["token", "--port", "1", "reset", "--state-dir", "/s"]).message).toContain("--port");
  });

  it("未知のオプション・値の無いオプションは ConfigError。コマンドが無い・help・--help・-h だけが help", () => {
    expect(() => parseArgs(["serve", "--nope"])).toThrow(ConfigError);
    expect(() => parseArgs(["token", "reset", "--state-dir"])).toThrow(ConfigError);
    for (const argv of [[], ["help"], ["--help"], ["-h"]]) expect(parseArgs(argv).command).toBe("help");
  });
});
