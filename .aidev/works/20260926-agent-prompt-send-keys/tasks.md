# タスク: エージェントへの prompt 送信と待ち合わせ（`wtmctl agent prompt [--wait]`・`agent send-keys`）

## 実装方針

design の層の順（protocol → server の純関数 → ミラー → `TerminalHost` → RPC → CLI → 結合テスト → docs）に組む。
`InputModes` の型は `packages/server/src/terminal/Mirror.ts` に置き、`agent/agentInput.ts` がそれを import する
（terminal が agent に依存する向きを作らない）。時間に依存するテスト（300ms・5000ms・`--timeout`）はフェイクタイマーで書く。
各タスクで、足した振る舞いを 1 つずつ壊して対応するテストが落ちることを確かめ（`.aidev/conventions/regression-negative-control.md`）、
生の出力を scratchpad に残して test 工程で test-result.md に移す。

## 作業順序と依存関係

- 下の `依存:` に従う（server は T2 → T3 → T4 → T5）。T4（`TerminalHost` の後回し）が最も不確実（xterm の非同期な flush と
  フェイクタイマーの組み合わせ）なので、RPC（T5）を書く前に T4 の単体テストで振る舞いを固める。

## リスク / 留意点

- `TerminalHost`・`Mirror` のインタフェースに足すメソッドは、テスト用の偽物（research F4）にも足す必要がある。
- 既存の `write` の同期性（モード付き入力が無いとき即座に書く）を壊さない。
- `SessionService` 本体は並行の別 work が触るので変更しない（読むだけ）。テストの `session/SessionService.test.ts` は偽の
  `TerminalHost` に `writeModal` を 1 つ足すだけにする（T4。偽物のクラスの中の数行に閉じるので、衝突しても解消は小さい）。
- 結合テストは実 PTY・実検出（3 秒の猶予・500ms 周期）に依存するので、待ちに十分な猶予（数十秒）を取る。

## テスト方針

- 単体: `agentInput.test.ts`（包み方・キー名・符号化の表）、`Mirror.test.ts`（flush 後のモード）、`TerminalHost.test.ts`
  （偽 PTY＋フェイクタイマーで遅延・後回し・終了時の reject）、`surface/methods/agent.test.ts`（RPC のエラーと書き込みの有無・
  `ControlSurface.invoke` 経由のスキーマ検証）、`cliArgs.test.ts`、`agentStatus.test.ts`（`PromptWait`）、`commands/agent.test.ts`
  （偽クライアント＋フェイクタイマーで活動の確認・stalled・timeout・消失・境目）、`clientError.test.ts`。
- 結合: `agent.integration.test.ts` に偽のエージェント（AC13）。
- 負の確認: 各タスクで足した分岐・定数を 1 つずつ壊し、落ちることを確かめる（生の出力を残す）。
- test 工程: `pnpm -s build` → `pnpm -s typecheck` → `pnpm -s test` を 2 回 → `aidev smoke`。E2E は走らせない。

## タスク

- [x] T1: protocol に RPC 2 つ（引数・結果の型、本文の 1MB 上限）とエラー code 5 つを足す
      対象: `packages/protocol/src/messages.ts:400-500`・`packages/protocol/src/errors.ts:2-22` / 根拠: research A5（web の表は T12）
      依存: なし
      AC: AC12
- [x] T2: server の純関数 `agentInput.ts`（`pastePayload`・`parseKey`・`encodeKey`・`AGENT_PROMPT_SUBMIT_DELAY_MS`）とテスト
      対象: `packages/server/src/agent/agentInput.ts`（新規）・`agentInput.test.ts`（新規）、`InputModes` の型（型だけ）を `packages/server/src/terminal/Mirror.ts:25-47` に足す（メソッドは T3） / 根拠: research A1
      依存: なし
      AC: AC1, AC10, AC11
