# 判断の記録（20260926-agent-automation-api）

## D1: 実行三層（full）と範囲の選定——H39 のうち「検出済みエージェントの一覧・状態取得・状態待ち・画面読み取り」だけを本 work で着地させる

- **背景**: backlog 項目「エージェント自動化 API / CLI」（`.aidev/backlog/product-roadmap.md` 376 行目。
  `docs/herdr-parity.md` の H39）は、herdr の `agent start` / `agent prompt --wait` / `agent wait` /
  `agent read` 相当に加え、「pane とは別の名前付きの対象」「状態遷移の待ち合わせ」「agent skill ファイルの検討」を
  含む。herdr の一次資料（`scratchpad/herdr` のコミット `da6bcd5`。
  `docs/next/website/src/content/docs/agent-automation.mdx`・`cli-reference.mdx:327-403`・
  `src/api/wait.rs:132-172, 523-559`）を読むと、これらは性質の違う 4 つの塊に分かれる:
  1. 既に検出されているエージェントを pane ID で指して、状態を得る・状態を待つ・画面を読む
     （`agent list` / `get` / `wait` / `read`）。herdr でもエージェントの対象指定は「名前 または
     そのエージェントが居る pane ID」（`cli-reference.mdx:346`）で、pane ID だけでも成り立つ。
  2. エージェントへ prompt を送って完了を待つ（`agent prompt --wait`）。bracketed paste の live な状態を
     見て送り分ける・Enter を遅らせる・`blocked` なら送らない・送信後 5 秒以内に `working`/`blocked` が
     観測できなければ `agent_prompt_stalled`（`agent-automation.mdx` の「Choose the control surface」節）。
  3. エージェントを起動して名前を付ける（`agent start` / `agent rename`）。「空いているシェル pane」の判定・
     live なエージェント間で一意な名前の管理・起動完了（interactive ready）の待ち合わせが要る。
  4. agent skill ファイル（CLI の使い方をエージェントに教える Markdown。`agent-skill.mdx`）。
- **決定**: 本 work は **1 だけ**を対象にし、`wtmctl agent list` / `agent get <paneId>` /
  `agent wait <paneId> [--until STATUS]... [--timeout MS]` / `agent read <paneId> [--lines N] [--raw]` を足す。
  2・3・4 は backlog に `[ ]` の兄弟として割って残す（deliver で行を割る）。
- **理由**:
  - 1 は**サーバを変えずに**実現できる。サーバは既に、検出したエージェントの状態を `client.hello` の
    snapshot（`Pane.agent`。`packages/protocol/src/model.ts:83`）と、状態が変わるたびに全クライアントへ配る
    `pane.agent_status_changed` イベント（`packages/protocol/src/events.ts:84-87`、発行は
    `packages/server/src/session/SessionService.ts:833`）で外へ出している。herdr の `done`（idle だが未読）も
    `AgentInfo.completionSeq > serverSeenSeq` から導ける（`packages/web/src/store/seen.ts:57-61` と同じ規則）。
    新しい RPC・新しい入口が要らないので、**認証・Origin 検査などの既存の安全策をそのまま通る**
    （安全面で緩める箇所が無い）。
  - 1 だけで、既存の `wtmctl pane run`（入力送信）と組み合わせて「エージェントに作業させ、手が空くのを待ち、
    結果を読む」一連が組める（下記の既知の限界つき）。自動化の最小の有用な単位になる。
  - 2 は、送信の正しさ（bracketed paste・遅延 Enter）が実際のエージェント（Claude Code 等）でしか
    確かめられず、この環境の単体テスト・結合テストでは検証できない。「送った prompt が 1 行ずつ確定される」
    といった事故を未検証のまま出すより、待ち合わせの土台（1）を先に着地させる。
  - 3 はサーバ側に「名前」という新しい状態を持たせる変更で、`AgentInfo` の形が変わると `AgentInfo` のリテラルを持つ
    ファイル（`serverSeenSeq` を含むファイルが web・server・protocol で 24。`grep -rln serverSeenSeq packages`）へ波及する。並行して web を触っている別 work
    （edit-scrollback）との衝突の面も広げる。
  - 4 は CLI が固まってから中身が決まる（`.aidev/works/20260923-external-control-api/research.md` F4.3 と
    同じ理由）。加えて、wtmctl は pane の中から使うための環境変数（herdr の `HERDR_ENV` 相当）を
    まだ持たないので、skill の前提（安全ガード）が書けない。
- **既知の限界（requirements に明記する）**: prompt を `pane run` で送った直後に `agent wait` を打つと、
  エージェントがまだ `idle` のうちに待ちが即座に成立しうる（herdr が `agent prompt --wait` で
  「送信後に working/blocked を観測してから待つ」ようにしている理由そのもの）。本 work では
  `agent wait --until working` を挟むなどの回避策を docs に書くに留め、根本の解決は 2 の兄弟項目に送る。
