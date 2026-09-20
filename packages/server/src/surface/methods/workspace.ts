import { WorkspaceCloseParams, WorkspaceCreateParams, WorkspaceFocusParams, WorkspaceRenameParams } from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerWorkspaceMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("workspace.create", {
    schema: WorkspaceCreateParams,
    handler: (_ctx, params) => deps.session.createWorkspace(params.cwd, params.label),
  });

  surface.register("workspace.rename", {
    schema: WorkspaceRenameParams,
    handler: (_ctx, params) => {
      deps.session.renameWorkspace(params.workspaceId, params.label);
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
