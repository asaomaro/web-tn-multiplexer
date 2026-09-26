# 要件: `wtmctl agent start`（空いているシェル pane でエージェントを起動し、名前を付けて起動完了まで待つ）

## 背景 / 課題

`wtmctl agent list/get/wait/read/prompt/send-keys/rename`（20260926-agent-automation-api・20260926-agent-prompt-send-keys・
20260926-agent-start-rename）は、**既に起動しているエージェント**しか扱えない。スクリプトやオーケストレーター役の
エージェントが「pane を分けて、そこでレビュー役のエージェントを起動し、`reviewer` という名前で prompt を送る」には、
今は `wtmctl pane run <paneId> "claude …"` で任意のコマンド行を打ち込み、検出されるのを自分で待ち、`agent rename` で
名前を付ける、という手作業の組み合わせが要る。`pane run` は任意のコマンド行をそのまま打つので、引数を組み立てる側が
シェルのクォートを誤ると、引数の中の `;`・`$(…)`・改行がシェルの構文として実行される。また、エディタや別のプログラムが
前面にある pane に打ち込んでも止まらない。

herdr は `agent start <name> --kind KIND --pane ID [--timeout MS] [-- <args>]` で、(1) 前面がシェル自身だけの pane にだけ、
(2) kind から決まる固定の実行ファイルを、(3) `--` の後の引数をシェルに合わせてクォートして打ち込み、(4) 期待した種類の
エージェントが検出され入力を受け付けられる状態になるまで待つ（herdr `src/app/agents.rs:144-231`・`src/cli/agent.rs:289-436, 562-630`・
`docs/next/website/src/content/docs/cli-reference.mdx:341-350`）。`docs/herdr-parity.md` の H39 の残りがこれ
（範囲の選定は decisions.md D1）。

## 目的 / ゴール

- 利用者（人・スクリプト・エージェント）が、1 つのコマンドで「空いているシェル pane にエージェントを起動し、名前を付け、
  prompt を送れる状態になったこと」まで確かめられ、起動・検出の待ち合わせと名前付けを自分で組み立てずに済む状態。
- `agent start` で外部 API から pane に打ち込まれるのが「固定表の実行ファイルと、1 つずつ引数として渡るだけの文字列」に限られ、
  引数の中身がシェルの構文として解釈されることも、シェル以外（エディタ・別のプログラム・エージェント）が前面の pane に
  打ち込まれることも無い状態。
- 起動がうまくいかなかったとき（検出されない・承認待ちで止まった・別の種類が起動した・終了した）に、何が起きたかが
  エラー code で分かる状態。

（`.aidev/charter.md` はこの PJ に無い。）

## ユーザーストーリー

- US1: エージェントを自動で操作するスクリプト（または別のエージェント）として、`wtmctl agent start reviewer --kind claude --pane p3`
  で空いているシェル pane にエージェントを起動し、起動完了まで待ってから `agent prompt reviewer …` を送りたい。
  なぜなら、起動の待ち合わせと名前付けを自分で書かずに済むから。（受け入れ: AC1, AC2, AC3, AC13）
- US2: スクリプトの作者として、`--` の後にエージェントへの引数（例 `--model x`）を渡したい。どんな文字列を渡しても、
  それがそのまま 1 つの引数として届き、シェルの構文として実行されないでほしい。なぜなら、外から受け取った文字列を
  引数に使っても、pane で意図しないコマンドが走らないから。（受け入れ: AC5, AC6, AC7）
- US3: pane で作業している利用者として、エディタや別のプログラム・エージェントが前面にある pane や、対応していない
  シェルの pane に、外部から打ち込まれないでほしい。打ちかけのコマンド行と連結して実行されるのも困る。なぜなら、
  作業中の画面に文字列が流れ込んで壊れる・意図しないコマンドが走るのを防げるから。（受け入れ: AC8, AC9, AC10, AC11）
- US4: スクリプトとして、起動がうまくいかなかったときに理由をエラー code で知りたい。なぜなら、再試行するか・
  人に知らせるかを分岐できるから。（受け入れ: AC4, AC12, AC14, AC15, AC16）
- US5: この製品の利用者として、`agent start` の使い方・対応シェル・herdr との違いを文書で知りたい。なぜなら、
  herdr 用に書いた手順を持ち込むときに違いでつまずかないから。（受け入れ: AC17）

## スコープ

### 対象

