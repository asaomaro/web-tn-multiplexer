# テスト結果: 03-web-desktop（Web デスクトップ UI）

## 実行したもの
- `pnpm -s typecheck` — 全パッケージ pass
- `pnpm -s lint` — pass（0 件）
- `pnpm -s test`（vitest） — 686 passed / 0 failed（`packages/web` の単体・コンポーネントテスト全て。
  review ラウンド 1（D82）の回帰テスト追加後の数）
- `pnpm -s build && pnpm -s smoke`（`aidev smoke`） — pass（プロトコル層の往復 + Playwright の実機 Chromium での
  Web UI 起動・ログイン・入力エコーの往復。T26 で追加）
- **実地の確認（disposable script。テスト方針「実地の確認」）**: 実物のサーバ＋ビルドした Web UI を
  Playwright の実機 Chromium で開き、ログイン → 表示 → 入力のエコー → 分割 → 名前変更 → 閉じる を一巡し、
  CSP 違反がコンソールに出ていないことも確認する使い捨てスクリプトを実行

## ラウンド 3（review ラウンド 1・D82 の修正後の再確認）
review 工程で `view.restoreView` の focusedPaneId 未設定（D82）を発見・修正した後、coding→test を
やり直した。`pnpm -s typecheck && pnpm -s lint && pnpm -s test`（686 passed）・`aidev smoke`（pass）を
再確認——このラウンドでは失敗は発生していない。

## 受け入れ基準ごとの判定
- AC1〜AC18・AC-I1〜AC-I5: `aidev coverage --strict` で design/tasks の対応を確認済み（coding 承認時点）。
  実装の正しさは本ページの単体テスト・smoke・実地の確認で検証する。
- 実地の確認（分割・名前変更・閉じる・CSP）は下記「失敗の証跡」のとおり、**1 ラウンド目で「名前変更」が
  失敗**し、KeyRouter の実バグを発見した。修正後の再実行で全項目 pass（「ラウンド 2」参照）。

## 失敗の証跡

### ラウンド 1（disposable E2E script。修正前）

```
PASS: login → 接続 → 表示
PASS: CSP 違反がコンソールに出ていない
PASS: 入力のエコー（キー入力 → PTY 往復）
PASS: 分割（prefix+v）で pane が増える — 1 → 2
PASS: Splitter が描画される — count=1
DEBUG prefix indicator visible after Control+b: true
DEBUG active element: xterm-helper-textarea
DEBUG last keys: [...,{"key":"Control","code":"ControlLeft","shift":false,"ctrl":true},{"key":"b","code":"KeyB","shift":false,"ctrl":true},{"key":"Shift","code":"ShiftLeft","shift":true,"ctrl":false},{"key":"T","code":"KeyT","shift":true,"ctrl":false}]
FAIL: 名前変更ダイアログが開く（prefix+shift+t）
FAIL: tab の名前が変わる — dialog did not open

6/8 passed
```

**原因**（`packages/web/src/keys/KeyRouter.ts` の `handleInPrefix`）：prefix 中に `Shift+T` を押すと、
ブラウザは **`Shift` 単体の keydown を先に**発火させる（`{"key":"Shift","shift":true,"ctrl":false}` が
`T` の keydown より前にログに残っている——これは合成入力に限らず、実際のキーボードでも同じ順で発火する
標準的な挙動）。`comboKey({key:"Shift", ...})` は `"Shift"`（裸）になり、`DEFAULT_KEYMAP` に無いため
`handleInPrefix` の「割り当ての無いキーは prefix を抜けて consume する」分岐に入ってしまい、**`Shift` 単体で
prefix を抜けてしまう**。続く本命の `T`（`{key:"T", shift:true}` → combo `"T"` → `renameTab`）が届いた
ときには、すでに terminal モードへ戻っており、ただの文字入力として終端へ渡ってしまう。

