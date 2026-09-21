import { PaneSubscribeParams, PaneUnsubscribeParams, RpcError } from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerSubscribeMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("pane.subscribe", {
    schema: PaneSubscribeParams,
    handler: (ctx, params) => {
      const host = deps.terminals.get(params.paneId);
      const pane = deps.session.getPane(params.paneId);
      if (!host || !pane) throw new RpcError("not_found", `pane not found: ${params.paneId}`);
      deps.clients.addSubscription(ctx.clientId, params.paneId);
      host.fanout.subscribe(ctx.sink, params.scrollbackLines);
      return { cols: pane.cols, rows: pane.rows };
    },
  });

  surface.register("pane.unsubscribe", {
    schema: PaneUnsubscribeParams,
    handler: (ctx, params) => {
      deps.clients.removeSubscription(ctx.clientId, params.paneId);
      deps.terminals.get(params.paneId)?.fanout.unsubscribe(ctx.clientId);
      return {};
    },
  });
}
