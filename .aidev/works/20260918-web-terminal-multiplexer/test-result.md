# テスト結果: Web ターミナルマルチプレクサ（herdr 相当）— 親の統合 test

利用者の判断（2026-09-19）：**この環境で自動で確かめられる分を先に行い、実機の 3 項目（AC11 の別マシン・
AC16 の WSL2／Windows ネイティブ・AC12 の実機）は「未検証」として記録し、あとで `docs/verification.md` の
手順で利用者が確かめる**。

## ラウンド 1（2026-09-19）

### 実行したもの
- `packages/e2e` の全 spec（`--workers=1`）＋ smoke（03-web-desktop の T27 のやり直しの test 工程で実施済み）
- 親の統合 test で追加した確認（使い捨て）：
  - `debug-tls-lan.spec.ts` — 実物の CLI（`wtm serve --host 0.0.0.0 --cert --key`）を自己署名証明書で起動し、
    この マシンの LAN の IP アドレス（192.168.0.122）へ HTTPS でつなぐ。2 passed
  - `debug-real-agents.spec.ts` — 実物の Claude Code（2.1.278）・Codex（codex-cli 0.154.0）を pane の中で
    起動する。2 passed（ただし下記の画面の確認で重大な不具合を発見）
  - `debug-render.spec.ts` — 端末に文字が実際に描かれているかの切り分け

### 失敗の証跡

実物のエージェントを起動したときのスクリーンショットを見たところ、サイドバーには「Claude Code」
（blocked）・「Codex」（idle）が正しく出ているのに、**端末の領域が真っ白で、シェルのプロンプトも TUI も
何も描かれていなかった**。これまでの E2E は PTY とのバイト列の往復・DOM の要素数・`boundingBox` で
判定しており、**画面に文字が実際に描かれているかは一度も確かめていなかった**（WebGL の canvas は DOM から
読めないため）。切り分けの出力：

```
$ npx playwright test debug-render --workers=1
 "screen": { "top": 39, "left": 243, "w": 1036, "h": 675 },
 "canvases": [
  { "cls": "xterm-link-layer", "w": 1036, "h": 675, "cssW": 1036, "cssH": 675, "top": 62, "left": 243 },
  { "cls": "",                 "w": 1036, "h": 675, "cssW": 1036, "cssH": 675, "top": 739, "left": 243 },
  { "cls": "",                 "w": 32,   "h": 23,  "cssW": 0,    "cssH": 0,   "top": 0,   "left": 0 }
 ],
$ grep -rn "xterm.css\|@xterm/xterm/css" packages/web/src packages/web/index.html
（該当なし）
$ grep -l "xterm-screen" packages/web/dist/assets/*.css
no xterm-screen rule in built css
```

描画用の WebGL canvas が `top: 739`（ビューポートの高さ 720 の外）に置かれている。**`@xterm/xterm/css/xterm.css`
が Web のどこからも読み込まれていない**ため、xterm.js の canvas が絶対配置されずに通常のフローで縦に積まれ、
文字を描いた canvas が端末の下（画面外）へ押し出されていた。本来は隠れている入力用の textarea
（`xterm-helper-textarea`）も左上に小さな枠として見えていた。**実際のアプリでは端末の中身が一切見えない**。
同じページに `page.addStyleTag` で `xterm.css` を差し込むと、プロンプト・色・出力が正しく描かれることを
確認した（原因の確定）。

- 原因の subtask：`03-web-desktop`（`main.ts`・`TerminalRegistry`。xterm.js の組み込み）。must。
- 対応：03-web-desktop の coding へ差し戻す（`aidev event test sent_back` → 03 の review/test/coding を
  取り消し → coding）。回帰の防止として、`smoke.ts` と E2E に「描画用 canvas が `.xterm-screen` の中に
  あること」の確認を足す。

## ラウンド 2（2026-09-19・03 の T28／T29 の修正後）

