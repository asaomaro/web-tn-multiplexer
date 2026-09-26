# テスト結果: `wtmctl agent start`

## 実行したもの

機械の再起動の後に test 工程を再開したため、依存とビルドから取り直した。

- `pnpm install --frozen-lockfile` — exit 0
- `pnpm -s build` — exit 0
- `pnpm -s typecheck` — exit 0（build の後）
- `pnpm -s test` 1 回目（テストの追加前）— exit 0: 196 files / **3800 passed** / 0 failed / 0 skipped
- 負の確認（下の節）で、変異が全テストを通った 8 か所のうち 6 か所に対してテストを 5 本足した（server 3・cli 3。うち 1 本は既存の表の 1 行・1 本は既存の配列の 1 要素）
- `pnpm -s build` → `pnpm -s typecheck` — どちらも exit 0（追加の後）
- `pnpm -s test` 2 回目 — exit 0: 196 files / **3805 passed** / 0 failed / 0 skipped
- `pnpm -s test` 3 回目 — exit 0: 196 files / **3805 passed** / 0 failed / 0 skipped
- → 全体で連続 2 回（2・3 回目）通過。高負荷で落ちる既知のテストはこの回は 1 件も落ちなかった。
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 足した判定・表・分岐を 111 通り（M1〜M111）壊した。1 回目は 103 通りを検出、8 通りが全テストを通った → 6 通りはテストを足して検出、残る 2 通りは観測上等価（理由は下）。
- `aidev smoke` — pass（exit 0、3 本）。cli の smoke（2 本目 `pnpm --filter @wtm/cli run smoke`）に coding の T8 で `agent start` の確認（表に無い kind が使用誤り・エージェントの居る pane で `agent_pane_busy`、偽の `claude` が呼ばれないこと）を足してあるので、`.aidev/config.yml` の `smokeCommands` は変えていない。
- E2E（Playwright）は走らせていない（ユーザーの指示。ブラウザの画面は変えていない——`clientError.ts` の文言の表に 7 行足しただけ）。

## 受け入れ基準ごとの判定

- AC1: pass — `packages/cli/src/agentStart.integration.test.ts`（実サーバ・実 PTY の bash・PATH の先頭の偽の `claude`）で `runAgentStart` の出力の `name: "reviewer"`・`kind: "claude"`・検出から idle までの時間。smoke は配線だけ。
- AC2: pass — 同じ結合テストで `runAgentGet`（名前で引く）・`runAgentList`。
- AC3: pass — `SessionService.agentLaunch.test.ts`（予約中の `beginAgentLaunch`・`renameAgent` が `agent_name_taken`・`endAgentLaunch` の後に使える・別の種類の検出で予約が終わる・名前付きの後は外れない）・`AgentStarter.test.ts`（締め切り 30000 ms・指定値。フェイクタイマー）。
- AC4: pass — `AgentStarter.test.ts`（書式違反・live な名前との重複で `writeModal` を呼ばない）。
- AC5: pass — `cliArgs.agentStart.test.ts`（表に無い kind は `CliUsageError`）・`AgentStarter.test.ts`（`unsupported_agent_kind`・`__proto__`）・protocol `agentStart.test.ts`（22 種類・実行ファイル名の書式）・server `agentStart.test.ts`（全 kind で `lookupAgentKind(実行ファイル名) === kind`・集合が `AGENTS` と一致）。
- AC6: pass — `agentStart.test.ts`（`hasControlChar` の各文字。境界の U+001F を足した）・`AgentStarter.test.ts`（改行・CR・タブ・ESC・NUL・DEL・C1・4000 バイト超・**多バイト文字で 4000 バイト超**（足した）で `invalid_agent_argument`・書かない）。
- AC7: pass — `agentStart.shell.test.ts`（実物の bash・dash に `buildStartLine` の行を標準入力から与え、`node` が受け取る argv が一致・ファイルが作られない）・結合テスト（対話的な bash の継続行・dash の PTY で、偽の `claude` が記録した argv が `EVIL` の 18 個と一致し、`pwned1`〜`pwned6` が作られない）。zsh・ksh・mksh は未検証（下の穴）。
- AC8: pass — `AgentStarter.test.ts`（前面が別のグループ・シェル以外のメンバー・エージェント検出済み・予約中・再開の打ち込み待ち・null・reject・2000 ms の時間切れ・存在しない pane・**pane はあるが端末が無い**（足した））・結合テスト（`cat` の実行中の pane で `agent_pane_busy`・偽の `claude` が起動しない）。
- AC9: pass — `checkShell`（fish・pwsh・cmd・`-bash`・`/usr/bin/zsh`・`/bin/sh`・`.exe`・大文字）・`AgentStarter.test.ts`（`platform: "win32"`）。
- AC10: pass — 結合テスト（打ちかけの `echo LEFTOVER…` の後に start。bash〔readline〕・dash の両方で印のファイルが作られず argv が一致）。
- AC11: pass — `startInput` の単体テスト（Ctrl-C を別の部分・`\x05\x15`・bracketed paste の有無・CR）・`AgentStarter.test.ts`（書いたバイト列・200 ms の遅延）。
- AC12: pass — `agentStartWait.test.ts`（blocked → `agent_not_ready`）・`commands/agentStart.test.ts`（終了コード 1 の `RpcFailure`）。
- AC13: pass — `agentStartWait.test.ts`（unknown・working は pending、idle・done は ready）・`commands/agentStart.test.ts`。
- AC14: pass — `agentStartWait.test.ts`（種類違い・名前違い・null・入れ替わり・pane の close）・`commands/agentStart.test.ts`（締め切りで `timeout`・**応答の前の別の種類の検出では失敗しない・他の pane の検出を使わない**（足した））。
- AC15: pass — `cliArgs.agentStart.test.ts`（非整数・負数・`--` の後の `--kind` は引数）・`AgentStarter.test.ts`（3000・300001 → `invalid_agent_timeout`、省略で 30000）。
- AC16: pass — `commands/agentStart.test.ts`（busy を 2 回返した後に成功・2 秒 busy のままなら `agent_pane_busy`・100 ms の間隔）。
- AC17: pass（内容は review で読む）— `docs/wtmctl.md`（使い方・対応シェル・安全面・エラー code・herdr との違い）・`docs/herdr-parity.md` の H39。

`aidev coverage`: `ac=17 design=17/17(100%) tasks=17/17(100%) gaps=0`。

## 失敗の証跡

このラウンドでは失敗が発生していない（`pnpm -s test` の 3 回・build・typecheck・smoke はすべて exit 0）。負の確認で変異が通ったものは失敗ではなくテストの穴なので、下の「負の確認」節に生の出力を置く。

## 負の確認（足した判定・表・分岐を 1 つずつ壊す）

`scratchpad/neg/sweep.py`（セッションの scratchpad）が、1 か所を置き換え → 対応するテストファイルだけを vitest で走らせる（protocol と、結合テストに効く server の変異は `tsc -b` で dist を作り直してから）→ 元に戻して `cmp` で一致を確かめ、dist も作り直す、を行った。テスト集合は P＝protocol `agentStart.test.ts`、S＝server の新規 6 ファイル＋`SessionService.agentName.test.ts`、C＝cli の新規 3 ファイル、I＝cli の結合テスト（実 PTY）。各変異の生ログはスクリプトの `logs/<id>.log`。

### 1 回目（111 通り・テストの追加前）の出力（そのまま）

