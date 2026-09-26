# 判断の記録（20260926-agent-start）

## D1: 実行三層（full）と範囲の選定——Linux／WSL2 の POSIX 系シェル（sh・bash・dash・zsh・ksh・mksh）だけを着地させ、それ以外のシェルと Windows は兄弟の backlog 項目に割る

- **背景**: backlog 項目（`.aidev/backlog/product-roadmap.md` の「エージェント自動化: `agent start <name> --kind KIND --pane ID …`」。
  `docs/herdr-parity.md` の H39 の残り）は、外部 API から pane の PTY に**シェルのコマンド行を打ち込む**機能になる。
  herdr の一次資料（`/workspaces/web-tn-multiplexer/scratchpad/herdr`。以下 herdr）を主エージェントが直読した結果:
  - 空いているシェルの判定は Unix では「前面プロセスグループ＝シェルの pid で、メンバーがシェルだけ・シェル名が既知」
    （`src/platform/mod.rs:330-341`）、Windows では「シェルに子孫が無い」（`src/platform/windows.rs:1389-1405`）。
    Windows は前面プロセスグループが無く、herdr も「シェルが初期化中か」を判定できない（`src/cli/agent.rs:680-686`）。
  - 引数のクォートは Unix では pwsh だけ PowerShell 流、**それ以外の既知のシェル（fish・csh・tcsh・nu・elvish・xonsh を
    含む）は全部 POSIX の単一引用符**（`src/platform/mod.rs:361-376`・`src/platform/linux.rs:321-339`）。Windows は
    PowerShell のスクリプトを作り、cmd.exe には `-EncodedCommand` で渡す（`src/platform/windows.rs:938-990`）。
  - POSIX の単一引用符を fish に使うと、fish は単一引用符の中の `\'` と `\\` を解釈するので、`x\` で終わる引数が引用を
    閉じずに次の引数の中身を**引用の外に出す**（例: 引数 `x\` と `; rm -rf ~ ; ` が `'x\' '; rm -rf ~ ; '` になる）。
    csh/tcsh は単一引用符の中でも `!` の履歴展開が効く。nu・elvish・xonsh は引用の文法が違う。herdr の
    `quote_powershell_arg` は ASCII の `'` しか二重化しないが、PowerShell は `‘ ’ ‚ ‛`（U+2018〜U+201B）も単一引用符として
    扱う。——**herdr のクォートを POSIX 以外へそのまま移すと、シェルの構文として解釈される穴がある**。
  - この環境で実物を確かめられるシェルは bash と dash だけ（`which` で確認。zsh・fish・pwsh 等は入っていない）。
- **決定**:
  - 三層判定は **full**（protocol・server・cli・docs に波及し、安全面の判断を含む。light の「振る舞いを変えない小規模」に当たらない）。
  - 本 work は **Linux／WSL2 のサーバで、pane のシェルが POSIX の単一引用符の意味を持つもの**（`sh`・`bash`・`dash`・`zsh`・`ksh`・
    `mksh`）だけを対象にする。それ以外のシェル（fish・csh・tcsh・nu・elvish・xonsh・pwsh・powershell・cmd）では
    **何も書かずに** `unsupported_agent_shell` で断る。サーバが Windows で動いているときも何も書かずに断る。
  - 兄弟の backlog 項目として「fish・pwsh（Unix）・Windows の PowerShell／cmd.exe の `agent start`（シェルごとのクォートと
    空いているシェルの判定）」を deliver で `[ ]` で残す。
- **理由・代替案**:
  - 代替案 A「herdr と同じく全シェルを 1 PR で」: 上の穴があり、実物で確かめられないシェルのクォートを「安全」と主張できない
    （`protocol.md`「主張は証拠の範囲を超えない」）ので不採用。
  - 代替案 B「POSIX と fish（fish 専用のクォートを書く）」: fish の実物で確かめられないので不採用（兄弟項目に回す）。
  - zsh・ksh・mksh は実物で確かめられないが、単一引用符の中を一切解釈しない点は POSIX の規定どおりで、実行ファイル以外の
    引数を**すべて**単一引用符で包む（herdr の「安全な文字だけなら裸で出す」をやめる。zsh の `=cmd` 展開等を避ける）ことで、
    シェルの差が効く余地を無くす。確かめたのは bash・dash だけであることを test-result.md の「未検証の穴」に書く。
- **影響**: requirements の対象外・FR に反映。docs/wtmctl.md に対応シェルを書く。

## D2: research を挟む（protocol.md「4.5」の条件に当たる）

