# 仕様: 外観と設定の残り（サイドバー行・tab バー・pane 枠・設定の再読み込み）

## 概要

requirements の US1〜US5 を、既存の PJ の語彙（`view.ts`/`settings.ts` の `wtm.prefs.v1` パターン・
`SettingsDialog.vue` の switch/radio パターン・`Sidebar.vue` の区画ヘッダー）にそのまま乗せて実装する。
新規のコンポーネント・新規の状態管理の仕組みは作らない（既存の5パターンの模倣で閉じる）。

## 設計方針

- **workspace の並び順トグルは、設定画面ではなく Sidebar 自身に置く**（decisions D2。requirements.md
  の「設定画面のトグル」という記述は、実装を確認する前の誤った推測だった。agents 区画の実物の
  トグルは Sidebar.vue 自身の区画ヘッダーのボタンであり、SettingsDialog.vue には存在しない）。
- pane の枠・隙間の太さは、CSS 変数を新設し `PaneFrame.vue`・`Splitter.vue` の両方がそれを読む形に
  する（今は両者がそれぞれ生の `4px` を持っており、1つの設定値で揃えるには変数を配る口が要る）。
- reload_config は、`ActionDispatcher` が既に保持している3ストア（`session`・`view`・`settings`）
  のうち、`wtm.prefs.v1` 由来の設定を持つ `settings`・`view` の2つだけを対象にする（`session` は
  サーバから届くセッションの状態で `wtm.prefs.v1` を持たないため対象にならない。通知の設定・
  `wtm.seen.v1` も対象外——decisions D4）。

## 対象範囲

- 変更: `packages/web/src/store/view.ts`（`workspaceSort`）・`packages/web/src/store/settings.ts`
  （`paneFrameThickness`・`paneAgentNameVisible`）・`packages/web/src/components/Sidebar.vue`
  （spaces 区画のヘッダー・並び替え）・`packages/web/src/components/TabBar.vue`（自動非表示・
  時刻表示）・`packages/web/src/components/PaneFrame.vue`（枠の太さの CSS 変数化・エージェント名の
  可視表示）・`packages/web/src/components/Splitter.vue`（隙間の太さの CSS 変数化）・
  `packages/web/src/components/SettingsDialog.vue`（`paneFrameThickness`・`paneAgentNameVisible`
  の2設定の UI。`workspaceSort` は Sidebar 自身の UI なので対象外——D2 参照）・`packages/web/src/App.vue`
  （枠・隙間の CSS 変数を `:root` 相当へ配る）・`packages/web/src/keys/actions.ts`（`reloadConfig`
  action）・`packages/web/src/keys/bindings.ts`（`ACTIONS` への登録）・
  `packages/web/src/keys/keymap.ts`（`NOT_YET_BINDINGS` から `shift+r` を外す）・
  `packages/web/src/actions/ActionDispatcher.ts`（`reloadConfig` の処理）。
- 新規: 無し（既存ファイルの拡張のみで閉じる）。

## 依拠する既存の事実

- `Sidebar.vue:184-191` — agents 区画のトグルは `.sidebar-section-header` 内の
  `.sidebar-btn.sidebar-sort-btn`（`view.toggleAgentSort()`）。`.sidebar-spaces` 区画
  （`Sidebar.vue:147-172`）には現状この見出し行が無い。
- `view.ts:35-78` — `AgentSort` 型・`loadAgentSort`/`saveAgentSort`・`agentSort` ref・
  `toggleAgentSort()` が、新設する `workspaceSort` の型紙。`readPrefs`/`writePrefs`
  （`view.ts:50-69`）が `wtm.prefs.v1` の唯一の読み書き口。
- `PaneFrame.vue:133-136` — `.pane-frame-enabled { padding: 4px; }`。コメントで
  「`Splitter` の 4px と同じにする」と明記（意図的に揃えている）。`Splitter.vue:121-127` も
  同じ `4px` の生値。どちらも太さの値そのものは CSS 変数化されていない（色は
  `--wtm-menu-border`・`--wtm-pane-current` 等を使用済み。`PaneFrame.vue:147`・
  `Splitter.vue:114`）。
