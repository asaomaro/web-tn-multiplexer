import type { LayoutNode } from "@wtm/protocol";
import { describe, expect, it } from "vitest";
import {
  cycleOrder,
  findSplit,
  leaves,
  neighbor,
  remove,
  resizeBy,
  setRatio,
  split,
  swap,
} from "./LayoutTree.js";

const pane = (id: string): LayoutNode => ({ type: "pane", paneId: id });

describe("LayoutTree", () => {
  it("splits a single pane into two", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1");
    expect(node).toEqual({
      type: "split",
      id: "s1",
      dir: "right",
      ratio: 0.5,
      a: { type: "pane", paneId: "p1" },
      b: { type: "pane", paneId: "p2" },
    });
    expect(leaves(node)).toEqual(["p1", "p2"]);
  });

  it("splits the correct pane when nested", () => {
    let node = split(pane("p1"), "p1", "right", "p2", "s1");
    node = split(node, "p2", "down", "p3", "s2");
    expect(leaves(node)).toEqual(["p1", "p2", "p3"]);
    expect(findSplit(node, "s2")).not.toBeNull();
  });

  it("removes a pane and collapses the parent split", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1");
    const removed = remove(node, "p2");
    expect(removed).toEqual({ type: "pane", paneId: "p1" });
  });

  it("removes the last pane returns null", () => {
    expect(remove(pane("p1"), "p1")).toBeNull();
  });

  it("collapses a deeper split correctly, keeping the untouched sibling", () => {
    let node = split(pane("p1"), "p1", "right", "p2", "s1");
    node = split(node, "p2", "down", "p3", "s2");
    // p2/p3 の split (s2) から p2 を消すと、s2 は p3 に潰れ、s1.b は p3 になる。
    const removed = remove(node, "p2");
    expect(removed).toEqual({
      type: "split",
      id: "s1",
      dir: "right",
      ratio: 0.5,
      a: { type: "pane", paneId: "p1" },
      b: { type: "pane", paneId: "p3" },
    });
  });

  it("swaps two panes by position", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1");
    const swapped = swap(node, "p1", "p2");
    expect(leaves(swapped)).toEqual(["p2", "p1"]);
  });

  it("sets and clamps the split ratio", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1");
    expect(setRatio(node, "s1", 0.7)).toMatchObject({ ratio: 0.7 });
    expect(setRatio(node, "s1", 0.99)).toMatchObject({ ratio: 0.95 });
    expect(setRatio(node, "s1", 0.0)).toMatchObject({ ratio: 0.05 });
  });

  it("cycles through panes forward and backward, wrapping at the ends", () => {
    let node = split(pane("p1"), "p1", "right", "p2", "s1");
    node = split(node, "p2", "down", "p3", "s2");
    expect(cycleOrder(node, "p1", 1)).toBe("p2");
    expect(cycleOrder(node, "p3", 1)).toBe("p1"); // 端で反対側へ回る
    expect(cycleOrder(node, "p1", -1)).toBe("p3");
  });

  it("finds a directional neighbor across a right split", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1");
    expect(neighbor(node, "p1", "right")).toBe("p2");
    expect(neighbor(node, "p2", "left")).toBe("p1");
    expect(neighbor(node, "p1", "down")).toBeNull(); // 軸が違う
  });

  it("finds a directional neighbor across a down split", () => {
    const node = split(pane("p1"), "p1", "down", "p2", "s1");
    expect(neighbor(node, "p1", "down")).toBe("p2");
    expect(neighbor(node, "p2", "up")).toBe("p1");
  });

  it("resizeBy grows the correct side for the matching axis", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1"); // ratio 0.5, a=p1 b=p2
    const grown = resizeBy(node, "p1", "right", 0.1);
    expect(grown).toMatchObject({ ratio: 0.6 }); // p1(a) を右へ広げる = a の比率を増やす
    const shrunk = resizeBy(node, "p1", "left", 0.1);
    expect(shrunk).toMatchObject({ ratio: 0.4 });
  });

  it("resizeBy is a no-op when the axis does not match", () => {
    const node = split(pane("p1"), "p1", "right", "p2", "s1");
    expect(resizeBy(node, "p1", "up", 0.1)).toEqual(node);
  });
});
