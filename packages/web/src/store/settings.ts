import type { NewCwd, ThemeName } from "@wtm/protocol";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ActionId } from "../keys/bindings.js";
import {
  emptyKeyPrefs,
  loadKeyPrefs,
  serializeKeyPrefs,
  withBindings,
  withoutBindings,
  withPrefix,
  type KeyPrefs,
} from "../keys/keyPrefs.js";
import { resolveKeymap, type ResolvedKeymap } from "../keys/keymap.js";
import { loadThemePrefs, resolveTheme } from "../theme/themes.js";
import { loadScrollbackPref, type ScrollbackPref } from "../term/scrollback.js";
import {
  loadPaneBordersMode,
  loadTabBarPosition,
  loadTabBarRightEntries,
  loadTabBarRightSeparator,
  MAX_TAB_BAR_RIGHT_ENTRIES,
  type PaneBordersMode,
  type TabBarPosition,
  type TabBarRightEntry,
} from "../tabbar/tabBarRight.js";
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

/** 保存された boolean を読む。boolean でなければ渡した既定値（20260922-tabbar-pane-appearance の 4 つの入切に使う）。 */
function loadFlag(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/** tab が 1 つなら tab バーを自動的に隠すか。既定は herdr と同じ「切」（AC2）。 */
export function loadHideTabBarWhenSingleTab(raw: unknown): boolean {
  return loadFlag(raw, false);
}

/** pane 領域の外周の枠の有無。既定は herdr と同じ「入」（AC6）。 */
export function loadPaneOuterBorders(raw: unknown): boolean {
  return loadFlag(raw, true);
}

/** pane 間の隙間の有無。既定は herdr と同じ「入」（AC7）。 */
export function loadPaneGaps(raw: unknown): boolean {
  return loadFlag(raw, true);
}

/** pane の枠へのエージェント名表示。既定は herdr と同じ「切」（AC8）。 */
export function loadShowAgentLabelsOnPaneBorders(raw: unknown): boolean {
  return loadFlag(raw, false);
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

  /**
   * キーの割り当て（20260921-keybinding-customization。design「store」・D2）。**既定との差だけ**を持つ（`keys/keyPrefs.ts`）。読み込みは値ごとに落とす（AC8）。
   * ブラウザごと（herdr のキー設定はクライアントの機器の設定）。
   */
  const keyPrefs = ref<KeyPrefs>(loadKeyPrefs(initial["keys"]));
  /**
   * 解決した割り当ての表。`KeyRouter`（`main.ts` が変わるたびに差し替える）・キー一覧・トースト・通知の案内文が**同じ表**を見る。
   * 割り当てが変わったときだけ作り直す（押すたびには作らない）。
   */
  const keymap = computed<ResolvedKeymap>(() => resolveKeymap(keyPrefs.value).keymap);

  /**
   * tab バーと pane の枠の外観（20260922-tabbar-pane-appearance。herdr の `ui.tab_bar_*`/`ui.pane_*` 相当。
   * design「インターフェース / データ構造」）。**既定との差だけを持つ複合値（`keyPrefs`・`themeOverrides` の
   * ような「差が無くなれば消す」構造）にはしない**——8 項目とも単純なプリミティブ/配列で、既存の `statusSymbols`・
   * `newCwdPolicy` 等と同じ「常に書く」形に揃える（decisions D6）。
   */
  const tabBarPosition = ref<TabBarPosition>(loadTabBarPosition(initial["tabBarPosition"]));
  const hideTabBarWhenSingleTab = ref(loadHideTabBarWhenSingleTab(initial["hideTabBarWhenSingleTab"]));
  const tabBarRight = ref<TabBarRightEntry[]>(loadTabBarRightEntries(initial["tabBarRight"]));
  const tabBarRightSeparator = ref(loadTabBarRightSeparator(initial["tabBarRightSeparator"]));
  const paneBorders = ref<PaneBordersMode>(loadPaneBordersMode(initial["paneBorders"]));
  const paneOuterBorders = ref(loadPaneOuterBorders(initial["paneOuterBorders"]));
  const paneGaps = ref(loadPaneGaps(initial["paneGaps"]));
  const showAgentLabelsOnPaneBorders = ref(loadShowAgentLabelsOnPaneBorders(initial["showAgentLabelsOnPaneBorders"]));

  /**
   * 差し替えて保存する。**保存する形（`serializeKeyPrefs`）を読み直した結果を採る**——呼び出し側が検証（`validateAssignment`）を済ませているが、**読めない値**（構文が通らない文字列・
   * 送れない prefix）を渡されても反映せず捨てる（読み込みと同じ落とし方。二重の守り）。衝突・予約は読み込みの段では見ず、解決（`resolveKeymap`）が同じ規則で落とす（保存は残る）。
   * 状態も保存も同じなら何もしない（keymap を作り直さない・書かない）。**保存が状態と違うとき（壊れた `keys` が残っている等）は、状態はそのまま保存だけを直す**。差が無くなれば `keys` ごと消す。
   */
  function replaceKeyPrefs(next: KeyPrefs): void {
    const normalized = loadKeyPrefs(serializeKeyPrefs(next));
    const serialized = serializeKeyPrefs(normalized);
    const sameState =
      JSON.stringify(serialized ?? null) ===
      JSON.stringify(serializeKeyPrefs(keyPrefs.value) ?? null);
    const sameStored =
      JSON.stringify(serialized ?? null) === JSON.stringify(readPrefs()["keys"] ?? null);
    if (sameState && sameStored) return;
    if (!sameState) keyPrefs.value = normalized;
    writePrefs({ keys: serialized });
  }

  /**
   * 同じブラウザの別のウィンドウ・タブで割り当てが変わったら追従する。`writePrefs` は書くたびに保存された全体を読んで項目だけ差し替えるので、ほかの設定は先の変更を消さないが、
   * `keys` は 1 つのまとまりをメモリの状態から丸ごと書く——追従しないと、古い状態から別の変更をしたとき、先に保存された変更を上書きしてしまう。
   * `storage` は**ほかの**ウィンドウの書き込みでだけ発火する（自分の書き込みでは来ない）。
   */
  window.addEventListener("storage", () => {
    const fresh = loadKeyPrefs(readPrefs()["keys"]);
    if (
      JSON.stringify(serializeKeyPrefs(fresh) ?? null) !==
      JSON.stringify(serializeKeyPrefs(keyPrefs.value) ?? null)
    )
      keyPrefs.value = fresh;
  });

  /** prefix を変える（chord。null は既定へ）。反映と保存を同時に行う（確定ボタンを置かない。AC8）。 */
  function setKeyPrefix(chord: string | null): void {
    replaceKeyPrefs(withPrefix(keyPrefs.value, chord));
  }

  /** ある操作の割り当てを差し替える（空配列は「割り当てなし」）。既定と同じ内容になれば上書きを消す。 */
  function setKeyBindings(id: ActionId, bindings: readonly string[]): void {
    replaceKeyPrefs(withBindings(keyPrefs.value, id, bindings));
  }

  /** ある操作の上書きを消す（既定へ戻す。AC9）。 */
  function resetKeyAction(id: ActionId): void {
    replaceKeyPrefs(withoutBindings(keyPrefs.value, id));
  }

  /** prefix を既定へ戻す（AC9）。 */
  function resetKeyPrefix(): void {
    replaceKeyPrefs(withPrefix(keyPrefs.value, null));
  }

  /** すべてを既定へ戻す（AC9。`keys` を消す）。 */
  function resetAllKeys(): void {
    replaceKeyPrefs(emptyKeyPrefs());
  }

  /** 反映と保存を同時に行う（AC1）。 */
  function setTabBarPosition(v: TabBarPosition): void {
    tabBarPosition.value = v;
    writePrefs({ tabBarPosition: v });
  }

  /** 反映と保存を同時に行う（AC2）。 */
  function setHideTabBarWhenSingleTab(v: boolean): void {
    hideTabBarWhenSingleTab.value = v;
    writePrefs({ hideTabBarWhenSingleTab: v });
  }

  /**
   * `tabBarRight` を丸ごと差し替える。`loadTabBarRightEntries` を通して正規化・上限の切り詰めをしてから、
   * **状態にも保存にも同じ内容が既にあれば何もしない**（`replaceKeyPrefs` と同じ二重の比較——メモリの
   * 状態だけを見ると、別のタブが保存だけを直後に書き換えた場合に保存側のずれに気付けない。taskcheck
   * T3 で指摘）。`add`/`remove`/`move`/`update` の各操作からもこれを経由する。
   */
  function setTabBarRight(entries: readonly TabBarRightEntry[]): void {
    const normalized = loadTabBarRightEntries(entries);
    const serialized = JSON.stringify(normalized);
    const sameState = serialized === JSON.stringify(tabBarRight.value);
    const sameStored = serialized === JSON.stringify(readPrefs()["tabBarRight"] ?? []);
    if (sameState && sameStored) return;
    if (!sameState) tabBarRight.value = normalized;
    writePrefs({ tabBarRight: normalized });
  }

  /** 末尾に既定値のエントリを追加する（上限に達していたら何もしない。AC3）。 */
  function addTabBarRightEntry(kind: TabBarRightEntry["kind"]): void {
    if (tabBarRight.value.length >= MAX_TAB_BAR_RIGHT_ENTRIES) return;
    const entry: TabBarRightEntry =
      kind === "datetime" ? { kind, format: "time" } : kind === "text" ? { kind, text: "" } : { kind };
    setTabBarRight([...tabBarRight.value, entry]);
  }

  /** 指定した位置のエントリを消す（AC3）。 */
  function removeTabBarRightEntry(index: number): void {
    setTabBarRight(tabBarRight.value.filter((_, i) => i !== index));
  }

  /** 指定した位置のエントリを 1 つ隣と入れ替える。端では何もしない（AC3）。 */
  function moveTabBarRightEntry(index: number, direction: -1 | 1): void {
    const next = index + direction;
    if (index < 0 || index >= tabBarRight.value.length || next < 0 || next >= tabBarRight.value.length) return;
    const reordered = [...tabBarRight.value];
    const moved = reordered[index]!;
    reordered[index] = reordered[next]!;
    reordered[next] = moved;
    setTabBarRight(reordered);
  }

  /** 指定した位置のエントリを差し替える（datetime の書式・text の文字列の変更。AC3・AC4）。 */
  function updateTabBarRightEntry(index: number, entry: TabBarRightEntry): void {
    if (index < 0 || index >= tabBarRight.value.length) return;
    const next = [...tabBarRight.value];
    next[index] = entry;
    setTabBarRight(next);
  }

  /** 反映と保存を同時に行う（AC4）。 */
  function setTabBarRightSeparator(v: string): void {
    const normalized = loadTabBarRightSeparator(v);
    tabBarRightSeparator.value = normalized;
    writePrefs({ tabBarRightSeparator: normalized });
  }

  /** 反映と保存を同時に行う（AC5）。 */
  function setPaneBorders(v: PaneBordersMode): void {
    paneBorders.value = v;
    writePrefs({ paneBorders: v });
  }

  /** 反映と保存を同時に行う（AC6）。 */
  function setPaneOuterBorders(v: boolean): void {
    paneOuterBorders.value = v;
    writePrefs({ paneOuterBorders: v });
  }

  /** 反映と保存を同時に行う（AC7）。 */
  function setPaneGaps(v: boolean): void {
    paneGaps.value = v;
    writePrefs({ paneGaps: v });
  }

  /** 反映と保存を同時に行う（AC8）。 */
  function setShowAgentLabelsOnPaneBorders(v: boolean): void {
    showAgentLabelsOnPaneBorders.value = v;
    writePrefs({ showAgentLabelsOnPaneBorders: v });
  }

  /**
   * 同じブラウザの別のウィンドウ・タブでの変更に追従する（`keys` の listener と同じ理由。20260922-tabbar-pane-appearance
   * の 8 項目はどれも単純な値の「常に書く」形なので、保存値を読み直して違えば置き換えるだけでよい）。
   */
  window.addEventListener("storage", () => {
    const prefs = readPrefs();
    const nextPosition = loadTabBarPosition(prefs["tabBarPosition"]);
    if (nextPosition !== tabBarPosition.value) tabBarPosition.value = nextPosition;
    const nextHide = loadHideTabBarWhenSingleTab(prefs["hideTabBarWhenSingleTab"]);
    if (nextHide !== hideTabBarWhenSingleTab.value) hideTabBarWhenSingleTab.value = nextHide;
    const nextRight = loadTabBarRightEntries(prefs["tabBarRight"]);
    if (JSON.stringify(nextRight) !== JSON.stringify(tabBarRight.value)) tabBarRight.value = nextRight;
    const nextSeparator = loadTabBarRightSeparator(prefs["tabBarRightSeparator"]);
    if (nextSeparator !== tabBarRightSeparator.value) tabBarRightSeparator.value = nextSeparator;
    const nextBorders = loadPaneBordersMode(prefs["paneBorders"]);
    if (nextBorders !== paneBorders.value) paneBorders.value = nextBorders;
    const nextOuter = loadPaneOuterBorders(prefs["paneOuterBorders"]);
    if (nextOuter !== paneOuterBorders.value) paneOuterBorders.value = nextOuter;
    const nextGaps = loadPaneGaps(prefs["paneGaps"]);
    if (nextGaps !== paneGaps.value) paneGaps.value = nextGaps;
    const nextShowLabels = loadShowAgentLabelsOnPaneBorders(prefs["showAgentLabelsOnPaneBorders"]);
    if (nextShowLabels !== showAgentLabelsOnPaneBorders.value) showAgentLabelsOnPaneBorders.value = nextShowLabels;
  });

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
    keyPrefs,
    keymap,
    tabBarPosition,
    hideTabBarWhenSingleTab,
    tabBarRight,
    tabBarRightSeparator,
    paneBorders,
    paneOuterBorders,
    paneGaps,
    showAgentLabelsOnPaneBorders,
    setStatusSymbols,
    setScrollback,
    setNewCwdPolicy,
    setNewCwdPath,
    setTheme,
    setThemeAuto,
    setThemeLight,
    setThemeDark,
    replaceKeyPrefs,
    setKeyPrefix,
    setKeyBindings,
    resetKeyAction,
    resetKeyPrefix,
    resetAllKeys,
    setTabBarPosition,
    setHideTabBarWhenSingleTab,
    setTabBarRight,
    addTabBarRightEntry,
    removeTabBarRightEntry,
    moveTabBarRightEntry,
    updateTabBarRightEntry,
    setTabBarRightSeparator,
    setPaneBorders,
    setPaneOuterBorders,
    setPaneGaps,
    setShowAgentLabelsOnPaneBorders,
  };
});
