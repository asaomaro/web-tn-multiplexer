# 仕様: herdr にあって本製品に操作自体が無いものを足して割り当てられるようにする

## 概要

`requirements.md` の12個の `ActionId`（`previous_workspace`・`next_workspace`・`last_pane`・
`move_tab_previous`・`move_tab_next`・`resize_pane_left/down/up/right`・`previous_agent`・`next_agent`・
`focus_agent`）を、既存のキー割り当て基盤（`bindings.ts`/`KeySettings.vue`/`HelpDialog.vue`）へ**カタログ
登録するだけで割り当て可能にする**（UI 側の新規実装は無し。research「影響範囲」で確認済み）。実際に動く
処理は `ActionDispatcher` に足す。`move_tab_previous`/`move_tab_next` を除く残り10個は既存の protocol
メソッド（`workspace.focus`・`pane.focus`・`pane.resize`）の組み合わせで実現し、`move_tab_previous`/
`move_tab_next` の1組だけ新しい protocol メソッド（`tab.move`）とサーバ側の実装を追加する。

## 設計方針

- **キー設定関連の UI（`KeySettings.vue`・`HelpDialog.vue`）は変更しない**。`ACTIONS`（`bindings.ts`）に
  エントリを足せば、両画面が自動的に対応する（research「判明した事実」で確認済み。「依拠する既存の事実」
  参照）。**`Sidebar.vue` はこれとは別の理由（非機能要件：表示順と操作対象順の一致）で最小リファクタする**
  （下記「agent の順序・workspace の順序」の項、および decisions.md D4）——「UI は一切変更しない」
  という意味ではない。
- **群は herdr に合わせ、新しい `ActionGroup` は作らない**。herdr の `keybind_help_groups`（research F7）は
  `previous_workspace`/`next_workspace`/`previous_agent`/`next_agent`/`focus_agent`/`move_tab_previous`/
  `move_tab_next` を `workspaces / tabs` 群、`last_pane`/`resize_pane_*` を `panes` 群に置いている——本製品の
  `ActionGroup`（`"全体" | "workspace / tab" | "pane"`）にそのまま写像でき、型を広げずに済む。
- **`helpHidden` は付けない**。herdr 自身のヘルプもこの12操作を隠していない（`swap_pane_*` のような
  「本製品独自に隠す」判断の前例は今回は踏襲しない——踏襲する理由が無い）。
- **「巡回・直接ジャンプ」系（`previous_workspace`/`next_workspace`/`previous_agent`/`next_agent`/
  `focus_agent`/`last_pane`）はどれも既存の `pane.focus`/`workspace.focus` の**単発呼び出しで足りる**
  （`pane.focus` はサーバ側で workspace/tab/pane の焦点を一括で更新することを確認済み。「依拠する既存の
  事実」F参照）。クライアント側の重複ロジックを避けるため、2つの共有 private ヘルパーを
  `ActionDispatcher` に追加する：
  - `focusWorkspaceById(workspaceId)`：既存の `activateNavigateSelection` の中身（workspace 取得→
    `setView`→`focusPane`→`workspace.focus` request）を抽出し、`previous_workspace`/`next_workspace` と
    共有する。
  - `focusPaneAcrossViews(paneId)`：`Sidebar.vue` の `focusPane(paneId, tabId, workspaceId)` と同じ形
    （`session.panes`→`tabId`→`session.tabs`→`workspaceId` を辿って `setView`→`focusPane`→`pane.focus`
    request）を `ActionDispatcher` 内に持ち、`last_pane`/`previous_agent`/`next_agent`/`focus_agent` の
    4箇所で共有する。
- **`move_tab_previous`/`move_tab_next` だけ新規 protocol メソッド `tab.move` を追加**する（research F5で
  確認済みのとおり、本製品にはまだ「tab の並べ替え」自体が無い）。herdr の `insert_index` 方式ではなく、
  結果が等価な**「対象 tab と隣（巡回込み）を配列内で swap する」**方式を採る——本製品の `Workspace.tabIds`
  は単純な `string[]` で、`insert_index` を経由する理由が無い（余計な計算を持ち込まない）。
