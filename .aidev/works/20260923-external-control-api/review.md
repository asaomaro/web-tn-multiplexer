# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）

- [should][conv:-] `packages/cli/src/cliArgs.ts` の `pane input`/`pane run`：第2位置引数（text/command）が
  `--` で始まる文字列だと、この単純なパーサでは未知のオプションとして拒否される（`--` による位置引数との
  区切りを実装していないため）。既知の制約としてコード中にコメントで明記し、`workspace`/`tab`/`pane` の
  サブコマンド自体が無い場合の網羅テストも合わせて追加した（T3・same_session）。
- [must][conv:-] `packages/cli/src/wsClient.ts` の `connect()`：`ws` の `terminate()` は `readyState ===
  CONNECTING` の間に呼ぶと内部の `abortHandshake` が `error` イベントを発火するが、直前の `cleanup()` で
  `error` リスナーを外していたため、実機の vitest で「Uncaught Exception: WebSocket was closed before the
  connection was established」として未処理例外になっていた（`onUnexpectedResponse` ハンドラ内。401 応答を
  受けたテストで実際に再現・検出）。`ws.once("error", () => undefined)` で吸収してから `terminate()` する
  よう修正した（T5・same_session。`packages/cli/src/wsClient.test.ts` の「無効な cookie は AuthError」で
  再発を検出できる）。
- [must][conv:-] `packages/cli/src/output.ts` の `reportAndExit`：`process.exit(2)` の後に `return` が
  無く、テストで `process.exit` を差し替えると（`vi.spyOn`）CLI 使用誤り（exit 2）の分岐の後に
  JSON エラー出力（exit 1 側の `process.stderr.write`）まで実行してしまうことを、実機の vitest
  （`output.test.ts` の CliUsageError テストに `expect(writeSpy).not.toHaveBeenCalled()` を足して
  再現）で検出した。`return` を追加し、戻り値型を `never`→`void` に変更した（decisions.md D17。
  T6・same_session）。
- [should][conv:-] `packages/cli/src/main.ts` の `switch (cmd.kind)`：この tsconfig は
  `noImplicitReturns` を有効にしていないため、`Command` に新しい種類が足されてもこの `switch` に
  分岐を足し忘れたことをコンパイル時に検知できなかった（現状は全13種を網羅しているので実害は無いが、
  将来の追加漏れを防ぐ仕組みが無かった）。`default` に `const exhaustive: never = cmd` を足し、
  非網羅を型エラーにした（cross・same_session）。
- [nit][conv:-] `commands/workspace.test.ts`・`tab.test.ts`・`pane.test.ts`・`session.test.ts` は
  それぞれ独自に `fakeClient()`/`memoryStore()` 相当のモックを持ち、多少の重複がある。ファイルごとに
  必要なモックの形（`pane.test.ts` は `emitSnapshot`/`emitOutput`/`emitClose` を要する等）が異なるため、
  共通化の効果は限定的と判断し、そのままにした（cross・same_session。指摘はしたが修正は見送り——
  正確性には影響しない保守性の所見として記録するに留める）。

## ラウンド1（2026-09-23T08:13:17Z）

- **要件適合**: `aidev coverage --strict` で AC1〜AC12 の全12件が design・tasks 双方 100%
  カバレッジ（gap 0）。`requirements.md`「対象外」（H39 のエージェント自動化・H40 の pane 直接接続/
  制御ストリーム・herdr の `send-keys`／4種の `--source` 分類・複数ホスト集約・named session・plugin）
  には、コードが一切触れていないことを `git diff --stat`（35ファイル・`packages/cli` 新規と、
  `packages/protocol`/`packages/server`/`packages/web`/`docs`/`.aidev/config.yml` の小さな差分のみ）で
  確認した。
- **価値適合**: US1（CI/開発者が `wtmctl workspace create`→`pane run`→`pane read` の一巡で、ブラウザ無しに
  自動化できる。統合テスト・smoke の両方で実測）・US2（`pane input`/`pane run`・`pane read`・`watch` が
  揃い、`watch` は `pane.agent_status_changed` を含む全 `ServerEvent` をそのまま流すのでエージェント状態変化の
  購読にも使える——design でフィルタを設けなかったことがそのまま US2 の価値になっている）・US3（decisions.md
  D3〜D5・AC9〜AC11 で実測済み。新しい認証・新しいトランスポートを一切追加していない）・US4
  （`docs/herdr-parity.md` の H38〜H40 行を更新済み、H41 は不可侵）をいずれも満たすことを確認した。
- **正確性**: coding 工程で `taskcheck`（T1〜T14 の全14タスク＋タスク横断 `cross`）を実施し、
  見つけた指摘（T3の`--`位置引数の制約明記・T5のwsクライアントの未処理例外・T6の`reportAndExit`の
  制御フロー・crossのswitch非網羅・T12のテスト間欠failure）はすべてその場で修正済み
  （内容は本ファイル上部「タスク点検ログ」節・decisions.md D17〜D21）。加えてこのレビューで改めて
  `commands/*.ts` 全体・`wsClient.ts`・`withSession.ts`・`output.ts`・`session.ts`・`httpAuth.ts`・
  `cliArgs.ts`・それぞれの単体テストを読み直し、次を確認した：
  - 全コマンドが `client.hello()` を（直接または `requirePaneExists` 経由で）RPC/入力送信より先に
    呼んでおり、`kind: "external"` が常にサーバへ先に伝わる（decisions.md D4 の担保）。
  - `exactOptionalPropertyTypes` 下での省略可能パラメータの組み立て（`workspace.ts`/`tab.ts`/`pane.ts`）が
    一貫した書き方（値がある時だけキーを代入）になっている。
  - `RpcFailure` のコード語彙（`not_found`/`timeout`/`connection_closed`/…）が `output.ts` の `classify`
    （汎用の `instanceof` 判定）で一律に処理され、コードを足すたびに分岐を増やす必要が無い設計になっている。
  - `pnpm -s test` を本レビュー時点で通算5回以上連続で実行し、全2487件 pass を確認済み（`test-result.md`）。
- **規約適合**: `.aidev/conventions/` の2条項（`e2e-observe-browser`・`regression-negative-control`）は
  いずれも該当なし（E2E は書いていない。decisions.md D21 のテスト間欠failureはバグ修正ではなくテスト自身の
  頑健化だが、同条項の「間欠的な失敗の原因を放置しない」という趣旨には従い、3回連続 pass を実測で確認した）。
  `[conv:-]`。AGENTS.md 本体の指示（既存RPC機構の再利用方針をdecisions.mdに記録・token認証との整合確認・
  `docs/herdr-parity.md` のH38〜H40更新でH41は不可侵）はいずれも満たしている。
- **保守性**: 既存の実装パターン（`packages/server/src/cliArgs.ts` の手書きパーサ・`ConfigError` の形・
  `smoke.ts` の起動確認の形）を踏襲した。`commands/*.test.ts` 各ファイルが独自に `fakeClient()` を持つ
  軽微な重複は cross taskcheck で指摘済み・修正見送りとして記録済み（review.md 上部「タスク点検ログ」）。

**must: 0 / should: 0 / nit: 0**（この work では reviewer 分離を挟まず、coding 中の taskcheck・
cross taskcheck・本ラウンドでの読み直しで代替した。新規の指摘は無かった）。

### walkthrough.md の要否判定

差分が大きい（35ファイル・2730行）・複数モジュールを横断する（`packages/protocol`・
`packages/server`・`packages/web`・新規 `packages/cli`・`docs`）の2条件に該当するため、
`walkthrough.md` を作成する。