### 実行したもの
- `aidev smoke`（pass。D96 の描画の確認を含む）・常設の E2E 29 件（pass）・`pnpm -s test`（774 passed）
- AC17 の計測を作り直した（`performance.spec.ts` に追加）：
  - 既存の「規模」の計測は `yes > /dev/null &` で、**出力が端末を通らず**「大量出力が流れる pane」になっていなかった。
    `yes &`（端末へ流す）に直した。
  - 追加：ブラウザの受信と描画まで（OUTPUT フレームの受信の直後の描画フレーム）を含む遅延の計測（1 pane・200 回）と、
    1 つの tab に 16 pane を同時に表示し、1 つで `yes` を流したまま別の pane を測る計測（50 回）。

### 失敗の証跡

```
$ npx playwright test performance.spec.ts --workers=1
[AC17 遅延] 200 回・p50=3.4ms p95=5.2ms max=15.0ms
  ✓  1 … 遅延の計測：1文字のINPUT→OUTPUTの往復を200回測り、p95を記録する（AC17）
  ✘  2 … 規模の計測：pane を16個開き、1個で大量出力を流したまま別の pane の遅延を測る（AC17） (25.1s)
    Error: timed out waiting for new OUTPUT on pane p2
[AC17 遅延・描画まで] 1 pane・200 回・p50=24ms p95=54ms max=123ms
  ✓  3 … 遅延の計測（ブラウザの描画まで）：1 pane・200 回の p95
  ✘  4 … 規模の計測（ブラウザの描画まで）：… 16 pane を同時に表示し、1 つで大量出力を流したまま別の pane を測る (41.2s)
    TimeoutError: page.waitForFunction: Timeout 10000ms exceeded.
```

1 つの pane に `yes` を流すと、**同じ接続の別の pane の出力が 8〜10 秒たっても一切届かない**（サーバだけの計測・ブラウザ込みの
計測の両方）。requirements「応答性」の「大量出力が流れる pane があっても、他の pane とブラウザの操作が固まらない」を満たさない。

**原因**（コードと `ws` の実装で確認）：
- `OutputFanout` は、クライアントの `bufferedAmount`（接続単位）が 2MB を超えると、その時に出力した pane の購読を stale にして
  送信を止める。洪水で接続のバッファが埋まると、静かな pane の小さな出力も同じ判定で stale になる。
- stale からの回復（`retryStale`）は `WsGateway` の `conn.onDrain` から呼ぶ設計だが、`WsServerWs` の `onDrain` は
  `ws` の WebSocket に `"drain"` を登録しており、**`ws`（8.21.3）の WebSocket は `drain` を emit しない**
  （`lib/websocket.js` が emit するのは `open`・`close` 等だけ）。そのため `retryStale` は一度も呼ばれず、**stale になった
  購読は永久に止まったまま**になっていた（design「流量制御」の「256KB を下回ったら新しい SNAPSHOT を送る」が動いていない）。
- 原因の subtask：`01-server-core`（`ws/WsServerWs.ts`・`terminal/OutputFanout.ts`）。must。→ 01 の coding へ差し戻す。

1 pane の描画までの遅延（p95 54ms）は目標（50ms）をわずかに超えたが、この環境はソフトウェアの WebGL（SwiftShader）で、
描画フレーム（約 16ms 間隔）の粒度も含む。絶対値の判定は実機で行う（未検証の穴に記録する）。

## ラウンド 3（2026-09-19・01 の T23／D98 の修正後。自動で確かめられる分の最終）

### 実行したもの
- `pnpm typecheck`（exit 0）/ `pnpm lint`（exit 0）/ `pnpm -s test` — 776 passed / 0 failed
- `aidev smoke` — pass（D96 の描画の確認を含む）
- `packages/e2e` の常設の spec 全部（`--workers=1`）— **33 passed / 0 failed**（統合 test で追加・修正した確認を含む：D95 の切断中の入力停止、
  D96 の描画、D97 の閉じた後の表示と焦点、AC11 の LAN の IP への TLS 接続（`tls-lan.spec.ts`）、作り直した AC17 の計測）
