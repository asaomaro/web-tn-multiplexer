## タスク点検ログ（coding 工程内・「3.3」(b)）

- [must][conv:-] T1 `withoutOverride` の分割代入（`const { [key]: _removed, ...rest } = o[bucket];`）が未使用変数 `_removed` を作り、`@typescript-eslint/no-unused-vars` に反する（`pnpm lint` が exit 非 0） / 対応: 分割代入をやめ、`{ ...o[bucket] }` をコピーしてから `delete rest[key]` する形にした。`pnpm lint`／`pnpm exec vitest run`／typecheck が通ることを確認した
- [should][conv:regression-negative-control] T2 `writeBoot()` が上書きを保存値（`readPrefs()`）から読む、という保証を単体テストが検証できていなかった（既存のテストはすべて store と localStorage の値が一致するケースだけを使っていた。`readPrefs()` を `this.opts.settings.themeOverrides` に置き換える変異が全テストを通る） / 対応: 別のタブが保存した上書きと、このタブの store の値をわざと食い違わせるテストを足した（テーマ名の既存の同種テストと同じ形）。この変異で新しいテストが落ちることを確認した
- [should][conv:-] T4 「すべての上書きを既定に戻す」確認の Esc（`.stop.prevent`）が親の設定画面へ漏れないことを固定する回帰テストが無かった（`KeySettings.vue` の同じ確認には手本のテストがあるのに、こちらには無かった。`.stop.prevent` を外す変異で全テストが通ってしまう） / 対応: `KeySettings.test.ts` と同じ形（`ev.defaultPrevented`・`document` への漏れ・確認が閉じる・フォーカスの残留）のテストを足した。`.stop.prevent` を外す変異で落ちることを確認した
- [nit][conv:-] T4 無効な値を拒否するメッセージ（`${raw} は色として読めません。`）だけ、どの色・どちらの明暗かを含まない（ほかの2つのメッセージは含む） / 対応: 「「${CSS_VAR_LABELS[key]}」（${bucketLabel(bucket)}）：」を前に足した。テストの期待文言も直した
- [must][conv:-] T6 herdr-parity.md H24b の「実測」が、T5（E2E）・T8（一式）が未実施なのに確認済みのように書いていた（decisions D2 と食い違う）／backlog の同じ実測欄は「deliver 時に書き直す」としており自己矛盾 / 対応: 「deliver 時に一式の結果で書き直す」に直した
- [must][conv:-] T6 H24b の「herdr の `[keys]` ならぬ画面の枠の色」が誤り（`[keys]` はキー割り当ての節で、色の上書き `[theme.custom]` とは無関係。直後の①の対比と矛盾） / 対応: その句を削った
- [must][conv:-] T6 verification.md の手順の期待メッセージ「「--wtm-accent」（暗いとき）を…」が実装と食い違う（実際は `CSS_VAR_LABELS` の説明文言のみを使う） / 対応: 実際の文言「強調の色（フォーカスの枠等）」に直した。（2）の notacolor の期待メッセージも同様に直した
- [should][conv:-] T6 verification.md の手順が上書き対象の行を「アクセント（強調の色）」と呼んでいたが、実際のラベルは「強調の色（フォーカスの枠等）」で画面に一致する文言が無かった / 対応: 実際のラベル文言に統一した
- [should][conv:-] T6 herdr の `[theme.custom]` のトークン数を「18」と書いていたが、列挙すると 19 個だった（research・design・requirements にも波及していた） / 対応: research.md F1・design.md（2箇所）・requirements.md・herdr-parity.md H24b を「19」に直した
- [nit][conv:-] T6 verification.md の既知の制約の出典「design「設計方針」」が不正確（実際は「ドメイン固有の考慮」節・AC2） / 対応: 出典を直した
- [nit][conv:-] T6 herdr-parity.md H24b③「上書きにherdr の」でスペースが抜けていた / 対応: スペースを足した
- [should][conv:-] T6（2ラウンド目）ラウンド1の「18→19」の修正が research/design/requirements/herdr-parity には入ったが、同じ誤りの発生源である `packages/web/src/theme/themeOverrides.ts:6` のコメントが直っていなかった / 対応: 「herdr の 19 トークンではなく」に直した
- [nit][conv:-] T6（2ラウンド目）herdr-parity.md の H24 行末に、編集の際に紛れ込んだ余分な `|`（空セル）があった / 対応: 除いて元の 4 列に戻した
- [must][conv:-] T5 足した 4 本の新テストが `test.describe("モバイル", ...)` の内側（1 本目と 2 本目のモバイルテストの間）に誤って挿入されていた（インデントが揃っておらず、タイトルが「モバイル › …」になり絞り込みに影響する。この 4 本はモバイル専用ではない） / 対応: describe の外（既存の最後のトップレベルの test の後・`test.describe("モバイル", …)` の前）へ移した。E2E 12 本が通ることを確認した
- [should][conv:-] T5 「すべての上書きを既定に戻す」テストの `before` が、上書きを当てた後（`#222222`）の値を測っており、真の既定値との一致を検証できていなかった（`not.toBe` は「#222222 ではない」としか言えず、壊れた別の値でも通ってしまう） / 対応: 上書きを当てる前に既定の値を測り、戻した後・再読み込み後の両方をその値と `toBe` で比較するように直した
- [nit][conv:-] T5（2ラウンド目）テストを移動した跡に空行が 2 行連続する箇所が 2 か所残っていた（HEAD の慣習は空行 1 行） / 対応: それぞれ 1 行に整えた

## ラウンド 1（review 工程。別のコンテキストに委ねた）

- [should][conv:-] .aidev/backlog/product-roadmap.md:106 の着地根拠に「herdr の 18 トークンではなく…19 個」の「18」が残っていた（T6 で research/design/requirements/herdr-parity.md/themeOverrides.ts のコメントは直したが、backlog の行だけ再発） / 対応: 「19」に直した
- [nit][conv:-] packages/web/src/theme/themeOverrides.ts:121 `--wtm-state-idle` の説明「状態アイコンの色（待機）」が、既存の `stateIndicator.ts` の用語「待機中」と 1 文字揺れる / 対応: 「待機中」に揃えた
- [nit][conv:-] packages/web/src/theme/ThemeController.ts:145-146 `writeBoot()` が `readPrefs()` を 2 回呼ぶ（1 回読んで両方に渡す形の方が意図が伝わる） / 対応: 1 回だけ呼んで変数に持たせた
- [nit][conv:-] packages/web/src/store/settings.ts:196-210 の `storage` リスナーが、まだ宣言されていない `themeOverrides`（216 行目）を前方参照している（実害は無いが読む順序として分かりにくい） / 対応: `themeOverrides` の宣言を `storage` リスナーより前へ移した

## ラウンド 2（review 工程。別のコンテキストに委ねた。ラウンド 1 の直しの検証）

指摘なし。ラウンド 1 の 4 件はすべて実物で解消を確認（レビュアー）。単体 151 件・typecheck・lint も再確認済み。

**件数（通算・ラウンド 1）**：must 0・should 1・nit 3。すべて解消済み。
