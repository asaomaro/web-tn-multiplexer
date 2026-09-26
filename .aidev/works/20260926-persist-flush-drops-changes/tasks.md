# タスク: 進行中の保存に相乗りした flush・予約保存が、その後の変更を落とさないようにする

## 実装方針

design「インターフェース / データ構造」のとおり、`DefaultPersistScheduler` に `queued`（追加の保存）を足し、既存の
`runSave()` 本体を `startSave()` に移す。回帰テストは同じタスクで `PersistScheduler.test.ts` に足す（テストが
変更の検証そのものなので分けない）。負の確認と全体テストは test 工程で行う。

## 作業順序と依存関係

下の `依存:` に従う。

## リスク / 留意点

- `flush()` は `cancel()` を呼ばない（呼ぶと相乗りした `flush()` が保存されずに解決する。decisions.md D4）。
- `runSave()` は `queued` を `inFlight` より先に見る（隙間で 2 つ同時に走らせない。design「振る舞いの詳細」）。
- テストで Promise の続きを進めるには、フェイクタイマーの `advanceTimersByTimeAsync` か `await` を挟む必要がある。

## テスト方針

- 単体テスト（`PersistScheduler.test.ts`）で AC1〜AC4・AC6・AC7 を、手で解決する Promise を返す `save` と
  フェイクタイマーで確かめる。`save` は同時に実行中の数の最大値を数える（AC3）。
- 負の確認（AC5）: `PersistScheduler.ts` だけを HEAD に戻して AC1・AC2・AC4 のテストが落ちる生の出力を残し、戻して `cmp`。
- `pnpm -s test` を全体で 2 回、`pnpm -s typecheck`・`pnpm -s build`・`aidev smoke`。E2E は走らせない。

## タスク

- [x] T1: `DefaultPersistScheduler` に追加の保存（`queued`）を実装し、回帰テストを足す
      対象: `packages/server/src/session/PersistScheduler.ts:36-58` `runSave` `startSave`（新規） `cancel` `flush`（`cancel()` を呼ばないことの確認）・`packages/server/src/session/PersistScheduler.test.ts`
      依存: なし
      AC: AC1, AC2, AC3, AC4, AC6, AC7
- [x] T2: 負の確認・全体テスト 2 回・`pnpm -s typecheck`・`pnpm -s build`・`aidev smoke`（test 工程で消化する）
      対象: `packages/server/src/session/PersistScheduler.ts`（一時的に HEAD へ戻す）
      依存: T1
      AC: AC5
