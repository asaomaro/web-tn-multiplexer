# タスク: 既読（wtm.seen.v1）の意味論を直す

## 実装方針

design.md の対象範囲の順に積む: 純関数 `sweepMarkSeen`（`store/seen.ts`。T1）を先に作り、
それを使う `main.ts` の配線（T2）と、独立した `TerminalPane.vue` の新しい発火点（T3）を
続ける。T2・T3 は互いにファイルが重ならず、どちらも T1 の `sweepMarkSeen`/既存の
`shouldMarkSeen` に依存するだけなので並行可。最後に回帰確認（T4）。

## 作業順序と依存関係

下の `依存:` に従う。T2・T3 は T1 の後、互いにファイルも重ならないため並行可。

## リスク / 留意点

- **`main.ts` は export を持たず単体テストできない**（design「依拠する既存の事実」F5）ため、
  T2（`main.ts` の配線）自体に新規の単体テストは書けない——AC の裏付けは T1 の
  `sweepMarkSeen` 単体テストと T3 の `TerminalPane.vue` テストが担う。T2 は既存の
  `smoke`（起動確認）で最低限の疎通だけ確認する。
- **`registry.isVisible` は `nextTick()` の後に読む**という `TerminalRegistry.ts` 自身の
  契約（design「設計方針」）を、T2 の配線で守ること。

## テスト方針

- `store/seen.test.ts`: `sweepMarkSeen` の単体テスト（表示中+フォーカスあり→既読になる、
  非表示→既読にならない、フォーカス無し→既読にならない、エージェントの無い pane は無視、
  複数 pane を渡したときそれぞれ独立に判定される）。AC1・AC2・AC4 の直接の検証。
- `TerminalPane.test.ts`: `onMounted` で、マウントした pane にエージェントがいて
  ウィンドウにフォーカスがあれば `seen.markSeen` が呼ばれること・フォーカスが無ければ
  呼ばれないこと・エージェントが無ければ呼ばれないことを確認する。AC3 の直接の検証。
- 全タスク完了後、既存の `seen.test.ts`（`shouldMarkSeen`・`displayStateFor`・`aggregate`
  等）・`TerminalPane.test.ts`（既存部分）・`NotificationController.test.ts` が無改修の
  まま通ることを確認する（T4。coding ではなく test 工程で最終確認する——このセッションの
  他 work と同じ扱い）。

## タスク

- [x] T1: `store/seen.ts` に `sweepMarkSeen` を追加する（既存の `shouldMarkSeen`・`markSeen`
      は無改修で呼ぶだけ）。`seen.test.ts` に単体テストを足す。
      対象: `packages/web/src/store/seen.ts:76-82`（`shouldMarkSeen` の直後に追加。
      precedent）・`seen.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      store/seen.ts」
      依存: なし
      AC: AC1, AC2, AC4

- [x] T2: `main.ts` の `markVisibleAgentsSeen` を `sweepMarkSeen` の呼び出しに差し替える
      （`nextTick()` の後で `registry.isVisible` を読む）。
      対象: `packages/web/src/main.ts:282-295` / 根拠: design.md「インターフェース /
      データ構造 > main.ts」「設計方針」
      依存: T1
      AC: なし

- [x] T3: `TerminalPane.vue` の `onMounted` に、マウントした pane のエージェントが既読条件
      （`shouldMarkSeen(true, document.hasFocus())`）を満たせば `seen.markSeen` を呼ぶ
      2文を追加する。`TerminalPane.test.ts` に確認テストを足す。
      対象: `packages/web/src/components/TerminalPane.vue:39-45`・`TerminalPane.test.ts` /
      根拠: design.md「インターフェース / データ構造 > TerminalPane.vue」
      依存: T1
      AC: AC3

- [x] T4: 既存の `seen.test.ts`・`TerminalPane.test.ts`・`NotificationController.test.ts`
      が全て無改修のまま通ることを確認する（回帰確認）。**coding ではなく test 工程で
      消化する**（このセッションの他 work と同じ扱い）。
      対象: `seen.test.ts`（既存部分）・`TerminalPane.test.ts`（既存部分）・
      `NotificationController.test.ts`（既存ファイルをそのまま実行するだけ。変更は
      しない） / 根拠: design.md「対象範囲」（変更しない、とされる既存の輸出群）
      依存: T2, T3
      AC: なし
