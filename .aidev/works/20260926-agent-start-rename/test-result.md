# テスト結果: エージェントの名前（`wtmctl agent rename` と名前による対象指定）

## 実行したもの

- `pnpm -s build` — exit 0
- `pnpm -s typecheck` — exit 0（build の後）
- `pnpm -s test` 1 回目 — exit 0: 185 files / **3711 passed** / 0 failed
- `pnpm -s test` 2 回目 — exit 1: 3710 passed / 1 failed（`composeServer.integration.test.ts` の `listen EADDRINUSE`。backlog「単体・結合テストが高負荷のときだけ落ちる」の (3)。下の「失敗の証跡」）
  → 当該ファイル単独で 3 回 exit 0 → 全体を流し直し
- `pnpm -s test` 3 回目 — exit 1: 3708 passed / 3 failed（`App.test.ts` の 5000ms タイムアウト 2 件＝同 (4)、`composeServer.integration.test.ts` のイベント待ちのタイムアウト 1 件＝同 (5) のファイル。load average 20 前後）
  → 両ファイル単独で各 3 回 exit 0 → 流し直し
- `pnpm -s test` 4 回目 — exit 1: 3708 passed / 3 failed（`cli/src/main.integration.test.ts` 2 件＝同 (1) のファイル、`App.test.ts` 1 件＝同 (4)。load average 12〜25。別 worktree の vitest が同時に走っていた）
  → `main.integration.test.ts` 単独で 3 回 exit 0 → 流し直し
- `pnpm -s test` 5 回目 — exit 0: 185 files / **3711 passed** / 0 failed
- → **全体で 2 回（1 回目・5 回目）通過**。落ちたのはどれも backlog の「高負荷のときだけ落ちる」に挙がっている種類のファイル（空きポートの衝突・既定 5000ms のタイムアウト・イベント待ちのタイムアウト）で、本 work の変更（名前）とは無関係の経路。単独ではどれも 3 回とも通った。
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 足した判定・分岐を 33 通り（M1〜M33）＋型の網羅 1 通り（TC1）壊し、**34 通りとも検出**（下の「負の確認」）。
- `aidev smoke` — pass（exit 0、3 本）。cli の smoke に `agent rename` → 名前で `agent get` → `--clear` → 名前が引けない・pane ID で引くと `name: null` を足した（T6。`.aidev/config.yml` は変更していない——既存の 2 本目 `pnpm --filter @wtm/cli run smoke` の中に足したため）。

## 受け入れ基準ごとの判定