- **背景**: 影響が横断的（protocol の RPC とエラー code・server の検出と PTY への書き込み・cli の待ち合わせ）で、未検証の既存挙動
  （`LinuxProcessInspector.foregroundJob` が空いているシェルで何を返すか・`AgentTracker` の 3 秒の猶予・名前の置き場）に依存する。
- **決定**: research.md を書く（一次資料の herdr と、既存コードの読み取り・実測）。
- **影響**: design は research の F 番号を根拠に引く。

## D3: 起動の状態機械は「予約」だけをサーバに持ち、Blocked/Active は名前付きの `AgentInfo.state` で表す

- **背景**: herdr は `Pending{ready_after, deadline}`・`Blocked`・`Active` をサーバの terminal に持ち、`AgentInfo` に `launch_pending`・
  `interactive_ready` を出す（research F1.8・F1.9）。
- **決定**: サーバは「検出されるまでの名前の予約」（pane・名前・種類・締め切り）だけを持つ。検出されたら名前を付けて予約を終え、以後の
  ready／blocked は CLI が名前付きの `AgentInfo.state` から判定する。3 秒の猶予は既存の `AgentTracker` の「検出 + 3 秒は判定しない」で満たす。
- **理由・代替案**: 代替案「herdr と同じ状態機械をサーバに持ち、`AgentInfo` に `launchPending`・`interactiveReady` を足す」は、protocol・web の
  型と `sameAgent` に項目が増え、起動中の状態を web に出さない（requirements の対象外）本 work では使い道が CLI の判定だけになる。本製品の
  `AgentInfo` は検出 1 回分（`instanceId`）ごとに作り直されるので、herdr が状態機械で表している「別の種類が出た・終了した」は `instanceId` と
  `kind` の変化で既に表せる。
- **影響**: 起動中（検出前）は `agent list` に出ない。herdr の「Blocked の間は rename できない（`agent_launch_pending`）」は無い。

## D4: 一度付いた名前は締め切りで外さない

- **背景**: herdr は締め切りの時点でまだ `Pending`（検出されたが猶予中・`working` 等）なら名前を外す（F1.8）。
- **決定**: 本製品では検出された時点で予約を終えて名前を付け、締め切りでは外さない。CLI は `timeout` を返すが、エージェントは名前付きのまま残る。
- **理由・代替案**: 名前の付いたエージェントは実在する live なエージェントで、`agent wait <name>` で待ち直せるほうが利用者に役立つ。外すには
  検出後もサーバが締め切りを追う状態を持つ必要がある（D3 の簡素化と逆行）。
- **影響**: docs の herdr との違いに書く。

## D5: 全部の引数を単一引用符で包み、打ちかけの消去（Ctrl-E・Ctrl-U）を前に付け、1 行 4000 バイトを上限にする

- **背景**: herdr は安全な文字だけの引数を裸で出し（F1.6）、打ちかけの消去はしない（F1.7）。
- **決定**: (1) 実行ファイル名以外の全引数を `'…'`（`'` は `'\''`）で包む。(2) 行の前に `\x05\x15` を送る。(3) コマンド行（包んだ後）が UTF-8 で
  4000 バイトを超えたら `invalid_agent_argument`。
- **理由・代替案**: (1) 裸の引数は zsh の `=cmd` 展開（EQUALS）等、シェルごとの差が効く余地を残す。全部包めば POSIX の「単一引用符の中は一切
  解釈しない」だけに依る。(2) research F6.2 の実測で、打ちかけ（`echo LEFTOVER`）があると herdr の方式では bash・dash の両方で連結され、
  エージェントが起動しなかった。打ちかけが `rm -rf build` のようなものなら連結した行が実行される。bash・zsh の emacs 行編集では Ctrl-E が
  行末へ・Ctrl-U が行の消去、dash（行編集なし）では端末の行編集で Ctrl-E は行に入り Ctrl-U（VKILL）が行ごと消す。vi 編集モードでは効き目が
  限られる（R4。docs に書く）。(3) 端末の行編集（dash 等）の 1 行の上限（4095 バイト）を超えると切り詰められ、引用が閉じない行になる。
- **影響**: herdr と打ち込む文字列が違う（docs に書く）。

## D6: `agent_pane_busy` の再試行は条件を付けず 2 秒まで

- **背景**: herdr は「前面がシェルのグループで、シェル名が既知」（シェルが初期化中に見える）ときだけ 2 秒まで再試行する（F1.9）。
  本製品の CLI は前面プロセスの情報を RPC で取れない。
- **決定**: `agent_pane_busy` なら条件を付けず、最初の busy から 2 秒まで 100 ms おきに送り直す。
- **理由・代替案**: 代替案「前面プロセスの RPC を足して herdr と同じ条件にする」は API を増やす。条件なしの再試行で起きうるのは、2 秒以内に前面の
  コマンドが終わった pane に起動することだけで、それは利用者が指定した pane が空いた状態への起動なので安全面の差は無い。エディタ等が前面の
  pane では 2 秒後に同じ `agent_pane_busy` で返る。
