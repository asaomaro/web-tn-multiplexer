# タスク: キーバインドのプリセット

## 実装方針

design の「対象範囲」に沿って、(1) プリセットの表を持つ新規モジュール、(2) 表を消費する側
（`applyRecommended`）の一般化、(3) それを使う UI、(4) E2E、の順に積む。(1)(2) は互いに独立
（触るファイルが重ならない）なので並行できるが、(3) はどちらの完成も要るので直列に依存する。

## 作業順序と依存関係

下の `依存:` に従う。T1・T2 は同じウェーブ（対象ファイルが重ならないので並行可）、T3 は T1・T2 の
両方が終わってから、T4 は T3 の後。

## リスク / 留意点

- `applyRecommended` の一般化は `RECOMMENDED_DIRECT`（既存の唯一の呼び出し元の既定値）を経由する
  既存動作を変えてはいけない（AC6）。T2 で、一般化の前後の結果が一致することをテストで固定する。
- `KeySettings.vue` の `data-recommended` → `data-add-preset` の改名は、単体テスト
  （`KeySettings.test.ts`）と E2E（`key-bindings.spec.ts:352`）の両方に波及する。T3・T4 で
  それぞれ追従する（既存の `git grep` で洗い出し済み。他に参照箇所は無い）。
- decisions D3 のとおり、herdr プリセットを足したときの案内文の文言が変わる（「直接のキーを
  N 個足しました」→「herdr のおすすめの直接のキー（ctrl+alt）を N 個足しました」等）。
  T3・T4 でこの新しい文言に合わせてアサーションを更新する（規約 `regression-negative-control` に
  従い、更新後のテストが「直す前は落ちる」ことも確かめる）。

## テスト方針

- 単体（vitest）: `presets.test.ts`（新規）・`assign.test.ts`（一般化に追従＋新規ケース）・
  `KeySettings.test.ts`（UI 変更に追従＋新規ケース）。
- E2E（playwright）: `key-bindings.spec.ts` の既存 1 本を更新し、tmux 風プリセットの新規 1 本を足す。
  **判定はブラウザの観測で行う**（`.aidev/conventions/e2e-observe-browser.md`。既存 spec のコメント
  にある方針を踏襲：DOM・`role="status"`・実際に端末へ送られた INPUT フレームで見る）。
- 回帰テスト（`data-recommended` 改名・文言変更のテスト更新）は、直す前のコード
  （改名前・文言変更前）に戻して実際に落ちることを確かめてから採用する
  （`.aidev/conventions/regression-negative-control.md`）。
- E2E は着手した spec だけをその都度実行し、test 工程の最後に一式を 1 回回す
  （既存の作業方針。`e2e-affected-specs-only` の記憶）。

## タスク

- [x] T1: プリセットの表を持つ新規モジュール `presets.ts` を作る（`KeyPreset` 型・`PRESET_TMUX`・
      `KEY_PRESETS`）。合わせて単体テストを書く：`KEY_PRESETS` が 2 件（`herdr-ctrl-alt`・`tmux`）・
      `herdr-ctrl-alt` の `bindings` が `RECOMMENDED_DIRECT` と同一（参照ではなく内容比較）・
      `PRESET_TMUX` の全エントリの binding 文字列が `parseBinding` で読める・`PRESET_TMUX` の
      `ActionId` がすべて `actionDef()` で引ける実在の操作である・`PRESET_TMUX` に design の
      対応表どおり 14 組があることを固定する。
      対象: `packages/web/src/keys/presets.ts`（新規）・`packages/web/src/keys/presets.test.ts`
      （新規）（design「インターフェース / データ構造」の `presets.ts`、research F10・F13）
      依存: なし
      AC: AC2, AC5

