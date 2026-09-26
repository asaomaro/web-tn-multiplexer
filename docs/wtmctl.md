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
wtmctl snapshot
wtmctl watch [--json]
wtmctl agent list
wtmctl agent get <paneId>
wtmctl agent wait <paneId> [--until working|blocked|idle|done|unknown]... [--timeout <ms>]
wtmctl agent read <paneId> [--lines <N>] [--raw] [--timeout <ms>]
```

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
- 対象の pane が無い・エージェントが検出されていないと `agent_not_found`。
- 読み取り（`get`・`wait`・`read`）は既読を進めない（`done` は `done` のまま）。

### 例: エージェントに作業させて、手が空くのを待って結果を読む

```bash
pane=p2                                       # wtmctl agent list で調べた pane ID
wtmctl pane input "$pane" "テストを直して"       # エージェントの入力欄へ文字だけ送る
wtmctl pane input "$pane" $'\r'                # 別の呼び出しで Enter（CR）を送る
wtmctl agent wait "$pane" --until working --until blocked --timeout 30000   # 作業が始まった（か、すぐ承認待ちになった）のを確かめる
wtmctl agent wait "$pane" --timeout 600000     # idle / done / blocked になるまで待つ
wtmctl agent read "$pane" --lines 120
```

`pane run` は末尾に LF（`\n`）を付けて送る。シェルではこれで実行されるが、raw mode で動くエージェントの画面では
LF が Enter ではなく改行の入力として扱われることがあるので、上のように Enter は CR（`\r`）で別に送る
（文字と同じ書き込みに CR を続けると、貼り付けの一部として扱われて確定されないことがある。herdr の `agent prompt` が
遅延 Enter を使うのと同じ理由。この送り方は実際のエージェントでは未検証）。

入力を送った直後にいきなり `agent wait`（既定の `--until`）を打つと、エージェントがまだ作業を始める前の
`idle` で即座に返ることがある。上のように先に `--until working`（すぐ承認待ちになる場合に備えて `--until blocked` も）で作業の開始を待つ（作業がごく短いと `working` を
見逃して時間切れになりうる。そのときは `agent read` で結果を確かめる）。

## herdr との対応と違い

herdr の `agent list` / `agent get` / `agent wait` / `agent read` に相当する（`docs/herdr-parity.md` の H39）。違い:

- 対象は **pane ID だけ**。herdr のエージェント名（`agent start` / `agent rename` で付ける名前）は無い。
- `agent start`・`agent prompt`（`--wait` を含む）・`agent send-keys`・`agent rename`・`agent focus`・`agent explain`・
  `agent attach` は無い。prompt は `pane run` / `pane input` で送る（bracketed paste や遅延 Enter の送り分けはしない）。
- `agent read` に `--source` は無い（常にスクロールバック込みの画面の末尾 N 行。alternate screen を使うエージェントでは
  今の alt screen の中身だけ）。alternate screen の履歴を自動でスクロールして読む機能も無い。
- 出力は camelCase で、herdr の `.result.agent` は `.agent` に当たる（例: `jq -r .agent.status`）。
- エラーの code（`agent_not_found`・`agent_not_running`・`timeout`）と、`--until` の既定・終了コードは herdr と同じ。
