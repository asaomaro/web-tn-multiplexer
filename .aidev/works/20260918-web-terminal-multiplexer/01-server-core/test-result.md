# テスト結果: 01-server-core（サーバ基盤）

subtask の test（protocol-subtask.md）につき、範囲は**単独で検証可能な範囲**（unit・実物の PTY/WebSocket/HTTP を使った
プロセス内結合テスト）に限定する。ブラウザ側の描画・操作（xterm.js・キーボード/マウス・IME 等。03-web-desktop /
04-mobile の担当）や、実機の Windows ネイティブ・実際の複数ホスト間ネットワークが要る検証は、この work の
統合 test（親）または後続 subtask へ引き継ぐ（「未検証の穴」に明記）。

## 実行したもの
- `pnpm -r --filter=./packages/* run typecheck`（`tsconfig.typecheck.json`。テストファイルも含む。D39）— 2/2 passed
- `pnpm exec eslint . --ext .ts`（リポジトリルートから。D41 で `packages/*/dist/**` も正しく除外されるように修正済み）— 0 errors
- `packages/protocol`: `pnpm exec vitest run` — 11 passed / 0 failed / 0 skipped
- `packages/server`: `pnpm exec vitest run` — 209 passed / 0 failed / 0 skipped（30 ファイル。実物の node-pty・実物の
  ws・実物の HttpServer を使う統合テストを含む: `composeServer.integration.test.ts` 5件、
  `ws/WsGateway.integration.test.ts` 10件、`process/LinuxProcessInspector.*.test.ts` 等）
- `aidev smoke`（`pnpm -s build && pnpm -s smoke`）— pass

## 受け入れ基準ごとの判定
（AC の番号は requirements.md。`aidev coverage` でこの subtask に割り当てられている AC1〜5, 7〜11, 16〜18 を対象とする。
AC6, 12〜15, AC-I1〜5 はこの subtask にタスクが無い＝他 subtask の担当。AC13〜15 も同様、herdr 棚卸し・キー割当は他 work）

- AC1（workspace の作成・名前変更・切替・閉じる）: pass（サーバ側の RPC・状態遷移として）— `SessionService.test.ts`
  （`createWorkspace`・`closeWorkspace` の連鎖イベントを含む）・`SessionModel.test.ts`・`ControlSurface.test.ts`・
  `methods/index.test.ts`・`composeServer.integration.test.ts`（実際の HTTP+WS 経由での作成）で確認。
  ブラウザ UI としての操作感は 03-web-desktop の担当。
- AC2（tab の作成・名前変更・切替・閉じる）: pass（同上。`SessionService.closeTab` の連鎖イベント漏れを本ラウンドで
  発見・修正——後述「失敗の証跡」）。
- AC3（pane の分割・境界リサイズ・フォーカス移動・名前変更・閉じる）: pass（`LayoutTree.test.ts` 12件で split/remove/
  resizeBy/neighbor 等の純粋関数、`SessionService.test.ts` で RPC 層。実際の境界ドラッグ操作（マウス）は 03-web-desktop）。
- AC4（全画面 TUI・256色/TrueColor・全角文字・IME・マウス入力・resize 追従）: **partial**——サーバ側でバイト列を
  透過することの確認まで。DA1/DA2/CPR/DECRQM のパススルー、OSC 4/10/11/12 の色応答、OSC 7/9;4 の捕捉は
  `Mirror.*.test.ts` で実物の対話シェル（`stty raw -echo; cat`）を使って確認済み。resize 追従は
  `SessionService.resizePane`（T18 SizeAuthority 経由）で確認済み。**実際に vim/htop 等が画面上で崩れないか、
  IME が使えるか、マウスが端末アプリへ渡るかは xterm.js（ブラウザ側）が要るため未検証**——03-web-desktop の test で検証する。
