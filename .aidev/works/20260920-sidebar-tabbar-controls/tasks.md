# タスク: サイドバーとタブバーに、マウスで使える操作を足す

## 実装方針

**型と状態を先に置き、それを使うボタンを後に置く**。逆にするとテンプレートが未定義の状態を参照する。

同一ファイルを触るタスクは直列にする（`aidev-40-coding` 手順 2）。
`Sidebar.vue` は T4→T5→T6→T7、`TabBar.vue` は T8、`ContextMenu.vue` は T2、`view.ts` は T3、
`keys-mouse-dialogs.spec.ts` は T9→T16。

**単体テストは実装と同じ粒度で割る**（1 ファイル 1 タスク）。実装をファイルごとに分けたのに
テストだけ 1 つにまとめると、どの実装の検証が済んだのかが追えなくなる。

## 作業順序と依存関係

順序は `依存:` に全て落としてある。理由だけ書く。

- **T2 が終わるまで typecheck が通らない**。`MenuTarget` に種類を足す（T1）と
  `ContextMenu.vue` の最後の `return` がコンパイルエラーになる（design の設計方針 2）。
  **そのため T3・T4・T8 も T2 に依存させている**——依存を書かないと同じウェーブに入り、
  壊れたまま別のタスクを「完了」にしてしまう。
- **T9（Tab の到達順の修正）は T8 の後**。＋ を置いて初めて順が変わる。
  **落ちたのを見てから直す**（先に直すと、変わったことを確かめずに期待だけ書き換える形になる）。

## リスク / 留意点

- **`Sidebar.vue:5` の `type STATE_PRIORITY` は型だけの import**。値として使うので `type` を外す（T6）。
- **`view.workspaceId` は `string | null`**。テンプレートで渡すと `vue-tsc` が落ちる。script 側でガードする（T8）。
- **＋ は Tab の到達順を変える**。既存 E2E 2 件が必ず落ちる（decisions.md D2）。T9 で直す。
- **`.tab-bar-new` に `font: inherit` を付ける**。`padding` だけ揃えても既定のボタンフォントで
  行の高さが変わり、帯が高くなって PTY の行が減る（AC14）。
- **`.sidebar` のスクロールの持ち方を変えない**（decisions.md D3）。

## テスト方針

- **単体**: ボタンの存在・押したときに呼ばれるもの・属性・並び順・永続化。scoped CSS は当たらないので見た目は見ない。
- **E2E**: 実際に押して結果が変わること、再読み込みで残ること、折りたたみ時に横へ溢れないこと、帯の高さ。
- **AC14 は「＋ を消したときと比べる」**。同じ実行の中で `.tab-bar-new` を `display:none` にして
  帯の高さを測り、表示したときと一致することを確かめる。
  **`cols` / `rows` の固定値は使わない**——xterm のフォントを指定していないので環境でセル寸法が変わる。
  **当初は「帯の高さ === タブの高さ ＋ 下線」で見ようとしたが、これは何も確かめていなかった**
  ——タブも ＋ も同じ行の高さへ引き伸ばされるので、＋ が何 px でも等式が成り立つ（負の対照で判明）。
- **負の対照**（条項 `regression-negative-control`）:
  - **T14（帯の高さ）**: 実装後に `.tab-bar-new` を壊してビルドし直し、落ちることを確かめる。
    **`font: inherit` を外しただけでは落ちなかった**（この環境では高さが変わらない）ので、
    `padding` を厚くする形に替えた。条項の「落ちなければそのテストは捕まえていない」に当たる場面で、
    ここでテスト自体を書き直した。
  - **T15・T16（新しい機能の E2E）**: 実装前は**要素そのものが無い**ので、走らせれば必ず落ちる。
    それは「セレクタが見つからない」だけで、**押した結果が正しいかは何も確かめていない**。
    そこで実装後に、**振る舞いだけを壊して**（例：「新規」ボタンの `@click` を空にする、
    ソートの比較関数を `() => 0` にする）落ちることを確かめる。
    条項が本来狙う「このテストは対象の欠陥を捕まえられるか」を、ここで担保する。
  - 生の出力は `test-result.md` に貼る（要約に置き換えない）。
