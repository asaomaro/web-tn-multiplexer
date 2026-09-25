# タスク: pane.replace の後継 focus ヒント

## 実装方針

design.md の対象範囲（5ファイル）を、依存の向き（protocol → server → web）に沿って積む。
`events.ts`（T1）と `SessionModel.ts`（T2）は互いに独立（`依存: なし`同士）で並行可。
`SessionService.ts`（T3）は T1（protocol の型）・T2（`RemovalResult.successorPaneId`）の
両方に依存する。`viewRepair.ts`（T4）は純粋にクライアント側のロジック（文字列のヒントを
受け取るだけ）で T1〜T3 に依存しない。`StoreAdapter.ts`（T5）は T1（`PaneClosedEvent.data`
の型）・T4（`repairView` の新しいシグネチャ）に依存する。最後に4ファイルの回帰確認。

## 作業順序と依存関係

下の `依存:` に従う。T1・T2・T4 は最初のウェーブ（並行可。ファイルが重ならない）。
T1・T2 が終われば T3 が、T1・T4 が終われば T5 が着手できる（T3・T5 もファイルが重ならず
並行可）。全て終わってから T6。

## リスク / 留意点

- **`closePane`/`closeTab`/`closeWorkspace` 側の `RemovalResult` の中身（挙動）を変えない
  こと**（design「設計方針」「対象外」）。T3 で `SessionService.ts` の4つの発行箇所の
  **コードの形**は統一する（`data: { paneId, successorPaneId: result.successorPaneId }`）が、
  `closePane`/`closeTab`/`closeWorkspace` 側の `result.successorPaneId` は
  `RemovalResult.successorPaneId` を明示的に設定しない（T2 の対象は `replacePane` の
  戻り値だけ）ことで常に `undefined` になり、結果として発行される JSON は変更前と同一
  になる——**変えないのは発行される値であって、発行するコード行ではない**。
- **`repairView` のヒント優先は `tab.id === cur.tabId` の分岐（64-66行目）だけに適用する
  こと**（design「設計方針」）。別の tab へ移る分岐（67-69行目の `else` 節）は**読んで
  区別するだけ**で、その分岐のロジック自体（`live.includes(tab.focusedPaneId) ?
  tab.focusedPaneId : live[0]!`）は変更しない。
- **`StoreAdapter` のヒントは使い捨てにすること**（design「設計方針」）。`applyEvent` の
  ローカル変数として渡すだけで、フィールドとして保持しない。

## テスト方針

- `AC1`（`PaneClosedEvent.data` の型拡張）はそれ自体が振る舞いを持たない型レベルの変更
  （requirements.md 参照）なので、専用のテストは立てない。`npx tsc --noEmit` が通ることと、
  T3・T5 がこの型（`successorPaneId?: string`）を実際に消費するコードを書けることで
  間接的に確認する。
- `SessionModel.test.ts`: `replacePane` が返す `RemovalResult.successorPaneId` が
  ドラッグした pane（`paneId`）であること（AC2）。既存の `closePane`/`closeTab`/
  `closeWorkspace` のテストが無改修のまま通ること（回帰）。
- `SessionService.test.ts`: `replacePane` が発行する `pane.closed` の `data` に
  `successorPaneId` が含まれること（AC2 の、サーバの応答フレームまで届くことの配線確認。
  `RemovalResult` の値自体の正しさは `SessionModel.test.ts` が担う）。`closePane`/
  `closeTab`/`closeWorkspace` が発行する `pane.closed` に `successorPaneId` が含まれない
  （既存のイベント列検証テストが無改修のまま通ることで確認。AC3）。
- `viewRepair.test.ts`: decisions.md D5 が記録した再現ケース（レイアウトが
  `{a: p2, b: paneId}` になり、DFS順だと `p2` が選ばれてしまう）で、`successorHint` に
  `paneId` を渡すと `paneId` が選ばれること（AC4）。ヒントが無い・ヒントの指す pane が
  存在しない場合は既存の DFS-first-leaf のまま（AC5・既存テストが無改修のまま通ることで
  確認）。別の tab へ移る分岐ではヒントが無視されること。
- `StoreAdapter.test.ts`: `pane.closed`（`successorPaneId` 付き）を `applyEvent` に流すと、
  `repairView` 経由で正しい pane に focus が復帰すること（AC6）。
- 全タスク完了後、`SessionModel.test.ts`・`SessionService.test.ts`・`viewRepair.test.ts`・
  `StoreAdapter.test.ts` の既存テストが無改修のまま通ることを確認する（T6。coding では
  なく test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `packages/protocol/src/events.ts` の `PaneClosedEvent.data` に
      `successorPaneId?: string` を追加する。
      対象: `packages/protocol/src/events.ts:74-77` / 根拠: design.md「インターフェース /
      データ構造 > packages/protocol/src/events.ts」
      依存: なし
      AC: AC1

- [x] T2: `SessionModel.ts` の `RemovalResult` に `successorPaneId?: PaneId` を追加し、
      `replacePane` の戻り値に含める。`SessionModel.test.ts` に確認テストを足す。
      対象: `packages/server/src/session/SessionModel.ts:56-62,784`・
      `SessionModel.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      packages/server/src/session/SessionModel.ts」
      依存: なし
      AC: AC2

- [x] T3: `SessionService.ts` の4つの `pane.closed` 発行箇所を
      `data: { paneId, successorPaneId: result.successorPaneId }` の形に統一する。
      `SessionService.test.ts` に確認テストを足す。
      対象: `packages/server/src/session/SessionService.ts:295,433,488,577`・
      `SessionService.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      packages/server/src/session/SessionService.ts」
      依存: T1, T2
      AC: AC2, AC3

- [x] T4: `viewRepair.ts` の `repairView` に `successorHint`（第3引数・省略可）を追加し、
      `tab.id === cur.tabId` の分岐（64-66行目）で最優先採用する。67-69行目の `else` 節
      （別の tab へ移る場合）はロジックを変更しないが、ヒントを適用しないことを確認する
      テストの対象として読む。`viewRepair.test.ts` に確認テストを足す。
      対象: `packages/web/src/store/viewRepair.ts:31,64-66`（変更）・`:67-69`（無変更の
      確認対象）・`viewRepair.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      packages/web/src/store/viewRepair.ts」
      依存: なし
      AC: AC4, AC5

- [x] T5: `StoreAdapter.ts` の `applyEvent`/`applyViewRepair` に、`pane.closed` の
      `successorPaneId` を取り出して受け渡す配線を追加する。`StoreAdapter.test.ts` に
      確認テストを足す。
      対象: `packages/web/src/store/StoreAdapter.ts:65-87`・`StoreAdapter.test.ts` / 根拠:
      design.md「インターフェース / データ構造 > packages/web/src/store/StoreAdapter.ts」
      依存: T1, T4
      AC: AC6

- [x] T6: `SessionModel.test.ts`・`SessionService.test.ts`・`viewRepair.test.ts`・
      `StoreAdapter.test.ts` が全て無改修のまま通ることを確認する（回帰確認）。
      **coding ではなく test 工程で消化する**（このセッションの他 work と同じ扱い）。
      対象: 上記4ファイル（既存部分を変更せず実行するだけ） / 根拠: design.md「対象範囲」
      依存: T1, T2, T3, T4, T5
      AC: AC7