- **実行三層**: 振る舞いを足す（CLI の新しいサブコマンド 4 つ）ので「対象外」ではない。herdr との対応づけ・
  待ち合わせの状態機械の設計判断があるので light でなく **full**（`state.yml` の `profile: full` を追認）。
  mode は起動指示どおり autonomous。
- **代替案**: (a) 1〜3 をまとめて 1 PR にする——サーバ・プロトコル・web に波及し、検証できない送信系を
  含むため却下。(b) 名前（3 の一部）だけ 1 に足す——`AgentInfo` の変更が上記 24 ファイルへ波及するので、
  名前は 3 と一緒に扱うほうがまとまりがよい。
- **影響**: `packages/cli` だけを変える（サーバ・プロトコル・web は変えない）。`docs/herdr-parity.md` の
  H39 行を「一部対応」に更新し、backlog 行を `[x]`（本 work）と `[ ]`（2・3・4）に割る。

## D2: research（任意工程）は挟まない

- **背景**: `protocol.md`「4.5」の 5 条件で requirements 終了時に research の要否を判定する。
- **決定**: 挟まない。
- **理由・代替案**: (1) 未確定事項は出力の形と行数の数え方だけで、どちらも design で決める選択であって
  調べて解消する事実ではない。(2) 依拠する既存挙動（イベントの配り方・`client.hello` の snapshot・
  `done` の導き方・pane の close で必ず `pane.closed` が出ること）は requirements の前に一次資料で確かめた
  （`packages/server/src/ws/WsGateway.ts:82-84` の全クライアント配布、`surface/methods/client.ts:6-13` の
  hello が同期で snapshot を返すこと、`SessionService.ts:415, 419-426, 560-563, 612-620` の閉じる経路が
  すべて `publishPaneClosed` を通ること、`packages/web/src/store/seen.ts:57-61`）。design の「依拠する既存の事実」に
  出所つきで書く。(3) 技術的実現性は既存の `wtmctl watch`（イベント購読）と `pane read` が同じ部品で
  実証済み。(4) 影響は `packages/cli` に閉じる。(5) 利用者が操作する UI 部品は作らない（CLI のサブコマンド）。
- **影響**: なし（design に直行）。

## D3: requirements の独立点検（ラウンド 1・指摘 8 件）への対応

- **背景**: doccheck ラウンド 1 で 8 件（should 5・nit 3）。
- **決定**: 8 件とも最小の差分で直した（US5 の参照から AC10 を外し AC10 を非機能要件に紐付け／対象外を
  「backlog に残す 3 つ」と「残さないもの」に分けた／`agent read --timeout` の意味を FR4・AC7 に追記／
  AC5 を観測できる形に／AC9・非機能要件に web を追加し diff の基点を `main...HEAD` に／`instanceId` を FR3 で定義／
  AC1・AC4 に状態の導き方と出力の形を追記）。再点検は design の点検で内部一貫性を併せて見るので行わない
  （ラウンド上限 2 のうち 1 を使用）。
- **影響**: requirements.md のみ。

## D4: design の独立点検（ラウンド 1・指摘 9 件）への対応と、architecture を挟まない判断

- **背景**: doccheck ラウンド 1 で 9 件（should 6・nit 3）。大半が「依拠する既存の事実」に出所の無い断定
  （`tab.updated`・`withSession`・`parseFlags`・`followOutput`・`classify`・herdr 側の仕様）。
- **決定**: 9 件とも最小の差分で直した。出所は一次資料を主エージェントが直読して付けた
  （`SessionService.ts:535-538, 826-837`、`withSession.ts:15-45`、`wsClient.ts:186-235`、`cliArgs.ts:58-117`、
  `pane.ts:82-94`、`output.ts:32-43`、herdr `wait.rs:523-535, 655-657, 677-689`・`cli-reference.mdx:248, 334`）。
  `readPaneSnapshot` の境目（hello を含まない・`unsubscribe` を引数で受ける）を具体化し、AC7 の結合テストに
  エージェントの注入を明記、対象範囲に deliver で触る backlog を足した。再点検はしない（上限 2 のうち 1 使用。
  残った疑問は tasks の点検と review に委ねる）。
- **architecture を挟まない**: `protocol.md`「4.5」の 4 条件——モジュール境界を動かさない（`packages/cli` の中に
  閉じ、依存の向きも変えない）／新しい構造・パターンの選択は無い（既存のコマンド＝`withSession`＋`RpcFailure` の型に
  載せる）／状態機械は `judgeWait` の 3 値で design に書き切れている／tasks に直接分解できる——のどれにも当たらない。
