# 調査: サイドバーとタブバーに、マウスで使える操作を足す

requirements の「未確定事項」3 件（全体メニューをどう出すか／ソート順の保存先／折りたたみボタンの置き場）を、
リポジトリの実物で埋める。herdr 側の挙動は requirements の「herdr ではどうなっているか」に既にまとめてあるので、
ここでは**この製品の実装**だけを見る。**設計判断は design へ送る**。

## 調査の問い

- Q1: 全体メニューは既存の `ContextMenu.vue` で出せるか。出すなら何を変える必要があるか。
- Q2: ソート順の保存先はどこが筋か。既存の永続化はどうなっているか。
- Q3: ボタンを置く場所の候補と、既存の要素との競合。
- Q4: 変更の起点になる実装アンカー。

## 判明した事実

### F1: 全体メニューは `ContextMenu.vue` に**種類を 1 つ足す**だけで出せる

- メニューの宛先の型は `MenuTarget`（`packages/web/src/term/MouseBridge.ts:6`）:
  `{ kind: "pane"; paneId } | { kind: "tab"; tabId } | { kind: "workspace"; workspaceId }` の 3 種類。
- 開く/閉じるは view ストアが持つ（`store/view.ts:156-162` の `openContextMenu` / `closeContextMenu`、
  状態は `:70` の `contextMenu`）。座標も一緒に持つ。
- `ContextMenu.vue` は**この型で分岐して項目を返す**（`:47-76` の `items` computed）。
  pane → tab → 最後は **workspace として `return`**（`:72-76`。`if` を付けずに落ちている）。
  **つまり新しい種類を足すと、この最後の `return` が型エラーになる**
  （`target.workspaceId` が union に無くなるため）——コンパイラが分岐の追加を強制してくれる。
- **キーボード操作・フォーカスの戻り・外側クリックでの close は `ContextMenu.vue` が既に持っている**
  （`:80-100` の `activate` / `onKeydown`、`:36-45` の `restoreFocus`。開く前の要素を覚えて戻す）。
  → requirements の AC5・AC-I1・AC-I2・AC-I4 は、この部品を使えば**作らずに満たせる**。
- 座標は `position: fixed` で `view.contextMenu.at` に置く（`ContextMenu.vue` の `<style>`）。
  ボタンの位置から開くなら、ボタンの `getBoundingClientRect()` を渡せばよい
  （`PaneFrame.vue` のキーボード経路が既にその形——`rect.left` / `rect.top` を渡している）。

### F2: 既存の永続化は `sessionStorage` で、**表示位置だけ**

- `store/view.ts:8` の `STORAGE_KEY = "wtm.view.v1"`、`:17` で `sessionStorage.getItem`、
  `:29` で `setItem`。保存しているのは `{ workspaceId, tabId }` の 2 つだけ（`:10-13` の `StoredView`）。
- `sessionStorage` はタブの寿命で消える。**表示位置は「このタブでどこを見ていたか」なので妥当**だが、
  並び順は「この端末での好み」なので同じ入れ物に入れると AC10 の (b)（タブを閉じて開き直しても残る）を満たせない。
- サイドバーの幅（`Sidebar.vue` の `width` ref）と折りたたみ（`store/view.ts:84` の `sidebarCollapsed`）は
  **どちらも保存していない**。折りたたみの永続化は requirements の対象外（AC に無い）。
- **`localStorage` は既に 2 箇所で使っている**（当初「0 件」と書いたのは誤り。design の点検で判明）:
  `store/seen.ts`（キー `wtm.seen.v1`。既読の記録）と `components/Toast.vue:18,25`
  （キー `wtm.hint.prefixHelp.v1`。ヒントを出したかどうか）。
  **つまり「ブラウザをまたいで残す好み」を `localStorage` に置く前例が既にある**。

### F3: ボタンを置ける場所と、既存要素との競合

- サイドバーの構造（`Sidebar.vue:98-140`）: `<nav class="sidebar">` の中に
  `<section class="sidebar-spaces">`（`:99-121`）→ `<section class="sidebar-agents">`（`:123-137`）→
  `<div class="sidebar-divider">`（`:139`）。
