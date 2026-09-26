# 判断の記録（20260926-agent-prompt-send-keys）

## D1: 実行三層（full）と範囲——`agent prompt`（`--wait` を含む）と `agent send-keys` を 1 つの PR で着地させ、送信はサーバ側の新しい RPC で行う

- **背景**: backlog 項目（`.aidev/backlog/product-roadmap.md` 386 行目。`docs/herdr-parity.md` の H39 の残り）は
  「prompt を bracketed paste の live な状態に合わせて送り、遅延 Enter で確定し、`blocked` なら送らず、送信後 5 秒以内に
  working/blocked を観測できなければ `agent_prompt_stalled`」と `agent send-keys`。herdr の一次資料
  （`/workspaces/web-tn-multiplexer/scratchpad/herdr` コミット `da6bcd59`）を直読して確かめた仕様:
  - 送信の組み立て（`src/app/api/agents.rs:114-222`）: 空文字は `empty_agent_prompt`／対象が無ければ `agent_not_found`／
    **`blocked` なら入力を一切書かずに `agent_blocked`**（:148-156）／テキストは**その瞬間の** bracketed paste モードが
    有効なら `ESC[200~`＋本文＋`ESC[201~` で包む（`src/app/api_helpers.rs:25-32` `encode_api_text`）／Enter は
    端末のキー符号化で作る（:48-58）／「テキスト → 300ms 待つ → Enter」を**1 つの順序付きの送信**として PTY に積む
    （`AGENT_PROMPT_SUBMIT_DELAY = 300ms`。agents.rs:13, 207-214）。PTY 側は送信中は他の利用者入力を後ろへ回し
    （`src/pty/actor/unix.rs:580-592, 614-626` の `active_submission` 中は data command を読まない）、テキストを
    書き終えてから 300ms 後に Enter を書き（:859-897）、書き終えたら応答する。
  - Enter を遅らせる理由: エージェントの入力欄は貼り付けの直後に届いた Enter を「貼り付けの続き（改行）」として
    扱うことがある（agents.rs:15-20 のコメント。Codex は貼り付けを「paste burst」として溜め、溜めている間の Enter を
    改行に書き換える）。貼り付けの終わりを相手が処理してから Enter を届けるための時間。
  - `--wait`（`src/api/wait.rs:177-329`）: 送信前の状態が `working` なら活動の確認を省く。それ以外は送信後
    **5000ms**（`AGENT_PROMPT_EFFECT_TIMEOUT_MS`。wait.rs:20）以内に `working` か `blocked` を観測できなければ
    `agent_prompt_stalled`（文言 "agent prompt produced no observed working or blocked state within 5000 ms; current status is <s>"。
    wait.rs:659-667）。**利用者の `--timeout` の残りが 5000ms 以下なら、そちらで `timeout` を返す**（:254-265）。
    観測は「送信を始めた後のイベント」で行い、一瞬だけの `working` も数える（`accept_transient_status: true`。:270-277）。
    活動を観測した後は `--until`（既定 idle/done/blocked）に一致するまで待つ（:291-315）。`--timeout` は送信の時間を含む。
    `--until`/`--timeout` は `--wait` 無しでは使い方の誤り（`src/cli/spec.rs:343-360` の `requires("wait")`）。
  - `agent send-keys`（agents.rs:331-381、キー名は `src/config/keybinds.rs:1231-1290`・1181-1190）: キー名を
    **全部検証してから**書く（1 つでも不明なら `invalid_key` で何も書かない）。`esc`/`escape`・`enter`・`tab`・
    `up` 等と `ctrl+c`（`C-c` 別名）のような修飾つきを受ける。
  - 終了コード: 時間切れ・サーバのエラーは stderr に JSON で 1、使い方の誤りは 2
    （`docs/next/website/src/content/docs/cli-reference.mdx:403`）。
- **決定**: 本 work で `wtmctl agent prompt <paneId> <text> [--wait] [--until S]... [--timeout MS]` と
  `wtmctl agent send-keys <paneId> <key>...` の両方を着地させる。送信（bracketed paste の判定・遅延 Enter・
  `blocked` の拒否・キーの符号化）は**サーバ側の新しい RPC**（`agent.prompt` / `agent.send_keys`）で行い、
  `--wait` の待ち合わせ（活動の確認と `agent_prompt_stalled`・その後の状態待ち）は既存の `agent wait` と同じく
  CLI 側でイベントを見て行う。対象指定は前 work と同じく pane ID だけ。
