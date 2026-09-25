# タスク: Workspace.git の即時化

## 実装方針

design.md の対象範囲の順に積む: `GitInfoPoller.ts`（T1）・`deps.ts`（T2）は互いにファイルが
重ならず `依存: なし`同士なので並行可。`workspace.ts`（T3）は T1・T2 両方の型・メソッドに
依存する。`composeServer.ts`（T4）は T2 の型だけに依存する（T3 とはファイルが重ならず、
T2 の後どちらも並行可）。最後に実際の git を使う end-to-end テスト（T5）と回帰確認（T6）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T2 は並行可。T3 は T1・T2 の両方が終わってから、T4 は T2 の後、
それぞれ着手できる——T3・T4 は互いにファイルが重ならないため（両方の前提が揃った時点で）
並行可。

## リスク / 留意点

- **`workspace.create` の応答を `pollWorkspaceNow` の完了で絶対にブロックしないこと**
  （design「設計方針」）。T3 で `await` してしまわないよう注意する。
- **`.catch(() => undefined)` を付けること**（design「エラー処理 / 異常系」）——
  `GitInfoPoller.start()` の既存パターンと同じ最終防御。

## テスト方針

- `GitInfoPoller.test.ts`: `pollWorkspaceNow` が対象の git リポジトリを正しく反映すること・
  git リポジトリでない場所では `null` のまま例外を投げないこと（AC2）・2回連続で呼んでも
  値が変わらなければモデルを書き換えない（既存の「does not touch the workspace record...」
  テストと同じ参照同一性の確認。AC4）ことを確認する。
- `surface/methods/index.test.ts`: `workspace.create` のハンドラが、作成成功後に
  `gitPoller.pollWorkspaceNow` を新しい workspace の id で呼ぶこと（応答を待たせずに）を
  モックで確認する（AC1 の配線部分・AC3 の「応答をブロックしない」の直接の検証）。
- `composeServer.integration.test.ts`: 実際の git リポジトリで workspace を作り、5秒の
  定期ポーリングを待たずに `Workspace.git` が埋まること（AC1）・`workspace.create` の
  応答時間が変わらないこと（AC3）を実機に近い形で確認する。
- 全タスク完了後、既存の `GitInfoPoller.test.ts`（既存部分）・`composeServer.
  integration.test.ts`（既存部分）が無改修のまま通ることを確認する（T6。coding ではなく
  test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `GitInfoPoller.ts` に `pollWorkspaceNow(workspaceId)` を追加する。
      `GitInfoPoller.test.ts` に確認テストを足す。
      対象: `packages/server/src/git/GitInfoPoller.ts:9-50`（`pollNow`・`pollWorkspace` が
      precedent）・`GitInfoPoller.test.ts` / 根拠: design.md「インターフェース /
      データ構造 > GitInfoPoller.ts」
      依存: なし
      AC: AC2, AC4

- [x] T2: `deps.ts` の `MethodDeps` に `gitPoller: GitInfoPoller` を追加する。
      対象: `packages/server/src/surface/methods/deps.ts` / 根拠: design.md
      「インターフェース / データ構造 > deps.ts」
      依存: なし
      AC: なし

- [x] T3: `workspace.ts` の `workspace.create` ハンドラを `async` にし、作成成功後に
      `deps.gitPoller.pollWorkspaceNow` を fire-and-forget で呼ぶ。
      `surface/methods/index.test.ts` に確認テストを足す。
      対象: `packages/server/src/surface/methods/workspace.ts:13-19`・
      `index.test.ts` / 根拠: design.md「インターフェース / データ構造 > workspace.ts」
      依存: T1, T2
      AC: AC1, AC3

- [x] T4: `composeServer.ts` の `registerAllMethods` 呼び出しに `gitPoller` を渡す。
      対象: `packages/server/src/composeServer.ts:205` / 根拠: design.md
      「インターフェース / データ構造 > composeServer.ts」
      依存: T2
      AC: なし

- [x] T5: `composeServer.integration.test.ts` に、実際の git リポジトリで workspace を
      作り、定期ポーリングの5秒を待たずに `Workspace.git` が埋まること・応答時間が
      変わらないことを確認する end-to-end テストを足す。
      対象: `composeServer.integration.test.ts`（既存の `shell`・`worktreeDir` の統合
      テストが precedent） / 根拠: design.md「受け入れ基準との対応 AC1・AC3」
      依存: T3, T4
      AC: AC1, AC3

- [x] T6: 既存の `GitInfoPoller.test.ts`・`composeServer.integration.test.ts` が全て
      無改修のまま通ることを確認する（回帰確認）。**coding ではなく test 工程で消化する**
      （このセッションの他 work と同じ扱い）。
      対象: `GitInfoPoller.test.ts`・`composeServer.integration.test.ts`（既存ファイルを
      そのまま実行するだけ。変更はしない） / 根拠: design.md「対象範囲」（変更しない、
      とされる既存ファイル群）
      依存: T5
      AC: なし
