# 判断の記録（20260926-pane-frame-auto-mode）

## D1: backlog 行「外観と設定の残り（未着手分）」のうち H23（枠の描画モード・隙間の入切）だけを対象にする

- 背景: backlog 行（`.aidev/backlog/product-roadmap.md` の「外観と設定の残り（未着手分）」）は
  (1) サイドバー行の色の条件付け・独自トークン（H21）、(2) pane の枠の描画モード「自動」・隙間の入切（H23）、
  (3) 設定の onboarding（H25b）の 3 つを含む。依頼者（親エージェント経由の利用者の指示）はこの work の対象を
  (2) に限った。依存 `(needs: 20260918-web-terminal-multiplexer)` は着地済みで充足している。
- 決定: この work は H23 の 2 項目（枠の描画モード〔常に/分割時だけ/表示しない〕・隙間の入切）だけを扱う。
  (1)(3) は対象外とし、deliver で backlog 行を `[x]`（H23 分）と `[ ]`（残り）の兄弟に割って残す。
- 理由・代替案: 3 つは互いに独立した部品（サイドバー・pane 枠・初回案内）で、1 PR にまとめる理由が無い。
  並行して別の worktree で別項目が進んでおり、触るファイルを絞るほど衝突が減る。
- 影響: 三層判定は full（UI 部品を変え、`PaneLayout.vue`・`PaneFrame.vue`・設定ストア・設定画面にまたがる）。
  UI 部品を変えるので research を挟む（protocol「4.5」の 5 条件目）。

## D2: 枠の描画モードの既定値は herdr（`auto`）と逆の「常に」にする

- 背景: herdr の `ui.pane_borders` の既定は `"auto"`（分割時だけ。`src/config/model.rs:848-853` の `#[default] Auto`・
  `src/main.rs:287-292` の既定の設定例）。一方、本製品の今の見た目は、pane が 1 つだけの tab でも枠の余白と
  選択の強調を描く（`packages/web/src/components/PaneFrame.vue:310-312,332-335`。単一 pane は常に選ばれている）——
  つまり herdr の語彙では `"always"` に当たる。利用者の指示は「既存の保存値との互換（既定値で今までと同じ見た目に
  なること）を必ず確かめる」。
- 決定: 既定は「常に」（`"always"`）。保存値が無い・読めないときも「常に」。
- 理由・代替案: 既定を herdr に合わせて「分割時だけ」にすると、アップデートしただけで全利用者の単一 pane の見た目
  （余白 4px と選択の強調）が消え、端末の cols/rows も変わる。同じ理由で既定を herdr と逆にした前例がある
  （`ui.status_indicators`。20260921-herdr-settings-gaps の D1）。
- 影響: `docs/herdr-parity.md` の H23 行に「既定は herdr と逆」を明記する。

## D3: 隣・分割の判定は `PaneLayout`、設定の読み出しは `PaneFrame`、判定の規則は純粋関数に置く

- 背景: PR #12 は `PaneLayout.vue` で `useSettingsStore()` を呼んで枠の有無を計算していた（research F15）。
- 決定: `PaneLayout` は構造（`multiPane`・辺ごとの隣）だけを求めて `PaneFrame` へ渡す。設定は `PaneFrame` が読む（既に
  `paneAgentNameVisible` を読んでいる）。規則は `packages/web/src/layout/paneChrome.ts`（新規）の純粋関数。
- 理由・代替案: `PaneLayout` はモバイル（`MobileShell`）でも使い、既存の `PaneLayout.test.ts` の `mountLayout` は Pinia を入れずに
  mount する（`PaneLayout.test.ts:34-55`）。`PaneLayout` でストアを読むと、それらが「active pinia が無い」で壊れる。規則を純粋関数に
  すると、描画モード×隙間×隣の組み合わせをコンポーネントを通さずに網羅して確かめられる。
- 影響: `App.vue` は変えない（root が自分の `layout` から分割を求める）。

## D4: 余白 0 の辺の選択の強調は描かない（境界 `Splitter` に色を付けない）。フォーカスの見え方は端末に重ねて出す

- 背景: 選択の強調・枠のフォーカスの見え方は余白の中に描かれ、端末が上に重なる（research F5・F12）。余白 0 の辺では見えない。
  herdr は隙間切のとき共有する境界線の、選ばれた pane に接する部分を強調色にする（research F4）。
- 決定: (1) 選択の強調は余白のある辺にだけ出る今の仕組みのままにし、`Splitter` 側に色は付けない。(2) 余白 0 の辺が 1 つでもある
  pane の枠がキーボードでフォーカスされたとき（`:focus-visible`）は、端末の上に重ねて内側 2px の outline を描く
  （背景は透明・`pointer-events: none`）。
- 理由・代替案: (1) `Splitter` は分割ノード単位で、pane の一部の辺にだけ接することがある（入れ子の分割）。境界の一部だけを塗るには
  `Splitter` に pane の位置を渡す新しい仕組みが要り、requirements が対象外にした境界の見た目の変更にもなる。枠を消す・隙間を詰める
  のは利用者の選択で、herdr の `off` も強調を出さない。(2) フォーカスは WCAG 2.4.7 の対象で、4 辺とも余白 0 の pane では今の見せ方だと
  何も見えなくなる。重ねる outline は端末の端のセルに 2px かかるが、キーボードでフォーカスしている間だけ。`pointer-events: none` なので
  端末のクリックは妨げず、クリックで端末へフォーカスが移ると消える。既定（4 辺に余白）の見え方は変えない。
