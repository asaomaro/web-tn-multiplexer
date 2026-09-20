# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [must][conv:-] packages/server/src/session/SessionService.ts:139-147 (closeWorkspace), :178-185 (closeTab) 連鎖で消える pane/tab の `pane.closed`/`tab.closed` を出していなかった（`closePane` だけ正しく実装していた） / 対応: 修正済（cross taskcheck・D42）
- [nit][conv:-] packages/web/src/actions/ActionDispatcher.ts:163-168 `releaseHold` のコメントが「zoom で隠れるのは応答までの間に別のクライアントが zoom した場合に限られる」としていたが、分割の確定で zoom を解除し応答はその直後に返すので、その場合にも起きない（T24） / 対応: 修正済（「サーバの処理順では通常起きない。順序の前提が崩れたときの保険」に書き直し）
- [nit][conv:-] packages/server/src/session/SessionModel.test.ts 分割のテストが zoom 中の pane 自身の分割しか試しておらず、「zoom 中の pane を分割したときだけ解除」に戻っても通ってしまう（T24） / 対応: 修正済（別の pane を分割するケースを足し、条件付きの解除に戻すと落ちることを確認）
- [should][conv:-] packages/server/src/util/net.ts `accessUrls` がループバックを `127.*` の前方一致だけで除いており、ループバックの I/F に載った他のアドレス（WSL2 の `lo` の `10.255.255.254`）を開ける URL として token 付きで表示していた。`OsNetworkInfo.addresses()` が `internal`・`family` を捨てているのが原因（T25） / 対応: 修正済（純関数 `lanIpv4Addresses` が `internal`・`family` で絞り、`NetworkInfo.lanAddresses()` として公開）
- [nit][conv:-] packages/server/src/util/net.ts JSDoc の「どれも OriginPolicy が許可する」が、明示したホストでは成り立たなかった（`foo.localhost` は許可リストに入らず、大文字を含むホスト名は大文字小文字を区別して比べるため拒否）（T25） / 対応: 修正済（OriginPolicy がホスト名を小文字にそろえて比べ、明示したループバックの名前も許すようにし、表示する URL がどれも許可されることをテストで保証）
- [nit][conv:-] packages/server/src/main.ts `wtm: listening on` の行が IPv6 を角括弧で囲まず `https://:::8443` と崩れていた（T25） / 対応: 修正済（`formatUrlHost` を通す）
- [nit][conv:-] packages/e2e/src/specs/tls-lan.spec.ts LAN の IP の自動選択が `169.254.*` を除いておらず、`accessUrls` の除外条件とずれていた（T25） / 対応: 修正済
- [nit][conv:-] packages/server/src/util/net.ts IPv6 の角括弧付けが OriginPolicy の `formatHostPort`・`formatHostBare` と重複していた（T25） / 対応: 修正済（`formatUrlHost` を export して OriginPolicy からも使う）
- [nit][conv:-] packages/server/src/util/net.test.ts `[::]`・LAN のアドレスが無い場合・`::` の全体の期待値が無かった（T25） / 対応: 修正済
- [should][conv:-] packages/server/src/config.ts `--host [::1]` のような角括弧付きの IPv6 は表示・許可リストでは正しく扱えたが、`listen()` が名前として引いて `ENOTFOUND` になり、`composeServer.listen()` が error を拾わないため未処理の 'error' でプロセスが落ちていた（以前からの不具合。T25 ラウンド2） / 対応: 修正済（`resolveServeOptions` で角括弧を外し、`listen()` は error で reject、`main` が案内を出して終了コード 2。ポートが使用中のときも同じ経路になる）
- [nit][conv:-] packages/server/src/util/net.ts `family` の数値（Node 18.0〜18.3）への互換分岐は、engines が node >=24 なので実行されない（T25 ラウンド2） / 対応: 修正済（削除）
- [nit][conv:-] packages/server/src/auth/OriginPolicy.test.ts 表示する URL がどれも許可されることの横断テストが、既定ポート（443/80。ブラウザはポートを省く）を通っていなかった（T25 ラウンド2） / 対応: 修正済（443・80 の組を追加）
- [nit][conv:-] packages/server/src/auth/OriginPolicy.ts `--origin` を URL として正規化しておらず、`https://x:443` や末尾の `/` がブラウザの `https://x` と一致しなかった。docs/tls-setup.md の Tailscale の例もポート（既定 7780）が無く、そのままでは一致しなかった（以前からの問題。T25 ラウンド2） / 対応: 修正済（`resolveServeOptions` が `URL.origin` にそろえ、Origin でないものは起動時に拒む。docs の例にポートを足した）
- [should][conv:-] packages/server/src/composeServer.ts bind → token → 復元の順でも、token を作った後の失敗（初回の `ensureNotEmpty` の spawn_failed 等）で token を表示せずに失っていた（T26） / 対応: 修正済（`main` が `listen()` の失敗時に `freshToken` があれば表示する。不変条件「作った token は必ず一度表示される」）
- [should][conv:-] packages/server/src/http/HttpServer.ts・ws/WsServerWs.ts `origin rejected` の warn を認証なしで無制限に、相手の決める長いヘッダ付きで書かせられた（T26） / 対応: 修正済（`OriginRejectionLog`：同じ接続元・Origin・Host は 60 秒に 1 回・200 文字で切る・表は 1000 件で空に）
- [should][conv:-] packages/server/src/util/net.ts `vEthernet (WSL` の前方一致で、利用者が付けた外部スイッチ（`WSLBridge` 等）まで除き、母艦の LAN の IP を表示から落としていた（T26） / 対応: 修正済（既知の内部スイッチの名前と完全一致のものだけを除く）
- [nit][conv:-] packages/server/src/util/net.ts `br-` の前方一致が `br-lan`・`br-ex` も除いていた（T26） / 対応: 修正済（`^br-[0-9a-f]{12}$`）
- [nit][conv:-] packages/server/src/composeServer.ts 復元の途中で失敗した起動の `close()` が保存の予約を残していた（T26） / 対応: 修正済（`PersistScheduler.cancel()`）
- [nit][conv:-] packages/server/src/config.ts `EAI_AGAIN` に案内が無く終了コード 1 とスタックになっていた（T26） / 対応: 修正済
- [nit][conv:-] packages/server/src/config.ts `EADDRINUSE` の案内が別のポートを勧めるだけで、同じ state-dir の二重起動になりうることに触れていなかった（T26） / 対応: 修正済
- [nit][conv:-] packages/server/src/composeServer.ts `close()` が `/ws` の受け付けを止めずに `closeAll` していた（T26） / 対応: 修正済（最初に `setReady(false)`）
- [nit][conv:-] docs/tls-setup.md Linux の行が、`os.hostname()` 以外の名前で開くなら `--origin` が要ることを書いていなかった（T26） / 対応: 修正済
- [should][conv:-] packages/server/src/auth/OriginRejectionLog.ts 間引きが（接続元・Origin・Host）の組ごとなので、組を毎回変えれば 1 行ずつ書かせられた（T26 ラウンド2） / 対応: 修正済（全体でも 60 秒に 20 行まで。超えた件数は次の行の `suppressedOverall` に）
- [nit][conv:-] packages/server/src/auth/OriginRejectionLog.ts ログの `allowed` に `--origin` の値が入っておらず、渡した値との食い違いを確かめられなかった（T26 ラウンド2） / 対応: 修正済（`extraOrigins` を添える）
- [nit][conv:-] packages/server/src/session/SessionService.test.ts `--shell` のテストが復元の経路を通っていなかった（T27） / 対応: 修正済
- [nit][conv:-] packages/server/src/session/SessionService.ts pane の `shell` が常に空文字で、`--shell` で起動しても記録されなかった（T27） / 対応: 修正済（`--shell` の値を記録。design の `Pane.shell` に意味を書いた）
- [should][conv:-] packages/server/src/composeServer.ts `auth.initialize()`（auth.json の読み込み）がロックを取る前にあり、その間の `wtm token reset` が成功して serve が古い token のまま動き auth.json を書き戻した（T28） / 対応: 修正済（ロックを取った直後に読む）
- [nit][conv:-] packages/server/src/persist/StateDirLock.ts 「自分と同じ pid の他人のロックは取り直す」が pid 名前空間の違う（コンテナで pid 1 同士の）場合に誤判定する（T28） / 対応: 修正済（ロックにホスト名を書き、一致するときだけ）
- [nit][conv:-] packages/server/src/persist/StateDirLock.ts `release()` の unlink の失敗（Windows の EPERM/EBUSY）が上に伝わり、元の bind の失敗や正常な終了を終了コード 1 に変えた（T28） / 対応: 修正済
- [nit][conv:-] packages/server/src/main.ts SIGINT/SIGTERM のハンドラが起動の表示の後にしか無く SIGHUP も扱わないので、復元の途中のシグナルで token を表示せずロックも残した（T28） / 対応: 修正済
- [nit][conv:-] packages/server/src/util/net.ts `requestPathname` がブラウザの送る `//foo`（`https://host//foo`）まで 400 にしていた（T28） / 対応: 修正済（基底 URL との連結で解釈）
- [nit][conv:-] packages/server/src/cliArgs.ts 未知のコマンド・サブコマンドが help と終了コード 0・`token --state-dir D reset` の分かりにくいエラー・`token reset` が serve 専用のオプションを黙って受け付ける（T28） / 対応: 修正済
- [nit][conv:-] packages/e2e/src/specs/tls-lan.spec.ts 読み込み時のインタフェースの列挙とサーバの列挙の時間差で偽の失敗がありうる（T28） / 対応: 修正済（サーバの出力を受け取った直後に計算し直す）
- [nit][conv:-] packages/server/src/log/LogThrottle.ts 単調でない時計で、時計が戻ると全行を抑止し続けうる（T28） / 対応: 修正済（単調な時計）

