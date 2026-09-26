# wtmctl（外部操作 CLI）

`wtmctl` は、動いている `wtm serve` をブラウザを介さずに操作する CLI（`packages/cli`）。
ブラウザと同じ認証（token でのログイン → session cookie）と同じ接続（`/ws`。Origin/Host の検査つき）を使う。
新しいソケットや認証の入口は持たない。

## 接続とログイン

```bash
wtmctl login --url http://127.0.0.1:7780 --token <TOKEN>   # session cookie を ~/.wtmctl に保存（token は保存しない）
export WTMCTL_URL=http://127.0.0.1:7780                    # 以後 --url を省ける（既定もこの値）
```

- 各コマンドは `--url` / `--token`（または環境変数 `WTMCTL_URL` / `WTMCTL_TOKEN`）を受ける。
  保存済みのセッションが失効していて token が分かれば、1 回だけ再ログインしてやり直す。
- 成功は終了コード 0（結果は stdout に JSON／テキスト）、サーバ・待ち合わせのエラーは 1（stderr に
  `{"error":{"code","message"}}`）、使い方の誤りは 2。

## コマンド一覧

```
wtmctl workspace create [--cwd <path>] [--label <text>]
wtmctl workspace close <workspaceId>
wtmctl workspace rename <workspaceId> <label>
wtmctl tab create [--workspace <id>] [--label <text>]
wtmctl tab close <tabId>
wtmctl pane split <paneId> --direction right|down [--ratio <0.05-0.95>]
wtmctl pane close <paneId>
wtmctl pane input <paneId> <text>          # Enter を付けずに送る
wtmctl pane run <paneId> <command>         # command と改行を送る
wtmctl pane read <paneId> [--follow] [--raw] [--timeout <ms>]
wtmctl pane attach <paneId> [--takeover]   # 手元の端末をその pane に直結する（Ctrl+B q で切り離す）
wtmctl snapshot
wtmctl watch [--json]
wtmctl agent list
wtmctl agent get <paneId>
wtmctl agent wait <paneId> [--until working|blocked|idle|done|unknown]... [--timeout <ms>]
wtmctl agent read <paneId> [--lines <N>] [--raw] [--timeout <ms>]
wtmctl agent prompt <paneId> <text> [--wait] [--until working|blocked|idle|done|unknown]... [--timeout <ms>]
wtmctl agent send-keys <paneId> <key>...
```

## pane への直結（`pane attach`）

手元の端末（SSH 先のシェルを含む）を pane 1 枚に直結し、ブラウザを開かずにその場の端末として操作する。

```bash
wtmctl pane attach p2              # 直結する
wtmctl pane attach p2 --takeover   # 既に別の端末が直結していれば、それを奪って直結する
```

- つないだ時点の**見えている画面**を描き、以後の出力をそのまま流す。打鍵はそのまま pane へ送る（手元の端末は raw モード・代替画面になる）。
  直結より前のスクロールバックは送らない。pane の出力に含まれる端末への問い合わせ（DA・カーソル位置の報告・色の問い合わせ・クリップボードの読み出し等）は
  手元の端末に書かない——答えるのはサーバだけ（ブラウザと同じ）で、手元の端末にも答えさせると答えが二重に pane へ届くため。
- **`Ctrl+B q` で切り離す**（pane のプロセスは止めない）。`Ctrl+B Ctrl+B` で `Ctrl+B` を 1 つ送る。`Ctrl+B` に続くそれ以外のキーは両方を送る。
- 直結している間、**pane の大きさは手元の端末の大きさ**になり、手元の端末の大きさを変えると追従する。ブラウザの表示の大きさ（サイズ権限）は
  その pane の大きさを変えない（同じ tab のほかの pane は今までどおり）。切り離すと、その tab の大きさを決めているブラウザの大きさへ戻る
  （決めているブラウザがいなければ直結時の大きさのまま）。
- **同じ pane に直結できるのは 1 つだけ**。既に直結があれば `pane_attached` で終わる（何も変えない）。`--takeover` なら奪い、奪われた側は
  `attach_taken_over` で終わる。
