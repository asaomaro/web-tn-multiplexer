# テスト結果: Claude Code・Codex 以外の6エージェントへセッション再開対応を広げる

## 実行したもの

- `pnpm --filter @wtm/protocol -s test` — 59 passed / 0 failed / 0 skipped
- `pnpm --filter @wtm/server -s test` — 684 passed / 0 failed / 0 skipped
- `pnpm --filter @wtm/web -s test` — 1775 passed / 0 failed / 0 skipped
- `pnpm --filter @wtm/cli -s test` — 133 passed / 0 failed / 0 skipped
- `pnpm -r --filter '!@wtm/e2e' test`（一括実行。最終確認） — 全て green（exit 0。合計2651件）
- E2E（`packages/e2e`）は対象外（requirements「対象外」）。実行していない。

## 受け入れ基準ごとの判定

- AC1: pass — `AgentIntegrationInstaller.test.ts` に追加した6 kind 分のテスト（fresh install・
  idempotent・uninstall）で、書き込み内容が research.md F4 の表と一致することを確認。
  `resumeCommand.test.ts` で6 kind 分のコマンド文字列も確認。実機での resume 動作は対象外
  （requirements「目的 / ゴール」）。
- AC2, AC3: pass — 既存の `resumeCommandFor`（未知 kind・不正 ID で `undefined`）・
  `maybeResumeAgentSession`（`agentSession` が無ければ何もしない）は無変更のまま。
- AC4: pass — `resumeCommand.test.ts` の「不正な sessionId を6 kind とも拒否する」テストで確認。
- AC5: pass — `SessionService.test.ts` に追加した2件（8 kind すべてで `agentSession` へ反映される・
  同一 cwd 上の複数 pane が独立した `sessionId` を保持する）で確認。
- AC6: pass — `AgentIntegrationService.ts` の `KINDS` 拡張のみで、`IntegrationFile`/導入状況の
  永続化ロジックは既存のまま（新規テスト不要。design「受け入れ基準との対応」参照）。
- AC7: pass — Claude Code・Codex 向けの既存テスト（`AgentIntegrationInstaller.test.ts` の8件・
  `resumeCommand.test.ts` の既存4件）が無変更のまま通った。
- AC8: pass — `docs/herdr-parity.md` H32b の新規追加・`docs/verification.md` への追記を目視確認
  （文書のため自動テスト対象外）。
- AC-I1〜AC-I4: pass — `SettingsDialog.test.ts` に追加した2件（6エージェント分の行の描画・導入/解除
  操作・他の設定項目への非干渉）で確認。

## 失敗の証跡

このラウンドでは実装起因の失敗は発生していない。全体回帰の実行中、2件の**無関係な環境依存の
flaky 失敗**を観測した（いずれもこの work が触っていないコードで、再実行すると解消した——生の
失敗出力を貼り、無関係であることの根拠とする）：

1. `packages/server` の `pnpm --filter @wtm/server test`（coding フェーズ中に1度）：

```
The last test to run before this error was "serves a placeholder page when packages/web/dist does not exist".
Test Files  1 failed | 51 passed (52)
Tests  1 failed | 670 passed (671)
```

再実行すると `Test Files  52 passed (52)` / `Tests  671 passed (671)` で解消（`packages/web/dist`
の有無を見るテストのタイミング依存。`AgentIntegrationInstaller`/`AgentIntegrationService` の
どちらにも触れていない）。

2. `packages/cli` の `pnpm -r --filter '!@wtm/e2e' test`（T16 の全体回帰実行中）：

```
❯ src/main.integration.test.ts (8 tests | 1 failed) 3801ms
  × Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）
TypeError: Invalid value "undefined" for header "cookie"
  ❯ initAsClient ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js:885:28
  ❯ src/main.integration.test.ts:255:16
```

`main.integration.test.ts` を単独で再実行すると `Tests  8 passed (8)` で解消（cookie store の
タイミング依存。この work は `packages/cli` を一切変更していない）。

## 起動確認（smoke）

```
$ aidev smoke
...
smoke: PASS
$ pnpm --filter @wtm/cli run smoke
...
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

新しい入口（protocol メソッド）は追加していない（既存の `agent_integration.*` の `kind` パラメータが
受ける値が8種に増えただけ）。既存の smoke シナリオへの追加は不要と判断した（既存の Claude Code・
Codex 分もこのシナリオでは個別に確認しておらず、粒度を揃えた）。

## 未検証の穴（skip / 環境不足）

- 対象6エージェント（Cursor Agent CLI・GitHub Copilot CLI・Devin CLI・Droid・Grok CLI・Qwen Code）は
  いずれも本開発環境に実機が存在せず、実際のインストール・hook の発火・resume の動作は**一度も
  検証できていない**（requirements「目的 / ゴール」で明記した本 work 固有の制約）。単体テストで
  検証したのは「公式ドキュメントの記述どおりに設定ファイル・hook エントリを書き込むか」までで、
  各エージェント自身がその hook を実際に解釈して起動時にIDを報告してくれるかどうかは未検証。
  `docs/verification.md` に手動確認の手順を追記済み（T14）。
- Devin CLI の設定ファイルパス（`~/.devin/hooks.json`）は公式ドキュメントに記載が無く、推測値
  （decisions D4）。実機で確認できる環境があれば最優先で検証すべき項目として
  `docs/verification.md` に明記した。
- E2E（`packages/e2e`）は対象外（requirements「対象外」）のため未実施。
