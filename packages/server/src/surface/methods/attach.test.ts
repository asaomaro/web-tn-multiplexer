import type { HostInfo, ServerEvent } from "@wtm/protocol";
import { describe, expect, it } from "vitest";
import type { Disposable } from "../../util/Disposable.js";
import { MemoryLogger } from "../../log/Logger.js";
import { EventBus } from "../../bus/EventBus.js";
import type { CreatePaneOptions, TerminalManager } from "../../terminal/TerminalManager.js";
import type { TerminalHost } from "../../terminal/TerminalHost.js";
import type { PersistScheduler } from "../../session/PersistScheduler.js";
import { SessionModel } from "../../session/SessionModel.js";
import { SessionService } from "../../session/SessionService.js";
import { DefaultClientRegistry } from "../../clients/ClientRegistry.js";
import { DefaultSizeAuthority } from "../../clients/SizeAuthority.js";
import type { ClientSink } from "../../terminal/OutputFanout.js";
import { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";
import { registerAttachMethods } from "./attach.js";

/** 方式の登録だけを見る（20260926-pane-direct-connect）。所有者の規則そのものは `SizeAuthority.test.ts`。 */
class SizedHost implements TerminalHost {
  readonly pid = 1;
  readonly mirror = {} as TerminalHost["mirror"];
  readonly fanout = {} as TerminalHost["fanout"];
  constructor(readonly paneId: string) {}
  write(): void {}
  writeModal(): Promise<void> {
    return Promise.resolve();
  }
  resize(): void {}
  lastOutputAt(): number {
    return Date.now();
  }
  onExit(): Disposable {
    return { dispose: () => undefined };
  }
  dispose(): void {}
}
class SizedTerminals implements TerminalManager {
  private readonly hosts = new Map<string, SizedHost>();
  create(paneId: string, _opts: CreatePaneOptions): TerminalHost {
    const host = new SizedHost(paneId);
    this.hosts.set(paneId, host);
    return host;
  }
  get(paneId: string): TerminalHost | undefined {
    return this.hosts.get(paneId);
  }
  resize(): void {}
  dispose(paneId: string): void {
    this.hosts.delete(paneId);
  }
}
class NoopPersist implements PersistScheduler {
  touch(): void {}
  async flush(): Promise<void> {}
  cancel(): void {}
}

const HOST_INFO: HostInfo = { os: "linux", windowsBuild: null, hostname: "test" };
const sink = (clientId: string): ClientSink => ({
  clientId,
  sendOutput: () => undefined,
  sendSnapshot: () => undefined,
  bufferedAmount: 0,
});

async function makeContext() {
  const bus = new EventBus();
  const published: ServerEvent[] = [];
  bus.subscribe((e) => published.push(e));
  const session = new SessionService({
    model: new SessionModel(),
    terminals: new SizedTerminals(),
    bus,
    persist: new NoopPersist(),
    serverVersion: "test",
    host: HOST_INFO,
    scrollbackLines: 1000,
    spawnGraceMs: 1,
    defaultCwd: "/home/u",
    logger: new MemoryLogger(),
  });
  const clients = new DefaultClientRegistry();
  const sizeAuthority = new DefaultSizeAuthority(clients, session, bus);
  const surface = new ControlSurface(new MemoryLogger());
  registerAttachMethods(surface, { session, clients, sizeAuthority } as unknown as MethodDeps);
  const { pane } = await session.createWorkspace("/home/u", "w");
  return { session, clients, sizeAuthority, surface, published, paneId: pane.id };
}

describe("pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect）", () => {
  it("pane.attach は大きさを当てて当てた大きさを返し、pane.attach_changed を出す（AC3）", async () => {
    const ctx = await makeContext();
    const a = ctx.clients.register("external");

    const res = await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 131,
      rows: 43,
    });

    expect(res).toEqual({ ok: true, result: { cols: 131, rows: 43 } });
    expect(ctx.sizeAuthority.attachOwner(ctx.paneId)).toBe(a);
    expect(ctx.published).toContainEqual({
      event: "pane.attach_changed",
      data: { paneId: ctx.paneId, clientId: a },
    });
    expect(ctx.published).toContainEqual({
      event: "pane.size_changed",
      data: { paneId: ctx.paneId, cols: 131, rows: 43 },
    });
  });

  it("別の所有者がいれば pane_attached を方式のエラーとして返し、takeover で奪える（AC8・AC9）", async () => {
    const ctx = await makeContext();
    const a = ctx.clients.register("external");
    const b = ctx.clients.register("external");
    await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 120,
      rows: 40,
    });

    const refused = await ctx.surface.invoke({ clientId: b, sink: sink(b) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 80,
      rows: 24,
    });
    expect(refused).toEqual({
      ok: false,
      error: { code: "pane_attached", message: expect.stringContaining("--takeover") },
    });
    expect(ctx.sizeAuthority.attachOwner(ctx.paneId)).toBe(a);

    const taken = await ctx.surface.invoke({ clientId: b, sink: sink(b) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 80,
      rows: 24,
      takeover: true,
    });
    expect(taken).toEqual({ ok: true, result: { cols: 80, rows: 24 } });
    expect(ctx.sizeAuthority.attachOwner(ctx.paneId)).toBe(b);
  });

  it("pane.attach_resize は所有者なら大きさを変え、所有者でなければ not_attached（AC3）", async () => {
    const ctx = await makeContext();
    const a = ctx.clients.register("external");
    const b = ctx.clients.register("external");
    await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 120,
      rows: 40,
    });

    expect(
      await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.attach_resize", {
        paneId: ctx.paneId,
        cols: 100,
        rows: 30,
      }),
    ).toEqual({ ok: true, result: {} });
    expect(ctx.session.getPane(ctx.paneId)).toMatchObject({ cols: 100, rows: 30 });
    const denied = await ctx.surface.invoke({ clientId: b, sink: sink(b) }, "pane.attach_resize", {
      paneId: ctx.paneId,
      cols: 10,
      rows: 10,
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.error.code).toBe("not_attached");
    expect(ctx.session.getPane(ctx.paneId)).toMatchObject({ cols: 100, rows: 30 });
  });

  it("pane.detach は所有者なら直結を終え、所有者でない・pane が無いときは何もせず成功する", async () => {
    const ctx = await makeContext();
    const a = ctx.clients.register("external");
    const b = ctx.clients.register("external");
    await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 120,
      rows: 40,
    });

    expect(
      await ctx.surface.invoke({ clientId: b, sink: sink(b) }, "pane.detach", {
        paneId: ctx.paneId,
      }),
    ).toEqual({ ok: true, result: {} });
    expect(ctx.sizeAuthority.attachOwner(ctx.paneId)).toBe(a);
    expect(
      await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.detach", { paneId: "p999" }),
    ).toEqual({ ok: true, result: {} });
    expect(
      await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.detach", {
        paneId: ctx.paneId,
      }),
    ).toEqual({ ok: true, result: {} });
    expect(ctx.sizeAuthority.attachOwner(ctx.paneId)).toBeNull();
    expect(ctx.published.at(-1)).toEqual({
      event: "pane.attach_changed",
      data: { paneId: ctx.paneId, clientId: null },
    });
  });

  it("存在しない pane への attach・attach_resize は not_found で、所有者を作らない", async () => {
    const ctx = await makeContext();
    const a = ctx.clients.register("external");
    for (const method of ["pane.attach", "pane.attach_resize"] as const) {
      const res = await ctx.surface.invoke({ clientId: a, sink: sink(a) }, method, {
        paneId: "p999",
        cols: 80,
        rows: 24,
      });
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("unreachable");
      expect(res.error.code).toBe("not_found");
    }
    expect(ctx.sizeAuthority.attachOwner("p999")).toBeNull();
    expect(ctx.published.filter((e) => e.event === "pane.attach_changed")).toEqual([]);
  });

  it("大きさが正の整数でなければ invalid_params", async () => {
    const ctx = await makeContext();
    const a = ctx.clients.register("external");
    const res = await ctx.surface.invoke({ clientId: a, sink: sink(a) }, "pane.attach", {
      paneId: ctx.paneId,
      cols: 0,
      rows: 24,
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.code).toBe("invalid_params");
  });
});
