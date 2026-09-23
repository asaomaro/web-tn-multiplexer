# テスト結果: サーバ再起動後のエージェント会話の再開

## 実行したもの

- `pnpm -s typecheck`（`packages/protocol`・`packages/server`・`packages/web`・`packages/e2e` の4パッケージ）
  — exit 0
- `pnpm -s lint`（`eslint . --ext .ts`）— exit 0（1件、無効化した変数の未使用エラーを発見・修正。下記「失敗の証跡」参照）
- `pnpm -r --filter="./packages/*" --filter="!@wtm/e2e" run test`（vitest）
  — protocol 57 passed / server 647 passed / web 1649 passed / **0 failed**
- `pnpm -s build`（`tsc -b` × protocol・server、`vue-tsc --noEmit && vite build` × web）— exit 0
- `pnpm --filter @wtm/server run smoke`（`dist/smoke.js`。ビルド済み成果物での起動確認） — `smoke: PASS`
  （login・websocket・client.hello・workspace.create・pane.subscribe・echo round trip・ブラウザでの
  入力往復まで一通り確認。この feature が触った配線〔`composeServer.ts` の agent report socket 起動・
  `AgentIntegrationService`/`IntegrationFile` の読み込み・pane 起動時の env 注入〕を含めて起動できることを確認）
- E2E（Playwright）は実施していない（[[e2e-only-on-request]]。ユーザーから明示の依頼があれば別途）

## 受け入れ基準ごとの判定

- AC1（Claude Code の正確な再開）: **pass（unit）** — `SessionService.test.ts`
  「保存されていた会話IDで claude --resume <id> を投入する」。**実物の `claude` バイナリとの結線は未検証**
  （下記「未検証の穴」）。
- AC2（Codex）: **pass（unit）** — 同ファイル「codex は codex resume <id> を投入する」。同じく実物は未検証。
- AC3（連携未導入 → 現状どおりプレーンなシェル）: **pass** — 既存の「復元（design D6・D10）」のテスト群が
  無回帰（`agentSession` フィールドの有無に関わらず動く）であることに加え、新規「会話IDが無い pane には
  何も投入しない」で確認。
- AC4（連携導入済みだが未検出 → プレーンなシェル）: **pass** — 上と同じテストが兼ねる（`agentSession` 無しの
  pane は投入対象にならない）。
- AC5（同一 cwd・同一種別の複数 pane が別々に再開）: **pass** — 「同一 cwd・同一種別の複数 pane でも、
  pane ごとに一意な ID で全 pane に投入する（design D11）」。
- AC6（無効な会話IDでも `failed` にならない）: **pass（構造的に保証・実行結果は未検証）** — 設計上、
  resume コマンドはシェル起動**成功後**に投入するだけで、投入したコマンド自体の成否は検査しない
  （`maybeResumeAgentSession` は `write()` の戻り値を見ない）。よって無効な ID でも pane が `failed` に
  「なりようがない」ことはコードパス上保証できるが、**実際に Claude Code/Codex がそのケースでエラー
  終了してプレーンなシェルに戻ることそのもの**は research.md F3.1/F5 の公式ドキュメント記載に基づく
  推測で、実機では確認していない。
- AC7（設定の永続化・ブラウザ間の一貫性）: **pass** — `IntegrationFile.test.ts`（round-trip）、
  `AgentIntegrationService`（`agent_integration.status`/`install`/`uninstall`/`set_auto_resume` の
  RPC ハンドラテスト。`surface/methods/index.test.ts` 経由）、`SettingsDialog.test.ts`
  「開くたびに状態を取得する」。
- AC-I1（導入操作・説明）: **pass** — `SettingsDialog.test.ts`「未導入なら『導入』ボタンで
  installAgentIntegration(kind) を呼ぶ」。設定ファイルへの書き込み内容の説明文は目視確認（自動テストは
  文言の存在まで）。
