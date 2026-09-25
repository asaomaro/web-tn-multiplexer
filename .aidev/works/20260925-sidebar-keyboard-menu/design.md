# 仕様: サイドバーの workspace 行のメニューをキーボードから開く

## 概要

既存の navigate モード（`prefix+w` で開始、矢印キーで workspace 行を選ぶ「仮想カーソル」機能）に
7つ目の操作として「選択中の行のメニューを開く」を追加する。キーは navigate モードの既存6操作
（研究F4）と全く同じカタログ機構で登録し、`NavigateMode.ts` 自体には手を入れない。
`ActionDispatcher`（DOM 非依存。研究F2）は「メニューを開いてほしい」という一度きりの要求を
立てるだけにし、実際に DOM から位置を計算して `ContextMenu.vue` を開くのは `Sidebar.vue`
（行の DOM を実際に描画している場所）が担う。閉じた後のフォーカスの戻し先は、既存の
`ContextMenu.vue` の「開く前にフォーカスしていた要素へ戻す」機構（研究F7）にそのまま乗る——
新しい後始末コードは書かない。

## 設計方針

- **7つ目の navigate キーとして、既存のカタログ機構（`NAVIGATE_KEYS`/`resolveNavigateKeymap`）に
  乗せる**（研究F4）。`Enter`/`Escape`（固定・カスタマイズ対象外）とは違う——このカタログ機構は
  移動専用ではなく汎用（`NavigateKeyDef.action` は任意の `Action` を持てる）ため、`navigate_
  open_menu` という7件目を足すだけで `NavigateMode.handle`（`this.keymap.actionFor(chord)`）が
  自動的に拾う。requirements「未確定事項」（固定かカスタマイズ可能か）への回答: **カスタマイズ
  可能にする**（既存6操作と同じ扱いにする方が実装が単純で、利用者から見ても一貫する。Enter/
  Escape が固定なのは「navigate モード自体の確定/取消」という特別な役割のためで、「メニューを
  開く」はその他の6操作と同じ「navigate モード中の1操作」という扱いで自然）。
- **既定キーは `space` 1つに絞る**（requirements「未確定事項」への回答）。`PaneFrame.vue` は
  Enter/Space/ArrowDown/ContextMenu キー/Shift+F10 の5通りに対応しているが（研究F5）、
  navigate モードでは Enter は既に「確定」に、ArrowDown は「下へ移動」に使われており流用でき
  ない。ContextMenu キー・Shift+F10 は既存のキーマップ機構（`chord.ts`）での表現を未検証のため、
  この work では追加しない（AC のどれも複数キー対応を求めていない。追加は必要になれば別途）。
- **`ActionDispatcher` は DOM を見ない、という既存の設計原則を守る**（研究F2で確認: 現状
  `ActionDispatcher.ts` に `document.`/`querySelector`/`getBoundingClientRect` は1件も無い）。
  `navigate("openMenu")` は `view` に「メニューを開いてほしい」という一度きりの真偽値フラグを
  立てるだけ。実際に DOM 要素を探して位置を計算するのは `Sidebar.vue`（自分が描画した行の DOM を
  実際に持っている場所）の役目にする。
- **DOM 要素の特定は、既存の `data-drop-workspace-id` 属性（D&D 用。`Sidebar.vue:367`）を
  再利用する**（研究「影響範囲」）。新しい `ref` コールバックや `Map` を増やさない——1行の
  `querySelector` で足りる。属性値の埋め込みは `SettingsDialog.vue:451` の既存 precedent
  （`` `[data-override-input="${dk}"]` `` の形のテンプレートリテラル）と同じ書き方にする
  （workspaceId はサーバ生成の内部 id で、利用者が直接入力する値ではない）。
- **メニューを閉じても navigate モードの選択（`navigateSelection`）は保持する**
  （`ActionDispatcher.navigate("cancel")`＝`Escape` を明示的に押したときだけクリアする、という
  既存の挙動を変えない）。メニューが開いている間の `Escape` は、実フォーカスがメニュー自身に
  移っている（研究F7）ため `ContextMenu.vue` 自身の `onKeydown` が処理し、`NavigateMode.handle`
  の `Escape`（`op:"cancel"`）には届かない（研究F8）——**何もコードを書かなくても、メニューの
  Escape と navigate モードの Escape は自然に別物として振る舞う**。
