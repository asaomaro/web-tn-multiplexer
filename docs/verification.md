# 検証手順：3 OS・実機

AC16（Linux・WSL2・Windows ネイティブで AC1〜AC14 と AC18 を確かめる）・AC11（別のマシンから TLS で使う）・
AC12（モバイル。実機での検証）・AC17（性能。実機での計測と合否の判断）の実施手順。`packages/e2e` は Linux（chromium）で
のみ自動化されている——**この docs は、自動化できない残りの確認を人手でどう埋めるかをまとめたもの**。確かめる途中で
出会っても不具合ではないもの（今の版の限界）は「既知の制約」にまとめてある。

## 前提

各 OS で以下を用意する：

```sh
pnpm install
pnpm -s build
```

**`wtm` というコマンドは PATH に無い**（`@wtm/server` は公開していないワークスペースのパッケージで、上の手順では
どこにも入らない）。実体は `packages/server/dist/main.js` で、リポジトリの直下で `node packages/server/dist/main.js serve …`
のように起動する（使い方は `node packages/server/dist/main.js --help`）。**この docs の `wtm …` は
`node <リポジトリ>/packages/server/dist/main.js …` の略**。同じように打てるようにするなら：

```sh
# bash / zsh（リポジトリの直下で実行する。~/.bashrc 等に書くなら $PWD ではなく実際のパスを書く）
alias wtm="node $PWD/packages/server/dist/main.js"
```

```powershell
# PowerShell（Windows ネイティブ）。パスは自分の clone の場所に置き換える。関数は定義した窓でしか使えないので、
# 別の窓でも使うなら $PROFILE に書く（notepad $PROFILE で開いてこの行を足す）
function wtm { node "C:\src\web-tn-multiplexer\packages\server\dist\main.js" @args }
```

`packages/e2e` の自動 E2E（Linux・chromium 前提）は、いずれの OS でも参考として実行できる
（Windows ネイティブでは `node-pty` の ConPTY 経由になるため、Linux の PTY 実装との違いが無いかの手がかりにもなる。
WSL2 ではサーバは WSL の中で Linux として動き、Linux と同じ Unix の PTY を使う——design「WSL2」）。初回は Playwright の Chromium を入れておく（`pnpm --filter @wtm/e2e exec playwright install chromium`）。
spec は 1 つずつ走る（`playwright.config.ts` の `workers: 1`。並列にすると CPU を取り合って落ち、性能計測の値も汚れる。
decisions.md D104）ので、全体で数分かかる：

```sh
pnpm --filter @wtm/e2e test
```

動かし方の注意（詳しくは `docs/tls-setup.md`「起動と運用の注意」）：

- **同じ状態ディレクトリの `wtm serve` は 1 つしか動かせない**（ポートが違っても。`wtm.lock`）。手元用（7780）と
  LAN 用（8443）を並行して動かすなら、LAN 用に `--state-dir` で別のディレクトリを渡す。2 つ目は
  `wtm: the state dir … is already in use by another wtm (pid …)` で止まる（終了コード 2）。
- **`wtm token reset` は `wtm serve` を止めてから**（動いている間は断る。終了コード 2）。
- **`wtm serve` を起動した端末を閉じると wtm も終わる**（SIGHUP。`nohup` でも同じ）。検証の途中で端末を閉じるなら
  tmux の中で動かす。
- **scrollback は既定の「自動」でデスクトップのブラウザが 5,000 行（`--scrollback` で変えられる。上限 10,000）、
  スマートフォン等のモバイルのブラウザが 1,000 行**。ブラウザごとに設定（`prefix+s` の「端末」、モバイルは上のバーの「設定」）で
  選べ、数を選んだときは `--scrollback` の値で頭を押さえる（サーバのミラーは `--scrollback` の行数を持つ。メモリの目安は `docs/tls-setup.md`
  「scrollback の行数とメモリ（`--scrollback`）」）。
- **新しい workspace・tab・分割は、既定で「いま見ている pane の、いまの場所」で開く**（herdr の `terminal.new_cwd` の `follow`。
  20260921-new-terminal-cwd）。pane で `cd` してから作ると、その `cd` した先で開く。ブラウザごとの設定（`prefix+s` の「端末」の
  「新しく開く場所」）で、ホーム・サーバを起動した場所・指定した場所（絶対パスか `~/` で始まるパス。`~` だけならホーム。`~user` は
  使えない）に変えられる。選んだ場所が使えない（無い・ディレクトリでない・入れない。「指定した場所」が空・相対パスのときも）ときは
  以前と同じ場所（workspace はサーバを起動した場所、tab はその workspace の場所、分割は元の pane の場所。そこも使えなければサーバを
  起動した場所）で開いてトーストで知らせる。「引き継ぐ」で元の pane の場所が分からない・消えていたときは知らせない（利用者の誤りでは
  ないので）。worktree を開く操作は、方針に関わらず worktree の場所で開く。「いまの場所」の分かり方は OS で違う（Linux は前面の
  プロセスの cwd を読む。macOS と Windows ネイティブはシェルが OSC 7 で知らせた場所だけ——「既知の制約」）。

## Linux（CI・手元）

**CI**：`pnpm -s typecheck && pnpm -s lint && pnpm -s test && pnpm -s build && pnpm -s smoke &&
pnpm --filter @wtm/e2e test` が通ることを基準とする（`packages/e2e` はこの OS でのみ全 spec が
自動で走る）。

**手元の追加確認**（自動化していない項目）：

- [ ] `wtm serve` を起動し、表示された `wtm: open http://127.0.0.1:7780/…` の URL をブラウザで開いてログインできる。
      期待：その状態ディレクトリで初めての起動なら `#token=…` 付きの URL が出て、開くとそのままログインする（token は
      この 1 回だけ表示されるので控えておく）。2 回目以降の起動は `#token=` の無い URL と「token を忘れた場合は…」の行に
      なるので、開いたログイン画面に控えた token を入れる（控えていなければ、`wtm serve` を止めて `wtm token reset` で
      作り直してから起動し直す）。
- [ ] vim・htop（`terminal-app.spec.ts` は htop がこの検証環境に無いため `top` で代替している。
      decisions.md D90）を実際に起動し、崩れずに全画面表示されることを目視で確認する。
- [ ] 実際の IME（macOS の日本語入力・ibus 等）で変換候補窓の位置・見た目を確認する
      （自動テストは「合成中の文字が表示され、確定で PTY へ届く」までしか確認していない。
      `terminal-app.spec.ts`「IME の合成入力」参照）。
- [ ] 実際の色（256色・TrueColor）をブラウザで目視する（自動テストはバイト列の往復のみを確認しており、
      xterm.js の canvas/WebGL 描画結果そのものは DOM から読めないため検証できていない）。
- [ ] マウス報告（AC4・M11）：マウスを使うアプリ（htop の行のクリック・vim の `:set mouse=a` 後の
      クリックでのカーソル移動等）で、クリック・ホイールがアプリへ届くことを確認する。あわせて、
      マウス報告中でも Shift+クリック（macOS 以外）で報告を送らずに文字を選択できることを確認する
      （自動テストでは合成マウスイベントから SGR レポートを観測できず見送った。decisions.md D90）。
- [ ] 右クリックのアプリへの受け渡し（AC14・M7）の 1——既定の宛先：pane で `printf '\e[?1000h\e[?1006h'; cat -v` を実行し
      （マウス報告を求めるアプリの代わり。届いたマウスの報告が `^[[<…` の形で行に出る）、端末の上で右クリックする。期待：
      pane のメニューが開き、行には何も出ない（既定の右クリックの宛先はメニューなので、右ボタンの報告はアプリへ送らない。
      2026-09-20 に見つけた「メニューと一緒に `^[[<2;…M^[[<2;…m` も届く」不具合は D110 で直した）。Esc で閉じると、
      右クリックした端末へフォーカスが戻り、そのまま打てる。左クリックでは今までどおり `^[[<0;…M^[[<0;…m` が出る。
- [ ] M7 の 2——pane に送る：続けて、メニューの「右クリックを pane に送る」を選び、もう一度端末の上で右クリックする。期待：
      メニューは開かず、行に `^[[<2;<列>;<行>M^[[<2;<列>;<行>m`（`2` は右ボタン、`M` は押した・`m` は離した）が出る。
- [ ] M7 の 3——pane の枠から戻す：`cat -v` を動かしたまま、pane の枠（端末の外周の幅 4px の縁。選ばれている pane には 2px の線が付く。
      ポインタを重ねるとカーソルがメニューの形になる）を右クリックする。期待：行に何も出ずに pane のメニューが開き、項目が「herdr のメニューを使う」に
      替わっている（枠の右クリックは、宛先の設定やアプリのマウス報告に関わらず常にメニューを開く。design の M7・D110）。選ぶと
      既定に戻り、端末の上の右クリックでもメニューが開く（行に何も出ない）。