- 一式（全パッケージの単体 ＋ 既定の E2E）は test 工程で 1 回通す（T17）。
  `mobile.spec.ts` の D105 は**先行 work の前から一式のときだけ落ちる**（先行 work の decisions.md D2）。
  この work もモバイルに届かないので、落ちても原因をここに帰さない。

## タスク

- [x] T1: `MenuTarget` に `{ kind: "global" }` を足す
      対象: `packages/web/src/term/MouseBridge.ts:6` / 根拠: research A5
      依存: なし
      AC: AC4
- [x] T2: `ContextMenu.vue` に `global` の分岐を足す（項目は「キー割り当て」「移動」「切り離し」の順。
      それぞれ `actions.run({ type: "help" | "goto" | "detach" })`）
      対象: `packages/web/src/components/ContextMenu.vue:47-76` / 根拠: research A6
      依存: T1
      AC: AC4
- [x] T3: view ストアに `agentSort` と `toggleAgentSort` を足し、`localStorage`（`wtm.prefs.v1`）へ
      保存・復元する（既存の `loadStoredView` / `saveStoredView` と同じ try/catch の形。壊れた値は `grouped` に落とす）
      対象: `packages/web/src/store/view.ts:8` `:15-33` `:196-` / 根拠: research A7
      依存: T2
      AC: AC10
- [x] T4: `Sidebar.vue` の `</section>`（agents の終わり）と `sidebar-divider` の間にフッタを足す。
      展開時 `«` / 折りたたみ時 `»`、`actions.run({ type: "toggleSidebar" })`、
      `:aria-expanded="!view.sidebarCollapsed"`、**`aria-label`**（記号だけでは意図が読めない）、
      **`@keydown.stop`**（端末へ二重に流さない）。**折りたたみ時も描く**（`v-if` で消さない）
      対象: `packages/web/src/components/Sidebar.vue:137-139` / 根拠: research A1
      依存: T2
      AC: AC1, AC2
- [x] T5: `Sidebar.vue` の spaces 区画の末尾にフッタを足す（「新規」＝`newWorkspace`、
      「メニュー」＝ボタンの矩形を座標に `openContextMenu({ kind: "global" }, at)`）。
      **`@keydown.stop` を付ける**。**折りたたみ時は `v-if` で描かない**
      対象: `packages/web/src/components/Sidebar.vue:99-121` / 根拠: research A1
      依存: T4
      AC: AC3, AC4, AC11
- [x] T6: `Sidebar.vue` の agents 区画の先頭に見出しとソートのボタンを足し（**`v-if` で折りたたみ時は描かない**、
      **`aria-label` と `@keydown.stop` を付ける**）、`agents` computed に並べ替えを入れる
      （`grouped` は既存のまま、`priority` は優先度の降順 → `since` の新しい順）。
      **`STATE_PRIORITY` の import から `type` を外す**
      対象: `packages/web/src/components/Sidebar.vue:5` `:39-49` `:123-137` / 根拠: research A3
      依存: T3, T5
      AC: AC7, AC8, AC9, AC11
- [x] T7: `Sidebar.vue` に 3 つの帯のスタイルを足す（`padding-right: 6px` でつまみの下に潜らせない、
      `sidebar-footer` は `margin-top: auto`、ボタンは `font: inherit` と `background: none`）
      対象: `packages/web/src/components/Sidebar.vue:143-` / 根拠: research A2
      依存: T6
      AC: AC11
