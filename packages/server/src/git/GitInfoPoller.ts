import type { GitInfo, Workspace } from "@wtm/protocol";
import type { SessionService } from "../session/SessionService.js";
import type { GitRunner } from "../infra/GitRunner.js";
import { resolveCommonDir } from "./worktree.js";

const DEFAULT_INTERVAL_MS = 5000;
const GIT_TIMEOUT_MS = 3000;

/** workspace の cwd ごとに git 情報を取り、変化したら反映する（architecture.md「GitInfoPoller」）。 */
export interface GitInfoPoller {
  start(): void;
  stop(): void;
  /** テスト・診断用に、間隔を待たず今すぐ 1 周する。 */
  pollNow(): Promise<void>;
}

export class DefaultGitInfoPoller implements GitInfoPoller {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly session: SessionService,
    private readonly git: GitRunner,
    private readonly intervalMs = DEFAULT_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.pollNow().catch(() => undefined);
    }, this.intervalMs);
    this.timer.unref?.();
    void this.pollNow();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollNow(): Promise<void> {
    const workspaces = this.session.snapshot().workspaces;
    await Promise.all(workspaces.map((ws) => this.pollWorkspace(ws)));
  }

  private async pollWorkspace(ws: Workspace): Promise<void> {
    const git = await this.probe(ws.cwd);
    this.session.updateWorkspaceGit(ws.id, git);
  }

  private async probe(cwd: string): Promise<GitInfo | null> {
    try {
      const branchResult = await this.git.run(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], GIT_TIMEOUT_MS);
      if (branchResult.code !== 0) return null; // git 管理外（またはコミットが 1 つも無い）
      const branch = branchResult.stdout.trim() || null;

      let ahead = 0;
      let behind = 0;
      const countsResult = await this.git.run(cwd, ["rev-list", "--left-right", "--count", "@{u}...HEAD"], GIT_TIMEOUT_MS);
      if (countsResult.code === 0) {
        const [behindStr, aheadStr] = countsResult.stdout.trim().split(/\s+/);
        behind = Number(behindStr) || 0;
        ahead = Number(aheadStr) || 0;
      } // 上流ブランチが無ければそのまま 0/0（エラーにしない）

      // worktree 自動グループの判定キー（20260923-workspace-grouping。design「server
      // （GitInfoPoller.probe の拡張）」）。既存の `WorktreeService.repoNameOf` と同じ
      // `resolveCommonDir` を再利用する——新しい共有モジュールは作らない。
      let repoKey: string | null = null;
      let isLinkedWorktree = false;
      const commonResult = await this.git.run(cwd, ["rev-parse", "--git-common-dir"], GIT_TIMEOUT_MS);
      if (commonResult.code === 0) {
        repoKey = resolveCommonDir(cwd, commonResult.stdout);
        const dirResult = await this.git.run(cwd, ["rev-parse", "--git-dir"], GIT_TIMEOUT_MS);
        // 本体は `--git-dir` と `--git-common-dir` が同じパスを指す。linked worktree は異なる
        // （`--git-dir` が `<common-dir>/worktrees/<name>` を指す標準的な Git の仕組み）。
        if (dirResult.code === 0) isLinkedWorktree = resolveCommonDir(cwd, dirResult.stdout) !== repoKey;
      } // 取れなければ repoKey は null のまま（worktree 自動グループの対象外）

      return { branch, ahead, behind, repoKey, isLinkedWorktree };
    } catch {
      return null; // 時間切れ・git が無い等
    }
  }
}
