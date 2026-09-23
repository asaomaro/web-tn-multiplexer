# 決定記録

## D1: requirements の独立点検（doccheck）が上限（2/2）に達した

- 背景: ラウンド 1（7 件：must 1・should 4・nit 2）・ラウンド 2（5 件：must 2・should 3）を直した。ラウンド 3 は
  `maxDocCheckRounds`（既定 2）に達し、CLI が「深追いせず、残った疑問を decisions.md に残して承認へ進む」を促した。
- 決定: 直した内容（AC12 の紐付け・機能要件と AC-I4 の矛盾〔「既定に戻す」でボタン自体が消え、フォーカスは同じ行の入力欄へ〕・
  `effectiveTheme`／`colorScheme`／`dialog モード` 等の実装用語を非機能要件で先出し・「どのストーリーにも紐づかない基準」の
  内訳を明記）で、requirements.md を承認して design へ進む。3 回目の点検は行わない。
- 理由 / 代替案: 上限に達した時点でさらに委譲を重ねても、指摘の限界効用は下がる（`protocol-check.md`「上限で止まったら
  深追いしない」）。design・tasks・coding・review の各段階でも requirements を読み返すので、見落としがあれば後段で拾える。
- 影響: 無し（要件の内容は確定。以降の工程はこの requirements.md を前提にする）。

## D2: T8（全体の回帰）は coding では実行せず test 工程で消化する

- 背景: `aidev-30-tasks`「6.」の「coding ではなく test / deliver で消化する」タスクの扱い（20260921-keybinding-customization の
  T18 と同じパターン）。
- 決定: T8「全体の回帰（単体・E2E の一式・smoke）と負の確認」は、tasks.md では未チェックのまま coding を承認し、test 工程で
  実行する。
- 理由 / 代替案: coding の各タスクの中で一式を回すと、少しの修正のたびに重い E2E 一式を何度も回すことになる（ユーザーの
  E2E 方針：「少しの修正ですべて回すのは時間と見合わない」）。
- 影響: coding 工程の完了の目安は T1〜T7 の 7 タスク。T8 は test 工程の `aidev event test start` 以降で実行する。

## D3: design の独立点検（doccheck）が上限（2/2）に達した

- 背景: ラウンド 1（3 件：must 1・should 1・nit 1）・ラウンド 2（4 件：nit 4）を直した。ラウンド 2 の指摘は全て nit
  （`CssVar` 型の出所・「入力の出所」表記の不統一・「異常系」の語の衝突・AC-I3/AC-I5 のテスト方針への明記漏れ）。
- 決定: 4 件とも直し（`CssVar` の出所を追記・AC4/AC6 に「入力の出所」を追記・「異常系」を「実装上の制約」に言い換え・
  テスト方針に AC-I3/AC-I5 を明記）、3 回目の点検はせず design.md を承認して tasks へ進む。
- 理由 / 代替案: `maxDocCheckRounds`（既定 2）に達した。すべて nit で、直しも機械的（追記・言い換え）なので、
  3 回目を委譲する値は薄い。
- 影響: 無し。

## D4: T1 の実装中に見つけた事実：happy-dom は `style.color = "none"` を real Chromium と違って受け入れる

- 背景: research F10 は `style.color` への代入で色の妥当性を検証する方式を、happy-dom で実測して決めた。T1 の実装・単体テストの
  作成中に、`"none"`（herdr の reset の別名の 1 つ）だけ happy-dom が真（受け入れる）を返すのに対し、実物の Chromium
  （`@playwright/test` 同梱の chromium で実測）は偽（拒否）を返すことが分かった。ほかの語（`reset`・`default`・
  `notacolor`・桁の不正な 16 進）は happy-dom と Chromium で一致する。
- 決定: 単体テスト（`themeOverrides.test.ts`）の「妥当でない文字列」の一覧から `"none"` を外し、コメントで理由を残した。
  実物の確認は T5（E2E）で行う（`e2e-observe-browser` の「happy-dom と実物がずれる箇所は E2E で見る」という運用と同じ）。
  実装（`isValidCssColor`）自体は変えない——本番は実物のブラウザで動くので、happy-dom の癖に合わせて実装を緩めない。
- 理由 / 代替案: happy-dom の癖に実装を合わせる（`"none"` を特別扱いして拒否する）案は、herdr の別名を一部だけ実装する
  ことになり、design の「herdr の別名を実装しない」方針と矛盾するので採らない。
- 影響: `themeOverrides.test.ts` の期待値一覧から 1 語を除いた。T5（E2E）に `"none"` の拒否を含める。

## D5: T6 の独立点検（taskcheck）が上限（2/2）に達した

- 背景: ラウンド 1（7 件：must 3・should 2・nit 2）・ラウンド 2（2 件：should 1・nit 1）を直した。ラウンド 2 の指摘は、
  ラウンド 1 で直した「18→19」の修正がソースコードのコメント（`themeOverrides.ts`）に伝播していなかったことと、
  編集中に紛れ込んだ herdr-parity.md の表の余分な `|`。
- 決定: 直した（`themeOverrides.ts` のコメントを 19 に、herdr-parity.md の余分な `|` を除いた）。3 回目の点検は
  委譲せず、単体テスト・typecheck・lint の全体実行で自己確認して次のタスクへ進む。
- 理由 / 代替案: `maxTaskCheckRounds`（既定 2）に達した。直しは機械的（数字の統一・表の 1 文字）で、3 回目を
  委譲する価値は薄い。
- 影響: 無し。

## D6: T5 の独立点検（taskcheck）が上限（2/2）に達した

- 背景: ラウンド 1（2 件：must 1・should 1）・ラウンド 2（1 件：nit 1）を直した。ラウンド 1 の must は、足した 4 本の
  E2E が `test.describe("モバイル", …)` の内側に誤って挿入されていたという実装上の不具合（機械的な挿入ミス）で、
  ラウンド 2 はその移動の跡に残った空行の乱れ。
- 決定: 直した（テストをトップレベルへ移動・空行を整えた）。3 回目の点検は委譲せず、E2E の実行（12/12 pass）・
  typecheck・lint の再実行で自己確認して次へ進む。
- 理由 / 代替案: `maxTaskCheckRounds`（既定 2）に達した。直しは機械的で、3 回目を委譲する価値は薄い。
- 影響: 無し（テストの内容そのものは変わっていない。置き場所と空行だけ）。