- AC-I2（解除操作）: **pass** — 同ファイル「導入済みなら『解除』ボタンで uninstallAgentIntegration(kind) を呼ぶ」。
- AC-I3（状態表示）: **pass** — 同ファイル「開くたびに状態を取得する」（`cliDetected`/`installed` の表示）。
- AC-I4（自動再開 ON/OFF）: **pass** — 同ファイル「自動再開の switch は現在値を反映し...」。
- AC-I5（他の設定操作を妨げない）: **pass** — 同ファイル「ActionDispatcher が provide されていなくても
  他の設定操作は壊れない」＋「6 つの節」テストの更新（節が1つ増えても既存の節の構造は無傷）。

## 失敗の証跡

`pnpm -s lint` の1回目の実行で以下が出た（修正前）。

```
$ pnpm -s lint
/workspaces/web-tn-multiplexer/packages/server/src/session/SessionService.test.ts
  1136:24  error  'persist' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)
```

原因: 新規テスト「agent の kind・state が変わるだけでは会話参照を消さない」で `const { service, persist } = setup();`
と分割代入したが `persist` を使っていなかった。`const { service } = setup();` に直し、再実行して exit 0 を確認した。

`pnpm typecheck`（ルート、`-s` 無し）で以下が2巡出た（修正前。いずれも本文で直した）。

```
packages/server typecheck: src/surface/methods/index.test.ts(117,31): error TS2345: ...
  Property 'agentIntegrations' is missing in type ... but required in type 'MethodDeps'.
packages/server typecheck: src/ws/WsGateway.integration.test.ts(114,31): error TS2345: ...
  Property 'agentIntegrations' is missing in type ... but required in type 'MethodDeps'.
```

原因: `packages/server` の `typecheck` は `tsconfig.typecheck.json`（テストファイルを含む）を使うが、
coding 中に `tsc --noEmit -p .`（`tsconfig.json` のみ、テスト非対象）で確認していたため見落としていた
（`pnpm -s typecheck hides failures` の教訓どおり、`-s` 無し・正しい tsconfig での確認が必要だった）。
両テストファイルに `stubAgentIntegrations()` を足して解消した。

`vue-tsc`/`vitest` では新規追加分に起因する失敗は無かった（`SettingsDialog.test.ts` の既存テスト
「見出し...5節...」だけは、新しい節を足した結果として**当然に**落ちる想定内の失敗だったため、
タイトル・期待値を「6節」に更新した——これは「捕まえるべきでない回帰」ではなく、仕様変更に伴う
テストの追従）。

## 起動確認（smoke）

```
$ pnpm --filter @wtm/server run smoke
smoke: starting server on 127.0.0.1:45911 (state dir /tmp/wtm-smoke-LRJUWZ)
{"ts":"...","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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
```

GO（exit 0。この feature が追加した起動時の配線を含めて起動できることを確認した）。

## 未検証の穴（skip / 環境不足）

- **実物の Claude Code・Codex CLI との結線**：この開発環境に両 CLI がインストールされていないため、
  (a) hook が実際に発火して report が届くこと、(b) `settings.json`/`hooks.json` への書き込みが
  実際に両 CLI に認識されること、(c) `claude --resume <id>`/`codex resume <id>` が実際に会話を
  再開すること、は unit test では検証できていない。`docs/verification.md` に手動確認手順を追加した
  （実際に利用する環境での確認を deliver 後に依頼する）。
- **Windows の named pipe の権限限定**：`AgentReportSocket` の Unix 側（`chmod 0600`）は実装・
  この環境で動作確認したが、Windows 側の DACL 設定は未実装（decisions.md D5 の追記を参照。
  ネイティブアドオンが要り、この Linux 環境では検証もできないため）。
- **hook の `command` フィールドが実際にどのシェル経由で実行されるか**（`sh -c` か直接 spawn か）は
  Claude Code/Codex のドキュメントに明記が無く未確認。パスの引用符は POSIX・Windows のどちらでも
  通る素の二重引用符にしたが、確実性は実機でしか確かめられない。
