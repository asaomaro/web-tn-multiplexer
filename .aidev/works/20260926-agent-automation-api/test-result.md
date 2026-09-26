# テスト結果: エージェント自動化 CLI（`wtmctl agent list / get / wait / read`）

## 実行したもの
- `pnpm -s build` — exit 0
- `pnpm -s typecheck` — exit 0（終了コードで判定）
- `pnpm -s test`（全体）— 6 回実行。1・3・5・6 回目は 3150 passed / 0 failed。2・4 回目は変更していない
  `packages/web` の既存テスト 1 件が 5000ms の時間切れで失敗（下記「失敗の証跡」）。**最後の 2 回（5・6 回目）は
  連続で全件合格**。作業前の予備実行（0 回目。点検用のサブエージェントが並行して vitest を回していた時）では
  変更していない `packages/server` の既存テスト 2 件が時間の比較で失敗した。
- `npx vitest run`（`packages/cli` 単体）— 15 files / 207 passed / 0 failed（別に 3 回、agent の単体＋結合を
  繰り返して 30 passed ×3）
- `aidev smoke` — pass（exit 0, 2 本）
- 負の確認（足した箇所を 1 つずつ壊す。20 通り＋ラウンド 2 で 2 通り）— 22 通りとも該当テストが落ち、戻して `cmp` 一致
- `npx eslint --ext .ts packages/cli/src` — 新規・変更ファイルの指摘 0 件（`ansiStrip.ts` の既存の 2 件のみ。本 work では触っていない）

最後の 2 回（5・6 回目）と 1 回目の要約（出力をそのまま）:

```
$ pnpm -s test   # 1 回目
 Test Files  165 passed (165)
      Tests  3150 passed (3150)
$ pnpm -s test   # 5 回目
 Test Files  165 passed (165)
      Tests  3150 passed (3150)
$ pnpm -s test   # 6 回目
 Test Files  165 passed (165)
      Tests  3150 passed (3150)
```

## 受け入れ基準ごとの判定
- AC1: pass — `commands/agent.test.ts`「エージェントの居る pane だけを…」「1 件も無ければ空の一覧」、結合テスト
  `agent.integration.test.ts`「list: エージェントの居る pane だけを出す」（実サーバで注入した pane だけが workspaceId つきで出る）。
- AC2: pass — `agentStatus.test.ts` の `statusOf`（idle かつ未読の完了 → done・既読 → idle・working 等はそのまま）、
  `runAgentGet` の `{ agent }` の形。負の確認 M1。
- AC3: pass — `judgeWait`/`resolveUntil`（既定で idle/done/blocked は match、working/unknown は pending）、
  「呼び出し時点で一致していれば、イベントを待たずに返す」。負の確認 M2。
- AC4: pass — 結合テスト「wait: 待ち始めた後の状態変化のイベントで done として返る」（hello 完了を観測してから
  `session.updatePaneRuntime` で idle に変える。hello の包みがコールバックを渡さない形にすると時間切れで落ちることを
  coding 中に確認〔decisions.md D9 の周辺〕）。`--until` の複数指定は単体テスト。応答と同じ受信の塊のイベント・
  応答より前の古いイベントの扱いは単体テスト（負の確認 M11・M12・M13・M16）。
- AC5: pass — 偽タイマーで `--timeout 1000` は 1000ms で `timeout`（999ms では返らない）、省略時はタイマー 0 個で
  60 秒進めても返らない（既存の RPC 上限 10 秒より長い）。一致時にタイマーを解除する。負の確認 M8・M9。
- AC6: pass — null・instanceId 違い・`pane.closed` で `agent_not_running`（単体）、結合テストで null を注入して
  `agent_not_running`。負の確認 M3・M7。
- AC7: pass — `lastLines`（末尾の空行を捨てる・最後の N 行・`\r\n`）、`runAgentRead`（既定で ANSI 除去・80 行・
  解除する／`--raw`・`--lines`／SNAPSHOT が来なければ `timeout`）、結合テストで実 PTY に `echo` した文字列が出る。
  負の確認 M4・M5・M14・M15・M20。
- AC8: pass — pane 無し・エージェント無しで `agent_not_found`（get/wait/read、read は購読もしない）、`cliArgs.test.ts` の
  使い方の誤り 15 通り（未知の `--until`・不正な `--timeout`/`--lines`・引数の過不足・未知のサブコマンド）。
  負の確認 M6・M18・M19。
