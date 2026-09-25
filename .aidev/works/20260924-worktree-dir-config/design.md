# 仕様: worktree の作成先を設定できるようにする

## 概要

`wtm serve` に `--worktree-dir <path>` を追加する。既存の `--scrollback`・`--shell` と全く同じ形の
CLI フラグとして `cliArgs.ts`→`config.ts`（`RawServeArgs`→`resolveServeOptions`→`ServeOptions`）
→`composeServer.ts` を通し、`DefaultWorktreeService` の既存の `root` コンストラクタ引数（4番目。
既に `= defaultWorktreeRoot()` という既定値を持つ）へそのまま渡す。**値を渡さなければ
`undefined` のまま通り、`DefaultWorktreeService` 自身の既定値がそのまま効く**——config.ts 側で
デフォルト解決を行わない（`--shell` と同じパターン。`--state-dir` の `defaultStateDir()` 方式とは
あえて違える。理由は「設計方針」）。

## 設計方針

- **`--shell` のパターンに合わせる（`--state-dir` のパターンには合わせない）**: `ServeOptions`
  には `shell: string | undefined` があり、既定値の解決はしない（呼ばれる側——ここでは
  `DefaultWorktreeService` のコンストラクタ既定値——に委ねる）。一方 `stateDir: string` は
  `resolveServeOptions` 内で `args.stateDir ?? defaultStateDir(env)` として毎回解決している。
  `worktreeDir` は後者ではなく前者に合わせる。理由: `defaultWorktreeRoot()` は既に
  `DefaultWorktreeService` の唯一の呼び出し箇所（`composeServer.ts`）のすぐそばにあり、
  `config.ts` へ複製すると「既定値の定義がどこにあるか」が2箇所に分かれる。`defaultStateDir` は
  OS 判定を含み `config.ts` の責務（起動オプションの解決）に既に属しているため事情が違う。
- **バリデーション（存在確認・書き込み権限）はしない**: `--state-dir`・`--cert`・`--key` も
  事前検証をしておらず、使用時（実際に `git worktree add` を呼ぶ瞬間）に失敗すれば
  `RpcError`（`worktree_failed` 等。既存の `classifyWorktreeError`）としてクライアントに返る。
  この work だけ特別扱いしない（requirements「非機能要件」）。
- **チルダ展開・パス正規化はしない**: シェルが `~` を展開してから渡す前提（`--state-dir` と同じ）。
  `defaultWorktreeRoot()` 自身が返す既定値は `/` 区切りに正規化されている
  （`WorktreeService.ts:22`）が、利用者が明示的に渡した値はそのまま使う——正規化すると
  「既定値だけ特別扱い」になり一貫しない。

## 対象範囲

- `packages/server/src/cliArgs.ts`: `--worktree-dir` の `switch` 分岐・`USAGE` 文字列。
- `packages/server/src/main.ts`: `printHelp()` の使い方文字列（`cliArgs.ts` の `USAGE` とは
  別物。`wtm --help`/引数無しで実際に表示される方）。cross-task check で追記漏れが発覚
  （decisions.md D3）。
- `packages/server/src/config.ts`: `RawServeArgs.worktreeDir?: string`・
  `ServeOptions.worktreeDir: string | undefined`・`resolveServeOptions` での素通し。
- `packages/server/src/composeServer.ts`: `DefaultWorktreeService` の4番目の引数として
  `options.worktreeDir` を渡す。
- `docs/herdr-parity.md`（H37 行）・`docs/tls-setup.md`（既存の `--state-dir`/`--scrollback` の
  節と並ぶ短い節を追加）。
- `packages/server/src/cliArgs.test.ts`・`packages/server/src/config.test.ts`・
  `packages/server/src/composeServer.integration.test.ts`（上記の変更に対応する新規テスト。
  「テストで確認すること」「受け入れ基準との対応」参照）。
- 変更しない: `packages/server/src/git/WorktreeService.ts`（`root` 引数・`defaultWorktreeRoot()`
  は既存のまま。この work は呼び出し側の配線だけ）。`packages/e2e/*`（対象外。requirements
  参照）。

## 依拠する既存の事実

