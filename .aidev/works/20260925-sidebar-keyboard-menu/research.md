# 調査: サイドバーの workspace 行のメニューをキーボードから開く

## 調査の問い

- Q1: navigate モード（既存）の実際の構造は何で、新しい「メニューを開く」操作をどう足すのが
  自然か。
- Q2: `PaneFrame.vue` の既存のキーボード起動パターンは、navigate モードにそのまま複製できるか、
  それとも別の橋渡しが要るか。
- Q3: メニューを閉じた後のフォーカスの戻し先は、既存のどの仕組みに乗せられるか。

## 判明した事実

- **F1（navigate モードの状態）**: `view.navigateSelection: Ref<string | null>`
  （`packages/web/src/store/view.ts:224`。`setNavigateSelection`:355-357）が、選択中の
  workspace id を1つだけ持つ。`Sidebar.vue:361` がこれを見て `sidebar-row-selected` クラスを
  付ける（**実際の DOM フォーカスの移動は伴わない**——CSS ハイライトだけの「仮想カーソル」）。
- **F2（navigate モードの操作の解釈）**: `ActionDispatcher.navigate(op, dir)`
  （`packages/web/src/actions/ActionDispatcher.ts:810-835`）が `up`/`down`/`paneDir`/
  `activate`/`cancel` の5つの `op` を処理する。`activate`（838-842行）は
  `focusWorkspaceById` を呼ぶだけ（DOM を一切見ない。`view.setView`→`focusPane`→RPC）。
  **`ActionDispatcher.ts` はどこにも `document.`/`querySelector`/`getBoundingClientRect` を
  呼んでいない**（`grep` で確認済み・0件）——DOM に触れない設計が徹底されている。
- **F3（キー解釈の層）**: `NavigateMode.handle(k)`（`packages/web/src/keys/NavigateMode.ts:32-41`）
  は `Enter`（34行目相当。`op:"activate"`）・`Escape`（`op:"cancel"`）・bare な
  `ArrowLeft`/`ArrowRight`（pane 左右移動固定）を先に判定し、それ以外は
  `this.keymap.actionFor(chord)`（39行目）で `ResolvedNavigateKeymap` を引く。
  `Enter`/`Escape`/bare 矢印キーは**この work の対象外の固定 case**（コメントに明記。1-22行目）。
- **F4（キーマップの拡張機構）**: `NAVIGATE_KEYS`（`packages/web/src/keys/navigateKeys.ts:24-56`）
  は「id・label・既定 chord・Action」を持つ `NavigateKeyDef` の配列（現状6件、全て移動系）。
  `resolveNavigateKeymap`（`navigateKeymap.ts`）がカタログ＋利用者の上書きから表を作り、
  予約チョード（`NAVIGATE_RESERVED_CHORDS`:esc/enter/tab/shift+tab/left/right/ctrl+shift+v/
  1-9。`navigateKeys.ts` 末尾）を弾く。**このカタログ機構自体は移動専用ではなく汎用**——
  `NavigateKeyDef.action` は任意の `Action` を持てる。`"space"` は予約チョードに含まれない
  （F4 で確認）。
- **F5（PaneFrame.vue のキーボード起動。既存の別の仕組み）**: `onKeydown`
  （`packages/web/src/components/PaneFrame.vue:238-246`）は `Enter`/`Space`/`ArrowDown`/
  `ContextMenu` キー/`Shift+F10` で開く（APG のメニューボタンの慣習）。`edge.value`
  （`ref="edge"`。261行目）という**実際の DOM 要素への roving tabindex**（`role="button"`
  相当。tabindex は選択中の pane だけ `0`）を前提に、その要素へネイティブにフォーカスが
  当たっているときにローカルな `@keydown` が発火する。位置は
  `edge.value?.getBoundingClientRect()` の `{left, top}`（244-245行目）。
  **これは navigate モードの仮想カーソル方式（F1）とは別の仕組み**——実際の DOM フォーカスを
  使う。`ev.stopPropagation()`（243行目）で `main.ts` の window keydown（端末外のキーを
  `KeyInputController` へ流す経路）への二重配送を防いでいる。
