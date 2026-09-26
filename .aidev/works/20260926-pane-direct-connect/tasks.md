# タスク: `wtmctl pane attach`——手元の端末を pane 1 枚に直結する

## 実装方針

design.md の順に、protocol（型）→ server（`SizeAuthority` の所有者と鍵 → 方式の登録）→ cli（切り離しキー → 引数 → 直結の本体）→ 結合テスト → smoke → 文書、
と下から積む。各タスクは単体テストで閉じ、結合テスト（T7）で server と cli を実サーバの上で繋ぐ。ブラウザ（`packages/web`）は変えない。

## 作業順序と依存関係

- 下の `依存:` に従う。T2（SizeAuthority）が最も判断の多い箇所（鍵・後始末・移譲との順序）なので先に固め、T3 の方式はその薄い包みにする。
- T4（切り離しキー）と T5（引数）は他に依存しないので、T1〜T3 と並行してよい。T5 は引数の解釈と使い方だけで、`main.ts` の分岐（`runPaneAttach` を呼ぶ）は T6 で足す。

## リスク / 留意点

- `DefaultSizeAuthority` を 2 引数で組み立てる既存テストが多い——第 3 引数は省略可能にする（research「実装時の注意」）。
- `reportAndExit` の前に raw モードを戻す順序（research「実装時の注意」）。`runPaneAttach` は `finally` で戻してから例外を投げ直す。
- 結合テストは実サーバ・実 PTY を使う。空きポートの取り合い（EADDRINUSE）に注意し、既存の `getFreePort` の流儀に合わせる。実時間の待ちは `vi.waitFor` で上限付きにする。
- smoke（T8）は node-pty の PTY でビルド済みの CLI を動かす。シェルの起動・プロンプトの描画の時間は待ち合わせ（出力の中の印）で吸収し、固定の sleep に頼らない。

## テスト方針

- server: `SizeAuthority.test.ts` に直結の単体テスト（AC3・AC4・AC8・AC9・AC10）、方式の単体テスト（`not_found`・引数の検証・`pane_attached` が RpcError として返る。AC3・AC8）。
  AC12（認証と Origin の検査の上にだけ載ること）は結合テスト（T7）で確かめる。
- cli: `attachKeys.test.ts`（AC6）、`commands/attach.test.ts`（偽の `WtmClient`・偽の端末で AC1〜AC3・AC5〜AC7・AC9・AC13）、`cliArgs.test.ts`（`pane attach` の引数。AC5 の前提となる入口）。
- 結合: `packages/cli/src/attach.integration.test.ts`（実サーバ・偽の端末。AC1・AC2・AC3・AC6・AC8・AC9・AC11・AC12・AC13）。
- smoke: `packages/cli/src/smoke.ts` に実物の PTY での一巡（AC6）。
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 足した判定（鍵・所有者の拒否・奪取の通知・後始末・切り離しキー・終わり方ごとの RESTORE・not_a_tty）を
  1 つずつ壊してテストが落ちることを test 工程で確かめ、生の出力を test-result.md に貼る。

## タスク

- [x] T1: protocol に `pane.attach`・`pane.attach_resize`・`pane.detach` の params/result、イベント `pane.attach_changed`、エラーの code `pane_attached`・`not_attached` を足す
      対象: `packages/protocol/src/messages.ts:429` `METHOD_SCHEMAS`・`:482` `MethodResultMap`・`packages/protocol/src/events.ts:108` `ServerEvent`・`packages/protocol/src/errors.ts:2` `ErrorCode` / 根拠: research A5
      依存: なし
      AC: AC3, AC8, AC9
- [x] T2: `SizeAuthority` に直結の所有者・大きさの鍵（`applyOwnerSize` で飛ばす）・`attach`/`resizeAttached`/`detach`/`attachOwner`・`onClientGone` での解放・イベントの発行（省略可能な第 3 引数）を足し、単体テストを書く
      対象: `packages/server/src/clients/SizeAuthority.ts:144` `applyOwnerSize`・`:106` `onClientGone`・`packages/server/src/clients/SizeAuthority.test.ts:1-75` / 根拠: research A1, A2, A8
      依存: T1
      AC: AC3, AC4, AC8, AC9, AC10
- [x] T3: 方式 `pane.attach`・`pane.attach_resize`・`pane.detach` を登録し（`not_found` の確認）、`composeServer` で bus を SizeAuthority に渡し、方式の単体テストを書く
      対象: `packages/server/src/surface/methods/attach.ts`（新規）・`packages/server/src/surface/methods/index.ts` `registerAllMethods`・`packages/server/src/composeServer.ts:189` / 根拠: research A3, A4
      依存: T2
      AC: AC3, AC8, AC12