- **理由**:
  - 「live な bracketed paste の状態」を知っているのはサーバのミラー（`@xterm/headless`。
    `packages/server/src/terminal/Mirror.ts`）だけで、CLI は画面のスナップショットしか持たない。CLI 側で包むと、
    モードの切り替わり（エージェントの起動直後・終了直後）とずれた包み方をしうる。キーの符号化（矢印キーの
    アプリケーションカーソルモード）も同じ。前 work（20260926-agent-automation-api）の D1 は「サーバを変えない」を
    範囲の条件にしたが、それは待ち合わせの話で、送信は性質上サーバ側に置くしかない。
  - 「テキスト → 遅延 → Enter」の間に他の入力（ブラウザでの打鍵・別の `pane input`）が割り込むと、prompt の末尾に
    別の文字が混ざったまま確定されうる。これを防げるのは PTY に書く側（サーバの `TerminalHost`）だけ。
  - prompt と send-keys は同じ「エージェントへの入力」の対で、herdr の文書も並べて使い分けを説明している
    （`agent-automation.mdx` の「Choose the control surface」節。blocked の確認ダイアログには send-keys で答える）。
    片方だけでは `agent_blocked` を受けた後の手段が無い。規模も CLI 2 コマンド＋RPC 2 つで 1 PR に収まる。
- **範囲外（backlog にも残さない）**: herdr の Windows 固有の処理（Codex への paste boundary・Copilot への focus 通知。
  本製品のサーバは Linux/macOS/Windows で動くが、この 2 つはエージェント個別の回避策で、該当するエージェントで
  事象を確かめられない）／kitty keyboard protocol に合わせたキーの符号化（xterm の既定の符号化だけにする）／
  `agent_not_ready`（herdr の「名前付きで起動中」の判定。本製品には `agent start` が無い）。
- **実行三層**: 振る舞いを足す（CLI 2 コマンド・RPC 2 つ・入力の順序制御）ので対象外ではなく、プロトコル・サーバ・
  CLI にまたがり状態機械（活動の確認→状態待ち）の設計があるので light ではなく **full**。mode は起動指示どおり autonomous。
- **代替案**: (a) CLI だけで `pane input` を 2 回（テキスト・Enter）送る——live な mode を知れず、割り込みも防げない
  ので退けた。(b) prompt だけにして send-keys を兄弟に残す——blocked への応答手段が無い半端な形になるので退けた。
- **影響**: `packages/protocol`（RPC 2 つ・エラー code）・`packages/server`（RPC・送信の順序制御・キー符号化）・
  `packages/cli`（2 コマンド）・`packages/web`（エラー code の日本語の表。`Record<ErrorCode, string>` が網羅を要求する）。
  並行の別 work（名前付き session。server の状態保存と起動オプション）とは触るファイルが重ならない見込み
  （`SessionService`・`persist` は変えない）。

## D2: requirements の独立点検（ラウンド 1・指摘 5 件）への対応

- **背景**: doccheck ラウンド 1（委譲）で 5 件（should 4・nit 1）。FR7 の使い方の誤りの一部・FR8 の「blocked でも送れる」・
  web のエラー文言の表・`--timeout` が送信時間を含むこと・stderr の JSON を検証する AC が無い／AC7 の「その時点」が曖昧。
- **決定**: 5 件とも最小の差分で直した（AC9 に終了コード 2 の残りと `--timeout` の数え方、AC10 に blocked、AC12 に stderr の JSON と
  web の表、対象の節に web の表を移し、FR4・AC7 は「5000ms と `--timeout` の締め切りの早いほう」に書き直した）。
  再点検はしない（上限 2 のうち 1 を使用。残りは design の点検で併せて見る）。
- **影響**: requirements.md のみ。

## D3: research（任意工程）を挟む