- **影響**: design.md のみ。

## D5: T9（AC9・AC10 の確認）は coding ではなく test 工程で消化する

- **背景**: AC9（server/protocol/web に diff が無い）と AC10（build/typecheck/test ×2/smoke）は、全タスクの
  実装が済んでから一度に確かめるもので、coding のタスクとしては差分を生まない。
- **決定**: tasks.md の T9 は coding の承認時に未チェックのまま残し、test 工程で確かめて test-result.md に記録する。
- **影響**: coding の承認時の `tasks_done` は 8。

## D6: tasks の独立点検（ラウンド 1・指摘 5 件）への対応

- **背景**: doccheck ラウンド 1 で 5 件（should 2・nit 3）。
- **決定**: 5 件とも最小の差分で直した（AC9 の分担〔withSession 経由は T4・diff 無しは T9〕をテスト方針に明記／
  負の確認を T9 に含めた／T6 に専用サーバ・hello 後の状態変更・後始末を明記し、曖昧だった「done/複数 until 以外」を
  書き直した／実装方針の「cli だけ」をコードに限定）。再点検はしない（上限 2 のうち 1 使用）。
- **影響**: tasks.md のみ。

## D7: `toAgentView` の引数を design から変えた（`(loc: AgentLocation, agent: AgentInfo)`）

- **背景**: design は `toAgentView(pane: Pane, workspaceIdOfTab)` とし「`pane.agent` が非 null であることを前提」にしていた。
  しかし `agent wait` では、一致を判定するエージェントは snapshot の `pane.agent` ではなくイベントで届いた
  `AgentInfo`、pane の位置（`tabId`）も `pane.updated` で更新した値になる。`Pane` を丸ごと受ける形だと、
  呼び出し側で `{ ...pane, agent, tabId }` を組み立て直すか、非 null の表明（`!`）が要る。
- **決定**: 位置（`paneId`/`tabId`/`workspaceId`）と `AgentInfo` を別々に受ける `toAgentView(loc, agent)` にした
  （`packages/cli/src/agentStatus.ts` の `AgentLocation`）。出力の形（`AgentView`）は design のまま。
- **理由・代替案**: 型で「エージェントがある」ことを表せ、非 null の表明が要らない。design どおりにする案は上記の
  組み立て直しが要るので退けた。T1 の独立点検（指摘 1 件）で記録漏れを指摘され、この記録を足した。
- **影響**: T4 は `toAgentView(loc, agent)` で呼ぶ。design.md の本文は書き換えない（本エントリが差分の記録）。

## D8: `readPaneSnapshot` は購読の解除をしない（design の `unsubscribe` 引数をやめた）

- **背景**: design は `readPaneSnapshot(client, paneId, scrollbackLines, timeoutMs, unsubscribe)` とし、解除まで
  関数の中で行う形にしていた。T3 の独立点検で、この形だと `pane read`（`--follow` 無し）が「表示 → 解除」から
  「解除 → 表示」に入れ替わり、解除の応答が時間切れ・切断になると、以前は画面を出してから失敗していたのに
  何も出さずに失敗する（外から見える振る舞いが変わる）と指摘された（`packages/cli/src/wsClient.ts:130-133` の
  応答待ちの時間切れ）。
- **決定**: `readPaneSnapshot(client, paneId, scrollbackLines, timeoutMs)` は「購読 → 最初の SNAPSHOT」までにし、
  解除は呼び出し側で行う。`runPaneRead` は元どおり表示してから解除する。`runAgentRead` は解除してから関数を抜けて
  表示する（新しいコマンドなので順序の互換は無い）。`pane.test.ts` に「表示してから解除する（解除の応答を待たずに
  表示する）」順序のテストを足した（既存テストは順序を見ていなかった）。
- **影響**: T3 の差分は「関数を切り出しただけ」の形に戻った。design.md の本文は書き換えない（本エントリが差分の記録）。

## D9: `agent wait` の購読を「hello の応答を受け取ったその場（同期）」で始める（`WtmClient.hello` に引数を足した）

- **背景**: T4 の独立点検（must）で、`await client.hello()` の後で `onEvent` を登録すると、hello の応答と同じ
  受信の塊で直後に届いたイベントを取りこぼすと指摘された。`ws`（8.21.3）のクライアントは 1 つの塊に入った複数の
  フレームを同期的に続けて `message` として配る（点検者が `ws/lib/websocket.js`・`receiver.js` と再現スクリプトで
  確認）ため、Promise の続き（microtask）が走る前に次のイベントが購読者 0 本の状態で配られて消える。
  取りこぼすと、直後に idle/blocked へ変わったエージェントを（`--timeout` 省略時は）永久に待ち続ける。
  design の「依拠する既存の事実」に書いた「応答の Promise の続きは次の `message` より先に走る」は誤りだった。
  逆に hello より前から購読すると、応答より前の（snapshot より古い）イベントで誤って一致しうる。