- **フォーカスの戻し先は、既存の `ContextMenu.vue` の `returnFocusTo`/`restoreFocus` を
  そのまま使う**（研究F7）。メニューを開く前に実フォーカスが当たっていた要素（navigate モード中は
  通常は端末の pane）が自動的に記録され、閉じれば自動的にそこへ戻る。新しいフォーカス管理コードは
  書かない。

## 対象範囲

- `packages/web/src/keys/actions.ts`: navigate 系 `Action` 型に `op: "openMenu"` を追加。
- `packages/web/src/keys/navigateKeys.ts`: `NAVIGATE_KEYS` に7件目
  （`navigate_open_menu`。既定 chord `space`）を追加。
- `packages/web/src/store/view.ts`: `navigateMenuRequested: Ref<boolean>` と、それを立てる/
  消す関数を追加。
- `packages/web/src/actions/ActionDispatcher.ts`: `navigate()` の `switch` に
  `case "openMenu":` を追加（`view.navigateSelection` があれば要求を立てるだけ）。
- `packages/web/src/components/Sidebar.vue`: `view.navigateMenuRequested` を見る `watch` を
  追加。該当行の DOM 要素（`data-drop-workspace-id` で特定）から `getBoundingClientRect()` を
  計算し、`actions.openContextMenu({kind:"workspace", workspaceId}, {x, y})` を呼んで要求を
  消す。
- `packages/web/src/components/HelpDialog.vue`: 「移動」群（`navigateEntries`）に
  `navigate_open_menu` の行を追加する（**確認した事実の訂正**: 当初「`HelpDialog.vue` は
  `NAVIGATE_KEYS` を自動列挙する」と見込んでいたが、実際は `navigateEntries`
  〔`HelpDialog.vue:77-89`〕が `navigate_workspace_up` 等を1件ずつ手で列挙する作りで、
  自動追加はされない。`KeySettings.vue`（カスタマイズ画面）は `NAVIGATE_KEYS` 配列を直接
  `.filter()` する作り〔`KeySettings.vue:67`〕で、こちらは無改修で新エントリを自動的に扱える）。
- `packages/web/src/components/ContextMenu.vue`: `onKeydown` に `ev.stopPropagation()` を
  追加する（review round1 must。decisions D4）——`PaneFrame.vue:238-246` の既存パターンと
  同じ。navigate モード中にメニューを開いた状態で矢印キー・`Space` を押すと、メニュー内の
  操作と同時に `main.ts` の window レベルの keydown listener まで同じキーが二重配送され、
  `NavigateMode.handle` が `navigateSelection` を動かす・`openMenu` action を再発火する、
  という実害があった（フォーカス管理・Escape・項目一覧のロジック自体は無改修で流用する）。
- 変更しない: `packages/web/src/keys/NavigateMode.ts`（カタログ機構が既に対応済み。研究F4）・
  `packages/web/src/keys/navigateKeymap.ts`（無改修でカスタマイズ検証を継承）・
  `packages/web/src/components/KeySettings.vue`（`NAVIGATE_KEYS` を直接参照する作りのため
  無改修で新エントリを自動的に扱える）。

## 依拠する既存の事実

research.md の F1〜F9 を参照（`packages/web/src/store/view.ts:224-225,355-357`・
`packages/web/src/actions/ActionDispatcher.ts:810-842`・`packages/web/src/keys/
NavigateMode.ts:1-41`・`packages/web/src/keys/navigateKeys.ts:1-56`・`packages/web/src/
components/PaneFrame.vue:220-246`・`packages/web/src/store/view.ts:359`・`packages/web/src/
components/Sidebar.vue:164-168,367`・`packages/web/src/components/ContextMenu.vue:28-44,
**127-133**（`onKeydown` の `Escape` 処理。研究F8の直接の根拠——実フォーカスがメニュー自身に
あるときは `NavigateMode.handle` の `Escape` には届かないという結論はここから来る）,150-169`・
`packages/web/src/keys/actions.ts:74`）。追加で確認した事実:
- `SettingsDialog.vue:451`（`` dialogEl.value?.querySelector<HTMLInputElement>(`[data-override-input="${dk}"]`) ``）
  がテンプレートリテラルでの属性セレクタ構築の既存 precedent。
