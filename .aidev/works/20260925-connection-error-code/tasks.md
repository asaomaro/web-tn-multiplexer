# タスク: Connection のエラーがコードをプロパティで持つ

## 実装方針

design.md の対象範囲は2つの独立したファイルペア（`Connection.ts`+`Connection.test.ts`、
`clientError.ts`+`clientError.test.ts`）に分かれ、互いに参照関係が無い（`clientError.ts` は
`Connection.ts` を import しない）。それぞれ `依存: なし`同士で並行可。最後に
`ActionDispatcher.test.ts` の無改修確認（回帰確認）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T2 は並行可。

## リスク / 留意点

- **`Error.message` の文字列組み立て（テンプレートリテラル部分）を変更しないこと**
  （design「設計方針」「AC4」）。`Object.assign` で `code` を付与する際、`message` の生成に
  手を加えない。
- **`errorCodeOf` の正規表現フォールバックを消さないこと**（design「設計方針」）——
  `.code` を持たない値（クライアント側合成のエラー・`ActionDispatcher.test.ts` のフェイク）が
  この経路に依存している。

## テスト方針

- `Connection.test.ts`: サーバのエラー応答を reject したとき、reject される `Error` が
  `code` プロパティを持つこと（AC1）。既存の「サーバのエラー応答を reject する」テスト
  （`message` に `code` の文言が含まれることを確認するテスト）が無改修のまま通ること（AC4・
  回帰）。
- `clientError.test.ts`: `.code` プロパティを持つ値を渡すと、それを最優先で返すこと（AC2）。
  `.code` を持たない従来型の文字列書式の値（`new Error("worktree_dirty: message")` 等）は
  引き続き正規表現フォールバックで判定されること（AC3・既存の `errorCodeOf` テストが無改修の
  まま通ることで確認）。
- 全タスク完了後、`ActionDispatcher.test.ts`（`errorCodeOf`/`worktreeErrorMessage` の
  消費側。design「依拠する既存の事実」参照）が無改修のまま通ることを確認する（T3・AC5。
  coding ではなく test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `Connection.ts` の `handleText` で、サーバのエラー応答を reject する際に `code`
      プロパティを付与する。`Connection.test.ts` に確認テストを足す。
      対象: `packages/web/src/net/Connection.ts:292-293`・`Connection.test.ts` / 根拠:
      design.md「インターフェース / データ構造 > packages/web/src/net/Connection.ts」
      依存: なし
      AC: AC1, AC4

- [x] T2: `clientError.ts` の `errorCodeOf` を `.code` 優先＋既存の正規表現フォールバックの
      順に変える。`clientError.test.ts` に確認テストを足す。
      対象: `packages/web/src/net/clientError.ts:43-46`・`clientError.test.ts` / 根拠:
      design.md「インターフェース / データ構造 > packages/web/src/net/clientError.ts」
      依存: なし
      AC: AC2, AC3

- [x] T3: `ActionDispatcher.test.ts` が全て無改修のまま通ることを確認する（回帰確認）。
      **coding ではなく test 工程で消化する**（このセッションの他 work と同じ扱い）。
      対象: `packages/web/src/actions/ActionDispatcher.test.ts`（既存ファイルをそのまま
      実行するだけ。変更はしない） / 根拠: design.md「対象範囲」・「依拠する既存の事実」
      依存: T1, T2
      AC: AC5
