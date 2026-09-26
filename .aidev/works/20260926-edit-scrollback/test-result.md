# テスト結果: pane のスクロールバックを `$EDITOR` で開く

## 実行したもの

ラウンド 2（review ラウンド 1 の差し戻し〔decisions.md D14〕の後。停止時の後片付けの結合テストを 1 本足したので 3129 本）:

- `pnpm -s typecheck` — exit 0（`typecheck exit=0`）
- `pnpm -s build` — exit 0（`build exit=0`）
- `pnpm -s test`（全体・1 回目） — 3129 passed / 0 failed / 0 skipped
- `pnpm -s test`（全体・2 回目） — 3129 passed / 0 failed / 0 skipped
- 全体テストの前後で `/tmp/wtm-scrollback-*` の数は 0 → 0（テストが一時ディレクトリを残さない）
- `aidev smoke` — pass（2 本）

ラウンド 1（差し戻し前）: typecheck・build exit 0、全体テスト 3128 passed × 2 回、smoke pass。以下の実物の PTY・lint の記録はラウンド 1 のもの（ラウンド 2 の差分は `composeServer.ts` の 1 行と結合テストだけで、これらの結果に関わらない）。
- 実物の PTY・シェル・ミラーでの一連の確認（scratchpad の `e2e-real-pty.mjs`。ブラウザは使わない。ビルド済みの `packages/server/dist` を読む） — exit 0
- `pnpm -s lint` — exit 1。ただし誤りは 2 件とも触っていない `packages/cli/src/ansiStrip.ts`（`no-control-regex`。HEAD の時点から）で、この work の変更ファイルは `npx eslint` で 0 件
- E2E（`packages/e2e`・playwright）は走らせていない（利用者の方針）

全体テストの要約（ラウンド 2 の各回の出力の抜粋。`grep -E "Test Files|Tests |exit="`）:

```
$ pnpm -s test   # 1 回目
 Test Files  164 passed (164)
      Tests  3129 passed (3129)
test1 exit=0
$ pnpm -s test   # 2 回目
 Test Files  164 passed (164)
      Tests  3129 passed (3129)
test2 exit=0
```

## 受け入れ基準ごとの判定

- AC1: pass — `ActionDispatcher.test`（`prefix+e` の action で `pane.edit_scrollback` を送り応答の pane へ焦点）・`SessionService.test`（同じ tab・拡大表示・焦点・作業場所）・`surface/methods/index.test`（方式の配線）・実物の PTY の確認（`zoomed: true`）
- AC2: pass — `scrollbackEditor.test`（実物の `/bin/sh` で引数付きの `EDITOR` がパスを 1 引数で受け取る・未設定/空で `vi`。Windows の argv の組み立て）・実物の PTY の確認（`argc=2` `arg1=--readonly`）
- AC3: pass — `Mirror.test`（押し出された行を含む全行・折り返し・全角の折り返し・制御列なし・末尾の空行なし・代替画面の中でも通常バッファ）・`SessionService.test`（書いた中身）・実物の PTY の確認（`seq 1 3000` の 1〜3000 と色付きの行が `ESC` なしで 3004 行）
- AC4: pass — `SessionModel.test`（後継の希望）・`SessionService.test`（終了・利用者が閉じる・開く前に拡大表示・対象が先に閉じた・別の tab へ移った）・実物の PTY の確認（`focus back to source: true`・`pane.closed` に `successorPaneId`）。ブラウザ側は既存の `viewRepair` の後継の規則と `ActionDispatcher.test`（すぐ閉じた場合）
- AC5: pass — `SessionService.test`（pane が無い・端末が無い・Windows でエディタが無い・一時ファイルを作れない・起動できない・書き中/猶予中に対象が閉じた）・`ActionDispatcher.test`（トースト）
- AC6: pass（Linux） — `scrollbackEditor.test`（0700/0600・名前が毎回違う・既存のファイル/リンクには書かない）・実物の PTY の確認（`file=600` `dir=700`）。Windows は未検証
- AC7: pass — `scrollbackEditor.test`（空白・`"`・`$`・`;`・`'`・`$(…)`・`` `…` `` を含むパスで注入が起きない）・実物の PTY の確認（空白を含む一時ディレクトリ）
- AC8: pass（異常終了を除く） — `SessionService.test`（終了・`pane.close`・`tab.close`・`workspace.close`・replacePane・起動の失敗・猶予中の終了・停止時）・`scrollbackEditor.test`（書けないとき）・実物の PTY の確認（`temp dirs after close: []`）・`composeServer.integration.test`（実物の PTY でエディタを開いたまま `close()` すると一時ディレクトリが消える。ラウンド 2 で追加、負の確認 T7-5）
- AC9: pass — `bindings.test`・`keymap.test`・`KeyRouter.test`・`HelpDialog.test`・`KeySettings.test`（50 操作）・`assign.test`
- AC10: pass — `keymap.test`（`goto: ["prefix+e"]` の上書きが勝ち、`edit_scrollback` は割り当てなし）・`HelpDialog.test`
- AC11: pass — `docs/herdr-parity.md` の H11・H26、`docs/verification.md` の前提・AC13 の段落・手元の追加確認を更新（T9 の点検済み）
- AC12: pass — `SessionService.test`（エディタの pane を含む保存データを復元すると既定のシェル・引数なしで起動）
- AC13: pass（deliver で消化。`.aidev/backlog/product-roadmap.md` の該当行を `[x]`〔この分〕と `[ ]`〔画像表示〕の兄弟に割った。tasks.md の T10。decisions.md D8・D9）
- AC14: pass — `messages.test`（`paneId` 以外のキーを取り除く・空/欠落を拒む）・`index.test`（`invalid_params`）・`pnpm -s typecheck`

## 失敗の証跡

ラウンド 2（この記録を仕上げた回。上の 2 回の全体テスト・smoke）では失敗が発生していない。
ラウンド 2 の途中（前任のセッション）で、負荷の高い共有マシンの上で既存の不安定なテストが落ちたことが decisions.md D16 に記録されているが、
そのときの生の出力はセッションの入れ替わりで失われ、ここに貼れない（HEAD に戻しても 5 回中 2 回落ちたという D16 の確認のとおり、この work の変更と無関係）。

ラウンド 1 では test 工程で失敗は発生していない（test の差し戻し無し。ラウンド 2 は review の差し戻しによるもの）。coding 中に 1 度、全体テストが 1 件落ちた（`packages/cli` の結合テストがビルド済みの `dist` を読むため、`dist` が古いまま走らせた。`pnpm -s build` の後は通る。コードの不具合ではない）:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）
TypeError: Invalid value "undefined" for header "cookie"
 Test Files  1 failed | 163 passed (164)
      Tests  1 failed | 3120 passed (3121)
```

## 負の確認（`.aidev/conventions/regression-negative-control.md`）

足した箇所を 1 か所ずつ壊してテストを走らせ、元に戻して `cmp` で一致を確かめた（scratchpad の `mutate.py` の出力をそのまま貼る。`test exit=1` が「落ちた」、`restore cmp exit=0` が「元どおり」）。T6・T8 は道具の取り違え（decisions.md D13）の後に取り直したもの。

### T1（protocol）

```
=== T1-1 方式の表の登録を別スキーマに ===
mutation: packages/protocol/src/messages.ts: '"pane.edit_scrollback": PaneEditScrollbackParams,' -> '"pane.edit_scrollback": PaneCloseParams,'
     × pane.edit_scrollback は paneId だけを受け、それ以外の値は取り除く（20260926-edit-scrollback の AC14） 22ms
 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
 FAIL  src/messages.test.ts > messages > pane.edit_scrollback は paneId だけを受け、それ以外の値は取り除く（20260926-edit-scrollback の AC14）
