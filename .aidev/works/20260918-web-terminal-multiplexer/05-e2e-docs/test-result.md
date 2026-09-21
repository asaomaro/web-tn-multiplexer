# テスト結果: 05-e2e-docs（E2E・性能計測・docs）

## 実行したもの

- `pnpm -s typecheck` — 全パッケージ pass
- `pnpm -s lint` — pass（0 件）
- `pnpm -s test`（vitest） — 752 passed / 0 failed（`packages/web`・`packages/server` の単体・
  コンポーネント・integration テスト全て。coding 中に発見した実バグの回帰テストを含む）
- `pnpm -s build && pnpm --filter @wtm/e2e test`（`packages/e2e`） — 28 spec、全て pass
  （`--workers=1` で確認。並列実行（既定の `workers` 数）では、このサンドボックス自体の資源競合
  （Chromium・サーバを複数同時起動）による間欠的なタイムアウトが起きうる——実際に T4 の時点で 1 件
  観測し、同じ spec が `--workers=1` では安定して pass することを確認した。本 subtask の T3 で切り分けた
  とおり（decisions.md D90）、`--workers=1` を判定の基準にする）
- `pnpm -s build && pnpm -s smoke`（`aidev smoke`） — pass
- `aidev coverage --strict` — **gaps=0**（`coverage-gaps: struct=0 cover=0`。全 AC が design・tasks の
  両方で被覆されている）

## 受け入れ基準ごとの判定

E2E そのものが本 work の成果物（親メタ tasks.md）。design.md「受け入れ基準との対応」（`design.md:659-721`）
に記載の各 AC を、`packages/e2e` の以下の spec で実地に確認した。

| AC | spec | 判定 |
|---|---|---|
| AC1〜AC3 | `workspace-tab-pane.spec.ts` | pass |
| AC4 | `terminal-app.spec.ts` | pass |
| AC5 | `scrollback-copy.spec.ts` | pass |
| AC6・AC7 | `agent-detection.spec.ts` | pass（2秒以内の反映を実測） |
| AC8 | `reconnect-restore.spec.ts` | pass |
| AC9 | `multi-client.spec.ts` | pass |
| AC10 | `auth-rejection.spec.ts` | pass |
| AC11 | `docs/tls-setup.md`（実地に辿って確認。下記参照） | pass（別マシンからの実接続は親の統合 test） |
| AC12 | `mobile.spec.ts` | pass |
| AC13・AC14・AC-I1〜AC-I5 | `keys-mouse-dialogs.spec.ts`＋既存 spec 群 | pass |
| AC15 | `docs/herdr-parity.md`＋`aidev coverage --strict` | pass（gaps=0 で確認） |
| AC16 | `docs/verification.md`（Linux は本 work で実施。WSL2・Windows ネイティブは手順書のみ） | pass（Linux 部分）／手順書化（他 OS は親の統合 test） |
| AC17 | `performance.spec.ts` | pass（計測の仕組みとして。数値の合否は問わない） |
| AC18 | `reconnect-restore.spec.ts` | pass |

## 実地の確認で発見した実バグ（coding 中に見つけ、その場で修正・回帰テストを追加したもの）

E2E を実際に実物のサーバ・実物の Chromium で走らせて初めて見つかった不具合（happy-dom の単体テストでは
検出できなかったもの）。詳細は decisions.md 参照。

- **D88**：`workspace.create`／`tab.create`／`tab.close` 系が、`workspace.tabIds` の変化を伝える
  WebSocket イベント（`tab.created`・`workspace.updated`）の一部を出していなかった（01-server-core 由来）。
- **D89**：`KeyInputController.handleTerminalKey` が `preventDefault()` を一度も呼んでおらず、prefix の
  2打目のキー（ほぼ全ての割り当てキー）がアクションとして処理されると同時に、素の文字としても端末へ
  入力されていた（03-web-desktop 由来）。
- **D91**：`PaneLayout.vue` の `commitView`（`client.view` を送る唯一の経路）が `onUpdated` にしか
  繋がっておらず、初回マウントでは一度も呼ばれなかった——分割等をしない「開いて使うだけ」のセッションで
  PTY が headless の既定値（120x40）のまま固定されていた（03-web-desktop 由来）。
- **D92**：`PaneLayout.vue`・`Splitter.vue`・`TabBar.vue`・`Sidebar.vue` に `<style>` が一度も無く、
  複数 pane が横／縦に並ばず縦積みになっていた（03-web-desktop 由来）。