- `DefaultWorktreeService` のコンストラクタは4番目の引数 `root: string = defaultWorktreeRoot()`
  を既に受け取れる（`packages/server/src/git/WorktreeService.ts:69-76`）。`composeServer.ts:191`
  の呼び出し（`new DefaultWorktreeService(session, gitRunner, logger)`）は4番目を渡していない
  ため常に既定値になる。
- `defaultWorktreeRoot(home = homedir())`（同ファイル:21-23）が既定値の実体（`~/.wtm/worktrees`
  相当。`/` 区切りに正規化）。
- 既存の `--shell` フラグが、`RawServeArgs.shell?: string`（`config.ts:33`）→
  `ServeOptions.shell: string | undefined`（同:22。**解決なしでそのまま**）→
  `resolveServeOptions` 内 `shell: args.shell`（同:120）→`composeServer.ts:184`
  `shell: options.shell`（コメント「以前はどこにも渡しておらず効いていなかった」）という、
  今回と全く同じ「解決しない・素通しする」配線パターンの前例（research不要なほど明確な precedent）。
- `cliArgs.ts` の `switch`（同:43-71）に `--scrollback`（63-65）・`--shell`（66-68）の2行の
  分岐があり、`USAGE`（同:10）に列挙されている。`--worktree-dir` もこの形に1行足すだけで済む。
  値が無ければ `next()`（同:37-41）が `ConfigError` を投げる——既存の全フラグ共通の挙動
  （AC3 はここに乗るだけで新しいコードは要らない）。
- `worktree.create` RPC（`packages/server/src/surface/methods/worktree.ts:16-19`）は
  `deps.worktrees.create(workspaceId, branch)` を呼び、`WorktreeCreateResult.path`
  （`packages/protocol/src/messages.ts:340-343`）を返す——`DefaultWorktreeService.create`
  （`WorktreeService.ts:125-128`）は `defaultCheckoutPath(this.root, repoName, branch)` で
  パスを組み立てる。`root` は `create()` 呼び出し時点の `this.root`（＝コンストラクタで
  渡した値）がそのまま使われる。
- `DefaultWorktreeService` の `root` 引数自体の挙動（`create()` が実際にその配下へ worktree を
  作ること）は `WorktreeService.test.ts`（本物の git を使う。`root = await makeTempDir(...)` を
  渡すテストが既に多数ある）で既に厚く検証済み——この work で重複して検証しない。この work で
  新しく検証すべきは「CLI フラグから `DefaultWorktreeService` の `root` まで実際に配線が
  繋がっているか」の1点。
- `defaultWorktreeRoot()` 自体の計算（`home` からの組み立て・`/` 区切りへの正規化）を検証する
  既存テストが `WorktreeService.test.ts:296-299`（`describe("defaultWorktreeRoot", ...)`。
  `defaultWorktreeRoot("/home/me")` → `"/home/me/.wtm/worktrees"` 等）に既にある。この work では
  変更しない（AC2 の裏付けの一部。「テストで確認すること」参照）。
- `composeServer.integration.test.ts:315` に、`--shell` を同じ配線パターンで検証した precedent
  がある（`composeServer({..., shell})` を実際に起動し、RPC で pane を作らせてその `cwd` を
  確認する形）。`worktree.create` RPC を使った同種の end-to-end テストはまだこのファイルに無い
  （`grep` で確認済み。追加は本 work が初）。

## インターフェース / データ構造

### `cliArgs.ts`

```ts
const USAGE =
  "使い方: wtm serve [--host H] [--port P] [--cert F] [--key F] [--origin O]... [--state-dir D] [--scrollback N] [--shell S] [--worktree-dir D] / wtm token reset [--state-dir D]";

// switch (arg) 内、--shell の次に追加:
case "--worktree-dir":
  serve.worktreeDir = next();
  break;
```

### `config.ts`

```ts
export interface ServeOptions {
  // ...既存のまま
  shell: string | undefined;
  worktreeDir: string | undefined; // 20260924-worktree-dir-config。既定値の解決はしない（--shell と同じ）
}

export interface RawServeArgs {
  // ...既存のまま
  shell?: string;
  worktreeDir?: string;
}

export function resolveServeOptions(args: RawServeArgs, env: NodeJS.ProcessEnv = process.env): ServeOptions {
  // ...既存のまま
  return {
    // ...既存のまま
    shell: args.shell,
    worktreeDir: args.worktreeDir, // 素通し。既定は DefaultWorktreeService 側（defaultWorktreeRoot）に委ねる
  };
}
```

