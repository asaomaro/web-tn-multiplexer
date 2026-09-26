# タスク: `wtmctl agent start`

## 実装方針
design の「対象範囲」を、型（protocol）→ サーバの純関数 → サーバの予約と名前付け → サーバの起動（RPC）→ CLI → 結合テスト・smoke → docs の順に積む。
各タスクは新しいテストファイルでそのタスクの AC を確かめ、既存のテストファイル（`*.test.ts`）は書き換えない（research「実装時の注意」）。smoke（`smoke.ts`）はテストファイルではなく起動確認の本体なので足してよい。

## 作業順序と依存関係
- 下の `依存:` に従う。T2（実物のシェルでのクォートの確認）は安全面の核なので、T4（書き込み）より先に済ませ、見立てが外れたら design に戻る。

## リスク / 留意点
- 結合テスト（T6）は実 PTY・実際の検出（3 秒の猶予）を待つので重い。1 ファイルにまとめ、明示の長いタイムアウトを付ける。高負荷で落ちるときは backlog の既知の種類かを見分ける。
- `SessionService.ts`・`cliArgs.ts` は prettier 未整形。`--write` は新規ファイルだけ。
- 並行 work が触る既存の結合テスト・`WsGateway.integration.test.ts` は触らない（D7）。

## テスト方針
- 単体（vitest）: 各純関数・kind の表と検出の対応・`AgentStarter`・RPC `agent.start`（フェイクの inspector・host・フェイクタイマー）・`SessionService` の予約・`StartWait`・`runAgentStart`（フェイクの client・フェイクタイマー）・cliArgs。
- 実物のシェル: bash・dash に行を標準入力で与え argv を比べる（T2）。
- 結合: 実サーバ・bash の pane と dash の pane・偽の `claude`（T6）。
- 負の確認: 足した箇所を 1 つずつ壊してテストが落ちることを test 工程で記録する。
- 全体: `pnpm -s build` → `pnpm -s typecheck` → `pnpm -s test` ×2・`aidev smoke`。

## タスク

- [x] T1: protocol に kind の表・timeout の範囲（`src/agentStart.ts`）、`AgentStartParams`/`AgentStartResult` と表への登録、エラー code、再輸出を足す（単体テスト `src/agentStart.test.ts`）
      対象: `packages/protocol/src/agentStart.ts`（新規）・`packages/protocol/src/messages.ts:459-470, 524-526, 583-585`・`packages/protocol/src/errors.ts:23-34`・`packages/protocol/src/index.ts` / 根拠: research A1
      依存: なし
      AC: AC5, AC15
- [x] T2: サーバの純関数（制御文字・クォート・シェル名・`checkShell`・`buildStartLine`・`startInput`）と単体テスト `agentStart.test.ts`、kind の表と検出の対応のテスト（同じファイル）、実物の bash・dash でのクォートの確認 `agentStart.shell.test.ts`
      対象: `packages/server/src/agent/agentStart.ts`（新規）・`packages/server/src/agent/agentInput.ts` `pastePayload`・`packages/server/src/agent/agents.ts` `AGENTS`/`lookupAgentKind` / 根拠: research A2・A5
      依存: T1
      AC: AC5, AC6, AC7, AC9, AC11
- [x] T3: `SessionService` に名前の予約（`assertAgentNameAvailable`・`beginAgentLaunch`・`endAgentLaunch`・`hasAgentLaunch`）と、新しい検出を反映するときの名前付けを足し、`renameAgent` の検査を共有する（単体テスト `SessionService.agentLaunch.test.ts`）
      対象: `packages/server/src/session/SessionService.ts:888-951` `updatePaneRuntime`・`renameAgent` / 根拠: research A4
      依存: T1
      AC: AC3, AC4
- [x] T4: `AgentStarter`（検査の順・前面の確認と上限・予約・書き込み・締め切り）と単体テスト `AgentStarter.test.ts`
      対象: `packages/server/src/agent/AgentStarter.ts`（新規） / 根拠: research A3・A5
      依存: T2, T3
      AC: AC3, AC4, AC5, AC6, AC8, AC9, AC11, AC15
- [x] T5: RPC `agent.start` の登録・`MethodDeps.agentStarter?`・`composeServer` の組み立てと単体テスト `surface/methods/agentStart.test.ts`
      対象: `packages/server/src/surface/methods/agent.ts:57`・`packages/server/src/surface/methods/deps.ts`・`packages/server/src/composeServer.ts:185-191` / 根拠: research A3
      依存: T4
      AC: AC8
- [x] T6: CLI の `agent start` の引数の解釈（`--` の分割・`Command`・USAGE）と単体テスト `cliArgs.agentStart.test.ts`
      対象: `packages/cli/src/cliArgs.ts:18-37, 40-80, 332` `parseAgent` / 根拠: research A6
      依存: T1
      AC: AC5, AC15
- [x] T7: CLI の `StartWait`（判定）・`runAgentStart`（再試行と待ち合わせ）・help と振り分けと単体テスト `agentStartWait.test.ts`・`commands/agentStart.test.ts`
      対象: `packages/cli/src/agentStartWait.ts`（新規）・`packages/cli/src/commands/agentStart.ts`（新規）・`packages/cli/src/main.ts` / 根拠: research A6
      依存: T6
      AC: AC12, AC13, AC14, AC16
- [x] T8: 結合テスト（実サーバ・bash と dash の pane・偽の `claude`・打ちかけ・悪意のある引数・busy）と cli の smoke に `agent start` の配線の確認を足す
      対象: `packages/cli/src/agentStart.integration.test.ts`（新規）・`packages/cli/src/smoke.ts:159-184` / 根拠: research A7・A8
      依存: T5, T7
      AC: AC1, AC2, AC7, AC8, AC10
- [x] T9: `docs/wtmctl.md` に `agent start` を書き、`docs/herdr-parity.md` の H39 を更新する
      対象: `docs/wtmctl.md`・`docs/herdr-parity.md:72` / 根拠: research F1.10
      依存: T7
      AC: AC17
