# タスク: エージェント自動化 CLI（`wtmctl agent list / get / wait / read`）

## 実装方針

design.md のとおりコードは `packages/cli` だけを変える（ほかに docs と work の記録を書く）。判定を純粋関数（`agentStatus.ts`）に先に切り出して単体テストで
固め、次に引数解釈、`pane read` の読み取り部分の共有化、コマンド本体、配線、結合テスト、smoke、docs の順に積む。

## 作業順序と依存関係

下の `依存:` に従う。T3（`pane.ts` の関数の切り出し）は振る舞いを変えないリファクタで、既存の `pane.test.ts` が
そのまま通ることで確かめる（T4 より先に済ませ、`agent read` が同じ経路を使えるようにする）。

## リスク / 留意点

- 待ち合わせのテストで、イベントの配送（実サーバ）やタイマーを固定時間の `sleep` で見積もらない。
  結合テストは「待ちの接続が hello を終えたこと」を観測してから状態を変える（既存の `watch` のテストが
  一式実行でだけ落ちた経緯。20260923-external-control-api decisions.md D21）。
- `agent wait` の結合テストは待ちの接続を張り続けるので、専用のサーバを立てて最後に閉じる（後続テストの
  stdout 捕捉を汚さない。同 D21）。
- `pane.ts` の切り出しで `pane read --follow` の振る舞いを変えない。

## テスト方針

- 単体: `agentStatus.test.ts`（statusOf・resolveUntil・judgeWait・toAgentView・lastLines）、`cliArgs.test.ts`
  （agent の引数・誤り）、`commands/agent.test.ts`（偽クライアントでイベントを流す・偽タイマー）。
- 結合: `agent.integration.test.ts`（実サーバ・実 PTY。`session.updatePaneRuntime` でエージェントを注入）。
- 負の確認: 足した判定（done の規則・既定の until・gone の判定・pane.closed・時間切れ・末尾の空行・行数・
  agent_not_found）を 1 箇所ずつ壊してテストが落ちることを test 工程で確かめ、生の出力を test-result.md に貼る。
- 起動確認: `aidev smoke`（cli の smoke に `agent list` を 1 行足す）。
- AC9 のうち「`withSession` を通る」は T4 の単体テストで、「server/protocol/web に diff が無い」と AC10 は
  test 工程で確かめる（T9）。負の確認も test 工程で行う（T9）。

## タスク

- [x] T1: `agentStatus.ts`（`AgentStatus`・`AGENT_STATUSES`・`DEFAULT_UNTIL`・`statusOf`・`resolveUntil`・
      `AgentView`・`toAgentView`・`judgeWait`・`lastLines`）と単体テスト
      対象: `packages/cli/src/agentStatus.ts`（新規）・`packages/cli/src/agentStatus.test.ts`（新規）
      依存: なし
      AC: AC2, AC3, AC6, AC7
- [x] T2: `cliArgs.ts` に `agent list/get/wait/read` の解釈（`FlagSpec.multi` で `--until` の繰り返し）と USAGE、
      単体テスト
      対象: `packages/cli/src/cliArgs.ts` `parseArgs` `parseFlags` `Command`・`packages/cli/src/cliArgs.test.ts`
      依存: T1
      AC: AC8
- [x] T3: `pane.ts` から「subscribe → 最初の SNAPSHOT →（引数で）unsubscribe」を
      `readPaneSnapshot(client, paneId, scrollbackLines, timeoutMs, unsubscribe)` として export（hello は含まない。
      `runPaneRead` の振る舞いは変えない）
      対象: `packages/cli/src/commands/pane.ts` `waitForSnapshot` `runPaneRead`
      依存: なし
      AC: AC7
- [x] T4: `commands/agent.ts`（`runAgentList`・`runAgentGet`・`runAgentWait`・`runAgentRead`）と偽クライアントでの
      単体テスト
      対象: `packages/cli/src/commands/agent.ts`（新規）・`packages/cli/src/commands/agent.test.ts`（新規）
      依存: T1, T2, T3
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9
- [x] T5: `main.ts` の分岐とヘルプに agent コマンドを足す
      対象: `packages/cli/src/main.ts` `main` `printHelp`
      依存: T4
      AC: AC1
- [x] T6: 実サーバでの結合テスト（list／wait が状態変化のイベントで `done` として返る〔`--until` の複数指定は T4 の
      単体テストで扱う〕／エージェントを null にすると agent_not_running／read）。wait の接続は専用サーバに張り、
      状態を変えるのは待ちの接続が hello を終えたことを観測してから、最後にサーバごと閉じる
      対象: `packages/cli/src/agent.integration.test.ts`（新規）
      依存: T4
      AC: AC1, AC4, AC6, AC7
- [x] T7: cli の smoke に `wtmctl agent list` を足す（`.aidev/config.yml` は触らない）
      対象: `packages/cli/src/smoke.ts` `main`
      依存: T5
      AC: AC10
- [x] T8: 利用者向け docs（`docs/wtmctl.md` 新規：agent コマンドの使い方・herdr との違い・既知の限界）と
      `docs/herdr-parity.md` の H39 行
      対象: `docs/wtmctl.md`（新規）・`docs/herdr-parity.md:72`
      依存: T5
      AC: AC11
- [x] T9: （test 工程で消化）AC9 の `git diff --stat main...HEAD -- packages/server packages/protocol packages/web`
      が空であること、AC10 の build/typecheck/test ×2/smoke、テスト方針の負の確認（1 箇所ずつ壊して落ちる生の出力）を
      test-result.md に記録する
      対象: `.aidev/works/20260926-agent-automation-api/test-result.md`（test 工程）
      依存: T5, T6, T7
      AC: AC9, AC10
