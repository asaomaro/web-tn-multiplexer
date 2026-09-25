# レビュー: worktree の作成先を設定できるようにする

## タスク点検ログ

- [must][conv:-] T2（`cliArgs.ts`）: `switch` に `case "--worktree-dir"` の実装本体が欠落
  しており（`USAGE` 文字列とテストだけが存在）、`--worktree-dir` が `unknown option` に落ちて
  いた。原因はコーディング中のセッション中断・再開の間に、この編集だけが作業ツリーへ反映されて
  いなかったこと（decisions.md D1）。 / 対応: `case "--worktree-dir": serve.worktreeDir =
  next(); break;` を復元した。負の確認: 再び外すと新規テストが実際に失敗することを確認し、
  戻すと8件とも pass することを確認した。 / src: T2 taskcheck round1
- [must][conv:regression-negative-control] T2: 「値なしで `ConfigError`」のテストが
  `toThrow(ConfigError)` としか見ておらず、`next()` の「missing value」経路と `switch` 分岐
  自体が無い場合の「unknown option」経路を区別できていなかった（switch 分岐が丸ごと欠けていても
  green のまま気付けない弱いテストだった）。 / 対応: `err.message` を
  `"missing value for --worktree-dir"` まで確認する形に強化した（decisions.md D1）。負の確認:
  switch 分岐を外すと、強化後のテストが実際に（メッセージ不一致で）失敗することを確認した。 /
  src: T2 taskcheck round1
- [must][conv:-] T4（`docs/tls-setup.md`）: 「指定しなければ従来どおり：」という導入文の直後に、
  実際には `--worktree-dir` を**指定する**例（`wtm serve --worktree-dir /data/wtm-worktrees`）が
  置かれており、導入文と矛盾していた。 / 対応: 導入文を「別ディスク・共有ストレージ等へ変える
  なら：」に直し、「指定しなければ既定の `~/.wtm/worktrees` のまま変わらない」という一文を
  例の後に独立して添えた。 / src: T4 taskcheck round1
- [should][conv:-] T4（`docs/tls-setup.md`）: 「指定した場所の事前確認はしない
  （`--state-dir`・`--cert`・`--key` と同じ）」という記述が、実際には失敗が判明するタイミングの
  違い（`--state-dir`/`--cert`/`--key` は起動直後に `ConfigError` で分かるが、`--worktree-dir`
  は実際に worktree を作る操作まで誤りに気づけない）を覆い隠していた。 / 対応: タイミングの
  違いを明記する形に書き直した。 / src: T4 taskcheck round1
- [must][conv:-] cross: `main.ts` の `printHelp()`（`wtm --help`/引数無しで実際に表示される
  使い方文字列。`cliArgs.ts` の `USAGE`——パース失敗時の `ConfigError` 用——とは別物）に
  `--worktree-dir` が抜けていた。design.md は `--shell`・`--scrollback` と「全く同じ形」で
  踏襲すると明記していたが、`main.ts` はどの個別タスク（T1〜T4）の対象にも design.md の
  「対象範囲」にも含まれておらず、個別 taskcheck では検知できなかった。 / 対応:
  `main.ts:17` に `[--worktree-dir DIR]` を追記した（decisions.md D3。`printHelp()` 自体の
  テスト基盤はこのリポジトリに元々無く、この work のスコープでは新設しない）。design.md
  「対象範囲」にも `main.ts` を事後反映した。 / src: cross-task check

## レビュー ラウンド1

要件適合・価値適合・正確性・規約適合・保守性の5観点を確認した（タスク点検ログに記録済みの
5件は再掲しない）。must/should は無し。nit 1件のみ。

- [nit][conv:-] `composeServer.integration.test.ts` の新規テスト（AC1 の end-to-end 検証）が、
  同ファイルの precedent（「full round trip」テスト）が行っている
  `expect(loginRes.status).toBe(204)` のログイン応答チェックを省略していた。 / 対応:
  precedent と同じ形でチェックを追加した。

以下、問題なし:
- 要件適合: AC1〜AC4 を実装・テストの現物で確認。設定ファイル機構・E2E harness 移行・パス
  事前検証のいずれも実装に紛れ込んでいない（スコープ逸脱なし）。
- 価値適合: 「素通し・既定値は解決しない」という設計判断が、`packages/e2e/src/support/
  appServer.ts` の `bootServer()`（`composeServer()` を直接オブジェクトで呼ぶ既存の precedent）
  にそのまま乗せられる形になっており、将来の E2E harness 移行（D7 の本丸）を楽にしている。
- 正確性: 型・ランタイムとも正しい。4段階のリレー（cliArgs.ts→config.ts→composeServer.ts）が
  一貫。`main.ts` 以外に見落とされた使い方文字列は無い（`README.md`・`packages/cli/`・
  `docs/*.md` を横断確認済み）。
- 規約適合: `regression-negative-control.md`（D1・D2 とも生ログ付きで記録済み）・
  `e2e-observe-browser.md`（非該当）とも問題なし。
- 保守性: `docs/herdr-parity.md`・`docs/tls-setup.md` の追記は正確。decisions.md D1〜D3 は
  design.md と整合（`main.ts` の事後反映含む）。

walkthrough.md: 不要。diff は単一フラグを4〜5ファイルへ配線するだけの素通しで、複雑な制御
フロー・大きな diff・実質的なモジュール横断のいずれにも該当しない。
