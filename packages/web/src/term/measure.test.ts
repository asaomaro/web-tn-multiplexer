import { describe, expect, it } from "vitest";
import { measure } from "./measure.js";

describe("measure", () => {
  it("切り捨てて cols/rows を求める", () => {
    expect(measure(800, 480, { width: 9, height: 18 })).toEqual({ cols: 88, rows: 26 });
  });

  it("割り切れないときは余りを切り捨てる", () => {
    expect(measure(805, 485, { width: 9, height: 18 })).toEqual({ cols: 89, rows: 26 });
  });

  it("枠がセルより小さくても最低 1 を返す", () => {
    expect(measure(1, 1, { width: 9, height: 18 })).toEqual({ cols: 1, rows: 1 });
    expect(measure(0, 0, { width: 9, height: 18 })).toEqual({ cols: 1, rows: 1 });
  });
});
