# 調査: 高負荷のときだけ落ちる単体・結合テスト

（変更前のスナップショット。生の記録は scratchpad `load-flaky-tests/` に置き、test-result.md に移す）

## 調査の問い

- Q1: `main.integration.test.ts` の AC9 で cookie が `undefined` になるのはなぜか。負荷に依存するか。
- Q2: 「workspace create」（同ファイル 81 行目）が 5000ms を超えるのは何に時間を使うからか。
- Q3: 空きポートの取り合いはどこで起きうるか。`listen(0)` の結果を使う形にできるか。
- Q4: 時間切れで落ちるテストは本当に重いのか（何が重いか）。負荷の下でどれだけかかるか。
- Q5: 負荷の再現条件（修正前・修正後の比較に使う）をどう置けば、落ち方が再現するか。

## 判明した事実

- F1（Q1）: `FsSessionStore.save` は `writeFile(this.filePath, …)`（`packages/cli/src/session.ts` `save`）で、ファイルを切り詰めてから書く。
  `load` は JSON として読めなければ `{ sessions: {} }` を返す（同 `load`）。書き込みの途中を読んだ操作は「空」とみなし、その操作が
  `set`/`clear` なら空＋自分の 1 件を保存し直すので、ほかの origin の cookie が消える。実測（`race3.mjs`）: 書き込み 2000 回と並行した
  読み取り 4380 回のうち 392 回が「無い」を読んだ。
- F2（Q1）: `load→変更→save` は直列化されていない（同 `set`・`clear`）。同じインスタンスで 2 つの origin を `Promise.all` で `set` すると、
  両方が同じ内容を読んでから書くので片方が消える（`race4.mjs`: 50 回中 50 回）。
- F3（Q1）: `main.integration.test.ts` の「watch」の `it`（`runWatch` を待たずに走らせたまま、`runWorkspaceCreate` を繰り返す）は、
  同じ `store` で並行に `get`/`set` する。`runWatch`（`withSession` → `login` → `store.set`）の保存の途中を `runWorkspaceCreate` の
  `withSession`（`store.get` → 無い → `login` → `store.set`）が読むと、F1 により主サーバ（`url`）の cookie が消える。後の AC9 の `it` が
  `(await store.get(url))!` を `cookie` ヘッダに入れて `Invalid value "undefined"` になる。**負荷とは無関係**に、単独・load average 1〜4 で
  10 回中 2 回落ちた（`pre/summary.txt`）。
- F4（Q2）: 「workspace create」は `login`（サーバ側で scrypt。`packages/server/src/auth/AuthService.ts` `login`）→ WS 接続 → `client.hello`
  → `workspace.create`（`SessionService.createWorkspace`: 自動の名前の決定・実 PTY の起動と 300ms の猶予 `DEFAULT_SPAWN_GRACE_MS`
  `packages/server/src/session/SessionService.ts:40`・`raceSpawn`）。単独・低負荷で 612〜1578ms（10 回）。時間の上限は既定の 5000ms
  （`it` に第 3 引数が無い）。同じファイルのほかの実サーバの `it` には 15〜20 秒が与えてある（`main.integration.test.ts:144,183,225`）。
  主エージェントが見た「単独で 3 回中 1 回 5000ms」は、この調査の 10 回では再現しなかった（最大 1578ms）。
- F5（Q3）: `getFreePort`（`listen(0)` で番号を取って閉じる）を持つテストは server・cli に 8 ファイル（`composeServer.integration.test.ts`・
  `ws/WsGateway.integration.test.ts`・`http/HttpServer.integration.test.ts`・cli の `main`/`agent`/`agentPrompt`/`attach` の `*.integration.test.ts`・
  `wsClient.test.ts`）、ほかに `smoke.ts` 2 本と E2E の `support/freePort.ts`。閉じてから listen するまでの間に、並行する別のテスト
  （別のワーカー・別のセッション）の `getFreePort` や、外向きの接続の送信元ポートが同じ番号を取りうる。
- F6（Q3）: `composeServer` のポートは `resolveServeOptions` の `parsePort` が 1〜65535 に限り（`packages/server/src/config.ts` `parsePort`）、
  `port: "0"` は既存のテストが設定の誤りとして断っている（`packages/server/src/config.test.ts:71-73`）。ポートは組み立ての時点で
  `DefaultOriginPolicy` に渡る（`composeServer.ts:111-114`）。`listen(0)` の結果を使うには `wtm serve --port 0` の意味を変える必要がある。
- F7（Q3）: 待ち受けに失敗した `listen()` は reject し、token を作らず・シェルを起動せず・ロックを放す（`composeServer.integration.test.ts`
  の D101・D102・D103 の各 `it`。`listen()` 本体 `composeServer.ts:221-240`）。失敗した組み立てに `close()` を呼んでよい（同 D102 の `it`）。
  つまり「EADDRINUSE なら組み立て直して取り直す」は、状態を残さずにやり直せる。
- F8（Q3）: `WsGateway.integration.test.ts`・`HttpServer.integration.test.ts` は `http.Server` を自分で `listen(port)` する。
  `DefaultOriginPolicy` は受け取った `opts` を持ち、`allowedHostPorts()` のたびに `this.opts.port` を読む
  （`packages/server/src/auth/OriginPolicy.ts:33-34`）。`listen(0)` の後に同じ `opts` の `port` を実際の番号にすれば、取り合いそのものが起きない。
