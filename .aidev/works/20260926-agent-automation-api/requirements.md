# 要件: エージェント自動化 CLI（検出済みエージェントの一覧・状態取得・状態待ち・画面読み取り）

## 背景 / 課題

外部操作 CLI `wtmctl`（20260923-external-control-api）で、ブラウザを開かずに workspace / tab / pane を
作り、入力を送り、画面を読めるようになった。しかし、pane の中で動いている**コーディングエージェント**
（Claude Code・Codex 等）の状態——作業中か・入力待ちか・手が空いたか——を外から扱う手段は無い。
状態は `wtmctl snapshot` の巨大な JSON の奥（`panes[].agent`）に埋まっているだけで、「手が空くまで待つ」には
利用者がポーリングのスクリプトを自作するしかない。

herdr はこれを `agent list` / `agent get` / `agent wait` / `agent read`（ほか `agent start` /
`agent prompt --wait`）として持つ（herdr `docs/next/website/src/content/docs/agent-automation.mdx`、
`cli-reference.mdx:327-403`。`docs/herdr-parity.md` の H39）。backlog 項目
「エージェント自動化 API / CLI」（`.aidev/backlog/product-roadmap.md` 376 行目）はこの取り込みで、
本 work はその**最初の一部**を着地させる（範囲の選び方は decisions.md D1）。

## 目的 / ゴール

スクリプトや別の AI エージェント（オーケストレーター）が、ブラウザを介さずに、pane で動いている
検出済みエージェントを **pane ID で指して**、その状態を知り、目的の状態（手が空いた・入力待ち等）に
なるまで**ポーリングを自作せずに待ち**、その画面を読める状態にする。既存の認証・Origin 検査は
そのまま効いていて、新しい入口は増えていない。

## ユーザーストーリー

- US1: オーケストレーター（スクリプト・別の AI エージェント）として、pane で動くエージェントが
  作業を終えて手が空くまで待ってから次の指示を出したい。なぜなら、完了を画面の目視や自作のポーリングで
  判定せずに済み、複数のエージェントをつないだ自動化が組めるから。（受け入れ: AC3, AC4, AC5, AC6）
- US2: オーケストレーターとして、エージェントが承認・質問（入力待ち＝`blocked`）で止まったことを知り、
  その画面を読んで判断したい。なぜなら、止まったエージェントを放置せず、人間や別の仕組みにつなげられるから。
  （受け入れ: AC3, AC7, AC8）
- US3: 利用者として、いまどの pane でどのエージェントがどの状態で動いているかを一覧で知りたい。
  なぜなら、待つ・読む対象の pane ID を探すのに `snapshot` の全体を読み解かずに済むから。
  （受け入れ: AC1, AC2）
- US4: 運用者として、この機能が既存の token 認証・Origin/Host 検査の上にだけ載っていてほしい。
  なぜなら、新しい攻撃面を増やしたくないから。（受け入れ: AC9）
- US5: 後続 work の担当者として、herdr との対応表と backlog が「何が済み・何が残っているか」を
  正しく示していてほしい。なぜなら、残り（prompt 送信・起動と名前・skill ファイル）を重複なく拾えるから。
  （受け入れ: AC11）

## スコープ

### 対象

- `wtmctl` に `agent` コマンド群を足す:
  - `agent list`: エージェントが検出されている pane の一覧（エージェントの状態つき）。
  - `agent get <paneId>`: 1 つの pane のエージェントの状態。
  - `agent wait <paneId> [--until STATUS]... [--timeout MS]`: 指定した状態のどれかになるまで待つ。
  - `agent read <paneId> [--lines N] [--raw] [--timeout MS]`: エージェントの居る pane の画面を読む。
- 状態は herdr と同じ 5 値 `working` / `blocked` / `idle` / `done` / `unknown` で表す（`done` は
  「idle だが、サーバ側でまだ見られていない完了がある」）。
