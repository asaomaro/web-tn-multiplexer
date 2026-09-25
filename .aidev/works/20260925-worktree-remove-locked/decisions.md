# 決定記録

## D1: T2（`classifyWorktreeRemoveError`・`remove()`）の負の確認（regression-negative-control）

- 背景: `.aidev/conventions/regression-negative-control.md` に従い、T2 の新規テスト4件
  （`classifyWorktreeRemoveError` のロック判定2件・`remove()` のロック済み対象への実機確認2件）
  が「修正前のコードで実際に落ちる」ことを確認した。
- 決定: `classifyWorktreeRemoveError` のロック判定分岐と、`remove()` の `--force` を2回渡す
  変更を一時的に取り除いたところ、以下のとおり期待どおり失敗することを確認した。
- 影響: コードへの影響なし（確認のみ。復元後は下記のとおり全て pass）。

### 負の確認の生ログ（`classifyWorktreeRemoveError` のロック分岐と `remove()` の
`--force --force` 化を一時的に取り除いた場合）

```
FAIL  src/git/WorktreeService.test.ts > DefaultWorktreeService（本物の git を使う。既存の GitInfoPoller.test.ts と同じ流儀） > remove > ロック済みだと worktree_locked で失敗する（force 無し。AC1）
（AssertionError: expected code "worktree_failed" to be "worktree_locked"。実際のログでは4件目のロック済み・force無しテストも同様に失敗——下記の4件がまとめて失敗した）

FAIL  src/git/WorktreeService.test.ts > DefaultWorktreeService（本物の git を使う。既存の GitInfoPoller.test.ts と同じ流儀） > remove > ロック済み（かつ dirty）でも --force で削除できる（AC3）
RpcError: git worktree remove failed (worktree_failed)
 ❯ DefaultWorktreeService.remove src/git/WorktreeService.ts:164:13

FAIL  src/git/WorktreeService.test.ts > classifyWorktreeRemoveError > ロック済み（reason 付き）
AssertionError: expected 'worktree_failed' to be 'worktree_locked' // Object.is equality
Expected: "worktree_locked"
Received: "worktree_failed"
 ❯ src/git/WorktreeService.test.ts:314:49

FAIL  src/git/WorktreeService.test.ts > classifyWorktreeRemoveError > ロック済み（reason 無し）
AssertionError: expected 'worktree_failed' to be 'worktree_locked' // Object.is equality
Expected: "worktree_locked"
Received: "worktree_failed"
 ❯ src/git/WorktreeService.test.ts:319:49

 Test Files  1 failed (1)
      Tests  4 failed | 33 passed (37)
```

修正（ロック判定分岐・`--force --force` 化）を戻すと、`WorktreeService.test.ts` 全37件が pass
することを確認した。**復元後のファイルが元の変更（取り除く前の状態）と一致することも確認済み**
——復元は Edit ツールで一時的な削除を打ち消す形で行い、`git diff --stat
src/git/WorktreeService.ts` が taskcheck 前と同じ差分サイズ（`+10 -2`）に戻っていることで
確認した（一時的な変更の痕跡が残っていない）。

### 副次的な発見: `@wtm/protocol` の型宣言が stale だと `tsc --noEmit` が誤検出する

負の確認の作業中、T1（`packages/protocol/src/errors.ts` への `worktree_locked` 追加）の後に
`pnpm --filter @wtm/protocol run build` を実行していなかったため、`packages/server` の
`tsc --noEmit -p tsconfig.typecheck.json` が `"worktree_locked" is not assignable to type
'ErrorCode'` という誤ったエラーを出した（`@wtm/protocol` は `dist/index.d.ts` を `types` に
指定しており、ソースの変更が自動で反映されないため）。`vitest`（ソースを直接 transpile する）
では問題なく通っていたので気付きにくい。`pnpm --filter @wtm/protocol run build` で再ビルドすると
解消した。T1 のような protocol 側の型変更を行った後は、依存パッケージの `tsc --noEmit` を打つ前に
protocol を再ビルドする必要がある（このセッションの既存の慣習——`aidev smoke` の `pnpm -s build`
がこれを毎回行っているので deliver 前には自然に解消するが、coding 中の個別の typecheck では
明示的な再ビルドが要る）。

