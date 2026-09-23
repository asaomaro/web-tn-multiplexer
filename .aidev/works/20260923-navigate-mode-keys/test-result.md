# テスト結果: navigate モードの移動キーを変えられるようにする

## 実行したもの（ラウンド1。60 review ラウンド1の差し戻し前）
- `pnpm -s typecheck`（リポジトリ全体。`vue-tsc --noEmit` を含む） — exit 0（失敗なし）
- `pnpm -s test`（リポジトリ全体。vitest） — 155 files passed / **2566 passed** / 0 failed / 0 skipped
- `pnpm --filter @wtm/web run test`（対象パッケージ単体、参考） — 85 files passed / **1728 passed**
- `aidev smoke`（`.aidev/config.yml` の `smokeCommands` 2本） — exit 0（PASS）

このラウンドの時点では、後述の review ラウンド1（要件適合・価値適合の観点）で見つかった2件の must
（`NavigateMode.ts` の修飾付き矢印の幽霊バインディング・`ctrl+shift+v` の予約漏れ）を検出できていない
——単体テストの入出力としては筋が通っていたが、**複数ファイルにまたがる整合性**（`assign.ts` が
許可する割り当てと `NavigateMode.ts`/`KeyInputController.ts` が実際に実行できるキーの整合）は
射程外だった。coding 工程（review ラウンド1）で修正し、下記「ラウンド2」で再検証した。

## 実行したもの（ラウンド2。review ラウンド1の must 修正後）
- `pnpm -s typecheck`（リポジトリ全体） — exit 0
- `pnpm -s test`（リポジトリ全体） — **すべて pass**（`packages/web` 単体で 1731 件）
- `pnpm --filter @wtm/web run lint` 相当（変更ファイルへの `eslint`） — エラー無し
- 回帰テストの負の確認（`.aidev/conventions/regression-negative-control.md`）: 追加した4件の
  回帰テスト（`NavigateMode.test.ts` 2件・`assign.test.ts` 1件・`navigateKeys.test.ts` 1件）について、
  **修正前のコードに戻してから**実行し、全件 failed になることを確認したうえで、修正後のコードへ
  戻した（`diff` でファイルが完全に一致することを確認済み）。生の出力は次のとおり：

```
$ npx vitest run src/keys/NavigateMode.test.ts src/keys/navigateKeys.test.ts src/keys/assign.test.ts
 ❯ src/keys/navigateKeys.test.ts (10 tests | 1 failed) 27ms
   ❯ NAVIGATE_RESERVED_CHORDS — 予約キー（AC2。research F7） (3)
     × esc・enter・tab・shift+tab・left・right・ctrl+shift+v・修飾無し1〜9の計16個 13ms
 ❯ src/keys/NavigateMode.test.ts (12 tests | 2 failed) 31ms
   ❯ NavigateMode — カスタム表（20260923-navigate-mode-keys。AC3） (7)
     × 修飾付きの矢印（ctrl+left 等）は「予約されていない」ので他の操作へ割り当てられ、実際に押すと表を引く（幽霊バインディングの回帰。60 review ラウンド1） 13ms
     × 修飾付き矢印に何も割り当てていなければ無反応（表に登録が無いだけで、固定 case が奪わない） 2ms
 ❯ src/keys/assign.test.ts (62 tests | 1 failed) 87ms
   ❯ validateNavigateAssignment — 予約キー（AC2） (3)
     × ctrl+shift+v も予約される（KeyInputController が router.handle より先に貼り付けとして横取りするため、割り当てても発火しない。60 review ラウンド1） 13ms

AssertionError: expected { action: { type: 'navigate', …(2) } } to deeply equal { action: { type: 'navigate', …(1) } }
- Expected
+ Received
  {
    "action": {
-     "op": "up",
+     "dir": "left",
+     "op": "paneDir",
      "type": "navigate",
    },
  }

AssertionError: expected { action: { type: 'navigate', …(2) } } to deeply equal {}
- {}
+ { "action": { "dir": "left", "op": "paneDir", "type": "navigate" } }

Error: 通ってしまった: ctrl+shift+v
 ❯ reason src/keys/assign.test.ts:44:19

AssertionError: expected 15 to be 16 // Object.is equality
- 16
+ 15

 Test Files  3 failed (3)
      Tests  4 failed | 80 passed (84)
```

