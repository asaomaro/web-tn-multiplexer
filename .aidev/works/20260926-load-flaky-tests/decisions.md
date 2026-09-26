# 判断の記録（20260926-load-flaky-tests）

## D1: 三層判定と範囲（着手時）

- **背景**: backlog（product-roadmap.md「単体・結合テストが高負荷のときだけ落ちる」）は 5 件の落ち方を記録している。着手前の調査で、
  (1) の `main.integration.test.ts`（AC9）は**負荷と無関係に単独・低負荷（load average 1〜4）で 10 回中 2 回落ちる**ことを実測した
  （scratchpad `pre/summary.txt`。後で test-result.md へ移す）。原因は `packages/cli/src/session.ts` の `FsSessionStore` の書き込みが
  「切り詰めてから書く」`writeFile` で、同じプロセスの別の操作がその間に読むと空のファイルを読み、**空として扱ったうえで保存し直して
  ほかの origin のセッションを消す**こと（`race3.mjs`: 書き込み 2000 回と並行した読み取り 4380 回のうち 392 回が空を読んだ）。
  加えて「読む→変える→書く」が直列化されておらず、同じプロセスで 2 つの origin を同時に `set` すると片方が必ず消える
  （`race4.mjs`: 50 回中 50 回）。
- **決定**: `profile: full`・`mode: autonomous` のまま進める。範囲は、記録された 5 件＋同じ `main.integration.test.ts` の
  「workspace create」の時間切れ＋**着手前の負荷の再現（busy loop 4 本＋全体テスト、load average 15〜21）で落ちたもの**。
  製品の不具合（`FsSessionStore`）は製品を直して回帰テストを足す。ほかはテスト側（資源の取り方・待ち方・時間の上限）を直す。
- **理由・代替案**: 製品の不具合が 1 件混ざっており、振る舞いが変わる（light の「振る舞いを変えない小規模」に当たらない）。
  負荷の再現で記録に無い落ち方も出た（GitInfoPoller・偽の claude）ので、同じ原因の範囲で拾い、原因の違うもの・極端な負荷
  （load average 29）でだけ出たものは backlog の兄弟に割る。
- **影響**: cli（製品）・server/cli/web のテスト。E2E は触らない（走らせない約束のため。E2E の `freePort.ts` は兄弟に割る）。

## D2: `FsSessionStore` は「原子的な置き換え＋同じプロセス内の直列化」で直す（プロセスをまたぐ排他はしない）

- **背景**: research F1〜F3。AC9 の落ち方の原因は製品側（`packages/cli/src/session.ts`）。
- **決定**: 一時ファイルに書いて `rename` で置き換える（server の `writeFileAtomic` と同じ形を cli に写す）。`set`/`clear` はファイルパスごとの
  Promise の鎖で順に行う。
- **理由・代替案**: (a) 原子的な置き換えだけ——「空を読んで全部消す」は消えるが、同じプロセスで 2 つの origin を同時に保存すると片方が
  必ず消える（`race4.mjs` 50/50）。(b) ロックファイルでプロセスをまたいで排他——残骸の掃除・Windows の扱いが重く、残る害は「別プロセスが
  同時に保存したときに別の origin の 1 件が後勝ちで消え、次の操作で再ログインを求める」だけ。backlog の兄弟に残す。
  cli は server に実行時の依存を持たないので、server の関数を import せず写す。
- **影響**: `FsSessionStore` の公開面は変わらない。

## D3: 空きポートは `--port 0` を通さず、「EADDRINUSE なら組み立て直す」と「自前の http.Server は listen(0)」で直す

- **背景**: 依頼は「`listen(0)` の結果を使う形などで、取り合いが起きない方法を検討する（API への影響は最小限に）」。research F6〜F8。
- **決定**: `composeServer` を待ち受けさせるテストは `composeServerOnFreePort`（server の `testkit` から出す）で、`EADDRINUSE` のときだけ閉じて
  組み立て直す（既定 5 回）。`http.Server` を自分で listen させるテスト（WsGateway・HttpServer の結合テスト）は `listen(0)` の結果を使う。
- **理由・代替案**: `composeServer` で `listen(0)` を使うには `parsePort` が断っている `--port 0`（`config.test.ts:71-73` が確かめている既存の
  振る舞い）を通し、Origin の許可リスト（組み立ての時点でポートを受け取る）を待ち受けの後に直す必要がある。利用者に見える `wtm serve` の
  引数の意味を変えることになり、「API への影響は最小限に」に反する。取り直しは、失敗した `listen()` が token も shell も lock も残さない
  （F7）ので安全。取り合いを**なくす**のではなく**起きても落ちない**形である点は残る（5 回続けて奪われる確率は無視できる）。