```
=== M1 packages/protocol/src/agentStart.ts: 'ms > AGENT_START_SETTLE_MS' -> 'ms >= AGENT_START_SETTLE_MS'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 3000 より大きく 300000 以下の整数だけ（herdr と同じ範囲） 4ms
    FAIL  src/agentStart.test.ts > isValidAgentStartTimeout > 3000 より大きく 300000 以下の整数だけ（herdr と同じ範囲）
    AssertionError: 3000: expected true to be false // Object.is equality
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M2 packages/protocol/src/agentStart.ts: 'ms <= AGENT_START_MAX_TIMEOUT_MS' -> 'ms < AGENT_START_MAX_TIMEOUT_MS'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 3000 より大きく 300000 以下の整数だけ（herdr と同じ範囲） 5ms
    FAIL  src/agentStart.test.ts > isValidAgentStartTimeout > 3000 より大きく 300000 以下の整数だけ（herdr と同じ範囲）
    AssertionError: 300000: expected false to be true // Object.is equality
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M3 packages/protocol/src/agentStart.ts: 'Number.isInteger(ms) && ' -> ''
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 3000 より大きく 300000 以下の整数だけ（herdr と同じ範囲） 4ms
    FAIL  src/agentStart.test.ts > isValidAgentStartTimeout > 3000 より大きく 300000 以下の整数だけ（herdr と同じ範囲）
    AssertionError: 3500.5: expected true to be false // Object.is equality
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M4 packages/protocol/src/agentStart.ts: 'Object.hasOwn(AGENT_START_EXECUTABLES, kind)' -> 'kind in AGENT_START_EXECUTABLES'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 表の kind だけを実行ファイル名に引く（別名・パス・継承したキーは null） 8ms
    FAIL  src/agentStart.test.ts > agentStartExecutable > 表の kind だけを実行ファイル名に引く（別名・パス・継承したキーは null）
    AssertionError: __proto__: expected { …(12) } to be null
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M5 packages/protocol/src/agentStart.ts: 'cursor: "cursor-agent"' -> 'cursor: "cursor"'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 表の kind だけを実行ファイル名に引く（別名・パス・継承したキーは null） 7ms
    FAIL  src/agentStart.test.ts > agentStartExecutable > 表の kind だけを実行ファイル名に引く（別名・パス・継承したキーは null）
    AssertionError: expected 'cursor' to be 'cursor-agent' // Object.is equality
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M6 packages/protocol/src/agentStart.ts: 'kiro: "kiro-cli"' -> 'kiro: "kiro"'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 表の kind だけを実行ファイル名に引く（別名・パス・継承したキーは null） 7ms
    FAIL  src/agentStart.test.ts > agentStartExecutable > 表の kind だけを実行ファイル名に引く（別名・パス・継承したキーは null）
    AssertionError: expected 'kiro' to be 'kiro-cli' // Object.is equality
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M7 packages/protocol/src/agentStart.ts: '  muse: "muse",\n' -> ''
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 22 種類で、実行ファイル名は英小文字・数字・'-' だけ（シェルに裸で出してよい） 7ms
    FAIL  src/agentStart.test.ts > agentStartExecutable > 22 種類で、実行ファイル名は英小文字・数字・'-' だけ（シェルに裸で出してよい）
    AssertionError: expected [ 'pi', 'claude', 'codex', …(18) ] to have a length of 22 but got 21
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M8 packages/protocol/src/agentStart.ts: '  muse: "muse",\n' -> '  muse: "muse",\n  evil: "rm -rf /",\n'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=1
    × 22 種類で、実行ファイル名は英小文字・数字・'-' だけ（シェルに裸で出してよい） 7ms
    FAIL  src/agentStart.test.ts > agentStartExecutable > 22 種類で、実行ファイル名は英小文字・数字・'-' だけ（シェルに裸で出してよい）
    AssertionError: expected [ 'pi', 'claude', 'codex', …(20) ] to have a length of 22 but got 23
    Test Files  1 failed (1)
    Tests  1 failed | 3 passed (4)
restored: cmp identical
DETECTED
=== M9 packages/protocol/src/agentStart.ts: 'AGENT_START_DEFAULT_TIMEOUT_MS = 30_000' -> 'AGENT_START_DEFAULT_TIMEOUT_MS = 20_000'
$ cd packages/protocol && npx vitest run src/agentStart.test.ts
exit=0
    Test Files  1 passed (1)
    Tests  4 passed (4)
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15） 10ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15）
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M10 packages/server/src/agent/agentStart.ts: '[\\u0000-\\u001f\\u007f-\\u009f]' -> '[\\u0001-\\u001f\\u007f-\\u009f]'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × C0・DEL・C1 を見つける（AC6） 9ms
    × NUL は { args: [ ' ' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 8ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > NUL は { args: [ ' ' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    FAIL  src/agent/agentStart.test.ts > hasControlChar > C0・DEL・C1 を見つける（AC6）
    AssertionError: "\u0000": expected false to be true // Object.is equality
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M11 packages/server/src/agent/agentStart.ts: '[\\u0000-\\u001f\\u007f-\\u009f]' -> '[\\u0000-\\u001e\\u007f-\\u009f]'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=0
    Test Files  7 passed (7)
    Tests  76 passed (76)
restored: cmp identical
NOT DETECTED
=== M12 packages/server/src/agent/agentStart.ts: '[\\u0000-\\u001f\\u007f-\\u009f]' -> '[\\u0000-\\u001f\\u0080-\\u009f]'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × C0・DEL・C1 を見つける（AC6） 17ms
    × DEL は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 6ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > DEL は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    FAIL  src/agent/agentStart.test.ts > hasControlChar > C0・DEL・C1 を見つける（AC6）
    AssertionError: "": expected false to be true // Object.is equality
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M13 packages/server/src/agent/agentStart.ts: '[\\u0000-\\u001f\\u007f-\\u009f]' -> '[\\u0000-\\u001f\\u007f-\\u009e]'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × C0・DEL・C1 を見つける（AC6） 9ms
    FAIL  src/agent/agentStart.test.ts > hasControlChar > C0・DEL・C1 を見つける（AC6）
    AssertionError: "": expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M14 packages/server/src/agent/agentStart.ts: '[\\u0000-\\u001f\\u007f-\\u009f]' -> '[\\u0000-\\u001f]'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × C0・DEL・C1 を見つける（AC6） 9ms
    × DEL は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 6ms
    × C1 は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 1ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > DEL は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > C1 は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    FAIL  src/agent/agentStart.test.ts > hasControlChar > C0・DEL・C1 を見つける（AC6）
    AssertionError: "": expected false to be true // Object.is equality
restored: cmp identical
DETECTED
=== M15 packages/server/src/agent/agentStart.ts: 's.replaceAll("\'", "\'\\\\\'\'")' -> 's.replaceAll("\'", "\\\\\'")'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 13ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 6ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 4ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 4ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 4ms
    × 全部の引数を単一引用符で包み、' は '\'' にする。実行ファイル名は裸（AC11） 9ms
    FAIL  src/agent/agentStart.shell.test.ts > 実物のシェル /bin/bash ["--norc","--noprofile"] > 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない
    FAIL  src/agent/agentStart.shell.test.ts > 実物のシェル /bin/bash ["--norc","--noprofile","-i"] > 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない
restored: cmp identical
DETECTED
=== M16 packages/server/src/agent/agentStart.ts: '`\'${s.replaceAll("\'", "\'\\\\\'\'")}\'`' -> '`"${s}"`'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 82ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 7ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 56ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 97ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 76ms
    × 全部の引数を単一引用符で包み、' は '\'' にする。実行ファイル名は裸（AC11） 12ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 23ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
