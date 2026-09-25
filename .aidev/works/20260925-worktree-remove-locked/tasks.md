# タスク: ロック済み worktree の削除

## 実装方針

design.md の対象範囲を、型の土台（`ErrorCode` 追加・`DialogContext` 拡張）→ それに依存する
実装（サーバの分類・削除処理／web のメッセージ・確認フロー・ダイアログ表示）→ 回帰確認、の順に
積む。`packages/protocol/src/errors.ts`（T1）と `packages/web/src/store/view.ts`（T4）は
互いにファイルが重ならず、どちらも `依存: なし`なので並行可。T1 に依存する `WorktreeService.ts`
（T2）・`clientError.ts`（T3）はファイルが重ならず並行可。T1・T4 の両方に依存する
`ActionDispatcher.ts`（T5）と、T4 だけに依存する `ConfirmDialog.vue`（T6）もファイルが
重ならず並行可（T6 は `worktree_locked` という文字列リテラルを扱わないため `ErrorCode`
union の更新（T1）を必要としない——`reason: "dirty" | "locked"` という `DialogContext` 側の
型（T4）だけで足りる）。最後に回帰確認（T7）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T4 は最初のウェーブ（並行可）。T1 が終われば T2・T3 が着手できる
（互いに並行可）。T1・T4 の両方が終われば T5 が、T4 が終われば T6 が着手できる（T5・T6 は
互いに並行可）。全て終わってから T7。

## リスク / 留意点

- **`classifyWorktreeRemoveError` の戻り値の型に `worktree_locked` を追加する際、
  `packages/protocol/src/errors.ts` の `ErrorCode` union（T1）が先に更新されている必要がある**
  ——`WorktreeService.ts` の `RpcError(code, ...)` の `code` 引数は `ErrorCode` 型なので、
  T1 より先に T2 を実装すると型エラーになる（design「依拠する既存の事実」）。
- **`--force` を2回渡す変更（T2）が、既存の dirty worktree 削除の回帰を起こさないこと**を
  必ず実機の git で確認する（design で実機確認済みの事実を、コードの変更後にも
  `WorktreeService.test.ts` の既存テストが無改修のまま通ることで再確認する。AC4）。
- **`DialogContext` の `confirmWorktreeRemoveForce` に `reason` を必須フィールドとして追加する
  と（T4）、それを構築している既存コード・既存テスト（`ActionDispatcher.ts:355`・
  `ActionDispatcher.test.ts`・`ConfirmDialog.test.ts` の該当箇所）が型エラーになる**——
  これらは T5・T6 でそれぞれ直す前提（T4 単体の完了時点では一時的に壊れるが、coding 工程の
  終わりまでに全て揃える）。

## テスト方針

- `WorktreeService.test.ts`: `classifyWorktreeRemoveError` にロック済みの stderr
  （実機確認した文字列）を渡すと `worktree_locked` を返すこと（AC1）。ロック済みかつ dirty な
  worktree でも `worktree_locked` になること（design「依拠する既存の事実」の実機確認と同じ
  検証を、実際の git でも確認する）。`remove(force: true)` がロック済み worktree
  （dirty の有無を問わず）を実際に削除できること（AC3。`git worktree lock` した本物の repo で
  確認する。既存の `describe("remove", ...)` の流儀と同じ）。既存の「dirty でも --force を
  付ければ削除できる」テストが無改修のまま通ること（AC4。回帰）。
- `clientError.test.ts`: `worktree_locked` の日本語メッセージが引けること（AC5）。
- `ActionDispatcher.test.ts`: `sendWorktreeRemove` が `worktree_locked` エラーを受けたとき
  `confirmWorktreeRemoveForce`（`reason: "locked"`）を開くこと（AC2）。この `reason` が
  `worktree_locked`/`worktree_dirty` を正しく writeThrough していることが、T6 の
  `ConfirmDialog.vue` が正しい文言を選ぶための前提であり、AC5（利用者への到達）を支える
  配線の検証にあたる（AC5）。既存の `worktree_dirty` 時の動作（`reason: "dirty"` を渡す）が
  無改修で通ること（AC6・回帰——AC6 が守る「既存の確認フロー」はこの分岐を含む）。