- `HelpDialog.vue:77-89`（`navigateEntries`。`navigate_workspace_up` 等を1件ずつ手で列挙する
  作りで、`NAVIGATE_KEYS` を自動列挙しない。当初の見込みの訂正）・`KeySettings.vue:67`
  （`NAVIGATE_KEYS` を直接 `.filter()` する作りで、こちらは新エントリを自動的に扱う）。
  「対象範囲」の `HelpDialog.vue` の扱いはこの2件の事実に基づく。

## インターフェース / データ構造

### `keys/actions.ts`

```ts
| { type: "navigate"; op: "up" | "down" | "paneDir" | "activate" | "cancel" | "openMenu"; dir?: Dir }
```

### `keys/navigateKeys.ts`

`NAVIGATE_KEYS` 配列の末尾に追加:

```ts
{
  id: "navigate_open_menu",
  label: "選択した workspace のメニューを開く",
  defaults: ["space"],
  action: { type: "navigate", op: "openMenu" },
},
```

### `store/view.ts`

```ts
const navigateMenuRequested = ref(false);
function requestNavigateMenu(): void {
  navigateMenuRequested.value = true;
}
function clearNavigateMenuRequest(): void {
  navigateMenuRequested.value = false;
}
// return 節に navigateMenuRequested・requestNavigateMenu・clearNavigateMenuRequest を追加
```

### `actions/ActionDispatcher.ts`（`navigate()` の `switch` に追加）

```ts
case "openMenu":
  if (this.view.navigateSelection) this.view.requestNavigateMenu();
  return;
```

### `components/Sidebar.vue`

```ts
watch(
  () => view.navigateMenuRequested,
  (requested) => {
    if (!requested) return;
    const workspaceId = view.navigateSelection;
    view.clearNavigateMenuRequest();
    if (!workspaceId) return;
    const rowEl = el.value?.querySelector<HTMLElement>(`[data-drop-workspace-id="${workspaceId}"]`);
    const rect = rowEl?.getBoundingClientRect();
    actions?.openContextMenu({ kind: "workspace", workspaceId }, { x: rect?.left ?? 0, y: rect?.top ?? 0 });
  },
);
```

（`el` は `Sidebar.vue` 冒頭の `ref="el"`（`nav` ルート要素）を指す既存の ref。`onRowContextMenu`
と全く同じ `{kind:"workspace", workspaceId}`・`actions.openContextMenu` を呼ぶ——マウス駆動と
キーボード駆動で、最終的に呼ぶ関数は完全に同じ。）

### `components/HelpDialog.vue`（`navigateEntries` に追加。AC 番号なし——後述）

追加先の群の見出しは「移動」（`HelpDialog.vue:103` `{ name: "移動", entries: navigateEntries.value }`）
だが、この群には元々 `Enter`（決定・「移動」ではなく確定）・`Escape`（戻る・取消）という非移動の
操作も同じ配列に列挙されている（77-78・88行目）——「メニューを開く」もこれらと同じ「navigate
モード中に使える操作」という括りで違和感はなく、1件のために新しい群を作る必要は無い。

```ts
const navigateEntries = computed<HelpEntry[]>(() => [
  { keys: "esc", label: "戻る" },
  navigateEntry("navigate_workspace_up"),
  navigateEntry("navigate_workspace_down"),
  navigateEntry("navigate_open_menu"), // 追加
  { keys: `${navigateBindingText("navigate_pane_left")} ・ ←`, label: navigateKeyDef("navigate_pane_left")!.label },
  navigateEntry("navigate_pane_down"),
  navigateEntry("navigate_pane_up"),
  { keys: `${navigateBindingText("navigate_pane_right")} ・ →`, label: navigateKeyDef("navigate_pane_right")!.label },
  { keys: "enter", label: "選んだ workspace を開く" },
]);
```

## 振る舞いの詳細

1. **navigate モードへ入る（既存・無改修）**: `prefix+w` → `view.navigateSelection` が現在の
   workspace id にセットされる。
