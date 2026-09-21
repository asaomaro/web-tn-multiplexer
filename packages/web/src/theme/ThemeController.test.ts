import { TERMINAL_PALETTES, type TerminalPalette, type ThemeName } from "@wtm/protocol";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { useSettingsStore } from "../store/settings.js";
import { writePrefs } from "../store/view.js";
import { BOOT_KEY, ThemeController, type BootCache } from "./ThemeController.js";
import { uiTokens } from "./uiTokens.js";

/** `matchMedia("(prefers-color-scheme: dark)")` の偽物（happy-dom の matchMedia は OS の明暗を切り替えて change を出せない）。`set` で切り替える。 */
function fakeMedia(dark: boolean) {
  const listeners = new Set<(ev: MediaQueryListEvent) => void>();
  const media = {
    matches: dark,
    addEventListener: (_: string, fn: (ev: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (ev: MediaQueryListEvent) => void) => listeners.delete(fn),
  };
  return {
    media: media as unknown as MediaQueryList,
    set(next: boolean) {
      media.matches = next;
      for (const fn of listeners) fn({ matches: next } as MediaQueryListEvent);
    },
  };
}

function fakeStorage() {
  const map = new Map<string, string>();
  const writes: string[] = [];
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes.push(k);
      map.set(k, v);
    },
  } as unknown as Storage;
  return {
    storage,
    writes,
    boot: () => JSON.parse(map.get(BOOT_KEY) ?? "null") as BootCache | null,
  };
}

let pinia: Pinia;
let root: HTMLElement;
let terminalThemes: TerminalPalette[];
let sent: ThemeName[];

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  root = document.createElement("div");
  terminalThemes = [];
  sent = [];
});
afterEach(() => localStorage.clear());

function make(
  opts: { dark?: boolean; media?: MediaQueryList | null; storage?: Storage | null } = {},
) {
  const settings = useSettingsStore(pinia);
  const m = fakeMedia(opts.dark ?? true);
  const s = fakeStorage();
  const controller = new ThemeController({
    settings,
    root,
    media: opts.media === undefined ? m.media : opts.media,
    setTerminalTheme: (p) => terminalThemes.push(p),
    sendTheme: (n) => sent.push(n),
    storage: opts.storage === undefined ? s.storage : opts.storage,
  });
  return { settings, controller, media: m, storage: s };
}

describe("ThemeController.start", () => {
  it("いま使うテーマを root（CSS 変数・color-scheme・data-theme）・全端末・サーバへ当て、控えを書く（AC2・AC10）", () => {
    writePrefs({ theme: "gruvbox-light" });
    const { controller, storage } = make();
    controller.start();
    const t = uiTokens("gruvbox-light");
    expect(root.style.getPropertyValue("--wtm-menu-bg")).toBe(t.vars["--wtm-menu-bg"]);
    expect(root.style.getPropertyValue("--wtm-state-working")).toBe(t.vars["--wtm-state-working"]);
    expect(root.style.colorScheme).toBe("light");
    expect(root.dataset["theme"]).toBe("gruvbox-light");
    expect(terminalThemes).toEqual([TERMINAL_PALETTES["gruvbox-light"]]);
    expect(sent).toEqual(["gruvbox-light"]);
    expect(storage.boot()).toMatchObject({
      auto: false,
      fixed: { colorScheme: "light", vars: t.vars },
    });
    expect(controller.current()).toBe("gruvbox-light");
  });

  it("1 回目は省略しない：控えが別のテーマの変数を当てていても、保存値が dracula なら dracula に当て直す", () => {
    const nord = uiTokens("nord");
    root.style.setProperty("--wtm-menu-bg", nord.vars["--wtm-menu-bg"]); // theme-boot.js が古い控えから当てた状態
    root.style.colorScheme = "light";
    const { controller } = make();
    controller.start();
    expect(root.style.getPropertyValue("--wtm-menu-bg")).toBe("#282a36");
    expect(root.style.colorScheme).toBe("dark");
    expect(sent).toEqual(["dracula"]);
  });

  it("OS の明暗を読み、自動の切替が入っていればそのテーマ。matchMedia が無ければ暗い扱い", () => {
    writePrefs({ theme: "catppuccin", themeAuto: true });
    make({ dark: false }).controller.start();
    expect(sent).toEqual(["catppuccin-latte"]);
    sent = [];
    pinia = createPinia();
    make({ media: null }).controller.start();
    expect(sent).toEqual(["catppuccin"]);
  });
});

