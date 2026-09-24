import { describe, expect, it } from "vitest";
import { formatId, parseId } from "./ids.js";

describe("ids", () => {
  it("formats an id from kind and number", () => {
    expect(formatId("w", 1)).toBe("w1");
    expect(formatId("p", 12)).toBe("p12");
  });

  it("parses a well-formed id", () => {
    expect(parseId("w1")).toEqual({ kind: "w", n: 1 });
    expect(parseId("p12")).toEqual({ kind: "p", n: 12 });
    expect(parseId("s4")).toEqual({ kind: "s", n: 4 });
    expect(parseId("g3")).toEqual({ kind: "g", n: 3 }); // 手動グループ（20260923-workspace-grouping）
  });

  it("rejects malformed or unknown-kind ids", () => {
    expect(parseId("")).toBeNull();
    expect(parseId("w0")).toBeNull(); // 先頭の 0 は許さない（採番は 1 始まりの想定）
    expect(parseId("x1")).toBeNull(); // 未知の種類
    expect(parseId("w")).toBeNull();
    expect(parseId("1w")).toBeNull();
  });
});
