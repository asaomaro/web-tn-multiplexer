#!/usr/bin/env node
/**
 * `wtmctl` のエントリポイント（design.md「インターフェース/データ構造・コマンド一覧」）。
 * `parseArgs` → 対応する `commands/*` を呼ぶ → 例外は `reportAndExit` が終了コードへ変換する（T11）。
 */
import { parseArgs } from "./cliArgs.js";
import { runTabClose, runTabCreate } from "./commands/tab.js";
import { runPaneClose, runPaneInput, runPaneRead, runPaneRun, runPaneSplit } from "./commands/pane.js";
import { runLogin, runSnapshot, runWatch } from "./commands/session.js";
import { runWorkspaceClose, runWorkspaceCreate, runWorkspaceRename } from "./commands/workspace.js";
import { reportAndExit } from "./output.js";
import { FsSessionStore } from "./session.js";

function printHelp(): void {
  console.log(
    [
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
      "",
      "環境変数: WTMCTL_URL（既定 http://127.0.0.1:7780）・WTMCTL_TOKEN",
      "",
      "pane input/pane run は、実プロセスへ実際に届いたことまでは保証しません（INPUT フレームに ack はありません）。",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const cmd = parseArgs(process.argv.slice(2));
  if (cmd.kind === "help") {
    printHelp();
    return;
  }
  const store = new FsSessionStore();
  switch (cmd.kind) {
    case "login":
      return runLogin(cmd, store);
    case "workspace-create":
      return runWorkspaceCreate(cmd, store);
    case "workspace-close":
      return runWorkspaceClose(cmd, store);
    case "workspace-rename":
      return runWorkspaceRename(cmd, store);
    case "tab-create":
      return runTabCreate(cmd, store);
    case "tab-close":
      return runTabClose(cmd, store);
    case "pane-split":
      return runPaneSplit(cmd, store);
    case "pane-close":
      return runPaneClose(cmd, store);
    case "pane-input":
      return runPaneInput(cmd, store);
    case "pane-run":
      return runPaneRun(cmd, store);
    case "pane-read":
      return runPaneRead(cmd, store);
    case "snapshot":
      return runSnapshot(cmd, store);
    case "watch":
      return runWatch(cmd, store);
    default: {
      // 網羅性チェック：`Command` に新しい種類が足されたのにここへ分岐を足し忘れると、ここで型エラーになる
      // （coding のタスク横断点検で見つけた——`switch` 単体では TS は非網羅を黙って許す。この tsconfig は
      // `noImplicitReturns` を有効にしていないため）。
      const exhaustive: never = cmd;
      throw new Error(`unhandled command: ${JSON.stringify(exhaustive)}`);
    }
  }
}

main().catch((err: unknown) => {
  reportAndExit(err);
});
