# テスト結果: 画面履歴の保存と再生（opt-in）

## 実行したもの

- `pnpm -s build` — exit 0（`scratchpad/research/build2.log`）
- `pnpm -s typecheck` — exit 0
- `pnpm -s test`（全体・1 回）— 3801 passed / 0 failed / 0 skipped（188 ファイル）。
  ※ coding 工程の終わりの 1 回目の全体実行では `packages/cli/src/main.integration.test.ts` の
  「Origin ヘッダが許可リストに無い接続は…403 で拒否される（AC9）」が 1 件落ちた（`TypeError: Invalid value "undefined" for header "cookie"`。
  ログインの応答に Cookie が無い＝共有マシンの負荷による既知の揺れ）。この work は `packages/cli` を変えていない（`git diff --quiet HEAD -- packages/cli`）。
  そのファイルだけを 1 回流し直して 8 passed、続く全体の実行（上の行）も green。
- 変更したテスト（各 1 回）: `historyAnsi.test.ts` 37・`Mirror.test.ts` 38・`PaneHistoryFile.test.ts` 17・`PaneHistoryRecorder.test.ts` 11・
  `SessionService.test.ts` 144・`cliArgs.test.ts`/`config.test.ts` 43・`startupBanner.test.ts` 7・`composeServer.integration.test.ts -t 画面履歴` 8（実 PTY）— すべて pass。
- `pnpm -s lint` — exit 1。残る error はすべてこの work が触っていないファイル（`packages/cli/src/ansiStrip.ts`・`attach.integration.test.ts`・`smoke.ts`・
  `packages/server/src/agent/agentInput.ts`。main〔`/workspaces/web-tn-multiplexer`〕でも `pnpm -s lint` は exit 1）。この work の新規・変更ファイルは
  `npx eslint` で 0 件（`Mirror.test.ts` の CUP の正規表現に eslint-disable を付けた）。
- E2E は実行していない（利用者の方針）。負荷をかけた検証（並走・繰り返し）はしていない（利用者の指示）。

## 受け入れ基準ごとの判定

- AC1: pass — 結合テスト（実 PTY で色つきの `printf` → `close()` → `session-history.json` に `\x1b[31mHIST_MARK`）。代替画面の中でも通常の側を返すことは `Mirror.test`。
- AC2: pass — 結合テスト（2 つ目のサーバの pane のミラーで、保存した文字 → 区切りの行（1 回だけ）→ 新しいシェルの `NEW_42` の順）。流し込みが `create` の直後・他の書き込みより前であることは `SessionService.test`。
- AC3: pass — `PaneHistoryRecorder.test`（出力の無い pane は取り直さない・変化なしなら書かない・start/stop）と結合テスト（間隔を 100ms に差し替え、停止を待たずに書かれ、停止の後は書かれない）。
- AC4: pass — 結合テスト（無しで起動すると作らない・既存のものを消す・流さない）と `config.test`（既定は無効）。
- AC5: pass — 結合テスト（`session.json` が無い／壊れているとき、`p1` と同じ id の古い画面を流さず消す）。
- AC6: pass — `PaneHistoryFile.test`（状態ディレクトリの直下・0600）と結合テスト（0600）。
- AC7: pass — `historyAnsi.test`・`PaneHistoryRecorder.test`（pane ごとの上限で古い側を捨てる・全体の上限を超える pane を積まない）・`PaneHistoryFile.test`（too_large・corrupt・UTF-8 のバイト数）・結合テスト（壊れた・形の合わないファイルでも起動しログに残す・退避コピーを作らない）。
- AC8: pass — `historyAnsi.test`（落とす並びの一覧）・`PaneHistoryFile.test`（読むときに安全化）・`Mirror.test`（安全化した内容を実物のミラーに流して応答 0 件・モードとタイトルが変わらない。安全化しない対照では応答が出る）。
- AC9: pass — `SessionService.test`（会話を再開する pane には流さない・自動再開が無効なら流す・コマンドの無い kind なら流す）。
- AC10: pass — `docs/tls-setup.md`「画面履歴の保存と再生」・`docs/verification.md`（Linux の手元の確認項目）・`docs/herdr-parity.md` H32（T8 の独立点検で実装との一致を確認）。
- AC11: pass — `cliArgs.test`（USAGE に `[--pane-history]`・値を取らない・他コマンドで拒否）・`startupBanner.test`（保存先と秘密の注意の 1 行）。
- AC12: pass — 結合テスト（画面履歴から項目を除いた pane を復元すると区切りも出ない）と `SessionService.test`。
- AC13: pass — `PaneHistoryRecorder.test`（書けなくても投げずログ・次回書き直す）と結合テスト（`session-history.json` の位置にディレクトリを置いて書けなくしても `close()` が終わり `session.json` が保存され、ログに `pane history save failed`）。`session.json` の形式は変えていない（`toSessionFileData` は未変更）。