AssertionError: expected ZodObject{ _zod: { …(9) }, …(2) } to be ZodObject{ _zod: { …(9) }, …(3) } // Object.is equality
test exit=1
restore cmp exit=0
=== T1-2 paneId の空文字を通す ===
mutation: packages/protocol/src/messages.ts: 'export const PaneEditScrollbackParams = z.object({ paneId });' -> 'export const PaneEditScrollbackParams = z.object({ paneId: z.string() });'
     × pane.edit_scrollback は paneId だけを受け、それ以外の値は取り除く（20260926-edit-scrollback の AC14） 13ms
 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
 FAIL  src/messages.test.ts > messages > pane.edit_scrollback は paneId だけを受け、それ以外の値は取り除く（20260926-edit-scrollback の AC14）
AssertionError: expected [Function] to throw an error
test exit=1
restore cmp exit=0
=== T1-3 余計なキーを通す ===
mutation: packages/protocol/src/messages.ts: 'export const PaneEditScrollbackParams = z.object({ paneId });' -> 'export const PaneEditScrollbackParams = z.looseObject({ paneId });'
     × pane.edit_scrollback は paneId だけを受け、それ以外の値は取り除く（20260926-edit-scrollback の AC14） 19ms
 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
 FAIL  src/messages.test.ts > messages > pane.edit_scrollback は paneId だけを受け、それ以外の値は取り除く（20260926-edit-scrollback の AC14）
AssertionError: expected { paneId: 'p1', …(2) } to deeply equal { paneId: 'p1' }
test exit=1
restore cmp exit=0
```

### T2（Mirror.plainText）

```
=== T2-1 通常バッファの代わりに今の画面 ===
mutation: packages/server/src/terminal/Mirror.ts: 'const buf = this.term.buffer.normal;' -> 'const buf = this.term.buffer.active;'
     × 代替画面（vim・less 等）の中でも通常バッファを読む 18ms
 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 代替画面（vim・less 等）の中でも通常バッファを読む
AssertionError: expected '\n\naltscreen\n' to contain 'history-1\nhistory-2'
test exit=1
restore cmp exit=0
=== T2-2 折り返しをつながない ===
mutation: packages/server/src/terminal/Mirror.ts: 'const continues = buf.getLine(y + 1)?.isWrapped === true;' -> 'const continues = false;'
     × 折り返しで分かれた行は 1 行に戻す（折り返しの境目の空白も落とさない） 18ms
     × 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない 4ms
 Test Files  1 failed (1)
      Tests  2 failed | 27 passed (29)
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 折り返しで分かれた行は 1 行に戻す（折り返しの境目の空白も落とさない）
AssertionError: expected 'abcdefghi\njklmnopqrs\n tuv\nnext\n' to be 'abcdefghi jklmnopqrs tuv\nnext\n' // Object.is equality
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない
AssertionError: expected 'abcdefghi\nあいう\n' to be 'abcdefghiあいう\n' // Object.is equality
test exit=1
restore cmp exit=0
=== T2-3 書いていないセルも空白として残す ===
mutation: packages/server/src/terminal/Mirror.ts: 'current += line.translateToString(true);' -> 'current += line.translateToString(false);'
     × 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない 18ms
 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない
AssertionError: expected 'abcdefghi あいう\n' to be 'abcdefghiあいう\n' // Object.is equality
test exit=1
restore cmp exit=0
=== T2-4 右端の空白を落とさない ===
mutation: packages/server/src/terminal/Mirror.ts: 'lines.push(current.replace(/ +$/, ""));' -> 'lines.push(current);'
     × 色などの制御列を含まず、各行の右端の空白と末尾の空行を落とす 18ms
 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 色などの制御列を含まず、各行の右端の空白と末尾の空行を落とす
AssertionError: expected 'red plain   \nbold\n' to be 'red plain\nbold\n' // Object.is equality
test exit=1
restore cmp exit=0
=== T2-5 末尾の空行を落とさない ===
mutation: packages/server/src/terminal/Mirror.ts: 'while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();' -> ''
     × 折り返しで分かれた行は 1 行に戻す（折り返しの境目の空白も落とさない） 18ms
     × 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない 4ms
     × 色などの制御列を含まず、各行の右端の空白と末尾の空行を落とす 4ms
     × 何も書いていなければ空文字 4ms
 Test Files  1 failed (1)
      Tests  4 failed | 25 passed (29)
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 折り返しで分かれた行は 1 行に戻す（折り返しの境目の空白も落とさない）
AssertionError: expected 'abcdefghi jklmnopqrs tuv\nnext\n\n' to be 'abcdefghi jklmnopqrs tuv\nnext\n' // Object.is equality
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない
AssertionError: expected 'abcdefghiあいう\n\n\n\n' to be 'abcdefghiあいう\n' // Object.is equality
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 色などの制御列を含まず、各行の右端の空白と末尾の空行を落とす
AssertionError: expected 'red plain\nbold\n\n\n\n\n' to be 'red plain\nbold\n' // Object.is equality
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 何も書いていなければ空文字
AssertionError: expected '\n\n\n' to be '' // Object.is equality
test exit=1
restore cmp exit=0
=== T2-6 空のときも改行を返す ===
mutation: packages/server/src/terminal/Mirror.ts: 'return lines.length === 0 ? "" : `${lines.join("\\n")}\\n`;' -> 'return `${lines.join("\\n")}\\n`;'
     × 何も書いていなければ空文字 10ms
 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — plainText（20260926-edit-scrollback の AC3） > 何も書いていなければ空文字
AssertionError: expected '\n' to be '' // Object.is equality
test exit=1
restore cmp exit=0
=== T2-C1 (点検者) ===
mutation: src/terminal/Mirror.ts: 'current = "";' -> ''
      Tests  29 passed (29)
test exit=0
restore cmp exit=0
=== T2-C2 (点検者) ===
mutation: src/terminal/Mirror.ts: '/ +$/' -> '/ $/'
     × 色などの制御列を含まず、各行の右端の空白と末尾の空行を落とす 31ms
      Tests  1 failed | 28 passed (29)
test exit=1
restore cmp exit=0
=== T2-C3 (点検者) ===
mutation: src/terminal/Mirror.ts: 'buf.getLine(y + 1)?.isWrapped' -> 'buf.getLine(y)?.isWrapped'
     × 折り返しで分かれた行は 1 行に戻す（折り返しの境目の空白も落とさない） 36ms
     × 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない 5ms
      Tests  2 failed | 27 passed (29)
test exit=1
restore cmp exit=0
=== T2-C4 (点検者) ===
mutation: src/terminal/Mirror.ts: 'y < buf.length' -> 'y < buf.length - 1'
     × スクロールバックへ押し出された行も含めて、全行を順に返す 27ms
      Tests  1 failed | 28 passed (29)
test exit=1
restore cmp exit=0
※ 上の T2-C1 は置換対象が 2 箇所あり変異が当たらなかった（無効）。下で当て直す
=== T2-C1b (点検者) ===
mutation: 行を閉じた後の 'current = "";' を削除
     × スクロールバックへ押し出された行も含めて、全行を順に返す 36ms
     × 折り返しで分かれた行は 1 行に戻す（折り返しの境目の空白も落とさない） 6ms
     × 全角の文字が右端に入らず折り返したときの空きのセルは、1 行に戻すときに挟まない 6ms
     × 色などの制御列を含まず、各行の右端の空白と末尾の空行を落とす 6ms
     × 代替画面（vim・less 等）の中でも通常バッファを読む 5ms
      Tests  5 failed | 24 passed (29)
test exit=1
restore cmp exit=0
```

### T3（scrollbackEditor）

```
=== T3-1 パスを eval の前に展開する（$1 のエスケープを外す） ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'const UNIX_SCRIPT = \'eval "${EDITOR:-vi} \\\\"\\\\$1\\\\""\';' -> 'const UNIX_SCRIPT = \'eval "${EDITOR:-vi} $1"\';'
     × 固定の script をシェルに渡し、パスは $1（script の外）で渡す 24ms
       × 引数付きの EDITOR にパスが 1 つの引数として届き、パスの中のシェルの特殊文字は実行されない（AC2・AC7） 34ms
 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Unix） > 固定の script をシェルに渡し、パスは $1（script の外）で渡す
