# レビュー: D&D による pane の分割・分割解除

## タスク点検ログ

- [should][conv:-] `PaneFrame.test.ts` の describe 見出し直前のコメントが旧 work
  （`20260923-pane-name-dnd-swap`）の「ドラッグでの入れ替え」という表現・AC番号のまま、
  T9 でドラッグ本体の describe 見出し自体は「分割・分割解除」に更新されていたため、
  コメントだけが実装と食い違って見えた（`swapPanesByDrag` は既に存在しない） / 対応:
  コメントを「ドラッグの本体は 20260924-pane-dnd-split-move で置き換わった」旨に更新し、
  decisions.md D4 を参照する形にした。 / src: T9 taskcheck round1
- [nit][conv:-] `PaneFrame.vue` の `onNamePointerUp` のコメントが、pointerup 時点で実座標から
  ゾーンを再計算する理由として `workspace.move_to` D&D の taskcheck 指摘を引用していたが、
  実際にその work（`20260923-workspace-grouping`）で指摘された教訓は逆方向（ドロップ**元**の
  スナップショット化）で、本 T9 の「ドロップ**先**を毎回再計算する」根拠としては的外れな
  引用だった / 対応: 誤った precedent の引用を外し、design.md「クライアント側: ドロップ確定」
  節を参照する形に直した。 / src: T9 taskcheck round1
- [should][conv:-] `SessionModel.replacePane` のドロップ先 focus 後継選択（必ず `paneId` を選ぶ）と、
  クライアント共通の `viewRepair.ts`（`closePane` の「最初の葉」規則だけを実装）が食い違う。
  複数クライアントで同じ tab を見ていて、他クライアントの分割解除でちょうど消える pane に自分が
  ローカルで focus していた場合だけ、focus の復帰先がずれる（本人のドラッグには影響しない） / 対応:
  今回は直さず、`.aidev/backlog/product-roadmap.md` に follow-up 項目として記録
  （decisions.md D5）。protocol への「推奨後継」ヒント追加が必要で、この work の範囲を超えるため。
  / src: cross-check round1

## レビュー（review 工程）

独立点検（別コンテキストの subagent に委譲。requirements.md/design.md/decisions.md/review.md
（タスク点検ログ）/AGENTS.md/test-result.md を通読させたうえで diff 全体を読ませた）。
価値適合（特に decisions.md D4 のトレードオフの妥当性）・規約適合・保守性・複数の設計判断の
組み合わせで初めて表面化する不整合に絞った。

### ラウンド1

- [must][conv:-] `pane.replace`（中央ドロップでの分割解除）が、ドロップ先の pane が busy
  （前面プロセスがシェル以外）でも確認なしに即座にプロセスを終了させていた。同じアプリの
  `closePaneById`/`closeTabById` は「対象に busy な pane を含むときだけ確認する」（D23）という
  既存の安全策を持っているのに、この work の中央ドロップだけがそれを完全にバイパスしていた。
  中央ゾーンは対象 pane の中央40%×40%という広い領域を占めるため、誤ドロップで気付かぬまま
  作業中プロセスを失う実害が現実的にある。decisions.md D4 の安全面の検討は色を変える視覚的合図
  のみで、確認ダイアログの要否を検討していなかった。 / 対応: `view.ts` の `DialogContext` に
  `confirmReplacePane`（`paneId`/`targetPaneId`）を追加し、`ActionDispatcher.replacePaneWithDrag`
  がドロップ先の `busy` を見て、busy なら `ConfirmDialog`（既存コンポーネントを拡張）を経由して
  から `pane.replace` を送るよう変更した（`closePaneById` と同じ「対象を見て busy なら確認、
  でなければ直接送る」パターン）。回帰テストを `ActionDispatcher.test.ts` に4件・
  `ConfirmDialog.test.ts` に4件追加、負の確認済み（busy チェックを外すと新テストが実際に失敗する
  ことを確認 → 復元）。 / src: review round1
- [should][conv:-] `docs/verification.md` の手動検証手順が、`20260923-pane-name-dnd-swap` の
  旧挙動（「ドロップすると2つの pane の内容が入れ替わる」）のまま更新されておらず、この work の
  新挙動（縁で分割・中央で分割解除）と食い違っていた。 / 対応: 該当項目を新挙動に書き換え、
  この work の AC1〜AC11・AC-I1〜AC-I5 に対応する確認手順を追記した。 / src: review round1
- [should][conv:-] `docs/herdr-parity.md` の H41 行が「pane の分割・分割解除…は対象外のまま」と
  記載したままで、この work がまさにその「分割・分割解除」を実装したにもかかわらず更新されて
  いなかった。 / 対応: H41 の記載を、分割・分割解除は本 work で対応済み・残るのは「別 tab・
  別 workspace・新規 tab への移動」のみ、と更新した。 / src: review round1
- [nit][conv:-] `PaneFrame.vue` の CSS（`.pane-frame-zone-top` 等の `70%`）が `paneDragZone.ts`
  の `EDGE_RATIO=0.3` と別々にハードコードされており、値の同期が手動だった。 / 対応: 変更時に
  両方直すことをコメントに明記した。 / src: review round1

### 全体所見（round1 後）

must 1件・should 2件・nit 1件を修正後、`pnpm -s typecheck`（exit 0）・`pnpm -s test`（2837
passed / 0 failed、161ファイル）を再実行しグリーンを確認。以降のラウンドで新規指摘なし。