## ラウンド1（2026-09-18T・review 工程・独立レビュー委譲）

- [must][conv:-] `composeServer().close()` が WebSocket 接続を一切閉じない（`wsServer`/`WsGateway` が返り値に保持すらされていない）ため、ブラウザが1つでも繋がったまま `SIGINT`/`SIGTERM` すると `httpServer.server.close()` のコールバックが永久に発火せず、正常終了できない。 — 根拠: packages/server/src/composeServer.ts:106-107,131-136; packages/server/src/main.ts:85-97
- [must][conv:-] `createWorkspace`/`createTab` が PTY 起動の成功を確認する**前**に `SessionModel` へコミットしてしまい（D37「成功を確認してからモデルを更新する順にする」に違反）、失敗時のロールバックもイベントを出さない。`splitPane` は id だけ予約してから成功後にコミットする正しい形になっている。 — 根拠: packages/server/src/session/SessionService.ts:109-126 (createWorkspace), 154-168 (createTab) vs 194-204 (splitPane)
- [must][conv:-] `TerminalManager.create()` が登録する `host.onExit(() => hosts.delete(paneId))` が `SessionService` 側の `onExit` より先に走るため、通常のシェル終了や D37 の起動失敗パスで `terminals.dispose(paneId)` を呼んだときには既に `hosts` から消えており、`TerminalHost.dispose()`/`Mirror.dispose()` が呼ばれない（リソースリーク。1 pane 最大 ~25MB・D20）。 — 根拠: packages/server/src/terminal/TerminalManager.ts:40-57,63-68; packages/server/src/terminal/TerminalHost.ts:66-69,89-92,94-104; packages/server/src/session/SessionService.ts:305-317,324-333
- [must][conv:-] D37 の猶予時間内にシェルが exit code 0 で終了すると、`wireExit` の `onExit` 登録が実際の exit イベントより後になり（`TerminalHost.onExit` は一度きり・同期発火でリプレイしない）、`pane.exited`/D18 の連鎖が永久に発火しない zombie pane になる。 — 根拠: packages/server/src/session/SessionService.ts:305-317,324-333,398-414; packages/server/src/terminal/TerminalHost.ts:65-69,89-92
- [must][conv:-] `SessionModel` の `NotFoundError` を `ControlSurface.invoke` が捕捉しておらず（`RpcError` だけを特別扱い）、`requireX` の事前検証を経ない約13個の `SessionService` メソッド（renameWorkspace/focusWorkspace/closeWorkspace/renameTab/focusTab/closeTab/closePane/focusPane/renamePane/setPaneRightClick/focusPaneDirection/swapPane/setSplitRatio）で未知 id を渡すと `not_found` ではなく `internal` として返る。`pane.focus` だけ手作業の回避ガード＋専用テストがあり、根本原因が把握済みなのに直っていない。 — 根拠: packages/server/src/surface/ControlSurface.ts:35-38; packages/server/src/session/SessionModel.ts:60-65; packages/server/src/session/SessionService.ts（各メソッド行）
- [must][conv:-] `SizeAuthority.transferOwnership` が `noteInteraction` と同じクラスの直上コメントが要求する「fit していないモバイルは権限を取らない」フィルタを欠いており、D13 が防ぐはずだった「非 fit のモバイルにサイズ権限が渡って全員の pane が縮む」事故が再発しうる。 — 根拠: packages/server/src/clients/SizeAuthority.ts:62-70 vs 26-29
- [must][conv:-] `focusWorkspace`/`focusTab`/`focusPane`/`focusPaneDirection`/`swapPane`/`zoomPane`/`resizePaneByDirection`/`setSplitRatio` の8メソッドが `session.json` に永続化される値（focus・focusedPaneId・zoomedPaneId・layout）を変更するのに `persist.touch()` を呼んでおらず、非グレースフル終了（SIGKILL等）でフォーカス/レイアウトの変更が消える（D7/AC18 を損なう）。 — 根拠: packages/server/src/session/SessionService.ts:134-269; packages/server/src/composeServer.ts:146-165
- [should][conv:-] `AuthService.verifySession` が TTL 失効時に `sessions` からは削除するが `liveSessionIds` からは削除しない（`logout`/`resetToken` のみ削除）ため、明示ログアウトせず自然失効したセッションが永久にリークする。 — 根拠: packages/server/src/auth/AuthService.ts:144-157 vs 137-138
- [should][conv:-] `DefaultLoginRateLimiter.failuresByIp` が空になった IP のエントリを削除しない（`isBlocked` が空配列でも `.set()` する）ため、ログイン失敗した IP のエントリが無制限に残る。 — 根拠: packages/server/src/auth/LoginRateLimiter.ts:23-29
- [should][conv:-] `WsServerWs` が `maxPayload` を指定しておらず（`ws` の既定 100MiB）、`/api/login` に明示的な 64KB 上限がある同じコードベースと不整合。認証済みクライアントが最大 100MiB の1メッセージを送りつけられる。 — 根拠: packages/server/src/ws/WsServerWs.ts:23; packages/server/src/http/HttpServer.ts:25
- [should][conv:-] `WindowsProcessInspector.deepestNode` の同着判定が `if (depth >= bestDepth)` になっており、コメント「tie-break は最初に見つかった経路を優先する」と逆に最後に見つかった経路で上書きしてしまう。 — 根拠: packages/server/src/platform/WindowsProcessInspector.ts:56-66 vs 68
- [should][conv:-] `ControlSurface.invoke` が `RpcError` 以外の例外のメッセージをそのままクライアントへ転送しており、内部パス等が漏れうるうえサーバ側ログも残らない。 — 根拠: packages/server/src/surface/ControlSurface.ts:35-38
- [should][conv:-] `PersistScheduler` に再入防止が無く、`touch()` のタイマーコールバックが `this.timer = null` を `save()`（非同期）の**前**に行うため、その隙間で `flush()` が呼ばれると2回同時に `save()` が走りうる（`atomicFile` は個別の一時ディレクトリを使うので破損はしないが、どちらが最後に勝つかの順序保証は無い）。 — 根拠: packages/server/src/session/PersistScheduler.ts:16-33
- [should][conv:-] `OriginPolicy.formatHostPort` が常に `:${port}` を付けるため、既定ポート（443等）で待ち受ける非ループバック TLS 構成では、ブラウザが省略する `Host`/`Origin` ヘッダと一致せず実質ロックアウトになる。 — 根拠: packages/server/src/auth/OriginPolicy.ts:26-41,52-57
- [should][conv:-] `SessionFile.load()`（`AuthFile.load()` も同型）が `schema===1` と1トップレベル配列の型しか見ず、残りは無検証の `as` キャストで zod を通さない（D29 のパターンから外れる）。手編集/破損したファイルがロード段を素通りし、`SessionService.restore()` の中で不意に例外になりうる。 — 根拠: packages/server/src/persist/SessionFile.ts:54-61
- [should][conv:-] `Pane` オブジェクトリテラル（13フィールド）が `createWorkspace`/`createTab`/`splitPane`/`restoreWorkspace` の4箇所に丸ごと重複しており、フィールド追加時に更新漏れが起きやすい。 — 根拠: packages/server/src/session/SessionModel.ts:144-158,206-220,257-271,535-549
- [should][conv:-] `updatePaneRuntime` が `patch.busy`/`patch.title` の値の変化を見ずに存在するだけで `pane.updated` を発行するため、AgentMonitor の周期呼び出し（500ms〜1s毎）のたびに変化が無くても全クライアントへブロードキャストされる。 — 根拠: packages/server/src/session/SessionService.ts:281-293
- [nit][conv:-] `FileLogger` のコメントは「stderr と server.log の両方」と書くが、実際は `debug`/`info` は stdout に出る。 — 根拠: packages/server/src/log/Logger.ts:16
- [nit][conv:-] `TerminalManager.create()` が `processInspector.defaultShell()` を2回呼んでいる（結果をキャッシュすれば1回で済む）。 — 根拠: packages/server/src/terminal/TerminalManager.ts:41-42
- [nit][conv:-] D24 の自動作成チェックが `closeWorkspace`/`closeTab`/`closePane` の3箇所に同一のまま重複している（private ヘルパー化できる）。 — 根拠: packages/server/src/session/SessionService.ts:149,189,220

