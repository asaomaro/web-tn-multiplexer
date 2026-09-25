# タスク: worktree の作成先を設定できるようにする

## 実装方針

design.md の配線順に積む。`config.ts`（T1）が `RawServeArgs.worktreeDir`/
`ServeOptions.worktreeDir` の型を定義するため、`cliArgs.ts`（T2）・`composeServer.ts`（T3）は
どちらもこれに依存する（T2・T3 自体はファイルが重ならないため、T1 の後は並行してもよい）。
ドキュメント（T4）が必要とするのは T2 が確定させるフラグ名・`USAGE` 文言だけで、T3（内部配線）
の完了は前提にしない——T4 の `依存:` は T2 のみ。回帰確認（T5）は全ての変更（T3・T4）が
出揃ってから行う。

## 作業順序と依存関係

下の `依存:` に従う。T2・T3 は T1 の後、互いにファイルも重ならないため並行可。

## リスク / 留意点

- **T3 の統合テストは実ホームディレクトリを汚さないこと**（design「テストで確認すること」）。
  `--worktree-dir` に必ずテスト用の一時ディレクトリを渡し、既定値（`~/.wtm/worktrees`）を
  実際に使う end-to-end テストは書かない。
- **`worktreeDir` は `shell` と同じ「素通し・既定値は解決しない」パターンに従う**（T1。
  `stateDir` の `defaultStateDir()` パターンとは違える。design「設計方針」）。

## テスト方針

- `cliArgs.test.ts`: `--worktree-dir` の値あり（`parsed.serve.worktreeDir` に反映）・値なし
  （`ConfigError`）を確認する（T2）。
- `config.test.ts`: `resolveServeOptions` が `worktreeDir` を素通しすること（指定時はその値、
  未指定時は `undefined` のまま）を確認する（T1）。
- `composeServer.integration.test.ts`: 実際に `composeServer` を `--worktree-dir` 付きで起動し、
  `worktree.create` RPC で作られたパスがその配下であることを確認する（T3。AC1 の直接の検証）。
- 全タスク完了後、既存の cliArgs/config/composeServer/WorktreeService 関連テスト全体が無改修の
  まま通ることを確認する（T5。coding ではなく test 工程で最終確認する——このセッションの他 work
  と同じ扱い）。

## タスク

- [x] T1: `config.ts` に `RawServeArgs.worktreeDir`・`ServeOptions.worktreeDir` を追加し、
      `resolveServeOptions` で素通しする。`config.test.ts` に確認テストを足す。
      対象: `packages/server/src/config.ts`（`RawServeArgs`:25-34・`ServeOptions`:13-23・
      `resolveServeOptions`:95-122。`shell` フィールドが precedent）・`config.test.ts` /
      根拠: design.md「インターフェース / データ構造 > config.ts」
      依存: なし
      AC: AC2

- [x] T2: `cliArgs.ts` に `--worktree-dir` の `switch` 分岐・`USAGE` 文字列を追加する。
      `cliArgs.test.ts` に値あり・値なし（`ConfigError`）の確認テストを足す。
      対象: `packages/server/src/cliArgs.ts`（`USAGE`:10・`switch`:43-71。`--shell`:66-68 が
      precedent）・`cliArgs.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      cliArgs.ts」
      依存: T1
      AC: AC3

- [x] T3: `composeServer.ts` で `DefaultWorktreeService` の4番目の引数に `options.worktreeDir`
      を渡す。`composeServer.integration.test.ts` に、実ホームディレクトリを汚さない
      end-to-end テスト（`--worktree-dir` に一時ディレクトリ・`worktree.create` RPC で確認）
      を足す。
      対象: `packages/server/src/composeServer.ts:191`・`composeServer.integration.test.ts`
      （`shell` の統合テスト:315 が precedent） / 根拠: design.md「インターフェース /
      データ構造 > composeServer.ts」「テストで確認すること」
      依存: T1
      AC: AC1

- [x] T4: `docs/herdr-parity.md`（H37 行）・`docs/tls-setup.md`（`--scrollback`/`--state-dir` と
      並ぶ短い節）に `--worktree-dir` を追記する。
      対象: `docs/herdr-parity.md:69`・`docs/tls-setup.md`（`--state-dir`:398-419・
      `--scrollback`:476-483 が precedent） / 根拠: design.md「受け入れ基準との対応 AC4」
      依存: T2
      AC: AC4

- [x] T5: 既存の cliArgs/config/composeServer/WorktreeService 関連テストが全て無改修のまま
      通ることを確認する（回帰確認）。**coding ではなく test 工程で消化する**（このセッションの
      他 work と同じ扱い）。
      対象: `cliArgs.test.ts`・`config.test.ts`・`composeServer.integration.test.ts`・
      `WorktreeService.test.ts`（既存ファイルをそのまま実行するだけ。変更はしない） /
      根拠: design.md「対象範囲」（変更しない、とされる既存ファイル群）
      依存: T3, T4
      AC: なし
