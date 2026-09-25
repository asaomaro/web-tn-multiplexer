# 仕様: pane.replace の後継 focus ヒント

## 概要

`SessionModel.replacePane` は、削除される pane（`targetPaneId`）が tab のローカル focus
だったかどうかに関わらず、常にドラッグした pane（`paneId`）を後継にする。一方クライアント側
の `viewRepair.ts` は、`SessionModel.closePane` の既定規則（レイアウト木の最初の葉。DFS順）
しか知らない。この work では、`pane.closed` イベントに任意の後継ヒント
（`successorPaneId`）を追加し、`replacePane` だけがそれを埋めて発行する。クライアント側は
`repairView` がこのヒントを最優先で採用し、無ければ既存の DFS-first-leaf にフォールバック
する。`closePane`/`closeTab`/`closeWorkspace` は一切変更しない（`successorPaneId` は常に
`undefined` のまま発行される——JSON 上フィールド自体が現れず、ワイヤフォーマットは変更前と
同一）。

## 設計方針

- **`RemovalResult` に `successorPaneId?: PaneId` を追加し、`replacePane` だけが埋める**
  （research.md A2・A3）。`closePane`/`closeTab`/`closeWorkspace` の戻り値・内部ロジックは
  無変更——`successorPaneId` フィールドが存在しない（`undefined`）まま返るだけ。
  - 代替案（`replacePane` 専用の戻り値型を新設する）は退けた——`SessionService.ts` の4箇所の
    `pane.closed` 発行ループ（research.md F4）が同じ `RemovalResult` 型を前提にした共通の
    形をしており、型を分けると発行ループも分岐させる必要が生まれる。共通の optional
    フィールドにする方が変更が小さい。
- **`SessionService.ts` の4つの `pane.closed` 発行箇所を、`data: { paneId,
  successorPaneId: result.successorPaneId }` という同じ形に統一する**（research.md A4）。
  `replacePane` 以外の3箇所は `result.successorPaneId` が常に `undefined` なので、
  `JSON.stringify` がキー自体を落とし、ワイヤ上の見た目は変更前と同一（設計方針の
  「対象外」——`closePane`/`closeTab`/`closeWorkspace` にヒントを送らせる、という個別分岐は
  作らない。同じ1行のコードで自然にそうなる）。
- **`repairView` はヒントを第3引数（省略可）として受け取り、「今の tab の中で、今の
  focusedPaneId が消えていた」場合だけ、DFS-first-leaf より優先して採用する**
  （research.md A5）。別の tab へ移る分岐（`tab.id !== cur.tabId`。63-69行目の `else` 節）
  には適用しない——ヒントは「自分が今見ていた特定の pane の後継」を意味するもので、
  tab ごと切り替わる場面（自分の tab 自体が消えた等）には無関係なため。
  - 代替案（ヒントを `SessionLike` に含める）は退けた——`SessionLike` はセッション全体の
    スナップショット的な状態で、`pane.closed` という**1回のイベント**にだけ紐づく一時的な
    情報を混ぜると、呼び出し側が「いつ消すか」を管理する責務を追加で負う。引数として渡し
    切りにする方が単純。
- **`StoreAdapter.applyEvent` は、`pane.closed` を処理するその場でヒントをローカル変数に
  取り出し、同じ呼び出しの中で `applyViewRepair` へ渡すだけで使い捨てる**（research.md A6・
  「design への申し送り」）。フィールドとして保持しない——次の `applyEvent` 呼び出しには
  引き継がない（研究の注意点どおり、無関係な後続の repair に古いヒントが使われることを防ぐ）。

## 対象範囲

- `packages/protocol/src/events.ts`（`PaneClosedEvent.data`）
- `packages/server/src/session/SessionModel.ts`（`RemovalResult`・`replacePane`）
- `packages/server/src/session/SessionService.ts`（`pane.closed` を発行する4箇所）
- `packages/web/src/store/viewRepair.ts`（`repairView`）
- `packages/web/src/store/StoreAdapter.ts`（`applyEvent`・`applyViewRepair`）
- 上記の各既存テストファイル（`SessionModel.test.ts`・`SessionService.test.ts`・
  `viewRepair.test.ts`・`StoreAdapter.test.ts`）に確認テストを追加する。`StoreAdapter.test.ts`
  は AC6（`applyEvent` の配線）を直接確認する対象——`pane.closed`（`successorPaneId` 付き）を
  流したときに `applyViewRepair` 経由で正しい pane に focus が復帰することをテストする。

## 依拠する既存の事実

以下は research.md「判明した事実」F1〜F8・「実装アンカー」A1〜A6（`research.md` 参照）の
要約。個々の `file:line` の一次的な出所は research.md 側に記載済みで、ここでは design 上の
判断に必要な範囲だけを再掲する。