## ラウンド2（2026-09-18T・review 工程・D43 修正の独立検証に委譲）

- [should][conv:-] `splitPane` に `createTab`（`commitTab` 失敗時）と同じ孤児化防止のガードが無かった。猶予期間中（`spawnForPane` の await 中）に分割元の pane/tab が別の RPC で閉じられると、`this.model.splitPane(...)` が `NotFoundError` を投げるが、その前に spawn 済みだった新しい pane の PTY が破棄されずに孤児化する。 — 根拠: packages/server/src/session/SessionService.ts:205-216（旧・try/catch 無し）vs :158-178（createTab はガード済み） / 対応: 修正済み（try/catch を追加し `terminals.dispose(newPaneId)` してから rethrow。回帰テストも追加）
- [nit][conv:-] `ControlSurface.ts` が `NotFoundError` を `session/SessionModel.js` から直接 import していた（`session/SessionService.js` が同じものを再エクスポートしており、architecture.md の依存表に無い層越えの import になっていた）。 — 根拠: packages/server/src/surface/ControlSurface.ts:4 / 対応: 修正済み（`session/SessionService.js` から import するように変更）

## ラウンド3（2026-09-18T・review 工程・D44 修正後の再点検）

D44 の修正（`splitPane` のガード・`ControlSurface.ts` の import 元）を、2回目の差し戻しプロトコルに従って
「同じ不変条件を支える項をすべて列挙して壊してみる」棚卸し（decisions.md D44）とあわせて直接確認した。
指摘なし。

