# レビュー: タブバーと pane の枠の外観設定（20260922-tabbar-pane-appearance）

## タスク点検ログ

- [T1] `loadTabBarRightEntries` が「先頭16件だけを見る」という design の位置基準の切り詰めではなく、
  「16件の有効な要素が見つかるまで走査を続ける」実装になっていた。`raw.slice(0, MAX_TAB_BAR_RIGHT_ENTRIES)`
  してから検証する形に修正し、位置基準であることを確認する回帰テストを追加。
- [T1] `sanitizeTabBarText`/`sanitizeSeparator` の上限での切り詰めが `String.prototype.slice`（UTF-16
  コード単位）を使っており、サロゲートペア（絵文字等）の境界にかかると孤立サロゲートが残る壊れた文字列に
  なりうった。`Array.from` によるコードポイント単位の切り詰め（`truncateByCodePoints`）に直し、境界に
  絵文字がかかるケースの回帰テストを追加。
- [T1] 新規2ファイルが prettier 未整形（三項式・長い配列リテラルの折返し）だった。`prettier --write` で整形。
- [T2] 指摘なし（CHECK: ok）。
- [T3] `setTabBarPosition` のコメントが `setStatusSymbols` からの流用で誤って「AC-I2」を引用していた
  （この work の AC-I2 は右端エントリの確定操作専用）。「AC1」に修正。
- [T3] `store/settings.ts:198-202` のコメントが「decisions D の過剰設計の回避」という実在しない参照先を
  指していた。decisions.md に D6（8項目を「差分だけ持つ」構造にしない決定）を新設し、コメントを
  「decisions D6」に直した。
- [T3] `setTabBarRight` がメモリの状態としか比較しておらず、`replaceKeyPrefs` の「保存側とも比較する」
  二重の守りと非対称だった。保存側（`readPrefs()["tabBarRight"]`）とも比較する形に直した。
- [T3] `removeTabBarRightEntry`・`updateTabBarRightEntry` の範囲外 index・空配列に対する回帰テストが
  無かった。追加（実装自体は元から安全だったことを確認）。
- [T3] prettier の指摘（settings.ts の新しい行が未整形）は誤り——`settings.ts` は元々（HEAD 時点で）
  prettier 未整形だったため（`NEW_CWD_POLICIES` 等、既存の複数箇所が既に折返し無し）、`--write` は
  かけていない（既存の未整形ファイルへの規約`prettier-only-clean-files`に従う）。新しい行も既存の
  同ファイル内の書き方（折返し無し）に揃えてあり、対応不要と判断。
- [T4] taskcheck ラウンド1は指摘なし（CHECK: ok）だったが、**T10（E2E）で実装漏れを発見**（decisions D7）：
  `position` prop はクラス（境界線の位置）だけを変え、design が求めた `order`（実際の視覚順の入れ替え）を
  書き忘れていた。単体テストは stub 経由でクラスの有無しか見ておらず、E2E で「実際に下へ移るか」を
  bounding box で確認して初めて発覚。`order` を追加し、単体テストにも回帰テストを足した。
- [T5] 指摘なし（CHECK: ok）。点検エージェントが `multiPane`/`:position`/`:show-label`/outline クラスの
  各配線を個別に変異させ、対応するテストだけが落ちることを確認した上で `cp` により原本へ復元・md5sum
  一致を確認済み（regression-negative-control 相当の検証）。スコープ外の参考指摘として、design.md の
  「`paneOuterBorders` が false のとき `outline-color` を透明にする」という記述に対し、実装はクラスの
  有無で `outline` 宣言ごと切り替えている（幅も含めて無くなる）という違いがあると報告された——制約
  （PTY の cols/rows に影響しない）自体は `outline` がボックスモデルに参加しないため両方式で満たされて
  おり実害は無いが、design の文言とは手段が異なる。着地前に design.md の該当行を実装に合わせて修正する。
- [T6] ラウンド1で must 1 件：「multiPane・showLabel は再帰的に…まで届く」というテストが、名前・
  コメントの主張に反して `showLabel` の伝播を一切検証していなかった（枠の色＝`multiPane` の効果しか
  assert していなかった）。`findAllComponents(PaneFrame)` で葉・孫の `showLabel` prop 値を直接確認する
  形に直し、`showLabel=false` の反対側のテストも追加。`:show-label="showLabel"` を外す変異で新しい
  テストが落ちることを確認済み。
- [T7] 指摘なし（CHECK: ok）。
- [T8] 指摘なし（CHECK: ok）。点検エージェントが `!settings.paneGaps` の変異・CSS 詳細度（実ブラウザでの
  実測込み）・「0.05〜0.95」テストの Pinia 未提供の偶然 pass を確認し、いずれも問題なしと結論。
- [T9] ラウンド1で must 1 件・nit 1 件。must：区切り文字の入力欄の Enter 確定（`onTabBarRightSeparatorEnter`）
  に対応する回帰テストが無く、text 欄と非対称だった（text 欄には既にあった）。テストを追加し、旧実装
  （`.blur()` 任せ）への変異で確実に落ちることを確認。nit：`<fieldset class="tabbar-right-fieldset">` の
  子要素のインデントが一段深くなっておらず、既存の「端末」節の `<fieldset>` と書式が不揃いだった。直した。
- [T10] 指摘なし（CHECK: ok）。E2E 7 本（含む T4 の実装漏れの修正の確認）・単体テストの回帰・typecheck・lint
  を確認。
- [cross] must 1 件：`docs/verification.md` の手動検証手順（4）が「『常に』は単独 pane でも付き」という、
  design.md で訂正済みの誤り（decisions D7 の前身。単独 pane は常に選択中で、選択の強調が `bordered` の
  値に関わらず優先されるため、`paneBorders` の設定による違いは分割中の非選択 pane でしか見えない）を
  そのまま引きずっていた。冒頭の要約段落（機能の説明）は正しく訂正済みだったが、手順側だけ古い記述が
  残っていた。手順の文言を実装・design・E2E のコメントと一致する形に直した。他の観点（prop 受け渡しの
  一貫性・`paneGaps` の非対称性・8 項目の命名一致・`aidev coverage --strict`〔gap 0〕・全体テスト
  〔1557 passed〕）はすべて問題なし。

## レビュー ラウンド1

指摘なし（CHECK: ok）。観点は要件適合（`aidev coverage` gaps=0 を前提に、design.md の該当節と実装・
対応するテストを AC ごとに突き合わせて中身を確認）・価値適合（US1〜US4 が実際に DOM/CSS の変化として
反映され、E2E が `e2e-observe-browser` の作法でブラウザ側から確認していることを確認）・保守性
（`tabbar/tabBarRight.ts` が既存の `keys/keyPrefs.ts`・`theme/themes.ts` と流儀が一貫している・
`SettingsDialog.vue` の追加分が既存の節の書き方を再利用している・`multiPane`/`bordered`/`showLabel` の
3 段の受け渡し経路が docstring で追える）の 3 点。正確性・規約適合の細部は各タスクの独立点検・cross 点検で
既に通過済みのため、この工程では重複確認しなかった。
