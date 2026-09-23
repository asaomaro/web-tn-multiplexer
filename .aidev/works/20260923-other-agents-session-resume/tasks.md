# タスク: Claude Code・Codex 以外の6エージェントへセッション再開対応を広げる

## 実装方針

design.md の対象範囲を、依存の向きに沿って下から積む：
1. protocol（`AgentIntegrationKind` の拡張）
2. server の核（`HookSpec` インターフェース・汎用ヘルパー・`claude`/`codex` の移行——**振る舞いを
   変えずに**既存実装を新しい抽象化へ寄せる。ここで既存テストが無変更で通ることを確認してから、
   新しい6 kind を1つずつ積む。`session.json` の永続化確認（T15）もこの段階の一部——新規ロジックが
   無いことの確認テストなので、`HookSpec` の土台が整った時点でいつ差し込んでもよい）
3. 新規6 kind（`HOOK_SPECS` へ1つずつ追加。research F4 の表を実装に落とし、単体テストで突き合わせる）
4. server の周辺（`AgentIntegrationService` の `KINDS`・`resumeCommand.ts`・hook スクリプト）
5. web（`SettingsDialog.vue`）
6. ドキュメント（`docs/herdr-parity.md`・`docs/verification.md`）
7. 全体の回帰確認（test 工程で実施）

subtask には割らない（`20260923-missing-keybinding-actions` の decisions D6 と同じ判断軸——
protocol/server/web が1つの機能として結合しており、個別に検証・デリバリできる単位に切り出せない）。

## 作業順序と依存関係

下の `依存:` に従う。T3〜T8（6 kind それぞれの `HOOK_SPECS` エントリ追加）は、T2（`HookSpec` の
土台・`claude`/`codex` の移行）が終われば**互いに独立して並行できる**（対象ファイルは同じ
`AgentIntegrationInstaller.ts`・`AgentIntegrationInstaller.test.ts` だが、追加する箇所（`HOOK_SPECS`
オブジェクトへの1エントリ・テストの新規 `describe` ブロック）が重ならないため——ただし実際に並行させる
場合は「対象ファイルが重ならない」という coding 手順2の原則には反するので、**基本は直列**で1つずつ
積み、検証を刻む。

## リスク / 留意点

- T3〜T8 は research.md F4 の表を**逐語的に**実装へ落とす（推測で埋めない。特に Devin CLI（T5）の
  設定ファイルパスは decisions D4 のとおり推測値であることをコード注釈にも残す）。
- T2 で `claude`/`codex` を新しい `HookSpec` 抽象化へ移行する際、既存のテスト
  （`AgentIntegrationInstaller.test.ts` の9件）が**無変更のまま**通ることが、リファクタの正しさの
  唯一の確認手段（design AC7）。1件でも変更が要れば設計から逸脱している合図。
- `AgentIntegrationInstaller.ts`・`AgentIntegrationService.ts`・`SettingsDialog.vue` の3箇所に、
  独立した per-kind の一覧（`HOOK_SPECS`・`KINDS`・`AGENT_INTEGRATION_KINDS`）が存在する
  （design「依拠する既存の事実」）。3つとも6 kind 分を漏れなく足すこと——1つでも漏れると
  「導入はできるが一覧に出ない」等の食い違いが起きる。

## テスト方針

- 単体テスト中心。8 kind（既存2＋新規6）それぞれについて、`install`/`uninstall`/`status` の
  書き込み内容が research F4 の表と一致することを確認する（既存の `AgentIntegrationInstaller.test.ts`
  の形——fresh install・idempotent・非破壊マージ・corrupt file 拒否・uninstall——を6 kind 分に広げる。
  全項目を6 kind 分フルに複製するのではなく、**各 kind ごとに「書き込み内容が正しい」ことを検証する
  最小セット**＋「移行した claude/codex は既存の9件をそのまま」という配分にする）。
- E2E は対象外（実機での動作確認自体が対象外。requirements「対象外」）。
- `aidev smoke` は test 工程で通常どおり実施。
- 全体回帰（`pnpm -r --filter '!@wtm/e2e' test`）は T16 として立てるが、消化するのは test 工程
  （`20260923-missing-keybinding-actions` decisions D7 と同じ判断）。

## タスク

