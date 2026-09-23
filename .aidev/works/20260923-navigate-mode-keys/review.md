# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）

- [should][conv:-] `packages/web/src/keys/navigateKeys.ts:5-6,18` ヘッダーコメント・`action` フィールド
  コメントが「既存34操作」と書いていたが、`bindings.ts` の `ACTIONS` は実際は35個（`reload_config` が
  20260922-appearance-settings-rest で追加され35個に）。具体的な個数の断定をやめ「既存操作の
  `bindings.ts` の `ACTIONS`（2026-09-23 時点で35個）」に修正（T1）。
- [nit][conv:-] `NavigateKeyDef` の `id`/`label` フィールドにコメントが無かった（`bindings.ts` の
  `ActionDefBase` は `label` に用途コメントあり）。両フィールドにコメントを追加（T1）。
- [nit][conv:-] `NavigateKeyDef` が全フィールド `readonly` なのに対し `bindings.ts` の `ActionDefBase`
  は付けていないスタイル不揃いの指摘 / 対応: 許容（型的に無害で安全側。むしろ良い書き方のため据え置き）。
- [nit][conv:-] `navigateKeymap.test.ts` の `describe("resolveNavigateKeymap — 上書き", ...)` に
  `keymap.test.ts` の流儀（見出しに対象 AC をまとめて書く）と違い AC タグが無かった。見出しを
  「上書き（AC2・AC4）」に修正（T4）。
- [should][conv:-] `navigateKeys.test.ts:61` のコメントも T1 と同じ「既存34操作」の誤記（実際は35個。
  `bindings.test.ts:9` で確認済み）だった。「既存操作（bindings.ts の ACTIONS）」に修正（T2）。
- [should][conv:-] `navigateKeys.test.ts` に、`NAVIGATE_KEYS.defaults`／`NAVIGATE_RESERVED_CHORDS` が
  chord の正規形（`parseChord`→`formatChord` で不変）であることを確かめるテストが無かった
  （`navigateKeymap.ts` の予約判定は文字列の厳密一致のため、正規形が崩れると黙って機能しなくなる）。
  `bindings.test.ts:45-48` に相当するテストを2件追加（T2）。
- [nit][conv:-] `navigateKeys.test.ts` に、`bindings.test.ts:11` に相当する「id 重複なし・表示名が
  空でない」チェックが無かった。追加（T2）。
- [should][conv:-] `keyPrefs.test.ts` の `withNavigateBinding`/`withoutNavigateBinding` に、既存の
  `withBindings`/`withPrefix`/`withoutBindings`（`keyPrefs.test.ts:223-237` 相当）と対称の
  「渡した `KeyPrefs` を書き換えない」回帰テストが無かった。追加（T8）。
- [nit][conv:-] `loadKeyPrefs — navigate` に、`prefix`/`bindings` が壊れていても `navigate` は
  生かす（逆方向）テストが無かった。追加（T8）。
- [must][conv:-] `assign.ts` の import に `withNavigateBinding` を足したが未使用のまま（`planNavigateReset`
  は `withoutNavigateBinding` だけを使う）。`pnpm lint`（`@typescript-eslint/no-unused-vars`）で
  検出されるはずの指摘（typecheck では検出されない）。import を外した（T10）。
- [should][conv:-] `assign.test.ts` の「修飾付きの数字・矢印は予約されていない」テストが数字だけしか
  確かめておらず、矢印キー（`ctrl+ArrowLeft` 等）の境界が未検証だった。`ctrl+left`/`alt+right` の
  アサーションを追加（T11）。
- [nit][conv:-] `describe("validateNavigateAssignment — 待ち続ける・引けないキー・AltGr", ...)` が、
  既存34〜35操作向けテストの構成（「待ち続けるもの」「引けないキー・AltGr」を別 describe に分ける）と
  不揃いだった。2つの describe に分割（T11）。
- [nit][conv:-] `HelpDialog.test.ts` の新規テストのコメント「上下は灰色（未設定）」が、実際は
  `navigate_workspace_up` の1行だけを検証している（down 側は既定のまま）のに「上下」と誤解を招く
  書き方だった。コメントを修正（T18）。
- [should][conv:-] `HelpDialog.vue` の `navigate_pane_left`/`navigate_pane_right` の行が、素の
  割り当てを外すと（矢印は常に効くにもかかわらず）灰色表示になっていた。design.md のスケッチでは
  この2行だけ意図的に `grayed` を立てない設計だった（矢印の固定フォールバックを画面上でも正しく
  伝えるため）。`{ ...navigateEntry(id), keys: ... }` のスプレッドで `grayed` を引き継いでいたのを、
  この2行専用の行組み立てに直して `grayed` を持たせないようにした。テストに検証を追加（T17）。
- [should][conv:-] `HelpDialog.vue` の `navigateEntry` がラベル取得に自前の線形探索
  （`NAVIGATE_KEYS.find(...)`）を使っており、同じ `navigateKeys.ts` が公開する `navigateKeyDef(id)`
  （`Map` 引き）を使っていなかった。`navigateKeyDef` に置き換えた（T17）。
- [nit][conv:-] `navigateBindingText(id)` が pane 左右の行で2回呼ばれていた（`navigateEntry` の内部と
  直接呼び出しの2箇所）。pane 左右は `navigateEntry` を経由しない専用の組み立てに直したので解消（T17）。
