# 仕様: D&D による pane の別 tab・別 workspace への移動

## 概要

`PaneFrame.vue` の名前ラベルドラッグの対象を、tab バーの tab・サイドバーの workspace 行にも
広げる。tab バーの既存 tab へドロップすると、その pane が対象 tab の focus 中の pane の右へ
分割で入る。サイドバーの workspace 行へドロップすると、その workspace に新しい tab が作られ、
そこへ pane が移る。いずれも移動元の tab の元の位置は自動的に畳まれ、移動元の tab に他の pane が
無ければ tab 自体も自動的に閉じる（pane は消さない）。

## 設計方針

- **この操作はプロセスを一切終了させない**（research.md F5・R4）。`20260924-pane-dnd-split-move`
  の `replacePane` と違い、busy pane の確認ダイアログは不要（対象を移すだけで何も失われない）。
- **`closeTabInternal`（既存。pane を削除する）を移動元の後始末に流用しない**（research.md
  R1・最重要の落とし穴）。新しい変種（pane を保持したまま tab の器だけを消す）を用意する。
- **tab バーへのドロップは単一の既定挙動**（縁/中央のようなゾーン細分はしない。research.md R3・
  requirements.md の未確定事項）: 対象 tab の focus 中の pane を `direction: "right"` で分割し、
  そこへ pane を入れる。`20260924-pane-dnd-split-move` の `moveToEdge` と同じ
  `LayoutTree.insertAtEdge` を使い、対象は「その tab の `focusedPaneId`」に固定する。
- **サイドバーの workspace 行へのドロップは常に新しい tab を作る**（`reserveTab`/`commitTab` の
  「既存 pane 版」）。どの tab に入れるかの曖昧さが無い、最も単純な挙動。
- **移動元の tab が空になったら常に自動的に閉じる**（requirements.md の未確定事項への回答。
  `closePane`/`moveToEdge`/`replacePane` が「最後の1枚を消すと tab が閉じる」という既存の
  一貫した規則をそのまま踏襲する——空の tab を残す特別扱いはしない）。
- **クライアント側は新しい pointer イベントハンドラを増やさない**（research.md F8）。
  `PaneFrame.vue` の既存のドラッグ元ロジック（`onNamePointerMove`/`onNamePointerUp`）が
  `document.elementFromPoint` でドロップ先を探す対象に `[data-tab-id]`・
  `[data-drop-workspace-id]` を追加するだけで足りる。`TabBar.vue`/`Sidebar.vue` 自身は
  `data-*` 属性を持つだけでよい。

## 対象範囲

- `packages/protocol/src/messages.ts`: 新規 RPC `pane.move_to_tab`（既存 tab へ）・
  `pane.move_to_new_tab`（新規 tab として workspace へ）を追加。
- `packages/server/src/session/SessionModel.ts`: `moveToTab`・`moveToNewTab`・
  `closeEmptyTabShell`（新規。`closeTabInternal` の変種）を追加。既存の `closeTabInternal`・
  `closePane`・`moveToEdge`・`replacePane` は変更しない。
- `packages/server/src/session/SessionService.ts`: 上記のイベント配布ハンドラを追加。
- `packages/server/src/surface/methods/pane.ts`: 上記2つの RPC を登録。
- `packages/web/src/components/TabBar.vue`: 各 tab に `data-tab-id` を追加。
- `packages/web/src/components/Sidebar.vue`: 各行に、`row.workspace` が非 null のときだけ
  `data-drop-workspace-id`（新規。既存の `data-workspace-row-key` とは別の属性——research.md
  R2）を追加。
- `packages/web/src/components/PaneFrame.vue`: ドロップ先探索に `[data-tab-id]`・
  `[data-drop-workspace-id]` を追加し、ドロップ確定時に新しい RPC を呼ぶ。
- `packages/web/src/actions/ActionDispatcher.ts`: `movePaneToTab`・`movePaneToNewTab` を追加。

## 依拠する既存の事実

- `createTab`（既存 pane を運ばない。新規 pane を必ず作る）: `SessionModel.ts:274-278`
  （research.md F1）。
- `closeTabInternal`（tab の全ての葉を `this.panes` から削除する。移動の後始末に流用すると
  移動中の pane まで消える）: `SessionModel.ts:511-516`（research.md F2。このセッションで実物を
  再確認済み）。