- **F6（メニューを開く呼び出しの実体）**: `ActionDispatcher.openContextMenu(target, at)`
  （`ActionDispatcher.ts:82-84`）→ `view.openContextMenu(target, at)`
  （`view.ts:359`）。**呼ぶ側が必ず具体的な `{x, y}` を渡す**——遅延解決の仕組みは無い。
  `Sidebar.vue` の既存のマウス駆動の呼び出し（`onRowContextMenu`:164-168）は
  `{kind:"workspace", workspaceId}` を `{x: ev.clientX, y: ev.clientY}` で開いている
  （**`{kind:"workspace", workspaceId}` という target の形は既に存在し、この work でも
  そのまま使える**）。`onOpenGlobalMenu`（183-187行目）は、マウス座標ではなく押したボタンの
  `getBoundingClientRect()`（`{left, top}`）から開く別の precedent——**マウスイベントに
  依存しない位置計算は既にこのファイル内に前例がある**。
- **F7（メニューのフォーカス管理）**: `ContextMenu.vue` は開いたときに自分自身へ実フォーカスを
  移し（`menuEl.value?.focus()`。166行目）、閉じたときは「開く前に `document.activeElement`
  だったもの」（`returnFocusTo`。32行目・161-164行目で記録）へ自動的にフォーカスを戻す
  （`restoreFocus`:39-44行目）。**この「開く前の要素を覚えて戻す」仕組みは、開いた経路が
  マウスかキーボードかを問わない**——navigate モード中に開いても、開く前に実フォーカスが
  乗っていた要素（通常は端末の pane）が自動的に `returnFocusTo` になり、閉じれば自動的に
  そこへ戻る。**新しい後始末コードは要らない**。
- **F8（Escape の二重定義との非衝突。review round1 must を受けて訂正）**: 当初は「実 DOM
  フォーカスがメニュー自身（F7）にあるため、`Escape`/矢印キー/`Space` は `ContextMenu.vue`
  自身の `onKeydown`（127-148行目）だけが処理し、`main.ts` の window レベルの keydown
  listener（`main.ts:274-278`）や `NavigateMode.handle` には届かない」と見込んでいたが、
  これは誤りだった。**`ContextMenu.vue` の `onKeydown` は `ev.preventDefault()` は呼ぶが
  `ev.stopPropagation()` を一切呼んでいない**（`PaneFrame.vue:238-246` の同種ハンドラは
  明示的に呼んでいる——それとの非対称に review が気づいた）。`main.ts` の window listener は
  `view.openDialog` と `document.activeElement` の `xterm-helper-textarea` 判定しかガード
  しておらず、`view.contextMenu`（メニューが開いているか）は見ていない。したがって
  メニューが開いている間に矢印キー・`Space` を押すと、`ContextMenu.vue` 内の処理と**同時に**
  同じキーが window まで bubble し、`KeyRouter` が `"navigate"` モードのまま
  `NavigateMode.handle` へ渡してしまう——`navigateSelection` が意図せず動く・`openMenu`
  action が再発火してメニューが再度開く、という実害があった（review round1 の詳細）。
  「メニューを閉じても navigate モードの選択は保持される」という挙動自体は正しい設計判断
  だが、その根拠は「フォーカス管理の副作用として自然に成立する」ではなく、**`ContextMenu.vue`
  に `ev.stopPropagation()` を追加して window への二重配送を構造的に遮断する**こと
  （decisions D4）。
- **F9（Action 型の定義箇所）**: `{type:"navigate"; op:"up"|"down"|"paneDir"|"activate"|
  "cancel"; dir?:Dir}`（`packages/web/src/keys/actions.ts:74`）が navigate 系 `Action` の
  唯一の型定義。新しい `op` を足すにはここに1語加える。

