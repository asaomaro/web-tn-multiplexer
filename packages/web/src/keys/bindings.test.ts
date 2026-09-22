import { describe, expect, it } from "vitest";
import { expandRange, formatBinding, parseBinding } from "./chord.js";
import { ACTIONS, actionDef, actionFor, isActionId } from "./bindings.js";

describe("操作のカタログ（design「操作のカタログ」）", () => {
  it("34 個あり、id は重複しない・表示名は空でない", () => {
    expect(ACTIONS).toHaveLength(34);
    expect(new Set(ACTIONS.map((a) => a.id)).size).toBe(34);
    for (const a of ACTIONS) expect(a.label.length, a.id).toBeGreaterThan(0);
  });

  it("群は 全体 4・workspace / tab 12・pane 18（この順に並ぶ）", () => {
    const groups = ACTIONS.map((a) => a.group);
    expect(groups.filter((g) => g === "全体")).toHaveLength(4);
    expect(groups.filter((g) => g === "workspace / tab")).toHaveLength(12);
    expect(groups.filter((g) => g === "pane")).toHaveLength(18);
    // 群ごとにまとまっている（全体 → workspace / tab → pane）
    expect(groups.join(",")).toBe(
      [...groups]
        .sort(
          (a, b) =>
            ["全体", "workspace / tab", "pane"].indexOf(a) -
            ["全体", "workspace / tab", "pane"].indexOf(b),
        )
        .join(","),
    );
  });

  it("既定の割り当てはすべて `prefix+…` として読め、範囲になるのは範囲の操作（switch_tab）だけ", () => {
    for (const a of ACTIONS) {
      expect(a.defaults.length, a.id).toBeGreaterThan(0);
      for (const d of a.defaults) {
        const b = parseBinding(d);
        expect(b, `${a.id}: ${d}`).not.toBeNull();
        expect(b!.via, `${a.id}: ${d}`).toBe("prefix");
        expect(b!.range, `${a.id}: ${d}`).toBe(a.id === "switch_tab");
      }
    }
    const indexed = ACTIONS.filter((a) => "indexed" in a && a.indexed);
    expect(indexed.map((a) => a.id)).toEqual(["switch_tab"]);
  });

  it("既定の文字列は正規形（読んで書き出すと同じ。保存の「差」の比較に使う）", () => {
    for (const a of ACTIONS)
      for (const d of a.defaults) expect(formatBinding(parseBinding(d)!), `${a.id}: ${d}`).toBe(d);
  });

  it("既定の prefix の後のキー（範囲は 9 個に展開）は、操作をまたいで重ならない", () => {
    const seen = new Map<string, string>();
    for (const a of ACTIONS) {
      for (const d of a.defaults) {
        const b = parseBinding(d)!;
        for (const chord of b.range ? expandRange(b.chord) : [b.chord]) {
          expect(
            seen.get(chord),
            `${a.id} の ${chord} が ${seen.get(chord)} と重なる`,
          ).toBeUndefined();
          seen.set(chord, a.id);
        }
      }
    }
  });

  it("キー一覧に出さないのは swap の 4 つだけ（herdr のヘルプにも無い）", () => {
    expect(ACTIONS.filter((a) => "helpHidden" in a && a.helpHidden).map((a) => a.id)).toEqual([
      "swap_pane_left",
      "swap_pane_down",
      "swap_pane_up",
      "swap_pane_right",
    ]);
  });

  it("引くと実行する Action が、これまでの割り当てと同じ（代表）", () => {
    expect(actionFor(actionDef("split_vertical")!)).toEqual({ type: "split", dir: "right" });
    expect(actionFor(actionDef("split_horizontal")!)).toEqual({ type: "split", dir: "down" });
    expect(actionFor(actionDef("focus_pane_left")!)).toEqual({ type: "focusDir", dir: "left" });
    expect(actionFor(actionDef("swap_pane_up")!)).toEqual({ type: "swap", dir: "up" });
    expect(actionFor(actionDef("cycle_pane_previous")!)).toEqual({ type: "cyclePane", delta: -1 });
    expect(actionFor(actionDef("workspace_picker")!)).toEqual({
      type: "enterMode",
      mode: "navigate",
    });
    expect(actionFor(actionDef("resize_mode")!)).toEqual({ type: "enterMode", mode: "resize" });
    expect(actionFor(actionDef("copy_mode")!)).toEqual({ type: "enterMode", mode: "copy" });
    expect(actionFor(actionDef("open_notification_target")!)).toEqual({ type: "nextNotification" });
    expect(actionFor(actionDef("previous_tab")!)).toEqual({ type: "tabDelta", delta: -1 });
  });

  it("範囲の操作は数字から Action を作る。数字を省くと例外（呼ぶ側の誤り）・範囲でない操作は数字を見ない", () => {
    const def = actionDef("switch_tab")!;
    expect(actionFor(def, 3)).toEqual({ type: "tabIndex", index: 3 });
    expect(actionFor(def, 9)).toEqual({ type: "tabIndex", index: 9 });
    expect(() => actionFor(def)).toThrow(/switch_tab/);
    expect(actionFor(actionDef("zoom")!, 5)).toEqual({ type: "zoom" });
    expect(actionFor(actionDef("zoom")!)).toEqual({ type: "zoom" });
  });

  it("範囲の操作かどうか（indexed）と action の形が食い違う定義はない", () => {
    for (const a of ACTIONS)
      expect(typeof a.action === "function", a.id).toBe("indexed" in a && a.indexed === true);
  });

  it("isActionId / actionDef はカタログにある名前だけを通す（壊れた保存値を弾く）", () => {
    expect(isActionId("split_vertical")).toBe(true);
    expect(isActionId("reload_config")).toBe(false); // 後続の案内（NOT_YET）はカタログの外
    expect(isActionId(42)).toBe(false);
    expect(isActionId(undefined)).toBe(false);
    expect(actionDef("bogus")).toBeUndefined();
    expect(actionDef("goto")?.label).toBe("goto（workspace・tab・pane から探す）");
  });
});
