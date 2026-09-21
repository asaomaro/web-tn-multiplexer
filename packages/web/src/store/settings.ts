import type { NewCwd } from "@wtm/protocol";
import { defineStore } from "pinia";
import { ref } from "vue";
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

  return {
    statusSymbols,
    scrollback,
    newCwdPolicy,
    newCwdPath,
    setStatusSymbols,
    setScrollback,
    setNewCwdPolicy,
    setNewCwdPath,
  };
});
