# 調査: pane.replace の後継 focus ヒント

## 調査の問い

- Q1: `viewRepair.ts` の DFS-first-leaf 規則と `SessionModel.replacePane` の「後継は必ず
  ドラッグした pane」規則の食い違いは、実際にどこでどう起きるか。
- Q2: `pane.closed` イベントに後継ヒントを追加する場合、影響を受ける発行元（`SessionService`）
  は何箇所あるか、既存の3箇所（`closePane`/`closeTab`/`closeWorkspace`）に副作用を与えずに
  `replacePane` だけへ追加できるか。
- Q3: クライアント側で、この後継ヒントを `repairView` 呼び出しまで届けるには、どこを配線
  すればよいか。

## 判明した事実

- F1: `SessionModel.replacePane`（`packages/server/src/session/SessionModel.ts:762-786`）は、
  削除される pane（`targetPaneId`）が tab のローカル focus だったかどうかに関わらず、
  常に `this.setFocus(tab.workspaceId, tab.id, paneId)` を呼び、戻り値
  `{ removedPaneIds: [targetPaneId], removedTabIds: [], closedWorkspaceId: null }`
  （`RemovalResult`。同ファイル56-62行目で定義）を返す。`RemovalResult` に後継の pane を
  運ぶフィールドは無い。
- F2: `SessionModel.closePane`（同317-336行目）は、削除された pane が tab のローカル focus
  だった場合だけ `Layout.leaves(newLayout)[0]`（新レイアウトの最初の葉。DFS順）を後継にする。
  それ以外は `tab.focusedPaneId` を変えない。戻り値の型は `replacePane` と同じ `RemovalResult`。
- F3: `viewRepair.ts`（`packages/web/src/store/viewRepair.ts`）の `repairView`（31-73行目）は、
  `SessionLike`（`workspaces`/`tabs`/`panes` の Map）と `ViewTarget`（現在の
  workspaceId/tabId/focusedPaneId）だけを引数に取り、個々のイベントのペイロードにはアクセス
  できない。同じ tab の中で「今の pane が生きていればそのまま、消えていたら最初の葉」という
  規則（66行目 `focusedPaneId = cur.focusedPaneId && live.includes(cur.focusedPaneId) ?
  cur.focusedPaneId : live[0]!`）が、F2（`closePane`）の既定と一致する形で実装されている
  （コメント21-24行目に明記）。`replacePane` 固有の規則（F1）は反映されていない。
- F4: `pane.closed` を発行している箇所は `SessionService.ts` に4つ:
  `closeWorkspace`（295行目）・`closeTab`（433行目）・`closePane`（488行目）・
  `replacePane`（577行目）。いずれも同じ形 `{ event: "pane.closed", data: { paneId } }`
  （変数名は `paneId`/`pid` と揺れるが同じ）で、`result.removedPaneIds` をループして発行する。
  `RemovalResult` は4箇所とも共通の型。
- F5: `PaneClosedEvent`（`packages/protocol/src/events.ts:74-77`）は
  `{ event: "pane.closed"; data: { paneId: string } }`。後継フィールドは無い。
- F6: `StoreAdapter.applyEvent(e)`（`packages/web/src/store/StoreAdapter.ts:65-68`）は
  `applyEventToSession(e)` を呼んだ**直後**に、無条件で `applyViewRepair()` を呼ぶ
  （引数無し）。`pane.closed` はこの中の `applyEventToSession` 内の switch 文
  （123-126行目付近）で `session.paneClosed(e.data.paneId)` を呼ぶだけで、`e` 自体は
  `applyViewRepair()` には渡らない。`applyViewRepair()`（76-87行目）は
  `useViewStore(...).focusedPaneId`（またはダイアログを開いていれば
  `preDialogFocusPaneId`）を `repairView` の `cur.focusedPaneId` として渡す。
- F7: `.aidev/works/20260924-pane-dnd-split-move/decisions.md` D5（90-119行目）が、この
  食い違いを review round1（cross-check）で発見していた。実害は「ドラッグを行った本人の
  クライアントには影響しない（`PaneFrame.vue` が `view.focusPane(props.paneId)` を明示的に
  呼ぶため）。同じ tab を見ている**別のクライアント**が、たまたまローカルで `targetPaneId`
  （消える側）へ focus していた場合のみ」と明記されている。D5 自身が「正しく直すには
  `pane.closed`（または `layout.updated`）イベントに推奨後継のヒントを新設し、`repairView`
  がそれを最初の葉より優先する形にする必要がある」と、今回の設計方針と同じ方向性を示唆
  している。
- F8: `viewRepair.test.ts`（`packages/web/src/store/viewRepair.test.ts`）は `session()`/
  `ws()`/`tab()`/`pane()` の素朴なファクトリ関数と `repairView(cur, s)` の直接呼び出しで
  構成されており、イベントオブジェクトそのものを模擬してはいない（`repairView` の引数を
  増やす形の変更と親和性が高い）。

