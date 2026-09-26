# 要件: `wtmctl pane attach`——手元の端末を pane 1 枚に直結する（書き込み所有者の排他つき）

## 背景 / 課題

herdr には pane（herdr では terminal）1 枚に手元の端末を直結する `herdr terminal attach <id> [--takeover]` と、
第三者のブリッジ向けの `terminal session observe`（閲覧専用・NDJSON）／`terminal session control`（書き込み可・NDJSON の入出力）がある
（`docs/herdr-parity.md` の H40。一次資料の要点は下の「herdr の仕様（一次資料で確かめたこと）」）。
web-tn-multiplexer は外部操作 CLI `wtmctl` を持つが（20260923-external-control-api）、できるのは入力の送信（`pane input`/`pane run`）と
出力の読み取り（`pane read [--follow]`）を別々に行うことだけで、**SSH で入ったサーバのシェルからブラウザを開かずに pane を対話的に操作する**
手段が無い。

既存の購読（`pane.subscribe`）は複数の購読者を許し、書き込み（INPUT フレーム）は認証済みの誰でもでき、PTY の大きさはブラウザ（サイズ権限。
`SizeAuthority`）だけが決める。外部クライアント（`kind: "external"`）はサイズ権限の資格が無いので（`packages/server/src/clients/ClientRegistry.ts` の
`ClientKind` の説明）、手元の端末をそのまま繋ぐと、**ブラウザが決めた大きさの PTY の出力を別の大きさの手元の端末に流す**ことになり、
折り返しと全画面アプリ（vim・エージェントの TUI）の描画が崩れる。herdr は「直結しているクライアントが 1 つだけ入力と大きさを持ち、
`--takeover` で奪う」モデルでこれを解いている。

## herdr の仕様（一次資料で確かめたこと）

`/workspaces/web-tn-multiplexer/scratchpad/herdr/` を直読した（主エージェント）。

- 使い方: `herdr terminal attach <terminal_id> [--takeover]`（`docs/next/website/src/content/docs/cli-reference.mdx:362-372`）。
  「現在の描画済みの端末の状態を送り、その後は生の ANSI フレームを流す。入力はそのまま端末へ」（`persistence-remote.mdx:127`）。
- 切り離し: `ctrl+b q`。`ctrl+b ctrl+b` で `ctrl+b` そのものを送る（`cli-reference.mdx:372`・`src/client/attach.rs:61-103` の `filter_input`）。
  接頭辞の後が `q` でも `ctrl+b` でもなければ、接頭辞とそのキーの両方を送る（同 `:96-97`）。
- 排他: 「書き込み可能な直結クライアントは 1 端末に 1 つだけが入力と大きさを持つ。`--takeover` で既存の所有者を置き換える」
  （`persistence-remote.mdx:131`）。サーバは `terminal_attach_owners`（端末 → クライアント）を持ち、所有者がいて `--takeover` が無ければ
  `terminal attach failed: terminal <id> already has an attached client; retry with --takeover` で切断、ありなら旧所有者へ
  `terminal attach taken over` を送って外す（`src/server/headless.rs:1848-1869`）。
- 大きさ: 直結したクライアントの大きさへ端末を合わせ（`headless.rs:1897-1899` の `runtime.resize`）、`direct_attach_resize_locks` に入れて
  フル UI のレイアウトからは大きさを変えない（`src/ui/panes.rs:230`・`:254`）。所有者が抜けたら鍵を外し（`headless.rs:1021-1028`）、
  フル UI 側の大きさへ戻す（`remove_client_and_resize_if_needed`。`headless.rs:1079-1091`）。
- フル UI からの入力は止めない（`terminal_attach_owners` を入力の経路で見ている箇所は無い。見ているのは大きさの鍵と alt screen の
  読み取りだけ。`grep terminal_attach_owners src/` の結果）。**排他は直結クライアントどうしの間のもの**。
- 終わり方: 切り離し（`detached`）なら終了コード 0、それ以外の切断理由（奪われた・端末が終わった `terminal <id> exited`・
  見つからない）はメッセージを stderr に出して終了コード 1（`src/client/mod.rs:336-353`・`headless/notifications.rs:659-662`）。
- ネイティブ Windows では直結できない（`persistence-remote.mdx:113`・`src/client/startup.rs:17-24`）。
- `terminal session observe <target> [--cols N] [--rows N]` は閲覧専用で NDJSON の `terminal.frame`（base64 の ANSI・seq・
  width/height・full）と最後の `terminal.closed`。複数の観測者が同時に見られ、入力・大きさ・スクロール・奪取の権限を持たない。
  `terminal session control` は同じフレームを出し、stdin の NDJSON（`terminal.input`/`resize`/`scroll`/`release`）を受ける
  （`cli-reference.mdx:373-386`・`src/client/terminal_sessions.rs`）。

## 目的 / ゴール

- 手元の端末（SSH 先のシェルを含む）から、ブラウザを開かずに **pane 1 枚をその場の端末として対話的に操作できる状態**。
- 直結している間、**PTY の大きさが直結した端末の大きさに揃っている**（全画面アプリが崩れない）状態。切り離したら、その tab の大きさを決めている
  ブラウザの大きさへ戻る（決めているブラウザがいなければそのまま）。
