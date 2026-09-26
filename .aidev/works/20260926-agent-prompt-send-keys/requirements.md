# 要件: エージェントへの prompt 送信と待ち合わせ（`wtmctl agent prompt [--wait]`・`agent send-keys`）

## 背景 / 課題

前 work（20260926-agent-automation-api）で `wtmctl agent list/get/wait/read` が入り、外から検出済みエージェントの
状態を知り・待ち・画面を読めるようになった。しかし**エージェントへ仕事を渡す手段**は `pane input`/`pane run`
（生のバイト列を送るだけ）しか無く、次の事故が起きうる:

- 複数行の prompt を生のまま送ると、エージェントの入力欄は途中の改行で確定してしまう（bracketed paste で包めば
  1 つの貼り付けとして届くが、包むべきかは**その瞬間の**端末のモードで決まり、CLI からは見えない）。
- 貼り付けの直後に Enter を続けて送ると、エージェントによっては Enter を「貼り付けの続き（改行）」として扱い、確定されない。
- エージェントが承認ダイアログ（`blocked`）を出しているときに prompt を送ると、ダイアログへの答えとして解釈されうる。
- `pane run` の直後に `agent wait` を打つと、エージェントがまだ `idle` のうちに待ちが即座に成立する
  （前 work の既知の限界。`docs/wtmctl.md`）。

herdr はこれを `agent prompt`（`--wait`）と `agent send-keys` として持つ（一次資料の要点と範囲の選び方は decisions.md D1）。
本 work は backlog 項目「エージェント自動化: `agent prompt`（`--wait`）・`agent send-keys` 相当」（`docs/herdr-parity.md` の H39 の残り）を着地させる。

## 目的 / ゴール

スクリプトや別の AI エージェント（オーケストレーター）が、pane ID で指したエージェントに、**複数行でも 1 つの入力として
確定される形で** prompt を渡せ、承認待ちのエージェントへ誤って prompt を送り込まずに済み、送った仕事が
「始まったこと」を確かめてから「終わるまで」待てる状態にする。承認ダイアログなどへはキー操作で意図的に答えられる。
入口は既存の認証・Origin 検査を通る WebSocket の RPC だけで、新しい入口は増えていない。

## ユーザーストーリー

- US1: オーケストレーターとして、エージェントに複数行の指示を渡して確定させたい。なぜなら、指示が途中の改行で
  ばらばらに確定されたり、Enter が改行として飲まれて確定されないまま放置されたりすると、自動化が止まるから。
  （受け入れ: AC1, AC2, AC3, AC4, AC13）
- US2: オーケストレーターとして、承認・質問で止まっているエージェントに prompt を送り込まないでほしい。
  なぜなら、prompt の文字や Enter がダイアログへの答えとして解釈され、意図しない操作が承認されうるから。
  （受け入れ: AC5）
- US3: オーケストレーターとして、送った prompt で作業が始まったことを確かめ、その作業が終わる（または入力待ちになる）まで
  1 コマンドで待ちたい。なぜなら、送信直後の `idle` で待ちが即座に成立したり、prompt が届かなかったのに永久に待ったり
  せずに済むから。（受け入れ: AC6, AC7, AC8, AC9）
- US4: オーケストレーターとして、エージェントの UI（承認ダイアログ・メニュー）に `esc`・`enter`・矢印・`ctrl+c` などの
  キーで答えたい。なぜなら、`agent_blocked` で止まった後に人手を介さず判断を返せるから。（受け入れ: AC10, AC11）
- US5: 運用者として、この機能が既存の token 認証・Origin/Host 検査の上にだけ載っていてほしい。なぜなら、端末へ
  書き込める新しい攻撃面を増やしたくないから。（受け入れ: AC12）
- US6: 後続 work の担当者として、herdr との対応表・利用者向けの説明・backlog が「何が済み・何が残っているか」を
  正しく示していてほしい。なぜなら、残り（起動と名前・skill ファイル）を重複なく拾えるから。（受け入れ: AC14）

## スコープ

### 対象

- `wtmctl agent prompt <paneId> <text> [--wait] [--until STATUS]... [--timeout MS]`
- `wtmctl agent send-keys <paneId> <key> [<key>...]`
- 上の 2 つを支えるサーバ側の送信（bracketed paste の live な判定・遅延 Enter・送信中の他の入力の後回し・
  `blocked` の拒否・キー名の検証と符号化）。
- 新しいエラー code（`agent_not_found` 等）をブラウザのエラー文言の表（code → 日本語）に足す（表が全 code の網羅を要求するため）。
- 利用者向けの説明（`docs/wtmctl.md`）と `docs/herdr-parity.md` の H39 行の更新。

### 対象外

