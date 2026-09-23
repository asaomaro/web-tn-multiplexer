# 調査: 外部操作 API / CLI（herdr の socket API / CLI 相当）

> **出典の略記**（`.aidev/works/20260918-web-terminal-multiplexer/research.md` と同じ書式）
> - `[H]<file>:<行>` = herdr 公式ドキュメントのソース（v0.9.1 コミット `da6bcd5969779bfe0396bcf89a8025d4375d611e`）
>   `https://github.com/herdrdev/herdr/blob/da6bcd5969779bfe0396bcf89a8025d4375d611e/docs/versions/0.9.1/website/src/content/docs/<file>`
>   （生テキストは `raw.githubusercontent.com` 同パスから取得し、行番号はその生ファイルのもの）
> - `[P]<file>:<行>` = 本リポジトリのソース（`packages/` 配下。相対パス）。既存実装の事実確認。
> - **(推測)** と書いたものは出典の無い推論。

## 調査の問い

- Q1: herdr の socket API（`socket-api.mdx`）は、トランスポート・認証・request/response・event の形として
  具体的に何を提供するか。→ D3（本 work の decisions.md）の設計判断の材料
- Q2: herdr の CLI（`cli-reference.mdx`）で、H38（workspace/tab/pane の CRUD・入力送信・出力読取・状態購読）に
  該当するコマンドは何か。→ 本 work の CLI コマンド設計
- Q3: H39（エージェント自動化。`agent-automation.mdx`・`agent-skill.mdx`）と H40（pane 単体接続・閲覧専用購読・
  制御ストリーム。`persistence-remote.mdx` 109〜159 行）は、H38 と比べてどれくらい独立した設計・実装を要するか。
  → D2（本 work に含めるか後続に残すか）の判断材料
- Q4: 本製品の既存コード（`ControlSurface`・`AuthService`・`OriginPolicy`・`WsGateway`・`SizeAuthority`）は、
  herdr 相当の外部操作をどこまで無改造で再利用できるか。→ D3・D4 の判断材料

## 判明した事実

### F1: herdr の socket API のトランスポートと認証（Q1）

- F1.1 **ローカルソケットのみ**。「newline-delimited JSON over a local socket. On Unix, that socket is a Unix
  domain socket. On Windows, it is a named pipe.」（`[H]socket-api.mdx:656-659`）。既定パスは
  `~/.config/herdr/herdr.sock`、named session は `~/.config/herdr/sessions/<name>/herdr.sock`
  （`[H]socket-api.mdx:675-693`）。**トークンや Origin のようなネットワーク認証は無い**――ローカルの
  信頼済み利用者・プロセスであることが前提（ドキュメント中に認証手順の記載が無い）。
- F1.2 プロトコルは 1 行 1 リクエストの newline-delimited JSON。成功応答は `{"id", "result": {"type": …}}`、
  エラー応答は `{"id", "error": {"code", "message"}}`（`[H]socket-api.mdx:661-671, 931-941`）。**本製品の
  `SuccessEnvelope`/`ErrorEnvelope`（`[P]packages/protocol/src/messages.ts:339-347`）と形が一致する**
  （id 対応・`result`/`error` の2択）。相違点は本製品が改行区切りではなく WebSocket の 1 メッセージ＝1 JSON
  である点だけ。
- F1.3 **`session.snapshot`** は「一度だけのブートストラップ・スナップショット」で、購読ではない
  （`[H]socket-api.mdx:118-127`）。取りこぼしを避けるため、herdr は「先に `events.subscribe` を開いて
  確認応答を待ち、その間に届いたイベントをバッファしながら `session.snapshot` を呼び、スナップショットを
  適用してからバッファ分を順に適用する」という手順を推奨している。
  **本製品では、この2手順が `client.hello` 1回に統合されている**——`ClientHelloResult.snapshot`
  （`[P]packages/protocol/src/messages.ts:27-30`）は接続直後の応答に同梱され、以後のイベントは
  同じ WebSocket 上で `bus.subscribe` により**接続後すぐに**配られる（`[P]packages/server/src/ws/WsGateway.ts:75-79`）。
  取りこぼしの窓は無い（hello の応答を待ってから events を見れば十分。herdr のような2段階の手順は不要）。
