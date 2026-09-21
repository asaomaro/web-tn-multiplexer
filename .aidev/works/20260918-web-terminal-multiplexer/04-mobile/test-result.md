# テスト結果: 04-mobile（モバイル UI）

## 実行したもの
- `pnpm -s typecheck` — 全パッケージ pass
- `pnpm -s lint` — pass（0 件）
- `pnpm -s test`（vitest） — 733 passed / 0 failed（`packages/web` の単体・コンポーネントテスト全て。
  04-mobile で追加した 38 件を含む。review ラウンド 1（D87）の回帰テスト追加後の数）
- `pnpm -s build && pnpm -s smoke`（`aidev smoke`） — pass（デスクトップの経路。04-mobile はデスクトップの
  既存コードに手を入れていないことの回帰確認として実行）
- **実地の確認（disposable script。03-web-desktop の test 工程の実績にならい、正式な E2E（05 の成果物）の
  代わりに使い捨てスクリプトで一巡だけ確かめる）**: 実物のサーバ＋ビルドした Web UI を Playwright の
  `devices["iPhone 13"]`（モバイルのエミュレーション）で開き、ログイン → 1 列レイアウトの表示 →
  入力のエコー → pane ピッカーの開閉 → 追加キーの列の開閉 → Prefix ボタン＋実キーボードでの分割 →
  「この端末に合わせる」の切り替え、を一巡し、CSP 違反が出ていないことも確認する

## 受け入れ基準ごとの判定
- AC12・AC-I1・AC-I3・AC7・AC9・AC17: `aidev coverage --strict` で design/tasks の対応を確認済み
  （coding 承認時点）。実装の正しさは本ページの単体テスト・実地の確認で検証する。
- 実地の確認は**1 ラウンド目で「分割後に新しい pane へ切り替わらない」不具合を発見**し、
  `packages/web/src/components/PaneLayout.vue`（03-web-desktop の成果物）の実バグを修正した。
  修正後の再実行で全項目 pass（「ラウンド 2」参照）。

## 失敗の証跡

### ラウンド 1（disposable E2E script。修正前）

```
PASS: モバイルエミュレーションで MobileShell が表示される
PASS: CSP 違反がコンソールに出ていない
PASS: デスクトップの Sidebar は出ていない（1 列レイアウト）
PASS: 入力のエコー（キー入力 → PTY 往復）
PASS: pane ピッカーを開ける
PASS: pane ピッカーを閉じられる
PASS: 追加キーの列が開く（11 個のボタン） — count=11
FAIL: Prefix ボタン → v で分割できる（ExtraKeys の Prefix と実キーボードの組み合わせ） — 1 → 1
PASS: 「この端末に合わせる」を押すと押下状態になる

8/9 passed
```

**原因の切り分け**（CDP で WebSocket フレームを直接観測）：

```
WS SENT: {"id":"2","method":"pane.split","params":{"paneId":"p1","direction":"right"}}
WS SENT: {"id":"3","method":"client.view","params":{"workspaceId":"w1","tabId":"t1","visible":[{"paneId":"p1","cols":53,"rows":10},{"paneId":"p2","cols":43,"rows":8}]}}
```

`pane.split` は成功し、サーバは新しい pane（`p2`）を作っている（`ActionDispatcher.splitPane` が
`view.focusPane(r.pane.id)` を呼ぶので `view.focusedPaneId` は `p2` に変わる）。にもかかわらず
`client.view` の `visible` が `p1`/`p2` 両方を含んでおり、画面（`.terminal-pane` の DOM 要素数）は
`1` のまま変化しない——古い pane（`p1`）を握り続け、新しい pane（`p2`）へ実際には切り替わっていなかった。

