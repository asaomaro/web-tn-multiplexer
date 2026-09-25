# 決定記録

## D1: T1（`Connection.ts`）の負の確認

- 背景・決定: T1 で追加した `Object.assign(err, { code: envelope.error.code })` を一時的に
  取り除き、新規テスト（AC1・AC4）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`Object.assign` 呼び出しを一時的に取り除いた場合）

```
FAIL  src/net/Connection.test.ts > Connection > request: サーバのエラー応答を reject するとき、reject される Error は code プロパティも持つ（AC1・AC4）
AssertionError: expected Error: not_found: no such pane to match object { code: 'not_found', …(1) }

- Expected
+ Received

- {
-   "code": "not_found",
+ Error {
    "message": "not_found: no such pane",
  }

 ❯ src/net/Connection.test.ts:307:20

 Test Files  1 failed (1)
      Tests  1 failed | 38 skipped (39)
```

復元すると `Connection.test.ts` 全39件が pass することを確認した（既存の「message に code の
文言が含まれる」テストを含む——回帰なし）。**復元後のファイルが元の変更と一致することも
確認済み**——`git diff --numstat packages/web/src/net/Connection.ts` が taskcheck 前と同じ
`6 1`（6行追加・1行削除）に戻っていることで確認した（一時的な変更の痕跡が残っていない）。

## D2: T2（`clientError.ts`）の負の確認

- 背景・決定: T2 で `errorCodeOf` に追加した `.code` 優先の判定ブロックを一時的に取り除き、
  新規テスト（AC2）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`.code` 優先の判定ブロックを一時的に取り除いた場合）

```
FAIL  src/net/clientError.test.ts > errorCodeOf > code プロパティを持てば最優先でそれを返す（AC2）
AssertionError: expected 'worktree_dirty' to be 'worktree_locked' // Object.is equality

Expected: "worktree_locked"
Received: "worktree_dirty"

 ❯ src/net/clientError.test.ts:77:30

 Test Files  1 failed (1)
      Tests  1 failed | 14 skipped (15)
```

復元すると `clientError.test.ts` 全15件が pass することを確認した（既存の正規表現フォールバック
テストを含む——回帰なし）。**復元後のファイルが元の変更と一致することも確認済み**——
`git diff --numstat packages/web/src/net/clientError.ts` が taskcheck 前と同じ `9 3`（9行
追加・3行削除）に戻っていることで確認した（一時的な変更の痕跡が残っていない）。