- 利用者向けの使い方の記述（docs）と `docs/herdr-parity.md` の H39 行の更新。

### 対象外

次の 3 つは backlog に `[ ]` の兄弟として残す（理由は decisions.md D1）:

- `agent prompt`（`--wait` を含む）・`agent send-keys`: エージェントへの prompt の送信と、送信後に
  作業が始まったことを観測してからの待ち合わせ（bracketed paste・遅延 Enter・`agent_prompt_stalled`）。
- `agent start`・`agent rename` と「名前」による対象指定: エージェントの起動と、pane とは別の名前付きの対象。
  本 work の対象指定は **pane ID だけ**（herdr でも pane ID は正規の対象指定。`cli-reference.mdx:346`）。
- agent skill ファイル（wtmctl の使い方をエージェントに教える Markdown）の作成・配布。

次は backlog にも残さない（本 work の範囲外として記録するだけ）:

- herdr の `agent read --source visible|recent|recent-unwrapped|detection` の作り分け、alternate screen の
  履歴を自動スクロールして読む機能、`agent explain`・`agent focus`・`agent attach`。
- サーバ・プロトコル・web の変更（本 work は既存のイベントと snapshot だけで実現する）。

## 機能要件

- FR1: `wtmctl agent list` は、エージェントが検出されている pane ごとに、pane ID・その pane の workspace ID と
  tab ID・エージェントの種類（`claude` 等）と表示名・状態（5 値）・状態が変わった時刻を JSON で出す。
  エージェントの居ない pane は含めない。
- FR2: `wtmctl agent get <paneId>` は、FR1 と同じ形の 1 件を JSON で出す。
- FR3: `wtmctl agent wait <paneId>` は、対象のエージェントの状態が `--until` で指定した状態のどれかに
  なったら、その時点のエージェントを JSON で出して終了コード 0 で終わる。
  - 呼び出した時点で既に一致していれば、待たずに即座に返す（herdr `agent wait` と同じ）。
  - `--until` は繰り返し指定でき（複数の状態のどれか）、省略時は `idle` / `done` / `blocked`（herdr と同じ既定。
    `unknown` は明示したときだけ一致させる）。
  - 状態の変化は、サーバが全クライアントへ push するイベントで受け取る（ポーリングしない）。
  - `--timeout` を省略したら無期限に待つ（herdr と同じ）。指定した時間内に一致しなければ `timeout` の
    エラーで終わる。
  - 待っている間にその pane からエージェントが居なくなった（終了した・別のエージェントに入れ替わった・
    pane が閉じた）ら（入れ替わりは、サーバが検出のたびに振り直すエージェントの識別子 `instanceId` が
    待ち始めのものと違うことで判る）、`agent_not_running` のエラーで終わる（herdr と同じエラー名）。
- FR4: `wtmctl agent read <paneId>` は、そのエージェントの居る pane の画面内容をテキストで出す。
  ANSI エスケープは既定で除去し、`--raw` で除去しない。`--lines N` で末尾の N 行に絞る
  （省略時は herdr の既定と同じ 80 行）。`--timeout MS` は画面内容がサーバから届くまで待つ上限で
  （既存の `pane read --timeout` と同じ意味・同じ既定値）、超えたら `timeout` のエラーで終わる。
- FR5: `get` / `wait` / `read` の対象の pane が存在しない、またはその pane でエージェントが検出されていない
  場合は `agent_not_found` のエラーで終わる（herdr と同じエラー名）。
- FR6: 終了コード・出力の規約は既存の wtmctl と同じ（成功=0 で stdout に JSON／テキスト、サーバ・待ち合わせの
  エラー=1 で stderr に JSON、使い方の誤り〔未知の状態名・不正な数値・引数の過不足〕=2）。
- FR7: 認証（セッションのキャッシュと 1 回だけの再ログイン）・接続先の指定（`--url`/`--token`・環境変数）は
  既存の wtmctl のコマンドと同じ仕組みを使う。