- AC9: pass — `git diff --stat main...HEAD -- packages/server packages/protocol packages/web`・同じ範囲の作業ツリーの
  差分・未追跡ファイルのいずれも空（出力 0 バイト）。4 コマンドとも `withSession` を通る（単体テストで
  `withSession` のモックが `(OPTS, store, fn)` で呼ばれることを確認）。
- AC10: pass — build / typecheck / test（5・6 回目が連続で全件合格）/ smoke。
- AC11: pass — `docs/wtmctl.md`（新規）と `docs/herdr-parity.md` の H39 行を更新。backlog の分割は deliver 工程で行う。

## 負の確認（regression-negative-control）

`packages/cli` の足した箇所を 1 つずつ書き換えて該当テストを走らせ、元に戻して `cmp` で一致を確かめた
（`scratchpad/agent-automation-api/mutate.py`。出力をそのまま貼る）:

```
### M1 done の規則（> を >= に）（src/agentStatus.ts）→ vitest exit=1
         × idle で既読なら idle 49ms
         × until に done だけを指定すると、既読の idle では pending・未読なら match 14ms
     Test Files  1 failed (1)
          Tests  2 failed | 19 passed (21)
    restored: cmp 一致
### M2 既定の until から done を外す（src/agentStatus.ts）→ vitest exit=1
         × 空なら既定の idle/done/blocked 109ms
         × 既定では idle（completionSeq=1, seen=0）で match 34ms
     Test Files  1 failed (1)
          Tests  2 failed | 19 passed (21)
    restored: cmp 一致
### M3 入れ替わり（instanceId 違い）を gone にしない（src/agentStatus.ts）→ vitest exit=1
         × instanceId が違う（入れ替わった）なら、状態が一致していても gone 21ms
         × 別のエージェントに入れ替わる（instanceId が違う） と agent_not_running 27ms
     Test Files  2 failed (2)
          Tests  2 failed | 44 passed (46)
    restored: cmp 一致
### M4 lastLines が末尾の空行を捨てない（src/agentStatus.ts）→ vitest exit=1
         × 末尾の空行（空白だけ・ANSI だけの行を含む）は数えない 14ms
         × \r\n を区切りとして扱い、\n でつなぐ 3ms
         × 既定は ANSI を除去し、末尾の空行を除いた最後の 80 行を出して、購読を解除する 102ms
     Test Files  2 failed (2)
          Tests  3 failed | 43 passed (46)
    restored: cmp 一致
### M5 lastLines が先頭の n 行を返す（src/agentStatus.ts）→ vitest exit=1
         × 最後の n 行を返す 14ms
         × 末尾の空行（空白だけ・ANSI だけの行を含む）は数えない 2ms
         × \r\n を区切りとして扱い、\n でつなぐ 2ms
         × 既定は ANSI を除去し、末尾の空行を除いた最後の 80 行を出して、購読を解除する 74ms
         × --lines と --raw 54ms
     Test Files  2 failed (2)
          Tests  5 failed | 41 passed (46)
    restored: cmp 一致
### M6 エージェントの居ない pane を agent_not_found にしない（src/commands/agent.ts）→ vitest exit=1
         × エージェントが居ない なら agent_not_found 14ms
         × エージェントが居ない なら agent_not_found 2ms
         × エージェントが居ない なら agent_not_found で、購読もしない 5002ms
     Test Files  1 failed (1)
          Tests  3 failed | 22 passed (25)
    restored: cmp 一致
### M7 pane.closed で agent_not_running にしない（src/commands/agent.ts）→ vitest exit=1
         × pane が閉じる と agent_not_running 5016ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M8 --timeout 省略時もタイマーを張る（src/commands/agent.ts）→ vitest exit=1
         × --timeout を省略すると時間切れのタイマーを持たない（RPC の上限 10 秒より長く待っても返らない） 14ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M9 終わるときにタイマーを解除しない（src/commands/agent.ts）→ vitest exit=1
         × 一致したらタイマーを解除する 15ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M10 pane.updated で tabId を追わない（src/commands/agent.ts）→ vitest exit=1
         × pane が別の tab へ移ったら、出力の tabId/workspaceId を移動後の値にする 17ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M11 hello の後で onEvent を登録する（修正前の形）（src/commands/agent.ts）→ vitest exit=1
         × hello の応答と同じ受信の塊で直後に届いたイベントも取りこぼさない 1012ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M12 hello より前から購読する（src/commands/agent.ts）→ vitest exit=1
         × hello の応答より前に届いた（snapshot より古い）イベントでは判定しない 15ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M13 EventFeed が溜めた分を渡さない（src/commands/agent.ts）→ vitest exit=1
         × hello の応答と同じ受信の塊で直後に届いたイベントも取りこぼさない 1011ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M14 agent read が ANSI を除かない（src/commands/agent.ts）→ vitest exit=1
         × 既定は ANSI を除去し、末尾の空行を除いた最後の 80 行を出して、購読を解除する 96ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M15 agent read が購読を解除しない（src/commands/agent.ts）→ vitest exit=1
         × 既定は ANSI を除去し、末尾の空行を除いた最後の 80 行を出して、購読を解除する 95ms
     Test Files  1 failed (1)
          Tests  1 failed | 24 passed (25)
    restored: cmp 一致
### M16 WsWtmClient が応答時に購読を加えない（src/wsClient.ts）→ vitest exit=1
         × 応答より前のイベントは渡さず、応答と同じ同期区間で直後に届いたイベントは渡す 509ms
     Test Files  1 failed (1)
          Tests  1 failed | 3 passed (4)
    restored: cmp 一致
### M17 pane read が表示より先に購読を解除する（src/commands/pane.ts）→ vitest exit=1
         × --follow 無しでは、SNAPSHOT を表示してから unsubscribe する（解除の応答を待たずに表示する） 116ms
     Test Files  1 failed (1)
          Tests  1 failed | 10 passed (11)
    restored: cmp 一致
### M18 --until の繰り返しを集めない（最後の 1 つだけ）（src/cliArgs.ts）→ vitest exit=1
         × wait: --until を繰り返すと順に集める・--timeout は正の整数 19ms
     Test Files  1 failed (1)
          Tests  1 failed | 72 passed (73)
    restored: cmp 一致
### M19 --until の値を検査しない（src/cliArgs.ts）→ vitest exit=1
         × 使い方の誤り: ["agent","wait","p1","--until","finished"] 6ms
     Test Files  1 failed (1)
          Tests  1 failed | 72 passed (73)
    restored: cmp 一致
### M20 agent read の既定の行数を 80 以外にする（src/cliArgs.ts）→ vitest exit=1
         × read: 既定は 80 行・raw 無し・timeout 5000 15ms
     Test Files  1 failed (1)
          Tests  1 failed | 72 passed (73)
    restored: cmp 一致
```

