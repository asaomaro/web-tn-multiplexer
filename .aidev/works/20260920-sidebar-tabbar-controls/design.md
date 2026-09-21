# 仕様: サイドバーとタブバーに、マウスで使える操作を足す

## 概要

4 つの操作（折りたたみ・新規 workspace・全体メニュー・新規タブ・agents のソート）を、
**既存の入口（`ActionDispatcher.run`）と既存の部品（`ContextMenu.vue`）に載せる**形で足す。
新しく作るのは「ボタン」と「並び順の状態」だけで、動作そのものは 1 つも書き直さない。

## 設計方針

1. **ボタンは `ActionDispatcher.run(action)` を呼ぶだけ**にする。`run` はキー操作の入口でもあるので
   （`ActionDispatcher.ts:57`）、**ボタンとキーが同じ 1 本の経路**を通る。別経路にすると
   「キーでは動くがボタンでは動かない」が生まれる。
2. **全体メニューは `MenuTarget` に種類を 1 つ足して既存の `ContextMenu.vue` に出させる**。
   キーボード操作（↑↓/Enter/Esc）・フォーカスの戻り・外側クリックでの close は
   その部品が既に持っている（research F1）。専用の部品を作ると同じ処理を二重に持つことになる。
   型が union なので、種類を足すと `items` の最後の `return` がコンパイルエラーになり、
   **分岐の追加をコンパイラが強制する**。
3. **並び順は `localStorage` に保存する**。AC10 の (b)（タブを閉じて開き直しても残る）は
   既存の `sessionStorage`（`store/view.ts:8`）では満たせない。
   **`localStorage` を使う前例は既にある**——`store/seen.ts`（`wtm.seen.v1`）と
   `components/Toast.vue:18,25`（`wtm.hint.prefixHelp.v1`）が「ブラウザをまたいで残すもの」に使っている。
   読み書きは既存と同じく try/catch で包む。
4. **`.sidebar` のスクロールの持ち方を変えない**。`.sidebar` が `overflow-y: auto` の
   スクロール主体であることは、先行 work（`20260920-ui-selection-visuals`）の AC3 の E2E が
   `.sidebar` の `scrollWidth <= clientWidth` で判定している前提そのもの。
   **内側にスクロール用の入れ物を作ると、その判定が素通りする**（空振りになる）ので、
   フッタは `margin-top: auto` で下に寄せるだけにする。
5. **タブバーの `role="tablist"` の中に ＋ を置かない**。tablist が所有してよいのは `tab` だけなので、
   `.tab-bar` を外側の入れ物にし、**中に `role="tablist"` を持つ入れ子を作って**その隣に ＋ を置く。
   `.tab-bar` のクラス名と `@wheel` はそのまま残す（`TabBar.test.ts:131` が掴んでいる）。

## 対象範囲

| ファイル | 変更 |
|---|---|
| `packages/web/src/term/MouseBridge.ts` | `MenuTarget` に `{ kind: "global" }` を足す（A5） |
| `packages/web/src/components/ContextMenu.vue` | `global` の分岐（項目 3 つ）を足す（A6） |
| `packages/web/src/store/view.ts` | `agentSort` の状態と `localStorage` への保存・復元（A7） |
| `packages/web/src/components/Sidebar.vue` | spaces のフッタ（新規・メニュー）／agents の見出しとソート／`<nav>` のフッタ（折りたたみ）／並べ替え（A1・A2・A3） |
| `packages/web/src/components/TabBar.vue` | `role="tablist"` を入れ子へ移し、＋ を足す（A4） |
| 各 `*.test.ts` | 上記の単体テスト |
| `packages/e2e/src/specs/` | 押して動くこと・並び順・再読み込み・大きさの E2E |
| `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts` | **Tab の到達順の期待を直す**（＋ が 1 つ挟まる。下記） |

## 依拠する既存の事実

- `ActionDispatcher.run(action)` が公開の入口（`ActionDispatcher.ts:57`）。
  `help` / `goto` / `detach` / `toggleSidebar` / `newWorkspace` はこの `switch` の中だけにあり、
  個別の公開メソッドは無い（`:107`・`:110`・`:113`・`:116`・`:89`）。
  `newTabInWorkspace(workspaceId)` だけは公開メソッド（`:258-260`。`ContextMenu.vue` が既に呼んでいる）。
- `MenuTarget` は 3 種類の union（`MouseBridge.ts:6`）。`ContextMenu.vue` の `items` は
  pane → tab → **最後は workspace として `return`**（`ContextMenu.vue:72-76`）。