- AC5（スクロールバック・選択コピー・クリップボード貼付、copy-mode 相当のキー操作）: **partial**——scrollback の保持・
  シリアライズ（`Mirror.serialize`）はサーバ側で確認済み（`ws/WsGateway.integration.test.ts` の新規テストで、
  再接続後の SNAPSHOT に過去の出力が含まれることも確認——後述）。**選択・コピー・貼り付け・copy-mode のキー操作は
  ブラウザ側**なので未検証（03-web-desktop）。
- AC7（サイドバーでエージェント/workspace を選ぶとフォーカス移動。workspace に集約状態表示）: **partial**——
  フォーカス移動そのもの（`pane.focus`→`session.focus_changed`）はサーバ側で確認済み。**サイドバー UI・集約表示は
  02-agent-detection（状態の算出）＋03-web-desktop（表示）**の担当。
- AC8（ブラウザ全終了後もプロセス継続、再接続で構成とスクロールバックを含む画面内容が復元）: pass——
  `ws/WsGateway.integration.test.ts` に新規テストを追加し、実物の PTY・実際に ws を閉じて再接続する手順で、
  再接続後の `pane.subscribe` の SNAPSHOT に**切断前の出力**が含まれることを確認した（本ラウンドで追加。後述）。
- AC9（2 ブラウザが同時接続でき、どちらからも表示・入力でき、セッションが壊れない）: pass——
  `ws/WsGateway.integration.test.ts` に新規テストを追加し、実物の PTY・2 本の実物 ws 接続で、**どちらの接続からの
  入力も両方の接続に OUTPUT として届く**ことを確認した（本ラウンドで追加。テスト自体の受信順の競合を発見・修正——後述）。
- AC10（未認証接続は一覧取得・閲覧・入力のいずれも不可）: pass——`composeServer.integration.test.ts`（未ログインで
  `/api/session` が 401）、`ws/WsGateway.integration.test.ts`（cookie 無し/Origin 不一致で upgrade 拒否、
  ログアウトで 4401 切断）で確認。
- AC11（別マシンから暗号化通信で AC1〜9 相当の操作）: **partial**——TLS 配線・非ループバックには cert/key 必須の強制は
  `config.test.ts`・`composeServer.integration.test.ts`（`refuses to compose for a non-loopback host without a
  certificate`）で確認済み。**実機 2 台での実際のネットワーク越しの接続は本 work の統合 test 環境では検証できない**
  （未検証の穴。実運用での確認が必要）。
- AC16（Linux/WSL2/Windows ネイティブの 3 ホストで確認）: **partial**——このリポジトリ自体が WSL2 環境で動作しており
  （`OS Version: Linux 6.6.87.2-microsoft-standard-WSL2`）、上記の全テストは実質 Linux/WSL2 上で通っている。
  `LinuxProcessInspector` は実プロセスで確認済み。**Windows ネイティブ（`WindowsProcessInspector`・
  `@vscode/windows-process-tree` 経由）は fake を使った単体テストのみで、実機での確認はできていない**
  （未検証の穴。05-e2e-docs か実機での手動確認が必要）。
- AC17（応答性 p95 50ms・pane 16 個・状態反映 2 秒以内）: **partial**——「規模」（pane 16 個を同時に保持・個別操作
  できる。サーバが人為的な上限を課していない）は本ラウンドで `SessionService.test.ts` に追加したテストで確認した
  （後述）。**p95 50ms の応答性、状態反映 2 秒以内は、ブラウザ描画を含む e2e 計測が要る**ため、サーバ単体の
  vitest では測れない（未検証の穴。05-e2e-docs で実測する）。
- AC18（サーバ再起動で workspace/tab/pane・cwd・フォーカスが復元し、各 pane が新しいシェルとして使える）: pass——
  `composeServer.integration.test.ts` の `persists and restores the session across two composeServer instances` で、
  実際に別インスタンスとして起動し直して確認済み。

## 失敗の証跡