- **`focus_agent` は2つ目の `indexed: true` 操作にする**（`switch_tab` と同じ仕組みを再利用。herdr
  自身も indexed binding として扱っている。research F1・F3）。これに伴い、`switch_tab` だけを前提にした
  既存の文言・テストを一般化する（下記「対象範囲」）。
- **agent の順序・workspace の順序は `Sidebar.vue` と共有する**（非機能要件）。それぞれ純関数として
  切り出し、`Sidebar.vue` の既存 computed からも呼ぶよう最小限リファクタする——ロジックの複製を避け、
  「利用者が画面で見る順」と「操作の対象順」が構造的に一致する状態を作る。

### 検討した代替案

- **`tab.move` を herdr と同じ `{tabId, insertIndex}` 形にする**：検討したが、本製品のサーバ実装が
  `insert_index` を要する複雑な構造（herdr の `Vec<Tab>` 内の複数要素シフト）を持たない単純な
  `tabIds: string[]` の配列なので、`{tabId, direction}` の方がクライアント・サーバ双方の実装が単純になる。
  結果は研究で確認したとおり herdr の `insert_index` 計算と数学的に同値（隣接swap＋巡回）。
- **agent/workspace の順序ヘルパーを `ActionDispatcher` 内だけに複製する**（`Sidebar.vue` は触らない）：
  検討したが、非機能要件（表示順と操作対象順の一致）を**構造的に**保証できない（2箇所が個別に同じロジックを
  持てば、どちらかを直したときに他方が置き去りになるリスクが残る）。共有関数に一本化する方を採用。

## 対象範囲

- `packages/web/src/keys/bindings.ts`：`ACTIONS` に12エントリ追加（すべて `defaults: []`）。
- `packages/web/src/keys/actions.ts`：`Action` 判別共用体に新しい type を追加
  （`workspaceDelta`・`lastPane`・`moveTab`・`focusAgentIndex`・`agentDelta`。`resize_pane_*` は既存の
  `resizeBy` をそのまま使うので型追加なし）。
- `packages/web/src/actions/ActionDispatcher.ts`：上記 Action の実装本体、共有ヘルパー2つ。
- `packages/web/src/store/view.ts`：`lastFocusedPaneId` の追跡（`focusPane` 内に1行差し込み）。
- 新規ファイル `packages/web/src/store/agentOrder.ts`：`orderedAgentPaneIds`（純関数。`Sidebar.vue`・
  `ActionDispatcher` 共有）。
- 新規ファイル `packages/web/src/store/workspaceOrder.ts`：`orderedWorkspaceIds`（純関数。同上）。
- `packages/web/src/components/Sidebar.vue`：`spaces`/`agents` computed を上記2つの純関数を呼ぶ形に
  最小リファクタ（結果は現状と完全に一致させる。既存の `Sidebar.test.ts` が回帰の網）。
- `packages/web/src/keys/keymap.ts`：範囲ミスマッチのエラー文言を `switch_tab` 専用の言い回しから一般化。
- `packages/protocol/src/messages.ts`：`TabMoveParams`（+ `tabMoveDirection` enum）・
  `METHOD_SCHEMAS["tab.move"]`・`MethodResultMap["tab.move"]` を追加。
- `packages/server/src/session/SessionModel.ts`：`moveTab(id, direction): Workspace | null` を追加。
- `packages/server/src/session/SessionService.ts`：`moveTab` を追加し、変化があれば `workspace.updated`
  を publish。