- F1.4 **`events.subscribe` はフィルタ付きの購読**（`{"type": "pane.agent_status_changed", "pane_id": …,
  "agent_status": …}` のような条件を `subscriptions` 配列で指定できる。`[H]socket-api.mdx:800-842`）。
  本製品の状態購読は**フィルタ無し・全イベントを全クライアントへブロードキャスト**（`[P]packages/server/src/ws/WsGateway.ts:75-79`
  の `this.bus.subscribe` はクライアントごとの絞り込みをしない）。
- F1.5 **Raw methods は非常に広い**（`[H]socket-api.mdx:93-112` の表）：workspace・worktree・tab・pane（分割・
  入れ替え・移動・resize・graphics 等）・agent（`agent.view.set` を含む）・plugin・layout（`export`/`apply`）・
  通知。**このうち本 work の対象（H38 の一部）に該当するのは workspace/tab/pane の CRUD・`pane.send_text`/
  `pane.send_keys`/`pane.send_input`/`pane.read`・`events.subscribe`/`session.snapshot` だけ**。
  graphics・plugin・layout.export/apply・agent.view.set・worktree・agent の lifecycle 系は対象外（後述 F4）。

### F2: herdr CLI の H38 相当コマンド（Q2）

- F2.1 workspace: `herdr workspace list/create/get/focus/rename/report-metadata/close`
  （`[H]cli-reference.mdx:154-162`）。`create` は `--cwd`/`--label`/`--env`/`--focus`/`--no-focus`。
  JSON 応答は `.result.workspace.workspace_id` / `.result.tab.tab_id` / `.result.root_pane.pane_id`
  （`[H]cli-reference.mdx:170`、`[H]agent-automation.mdx:30`）。
- F2.2 tab: `herdr tab list/create/get/focus/rename/close`（`[H]cli-reference.mdx:190-196`）。
  `--workspace` 省略時は「アクティブな workspace」を使う（本製品は `workspace.create` の応答に含まれる
  `tab` を使い、CLI 側で「アクティブな workspace」という概念自体を持たない――後述 D2 系の design 判断）。
- F2.3 pane: `herdr pane split/close` に加え、`swap`/`move`/`resize`/`zoom`/`rename` 等の広い操作がある
  （`[H]cli-reference.mdx:204-224`）。本 work は `split`・`close` のみを対象にする（既存 RPC を CLI から
  叩くだけで足りる分。`rename` も低コストなので対象に含める――design で決定）。
  `pane split` の応答は新しい pane を `.result.pane.pane_id` に持つ（`[H]cli-reference.mdx:231`）。
- F2.4 入力送信：`herdr pane send-text <pane_id> <text>`（Enter を付けない生テキスト）、
  `herdr pane send-keys <pane_id> <key>...`（論理キー名。`ctrl+c` 等）、
  `herdr pane run <pane_id> <command>`（bracketed paste を使い、テキスト＋Enter を**アトミックに**送る。
  `send-text`＋`send-keys enter` より推奨。`[H]cli-reference.mdx:250-266`）。
  **本 work は `send-text` 相当（`wtmctl pane input`）と、`run` の簡易版（`wtmctl pane run`＝テキスト＋改行を
  送るだけで bracketed paste のアトミック化はしない）の 2 つだけを提供する**。`send-keys`（論理キー名から
  制御シーケンスへの変換表）は本 work の対象外とする――既存の本製品には（`packages/web/src/keys/` に）
  ブラウザのキー入力から端末シーケンスへの変換表があるが、CLI 向けの「キー名文字列」の文法・パーサは
  この work の新規実装になり、`herdr` の対応表をそのまま真似ると際限が無い。生テキスト送信で足りない
  制御キー（Ctrl-C 等）は、利用者が `wtmctl pane input <id> $'\x03'`（シェル側で生バイトを組み立てる）で
  代替できるため、MVP としては許容範囲と判断する。
- F2.5 出力読取：`herdr pane read <id> --source visible|recent|recent-unwrapped|detection [--lines N]
  [--format text|ansi]`（`[H]cli-reference.mdx:242-248`）。既定で ANSI を除去したプレーンテキストを返す。
  **4 種類の `--source` の作り分け**（`visible`＝現在の画面、`recent`＝折り返しありの直近 scrollback、
  `recent-unwrapped`＝折り返し無し、`detection`＝エージェント判定用のボトムバッファ）は、herdr 側の
  スクロールバック・レンダリングの内部実装に依存する概念で、本製品の `OutputFanout`／`Mirror`
  （`[P]packages/server/src/terminal/OutputFanout.ts`）が今持っている一次情報は「SNAPSHOT（購読時点の
  画面全体。@xterm/addon-serialize が生成する ANSI 込みの文字列）」と「以後の OUTPUT（生バイト列の継続）」の
  2 種類だけ。本 work では**この 2 種類だけを CLI から取り出す**（`wtmctl pane read` の既定＝SNAPSHOT 1 回、
  `--follow`＝以後の OUTPUT を継続）。herdr の 4 分類・`--lines` によるスクロールバック行数制御は
  対象外とする（サーバ側に新しい読み取り API を作る必要があり、H38 の「出力読取」という文言の最小実装を
  超える）。