- [ ] M7 の 4——キーボードで pane のメニュー：`Ctrl+C` で `cat` を止め、`printf '\e[?1000l\e[?1006l'` でマウス報告を止めてから、
      `Ctrl+B v` で右へ分割し、`Ctrl+B h` で左の pane を、`Ctrl+B l` で右の pane を選ぶ（メニューを開きたい pane を prefix のキーで
      選ぶ）。端末の中では Tab・Shift+Tab は端末へ届くので、ブラウザのキーで端末の外へ
      出る（例：F6 か Ctrl+L でアドレスバーへ出て、F6 でページへ戻る。ブラウザの操作で、この手順の作成時には確かめていない）。
      ページの先頭から Tab を押していく。期待：サイドバー（ブラウザによっては止まらない）→ tab バーの tab → 分割の境界（選んだ pane
      より前にあるときだけ）→ **選んだ pane の枠**（焦点の線が出る）の順に止まり、選んでいない pane の枠・端末には止まらない。枠で
      Enter（Space・↓・Shift+F10・ContextMenu キーでも）を押すと、その pane のメニューが開き、↑↓ と Enter で選べる（「右クリックを
      pane に送る」はその pane にだけ効く。選んだら同じ手順で「herdr のメニューを使う」に戻す）。Esc で閉じると枠へ戻り、もう一度 Tab で
      その pane の端末へ入る。終わったら `Ctrl+B x` で分割した pane を閉じる。
- [ ] scrollback の行数（AC5・D107）：**このブラウザの設定の「端末」が「自動」（既定）のまま**確かめる（数を選んでいると、
      ブラウザの行数はその値になる）。pane で `seq 1 6000` を実行し、ホイールで一番上まで遡る。期待：先頭は `1` ではなく
      1000 の少し手前（例 `951`。5,000 行と画面の行数より古い行は消えるので、画面の行数で変わる）。ページを開き直しても
      同じ所まで遡れる（サーバのミラーも 5,000 行を持つ）。`--scrollback 2000` で起動し直したら、**ページを開き直してから**
      もう一度 `seq 1 6000` を実行する。期待：先頭が 4000 の少し手前（例 `3951`）。ブラウザの端末の行数は端末を作ったときに
      決まり、pane の id は起動し直しても同じなので、開いたままのページの端末は 5,000 行のまま（`docs/tls-setup.md`
      「scrollback の行数とメモリ（`--scrollback`）」）。
- [ ] 新しく開く場所（20260921-new-terminal-cwd）：設定の「端末」の「新しく開く場所」が「引き継ぐ」（既定）のまま、pane で
      `mkdir -p /tmp/wtm-a && cd /tmp/wtm-a` を実行してから `Ctrl+B c`（名前を尋ねるので Enter）で新しい tab を開き、`pwd` を実行する。
      期待：`/tmp/wtm-a`。元の pane に戻り、`Ctrl+B v`（分割）と `Ctrl+B N`（新しい workspace）でも同じく `pwd` が `/tmp/wtm-a`。
      pane の中で `bash` を入れ子に起動して `cd /tmp` してから作っても `/tmp`（いちばん外側のシェルではなく、前面のプロセスの場所を読む）。
      次に設定で「ホーム」「サーバを起動した場所」を選び、それぞれ新しい tab で `pwd` がホーム・`wtm serve` を起動した場所になる
      （既に開いている pane の場所は変わらない）。「指定した場所」を選び、入力欄に `~/` を入れて Enter（保存されるだけでダイアログは
      閉じない）→ Esc で閉じて新しい tab を開く。期待：`pwd` がホーム。入力欄を `/nope` にして同じように新しい tab を開く。期待：
      「新しく開く場所が使えないため、代わりの場所で開きました（設定の「端末」で確かめてください）」のトーストが出て、その workspace の場所で開く。最後に「引き継ぐ」に戻す。worktree を開く操作（workspace のメニュー）は、どの方針でも worktree の場所で開く。
- [ ] claude・codex 以外のエージェント（AC6。実物で確かめたのは Claude Code と Codex だけ）：`wtm serve` の起動時のログの行
      `{"ts":"…","level":"info","msg":"agent manifests loaded","ok":22,"total":22}` で、判定のルールが 22 種すべて読めている
      ことを確かめる。手元で使っているエージェントがあれば 2〜3 種（例：`gemini`（Gemini CLI）・`opencode`（OpenCode）・
      `copilot`（GitHub Copilot CLI）・`cursor-agent`（Cursor Agent）・`amp`（Amp）・`qwen`（Qwen Code）。全部の名前は
      `packages/server/src/agent/agents.ts` の `AGENTS`）を pane で起動し、ふだんどおりに使う。期待：サイドバーの agents の区画に
      行が出て、名前の横に「未検証」と出る。行の印は、動いている間は黄の ◐（working）、承認を求めると赤の ×（blocked）、止まって入力を
      待つと青灰の ○（idle）になり、別の pane を見ている間に終わると緑の ✓（done。その pane を表示すると idle に戻る）
      （既定は色と記号の併記。設定の「表示」で記号を切ると、以前の色の丸になる）。行のクリックで
      その pane へ移る。行が出ない・状態が違う（承認を求めているのに黄のまま等）ときは、エージェントの名前・版とその時の画面を
      控える（判定は herdr のルール `third_party/herdr/agent-detection/*.toml` のまま。直すのは後続「エージェント対応の拡充」）。
      Windows ネイティブで使うエージェントがあれば、そちらでも同じように確かめる（前面プロセスの見つけ方が違う。下の
      「Windows ネイティブ（WSL2 の母艦の Windows で直接）」）。
- [ ] 別のマシンからの TLS 接続（AC11）：下の「別のマシンからの TLS 接続（AC11）」の「Linux」。

## WSL2（手元）

Windows 上の WSL2 で `wtm serve` を動かす構成。`docs/tls-setup.md`「手順3（WSL2 のみ）：LAN・スマートフォンへ出す」
の設定を先に済ませておく。

- [ ] WSL2 内で `wtm serve` を起動し、**同じ Windows（母艦）のブラウザ**から表示された `wtm: open http://127.0.0.1:7780/…`
      の URL で開ける（既定の NAT モードでもここは追加設定なしで届く。research.md F9.6）。token の扱いは「Linux」の
      最初の項目と同じ（初回だけ `#token=…` 付き。2 回目以降はログイン画面に token を入れる）。
- [ ] 別のマシンからの TLS 接続（AC11）：下の「別のマシンからの TLS 接続（AC11）」の「WSL2」（mirrored モードか
      NAT＋portproxy のどちらか）。
- [ ] `pane.cwd` の復元（AC18）を確認する：workspace を作り、`cd` してから `wtm serve` を再起動し、
      `pwd` で同じディレクトリに戻ることを確認する（design「再起動後の復元」の「pane の cwd」：Linux は `/proc/<pid>/cwd`
      から追従するので WSL2 でも同じ経路のはず——ここは Windows ネイティブと違う点なので、両方で
      確かめる価値がある）。

## Windows ネイティブ（WSL2 の母艦の Windows で直接）

WSL2 を経由せず、Windows 上で直接 `node.exe` を実行して `wtm serve` を動かす構成
（`node-pty` は `1.2.0-beta.15`。ConPTY 専用——winpty は使わない。`package.json`）。PowerShell で、リポジトリの直下から
`node packages/server/dist/main.js serve`（以下の `wtm` は「前提」の PowerShell の関数）で起動する。

- [ ] `wtm serve` を起動し、表示された `wtm: open http://127.0.0.1:7780/…` の URL でログインし（token の扱いは「Linux」の
      最初の項目と同じ）、シェル（既定は `powershell.exe`。`--shell` で変えられる。design「起動オプション（`wtm serve`）」）が
      実際に起動して入出力できる。
- [ ] pane の cwd 追従と、新しく開く場所の「引き継ぐ」（20260921-new-terminal-cwd）を確認する：**Windows は前面のプロセスの cwd を
      読めない**ので、「いまの場所」は**シェルが OSC 7 で知らせた場所**だけ（herdr も部分対応。`[H]windows-beta.mdx:62-70`）。
      既定の `powershell.exe` は OSC 7 を出さないので、pane で `cd C:\Windows` してから `Ctrl+B c` で新しい tab を開き `Get-Location`
      を実行すると、**元の pane を開いた場所**になる（`cd` した先ではない）。これは既知の制約で、不具合ではない（以前の新しい tab は
      workspace を作った場所、新しい workspace はサーバを起動した場所で開いていた）。プロンプトで OSC 7 を出すようにしたシェルでは
      `cd` した先で開くはず（`file://host/C:/…` の形を `C:\…` に直して使う。20260921-new-terminal-cwd の decisions D7。**実機では未検証**——確かめたらここを更新する）。
      設定を「ホーム」にした新しい tab が `%USERPROFILE%` で開くことも確かめる。
- [ ] node-pty の既知の不具合（research.md F8.1）が実害として出ないか確認する：
      シェル終了ごとに `conhost.exe` が残らないか（#965）、pane を閉じた直後に不具合が起きないか
      （kill の競合 #952・#967）、閉じた pane の resize で例外にならないか（#827）。
      いずれも upstream の既知 issue で、本製品側での回避策は入れていない（decisions.md に記録が
      無ければ、その時点で未対応ということ——見つかったら decisions.md に追記する）。
- [ ] 前面プロセスの検出（AC6・AC7）が Windows でも動く：`node` や `python` 等、既知のエージェント名に
      該当しないプロセスを起動しても誤検出しない／該当するプロセス名なら検出されることを確認する
      （`ProcessMatcher` の Windows 実装は `/proc` の代わりに自前でプロセス走査する。
      `packages/server/src/platform/WindowsProcessInspector.ts`）。
- [ ] 同じ状態ディレクトリの二重起動を止める（`wtm.lock`。D103）：上の `wtm serve` を動かしたまま、別の PowerShell の窓で
      `wtm serve --port 7781` を実行し（`wtm` の関数は定義した窓でしか使えない。`$PROFILE` に書いていなければ、その窓でも
      「前提」の `function wtm …` を実行してから）、続けて `$LASTEXITCODE` を見る。`wtm token reset` も同じく。期待：どちらも何も起動・作成
      せずに止まり、`wtm: the state dir …\web-tn-multiplexer is already in use by another wtm (pid …)`（`token reset` は
      `wtm: cannot reset the token: the state dir … is in use by a running wtm (pid …)`）が出て、`$LASTEXITCODE` が `2`。