- `packages/server/src/surface/methods/tab.ts`：`tab.move` のハンドラ登録。
- `docs/herdr-parity.md`：H26 の更新（新しい H26d 行の追加）。
- 単体テスト：`bindings.test.ts`（`indexed` 一覧の更新に加え、`packages/web/src/keys/bindings.test.ts:33`
  `expect(a.defaults.length, a.id).toBeGreaterThan(0)` が**全操作に既定キーがある前提**になっている
  ——本 work が初めて `defaults: []` の操作を持ち込むため、この前提を緩める改修が要る。「対象範囲」の
  一部として明示する）・`keymap.test.ts`（文言更新）・
  `ActionDispatcher.test.ts`（12操作分の新規ケース）・`view.test.ts`（`lastFocusedPaneId` の追跡）・
  `SessionModel.test.ts`/`SessionService.test.ts`（`moveTab`）・`messages` 側の型テストがあれば追随・
  `Sidebar.test.ts`（回帰の確認。リファクタ後も既存アサーションが通ること）。
  新規: `agentOrder.test.ts`・`workspaceOrder.test.ts`。

## 依拠する既存の事実

- `pane.focus` はサーバ側で tab の `focusedPaneId`・workspace の `activeTabId`・session 全体の `focus`
  を一括更新する（`packages/server/src/session/SessionModel.ts:394-401` `focusPane`）。よって
  workspace・tab をまたぐ pane ジャンプは `pane.focus` 一発で足り、`workspace.focus`/`tab.focus` を
  追加で呼ぶ必要は無い。
- `workspace.focus` も同様に `activeTabId`→`focusedPaneId` まで解決して `focus` を更新する
  （`SessionModel.ts:218-221` `focusWorkspace`。既存の `activateNavigateSelection`
  `packages/web/src/actions/ActionDispatcher.ts:554-565` がこの前提で書かれている）。
- `view.focusPane`（`packages/web/src/store/view.ts:242-244`）が、`ActionDispatcher.cyclePane`
  （`packages/web/src/actions/ActionDispatcher.ts:412-422`）・`focusDir`（`:396-404`）・`switchToTab`
  （`:461-466`）・`activateNavigateSelection`（`:554-565`）・`Sidebar.vue` の `focusWorkspace`（`:70-77`）・
  `focusPane`（`:79-83`）を含む**ほぼ全てのフォーカス変更の経路**である。`focusedPaneId.value =` の
  直接代入は grep で3箇所（`view.ts:226`・`:232` の `restoreView`＝起動時の復元、`:274` の
  `closeDialog`＝ダイアログを閉じたとき開く前の pane へ戻す）に限られることを確認済み。**`closeDialog`
  は `lastFocusedPaneId` の更新対象に含めない**（design判断）——実運用では `openDialogWithContext` は
  `focusedPaneId` を変えないため、`closeDialog` の直接代入はほぼ常に同じ値への無変化の書き戻し
  （p1→p1）で、意味のある「前の場所」を作らない。ダイアログの開閉は workspace/tab/pane 間の
  ナビゲーションではないので、`last_pane` の対象に含めないのが意図どおり（decisions.md D8）。
- `KeySettings.vue`（`packages/web/src/components/KeySettings.vue:52-60,524-608`）は `ACTIONS` を
  `group` でフィルタして描画するだけで、`bindingsOf(id).length === 0` のとき「なし」を表示し
  「追加：prefix の後」「追加：直接」ボタンを常に出す——既定キー無しの操作を特別扱いする分岐は無い。
- `HelpDialog.vue`（`packages/web/src/components/HelpDialog.vue:48-53`）の `actionEntries` も同様に
  `bindingsOf(id).length === 0` を「なし」（灰色）として描画する。`helpHidden` フラグが無い限り必ず出る。
- `assign.ts`（`packages/web/src/keys/assign.ts:134,162,173,198`）の範囲キー処理は `def?.indexed === true`
  だけを見て分岐しており、`switch_tab` という特定の id にハードコードされていない
  （`focus_agent` を2つ目の `indexed: true` にしても無改修で動く）。
- `Workspace.tabIds: string[]`（`packages/protocol/src/model.ts:22`。`SessionModel.createTab`/`closeTabInternal`
  が `tabIds` を作り替える箇所を確認済み `SessionModel.ts:256,335-342`）。並べ替えは配列の要素入れ替えで
  表現できる。