## 影響範囲

- `packages/web/src/keys/actions.ts`（`Action` 型に `op` を1つ追加）
- `packages/web/src/keys/navigateKeys.ts`（`NAVIGATE_KEYS` に7件目を追加）
- `packages/web/src/actions/ActionDispatcher.ts`（`navigate()` の `switch` に `case` を追加）
- `packages/web/src/store/view.ts`（DOM 非依存の「保留中のメニュー要求」の状態を1つ追加。
  design で名前・形を確定）
- `packages/web/src/components/Sidebar.vue`（保留中の要求を見て、該当行の DOM 要素から
  `getBoundingClientRect()` を計算し `openContextMenu` を呼ぶ `watch`。行ごとの DOM 参照を
  取る仕組みが要る——`:data-drop-workspace-id="row.workspace?.id"`（`Sidebar.vue:367`。D&D 用に
  既存）を再利用するか、専用の `ref` コールバックを新設するかは design で決める）

## 実現性 / リスク

- **DOM 非依存という `ActionDispatcher` の既存の設計原則（F2）を破らない道がある**:
  `ActionDispatcher.navigate("openMenu")` は DOM を見ずに「保留中」の状態を立てるだけにし、
  実際に DOM から位置を計算して `openContextMenu` を呼ぶのは `Sidebar.vue` 側（他のコンポーネント
  ではなく、行の DOM を実際に持っている場所）にする。これにより `ActionDispatcher` は
  DOM 非依存のまま、`Sidebar.vue` は自分の描画済み DOM を使うだけで済む——新しい橋渡しの
  仕組み（1つの ref か watch）が1つ増えるだけで、大きな設計変更にはならない。
- **フォーカスの行き先（F7・F8）は既存のメカニズムがそのまま使える**——新しい後始末コードは
  ほぼ不要。
- リスクは低いが、「保留中のメニュー要求」の状態のライフサイクル（誰が立て、誰が消すか。
  一度きりのトリガーであることの保証）を design で明確にしないと、二重発火や消し忘れが起きうる。

## 実装アンカー

- A1: `packages/web/src/keys/actions.ts:74`（`Action` 型の navigate 系ユニオンに `op` を追加）
- A2: `packages/web/src/keys/navigateKeys.ts:24-56`（`NAVIGATE_KEYS` 配列に7件目を追加。
  `navigateKeymap.ts`・`NAVIGATE_RESERVED_CHORDS` は無改修で新エントリを自動的に扱える）
- A3: `packages/web/src/actions/ActionDispatcher.ts:810-835`（`navigate()` の `switch` に
  `case "openMenu":` を追加）
- A4: `packages/web/src/store/view.ts:224-225`
  付近（`navigateSelection` の隣に新しい状態を追加。`openContextMenu`:359 は無改修で流用）
- A5: `packages/web/src/components/Sidebar.vue:164-168`（`onRowContextMenu` の隣に、保留中の
  要求を見る `watch` を追加。DOM 参照の取り方は未特定——design で確定）

## design への申し送り

- **7件目の navigate キー（`navigate_open_menu` 等）は、既存6件と同じくカタログ経由で
  カスタマイズ可能にするのが最小コストで済む**（F4。`NavigateMode.ts` 自体には手を入れずに済む）。
  requirements「未確定事項」の「固定か・カスタマイズ可能か」はこの事実を踏まえて design で決める。
- 既定の chord は `space`（`Shift+F10`・`ContextMenu` キーは修飾・特殊キーで chord 表現が
  この既存キーマップ機構と相性を確認していない——design で1つに絞るか複数対応するか決める）。
- `Sidebar.vue` が行の DOM 要素を取る方法（既存の `data-drop-workspace-id` 属性を再利用する
  クエリ方式か、専用の `ref` コールバックで `Map` を作る方式か）は design で確定する。