- `agent start`・`agent rename` と名前による対象指定、agent skill ファイル（backlog に残っている兄弟項目のまま）。
- herdr の Windows 固有の回避策（Codex への paste boundary・Copilot への focus 通知）、kitty keyboard protocol に
  合わせたキーの符号化、`agent_not_ready`（名前付きで起動中の判定）。範囲の外として記録するだけで backlog には残さない（decisions.md D1）。
- ブラウザ（web）の UI の変更（エラー文言の表への追加を除く）。

## 機能要件

- FR1（送信の形）: `agent prompt` は、送る瞬間に対象 pane の端末で bracketed paste モードが有効なら本文を
  `ESC[200~` と `ESC[201~` で包み、無効なら包まずに送る。本文の後に**一定の間（herdr と同じ 300ms）を置いてから**
  Enter（`\r`）を送る。本文と Enter は 1 つの順序付きの送信で、その間に届いた他の入力（ブラウザ・`pane input` 等）は
  Enter の後へ回す。
- FR2（`--wait` 無しの結果）: 送信（Enter まで）を書き終えたら、その pane のエージェントを前 work と同じ形
  （`{ agent: AgentView }`）で出して終了コード 0。
- FR3（送らない場合）: 対象の pane が無い・エージェントが検出されていない → `agent_not_found`。エージェントが `blocked` →
  **何も書かずに** `agent_blocked`。本文が空 → `empty_agent_prompt`（どれも終了コード 1）。
- FR4（`--wait` の活動確認）: 送信前のエージェントが `working` でなければ、送信を始めた後に `working` か `blocked` を
  （一瞬でも）観測するまで待つ。締め切りは「送信を書き終えてから 5000ms」と「`--timeout` の締め切り」の早いほうで、
  観測できないまま締め切りに達したら、前者なら `agent_prompt_stalled`（終了コード 1。今の状態をメッセージに含める）、
  後者（`--timeout` の締め切りが同じか早い）なら `timeout`。締め切りより前に観測できれば FR5 へ進む。
- FR5（`--wait` の状態待ち）: 活動を観測した後（送信前から `working` だったときは送信の後すぐ）、`--until`（繰り返し可。
  省略時は `idle`/`done`/`blocked`）のどれかになったら、その時点のエージェントを `{ agent: AgentView }` で出して終了コード 0。
  活動として観測した状態自体が `--until` に含まれていればそれで一致とする（例: 既定では `blocked` を観測したら即座に返る）。
- FR6（`--wait` の時間）: `--timeout` は送信の時間を含む全体の上限。省略時、活動確認（5 秒）の後の状態待ちは無期限。
  待っている間にエージェントが居なくなる・入れ替わる・pane が閉じると `agent_not_running`（前 work の `agent wait` と同じ）。
- FR7（使い方の誤り）: `--until`・`--timeout` を `--wait` 無しで指定・未知の状態名・不正な `--timeout`・位置引数の過不足は
  終了コード 2。
- FR8（`agent send-keys`）: キー名の列を受け、**全部を検証してから**、対象 pane の端末のモードに合わせて符号化して 1 回で書く。
  1 つでも不明なキー名があれば何も書かずに `invalid_key`（終了コード 1）。受け付けるキー名は herdr のキー名の
  うち xterm の既定の符号化で表せるもの（`enter`/`return`・`esc`/`escape`・`tab`・`shift+tab`・`backspace`・`space`・
  矢印 4 つ・`f1`〜`f12`・1 文字・名前つきの記号〔`minus` 等〕と、`ctrl`/`alt`/`shift` の修飾。`C-c` は `ctrl+c` の別名）。
  対象の pane が無い・エージェントが検出されていない → `agent_not_found`。`blocked` でも送れる（ダイアログに答えるための手段）。
  成功したら `{ ok: true, paneId }` を出して終了コード 0。
- FR9（接続）: 認証（セッションのキャッシュと 1 回だけの再ログイン）・接続先の指定・エラーの出し方（stderr に JSON）は
  既存の wtmctl と同じ。

## 非機能要件 / 制約

- 新しい入口（HTTP エンドポイント・ソケット）を足さない。サーバへの経路は既存の WebSocket RPC（token 認証の session cookie・
  Origin/Host 検査を通った接続）だけ。RPC の引数はスキーマで検証し、本文の大きさは既存の INPUT フレームと同じ上限（1MB）で抑える。
- 時間に依存する振る舞い（300ms の遅延・5 秒の活動確認・`--timeout`）の単体テストは、手で進める時計（フェイクタイマー）で
  確かめ、実時間に依存しない。実 PTY を使う結合テストは十分な猶予を取る。
- 既存のビルド・型検査・単体テスト（全体で 2 回）・起動確認（`aidev smoke`）を壊さない。

## 完了条件 (受け入れ基準)

- [ ] AC1: bracketed paste モードが有効な pane への `agent prompt` は、本文を `ESC[200~…ESC[201~` で包んで書き、
      無効な pane では包まずに書く。判定は送る瞬間のモードによる（同じ pane でモードを切り替えると包み方が変わる）。