- AC1: pass — `SessionService.agentName.test.ts`「名前を付けると…」・`agentRename.test.ts`（server・cli）の runAgentRename・smoke（ビルド済みの wtmctl で rename → `agent get smoke-agent` の name）。
- AC2: pass — `SessionService.agentName.test.ts`「null で外すと…」・cli `runAgentRename`「--clear は…」・smoke（`--clear` の出力 `name: null`・pane ID で引き直して `null`）。
- AC3: pass — `agentName.test.ts`（herdr と同じ例）・`SessionService.agentName.test.ts`「書式に外れる名前は…」・cli で `RpcFailure` がそのまま終了コード 1 に（`output.ts` の既存の規則）。
- AC4: pass — `SessionService.agentName.test.ts`「他のエージェントが使っている名前は…」「同じエージェントへの同じ名前の付け直し…」。
- AC5: pass — `agentTarget.test.ts`「エージェントの居ない pane・無い pane・誰も持たない名前は…」・`SessionService.agentName.test.ts`「pane が無い・エージェントが居ない…」・cli `agentRename.test.ts`「対象が見つからなければ…」・smoke（外した名前が `agent_not_found`・終了コード 1）。
- AC6: pass — `cliArgs.test.ts` の `parseArgs — agent rename`（6 通りの使用誤り）。
- AC7: pass — `agentTarget.test.ts`・cli `agentRename.test.ts` の「名前による対象指定」（get/wait/read/prompt/send-keys がそれぞれ解決した p2 と instanceId a2 で動く）・smoke（名前で `agent get`）。
- AC8: pass — `agentTarget.test.ts`「pane ID の pane にエージェントが居れば…優先」「居なければ名前として…」。
- AC9: pass — `agentStatus.test.ts`（`name`／`null`）・cli `agentRename.test.ts`（get・wait・prompt・rename の出力の name）。
- AC10: pass — `SessionService.agentName.test.ts` の「判定の周期をまたいだ引き継ぎ」（同じ instanceId で残る・別の instanceId／null で消える・戻っても戻らない・pane の close）。
- AC11: pass — cli（prompt/send-keys/rename が解決した instanceId を送る）・server（`renameAgent` の instanceId 照合、`agent.rename` が instanceId をそのまま渡す）。prompt/send-keys のサーバ側の照合は既存のテスト（`surface/methods/agent.test.ts`）。
- AC12: pass — `SessionService.agentName.test.ts`（名前を付ける・外す・付け替えで `pane.agent_status_changed`、変化が無ければ発行しない）。
- AC13: pass — `paneName.test.ts`・`Sidebar.test.ts`・`GotoPicker.test.ts`（名前と種類の両方で絞り込める）・`PanePicker.test.ts`（携帯の一覧）。
- AC14: pass — `docs/wtmctl.md`（コマンド一覧・「名前と `<target>`」・各コマンド・herdr との違い）・`docs/herdr-parity.md` の H39（T8 の点検 0 件）。
- AC15: pass — 既存の CLI・web・server のテストが通る。既存テストの変更は `agentStatus.test.ts` の期待値に `name: null` を 1 行足しただけ（出力に `name` が加わる以外は同じ）。`AgentInfo` のリテラルを持つ既存のテスト（名前の項目を持たない）はそのまま型検査・実行が通る。

## 失敗の証跡

### 全体 2 回目（`pnpm -s test` exit 1）
```

     × close() は開いたままのスクロールバックのエディタの一時ディレクトリを消す（20260926-edit-scrollback の AC8） 1098ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > close() は開いたままのスクロールバックのエディタの一時ディレクトリを消す（20260926-edit-scrollback の AC8）
Error: listen EADDRINUSE: address already in use 127.0.0.1:38470
 Test Files  1 failed | 184 passed (185)
      Tests  1 failed | 3710 passed (3711)

```

当該ファイルを単独で 3 回:
```

$ (cd packages/server && npx vitest run src/composeServer.integration.test.ts)  # 1 回目
      Tests  24 passed (24)

$ (cd packages/server && npx vitest run src/composeServer.integration.test.ts)  # 2 回目
      Tests  24 passed (24)

$ (cd packages/server && npx vitest run src/composeServer.integration.test.ts)  # 3 回目
      Tests  24 passed (24)

```

### 全体 3 回目（`pnpm -s test` exit 1）
```

{"ts":"2026-09-26T12:07:01.619Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:01.807Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:02.030Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:02.835Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:03.118Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:03.118Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:04.881Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:04.881Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:13.140Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:13.142Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:13.153Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:13.629Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:18.238Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:18.850Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:18.895Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:18.895Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:07:18.895Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
     × 実物の PTY で偽の 'claude' を起動すると、pane.agent_status_changed が kind='claude' で届く（02-agent-detection T10・AC6） 13575ms
     × authRequired なら LoginView 5271ms
     × ログイン画面の「接続中…」の間に接続の確認が 403（rejected）になったら、本体へ替えて理由を重ねて出す（D107：止めたままにしない） 5098ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > authRequired なら LoginView
Error: Test timed out in 5000ms.
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > ログイン画面の「接続中…」の間に接続の確認が 403（rejected）になったら、本体へ替えて理由を重ねて出す（D107：止めたままにしない）
Error: Test timed out in 5000ms.
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 実物の PTY で偽の 'claude' を起動すると、pane.agent_status_changed が kind='claude' で届く（02-agent-detection T10・AC6）
Error: timed out waiting for event pane.agent_status_changed
    730|       reject(new Error(`timed out waiting for event ${eventName}`));
 Test Files  2 failed | 183 passed (185)
      Tests  3 failed | 3708 passed (3711)

```