AssertionError: expected [ '/bin/sh', '-c', …(3) ] to deeply equal [ '/bin/sh', '-c', …(3) ]
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Unix） > 実物の /bin/sh で > 引数付きの EDITOR にパスが 1 つの引数として届き、パスの中のシェルの特殊文字は実行されない（AC2・AC7）
AssertionError: expected { code: 2, …(1) } to deeply equal { code: +0, stderr: '' }
test exit=1
restore cmp exit=0
=== T3-2 空の EDITOR を vi にしない ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: '${EDITOR:-vi}' -> '${EDITOR-vi}'
     × 固定の script をシェルに渡し、パスは $1（script の外）で渡す 28ms
       × EDITOR が無い・空なら vi を使う（AC2） 103ms
 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Unix） > 固定の script をシェルに渡し、パスは $1（script の外）で渡す
AssertionError: expected [ '/bin/sh', '-c', …(3) ] to deeply equal [ '/bin/sh', '-c', …(3) ]
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Unix） > 実物の /bin/sh で > EDITOR が無い・空なら vi を使う（AC2）
AssertionError: expected 126 to be +0 // Object.is equality
test exit=1
restore cmp exit=0
=== T3-3 Windows で EDITOR を VISUAL より先に ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: '[env["VISUAL"], env["EDITOR"]]' -> '[env["EDITOR"], env["VISUAL"]]'
     × VISUAL を先に、無ければ EDITOR を、分解して末尾にパスを付ける（AC2） 47ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Windows） > VISUAL を先に、無ければ EDITOR を、分解して末尾にパスを付ける（AC2）
AssertionError: expected [ 'notepad', …(1) ] to deeply equal [ …(3) ]
test exit=1
restore cmp exit=0
=== T3-4 Windows で空白だけを有効な値とみなす ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'v !== undefined && v.trim() !== ""' -> 'v !== undefined && v !== ""'
     × VISUAL を先に、無ければ EDITOR を、分解して末尾にパスを付ける（AC2） 21ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Windows） > VISUAL を先に、無ければ EDITOR を、分解して末尾にパスを付ける（AC2）
AssertionError: expected null to deeply equal [ 'nvim', …(1) ]
test exit=1
restore cmp exit=0
=== T3-5 Windows でエディタが無ければ notepad.exe ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: '  if (editor === undefined) return null;' -> '  if (editor === undefined) return ["notepad.exe", path];'
     × どちらも無い・空白だけなら null（AC5 の失敗。herdr の notepad.exe は使わない） 23ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Windows） > どちらも無い・空白だけなら null（AC5 の失敗。herdr の notepad.exe は使わない）
AssertionError: expected [ 'notepad.exe', …(1) ] to be null
test exit=1
restore cmp exit=0
=== T3-6 引用符を区切りとして扱わない ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'if (ch === \'"\') {' -> "if (ch === '\\u0000') {"
     × VISUAL を先に、無ければ EDITOR を、分解して末尾にパスを付ける（AC2） 48ms
     × splitWindowsCommandLine は空白で区切り、引用符の中の空白は区切らない 19ms
 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Windows） > VISUAL を先に、無ければ EDITOR を、分解して末尾にパスを付ける（AC2）
AssertionError: expected [ '"C:\Program', …(5) ] to deeply equal [ …(3) ]
 FAIL  src/terminal/scrollbackEditor.test.ts > scrollbackEditorArgv（Windows） > splitWindowsCommandLine は空白で区切り、引用符の中の空白は区切らない
AssertionError: expected [ 'code', '--wait', '"a', 'b"c' ] to deeply equal [ 'code', '--wait', 'a bc' ]
test exit=1
restore cmp exit=0
=== T3-7 既存のパス・リンクに書く（wx を w に） ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'flag: "wx"' -> 'flag: "w"'
     × 書く場所に既にリンク・ファイルがあれば書かずに失敗し、ディレクトリを消す（AC6・AC8） 45ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 書く場所に既にリンク・ファイルがあれば書かずに失敗し、ディレクトリを消す（AC6・AC8）
AssertionError: promise resolved "{ …(2) }" instead of rejecting
test exit=1
restore cmp exit=0
=== T3-8 ファイルを 0644 で作る ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'mode: 0o600' -> 'mode: 0o644'
     × 専用のディレクトリ（0700）に 0600 のファイルとして書く。名前は呼ぶたびに違う（AC6） 102ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 専用のディレクトリ（0700）に 0600 のファイルとして書く。名前は呼ぶたびに違う（AC6）
AssertionError: expected 420 to be 384 // Object.is equality
test exit=1
restore cmp exit=0
=== T3-9 書き込みの失敗でディレクトリを消さない ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: '    await removeScrollbackDir(dir);\n    throw err;' -> '    throw err;'
     × 書く場所に既にリンク・ファイルがあれば書かずに失敗し、ディレクトリを消す（AC6・AC8） 75ms
     × 書き込みに失敗したら、作ったディレクトリを消してから投げる（AC8） 42ms
 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 書く場所に既にリンク・ファイルがあれば書かずに失敗し、ディレクトリを消す（AC6・AC8）
AssertionError: promise resolved "Stats{ dev: 2096, mode: 16832, …(12) }" instead of rejecting
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 書き込みに失敗したら、作ったディレクトリを消してから投げる（AC8）
AssertionError: expected [ 'wtm-scrollback-tTAEE4' ] to deeply equal []
test exit=1
restore cmp exit=0
=== T3-10 推測できる固定の名前のディレクトリ ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'const dir = await mkdtemp(join(root, "wtm-scrollback-"));' -> 'const dir = join(root, "wtm-scrollback-fixed"); await (await import("node:fs/promises")).mkdir(dir, { recursive: true });'
     × 専用のディレクトリ（0700）に 0600 のファイルとして書く。名前は呼ぶたびに違う（AC6） 53ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 専用のディレクトリ（0700）に 0600 のファイルとして書く。名前は呼ぶたびに違う（AC6）
Error: EEXIST: file already exists, open '/tmp/wtm-scrollback-test-Gvj50b/wtm-scrollback-fixed/scrollback.txt'
test exit=1
restore cmp exit=0
=== T3-11 消すときに無ければ投げる ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: '{ recursive: true, force: true }' -> '{ recursive: true }'
     × removeScrollbackDir は中身ごと消し、無くなっていても投げない 82ms
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > removeScrollbackDir は中身ごと消し、無くなっていても投げない
Error: ENOENT: no such file or directory, lstat '/tmp/wtm-scrollback-test-W6tMfO/wtm-scrollback-LwJOxr'
test exit=1
restore cmp exit=0
=== T3-7b（点検の指摘の後）既存のパスに書く（wx を w に） ===
mutation: packages/server/src/terminal/scrollbackEditor.ts: 'flag: "wx"' -> 'flag: "w"'
     × 書く場所に既にファイルがあれば書かずに失敗し、ディレクトリを消す（AC6・AC8） 35ms
     × 書く場所に既にリンクがあれば追従して書かない（AC6） 15ms
 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 書く場所に既にファイルがあれば書かずに失敗し、ディレクトリを消す（AC6・AC8）
AssertionError: promise resolved "{ …(2) }" instead of rejecting
 FAIL  src/terminal/scrollbackEditor.test.ts > writeScrollbackFile / removeScrollbackDir > 書く場所に既にリンクがあれば追従して書かない（AC6）