- `PaneFrame.vue:39-46,97-124` — `paneName`（`paneNameOf(pane, "")`。空文字が「無し」）は
  `aria-label` にしか使われていない。テンプレートは `.pane-frame`（padding を持つ枠本体）→
  `.pane-frame-edge`（`position:absolute; inset:0`。メニューを開くクリック層）＋
  `.pane-frame-body`（`<slot/>`。端末本体）の2層構造で、可視テキストを置く既存の場所が無い。
- `TabBar.vue` 全体・`App.vue:48` — tab を閉じるボタンは TabBar.vue に無く、右クリックの
  `ContextMenu`（kind:"tab"）→ `ActionDispatcher.closeTabById`（`ActionDispatcher.ts:451-458`）
  経由。tabs は `TabBar.vue:16-20` の computed `tabs` で自己完結して持っている。`App.vue:48` は
  `<TabBar />` を `v-if` 無しで置くだけ。`MobileShell.vue` は `TabBar` を import・使用しておらず
  （`grep` で `TabBar` 参照 0 件）、別の `mobile-shell-title` ボタン方式（`MobileShell.vue:81`。
  `workspaceLabel / tabLabel` を表示し、タップでピッカーを開く）なので、自動非表示はモバイルに
  影響しない。
- `PaneFrame.vue:53-61` — 要素が消えるときにフォーカスが失われた場合の既存パターン
  （`onBeforeUnmount` で `document.activeElement` が `body` に落ちていたら
  `registry?.focus(view.focusedPaneId)` で選択中 pane の端末へ戻す）。TabBar の自動非表示に
  最も近い先例（ダイアログの `preDialogFocusPaneId` 方式より単純で、こちらが適合する——
  「開く前の場所」の概念が無く、単に「今選ばれている pane」へ戻すだけでよいため）。
- `SettingsDialog.vue:357`（`<button type="button" role="switch" class="settings-switch"
  :aria-checked="settings.statusSymbols" ...>`。`statusSymbols`）・`SettingsDialog.vue:367-386`
  （`fieldset.settings-fieldset`＋`radio`。`scrollback`・`newCwdPolicy`）— この PJ の既存の
  UI 語彙。3択（枠の太さ）は radio 群、2値（エージェント名表示）は switch に、そのまま乗せる。
- `keymap.ts:25-28` — `NOT_YET_BINDINGS` の `["shift+r", { type: "notYet", work: "外観と設定" }]`。
  `ActionDispatcher.ts:147-148` の `case "notYet"` が `view.toast(...)` で案内する。
  `bindings.ts` の `ACTIONS` へ正式に登録すると、`keymap.ts:23-24` のコメントが言う「どの操作にも
  使われていないときだけ NOT_YET に入る」規則により自動的に NOT_YET から外れる。
- `actions.ts:47-73` の `Action` 判別共用体・`ActionDispatcher.ts:71` の `dispatch` の `switch`
  （`ActionDispatcher.ts:139` のコメントが「`switch` に `default` も網羅性の検査も無い」と明記）
  — `reloadConfig` を1行ずつ追加する形。`ActionDispatcher` のコンストラクタ
  （`ActionDispatcher.ts:48-51`）は `session`/`view`/`settings` の3ストアを保持
  （`seen`/`notifications` は保持していない）。
- `view.ts:307-312` の `view.toast(message)` — `notYet` ケースと同じ仕組みで、AC14 の「一言で
  分かる」をそのまま踏襲できる。`Toast.vue:68` の `.toast-list` が `role="status"`
  相当（読み上げ）を持つ。
