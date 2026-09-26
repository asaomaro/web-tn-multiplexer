# 要件: エージェントの名前（`wtmctl agent rename` と名前による対象指定）

## 背景 / 課題

`wtmctl agent list/get/wait/read/prompt/send-keys`（20260926-agent-automation-api・20260926-agent-prompt-send-keys）は、
エージェントを **pane ID でしか**指せない。スクリプトやオーケストレーター役のエージェントは、`agent list` の結果から
「どの pane がレビュー役のエージェントか」を毎回探し直す必要があり、pane ID を覚えておいても、pane を閉じて開き直したり
別のエージェントに入れ替わったりすると、同じ ID が別の相手を指すことに気づけない。

herdr は、エージェントに **名前**（`[a-z][a-z0-9_-]{0,31}`・live なエージェント間で一意）を付けられ、エージェントを
指す全コマンドが「名前 または そのエージェントが居る pane ID」を受ける（herdr
`docs/next/website/src/content/docs/cli-reference.mdx:337-356`・`src/app/agents.rs:14-20, 91-142`・
`src/app/terminal_targets.rs:75-104`）。名前は pane の今の住人（エージェント）に付き、住人が終了・入れ替わると消える。
`docs/herdr-parity.md` の H39 の残りのうち、`agent start` の土台にもなる部分がこれ（範囲の選定は decisions.md D1）。

## 目的 / ゴール

- 利用者（人・スクリプト・エージェント）が、自分で付けた名前でエージェントを指して `wtmctl agent` の各操作を行え、
  pane ID を調べ直さずに済む状態。
- 名前が「いまその名前を付けたエージェント」だけを指し、エージェントが終了・入れ替わった後に同じ名前が別の相手へ
  届いてしまうことが無い状態。
- ブラウザの画面でも、どのエージェントにどの名前が付いているかが見える状態。

（`.aidev/charter.md` はこの PJ に無い。）

## ユーザーストーリー

- US1: 複数のエージェントを並べて使う開発者として、手で起動したエージェントに `reviewer` のような名前を付け、外したい。
  なぜなら、後の操作で pane ID を毎回探さずに済むから。（受け入れ: AC1, AC2, AC3, AC4, AC5, AC6）
- US2: エージェントを自動で操作するスクリプト（または別のエージェント）として、`wtmctl agent get/wait/read/prompt/send-keys`
  に名前を渡したい。なぜなら、pane の配置が変わっても同じ相手を指し続けられるから。（受け入れ: AC7, AC8, AC9）
- US3: スクリプトとして、名前を付けたエージェントが終了・入れ替わったら、その名前で操作しても別の相手に届かず
  失敗してほしい。なぜなら、無関係なシェルや別のエージェントに prompt を送る事故を防げるから。（受け入れ: AC10, AC11）
- US4: ブラウザで作業する利用者として、サイドバーのエージェント一覧や pane の呼び名で、付けた名前を見たい。
  なぜなら、CLI で付けた名前と画面上のエージェントを対応付けられるから。（受け入れ: AC12, AC13）
- US5: 既存の `wtmctl agent` を使うスクリプトの作者として、名前の導入後も pane ID での指定と出力の読み方がそのまま使えてほしい。
  なぜなら、既存のスクリプトを書き直さずに済むから。（受け入れ: AC15）
- US6: この製品の利用者として、名前の規則と herdr との違いを文書で知りたい。なぜなら、herdr 用に書いた手順を
  持ち込むときに違いでつまずかないから。（受け入れ: AC14）

## スコープ

### 対象

- `wtmctl agent rename <target> <name>`・`wtmctl agent rename <target> --clear`（herdr `agent rename`）。
- エージェントを指す既存の全サブコマンド（`agent get`・`wait`・`read`・`prompt`・`send-keys`）の `<paneId>` を
  `<target>`（pane ID または名前）に広げる。
- `agent list`・`agent get` 等の出力（エージェントの見え方）に名前を含める。
- 名前の規則（書式・一意性）と、名前が消える条件（エージェントの終了・入れ替わり・pane が閉じる）。
- ブラウザでの名前の表示（サイドバーのエージェント一覧・pane の呼び名）。
- `docs/wtmctl.md`・`docs/herdr-parity.md`（H39）の更新。