- 直結中もブラウザでの表示と入力はそのまま使える（ブラウザの入力は止めない。ブラウザから直結を奪う・切り離す操作は無い）。
  直結の所有者は**安全の境界ではない**——認証済みの接続は今までどおり pane に書ける。ブラウザと同じ認証と `/ws`（Origin/Host の検査つき）を使う。
- 終了コード: 切り離しは 0（stderr に `wtmctl: detached from <paneId>`）。奪われた（`attach_taken_over`）・pane のプロセスが終わった・pane が閉じられた
  （`pane_closed`）・サーバ側から切れた（`connection_closed`）・既に直結がある（`pane_attached`）・pane が無い（`not_found`）・
  標準入力か標準出力が端末でない（`not_a_tty`）は 1。使い方の誤りは 2。
  どの終わり方でも、手元の端末のモード（色・カーソルの表示と形・スクロール領域・マウスの報告・bracketed paste 等）を戻し、代替画面から出る。
  `SIGTERM`・`SIGHUP` で止められたときは切り離しと同じに扱う。

## エージェント（`agent`）

pane の中で検出されたコーディングエージェント（Claude Code・Codex 等。ブラウザのサイドバーに状態が出るもの）を、
**その pane の ID** で指して扱う。

| 状態 | 意味 |
|---|---|
| `working` | 作業中 |
| `blocked` | 承認・質問の入力待ち |
| `idle` | 手が空いている（サーバ側でまだ既読になっていない完了は無い） |
| `done` | 手が空いていて、サーバ側でまだ既読になっていない完了がある |
| `unknown` | エージェントは居るが状態を判定できない（成功した保証ではない） |

`done` と `idle` を分ける既読はサーバが持つもので、ブラウザでその pane へフォーカスが**移ったとき**に進む。
ブラウザのバッジはブラウザごとの既読（表示しているだけで既読になる）を使うので、既にフォーカスしている pane や
画面に見えているだけの pane で完了した場合など、ブラウザでは `idle` なのに CLI では `done` のままのことがある
（herdr でも CLI とクライアントのバッジは別々に既読を持つ）。

- `agent list` … エージェントの居る pane の一覧 `{"agents":[…]}`。各要素は `paneId`・`workspaceId`・`tabId`・
  `status`（上の 5 値）・`kind`（`claude` 等）・`label`・`state`（サーバの生の状態。`done` を含まない）・
  `instanceId`・`since` など。
- `agent get <paneId>` … 1 件 `{"agent":{…}}`。
- `agent wait <paneId>` … 状態が `--until` のどれかになったら `{"agent":{…}}` を出して終わる。
  - 呼び出した時点で一致していれば即座に返る。`--until` は繰り返し指定でき、省略時は `idle`・`done`・`blocked`。
  - 状態の変化はサーバからの push で受け取る（ポーリングしない）。
  - `--timeout` を省略すると無期限に待つ（指定できる上限は 2147483647ms）。時間切れは `timeout` のエラー（終了コード 1）。
    接続の死活確認は無いので、スリープやネットワーク断で接続が切れたまま気づけないことがある。長い待ちでは `--timeout` を付ける。
  - 待っている間にエージェントが終了した・別のエージェントに入れ替わった・pane が閉じたら `agent_not_running`、
    サーバが接続を閉じたら `connection_closed`（どちらも終了コード 1）。
- `agent read <paneId>` … その pane の画面（スクロールバック込み）の末尾 `--lines` 行（既定 80。末尾の空行は数えない）を
  テキストで出す（alternate screen を使うエージェントでは今の alt screen の中身だけ）。既定で ANSI エスケープを除く（`--raw` で除かない。そのときは端末の制御列〔カーソル移動・モード設定〕を
  含むので、端末へそのまま流さない）。`--timeout` は画面内容がサーバから届くまで
  待つ上限（既定 5000ms。超えたら `timeout`）。
