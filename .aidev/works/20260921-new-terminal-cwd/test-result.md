# テスト結果: 新しい workspace・tab・pane を、いま見ている場所で開く（herdr の `terminal.new_cwd`）

## 実行したもの

- `pnpm typecheck`（各パッケージの `tsconfig.typecheck.json`。テストを含む）— exit 0
- `pnpm test`（vitest。protocol・server・web）— **1534 passed** / 0 failed / 0 skipped（115 files）
- `pnpm exec eslint <この work で変えた .ts>` — exit 0
- `aidev coverage --strict` — ac=18、design=18/18、tasks=18/18、gaps=0
- `pnpm build` の後、この work の影響を受ける E2E の spec だけ（利用者の指示。一式は deliver の直前に 1 回。decisions D6）:
  `pnpm --filter @wtm/e2e exec playwright test src/specs/new-terminal-cwd.spec.ts src/specs/workspace-tab-pane.spec.ts
  src/specs/keys-mouse-dialogs.spec.ts src/specs/notifications.spec.ts src/specs/mobile.spec.ts src/specs/settings.spec.ts`
  — **52 passed** / 0 failed（3.2 分。new-terminal-cwd 4・workspace-tab-pane 10・keys-mouse-dialogs 13・notifications 8・mobile 6・settings 11）
- `aidev smoke` — pass（下の「起動確認」）

## 受け入れ基準ごとの判定

- AC1: pass — E2E `new-terminal-cwd.spec.ts` の 1 本目。焦点の pane で `cd` してから `Ctrl+B N`、新しい pane の `pwd` をブラウザが受けたフレームで読む。
  サーバ単体（`SessionService.test.ts`：新しい workspace が元の pane のいまの場所で起動し、`Workspace.cwd`・`Pane.cwd` もそこ）、web 単体（焦点の pane を載せる）。
  読み直し（記録ではなくその時点の前面プロセスの cwd）は `composeServer.integration.test.ts`（監視を動かさずに本物のシェルで）と `newCwd.test.ts`
- AC2: pass — E2E 1 本目（`cd` → `Ctrl+B c` → `pwd`）。サーバ単体（`Workspace.cwd` は書き換えない）、web 単体（焦点の pane が作る先の workspace にあるときだけ載せる・
  ダイアログの間に焦点の pane が閉じられたら戻った先を載せる）
- AC3: pass — E2E 1 本目（`cd` → `Ctrl+B v` → `pwd`）。サーバ単体（分割する pane のいまの場所・`Workspace.cwd` は書き換えない）
- AC4: pass — E2E 1 本目は何も設定していないブラウザで通す。web 単体（`loadNewCwdPolicy` は壊れた値・無い値で `follow`）
- AC5: pass — サーバ単体（`newCwd.test.ts`：読めない・reject・同期で投げる・上限切れで記録された場所、元の pane が無ければ 1 段目の代わり、どれも `fellBack` を立てない。
  `SessionService.test.ts`：「引き継ぐ」で代わりへ回っても `cwdFallback` を返さない）、web 単体（`cwdFallback` が無ければトーストを出さない）
- AC6: pass — E2E 2 本目（ホームで新しい tab → `pwd` がホーム）。サーバ単体
- AC7: pass — E2E 2 本目。**分割で見分ける**（元の pane の記録が `cd` した先へ追従したのをサーバの状態で待ってから分割し、`pwd` がサーバを起動した場所）。サーバ単体
- AC8: pass — E2E 2 本目（指定した場所で新しい workspace）。`~` の展開・相対パス・`~user` の拒否はサーバ単体
- AC9: pass — E2E 3 本目（無い場所を指定 → トースト「新しく開く場所が使えないため、代わりの場所で開きました」と、その workspace の場所）。
  サーバ単体（無い・ディレクトリでない・入れない・空・相対・`~user`、代わりの 2 段目、3 つの作成すべてで `cwdFallback`）、web 単体（3 つの作成それぞれでトースト）
