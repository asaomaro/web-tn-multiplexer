# タスク: pane の枠の描画モードと隙間の入切

## 実装方針

規則（純粋関数）→ 設定（ストア）→ 描画（`PaneFrame`）→ 構造の受け渡し（`PaneLayout`）→ 設定画面・再読み込み → docs の順に積む。
規則を先に純粋関数で固め、組み合わせの網羅はそこで確かめる。コンポーネントのテストは DOM・class・inline style を見る
（requirements「検証の範囲」）。architecture は挟まない（モジュール境界は動かさず、新しい依存の向きは
`PaneFrame`/`PaneLayout` → `layout/paneChrome.ts` だけ。protocol「4.5」の 4 条件に当たらない）。

## 作業順序と依存関係

下の `依存:` に従う。T3（`PaneFrame`）を T4（`PaneLayout`）より先にするのは、`PaneLayout` のテストが最終的な余白（`PaneFrame` の
inline style）を見るため。

## リスク / 留意点

- 既存の `PaneFrame.test.ts`・`PaneLayout.test.ts` は新しい props 無しで mount する。既定（always・隙間入・props 省略）で今と同じ
  class・余白になることを最初に確かめる（design「エラー処理」）。
- 既存ファイルは prettier 未整形。`--write` は新規ファイル（`layout/paneChrome.ts`・`paneChrome.test.ts`）にだけ使う。
- 回帰テストの負の確認（`.aidev/conventions/regression-negative-control.md`）: 挙動を足した箇所を 1 つずつ戻してテストが落ちることを
  確かめ、生の出力を test-result.md に貼る（test 工程）。

## テスト方針

- 単体: `npx vitest run <file>`（packages/web）。全体: `pnpm -s test`・`pnpm -s typecheck`・`pnpm -s build`（終了コードで判定）・`aidev smoke`。
- E2E は回さない。実画素・cols/rows の変化・ネイティブのラジオの矢印キー操作は test-result.md の「未検証の穴」に残す。
- 負の確認: `resolvePaneChrome` の各項・`childNeighbors` の各分岐・`PaneLayout` の受け渡し・`PaneFrame` の `framed` 条件と
  `pane-frame-edge-flush` の条件・`loadPaneBorders`/`loadPaneGaps` の既定への戻し・storage/reload の追加行・設定画面の `@change`/`@click` の
  ハンドラを 1 つずつ壊して落ちることを確かめる。

## タスク

- [x] T1: `layout/paneChrome.ts`（型 `PaneBorders`/`PaneSide`/`PaneSides`/`PaneChrome`、`NO_NEIGHBORS`、`childNeighbors`、`resolvePaneChrome`）と
      その単体テストを足す。
      対象: `packages/web/src/layout/paneChrome.ts`（新規）・`packages/web/src/layout/paneChrome.test.ts`（新規） / 根拠: design「インターフェース」
      依存: なし
      AC: AC1, AC3, AC4, AC5
- [x] T8: PR #12 の残骸（`tabbar/tabBarRight.ts` の `PaneBordersMode`・`loadPaneBordersMode` とそのテスト）を消す。
      対象: `packages/web/src/tabbar/tabBarRight.ts:13-15,40-43`・`packages/web/src/tabbar/tabBarRight.test.ts:4,28-39` / 根拠: decisions D6
      依存: なし
      AC: なし
- [x] T2: 設定ストアに `paneBorders`（`loadPaneBorders`。既定 always）・`paneGaps`（`loadPaneGaps`。既定 true）の ref・set・storage 追従・return を足し、
      テストを足す。
      対象: `packages/web/src/store/settings.ts:93-100,158,267-271,391-401,474-527`・`packages/web/src/store/settings.test.ts` / 根拠: research A4
      依存: T1
      AC: AC1, AC6
- [x] T3: `PaneFrame` に `multiPane`・`neighbors` の props を足し、`resolvePaneChrome` で辺ごとの余白（inline style）・強調・名前・
      `pane-frame-edge-flush` を描き分ける。テストを足す。
      対象: `packages/web/src/components/PaneFrame.vue:36,57-70,250-296,300-323,394-398`・`packages/web/src/components/PaneFrame.test.ts` / 根拠: research A3
      依存: T1, T2
      AC: AC1, AC6, AC-I5
- [x] T4: `PaneLayout` に `multiPane`・`neighbors` の props を足し、root で分割の有無を求め、子へ `childNeighbors`、`PaneFrame` へ隣
      （zoom 中は `NO_NEIGHBORS`）を渡す。テストを足す。
      対象: `packages/web/src/components/PaneLayout.vue:55-80,84,110,177-196`・`packages/web/src/components/PaneLayout.test.ts` / 根拠: research A1・A2
      依存: T3
      AC: AC1, AC2, AC3, AC4, AC5, AC7, AC9
- [x] T5: 設定画面の「表示」節に描画モードのラジオ・説明・隙間のスイッチを足し、テストを足す。
      対象: `packages/web/src/components/SettingsDialog.vue:165-220,662-700`・`packages/web/src/components/SettingsDialog.test.ts` / 根拠: research A6
      依存: T2
      AC: AC6, AC-I1, AC-I2, AC-I3, AC-I4
- [x] T6: `ActionDispatcher.reloadConfig` に 2 項目を足し、テストを足す。
      対象: `packages/web/src/actions/ActionDispatcher.ts:12-21,1085-1110`・`packages/web/src/actions/ActionDispatcher.test.ts` / 根拠: research A5
      依存: T2
      AC: AC6
- [x] T7: `docs/herdr-parity.md` の H23 行と `docs/verification.md` の外観の確認手順を更新する。
      対象: `docs/herdr-parity.md:46`・`docs/verification.md:259-266`
      依存: T4, T5
      AC: AC8