### 対象外

- `agent start`（空いているシェル pane でエージェントを起動し名前を付ける）。backlog の兄弟として残す（decisions.md D1）。
- 名前のサーバ再起動をまたいだ保存（herdr は session に保存して復元する。本製品は再起動でエージェントを別の検出として
  数え直すため、名前は引き継がない）。
- ブラウザから名前を付ける・変える操作（表示だけ）。
- 検出の一時的な揺れで名前が消えないようにすること（herdr は「Temporary detection uncertainty does not clear it」。
  本製品は検出が一度外れるとエージェントを別の検出として数え直す既存の挙動で、`agent wait` 等も同じ影響を受ける。
  名前だけ特別扱いしない）。
- `agent attach <name>`・`agent focus`・`agent explain`（herdr にあるが本製品に無いコマンド）。

## 機能要件

- FR1: `wtmctl agent rename <target> <name>` は、対象のエージェントに名前を付ける（既に名前があれば置き換える）。
  成功したら、名前を付けた後のエージェントの見え方を JSON で標準出力へ出す。
- FR2: `wtmctl agent rename <target> --clear` は、対象のエージェントの名前を外す。
- FR3: 名前は `[a-z][a-z0-9_-]{0,31}`（英小文字で始まり、英小文字・数字・`-`・`_` の 1〜32 文字）。外れる名前は
  herdr と同じ code `invalid_agent_name` で失敗し、何も変えない。
- FR4: 名前は live なエージェント（いま検出されているエージェント）の間で一意。他のエージェントが使っている名前を
  付けようとすると herdr と同じ code `agent_name_taken` で失敗し、何も変えない。同じエージェントに同じ名前を
  付け直すのは成功する。
- FR5: `<target>` は、(1) その文字列の pane ID の pane にエージェントが居ればその pane、(2) そうでなければ
  その名前を持つ live なエージェント、の順で解決する（herdr `src/app/terminal_targets.rs:75-104` と同じ順）。
  どちらにも当たらなければ `agent_not_found`。
- FR6: `agent get`・`agent wait`・`agent read`・`agent prompt`・`agent send-keys` は FR5 の `<target>` を受ける。
- FR7: エージェントの見え方（`agent list`・`agent get`・`agent wait`・`agent prompt` の出力）に `name`
  （名前が無ければ `null`）を含める。
- FR8: 名前は付けた時点のエージェント（検出の 1 回分）に付く。そのエージェントが終了したとき・pane の前面が別の
  エージェントに入れ替わったとき・pane が閉じたときに消え、同じ pane に次に現れたエージェントには引き継がれない。
- FR9: 名前を付けた・外したことは、他のクライアント（ブラウザ・`wtmctl watch`）へエージェントの状態変化と同じ経路で
  届く。
- FR10: ブラウザのサイドバーのエージェント一覧に、名前があれば名前を出す。pane の呼び名（pane の見出し・移動の
  候補・通知。3 つとも同じ 1 つの規則から決まる）は、利用者が付けた pane のラベル → エージェントの名前 →
  エージェントの種類の表示名 → 端末のタイトル の順で最初に空でないものを使う（名前の無いときは今と同じ順）。
- FR11: 失敗の終了コードは既存の `wtmctl` の規則に従う（サーバ・プロトコルのエラーは 1 で stderr へ JSON、CLI の
  使用誤りは 2）。`agent rename` の引数は「`<target>` と、`<name>` か `--clear` のどちらか 1 つ」だけで、それ以外は使用誤り。
- FR12: 名前で指したときも、CLI が解決した時点のエージェント（検出の 1 回分を表す id。`AgentInfo.instanceId`）と
  書き込む直前のエージェントが違えば書き込まない（既存の pane ID 指定と同じ照合）。
- FR13: `docs/wtmctl.md` に `agent rename` と名前による指定（規則・消える条件・herdr との違い）を書き、
  `docs/herdr-parity.md` の H39 を更新する。

## 非機能要件 / 制約