- `SessionService.renameTab`/`closeTab`（`SessionService.ts:324-354`）が、workspace 自体の構造が変わる
  ときに `workspace.updated` イベントで `tabIds` の変化をブロードキャストする流儀を確立している
  （`createTab` 内のコメント `SessionService.ts:314-316`「`commitTab` は workspace の `tabIds`/
  `activeTabId` も更新するが、それを知らせる `workspace.updated` が無かった…（D88）」、`closeTab` 内の
  対応するコメント `:347-348`「workspace 自体は生き残った…その変化を知らせる（D88。上の createTab と対）」）。
  `moveTab` もこれに揃える。
- herdr の `move_tab_previous`/`move_tab_next` は「対象 tab とその隣（巡回込み）を入れ替える」に等価
  （research F5。机上で `insert_index`→`remove`/`insert` の変換を追跡して確認済み）。
- herdr の9操作名（`resize_pane_*` を1つとして数えた場合の数。本製品では4方向に展開し12個の `ActionId`
  になる）の doc コメント・実装は全て `Unset by default`（research F1）——12個とも
  `ActionDef.defaults: []` にする根拠。

## インターフェース / データ構造

### `Action`（`keys/actions.ts`）に追加する型

```ts
| { type: "workspaceDelta"; delta: 1 | -1 }      // previous_workspace / next_workspace
| { type: "lastPane" }                            // last_pane
| { type: "moveTab"; direction: "previous" | "next" } // move_tab_previous / move_tab_next
| { type: "agentDelta"; delta: 1 | -1 }           // previous_agent / next_agent
| { type: "focusAgentIndex"; index: number }      // focus_agent（1-9 → 0-8 に変換済みで渡す）
```

`resize_pane_left/down/up/right` は新しい type を作らず、既存の `{ type: "resizeBy"; dir; amount }` を
`bindings.ts` の `action` にそのまま書く（`ResizeMode.ts` の `RESIZE_STEP` を import）。

### `bindings.ts` の12エントリ（要旨。group・defaults・action のみ）

| id | group | defaults | action |
|---|---|---|---|
| `previous_workspace` | `workspace / tab` | `[]` | `{ type: "workspaceDelta", delta: -1 }` |
| `next_workspace` | `workspace / tab` | `[]` | `{ type: "workspaceDelta", delta: 1 }` |
| `move_tab_previous` | `workspace / tab` | `[]` | `{ type: "moveTab", direction: "previous" }` |
| `move_tab_next` | `workspace / tab` | `[]` | `{ type: "moveTab", direction: "next" }` |
| `previous_agent` | `workspace / tab` | `[]` | `{ type: "agentDelta", delta: -1 }` |
| `next_agent` | `workspace / tab` | `[]` | `{ type: "agentDelta", delta: 1 }` |
| `focus_agent` | `workspace / tab` | `[]` | `indexed: true`, `action: (index) => ({ type: "focusAgentIndex", index: index - 1 })` |
| `last_pane` | `pane` | `[]` | `{ type: "lastPane" }` |
| `resize_pane_left` | `pane` | `[]` | `{ type: "resizeBy", dir: "left", amount: RESIZE_STEP }` |
| `resize_pane_down` | `pane` | `[]` | `{ type: "resizeBy", dir: "down", amount: RESIZE_STEP }` |
| `resize_pane_up` | `pane` | `[]` | `{ type: "resizeBy", dir: "up", amount: RESIZE_STEP }` |
| `resize_pane_right` | `pane` | `[]` | `{ type: "resizeBy", dir: "right", amount: RESIZE_STEP }` |

配置順は `ACTIONS` の既存グループ順（`workspace / tab` 群の末尾・`pane` 群の末尾）に追記する（カタログ順が
表示順・衝突解決順を兼ねるため。`bindings.ts` 冒頭のコメント参照）。

### `store/agentOrder.ts`（新規。純関数）

```ts
export interface AgentOrderEntry {
  paneId: string;
  state: DisplayState | null; // store/seen.ts の displayStateFor が返す値
  since: number;               // AgentInfo.since
}
export function orderedAgentPaneIds(entries: AgentOrderEntry[], sort: AgentSort): string[];
```

