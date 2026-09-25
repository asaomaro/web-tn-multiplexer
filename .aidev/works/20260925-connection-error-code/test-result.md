# テスト結果: Connection のエラーがコードをプロパティで持つ

## 実行内容

### 1. 対象ファイルの単体テスト（新規・既存とも）

```
cd packages/web && npx vitest run src/net/Connection.test.ts src/net/clientError.test.ts
```

```
 Test Files  2 passed (2)
      Tests  54 passed (54)
```
（Connection 39件・clientError 15件）

`code` プロパティの付与（AC1・AC4）・`errorCodeOf` の `.code` 優先判定（AC2・AC3）の新規
テストを含め、既存部分も無改修のまま通った。

### 2. 回帰確認（T3。AC5）

```
cd packages/web && npx vitest run src/actions/ActionDispatcher.test.ts
```

```
 Test Files  1 passed (1)
      Tests  144 passed (144)
```

`errorCodeOf`/`worktreeErrorMessage` の消費側（worktree 系の分岐を含む）は無改修のまま
全件通過。

### 3. web パッケージ全体

```
cd packages/web && npx vue-tsc --noEmit -p tsconfig.typecheck.json
```

exit 0（エラーなし）。

### 4. モノレポ全体（root）

```
pnpm -s typecheck
```

exit 0（エラーなし）。

```
pnpm -s vitest run
```

```
 Test Files  161 passed (161)
      Tests  2978 passed (2978)
```

### 5. smoke / coverage

```
aidev smoke
```

`smoke: pass (exit 0, 2 本)`（web・cli とも PASS）。

```
aidev coverage --strict
```

```
coverage-summary: ac=5 design=5/5(100%) tasks=5/5(100%) task_rows=3 no_ac=0 ac_none=0 gaps=0
coverage-gaps: struct=0 cover=0
```

## 負の確認（regression-negative-control）

`decisions.md` の D1〜D2 に、この work の2つの振る舞い変更（T1: `Connection.ts` の `code`
プロパティ付与／T2: `clientError.ts` の `errorCodeOf` の `.code` 優先判定）それぞれについて、
一時的に取り除いて対応する新規テストが実際に失敗することを確認した生ログと、復元後に
該当ファイルの全テストが pass することを記録済み（詳細は decisions.md 参照）。

## 結論

全ての受け入れ基準（AC1〜AC5）に対応するテストが存在し、単体・回帰・モノレポ全体・smoke の
いずれも green。T3（既存テストの無改修確認）もこの工程で完了。回帰なし。