- 実物のエージェント（使い捨て。各自の環境・アカウントに依存するので常設にしない）：Claude Code 2.1.278・codex-cli 0.154.0 を pane の中で
  起動（このセッション自身の `CLAUDE_*` 環境変数は外した）。どちらも前面プロセスと画面から検出されてサイドバーに出た（Claude Code は
  フォルダの信頼の確認画面で blocked、Codex は更新の確認画面で blocked／起動直後の別の回は idle）。D96 の修正後、両方の TUI が崩れずに
  描かれていることをスクリーンショットで目視確認した。確認画面はどれも承認せず、Ctrl+C で終了した。

### 失敗の証跡
このラウンドでは失敗が発生していない（ラウンド 1・2 の証跡を参照）。

### AC17 の計測値（このサンドボックス：GPU の無いソフトウェアの WebGL・ホストのロードアベレージ 3〜5）

```
[AC17 遅延] 200 回・p50=1.4ms p95=3.1ms max=17.2ms                         （サーバとの往復のみ）
[AC17 遅延・描画まで] 1 pane・200 回・p50=13〜19ms p95=27〜39ms max=54〜61ms   （ブラウザの受信の直後の描画フレームまで）
[AC17 規模] 16 pane・うち 1 つで yes・別 pane の 50 回・p95=130〜218ms          （サーバのみ。大量出力の pane は購読しない）
[AC17 規模・描画まで] 16 pane 同時表示・うち 1 つで yes・p50=142〜152ms p95=481〜550ms max=796〜860ms・描画フレームの最大間隔=133〜160ms
```

### 受け入れ基準ごとの判定
- AC1〜AC3: pass——`workspace-tab-pane.spec.ts`（D88・D97 の修正を含む。閉じた後もクリックせずに操作を続けられる）
- AC4: pass（Linux）——vim・top の全画面 TUI、256 色・TrueColor・全角のバイト列、IME（合成イベント）、サイズ変更への追従。
  D96 の修正後、実物の Claude Code・Codex の TUI が描かれることを目視確認。htop は環境に無く top で代替（D90）
- AC5: pass——scrollback・copy モード（選択・検索・yank）・マウスでの選択とコピー・`Ctrl+Shift+V`（D93・D94 の修正を含む）
- AC6: pass——02 の判定ルールに当たる画面での 5 状態の遷移と 2 秒以内の反映（`agent-detection.spec.ts`）、実物の Claude Code・Codex の検出
- AC7: pass——サイドバーの行のクリックでの焦点の移動・集約
- AC8: pass——再接続で構成と scrollback が戻る。切断中は入力を止めて表示する（D95）
- AC9: pass——2 つのブラウザから同じ pane を同時に表示・入力（`multi-client.spec.ts`）
- AC10: pass——Cookie 無し・Origin 不一致・token 誤りの拒否
- AC11: **一部**——同じマシンの LAN の IP へ TLS でログイン・表示・入力できること、証明書なしで非ループバックに bind できないこと
  （`tls-lan.spec.ts`）。**別のマシンからの接続は未検証**（利用者が実機で確かめる）
- AC12: **一部**——モバイルのエミュレーション（Chromium）での一巡（`mobile.spec.ts`）。**実機は未検証**
- AC13・AC14・AC-I1〜AC-I5: pass——`keys-mouse-dialogs.spec.ts` ほか（D89・D97 の修正を含む）
- AC15: pass——`docs/herdr-parity.md`（05 の review で research・design と突き合わせ済み）
- AC16: **一部**——Linux（WSL2 のカーネル上のコンテナ）のみ。**WSL2 を Windows のブラウザから使う構成・Windows ネイティブは未検証**
- AC17: **一部**——大量出力が無い状態は目標内（描画まで p95 27〜39ms）。大量出力の隣の pane は止まらなくなった（D98）が、
  最大速度の `yes` を流し続けたままの遅延は目標（p95 50ms）を超える（上の計測値）。**実機での判断に回す**
- AC18: pass——サーバを止めて再び起動しても構成と各 pane の cwd が戻る

