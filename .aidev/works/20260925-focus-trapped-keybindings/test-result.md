# テスト結果: keydown を止めるボタンにフォーカスが残っていても prefix・直接のキーを効かせる

## 実行したもの
- `cd packages/web && npx vitest run` — 1980 passed / 0 failed / 0 skipped（90 files）
- `cd packages/server && npx vitest run` — 829 passed / 0 failed / 0 skipped（53 files）
- `cd packages/web && npx vitest run src/components/Sidebar.test.ts src/components/TabBar.test.ts src/components/PaneFrame.test.ts` — 139 passed / 0 failed（3 files。無改修部分を含む）
- `cd packages/web && pnpm -s typecheck` — exit 0
- `cd packages/server && pnpm -s typecheck` — exit 0
- `pnpm -s typecheck`（root） — exit 0
- `cd packages/e2e && pnpm -s typecheck` — exit 0
- `cd packages/e2e && npx playwright test src/specs/key-bindings.spec.ts --workers=1` — 23 passed / 1 failed（無関係な既存失敗。下記参照）

## 受け入れ基準ごとの判定
- AC1: pass — `Sidebar.vue` 6箇所すべてで `onButtonKeydown` が無修飾 Enter/Space だけ止めることを
  単体テスト（`Sidebar.test.ts`）6ケースで確認。実ブラウザでも「並び順」ボタンで確認
  （`key-bindings.spec.ts` 新設テスト。フォーカスが残ったまま `prefixKey` で実際に分割できる）。
- AC2: pass — 修飾付き直接キーが素通しされることを単体テストで確認。実ブラウザでも「並び順」
  ボタンで確認（`openWithPrefs` で `ctrl+alt+d` を割り当て、フォーカスが残ったまま実際に分割できる）。
- AC3: pass — `onButtonKeydown` が `preventDefault()` を呼ばないことを単体テストで確認
  （happy-dom はネイティブな `click` 発火を再現しないため、`ev.defaultPrevented === false` で確認。
  decisions.md D0）。
- AC4: pass — `TabBar.vue` の「＋」ボタンで単体テスト（`TabBar.test.ts`）1ケース、実ブラウザ
  （`key-bindings.spec.ts` 新設テスト。`.focus()` でフォーカスを残したまま prefix キーが効く）で確認。
- AC5: pass — Tab・修飾付きキー・他のキーで window の keydown スパイが呼ばれることを単体テスト
  （`Sidebar.test.ts`・`TabBar.test.ts`）で確認。
- AC6: pass — `docs/verification.md:897-905` に navigate モード中の既知の制約を記録済み。
  記述内容は `PaneFrame.vue`/`ContextMenu.vue` の実装と照合済み（review round1/2 で確認）。
- AC7: pass — `Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts` は無改修のまま通る
  （`PaneFrame.test.ts` は diff 無し）。`key-bindings.spec.ts` の既存テストはアサーション無改修
  （171行目のテスト名のみ更新）。
- AC8: pass — 新設した3件の E2E テスト（`key-bindings.spec.ts:201,215,232`）が実ブラウザで
  AC1・AC2・AC4 を検証し、実際に pass する。

## 失敗の証跡

### T1（Sidebar.vue）負の確認
`onButtonKeydown` を空実装に戻し、`Sidebar.test.ts` を実行:
```
FAIL  src/components/Sidebar.test.ts > Sidebar — ボタンの keydown：無修飾の Enter/Space
      だけ window へ渡さない（AC1・AC2・AC3・AC5） > サイドバー折りたたみ«/»
AssertionError: expected "vi.fn()" to be called 0 times, but got 2 times
 ❯ expectStopsOnlyUnmodifiedEnterSpace src/components/Sidebar.test.ts:368:33
    368|     expect(onWindowKeydown).not.toHaveBeenCalled(); // 無修飾の Enter/Space…

 Test Files  1 failed (1)
      Tests  6 failed | 69 passed (75)
```
復元後、75/75 pass を再確認（decisions.md D1）。