- AC10: pass — web 単体（設定を変えても要求を出さない、次の作成から新しい方針）
- AC11: pass — サーバ単体（明示した `cwd` が `newCwd` に勝ち、検証も代わりもしない）、web 単体（worktree の経路は方針が何でも `cwd` だけを送る。既存の worktree のテスト 3 本も完全一致で守る）
- AC12: pass — `docs/herdr-parity.md` の H36 を H36（シェル・起動モード。AC3・AC16）と H36b（cwd の方針。この work）に割った。T8 の点検で実装と突き合わせた
- AC13: pass — `docs/verification.md` の概要・Linux の確かめ方・Windows の項目・「既知の制約」を書いた（T8・cross の点検で実装と突き合わせた）
- AC-I1: pass — 単体（端末の節に置く・閉じ方 3 通りで結果が残る・再読み込みで残る）
- AC-I2: pass — 単体（ラジオは `change` で保存、パスは `input`・Enter 以外のキーでは保存せず、`change`・Enter・閉じたときに確定。IME の変換確定の Enter では保存しない）。
  閉じたときの振る舞いは T7 の 2 ラウンド目の点検者が実物の Chromium に載せて確かめた（保存は 1 回だけ）
- AC-I3: pass — E2E 4 本目（Tab でラジオの組 → 矢印 3 回で「指定した場所」→ Tab で入力欄 → 打って Enter → Esc → 新しい tab がそこで開く）
- AC-I4: pass — E2E 4 本目（閉じた後に打った印が元の pane に届く）、既存の `settings.spec.ts`・単体
- AC-I5: pass — E2E 4 本目（ダイアログの間にブラウザが INPUT を 1 つも送っていない。閉じた後の入力が見えることを対照として確かめた）

## 失敗の証跡

このラウンド（test 工程）では失敗が発生していない。

coding の間に、既定が「引き継ぐ」になったことで**既存の完全一致の期待値 5 件が変わることを、直す前に確かめた**（tasks の方針）:

```
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — 分割・フォーカス移動・入れ替え > split: pane.split を送り、応答の pane にフォーカスする（AC-I4）
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — newTab（ダイアログを開く。herdr の prompt_new_tab_name） > confirmNewTab: tab.create を送り、応答の tab/pane へ切り替える
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — newTab（ダイアログを開く。herdr の prompt_new_tab_name） > confirmNewTab: 空欄なら label を送らない（既定の名前は herdr 側の規約。design「ダイアログ」）
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — newWorkspace（名前を尋ねず直接作る。herdr の prompt_new_workspace_name） > workspace.create を直接送り、応答へ切り替える
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — T22 向けの「任意の対象」メソッド（フォーカス中/表示中とは限らない） > splitPane/zoomPane/closePaneById/renamePaneById は指定した paneId を使う（フォーカス中の pane とは無関係）
      Tests  5 failed | 59 passed (64)
```

## 負の対照（条項 `regression-negative-control`）

直した箇所・守りたい規則を壊すと落ちることを、作業ツリーのファイルを退避 → 変異 → テスト → 戻す（`cmp` で一致を確かめる）の順で確かめた。生の出力をそのまま貼る。

### T2（`newCwd.ts`）——読み直しを外す・代わりの 2 段目を外す・別の pid を読む

```
--- 負の対照 T2-a：読み直しを外した（記録だけを使う）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — 引き継ぐ（follow） > 元の pane のいまの場所で開く（記録より、その時点で読み直した値が勝つ）
AssertionError: expected { cwd: '/recorded', fellBack: false } to deeply equal { cwd: '/live', fellBack: false }
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — 引き継ぐ（follow） > 読み直しが上限（既定 200ms）を超えたら、記録された場所で開く
AssertionError: 上限の前には決まらない: expected true to be false // Object.is equality
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — 引き継ぐ（follow） > いまの場所が消えていたら（cd した先が削除された）、1 段目の代わりで開き、知らせない
--- 負の対照 T2-b：代わりの 2 段目を外した（1 段目をそのまま返す）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — 引き継ぐ（follow） > 1 段目の代わりも使えなければ、サーバを起動した場所で開く
AssertionError: expected { cwd: '/gone', fellBack: false } to deeply equal { cwd: '/start', fellBack: false }
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — ホーム・起動した場所・指定した場所 > 1 段目の代わりも使えなければ、サーバを起動した場所で開き、知らせる
AssertionError: expected { cwd: '/gone', fellBack: true } to deeply equal { cwd: '/start', fellBack: true }
      Tests  2 failed | 22 passed (24)
--- 負の対照 T2-c：makeNewCwdDeps で元の pane の pid ではない値を読む
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > makeNewCwdDeps（本番のつなぎ方） > 元の pane の TerminalHost の pid で foreground() を呼び、その cwd を返す
AssertionError: expected "vi.fn()" to be called with arguments: [ 4242 ]
      Tests  1 failed | 23 passed (24)
restored: cmp ok
```