- `Pane.tabId` は単純なフィールドで、スプレッドして再セットするだけで書き換えられる:
  `packages/protocol/src/model.ts:70`（research.md F3）。
- `reserveTab`/`commitTab` の label 既定値ロジック（`label ?? String(ws.tabIds.length + 1)`）・
  `commitTab` が新しい tab を `activeTabId` にする挙動: `SessionModel.ts:240-269`
  （このセッションで実物を再確認済み）。
- `splitPane`/`closePane`/`moveToEdge`/`replacePane` はいずれも操作対象の tab の
  `zoomedPaneId` を無条件に `null` にする（D100 パターン）: `SessionModel.ts`
  （research.md F5）。
- `TabBar.vue` に `data-tab-id` 等の DOM 属性・ドラッグ機構は無い（`grep` で確認済み）:
  `packages/web/src/components/TabBar.vue:140-156`（research.md F9）。
- `Sidebar.vue` の `data-workspace-row-key` は workspace 並べ替え用で、必ずしも1つの
  workspace を指さない（手動グループのヘッダー行は `workspace: null`）: `Sidebar.vue`
  （research.md F10。このセッションで実物を再確認していない——coding 時に `workspaceRow()` の
  実装箇所を確認すること。**未確認**）。

## インターフェース / データ構造

### protocol（`packages/protocol/src/messages.ts`）

```ts
// 「tab バーへドロップ」: paneId を既存の targetTabId へ移す。
export const PaneMoveToTabParams = z.object({ paneId, targetTabId: tabId });
export interface PaneMoveToTabResult {
  /** 自分自身の tab・存在しない tab 等、何も起きなかったときは false。design「エラー処理」。 */
  ok: boolean;
}

// 「サイドバーの workspace 行へドロップ」: paneId を targetWorkspaceId の新しい tab へ移す。
export const PaneMoveToNewTabParams = z.object({ paneId, targetWorkspaceId: workspaceId });
export interface PaneMoveToNewTabResult {
  ok: boolean;
  /** 作られた新しい tab（ok=false のときは無い）。 */
  tab?: Tab;
}
```

`SessionModel.moveToNewTab` 自体の戻り値は `{ tab: Tab } | null`（下の「サーバ側:
`SessionModel`」節）——`SessionService`/RPC ハンドラ（`surface/methods/pane.ts`）が
`result === null ? { ok: false } : { ok: true, tab: result.tab }` に変換して
`PaneMoveToNewTabResult` を組み立てる（`pane.move_to_edge`/`pane.replace` が
`SessionModel` の `boolean` 戻り値をそのまま `{ok}` にラップしているのと同じ、
「モデル層は最小限の型・RPC 層で protocol の型に合わせる」という既存の層分け）。

`METHOD_SCHEMAS`/`MethodResultMap` に `"pane.move_to_tab"`・`"pane.move_to_new_tab"` として
登録する（既存の `pane.*` と同じ並び）。

### サーバ側: `SessionModel`

```ts
/** tab の器だけを消す（pane は削除しない）。`closeTabInternal` の変種——移動系の後始末専用
 *  （research.md R1）。呼び出し側が、この tab の全ての pane を既に別の場所へ移し終えている
 *  ことが前提（この関数自身は空かどうかを検査しない）。 */
private closeEmptyTabShell(tabId: TabId): { removedTabId: TabId; closedWorkspaceId: WorkspaceId | null } {
  const tab = this.requireTab(tabId);
  const ws = this.requireWorkspace(tab.workspaceId);
  this.tabs.delete(tabId);
  const remainingTabIds = ws.tabIds.filter((t) => t !== tabId);
  if (remainingTabIds.length === 0) {
    // 最後の tab だった → workspace も閉じる（closeTabInternal と同じ規則。pane は無いので
    // closeWorkspaceInternal 側もpane削除は空振りになるだけで安全）。
    this.closeWorkspaceInternal(ws.id, { skipTabCleanup: true });
    return { removedTabId: tabId, closedWorkspaceId: ws.id };
  }
  const activeTabId = ws.activeTabId === tabId ? remainingTabIds[0]! : ws.activeTabId;
  this.workspaces.set(ws.id, { ...ws, tabIds: remainingTabIds, activeTabId });
  if (activeTabId !== ws.activeTabId) this.setFocus(ws.id, activeTabId, this.requireTab(activeTabId).focusedPaneId);
  return { removedTabId: tabId, closedWorkspaceId: null };
}

moveToTab(paneId: PaneId, targetTabId: TabId): boolean { ... }
moveToNewTab(paneId: PaneId, targetWorkspaceId: WorkspaceId): { tab: Tab } | null { ... }
```