単独で各 3 回:
```

$ (cd packages/web && npx vitest run src/App.test.ts)  # 1 回目
      Tests  15 passed (15)

$ (cd packages/server && npx vitest run src/composeServer.integration.test.ts)  # 1 回目
      Tests  24 passed (24)

$ (cd packages/web && npx vitest run src/App.test.ts)  # 2 回目
      Tests  15 passed (15)

$ (cd packages/server && npx vitest run src/composeServer.integration.test.ts)  # 2 回目
      Tests  24 passed (24)

$ (cd packages/web && npx vitest run src/App.test.ts)  # 3 回目
      Tests  15 passed (15)

$ (cd packages/server && npx vitest run src/composeServer.integration.test.ts)  # 3 回目
      Tests  24 passed (24)

```

### 全体 4 回目（`pnpm -s test` exit 1）
```

{"ts":"2026-09-26T12:13:29.620Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:29.621Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:29.621Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:29.621Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:29.621Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:35.459Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:40.069Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:40.069Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:43.178Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:43.541Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:44.134Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:44.144Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:13:44.144Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
     × watch: 別クライアントが起こした workspace.created イベントを受け取る（AC6） 15142ms
     × login コマンド: --token で明示ログインし、別のセッションキャッシュへ書き込む（AC7 の前提） 2481ms
     × authRequired なら LoginView 5882ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > authRequired なら LoginView
Error: Test timed out in 5000ms.
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > watch: 別クライアントが起こした workspace.created イベントを受け取る（AC6）
Error: Test timed out in 15000ms.
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > login コマンド: --token で明示ログインし、別のセッションキャッシュへ書き込む（AC7 の前提）
SyntaxError: Unexpected non-whitespace character after JSON at position 360 (line 2 column 1)
 Test Files  2 failed | 183 passed (185)
      Tests  3 failed | 3708 passed (3711)

```

単独で 3 回:
```

$ (cd packages/cli && npx vitest run src/main.integration.test.ts)  # 1 回目
      Tests  8 passed (8)

$ (cd packages/cli && npx vitest run src/main.integration.test.ts)  # 2 回目
      Tests  8 passed (8)

$ (cd packages/cli && npx vitest run src/main.integration.test.ts)  # 3 回目
      Tests  8 passed (8)

```

### 全体 5 回目（`pnpm -s test` exit 0）
```

{"ts":"2026-09-26T12:19:20.371Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:20.373Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:20.374Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:20.374Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:26.290Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:26.291Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:26.292Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:30.567Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:30.874Z","level":"error","msg":"agent judgment failed","paneId":"p1","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:30.875Z","level":"error","msg":"agent judgment failed","paneId":"p2","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
{"ts":"2026-09-26T12:19:30.875Z","level":"error","msg":"agent judgment failed","paneId":"p3","error":"Error: processInspector.foregroundJob timed out after 2000ms"}
 Test Files  185 passed (185)
      Tests  3711 passed (3711)

```

## 負の確認（足した判定を 1 つずつ壊す）