- [x] T4: 切り離しキーの判定 `AttachKeyFilter`（`Ctrl+B q`・`Ctrl+B Ctrl+B`・`Ctrl+B` ＋その他・読み取りの境界をまたぐ保留）と単体テスト
      対象: `packages/cli/src/attachKeys.ts`（新規）・`packages/cli/src/attachKeys.test.ts`（新規）
      依存: なし
      AC: AC6
- [x] T5: `wtmctl pane attach <paneId> [--takeover]` の引数・`Command`・使い方（`USAGE`・`main.ts` の `printHelp`）と、引数の単体テスト
      対象: `packages/cli/src/cliArgs.ts:245` `parsePane`・`:47` `Command`・`:10` `USAGE`・`packages/cli/src/main.ts` `printHelp` / 根拠: research A6
      依存: なし
      AC: AC5
- [x] T6: `runPaneAttach`（`AttachTerminal`・`processTerminal`・not_a_tty・attach → raw/ENTER → subscribe → 入出力・大きさ・4 つの終わり方・RESTORE と raw の戻し）と `main.ts` の分岐、単体テスト
      対象: `packages/cli/src/commands/attach.ts`（新規）・`packages/cli/src/commands/attach.test.ts`（新規）・`packages/cli/src/main.ts` `main`・`packages/cli/src/withSession.ts:15`・`packages/cli/src/wsClient.ts:38` / 根拠: research A7
      依存: T1, T4, T5
      AC: AC1, AC2, AC3, AC5, AC6, AC7, AC9, AC13
- [x] T7: 実サーバ・偽の端末の結合テスト（画面と出力・打鍵の往復・大きさ・切り離し後も pane が残る・`pane_attached`・takeover・ブラウザ相当の購読と入力・認証無し/偽の Origin の拒否・pane の終了）
      対象: `packages/cli/src/attach.integration.test.ts`（新規）・足場 `packages/cli/src/agentPrompt.integration.test.ts:80-100` / 根拠: research A8
      依存: T3, T6
      AC: AC1, AC2, AC3, AC6, AC8, AC9, AC11, AC12, AC13
- [x] T8: `NodePtyBackend` を `@wtm/server` の公開面に足し、cli の smoke に実物の PTY の上の `pane attach`（echo の往復・`Ctrl+B q` で終了コード 0）を足す
      対象: `packages/server/src/testkit.ts`・`packages/cli/src/smoke.ts` / 根拠: research A9・decisions D5
      依存: T3, T6
      AC: AC6
- [x] T9: `docs/wtmctl.md` に `pane attach` の節（使い方・切り離しキー・排他と takeover・大きさ・終了コード・herdr との違い・既知の制約）、`docs/herdr-parity.md` の H40 を更新
      対象: `docs/wtmctl.md`・`docs/herdr-parity.md:73`
      依存: T3, T6, T7, T8
      AC: AC14
- [x] T10: （review ラウンド 1 の must）出力と SNAPSHOT から端末への問い合わせを取り除く `TerminalQueryFilter` と単体テスト、`runPaneAttach` への組み込み
      対象: `packages/cli/src/attachOutput.ts`（新規）・`packages/cli/src/attachOutput.test.ts`（新規）・`packages/cli/src/commands/attach.ts` `attachSession` / 根拠: decisions D8
      依存: T6
      AC: AC1, AC2
- [x] T11: （review ラウンド 1 の should・nit）RESTORE_SCREEN を広げる・切り離しを始めたら打鍵を止める・シグナルを切り離しとして扱う、と単体テスト
      対象: `packages/cli/src/commands/attach.ts` `RESTORE_SCREEN`・`processTerminal`・`attachSession`・`packages/cli/src/commands/attach.test.ts` / 根拠: decisions D9
      依存: T6
      AC: AC6, AC7
- [x] T12: （review ラウンド 1 の should）結合テストで直結前の画面が届くこと・pane から見た大きさ（stty size）・問い合わせを手元に書かないことを確かめ、smoke で代替画面から出る列を確かめる。docs を合わせる
      対象: `packages/cli/src/attach.integration.test.ts`・`packages/cli/src/smoke.ts`・`docs/wtmctl.md`
      依存: T10, T11
      AC: AC1, AC3, AC7, AC14