**根本原因**：`MobileShell.vue` は `PaneLayout`（03-web-desktop T19）を `{type:'pane', paneId:
currentPaneId}` という**変化しうる**単一ノードのレイアウト木で再利用している。`PaneLayout` の単一 pane の
leaf 要素（`<div v-if="singlePaneId" ...>`）に `:key` が無かったため、`paneId` prop が変わっても Vue は
同じ DOM 要素・同じ `TerminalPane` インスタンスを再利用するだけで、`onMounted`/`onBeforeUnmount`
（＝`TerminalRegistry.acquire`/`release`）が再発火しない——デスクトップ側（各 leaf の `paneId` は
レイアウト木の構造上ずっと同じ）では起きない、モバイルの「同じスロットの `paneId` が動的に変わる」
使い方で初めて顕在化する不具合だった。単体テストの範囲（`PaneLayout.test.ts`）では「ある 1 つの
`paneId` で正しく描画されるか」しか見ておらず、この種の再マウントのシナリオを検出できなかった。

### ラウンド 2（`PaneLayout.vue` に `:key="singlePaneId"` を追加した後の再実行。2 回連続で再現性を確認）

```
PASS: モバイルエミュレーションで MobileShell が表示される
PASS: CSP 違反がコンソールに出ていない
PASS: デスクトップの Sidebar は出ていない（1 列レイアウト）
PASS: 入力のエコー（キー入力 → PTY 往復）
PASS: pane ピッカーを開ける
PASS: pane ピッカーを閉じられる
PASS: 追加キーの列が開く（11 個のボタン） — count=11
PASS: 分割してもモバイルは常に 1 pane だけ表示する — 1 → 1
PASS: 分割後、新しい pane へ実際に切り替わって入力が届く — newPaneId=p2
PASS: 「この端末に合わせる」を押すと押下状態になる

10/10 passed
```

修正内容（D86）：`packages/web/src/components/PaneLayout.vue` の単一 pane の leaf 要素に
`:key="singlePaneId"` を追加。デスクトップ側は key の値が変わらないため影響なし（`PaneLayout.test.ts`
の既存テストが回帰なく通ることを確認済み）。
disposable script 自体も、当初「分割で pane 数が増える」というデスクトップの発想のままの誤った
期待値になっていた点を修正した（モバイルは常に 1 pane だけを表示する設計——増えないのが正しい。
代わりに「新しい pane へ実際に切り替わって入力が届くか」を確かめる形にした）。

## 起動確認（smoke）

```
smoke: starting server on 127.0.0.1:45589 (state dir /tmp/wtm-smoke-zg6NGi)
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
```

04-mobile はモバイル専用の新規ファイルが中心で、`smoke.ts`（T26・03-web-desktop）自体はデスクトップの
経路のまま——新しい入口（モバイルの経路）を smoke 自体には足していない。理由：`smokeCommand` は
`pnpm -s build && pnpm -s smoke` のままで良いと判断した。モバイルの経路の実地の確認は本ページの
disposable script（上記）で行っており、05-e2e-docs の正式な E2E（モバイルのエミュレーションを含む）に
引き継ぐ。

### ラウンド 3（review ラウンド 1・D87 の修正後の再確認）

review 工程で以下 2 件を発見・修正した後、coding→test をやり直した（`ExtraKeys`/`PanePicker.vue` 自体の
disposable script による実地の再確認は不要と判断——いずれもコード読解のみで再現・修正を確定できる不具合
だったため。詳細は decisions.md D87・review.md 参照）：

1. `ExtraKeys.vue` の「Alt」を armed にしたまま「Prefix」ボタンを押すと無反応になる
   （`KeyInputController.applyPendingModifier` が Prefix の合成キーにも Alt を重ねてしまい、
   `ctrl+alt+b` になって `KeyRouter` の prefix 判定に外れる）。
2. `PanePicker.vue` が `Esc` で閉じられない（`×` ボタンのみ）。

`pnpm -s typecheck && pnpm -s lint && pnpm -s test`（733 passed）・`pnpm -s build && aidev smoke`（pass）
を再確認済み。回帰テストを `KeyInputController.test.ts`・`PanePicker.test.ts` に 1 件ずつ追加した。

