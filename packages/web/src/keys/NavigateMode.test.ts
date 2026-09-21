import { describe, expect, it } from "vitest";
import type { KeyInput } from "./actions.js";
import { NavigateMode } from "./NavigateMode.js";

function key(k: string): KeyInput {
  return { key: k, code: "", ctrl: false, alt: false, shift: false, meta: false, type: "keydown", composing: false };
}

describe("NavigateMode", () => {
  const mode = new NavigateMode();

  it("↑/↓ は workspace の選択（留まる）", () => {
    expect(mode.handle(key("ArrowUp"))).toEqual({ action: { type: "navigate", op: "up" } });
    expect(mode.handle(key("ArrowDown"))).toEqual({ action: { type: "navigate", op: "down" } });
  });

  it("h/j/k/l・←/→ は pane のフォーカス移動（留まる）", () => {
    expect(mode.handle(key("h"))).toEqual({ action: { type: "navigate", op: "paneDir", dir: "left" } });
    expect(mode.handle(key("j"))).toEqual({ action: { type: "navigate", op: "paneDir", dir: "down" } });
    expect(mode.handle(key("k"))).toEqual({ action: { type: "navigate", op: "paneDir", dir: "up" } });
    expect(mode.handle(key("l"))).toEqual({ action: { type: "navigate", op: "paneDir", dir: "right" } });
    expect(mode.handle(key("ArrowLeft"))).toEqual({ action: { type: "navigate", op: "paneDir", dir: "left" } });
    expect(mode.handle(key("ArrowRight"))).toEqual({ action: { type: "navigate", op: "paneDir", dir: "right" } });
  });

  it("Enter で決定して抜ける", () => {
    expect(mode.handle(key("Enter"))).toEqual({ action: { type: "navigate", op: "activate" }, exit: true });
  });

  it("Esc で取り消して抜ける", () => {
    expect(mode.handle(key("Escape"))).toEqual({ action: { type: "navigate", op: "cancel" }, exit: true });
  });

  it("割り当ての無いキーは何もしない（留まる）", () => {
    expect(mode.handle(key("a"))).toEqual({});
  });
});
