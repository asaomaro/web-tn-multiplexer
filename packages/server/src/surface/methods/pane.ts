import {
  PaneCloseParams,
  PaneFocusDirectionParams,
  PaneFocusParams,
  PaneInputSetParams,
  PaneRenameParams,
  PaneResizeParams,
  PaneSplitParams,
  PaneSwapParams,
  PaneSwapWithParams,
  PaneZoomParams,
} from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerPaneMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("pane.split", {
    schema: PaneSplitParams,
    handler: async (ctx, params) => {
      deps.clients.touch(ctx.clientId); // 起動の猶予より前に（色の問い合わせの答え。20260921-theme-settings の decisions D13）
      const result = await deps.session.splitPane(
        params.paneId,
        params.direction,
        params.ratio,
        params.newCwd,
      );
      deps.sizeAuthority.noteInteraction(ctx.clientId, result.pane.id);
      return result;
    },
  });

  surface.register("pane.close", {
    schema: PaneCloseParams,
    handler: async (_ctx, params) => {
      await deps.session.closePane(params.paneId);
      return {};
    },
  });

  surface.register("pane.focus", {
    schema: PaneFocusParams,
    handler: (ctx, params) => {
      // 未知の paneId は `SessionModel.focusPane`（内部の `requirePane`）が投げる `NotFoundError` を
      // `ControlSurface.invoke` が `not_found` に読み替える（レビュー指摘。個別ガードは不要になった）。
      deps.session.focusPane(params.paneId);
      deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);
      return {};
    },
  });

  surface.register("pane.rename", {
    schema: PaneRenameParams,
    handler: (_ctx, params) => {
      deps.session.renamePane(params.paneId, params.label);
      return {};
    },
  });

  surface.register("pane.focus_direction", {
    schema: PaneFocusDirectionParams,
    handler: (ctx, params) => {
      const target = deps.session.focusPaneDirection(params.paneId, params.direction);
      deps.sizeAuthority.noteInteraction(ctx.clientId, target);
      return { paneId: target };
    },
  });

  surface.register("pane.swap", {
    schema: PaneSwapParams,
    handler: (ctx, params) => {
      const other = deps.session.swapPane(params.paneId, params.direction);
      deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);
      return { paneId: other };
    },
  });

  surface.register("pane.swap_with", {
    schema: PaneSwapWithParams,
    handler: (ctx, params) => {
      const ok = deps.session.swapPaneWith(params.paneId, params.otherPaneId);
      deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);
      return { ok };
    },
  });

  surface.register("pane.zoom", {
    schema: PaneZoomParams,
    handler: (ctx, params) => {
      deps.session.zoomPane(params.paneId, params.mode);
      deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);
      return {};
    },
  });

  surface.register("pane.resize", {
    schema: PaneResizeParams,
    handler: (ctx, params) => {
      deps.session.resizePaneByDirection(params.paneId, params.direction, params.amount);
      deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);
      return {};
    },
  });

  surface.register("pane.input.set", {
    schema: PaneInputSetParams,
    handler: (_ctx, params) => {
      deps.session.setPaneRightClick(params.paneId, params.rightClick);
      return {};
    },
  });
}
