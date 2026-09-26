# タスク: pnpm のスクリプトを「失敗が見える」形にする

## 実装方針

design の対象範囲は新規ファイル1つ（`scripts/run-quiet.mjs`）とルート `package.json` の2行の
差し替えだけで、依存関係も単純なので、1タスクにまとめて実装する（design「対象範囲」参照）。

## 作業順序と依存関係

下の `依存:` に従う（1タスクのみ）。

## リスク / 留意点

- `-s` 付き呼び出しで `npm_config_reporter`/`npm_config_loglevel` が子プロセスへ継承される問題
  （design「依拠する既存の事実」）を見落とすと、ラッパーを挟んでも `pnpm -s typecheck` だけ
  直らない（`pnpm typecheck`（-s 無し）は直って見えるため、AC5 の検証を端折ると気付けない）。
  必ず `-s` あり・無しの両方で検証する。
- 成功時に何も出さない（バッファを捨てる）ことを確認する——バナー行だけ出て中身が空、という
  半端な状態にならないか、実装時に自分で確認したのと同じ手順（型エラーを仕込む→戻す）を
  再現して確かめる。

## テスト方針

- `packages/protocol/src/index.ts` に型エラーを一時的に追加し、`pnpm -s typecheck`・
  `pnpm typecheck`・`pnpm -s build`・`pnpm build` を実行して、それぞれ失敗の内容
  （対象パッケージ名・対象ファイル・エラーメッセージ）が標準出力に残ることを確認する
  （design AC1・AC2・AC5）。
- 型エラーを戻し、`pnpm -s typecheck`・`pnpm -s build` を実行して、出力が一切無く終了コード 0
  で終わることを確認する（design AC3）。
- `pnpm -s test`・`pnpm -s lint` が無改修のまま動くことを確認する（design AC4）。
- 負の確認（regression-negative-control.md）: `package.json` の `typecheck`/`build` を一時的に
  元の形（`pnpm -r --filter=./packages/* run <script>` 直接呼び出し）へ戻し、型エラーを仕込んだ
  状態で `pnpm -s typecheck` を実行して「元のバグ（無出力）」が再現することを確認 → 戻して
  再確認する。

## タスク

- [x] T1: `scripts/run-quiet.mjs` を新設し、ルート `package.json` の `typecheck`・`build`
      スクリプトをこのラッパー経由の呼び出しへ差し替える。
      対象: `scripts/run-quiet.mjs`（新規）・`package.json:10-11`
      / 根拠: design.md「インターフェース / データ構造」
      依存: なし
      AC: AC1, AC2, AC3, AC4, AC5