## ラウンド4（2026-09-19・review 工程・T23／D98：流量制御。親の統合 test からの差し戻し）
指摘なし。確認した観点：
- 要件適合（AC17・requirements「応答性」の「大量出力が流れる pane があっても、他の pane とブラウザの操作が固まらない」）：
  修正前は隣の pane が永久に止まりうる、という要件に真っ向から反する状態だった。修正後は止まらないことを回帰テストと
  実物のブラウザでの計測で確かめた。最大速度の `yes` のような極端な条件での遅延の絶対値は、この環境では目標を超える——
  実機での判断に回す（D98）。
- 正確性：onDrain のタイマーは接続ごとに 1 つで、閉じたら止める（テストで確認）。OUTPUT だけを非圧縮にし、SNAPSHOT・JSON は
  圧縮のまま（D31 の意図を保つ）。`ws` は圧縮中のメッセージがあれば非圧縮のメッセージも順番どおりに並べて送るので、
  フレームの順序は崩れない。
- 回帰テストはどちらも修正前のコードで落ちることを確かめた（最初に書いたテストが修正前でも通ってしまったのを見つけ、
  差し替えた経緯は tasks.md T23 の完了メモ）。

## ラウンド5（2026-09-19・review 工程・T24／T25（D100・D101）の最終形。独立レビューに委譲）