2. **行を選ぶ（既存・無改修）**: 矢印キー（design しない・既存6操作のまま）で
   `navigateSelection` が動く。`Sidebar.vue` は選択行を `sidebar-row-selected` クラスで
   ハイライトする（既存）。
3. **メニューを開く（新規）**: `Space` を押す → `NavigateMode.handle` が
   `this.keymap.actionFor("space")` で `{type:"navigate", op:"openMenu"}` を返す（新規の
   カタログエントリ。`NavigateMode.ts` 自体は無改修）→ `ActionDispatcher.navigate("openMenu")`
   が `view.navigateSelection`（＝選択中の workspace id）がある前提で
   `view.requestNavigateMenu()` を呼ぶ（`navigateMenuRequested = true`）。
4. **`Sidebar.vue` が要求を解決する（新規）**: `watch` が発火 → `navigateSelection` から
   workspace id を読み、要求を消す（`clearNavigateMenuRequest`）→ `data-drop-workspace-id`
   属性でその行の DOM 要素を探す → `getBoundingClientRect()` の `{left, top}` で
   `actions.openContextMenu({kind:"workspace", workspaceId}, {x, y})` を呼ぶ（`onRowContextMenu`
   と全く同じ target の形。既存の `ContextMenu.vue` がそのまま開く）。
5. **メニューが開く（既存・無改修）**: `ContextMenu.vue` が実フォーカスを自分自身へ移す
   （`returnFocusTo` に「開く前の実フォーカス要素」＝通常は端末の pane を記録。研究F7）。
   `navigateSelection` はそのまま残る（触っていない）。
6. **メニュー内の操作（既存・無改修）**: 矢印キーで項目移動・Enter で確定・Escape で閉じる、
   いずれも `ContextMenu.vue` 自身の `onKeydown`（実フォーカスがメニューにあるため、
   `NavigateMode.handle` には届かない。研究F8）。
7. **メニューを閉じる（既存・無改修）**: 確定・Escape・外側クリック、いずれも
   `view.closeContextMenu()` → `restoreFocus()` が `returnFocusTo`（端末の pane）へ実
   フォーカスを戻す。`navigateSelection` は保持されたまま——利用者は navigate モードの続き
   （別の行へ移動する・`Escape` で navigate モード自体を抜ける）にそのまま戻れる。

## ドメイン固有の考慮

- herdr はキーボードだけで完結する操作性を持つツールで、この work はその一貫性のギャップ
  （`PaneFrame.vue` は既にキーボード対応、`Sidebar.vue` の行は未対応）を埋める。herdr 自身に
  「navigate モードでメニューを開く」という直接の対応機能は無い（herdr の UI モデルが異なる）ため、
  この work は herdr の個別機能の移植ではなく、既存のこのアプリ独自の navigate モードの自然な
  拡張として設計した。

## エラー処理 / 異常系

- `view.navigateSelection` が `null`（通常発生しない。研究F2: navigate モードに入った時点で
  必ず現在の workspace id がセットされる）の状態で `openMenu` が呼ばれた場合:
  `ActionDispatcher.navigate("openMenu")` は要求を立てない（`if (this.view.navigateSelection)`
  で防御）。
- `Sidebar.vue` の `watch` 内の `if (!workspaceId) return;`（型は `Ref<string | null>` なので
  TypeScript 上は常に必要な null チェック）は、上記の防御を通過した後でも発生しうる時間差を
  埋める: `requestNavigateMenu()` は同期的に `navigateMenuRequested` を立てるが、`watch` の
  発火は Vue のリアクティブ更新（マイクロタスク）を挟むため、その間に利用者が続けて `Escape`
  を押す等で `navigateSelection` が `null` に変わっている可能性を排除できない。実際に起きても
  実害は無い（単にメニューを開かず要求を消すだけ）が、型としても実行時としても両方の意味で
  必要なガードとして明記する。
- `Sidebar.vue` の `watch` 内で、該当する `data-drop-workspace-id` の行 DOM が見つからない
  （通常発生しない——`navigateSelection` は常に現在サイドバーに描画されている workspace を
  指す）場合: `rowEl` が `undefined` になり `rect` も `undefined`、`{x:0, y:0}` にフォール
  バックする（`PaneFrame.vue:245` の `rect?.left ?? 0` と同じ防御パターン）。メニュー自体は
  開く（位置がずれるだけで機能は失われない）。