- F2.6 状態の一括取得：`cli-reference.mdx` は `api schema`（プロトコルのスキーマを出す。`[H]cli-reference.mdx:38-48`）
  は独立節で解説するが、`session.snapshot` を出す CLI コマンド自体は `--machine` 節の対応コマンド一覧に
  `"api snapshot"` として名前だけ現れる（`[H]cli-reference.mdx:80`）。中身の説明は `socket-api.mdx` 側
  （F1.3）にある：「From the CLI, `herdr api snapshot` prints the live `session.snapshot` response as JSON」
  （`[H]socket-api.mdx:129-130`）。本 work の `wtmctl snapshot` はこれに相当する。
- F2.7 終了コードの切り分け：「A timeout or server error is emitted as JSON on stderr with exit status 1.
  CLI usage errors exit with status 2.」（`[H]cli-reference.mdx:403`、`[H]agent-automation.mdx:96` にも
  同文）。**本 work の FR13（0=成功・1=サーバ/プロトコルエラー・2=CLI 使用誤り）はこれをそのまま踏襲する**。

### F3: 本製品の既存実装が herdr 相当の外部操作をどこまで再利用できるか（Q4）

- F3.1 **認証**：`POST /api/login`（body `{token}`）→ `Set-Cookie: wtm_session=…`（`[P]packages/server/src/http/HttpServer.ts:103-134`）。
  `token` は `AuthService.login`（`[P]packages/server/src/auth/AuthService.ts:113-132`）が scrypt ハッシュで
  検証し、session id を発行する（TTL 14日。`[P]packages/server/src/auth/AuthService.ts:13`）。
- F3.2 **Origin/Host 判定**：`/api/login` と `/ws` はどちらも `OriginPolicy.isAllowed(origin, host)` で、
  **Origin ヘッダが存在し、許可された host:port と一致する場合だけ**通す（`[P]packages/server/src/auth/OriginPolicy.ts:61-69`）。
  送信元がブラウザかどうかは判定しない――**Origin ヘッダを自分で組み立てて送れる非ブラウザ・クライアント
  （CLI 含む）でも、許可リスト内の宛先である限りそのまま通る**。
- F3.3 **WS upgrade の拒否**は素のステータス行（`401 Unauthorized` 等）で、body は無い
  （`[P]packages/server/src/ws/WsServerWs.ts:96-99, 111-113`）。Node の `ws` クライアントは
  `unexpected-response` イベントでこれを受け取れる（`error` イベントではない）。
- F3.4 **RPC 面**は `ControlSurface.invoke`（`[P]packages/server/src/surface/ControlSurface.ts:31-50`）が
  `METHOD_SCHEMAS` に登録された方式を zod で検証してから実行する。`workspace.create`/`.rename`/`.close`・
  `tab.create`/`.close`・`pane.split`/`.close`/`.rename` は**既存のまま**で外部クライアントから呼べる
  （`[P]packages/protocol/src/messages.ts:98-181, 258-290`）。新規のサーバコードは不要。
- F3.5 **入力送信**は RPC ではなく、バイナリフレーム（`FRAME_TYPE.INPUT = 0x03`。
  `[P]packages/protocol/src/frames.ts:9-13, 52-59`）を WebSocket に直接送る形。
  `WsGateway` はフレームを受け取ると対象 pane の `TerminalManager` へそのまま `write` する
  （`[P]packages/server/src/ws/WsGateway.ts:88-100`）。1MB を超えるフレームは破棄される
  （`[P]packages/server/src/ws/WsGateway.ts:24, 91-97`）。