修正後に戻して再実行すると、上記4件を含め該当ファイルはすべて pass。`pnpm -s test`（リポジトリ全体）
で最終確認: 155 files passed / **2569 passed** / 0 failed / 0 skipped（`packages/web` 単体で1731件）。
`pnpm -s typecheck`（リポジトリ全体） — exit 0。

## 実行したもの（ラウンド3。review ラウンド2の should 修正後）

review ラウンド2で「round1 の should 修正（`navigateModeHint`）にテストが無い」という should 指摘が
出たため、`KeySettings.test.ts` に3件のテスト（既定表示・prefix 変更への追従・`hintFor` が `null` の
ときにプレースホルダを出さない回帰）を追加した。regression-negative-control に従い、修正前の
コード（`navigateModeHint` を `hint ?? "prefix+w"` のリテラルフォールバックへ戻したもの）で
該当テストが失敗することを確認してから元に戻した：

```
$ npx vitest run src/components/KeySettings.test.ts -t "workspace_picker の割り当てを全部外すと"
 ❯ src/components/KeySettings.test.ts (89 tests | 1 failed | 88 skipped)
   ❯ KeySettings — navigate モードの移動（一覧・AC1） (4)
     × workspace_picker の割り当てを全部外すと、注記から割り当ての表記が消える（未解決のプレースホルダを出さない。60 review ラウンド2の回帰）

AssertionError: expected ' navigate モード（prefix+w）の中だけで効く、prefix…' not to contain 'prefix+w'
Expected: "prefix+w"
Received: " navigate モード（prefix+w）の中だけで効く、prefix なしの素のキーです。..."

 Tests  1 failed | 88 skipped (89)
```

修正後に戻すと（`diff` でファイルが完全一致することを確認済み）89件すべて pass。
`pnpm -s typecheck`（リポジトリ全体） — exit 0。`pnpm --filter @wtm/web run test` — 85 files
passed / **1734 passed**。`pnpm --filter @wtm/web run test`（変更ファイルの eslint） — エラー無し。

## 受け入れ基準ごとの判定
- AC1: pass — 節「キー」の新セクション（`KeySettings.vue`）で6操作それぞれの変更・追加・削除ができる。
  `KeySettings.test.ts`「navigate の割り当ての追加・変更・削除」で確認。
- AC2: pass — 予約キー（`esc`・`enter`・`tab`・`shift+tab`・`left`・`right`・修飾無し`1`〜`9`）は
  `navigateKeys.ts`/`navigateKeymap.ts`/`keyPrefs.ts`/`assign.ts`/UI のいずれの層でも登録・取り込み
  できない。`navigateKeymap.test.ts`「予約キーは登録できない」・`assign.test.ts`「validateNavigateAssignment
  — 予約キー」・`KeySettings.test.ts`「navigate の拒否」で確認。
- AC3: pass — 既定（`navigate_workspace_up`=`up`・`_down`=`down`・`navigate_pane_left`=`h`・`_down`=`j`・
  `_up`=`k`・`_right`=`l`）は現行の固定値と1:1。`NavigateMode.test.ts` の**既存5件のアサーションを
  1文字も変更せず**通したことで回帰が無いことを確認（regression のための同一入出力）。`ArrowLeft`/
  `ArrowRight` は表の割り当てに関わらず常に効くことを `NavigateMode.test.ts`「カスタム表」で確認。
- AC4: pass — 6操作間の同じキーの取り合いは理由付きで拒否される。`assign.test.ts`「衝突・置き換え」・
  `navigateKeymap.test.ts`「衝突は先に登録された側が勝つ」で確認。