- **背景**: `protocol.md`「4.5」の 5 条件で判定する。
- **決定**: 挟む。**影響が横断的**（protocol・server・cli・web）で、**未検証の既存挙動に依存する**
  （サーバのミラーが bracketed paste のモードを「送る瞬間」に正しく持っているか——`@xterm/headless` の書き込みは非同期に
  処理される／`TerminalHost` への書き込みの経路の全体／偽のエージェントが実 PTY で既存の検出規則に当たるか）ため。
- **影響**: research.md を書いてから design に進む。

## D4: design の独立点検（ラウンド 1・指摘 14 件）への対応と、architecture を挟まない判断

- **背景**: doccheck ラウンド 1（委譲）で 14 件（should 9・nit 5）。コード例と注記の食い違い（`Buffer`/`TextEncoder`）・
  CLI の中だけの code とサーバの `ErrorCode` の区別・出所の無い既存事実（`statusOf`・既定の `--until`・`MethodContext`・`invoke`・
  `withSession`・`reportAndExit`・3 秒の猶予）・終了後の `TerminalHost` の状態・偽物の範囲・キー表の細則・stalled の status の出所・
  RPC の応答待ちの上限。
- **決定**: 14 件とも最小の差分で直した。出所は主エージェントが直読して付けた（`ControlSurface.ts:10-16, 31-48`、
  `withSession.ts:15`、`output.ts:55`、`agentStatus.ts` の `statusOf`・`DEFAULT_UNTIL`）。再点検はしない（上限 2 のうち 1 を使用。
  残りは tasks の点検と review に委ねる）。
- **architecture を挟まない**: `protocol.md`「4.5」の 4 条件——モジュール境界は動かさない（`InputModes` は terminal 側に置き、
  agent → terminal の既存の向き〔`AgentMonitor` が `TerminalManager` を使う〕だけを使う）／新しい構造の選択は `TerminalHost` の
  入力の後回し 1 つで design に書き切れている／状態機械（活動の確認→状態待ち）は design の図と `PromptWait` で具体化済み／
  tasks に直接分解できる——のどれにも当たらない。
- **影響**: design.md のみ。

## D5: T10（AC15 の確認）は coding ではなく test 工程で消化する

- **背景**: AC15（build/typecheck/test ×2/smoke）は全タスクの実装が済んでから一度に確かめるもので、coding のタスクとしては差分を生まない。
- **決定**: tasks.md の T10 は coding の承認時に未チェックのまま残し、test 工程で確かめて test-result.md に記録する。
- **影響**: coding の承認時の `tasks_done` は 9。

## D6: tasks の独立点検（ラウンド 1・指摘 5 件）への対応

- **背景**: doccheck ラウンド 1（委譲）で 5 件（should 4・nit 1）。負の確認の出力の移し先・T4 を先に固める記述と依存の食い違い・
  `SessionService.test.ts` を触ることのリスク・T7 と T1 の粒度・`InputModes` をどちらのタスクが足すか。
- **決定**: 5 件とも最小の差分で直した。T7 から `PromptWait` を T11 に、T1 から web の表を T12 に分けた（ID は振り直さず末尾に足した）。
  再点検はしない（上限 2 のうち 1 を使用）。
- **影響**: tasks.md のみ。タスク数は 12（coding で消化するのは T10 を除く 11）。D5 の `tasks_done` は 11 に読み替える。

## D7: `agent.prompt` は書く直前（`build` の中）にもエージェントを確かめ直す（design からの追加）

- **背景**: T5 の独立点検（should）で、`blocked` の検査を `writeModal` の前に 1 回だけ行う design の手順では、別の入力の後ろで
  待っている間（flush・300ms の間）に承認ダイアログが出た場合、ダイアログに本文と Enter を書いてしまうと指摘された
  （例: 2 つのクライアントがほぼ同時に prompt を送り、1 本目の後にダイアログが出る）。同じ窓で、エージェントが終了して
  シェルに戻った場合は、本文と Enter がシェルのコマンドとして実行されうる（より危ない）。
- **決定**: `build`（flush 後・実際に書く直前に呼ばれる）の中で `session.getPane(paneId).agent` を見直し、`blocked` なら
  `agent_blocked`、居ない・`instanceId` が変わったなら `agent_not_found` を投げて何も書かない。`TerminalHost` は `build` の
  例外で reject して次の入力へ進む（T4 で確かめた経路）。ハンドラは `RpcError` をそのまま返す。