- **同じ pane に直結できるのは 1 つだけ**で、後から来た直結は既定で拒まれ、明示したときだけ奪える状態（奪われた側はそれと分かって終わる）。
- 新しい入口が既存の認証・Origin 検査を緩めていない状態。

## ユーザーストーリー

- US1: サーバに SSH で入った利用者として、`wtmctl pane attach <paneId>` で手元の端末をその pane に繋いで、そのまま打鍵・全画面アプリの操作を
  したい。なぜなら、ブラウザを開けない（開きたくない）場面でも、動いているエージェントやシェルに入って操作を続けられるから。（受け入れ: AC1, AC2, AC3, AC4, AC5, AC13）
- US2: 直結している利用者として、`Ctrl+B q` で pane を止めずに切り離したい。なぜなら、pane のプロセスはそのまま残し、手元の端末だけを返して欲しいから。（受け入れ: AC6, AC7）
- US3: 別の端末から同じ pane に繋ごうとした利用者として、既に誰かが直結していることを知らされ、必要なら `--takeover` で奪いたい。
  なぜなら、2 つの端末が大きさを奪い合って画面が壊れるのを避けつつ、放置された直結を取り返せるから。（受け入れ: AC8, AC9）
- US4: ブラウザで同じ pane を見ている利用者として、直結中も表示と入力が続き、切り離されたら自分の画面の大きさに戻って欲しい。
  なぜなら、直結はブラウザの利用を妨げるものではなく、終われば元の見え方に戻るべきだから。（受け入れ: AC10, AC11）
- US5: 運用者として、新しい入口が認証と Origin 検査の外に出ていないことを確かめたい。なぜなら、端末に直結できる経路は最も危険な経路だから。（受け入れ: AC12）

## スコープ

### 対象

- `wtmctl pane attach <paneId> [--takeover]`（対話用。手元の端末の raw モード・画面の復元・切り離しキー・大きさの追従）。
- サーバの「直結の所有者」（pane ごとに高々 1 クライアント）と、直結中の PTY の大きさの決定（ブラウザのサイズ権限より直結を優先）。
- 所有者の変化を奪われた側へ知らせる仕組み（奪われた側の `wtmctl` が終わるため。知らせ方は design で決める。ブラウザは今回は使わない）。
- `docs/wtmctl.md`・`docs/herdr-parity.md` の H40 の更新。

### 対象外（残りは backlog に兄弟項目として残す）

- `terminal session observe` 相当（閲覧専用の NDJSON ストリーム）と `terminal session control` 相当（NDJSON の入出力による書き込み可能な制御）——
  選んだ理由は decisions.md D1。
- 直結中のサーバ側のスクロール（herdr は直結でもホイール・PageUp/Down でサーバの端末を遡れる）。今回はつないだ時点の**見えている画面**だけを送り、
  直結より前のスクロールバックは送らない。
- ブラウザでの直結中の表示（「wtmctl が直結中」の印など）とブラウザからの奪取・切り離しの操作。
- `agent attach <name>`（エージェントの名前による対象指定が未実装。H39 の後続項目に依存）。
- ブラウザからの入力を直結中に止めること（herdr も止めない。排他は直結クライアントどうしのもの）。
- ネイティブ Windows の端末からの直結の動作確認（コードは OS を分けないが、確かめない。未検証として残す）。

## 機能要件

- FR1: `wtmctl pane attach <paneId>` は、既存の認証（セッションキャッシュ・`--token`/`WTMCTL_TOKEN`）で `/ws` に繋ぎ、その pane の直結の所有者になり、
  PTY の大きさを手元の端末の大きさ（列・行）にし、見えている画面を手元の端末に描いてから、以後の出力をそのまま流す。
- FR2: 直結中、手元の端末で打ったバイト列は（切り離しキーの処理を除き）そのまま pane へ送る。手元の端末は raw モードにする。
- FR3: 手元の端末の大きさが変わったら、PTY の大きさを追従させる。
- FR4: `Ctrl+B` に続けて `q` で切り離す。`Ctrl+B` に続けて `Ctrl+B` なら `Ctrl+B` を 1 つ送る。`Ctrl+B` に続けてそれ以外なら両方を送る。
  接頭辞と次のキーが別の読み取りに分かれて届いても同じに扱う。
- FR5: 切り離し・奪われた・pane の終了・接続断のいずれで終わっても、手元の端末の raw モードを戻し、pane が変えたかもしれない端末のモード
  （マウスの報告・bracketed paste・カーソルの表示・alt screen 等）を戻してから終わる。
- FR6: 同じ pane に別のクライアントが直結していれば、`--takeover` が無い限り直結を拒む（終了コード 1・エラーの code `pane_attached`・`--takeover` を促す文言）。
  `--takeover` があれば所有者を置き換え、置き換えられた側の `wtmctl pane attach` はエラーの code `attach_taken_over` で終わる（終了コード 1）。
  code の名前は herdr の理由文（`already has an attached client; retry with --takeover`・`terminal attach taken over`）に対応させる。
