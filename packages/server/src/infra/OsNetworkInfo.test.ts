import { describe, expect, it } from "vitest";
import { OsNetworkInfo } from "./OsNetworkInfo.js";

describe("OsNetworkInfo", () => {
  it("includes the loopback address", () => {
    const info = new OsNetworkInfo();
    const addrs = info.addresses();
    expect(addrs.length).toBeGreaterThan(0);
    expect(addrs).toContain("127.0.0.1");
  });

  it("returns a non-empty hostname list", () => {
    const info = new OsNetworkInfo();
    expect(info.hostnames().length).toBeGreaterThan(0);
  });
});
