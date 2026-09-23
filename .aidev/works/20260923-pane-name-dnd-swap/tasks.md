# タスク: pane 名の legend 表示とドラッグでの入れ替え

## 実装方針

design.md の層に沿って、サーバ側（protocol型→model→service→RPC）とクライアント側
（view の状態→見た目→ドラッグ発火→ActionDispatcher）を積む。見た目（T5）はサーバ側と独立に
並行できる。

## 作業順序と依存関係

T1・T4・T5 は互いに対象ファイルが重ならず、T1 にしか依存しないため並行できる。T6・T7 は
T1（RPC名）・T4（paneDrag状態）が揃ってから。T2・T3 はサーバ側を直列に積む。

## リスク / 留意点

- `.pane-frame-name` の `pointer-events` を `none→auto` に変える影響範囲（既存のクリックで
  枠を選ぶ動作・右クリックメニュー）を壊さないこと（design「エラー処理」・AC-I5）。
- `document.elementFromPoint` はテスト環境（happy-dom）でモックが要る（T6 のテスト方針）。

## テスト方針

- サーバ側（`swapPaneWith`）は `SessionModel.test.ts`/`SessionService.test.ts` に既存の
  `swapPane` のテストと同じ形で追加する。
- クライアント側のドラッグロジックは `document.elementFromPoint` を `vi.spyOn` で差し替えて
  ユニットテストする（`PaneFrame.test.ts`）。E2E は対象外（[[e2e-only-on-request]]）。

## タスク

- [x] T1: protocol に `pane.swap_with` の型・RPC を追加する（`PaneSwapWithParams`・
      `PaneSwapWithResult`・`METHOD_SCHEMAS`・`MethodResultMap`）
      対象: `packages/protocol/src/messages.ts` / 根拠: design「インターフェース」2.
      依存: なし
      AC: AC4, AC6, AC7

- [x] T2: `SessionModel.swapPaneWith(paneId, otherPaneId)` を実装する（同一 tab・別 pane の
      ときだけ `Layout.swap` を適用し true、それ以外は false）
      対象: `packages/server/src/session/SessionModel.ts:424-432` の隣（`swapPane` の直後）
      依存: なし
      AC: AC4, AC5, AC6

- [x] T3: `SessionService.swapPaneWith` と RPC ハンドラ `pane.swap_with` を実装する
      （`layout.updated` の publish・`persist.touch()`。`swapPane` と同じ形）
      対象: `packages/server/src/session/SessionService.ts:439-445` の隣、
      `packages/server/src/surface/methods/pane.ts`
      依存: T1, T2
      AC: AC4, AC7

- [x] T4: `store/view.ts` に `paneDrag` 状態（`startPaneDrag`/`setPaneDragOver`/`endPaneDrag`）を
      追加する
      対象: `packages/web/src/store/view.ts:179-287` の隣（`contextMenu` と同じ並び）
      依存: なし
      AC: AC-I1, AC-I2, AC-I4

- [x] T5: `PaneFrame.vue` の見た目を legend 風に変更する（`showBorder`・
      `.pane-frame-edge-named`・フォーカス中/無しの配色・`data-pane-id`）
      対象: `packages/web/src/components/PaneFrame.vue`（テンプレート・`<style scoped>`）
      依存: なし
      AC: AC1, AC2, AC3

- [x] T6: `PaneFrame.vue` にドラッグの発火ロジックを実装する（閾値判定・
      `document.elementFromPoint` によるドロップ先判定・Esc での取り消し・
      閾値未満はクリックとして扱う）
      対象: `packages/web/src/components/PaneFrame.vue`（`<script setup>`）
      依存: T4, T5
      AC: AC-I1, AC-I2, AC-I3, AC-I5

- [x] T7: `ActionDispatcher.swapPanesByDrag(paneId, otherPaneId)` を実装し、T6 から呼ぶ
      対象: `packages/web/src/actions/ActionDispatcher.ts`
      依存: T1, T6
      AC: AC4, AC-I3

- [x] T8: ドキュメントを反映する（`docs/herdr-parity.md` H41 行への追記。
      `.aidev/backlog/product-roadmap.md` の該当行の分割は deliver 工程で行う。
      decisions.md D13 と同じ扱い）
      対象: `docs/herdr-parity.md`
      依存: T3, T7
      AC: なし