この不具合は `prefix+<Shift付きの1文字>` の**全て**（`P`・`T`・`X`・`N`・`W`・`D`・`H`・`J`・`K`・`L`・`R`）に
影響する——ユニットテスト（happy-dom で `KeyboardEvent` を直接組み立てて渡す形）では「shift 付きの結果の
キー（`"T"` 等）だけ」を渡しており、ブラウザが実際に先に送る `Shift` 単体の keydown を再現していなかったため、
検出できなかった（design「相互作用の受け入れ基準」・AC-I3 のキーボード完結性に関わる、実地の確認でしか
見つからない種類の不具合）。

### ラウンド 2（`KeyRouter.ts` 修正後の再実行。2 回連続で再現性を確認）

```
PASS: login → 接続 → 表示
PASS: CSP 違反がコンソールに出ていない
PASS: 入力のエコー（キー入力 → PTY 往復）
PASS: 分割（prefix+v）で pane が増える — 1 → 2
PASS: Splitter が描画される — count=1
PASS: 名前変更ダイアログが開く（prefix+shift+t）
PASS: tab の名前が変わる — got "e2e-renamed-tab"
PASS: 閉じる（prefix+x）で pane が減る — 2 → 1

8/8 passed
```

**修正内容**（D81）: `packages/web/src/keys/KeyRouter.ts` の `handleInPrefix` に、修飾キー単体
（`Shift`/`Control`/`Alt`/`Meta`/`AltGraph`）の keydown を prefix モードを維持したまま無視するガードを
追加（`MODIFIER_ONLY_KEYS`）。3 秒のタイムアウトの timer には触れない（`Shift` 単体の到達で消費・延長
しない）。回帰テストを `KeyRouter.test.ts` に 2 件追加（`Shift+T` が正しく `renameTab` になること／
修飾キー単体がタイマーに影響しないこと）。`CopyMode`/`ResizeMode`/`NavigateMode` は「未対応のキーは
黙って無視する（モードを抜けない）」設計のため、同種の不具合は無いことを確認済み（コードレビュー）。

## 起動確認（smoke）

```
smoke: starting server on 127.0.0.1:44749 (state dir /tmp/wtm-smoke-m2Y7Lo)
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

`smokeCommand`（`.aidev/config.yml`）は `pnpm -s build && pnpm -s smoke` のまま。T26 で Web UI の
実地の確認を smoke 自体にも足したので、新しい入口を smoke が素通りしている懸念は無い。

## 未検証の穴（skip / 環境不足）

- **04-mobile 相当の挙動**（モバイル向けの `RendererPool`/`TerminalRegistry` の容量差・タッチ操作・
  `ExtraKeys`）は本 subtask の対象外（別 subtask）。
- **複数クライアント同時接続**（サイズ権限の実機での奪い合い・既読の他クライアントへの非共有）は、
  単体テスト（`hasSizeAuthority`・`store/seen`）では検証したが、実物の複数ブラウザでの確認はしていない
  （05-e2e-docs の対象と想定）。
- **WSL2/TLS/LAN 経由のアクセス**（design「WSL2」節）は未検証（この環境はループバックのみ）。
- **Windows ホスト（ConPTY）向けの `windowsPty` オプション**（`main.ts` の `terminalOptions` 分岐）は
  Linux 環境のため実機検証していない（コードレビューでのみ確認）。
- **`playwright install chromium` が未実行の環境**での `aidev smoke`（D80 参照）——この環境では
  実行済みだが、新しい環境では事前にこのコマンドが要る。
- disposable E2E script は使い捨てなので、このラウンド終了後に削除した（05-e2e-docs で正式な E2E に
  育てる想定。テスト方針の記載どおり）。

## ラウンド（T27・D95：切断中は入力を止める。2026-09-19）

### 実行したもの
- `pnpm -s typecheck && pnpm -s lint` — pass
- `pnpm -s test` — 758 passed / 0 failed
- `pnpm -s build && aidev smoke` — pass
- `packages/e2e` の全 spec（`--workers=1`）— 既存 28 件 pass。加えて使い捨ての実地の確認
  `debug-offline-input.spec.ts`（Playwright の `routeWebSocket` でページ側の WebSocket を横取りし、
  テストから切断・再接続の拒否・許可を操作する）

### 失敗の証跡
1 回目の実行で、使い捨ての確認スクリプト自身が失敗した（coding 中にオーバーレイの文言を
「接続が戻るまで入力できません」→「つながるまで入力できません」に変えたのに、スクリプトの期待値を
古いまま残していた。製品側の不具合ではないので coding へは差し戻さない）：

```
$ npx playwright test --workers=1
  ✘   5 src/specs/debug-offline-input.spec.ts:7:1 › 切断中は入力が止まり、オーバーレイが示し、再接続後は入力が戻る（D95） (7.3s)
