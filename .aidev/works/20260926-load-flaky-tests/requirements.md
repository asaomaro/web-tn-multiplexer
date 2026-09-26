# 要件: 高負荷のときだけ落ちる単体・結合テストをなくす（と、その陰にあった wtmctl のセッションキャッシュの不具合を直す）

## 背景 / 課題

並列作業（別 worktree・別セッションの vitest と同時実行、load average 13〜16）の全体テスト（`pnpm -s test`）で、単独では通る
テストが落ちた（backlog `product-roadmap.md`「単体・結合テストが高負荷のときだけ落ちる」）。記録は 5 件:

1. `packages/cli/src/main.integration.test.ts`「Origin ヘッダが許可リストに無い接続は…403 で拒否される（AC9）」が
   `TypeError: Invalid value "undefined" for header "cookie"`。同じファイルの「workspace create: 初回は --token でログインし…（AC1, AC7）」
   が 5000ms で時間切れ（主エージェントの観察）。
2. `packages/web/src/components/SettingsDialog.test.ts`「矢印キー（radio）・Enter/Space（switch）…（AC-I3）」が 5000ms で時間切れ。
3. server の結合テストが `listen EADDRINUSE`（`getFreePort` で番号だけ取り、後で listen するまでの間に別の誰かが使う）。
4. `packages/web/src/App.test.ts`「モバイル（MobileShell）は pane の枠を描かない」が 5000ms で時間切れ。
5. `packages/server/src/composeServer.integration.test.ts`「組み立てと listen() の間に token reset が走っても…（D103 の独立点検 #1）」が
   5000ms で時間切れ。

着手前の調査で分かったこと（decisions.md D1）:

- (1) の AC9 は**負荷と無関係に**、ファイル単独・低負荷で 10 回中 2 回落ちる。`wtmctl` のセッションキャッシュ
  （`~/.wtmctl/session.json`）の書き込みが原子的でなく（切り詰めてから書く）、書き込みの途中を読んだ操作が「空」とみなして保存し直し、
  ほかの接続先のセッションを消す。途中を読むのは同じプロセスの別の操作でも、別のプロセスの `wtmctl` でも起きる。加えて、同じ
  プロセスの中では「読む→変える→書く」が直列化されておらず、2 つの接続先を同時に保存すると片方が消える。これは**製品の不具合**で、
  利用者が `wtmctl` を同時に動かす（エージェントが並行してコマンドを打つ・`wtmctl watch` を開いたまま別のコマンドを打つ）と、
  ログイン済みの接続先のセッションが消えて再ログインを求められうる。
- わざと負荷をかけた全体テスト（busy loop 4 本、load average 15〜21）では、記録に無いテスト（`GitInfoPoller.test.ts`・
  `composeServer.integration.test.ts` の偽の claude）も時間切れで落ちた。

困るのは、テストの赤が「本物の退行」か「負荷のせい」かを毎回調べ直す手間が生じ、並列作業の着地（全体テスト 2 回の緑）が
運任せになること。

## 目的 / ゴール

- 並列作業で負荷が高いとき（AC6 で定める条件。load average でおよそ 15〜21）にも、対象のテスト（下の「対象」）が負荷を理由に
  赤にならない状態。
- `wtmctl` を並行に使っても（同じプロセス内でも、別のプロセスでも）、書き込みの途中を読んでキャッシュ済みのセッションが消える
  ことが無く、同じプロセス内の同時の保存でも消えない状態（別のプロセス同士が**同時に保存**したときの後勝ちは対象外）。
- テストが確かめている内容は今より弱くならない状態。

## ユーザーストーリー

- US1: 並列で作業する開発者・AI エージェントとして、負荷が高いときも全体テストが通ってほしい。なぜなら、負荷による赤を退行と
  見分ける調べ直しに時間を取られ、着地の判断（全体テスト 2 回の緑）が運任せになるから。（受け入れ: AC3, AC4, AC5, AC6, AC7, AC8）
- US2: `wtmctl` を並行して使う利用者（人・エージェント）として、ログイン済みのセッションが勝手に消えないでほしい。なぜなら、
  消えると `--token` を渡し直すか `wtmctl login` をやり直す必要があり、token を渡していない自動化はそこで止まるから。（受け入れ: AC1, AC2, AC3, AC10）

## スコープ

### 対象

- `packages/cli/src/session.ts` の `FsSessionStore`（製品）の書き込みと、同じプロセス内の並行な読み書き。
- 記録された 5 件と「workspace create」の時間切れ、および着手前の負荷の再現（D1 の条件）で落ちたテスト。一覧:
  - `packages/cli/src/main.integration.test.ts` の全 `it`（最初の「workspace create」が時間切れになると後続が連鎖して落ちる）
  - `packages/web/src/components/SettingsDialog.test.ts`・`packages/web/src/App.test.ts`（負荷の再現ではファイル内の複数の `it` が落ちた）
  - `packages/server/src/composeServer.integration.test.ts`「組み立て…token reset…（D103 の独立点検 #1）」「実物の PTY で偽の 'claude' を起動すると…」
  - `packages/server/src/git/GitInfoPoller.test.ts`「最初の pane が別のリポジトリへ移ると…（AC1・AC10）」