このラウンド（test 工程開始後）で、テストを書き足す過程で 2 件見つけて直した。**どちらも見つけた場でその場で直し、
再実行して確認済み**——coding 工程への差し戻しは発生していない（1件目はサーバ側コードの欠陥だったが、
`aidev-40-coding` 手順5.5 の cross taskcheck で coding 工程の中で既に発見・修正・再承認済みのもの。
2件目はテストコード自体の競合で、サーバ側の実装に問題は無かった）。

### 1. `closeWorkspace`/`closeTab` が連鎖で消える pane/tab のイベントを出していなかった（D42。coding 工程内で解消済み）
coding 工程末尾の cross taskcheck（`aidev taskcheck start cross`）で発見。詳細は decisions.md D42。
test 工程に入る前に修正・再承認済みのため、ここでは再掲のみ（`review.md`「タスク点検ログ」に記録済み）。

### 2. AC9 の新規テストが、テスト自身の受信順の競合でタイムアウトした（テストコードの不具合。サーバ側は正常）
2 接続を同時に張るテストを最初に書いたとき、以下のとおり `Test timed out in 10000ms` で失敗した。

```
$ pnpm exec vitest run ws/WsGateway.integration.test.ts
 FAIL  src/ws/WsGateway.integration.test.ts > WsGateway (integration, real ws + real PTY) > two simultaneously connected clients can both send input and both see the same pane's output (AC9)
Error: Test timed out in 10000ms.
 ❯ src/ws/WsGateway.integration.test.ts:302:3
```

`WsGateway` 自体に一時的なデバッグ出力を足して追跡した結果、**サーバは 2 接続目（`second`）にも正しく
`conn.sendText(...)` を呼んでいた**（`bus event fired for clientId <second> workspace.created` のログが出る）。
それにもかかわらずテストの `second.ws` 側では受け取れていなかった——原因はテストの `nextMessage()` ヘルパーが
`ws.once("message", …)` を**必要になった瞬間に**登録する作りで、`first` 側のメッセージを読み進めている間に
`second` 側へ先に届いたメッセージは、リスナーが無い間に届いて破棄されていた（実物のブラウザは接続直後から
`onmessage` を貼りっぱなしにするので起きない。テストコード側だけの問題）。
**対応**: 接続直後からキューに貯め続ける `makeInbox()` ヘルパーを追加し、2 接続が同時に生きるテストではそちらを使う
よう書き直した（`WsGateway.integration.test.ts`）。書き直し後は 10/10 で安定して通る。デバッグ用に一時的に足した
`WsGateway.ts` の `console.error` は元に戻した（差分に残っていない）。

## 起動確認（smoke）

```
$ node --enable-source-maps packages/server/dist/smoke.js  （同内容を aidev smoke 経由でも確認）
smoke: starting server on 127.0.0.1:46445 (state dir /tmp/wtm-smoke-7qM6IV)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke: PASS
smoke: pass (exit 0)
```

この work は `main.ts`（`wtm serve` / `wtm token reset`）という新しい入口を今回のラウンドで追加した。
`.aidev/config.yml` の `smokeCommand: pnpm -s build && pnpm -s smoke` はその `wtm serve` の実体
（`composeServer`→`listen()`）を直接叩く `smoke.ts` を通しており、追加した入口を実際に起動確認できている
（`smokeCommands` への複数形移行は不要——追加したのは `smoke.ts` が既にカバーする経路の中身であって、
別の起動シナリオではない）。

## 未検証の穴（skip / 環境不足）

- **AC4/AC5 のブラウザ側描画・操作**（TUI の見た目・IME・マウス・選択コピー）: xterm.js のフロントエンドが無いと
  確認できない。03-web-desktop の test 工程へ引き継ぐ。
- **AC7 のサイドバー UI**: 02-agent-detection（状態算出）＋03-web-desktop（表示）の test 工程へ引き継ぐ。
- **AC11 の実機 2 台間の実ネットワーク越し接続**: この work の CI/開発環境では単一マシン内の統合テストしかできない。
  実運用（または 05-e2e-docs）での手動確認が必要。
