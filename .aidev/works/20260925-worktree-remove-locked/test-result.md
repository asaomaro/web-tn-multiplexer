# テスト結果: ロック済み worktree の削除

## 実行内容

### 1. 対象ファイルの単体テスト（新規・既存とも）

```
cd packages/server && npx vitest run src/git/WorktreeService.test.ts
```

```
 Test Files  1 passed (1)
      Tests  37 passed (37)
```

`classifyWorktreeRemoveError` のロック判定（reason 付き・reason 無し）・`remove()` の
ロック済み worktree への実機確認（force無し失敗・`--force --force` での成功）を含め、既存部分
（T7）も無改修のまま通った。

```
cd packages/web && npx vitest run src/net/clientError.test.ts src/actions/ActionDispatcher.test.ts src/components/ConfirmDialog.test.ts
```

```
 Test Files  3 passed (3)
      Tests  191 passed (191)
```
（clientError 12件・ActionDispatcher 144件・ConfirmDialog 35件）

T3・T5・T6 の新規テスト（AC2・AC5・AC-I1〜AC-I5）を含め、既存部分（T7）も無改修のまま通った。

### 2. server パッケージ全体

```
cd packages/server && npx vitest run
```

```
 Test Files  53 passed (53)
      Tests  811 passed (811)
```

```
cd packages/protocol && npx tsc -b   # T1 の型変更を反映
cd packages/server && npx tsc --noEmit -p tsconfig.typecheck.json
```

exit 0（エラーなし）。

### 3. web パッケージ全体

```
cd packages/web && npx vue-tsc --noEmit -p tsconfig.typecheck.json
```

exit 0（エラーなし。T4 で必須化した `reason` フィールドの波及箇所（T5・T6）が過不足なく揃って
いることを確認）。

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
      Tests  2974 passed (2974)
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
coverage-summary: ac=11 design=11/11(100%) tasks=11/11(100%) task_rows=7 no_ac=0 ac_none=2 gaps=0
coverage-gaps: struct=0 cover=0
```

## 負の確認（regression-negative-control）

`decisions.md` の D1〜D4 に、この work の4つの振る舞い変更（T2: `classifyWorktreeRemoveError`
のロック分岐・`remove()` の `--force --force` 化／T3: `clientError.ts` の `worktree_locked`
メッセージ／T5: `ActionDispatcher.ts` の catch 分岐拡張／T6: `ConfirmDialog.vue` の文言出し分け）
それぞれについて、一時的に取り除いて対応する新規テストが実際に失敗することを確認した生ログと、
復元後に該当ファイルの全テストが pass することを記録済み（詳細は decisions.md 参照）。

## 結論

全ての受け入れ基準（AC1〜AC6・AC-I1〜AC-I5）に対応するテストが存在し、単体・統合・モノレポ
全体・smoke のいずれも green。T7（既存テストの無改修確認）もこの工程で完了。回帰なし。