T24（zoom の解除）には指摘なし。T25（起動時の URL 表示と、それに伴う Origin・起動オプションの修正）に 9 件。

- [must][conv:-] docs/tls-setup.md 方法B（WSL2 の NAT・portproxy）どおりに進めると、別のマシンからログインできない。転送先は 8443 なのに起動例に `--port` が無い（既定 7780）。別のマシンが開く Windows の LAN IP は WSL2 のインタフェースに無いので `OriginPolicy` が許可せず、`/api/login` が 403 になる。手順2は「`--origin` が要るのは Tailscale・リバースプロキシだけ」と書いている。表示される 172.x は母艦からしか開けない — 根拠: docs/tls-setup.md:37,76-80,108-119; packages/server/src/auth/OriginPolicy.ts:43-49
- [should][conv:-] packages/server/src/main.ts `--origin` で明示した Origin が「開ける URL」に並ばない。tailscale cert の構成では表示されるどれも証明書の名前と一致せず、token 付きの URL を手で組み立て直すことになる（D101 が解こうとした問題そのもの） — 根拠: packages/server/src/main.ts:87-93; docs/tls-setup.md:44-54,82-85
- [should][conv:-] packages/server/src/http/HttpServer.ts・ws/WsServerWs.ts Origin/Host で拒否したことがサーバのログに残らない。クライアントも 403 を token の誤りと同じ「ログインできませんでした」で表示するため、利用者は token が違うと思い込み `wtm token reset` へ進む（クライアントの文言は 03 のコード——親の統合 review で 03 へ戻す） — 根拠: packages/server/src/http/HttpServer.ts:91-95; packages/server/src/ws/WsServerWs.ts:61-65; packages/web/src/components/LoginView.vue:67
- [should][conv:-] packages/server/src/composeServer.ts 初回起動で待ち受けに失敗すると、作って保存した token が一度も表示されないまま失われる（次の起動では表示されない） — 根拠: packages/server/src/composeServer.ts:75,134; packages/server/src/main.ts:76-93
- [should][conv:-] packages/server/src/composeServer.ts `listen()` は restore（保存された全 pane のシェルを猶予つきで起動）と poller の開始の後に bind するので、典型的な「同じ state-dir の wtm が既に動いている」で、全シェルを起動してから失敗し、その間の `persist.touch()` で動いている側の session.json を上書きしうる — 根拠: packages/server/src/composeServer.ts:136-169; packages/server/src/session/SessionService.ts:433-446
- [nit][conv:-] packages/server/src/main.ts 待ち受け失敗の文言が IPv6 を角括弧で囲まない（`:::7780`）・案内が EACCES（Linux の 443・Windows の除外ポート範囲）に当てはまらない・`listening on https://0.0.0.0:8443` が URL の形のままで端末がリンクにする — 根拠: packages/server/src/main.ts:79-85
- [nit][conv:-] packages/server/src/util/net.ts LAN の IPv4 が docker0・br-*・virbr0・Windows の vEthernet (WSL)/(Default Switch) も含み、先頭が docker のものになりうる。e2e の除外条件（`172.17.*`）ともまたずれている — 根拠: packages/server/src/util/net.ts:28-33; packages/e2e/src/specs/tls-lan.spec.ts:18
- [nit][conv:-] packages/server/src/config.ts 角括弧を外す処理が `unbracket` と `formatUrlHost` の 2 か所に重複。config で外すので `isLoopbackHost("[::1]")`・`isWildcardHost("[::]")` の分岐には到達しない — 根拠: packages/server/src/config.ts:74-77; packages/server/src/util/net.ts:9,14,49
- [nit][conv:-] design.md「起動時の表示」「Origin の許可リスト」が D101 に追従していない — 根拠: .aidev/works/20260918-web-terminal-multiplexer/design.md:252-258,373-375