## 非機能要件 / 制約

- **新しい認証方式・新しい入口（RPC・HTTP エンドポイント・ソケット）を追加しない**。サーバ・プロトコル・web は
  変更しない。
- 状態の判定（`done` の導き方）は、ブラウザの表示と同じ規則に揃える（CLI とブラウザで状態の呼び方が
  食い違わない）。
- `agent read` は `agent_not_found` の確認以外は既存の `pane read` と同じ読み方（同じ結果の元）を使う。
- 既存のビルド・型検査・単体テスト・起動確認（`aidev smoke`）を壊さない。単体テストは全体実行の負荷下でも
  安定して通る（時間に依存する待ち合わせの判定を、裏の非同期処理の完了を待たずに行わない）。

## 完了条件 (受け入れ基準)

- [ ] AC1: `wtmctl agent list` が、エージェントの検出されている pane だけを、FR1 の項目つきで JSON で出す
      （エージェントの居ない pane は出ない。1 件も無ければ空の一覧）。状態は AC2 と同じ規則で導かれる。
- [ ] AC2: `wtmctl agent get <paneId>` が 1 件を出す。状態は、idle で未読の完了があるとき `done`、
      それ以外はサーバの状態そのまま、になる。
- [ ] AC3: `wtmctl agent wait` が、既定（`--until` 省略）では `idle` / `done` / `blocked` のどれかで返り、
      `working` / `unknown` の間は返らない。呼び出し時点で一致していれば即座に返る。
- [ ] AC4: `wtmctl agent wait` が、待っている間に届いた状態変化のイベントで一致を判定して返る
      （実サーバでイベントを起こして確かめる）。`--until` を複数指定するとそのどれかで返る。返るときに出す
      エージェントは FR1 と同じ形で、一致した時点の状態（AC2 と同じ規則）を持つ。
- [ ] AC5: `--timeout` 内に一致しなければ `timeout` のエラー（終了コード 1）で終わる。省略時は時間切れの
      タイマーを持たない（一致しないまま、既存の RPC の応答待ちの上限〔10 秒〕より長く待っても返らないことで確かめる）。
- [ ] AC6: 待っている間にエージェントが居なくなる（null になる・別のエージェント〔instanceId が違う〕に
      入れ替わる・pane が閉じる）と `agent_not_running` のエラー（終了コード 1）で終わる。
- [ ] AC7: `wtmctl agent read <paneId>` が、その pane の画面内容を（既定で ANSI 除去・末尾 80 行、`--lines` で
      行数指定、`--raw` で除去なし）出す。画面内容が `--timeout` 内に届かなければ `timeout` のエラー（終了コード 1）。
- [ ] AC8: 存在しない pane・エージェントの居ない pane を `get` / `wait` / `read` で指すと `agent_not_found` の
      エラー（終了コード 1）。未知の状態名・不正な `--timeout`/`--lines`・引数の過不足は終了コード 2。
- [ ] AC9: サーバ・プロトコル・web に変更が無く（`git diff --stat main...HEAD` で `packages/server`・
      `packages/protocol`・`packages/web` が変わっていない）、`agent` コマンドは既存のセッションキャッシュ・再ログイン・Origin 付きの接続
      （`withSession`）を経由している。
- [ ] AC10: （非機能要件「既存の…を壊さない」）`pnpm -s build` / `pnpm -s typecheck` / `pnpm -s test`（2 回）/ `aidev smoke` が通る。
- [ ] AC11: `docs/herdr-parity.md` の H39 行と利用者向けの wtmctl の使い方の記述が本 work の内容を反映し、
      残り（prompt・start と名前・skill ファイル）が backlog に `[ ]` で残っている。

## 未確定事項 / 確認したいこと

- 出力 JSON の形（herdr の `.result.agent` に合わせて `{ agent: … }` で包むか、フィールド名）——design で確定する。
- `agent read` の行数の数え方（画面の末尾の空行の扱い）——design で確定する。
