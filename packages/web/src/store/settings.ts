import type { NewCwd, ThemeName } from "@wtm/protocol";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { loadThemePrefs, resolveTheme } from "../theme/themes.js";
import { loadScrollbackPref, type ScrollbackPref } from "../term/scrollback.js";
import { readPrefs, writePrefs } from "./view.js";

/**
 * 設定ダイアログの「表示」と「端末」の節の値（20260921-herdr-settings-gaps）。
 * 通知の節の値は `store/notifications.ts`、サイドバーの幅と折りたたみは `store/view.ts`（設定の項目ではなく
 * 操作した結果を覚えるだけ。D1）。**どれも `wtm.prefs.v1` の読み書きは `readPrefs`/`writePrefs` に任せる**
 * （所有者を 1 つにする。`view.ts` の注記）。
 */

/**
 * 保存された記号表示を読む。**boolean でなければ既定の「入」**（AC3・AC7）。
 *
 * **既定が herdr と逆**（herdr の `ui.status_indicators` の既定は `dots`＝色だけ）。WCAG 1.4.1 は色を唯一の手段に
 * することを禁じており、既定で違反した状態を出さない（decisions D1）。
 */
export function loadStatusSymbols(raw: unknown): boolean {
  return typeof raw === "boolean" ? raw : true;
}

/**
 * 新しく開く場所の方針（20260921-new-terminal-cwd。herdr の `terminal.new_cwd`）。**ブラウザごと**に持ち、作成の要求に載せる
 * （サーバは方針を持たない。design D1）。
 */
export type NewCwdPolicy = NewCwd["policy"];
const NEW_CWD_POLICIES: readonly NewCwdPolicy[] = ["follow", "home", "current", "path"];

/** 保存された方針を読む。**4 つのどれかでなければ既定の「引き継ぐ」**（herdr の既定と同じ。AC4）。 */
export function loadNewCwdPolicy(raw: unknown): NewCwdPolicy {
  return NEW_CWD_POLICIES.includes(raw as NewCwdPolicy) ? (raw as NewCwdPolicy) : "follow";
}

/** 保存された「指定した場所」を読む。文字列でなければ空（検証はサーバ。空なら使えない場所として知らされる）。 */
export function loadNewCwdPath(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

/**
 * 作成の要求に載せる形を作る。**`sourcePaneId` は「引き継ぐ」のときだけ**、null なら載せない（元の pane が無い →
 * サーバが以前と同じ場所で開く。design D7）。「指定した場所」は入れたままの文字列を送る（`~` の展開と検証はサーバ）。
 */
export function buildNewCwd(
  policy: NewCwdPolicy,
  path: string,
  sourcePaneId: string | null,
): NewCwd {
  switch (policy) {
    case "follow":
      return sourcePaneId === null ? { policy } : { policy, sourcePaneId };
    case "home":
    case "current":
      return { policy };
    case "path":
      return { policy, path };
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const initial = readPrefs();
  /** 状態を色に加えて記号でも示すか（`StateIcon.vue` が読む）。 */
  const statusSymbols = ref(loadStatusSymbols(initial["statusSymbols"]));
  /** このブラウザの scrollback の設定。使う行数は `term/scrollback.ts` の `effectiveScrollback` が決める。 */
  const scrollback = ref<ScrollbackPref>(loadScrollbackPref(initial["scrollback"]));
  /** 新しい workspace・tab・分割を開く場所の方針と、「指定した場所」のパス（方針が `path` のときだけ使う）。 */
  const newCwdPolicy = ref<NewCwdPolicy>(loadNewCwdPolicy(initial["newCwdPolicy"]));
  const newCwdPath = ref(loadNewCwdPath(initial["newCwdPath"]));
  /**
   * テーマ（20260921-theme-settings）。1 つのテーマ・自動の切替・明るいとき・暗いとき（null＝まだ選んでいない＝1 つのテーマの対）。
   * 読み込みは値ごとに落とす（`loadThemePrefs`。AC4）。
   */
  const themePrefs = loadThemePrefs(initial);
  const theme = ref<ThemeName>(themePrefs.theme);
  const themeAuto = ref(themePrefs.auto);
  const themeLight = ref<ThemeName | null>(themePrefs.light);
  const themeDark = ref<ThemeName | null>(themePrefs.dark);
  /** OS（ブラウザ）の明暗が暗いか。`ThemeController.start()` が `matchMedia` の値で上書きし、変化を追う（初期は暗い＝herdr の「分からなければ暗い」）。 */
  const systemDark = ref(true);
  /** いま使うテーマ（名前の解決は `theme/themes.ts` の `resolveTheme` の 1 か所）。 */
  const effectiveTheme = computed<ThemeName>(() =>
    resolveTheme(
      { theme: theme.value, auto: themeAuto.value, light: themeLight.value, dark: themeDark.value },
      systemDark.value,
    ),
  );

  /** 反映と保存を同時に行う（確定ボタンを置かない。AC-I2）。 */
  function setStatusSymbols(v: boolean): void {
    statusSymbols.value = v;
    writePrefs({ statusSymbols: v });
  }

  /** 反映と保存を同時に行う。**効くのはその後に作る端末から**（既に開いている pane は変えない。AC9）。 */
  function setScrollback(v: ScrollbackPref): void {
    scrollback.value = v;
    writePrefs({ scrollback: v });
  }

  /** 反映と保存を同時に行う。**効くのは次に開く workspace・tab・分割から**（既に開いている pane は変えない。AC10）。 */
  function setNewCwdPolicy(v: NewCwdPolicy): void {
    newCwdPolicy.value = v;
    writePrefs({ newCwdPolicy: v });
  }

  /** 反映と保存を同時に行う。呼ぶのは入れ終えたとき（入力欄の `change`）だけ——打ちかけの値で開かない（AC-I2）。 */
  function setNewCwdPath(v: string): void {
    newCwdPath.value = v;
    writePrefs({ newCwdPath: v });
  }

  /**
   * 1 つのテーマを選ぶ。反映と保存を同時に行う。**自動の切替が入っていたら切る**（herdr の「設定画面で手で選ぶと auto_switch が切れる」。AC7）。
   */
  function setTheme(v: ThemeName): void {
    theme.value = v;
    themeAuto.value = false;
    writePrefs({ theme: v, themeAuto: false });
  }

  /** 自動の切替の入切。切ると 1 つのテーマに戻る（`resolveTheme`。AC7）。 */
  function setThemeAuto(v: boolean): void {
    themeAuto.value = v;
    writePrefs({ themeAuto: v });
  }

  /** 明るいときのテーマ。null で既定（1 つのテーマの対）に戻り、また追従する（design D7）。 */
  function setThemeLight(v: ThemeName | null): void {
    themeLight.value = v;
    writePrefs({ themeLight: v });
  }

  /** 暗いときのテーマ。null で既定に戻る。 */
  function setThemeDark(v: ThemeName | null): void {
    themeDark.value = v;
    writePrefs({ themeDark: v });
  }

  return {
    statusSymbols,
    scrollback,
    newCwdPolicy,
    newCwdPath,
    theme,
    themeAuto,
    themeLight,
    themeDark,
    systemDark,
    effectiveTheme,
    setStatusSymbols,
    setScrollback,
    setNewCwdPolicy,
    setNewCwdPath,
    setTheme,
    setThemeAuto,
    setThemeLight,
    setThemeDark,
  };
});