- **影響**: `testkit.ts` に export が 2 つ増える（テスト用の公開面）。`smoke.ts`・E2E の `freePort.ts` は同じ取り方のまま（backlog の兄弟）。

## D4: 時間の上限の規則と値

- **背景**: research F9・F11。
- **決定**: 対象のファイルで、条件 C の実測の最大の 2 倍に満たない上限を持つ `it` を、2 倍以上の 5 秒単位の切り上げにする。値は design.md
  「3. 時間の上限」の表のとおり（cli main 20 秒／composeServer 既定 15 秒・`--session work` 35 秒・偽の claude 20 秒と中の待ち 10 秒／
  GitInfoPoller の追従 15 秒／web 3 ファイル 10 秒）。
- **理由・代替案**: ルートや project の `testTimeout` を上げる案は、重くないテストの退行（無限待ち）まで遅く見つかるようにするので採らない。
  条件 C（load average 21〜23）は記録の条件（13〜16）より重いので、ここでの 2 倍はさらに余裕がある。
- **影響**: 本当に止まった（無限に待つ）ときに気づくまでが、最大で 35 秒に延びる（`--session work`）。

## D5: D4 の規則を「単位ごとの最大（落ちた回を含む）の 2 倍」に改める（design の独立点検 #1・#2・#3）

- **背景**: design の独立点検で、D4 の規則（ファイルの最大で決める）と、composeServer に当てた値（既定の `it` だけの最大で決める）が
  食い違うこと、persists の値が未確定のままであること、GitInfoPoller の中の待ちを据え置く理由が無いことを指摘された。加えて D4 は
  `measC` の 2 回だけを見ていて、`preC-6` で watch が 15 秒で落ちた回を数えていなかった。
- **決定**: 上限を与える単位（`it`・`describe`・ファイル）ごとに、着手前のすべての負荷の実行（C・F）の所要の最大 m（時間切れの回は
  その所要）を取り、上限が 2m 未満なら 2m 以上の 5 秒単位に切り上げる。`it` の中の待ちは上限の半分に置く。値は design.md の表
  （watch 35 秒・workspace create 10 秒・composeServer 既定 15 秒／`--session work` 35 秒／偽の claude 30 秒・待ち 15 秒／persists 15 秒・
  GitInfoPoller 追従 15 秒・待ち 7.5 秒・App と SettingsDialog 15 秒・symbolsNote 10 秒）。
- **理由・代替案**: 2 回の計測だけだと、ばらつきの大きいテスト（watch・GitInfoPoller の追従）の上限を低く見積もる。落ちた回を下限として
  数えれば、少なくとも観測した最悪を 2 倍で覆える。
- **影響**: D4 の値は使わない（D4 は当時の判断として残す）。

## D6: T6（負荷の下の前後比較）は test 工程で消化する

- **背景**: tasks.md の T6 は自前の差分を生まない確認（修正後に負荷の条件 C・F を流す）。
- **決定**: coding の承認時に T6 は未チェックのまま残し、test 工程で消化する（aidev-30-tasks 手順6）。
- **理由・代替案**: 修正前の実行は research で済んでいる。修正後はすべてのタスクが入った状態で流さないと比較にならない。
- **影響**: coding の `tasks_done` は 5。

## D7: T1 の点検の指摘のうち、Windows の rename の再試行と load の読み取りエラーの扱いは直さない

- **背景**: T1 のタスク点検で (a) Windows の `rename`（MoveFileEx）が、置き換え先を別のハンドルが開いている間に EPERM/EACCES/EBUSY で
  失敗しうる（推測）、(b) `load` が ENOENT 以外の読み取りエラーも「空」とみなし、次の保存でほかの接続先を消す（変更前からの挙動）、の 2 件。
- **決定**: どちらもこの work では直さない。(a) は backlog の兄弟に残し、test-result.md の未検証の穴に書く。(b) は変更前からの挙動として残す。
- **理由・代替案**: (a) Node（libuv）は Windows でファイルを FILE_SHARE_DELETE 付きで開くので、別の `wtmctl` の読み取りは置き換えを妨げない
  と考えるが、確かめられない。再試行を足しても Windows で一度も動かせないコードになる。server の `writeFileAtomic` も同じ形で運用している。
  (b) 読み取りの一時的な失敗は、この work の再現（負荷の下の空の読み取り）とは別の経路で、実測もしていない。