### 各 subtask の「未検証の穴」の照合
- 01：AC4／AC5 のブラウザ側・AC7 のサイドバー → 03・05 の E2E で閉じた。AC11 の実ネットワーク・AC16 の Windows・AC17 → 下の一覧へ
- 02：AC17 のブラウザ視点 → 統合 test で計測（上）。AC16 の Windows・claude／codex 以外の約 20 エージェントの実物 → 下の一覧へ
- 03：複数クライアント → `multi-client.spec.ts` で閉じた。TLS／LAN → 同じマシンの分は `tls-lan.spec.ts` で閉じた。Windows の ConPTY → 下の一覧へ
- 04：実機・タッチ・ソフトキーボード・xterm.js のモバイルの既知の課題 → 下の一覧へ
- 05：下の一覧に引き継ぐ

### 未検証の穴（利用者が実機で確かめる。`docs/verification.md` の手順）
- AC11：別のマシンのブラウザから TLS で接続して AC1〜AC9 の操作
- AC16：WSL2 を Windows のブラウザから使う構成・Windows ネイティブ（ConPTY）での AC1〜AC14・AC18
- AC12：実機の iPhone（Safari・WebKit）・Android（Chrome）。タッチでのスクロール・ソフトキーボード（再接続の後に閉じないか。D95）・
  xterm.js のモバイルの既知の課題（#3600・#3727）
- AC17：GPU があり負荷の少ない実機での計測（とくに大量出力中の 16 pane）
- IME の変換候補窓の見た目・マウス報告（M7・M11）・copy モードの一部の移動キー・claude／codex 以外のエージェントの実物の画面

## 持ち越し（2026-09-19・次の統合 test／統合 review で原因の subtask へ戻すもの）

01 の D100〜D103（zoom の解除・起動時の URL・到達経路・起動順・`--shell`・state-dir のロック等）の作業中に見つかった、
**01 以外が持ち主**のもの。01 の review ラウンド5・6（`01-server-core/review.md`）が出どころ。

- **05（E2E の設定）**: `packages/e2e/playwright.config.ts` は `fullyParallel: true` でワーカー数を指定していないので、既定の起動方法
  （12 CPU で 6 ワーカー）だと大量出力の性能計測が他の spec と同時に走り、**毎回 11 件落ちる**（同じコードで `--workers=1` なら
  35 passed）。05 の記録は「並列時の間欠的な失敗はサンドボックスの資源競合」として `--workers=1` で確認していたが、その後に
  親の統合 test で性能計測の spec を足したため、間欠ではなく常に落ちる状態になった。
- **05（docs）**: ファイアウォールの手順が構成ごとにそろっていない（WSL2 mirrored は Hyper-V ファイアウォールの規則・Windows
  ネイティブ・Linux の記述が無い）／`sudo tailscale cert` の鍵が root 所有で一般ユーザーの `wtm serve` が読めない／
  `docs/verification.md` の別のマシンからの TLS の確認（AC11）が WSL2 にしか無い（Windows ネイティブ・Linux の手順が無い）／
  リバースプロキシの注意（`/ws` の Upgrade の転送・ルートのパス・ログイン失敗の制限を全員で共有）／`wtm` が PATH に無いのに
  docs は `wtm serve` と書いている。01 の T28（D103）に合わせて：手元用と LAN 用を並行して動かすなら `--state-dir` を分ける
  （同じ state-dir の 2 つ目は `wtm.lock` で止まる）・`wtm token reset` は serve を止めてから行う（動作中は断る。以前は
  `token reset` 自体が動いていなかった）・起動時の表示（`listening on … port … (https)`・開ける URL が無いときの token の行）・端末を閉じる（SIGHUP）と
  wtm も終わる（`nohup` でも。動かし続けるなら `setsid`・tmux・systemd 等）・別のホストや作り直したコンテナの `wtm.lock` は
  手で消す。