### T2 の点検の指摘を直した後——相対パスの拒否・優先・`isUsableDir`・タイマー・既定のつなぎ・Windows の OSC 7

```
$ # 変異: 相対パスの拒否（isAbsolute）を外す
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 相対パス（work/dir）は、その場所が使えても拒む 5ms
     × 相対パス（~alice/work）は、その場所が使えても拒む 1ms
      Tests  2 failed | 31 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — ホーム・起動した場所・指定した場所 > 相対パス（work/dir）は、その場所が使えても拒む
AssertionError: expected { cwd: 'work/dir', fellBack: false } to deeply equal { cwd: '/fallback', fellBack: true }
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — ホーム・起動した場所・指定した場所 > 相対パス（~alice/work）は、その場所が使えても拒む
AssertionError: expected { cwd: '~alice/work', fellBack: false } to deeply equal { cwd: '/fallback', fellBack: true }
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: 前面の cwd と OSC 7 の優先を入れ替える
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 前面の cwd と OSC 7 の両方があれば、前面の cwd が勝つ（入れ子のシェル・OSC 7 を出さない子。design D2） 7ms
      Tests  1 failed | 32 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > makeNewCwdDeps（本番のつなぎ方） > 前面の cwd と OSC 7 の両方があれば、前面の cwd が勝つ（入れ子のシェル・OSC 7 を出さない子。design D2）
AssertionError: expected '/osc7' to be '/live' // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: OSC 7 を待つ前に読む
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × OSC 7 は前面プロセスを調べた後に読む（調べている間に届いた分を取りこぼさない） 8ms
      Tests  1 failed | 32 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > makeNewCwdDeps（本番のつなぎ方） > OSC 7 は前面プロセスを調べた後に読む（調べている間に届いた分を取りこぼさない）
AssertionError: expected null to be '/osc7-late' // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: isUsableDir を常に true にする
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × ディレクトリなら使える、ファイル・無い場所は使えない 15ms
     × 入れない（実行の権限が無い）ディレクトリは使えない 6ms
     × ディレクトリへのシンボリックリンクは使え、ファイルへのリンクは使えない 10ms
      Tests  3 failed | 30 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > isUsableDir > ディレクトリなら使える、ファイル・無い場所は使えない
AssertionError: expected true to be false // Object.is equality
 FAIL  src/session/newCwd.test.ts > isUsableDir > 入れない（実行の権限が無い）ディレクトリは使えない
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: isUsableDir の isDirectory を外す
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
      Tests  33 passed (33)
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: isUsableDir の access(X_OK) を外す
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 入れない（実行の権限が無い）ディレクトリは使えない 9ms
      Tests  1 failed | 32 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > isUsableDir > 入れない（実行の権限が無い）ディレクトリは使えない
AssertionError: expected true to be false // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: 上限のタイマーを片付けない
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 上限より先に読めたら、上限のタイマーを残さない 7ms
      Tests  1 failed | 32 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > resolveNewCwd — 引き継ぐ（follow） > 上限より先に読めたら、上限のタイマーを残さない
AssertionError: expected 1 to be +0 // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: 既定の isUsableDir を常に true にする
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × ホームと使えるかの判定は、渡さなければ本物を使う 7ms
      Tests  1 failed | 32 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > makeNewCwdDeps（本番のつなぎ方） > ホームと使えるかの判定は、渡さなければ本物を使う
AssertionError: expected [AsyncFunction] to be [AsyncFunction isUsableDir] // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: Windows のドライブ付きパスを直さない
$ pnpm -C packages/server exec vitest run src/terminal/Mirror.test.ts
     × OSC 7 のドライブ付きパスは、サーバが Windows のときだけ Windows の形に直す 10ms
      Tests  1 failed | 11 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — serialize / bottomLines / OSC capture > OSC 7 のドライブ付きパスは、サーバが Windows のときだけ Windows の形に直す
AssertionError: expected '/C:/Users/u/My Work' to be 'C:\Users\u\My Work' // Object.is equality
restored: packages/server/src/terminal/Mirror.ts (cmp ok)

（上の「isDirectory を外す」が通ったので、ファイルに実行の権限を付けて確かめ直した）

$ # 変異: isUsableDir の isDirectory を外す（直した後）
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × ディレクトリなら使える、ファイル・無い場所は使えない 12ms
      Tests  1 failed | 32 passed (33)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/newCwd.test.ts > isUsableDir > ディレクトリなら使える、ファイル・無い場所は使えない
AssertionError: expected true to be false // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)
```

