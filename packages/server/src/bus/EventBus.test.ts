import { describe, expect, it } from "vitest";
import { EventBus } from "./EventBus.js";

describe("EventBus", () => {
  it("delivers a published event to all subscribers, in publish order", () => {
    const bus = new EventBus();
    const received: string[] = [];
    bus.subscribe((e) => received.push(`a:${e.event}`));
    bus.subscribe((e) => received.push(`b:${e.event}`));
    bus.publish({ event: "workspace.closed", data: { workspaceId: "w1" } });
    bus.publish({ event: "pane.closed", data: { paneId: "p1" } });
    expect(received).toEqual(["a:workspace.closed", "b:workspace.closed", "a:pane.closed", "b:pane.closed"]);
  });

  it("stops delivering after dispose", () => {
    const bus = new EventBus();
    const received: string[] = [];
    const sub = bus.subscribe((e) => received.push(e.event));
    bus.publish({ event: "pane.closed", data: { paneId: "p1" } });
    sub.dispose();
    bus.publish({ event: "pane.closed", data: { paneId: "p2" } });
    expect(received).toEqual(["pane.closed"]);
  });

  it("is safe when a listener unsubscribes itself during publish", () => {
    const bus = new EventBus();
    let calls = 0;
    const selfSub = bus.subscribe(() => {
      calls++;
      selfSub.dispose();
    });
    expect(() => bus.publish({ event: "pane.closed", data: { paneId: "p1" } })).not.toThrow();
    expect(calls).toBe(1);
    bus.publish({ event: "pane.closed", data: { paneId: "p2" } });
    expect(calls).toBe(1);
  });
});