- [x] T3: `Mirror` に `inputModes()`・`flush()` を足し、テストと偽物（`OutputFanout.test.ts:7`・`AgentMonitor.test.ts:17`）を追従させる
      対象: `packages/server/src/terminal/Mirror.ts:25-47, 132-142`・`Mirror.test.ts` / 根拠: research A1・A3
      依存: T2
      AC: AC1
- [x] T4: `TerminalHost.writeModal`（flush → モード → 部分ごとに遅延を置いて書く）と送信中の後回し・終了時の reject、単体テストと偽物の追従
      対象: `packages/server/src/terminal/TerminalHost.ts:8-19, 80-106`・`TerminalHost.test.ts`（新規）・`GitInfoPoller.test.ts:17`・`AgentMonitor.test.ts:56`・`SizeAuthority.test.ts:16`・`surface/methods/index.test.ts:51`・`session/SessionService.test.ts:21` / 根拠: research A2・A3（偽物は `grep -rn "implements TerminalHost"` で 5 つ）
      依存: T3
      AC: AC1, AC2, AC3
- [x] T5: RPC `agent.prompt`・`agent.send_keys` のハンドラと登録、`ControlSurface` 経由のテスト
      対象: `packages/server/src/surface/methods/agent.ts`（新規）・`agent.test.ts`（新規）・`packages/server/src/surface/methods/index.ts` / 根拠: research A4
      依存: T1, T2, T4
      AC: AC4, AC5, AC10, AC11, AC12
- [x] T6: CLI の引数解釈（`agent prompt`・`agent send-keys`・`USAGE`）とテスト
      対象: `packages/cli/src/cliArgs.ts` の `USAGE`・`Command`・`parseAgent`・`cliArgs.test.ts` / 根拠: research A7
      依存: なし
      AC: AC9, AC11
- [x] T7: CLI の実行（`runAgentPrompt`・`runAgentSendKeys`）と `main.ts` の分岐・ヘルプ、偽クライアントでの単体テスト
      対象: `packages/cli/src/commands/agent.ts`・`commands/agent.test.ts`・`packages/cli/src/main.ts:31-39, 78-85` / 根拠: research A7
      依存: T1, T6, T11
      AC: AC4, AC6, AC7, AC8, AC9, AC10, AC12
- [x] T8: 偽のエージェント（bracketed paste を有効にする node スクリプトを `exec -a claude` で起動）での結合テスト
      対象: `packages/cli/src/agent.integration.test.ts:1-120` / 根拠: research A8・F8・F9
      依存: T5, T7
      AC: AC13
- [x] T9: 利用者向けの説明と herdr との対応表の更新
      対象: `docs/wtmctl.md`・`docs/herdr-parity.md` の H39 行
      依存: T7
      AC: AC14
- [x] T10: build・typecheck・全体テスト 2 回・smoke の確認と、各タスクの負の確認の生の出力を scratchpad から test-result.md へ移す
      （test 工程で消化する。coding で消化しない理由は decisions.md D5）
      対象: リポジトリ全体（コマンドの実行のみ）
      依存: T1, T2, T3, T4, T5, T6, T7, T8, T9, T11, T12, T13
      AC: AC15
- [x] T11: CLI の活動の確認の判定 `PromptWait`（と `PROMPT_EFFECT_TIMEOUT_MS`）とテスト
      対象: `packages/cli/src/agentStatus.ts` の `statusOf`・`judgeWait` の隣・`agentStatus.test.ts` / 根拠: research A7
      依存: なし
      AC: AC6, AC8, AC9
- [x] T12: web のエラー文言の表に新しい code 5 つを足し、汎用の文言でないことをテストする
      対象: `packages/web/src/net/clientError.ts:13-38`・`clientError.test.ts` / 根拠: research A6
      依存: T1
      AC: AC12
- [x] T13: 起動確認（`pnpm --filter @wtm/cli run smoke`）に `agent send-keys`・`agent prompt` を足す（ビルド済みの RPC までの配線）
      対象: `packages/cli/src/smoke.ts:100-106`
      依存: T5, T7
      AC: AC15