### T3（`SessionService`）——`cwd` の優先を外す・新しい pane の `Pane.cwd` を以前の値にする

```
--- 負の対照 T3-a：cwd の優先を外した（newCwd があれば cwd より先に使う）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > 明示した cwd は newCwd に勝ち、検証も代わりもしない
AssertionError: expected '/home/u' to be '/repo/.wtm/worktrees/feat' // Object.is equality
      Tests  1 failed | 35 passed (36)
--- 負の対照 T3-b：新しい tab の pane の記録を以前の値（ws.cwd）のままにした
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > 引き継ぐ：新しい tab は元の pane のいまの場所で起動し、pane の記録もそこ。workspace の場所は変えない（AC2）
AssertionError: 記録も起動と同じ場所: expected '/home/u/api' to be '/srv/live' // Object.is equality
      Tests  1 failed | 35 passed (36)
restored: cmp ok
```

### T3 の点検の指摘を直した後——新しい workspace の `cwdFallback`・代わり・`newCwd` の無い要求・分割元の確かめ直し

```
$ # 変異: 新しい workspace の応答から cwdFallback を外す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 指定した場所が使えなければ以前と同じ場所で起動し、cwdFallback を返す（AC9） 31ms
      Tests  1 failed | 36 passed (37)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > 指定した場所が使えなければ以前と同じ場所で起動し、cwdFallback を返す（AC9）
AssertionError: expected undefined to be true // Object.is equality
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 新しい workspace の 1 段目の代わりをすり替える
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 指定した場所が使えなければ以前と同じ場所で起動し、cwdFallback を返す（AC9） 35ms
     × newCwdDeps があっても、要求に newCwd が無ければ今までどおり 24ms
     × newCwdDeps が無ければ newCwd を見ない（今までどおり） 6ms
      Tests  3 failed | 34 passed (37)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > 指定した場所が使えなければ以前と同じ場所で起動し、cwdFallback を返す（AC9）
AssertionError: workspace はサーバを起動した場所: expected '/home/u/api' to be '/start' // Object.is equality
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > newCwdDeps があっても、要求に newCwd が無ければ今までどおり
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: newCwd の無い要求でも resolveNewCwd を呼ぶ
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × newCwdDeps があっても、要求に newCwd が無ければ今までどおり 15ms
      Tests  1 failed | 36 passed (37)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > newCwdDeps があっても、要求に newCwd が無ければ今までどおり
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 場所を決めた後の分割元の確かめ直しを外す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 方針を決める間に分割元が閉じられたら、分割のシェルを起動せずに失敗する 20ms
      Tests  1 failed | 36 passed (37)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 新しく開く場所（newCwd） > 方針を決める間に分割元が閉じられたら、分割のシェルを起動せずに失敗する
AssertionError: 起動したのは D24 の代わりの workspace だけ: expected 3 to be 2 // Object.is equality
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

### T4（入口）——3 つの入口から `newCwd` の受け渡しを外す

```
$ # 変異: packages/server/src/surface/methods/workspace.ts から newCwd の受け渡しを外す
$ pnpm -C packages/server exec vitest run src/surface/methods/index.test.ts
     × 3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す 113ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — 新しく開く場所（newCwd） > 3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す
AssertionError: expected '/home/u' to be '/home/me' // Object.is equality
Expected: "/home/me"
Received: "/home/u"
      Tests  1 failed | 9 passed (10)
restored: packages/server/src/surface/methods/workspace.ts (cmp ok)

$ # 変異: packages/server/src/surface/methods/tab.ts から newCwd の受け渡しを外す
$ pnpm -C packages/server exec vitest run src/surface/methods/index.test.ts
     × 3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す 98ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — 新しく開く場所（newCwd） > 3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す
AssertionError: expected '/home/me' to be '/srv/start' // Object.is equality
Expected: "/srv/start"
Received: "/home/me"
      Tests  1 failed | 9 passed (10)
