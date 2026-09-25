# テスト結果: worktree の作成先を設定できるようにする

## 実行したもの

- `packages/server`: `npx tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — 800 passed / 0 failed / 0 skipped（794→800 に増加分の内訳は下記）
- ルート: `pnpm -s typecheck` — exit 0（3パッケージ横断の再確認）・`pnpm -s test` —
  2941 passed / 0 failed（protocol・server 800・web。この work の変更対象は server のみだが、
  無改修で全て pass することを確認）
- `aidev smoke` — PASS（web・CLI 双方。下記「起動確認」参照）
- `aidev coverage --strict` — ac=4 design=4/4(100%) tasks=4/4(100%) gaps=0

## T5（回帰確認）の実施内容

- `cliArgs.test.ts`（既存6テスト + 新規2テスト）: 無改修のまま全て pass。既存の
  `--state-dir`・`--host`・`--origin` 等のパース、`token reset` の分岐、未知のオプション/
  サブコマンドの `ConfigError` は影響を受けていない。
- `config.test.ts`（既存9テスト + 新規1テスト）: 無改修のまま全て pass。既存の
  `host`/`port`/`cert`/`key`/`scrollback`/`stateDir` の解決ロジックは影響を受けていない。
- `composeServer.integration.test.ts`（既存18テスト + 新規1テスト）: 無改修のまま全て pass。
  既存の起動・再起動・ロック・エージェント検出・「引き継ぐ」cwd 等のテストは影響を受けていない。
- `WorktreeService.test.ts`（無改修。この work は `root` 引数自体の実装には触れていない）:
  全て pass——`DefaultWorktreeService` の `root`/`defaultWorktreeRoot()` の挙動そのものは
  この work で変更していないことの裏付け。

## 受け入れ基準ごとの判定

- AC1: pass — `composeServer.integration.test.ts`「`--worktree-dir` で起動すると、
  worktree.create RPC で作られたパスがその配下になる」で確認。実際に `composeServer` を
  `--worktree-dir` 付きで起動し、`client.hello`→`workspace.create`（一時 git リポジトリ）→
  `worktree.create` RPC の一連の流れで、返ってきたパスが指定した一時ディレクトリ配下である
  ことを確認した（本物の git を使う end-to-end）。
- AC2: pass — `config.test.ts`「worktreeDir は素通しする」で、未指定時に `undefined` のまま
  であることを確認。既定値の実際の計算（`defaultWorktreeRoot()`）は無改修の
  `WorktreeService.test.ts`「defaultWorktreeRoot」テストが裏付ける。design「テストで確認する
  こと」のとおり、実ホームディレクトリを使う end-to-end レベルでは検証していない（理由は
  decisions.md D2 で実際に負の確認中に実物のディレクトリが作られたことで具体的に確認済み）。
- AC3: pass — `cliArgs.test.ts`「`--worktree-dir` に値が続かなければ ConfigError」で、
  `err.message` が `"missing value for --worktree-dir"` になることを確認（`next()` の経路を
  実際に通っていることまで検証。decisions.md D1 で強化した版）。
- AC4: pass — `docs/herdr-parity.md`（H37 行）・`docs/tls-setup.md`（新設の節）・
  `packages/server/src/main.ts`（`printHelp()`。cross-task check で追記漏れが発覚し対応済み。
  decisions.md D3）の3箇所に `--worktree-dir` の説明がある。

## 失敗の証跡

T2 taskcheck round1（must 2件。decisions.md D1）: switch 分岐の実装漏れと、それを見逃す弱い
テストがあった。負の確認の生ログ:

```
FAIL  src/cliArgs.test.ts > parseArgs（CLI の引数） > --worktree-dir を読む（20260924-worktree-dir-config）
ConfigError: unknown option: --worktree-dir
 ❯ parseArgs src/cliArgs.ts:70:15

FAIL  src/cliArgs.test.ts > parseArgs（CLI の引数） > --worktree-dir に値が続かなければ ConfigError（20260924-worktree-dir-config）
AssertionError: expected 'unknown option: --worktree-dir' to be 'missing value for --worktree-dir'

Test Files  1 failed (1)
     Tests  2 failed | 6 skipped (8)
```

修正後、上記2件とも pass・8件全て green を確認済み。

T3 の負の確認（decisions.md D2）: `composeServer.ts` の配線を戻すと、新規 end-to-end テストが
実際に失敗することを確認済み：

```
AssertionError: expected false to be true // Object.is equality
 ❯ src/composeServer.integration.test.ts:448:49
```

（この際、実ホームディレクトリの `~/.wtm/worktrees/` に実物のディレクトリが作られたため、
確認後に削除済み。詳細は decisions.md D2。）

cross-task check（must 1件。decisions.md D3）: `main.ts` の `printHelp()` に
`--worktree-dir` が抜けていた。修正して typecheck・全テスト再実行で確認済み（既存に
`printHelp()` 自体のテストが無いため、新規テストは追加していない——理由も D3 に記録）。

このラウンドでは他に失敗は発生していない。

## 起動確認（smoke）

```
$ aidev smoke
smoke: starting server on 127.0.0.1:38086 (state dir /tmp/wtm-smoke-UgIr36)
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
$ pnpm --filter @wtm/cli run smoke
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

この work は既存の smoke 起動経路（`wtm serve`・引数無し）を使っており、`--worktree-dir` を
指定しなくても既定値のまま動くことを smoke 自体が間接的に裏付ける（新しい起動経路は追加して
いないため `smokeCommands` への追記は不要）。

## 未検証の穴（skip / 環境不足）

- **実際にブラウザから workspace のメニュー・`prefix+G` を操作して worktree を作る目視確認は
  行っていない**（このセッションの既定方針: E2E はユーザー依頼のときだけ実施。AC1 の実質的な
  検証は `composeServer.integration.test.ts` の RPC レベルの end-to-end テストで行った——
  `worktree.create` RPC のハンドラ自体はこの work で変更していないため、この粒度の検証で
  十分と判断した）。
- **複数の wtm を異なる `--worktree-dir` で並行起動する運用シナリオの実機確認はしていない**
  （requirements・design のスコープ外。単体・統合テストで配線自体の正しさは確認済み）。
- **WSL/Windows など実機・複数 OS 環境での `--worktree-dir`（パス区切り等）の確認はしていない**
  （同上の理由。`--worktree-dir` はパスをそのまま `git worktree add` に渡すだけで、この work
  独自のパス処理は追加していない）。
