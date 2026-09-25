# 仕様: レイアウト操作後のグローバル focus の更新

## 概要

`SessionModel` の `swapPaneWith`・`moveToEdge`・`replacePane`・`moveToTab`・`moveToNewTab`
（いずれも既存の pane 移動・入れ替え操作）は、成功時に `this.focus`（セッション全体の
グローバル focus。`session.json` に永続化されサーバ再起動時の復元先になり
——`SessionService.ts:842-847` の `restore()` が `data.focus` から `this.model.focusPane(...)`
を呼ぶ——、ローカル保存 view の無い新規クライアントの再接続時の復元先にもなる
——`StoreAdapter.ts:59-62` が `session.focus`（サーバの `this.focus`）を
`view.restoreView(...)` へ渡し、`view.ts:308-320` の `restoreView` が `serverFocus` として
それを使う）を更新しない。この work では、5操作それぞれの
成功時に、その操作で動かした pane（`paneId`）へ `this.focus` を更新する1行を追加する。
`moveToTab`/`moveToNewTab` はさらに、移動元 tab の自動クローズ（`closeEmptyTabShell`）が
発生しても、この更新が上書きされないよう呼び出し順を整理する。`tab.focusedPaneId`・
`workspace.activeTabId`・既存の配布イベントには一切触れない。

## 設計方針

- **既存の `private setFocus(workspaceId, tabId, paneId, opts?)` をそのまま使う**（`opts`
  無しで呼ぶ——`opts.setTabFocusedPane` は渡さない。`tab.focusedPaneId` を書き換えると
  `20260924-pane-dnd-split-move` の設計判断（`moveToEdge`/`replacePane` は
  `focusedPaneId` を変更しない）に抵触するため）。新しいヘルパーは作らない。
- **`replacePane` の既存の条件付き `setFocus` 呼び出し（削除された pane が tab のローカル
  focus だった場合のみ）を、無条件の呼び出しに置き換える**。生存した pane（`paneId`）は
  「救済が必要だったか」に関わらず、この work の新しい規則の下では常にこの領域を代表する
  focus 先になる——既存の条件付き呼び出しはこの無条件呼び出しに包含される（同じ引数
  `(tab.workspaceId, tab.id, paneId)` で、条件が真のときも偽のときも同じ値を書き込むため、
  結果は変わらない。条件が真のケースの既存テストは無改修のまま通る）。
- **`moveToTab`/`moveToNewTab` は、`closeEmptyTabShell` の呼び出しの後に `setFocus`
  （移動先）を呼ぶ**（`moveToNewTab` は現状「先に `setFocus`、後で `closeEmptyTabShell`」の
  順になっており、これが上書きの原因——依拠する既存の事実、参照）。`closeEmptyTabShell`
  自体の内部ロジックは変更しない——呼び出し順を入れ替えるだけで、「移動先の `setFocus` が
  最後に書き込まれる」という結果を保証する。
  - 代替案（`closeEmptyTabShell` の救済ロジックに「`this.focus` が実際にこの tab/workspace を
    指していたときだけ発火する」という条件を追加する）は退けた——この救済ロジックはより広い
    既存の潜在的な不具合（対象外に記載）を含み、今回のスコープ（5操作の移動先を守ること）を
    超えて `closeEmptyTabShell` 自体の意味論を変えることになる。呼び出し順の入れ替えだけで
    今回のスコープは満たせる。
- **`swapPaneWith`（`paneId` と `otherPaneId` を入れ替える）は `paneId`（RPC の第1引数）を
  新しい focus 先にする**。理由: 5操作全てで「動かされた／ドラッグされた側」を第1引数
  `paneId` に置く既存の呼び出し規約（`moveToEdge(paneId, targetPaneId, edge)`・
  `replacePane(paneId, targetPaneId)` も同じ形）に揃える。`swapPaneWith` は現在 web の
  UI からは呼ばれていない（依拠する既存の事実、参照）が、RPC としては現役であり、他の
  4操作と同じ規則にしておくことで、将来 UI が復活したときに個別の判断が要らない。

## 対象範囲

- `packages/server/src/session/SessionModel.ts`（`swapPaneWith`・`moveToEdge`・
  `replacePane`・`moveToTab`・`moveToNewTab`）
- `packages/server/src/session/SessionModel.test.ts`（各操作の既存 describe に確認テストを
  追加）

