import { WorktreeCreateParams, WorktreeListParams } from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

/**
 * worktree の一覧と作成（20260920-git-worktree-actions）。
 * **「開く」に方式は無い**——それは `workspace.create` に cwd を渡すだけなので、既にある機能で足りる。
 */
export function registerWorktreeMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("worktree.list", {
    schema: WorktreeListParams,
    handler: (_ctx, params) => deps.worktrees.list(params.workspaceId),
  });

  surface.register("worktree.create", {
    schema: WorktreeCreateParams,
    handler: (_ctx, params) => deps.worktrees.create(params.workspaceId, params.branch),
  });
}