- [ ] 落ちて残ったロックを取り直す（pid の生死の判定。D103）：`Get-Content "$env:LOCALAPPDATA\web-tn-multiplexer\wtm.lock"`
      で中身（1 行目が wtm の pid、2 行目がホスト名）を見て、`Stop-Process -Id <1 行目の pid> -Force` で wtm を強制終了する
      （落ちたときと同じく、ロックを消さずに終わる）。`Test-Path "$env:LOCALAPPDATA\web-tn-multiplexer\wtm.lock"` が `True`
      のままであることを確かめてから、もう一度 `wtm serve`。期待：`already in use` にならずに起動し（ロックの pid がもう動いて
      いないので取り直す）、ロックの 1 行目が新しい pid になる。ブラウザで開き直すと構成が戻る。強制終了なので、pane のシェル
      （`powershell.exe`）・`conhost.exe` が残っていないかもタスク マネージャーで見る（上の node-pty の項目と同じ見方）。
- [ ] コンソールを閉じたときの終わり方（D103）：`wtm serve` を動かしている PowerShell の窓（Windows Terminal ならそのタブ）を
      右上の × で閉じる。10 秒ほど待ってから、新しい PowerShell で `Test-Path "$env:LOCALAPPDATA\web-tn-multiplexer\wtm.lock"`。
      期待：`False`——wtm が閉じる合図（Node では SIGHUP）を受けて `session.json` を書き、ロックを放してから終わった（Windows は
      コンソールを閉じると、約 10 秒後にプロセスを強制的に終わらせる）。その新しい窓で（`wtm` の関数を定義してから）起動し直し、
      ブラウザで開くと、閉じる前の構成が戻る。
      `True` なら片付けが間に合わずに終わっている（次の起動はロックを取り直すので使えるが、結果として控えておく）。
- [ ] 別のマシンからの TLS 接続（AC11）：下の「別のマシンからの TLS 接続（AC11）」の「Windows ネイティブ」。

## 別のマシンからの TLS 接続（AC11）

AC16 の 3 環境それぞれで AC11 を確かめる（「Linux」「WSL2」「Windows ネイティブ」の節を 1 つずつ）。**サーバを動かす
マシン**と、**同じ LAN の別のマシン**（PC。スマートフォンは下の「実機」）を用意する。例のポートは 8443、
サーバのマシン（WSL2・Windows ネイティブでは母艦の Windows）の LAN の IP は `192.168.1.50`（自分の環境の値に読み替える）。
どの環境も最後に「共通：AC1〜AC9 の一巡（別のマシンのブラウザで）」と「共通：AC10・AC13・AC14・AC18（AC16）」を行う（Tailscale・リバースプロキシを
使うなら「任意：Tailscale・リバースプロキシ（使う構成だけ）」も）。うまくいかないときは、この節の最後の「うまくいかないとき」。

この節で使う場所（どの環境でも同じ形にそろえる）：

| | Linux・WSL2（bash） | Windows ネイティブ（PowerShell） |
|---|---|---|
| 証明書（`wtm.pem`・`wtm-key.pem`） | `~/wtm-cert` | `$HOME\wtm-cert` |
| LAN 用の状態ディレクトリ（`--state-dir`） | `~/.local/state/wtm-lan` | `$env:LOCALAPPDATA\wtm-lan` |

LAN 用の状態ディレクトリを手元用（既定の状態ディレクトリ）と分けるので、手元用の `wtm serve` を止めずに並行して動かせる
（同じ状態ディレクトリの 2 つ目は `already in use by another wtm` で起動しない）。**token の表示は、その状態ディレクトリで
初めて起動したときの 1 回だけ**：初回は `wtm: open https://…/#token=…` の行が出て、開くとそのままログインする（token を
控えておく）。2 回目以降（同じ環境で起動し直す・WSL2 で mirrored の後に NAT＋portproxy を試す等）は `wtm: open https://…/`
と「token を忘れた場合は…」の行になるので、開いたログイン画面に控えた token を入れる。控えていなければ、その `wtm serve` を
止めて `wtm token reset --state-dir ~/.local/state/wtm-lan`（Windows ネイティブは
`wtm token reset --state-dir "$env:LOCALAPPDATA\wtm-lan"`）で作り直し（`wtm: new token: …` と出る）、起動し直す。

### 共通の準備

- [ ] サーバのマシン（WSL2 は WSL2 の中、Windows ネイティブは PowerShell）で、ブラウザが開く IP を SAN に入れた証明書を
      上の場所に作る（`docs/tls-setup.md`「手順1」）。WSL2 では SAN に**母艦の** LAN の IP を入れる（WSL の 172.x ではない）。
      - Linux・WSL2：`mkcert -install`、続けて
        `mkdir -p ~/wtm-cert && cd ~/wtm-cert && mkcert -cert-file wtm.pem -key-file wtm-key.pem 192.168.1.50 localhost 127.0.0.1`
      - Windows ネイティブ：`mkcert -install`、続けて
        `New-Item -ItemType Directory -Force "$HOME\wtm-cert" | Out-Null; Set-Location "$HOME\wtm-cert"; mkcert -cert-file wtm.pem -key-file wtm-key.pem 192.168.1.50 localhost 127.0.0.1`

      期待：その場所に `wtm.pem`・`wtm-key.pem` ができる。
- [ ] 別のマシンに mkcert の CA（サーバのマシンで `mkcert -CAROOT` が示すディレクトリの `rootCA.pem` だけ。
      `rootCA-key.pem` は渡さない）を入れる。入れ方は OS・ブラウザごとに違う（`docs/tls-setup.md`「手順1」の mkcert の節：
      PC は `rootCA.pem` を置いたディレクトリを `CAROOT` に指定して `mkcert -install`、Firefox は独自の証明書ストア、iOS はプロファイルを
      入れてから「証明書信頼設定」でオン、Android は利用者の CA として入れる）。WSL2 では、母艦の Windows のブラウザ
      （AC9 で使う）にも同じように入れる（CA は WSL2 の中の mkcert が作ったもので、Windows の信頼ストアには入っていない）。
      期待：後の手順で証明書の警告が出ない（自己署名で代えるなら警告が出るので、例外を承認して進む）。
- [ ] 証明書なしでは LAN へ出せないことを確かめる：`wtm serve --host 0.0.0.0 --port 8443`。
      期待：`wtm: cannot bind to non-loopback host "0.0.0.0" without a certificate` で終わる（終了コード 2）。

### Linux

- [ ] ファイアウォールを動かしていれば 8443/tcp を開ける（`docs/tls-setup.md`「手順4」の「Linux（ufw・firewalld）」）。
      期待：`sudo ufw status`（または `sudo firewall-cmd --list-ports`）に 8443/tcp が並ぶ。
- [ ] 起動する：
      `wtm serve --host 0.0.0.0 --port 8443 --cert ~/wtm-cert/wtm.pem --key ~/wtm-cert/wtm-key.pem --state-dir ~/.local/state/wtm-lan`。
      期待：`wtm: listening on 0.0.0.0 port 8443 (https)`、続けて `wtm: open https://localhost:8443/…` と
      `wtm: open https://192.168.1.50:8443/…`（LAN の IPv4 ごと）の行が出る（初回だけ `#token=…` 付き。この節の冒頭）。
- [ ] 別のマシンのブラウザで `wtm: open https://192.168.1.50:8443/…` の行の URL を開く。
      期待：証明書の警告なしで開き、端末が表示される（初回の `#token=…` 付きの URL ならそのまま。2 回目以降の URL なら
      ログイン画面に token を入れてから）。
- [ ] 平文では入れないことを確かめる：別のマシンで `http://192.168.1.50:8443/` を開く。期待：開けない（エラーの画面）。
- [ ] 下の「共通：AC1〜AC9 の一巡（別のマシンのブラウザで）」と「共通：AC10・AC13・AC14・AC18（AC16）」。

### WSL2

mirrored モード（`docs/tls-setup.md`「方法A」）か NAT＋portproxy（「方法B」）の、使える方の手順を行う。

**mirrored モード**

- [ ] `.wslconfig` に `networkingMode=mirrored` を書き、`wsl --shutdown` の後に WSL2 を起動し直す。
      期待：WSL2 の `ip addr` に母艦の LAN の IP（例 192.168.1.50）が見える。
- [ ] Hyper-V ファイアウォールで 8443 を開ける（管理者の PowerShell。`docs/tls-setup.md`「手順4」の
      「WSL2 の mirrored モード」）：`New-NetFirewallHyperVRule -Name "wtm-8443" -DisplayName "wtm (8443)" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 8443`。
      期待：`Get-NetFirewallHyperVRule -Name "wtm-8443"` で規則が表示される。
- [ ] WSL2 で起動する：
      `wtm serve --host 0.0.0.0 --port 8443 --cert ~/wtm-cert/wtm.pem --key ~/wtm-cert/wtm-key.pem --state-dir ~/.local/state/wtm-lan`。
      期待：`wtm: open https://192.168.1.50:8443/…`（母艦の LAN の IP）の行が出る（初回だけ `#token=…` 付き。Windows の
      仮想アダプタの 172.x 等の行も並ぶことがある）。
