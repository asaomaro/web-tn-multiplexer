# タスク: サイドバーの workspace 行のメニューをキーボードから開く

## 実装方針

design.md の依存の実体に沿って積む。`依存:` の正典は各タスクの行のみ（この節は方針の説明で、
依存グラフの重複表現はしない）。`Action` 型（T1）が基点で、そこから2つの独立した枝に分かれる:
(a) T1 に依存する navigate キーカタログ（T2）→ それを表示する `HelpDialog.vue`（T6）、
(b) T1 と、独立した `view.ts` の要求状態（T3）に依存する `ActionDispatcher`（T4）。
`Sidebar.vue`（T5）は `view.ts`（T3）の状態だけを見る（`ActionDispatcher` の成果物を直接
参照しない——design.md の実装コード例のとおり、T4 は `view.requestNavigateMenu()` を呼ぶだけ、
T5 は `view.navigateMenuRequested` を見るだけで、両者は `view.ts`〔T3〕を介して繋がる）。
最後に全ファイルの回帰確認（T7）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T3 は互いにファイルが重ならず `依存: なし`同士なので並行可。
T4・T5 はどちらも T3 の後に着手できるが、T4 は T5 の成果物に依存せず、T5 も T4 の成果物に
依存しない（上記「実装方針」参照。T4・T5 も互いにファイルが重ならないため並行可）。

## リスク / 留意点

- **`ActionDispatcher` は DOM に触れない**（design「設計方針」）。T4 で `document.`/
  `querySelector`/`getBoundingClientRect` を書かないこと——それは T5（`Sidebar.vue`）の役目。
- **`navigateMenuRequested` は `Sidebar.vue` の `watch` の先頭で必ず先に消す**（design
  「エラー処理 / 異常系」の一度きりのトリガー保証）。DOM 処理より前に
  `clearNavigateMenuRequest()` を呼ぶ順序を崩さないこと。
- **`HelpDialog.vue` の「移動」群への追加は、既存の `Enter`/`Escape`（非移動）と同じ扱い**
  （design「インターフェース / データ構造 > HelpDialog.vue」）——新しい群を作らない。

## テスト方針

- `navigateKeys.test.ts`: 7件目のカタログエントリ（`navigate_open_menu`）が既定 chord
  `space` を持ち、予約チョードと衝突しないことを確認する。
- `ActionDispatcher.test.ts`: `navigate("openMenu")` が `view.navigateSelection` の有無で
  `requestNavigateMenu()` を呼ぶ/呼ばないことを確認する（DOM には一切触れないことも
  ホワイトボックスで確認——`document`/`querySelector` 相当の呼び出しが無いこと）。
- `Sidebar.test.ts`: `view.navigateMenuRequested` が立ったときに、該当行の DOM から
  `getBoundingClientRect()` を計算して `actions.openContextMenu({kind:"workspace",...}, {x,y})`
  を呼ぶこと・要求が消えること・DOM が見つからない場合に `{x:0,y:0}` へフォールバックすること
  を確認する（AC1・AC2・AC-I1・AC-I4 の直接の検証）。既存の `ContextMenu.vue` を使う統合的な
  流れ（メニュー項目を選ぶと実行される・Escape で閉じる）も、既存の `ContextMenu.test.ts`
  相当のテストパターンに倣って確認する（AC-I2・AC-I3）。
- `HelpDialog.test.ts`: `navigate_open_menu` の行が「移動」群に表示されることを確認する。
- 全タスク完了後、既存の navigate モード（Enter・Escape・矢印キー）・既存のマウス駆動の
  コンテキストメニュー関連テスト全体が無改修のまま通ることを確認する（T7。coding ではなく
  test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `keys/actions.ts` の navigate 系 `Action` 型に `op: "openMenu"` を追加する。
      対象: `packages/web/src/keys/actions.ts:74` / 根拠: design.md「インターフェース /
      データ構造 > keys/actions.ts」
      依存: なし
      AC: なし

- [x] T2: `keys/navigateKeys.ts` の `NAVIGATE_KEYS` に `navigate_open_menu`
      （既定 chord `space`）を追加する。`navigateKeys.test.ts` に確認テストを足す。
      対象: `packages/web/src/keys/navigateKeys.ts:24-56`（既存6件が precedent）・
      `navigateKeys.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      keys/navigateKeys.ts」
      依存: T1
      AC: AC1

- [x] T3: `store/view.ts` に `navigateMenuRequested`・`requestNavigateMenu`・
      `clearNavigateMenuRequest` を追加する。
      対象: `packages/web/src/store/view.ts:224-225`
      付近（`navigateSelection` が precedent） / 根拠: design.md「インターフェース /
      データ構造 > store/view.ts」
      依存: なし
      AC: なし

- [x] T4: `actions/ActionDispatcher.ts` の `navigate()` の `switch` に `case "openMenu":` を
      追加する。`ActionDispatcher.test.ts` に確認テストを足す。
      対象: `packages/web/src/actions/ActionDispatcher.ts:810-835`（`navigate()`） /
      根拠: design.md「インターフェース / データ構造 > actions/ActionDispatcher.ts」
      依存: T1, T3
      AC: AC1

- [x] T5: `components/Sidebar.vue` に、`view.navigateMenuRequested` を見て該当行の DOM から
      位置を計算し `actions.openContextMenu` を呼ぶ `watch` を追加する。`Sidebar.test.ts` に
      確認テストを足す。
      対象: `packages/web/src/components/Sidebar.vue:164-168,367`（`onRowContextMenu`・
      `data-drop-workspace-id` が precedent） / 根拠: design.md「インターフェース /
      データ構造 > components/Sidebar.vue」「振る舞いの詳細」「エラー処理 / 異常系」
      依存: T3
      AC: AC1, AC2, AC-I1, AC-I2, AC-I3, AC-I4

- [x] T6: `components/HelpDialog.vue` の「移動」群（`navigateEntries`）に
      `navigate_open_menu` の行を追加する。`HelpDialog.test.ts` に確認テストを足す。
      対象: `packages/web/src/components/HelpDialog.vue:77-89` / 根拠: design.md
      「インターフェース / データ構造 > components/HelpDialog.vue」「受け入れ基準との対応」
      （AC 番号なしの追加）
      依存: T2
      AC: なし

- [x] T7: 既存の navigate モード（Enter・Escape・矢印キー）・既存のマウス駆動の
      コンテキストメニュー関連テストが全て無改修のまま通ることを確認する（回帰確認）。
      **coding ではなく test 工程で消化する**（このセッションの他 work と同じ扱い）。
      対象: `NavigateMode.test.ts`・`navigateKeymap.test.ts`・`ContextMenu` 関連テスト・
      `ActionDispatcher.test.ts`（既存部分）・`KeySettings.test.ts`（`NAVIGATE_KEYS` を直接
      参照する作りのため無改修で新エントリを扱えるという design.md「対象範囲」「依拠する既存の
      事実」の主張の裏付け）（既存ファイルをそのまま実行するだけ。変更はしない） /
      根拠: design.md「対象範囲」（変更しない、とされる既存ファイル群）
      依存: T4, T5, T6
      AC: AC3, AC-I5
