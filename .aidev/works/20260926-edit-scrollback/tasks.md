# タスク: pane のスクロールバックを `$EDITOR` で開く

## 実装方針

design の「対象範囲」を、下層（protocol → server の部品 → server のサービス・配線 → web）の順に積む。
各タスクは単体テストと負の確認（足した箇所を 1 つずつ壊して落ちることを見る）までを 1 単位にする。

## 作業順序と依存関係

- 下の `依存:` に従う。T1（protocol）が web・server の方式の型の前提、T2・T3 が T5 の前提、T4・T5 が T6 の前提。
- 安全の中心（T3 のパスの渡し方・一時ファイルの権限）を早めに実物の `/bin/sh` で試す。見立てが外れたら design へ戻る。

## リスク / 留意点

- `SessionService.ts`・`messages.ts` は並行の work（外部操作 API / CLI）も触る。追加に留め、既存行の書き換えを最小にする。
- テストで実物の `/bin/sh` を走らせる（T3）。CI・負荷下でも時間に依存しない書き方にする（子プロセスの終了を待つ）。
- `closePane` の変更は既存の `closePane` 由来の `pane.closed`（`successorPaneId` が無い）を変えてはならない。
  既存の `SessionModel.test` の `toEqual`（`successorPaneId` のキーが無い）を壊さない。
- Windows の実機は無い。argv の組み立て（純関数）はテストで、実際の起動は未検証の穴として残す。

## テスト方針

- vitest: protocol（`messages.test`）・server（`Mirror.test`・`scrollbackEditor.test`〔新規〕・`TerminalManager` の引数〔偽の PtyBackend で〕・`SessionModel.test`・
  `SessionService.test`・`surface/methods/index.test`）・web（`bindings.test`・`keymap.test`・`KeyRouter.test`・
  `HelpDialog.test`・`ActionDispatcher.test`・`KeySettings.test`〔あれば〕）。
- 全体: `pnpm -s test`（2 回）・`pnpm -s typecheck`・`pnpm -s build`（終了コードで判定）・`aidev smoke`。E2E は走らせない。
- 負の確認: 各タスクで足した箇所を 1 つずつ壊し、生の出力をファイルへリダイレクトして test-result.md に貼る。戻したら `cmp`。
- 手動（実ブラウザでの `prefix+e`）は E2E を走らせない方針のため未検証の穴に書く（サーバ側の結合は `index.test` で）。

## タスク

- [x] T1: protocol に `pane.edit_scrollback` を足す（params・result・方式の表・結果の表）。`PaneClosedEvent.successorPaneId` の説明を更新
      対象: `packages/protocol/src/messages.ts` `METHOD_SCHEMAS`・`MethodResultMap` / `packages/protocol/src/events.ts` `PaneClosedEvent` / `packages/protocol/src/messages.test.ts`
      依存: なし
      AC: AC14
- [x] T2: `Mirror.plainText()`（通常バッファ・折り返しを戻す・右端の空白と末尾の空行を落とす）と偽の Mirror への追随
      対象: `packages/server/src/terminal/Mirror.ts` `Mirror`・`XtermMirror` / `packages/server/src/terminal/Mirror.test.ts` / 偽: `OutputFanout.test.ts`・`AgentMonitor.test.ts`・`surface/methods/index.test.ts` の `FakeMirror`
      依存: なし
      AC: AC3
- [x] T3: `scrollbackEditor.ts`（argv・Windows の分解・一時ファイルの作成と削除）
      対象: `packages/server/src/terminal/scrollbackEditor.ts`（新規）・`scrollbackEditor.test.ts`（新規）
      依存: なし
      AC: AC2, AC6, AC7, AC8
- [x] T4: `SessionModel.closePane(paneId, preferredSuccessor?)`
      対象: `packages/server/src/session/SessionModel.ts:324-342` `closePane` / `SessionModel.test.ts`
      依存: なし
      AC: AC4
- [x] T5: `SessionService.editScrollback`（開く側）: オプション `scrollbackEditor`（テスト用の差し替え）・`spawnForPane` のコマンド指定とそれを通す `CreatePaneOptions.args`・エディタの記録・失敗時の後片付け
      対象: `packages/server/src/session/SessionService.ts` `SessionServiceOptions`・`splitPane`(:580) の隣・`spawnForPane`(:909) / `SessionService.test.ts` / `packages/server/src/terminal/TerminalManager.ts:52-60` `create` と、その引数のテスト（新規 `TerminalManager.test.ts`。偽の PtyBackend で `args` が渡ることを見る）
      依存: T2, T3
      AC: AC1, AC2, AC3, AC5, AC8, AC12
- [x] T6: `SessionService` の閉じる側: `closePane` での焦点と拡大表示の復帰・`publishPaneClosed` での後片付け・`disposeScrollbackEditors`
      対象: `packages/server/src/session/SessionService.ts` `closePane`(:612)・`publishPaneClosed`(:414) / `SessionService.test.ts`
      依存: T4, T5
      AC: AC4, AC8
- [x] T7: 方式 `pane.edit_scrollback` の登録と、停止時の後片付けの配線
      対象: `packages/server/src/surface/methods/pane.ts` `registerPaneMethods` / `packages/server/src/composeServer.ts:290-311` `close` / `surface/methods/index.test.ts`
      依存: T1, T6
      AC: AC1, AC8
- [x] T8: web: `edit_scrollback` の操作（カタログ・`Action`・`ActionDispatcher`）と「後続」の案内の撤去（keymap・HelpDialog・テスト）
      対象: `packages/web/src/keys/actions.ts:72` / `bindings.ts` `ACTIONS`（`copy_mode` の後） / `keymap.ts:21-29,168-171` / `components/HelpDialog.vue:39-44,112` / `actions/ActionDispatcher.ts:169-171,572-585` / テスト `bindings.test.ts`・`keymap.test.ts`・`KeyRouter.test.ts`・`HelpDialog.test.ts`・`ActionDispatcher.test.ts`・`KeySettings.test.ts`（あれば）
      依存: T1
      AC: AC1, AC5, AC9, AC10
- [x] T9: docs（herdr-parity の H11・H26、verification のキーと手動確認）
      対象: `docs/herdr-parity.md:34,52` / `docs/verification.md:566-572`（「共通：AC10・AC13・AC14・AC18（AC16）」節の AC13 の段落）と「Linux」節の手元の追加確認
      依存: T6, T8
      AC: AC11
- [x] T10: backlog 行を割る（deliver で消化する。coding では未チェックのまま残す）
      対象: `.aidev/backlog/product-roadmap.md:244`
      依存: T9
      AC: AC13
