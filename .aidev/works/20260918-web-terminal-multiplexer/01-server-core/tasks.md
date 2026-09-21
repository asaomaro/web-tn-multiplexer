# タスク: 01-server-core（足場・protocol・サーバの基盤）

> 親：`20260918-web-terminal-multiplexer`。範囲は親の tasks.md「subtask の割れ目」で確定済み（architecture の段階 1〜8・10）。
> 設計の正典は親の design.md と architecture.md。モジュール名・interface は architecture.md に従う。

## 実装方針

- architecture.md の依存の向き（基盤 → ドメイン → 操作面 → アダプタ）に沿って、下の層から積む。
- 純関数の部品（`LayoutTree`・`SessionModel`・`OriginPolicy`・`SizeAuthority` の判定）は、単体テストを先に書く。
- `TerminalHost` の継ぎ目と流量制御は、偽の `PtyProcess` と偽の `ClientSink` で確かめる。実物の node-pty（Linux）での結合テストも 1 本置く。
- **認証（T15・T16）を WebSocket の方式（T19・T20）より先に入れる**（design「ドメイン固有の考慮」）。
- エージェント判定は 02 の範囲。この subtask では `SessionService.updatePaneRuntime` と `TerminalManager` の差し込み口までを作り、`main.ts` には判定を差し込む場所だけを用意する。
- Web UI は 03 の範囲。この subtask の `HttpServer` は、`packages/web/dist` が無ければ仮のページ（「Web UI は未ビルド」）を返す。

## 作業順序と依存関係

下の `依存:` に従う。依存では表せない順序の理由：

- **T4（protocol）を早く固める**。03-web-desktop が使う型で、03 の着手後に変えると手戻りが大きい（親 tasks「リスク」）。
- **T14（D18 の確認）は T17 より前に行う**。親の tasks は herdr の挙動の確認を 03 の最初に置いているが、D18（シェル終了時の pane の扱い）は `SessionService`（この subtask）で実装するので、ここで確かめる。D19・D21・D23 は 03 で確かめる。

## リスク / 留意点

- **node-pty 1.2.0-beta.15 に版を固定する**（Linux 向けのビルド済みバイナリがあるのは 1.2 から。research F8.1・design E4）。beta なので、更新するときは T6 の結合テストを通してから。
- **Windows の実装（T6 の ConPTY の切替・T7 の `WindowsProcessInspector`）は、この subtask では Linux 上の単体テストまで**。Windows での実行は親の統合 test で確かめる。
- **`session.json`・`auth.json` の権限**：Windows では 0600 が効かない。作成者だけが読める場所（`%LOCALAPPDATA%`）に置くことで代える（design「永続化の形式」）。
- **本製品のライセンスは MIT**（decisions.md D34）。herdr 由来の資産は Apache-2.0 の表示（`NOTICE`・`third_party/herdr/LICENSE`）を残して同梱する。

## テスト方針

- 単体：LayoutTree・SessionModel・EventBus・Mirror（問い合わせへの応答・色の問い合わせ・OSC の取得）・OutputFanout（状態遷移・世代番号・stale と再開）・TerminalHost（流量制御・utf8 の変換）・AuthService・OriginPolicy・LoginRateLimiter・SessionService（連鎖して閉じる・自動作成・spawn_failed の巻き戻し・restore）・ClientRegistry・SizeAuthority・ControlSurface（検証とエラーの変換）・SessionFile / AuthFile（原子的な書き込み・退避）。
- 結合（Linux・実物の node-pty）
  - HTTP：ログインの成功・失敗・429、Origin の不一致、セキュリティヘッダ。
  - WebSocket：Cookie 無し・Origin 違いの upgrade の拒否、`client.hello` → `workspace.create` → INPUT → OUTPUT の往復、2 クライアントの同時接続、セッションの失効で 4401。
  - 再起動：保存 → 起動し直し → 構成と cwd の復元。
- 起動確認：`pnpm -s build && pnpm -s smoke`（`aidev smoke`）が通ること。

## タスク

