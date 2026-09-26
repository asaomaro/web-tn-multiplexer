# 仕様: pnpm のスクリプトを「失敗が見える」形にする

## 概要

ルートの `typecheck`・`build` スクリプトを、新設する `scripts/run-quiet.mjs`（Node 製の薄いラッパー）
経由の呼び出しに変える。ラッパーは `-s` で呼ばれたとき（`npm_config_reporter === "silent"`）だけ、
元のコマンドの標準出力・標準エラー出力をいったんバッファへためる。子プロセスが exit code 0 で
終われば何も出さずに終了し（今までの `-s` の静かな挙動を保つ）、非0で終われば、ためた出力を
まとめて標準出力へ書き出してから同じ exit code で終了する。`-s` 無しで呼ばれたときは
`stdio: "inherit"` で素通しし、今までと同じ出力（途中経過・警告を含む）をそのまま流す
（review round1 の指摘で変更。decisions.md D7）。

## 設計方針

- **「`-s` を使わない・使わせない」ではなく「`-s` を透過的に無害化する」を採る**: backlog・実測の
  とおり、`-s` 自体は「複数パッケージをまとめて動かすときに静かにする」という有用な目的で使われて
  おり、単純に「今後 `-s` を禁止する」運用は現実的でない（`docs/verification.md`・
  `.aidev/config.yml`・多数の work の test-result.md が既に `pnpm -s …` を書いている。全てを
  書き換えるのは requirements.md「スコープ / 対象外」が明示的に対象外とした広範囲な変更になる）。
  ラッパーを **`-s` の有無に関わらず同じ結果になる**形にすれば、呼び出し側を一切変えずに直せる
  （下記「依拠する既存の事実」「振る舞いの詳細」参照）。
- **バッファ→失敗時にまとめて吐き出す方式を採る**（代替案「`--reporter=append-only` に変える」は
  却下）: pnpm の `run --help` に "Only `--reporter=append-only` is supported"（`--parallel` 使用時）
  という記載があり、これに乗り換える案も検討したが、`append-only` は各行にパッケージ名を前置する
  形式で、**成功時にも各パッケージのログ行を出す**（`-s` が実現していた「成功時は完全に静か」を
  失う）。バッファ方式なら「成功時は完全に静か・失敗時は完全な出力」の両立ができる。
- **原因は pnpm 自体の未修正の既知動作として扱う**（pnpm 側にパッチを当てる・alternative
  パッケージマネージャへ移行する等は取らない）。理由: 影響範囲は本リポジトリの `typecheck`・
  `build` の2スクリプトに限られ、リポジトリ内で完結する回避策（本 design）で十分に塞げるため。

## 対象範囲

- `package.json`（ルート）: `typecheck`・`build` スクリプトの呼び出し文字列を変更。
- `scripts/run-quiet.mjs`（新規）。

## 依拠する既存の事実

- ルートの `package.json`（`typecheck`: `"pnpm -r --filter=./packages/* run typecheck"`、`build`:
  同型の `run build`）は、`packages/*` にマッチする5パッケージ（protocol・server・web・cli・e2e。
  `pnpm typecheck` の実行ログ「Scope: 5 of 6 workspace projects」で実測済み）を対象に
  `pnpm -r` で再帰実行する。`packages/protocol/src/index.ts`（9行）は実在する（`ls`/`wc -l` で
  確認済み）——下記「受け入れ基準との対応」AC1〜AC3・AC5 で、この既存ファイルへ型エラーを
  一時的に仕込む対象として使う。
- `packages/protocol/package.json` の `build` スクリプトは `"tsc -b"`（`packages/protocol/
  package.json` で確認済み）——TypeScript のプロジェクトビルドモードで、`tsc --noEmit`
  （`typecheck` が使う形）と同様に型検査を行い、型エラーがあれば失敗する。よって
  `packages/protocol/src/index.ts` に仕込む型エラーは `build`（AC2・AC5 が検証対象とする）も
  同じく失敗させる。実測（`packages/protocol build$ tsc -b` →
  `packages/protocol build: src/index.ts(11,7): error TS2322: … Failed`。exit 1）で確認済み
  （詳細は decisions.md D4）。