- [x] T8: `TabBar.vue` の `role="tablist"` と `overflow-x: auto` を `.tab-bar-tabs` へ移し、
      `.tab-bar-new`（＋）を足す。**`font: inherit`** と **`@keydown.stop`** を付ける。
      押したときは script 側で `view.workspaceId` の null を外してから `newTabInWorkspace`
      対象: `packages/web/src/components/TabBar.vue:42-57` `:64-90` / 根拠: research A4
      依存: T2
      AC: AC6, AC14
- [x] T9: `keys-mouse-dialogs.spec.ts` の Tab の到達順の期待を直す（＋ が 1 つ挟まる）。
      `describeFocus` に ＋ の分岐を足す。**T8 の後に一度落としてから直す**
      対象: `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts:230-233` `:247-261` `:293-299`
      依存: T8
      AC: AC13
- [x] T10: `Sidebar.test.ts` に単体テストを足す（3 つの帯のボタンの存在と `run` の引数、
      折りたたみ時の出し分け、`aria-expanded`、並び順の 2 ケース＝優先度違いと同点の `since` 違い）
      対象: `packages/web/src/components/Sidebar.test.ts` / 根拠: research A9
      依存: T7
      AC: AC1, AC2, AC3, AC7, AC8, AC9, AC11
- [x] T11: `TabBar.test.ts` に単体テストを足す（＋ の存在、押すと `newTabInWorkspace` が呼ばれる、
      **タブ 0 件でも押せる**、`workspaceId` が null なら押せない）
      対象: `packages/web/src/components/TabBar.test.ts` / 根拠: research A9
      依存: T8
      AC: AC6
- [x] T12: `ContextMenu.test.ts` に単体テストを足す（`global` の 3 項目の文言と、
      選んだときに `run` へ渡る `type`、Esc で何も実行されないこと）
      対象: `packages/web/src/components/ContextMenu.test.ts` / 根拠: research A9
      依存: T2
      AC: AC4, AC-I2
- [x] T13: `view.test.ts` に単体テストを足す（`toggleAgentSort` で反転、`localStorage` へ書く、
      新しいストアが読み戻す、壊れた値なら `grouped` に落ちる、`localStorage` が例外を投げても動く）
      対象: `packages/web/src/store/view.test.ts` / 根拠: research A9
      依存: T3
      AC: AC10
- [x] T14: 帯の高さと折りたたみの E2E を足す（`.tab-bar` の高さ === `.tab-bar-item` の高さ、
      折りたたみ時に `.sidebar` の `scrollWidth <= clientWidth`）。
      **負の対照は `.tab-bar-new` の `font: inherit` だけを外して落ちることを見る**
      対象: `packages/e2e/src/specs/terminal-app.spec.ts` （新しい test を追加）
      依存: T7, T8
      AC: AC11, AC14
- [x] T15: ボタンが効くことの E2E を足す（折りたたみボタンで畳む／展開する、「新規」で workspace が増える、
      ＋ で名前入力が開く）。**負の対照は実装後に振る舞いだけを壊して**（`@click` を空にする）落ちることを見る
      対象: `packages/e2e/src/specs/workspace-tab-pane.spec.ts` （新しい test を追加）
      依存: T7, T8
      AC: AC1, AC3, AC6, AC12
- [x] T16: メニューと並び順の E2E を足す（「メニュー」をキーボードだけで開いて Esc で閉じ、
      元のボタンへフォーカスが戻る／ソートを切り替えて `page.reload()` しても残る）。
      **負の対照は実装後にソートの比較関数を `() => 0` にして**落ちることを見る
      対象: `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts` （新しい test を追加）
      依存: T9, T13
      AC: AC5, AC10, AC-I1, AC-I3, AC-I4, AC-I5
- [ ] T17: 全パッケージの単体テストと既定の E2E を走らせて結果を記録する
      （**test 工程で消化する**。coding では未チェックのまま承認してよい。decisions.md D1）
      対象: 未特定（走らせるだけで自前の差分を持たない）
      依存: T10, T11, T12, T13, T14, T15, T16
      AC: AC13