- メニューのキーボード・フォーカスの戻りは `ContextMenu.vue:36-45`（`restoreFocus`）・
  `:80-100`（`activate` / `onKeydown`）にある。
- `store/view.ts:8` の `STORAGE_KEY = "wtm.view.v1"` は `sessionStorage`（`:17`・`:29`）。
  `localStorage` は `store/seen.ts`（`wtm.seen.v1`）と `components/Toast.vue:18,25`（`wtm.hint.prefixHelp.v1`）で
  既に使われている（research F2。当初「0 件」と書いたのは誤りで、design の点検で判明）。
- `.sidebar` は `display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden`（`Sidebar.vue` の `.sidebar`）。
  `.sidebar-collapsed` は `width: 3em !important`。
  **`.sidebar-divider` は `position:absolute; top:0; right:0; width:6px; height:100%`**
  ——サイドバーの右端 6px を縦一杯に覆う（research F3）。
- `.tab-bar` は `display:flex; overflow-x:auto` で `role="tablist"`（`TabBar.vue:42`）。
  `@wheel="onWheel"` が付いている（`TabBar.test.ts:131` が掴む）。`.tab-bar-item` は `padding: 0.5em 1em`。
- `STATE_PRIORITY`（`store/seen.ts:48-54`）と `AgentInfo.since`（`protocol/src/model.ts:82`）が
  並べ替えの 2 つのキー。`Sidebar.vue` の `agents` computed は既に `displayStateFor` の結果を持っている。
- `workspace-tab-pane.spec.ts` は `.sidebar-spaces .sidebar-row` と `.tab-bar-item` の**件数**を数える。

## インターフェース / データ構造

### `MenuTarget` に種類を 1 つ足す（`MouseBridge.ts`）

```ts
export type MenuTarget =
  | { kind: "pane"; paneId: string }
  | { kind: "tab"; tabId: string }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "global" };   // サイドバーの「メニュー」ボタンから開く、全体に効く操作
```

### 全体メニューの項目（`ContextMenu.vue`）

| 表示 | 実行するもの |
|---|---|
| キー割り当て | `actions.run({ type: "help" })` |
| 移動 | `actions.run({ type: "goto" })` |
| 切り離し | `actions.run({ type: "detach" })` |

**herdr の `settings` / `reload config` / `what's new` は入れない**（requirements の対象外。
この製品に設定画面も更新機構も無い）。並びは「よく使う順」ではなく herdr の並び（設定系 → detach）に倣い、
**切り離しを最後**に置く（誤って押すと接続が切れるため）。

### 並び順（`store/view.ts`）

```ts
export type AgentSort = "grouped" | "priority";
const PREFS_KEY = "wtm.prefs.v1";   // localStorage。表示位置（sessionStorage）とは別の入れ物
```

- 状態は `agentSort = ref<AgentSort>(loadAgentSort() ?? "grouped")`。
- 切り替えは `toggleAgentSort()`（2 値の反転）。反転のたびに `localStorage` へ書く。
- 読み書きは既存の `loadStoredView` / `saveStoredView`（`store/view.ts:15-30`）と**同じ形**で try/catch に包む
  （プライベートウィンドウ等で例外が出るため）。値が壊れていたら `"grouped"` に落とす。

### 新しい CSS クラス

| クラス | 場所 | 役割 |
|---|---|---|
| `sidebar-section-footer` | spaces 区画の末尾 | 新規・メニューのボタンの帯 |
| `sidebar-section-header` | agents 区画の先頭 | 見出しとソートのボタンの帯 |
| `sidebar-footer` | `<nav>` の末尾 | 折りたたみボタンの帯 |
| `sidebar-btn` | 上記のボタン共通 | 文字だけのボタンの見た目 |
| `sidebar-sort-btn` | ソートのボタン | 右端に寄せる |
| `tab-bar-tabs` | `.tab-bar` の中 | `role="tablist"` を持つ横スクロールの入れ物 |
| `tab-bar-new` | `.tab-bar` の末尾 | ＋ ボタン |

**`sidebar-row` と `tab-bar-item` は使わない**（既存 E2E が件数を数えているため。research F3）。

## 振る舞いの詳細

### サイドバーの構造

```
<nav class="sidebar">
  <section class="sidebar-spaces" aria-label="spaces">
    …行…
    <div class="sidebar-section-footer" v-if="!collapsed">   ← 新規 / メニュー
  </section>
  <section class="sidebar-agents" aria-label="agents">
    <div class="sidebar-section-header" v-if="!collapsed">   ← 「agents」＋ ソート
    …行…
  </section>
  <div class="sidebar-footer">                                ← 折りたたみ（畳んでも出す）
  <div class="sidebar-divider" />                             ← 既存（右端を縦一杯に覆う）
</nav>
```

