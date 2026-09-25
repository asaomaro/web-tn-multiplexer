# 決定記録

## D1: T5（end-to-end テスト）の負の確認の記録漏れへの対応（taskcheck T5 round1 must）

- 背景: T5（`composeServer.integration.test.ts` の実際の git を使う end-to-end テスト）の
  taskcheck round1 で、AC1 の新規テストが「修正前のコードで実際に落ちる」ことを確認した
  記録（生ログ）がどこにも残っていない、という指摘があった。taskcheck 自身が独立に同じ確認
  （`workspace.ts` の `pollWorkspaceNow` 呼び出しを一時的に削除→実行→戻す）を行い、
  実際に失敗することを確認済みだったが、この work では test-result.md がまだ作られておらず
  （test 工程はこの後）、負の確認自体は coding 中に私自身も一度実施済みだったのに、記録が
  残っていなかった。
- 決定: 実施済みの負の確認の生ログをここに記録する（test-result.md にも test 工程で転記
  する）。
- 影響: コードへの影響なし（記録の追加のみ）。

### 負の確認の生ログ（`workspace.ts` の `void deps.gitPoller.pollWorkspaceNow(...)` 呼び出しを
一時的に削除した場合）

```
FAIL  src/composeServer.integration.test.ts > composeServer (integration) > workspace.create は、実際の git リポジトリなら定期ポーリング（5秒）を待たずに Workspace.git が埋まる（20260925-workspace-git-immediate。AC1・AC3）
AssertionError: expected null to match object { branch: 'main' }

- Expected:
{
  "branch": "main",
}

+ Received:
null

 ❯ src/composeServer.integration.test.ts:510:21
```

修正（`pollWorkspaceNow` 呼び出し）を戻すと `composeServer.integration.test.ts` 全20件とも
pass することを確認済み。

## D2: taskcheck T5 round1 の nit への対応——AC3 の assertion の限界をコメントに明記

- 背景: AC3 の `responseMs < 2000` という assertion は、実リポジトリの git 呼び出しが速いため
  `await` への退行（バグ）を入れても超過せず、この assertion 単体では検知できないことが
  taskcheck の実地確認で判明した。厳密な検証は `index.test.ts` の `FakeGitInfoPoller`
  （`releasePending()` で明示的に遅延させる決定的なテスト。T3 round1 で強化済み。review.md
  参照）が担っており、機能上の欠陥ではないが、コメントがこの限界に触れていなかった。
- 決定: コメントに「これは粗い sanity check であり、厳密な検証は index.test.ts が担う」旨を
  明記した。
- 影響: `packages/server/src/composeServer.integration.test.ts` のコメントのみ。
