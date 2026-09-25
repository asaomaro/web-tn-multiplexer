# 要件: worktree の作成先を設定できるようにする

## 背景 / 課題

herdr は設定ファイルで `worktrees.directory`（既定 `~/.herdr/worktrees`）を指定でき、worktree の
作成先を変更できる。web-tn-multiplexer にはこれに相当する仕組みが無く、`DefaultWorktreeService`
（`packages/server/src/git/WorktreeService.ts`）は `root` 引数を受け取れるにもかかわらず、
`composeServer.ts` がそれを渡していないため、作成先は常に `~/.wtm/worktrees` に固定されている。

この固定が実際に問題を起こしている: E2E（`packages/e2e/src/specs/workspace-tab-pane.spec.ts`）は
worktree の作成先をテスト用の一時ディレクトリへ差し替えられないため、実行のたびに開発機の
`~/.wtm/worktrees` 配下へ実物のディレクトリを作り、`afterEach` で手動の後片付け（`madeRepos` を
使った削除）をしている（20260920-git-worktree-actions decisions.md D7）。この後片付けはテストが
途中で落ちると効かず、実際に残骸が複数件見つかったことがある（同 D7）。

## 目的 / ゴール

`wtm serve` の起動時に worktree の作成先を指定できる状態にする。指定しなければ従来どおり
`~/.wtm/worktrees` が使われる状態を保つ（後方互換）。

## ユーザーストーリー

- US1: web-tn-multiplexer を運用する利用者として、worktree の作成先を `~/.wtm/worktrees` 以外の
  場所（別ディスク・共有ストレージ・テスト用の一時ディレクトリ等）に変えたい。なぜなら、既定の
  場所がホームディレクトリを圧迫する・複数の wtm を並行稼働させる・テストから既定の場所を
  汚したくない、といった事情に対応したいから。（受け入れ: AC1, AC2, AC3）

## スコープ

### 対象

- `wtm serve` に `--worktree-dir <path>` オプションを追加する（既存の `--scrollback`・`--shell`
  と同じ CLI フラグの形）。
- 指定した値を `DefaultWorktreeService` の `root` 引数として渡す配線（`composeServer.ts`）。
- 指定が無いときの既定値は現状のまま（`defaultWorktreeRoot()` = `~/.wtm/worktrees`）。
- `docs/herdr-parity.md` の H37 行・`docs/tls-setup.md`（起動オプションを列挙している既存の節群）
  への簡潔な追記。

### 対象外

- **設定ファイル（herdr の `worktrees.directory` 相当の永続設定）**: このリポジトリには
  アプリ設定を読むファイル機構がそもそも無く（`--host`・`--port`・`--scrollback`・`--shell` は
  全て CLI フラグ／環境変数〔`stateDir` のみ `XDG_STATE_HOME`〕で完結している）、新設するのは
  この work の範囲を大きく超える。herdr との対応は「設定できる」という効果の一致に留め、
  実現手段は既存の CLI フラグの慣習に合わせる。やるなら他の起動オプション（host/port/
  scrollback/shell 等）も含めた横断的な設計判断が要るため、独立した検討課題として backlog に
  別項目で残す。
  - **参考にした過去の判断**: 20260920-git-worktree-actions decisions.md D7 でも、この work と
    同じ理由（「設定の範囲を超える」）でファイル設定の追加を見送り、この backlog 項目へ送っている。
- **E2E（`workspace-tab-pane.spec.ts`）を新しいフラグに実際に乗せ替え、`afterEach` の手動後片付け
  を撤去すること**: D7 が挙げた動機そのものだが、E2E のフィクスチャ（`packages/e2e/src/support/
  appServer.ts`）・spec 双方の変更を伴い、この work（CLI フラグを1つ追加する）より一段大きい
  変更になる。フラグさえ用意できれば次の work で機械的に対応できるため、この work の直接の対象
  からは外し、backlog に新しい項目として明示的に残す（deliver で追加する）。
- 指定したパスの妥当性検証（存在確認・書き込み権限の事前チェック等）: 既存の `--state-dir`・
  `--cert`・`--key` も同様の事前検証を行っておらず（使用時に失敗すればその場でエラーになる）、
  この work だけ特別扱いする理由が無い。

## 機能要件

- `wtm serve --worktree-dir <path>` を指定すると、以後その起動セッションで作られる worktree は
  `<path>` 配下に作られる（`workspace のメニュー`・`prefix+G` のどちらの経路でも）。
- `--worktree-dir` を指定しない場合、既存の既定値（`~/.wtm/worktrees`）のまま変わらない。
- `--worktree-dir` に値を渡さずにオプションだけ指定した場合（例: 末尾に置く）は、既存の他の
  フラグ（`--host`・`--scrollback` 等）と同じ「値が無ければ `ConfigError`」の扱いにする。

## 非機能要件 / 制約

- 既存の CLI フラグ解釈（`cliArgs.ts` の `switch`）・起動オプション解決（`config.ts` の
  `resolveServeOptions`）と同じパターンに従う（新しい解析の仕組みを増やさない）。
- 値の追加検証（絶対パス強制・チルダ展開等）はしない——`--state-dir` と同じ扱い（シェルが
  `~` を展開する前提。環境によらずサーバ側で展開が要る場合は使う側が絶対パスを渡す）。

## 完了条件 (受け入れ基準)

- [ ] AC1: `wtm serve --worktree-dir <path>` で起動すると、worktree の作成（メニュー・
  `prefix+G` のどちらでも）が `<path>` 配下に作られる。
- [ ] AC2: `--worktree-dir` を指定せずに起動すると、従来どおり `~/.wtm/worktrees` 配下に作られる
  （既定値が変わらない）。
- [ ] AC3: `--worktree-dir` に値を渡さない（例: 末尾に置いて値が続かない）場合、既存の他の
  フラグと同じ形式の `ConfigError`（使い方つき）になる。
- [ ] AC4: `docs/herdr-parity.md`（H37 行）・`docs/tls-setup.md`（起動オプションを列挙している
  節群）に `--worktree-dir` の説明が追記されている。（US1 に紐づかない基準——利用者が実際に
  この機能を見つけて使えるための最低限の記述として並べている。）

## 未確定事項 / 確認したいこと

- `--worktree-dir` というフラグ名自体は herdr の `worktrees.directory` から意味を汲んだ独自案
  （このリポジトリの他フラグとの命名の一貫性を優先）。design で最終確認する。
- ドキュメント（`docs/herdr-parity.md` H37・`docs/tls-setup.md`）への追記の具体的な文面は design
  で確定する。
