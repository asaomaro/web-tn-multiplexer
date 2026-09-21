import type { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TouchScroll } from "./TouchScroll.js";

const CELL_HEIGHT = 18;

function makeTerm(): Terminal & { scrollLines: ReturnType<typeof vi.fn> } {
  return { scrollLines: vi.fn() } as unknown as Terminal & { scrollLines: ReturnType<typeof vi.fn> };
}

function touchEvent(type: string, x: number, y: number, el: HTMLElement, count = 1): TouchEvent {
  const touches = Array.from({ length: count }, (_, i) => new Touch({ identifier: i, target: el, clientX: x, clientY: y }));
  return new TouchEvent(type, { touches: type === "touchend" ? [] : touches, changedTouches: touches, cancelable: true, bubbles: true });
}

let el: HTMLElement;
afterEach(() => {
  el?.remove();
});

function setup() {
  el = document.createElement("div");
  document.body.appendChild(el);
  const term = makeTerm();
  const scroll = new TouchScroll({ element: el, term, getCellSize: () => ({ width: 9, height: CELL_HEIGHT }) });
  return { el, term, scroll };
}

describe("TouchScroll — 縦方向", () => {
  it("指を上へ動かす（clientY が減る）と scrollLines に正の値を渡す（新しい内容へ進む）", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 - CELL_HEIGHT, el)); // 1 セル分、上へ
    expect(term.scrollLines).toHaveBeenCalledWith(1);
  });

  it("指を下へ動かす（clientY が増える）と scrollLines に負の値を渡す（scrollback を遡る）", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 + CELL_HEIGHT, el));
    expect(term.scrollLines).toHaveBeenCalledWith(-1);
  });

  it("1 セルに満たない移動では scrollLines を呼ばない", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 - (CELL_HEIGHT - 1), el));
    expect(term.scrollLines).not.toHaveBeenCalled();
  });

  it("複数回の touchmove の移動量を正しく積算する（端数を次回へ持ち越す）", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    const step = CELL_HEIGHT / 3;
    el.dispatchEvent(touchEvent("touchmove", 100, 200 + step, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 + step * 2, el));
    expect(term.scrollLines).not.toHaveBeenCalled(); // まだ 1 セルに満たない
    el.dispatchEvent(touchEvent("touchmove", 100, 200 + step * 3, el));
    expect(term.scrollLines).toHaveBeenCalledTimes(1);
    expect(term.scrollLines).toHaveBeenCalledWith(-1);
  });
});

describe("TouchScroll — 横方向・その他", () => {
  it("横方向優位のジェスチャは素通しする（scrollLines を呼ばない）", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    el.dispatchEvent(touchEvent("touchmove", 100 + CELL_HEIGHT * 2, 200 + 2, el)); // 横方向が圧倒的に大きい
    expect(term.scrollLines).not.toHaveBeenCalled();
  });

  it("2 本指（ピンチ等）は対象外", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el, 2));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 - CELL_HEIGHT * 2, el, 2));
    expect(term.scrollLines).not.toHaveBeenCalled();
  });

  it("touchend の後、新しい touchstart から改めて縦横を判定する", () => {
    const { el, term } = setup();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 - CELL_HEIGHT, el));
    expect(term.scrollLines).toHaveBeenCalledTimes(1);
    el.dispatchEvent(touchEvent("touchend", 100, 200 - CELL_HEIGHT, el));

    el.dispatchEvent(touchEvent("touchstart", 100, 300, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 300 - CELL_HEIGHT, el));
    expect(term.scrollLines).toHaveBeenCalledTimes(2);
  });

  it("dispose 後は touchmove を無視する", () => {
    const { el, term, scroll } = setup();
    scroll.dispose();
    el.dispatchEvent(touchEvent("touchstart", 100, 200, el));
    el.dispatchEvent(touchEvent("touchmove", 100, 200 - CELL_HEIGHT * 2, el));
    expect(term.scrollLines).not.toHaveBeenCalled();
  });
});