- `wtmctl agent start <name> --kind KIND --pane ID [--timeout MS] [-- <args>...]`（herdr `agent start`）と、それを受けるサーバの RPC。
- kind から実行ファイルを決める固定表（本製品が検出できる種類だけ）。
- `--` の後の引数の検査（制御文字の拒否）と、POSIX 系シェルの単一引用符によるクォート。
- 空いているシェル pane の判定（前面プロセスグループがシェル自身だけ・対応シェル）。
- 起動中の名前の予約と、期待した種類のエージェントが検出されたときの名前付け（20260926-agent-start-rename の名前の規則の上）。
- CLI の起動完了の待ち合わせ（検出後 3 秒の猶予を経た `idle`（または `done`）・`blocked` なら `agent_not_ready`・既定 30 秒の締め切り）。
- `docs/wtmctl.md`・`docs/herdr-parity.md`（H39）の更新。

### 対象外

- **POSIX 系（sh・bash・dash・zsh・ksh・mksh）以外のシェル**（fish・csh・tcsh・nu・elvish・xonsh・pwsh・powershell・cmd）と、
  **Windows で動くサーバ**での起動。何も書かずに断る（decisions.md D1。backlog の兄弟に残す）。
- ブラウザから `agent start` する操作・起動中（検出前）の状態の画面表示。
- herdr の `omp`・`mastracode`（本製品は画面マニフェストを持たず検出できない。`packages/server/src/agent/agents.ts` の冒頭）。
- 本物のエージェント（Claude Code 等）を課金して起動する検証（偽のエージェントで確かめる）。
- 起動時の会話の再開（herdr の `persisted_session_from_launch_args`）・名前の保存。
- pane の作成・分割（herdr と同じく、`agent start` は既存の pane だけを使う）。

## 機能要件

- FR1: `wtmctl agent start <name> --kind KIND --pane ID [--timeout MS] [-- <args>...]` は、pane `ID` のシェルに `KIND` の
  エージェントを起動し、起動完了（FR10）まで待ってから、そのエージェントの見え方（`agent get` と同じ形。`name` は `<name>`）を
  JSON で標準出力へ出す。
- FR2: `<name>` は 20260926-agent-start-rename と同じ書式（`[a-z][a-z0-9_-]{0,31}`）で、外れれば `invalid_agent_name`。
  live なエージェントの名前と、**起動中（まだ検出されていない）の他の `agent start` が予約した名前**のどちらとも重なってはならず、
  重なれば `agent_name_taken`。どちらの誤りでも何も書かない。起動中に予約された名前は `agent rename` でも他のエージェントに付けられない（`agent_name_taken`）。
- FR3: `KIND` は次の固定表（本製品が検出できる 22 種類。実行ファイル名は herdr の `interactive_agent_executable` と同じ）からだけ選ぶ。
  `pi`→`pi`・`claude`→`claude`・`codex`→`codex`・`gemini`→`gemini`・`cursor`→`cursor-agent`・`devin`→`devin`・`agy`→`agy`・
  `cline`→`cline`・`opencode`→`opencode`・`copilot`→`copilot`・`kimi`→`kimi`・`kiro`→`kiro-cli`・`droid`→`droid`・`amp`→`amp`・
  `grok`→`grok`・`hermes`→`hermes`・`kilo`→`kilo`・`qodercli`→`qodercli`・`qwen`→`qwen`・`letta`→`letta`・`maki`→`maki`・`muse`→`muse`。
  表に無い値は CLI の使用誤り（終了コード 2）で、サーバも `unsupported_agent_kind` で断る。打ち込むのは表の実行ファイル名と
  `--` の後の引数だけで、任意のコマンド行を受け付ける入力は無い。
- FR4: `--` の後の各引数に制御文字（U+0000〜U+001F・U+007F〜U+009F。改行・タブ・ESC を含む）が 1 つでもあれば
  `invalid_agent_argument` で断り、何も書かない。打ち込む 1 行が長すぎる（4000 バイト超）ときも同じ code で断る。
  （既存の `pane run`・`pane input` は任意の文字列を送る別の操作のまま変えない。）