- `agent prompt <paneId> <text>` … エージェントへ prompt を送って確定する。`{"agent":{…}}` を出す（`--wait` 無しは送信を始めた時点の
  エージェント、`--wait` は一致した時点のもの）。
  - 本文は、送る瞬間にその pane の端末で bracketed paste が有効なら `ESC[200~`…`ESC[201~` で包んで 1 つの貼り付けとして送る
    （複数行でも途中の改行で確定されない。本文の中の `ESC[200~`・`ESC[201~` は取り除く）。無効なら包まずに送る。
  - `agent list`/`get` と同じく、コマンドが接続したときに見たエージェントにだけ送る。送る前に別のエージェントに入れ替わっていたら
    何も送らずに `agent_not_found`（`send-keys` も同じ）。
  - 本文を書いてから **300ms** 置いて Enter（CR）を送る（貼り付けの直後の Enter を「貼り付けの続きの改行」として扱うエージェントがあるため。
    herdr と同じ間）。本文から Enter までの間に届いた他の入力（ブラウザでの打鍵・`pane input` 等）は Enter の後へ回す。
  - エージェントが `blocked`（承認・質問の入力待ち）なら**何も送らずに** `agent_blocked`。別の入力の後ろで待っている間に `blocked` になった・
    エージェントが終了した場合も、本文を書く直前にもう一度確かめて送らない（`agent_blocked` / `agent_not_found`）。ただし状態の判定は
    周期的（500ms ごと）で、本文から Enter までの 300ms の間は確かめ直さないので、その分の窓は残る。本文が空なら `empty_agent_prompt`、
    1MB を超えると `invalid_params`。本文が `--` で始まると未知のオプションとして使い方の誤り（終了コード 2）になる（`pane input` と同じ制約）。
  - 送信の途中で端末が閉じると `agent_prompt_failed`（閉じた時点によって、本文が書かれている場合も書かれていない場合もある）。
  - `--wait` … 送った後、エージェントが `working` か `blocked` になった（一瞬でもよい）ことを確かめてから、`--until`（省略時は `idle`・`done`・`blocked`）の
    どれかになるまで待つ。送信を書き終えてから **5 秒**以内に `working`/`blocked` を観測できなければ `agent_prompt_stalled`（メッセージに今の状態）。
    送る前から `working` ならこの確認を省く（そのときは今の作業の完了で返りうる。1 回の送信ごとの「ターン」は追わない）。
  - `--timeout` は送信の時間も含めた全体の上限（`--wait` と一緒のときだけ指定できる。`--until` も同じ）。残りが 5 秒以下なら
    `agent_prompt_stalled` ではなく締め切りで `timeout`。省略すると、活動を確かめた後は無期限に待つ。
  - 待っている間にエージェントが終了した・入れ替わった・pane が閉じたら `agent_not_running`。
  - `timeout`・`agent_prompt_stalled`・`agent_prompt_failed`・`agent_not_running`・`connection_closed` は「送られなかった」ことを意味しない。送り直す前に `agent read` で確かめる（二重に送らないため）。
- `agent send-keys <paneId> <key>...` … エージェントの UI（承認ダイアログ・メニュー）へキーを送る。`blocked` でも送れる。`{"ok":true,"paneId":…}` を出す。
  - キー名: `enter`/`return`・`esc`/`escape`・`tab`・`shift+tab`・`backspace`/`bs`・`space`・`up`/`down`/`left`/`right`・`f1`〜`f12`・1 文字
    （`y` 等。大文字は shift つき）・記号名（`minus` `comma` `period` `slash` `backslash` `quote` `double_quote` `semicolon` `colon`
    `percent` `ampersand` `backtick` `plus`）。修飾は `ctrl`/`control`・`alt`/`option`/`meta`・`shift` を `+` でつなぐ（例 `ctrl+c`。別名は `C-c` だけで、`C-x` のような書き方は使えない）。
  - 矢印は端末のアプリケーションカーソルモードに合わせて送る。符号化は xterm の既定のもの（`ctrl+enter` のように既定の符号化で表せない組み合わせは使えない）。
  - 不明なキー名が 1 つでもあれば**何も送らずに** `invalid_key`。
- 対象の pane が無い・エージェントが検出されていないと `agent_not_found`。
- 読み取り（`get`・`wait`・`read`）は既読を進めない（`done` は `done` のまま）。

### 例: エージェントに作業させて、終わるのを待って結果を読む

