# レビュー: 選択状態の表示をそろえ、強調をホバーから選択へ移す

## タスク点検ログ（coding 工程内・「3.3」(b)）

13 タスク（T1〜T13）を 1 タスク 1 委譲で点検した（`mode: autonomous` は全タスク必須）。
T14 は自前の差分を持たない（test 工程で消化。decisions.md D1）ので対象外。

- [must][conv:-] `packages/web/src/App.vue:85` `#343746` は `#282a36` と `#44475a` の算術中間（`#363848`）ではないのに、コメントと design が「中間」と断定していた / 対応: 修正済（T1・ラウンド1。値は据え置き、記述を「より明るく／より暗い」に直した）
- [should][conv:-] `packages/web/src/App.vue:84-85` コメントの体裁が design の指定と食い違っていた / 対応: 修正済（T1・ラウンド1）
- [nit][conv:-] `packages/web/src/components/PaneFrame.vue:37-47` `label` と `paneLabel` が pane 名の解決式（`pane.label || pane.agent?.label || pane.title`）を一字一句重複させていた / 対応: 修正済（T7・ラウンド1。`paneName` computed に切り出し、2 つはそれを整形するだけにした）
- [must][conv:-] `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts:421-423` ホバーのテストが**空振りしうる**——`:hover` のルールを消した後は、座標がずれてポインタが枠の帯から外れても「前後で見た目が変わらない」が成り立ち、`:hover` が復活しても気づけない / 対応: 修正済（T11・ラウンド1。`document.querySelector(".pane-frame-edge:hover") !== null` でポインタが帯の上にあることを先に観測してから比較する。**`:hover` を戻すとホバー比較の行で落ちる**ことを実地に確認した）
- [nit][conv:-] `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts:447` `session.focus_changed` を待つ理由（ブラウザは手元で焦点を移してから `pane.focus` を送るので、届いた時点で反映済み）の説明が無く、同ファイル `:284-285` の流儀と揃っていなかった / 対応: 修正済（T12・ラウンド1）
- [should][conv:-] `packages/e2e/src/specs/workspace-tab-pane.spec.ts:380` `GIT_CONFIG_GLOBAL: "/dev/null"` が POSIX 前提であることが書かれていなかった / 対応: 修正済（T10・ラウンド1。この E2E 一式が Linux・chromium 前提である旨をコメントに明記）

### 横断の点検（`cross`・「3.3」(b) 手順 5.5）

タスク 1 件の差分だけでは原理的に見えない、組み合わせで初めて壊れるものを 1 回だけ点検した。

- [should][conv:-] `packages/web/src/components/Sidebar.vue:246-253` つまみを `right: -3px` → `right: 0` にしたことで、**行のクリック・ホバーを奪う幅が実質 3px から 6px に増える**（つまみは絶対配置で行より上に描かれる）。AC3 は横スクロールバーの有無しか見ないので、この副作用は T5 の差分だけでは見えない / 対応: 許容（decisions.md D3 に理由と戻し方を記録。掴める幅が実質 3px → 6px になる利点と交換し、重なる範囲では `cursor: col-resize` が出るので押す前に判別できる）
- [nit][conv:-] `packages/web/src/components/Sidebar.vue:164-166` spaces 区画の**最後の行が表示中のとき、行の背景と `.sidebar-agents` の `border-top` が同色**（`--wtm-menu-active-bg` と `--wtm-menu-border` がどちらも `#44475a`）になり区切り線が消える。以前は navigate のカーソルが乗った一瞬だけだったが、「表示中」は常時なので持続する / 対応: backlog（design「backlog へ送るもの」の 2 番。色のトークンを分ける話と根が同じ）

**件数の扱い**: 上の指摘は**ラウンド指摘（下の「ラウンド n」）には数えない**（点検で潰れた欠陥は
60 review の工程に到達しておらず、母集団が違う。protocol.md「8.」）。

## ラウンド 1（2026-09-20）

- [should][conv:regression-negative-control!] `packages/web/src/components/Sidebar.test.ts:119-148`・`packages/web/src/components/PaneFrame.test.ts:132-156` AC1・AC2・AC7・AC8 で足した単体テストについて、**修正前のコードで落ちることを確かめた生の出力が `test-result.md` に無い**。載っているのは E2E 3 件の分だけで、単体テストを条項の対象から外す理由も記録が無い / 対応: 修正済（ラウンド1。実際に実装を HEAD へ戻して 2 ファイルを走らせ、落ちた生の出力を `test-result.md`「失敗の証跡」4 に貼った）
- [nit][conv:-] `packages/web/src/components/Sidebar.vue:103,106` 「表示中」の判定 `workspace.id === view.workspaceId` を `:class` と `:aria-current` の 2 箇所に書いている。`spaces` computed（`:29-35`）が既に `showGit` を算出しているので、そこに `isCurrent` を足せば重複が消え、`PaneFrame.vue` の `selected` computed とも揃う / 対応: 修正済（ラウンド1）

**通算**: must 0 / should 1 / nit 1（タスク点検ログの 8 件は母集団が違うので数えない）

## ラウンド 2（2026-09-20）

範囲はラウンド 1 の指摘の解消と、その修正が作った差分だけ（ラウンド 2 以降の規約）。

- ラウンド 1 の 2 件はいずれも解消済み。**追加の指摘なし**。
  - should（`regression-negative-control`）: `test-result.md`「失敗の証跡」4 に生の出力が入り、
    落ちた 6 件が HEAD の実装に該当機能が無いことと一致することを、`git show HEAD:…` を読んで確認済み。
    agents 行のテストが HEAD でも通る（＝落ちない）という記述も実装と整合。
  - nit: `Sidebar.vue` の `spaces` computed に `isCurrent` が出て、テンプレートの 2 箇所がそこを参照する形になった。
- 新しく作った差分（`isCurrent`）の欠陥点検も実施。型は `boolean`、`view.workspaceId` の変化で
  computed が再計算されることを `PaneFrame.vue` の `selected` と同じ仕組みとして確認。既存テスト 34 件も合格。
- 範囲外の発見: 無し。

**レビューガイド（`walkthrough.md`）は作らない**。3 条件のいずれにも当たらないため——
差分は 8 ファイル・+303/-16 行と小さく、`packages/web` の 2 コンポーネントに閉じていて責務や依存の向きを跨がず、
制御フローも足していない（変更の中心は CSS の宣言と属性の付け外し）。