- [x] T1: `packages/protocol/src/model.ts` の `AgentIntegrationKind` に6つ追加する
      （`"cursor" | "copilot" | "devin" | "droid" | "grok" | "qwen"`）。
      対象: `packages/protocol/src/model.ts:81` / 根拠: design「protocol」
      依存: なし
      AC: AC1

- [x] T2: `AgentIntegrationInstaller.ts` に `HookSpec` インターフェース・`getPath`/`setPath` 汎用
      ヘルパーを新設し、`pathsFor`/`sessionStartEntries`/`commandsOf`/`isOurs`/`buildEntry` を
      `HOOK_SPECS` テーブル方式（`Record<AgentIntegrationKind, HookSpec>`）へ書き換える。
      **`claude`/`codex` の2エントリだけを先に移行**し、振る舞いを変えないことを既存テスト
      （`AgentIntegrationInstaller.test.ts` の9件）が無変更のまま通ることで確認する。
      対象: `packages/server/src/agent/AgentIntegrationInstaller.ts:27-102`（`pathsFor`〜`buildEntry`）
      / 根拠: design「インターフェース / データ構造」`HookSpec`・「振る舞いの詳細」
      依存: T1
      AC: AC7

- [x] T3: `HOOK_SPECS` に `cursor` を追加する（`configFile: ~/.cursor/hooks.json`・
      `entriesPath: ["hooks","sessionStart"]`・`buildEntry: {type:"command", command}`・
      `isOurs: entry.command` を見る）。`AgentIntegrationInstaller.test.ts` に、install の書き込み内容が
      research F4 の表と一致することを確認する単体テストを足す（fresh install・idempotent・uninstall の
      最小セット）。
      対象: `packages/server/src/agent/AgentIntegrationInstaller.ts`（`HOOK_SPECS` オブジェクト）/
      根拠: design「8 kind の HookSpec 一覧」cursor 行
      依存: T2
      AC: AC1

- [x] T4: `HOOK_SPECS` に `copilot` を追加する（`configFile: ~/.copilot/hooks/wtm-agent-report.json`・
      `entriesPath: ["hooks","sessionStart"]`・`buildEntry: {type:"command", bash, powershell,
      timeoutSec:10}`・`isOurs: entry.bash` を見る）。他の `*.json` が同じディレクトリにあっても
      読み書きしないことを確認するテストを含む（design「振る舞いの詳細」glob ディレクトリ形式）。
      対象: 同上 / 根拠: design「8 kind の HookSpec 一覧」copilot 行
      依存: T2
      AC: AC1

- [x] T5: `HOOK_SPECS` に `devin` を追加する（`configFile: DEVIN_CONFIG_DIR ?? ~/.devin/hooks.json`。
      **decisions D4 のとおり推測値であることをコード注釈に明記**——`entriesPath: ["SessionStart"]`
      （`hooks` ラップ無し）・`buildEntry: {matcher:"", hooks:[{type:"command",command,timeout:10}]}`・
      `isOurs: entry.hooks[].command` を見る）。
      対象: 同上 / 根拠: design「8 kind の HookSpec 一覧」devin 行・decisions D4
      依存: T2
      AC: AC1

- [x] T6: `HOOK_SPECS` に `droid` を追加する（`configFile: ~/.factory/hooks.json`・
      `entriesPath: ["SessionStart"]`・`buildEntry: {matcher:"", hooks:[{type:"command",command,
      timeout:10}]}`・`isOurs: entry.hooks[].command` を見る。devin と同形だが個別の `HOOK_SPECS`
      エントリとして書く——設定ファイルパスが違うため）。
      対象: 同上 / 根拠: design「8 kind の HookSpec 一覧」droid 行
      依存: T2
      AC: AC1

- [x] T7: `HOOK_SPECS` に `grok` を追加する（`configFile: ~/.grok/hooks/wtm-agent-report.json`・
      `entriesPath: ["hooks","SessionStart"]`・`buildEntry: {matcher:"", type:"command", command,
      timeout:10}`・`isOurs: entry.command` を見る。copilot と同じ glob ディレクトリ形式）。
      対象: 同上 / 根拠: design「8 kind の HookSpec 一覧」grok 行
      依存: T2
      AC: AC1