- `ConfirmDialog.test.ts`: `confirmWorktreeRemoveForce` が `reason: "locked"` のとき
  ロック専用の文言になること（AC5）。`reason: "dirty"` のときは既存の文言のまま
  （AC6・回帰）。確定/取り消し・キーボード（y/n/Esc）・初期フォーカスが `reason` の値に
  関わらず既存どおり動くこと（AC-I1〜AC-I5）。
- 全タスク完了後、この work で触れた4ファイルの既存テスト
  （`WorktreeService.test.ts`・`clientError.test.ts`・`ActionDispatcher.test.ts`・
  `ConfirmDialog.test.ts`）が無改修のまま通ることを確認する（T7。coding ではなく test 工程で
  最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `packages/protocol/src/errors.ts` の `ErrorCode` union に `worktree_locked` を追加する。
      対象: `packages/protocol/src/errors.ts:16-19` / 根拠: design.md「インターフェース /
      データ構造 > packages/protocol/src/errors.ts」
      依存: なし
      AC: なし

- [x] T2: `WorktreeService.ts` の `classifyWorktreeRemoveError` にロック検知の分岐を追加し、
      `remove()` の `--force` の付け方を2回に変える。`WorktreeService.test.ts` に確認テストを
      足す。
      対象: `packages/server/src/git/WorktreeService.ts:56-67,150-161`・
      `WorktreeService.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      packages/server/src/git/WorktreeService.ts」
      依存: T1
      AC: AC1, AC3, AC4

- [x] T3: `packages/web/src/net/clientError.ts` の `MESSAGES` に `worktree_locked` の日本語
      メッセージを追加する。`clientError.test.ts` に確認テストを足す。
      対象: `packages/web/src/net/clientError.ts:13-32`・`clientError.test.ts` / 根拠:
      design.md「インターフェース / データ構造 > packages/web/src/net/clientError.ts」
      依存: T1
      AC: AC5

- [x] T4: `packages/web/src/store/view.ts` の `DialogContext` の `confirmWorktreeRemoveForce`
      に `reason: "dirty" | "locked"` を追加する。
      対象: `packages/web/src/store/view.ts:194` / 根拠: design.md「インターフェース /
      データ構造 > packages/web/src/store/view.ts」
      依存: なし
      AC: なし

- [x] T5: `ActionDispatcher.ts` の `sendWorktreeRemove` の catch 分岐を `worktree_dirty` と
      `worktree_locked` の両方に広げ、`confirmWorktreeRemoveForce` の `DialogContext` に
      `reason` を渡す。`ActionDispatcher.test.ts` に確認テストを足し、既存の `reason` 無しの
      テストコードを型に合わせて直す。
      対象: `packages/web/src/actions/ActionDispatcher.ts:338-365`・
      `ActionDispatcher.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      packages/web/src/actions/ActionDispatcher.ts」
      依存: T1, T4
      AC: AC2, AC5

- [x] T6: `ConfirmDialog.vue` の `confirmWorktreeRemoveForce` の文言を `reason` で出し分ける。
      `ConfirmDialog.test.ts` に確認テストを足し、既存の `reason` 無しのテストコードを型に
      合わせて直す。
      対象: `packages/web/src/components/ConfirmDialog.vue:51-53`・`ConfirmDialog.test.ts` /
      根拠: design.md「インターフェース / データ構造 >
      packages/web/src/components/ConfirmDialog.vue」
      依存: T4
      AC: AC5, AC6, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5

- [x] T7: 触れた4ファイルの既存テストが全て無改修のまま通ることを確認する（回帰確認）。
      `WorktreeService.test.ts`（AC4 が求める dirty 系の回帰）・`ActionDispatcher.test.ts`と
      `ConfirmDialog.test.ts`（AC6 が求める既存の分類・メッセージ・確認フロー・キーボード
      操作の回帰）が主対象。`clientError.test.ts`の既存メッセージ（`worktree_dirty` 以外の
      worktree 系メッセージを含む）はどの AC にも個別には紐づかないが、この work の変更
      （`worktree_locked` の追加）が既存のテーブル定義に副作用を起こしていないことの一般的な
      確認として同時に実行する。
      **coding ではなく test 工程で消化する**（このセッションの他 work と同じ扱い）。
      対象: `WorktreeService.test.ts`・`clientError.test.ts`・`ActionDispatcher.test.ts`・
      `ConfirmDialog.test.ts`（既存部分を変更せず実行するだけ） / 根拠: design.md「対象範囲」
      依存: T2, T3, T5, T6
      AC: AC4, AC6