restored: packages/server/src/surface/methods/tab.ts (cmp ok)

$ # 変異: packages/server/src/surface/methods/pane.ts から newCwd の受け渡しを外す
$ pnpm -C packages/server exec vitest run src/surface/methods/index.test.ts
     × 3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す 139ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — 新しく開く場所（newCwd） > 3 つの入口が newCwd の場所で開き、使えない場所なら cwdFallback を返す
AssertionError: expected { pane: { id: 'p3', …(12) } } to match object { pane: { cwd: '/home/me' }, …(1) }
- Expected
+ Received
      Tests  1 failed | 9 passed (10)
restored: packages/server/src/surface/methods/pane.ts (cmp ok)
```

### T4 の点検の指摘を直した後——`composeServer` の結線（結合テスト）

```
$ # 変異: makeNewCwdDeps に別の inspector を渡す（前面の cwd を読まない）
$ pnpm -C packages/server exec vitest run src/composeServer.integration.test.ts -t 引き継ぐ
     × 「引き継ぐ」は元の pane の前面プロセスの cwd を読み直して開く（記録された場所ではなく） 663ms
      Tests  1 failed | 16 skipped (17)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/tmp/wtm-newcwd-R5uDkR' to be '/tmp/wtm-newcwd-R5uDkR/sub' // Object.is equality
restored: packages/server/src/composeServer.ts (cmp ok)

$ # 変異: makeNewCwdDeps に端末を引けない terminals を渡す
$ pnpm -C packages/server exec vitest run src/composeServer.integration.test.ts -t 引き継ぐ
     × 「引き継ぐ」は元の pane の前面プロセスの cwd を読み直して開く（記録された場所ではなく） 698ms
      Tests  1 failed | 16 skipped (17)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/tmp/wtm-newcwd-f2YwDi' to be '/tmp/wtm-newcwd-f2YwDi/sub' // Object.is equality
restored: packages/server/src/composeServer.ts (cmp ok)

$ # 変異: getPane が pane を返さない
$ pnpm -C packages/server exec vitest run src/composeServer.integration.test.ts -t 引き継ぐ
     × 「引き継ぐ」は元の pane の前面プロセスの cwd を読み直して開く（記録された場所ではなく） 731ms
      Tests  1 failed | 16 skipped (17)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/workspaces/web-tn-multiplexer/packag…' to be '/tmp/wtm-newcwd-cDKtXm/sub' // Object.is equality
restored: packages/server/src/composeServer.ts (cmp ok)

$ # 変異: newCwdDeps を渡さない
$ pnpm -C packages/server exec vitest run src/composeServer.integration.test.ts -t 引き継ぐ
     × 「引き継ぐ」は元の pane の前面プロセスの cwd を読み直して開く（記録された場所ではなく） 699ms
      Tests  1 failed | 16 skipped (17)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/workspaces/web-tn-multiplexer/packag…' to be '/tmp/wtm-newcwd-iLwXC9/sub' // Object.is equality
restored: packages/server/src/composeServer.ts (cmp ok)
```

### T6（`ActionDispatcher`）——worktree に newCwd・元の pane を載せない・別の workspace の pane を載せる・知らせない・設定を読まない

```
$ # 変異: worktree を開く経路に newCwd を付ける
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × confirmWorktreeCreate：作ってから、その場所を cwd に workspace を開く（AC3） 13ms
     × confirmWorktreeOpen：まだ開いていない場所なら workspace.create を送る（AC5） 3ms
     × confirmWorktreeOpen：branch が null（detached）ならパスの末尾を label にする 2ms
     × worktree を開く経路は、方針に関わらず cwd だけを送る（AC11） 3ms
      Tests  4 failed | 66 passed (70)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { cwd: '/root/wtm/feature-x', …(2) } to deeply equal { cwd: '/root/wtm/feature-x', …(1) }
