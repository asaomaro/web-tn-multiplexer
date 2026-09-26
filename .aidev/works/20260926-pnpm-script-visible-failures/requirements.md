# 要件: pnpm のスクリプトを「失敗が見える」形にする

## 背景 / 課題

backlog（`.aidev/backlog/product-roadmap.md`）: 「pnpm のスクリプトを「失敗が見える」形にする:
pnpm -s の再帰実行は失敗時に何も出力せず終了コードだけが変わる。ルートの script か CI の呼び出しで
出力と終了コードを必ず残す（この work で誤った結論を decisions.md に書き、後で訂正した）」
（出典: `.aidev/works/20260918-web-terminal-multiplexer/retro.md`）。**括弧内の「この work」は
出典元である 20260918-web-terminal-multiplexer 自身を指す**（その work の decisions.md に誤った
結論を書き、後で訂正したという、backlog 起票時点の経緯注記。本 work（20260926）とは無関係——
本 work の decisions.md はこの backlog 行が書かれた時点でまだ存在しない）。

この session 自身も、この gotcha に複数回遭遇している——ルートの `pnpm -s typecheck` が型エラーを
仕込んでも exit code 以外は何も出さず、`| tail` 等で追加確認しない限り失敗を見落とす。

実際に手を動かして確かめた結果（詳細は下記「機能要件」「非機能要件」に反映）:

- ルートの `typecheck`（`pnpm -r --filter=./packages/* run typecheck`）・`build`（同型）は、
  `-s`（`--silent`。`--loglevel=silent` と同義）を付けて実行すると、対象パッケージが2つ以上
  マッチするとき、失敗しても**何も出力しない**（exit code だけが変わる。実測で再現・記録済み）。
  対象1パッケージだけなら子プロセスの出力は残る（pnpm 自身の飾り行だけが消える）ため、
  この穴は「`-r` で複数パッケージが対象」のときだけ顕在化する。
- ルートの `test`（`vitest run`。vitest 自身が `test.projects` で複数パッケージをまとめる）・
  `lint`（`eslint . --ext .ts`。単一プロセス）は、`-s` を付けても失敗時の出力が消えない
  （実測で確認済み。pnpm の recursive runner を経由しないため）。
- リポジトリに `.github/` は存在せず、自動 CI パイプラインは無い。backlog が言う「CI の呼び出し」は
  `docs/verification.md`「Linux（CI・手元）」節の、太字「CI」で始まる段落が挙げる手動のコマンド列
  （`pnpm -s typecheck && pnpm -s lint && pnpm -s test && pnpm -s build && pnpm -s smoke && …`）と、
  `.aidev/config.yml` の `smokeCommands`（`pnpm -s build && pnpm -s smoke`）を指す。
- 対策として `pnpm -r …` を子プロセスとして spawn するラッパーを試作したところ、`-s` を付けた
  ときだけラッパー自身の出力も中身が空になる別の穴に当たった。原因を `process.env` のダンプで
  特定: `pnpm run <script>` は `-s` 付き実行時に `npm_config_reporter=silent`（`npm_config_loglevel`
  も同様）という環境変数を子プロセスへ渡しており、ラッパーがこれをそのまま継承して内部の
  `pnpm -r …` を spawn すると、その内側の pnpm も silent reporter で動いてしまい、ラッパーが
  捕まえる前に子の出力そのものが無くなる（同じ症状がラッパーの内側で一段深く再発する）。
  ラッパーが spawn する子プロセスの環境からこの2つの環境変数を明示的に外せば防げることを
  実測で確認済み（詳細は decisions.md D1）。

## 目的 / ゴール

`typecheck`・`build` が失敗したとき、`-s` を付けて呼んでも、その失敗の内容（コンパイルエラー等の
実際のメッセージ）が必ず標準出力に残っている状態にする。成功したときは、今までどおり出力が
静かなまま（`-s` を付ける動機だった簡潔さを損なわない）。

## ユーザーストーリー

- US1: このリポジトリで作業する開発者・AI エージェントとして、`pnpm -s typecheck`（や `build`）が
  exit code 以外の手掛かりを一切出さずに失敗する状態を無くしたい。なぜなら、`-s` を付けたコマンドの
  失敗を「原因不明のまま再実行」「別のログを漁る」で調べ直す手間が発生し、単純な型エラーの
  発見が遅れるから。（受け入れ: AC1, AC2, AC3, AC4, AC5）

## スコープ

