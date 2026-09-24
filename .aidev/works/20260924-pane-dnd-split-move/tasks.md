# タスク: D&D による pane の分割・分割解除

## 実装方針

design.md の層ごとに、下から上（protocol → LayoutTree → SessionModel → SessionService → RPC 登録
→ client アクション → PaneFrame.vue のゾーン判定・視覚フィードバック）の順で積む。各層は前の層の
テストが通ってから次に進む（`aidev-40-coding` の「1タスク=1つの検証可能な変更」）。ただし
`依存: なし` のタスク（T1・T2・T6・T7）は互いに他の層を待つ理由が無いので、この「積む順」は
着手順の推奨であって並行を禁じるものではない（下の「作業順序と依存関係」参照）。

`zoneAt`（ゾーン判定の純関数）は design.md の疑似コードでは `PaneFrame.vue` にインライン記述したが、
このリポジトリの既存の慣習（`workspaceOrder.ts`・`workspaceGrouping.ts`・`agentOrder.ts` 等、
純関数はコンポーネントから切り出して単体テストする）に合わせ、新規ファイル
`packages/web/src/term/paneDragZone.ts` に切り出す（design.md の**振る舞い**は変えない。
配置場所だけの実装判断——decisions.md に記録する）。

## 作業順序と依存関係

下の `依存:` に従う。並行できるのは `対象` が重ならないタスクだけ。`依存: なし` なのは
T1（protocol）・T2（LayoutTree）・T6（client store）・T7（`paneDragZone.ts`）の4つで、
互いにファイルも重ならないため並行可（T8 は `依存: T1` なので T1 と並行にはできない）。

## リスク / 留意点

- `LayoutTree.insertAtEdge` は既存の `split`/`remove`/`swap` を一切変更しない新規追加。既存の
  `LayoutTree.test.ts`（あれば）に新しい describe ブロックを足すだけで、既存テストは無改修。
- `replacePane`（`swap`+`remove`）は research.md F5 で机上検証済みだが、実装後に単体テストで
  必ず裏付ける（design.md「エラー処理」・research.md R2）。
- ゾーンのしきい値（30%。design.md）は「確立パターンに倣った推定値」。実装後に実際に触って
  極端に狭い/広いと感じたら調整可能な定数として1箇所にまとめる。

## テスト方針

- `LayoutTree.insertAtEdge`: 4方向 × 既存 pane が leaf 直下/深い位置にあるケースの単体テスト。
- `SessionModel.moveToEdge`/`replacePane`: 同一 tab 限定ガード・自分自身ガード・
  プロセス破棄（`replacePane`）を含む単体テスト。
- `SessionService`: イベント配布（`layout.updated`・`replacePane` は `pane.closed` 相当も）の単体テスト。
- RPC 統合テスト（`surface/methods/index.test.ts` 相当）で往復確認。
- client: `paneDragZone.test.ts`（純関数）・`view.test.ts`（`overZone` 追加分）・
  `ActionDispatcher.test.ts`（新アクション2つ）・`PaneFrame.test.ts`（ゾーンごとのドラッグ&ドロップ、
  視覚フィードバック、Esc/ダイアログでのキャンセルが新機能でも効くことの回帰確認）。
- 全タスク完了後、既存の pane 関連テスト全体（`LayoutTree`・`SessionModel`・`SessionService`・
  `PaneFrame`・`ActionDispatcher` の既存 describe）が無改修のまま通ることを確認する（AC11・AC-I3。
  coding ではなく test 工程で最終確認する——decisions.md に記録）。

## タスク

- [x] T1: protocol に `pane.move_to_edge`・`pane.replace` の RPC スキーマを追加する。
      対象: `packages/protocol/src/messages.ts:205-245`（`PaneSplitParams` 等の並び）・`:356-365`
      （`METHOD_SCHEMAS`）・`:402-411`（`MethodResultMap`） / 根拠: design.md「インターフェース /
      データ構造 > protocol」
      依存: なし
      AC: AC1, AC5, AC9