- [ ] 別のマシンのブラウザで `wtm: open https://192.168.1.50:8443/…` の行の URL を開く。期待：警告なしで開き、端末が
      表示される（2 回目以降の URL ならログイン画面に token を入れてから）。
- [ ] 下の「共通：AC1〜AC9 の一巡（別のマシンのブラウザで）」と「共通：AC10・AC13・AC14・AC18（AC16）」。

**NAT＋portproxy**

- [ ] 母艦（管理者の PowerShell）で portproxy を張る（`listenport` と `connectport` はどちらも 8443）：
      `netsh interface portproxy add v4tov4 listenport=8443 listenaddress=0.0.0.0 connectport=8443 connectaddress=172.29.160.5`
      （`172.29.160.5` は WSL2 のシェルの `ip addr show eth0` で見た WSL2 の IP に置き換える）。
      期待：`netsh interface portproxy show v4tov4` に 0.0.0.0:8443 → WSL2 の IP の 8443 が並ぶ。
- [ ] Windows のファイアウォールで 8443 を開ける（`docs/tls-setup.md`「手順4」の「WSL2 の NAT＋portproxy」）：
      `New-NetFirewallRule -DisplayName "wtm (8443)" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Private`。
      期待：`Get-NetConnectionProfile` の LAN の接続が `Private`（パブリックなら規則が効かない）。
- [ ] WSL2 で起動する：
      `wtm serve --host 0.0.0.0 --port 8443 --cert ~/wtm-cert/wtm.pem --key ~/wtm-cert/wtm-key.pem --state-dir ~/.local/state/wtm-lan --origin https://192.168.1.50:8443`。
      期待：最初の `wtm: open` の行が `https://192.168.1.50:8443/…`（`--origin` の URL。初回だけ `#token=…` 付き）。
      続く 172.x の行は母艦からしか開けない。
- [ ] 別のマシンのブラウザで、最初の `wtm: open` の行の URL を開く。期待：警告なしで開き、端末が表示される
      （2 回目以降の URL ならログイン画面に token を入れてから）。
- [ ] 下の「共通：AC1〜AC9 の一巡（別のマシンのブラウザで）」と「共通：AC10・AC13・AC14・AC18（AC16）」。

### Windows ネイティブ

- [ ] PowerShell で起動する（`wtm` は「前提」の PowerShell の関数）：
      `wtm serve --host 0.0.0.0 --port 8443 --cert "$HOME\wtm-cert\wtm.pem" --key "$HOME\wtm-cert\wtm-key.pem" --state-dir "$env:LOCALAPPDATA\wtm-lan"`。
      期待：`wtm: listening on 0.0.0.0 port 8443 (https)` と `wtm: open https://192.168.1.50:8443/…` の行が出る
      （初回だけ `#token=…` 付き。`vEthernet (WSL)` 等の Hyper-V の内部スイッチのアドレスは出ない）。`EACCES` で止まったら、そのポートは
      除外ポート範囲にある（`netsh interface ipv4 show excludedportrange protocol=tcp` で確かめ、範囲外のポートにする）。
      `EADDRINUSE` なら、WSL2 の portproxy（NAT＋portproxy の手順）や mirrored モードの WSL2 の wtm が同じポートを使っていないか
      確かめる（`netsh interface portproxy show v4tov4`）。
- [ ] 初回の起動で出る Windows のファイアウォールのダイアログ（node.exe）で「プライベート ネットワーク」を許可する
      （`docs/tls-setup.md`「手順4」の「Windows ネイティブ」）。期待：`Get-NetConnectionProfile` の LAN の接続が
      `Private` で、node.exe にブロックの規則が無い。
- [ ] 別のマシンのブラウザで `wtm: open https://192.168.1.50:8443/…` の行の URL を開く。期待：警告なしで開き、端末
      （PowerShell）が表示される（2 回目以降の URL ならログイン画面に token を入れてから）。
- [ ] 大文字のホスト名で開ける（D101。ホスト名の大文字・小文字を区別せずに比べる）：PowerShell で `hostname` を実行し
      （例 `DESKTOP-ABC1234`）、サーバのマシン（か、その名前で届く別のマシン）のブラウザで `https://DESKTOP-ABC1234:8443/` を
      開く（証明書の SAN にその名前が無ければ警告が出るので、例外を承認して進む——ここで確かめるのは名前の許可で、証明書では
      ない）。期待：ブラウザは名前を小文字にして送るが、ログイン画面に token を入れるとログインでき、端末が出る（「このページの
      アドレス（https://desktop-abc1234:8443）からのログインを、サーバが許可していません」の 403 にならない）。
- [ ] 下の「共通：AC1〜AC9 の一巡（別のマシンのブラウザで）」と「共通：AC10・AC13・AC14・AC18（AC16）」。

### 共通：AC1〜AC9 の一巡（別のマシンのブラウザで）

キーは prefix（`Ctrl+B`）の後の 1 キー（design「既定のキー」）。

- [ ] AC1 workspace：`N` で作成・`W` で名前変更・`w`（↑↓・Enter）で切替・`D` で閉じる（確認のダイアログが出る）。
      期待：サイドバーの行が増減し、名前が変わる。
- [ ] AC2 tab：`c` で作成（名前を尋ねる）・`T` で名前変更・`1`〜`9`・`n`/`p` で切替・`X` で閉じる。期待：tab バーが追従する。
- [ ] AC3 pane：`v`（右）・`-`（下）で分割・境界をドラッグしてリサイズ・`h`/`j`/`k`/`l` で焦点の移動・`P` で名前変更・
      `x` で閉じる。期待：分割・リサイズが画面に出て、打った文字が焦点の pane に入る。
- [ ] AC4：vim（か htop）が崩れずに全画面で動く。日本語の表示と IME での入力ができる。窓の大きさを変える・サイドバーを
      折りたたむ（`b`）・サイドバーの境目をドラッグして幅を変えると、PTY の大きさも追従する（D107）：`tput cols`（Windows
      ネイティブの PowerShell は `[Console]::WindowWidth`）の値が変わり、vim は新しい大きさで描き直される。
- [ ] AC5：`[` の copy モードで `k` 等で遡り、`V` で行を選んで `y` でコピーし、`Ctrl+Shift+V` で貼り付けられる。期待：HTTPS
      （secure context）なのでクリップボードが使える（平文の HTTP では使えない）。
- [ ] AC6・AC7：Claude Code 等のエージェントを動かし、サイドバーに状態が出て、行のクリックでその pane へ移る。**状態の印が
      × ✓ ◐ ○ ·（入力待ち・完了・作業中・待機中・状態不明）として出て、豆腐（□）や絵文字にならず、5 つを形で見分けられる**こと（20260921-herdr-settings-gaps。字形のフォントは
      環境で違うので、この 3 環境で目で確かめる。崩れる環境が見つかったら `StateIcon.vue` の中だけで差し替える——design D4）。
      ふだんの操作では状態不明や完了をすぐには出せないので、**5 つそろって見える場所として `prefix+s` の「表示」の注記**を見る
      （字形と名前が優先度の順に組で並ぶ。書体は印と同じ system-ui だが、注記は小さく太字でも色付きでもないので、豆腐や絵文字に
      ならないかはここで、太さと色はサイドバーの入力待ち・作業中・待機中の印で見る）。
- [ ] AC8：ブラウザを閉じて開き直す。期待：workspace・tab・pane の構成と画面（scrollback を含む）が戻る。サイドバーの幅と
      折りたたみも、閉じる前のまま戻る（20260921-herdr-settings-gaps）。あわせて、ページを
      開いたまま `wtm serve` を止めて同じコマンドで起動し直す。期待：「再接続中…」が重なった後に消え、workspace・tab・pane の
      構成が戻り、各 pane に新しいシェルのプロンプトが出る（起動し直すと pane のシェルは新しく起動し直されるので、前の画面と
      scrollback は戻らない。design「再起動後の復元（AC18・D7）」）。打った文字とその出力が出る（同じページのまま繋ぎ直しても、表示中の
      pane の出力が届く。D107）。
- [ ] AC9：サーバのマシンのブラウザ（`https://localhost:8443/`。ログイン画面が出たら控えた token を入れる）と別のマシンの
      ブラウザで同じ pane を開き、どちらからも入力できる。PTY の大きさは、最後に操作した（打った・クリックした等）方の窓に合う
      （もう一方の窓は、縮めるか余白をつけて表示する。`tput cols` で確かめる）。スマートフォンで「この端末に合わせる」を押さずに
      同じ pane を開いても、PTY の大きさは変わらない（D106。「実機（iOS Safari・Android Chrome。AC12）」）。

### 共通：AC10・AC13・AC14・AC18（AC16）

AC16 は AC1〜AC14 と AC18 を 3 環境で確かめる。上の一巡に無い分のうち、AC11 はこの節、AC12 は
「実機（iOS Safari・Android Chrome。AC12）」（それも 3 環境それぞれで行う）、AC17 は「性能の計測（AC17）」で、残りをここで
確かめる（Linux では `packages/e2e` が自動で確かめている。WSL2・Windows ネイティブでは必ず行う）。キーは prefix（`Ctrl+B`）の後の
1 キー。

- [ ] AC10：シークレット（プライベート）ウィンドウで `https://192.168.1.50:8443/` を開く。期待：ログイン画面だけが出て、token を
      入れるまで workspace・端末は何も見えない。違う token では「token が違います。…」と出て入れない。
