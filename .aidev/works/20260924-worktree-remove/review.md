# レビュー: worktree の削除

## タスク点検ログ

- [nit][conv:-] `WorktreeRemoveResult` を空の `interface {}` として新規定義していたが、
  このリポジトリでは「成功のみを返す（値を持たない）」結果型は `Record<string, never>`
  で表す既存の規約がある（`pane.close` の `MethodResultMap` エントリ:
  `packages/protocol/src/messages.ts:469`）。空の named interface は規約から外れていた。 /
  対応: 専用の interface を削除し、`MethodResultMap` のエントリを直接
  `Record<string, never>` にした（`pane.close` と同じ形）。 / src: T1 taskcheck round1
- [must][conv:-] `remove` の最重要の安全策（`git worktree remove` が失敗したら
  `closeWorkspace` を呼ばない）を、削除対象が実際に開いている workspace と一致する状況で
  直接確かめるテストが無かった——既存の失敗系3テストはいずれも一致する候補が無い
  `sessionWith(repo)`（openWorkspaces 省略）で呼ばれており、close 呼び出しの順序を壊しても
  検出できない状態だった。 / 対応: 「開いている workspace と一致していても、dirty で失敗すれば
  closeWorkspace は呼ばない」テストを追加し、`session.closedWorkspaceIds` が空のままであることを
  直接アサートするようにした。 / src: T2 taskcheck round1
- [should][conv:-] `WorktreeService` interface への `remove` 追加が、対象外の2ファイル
  （`surface/methods/index.test.ts`・`ws/WsGateway.integration.test.ts` の `stubWorktrees`
  ヘルパー）の型検査を壊していた（`tsconfig.typecheck.json` でのみ検出される——このセッションで
  `tsconfig.json` を使っていたため見落としていた）。 / 対応: 両ファイルの `stubWorktrees` に
  `remove` のスタブ実装を追加した。 / src: T2 taskcheck round1
- [nit][conv:-] `classifyWorktreeRemoveError` の submodule ケースのテストが、実測済みの他4件と
  同じ「実測」の説明に紛れており、design.md 自身が「herdr のソースのみに確認があり実機未検証」と
  明記していることと食い違って見えた。 / 対応: そのテストだけ「未検証・herdr 由来」と明記した。 /
  src: T2 taskcheck round1
- [should][conv:-] `ConfirmDialog.vue` の `CONFIRM_DIALOG_KINDS` を `as const` のタプル→
  `as readonly string[]` キャストで `.includes(ctx.kind)` に渡しており、リテラル型による
  絞り込みを自ら捨てていた。配列内の kind 名のタイプミスがあってもコンパイルは通り、実行時に
  「そのダイアログだけ showModal/フォーカスが効かない」という形でしか気付けない状態だった。 /
  対応: `const CONFIRM_DIALOG_KINDS: DialogContext["kind"][] = [...]`（`DialogContext` 型を
  `view.js` から import）に変え、キャストを削除した。わざとタイプミスを入れて
  `TS2820`（存在しない kind 名として弾かれる）で検出できることを確認してから正しい値へ戻した。 /
  src: T7 taskcheck round1

## レビュー ラウンド1

- [should][conv:-] `ActionDispatcher.ts` の `sendWorktreeRemove`（`.then(() =>
  this.openWorktree(sourceWorkspaceId))`）と `WorktreeService.remove`（成功後の
  `session.closeWorkspace(openWorkspace.id)`）の組み合わせで、**削除対象の worktree が、
  一覧を開いた元の workspace（`sourceWorkspaceId`）自身であるケース**（自分が今いる
  workspace の行を右クリック→「worktree を開く…」→その一覧から自分自身のエントリを削除、
  という自然な操作）で AC3 が満たされていなかった。サーバは成功後に `sourceWorkspaceId`
  自身を close してから応答を返すため、クライアントの `.then()` が呼ぶ
  `openWorktree(sourceWorkspaceId)`（もう存在しない workspaceId への `worktree.list`）が
  `not_found` で失敗し、利用者には「削除は成功した」ことが伝わらず、無関係な汎用トーストだけが
  出ていた。 / 対応: `sourceWorkspaceId === openWorkspaceId`（ダイアログを開いた時点で分かる
  ——自分自身の worktree を対象にしている）なら `openWorktree` を呼ばないようにした。
  view の移動先は既存の `repairView`（`StoreAdapter.ts`。この work では変更していない
  既存の仕組み）に任せる。
- [should][conv:-] `sendWorktreeRemove` が、RPC の応答到着時に `view.dialogContext` の状態を
  確認せず、無条件で `openWorktree`/`confirmWorktreeRemoveForce` を開いていた
  （`20260924-pane-move-cross-tab` の review round1 で見つかった「RPC 応答待ち中に view が
  動く」と同種の懸念——応答を待つ間に利用者が別の操作で他のダイアログを開いていた場合、
  応答到着時に奪ってしまう）。 / 対応: 成功時・dirty での force 確認への遷移時のどちらも、
  `view.dialogContext === null`（このメソッドが直前に `closeDialog()` した状態のまま——
  何も割り込んでいない）ことを確認してから実行するよう変更した。
- [should][conv:-]（記録のみ・修正見送り）`ConfirmDialog.vue` の確認メッセージの `openWorkspaceId`
  は、確認ダイアログを**開いた瞬間**のスナップショットで確定まで再評価されない。複数
  クライアントが同じ repo を開いている状況で、確認ダイアログが開いている間に**別クライアント**
  がその path を新しく workspace として開くと、確認メッセージは「開いています」に触れないまま
  なのに、確定するとサーバは最新の状態を見てその workspace を黙って閉じる——AC4/US2 が
  求める「気付かずに動いている workspace を消す事故を避けたい」という保証がこの経路では
  効かない。 / 対応: この work では修正しない。design.md が既に「一覧の即時同期（新しい push
  イベント）は作らない」と決めた既存のトレードオフ（`worktree.list` はどの操作についても
  live に同期しない）の範囲内にある、狭い多クライアント競合であり、確定直前の再チェックは
  新しい往復を増やす非対称な対応になる。backlog に記録する。
- [nit][conv:-]（記録のみ・修正見送り）`classifyWorktreeRemoveError` は lock 済み worktree
  （`git worktree lock`）のエラー（実機確認:
  `fatal: cannot remove a locked working tree; use 'remove -f -f' to override or unlock
  first`）をどの分岐にもマッチさせず `worktree_failed` に落ちる。`--force` 単体では
  locked worktree を削除できず（`-f -f` が要る）、利用者は汎用メッセージのまま行き詰まる。 /
  対応: 優先度が低いため今回は見送り、backlog に記録する。

## レビュー ラウンド2

round1 の should 2件（対応済み）・修正見送りの should 1件・nit 1件（いずれも backlog へ記録
済み）への対応を確認した。`ActionDispatcher.ts` の `sendWorktreeRemove`（自己削除ガード・
RPC 応答待ち中の他ダイアログ保護）の diff を再読し、意図どおりの修正であることを確認。
JSDoc コメントが古い記述（「結末に関わらず開き直す」）のままだったので、2つの例外を明記する
形に更新した。両修正とも負の確認（修正前に戻すと新テスト3件が失敗する）済み（test-result.md
参照）。新たな指摘なし。