- [ ] AC2: 本文を書いてから Enter（`\r`）を書くまでに 300ms の間がある（手で進める時計で、299ms の時点では Enter が
      書かれておらず、300ms で書かれる）。
- [ ] AC3: 送信中（本文から Enter まで）に届いた他の入力は、Enter の後に元の順序で書かれる。送信が無いときの入力は従来どおり即座に書かれる。
- [ ] AC4: `--wait` 無しの `agent prompt` は、Enter を書き終えた後に `{ agent }` を出して終了コード 0。
- [ ] AC5: エージェントが `blocked` の pane への `agent prompt` は `agent_blocked`（終了コード 1）で、端末へは 1 バイトも
      書かれない。pane が無い・エージェントが居ない → `agent_not_found`、空の本文 → `empty_agent_prompt`（どれも終了コード 1・書き込みなし）。
- [ ] AC6: `--wait` で、送信前が `working` でないとき、送信を始めた後に `working`（一瞬でもよい）か `blocked` を観測するまで
      `--until` の一致を判定しない（送信直後の `idle` や送信前の `done` では返らない）。
- [ ] AC7: `--wait` で、送信を書き終えてから 5000ms 以内に活動を観測できなければ、5000ms の時点で `agent_prompt_stalled`
      （終了コード 1。メッセージに今の状態）。`--timeout` の締め切りがそれと同じか早ければ、`--timeout` の締め切りの時点で
      `timeout`。どちらの締め切りより前でも活動を観測すれば、これらのエラーにならず AC8 の状態待ちへ進む。
- [ ] AC8: `--wait` で活動を観測した後、`--until`（既定 `idle`/`done`/`blocked`、繰り返し指定可）に一致したら
      `{ agent }` を出して終了コード 0。観測した活動の状態が `--until` に含まれればそれで返る。送信前から `working` なら
      活動確認を省いて状態待ちに入る。
- [ ] AC9: `--wait` 中にエージェントが居なくなる・入れ替わる・pane が閉じると `agent_not_running`、`--timeout` を過ぎると
      `timeout`（どれも終了コード 1）。`--timeout` は送信の時間を含めて数え（送信に時間がかかった分だけ待ちの残りが減る）、
      省略時は活動確認の後の状態待ちが時間切れにならない。`--until`/`--timeout` を `--wait` 無しで指定・未知の状態名・
      不正な `--timeout`・本文の欠落や余分な位置引数は終了コード 2。
- [ ] AC10: `agent send-keys` は、キー名の列を端末のモードに合わせて符号化して書く（例: `esc` → `ESC`、`enter` → `\r`、
      `ctrl+c`/`C-c` → `0x03`、`up` → 通常は `ESC[A`・アプリケーションカーソルモードでは `ESCOA`、`shift+tab` → `ESC[Z`）。
      エージェントが `blocked` でも送れる。成功で `{ ok: true, paneId }`・終了コード 0。
- [ ] AC11: `agent send-keys` に不明なキー名が 1 つでも含まれると `invalid_key`（終了コード 1）で、端末へは 1 バイトも
      書かれない。pane が無い・エージェントが居ない → `agent_not_found`。キーが 1 つも無いと終了コード 2。
- [ ] AC12: 新しい RPC は既存の WebSocket の RPC として登録され（新しい HTTP の経路・ソケットは無い）、CLI の 2 コマンドは
      既存のセッションキャッシュ・再ログイン・Origin 付きの接続（`withSession`）を経由する。引数はスキーマで検証され、
      1MB を超える本文は拒否される。エラー（終了コード 1）は既存の wtmctl と同じく stderr に JSON で出る。
      新しいエラー code はブラウザのエラー文言の表にも載っている。
- [ ] AC13: 実 PTY 上の偽のエージェント（bracketed paste を有効にし、貼り付けを受けて Enter で `working` の画面に切り替え、
      しばらくして `idle` に戻る。既存の検出規則に当たる名前で動かす）に対する結合テストで、`agent prompt --wait` が
      複数行の本文を**1 つの貼り付けとして**届け、その後に Enter が届いて確定され、状態が `working` を経て `idle`/`done` に
      なったところで返る。
- [ ] AC14: `docs/herdr-parity.md` の H39 行と `docs/wtmctl.md` が本 work の内容（herdr との違いを含む）を反映し、
      backlog の本項目が `[x]` になっている。
- [ ] AC15: （非機能要件）`pnpm -s build` / `pnpm -s typecheck` / `pnpm -s test`（全体で 2 回）/ `aidev smoke` が通る。

## 未確定事項 / 確認したいこと

- RPC の結果の形（送信前のエージェントを返すか・送信後のものか）と、`--wait` の活動確認で「送信を始めた後」の境目を
  CLI のどこに置くか——design で確定する。
- 送信中に pane が閉じた・プロセスが終了したときのエラー code（herdr は `agent_prompt_failed`）——design で確定する。