- [ ] AC13：`?` でヘルプ（キーの一覧）が開き、`/` で絞り込める。上の一巡で使わなかったキーも一覧どおりに動く：`H`/`J`/`K`/`L`
      （pane の入れ替え）・`Tab`/`Shift+Tab`（pane の巡回）・`z`（拡大表示。もう一度で戻る）・`r`（resize モード。`h`/`j`/`k`/`l` で
      境界が動き、Enter で抜ける）・`g`（goto。文字で絞り込み、Enter で移る）・`b`（サイドバーの折りたたみ）・`q`（このブラウザだけを
      切り離す。「再接続」で戻る）・`Ctrl+B` の二度押し（`Ctrl+B` そのものを端末へ送る。`cat -v` を動かして `Ctrl+B` を 2 回押すと
      `^B` が出る。ブラウザの側の処理なので、Windows ネイティブの PowerShell（`cat -v` が無く、PSReadLine が `Ctrl+B` に何も割り
      当てていないことがある）では確かめず、Linux・WSL2 で確かめれば足りる）。後続に回したキー（`shift+r` 等）は「未対応（後続: …）」と
      出る（`s` は設定を開く）。
- [ ] AC14：マウスで、pane・tab・サイドバーの行のクリックで移る（M1）・pane の境界のドラッグ（M2）・右クリックのメニュー（M3。
      pane・pane の枠・tab・サイドバーの workspace）・文字を選ぶとコピーされ「コピーしました」と出る（M4）・ダブルクリックで単語を
      選ぶ（M5）・ホイールで scrollback（M8）・スクロールバー（M9）。
- [ ] AC14 のリンク（M6・D110）：`echo https://example.com/` を実行し、出た URL をただクリックする。期待：何も開かない。Ctrl
      （macOS は Cmd）を押しながらクリックすると新しいタブで開く。Ctrl を押したまま URL に重ねると下線と指のカーソルが出て、Ctrl を
      離すと消える（出力の直後にポインタが同じ行の上にあると、xterm.js がその行を判定し直さず出ないことがある——いったん別の行へ
      動かしてから重ねる）。Linux・WSL2 では OSC 8 のリンクも同じ：`printf '\e]8;;https://example.com/\e\\example\e]8;;\e\\\n'`
      の `example`（表示の文字は URL でなくてよい）。http/https 以外（`printf '\e]8;;mailto:a@example.com\e\\mail\e]8;;\e\\\n'`
      等）はリンクにならず、Ctrl＋クリックでも開かない。
- [ ] M7・M11（マウス報告）は「Linux（CI・手元）」の手元の項目と同じ手順（WSL2 は同じ bash で行う。Windows ネイティブの
      PowerShell には `printf`・`cat -v` が無いので、Linux・WSL2 で確かめれば足りる——ブラウザの側の処理で、サーバの OS に
      依らない）。
- [ ] AC18：workspace・tab を作って名前を付け、分割し、pane で `cd` してから、`wtm serve` を Ctrl+C で止めて同じコマンドで
      起動し直し、ブラウザで開き直す。期待：構成・名前・レイアウト・フォーカスが戻り、Linux・WSL2 では `pwd` が `cd` した場所に
      なる（Windows ネイティブの cwd は「Windows ネイティブ（WSL2 の母艦の Windows で直接）」の cwd の項目の制約のとおり）。

### 任意：Tailscale・リバースプロキシ（使う構成だけ）

どちらもこの検証環境では実機で確かめていない（`docs/tls-setup.md` の手順は公式の docs に合わせて書いた）。使うなら、最後に
「共通：AC1〜AC9 の一巡（別のマシンのブラウザで）」を行う。**先に、手元用（127.0.0.1:7780・既定の状態ディレクトリ）と、この節の
AC11 の LAN 用（8443・`~/.local/state/wtm-lan`）の `wtm serve` を止めておく**——下の 2 つはポート 7780 と `~/.local/state/wtm-lan`
を使うので、止めずに起動すると、同じ状態ディレクトリは `already in use by another wtm`（終了コード 2）、同じポートは `EADDRINUSE`
（`--host 0.0.0.0` の 7780 も、127.0.0.1 の 7780 と重なる）で起動しない。`~/.local/state/wtm-lan` は 2 回目以降の起動なので、
ログイン画面に控えた token を入れる。

- [ ] Tailscale：`docs/tls-setup.md`「tailscale cert（Tailscale ネットワーク内。Let's Encrypt 由来）」の手順で、鍵の権限の方法1か2の
      とおりに証明書を作り、`wtm serve --host 0.0.0.0 --port 7780 --cert <名前>.crt --key <名前>.key --origin https://<machine>.<tailnet>.ts.net:7780 --state-dir ~/.local/state/wtm-lan`
      で起動する。期待：`cannot read --key` で止まらず、最初の `wtm: open` の行が `https://<machine>.<tailnet>.ts.net:7780/…`。
      tailnet の別の端末でその URL を開くと、証明書の警告なしで開き、ログインできる。
- [ ] リバースプロキシ：`docs/tls-setup.md`「リバースプロキシの後ろに置く」の nginx の例のとおりにプロキシを置き、wtm を
      `wtm serve --host 127.0.0.1 --port 7780 --origin https://wtm.example.com --state-dir ~/.local/state/wtm-lan` で動かす。期待：
      `https://wtm.example.com/` でログインでき、端末が出て入力できる。何も打たずに 2 分ほど置いてから打っても、すぐに届く（途中で
      「再接続中…」が出ない。`/ws` の `proxy_read_timeout` が効いている）。`~/.local/state/wtm-lan/server.log` に `origin rejected`
      が出ない（出るなら、プロキシが `Host` を書き換えていないか。同じ節の `Host` の項目）。

### うまくいかないとき

- **ログインが 403 で断られる**（Origin の不一致）：ログイン画面に「このページのアドレス（…）からのログインを、サーバが
  許可していません」と、写せる形の `--origin <このページの Origin>` の行が出る——その行を今の起動オプションに加えて起動し直す
  （サーバのログにも `origin rejected` が出る。`docs/tls-setup.md`「手順2：Origin の許可（別マシンから繋ぐ場合の注意）」）。
  この拒否は token とは関係ない（token はまだ確かめていない）ので、`wtm token reset` はしない。
- **ログイン済みのまま、端末の画面に「接続できません（このアドレスは許可されていません）」の枠が出る**（D106・D107）：ログイン
  （Cookie）は有効だが、このページのアドレスをサーバが許可していない（ページを開くときの確認 `/api/session` と WebSocket の `/ws`
  がどちらも 403。`--origin` で許可していた名前で開いたまま `--origin` を付けずに起動し直した・同じ名前の別のポート（転送した
  ポート）で開き直した等）。自動では繋ぎ直さない。枠の `--origin <このページの Origin>` の行を起動オプションに加えて起動し
  直してから、枠の「再試行」を押す（token の作り直しは要らない）。端末は枠の後ろに出たままで、scrollback は読める。
- **「再接続中…」の下に「つながらない状態が続いています。…」と `--origin` の行が出る**（D107）：ログインは有効で
  `/api/session` も通るのに、WebSocket だけが 3 回続けてつながらなかった（つながっていた接続が切れた後なら、1・2・4 秒の
  間隔で約 7 秒。ページを開いた直後なら約 3 秒）。リバースプロキシが `Host` を許可された名前で
  渡しているのに、`--origin` が無い場合等。サーバのログに `origin rejected` が出ていれば、その行を加えて起動し直す。サーバが起動の
  途中（保存された pane のシェルを起動し直している）なら、しばらく待てばつながって消える（繋ぎ直しは続けている）。
- **ログインの後に「接続中…」から進まない**：サーバが起動の途中なら少し待つ。続くなら、リバースプロキシが `/ws` の WebSocket の
  Upgrade を転送しているか（`docs/tls-setup.md`「リバースプロキシの後ろに置く」）。「ログインはできましたが、接続の確認でサーバが
  ログインを受け付けませんでした」と出たら、ブラウザが Cookie を保存していないか、その間に token が作り直された——もう一度
  ログインする。
- **開けない（タイムアウト）** ならファイアウォール（`docs/tls-setup.md`「手順4：ファイアウォール（構成ごと）」）。**証明書の警告**
  なら SAN と CA（「手順1：証明書を用意する」）。
- **token を 1 分以内に 5 回間違えた**：その接続元からのログインが最大 1 分（1 時間に 20 回に達したら最大 1 時間）429 で断られる（画面にも
  「ログインの失敗が続いたため、…」と出る。この間は正しい token でも入れない。wtm の再起動で数え直し。portproxy・リバース
  プロキシの後ろでは全員で共有。`docs/tls-setup.md`「リバースプロキシの後ろに置く」）。
- **画面の下に短く出る通知（エラー）は日本語**で、何が起きたかを示す（D107）。たとえば 1 回で 1MB を超える貼り付けは
  「送った内容をサーバが受け付けませんでした（1 回の貼り付けが 1MB を超えた等）。その分は端末に届いていません。」——分けて貼る。
- **打った文字が画面に出ない（「再接続中…」も出ていない）**：スマートフォンのスリープ・回線の切り替えの後等で、接続が黙って
  切れているのに、ブラウザがまだ気づいていない（「既知の制約」の 1 つ目）。ページを開き直す。

## 実機（iOS Safari・Android Chrome。AC12）

`packages/e2e/src/specs/mobile.spec.ts` は Playwright の chromium ベースのモバイルエミュレーション
（`devices["iPhone 13"]` の viewport・タッチ・UA を chromium で再現したもの）でしか確認していない。
**実際の Safari（WebKit）・実機のタッチ操作・ソフトキーボードは未検証**——以下を実機で確認する。