- [x] T1: 足場を作る。
      pnpm workspace（`packages/protocol`・`packages/server`）、`tsconfig.base.json`（strict・ES2023・NodeNext）、ESLint と Prettier、Vitest、ルートの `build`・`test`・`lint`・`smoke` スクリプト、`.gitignore`（`node_modules`・`dist`・`.aidev/current`）、Node 24 の `engines`。
      対象: `package.json` `pnpm-workspace.yaml` `tsconfig.base.json` `packages/protocol/package.json` `packages/server/package.json` `vitest.workspace.ts` `.gitignore`（新規作成・`.gitignore` は既存に追記）/ 根拠: architecture「tasks への申し送り」1・design「対象範囲」
      依存: なし
      AC: なし
- [x] T2: 本製品の `LICENSE`（MIT。D34）を置き、herdr の判定ルールを取り込んで帰属表示を置く。
      herdr のコミット `da6bcd5` の `distribution/agent-detection/*.toml`（23 ファイル）を無改変でコピーし、herdr の `LICENSE` と、取得元・取得日・変更点を記した `README.md` を置く。ルートの `NOTICE` に herdr の著作権表示を載せる。
      対象: `LICENSE` `third_party/herdr/agent-detection/*.toml` `third_party/herdr/LICENSE` `third_party/herdr/README.md` `NOTICE`（新規作成）/ 根拠: design「対象範囲」・D5・D34・research A6
      依存: T1
      AC: なし
- [x] T3: `util/net`・`config.ts`・`log/Logger` を作る。
      `wtm serve` の起動オプション（`--host` `--port` `--cert` `--key` `--origin` `--state-dir` `--scrollback` `--shell`）の解釈と既定値（D20・D22）、状態ディレクトリの決定（Linux は XDG、Windows は `%LOCALAPPDATA%`）。
      **ループバック以外で証明書が無ければ、終了コード 2 と対処の案内**。`isLoopback`。stderr と `server.log` へのログ。
      対象: `packages/server/src/util/net.ts` `packages/server/src/config.ts` `packages/server/src/log/Logger.ts`（新規作成）/ 根拠: design「起動オプション」・architecture「config.ts」
      依存: T1
      AC: AC11
- [x] T4: `protocol` パッケージを作る。
      - 型：`model`（Workspace・Tab・LayoutNode・Pane・AgentInfo・SessionSnapshot）、`messages`（全方式の params / result）、`events`（全イベントの data）、`errors`（エラーコード）。
      - 全方式の zod スキーマ。バイナリフレーム（OUTPUT・SNAPSHOT・INPUT）のエンコードとデコード。既定のテーマの色。
      - 方式の範囲は design「方式」の表と、architecture「方式の追加と変更」（`client.view` の変更・`pane.subscribe` / `unsubscribe`）の和。
      対象: `packages/protocol/src/{ids,model,messages,events,frames,errors,theme}.ts`（新規作成）/ 根拠: design「インターフェース / データ構造」・architecture「方式の追加と変更」
      依存: T1
      AC: AC1, AC2, AC3, AC9
- [x] T5: `persist/SessionFile`・`persist/AuthFile` を作る。
      一時ファイルに書いてから rename、壊れたファイルの `session-backups/` への退避（最新 3 件）、権限 0600（Windows は保存場所で代える）、`load` の 3 つの結果（ok / missing / corrupt）。
      対象: `packages/server/src/persist/SessionFile.ts` `packages/server/src/persist/AuthFile.ts`（新規作成）/ 根拠: architecture「SessionFile」interface・design「永続化の形式」
      依存: T1
      AC: AC18
- [x] T6: `PtyBackend` と `NodePtyBackend` を作る。
      node-pty `1.2.0-beta.15` に固定する。Windows では `useConptyDll: true` を既定にし、`WTM_WINDOWS_CONPTY=system` で OS 付属の ConPTY に戻す。
      Linux で実物のシェルを起動し、入出力・resize・pause / resume・exit を確かめる結合テストを置く。
      対象: `packages/server/src/pty/PtyBackend.ts` `packages/server/src/pty/NodePtyBackend.ts`（新規作成）/ 根拠: research A1・architecture「PtyBackend」interface・design「ドメイン固有の考慮（Windows）」
      依存: T1
      AC: AC4, AC16
