# 仕様: タブバーと pane の枠の外観設定（herdr の `tab_bar_*`・`pane_*` 相当）

## 概要

設定画面の節「表示」に、herdr の `ui.tab_bar_position` / `ui.hide_tab_bar_when_single_tab` / `ui.tab_bar_right` /
`ui.tab_bar_right_separator` と `ui.pane_borders` / `ui.pane_outer_borders` / `ui.pane_gaps` /
`ui.show_agent_labels_on_pane_borders` に相当する 8 項目を追加する。既存の設定値と同じ形（`store/settings.ts` の
`ref` ＋ `load<Xxx>` 関数 ＋ `readPrefs`/`writePrefs`）に従い、`TabBar.vue`・`PaneFrame.vue`・`Splitter.vue` へ
反映する。pane 側は「視覚のみ・ボックス寸法は不変」という制約（research F9・F11・F12）を厳守する。

## 設計方針

- 8 項目とも既存の設定パターン（20260921-herdr-settings-gaps 以降の節「表示」・節「テーマ」と同じ）を踏襲し、
  確定ボタンは置かず選んだ / 入力した時点で反映・保存する。
- pane の枠・隙間・外周は**色と描画の有無だけを切り替え、`padding`/`width`/`height` の数値は変えない**
  （research F9・F11・F12。PTY の cols/rows が変わる回帰を防ぐ）。
- tab バー右端のエントリは、herdr の自由度（strftime 書式・任意コマンド）をそのまま持ち込まず、
  本製品の既存の設定パターン（トグル・セレクト。research F14）に合わせて絞る：日時は書式のプリセット選択、
  固定文字列は 1 行のテキスト入力、Command 種別は対象外（requirements 対象外）。
- pane 枠のエージェント名表示は、herdr の「常時ラベル＋エージェント名の絞り込み」ではなく、**トグル自体が
  「枠にラベルを出すかどうか」を決める**（research F7 の申し送り。既定 off で現状（ラベル無し）を変えない）。
- 追加する 8 項目は既存の設定ダイアログ（節「表示」）の**中に増える行**であって、ダイアログを開く・閉じる操作
  （既存の `view.openDialog`／Esc 等）自体は変えない（AC-I1）。同様に、この work は新しいキー捕捉
  （`keydown` のグローバルハンドラ等）を一切追加しない——追加・削除・上へ/下への各ボタン、`<select>`、
  テキスト欄はいずれも既存のダイアログの DOM の中の通常のフォーム部品で、既存のキー配線
  （`KeyRouter`／`main.ts` の window keydown）に新しい分岐を作らない（AC-I5）。

## 対象範囲

- `packages/web/src/tabbar/tabBarRight.ts`（新規。`TabBarPosition`・`PaneBordersMode`・`TabBarRightEntry`・
  各 `load*`/`sanitize*`/`formatDatetime` 関数。「インターフェース / データ構造」節の中核）
- `packages/web/src/tabbar/tabBarClock.ts`（新規。日時エントリ用の 1 秒ごとの再描画）
- `packages/web/src/store/settings.ts`（新しい 8 つの設定値・load 関数・setter）
- `packages/web/src/components/SettingsDialog.vue`（節「表示」への UI 追加）
- `packages/web/src/components/TabBar.vue`（位置・自動非表示・右端エントリの描画）
- `packages/web/src/App.vue`（tab バーの位置に応じた並び〔`.app-main` 周辺〕・pane 領域の外周の視覚切り替え
  〔`.app-panes` の outline〕・`PaneLayout` へ `multiPane`／`showLabel` prop を渡す起点）
- `packages/web/src/components/PaneLayout.vue`（`multiPane`／`showLabel` prop を、既存の `paneFrames` prop
  と同じ要領で再帰的に子の `PaneLayout` へ引き継ぎ、葉の `PaneFrame`〔`PaneLayout.vue:178`〕へ渡す）
- `packages/web/src/components/PaneFrame.vue`（枠の 3 値〔`bordered` prop。`multiPane` と `paneBorders` から
  呼び出し側が計算した結果を受け取るだけで、自身は分割の有無を知らない〕・エージェント名ラベル）