## 依拠する既存の事実

- `SessionModel.ts:127-129` の `getFocus(): SessionFocus | null { return this.focus; }`。
- `SessionModel.ts:847-853` の `private setFocus(workspaceId, tabId, paneId, opts?: {
  setTabFocusedPane?: boolean })`: `this.focus = { workspaceId, tabId, paneId }` を
  設定し、`opts.setTabFocusedPane` が真のときだけ `tab.focusedPaneId` も書き換える。
- 5操作の現状の実装（`SessionModel.ts`）:
  - `swapPaneWith`（713-721行目）: `this.focus` に触れない。
  - `moveToEdge`（728-742行目）: `this.focus` に触れない。
  - `replacePane`（750-771行目）: `nextFocused = tab.focusedPaneId === targetPaneId ?
    paneId : tab.focusedPaneId` を tab に書き込んだあと、`if (nextFocused !==
    tab.focusedPaneId) this.setFocus(tab.workspaceId, tab.id, nextFocused);`
    （769行目）——削除された pane が tab のローカル focus だった場合のみ、生存した pane
    （`nextFocused === paneId` のケース）へ `this.focus` を更新する。
  - `moveToTab`（609-629行目）: `targetTab.focusedPaneId` は書き換える（620行目）が、
    `this.focus` には触れない。移動元 tab が空にならなければ、625行目
    `const nextFocused = sourceTab.focusedPaneId === paneId ? Layout.leaves(withoutPane)[0]!
    : sourceTab.focusedPaneId;` で移動元 tab のローカル focus の代わりを選び、626行目で
    `sourceTab` に書き込む（`this.focus` には無関係）。空になれば
    `closeEmptyTabShell(sourceTab.id)` を呼ぶ（623行目）。
  - `moveToNewTab`（636-665行目）: `this.setFocus(targetWorkspaceId, newTabId, paneId)`
    を656行目で呼んだあと、移動元 tab が空にならなければ、661行目で `moveToTab` と同じ形の
    `nextFocused` 計算（`sourceTab.focusedPaneId === paneId ? Layout.leaves(withoutPane)[0]!
    : sourceTab.focusedPaneId`）を行い `sourceTab` に書き込む。空になれば
    `closeEmptyTabShell(sourceTab.id)` を呼ぶ（659行目）——**`setFocus` が先、
    `closeEmptyTabShell` が後**という順序。
  - `closeEmptyTabShell`（582-602行目）: 対象 tab を削除し、その workspace の
    `activeTabId` がその tab だった場合（597行目 `if (activeTabId !== ws.activeTabId)`）、
    新しい active tab の `focusedPaneId` へ `this.setFocus(ws.id, activeTabId,
    nextTab.focusedPaneId)`（599行目）を呼ぶ——`this.focus` が実際にこの workspace/tab を
    指していたかどうかに関わらず、無条件に発火する。
  - 実機確認（このセッションで直接コードを追跡）: `moveToNewTab` が cross-workspace で
    移動元 tab を空にする場合、656行目の `setFocus`（移動先）→ 659行目の
    `closeEmptyTabShell` → その内部599行目の `setFocus`（移動元 workspace 側の救済）の
    順に実行され、移動元 tab が移動元 workspace の `activeTabId` だった場合、656行目の
    結果が599行目で上書きされる。
- `20260924-pane-dnd-split-move/design.md:172`「`focusedPaneId` は変更しない
  （クライアント側がドロップ確定後に明示的に focus する）」——`moveToEdge`/`replacePane`
  について、`tab.focusedPaneId` をサーバ側で積極的に変えない、という既存の設計判断。
  今回追加するのは `this.focus`（グローバル）の更新のみで、この判断には触れない。
- `20260924-pane-move-cross-tab/design.md:148`「`focusedPaneId` を移動した pane にする
  ——AC8『移動後は移動した pane にフォーカスが残る』をサーバ側でも一貫させる」
  ——`moveToTab`/`moveToNewTab` について、design は元々グローバル focus も含めた
  一貫性を意図していた（`.aidev/works/20260924-pane-move-cross-tab/decisions.md:79-81`
  の D4「影響」節が「design 記述と実装の粒度のずれ」と認めている
  とおり、実装は `tab.focusedPaneId` の更新に留まっていた）。今回の変更は、この
  design が元々意図していた一貫性を完成させるものであり、新しい設計判断ではない。