restored: cmp identical
DETECTED
=== M17 packages/server/src/agent/agentStart.ts: '...args.map(quotePosixArg)' -> '...args'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 13ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 6ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 5ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 5ms
    × 悪意のある引数がそのまま 1 つずつ届き、副作用が起きない 9ms
    × 全部の引数を単一引用符で包み、' は '\'' にする。実行ファイル名は裸（AC11） 11ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 26ms
    × 4000 バイト超の行 は { args: [Array] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 2ms
restored: cmp identical
DETECTED
=== M18 packages/server/src/agent/agentStart.ts: '    .replace(/^-+/, "")\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × パス・login シェルの - ・.exe・大文字を正規化する（AC9） 9ms
    × 前面がシェル自身だけの POSIX 系シェルは available 5ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > パス・login シェルの - ・.exe・大文字を正規化する（AC9）
    AssertionError: expected '-bash' to be 'bash' // Object.is equality
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > 前面がシェル自身だけの POSIX 系シェルは available
    AssertionError: -bash: expected { kind: 'busy' } to deeply equal { kind: 'available', shell: '-bash' }
    Test Files  1 failed | 6 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M19 packages/server/src/agent/agentStart.ts: '    .replace(/\\.exe$/i, "")\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × パス・login シェルの - ・.exe・大文字を正規化する（AC9） 13ms
    × POSIX 以外の既知のシェルは unsupported（AC9） 6ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > パス・login シェルの - ・.exe・大文字を正規化する（AC9）
    AssertionError: expected 'cmd.exe' to be 'cmd' // Object.is equality
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > POSIX 以外の既知のシェルは unsupported（AC9）
    AssertionError: powershell.exe: expected { kind: 'busy' } to deeply equal { kind: 'unsupported', …(1) }
    Test Files  1 failed | 6 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M20 packages/server/src/agent/agentStart.ts: '    .toLowerCase();' -> '    ;'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × パス・login シェルの - ・.exe・大文字を正規化する（AC9） 11ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > パス・login シェルの - ・.exe・大文字を正規化する（AC9）
    AssertionError: expected 'PWSH' to be 'pwsh' // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M21 packages/server/src/agent/agentStart.ts: 'exe.lastIndexOf("/"), ' -> '-1, '
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × パス・login シェルの - ・.exe・大文字を正規化する（AC9） 8ms
    × 前面がシェル自身だけの POSIX 系シェルは available 5ms
    × POSIX 以外の既知のシェルは unsupported（AC9） 2ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 21ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 2ms
    × 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15） 1ms
    × 4000 バイトちょうどの行は受け付ける（上限の境界） 1ms
    × 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない 11ms
restored: cmp identical
DETECTED
=== M22 packages/server/src/agent/agentStart.ts: 'exe.lastIndexOf("\\\\")' -> '-1'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × パス・login シェルの - ・.exe・大文字を正規化する（AC9） 13ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > パス・login シェルの - ・.exe・大文字を正規化する（AC9）
    AssertionError: expected 'c:\windows\system32\cmd' to be 'cmd' // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M23 packages/server/src/agent/agentStart.ts: 'job === null || job.processGroupId !== shellPid' -> 'job === null'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8） 14ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8）
    AssertionError: expected { kind: 'available', shell: 'bash' } to deeply equal { kind: 'busy' }
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M24 packages/server/src/agent/agentStart.ts: 'if (job.processes.some((p) => p.pid !== shellPid)) return { kind: "busy" };' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8） 17ms
    × シェルのグループに別のプロセスがいる なら agent_pane_busy で何も書かない（AC8） 10ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > シェルのグループに別のプロセスがいる なら agent_pane_busy で何も書かない（AC8）
    Error: expected an RpcError
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8）
    AssertionError: expected { kind: 'available', shell: 'bash' } to deeply equal { kind: 'busy' }
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M25 packages/server/src/agent/agentStart.ts: '  if (OTHER_SHELLS.has(name)) return { kind: "unsupported", shell: name };\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × POSIX 以外の既知のシェルは unsupported（AC9） 10ms
    × 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9） 11ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9）
    AssertionError: expected 'agent_pane_busy' to be 'unsupported_agent_shell' // Object.is equality
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > POSIX 以外の既知のシェルは unsupported（AC9）
    AssertionError: fish: expected { kind: 'busy' } to deeply equal { kind: 'unsupported', shell: 'fish' }
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M26 packages/server/src/agent/agentStart.ts: '  if (shell === undefined) return { kind: "busy" };\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8） 5ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8）
    TypeError: Cannot read properties of undefined (reading 'exe')
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M27 packages/server/src/agent/agentStart.ts: '  return { kind: "busy" };\n}\n\n/** 実行ファイル名' -> '  return { kind: "available", shell: name };\n}\n\n/** 実行ファイル名'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8） 19ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > 取得できない・前面が別のグループ・シェル以外のメンバー・シェルが居ない・シェルでない名前は busy（AC8）
    AssertionError: expected { kind: 'available', shell: 'vim' } to deeply equal { kind: 'busy' }
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M28 packages/server/src/agent/agentStart.ts: '  "dash",\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 前面がシェル自身だけの POSIX 系シェルは available 16ms
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > 前面がシェル自身だけの POSIX 系シェルは available
    AssertionError: /usr/bin/dash: expected { kind: 'busy' } to deeply equal { kind: 'available', shell: 'dash' }
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M29 packages/server/src/agent/agentStart.ts: '  "mksh",\n]);' -> '  "mksh",\n  "fish",\n]);'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × POSIX 以外の既知のシェルは unsupported（AC9） 16ms
    × 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9） 7ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9）
    Error: expected an RpcError
    FAIL  src/agent/agentStart.test.ts > shellNameOf / checkShell > POSIX 以外の既知のシェルは unsupported（AC9）
    AssertionError: fish: expected { kind: 'available', shell: 'fish' } to deeply equal { kind: 'unsupported', shell: 'fish' }
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M30 packages/server/src/agent/agentStart.ts: '[INTERRUPT, `${LINE_CLEAR}' -> '[`${LINE_CLEAR}'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 20ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 32ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 7ms
    × 4000 バイトちょうどの行は受け付ける（上限の境界） 9ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ Array(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11）
    AssertionError: expected [ Array(1) ] to deeply equal [ '\u0003', …(1) ]
restored: cmp identical
DETECTED
=== M31 packages/server/src/agent/agentStart.ts: '[INTERRUPT, `${LINE_CLEAR}' -> '[`${INTERRUPT}${LINE_CLEAR}'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 11ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 18ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 3ms
    × 4000 バイトちょうどの行は受け付ける（上限の境界） 4ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ Array(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11）
    AssertionError: expected [ Array(1) ] to deeply equal [ '\u0003', …(1) ]
restored: cmp identical
DETECTED
=== M32 packages/server/src/agent/agentStart.ts: 'LINE_CLEAR = "\\u0005\\u0015"' -> 'LINE_CLEAR = "\\u0015"'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 8ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 22ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 3ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/agentStart.test.ts > startInput > Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11）
restored: cmp identical
DETECTED
=== M33 packages/server/src/agent/agentStart.ts: 'LINE_CLEAR = "\\u0005\\u0015"' -> 'LINE_CLEAR = "\\u0005"'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 10ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 20ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 3ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/agentStart.test.ts > startInput > Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11）
restored: cmp identical
DETECTED
=== M34 packages/server/src/agent/agentStart.ts: 'bracketedPaste)}\\r`' -> 'bracketedPaste)}\\n`'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 13ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 33ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 5ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/agentStart.test.ts > startInput > Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11）
restored: cmp identical
DETECTED
=== M35 packages/server/src/agent/agentStart.ts: 'pastePayload(line, bracketedPaste)' -> 'pastePayload(line, false)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 11ms
    × bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11） 12ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > bracketed paste が有効ならコマンド行を貼り付けで包む。kind が cursor なら cursor-agent（AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    FAIL  src/agent/agentStart.test.ts > startInput > Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11）
    AssertionError: expected [ '\u0003', …(1) ] to deeply equal [ '\u0003', …(1) ]
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M36 packages/server/src/agent/agentStart.ts: 'MAX_START_LINE_BYTES = 4000' -> 'MAX_START_LINE_BYTES = 40000'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 4000 バイト超の行 は { args: [Array] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 6ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 4000 バイト超の行 は { args: [Array] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M37 packages/server/src/agent/agentStart.ts: 'START_INTERRUPT_DELAY_MS = 200' -> 'START_INTERRUPT_DELAY_MS = 0'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11） 11ms
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 33ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ +0 ] to deeply equal [ 200 ]
    FAIL  src/agent/agentStart.test.ts > startInput > Ctrl-C を別の部分で送り、次に打ちかけの消去・コマンド行・CR。bracketed paste が有効なら貼り付けで包む（AC11）
    AssertionError: expected +0 to be 200 // Object.is equality
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M38 packages/server/src/agent/AgentStarter.ts: 'if (!isValidAgentName(name))' -> 'if (false)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 名前の書式違反 は { name: 'Reviewer' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 11ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 名前の書式違反 は { name: 'Reviewer' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M39 packages/server/src/agent/AgentStarter.ts: 'if (executable === null)' -> 'if (false)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 表に無い kind は { kind: 'sh' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 11ms
    × 別名の kind は { kind: 'claude-code' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 3ms
    × 継承したキーの kind は { kind: '__proto__' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 2ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 表に無い kind は { kind: 'sh' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 別名の kind は { kind: 'claude-code' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 継承したキーの kind は { kind: '__proto__' }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
restored: cmp identical
DETECTED
=== M40 packages/server/src/agent/AgentStarter.ts: 'if (args.some(hasControlChar))' -> 'if (false)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 改行 は { args: [ 'ok', 'a
    × CR は { args: [ 'a
    × タブ は { args: [ 'a	b' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 1ms
    × ESC は { args: [ '[201~' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 1ms
    × NUL は { args: [ ' ' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 1ms
    × DEL は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 1ms
    × C1 は { args: [ '' ] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 1ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 改行 は { args: [ 'ok', 'a
restored: cmp identical
DETECTED
=== M41 packages/server/src/agent/AgentStarter.ts: 'params.timeoutMs ?? AGENT_START_DEFAULT_TIMEOUT_MS' -> 'params.timeoutMs ?? 20_000'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15） 9ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15）
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M42 packages/server/src/agent/AgentStarter.ts: 'if (!isValidAgentStartTimeout(timeoutMs))' -> 'if (false)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × timeout 3000 は { timeoutMs: 3000 }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 6ms
    × timeout 300001 は { timeoutMs: 300001 }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 3ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > timeout 3000 は { timeoutMs: 3000 }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > timeout 300001 は { timeoutMs: 300001 }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M43 packages/server/src/agent/AgentStarter.ts: 'Buffer.byteLength(line, "utf8") > MAX_START_LINE_BYTES' -> 'line.length > MAX_START_LINE_BYTES'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=0
    Test Files  7 passed (7)
    Tests  76 passed (76)
restored: cmp identical
NOT DETECTED
=== M44 packages/server/src/agent/AgentStarter.ts: 'Buffer.byteLength(line, "utf8") > MAX_START_LINE_BYTES' -> 'Buffer.byteLength(line, "utf8") >= MAX_START_LINE_BYTES'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 4000 バイトちょうどの行は受け付ける（上限の境界） 11ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 4000 バイトちょうどの行は受け付ける（上限の境界）
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M45 packages/server/src/agent/AgentStarter.ts: '    this.opts.session.assertAgentNameAvailable(name, null);\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × live な名前・予約との重複は agent_name_taken で何も書かない（AC4） 10ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > live な名前・予約との重複は agent_name_taken で何も書かない（AC4）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M46 packages/server/src/agent/AgentStarter.ts: 'this.platform === "win32"' -> 'false'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9） 10ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M47 packages/server/src/agent/AgentStarter.ts: '    if (shell.kind === "busy") throw busy(paneId);\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 前面が sleep なら agent_pane_busy で何も書かない（AC8） 5ms
    × 前面が取得できない（null） なら agent_pane_busy で何も書かない（AC8） 1ms
    × 前面の取得が reject なら agent_pane_busy で何も書かない（AC8） 2ms
    × シェルのグループに別のプロセスがいる なら agent_pane_busy で何も書かない（AC8） 1ms
    × 前面の取得が上限（2000 ms）を過ぎても返らなければ agent_pane_busy（AC8） 3ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面が sleep なら agent_pane_busy で何も書かない（AC8）
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面が取得できない（null） なら agent_pane_busy で何も書かない（AC8）
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面の取得が reject なら agent_pane_busy で何も書かない（AC8）
restored: cmp identical
DETECTED
=== M48 packages/server/src/agent/AgentStarter.ts: '    if (shell.kind === "unsupported") {' -> '    if (false) {'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9） 7ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 対応外のシェル（fish・pwsh）と Windows のサーバは unsupported_agent_shell で何も書かない（AC9）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M49 packages/server/src/agent/AgentStarter.ts: '    if (current !== host) throw busy(paneId);\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない 10ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M50 packages/server/src/agent/AgentStarter.ts: 'const current = this.requireIdlePane(paneId);' -> 'const current = host;'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない 9ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M51 packages/server/src/agent/AgentStarter.ts: '          if (this.opts.session.getPane(paneId)?.agent !== null) throw busy(paneId);\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 書く直前（他の入力の後ろで待った後）にエージェントが検出されていたら何も書かず、予約を解いて agent_pane_busy 6ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前（他の入力の後ろで待った後）にエージェントが検出されていたら何も書かず、予約を解いて agent_pane_busy
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M52 packages/server/src/agent/AgentStarter.ts: '      this.opts.session.endAgentLaunch(paneId, token);\n      if (err' -> '      if (err'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 書く直前（他の入力の後ろで待った後）にエージェントが検出されていたら何も書かず、予約を解いて agent_pane_busy 16ms
    × 書き込みが失敗したら予約を解いて agent_start_input_failed 2ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前（他の入力の後ろで待った後）にエージェントが検出されていたら何も書かず、予約を解いて agent_pane_busy
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'p1', 7 ]
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書き込みが失敗したら予約を解いて agent_start_input_failed
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'p1', 7 ]
    Test Files  1 failed | 6 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M53 packages/server/src/agent/AgentStarter.ts: '      if (err instanceof RpcError) throw err;\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 書く直前（他の入力の後ろで待った後）にエージェントが検出されていたら何も書かず、予約を解いて agent_pane_busy 10ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前（他の入力の後ろで待った後）にエージェントが検出されていたら何も書かず、予約を解いて agent_pane_busy
    AssertionError: expected 'agent_start_input_failed' to be 'agent_pane_busy' // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M54 packages/server/src/agent/AgentStarter.ts: 'endAgentLaunch(paneId, token), timeoutMs)' -> 'endAgentLaunch(paneId, token), timeoutMs * 2)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15） 15ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 締め切り（既定 30000 ms・指定値）で予約を解く（AC3・AC15）
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'p1', 7 ]
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M55 packages/server/src/agent/AgentStarter.ts: 'if (pane.agent !== null || session.hasAgentLaunch(paneId) || session.hasPendingResume(paneId))' -> 'if (session.hasAgentLaunch(paneId) || session.hasPendingResume(paneId))'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × エージェントが検出されている なら agent_pane_busy で何も書かない（AC8） 10ms
    × 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない 2ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > エージェントが検出されている なら agent_pane_busy で何も書かない（AC8）
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    Test Files  1 failed | 6 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M56 packages/server/src/agent/AgentStarter.ts: 'if (pane.agent !== null || session.hasAgentLaunch(paneId) || session.hasPendingResume(paneId))' -> 'if (pane.agent !== null || session.hasPendingResume(paneId))'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 同じ pane で起動中 なら agent_pane_busy で何も書かない（AC8） 5ms
    × 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない 6ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 同じ pane で起動中 なら agent_pane_busy で何も書かない（AC8）
    Error: expected an RpcError
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面を待つ間にエージェントが現れた・起動が入った・pane が閉じたら書かない
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M57 packages/server/src/agent/AgentStarter.ts: 'if (pane.agent !== null || session.hasAgentLaunch(paneId) || session.hasPendingResume(paneId))' -> 'if (pane.agent !== null || session.hasAgentLaunch(paneId))'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 復元で打ち込んだ会話の再開がまだ検出されていない なら agent_pane_busy で何も書かない（AC8） 6ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 復元で打ち込んだ会話の再開がまだ検出されていない なら agent_pane_busy で何も書かない（AC8）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M58 packages/server/src/agent/AgentStarter.ts: 'if (!pane || !host)' -> 'if (!pane)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=0
    Test Files  7 passed (7)
    Tests  76 passed (76)
restored: cmp identical
NOT DETECTED
=== M59 packages/server/src/agent/AgentStarter.ts: 'setTimeout(() => resolve(null), this.inspectTimeoutMs)' -> 'setTimeout(() => {}, this.inspectTimeoutMs)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 前面の取得が上限（2000 ms）を過ぎても返らなければ agent_pane_busy（AC8） 5015ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面の取得が上限（2000 ms）を過ぎても返らなければ agent_pane_busy（AC8）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M60 packages/server/src/agent/AgentStarter.ts: '        () => {\n          clearTimeout(timer);\n          resolve(null);' -> '        () => {\n          clearTimeout(timer);\n          resolve({ processGroupId: pid, processes: [{ pid, exe: "bash" }] } as ForegroundJob);'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 前面の取得が reject なら agent_pane_busy で何も書かない（AC8） 13ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 前面の取得が reject なら agent_pane_busy で何も書かない（AC8）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M61 packages/server/src/agent/AgentStarter.ts: 'argv: [executable, ...args]' -> 'argv: args'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 40ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected { Object (paneId, name, ...) } to deeply equal { Object (paneId, name, ...) }
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M62 packages/server/src/agent/AgentStarter.ts: 'delayMs: START_INTERRUPT_DELAY_MS' -> 'delayMs: 0'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11） 40ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 空いている bash に、Ctrl-C の 200 ms 後に打ちかけの消去・固定の実行ファイル名・包んだ引数・CR を書き、予約して返す（AC1・AC11）
    AssertionError: expected [ +0 ] to deeply equal [ 200 ]
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M63 packages/server/src/session/SessionService.ts: '    if (patch.agent) this.resumeWrittenAt.delete(paneId);\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × エージェントが検出されたら false 17ms
    FAIL  src/session/SessionService.resumePending.test.ts > SessionService — hasPendingResume > エージェントが検出されたら false
    AssertionError: expected true to be false // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M64 packages/server/src/session/SessionService.ts: 'if (launch && patch.agent && patch.agent.instanceId !== pane.agent?.instanceId)' -> 'if (launch && patch.agent)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 同じ instanceId の反映（既に居るエージェントの状態の更新）では予約を終えない 16ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 同じ instanceId の反映（既に居るエージェントの状態の更新）では予約を終えない
    AssertionError: expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M65 packages/server/src/session/SessionService.ts: 'if (patch.agent.kind === launch.kind && this.agentNameHolder' -> 'if (this.agentNameHolder'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 別の種類が検出されると予約だけ終わり、名前は付かず、同じ名前をすぐ使える（AC3） 28ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 別の種類が検出されると予約だけ終わり、名前は付かず、同じ名前をすぐ使える（AC3）
    AssertionError: expected 'reviewer' to be undefined
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M66 packages/server/src/session/SessionService.ts: ' && this.agentNameHolder(launch.name, paneId) === null) {' -> ') {'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 予約中に同じ名前が他で live になっていたら、種類が合っても名前は付けず予約だけ終える 23ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約中に同じ名前が他で live になっていたら、種類が合っても名前は付けず予約だけ終える
    AssertionError: expected 'reviewer' to be undefined
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M67 packages/server/src/session/SessionService.ts: '      this.agentLaunches.delete(paneId);\n      if (patch.agent.kind' -> '      if (patch.agent.kind'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 期待の種類が新しく検出されると、その 1 回の反映・1 回の発行で予約の名前が付き、予約は終わる（AC3） 30ms
    × 別の種類が検出されると予約だけ終わり、名前は付かず、同じ名前をすぐ使える（AC3） 13ms
    × 予約中に同じ名前が他で live になっていたら、種類が合っても名前は付けず予約だけ終える 8ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 期待の種類が新しく検出されると、その 1 回の反映・1 回の発行で予約の名前が付き、予約は終わる（AC3）
    AssertionError: expected true to be false // Object.is equality
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 別の種類が検出されると予約だけ終わり、名前は付かず、同じ名前をすぐ使える（AC3）
    AssertionError: expected true to be false // Object.is equality
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約中に同じ名前が他で live になっていたら、種類が合っても名前は付けず予約だけ終える
restored: cmp identical
DETECTED
=== M68 packages/server/src/session/SessionService.ts: 'p.agent?.name === name || this.agentLaunches.get(p.id)?.name === name' -> 'p.agent?.name === name'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4） 25ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M69 packages/server/src/session/SessionService.ts: 'p.agent?.name === name || this.agentLaunches.get(p.id)?.name === name' -> 'this.agentLaunches.get(p.id)?.name === name'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 他のエージェントが使っている名前は agent_name_taken で、どちらも変えない（AC4） 17ms
    × 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4） 30ms
    × 予約中に同じ名前が他で live になっていたら、種類が合っても名前は付けず予約だけ終える 12ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4）
    Error: expected an RpcError
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約中に同じ名前が他で live になっていたら、種類が合っても名前は付けず予約だけ終える
    AssertionError: expected 'reviewer' to be undefined
    FAIL  src/session/SessionService.agentName.test.ts > SessionService — エージェントの名前 > 他のエージェントが使っている名前は agent_name_taken で、どちらも変えない（AC4）
restored: cmp identical
DETECTED
=== M70 packages/server/src/session/SessionService.ts: '      if (p.id === exceptPaneId) continue;\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × rename の検査は自分の pane を除く（同じ名前の付け直しは成功） 25ms
    × 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4） 25ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > rename の検査は自分の pane を除く（同じ名前の付け直しは成功）
    FAIL  src/session/SessionService.agentName.test.ts > SessionService — エージェントの名前 > 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4）
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M71 packages/server/src/session/SessionService.ts: '    if (this.agentLaunches.has(paneId)) throw new RpcError("agent_pane_busy"' -> '    if (false) throw new RpcError("agent_pane_busy"'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4） 28ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M72 packages/server/src/session/SessionService.ts: '    this.assertAgentNameAvailable(name, null);\n    const token' -> '    const token'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4） 31ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 予約した名前は別の起動・rename に使えず、live な名前・書式違反も予約できない（AC3・AC4）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M73 packages/server/src/session/SessionService.ts: 'if (this.agentLaunches.get(paneId)?.token === token)' -> 'if (this.agentLaunches.has(paneId))'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 締め切りで予約を解くと同じ名前を使える。古い印では新しい予約を解かない（AC3） 30ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > 締め切りで予約を解くと同じ名前を使える。古い印では新しい予約を解かない（AC3）
    AssertionError: expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M74 packages/server/src/session/SessionService.ts: 'this.clock.now() - at <= RESUME_PENDING_MS' -> 'this.clock.now() - at < 0'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 再開コマンドを打ち込んだ pane は 30 秒の間 true で、過ぎたら false。打ち込んでいない pane は false 53ms
    FAIL  src/session/SessionService.resumePending.test.ts > SessionService — hasPendingResume > 再開コマンドを打ち込んだ pane は 30 秒の間 true で、過ぎたら false。打ち込んでいない pane は false
    AssertionError: expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M75 packages/server/src/session/SessionService.ts: 'const RESUME_PENDING_MS = 30_000;' -> 'const RESUME_PENDING_MS = 3_000;'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 再開コマンドを打ち込んだ pane は 30 秒の間 true で、過ぎたら false。打ち込んでいない pane は false 33ms
    FAIL  src/session/SessionService.resumePending.test.ts > SessionService — hasPendingResume > 再開コマンドを打ち込んだ pane は 30 秒の間 true で、過ぎたら false。打ち込んでいない pane は false
    AssertionError: expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M76 packages/server/src/session/SessionService.ts: '    this.resumeWrittenAt.set(paneId, this.clock.now());\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 再開コマンドを打ち込んだ pane は 30 秒の間 true で、過ぎたら false。打ち込んでいない pane は false 37ms
    FAIL  src/session/SessionService.resumePending.test.ts > SessionService — hasPendingResume > 再開コマンドを打ち込んだ pane は 30 秒の間 true で、過ぎたら false。打ち込んでいない pane は false
    AssertionError: expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M77 packages/server/src/session/SessionService.ts: 'if (name !== null) this.assertAgentNameAvailable(name, paneId);' -> 'if (name !== null) this.assertAgentNameAvailable(name, null);'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × rename の検査は自分の pane を除く（同じ名前の付け直しは成功） 26ms
    × 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4） 25ms
    FAIL  src/session/SessionService.agentLaunch.test.ts > SessionService — agent start の名前の予約 > rename の検査は自分の pane を除く（同じ名前の付け直しは成功）
    FAIL  src/session/SessionService.agentName.test.ts > SessionService — エージェントの名前 > 同じエージェントへの同じ名前の付け直し・名前なしへの null は成功し、発行しない（AC4）
    Test Files  2 failed | 5 passed (7)
    Tests  2 failed | 74 passed (76)
restored: cmp identical
DETECTED
=== M78 packages/server/src/session/SessionService.ts: '    this.resumeWrittenAt.delete(paneId);\n    return false;' -> '    return false;'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=0
    Test Files  7 passed (7)
    Tests  76 passed (76)
restored: cmp identical
NOT DETECTED
=== M79 packages/server/src/surface/methods/agent.ts: '        deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);\n' -> ''
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 打ち込む前に操作したクライアントを記録し、引数をそのまま AgentStarter.start へ渡して結果を返す 77ms
    FAIL  src/surface/methods/agentStart.test.ts > agent.start > 打ち込む前に操作したクライアントを記録し、引数をそのまま AgentStarter.start へ渡して結果を返す
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'c1', 'p1' ]
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 75 passed (76)
restored: cmp identical
DETECTED
=== M80 packages/server/src/surface/methods/agent.ts: '  if (starter) {' -> '  if (false) {'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 打ち込む前に操作したクライアントを記録し、引数をそのまま AgentStarter.start へ渡して結果を返す 46ms
    × AgentStarter の RpcError はその code で返る（AC8） 7ms
    × 引数の型が合わなければ invalid_params で AgentStarter を呼ばない 15ms
    FAIL  src/surface/methods/agentStart.test.ts > agent.start > 打ち込む前に操作したクライアントを記録し、引数をそのまま AgentStarter.start へ渡して結果を返す
    AssertionError: expected { ok: false, error: { …(2) } } to deeply equal { ok: true, …(1) }
    FAIL  src/surface/methods/agentStart.test.ts > agent.start > AgentStarter の RpcError はその code で返る（AC8）
    AssertionError: expected { ok: false, error: { …(2) } } to deeply equal { ok: false, error: { …(2) } }
    FAIL  src/surface/methods/agentStart.test.ts > agent.start > 引数の型が合わなければ invalid_params で AgentStarter を呼ばない
restored: cmp identical
DETECTED
=== M81 packages/server/src/composeServer.ts: 'gitPoller, agentStarter });' -> 'gitPoller });'
$ cd packages/cli && npx vitest run src/agentStart.integration.test.ts
exit=1
    × 継続行（引用符が開いたまま）の bash に悪意のある引数で起動しても、引数はそのまま届き副作用は無く、名前付きの idle で返る（AC1・AC2・AC7・AC10） 1870ms
    × 打ちかけの行がある dash でも打ちかけは実行されず、起動した引数は渡したものだけ（AC7・AC10） 1041ms
    × 打ちかけの行がある bash（readline）でも打ちかけは実行されず、起動した引数は渡したものだけ（AC10） 636ms
    × 前面がシェル以外（cat の実行中）の pane には何も打ち込まず agent_pane_busy（AC8） 1338ms
    FAIL  src/agentStart.integration.test.ts > wtmctl agent start integration（実 PTY の bash／dash・偽の claude・実際の検出） > 継続行（引用符が開いたまま）の bash に悪意のある引数で起動しても、引数はそのまま届き副作用は無く、名前付きの idle で返る（AC1・AC2・AC7・AC10）
    FAIL  src/agentStart.integration.test.ts > wtmctl agent start integration（実 PTY の bash／dash・偽の claude・実際の検出） > 打ちかけの行がある dash でも打ちかけは実行されず、起動した引数は渡したものだけ（AC7・AC10）
    FAIL  src/agentStart.integration.test.ts > wtmctl agent start integration（実 PTY の bash／dash・偽の claude・実際の検出） > 打ちかけの行がある bash（readline）でも打ちかけは実行されず、起動した引数は渡したものだけ（AC10）
    FAIL  src/agentStart.integration.test.ts > wtmctl agent start integration（実 PTY の bash／dash・偽の claude・実際の検出） > 前面がシェル以外（cat の実行中）の pane には何も打ち込まず agent_pane_busy（AC8）
restored: cmp identical
DETECTED
=== M82 packages/cli/src/cliArgs.ts: 'const separator = rest.indexOf("--");' -> 'const separator = rest.lastIndexOf("--");'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × -- の後は --kind・--pane・--url・-- もそのまま引数になる。-- が無ければ引数は空・timeout は省略（AC15） 24ms
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > -- の後は --kind・--pane・--url・-- もそのまま引数になる。-- が無ければ引数は空・timeout は省略（AC15）
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M83 packages/cli/src/cliArgs.ts: 'rest.slice(separator + 1)' -> 'rest.slice(separator)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 名前・--kind・--pane・--timeout と、-- の後のエージェントへの引数を読む 16ms
    × -- の後は --kind・--pane・--url・-- もそのまま引数になる。-- が無ければ引数は空・timeout は省略（AC15） 8ms
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > 名前・--kind・--pane・--timeout と、-- の後のエージェントへの引数を読む
    AssertionError: expected { kind: 'agent-start', …(6) } to deeply equal { kind: 'agent-start', …(6) }
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > -- の後は --kind・--pane・--url・-- もそのまま引数になる。-- が無ければ引数は空・timeout は省略（AC15）
    AssertionError: expected { kind: 'agent-start', …(6) } to match object { agentKind: 'codex', …(2) }
    Test Files  1 failed | 2 passed (3)
    Tests  2 failed | 17 passed (19)
restored: cmp identical
DETECTED
=== M84 packages/cli/src/cliArgs.ts: 'if (!AGENT_START_KINDS.includes(agentKind))' -> 'if (false)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 表に無い kind は使用誤りで、一覧を案内する（AC5） 5ms
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > 表に無い kind は使用誤りで、一覧を案内する（AC5）
    Error: expected a CliUsageError
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M85 packages/cli/src/cliArgs.ts: '!/^[0-9]+$/.test(timeoutRaw)' -> '!/^-?[0-9]+$/.test(timeoutRaw)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × --timeout が整数でなければ使用誤り。範囲はサーバが判定するので 3000 も読む（AC15） 5ms
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > --timeout が整数でなければ使用誤り。範囲はサーバが判定するので 3000 も読む（AC15）
    Error: expected a CliUsageError
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M86 packages/cli/src/cliArgs.ts: '  rejectExtra(positionals, 1, AGENT_START_USAGE);\n' -> ''
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 名前・--kind・--pane の欠落、-- より前の余分な位置引数、未知のオプションは使用誤り 7ms
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > 名前・--kind・--pane の欠落、-- より前の余分な位置引数、未知のオプションは使用誤り
    Error: expected a CliUsageError
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M87 packages/cli/src/cliArgs.ts: 'const head = separator === -1 ? rest : rest.slice(0, separator);' -> 'const head = rest;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 名前・--kind・--pane・--timeout と、-- の後のエージェントへの引数を読む 11ms
    × -- の後は --kind・--pane・--url・-- もそのまま引数になる。-- が無ければ引数は空・timeout は省略（AC15） 1ms
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > 名前・--kind・--pane・--timeout と、-- の後のエージェントへの引数を読む
    FAIL  src/cliArgs.agentStart.test.ts > parseArgs — agent start > -- の後は --kind・--pane・--url・-- もそのまま引数になる。-- が無ければ引数は空・timeout は省略（AC15）
    Test Files  1 failed | 2 passed (3)
    Tests  2 failed | 17 passed (19)
restored: cmp identical
DETECTED
=== M88 packages/cli/src/agentStartWait.ts: 'return this.named === null' -> 'return this.named !== null'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 検出前（null）は待ち、unknown・working も待ち、idle で ready（AC13） 19ms
    × 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14） 4ms
    × agent.start を送り、名前付きの検出が unknown・working を経て idle になったら出力する（AC13） 25ms
    × --timeout を渡すとそのまま送る 7ms
    × blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14） 14ms
    × 締め切り（既定 30000 ms・--timeout）を過ぎたら timeout（AC14） 6ms
    × agent_pane_busy は 100 ms おきに再試行し、空けば起動して待つ（AC16） 4ms
    × 接続が切れたら connection_closed 4ms
restored: cmp identical
DETECTED
=== M89 packages/cli/src/agentStartWait.ts: 'if (agent.kind !== this.kind)' -> 'if (false)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 別の種類は agent_kind_mismatch、名前が違う・無いのは agent_start_failed（AC14） 15ms
    × blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14） 15ms
    FAIL  src/agentStartWait.test.ts > StartWait > 別の種類は agent_kind_mismatch、名前が違う・無いのは agent_start_failed（AC14）
    AssertionError: expected 'pending' to be 'agent_kind_mismatch' // Object.is equality
    FAIL  src/commands/agentStart.test.ts > runAgentStart > blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14）
    AssertionError: expected 'agent_start_failed' to be 'agent_kind_mismatch' // Object.is equality
    Test Files  2 failed | 1 passed (3)
    Tests  2 failed | 17 passed (19)
restored: cmp identical
DETECTED
=== M90 packages/cli/src/agentStartWait.ts: 'if (agent.name !== this.name)' -> 'if (false)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 別の種類は agent_kind_mismatch、名前が違う・無いのは agent_start_failed（AC14） 21ms
    FAIL  src/agentStartWait.test.ts > StartWait > 別の種類は agent_kind_mismatch、名前が違う・無いのは agent_start_failed（AC14）
    AssertionError: expected 'pending' to be 'agent_start_failed' // Object.is equality
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M91 packages/cli/src/agentStartWait.ts: 'if (this.named !== null && agent.instanceId !== this.named)' -> 'if (false)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14） 18ms
    FAIL  src/agentStartWait.test.ts > StartWait > 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14）
    AssertionError: expected 'ready' to be 'agent_start_failed' // Object.is equality
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M92 packages/cli/src/agentStartWait.ts: 'if (status === "blocked")' -> 'if (false)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × blocked は agent_not_ready（AC12） 10ms
    × blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14） 5004ms
    FAIL  src/agentStartWait.test.ts > StartWait > blocked は agent_not_ready（AC12）
    AssertionError: expected 'pending' to be 'agent_not_ready' // Object.is equality
    FAIL  src/commands/agentStart.test.ts > runAgentStart > blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14）
    Error: Test timed out in 5000ms.
    Test Files  2 failed | 1 passed (3)
    Tests  2 failed | 17 passed (19)
restored: cmp identical
DETECTED
=== M93 packages/cli/src/agentStartWait.ts: 'status === "idle" || status === "done"' -> 'status === "idle"'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × done（idle かつ未読の完了）も ready（AC13） 19ms
    FAIL  src/agentStartWait.test.ts > StartWait > done（idle かつ未読の完了）も ready（AC13）
    AssertionError: expected 'pending' to be 'ready' // Object.is equality
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M94 packages/cli/src/agentStartWait.ts: 'status === "idle" || status === "done"' -> 'status === "done"'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 検出前（null）は待ち、unknown・working も待ち、idle で ready（AC13） 19ms
    × agent.start を送り、名前付きの検出が unknown・working を経て idle になったら出力する（AC13） 5019ms
    × --timeout を渡すとそのまま送る 5003ms
    × 応答の前に届いた検出（idle）も、応答の後に判定する 5007ms
    × agent_pane_busy は 100 ms おきに再試行し、空けば起動して待つ（AC16） 5001ms
    FAIL  src/agentStartWait.test.ts > StartWait > 検出前（null）は待ち、unknown・working も待ち、idle で ready（AC13）
    AssertionError: expected { kind: 'pending' } to deeply equal { kind: 'ready', agent: { …(9) } }
    FAIL  src/commands/agentStart.test.ts > runAgentStart > agent.start を送り、名前付きの検出が unknown・working を経て idle になったら出力する（AC13）
restored: cmp identical
DETECTED
=== M95 packages/cli/src/agentStartWait.ts: '    return PENDING;\n  }\n\n  paneClosed' -> '    return { kind: "ready", agent };\n  }\n\n  paneClosed'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 検出前（null）は待ち、unknown・working も待ち、idle で ready（AC13） 6ms
    × 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14） 1ms
    × agent.start を送り、名前付きの検出が unknown・working を経て idle になったら出力する（AC13） 10ms
    × blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14） 1ms
    FAIL  src/agentStartWait.test.ts > StartWait > 検出前（null）は待ち、unknown・working も待ち、idle で ready（AC13）
    AssertionError: expected 'ready' to be 'pending' // Object.is equality
    FAIL  src/agentStartWait.test.ts > StartWait > 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14）
    AssertionError: expected 'ready' to be 'pending' // Object.is equality
restored: cmp identical
DETECTED
=== M96 packages/cli/src/agentStartWait.ts: '    this.named = agent.instanceId;\n' -> ''
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14） 5ms
    × blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14） 5004ms
    FAIL  src/agentStartWait.test.ts > StartWait > 名前付きで見えた後に消える・入れ替わる・pane が閉じると agent_start_failed（AC14）
    AssertionError: expected 'pending' to be 'agent_start_failed' // Object.is equality
    FAIL  src/commands/agentStart.test.ts > runAgentStart > blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14）
    Error: Test timed out in 5000ms.
    Test Files  2 failed | 1 passed (3)
    Tests  2 failed | 17 passed (19)
restored: cmp identical
DETECTED
=== M97 packages/cli/src/commands/agentStart.ts: 'err.code !== "agent_pane_busy"' -> 'err.code === "agent_pane_busy"'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × サーバの誤り（busy 以外）はそのまま返し、再試行しない 5004ms
    × agent_pane_busy は 100 ms おきに再試行し、空けば起動して待つ（AC16） 2ms
    × 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16） 1ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > サーバの誤り（busy 以外）はそのまま返し、再試行しない
    Error: Test timed out in 5000ms.
    FAIL  src/commands/agentStart.test.ts > runAgentStart > agent_pane_busy は 100 ms おきに再試行し、空けば起動して待つ（AC16）
    AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16）
restored: cmp identical
DETECTED
=== M98 packages/cli/src/commands/agentStart.ts: 'START_BUSY_RETRY_MS = 2000' -> 'START_BUSY_RETRY_MS = 4000'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16） 5004ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M99 packages/cli/src/commands/agentStart.ts: 'START_BUSY_POLL_MS = 100' -> 'START_BUSY_POLL_MS = 50'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × agent_pane_busy は 100 ms おきに再試行し、空けば起動して待つ（AC16） 4ms
    × 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16） 2ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > agent_pane_busy は 100 ms おきに再試行し、空けば起動して待つ（AC16）
    AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16）
    AssertionError: expected "vi.fn()" to be called 21 times, but got 41 times
    Test Files  1 failed | 2 passed (3)
    Tests  2 failed | 17 passed (19)
restored: cmp identical
DETECTED
=== M100 packages/cli/src/commands/agentStart.ts: 'if (remaining <= 0) throw err;' -> 'if (remaining < -1000) throw err;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16） 5004ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M101 packages/cli/src/commands/agentStart.ts: 'firstBusyAt ??= deps.now();' -> 'firstBusyAt = deps.now();'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16） 5005ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 2 秒 busy のままなら最後の agent_pane_busy を返す（AC16）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M102 packages/cli/src/commands/agentStart.ts: '        ...(cmd.timeoutMs === undefined ? {} : { timeoutMs: cmd.timeoutMs }),\n' -> ''
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × --timeout を渡すとそのまま送る 6ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > --timeout を渡すとそのまま送る
    AssertionError: expected { name: 'reviewer', …(3) } to match object { timeoutMs: 5000 }
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M103 packages/cli/src/commands/agentStart.ts: 'if (!started || settled) return;' -> 'if (settled) return;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=0
    Test Files  3 passed (3)
    Tests  19 passed (19)
restored: cmp identical
NOT DETECTED
=== M104 packages/cli/src/commands/agentStart.ts: '(cmd.timeoutMs ?? AGENT_START_DEFAULT_TIMEOUT_MS)' -> '(AGENT_START_DEFAULT_TIMEOUT_MS)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 締め切り（既定 30000 ms・--timeout）を過ぎたら timeout（AC14） 5005ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 締め切り（既定 30000 ms・--timeout）を過ぎたら timeout（AC14）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M105 packages/cli/src/commands/agentStart.ts: '              closed = true;\n' -> ''
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14） 5005ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > blocked は agent_not_ready、別の種類は agent_kind_mismatch、名前付きの後の消失・pane の close は agent_start_failed（AC12・AC14）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M106 packages/cli/src/commands/agentStart.ts: '            if (evt.data.paneId === cmd.paneId) {\n              current = evt.data.agent;' -> '            if (true) {\n              current = evt.data.agent;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=0
    Test Files  3 passed (3)
    Tests  19 passed (19)
restored: cmp identical
NOT DETECTED
=== M107 packages/cli/src/commands/agentStart.ts: 'let current: AgentInfo | null = pane?.agent ?? null;' -> 'let current: AgentInfo | null = null;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=0
    Test Files  3 passed (3)
    Tests  19 passed (19)
restored: cmp identical
NOT DETECTED
=== M108 packages/cli/src/commands/agentStart.ts: '        args: cmd.args,\n' -> '        args: [],\n'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × agent.start を送り、名前付きの検出が unknown・working を経て idle になったら出力する（AC13） 21ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > agent.start を送り、名前付きの検出が unknown・working を経て idle になったら出力する（AC13）
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'agent.start', …(1) ]
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M109 packages/cli/src/commands/agentStart.ts: 'Math.max(0, deadline - deps.now())' -> 'Math.max(0, deadline - deps.now()) * 2'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 締め切り（既定 30000 ms・--timeout）を過ぎたら timeout（AC14） 5005ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 締め切り（既定 30000 ms・--timeout）を過ぎたら timeout（AC14）
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M110 packages/cli/src/commands/agentStart.ts: '          judge();\n        },\n        (err: unknown)' -> '        },\n        (err: unknown)'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 応答の前に届いた検出（idle）も、応答の後に判定する 5005ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 応答の前に届いた検出（idle）も、応答の後に判定する
    Error: Test timed out in 5000ms.
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 18 passed (19)
restored: cmp identical
DETECTED
=== M111 packages/cli/src/commands/agentStart.ts: '          if (settled) return;\n          started = true;' -> '          started = true;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=0
    Test Files  3 passed (3)
    Tests  19 passed (19)
restored: cmp identical
NOT DETECTED
=== summary: 111 mutations, not detected: ['M11', 'M43', 'M58', 'M78', 'M103', 'M106', 'M107', 'M111']
```

### 通った 8 通りの扱い

- M11（制御文字の範囲の上端 U+001F を外す）→ `agentStart.test.ts` の `hasControlChar` の文字に `\u001f` を足した。
- M43（バイト数ではなく文字数で上限を数える）→ `AgentStarter.test.ts` の拒否の表に「多バイト文字で 4000 バイト超の行」を足した。
- M58（端末が無い pane を見落とす）→ `AgentStarter.test.ts` に「pane はあるが端末が無ければ `agent_pane_not_found`」を足した。
- M103（RPC の応答の前に判定する）→ `commands/agentStart.test.ts` に「応答の前に届いた別の種類の検出では失敗しない」を足した（busy の再試行中に前のエージェントの終了が届く場合。変異では `agent_kind_mismatch` で終わる）。
- M106（他の pane の検出を判定に使う）→ 同じファイルに「他の pane の検出は判定に使わない」を足した。
- M111（接続が切れて決着した後に応答が来ると締め切りのタイマーを張る）→ 同じファイルに「後から応答が来てもタイマーを残さない」を足した（`vi.getTimerCount()`）。
- M78（`hasPendingResume` が期限切れの記録を消す行）→ **観測上等価**。消さなくても期限切れの判定（`now - at <= 30000` が偽）で `false` を返すので、振る舞いは変わらない（記録が pane の close まで Map に残るだけ）。テストは足さない。
- M107（hello の snapshot の pane のエージェントを待ちの初期値にする）→ **観測上等価**。snapshot にエージェントが居れば、サーバはその pane を `agent_pane_busy` で拒むか、居なくなった時点で `pane.agent_status_changed` が届いて上書きされる。判定は RPC の応答の後にしか行わないので、初期値が効く前に必ずイベントで置き換わる。テストは足さない。

### 2 回目（足したテストの上で、通った 8 通りを再度）の出力（そのまま）

```
=== M11 packages/server/src/agent/agentStart.ts: '[\\u0000-\\u001f\\u007f-\\u009f]' -> '[\\u0000-\\u001e\\u007f-\\u009f]'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × C0・DEL・C1 を見つける（AC6） 15ms
    FAIL  src/agent/agentStart.test.ts > hasControlChar > C0・DEL・C1 を見つける（AC6）
    AssertionError: "\u001f": expected false to be true // Object.is equality
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 77 passed (78)
restored: cmp identical
DETECTED
=== M43 packages/server/src/agent/AgentStarter.ts: 'Buffer.byteLength(line, "utf8") > MAX_START_LINE_BYTES' -> 'line.length > MAX_START_LINE_BYTES'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × 多バイト文字で 4000 バイト超の行 は { args: [Array] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15） 8ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 多バイト文字で 4000 バイト超の行 は { args: [Array] }… 何も書かず・予約せず・前面も見ない（AC4〜AC6・AC8・AC15）
    Error: expected an RpcError
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 77 passed (78)
restored: cmp identical
DETECTED
=== M58 packages/server/src/agent/AgentStarter.ts: 'if (!pane || !host)' -> 'if (!pane)'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=1
    × pane はあるが端末が無ければ agent_pane_not_found で何も書かない（test 工程の負の確認で追加） 14ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > pane はあるが端末が無ければ agent_pane_not_found で何も書かない（test 工程の負の確認で追加）
    TypeError: Cannot read properties of undefined (reading 'pid')
    Test Files  1 failed | 6 passed (7)
    Tests  1 failed | 77 passed (78)
restored: cmp identical
DETECTED
=== M78 packages/server/src/session/SessionService.ts: '    this.resumeWrittenAt.delete(paneId);\n    return false;' -> '    return false;'
$ cd packages/server && npx vitest run src/agent/agentStart.test.ts src/agent/agentStart.shell.test.ts src/agent/AgentStarter.test.ts src/session/SessionService.agentLaunch.test.ts src/session/SessionService.resumePending.test.ts src/session/SessionService.agentName.test.ts src/surface/methods/agentStart.test.ts
exit=0
    Test Files  7 passed (7)
    Tests  78 passed (78)
restored: cmp identical
NOT DETECTED
=== M103 packages/cli/src/commands/agentStart.ts: 'if (!started || settled) return;' -> 'if (settled) return;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 応答の前に届いた別の種類の検出（busy の間に居た前のエージェント）では失敗せず、応答の後の検出で判定する 9ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 応答の前に届いた別の種類の検出（busy の間に居た前のエージェント）では失敗せず、応答の後の検出で判定する
    AssertionError: expected 'agent_kind_mismatch' to be 'ok' // Object.is equality
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 21 passed (22)
restored: cmp identical
DETECTED
=== M106 packages/cli/src/commands/agentStart.ts: '            if (evt.data.paneId === cmd.paneId) {\n              current = evt.data.agent;' -> '            if (true) {\n              current = evt.data.agent;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 他の pane の検出は判定に使わない 8ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 他の pane の検出は判定に使わない
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 21 passed (22)
restored: cmp identical
DETECTED
=== M107 packages/cli/src/commands/agentStart.ts: 'let current: AgentInfo | null = pane?.agent ?? null;' -> 'let current: AgentInfo | null = null;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=0
    Test Files  3 passed (3)
    Tests  22 passed (22)
restored: cmp identical
NOT DETECTED
=== M111 packages/cli/src/commands/agentStart.ts: '          if (settled) return;\n          started = true;' -> '          started = true;'
$ cd packages/cli && npx vitest run src/agentStartWait.test.ts src/commands/agentStart.test.ts src/cliArgs.agentStart.test.ts
exit=1
    × 応答の前に接続が切れたら、後から応答が来ても締め切りのタイマーを残さない 13ms
    FAIL  src/commands/agentStart.test.ts > runAgentStart > 応答の前に接続が切れたら、後から応答が来ても締め切りのタイマーを残さない
    AssertionError: expected 1 to be +0 // Object.is equality
    Test Files  1 failed | 2 passed (3)
    Tests  1 failed | 21 passed (22)
restored: cmp identical
DETECTED
=== summary: 8 mutations, not detected: ['M78', 'M107']
```

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260926-agent-start
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46303 (state dir /tmp/wtm-smoke-1aJgEM)
{"ts":"2026-09-26T15:06:54.132Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke: agent manifests ok (22/22)
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
smoke(web): 初めてのブラウザで、はじめの案内が端末の表示のあとに開き、見出しにフォーカスがある
smoke(web): Esc で閉じると端末へフォーカスが戻り、案内済みだけが保存される
smoke(web): 開き直しても、はじめの案内は出ない
smoke(web): はじめの案内を閉じたあと、クリックせずに打った文字が PTY まで届いた
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/agent-start/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-EwMx4u, sandboxed HOME /tmp/wtmctl-smoke-home-U4lM0k
{"ts":"2026-09-26T15:06:58.720Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:46155
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent rename ok (named, resolved by name, cleared)
smoke(cli): wtmctl agent start ok (usage error for an unknown kind, agent_pane_busy on a pane with an agent)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: Ny5U0Pb2ReCPLDXoIt5yf42HuP2fJffb
wtm: deleted session smoke (/tmp/tmp.dPuFs8cyJC/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

## 未検証の穴（skip / 環境不足）

- **zsh・ksh・mksh の実物での確認**：この環境には bash と dash しか無い（`command -v zsh ksh mksh` が何も返さない）。クォートは「実行ファイル以外の引数を全部単一引用符で包み、中の `'` は `'\''`」で、単一引用符の中を一切解釈しない POSIX の規定だけに依る。zsh の `RC_QUOTES`（引用符の中の `''` を `'` と読む）でも、`'\''` の `\` が必ず閉じる引用符の直後に来るので連続した `''` が引用符の中に現れないことは読解で確かめたが、実物では走らせていない（decisions.md D1）。
- **打ちかけの消去（Ctrl-C → 200 ms → Ctrl-E Ctrl-U）が zsh・ksh・mksh の行編集で効くか**：未確認（bash〔readline〕と dash〔端末の VKILL〕だけを実物で確認）。200 ms は保証ではなく、その間にシェルが Ctrl-C を処理し終えない高負荷では継続行が残りうる（decisions.md D9。`docs/wtmctl.md` に記載）。
- **本物のエージェント**（`claude` 等）での起動：偽の `claude`（`exec -a claude` の node）だけで確かめた。本物の起動時間・初回の確認画面（blocked → `agent_not_ready`）は未検証。
- **前面の確認と書き込みの間の競り合い**：前面を確かめてから Ctrl-C・行を書くまでの間に利用者がコマンドを始めると、そのコマンドに Ctrl-C と行が届く（herdr と同じ残るリスク。単体テストは await 後の確かめ直しまで）。
- **E2E**：走らせていない（ユーザーの指示）。画面の変更は無い。
- fish・PowerShell・cmd.exe・Windows のサーバは本 work の範囲外で `unsupported_agent_shell`（backlog の後続項目）。

## ラウンド 2（review ラウンド 1 の差し戻しの後）

review ラウンド 1 の should（書き込む直前に前面を確かめ直す）と nit 3 件の修正（decisions.md D13）の後に取り直した。負荷をかける検証（busy loop の並走・同じテストの大量の繰り返し）は行っていない（ユーザーの指示）。

### 実行したもの
- `pnpm -s build` — exit 0
- `pnpm -s typecheck` — exit 0
- `pnpm -s test` 1 回目 — exit 0: 197 files / **3816 passed** / 0 failed / 0 skipped
- `pnpm -s test` 2 回目 — exit 0: 197 files / **3816 passed** / 0 failed / 0 skipped
- 足したテスト: `TerminalHost.prepare.test.ts`（新規 3 本）・`AgentStarter.test.ts`（確かめ直し 4 通り＋pid＋onAccepted の 6 本）・`surface/methods/agentStart.test.ts`（拒否は記録しない 1 本・順序の期待値を更新）・`SessionService.resumePending.test.ts`（close で消す 1 本）。既存の `TerminalHost.test.ts` は変えていない。
- 負の確認: 修正を 9 通り（R1〜R9）壊し、**9 通りとも検出**（下）。
- `aidev smoke` — pass（exit 0、3 本）。

### 受け入れ基準への影響
- AC8: 追加で pass — 最初の確認の後に前面が vim・シェルのグループにシェル以外・取得できない・fish に替わった、のどれでも書く直前の確かめ直しで `agent_pane_busy`・何も書かない・予約を解く（`AgentStarter.test.ts`）。`prepare` の間の入力は後回しになり、reject なら何も書かない（`TerminalHost.prepare.test.ts`）。
- 他の AC の判定はラウンド 1 のまま（全体のテストが通過）。

### 失敗の証跡
このラウンドでは失敗が発生していない。

### 負の確認（R1〜R9。`scratchpad/neg/sweep_r2.py` の出力そのまま）

```
=== R1 packages/server/src/terminal/TerminalHost.ts: '      if (job.input.prepare) {\n        await job.input.prepare();\n        if (this.activeModal !== job) return;\n      }\n' -> ''
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × prepare を待つ間に届いた write は後回しになり、prepare の後の部分より後に書かれる 146ms
    × prepare が reject したら build を呼ばず何も書かずに reject し、後回しの入力はその後に書く 64ms
    FAIL  src/terminal/TerminalHost.prepare.test.ts > DefaultTerminalHost.writeModal の prepare > prepare を待つ間に届いた write は後回しになり、prepare の後の部分より後に書かれる
    AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
    FAIL  src/terminal/TerminalHost.prepare.test.ts > DefaultTerminalHost.writeModal の prepare > prepare が reject したら build を呼ばず何も書かずに reject し、後回しの入力はその後に書く
    TypeError: fail is not a function
    Test Files  1 failed | 4 passed (5)
    Tests  2 failed | 57 passed (59)
restored: cmp identical
DETECTED
=== R2 packages/server/src/terminal/TerminalHost.ts: '      if (job.input.prepare) {\n        await job.input.prepare();' -> '      if (job.input.prepare) {\n        void job.input.prepare();'
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × prepare を待つ間に届いた write は後回しになり、prepare の後の部分より後に書かれる 256ms
    × prepare が reject したら build を呼ばず何も書かずに reject し、後回しの入力はその後に書く 149ms
    FAIL  src/terminal/TerminalHost.prepare.test.ts > DefaultTerminalHost.writeModal の prepare > prepare を待つ間に届いた write は後回しになり、prepare の後の部分より後に書かれる
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    FAIL  src/terminal/TerminalHost.prepare.test.ts > DefaultTerminalHost.writeModal の prepare > prepare が reject したら build を呼ばず何も書かずに reject し、後回しの入力はその後に書く
    AssertionError: expected 'resolved' to be 'not idle' // Object.is equality
    Error: not idle
    Test Files  1 failed | 4 passed (5)
restored: cmp identical
DETECTED
=== R3 packages/server/src/agent/AgentStarter.ts: '          const again = checkShell(await this.foregroundJob(host.pid), host.pid);\n          if (again.kind !== "available") throw busy(paneId);\n' -> ''
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × 書く直前の確かめ直しで前面が vimなら何も書かず、予約を解いて agent_pane_busy 16ms
    × 書く直前の確かめ直しでシェルのグループにシェル以外が居るなら何も書かず、予約を解いて agent_pane_busy 3ms
    × 書く直前の確かめ直しで前面を取得できないなら何も書かず、予約を解いて agent_pane_busy 3ms
    × 書く直前の確かめ直しで前面がシェルだが fish に替わったなら何も書かず、予約を解いて agent_pane_busy 3ms
    × 書く直前の確かめ直しは、最初の確認と同じ pid の前面を見る 24ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前の確かめ直しで前面が vimなら何も書かず、予約を解いて agent_pane_busy
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前の確かめ直しでシェルのグループにシェル以外が居るなら何も書かず、予約を解いて agent_pane_busy
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前の確かめ直しで前面を取得できないなら何も書かず、予約を解いて agent_pane_busy
restored: cmp identical
DETECTED
=== R4 packages/server/src/agent/AgentStarter.ts: 'if (again.kind !== "available")' -> 'if (again.kind === "busy")'
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × 書く直前の確かめ直しで前面がシェルだが fish に替わったなら何も書かず、予約を解いて agent_pane_busy 7ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前の確かめ直しで前面がシェルだが fish に替わったなら何も書かず、予約を解いて agent_pane_busy
    Error: expected an RpcError
    Test Files  1 failed | 4 passed (5)
    Tests  1 failed | 58 passed (59)
restored: cmp identical
DETECTED
=== R5 packages/server/src/agent/AgentStarter.ts: 'checkShell(await this.foregroundJob(host.pid), host.pid);\n          if (again' -> 'checkShell(await this.foregroundJob(0), host.pid);\n          if (again'
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × 書く直前の確かめ直しは、最初の確認と同じ pid の前面を見る 32ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > 書く直前の確かめ直しは、最初の確認と同じ pid の前面を見る
    AssertionError: expected [ [ 100 ], [ +0 ] ] to deeply equal [ [ 100 ], [ 100 ] ]
    Test Files  1 failed | 4 passed (5)
    Tests  1 failed | 58 passed (59)
restored: cmp identical
DETECTED
=== R6 packages/server/src/agent/AgentStarter.ts: '      onAccepted?.();\n' -> ''
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × onAccepted は予約の後・書き込みの前に 1 回だけ呼び、拒否した要求では呼ばない（review ラウンド 1） 16ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > onAccepted は予約の後・書き込みの前に 1 回だけ呼び、拒否した要求では呼ばない（review ラウンド 1）
    AssertionError: expected [ 'reserve', 'write' ] to deeply equal [ 'reserve', 'accepted', 'write' ]
    Test Files  1 failed | 4 passed (5)
    Tests  1 failed | 58 passed (59)
restored: cmp identical
DETECTED
=== R7 packages/server/src/agent/AgentStarter.ts: '    const token = this.opts.session.beginAgentLaunch(paneId, name, kind);\n    try {\n      onAccepted?.();\n' -> '    onAccepted?.();\n    const token = this.opts.session.beginAgentLaunch(paneId, name, kind);\n    try {\n'
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × onAccepted は予約の後・書き込みの前に 1 回だけ呼び、拒否した要求では呼ばない（review ラウンド 1） 19ms
    FAIL  src/agent/AgentStarter.test.ts > AgentStarter > onAccepted は予約の後・書き込みの前に 1 回だけ呼び、拒否した要求では呼ばない（review ラウンド 1）
    AssertionError: expected [ 'accepted', 'reserve', 'write' ] to deeply equal [ 'reserve', 'accepted', 'write' ]
    Test Files  1 failed | 4 passed (5)
    Tests  1 failed | 58 passed (59)
restored: cmp identical
DETECTED
=== R8 packages/server/src/surface/methods/agent.ts: 'starter.start(params, () => deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId))' -> '(deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId), starter.start(params, () => {}))'
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × 受け付けた後・打ち込む前に操作したクライアントを記録し、引数をそのまま AgentStarter.start へ渡して結果を返す 38ms
    × AgentStarter が拒否した（onAccepted を呼ばない）要求は操作として記録しない（review ラウンド 1） 5ms
    FAIL  src/surface/methods/agentStart.test.ts > agent.start > 受け付けた後・打ち込む前に操作したクライアントを記録し、引数をそのまま AgentStarter.start へ渡して結果を返す
    AssertionError: expected [ 'note', 'start', 'write' ] to deeply equal [ 'start', 'note', 'write' ]
    FAIL  src/surface/methods/agentStart.test.ts > agent.start > AgentStarter が拒否した（onAccepted を呼ばない）要求は操作として記録しない（review ラウンド 1）
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
    Test Files  1 failed | 4 passed (5)
    Tests  2 failed | 57 passed (59)
restored: cmp identical
DETECTED
=== R9 packages/server/src/session/SessionService.ts: '    this.resumeWrittenAt.delete(paneId); // 20260926-agent-start の review ラウンド 1（閉じた pane の記録を残さない）\n' -> ''
$ cd packages/server && npx vitest run src/terminal/TerminalHost.prepare.test.ts src/terminal/TerminalHost.test.ts src/agent/AgentStarter.test.ts src/surface/methods/agentStart.test.ts src/session/SessionService.resumePending.test.ts
exit=1
    × pane を閉じたら記録を消す（review ラウンド 1） 22ms
    FAIL  src/session/SessionService.resumePending.test.ts > SessionService — hasPendingResume > pane を閉じたら記録を消す（review ラウンド 1）
    AssertionError: expected true to be false // Object.is equality
    Test Files  1 failed | 4 passed (5)
    Tests  1 failed | 58 passed (59)
restored: cmp identical
DETECTED
=== summary: 9 mutations, not detected: none
```

### 起動確認（smoke）

```
$ aidev smoke
smoke: 20260926-agent-start
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:44879 (state dir /tmp/wtm-smoke-c8eOoN)
{"ts":"2026-09-26T15:39:01.614Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke: agent manifests ok (22/22)
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
smoke(web): 初めてのブラウザで、はじめの案内が端末の表示のあとに開き、見出しにフォーカスがある
smoke(web): Esc で閉じると端末へフォーカスが戻り、案内済みだけが保存される
smoke(web): 開き直しても、はじめの案内は出ない
smoke(web): はじめの案内を閉じたあと、クリックせずに打った文字が PTY まで届いた
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/agent-start/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-A39DMS, sandboxed HOME /tmp/wtmctl-smoke-home-CSzBvo
{"ts":"2026-09-26T15:39:10.774Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:45967
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent rename ok (named, resolved by name, cleared)
smoke(cli): wtmctl agent start ok (usage error for an unknown kind, agent_pane_busy on a pane with an agent)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: LwGbkImqjfAoJtN4aTV14-H-MYrI36Xi
wtm: deleted session smoke (/tmp/tmp.Q9axVLotTN/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

### 未検証の穴（追加分）
- 書き込む直前の確かめ直しの少し前に打たれたコマンドを、シェルが fork・exec している途中の瞬間は見分けられない（docs に明記。実物では再現を試みていない）。

## deliver 前（origin/main の取り込みの後）

origin/main（#50 20260926-load-flaky-tests。早送り）を取り込み、同 work の D3 に合わせて結合テスト `agentStart.integration.test.ts` の待ち受けを `composeServerOnFreePort`（EADDRINUSE なら組み立て直す）に替えた（自前の `getFreePort` を削除）。

- `pnpm install --frozen-lockfile`・`pnpm -s build`・`pnpm -s typecheck` — すべて exit 0
- `pnpm -s test` — exit 0: 198 files / **3824 passed** / 0 failed / 0 skipped（main の新しいテストを含む）
- `aidev smoke` — pass（exit 0、3 本）
