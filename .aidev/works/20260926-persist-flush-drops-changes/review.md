# レビュー: 進行中の保存に相乗りした flush・予約保存が、その後の変更を落とさないようにする

## タスク点検ログ（`aidev-40-coding` 手順5）

- [nit][conv:-] `packages/server/src/session/PersistScheduler.ts:6-9` インターフェースの `cancel()` の説明に、追加の保存も取り消し、それを待つ `flush()` が保存せずに解決することが書かれていない / 対応: 修正済（T1・ラウンド1。説明に 2 行追記）

## レビュー指摘（ラウンド1）

- [should][conv:regression-negative-control] 追加の保存が失敗したとき、それを待つ `flush()` が reject することを確かめるテストが無い（design「エラー処理 / 異常系」・AC4 の失敗側）。`return this.startSave().catch(() => undefined);`（追加の保存の失敗を握りつぶす変異）を当てても 10 本すべて通り、終了時の保存失敗が成功扱いになりうる / 対応: AC4 のテストに「追加の保存を reject させると flush が reject する」ケースを足し、変異 M8 として網羅に加える / src: review round1
- [nit][conv:-] `PersistScheduler.ts:17` のコメントの誤字「走りうった」→「走りえた」/ 対応: 修正 / src: review round1

## レビュー指摘（ラウンド2）

スコープ: ラウンド1の2件の解消と、その修正差分（テスト1本の追加・コメントの誤字）。差分が小さいため主エージェントが同一セッションで確認した。
- should（追加の保存の失敗を握りつぶす変異が通り抜ける）: 「追加の保存が失敗したら、それを待つ flush は失敗する（握りつぶさない）」テストを追加し、変異 M8 がこのテストで落ちることを確認（test-result.md）。解消。
- nit（誤字）: `PersistScheduler.ts:17` を「走りえた」に修正済み。解消。
- 新しい差分に must/should の欠陥は無し（テストは既存の `manualSave` と同じ書き方で、1 回目の成功後に 2 回目を reject させ、2 つ目の flush が同じエラーで reject することを確かめている）。

判定: 指摘なし。review を承認する。
