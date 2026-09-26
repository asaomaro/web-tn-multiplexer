# タスク: 名前付き session（herdr の `--session <name>` 相当）

## 実装方針

design の順に、純粋な部品（名前の規則・状態ディレクトリの解決・ロックの読み取り）→ それを使う一覧・削除 →
起動の経路（`config.ts`・`cliArgs.ts`・起動時の表示）→ CLI の配線（`sessionCommands.ts`・`main.ts`）→ 結合テスト → docs
と積む。サーバの中（SessionService・永続化の形式・Web・protocol・wtmctl）は触らない。

## 作業順序と依存関係

- 下の `依存:` に従う。
- 名前の規則（T1）を最初に固める。名前を状態ディレクトリにする T3・T4（と、それらを使う T7・T8）がこの関数を通すので、ここで規則を変えると全体に響く。T5（引数の解釈）は値を受け渡すだけで規則を通さない（規則は T4・T7 で効く）。

## リスク / 留意点

- 案内文を変えると既存のテストの `toContain` が崩れうる。既存の断定を崩さない文面にする（例: EADDRINUSE の
  「並行して動かすなら --state-dir も分け」は残して `--session` を足す）。
- socket のパス長の検査は、今まで起動できていた長さを断らないこと（上限は実測の Linux 108 バイト）。
- `deleteSession` は破壊的。テストは必ず一時ディレクトリの下で行い、シンボリックリンクのリンク先が残ることを確かめる。
- Windows ネイティブでは試せない（手元は Linux）。Windows 固有の規則（予約名・末尾の `.`）は OS に依らず断る実装なので
  単体テストで確かめられる。シンボリックリンクのテストは Windows では skip。

## テスト方針

- 単体（vitest）: `namedSession.test.ts`（規則・解決・一覧・削除）、`StateDirLock.test.ts`（inspect）、`config.test.ts`
  （解決・socket 長・案内文）、`cliArgs.test.ts`、`startupBanner.test.ts`、`sessionCommands.test.ts`（表示・終了コード・token reset）。
- 結合: `composeServer.integration.test.ts` に名前付き session の起動・二重起動・並行起動。
- 負の確認: 足した判定（規則の各項・default の別名・完全一致・シンボリックリンク除外・running 拒否・socket 長の上限・
  banner の行・案内文）を 1 か所ずつ壊してテストが落ちることを確かめ、生の出力を test-result.md に貼る。
- 全体: `pnpm -s build` → `pnpm -s typecheck` → `pnpm -s test`（2 回）→ `aidev smoke`。E2E は走らせない。

## タスク

- [x] T1: 名前の規則と状態ディレクトリの解決（`sessionNameProblem`・`resolveSessionStateDir`・定数）
      対象: `packages/server/src/persist/namedSession.ts`（新規）・`namedSession.test.ts`（新規）・`packages/server/src/configError.ts`（新規。decisions D3）・`config.ts` `ConfigError`
      依存: なし
      AC: AC2, AC3, AC4, AC9
- [x] T2: `StateDirLock.inspect()`（読み取り専用の使用中判定）
      対象: `packages/server/src/persist/StateDirLock.ts` `StateDirLock.inspect`（新規。既存の `isInUse` を使う）・`StateDirLock.test.ts`
      依存: なし
      AC: AC6
- [x] T3: 一覧と削除（`listSessions`・`deleteSession`・`findExactEntry`・`SessionDeleteError`）
      対象: `packages/server/src/persist/namedSession.ts`・`namedSession.test.ts`
      依存: T1, T2
      AC: AC6, AC7, AC8
- [x] T4: 起動オプションでの解決と socket のパス長の検査・案内文（`RawServeArgs.session`・`ServeOptions.sessionName`・
      `agentReportSocketPathFor`（composeServer.ts から移す）・`listenFailureHint`・`stateDirInUseError`）と `composeServer.ts` の定数の共有
      対象: `packages/server/src/config.ts` `resolveServeOptions` `listenFailureHint` `stateDirInUseError`・
      `packages/server/src/composeServer.ts` `agentReportSocketPathFor`・`config.test.ts`
      依存: T1
      AC: AC1, AC2, AC4, AC9, AC13
- [x] T5: CLI の引数（`--session`・`--json`・`session list|delete`）
      対象: `packages/server/src/cliArgs.ts` `parseArgs`・`cliArgs.test.ts`
      依存: なし
      AC: AC2, AC6, AC7, AC9
- [x] T6: 起動時の表示の session 行
      対象: `packages/server/src/startupBanner.ts` `startupLines`・`startupBanner.test.ts`
      依存: なし
      AC: AC10, AC9
- [x] T7: `wtm session list/delete`・`wtm token reset --session` の実行（`sessionCommands.ts`）と `main.ts` の配線・help
      対象: `packages/server/src/sessionCommands.ts`（新規）・`sessionCommands.test.ts`（新規）・`packages/server/src/main.ts`
      `runTokenReset` `runServe` `printHelp` `main`
      依存: T3, T4, T5, T6
      AC: AC6, AC7, AC10, AC12
- [x] T8: 結合テスト（名前付き session での起動・同じ名前の二重起動・別の名前の並行起動・規則外の名前で何も作らない）
      対象: `packages/server/src/composeServer.integration.test.ts`
      依存: T4
      AC: AC1, AC2, AC5
- [x] T9: docs（`docs/tls-setup.md`「起動と運用の注意」・`docs/verification.md`・`docs/herdr-parity.md` H33）
      対象: `docs/tls-setup.md`・`docs/verification.md`・`docs/herdr-parity.md`
      依存: T7
      AC: AC11
