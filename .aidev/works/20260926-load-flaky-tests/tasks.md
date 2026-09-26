# タスク: 高負荷のときだけ落ちる単体・結合テストをなくす

## 実装方針

design の 3 種類（製品の不具合・空きポート・時間の上限）を別々のタスクにする。製品の不具合（T1）を最初に直し、回帰テストの負の確認を
その場で取る。空きポートは、`composeServer` を待ち受けさせるテストには共通の手段（T2）を作ってから当て（T3・T4）、`http.Server` を自分で listen させる
テスト（WsGateway・HttpServer）は `listen(0)` の結果を使う形に直す（T3。design「2. 空きポート」）。時間の上限（T5）は負荷の下の実測（research の
申し送り）を値の根拠にする。

## 作業順序と依存関係

下の `依存:` に従う。T1 は負荷と無関係に落ちる本物の不具合なので最初に着地させる。

## リスク / 留意点

- `composeServer.integration.test.ts` はわざと `EADDRINUSE` を起こす `it` を含む。そこへ取り直しを当てない（design「2. 空きポート」）。
- cli のテストは `@wtm/server` の `dist` を使う。T2 の後は `pnpm -s build` してから cli のテストを流す。
- 別の worktree（agent start / rename）が `packages/cli/src/agent.integration.test.ts` 等を触る可能性がある。差分は `getFreePort` の置き換えの
  数行に留め、衝突を小さくする。
- `vi.setConfig` の効く範囲（design「依拠する既存の事実」の未確認）を T5 で確かめる。

## テスト方針

- T1: 負の確認を 2 つに分ける——原子的な置き換えだけを戻すと AC1 のテストが落ち、直列化だけを戻すと AC2 のテストが落ちること（生の出力を test-result.md へ）。`main.integration.test.ts` を単独で 20 回。
- T2: `composeServerOnFreePort.test.ts`。取り直しの分岐（`EADDRINUSE` で取り直す行）を戻すと落ちること。
- T3・T4・T5: 変更したファイルを単独で緑にし、アサーションと `it` の数が減っていないこと（AC7）を差分で数える。
- test 工程: 負荷の条件 C・F（design）を修正後に流して修正前と比べる。`pnpm -s build`・`typecheck`・`test`×2・`aidev smoke`。

## タスク

- [x] T1: `FsSessionStore` の書き込みを原子的にし、`set`/`clear` をファイルパスごとに直列化する。回帰テストを足す
      対象: `packages/cli/src/session.ts` `FsSessionStore.save`・`set`・`clear` / `packages/cli/src/session.test.ts` / 根拠: research A1, A2
      依存: なし
      AC: AC1, AC2, AC3, AC10
- [x] T2: `composeServerOnFreePort`・`getFreePort` を server に作り、`testkit.ts` から出す。取り直しのテストを足す
      対象: `packages/server/src/composeServerOnFreePort.ts`（新規）・同 `.test.ts`（新規）・`packages/server/src/testkit.ts` / 根拠: research F6, F7
      依存: なし
      AC: AC4, AC9
- [x] T3: server のテストの空きポートを置き換える（`composeServer.integration.test.ts` は T2 の手段、`WsGateway`・`HttpServer` の結合テストは `listen(0)`）
      対象: `packages/server/src/composeServer.integration.test.ts` `getFreePort` の呼び出し（わざと `EADDRINUSE` を起こす `it`・ロックで断られる 2 つ目・listen しない `it` は除く。design「2. 空きポート」）・`packages/server/src/ws/WsGateway.integration.test.ts:69-128,510-516`・`packages/server/src/http/HttpServer.integration.test.ts:17-41` / 根拠: research A3, F8
      依存: T2
      AC: AC4, AC7
- [x] T4: cli のテストの空きポートを T2 の手段に置き換える
      対象: `packages/cli/src/main.integration.test.ts:21,65,153,188`・`agent.integration.test.ts:42,96`・`agentPrompt.integration.test.ts:39,91`・`attach.integration.test.ts:20,100`・`wsClient.test.ts:20,37` / 根拠: research A3
      依存: T2
      AC: AC4, AC7
- [x] T5: 重いテストに、負荷の下の実測に基づく時間の上限を与える（値と根拠を decisions.md に）
      対象: design「3. 時間の上限」の表——行番号は T3・T4 の前のもの。`it` の名前で探す（`main.integration.test.ts` の「workspace create」「watch」・`composeServer.integration.test.ts` のファイルの既定・「--session work」「persists and restores」「偽の 'claude'」と `waitForEvent` の待ち）・`packages/server/src/git/GitInfoPoller.test.ts:225`（`describe` と中の `{ timeout: 5000 }`）・`packages/web/src/App.test.ts`・`packages/web/src/components/SettingsDialog.test.ts`・`packages/web/src/components/SettingsDialog.symbolsNote.test.ts`（ファイル） / 根拠: research A4, F9, F11・decisions D5
      依存: T3, T4
      AC: AC5, AC7
- [ ] T6: 負荷の条件 C・F で修正後を流し、修正前と比べる（コードの変更を生まない確認。消化は test 工程——decisions D6。テスト方針の「test 工程」の行と同じもの）
      対象: scratchpad の `loadrun.sh`（design「負荷の条件」）
      依存: T1, T3, T4, T5
      AC: AC6, AC8
- [x] T7: GitInfoPoller の追従の describe で、名前を決める時間の予算（`AUTO_LABEL_TIMEOUT_MS` 200ms）を負荷の下で超えてフォルダ名に代わる落ち方を直す（test ラウンド 1 の差し戻し）
      対象: `packages/server/src/git/GitInfoPoller.test.ts` の追従の `describe` の `beforeEach`（`new SessionService({...})`）・`packages/server/src/session/workspaceLabel.ts` `defaultWorkspaceLabelDeps`
      依存: T5
      AC: AC5, AC6