### `composeServer.ts`

```ts
// 変更前: const worktrees = new DefaultWorktreeService(session, gitRunner, logger);
const worktrees = new DefaultWorktreeService(session, gitRunner, logger, options.worktreeDir);
```

## 振る舞いの詳細

1. **指定あり（AC1）**: `wtm serve --worktree-dir /custom/path` → `serve.worktreeDir = "/custom/path"`
   （cliArgs）→ `options.worktreeDir = "/custom/path"`（config、素通し）→
   `new DefaultWorktreeService(..., "/custom/path")` → 以後の `create()` は
   `defaultCheckoutPath("/custom/path", repoName, branch)` を使う。
2. **指定なし（AC2）**: `serve.worktreeDir = undefined` → `options.worktreeDir = undefined` →
   `new DefaultWorktreeService(..., undefined)` → TypeScript のデフォルト引数の意味論により
   `root` パラメータの既定値 `defaultWorktreeRoot()` が呼ばれる（`undefined` を明示的に渡すのと
   省略するのは等価）。**この経路は変更前と挙動が完全に同じ**（`composeServer.ts` 側のコードは
   変わるが、結果として渡る値は変わらない）。
3. **値なしで指定（AC3）**: `wtm serve --worktree-dir`（末尾で値が続かない）→ 既存の `next()`
   ヘルパーが `ConfigError("missing value for --worktree-dir", "--worktree-dir には値が要ります。")`
   を投げる——新しいエラー処理コードは不要（既存の全フラグ共通の経路）。

## ドメイン固有の考慮

- herdr の `worktrees.directory` は設定ファイルの1項目だが、このリポジトリには設定ファイル
  機構が無いため、CLI フラグとして提供する（requirements「対象外」）。効果（作成先を変えられる）
  は一致させるが、実現手段はこのリポジトリの既存の慣習を優先する。

## エラー処理 / 異常系

- 値が無い: 上記「振る舞いの詳細」3（既存の `ConfigError` 経路）。
- 指定したパスが存在しない・書き込めない: 事前検証しない（設計方針）。`git worktree add` が
  失敗すれば既存の `classifyWorktreeError`（`worktree_failed` 等）で `RpcError` になる——
  この work が新設する分岐ではない。

## テストで確認すること（実装時の注意）

- **`composeServer.integration.test.ts` へ新しく追加するテストは、実ホームディレクトリを
  汚さないよう、必ず `--worktree-dir` にテスト用の一時ディレクトリを渡す**（`--worktree-dir` を
  省略した「既定値のまま」のケースを composeServer レベルの実 git 統合テストで確認しては
  ならない——確認すると `~/.wtm/worktrees` に実物のディレクトリを作ってしまい、この work が
  解決しようとしている D7 の問題をテスト側で再現することになる）。AC2（既定値が変わらないこと）は
  ①`config.test.ts` で `resolveServeOptions({}).worktreeDir` が `undefined` のままであることと、
  ②既存の `WorktreeService.test.ts`「defaultWorktreeRoot」テスト（`defaultWorktreeRoot()` 自体の
  計算が正しいこと。この work では変更しない）の組み合わせで裏付ける——実 git を使う
  end-to-end レベルでは検証しない。

## 受け入れ基準との対応

- AC1: 「振る舞いの詳細」手順1。`composeServer.integration.test.ts` に、`--worktree-dir` に
  一時ディレクトリを渡して起動し、`worktree.create` RPC で実際に作られたパスがその配下である
  ことを確認する新規テストで検証する。
- AC2: 「振る舞いの詳細」手順2。上記「テストで確認すること」のとおり、実 git の end-to-end では
  検証せず、`config.test.ts`（素通しの確認）＋既存の `defaultWorktreeRoot` テストの組み合わせで
  裏付ける。
- AC3: 「振る舞いの詳細」手順3。`cliArgs.test.ts` に `parseArgs(["serve", "--worktree-dir"])` が
  `ConfigError` を投げることを確認するケースを足す（既存の「値の無いオプションは ConfigError」
  テストへ追加）。
- AC4: `docs/herdr-parity.md` H37 行に一言追記し、`docs/tls-setup.md` に `--scrollback`・
  `--state-dir` と並ぶ短い節（`### worktree の作成先（--worktree-dir）`）を追加する。