AssertionError: promise resolved "{ …(2) }" instead of rejecting
test exit=1
restore cmp exit=0
```

### T4（SessionModel.closePane）

```
=== T4-1 希望を焦点に使わない ===
mutation: packages/server/src/session/SessionModel.ts: 'successor ?? leaves[0] ?? paneId' -> 'leaves[0] ?? paneId'
       × 閉じた pane が焦点なら、残っている希望の pane を焦点にし successorPaneId に入れる（最初の葉ではなく） 37ms
 Test Files  1 failed (1)
      Tests  1 failed | 97 passed (98)
 FAIL  src/session/SessionModel.test.ts > SessionModel — split / close panes > closePane の後継の希望（20260926-edit-scrollback） > 閉じた pane が焦点なら、残っている希望の pane を焦点にし successorPaneId に入れる（最初の葉ではなく）
AssertionError: expected 'p1' to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T4-2 希望が tab に残っているかを見ない ===
mutation: packages/server/src/session/SessionModel.ts: 'preferredSuccessor !== undefined && leaves.includes(preferredSuccessor) ? preferredSuccessor : undefined' -> 'preferredSuccessor'
       × 希望の pane がその tab に無ければ、既定（最初の葉）で successorPaneId は付けない 55ms
 Test Files  1 failed (1)
      Tests  1 failed | 97 passed (98)
 FAIL  src/session/SessionModel.test.ts > SessionModel — split / close panes > closePane の後継の希望（20260926-edit-scrollback） > 希望の pane がその tab に無ければ、既定（最初の葉）で successorPaneId は付けない
AssertionError: expected { removedPaneIds: [ 'p3' ], …(3) } to deeply equal { removedPaneIds: [ 'p3' ], …(2) }
test exit=1
restore cmp exit=0
=== T4-3 successorPaneId を付けない ===
mutation: packages/server/src/session/SessionModel.ts: '    if (successor !== undefined) result.successorPaneId = successor;\n' -> ''
       × 閉じた pane が焦点なら、残っている希望の pane を焦点にし successorPaneId に入れる（最初の葉ではなく） 40ms
       × 閉じた pane が焦点でなければ焦点は動かさないが、successorPaneId は入れる（別のブラウザの後継の手がかり） 4ms
 Test Files  1 failed (1)
      Tests  2 failed | 96 passed (98)
 FAIL  src/session/SessionModel.test.ts > SessionModel — split / close panes > closePane の後継の希望（20260926-edit-scrollback） > 閉じた pane が焦点なら、残っている希望の pane を焦点にし successorPaneId に入れる（最初の葉ではなく）
AssertionError: expected { removedPaneIds: [ 'p3' ], …(2) } to deeply equal { removedPaneIds: [ 'p3' ], …(3) }
 FAIL  src/session/SessionModel.test.ts > SessionModel — split / close panes > closePane の後継の希望（20260926-edit-scrollback） > 閉じた pane が焦点でなければ焦点は動かさないが、successorPaneId は入れる（別のブラウザの後継の手がかり）
AssertionError: expected undefined to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T4-4 焦点でないときは successorPaneId を付けない ===
mutation: packages/server/src/session/SessionModel.ts: 'if (successor !== undefined) result.successorPaneId = successor;' -> 'if (successor !== undefined && tab.focusedPaneId === paneId) result.successorPaneId = successor;'
       × 閉じた pane が焦点でなければ焦点は動かさないが、successorPaneId は入れる（別のブラウザの後継の手がかり） 23ms
 Test Files  1 failed (1)
      Tests  1 failed | 97 passed (98)
 FAIL  src/session/SessionModel.test.ts > SessionModel — split / close panes > closePane の後継の希望（20260926-edit-scrollback） > 閉じた pane が焦点でなければ焦点は動かさないが、successorPaneId は入れる（別のブラウザの後継の手がかり）
AssertionError: expected undefined to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T4-5（点検の指摘の後）後継が無くてもキーを付ける ===
mutation: packages/server/src/session/SessionModel.ts: 'if (successor !== undefined) result.successorPaneId = successor;' -> 'result.successorPaneId = successor as PaneId;'
       × 希望の pane がその tab に無ければ、既定（最初の葉）で successorPaneId は付けない 34ms
 Test Files  1 failed (1)
      Tests  1 failed | 97 passed (98)
 FAIL  src/session/SessionModel.test.ts > SessionModel — split / close panes > closePane の後継の希望（20260926-edit-scrollback） > 希望の pane がその tab に無ければ、既定（最初の葉）で successorPaneId は付けない
AssertionError: expected true to be false // Object.is equality
test exit=1
restore cmp exit=0
```

### T5（editScrollback（開く側））

```
=== T5-1 shell を渡したときの args を捨てる ===
mutation: packages/server/src/terminal/TerminalManager.ts: 'opts.shell ? (opts.args ?? []) : defaultShell!.args' -> 'opts.shell ? [] : defaultShell!.args'
     × shell と args を渡せば、その argv で起動する 193ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/terminal/TerminalManager.test.ts > DefaultTerminalManager — 起動の引数（20260926-edit-scrollback） > shell と args を渡せば、その argv で起動する
AssertionError: expected [ [ '/bin/sh', [] ] ] to deeply equal [ Array(1) ]
test exit=1
restore cmp exit=0
=== T5-2 spawnForPane がコマンドの指定を無視する ===
mutation: packages/server/src/session/SessionService.ts: '...(command ? { shell: command.shell, args: command.args } : this.shell ? { shell: this.shell } : {}),' -> '...(this.shell ? { shell: this.shell } : {}),'
     × 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2） 82ms
     × 一時ファイルの中身は対象のミラーの平文で、専用の一時ディレクトリに置く（AC3・AC6） 51ms
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 128 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2）
AssertionError: expected undefined to be '/bin/sh' // Object.is equality
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 一時ファイルの中身は対象のミラーの平文で、専用の一時ディレクトリに置く（AC3・AC6）
TypeError: Cannot read properties of undefined (reading '3')
test exit=1
restore cmp exit=0
=== T5-3 拡大表示にしない ===
mutation: packages/server/src/session/SessionService.ts: '        this.model.zoomPane(newPaneId, "on");\n' -> ''
     × 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2） 151ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2）
AssertionError: expected null to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T5-4 作業場所を対象の場所にしない ===
mutation: packages/server/src/session/SessionService.ts: 'const spawn = await this.spawnForPane(newPaneId, current.cwd, {' -> 'const spawn = await this.spawnForPane(newPaneId, this.defaultCwd, {'
     × 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2） 59ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2）
AssertionError: expected '/home/u' to be '/home/u/api' // Object.is equality
test exit=1
restore cmp exit=0
=== T5-5 端末が無いことを確かめない ===
mutation: packages/server/src/session/SessionService.ts: '    if (!host) throw new RpcError("not_found", `pane has no terminal: ${paneId}`);\n' -> ''
       × 端末が無い（復元に失敗した pane 等） → not_found 35ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > 端末が無い（復元に失敗した pane 等） → not_found
AssertionError: expected TypeError: Cannot read properties of unde… to match object { code: 'not_found' }
test exit=1
restore cmp exit=0
=== T5-6 Windows でエディタが決まらないのを先に見ない ===
mutation: packages/server/src/session/SessionService.ts: '    if (scrollbackEditorArgv("", platform, env) === null) throw new RpcError("spawn_failed", "no editor: set VISUAL or EDITOR for the server");\n' -> ''
       × Windows で VISUAL・EDITOR が無い → spawn_failed（一時ファイルを作る前） 24ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > Windows で VISUAL・EDITOR が無い → spawn_failed（一時ファイルを作る前）
AssertionError: expected TypeError: Cannot read properties of null… to match object { code: 'spawn_failed' }
test exit=1
restore cmp exit=0
=== T5-7 書いた後に対象がまだあるかを見ない ===
mutation: packages/server/src/session/SessionService.ts: 'const current = this.requirePane(paneId); // 書いている間に閉じられていないか' -> 'const current = source;'
       × 書いている間に対象が閉じられた → not_found 32ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > 書いている間に対象が閉じられた → not_found