`scratchpad` の `neg/sweep.py` が、1 か所を置き換え → 対応するテストファイルだけを vitest で走らせる → 元に戻して `cmp` で一致を確かめる、を 33 通り行った出力（そのまま）。
```

=== M1 packages/protocol/src/agentName.ts: '[a-z0-9_-]{0,31}$' -> '[a-z0-9_-]{0,32}$'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/protocol && npx vitest run src/agentName.test.ts
exit=1
     × 空・前後の空白・空白を含む・大文字・数字始まり・'.'・33 文字・改行は拒む 86ms
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M2 packages/protocol/src/agentName.ts: '/^[a-z][' -> '/^[a-z0-9]['
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/protocol && npx vitest run src/agentName.test.ts
exit=1
     × 空・前後の空白・空白を含む・大文字・数字始まり・'.'・33 文字・改行は拒む 126ms
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M3 packages/server/src/session/SessionService.ts: '&& pane.agent.instanceId === patch.agent.instanceId) {' -> '&& true) {'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
       × 別の instanceId（入れ替わり）には引き継がない（AC10） 50ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M4 packages/server/src/session/SessionService.ts: 'if (patch.agent && patch.agent.name === undefined' -> 'if (false && patch.agent && patch.agent.name === undefined'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
       × 同じ instanceId の更新（名前を知らない AgentTracker から）では名前が残り、状態の変化と一緒に届く（AC1・AC10） 108ms
       × 中身が同じ更新は、名前を引き継いだうえで発行しない 23ms
 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M5 packages/server/src/session/SessionService.ts: 'if (patch.agent && patch.agent.name === undefined' -> 'if (patch.agent && true'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
       × 名前を持つ更新は、前の名前で上書きしない 46ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M6 packages/server/src/session/SessionService.ts: '    a.since === b.since &&\n    a.name === b.name' -> '    a.since === b.since'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × 名前を付けると Pane.agent に載り、他のクライアントへ pane.agent_status_changed が届き、変更後の AgentInfo を返す（AC1・AC12） 108ms
     × null で外すと name の項目ごと消え、発行される（AC2・AC12） 32ms
     × 別の名前への付け替えも発行される 16ms
     × 書式に外れる名前は invalid_agent_name で何も変えない（AC3） 63ms
     × 他のエージェントが使っている名前は agent_name_taken で、どちらも変えない（AC4） 31ms
     × 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4） 16ms
     × エージェントが居なくなった pane の名前は一意性の検査に数えない（AC10） 16ms
       × 同じ instanceId の更新（名前を知らない AgentTracker から）では名前が残り、状態の変化と一緒に届く（AC1・AC10） 19ms
       × 中身が同じ更新は、名前を引き継いだうえで発行しない 75ms
       × pane が閉じると、その名前は一意性の検査に数えない（AC10） 33ms
 Test Files  1 failed (1)
      Tests  10 failed | 4 passed (14)
restored: cmp identical
=== M7 packages/server/src/session/SessionService.ts: 'if (!isValidAgentName(name)) throw' -> 'if (false) throw'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × 書式に外れる名前は invalid_agent_name で何も変えない（AC3） 108ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M8 packages/server/src/session/SessionService.ts: 'find((p) => p.id !== paneId && p.agent?.name === name)' -> 'find((p) => p.agent?.name === name)'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4） 61ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M9 packages/server/src/session/SessionService.ts: 'if (holder) throw' -> 'if (false) throw'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × 他のエージェントが使っている名前は agent_name_taken で、どちらも変えない（AC4） 60ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M10 packages/server/src/session/SessionService.ts: 'if (expectedInstanceId !== undefined && agent.instanceId !== expectedInstanceId) {' -> 'if (false) {'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × pane が無い・エージェントが居ない・instanceId が違うと agent_not_found で何も変えない（AC5・AC11） 107ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M11 packages/server/src/session/SessionService.ts: '    if (sameAgent(agent, next)) return agent;\n' -> ''
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4） 94ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M12 packages/server/src/session/SessionService.ts: 'if (name === null) delete next.name;' -> 'if (name === null) void 0;'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × null で外すと name の項目ごと消え、発行される（AC2・AC12） 70ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M13 packages/server/src/session/SessionService.ts: 'if (!agent) throw new RpcError("agent_not_found", `no agent detected in pane: ${paneId}`);' -> 'if (!agent) return undefined as never;'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/session/SessionService.agentName.test.ts
exit=1
     × pane が無い・エージェントが居ない・instanceId が違うと agent_not_found で何も変えない（AC5・AC11） 68ms
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M14 packages/server/src/surface/methods/agent.ts: 'deps.session.renameAgent(params.paneId, params.instanceId, params.name)' -> 'deps.session.renameAgent(params.paneId, undefined, params.name)'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/surface/methods/agentRename.test.ts
exit=1
     × paneId・instanceId・name をそのまま renameAgent へ渡し、変更後のエージェントを返す。端末には何も書かない（AC1・AC11） 102ms
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M15 packages/server/src/surface/methods/agent.ts: 'surface.register("agent.rename"' -> 'surface.register("agent.renamed" as "agent.rename"'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/server && npx vitest run src/surface/methods/agentRename.test.ts
exit=1
     × paneId・instanceId・name をそのまま renameAgent へ渡し、変更後のエージェントを返す。端末には何も書かない（AC1・AC11） 143ms
     × null は外す指定として渡し、instanceId の省略は undefined で渡す（AC2） 32ms
     × renameAgent の RpcError はその code のまま返る（AC5） 13ms
     × name の無い・文字列でも null でもない要求は invalid_params で、renameAgent を呼ばない 8ms
 Test Files  1 failed (1)
      Tests  4 failed (4)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M16 packages/cli/src/agentTarget.ts: '  if (byId?.agent) return { paneId: byId.id, tabId: byId.tabId, agent: byId.agent };\n' -> ''
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/agentTarget.test.ts
exit=1
     × pane ID でエージェントの居る pane を指せばその pane（AC7） 35ms
     × pane ID の pane にエージェントが居れば、同じ文字列の名前を持つ別のエージェントより優先する（AC8） 18ms
 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M17 packages/cli/src/agentTarget.ts: 'if (byId?.agent) return' -> 'if (byId && byId.agent !== undefined) return'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/agentTarget.test.ts
exit=1
     × pane ID の pane にエージェントが居なければ名前として解決する（AC8） 92ms
     × エージェントの居ない pane・無い pane・誰も持たない名前は agent_not_found（AC5） 16ms
 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M18 packages/cli/src/agentTarget.ts: 'if (named.length > 1) {' -> 'if (false) {'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/agentTarget.test.ts
exit=1
     × 同じ名前が 2 つ以上なら agent_target_ambiguous で候補を並べる（防御） 21ms
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M19 packages/cli/src/agentTarget.ts: 'if (byId) throw new RpcFailure("agent_not_found", `no agent detected in pane: ${target}`);' -> ''
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/agentTarget.test.ts
exit=1
     × エージェントの居ない pane・無い pane・誰も持たない名前は agent_not_found（AC5） 39ms
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M20 packages/cli/src/agentStatus.ts: 'name: agent.name ?? null,' -> 'name: null,'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/agentStatus.test.ts src/commands/agentRename.test.ts
exit=1
     × 名前があれば name に出し、無ければ null（20260926-agent-start-rename AC9） 63ms
     × agent get は名前のエージェントを pane ID・workspace・name つきで出す（AC7・AC9） 175ms
     × agent wait は名前で解決した pane の状態変化を待つ（AC7） 41ms
     × agent prompt は名前で解決した pane と instanceId で送る（AC7・AC11） 12ms
     × 名前で解決した pane と instanceId に agent.rename を送り、応答のエージェントを { agent } で出す（AC1・AC9・AC11） 5ms
 Test Files  2 failed (2)
      Tests  5 failed | 37 passed (42)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M21 packages/cli/src/commands/agent.ts: 'printJson({ ok: true, paneId });' -> 'printJson({ ok: true, paneId: cmd.paneId });'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/commands/agentRename.test.ts
exit=1
     × agent send-keys は名前で解決した pane と instanceId で送り、解決した pane ID を出す（AC7・AC11） 63ms
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M22 packages/cli/src/commands/agent.ts: 'const { paneId } = resolveAgentTarget(hello.snapshot, cmd.paneId);' -> 'resolveAgentTarget(hello.snapshot, cmd.paneId);\n    const paneId = cmd.paneId;'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/commands/agentRename.test.ts
exit=1
     × agent read は名前で解決した pane を購読して読み、購読を解除する（AC7） 1031ms
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M23 packages/cli/src/commands/agent.ts: '      name: cmd.name,\n' -> '      name: cmd.name === null ? "" : cmd.name,\n'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/commands/agentRename.test.ts
exit=1
     × --clear は name: null を送り、名前の無いエージェントは name: null で出る（AC2） 171ms
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M24 packages/cli/src/commands/agent.ts: '      instanceId: target.agent.instanceId,\n      name: cmd.name,' -> '      name: cmd.name,'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/commands/agentRename.test.ts
exit=1
     × 名前で解決した pane と instanceId に agent.rename を送り、応答のエージェントを { agent } で出す（AC1・AC9・AC11） 69ms
     × --clear は name: null を送り、名前の無いエージェントは name: null で出る（AC2） 16ms
 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M25 packages/cli/src/cliArgs.ts: '    if (clear) {\n      rejectExtra(positionals, 1, USAGE);' -> '    if (clear) {\n      rejectExtra(positionals, 2, USAGE);'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/cliArgs.test.ts
exit=1
     × 使い方の誤り: ["agent","rename","p1","reviewer","--clear"] 25ms
     × 使い方の誤り: ["agent","rename","p1","--clear","extra"] 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 102 passed (104)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M26 packages/cli/src/cliArgs.ts: 'const name = requirePositional(positionals, 1, "name (or --clear)", USAGE);' -> 'const name = positionals[1] ?? "";'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/cliArgs.test.ts
exit=1
     × 使い方の誤り: ["agent","rename","p1"] 10ms
 Test Files  1 failed (1)
      Tests  1 failed | 103 passed (104)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M27 packages/cli/src/cliArgs.ts: '    rejectExtra(positionals, 2, USAGE);\n    return { kind: "agent-rename"' -> '    return { kind: "agent-rename"'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli && npx vitest run src/cliArgs.test.ts
exit=1
     × 使い方の誤り: ["agent","rename","p1","reviewer","extra"] 6ms
 Test Files  1 failed (1)
      Tests  1 failed | 103 passed (104)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M28 packages/web/src/store/paneName.ts: 'pane.label || pane.agent?.name || pane.agent?.label' -> 'pane.label || pane.agent?.label'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/web && npx vitest run src/store/paneName.test.ts
exit=1
     × label が無ければ、エージェントの種類の表示名より先に agent rename で付けた名前（20260926-agent-start-rename AC13） 12ms
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M29 packages/web/src/store/paneName.ts: 'pane.label || pane.agent?.name || pane.agent?.label' -> 'pane.agent?.name || pane.label || pane.agent?.label'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/web && npx vitest run src/store/paneName.test.ts
exit=1
     × label が無ければ、エージェントの種類の表示名より先に agent rename で付けた名前（20260926-agent-start-rename AC13） 12ms
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M30 packages/web/src/components/Sidebar.vue: '<span v-if="agent.name" class="sidebar-agent-name">{{ agent.name }}</span>\n' -> ''
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/web && npx vitest run src/components/Sidebar.test.ts
exit=1
     × agent rename で付けた名前があれば、エージェントの種類の表示名の前に出す（20260926-agent-start-rename AC13） 39ms
 Test Files  1 failed (1)
      Tests  1 failed | 75 passed (76)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M31 packages/web/src/components/Sidebar.vue: '<span v-if="agent.name" class="sidebar-agent-name">' -> '<span class="sidebar-agent-name">'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/web && npx vitest run src/components/Sidebar.test.ts
exit=1
     × agent rename で付けた名前があれば、エージェントの種類の表示名の前に出す（20260926-agent-start-rename AC13） 30ms
 Test Files  1 failed (1)
      Tests  1 failed | 75 passed (76)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M32 packages/web/src/components/GotoPicker.vue: ' || textMatch(pane.agent?.label ?? "")' -> ''
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/web && npx vitest run src/components/GotoPicker.test.ts
exit=1
     × 名前（agent rename）の付いたエージェントの pane は、名前でもエージェントの種類の表示名でも引ける（20260926-agent-start-rename） 71ms
 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
=== M33 packages/web/src/mobile/PanePicker.vue: '{{ agent.name ? `${agent.name}（${agent.label}）` : agent.label }}' -> '{{ agent.label }}'
$ cd /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/web && npx vitest run src/mobile/PanePicker.test.ts
exit=1
     × agent rename で付けた名前があれば、種類の表示名と一緒に出す（20260926-agent-start-rename） 32ms
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: cmp identical
SUMMARY: M1=DETECTED M2=DETECTED M3=DETECTED M4=DETECTED M5=DETECTED M6=DETECTED M7=DETECTED M8=DETECTED M9=DETECTED M10=DETECTED M11=DETECTED M12=DETECTED M13=DETECTED M14=DETECTED M15=DETECTED M16=DETECTED M17=DETECTED M18=DETECTED M19=DETECTED M20=DETECTED M21=DETECTED M22=DETECTED M23=DETECTED M24=DETECTED M25=DETECTED M26=DETECTED M27=DETECTED M28=DETECTED M29=DETECTED M30=DETECTED M31=DETECTED M32=DETECTED M33=DETECTED

```