### 対象

- ルートの `package.json` の `typecheck`・`build` スクリプトを、失敗時に出力を保証するラッパー
  （`scripts/run-quiet.mjs`。新規）経由の呼び出しに変える。
- 上記ラッパー自体（新規ファイル）。

### 対象外

- `test`（`vitest run`）・`lint`（`eslint . --ext .ts`）スクリプトの変更。実測のとおり、この2つは
  `-s` を付けても失敗時の出力が消えないため、対象の穴が無い。
- `docs/verification.md`「Linux（CI・手元）」節の、太字「CI」で始まる段落・`.aidev/config.yml` の
  `smokeCommands` の文言変更。ラッパーは呼び出し側が `-s` を付けるかどうかに関わらず透過的に
  働く（`npm_config_reporter`/`npm_config_loglevel` を子プロセスの環境から明示的に外すため。
  上記「背景 / 課題」で実測・確定済み）ため、呼び出し側の書き方を変える必要が無い。
- `packages/e2e` の `test` スクリプト（`playwright test`）。この work の対象（`pnpm -r` の recursive
  runner 経由の失敗隠蔽）とは無関係（`playwright test` は pnpm recursive を経由しない単一プロセス）。
- pnpm 自体のアップグレード・設定変更（`.npmrc` 等）。この work はリポジトリ内のスクリプトの
  呼び出し方だけで閉じる解決策を取る（上記「背景 / 課題」で確認済み。pnpm 9.15.9 の動作に
  依存しない設計にする）。

## 機能要件

- `pnpm -s typecheck`・`pnpm typecheck`（`-s` の有無に関わらず）が失敗したとき、標準出力に
  失敗の実際の内容（対象パッケージ名・対象ファイル・エラーメッセージ）が残り、プロセスの
  終了コードは元のコマンドのもの（非0）のままになる。
- 同様に `pnpm -s build`・`pnpm build` が失敗したときも、失敗の内容が残る。
- `-s` 付きで成功したときは、出力を一切増やさない（今までの `-s` 実行時の「無出力」という挙動を
  そのまま保つ。新しい定型メッセージも含めて何も足さない）。
- `-s` 無しで呼んだときは、成功・失敗とも今までと同じ出力をそのまま流す（途中経過・警告を
  含め、ラッパーは何も溜めず何も足さない。review round1 で明記。decisions.md D7）。

## 非機能要件 / 制約

- プロセスの終了コードは元のコマンドのものをそのまま返す（ラッパーが握りつぶさない）。
- `pnpm -r --filter=./packages/*` が対象とするパッケージ数（現在5: protocol/server/web/cli/e2e）や
  実行結果には影響しない（ラッパーは出力の可視性だけを変え、ビルド・型検査そのものの挙動は
  変えない）。

## 完了条件 (受け入れ基準)

- [ ] AC1: `packages/protocol/src/index.ts` に型エラーを一時的に仕込み、`pnpm -s typecheck` を
  実行すると、標準出力に対象パッケージ名・対象ファイル・エラーメッセージが残り、プロセスの
  終了コードが非0になる。
- [ ] AC2: 同様に、型エラーを仕込んだ状態で `pnpm -s build` を実行すると、失敗の内容が残る。
- [ ] AC3: 型エラーを戻した状態で `pnpm -s typecheck`・`pnpm -s build` を実行すると、どちらも
  出力が一切無く、終了コード 0 で終わる（回帰なし。今までの「無出力」という静かな挙動）。
  `-s` 無しの `pnpm build` は、成功時も途中経過・警告（vite の出力等）がそのまま流れる（回帰なし）。
- [ ] AC4: `test`（`vitest run`）・`lint`（`eslint . --ext .ts`）は無改修のまま動作する（この work の
  対象外であることの確認）。
- [ ] AC5: `typecheck`・`build` の両方について、`-s` あり（`pnpm -s typecheck`／`pnpm -s build`）と
  `-s` 無し（`pnpm typecheck`／`pnpm build`）のいずれで実行しても、失敗時の出力が同じように残る
  （ラッパーが `-s` の有無に関わらず透過的に働くことの確認。「背景 / 課題」で確定済みの
  `npm_config_reporter`/`npm_config_loglevel` の環境変数継承問題への対応を含む）。

## 未確定事項 / 確認したいこと

- なし（調査は coding 前の investigative work として本 requirements 作成時に済ませ、原因・対処法
  ともに実測で確定済み）。