AssertionError: expected NotFoundError: pane not found: p2 to match object { code: 'not_found' }
test exit=1
restore cmp exit=0
=== T5-8 起動の失敗で止めない ===
mutation: packages/server/src/session/SessionService.ts: '      if (!spawn.ok) throw new RpcError("spawn_failed", `failed to start an editor for the scrollback of ${paneId}`);\n' -> ''
       × エディタが猶予中に 0 以外で終わる（起動できない） → spawn_failed 39ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > エディタが猶予中に 0 以外で終わる（起動できない） → spawn_failed
AssertionError: promise resolved "{ pane: { id: 'p2', …(13) } }" instead of rejecting
test exit=1
restore cmp exit=0
=== T5-9 分割できないときにエディタの端末を捨てない ===
mutation: packages/server/src/session/SessionService.ts: '      } catch (err) {\n        this.terminals.dispose(newPaneId);\n        throw err;\n      }\n      this.scrollbackEditors.set' -> '      } catch (err) {\n        throw err;\n      }\n      this.scrollbackEditors.set'
       × 起動の猶予の間に対象が閉じられた（分割できない） → 端末を捨てて投げる 52ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > 起動の猶予の間に対象が閉じられた（分割できない） → 端末を捨てて投げる
AssertionError: expected 2 to be 1 // Object.is equality
test exit=1
restore cmp exit=0
=== T5-10 失敗したときに一時ディレクトリを消さない ===
mutation: packages/server/src/session/SessionService.ts: '      if (!committed) await this.removeScrollbackDirQuietly(dir);' -> ''
       × エディタが猶予中に 0 以外で終わる（起動できない） → spawn_failed 46ms
       × 書いている間に対象が閉じられた → not_found 24ms
       × 起動の猶予の間に対象が閉じられた（分割できない） → 端末を捨てて投げる 31ms
 Test Files  1 failed | 1 passed (2)
      Tests  3 failed | 127 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > エディタが猶予中に 0 以外で終わる（起動できない） → spawn_failed
AssertionError: expected [ 'wtm-scrollback-nt7KGZ' ] to deeply equal []
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > 書いている間に対象が閉じられた → not_found
AssertionError: expected [ 'wtm-scrollback-UTppLw' ] to deeply equal []
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 失敗したら新しい pane も一時ファイルも残さない（AC5・AC8） > 起動の猶予の間に対象が閉じられた（分割できない） → 端末を捨てて投げる
AssertionError: expected [ 'wtm-scrollback-Va67UF' ] to deeply equal []
test exit=1
restore cmp exit=0
=== T5-11 ミラーの中身を書かない ===
mutation: packages/server/src/session/SessionService.ts: 'writeScrollbackFile(host.mirror.plainText(), tmpRoot)' -> 'writeScrollbackFile("", tmpRoot)'
     × 一時ファイルの中身は対象のミラーの平文で、専用の一時ディレクトリに置く（AC3・AC6） 41ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 一時ファイルの中身は対象のミラーの平文で、専用の一時ディレクトリに置く（AC3・AC6）
AssertionError: expected '' to be 'line1\nline2\n' // Object.is equality
test exit=1
restore cmp exit=0
=== T5-12 pane.created を出さない ===
mutation: packages/server/src/session/SessionService.ts: '      committed = true;\n      this.bus.publish({ event: "pane.created", data: { pane } });' -> '      committed = true;'
     × 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2） 64ms
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 129 passed (130)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 対象を分割した新しい pane でエディタを起動し、拡大表示にして焦点を移す。作業場所は対象の場所（AC1・AC2）
AssertionError: expected [ 'layout.updated' ] to deeply equal [ 'pane.created', 'layout.updated' ]
test exit=1
restore cmp exit=0
=== T5-13（点検の指摘の後）猶予中に 0 で終わったエディタを閉じない ===
mutation: packages/server/src/session/SessionService.ts: '      if (spawn.alreadyExited) await this.closePaneAfterExit(pane.id, 0);\n      return { pane };' -> '      return { pane };'
     × エディタが猶予中に 0 で終わったら、pane をコミットしてすぐ閉じる（拡大表示のまま残さない） 80ms
 Test Files  1 failed (1)
      Tests  1 failed | 128 passed (129)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > エディタが猶予中に 0 で終わったら、pane をコミットしてすぐ閉じる（拡大表示のまま残さない）
AssertionError: expected { id: 'p2', tabId: 't1', …(12) } to be undefined
test exit=1
restore cmp exit=0
```

### T6（閉じる側）

```
=== T6-1 後継の希望を渡さない ===
mutation: packages/server/src/session/SessionService.ts: 'const result = this.model.closePane(paneId, editor?.sourcePaneId);' -> 'const result = this.model.closePane(paneId);'
       × エディタが終わると pane が閉じ、焦点は対象へ（最初の葉ではなく）・拡大表示は解除・一時ディレクトリは消える 57ms
       × 開く前に対象が拡大表示なら、利用者がエディタの pane を閉じたときに対象の拡大表示へ戻す（layout.updated に載る） 27ms
 Test Files  1 failed (1)
      Tests  2 failed | 133 passed (135)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > エディタが終わると pane が閉じ、焦点は対象へ（最初の葉ではなく）・拡大表示は解除・一時ディレクトリは消える
AssertionError: expected 'p1' to be 'p2' // Object.is equality
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 開く前に対象が拡大表示なら、利用者がエディタの pane を閉じたときに対象の拡大表示へ戻す（layout.updated に載る）
AssertionError: expected 'p1' to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T6-2 拡大表示を戻さない ===
mutation: packages/server/src/session/SessionService.ts: '    if (zoomBack && result.removedTabIds.length === 0 && this.model.getPane(zoomBack)?.tabId === tabId) this.model.zoomPane(zoomBack, "on");\n' -> ''
       × 開く前に対象が拡大表示なら、利用者がエディタの pane を閉じたときに対象の拡大表示へ戻す（layout.updated に載る） 36ms
 Test Files  1 failed (1)
      Tests  1 failed | 134 passed (135)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 開く前に対象が拡大表示なら、利用者がエディタの pane を閉じたときに対象の拡大表示へ戻す（layout.updated に載る）
AssertionError: expected null to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T6-3 戻す先がまだあるかを見ない ===
mutation: packages/server/src/session/SessionService.ts: 'if (zoomBack && result.removedTabIds.length === 0 && this.model.getPane(zoomBack)?.tabId === tabId)' -> 'if (zoomBack && result.removedTabIds.length === 0)'
       × 対象が先に閉じられていたら、焦点は既定の規則（最初の葉）で、拡大表示も戻さない 47ms
 Test Files  1 failed (1)
      Tests  1 failed | 134 passed (135)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 対象が先に閉じられていたら、焦点は既定の規則（最初の葉）で、拡大表示も戻さない
test exit=1
restore cmp exit=0
=== T6-4 閉じたときに一時ディレクトリを消さない ===
mutation: packages/server/src/session/SessionService.ts: '      const cleanup = this.removeScrollbackDirQuietly(editor.dir).finally(() => this.scrollbackCleanups.delete(cleanup));\n      this.scrollbackCleanups.add(cleanup);\n' -> ''
       × エディタが終わると pane が閉じ、焦点は対象へ（最初の葉ではなく）・拡大表示は解除・一時ディレクトリは消える 5033ms
       × 開く前に対象が拡大表示なら、利用者がエディタの pane を閉じたときに対象の拡大表示へ戻す（layout.updated に載る） 5006ms
       × 対象が先に閉じられていたら、焦点は既定の規則（最初の葉）で、拡大表示も戻さない 5006ms
       × tab ごと・workspace ごと閉じても一時ディレクトリは消える 5006ms
       × 猶予中に 0 で終わったエディタも一時ディレクトリを残さない 5007ms
 Test Files  1 failed (1)
      Tests  5 failed | 130 passed (135)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > エディタが終わると pane が閉じ、焦点は対象へ（最初の葉ではなく）・拡大表示は解除・一時ディレクトリは消える
