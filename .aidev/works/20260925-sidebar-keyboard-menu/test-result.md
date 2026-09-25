# テスト結果: サイドバーの workspace 行のメニューをキーボードから開く

## review round1 差し戻し後の再実行（追記）

review round1 の must（`ContextMenu.vue` の `onKeydown` に `stopPropagation()` が無く、
navigate モード中にメニューを開いた状態で矢印キー・`Space` が window まで二重配送される
問題。decisions.md D4）を修正後、以下を再実行した。

- `packages/web`: `npx vue-tsc --noEmit` — 0 errors / `npx vitest run` — **1948 passed**
  （`ContextMenu.test.ts` に review 由来の再現テスト2件を追加。1946→1948）/ 0 failed
- ルート: `pnpm -s typecheck` — exit 0 / `pnpm -s test` — **2949 passed**（2947→2949）/
  0 failed
- `aidev coverage --strict` — ac=8 design=8/8(100%) tasks=8/8(100%) gaps=0（既存タスクの
  範囲内の修正のため、タスクの追加・AC の変更なし）
- 負の確認の生ログは decisions.md D4「影響」に要約・上記「失敗の証跡」に生ログを記録済み
  （regression-negative-control.md 準拠）。

## 実行したもの（review round1 差し戻し前・当初の記録）

- `packages/web`: `npx vue-tsc --noEmit` — 0 errors / `npx vitest run` — 1946 passed /
  0 failed / 0 skipped（1940→1946。内訳は下記 T7）
- ルート: `pnpm -s typecheck` — exit 0（3パッケージ横断の再確認）・`pnpm -s test` —
  2947 passed / 0 failed（protocol 68・server 800・web 1946+α。この work の変更対象は
  web パッケージのみだが、無改修で server・protocol も全て pass することを確認）
- `aidev smoke` — PASS（web・CLI 双方。下記「起動確認」参照）
- `aidev coverage --strict` — ac=8 design=8/8(100%) tasks=8/8(100%) gaps=0

## T7（回帰確認）の実施内容

- `NavigateMode.test.ts`・`navigateKeymap.test.ts`（既存部分。T2 で追加した分を除く）:
  無改修のまま全て pass。既存の `Enter`（確定）・`Escape`（取消）・矢印キー6操作の解釈は
  影響を受けていない。
- `ActionDispatcher.test.ts`（既存部分。T4 で追加した2件を除く）: 無改修のまま全て pass。
  既存の `up`/`down`/`paneDir`/`activate`/`cancel` の `case` は変更していない。
- `ContextMenu` 関連（`ContextMenu.vue` 自体は無改修。`PaneFrame.test.ts` 等の既存の
  マウス駆動・キーボード駆動のメニューテスト）: 無改修のまま全て pass。この work は
  `ContextMenu.vue` に一切触れていないため、既存のフォーカス管理・Escape・項目確定の挙動は
  そのまま。
- `KeySettings.test.ts`（既存部分）: 無改修のまま全て pass。cross-task check で発覚した
  「navigate 6操作」表記のコメント6箇所の修正はコードの振る舞いに影響しない。

## 受け入れ基準ごとの判定

- AC1: pass — `Sidebar.test.ts`「navigateMenuRequested が立つと、選択中の行の位置で
  UiPort.openContextMenu を呼び、要求を消す」で、実際に navigate モードで `space`
  相当の要求（`view.requestNavigateMenu()`）から `openContextMenu` 呼び出しまでの経路を
  確認。`ActionDispatcher.test.ts`「openMenu: 選択があれば navigateMenuRequested を立てる」
  で、キー解釈側（`navigateKeys.test.ts` の `navigate_open_menu` action 確認と合わせて）
  end-to-end の配線を確認。
- AC2: pass — `Sidebar.vue` の `watch` が `onRowContextMenu` と全く同じ target の形
  （`{kind:"workspace", workspaceId}`）で `openContextMenu` を呼ぶため、`ContextMenu.vue`
  側の分岐・項目一覧はキーボード/マウスを区別せず、内容は構造的に同じになる（`ContextMenu.vue`
  は無改修）。
- AC3: pass — T7 の回帰確認（上記）で、既存の `Enter`/`Escape`/矢印キーの解釈・
  `ActionDispatcher.navigate` の既存 `case` が全て無改修のテストで通ることを確認。
- AC-I1: pass — `Sidebar.test.ts` の3件（正常系・選択なし・DOM 見つからず）で開く経路を、
  既存の `ContextMenu.vue` の Escape・外側クリックで閉じる経路（無改修）と合わせて確認。
- AC-I2: pass — 開いたメニューは既存の `ContextMenu.vue`（無改修）がそのまま処理するため、
  確定/取消の挙動は既存のテスト（`ContextMenu` 関連。T7 で無改修のまま pass 確認）がそのまま
  裏付ける。