- [x] T2: `LayoutTree.ts` に `insertAtEdge`（4方向対応の新規純関数）を追加する。
      対象: `packages/server/src/session/LayoutTree.ts:29-76`（`split`/`remove`/`swap` の並び。
      新規関数として追加。既存3関数は変更しない） / 根拠: design.md「インターフェース /
      データ構造 > LayoutTree.ts」
      依存: なし
      AC: AC1, AC2, AC3, AC11

- [x] T3: `SessionModel` に `moveToEdge`・`replacePane` を追加する。
      対象: `packages/server/src/session/SessionModel.ts`（`swapPaneWith`:621-629・`closePane`
      が precedent。新規メソッド2つを追加） / 根拠: design.md「振る舞いの詳細 > サーバ側」
      依存: T2
      AC: AC1, AC2, AC5, AC6, AC7, AC9, AC11

- [x] T4: `SessionService` に `moveToEdge`・`replacePane` のハンドラを追加し、
      `layout.updated`（・`replacePane` は `pane.closed`/ズーム解除相当）を配布する。
      対象: `packages/server/src/session/SessionService.ts:450-549`（`splitPane`/`closePane`/
      `swapPaneWith` が precedent） / 根拠: design.md「振る舞いの詳細 > サーバ側」手順5〜7
      依存: T3
      AC: AC7, AC9, AC10, AC11

- [x] T5: `pane.move_to_edge`・`pane.replace` の RPC を `surface/methods/pane.ts` に登録する。
      対象: `packages/server/src/surface/methods/pane.ts:77`（`pane.swap_with` の登録箇所の並び）
      / 根拠: design.md「対象範囲」
      依存: T1, T4
      AC: AC1, AC5, AC9, AC10

- [x] T6: `view.ts` の `paneDrag` に `overZone` を追加し、`setPaneDragOver` をゾーン引数対応にする。
      対象: `packages/web/src/store/view.ts:214,336-348` / 根拠: design.md「クライアント状態」
      依存: なし
      AC: AC4, AC-I2

- [x] T7: ゾーン判定の純関数 `paneDragZone.ts`（`zoneAt`）を新規作成する。
      対象: `packages/web/src/term/paneDragZone.ts`（新規） / 根拠: design.md「クライアント側:
      ゾーン判定」（配置場所は本 tasks.md「実装方針」の判断。振る舞いは design.md のまま）
      依存: なし
      AC: AC4

- [x] T8: `ActionDispatcher` に `movePaneToEdge`・`replacePaneWithDrag` を追加する。
      対象: `packages/web/src/actions/ActionDispatcher.ts:534-536`（`swapPanesByDrag` が precedent）
      / 根拠: design.md「対象範囲」
      依存: T1
      AC: AC1, AC5, AC8, AC9

- [x] T9: `PaneFrame.vue` にゾーン判定の呼び出し・ゾーンごとの視覚フィードバック（CSS）・
      ドロップ確定時の新アクション呼び出しを組み込む。
      対象: `packages/web/src/components/PaneFrame.vue:71-168`（`onNamePointerMove`/
      `onNamePointerUp`/`isDropTarget`） / 根拠: design.md「クライアント側: ドロップ確定」
      「視覚フィードバック」
      依存: T6, T7, T8
      AC: AC1, AC4, AC5, AC8, AC9, AC-I1, AC-I2, AC-I4, AC-I5

- [x] T10: 既存の pane 関連テスト（`LayoutTree`・`SessionModel`・`SessionService`・`PaneFrame`・
      `ActionDispatcher`・RPC 統合テスト）が全て無改修のまま通ることを確認する（回帰確認）。
      **coding ではなく test 工程で消化する**（decisions.md に記録）。
      対象: `packages/server/src/session/LayoutTree.test.ts`・`SessionModel.test.ts`・
      `SessionService.test.ts`・`packages/web/src/components/PaneFrame.test.ts`・
      `ActionDispatcher.test.ts`・`packages/server/src/surface/methods/index.test.ts`
      （既存ファイルをそのまま実行するだけ。変更はしない）
      依存: T9
      AC: AC11, AC-I3