- **`.sidebar-divider` は `position: absolute; top: 0; right: 0; width: 6px; height: 100%`**
  （`Sidebar.vue:248-` ／ 先行 work で `right: -3px` から変更済み）。
  **サイドバーの右端 6px 全体を縦一杯に覆う**ので、右端に置いたボタンはこれに隠れて押せない。
  → 右下に置くなら、つまみより**手前に描く**か、つまみと重ならない位置にする必要がある。
- `.sidebar` は `display: flex; flex-direction: column`（`:143-` 付近）。
  区画は `flex: none` ではないので、ボタンの帯を足すなら `flex: none` を付けて高さを固定する。
- `.sidebar-collapsed` は `width: 3em !important`（`Sidebar.vue:157-159`）。
- タブバー（`TabBar.vue:42-57`）: `<div class="tab-bar" role="tablist">` の中に
  `v-for` の `<button class="tab-bar-item" role="tab">` が並ぶだけ。
  `.tab-bar` は `display: flex; overflow-x: auto`（`:64-70`）。
  **`role="tablist"` の中に `role="tab"` でない要素を置くことになる**ので、
  ＋ ボタンの role の扱いを決める必要がある（design）。
- `workspace-tab-pane.spec.ts` は `.sidebar-spaces .sidebar-row` と `.tab-bar-item` の**件数**を数える
  （`:24`・`:30`・`:62`・`:68`・`:99`・`:122` 付近）。**足すボタンにこれらのクラスを付けない**。

### F4: 押したときに呼ぶものは全て既にある

`ActionDispatcher`（`packages/web/src/actions/ActionDispatcher.ts`）:

| 要望 | 既存の入口 | 行 |
|---|---|---|
| 折りたたみ | `view.toggleSidebar()`（`store/view.ts:180-182`）。dispatcher の `case "toggleSidebar"` 経由でも可 | `:113-115` |
| 新しい workspace | `case "newWorkspace"` → `private newWorkspace()`（名前を尋ねず `workspace.create` を送る） | `:89`・`:330-343` |
| ヘルプ | `case "help"` | `:107` |
| 移動（goto） | `case "goto"` | `:110` |
| 切り離し | `case "detach"` | `:116` |
| 新しいタブ | **`newTabInWorkspace(workspaceId)` は public**（`ContextMenu.vue` が既に呼んでいる） | `:258-260` |

- `newTabInWorkspace` は名前入力のダイアログを開く（`view.openDialogWithContext`）。
  確定で `tab.create` を送る（`:144-161` の `confirmNewTab`）。
  **herdr のように「タブ数 + 1」を初期値にする機能は無い**（現状の初期値は design で確認する）。
- **`help` / `goto` / `detach` は private かどうかを確認する必要がある**（`ContextMenu.vue` から呼べる形か）。
  `newTabInWorkspace` のように public なら直接、そうでなければ `dispatch({ type: … })` を使う。

### F5: エージェントの並びに使える材料

- 現在の並び: `Sidebar.vue` の `agents` computed が `[...session.panes.values()].filter(p => p.agent)`。
  `session.panes` は `Map`（`store/session.ts`）なので**挿入順**。
- 優先度: `store/seen.ts:48-54` の `STATE_PRIORITY`（`blocked: 4` / `done: 3` / `working: 2` / `idle: 1` / `unknown: 0`）。
  **これは `displayStateFor` が返す表示用の状態に対する優先度**で、`done`（既読でない完了）を含む。
  herdr の `status_priority` と同じ並び。
- 状態が変わった時刻: `AgentInfo.since`（`packages/protocol/src/model.ts:82`。epoch ms。
  コメントに「状態が変わった時刻」とある）。herdr の `state_change_seq` に当たる。
- `agents` computed は既に `displayStateFor(...)` を呼んで `state` を出している
  （`Sidebar.vue` の `agents`）ので、**並べ替えに必要な値はその場に揃っている**。

## 影響範囲

- `packages/web/src/components/Sidebar.vue`（テンプレートとスタイル）／`TabBar.vue`／
  `packages/web/src/store/view.ts`（並び順の保持・永続化）／`packages/web/src/term/MouseBridge.ts`（`MenuTarget` の型）／
  `packages/web/src/components/ContextMenu.vue`（新しい種類の分岐）。