`Sidebar.vue` の `agents` computed（現状: grouped=無並べ替え、priority=状態優先度→`since` 降順）と
`ActionDispatcher` の両方がこの関数を呼ぶ。呼び出し側（`Sidebar.vue`・`ActionDispatcher`）はそれぞれ
`session.panes`・`useSeenStore().getSeenSeq`・`displayStateFor` から `AgentOrderEntry[]` を組み立てる
（対象は `pane.agent !== null` の pane 全部。状態でフィルタしない。requirements 機能要件どおり）。

### `store/workspaceOrder.ts`（新規。純関数）

```ts
export function orderedWorkspaceIds(workspaces: Workspace[], sort: WorkspaceSort): string[];
```

`opened`＝渡された配列順のまま（`session.workspaces` の Map 反復順＝サーバから届いた順）、`name`＝
`label.localeCompare` 昇順（`Sidebar.vue` の既存 `spaces` computed と同じ規則を移設するだけ）。

### protocol（`packages/protocol/src/messages.ts`）

```ts
const tabMoveDirection = z.enum(["previous", "next"]);
export const TabMoveParams = z.object({ tabId, direction: tabMoveDirection });
export type TabMoveParams = z.infer<typeof TabMoveParams>;
```

`METHOD_SCHEMAS["tab.move"] = TabMoveParams`・`MethodResultMap["tab.move"] = Record<string, never>`
（`tab.rename`/`tab.close` と同じ「空の成功応答＋イベントで実体を配る」形）。

### server（`SessionModel`/`SessionService`）

```ts
// SessionModel
moveTab(id: TabId, direction: "previous" | "next"): Workspace | null {
  const tab = this.requireTab(id);            // 未知の id は NotFoundError（既存の流儀）
  const ws = this.requireWorkspace(tab.workspaceId);
  const idx = ws.tabIds.indexOf(id);
  if (ws.tabIds.length <= 1) return null;      // AC5「tab が1つしか無ければ何も起きない」
  const delta = direction === "next" ? 1 : -1;
  const swapIdx = (idx + delta + ws.tabIds.length) % ws.tabIds.length;
  const tabIds = [...ws.tabIds];
  [tabIds[idx], tabIds[swapIdx]] = [tabIds[swapIdx], tabIds[idx]];
  const updated = { ...ws, tabIds };
  this.workspaces.set(ws.id, updated);
  return updated;
}
```

```ts
// SessionService
moveTab(id: TabId, direction: "previous" | "next"): void {
  const updated = this.model.moveTab(id, direction);
  if (updated) {
    this.bus.publish({ event: "workspace.updated", data: { workspace: updated } });
    this.persist.touch();
  }
}
```

```ts
// surface/methods/tab.ts
surface.register("tab.move", {
  schema: TabMoveParams,
  handler: (_ctx, params) => {
    deps.session.moveTab(params.tabId, params.direction);
    return {};
  },
});
```

## 振る舞いの詳細

### `previous_workspace`/`next_workspace`（`workspaceDelta`）

```
ids = orderedWorkspaceIds([...session.workspaces.values()], view.workspaceSort)
if ids.length <= 1: return  // AC4
current = ids.indexOf(view.workspaceId) // 無ければ -1
next = ids[(current === -1 ? 0 : current + delta + ids.length) % ids.length]
focusWorkspaceById(next)
```

`focusWorkspaceById`（共有ヘルパー。既存 `activateNavigateSelection` から抽出）:
```
ws = session.workspaces.get(workspaceId)
if ws: view.setView(ws.id, ws.activeTabId); tab = session.tabs.get(ws.activeTabId); if tab: view.focusPane(tab.focusedPaneId)
conn.request("workspace.focus", { workspaceId }).catch(() => undefined)
```

### `last_pane`（`lastPane`）

`view.ts` に `lastFocusedPaneId = ref<string | null>(null)` を追加し、`focusPane` を次のように変える：