- FR7: 直結中はブラウザのサイズ権限がその pane の大きさを変えない。直結が所有者無しで終わったら（切り離し・接続断。奪取では新しい所有者の大きさになる）、その tab のサイズ権限を持つ
  クライアントの大きさへ戻す（権限者がいなければ直結時の大きさのまま——既存の「権限者無しなら大きさはそのまま」と同じ）。
- FR8: 直結中もブラウザの表示（出力の購読）と入力は今までどおり動く。
- FR9: 標準入力か標準出力が端末でなければ、サーバへ繋ぐ前にエラーの code `not_a_tty` で終わる（終了コード 1。引数の誤りではなく実行環境の問題なので、
  使用誤りの 2 ではなく 1 に分類する）。
- FR10: 終わり方と終了コード——切り離しは 0。pane の終了（`pane.exited`/`pane.closed`）は code `pane_closed`、サーバ側からの接続断は code
  `connection_closed`（既存の `pane read --follow` と同じ code）で、どちらも 1（herdr も切り離し以外の終わり方は 1）。

## 非機能要件 / 制約

- 新しい RPC は既存の `/ws`（Cookie のセッション認証・Origin/Host 検査）の上にだけ載せる。新しい HTTP の入口・待ち受けは作らない。
- 終了コードは `wtmctl` の既存の規約（0=成功・1=サーバ/プロトコル/認証のエラー・2=CLI の使用誤り。`packages/cli/src/output.ts`）に従う。
  切り離しは 0。
- ブラウザ（`packages/web`）は変えない（並行している onboarding の作業との衝突を避ける）。
- テストは実時間に依存しない（大きさの追従・切り離しは偽の端末で）。E2E は走らせない。

## 完了条件 (受け入れ基準)

- [ ] AC1: 実サーバに対して `pane attach` を走らせると、手元（偽の端末）に見えている画面が描かれ、その後の pane の出力が手元に流れる（結合テスト）。
- [ ] AC2: 直結中に手元で打ったバイト列が pane のプロセスに届く（結合テスト: `echo` の往復）。
- [ ] AC3: 直結すると PTY（とサーバのモデルの pane）の大きさが手元の端末の大きさになり、手元の大きさが変わると追従する。
- [ ] AC4: 直結中、ブラウザ（サイズ権限を持つデスクトップのクライアント）が `client.view`・入力・フォーカスをしても、直結中の pane の大きさは変わらない。
  同じ tab のほかの pane は今までどおり変わる。
- [ ] AC5: 標準入力か標準出力が端末でなければ、サーバへ繋がずに終了コード 1 と理由のエラーで終わる。
- [ ] AC6: `Ctrl+B q` で切り離すと終了コード 0 で終わり、pane のプロセスは生きたまま残る。`Ctrl+B Ctrl+B` は `Ctrl+B`（0x02）を 1 つ、
  `Ctrl+B x` は 0x02 と `x` を送る。接頭辞と次のキーが別の読み取りに分かれても同じ。
- [ ] AC7: どの終わり方（切り離し・奪われた・pane の終了・接続断）でも、raw モードを戻し、端末のモードを戻す列を手元に書いてから終わる。
  接続断は終了コード 1 の `connection_closed` で終わる。
- [ ] AC8: 既に別のクライアントが直結している pane へ `--takeover` 無しで直結すると、終了コード 1 で `pane_attached`（`--takeover` を促す文言）で終わり、
  既存の直結は続く。
- [ ] AC9: `--takeover` で直結すると所有者が入れ替わり、前の直結は終了コード 1 の `attach_taken_over` で終わる。大きさは新しい所有者のものになる。
- [ ] AC10: 直結が終わると（切り離し・接続断）、その pane の大きさはその tab のサイズ権限を持つクライアントの表示の大きさへ戻る。権限者がいなければ変えない。
- [ ] AC11: 直結中もブラウザ側の購読者へ出力が届き、ブラウザからの INPUT は pane に届く。
- [ ] AC12: 直結の RPC は既存の `/ws` の認証と Origin 検査を通った接続でしか使えない（認証無し・不正な Origin の接続は upgrade の段階で拒まれる既存の
  挙動のまま。新しい入口が増えていないこと）。
- [ ] AC13: pane が終わる（`pane.exited`/`pane.closed`）と直結は終了コード 1 の `pane_closed` で終わる。
- [ ] AC14: `docs/wtmctl.md` に使い方・切り離しキー・排他・終了コード・herdr との違いが、`docs/herdr-parity.md` の H40 に対応の範囲と残りが書かれている。

## 未確定事項 / 確認したいこと

- 直結の所有者と大きさの鍵をどの部品に持たせるか（`SizeAuthority` に足すか別の部品か）——design で決める。
- 手元の端末への最初の描画の仕方（画面を消してから SNAPSHOT を書く／alt screen に入るか）と、終わるときに戻すモードの一覧——design で決める。
- 所有者の変化を奪われた側へどう知らせるか（全体へのイベントか、当人への切断か）——design で決める。イベントにするなら、ブラウザが知らないイベントを
  無視することを design で確かめる（ブラウザは変えない前提）。