- **AC16 の Windows ネイティブ実機確認**: `WindowsProcessInspector` は fake によるユニットテストのみ。実機での
  動作確認ができていない（開発環境が Linux/WSL2 のため）。05-e2e-docs か実機での手動確認が必要。
- **AC17 の p95 50ms 応答性・状態反映 2 秒以内**: ブラウザ描画を含む e2e 計測が必要。「規模」（pane 16 個）の
  部分のみサーバ単体で確認済み。05-e2e-docs で実測する。

## ラウンド2（review 差し戻し・D43 の修正後の再検証）

review 工程で独立レビューに委譲した結果 20件の指摘（must 7・should 10・nit 3）を受け、coding へ差し戻して
全件修正した（decisions.md D43・review.md「ラウンド1」）。修正後、以下を再実行して確認した。

### 実行したもの（再実行）
- `pnpm typecheck` — 2/2 passed
- `pnpm -r build` — 2/2 done
- `pnpm exec eslint . --ext .ts`（リポジトリルートから）— 0 errors
- `packages/protocol`: `pnpm exec vitest run` — 11 passed / 0 failed
- `packages/server`: `pnpm exec vitest run` — 214 passed / 0 failed（D43 の修正に伴い新規・更新した回帰テストを含む。
  下記「D43 修正の直接確認」参照）
- `aidev smoke` — pass

### D43 修正の直接確認（新規に足した回帰テスト）
- **グレースフルシャットダウン（must）**: `composeServer.integration.test.ts`「close() resolves promptly even
  while a browser WebSocket is still connected」を新規追加。WebSocket を繋いだまま（閉じずに）`server.close()`
  を呼び、5秒以内に解決することを確認（実測は1秒未満）。この回帰テストが無いと修正前の永久ハングを
  検知できなかった（既存の smoke.ts は自分の ws を先に閉じてから close() していたため見逃していた）。
- **`createWorkspace`/`createTab` の順序・zombie pane（must×2）**: `SessionService.test.ts`「treats an immediate
  exit code 0 as a successful spawn, then immediately closes it and auto-recreates」を更新。猶予中に code 0 で
  即終了した場合、以前は「running のまま残る」ことを確認する内容だったが、直した今は「その場で閉じられ
  D24 で作り直される」ことを確認する内容に更新した（旧テストは直すべきだった欠陥そのものを「正しい」と
  誤って固定していた）。
- **NotFoundError（must）**: 既存の `surface/methods/index.test.ts`「pane.focus on an unknown pane returns
  not_found」は変更無しで通ることを確認（手作業の個別ガードを削除しても、`ControlSurface.invoke` 側の
  一般化された処理で同じ契約が保たれることの確認になっている）。
- **クライアントへの例外メッセージ漏洩（should）**: `ControlSurface.test.ts` を更新し、クライアントへは
  汎用メッセージだけが返り、実際の例外はサーバ側ログ（`MemoryLogger`）に残ることを確認。
- **Windows tie-break（should）**: `WindowsProcessInspector.test.ts` に同着分岐の回帰テストを追加
  （fake の tree なので実機無しで確認できる）。
- **OriginPolicy の既定ポート（should）**: `OriginPolicy.test.ts` に 80/443 での確認を追加。
- **副産物のテストクリーンアップの競合**: `composeServer.integration.test.ts` の `afterEach` を
  `Promise.all`（並行）から逐次実行に変更（詳細は D43）。変更後、フルスイートを3回連続実行して
  安定して緑になることを確認済み（本セッション内で実施）。

### 受け入れ基準ごとの判定（更新）
ラウンド1の判定（上記）から結論は変わらない。D43 の修正は AC1・AC2・AC8・AC9・AC10・AC11・AC16・AC17・AC18 の
**server 側の正しさをより厳密に**したもの（既に pass 判定だった範囲の実装バグを直した）であり、
「未検証の穴」（ブラウザ側描画・実機 Windows・実ネットワーク越し・e2e 計測）は変わらず引き継ぐ。