- **折りたたみ時に出すのは `sidebar-footer` だけ**。他の 2 つは `v-if` で消す（AC11）。
  折りたたみボタンを消してしまうと展開に戻れなくなる（AC1 の「折りたたんだ状態でも押せる」）。
- `.sidebar-footer { margin-top: auto; }` で、内容が短いときは下端に寄る。
  **`.sidebar` の `overflow-y: auto` は動かさない**（設計方針 4）。内容が長いときはフッタも一緒にスクロールする
  ——固定したければ内側にスクロールの入れ物を作る必要があるが、それは先行 work の AC3 の判定を
  空振りにするので**採らない**。
- **`.sidebar-divider` が右端 6px を覆う**ので、3 つの帯すべてに `padding-right: 6px` を入れ、
  ボタンがつまみの下に潜らないようにする（research F3）。

### ボタンの共通の作り

- すべて `<button type="button">`（Tab で到達でき、Enter / Space で押せる。AC-I3）。
- **`@keydown.stop`** を付ける。`main.ts` の window の keydown が端末の外のキーを
  `KeyInputController` へ流すので、付けないとボタンの Enter / Space が二重に解釈されうる
  （`PaneFrame.vue` の `onKeydown` が `ev.stopPropagation()` しているのと同じ理由）。
- `aria-label` を付ける（折りたたみは記号だけ、ソートは順序名だけなので、文字から意図が読めない）。

### それぞれのボタン

| ボタン | 表示 | 押したとき | 補足 |
|---|---|---|---|
| 折りたたみ | 展開時 `«` / 折りたたみ時 `»` | `actions.run({ type: "toggleSidebar" })` | `aria-expanded` は「サイドバーが開いているか」＝`!collapsed`（AC2） |
| 新規 | `＋ 新規` | `actions.run({ type: "newWorkspace" })` | 名前は尋ねない（`prefix+shift+n` と同じ。AC3） |
| メニュー | `メニュー` | ボタンの `getBoundingClientRect()` を座標にして `actions.openContextMenu({ kind: "global" }, at)` | AC4・AC5 |
| ＋（タブ） | `＋` | **script 側で null を外してから** `actions.newTabInWorkspace(id)` | AC6。下記 |
| ソート | `grouped` / `priority` | `view.toggleAgentSort()` | 文字そのものがボタン（herdr の流儀）。AC7 |

- **＋ はタブが 0 個でも押せる**（AC6）。`view.workspaceId` があれば押せて、無いときだけ無効。
  タブの有無は条件にしない——タブが無い workspace こそ ＋ が要る。
- **null の外し方はテンプレートではなく script で行う**。`view.workspaceId` は `string | null`
  （`store/view.ts:59`）で `newTabInWorkspace(workspaceId: string)` は `string` を要る
  （`ActionDispatcher.ts:258`）。`:disabled` を付けてもテンプレート式の型は狭まらず、
  `vue-tsc` が落ちる。既存の `ActionDispatcher.newTab()`（`:253-256`）と同じく関数の中でガードする:

  ```ts
  function onNewTab(): void {
    const id = view.workspaceId;
    if (id) actions?.newTabInWorkspace(id);
  }
  ```

### agents の並び

**`Sidebar.vue:5` の import を直す必要がある**——今は `type STATE_PRIORITY`（型だけ）で入れているので、
実行時の値として使うとコンパイルエラーになる。`type` を外して値として import する。

```ts
const agents = computed(() => {
  const rows = [...session.panes.values()].filter((p) => p.agent).map(/* 既存のまま */);
  if (view.agentSort === "grouped") return rows;          // 既存の順（session.panes の挿入順）
  return [...rows].sort((a, b) =>
    (STATE_PRIORITY[b.state ?? "unknown"] - STATE_PRIORITY[a.state ?? "unknown"]) ||
    (b.agent.since - a.agent.since));   // 行は既に非 null の `agent` を持つ（`!` を足さない）
});
```

- **`grouped` は並べ替えない**（AC9。herdr も同じで、サーバが返す workspace 順 → tab 順 → pane 順をそのまま使う）。
- `priority` は「優先度の降順 → `since` の新しい順」（AC8）。
  `Array.prototype.sort` は**安定**（ES2019 以降）なので、両方同点なら `grouped` の順が残る。
- **`rows` を直接 `sort` しない**（`[...rows]` を作る）。`rows` はこの computed の中で
  `.filter().map()` が毎回作るローカルな配列なので**壊しても他へは漏れない**が、
  「組み立てた配列」と「並べ替えた配列」を別物として扱うほうが、後から分岐を足したときに事故が無い。