## ラウンド6（2026-09-19・review 工程・T26／T27（D102）の最終形。独立レビューに委譲）

ラウンド5の 9 件は最終のコード・docs で解消（クライアントの文言は 03 へ）。新たに 12 件。**持ち主が 05（docs）のものは
05 へ戻す**（親の統合 test で E2E の並列の件と一緒に。どれも T26 より前からある記述の問題）。

01 の範囲：
- [should][conv:-] packages/server/src/http/HttpServer.ts・ws/WsServerWs.ts 認証前の誰でも `GET //` 等（`new URL(req.url, base)` が例外を投げる request-target）を送るだけで `http request failed`／`ws upgrade failed` の error 行を間引きなしで 1 行ずつ書かせられる（D102 が Origin の拒否で塞いだのと同じ穴が別の経路に残っている） — 根拠: packages/server/src/http/HttpServer.ts:64-71,78; packages/server/src/ws/WsServerWs.ts:40-44,71
- [should][conv:-] packages/server/src/composeServer.ts 同じ state-dir の二重起動はポートも同じときしか止まらない。docs は手元用 7780・LAN 用 8443 で起動させるので、ポート違いの二重起動が起きやすく、その場合は全シェルを二重に起動し session.json・auth.json を上書きし合う。design の「同じ state-dir の wtm が既に動いている典型に効く」は言い過ぎ — 根拠: packages/server/src/composeServer.ts:167-190; design.md:698
- [nit][conv:-] packages/server/src/main.ts 「作った token は必ず一度表示される」が listen() の catch の中でしか保証されず、成功後の URL の組み立て（ゾーン付きの IPv6 `fe80::…%eth0` で `Invalid URL`）で token を失う — 根拠: packages/server/src/main.ts:86-112; packages/server/src/util/net.ts:90-96
- [nit][conv:-] packages/e2e/src/specs/tls-lan.spec.ts サーバが LAN の URL を 1 つも表示しないと skip するので、「実際の NIC まで表示から除く」退行が失敗にならない — 根拠: packages/e2e/src/specs/tls-lan.spec.ts:59-61
- [nit][conv:-] design「Origin の許可リスト」・エラー表と architecture の `OriginRejectionLog`・§6 が T26 ラウンド2 の最終形（全体の上限・`extraOrigins`・`EAI_AGAIN`）に追従していない — 根拠: design.md:266-269,693; architecture.md:150,545
- [nit][conv:-] packages/server/src/http/HttpServer.ts・ws/WsServerWs.ts Origin の判定→記録→403 の処理が重複し、`originRejections` を省くと別の `OriginRejectionLog` を黙って作る（間引きの状態が分かれる）。bind の失敗の判定が main.ts（syscall）と config.ts（code）に割れている — 根拠: packages/server/src/http/HttpServer.ts:63,96-105; packages/server/src/ws/WsServerWs.ts:34,77-86; packages/server/src/main.ts:78-81,98