### 起動確認（smoke・再実行）
```
$ aidev smoke
smoke: starting server on 127.0.0.1:45983 (state dir /tmp/wtm-smoke-exk82r)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke: PASS
smoke: pass (exit 0)
```

## ラウンド3（review ラウンド2の指摘・D44 の修正後の再検証）

D43 の修正を独立検証に委譲した結果、`splitPane` に `createTab` と同じ孤児化防止ガードが漏れていたこと
（should）と `ControlSurface.ts` の import 元（nit）が見つかり、両方を修正した（decisions.md D44）。

### 実行したもの（再実行）
- `pnpm typecheck` / `pnpm -r build` — clean
- `pnpm exec eslint . --ext .ts` — 0 errors
- `packages/protocol`: 11 passed
- `packages/server`: 215 passed（`SessionService.test.ts`に回帰テスト
  「disposes the orphaned PTY if the source pane is closed during the split's spawn grace window」を追加）
- `aidev smoke` — pass

### D44 修正の直接確認
分割元 pane を `splitPane` の猶予期間中（`spawnForPane` の await 中）に別の RPC（`closePane`）で閉じ、
新しく spawn 済みだった pane の PTY（フェイクの `TerminalHost`）が破棄されていることを直接確認した
（修正前はこのテストが無く、`terminals.hosts` に残り続ける孤児化が検知できなかった）。

### 受け入れ基準ごとの判定（更新）
結論は変わらない。D44 は AC1/AC3（pane 分割）の server 側の正しさをさらに厳密にしたもの。

## ラウンド（T23・D98：流量制御。2026-09-19・親の統合 test からの差し戻し）

### 実行したもの
- `pnpm typecheck`（exit 0）/ `pnpm lint`（exit 0）/ `pnpm -s test` — 776 passed / 0 failed
- `aidev smoke` — pass
- `packages/e2e` の常設の spec 全部（`--workers=1`）— 31 passed / 0 failed（親の統合 test で作り直した AC17 の計測を含む）

### 失敗の証跡
修正前の失敗は親の test-result.md「ラウンド 2」に記録（大量出力の pane の隣の pane の出力が 8〜10 秒届かない）。
回帰テストが修正前のコードで落ちることの確認（ネガティブコントロール）：

```
（onDrain を ws.on("drain") に戻した場合）
AssertionError: expected 0 to be greater than or equal to 2
      Tests  1 failed | 11 skipped (12)
（OUTPUT を圧縮する形に戻した場合）
     × 大量出力の pane があっても、同じ接続の別の pane の出力は待たされずに届く（D98） 7418ms
AssertionError: expected '' to contain 'ping-quiet'
```

修正後の AC17 の計測（このサンドボックス：ソフトウェアの WebGL・ホストの負荷あり）：

```
[AC17 規模] pane16個・うち1個大量出力中・別 pane の遅延 50 回・p95=129.8ms
[AC17 遅延・描画まで] 1 pane・200 回・p50=13ms p95=27ms max=54ms
[AC17 規模・描画まで] 16 pane 同時表示・うち 1 つで yes・別 pane の 50 回・p50=152ms p95=481ms max=860ms・描画フレームの最大間隔=133ms
  31 passed (3.0m)
```

### 受け入れ基準ごとの判定
- AC17（流量制御の分）: pass——大量出力の pane の隣の pane の出力が止まらなくなった（修正前は永久に届かなかった）。
  ただし最大速度の `yes` を流し続けたままの遅延は目標（p95 50ms）を超える。判定は実機で行う（D98・親の未検証の穴）。

### 未検証の穴
- 実機（GPU あり・負荷の少ないホスト）での AC17 の絶対値。

## ラウンド（T24・T25／D100・D101。2026-09-19・03 の T30 の独立点検と親の統合 test の残件から）

### 実行したもの
- `pnpm -s typecheck`（exit 0）/ `pnpm -s lint`（exit 0）/ `pnpm -s test` — 799 passed / 0 failed（終了コードは出力と別に確認。
  `pnpm -s` の再帰実行は失敗しても何も出力しないため——D96 の訂正）
