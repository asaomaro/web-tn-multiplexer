# 決定記録

## D1: 状態の記号表示の既定を「入」にする（herdr の既定は「切」）

- 背景: herdr の `ui.status_indicators` の既定は `dots`（`[H]src/config/model.rs:111-117`・`:963`・`:1188`。
  research F9）。`dots` では blocked / working / done が同じ `●` で、**色だけ**で区別している（F8）。
  本製品のいまの点も同じ構造（F5）。
- 決定: 本製品の既定は**記号「入」**（herdr の `symbols` と同じ字形）にする。「切」にすれば従来の色の点に戻せる。
- 理由 / 代替案: **WCAG 1.4.1（色の使用・レベル A）は色を唯一の手段にすることを禁じている**（F12）。
  既定を「切」にすると、**色の見分けが付きにくい利用者が自分で設定を探して入れるまで状態が読めない**——
  その利用者には「状態が読めない」ので、設定の存在に気づく手掛かりも乏しい。
  退けた案: herdr に合わせて既定「切」——herdr から来た利用者の見た目は変わらないが、既定で達成基準 A に
  違反した状態を出荷することになる。字形は herdr の `symbols` と同じなので、herdr の利用者には
  「記号表示を入れた herdr」として説明できる。
- 影響: requirements の機能要件「既定で入」と AC7 はこの判断に基づく。`docs/herdr-parity.md` の新しい行（H23b）に
  「既定が herdr と逆」と書く。

## D2: herdr の実装を上流のリポジトリで直接確かめた

- 背景: research の委譲先は「herdr の記号表示が使う字形は、リポジトリ内に資料が無いので未特定」と返した
  （前々 work の調査が出典にした herdr の文書はリポジトリに入っていない）。
- 決定: 本製品が判定ルールを取り込んだのと同じ版（`herdrdev/herdr` の `da6bcd5`）を GitHub API で読み、
  字形（`src/client/shell.rs:177-196`）・既定（`src/config/model.rs:111-117`）・幅の保存
  （`src/client/shell/preferences.rs:18-24`）を一次資料で確かめた。
- 理由: 字形を推測で決めると「herdr 相当」と書けない。**「資料が無い」は「調べられない」ではない**。
- 影響: research.md の F8〜F10・F20 は上流の `file:line` を出所にしている。design の D1・D3・D4 はこれに依拠する。

## D3: architecture 工程は挟まない

- 背景: autonomous では、protocol.md「4.5」の条件に当たれば architecture を自動で挟む。
- 決定: 挟まない。
- 理由: 変更は **web の中だけ**で、責務や依存の向きを跨がない（protocol・server は変えない）。
  新しい部品（`StateIcon.vue`・`store/settings.ts`・`store/stateIndicator.ts`・`term/scrollback.ts`）は
  既存の置き場所の流儀（`store/paneName.ts` 等）に沿い、design の「インターフェース」で形まで決めてある。
- 影響: tasks は design から直接分解する。

## D4: T12（テストの実行と記録）は test 工程で消化し、E2E の一式は deliver の直前に回す

- 背景: `tasks.md` は coding のチェックリストで、T12 は自前の差分を持たない。また利用者から
  「少しの修正ですべて回すのは時間とみあいません」と指示があり、E2E の一式（77 本・`workers: 1` で 5〜8 分）は
  deliver の直前に 1 回にしている（前 work の `test-result.md`「ラウンド 4」）。
- 決定: T12 は coding の承認時に未チェックのまま残し、test 工程で**単体テスト一式と、この work で足した・触った E2E の spec**
  を走らせて記録する。**E2E の一式は deliver の直前に 1 回**回し、その結果も `test-result.md` に足す。
  review から差し戻されたら、戻った後の deliver の直前に回す。
- 理由: `aidev-30-tasks` 手順6 の「coding ではなく test / deliver で消化する」に当たる。一式を test 工程で回すと、
  review の差し戻しのたびに「deliver の直前」でなくなる（tasks の点検の指摘）。