- **reload_config が対象にする既存項目と、それぞれの `load*` 関数の所在**（この work のベース
  時点。いずれも `readPrefs()` から読んだ `wtm.prefs.v1` の値を渡す形）:
  `statusSymbols`→`loadStatusSymbols`（`settings.ts:32-34`）・`scrollback`→
  `loadScrollbackPref`（`term/scrollback.ts`）・`newCwdPolicy`→`loadNewCwdPolicy`
  （`settings.ts:44-46`）・`newCwdPath`→`loadNewCwdPath`（`settings.ts:49-51`）・
  `theme`/`themeAuto`/`themeLight`/`themeDark`→`loadThemePrefs`（`theme/themes.ts`。1関数が
  4項目まとめて返す）・`sidebarWidth`→`loadSidebarWidth`（`view.ts:90-93`）・
  `sidebarCollapsed`→`loadSidebarCollapsed`（`view.ts:96-98`）・`agentSort`→`loadAgentSort`
  （`view.ts:71-74`）。**いずれも関数自体は存在を確認済み**——ただし `settings.ts` 側
  （`loadStatusSymbols` 等）は `raw: unknown` を引数に取る純粋関数（呼ぶ側が
  `readPrefs()["<キー>"]` を渡す形）なのに対し、`view.ts` 側（`loadSidebarWidth` 等）は
  `readPrefs()` を自分で呼ぶ自己完結型で、**呼び出し方が2系統に分かれる**（「US5」節で扱う）。
  すべてが `export` されているか（`settings.ts`/`view.ts` の外から呼べるか）は tasks 工程で
  確認する（「design への申し送り」参照。関数の存在自体は確認済みなので、確認が要るのは
  export の有無だけ）。
- **`keyboardLockInFullscreen` は、この work のベース（`main`。20260922-keybinding-usability の
  PR #14 は未マージ）には存在しない**（decisions D3）。requirements.md の対象節が例として挙げて
  いたが、この branch のコードには無いので reload_config の対象一覧からは外す（「少なくとも」の
  例示なので、requirements の完了条件〔AC13〕とは矛盾しない）。
- `wtm.seen.v1`（`store/seen.ts`）は書き込み専用（`seen.ts:38` の `markSeen` だけを外部へ返す
  `return { seen, getSeenSeq, markSeen }`〔`seen.ts:44`〕。読み直す公開関数が無い）で、
  `ActionDispatcher` も `seen` ストアを保持していない。requirements.md の「対象」節は
  `wtm.seen.v1` も挙げていたが、AC13 の完了条件（「少なくとも」の例示）には含まれておらず、
  この work では `wtm.prefs.v1` 由来の設定（`settings`・`view` ストア）だけを対象にする
  （decisions D4）。

## インターフェース / データ構造

### `view.ts`（workspace の並び順）

```ts
export type WorkspaceSort = "opened" | "name";

function loadWorkspaceSort(): WorkspaceSort {
  const v = readPrefs()["workspaceSort"];
  return v === "name" || v === "opened" ? v : "opened";
}
function saveWorkspaceSort(v: WorkspaceSort): void {
  writePrefs({ workspaceSort: v });
}
// store 内：
const workspaceSort = ref<WorkspaceSort>(loadWorkspaceSort());
function toggleWorkspaceSort(): void {
  workspaceSort.value = workspaceSort.value === "opened" ? "name" : "opened";
  saveWorkspaceSort(workspaceSort.value);
}
```
`agentSort`/`toggleAgentSort`（`view.ts:35-78,287-290`）と1:1で対応させる（入力の出所は
`wtm.prefs.v1` の `workspaceSort` キー。既存の `agentSort` キーと同じ階層）。表示名は
`Sidebar.vue` 側に `WORKSPACE_SORT_LABEL: Record<WorkspaceSort, string> = { opened: "開いた順",
name: "名前順" }`（`AGENT_SORT_LABEL`。`Sidebar.vue:37` と同じパターン）を持たせる。

### `settings.ts`（pane の枠・隙間の太さ／エージェント名表示）

```ts
export type PaneFrameThickness = "thin" | "default" | "thick";
export const PANE_FRAME_THICKNESS_PX: Record<PaneFrameThickness, number> = {
  thin: 2, default: 4, thick: 6,
};
export function loadPaneFrameThickness(raw: unknown): PaneFrameThickness {
  return raw === "thin" || raw === "default" || raw === "thick" ? raw : "default";
}
export function loadPaneAgentNameVisible(raw: unknown): boolean {
  return typeof raw === "boolean" ? raw : false;
}
```
`statusSymbols`/`loadStatusSymbols`（`settings.ts:32-34`）と同じ形。入力の出所は
`wtm.prefs.v1` の `paneFrameThickness`／`paneAgentNameVisible` キー。

### `actions.ts`（reload_config）