- `SessionModel.replacePane`（`packages/server/src/session/SessionModel.ts:762-786`）は、
  削除される pane が tab のローカル focus だったかに関わらず常に `paneId` を後継にし、
  `RemovalResult`（同56-62行目）には後継を運ぶフィールドが無い（research.md F1）。
- `SessionModel.closePane`（同317-336行目）は、削除された pane が tab のローカル focus
  だった場合だけレイアウト木の最初の葉を後継にする（research.md F2）。
- `viewRepair.ts` の `repairView`（`packages/web/src/store/viewRepair.ts:31-73`）は
  `SessionLike`/`ViewTarget` のみを引数に取り、個々のイベントのペイロードにアクセスできない
  （research.md F3）。
- `pane.closed` の発行元は `SessionService.ts` に4箇所（`closeWorkspace`:295行目・
  `closeTab`:433行目・`closePane`:488行目・`replacePane`:577行目）、いずれも同じ
  `RemovalResult` 型を経由する（research.md F4）。
- `PaneClosedEvent`（`packages/protocol/src/events.ts:74-77`）に後継フィールドは無い
  （research.md F5）。
- `StoreAdapter.applyEvent(e)`（`packages/web/src/store/StoreAdapter.ts:65-68`）は
  `applyEventToSession(e)` の直後に無条件で `applyViewRepair()`（引数無し）を呼ぶ
  （research.md F6）。
- `.aidev/works/20260924-pane-dnd-split-move/decisions.md` D5（90-119行目）がこの食い違いを
  review round1（cross-check）で発見し、「`pane.closed` に推奨後継のヒントを新設し
  `repairView` が優先する」という今回と同じ方向性を示唆していた（research.md F7）。
- `viewRepair.test.ts` は `session()`/`ws()`/`tab()`/`pane()` という素朴なファクトリ関数と
  `repairView(cur, s)` の直接呼び出しで構成され、イベントオブジェクト自体は模擬していない
  ——`repairView` へ引数を1つ増やす形の変更（この work の方針）と相性がよい構造になっている
  （research.md F8）。`packages/protocol/src/events.ts:74-77` の型変更自体
  （`PaneClosedEvent.data` への `successorPaneId?: string` 追加）は research.md A1 が示す
  実装アンカーで、上記「`PaneClosedEvent`」の箇条（F5）と対応する変更点である。

## インターフェース / データ構造

### `packages/protocol/src/events.ts`

```ts
export interface PaneClosedEvent {
  event: "pane.closed";
  data: { paneId: string; successorPaneId?: string };
}
```

### `packages/server/src/session/SessionModel.ts`

```ts
export interface RemovalResult {
  removedPaneIds: PaneId[];
  removedTabIds: TabId[];
  closedWorkspaceId: WorkspaceId | null;
  successorPaneId?: PaneId; // 20260925-pane-replace-focus-hint。replacePane だけが埋める。
}
```

`replacePane` の戻り値（既存の `return { removedPaneIds: [targetPaneId], removedTabIds: [],
closedWorkspaceId: null };` を変更）:

```ts
return { removedPaneIds: [targetPaneId], removedTabIds: [], closedWorkspaceId: null, successorPaneId: paneId };
```

`closePane`/`closeTab`/`closeWorkspace`（内部でそれぞれ `closeTabInternal`・
`closeWorkspaceInternal` を呼ぶが、公開 API としての単位はこの3つ。`SessionModel.ts:511,539`）
の戻り値は変更しない（`successorPaneId` を含めない——型上は optional なので、省略すれば
`undefined` になる）。

### `packages/server/src/session/SessionService.ts`

4箇所（`closeWorkspace`・`closeTab`・`closePane`・`replacePane`）の `pane.closed` 発行を、
次の形に統一する（各箇所の変数名 `paneId`/`pid` はそのまま）:

```ts
this.bus.publish({ event: "pane.closed", data: { paneId, successorPaneId: result.successorPaneId } });
```

### `packages/web/src/store/viewRepair.ts`

```ts
export function repairView(cur: ViewTarget, s: SessionLike, successorHint?: string): ViewTarget | null {
  // ...既存の workspace/tab 解決ロジックは変更なし...
  const live = liveLeaves(tab);
  let focusedPaneId: string;
  if (tab.id === cur.tabId) {
    if (cur.focusedPaneId && live.includes(cur.focusedPaneId)) {
      focusedPaneId = cur.focusedPaneId;
    } else if (successorHint && live.includes(successorHint)) {
      focusedPaneId = successorHint; // 20260925-pane-replace-focus-hint（AC4）
    } else {
      focusedPaneId = live[0]!; // 既存の DFS-first-leaf（AC5）
    }
  } else {
    focusedPaneId = live.includes(tab.focusedPaneId) ? tab.focusedPaneId : live[0]!;
  }
  // ...以降は変更なし...
}
```