- `packages/web/src/actions/ActionDispatcher.ts:607-613` のコメント: `swapPanesByDrag`
  （`pane.swap_with` を呼んでいた）は `20260924-pane-dnd-split-move` で縁/中央のゾーン方式
  （`moveToEdge`/`replacePane`）に置き換わり、`PaneFrame.vue` はもう呼ばない。
  `packages/server/src/surface/methods/pane.ts:81-88` に `pane.swap_with` の RPC 登録は
  現役で残っている（`grep -rln "swap_with" packages/web/src packages/cli` では
  `ActionDispatcher.ts` のコメント以外に呼び出し箇所が無いことを確認済み）。
- `SessionModel.test.ts` の既存テスト構造（153-193行目 `swapPaneWith`・196-268行目
  `moveToEdge`・271行目以降 `replacePane`・352行目以降 `moveToTab`・422行目以降
  `moveToNewTab`）。いずれも `model.getFocus()` を検証するテストは無い（この work で
  初めて追加する）。
- `SessionService.test.ts` の `describe("moveToTab", ...)`（340-401行目）・
  `describe("moveToNewTab", ...)`（403行目以降）: 各 `it` が `events` 配列（`bus.subscribe`
  で集めた配布イベント名の列）を厳密に `toEqual` で検証している（例: 341-355行目
  「`pane.updated` → `layout.updated`（移動元）→ `layout.updated`（移動先）」・373-387行目
  「移動元 workspace も連鎖して空になるとき: `tab.closed` → `workspace.closed`」）。
  いずれの期待値にも `session.focus_changed` は含まれていない——今回の変更は `this.focus`
  というフィールドを書き込むだけで、`SessionService.ts` 側のイベント配布ロジックには
  一切触れないため、これらの期待値は変更後も成立する（AC6 の根拠）。

## インターフェース / データ構造

戻り値・引数の型は変更しない。各メソッドの成功パスの末尾に `this.setFocus(...)` を
1行追加する（`replacePane` は既存行を置き換え）。

### `swapPaneWith`

```ts
swapPaneWith(paneId: PaneId, otherPaneId: PaneId): boolean {
  if (paneId === otherPaneId) return false;
  const pane = this.requirePane(paneId);
  const other = this.panes.get(otherPaneId);
  if (!other || other.tabId !== pane.tabId) return false;
  const tab = this.requireTab(pane.tabId);
  this.tabs.set(tab.id, { ...tab, layout: Layout.swap(tab.layout, paneId, otherPaneId) });
  this.setFocus(tab.workspaceId, tab.id, paneId);
  return true;
}
```

### `moveToEdge`

```ts
moveToEdge(paneId: PaneId, targetPaneId: PaneId, edge: Layout.Edge): boolean {
  // ...既存の判定・レイアウト更新は変更なし...
  this.tabs.set(tab.id, { ...tab, layout: newLayout });
  this.setFocus(tab.workspaceId, tab.id, paneId);
  return true;
}
```

### `replacePane`

```ts
// 既存の
//   if (nextFocused !== tab.focusedPaneId) this.setFocus(tab.workspaceId, tab.id, nextFocused);
// を、無条件の
this.setFocus(tab.workspaceId, tab.id, paneId);
// に置き換える（nextFocused が paneId のときは同じ値、tab.focusedPaneId のままのときも
// 「生存した pane が代表する」という新しい規則の下では paneId が正しい focus 先）。
```

### `moveToTab`

```ts
moveToTab(paneId: PaneId, targetTabId: TabId): boolean {
  // ...既存のレイアウト更新（619-620行目）は変更なし...
  if (withoutPane === null) {
    this.closeEmptyTabShell(sourceTab.id);
  } else {
    // ...既存の nextFocused 計算・tabs.set は変更なし...
  }
  this.setFocus(targetTab.workspaceId, targetTabId, paneId); // closeEmptyTabShell の後に置く
  return true;
}
```

### `moveToNewTab`