- `packages/web/src/components/Splitter.vue`（隙間 off の視覚表現）
- `docs/herdr-parity.md`（H22・H23）・`docs/verification.md`
- `.aidev/backlog/product-roadmap.md`（該当項目を割って `[x]` にする。AC12）

## 依拠する既存の事実

- pane の枠は `PaneFrame.vue` の `.pane-frame-enabled { padding: 4px; }` で常に確保され、これは
  `PaneLayout.vue` の `ResizeObserver`（`PaneLayout.vue:94`。葉の要素を見て `client.view` を commit する。
  `:39` のコメント）が葉（枠の内側）を測って `client.view` を commit する土台になっている——padding の数値を
  変えると PTY の cols/rows が変わる（research F9・F11、`PaneFrame.vue:10-11,138-141`）。
- 分割の境界は `Splitter.vue` が独立して描く固定 4px の要素で、`PaneFrame` の padding とは別物
  （research F12、`Splitter.vue:108-129`）。
- pane 名の唯一の解決規則は `paneNameOf`（`packages/web/src/store/paneName.ts:11`。`label || agent?.label || title || fallback`）。
  この work のエージェント名ラベルもこれを経由する（research F10）。
- 「分割しているか」は `PaneLayout.vue` の `layout.type`（`"pane"` か `"split"` か）と `zoomedPaneId` で
  判定できる——zoom 中は実際に描かれる pane が 1 つなので、**表示上「分割していない」扱い**にする
  （既存の computed をそのまま使う。研究時点では未確認だったが、この design でコードを読み確認した：
  `PaneLayout.vue:110` `singlePaneId = computed(() => props.zoomedPaneId ?? (props.layout.type === "pane" ? props.layout.paneId : null))`、
  `PaneLayout.vue:111` `splitLayout = computed(() => (props.layout.type === "split" ? props.layout : null))`）。
- tab バー右端のホスト名は `session.host.hostname`（`packages/protocol/src/model.ts:94` の `HostInfo.hostname`。
  `packages/server/src/composeServer.ts:133` で `os.hostname()` を積む）を再利用する。サーバ・protocol の
  変更は無い（research F13・A6で確認済み）。
- `App.vue` の `.app-main` は `display:flex; flex-direction:column` で `<TabBar />` → `.app-panes` の順に並ぶ
  （`App.vue:47-49`,`:127-132`。研究時点では未確認、design で確認）。

## インターフェース / データ構造

```ts
// packages/web/src/tabbar/tabBarRight.ts（新規）
export type TabBarPosition = "top" | "bottom";
export type PaneBordersMode = "auto" | "always" | "off";
export type DatetimeFormat = "time" | "time-seconds" | "date" | "date-time";

export type TabBarRightEntry =
  | { kind: "zoom" }
  | { kind: "hostname" }
  | { kind: "datetime"; format: DatetimeFormat }
  | { kind: "text"; text: string };

export const MAX_TAB_BAR_RIGHT_ENTRIES = 16; // herdr の上限を踏襲（research F4）
export const MAX_TAB_BAR_TEXT_CHARS = 80; // herdr の MAX_STATUS_TEXT_CHARS を踏襲（research F4 の tab_bar_status.rs）
export const MAX_TAB_BAR_SEPARATOR_CHARS = 8; // herdr に上限は無いが、本製品では暴走防止に上限を設ける（herdr との違い）

export function loadTabBarPosition(raw: unknown): TabBarPosition;
export function loadPaneBordersMode(raw: unknown): PaneBordersMode;
export function loadTabBarRightEntries(raw: unknown): TabBarRightEntry[]; // 不正な要素は個別に落とす。上限超は切り詰め
export function loadTabBarRightSeparator(raw: unknown): string; // 制御文字を除去。既定 " "
export function sanitizeTabBarText(raw: string): string; // 制御文字除去＋MAX_TAB_BAR_TEXT_CHARS で切り詰め
export function formatDatetime(format: DatetimeFormat, now: Date): string; // Intl.DateTimeFormat ベースの固定プリセット
```