Error: expect(locator).toContainText(expected) failed
Locator: locator('.reconnect-overlay')
Expected substring: "接続が戻るまで入力できません"
Received string:    "再接続中…つながるまで入力できません"
  1 failed
  28 passed (3.1m)
```

期待値を直して再実行し、pass：

```
$ npx playwright test debug-offline-input --workers=1
[D95] 切断中の入力は届かず、再接続後の入力は届いた
  ✓  1 src/specs/debug-offline-input.spec.ts:7:1 › 切断中は入力が止まり、オーバーレイが示し、再接続後は入力が戻る（D95） (5.3s)
  1 passed (7.4s)
```

### 受け入れ基準ごとの判定
- AC8（D95 の分）: pass——実物の Chromium で、(1) 切断するとオーバーレイに「再接続中…」「つながるまで
  入力できません」が出る、(2) 切断中に打った `echo <marker>` は欠けた形でも一切 PTY に届かない
  （`rawOutput` にマーカーの一部すら無い）、(3) 再接続後すぐに打った入力は届く（フォーカスも失っていない）、
  を確かめた。`open` を hello 成功後に移した影響は、既存の E2E 28 件（再接続・複数クライアント・
  ログイン拒否を含む）が全て pass することで確認した。

### 起動確認（smoke）

```
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- モバイル実機（iOS Safari・Android Chrome）で、再接続のあとソフトキーボードが閉じないこと
  （`disableStdin` をやめて `onData` で止める方式にした理由。親の統合 test の AC12 の実機確認に含める）。
- ソケットが実際には切れているのにブラウザがまだ検知していない間（TCP の半開き）の入力は、
  これまでどおり黙って失われうる（D95「残る制約」）。
- 使い捨ての確認スクリプトはこのラウンド終了後に削除した（親の統合 test で正式な E2E に育てる）。

## ラウンド（T28・D96：xterm.css の読み込み。2026-09-19）

### 実行したもの
- `pnpm typecheck` / `pnpm lint` / `pnpm -s test`（758 passed）/ `aidev smoke`（pass。新しい「描画用 canvas が
  `.xterm-screen` の中にある」確認を含む。import を外すと exit 4 で落ちることも確認済み）
- `packages/e2e` の常設の spec 全部（`--workers=1`）

### 失敗の証跡
xterm.css を読み込んだ後、`workspace-tab-pane.spec.ts` の pane の test が間欠的に落ちるようになった（3 回中 2 回）：

```
$ npx playwright test <常設の spec 全部> --workers=1
  ✘  27 src/specs/workspace-tab-pane.spec.ts:122:1 › pane: 分割・境界のリサイズ・フォーカス移動・入れ替え・巡回・拡大表示・名前変更 (14.6s)
  1 failed
  28 passed (2.1m)

$ npx playwright test workspace-tab-pane.spec.ts:122 --workers=1   # 失敗時
Error: timed out waiting for "wtm-e2e-focusdir-1789789317261" in pane p1 output; got: "…$ o wtm-e2e-focu \rsdir-1789789317261\r\n…o: コマンドが見つかりません…"
```