- **D93**：copy モードの検索（`/`・`?`）が、検索語を実際に入力する経路が一度も実装されておらず完全に
  機能していなかった（03-web-desktop 由来）。
- **D94**：copy モードのカーソルが pane を acquire した時点の位置に固定され、scrollback を溜めてから
  copy モードに入っても現在位置から始まらない／検索が当たった後に選択し直すと検索前の古い位置に戻る
  （03-web-desktop 由来）。

いずれも `01-server-core`・`03-web-desktop`（既に review・deliver 済みの subtask）由来の不具合だが、
その subtask の単体テストの守備範囲（各層それぞれの中身だけを見る）では検出できず、この work の
実地の E2E で初めて表面化した——D86（04-mobile）と同じ構図。回帰テストは、不具合の由来した層
（`packages/server`・`packages/web` の単体テスト）に追加した（E2E だけに頼らない）。

## 失敗の証跡

本 work の coding 工程では、`test` 工程（本ページ）に到達する前に、各タスクの完了条件として
「実地に E2E を走らせて green にする」ことを課していたため、**この test 工程自体で新たに発見した
失敗は無い**（上記の D88・D89・D91〜D94 はいずれも coding 中に発見・修正済み。tasks.md の各タスクの
完了メモと decisions.md に、発見時の生の失敗ログを含めて記録済み）。

## 起動確認（smoke）

```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45249 (state dir /tmp/wtm-smoke-wT1hrw)
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
smoke: pass (exit 0)
```

この work は `packages/e2e` という新しい成果物（正式な E2E 一式）を追加したが、`smokeCommand`
（`pnpm -s build && pnpm -s smoke`）自体は変更していない——`smoke.ts`（01・03-web-desktop 由来）は
「ビルドした成果物が最初の使える状態まで到達するか」の最小確認として引き続き妥当で、`packages/e2e`
は起動確認ではなく受け入れ基準の網羅的な検証という別の役割を持つため、smokeCommand への追加は不要と
判断した。

## 未検証の穴（skip / 環境不足）

- **別マシンからの実接続（AC11）**：この検証環境には検証用の2台目のマシンが無いため、TLS の起動・
  証明書の生成・非ループバックホストでの拒否は実地に確認したが、**実際に別のネットワーク越しの
  ブラウザから接続する**部分は未検証——`docs/tls-setup.md`・`docs/verification.md` に手順を残し、
  親の統合 test へ引き継ぐ（design どおり）。
- **WSL2・Windows ネイティブ（AC16）**：この検証環境は Linux（WSL2 のゲスト）ではあるが、Windows 側
  （母艦）からの LAN アクセス・Windows ネイティブでの `node-pty`（ConPTY）の実際の起動は未検証。
  `docs/verification.md` に手順とチェックリストを残し、親の統合 test へ引き継ぐ。
- **実機（iOS Safari・Android Chrome。AC12）**：`mobile.spec.ts` は chromium ベースのモバイル
  エミュレーション（`devices["iPhone 13"]`）でのみ確認しており、実際の WebKit・実機のタッチ操作・
  ソフトキーボードは未検証。`docs/verification.md`「実機」に手順を残し、親の統合 test へ引き継ぐ。
  04-mobile の decisions.md D83 で記録済みの xterm.js のモバイル未解決課題（upstream #3600・#3727）も
  実機での再現有無は未検証のまま。
- **IME の変換候補窓の見た目**：Playwright は実 OS の IME を経由しないため、合成イベントを直接発火する
  形でしか自動確認できない（`terminal-app.spec.ts`）。実際の候補窓の位置・見た目は
  `docs/verification.md`「Linux」の手動確認に委ねる。
- **AC17 の絶対値**：計測の仕組み自体は検証したが、p95 等の数値そのものの合否は環境依存のため問わない
  （tasks.md のリスク参照。この検証環境での実測値は tasks.md T11 の完了メモに記録済み）。
- **copy モードの `0`・`^`・`$`・Home/End・`g`/`G`・`ctrl+b`、M7・M11**：`docs/herdr-parity.md`
  「未検証のまま見送った項目」参照。

## ラウンド 2（2026-09-19・review ラウンド 1 の差し戻し後の再確認）

review ラウンド 1 の指摘 3 件（`.gitignore` の抜け・`grantClipboard` の重複・decisions.md の D90 の欠落）を
coding で修正した後の再確認。修正は製品コードに触れていない（`.gitignore`・`packages/e2e/src/support/keys.ts`・
2 つの spec の import・decisions.md・tasks.md・`docs/verification.md` のみ）。