```ts
// packages/web/src/store/settings.ts への追加（既存の ref＋load 関数のパターンに従う）
tabBarPosition: Ref<TabBarPosition>;           // 既定 "top"
hideTabBarWhenSingleTab: Ref<boolean>;          // 既定 false
tabBarRight: Ref<TabBarRightEntry[]>;           // 既定 []
tabBarRightSeparator: Ref<string>;              // 既定 " "
paneBorders: Ref<PaneBordersMode>;              // 既定 "auto"
paneOuterBorders: Ref<boolean>;                 // 既定 true
paneGaps: Ref<boolean>;                         // 既定 true
showAgentLabelsOnPaneBorders: Ref<boolean>;     // 既定 false

function setTabBarRight(entries: TabBarRightEntry[]): void; // 上限・sanitize を通して丸ごと差し替え（immutable）
function addTabBarRightEntry(kind: TabBarRightEntry["kind"]): void; // 末尾に既定値で追加（上限なら何もしない）
function removeTabBarRightEntry(index: number): void;
function moveTabBarRightEntry(index: number, direction: -1 | 1): void; // 端なら何もしない
function updateTabBarRightEntry(index: number, entry: TabBarRightEntry): void; // datetime の書式・text の文字列の変更
```

- 保存形は `wtm.prefs.v1` に平坦なキーを追加する既存の流儀（`tabBarPosition`・`hideTabBarWhenSingleTab`・
  `tabBarRight`・`tabBarRightSeparator`・`paneBorders`・`paneOuterBorders`・`paneGaps`・
  `showAgentLabelsOnPaneBorders`）。**herdr のように「差が無くなれば消す」までは実装しない**——8 項目とも
  単純なプリミティブ/配列で、既存の `statusSymbols`・`newCwdPolicy` 等と同じ「常に書く」形に揃える
  （20260922-theme-custom-overrides の `themeOverrides`／20260921-keybinding-customization の `keys` のような
  「差分だけ持つ」構造は、複数キーにまたがる複合値でないこの work では過剰と判断。decisions に残す）。

## 振る舞いの詳細

### tab バーの位置（AC1）

- `TabBar.vue` に `position: TabBarPosition` prop を追加。ルート要素に `:style="{ order: position === 'bottom' ? 1 : 0 }"`
  を設定する（`App.vue` の `.app-main` は既に `flex-direction:column`。`order` だけで DOM 構造を変えずに視覚順を
  入れ替えられ、`ResizeObserver`・フォーカス順は変えない）。
- 境界線は位置に応じて変える：top のとき `border-bottom`（既存のまま）、bottom のとき `border-top`
  （区切り線が常に pane 領域との境になるように。既存コードには無い分岐なので新規に足す）。
- **アクセシビリティ上の注意**：DOM の順序（したがって Tab キーの移動順）は変えない。tab バーが下に表示されて
  いても、Tab で辿る順は「サイドバー→タブ→pane」のまま（視覚順と読み上げ順が一致しないが、多くのアプリの
  「下部タブバー」と同じ扱いとして許容する。決定として decisions に残す）。

### tab が 1 つなら自動的に隠す（AC2）

- `TabBar.vue` 内の `tabBarVisible = computed(() => tabs.value.length > 1 || !settings.hideTabBarWhenSingleTab)`。
  ルートの `<div class="tab-bar">` を `v-if="tabBarVisible"` にする。
- 隠れている間は「＋新しいタブ」ボタンも消える（herdr と同じ。research のとおり herdr もバーごと消す）。
  新しいタブを作る手段はキー操作・コンテキストメニューに残る（既存の `newTabInWorkspace` 呼び出し経路。
  この work では変えない）。

### tab バー右端のエントリ（AC3・AC4）