AssertionError: expected [ 'workspace.create', …(1) ] to deeply equal [ 'workspace.create', …(1) ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 新しい workspace に元の pane を載せない
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 引き継ぐ：新しい workspace はこのブラウザの焦点の pane を元の pane として載せる（AC1） 19ms
      Tests  1 failed | 69 passed (70)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'workspace.create', …(1) ] ] to deeply equal [ [ 'workspace.create', …(1) ] ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 新しい tab に元の pane を載せない
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 引き継ぐ：新しい tab は、焦点の pane が作る先の workspace にあるときだけ元の pane を載せる（AC2・design D7） 13ms
      Tests  1 failed | 69 passed (70)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'tab.create', …(1) ], …(1) ] to deeply equal [ [ 'tab.create', …(1) ], …(1) ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 新しい tab で、焦点の pane が別の workspace にあっても載せる
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 引き継ぐ：新しい tab は、焦点の pane が作る先の workspace にあるときだけ元の pane を載せる（AC2・design D7） 12ms
      Tests  1 failed | 69 passed (70)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'tab.create', …(1) ], …(1) ] to deeply equal [ [ 'tab.create', …(1) ], …(1) ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: cwdFallback を知らせない
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 応答に cwdFallback があれば知らせ、無ければ知らせない（AC9・AC5） 13ms
      Tests  1 failed | 69 passed (70)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 3 つの作成それぞれで知らせる: expected [] to have a length of 3 but got +0
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 設定を読まず常に「引き継ぐ」を送る
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 方針を変えると、次に作る workspace・tab・分割から効き、既に開いている pane には何も送らない（AC6〜AC8・AC10） 13ms
      Tests  1 failed | 69 passed (70)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ { policy: 'follow', …(1) }, …(2) ] to deeply equal [ { policy: 'home' }, …(2) ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)
```

### T6 の点検の指摘を直した後——元の pane をダイアログを閉じる前に読む

```
$ # 変異: 新しい tab の元の pane を、ダイアログを閉じる前に読む
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 引き継ぐ：ダイアログの間に焦点の pane が閉じられたら、戻った先の pane を元の pane にする（design D7） 32ms
      Tests  1 failed | 70 passed (71)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'tab.create', …(1) ] ] to deeply equal [ [ 'tab.create', …(1) ] ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)
```

### T7（設定ダイアログ）——input で保存・Enter で保存しない・戻さない・常に使える・方針を保存しない

```
$ # 変異: パスを打っている途中（input）で保存する
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × パスは打っている途中（input）では保存せず、入れ終えたとき（change）に保存する 14ms
     × 打ちかけのまま閉じて開き直すと、入力欄は保存した値に戻る 9ms
      Tests  2 failed | 38 passed (40)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 打っている途中: expected '~/wo' to be '' // Object.is equality
AssertionError: expected '~/half' to be '~/saved' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: Enter で保存しない
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × Enter でも保存する 17ms
      Tests  1 failed | 39 passed (40)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '' to be '/srv/app' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 開き直しても入力欄を保存値へ戻さない
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 打ちかけのまま閉じて開き直すと、入力欄は保存した値に戻る 23ms
      Tests  1 failed | 39 passed (40)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '~/half' to be '~/saved' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 入力欄をいつも使えるようにする
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × パスの入力欄は「指定した場所」を選んでいる間だけ使える 17ms
      Tests  1 failed | 39 passed (40)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected false to be true // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 方針を選んでも保存しない
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 方針は選んだ時点で保存され、その行が選ばれる（確定ボタンは無い） 15ms
     × パスの入力欄は「指定した場所」を選んでいる間だけ使える 7ms
     × 閉じても選んだ方針と入れたパスは残る（AC-I1） 5ms
      Tests  3 failed | 37 passed (40)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 'follow' to be 'home' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)
```

### T7 の点検の指摘を直した後——閉じたときの確定・IME・同じ値・Enter 以外のキー・下書き

```
$ # 変異: 閉じるときに確定しない
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 打ちかけのまま閉じても（Esc）、入れた値は保存される（AC-I1） 8ms
     × 打ちかけのまま閉じても（閉じる）、入れた値は保存される（AC-I1） 15ms
     × 打ちかけのまま閉じても（背景）、入れた値は保存される（AC-I1） 3ms
      Tests  3 failed | 44 passed (47)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '~/saved' to be '~/typed' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

（「閉じるときに方針を見ずに確定する」は通った——方針が「指定した場所」以外では入力欄が使えず、下書きは開くたびに保存値へ戻るので、
条件そのものが要らなかった。条件と、それを見るつもりだったテストを外した）