- **理由・代替案**: design に「並んだ後の再検査はしない」と明記する案は、design「ドメイン固有の考慮」の「blocked では書かない」
  を保証できないので退けた。herdr は受け付けの時点で検査し、PTY の actor が送信を直列にする（`src/app/api/agents.rs:148-156`・
  `src/pty/actor/unix.rs:580-592`）ので同じ窓を持つが、本製品では防げる位置に `build` があるので防ぐ。状態の判定そのものが
  500ms 周期（research F9）なので、書く直前の検査でも判定の遅れの分の窓は残る（herdr と同じ）。
- **影響**: `packages/server/src/surface/methods/agent.ts`・`agent.test.ts`。design.md の本文は書き換えない（本エントリが差分の記録）。
- **補足（D7 の範囲）**: 同じ理由（終了したエージェントの後のシェルへ `y`・`enter` 等が流れる）で、`agent.send_keys` も書く直前に
  同じエージェント（`instanceId`）が居ることを確かめ直す（`blocked` は断らない——ダイアログに答える手段なので）。

## D8: 偽のエージェントの結合テストは新しいファイル `agentPrompt.integration.test.ts` に置く（design の置き場からの変更）

- **背景**: design は AC13 を既存の `agent.integration.test.ts` に足すとしていた。既存のファイルは `./wsClient.js` を `vi.mock` し、
  エージェントの状態を `updatePaneRuntime` で注入する（実際の検出を使わない）前提で組まれている。
- **決定**: 実際の検出（`AgentMonitor`）と実 PTY の偽のエージェントを使うテストは、専用のサーバを立てる別ファイルにした。
  空きポートと標準出力の捕まえ方の小さな補助関数は既存のファイルから複製した（テストファイル同士で共有の置き場が無い。既存の
  `main.integration.test.ts` なども各自で持っている）。
- **理由・代替案**: 同じファイルに足すと、注入した状態と実際の検出が同じサーバで混ざり、モックの有無もテストごとに変わる。
- **影響**: `packages/cli/src/agentPrompt.integration.test.ts`（新規）。design.md の本文は書き換えない。

## D9: 結合テストでは「活動の確認」そのものの変異は捕まえられない（単体テストで担保する）

- **背景**: T8 の独立点検（must）で、`PromptWait` を「最初から活動を観測済み」にする変異でも結合テストが通ると指摘された。
- **決定**: 返った時刻が「Enter から偽のエージェントが working でいる時間（4 秒）− 1 秒」以上であることを確かめる assert を足した
  （応答のエージェント〔idle〕で即座に返る変異 T8-M6 はこれで落ちる）。ただし、指摘の変異（T8-M5）はこの結合テストでは
  依然として通る——偽のエージェントの事象列は「送信 → working → idle」だけで、working より前に idle のイベントが来ないため、
  活動の確認が無くても振る舞いが変わらない（この事象列の上では等価な変異）。活動の確認の規則は単体テスト（T11-M1・T7-M1・T7-M5）で捕まえている。
  working の時間は、検出の取りこぼしを避けるため 1.5 秒から 4 秒に延ばした（同じ点検の should）。
- **影響**: `agentPrompt.integration.test.ts` のみ。

## D10: `agent.prompt` の結果は本文を書く直前のエージェント（design の「送信を始める時点」を具体化）

- **背景**: cross 点検で、受け付けた時点のエージェントを返すと、待ち行列の間に working から idle に戻った場合に CLI が
  「送信前から working」と判断して活動の確認を省き、prompt の処理前に一致して返ると指摘された。
- **決定**: `build`（書く直前）で確かめ直したエージェントを返す。protocol のコメント「送信を始める時点のエージェント」と一致する。
- **影響**: `packages/server/src/surface/methods/agent.ts`・`agent.test.ts`。CLI の境目（要求を送った後のイベントを数える）は
  変えない——受け付けから書くまでの間に working を経て idle に戻る場合は活動として数えうる窓が残る（herdr も要求の前の
  イベント番号を境目にするので同じ窓を持つ）。

