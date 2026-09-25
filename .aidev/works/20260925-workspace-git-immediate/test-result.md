# テスト結果: Workspace.git の即時化

## 実行内容

### 1. 対象ファイルの単体テスト（新規・既存とも）

```
cd packages/server && npx vitest run src/git/GitInfoPoller.test.ts
```

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

`pollWorkspaceNow` の新規テスト（AC2・AC4）を含め、既存部分（T6）も無改修のまま通った。

```
cd packages/server && npx vitest run src/composeServer.integration.test.ts
```

```
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

T5 の新規 end-to-end テスト（AC1・AC3）を含め、既存部分（T6）も無改修のまま通った。

### 2. server パッケージ全体

```
cd packages/server && npx vitest run
```

```
 Test Files  53 passed (53)
      Tests  807 passed (807)
```

```
cd packages/server && npx tsc --noEmit -p tsconfig.typecheck.json
```

exit 0（エラーなし）。

### 3. モノレポ全体（root）

```
pnpm -s typecheck
```

exit 0（エラーなし）。

```
pnpm -s vitest run
```

```
 Test Files  161 passed (161)
      Tests  2963 passed (2963)
```

### 4. smoke / coverage

```
aidev smoke
```

`smoke: pass (exit 0, 2 本)`（web・cli とも PASS）。

```
aidev coverage --strict
```

```
coverage-summary: ac=4 design=4/4(100%) tasks=4/4(100%) task_rows=6 no_ac=0 ac_none=3 gaps=0
coverage-gaps: struct=0 cover=0
```

## 負の確認（regression-negative-control。T5 / AC1・AC3）

taskcheck T5 round1 の must 指摘を受け、`decisions.md` D1 に記録した負の確認をここにも転記する
（`.aidev/conventions/regression-negative-control.md` に従い、生ログをそのまま残す）。

`packages/server/src/surface/methods/workspace.ts` の
`void deps.gitPoller.pollWorkspaceNow(result.workspace.id).catch(() => undefined);` を
一時的に削除し、`composeServer.integration.test.ts` を実行:

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

修正（`pollWorkspaceNow` 呼び出し）を復元し再実行すると、`composeServer.integration.test.ts`
全20件が pass することを確認した（上記「1.」の結果と同じ）。

## 結論

全ての受け入れ基準（AC1〜AC4）に対応するテストが存在し、単体・統合・モノレポ全体・smoke の
いずれも green。T6（既存テストの無改修確認）もこの工程で完了。回帰なし。
