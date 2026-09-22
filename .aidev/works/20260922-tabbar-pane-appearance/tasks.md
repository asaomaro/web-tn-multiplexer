# タスク: タブバーと pane の枠の外観設定（herdr の `tab_bar_*`・`pane_*` 相当）

## 実装方針

design.md の「振る舞いの詳細」の並びに沿って、下から上へ積む：まずデータ構造・sanitize・load 関数（T1・T2）、
次に store（T3）、それから見た目を担う各コンポーネント（T4〜T8）、設定画面の UI（T9）、E2E（T10）、
最後に docs・backlog（T11・T12）。
`multiPane`/`showAgentLabelsOnPaneBorders` は `App.vue`→`PaneLayout.vue`（再帰）→`PaneFrame.vue` と
prop で通す経路なので、T5→T6→T7 の順は入れ替えない（producer→consumer の順）。

## 作業順序と依存関係

下の `依存:` に従う。T1 が全ての土台（型・load 関数）なので最初に着手する。`multiPane`/`bordered`/`showLabel`
は producer→consumer の直列（`App.vue`〔T5〕→`PaneLayout.vue`〔T6〕→`PaneFrame.vue`〔T7〕）なので順序を
入れ替えない。`TabBar.vue`（T4）の `position` prop を `App.vue`（T5）が使うため、T5 は T4 の後に置く。
一方 `Splitter.vue`（T8）は `paneGaps` を自分で store から読む独立した実装なので、T3 の後なら並行してよい
（`対象` が T4〜T7 と重ならないことを確認済み）。

## リスク / 留意点

- `PaneFrame.vue`・`Splitter.vue` の `padding`/`width`/`height` の数値を変えないこと（design「依拠する既存の事実」）。
  T7・T8 のタスク点検で必ず確認する。
- `multiPane` prop の受け渡し（T5→T6→T7）は design のラウンド 2 で発見された経路なので、既存の `paneFrames`
  prop の配線（`PaneLayout.vue:186,190`）を壊さないよう並べて書く。
- `bordered`（T7）は prop で受け取り、`paneGaps`（T8）は store を直接読む——**非対称だが意図的**。
  `bordered` は `multiPane`（構造上の位置に依る値。store には無い）と組み合わせて解決するため
  design が明示的に `PaneLayout.vue` 側での解決＋prop 渡しと決めた（design「振る舞いの詳細」）。
  `paneGaps` は構造に依らない単純なグローバル値なので、`Splitter.vue` 自身が読んでよい（design はここまで
  縛っていない。この使い分けは tasks 工程での実装方針の決定として decisions に残す）。

## テスト方針

- 各コンポーネント・store の単体テストをタスクと同じ単位で書く（T1〜T9 それぞれに対応する `*.test.ts`）。
- test 工程で、`regression-negative-control` に準じた負の確認を行う：`multiPane`/`bordered` の受け渡しと
  `settings.ts` の新規 8 値の `return` を対象に、配線を外して落ちることを確認する（新機能の配線なので
  「不具合を直す」ケースではないが、同じ手法で配線の実効性を確かめる。decisions に理由を残す）。
- E2E は `packages/e2e/src/specs/` に本 work 用の新規 spec（または既存の近い spec への追記）を書く
  （T9 の一部として、または独立タスクとして着手時に判断する）。少しの修正ごとに一式は回さず、
  最終確認でのみ一式を回す（`e2e-affected-specs-only` の運用）。

## タスク

- [x] T1: `packages/web/src/tabbar/tabBarRight.ts`（新規）を作る。`TabBarPosition`・`PaneBordersMode`・
      `DatetimeFormat`・`TabBarRightEntry`・`MAX_TAB_BAR_RIGHT_ENTRIES`・`MAX_TAB_BAR_TEXT_CHARS`・
      `MAX_TAB_BAR_SEPARATOR_CHARS`・`loadTabBarPosition`・`loadPaneBordersMode`・`loadTabBarRightEntries`・
      `loadTabBarRightSeparator`・`sanitizeTabBarText`・`formatDatetime`。単体テスト `tabBarRight.test.ts`
      （load 関数の壊れた値の扱い・上限の切り詰め・sanitize の制御文字除去・4 プリセットの整形結果）を含む。
      対象: `packages/web/src/tabbar/tabBarRight.ts`（新規） / 根拠: design「インターフェース / データ構造」
      依存: なし
      AC: AC3, AC4, AC10
- [x] T2: `packages/web/src/tabbar/tabBarClock.ts`（新規）を作る。`tabBarRight` に `datetime` 種別が
      1 つ以上あるときだけ 1 秒間隔で `ref<Date>` を更新する小さな composable（`useTabBarClock` 等）。
      不要なときはタイマーを起動しない。単体テスト `tabBarClock.test.ts`（vi.useFakeTimers で 1 秒進めて
      更新される・エントリが無ければタイマーを張らないことを確認）を含む。
      対象: `packages/web/src/tabbar/tabBarClock.ts`（新規） / 根拠: design「振る舞いの詳細 / tab バー右端のエントリ」
      依存: T1
      AC: AC3