## 影響範囲

- `packages/protocol/src/events.ts`（`PaneClosedEvent.data` の型）
- `packages/server/src/session/SessionModel.ts`（`RemovalResult` 型・`replacePane` の戻り値）
- `packages/server/src/session/SessionService.ts`（`pane.closed` を発行する4箇所。ただし
  `replacePane` 以外の3箇所は「新フィールドを付けない」という既存どおりの挙動を保つだけ）
- `packages/web/src/store/viewRepair.ts`（`repairView` のシグネチャ・66行目の分岐）
- `packages/web/src/store/StoreAdapter.ts`（`applyEvent`/`applyViewRepair` の配線）
- 上記5ファイルそれぞれの既存テスト（`SessionModel.test.ts`・`SessionService.test.ts`・
  `viewRepair.test.ts`）

`packages/cli`（wtmctl）・`packages/e2e` に `pane.closed`/`successorPaneId` 相当への依存は
無い（`grep -rn "pane.closed"` で確認——イベントを型として扱うだけで、フィールドの有無を
判定する分岐は無い）。

## 実現性 / リスク

- 技術的に実現可能。`successorPaneId` を optional フィールドとして追加するだけなので、
  JSON 上は値が `undefined` のとき `JSON.stringify` がキー自体を落とす——`closePane`/
  `closeTab`/`closeWorkspace` の発行するフレームは変更前と1バイトも変わらない。
- `RemovalResult` を共有する4つの発行元のうち3つ（`closePane`/`closeTab`/`closeWorkspace`）
  では常に `undefined` になる設計（`replacePane` の `SessionModel` 側だけがフィールドを
  埋める）にすれば、既存の3経路のロジックには一切触れずに済む。
- `repairView` はテストが `repairView(cur, s)` という2引数の直接呼び出しに大きく依存して
  いる（F8）ため、3引数目を**省略可能**にすれば既存テストは無改修のまま通る。

## 実装アンカー

- A1: `pane.closed` イベント型の拡張（`packages/protocol/src/events.ts:74-77`）
  ——`PaneClosedEvent.data` に `successorPaneId?: string` を追加。
- A2: `RemovalResult` 型の拡張（`packages/server/src/session/SessionModel.ts:56-62`）
  ——`successorPaneId?: PaneId` を追加。
- A3: `replacePane` の戻り値（`SessionModel.ts:784`）——
  `{ removedPaneIds: [targetPaneId], removedTabIds: [], closedWorkspaceId: null,
  successorPaneId: paneId }` に変更。
- A4: `SessionService.ts` の4つの `pane.closed` 発行箇所（295, 433, 488, 577行目）——
  `data: { paneId, successorPaneId: result.successorPaneId }` に統一する（`replacePane`
  以外は `result.successorPaneId` が常に `undefined` になるので実質無改修）。
- A5: `viewRepair.ts` の `repairView` シグネチャ（31行目）と66行目の分岐——
  第3引数（省略可）としてヒントを受け取り、`live.includes(hint)` なら最優先で採用する
  分岐を追加。
- A6: `StoreAdapter.ts` の `applyEvent`（65-68行目）・`applyViewRepair`（76-87行目）——
  `pane.closed` を処理する際にヒントを取り出し、`applyViewRepair` への引数として渡す配線。

## 実装時の注意

- `RemovalResult` を返す `closePane`/`closeTab`（内部的に `closeTabInternal`）/
  `closeWorkspace`（内部的に `closeWorkspaceInternal`）・`mergeRemoval` は、`successorPaneId`
  を明示的に設定しない（`undefined` のまま）。`mergeRemoval`（`SessionModel.ts:567-`）が
  複数の `RemovalResult` を合成する箇所があるので、そこで誤って `successorPaneId` を
  合成対象に含めないよう注意する（`replacePane` は `mergeRemoval` を使わない単独の戻り値
  なので、直接は影響しないはずだが、型定義を触るときに見落とさないこと）。
- `repairView` が受け取るヒントは、そのイベント（`pane.closed`）にちょうど対応する
  タイミングでだけ有効であるべき——`StoreAdapter` 側で「ヒントを一度使ったら破棄する」
  設計にしないと、無関係な後続の `repairView` 呼び出し（別の pane が消えたとき等）に
  古いヒントが誤って使われる。

## design への申し送り

- フィールド名は `successorPaneId`（仮）で design にて確定する。
- `repairView` のシグネチャ変更（第3引数の追加）の具体的な型・呼び出し規約は design で
  確定する。
- `StoreAdapter` 側でヒントを「その1回の `applyEvent` 呼び出し限り」で使い捨てにする設計
  （例: `applyEvent` 内のローカル変数として保持し、`applyViewRepair` へ直接渡す。フィールド
  として永続化しない）を design で明記する。
