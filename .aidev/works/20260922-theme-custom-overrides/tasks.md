# タスク: 色の個別の上書き（herdr の `[theme.custom]` 相当）

## 実装方針

下から積む。**純粋な部品（`themeOverrides.ts`：検証・読み書き・合成）を先に作って単体テストで固め**、そのあと
store（状態・保存）・`ThemeController`（適用経路。store から上書きの値を読むだけなので store より後）・画面（節「テーマ」の
UI）・E2E・文書の順。純粋な部品は Vue に依存しないが、`isValidCssColor` は DOM（`document.createElement`）が要るので、
`keys/chord.ts` とは違い `theme/` 配下（既に DOM 前提のモジュール群）に置く。

## 作業順序と依存関係

下の `依存:` に従う。ほかに次の順序の理由がある。

- T2（`ThemeController`）は T1（`themeOverrides.ts`）と T3（store。`settings.themeOverrides` の型）の両方が要る
  ——`ThemeController` は store から上書きの値を読むだけで、store は `ThemeController` を知らない（依存の向きは一方向）。
- T5（E2E）は `pnpm build` した dist で走る。ここで初めて、実ブラウザで `getComputedStyle` を読める。
- T8（全体の回帰）は T18（20260921-keybinding-customization）と同じく **test 工程で消化する**（coding では実行しない。
  decisions D2 参照）。

## リスク / 留意点

- **`ThemeController.apply()` の早期 return を壊さない**（研究 F5）。上書きの変更は `applyOverrides()` という別の経路で
  反映し、テーマ名の比較には触れない。
- **`CSS.supports` は使わない**（happy-dom でスタブ。研究 F10）。`isValidCssColor` は実物の要素の `style.color` へ
  代入して読み戻す。
- **保存規約は `keys` と同じ**（既定との差だけ・値ごとに落とす・二重の守り・`storage` 追従）。20260921-keybinding-customization
  の `store/settings.ts` の `replaceKeyPrefs`／`RESERVED_*` 相当を型ごと変えて真似るのではなく、同じ**形**（読み直して
  正規化・状態と保存の両方が同じなら何もしない）を `themeOverrides` 用に独立して書く（`ThemeOverrides` と `KeyPrefs` は
  別の型なので、関数は共有しない）。
- **19 個の CSS 変数の一覧・その意味**は `uiTokens.ts` の `CSS_VARS` と design の対応表（研究 F4）を出典にする。手で
  書き写さず、`CSS_VARS`（配列）をそのまま反復して漏れなく網羅する（`CSS_VAR_LABELS` は `Record<CssVar,string>` なので、
  型が 1 個でも欠けていればコンパイルが落ちる＝漏れを機械的に防ぐ）。

## テスト方針

- 単体（vitest）：`themeOverrides.ts`（`isValidCssColor` の真偽表・読み書きの往復・値ごとに落とす・`mergeVars`）・
  `ThemeController`（`colorScheme` での層の選択・`apply` の早期 return が上書きの変更では起きない・`writeBoot` に
  上書きが入る・上書きが無ければ従来と同じ値）・`store/settings.ts`（setter・二重の守り・`storage` 追従）・
  `SettingsDialog.vue`（開閉・確定・拒否・空欄＝戻す・リセットボタンの表示とフォーカス・すべて戻すの確認）。
- E2E（Playwright・Chromium・ビルドした dist）：`theme-settings.spec.ts` に、上書きを入れて `getComputedStyle` で
  反映を確認・再読み込みで残る・既定に戻すと消える、を足す。影響する spec だけを回す。
- **一式（単体・E2E）は test 工程の最後に 1 回**。あわせて smoke と、結線を 1 本ずつ外して落ちることを確かめる負の確認
  （`regression-negative-control`）。受け入れ基準ごとの判定は `test-result.md` に書く。

## タスク