失敗時のページのスナップショットには「再接続中… つながるまで入力できません」が出ていたが、ブラウザ側・サーバ側の
両方で接続の開閉を記録すると、**WebSocket は test の間一度も閉じておらず**、`connectionState` も `open` のまま
だった（「再接続中」は test の後片付けでサーバを止めた後に撮られたスナップショット）。フォーカスとキーの行き先を
記録すると：

```
+2066 keydown b on DIV@-1 active=DIV@-1        ← 境界のリサイズで .splitter にフォーカスがあるまま prefix
+2105 keydown h on DIV@-1 active=DIV@-1        ← prefix+h（pane.focus_direction の RPC を送る）
+2133 keydown e on DIV@-1 active=DIV@-1        ← 端末ではない要素に届き、どの pane にも送られず捨てられる
+2137 keydown c on DIV@-1 active=DIV@-1
+2140 focusout DIV@-1 -> TEXTAREA.xta@0        ← RPC の応答で view.focusPane → p1 の term.focus()
+2143 keydown h on TEXTAREA.xta@0 ...          ← ここから p1 に届く（"ho …" になる）
```

**原因**：方向でのフォーカス移動（`h`/`j`/`k`/`l`）が `pane.focus_direction` の RPC の応答を待ってから
焦点を移すため、その往復の間に打った文字が、移動前にフォーカスのあった要素へ届く（端末以外なら捨てられ、
端末なら移動前の pane に入る）。巡回（`Tab`）はクライアントで移動先を計算して即座に焦点を移しているのに、
方向の移動だけがこうなっていた。LAN 越しで遅延が大きいと、手で速く打っても起こりうる（製品側の不具合）。
→ coding へ差し戻す（T29）。

## ラウンド（T29・D97：焦点と表示の食い違い。2026-09-19）

### 実行したもの
- `pnpm typecheck`（exit 0）/ `pnpm lint`（exit 0）/ `pnpm -s test` — 774 passed / 0 failed
- `aidev smoke` — pass（D96 の描画の確認を含む）
- `packages/e2e` の常設の spec 全部（`--workers=1`）— 29 passed / 0 failed（親の統合 test で足した D96・D97 の確認を含む）
- 使い捨ての実地の確認（`debug-close-focus.spec.ts`）：pane / tab / workspace を閉じた後の表示と焦点

### 失敗の証跡
このラウンドでは失敗が発生していない（修正前の失敗は上の「T28・D96」ラウンドの証跡を参照）。
修正前後の使い捨ての確認の出力：

```
（修正前）
pane after x  {"active":"BODY","panes":1,"tabs":1,"activeTab":"1","rows":1}
tab after X   {"active":"BODY","panes":0,"tabs":1,"activeTab":null,"rows":1}
ws after D    {"active":"BODY","panes":0,"tabs":0,"activeTab":null,"rows":1}
（修正後）
pane after x  {"active":"TEXTAREA.xta@pane","panes":1,"tabs":1,"activeTab":"1","rows":1}
tab after X   {"active":"TEXTAREA.xta@pane","panes":1,"tabs":1,"activeTab":"1","rows":1}
ws after D    {"active":"TEXTAREA.xta@pane","panes":1,"tabs":1,"activeTab":"1","rows":1}
```

`workspace-tab-pane.spec.ts` の pane の test：修正前は 3 回中 2 回失敗 → 修正後は 5 回連続 pass（常設の全体の実行でも pass）。

### 受け入れ基準ごとの判定
- AC1〜AC3・AC-I3・AC-I4（D97 の分）: pass——pane / tab / workspace を閉じた後に残りのものが表示され、クリックせずに
  そのまま入力が届く（E2E に追加）。方向での焦点移動の直後に打った文字が新しい焦点へ届く（pane の test）。

### 未検証の穴
- 分割・新しい tab・新しい workspace の直後（サーバが新しい pane を作るまで）に打った文字は、移動前の pane に入る
  （D97「残る制約」。利用者に相談する）。
