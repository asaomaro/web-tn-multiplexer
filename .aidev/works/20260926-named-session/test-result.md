# テスト結果: 名前付き session（herdr の `--session <name>` 相当）

## 実行したもの

- `pnpm -s build` — exit 0 / `pnpm -s typecheck` — exit 0（build を先に。判定は終了コード）
- `npx eslint --ext .ts`（変更・追加した packages/server の 16 ファイル）— exit 0
- `pnpm -s test`（全パッケージ）1 回目 — 169 files / 3289 passed / 0 failed / 0 skipped（exit 0）
- `pnpm -s test`（全パッケージ）2 回目 — 169 files / 3289 passed / 0 failed / 0 skipped（exit 0）
- 負の確認（足した判定を 1 か所ずつ壊して、対応するテストファイルを走らせる。25 通り）— 25 通りすべてテストが落ちた。戻した後の `cmp` はすべて一致
- `aidev smoke`（3 本。3 本目はこの work で足した `wtm token reset --session`・`wtm session list`・`wtm session delete`）— pass
- ビルドした `wtm`（`packages/server/dist/main.js`）を実際に動かす手動の確認 — 下記「実物の CLI の確認」
- E2E（packages/e2e）は走らせていない（利用者の方針）

全体の 2 回の出力（末尾）:

```
$ pnpm -s test   # 1 回目
 Test Files  169 passed (169)
      Tests  3289 passed (3289)
$ pnpm -s test   # 2 回目
 Test Files  169 passed (169)
      Tests  3289 passed (3289)
```

## 受け入れ基準ごとの判定

- AC1: pass — `composeServer.integration.test.ts`「--session work は <state-dir>/sessions/work に状態を作り、既定の session の状態を読みも書きもしない…」。既定の session に目印の workspace・動いているロックを置き、work がそれを復元せず、`sessions/work` に wtm.lock・auth.json・session.json を作り、既定の 3 ファイルの内容と mtime が変わらないことを確かめた。実物でも起動時の表示の状態ディレクトリが `$d/sessions/work`（下記）。
- AC2: pass — `namedSession.test.ts` の規則の表（空・`.`・`..`・`/`・`\`・空白・改行・非 ASCII・65 文字・先頭 `-`・末尾 `.`・予約名 9 通り）、`config.test.ts`・`composeServer.integration.test.ts`（規則外は ConfigError で `readdir(base)` が空）・`sessionCommands.test.ts`（token reset・delete）。実物で `wtm serve --session ../x` が exit 2。
- AC3: pass — `resolveSessionStateDir(base, "default") === base`（`namedSession.test.ts`・`config.test.ts`）。
- AC4: pass — `resolveServeOptions({ stateDir: "/s", session: "work" }).stateDir === "/s/sessions/work"`（`config.test.ts`）。
- AC5: pass — 結合テストで同じ名前の 2 つ目が ConfigError（メッセージに `sessions/work`）、別の名前 `other` は別ポートで listen し、両方 listening。
- AC6: pass — `namedSession.test.ts`（名前順・規則外/default/ファイル/シンボリックリンクを除く・running と pid・別ホスト）、`sessionCommands.test.ts`（表と `--json`）。実物の `wtm session list` の出力は下記。
- AC7: pass — `namedSession.test.ts`（消す・running・default・not-found・規則外）、`sessionCommands.test.ts`（終了コード 0/1・`--json` の error）。実物で動いている session の delete が exit 1、止めた後の delete が exit 0。
- AC8: pass — `findExactEntry`（完全一致・綴り違いは spelling）、シンボリックリンクと普通のファイルは not-directory でリンク先が残る。
- AC9: pass — 既存のテスト（`config.test.ts`・`startupBanner.test.ts`・`cliArgs.test.ts`・結合テスト・smoke の 1・2 本目）が変更なしで通る。`--session` なしの状態ディレクトリは `resolveSessionStateDir(base, undefined) === base`。起動時の表示は `session` が無ければ既存の `toEqual` のまま。
- AC10: pass — `startupBanner.test.ts`（token の有無・URL 0 件のどれでも listening の次の行）。実物の表示は下記。
- AC11: pass — `docs/tls-setup.md`「名前付き session（`--session <名前>`…）」節、`docs/verification.md` の動かし方の注意と Windows の手動確認の項目、`docs/herdr-parity.md` H33 行（T9 の点検で実装との食い違い 3 件を直した）。
- AC12: pass — `sessionCommands.test.ts`「token reset --session work は work の auth.json だけを作り直し、既定の auth.json を変えない」（続けて同じ session のロックを取れる＝放している）、無い session は作らずに断る。smoke の 3 本目でも実物で確認。
- AC13: pass — `config.test.ts`（`listenFailureHint("EADDRINUSE")` と `stateDirInUseError(…, "serve")` に `--session <名前>`）。

## 負の確認（regression-negative-control）

足した判定を 1 か所ずつ壊し、対応するテストファイルだけを走らせた（`scratchpad/named-session/neg/mutate.py`。ファイルをコピーして書き換え→テスト→コピーから戻して `cmp`）。
生の出力（1 回目の実行。M18 は 1 回目の時点でパターンが実装の変更に追従していなかったので `PATTERN NOT FOUND` となり、直したパターンで M18・M26 を 2 回目に走らせた）:

```
### M1 名前 . と .. の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 45 passed (47)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "." は使えない（. と ..）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > ".." は使えない（. と ..）
### M2 先頭の - の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 46 passed (47)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "-x" は使えない（先頭）
### M3 末尾の . の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 46 passed (47)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "work." は使えない（末尾）
### M4 Windows の予約名の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  9 failed | 38 passed (47)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "con" は使えない（予約）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "NUL" は使えない（予約）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "Com1" は使えない（予約）
### M5 文字の規則に / を足す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  4 failed | 43 passed (47)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "../x" は使えない（文字）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "a/b" は使えない（文字）
    FAIL  src/persist/namedSession.test.ts > resolveSessionStateDir（状態ディレクトリの解決） > 規則外の名前は ConfigError（規則を案内に含める）
