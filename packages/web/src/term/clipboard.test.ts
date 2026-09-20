import { afterEach, describe, expect, it, vi } from "vitest";
import { readClipboard, writeClipboard } from "./clipboard.js";

describe("clipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writeClipboard: 成功すれば true", async () => {
    const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await expect(writeClipboard("hello")).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith("hello");
  });

  it("writeClipboard: 失敗（権限の拒否等）すれば true を返さず例外も投げない", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    await expect(writeClipboard("hello")).resolves.toBe(false);
  });

  it("readClipboard: 成功すればテキストを返す", async () => {
    vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("pasted");
    await expect(readClipboard()).resolves.toBe("pasted");
  });

  it("readClipboard: 失敗すれば null", async () => {
    vi.spyOn(navigator.clipboard, "readText").mockRejectedValue(new Error("denied"));
    await expect(readClipboard()).resolves.toBeNull();
  });
});