- AC5: pass — 操作ごとに「既定に戻す」ができる（既定のキーを他操作が奪っていれば戻さず理由を出す）。
  `assign.test.ts`「planNavigateReset」・`KeySettings.test.ts`「navigate の既定へ戻す」で確認。
  「すべて既定に戻す」（既存の全体リセット）でも navigateKeys が一緒に戻ることも確認。
- AC6: pass — 変更は即時反映・ブラウザごとに保存され、別ウィンドウの `storage` イベントにも追従する。
  `settings.test.ts`「useSettingsStore — navigate モードの移動キー」で確認。
- AC7: pass — キー一覧（`prefix+?`）の「移動」群が現在の割り当てから動的に作られる（以前は固定文言）。
  `HelpDialog.test.ts`「現在の割り当て」「navigate モードの移動キーを変えると…」で確認。
- AC8: pass — 既存34〜35操作・prefix・resize/copy モード・`Enter`/`Escape` の挙動は変えていない。
  `NavigateMode.test.ts`（既存5件不変）・`bindings.ts`/`keymap.ts`/`ResolvedKeymap` 自体は一切変更せず
  （`git diff` で確認済み）。全体回帰（2566件）が pass。
- AC9: pass — `docs/herdr-parity.md` に H26c 行を追加し、H26 の「対象外」から navigate 移動キーを外した。

## 相互作用の受け入れ基準（AC-I1〜AC-I5）
- AC-I1〜AC-I5: pass — 既存34〜35操作の取り込み UI（`captureAttrs`/`onCaptureKeydown`/`endCapture`/
  `role="status"`）をそのまま再利用しているため、既存で満たしている性質（開く/閉じる・確定/取消・
  キーボード完結・フォーカス制御・漏らさない）がそのまま引き継がれる。`KeySettings.test.ts` の
  navigate 系テスト（追加・変更・削除・拒否・既定へ戻す・Escape での取消）で個別に確認済み。

## 失敗の証跡
このラウンドでは失敗が発生していない（差し戻しなし。coding 工程のタスク単位独立点検・cross 点検で
見つかった指摘〔`review.md` 参照〕はすべてその場で修正済みで、test 工程に入る前に解消している）。

## 起動確認（smoke）

```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38966 (state dir /tmp/wtm-smoke-BdFrBK)
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
smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-QZZpnA, sandboxed HOME /tmp/wtmctl-smoke-home-8mrsgg
smoke(cli): server listening on http://127.0.0.1:39052
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

GO：ビルド済みの成果物が最初の使える状態（ログイン→接続→pane 表示→エコー往復）まで到達している。
この work は既存の設定画面の1節に新しいセクションを足しただけで、新しい入口（サブコマンド・
エンドポイント）は追加していないため、`smokeCommands` への追加は不要と判断した（既存の smoke が
通しで確認している起動経路の一部として、navigate モード自体は `smoke(web)` の一連の流れの中で
（`workspace.create`→pane 表示）間接的に経由している。navigate モードの中の6操作そのものの UI
操作までは smoke の対象外——それは単体テスト・E2E の役割で、単体テストは全数 pass している）。

## 未検証の穴（skip / 環境不足）
- **E2E は対象外**（requirements「対象外」。`.aidev/conventions/e2e-observe-browser.md` の条項は
  あるが、このセッションではユーザーの明示依頼が無いため E2E 一式は実行していない。ブラウザの実機
  キーボードイベント〔AltGr・macOS Option 等〕は単体テストの模擬イベントでの検証に留まる——ただし
  これは既存34〜35操作の仕組みをそのまま再利用しているだけで、この work 独自の新規リスクではない）。
- 実機（Firefox・Safari・モバイル）での navigate モードの新セクションの見た目・操作感は未検証
  （既存34〜35操作の節「キー」と同じ部品を再利用しているため、既存の検証結果〔`docs/verification.md`〕
  が及ぶ範囲と判断するが、navigate セクション特有の確認は行っていない）。