- **`navigateMenuRequested` の一度きりのトリガー保証**（research.md「実現性 / リスク」の
  申し送り事項）: `requestNavigateMenu()`（立てる）と `clearNavigateMenuRequest()`（消す）は
  対称な1個の boolean の set/unset のみで、他のどこからもこの値を読み書きしない
  （「対象範囲」に列挙した5ファイル以外は触れない）。`Sidebar.vue` の `watch` は発火の**先頭**で
  `clearNavigateMenuRequest()` を呼んでから DOM 処理に入るため（「インターフェース /
  データ構造」のコード例参照）、DOM 処理中に例外が起きても要求は既に消えており、二重発火や
  消し忘れは構造的に起きない。

## 受け入れ基準との対応

- AC1: 「振る舞いの詳細」手順3・4。`navigate_open_menu`（`space`）を押すと要求が立ち、
  `Sidebar.vue` の `watch` が実際にメニューを開く。
- AC2: 「振る舞いの詳細」手順4。`actions.openContextMenu({kind:"workspace", workspaceId}, ...)`
  は既存のマウス駆動（`onRowContextMenu`）と全く同じ呼び出しで、`ContextMenu.vue` 側の分岐・
  項目一覧はキーボード/マウスを区別しないため、内容は自動的に同じになる。
- AC3: 「設計方針」——`Enter`/`Escape`/矢印キーの既存の `case`（`NavigateMode.ts`・
  `ActionDispatcher.navigate` の `up`/`down`/`paneDir`/`activate`/`cancel`）は一切変更しない。
  新規追加は `openMenu` という新しい `op` のみ。
- AC-I1: 「振る舞いの詳細」手順3（開く）・6-7（閉じる。既存の `ContextMenu.vue` の Escape・
  外側クリック）。
- AC-I2: 「振る舞いの詳細」手順6-7（既存の `ContextMenu.vue` の確定/取消）。**`stopPropagation()`
  の追加（decisions D4。review round1 must）により、メニューが処理したキーが window まで
  二重配送されて navigate モード側の状態を意図せず変えることが無くなり、確定/取消がメニュー
  単体の閉じた系で完結するようになった**——当初「この work は変更しない」としていたが、
  navigate モードとの組み合わせで初めて表面化した不具合のため、この1行の追加が AC-I2 の
  実質的な充足に必要だった。
- AC-I3: 「振る舞いの詳細」手順1〜7の一連（`prefix+w`→矢印→`space`→メニュー内操作→確定/取消）が
  すべてキー操作のみで表現されている。
- AC-I4: 「設計方針」「振る舞いの詳細」手順5・7（`returnFocusTo`/`restoreFocus` という既存の
  仕組みがそのまま働き、閉じれば端末の pane へ戻る）。AC-I2 と同じ理由で、
  `stopPropagation()`（D4）が無いとメニューを開いている間に navigate モードの矢印キーが
  window まで届き、閉じた後の状態（`navigateSelection`）が意図しない行を指す形で
  `sidebar-row-selected` のハイライトがずれる——D4 の追加でこれも解消する。
- AC-I5: 「設計方針」——`navigate("openMenu")` は `view.navigateSelection` の有無だけを見て
  要求を立てるだけで、navigate モードの外（端末入力・他のキーバインド）には一切触れない。
  `stopPropagation()`（D4）は逆方向（メニュー側が navigate モードへ漏らさない）の対称な
  保証で、両方合わせて「navigate モードとメニューが互いに干渉しない」が成立する。
  既存の `Enter`/`Escape`/矢印キーの `case` も変更しない。
- （AC 番号なし）`HelpDialog.vue` への `navigate_open_menu` 行の追加は、requirements.md の
  どの AC にも直接は紐づかない——利用者がこの新しいキー操作の存在を発見できるための最低限の
  表示で、機能自体（AC1〜AC3・AC-I1〜I5）の正しさには影響しない。既存の worktree-dir-config の
  work で `main.ts` の `printHelp()` 更新漏れが問題になった前例（同 work の cross-task check）を
  踏まえ、この work では設計段階で先に手当てする。