### M6 default を既定の session に読まない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 73 passed (75)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > --session が無い・default なら既定の状態ディレクトリ（今までどおり）で、sessionName は undefined
    FAIL  src/persist/namedSession.test.ts > resolveSessionStateDir（状態ディレクトリの解決） > 名前が無い・default なら既定の状態ディレクトリそのもの（今までどおり）
### M7 一覧でディレクトリかを見ない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 46 passed (47)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > 既定を先頭に名前順。規則外の名前・default・ファイル・シンボリックリンクは出さない。動いているものは pid つき
### M8 一覧で規則外の名前を除かない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 45 passed (47)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > 既定を先頭に名前順。規則外の名前・default・ファイル・シンボリックリンクは出さない。動いているものは pid つき
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は先に ~deleting- の名前へ移してから消す：消す途中で失敗しても元の名前は残らず（wtm.lock の無い半端な session を残さない）、remove-failed
### M9 削除の名前の一致を大文字小文字無視にする（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 46 passed (47)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > findExactEntry：完全一致だけを返し、別の綴りが当たる（lstat が成功する）なら spelling、無ければ not-found
### M10 削除でディレクトリかを見ない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 45 passed (47)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は普通のファイルを消さない（not-directory）
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete はシンボリックリンクを辿らず消さない（リンク先が残る）
### M11 削除でロックを取らない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 46 passed (47)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は動いている session を消さない（running）
### M12 削除で default を断らない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 54 passed (56)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > delete は消して終了コード 0、断ったら理由を標準エラーに出して終了コード 1（--json なら error の JSON）
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は default・存在しない名前を断り、規則外の名前は ConfigError
### M13 --session を無視する（src/config.ts）: exit=1 restored_cmp=一致
    Tests  3 failed | 25 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > --session work は <既定>/sessions/work、--state-dir D と併せると D/sessions/work
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 規則外の名前は ConfigError
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 案内は --state-dir を短くすることを示し、名前付き session のときだけ --session を短くすることも示す
### M14 socket のパス長の上限を 107 にする（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 公式フック連携の socket のパスが上限を超えると ConfigError（Linux は 108 バイトまで通す。macOS 等は 103）
### M15 EADDRINUSE の案内から --session を消す（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > listenFailureHint（待ち受けの失敗の案内。D102） > ポートが使用中：--port と、並行して動かすなら --state-dir も分けることを案内する
### M16 状態ディレクトリ使用中の案内から --session を消す（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > stateDirInUseError（同じ state-dir の二重起動。D103） > serve：使っている pid と、別の --state-dir を指定する案内・pid の再利用ならロックを消す案内
### M17 起動時の表示の session 行を消す（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
### M18 token reset の案内で session を無視する: PATTERN NOT FOUND in src/startupBanner.ts
### M19 --session を読まない（src/cliArgs.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 9 passed (11)
    FAIL  src/cliArgs.test.ts > parseArgs（CLI の引数） > --session を serve と token reset で読む（20260926-named-session）
    FAIL  src/cliArgs.test.ts > parseArgs（CLI の引数） > wtm session list / delete <name> を読む。--state-dir と --json だけ使える（20260926-named-session）