- `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- `packages/e2e` の常設の spec 全部（`--workers=1`）— 35 passed / 0 failed
- 実物の CLI（`packages/server/dist/main.js`）：`--host [::1]` で起動し `http://[::1]:…` を表示して応答する（401）・同じアドレスと
  ポートで二重に起動すると終了コード 2 と案内・`--origin not-a-url` は終了コード 2 と案内

### 失敗の証跡
このラウンドの修正後の実行では失敗は発生していない。修正前に落ちることの確認（ネガティブコントロール）：

```
（SessionModel の分割・閉じるで zoom を解除しない形に戻した場合）
     × zoom 中に分割すると zoom を解除する（herdr の split_pane_with_runtime と同じ。D100）
     × zoom 中にどの pane を閉じても zoom を解除する（herdr の detach_pane と同じ。D100）
      Tests  2 failed | 23 passed (25)
（main.ts を旧い表示 `https://0.0.0.0:…` に戻した場合の tls-lan spec）
    Error: no token url: …
  1 failed
（OriginPolicy の小文字化を外した場合）
     × ホスト名の大文字小文字を区別しない（ブラウザは小文字で送る。Windows のホスト名は大文字が多い）
     × 起動時に表示する URL はどれも許可される
（composeServer.listen() の reject を外した場合）
     × 待ち受けに失敗したら listen() が reject する（ポートが使用中。未処理の 'error' で落ちない。D101） 5018ms
Error: listen EADDRINUSE: address already in use 127.0.0.1:45757
（config.ts の角括弧の除去・--origin の正規化を外した場合）
     × --host の角括弧付きの IPv6 は角括弧を外す（listen が名前として引いて落ちないように。D101）
     × --origin はブラウザが送る Origin と同じ形にそろえ、Origin でないものは拒む（D101）
```

参考：E2E を既定（`fullyParallel`・ワーカー数の指定なし）で流すと 11 failed / 24 passed だった（同じコードで `--workers=1` なら
35 passed）。大量出力の性能計測と他の spec が同時に走ることによる負荷で、今回の修正とは無関係——E2E の設定の問題として親の
統合 test で扱う。

```
  11 failed
  24 passed (2.8m)
```

### 受け入れ基準ごとの判定
- AC3・AC-I4（zoom 中の分割・閉じる）: pass——分割すると zoom が解除されて新しい pane が見え、焦点もそこへ移る。
- AC11（`--host 0.0.0.0` で開ける URL の表示）: pass（同一マシンの LAN の IP までは tls-lan spec で確認）。別のマシンからは実機で
  （親の未検証の穴）。

### 起動確認（smoke）

```
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- Windows のホスト名（大文字）でのアクセス・別のマシンからの接続は実機で（AC16・AC11。docs/verification.md）。

## ラウンド（T26・T27／D102。2026-09-19・review ラウンド5の差し戻し→デバッグ D1 の修正方針）

### 実行したもの
- `pnpm -s typecheck`（exit 0）/ `pnpm -s lint`（exit 0）/ `pnpm -s test` — 831 passed / 0 failed / `pnpm -s build`（exit 0）
- `aidev smoke` — pass
- `packages/e2e` の常設の spec 全部（`--workers=1`）— 35 passed / 0 failed（tls-lan はサーバが表示した LAN の URL へつないだ）
- 実物の CLI（`packages/server/dist/main.js`）：
  - 使用中のポートで初回起動 → 終了コード 2 と案内（`--state-dir` の一文を含む）。state-dir には `server.log` だけ（token を作らない）。
    ポートを空けて起動し直すと token 付きの URL が出る。
  - `--origin https://x.example:7780` がその URL を先頭に表示。docker の `br-*` は表示から除かれる。
  - portproxy を模した Host/Origin（`192.0.2.10:8443`）の `/api/login` は `--origin` 無しで 403 と `origin rejected`（間引き・切り詰め）、
    有りで 401。
  - `--shell /bin/sh` で pane のプロセスが `/bin/sh`。`--shell /nonexistent` は起動に失敗して終了コード 1、作った token を表示する。
  - `--host no-such-host.invalid`（この環境では `EAI_AGAIN`）→ 終了コード 2 と `--host` の案内。