```ts
| { type: "reloadConfig" }
```
`Action` 判別共用体（`actions.ts:47-73`）へ1行追加。入力（起動のきっかけ）は `prefix+shift+r`
という既存のキー入力そのもの（`bindings.ts` の `ACTIONS` への具体的な登録内容は「US5」節を
参照。取り込み・照合ロジックは 20260921-keybinding-customization のものをそのまま使う）。

### `PaneFrame.vue`／`Splitter.vue`（CSS 変数）

`App.vue` の `:root` 相当（`App.vue:87-108` 付近、既存の `--wtm-*` 変数を定義している場所）に
`--wtm-pane-gap` を追加し、値は `settings.paneFrameThickness` から
`PANE_FRAME_THICKNESS_PX` で引いた px 数を `App.vue` のトップレベル要素へ `:style` で
バインドする（テーマ切り替えと同じ「CSS 変数をトップで束ねて配る」方式。入力の出所は
`settings.paneFrameThickness`）。`PaneFrame.vue:134-136`・`Splitter.vue:121-127` は
`4px` の生値を `var(--wtm-pane-gap, 4px)` に置き換える。

## 振る舞いの詳細

### US1: workspace の並び順（AC1〜AC3）

- `Sidebar.vue` の `.sidebar-spaces` 区画の先頭に、`.sidebar-agents` と同じ形の
  `.sidebar-section-header`（`title="spaces"` + 並び順ボタン）を追加する
  （`.sidebar-collapsed` のときは非表示。既存の `.sidebar-section-header` の `v-if` 条件を踏襲）。
- `spaces` computed（`Sidebar.vue:23-30`）に、`view.workspaceSort === "name"` のときだけ
  `workspace.label` の文字列比較（`localeCompare`）で並べ替える分岐を足す（`agents` の
  `grouped`/`priority` 分岐と同じ形。`Sidebar.vue:44-58`）。
- ラベル表記は「インターフェース / データ構造」節の `WORKSPACE_SORT_LABEL` を使う。

### US2: tab バーの自動非表示（AC4〜AC6, AC-I6）

- `TabBar.vue` のルート要素に `v-if="tabs.length > 1"` を足す（`App.vue` 側は変更しない——
  ロジックをコンポーネント内に閉じる）。
- `PaneFrame.vue:53-61` と**同じ形の `onBeforeUnmount`**を `TabBar.vue` に足し（先例をそのまま
  踏襲する。`watch` 等の別方式は採らない）、非表示になる直前に `document.activeElement` が
  `TabBar.vue` のルート要素の内側にあれば、`nextTick` 後に選択中 pane（`view.focusedPaneId`）の
  端末へ `registry.focus(...)` でフォーカスを戻す。

### US3: tab バーの時刻表示（AC7〜AC8）

- `TabBar.vue` に `now = ref(new Date())` を持たせ、`onMounted` で
  `setInterval(() => (now.value = new Date()), 15_000)`（15秒ごと。分の変わり目を最大15秒の
  遅延で拾う。AC8 の「定期的に更新」を満たしつつ、毎秒更新するほどの精度は不要と判断）、
  `onUnmounted` で `clearInterval`。表示は `now` を `HH:mm`（24時間表記。`Intl.DateTimeFormat`
  或いは `padStart` の手組み。design ではどちらでもよく、既存コードに `Intl` の使用例が無ければ
  手組みに揃える）で整形し、tab 一覧と「＋」ボタンの間、または「＋」ボタンの右に置く
  （`aria-hidden="true"` — 時計は装飾的な情報で、スクリーンリーダーの読み上げ順に割り込ませない。
  OS 側の時計と重複する情報のため）。

### US4: pane の枠・隙間の太さ／エージェント名（AC9〜AC12, AC-I2, AC-I4）

- 太さ：`SettingsDialog.vue` の「表示」節に `fieldset.settings-fieldset`（`scrollback` と同じ
  形）を追加し、3つの radio（細い/既定/太い）を `settings.paneFrameThickness` にバインドする。
  選ぶたびに（確認ダイアログを挟まず）`settings.setPaneFrameThickness(v)` を呼び、
  `App.vue` の `--wtm-pane-gap` が再計算される（リアクティブ。ページの再読み込み不要）。
  選んだ radio 自体にフォーカスは残る（`scrollback`/`newCwdPolicy` の既存の radio 群と同じ
  ネイティブの挙動で、明示的にフォーカスを移すコードは書かない。AC-I2・AC-I4）。
