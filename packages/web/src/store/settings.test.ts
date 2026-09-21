import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildNewCwd,
  loadNewCwdPath,
  loadNewCwdPolicy,
  loadStatusSymbols,
  useSettingsStore,
} from "./settings.js";
import { readPrefs, writePrefs } from "./view.js";

let pinia: Pinia;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
});
afterEach(() => {
  localStorage.clear();
});

describe("loadStatusSymbols（AC3・AC7）", () => {
  it("boolean はそのまま", () => {
    expect(loadStatusSymbols(true)).toBe(true);
    expect(loadStatusSymbols(false)).toBe(false);
  });

  // 既定は「入」（herdr と逆。decisions D1）。何も保存していない利用者にも記号が出る。
  it("boolean でなければ既定の「入」", () => {
    for (const raw of [undefined, null, "false", 0, 1, {}, []]) {
      expect(loadStatusSymbols(raw), String(raw)).toBe(true);
    }
  });
});

describe("useSettingsStore", () => {
  it("何も保存されていなければ、記号は入・scrollback は自動（AC7）", () => {
    const store = useSettingsStore(pinia);
    expect(store.statusSymbols).toBe(true);
    expect(store.scrollback).toBe("auto");
  });

  it("記号表示を切ると同じストアに反映され、保存され、新しいストアが読み戻す", () => {
    const store = useSettingsStore(pinia);
    store.setStatusSymbols(false);
    expect(store.statusSymbols, "押した時点で反映（再読み込みを待たない）").toBe(false);
    expect(readPrefs()["statusSymbols"]).toBe(false);
    expect(useSettingsStore(createPinia()).statusSymbols).toBe(false);
  });

  // AC10：再読み込み（＝新しいストア）でも残る。
  it("scrollback の設定は同じストアに反映され、保存され、新しいストアが読み戻す", () => {
    const store = useSettingsStore(pinia);
    store.setScrollback(2000);
    expect(store.scrollback, "選んだ時点で反映").toBe(2000);
    expect(readPrefs()["scrollback"]).toBe(2000);
    expect(useSettingsStore(createPinia()).scrollback).toBe(2000);
  });

  it("自動に戻すと \"auto\" が保存される", () => {
    const store = useSettingsStore(pinia);
    store.setScrollback(2000);
    store.setScrollback("auto");
    expect(readPrefs()["scrollback"], "キーを消すのではなく \"auto\" を書く").toBe("auto");
    expect(useSettingsStore(createPinia()).scrollback).toBe("auto");
  });

  // 他の好み（通知・並び順・サイドバー）を消さない——`writePrefs` の併合に乗っている。
  it("保存しても他の好みは消えない", () => {
    writePrefs({ agentSort: "priority", notify: { toast: false, desktop: false, sound: true } });
    const store = useSettingsStore(pinia);
    store.setStatusSymbols(false);
    store.setScrollback(5000);
    expect(readPrefs()).toMatchObject({ agentSort: "priority", notify: { toast: false, sound: true }, statusSymbols: false, scrollback: 5000 });
  });

  // AC3：壊れた値でも起動できる。
  it("保存された値が壊れていれば既定で起動する", () => {
    writePrefs({ statusSymbols: "off", scrollback: -10 });
    const store = useSettingsStore(createPinia());
    expect(store.statusSymbols).toBe(true);
    expect(store.scrollback).toBe("auto");
  });
});

// 新しく開く場所（20260921-new-terminal-cwd）。
describe("loadNewCwdPolicy・loadNewCwdPath（AC4）", () => {
  it("4 つの方針はそのまま", () => {
    for (const p of ["follow", "home", "current", "path"] as const) {
      expect(loadNewCwdPolicy(p)).toBe(p);
    }
  });

  // 何も設定していない利用者は「引き継ぐ」（herdr の既定と同じ）。壊れた値でも起動できる。
  it("4 つのどれかでなければ既定の「引き継ぐ」", () => {
    for (const raw of [undefined, null, "", "Follow", "cwd", 0, true, {}, []]) {
      expect(loadNewCwdPolicy(raw), String(raw)).toBe("follow");
    }
  });

  it("パスは文字列ならそのまま、そうでなければ空", () => {
    expect(loadNewCwdPath("~/work")).toBe("~/work");
    expect(loadNewCwdPath("")).toBe("");
    for (const raw of [undefined, null, 1, {}, ["~/work"]]) {
      expect(loadNewCwdPath(raw), String(raw)).toBe("");
    }
  });
});

describe("buildNewCwd", () => {
  it("引き継ぐは元の pane を載せ、元の pane が無ければ載せない（design D7）", () => {
    expect(buildNewCwd("follow", "", "p3")).toEqual({ policy: "follow", sourcePaneId: "p3" });
    expect(buildNewCwd("follow", "", null)).toEqual({ policy: "follow" });
  });

  // 元の pane を見るのは「引き継ぐ」だけ（ほかの方針に余計な値を載せない）。
  it("ホーム・起動した場所は方針だけ、指定した場所はパスを入れたまま載せる", () => {
    expect(buildNewCwd("home", "/x", "p3")).toEqual({ policy: "home" });
    expect(buildNewCwd("current", "/x", "p3")).toEqual({ policy: "current" });
    expect(buildNewCwd("path", "~/work", "p3")).toEqual({ policy: "path", path: "~/work" });
    expect(buildNewCwd("path", "", null)).toEqual({ policy: "path", path: "" });
  });
});

describe("useSettingsStore — 新しく開く場所", () => {
  it("何も保存されていなければ「引き継ぐ」、パスは空（AC4）", () => {
    const store = useSettingsStore(pinia);
    expect(store.newCwdPolicy).toBe("follow");
    expect(store.newCwdPath).toBe("");
  });

  it("方針とパスは同じストアに反映され、保存され、新しいストアが読み戻す（AC-I1）", () => {
    const store = useSettingsStore(pinia);
    store.setNewCwdPolicy("path");
    store.setNewCwdPath("~/work");
    expect(store.newCwdPolicy, "選んだ時点で反映").toBe("path");
    expect(store.newCwdPath).toBe("~/work");
    expect(readPrefs()).toMatchObject({ newCwdPolicy: "path", newCwdPath: "~/work" });
    const reloaded = useSettingsStore(createPinia());
    expect(reloaded.newCwdPolicy).toBe("path");
    expect(reloaded.newCwdPath).toBe("~/work");
  });

  it("保存しても他の好みは消えない", () => {
    writePrefs({ statusSymbols: false, scrollback: 5000 });
    useSettingsStore(pinia).setNewCwdPolicy("home");
    expect(readPrefs()).toMatchObject({
      statusSymbols: false,
      scrollback: 5000,
      newCwdPolicy: "home",
    });
  });

  it("保存された値が壊れていれば既定で起動する", () => {
    writePrefs({ newCwdPolicy: "somewhere", newCwdPath: 42 });
    const store = useSettingsStore(createPinia());
    expect(store.newCwdPolicy).toBe("follow");
    expect(store.newCwdPath).toBe("");
  });
});