$ # 変異: IME の変換確定の Enter でも保存する
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × Enter でも保存する。ただし IME の変換を確定する Enter では保存しない 11ms
      Tests  1 failed | 46 passed (47)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 変換の確定では保存しない: expected '~/ドキュメント' to be '' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 同じ値でも保存し直す
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 同じ値なら保存し直さない 15ms
      Tests  1 failed | 46 passed (47)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ '~/same', '~/same' ] to deeply equal []
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: Enter 以外のキーでも保存する
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × パスは打っている途中（input・Enter 以外のキー）では保存せず、入れ終えたとき（change）に保存する 13ms
      Tests  1 failed | 46 passed (47)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 打っている途中: expected '~/wo' to be '' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 開くたびに下書きを保存値へ戻さない
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 開き直すと、入力欄は保存した値から始まる 20ms
      Tests  1 failed | 46 passed (47)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '~/one' to be '~/changed-elsewhere' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 下書きではなく保存値へ一方向に結ぶ
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 開いている間に描き直されても、打ちかけの文字は消えない 12ms
      Tests  1 failed | 46 passed (47)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '~/saved' to be '~/half' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)

$ # 変異: 閉じるときに確定しない（条件を外した後）
$ pnpm -C packages/web exec vitest run src/components/SettingsDialog.test.ts
     × 打ちかけのまま閉じても（Esc）、入れた値は保存される（AC-I1） 8ms
     × 打ちかけのまま閉じても（閉じる）、入れた値は保存される（AC-I1） 16ms
     × 打ちかけのまま閉じても（背景）、入れた値は保存される（AC-I1） 3ms
      Tests  3 failed | 43 passed (46)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '~/saved' to be '~/typed' // Object.is equality
restored: packages/web/src/components/SettingsDialog.vue (cmp ok)
```

### cross の点検の指摘を直した後——上限と OSC 7（decisions D9）

```
$ # 変異: 上限を超えたら OSC 7 を見ない（以前の形）
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 読み直しが上限を超えても、OSC 7 があればその場所で開く 21ms
     × 前面の cwd が無い・reject したときは OSC 7、それも無ければ記録された場所 6ms
     × OSC 7 は前面プロセスを調べた後に読む（調べている間に届いた分を取りこぼさない） 2ms
      Tests  3 failed | 32 passed (35)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { cwd: '/recorded', fellBack: false } to deeply equal { cwd: '/osc7', fellBack: false }
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: OSC 7 を前面の cwd より先に使う
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 前面の cwd と OSC 7 の両方があれば、前面の cwd が勝つ（入れ子のシェル・OSC 7 を出さない子。design D2） 13ms
      Tests  1 failed | 34 passed (35)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/osc7' to be '/live' // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: OSC 7 を待つ前に読む
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × OSC 7 は前面プロセスを調べた後に読む（調べている間に届いた分を取りこぼさない） 15ms
      Tests  1 failed | 34 passed (35)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/recorded' to be '/osc7' // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)

$ # 変異: 本番のつなぎで OSC 7 を読まない
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 前面の cwd と OSC 7 は別々に返す（どちらを使うかは resolveNewCwd が決める） 9ms
      Tests  1 failed | 34 passed (35)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected null to be '/osc7' // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)