### 実行したもの

- `pnpm -s typecheck` — pass
- `pnpm -s lint` — pass（0 件）
- `pnpm -s test`（vitest） — 752 passed / 0 failed
- `pnpm -s build && pnpm --filter @wtm/e2e test --workers=1` — **最終的に 28 passed / 0 failed**
  （ただし下記のとおり、それまでの 3 回の実行で間欠的な失敗を観測した）
- `pnpm -s build && pnpm -s smoke`（`aidev smoke`） — pass
- `aidev coverage --strict` — gaps=0

### 失敗の証跡（ラウンド 2 で観測した間欠的な失敗）

`--workers=1`（直列）でも、3 回の実行（全 28 spec を 2 回・`terminal-app.spec.ts` のみを `--repeat-each=3` で
1 回）の全てで、**毎回違う spec が 1 件ずつ**失敗した。いずれもこのホスト全体の負荷が高い時間帯
（実行開始時の 1 分平均の load average が 12〜22／12 コア）に起きた。

1 回目（`top` の spec。ページを開いた直後に端末が現れない）：

```
  ✘  20 src/specs/terminal-app.spec.ts:41:1 › top: 別の全画面 TUI も崩れずにフルスクリーン描画・終了できる（htop はこの検証環境に無いため代替。decisions.md D90 参照） (21.8s)
    TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
    Call log:
      - waiting for locator('.xterm-helper-textarea') to be visible
    > 49 |   await page.waitForSelector(".xterm-helper-textarea", { timeout: 15_000 });
  1 failed
  27 passed (3.7m)
```

このときのページのスナップショット（error-context.md）——`client.hello` は成功して snapshot は反映済み
（workspace「1」・tab「1」が見えている）だが、その後 WebSocket が切れて「再接続中…」のまま：

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - region "spaces" [ref=e5]:
      - generic [ref=e6] [cursor=pointer]: "1"
    - region "agents" [ref=e10]
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - tab "1" [selected] [ref=e14] [cursor=pointer]
    - textbox "Terminal input" [active] [ref=e24]
  - status: 再接続中…
```

2 回目（`terminal-app.spec.ts` のみを `--repeat-each=3` で直列に再実行。今度は別の spec が同じ形で失敗）：

```
  ✘   8 src/specs/terminal-app.spec.ts:66:1 › 256 色・TrueColor・全角文字のエスケープシーケンス／バイト列が欠落なく往復する (20.4s)
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.xterm-helper-textarea') to be visible
  1 failed
  14 passed (2.0m)
```

（ページのスナップショットは 1 回目と同一の形——`status: 再接続中…`）

3 回目（全 28 spec。今度は入力の途中で切れた）：

```
  ✘  26 src/specs/workspace-tab-pane.spec.ts:122:1 › pane: 分割・境界のリサイズ・フォーカス移動・入れ替え・巡回・拡大表示・名前変更 (10.9s)
    Error: timed out waiting for "wtm-e2e-focusdir-1789783811727" in pane p1 output; got: "1;32msr024680@OSK2-024680-2\u001b[00m:\u001b[01;34m/workspaces/web-tn-multiplexer/packages/e2e\u001b[00m$ \r\u001b[K\r\u001b]0;sr024680@OSK2-024680-2: /workspaces/web-tn-multiplexer/packages/e2e\u0007\u001b[01;32msr024680@OSK2-024680-2\u001b[00m:\u001b[01;34m/workspaces/web-tn-multiplexer/packages/e2e\u001b[00m$ ho wtm-e2e-foc \rusdir-1789783811727\r\n\u001b[?2004l\rho: コマンドが見つかりません\r\n\u001b[?2004h..."
  1 failed
  27 passed (1.9m)