### M20 token reset で session を無視する（src/sessionCommands.ts）: exit=1 restored_cmp=一致
    Tests  4 failed | 5 passed (9)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset --session work は work の auth.json だけを作り直し、既定の auth.json を変えない
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset --session は無い session を作らずに断る（打ち間違い）
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset の規則外の名前は ConfigError で、何も作らない
### M21 delete の拒否を終了コード 0 にする（src/sessionCommands.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 8 passed (9)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > delete は消して終了コード 0、断ったら理由を標準エラーに出して終了コード 1（--json なら error の JSON）
### M23 削除で ~deleting- へ移さずその場で消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 46 passed (47)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は先に ~deleting- の名前へ移してから消す：消す途中で失敗しても元の名前は残らず（wtm.lock の無い半端な session を残さない）、remove-failed
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は先に ~deleting- の名前へ移してから消す：消す途中で失敗しても元の名前は残らず（wtm.lock の無い半端な session を残さない）、remove-failed
### M24 socket のパス長を検査しない（src/config.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 26 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 公式フック連携の socket のパスが上限を超えると ConfigError（Linux は 108 バイトまで通す。macOS 等は 103）
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 案内は --state-dir を短くすることを示し、名前付き session のときだけ --session を短くすることも示す
### M25 既定の session に --session の案内を出す（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 案内は --state-dir を短くすることを示し、名前付き session のときだけ --session を短くすることも示す
### M22 inspect で使用中の規則を見ない（src/persist/StateDirLock.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 63 passed (65)
    FAIL  src/persist/StateDirLock.test.ts > StateDirLock（状態ディレクトリの排他。D103） > inspect（読み取り専用の使用中の判定。20260926-named-session） > 持ち主が生きていなければ undefined（落ちたプロセスの残り）で、ロックを消さない
    FAIL  src/persist/StateDirLock.test.ts > StateDirLock（状態ディレクトリの排他。D103） > inspect（読み取り専用の使用中の判定。20260926-named-session） > 自分と同じ pid：このプロセスで持っていれば使用中、持っていなければ前に同じ pid で動いたプロセスの残り