### `packages/web/src/store/StoreAdapter.ts`

```ts
applyEvent(e: ServerEvent): void {
  this.applyEventToSession(e);
  this.applyViewRepair(e.event === "pane.closed" ? e.data.successorPaneId : undefined);
}

private applyViewRepair(successorHint?: string): void {
  const session = useSessionStore(this.opts.pinia);
  const view = useViewStore(this.opts.pinia);
  const dialogOpen = view.openDialog !== null;
  const focused = dialogOpen ? (view.preDialogFocusPaneId ?? view.focusedPaneId) : view.focusedPaneId;
  const next = repairView({ workspaceId: view.workspaceId, tabId: view.tabId, focusedPaneId: focused }, session, successorHint);
  // ...以降は変更なし...
}
```

## 振る舞いの詳細

- 通常の `closePane`/`closeTab`/`closeWorkspace`（`replacePane` 以外）による `pane.closed` は
  `successorPaneId` を含まない → `repairView` は `successorHint` に `undefined` を受け取り
  → 既存の DFS-first-leaf のまま（AC3・AC5・回帰なし）。
- `replacePane` による `pane.closed` は `successorPaneId: paneId`（ドラッグした pane）を
  含む → `StoreAdapter` がそれを取り出し `repairView` へ渡す → 「今の tab の中で、今の
  focusedPaneId（＝消えた `targetPaneId`）が消えていた」場合、`live.includes(successorHint)`
  （＝ `paneId` がまだ生きている。`replacePane` の性質上、常に生きている）が真になり、
  `successorHint` を採用する（AC2・AC4・AC6）。
- 自分がローカルで `targetPaneId` 以外の pane に focus していた場合（`replacePane` で消えて
  いない pane）は、`cur.focusedPaneId && live.includes(cur.focusedPaneId)` が真になり
  そのまま——ヒントの有無に関わらず変化しない（既存どおり）。
- 別の tab を見ていた場合（`tab.id !== cur.tabId`）は、ヒントを一切参照しない既存の分岐の
  ままで、この work による変更を受けない。

## ドメイン固有の考慮

- 該当なし（herdr との機能差ではなく、`20260924-pane-dnd-split-move` の review round1
  （cross-check）が発見した内部整合性の修正。上記「依拠する既存の事実」の decisions.md D5
  参照）。

## エラー処理 / 異常系

- 新しいエラー処理は追加しない。`successorHint` が指す pane が既に存在しない（理論上は
  起こらないはずだが、将来別の呼び出し元がヒントを付けて `replacePane` 以外の経路で
  `pane.closed` を発行するようになった場合の防御として）場合は、`live.includes(successorHint)`
  が偽になり、既存の DFS-first-leaf へ自然にフォールバックする（AC5）。

## 受け入れ基準との対応

- AC1: `PaneClosedEvent.data` に `successorPaneId?: string` を追加する（入力: 無し。型定義の
  追加のみ。インターフェース節「packages/protocol/src/events.ts」参照）。
- AC2: `SessionModel.replacePane` の戻り値に `successorPaneId: paneId` を追加する（入力:
  `replacePane` が受け取る `paneId`（ドラッグした pane。概要参照）。インターフェース節
  「packages/server/.../SessionModel.ts」参照）。
- AC3: `closePane`/`closeTab`/`closeWorkspace` の戻り値・`SessionService.ts` の対応する
  発行箇所は無変更（入力: 各操作の既存の `RemovalResult`。インターフェース節
  「packages/server/.../SessionService.ts」参照——`result.successorPaneId` が常に
  `undefined` になることで担保する）。
- AC4: `repairView` に `successorHint` 第3引数を追加し、`tab.id === cur.tabId` かつ
  `cur.focusedPaneId` が消えている場合に、`live.includes(successorHint)` なら最優先で
  採用する（入力: `StoreAdapter` が渡す `successorHint`。インターフェース節
  「packages/web/src/store/viewRepair.ts」参照）。
- AC5: 同じ分岐で `successorHint` が無い・生きていない場合は `live[0]!`（既存の
  DFS-first-leaf）にフォールバックする（インターフェース節、同上）。
- AC6: `StoreAdapter.applyEvent` が `pane.closed` イベントから `successorPaneId` を取り出し
  `applyViewRepair` へ渡す配線（インターフェース節「packages/web/src/store/StoreAdapter.ts」
  参照）と、AC2・AC4 の組み合わせにより、エンドツーエンドで実現される。
- AC7: 対象範囲に挙げた4つの既存テストファイル（`SessionModel.test.ts`・
  `SessionService.test.ts`・`viewRepair.test.ts`・`StoreAdapter.test.ts`）の既存テストが
  無改修のまま通ることで確認する（`successorPaneId`・`successorHint` はいずれも新規の
  optional パラメータ／フィールドで、既存の呼び出し・既存のアサーションには影響しない）。