- エージェント名：`SettingsDialog.vue` の「表示」節に `.settings-switch`
  （`statusSymbols` と同じ形）を追加。有効なとき、`PaneFrame.vue` に
  `<span v-if="settings.paneAgentNameVisible && paneName" class="pane-frame-name"
  aria-hidden="true">{{ paneName }}</span>` を `.pane-frame-edge` の中（`position:absolute`
  の層。既存のクリック領域と重ならないよう、隅に小さく配置し `pointer-events: none` で
  メニューを開くクリックを妨げない）に追加する。`aria-hidden`：既存の `aria-label`
  （`PaneFrame.vue:45-48`）が同じ情報を読み上げ用に持っているため、可視のラベルを二重に
  読み上げさせない。

### US5: 設定の再読み込み（AC13〜AC15）

- `bindings.ts` の `ACTIONS` に `{ id: "reload_config", label: "設定を読み直す", group: "全体",
  defaults: ["prefix+shift+r"], action: { type: "reloadConfig" } }` を追加（グループ・既定は
  `keymap.ts` の `NOT_YET_BINDINGS` の位置〔prefix 後・`全体`〕を踏襲）。
- `keymap.ts:25-28` の `NOT_YET_BINDINGS` から `["shift+r", ...]` の行を削除する。
- `ActionDispatcher.ts` の `dispatch` に `case "reloadConfig":` を追加し、`settings`・`view`
  各ストアの `load*` 関数を呼び直して対応する ref へ再代入する。呼び出し方は「依拠する既存の
  事実」で述べた2系統をそれぞれ踏襲する——`settings.ts` 側（`statusSymbols`・`scrollback`・
  `newCwdPolicy`・`newCwdPath`・`theme`系4つ・`paneFrameThickness`・`paneAgentNameVisible`）は
  先に `readPrefs()` を1回呼んで、各キーの値を `loadXxx(raw)` へ渡す形。`view.ts` 側
  （`sidebarWidth`・`sidebarCollapsed`・`agentSort`・`workspaceSort`）は `loadXxx()` を
  引数無しでそのまま呼ぶ形（内部で自分の `readPrefs()` を呼ぶため）。最後に
  `this.view.toast("設定を読み直しました。")`。workspace・tab・pane の構成・
  フォーカスには一切触れない（AC15）。

## ドメイン固有の考慮

- herdr の `reload_config` は「設定ファイルを読み直す」操作だが、本製品には設定ファイルが無い。
  この work では「同じ `localStorage` を、いま開いている画面へ改めて読み込む」という、
  本製品の実情に即した意味に読み替える（requirements「背景」で既述）。

## エラー処理 / 異常系

- `readPrefs()`（`view.ts:50-58`）は元々 try/catch で壊れた値・読めない環境を吸収済み。
  reload_config も同じ `load*` 関数を経由するだけなので、個別の異常系処理は追加しない
  （壊れた値は各 `load*` が既定へ落とす。既存の起動時の読み込みと同じ安全性）。
- `setInterval`（時刻表示）は `onUnmounted` で必ず `clearInterval` する（`TabBar.vue` が
  `v-if` で消えるとき・ページ遷移時のリーク防止）。

## 受け入れ基準との対応

- AC1: `Sidebar.vue` の spaces 区画ヘッダーに並び順ボタンを追加（US1 節）。入力は `view.workspaceSort`。
- AC2: `spaces` computed の `name` 分岐（`workspace.label` の文字列比較）。
- AC3: `toggleWorkspaceSort()` → `saveWorkspaceSort()`（`wtm.prefs.v1`）。既定 `"opened"`。
- AC4: `TabBar.vue` ルートの `v-if="tabs.length > 1"`。
- AC5: 同上（`tabs.length` は `session.tabs`/`view.tabId` から自動で再計算される computed）。
- AC6: `TabBar.vue` 自体の消滅は、キー入力の処理経路（`KeyRouter.handle`/`handleInPrefix`。
  `KeyRouter.ts:75-134` 付近。`prefix+n`/`prefix+p` はここが読む `prefixMap` のエントリで、
  DOM の tab バーの表示・非表示とは独立している）に一切触れないので、既存のキー操作はそのまま動く。