- 影響: 設定画面の説明に「枠の右クリックの経路が無くなる」旨を書く。見え方の実画面の確認は未検証の穴。

## D5: 枠を描かない pane では名前のラベル（legend）も描かない

- 背景: 名前のラベルは枠線に埋め込む表示で、pane のドラッグの掴み手も兼ねる（research F14）。
- 決定: `framed` が偽の pane には、名前表示が入でもラベル・上の余白・薄い線を描かない。
- 理由・代替案: herdr の名前表示は枠の線の上にだけ出る（`src/ui/panes.rs:461-463`）。枠が無いのにラベルだけ出すと、ラベルの
  余白が端末の上に新しい帯を作り、「枠を消して広く使う」の目的に反する。代替の「ラベルだけ残す」は採らない。
- 影響: 枠を描かない pane ではラベルのドラッグ（入れ替え・分割・他の tab へ移す）ができない。設定画面の説明に書く。

## D6: PR #12 の取り込みで残った未使用の `PaneBordersMode`・`loadPaneBordersMode` を消し、新しい読み込み関数を設定ストアに置く

- 背景: design を書いた後、`packages/web/src/tabbar/tabBarRight.ts:13-15,40-43` に `PaneBordersMode`（`"auto"|"always"|"off"`）と
  `loadPaneBordersMode`（既定 `"auto"`）が、どこからも使われずに残っていることが分かった（`grep -rn "PaneBordersMode\|loadPaneBordersMode"
  packages/web/src` の結果はこのファイルとそのテスト `tabBarRight.test.ts:4,28-39` だけ）。20260922-appearance-settings-rest の
  D11 が PR #12 から tab バーの分を取り込んだとき（コミット `2d21b33`）に一緒に入った。
- 決定: 2 つとそのテストを消し、この work の `PaneBorders` 型は `layout/paneChrome.ts`、`loadPaneBorders`（既定 `"always"`。D2）は
  `store/settings.ts` に置く（design の「インターフェース」どおり）。
- 理由・代替案: 流用すると、tab バーのモジュールに pane の設定の読み込みが残り、既定値（`"auto"`）も D2 と食い違う。既定だけ
  書き換えて流用する案は、置き場所の不整合を残すので採らない。PR #12 は main に入っていないので、この関数で保存された値は無い。
- 影響: design の「対象範囲」に 2 ファイルを足した。

## D7: 余白 0 の辺があるときのフォーカスの線は、枠の疑似要素（`::after`）に描く（design の「枠に pointer-events: none」から変更）

- 背景: design は `.pane-frame-edge-flush:focus-visible` で枠の要素そのものに `z-index`・outline・`pointer-events: none` を付けるとしていた。
  taskcheck T3 が、余白が一部だけ残る pane（常に×隙間切で隣が 1 辺）ではフォーカス中に残った余白の押下・右クリックが枠に届かなくなる
  （`onMouseDown`・`onContextMenu` が呼ばれない）ことを指摘した。
- 決定: 線は `.pane-frame-edge-flush:focus-visible::after`（`position:absolute; inset:0; z-index:1; pointer-events:none`）に描き、枠そのものの
  イベントは今までどおり受ける。背景色（既存の `.pane-frame-edge:focus-visible`）は余白の部分に今までどおり出る。
- 理由・代替案: 端末のクリックを妨げないという D4 の狙いは疑似要素でも満たせ、枠の操作を失わない。
- 影響: 見え方（実画面）は未検証の穴のまま。

## D8: zoom 中の「辺はすべて外周」は、専用の分岐ではなく「zoom は root だけが受け、root は隣なし」で満たす

- 背景: design は `PaneLayout` で zoom 中に `NO_NEIGHBORS` を渡す分岐を置くとしていた。taskcheck T4 が、`zoomedPaneId` は root だけが受け
  （`App.vue:70`。子へは渡さない）、root の隣は常に `NO_NEIGHBORS` なので、この分岐は効かずテストも拘束していないと指摘した。
- 決定: 分岐を消し、`ownNeighbors` をそのまま渡す。理由を `ownNeighbors` のコメントに書く。テスト（zoom 中の pane が隙間切でも 4 辺に
  余白）は、この前提が崩れたとき（子へ zoom を渡す等）に落ちる形で残す。
- 理由・代替案: 効かない分岐を残すと、読み手に「子でも zoom がありうる」と誤解させる。
- 影響: 振る舞いは design と同じ。

## D9: E2E（`settings.spec.ts`）の Tab の上限回数を 12 → 40 に上げる（E2E は実行しない）

- 背景: `packages/e2e/src/specs/settings.spec.ts` の「キーだけで端末の節のラジオへ入り」は、Tab を最大 12 回押して「端末」節の
  ラジオに着くのを待つ。この work は「端末」節より前の「表示」節に Tab で止まる部品を 2 つ（描画モードのラジオ群・隙間のスイッチ）
  足したので、12 回で届かなくなるおそれがある。利用者の方針で E2E は走らせないため、実際に届くかは確かめられない。
- 決定: 上限を 40 に上げる（着いた時点で抜けるループなので、上限を上げても検証の意味は変わらない）。
- 理由・代替案: 何もしないと、次に E2E を回した人が無関係に見える失敗に当たる。回数を正確に数え直す案は、実ブラウザでしか数えられない
  （許可の状態で飛ばされる switch がある）ため採らない。
- 影響: E2E は未実行（test-result.md の未検証の穴）。