## 負の確認（変異。`.aidev/conventions/regression-negative-control.md`）

新機能なので「修正前のコード」は無い。代わりに、要の判定を 1 か所ずつ壊して対応するテストが落ちることを各 1 回確かめた
（`scratchpad/negctl/run.py` が元のファイルを退避 → 置換（一致が 1 か所であることを assert）→ 該当テストを実行 → 退避から戻し → `filecmp.cmp` で一致を確認。
生のログは `scratchpad/negctl/M*.log`）。17 変異すべて検知・すべて元どおり。

```
$ python3 scratchpad/negctl/run.py
M1 terminal/historyAnsi.ts exit 1 ['Tests  2 failed | 35 passed (37)'] restored_cmp True
M2 terminal/historyAnsi.ts exit 1 ['Tests  1 failed | 37 passed (38)'] restored_cmp True
M3 terminal/Mirror.ts exit 1 ['Tests  1 failed | 37 passed (38)'] restored_cmp True
M4 terminal/Mirror.ts exit 1 ['Tests  1 failed | 37 passed (38)'] restored_cmp True
M5 terminal/Mirror.ts exit 1 ['Tests  1 failed | 37 passed (38)'] restored_cmp True
M6 session/SessionService.ts exit 1 ['Tests  1 failed | 143 passed (144)'] restored_cmp True
M7 session/SessionService.ts exit 1 ['Tests  4 failed | 140 passed (144)'] restored_cmp True
M8 session/PaneHistoryRecorder.ts exit 1 ['Tests  1 failed | 10 passed (11)'] restored_cmp True
M9 session/PaneHistoryRecorder.ts exit 1 ['Tests  1 failed | 10 passed (11)'] restored_cmp True
M10 persist/PaneHistoryFile.ts exit 1 ['Tests  1 failed | 16 passed (17)'] restored_cmp True
M11 persist/PaneHistoryFile.ts exit 1 ['Tests  1 failed | 16 passed (17)'] restored_cmp True
M12 composeServer.ts exit 1 ['Tests  2 failed | 6 passed | 24 skipped (32)'] restored_cmp True
M13 composeServer.ts exit 1 ['Tests  1 failed | 7 passed | 24 skipped (32)'] restored_cmp True
M14 composeServer.ts exit 1 ['Tests  1 failed | 7 passed | 24 skipped (32)'] restored_cmp True
M15 composeServer.ts exit 1 ['Tests  2 failed | 6 passed | 24 skipped (32)'] restored_cmp True
M16 config.ts exit 1 ['Tests  1 failed | 28 passed (29)'] restored_cmp True
M17 terminal/historyAnsi.ts exit 1 ['Tests  1 failed | 36 passed (37)'] restored_cmp True
```

変異の中身: M1 許可する CSI の終端に `n`（CPR）を足す／M2 許可リストを外す（全部通す）／M3 `range` を外す（最後のカーソルの位置合わせが入る）／
M4 `excludeModes: false`／M5 読む先を `buffer.active`／M6 会話再開の判定を外す／M7 流し込みを消す／M8 出力の時刻の比較を `<=`／
M9「変化なしなら書かない」を消す／M10 読むときの安全化を外す／M11 ファイルの大きさの上限を外す／M12 `session.json` が無い・壊れたときの消去を消す／
M13 無効のときの消去を消す／M14 定期保存の開始を消す／M15 停止時の保存を消す／M16 既定を有効にする／M17 行の頭での切り詰めの扱いを消す。

代表の生の失敗（抜粋。全文は各ログ）:

```
== M2
AssertionError: expected [ '\u001b[?1;2c', '\u001b[1;6R', …(3) ] to deeply equal []
== M7
AssertionError: expected [ +0 ] to deeply equal [ 1 ]
== M12
 × session.json が無いときは、画面履歴を新しい pane に流さずに消す（AC5）
AssertionError: expected true to be false // Object.is equality
```

## 失敗の証跡

このラウンドでは（この work の変更に起因する）失敗が発生していない。全体の 1 回目で落ちた `packages/cli` の 1 件（負荷による揺れ）は上の「実行したもの」に記録した。

```
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）
TypeError: Invalid value "undefined" for header "cookie"
 Test Files  1 failed | 187 passed (188)
      Tests  1 failed | 3800 passed (3801)
$ npx vitest run packages/cli/src/main.integration.test.ts
      Tests  8 passed (8)
```

## 起動確認（smoke）

```
smoke: 20260926-screen-history-replay
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45523 (state dir /tmp/wtm-smoke-twZySt)
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

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/screen-history-replay/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-YBIOpf, sandboxed HOME /tmp/wtmctl-smoke-home-9RUFp3
smoke(cli): server listening on http://127.0.0.1:45963
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent rename ok (named, resolved by name, cleared)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: <一時ディレクトリの token。伏せた>
wtm: deleted session smoke (/tmp/tmp.qLaODaKypS/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

新しい入口 `--pane-history` の smoke は足さない。理由: smoke は「ビルドした成果物が最初の使える状態まで到達するか」を見るもので、
`--pane-history` が変えるのは停止と再起動をまたぐ振る舞い（止めて起動し直して初めて観測できる）。その往復は実 PTY・実シェルの結合テスト
（`composeServer.integration.test.ts` の「画面履歴」8 本。ビルド済みの成果物ではなく composeServer 経由）で確かめた。

## 未検証の穴（skip / 環境不足）

- Windows ネイティブ・macOS では未検証（結合テストは `win32` で skip。権限は Windows では状態ディレクトリの置き場所で守る既存の扱い）。
- ブラウザでの見た目（区切りの行の薄い色・スクロールバックに前回の内容が並ぶこと）は E2E を実行していないため自動では未確認。サーバのミラー（ブラウザが接続時に受け取る画面の元）で確かめた。手動の確認手順を `docs/verification.md` に書いた。
- 異常終了（`kill -9`）の直前の出力は、最後の定期保存（30 秒）より後の分が戻らない（仕様どおり。自動テストなし）。
- 120 桁より広い端末で保存した行の空白の詰まり・巨大な 1 論理行の切り詰め（decisions D7。既知の制約）。

## ラウンド 2（review ラウンド 1 の差し戻しの後）

- `pnpm -s build` exit 0・`pnpm -s typecheck` exit 0・`pnpm -s test`（全体・1 回）— 3803 passed / 0 failed（188 ファイル）。
- `composeServer.integration.test.ts -t 画面履歴` — 8 passed（実 PTY）。`PaneHistoryFile.test.ts` 18・`PaneHistoryRecorder.test.ts` 12 passed。
- `aidev smoke` — `smoke: pass (exit 0, 3 本)`。
- 追加の負の確認（各 1 回・元どおりを `filecmp` で確認。ログは `scratchpad/negctl/R*.log`）:

```
$ python3 scratchpad/negctl/run2.py
R1 persist/PaneHistoryFile.ts exit 1 ['Tests  1 failed | 17 passed (18)'] restored_cmp True
R2 persist/PaneHistoryFile.ts exit 1 ['Tests  1 failed | 17 passed (18)'] restored_cmp True
R3 persist/PaneHistoryFile.ts exit 1 ['Tests  1 failed | 17 passed (18)'] restored_cmp True
R4 session/PaneHistoryRecorder.ts exit 1 ['Tests  1 failed | 11 passed (12)'] restored_cmp True
R5 session/PaneHistoryRecorder.ts exit 1 ['Tests  1 failed | 11 passed (12)'] restored_cmp True
```

R1 本体の削除より先に片付けて失敗を投げる（直す前の順序）／R2 古さの条件を外す／R3 名前の形の条件を `.tmp-` の接頭辞だけにする／
R4 内容が同じときに取り出しの時刻を進めない／R5 内容が同じでも変化ありとみなす（直す前の形）。

このラウンドでは失敗が発生していない。