- [x] T2: `assign.ts` の `applyRecommended` を一般化する（`via` を `parseBinding` の結果から読む・
      `RecommendedResult.skipped` のフィールド名を `chord` → `binding` に改名）。`assign.test.ts` の
      既存の `.chord` 参照（3 箇所）を `.binding` に追従させ、既存の全テストが変更前と同じ結果に
      なることを確認する。新規テストを足す：(a) `via:"prefix"` のエントリ（`prefix+%` 等）を
      `applyRecommended` に渡すと、`prefix+` の後のキーとして正しく足される（`bindingsOf` に
      `"prefix+%"` の形で入り、`km2.ownerOf("prefix", "%")` が対応する操作になる）、(b) 読めない
      binding 文字列（例 `""`）を含む表を渡すと、その 1 件だけ `skipped` へ「読めない割り当てです。」
      として積まれ、他のエントリは通常どおり処理される。
      対象: `packages/web/src/keys/assign.ts:263-305`（design「`assign.ts` の一般化」のコード例）・
      `packages/web/src/keys/assign.test.ts`
      依存: なし
      AC: AC3, AC4, AC6

- [x] T3: `KeySettings.vue` を design の「`KeySettings.vue` の変更」どおりに書き換える：
      `.keys-bulk` 内のボタン 1 つを `<select id="keys-preset-select">`（`KEY_PRESETS` を
      `v-for`）+ `data-add-preset` の［足す］ボタンへ差し替え、`selectedPresetId` ref・`addPreset`
      関数を実装する（design のコード例どおり。`preset.label` の直後にスペースを挟まない形——
      decisions D3 の文例と一致させる）。`#keys-recommended-note` の文言を「おすすめの一式には」→
      「プリセットには」に一般化する。
      `KeySettings.test.ts` を追従させる：既存の `recommendedBtn`（`[data-recommended]` 参照）を
      `presetAddBtn`（`[data-add-preset]` 参照）に改名し、全呼び出し箇所を更新する。
      「すでに全部入っています」への `.toBe()` と「直接のキーを 9 個足しました」への `.toContain()`
      の 2 箇所を、新しい文言（「herdr のおすすめの直接のキー（ctrl+alt）は、すでに全部入っています。」
      「herdr のおすすめの直接のキー（ctrl+alt）を 9 個足しました」）に更新する（decisions D3）。
      新規テストを足す：(a) `<select>` に「herdr のおすすめの直接のキー（ctrl+alt）」「tmux 風」の
      2 つの `<option>` がある（AC1）、(b) `<select>` で「tmux 風」を選んで［足す］を押すと
      `PRESET_TMUX` の内容が足され、対応する案内文が出る（AC2）、(c) キーボードだけで
      `<select>` → ［足す］の Tab 順が辿れる（`document.activeElement` を確認。AC-I3）、
      (d) ダイアログを閉じて開き直しても選択中のプリセットが保持される（AC-I1）、
      (e) tmux 風を足したあと［すべて既定に戻す］を押すと、tmux 風で足した分も含めて全部消える
      （AC7。`store/settings.ts` は変更しない前提の回帰確認）。
      対象: `packages/web/src/components/KeySettings.vue:249-264`（`addRecommended` → `addPreset`）・
      `:422-456`（`.keys-bulk`）・`:458-462`（`#keys-recommended-note` の文言）・
      `packages/web/src/components/KeySettings.test.ts`
      依存: T1, T2
      AC: AC1, AC2, AC3, AC4, AC6, AC7, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5

- [x] T4: E2E `key-bindings.spec.ts` を更新する：既存のテスト（タイトル文字列に含まれる
      「（AC10）」は前の work `20260921-keybinding-customization` の AC 番号で、この work の
      AC1〜AC7・AC-I1〜AC-I5 とは別の体系——タイトル文字列は変更しない）の `[data-recommended]` を
      `[data-add-preset]` に、
      `.toContainText("直接のキーを 10 個足しました")` を新しい文言に合わせて更新する。
      新規テストを 1 本足す：設定画面を開く → `<select>` で「tmux 風」を選ぶ → ［足す］を押す →
      `role="status"` の案内文と、対象の操作（例 `split_vertical`）の `.keys-bindings` 表示に
      `prefix+%` が現れることを確認 → 設定画面を閉じて `prefix+%` を実際に押し、pane が分割される
      （ブラウザの描画＝`.pane-frame` の数の変化で判定。`.aidev/conventions/e2e-observe-browser.md`）。
      対象: `packages/e2e/src/specs/key-bindings.spec.ts:346-364`（既存テスト）・同ファイル末尾
      （新規テスト）
      依存: T3
      AC: AC1, AC2, AC-I3