```

### T9（E2E）——web が方針を読まず、いつも `{ policy: "current" }` を送るビルド

```
$ # 変異: web が方針を読まず、いつも { policy: "current" } を送る（ActionDispatcher.newCwdFor）
$ pnpm --filter @wtm/e2e exec playwright test src/specs/new-terminal-cwd.spec.ts
  ✘  1 src/specs/new-terminal-cwd.spec.ts:98:1 › 引き継ぐ（何も設定していない利用者の既定）：cd した先で新しい tab・分割・workspace が開く（AC1〜AC4） (15.4s)
  ✘  2 src/specs/new-terminal-cwd.spec.ts:121:1 › ホーム・サーバを起動した場所・指定した場所を選ぶと、そこで開く（AC6〜AC8） (15.5s)
  ✘  3 src/specs/new-terminal-cwd.spec.ts:150:1 › 指定した場所が使えなければ、知らせて以前と同じ場所で開く（AC9） (8.9s)
  ✘  4 src/specs/new-terminal-cwd.spec.ts:161:1 › キーだけで「指定した場所」を選んでパスを入れ、閉じると、新しい tab がそこで開く（AC-I3・AC-I5） (14.7s)
    Error: 新しい tab は cd した先で開く
    Expected substring: "pwd=/tmp/wtm-e2e-cwd-a-HyfBtY·
    printf 'pwd=%s\\n' \"$(pwd)\"·
    ;sr024680@OSK2-024680-2: /workspaces/web-tn-multiplexer/packages/e2esr024680@OSK2-024680-2:/workspaces/web-tn-multiplexer/packages/e2e$ printf 'pwd=%s\\n' \"$(pwd)\"·
    
    pwd=/workspaces/web-tn-multiplexer/packages/e2e·
      87 |   await typeLine(o.page, `printf 'pwd=%s\\n' "$(pwd)"`);
    > 88 |   await expect.poll(() => seen(o, paneId), { message, timeout: 10_000 }).toContain(`pwd=${expected}\r\n`);
    Error: ホームで開く
    Expected substring: "pwd=/home/sr024680·
    printf 'pwd=%s\\n' \"$(pwd)\"·
    ;sr024680@OSK2-024680-2: /workspaces/web-tn-multiplexer/packages/e2esr024680@OSK2-024680-2:/workspaces/web-tn-multiplexer/packages/e2e$ printf 'pwd=%s\\n' \"$(pwd)\"·
    
    pwd=/workspaces/web-tn-multiplexer/packages/e2e·
      87 |   await typeLine(o.page, `printf 'pwd=%s\\n' "$(pwd)"`);
    > 88 |   await expect.poll(() => seen(o, paneId), { message, timeout: 10_000 }).toContain(`pwd=${expected}\r\n`);
    Error: expect(locator).toBeVisible() failed
    Error: element(s) not found
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)
```

## deliver 直前の再実行（review ラウンド 1 の nit を直した後）

review の nit（パスの正規化・`autocorrect`・E2E の `\\n`・コメント・design）を直した後に、全部を回し直した。

- `pnpm test` — **1535 passed** / 0 failed（115 files。正規化のテストが 1 本増えた）
- `pnpm build` の後、**E2E の一式**（利用者の指示どおり deliver の直前に 1 回）: `pnpm --filter @wtm/e2e test` — **92 passed** / 0 failed / 0 flaky（6.0 分）

```
$ # 変異: 指定した場所を正規化しない（review ラウンド 1 の nit の直しの負の対照）
$ pnpm -C packages/server exec vitest run src/session/newCwd.test.ts
     × 指定した場所は正規化する（末尾の / や .. を残さない） 4ms
      Tests  1 failed | 35 passed (36)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/fallback' to be '/home/u' // Object.is equality
restored: packages/server/src/session/newCwd.ts (cmp ok)
```

## 起動確認（smoke）

この work はサブコマンド・オプションを足していない（入口は既存の `workspace.create`・`tab.create`・`pane.split` の params に `newCwd` を足しただけ）ので、
`smokeCommands` は増やさない。

```
$ aidev smoke
smoke: 20260921-new-terminal-cwd
smoke: starting server on 127.0.0.1:46533 (state dir /tmp/wtm-smoke-QP9bfk)
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
smoke: pass (exit 0)
```

## 未検証の穴（skip / 環境不足）

- ~~E2E の一式は未実行~~ → deliver の直前に回した（92 passed。上の「deliver 直前の再実行」）。
- **Windows ネイティブは実機で確かめていない**。OSC 7 の `file://host/C:/…` を `C:\…` に直す変更（decisions D7）と、上限を超えても OSC 7 を読む変更
  （decisions D9）は単体だけ（`platform` を渡す・偽の `foreground()`）。既定の `powershell.exe` は OSC 7 を出さないので、「引き継ぐ」は元の pane を開いた場所になる
  （`docs/verification.md` の Windows の項目で確かめる）。
- **macOS は検証環境が無い**。`/proc` が無いので前面の cwd は読めず、OSC 7 だけに頼る（`docs/verification.md` の「既知の制約」）。zsh が OSC 7 を出すかは
  `wtm serve` の起動のしかたによる（未検証）。
- IME の変換確定の Enter で保存しないことは単体（`isComposing`・`keyCode 229` の合成イベント）だけ。実物の日本語入力では確かめていない。
- 設定ダイアログの新しい欄の見た目（狭い画面・タッチ）は実機で確かめていない（利用者が後で実機確認をまとめて行う）。
