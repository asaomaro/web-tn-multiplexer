# タスク: レイアウト操作後のグローバル focus の更新

## 実装方針

design.md の**実装対象**（変更するプロダクションコード）は `SessionModel.ts` 1ファイル
（5メソッド）に閉じているため、リスクの性質でタスクを分ける: (1) 単純な追加のみで済む
`swapPaneWith`/`moveToEdge`、(2) 既存の条件付き呼び出しを置き換える `replacePane`、
(3) `closeEmptyTabShell` との呼び出し順の入れ替えを伴う `moveToTab`/`moveToNewTab`
（最もリスクが高い）、の順に積む。最後に回帰確認（対象は実装対象より広く、
`SessionModel.test.ts` に加え `SessionService.test.ts` も含む——下記「作業順序と依存関係」
参照）。

## 作業順序と依存関係

T1〜T3 は同じファイル（`SessionModel.ts`・`SessionModel.test.ts`）に触れるため、
`依存:` を明記しなくても（`依存: なし`のままでも）実質的に直列で進める（同一ファイルへの
並行編集は行わない）。T4（回帰確認）は T1〜T3 の実装が全て揃っていることを前提とする
（`SessionService.test.ts` は T1〜T3 のどの変更の影響も受けうるため、部分的な完了では
確認できない）——これは「同一ファイルだから直列」という T1〜T3 間の関係とは別の、
論理的な前提条件なので `依存: T1, T2, T3` と明記する。

## リスク / 留意点

- **`moveToTab`/`moveToNewTab` の `setFocus` 呼び出しは、必ず `closeEmptyTabShell` の
  呼び出しの後に置くこと**（design「設計方針」「依拠する既存の事実」）。先に置くと
  `moveToNewTab` の既存のバグ（移動先の focus が移動元 workspace 側の救済で上書きされる）を
  再現してしまう。
- **`tab.focusedPaneId`・`workspace.activeTabId` を書き込む既存の行には一切触れないこと**
  （design「設計方針」）。追加・置き換えるのは `this.setFocus(...)` 呼び出しの1行だけ。

## テスト方針

- `SessionModel.test.ts`: 各操作の成功後、`model.getFocus()` が期待する
  workspace/tab/pane を指すことを確認する（AC1〜AC5）。`moveToNewTab` は cross-workspace
  かつ移動元 tab が移動元 workspace の `activeTabId` だった場合に `closeEmptyTabShell` が
  発火する組み合わせを直接再現し、最終的な `getFocus()` が移動先を指すことを確認する
  （AC5。design「依拠する既存の事実」の実機確認どおりの再現）。既存の失敗系テスト
  （自分自身・別 tab 等）が `getFocus()` に触れず無改修のまま通ることも確認する（回帰）。
- `SessionService.test.ts`（AC6: `moveToTab`/`moveToNewTab` のイベント列検証テストが
  無改修のまま通ることで、配布イベント・`tab.focusedPaneId`・`workspace.activeTabId` に
  影響が無いことを確認する）・`SessionModel.test.ts`（AC7: T1〜T3 で確認テストを足した
  以外の既存テストが無改修のまま通ることを確認する）は、全タスク完了後に確認する
  （T4。coding ではなく test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `swapPaneWith`・`moveToEdge` の成功時に `this.setFocus(tab.workspaceId, tab.id,
      paneId)` を追加する。`SessionModel.test.ts` の対応する describe に確認テストを足す。
      対象: `packages/server/src/session/SessionModel.ts:713-742`・`SessionModel.test.ts`
      （153-268行目の describe） / 根拠: design.md「インターフェース / データ構造 >
      swapPaneWith・moveToEdge」
      依存: なし
      AC: AC1, AC2

- [x] T2: `replacePane` の条件付き `setFocus` 呼び出し（769行目）を、無条件の
      `this.setFocus(tab.workspaceId, tab.id, paneId)` に置き換える。
      `SessionModel.test.ts` の対応する describe に確認テストを足す。
      対象: `packages/server/src/session/SessionModel.ts:750-771`・`SessionModel.test.ts`
      （271行目以降の describe） / 根拠: design.md「インターフェース / データ構造 >
      replacePane」
      依存: なし
      AC: AC3

- [x] T3: `moveToTab`・`moveToNewTab` の末尾（`closeEmptyTabShell` 呼び出しの後）に
      `this.setFocus(...)` を追加する（`moveToNewTab` は既存の656行目の呼び出しを
      削除してから、末尾に移動する）。`SessionModel.test.ts` の対応する describe に
      確認テストを足す（`moveToNewTab` は cross-workspace かつ移動元 tab が
      `closeEmptyTabShell` で閉じるケースを含む）。
      対象: `packages/server/src/session/SessionModel.ts:609-665`・`SessionModel.test.ts`
      （352行目以降・422行目以降の describe） / 根拠: design.md「インターフェース /
      データ構造 > moveToTab・moveToNewTab」
      依存: なし
      AC: AC4, AC5

- [x] T4: `SessionService.test.ts`（`moveToTab`/`moveToNewTab` のイベント列検証を含む）・
      `SessionModel.test.ts` の既存テストが全て無改修のまま通ることを確認する（回帰確認）。
      **coding ではなく test 工程で消化する**（このセッションの他 work と同じ扱い）。
      対象: `SessionService.test.ts`・`SessionModel.test.ts`（既存部分を変更せず実行する
      だけ） / 根拠: design.md「対象範囲」・「依拠する既存の事実」
      依存: T1, T2, T3
      AC: AC6, AC7