**AC16 は AC12 も 3 環境で求める**ので、この節は「別のマシンからの TLS 接続（AC11）」の「Linux」「WSL2」「Windows ネイティブ」の
3 つのサーバそれぞれに対して一通り行う（例 `https://192.168.1.50:8443`）。ただし「準備とログイン」のログイン画面の文言は
ブラウザの側だけの処理なので、どれか 1 つの環境で確かめれば足りる。比べるために、PC のブラウザ（サーバのマシンの
`https://localhost:8443/` か別のマシン）でも同じ pane を開いておく。

以下のコマンドは pane のシェルが bash（Linux・WSL2）の形。Windows ネイティブ（PowerShell）では次に置き換える（PowerShell の形は
この検証環境では未確認）：

| 用途 | Linux・WSL2（bash） | Windows ネイティブ（PowerShell） |
|---|---|---|
| PTY の大きさ（行数 列数） | `stty size` | `"$([Console]::WindowHeight) $([Console]::WindowWidth)"` |
| 1 秒ごとに出し続ける | `while sleep 1; do stty size; done` | `while ($true) { "$([Console]::WindowHeight) $([Console]::WindowWidth)"; Start-Sleep 1 }` |
| 時刻 | `date` | `Get-Date` |

- PTY の大きさは、pane で `stty size` を実行すると「行数 列数」（例 `40 120`）で出る。
- 「この端末に合わせる」は上部のバーのボタン。押すと PTY をスマートフォンの画面の大きさにする（サイズの権限を取る）。押して
  いない間は PTY の大きさを変えず、PC のブラウザが決めた大きさを画面の幅に縮めて表示する（D106）。
- スマートフォンから `Ctrl+C` を送るには、追加キーの列（上部のバーの ⌨ で出し入れ）の `Ctrl` を押してから `c`。prefix の
  キーは `Prefix` を押してから 1 キー。

### 準備とログイン

- [ ] mkcert の CA をスマートフォンに入れる（`docs/tls-setup.md`「手順1：証明書を用意する」の mkcert の節の「iOS・iPadOS」
      「Android」。iOS は「証明書信頼設定」でオンにするのを忘れない）。期待：スマートフォンのブラウザで
      `https://192.168.1.50:8443/` を開くと、証明書の警告なしでログイン画面が出る。HTTPS でつなぐこと（Clipboard API 等が
      secure context を要求するため、HTTP では M4 の自動コピー・`Ctrl+Shift+V` 相当の貼り付けが機能しない。research.md F9.4）。
- [ ] ログイン画面の理由ごとの文言（D105）の 1——token の誤り：違う token を入れて「ログイン」。期待：「token が違います。…」。
      この項目から下のログイン画面の項目では、どの文言も画面の幅で折り返され、ソフトキーボードを開いたままでも読めて、
      「ログイン」を押せること。
- [ ] ログイン画面の 2——失敗の続きすぎ：1 分以内に、違う token（1 文字等の短い誤りでよい）を続けて計 5 回入れた後の 6 回目
      （数えるのは接続元ごとの 1 分の間の失敗）。期待：「ログインの失敗が続いたため、
      サーバがログインを一時的に止めています（この間は正しい token でも入れません。…）」。1 分ほど待ってから次へ（待たずに
      進むなら、wtm を起動し直すと数え直しになる）。
- [ ] ログイン画面の 3——サーバが止まっている：サーバを止めて（Ctrl+C）から「ログイン」。期待：「サーバに接続できません。…」。
      起動し直す。
- [ ] ログイン画面の 4——ログインできる：正しい token（32 文字。PC の画面を見ながら打つ）を入れる。期待：「接続中…」が出て
      から端末の画面に替わる。
- [ ] ログイン画面の 5（任意。スマートフォンが `<ホスト名>.local` の名前を引ける環境だけ）——許可されていないアドレス：
      `https://<サーバのホスト名>.local:8443/` で開き（証明書の警告は承認して進む）、token を入れる。期待：「このページの
      アドレス（https://<ホスト名>.local:8443）からのログインを、サーバが許可していません。…」と
      `--origin https://<ホスト名>.local:8443` の行が出る（`.local` の名前は自動では許可されない。`docs/tls-setup.md`
      「手順2：Origin の許可（別マシンから繋ぐ場合の注意）」）。

### 1 列のレイアウトと入力

- [ ] 1 列のレイアウト：期待：上部のバー（「<workspace> / <tab>」・「この端末に合わせる」・⌨・「設定」）の下に pane が 1 つだけ出て、
      デスクトップのサイドバー・tab バーは出ない。端末をタップするとソフトキーボードが出て、`echo hello` を打つと `hello` が出る。
- [ ] 追加キーの列：⌨ を押す。期待：画面の下に `Esc`・`Tab`・`Ctrl`・`Alt`・`↑`・`↓`・`←`・`→`・`PgUp`・`PgDn`・`Prefix` の
      11 個が並ぶ。`↑` で前のコマンド（`echo hello`）が出る。途中まで打ってから `Ctrl` → `c` で、その行が取り消される。
- [ ] prefix のキー：`Prefix` → `c`。期待：新しい tab の名前を尋ねるダイアログが出る。名前（例 `t2`）を入れて Enter で、バーが
      「<workspace> / t2」になり、新しい tab のシェルが出る。
- [ ] pane ピッカー：バーの「<workspace> / <tab>」を押す。期待：全画面の一覧が出て、上に workspace とその tab の行（状態の
      印つき）、下にエージェントの動いている pane の行（あれば）が並ぶ（エージェントの居ない pane そのものの行は無い——tab を選ぶと
      その tab の焦点の pane が出る）。前の tab の行を押すと、一覧が閉じてその tab の pane の表示に替わり、先に打った `hello` が
      見える。もう一度開き、× で閉じられる。行の印が × ✓ ◐ ○ · の字形で出て、豆腐や絵文字にならないことも見る（端末のフォントが
      デスクトップと違う）。上のバーの「設定」から設定を開き、「閉じる」で閉じられる。
- [ ] 縦スワイプでの scrollback（`mobile/TouchScroll.ts`。decisions.md D83：xterm.js 6.0.0 の
      ネイティブなタッチスクロールは壊れているため自前実装で補っている）が実機でも自然に動くか。モバイルで遡れるのは、既定の「自動」では
      1,000 行まで（D107。デスクトップの 5,000 行より少ない）。上のバーの「設定」の「端末」で行数を選べる（`--scrollback` の値まで）。
- [ ] ソフトキーボードの開閉で表示領域が追従するか（`mobile/useVisualViewport.ts`。visual viewport の
      高さの変化への追従は実機のソフトキーボードでのみ確認できる）。期待：開くと、上部のバーから追加キーの列までが
      キーボードの上に収まる（「この端末に合わせる」を押していれば、端末もその中に収まる。下の節）。
- [ ] リンク（M6・D110）：`echo https://example.com/` を実行し、出た URL をタップする。期待：何も開かない（リンクは Ctrl・Cmd を
      押しながらのクリックで開く仕様で、タップには修飾キーが無い。「既知の制約」）。

### 「この端末に合わせる」とサイズ（D106・D108）

- [ ] 押していない間は PTY の大きさを変えない（D106）：PC のブラウザで pane を開き、`stty size` を実行する（例 `40 120`）。
      スマートフォンで同じ pane を開いて `stty size` を実行する。期待：同じ値で、スマートフォンでは画面の幅に縮めて表示される。
      PC のブラウザを閉じてからスマートフォンでページを開き直しても、`stty size` は変わらない。
- [ ] 押すと画面いっぱいになる（D108）：「この端末に合わせる」を押す（押された表示になる）。期待：端末が等倍で、表示領域
      （上部のバーと追加キーの列を除いた所）いっぱいに出る——右や下にはみ出さず、大きな余白も無い。`stty size` がスマート
      フォンの大きさになる（縦長なら 50 列前後。画面と文字の大きさで変わる）。PC のブラウザは、その大きさを縮めるか余白を
      つけて表示する。
- [ ] 回転・ソフトキーボード・追加キーの列に追従する（D108）：押したまま、`while sleep 1; do stty size; done` を動かしておく。
      期待：横長にすると、数秒のうちに列が増えて行が減った値が出て、端末が画面いっぱいに描き直される。縦に戻すと元の値に
      戻る。ソフトキーボードを開くと行が減り、閉じると戻る。⌨ で追加キーの列を出し入れすると行が増減する。
- [ ] ピンチで拡大・縮小しても PTY の大きさは変わらない（D108）：同じループを動かしたまま、**上部のバーか追加キーの列の上で**
      ピンチして拡大・縮小する（端末の上は縦のスワイプを scrollback に使うため `touch-action: pan-x` にしてあり、そこで始めた
      ピンチはブラウザが拡大しないことがある）。バーの文字が大きくなる等、ページが実際に拡大されたことを確かめてから判断する。
      期待：出る値が変わらない（拡大は見た目だけ）。終わったら縮小して戻し、`Ctrl` → `c` でループを止める。
- [ ] もう一度押すと手放す：期待：押されていない表示に戻り、画面の幅に縮めた表示になる。PC のブラウザが同じ tab を開いて
      いれば、何もしなくても PTY はすぐ PC の窓の大きさに戻る（手放した大きさの権限は、その tab を見ている大きさを決められる
      クライアントへ移る。`stty size` で確かめる）。
