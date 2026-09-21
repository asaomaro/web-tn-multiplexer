# レビュー: サイドバーとタブバーに、マウスで使える操作を足す

## タスク点検ログ（coding 工程内・「3.3」(b)）

16 タスク（T1〜T16）を点検した（`mode: autonomous` は全タスク必須）。
**委譲は 6 本にまとめた**（規約は 1 委譲 1 タスク。逸脱の理由と代償は decisions.md D5）。
T17 は自前の差分を持たない（test 工程で消化。decisions.md D1）ので対象外。

### 実装の指摘

- [should][conv:-] `packages/web/src/components/ContextMenu.vue:80` `global` の分岐が `target` のフィールドを
  参照しないため、**design が実装方式の根拠に挙げた「種類が増えるとコンパイラが分岐を強制する」性質が失われていた**
  （5 つ目を足しても黙って global の項目を返す） / 対応: 修正済（T2・ラウンド2。`target satisfies { kind: "global" }` で網羅性を明示）
- [should][conv:-] `packages/web/src/components/Sidebar.vue:139-140` `ref="newWsBtn"` / `ref="menuBtn"` を
  付けているが `<script setup>` 側に同名の宣言が無く、何にも結び付かない死んだ属性だった / 対応: 修正済（T5・ラウンド1。属性ごと削除）
- [should][conv:-] `packages/web/src/store/view.ts:52` `JSON.parse` が配列を返したときの扱いが
  既存の緩い流儀のままだった / 対応: 修正済（T3・ラウンド1。`!Array.isArray(parsed)` を足した）
- [nit][conv:-] `packages/web/src/store/view.ts:99` `ref<AgentSort>(...)` の型引数が冗長（推論で足りる） / 対応: 修正済（T3・ラウンド1）
- [nit][conv:-] `packages/web/src/components/TabBar.vue:99` `.tab-bar-new` の `border-left` と
  最後のタブの `border-right` が重なり、そこだけ区切りが 2px になる / 対応: 修正済（T8・ラウンド1。`border-left` を外した）
- [nit][conv:-] `packages/web/src/components/Sidebar.vue:297` `padding` の 4 値指定が冗長 / 対応: 修正済（T7・ラウンド1）

### テストの指摘（いずれも「緑だが何も守っていない」類）

- [must][conv:-] `packages/web/src/components/Sidebar.test.ts` **AC7（ソートのボタンの表示と押下）を
  確かめるテストが無かった**。並び順のテストは `view.toggleAgentSort()` をストアへ直接呼ぶだけで、
  `.sidebar-sort-btn` を一度も押していなかった / 対応: 修正済（T10・ラウンド1。表示が現在値であること・押すと切り替わることを足した）
- [should][conv:regression-negative-control!] `packages/web/src/components/Sidebar.test.ts:151-163`
  折りたたみのテストが 2 つの帯を 1 つの `it` で見ていたため、**spaces のフッタの `v-if` を外しても
  agents の見出し側の失敗に隠れて素通りした**（点検が実地に確認） / 対応: 修正済（T10・ラウンド1。帯ごとに `it` を分け、畳んだ状態で押せることも足した）
- [should][conv:e2e-observe-browser] `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts:476`
  「キーボードだけで開いて閉じ」と名乗りながら `.focus()` で飛ばしており、**Tab で到達できることは
  確かめていなかった** / 対応: 修正済（T16・ラウンド1。Tab を押して到達順を記録し、4 つのボタンが
  DOM の順で出ることを確かめる形にした）
- [should][conv:-] `packages/web/src/components/TabBar.test.ts:144` テスト名が「名前入力が開く」と
  主張しているが、実際に確かめているのは `newTabInWorkspace` が呼ばれたことだけ（ダイアログを開くのは dispatcher の責務） / 対応: 修正済（T11・ラウンド1。名前を実態に合わせた）
- [nit][conv:-] `packages/web/src/components/ContextMenu.test.ts:168` セレクタが同ファイルの流儀
  （`[role="menu"]`）と不揃い / 対応: 修正済（T12・ラウンド1）
- [nit][conv:-] `packages/web/src/components/Sidebar.test.ts` `instanceId` の与え方の流儀が既存と混在 / 対応: 許容（新しいテストは同じ tab に複数 pane を置くので別 ID が要る。既存は 1 件なので既定のままでよい）

### 横断の点検（`cross`・手順 5.5）