型の網羅（web のエラー文言の表が全 code を要求すること。taskcheck T1 の指摘の回帰）:
```

=== TC1 packages/web/src/net/clientError.ts: agent_name_taken の行を消す
$ (cd packages/web && npx vue-tsc --noEmit -p tsconfig.typecheck.json)
src/net/clientError.ts(13,7): error TS2741: Property 'agent_name_taken' is missing in type '{ invalid_params: string; unauthorized: string; not_found: string; spawn_failed: string; internal: string; not_a_git_repository: string; worktree_branch_in_use: string; worktree_path_exists: string; ... 14 more ...; not_attached: string; }' but required in type 'Record<ErrorCode, string>'.
exit=2
restored: cmp identical

```

## 起動確認（smoke）

```
$ aidev smoke

smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke(web): 初めてのブラウザで、はじめの案内が端末の表示のあとに開き、見出しにフォーカスがある
smoke(web): Esc で閉じると端末へフォーカスが戻り、案内済みだけが保存される
smoke(web): 開き直しても、はじめの案内は出ない
smoke(web): はじめの案内を閉じたあと、クリックせずに打った文字が PTY まで届いた
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/agent-start-rename/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-S7fp6c, sandboxed HOME /tmp/wtmctl-smoke-home-rqQwNm
{"ts":"2026-09-26T12:28:32.395Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:37850
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent rename ok (named, resolved by name, cleared)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: bO4VAu16HsYGT_xBI_mx3EHtRGbLWqxo
wtm: deleted session smoke (/tmp/tmp.RlIsNGiLwm/sessions/smoke)
smoke: pass (exit 0, 3 本)

```

## 未検証の穴（skip / 環境不足）

- 本物のエージェント（Claude Code・Codex 等）に名前を付けて、判定の周期をまたいで名前が残ること・終了で消えることは実機で確かめていない。
  サーバの単体テスト（`SessionService.agentName.test.ts`）で `AgentTracker` と同じ形の更新（名前を持たない同じ instanceId・別の instanceId・null）を
  与えて確かめ、smoke では検出を経ずに注入したエージェントで RPC と名前の解決の配線を確かめた。
- 検出が一時的に揺れた（前面のプロセスが一瞬見えない・`foregroundJob` のタイムアウト）ときに名前が消えるのは既知の違い（herdr は消さない）。
  既存の `instanceId` の作り直しの挙動に従う（requirements の「対象外」）。
- ブラウザでの表示（サイドバー・携帯の一覧・移動の候補・枠の見出し）はコンポーネントのテスト（happy-dom）だけで、実ブラウザ・E2E では見ていない（E2E は走らせない指示）。
- Windows（ConPTY）では走らせていない（名前は PTY に何も書かないので、OS に依存する経路は無い）。