- **決定**: `WtmClient.hello(onEventAfterHello?)` を足し、`WsWtmClient` は hello の応答を処理するその同期の区間で
  `onEventAfterHello` を購読に加える（`requestRaw` に応答時の同期フックを足した）。`agent wait` はそこへ
  `EventFeed`（待ちを始めるまで溜め、始めたら溜めた分から順に渡す）を渡す。これで「応答より後のイベントだけを、
  取りこぼさずに」受け取れる。回帰テストとして、偽クライアントで「応答と同じ同期区間で届くイベント」「応答より前の
  古いイベント」の 2 ケースを足し、修正前の登録の仕方（hello の後で `onEvent`）に戻すと落ちることを確かめた
  （生の出力は test 工程で test-result.md に貼る）。
- **理由・代替案**: (a) サーバ側で hello の応答にイベントの通し番号を付ける——サーバ・プロトコルを変えることに
  なり、本 work の制約（D1）に反するので退けた。(b) hello より前から購読して全部溜め、応答より前のものを捨てる——
  応答の位置は Promise の解決では判別できず、結局クライアント側で同期の印が要るので、印を付ける場所で購読を
  始める今の形のほうが単純。
- **影響**: `packages/cli/src/wsClient.ts`（公開の `WtmClient` インタフェースに省略可能な引数を 1 つ足しただけで、
  既存の呼び出しは変わらない。テスト用に `WsWtmClient` を export）。design.md の本文は書き換えない（本エントリが
  差分の記録）。既存の `watch` は hello の前から購読している（古いイベントも出すが、表示するだけなので判定の誤りは
  起きない）ので変えない。

## D10: `done` の既読はサーバ側のもので、ブラウザのバッジとは一致しないことがある（docs に明記）

- **背景**: cross 点検で、docs の「ブラウザで pane を開くと `idle` になる」という説明が不正確と指摘された。CLI の
  `statusOf` はサーバの `serverSeenSeq` で判定し、サーバがそれを進めるのは `session.focus_changed` を受けたとき
  だけ（`packages/server/src/agent/AgentMonitor.ts:82, 101-105`）。ブラウザのバッジはブラウザ内の既読
  （`packages/web/src/store/seen.ts`。表示中の pane はフォーカスが無くても既読にする）を使う。
- **決定**: 規則（`idle` かつ未読の完了あり → `done`）は design どおりブラウザと同じだが、既読の出所が違うことを
  docs に書き、表現を「サーバ側の既読」に直した。サーバの既読の進め方は変えない（D1：サーバを変えない）。
  herdr も「CLI/API はサーバの既読を使い、クライアントのバッジとは違いうる」としており（`agent-automation.mdx` の
  `idle` と `done` の段落）、振る舞いとしても herdr と揃っている。
- **影響**: `docs/wtmctl.md` のみ。design.md の「ブラウザと同じ規則」は規則の意味では正しいので書き換えない。

## D11: review ラウンド 1（should 1・nit 3）への対応——`agent read` は alt screen の中身だけを読む

- **背景**: 独立レビューで、alternate screen を使うエージェント（Claude Code・Codex 等）では SNAPSHOT が
  「通常画面（スクロールバック込み）＋改行なしで `ESC[?1049h ESC[H`＋alt screen の中身」になり
  （`@xterm/addon-serialize`、呼び出し元 `packages/server/src/terminal/Mirror.ts:149`）、`agent read` の末尾 N 行に
  古いシェルの履歴が混ざり境目の行がつながると指摘された（レビュアーが headless xterm で再現）。
- **決定**: `currentScreen(raw)`（`agentStatus.ts`）で最後の `ESC[?1049h` より後ろだけを今の画面として `lastLines` に渡す。
  `pane read` は変えない（生の SNAPSHOT を出す既存の振る舞い）。nit 3 件も直した（`--timeout` の上限 2147483647 を
  超えたら使い方の誤り／docs に死活確認が無いことと長い待ちでの `--timeout`／例を `--until working --until blocked` に）。
- **理由・代替案**: docs に限界として書くだけの案は、主な対象（alt screen の TUI エージェント）で読んだ結果が
  壊れたままになるので退けた。サーバ側で alt screen だけを返す案はサーバ変更になる（D1）。
- **影響**: `agentStatus.ts`・`commands/agent.ts`・`cliArgs.ts`・`docs/wtmctl.md` とテスト。負の確認 M21・M22 を追加。
- review ラウンド 1 の修正は T4 の点検ラウンドが上限（2/2）のためタスク点検を行わず、review ラウンド 2 の独立レビューに委ねる（D11 の補足）。
