# レビュー: Workspace.git の即時化

## タスク点検ログ

- [must][conv:-] T3（`surface/methods/index.test.ts`）: `workspace.create` が応答を
  待たせずに `gitPoller.pollWorkspaceNow` を呼ぶことの検証テストが、実際には検証できて
  いなかった。`FakeGitInfoPoller.pollWorkspaceNow` が `await` を挟まず同期的に配列へ push
  していたため、fire-and-forget（正しい実装）でも await（バグ）でも `invoke()` が返る
  時点で同じ内容になり、区別が付かなかった。 / 対応: `FakeGitInfoPoller` を
  `releasePending()` を呼ぶまで解決しない deferred promise 方式に直し、「応答が返った
  時点ではまだ完了させていない」ことを直接確認する形にした。負の確認: 実装側を一時的に
  `await deps.gitPoller.pollWorkspaceNow(...)` に戻すと、強化後のテストが実際に
  タイムアウトで失敗する（`Error: Test timed out in 5000ms`）ことを確認し、戻すと
  23件全て pass することを確認した。 / src: T3 taskcheck round1

- [must][conv:regression-negative-control!] T5（`composeServer.integration.test.ts`）: AC1 の
  新規 end-to-end テストについて「修正前のコードで落ちる」ことを確認した記録が diff にも
  test-result.md にも review.md にも無かった。負の確認自体は coding 中に実施済みだったが、
  記録が残っていなかった。 / 対応: `decisions.md` の D1 に、`workspace.ts` の
  `void deps.gitPoller.pollWorkspaceNow(...)` 呼び出しを一時的に削除して再現した失敗ログ
  （`AssertionError: expected null to match object { branch: 'main' }`）と、復元後に
  `composeServer.integration.test.ts` 全20件が pass することを記録した。 / src: T5 taskcheck round1
- [nit][conv:-] T5（`composeServer.integration.test.ts`）: AC3 のアサーション
  （`responseMs < 2000`）は実リポジトリの git 呼び出しが速いため、`await` への退行を入れても
  閾値を超えず、この E2E 側の assertion 単体では検知できないという限界がコメントに
  書かれていなかった。 / 対応: コメントを書き直し、厳密な検証は `index.test.ts` の
  `FakeGitInfoPoller`（`releasePending()` で明示的に遅延させる決定的なテスト）が担うことを
  明記した。 / src: T5 taskcheck round1

T1・T2・T4 は findings 0 で通過。