- F3.6 **出力読取**は `pane.subscribe`（RPC）を呼ぶと、`OutputFanout.subscribe` が現在の画面を
  `SNAPSHOT` フレーム（`FRAME_TYPE.SNAPSHOT = 0x02`）として送り、以後は `OUTPUT` フレームで継続する
  （`[P]packages/server/src/terminal/OutputFanout.ts:106-119`、`[P]packages/server/src/surface/methods/subscribe.ts:6-16`）。
  **複数の購読者が同時に同じ pane を読める**（`OutputFanout.subs` は clientId ごとの Map。
  `[P]packages/server/src/terminal/OutputFanout.ts:41`）――herdr の `terminal session observe` の
  「複数の observer が同時に見られる」（後述 F5）と近い性質を、購読の**副作用として既に持っている**。
- F3.7 **状態の一括取得・状態購読**：`client.hello` の応答に `SessionSnapshot`
  （workspaces/tabs/panes/focus/host/limits）が同梱される（`[P]packages/protocol/src/messages.ts:27-30`、
  `[P]packages/protocol/src/model.ts:123-132`）。以後の変化は `ServerEvent`
  （`workspace.created`/`pane.updated`/`pane.agent_status_changed` 等。`[P]packages/protocol/src/events.ts:8-92`）
  として、接続中の**全クライアントへ無条件で** push される（`[P]packages/server/src/ws/WsGateway.ts:75-79`）。
  herdr の `session.snapshot`（一度だけ）＋`events.subscribe`（フィルタ付き購読）に相当する機能が、
  本製品では「hello のたびに snapshot」＋「フィルタ無しの全イベント購読」として**既に存在する**。
- F3.8 **サイズ権限の資格判定**：`SizeAuthority.canDecideSize`
  （`[P]packages/server/src/clients/SizeAuthority.ts:38-41`）は `client.kind === "desktop" || client.fit`
  で判定する。`ClientKind`（`[P]packages/server/src/clients/ClientRegistry.ts:4`）は現在
  `"desktop" | "mobile"` の2値で、`client.hello` を送らない・`kind` を省略したクライアントは既定で
  `"desktop"` 扱いになる（`ClientRegistry.register` の既定引数。`[P]packages/server/src/clients/ClientRegistry.ts:55`）。
  画面を持たない CLI がこの既定に乗ると、入力送信のたびに `noteInteraction`
  （`[P]packages/server/src/clients/SizeAuthority.ts:49-59`）がサイズ権限を意味なく奪う
  （`decisions.md` D4 で「external」という第3の `kind` を追加する判断の根拠）。
- F3.9 **既存の「WS 経由で外部プロセスから操作する」実証**：`packages/server/src/smoke.ts`
  （`[P]packages/server/src/smoke.ts:159-231`）が、`POST /api/login` → cookie 取得 → `/ws` 接続
  （`Origin`/`Host` ヘッダを手で付与）→ `client.hello` → `workspace.create` → `pane.subscribe` →
  INPUT フレーム送信、という**本 work が CLI に実装したいのとほぼ同じ経路**を、起動確認のたびに
  実際に動かしている。生の `ws` パッケージ＋`fetch` だけで実装されており、新しい依存を増やさずに
  同じパターンを CLI へ転用できることの実証になっている。

### F4: H39（エージェント自動化）が H38 と設計の質を異にする理由（Q3）

- F4.1 `agent start` は「既存の空いているシェル pane」を要求し、**それ自体はレイアウトを作らない**
  （`[H]agent-automation.mdx:16, 42, 46`）。「名前」は `[a-z][a-z0-9_-]{0,31}` の一意な識別子で、
  pane ID とは別に**エージェントという第2の addressable な対象**を導入する（`[H]agent-automation.mdx:38`）。
  本製品の `AgentInfo`（`[P]packages/protocol/src/model.ts:90-105`）は pane に従属する検出結果であり、
  「名前を付けて呼び出す」「起動を待つ」という利用者向けの操作面が無い。
- F4.2 `agent wait` / `agent prompt --wait` は、`idle`/`done`/`blocked`/`working`/`unknown` の状態遷移を
  **サーバ側でイベント駆動に待ち合わせる**新しい RPC（`events.wait` 相当。`[H]socket-api.mdx:110`）が要る。
  「5秒以内に `working`/`blocked` の活動が観測されなければ `agent_prompt_stalled`」（`[H]agent-automation.mdx:76`）
  のような**時間窓つきの状態機械**は、既存の `AgentInfo.state`/`completionSeq`（単純な現在値）を
  そのまま流用できない。