- F9（Q4）: 時間切れになったテストの重さ（負荷なしの実測、`web-noload.log`・`compose-noload.log`）:
  SettingsDialog の各 `it` は `openDialog`（`SettingsDialog.vue` 1219 行を happy-dom に丸ごと描く）で 90〜700ms、App の各 `it` は
  `mount(App)`（xterm.js を含む）で 170〜470ms、composeServer の D103 #1 は 737ms（scrypt 6 回＋実 PTY）、偽の claude は実 PTY＋検出の周期。
  `GitInfoPoller.test.ts` の追従の `describe` は `beforeEach` で実 git のリポジトリを 2 つ作り（git を 8 回起動。`GitInfoPoller.test.ts:236-244`）、
  `it` の中で `vi.waitFor(…, { timeout: 5000 })` を使う（同 309 行）——**`it` の上限（既定 5000ms）と中の待ちの上限が同じ**なので、
  負荷の下では `waitFor` が自分の上限に届く前に `it` が時間切れになる。偽の claude は `waitForEvent(…, 8000)` を `it` の上限 15000 の中で待つ。

## 影響範囲

- 製品: `packages/cli/src/session.ts`（`FsSessionStore`）だけ。`withSession`・各コマンドは `SessionStore` の外形しか使わない。
- テスト: cli・server・web の上記ファイル。E2E は触らない。

## 実現性 / リスク

- 原子的な書き込みは server の `writeFileAtomic`（`packages/server/src/persist/atomicFile.ts:9-23`。同じディレクトリの一時ファイルに書いて
  `rename`）と同じ形で書ける。cli は server に実行時に依存していない（`packages/cli/package.json` の `dependencies` に無い）ので写す。
- `rename` による置き換えは Windows でも既存のファイルを置き換える（Node の `fs.rename`）。ただし読み手が開いている瞬間に EPERM に
  なりうる——Windows では確かめられない（未検証の穴）。

## 実装アンカー

- A1: キャッシュの保存（`packages/cli/src/session.ts` `FsSessionStore.save`・`set`・`clear`）
- A2: キャッシュのテスト（`packages/cli/src/session.test.ts`）
- A3: 空きポート（各ファイルの `getFreePort`。F5 の一覧）
- A4: 時間の上限（`main.integration.test.ts` の 81・95・106・227・254 行の `it`／`composeServer.integration.test.ts:258`／
  `GitInfoPoller.test.ts` の追従の `describe`（225 行付近〜）／`SettingsDialog.test.ts`・`SettingsDialog.symbolsNote.test.ts`・`App.test.ts` の全体）

## 実装時の注意

- `composeServer.integration.test.ts` の「待ち受けに失敗したら…」系の `it` は**わざと** EADDRINUSE を起こす（blocker を listen させる）。
  取り直しの仕組みをそこへ当てると、確かめている内容が消える。
- 「同じ state-dir の 2 つ目」系の `it` は 2 つ目がロックで断られることを確かめる（bind しない）。
- `main.integration.test.ts` の `it` は前の `it` の結果（`workspaceId`・`paneId`・キャッシュ）に依存する。最初の `it` の時間切れは後続へ連鎖する。

- F10（Q5）: 負荷の再現（修正前）。条件 F（busy loop 4 本＋全体テスト、load average 最大 21〜25）で 4 回中 2 回落ちた
  （偽の claude・GitInfoPoller の追従・SettingsDialog の色の上書き。`runs/pre-b4-*.log`）。条件 C（busy loop 12 本＋対象の 6 ファイル、
  load average 最大 21〜23）で **6 回中 6 回**落ちた（App 2 件・偽の claude 3 回・GitInfoPoller の追従・D103 #1・cli の watch の時間切れと
  その漏れ出た出力による login の `JSON.parse` 失敗。`runs/preC-*.log`）。条件 C のほうが比較に使える（毎回落ちる）。
  busy loop 14 本＋全体テスト（load average 29）では 18 件落ちた（`pre/full-load-1.log`）。
- F11（Q4）: 条件 C で上限を 120 秒にして測った所要時間（2 回の最大。`runs/measC-*.json`）:
  - cli `main.integration`: `--follow` 9570ms（上限 20000）・watch 7137ms（上限 15000）・workspace create 3433ms（上限 既定 5000）・
    pane run→read 2656ms・split 2312ms・login 2146ms。
  - server `composeServer.integration`: `--session work` 15654ms（上限 20000）・偽の claude 9187ms（上限 15000、中の待ち 8000）・
    2 つ目は ConfigError 6014ms・D103 #1 5275ms・persists 5082ms・`--worktree-dir` 5058ms・editor の後始末 4044ms ほか。
  - server `GitInfoPoller`: 最大 1900ms（ただし条件 F の 1 回で追従の `it` が 5776ms かかって落ちている——ばらつきが大きい）。
  - web: `App.test.ts` 最大 4503ms・`SettingsDialog.test.ts` 最大 4418ms・`SettingsDialog.symbolsNote.test.ts` 2522ms。
- F12（Q1 の補足）: `main.integration.test.ts` を単独で 20 回（修正前・負荷なし〜load average 10）流して AC9 が 2 回落ちた（`pre/summary.txt`）。
  「workspace create」は 20 回とも 617〜1578ms で、5000ms の時間切れは再現しなかった。

## design への申し送り

- AC9 の落ち方は製品の不具合（F1〜F3）。負荷で直すものではない。
- 空きポートは `composeServer` 系と自前の `http.Server` 系で直し方を分ける（F6・F8）。
- 時間の上限は F11 の実測を根拠にする。条件 C で所要が上限の半分を超えるテストが、記録された 5 件のほかにも同じファイルにある
  （`--session work`・偽の claude・watch）。ファイル単位で見る。
- 比較には条件 C（毎回落ちる）を主に使い、条件 F を補助にする。
