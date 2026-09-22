import { describe, expect, it } from "vitest";
import {
  emptyKeyPrefs,
  loadKeyPrefs,
  loadPrefix,
  normalizeBinding,
  parsePrefix,
  serializeKeyPrefs,
  withBindings,
  withoutBindings,
  withPrefix,
} from "./keyPrefs.js";

describe("loadPrefix / parsePrefix — 保存された prefix（AC3・AC8）", () => {
  it("端末へ送れる形は正規形にして読む（別名も受ける）", () => {
    expect(loadPrefix("ctrl+a")).toBe("ctrl+a");
    expect(loadPrefix("Control+A")).toBeNull(); // 大文字 A は shift+a＝ctrl+shift+a は送れない
    expect(loadPrefix("control+a")).toBe("ctrl+a");
    expect(loadPrefix("alt+b")).toBe("alt+b");
    expect(loadPrefix("f5")).toBe("f5");
    expect(loadPrefix("ctrl+alt+b")).toBe("ctrl+alt+b");
  });

  it("既定と同じ値は null（差が無い）。parsePrefix は正規形を返す", () => {
    expect(loadPrefix("ctrl+b")).toBeNull();
    expect(parsePrefix("ctrl+b")).toBe("ctrl+b");
  });

  it("読めない・送れない形・文字列でない値は無効（既定へ）", () => {
    for (const bad of [
      "",
      "b",
      "cmd+b",
      "ctrl+tab",
      "shift+f5",
      "ctrl+shift+a",
      "meta+b",
      42,
      null,
      undefined,
      {},
      ["ctrl+a"],
    ]) {
      expect(parsePrefix(bad), String(bad)).toBeUndefined();
      expect(loadPrefix(bad), String(bad)).toBeNull();
    }
  });
});

describe("normalizeBinding — 操作ごとの有効な割り当て", () => {
  it("prefix の後のキー・直接のキーを正規形にする", () => {
    expect(normalizeBinding("split_vertical", "prefix+v")).toBe("prefix+v");
    expect(normalizeBinding("split_horizontal", "prefix+minus")).toBe("prefix+-");
    expect(normalizeBinding("focus_pane_left", "Ctrl+Alt+H")).toBe("ctrl+alt+shift+h");
    expect(normalizeBinding("zoom", "prefix+H")).toBe("prefix+shift+h");
  });

  it("直接のキーは「ctrl・alt・cmd を含む chord か F キー」だけ（AC5）", () => {
    for (const bad of ["v", "shift+v", "tab", "enter", "left", "?"])
      expect(normalizeBinding("zoom", bad), bad).toBeNull();
    for (const ok of ["ctrl+z", "alt+z", "cmd+z", "f5", "ctrl+tab"])
      expect(normalizeBinding("zoom", ok), ok).toBe(ok);
  });

  it("範囲は範囲の操作（switch_tab）でだけ・範囲の操作は範囲でだけ（AC7）", () => {
    expect(normalizeBinding("switch_tab", "prefix+alt+1..9")).toBe("prefix+alt+1..9");
    expect(normalizeBinding("switch_tab", "ctrl+alt+1..9")).toBe("ctrl+alt+1..9");
    expect(normalizeBinding("switch_tab", "1..9")).toBeNull(); // 直接で修飾なし
    expect(normalizeBinding("switch_tab", "prefix+v")).toBeNull();
    expect(normalizeBinding("zoom", "prefix+1..9")).toBeNull();
    expect(normalizeBinding("switch_tab", "prefix+shift+1..9")).toBeNull();
  });

  it("読めない・文字列でない値は null", () => {
    for (const bad of ["", "prefix+", "prefix+meta+a", "prefix+İ", "alt+İ", 42, null, undefined])
      expect(normalizeBinding("zoom", bad), String(bad)).toBeNull();
  });
});

describe("loadKeyPrefs — 壊れた保存値は値ごとに落とす（AC8）", () => {
  it("形が違えば空（既定）", () => {
    for (const raw of [undefined, null, 42, "x", [], true])
      expect(loadKeyPrefs(raw), String(raw)).toEqual(emptyKeyPrefs());
  });

  it("正しい上書きを読む（正規形になる）", () => {
    const p = loadKeyPrefs({
      prefix: "ctrl+a",
      bindings: {
        split_vertical: ["prefix+|"],
        next_tab: ["prefix+n", "ctrl+alt+]"],
        switch_tab: ["prefix+alt+1..9"],
      },
    });
    expect(p.prefix).toBe("ctrl+a");
    expect(p.bindings).toEqual({
      split_vertical: ["prefix+|"],
      next_tab: ["prefix+n", "ctrl+alt+]"],
      switch_tab: ["prefix+alt+1..9"],
    });
  });

  it("未知の操作・配列でない値・文字列でない要素・不正な文字列・重複を落とし、残りを生かす", () => {
    const p = loadKeyPrefs({
      prefix: "ctrl+a",
      bindings: {
        bogus_action: ["prefix+v"], // 未知の操作
        zoom: "prefix+z", // 配列でない
        goto: ["prefix+g", 42, null, "prefix+meta+x", "ctrl+g", "ctrl+g"], // 一部だけ有効・重複
        detach: ["prefix+q", "q"], // 直接の "q" は無効
      },
    });
    expect(p.prefix).toBe("ctrl+a");
    expect(p.bindings.goto).toEqual(["prefix+g", "ctrl+g"]);
    expect(p.bindings.detach).toBeUndefined(); // 有効な 1 つは既定と同じ＝差が無い
    expect(p.bindings).not.toHaveProperty("zoom");
    expect(p.bindings).not.toHaveProperty("bogus_action");
  });

  it("上書きの文字列が全部無効なら、上書きを消して既定へ戻す（元から [] のときだけ「割り当てなし」）", () => {
    const p = loadKeyPrefs({ bindings: { zoom: ["nonsense", 42], help: [], close_pane: [] } });
    expect(p.bindings.zoom).toBeUndefined();
    expect(p.bindings.help).toEqual([]);
    expect(p.bindings.close_pane).toEqual([]);
  });

  it("既定と同じ内容は「差」ではないので読まない", () => {
    expect(
      loadKeyPrefs({
        prefix: "ctrl+b",
        bindings: { zoom: ["prefix+z"], switch_tab: ["prefix+1..9"] },
      }),
    ).toEqual(emptyKeyPrefs());
  });

  it("配列でない値は読まない（文字列を配列に包んだりしない）。既定と違う有効な値でも同じ", () => {
    const p = loadKeyPrefs({ bindings: { zoom: "ctrl+alt+z", goto: { 0: "ctrl+g" }, help: 42 } });
    expect(p.bindings).toEqual({});
  });

  it("bindings の形が違っても、prefix は生かす（bindings は空）", () => {
    for (const bindings of [[], "x", 42, null, true]) {
      const p = loadKeyPrefs({ prefix: "ctrl+a", bindings });
      expect(p, JSON.stringify(bindings)).toEqual({ prefix: "ctrl+a", bindings: {} });
    }
  });

  it("prefix が送れない形なら、bindings は生かして prefix だけ既定へ", () => {
    const p = loadKeyPrefs({ prefix: "cmd+b", bindings: { help: ["prefix+h"] } });
    expect(p.prefix).toBeNull();
    expect(p.bindings.help).toEqual(["prefix+h"]);
  });
});

