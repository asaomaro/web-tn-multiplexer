import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, watch } from "vue";
import {
  buildNewCwd,
  loadKeyboardLockInFullscreen,
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

describe("loadKeyboardLockInFullscreen（20260922-keybinding-usability。AC11）", () => {
  it("boolean でなければ既定の「無効」（実験的 API なので opt-in）", () => {
    for (const raw of [undefined, null, "true", 0, 1, {}, []]) {
      expect(loadKeyboardLockInFullscreen(raw), String(raw)).toBe(false);
    }
    expect(loadKeyboardLockInFullscreen(true)).toBe(true);
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

  it("keyboardLockInFullscreen は既定が無効で、切り替えると反映・保存され、新しいストアが読み戻す（20260922-keybinding-usability。AC11）", () => {
    const store = useSettingsStore(pinia);
    expect(store.keyboardLockInFullscreen).toBe(false);
    store.setKeyboardLockInFullscreen(true);
    expect(store.keyboardLockInFullscreen, "押した時点で反映").toBe(true);
    expect(readPrefs()["keyboardLockInFullscreen"]).toBe(true);
    expect(useSettingsStore(createPinia()).keyboardLockInFullscreen).toBe(true);
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

describe("useSettingsStore — テーマ（20260921-theme-settings）", () => {
  it("何も保存されていなければ dracula・切・対の既定で、いま使うのは dracula（AC4）", () => {
    const store = useSettingsStore(pinia);
    expect(store.theme).toBe("dracula");
    expect(store.themeAuto).toBe(false);
    expect(store.themeLight).toBeNull();
    expect(store.themeDark).toBeNull();
    expect(store.effectiveTheme).toBe("dracula");
  });

  it("保存した値を値ごとに読み戻す（壊れた値だけを落とす。AC3・AC4）", () => {
    writePrefs({ theme: "gruvbox", themeAuto: true, themeLight: "lattee", themeDark: "vesper" });
    const store = useSettingsStore(pinia);
    expect(store.theme).toBe("gruvbox");
    expect(store.themeAuto).toBe(true);
    expect(store.themeLight).toBeNull();
    expect(store.themeDark).toBe("vesper");
  });

  it("1 つのテーマを選ぶと反映・保存され、自動の切替が入っていたら切る（AC7）", () => {
    const store = useSettingsStore(pinia);
    store.setThemeAuto(true);
    store.setTheme("nord");
    expect(store.theme).toBe("nord");
    expect(store.themeAuto).toBe(false);
    expect(store.effectiveTheme).toBe("nord");
    expect(readPrefs()).toMatchObject({ theme: "nord", themeAuto: false });
    const again = useSettingsStore(createPinia());
    expect(again.theme).toBe("nord");
    expect(again.themeAuto).toBe(false);
  });

  it("自動の切替が入っていれば、OS の明暗（systemDark）でいま使うテーマが替わる。切ると 1 つのテーマに戻る（AC5・AC7）", () => {
    const store = useSettingsStore(pinia);
    store.setTheme("tokyo-night");
    store.setThemeAuto(true);
    expect(readPrefs()["themeAuto"]).toBe(true); // 入を保存する（AC3）
    expect(useSettingsStore(createPinia()).themeAuto).toBe(true);
    store.systemDark = true;
    expect(store.effectiveTheme).toBe("tokyo-night");
    store.systemDark = false;
    expect(store.effectiveTheme).toBe("tokyo-night-day");
    store.setThemeAuto(false);
    expect(store.effectiveTheme).toBe("tokyo-night");
    expect(readPrefs()["themeAuto"]).toBe(false);
  });

  it("明るいとき・暗いときを選ぶと保存され、null を入れると対の既定に戻り、1 つのテーマの変更に追従する（AC6）", () => {
    const store = useSettingsStore(pinia);
    store.setTheme("gruvbox");
    store.setThemeAuto(true);
    store.systemDark = false;
    store.setThemeLight("one-light");
    expect(store.effectiveTheme).toBe("one-light");
    expect(readPrefs()["themeLight"]).toBe("one-light");
    // 選んだ後は、1 つのテーマを変えても追従しない（setTheme は自動を切るので、入れ直す）。
    store.setTheme("kanagawa");
    store.setThemeAuto(true);
    expect(store.effectiveTheme).toBe("one-light");
    // null で既定（対）に戻ると、また追従する。
    store.setThemeLight(null);
    expect(store.themeLight).toBeNull();
    expect(readPrefs()["themeLight"]).toBeNull();
    expect(store.effectiveTheme).toBe("kanagawa-lotus");
    store.setThemeDark("vesper");
    expect(readPrefs()["themeDark"]).toBe("vesper");
    store.systemDark = true;
    expect(store.effectiveTheme).toBe("vesper");
    // 新しいストアで読み直しても、null（対の既定）と選んだ値がそのまま戻る。
    const again = useSettingsStore(createPinia());
    expect(again.themeLight).toBeNull();
    expect(again.themeDark).toBe("vesper");
    again.systemDark = false;
    expect(again.effectiveTheme).toBe("kanagawa-lotus");
  });

  it("テーマを保存しても他の好みは消えない", () => {
    writePrefs({ statusSymbols: false, newCwdPolicy: "home" });
    const store = useSettingsStore(pinia);
    store.setTheme("one-dark");
    store.setThemeLight("solarized-light");
    expect(readPrefs()).toMatchObject({ statusSymbols: false, newCwdPolicy: "home", theme: "one-dark", themeLight: "solarized-light" });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 20260921-keybinding-customization：キーの割り当て（AC3・AC4・AC8・AC9）
// ---------------------------------------------------------------------------------------------------------------------

describe("useSettingsStore — キーの割り当て（AC8）", () => {
  it("何も保存されていなければ既定の表（prefix は ctrl+b・割り当ては既定）", () => {
    const store = useSettingsStore(pinia);
    expect(store.keyPrefs).toEqual({ prefix: null, bindings: {} });
    expect(store.keymap.prefix).toBe("ctrl+b");
    expect(store.keymap.bindingsOf("split_vertical")).toEqual(["prefix+v"]);
    expect(store.keymap.directMap.size).toBe(0);
  });

  it("prefix・割り当てを変えると、解決した表が即時に変わり、wtm.prefs.v1 の keys に差だけが保存される", () => {
    const store = useSettingsStore(pinia);
    store.setKeyPrefix("ctrl+a");
    store.setKeyBindings("split_vertical", ["prefix+v", "ctrl+alt+d"]);
    expect(store.keymap.prefix).toBe("ctrl+a");
    expect(store.keymap.bindingsOf("split_vertical")).toEqual(["prefix+v", "ctrl+alt+d"]);
    expect(store.keymap.directMap.get("ctrl+alt+d")).toEqual({ type: "split", dir: "right" });
    expect(readPrefs()["keys"]).toEqual({ prefix: "ctrl+a", bindings: { split_vertical: ["prefix+v", "ctrl+alt+d"] } });
  });

  it("再読み込みで残る（別の pinia で読み直す）", () => {
    const first = useSettingsStore(pinia);
    first.setKeyPrefix("alt+x");
    first.setKeyBindings("help", []);
    const second = useSettingsStore(createPinia());
    expect(second.keymap.prefix).toBe("alt+x");
    expect(second.keymap.bindingsOf("help")).toEqual([]);
    expect(second.keymap.hintFor("help")).toBeNull();
  });

  it("壊れた保存値は値ごとに落として既定へ戻し、残りは生かして起動する", () => {
    writePrefs({ keys: { prefix: "cmd+b", bindings: { zoom: ["prefix+y"], bogus: ["prefix+q"], goto: 42 } } });
    const store = useSettingsStore(pinia);
    expect(store.keymap.prefix).toBe("ctrl+b"); // 送れない形の prefix は既定へ
    expect(store.keymap.bindingsOf("zoom")).toEqual(["prefix+y"]); // 有効な上書きは生きる
    expect(store.keymap.bindingsOf("goto")).toEqual(["prefix+g"]); // 配列でない値は既定へ
  });

  it("JSON でない・形が違う keys は既定（起動できる）", () => {
    for (const keys of ["x", 42, [], null]) {
      localStorage.clear();
      writePrefs({ keys });
      expect(useSettingsStore(createPinia()).keymap.prefix, JSON.stringify(keys)).toBe("ctrl+b");
    }
  });

  it("既定と同じ内容に戻せば上書きを消し、差が無くなれば keys ごと消える", () => {
    const store = useSettingsStore(pinia);
    store.setKeyBindings("zoom", ["prefix+y"]);
    expect(readPrefs()["keys"]).toBeDefined();
    store.setKeyBindings("zoom", ["prefix+z"]);
    expect(store.keyPrefs.bindings).toEqual({});
    expect(readPrefs()).not.toHaveProperty("keys");
  });

  it("通らない値は反映せず捨てる（二重の守り）：無効な文字列・送れない prefix・全部無効な入力", () => {
    const store = useSettingsStore(pinia);
    store.setKeyPrefix("cmd+b");
    expect(store.keymap.prefix).toBe("ctrl+b");
    store.setKeyBindings("zoom", ["nonsense"]);
    expect(store.keyPrefs.bindings).toEqual({});
    expect(readPrefs()).not.toHaveProperty("keys");
    store.setKeyBindings("zoom", ["prefix+y", "nonsense"]); // 有効な分だけ反映
    expect(store.keymap.bindingsOf("zoom")).toEqual(["prefix+y"]);
  });

  it("replaceKeyPrefs を直に呼んでも、読めない値は反映も保存もしない（二重の守り。setKeyPrefix・setKeyBindings は手前で弾くので、ここでしか届かない）", () => {
    const store = useSettingsStore(pinia);
    store.replaceKeyPrefs({ prefix: "cmd+b", bindings: { zoom: ["nonsense"] } });
    expect(store.keyPrefs).toEqual({ prefix: null, bindings: {} });
    expect(store.keymap.prefix).toBe("ctrl+b");
    expect(readPrefs()).not.toHaveProperty("keys");
    // 一部だけ読めないなら、読める分だけ（状態にも保存にも）残る。
    store.replaceKeyPrefs({ prefix: "cmd+b", bindings: { zoom: ["prefix+y", "nonsense"] } });
    expect(store.keyPrefs).toEqual({ prefix: null, bindings: { zoom: ["prefix+y"] } });
    expect(readPrefs()["keys"]).toEqual({ bindings: { zoom: ["prefix+y"] } });
  });

  it("別のウィンドウで割り当てが変わったら（storage イベント）追従し、古い状態から別の変更をしても先の変更を上書きしない", () => {
    const store = useSettingsStore(pinia);
    store.setKeyBindings("zoom", ["prefix+y"]);
    // 別のウィンドウが prefix を変えて保存した（自分の書き込みでは storage は発火しない。ここでは書いてから発火させる）。
    writePrefs({ keys: { prefix: "alt+x", bindings: { zoom: ["prefix+y"] } } });
    window.dispatchEvent(new StorageEvent("storage", { key: "wtm.prefs.v1" }));
    expect(store.keymap.prefix).toBe("alt+x");
    const km = store.keymap;
    window.dispatchEvent(new StorageEvent("storage", { key: "wtm.prefs.v1" })); // 変わっていなければ表を作り直さない
    expect(store.keymap).toBe(km);
    // このウィンドウで別の操作を変えても、先に保存された prefix は残る。
    store.setKeyBindings("help", ["prefix+u"]);
    expect(readPrefs()["keys"]).toEqual({
      prefix: "alt+x",
      bindings: { zoom: ["prefix+y"], help: ["prefix+u"] },
    });
  });

  it("他の設定を消さない（keys は併合して書く）", () => {
    writePrefs({ statusSymbols: false, theme: "nord" });
    const store = useSettingsStore(pinia);
    store.setKeyPrefix("ctrl+a");
    expect(readPrefs()["statusSymbols"]).toBe(false);
    expect(readPrefs()["theme"]).toBe("nord");
    expect(readPrefs()["keys"]).toEqual({ prefix: "ctrl+a" });
  });
});

describe("useSettingsStore — キーの戻し（AC9）", () => {
  it("操作ごと・prefix・すべてを既定へ戻す", () => {
    const store = useSettingsStore(pinia);
    store.setKeyPrefix("ctrl+a");
    store.setKeyBindings("zoom", ["prefix+y"]);
    store.setKeyBindings("help", []);
    store.resetKeyAction("zoom");
    expect(store.keymap.bindingsOf("zoom")).toEqual(["prefix+z"]);
    expect(store.keymap.bindingsOf("help")).toEqual([]); // 他の操作は変わらない
    store.resetKeyPrefix();
    expect(store.keymap.prefix).toBe("ctrl+b");
    expect(store.keymap.bindingsOf("help")).toEqual([]);
    store.resetAllKeys();
    expect(store.keyPrefs).toEqual({ prefix: null, bindings: {} });
    expect(store.keymap.bindingsOf("help")).toEqual(["prefix+?"]);
    expect(readPrefs()).not.toHaveProperty("keys");
  });

  it("すべて戻すは、prefix を変えたままでも prefix も戻す", () => {
    const store = useSettingsStore(pinia);
    store.setKeyPrefix("ctrl+a");
    store.setKeyBindings("zoom", ["prefix+y"]);
    store.resetAllKeys();
    expect(store.keymap.prefix).toBe("ctrl+b");
    expect(store.keymap.bindingsOf("zoom")).toEqual(["prefix+z"]);
    expect(readPrefs()).not.toHaveProperty("keys");
  });

  it("replaceKeyPrefs：戻し・おすすめの結果（KeyPrefs）をそのまま採る", () => {
    const store = useSettingsStore(pinia);
    store.replaceKeyPrefs({ prefix: "alt+x", bindings: { zoom: ["ctrl+alt+z", "prefix+z"] } });
    expect(store.keymap.prefix).toBe("alt+x");
    expect(store.keymap.bindingsOf("zoom")).toEqual(["ctrl+alt+z", "prefix+z"]);
  });

  it("同じ内容を渡し直しても、書かず、keymap も作り直さない（購読は変えたときだけ動く。押すたびに作り直さない）", async () => {
    const store = useSettingsStore(pinia);
    const next = { prefix: "alt+x", bindings: { zoom: ["ctrl+alt+z", "prefix+z"] } };
    store.replaceKeyPrefs(next);
    const km = store.keymap;
    let fired = 0;
    watch(
      () => store.keymap,
      () => (fired += 1),
      { flush: "sync" },
    );
    const setItem = vi.spyOn(localStorage, "setItem");
    try {
      store.replaceKeyPrefs({ prefix: "alt+x", bindings: { zoom: ["ctrl+alt+z", "prefix+z"] } });
      store.setKeyPrefix("alt+x");
      store.setKeyBindings("zoom", ["ctrl+alt+z", "prefix+z"]);
      await nextTick();
      expect(store.keymap, "同じ表のまま").toBe(km);
      expect(fired).toBe(0);
      expect(setItem).not.toHaveBeenCalled();
      store.setKeyPrefix("alt+y"); // 変えれば作り直され、購読が動き、保存される
      expect(store.keymap).not.toBe(km);
      expect(fired).toBe(1);
      expect(setItem).toHaveBeenCalledTimes(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it("壊れた keys が保存に残っていても、すべて戻す・prefix を戻す操作で保存が直る（状態は既定のまま・表は作り直さない）", () => {
    writePrefs({ keys: "x" });
    const a = useSettingsStore(pinia);
    expect(a.keyPrefs).toEqual({ prefix: null, bindings: {} });
    const km = a.keymap;
    a.resetAllKeys();
    expect(readPrefs()).not.toHaveProperty("keys");
    expect(a.keymap).toBe(km);

    writePrefs({ keys: { prefix: "cmd+b" } }); // 送れない prefix（読み込みで落ちる）
    const b = useSettingsStore(createPinia());
    expect(b.keymap.prefix).toBe("ctrl+b");
    b.setKeyPrefix(null);
    expect(readPrefs()).not.toHaveProperty("keys");
  });
});