- [must][conv:-] `packages/web/src/components/{TabBar,ContextMenu}.test.ts`・`packages/web/src/App.test.ts`
  **`wtm.prefs.v1` を読むのは view ストアの初期化時**なので、view ストアを使う全コンポーネントのテストが
  影響を受けるが、`localStorage.clear()` を持つのは 2 ファイルだけだった。同じワーカーでファイル順に走ると
  先のファイルの選択が後へ漏れる / 対応: 修正済（3 ファイルに後始末を足した）
- [should][conv:-] `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts:479-489` Tab の到達順を確かめているのは
  **展開時だけ**で、折りたたむと帯が 2 つ消えて段数が変わることを確かめていない / 対応: 修正済（`terminal-app.spec.ts` の折りたたみのテストに、折りたたみボタン → タブの順を足した）
- [should][conv:-] `packages/web/src/components/Sidebar.vue:304-307` `.sidebar-footer` は `margin-top: auto` で
  常に見えるが、**`.sidebar-section-footer`（新規・メニュー）は行が多いと画面外へ流れる**。
  その状態では「一度折りたたむ」以外に到達できないことがある / 対応: backlog（design「backlog へ送るもの」1 に追記）
- [nit][conv:-] `packages/web/src/components/Sidebar.vue:290-299` `calc(0.8em + 6px)` の `6px` の出所
  （つまみの幅）がコメントにしか無い / 対応: 許容（同じファイル内の近接した定義で、コメントに明記してある）

**件数の扱い**: 上の指摘は**ラウンド指摘には数えない**（点検で潰れた欠陥は 60 review に到達しておらず、
母集団が違う。protocol.md「8.」）。

## ラウンド 1（2026-09-20）

- [should][conv:-] `packages/web/src/components/Sidebar.vue:147` ソートのボタンのラベルが
  `grouped` / `priority` という**内部の値のまま**出ている。この製品の UI 文字列は他がすべて日本語
  （同ファイルの「＋ 新規」「メニュー」、`ContextMenu.vue` の「キー割り当て」「移動」「切り離し」）で、
  ここだけ enum の値が露出している。`aria-label` も「並び順: grouped（押すと切り替え）」となり、
  読み上げでも英語の生値が出る。herdr は英語 UI なので自然だが、**日本語 UI へ読み替える判断が
  requirements / design のどこにも記録されていない** / 対応: 修正済（ラウンド1。
  「グループ順」「優先度順」に変え、判断を decisions.md D6 に記録）
- [nit][conv:-] `packages/web/src/components/Sidebar.vue:53` 並べ替えの比較関数が 1 行に `||` で
  2 つのキーを畳み込んでおり 140 字を超える。同ファイルの他の computed は複数行に分けている / 対応: 修正済（ラウンド1）
- [nit][conv:-] `packages/web/src/components/Sidebar.vue:166-178` `.sidebar-footer` はボタン 1 つだけを
  包む `<div>` で、ボタン自身に `margin-top: auto; align-self: flex-end` を付ければ省ける / 対応: 許容
  （3 つの帯で同じ padding 規則を共有する形にしてあるので、1 つだけ構造を変えるほうが規則として崩れる。
  指摘者も「現状の方が規則としては一貫している」と併記している）

**通算**: must 0 / should 1 / nit 2（タスク点検ログの 16 件は母集団が違うので数えない）

## ラウンド 2（2026-09-20）

範囲はラウンド 1 の指摘の解消と、その修正が作った差分だけ（ラウンド 2 以降の規約）。

- ラウンド 1 の 3 件（表示名の日本語化・`aria-expanded` の追加・比較関数の複数行化）はいずれも解消済み。
  **追加の指摘なし**。
- 内部の値と保存キーが `grouped` / `priority` のままであること（概念の対応が保たれていること）を確認。
- `aria-expanded` の出し方が `PaneFrame.vue` の同じパターンと揃っていることを確認。
- 新しい差分について**空振り検証**を実施（表示名を生値に戻す／`aria-expanded` を消す／
  `globalMenuOpen` を `false` 固定にする／比較関数の第 2 キーを落とす、の 4 通り）。
  **いずれも対応する単体テストが落ちた**（確認後は復元し `git diff` の一致を確認済み）。
- 範囲外の発見: `AGENT_SORT_LABEL` が `<script setup>` 内の定数なので他コンポーネントから参照できない。
  現時点で参照箇所は無く、この work の範囲では問題にならない。

**レビューガイド（`walkthrough.md`）は作らない**。3 条件のいずれにも当たらないため——
差分は 13 ファイル・+634/-33 で、`packages/web` の 4 ファイルと E2E に閉じており、
責務や依存の向きを跨がない（新しい状態は `agentSort` 1 つ、新しい型は `MenuTarget` の 1 種類）。
制御フローも足していない（既存の `run` と `ContextMenu` に載せただけ）。