- server・cli の単体・結合テストの空きポートの取り方（`getFreePort` で番号だけ取って後で listen する形）。

### 対象外

- E2E（`packages/e2e`。走らせない約束。E2E の `freePort.ts` も同じ取り方だが、確かめられないので backlog に割る）。
- 別プロセス同士の `wtmctl` の同時書き込み（プロセスをまたぐ排他。影響と要否を backlog に残す）。
- 起動確認のスクリプト（`packages/server/src/smoke.ts`・`packages/cli/src/smoke.ts`）の空きポート（単独で走るため取り合いが起きにくい。
  backlog に残す）。
- load average 29 のような極端な負荷でだけ落ちるもの（再現した条件と一緒に backlog に残す）。
- テスト全体の既定の時間の上限（`testTimeout`）を一律に上げること。

## 機能要件

- `FsSessionStore` は、書き込みの途中の状態をほかの読み手に見せない。
- `FsSessionStore` は、同じプロセス内の同時の `set`/`clear` で、ほかの接続先のセッションを失わない。
- 単体・結合テストのサーバの待ち受けは、ポートの取り合いが起きても落ちない（取り合いそのものが起きない形か、起きたら取り直す形）。
- 重いテスト（実サーバ・実 PTY・実 git・画面全体の描画）の時間の上限は、重い理由と実測に基づいてそのテスト（またはファイル）に
  だけ与える。

## 非機能要件 / 制約

- テストの検証内容を弱めない（アサーションを消す・skip する・対象を狭めることはしない）。
- 製品の公開 API（`wtm serve` の引数・`composeServer` の引数）は変えないか、変えるなら最小限にする。
- Linux / WSL2 / Windows の 3 OS で動く書き方にする（`rename` での置き換え等）。

## 完了条件 (受け入れ基準)

- [ ] AC1: `FsSessionStore` への書き込みと並行した読み取りが、書き込み前後のどちらかの内容を必ず読む（空を読まない）ことを確かめる
  回帰テストがあり、修正を戻すと落ちる（負の確認の生の出力がある）。
- [ ] AC2: 同じプロセスで 2 つの接続先を同時に `set` しても両方が残ることを確かめる回帰テストがあり、修正を戻すと落ちる
  （負の確認の生の出力がある）。
- [ ] AC3: `main.integration.test.ts` をファイル単独で 20 回流して、修正前は AC9 が落ち（回数を示す）、修正後は 20 回で 1 度も落ちない。
- [ ] AC4: server・cli の単体・結合テストで `composeServer`/`http.Server` を待ち受けさせる箇所が、ポートの取り合いで落ちない形になっている
  （取り合いを起こしても通ることを確かめるテストがある）。
- [ ] AC5: 記録された時間切れ（SettingsDialog の AC-I3・App のモバイル・composeServer の D103 #1・cli の workspace create）と、
  着手前の負荷の再現で落ちたテストに、重い理由と負荷の下での実測に基づく時間の上限が与えられている（根拠が decisions.md にある）。
- [ ] AC6: わざと負荷をかけた同じ条件（条件は design で固定し、load average の推移を記録する）で修正前・修正後をそれぞれ 5 回以上
  繰り返し、落ちた回数を生の出力つきで示す。修正後は対象のテストが 1 度も落ちない。
- [ ] AC7: 修正の前後で、対象のテストのアサーション・`it` の数が減っていない（差分で示す）。
- [ ] AC8: `pnpm -s build`・`pnpm -s typecheck`・`pnpm -s test`（2 回とも）・`aidev smoke` が終了コード 0。
- [ ] AC9: 公開 API（`wtm serve` の引数・`composeServer` の引数と戻り値）に変更が無い、または変更が最小で理由が decisions.md にある（差分で示す）。
- [ ] AC10: `FsSessionStore` の書き込みが Linux / WSL2 / Windows のいずれにもある API（一時ファイル＋`rename`）だけで書かれている
  （Windows での実行は確かめられないので、確かめていないことを test-result.md に未検証の穴として残す）。

## 未確定事項 / 確認したいこと

- 空きポートを `listen(0)` の結果で使う形にできるか（`composeServer` はポートを Origin の許可リストに焼き込み、`--port 0` は
  既存のテストで設定の誤りとして断っている）。design で決める。
- 時間の上限の値（負荷の下での実測から決める）。