- 名前の変更は既存の外部 API（WebSocket・トークン認証・Origin 検査）の上だけで行い、新しい入口を作らない。
- 名前を付けるのは検出済みのエージェントだけ（エージェントの居ない pane・シェルには付けられない）。
- 既存の `AgentInfo` を持つ表示・保存・プロトコルの互換を壊さない（名前を持たないエージェントの見え方は今と同じ）。
- 既存の pane ID による指定は今と同じに動く（名前の導入で既存のスクリプトが壊れない）。
- テストは実時間に依存しない（タイミングはフェイクタイマー等）。E2E（packages/e2e）は走らせない。

## 完了条件 (受け入れ基準)

- [ ] AC1: エージェントの居る pane に `agent rename <paneId> reviewer` を打つと成功し、出力と以後の `agent get` の `name` が `reviewer` になる。
- [ ] AC2: 名前の付いたエージェントに `agent rename <target> --clear` を打つと成功し、`name` が `null` になる。
- [ ] AC3: 書式に外れる名前（空・大文字・数字始まり・空白・`.` を含む・33 文字）は `invalid_agent_name`（終了コード 1）で失敗し、名前は変わらない。32 文字・`a`・`reviewer_2`・`reviewer-one` は受け付ける。
- [ ] AC4: 別のエージェントが使っている名前を付けようとすると `agent_name_taken`（終了コード 1）で失敗し、どちらの名前も変わらない。同じエージェントへの同じ名前の付け直しは成功する。
- [ ] AC5: エージェントの居ない pane・存在しない pane・どのエージェントも持たない名前を `<target>` に渡すと `agent_not_found`（終了コード 1）で、何も変わらない。
- [ ] AC6: `agent rename` の引数が FR11 に合わない（`<target>` だけ・`<name>` と `--clear` の両方・余分な位置引数）ときは CLI 使用誤り（終了コード 2）。
- [ ] AC7: `agent get`・`wait`・`read`・`prompt`・`send-keys` に名前を渡すと、その名前のエージェントの pane に対して pane ID を渡したときと同じ結果になる。
- [ ] AC8: `<target>` の文字列が pane ID としてエージェントの居る pane を指すときは、同じ文字列の名前を持つ別のエージェントより pane ID を優先する。pane ID の pane にエージェントが居なければ名前として解決する。
- [ ] AC9: `agent list`・`agent get`・`agent wait`・`agent prompt`・`agent rename` の出力の各エージェントに `name` がある（名前が無ければ `null`）。
- [ ] AC10: 名前を付けたエージェントが終了した後、同じ pane の前面が別のエージェントに入れ替わった後、または pane が閉じた後は、その名前での指定が `agent_not_found` になり、入れ替わった新しいエージェントの `name` は `null`。
- [ ] AC11: 名前で指して `prompt`・`send-keys`・`rename` を送る途中でそのエージェントが入れ替わった場合（FR12）、新しい住人には何も書かない・名前を付けない（`agent_not_found`）。
- [ ] AC12: 名前を付ける・外すと、接続中の他のクライアントへ `pane.agent_status_changed` で新しい名前（外したときは名前の無いエージェント）が届く。
- [ ] AC13: ブラウザのサイドバーのエージェント一覧に名前が表示され、pane の呼び名（FR10 の規則。見出し・移動の候補・通知が共有する 1 つの関数）は pane のラベル → エージェントの名前 → エージェントの種類の表示名 → タイトルの順で決まる。名前の無いエージェントの表示は今と同じ。
- [ ] AC14: `docs/wtmctl.md` に `agent rename` と名前による指定（規則・消える条件・herdr との違い）が書かれ、`docs/herdr-parity.md` の H39 が更新されている（FR13）。
- [ ] AC15: 名前を付けていないエージェントに対する既存の操作（pane ID での `agent list/get/wait/read/prompt/send-keys`）の結果は、出力に `name: null` が加わる以外は今と同じ。名前を持たない `AgentInfo`（名前の項目を持たない既存のもの）を受け取る web・cli も今と同じに動く。

## 未確定事項 / 確認したいこと

- `AgentInfo` に名前を足す形（必須の `name: string | null` か省略可か）と、既存の表示・保存・プロトコルの互換の確かめ方
  → design で決める。
- 名前を置く場所（検出を持つ `AgentTracker` か、別の表か）と、名前を変える RPC の形 → design で決める。
- 名前の解決（FR5）を CLI 側（hello の snapshot）で行うか、サーバ側で行うか → design で決める。