- 使い捨ての確認スクリプトはこのラウンド終了後に削除した。

## ラウンド（T30・D99：新しい pane を作る操作の応答待ちの間の入力を溜める。2026-09-19・利用者の判断）

### 実行したもの
- `pnpm typecheck`（exit 0）/ `pnpm lint`（exit 0）/ `pnpm -s test` — 788 passed / 0 failed
- `aidev smoke` — pass
- `packages/e2e` の常設の spec 全部（`--workers=1`）— 35 passed / 0 failed（D99 の 2 件を含む）

### 失敗の証跡
回帰テストが修正前（関所・印なし）で落ちることの確認（ネガティブコントロール）：

```
（関所を外した場合：分割の直後に打った `echo …` の先頭が元の pane に入る）
Error: timed out waiting for "wtm-e2e-aftersplit-…" in pane p2 output; got: "…$ ftersplit-…\r\n…ftersplit-…: コマンドが見つかりません…"
（ポインタの印を外した場合：less の上で回したホイールの矢印キーが新しい pane へ流れる）
[wheel] INPUT frames after prefix+v: [["p2","\"\\u001bOA\""],["p2","\"\\u001bOA\""],["p2","\"\\u001bOA\""]]
Error: expect(received).toBe(expected)  Expected: true  Received: false
```

印をマイクロタスクで下ろしていた最初の実装も、実物の Chromium で同じく矢印キーが新しい pane へ流れた（ブラウザ自身が配る
イベントではリスナーごとにマイクロタスクが走る）。イベントの配送後のタスクで下ろす形に直した後は、矢印キーは元の pane
（p1）へ届く。

### 受け入れ基準ごとの判定
- AC1〜AC3・AC-I4（D99 の分）: pass——分割・新しい workspace の直後に応答を待たずに打った行が、新しい pane に先頭から
  丸ごと届く（E2E）。新しい tab は単体テストで確認。

### 未検証の穴
- IME の変換中の文字は溜まらない（既知の制約。D99）。
- zoom 中の分割：流し先が隠れているときは元の pane へ戻す形で行き先が分かれないようにしたが、分割しても zoom を解除しない
  こと自体は 01 で直す（D100）。

## ラウンド（T31・T32／D105。2026-09-19・親の統合 test ラウンド5 からの差し戻し）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 922 passed / 0 failed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — 42 passed / 0 failed（35 → 42。モバイルの隠れた pane の大きさ 1 件・ログインの理由 6 件を追加）
- `mobile.spec.ts`・`auth-rejection.spec.ts` を `--repeat-each=3` — すべて passed（実装側）

### 失敗の証跡
このラウンドの修正後の実行では失敗は発生していない。修正を外すと落ちることの確認（実装側。抜粋）：

```
（PaneLayout.vue を元に戻した場合の E2E）
  6) src/specs/mobile.spec.ts:72:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず…
      -   "cols": 53,
      -   "rows": 24,
      +   "cols": 1,
      +   "rows": 1,
（Connection.ts・LoginView.vue を元に戻した場合の E2E）
  2) auth-rejection.spec.ts:57:1 › サーバが許可していないアドレスで開くと、403 の理由と…
      Expected substring: "このページのアドレス（http://wtm-e2e.test:45203）"
      Received string:    "ログインできませんでした"
（retryAfter.ts を前の振る舞いに戻した場合）Received: "…Infinity 分ほど待ってから、やり直してください。"
（ログインの成功後の「接続中…」を外した場合）Locator: locator('.login-view-status')  Expected substring: "接続中…"  Error: element(s) not found
```

### 受け入れ基準ごとの判定
- AC12・AC4: pass——モバイルで表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらない（以前は 1×1 に縮んでいた）。
- AC10・AC11: pass——ログインの失敗が理由ごとに示される（403 は写せる `--origin` の行。実物のサーバで確認）。起動の途中の `/ws` の 503 では
  「接続中…」を出してつながるのを待つ。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 実機のモバイル（iOS Safari・Android Chrome）での隠れた pane の大きさ・ログイン画面の表示（親の未検証の穴の AC12）。

