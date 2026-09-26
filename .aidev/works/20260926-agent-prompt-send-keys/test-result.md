# テスト結果: エージェントへの prompt 送信と待ち合わせ（`wtmctl agent prompt [--wait]`・`agent send-keys`）

## 実行したもの

- `pnpm -s build` — exit 0
- `pnpm -s typecheck`（build の後）— exit 0
- `pnpm -s test` 1 回目 — 3398 passed / 0 failed / 5 skipped、Test Files 1 failed（`packages/cli/src/agent.integration.test.ts` の beforeAll が `listen EADDRINUSE`。下の「失敗の証跡」）
  - backlog の「単体・結合テストが高負荷のときだけ落ちる」(3)（server の結合テストの `listen EADDRINUSE`。`getFreePort` で得たポートを並行の別テストが先に使う）と同じ事象。そのファイルを単独で 3 回流して 3 回とも 5 passed（exit 0）。
  - 5 skipped はこの beforeAll の失敗で走らなかった同ファイルの 5 件。
- `pnpm -s test` 2 回目 — 3403 passed / 0 failed / 0 skipped（171 files）exit 0
- `pnpm -s test` 3 回目 — 3403 passed / 0 failed / 0 skipped（171 files）exit 0
- `aidev smoke` — pass（exit 0、2 本）
- 参考（coding 中）: `packages/web` を単独で流したとき、他のエージェントの点検と重なった負荷の下で `SettingsDialog.symbolsNote.test.ts`・`SettingsDialog.test.ts` の 2 件が 11.6s・7.3s の時間切れで落ちた（backlog の (2) と同じ SettingsDialog の重いテスト。本 work は触っていない）。2 ファイルを単独で 3 回流して 3 回とも 89 passed。上の全体 2 回・3 回目では通っている。

## 受け入れ基準ごとの判定

- AC1: pass — `agentInput.test.ts`（`pastePayload`）、`TerminalHost.test.ts`「build は送る瞬間のモードで呼ばれる」（直前の出力の `ESC[?2004h/l` を flush してから読む）、`Mirror.test.ts`（flush の後に反映・大きな出力の後ろでも待つ）、`surface/methods/agent.test.ts`「bracketed paste が有効な瞬間なら包む」、結合テスト（偽のエージェントに `ESC[200~…ESC[201~` で届く）。
- AC2: pass — `TerminalHost.test.ts`（フェイクタイマーで 299ms では CR が無く 300ms で書かれる）、`agent.test.ts`（delayMs=300）、結合テスト（CR は別の読み取りで 250ms 以上後）。
- AC3: pass — `TerminalHost.test.ts`「送信中に届いた write は Enter の後に元の順序で」「モード付き入力が無いときは同期で即座に」「別のモード付き入力は順番に」。
- AC4: pass — `agent.test.ts`（writeModal の後に `{ agent }`）、`commands/agent.test.ts`「--wait 無し」（応答のエージェントを出す）、smoke（ビルド済みの `wtmctl agent prompt` がシェルで実行された）。
- AC5: pass — `agent.test.ts`（blocked → agent_blocked で書かない・書く直前の blocked/消失/入れ替わりでも書かない・pane/agent/端末無し → agent_not_found・空 → empty_agent_prompt）。
- AC6: pass — `agentStatus.test.ts`（`PromptWait`）、`commands/agent.test.ts`「要求を送る前の working は数えず、送った後の idle だけでは返らない」「送信中の一瞬の working も数える」。
- AC7: pass — `commands/agent.test.ts`（4999ms で未確定・5000ms で agent_prompt_stalled と今の状態／`--timeout` の残りが 5 秒以下なら締め切りで timeout／5 秒より前に活動を観測すれば stalled にならない）。
- AC8: pass — `agentStatus.test.ts`・`commands/agent.test.ts`（working の後の idle で done・blocked で即一致・`--until` の複数指定・送信前から working なら確認を省く）、結合テスト（Enter から 3 秒以上後、偽のエージェントが working から idle に戻った後で返る）。
- AC9: pass — `commands/agent.test.ts`（null・入れ替わり・pane.closed・応答の instanceId 違い → agent_not_running／送信中の締め切り・hello 中に尽きた締め切り → timeout／省略時は 60 秒進めても返らない）、`cliArgs.test.ts`（終了コード 2 の各場合）。
- AC10: pass — `agentInput.test.ts`（表の各行・アプリケーションカーソル）、`agent.test.ts`（blocked でも送る・モードで符号化）、`commands/agent.test.ts`、結合テスト（`esc up C-c` が `ESC ESC[A 0x03` で届く）、smoke。
- AC11: pass — `agent.test.ts`（不明なキー・符号化できない組み合わせで何も書かずに invalid_key・agent_not_found）、`cliArgs.test.ts`（キー 0 個 → 使い方の誤り）、`messages.test.ts`（keys 0 個はスキーマで弾く）。
- AC12: pass — `surface/methods/index.ts` で既存の `ControlSurface` に登録（新しい HTTP の経路・ソケットは無い。`git diff` に `packages/server/src/http`・`ws` の変更は無い）、`agent.test.ts`（`invoke` 経由で 1MB 超 → invalid_params）、`commands/agent.test.ts`（`withSession` を通る）、`clientError.test.ts`（web の文言）。stderr の JSON は既存の `reportAndExit`（変更なし）。
- AC13: pass — `packages/cli/src/agentPrompt.integration.test.ts`（実サーバ・実 PTY・実際の検出。node の偽エージェントを `exec -a claude` で起動）。1 回目の全体実行を含め全 3 回と単独実行で通過。
- AC14: docs は pass — `docs/wtmctl.md`・`docs/herdr-parity.md` の H39 行を更新（T9 の点検で 4 件、cross の点検で 2 件直した）。backlog の `[x]`（と本物のエージェントでの確認を残す `[ ]`。decisions.md D13）は deliver で行い、そこで確かめる。
- AC15: pass — 上の「実行したもの」。

## 失敗の証跡

`pnpm -s test` 1 回目（`uptime` の load average 2.73, 6.07, 8.02 の直後に開始）の出力から、失敗の部分をそのまま貼る:

```
 FAIL  |@wtm/cli| src/agent.integration.test.ts > wtmctl agent integration（実サーバ・実 PTY）
Error: listen EADDRINUSE: address already in use 127.0.0.1:38002
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |@wtm/cli| src/agent.integration.test.ts > wtmctl agent integration（実サーバ・実 PTY）
TypeError: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined
 ❯ src/agent.integration.test.ts:130:11
    128|     await server.close();
    129|     await rm(stateDir, { recursive: true, force: true });
    130|     await rm(sessionDir, { recursive: true, force: true });
       |           ^
    131|   });
    132|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed | 170 passed (171)
      Tests  3398 passed | 5 skipped (3403)
   Start at  17:06:34
   Duration  62.34s (tests 43%, environment 31%, transform 13%, import 12%, worker 1%)
```

単独での 3 回:

```
$ cd packages/cli && npx vitest run src/agent.integration.test.ts  # 1 回目
 Test Files  1 passed (1)
      Tests  5 passed (5)
$ cd packages/cli && npx vitest run src/agent.integration.test.ts  # 2 回目
 Test Files  1 passed (1)
      Tests  5 passed (5)
$ cd packages/cli && npx vitest run src/agent.integration.test.ts  # 3 回目
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

実装の不具合による失敗はこのラウンドでは発生していない。

## 起動確認（smoke）

`smokeCommands` の 2 本目（`pnpm --filter @wtm/cli run smoke`）に `agent send-keys` と `agent prompt` を足した（T13。検出したエージェントは居ないので状態を注入し、prompt の `echo` がシェルで実行されたことを見る）。

```
$ aidev smoke
smoke: 20260926-agent-prompt-send-keys
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38800 (state dir /tmp/wtm-smoke-RhE3MK)
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
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/agent-prompt-send-keys/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-XZK0gc, sandboxed HOME /tmp/wtmctl-smoke-home-gYbOHF
smoke(cli): server listening on http://127.0.0.1:39328
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## 未検証の穴

- **本物のエージェント（Claude Code・Codex 等）での送信は確かめていない**。確かめたのは、bracketed paste を有効にし・CR で OSC タイトルを working に切り替える node の偽エージェント（argv[0]=claude）だけ。本物の入力欄が「貼り付けの 300ms 後の CR」を確定として受け取るか、貼り付けの判定（paste burst 等）がどう振る舞うかは未検証（herdr は同じ 300ms で運用しているが、それもこの環境では確かめていない）。
- Windows（ConPTY）での送信は確かめていない（herdr の Codex 向けの回避策も入れていない。decisions.md D1）。
- kitty keyboard protocol を有効にしたアプリへの `send-keys`（xterm の既定の符号化だけ）。
- 状態の判定は 500ms 周期なので、書く直前の再確認（D7）でも判定の遅れの分の窓は残る。CLI の活動の確認の境目（要求を送った後のイベント）にも、受け付けから書くまでの間の窓がある（D10）。どちらも単体テストで規則は確かめたが、窓そのものを実時間で突くテストは無い。
- 結合テストで「活動の確認」を省く変異（T8-M5）は捕まらない（偽エージェントの事象列では等価。単体テストで捕まえている。D9）。
- E2E スイート（packages/e2e）は利用者の方針で走らせていない。

## 負の確認（生の出力）