## 振る舞いの詳細

### `moveToTab(paneId, targetTabId)`

1. `pane = requirePane(paneId)`（`paneId` はドラッグ元クライアントの検証済み状態が渡す値なので、
   `moveToEdge`/`replacePane` と同じく throw する `requirePane` を使ってよい）。
   `pane.tabId === targetTabId` なら何もせず `false`（AC9。自分自身の tab へのドロップ）。
2. `targetTab = this.tabs.get(targetTabId)`。**`requireTab` ではなく `.get()`**（`targetTabId`
   はドロップ先の他クライアント由来・ドラッグ中に消えている可能性がある値——`moveToEdge`の
   `targetPaneId` と同じ「未検証の相手」の扱い。design「エラー処理」節と整合させる）。
   `!targetTab` なら何もせず `false`（AC9）。`sourceTab = this.requireTab(pane.tabId)`
   （`pane.tabId` は直前に取得した信頼できる値なので throw する形のままでよい）。
3. `withoutPane = Layout.remove(sourceTab.layout, paneId)`。
4. `newSplitId = nextId("s")`。
   `newLayout = Layout.insertAtEdge(targetTab.layout, targetTab.focusedPaneId, "right", paneId, newSplitId)`
   （design 方針「tab バーへのドロップは単一の既定挙動」）。
5. `this.panes.set(paneId, { ...pane, tabId: targetTabId })`（`pane.tabId` の書き換え。
   research.md F3・実装時の注意）。
6. `this.tabs.set(targetTabId, { ...targetTab, layout: newLayout, focusedPaneId: paneId,
   zoomedPaneId: null })`（D100 パターン。`focusedPaneId` を移動した pane にする——AC8「移動後は
   移動した pane にフォーカスが残る」をサーバ側でも一貫させる。`splitPane` が新しい pane を
   focus する既存の挙動と同じ）。
7. `withoutPane === null` なら（移動元 tab で唯一の pane だった）
   `closeEmptyTabShell(sourceTab.id)`（research.md R1 の変種を使う）。そうでなければ
   `nextFocused = sourceTab.focusedPaneId === paneId ? Layout.leaves(withoutPane)[0]! :
   sourceTab.focusedPaneId` として `this.tabs.set(sourceTab.id, { ...sourceTab,
   layout: withoutPane, focusedPaneId: nextFocused, zoomedPaneId: null })`（`closePane`/
   `replacePane` と同じ「代わりの focus を選ぶ」パターン）。
8. `true` を返す。

### `moveToNewTab(paneId, targetWorkspaceId)`

1. `pane = requirePane(paneId)`（`moveToTab` 手順1と同じ理由）。
   `ws = this.workspaces.get(targetWorkspaceId)`。**`requireWorkspace` ではなく `.get()`**
   （`targetWorkspaceId` も未検証のドロップ先。`moveToTab` 手順2と同じ理由）。`!ws` なら何もせず
   `null`（AC9）。`sourceTab = this.requireTab(pane.tabId)`（信頼できる値のまま）。
2. `withoutPane = Layout.remove(sourceTab.layout, paneId)`。
3. `newTabId = nextId("t")`。
   `newTab: Tab = { id: newTabId, workspaceId: targetWorkspaceId, label:
   String(ws.tabIds.length + 1), layout: {type:"pane", paneId}, focusedPaneId: paneId,
   zoomedPaneId: null, sizeOwnerClientId: null }`（`reserveTab` と同じ label 既定値ロジック。
   依拠する既存の事実）。
4. `this.panes.set(paneId, { ...pane, tabId: newTabId })`。
5. `this.tabs.set(newTabId, newTab)`。
   `this.workspaces.set(targetWorkspaceId, { ...ws, tabIds: [...ws.tabIds, newTabId],
   activeTabId: newTabId })`（`commitTab` と同じ——新しい tab を workspace の表示中 tab にする）。
   `this.setFocus(targetWorkspaceId, newTabId, paneId)`。