```ts
function focusPane(paneId: string | null): void {
  if (paneId !== null && focusedPaneId.value !== null && focusedPaneId.value !== paneId) {
    lastFocusedPaneId.value = focusedPaneId.value;
  }
  focusedPaneId.value = paneId;
}
```

（`paneId === null` のとき＝pane が無くなったときは `lastFocusedPaneId` を更新しない。「直前」の意味が
無くなる遷移なので、次に `focusPane(x)` が呼ばれるまで直前の値を保持する方が herdr の「1スロット
トグル」に近い。）

`ActionDispatcher.lastPane()`：
```
target = view.lastFocusedPaneId
if target === null or target === view.focusedPaneId: return  // AC2 のガード
if !session.panes.has(target): return  // 直前の pane が既に閉じている（AC2）
focusPaneAcrossViews(target)
```

`focusPaneAcrossViews`（共有ヘルパー。`Sidebar.vue` の `focusPane(paneId, tabId, workspaceId)` と同じ形）:
```
pane = session.panes.get(paneId); if !pane: return
tab = session.tabs.get(pane.tabId); if !tab: return
view.setView(tab.workspaceId, tab.id)
view.focusPane(paneId)
conn.request("pane.focus", { paneId }).catch(() => undefined)
```

`focusPaneAcrossViews` 自身が `view.focusPane` を呼ぶため、`lastFocusedPaneId` の更新（上記の差し込み）が
自動的に働き、2回目の `last_pane` で元へ戻る（トグル。AC2 の後半）。

### `move_tab_previous`/`move_tab_next`（`moveTab`）

```
tab = view.tabId ? session.tabs.get(view.tabId) : undefined
if !tab: return
conn.request("tab.move", { tabId: tab.id, direction }).catch(() => undefined)
```

クライアント側では `tabIds` を先読みで並べ替えない（`tabDelta` と違い、対象を求めるのに他の tab の
情報が要らないため、楽観更新の必要性が薄い。**`workspace.updated` イベントが折り返ってから並びが反映**
される——既存の `tab.rename`/`tab.close` と同じ「サーバの応答待ち」の粒度で AC5 上も問題ない）。

### `resize_pane_left/down/up/right`

`bindings.ts` の `action` が直接 `{ type: "resizeBy", dir, amount: RESIZE_STEP }` を持つので、
`ActionDispatcher` 側の変更は無い（既存の `resizeBy` ハンドラがそのまま処理する）。

### `previous_agent`/`next_agent`（`agentDelta`）

```
entries = [...session.panes.values()]
  .filter(p => p.agent !== null)
  .map(p => ({ paneId: p.id, state: displayStateFor(p.agent, seen.getSeenSeq(p.agent!.instanceId, p.agent!.serverSeenSeq)), since: p.agent!.since }))
ids = orderedAgentPaneIds(entries, view.agentSort)
if ids.length === 0: return  // AC7a
current = ids.indexOf(view.focusedPaneId ?? "")
next = current === -1
  ? (delta === 1 ? ids[0] : ids[ids.length - 1])
  : ids[(current + delta + ids.length) % ids.length]
focusPaneAcrossViews(next)
```

（`current === -1` の分岐は research F3 の herdr 実装をそのまま踏襲：現在の focus が一覧に無いとき
`next` は先頭・`previous` は末尾。）

### `focus_agent`（`focusAgentIndex`）

```
entries = (上と同じ組み立て)
ids = orderedAgentPaneIds(entries, view.agentSort)
target = ids[index]  // index は 0 始まり（bindings.ts の action で 1 引いた値を渡す）
if target === undefined: return  // AC7b
focusPaneAcrossViews(target)
```

## ドメイン固有の考慮

- **prefix・chord・予約キー・衝突判定は一切変更しない**（20260921-keybinding-customization で確立済み。
  requirements「対象外」）。12個の新規操作もこの仕組みにそのまま乗る。
- **herdr との対応**は `docs/herdr-parity.md` の慣習（H番号・研究の索引付き出典）に従い、新しい H26d 行を
  追加する。文面は H26c（20260923-navigate-mode-keys）の粒度に合わせ、herdr との違い（クライアント
  巡回か直接切替か・`tab.move` の `insertIndex` を使わず `direction` にした点等）を明記する。