- FR5: `--` の後の各引数は、どんな文字列（空文字列・空白・`'`・`"`・`\`・`$VAR`・`$(…)`・バッククォート・`;`・`|`・`&`・`>`・
  `*`・`~`・`!`・`%VAR%`・`-` 始まり・非 ASCII）でも、実行ファイルにそのまま 1 つの引数として届き、シェルの構文
  （コマンドの区切り・置換・展開・リダイレクト・履歴展開）として解釈されない。
- FR6: 空いているシェル pane にだけ打ち込む。pane が無ければ `agent_pane_not_found`。次のどれかなら `agent_pane_busy` で何も書かない:
  pane にエージェントが検出されている／その pane で別の `agent start` が起動中／前面プロセスグループがシェル自身でない、
  またはシェル以外のプロセスを含む／前面を確かめられない（取得できない・時間切れ）。
- FR7: 対応シェルは sh・bash・dash・zsh・ksh・mksh（前面のシェルのプロセス名で見分ける。パスの付いた名前・login シェルの `-` 付きの名前も
  同じシェルとして扱う）。それ以外のシェル、または
  サーバが Windows で動いているときは `unsupported_agent_shell` で何も書かない。
- FR8: 打ち込む前に、プロンプトの打ちかけの文字列を消す操作を送り、打ちかけの文字列と連結して実行しない（bash・dash の既定の
  行編集で確かめる）。コマンド行はシェルが bracketed paste を有効にしていれば貼り付けとして送り、最後に Enter を送る。
- FR9: 起動を受け付けたら、その pane に期待した種類（`KIND`）のエージェントが新しく検出された時点で、そのエージェントに `<name>` が
  付く（名前付けは 20260926-agent-start-rename の名前の規則の上に載せ、名前の無い `AgentInfo` の更新経路に名前を混ぜない）。
  別の種類が検出されたら予約を解く。締め切りまでに検出されなければ予約を解き、名前はすぐ再利用できる。一度付いた名前は、
  そのエージェントが終了・入れ替わる・pane が閉じるまで残る（締め切りで外さない）。
- FR10: CLI は、名前の付いた期待した種類のエージェントの状態が `idle`（または `done`）になったら成功で返す。検出直後の
  3 秒は状態を判定しない（`unknown` のまま）ので、成功は検出から 3 秒以上後になる。`working`・`unknown` の間は待ち続ける。
- FR11: 起動の待ち合わせの失敗は、既存の `wtmctl` の規則（エラー応答は終了コード 1 で stderr に JSON）で返す:
  - 待っている間に `blocked` になった → `agent_not_ready`（名前は付いたまま。`agent send-keys` で答えられる）。
  - 別の種類のエージェントが検出された → `agent_kind_mismatch`。
  - 名前の付いたエージェントが終了した・入れ替わった・pane が閉じた → `agent_start_failed`。
  - 締め切り（`--timeout`。既定 30000 ms）を過ぎた → `timeout`。
- FR12: `--timeout` は整数でなければ CLI の使用誤り（終了コード 2）。3000 以下または 300000 超はサーバが `invalid_agent_timeout` で断る
  （herdr と同じ範囲）。
- FR13: pane が `agent_pane_busy` のときは、CLI が 2 秒まで 100 ms 間隔で起動を再試行する（シェルの起動直後の初期化を待つ。herdr の
  `PANE_SHELL_READINESS_RETRY_TIMEOUT`）。2 秒を過ぎたら最後の `agent_pane_busy` を返す。
- FR14: 引数の誤り（`<name>`・`--kind`・`--pane` の欠落、未知のオプション、`--` より前の余分な位置引数）は CLI の使用誤り（終了コード 2）。
  `--` より後はすべてエージェントへの引数として扱い、オプションとして解釈しない。
- FR15: `docs/wtmctl.md` に `agent start`（使い方・対応シェル・安全面の扱い・エラー code・herdr との違い）を書き、
  `docs/herdr-parity.md` の H39 を更新する。

## 非機能要件 / 制約

- 既存の外部 API（WebSocket・トークン認証・Origin 検査）の上だけで行い、新しい入口を作らない。
- サーバが pane に書くのは FR8 の決まった操作・FR3 の実行ファイル名・FR5 のクォートした引数・Enter だけ。
- 起動の RPC は打ち込んだ時点で応答し、起動完了の待ち合わせは CLI が既存のイベント（`pane.agent_status_changed`）で行う
  （既存の RPC の応答の上限 10 秒に収める）。
- テストは実時間に依存しない（締め切り・猶予・再試行はフェイクタイマー等）。E2E（packages/e2e）は走らせない。本物のエージェントは起動しない。
- 既存の `wtmctl agent` の各コマンド・名前の規則・web の表示は変えない。

## 完了条件 (受け入れ基準)

- [ ] AC1: 空いている bash の pane に `agent start reviewer --kind claude --pane <id>` を打つと、固定表の実行ファイル（`claude`）が起動し、検出から 3 秒以上後に `idle` になった時点で、`name: "reviewer"`・`kind: "claude"` のエージェントの見え方を出して終了コード 0 で返る。
- [ ] AC2: 起動後、`agent get reviewer`・`agent list` でそのエージェントに `reviewer` という名前が付いている。
- [ ] AC3: 検出前（起動中）は同じ名前での `agent start`・`agent rename` が `agent_name_taken` になり、締め切りまで検出されなければ予約が解けて同じ名前を使える。別の種類のエージェントが検出されたときも予約が解けて同じ名前を使える。一度付いた名前は締め切り後も外れない。
- [ ] AC4: 名前の書式違反は `invalid_agent_name`、live なエージェントの名前との重複は `agent_name_taken`（どちらも何も書かない）。
- [ ] AC5: 表に無い kind は CLI の使用誤り（終了コード 2）で、サーバに直接送っても `unsupported_agent_kind` で何も書かない。固定表のどの kind の実行ファイル名も、本製品の検出でその kind と判定される。
- [ ] AC6: 引数に改行・CR・タブ・ESC・NUL・DEL・C1 制御文字のどれかがあると `invalid_agent_argument` で何も書かない。打ち込む行が 4000 バイトを超えても同じ。
- [ ] AC7: 悪意のある引数の例（`; rm -rf ~`・`$(touch X)`・`` `touch X` ``・`'`・`"`・`\`・`$HOME`・`%PATH%`・`*`・`~`・`!!`・`&& touch X`・`| touch X`・`> X`・空文字列・`-` 始まり・非 ASCII）を渡すと、実物の bash と dash で、実行ファイルが受け取る引数の列が渡した列と完全に一致し、ファイルが作られる等の副作用が起きない（対話的な bash の PTY と、非対話のシェルへの入力の両方で確かめる）。zsh・ksh・mksh はこの環境に無いため実物では確かめず、FR5 のクォートが単一引用符の中を一切解釈しない POSIX の規定だけに依ることを単体テストで確かめ、実物で確かめていないことを test-result.md の「未検証の穴」に書く（decisions.md D1）。
- [ ] AC8: 前面がシェル以外（例 `sleep` の実行中）・エージェントが検出されている・同じ pane で別の起動中・前面が取得できない（結果が無い・取得が時間切れ）、のどれでも `agent_pane_busy` で何も書かない。存在しない pane は `agent_pane_not_found`。
- [ ] AC9: 前面のシェルが対応外（fish・pwsh・cmd 等）、またはサーバが Windows のときは `unsupported_agent_shell` で何も書かない。対応シェル名は、パスや login シェルの `-` 付き（`-bash`・`/usr/bin/zsh`）でも見分ける。
- [ ] AC10: プロンプトに打ちかけの文字列（Enter を押していないもの）がある bash・dash の pane で `agent start` しても、打ちかけの文字列は実行されず、起動した実行ファイルが受け取る引数も渡したものだけ。
- [ ] AC11: 書き込むバイト列は、打ちかけを消す操作・（bracketed paste が有効なら貼り付けで包んだ）コマンド行・Enter の順で、コマンド行は実行ファイル名と単一引用符で包んだ引数だけから成る。
- [ ] AC12: 待っている間に `blocked` になると `agent_not_ready`（終了コード 1）で、名前は付いたまま。
- [ ] AC13: 待っている間の `unknown`・`working` では返らず、`idle`（または `done`）で返る。
- [ ] AC14: 別の種類のエージェントが検出されると `agent_kind_mismatch`、名前の付いたエージェントが終了・入れ替わる・pane が閉じると `agent_start_failed`、締め切りを過ぎると `timeout`（どれも終了コード 1）。
- [ ] AC15: `--timeout` が整数でなければ使用誤り（2）、3000 以下・300000 超は `invalid_agent_timeout`（1）。省略時は 30000 ms。引数の誤り（FR14）は使用誤り（2）で、`--` の後の `--kind` 等はエージェントへの引数になる。
- [ ] AC16: `agent_pane_busy` のとき、CLI は 2 秒まで 100 ms 間隔で再試行し、その間に空けば起動し、空かなければ `agent_pane_busy`（1）で返る。
- [ ] AC17: `docs/wtmctl.md` に `agent start`（使い方・対応シェル・安全面・エラー code・herdr との違い）が書かれ、`docs/herdr-parity.md` の H39 が更新されている。

## 未確定事項 / 確認したいこと

- 名前の予約と名前付けの置き場（`SessionService` か別の部品か）と、名前付けを `renameAgent` の検査とどう共有するか（design）。
- 打ちかけを消す操作のバイト列（design。bash の emacs 行編集・dash の端末の行編集の両方で効くもの）。
