# レビュー: キーバインドのプリセット

## タスク点検ログ

- T1（`presets.ts`・`presets.test.ts`）: 0 件。
- T2（`assign.ts` の `applyRecommended` 一般化・`assign.test.ts`）: 0 件。
- T3（`KeySettings.vue`・`KeySettings.test.ts`）: 1 件（nit）。注記段落（`KeySettings.vue:468-469`）の
  改行位置が Prettier の整形結果とずれていた（HEAD は整形済みファイルだったため `--write` が使える
  ケース）。`prettier --write packages/web/src/components/KeySettings.vue` を適用し、
  `prettier --check` が通ることと、単体テスト（51 件）・typecheck が引き続き通ることを確認した。
- T4（`key-bindings.spec.ts`）: 0 件。
- cross（T1〜T4 横断）: 0 件。

## レビュー ラウンド1

`aidev coverage --strict` は引き続き `ac=12 design=12/12(100%) tasks=12/12(100%) gaps=0`（tasks 承認時
と同じ被覆。design と実装の乖離なし）。

観点ごとの確認（taskcheck が見ていない要件適合・価値適合を中心に）:

- **要件適合**: `test-result.md`「受け入れ基準ごとの判定」で AC1〜AC7・AC-I1〜AC-I5 の全てが
  具体的な単体テスト・E2E テストの箇所と対応づけて pass していることを確認した。
- **価値適合**: US1（tmux 風のキー操作を 1 回の操作でまとめて足せる）は E2E
  「「tmux 風」プリセットを選んで足すと、prefix+% で右へ分割できる」で end-to-end に確認できている。
  US2（新しいプリセットを表 1 つ足すだけで追加できる）は `presets.ts` の `KEY_PRESETS` の形と
  `KeySettings.vue` 側がプリセットごとの分岐を持たない実装（`v-for` のみ）で担保されている。
- **正確性**: taskcheck（T1〜T4・cross）で個別に確認済み（上の「タスク点検ログ」）。cross では
  タスクをまたぐ結合点（`presets.ts` の表 → `assign.ts` の一般化 → `KeySettings.vue` の呼び出し →
  `key-bindings.spec.ts` の DOM 参照）を通しで確認し、指摘なし。
- **規約適合**: `.aidev/conventions/e2e-observe-browser.md`（新規 E2E はブラウザの描画・
  `.pane-frame` の数で判定。テスト自身のクライアント状態は使っていない）・
  `.aidev/conventions/regression-negative-control.md`（各タスクの点検・test 工程の両方で、
  直した箇所を戻すと新テストが実際に落ちることを確認済み）とも遵守を確認した。
- **保守性**: `applyRecommended` の一般化は変更が3点（ループ変数名・`via` の決め打ち撤廃・
  `chordToKeyInput` への引数）に閉じており、既存の呼び出し元（`RECOMMENDED_DIRECT`）の挙動を
  変えない後方互換な設計。`presets.ts` は `bindings.ts`（既存の操作カタログ）と同じ「表 1 つ」の
  形式を踏襲しており、既存のコードベースの語彙・パターンと一貫している。

**指摘なし（0 件）**。