- **05（E2E の spec の競合。推定）**: `workspace-tab-pane.spec.ts:142` の巡回の段（:216-220）が 1 回だけ落ちた（01 の T28 の
  test。同じ spec を `--repeat-each=5` で流すと 5 回とも通る）。入れ替え（`J`）の完了を**テスト自身の WebSocket クライアント**に
  `layout.updated` が届いたことで判定しているため、ブラウザがまだ古い並び順のまま `prefix+Tab` を処理すると巡回先が p1 ではなく
  p3 になり、打った文字が p3 に入る（巡回は D97 で手元で先に焦点を移す形なので、製品のほうは画面に出ている並び順どおりに動く）。
  ブラウザ側に入れ替えが反映されたこと（DOM の pane の並び等）を待ってから巡回するよう直す。
- **03（Web）**: モバイルで表示する pane を切り替える（分割等）と、**隠れた pane の PTY が 1×1 に縮められる**（05 の T13 の作業中に
  発見。実測 53×24 → 1×1）。`packages/web/src/components/PaneLayout.vue:77` の単一 pane の葉の `:ref="(el) => setLeafEl(singlePaneId!, el)"`
  が、外すとき（`el` が null）にもその時点の `singlePaneId`（既に新しい pane）を読むので、古い pane の登録（`ownLeaves`）が残り、
  切り離された要素の大きさ 0 から `cols:1, rows:1` が `client.view` に載り続ける。サイズ権限を持つブラウザなのでサーバが実際に
  縮める（隠れた TUI・エージェントの画面が 1 桁に折り返す）。デスクトップでは別の tab の pane なのでサーバは使わず実害なし。
  D86 の `:key` の修正では直っていなかった。
- **03（Web）**: ログイン画面が 403（Origin の不一致）を token の誤り（401）と同じ「ログインできませんでした」で表示する
  （`packages/web/src/components/LoginView.vue:67`・`net/Connection.ts` の `login` が 204 以外を全て false にする）。利用者は
  token が違うと思い込み `wtm token reset` へ進んでしまう。`/ws` の 503（起動の途中）も考慮する。

## ラウンド 4（2026-09-19・01 の T24〜T28／D100〜D103 の後。統合 test のやり直し）

### 実行したもの
- `pnpm -s typecheck`（exit 0）/ `pnpm -s lint`（exit 0）/ `pnpm -s test` — 882 passed / 0 failed / `pnpm -s build`（exit 0）
- `aidev smoke` — pass
- **既定の起動方法**の E2E：`pnpm --filter @wtm/e2e test`（`playwright test`。ワーカー数の指定なし）— **9 failed / 26 passed**（exit 1）
- 参考：同じコードで `--workers=1` なら 35 passed（01 の T28 の test。巡回の段の 1 回の失敗を除く——下の「持ち越し」）

### 失敗の証跡

```
$ pnpm --filter @wtm/e2e test
Running 35 tests using 6 workers
  1) src/specs/agent-detection.spec.ts:24:1 › エージェントの検出：idle→blocked の状態遷移がサイドバーへ2秒以内に反映され、行のクリックで focus する（AC6・AC7）
  2) src/specs/multi-client.spec.ts:40:1 › 2つのブラウザが同じ pane を同時に見て、どちらからも入力できる（AC9）
  3) src/specs/performance.spec.ts:57:1 › 規模の計測：pane を16個開き、1個で大量出力を流したまま別の pane の遅延を測る（AC17）
  4) src/specs/performance.spec.ts:149:1 › 遅延の計測（ブラウザの描画まで）：1 pane・200 回の p95（AC17。親の統合 test で追加）
  5) src/specs/scrollback-copy.spec.ts:47:1 › copy モードの検索（?）で該当行へジャンプし、yank で正しい行を拾える（D93 で修復）
  6) src/specs/terminal-app.spec.ts:14:1 › vim: 全画面 TUI が alternate screen へ入り、編集・保存・終了できる（崩れの無いことの確認）
  7) src/specs/terminal-app.spec.ts:41:1 › top: 別の全画面 TUI も崩れずにフルスクリーン描画・終了できる（…）
  8) src/specs/workspace-tab-pane.spec.ts:142:1 › pane: 分割・境界のリサイズ・フォーカス移動・入れ替え・巡回・拡大表示・名前変更
  9) src/specs/workspace-tab-pane.spec.ts:282:1 › 新しい pane を作る操作の直後に打った文字は、応答を待たずに打っても新しい pane に届く（D99。…）
    Error: timed out waiting for event "pane.agent_status_changed"
    Test timeout of 30000ms exceeded.
    Error: page.waitForFunction: Test timeout of 30000ms exceeded.
    Error: expect(locator).toHaveCount(expected) failed
    Error: timed out waiting for "echo wtm-e2e-afternewws-1789813370554" in pane p3 output; got: ""
  9 failed
  26 passed (2.5m)
```