## D2: T3（`clientError.ts`）の負の確認

- 背景・決定: T3 で追加した `worktree_locked` の日本語メッセージ（`clientError.ts`）を一時的に
  取り除き、新規テストが実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`MESSAGES` から `worktree_locked` のエントリを一時的に取り除いた場合）

```
FAIL  src/net/clientError.test.ts > worktree のロック済み削除（20260925-worktree-remove-locked） > worktree_locked は「ロックされています」を含む文言で、既存の worktree_dirty とは別の文言
AssertionError: expected 'サーバでエラーが起きました（worktree_locked）。' to contain 'ロックされています'

Expected: "ロックされています"
Received: "サーバでエラーが起きました（worktree_locked）。"

 ❯ src/net/clientError.test.ts:56:51

 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```

復元すると `clientError.test.ts` 全12件が pass することを確認した。

## D3: T5（`ActionDispatcher.ts`）の負の確認

- 背景・決定: T5 で `sendWorktreeRemove` の catch 分岐に追加した
  `code === "worktree_locked"` の条件を一時的に取り除き、新規テスト（AC2）が実際に落ちることを
  確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`code === "worktree_locked"` の条件を一時的に取り除いた場合）

```
FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — worktree の削除 > confirmWorktreeRemove：ロック済みで失敗すると、一覧へは戻らず reason: locked の --force 確認を開く（AC2）
AssertionError: expected null to deeply equal { …(5) }

- Expected:
{
  "kind": "confirmWorktreeRemoveForce",
  "openWorkspaceId": "w9",
  "path": "/w/a",
  "reason": "locked",
  "sourceWorkspaceId": "w1",
}

+ Received:
null

 ❯ src/actions/ActionDispatcher.test.ts:1388:32

 Test Files  1 failed (1)
      Tests  1 failed | 143 skipped (144)
```

復元すると `ActionDispatcher.test.ts` 全144件が pass することを確認した（既存の dirty 系
テスト・`reason` フィールドを追加した既存テストを含む——回帰なし）。

## D4: T6（`ConfirmDialog.vue`）の負の確認

- 背景・決定: T6 で `message` computed に追加した `ctx.reason === "locked"` の三項演算子を
  一時的に取り除き、新規テスト（AC5）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`ctx.reason === "locked"` の分岐を一時的に取り除いた場合）

```
FAIL  src/components/ConfirmDialog.test.ts > ConfirmDialog — worktree の削除の確認（kind: confirmWorktreeRemove / confirmWorktreeRemoveForce） > ロック済みでの --force 確認は「ロックされています」を含む専用のメッセージ（AC5）
AssertionError: expected 'この worktree には未コミットの変更が残っています。変更を破棄して…' to contain 'ロックされています'

Expected: "ロックされています"
Received: "この worktree には未コミットの変更が残っています。変更を破棄して削除しますか？"

 ❯ src/components/ConfirmDialog.test.ts:276:59

 Test Files  1 failed (1)
      Tests  1 failed | 33 skipped (34)
```

復元すると `ConfirmDialog.test.ts` 全34件が pass することを確認した（既存の dirty 系メッセージ・
確定/取り消し・キーボード・初期フォーカスのテスト、`reason` フィールドを追加した既存テストを
含む——回帰なし）。`npx vue-tsc --noEmit -p tsconfig.typecheck.json`（web package 全体。T4〜T6の
全ファイルを含む）も exit 0 で、T4 で必須化した `reason` フィールドの波及箇所（T5・T6 の両方の
diff）が過不足なく揃っていることを確認した。