結合テストが本当にイベント経由の一致を通っていることの確認（coding 中。`agent.integration.test.ts` の hello の包みを
`hello()`〔コールバックを渡さない〕に一時的に変えて走らせ、戻して `cmp` 一致を確認）:

```
$ npx vitest run src/agent.integration.test.ts
     × wait: 待ち始めた後の状態変化のイベントで done として返る（AC4） 10036ms
     × wait: 待っている間にエージェントが居なくなると agent_not_running（AC6） 10045ms
      Tests  2 failed | 3 passed (5)
```

## 失敗の証跡

coding への差し戻しは発生していない（本 work のコードに起因する失敗は無い）。全体実行で観測した失敗は、
いずれも本 work で変更していないパッケージ（`packages/web`・`packages/server`）の既存テストで、マシンの負荷が高い
（load average 14〜24。並行する別 work と点検のサブエージェントが同じマシンで動いていた）ときの時間切れ・時間の比較。
同じテストは他の回では合格している。

2 回目（`packages/web`）:

```
 FAIL  |@wtm/web| src/App.test.ts > App — pane の描画 > デスクトップは pane の枠を描き、枠の右クリックで（「pane に送る」にした pane でも）pane のメニューが開く
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/App.test.ts:172:3
    170|
    171|   /** D110（design M7 の後半）：デスクトップは pane ごとに枠を描き、枠の右クリックは `rightClick: '…
    172|   it("デスクトップは pane の枠を描き、枠の右クリックで（「pane に送る」にした pane でも）pane のメニューが開く"…
       |   ^
    173|     const session = useSessionStore(pinia);
    174|     const view = useViewStore(pinia);
```

4 回目（`packages/web`）:

```
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > ログイン画面の「接続中…」の間に接続の確認が 403（rejected）になったら、本体へ替えて理由を重ねて出す（D107：止めたままにしない）
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/App.test.ts:128:3
    126|   });
    127|
    128|   it("ログイン画面の「接続中…」の間に接続の確認が 403（rejected）になったら、本体へ替えて理由を重ねて出す（D107：止め…
       |   ^
    129|     const view = useViewStore(pinia);
    130|     const wrapper = mount(App, makeProvide(makeConnection()));
```

0 回目（予備実行・`packages/server`）:

```
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 保存した session.json の tab は並べ替えた順（workspace の tabIds の順）
AssertionError: expected [ 't2' ] to deeply equal [ 't3', 't2' ]

- Expected
+ Received

  [
-   "t3",
    "t2",
  ]

 ❯ src/composeServer.integration.test.ts:366:88
    364|     await server.persist.flush();
    365|     const saved = JSON.parse(await readFile(join(stateDir, "session.js…
    366|     expect(saved.workspaces.find((w) => w.id === workspace.id)!.tabs.m…
       |                                                                                        ^
    367|   }, 10000);
    368|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > workspace.create は、実際の git リポジトリなら定期ポーリング（5秒）を待たずに Workspace.git が埋まる（20260925-workspace-git-immediate。AC1・AC3）
AssertionError: expected 2091 to be less than 2000
 ❯ src/composeServer.integration.test.ts:520:24
    518|     // ここでは「明らかに `GIT_TIMEOUT_MS`〔3000ms〕級の遅延でブロックしていないか」という
    519|     // 粗い確認に留める。
    520|     expect(responseMs).toBeLessThan(2000);
       |                        ^
    521|
    522|     // AC1: 定期ポーリング（5秒周期）の間隔を待たずに Workspace.git が埋まることを、

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## 起動確認（smoke）

`packages/cli/src/smoke.ts` に `wtmctl agent list`（空の一覧になること）を足した（`.aidev/config.yml` は変えていない。
cli の smoke は既に 2 本目として登録済み）。

```
$ aidev smoke
smoke: 20260926-agent-automation-api
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38400 (state dir /tmp/wtm-smoke-aDIjs0)
{"ts":"2026-09-26T05:01:13.476Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/agent-automation-api/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-NrxrPd, sandboxed HOME /tmp/wtmctl-smoke-home-dTzDGO
{"ts":"2026-09-26T05:01:21.791Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:39166
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## ラウンド 2（review ラウンド 1 の差し戻し後）

review の指摘（alt screen の混入・`--timeout` の上限・docs）を直したあとに再実行した。`pnpm -s build`・`pnpm -s typecheck`
exit 0、`pnpm -s test` を 2 回連続で全件合格、`aidev smoke` pass。

```
$ pnpm -s test   # 7 回目
 Test Files  165 passed (165)
      Tests  3155 passed (3155)
$ pnpm -s test   # 8 回目
 Test Files  165 passed (165)
      Tests  3155 passed (3155)
$ aidev smoke（末尾）
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

追加の負の確認（M21・M22。出力をそのまま）:

```
### M21 alt screen の後ろだけを取らない（src/agentStatus.ts）→ vitest exit=1
         × alt screen が有効なら、最後の ESC[?1049h より後ろ（今の画面）だけ 11ms
         × alt screen のエージェントでは、通常画面の履歴を混ぜず今の画面だけを読む 75ms
     Test Files  2 failed (2)
          Tests  2 failed | 47 passed (49)
    restored: cmp 一致
### M22 --timeout の上限を検査しない（src/cliArgs.ts）→ vitest exit=1
         × 使い方の誤り: ["agent","wait","p1","--timeout","2147483648"] 13ms
     Test Files  1 failed (1)
          Tests  1 failed | 74 passed (75)
    restored: cmp 一致
```

このラウンドでは失敗が発生していない（差し戻しは review 起点で、test の失敗ではない）。

## 未検証の穴（skip / 環境不足）
- **実際のエージェント（Claude Code・Codex 等）での確認はしていない**。状態の遷移はサーバの `updatePaneRuntime` で
  注入して確かめた（検出〔`AgentMonitor`〕から `pane.agent_status_changed` が出るまでの経路は既存で、本 work では
  変えていない）。`docs/wtmctl.md` の例の「`pane input` で文字と CR を別々に送る」送り方も実際のエージェントでは未検証。
- 「応答と同じ受信の塊で直後に届くイベント」の取りこぼし対策は、偽の ws で同期に続けて配る形で確かめた。実ネット
  ワークでその並びを意図的に作る結合テストは無い（T4 の点検者が ws の実装と再現スクリプトで挙動を確認した）。
- E2E スイート（`packages/e2e`）は利用者の方針により走らせていない（本 work は web を変えていない）。
- Windows・macOS 実機での確認はしていない（CLI は OS 固有のコードを持たない）。