- [x] T3: `packages/web/src/store/settings.ts` に 8 つの設定値（`tabBarPosition`・`hideTabBarWhenSingleTab`・
      `tabBarRight`・`tabBarRightSeparator`・`paneBorders`・`paneOuterBorders`・`paneGaps`・
      `showAgentLabelsOnPaneBorders`）と、`tabBarRight` の追加・削除・並び替え・更新の setter
      （`addTabBarRightEntry`・`removeTabBarRightEntry`・`moveTabBarRightEntry`・`updateTabBarRightEntry`）、
      他の値の setter（既存の他の設定と同じ形）を足す。`storage` イベントのハンドラに 8 項目の再読込を追加する。
      `return {...}` にも追加する。単体テスト `settings.test.ts` への追記（既定値・setter の反映・保存・
      storage イベント追従・壊れた保存値からの回復）。
      対象: `packages/web/src/store/settings.ts:1-80` 周辺 / 根拠: design「インターフェース / データ構造」・research F15
      依存: T1
      AC: AC9, AC10
      （注: この T3 は「保存・追従」（AC10）と「既定値」（AC9）という store 固有の観点だけを負う。
      `ref` に値を持たせるだけでは AC1〜AC8 の振る舞いそのものにはならない——それを画面に反映するロジック・
      UI を実装するタスク（`tabBarRight.ts` の書式化ロジックを持つ T1・T2、実際に描画する T4〜T10）が
      それぞれの AC を個別に数える。T3 はどのタスクとも重複しない store 固有の 2 つの AC だけに絞る）
- [x] T4: `packages/web/src/components/TabBar.vue` に `position` prop・`tabBarVisible` computed・
      右端の帯（`.tab-bar-right`）の描画（`tabBarRight` エントリを文字列化して `tabBarRightSeparator` で
      `join`）を足す。境界線を `position` に応じて `border-bottom`/`border-top` に切り替える。
      単体テスト `TabBar.test.ts` への追記（位置の反映・自動非表示・右端エントリの描画・区切り文字）。
      対象: `packages/web/src/components/TabBar.vue`（全体。新規追加） / 根拠: design「振る舞いの詳細 / tab バーの位置」
      「tab が 1 つなら自動的に隠す」「tab バー右端のエントリ」
      依存: T2, T3
      AC: AC1, AC2, AC3, AC4
- [x] T5: `packages/web/src/App.vue` に `multiPane`（`currentTab.layout.type==="split" && !zoomedPaneId`
      から計算）・`showLabel`（`settings.showAgentLabelsOnPaneBorders`）を計算し `<PaneLayout>` へ渡す配線、
      `<TabBar :position="settings.tabBarPosition" />` への prop 渡し、`.app-panes` への外周 `outline`
      （`settings.paneOuterBorders` に応じて `outline-color` を切り替え）を足す。
      単体テスト `App.test.ts` への追記（既存のファイル。`multiPane` の計算・`PaneLayout`/`TabBar` への
      prop 渡し・`.app-panes` の outline 切り替えを確認）。
      対象: `packages/web/src/App.vue:47-49,127-132` / 根拠: design「振る舞いの詳細 / pane の枠・外周・隙間」
      （`<TabBar :position>` は T4 が足す prop を使うため、T4 の後に置く）
      依存: T3, T4
      AC: AC1, AC5, AC6, AC8
- [x] T6: `packages/web/src/components/PaneLayout.vue` に `multiPane`・`showLabel` prop を追加し、
      既存の `paneFrames` prop と同じ要領で再帰呼び出し（`:multi-pane="multiPane"` 等。`:186`,`:190` 周辺）へ
      引き継ぐ。**加えて `useSettingsStore()` を注入し、葉の `<PaneFrame>`（`:178`）へ渡す直前に
      `bordered = settings.paneBorders==="always" ? true : settings.paneBorders==="off" ? false : multiPane`
      を計算して `:bordered="bordered" :show-label="showLabel"` として渡す**（design「振る舞いの詳細 /
      pane の枠・外周・隙間」の「この 3 値の解決は `PaneLayout.vue` が行う」を実装する箇所。`PaneFrame.vue`
      自身は `paneBorders`/`multiPane` を知らず、計算済みの `bordered` だけを受け取る）。
      単体テスト `PaneLayout.test.ts` への追記（`multiPane`/`showLabel` prop が再帰的に子へ引き継がれる・
      `paneBorders` の 3 値それぞれで `bordered` が正しく計算され `PaneFrame` に渡ることを確認）。
      対象: `packages/web/src/components/PaneLayout.vue:178,186,190` / 根拠: design「振る舞いの詳細 / pane の枠・外周・隙間」
      依存: T3, T5
      AC: AC5, AC8
