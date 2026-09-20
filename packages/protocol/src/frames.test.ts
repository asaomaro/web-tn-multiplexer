import { describe, expect, it } from "vitest";
import { decodeFrame, encodeInputFrame, encodeOutputFrame, encodeSnapshotFrame, FRAME_TYPE } from "./frames.js";

describe("frames", () => {
  it("round-trips an OUTPUT frame", () => {
    const chunk = new TextEncoder().encode("hello\r\n\x1b[32m色\x1b[0m");
    const frame = encodeOutputFrame("p12", chunk);
    const decoded = decodeFrame(frame);
    expect(decoded.type).toBe(FRAME_TYPE.OUTPUT);
    if (decoded.type !== FRAME_TYPE.OUTPUT) throw new Error("unreachable");
    expect(decoded.paneId).toBe("p12");
    expect(new TextDecoder().decode(decoded.chunk)).toBe("hello\r\n\x1b[32m色\x1b[0m");
  });

  it("round-trips a SNAPSHOT frame with cols/rows", () => {
    const frame = encodeSnapshotFrame("p1", 120, 40, "全角と\r\nscrollback");
    const decoded = decodeFrame(frame);
    expect(decoded.type).toBe(FRAME_TYPE.SNAPSHOT);
    if (decoded.type !== FRAME_TYPE.SNAPSHOT) throw new Error("unreachable");
    expect(decoded.cols).toBe(120);
    expect(decoded.rows).toBe(40);
    expect(decoded.text).toBe("全角と\r\nscrollback");
  });

  it("round-trips an INPUT frame", () => {
    const bytes = new TextEncoder().encode("\x02");
    const frame = encodeInputFrame("p3", bytes);
    const decoded = decodeFrame(frame);
    expect(decoded.type).toBe(FRAME_TYPE.INPUT);
    if (decoded.type !== FRAME_TYPE.INPUT) throw new Error("unreachable");
    expect(decoded.paneId).toBe("p3");
    expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes));
  });

  it("rejects a pane id longer than 255 bytes", () => {
    expect(() => encodeOutputFrame("p".repeat(256), new Uint8Array())).toThrow(RangeError);
  });

  it("throws on a truncated frame", () => {
    expect(() => decodeFrame(new Uint8Array([FRAME_TYPE.OUTPUT]))).toThrow(RangeError);
    expect(() => decodeFrame(new Uint8Array([FRAME_TYPE.OUTPUT, 5, 1, 2]))).toThrow(RangeError);
  });
});