6. 手順7〜8（`withoutPane === null` の分岐・戻り値）は `moveToTab` と同じ。ただし戻り値は
   `{ tab: newTab }`。

### クライアント側: ドロップ先の拡張

`PaneFrame.vue` の `dropTargetAt`（`20260924-pane-dnd-split-move` で確立）を拡張し、
`document.elementFromPoint` の結果から最も近い祖先を、優先順位を付けて探す:

1. `[data-pane-id]`（既存。同一 tab 内の入れ替え/分割/分割解除）
2. `[data-tab-id]`（新規。tab バーの tab）
3. `[data-drop-workspace-id]`（新規。サイドバーの workspace 行）

いずれか最初に見つかったものをドロップ先として使う（`closest` は最も近い祖先を返すため、
実際にドロップした DOM 位置によって自然にどれか1つだけが見つかる——3つが同時に候補になることは
無い。pane の枠と tab バー・サイドバーは別の DOM 領域）。

`onNamePointerUp` で種別ごとに RPC を出し分ける:

```ts
if (hit.kind === "pane") { /* 既存: zone に応じて movePaneToEdge/replacePaneWithDrag/自分自身ガード */ }
else if (hit.kind === "tab") actions?.movePaneToTab(props.paneId, hit.tabId);
else if (hit.kind === "workspace") actions?.movePaneToNewTab(props.paneId, hit.workspaceId);
```

確定後、いずれの経路でも `view?.setView(...)`（移動先の workspace/tab へ表示を切り替える。
**同一 tab 内の既存操作〔`moveToEdge`/`replacePane`〕とは異なり、この操作は表示中の tab/workspace
自体が変わりうるため、view の切り替えが必要**）・`view?.focusPane(props.paneId)`・
`registry?.focus(props.paneId)` を呼ぶ（AC8・AC-I4）。

**ドラッグ中の視覚的フィードバック（AC4・AC7）**: `onNamePointerMove` でも同じ優先順位で
`dropTargetAt` を呼び、見つかった `hit` を `view.paneDrag`（`20260924-pane-dnd-split-move`
で確立した状態）に載せる。`hit.kind` に応じて `TabBar.vue`/`Sidebar.vue` 側が
`view.paneDrag?.overTabId === tab.id`/`view.paneDrag?.overWorkspaceId === row.workspace?.id`
を見てハイライト用の CSS クラス（`.pane-frame-edge-drop-target` と同じ考え方の、tab バー・
サイドバー用のクラスを新設）を付ける。`paneDrag` の型に `overTabId`/`overWorkspaceId`
（`string | null`）を追加する（`overPaneId`/`overZone` と同じ並び）。

### 複数クライアントでの同期（AC10）

- **`pane.updated`（移動した pane。`Pane.tabId` が新しい tab を指す）を、`moveToTab`・
  `moveToNewTab` どちらでも必ず1回発行する**（decisions.md D3。coding 中に発見した design の
  漏れ）。`layout.updated` は `Tab.layout`（葉の paneId の並び）しか運ばず、`Pane` レコード自体
  （`pane.tabId`）は更新しない（`StoreAdapter.ts`: `layout.updated`→`tabUpserted` のみ、
  `pane.updated`→`paneUpserted`）。移動した pane の `tabId` を更新しないと、クライアント側の
  `session.panes.get(paneId).tabId` が移動前の tab を指したまま残り、`viewRepair.ts`
  `liveLeaves`（`s.panes.get(id)?.tabId === t.id` で判定）や `ActionDispatcher.closeTabById`
  の busy 判定（`session.panes` を `tabId` で絞り込む）が壊れる。
- `moveToTab`: `pane.updated`（移動した pane）・`layout.updated`（移動元 tab。tab が生きていれば）・
  `layout.updated`（移動先 tab）・移動元 tab が閉じた場合は `tab.closed`（・連鎖で workspace も
  閉じた場合は `workspace.closed`、workspace が生き残った場合は `workspace.updated`——
  `closeTab`/`closePane` の D88 と同じ形。`closeEmptyTabShell` が `tabIds`/`activeTabId` を
  更新するため）。
- `moveToNewTab`: `pane.updated`（移動した pane）・`tab.created`（新しい tab。`pane.created` は
  **出さない**——既存の pane を運ぶだけで新しい PTY は無い。research.md F1 の裏返し）・
  `workspace.updated`（`tabIds`/`activeTabId` の変更を伝える）・移動元側は `moveToTab` と同じ。

