# タスク: worktree の削除

## 実装方針

design.md の層ごとに、下から上（protocol → server（WorktreeService）→ RPC 登録 →
client store（view.ts）→ client の周辺（clientError.ts）→ client アクション
（ActionDispatcher）→ client の UI（ConfirmDialog.vue・WorktreeOpenDialog.vue）→
回帰確認）の順で積む。`依存: なし` のタスク（T1・T4）は互いにファイルが重ならないため
並行可（`20260924-pane-move-cross-tab` の tasks.md と同じ考え方）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T4 は `依存: なし` で互いにファイルも重ならないため並行可。

## リスク / 留意点

- **`git worktree remove` は先に実行し、成功したときだけ workspace を閉じる**（design「設計方針」
  ・T2の最重要の落とし穴——逆にすると dirty で失敗したときに動いているシェルを先に失う）。
- **`view.dialogContext` は単一の値**（design「依拠する既存の事実」）。確認ダイアログは
  一覧ダイアログを「開き直す」ことで元へ戻る形にする——「重ねて表示する」実装は行わない
  （T6・T7・T8 で一貫させる）。
- **削除ボタンは `@click.stop`・`tabindex="-1"`**（T8。design「クライアント側」）。
  クリックの伝播で「開く」が誤発火しないこと・タブ順に2つ目の停止点を作らないことの両方を守る。
- **`worktreeErrorMessage`/`errorCodeOf` は既存関数**（design「依拠する既存の事実」）。
  T6 で新しい変換関数を作らない。

## テスト方針

- `WorktreeService.remove`: 本物の git を使う既存の流儀（`WorktreeService.test.ts`）で、
  成功・dirty（force 無し失敗→force で成功）・存在しない対象・main working tree・
  開いている workspace と一致する場合の自動クローズ、を単体テストで確認する。
- `classifyWorktreeRemoveError`: dirty／not_a_worktree／is_main／その他 の分類を単体テストで確認する。
- client: `view.test.ts`（新しい `DialogContext` kind の追加分）・`ConfirmDialog.test.ts`
  （新しい message/confirm/cancel 分岐）・`WorktreeOpenDialog.test.ts`（削除ボタン・
  Delete/Backspace キー）・`ActionDispatcher.test.ts`（新アクション群・dirty→force 分岐・
  往復ごとの一覧の開き直し）。
- 全タスク完了後、既存の worktree・pane/tab/workspace 関連テスト全体が無改修のまま通ることを
  確認する（AC11。coding ではなく test 工程で最終確認する——`20260924-pane-dnd-split-move`の
  decisions.md D3 と同じ扱い）。

## タスク

- [x] T1: protocol に `worktree.remove` の RPC スキーマ・3つの新しいエラーコードを追加する。
      対象: `packages/protocol/src/errors.ts:2-14`（`ErrorCode` union）・
      `packages/protocol/src/messages.ts:319-343`（worktree セクション。`WorktreeCreateParams`/
      `Result` が並びの precedent）・`:415-422`（`METHOD_SCHEMAS`）・`:465-472`
      （`MethodResultMap`）・`packages/protocol/src/messages.test.ts` / 根拠: design.md
      「インターフェース / データ構造 > protocol」
      依存: なし
      AC: AC1, AC2, AC5, AC6, AC7, AC8, AC9

- [x] T2: `WorktreeService` に `remove`・`classifyWorktreeRemoveError` を追加する。
      対象: `packages/server/src/git/WorktreeService.ts`（`interface WorktreeService`:11-14・
      `classifyWorktreeError`:27-46 が precedent・`DefaultWorktreeService.create`:104-122 が
      precedent）・`WorktreeService.test.ts`（`sessionWith`:18-20 スタブの拡張が必要——
      `remove` は `session.snapshot()`/`session.closeWorkspace()` を呼ぶため） / 根拠:
      design.md「インターフェース / データ構造 > サーバ側」「振る舞いの詳細」
      依存: T1
      AC: AC2, AC5, AC6, AC10

- [x] T3: `worktree.remove` の RPC を `surface/methods/worktree.ts` に登録する。
      対象: `packages/server/src/surface/methods/worktree.ts`（`worktree.list`/`worktree.create`
      登録の並び） / 根拠: design.md「インターフェース / データ構造 > サーバ側」
      依存: T1, T2
      AC: AC2, AC5, AC6, AC7, AC8, AC9

- [x] T4: `view.ts` の `DialogContext` に `confirmWorktreeRemove`・`confirmWorktreeRemoveForce`
      を追加する。
      対象: `packages/web/src/store/view.ts:174-190`（`confirmReplacePane` が precedent） /
      根拠: design.md「インターフェース / データ構造 > クライアント側」
      依存: なし
      AC: AC4, AC7, AC-I4

- [x] T5: `clientError.ts` に新しい3エラーコードの日本語メッセージを追加する。
      対象: `packages/web/src/net/clientError.ts:19-26`（既存の worktree 系エントリの並び） /
      根拠: design.md「インターフェース / データ構造 > クライアント側」
      依存: T1
      AC: AC6, AC9

- [x] T6: `ActionDispatcher` に `removeWorktree`・`confirmWorktreeRemove`・
      `confirmWorktreeRemoveForce`・`sendWorktreeRemove`（private）を追加する。
      対象: `packages/web/src/actions/ActionDispatcher.ts`（`confirmWorktreeOpen`:280-284・
      `openWorktree`:249-260・`worktreeErrorMessage`:1032-1039 が precedent） / 根拠:
      design.md「インターフェース / データ構造 > クライアント側」「振る舞いの詳細」
      依存: T1, T4, T5
      AC: AC3, AC4, AC6, AC7, AC8, AC9

- [x] T7: `ConfirmDialog.vue` に `confirmWorktreeRemove`・`confirmWorktreeRemoveForce` の
      message・confirm・cancel の分岐を追加する。
      対象: `packages/web/src/components/ConfirmDialog.vue`（`message` computed:34-42・
      `confirm()`:71-74・`cancel()`・`watch(() => view.dialogContext, ...)` の kind 条件） /
      根拠: design.md「インターフェース / データ構造 > クライアント側」
      依存: T4, T6
      AC: AC4, AC7, AC-I1, AC-I2, AC-I4

- [x] T8: `WorktreeOpenDialog.vue` の各行に削除ボタンを追加し、`Delete`/`Backspace` キーでも
      削除できるようにする。
      対象: `packages/web/src/components/WorktreeOpenDialog.vue`（`onKeydown`:66-86 が
      precedent・`.worktree-open-dialog-item`:102-113 が挿入位置） / 根拠: design.md
      「インターフェース / データ構造 > クライアント側」
      依存: T6
      AC: AC1, AC-I3, AC-I5

- [x] T9: 既存の worktree・pane/tab/workspace 関連テスト（`WorktreeService.test.ts`・
      `ConfirmDialog.test.ts`・`WorktreeOpenDialog.test.ts`・`ActionDispatcher.test.ts`・
      `view.test.ts` 等）が全て無改修のまま通ることを確認する（回帰確認）。**coding ではなく
      test 工程で消化する**（`20260924-pane-dnd-split-move` の decisions.md D3 と同じ扱い）。
      対象: 既存ファイルをそのまま実行するだけ（変更はしない） / 根拠: design.md「対象範囲」
      （`T3` は `T1`・`T2` を推移的に含む。`WorktreeService.test.ts` の拡張は T2 の対象）
      依存: T3, T7, T8
      AC: AC11