- **影響**: PR 本文の既知の制約に (a) を書く。

## D8: 新しいテスト（composeServerOnFreePort・session の並行の読み書き）にも D5 の規則を当てる（cross 点検 #1）

- **背景**: cross 点検で、`composeServerOnFreePort.integration.test.ts` の上限 15 秒が実測に基づかない類推だと指摘された。
- **決定**: 条件 C（busy loop 12 本）で 2 回測った（`runs/measC-new-*.json`）。最大は「取り直し」の it の 2467ms。ほかに、別の worktree の
  vitest が走っていた時間帯の 1 回目の実行（`t2-green.log`。その約 10 分後の load average は 34）で 3404ms。m=3404 → 2m=6808 → **10 秒**（ファイル）。
  `session.test.ts` の並行の読み書きの it は最大 1101ms → 2m=2202 → 既定の 5 秒のまま。
- **理由・代替案**: 既定の 5 秒に戻す案は、別の worktree の負荷で 3.4 秒を観測しているので 2 倍の余裕が無い。15 秒は規則の値より大きい。
- **影響**: なし（テストの上限だけ）。

## D9: GitInfoPoller の追従のテストに、名前を決める時間の予算を広げた依存を渡す（test ラウンド 1 の差し戻し）

- **背景**: 修正後の条件 F の 2 回目（load average 最大 31）で、追従の it が時間切れではなく「名前が `sub`（フォルダ名）」で落ちた
  （test-result.md ラウンド 1）。`AUTO_LABEL_TIMEOUT_MS`（200ms。`packages/server/src/session/workspaceLabel.ts:17`）を負荷の下で超え、
  製品の設計どおりフォルダ名に代えた（`degraded`。`SessionService.applyWorkspaceIdentity` が `labelCwd` を消し、次の見直しで決め直す）。
  この describe の poller の周期は 60 秒なので、中の待ち（7.5 秒）の間には決め直されない。修正前は同じ it が 5 秒の時間切れで先に落ちていた。
- **決定**: この describe の `SessionService` に `workspaceLabelDeps: { ...defaultWorkspaceLabelDeps, timeoutMs: 3_000 }` を渡す。製品の予算は変えない。
- **理由・代替案**: (a) 製品の予算（200ms）を上げる——利用者の fs が止まったときに workspace の作成を待たせない、という前の work の設計
  （20260921-workspace-auto-label の D4）を崩すので採らない。(b) poller の周期を短くして決め直しを待つ——確かめたい「1 回の workspace.updated で
  名前と git が揃う」（AC1・AC10）の意味が変わる（2 回目の更新で揃うことになる）。(c) 予算を広げる——この describe が確かめるのは追従で、予算を
  超えたときの振る舞いは `workspaceLabel.test.ts`・`SessionService.test.ts` が偽の fs で確かめている。3 秒は既定の 15 倍で、中の待ち（7.5 秒）の
  半分より短い。
- **影響**: テストだけ。

## D10: review ラウンド 1 の nit の扱い（D3 の訂正を含む）

- **背景**: review ラウンド 1（別コンテキストの opus）は must・should 0 件、nit 7 件（review.md）。
- **決定**: prettier の整形だけ直す（新規か HEAD で整形済みのファイルに限る）。D3 の「影響」の export の数は **3 つ**（`composeServerOnFreePort`・
  `getFreePort`・型 `ComposeOnFreePortOptions`）が正しい（D3 は書き換えず、ここで訂正する）。D5 の「it の中の待ちは上限の半分」は
  **上限を変えた it にだけ当てる**規則で、上限を据え置いた `--follow` の it（`main.integration.test.ts`）や既定 1 秒の `vi.waitFor` は対象外。
  `FsSessionStore.save` の `rename` は session.json がシンボリックリンクならリンク自体を通常ファイルに置き換える（server の `writeFileAtomic` と同じ。既知の制約）。
  `listenOnFreePort` の置き場所・AC1 の読み手を `get` に限ったことは変えない。
- **理由・代替案**: nit のみなので差し戻さない（aidev-60-review）。直すと test をやり直すことになり、負荷の下の前後比較（AC6）の記録と食い違う。
- **影響**: なし（整形のみ）。