- `TabBar.vue` に「右端の帯」（`.tab-bar-right`）を追加。`settings.tabBarRight` を
  `settings.tabBarRightSeparator` で `join` して並べる。各エントリの文字列化:
  - `zoom`: いま表示中の tab が zoom 中なら `"Z"`、そうでなければ空文字（本製品の既存の zoom 表現
    `tab-bar-zoomed` の文字と揃える。空文字のときはその位置に何も出ない＝実質的にそのタイミングだけ
    区切り文字が連続することがあるが、これは herdr にも無い配慮に踏み込まず許容する）。
  - `hostname`: `session.host?.hostname ?? ""`。
  - `datetime`: `formatDatetime(entry.format, now)`。`now` は新設の `packages/web/src/tabbar/tabBarClock.ts`
    が 1 秒間隔で更新する `ref<Date>`（`tabBarRight` に `datetime` 種別が 1 つも無ければタイマーは動かさない
    ——不要な再描画を避ける）。プリセットは `Intl.DateTimeFormat("ja-JP", {...})` ベースの固定 4 種
    （`time`="HH:mm相当"・`time-seconds`="HH:mm:ss相当"・`date`="YYYY-MM-DD相当"・`date-time`=両方）。
    **herdr の任意の strftime 書式は持ち込まない**（対象外ではなく簡略化。docs にその旨を書く）。
  - `text`: `sanitizeTabBarText(entry.text)`（制御文字除去＋`MAX_TAB_BAR_TEXT_CHARS` 切り詰め）。
- 設定 UI（`SettingsDialog.vue`）: 「追加する種類」の `<select>`（zoom/hostname/datetime/text）＋
  「追加」ボタン（`MAX_TAB_BAR_RIGHT_ENTRIES` 到達で disabled）。追加された行は
  `<li>` の並びで、各行に「上へ」「下へ」（端で disabled）・「削除」ボタン。datetime 行は書式の
  `<select>`、text 行は 1 行の `<input type="text">`（`change`/`Enter` で確定。既存の
  `themeOverrides` の入力パターンに揃える）。区切り文字は独立した 1 行の `<input type="text">`
  （`MAX_TAB_BAR_SEPARATOR_CHARS` で切り詰め）。
- **削除後のフォーカスの行き先**（AC-I4）：`KeySettings.vue` の `removeBinding`（`KeySettings.vue:191-205`）と
  同じ考え方——削除した行の index を覚えておき、削除後に `nextTick` で「繰り上がった次の行の同じ種類のボタン」
  （無ければ「追加」ボタン）へフォーカスを移す。上へ/下へ・追加のボタンはその場でフォーカスが動かない
  （DOM 上の同じ要素に留まる）ので、この配慮が要るのは削除だけ。

### pane の枠・外周・隙間（AC5・AC6・AC7）

- 「そのタブが分割されているか」（`multiPane: boolean`）は **`App.vue` がタブごとに 1 回だけ**
  `currentTab.layout.type === "split"` から計算し（zoom 中は分割の有無に関わらず葉が 1 つしか描かれないため
  `zoomedPaneId` が立っていれば `false` 扱い）、既存の `paneFrames` prop（`PaneLayout.vue:186,190`）と
  同じ要領で `<PaneLayout>` に渡す。`PaneLayout.vue` はそれを再帰呼び出しへそのまま引き継ぎ
  （子の `<PaneLayout>` も同じ `multiPane` を受け取る）、葉の `PaneFrame`（`PaneLayout.vue:178`）へ渡す。
  **`PaneFrame.vue` 自身は分割の有無を知らない**——`bordered: boolean` という計算済みの結果だけを
  `PaneLayout.vue` から受け取る（`paneBorders==="always"` なら常に true、`"off"` なら常に false、
  `"auto"` なら `multiPane` の値。この 3 値の解決は `PaneLayout.vue` が行う）。