## ラウンド（T33／D107。2026-09-20・統合 review ラウンド1 からの差し戻し）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 1000 passed / 0 failed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — 51 passed / 0 failed（exit 0。再接続 4 件・窓とサイドバーの大きさ 1 件・`/api/session` の 403 と
  `/ws` の組み合わせ 4 件を追加）
- 変更した 3 spec を `--repeat-each=3` — 78 passed（実装側）

### 失敗の証跡
修正後の実行では失敗は発生していない。修正を外すと落ちることの確認（実装側。web の src を修正前に戻した E2E。抜粋）：

```
Error: 新しい接続で p1 の SNAPSHOT がブラウザに届く
Expected substring: "wtm-before-drop-1789831140051"
Received string:    ""
Error: 新しい接続で p1 の OUTPUT がブラウザに届く
Expected substring: "wtm-after-drop-1789831152999"
Received string:    ""
Error: 窓を狭めると PTY の列が減る
Expected: < 148
Received:   148
Locator: locator('.reconnect-overlay-panel') … Error: element(s) not found
Locator: locator('.reconnect-overlay-hint') … Error: element(s) not found
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded. waiting for locator('.xterm-helper-textarea')   （/ws は通るのに rejected で止まる）
AssertionError: expected 1000 to be 5000   （xterm.js の scrollback）
```

### 受け入れ基準ごとの判定
- AC8: pass——同じページのまま自動の再接続・503 からの再試行・「再接続」・サーバの再起動の後も、表示中の pane に SNAPSHOT と OUTPUT が
  届く（以前は画面が止まっていた）。
- AC4: pass——デスクトップで窓の大きさ・サイドバーの折りたたみを変えると PTY の大きさが追従する。scrollback はデスクトップ 5000 行。
- AC10・AC11: pass——許可外のアドレスで開いたときに、黙って繋ぎ直さず理由と `--origin` を示す。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 既知の制約（D107）：RIS で既定に戻る端末のモードのうち SNAPSHOT が戻さないもの（?25・?1006・DECSTBM・DECSCUSR 等）。再接続の後に
  動いている TUI が崩れうる（backlog）。
- モバイルの再接続の後の fit・表示領域の大きさは 04 で。

## ラウンド（T34／D110。2026-09-20・05 の T15 の作業中に発見した M6・M7）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 1066 passed / 0 failed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — 60 passed / 0 failed（exit 0・5.2 分）
- `keys-mouse-dialogs`・`mobile` を `--repeat-each=3` — 45 passed（実装側）

### 失敗の証跡
修正後の実行では失敗は発生していない。修正を外すと落ちることの確認（実装側。抜粋）：
```
（M7-1）ブラウザが送った INPUT が ["[<2;9;3M","[<2;9;3m"]（既定の宛先のままでも右クリックの報告がアプリへ届く）
（M7-2）枠の位置を右クリックしてもメニューが見つからない／tab バーから Tab した順が frame@pane1 → terminal@pane1 → …（右の pane の枠に届かない）
（M6）ただのクリックで Expected "none" / Received "opened"
（モバイル）タップで Received: "opened: http://127.0.0.1:45247/wtm-e2e-touch-link"
（点検 #3）期待 [<0;2;2M, <0;2;2m] に対し <32;2;2M と <0;2;2m が余計に届く
```

### 受け入れ基準ごとの判定
- AC14: pass——右クリック（M3・M7）とリンク（M6）が design どおり（既定の宛先では右クリックはメニューだけ・pane の枠は常にメニュー・
  リンクは Ctrl／Cmd＋クリックだけ）。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 実機での M6・M7（docs/verification.md）。残件は backlog（Ctrl＋クリックの報告の二重・モバイルの枠）。