- AC7: `now` ref の初期値・テンプレートの時刻表示。
- AC8: `setInterval` による定期更新。
- AC9: `paneFrameThickness` の radio 群 → `--wtm-pane-gap` → `PaneFrame.vue`/`Splitter.vue`。
- AC10: `paneAgentNameVisible` の switch、既定 `loadPaneAgentNameVisible` が `false` を返す。
- AC11: `PaneFrame.vue` の `<span class="pane-frame-name">`（`v-if="settings.paneAgentNameVisible
  && paneName"`）。
- AC12: 同上の `v-if` が `false` のときは何も描画しない（今までどおり `aria-label` だけ）。
- AC13: `ActionDispatcher` の `case "reloadConfig"` が各ストアの `load*` を呼び直す。
- AC14: `view.toast("設定を読み直しました。")`。
- AC15: `case "reloadConfig"` は `session`/`registry` に一切触れない（`settings`/`view` の
  設定用 ref だけを更新する）。
- AC-I1: workspace 並び順ボタン・時刻表示それぞれの扱いは US1/US3 節に記載のとおり（並び順
  ボタンはモーダル・ダイアログのような開閉の概念を持たない——Sidebar 自体の表示・折りたたみ
  〔`sidebarCollapsed`〕には従うが、それは既存の agents 区画のトグルと同じ扱いで、この work が
  新設する開閉ではない。時刻表示は受け身表示で対象外）。枠の太さ・エージェント名 switch は
  同じく開閉の概念を持たない設定画面の部品（`SettingsDialog.vue` の他の switch/radio と同じ）。
- AC-I2: radio・switch とも選択・クリックの瞬間に `set*`/`toggle*` を呼び、確認は挟まない
  （US4 節）。`prefix+shift+r` も押した瞬間に確定（US5 節）。
- AC-I3: radio 群・switch は `<fieldset>`/`role="switch"` の既存パターンをそのまま使うので、
  既存の Tab 順・Enter/Space・矢印キー（radio）で操作できる。
- AC-I4: 選択操作は `set*` 呼び出しだけでフォーカスを動かすコードを書かない（既存の
  `statusSymbols`/`scrollback` の switch/radio と同じ、フォーカス移動なしの実装）。
- AC-I5: `bindings.ts` への新規登録は `defaults: ["prefix+shift+r"]`。この chord は
  `keymap.ts:25-28` の `NOT_YET_BINDINGS` に既に**予約済み**（今までも他の操作の割り当てには
  使えない扱いだった）ので、`ACTIONS` へ正式に登録しても新たな重複は生まれない
  （`keymap.ts:23-24` のコメントが言う「どの操作にも使われていないときだけ NOT_YET に入る」規則
  どおり、登録した瞬間に NOT_YET から外れるだけ）。利用者による**取り込み時**の衝突判定
  （`assign.ts` の `validateAssignment`/`validateBinding`。`assign.ts:62,111`）はこの静的な
  `ACTIONS` の重複とは別の仕組み（利用者が新しく割り当てようとした chord を検査する）で、
  ここでは対象にしていない。
- AC-I6: `TabBar.vue` の `onBeforeUnmount`/`watch` によるフォーカス退避（US2 節）。

## design への申し送り（tasks 向け）

- pane の枠の太さ・隙間を1つの CSS 変数で揃える設計（`--wtm-pane-gap`）は、`PaneFrame.vue` と
  `Splitter.vue` の両方を同時に変更する必要がある——1タスクにまとめるか、依存関係を明示して
  2タスクに分けるかは tasks 工程で決める。
- `ActionDispatcher.ts` の `reloadConfig` 分岐が呼ぶ各 `load*` 関数の**存在**は「依拠する既存の
  事実」で確認済みだが、**`export` されているか**（`ActionDispatcher.ts` から import できるか。
  一部は `settings.ts`/`view.ts` の内部限定のままかもしれない）は tasks の実装前に確認する。