05 の範囲（docs。親の統合 test で 05 へ戻す）：
- [should][conv:-] docs/tls-setup.md ファイアウォールの手順が構成ごとにそろっていない（mirrored は Hyper-V ファイアウォールの規則が要る・Windows ネイティブと Linux の記述が無い） — 根拠: docs/tls-setup.md:94-101,131-134,151-152
- [should][conv:-] docs/tls-setup.md `sudo tailscale cert` の鍵は root 所有 0600 で、一般ユーザーの `wtm serve --key` が読めず起動できない — 根拠: docs/tls-setup.md:52-58
- [should][conv:-] docs/verification.md 別のマシンから TLS で開く確認（AC11）が WSL2 にしか無く、Windows ネイティブ・Linux の手順が無い（AC16 の 3 環境×AC11 を埋められない） — 根拠: docs/verification.md:30-43,66-86
- [nit][conv:-] docs/tls-setup.md リバースプロキシの注意（`/ws` の Upgrade の転送・ルートのパス・接続元がまとまることによるログイン失敗の制限の共有）が無い — 根拠: docs/tls-setup.md:101,140-166
- [nit][conv:-] docs 全体 `wtm serve` と書いているが `wtm` は PATH に無い（private なワークスペースのパッケージ）。`node packages/server/dist/main.js serve` 等を案内すべき — 根拠: docs/verification.md:11-14