### タブバーの構造

```
<div class="tab-bar" @wheel="onWheel">        ← クラス名と @wheel は据え置き（既存テストが掴む）
  <div class="tab-bar-tabs" role="tablist">   ← 横スクロールはここへ移す
    <button class="tab-bar-item" role="tab" …>
  </div>
  <button class="tab-bar-new" …>＋</button>   ← tablist の外（tablist が持てるのは tab だけ）
</div>
```

- `.tab-bar` から `overflow-x: auto` を外し、`.tab-bar-tabs` へ移す。`.tab-bar` は
  `display:flex` と背景・下線を持ったまま。
- **＋ の高さをタブと同じにする**。`padding` の縦を `0.5em` で揃えるだけでは足りず、
  **`font: inherit` も要る**（`.tab-bar-item:71-77` が明示していて、この PJ に
  `button` へのグローバルなフォント指定は無い）。既定のボタンフォントのままだと行の高さが変わり、
  帯が高くなって PTY の行が減る（AC14）。

### Tab の到達順が変わる（既存 E2E を直す）

**＋ は Tab で止まる要素なので、タブバーから Tab で進む順に 1 つ挟まる**。
これに依存している既存 E2E が 2 件あり、**この work で直す**（AC13 の「直した理由が AC に紐づく」に当たる。
理由は AC6・AC-I3——＋ をキーボードから使えるようにした結果）:

- `keys-mouse-dialogs.spec.ts:230-233`: `.tab-bar-item` にフォーカスして Tab を 1 回 → 枠にフォーカス、を期待。
  **＋ を挟むので Tab が 2 回要る**。
- `keys-mouse-dialogs.spec.ts:293-299`: `["splitter", "frame@pane2"]` の順を期待。
  **先頭に ＋ が入る**。`describeFocus`（`:246-260`）に ＋ を表す分岐を足して、期待を更新する。

**＋ を Tab の対象から外す（`tabindex="-1"`）ことはしない**——AC-I3 が
「足した 5 つのボタンが Tab で到達できる」ことを求めている。

## エラー処理 / 異常系

- `localStorage` が使えない（プライベートウィンドウ・設定で無効）→ 読み書きとも try/catch で握りつぶし、
  既定の `"grouped"` で動く。**切り替えは効くが次回に残らない**、という縮退。
- 保存された値が `"grouped"` / `"priority"` のどちらでもない → `"grouped"` に落とす。
- `view.workspaceId` が null（どの workspace も表示していない）→ タブの ＋ は `disabled`。
- agents が 0 件 → 見出しとソートのボタンは出す（切り替え自体はできてよい）。
- 折りたたみ中 → フッタ以外の帯は描かない。`sidebar-footer` が `padding-right: 6px` 込みで `3em`
  （既定のフォントで 48px）に収まることは**断定せず、E2E で確かめる**（AC11。折りたたんだ状態で
  `.sidebar` の `scrollWidth <= clientWidth`）。収まらなければボタンの `padding` を詰める。

## ドメイン固有の考慮

- **モバイルには届かない**。`MobileShell.vue` は `Sidebar.vue` も `TabBar.vue` も import していない。
- **PTY の大きさ**: サイドバーは幅、タブバーは高さで pane の大きさを決める。
  サイドバーのフッタは**縦**に増えるだけなので PTY に影響しない（幅は変えない）。
  タブバーの ＋ は**高さを変えないこと**が条件（AC14）。

## 受け入れ基準との対応

- AC1: `sidebar-footer` の中のボタンが `actions.run({ type: "toggleSidebar" })` を呼ぶ。
  入力の出所は `store/view.ts` の `sidebarCollapsed`。この帯は折りたたみ時も `v-if` で消さないので、
  畳んだ状態でも押して戻せる。判定は単体テスト（クリックで反転・折りたたみ時も存在）。
- AC2: そのボタンに `:aria-expanded="!view.sidebarCollapsed"` を付ける。判定は単体テスト。
- AC3: `sidebar-section-footer` の「新規」が `actions.run({ type: "newWorkspace" })` を呼ぶ。
  入力の出所は無し（現在の workspace に依らず新規作成）。判定は単体テスト（`run` の呼び出し）＋ E2E
  （押すと `.sidebar-spaces .sidebar-row` が 1 つ増える）。
- AC4: 「メニュー」が `openContextMenu({ kind: "global" }, ボタンの矩形)` を呼び、
  `ContextMenu.vue` の `global` 分岐が 3 項目を返す。判定は単体テスト（項目の文言と `run` の引数）。