describe("serializeKeyPrefs", () => {
  it("差が無ければ undefined（keys ごと消す）", () => {
    expect(serializeKeyPrefs(emptyKeyPrefs())).toBeUndefined();
  });

  it("差だけを、カタログの順で持つ。読み直すと同じ", () => {
    const p = {
      prefix: "ctrl+a",
      bindings: { zoom: ["prefix+z", "ctrl+alt+z"], help: [], detach: ["prefix+d"] },
    };
    const s = serializeKeyPrefs(p);
    expect(s).toEqual({
      prefix: "ctrl+a",
      bindings: { help: [], detach: ["prefix+d"], zoom: ["prefix+z", "ctrl+alt+z"] },
    });
    expect(Object.keys(s!.bindings!)).toEqual(["help", "detach", "zoom"]); // カタログの順
    expect(loadKeyPrefs(JSON.parse(JSON.stringify(s)))).toEqual(p);
  });
});

describe("withBindings / withPrefix / withoutBindings（store の下請け）", () => {
  it("割り当てを差し替える。既定と同じ内容になったら上書きを消す", () => {
    const a = withBindings(emptyKeyPrefs(), "zoom", ["prefix+z", "ctrl+alt+z"]);
    expect(a.bindings.zoom).toEqual(["prefix+z", "ctrl+alt+z"]);
    const b = withBindings(a, "zoom", ["prefix+z"]);
    expect(b.bindings).not.toHaveProperty("zoom");
  });

  it("空配列は「割り当てなし」。無効な文字列は落として有効な分は反映し、全部無効なら何も変えない", () => {
    expect(withBindings(emptyKeyPrefs(), "zoom", []).bindings.zoom).toEqual([]);
    expect(
      withBindings(emptyKeyPrefs(), "zoom", ["prefix+z", "bogus+"]).bindings,
    ).not.toHaveProperty("zoom"); // 有効な 1 つは既定と同じ
    expect(withBindings(emptyKeyPrefs(), "zoom", ["ctrl+alt+z", "bogus+"]).bindings.zoom).toEqual([
      "ctrl+alt+z",
    ]); // 有効な分は反映される
    expect(
      withBindings(emptyKeyPrefs(), "zoom", ["bogus+", "ctrl+alt+z", 42 as unknown as string])
        .bindings.zoom,
    ).toEqual(["ctrl+alt+z"]);
    const base = withBindings(emptyKeyPrefs(), "goto", ["prefix+G"]);
    expect(withBindings(base, "goto", ["nonsense"])).toBe(base);
  });

  it("prefix を差し替える。無効な chord は何も変えない・null と既定は上書きを消す", () => {
    const a = withPrefix(emptyKeyPrefs(), "ctrl+a");
    expect(a.prefix).toBe("ctrl+a");
    expect(withPrefix(a, "cmd+b")).toBe(a);
    expect(withPrefix(a, "ctrl+b").prefix).toBeNull();
    expect(withPrefix(a, null).prefix).toBeNull();
  });

  it("操作の上書きを消す（既定へ戻す）。無ければ何も変えない", () => {
    const a = withBindings(emptyKeyPrefs(), "goto", ["prefix+G"]);
    expect(withoutBindings(a, "goto").bindings).toEqual({});
    const empty = emptyKeyPrefs();
    expect(withoutBindings(empty, "goto")).toBe(empty);
  });
});

describe("withBindings / withPrefix / withoutBindings は渡した KeyPrefs を書き換えない（store は新しい値へ差し替える）", () => {
  it("入力の prefs・bindings は変わらない", () => {
    const a = withBindings(emptyKeyPrefs(), "goto", ["prefix+G"]);
    const snapshot = JSON.stringify(a);
    withBindings(a, "goto", ["prefix+H"]);
    withBindings(a, "help", []);
    withoutBindings(a, "goto");
    withPrefix(a, "ctrl+a");
    withPrefix(a, null);
    expect(JSON.stringify(a)).toBe(snapshot);
    const b = withoutBindings(a, "goto");
    expect(b).not.toBe(a);
    expect(a.bindings.goto).toEqual(["prefix+shift+g"]);
  });
});