- [x] T7: `ProcessInspector` と Linux / Windows の実装を作る。
      - Linux：`/proc/<pid>/stat` の tpgid → `/proc/<tpgid>/cmdline`・`/proc/<pid>/cwd`。
      - Windows：`@vscode/windows-process-tree` で子孫を走査し、最も深い子孫を前面とみなす。
      - 共通：busy の判定、既定シェル（Unix は `$SHELL`→`/bin/sh`、Windows は `powershell.exe`）。
      - テスト：Linux は実物、Windows は偽のプロセスツリーで単体テスト。
      対象: `packages/server/src/platform/ProcessInspector.ts` `LinuxProcessInspector.ts` `WindowsProcessInspector.ts`（新規作成）/ 根拠: research A7・design E5・E6
      依存: T1
      AC: AC16, AC18
- [x] T8: 基盤の interface の実装を作る。
      `FsManifestSource`（判定ルールのファイルの列挙と読み込み）、`ChildProcessGitRunner`（時間上限つきで `git` を実行）、`OsNetworkInfo`（インタフェースの IP とホスト名）。
      対象: `packages/server/src/infra/FsManifestSource.ts` `ChildProcessGitRunner.ts` `OsNetworkInfo.ts`（新規作成）/ 根拠: architecture「infra/*」と interface
      依存: T1
      AC: AC7
- [x] T9: `LayoutTree` を作る（純関数）。
      split・remove・swap・neighbor（方向の隣）・cycleOrder（深さ優先）・setRatio（0.05〜0.95 に丸める）・resizeBy・findSplit・leaves。
      対象: `packages/server/src/session/LayoutTree.ts`（新規作成）/ 根拠: architecture「LayoutTree」・design「セッションのモデル」
      依存: T4
      AC: AC3
- [x] T10: `SessionModel` と `EventBus` を作る。
      - `SessionModel`：Map での保持、種類ごとの `nextId`（w / t / p / s / a）、LayoutTree を使った操作、`SessionSnapshot` の組み立て。副作用なし。
      - `EventBus`：型付きの同期のイベント。
      対象: `packages/server/src/session/SessionModel.ts` `packages/server/src/bus/EventBus.ts`（新規作成）/ 根拠: architecture「SessionModel」「EventBus」
      依存: T4, T9
      AC: AC1, AC2, AC3
- [x] T11: `Mirror` を作る。
      - `@xterm/headless` 6.0.0 と `@xterm/addon-serialize` 0.14.0 の包み：未処理のバイト数と `onDrained`（< 256KB）、`serialize(scrollbackLines)`、`bottomLines(n)`。
      - OSC の取得：0/2（タイトル）、7（cwd）、9;4（進捗）。
      - 問い合わせへの応答：`onResponse`（→ PTY）。色の問い合わせ（OSC 4/10/11/12）への応答は既定のテーマで足す（D17）。
      - テスト：evidence の `query-response*.mjs` と同じ問い合わせで応答を確かめる。
      対象: `packages/server/src/terminal/Mirror.ts`（新規作成）/ 根拠: research A3・design E1・E2・architecture「Mirror」interface
      依存: T4
      AC: AC4, AC5, AC8
- [x] T12: `OutputFanout` を作る。
      購読者ごとの状態（buffering / live / stale）、継ぎ目の手順（溜め置き → `write('', cb)` → serialize → SNAPSHOT → 溜め置きを送る）、**世代番号**（古い `cb` を無視する）、溜め置きが 2MB を超えたら stale、`bufferedAmount` が 2MB を超えたら stale、`retryStale`（< 256KB で再開）。
      偽の `ClientSink` と偽の `Mirror` で、欠落と重複が無いことを確かめる。
      対象: `packages/server/src/terminal/OutputFanout.ts`（新規作成）/ 根拠: architecture「購読者の状態」・design「スナップショットと差分の継ぎ目」
      依存: T11
      AC: AC8, AC9, AC17
- [x] T13: `TerminalHost` と `TerminalManager` を作る。
      - `TerminalHost`：PTY の出力を `Mirror.write` と `OutputFanout.push(utf8)` に同じ呼び出しで渡す。ミラーの未処理が 1MB を超えたら `pause`、`onDrained` で `resume` と `retryStale`。あわせて `onExit`・`lastOutputAt`。
      - `TerminalManager`：`get` / `create`（既定シェルは `ProcessInspector.defaultShell()`。失敗は `spawn_failed` の例外）/ `resize` / `dispose`。
      対象: `packages/server/src/terminal/TerminalHost.ts` `packages/server/src/terminal/TerminalManager.ts`（新規作成）/ 根拠: architecture「TerminalHost」「TerminalManager」interface・「流量制御と文字列の変換」
      依存: T6, T7, T11, T12
      AC: AC4, AC8, AC17
- [x] T14: herdr のソースで、シェルが終了したときの pane の扱い（D18）を確かめる。
      結果を decisions.md に記録する。D18（pane を閉じる）と違えば、T17 の仕様を herdr に合わせる。
      対象: 未特定（herdr のコミット `da6bcd5` の Rust ソースのうち、pane の終了を扱う箇所。Apache-2.0。D5）
      依存: なし
      AC: なし
- [x] T15: `AuthService`・`OriginPolicy`・`LoginRateLimiter` を作る。
      - `AuthService`
        - token：初回の生成（`ensureToken`）、scrypt での検証、`token reset`（全セッションの失効）。
        - セッション：発行・14 日の延長・失効（失効時に `auth.session_revoked` を発行）、Cookie の解釈。
        - `AuthorizeUpgrade`（`{ ok, sessionId }`）の型の定義と、その関数の提供。
      - `OriginPolicy`：許可ホスト（ループバック・待ち受けアドレス・全インタフェース・`--origin`）と Origin の判定。`NetworkInfo` を偽物にして単体テストする。
      - `LoginRateLimiter`：1 分 5 回・1 時間 20 回。
      対象: `packages/server/src/auth/AuthService.ts` `OriginPolicy.ts` `LoginRateLimiter.ts`（新規作成）/ 根拠: design「HTTP」「接続の条件」・architecture「AuthService」
      依存: T3, T5, T8, T10
      AC: AC10, AC11
- [x] T16: `HttpServer` を作る。
      - 静的配信（`packages/web/dist`。無ければ仮のページ）。
      - API：`POST /api/login`（Origin の検証・試行回数の制限・Cookie の発行）、`POST /api/logout`、`GET /api/session`。
      - 全応答のセキュリティヘッダ（CSP・X-Frame-Options・Referrer-Policy・nosniff）。
      - `config` に従った TLS。
      - テスト：ログインの成功・失敗・429、Origin の不一致、ヘッダを HTTP の結合テストで確かめる。
      対象: `packages/server/src/http/HttpServer.ts`（新規作成）/ 根拠: design「HTTP」・architecture「HttpServer」
      依存: T3, T15
      AC: AC10, AC11
- [x] T17: `SessionService` と `PersistScheduler` を作る。
      - 利用者の操作：workspace / tab / pane の作成・名前変更・フォーカス・閉じる・分割・入れ替え・拡大表示・resize・比率・右クリックの宛先。
      - 実行時の情報の更新：`resizePane`・`updatePaneRuntime`・`updateWorkspaceGit`。
      - 異常系・端末の終了：`spawn_failed` での巻き戻し、`onExit` の購読と D18 の連鎖（`pane.exited` → `pane.closed` → …）、workspace が 0 個になったら自動作成（D24）。
      - 起動時の `restore`（失敗した pane は `status: 'failed'`）。
      - 保存の予約（500ms まとめ・終了時の `flush`）。
      対象: `packages/server/src/session/SessionService.ts` `packages/server/src/session/PersistScheduler.ts`（新規作成）/ 根拠: architecture「SessionService」interface・design「再起動後の復元」「エラー処理」
      依存: T5, T10, T13, T14
      AC: AC1, AC2, AC3, AC18
- [x] T18: `ClientRegistry` と `SizeAuthority` を作る。
      - `ClientRegistry`：clientId の払い出し・kind・fit・表示・購読。
      - `SizeAuthority`：tab ごとの権限。入力・フォーカス・レイアウトの操作で権限を取り、切断や tab の移動で移す。モバイルは fit のときだけ権限を取る。決まったサイズは `SessionService.resizePane` へ渡す。
      対象: `packages/server/src/clients/ClientRegistry.ts` `packages/server/src/clients/SizeAuthority.ts`（新規作成）/ 根拠: design「サイズ権限」・architecture interface
      依存: T10, T17
      AC: AC9
- [x] T19: `ControlSurface` と `methods/*` を作る。
      - `ControlSurface`：登録表、zod での検証、例外から `{ code, message }` への変換。
      - `methods/*`：design と architecture の全方式。`client.hello` は snapshot を返す。`pane.subscribe` は `ClientRegistry.addSubscription` → `fanout.subscribe(ctx.sink, lines)`。
      対象: `packages/server/src/surface/ControlSurface.ts` `packages/server/src/surface/methods/*.ts`（新規作成）/ 根拠: architecture「ControlSurface」interface・「方式の追加と変更」
      依存: T4, T17, T18
      AC: AC1, AC2, AC3, AC8, AC9
- [x] T20: `WsServer`・`WsServerWs`・`WsGateway` を作る。
      - `WsServerWs`：ws 8.21、`perMessageDeflate`（`threshold: 1024`）、upgrade 時の `AuthorizeUpgrade`（不可なら 403）。
      - `WsGateway`
        - フレームの送受信：JSON → `invoke`、INPUT → `write`＋`noteInteraction`、`EventBus` の転送、`ClientSink`。
        - 流量と切断：`onDrain` → `retryStale`、切断時の購読の後始末。
        - 異常時の切断：`auth.session_revoked` → 4401、不正なフレームは `client.error`（10 秒に 10 回を超えたら 1008）。
      - 結合テスト：拒否（Cookie 無し・Origin 違い）、往復、2 クライアント、4401。
      対象: `packages/server/src/ws/WsServer.ts` `WsServerWs.ts` `WsGateway.ts`（新規作成）/ 根拠: architecture「WsGateway」・design「WebSocket の通信」
      依存: T13, T15, T19
      AC: AC8, AC9, AC10
- [x] T21: `GitInfoPoller` を作る。
      workspace の cwd ごとに 5 秒間隔でブランチと ahead / behind を取り、変化したら `SessionService.updateWorkspaceGit` を呼ぶ。git の外なら `null`。
      対象: `packages/server/src/git/GitInfoPoller.ts`（新規作成）/ 根拠: architecture「GitInfoPoller」・design「セッションのモデル（git）」
      依存: T8, T17
      AC: AC7
- [x] T22: `main.ts` と `smoke.ts` を作り、起動確認を通す。
      - `main.ts`
        - CLI（`serve`・`token reset`）と部品の組み立て。
        - 起動：`restore`（無ければ workspace を 1 つ作る）、初回だけ token 付きの URL を表示。
        - 終了のシグナルで `flush` → `dispose`。エージェント判定（02）を差し込む場所を用意する。
      - `smoke.ts`：空きポート・一時ディレクトリで起動し、正規のログイン → `client.hello` → `workspace.create` → `echo` の往復を確かめて終了する。
      - 最後に `aidev smoke` が通ることを確かめる。
      対象: `packages/server/src/main.ts` `packages/server/src/smoke.ts`（新規作成）・ルートの `package.json` の `smoke` スクリプト / 根拠: architecture「main.ts」「smoke.ts」・「起動と再起動後の復元」
      依存: T2, T3, T16, T20, T21
      AC: AC8, AC11, AC18
- [x] T23: 流量制御を実際に働かせる（親 decisions.md D98。親の統合 test の AC17 の計測で発見・差し戻し）。
      (1) `WsServerWs.onDrain` を一定間隔（50ms）で呼ぶ形にする（`ws` の WebSocket は `drain` を emit しない）。
      (2) OUTPUT フレームは permessage-deflate で圧縮せずに送る（`sendBinary(frame, { compress: false })`）。
      対象: `packages/server/src/ws/WsServerWs.ts`・`packages/server/src/ws/WsServer.ts`・`packages/server/src/ws/WsGateway.ts`
      依存: T20
      AC: AC17
      完了メモ: 回帰テスト 2 件（`WsGateway.integration.test.ts` の「WsGateway flow control」）。どちらも**修正前のコードに
      戻すと落ちる**ことを確かめた（onDrain は 0 回しか呼ばれない・大量出力の pane の隣の pane の出力が届かない）。
      最初に書いた「受信を止めて再開すると新しい SNAPSHOT が届く」テストは、修正前でも通ってしまった——出力を出し続ける
      pane はミラーが追いつくたびにも `retryStale` が呼ばれる（`TerminalHost`）ため。永久に止まるのは「混んでいる瞬間に
      小さな出力を出して黙った pane」で、これを狙ってテストで作るのはカーネルのソケットバッファの大きさ次第で不安定なので、
      不具合の核心（onDrain が実物の ws の上で実際に呼ばれるか）を直接確かめるテストに差し替えた。
      `pnpm -s test`（776 passed）。
- [x] T24: 分割・pane を閉じる操作で zoom を解除する（親 decisions.md D100。03 の T30 の独立点検で発見）。
      herdr の `Tab::split_pane_with_runtime` と `Tab::detach_pane` がどちらも `zoomed = false` にするのに合わせる
      （これまでは分割しても zoom が残り、新しい pane が隠れたまま焦点だけが移っていた。閉じるときは zoom 中の pane
      自身を閉じたときだけ解除していた）。
      対象: `packages/server/src/session/SessionModel.ts` `splitPane` `closePane`（コメントのみ `packages/web/src/actions/ActionDispatcher.ts` `releaseHold`）
      依存: T10
      AC: AC3, AC-I4
      完了メモ: 単体テスト 2 件（`SessionModel.test.ts`「zoom 中に分割すると…」「zoom 中にどの pane を閉じても…」）。
      **修正前のコードに戻すと 2 件とも落ちる**ことを確かめた。クライアントへは既存の `layout.updated`（tab 全体を送る）で
      届くので、プロトコルの変更は無い。`pnpm -s test`（790 passed）。
- [x] T25: `0.0.0.0` / `::` で待ち受けるとき、開けない `https://0.0.0.0:…/#token=…` ではなく、開ける URL（`localhost` と
      LAN の IPv4 ごと）を表示する（親 decisions.md D101。親の統合 test で発見した残件）。
      対象: `packages/server/src/util/net.ts` `accessUrls` `lanIpv4Addresses` `formatUrlHost`（新規）・
      `packages/server/src/infra/OsNetworkInfo.ts` `lanAddresses`・`packages/server/src/auth/OriginPolicy.ts`（ホスト名の
      大文字小文字・明示したループバックの名前）・`packages/server/src/config.ts`（`--host` の角括弧・`--origin` の正規化）・
      `packages/server/src/composeServer.ts` `listen`（待ち受けの失敗を reject）・`packages/server/src/main.ts` `runServe`・
      `docs/tls-setup.md`（`--origin` の例にポート）・
      `packages/e2e/src/specs/tls-lan.spec.ts`（LAN の IP の URL が表示されることを確かめる）
      依存: T22
      AC: AC11
      完了メモ: 単体テスト（`net.test.ts`「lanIpv4Addresses」「accessUrls」、`OriginPolicy.test.ts`「ホスト名の大文字小文字・
      起動時に表示する URL」）。OriginPolicy の 2 つの修正は、それぞれ外すと落ちることを確かめた。tls-lan spec は「`wtm: open https://<LAN の IP>:<port>/#token=`
      の行が出る」ことを待つ形に変え、**修正前の表示に戻すと落ちる**（15 秒待っても行が出ない）ことを確かめた。
      独立点検のラウンド2の指摘（角括弧付きの `--host` で落ちる・`--origin` の正規化）も直し、`config.test.ts`・
      `composeServer.integration.test.ts`（ポートが使用中なら `listen()` が reject）を足した。どれも修正を外すと落ちる。
      実物の CLI で `--host [::1]` の起動・ポートが使用中・不正な `--origin` を確かめた（後の 2 つは終了コード 2 と案内）。
      `pnpm -s test`（799 passed）。
- [x] T26: ブラウザからサーバへの到達経路のモデルを設計に書き、それに合わせて表示・許可・起動順・docs を直す（親 decisions.md D102。
      01 の review ラウンド5の差し戻し→デバッグ D1 の原因究明の修正方針 F1〜F8）。
      (F1) design「Origin の許可リスト」「起動時の表示」「WSL2」・architecture §6 に構成ごとの到達経路と新しい起動順を書く。
      (F2) `--origin` を開ける URL として先頭に表示。(F3) docs の WSL2 NAT＋portproxy の手順に `--port`・`--origin`・SAN。
      (F4) Origin での拒否を warn でログ（design「ログに接続元と Origin を残す」）。(F5) bind → token → 復元 → poller →
      `/ws` の受付の順にする（待ち受けに失敗しても token を失わない・シェルを起動しない・session.json を書き換えない）。
      (F6) 待ち受け失敗の文言。(F7) docker・仮想スイッチのブリッジを表示から除く。(F8) 角括弧を外す処理の統合。
      対象: `packages/server/src/util/net.ts`・`config.ts`・`main.ts`・`composeServer.ts`・`infra/OsNetworkInfo.ts`・
      `http/HttpServer.ts`・`ws/WsServerWs.ts`・`smoke.ts`・`packages/e2e/src/support/appServer.ts`・
      `packages/e2e/src/specs/tls-lan.spec.ts`・`docs/tls-setup.md`・`docs/verification.md`・親の `design.md`・`architecture.md`
      依存: T25
      AC: AC11, AC16
      完了メモ: デバッグ D1（原因究明）の修正方針 F1〜F8 を新しい実装コンテキストで実装。独立点検の 9 件（token を作った後の
      失敗でも token を表示・Origin 拒否のログの間引きと切り詰め・仮想スイッチ/ブリッジの除外を完全一致に・`close()` の順序と
      保存の予約の取り消し・`EAI_AGAIN`・`--state-dir` の案内・docs）も直した。足したテストはどれも修正を外すと落ちる。
      実物の CLI：使用中のポート（exit 2・再起動で token 付きの URL）・`--origin` が先頭・portproxy を模した Host/Origin は
      `--origin` 無しで 403 と `origin rejected`・有りで 401。`pnpm -s test`（826 passed）・e2e（`--workers=1`）35 passed。
- [x] T27: `wtm serve --shell` を効かせる（T26 の作業中に発見。値が `ServeOptions.shell` に入るだけでどこにも渡されず、新しい pane は
      常に `$SHELL` で起動していた。design「起動オプション」の `--shell`）。
      対象: `packages/server/src/session/SessionService.ts` `spawnForPane`・`packages/server/src/composeServer.ts`
      依存: T17
      AC: AC16
      完了メモ: 単体テスト 2 件（`SessionService.test.ts`「`--shell`（T27）」。外すと落ちる）。実物の CLI で `--shell /bin/sh` の
      pane のプロセスが `/bin/sh` であることを確かめた。独立点検の nit 2 件（復元の経路のテスト・pane の `shell` に
      `--shell` を記録）も直した。`pnpm -s test`（831 passed）。
- [x] T28: 01 の review ラウンド6の 01 の範囲の指摘を直す（親 decisions.md D103）。(a) 解釈できない request-target（`GET //` 等）は
      400 で返しログに書かない（認証前の相手に error 行を書かせない）。(b) state-dir のロック（pid 付きの排他ファイル。ポート違いの
      二重起動も止める。古いロックは pid が生きていなければ引き継ぐ）。(c) listen() の成功後の失敗（URL の組み立て）でも token を
      必ず表示する・ゾーン付きの IPv6 を URL にできる形にする。(d) tls-lan の e2e が「LAN の IP を表示しない」退行を skip で見逃さない。
      (e) design・architecture を最終形に追従させる。(f) Origin の判定→記録→403 を 1 か所にまとめ `OriginRejectionLog` を必須にする・
      bind の失敗の判定を 1 か所にまとめる。
      対象: `packages/server/src/http/HttpServer.ts`・`ws/WsServerWs.ts`・`composeServer.ts`・`main.ts`・`config.ts`・`util/net.ts`・
      `auth/OriginRejectionLog.ts`・`packages/e2e/src/specs/tls-lan.spec.ts`・親の `design.md`・`architecture.md`
      依存: T26
      AC: AC10, AC11, AC16, AC18
      完了メモ: 新しい実装コンテキストで実装（D103）。作業中に以前からの不具合 3 つも直した：`wtm token reset` が一度も
      動いていなかった（`reset` をオプションとして読んでいた）・`%` の壊れた Cookie で 3 経路が 500 と error 行・知らない
      セッションの logout で auth.json を書き直していた。独立点検の 8 件（ロックの前に auth.json を読んでいた＝should・
      ホスト名入りのロック・release の失敗・起動の途中のシグナル・`//foo`・CLI の厳格化・tls-lan の時間差・単調な時計）も直した。
      足したテストはどれも修正を外すと落ちる。実物の CLI で二重起動（exit 2）・動作中の token reset（exit 2）・停止後の
      token reset（exit 0）・`//foo`（200・error 行 0）・CLI の打ち間違い（exit 2）を確かめた。`pnpm -s test`（882 passed）。
      独立点検はラウンド1で止めた（ラウンド1の修正はどれも否定対照で裏付け。残りの確認は 01 の review に委ねる）。
- [x] T29: 統合 review ラウンド1 の 01 の範囲を直す（親 decisions.md D106）。(a) `SizeAuthority.onViewChanged` が、権限者のいない tab を
      fit していないモバイルにも渡していた（`noteInteraction`・`transferOwnership` と同じ資格の確認を入れる。D13）。(b) 有効な Cookie の
      まま Host/Origin が許可外になると、`/ws` は 403 なのに `/api/session` は 204 を返し、Web が理由を示さず再試行し続ける——`/api/session`
      も許可外の Host（と、送られていれば Origin）を 403 で断る（ブラウザは同じオリジンの GET に Origin を付けないので Host で見る）。
      (c) `LoginRateLimiter` と WsGateway の不正なフレームの窓を単調な時計にする。
      対象: `packages/server/src/clients/SizeAuthority.ts`・`packages/server/src/http/HttpServer.ts`・`packages/server/src/auth/OriginPolicy.ts`・
      `packages/server/src/auth/LoginRateLimiter.ts`・`packages/server/src/ws/WsGateway.ts`
      依存: T28
      AC: AC8, AC10, AC12
      完了メモ: 新しい実装コンテキストで実装（D106）。(a) 資格の判定を `canDecideSize` にまとめ全経路で使う（fit の有効化はどの
      kind でも権限を取る・無効化で手放すのはモバイルだけ・hello で資格を失ったら手放す）。(b) `/api/session` は Cookie の確認の後に
      Host（と、あれば Origin）を見て 403（`isHostAllowed`。既定ポートの `--origin` は `host:443`／`:80` も許す）。(c) 単調な時計。
      (a) の直接の結果として、D13 違反を前提にしていた `mobile.spec.ts` の D105 の test を fit を押す形に直した（直す前の
      PaneLayout に戻すと 2 つの確認とも落ちる）。独立点検の 5 件のうち 4 件を直し、1 件（再接続の後の fit の状態のずれ）は 03・04 へ。
      `pnpm -s test`（955 passed）・既定の E2E 42 passed。
