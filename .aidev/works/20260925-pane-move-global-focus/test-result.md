# テスト結果: レイアウト操作後のグローバル focus の更新

## 実行内容

### 1. 対象ファイルの単体テスト（新規・既存とも）

```
cd packages/server && npx vitest run src/session/SessionModel.test.ts
```

```
 Test Files  1 passed (1)
      Tests  93 passed (93)
```

`swapPaneWith`・`moveToEdge`・`replacePane`・`moveToTab`・`moveToNewTab` それぞれの成功時
focus 更新（AC1〜AC5）・失敗パスでの focus 不変（5メソュッド全て）・`moveToTab`/
`moveToNewTab` の `closeEmptyTabShell` 経由での上書き回避（AC4・AC5 の再現テスト）を含め、
既存部分も無改修のまま通った。

### 2. 回帰確認（T4。AC6・AC7）

```
cd packages/server && npx vitest run src/session/SessionService.test.ts
```

```
 Test Files  1 passed (1)
      Tests  94 passed (94)
```

`moveToTab`/`moveToNewTab` のイベント列検証テスト（`session.focus_changed` を含まない期待値）
を含め、無改修のまま全件通過——`tab.focusedPaneId`・`workspace.activeTabId`・配布イベントに
影響が無いことを確認。

### 3. server パッケージ全体

```
cd packages/server && npx vitest run
```

```
 Test Files  53 passed (53)
      Tests  824 passed (824)
```

```
cd packages/server && npx tsc --noEmit -p tsconfig.typecheck.json
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
      Tests  2991 passed (2991)
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
coverage-summary: ac=7 design=7/7(100%) tasks=7/7(100%) task_rows=4 no_ac=0 ac_none=0 gaps=0
coverage-gaps: struct=0 cover=0
```

## 負の確認（regression-negative-control）

`decisions.md` の D1〜D3 に、この work の3つの振る舞い変更（T1: `swapPaneWith`・
`moveToEdge` の focus 更新／T2: `replacePane` の無条件化／T3: `moveToTab`・`moveToNewTab`
の focus 更新と `closeEmptyTabShell` との呼び出し順の入れ替え）それぞれについて、一時的に
取り除いて対応する新規テストが実際に失敗することを確認した生ログと、復元後に該当テストが
pass することを記録済み（詳細は decisions.md 参照）。特に D3 は、design で発見した
「`moveToNewTab` が cross-workspace かつ移動元 tab が閉じるケースで、正しく設定した focus が
`closeEmptyTabShell` の救済ロジックに上書きされる」という実際のバグを、負の確認そのもので
再現している。

## 結論

全ての受け入れ基準（AC1〜AC7）に対応するテストが存在し、単体・回帰・モノレポ全体・smoke の
いずれも green。T4（既存テストの無改修確認）もこの工程で完了。回帰なし。
