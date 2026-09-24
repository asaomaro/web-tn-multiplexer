import {
  WorkspaceCloseParams,
  WorkspaceCreateParams,
  WorkspaceFocusParams,
  WorkspaceMoveParams,
  WorkspaceMoveToParams,
  WorkspaceRenameParams,
} from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerWorkspaceMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("workspace.create", {
    schema: WorkspaceCreateParams,
    handler: (ctx, params) => {
      deps.clients.touch(ctx.clientId); // 作る操作も操作（色の問い合わせの答え。20260921-theme-settings の decisions D13）
      return deps.session.createWorkspace(params.cwd, params.label, params.newCwd);
    },
  });

  surface.register("workspace.rename", {
    schema: WorkspaceRenameParams,
    // `label: null` は自動の名前に戻す（20260921-workspace-auto-label）。**await してから応答する**——await しないと、無い workspace の
    // `RpcError("not_found")` の拒否が not_found の応答に届かず未処理の拒否になり、応答も `workspace.updated` より先に返る。
    handler: async (_ctx, params) => {
      await deps.session.renameWorkspace(params.workspaceId, params.label);
      return {};
    },
  });

  surface.register("workspace.focus", {
    schema: WorkspaceFocusParams,
    handler: (ctx, params) => {
      deps.session.focusWorkspace(params.workspaceId);
      const focus = deps.session.snapshot().focus;
      if (focus) deps.sizeAuthority.noteInteraction(ctx.clientId, focus.paneId);
      return {};
    },
  });

  surface.register("workspace.close", {
    schema: WorkspaceCloseParams,
    handler: async (_ctx, params) => {
      await deps.session.closeWorkspace(params.workspaceId, params.closeLinkedWorktrees);
      return {};
    },
  });

  // 20260923-workspace-grouping（キーバインド用。delta 指定。`tab.move` と同じ形）。
  surface.register("workspace.move", {
    schema: WorkspaceMoveParams,
    handler: (_ctx, params) => {
      deps.session.moveWorkspace(params.workspaceId, params.direction);
      return {};
    },
  });

  // 20260923-workspace-grouping（D&D 用。anchor 指定。単一・グループ一括の両方を同じ経路で扱う）。
  surface.register("workspace.move_to", {
    schema: WorkspaceMoveToParams,
    handler: (_ctx, params) => {
      deps.session.moveWorkspacesTo(params.workspaceIds, params.beforeWorkspaceId);
      return {};
    },
  });
}
