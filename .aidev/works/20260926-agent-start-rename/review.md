# レビュー記録

## タスク点検ログ

- [must][conv:-] packages/web/src/net/clientError.ts:13 `ErrorCode` に `invalid_agent_name`・`agent_name_taken` を足したが、全 code の網羅を型で求める web の `MESSAGES` に無く、web の typecheck が落ちる / 対応: 修正済（T1・ラウンド1。2 つの文言を足した。tasks.md の T1 の対象に追記）
- [nit][conv:-] packages/server/src/session/SessionService.ts:904 引き継ぎの条件のうち「更新が名前を持つなら上書きしない」を捕まえるテストが無かった / 対応: 修正済（T2・ラウンド1。テストを足した）
- [should][conv:-] packages/web/src/components/GotoPicker.vue:80 呼び名が名前に変わると、移動の候補の絞り込みでエージェントの種類の表示名（例「claude」）で引けなくなる / 対応: 修正済（T7・ラウンド1。絞り込みに `pane.agent?.label` を足し、名前と種類の両方で引けるテストを足した。tasks.md の T7 の対象に追記）
- [nit][conv:-] packages/cli/src/smoke.ts:180 design の「外した後に pane ID で引き直して name が null」の確認が無かった / 対応: 修正済（T6・ラウンド1）
- [should][conv:-] packages/web/src/mobile/PanePicker.vue:110 携帯の pane 選択のエージェント一覧が名前を出さず、サイドバー・呼び名と揃っていなかった / 対応: 修正済（cross・ラウンド1。「名前（種類）」で出し、テストと docs を足した）

## ラウンド 1（2026-09-26T12:34:53Z）

独立レビュー（別コンテキスト）。must 0・should 0・nit 2。

- [nit][conv:-] packages/server/src/session/SessionService.ts:904 `updatePaneRuntime` は名前を持つ `patch.agent` を検査せずに反映する。本番の呼び出し元（`AgentMonitor.ts:105`・`:199`）は名前を持たない info しか渡さないので実害は無いが、書式・一意性の検査が呼び出し元の書き方に頼っている / 対応: 許容（decisions.md D7。`agent start` の兄弟項目で名前付きの経路を作るときに `renameAgent` 経由に揃える）
- [nit][conv:-] packages/web/src/components/PaneFrame.vue:50 JSDoc の呼び名の連鎖の列挙が `paneNameOf` の 4 段と合っていない（既存のコメント。正典は `paneNameOf` と :53 に書かれている） / 対応: 許容（コメントだけで振る舞いに影響なし。test 通過後のコード変更を避けた）