## D11: 本文の中の貼り付けの印（`ESC[200~`・`ESC[201~`）を取り除いてから包む（herdr との違い）

- **背景**: review ラウンド 1（should）。herdr は本文をそのまま包む（`src/app/api_helpers.rs:25-32`）ため、本文に `ESC[201~` が含まれると
  印の後ろが貼り付けではなく打鍵として届き、後ろに CR があれば途中で確定される。
- **決定**: bracketed paste が有効で包むときだけ、本文の中の 2 つの印を取り除く（`agentInput.ts` の `pastePayload`）。拒否（`invalid_params`）
  にしない理由は、ログや issue の本文を転送する用途で印を含むのは送り手の意図ではなく、取り除けば目的（1 つの入力として確定）を満たせるため。
  包まない（モード無効）ときはそのまま送る（その端末はそもそも印を解釈しない）。
- **影響**: `agentInput.ts`・テスト・`docs/wtmctl.md`（herdr との違い）。

## D12: RPC に省略可能な `instanceId` を足し、CLI は hello で見たエージェントを渡す

- **背景**: review ラウンド 1（should）。サーバは受け付けた時点のエージェントを基準にするだけで、CLI が hello で見たエージェントから
  受け付けまでに入れ替わると、新しいエージェントへ送ってしまう（send-keys では別のエージェントの承認ダイアログに `y`/`enter` が答えうる）。
- **決定**: `AgentPromptParams`・`AgentSendKeysParams` に `instanceId?`（空文字は不可）を足し、サーバは受け付けの時点で違えば何も書かずに
  `agent_not_found`。書く直前の再確認（D7）は受け付けた時点のエージェントと比べるので、渡された `instanceId` とも一致する。CLI の
  `agent prompt`（`--wait` の有無とも）・`send-keys` は hello の snapshot の `instanceId` を渡す。
- **理由・代替案**: 省略可能にしたのは、既存の呼び出し（ブラウザ等の将来の利用）に `instanceId` を強制しないため。docs の
  「入れ替わった先に送られている」という既知の限界は、この窓については消えた。
- **影響**: protocol・server・cli・docs とテスト。design.md の本文は書き換えない（本エントリが差分の記録）。

## D13: 「実際のエージェントでの送信確認」は backlog に兄弟の `[ ]` として残す

- **背景**: review ラウンド 1（should）。backlog の本項目は「実際のエージェントでの送信確認が要る」を条件に含むが、本 work は
  偽のエージェントでしか確かめていない（test-result.md「未検証の穴」）。
- **決定**: deliver で本項目を `[x]`（偽のエージェントで確かめた範囲）と `[ ]`（本物の Claude Code・Codex で prompt の確定・
  `--wait`・send-keys を確かめる。利用者の手元での確認を含む）の兄弟に割る。test-result の AC14 の判定は「docs は pass、backlog は deliver で確認」と書き直す。
- **影響**: `.aidev/backlog/product-roadmap.md`（deliver）・test-result.md。

## D14: review ラウンド 1 の修正はタスク点検を行わず、review ラウンド 2 の独立レビューに委ねる

- **背景**: 修正は 3 タスク（T2・T5・T7）と protocol・docs にまたがる小さな差分で、各タスクの点検ラウンドは 1/2 を使用済み。
- **決定**: 変異による負の確認（R1-M1〜M7）を行ったうえで、点検は review ラウンド 2 の独立レビューにまとめる（前 work D11 と同じ扱い）。

## D15: 貼り付けの印は変わらなくなるまで繰り返して取り除く（review ラウンド 2・D11 の修正由来）

- **背景**: D11 の 1 回だけの `replace` では、入れ子にした印（`ESC[20ESC[201~1~`）が取り除いた後に組み上がって残る。
- **決定**: 変わらなくなるまで繰り返す。同じ不変条件（本文の中に印が残らない）を支える項——対象の印（200 と 201）・繰り返し・
  取り除き自体——を 1 つずつ壊して確かめた（R2-M1〜M4。すべて落ちる）。8 ビットの CSI（U+009B）は UTF-8 の本文では 2 バイト
  （C2 9B）になり、UTF-8 を解釈する端末アプリは印として読まないので対象にしない。
- **影響**: `agentInput.ts`・テスト。