describe("変化を追う", () => {
  it("OS の明暗が変わると当て直し（AC5）、控えは書き直さない（中身が変わらない）", async () => {
    writePrefs({ theme: "tokyo-night", themeAuto: true });
    const { controller, media, storage } = make({ dark: true });
    controller.start();
    const writesAfterStart = storage.writes.length;
    media.set(false);
    await nextTick();
    expect(root.dataset["theme"]).toBe("tokyo-night-day");
    expect(sent).toEqual(["tokyo-night", "tokyo-night-day"]);
    expect(terminalThemes.at(-1)).toBe(TERMINAL_PALETTES["tokyo-night-day"]);
    expect(storage.writes.length).toBe(writesAfterStart);
  });

  it("設定を変えると当て直し、控えを書き直す。いま使うテーマが変わらなくても（暗いときに「明るいとき」を変えた）控えは書き直す", async () => {
    const { settings, controller, storage } = make({ dark: true });
    controller.start();
    settings.setTheme("nord");
    await nextTick();
    expect(root.dataset["theme"]).toBe("nord");
    expect(storage.boot()?.fixed.vars["--wtm-menu-bg"]).toBe(
      uiTokens("nord").vars["--wtm-menu-bg"],
    );
    settings.setThemeAuto(true);
    await nextTick();
    expect(storage.boot()?.auto).toBe(true); // 自動の切替を入れただけでも控えを書き直す
    const before = sent.length;
    settings.setThemeLight("solarized-light"); // OS は暗いので、いま使うテーマは nord のまま
    await nextTick();
    expect(sent.length).toBe(before);
    expect(storage.boot()).toMatchObject({
      auto: true,
      light: { colorScheme: "light", vars: uiTokens("solarized-light").vars },
    });
  });

  it("「暗いとき」を変えると控えの dark の組を書き直す。最初の控えは固定・明るいとき・暗いときを 1 つのテーマの対で持つ", async () => {
    writePrefs({ theme: "catppuccin" });
    const { settings, controller, storage } = make({ dark: true });
    controller.start();
    expect(storage.boot()).toEqual({
      auto: false,
      fixed: { colorScheme: "dark", vars: uiTokens("catppuccin").vars },
      light: { colorScheme: "light", vars: uiTokens("catppuccin-latte").vars },
      dark: { colorScheme: "dark", vars: uiTokens("catppuccin").vars },
    });
    settings.setThemeDark("one-dark");
    await nextTick();
    expect(storage.boot()?.dark).toEqual({ colorScheme: "dark", vars: uiTokens("one-dark").vars });
  });

  it("自動の切替が入っていて既定の対のまま 1 つのテーマを選んでも、途中の状態のテーマを当てたり送ったりしない（1 回だけ）", async () => {
    writePrefs({ theme: "dracula", themeAuto: true });
    const { settings, controller, storage } = make({ dark: true });
    controller.start();
    const writes = storage.writes.length;
    settings.setTheme("catppuccin-latte"); // theme が先に替わると、途中で「catppuccin-latte の対の暗い側」＝ catppuccin を指す
    await nextTick();
    expect(sent).toEqual(["dracula", "catppuccin-latte"]);
    expect(terminalThemes).toEqual([
      TERMINAL_PALETTES.dracula,
      TERMINAL_PALETTES["catppuccin-latte"],
    ]);
    expect(storage.writes.length).toBe(writes + 1);
    expect(storage.boot()?.auto).toBe(false);
  });

  it("start の前に apply が呼ばれていても、start は同じ名前でも当て直す", () => {
    const { controller } = make();
    controller.apply("dracula");
    root.style.removeProperty("--wtm-menu-bg");
    controller.start();
    expect(root.style.getPropertyValue("--wtm-menu-bg")).toBe("#282a36");
  });

  it("控えは保存された設定から作る——同じブラウザの別のタブで 1 つのテーマを変えていても、このタブで「暗いとき」を変えたときの控えはそれに揃う", async () => {
    const { settings, controller, storage } = make({ dark: true });
    controller.start();
    writePrefs({ theme: "nord" }); // 別のタブが保存した（このタブの store は dracula のまま）
    settings.setThemeDark("vesper");
    await nextTick();
    expect(storage.boot()?.fixed.vars["--wtm-menu-bg"]).toBe(
      uiTokens("nord").vars["--wtm-menu-bg"],
    );
    expect(storage.boot()?.dark.vars["--wtm-menu-bg"]).toBe(
      uiTokens("vesper").vars["--wtm-menu-bg"],
    );
  });

  it("同じ名前なら当て直さない（端末・サーバへ二度送らない）", () => {
    const { controller } = make();
    controller.start();
    controller.apply("dracula");
    expect(terminalThemes).toHaveLength(1);
    expect(sent).toEqual(["dracula"]);
  });

  it("stop の後は追わない", async () => {
    writePrefs({ themeAuto: true, theme: "gruvbox" });
    const { controller, media } = make({ dark: true });
    controller.start();
    controller.stop();
    media.set(false);
    await nextTick();
    expect(sent).toEqual(["gruvbox"]);
  });
});

describe("resend・控えの書き込みの失敗", () => {
  it("resend は直前に当てた名前を送り直す。start の前は何もしない", () => {
    const { controller } = make();
    controller.resend();
    expect(sent).toEqual([]);
    controller.start();
    controller.resend();
    expect(sent).toEqual(["dracula", "dracula"]);
  });

  it("控えを書けなくても（storage が投げる・無い）落ちない", () => {
    const throwing = {
      setItem: () => {
        throw new Error("quota");
      },
    } as unknown as Storage;
    expect(() => make({ storage: throwing }).controller.start()).not.toThrow();
    pinia = createPinia();
    expect(() => make({ storage: null }).controller.start()).not.toThrow();
  });
});
