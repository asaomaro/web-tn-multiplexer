/** design.md「WebSocket の通信」のエラーコード。 */
export type ErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_params"
  | "spawn_failed"
  | "internal"
  // worktree（20260920-git-worktree-actions）。**種類ごとに分けるのは、web が code から日本語を引くため**
  // （D107：サーバの message は利用者に見せない）。git の生の診断はサーバのログにだけ残す。
  | "not_a_git_repository"
  | "worktree_branch_in_use"
  | "worktree_path_exists"
  | "worktree_no_commits"
  | "worktree_invalid_branch"
  | "worktree_failed";

export interface ProtocolError {
  code: ErrorCode;
  message: string;
}

export class RpcError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RpcError";
  }
  toProtocolError(): ProtocolError {
    return { code: this.code, message: this.message };
  }
}