- AC-I3: pass — `ActionDispatcher.test.ts`（`openMenu` の action 解釈）→`Sidebar.test.ts`
  （実際にメニューを開く）という一連が、それぞれ既存のキーボード駆動テスト（`navigateKeys.
  test.ts`・`navigateKeymap.test.ts`）と組み合わさることで、`prefix+w`→矢印→`space`→
  メニュー内操作、の全経路がキー操作だけで検証できている。
- AC-I4: pass — `Sidebar.vue` は `navigateSelection` を触らず、メニューを開く前の実フォーカス
  （通常は端末）は既存の `ContextMenu.vue`「`returnFocusTo`/`restoreFocus`」（無改修）が
  自動的に処理する。この work では新しいフォーカス管理コードを書いていないため、既存の
  `ContextMenu` 関連テストがそのまま裏付ける。
- AC-I5: pass — `ActionDispatcher.navigate("openMenu")` は `view.navigateSelection` を
  読むだけで書き換えない（grep で確認済み。cross-task check でも確認済み）。T7 の回帰確認で
  既存の Enter/Escape/矢印キーの挙動が変わっていないことを確認。

## 失敗の証跡

T2 taskcheck round1: findings 0（このラウンドでは失敗無し）。
T5 taskcheck round1（should。decisions.md D3）: 新規テストが順序保証を検証できていない
指摘。負の確認の生ログ:

```
FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > navigateMenuRequested は DOM 処理（openContextMenu の呼び出し）より前に消える
AssertionError: expected true to be false // Object.is equality
 ❯ src/components/Sidebar.test.ts:198:33
```

修正後、該当テスト・`Sidebar.test.ts` 全69件とも pass を確認済み。

T4 taskcheck 用の負の確認（decisions.md D1）:

```
FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — navigate > openMenu: 選択があれば navigateMenuRequested を立てる。DOM には一切触れない（20260925-sidebar-keyboard-menu。design「設計方針」）
AssertionError: expected false to be true // Object.is equality
 ❯ src/actions/ActionDispatcher.test.ts:718:40
```

修正後、`ActionDispatcher.test.ts` 全143件とも pass を確認済み。

T6・cross-task check（should。decisions.md D2・D3）: `HelpDialog.vue`・`KeySettings.vue`
のコメントの「6操作」表記が古いままだった指摘。コードの振る舞いには影響せず、負の確認は
不要（コメントのみの修正）。

review round1 must（decisions.md D4）: `ContextMenu.vue` の `stopPropagation()` 欠落。
負の確認の生ログ（4箇所とも一時的に外した場合）:

```
FAIL  src/components/ContextMenu.test.ts > ContextMenu — キーボード（APG の Menu） > 矢印キーは window まで二重配送されない（メニューを開いたまま。PaneFrame.vue と同じ stopPropagation）
FAIL  src/components/ContextMenu.test.ts > ContextMenu — キーボード（APG の Menu） > Escape・Enter で閉じるキーも window まで二重配送されない
AssertionError: expected "spy" to not be called at all, but actually been called 2 times
 ❯ src/components/ContextMenu.test.ts:358:33

Test Files  1 failed (1)
     Tests  2 failed | 26 skipped (28)
```

修正後、該当2件・`ContextMenu.test.ts` 全28件とも pass を確認済み。

このラウンドでは他に失敗は発生していない。

## 起動確認（smoke）

```
$ aidev smoke
smoke: starting server on 127.0.0.1:39598 (state dir /tmp/wtm-smoke-FxrxDw)
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

この work は新しい起動経路（サブコマンド・オプション）を追加していないため、
`smokeCommands` への追記は不要（既存の smoke がそのまま成果物の起動を確認する）。

## 未検証の穴（skip / 環境不足）

- **実際のブラウザで prefix+w → 矢印 → space → メニュー操作を通しで操作する目視確認は
  行っていない**（このセッションの既定方針: E2E はユーザー依頼のときだけ実施。AC1〜AC3・
  AC-I1〜AC-I5 の検証は vitest/happy-dom（Vue Test Utils）でのコンポーネント・ストア
  レベルの確認に留まる——特に `getBoundingClientRect()` は jsdom/happy-dom では常に
  `{0,0,0,0}` 相当を返すため、実際のブラウザでの正確な位置計算（PaneFrame.vue と同じ
  `rect.left`/`rect.top` の使い方自体は既存 precedent と同一の書き方だが、実際に正しい
  座標でメニューが開くかの見た目の確認はできていない）。
- **実際の `space` キー押下によるメニューの開閉を、スクリーンリーダー等の支援技術と組み合わせて
  確認する検証（アクセシビリティの実地確認）は行っていない**（`ContextMenu.vue` 自体は
  無改修で、既存の ARIA 属性・フォーカス管理をそのまま流用している——新しい ARIA 属性は
  この work では追加していない）。