## 未検証の穴（skip / 環境不足）

- **実機（iOS Safari・Android Chrome）**：Playwright のモバイルエミュレーション（Chromium ベース）でしか
  確認していない。実機での確認は 05-e2e-docs・親の統合 test の対象（AC12 の受け入れ基準どおり）。
- **タッチのネイティブ挙動**（実際の指でのスワイプ・ピンチ等）：`TouchScroll`（T2）は合成した
  `Touch`/`TouchEvent` での単体テストと、`transform: scale()` によるサイズの視覚的な正確さは実機での
  確認をしていない（`useFitToScreen.ts` の完了メモに記載のとおり）。
- **ソフトキーボードの実機での視覚確認**（`useVisualViewport.ts`）：`window.visualViewport` の
  `resize` イベントへの反応は単体テストのフェイクでのみ確認。実機のソフトキーボードでの見た目は未確認。
- **xterm.js のモバイル未解決課題**（Android Chrome＋Gboard の文字乱れ #3600、タッチ端末でのコピペ不可
  #3727）：design の対象範囲外として扱う（decisions.md D83 に記録済み）。実機での再現有無は未確認。
- disposable E2E script は使い捨てなので、このラウンド終了後に削除した（05-e2e-docs で正式な E2E に
  育てる想定）。

## ラウンド（T9／D108。2026-09-20・統合 review ラウンド1 からの差し戻し）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 1023 passed / 0 failed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — 1 回目 53 passed / 1 failed（8.2 分。下記）、2 回目 **54 passed / 0 failed**（4.8 分・exit 0）
- `mobile.spec.ts --repeat-each=3` — 15 passed（実装側）

### 失敗の証跡
1 回目の既定の E2E で、04 の変更と関係の薄い D99 の test が 1 件落ちた。新しい pane（p2）の出力が 8 秒間 1 文字も届かず（シェルのプロンプトも無い）、
全体の所要時間も普段の倍近い（8.2 分）——負荷でシェルの起動が遅れたものと判断した。同じ test を単独で 5 回流すと 5 回とも通り、全体を流し直すと 54 passed。

```
  1) src/specs/workspace-tab-pane.spec.ts:297:1 › 新しい pane を作る操作の直後に打った文字は、応答を待たずに打っても新しい pane に届く（D99。親の統合 test で追加）
    Error: timed out waiting for "echo wtm-e2e-aftersplit-1789840209436" in pane p2 output; got: ""
  1 failed
  53 passed (8.2m)
$ npx playwright test src/specs/workspace-tab-pane.spec.ts:297 --repeat-each=5
  5 passed (29.8s)
$ pnpm --filter @wtm/e2e test
  54 passed (4.8m)
```

修正を外すと落ちることの確認（実装側。抜粋）：
```
（T9 の前の web src）(a) 新しい接続で client.fit が送られず PTY はデスクトップの 83×29 のまま／(b) 申告 53×24（表示領域いっぱいは 53×41）
（ピンチの掛け戻しを外す）拡大率 1.5 で client.view を送り、PTY が 53×41 → 53×26 に縮む
```

### 受け入れ基準ごとの判定
- AC12: pass——「この端末に合わせる」で PTY が表示領域いっぱい（縦長 53×41・横長 102×19）になり、回転・ソフトキーボード・追加キーの列の
  開閉に追従して落ち着く。ピンチでは変わらない。fit していない間は PTY を変えない（D13）。
- AC8: pass——再接続の後も fit が効いたまま（以前はデスクトップの大きさのまま）。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 実機（iOS Safari・Android Chrome）での回転・ソフトキーボード・ピンチ（親の未検証の穴の AC12）。
- 残件（backlog）：fit の状態を MobileShell の中に持つ件・fit 中に別のクライアントが権限を取り返すとはみ出す件。