- [ ] 隠れた pane の大きさ（D105）：「この端末に合わせる」を押したまま、pane（p1）で `while sleep 1; do stty size; done` を
      動かし、`Prefix` → `v` で分割する（スマートフォンは新しい pane を表示し、p1 は隠れる）。10 秒ほど待ってから
      `Prefix` → `h` で p1 に戻る。期待：p1 に出ている値が、隠れている間もずっと同じ（`1 1` のような値が一度も出ない）。
      PC のブラウザでも p1 の表示が崩れない。

### 再接続（D95・D107・D108）

- [ ] 再接続の後もソフトキーボードが閉じず、画面が動き続ける（D95・D107）：端末をタップしてソフトキーボードを出し、`date` を
      打てることを確かめる。キーボードを出したまま、サーバを止めて（Ctrl+C）、数秒後に同じコマンドで起動し直す。期待：
      「再接続中…」と「つながるまで入力できません」が重なり、その間に打った文字は端末に出ない（届かない。溜めて後から送る
      こともしない）。つながると重ね表示が消え、**ソフトキーボードは開いたまま**で、タップし直さずに打てる。`date` の結果が
      画面に出る（新しい接続でも出力が届く）。起動し直すと pane のシェルは新しく起動し直される（AC18）。
- [ ] 再接続の後も「この端末に合わせる」が効く（D108）：押して `stty size` の値を控え、サーバを止めて同じコマンドで起動し直す
      （その間、PC のブラウザには触らない。触ると PC が大きさを取る——「既知の制約」）。期待：つながった後、ボタンは押された
      表示のまま、端末は画面いっぱいで、`stty size` が控えた値と同じ。

### 既知の未解決課題

- [ ] xterm.js のモバイルの未解決課題（decisions.md D83 の対象外一覧。製品側では対応しない）：
      Android Chrome＋Gboard の文字入力の乱れ（xterm.js upstream #3600）、タッチ端末でのコピー＆
      ペースト不可（xterm.js upstream #3727）。実機で再現するか確認し、再現しても既知の upstream
      課題として扱う（本製品のコードでは回避しない）。

## 性能の計測（AC17）

requirements.md の非機能要件（目安）：**応答性**——同一 LAN での接続で、キー入力から画面へ反映されるまでの追加の遅延が
p95 50ms 以内。大量出力（ビルドログ等）が流れる pane があっても、他の pane とブラウザの操作が固まらない。**規模**——1 セッション
で pane 16 個を同時に表示・操作できる。**状態反映**——エージェントの状態の変化が一覧に 2 秒以内。

測るのは `packages/e2e/src/specs/performance.spec.ts`（状態反映は `agent-detection.spec.ts`）。`performance.spec.ts` は遅延と
規模の値で合否を決めない（値は環境でぶれるので、出すだけ）——**遅延と規模の合否は、GPU があり負荷の少ない実機で以下のとおり
測り、利用者が判断する**（とくに大量出力中の 16 pane）。状態反映だけは `agent-detection.spec.ts` が 2 秒未満を assert して、
自動で合否を決める（下の「状態反映」の項目）。このサンドボックス（GPU の無いソフトウェアの GL・ほかの負荷あり）の値は参考にとどまる。

計測のコマンド（Linux か WSL2 の、リポジトリの直下で）：

```sh
pnpm --filter @wtm/e2e exec playwright test performance agent-detection --headed
```

- `performance`・`agent-detection` は spec の絞り込み（Playwright の引数はファイルのパスに対する正規表現で、一致した spec だけが
  走る）。5 件で 2 分ほど。
- `--headed` はブラウザの窓を出して走らせる（ヘッドレスの Chromium は GPU を使わず、ソフトウェアの GL で描くことがあるため）。
  走っている間は窓に触らない。窓を出すには画面が要る（WSL2 は WSLg、Linux は X か Wayland のデスクトップ）。画面の無い所
  （SSH だけのサーバ等）では起動に失敗するので `--headed` を外す——そのときの値はソフトウェアの GL（SwiftShader）で描いたもので、
  実際のブラウザより悪く出る。
- Windows ネイティブでは走らせない（spec は pane のシェルに `yes` 等の Unix のコマンドを打つので、PowerShell では大量出力が
  流れないまま測ってしまう）。
- ブラウザが GPU で描けているかは、次で分かる（これも窓を出すので画面が要る。出た名前に `SwiftShader` が入っていれば
  ソフトウェアの GL。GPU の名前（NVIDIA・AMD・Intel 等）なら GPU）：

  ```sh
  pnpm --filter @wtm/e2e exec node -e "import('@playwright/test').then(async ({ chromium }) => { const b = await chromium.launch({ headless: false }); const p = await b.newPage(); console.log(await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); return g.getParameter(g.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL); })); await b.close(); })"
  ```

  WSL2 の Chromium はこれが `SwiftShader` になることがある（このサンドボックスも WSL2 で `SwiftShader`）。その場合、計測の値は
  実際のブラウザより悪く出るので、下の「手で確かめる（16 pane・大量出力）」の項目を Windows の Chrome・Edge（GPU で描く）で
  行い、判断の中心にする。

出る 4 行（値はこのサンドボックスで 2026-09-20 に測った例）：

```
[AC17 遅延] 200 回・p50=2.9ms p95=11.0ms max=71.6ms
[AC17 規模] pane16個・うち1個大量出力中・別 pane の遅延 50 回・p95=214.8ms
[AC17 遅延・描画まで] 1 pane・200 回・p50=15ms p95=26ms max=48ms
[AC17 規模・描画まで] 16 pane 同時表示・うち 1 つで yes・別 pane の 50 回・p50=142ms p95=673ms max=821ms・描画フレームの最大間隔=222ms
```

| 行 | 測っているもの | 判定での使い方 |
|---|---|---|
| `[AC17 遅延]` | 生の WebSocket のクライアント（ブラウザを通さない）から 1 文字送り、そのエコーが返るまで（200 回）。サーバ（PTY・ミラー・配信）の分だけ | 参考（「描画まで」の内訳） |
| `[AC17 遅延・描画まで]` | 1 文字送ってから、ブラウザがその出力を受けて次の描画フレームが来るまで（1 pane・200 回） | **応答性**の判定 |
| `[AC17 規模]` | 16 個の pane（別々の tab）の 1 つで `yes` を流したまま、別の pane の往復（50 回）。サーバの分だけ（`yes` の pane は購読しない） | 参考 |
| `[AC17 規模・描画まで]` | 1 つの tab に 4×4 で 16 pane を表示し、1 つで `yes` を流したまま、別の pane の描画まで（50 回）。`描画フレームの最大間隔` は、その間にブラウザの描画が止まった最も長い時間 | **規模・大量出力**の判定 |

どの値も、サーバとブラウザが同じマシンで測ったもの（LAN の往復は含まない。下の最後の項目で足す）。

- [ ] 準備：「前提」の `pnpm install`・`pnpm -s build` と Chromium の導入を済ませる。重い処理（ビルド・動画・ほかの E2E 等）を
      止め、ノート PC は電源につなぐ。
- [ ] 上のコマンドで測る。期待：`5 passed` と上の形の 4 行が出る。4 行を控える。
- [ ] 応答性：`[AC17 遅延・描画まで]` の p95 が 50ms 以内なら合格。
- [ ] 状態反映：`agent-detection.spec.ts` の 1 件が passed なら合格。その中で確かめているのは、判定のルールに当たる画面が
      端末に出てから、**サーバが状態の変化（`pane.agent_status_changed`）を知らせるまで**が 2 秒未満であること（テスト自身の
      WebSocket のクライアントで受ける。design の AC17 の「状態の反映」の測り方）。**サイドバーに描かれるまでの時間は含まない**
      （サイドバーは、その後 3 秒以内に blocked の色になることだけを確かめている）。サイドバーまでは、「Linux（CI・手元）」の
      claude・codex 以外のエージェントの項目や AC6・AC7 の一巡で、状態が変わってから印（色と記号）が変わるまでに遅れを感じないことを
      目で見る。
- [ ] 規模・大量出力：`[AC17 規模・描画まで]` の p95 が 50ms 以内なら合格。`yes` は最大の速さで出し続けるので、ビルドのログ
      よりずっと重く、このサンドボックスでは p95 が 370〜780ms ほど、描画フレームの最大間隔が 90〜260ms ほどで、50ms を超えて
      いる。超えたら、下の「手で確かめる（16 pane・大量出力）」の項目で同じ状態を操作し、要件の「他の pane とブラウザの
      操作が固まらない」を満たすかで判断する（この場面の p95 50ms は目安）。描画フレームの最大間隔が数百 ms を超えると、その間は
      画面全体が止まって見える。判断と 4 行の値を控える。
- [ ] 手で確かめる（16 pane・大量出力）：ブラウザで 1 つの tab を 4×4 の 16 pane に分ける（`performance.spec.ts` と同じ分け方。
      分割すると焦点は新しい pane へ移るので、同じキーをくり返すだけでは端の pane ばかりが細くなる）。キーは prefix（`Ctrl+B`）の
      後の 1 キー：
      (1) 4 列にする：`v`・`h`・`v`・`l`・`v`（どの列も同じ幅になる）。(2) `h` を 3 回で左端の列へ。(3) その列を 4 段にする：
      `-`・`k`・`-`・`j`・`-`。(4) `l` で右の列へ移り、(3) をくり返す（計 4 列）。期待：同じ大きさの pane が 4×4 に並ぶ。
      1 つの pane で `yes` を実行し、流したまま、別の pane に文字を打つ・`Ctrl+B h`/`j`/`k`/`l` で
      pane を移る・ホイールで scrollback を遡る・サイドバーの行をクリックする。期待：打った文字がすぐ出て、操作が引っかから
      ない（どこまでなら許せるかが判断）。`Ctrl+C` で `yes` を止める。