変異を 1 つずつ当てて対象のテストを走らせ、元に戻して `cmp` で一致を確かめた（scratchpad の `mutate.py` の出力をそのまま貼る）。
「通った（未検出）」の扱い: T2-M3・M6・M11 と T5-M13 はテストを足して再実行し検出（`t2b`・`t5c`）。T6-M4 の SKIP は置換元を一意にして再実行（`t6b`）、T7-M15 の SKIP も同様（`t7c`）。
T7-M2（残りが 5 秒以下でも stalled のタイマーを張る）は、締め切りのタイマーが先に張られて同時か先に発火するため等価な変異。
T8-M3（flush を待たない）は結合テストではモードが送信のずっと前に切り替わるため捕まらず、単体テスト（T4-M3・T3-M1）で捕まえている。T8-M5 は上の「未検証の穴」。
T8 の変異はサーバのソースを変えて `tsc -b` で dist を作り直してから結合テストを流し、戻した後にもう一度ビルドした。

### t1

```
## T1-M1: 本文の上限の比較を外す
変異: src/messages.ts: `byteLength <= MAX_AGENT_PROMPT_BYTES` → `byteLength <= Infinity`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 本文は UTF-8 で 1MB まで受け、超えたら弾く（空は通す——サーバが empty_agent_prompt で返す） 34ms
     FAIL  src/messages.test.ts > AgentPromptParams / AgentSendKeysParams > 本文は UTF-8 で 1MB まで受け、超えたら弾く（空は通す——サーバが empty_agent_prompt で返す）
    AssertionError: expected [Function] to throw an error
          Tests  1 failed | 26 passed (27)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T1-M2: バイトではなく文字数で数える
変異: src/messages.ts: `new TextEncoder().encode(t).byteLength` → `t.length`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 本文は UTF-8 で 1MB まで受け、超えたら弾く（空は通す——サーバが empty_agent_prompt で返す） 10ms
     FAIL  src/messages.test.ts > AgentPromptParams / AgentSendKeysParams > 本文は UTF-8 で 1MB まで受け、超えたら弾く（空は通す——サーバが empty_agent_prompt で返す）
    AssertionError: expected [Function] to throw an error
          Tests  1 failed | 26 passed (27)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T1-M3: キー 0 個を通す
変異: src/messages.ts: `z.array(z.string()).min(1).max(256)` → `z.array(z.string()).max(256)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × キーは 1〜256 個 7ms
     FAIL  src/messages.test.ts > AgentPromptParams / AgentSendKeysParams > キーは 1〜256 個
    AssertionError: expected [Function] to throw an error
          Tests  1 failed | 26 passed (27)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T1-M4: キーの上限を外す