```bash
pane=p2                                                    # wtmctl agent list で調べた pane ID
wtmctl agent prompt "$pane" "テストを直して" --wait --timeout 600000   # 送って、作業が始まったのを確かめ、終わるまで待つ
wtmctl agent read "$pane" --lines 120
```

### 例: 承認待ちで止まったら、画面を読んで答える

```bash
wtmctl agent wait "$pane" --until blocked --timeout 600000
wtmctl agent read "$pane" --lines 40
wtmctl agent send-keys "$pane" esc                         # 取り消す（答えるなら例えば y や enter）
```

## herdr との対応と違い

### `pane attach`

herdr の `terminal attach <terminal_id> [--takeover]` に相当する（`docs/herdr-parity.md` の H40）。同じ点: 1 端末に書き込み可能な直結は 1 つ・
`--takeover` で奪う・直結の大きさを優先してフル UI（ブラウザ）からは変えない・`Ctrl+B q` / `Ctrl+B Ctrl+B`・切り離しは終了コード 0 でそれ以外の終わり方は 1（使い方の誤りは 2）・
フル UI からの入力は止めない。違い:

- herdr はサーバで描き直したフレームを送るが、wtmctl は **pane の生の出力をそのまま流す**。このため pane の中のアプリが代替画面から出ると
  手元の端末も主画面に出て、直結前の画面に出力が重なる。kitty keyboard のフラグ・modifyOtherKeys は切り離しても戻さない
  （pane のエージェントがそれを有効にしていた場合、切り離した後に手元のシェルのキー入力の符号化が戻らないことがある）。
- 直結中のサーバ側のスクロール（ホイール・PageUp/PageDown で遡る）は無い。対象は pane ID だけ（`agent attach <name>` は無い）。
- 閲覧専用の `terminal session observe`・NDJSON で制御する `terminal session control` は無い（出力を追うだけなら `pane read --follow --raw`）。
- Windows の端末からの直結は確かめていない（herdr はネイティブ Windows では直結できない）。

### `agent`

herdr の `agent list` / `agent get` / `agent wait` / `agent read` / `agent prompt`（`--wait`）/ `agent send-keys` に相当する
（`docs/herdr-parity.md` の H39）。違い:

- 対象は **pane ID だけ**。herdr のエージェント名（`agent start` / `agent rename` で付ける名前）は無い。
- `agent start`・`agent rename`・`agent focus`・`agent explain`・`agent attach` は無い。
- `agent prompt`: herdr の Windows 向けの回避策（Codex への貼り付けの区切り・Copilot へのフォーカス通知）と `agent_not_ready`（名前付きで
  起動中の判定）は無い。`--timeout` が送信の途中で尽きたらその時点で `timeout` になる（herdr の Unix 版は送信の完了を待つ）。
  待ち行列の後ろで待っている間の `blocked`・エージェントの終了を書く直前にも確かめる（herdr は受け付けの時点だけ）。
  本文の中の貼り付けの印（`ESC[200~`・`ESC[201~`）を取り除く（herdr はそのまま包む）。
- `agent send-keys`: キーの符号化は xterm の既定だけ（kitty keyboard protocol には合わせない）。`cmd`/`super`/`hyper` の修飾は無い。
- `agent read` に `--source` は無い（常にスクロールバック込みの画面の末尾 N 行。alternate screen を使うエージェントでは
  今の alt screen の中身だけ）。alternate screen の履歴を自動でスクロールして読む機能も無い。
- 出力は camelCase で、herdr の `.result.agent` は `.agent` に当たる（例: `jq -r .agent.status`）。
- エラーの code（`agent_not_found`・`agent_not_running`・`timeout`・`agent_blocked`・`agent_prompt_stalled`・`empty_agent_prompt`・
  `invalid_key`）と、`--until` の既定・300ms の遅延 Enter・5 秒の活動の確認・終了コードは herdr と同じ。
- 本物の Claude Code 等での送信は確かめていない（bracketed paste を有効にする偽のエージェントでの結合テストだけ。
  `.aidev/works/20260926-agent-prompt-send-keys/test-result.md`）。
