# タスク: D&D による pane の別 tab・別 workspace への移動

## 実装方針

design.md の層ごとに、下から上（protocol → SessionModel → SessionService → RPC 登録 →
client store → client の DOM マーカー・視覚フィードバック → client アクション →
PaneFrame.vue のドロップ先拡張）の順で積む。`依存: なし` のタスク（T1・T2・T5）は互いに
ファイルが重ならないため並行可（`20260924-pane-dnd-split-move` の tasks.md と同じ考え方）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T2・T5 は `依存: なし` で互いにファイルも重ならないため並行可。

## リスク / 留意点

- **`closeEmptyTabShell` を `closeTabInternal` の代わりに正しく使うこと**（design「サーバ側:
  SessionModel」・research.md R1。最重要の落とし穴——誤ると移動中の pane 自体を消してしまう）。
- `targetTabId`/`targetWorkspaceId`（ドロップ先。未検証の値）は `requireTab`/`requireWorkspace`
  ではなく `.get()` ＋ null チェックで扱う（design「振る舞いの詳細」で修正済みの設計）。
- `Sidebar.vue` の新しい `data-drop-workspace-id` は、`row.workspace` が非 null の行にだけ
  付ける（手動グループのヘッダー行は対象外。research.md F10・R2）。

## テスト方針

- `SessionModel.moveToTab`/`moveToNewTab`/`closeEmptyTabShell`: 正常系・自分自身/存在しない
  対象へのガード・移動元 tab が空になるケース（自動的に閉じる）・zoom 解除・focus の後継選択の
  単体テスト。
- `SessionService`: イベント配布（`layout.updated`・`tab.created`・`tab.closed`・
  `workspace.updated`・`workspace.closed`）の単体テスト。
- client: `view.test.ts`（`overTabId`/`overWorkspaceId` 追加分）・`TabBar.test.ts`・
  `Sidebar.test.ts`（新しい drop-target 表示）・`ActionDispatcher.test.ts`（新アクション2つ）・
  `PaneFrame.test.ts`（3種のドロップ先の振り分け、既存の同一 tab 内操作の回帰確認）。
- 全タスク完了後、既存の pane/tab/workspace 関連テスト全体が無改修のまま通ることを確認する
  （AC11・AC-I3・AC-I5。coding ではなく test 工程で最終確認する——`20260924-pane-dnd-split-move`
  の decisions.md D3 と同じ扱い）。

## タスク

- [x] T1: protocol に `pane.move_to_tab`・`pane.move_to_new_tab` の RPC スキーマを追加する。
      対象: `packages/protocol/src/messages.ts`（`PaneMoveToEdgeParams`/`PaneReplaceParams` の
      並び・`METHOD_SCHEMAS`・`MethodResultMap`） / 根拠: design.md「インターフェース /
      データ構造 > protocol」
      依存: なし
      AC: AC1, AC5, AC9

- [x] T2: `SessionModel` に `closeEmptyTabShell`（private）・`moveToTab`・`moveToNewTab` を
      追加する。
      対象: `packages/server/src/session/SessionModel.ts`（`closeTabInternal`:511-531・
      `reserveTab`/`commitTab`:240-269・`moveToEdge`/`replacePane`〔20260924-pane-dnd-split-move〕
      が precedent） / 根拠: design.md「インターフェース / データ構造 > サーバ側」
      「振る舞いの詳細」
      依存: なし
      AC: AC1, AC2, AC3, AC5, AC6, AC8, AC9

- [x] T3: `SessionService` に `moveToTab`・`moveToNewTab` のハンドラを追加し、
      `layout.updated`・`tab.created`・`tab.closed`・`workspace.updated`・`workspace.closed`
      を適切に配布する。
      対象: `packages/server/src/session/SessionService.ts`（`splitPane`/`closePane`/
      `moveToEdge`/`replacePane` が precedent） / 根拠: design.md「振る舞いの詳細 >
      複数クライアントでの同期」
      依存: T2
      AC: AC8, AC9, AC10

