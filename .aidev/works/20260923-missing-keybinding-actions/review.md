# レビュー: herdr にあって本製品に操作自体が無いものを足して割り当てられるようにする

## タスク点検ログ

coding 工程の独立点検（`protocol-check.md`「(b)」）。`mode: autonomous` だが T1〜T14 のタスク単位点検
（手順5）は実施できず、全タスク完了後の cross 点検（手順5.5）のみをサブエージェントへ委譲して実施した
（下記「留意」参照）。

- [nit][conv:-] `packages/web/src/keys/chord.ts:292` `ParsedBinding.range` の doc コメントが
  `switch_tab` だけを前提にした古い記述のまま（T8/T13 で `focus_agent` も2つ目の `indexed: true`
  操作になったため）。機能への影響は無い（`range` は汎用の boolean で、コメントの記述に関わらず
  正しく使われている）。対応: その場で `switch_tab`・`focus_agent` の両方を挙げる記述に修正した。

## 留意（点検の実施範囲について）

- 本 work は `mode: autonomous` のため、`aidev-40-coding`「手順5」は本来 T1〜T14 それぞれの差分に
  対して独立点検（`aidev taskcheck start <task-id>`）を行う必要があったが、実際には行わなかった
  （coding 中断・再開の経緯で見落とした。decisions.md には未記載——ここに記録する）。
- 代わりに、全タスク完了後に「手順5.5」（cross。タスクをまたぐ不変条件の点検）を1回、サブエージェントへ
  委譲して実施した（`aidev taskcheck start cross --mode delegated`）。対象は work 全体の diff。
  観点は「複数タスクにまたがる不変条件」（`agentOrderEntries` と `Sidebar.vue` の一致・`tab.move` の
  protocol→SessionService→SessionModel の3層の整合・`view.focusPane` の全呼び出し元・共有ヘルパーの
  使用漏れ・`switch_tab` 専用の決め打ちの残存・独立したテスト実行）を明示的に指示した。
  結果は1件（nit、上記）のみで、must/should の指摘は無し。
- この review 工程（60-review）では、上記の cross 点検ではタスク単位でしか見えない欠陥
  （1タスクの差分で完結するもの）を補う意味で、通常どおり各観点（要件適合・価値適合・正確性・
  規約適合・保守性）を一通り確認する。

## ラウンド1（60-review）

`aidev coverage` を再実行し、tasks 承認時（`ac_total=10 ac_covered=10 gaps=0`）と同じ被覆であることを
確認した（乖離なし）。

- **要件適合**: `test-result.md` の AC1〜AC10 の判定どおり全て満たしている。AC8 は test 工程で
  `KeySettings.test.ts` に実機（DOM）の通しテストを2件追加して裏付け済み（設計時点の「汎用の仕組みで
  拾えるはず」という推論だけに頼っていない）。
- **価値適合**: US1〜US5（`last_pane`・前後workspace・tab並べ替え・resize直接キー・agent移動）はいずれも
  「モードや遠回りな操作を経由せず1打で済ませたい」という価値に対し、既存の `pane.focus`/`workspace.focus`
  の単発呼び出し（または新規 `tab.move`）で直接実現しており、実装が価値からずれていない。
- **正確性**: `SessionModel.moveTab` の境界巡回（splice版）を negative control で確認済み（decisions
  D10）。`lastPane`/`agentDelta`/`focusAgentIndex` の no-op ガード（AC2・AC7a・AC7b）はテストで個別に
  確認済み。taskcheck cross でも取りこぼしなし（nit 1件のみ、対応済み）。
- **規約適合**: 条項は2件のみ（`e2e-observe-browser`＝対象外、`regression-negative-control`＝D10で適用済み）。
  AGENTS.md 本体・PJ ドキュメントに反する記述なし。
- **保守性**: `focusWorkspaceById`/`focusPaneAcrossViews`/`agentOrderEntries` の3つの private ヘルパーで
  重複を避け、`orderedWorkspaceIds`/`orderedAgentPaneIds` を `Sidebar.vue` と共有することで「表示順と
  操作対象順の一致」を構造的に保証している（D4）。既存コードのスタイル（コメントの付け方・エラー処理の
  流儀）と一貫している。

**指摘**: なし（must 0 / should 0 / nit 0。上記「タスク点検ログ」の nit 1件は cross 点検由来で対応済みのため、
このラウンドの集計には含めない。protocol.md「8.」のとおり母集団が異なるため）。
