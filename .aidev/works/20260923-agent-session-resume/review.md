# レビュー: サーバ再起動後のエージェント会話の再開

## レビュー ラウンド1

- **要件適合**: `aidev coverage` で AC1〜AC7・AC-I1〜AC-I5 の全12件が design・tasks 双方
  100% カバレッジ（gap 0）。requirements.md の「対象外」（他16エージェント・画面履歴・named
  session・live handoff）にはコードが一切触れていないことを diff で確認した。
- **価値適合**: US1（自動再開）・US2（複数paneの個別再開。pane ごとに一意な `sessionId` を持つ
  ため構造的に保証）・US3（明示操作でのみグローバル設定に触れる。`AgentIntegrationInstaller.install`
  は常に利用者の RPC 呼び出しからしか起動しない）を満たす。
- **正確性**: 手動で以下を検証済み（すべて指摘なし）。
  - 環境変数注入（`envForPane`）が全 pane 作成経路（`createWorkspace`/`createTab`/`splitPane`/
    `restorePaneProcess`）で唯一の `spawnForPane` を経由すること。
  - `toSessionFileData` の `agentSession: p.agentSession ?? undefined` が `JSON.stringify` で
    欠落キーとして正しく落ち、`SessionFilePaneSchema` の `.optional()` と整合すること。
  - D9（画面判定消失時のクリア）が `patch.agent === null`（`undefined` ではない）を条件にしており、
    エージェント無関係の `updatePaneRuntime` 呼び出し（`busy`/`title` だけの更新）を誤って
    巻き込まないこと。
  - `resumeCommandFor` のセッションID検証がシェルメタ文字（`;` `` ` `` `$()` `\n`）を一貫して拒否すること。
  - RPC ハンドラの例外は `ControlSurface.dispatch` の既存の try/catch でエラー応答に変換される
    （個々のハンドラで握り直す必要が無い。既存の他方式と同じ扱い）。
  - `composeServer.ts` の起動失敗時（catch ブロック）で `agentReportSocket` を `lock.release()` の
    前に閉じており、次の起動が同じ state dir で socket の bind に失敗しない。
- **規約適合**: `.aidev/conventions/` の2条項（`e2e-observe-browser`・`regression-negative-control`）
  はいずれも該当なし（E2E は書いていない。バグ修正は「テストが先に落ちて捕まえた」ものではなく
  coding 中の自己点検で見つけた設計上の問題〔hook command のクォート方式〕だったため、
  「回帰テストが修正前に落ちることを確認する」手順の対象外）。`[conv:-]`。
- **保守性**: 既存の DI パターン（`TerminalManager`/`WorktreeService` と同じ interface +
  `Default…` 実装）に揃えた（当初 `AgentIntegrationService` を具象クラスのみで書いていたが、
  `MethodDeps` のテスト用スタブが作れないことに気づき、この工程内でインターフェースへ分離した）。
  `persist/AuthFile.ts`・`surface/methods/worktree.ts` と同じ既存パターンを踏襲。

**must: 0 / should: 0 / nit: 0**（この work では reviewer 分離を挟まず、coding 中の継続的な
typecheck/lint/test 実行と、上記の意図的な仕上げレビューで代替した。指摘は無かった）。

## タスク点検ログ（coding 工程内。ラウンド指摘とは別集計）

- [coding中の自己点検] `AgentIntegrationInstaller.buildEntry` が hook の `command` 文字列のパスを
  `JSON.stringify(scriptPath)` でクォートしていた（`\"` 形式）。これは POSIX シェル・Windows の
  `cmd.exe` のどちらのクォート規則とも一致せず、パスに空白・バックスラッシュを含む環境で誤動作しうる。
  素の二重引用符（`"${scriptPath}"`）に直した — `packages/server/src/agent/AgentIntegrationInstaller.ts:88`
  [conv:-]
- [cross（same_session・findings 0）] タスクをまたぐ不変条件の点検: 環境変数注入
  （`SessionService.envForPane`）が全 pane 作成経路（`createWorkspace`/`createTab`/`splitPane`/
  `restorePaneProcess`）で共通の `spawnForPane` を経由すること、`toSessionFileData` の
  `agentSession: p.agentSession ?? undefined` が `JSON.stringify` で欠落キーとして正しく落ちること
  （zod の `.optional()` と整合）、`resumeCommandFor` のセッションID検証がシェルメタ文字を一貫して
  拒否すること（`;` `` ` `` `$()` `\n`）を確認。指摘なし。