記録の漏れ：
- [nit][conv:-] ラウンド5 #3 のクライアント側（403 を token の誤りと同じ文言で表示）が 03 の tasks・backlog のどこにも積まれていない — 根拠: packages/web/src/components/LoginView.vue:67 / 対応: 親の test-result.md の「統合 review へ持ち越し」に記録し、統合 review で 03 へ戻す

## ラウンド7（2026-09-19・review 工程・T28（D103）。範囲を絞った独立レビュー）

範囲：ラウンド6の「01 の範囲」6 件が解消したか・T28 の差分そのものの must/should（周辺の既存の問題は対象外。ラウンド5・6 で
範囲を広げるたびに以前からの別の穴が見つかり収束しなかったため、差分に絞った）。ラウンド6の 01 の範囲は 6 件とも解消。

- [nit][conv:-] .aidev/works/20260918-web-terminal-multiplexer/architecture.md §6 手順2 に「`AuthFile` は読むだけ」が残り、T28 の「auth.json はロックの後に `listen()` で読む」（コード・同じ節の手順3.0）と食い違う — 根拠: architecture.md:543; packages/server/src/composeServer.ts:88-91,187 / 対応: 修正済

件数（ラウンド1〜7 の通算。タスク点検ログは数えない）：must 8・should 20・nit 16。内訳はラウンド1（must 7・should 10・nit 3）・
ラウンド2（should 1・nit 1）・ラウンド3（0）・ラウンド4（T23。0）・ラウンド5（must 1・should 4・nit 4）・
ラウンド6（should 5・nit 7。うち 05・03 へ回したもの should 3・nit 3）・ラウンド7（nit 1）。
- [should][conv:-] packages/server/src/clients/SizeAuthority.ts D106 は「デスクトップの `client.fit` は何も変えない」としていたが、`onFitChanged` は fit を kind より先に見るのでデスクトップの fit:true で権限を取っていた（窓を狭めたデスクトップは MobileShell の「この端末に合わせる」を出す）（T29） / 対応: 修正済（fit の有効化はどの kind でも権限を取る、に D106・design・コメントをそろえ、テストを足した）
- [should][conv:-] 再接続の後、サーバは新しいクライアントを fit:false で登録するが、Web は `fitEnabled` を持ち続け `client.fit` を送り直さない（`client.view` も送り直さない可能性）（T29） / 対応: 03・04 へ（統合 review ラウンド1 の must 1 と同じ経路。D106 の影響に記録）
- [nit][conv:-] packages/server/src/surface/methods/client.ts `client.hello` で kind が変わって資格を失っても SizeAuthority に知らせず、権限者のまま残る（T29） / 対応: 修正済
- [nit][conv:-] packages/server/src/auth/OriginPolicy.ts `isHostAllowed` が既定ポートの `--origin` のホストを `host:443` の形で照らさない（nginx の `$host:$server_port`）（T29） / 対応: 修正済
- [nit][conv:-] packages/server/src/clients/SizeAuthority.ts `transferOwnership` のコメント「ここだけ条件が抜けていて」がファイル冒頭と食い違う（T29） / 対応: 修正済

## ラウンド8（2026-09-19・T29（D106）。統合 review ラウンド1 からの差し戻し）

見たもの：統合 review ラウンド1 の 01 の範囲（must 2・should 1 のサーバ側・nit の時計）が解消したか・T29 の差分の要件適合
（D13・design「サイズ権限」「権限の移り方」・AC10／AC11／AC12）。正確さはタスク点検（独立）で見て 5 件を反映・1 件を 03／04 へ。
統合 review ラウンド1 の 01 の範囲はすべて解消。

指摘なし。

件数（ラウンド1〜8 の通算。タスク点検ログは数えない）：must 8・should 20・nit 16（ラウンド8 は 0）。