- pnpm 9.15.9 の `pnpm run <script>` に `-s`（`--silent`。`pnpm help run` に "Or use `--silent` to
  turn off all logging" と記載）を付けて実行すると、**対象パッケージが2つ以上のとき**、子プロセスの
  標準出力・標準エラー出力を**失敗時も含めて完全に**抑制する（pnpm 自身の飾り行だけでなく、
  実行したコマンド自身の出力も消える。終了コードだけが残る）。対象が1パッケージだけのときは
  この抑制は起きない（子プロセスの出力は残り、pnpm 自身の飾り行だけが消える）。いずれも実測で
  確認済み（`/tmp/silent-probe2` に作った最小の pnpm workspace で、1パッケージ・2パッケージの
  両方を試して比較した）。
- `pnpm run <script>` を `-s` 付きで実行すると、環境変数 `npm_config_reporter=silent` が
  子プロセスへ渡る（実測。ルート `package.json` に一時的な検証用スクリプトを足し、
  `pnpm -s` 経由で `process.env` をダンプして確認済み。`npm_config_loglevel` という別名の
  環境変数は同じダンプで**実在しなかった**——`pnpm help run` の "Or use `--silent` to turn off
  all logging" という記載から類推して念のため削除対象に加えているだけの防御的な措置で、
  実測で存在を確認したものではない。削除しても存在しないキーの `delete` は no-op なので害は無い）。
  ラッパーがこの環境変数をそのまま継承したまま内部で `pnpm -r …` を spawn すると、その spawn
  した pnpm 自身も silent reporter で動いてしまい、ラッパーが捕まえたいはずの出力がそもそも
  子プロセスから出てこない（同じ症状がラッパーの内側で再発する。requirements 前の
  investigative work で発見・実測して確認。詳細は decisions.md D1）。
- `test`（`vitest run`）は pnpm の recursive runner を経由せず、vitest 自身の
  `test.projects: ["packages/*"]`（`vitest.config.ts`）でパッケージをまたぐため、上記の
  pnpm 側の抑制は掛からない（実測: 失敗するテストを一時的に仕込み、`pnpm -s test` で
  失敗メッセージが残ることを確認済み）。`lint`（`eslint . --ext .ts`）も単一プロセスの
  非再帰呼び出しで対象外（実測: 一時的に ESLint 違反のあるファイルを追加し、`pnpm -s lint`
  でその違反箇所を含むエラー一覧が標準出力に残ることを確認済み）。

## インターフェース / データ構造

`scripts/run-quiet.mjs`:

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";

const command = process.argv[2]; // 実行するコマンド文字列（1つ）
// quiet: process.env.npm_config_reporter === "silent"（pnpm -s のときだけ true）
// quiet でない → spawn(command, { shell: true, stdio: "inherit" }) で素通しし、
//                close で process.exit(code ?? 1)（error は下と同じ扱い）
// quiet のとき（以下）:
// childEnv: process.env から npm_config_reporter・npm_config_loglevel を除いたもの
// child: spawn(command, { shell: true, stdio: ["inherit", "pipe", "pipe"], env: childEnv })
// chunks: child の stdout/stderr の data イベントを溜める配列
// error イベント（spawn 自体の起動失敗。「エラー処理 / 異常系」参照）:
//   理由を標準エラーへ出して process.exit(1)
// close イベント:
//   code === 0 → 何も出さず process.exit(0)
//   code !== 0 → バナー行＋Buffer.concat(chunks) を書き出し、write のコールバックを待ってから
//                process.exit(code ?? 1)（write が非同期のパイプでも exit 前に必ず出し切る。
//                signal !== null なら書き出し後にシグナル名も追記。「エラー処理 / 異常系」参照）
```

`package.json`（差分イメージ）:

```json
"build": "node scripts/run-quiet.mjs \"pnpm -r --filter=./packages/* run build\"",
"typecheck": "node scripts/run-quiet.mjs \"pnpm -r --filter=./packages/* run typecheck\"",
```

外側の二重引用符（`\"…\"`）の役割は、**シェルグロブの抑止ではなく引数の分割の防止**である
（当初「グロブ展開を防ぐ」と説明していたが、design doccheck round2 の指摘で再検証し訂正した。
詳細は decisions.md D4）。npm/pnpm がこの script 文字列をシェル経由で実行する際、二重引用符が
無いと `pnpm -r --filter=./packages/* run typecheck` が空白区切りでバラバラに分割され、
`node scripts/run-quiet.mjs` への引数が `"pnpm"` 1語だけになってしまう（`process.argv[2]` が
`"pnpm"` になり、残りの `-r`・`--filter=…`・`run`・`typecheck` は読まれない）。二重引用符で
囲むことで、この文字列全体が `run-quiet.mjs` への**1つの引数**としてまとまる。
`--filter=./packages/*` 自体は、二重引用符の有無に関わらずどのシェルでもグロブ展開されない
（`--filter=` が `*` の直前の path segment に融合しており、その path segment
（`--filter=.`）に一致するディレクトリが存在しないため、既定の非 nullglob 動作でパターンが
そのまま残る。`bash -c 'echo --filter=./packages/*'` で実際に無展開のまま出力されることを
確認済み。一方 `bash -c 'echo ./packages/*'`（`--filter=` 無し）は5パッケージへ展開される
ことも確認済み——両者の違いは prefix の有無だけで、引用符とは無関係）。