変異: src/messages.ts: `z.array(z.string()).min(1).max(256)` → `z.array(z.string()).min(1)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × キーは 1〜256 個 7ms
     FAIL  src/messages.test.ts > AgentPromptParams / AgentSendKeysParams > キーは 1〜256 個
    AssertionError: expected [Function] to throw an error
          Tests  1 failed | 26 passed (27)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T1-M5: 方式の表から agent.prompt を外す
変異: src/messages.ts: `"agent.prompt": AgentPromptParams,` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 方式の表にある 8ms
     FAIL  src/messages.test.ts > AgentPromptParams / AgentSendKeysParams > 方式の表にある
    AssertionError: expected undefined to be ZodObject{ _zod: { …(9) }, …(3) } // Object.is equality
          Tests  1 failed | 26 passed (27)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t2

```
## T2-M1: bracketed paste でも包まない
変異: src/agent/agentInput.ts: `return bracketedPaste ? `${ESC}[200~${text}${ESC}[201~` : text;` → `return text;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × bracketed paste が有効なら ESC[200~ と ESC[201~ で包み、無効なら包まない 21ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > bracketed paste が有効なら ESC[200~ と ESC[201~ で包み、無効なら包まない
    AssertionError: expected 'a\nb' to be '\u001b[200~a\nb\u001b[201~' // Object.is equality
          Tests  1 failed | 67 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M2: 遅延を 0 に
変異: src/agent/agentInput.ts: `AGENT_PROMPT_SUBMIT_DELAY_MS = 300` → `AGENT_PROMPT_SUBMIT_DELAY_MS = 0`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × Enter までの遅延は herdr と同じ 300ms 22ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > Enter までの遅延は herdr と同じ 300ms
    AssertionError: expected +0 to be 300 // Object.is equality
          Tests  1 failed | 67 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M3: 空の部分を許す
変異: src/agent/agentInput.ts: `if (part === "") return null;` → `if (part === "") continue;`
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  68 passed (68)

## T2-M4: キーが 2 つ以上でも通す
変異: src/agent/agentInput.ts: `if (key !== null) return null;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 不明なキー名は null: "super+a" 13ms
         × 不明なキー名は null: "cmd+c" 4ms
         × 不明なキー名は null: "ctrl+a+b" 4ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "super+a"
    AssertionError: expected { key: 'a', ctrl: false, …(2) } to be null
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "cmd+c"
          Tests  3 failed | 65 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

## T2-M5: C-c の別名を外す
変異: src/agent/agentInput.ts: `if (name === "C-c" || name === "c-c") return "ctrl+c";` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × C-c 14ms
         × c-c 2ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > C-c
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > c-c
    AssertionError: expected null to be '\u0003' // Object.is equality
          Tests  2 failed | 66 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M6: 大文字に shift を付けない
変異: src/agent/agentInput.ts: `return { ...spec, key: key.toLowerCase(), shift: true };` → `return { ...spec, key };`
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  68 passed (68)

## T2-M7: f13 以上も受ける
変異: src/agent/agentInput.ts: `/^f([1-9]|1[0-2])$/i` → `/^f(\d+)$/i`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 不明なキー名は null: "f13" 5ms
         × 不明なキー名は null: "f0" 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "f13"
    AssertionError: expected { key: 'f13', ctrl: false, …(2) } to be null
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "f0"
    AssertionError: expected { key: 'f0', ctrl: false, …(2) } to be null
          Tests  2 failed | 66 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M8: アプリケーションカーソルを無視
変異: src/agent/agentInput.ts: `return modes.applicationCursorKeys ? `${ESC}O${arrow}` : `${ESC}[${arrow}`;` → `return `${ESC}[${arrow}`;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 矢印はアプリケーションカーソルモードでは ESC O で送る（修飾つきは CSI のまま） 7ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 矢印はアプリケーションカーソルモードでは ESC O で送る（修飾つきは CSI のまま）
    AssertionError: expected '\u001b[A' to be '\u001bOA' // Object.is equality
          Tests  1 failed | 67 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M9: 修飾つき矢印を修飾なしで送る
変異: src/agent/agentInput.ts: `if (m > 1) return `${ESC}[1;${m}${arrow}`;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × shift+up 7ms
         × ctrl+left 1ms
         × alt+shift+right 2ms
         × 矢印はアプリケーションカーソルモードでは ESC O で送る（修飾つきは CSI のまま） 2ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > shift+up
    AssertionError: expected '\u001b[A' to be '\u001b[1;2A' // Object.is equality
          Tests  4 failed | 64 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

## T2-M10: 修飾パラメータの alt の重みを誤る
変異: src/agent/agentInput.ts: `(spec.alt ? 2 : 0)` → `(spec.alt ? 3 : 0)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × alt+shift+right 8ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > alt+shift+right
    AssertionError: expected '\u001b[1;5C' to be '\u001b[1;4C' // Object.is equality
          Tests  1 failed | 67 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M11: F5 以降の符号を誤る（F11 を 22 に）
変異: src/agent/agentInput.ts: `f11: 23` → `f11: 22`
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  68 passed (68)

## T2-M12: ctrl+enter を通す
変異: src/agent/agentInput.ts: `return spec.ctrl || spec.shift ? null : altPrefix("\r");` → `return altPrefix("\r");`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 符号化できない組み合わせは null: ctrl+enter 6ms
         × 符号化できない組み合わせは null: shift+enter 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 符号化できない組み合わせは null: ctrl+enter
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 符号化できない組み合わせは null: shift+enter
    AssertionError: expected '\r' to be null
          Tests  2 failed | 66 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M13: shift+tab を tab に
変異: src/agent/agentInput.ts: `if (spec.shift) return spec.alt ? null : `${ESC}[Z`;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × shift+tab 7ms
         × 符号化できない組み合わせは null: alt+shift+tab 2ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > shift+tab
    AssertionError: expected '\t' to be '\u001b[Z' // Object.is equality
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 符号化できない組み合わせは null: alt+shift+tab
    AssertionError: expected '\u001b\t' to be null
          Tests  2 failed | 66 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M14: ctrl+数字などを通す
変異: src/agent/agentInput.ts: `return code === null ? null : altPrefix(code);` → `return altPrefix(code ?? c);`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 符号化できない組み合わせは null: ctrl+1 5ms
         × 符号化できない組み合わせは null: ctrl+minus 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 符号化できない組み合わせは null: ctrl+1
    AssertionError: expected '1' to be null
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 符号化できない組み合わせは null: ctrl+minus
    AssertionError: expected '-' to be null
          Tests  2 failed | 66 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M15: alt の ESC 接頭辞を付けない
変異: src/agent/agentInput.ts: `const altPrefix = (s: string): string => (spec.alt ? `${ESC}${s}` : s);` → `const altPrefix = (s: string): string => s;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × alt+x 8ms
         × meta+enter 1ms
         × alt+backspace 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > alt+x
    AssertionError: expected 'x' to be '\u001bx' // Object.is equality
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > meta+enter
          Tests  3 failed | 65 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

## T2-M16: shift を記号にも効かせる（大文字化）
変異: src/agent/agentInput.ts: `spec.shift && /^[a-z]$/.test(c) ? c.toUpperCase() : c` → `spec.shift ? c.toUpperCase() + (/^[a-z]$/.test(c) ? "" : "!") : c`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × shift+minus 6ms
         × shift+space 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > shift+minus
    AssertionError: expected '-!' to be '-' // Object.is equality
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > shift+space
    AssertionError: expected ' !' to be ' ' // Object.is equality
          Tests  2 failed | 66 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M17: super を修飾として受ける
変異: src/agent/agentInput.ts: `shift: "shift",
};` → `shift: "shift",
  super: "ctrl",
};`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 不明なキー名は null: "super+a" 6ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "super+a"
    AssertionError: expected { key: 'a', ctrl: true, …(2) } to be null
          Tests  1 failed | 67 passed (68)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t2b

```
## T2-M3（再）: 空の部分を許す
変異: src/agent/agentInput.ts: `if (part === "") return null;` → `if (part === "") continue;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 不明なキー名は null: "+a" 6ms
         × 不明なキー名は null: "a+" 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "+a"
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > 不明なキー名は null: "a+"
    AssertionError: expected { key: 'a', ctrl: false, …(2) } to be null
          Tests  2 failed | 75 passed (77)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T2-M6（再）: 大文字に shift を付けない
変異: src/agent/agentInput.ts: `return { ...spec, key: key.toLowerCase(), shift: true };` → `return { ...spec, key };`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × ctrl+A 7ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > ctrl+A
    AssertionError: expected null to be '\u0001' // Object.is equality
          Tests  1 failed | 76 passed (77)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M11（再）: F5 以降の符号を誤る（F11 を 22 に）
変異: src/agent/agentInput.ts: `f11: 23` → `f11: 22`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × f11 10ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > f11
    AssertionError: expected '\u001b[22~' to be '\u001b[23~' // Object.is equality
          Tests  1 failed | 76 passed (77)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t23c

```
## T2-M18: alt+esc の ESC 接頭辞を外す
変異: src/agent/agentInput.ts: `return spec.ctrl || spec.shift ? null : altPrefix(ESC);` → `return spec.ctrl || spec.shift ? null : ESC;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × alt+esc 6ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > alt+esc
    AssertionError: expected '\u001b' to be '\u001b\u001b' // Object.is equality
          Tests  1 failed | 101 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M19: alt+tab の ESC 接頭辞を外す
変異: src/agent/agentInput.ts: `return altPrefix("\t");` → `return "\t";`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × alt+tab 6ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > alt+tab
    AssertionError: expected '\t' to be '\u001b\t' // Object.is equality
          Tests  1 failed | 101 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M20: ctrl+alt の ESC 接頭辞を外す
変異: src/agent/agentInput.ts: `return code === null ? null : altPrefix(code);` → `return code;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × ctrl+alt+a 7ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > ctrl+alt+a
    AssertionError: expected '\u0001' to be '\u001b\u0001' // Object.is equality
          Tests  1 failed | 101 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M21: ctrl と組める記号を [ だけに
変異: src/agent/agentInput.ts: `if ("@[\\]^_".includes(c))` → `if ("[".includes(c))`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × ctrl+@ 7ms
         × ctrl+backslash 1ms
         × ctrl+] 1ms
         × ctrl+^ 1ms
         × ctrl+_ 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > ctrl+@
          Tests  5 failed | 97 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

## T2-M22: 記号名 comma を消す
変異: src/agent/agentInput.ts: `comma: ",",` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × comma 5ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > comma
    AssertionError: expected null to be ',' // Object.is equality
          Tests  1 failed | 101 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M23: 修飾の別名 option を消す
変異: src/agent/agentInput.ts: `option: "alt",` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × option+x 6ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > option+x
    AssertionError: expected null to be '\u001bx' // Object.is equality
          Tests  1 failed | 101 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T2-M24: 修飾名の大小を区別する
変異: src/agent/agentInput.ts: `MODIFIERS[part.toLowerCase()]` → `MODIFIERS[part]`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × Ctrl+C 6ms
         × CTRL+x 1ms
         × Alt+x 1ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > Ctrl+C
    AssertionError: expected null to be '\u0003' // Object.is equality
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > CTRL+x
          Tests  3 failed | 99 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

## T2-M25: F キーの大小を区別する
変異: src/agent/agentInput.ts: `/^f([1-9]|1[0-2])$/i` → `/^f([1-9]|1[0-2])$/`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × F5 6ms
     FAIL  src/agent/agentInput.test.ts > parseKey / encodeKey（xterm の既定の符号化） > F5
    AssertionError: expected null to be '\u001b[15~' // Object.is equality
          Tests  1 failed | 101 passed (102)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T3-M4: flush をタイマー 1 回分を待つだけにする
変異: src/terminal/Mirror.ts: `return new Promise((resolve) => this.term.write("", resolve));` → `return new Promise((resolve) => setTimeout(resolve, 0));`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 大きな出力の後ろのモードの切り替えも、flush はその処理を待つ（タイマー 1 回分を待つだけでは足りない） 49ms
     FAIL  src/terminal/Mirror.test.ts > XtermMirror — inputModes / flush（20260926-agent-prompt-send-keys） > 大きな出力の後ろのモードの切り替えも、flush はその処理を待つ（タイマー 1 回分を待つだけでは足りない）
    AssertionError: expected false to be true // Object.is equality
          Tests  1 failed | 31 passed (32)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t3

```
## T3-M1: flush が処理を待たずに解決する
変異: src/terminal/Mirror.ts: `return new Promise((resolve) => this.term.write("", resolve));` → `return Promise.resolve();`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 書いた直後ではなく、flush の後にモードの切り替えが反映される（送る瞬間のモードを読むには flush を待つ） 15ms
     FAIL  src/terminal/Mirror.test.ts > XtermMirror — inputModes / flush（20260926-agent-prompt-send-keys） > 書いた直後ではなく、flush の後にモードの切り替えが反映される（送る瞬間のモードを読むには flush を待つ）
    AssertionError: expected { bracketedPaste: false, …(1) } to deeply equal { bracketedPaste: true, …(1) }
          Tests  1 failed | 30 passed (31)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T3-M2: bracketed paste のモードを常に false
変異: src/terminal/Mirror.ts: `bracketedPaste: this.term.modes.bracketedPasteMode,` → `bracketedPaste: false,`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 書いた直後ではなく、flush の後にモードの切り替えが反映される（送る瞬間のモードを読むには flush を待つ） 13ms
     FAIL  src/terminal/Mirror.test.ts > XtermMirror — inputModes / flush（20260926-agent-prompt-send-keys） > 書いた直後ではなく、flush の後にモードの切り替えが反映される（送る瞬間のモードを読むには flush を待つ）
    AssertionError: expected { bracketedPaste: false, …(1) } to deeply equal { bracketedPaste: true, …(1) }
          Tests  1 failed | 30 passed (31)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T3-M3: アプリケーションカーソルのモードを常に false
変異: src/terminal/Mirror.ts: `applicationCursorKeys: this.term.modes.applicationCursorKeysMode,` → `applicationCursorKeys: false,`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 書いた直後ではなく、flush の後にモードの切り替えが反映される（送る瞬間のモードを読むには flush を待つ） 23ms
     FAIL  src/terminal/Mirror.test.ts > XtermMirror — inputModes / flush（20260926-agent-prompt-send-keys） > 書いた直後ではなく、flush の後にモードの切り替えが反映される（送る瞬間のモードを読むには flush を待つ）
    AssertionError: expected { bracketedPaste: true, …(1) } to deeply equal { bracketedPaste: true, …(1) }
          Tests  1 failed | 30 passed (31)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t4

```
## T4-M1: 送信中の write を後回しにしない
変異: src/terminal/TerminalHost.ts: `if (this.busy) {
      this.queue.push({ kind: "raw", data: input });
      return;
    }` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3） 27ms
         × 送信中に来た別のモード付き入力は、それまでに後回しにした入力の後で、順番に処理される 10ms
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 6ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3）
    AssertionError: expected [ 'x', 'TEXT', 'y', 'z' ] to deeply equal [ 'TEXT' ]
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に来た別のモード付き入力は、それまでに後回しにした入力の後で、順番に処理される
          Tests  3 failed | 5 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

## T4-M2: 送信中のモード付き入力を並べず即座に始める
変異: src/terminal/TerminalHost.ts: `if (this.busy) this.queue.push({ kind: "modal", job });
      else void this.runModal(job)` → `void this.runModal(job);`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に来た別のモード付き入力は、それまでに後回しにした入力の後で、順番に処理される 5020ms
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 5005ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に来た別のモード付き入力は、それまでに後回しにした入力の後で、順番に処理される
    Error: Test timed out in 5000ms.
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    Error: Test timed out in 5000ms.
          Tests  2 failed | 6 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T4-M3: flush を待たずにモードを読む
変異: src/terminal/TerminalHost.ts: `await this.mirror.flush();` → `await Promise.resolve();`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × build は送る瞬間のモードで呼ばれる: 直前の出力の bracketed paste の切り替えも flush してから読む（AC1） 23ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > build は送る瞬間のモードで呼ばれる: 直前の出力の bracketed paste の切り替えも flush してから読む（AC1）
    AssertionError: expected [ false, true ] to deeply equal [ true, false ]
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M4: 部分の間の遅延を置かない
変異: src/terminal/TerminalHost.ts: `await this.delay(job.input.delayMs);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 部分の間に delayMs を置く: 本文の後 299ms では Enter が無く、300ms で書かれてから解決する（AC2） 38ms
         × 送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3） 19ms
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 6ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 部分の間に delayMs を置く: 本文の後 299ms では Enter が無く、300ms で書かれてから解決する（AC2）
    AssertionError: expected [ 'TEXT', '\r' ] to deeply equal [ 'TEXT' ]
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3）
          Tests  3 failed | 5 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

## T4-M5: 遅延の後に終了を確かめない
変異: src/terminal/TerminalHost.ts: `await this.delay(job.input.delayMs);
          if (this.activeModal !== job) return;` → `await this.delay(job.input.delayMs);`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 25ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    AssertionError: expected [ 'TEXT', '\r' ] to deeply equal [ 'TEXT' ]
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M6: flush の後に終了を確かめない
変異: src/terminal/TerminalHost.ts: `if (this.activeModal !== job) return; // 待っている間に終了した（closeInput が reject 済み）` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × flush を待っている間に PTY が終了したら reject し、何も書かない 40ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > flush を待っている間に PTY が終了したら reject し、何も書かない
    AssertionError: expected [ 'TEXT' ] to deeply equal []
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M7: PTY の終了で入力を閉じない
変異: src/terminal/TerminalHost.ts: `this.closeInput();
        for (const fn` → `for (const fn`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × flush を待っている間に PTY が終了したら reject し、何も書かない 29ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > flush を待っている間に PTY が終了したら reject し、何も書かない
    AssertionError: expected undefined to be 'terminal closed' // Object.is equality
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M8: dispose で入力を閉じない
変異: src/terminal/TerminalHost.ts: `this.disposed = true;
    this.closeInput();` → `this.disposed = true;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 5009ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    Error: Test timed out in 5000ms.
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M9: 閉じたとき後回しのモード付き入力を reject しない
変異: src/terminal/TerminalHost.ts: `if (q.kind === "modal") q.job.reject(err);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 5040ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    Error: Test timed out in 5000ms.
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M10: 閉じたとき busy を戻さない
変異: src/terminal/TerminalHost.ts: `if (q.kind === "modal") q.job.reject(err);
    }
    this.busy = false;` → `if (q.kind === "modal") q.job.reject(err);
    }`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 112ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    AssertionError: expected [ 'TEXT' ] to deeply equal [ 'TEXT', 'late' ]
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M11: 後回しを空にしたとき busy を戻さない
変異: src/terminal/TerminalHost.ts: `}
    }
    this.busy = false;
  }` → `}
    }
  }`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3） 50ms
         × build は送る瞬間のモードで呼ばれる: 直前の出力の bracketed paste の切り替えも flush してから読む（AC1） 5013ms
         × build が投げたら reject し、後回しの入力はそのまま処理を続ける 29ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に届いた write は Enter の後に元の順序で書かれ、終わった後の write は即座に書かれる（AC3）
    AssertionError: expected 'z' to be 'after' // Object.is equality
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > build は送る瞬間のモードで呼ばれる: 直前の出力の bracketed paste の切り替えも flush してから読む（AC1）
          Tests  3 failed | 5 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

## T4-M12: build が投げても次へ進まない（drain しない）
変異: src/terminal/TerminalHost.ts: `job.reject(err instanceof Error ? err : new Error(String(err)));
    }
    this.drainQueue` → `job.reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    t`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × build が投げたら reject し、後回しの入力はそのまま処理を続ける 58ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > build が投げたら reject し、後回しの入力はそのまま処理を続ける
    AssertionError: expected [] to deeply equal [ 'next' ]
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T4-M13: 閉じた後の writeModal を受け付ける
変異: src/terminal/TerminalHost.ts: `if (this.inputClosed) return Promise.reject(new Error("terminal closed"));` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 5048ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    Error: Test timed out in 5000ms.
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t4b

```
## T4-M14: 閉じたとき遅延のタイマーを解除しない
変異: src/terminal/TerminalHost.ts: `if (this.delayTimer !== null) clearTimeout(this.delayTimer);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く 7ms
     FAIL  src/terminal/TerminalHost.test.ts > DefaultTerminalHost.writeModal > 送信中に破棄されたら reject し、残りの部分は書かず、後回しの入力を捨て、以後の write は即座に書く
    AssertionError: expected 1 to be +0 // Object.is equality
          Tests  1 failed | 7 passed (8)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t5

```
## T5-M1: blocked でも送る
変異: src/surface/methods/agent.ts: `if (agent.state === "blocked") {` → `if (false) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × blocked のエージェントには何も書かずに agent_blocked（AC5） 11ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > blocked のエージェントには何も書かずに agent_blocked（AC5）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"blocked","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M2: 空の本文を通す
変異: src/surface/methods/agent.ts: `if (params.text === "")` → `if (false)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 空の本文は書かずに empty_agent_prompt（AC5） 10ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 空の本文は書かずに empty_agent_prompt（AC5）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M3: エージェントの居ない pane にも送る
変異: src/surface/methods/agent.ts: `if (!pane.agent) throw new RpcError("agent_not_found", `no agent detected in pane: ${paneI` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × pane が無い・エージェントが居ない・端末が無いときは書かずに agent_not_found（AC5） 21ms
         × pane が無い・エージェントが居ないと agent_not_found、キーが 0 個は invalid_params（AC11） 3ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > pane が無い・エージェントが居ない・端末が無いときは書かずに agent_not_found（AC5）
    AssertionError: expected 'internal' to be 'agent_not_found' // Object.is equality
     FAIL  src/surface/methods/agent.test.ts > agent.send_keys > pane が無い・エージェントが居ないと agent_not_found、キーが 0 個は invalid_params（AC11）
    Error: expected an error, got {}
          Tests  2 failed | 12 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T5-M4: Enter までの遅延を 0 に
変異: src/surface/methods/agent.ts: `delayMs: AGENT_PROMPT_SUBMIT_DELAY_MS,` → `delayMs: 0,`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 本文と Enter を 2 部分にして 300ms の間を置くモード付き入力として書き、送信を始めた時点のエージェントを返す（AC2・AC4） 65ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 本文と Enter を 2 部分にして 300ms の間を置くモード付き入力として書き、送信を始めた時点のエージェントを返す（AC2・AC4）
    AssertionError: expected +0 to be 300 // Object.is equality
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M5: モードに依らず包まない
変異: src/surface/methods/agent.ts: `pastePayload(params.text, modes.bracketedPaste)` → `pastePayload(params.text, false)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × bracketed paste が有効な瞬間なら本文を ESC[200~…ESC[201~ で包む（AC1） 26ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > bracketed paste が有効な瞬間なら本文を ESC[200~…ESC[201~ で包む（AC1）
    AssertionError: expected [ 'a\nb', '\r' ] to deeply equal [ '\u001b[200~a\nb\u001b[201~', '\r' ]
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M6: Enter を本文と同じ部分にする
変異: src/surface/methods/agent.ts: `[pastePayload(params.text, modes.bracketedPaste), "\r"]` → `[pastePayload(params.text, modes.bracketedPaste) + "\r"]`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 本文と Enter を 2 部分にして 300ms の間を置くモード付き入力として書き、送信を始めた時点のエージェントを返す（AC2・AC4） 36ms
         × bracketed paste が有効な瞬間なら本文を ESC[200~…ESC[201~ で包む（AC1） 4ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 本文と Enter を 2 部分にして 300ms の間を置くモード付き入力として書き、送信を始めた時点のエージェントを返す（AC2・AC4）
    AssertionError: expected [ 'line1\nline2\r' ] to deeply equal [ 'line1\nline2', '\r' ]
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > bracketed paste が有効な瞬間なら本文を ESC[200~…ESC[201~ で包む（AC1）
    AssertionError: expected [ '\u001b[200~a\nb\u001b[201~\r' ] to deeply equal [ '\u001b[200~a\nb\u001b[201~', '\r' ]
          Tests  2 failed | 12 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T5-M7: 符号化できない組み合わせを事前に弾かない
変異: src/surface/methods/agent.ts: `if (spec === null || encodeKey(spec, NO_MODES) === null) {` → `if (spec === null) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 不明なキー名・符号化できない組み合わせが 1 つでもあれば何も書かずに invalid_key（AC11） 20ms
     FAIL  src/surface/methods/agent.test.ts > agent.send_keys > 不明なキー名・符号化できない組み合わせが 1 つでもあれば何も書かずに invalid_key（AC11）
    Error: expected an error, got {}
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M8: send_keys でモードを無視する
変異: src/surface/methods/agent.ts: `specs.map((s) => encodeKey(s, modes) ?? "")` → `specs.map((s) => encodeKey(s, NO_MODES) ?? "")`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × キー列をモードに合わせて符号化し、1 部分・遅延なしで書く。blocked でも送れる（AC10） 26ms
     FAIL  src/surface/methods/agent.test.ts > agent.send_keys > キー列をモードに合わせて符号化し、1 部分・遅延なしで書く。blocked でも送れる（AC10）
    AssertionError: expected [ '\u001b\u001b[A\u0003\r' ] to deeply equal [ '\u001b\u001bOA\u0003\r' ]
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M9: prompt で操作を記録しない
変異: src/surface/methods/agent.ts: `deps.sizeAuthority.noteInteraction(ctx.clientId, params.paneId);
      try {
        await` → `try {
        await host.writeModal({
          build: (modes) => [pastePayload`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 本文と Enter を 2 部分にして 300ms の間を置くモード付き入力として書き、送信を始めた時点のエージェントを返す（AC2・AC4） 21ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 本文と Enter を 2 部分にして 300ms の間を置くモード付き入力として書き、送信を始めた時点のエージェントを返す（AC2・AC4）
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'c1', 'p1' ]
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M10: 送信の失敗を agent_prompt_failed にしない
変異: src/surface/methods/agent.ts: `throw new RpcError("agent_prompt_failed"` → `throw new RpcError("internal"`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中に端末が閉じたら agent_prompt_failed 19ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 送信中に端末が閉じたら agent_prompt_failed
    AssertionError: expected { ok: false, error: { …(2) } } to deeply equal { ok: false, error: { …(2) } }
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M11: 端末が無いのを確かめない
変異: src/surface/methods/agent.ts: `if (!host) throw new RpcError("agent_not_found", `pane not found: ${paneId}`);` → `if (!host) return { agent: pane.agent, host: { writeModal: async () => undefined } as unkn`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × pane が無い・エージェントが居ない・端末が無いときは書かずに agent_not_found（AC5） 12ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > pane が無い・エージェントが居ない・端末が無いときは書かずに agent_not_found（AC5）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
          Tests  1 failed | 13 passed (14)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t5b

```
## T5-M12: 書く直前に blocked を確かめない
変異: src/surface/methods/agent.ts: `if (now.state === "blocked") throw blockedError(params.paneId);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 受け付けた後、書く直前までに blocked になったら何も書かずに agent_blocked（ダイアログへの誤答を防ぐ） 8ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 受け付けた後、書く直前までに blocked になったら何も書かずに agent_blocked（ダイアログへの誤答を防ぐ）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
          Tests  1 failed | 15 passed (16)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M13: 書く直前に入れ替わりを確かめない
変異: src/surface/methods/agent.ts: `now === null || now.instanceId !== agent.instanceId` → `now === null`
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  16 passed (16)

## T5-M14: 書く直前の検査の code を agent_prompt_failed に潰す
変異: src/surface/methods/agent.ts: `if (err instanceof RpcError) throw err;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 受け付けた後、書く直前までに blocked になったら何も書かずに agent_blocked（ダイアログへの誤答を防ぐ） 14ms
         × 書く直前までにエージェントが居なくなった・入れ替わったら何も書かずに agent_not_found（シェルへ流さない） 5ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 受け付けた後、書く直前までに blocked になったら何も書かずに agent_blocked（ダイアログへの誤答を防ぐ）
    AssertionError: expected 'agent_prompt_failed' to be 'agent_blocked' // Object.is equality
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 書く直前までにエージェントが居なくなった・入れ替わったら何も書かずに agent_not_found（シェルへ流さない）
    AssertionError: expected 'agent_prompt_failed' to be 'agent_not_found' // Object.is equality
          Tests  2 failed | 14 passed (16)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

```

### t5c

```
## T5-M13（再）: 書く直前に入れ替わりを確かめない
変異: src/surface/methods/agent.ts: `now === null || now.instanceId !== agent.instanceId` → `now === null`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 書く直前までにエージェントが居なくなった・入れ替わったら何も書かずに agent_not_found（シェルへ流さない） 5ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 書く直前までにエージェントが居なくなった・入れ替わったら何も書かずに agent_not_found（シェルへ流さない）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
          Tests  1 failed | 15 passed (16)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t5d

```
## T5-M15: send_keys で書く直前に入れ替わりを確かめない
変異: src/surface/methods/agent.ts: `requireSameAgent(deps, params.paneId, agent);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 書く直前までにエージェントが入れ替わっていたら何も書かずに agent_not_found（decisions.md D7） 9ms
     FAIL  src/surface/methods/agent.test.ts > agent.send_keys > 書く直前までにエージェントが入れ替わっていたら何も書かずに agent_not_found（decisions.md D7）
    Error: expected an error, got {}
          Tests  1 failed | 16 passed (17)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T5-M16: requireSameAgent で入れ替わりを見ない
変異: src/surface/methods/agent.ts: `now === null || now.instanceId !== expected.instanceId` → `now === null`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 書く直前までにエージェントが居なくなった・入れ替わったら何も書かずに agent_not_found（シェルへ流さない） 5ms
         × 書く直前までにエージェントが入れ替わっていたら何も書かずに agent_not_found（decisions.md D7） 1ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 書く直前までにエージェントが居なくなった・入れ替わったら何も書かずに agent_not_found（シェルへ流さない）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
     FAIL  src/surface/methods/agent.test.ts > agent.send_keys > 書く直前までにエージェントが入れ替わっていたら何も書かずに agent_not_found（decisions.md D7）
    Error: expected an error, got {}
          Tests  2 failed | 15 passed (17)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T5-M17: prompt で書く直前に blocked を確かめない
変異: src/surface/methods/agent.ts: `if (now.state === "blocked") throw blockedError(params.paneId);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 受け付けた後、書く直前までに blocked になったら何も書かずに agent_blocked（ダイアログへの誤答を防ぐ） 6ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 受け付けた後、書く直前までに blocked になったら何も書かずに agent_blocked（ダイアログへの誤答を防ぐ）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
          Tests  1 failed | 16 passed (17)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### cross

```
## X-M1: 受け付けた時点のエージェントを返す
変異: src/surface/methods/agent.ts: `sentTo = now;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 返すのは本文を書く直前のエージェント（受け付けた時点の working から idle に戻っていれば idle） 9ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 返すのは本文を書く直前のエージェント（受け付けた時点の working から idle に戻っていれば idle）
    AssertionError: expected { ok: true, …(1) } to deeply equal { ok: true, …(1) }
          Tests  1 failed | 17 passed (18)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t6

```
## T6-M1: --wait 無しの --until/--timeout を許す
変異: src/cliArgs.ts: `if (!wait && (timeoutRaw !== undefined || untilRaw.length > 0)) {` → `if (false) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 使い方の誤り: ["agent","prompt","p1","hi","--until","idle"] 10ms
         × 使い方の誤り: ["agent","prompt","p1","hi","--timeout","1000"] 2ms
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","--until","idle"]
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","--timeout","1000"]
    AssertionError: expected function to throw an error, but it didn't
          Tests  2 failed | 88 passed (90)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T6-M2: --wait 無しの --timeout だけ許す
変異: src/cliArgs.ts: `if (!wait && (timeoutRaw !== undefined || untilRaw.length > 0)) {` → `if (!wait && untilRaw.length > 0) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 使い方の誤り: ["agent","prompt","p1","hi","--timeout","1000"] 8ms
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","--timeout","1000"]
    AssertionError: expected function to throw an error, but it didn't
          Tests  1 failed | 89 passed (90)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T6-M3: 未知の状態名を検査しない
変異: src/cliArgs.ts: `until: untilRaw.map(parseAgentStatus),` → `until: untilRaw as AgentStatus[],`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 使い方の誤り: ["agent","prompt","p1","hi","--wait","--until","finished"] 9ms
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","--wait","--until","finished"]
    AssertionError: expected function to throw an error, but it didn't
          Tests  1 failed | 89 passed (90)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T6-M4: SKIP（old の出現が 2 回）

## T6-M5: send-keys のキー 0 個を許す
変異: src/cliArgs.ts: `if (keys.length === 0) throw new CliUsageError("missing key", USAGE);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 使い方の誤り: ["agent","send-keys","p1"] 9ms
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","send-keys","p1"]
    AssertionError: expected function to throw an error, but it didn't
          Tests  1 failed | 89 passed (90)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T6-M6: --timeout の上限を検査しない
変異: src/cliArgs.ts: `timeoutMs: timeoutRaw === undefined ? undefined : parseTimerMs(timeoutRaw),
    };
  }
  i` → `timeoutMs: timeoutRaw === undefined ? undefined : Number(timeoutRaw),
    };
  }
  if (sub`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 使い方の誤り: ["agent","prompt","p1","hi","--wait","--timeout","0"] 8ms
         × 使い方の誤り: ["agent","prompt","p1","hi","--wait","--timeout","2147483648"] 1ms
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","--wait","--timeout","0"]
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","--wait","--timeout","2147483648"]
    AssertionError: expected function to throw an error, but it didn't
          Tests  2 failed | 88 passed (90)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

```

### t6b

```
## T6-M4: prompt の余分な位置引数を許す
変異: src/cliArgs.ts: `rejectExtra(positionals, 2, USAGE);
    const wait = bools.has("--wait");` → `const wait = bools.has("--wait");`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 使い方の誤り: ["agent","prompt","p1","hi","extra"] 6ms
     FAIL  src/cliArgs.test.ts > parseArgs — agent > 使い方の誤り: ["agent","prompt","p1","hi","extra"]
    AssertionError: expected function to throw an error, but it didn't
          Tests  1 failed | 89 passed (90)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t11

```
## T11-M1: 活動の確認をしない（until だけで一致）
変異: src/agentStatus.ts: `this.activity && this.until.includes(status)` → `this.until.includes(status)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 活動を観測するまでは、until に含まれる idle・done でも一致しない（AC6） 23ms
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > 活動を観測するまでは、until に含まれる idle・done でも一致しない（AC6）
    AssertionError: expected 'match' to be 'pending' // Object.is equality
          Tests  1 failed | 29 passed (30)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T11-M2: blocked を活動として数えない
変異: src/agentStatus.ts: `status === "working" || status === "blocked"` → `status === "working"`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 活動として観測した blocked が until に含まれていれば、それで一致する（既定の until）（AC8） 44ms
         × until を絞れば、活動の後でもそれ以外では一致しない（--until の複数指定）（AC8） 3ms
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > 活動として観測した blocked が until に含まれていれば、それで一致する（既定の until）（AC8）
    AssertionError: expected 'pending' to be 'match' // Object.is equality
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > until を絞れば、活動の後でもそれ以外では一致しない（--until の複数指定）（AC8）
    AssertionError: expected 'pending' to be 'match' // Object.is equality
          Tests  2 failed | 28 passed (30)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T11-M3: working を活動として数えない
変異: src/agentStatus.ts: `status === "working" || status === "blocked"` → `status === "blocked"`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × working を観測した後は、until のどれかで一致する（AC8） 20ms
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > working を観測した後は、until のどれかで一致する（AC8）
    AssertionError: expected false to be true // Object.is equality
          Tests  1 failed | 29 passed (30)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T11-M4: 入れ替わりを見ない
変異: src/agentStatus.ts: `current === null || current.instanceId !== this.expectedInstanceId` → `current === null`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 居なくなった・入れ替わったら gone（活動の前でも後でも）（AC9） 22ms
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > 居なくなった・入れ替わったら gone（活動の前でも後でも）（AC9）
    AssertionError: expected 'match' to be 'gone' // Object.is equality
          Tests  1 failed | 29 passed (30)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T11-M5: 上限を 3000ms に
変異: src/agentStatus.ts: `PROMPT_EFFECT_TIMEOUT_MS = 5000` → `PROMPT_EFFECT_TIMEOUT_MS = 3000`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 活動の確認の上限は herdr と同じ 5000ms 46ms
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > 活動の確認の上限は herdr と同じ 5000ms
    AssertionError: expected 3000 to be 5000 // Object.is equality
          Tests  1 failed | 29 passed (30)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T11-M6: 初期の活動の観測を無視する
変異: src/agentStatus.ts: `this.activity = activityObserved;` → `this.activity = false;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信前から working なら活動を観測済みとして始める（idle ですぐ一致・until に working があれば working で一致）（AC8） 22ms
     FAIL  src/agentStatus.test.ts > PromptWait（agent prompt --wait の活動の確認 → 状態待ち） > 送信前から working なら活動を観測済みとして始める（idle ですぐ一致・until に working があれば working で一致）（AC8）
    AssertionError: expected 'pending' to be 'match' // Object.is equality
          Tests  1 failed | 29 passed (30)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t12

```
## T12-M1: agent_blocked の文言を消す（汎用の文言に落ちる）
変異: src/net/clientError.ts: `agent_blocked: "エージェントが承認・質問の入力待ちのため、送りませんでした。",` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × agent_blocked 17ms
     FAIL  src/net/clientError.test.ts > エージェントへの入力のエラー（20260926-agent-prompt-send-keys） > agent_blocked
    AssertionError: expected 'サーバでエラーが起きました（agent_blocked）。' not to contain 'agent_blocked'
          Tests  1 failed | 19 passed (20)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T12-M2: invalid_key の文言を消す
変異: src/net/clientError.ts: `invalid_key: "知らないキーの名前が含まれていたため、何も送りませんでした。",` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × invalid_key 20ms
     FAIL  src/net/clientError.test.ts > エージェントへの入力のエラー（20260926-agent-prompt-send-keys） > invalid_key
    AssertionError: expected 'サーバでエラーが起きました（invalid_key）。' not to contain 'invalid_key'
          Tests  1 failed | 19 passed (20)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t7

```
## T7-M1: 要求を送る前の状態も活動として数える
変異: src/commands/agent.ts: `if (!submitted) return;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 要求を送る前の working は数えず、送った後の idle だけでは返らない。working を観測した後の idle（done）で返る（AC6・AC8） 254ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 要求を送る前の working は数えず、送った後の idle だけでは返らない。working を観測した後の idle（done）で返る（AC6・AC8）
    AssertionError: expected { paneId: 'p1', …(11) } to match object { status: 'done', completionSeq: 2 }
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M2: 残りが 5 秒以下でも stalled のタイマーを張る
変異: src/commands/agent.ts: `if (remaining > PROMPT_EFFECT_TIMEOUT_MS) {` → `if (true) {`
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  48 passed (48)

## T7-M3: stalled のタイマーを張らない
変異: src/commands/agent.ts: `if (remaining > PROMPT_EFFECT_TIMEOUT_MS) {` → `if (false) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 応答から 5000ms 以内に活動を観測できなければ、5000ms で agent_prompt_stalled（今の状態をメッセージに含む）（AC7） 5063ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 応答から 5000ms 以内に活動を観測できなければ、5000ms で agent_prompt_stalled（今の状態をメッセージに含む）（AC7）
    Error: Test timed out in 5000ms.
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M4: 応答の instanceId を確かめない
変異: src/commands/agent.ts: `if (agent.instanceId !== target.agent.instanceId) {` → `if (false) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 応答のエージェントが hello の時点と入れ替わっていたら agent_not_running（AC9） 5070ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 応答のエージェントが hello の時点と入れ替わっていたら agent_not_running（AC9）
    Error: Test timed out in 5000ms.
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M5: 送信前の working でも活動の確認をする
変異: src/commands/agent.ts: `const startedWorking = statusOf(agent) === "working";` → `const startedWorking = false;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信前から working なら活動の確認を省く: idle で返り、5 秒以上何も来なくても stalled にならない（AC8） 180ms
         × 送信前から working で until に working があれば、応答で即座に返る（AC8） 5034ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 送信前から working なら活動の確認を省く: idle で返り、5 秒以上何も来なくても stalled にならない（AC8）
    AssertionError: expected RpcFailure: agent prompt produced no obse… { code: '…' } to be 'resolved' // Object.is equality
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 送信前から working で until に working があれば、応答で即座に返る（AC8）
    Error: Test timed out in 5000ms.
          Tests  2 failed | 46 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T7-M6: 送信前が working でも応答で一致を判定しない
変異: src/commands/agent.ts: `if (startedWorking) observe(agent);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信前から working で until に working があれば、応答で即座に返る（AC8） 5131ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 送信前から working で until に working があれば、応答で即座に返る（AC8）
    Error: Test timed out in 5000ms.
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M7: 応答より前に届いた状態を捨てる
変異: src/commands/agent.ts: `for (const a of beforeResponse.splice(0)) observe(a);` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 送信中（応答より前）に届いた working → idle も数える（一瞬だけの working）（AC6・AC8） 5155ms
         × 既定の until では、活動として観測した blocked で即座に返る（AC8） 5023ms
         × --until を複数指定すると、活動の後にそのどれかで返る（AC8） 5018ms
         × 応答から 5000ms 以内に活動を観測できなければ、5000ms で agent_prompt_stalled（今の状態をメッセージに含む）（AC7） 156ms
         × 待っている間に エージェントが居なくなる（null） と agent_not_running（AC9） 5022ms
         × 待っている間に 別のエージェントに入れ替わる と agent_not_running（AC9） 5021ms
          Tests  7 failed | 41 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯

## T7-M8: 活動を観測しても stalled のタイマーを外さない
変異: src/commands/agent.ts: `clearTimeout(stallTimer);
        stallTimer = undefined;` → ``
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 5000ms より前に活動を観測すれば stalled にならず、状態待ちへ進む（--timeout 省略なら無期限）（AC7・AC9） 312ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 5000ms より前に活動を観測すれば stalled にならず、状態待ちへ進む（--timeout 省略なら無期限）（AC7・AC9）
    AssertionError: expected true to be false // Object.is equality
    Serialized Error: { code: 'agent_prompt_stalled' }
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M9: pane.closed を消失として扱わない
変異: src/commands/agent.ts: `if (evt.data.paneId === target.paneId) onStatus(null);` → `return;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 待っている間に pane が閉じる と agent_not_running（AC9） 5031ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 待っている間に pane が閉じる と agent_not_running（AC9）
    Error: Test timed out in 5000ms.
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M10: 締め切りを応答の後から数える（送信時間を含めない）
変異: src/commands/agent.ts: `Math.max(0, deadline - Date.now()),` → `Math.max(0, deadline - Date.now()) + 100000,`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × --timeout の残りが 5000ms 以下なら、stalled ではなく締め切りで timeout（AC7） 5073ms
         × --timeout は送信の時間も含めて数え、送信中に尽きても timeout（AC9） 5027ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > --timeout の残りが 5000ms 以下なら、stalled ではなく締め切りで timeout（AC7）
    Error: Test timed out in 5000ms.
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > --timeout は送信の時間も含めて数え、送信中に尽きても timeout（AC9）
    Error: Test timed out in 5000ms.
          Tests  2 failed | 46 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## T7-M11: 終わるとき締め切りのタイマーを外さない
変異: src/commands/agent.ts: `if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
      if (stallTimer !== und` → `fn();`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × サーバのエラー（agent_blocked）で終わり、タイマーを残さない（AC5） 85ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > サーバのエラー（agent_blocked）で終わり、タイマーを残さない（AC5）
    AssertionError: expected 1 to be +0 // Object.is equality
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M12: --wait 無しでも待つ
変異: src/commands/agent.ts: `if (!cmd.wait) {
      const result` → `if (false) {
      const result`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × agent.prompt を 1 回送り、応答のエージェントを { agent } で出す（AC4・AC12） 5031ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt（--wait 無し） > agent.prompt を 1 回送り、応答のエージェントを { agent } で出す（AC4・AC12）
    Error: Test timed out in 5000ms.
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M13: stalled のメッセージに今の状態を入れない
変異: src/commands/agent.ts: `current status is ${statusOf(current)}` → `current status is unknown`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 応答から 5000ms 以内に活動を観測できなければ、5000ms で agent_prompt_stalled（今の状態をメッセージに含む）（AC7） 120ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 応答から 5000ms 以内に活動を観測できなければ、5000ms で agent_prompt_stalled（今の状態をメッセージに含む）（AC7）
    AssertionError: expected RpcFailure: agent prompt produced no obse… { code: '…' } to match object { code: 'agent_prompt_stalled', …(1) }
          Tests  1 failed | 47 passed (48)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t7b

```
## T7-M14: --wait 無しで hello の時点のエージェントを出す
変異: src/commands/agent.ts: `return viewOf({ ...target, agent: result.agent }, workspaces);` → `return viewOf(target, workspaces);`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × agent.prompt を 1 回送り、応答のエージェントを { agent } で出す（AC4・AC12） 66ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt（--wait 無し） > agent.prompt を 1 回送り、応答のエージェントを { agent } で出す（AC4・AC12）
    AssertionError: expected { paneId: 'p1', …(11) } to match object { paneId: 'p1', …(3) }
          Tests  1 failed | 48 passed (49)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T7-M15: SKIP（old の出現が 2 回）

## T7-M16: 締め切りを過ぎていても送る
変異: src/commands/agent.ts: `if (deadline !== undefined && deadline - Date.now() <= 0) {` → `if (false) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × hello の間に --timeout を使い切っていたら、送らずに timeout 5008ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > hello の間に --timeout を使い切っていたら、送らずに timeout
    Error: Test timed out in 5000ms.
          Tests  1 failed | 48 passed (49)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t7c

```
## T7-M15: --until を無視して既定の until にする
変異: src/commands/agent.ts: `resolveUntil(cmd.until),` → `resolveUntil([]),`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × --until を複数指定すると、活動の後にそのどれかで返る（AC8） 86ms
         × 送信前から working で until に working があれば、応答で即座に返る（AC8） 5003ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > --until を複数指定すると、活動の後にそのどれかで返る（AC8）
    AssertionError: expected true to be false // Object.is equality
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > 送信前から working で until に working があれば、応答で即座に返る（AC8）
    Error: Test timed out in 5000ms.
          Tests  2 failed | 47 passed (49)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

```

### t8

```
## T8-M1: （サーバ）bracketed paste のモードでも包まない
変異: src/surface/methods/agent.ts: `pastePayload(params.text, modes.bracketedPaste)` → `pastePayload(params.text, false)`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 複数行の本文を 1 つの貼り付けとして届け、300ms 後の Enter で確定し、working を経て idle/done で返る（AC13） 2145ms
     FAIL  src/agentPrompt.integration.test.ts > wtmctl agent prompt / send-keys integration（偽のエージェント・実 PTY・実際の検出） > 複数行の本文を 1 つの貼り付けとして届け、300ms 後の Enter で確定し、working を経て idle/done で返る（AC13）
    AssertionError: expected 'first line\nsecond line' to be '\u001b[200~first line\nsecond line\u0…' // Object.is equality
          Tests  1 failed | 1 passed (2)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T8-M2: （サーバ）Enter までの遅延を 0 に
変異: src/agent/agentInput.ts: `AGENT_PROMPT_SUBMIT_DELAY_MS = 300` → `AGENT_PROMPT_SUBMIT_DELAY_MS = 0`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 複数行の本文を 1 つの貼り付けとして届け、300ms 後の Enter で確定し、working を経て idle/done で返る（AC13） 1643ms
     FAIL  src/agentPrompt.integration.test.ts > wtmctl agent prompt / send-keys integration（偽のエージェント・実 PTY・実際の検出） > 複数行の本文を 1 つの貼り付けとして届け、300ms 後の Enter で確定し、working を経て idle/done で返る（AC13）
    AssertionError: expected 2 to be greater than or equal to 250
          Tests  1 failed | 1 passed (2)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## T8-M3: （サーバ）flush を待たずにモードを読む
変異: src/terminal/TerminalHost.ts: `await this.mirror.flush();` → ``
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  2 passed (2)

## T8-M4: （サーバ）アプリケーションカーソルを考えず常に ESC O で矢印を送る
変異: src/agent/agentInput.ts: `return modes.applicationCursorKeys ? `${ESC}O${arrow}` : `${ESC}[${arrow}`;` → `return `${ESC}O${arrow}`;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × send-keys はキーを符号化して届ける（AC10） 1014ms
     FAIL  src/agentPrompt.integration.test.ts > wtmctl agent prompt / send-keys integration（偽のエージェント・実 PTY・実際の検出） > send-keys はキーを符号化して届ける（AC10）
    AssertionError: expected '\u001b\u001bOA\u0003' to be '\u001b\u001b[A\u0003' // Object.is equality
          Tests  1 failed | 1 passed (2)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

### t8b

```
## T8-M5: （CLI）活動の確認を省く（working を観測しなくても until で返る）
変異: src/agentStatus.ts: `this.activity = activityObserved;` → `this.activity = true;`
結果: exit=0 通った（未検出） / 復元後の cmp: 一致
     Test Files  1 passed (1)
          Tests  2 passed (2)

```

### t8c

```
## T8-M6: （CLI）送信前の状態に関わらず活動を観測済みとして応答のエージェントで一致を判定する
変異: src/commands/agent.ts: `const startedWorking = statusOf(agent) === "working";` → `const startedWorking = true;`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 複数行の本文を 1 つの貼り付けとして届け、300ms 後の Enter で確定し、working を経て idle/done で返る（AC13） 339ms
     FAIL  src/agentPrompt.integration.test.ts > wtmctl agent prompt / send-keys integration（偽のエージェント・実 PTY・実際の検出） > 複数行の本文を 1 つの貼り付けとして届け、300ms 後の Enter で確定し、working を経て idle/done で返る（AC13）
    AssertionError: expected 4 to be greater than or equal to 3000
          Tests  1 failed | 1 passed (2)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

## ラウンド 2（review ラウンド 1 の差し戻し後。D11〜D14）

### 実行したもの

- `pnpm -s build` — exit 0 / `pnpm -s typecheck` — exit 0
- `pnpm -s test` を 5 回。他のセッションの負荷（load average 最大 34）で、本 work が触っていないファイル（web の `App.test.ts`・`SettingsDialog.test.ts`・`KeySettings.test.ts`、cli の `main.integration.test.ts`、server の `composeServer.integration.test.ts`）が時間切れ（5000ms/15000ms）で落ちた回が 3 回（a・b・c）。本 work の追加・変更したテストはどの回も落ちていない。落ちた 5 ファイルを単独で流すと全部通る。負荷が下がった後の 2 回（d・e）は 3407 passed / 0 failed。
- `aidev smoke` — pass（exit 0、2 本）

### 失敗の証跡（負荷による時間切れ）

```
$ pnpm -s test  # a（開始時: load は上の a・b の表示を参照)
⎯⎯⎯⎯⎯⎯ Failed Tests 14 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > authRequired なら LoginView
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > ログイン画面の「接続中…」の間に接続の確認が 403（rejected）になったら、本体へ替えて理由を重ねて出す（D107：止めたままにしない）
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > それ以外は本体（Sidebar・TabBar 等）を出す
 FAIL  |@wtm/web| src/App.test.ts > App — pane の枠・隙間の太さの CSS 変数（AC9） > `settings.paneFrameThickness` を変えると、リアクティブに変わる（ページの再読み込み不要）
 FAIL  |@wtm/web| src/App.test.ts > App — 再接続の後の表示と購読の張り直し（D107） > 切り離し画面の「再接続」：本体が hello より前に描かれて送れなかった分があっても、hello の後に送り直す
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — navigate の割り当ての追加・変更・削除（AC1・AC-I4） > ［追加］：押したキーで足され、フォーカスは押した［追加］へ戻る
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 通知の節 — 音（AC13） > 「入」にしたら自動再生を解除しにいく
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 保存値がサーバの上限を超えていたら、押さえた値（＝上限）の行が選ばれる（保存値は書き換えない）
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 上限以下で段階に無い保存値は、選択肢に足されて選ばれる
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > workspace create: 初回は --token でログインし、セッションをキャッシュする（AC1, AC7）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > 2回目以降はキャッシュ済みセッションを再利用し、/api/login を呼ばない（AC5, AC7）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > pane split で新しい pane を作る（AC2）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > pane run → pane read: 実 PTY への echo の往復を確認する（AC3, AC4）
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > workspace.create は、実際の git リポジトリなら定期ポーリング（5秒）を待たずに Workspace.git が埋まる（20260925-workspace-git-immediate。AC1・AC3）
 Test Files  5 failed | 166 passed (171)
      1 AssertionError: expected 2653 to be less than 2000
     10 Error: Test timed out in 5000ms.
      1 TypeError: Cannot read properties of undefined (reading 'some')
$ pnpm -s test  # b（開始時: load は上の a・b の表示を参照)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 色の個別の上書き > 空欄で確定すると、既定へ戻す（無効値としては扱わない）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > watch: 別クライアントが起こした workspace.created イベントを受け取る（AC6）
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 組み立て（composeServer）と listen() の間に token reset が走っても、listen() はロックの後に auth.json を読むので新しい token で動く（D103 の独立点検 #1）
 Test Files  3 failed | 168 passed (171)
      Tests  3 failed | 3404 passed (3407)
      1 Error: Test timed out in 15000ms.
      2 Error: Test timed out in 5000ms.
$ pnpm -s test  # c（開始時: load average: 10.10, 22.22, 19.83)
⎯⎯⎯⎯⎯⎯ Failed Tests 13 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > connectionState が detached なら DetachedView
 FAIL  |@wtm/web| src/App.test.ts > App — 接続の状態での切り替え > ログイン画面の「接続中…」の間に接続の確認が 403（rejected）になったら、本体へ替えて理由を重ねて出す（D107：止めたままにしない）
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節 — 新しく開く場所（AC4・AC10・AC-I1・AC-I2） > 閉じても選んだ方針と入れたパスは残る（AC-I1）
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 色の個別の上書き > すべての上書きを既定に戻すボタンは確認を挟み、やめると何も変わらず、戻すとすべて消える（AC7・AC-I2）
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 色の個別の上書き > 確認の中の Esc は確認を閉じるだけで、親（設定画面）へ届かない（KeySettings の同じ確認と同じ形）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > workspace create: 初回は --token でログインし、セッションをキャッシュする（AC1, AC7）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > 2回目以降はキャッシュ済みセッションを再利用し、/api/login を呼ばない（AC5, AC7）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > pane split で新しい pane を作る（AC2）
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > pane run → pane read: 実 PTY への echo の往復を確認する（AC3, AC4）
 FAIL  |@wtm/cli| src/wsClient.test.ts > connect/WtmClient — 実サーバへの最小の疎通確認 > login -> connect -> hello -> request -> close の一巡
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 組み立て（composeServer）と listen() の間に token reset が走っても、listen() はロックの後に auth.json を読むので新しい token で動く（D103 の独立点検 #1）
 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 実物の PTY で偽の 'claude' を起動すると、pane.agent_status_changed が kind='claude' で届く（02-agent-detection T10・AC6）
 FAIL  |@wtm/server| src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
 Test Files  6 failed | 165 passed (171)
      Tests  13 failed | 3394 passed (3407)
      9 Error: Test timed out in 5000ms.
      1 TypeError: Cannot read properties of undefined (reading 'some')
```

単独での実行:

```
$ cd packages/cli && npx vitest run src/main.integration.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
$ cd packages/server && npx vitest run src/composeServer.integration.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)
$ cd packages/web && npx vitest run src/App.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
$ cd packages/web && npx vitest run src/components/KeySettings.test.ts
 Test Files  1 passed (1)
      Tests  91 passed (91)
$ cd packages/web && npx vitest run src/components/SettingsDialog.test.ts
 Test Files  1 passed (1)
      Tests  88 passed (88)
```

負荷が下がった後の 2 回:

```
$ pnpm -s test  # d（開始時: load average: 33.41, 30.52, 24.11）
 Test Files  171 passed (171)
      Tests  3407 passed (3407)
$ pnpm -s test  # e（開始時: load average: 19.60, 27.06, 23.86）
 Test Files  171 passed (171)
      Tests  3407 passed (3407)
```

### 起動確認（smoke）

```
smoke: 20260926-agent-prompt-send-keys
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:39324 (state dir /tmp/wtm-smoke-GVW9Ct)
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
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/agent-prompt-send-keys/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-ja4Sfk, sandboxed HOME /tmp/wtmctl-smoke-home-hNm72S
smoke(cli): server listening on http://127.0.0.1:38422
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

### 負の確認（review ラウンド 1 の修正）

```
## R1-M1: 本文の中の貼り付けの印を取り除かない
変異: server/src/agent/agentInput.ts: `text.replace(PASTE_MARKERS, "")` → `text`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように） 89ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように）
    AssertionError: expected '\u001b[200~a\u001b[201~\rrm x\u001b[2…' to be '\u001b[200~a\rrm xb\u001b[201~' // Object.is equality
          Tests  1 failed | 122 passed (123)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R1-M2: 終わりの印だけ取り除く
変異: server/src/agent/agentInput.ts: `/\u001b\[20[01]~/g` → `/\u001b\[201~/g`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように） 40ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように）
    AssertionError: expected '\u001b[200~a\rrm x\u001b[200~b\u001b[…' to be '\u001b[200~a\rrm xb\u001b[201~' // Object.is equality
          Tests  1 failed | 122 passed (123)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R1-M3: 渡された instanceId を確かめない
変異: server/src/surface/methods/agent.ts: `if (expectedInstanceId !== undefined && pane.agent.instanceId !== expectedInstanceId) {` → `if (false) {`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 渡された instanceId と今のエージェントが違えば、書かずに agent_not_found（同じなら送る） 7ms
         × 渡された instanceId と今のエージェントが違えば、書かずに agent_not_found（別のエージェントのダイアログに答えない） 1ms
     FAIL  src/surface/methods/agent.test.ts > agent.prompt > 渡された instanceId と今のエージェントが違えば、書かずに agent_not_found（同じなら送る）
    Error: expected an error, got {"agent":{"instanceId":"a1","kind":"claude","label":"Claude Code","state":"idle","completionSeq":0,"serverSeenSeq":0,"verified":true,"since":1000}}
     FAIL  src/surface/methods/agent.test.ts > agent.send_keys > 渡された instanceId と今のエージェントが違えば、書かずに agent_not_found（別のエージェントのダイアログに答えない）
    Error: expected an error, got {}
          Tests  2 failed | 121 passed (123)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

## R1-M4: （CLI）--wait 無しで instanceId を渡さない
変異: cli/src/commands/agent.ts: `paneId: cmd.paneId,
        instanceId: target.agent.instanceId,
        text: cmd.text,` → `paneId: cmd.paneId,
        text: cmd.text,`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × agent.prompt を 1 回送り、応答のエージェントを { agent } で出す（AC4・AC12） 73ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt（--wait 無し） > agent.prompt を 1 回送り、応答のエージェントを { agent } で出す（AC4・AC12）
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'agent.prompt', …(1) ]
          Tests  1 failed | 49 passed (50)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R1-M5: （CLI）--wait で instanceId を渡さない
変異: cli/src/commands/agent.ts: `.request("agent.prompt", { paneId: target.paneId, instanceId: target.agent.instanceId, tex` → `.request("agent.prompt", { paneId: target.paneId, text })`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × --wait でも hello で見たエージェントの instanceId を渡す 81ms
     FAIL  src/commands/agent.test.ts > runAgentPrompt --wait > --wait でも hello で見たエージェントの instanceId を渡す
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'agent.prompt', …(1) ]
          Tests  1 failed | 49 passed (50)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R1-M6: （CLI）send-keys で instanceId を渡さない
変異: cli/src/commands/agent.ts: `instanceId: target.agent.instanceId,
      keys: cmd.keys,` → `keys: cmd.keys,`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × agent.send_keys でキー列を送り、{ ok: true, paneId } を出す（AC10） 21ms
     FAIL  src/commands/agent.test.ts > runAgentSendKeys > agent.send_keys でキー列を送り、{ ok: true, paneId } を出す（AC10）
    AssertionError: expected "vi.fn()" to be called with arguments: [ 'agent.send_keys', …(1) ]
          Tests  1 failed | 49 passed (50)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R1-M7: （protocol）instanceId の空文字を許す
変異: protocol/src/messages.ts: `paneId,
  instanceId: z.string().min(1).optional(),
  text:` → `paneId,
  instanceId: z.string().optional(),
  text:`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 本文は UTF-8 で 1MB まで受け、超えたら弾く（空は通す——サーバが empty_agent_prompt で返す） 69ms
     FAIL  src/messages.test.ts > AgentPromptParams / AgentSendKeysParams > 本文は UTF-8 で 1MB まで受け、超えたら弾く（空は通す——サーバが empty_agent_prompt で返す）
    AssertionError: expected [Function] to throw an error
          Tests  1 failed | 26 passed (27)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```

## ラウンド 3（review ラウンド 2 の差し戻し後。D15）

- `pnpm -s build` — exit 0 / `pnpm -s typecheck` — exit 0 / `aidev smoke` — pass
- `pnpm -s test` を 2 回とも 3407 passed / 0 failed（このラウンドでは失敗が発生していない）

```
$ pnpm -s test  # a（開始時: load average: 3.84, 7.56, 15.13）
 Test Files  171 passed (171)
      Tests  3407 passed (3407)
$ pnpm -s test  # b（開始時: load average: 14.59, 10.05, 15.41）
 Test Files  171 passed (171)
      Tests  3407 passed (3407)
$ aidev smoke
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

### 負の確認（review ラウンド 2 の修正。同じ不変条件を支える項を 1 つずつ壊した）

```
## R2-M1: SKIP（old の出現が 0 回）

## R2-M2: 終わりの印だけ取り除く
変異: src/agent/agentInput.ts: `/\u001b\[20[01]~/g` → `/\u001b\[201~/g`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように） 18ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように）
    AssertionError: expected '\u001b[200~a\rrm x\u001b[200~b\u001b[…' to be '\u001b[200~a\rrm xb\u001b[201~' // Object.is equality
          Tests  1 failed | 102 passed (103)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R2-M3: 始まりの印だけ取り除く
変異: src/agent/agentInput.ts: `/\u001b\[20[01]~/g` → `/\u001b\[200~/g`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように） 12ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように）
    AssertionError: expected '\u001b[200~a\u001b[201~\rrm xb\u001b[…' to be '\u001b[200~a\rrm xb\u001b[201~' // Object.is equality
          Tests  1 failed | 102 passed (103)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R2-M4: 取り除かない
変異: src/agent/agentInput.ts: `body = body.replace(PASTE_MARKERS, "");` → `body = body.replace(PASTE_MARKERS, (m) => m);`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように） 10ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように）
    AssertionError: expected '\u001b[200~a\u001b[201~\rrm x\u001b[2…' to be '\u001b[200~a\rrm xb\u001b[201~' // Object.is equality
          Tests  1 failed | 102 passed (103)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

## R2-M1: 1 回だけ取り除く（繰り返さない）
変異: src/agent/agentInput.ts: `for (let prev = ""; prev !== body;) {
    prev = body;
    body = body.replace(PASTE_MARKE` → `body = body.replace(PASTE_MARKERS, "");`
結果: exit=1 落ちた（検出） / 復元後の cmp: 一致
         × 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように） 13ms
     FAIL  src/agent/agentInput.test.ts > pastePayload（herdr の encode_api_text） > 包むときは本文の中の貼り付けの印（ESC[200~・ESC[201~）を取り除く（印の後ろが打鍵として届かないように）
    AssertionError: expected '\u001b[200~a\u001b[201~\rrm x\u001b[2…' to be '\u001b[200~a\rrm x\u001b[201~' // Object.is equality
          Tests  1 failed | 102 passed (103)
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

```