- 既存テスト: `Sidebar.test.ts`・`TabBar.test.ts`・`ContextMenu.test.ts`・`view.test.ts`。
- 既存 E2E: `workspace-tab-pane.spec.ts`（件数）・`terminal-app.spec.ts`（折りたたみと PTY の列）・
  `keys-mouse-dialogs.spec.ts`（メニューのキーボード操作）・`agent-detection.spec.ts`（agents の行）。

## 実現性 / リスク

- F1 により、**全体メニューは `MenuTarget` に 1 種類足すのが最小**。専用の部品を作ると、
  キーボード・フォーカス・外側クリックの処理を二重に持つことになる。
- F2 により、**並び順は `sessionStorage` とは別の入れ物（`localStorage`）が要る**。
  `localStorage` を使う前例は `store/seen.ts` と `Toast.vue` に既にあるので、新しい仕組みではない。
  読み書きの失敗（プライベートウィンドウ等で例外）は既存と同じく try/catch で包む
  （`store/view.ts:15-24` が既にその形）。
- F3 により、**サイドバーの右端はつまみが縦一杯に覆っている**。折りたたみボタンを右下に置く herdr の流儀を
  そのまま持ち込むと押せなくなる。置き場所は design で決める。
- F3 により、**タブバーは `role="tablist"`**。＋ を `role="tab"` にすると「タブが 1 つ増えた」と
  支援技術に伝わってしまうので、role の扱いに判断が要る。

## 実装アンカー

- A1: サイドバーの `<nav>` と 2 つの `<section>`、つまみ（`packages/web/src/components/Sidebar.vue:98-140`）
- A2: `.sidebar` / `.sidebar-collapsed` / `.sidebar-divider` のスタイル（`Sidebar.vue:143-159`・`:245-255` 付近）
- A3: agents の computed（`Sidebar.vue` の `agents`。`displayStateFor` を呼んでいる箇所）
- A4: タブバーのテンプレート（`packages/web/src/components/TabBar.vue:42-57`）とスタイル（`:64-90`）
- A5: `MenuTarget` の型（`packages/web/src/term/MouseBridge.ts:6`）
- A6: `ContextMenu.vue` の `items` computed（`:47-76`。最後の `return` が workspace へ落ちている）
- A7: view ストアの永続化（`store/view.ts:8`・`:15-30`）と `sidebarCollapsed`（`:84`・`:180-182`）、
  `openContextMenu` / `closeContextMenu`（`:156-162`）
- A8: `ActionDispatcher` の `newWorkspace`（`:330-343`）・`help`（`:107`）・`goto`（`:110`）・
  `detach`（`:116`）・`newTabInWorkspace`（`:258-260`）
- A9: 既存テスト（`Sidebar.test.ts`・`TabBar.test.ts`・`ContextMenu.test.ts`・`view.test.ts`）

## 実装時の注意

- **`.sidebar-divider` は右端を縦一杯に覆う**（A2）。右端にボタンを置くなら重なりを解く。
- **`.tab-bar` は `overflow-x: auto`**（A4）。＋ をタブ列の中に置くと、タブが多いとき横スクロールの向こうへ
  消える。herdr は「あふれていたらスクロールボタンの直後」に置いているが、この製品にスクロールボタンは無い。
- ボタンに `class="sidebar-row"` / `class="tab-bar-item"` を**付けない**（F3。既存 E2E の件数が狂う）。
- `main.ts` の window の keydown は、端末の外のキーを `KeyInputController` へ流す。
  ボタンの Enter / Space をそこへ二重に渡さないよう、`PaneFrame.vue` と同じく
  `ev.stopPropagation()` が要るかを確かめる。
- `localStorage` は例外を投げうる（プライベートウィンドウ・設定で無効）。`store/view.ts:15-24` と同じく try/catch で包む。

## design への申し送り

- 全体メニューは **`MenuTarget` に `{ kind: "global" }` を足して `ContextMenu.vue` で出す**方向で材料が揃っている。
  採否と、項目の並び・文言を design で決める。
- 並び順の保存先は **`localStorage`**（AC10 の (b) を満たす唯一の選択肢）。キー名と入れ物の形を design で決める。
- 折りたたみボタンの置き場所（つまみとの重なりを避ける）と、`role="tablist"` の中の ＋ の role は design で決める。
- `help` / `goto` / `detach` が `ActionDispatcher` の public か private かは、design で実物を確認して決める
  （`dispatch` 経由にするか、public にするか）。
