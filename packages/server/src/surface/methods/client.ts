import { ClientDetachParams, ClientFitParams, ClientHelloParams, ClientViewParams } from "@wtm/protocol";
import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";

export function registerClientMethods(surface: ControlSurface, deps: MethodDeps): void {
  surface.register("client.hello", {
    schema: ClientHelloParams,
    handler: (ctx, params) => {
      deps.clients.setKind(ctx.clientId, params.kind);
      // hello し直して資格の無い種別（fit していないモバイル）に変わったら、持っている権限を手放す（D106）。
      deps.sizeAuthority.onKindChanged(ctx.clientId);
      return { clientId: ctx.clientId, snapshot: deps.session.snapshot() };
    },
  });

  surface.register("client.view", {
    schema: ClientViewParams,
    handler: (ctx, params) => {
      deps.clients.setView(ctx.clientId, params);
      deps.sizeAuthority.onViewChanged(ctx.clientId);
      return {};
    },
  });

  surface.register("client.fit", {
    schema: ClientFitParams,
    handler: (ctx, params) => {
      deps.clients.setFit(ctx.clientId, params.enabled);
      // 有効にしたら表示中の tab の権限を取り、無効にしたら持っている権限を手放す（D13・D106。以前は `onViewChanged` を
      // 呼ぶだけで、他のクライアントが持つ tab では取れず、無効にしても権限を持ち続けた）。
      deps.sizeAuthority.onFitChanged(ctx.clientId);
      return {};
    },
  });

  surface.register("client.detach", {
    schema: ClientDetachParams,
    // 実際に接続を閉じるのは WsGateway（このブラウザの接続だけを切る）。ここは受理するだけ。
    handler: () => ({}),
  });
}
