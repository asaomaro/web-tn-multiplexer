import { describe, expect, it } from "vitest";
import { DefaultClientRegistry } from "./ClientRegistry.js";

describe("DefaultClientRegistry", () => {
  it("registers a client with defaults and forgets it on unregister", () => {
    const reg = new DefaultClientRegistry();
    const id = reg.register("desktop");
    expect(reg.get(id)).toMatchObject({ id, kind: "desktop", fit: false, view: null, subscriptions: new Set(), theme: null, lastActedAt: 0 });
    reg.unregister(id);
    expect(reg.get(id)).toBeUndefined();
  });

  it("registers with a default kind of 'desktop', settable later via setKind (client.hello arrives after register)", () => {
    const reg = new DefaultClientRegistry();
    const id = reg.register();
    expect(reg.get(id)?.kind).toBe("desktop");
    reg.setKind(id, "mobile");
    expect(reg.get(id)?.kind).toBe("mobile");
  });

  it("issues distinct ids for each registration", () => {
    const reg = new DefaultClientRegistry();
    const a = reg.register("desktop");
    const b = reg.register("mobile");
    expect(a).not.toBe(b);
  });

  it("setView / setFit / touch update the record in place", () => {
    const reg = new DefaultClientRegistry();
    const id = reg.register("mobile");
    const view = { workspaceId: "w1", tabId: "t1", visible: [{ paneId: "p1", cols: 80, rows: 24 }] };
    reg.setView(id, view);
    reg.setFit(id, true);
    const before = reg.get(id)!.lastInteractionAt;
    reg.touch(id);
    expect(reg.get(id)).toMatchObject({ view, fit: true });
    expect(reg.get(id)!.lastActedAt, "touch は最後に操作した時刻も進める（接続しただけでは 0）").toBe(reg.get(id)!.lastInteractionAt);
    expect(reg.get(id)!.lastInteractionAt).toBeGreaterThanOrEqual(before);
  });

  it("setTheme は表示しているテーマをクライアントごとに覚える（20260921-theme-settings）", () => {
    const reg = new DefaultClientRegistry();
    const id = reg.register("desktop");
    const other = reg.register("mobile");
    reg.setTheme(id, "catppuccin-latte");
    expect(reg.get(id)?.theme).toBe("catppuccin-latte");
    expect(reg.get(other)?.theme).toBeNull();
    reg.setTheme(id, "nord");
    expect(reg.get(id)?.theme).toBe("nord");
  });

  it("tracks subscriptions per client, add/remove independently", () => {
    const reg = new DefaultClientRegistry();
    const id = reg.register("desktop");
    reg.addSubscription(id, "p1");
    reg.addSubscription(id, "p2");
    expect(reg.subscriptions(id).sort()).toEqual(["p1", "p2"]);
    reg.removeSubscription(id, "p1");
    expect(reg.subscriptions(id)).toEqual(["p2"]);
  });

  it("operations on an unknown client id are no-ops, not errors", () => {
    const reg = new DefaultClientRegistry();
    expect(() => reg.setFit("nope", true)).not.toThrow();
    expect(() => reg.touch("nope")).not.toThrow();
    expect(() => reg.setTheme("nope", "nord")).not.toThrow();
    expect(reg.get("nope")).toBeUndefined(); // 知らない id で record を作らない
    expect(reg.subscriptions("nope")).toEqual([]);
  });

  it("list() returns all currently registered clients", () => {
    const reg = new DefaultClientRegistry();
    const a = reg.register("desktop");
    const b = reg.register("mobile");
    expect(reg.list().map((c) => c.id).sort()).toEqual([a, b].sort());
  });
});