Error: Test timed out in 5000ms.
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 開く前に対象が拡大表示なら、利用者がエディタの pane を閉じたときに対象の拡大表示へ戻す（layout.updated に載る）
Error: Test timed out in 5000ms.
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 対象が先に閉じられていたら、焦点は既定の規則（最初の葉）で、拡大表示も戻さない
Error: Test timed out in 5000ms.
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > tab ごと・workspace ごと閉じても一時ディレクトリは消える
Error: Test timed out in 5000ms.
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 猶予中に 0 で終わったエディタも一時ディレクトリを残さない
Error: Test timed out in 5000ms.
test exit=1
restore cmp exit=0
=== T6-5 停止時に開いたままのものを消さない ===
mutation: packages/server/src/session/SessionService.ts: 'await Promise.all([...dirs.map((d) => this.removeScrollbackDirQuietly(d)), ...this.scrollbackCleanups]);' -> 'void dirs; await Promise.all([...this.scrollbackCleanups]);'
       × 停止時（disposeScrollbackEditors）は開いたままのエディタの一時ディレクトリも消す。その後に閉じても投げない 46ms
 Test Files  1 failed (1)
      Tests  1 failed | 134 passed (135)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 停止時（disposeScrollbackEditors）は開いたままのエディタの一時ディレクトリも消す。その後に閉じても投げない
AssertionError: expected [ 'wtm-scrollback-XswOO5' ] to deeply equal []
test exit=1
restore cmp exit=0
== T6 mutation sweep 2026年  9月 26日 土曜日 14:17:40 JST ==
M1-no-cleanup-in-publish: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
      Tests  5 failed | 12 passed | 118 skipped (135)