- **影響**: busy の応答が 2 秒遅れる。docs に書く。

## D7: `MethodDeps.agentStarter` は省略可にし、あるときだけ `agent.start` を登録する

- **背景**: `MethodDeps` を組み立てるテストが 2 つあり、1 つは並行 work が触りうる結合テスト（research F4.3）。
- **決定**: `agentStarter?: AgentStarter`。`composeServer` は必ず渡す。
- **理由・代替案**: 必須にするとその 2 ファイルの型検査が落ち、並行 work と衝突する。
- **影響**: そのテストの組み立てでは `agent.start` は未登録（`not_found`）。本番の組み立ては smoke と結合テストで確かめる。

## D8: `--kind` は正規の kind 名だけを受ける（herdr の別名を受けない）・architecture は挟まない

- **背景**: herdr の `parse_agent_label` は別名（`claude-code` 等）も受ける（F1.1）。protocol.md「4.5」の architecture の 4 条件。
- **決定**: 正規の 22 の名前だけを受ける。architecture は挟まない。
- **理由・代替案**: 別名はパスの basename・拡張子の除去も伴い（`lookupAgentKind`）、受け付ける入力を広げる利点が無い。architecture: 新しい部品
  （`AgentStarter`）は `AgentMonitor` と同じ依存（session・terminals・processInspector）の並びで、モジュールの境界・依存の向きは変えない。
  `AgentInfo` の型も変えない。design で tasks に分解できる粒度になっている。
- **影響**: docs に書く。

## D9: 継続行（PS2）対策として、最初に Ctrl-C を別の書き込みで送り、200 ms 空けてから行を送る（T2 の点検の must）

- **背景**: taskcheck T2 で、pane のシェルが継続行（`echo 'foo` を Enter 済みで引用符が開いたまま）のとき、前面はシェル自身だけなので
  空いていると判定され、Ctrl-E・Ctrl-U は今の行しか消さないので、打ち込んだ行の先頭の `'` が利用者の引用を閉じ、引数の中身が引用の外に出て
  実行されることが実物（bash の bracketed paste 有無・dash -i）で再現された（D5 は同じ行の打ちかけしか想定していなかった）。
- **決定**: 書き込みを 2 つの部分に分ける。1 つ目は Ctrl-C（`\x03`）だけ、`START_INTERRUPT_DELAY_MS`（200 ms）空けて 2 つ目に
  「Ctrl-E・Ctrl-U＋コマンド行＋CR」。対話シェルは SIGINT で継続行ごと入力を捨てる。
- **理由・代替案**: 実測（scratchpad の ps2.mjs）で、bash（bracketed paste 有・無）・dash -i の 3 通り × 打ちかけ 3 種（`echo 'leftover`＋CR・
  `echo "leftover`＋CR・`echo LEFT`）の全部で、打ち込んだコマンドだけが実行され `$(touch pwned)` は展開されなかった。Ctrl-C を行と同じ書き込みに
  続けると、SIGINT の処理と行の読み取りが競って先頭の文字が落ちた（点検者の実測）。先頭が落ちると残りの引用の対応が崩れうるので、間を空ける。
  代替案「画面から PS2 を見分ける」はプロンプトの形が利用者次第で判定できない。
- **影響**: 空いているプロンプトでも Ctrl-C を受けたシェルは新しいプロンプトを出す（`$?` が 130 になる）。200 ms は保証ではなく、極端な高負荷で
  シェルが SIGINT を処理する前に行が読まれると先頭が落ちうる（残るリスク。docs と test-result.md に書く）。herdr は消去自体をしない。

## D10: web の `clientError.ts` に新しい code の文言を足す（design の対象範囲の漏れ）

- **背景**: `ErrorCode` に code を足すと、web の `packages/web/src/net/clientError.ts` の `Record<ErrorCode, string>` が網羅を要求し、`pnpm -s build` が落ちた。
- **決定**: 7 つの code の日本語の文言を足す（ブラウザには通常来ない。既存の agent 系の code と同じ扱い）。
- **理由・代替案**: 型の網羅を外す案は既存の設計（D107）に反する。
- **影響**: web パッケージに 1 ファイルの差分。

## D11: 結合テストは pane のシェルの環境を隔離する（本物の claude を 1 回起動してしまった事故の対策）