## 振る舞いの詳細

- `-s` 付き・成功時（exit 0）: `run-quiet.mjs` は何も出力しない。呼び出し元から見た挙動は
  今までと変わらない。
- `-s` 付き・失敗時（exit ≠ 0）: `run-quiet.mjs` はバナー行（`run-quiet: 失敗しました（exit
  <code>）。捕捉した出力:`）に続けて、子プロセスの標準出力・標準エラー出力を（発生順に混ぜて）
  そのまま書き出し、同じ exit code で終了する。子の環境から `npm_config_reporter`/
  `npm_config_loglevel` を外すので、内側の pnpm は silent にならない（「依拠する既存の事実」参照）。
- `-s` 無し: `stdio: "inherit"` で素通しする。成功・失敗とも今までと同じ出力がそのまま流れ、
  バナーも付かない（`pnpm --reporter=append-only` のような silent 以外の reporter も同様に素通し。
  `npm_config_reporter` が `-s` で `silent`、無指定で未設定、`--reporter=append-only` で
  `append-only` になることは実測済み。decisions.md D7）。
- 子プロセス自体が起動できない場合（コマンドが存在しない等）は `spawn` の `error` イベントで捕捉し、
  理由を標準エラーへ出して exit 1 で終了する（想定外の握りつぶしを避ける）。

## ドメイン固有の考慮

- 該当なし（このリポジトリのビルド・型検査のツール構成に閉じた問題で、herdr との対応表
  （`docs/herdr-parity.md`）に載る性質の差分ではない）。

## エラー処理 / 異常系

- 子プロセスが起動できない（`ENOENT` 等）: `child.on("error", ...)` で捕捉し、`run-quiet: コマンドの
  起動に失敗しました: <message>` を標準エラーへ出して exit 1。
- シグナルで終了した場合（`code === null` かつ `signal !== null`）: バナー・出力を書き出した後、
  シグナル名を標準エラーへ追記して `code ?? 1` で終了する（`code` が無い異常終了でも 0 では
  終わらせない）。
- **この2つの異常系には対応する AC を設けない**（下記「受け入れ基準との対応」参照）。
  `pnpm`・`node` はこのリポジトリの開発環境で必ず存在するため spawn 自体が失敗する経路は
  通常の作業では再現できず、シグナル終了（作業中の Ctrl+C 等）を意図的に発生させて検証する
  ことも同様に再現性が低い。どちらも一般的な防御的実装（想定外の状況で沈黙せず exit 0 以外で
  終える）として書いており、この work が閉じようとしている具体的な穴（型検査・ビルドの失敗が
  無出力になる）とは別範疇と判断した。

## 受け入れ基準との対応

- AC1: `scripts/run-quiet.mjs`＋ `package.json` の `typecheck` 差し替えに対し、
  `packages/protocol/src/index.ts` に型エラーを一時的に仕込み `pnpm -s typecheck` を実行 →
  標準出力に対象パッケージ名・対象ファイル・エラーメッセージが残ることを確認する
  （regression-negative-control 相当の実地確認。test 工程で実行し、raw ログを test-result.md
  に残す）。
- AC2: 同様に `pnpm -s build` で確認する。
- AC3: 型エラーを戻した状態で `pnpm -s typecheck`・`pnpm -s build` を実行し、出力が一切無く
  終了コード 0 であることを確認する。加えて `pnpm build`（-s 無し）の成功時に vite の出力・警告が
  流れることを確認する（decisions.md D2 の H）。
- AC4: `pnpm -s test`・`pnpm -s lint` が無改修のまま動作することを、実行結果（終了コード 0・
  出力内容がこの work の変更と無関係であること）で確認する。
- AC5: `typecheck`・`build` の両方について、`pnpm -s <script>`（-s あり）と `pnpm <script>`
  （-s 無し）の両方で型エラーを仕込んだ状態の出力を比較し、いずれも失敗の内容が残ることを
  確認する。