- [x] T8: `HOOK_SPECS` に `qwen` を追加する（`configFile: ~/.qwen/settings.json`・
      `entriesPath: ["hooks","SessionStart"]`・`buildEntry: {type:"command", command,
      name:"wtm-agent-report", async:true}`・`isOurs: entry.command` を見る）。
      対象: 同上 / 根拠: design「8 kind の HookSpec 一覧」qwen 行
      依存: T2
      AC: AC1

- [x] T9: `AgentIntegrationService.ts` の `KINDS` 定数に6つ追加する。
      対象: `packages/server/src/agent/AgentIntegrationService.ts:7` / 根拠: design「依拠する既存の事実」
      依存: T1
      AC: AC6

- [x] T10: `resumeCommand.ts` に6 case を追加する（design「`resumeCommand.ts` の6 case」のとおり）。
      `resumeCommand.test.ts`（無ければ新規）に6 kind 分のテストを足す（正しいコマンド文字列・
      不正な `sessionId` での `undefined`・未知の kind での `undefined`）。
      対象: `packages/server/src/agent/resumeCommand.ts:20-30` / 根拠: design「`resumeCommand.ts` の6 case」
      依存: T1
      AC: AC2, AC3, AC4

- [x] T11: `agent-hook-report.cjs` の stdin パース処理を `payload.session_id || payload.sessionId` に
      直す。この hook スクリプトの既存テスト（あれば）に、`sessionId`（camelCase）だけを含む stdin
      でも正しく拾えることを確認するケースを足す。
      対象: `packages/server/assets/agent-hook-report.cjs:40-43` / 根拠: design「hook スクリプト」
      依存: なし
      AC: AC1

- [x] T12: `SettingsDialog.vue` の `AGENT_INTEGRATION_KINDS` 配列に6エントリ追加する
      （`{value:"cursor", label:"Cursor Agent CLI"}` 等、6エージェント分。ラベルは正式名称
      （requirements「対象6エージェント」の表記）に揃える）。既存の `SettingsDialog.test.ts` に、
      6エージェント分の行が描画されること・導入/解除の操作ができることを確認するテストを足す
      （既存の Claude Code・Codex 向けテストと同じ形）。
      対象: `packages/web/src/components/SettingsDialog.vue:324-327` / 根拠: design「対象範囲」・
      「受け入れ基準との対応」AC-I1〜AC-I4
      依存: T1
      AC: AC-I1, AC-I2, AC-I3, AC-I4

- [x] T13: `docs/herdr-parity.md` H32 を更新する（新しい行（H32b 等）を追加し、6エージェント分の
      対応状況・herdr との差異を記す。design「ドメイン固有の考慮」）。
      対象: `docs/herdr-parity.md`（H32 の行の直後） / 根拠: design「ドメイン固有の考慮」・
      requirements AC8
      依存: T3, T4, T5, T6, T7, T8
      AC: AC8

- [x] T14: `docs/verification.md` に、6エージェントとも実機未検証である旨・Devin CLI の設定ファイル
      パスが推測値である旨を追記する。
      対象: `docs/verification.md` / 根拠: design「対象範囲」・requirements「目的 / ゴール」・
      decisions D4
      依存: T5
      AC: AC8

- [x] T15: `session.json`（pane 単位の `agentSession` 永続化）が8 kind 分すべてで正しく動くことを
      確認する単体テストを足す（同一 cwd・同一 kind の pane が複数あっても pane ごとに別々の
      `sessionId` を保持することを、既存の `SessionService`/`SessionModel` のテストパターンに沿って
      確認する。design AC5「依拠する既存の事実」参照——新規ロジックは無いため、確認テストのみ）。
      対象: `packages/server/src/session/SessionService.test.ts` または `SessionModel.test.ts`
      （既存の `reportAgentSession`/`agentSession` 関連テストの近く） / 根拠: design「受け入れ基準との
      対応」AC5
      依存: T2
      AC: AC5

- [x] T16: 全体回帰確認（`pnpm -r --filter '!@wtm/e2e' test`。既存の Claude Code・Codex 向けテスト・
      その他既存機能のテストが無変更で通ることを実測する）。**この項目は coding では消化しない**——
      `aidev-50-test` 工程で実施し、そこでチェックを入れる（`20260923-missing-keybinding-actions`
      decisions D7 と同じ判断）。test 工程で実施・確認済み（test-result.md 参照）。
      対象: リポジトリ全体 / 根拠: design AC7
      依存: T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15
      AC: AC7