### 失敗の証跡
このラウンドの修正後の実行では失敗は発生していない。修正を外すと落ちることの確認（ネガティブコントロール。抜粋）：

```
（composeServer.ts を変更前の起動順に戻した場合）
     × 初回の起動で待ち受けに失敗しても token を作らず、次に成功した起動で token 付きの URL を出せる（D102）
     × 保存された状態があり待ち受けに失敗したら、シェルを起動せず session.json も書き換えない（…D102）
     × 証明書のファイルを読めなければ設定の誤り（ConfigError）にし、token も作らない（D102）
     × 起動の途中（復元が終わるまで）は /ws を 503 で断り、listen() の後は受け付ける（D102）
      Tests  4 failed | 8 skipped (12)
（OriginRejectionLog の全体の上限を外した場合）
     × 組を毎回変えても、全体で 60 秒に上限の行数までしか書かず、超えた件数を次の行に載せる（独立点検の指摘）
      Tests  1 failed | 6 passed (7)
（SessionService.spawnForPane が --shell を渡さない形に戻した場合）
     × --shell を渡すと、workspace・tab・分割のどの新しい pane もそのシェルで起動する
      Tests  1 failed | 25 passed (26)
```

### 受け入れ基準ごとの判定
- AC11・AC16（到達経路）: pass（同一マシンの LAN の IP までは tls-lan spec、portproxy・別名は curl で Host/Origin を模して確認）。
  実物の WSL2 NAT＋portproxy・Windows ネイティブ・Tailscale・別のマシンからは実機で（親の未検証の穴）。
- AC16（`--shell`）: pass——design の起動オプションどおり新しい pane がそのシェルで起動する（以前は効いていなかった）。

### 起動確認（smoke）

```
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 実物の WSL2 NAT＋portproxy・WSL2 mirrored（仮想アダプタが表示に残りうる）・Windows ネイティブ（ホスト名の大文字・Hyper-V の
  スイッチ名）・Tailscale での接続（docs/verification.md の手順で実機）。

## ラウンド（T28／D103。2026-09-19・review ラウンド6の差し戻し）

### 実行したもの
- `pnpm -s typecheck`（exit 0）/ `pnpm -s lint`（exit 0）/ `pnpm -s test` — 882 passed / 0 failed / `pnpm -s build`（exit 0）
- `aidev smoke` — pass
- `packages/e2e` の常設の spec 全部（`--workers=1`）— 34 passed / 1 failed（下記。01 の変更とは無関係の spec の競合と推定。
  同じ spec を `--repeat-each=5` で 5 passed）
- 実物の CLI：同じ state-dir・別のポートの二重起動は exit 2 と案内／動作中の `wtm token reset` は exit 2、停止後は exit 0
  （以前は `token reset` 自体が `unknown option: reset` で動いていなかった）／`GET //foo`・`/\`・`//evil.example/api/session` は
  200（SPA）で error 行 0／`wtm token rest`・`wtm serve extra`・`wtm token reset --host 0.0.0.0` は exit 2、
  `wtm token --state-dir D reset` は exit 0／SIGTERM で終了コード 0 とロックが残らない