- F4.3 `agent-skill.mdx` が教える内容（`herdr` CLI を `HERDR_ENV=1` の pane 内から使わせる Markdown
  instruction file の配布。`[H]agent-skill.mdx:12-24, 55-59`）は、**本 work の CLI/API 実装そのものではなく
  「CLI の使い方をエージェントに教えるドキュメント」**という別種の成果物で、H38 の実装が固まった後でないと
  内容が書けない（後続で本 work の CLI が確定してから検討する）。
- F4.4 **結論**：H39 は「pane とは別の addressable な概念（agent 名）」「新しい状態待ち合わせの RPC」を
  要求し、H38（既存 RPC のラップ）とは実装量・設計判断の質が異なる。decisions.md D2 のとおり後続へ残す。

### F5: H40（pane 単体接続・閲覧専用購読・制御ストリーム）が H38 と設計の質を異にする理由（Q3）

- F5.1 `terminal attach` / `agent attach` は「1つの書き込み所有者」を要求し、`--takeover` で明示的に
  奪い合う（`[H]persistence-remote.mdx:130-135`、`[H]cli-reference.mdx:377-378`）。
  **既存の `pane.subscribe` は複数購読者を許す設計**（F3.6）で、「1人の書き込み所有者」という排他モデルは
  現状どこにも無い。追加するなら `SizeAuthority`／`ClientRegistry` に新しい資格判定（「この pane への
  書き込みを誰が握っているか」）を導入する必要があり、H38 の CRUD 系の変更（`clientKind` に値を1つ足すだけ）
  とは変更の性質が違う。
- F5.2 `terminal session observe` は「pane・terminal・agent のいずれかを対象にできる」「base64 の ANSI
  フレームを `terminal.frame` として流す」「30秒無進行で切断」という**専用のフレーミング・タイムアウト規約**
  を持つ（`[H]persistence-remote.mdx:137-147`、`[H]cli-reference.mdx:384-386`）。本製品の SNAPSHOT/OUTPUT
  フレーム（バイナリ・base64 化しない生バイト）とは符号化が異なり、新しいフレーム種別かエンコードの追加が要る。
- F5.3 `terminal session control` は標準入力から `terminal.input`/`terminal.resize`/`terminal.scroll`/
  `terminal.release` という**別の newline-delimited JSON プロトコルを stdin/stdout に開く**
  （`[H]persistence-remote.mdx:149-159`）。これは「1 コマンド＝1 リクエスト/レスポンスで完結する CLI」
  （本 work の FR13 の前提）とは異なる、**対話的な長時間ストリームの CLI サブコマンド**という別カテゴリ。
- F5.4 **結論**：H40 は「排他制御」「専用フレーミング」「対話的ストリーム CLI」という、H38（既存 RPC の
  ラップ）には無い3つの新規設計要素を要求する。decisions.md D2 のとおり後続へ残す。

## H38〜H40 の対応・スコープ再整理（`.aidev/works/20260918-web-terminal-multiplexer/research.md` F7 の更新）

| ID | herdr の機能 | 本 work での扱い | 根拠 |
|---|---|---|---|
| H38 | CLI / socket API（workspace・tab・pane の操作・読み取り・状態購読・`session.snapshot`） | **MVP（本 work）** ただし「作成・分割・入力送信・出力読取・状態購読」（backlog 行の文言）に絞る。`agent` の lifecycle・graphics・plugin・layout.export/apply・worktree・機微な metadata 系は対象外 | F1〜F3、D2 |
| H39 | エージェント自動化（`agent start`/`prompt --wait`/`wait`/`read`）・agent skill 配布 | **後続**（新規 backlog 項目） | F4、D2 |
| H40 | pane 単体接続・閲覧専用購読・制御ストリーム | **後続**（新規 backlog 項目） | F5、D2 |

## 未解決のまま残す点

- herdr の `pane send-keys`（論理キー名の変換表）相当は本 work では作らない（F2.4）。生テキスト送信のみ。
  必要になれば後続 work（H39 の一部、または独立項目）で検討する。
- `pane.subscribe` が返す SNAPSHOT は @xterm/addon-serialize の ANSI 込み文字列であり、herdr の
  `--format text`（ANSI 除去済みプレーンテキスト）とは異なる（F2.5）。本 work の `wtmctl pane read` は
  簡易的な ANSI 除去（正規表現ベース）を既定にし、`--raw` で生の文字列を出す設計とする（design.md で詳細化）。