- **`focus_agent` を2つ目の indexed 操作にする副作用**：`keymap.ts` のエラー文言
  「範囲 1..9 は tab の番号選択だけに使えます」（`switch_tab` だけを前提にした表現）を
  「範囲 1..9 は、switch_tab・focus_agent のような範囲対応の操作にしか使えません」へ一般化する。
  対応する `keymap.test.ts:220` の部分文字列アサーション（`"tab の番号選択だけ"`）も更新する。
  `bindings.ts` 冒頭コメント（24行目「範囲の操作（`indexed`。`switch_tab` だけ）」）も「だけ」を外す。
  `bindings.test.ts:41-42` の `indexed.map(...).toEqual(["switch_tab"])` は
  `toEqual(["switch_tab", "focus_agent"])`（`ACTIONS` 内の登場順）に更新する。

## エラー処理 / 異常系

- 全操作とも「対象が無い／既に同じ場所」は**エラーではなく無音の no-op**（herdr と同じ。research F2〜F5）。
  トースト等の通知は出さない（既存の `focusDir`・`tabDelta` が対象無しのとき何も言わないのと同じ流儀。
  `swap`・`resizeBy` も同様に黙って何もしない）。
- `tab.move` はサーバ側で未知の `tabId` を渡されると `NotFoundError`→`not_found` 応答になる
  （`requireTab` の既存の流儀）。クライアントは他の request と同じく `.catch(() => undefined)` で握る
  （UI 側の楽観更新を行わないため、失敗時に戻す処理も不要）。
- `SessionModel.moveTab` が `tabIds.length <= 1` で `null` を返すのは異常系ではなく正常な no-op
  （AC5）。`SessionService` はこのとき `workspace.updated` を発行しない（意味のある変化が無いため。
  `persist.touch()` も呼ばない——ディスクへの余計な保存を避ける）。

## 受け入れ基準との対応

- AC1: `lastPane()` が `view.lastFocusedPaneId`（`focusPane` が全経路で更新）から対象を得て
  `focusPaneAcrossViews` で workspace・tab をまたいで焦点を移す。入力元は `view.ts` の
  `lastFocusedPaneId`（新規）。
- AC2: `focusPaneAcrossViews` が内部で `view.focusPane` を呼ぶため、`lastFocusedPaneId` は押すたびに
  「今いた場所」に更新され続ける（トグル）。既に閉じた pane は `session.panes.has()` ガードで no-op。
- AC3: `workspaceDelta` が `orderedWorkspaceIds([...session.workspaces.values()], view.workspaceSort)` を
  巡回する。入力元は `session.workspaces`（構造）・`view.workspaceSort`（表示順の好み）。
- AC4: `ids.length <= 1` の早期 return（`workspaceDelta` 冒頭）。
- AC5: `SessionModel.moveTab` の swap＋巡回ロジックと、`tabIds.length <= 1` の no-op ガード。
  入力元は `view.tabId`→`session.tabs`。
- AC6: `bindings.ts` の `resize_pane_*` 4エントリが既存の `resizeBy` ハンドラへそのまま渡す。
- AC7: AC7a は `agentDelta` の `ids.length === 0` ガード、AC7b は `focusAgentIndex` の
  `ids[index] === undefined` ガード。入力元は `session.panes`（`.agent !== null` で絞る）・
  `useSeenStore`（状態解決）・`view.agentSort`（並び順）。
- AC8: `bindings.ts` に `ACTIONS` エントリとして登録するだけで `KeySettings.vue`/`HelpDialog.vue` が
  対応する（「依拠する既存の事実」参照。新規実装なし）。
- AC9: `docs/herdr-parity.md` H26 の更新（新しい H26d 行）。
- AC10: 既存35操作・navigate/resize/copy モードのテストを変更しない（新規ファイル追加・新規テスト
  追加のみで、既存アサーションを書き換えるのは「ドメイン固有の考慮」に挙げた2件の意図的な一般化のみ）。
