import { TabCloseParams, TabCreateParams, TabFocusParams, TabRenameParams } from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerTabMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("tab.create", {
    schema: TabCreateParams,
    handler: (_ctx, params) => deps.session.createTab(params.workspaceId, params.label),
  });

  surface.register("tab.rename", {
    schema: TabRenameParams,
    handler: (_ctx, params) => {
      deps.session.renameTab(params.tabId, params.label);
      return {};
    },
  });

  surface.register("tab.focus", {
    schema: TabFocusParams,
    handler: (ctx, params) => {
      deps.session.focusTab(params.tabId);
      const focusedPaneId = deps.session.getTab(params.tabId)?.focusedPaneId;
      if (focusedPaneId) deps.sizeAuthority.noteInteraction(ctx.clientId, focusedPaneId);
      return {};
    },
  });

  surface.register("tab.close", {
    schema: TabCloseParams,
    handler: async (_ctx, params) => {
      await deps.session.closeTab(params.tabId);
      return {};
    },
  });
}