$ python3 mutate.py M18 M26   # 2 回目
### M18 token reset の案内で session を無視する（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
### M26 token reset の案内に --state-dir を付けない（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
```

変異の後の作業ツリー: `git status --short` が変異の前と同じ（`diff` で差なし）。

## 起動確認（smoke）

3 本目（`wtm token reset --session`・`wtm session list`・`wtm session delete` をビルドした `wtm` で一巡）を `.aidev/config.yml` の `smokeCommands` に足した。

```
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/named-session/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-sj1GTU, sandboxed HOME /tmp/wtmctl-smoke-home-0ZcXj8
{"ts":"2026-09-26T07:49:26.846Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:37852
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: <略>
wtm: deleted session smoke (/tmp/tmp.kHU48RCZiK/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

## 実物の CLI の確認（ビルドした `packages/server/dist/main.js`。`$d` は一時ディレクトリ）

（出力は加工していないが、token の値だけは `<略>` に置き換えた。smoke の出力も同じ）

```
$ wtm serve --session work --state-dir $d --port 7931（起動時の表示）
wtm: listening on 127.0.0.1 port 7931 (http)
wtm: session work（状態ディレクトリ: $d/sessions/work）
wtm: open http://127.0.0.1:7931/#token=<略>
wtm: (token 付きの URL は今だけ表示します)
$ wtm session list --state-dir $d
name                 status   directory
default              stopped  $d
work                 running  $d/sessions/work (pid 293924)
exit=0
$ wtm session delete work --state-dir $d（動いている）
wtm: session work は動いています（pid 293924）。止めてから消してください
exit=1
$ （SIGTERM で止めた後）wtm session list --state-dir $d --json
{"sessions":[{"name":"default","default":true,"running":false,"stateDir":"$d"},{"name":"work","default":false,"running":false,"stateDir":"$d/sessions/work"}]}
exit=0
$ wtm serve --session ../x --state-dir $d
wtm: invalid session name: "../x" (使えない文字を含みます)
session の名前は 1〜64 文字の ASCII の英数字と . _ - だけで、. / .. ・先頭の - ・末尾の . ・Windows の予約名（con・nul・com1 等）は使えません。
exit=2
$ wtm token reset --session wrok --state-dir $d
wtm: no such session: wrok
session wrok はありません（$d/sessions/wrok）。wtm session list で名前を確かめてください（名前付き session を作るのは wtm serve --session wrok）。
exit=2
$ wtm serve --session <80文字> --state-dir $d
{"ts":"2026-09-26T07:49:51.719Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
wtm: listening on 127.0.0.1 port 7932 (http)
wtm: session xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx（状態ディレクトリ: $d/sessions/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx）
wtm: open http://127.0.0.1:7932/#token=<略>
wtm: (token 付きの URL は今だけ表示します)
wtm: received SIGTERM, shutting down
exit=0
$ wtm session delete work --state-dir $d
wtm: deleted session work ($d/sessions/work)
exit=0
$ ls $d $d/sessions
$d:
sessions

$d/sessions:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
$ wtm serve --session <64文字> --state-dir $d --port 7933
wtm: the state dir path is too long: $d/sessions/yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy/agent-report.sock is 111 bytes (max 108)
状態ディレクトリのパスが長すぎて、公式フック連携の socket を作れません。--session に短い名前を付けるか、--state-dir に短いパスを指定してください。
exit=2
$ ls $d
```

（60 文字の名前は `$d`＝`/tmp/tmp.XXXXXXXXXX` の下で socket のパスが 107 バイトになり、上限 108 の内側なので起動した——実際の listen で境界の内側が通ることの確認を兼ねる。64 文字は 111 バイトで exit 2、状態ディレクトリに何も作らない。）

## 失敗の証跡

このラウンドでは失敗が発生していない（test 工程での差し戻しは無し。coding 中の点検の指摘は review.md の「タスク点検ログ」、review からの差し戻しは review.md「ラウンド 1」）。ラウンド 2 でも失敗は発生していない。

## 未検証の穴（skip / 環境不足）

- **Windows ネイティブ・macOS では動かしていない**（手元は Linux／WSL2 相当）。Windows の予約名・末尾の `.` は OS に依らず断る実装なので単体テストで確かめたが、Windows での状態ディレクトリの作成・`wtm session delete` の rename・named pipe の名前の分離は未検証（`docs/verification.md` に手動確認の項目を足した）。**macOS の socket パスの上限 103 バイトは未確認**（Linux の 108 は実測）。
- シンボリックリンク・`chmod` を使う 3 件のテストは Windows・root では skip される（この環境では走った）。
- 削除中の競合（rename の前後で別の `wtm serve --session` が起動する）は、rename が原子的であることに依拠し、並行の実行では確かめていない（rm の途中の失敗で元の名前が残らないことは確かめた）。
- 大文字小文字を区別しない FS（macOS・Windows の既定）での綴り違いの削除拒否は、判定部分（`findExactEntry`）の単体テストだけで、実 FS では未確認。
- E2E は走らせていない（利用者の方針）。ブラウザ側は変更していない。

## ラウンド 2（review ラウンド 1 の差し戻し後。decisions D7）

- `pnpm -s build` exit 0 → `pnpm -s typecheck` exit 0、eslint（変更した 14 ファイル）exit 0、新規ファイルの `prettier --check` 通過
- `pnpm -s test` 2 回とも 169 files / 3291 passed / 0 failed / 0 skipped（+2 は古いロックの案内・シンボリックリンクの session の token reset）
- 負の確認: 差し戻しで変えた箇所（案内の引用・delete の古いロックの案内・token reset の stat）を M27〜M29 として足し、全 29 通りを流し直した。
  すべてテストが落ち、戻した後の `cmp` はすべて一致。1 回目で `PATTERN NOT FOUND` になった M24〜M26 はパターンを今の実装に合わせて流し直した。
- `aidev smoke` pass（3 本）

```
$ pnpm -s test   # ラウンド 2・1 回目
 Test Files  169 passed (169)
      Tests  3291 passed (3291)
$ pnpm -s test   # ラウンド 2・2 回目
 Test Files  169 passed (169)
      Tests  3291 passed (3291)
$ python3 mutate.py   # ラウンド 2（全 29 通り）
### M1 名前 . と .. の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 46 passed (48)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "." は使えない（. と ..）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > ".." は使えない（. と ..）
### M2 先頭の - の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 47 passed (48)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "-x" は使えない（先頭）
### M3 末尾の . の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 47 passed (48)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "work." は使えない（末尾）
### M4 Windows の予約名の禁止を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  9 failed | 39 passed (48)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "con" は使えない（予約）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "NUL" は使えない（予約）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "Com1" は使えない（予約）
### M5 文字の規則に / を足す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  4 failed | 44 passed (48)
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "../x" は使えない（文字）
    FAIL  src/persist/namedSession.test.ts > sessionNameProblem（名前の規則） > "a/b" は使えない（文字）
    FAIL  src/persist/namedSession.test.ts > resolveSessionStateDir（状態ディレクトリの解決） > 規則外の名前は ConfigError（規則を案内に含める）
### M6 default を既定の session に読まない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 74 passed (76)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > --session が無い・default なら既定の状態ディレクトリ（今までどおり）で、sessionName は undefined
    FAIL  src/persist/namedSession.test.ts > resolveSessionStateDir（状態ディレクトリの解決） > 名前が無い・default なら既定の状態ディレクトリそのもの（今までどおり）
### M7 一覧でディレクトリかを見ない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 47 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > 既定を先頭に名前順。規則外の名前・default・ファイル・シンボリックリンクは出さない。動いているものは pid つき
### M8 一覧で規則外の名前を除かない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 46 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > 既定を先頭に名前順。規則外の名前・default・ファイル・シンボリックリンクは出さない。動いているものは pid つき
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は先に ~deleting- の名前へ移してから消す：消す途中で失敗しても元の名前は残らず（wtm.lock の無い半端な session を残さない）、remove-failed
### M9 削除の名前の一致を大文字小文字無視にする（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 47 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > findExactEntry：完全一致だけを返し、別の綴りが当たる（lstat が成功する）なら spelling、無ければ not-found
### M10 削除でディレクトリかを見ない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 46 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は普通のファイルを消さない（not-directory）
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete はシンボリックリンクを辿らず消さない（リンク先が残る）
### M11 削除でロックを取らない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 46 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は落ちて残ったかもしれないロック（別のホスト）も消さずに断り、ロックの消し方を添える
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は動いている session を消さない（running）
### M12 削除で default を断らない（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 56 passed (58)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > delete は消して終了コード 0、断ったら理由を標準エラーに出して終了コード 1（--json なら error の JSON）
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は default・存在しない名前を断り、規則外の名前は ConfigError
### M13 --session を無視する（src/config.ts）: exit=1 restored_cmp=一致
    Tests  3 failed | 25 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > --session work は <既定>/sessions/work、--state-dir D と併せると D/sessions/work
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 規則外の名前は ConfigError
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 案内は --state-dir を短くすることを示し、名前付き session のときだけ --session を短くすることも示す
### M14 socket のパス長の上限を 107 にする（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 公式フック連携の socket のパスが上限を超えると ConfigError（Linux は 108 バイトまで通す。macOS 等は 103）
### M15 EADDRINUSE の案内から --session を消す（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > listenFailureHint（待ち受けの失敗の案内。D102） > ポートが使用中：--port と、並行して動かすなら --state-dir も分けることを案内する
### M16 状態ディレクトリ使用中の案内から --session を消す（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > stateDirInUseError（同じ state-dir の二重起動。D103） > serve：使っている pid と、別の --state-dir を指定する案内・pid の再利用ならロックを消す案内
### M17 起動時の表示の session 行を消す（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
### M18 token reset の案内で session を無視する（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
### M26 token reset の案内に --state-dir を付けない: PATTERN NOT FOUND in src/startupBanner.ts
### M19 --session を読まない（src/cliArgs.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 9 passed (11)
    FAIL  src/cliArgs.test.ts > parseArgs（CLI の引数） > --session を serve と token reset で読む（20260926-named-session）
    FAIL  src/cliArgs.test.ts > parseArgs（CLI の引数） > wtm session list / delete <name> を読む。--state-dir と --json だけ使える（20260926-named-session）
### M20 token reset で session を無視する（src/sessionCommands.ts）: exit=1 restored_cmp=一致
    Tests  5 failed | 5 passed (10)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset --session work は work の auth.json だけを作り直し、既定の auth.json を変えない
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset --session は無い session を作らずに断る（打ち間違い）
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset --session は wtm serve --session と同じくシンボリックリンクの session を辿る
### M21 delete の拒否を終了コード 0 にする（src/sessionCommands.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 9 passed (10)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > delete は消して終了コード 0、断ったら理由を標準エラーに出して終了コード 1（--json なら error の JSON）
### M23 削除で ~deleting- へ移さずその場で消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 47 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は先に ~deleting- の名前へ移してから消す：消す途中で失敗しても元の名前は残らず（wtm.lock の無い半端な session を残さない）、remove-failed
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は先に ~deleting- の名前へ移してから消す：消す途中で失敗しても元の名前は残らず（wtm.lock の無い半端な session を残さない）、remove-failed
### M24 socket のパス長を検査しない: PATTERN NOT FOUND in src/config.ts
### M25 既定の session に --session の案内を出す: PATTERN NOT FOUND in src/config.ts
### M27 案内のパスを引用しない（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
### M28 delete の使用中の案内から古いロックの消し方を消す（src/persist/namedSession.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 47 passed (48)
    FAIL  src/persist/namedSession.test.ts > listSessions・deleteSession（一覧と削除） > delete は落ちて残ったかもしれないロック（別のホスト）も消さずに断り、ロックの消し方を添える
### M29 token reset でシンボリックリンクを辿らない（src/sessionCommands.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 9 passed (10)
    FAIL  src/sessionCommands.test.ts > wtm session list / delete・wtm token reset --session（20260926-named-session） > token reset --session は wtm serve --session と同じくシンボリックリンクの session を辿る
### M22 inspect で使用中の規則を見ない（src/persist/StateDirLock.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 64 passed (66)
    FAIL  src/persist/StateDirLock.test.ts > StateDirLock（状態ディレクトリの排他。D103） > inspect（読み取り専用の使用中の判定。20260926-named-session） > 持ち主が生きていなければ undefined（落ちたプロセスの残り）で、ロックを消さない
    FAIL  src/persist/StateDirLock.test.ts > StateDirLock（状態ディレクトリの排他。D103） > inspect（読み取り専用の使用中の判定。20260926-named-session） > 自分と同じ pid：このプロセスで持っていれば使用中、持っていなければ前に同じ pid で動いたプロセスの残り
$ python3 mutate.py M24 M25 M26   # パターンを直して再実行
### M26 token reset の案内に --state-dir を付けない（src/startupBanner.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 5 passed (6)
    FAIL  src/startupBanner.test.ts > startupLines（起動時の表示。D101・D102・D103） > 名前付き session なら listening の次の行に session 名と状態ディレクトリを出す（20260926-named-session）
### M24 socket のパス長を検査しない（src/config.ts）: exit=1 restored_cmp=一致
    Tests  2 failed | 26 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 公式フック連携の socket のパスが上限を超えると ConfigError（Linux は 108 バイトまで通す。macOS 等は 103）
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 案内は --state-dir を短くすることを示し、名前付き session のときだけ --session を短くすることも示す
### M25 既定の session に --session の案内を出す（src/config.ts）: exit=1 restored_cmp=一致
    Tests  1 failed | 27 passed (28)
    FAIL  src/config.test.ts > resolveServeOptions の名前付き session（20260926-named-session） > 案内は --state-dir を短くすることを示し、名前付き session のときだけ --session を短くすることも示す
$ aidev smoke   # ラウンド 2（末尾）
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: <略>
wtm: deleted session smoke (/tmp/tmp.2Oh8sit1Hk/sessions/smoke)
smoke: pass (exit 0, 3 本)
```
