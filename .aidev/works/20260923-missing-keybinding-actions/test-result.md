# テスト結果: herdr にあって本製品に操作自体が無いものを足して割り当てられるようにする

## 実行したもの

- `pnpm --filter @wtm/protocol -s test` — 58 passed / 0 failed / 0 skipped
- `pnpm --filter @wtm/server -s test` — 657 passed / 0 failed / 0 skipped
- `pnpm --filter @wtm/web -s test` — 1760 passed / 0 failed / 0 skipped（新規2件を含む。AC8 の通し確認）
- `pnpm --filter @wtm/cli -s test` — 133 passed / 0 failed / 0 skipped
- `pnpm -r --filter '!@wtm/e2e' test`（上記4パッケージの一括実行。最終確認） — 全て green（exit 0）
- E2E（`packages/e2e`）は対象外（requirements「対象外」・tasks.md「テスト方針」）。実行していない。

## 受け入れ基準ごとの判定

- AC1: pass — `ActionDispatcher.test.ts`「lastPane（last_pane。1スロットのトグル）」で、workspace・tab を
  またいだ直前の pane へのフォーカス移動を確認（`pane.focus` が送られ `view` が実際に切り替わることまで）。
- AC2: pass — 同上のテストで2回連続の `lastPane` がトグルして元へ戻ることを確認。加えて「直前の pane が
  既に閉じていれば何もしない」「直前の pane が今の focus と同じなら何もしない」の2つの no-op を個別に確認
  （`view.test.ts` の `focusPane` トグル追跡テストと合わせて二重に検証）。
- AC3: pass — `ActionDispatcher.test.ts`「workspaceDelta」で、サイドバーと共有する `orderedWorkspaceIds`
  経由の巡回（端で反対へ）と `workspace.focus` の発行を確認。`workspaceOrder.test.ts` で並び順そのもの
  （`opened`/`name`）も単体で確認。
- AC4: pass — workspace が1個のとき `workspaceDelta` が何も送らないことを確認（同 describe 内）。
- AC5: pass — `SessionModel.test.ts`「moveTab」で隣接swap相当の巡回・境界の巡回（splice 版。decisions
  D10）・`activeTabId` が動かないことを確認。`SessionService.test.ts`/`surface/methods/index.test.ts` で
  `workspace.updated` が発行されること・単一 tab では発行されないことを確認。`ActionDispatcher.test.ts`
  で `tab.move` が正しい `{tabId, direction}` で送られることを確認。「別のブラウザでも同じ並び順で見える」
  は `workspace.updated` イベントの配信で担保（既存の `tab.rename`/`tab.close` と同じ配信経路。個別の
  多クライアント E2E は対象外のため未検証——「未検証の穴」に記載）。
- AC6: pass — `ActionDispatcher.test.ts`「resizeBy」の既存テストがそのまま経路を検証（`bindings.ts` の
  4エントリが直接 `resizeBy` へ渡るだけで新規実装が無いため、既存テストの再利用で足りる。design のとおり）。
  4方向のカタログ登録自体は `bindings.test.ts` の全操作ループ（`action` の形の整合性チェック）で確認。
- AC7 / AC7a / AC7b: pass — `ActionDispatcher.test.ts`「agentDelta/focusAgentIndex」で、workspace・tab を
  またいだ巡回・0件の no-op（AC7a）・現在の focus が一覧に無いときの先頭/末尾（herdr と同じ挙動）・
  範囲外の索引での no-op（AC7b）を確認。`agentOrder.test.ts` で並び順そのもの（`grouped`/`priority`）も
  単体で確認。`Sidebar.vue` との順序共有（非機能要件）は T11 のリファクタで構造的に保証——独立点検
  （taskcheck cross）で `ActionDispatcher.agentOrderEntries()` と `Sidebar.vue` の `agents` computed が
  同じフィルタ・同じフィールド構成であることを確認済み。
- AC8: pass — `KeySettings.test.ts` に新規2件を追加して通しで確認（代表操作 `last_pane` で「なし」表示→
  追加→「既定に戻す」→再び「なし」の一巡、`focus_agent` で範囲キーの割り当てが実際にできること）。
  当初 design は「`KeySettings.vue`/`HelpDialog.vue` は無変更で汎用に拾う」という推論に留まっていたが、
  test 工程で実機（DOM）の通しテストを足して裏付けた。
- AC9: pass — `docs/herdr-parity.md` H26 の「対象外」列挙から該当8操作を取り消し線で外し（`edit_scrollback`
  は残した）、新規 H26d 行を追加したことを目視で確認（文書のため自動テスト対象外）。
- AC10: pass — 既存35操作・prefix・navigate・resize・copy モードの既存テストは無変更のまま全て通った
  （`git diff` で該当ファイルの既存アサーションが増減以外で変わっていないことを確認）。
  例外的に更新したのは、この work が意図的に一般化した2箇所（`bindings.test.ts`「defaults.length>0」の
  前提・「indexed が switch_tab だけ」の前提、`keymap.test.ts` のエラー文言）と、カタログの総数が
  35→47に増えたことで機械的に数値がずれた1箇所（`KeySettings.test.ts` の `toHaveLength(41)`→`53`。
  decisions.md D11）——いずれも「既存35操作**自体**の挙動」を変えたものではない。

## 失敗の証跡

このラウンドでは失敗が発生していない。coding 工程中に2件のテスト不備を自分で発見・修正済み（詳細は
decisions.md D10・D11）——(1) `SessionModel.test.ts` の `moveTab > wraps around at the ends` の期待値が
design の初期案（単純 swap）のまま書かれており、修正後の実装（splice 版）と食い違っていた。修正し、
`regression-negative-control` 条項に従い実装を一時的に単純 swap 版へ戻してテストが実際に落ちることを
確認してから元へ戻した（決定記録に生の失敗出力を記載）。(2) `KeySettings.test.ts` の総数アサーションが
カタログ増加後の実数と食い違っていた。どちらも product コードの不具合ではなく、テスト側の期待値の古さ。

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260923-missing-keybinding-actions
$ pnpm -s build && pnpm -s smoke
...
smoke: PASS
$ pnpm --filter @wtm/cli run smoke
...
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

新しい入口（サブコマンド・protocol メソッド）は `tab.move` のみ。既存の `smoke` シナリオは
`workspace.create`/`pane.subscribe`/echo 往復までで、`tab.move` 単体の起動確認は含まれない
（`tab.rename`/`tab.close` 等、既存の同種メソッドも同様に smoke の対象外——このリポジトリの
smoke は「起動して基本の pane 操作が通るか」を見る最小限のシナリオで、個々の protocol メソッドを
網羅する設計ではないため、既存の粒度に合わせて追加していない）。

## 未検証の穴（skip / 環境不足）

- AC5 の「別のブラウザでも同じ並び順で見える」は、`workspace.updated` イベントが正しく配信されることの
  単体テストレベルでの確認に留まる（実際に2つのブラウザクライアントを繋いで目視するE2E的な確認は、
  この work のスコープ外＝E2E対象外のため未実施）。
- E2E（`packages/e2e`）全体は対象外（requirements「対象外」）のため、ブラウザでの実際のキー入力からの
  通し確認は行っていない。既存のE2Eスイートに新規12操作向けのケースは追加していない（design/tasks の
  いずれにも E2E 追加の言及は無い）。
