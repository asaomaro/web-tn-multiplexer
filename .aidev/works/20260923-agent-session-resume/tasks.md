# タスク: サーバ再起動後のエージェント会話の再開

## 実装方針

design.md の層に沿って、下から上へ積む: protocol の型 → 永続化フォーマット → SessionModel →
resume コマンド解決・環境変数注入・report 受信（ここまでは互いに独立に並行可能）→
SessionService への結線 → RPC → composeServer の配線 → Web UI → ドキュメント反映。

## 作業順序と依存関係

下の `依存:` に従う。T5〜T9 は T1（protocol の型）にだけ依存し、対象ファイルが重ならないため
並行できる（`aidev-40-coding` の判定基準どおり）。T10 はそれらすべてを束ねる結線なので直列。

## リスク / 留意点

- Windows の named pipe・DACL 設定は、この開発環境では実機検証できない
  （既存の MVP と同じ「3 OS 検証は docs/verification.md の手動確認に回す」割り切りに従う）。
- hooks 設定ファイルの非破壊マージは、既存のフックを壊すと利用者の Claude Code/Codex 全体に
  影響するため、最も慎重にテストする（T9）。

## テスト方針

- 各モジュールは unit test（vitest）で検証する。E2E は対象外（既存方針
  [[e2e-only-on-request]] に従い、この work でも実施しない。ユーザーから明示の依頼があれば別途）。
- T9（フックの非破壊マージ）は、既存フックあり/なし/壊れたJSON の3パターンを網羅する。
- T10（`updatePaneRuntime` の拡張）は、既存の cwd 変化テストが回帰しないことを確認する。

## タスク

- [x] T1: protocol の型・RPC・イベントを追加する（`AgentIntegrationKind`・`AgentSessionRef`・
      `Pane.agentSession`・`AgentIntegrationStatusResult` 等・`METHOD_SCHEMAS`・`MethodResultMap`・
      `agentIntegration.changed` イベント）
      対象: `packages/protocol/src/model.ts`, `packages/protocol/src/messages.ts`,
      `packages/protocol/src/events.ts` / 根拠: design.md「インターフェース / データ構造」1・3
      依存: なし
      AC: AC1, AC2, AC5, AC7, AC-I1, AC-I2, AC-I3, AC-I4

- [x] T2: `SessionFilePane` に `agentSession` を追加する（zod スキーマ含む。schema 番号は据え置き。
      design D2）
      対象: `packages/server/src/persist/SessionFile.ts`
      依存: T1
      AC: AC1, AC2, AC7

- [x] T3: 自動再開設定の永続化（`IntegrationFile`）を新規実装する（`AuthFile.ts` と同じ
      アトミック書き込みパターン）
      対象: `packages/server/src/persist/IntegrationFile.ts`（新規） / 根拠: design.md「2. 自動再開の設定」
      依存: なし
      AC: AC-I4, AC7

- [x] T4: `SessionModel` に `agentSession` の保持・設定・組み立て・復元を足す
      （`makePane`・`restoreWorkspace`・新規 `setAgentSession(paneId, ref | null)`）
      対象: `packages/server/src/session/SessionModel.ts:139-155`（`makePane`）,
      `:528-562`（`restoreWorkspace`）
      依存: T1, T2
      AC: AC1, AC2, AC4, AC5

- [x] T5: resume コマンド解決テーブルを実装する（`kind` + `sessionId` → コマンド文字列。
      claude: `claude --resume <id>`、codex: `codex resume <id>`）
      対象: `packages/server/src/agent/agents.ts`（追記）または新規
      `packages/server/src/agent/resumeCommand.ts` / 根拠: research.md F1.2
      依存: T1
      AC: AC1, AC2

- [x] T6: pane 起動時に `WTM_PANE_ID`・`WTM_AGENT_REPORT_SOCKET` を環境変数として注入する
      対象: `packages/server/src/terminal/TerminalManager.ts:6-12`（`CreatePaneOptions.env`)、
      `packages/server/src/session/SessionService.ts:527-536`（`spawnForPane` の呼び出し引数）
      依存: なし
      AC: AC1, AC2, AC5

- [x] T7: ローカル report 受信（`AgentReportSocket`）を新規実装する（Unix socket / Windows
      named pipe、権限限定 D5、stale ファイル検出 D12、受信メッセージの検証）
      対象: `packages/server/src/agent/AgentReportSocket.ts`（新規） / 根拠: design.md「4. ローカル report 経路」
      依存: T1
      AC: AC1, AC2, AC5

- [x] T8: hook スクリプト本体（`agent-hook-report.cjs`）を作成する（env 未設定なら無害に exit、
      stdin JSON から `session_id` を読み、socket へ1行 JSON を送る）
      対象: `packages/server/assets/agent-hook-report.cjs`（新規） / 根拠: design.md「5. hook スクリプト」
      依存: なし
      AC: AC1, AC2

- [x] T9: `AgentIntegrationInstaller`（導入・解除・状態判定）を新規実装する（Claude Code の
      `settings.json`・Codex の `hooks.json` への非破壊マージ、フィンガープリントによる
      `installed` 判定 D4、`CLAUDE_CONFIG_DIR`/`CODEX_HOME` の尊重）
      対象: `packages/server/src/agent/AgentIntegrationInstaller.ts`（新規） / 根拠:
      design.md「6. フック登録の書式」「振る舞いの詳細・導入/解除」
      依存: T8
      AC: AC-I1, AC-I2, AC-I3

- [x] T10: `SessionService` へ結線する（`updatePaneRuntime` の `touch()` 条件に会話IDの変化を
      追加 D8、画面判定消失時に `agentSession` をクリア D9、`restorePaneProcess` で
      resume コマンドを投入 D10・D11）
      対象: `packages/server/src/session/SessionService.ts:462-484`（`updatePaneRuntime`）,
      `:612-620`（`restorePaneProcess`）
      依存: T4, T5, T6, T7
      AC: AC1, AC2, AC3, AC4, AC5, AC6

- [x] T11: RPC ハンドラ（`agentIntegration.status`/`install`/`uninstall`/`set_auto_resume`）と
      `MethodDeps` の拡張
      対象: `packages/server/src/surface/methods/agentIntegration.ts`（新規）,
      `packages/server/src/surface/methods/deps.ts`
      依存: T3, T9
      AC: AC-I1, AC-I2, AC-I3, AC-I4

- [x] T12: `composeServer` で配線する（`AgentReportSocket` の起動・`IntegrationFile` の読み込み・
      `registerAllMethods` への追加・pane 起動箇所への env 注入の結線・report 受信時に
      `SessionModel`/`persist.touch()` へ反映）
      対象: `packages/server/src/composeServer.ts:160-230` 付近
      依存: T7, T9, T11
      AC: AC1, AC2, AC5, AC7

- [x] T13: 設定画面 UI（「エージェント連携」節: 状態表示・導入/解除ボタン・自動再開トグル）を追加する
      対象: `packages/web/src/components/SettingsDialog.vue`（既存の「端末」節の次に追加。
      20260922-appearance-settings-rest・20260922-theme-custom-overrides と同じ節追加パターン）
      依存: T11
      AC: AC-I1, AC-I2, AC-I3, AC-I4, AC-I5

- [ ] T14: ドキュメントを反映する（`docs/herdr-parity.md` H32 行の更新、
      `.aidev/backlog/product-roadmap.md`「セッション永続化の拡張」行の分割、
      `docs/verification.md` への Windows 手動確認事項の追加）
      対象: `docs/herdr-parity.md`, `.aidev/backlog/product-roadmap.md`, `docs/verification.md`
      依存: T10, T13
      AC: なし