```

打った `echo wtm-e2e-focusdir-…` の先頭 2 文字 `ec` が PTY に届いていない（`ho: コマンドが見つかりません`）。
`net/Connection.ts` の `sendInput` は「未接続中の入力は捨てる（再接続後は打ち直しになる）」設計なので、
**ブラウザの WebSocket がタイピングの最中に一度切れ、再接続した**ことを示している（このときのページの
スナップショットも末尾が `status: 再接続中…`）。

### 切り分け（原因は未確定）

3 件は失敗した spec こそ違うが、**同じ 1 つの事象**（ブラウザの WebSocket が途中で閉じ、クライアントが
「再接続中」に入る）の現れ。以下を確かめたが、原因の特定には至らなかった：

- **サーバ側のログ**：全実行を通じて `warn`/`error` のログは 1 行も無い。
- **サーバ側から接続を閉じる経路の洗い出し**：`WsGateway`（`client.detach`→1000・不正フレーム 10 回超→1008・
  セッション失効→4401）と `composeServer.close()` のみ。サーバ側に ping/pong やアイドルのタイムアウトは無い
  （`WsServer.ts`・`WsServerWs.ts`・`WsGateway.ts`・`net/Connection.ts` を読んで確認）。4401 なら再接続ではなく
  ログイン画面になるので該当しない。
- **close コードの実測**：`WsGateway` に一時的にログ（接続・切断のコード・不正フレーム）を仕込んで全 28 spec を
  直列で実行した——この回は 28/28 pass で、切断は全てテストの後始末に由来するもの
  （1001×24＝ページを閉じた・1005×24＝生の `WtmTestClient` を閉じた・1000×1＝detach の spec）、不正フレームは
  0 件。**問題の切断が起きなかったため、コードは採取できなかった**。仕込んだログは撤去し、撤去後のビルドで
  全 28 spec が pass することを確認した。
- **CPU 負荷だけでの再現**：CPU を回し続けるプロセスを 14 個（12 コア）立てた状態で、ページを開いて端末が
  出るまでを確かめる使い捨ての spec を 15 回実行した——15/15 pass（各 6〜9 秒に遅延しただけ）。**CPU の
  取り合いだけでは再現しない**。
- **失敗した時間帯のホストの状態**：このワークスペースとは無関係な別のプロジェクトのプロセス
  （`/tmp/claude-1000/-workspaces-ts5250/…` の node プローブとヘッドレス Chrome、`-workspaces-public-docs/…` の
  VS Code のダウンロード・展開）と、並行して走っていた別の vitest が負荷を上げていた。load average が
  6〜11 まで下がった後の 3 回の実行（計装あり 1 回・なし 1 回・T2〜T11 の個別実行）では一度も再現していない。

**判断**：失敗は毎回違う spec で起き、再実行では pass し、同じ spec を負荷の低い時間帯に直列で繰り返しても
再現しない。一方で原因は特定できておらず、**「環境の資源競合による」とは断定しない**——CPU 負荷だけでは
再現しなかったため、メモリの逼迫・他プロセスとの何らかの干渉・製品側の未知の弱さ（高負荷時にだけ現れる
接続の切断）のいずれの可能性も残っている。この work の修正（ラウンド 2）は製品コードに触れておらず、
この事象の原因ではない（ラウンド 1 の実行でも同種の間欠的な失敗を T4 の時点で観測している）。
test は最終的な直列の全件実行（28/28）をもって通過とし、事象そのものは下の「未検証の穴」に残して
親の統合 test へ引き継ぐ。

### 起動確認（smoke）

```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45517 (state dir /tmp/wtm-smoke-778ZKC)
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
smoke: pass (exit 0)
```

### 未検証の穴（ラウンド 2 で追加）

- **高負荷時の WebSocket の間欠的な切断（原因未確定）**：上記の切り分けのとおり。親の統合 test では、
  再現したときに close コードを採れるよう、`WsGateway` の `conn.onClose` のコードと、ブラウザ側
  （`net/Connection.ts` の `onclose` の `ev.code`）の両方を記録する形で観測することを勧める——コードが
  1006（close フレーム無しの切断）ならトランスポート層、1005/1000 ならクライアント側の `ws.close()`
  （`client.hello` の失敗時の経路）、1008 なら不正フレームと切り分けられる。あわせて、切断中の入力を捨てる
  現在の設計（`sendInput`）は、実際に文字が欠ける形で利用者に見える（今回の `ho: コマンドが見つかりません`）
  ため、再接続までの入力をバッファする必要があるかは親の統合 review で判断してほしい。

## ラウンド（T13・T14／D104。2026-09-19・親の統合 test ラウンド4 からの差し戻し）

### 実行したもの
- `pnpm -s typecheck`（exit 0）/ `pnpm -s lint`（exit 0）/ `pnpm -s test` — 882 passed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- **既定の起動方法** `pnpm --filter @wtm/e2e test`（1 ワーカー）— 35 passed / 0 failed（exit 0。主エージェントが 2 回、実装側が 4 回）
- 直した spec（巡回・workspace・goto・mobile・terminal-app の分割）を `--repeat-each=3〜5` — すべて passed
- docs のコマンドのうちこのマシンで動くもの（AC11 の Linux の手順を一時の HOME でそのまま・`--help`・証明書なしの拒否・同じ
  state-dir の 2 つ目・`token reset` の動作中／停止後・読めない `--key`・別ホストの `wtm.lock`・SIGHUP・`setsid`・nginx の例）を実行

### 失敗の証跡
修正前（親の統合 test ラウンド4）の失敗は親の test-result.md に貼ってある（既定の起動方法で 9 failed）。このラウンドの修正後の
実行では失敗は発生していない。競合の修正の負の対照（ブラウザへのメッセージ・応答だけを遅らせた一時の spec。確認後に削除）：

```
[negative control] waitForBrowser=false shown right after the test client got layout.updated: ["p1","p2","p3"]
[negative control] waitForBrowser=false cycle marker landed in p3   → ✘ Expected "p1" Received "p3"（2 回とも）
[negative control] waitForBrowser=true  cycle marker landed in p1   → ✓（2 回とも）
（terminal-app の分割の段）waitForBrowser=false … landed in p2 → ✘（2 回とも）／waitForBrowser=true … landed in p1 → ✓（2 回とも）
```

### 受け入れ基準ごとの判定
- AC17: pass（性能計測が単独で走り、値が汚れない。1 文字の往復の p95 は並列時 146ms → 1 ワーカーで 2〜9ms）。大量出力中の
  16 pane の絶対値は親の未検証の穴（実機）。
- AC11・AC16: docs の手順が今のサーバの挙動と一致（このマシンで動く分は実行して確認）。実機での確認は親の未検証の穴。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- Windows・PowerShell・Hyper-V ファイアウォール・Tailscale・iOS／Android の CA の入れ方のコマンドや手順（このマシンでは実行できない。
  docs に未確認と公式 docs への参照を書いた）。
- copy モードで端末の中身を読む spec（`scrollback-copy.spec.ts`・`reconnect-restore.spec.ts` の AC8）は、出力の到着の後の固定の
  300ms 待ちに依存している（WebGL で描くので中身を DOM から確かめる手段が無い。1 ワーカーでは通る。D104）。

## ラウンド（T15／D109。2026-09-20・統合 review ラウンド1 からの差し戻し。docs のみ）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）。変更は `docs/` だけで、コードは 04 の T9 の test（既定の E2E 54 passed・unit 1023 passed）
  の時点から変わっていない。
- docs の手順のうちこのマシンで動くもの（AC17 のコマンド `pnpm --filter @wtm/e2e exec playwright test performance agent-detection --headed`
  で 5 passed・ロックの二重起動と取り直し・`/api/session` の Host・大文字のホスト名でのログイン・scrollback の行数と開き直し・16 pane の
  4×4 の作り方・再起動の後の画面・M7・Ctrl+B の二度押し 等）を実装側が実際に辿った。
- 節への参照が見出しに実在することを確かめた。

### 失敗の証跡
このラウンドでは失敗が発生していない（docs のみ）。

### 受け入れ基準ごとの判定
- AC11・AC12・AC16・AC17: 実機で確かめる手順がすべて揃った（チェックボックスと期待する結果つき）。判定は利用者の実機の確認で行う。

### 起動確認（smoke）
コードの変更が無いので 04 の T9 の test の smoke（pass）のまま。

### 未検証の穴
- Windows・PowerShell・iOS／Android・Tailscale の手順（このマシンでは実行できない。docs に未確認と記した）。

## ラウンド（T16。2026-09-20・親の統合 test ラウンド7 からの差し戻し）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）
- `workspace-tab-pane.spec.ts --repeat-each=3` — 18 passed
- 既定の `pnpm --filter @wtm/e2e test` — 60 passed / 0 failed（exit 0・5.3 分）

### 失敗の証跡
直す前の失敗と、決定的な再現（購読を 2 秒遅らせる一時の spec）は親の test-result.md ラウンド7 に貼ってある。直した後：
```
$ npx playwright test src/specs/zz-race.spec.ts   （直した後。確認の後に削除）
  1 passed (8.3s)
```

### 受け入れ基準ごとの判定
- AC1（と E2E 全体の安定）: pass——テスト用クライアントが購読の前に済んだ出力を見落とさない。

### 未検証の穴
- なし（E2E の支援のみの変更）。