```ts
moveToNewTab(paneId: PaneId, targetWorkspaceId: WorkspaceId): { tab: Tab } | null {
  // ...既存のレイアウト更新（653-655行目）は変更なし...
  // `this.setFocus(targetWorkspaceId, newTabId, paneId);` をここから削除し、下へ移す
  if (withoutPane === null) {
    this.closeEmptyTabShell(sourceTab.id);
  } else {
    // ...既存の nextFocused 計算・tabs.set は変更なし...
  }
  this.setFocus(targetWorkspaceId, newTabId, paneId); // closeEmptyTabShell の後に置く
  return { tab: newTab };
}
```

## 振る舞いの詳細

- 5操作いずれも、成功時は最終的に `this.focus` が「動かした pane（`paneId`）」を指す。
  失敗時（既存の `false`/`null` を返す分岐）は `this.focus` に触れない（既存のガード節を
  そのまま維持する）。
- `moveToTab`/`moveToNewTab` は `closeEmptyTabShell` が発火してもしなくても、メソッドの
  末尾で必ず移動先へ `setFocus` するため、最終結果は一貫する。
- `tab.focusedPaneId`・`workspace.activeTabId`・`layout.updated`/`pane.updated`/
  `tab.*`/`workspace.*` の配布内容は一切変更しない——`SessionModel.ts` の `setFocus`
  （847-853行目）は `this.focus` というフィールドを書き込むだけで、イベントの `publish`
  自体は `SessionModel` の外（`SessionService.ts` 側）が行っており、`setFocus` はそれを
  一切呼ばない（依拠する既存の事実、`SessionService.test.ts` の `moveToTab`/`moveToNewTab`
  のイベント列検証テストが `session.focus_changed` を含まないことで裏付け済み——参照）。

## ドメイン固有の考慮

- 該当なし（herdr との機能差ではなく、既存 work（`20260924-pane-move-cross-tab`）が
  スコープ外として先送りした内部整合性の修正）。

## エラー処理 / 異常系

- 新しいエラー処理は追加しない。既存のガード節（`false`/`null` を返す早期リターン）は
  そのまま維持し、その後に到達しない限り `setFocus` は呼ばれない。

## 対象外の扱いの記録

- `closeEmptyTabShell` の救済ロジックが、無関係な workspace の `this.focus` を巻き込んで
  上書きしうるという、より広い既存の潜在的な不具合（依拠する既存の事実、参照）は、
  requirements.md「スコープ / 対象外」のとおりこの work では扱わない。deliver 工程で
  backlog に新しい項目として記録する。

## 受け入れ基準との対応

- AC1: `swapPaneWith` の末尾に `this.setFocus(tab.workspaceId, tab.id, paneId)` を追加する
  （入力: 成功時の `tab.workspaceId`/`tab.id`/`paneId`。インターフェース節、参照）。
- AC2: `moveToEdge` の末尾に同様の `setFocus` を追加する（入力は AC1 と同じ構造）。
- AC3: `replacePane` の条件付き `setFocus` を無条件呼び出しに置き換える（入力:
  `tab.workspaceId`/`tab.id`/`paneId`。インターフェース節「`replacePane`」、参照）。
- AC4: `moveToTab` の末尾（`closeEmptyTabShell` 呼び出しの後）に
  `this.setFocus(targetTab.workspaceId, targetTabId, paneId)` を追加する（入力:
  `targetTab.workspaceId`/`targetTabId`/`paneId`。インターフェース節「`moveToTab`」、参照）。
- AC5: `moveToNewTab` の既存の `setFocus` 呼び出しを、`closeEmptyTabShell` 呼び出しの後へ
  移動する（入力: `targetWorkspaceId`/`newTabId`/`paneId`。インターフェース節
  「`moveToNewTab`」、参照）。
- AC6: `tab.focusedPaneId`・`workspace.activeTabId` を書き込む既存の行は一切変更しない
  （インターフェース節の各コード例が示すとおり、追加・置き換えるのは `setFocus` 呼び出しの
  1行だけ）。既存の `SessionService.test.ts` の `describe("moveToTab", ...)`・
  `describe("moveToNewTab", ...)`（依拠する既存の事実、参照）のイベント列検証テストが
  無改修のまま通ることで確認する。
- AC7: `SessionModel.test.ts`（依拠する既存の事実、「`SessionModel.test.ts` の既存テスト
  構造」参照）・`SessionService.test.ts`（依拠する既存の事実、直後の
  `describe("moveToTab", ...)`/`describe("moveToNewTab", ...)`の箇条、参照）の既存テストが
  無改修のまま通ることで確認する。