M2-no-map-delete:       Tests  17 passed | 118 skipped (135)
M3-no-finally-delete:       Tests  17 passed | 118 skipped (135)
M4-dispose-no-await-inflight:       Tests  17 passed | 118 skipped (135)
M5-dispose-no-open-dirs: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 16 passed | 118 skipped (135)
M6-dispose-no-clear:       Tests  17 passed | 118 skipped (135)
M7-no-successor-hint: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 15 passed | 118 skipped (135)
M8-no-zoomback: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 16 passed | 118 skipped (135)
M9-no-removedTabs-cond:       Tests  17 passed | 118 skipped (135)
M10-no-tabId-cond:       Tests  17 passed | 118 skipped (135)
M11-zoomBack-true:       Tests  17 passed | 118 skipped (135)
結果: M1・M5・M7・M8 は落ちる（守られている）。M9・M11 は等価変異（removedTabIds の条件と zoomBack の null 判定は tabId の条件で包含）。
生き残り（テストの穴）: M10（tabId の条件＝元の pane が別の tab へ移った）・M4（停止時に削除中のものを待つ）・M2/M3/M6（記録の掃除。観測できる害は小さい）。
SessionService.ts は cmp で元の写しと一致を確認。git diff --stat の差（docs/*・surface/methods/pane.ts）は並行の作業によるもので、この点検の変更ではない。
=== T6-6（点検の指摘の後）戻す先が同じ tab にあるかを見ない ===
mutation: packages/server/src/session/SessionService.ts: 'this.model.getPane(zoomBack)?.tabId === tabId' -> 'this.model.getPane(zoomBack) !== undefined'
       × 元の pane が別の tab へ移っていたら、どちらの tab にも拡大表示をかけない 238ms
 Test Files  1 failed (1)
      Tests  1 failed | 137 passed (138)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 元の pane が別の tab へ移っていたら、どちらの tab にも拡大表示をかけない
AssertionError: expected 'p3' to be null
test exit=1
restore cmp exit=0
=== T6-7（点検の指摘の後）停止時に削除の途中のものを待たない ===
mutation: packages/server/src/session/SessionService.ts: 'await Promise.all([...dirs.map((d) => this.removeScrollbackDirQuietly(d)), ...this.scrollbackCleanups]);' -> 'await Promise.all([...dirs.map((d) => this.removeScrollbackDirQuietly(d))]);'
       × 停止時は、閉じた直後でまだ削除の途中のものも待つ 48ms
 Test Files  1 failed (1)
      Tests  1 failed | 137 passed (138)
 FAIL  src/session/SessionService.test.ts > SessionService — スクロールバックを $EDITOR で開く（20260926-edit-scrollback） > 閉じたとき（AC4・AC8） > 停止時は、閉じた直後でまだ削除の途中のものも待つ
AssertionError: expected [ 'wtm-scrollback-OvvEck', …(1) ] to deeply equal []
test exit=1
restore cmp exit=0
```

### T7（方式の登録）

```
=== T7-1 方式を登録しない ===
mutation: packages/server/src/surface/methods/pane.ts: '  surface.register("pane.edit_scrollback", {' -> '  (() => undefined)("pane.edit_scrollback", {'
     × 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13） 250ms
     × pane.edit_scrollback はエディタの pane を作って返し、同じ tab で拡大表示にする（20260926-edit-scrollback の AC1） 6ms
     × pane.edit_scrollback の失敗は既存のエラーコードで返す（無い pane は not_found・paneId が無ければ invalid_params） 34ms
 Test Files  1 failed (1)
      Tests  3 failed | 22 passed (25)
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13）
AssertionError: pane.edit_scrollback: expected { foreground: '#ffffff', …(5) } to be { foreground: '#4c4f69', …(5) } // Object.is equality
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > pane.edit_scrollback はエディタの pane を作って返し、同じ tab で拡大表示にする（20260926-edit-scrollback の AC1）
Error: unexpected error: {"code":"not_found","message":"unknown method: pane.edit_scrollback"}
    351|       if (!result.ok) throw new Error(`unexpected error: ${JSON.string…
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > pane.edit_scrollback の失敗は既存のエラーコードで返す（無い pane は not_found・paneId が無ければ invalid_params）
AssertionError: expected { ok: false, error: { …(2) } } to deeply equal { ok: false, error: { …(2) } }
test exit=1
restore cmp exit=0
=== T7-2 作る前に操作の時刻を進めない ===
mutation: packages/server/src/surface/methods/pane.ts: '      deps.clients.touch(ctx.clientId);\n      const result = await deps.session.editScrollback(params.paneId);' -> '      const result = await deps.session.editScrollback(params.paneId);'
     × 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13） 193ms
 Test Files  1 failed (1)
      Tests  1 failed | 24 passed (25)
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13）
AssertionError: pane.edit_scrollback: expected { foreground: '#ffffff', …(5) } to be { foreground: '#4c4f69', …(5) } // Object.is equality
test exit=1
restore cmp exit=0
=== T7-3 別のスキーマで検証する ===
mutation: packages/server/src/surface/methods/pane.ts: '    schema: PaneEditScrollbackParams,' -> '    schema: PaneCloseParams.partial(),'
     × pane.edit_scrollback の失敗は既存のエラーコードで返す（無い pane は not_found・paneId が無ければ invalid_params） 28ms
 Test Files  1 failed (1)
      Tests  1 failed | 24 passed (25)
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > pane.edit_scrollback の失敗は既存のエラーコードで返す（無い pane は not_found・paneId が無ければ invalid_params）
AssertionError: expected { ok: false, error: { …(2) } } to match object { ok: false, …(1) }
test exit=1
restore cmp exit=0
=== T7-4（点検の指摘の後）サイズ権限を取らない ===
mutation: packages/server/src/surface/methods/pane.ts: '      const result = await deps.session.editScrollback(params.paneId);\n      deps.sizeAuthority.noteInteraction(ctx.clientId, result.pane.id);' -> '      const result = await deps.session.editScrollback(params.paneId);'
     × pane.edit_scrollback を送ったクライアントが、エディタの pane の tab のサイズ権限を取る（分割と同じ） 24ms
 Test Files  1 failed (1)
      Tests  1 failed | 25 passed (26)
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > pane.edit_scrollback を送ったクライアントが、エディタの pane の tab のサイズ権限を取る（分割と同じ）
AssertionError: expected '0d948fbf-e9c5-4556-929f-ff9b6085491a' to be '17d3b73b-661a-404a-8aa6-940439e31243' // Object.is equality
test exit=1
restore cmp exit=0
```

T7-5 は review ラウンド 1 の指摘（停止時の後片付けの 1 行を守るテストが無い）への対応の確認。手元の Python で 1 行を消し、`packages/server` で `npx vitest run src/composeServer.integration.test.ts -t "close"` を走らせた出力の抜粋（`grep -E "×|Test Files|Tests |FAIL|AssertionError"`）。`finally` の位置は守るテストを足していない（decisions.md D15）。

```
=== T7-5（review ラウンド 1 の後）停止時に後片付けを呼ばない ===
mutation: packages/server/src/composeServer.ts: '        await session.disposeScrollbackEditors();' を削除
     × close() は開いたままのスクロールバックのエディタの一時ディレクトリを消す（20260926-edit-scrollback の AC8） 1061ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/composeServer.integration.test.ts > composeServer (integration) > close() は開いたままのスクロールバックのエディタの一時ディレクトリを消す（20260926-edit-scrollback の AC8）
AssertionError: expected [ 'wtm-scrollback-0gS2ZR' ] to deeply equal []
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed | 19 skipped (22)
test exit=1
restore cmp exit=0
```

### T8（web）

```
=== T8-1 既定の割り当てを外す ===
mutation: packages/web/src/keys/bindings.ts: 'defaults: ["prefix+e"],' -> 'defaults: [],'
     × 既定の割り当てはすべて `prefix+…` として読め、範囲になるのは範囲の操作（switch_tab・focus_agent）だけ 30ms
     × 引くと実行する Action が、これまでの割り当てと同じ（代表） 21ms
     × prefix の後のキーが 44 個、旧表を固定した値と完全に一致する 74ms
     × 既定は prefix+e 16ms
     × prefix が alt+e でも、e（修飾が違う別の chord）は edit_scrollback のまま 25ms
     × prefix+e はスクロールバックをエディタで開く action を返し、terminal へ戻る（20260926-edit-scrollback） 67ms
     × e は edit_scrollback が既定で使っているので、別の操作への割り当ては拒否する（20260926-edit-scrollback で「後続」の案内から昇格） 21ms
     × 既定の表示：割り当てなしの行は灰色。「未対応（後続: ◯◯）」の行はもう無い（20260926-edit-scrollback で最後の e が昇格） 91ms
     × 何も変えていなければ、今のキー（prefix+ を付けた表記）。先頭に prefix の行。tab / shift+tab の行は pane 群の巡回へ 39ms
     × shift+r を別の操作に割り当てると、reload_config の既定行は「なし」になる（後続ではなく通常の上書き。全体の群） 24ms
 Test Files  5 failed | 13 passed (18)
      Tests  10 failed | 595 passed (605)
 FAIL  src/components/HelpDialog.test.ts > HelpDialog — 表示 > 既定の表示：割り当てなしの行は灰色。「未対応（後続: ◯◯）」の行はもう無い（20260926-edit-scrollback で最後の e が昇格）
AssertionError: expected undefined to be 'スクロールバックをエディタで開く' // Object.is equality
 FAIL  src/components/HelpDialog.test.ts > HelpDialog — 現在の割り当て（AC11） > 何も変えていなければ、今のキー（prefix+ を付けた表記）。先頭に prefix の行。tab / shift+tab の行は pane 群の巡回へ
AssertionError: expected [ 'prefix+v', 'prefix+-', …(18) ] to include 'prefix+e'
 FAIL  src/components/HelpDialog.test.ts > HelpDialog — 現在の割り当て（AC11） > shift+r を別の操作に割り当てると、reload_config の既定行は「なし」になる（後続ではなく通常の上書き。全体の群）
AssertionError: expected undefined to be 'スクロールバックをエディタで開く' // Object.is equality
 FAIL  src/keys/KeyRouter.test.ts > KeyRouter — prefix モード > prefix+e はスクロールバックをエディタで開く action を返し、terminal へ戻る（20260926-edit-scrollback）
AssertionError: expected { kind: 'consume' } to deeply equal { kind: 'action', …(1) }
 FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)） > e は edit_scrollback が既定で使っているので、別の操作への割り当ては拒否する（20260926-edit-scrollback で「後続」の案内から昇格）
Error: 通ってしまった: prefix+e
 FAIL  src/keys/bindings.test.ts > 操作のカタログ（design「操作のカタログ」） > 既定の割り当てはすべて `prefix+…` として読め、範囲になるのは範囲の操作（switch_tab・focus_agent）だけ
AssertionError: edit_scrollback: expected 0 to be greater than 0
 FAIL  src/keys/bindings.test.ts > 操作のカタログ（design「操作のカタログ」） > 引くと実行する Action が、これまでの割り当てと同じ（代表）
AssertionError: expected { id: 'edit_scrollback', …(4) } to match object { group: 'pane', …(1) }
 FAIL  src/keys/keymap.test.ts > 既定の表は旧 DEFAULT_KEYMAP と 1:1（AC1・AC2） > prefix の後のキーが 44 個、旧表を固定した値と完全に一致する
AssertionError: expected [ …(43) ] to deeply equal [ …(44) ]
 FAIL  src/keys/keymap.test.ts > resolveKeymap — edit_scrollback（20260926-edit-scrollback。「後続」の案内だった e） > 既定は prefix+e
AssertionError: expected [] to deeply equal [ 'prefix+e' ]
 FAIL  src/keys/keymap.test.ts > resolveKeymap — edit_scrollback（20260926-edit-scrollback。「後続」の案内だった e） > prefix が alt+e でも、e（修飾が違う別の chord）は edit_scrollback のまま
AssertionError: expected undefined to deeply equal { type: 'editScrollback' }
test exit=1
restore cmp exit=0
=== T8-2 操作を実行しない ===
mutation: packages/web/src/actions/ActionDispatcher.ts: '      case "editScrollback":\n        this.editScrollback();\n        return;\n' -> ''
     × 焦点の pane を対象に pane.edit_scrollback を送り、応答のエディタの pane へ焦点を移す（AC1） 24ms
     × 応答を待つ間に打った文字は、エディタの pane へ届く（D99。拡大表示されているのはその pane 自身） 7ms
     × 失敗したらトーストを出し、焦点も打った文字も元の pane のまま（AC5） 4ms
 Test Files  1 failed | 17 passed (18)
      Tests  3 failed | 602 passed (605)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 焦点の pane を対象に pane.edit_scrollback を送り、応答のエディタの pane へ焦点を移す（AC1）
AssertionError: expected [] to deeply equal [ [ 'pane.edit_scrollback', …(1) ] ]
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 応答を待つ間に打った文字は、エディタの pane へ届く（D99。拡大表示されているのはその pane 自身）
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 失敗したらトーストを出し、焦点も打った文字も元の pane のまま（AC5）
AssertionError: expected [] to deeply equal [ 'スクロールバックをエディタで開けませんでした' ]
test exit=1
restore cmp exit=0
=== T8-3 応答の pane へ焦点を移さない ===
mutation: packages/web/src/actions/ActionDispatcher.ts: '        this.view.focusPane(r.pane.id);\n        this.releaseHold(hold, r.pane.id);\n      })\n      .catch(() => {\n        hold?.cancel();\n        this.view.toast("スクロールバックを' -> '        this.releaseHold(hold, r.pane.id);\n      })\n      .catch(() => {\n        hold?.cancel();\n        this.view.toast("スクロールバックを'
     × 焦点の pane を対象に pane.edit_scrollback を送り、応答のエディタの pane へ焦点を移す（AC1） 25ms
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 604 passed (605)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 焦点の pane を対象に pane.edit_scrollback を送り、応答のエディタの pane へ焦点を移す（AC1）
AssertionError: expected 'p1' to be 'p2' // Object.is equality
test exit=1
restore cmp exit=0
=== T8-4 溜めた入力をエディタの pane へ渡さない ===
mutation: packages/web/src/actions/ActionDispatcher.ts: '        this.view.focusPane(r.pane.id);\n        this.releaseHold(hold, r.pane.id);\n      })\n      .catch(() => {\n        hold?.cancel();\n        this.view.toast("スクロールバックを' -> '        this.view.focusPane(r.pane.id);\n        hold?.cancel();\n      })\n      .catch(() => {\n        hold?.cancel();\n        this.view.toast("スクロールバックを'
     × 応答を待つ間に打った文字は、エディタの pane へ届く（D99。拡大表示されているのはその pane 自身） 31ms
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 604 passed (605)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 応答を待つ間に打った文字は、エディタの pane へ届く（D99。拡大表示されているのはその pane 自身）
AssertionError: expected "vi.fn()" to be called with arguments: [ 'p2', '/err' ]
test exit=1
restore cmp exit=0
=== T8-5 失敗で溜めた入力を返さない ===
mutation: packages/web/src/actions/ActionDispatcher.ts: '        hold?.cancel();\n        this.view.toast("スクロールバックをエディタで開けませんでした");' -> '        this.view.toast("スクロールバックをエディタで開けませんでした");'
     × 失敗したらトーストを出し、焦点も打った文字も元の pane のまま（AC5） 31ms
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 604 passed (605)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 失敗したらトーストを出し、焦点も打った文字も元の pane のまま（AC5）
AssertionError: expected "vi.fn()" to be called with arguments: [ 'p1', 'q' ]
test exit=1
restore cmp exit=0
=== T8-6 失敗を知らせない ===
mutation: packages/web/src/actions/ActionDispatcher.ts: '        this.view.toast("スクロールバックをエディタで開けませんでした");' -> ''
     × 失敗したらトーストを出し、焦点も打った文字も元の pane のまま（AC5） 57ms
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 604 passed (605)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 失敗したらトーストを出し、焦点も打った文字も元の pane のまま（AC5）
AssertionError: expected [] to deeply equal [ 'スクロールバックをエディタで開けませんでした' ]
test exit=1
restore cmp exit=0
=== T8-7 焦点が無くても送る ===
mutation: packages/web/src/actions/ActionDispatcher.ts: '    const paneId = this.view.focusedPaneId;\n    if (!paneId) return;\n    const hold = this.input?.holdInput(paneId);' -> '    const paneId = this.view.focusedPaneId ?? "";\n    const hold = this.input?.holdInput(paneId);'
     × 焦点の pane が無ければ何も送らない 54ms
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 604 passed (605)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > 焦点の pane が無ければ何も送らない
AssertionError: expected [ [ 'pane.edit_scrollback', …(1) ] ] to deeply equal []
test exit=1
restore cmp exit=0
=== T8-8 別の操作の action を割り当てる ===
mutation: packages/web/src/keys/bindings.ts: 'action: { type: "editScrollback" },' -> 'action: { type: "zoom" },'
     × 引くと実行する Action が、これまでの割り当てと同じ（代表） 25ms
     × prefix+e はスクロールバックをエディタで開く action を返し、terminal へ戻る（20260926-edit-scrollback） 33ms
     × prefix の後のキーが 44 個、旧表を固定した値と完全に一致する 139ms
     × prefix が alt+e でも、e（修飾が違う別の chord）は edit_scrollback のまま 10ms
 Test Files  3 failed | 15 passed (18)
      Tests  4 failed | 601 passed (605)
 FAIL  src/keys/KeyRouter.test.ts > KeyRouter — prefix モード > prefix+e はスクロールバックをエディタで開く action を返し、terminal へ戻る（20260926-edit-scrollback）
AssertionError: expected { kind: 'action', …(1) } to deeply equal { kind: 'action', …(1) }
 FAIL  src/keys/bindings.test.ts > 操作のカタログ（design「操作のカタログ」） > 引くと実行する Action が、これまでの割り当てと同じ（代表）
AssertionError: expected { type: 'zoom' } to deeply equal { type: 'editScrollback' }
 FAIL  src/keys/keymap.test.ts > 既定の表は旧 DEFAULT_KEYMAP と 1:1（AC1・AC2） > prefix の後のキーが 44 個、旧表を固定した値と完全に一致する
AssertionError: expected [ …(44) ] to deeply equal [ …(44) ]
 FAIL  src/keys/keymap.test.ts > resolveKeymap — edit_scrollback（20260926-edit-scrollback。「後続」の案内だった e） > prefix が alt+e でも、e（修飾が違う別の chord）は edit_scrollback のまま
AssertionError: expected { type: 'zoom' } to deeply equal { type: 'editScrollback' }
test exit=1
restore cmp exit=0
```

### cross（タスクをまたぐ）

```
=== cross-1 閉じた pane にも焦点を移す ===
mutation: packages/web/src/actions/ActionDispatcher.ts: 'if (this.session.panes.has(r.pane.id)) this.view.focusPane(r.pane.id);' -> 'this.view.focusPane(r.pane.id);'
     × エディタがすぐ終わって応答の時点で pane が無ければ、焦点は元の pane のまま・打った文字も元の pane へ 43ms
 Test Files  1 failed (1)
      Tests  1 failed | 147 passed (148)
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — スクロールバックをエディタで開く（20260926-edit-scrollback） > エディタがすぐ終わって応答の時点で pane が無ければ、焦点は元の pane のまま・打った文字も元の pane へ
AssertionError: expected 'p2' to be 'p1' // Object.is equality
test exit=1
restore cmp exit=0
```

## 実物の PTY での確認

```
$ node e2e-real-pty.mjs
opened editor pane: p2 zoomed: true shell: /bin/sh
temp dirs while open: [ 'wtm-scrollback-l7Yief' ]
argc=2
arg1=--readonly
arg2=/tmp/wtm-e2e-edit-UsxK4O/tmp root with space/wtm-scrollback-l7Yief/scrollback.txt
file=600
dir=700
body lines: 3004 has 1: true has 3000: true has RED done: true has ESC: false
after close: focus back to source: true zoom cleared: true
pane.closed: [{"paneId":"p2","successorPaneId":"p1"}]
temp dirs after close: []
```

## 起動確認（smoke）

ラウンド 2 の出力:

```
$ aidev smoke
smoke: 20260926-edit-scrollback
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38238 (state dir /tmp/wtm-smoke-5fKnly)
{"ts":"2026-09-26T06:40:49.589Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/edit-scrollback/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-3xqrO8, sandboxed HOME /tmp/wtmctl-smoke-home-OoRGtw
{"ts":"2026-09-26T06:40:55.519Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:38460
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

この work は新しいサブコマンド・オプションを足していない（足したのは WebSocket の方式 `pane.edit_scrollback` とキー 1 つ）ので `smokeCommands` は増やさない。方式は `surface/methods/index.test` と実物の PTY の確認で起動している。

## 未検証の穴（skip / 環境不足）

- **ブラウザでの実操作**（`prefix+e` を押してエディタが開き、閉じて戻る）: E2E を走らせない方針のため未確認。`docs/verification.md` の手元の追加確認に手順を書いた。
- **Windows ネイティブのサーバ**: `VISUAL`/`EDITOR` の argv の組み立ては単体テストで確かめたが、ConPTY での起動・`.cmd` のエディタ（`code` 等）・一時ディレクトリの権限（NTFS の ACL）・プロセス終了直後の `rm` の EBUSY は実機で確かめていない。シンボリックリンクと 0700/0600 のテストは Windows では skip になる。
- **サーバの異常終了**（kill -9 等）では一時ディレクトリが残る（仕様。0700 で守られる）。
- **停止処理の最中に届いた要求**で一時ディレクトリが残りうる極短い時間帯（review.md のタスク点検ログ T7）。
- 本物の `vi` での表示は確かめていない（偽のエディタで引数・中身・権限を確かめた）。