- [should][conv:-] `docs/herdr-parity.md` の新規 H26c 行が「既存34〜35操作」という曖昧な表記を
  使っていた（この work の他の箇所〔`navigateKeys.ts`〕で確立した「既存操作の `bindings.ts` の
  `ACTIONS`（2026-09-23 時点で35個）」という表現に揃っていなかった）。同じ表現へ統一（T19。
  H26 行自体の既存の「34の操作」表記は別 work の記述で対象外）。
- [nit][conv:-] `store/settings.ts` の `navigateKeymap` の doc comment に文法的な誤り
  「`keymap`/`navigateKeymap` は両方とも作り直る」（能動態）。正しくは「作り直される」（受身）。
  修正（T12）。

## ラウンド 1（2026-09-23。60 review。work 全体の独立点検）

- [must][conv:-] `NavigateMode.handle()` の `case "ArrowLeft":`/`case "ArrowRight":` が修飾キー
  （ctrl/alt/shift/meta）を見ずに `k.key` だけで分岐しているため、`ctrl+left`・`alt+right` のような
  **予約されていない**修飾付き矢印 chord（`NAVIGATE_RESERVED_CHORDS` は bare な `left`/`right` だけを
  予約）を navigate の別操作（例: `navigate_workspace_up`）へ割り当てても、実際にそのキーを押すと
  表を一切引かず常に固定の pane 左右移動が起きる「幽霊バインディング」になる。設定画面は「割り当てました」
  と表示し保存もするのに機能しない。decisions D3 は bare な left/right（予約のため表に載せられない）
  についてのみ固定 case を正当化しており、修飾付き chord まで固定 case が奪ってよいとは述べていない
  — 根拠: `packages/web/src/keys/NavigateMode.ts:33-36`、`packages/web/src/keys/assign.test.ts:826-835`
  （`{ ok: true, binding: "ctrl+left" }` を通してしまうテストが逆に不一致を裏付けている）
  対応: 修正済み（下記）。
- [must][conv:-] `NAVIGATE_RESERVED_CHORDS`（`navigateKeys.ts`）に `ctrl+shift+v` が含まれておらず、
  navigate の6操作のどれにでも割り当て可能として受理してしまうが、`KeyInputController.ts` の
  `isManualPasteShortcut` がモードに関わらず `router.handle()` より手前で常に横取りするため、
  割り当てても発火しない。既存34〜35操作向けの `RESERVED_DIRECT`/`RESERVED_AFTER_PREFIX`
  （`keymap.ts`）はまさにこの理由でこの chord を拒否しており（`assign.test.ts:226,299` にコメントで
  明記）、navigate 側の予約リストへの反映だけが漏れていた
  — 根拠: `packages/web/src/keys/navigateKeys.ts:84-100`、
  `packages/web/src/keys/KeyInputController.ts:132,200-206`、`assign.test.ts:226,299`
  対応: 修正済み（下記）。
- [should][conv:-] `KeySettings.vue` の navigate セクションの注記が
  `displayFor(settings.keymap.hintFor("workspace_picker") ?? "prefix+w")` で navigate モードへ入る
  キーを示すが、`hintFor` が `null`（`workspace_picker` の割り当てを全部外した場合）を返すと、
  実際の割り当てと無関係な文字どおりの `"prefix+w"` を表示してしまう。同じパターンの `Toast.vue`
  は `hintFor` が `null` のとき出さない流儀を採っており、この注記だけそれに反する
  — 根拠: `packages/web/src/components/KeySettings.vue:609`、`packages/web/src/components/Toast.vue:39`
  対応: 修正済み（下記）。
- [nit][conv:-] navigate 用の `navigateKeysFiltered`（`KeySettings.vue`）が既存34〜35操作の
  `actionsByGroup` と違い、見出し「navigate モードの移動」自体（群名相当）には一致しない
  （6操作のラベルだけを見る）。design は「一貫性のため含める」と書いたが、群名一致までは移植されて
  いなかった — 根拠: `packages/web/src/components/KeySettings.vue:52-56,65-68`
  対応: 許容（nit。群が1つしか無い navigate セクションでは実利が薄く、過剰対応を避ける）。

## ラウンド 2（2026-09-23。60 review。前ラウンドの修正の確認＋今回差分）

前ラウンドの must 2件・should 1件はいずれもコード上は解消を確認（対応の詳細は独立点検の記録）。

- [should][conv:regression-negative-control!] round1 の should 修正（`KeySettings.vue` の
  `navigateModeHint`。`hintFor` が `null` のとき未解決のプレースホルダを出さない）に、それを確かめる
  テストが1件も無かった。同じラウンドの2件の must 修正は
  `.aidev/conventions/regression-negative-control.md` の手順（修正前に戻すと落ちることを確認）で
  固めたのに、この should だけ非対称に無検証だった — 根拠:
  `packages/web/src/components/KeySettings.vue:117-123`
  対応: 修正済み（`KeySettings.test.ts` に3件のテストを追加。T22）。

## ラウンド 3（2026-09-23。60 review。前ラウンドの修正の確認）

指摘なし。ラウンド2の should（`navigateModeHint` のテスト追加）は3件とも実装の意図と整合しており、
修正前のコードに戻すと該当テストが落ちることも確認済み（test-result.md「ラウンド3」）。
今回の差分（`KeySettings.test.ts` へのテスト追加のみ・プロダクションコード変更なし）に新規の
must/should は無い。