- [x] T1: 色の上書きの純粋な部品（`theme/themeOverrides.ts`）
      対象: 新規 `packages/web/src/theme/themeOverrides.ts`・新規 `packages/web/src/theme/themeOverrides.test.ts`。
      `ThemeOverrides`／`ThemeOverrideLayer`／`ThemeOverrideBucket`・`emptyThemeOverrides`・`isValidCssColor`・
      `loadThemeOverrides`・`serializeThemeOverrides`・`withOverride`／`withoutOverride`・`mergeVars`・`CSS_VAR_LABELS`。
      参照: `packages/web/src/theme/uiTokens.ts:16-35`（`CSS_VARS`・`CssVar`）。 根拠: design「インターフェース /
      データ構造」・研究 F4・F10
      依存: なし
      AC: AC1, AC2, AC5, AC8, AC12

- [x] T2: `ThemeController` に上書きの適用経路を足す
      対象: `packages/web/src/theme/ThemeController.ts`（`apply`・`writeBoot`／`bootVars` を書き換え、`applyOverrides`
      を新設。`start()` に `themeOverrides` の watch を足す）・`packages/web/src/theme/ThemeController.test.ts`。
      根拠: design「`ThemeController.ts`（変更）」・研究 F5・F7・F8
      依存: T1, T3
      AC: AC2, AC3, AC4, AC9

- [x] T3: store（`store/settings.ts`）に `themeOverrides`・setter・保存を足す
      対象: `packages/web/src/store/settings.ts:17-` 付近（`keyPrefs`・`replaceKeyPrefs` のすぐ後ろが自然）・
      `packages/web/src/store/settings.test.ts`。`themeOverrides`（ref）・`replaceThemeOverrides`・`setThemeOverride`・
      `resetThemeOverride`・`resetAllThemeOverrides`。既存の `storage` イベント listener（`packages/web/src/store/
      settings.ts:186` 付近）に `themeOverrides` の追従も足す。 根拠: design「`store/settings.ts`（変更）」・
      20260921-keybinding-customization の `replaceKeyPrefs`（同じ形の踏襲）
      依存: T1
      AC: AC6, AC7, AC8

- [x] T4: 設定画面「テーマ」節に上書きの UI を足す
      対象: `packages/web/src/components/SettingsDialog.vue`（テーマの節の末尾。既存の節は 296 行目付近から）・
      `packages/web/src/components/SettingsDialog.test.ts`。折りたたみ・19 行の一覧（ラベル・説明・明るいとき／
      暗いときの入力・行ごとのリセット）・確定の検証（空欄＝戻す／無効＝拒否／妥当＝反映）・すべて戻すの確認。
      根拠: design「`SettingsDialog.vue`（変更）」・研究 F11
      依存: T1, T3
      AC: AC1, AC5, AC6, AC7, AC12, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5

- [x] T5: E2E（`theme-settings.spec.ts` に追加）
      対象: `packages/e2e/src/specs/theme-settings.spec.ts`（既存ファイルへの追加）。
      根拠: design「テスト方針」・`.aidev/conventions/e2e-observe-browser.md`
      依存: T2, T3, T4
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC9

- [x] T6: 文書（`docs/herdr-parity.md`・`docs/verification.md`）
      対象: `docs/herdr-parity.md`（テーマの色の個別の上書きの行）・`docs/verification.md`（機能の説明・手で確かめる
      項目）。 根拠: design「ドメイン固有の考慮」
      依存: T4
      AC: AC10

- [x] T7: backlog（`.aidev/backlog/product-roadmap.md`）
      対象: 該当行（「テーマの色の個別の上書き」）。coding 時点の内容で書き、**deliver で最終の実測値に書き直す**
      （20260921-keybinding-customization と同じ運用）。 根拠: `protocol-backlog.md`
      依存: T6
      AC: AC11

- [ ] T8: 全体の回帰（単体・E2E の一式・smoke）と負の確認 — **test 工程で消化する**（coding では実行しない。決定は
      decisions.md D2 参照）
      対象: 未特定（実行のみ。新しいコードは書かない）。 根拠: 節「テスト方針」
      依存: T5, T6, T7
      AC: なし