- `PaneFrame.vue` の枠の色は次のように分ける（`bordered`・`selected` の組で 3 状態）:
  - 非選択・`bordered=false`: 現状と同じ（枠なし。`.pane-frame-edge` に色を付けない）。
  - 非選択・`bordered=true`: **新規**——`--wtm-menu-border`（`Splitter.vue` の分割線と同じ色。research F12）の
    1px 枠を付ける。分割中の複数 pane を視覚的に区切る（herdr が分割中の非選択 pane にも `palette.overlay0`
    の枠を出す振る舞い（research F16。`src/ui/panes.rs:481-495`）に相当。ただし色そのものは herdr の
    `overlay0` ではなく本製品の既存トークン `--wtm-menu-border` を使う——新しい色トークンは増やさない）。
  - 選択中（`selected`）: 現状と同じ `.pane-frame-edge-current`（`--wtm-pane-current` の 2px 枠。
    `PaneFrame.vue:145`。既存実装。research F16 で追記したとおり、herdr は選択中の枠にも別の専用色
    `accent` を使っており、本製品の既存の「選択中だけ色を持つ」実装と考え方は同じ）。`bordered` の値に
    関わらず選択中は常にこの色を優先する（選択の強調は枠の設定より優先度が高い。既存の「強調は選択で起きる」
    方針を変えない）。
  **どちらも `padding: 4px` は変えない**（`role="button"`／クリックでメニューを開く当たり判定は
  `bordered` に関わらず維持。デザイン上の可視性の話であって操作性を削らない）。
- 外周（`paneOuterBorders`）: 分割領域全体を囲む枠。現状の実装には「外周だけの枠」という概念が無いため、
  `App.vue` の `.app-panes` に `outline`（`border` ではなく `outline` を使う——`border` はボックスの外寸を
  増やして `.app-panes` の内側の大きさを削り、`PaneLayout.vue` が測る葉の大きさ・ひいては PTY の cols/rows
  まで変わってしまう。`outline` はボックスモデルに参加しないため、その心配が無い）を新設し、
  `paneOuterBorders` に応じて `outline` の宣言ごとクラス（`app-panes-outer-borders`）の有無で切り替える
  （太さだけを個別に操作するのではなく、`outline` 自体を出すかどうかで表す。`outline` はどちらにせよ
  ボックスモデルに参加しないため、PTY の cols/rows に影響しない制約は変わらず満たされる。review で
  design と実装の手段の食い違いを指摘され修正——T5 taskcheck）。
- 隙間（`paneGaps`）: `Splitter.vue` の背景色を、`paneGaps` が true のとき既存の `--wtm-menu-border`、
  false のとき隣接する pane の背景色相当（`--wtm-bg`）に変える。**幅（4px）は変えない**——見た目には
  「線が消えて地続きに見える」変化になる（research F12 の結論どおり、幾何を変えず色だけで近似する）。

### pane 枠へのエージェント名表示（AC8）

- `PaneFrame.vue` に `showLabel: boolean` prop を追加（`settings.showAgentLabelsOnPaneBorders` を
  `App.vue` から渡す）。`showLabel` が true のときだけ、`paneNameOf(pane, "")` の結果を
  `.pane-frame-edge` の中（または隣接する小さな `<span>`）に可視テキストとして描く（空文字なら何も描かない）。
  `aria-label`（既存の `label`/`paneLabel` computed）はそのまま——可視ラベルと `aria-label` は同じ値だが
  別の DOM 要素（可視ラベルは装飾なので `aria-hidden="true"` を付け、スクリーンリーダーには
  メニューボタンの `aria-label` の方だけを読ませる。二重に読み上げない）。
- 手動名優先は `paneNameOf` の解決順そのもの（`label` が最優先）で自然に満たす（AC8。追加のロジック不要）。

### 既定値・回帰防止（AC9）

- 8 項目とも herdr の既定値と同じ意味の「現状維持」に揃える：`tabBarPosition="top"`・
  `hideTabBarWhenSingleTab=false`・`tabBarRight=[]`・`tabBarRightSeparator=" "`・`paneBorders="auto"`・
  `paneOuterBorders=true`・`paneGaps=true`・`showAgentLabelsOnPaneBorders=false`。
  **既定のまま着地後に見た目が変わる点が 2 つある**（herdr の既定に合わせた意図的な変更で、AC9 の
  「回帰させない」の例外として decisions に明記する。単独 pane は選択中の強調
  〔`.pane-frame-edge-current`〕を `bordered` の値に関わらず常に優先するため、単独 pane の見た目は
  変わらない——design 初期の想定はここが誤っていたため訂正した）：
  - `paneBorders="auto"`：**分割中の非選択 pane** に、今まで無かった 1px の枠（`pane-frame-edge-bordered`）が
    新しく付く（選択中の pane の 2px の強調はそのまま）。
  - `paneOuterBorders=true`：pane 領域の外周に、今まで無かった 1px の `outline` が新しく付く。

