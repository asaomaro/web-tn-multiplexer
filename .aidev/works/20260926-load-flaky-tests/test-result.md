# テスト結果: 高負荷のときだけ落ちる単体・結合テストをなくす

生の記録の置き場: scratchpad `load-flaky-tests/`（`pre/`・`runs/`・`neg/`・`post/`）。下の ``` ブロックはそこからの抜粋で、手で書き起こしていない。
負荷は `loadrun.sh`（busy loop を N 本 `timeout 900` 付きで走らせ、15 秒後に vitest を 1 回。終わったら kill。load average を 10 秒ごとに記録）。
すべての実行の後に busy loop が残っていないことを `pgrep -fa "while :; do :; done"` で確かめた（0 件）。

## ラウンド 1（2026-09-26 22:0x〜22:33）

### 実行したもの

```
test1 rc=0
test2 rc=0
smoke rc=0
build rc=0 / typecheck rc=0（pnpm -s build → pnpm -s typecheck。出力なし）
 Test Files  181 passed (181)
      Tests  3667 passed (3667)
 Test Files  181 passed (181)
      Tests  3667 passed (3667)
```

### AC3: `main.integration.test.ts` を単独で 20 回（修正前・修正後）

修正前（着手前。`pre/summary.txt`。列: 回・終了コード・「workspace create」の所要・落ちた it の数・load average）:

```
run 1 rc=1 AC1, AC7） 759ms 1 load=1.52
run 2 rc=0 AC1, AC7） 1578ms 0 load=1.41
run 3 rc=1 AC1, AC7） 770ms 1 load=1.35
run 4 rc=0 AC1, AC7） 672ms 0 load=1.29
run 5 rc=0 AC1, AC7） 748ms 0 load=1.70
run 6 rc=0 AC1, AC7） 692ms 0 load=1.67
run 7 rc=0 AC1, AC7） 758ms 0 load=1.66
run 8 rc=0 AC1, AC7） 692ms 0 load=1.87
run 9 rc=0 AC1, AC7） 1235ms 0 load=3.71
run 10 rc=0 AC1, AC7） 743ms 0 load=4.04
run 11 rc=0 AC1, AC7） 617ms 0 load=9.74
run 12 rc=0 AC1, AC7） 679ms 0 load=8.87
run 13 rc=0 AC1, AC7） 835ms 0 load=7.90
run 14 rc=0 AC1, AC7） 727ms 0 load=6.84
run 15 rc=0 AC1, AC7） 631ms 0 load=6.17
run 16 rc=0 AC1, AC7） 620ms 0 load=5.53
run 17 rc=0 AC1, AC7） 707ms 0 load=5.89
run 18 rc=0 AC1, AC7） 695ms 0 load=5.09
run 19 rc=0 AC1, AC7） 770ms 0 load=5.10
run 20 rc=0 AC1, AC7） 852ms 0 load=4.41
```

修正前に落ちた回の出力（`pre/cli-1.log`）:

```
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）
TypeError: Invalid value "undefined" for header "cookie"
 ❯ initAsClient ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js:885:28
 ❯ new WebSocket ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js:88:7
 ❯ src/main.integration.test.ts:255:16
    253|    */
    254|   it("Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）", async …
```

修正後（`post/summary.txt`）:

```
run 1 rc=0 AC1, AC7） 614ms 0 load=8.18
run 2 rc=0 AC1, AC7） 685ms 0 load=7.23
run 3 rc=0 AC1, AC7） 703ms 0 load=6.66
run 4 rc=0 AC1, AC7） 823ms 0 load=6.28
run 5 rc=0 AC1, AC7） 736ms 0 load=5.78
run 6 rc=0 AC1, AC7） 714ms 0 load=5.20
run 7 rc=0 AC1, AC7） 696ms 0 load=5.19
run 8 rc=0 AC1, AC7） 569ms 0 load=4.55
run 9 rc=0 AC1, AC7） 667ms 0 load=4.35
run 10 rc=0 AC1, AC7） 594ms 0 load=3.91
run 11 rc=0 AC1, AC7） 588ms 0 load=3.83
run 12 rc=0 AC1, AC7） 618ms 0 load=3.63
run 13 rc=0 AC1, AC7） 819ms 0 load=4.24
run 14 rc=0 AC1, AC7） 699ms 0 load=4.06
run 15 rc=0 AC1, AC7） 593ms 0 load=4.07
run 16 rc=0 AC1, AC7） 706ms 0 load=4.08
run 17 rc=0 AC1, AC7） 559ms 0 load=4.07
run 18 rc=0 AC1, AC7） 813ms 0 load=3.59
run 19 rc=0 AC1, AC7） 564ms 0 load=3.88
run 20 rc=0 AC1, AC7） 583ms 0 load=3.65
```

### AC6: わざと負荷をかけた前後比較

条件 C（busy loop 12 本＋対象の 6 ファイル）・条件 F（busy loop 4 本＋全体テスト）。`runs/summary.txt` の該当行（loadmax は実行中の 1 分平均の最大）:

```
pre-b4-1 rc=1  Tests 2 failed | 3657 passed (3659) loadmax=21.07
pre-b4-2 rc=0  Tests 3659 passed (3659) loadmax=23.38
pre-b4-3 rc=0  Tests 3659 passed (3659) loadmax=24.82
pre-b4-4 rc=1  Tests 1 failed | 3658 passed (3659) loadmax=23.97
preC-1 rc=1  Tests 2 failed | 159 passed (161) loadmax=21.16
preC-2 rc=1  Tests 1 failed | 160 passed (161) loadmax=21.30
preC-3 rc=1  Tests 1 failed | 160 passed (161) loadmax=22.48
preC-4 rc=1  Tests 1 failed | 160 passed (161) loadmax=22.98
preC-5 rc=1  Tests 1 failed | 160 passed (161) loadmax=22.57
preC-6 rc=1  Tests 3 failed | 158 passed (161) loadmax=21.73
postC-1 rc=0  Tests 161 passed (161) loadmax=20.92
postC-2 rc=0  Tests 161 passed (161) loadmax=23.93
postC-3 rc=0  Tests 161 passed (161) loadmax=23.74
postC-4 rc=0  Tests 161 passed (161) loadmax=24.94
postC-5 rc=0  Tests 161 passed (161) loadmax=27.99
postC-6 rc=0  Tests 161 passed (161) loadmax=29.29
post-b4-1 rc=0  Tests 3667 passed (3667) loadmax=29.12
post-b4-2 rc=1  Tests 1 failed | 3666 passed (3667) loadmax=31.19
post-b4-3 rc=0  Tests 3667 passed (3667) loadmax=28.05
post-b4-4 rc=0  Tests 3667 passed (3667) loadmax=28.13
```

修正前に落ちた it（各回の `FAIL` 行）:

```
preC-1.log: web| src/App.test.ts > App — 接続の状態での切り替え > ログイン画面の「接続中…」の間に接|server| src/composeServer.integration.test.ts > composeServer (integration) > 実物の PTY で偽の 'claude' を起動|
preC-2.log: server| src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初|
preC-3.log: server| src/composeServer.integration.test.ts > composeServer (integration) > 組み立て（composeServer）と listen(|
preC-4.log: server| src/composeServer.integration.test.ts > composeServer (integration) > 実物の PTY で偽の 'claude' を起動|
preC-5.log: server| src/composeServer.integration.test.ts > composeServer (integration) > 実物の PTY で偽の 'claude' を起動|
preC-6.log: web| src/App.test.ts > App — 接続の状態での切り替え > authRequired なら LoginView|cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > watch: 別クライアント|cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > login コマンド: --token |
pre-b4-1.log: server| src/composeServer.integration.test.ts > composeServer (integration) > 実物の PTY で偽の 'claude' を起動|server| src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初|
pre-b4-2.log: 
pre-b4-3.log: 
pre-b4-4.log: web| src/components/SettingsDialog.test.ts > SettingsDialog — 色の個別の上書き > 妥当な色を確定する|
```

### 失敗の証跡（修正後の条件 F の 2 回目。`runs/post-b4-2.log`）

```
 FAIL  |@wtm/server| src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
AssertionError: expected { id: 'w1', label: 'sub', …(6) } to match object { label: 'wtm-follow-aKEbDM', …(1) }
(6 matching properties omitted from actual)

- Expected
+ Received

  {
    "git": {
      "branch": "other",
    },
-   "label": "wtm-follow-aKEbDM",
+   "label": "sub",
  }

 ❯ vi.waitFor.timeout src/git/GitInfoPoller.test.ts:311:53
    309|     });
    310|     service.updatePaneRuntime(pane.id, { cwd: join(repoB, "sub") });
    311|     await vi.waitFor(() => expect(ws(workspace.id)).toMatchObject({ la…
       |                                                     ^
    312|     expect(updates.map((w) => [w.label, w.git?.branch]), "名前と git は同じ …
    313|     expect(ws(workspace.id).cwd, "開いた場所は変えない（AC9）").toBe(repoA);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 180 passed (181)
      Tests  1 failed | 3666 passed (3667)
   Start at  22:29:57
   Duration  181.78s (tests 41%, environment 30%, transform 15%, import 12%, worker 1%)

Environment  |@wtm/web| happy-dom was created 93 times · 488.16s total, 44% of tracked time
             create it once per worker with pool: 'vmThreads' (keeps per-file isolation) or isolate: false (shares it across files)
             learn more: https://vitest.dev/guide/improving-performance#test-environments

JSON report written to /tmp/claude-1000/-workspaces-web-tn-multiplexer/9796433e-4b65-4ab9-85f6-03bb890c31f9/scratchpad/load-flaky-tests/runs/post-b4-2.json
```

原因: 時間切れではなく、自動の名前が `sub`（フォルダ名）になっている。`workspaceLabel.ts` の `AUTO_LABEL_TIMEOUT_MS = 200` を負荷の下で超え、
製品の設計どおりフォルダ名に代えた（`degraded`。次の見直しで決め直す——このテストの poller の周期は 60 秒なので待ちの中では来ない）。
修正前は同じ it が 5 秒の時間切れで先に落ちていたので、この落ち方は見えていなかった。対象の it が確かめているのは「最初の pane が移ったら名前と
git が 1 回で揃う」ことで、名前を決める時間の予算ではない（予算を超えたときの振る舞いは `workspaceLabel.test.ts`・`SessionService.test.ts` が
偽の fs で確かめている）。→ coding へ差し戻す（この describe の `SessionService` に、予算を広げた `workspaceLabelDeps` を渡す）。

## ラウンド 2（T7 を入れた後。2026-09-26 22:4x〜23:33）

### 実行したもの

```
build rc=0
typecheck rc=0
test1 rc=0
test2 rc=0
smoke rc=0
 Test Files  181 passed (181)
      Tests  3667 passed (3667)
 Test Files  181 passed (181)
      Tests  3667 passed (3667)
```

### AC6: わざと負荷をかけた前後比較（修正後。ラウンド 2 の状態）

条件 C を 9 回・条件 F を 4 回。別の worktree・別のセッションの vitest が並行して走っていて（`ps` で確認）、load average は修正前の実行
（C: 最大 21〜23、F: 21〜25）より高かった。

```
post2C-1 rc=0  Tests 161 passed (161) loadmax=34.03
post2C-2 rc=0  Tests 161 passed (161) loadmax=38.83
post2C-3 rc=0  Tests 161 passed (161) loadmax=30.89
post2C-4 rc=0  Tests 161 passed (161) loadmax=27.16
post2C-5 rc=0  Tests 161 passed (161) loadmax=34.24
post2C-6 rc=1  Tests 3 failed | 158 passed (161) loadmax=41.38
post2-b4-1 rc=0  Tests 3667 passed (3667) loadmax=31.50
post2-b4-2 rc=0  Tests 3667 passed (3667) loadmax=27.26
post2-b4-3 rc=0  Tests 3667 passed (3667) loadmax=24.92
post2-b4-4 rc=0  Tests 3667 passed (3667) loadmax=27.42
post2C-7 rc=0  Tests 161 passed (161) loadmax=22.64
post2C-8 rc=0  Tests 161 passed (161) loadmax=22.15
post2C-9 rc=0  Tests 161 passed (161) loadmax=22.78
```

落ちた 1 回（`post2C-6`。load average 最大 41.38）の出力と load の推移:

```
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > pane read --follow: 以後の OUTPUT を継続的に受け取る（AC4）
Error: Test timed out in 20000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/main.integration.test.ts:132:3
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > watch: 別クライアントが起こした workspace.created イベントを受け取る（AC6）
Error: Test timed out in 35000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/main.integration.test.ts:170:3
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > login コマンド: --token で明示ログインし、別のセッションキャッシュへ書き込む（AC7 の前提）
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/main.integration.test.ts:211:3
load: 23:11:10 34.46 28.78 23.34;23:11:20 34.90 29.07 23.49;23:11:30 33.58 28.99 23.52;23:11:40 32.61 28.92 23.56;23:11:50 34.40 29.43 23.78;23:12:00 35.26 29.78 23.96;23:12:11 36.19 30.15 24.14;23:12:21 37.61 30.66 24.37;23:12:31 38.93 31.17 24.60;23:12:41 39.40 31.52 24.79;23:12:51 41.38 32.21 25.09;23:13:01 40.30 32.29 25.19;23:13:11 40.09 32.51 25.34;23:13:21 39.86 32.71 25.48;23:13:31 39.58 32.88 25.61;23:13:42 39.36 33.05 25.75;23:13:52 38.07 32.98 25.80;23:14:02 35.44 32.59 25.75;23:14:12 33.77 32.32 25.74;
```

`--follow`（上限 20 秒）・watch（35 秒）が時間切れになり、後始末されない `--follow` の出力で login が連鎖して落ちた。このときの load average は
41（コア 12 の 3.4 倍）で、修正前の条件 C（21〜23）と設計の前提（D5: 21〜23 で測った所要の 2 倍）を大きく超える。同じ条件 C で load average が
22〜34 だった 8 回はすべて通った。**負荷がコア数の約 3 倍を超える状態では、まだ落ちうる**——未検証の穴と backlog の兄弟に残す。

### 負の確認（regression-negative-control）

修正した箇所だけを戻し、テストが落ちることを確かめた（戻した後は控えと `cmp` で一致を確認済み）。

- AC1（原子的な置き換えだけを戻す。`save` を `writeFile` で直接書く形へ。5 回とも落ちた。`neg/atomic-reverted-*.log`）:

```
run 1 rc=1       Tests  1 failed | 2 passed | 11 skipped (14)
run 2 rc=1       Tests  1 failed | 2 passed | 11 skipped (14)
run 3 rc=1       Tests  1 failed | 2 passed | 11 skipped (14)
run 4 rc=1       Tests  1 failed | 2 passed | 11 skipped (14)
run 5 rc=1       Tests  1 failed | 2 passed | 11 skipped (14)
 FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 並行する読み書き（20260926-load-flaky-tests） > 書き込みと並行した読み取りは、書き込みの前か後の内容を読む（ほかの接続先の cookie が消えて見えない。AC1）
AssertionError: expected [ undefined, undefined, …(7) ] to deeply equal []
```

- AC2（直列化だけを戻す。`serializeUpdate` の鎖を外す。5 回とも落ちた。`neg/serialize-reverted-*.log`）:

```
run 1 rc=1       Tests  1 failed | 2 passed | 11 skipped (14) FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 
run 2 rc=1       Tests  1 failed | 2 passed | 11 skipped (14) FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 
run 3 rc=1       Tests  1 failed | 2 passed | 11 skipped (14) FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 
run 4 rc=1       Tests  1 failed | 2 passed | 11 skipped (14) FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 
run 5 rc=1       Tests  1 failed | 2 passed | 11 skipped (14) FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 
AssertionError: expected undefined to be 'wtm_session=a' // Object.is equality
```

- 鎖が失敗で止まる変異（`tail = run`。T1 の点検の指摘で足したテスト。`neg/chain-stops.log`）:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/cli| src/session.test.ts > FsSessionStore — 並行する読み書き（20260926-load-flaky-tests） > 保存が 1 度失敗しても、同じファイルへの次の保存は行われる（直列化の鎖が失敗で止まらない）
      Tests  1 failed | 14 passed (15)
```

- 取り直しの手段（T2。`neg/t2-*.log`）: 取り直さない変異・何でも取り直す変異・失敗時に閉じない変異:

```
== t2-no-retry
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/server| src/composeServerOnFreePort.integration.test.ts > composeServerOnFreePort（20260926-load-flaky-tests の D3） > 選んだポー
 FAIL  |@wtm/server| src/composeServerOnFreePort.integration.test.ts > composeServerOnFreePort（20260926-load-flaky-tests の D3） > 上限の回数
      Tests  2 failed | 1 passed (3)
== t2-retry-all
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/server| src/composeServerOnFreePort.integration.test.ts > composeServerOnFreePort（20260926-load-flaky-tests の D3） > EADDRINUSE 以
      Tests  1 failed | 2 passed (3)
== t2-no-close
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/server| src/composeServerOnFreePort.integration.test.ts > composeServerOnFreePort（20260926-load-flaky-tests の D3） > 待ち受けた
      Tests  1 failed | 3 passed (4)
```

- GitInfoPoller の追従で名前を決める予算を 0 にする変異（T7。負荷の下で 200ms を超えたのと同じ状態。`neg/t7-budget0.log`）:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/server| src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
-   "label": "wtm-follow-7CdsiD",
+   "label": "sub",
      Tests  1 failed | 22 passed (23)
```

### `vi.setConfig` がファイルにだけ効くことの確認（design「依拠する既存の事実」の未確認の項）

同じワーカーで、10 秒に上げたファイル（a）の後に、上げていないファイル（b）で 6 秒待つ it を流した（`setconfig-*.log`）。b は 5 秒で時間切れになった。

```
== --pool=forks --maxWorkers=1 --no-file-parallelism
 ✓ |@wtm/cli| src/zz_tmp_a.test.ts > a: 6 秒待つ（10 秒の上限の下） 6020ms
 × |@wtm/cli| src/zz_tmp_b.test.ts > b: 6 秒待つ（既定の上限の下） 5029ms
== --pool=threads --maxWorkers=1 --no-file-parallelism
 ✓ |@wtm/cli| src/zz_tmp_a.test.ts > a: 6 秒待つ（10 秒の上限の下） 6010ms
 × |@wtm/cli| src/zz_tmp_b.test.ts > b: 6 秒待つ（既定の上限の下） 5015ms
```

### AC7: アサーション・`it` の数（HEAD と比べて減っていない）

```
file                                                           expect(HEAD) expect(now)   it(HEAD)    it(now)
packages/cli/src/agent.integration.test.ts                              5          5          5          5
packages/cli/src/agentPrompt.integration.test.ts                       11         11          2          2
packages/cli/src/attach.integration.test.ts                            29         29          4          4
packages/cli/src/main.integration.test.ts                              14         14          8          8
packages/cli/src/session.test.ts                                       12         21          7         11
packages/cli/src/wsClient.test.ts                                       7          7          4          4
packages/server/src/composeServer.integration.test.ts                  78         79         24         24
packages/server/src/git/GitInfoPoller.test.ts                          35         35         23         23
packages/server/src/http/HttpServer.integration.test.ts                65         65         17         17
packages/server/src/ws/WsGateway.integration.test.ts                   36         36         16         16
packages/web/src/App.test.ts                                           35         35         15         15
packages/web/src/components/SettingsDialog.symbolsNote.test.ts          1          1          1          1
packages/web/src/components/SettingsDialog.test.ts                    259        259         87         87
packages/server/src/composeServerOnFreePort.integration.test.ts          0         10          0          4
```

（AC7 の表は T5 の後に数えた。T7 は `GitInfoPoller.test.ts` の `beforeEach` の引数を 1 つ足しただけで、`expect(`・`it(` は変わらない。）

## 受け入れ基準ごとの判定

- AC1: pass — `session.test.ts`「書き込みと並行した読み取りは…」。原子的な置き換えを戻すと 5/5 で落ちる（上の負の確認）。
- AC2: pass — `session.test.ts`「同じプロセスで 2 つの接続先を…」。直列化を戻すと 5/5 で落ちる。
- AC3: pass — `main.integration.test.ts` を単独で 20 回。修正前 2/20 落ち（AC9 の cookie が undefined）、修正後 0/20（ラウンド 1。以後 cli の
  製品コード・このテストの待ち受けは変えていない）。
- AC4: pass — `composeServerOnFreePort.integration.test.ts`（取り直す・取り直さない・閉じてから投げる・上限で諦める）。server・cli の単体・結合テストに
  「番号だけ取って後で待ち受ける」形が残っていないことを grep で確かめた（残る `getFreePort` の呼び出しは bind しない 3 か所：ロックで断られる
  2 つ目 2 か所・listen しない「引き継ぐ」1 か所）。
- AC5: pass — 値と実測は design「3. 時間の上限」・decisions D5・D8・D9。
- AC6: pass（条件つき）— 条件 C: 修正前 6/6 落ち → 修正後 8/9 通過（落ちた 1 回は load average 41 で条件の範囲外）。条件 F: 修正前 2/4 落ち →
  修正後 4/4 通過（ラウンド 2。ラウンド 1 の 1/4 落ちは T7 で直した）。
- AC7: pass — 上の表。減ったファイルは無い。
- AC8: pass — build・typecheck・test×2・smoke がすべて rc=0（ラウンド 2）。
- AC9: pass — 公開 API の差分は `packages/server/src/testkit.ts` への export の追加（`composeServerOnFreePort`・`getFreePort`・`ComposeOnFreePortOptions`）
  だけ。`wtm serve`・`composeServer` の引数と戻り値は変えていない。
- AC10: pass（Linux のみ）— `FsSessionStore.save` は `mkdtemp`・`writeFile`・`chmod`（win32 以外）・`rename`・`rm` だけを使う。

## 起動確認（smoke）

```
{"ts":"2026-09-26T13:57:54.026Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:38648
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: <一時的な state-dir の token。直後に削除済み。記録から伏せた>
wtm: deleted session smoke (/tmp/tmp.1Y3mvFWZkP/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

## 未検証の穴（skip / 環境不足）

- Windows・WSL2 以外の実機で `FsSessionStore` の置き換え（`rename`）を動かしていない。Windows で置き換え先を別のハンドルが開いていると
  EPERM 等になりうる（推測。decisions D7）。
- load average がコア数の約 3 倍（この機械で 35〜40）を超えると、`main.integration.test.ts` の `--follow`・watch はまだ時間切れになりうる（上の post2C-6）。
- 別のプロセスの `wtmctl` 同士が同時に保存したときの後勝ち（別の接続先の 1 件が消える）は直していない（D2）。
- E2E（`packages/e2e`）は走らせていない（依頼の範囲外）。E2E の `support/freePort.ts` と `smoke.ts` 2 本は「番号だけ取って後で待ち受ける」形のまま。
- 修正前の比較は、別のセッションの負荷が今より低い時間帯に取った。修正後の実行のほうが load average が高い（それでも通った）ので、比較は
  修正後に不利な向きに偏っている。
