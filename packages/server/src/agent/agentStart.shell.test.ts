import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildStartLine } from "./agentStart.js";

/**
 * クォートを実物のシェルの構文解析で確かめる（20260926-agent-start AC7）。`buildStartLine` の行をシェルの標準入力から与え、
 * node が受け取った argv と、作業ディレクトリに何も作られないことを見る。zsh・ksh・mksh はこの環境に無い（test-result.md）。
 */

const EVIL: readonly string[] = [
  "; touch pwned1",
  "$(touch pwned2)",
  "`touch pwned3`",
  "&& touch pwned4",
  "| touch pwned5",
  "> pwned6",
  "a'b",
  "'",
  "''",
  'c"d',
  '"',
  "\\",
  "e\\",
  "x\\'",
  "$HOME",
  "${PATH}",
  "%PATH%",
  "*",
  "~",
  "~root",
  "!!",
  "!-1",
  "",
  " ",
  "-x",
  "--help",
  "=ls",
  "日本語 ✓",
  "#comment",
  "{a,b}",
  "a\u00a0b",
];

const PRINT_ARGV = "process.stdout.write(JSON.stringify(process.argv.slice(1)))";

const SHELLS: readonly [string, string[]][] = [
  ["/bin/bash", ["--norc", "--noprofile"]],
  ["/bin/bash", ["--norc", "--noprofile", "-i"]],
  ["/bin/sh", []],
  ["/usr/bin/dash", []],
  ["/usr/bin/dash", ["-i"]],
];

describe.each(SHELLS)("実物のシェル %s %j", (shell, shellArgs) => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agent-start-quote-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it.skipIf(!existsSync(shell))("悪意のある引数がそのまま 1 つずつ届き、副作用が起きない", () => {
    const line = buildStartLine(process.execPath, ["-e", PRINT_ARGV, ...EVIL]);
    const result = spawnSync(shell, shellArgs, {
      input: `${line}\n`,
      cwd: dir,
      env: {
        PATH: process.env["PATH"] ?? "/usr/bin:/bin",
        HOME: dir,
        HISTFILE: "/dev/null",
        PS1: "",
      },
      encoding: "utf8",
      timeout: 4000,
    });
    expect(result.error).toBeUndefined();
    expect(JSON.parse(result.stdout.slice(result.stdout.indexOf("[")))).toEqual(EVIL);
    expect(readdirSync(dir)).toEqual([]);
  });
});