原因：`packages/e2e/playwright.config.ts` が `fullyParallel: true` でワーカー数を指定していないため、このマシン（12 CPU）では
6 ワーカーで走り、大量出力（`yes`）を流す性能計測の spec が他の spec と同時に動く。性能計測の値もこれで汚れる。
→ **05-e2e-docs の coding へ差し戻す**。あわせて、下の「持ち越し」の 05 の項目（spec の競合・docs）も同じ差し戻しで直す。
03 の項目（ログイン画面の 403 の文言）は、05 の後に 03 へ差し戻す。

## ラウンド 5（2026-09-19・05 の T13／T14（D104）の後）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 882 passed / `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- **既定の起動方法** `pnpm --filter @wtm/e2e test` — **35 passed / 0 failed**（exit 0。ラウンド4 の 9 failed は解消）

```
$ pnpm --filter @wtm/e2e test
Running 35 tests using 1 worker
[AC17 遅延] 200 回・p50=1.3ms p95=2.2ms max=13.6ms
[AC17 規模] pane16個・うち1個大量出力中・別 pane の遅延 50 回・p95=131.8ms
[AC17 遅延・描画まで] 1 pane・200 回・p50=14ms p95=24ms max=34ms
[AC17 規模・描画まで] 16 pane 同時表示・うち 1 つで yes・別 pane の 50 回・p50=122ms p95=313ms max=418ms・描画フレームの最大間隔=84ms
  35 passed (3.0m)
```

### 失敗の証跡（03 へ差し戻すもの）
「持ち越し」の 03 の 2 件が未解決。E2E はどちらも捉えていない（モバイルの spec は隠れた pane の PTY の大きさを見ていない・
ログインの spec は 403 の文言を見ていない）ので、03 の修正で回帰テストを足す。1 件目の原因箇所（05 の T13 の作業中に、分割の後の
`client.view` に隠れた p1 が `cols:1, rows:1` で載り、サーバが p1 の PTY を 53×24 → 1×1 に縮めることを実測）：

```
packages/web/src/components/PaneLayout.vue:77
  <div v-if="singlePaneId" :key="singlePaneId" class="pane-layout-leaf" … :ref="(el) => setLeafEl(singlePaneId!, el)">
（外すときの呼び出し（el＝null）でも、その時点の singlePaneId＝既に新しい pane を読む → 古い pane の登録が ownLeaves に残る）
packages/web/src/net/Connection.ts:79-86
  async login(token: string): Promise<boolean> { … return res.status === 204; }   （401・403・429 を区別しない）
```
→ **03-web-desktop の coding へ差し戻す**。

## ラウンド 6（2026-09-19・03 の T31／T32（D105）の後。自動で確かめられる分の最終）

### 実行したもの
- `pnpm -s typecheck`（exit 0）/ `pnpm -s lint`（exit 0）/ `pnpm -s test` — **922 passed / 0 failed**（92 ファイル）
- `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の起動方法 `pnpm --filter @wtm/e2e test`（1 ワーカー。D104）— **42 passed / 0 failed**（3.9 分）

### 失敗の証跡
このラウンドでは失敗が発生していない。

```
$ pnpm --filter @wtm/e2e test
Running 42 tests using 1 worker
[AC17 遅延] 200 回・p50=2.4ms p95=3.2ms max=5.2ms
[AC17 規模] pane16個・うち1個大量出力中・別 pane の遅延 50 回・p95=89.6ms
[AC17 遅延・描画まで] 1 pane・200 回・p50=14ms p95=28ms max=77ms
[AC17 規模・描画まで] 16 pane 同時表示・うち 1 つで yes・別 pane の 50 回・p50=117ms p95=374ms max=588ms・描画フレームの最大間隔=93ms
[AC11] server said: wtm: open https://localhost:46189/#token=<token> | wtm: open https://172.26.84.68:46189/#token=<token> | wtm: open https://192.168.0.122:46189/#token=<token> -> connecting to 172.26.84.68
  42 passed (3.9m)
