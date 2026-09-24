# テスト結果: D&D による pane の別 tab・別 workspace への移動

## 実行したもの

- `packages/protocol`: `npx tsc --noEmit` — 0 errors / `npx vitest run` — 67 passed / 0 failed / 0 skipped
- `packages/server`: `npx tsc --noEmit` — 0 errors / `npx vitest run` — 767 passed / 0 failed / 0 skipped
- `packages/web`: `npx vue-tsc --noEmit -p tsconfig.typecheck.json` — 0 errors / `npx vitest run` — 1909 passed / 0 failed / 0 skipped
- ルート: `pnpm -s typecheck` — exit 0（3パッケージ横断の再確認）
- `aidev smoke` — PASS（web・CLI 双方。下記「起動確認」参照）

T1〜T9 のいずれについても、実装時に追加したテストは全て上記の一括実行に含まれる
（個別の pass 件数は各タスクの taskcheck ラウンドで既に確認済み。ここでは work 全体としての
再実行結果を記録する）。

**review round1（should 1件・nit 2件。うち1件は修正見送り）を受けた coding への差し戻し後、
再度この工程を実施した。** 差し戻しで直した2点（`ActionDispatcher.ts` の RPC 応答待ち中の
view 競合ガード・`PaneFrame.vue` の自分自身の tab へのハイライト抑制）はいずれも負の確認
（修正前のコードに戻すと新テストが実際に失敗することを確認）済み。web のテスト総数が
1906→1909（+3: 競合ガードのテスト2件・自分自身ハイライト抑制のテスト1件）に増えている。

## 受け入れ基準ごとの判定

- AC1: pass — `SessionService.test.ts`「moveToTab: 移動元 tab に他の pane が残るとき」等・
  `PaneFrame.test.ts`「tab バーの tab の上で離すと movePaneToTab を呼ぶ」で確認。
- AC2: pass — `SessionModel.test.ts`「moveToTab」の `Layout.remove` 適用確認・
  `SessionService.test.ts` の `layout.updated`（移動元）イベントで確認。
- AC3: pass — design「振る舞いの詳細」のとおり `insertAtEdge` で対象 tab の focus 中の pane の
  隣に split で加わる（`SessionModel.test.ts`）。「pane を1枚も持たない tab」は既存の不変条件
  （tab は常に最低1枚の pane を持つ）により実際には発生しないことを design で確認済み
  （`20260924-pane-move-cross-tab/design.md`「受け入れ基準との対応」AC3）。
- AC4: pass — `TabBar.test.ts`「pane D&D のドロップ先」・`PaneFrame.test.ts` の
  `overTabId` 設定確認で確認。
- AC5: pass — `SessionService.test.ts`「moveToNewTab: 別 workspace への移動」・
  `PaneFrame.test.ts`「サイドバーの workspace 行の上で離すと movePaneToNewTab を呼ぶ」で確認。
- AC6: pass — `SessionModel.test.ts`「moveToNewTab」の空になった tab の自動クローズ確認
  （`closeEmptyTabShell`）・`SessionService.test.ts` の「同一 workspace 内で、移動元 tab が
  その1枚だけの pane を失っても正しく畳まれる」で確認。
- AC7: pass — `Sidebar.test.ts`「pane D&D のドロップ先（サイドバーの workspace 行）」で確認
  （ヘッダー行とメンバー行の区別を含む。T7 taskcheck の指摘対応済み）。
- AC8: pass — `ActionDispatcher.test.ts`「movePaneToTab」「movePaneToNewTab」の
  `view.focusedPaneId`/`registry.focus` 確認。RPC が `ok:false` を返す場合・移動先 tab が
  session に未同期の場合に focus だけ動かないことも確認済み（T8 taskcheck の指摘対応）。
- AC9: pass — `SessionModel.test.ts`/`SessionService.test.ts` の自分自身の tab・存在しない
  tab/workspace へのガード確認（`events` が空・`persist.touchCount` が 0）。
- AC10: pass（イベント配布の単体テストで確認。下記「未検証の穴」参照）— `SessionService.test.ts`
  の `moveToTab`/`moveToNewTab` describe ブロックで、`pane.updated`/`layout.updated`/
  `tab.created`/`tab.closed`/`workspace.updated`/`workspace.closed` の発行順序・集合を全分岐
  （移動元 tab 生存／移動元 tab 閉鎖・workspace 生存／移動元 workspace も連鎖して閉鎖〔D18〕）で
  確認済み。`EventBus` からのイベント配布は全購読クライアントへブロードキャストされる既存の
  仕組み（この work では変更していない）。
- AC11: pass — `pane.swap_with`・`pane.move_to_edge`・`pane.replace` 関連の既存テスト
  （`SessionModel.test.ts`/`SessionService.test.ts`/`PaneFrame.test.ts` の該当 describe）は
  無改修のまま全て pass。既存のキーバインドテスト（`KeyRouter`/`ActionDispatcher` 関連）も
  無改修のまま全て pass。
- AC-I1: pass — `PaneFrame.test.ts`「閾値未満のまま離すとドラッグにならず」「ちょうど閾値
  （6px）動かすとドラッグが始まる」は無改修のまま通過。tab/workspace 種別のドロップも同じ
  pointerdown→pointermove→pointerup の骨格を通ることを新規テストで確認。
- AC-I2: pass — `PaneFrame.test.ts`「ドラッグ中に Esc を押すと取り消され」「ドラッグ中に
  ダイアログが開くと取り消され」は無改修のまま通過（tab/workspace 種別も同じ `cancelDrag` 経路
  を通る実装のため、個別の再確認は不要——design「クライアント側は新しい pointer イベント
  ハンドラを増やさない」のとおり）。
- AC-I3: pass（対象外の確認）— この work はキーボードだけの到達経路を設けていない
  （`KeyRouter`/`DEFAULT_KEYMAP` に新しいバインドを追加していないことをコード上確認）。
- AC-I4: pass — AC8 と同じ根拠。
- AC-I5: pass — `TabBar.test.ts`/`Sidebar.test.ts`の既存クリック・右クリックメニュー関連
  describe、`Sidebar.test.ts`の既存 workspace 並べ替え D&D 関連 describe は無改修のまま全て
  pass（新しい `data-tab-id`/`data-drop-workspace-id` 属性は既存の `data-workspace-row-key`
  等と衝突しないことを T7 の research.md R2 で確認済み）。

## 失敗の証跡

このラウンドでは失敗が発生していない（T1〜T9 のコーディング中の taskcheck ラウンドで見つかった
指摘は全て `review.md`「タスク点検ログ」に記録済みで、いずれもその場で修正し、
修正後の再実行で pass している。test 工程としての実行では最初から全て pass だった）。

## 起動確認（smoke）

```
$ aidev smoke
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38644 (state dir /tmp/wtm-smoke-TG6hPP)
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

- **実ブラウザでの複数タブ・複数クライアント同時接続による目視の D&D 確認は行っていない**
  （このセッションの既定方針: E2E はユーザー依頼のときだけ実施。今回はユーザーからの明示的な
  E2E 実施依頼が無かったため、vitest（happy-dom）による単体テストのみで検証した）。
  AC1・AC4・AC5・AC7・AC10（複数クライアント同期）は、ブラウザでの実際のポインタ操作・
  複数 WebSocket 接続ではなく、`document.elementFromPoint` のモックと `EventBus` の
  購読者配列という、単体テストのレベルで確認している。
- **WSL/Windows など実機・複数 OS 環境での確認も行っていない**（同上の理由。既存の
  `docs/verification.md` の手動検証チェックリストへの追加は、deliver 時に PR 本文で
  引き継ぐ）。
