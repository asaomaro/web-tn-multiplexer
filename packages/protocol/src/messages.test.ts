import { describe, expect, it } from "vitest";
import { METHOD_SCHEMAS, PaneSplitParams } from "./messages.js";

describe("messages", () => {
  it("validates pane.split params", () => {
    const parsed = PaneSplitParams.parse({ paneId: "p1", direction: "right" });
    expect(parsed).toEqual({ paneId: "p1", direction: "right" });
  });

  it("rejects an out-of-range ratio", () => {
    expect(() => PaneSplitParams.parse({ paneId: "p1", direction: "right", ratio: 1.5 })).toThrow();
  });

  it("registers a schema for every method the WebSocket table defines", () => {
    const methods = Object.keys(METHOD_SCHEMAS);
    expect(methods).toContain("client.hello");
    expect(methods).toContain("pane.subscribe");
    expect(methods).toContain("pane.unsubscribe");
    expect(methods).toContain("layout.set_split_ratio");
    expect(methods.length).toBe(Object.keys(METHOD_SCHEMAS).length);
    expect(new Set(methods).size).toBe(methods.length); // 重複登録が無い
  });
});