```

### 起動確認（smoke）
```
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
```

### 受け入れ基準ごとの判定（ラウンド3 からの変更だけ。他はラウンド3 のとおり pass）
- AC3・AC-I4: pass——zoom 中に分割・pane を閉じると zoom を解除する（D100）。
- AC4・AC12: モバイルで表示する pane を切り替えても、隠れた pane の PTY が縮まない（D105。以前は 1×1 に縮んでいた）。
- AC10: pass——ログインの失敗の理由（401・403・429・通信の失敗）を画面に示す（D105）。同じ state-dir の二重起動を止め、`wtm token reset`
  が動く（D103。以前は一度も動いていなかった）。
- AC11: **一部**（変わらず）——同じマシンの LAN の IP へ TLS で接続（サーバが表示した LAN の URL へつなぐ形に。D101〜D103）。起動時に
  開ける URL を表示し、`--origin` で許可した名前を先頭に出す。portproxy を模した Host/Origin は `--origin` 無しで 403・有りで許可。
  **別のマシンからは未検証**。
- AC16: **一部**（変わらず）——`--shell` が効くようになった（01 の T27）。docs は Linux・WSL2（mirrored／NAT＋portproxy）・Windows
  ネイティブそれぞれの手順（ファイアウォールを含む）と AC11 の確認を持つ（D104）。**WSL2 を Windows のブラウザから・Windows ネイティブは
  未検証**。
- AC17: **一部**（変わらず）——E2E を 1 ワーカーにして性能計測が単独で走るようになった（D104）。大量出力の無い状態は目標内、大量出力中の
  16 pane の描画までの p95 は 300〜500ms 台（このサンドボックス）。**実機での判断に回す**。

### 「持ち越し」の照合
- 05（E2E の設定・spec の競合・docs）→ 05 の T13／T14 で解消（既定の起動方法で 42 passed）。
- 03（ログイン画面の文言・隠れた pane の 1×1）→ 03 の T31／T32 で解消。

### 未検証の穴（利用者が実機で確かめる。`docs/verification.md` の手順）
- AC11：別のマシンのブラウザから TLS で接続して AC1〜AC9 の操作（Linux・WSL2・Windows ネイティブそれぞれ。`docs/verification.md`
  「別のマシンからの TLS 接続（AC11）」）
- AC16：WSL2 を Windows のブラウザから使う構成（mirrored・NAT＋portproxy）・Windows ネイティブ（ConPTY・大文字のホスト名・Hyper-V の
  スイッチ名・`process.kill(pid, 0)` によるロックの判定・コンソールを閉じたときの終わり方）での AC1〜AC14・AC18
- AC12：実機の iPhone（Safari）・Android（Chrome）。タッチでのスクロール・ソフトキーボード（再接続の後に閉じないか。D95）・
  隠れた pane の大きさ（D105）・ログイン画面・CA の入れ方・xterm.js のモバイルの既知の課題
- AC17：GPU があり負荷の少ない実機での計測（とくに大量出力中の 16 pane）
- Tailscale（`tailscale cert` の鍵の権限）・リバースプロキシの実環境・Windows／PowerShell のファイアウォールのコマンド
- IME の変換候補窓の見た目・マウス報告の一部・copy モードの一部の移動キー・claude／codex 以外のエージェントの実物の画面

## ラウンド 7（2026-09-20・統合 review ラウンド1 の差し戻し（01 T29・03 T33／T34・04 T9・05 T15）の後）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 1066 passed / 0 failed（96 ファイル）/ `pnpm -s build`（exit 0）/ `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — **59 passed / 1 failed**（5.2 分）