- [x] T4: `pane.move_to_tab`・`pane.move_to_new_tab` の RPC を `surface/methods/pane.ts` に
      登録する（`SessionModel.moveToNewTab` の `{tab}|null` → `PaneMoveToNewTabResult` の
      `{ok, tab?}` への変換もここで行う）。
      対象: `packages/server/src/surface/methods/pane.ts`（`pane.move_to_edge`/`pane.replace`
      の登録箇所の並び） / 根拠: design.md「対象範囲」「インターフェース / データ構造」
      依存: T1, T3
      AC: AC1, AC5, AC9, AC10

- [x] T5: `view.ts` の `paneDrag` に `overTabId`・`overWorkspaceId` を追加する。
      対象: `packages/web/src/store/view.ts`（`paneDrag`/`setPaneDragOver` が precedent。
      `20260924-pane-dnd-split-move` で `overZone` を追加したのと同じ拡張） / 根拠: design.md
      「クライアント側: ドロップ先の拡張」
      依存: なし
      AC: AC4, AC7

- [x] T6: `TabBar.vue` の各 tab に `data-tab-id` を追加し、`view.paneDrag?.overTabId` に
      応じたドロップ候補のハイライト表示を追加する。
      対象: `packages/web/src/components/TabBar.vue:140-156` / 根拠: design.md「クライアント側:
      ドロップ先の拡張」（視覚的フィードバック）
      依存: T5
      AC: AC4

- [x] T7: `Sidebar.vue` の各行（`row.workspace` が非 null のものだけ）に
      `data-drop-workspace-id` を追加し、`view.paneDrag?.overWorkspaceId` に応じたドロップ
      候補のハイライト表示を追加する。
      対象: `packages/web/src/components/Sidebar.vue`（`data-workspace-row-key` の並び。
      `workspaceRow()` 関数付近——正確な位置は coding で確認。research.md F10 では未確認
      だった箇所） / 根拠: design.md「クライアント側: ドロップ先の拡張」
      依存: T5
      AC: AC7

- [x] T8: `ActionDispatcher` に `movePaneToTab`・`movePaneToNewTab` を追加する。
      対象: `packages/web/src/actions/ActionDispatcher.ts`（`movePaneToEdge`/
      `replacePaneWithDrag` が precedent） / 根拠: design.md「対象範囲」
      依存: T1
      AC: AC1, AC5, AC8, AC9

- [x] T9: `PaneFrame.vue` の `dropTargetAt` を拡張し、`[data-pane-id]`→`[data-tab-id]`→
      `[data-drop-workspace-id]` の優先順位でドロップ先を探し、`onNamePointerMove`/
      `onNamePointerUp` で種別ごとに処理を振り分ける（tab/workspace 種別では確定後に
      `view.setView` で表示を切り替える）。
      対象: `packages/web/src/components/PaneFrame.vue`（`dropTargetAt`/`onNamePointerMove`/
      `onNamePointerUp`。`20260924-pane-dnd-split-move` で確立した形の拡張） / 根拠: design.md
      「クライアント側: ドロップ先の拡張」
      依存: T6, T7, T8
      AC: AC1, AC4, AC5, AC7, AC8, AC9, AC-I1, AC-I2, AC-I4, AC-I5

- [ ] T10: 既存の pane/tab/workspace 関連テスト（`SessionModel`・`SessionService`・
      `TabBar`・`Sidebar`・`PaneFrame`・`ActionDispatcher`・RPC 統合テスト）が全て無改修のまま
      通ることを確認する（回帰確認）。**coding ではなく test 工程で消化する**
      （`20260924-pane-dnd-split-move` の decisions.md D3 と同じ扱い）。
      対象: `packages/server/src/session/SessionModel.test.ts`・`SessionService.test.ts`・
      `packages/web/src/components/TabBar.test.ts`・`Sidebar.test.ts`・`PaneFrame.test.ts`・
      `ActionDispatcher.test.ts`・`packages/server/src/surface/methods/index.test.ts`
      （既存ファイルをそのまま実行するだけ。変更はしない）
      依存: T9
      AC: AC11, AC-I3, AC-I5
