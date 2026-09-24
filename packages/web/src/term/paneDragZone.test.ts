import { describe, expect, it } from "vitest";
import { zoneAt } from "./paneDragZone.js";

// 100x100 の矩形（left=0, top=0）を基準にする。EDGE_RATIO=0.3 なので、0〜30 が縁、30〜70 が中央。
const rect = { left: 0, top: 0, width: 100, height: 100 };

describe("zoneAt", () => {
  it("中央は center", () => {
    expect(zoneAt(rect, 50, 50)).toBe("center");
  });

  it("左端は left（縦位置に関わらず、左右を先に判定）", () => {
    expect(zoneAt(rect, 10, 50)).toBe("left");
    expect(zoneAt(rect, 10, 10)).toBe("left"); // 左上の角も left（左右優先の tie-break）
  });

  it("右端は right", () => {
    expect(zoneAt(rect, 90, 50)).toBe("right");
  });

  it("上端は top（中央の列で）", () => {
    expect(zoneAt(rect, 50, 10)).toBe("top");
  });

  it("下端は bottom（中央の列で）", () => {
    expect(zoneAt(rect, 50, 90)).toBe("bottom");
  });

  it("矩形の左上に原点が無くても相対座標で判定する", () => {
    const offsetRect = { left: 200, top: 300, width: 100, height: 100 };
    expect(zoneAt(offsetRect, 210, 350)).toBe("left"); // 200+10, 300+50
    expect(zoneAt(offsetRect, 250, 350)).toBe("center");
  });

  it("矩形の大きさが違っても割合で判定する", () => {
    const wide = { left: 0, top: 0, width: 1000, height: 100 };
    expect(zoneAt(wide, 100, 50)).toBe("left"); // 10% < 30%
    expect(zoneAt(wide, 500, 50)).toBe("center");
  });
});