- **背景**: 結合テストの最初の版は、pane の中で `export PATH=<偽の claude>:…` を打ってから起動していた。ある実行で、シェルがまだ打鍵を
  読む前に `agent start` の先頭の Ctrl-C（D9）が届き、端末がまだ読まれていない打鍵（`export …`・`echo 'unterminated`）ごと捨てたため、
  PATH に残っていた**この環境の本物の Claude Code（`~/.local/bin/claude`）がテスト用の引数（`-x` 等）で 1 回起動された**。
  CLI は `agent_start_failed`（起動完了の前に終了）で返った（引数の解釈で終了したとみられる。prompt は送っていない）。
- **決定**: テストでは `HOME` を一時ディレクトリにして利用者の rc を読ませず、サーバを起動する前に `PATH` の先頭を偽の `claude` にし（pane の
  シェルが継承する）、新しい pane はシェルが `cd` を実行し終えた印のファイルを待ってから使う。`sleep` の pane は判定の周期の `busy` を待つ。
- **理由・代替案**: 打鍵に頼る準備は Ctrl-C で消えうる。環境を最初から与えれば順序に依らない。
- **影響**: Ctrl-C はまだ読まれていない打鍵（型ahead）を捨てる。これは製品の振る舞いでもある（利用者がシェルの起動直後に打った内容が消えうる）
  ので docs に書く。

## D12: 復元で会話の再開コマンドを打ち込んでから 30 秒以内でまだ検出されていない pane は `agent_pane_busy`（cross 点検の should）

- **背景**: 再起動後の復元（20260923-agent-session-resume）は、予約も busy の印も付けずに `claude --resume …` を pane に打ち込む。
  `agent start` がその直後に来ると、先頭の Ctrl-C で再開を捨てる・再開したエージェントの入力欄に打ち込む・再開した同じ種類のエージェントに
  予約の名前を付けて「起動できた」と誤る、のどれかが起きうる。
- **決定**: `SessionService` が再開を打ち込んだ時刻を pane ごとに覚え、エージェントが検出されたら消す。`hasPendingResume(paneId)` は
  打ち込んでから `RESUME_PENDING_MS`（30 秒。`agent start` の既定の締め切りと同じ）以内でまだ検出されていなければ true。`AgentStarter` は
  それを busy とみなす。
- **理由・代替案**: 代替案「`agentSession !== null && agent === null` を busy」は、再開が失敗した（コマンドが見つからない等）pane が永久に
  busy になる。代替案「再開も同じ予約・書き込みの列に載せる」は復元の経路を変える（範囲外）。
- **影響**: 再開に 30 秒以上かかる pane では、その後の `agent start` が再開の途中に打ち込みうる（前面プロセスの確認は残るので、再開した
  エージェントが前面に居れば busy）。docs に書いた。

## D13: 書き込む直前に前面を確かめ直す（review ラウンド 1 の should）と、同じラウンドの nit の扱い

- **背景**: review ラウンド 1 で、前面の確認（最大 2 秒の `/proc` の読み取り）と `writeModal` の開始の間にブラウザから `vim foo⏎` 等が打たれると、
  確認の時点では bash だけなので available と判定され、Ctrl-C とコマンド行が vim に入る、と指摘された（FR6 に反する）。
- **決定**: `TerminalHost` の `ModalInput` に任意の `prepare(): Promise<void>` を足し、`runModal` は flush の後・`build` の前にそれを待つ。この間は
  `busy` なので、他の `write`・`writeModal` は後回しになる。`AgentStarter` は `prepare` で `foregroundJob`・`checkShell` をもう一度行い、
  available でなければ（シェルが替わった場合も含め）`agent_pane_busy` で何も書かずに予約を解く。最初の確認は残す（明らかに busy な要求を予約せずに返すため）。
- **残るリスク**: 確かめ直しの少し前に打たれたコマンドをシェルが fork・exec している途中（前面のグループがまだシェル）の瞬間は見分けられない。
  確かめ直しの間（最長 2 秒）、その pane への他の入力は遅れて届く。どちらも `docs/wtmctl.md` に書いた。
- **nit の扱い**: `noteInteraction` は `AgentStarter.start(params, onAccepted)` の `onAccepted`（予約の後・書き込みの前）で記録し、拒否した要求は記録しない
  （agent.prompt の順に揃えた）。閉じた pane の `resumeWrittenAt` は `publishPaneClosed` で消す。シェルの判定が argv[0] の名前だけである点は直さない
  ——pane の中で `exec -a bash <prog>` を打てる者は既にその pane を自由に操作できるので権限の境界ではなく、検出（`ProcessMatcher`）も argv[0] で揃っている。
- **確かめ方**: 修正ごとに 9 通りの変異（R1〜R9）で負の確認を行い、全部検出した（test-result.md）。
