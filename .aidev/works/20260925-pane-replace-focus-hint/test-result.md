# テスト結果: pane.replace の後継 focus ヒント

## 実行内容

### 1. 対象ファイルの単体テスト（新規・既存とも）

```
cd packages/server && npx vitest run src/session/SessionModel.test.ts src/session/SessionService.test.ts
```

```
 Test Files  2 passed (2)
      Tests  192 passed (192)
```

```
cd packages/web && npx vitest run src/store/viewRepair.test.ts src/store/StoreAdapter.test.ts
```

```
 Test Files  2 passed (2)
      Tests  43 passed (43)
```

`successorPaneId`/`successorHint` の追加・`replacePane` の後継ヒント・`closePane`/
`closeTab`/`closeWorkspace` のキー不在（T3 taskcheck round1 で発見・是正）・`repairView` の
D5 再現テスト・`StoreAdapter` のエンドツーエンド確認・ヒントの使い捨て性質（T5 taskcheck
round1 で発見・追加）の新規テストを含め、既存部分（T6）も無改修のまま通った。

### 2. server パッケージ全体

```
cd packages/server && npx vitest run
```

```
 Test Files  53 passed (53)
      Tests  829 passed (829)
```

```
cd packages/protocol && npx tsc -b   # T1 の型変更を反映
cd packages/server && npx tsc --noEmit -p tsconfig.typecheck.json
```

exit 0（エラーなし。`exactOptionalPropertyTypes: true` の下での型エラー——T3 taskcheck
round1 で発見——も解消済み）。

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
      Tests  3003 passed (3003)
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
coverage-summary: ac=7 design=7/7(100%) tasks=7/7(100%) task_rows=6 no_ac=0 ac_none=0 gaps=0
coverage-gaps: struct=0 cover=0
```

## 負の確認（regression-negative-control）

`decisions.md` の D1〜D6 に、この work の6つの振る舞い変更（T2: `replacePane` の
`successorPaneId`／T3: `SessionService` の発行統一・`exactOptionalPropertyTypes` 対応後の
キー不在テスト3件／T4: `repairView` の D5 再現／T5: `StoreAdapter` のエンドツーエンド配線・
ヒントの使い捨て性質）それぞれについて、一時的に取り除いて対応する新規テストが実際に
失敗することを確認した生ログと、復元後に該当ファイルの全テストが pass することを記録済み
（詳細は decisions.md 参照）。特に D2・D4 は、`.aidev/works/20260924-pane-dnd-split-move/
decisions.md` D5 が記録した実際のバグ（DFS順だと別 pane が選ばれてしまう）を、単体レベル
（D2: `viewRepair.ts`）とエンドツーエンドレベル（D4: `StoreAdapter.ts`）の両方で再現し、
この work の変更で解消されることを裏付けている。

## 結論

全ての受け入れ基準（AC1〜AC7）に対応するテストが存在し、単体・回帰・モノレポ全体・smoke の
いずれも green。T6（既存テストの無改修確認）もこの工程で完了。回帰なし。