- [x] T7: `packages/web/src/components/PaneFrame.vue` に `bordered`・`showLabel` prop を追加。
      **どちらも T6（`PaneLayout.vue`）が計算済みで渡す単純な boolean**（`PaneFrame.vue` 自身は
      `paneBorders`/`multiPane`/store を知らない）。`bordered` に応じた枠色
      （非選択・非 bordered=枠なし、非選択・bordered=`--wtm-menu-border` の 1px、選択中=既存の
      `--wtm-pane-current` の 2px を維持）と、`showLabel` が true のとき `paneNameOf(pane, "")` を
      可視テキストとして描画（`aria-hidden="true"`。既存の `aria-label` とは別要素）。
      **`padding: 4px` は変えない**（design の制約）。
      単体テスト `PaneFrame.test.ts` への追記（3 状態の枠色・ラベルの表示条件・手動名優先・padding 不変の確認）。
      対象: `packages/web/src/components/PaneFrame.vue:109-149` / 根拠: design「振る舞いの詳細 / pane の枠・外周・隙間」
      「pane 枠へのエージェント名表示」
      依存: T6
      AC: AC5, AC8, AC9
- [x] T8: `packages/web/src/components/Splitter.vue` は `paneGaps` が構造上の位置に関わらない単純な
      グローバル設定なので、`multiPane`/`bordered`（構造に依るため prop で通す）とは違い、
      **`useSettingsStore()` を自分で注入して `settings.paneGaps` を直接読む**（この component は既に
      `inject(ConnectionKey)` で共有の状態を直接取る前例があり、それと同じやり方。`Splitter.vue:15`）。
      背景色を `paneGaps` が false のとき隣接面の色相当（`--wtm-bg`）に変える。**`width`/`height`（4px）は
      変えない**。
      単体テスト `Splitter.test.ts` への追記（`paneGaps` の反映・幅が変わらないことの確認）。
      対象: `packages/web/src/components/Splitter.vue:108-129` / 根拠: design「振る舞いの詳細 / pane の枠・外周・隙間」
      依存: T3
      AC: AC7, AC9
- [x] T9: `packages/web/src/components/SettingsDialog.vue` の節「表示」に 8 項目の UI（位置の `<select>`・
      自動非表示のトグル・右端エントリの追加/削除/並び替えリスト（`MAX_TAB_BAR_RIGHT_ENTRIES` で追加ボタン
      disabled）・区切り文字の入力欄・枠の 3 値の `<select>`・外周/隙間/エージェント名表示のトグル）を足す。
      削除後のフォーカスの行き先を `KeySettings.vue` の `removeBinding`（`:191-205`）と同じ考え方で実装する。
      単体テスト `SettingsDialog.test.ts` への追記（各項目の反映・キーボードだけでの追加/削除/並び替え・
      削除後のフォーカス・AC-I1〜AC-I5 の確認）。
      対象: `packages/web/src/components/SettingsDialog.vue:353-364` / 根拠: research F14
      依存: T4, T7, T8
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC10, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
      （AC10 はダイアログを開いたときに保存値〔storage〕を正しく反映することを確認する分。**AC9 は含めない**
      ——「何も変えなければ画面が変わらない」は設定ダイアログの外〔tab バー・pane の枠〕の見た目の話で、
      ダイアログ自体の単体テストでは確認できない。T7・T8・T10 が数える）
- [x] T10: E2E（`packages/e2e/src/specs/`）に本 work 用のテストを足す（既存の近い spec への追記か新規
      spec かは着手時に判断。`tab-bar-pane-appearance.spec.ts` 等）。位置の切替・自動非表示・右端エントリの
      表示・枠/外周/隙間の視覚切替・エージェント名ラベルを、実ブラウザの描画（`getComputedStyle`・
      DOM の可視要素）で確認する（`e2e-observe-browser`）。何も設定を変えない画面が着手前と変わらないこと
      （AC9）・再読み込み後も保存値どおりに当たること（AC10）も、実ブラウザで確認する。
      対象: 未特定（既存の `theme-settings.spec.ts`・`keybinding-*.spec.ts` の構成を参考にする）
      依存: T9
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
- [x] T11: `docs/herdr-parity.md`（H22・H23 に相当する行を新設。herdr との違い〔対象外にした
      Command エントリ・strftime 書式の簡略化・自動判定の定義・エージェント名ラベルの意味の違い等〕を
      明記）・`docs/verification.md`（機能の説明・手で確かめる項目・既知の制約）を更新する。
      対象: `docs/herdr-parity.md`, `docs/verification.md` / 根拠: requirements AC11
      依存: T9, T10
      AC: AC11
- [ ] T12: `.aidev/backlog/product-roadmap.md` の「外観と設定の残り」の行を、この work で対応した分
      （tab バー位置・自動非表示・右端エントリ・pane の枠・外周・隙間・エージェント名表示）とそれ以外
      （pane の scrollbar・tab バー右端の Command エントリ・サイドバー行のカスタマイズ・設定画面の
      再読み込み）に割り、対応した分を `[x]` にする。**coding ではなく deliver 工程で消化する**
      （`aidev-70-deliver`「3.5」の台帳の同期。ここでは着手せず未チェックのまま進める）。
      対象: `.aidev/backlog/product-roadmap.md`（該当行） / 根拠: requirements AC12
      依存: なし
      AC: AC12