## ドメイン固有の考慮

- **zoom**: 移動元・移動先どちらの tab も `zoomedPaneId: null` を無条件に適用する（D100
  パターン。research.md F5）。
- **`closeEmptyTabShell` は pane を検査しない**（design「インターフェース」節のコメントどおり、
  呼び出し側が「この tab はもう空である」ことを保証してから呼ぶ契約）。`moveToTab`/
  `moveToNewTab` 以外から誤って呼ばれないよう `private` にする。

## エラー処理 / 異常系

- 自分自身の tab（`moveToTab`）・存在しない tab/workspace: 何もしない（`false`/`null`。AC9）。
- tab バー・サイドバーの外側へのドロップ: `dropTargetAt` が何も見つけられず、`onNamePointerUp`
  は何もしない（既存のガードと同じ）。
- RPC が `false`/`null` を返した場合: クライアントは何もしない（トースト等のエラー表示も出さない。
  既存の `pane.swap_with`/`moveToEdge`/`replacePane` と同じ扱い）。

## 受け入れ基準との対応

- AC1: `pane.move_to_tab` → `SessionModel.moveToTab`（`Layout.insertAtEdge` で対象 tab の
  focus 中の pane の右へ分割）。
- AC2: `moveToTab` 手順7（`Layout.remove` で元の位置を畳む）。
- AC3: `moveToTab` 手順4（`insertAtEdge` で既存の pane の隣に split で加わる。design 方針の
  とおり、移動先 tab が pane を1枚も持たないことは無い——tab は常に最低1枚の pane を持つ既存の
  不変条件のため、AC3 の「例外」は実際には発生しない）。
- AC4: クライアント側「ドロップ先の拡張」節（`[data-tab-id]` の検出とハイライト。実装は coding で
  `TabBar.vue` に既存の `.pane-frame-edge-drop-target` と同種の CSS クラスを追加）。
- AC5: `pane.move_to_new_tab` → `SessionModel.moveToNewTab`。
- AC6: `moveToNewTab` 手順6（`moveToTab` と同じ後始末。元の tab が空になれば
  `closeEmptyTabShell` で自動的に閉じる——設計方針「移動元の tab が空になったら常に自動的に
  閉じる」で未確定事項を解消）。
- AC7: クライアント側「ドロップ先の拡張」節（`[data-drop-workspace-id]` の検出とハイライト）。
- AC8: `moveToTab`/`moveToNewTab` 双方の手順6（サーバ側で移動先 tab の `focusedPaneId` を
  移動した pane にする）＋クライアント側の明示的な `view?.setView`/`focusPane`/`registry?.focus`
  （既存の分割/分割解除と同じ「クライアントが最終的に担保する」設計）。
- AC9: サーバ側の「自分自身」「存在しない対象」ガード（エラー処理節）＋クライアント側の
  `dropTargetAt` が何も見つけない場合のガード。
- AC10: 「複数クライアントでの同期」節。
- AC11: 既存の `pane.swap_with`・`pane.move_to_edge`・`pane.replace`・既存のキーバインドは
  この work で変更しない（「対象範囲」に無い）。既存のテストは無改修のまま通ることを test 工程で
  確認する。
- AC-I1: `20260924-pane-dnd-split-move` から継承する pointerdown→pointermove(閾値)→pointerup
  の骨格（`PaneFrame.vue`）をそのまま使う。この work は `dropTargetAt` の探索先を増やすだけ。
- AC-I2: 既存の Esc（`onEscapeDuringDrag`）・有効なドロップ先での確定という骨格をそのまま使う。
  この work で新しいキャンセル経路は足さない。
- AC-I3: 「対象範囲」に無い＝この work はキーボードだけの到達経路を設けない
  （requirements.md のとおり）。
- AC-I4: クライアント側「ドロップ先の拡張」節（`view?.setView`/`focusPane`/`registry?.focus`
  の明示呼び出し）。
- AC-I5: 「対象範囲」にある箇所以外（tab バー・サイドバーの既存のクリック・右クリックメニュー・
  既存の D&D〔workspace の並べ替え〕の経路）は触らない。`20260924-pane-dnd-split-move` から
  継承する後始末（Esc・ダイアログ・自消失）もそのまま流用するため、既存の防御が崩れる余地が無い。