### T2（TabBar.vue）負の確認
同様の手順で `TabBar.test.ts` の新設テストが失敗することを確認（decisions.md D2、`Tests 1 failed | 24 passed (25)`）。

### T6（E2E）負の確認
`Sidebar.vue`「並び順」・`TabBar.vue`「＋」の両方を同時に元へ戻し、`packages/web` を明示的に
再ビルド（`npx vite build`。E2E はビルド済み `dist` を配信するためソース編集だけでは反映されない
——decisions.md D5 参照）してから3件の新設 E2E テストを実行:
```
✘  1 src/specs/key-bindings.spec.ts:201:1 › サイドバーのボタン（並び順）にフォーカスが
   残ったままでも prefix キーが実際に効く（AC1・AC8） (6.7s)
✘  2 src/specs/key-bindings.spec.ts:215:1 › サイドバーのボタン（並び順）にフォーカスが
   残ったままでも修飾付きの直接のキーが実際に効く（AC2・AC8） (6.8s)
✘  3 src/specs/key-bindings.spec.ts:232:1 › tab バーのボタン（＋）にフォーカスが残った
   ままでも prefix キーが実際に効く（AC4・AC8） (7.4s)

  1) …AC1・AC8 ──
  Error: expect(received).toBe(expected) // Object.is equality
  Expected: 2
  Received: 1

  3 failed
```
復元後、再ビルドしてから `key-bindings.spec.ts` 全体を再実行し `23 passed` を確認（decisions.md D5）。

### key-bindings.spec.ts の無関係な既存失敗（この work の回帰ではない）
```
FAIL  src/specs/key-bindings.spec.ts:841:3 › モバイル › Prefix ボタンは現在の prefix を
      注入する（alt+x に変えていれば、2 度押しで ESC x を端末へ送る）。設定の節「キー」は
      出て、画面のキーボードでは取り込めないと添える（AC1・AC11）
Error: expect(locator).toHaveText(expected) failed
Locator: locator('dialog.settings-dialog').locator('section h3')
- Expected  - 0
+ Received  + 1
  Array [
    "通知", "テーマ", "表示", "端末",
+   "エージェント連携",
    "キー",
  ]
```
原因: 設定ダイアログに「エージェント連携」節（`SettingsDialog.vue:819`）が既に存在するのに、
この期待値配列が更新されていない。この節を追加したコミット（`239c41d`）はこの work のブランチの
起点（main の `eef8b50`）に既に含まれており、この work のどのタスクも `SettingsDialog.vue` や
当該テストの期待値配列に触れていない。よってこの work が持ち込んだ回帰ではない（decisions.md D4）。
backlog へ別項目として記録済み（本 work の deliver では修正しない）。

## 起動確認（smoke）
```
$ pnpm -s build && pnpm -s smoke
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## 未検証の穴（skip / 環境不足）
- `docs/verification.md` AC6 の navigate モード中の挙動（対象ボタンにフォーカスが残ったまま
  navigate モードへ入り Enter/Space を押すとボタン自身の活性化が優先される）は、requirements.md
  「対象外」で明示的に「新しい設計判断は加えない・既知の制約として記録するだけ」と定めたため、
  この work では新規の E2E 検証を追加していない（`PaneFrame.vue`/`ContextMenu.vue` の既存の優先順位を
  そのまま踏襲した結果であるため）。
- `key-bindings.spec.ts` の既存の無関係な失敗（上記「失敗の証跡」参照）は、この work のスコープ外
  として未修正のまま残る。backlog（`.aidev/backlog/product-roadmap.md`）に新規項目は起票していない
  （設定ダイアログの期待値配列の更新漏れという小さな不具合であり、次に該当ファイルを触る work か、
  気づいた時点での自律判断で拾う）。
