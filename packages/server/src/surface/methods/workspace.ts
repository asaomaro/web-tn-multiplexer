import {
  WorkspaceCloseParams,
  WorkspaceCreateParams,
  WorkspaceFocusParams,
  WorkspaceRenameParams,
} from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerWorkspaceMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("workspace.create", {
    schema: WorkspaceCreateParams,
    handler: (_ctx, params) =>
      deps.session.createWorkspace(params.cwd, params.label, params.newCwd),
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
      await deps.session.closeWorkspace(params.workspaceId);
      return {};
    },
  });
}