### 保存・追従（AC10）

- 既存の `statusSymbols` 等と同じパターン：`readPrefs()` から `load<Xxx>` で読み、setter は
  `writePrefs({ ...readPrefs(), <key>: value })` 相当（既存のヘルパーに従う）。`storage` イベントの
  ハンドラに 8 項目の再読込を追加する。

## ドメイン固有の考慮

- herdr は `Command` エントリでサーバ上の任意コマンドを実行するが、本製品はブラウザだけで完結する方針
  （AGENTS.md・過去の decisions の一貫した方針）に従い対象外にした（requirements 対象外）。
- herdr の strftime 書式・任意の色設定（`accent` 等、当 work の範囲外）と違い、日時はプリセット選択に
  簡略化した——本製品は「利用者が書く設定ファイルが無い」ため、自由記述の書式より GUI の選択式の方が
  一貫する（20260921-keybinding-customization・20260922-theme-custom-overrides と同じ考え方）。

## エラー処理 / 異常系

- 保存値が壊れている（型不一致・不明な `kind`・範囲外）場合は、その項目・その配列要素だけを落として既定に戻す
  （既存の `load<Xxx>` 関数群と同じ「値ごとに落とす」流儀）。
- `tabBarRight` が 16 件を超えて保存されていた場合は先頭 16 件だけを読み、残りは切り詰める（herdr と同じ上限。
  research F4）。

## 受け入れ基準との対応

- AC1: 「振る舞いの詳細 / tab バーの位置」（`TabBar.vue` の `position` prop・`order`）
- AC2: 「振る舞いの詳細 / tab が 1 つなら自動的に隠す」（`tabBarVisible` computed）
- AC3: 「振る舞いの詳細 / tab バー右端のエントリ」（`tabBarRight`・4 種のエントリ・並び替え UI）
- AC4: 同上（`tabBarRightSeparator`）
- AC5: 「振る舞いの詳細 / pane の枠・外周・隙間」（`paneBorders` の 3 値と `bordered` prop）
- AC6: 同上（`paneOuterBorders`・`.app-panes` の outline）
- AC7: 同上（`paneGaps`・`Splitter.vue` の背景色）
- AC8: 「振る舞いの詳細 / pane 枠へのエージェント名表示」（`showLabel` prop・`paneNameOf`）
- AC9: 「振る舞いの詳細 / 既定値・回帰防止」（`paneBorders="auto"` の意図的な例外を明記）
- AC10: 「振る舞いの詳細 / 保存・追従」
- AC11: 「対象範囲」（`docs/herdr-parity.md` H22・H23・`docs/verification.md`。反映は tasks で扱う）
- AC12: 「対象範囲」（`.aidev/backlog/product-roadmap.md`。反映は deliver で対応）
- AC-I1: 「設計方針」（既存の設定ダイアログ〔節「表示」〕に項目が増えるだけで、開閉の操作自体は変えない）
- AC-I2: 「振る舞いの詳細 / tab バー右端のエントリ」（トグル・セレクト・上へ/下へ/削除ボタンは押した時点で確定。
  テキスト欄〔text エントリ・区切り文字〕は `change`/Enter で確定。既存の `themeOverrides` の入力パターンと同じ）
- AC-I3: 「振る舞いの詳細 / tab バー右端のエントリ」（追加・削除・並び替えのボタンは通常の `<button>`。
  セレクトはネイティブ `<select>`）
- AC-I4: 「振る舞いの詳細 / tab バー右端のエントリ」（削除後のフォーカスの行き先。`KeySettings.vue:191-205` の
  `removeBinding` と同じ考え方）
- AC-I5: 「設計方針」（設定画面の外〔端末・キー操作〕に影響しない。既存の設定ダイアログと同じ配線に乗るだけで、
  新しいキー捕捉は追加しない）
