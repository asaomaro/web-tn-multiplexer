# 決定記録

## D1: T2（`cliArgs.ts` の `--worktree-dir` switch 分岐）が、セッション再開の断絶で一度失われていたことを taskcheck が発見・復元した

- 背景: T2 taskcheck round1 で、`cliArgs.ts` の `switch` に `case "--worktree-dir"` が実装されて
  おらず、`USAGE` 文字列と `cliArgs.test.ts` の新規テスト2件だけが存在する状態が発覚した
  （must 2件）。原因はコーディング作業の途中でセッションが一度中断・再開したこと——実装した
  はずの `switch` 分岐の編集が再開後の作業ツリーに反映されておらず、他の変更（`USAGE` 文字列・
  テストファイル）だけが残っていた。
- 決定: `switch` に `case "--worktree-dir": serve.worktreeDir = next(); break;` を復元する。
  合わせて、taskcheck が同時に指摘した「値なしのテストが `ConfigError` の型だけを見ており、
  `next()` の『missing value』経路と『unknown option』経路を区別できていなかった」問題も、
  `err.message` を `"missing value for --worktree-dir"` まで確認する形に強化した
  （`.aidev/conventions/regression-negative-control.md` 準拠）。
- 理由 / 代替案: 実装漏れを直すだけでなく、テスト自体が「switch 分岐が丸ごと欠けていても green」
  という弱い検証だったことも同時に直した——taskcheck の指摘2件目がまさにこの弱さを突いていた。
- 影響: `packages/server/src/cliArgs.ts`・`cliArgs.test.ts` のみ。負の確認（switch 分岐を再度
  外すと、強化後のテスト2件とも実際に失敗することを確認済み。「unknown option: --worktree-dir」
  ⇔ 期待値「missing value for --worktree-dir」の不一致で red）。修正を戻すと8件とも pass。
  T1（`config.ts`）には影響なし（taskcheck round1 で findings 0 済み）。

## D2: T3 の負の確認で、`composeServer.ts` の配線を戻したところ実際に `~/.wtm/worktrees`
   配下へ実物のディレクトリが作られた（想定内・確認後に削除済み）

- 背景: T3（`composeServer.ts` に `options.worktreeDir` を渡す配線）の負の確認として、
  `.aidev/conventions/regression-negative-control.md` に従い配線を一時的に戻し（`new
  DefaultWorktreeService(session, gitRunner, logger)`——4番目の引数を渡さない元の形）、新規の
  end-to-end テスト（`composeServer.integration.test.ts`「`--worktree-dir` で起動すると…」）が
  実際に失敗することを確認した。この際、テストが `--worktree-dir` に一時ディレクトリを渡して
  いても配線自体が無いため実装側は既定値（`defaultWorktreeRoot()`）を使い、
  `~/.wtm/worktrees/wtm-compose-wtdir-repo-*` へ実物の worktree が作られた——これはまさに
  この work が解決しようとしている D7（20260920-git-worktree-actions decisions.md）の症状を、
  検証行為そのもので一時的に再現した形。
- 決定: 配線を復元後、負の確認で作られた実物のディレクトリ（`~/.wtm/worktrees/
  wtm-compose-wtdir-repo-kLXlys`）を確認のうえ削除した。テスト自体は正しい既定値フォールバック
  の動作を裏付けており、テストの設計に問題は無い——**配線を意図的に外した状態でだけ**発生する
  想定内の事象（design.md「テストで確認すること」が禁じているのは、配線が正しい状態での
  end-to-end テストが既定値〔省略時〕のケースを実ホームディレクトリで検証すること。今回は
  負の確認という一時的な異常系の検証中に、まさにその「既定値へのフォールバック」自体が正しく
  機能した結果として実物が作られた）。
- 理由 / 代替案: 負の確認をスキップする、または既定値フォールバックをモック化することも考えたが、
  「配線が本当に効いているか」を実際に確認する目的上、負の確認は省略できない。実ホームディレクトリに
  触れるのは負の確認の実行中だけで、確認後に手動で削除すれば実害は残らない。
- 影響: コードへの影響なし（`packages/server/src/composeServer.ts` は最終的に配線ありの状態で
  確定）。実行環境の `~/.wtm/worktrees/` に一時的に作られたディレクトリは削除済み（`ls -la
  ~/.wtm/worktrees` で空であることを確認済み）。

## D3: `main.ts` の `printHelp()` に `--worktree-dir` が抜けていた（cross-task check で発覚）

- 背景: design.md は `--worktree-dir` を既存の `--shell`・`--scrollback` と「全く同じ形の CLI
  フラグ」として踏襲すると明記していたが、実際には `cliArgs.ts` の `USAGE`（パース失敗時の
  `ConfigError` 用）にしか追記しておらず、`main.ts` の `printHelp()`（`wtm --help`/引数無しで
  実際に表示される使い方文字列。`cliArgs.ts` の `USAGE` とは別物）は据え置きのままだった。
  `main.ts` はどの個別タスク（T1〜T4）の対象にも含まれておらず、design.md の「対象範囲」にも
  記載が無かったため、個別 taskcheck では検知できず、cross-task check で初めて発覚した。
- 決定: `main.ts:17` の使い方文字列に `[--worktree-dir DIR]` を追記する。
- 理由 / 代替案: `printHelp()` はこのリポジトリに既存のテストが1件も無い（`main.ts` 自体に
  対応するテストファイルが無い）。この work で新しく `main.ts` のテスト基盤を作ることは、
  この不具合（1行の追記漏れ）の是正に対して不釣り合いに大きいスコープ拡大になるため見送り、
  文字列の修正のみを行う——`printHelp()` が未テストであること自体はこの work が持ち込んだ
  状態ではなく、既存の状態のまま。
- 影響: `packages/server/src/main.ts` のみ。design.md の「対象範囲」には `main.ts` の記載が
  無かったため、design.md にも `main.ts` を対象範囲へ追記した（事後反映）。
