import { TERMINAL_PALETTES, type TerminalPalette, type ThemeName } from "@wtm/protocol";
import { watch, type WatchStopHandle } from "vue";
import type { useSettingsStore } from "../store/settings.js";
import { readPrefs } from "../store/view.js";
import { lightDarkOf, loadThemePrefs } from "./themes.js";
import { CSS_VARS, uiTokens, type UiTokens } from "./uiTokens.js";

type SettingsStore = ReturnType<typeof useSettingsStore>;

/** 起動用の控えの置き場所（localStorage。`public/theme-boot.js` が同じキーを読む。design D5）。 */
export const BOOT_KEY = "wtm.themeBoot.v1";

/** 控えの 1 組（CSS 変数と color-scheme）。 */
export interface BootVars {
  vars: UiTokens["vars"];
  colorScheme: "light" | "dark";
}

/** 控え：自動の切替の入切と、固定・明るいとき・暗いときの 3 組。`theme-boot.js` は `auto ? (暗い ? dark : light) : fixed` を当てる。 */
export interface BootCache {
  auto: boolean;
  fixed: BootVars;
  light: BootVars;
  dark: BootVars;
}

export interface ThemeControllerOptions {
  settings: SettingsStore;
  /** CSS 変数を当てる先（`document.documentElement`）。 */
  root: HTMLElement;
  /** `matchMedia("(prefers-color-scheme: dark)")`。無い環境では null（暗い扱い・追従しない）。 */
  media: MediaQueryList | null;
  /** 開いている全端末の配色を替える（`TerminalRegistry.setTheme`）。 */
  setTerminalTheme(palette: TerminalPalette): void;
  /** サーバへ表示しているテーマを伝える（`client.theme`。接続が無ければ捨ててよい——次の接続で `resend`）。 */
  sendTheme(name: ThemeName): void;
  /** 控えの書き先（localStorage）。使えない環境では null。 */
  storage: Storage | null;
}

/**
 * テーマを当てる部品（20260921-theme-settings の design D5・「振る舞いの詳細」）。
 * - 当てる（`apply`）：CSS 変数・color-scheme・`data-theme` を root へ、配色を全端末へ、名前をサーバへ。直前と同じ名前なら省く。
 * - OS の明暗を追う：`media` の change → `settings.systemDark` → `settings.effectiveTheme` が変われば当てる（AC5）。
 * - 起動用の控え（`writeBoot`）：**4 つの設定が変わったときと `start()` のときだけ**書く（OS の明暗が変わっただけでは中身が変わらない）。
 *   中身は保存された設定（`wtm.prefs.v1`）から作る。
 */
export class ThemeController {
  private applied: ThemeName | null = null;
  private readonly stops: (() => void)[] = [];

  constructor(private readonly opts: ThemeControllerOptions) {}

  /**
   * 省略せずに当て、控えを書き、OS の明暗と設定の変化を聞き始める。**1 回目は省略しない**（`applied` を空にしてから当てる）——
   * `theme-boot.js` が控えから別のテーマの変数を当てていても、ここで正しい値に当て直す（控えが古くても自己修復する）。
   */
  start(): void {
    const { settings, media } = this.opts;
    settings.systemDark = media ? media.matches : true;
    this.applied = null; // 1 回目は省略しない（start の前に apply が呼ばれていても・stop の後に start し直しても）
    this.apply(settings.effectiveTheme);
    this.writeBoot();
    if (media) {
      const onChange = (ev: MediaQueryListEvent): void => {
        settings.systemDark = ev.matches;
      };
      media.addEventListener("change", onChange);
      this.stops.push(() => media.removeEventListener("change", onChange));
    }
    // 既定の `pre`（同じタスクの変化をまとめて 1 回）で追う——`setTheme` は `theme` と `themeAuto` を順に変えるので、同期で追うと
    // 途中の状態のテーマ（新しいテーマの対）を当て、間違った名前をサーバへ送ってしまう（T13 のタスク点検）。
    const stopApply: WatchStopHandle = watch(
      () => settings.effectiveTheme,
      (name) => this.apply(name),
    );
    const stopBoot: WatchStopHandle = watch(
      [
        () => settings.theme,
        () => settings.themeAuto,
        () => settings.themeLight,
        () => settings.themeDark,
      ],
      () => this.writeBoot(),
    );
    this.stops.push(stopApply, stopBoot);
  }

  /** 聞くのをやめる（テスト用）。 */
  stop(): void {
    for (const stop of this.stops.splice(0)) stop();
  }

  /** 当てる。直前に当てた名前と同じなら何もしない（`start()` の 1 回目は `applied` が null なので必ず当たる）。 */
  apply(name: ThemeName): void {
    if (name === this.applied) return;
    this.applied = name;
    const { root } = this.opts;
    const tokens = uiTokens(name);
    for (const key of CSS_VARS) root.style.setProperty(key, tokens.vars[key]);
    root.style.colorScheme = tokens.colorScheme;
    root.dataset["theme"] = name;
    this.opts.setTerminalTheme(TERMINAL_PALETTES[name]);
    this.opts.sendTheme(name);
  }

  /** 控えを書く（固定＝1 つのテーマ、明るいとき・暗いとき＝`lightDarkOf`）。書けなくても落ちない（プライベートモード等）。 */
  writeBoot(): void {
    const { storage } = this.opts;
    // **保存された設定から作る**（このタブの store からではなく）——同じブラウザの別のタブで設定を変えていると、このタブの store は古い。
    // 次の読み込みが使うのは保存された設定なので、控えもそれに揃える（review ラウンド 1）。
    const saved = loadThemePrefs(readPrefs());
    const ld = lightDarkOf(saved);
    const cache: BootCache = {
      auto: saved.auto,
      fixed: bootVars(saved.theme),
      light: bootVars(ld.light),
      dark: bootVars(ld.dark),
    };
    try {
      storage?.setItem(BOOT_KEY, JSON.stringify(cache));
    } catch {
      // 書けなくても画面は正しい（次の読み込みの最初に既定の色が一瞬出るだけ）。
    }
  }

  /** 直前に当てた名前（`start()` の前は null）。 */
  current(): ThemeName | null {
    return this.applied;
  }

  /** 新しい接続の `client.hello` が通った後に呼ぶ（サーバは接続ごとに新しい clientId を振り、前の接続のテーマを持たない）。 */
  resend(): void {
    if (this.applied !== null) this.opts.sendTheme(this.applied);
  }
}

function bootVars(name: ThemeName): BootVars {
  const t = uiTokens(name);
  return { vars: t.vars, colorScheme: t.colorScheme };
}