### 失敗の証跡
```
  1) src/specs/workspace-tab-pane.spec.ts:142:1 › pane: 分割・境界のリサイズ・フォーカス移動・入れ替え・巡回・拡大表示・名前変更
    Error: timed out waiting for "wtm-e2e-cycle-1789812258940" in pane p1 output; got: "…echo wtm-e2e-f \rocusdir-1789812256709\r\n…$ "
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/workspace-tab-pane.spec.ts:220:3
  1 failed
  34 passed (2.9m)
$ npx playwright test src/specs/workspace-tab-pane.spec.ts:142 --workers=1 --repeat-each=5
  5 passed (1.0m)
```
推定の原因：spec が入れ替え（`J`）の完了をテスト自身の WebSocket クライアントへの `layout.updated` で判定しており、ブラウザが
まだ古い並び順のまま `prefix+Tab` を処理すると巡回先が p3 になる（`ActionDispatcher.cyclePane` は画面の並び順どおりに動く）。
05 の spec の問題として親の test-result.md「持ち越し」に記録した。

修正を外すと落ちることの確認（T28 のテスト。抜粋）：
```
（auth.initialize() を組み立ての段へ戻す）AssertionError: expected 401 to be 204
（ロックを取らない）AssertionError: expected undefined to be an instance of ConfigError
（requestPathname を new URL(raw, base) に戻す）//: expected 'HTTP/1.1 500 Internal Server Error' to be 'HTTP/1.1 200 OK'
（cliArgs を help に戻す）Error: no ConfigError for token rest
（tls-lan：サーバに LAN の URL を出させない）Expected ["172.26.111.149","192.168.0.122"], Received []（skip ではなく失敗）
```

### 受け入れ基準ごとの判定
- AC10（認証）・AC18（復元）: pass——同じ state-dir の二重起動で session.json・auth.json を上書きし合わない。token reset が動く。
- AC11・AC16: pass（同一マシン。実機は親の未検証の穴）。

### 起動確認（smoke）
```
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 前のラウンドと同じ（実物の WSL2 NAT・mirrored・Windows ネイティブ・Tailscale）。Windows での `process.kill(pid, 0)` によるロックの
  生死判定・SIGHUP（コンソールを閉じたとき）は実機で。

## ラウンド（T29／D106。2026-09-19・統合 review ラウンド1 からの差し戻し）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 955 passed / 0 failed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — 42 passed / 0 failed（exit 0）
- 実物の CLI（実装側）：`--origin https://x.ts.net:7780` 付きのサーバで `/api/session` は Host `127.0.0.1`・`x.ts.net:7780` が 204、
  `wtm.example` が 403 と `origin rejected`（`path:"/api/session"`）、Cookie 無しは 401。`--origin` 無しで再起動すると `x.ts.net:7780` が 403

### 失敗の証跡
修正後の実行では失敗は発生していない。修正の途中で、D13 違反を前提にしていた E2E が落ちた（(a) の直接の結果。fit を押す形に直した）：

```
✘ 42 src/specs/mobile.spec.ts:72:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105）
  Error: expect(received).toBe(expected)
  Expected: "settled"
  Received: "{\"shown\":{…\"visible\":[{\"paneId\":\"p1\",\"cols\":53,\"rows\":24}]},\"server\":{\"cols\":120,\"rows\":40}}"
```

修正を外すと落ちることの確認（抜粋）：
```
（onViewChanged の資格の確認を外す）7 failed | 19 passed — AssertionError: expected '79b85206-…' to be null
（handleSession を修正前に戻す）expected 'HTTP/1.1 204 No Content' to be 'HTTP/1.1 403 Forbidden'
（onKindChanged が何もしない）AssertionError: expected '84327bed-…' to be null
（--origin のホストに host:443 を許さない）expected 'HTTP/1.1 403 Forbidden' to be 'HTTP/1.1 204 No Content'
（PaneLayout を D105 より前に戻して直した mobile の spec）"cols": 1, "rows": 1 ／ + "p1"（2 つの確認とも落ちる）
```

### 受け入れ基準ごとの判定
- AC12・D13: pass——fit していないモバイルはサイズを決めない。fit を有効にすれば（窓を狭めたデスクトップを含む）権限を取る。
- AC10・AC11: pass——有効な Cookie のまま許可外の Host で開くと `/api/session` も 403（Web の表示は 03 で）。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- 前のラウンドと同じ（実機）。
