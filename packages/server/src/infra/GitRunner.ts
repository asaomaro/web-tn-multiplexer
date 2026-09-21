import { spawn } from "node:child_process";

/** `git` コマンドの実行を抽象化する口（architecture.md「infra/*」）。GitInfoPoller が使う。 */
export interface GitRunner {
  run(cwd: string, args: string[], timeoutMs: number): Promise<{ code: number; stdout: string }>;
}

export class ChildProcessGitRunner implements GitRunner {
  async run(cwd: string, args: string[], timeoutMs: number): Promise<{ code: number; stdout: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
      let stdout = "";
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`git ${args.join(" ")} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code: code ?? -1, stdout });
      });
    });
  }
}