- [ ] LAN の別のマシンから：design.md の AC17 は「LAN の計測は別のマシンのブラウザから行う」としているが、spec はサーバと
      ブラウザを同じマシンで動かすので、そのままでは測れない。**ここでは、同じマシンで測った値に LAN の往復の時間を足す近似で
      代える**（この近似でよいとするかは利用者の判断）。別のマシンで `ping -c 20 192.168.1.50`（Windows は
      `ping -n 20 192.168.1.50`）を実行し、往復の**最大**（Linux は `rtt min/avg/max/mdev` の max、Windows は「最大」）を見る
      （平均より控えめな見積もりにするため）。期待：`[AC17 遅延・描画まで]` の p95 に足しても 50ms 以内（同じ LAN なら往復は
      数 ms）。WSL2 と Windows ネイティブでは `192.168.1.50` は母艦の Windows で、Windows のファイアウォールは既定で ICMPv4 の
      エコー要求（ping）を止める——返事が無ければ、母艦の管理者の PowerShell で
      `Enable-NetFirewallRule -Name FPS-ICMP4-ERQ-In`（「ファイルとプリンターの共有 (エコー要求 - ICMPv4 受信)」の規則。終わったら
      `Disable-NetFirewallRule -Name FPS-ICMP4-ERQ-In`）で許可する（この検証環境では未確認）。あわせて「別のマシンからの TLS 接続
      （AC11）」の構成で、別のマシンのブラウザから vim 等で打ち、遅れを感じないこと。

## 既知の制約

確かめる途中で出会っても、不具合ではなく今の版の限界として扱うもの（直すなら後続の work）。herdr との機能の差と、確かめずに
見送った項目は `docs/herdr-parity.md`「未検証のまま見送った項目」。

- **接続が黙って切れている間（TCP の半開き）に打った文字は、黙って消える**（decisions.md D95）。スマートフォンのスリープ・
  Wi-Fi とモバイル回線の切り替え・ノート PC のスリープ等で、接続が実際には切れているのにブラウザがまだ気づいていない間は、
  「再接続中…」が出ず、打った文字はどこにも届かない（サーバからのエコーが無いので画面にも出ない）。wtm は生存確認
  （WebSocket の ping 等のハートビート）を送らないので、気づくのはブラウザ・OS が切断を検知したとき（数十秒以上かかることが
  ある）。検知した後は「再接続中…」と「つながるまで入力できません」を重ねて出し、その間の入力を止める（溜めて後から送ることも
  しない。切断の瞬間をまたいで打てば、先頭が欠けることはある）。**スリープから戻った直後に打った文字が出なければ、ページを
  開き直す**。
- **新しい pane を作る操作の直後、IME で変換中だった文字は新しい pane へ流れない**（D99）。分割（`Ctrl+B v`・`Ctrl+B -`）・
  新しい tab（`c`）・新しい workspace（`N`）は、サーバが新しい pane を作って応答するまで（シェルの起動の確認の 300ms を含む）の
  間に打った文字を溜めて、新しい pane へ流す。ただし IME で変換中の（確定していない）文字は溜まらず、確定が新しい pane が
  できた後になると元の pane に入る。変換を確定してから操作するか、新しい pane が出てから打つ。
- **繋ぎ直した後・ページを開き直した後に戻らない端末のモード**（D107）：画面と scrollback はサーバのスナップショットで戻るが、
  スナップショットは次のモードを持たないので既定に戻る——カーソルの表示／非表示（`?25`）・マウス報告の SGR の形（`?1006`）・
  スクロール領域（DECSTBM）・カーソルの形（DECSCUSR）（ほかに文字集合・DECSC で保存したカーソルの位置）。そのため、カーソルを
  隠している TUI でカーソルが見える、マウス報告を SGR の形で受けるアプリ（vim 等）へ旧来の形で報告が届き、座標の大きい所
  （右端・下端の方）でずれる・誤読される、スクロール領域を使うアプリの次の描画が崩れる、ことがある。アプリが画面を描き直すか
  操作するまで続く（直らなければ、そのアプリを終えて起動し直す）。自動の再接続のたびに起こりうる。同じ理由で、OSC 8 のリンク
  （`ls --hyperlink` 等）も戻らず、ただの文字になる（design の AC8）。
- **タッチ端末（スマートフォン・タブレット）では、端末の中のリンクを開けない**（D110）。リンクは Ctrl（macOS は Cmd）を
  押しながらのクリックで開く（design M6。ただのクリックで開くと、アプリへのクリックや選択のつもりで開いてしまう）ので、修飾キーの
  無いタップでは開かない。長押し等の別の開き方は用意していない（ハードウェアキーボードの修飾キーを押しながらタップした場合は
  未確認）。開きたい URL は PC のブラウザから開く。
- **「この端末に合わせる」の食い違い**（D108）：
  - 押した状態は、スマートフォンの 1 列の画面（幅 768px 未満）が持つ。タブレットを回す・PC の窓の幅を変える等で 768px を
    またいでデスクトップの画面に替わってから戻ると、ボタンは押されていない表示に戻るが、サーバでは合わせたまま（PTY の大きさは
    この画面が決め続ける）。ページを開き直すと、どちらも「合わせない」から始まる。
  - 押している間でも、ほかの大きさを決められるクライアント（デスクトップのブラウザ・別の端末で押している人）がその tab で
    打つ・クリックする等の操作をすると、PTY はそちらの大きさになる。スマートフォンは押された表示のまま等倍で描くので、画面から
    はみ出す。スマートフォンで何か 1 文字打つと（押している間は、打つことも大きさを取る操作になる）、大きさを取り直して画面に
    収まる。

- **マウス報告を求めるアプリの上で Ctrl＋クリックすると、リンクを開くのと同時にクリックもアプリへ届く**（D110）。vim・less 等が
  マウス報告を有効にしている pane で、端末の中のリンクを Ctrl（macOS は Cmd）＋クリックすると、新しいタブが開くのと同時に、
  Ctrl を押したままの左クリックとしてアプリにも報告が届く（アプリによってはカーソルの移動・選択になる）。M7 の確認（マウス報告を
  有効にしたまま進める手順）の途中でも出会う。アプリを閉じてから開くか、URL を選んで PC のブラウザへ貼る。
- **スマートフォンでは「右クリックを pane に送る」にした pane のメニューを開けない**（D110）。メニューを常に開ける pane の枠
  （4px の縁）はデスクトップの画面にだけ出る。スマートフォンでこの設定にした pane は、マウスを使うアプリが動いている間、
  その pane のメニューを開けない（PC のブラウザから同じ pane のメニューを開いて「右クリックを herdr に戻す」を選ぶか、アプリを
  終える）。

- **macOS と Windows ネイティブでは、新しく開く場所の「引き継ぐ」が `cd` に追従しない（シェルが OSC 7 で知らせない限り）**
  （20260921-new-terminal-cwd の design D2・D4）。前面のプロセスの cwd を読めるのは Linux（WSL2 を含む）だけで、ほかの OS では
  シェルが OSC 7 で知らせた場所を使い、知らせなければ**元の pane を開いた場所**で開く（以前より元の pane に近い）。Windows の既定の
  `powershell.exe` は OSC 7 を出さない。macOS の zsh が出すかは `wtm serve` の起動のしかたによる（pane は `wtm serve` の環境変数を
  引き継ぐので、ターミナル.app から起動すると `TERM_PROGRAM` が渡り、`/etc/zshrc_Apple_Terminal` が出す。未検証）。`cd` した先で
  開きたければ、プロンプトで OSC 7 を出すようにするか、設定の「新しく開く場所」を「指定した場所」にする。確かめ方は「Windows ネイティブ
  （WSL2 の母艦の Windows で直接）」の cwd の項目。
- **Linux（WSL2 を含む）では、前面でプログラムが動いている間の「引き継ぐ」は、そのプログラムの場所になる**（エージェントならそれを
  起動した場所。前面のプロセスの cwd を読むため。20260921-new-terminal-cwd の design「ドメイン固有の考慮」）。シェルの場所で開きたければ、
  プログラムを終えてから作る。

ほかに、各節に書いた制約：xterm.js のモバイルの未解決課題（「実機（iOS Safari・Android Chrome。AC12）」の「既知の未解決課題」）・
リバースプロキシの無通信のタイムアウト（`docs/tls-setup.md`「リバースプロキシの後ろに置く」）。

## 未検証のまま見送った項目（`docs/herdr-parity.md` の対象外一覧とあわせて参照）

このリポジトリの自動テストと本 docs の手順のどちらでも確認しない項目は
`docs/herdr-parity.md`「未検証のまま見送った項目」にまとめてある（`ProcessMatcher` で意図的に省いた herdr の挙動・CJK IME の
候補窓の位置合わせ等）。copy モードの `0`・`^`・`$`・Home/End・`g`/`G`・`ctrl+b` は**実装していない**（意図して見送った。
decisions.md D63）ので、確かめる対象ではない（copy モードでは、`ctrl+b` 以外は押しても何も起きず、`ctrl+b` は
copy モードの中でも prefix になる）。M7・M11 のマウス報告は「Linux（CI・手元）」の
手元の項目で、IME の候補窓の見た目も同じ所で確かめる。