### 失敗の証跡
```
  1) src/specs/workspace-tab-pane.spec.ts:297:1 › 新しい pane を作る操作の直後に打った文字は、応答を待たずに打っても新しい pane に届く（D99。親の統合 test で追加）
    Error: timed out waiting for "echo wtm-e2e-afternewws-1789851394522" in pane p3 output; got: ""
  1 failed
  59 passed (5.2m)
```
同じ test は 04 の T9 の test でも 1 回落ちている（そのときは負荷と判断したが、今回は所要時間が普段どおりで、同じ test の 2 回目）。
原因：E2E の支援 `packages/e2e/src/support/wsClient.ts` が SNAPSHOT の中身を `paneOutput` に足さない。ブラウザが溜めた入力を新しい pane へ流し、
シェルがエコーと実行を済ませた後にテストのクライアントが `pane.subscribe` すると、エコーは SNAPSHOT の中にしか無く `paneOutput` は空のまま
（製品は正しく動いている）。購読の前に 2 秒待たせる一時の spec で、必ず同じ形で落ちることを確かめた：

```
$ npx playwright test src/specs/zz-race.spec.ts
    Error: timed out waiting for "echo wtm-e2e-afternewws-1789851532314" in pane p3 output; got: ""
  1 failed
```
→ **05-e2e-docs の coding へ差し戻す**（E2E の支援の不具合）。

## ラウンド 8（2026-09-20・05 の T16 の後。自動で確かめられる分の最終）

### 実行したもの
- `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — **1066 passed / 0 failed**（96 ファイル）/ `pnpm -s build`（exit 0）/
  `aidev smoke` — pass
- 既定の `pnpm --filter @wtm/e2e test` — **60 passed / 0 failed**（5.1 分・exit 0）

### 失敗の証跡
このラウンドでは失敗が発生していない。

```
$ pnpm --filter @wtm/e2e test
[AC17 遅延] 200 回・p50=1.2ms p95=2.4ms max=32.3ms
[AC17 規模] pane16個・うち1個大量出力中・別 pane の遅延 50 回・p95=83.7ms
[AC17 遅延・描画まで] 1 pane・200 回・p50=14ms p95=25ms max=89ms
[AC17 規模・描画まで] 16 pane 同時表示・うち 1 つで yes・別 pane の 50 回・p50=124ms p95=513ms max=582ms・描画フレームの最大間隔=118ms
  60 passed (5.1m)
```

### 受け入れ基準ごとの判定（ラウンド6 からの変更だけ）
- AC4・AC8: pass——同じページのままの再接続で画面が戻る・窓とサイドバーの大きさに PTY が追従する（D107）。
- AC12: pass（エミュレーション）——モバイルの「この端末に合わせる」が表示領域いっぱいになり、回転・キーボード・再接続に追従する（D108）。
  隠れた pane が縮まない（D105）。fit していないモバイルはサイズを決めない（D106）。
- AC14: pass——右クリック（M3・M7）とリンク（M6）が design どおり（D110）。
- AC10・AC11: pass——ログインと接続の拒否の理由が画面に出る（D105・D107）。同じ state-dir の二重起動を止める（D103）。
- AC16: 一部（変わらず。実機）。AC17: 一部（変わらず。実機での判断）。

### 起動確認（smoke）
```
smoke: PASS
smoke: pass (exit 0)
```

### 未検証の穴
- ラウンド6 と同じ（実機での AC11・AC12・AC16・AC17、Tailscale・リバースプロキシ・Windows のコマンド）。手順は `docs/verification.md`
  に揃っている（05 の T15）。
- 既知の制約（`docs/verification.md`「既知の制約」）：TCP の半開きの間の入力・IME の変換中の文字・再接続で戻らない端末のモード・
  モバイルの fit の状態の食い違い・モバイルのタップでリンクを開かないこと。
