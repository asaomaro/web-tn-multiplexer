# テスト結果: pane 名の legend 表示とドラッグでの入れ替え

## 実行したもの（ラウンド2。review ラウンド1の must/should 対応後の再検証）
- `pnpm -s typecheck` — exit 0
- `pnpm --filter @wtm/protocol test -- --run` — 57 passed / 0 failed（6 files）
- `pnpm --filter @wtm/server test -- --run` — 653 passed / 0 failed（52 files）
- `pnpm --filter @wtm/web test -- --run` — 1662 passed / 0 failed（83 files。うち `PaneFrame.test.ts` は 34 件。
  review 指摘対応で3件追加：名前ラベル上の右クリック・ダイアログ中のドラッグ中止・ドラッグ元 pane 自身の unmount）
- `aidev coverage --strict` — ac=12 design=12/12(100%) tasks=12/12(100%) gaps=0（review 差し戻し前と同じ。乖離なし）

## 実行したもの（ラウンド1。当初の coding 承認後）
- `pnpm -s typecheck` — exit 0（protocol/server/web 間の型不整合なし）
- `pnpm --filter @wtm/protocol test -- --run` — 57 passed / 0 failed（6 files）
- `pnpm --filter @wtm/server test -- --run` — 653 passed / 0 failed（52 files）
- `pnpm --filter @wtm/web test -- --run` — 1659 passed / 0 failed（83 files。うち `PaneFrame.test.ts` は 32 件）
- `aidev coverage --strict` — ac=12 design=12/12(100%) tasks=12/12(100%) gaps=0

## 受け入れ基準ごとの判定
- AC1〜AC3（legend 風の見た目・フォーカス中/無しの配色）: pass — `PaneFrame.test.ts` の既存の見た目テスト（「フォーカスが無ければ current 用のクラスは付かない」等）で確認。
- AC4（ドラッグ＆ドロップで pane が入れ替わる）: pass — `PaneFrame.test.ts`「閾値を超えて動かし別の pane の上で離すと swapPanesByDrag を呼ぶ」／サーバ側 `SessionModel.test.ts`/`SessionService.test.ts` の `swapPaneWith` テストで確認。
- AC5（分割比率は保持し内容だけ入れ替わる）: pass — `SessionModel.test.ts` の `swapPaneWith` テスト（`Layout.swap` を直接使う既存実装を流用）で確認。
- AC6（自分自身・pane 以外へのドロップは何もしない）: pass — `PaneFrame.test.ts`「自分自身の上・pane 以外の上で離すと何もしない」（`paneDrag` が `null` に戻ることも確認するよう強化済み。review.md 参照）。
- AC7（複数クライアントへの反映）: pass — `SessionService.test.ts` で `layout.updated` の publish を確認（購読側の `StoreAdapter.ts` は既存の仕組みをそのまま使う。cross-cutting 点検で確認済み）。
- AC-I1（閾値を超えたらドラッグ開始）: pass — 境界値テスト（ちょうど6pxで開始）を含めて確認。
- AC-I2（有効な pane で確定・範囲外/Escで取り消し）: pass — Esc テスト・範囲外ドロップテストで確認。
- AC-I3（キーボードでの既存操作が引き続き使える）: pass — 既存の `pane.swap`（方向ベース）の RPC・実装を変更していないことをコード上確認（`ActionDispatcher.ts` の既存メソッドは無変更）。
- AC-I4（ドラッグした pane にフォーカスが残る）: pass — `PaneFrame.test.ts`「入れ替え後、ドラッグした pane にフォーカスが残る」（D6）。
- AC-I5（既存の枠クリック・右クリックメニュー・端末操作を妨げない）: pass — 閾値未満はクリックにフォールバックするテスト、および cross-cutting 点検で `pointer-events: auto` の範囲が名前ラベルに限定されていることを確認。

## 失敗の証跡
ラウンド1・ラウンド2とも、このラウンドでは失敗が発生していない（review ラウンド1の指摘は review 工程側の
`review.md` に記録。差し戻し後の再実装はいずれもこの test ラウンド2で green を確認済み）。

coding 工程のタスク点検・cross-cutting 点検で見つかった指摘（review.md「タスク点検ログ」参照）はいずれもその場で修正し、修正後に green を確認している。うち2件（D6 のフォーカス委譲・D8 のダイアログでのドラッグ取り消し）は [[regression-negative-control]] に従い、該当箇所を一時的に戻して実際にテストが落ちることを確認した:

```
# D6（PaneFrame.vue:130-131 のフォーカス委譲2行を削除）
$ pnpm --filter @wtm/web test -- --run PaneFrame -t "入れ替え後、ドラッグした pane にフォーカスが残る"
AssertionError: expected 'p9' to be 'p1' // Object.is equality
Expected: "p1"
Received: "p9"
 ❯ src/components/PaneFrame.test.ts:408:47
```

```
# D8（ダイアログ検知の watch を無効化）
$ pnpm --filter @wtm/web test -- --run PaneFrame -t "ドラッグ中にダイアログが開くと"
AssertionError: expected { Object (sourcePaneId, overPaneId) } to be null
- Expected: null
+ Received: { "overPaneId": "p2", "sourcePaneId": "p1" }
 ❯ src/components/PaneFrame.test.ts:474:42
```

いずれも修正を戻した後、`git diff --stat` が復元前と一致することを確認し、全テストが green に戻ったことを確認済み。

## 起動確認（smoke）
ラウンド2（review 対応後の再ビルド）:
```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38378 (state dir /tmp/wtm-smoke-A5UFJp)
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
smoke: pass (exit 0)
```

ラウンド1:
```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:37852 (state dir /tmp/wtm-smoke-fi14JY)
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
smoke: pass (exit 0)
```

この work は新しい CLI 入口（サブコマンド・オプション）を追加していない（既存の RPC・画面操作の追加のみ）ため、`smokeCommands` への追記は不要と判断した。

## 未検証の穴（skip / 環境不足）
- ブラウザでの実機のドラッグ操作（実際のマウス/タッチでの pointerdown〜pointerup の一連の操作性、視覚的なドロップ候補ハイライトの見え方）は unit test（happy-dom・`document.elementFromPoint` のモック）と `run` スキルでの目視確認（screenshot。coding 工程で D6・D7 を発見した際に実施）で確認しており、自動テストの一式（`packages/e2e`）は対象外（[[e2e-only-on-request]]。ユーザーからの明示的な依頼が無いため）。
- モバイル（`enabled=false` の `MobileShell`）は元々この機能の対象外（design「対象範囲外」）。