- AC5: 既存の `ContextMenu.vue` をそのまま使うので、↑↓・Enter・Esc・フォーカスの戻りは既存の実装が担う。
  判定は E2E（キーボードだけでメニューを開いて閉じ、元のボタンへ戻ることを確かめる）。
- AC6: `tab-bar-new` が `actions.newTabInWorkspace(view.workspaceId)` を呼ぶ。
  入力の出所は `store/view.ts` の `workspaceId`。判定は単体テスト（タブ 0 件でも押せる）＋ E2E。
- AC7: `sidebar-section-header` の中のボタンの表示が `view.agentSort` の値そのもの。
  押すと `toggleAgentSort()`。判定は単体テスト。
- AC8: 上の `agents` computed の比較関数。入力の出所は `STATE_PRIORITY`（`store/seen.ts`）と
  `AgentInfo.since`（サーバが送る）。判定は単体テスト（優先度違い・同点で `since` 違いの 2 ケース）。
- AC9: `grouped` のときは `rows` をそのまま返す。判定は単体テスト（並びが `session.panes` の順のまま）。
- AC10: `localStorage` の `wtm.prefs.v1`。判定は (a) E2E（`page.reload()` の後も `priority` のまま）、
  (b) 単体テスト（保存した内容を新しいストアが読む。`store/view.test.ts` の流儀）。
- AC11: 折りたたみ時に `sidebar-section-footer` と `sidebar-section-header` を `v-if` で消し、
  `sidebar-footer` だけを残す。判定は E2E（折りたたんだ状態で `.sidebar` の `scrollWidth <= clientWidth`）。
- AC12: キーの経路（`keymap.ts` → `KeyRouter` → `ActionDispatcher.run`）に一切触れない。
  ボタンは同じ `run` を呼ぶ。判定は既存 E2E（`prefix+b` の折りたたみ・`prefix+shift+n` の作成）の通過。
- AC13: 既存のクラス名を消さず、ボタンには別のクラスを付ける。判定は既存テスト・E2E の通過。
- AC14: ＋ の縦 `padding` と `font: inherit` をタブと揃える。判定は E2E で、
  **同じ実行の中で ＋ を `display:none` にして帯の高さを測り、表示時と一致すること**。
  固定値は使わない（フォント未指定のため環境依存）。
  **「帯の高さ === タブの高さ ＋ 下線」では確かめられない**——タブも ＋ も同じ行の高さへ
  引き伸ばされるため、＋ が何 px でも成り立つ（実測で判明。tasks.md のテスト方針）。
- AC-I1: メニューは「メニュー」ボタンで開き、Esc・外側クリック・項目の実行で閉じる
  （`ContextMenu.vue` の既存の挙動）。`activeIndex` は開くたびに 0 に戻る（`ContextMenu.vue:124`）。
  判定は E2E。
- AC-I2: Enter / クリックで確定、Esc で取り消し（既存の `activate` / `onKeydown`）。
  取り消したとき `run` は呼ばれない。判定は単体テスト（`ContextMenu.test.ts` の流儀）。
- AC-I3: 5 つとも `<button type="button">`。メニューは開いた後 `ContextMenu.vue` が引き取る。
  判定は E2E（Tab で到達して Enter で押す）。
- AC-I4: `ContextMenu.vue` の `restoreFocus` が開く前の要素へ戻す（`:36-45`）。
  折りたたみボタンは畳んでも消えないので、押した後もフォーカスが残る。判定は E2E。
- AC-I5: ボタンに `@keydown.stop` を付けて端末側へ漏らさない。つまみ・行・右クリックメニューには触れない。
  判定は既存 E2E の通過。

## backlog へ送るもの（deliver で起票）

1. **サイドバーの帯が内容と一緒にスクロールする**。`.sidebar` をスクロール主体のままにしたので
   （設計方針 4）、行が多いと帯が見えなくなる。**`.sidebar-footer`（折りたたみ）だけは
   `margin-top: auto` で常に下端にあるが、`.sidebar-section-footer`（新規・メニュー）は
   spaces の行の直後なので、workspace が多いと画面外へ流れる**——その状態では
   「一度折りたたむ」以外に新規・メニューへ辿り着けないことがある（横断の点検が指摘）。
   下端に貼り付けるには内側にスクロールの入れ物が要るが、それは先行 work の AC3 の判定
   （`.sidebar` の `scrollWidth`）を空振りにするので、**判定の作り直しと同時にやる**必要がある。
2. **新しいタブの名前の初期値**。herdr は「そのワークスペースの現タブ数 + 1」を入れて全選択で開く。
   この製品の初期値がどうなっているかは未確認で、この work では触らない。
