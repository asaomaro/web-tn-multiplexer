# テスト結果: workspace の既定の名前を、開いた場所（リポジトリ）から自動で付ける

## 実行したもの

- `pnpm typecheck`（各パッケージの `tsconfig.typecheck.json`。テストを含む）— exit 0
- `pnpm test`（vitest。protocol・server・web）— **1587 passed** / 0 failed / 0 skipped（117 files。review ラウンド 3 の差し戻しの後に回し直した）
- `pnpm exec eslint <この work で変えた .ts>` — exit 0
- `aidev coverage --strict` — ac=17、design=17/17、tasks=17/17、gaps=0
- `pnpm build` の後、この work の影響を受ける E2E の spec だけ（利用者の指示。一式は deliver の直前に 1 回。decisions D3）:
  `workspace-auto-label.spec.ts`（新規）・`new-terminal-cwd.spec.ts`・`workspace-tab-pane.spec.ts`・`keys-mouse-dialogs.spec.ts`・
  `reconnect-restore.spec.ts`・`mobile.spec.ts`・`notifications.spec.ts` — **50 passed** / 0 failed（4.3 分。3 回の差し戻しの後にそれぞれ回し直して、いずれも 50 passed・3.6〜3.7 分）
- `aidev smoke` — pass（下の「起動確認」）

## 受け入れ基準ごとの判定

- AC1: pass（fs が止まっている・遅い間を除く。decisions D4）— E2E 1 本目（リポジトリのサブディレクトリへ `cd` → `Ctrl+B N` → サイドバーに根の名前）。サーバ単体（`workspaceLabel.test.ts` の偽の fs と本物の
  `git init`、`SessionService.test.ts` の作成・「引き継ぐ」で決めた場所の名前）。git のコマンドを使わないことは実装（`.git` を読むだけ）と、git の無い偽の fs の単体
- AC2: pass（fs が止まっている・遅い間を除く。decisions D4）— サーバ単体（本物の `git worktree add` の worktree のサブディレクトリから `findGitRoot` が worktree の根を返す・名前がそのフォルダ名。偽の fs の `gitdir:`）
- AC3: pass — サーバ単体（git の外のフォルダ名・ホームの `~`・根のパス。Windows の形は `path.win32`）
- AC4: pass（fs が止まっている・遅い間を除く。decisions D4）— E2E 1 本目（起動時の最初の workspace がこのリポジトリの根の名前）。サーバ単体（`ensureNotEmpty`・D24 の作り直し）
- AC5: pass — サーバ単体（付けた名前は復元で決め直さない・git の状態を変えた偽の fs でもそのまま・新しい版で「1」と付けた workspace も付けた名前のまま）
- AC6: pass（fs が止まっている・遅い間を除く。decisions D4）— E2E 2 本目（キーだけで名前を消して確定 → 両方のブラウザで自動の名前）。サーバ単体（null・空白だけで自動に戻す・復元で決め直す）。web 単体
- AC7: pass — サーバ単体（`autoLabel` の無い以前の保存：「1」は自動、それ以外は付けた名前）。`SessionFile.test.ts`（印が有っても無くても読める）
- AC8: pass — E2E 1 本目（サイドバーの spaces 欄・goto の一覧・名前での絞り込み）。agents 欄（`Sidebar.vue:197`）・モバイル（`MobileShell.vue:46`・`PanePicker.vue:93`・`:110`）・
  通知（`describe.ts:40`）・ブラウザのタブの題名（`main.ts:243`）は、どれも同じ `Workspace.label` をそのまま読むことを読解で確かめた（この work はこれらを変えていない）
- AC9: pass — E2E 1 本目（ほかのブラウザが受けた `workspace.created` の `label` が最初から根の名前）。「1」で作ってから直す作りで、この判定だけが落ちることを確かめた（`nc-T9b.txt`）
- AC10: pass — E2E 2 本目（名前を付けた・自動に戻した、がほかのブラウザのサイドバーと受けた `workspace.updated` に出る）
- AC11: pass — `docs/herdr-parity.md` に H01b（herdr との違い 6 つ）を足した。T8 と cross の点検で実装・herdr の実物と突き合わせた
- AC12: pass — `docs/verification.md` の概要・Linux の手順・Windows の手順（T8・cross の点検で実装と突き合わせた）
- AC-I1: pass — 既存の入口のまま（`NameDialog.test.ts`・`ActionDispatcher.test.ts` の既存のテスト）
- AC-I2: pass — web 単体（空 → null、自動の名前のまま変えずに確定 → 送らない、開いた時点の値・両辺 trim・大小を区別、手掛かりは workspace のときだけ）。E2E 2 本目（手掛かりの文）
- AC-I3: pass — E2E 2 本目（`Ctrl+B W` → Backspace → Enter）
- AC-I4: pass — 既存の作法のまま（変えていない）
- AC-I5: pass — 既存の作法のまま（ダイアログ中は window の keydown が何もしない。変えていない）

## 失敗の証跡

このラウンド（test 工程）では失敗が発生していない。

## 負の対照（条項 `regression-negative-control`）

守りたい規則を壊すと落ちることを、作業ツリーのファイルを退避 → 変異 → テスト → 戻す（`cmp` で一致を確かめる）の順で確かめた。E2E は壊した状態でビルドして走らせ、
戻してビルドし直した。生の出力をそのまま貼る。

### T2（`workspaceLabel.ts`）——HEAD を確かめない・gitdir: をたどらない・core.bare を見ない・ホームの ~ を外す

```
$ # 変異: HEAD を確かめない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 中に HEAD の無い .git は根にしない 43ms
      Tests  1 failed | 13 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/r' to be null
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: gitdir: をたどらない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × .git がファイルなら gitdir: をたどる（worktree は絶対、submodule は相対） 54ms
     × git のリポジトリのサブディレクトリ・worktree のサブディレクトリ・git の無いフォルダ 342ms
      Tests  2 failed | 12 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected null to be '/wt' // Object.is equality
AssertionError: worktree はその worktree の根: expected null to be '/tmp/wtm-label-l6CFBY/feat-wt' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: core.bare を見ない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × bare のリポジトリ（core.bare = true）はその場所自身が根。bare = false の形は根にしない 20ms
     × .git の中（hooks）で開いても、主の根を返す 21ms
      Tests  2 failed | 12 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/b' to be null
AssertionError: expected '/r/.git' to be '/r' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: ホームの ~ を外す
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × ホームは ~、そうでなければ末尾の名前、それも無ければパスそのもの 50ms
     × Windows の形：ドライブの根はパスそのもの、ホームは大小を問わず ~ 6ms
     × 根があれば根の名前、無ければフォルダ名の規則 18ms
      Tests  3 failed | 11 passed (14)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 'u' to be '~' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)
```

### T2 の点検の指摘を直した後——上限のタイマー・上限の値・bare の形・根の名前が空・core.bare の大小・resolve・config の見出し

```
$ # 変異: 上限のタイマーを片付けない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 上限より先に決まったら、上限のタイマーを残さない 13ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 1 to be +0 // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: 上限を 100ms にする
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 根を探すのが上限（200ms）を超えたら、フォルダ名の規則にする。上限の前には決まらない 20ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 上限の前には決まらない: expected true to be false // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: bare の形（objects・refs）を確かめない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × bare の形（HEAD・objects・refs）でなければ、core.bare = true でも根にしない 9ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/b' to be null
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: 根の名前が空でも代わりにしない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 根が / のときは、根の名前（空）ではなくフォルダ名の規則 10ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '' to be 'app' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: core.bare を大小を区別して比べる
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × core.bare の値は大小を問わない 7ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected null to be '/b' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: findGitRoot で resolve しない
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 字面に .. を含む場所は畳んでからたどる（根が /r/a/.. のまま返らない） 9ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '/r/a/..' to be '/r' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: 引用符つきの見出しで節を抜ける（以前の形）
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 引用符つき・閉じていない見出しは素通りし、前の節のまま（herdr と同じ） 12ms
      Tests  1 failed | 19 passed (20)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected null to be 'true' // Object.is equality
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)
```

### T3 の点検の指摘を直した後——restoreWorkspace で autoLabel を固定する

```
$ # 変異: restoreWorkspace で autoLabel を true に固定する
$ pnpm -C packages/server exec vitest run src/session/SessionModel.test.ts
     × autoLabel は作成・名前変更・復元で呼ぶ側が決めたとおりに入る 16ms
      Tests  1 failed | 25 passed (26)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 付けた名前として復元: expected true to be false // Object.is equality
restored: packages/server/src/session/SessionModel.ts (cmp ok)
```

### T4（作成）——「1」に戻す・空白だけを付けた名前にする・名前を待つのを起動の後へ移す

```
$ # 変異: 名前を渡さない経路に「1」を戻す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 名前を渡さないと、git の中なら根の名前・外ならフォルダ名・ホームなら ~ で、最初から付いている（AC1・AC3・AC9） 38ms
     × 名前を渡せば付けた名前。空白だけの名前は自動の名前（design D10） 13ms
     × 起動時の最初の workspace と、最後を閉じた後の作り直しも自動の名前（AC4） 6ms
     × 名前を決めている間は起動も知らせもせず、決まってから起動する 21ms
      Tests  4 failed | 37 passed (41)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ '1', '1', '1' ] to deeply equal [ 'r', 'app', '~' ]
AssertionError: expected { id: 'w2', label: '1', …(6) } to match object { label: 'r', autoLabel: true }
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 空白だけの名前を付けた名前にする
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 名前を渡せば付けた名前。空白だけの名前は自動の名前（design D10） 19ms
      Tests  1 failed | 40 passed (41)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { id: 'w2', label: '   ', …(6) } to match object { label: 'r', autoLabel: true }
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 名前を待つのを起動の後（commit の直前）へ移す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 名前を渡せば付けた名前。空白だけの名前は自動の名前（design D10） 27ms
     × 名前を決めている間は起動も知らせもせず、決まってから起動する 24ms
      Tests  2 failed | 39 passed (41)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { id: 'w1', label: 'feat/x', …(6) } to match object { label: 'feat/x', autoLabel: false }
AssertionError: 名前が決まる前にシェルを起動しない: expected [ { cwd: '/r/src', cols: 120, …(1) } ] to deeply equal []
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

### T5（名前変更）——世代を進めない・閉じたかを確かめない（通った——二重の守り）・null を付けた名前にする・入口で await しない

```
$ # 変異: 付けた名前の変更で世代を進めない（null のときだけ進める）
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 自動の名前に戻す待ちの間に名前を付けたら、付けた名前が勝つ 22ms
      Tests  1 failed | 44 passed (45)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { id: 'w1', label: 'r', …(6) } to match object { label: 'later', autoLabel: false }
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 待っている間に閉じられたかを確かめない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
      Tests  45 passed (45)
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: null を付けた名前として扱う（自動に戻さない）
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 付けた名前は autoLabel: false、null と空白だけは開いた場所から決め直した自動の名前に戻る（AC6） 16ms
       × 自動の名前に戻す待ちの間に workspace が閉じられたら、何もしない（投げない） 12ms
      Tests  2 failed | 43 passed (45)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ { label: 'mine', …(1) }, …(3) ] to deeply equal [ { label: 'mine', …(1) }, …(3) ]
AssertionError: expected [ 'workspace.updated' ] to deeply equal []
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 入口で await しない
$ pnpm -C packages/server exec vitest run src/surface/methods/index.test.ts
     × 名前を付け、null で自動の名前に戻し、無い workspace は not_found を返す 13ms
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { id: 'w1', label: 'mine', …(6) } to match object { label: 'app', autoLabel: true }
restored: packages/server/src/surface/methods/workspace.ts (cmp ok)
```

### T4・T5 の点検の指摘を直した後——方針で決める前の cwd から名前を付ける・名前変更の後に保存を予約しない

```
$ # 変異: 自動の名前を方針で決める前の cwd から付ける
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
     × 引き継ぐで開いた新しい workspace の名前は、元の pane のいまの場所の名前。代わりの場所に回ったらその場所の名前 21ms
      Tests  1 failed | 47 passed (48)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { id: 'w2', label: 'start', …(6) } to match object { label: 'api', autoLabel: true }
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 名前変更の後に保存を予約しない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 名前変更は、名前を入れたときに保存を予約する（null で戻すときも） 12ms
       × 自動の名前に戻す待ちの間に名前を付けたら、付けた名前が勝つ（捨てた結果では保存を予約しない） 7ms
      Tests  2 failed | 46 passed (48)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected +0 to be 1 // Object.is equality
AssertionError: 付けた名前の 1 回だけ: expected +0 to be 1 // Object.is equality
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

### T6（保存と復元）——決め直さない・付けた名前も決め直す・以前の版の「1」を付けた名前とみなす・保存で autoLabel を書かない

```
$ # 変異: 復元で自動の名前を決め直さない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 自動の名前は場所から決め直し、付けた名前はそのまま。以前の版の「1」と空白だけの名前は自動（AC5〜AC7） 51ms
      Tests  1 failed | 45 passed (46)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'w1', 'sub', true ], …(4) ] to deeply equal [ [ 'w1', 'r', true ], …(4) ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 付けた名前も決め直す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 自動の名前は場所から決め直し、付けた名前はそのまま。以前の版の「1」と空白だけの名前は自動（AC5〜AC7） 56ms
      Tests  1 failed | 45 passed (46)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'w1', 'r', true ], …(4) ] to deeply equal [ [ 'w1', 'r', true ], …(4) ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 以前の版の「1」を付けた名前とみなす
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 自動の名前は場所から決め直し、付けた名前はそのまま。以前の版の「1」と空白だけの名前は自動（AC5〜AC7） 101ms
      Tests  1 failed | 45 passed (46)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'w1', 'r', true ], …(4) ] to deeply equal [ [ 'w1', 'r', true ], …(4) ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 保存で autoLabel を書かない
$ pnpm -C packages/server exec vitest run src/composeServer.integration.test.ts -t autoLabel
     × 保存した session.json の workspace に、名前が自動か付けたものかの印（autoLabel）が載る 1436ms
      Tests  1 failed | 17 skipped (18)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected undefined to be true // Object.is equality
restored: packages/server/src/composeServer.ts (cmp ok)
```

### T6 の点検の指摘を直した後——印があっても「1」を自動とみなす

```
$ # 変異: 印があっても「1」を自動とみなす（?? を || に）
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 自動の名前は場所から決め直し、付けた名前はそのまま。以前の版の「1」と空白だけの名前は自動（AC5〜AC7） 48ms
      Tests  1 failed | 47 passed (48)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'w1', 'r', true ], …(5) ] to deeply equal [ [ 'w1', 'r', true ], …(5) ]
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

### T7（web）——変えずに確定しても送る・空で何もしない・手掛かりを tab でも出す・開いた時点の autoLabel を入れない

```
$ # 変異: 自動の名前のまま変えずに確定しても送る
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 自動の名前のまま変えずに確定したら送らない（付けた名前として固定しない） 9ms
      Tests  1 failed | 74 passed (75)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'workspace.rename', …(1) ] ] to deeply equal []
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 空で確定したら何もしない（以前の形）
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 空（空白だけ）で確定すると label: null（自動の名前に戻す） 13ms
      Tests  1 failed | 74 passed (75)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [] to deeply equal [ [ 'workspace.rename', …(1) ] ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 手掛かりを tab でも出す
$ pnpm -C packages/web exec vitest run src/components/NameDialog.test.ts
     × workspace のときだけ、空で確定すると自動の名前に戻ることを入力欄に結んで示す。自動の名前ならそれも添える 13ms
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: tab の名前変更には出さない: expected true to be false // Object.is equality
restored: packages/web/src/components/NameDialog.vue (cmp ok)

$ # 変異: 開いた時点の autoLabel を入れない
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 開いた時点で名前が自動だったかを持つ 17ms
     × 自動の名前のまま変えずに確定したら送らない（付けた名前として固定しない） 3ms
      Tests  2 failed | 73 passed (75)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { kind: 'renameWorkspace', …(3) } to match object { kind: 'renameWorkspace', …(2) }
AssertionError: expected [ [ 'workspace.rename', …(1) ] ] to deeply equal []
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)
```

### T7 の点検の指摘を直した後——自動の名前なら空でも送らない・確定の時点の値で判定する・大小を区別しない・手掛かりを tab のときだけ消す

```
$ # 変異: 自動の名前なら空でも送らない
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 自動の名前のときに空で確定しても label: null を送る（手掛かりの約束どおり） 7ms
      Tests  1 failed | 76 passed (77)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [] to deeply equal [ [ 'workspace.rename', …(1) ] ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 確定の時点の session の値で判定する
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 変えたかどうかは開いた時点の名前で比べ、大小は区別する 15ms
      Tests  1 failed | 76 passed (77)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'workspace.rename', …(1) ] ] to deeply equal []
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 大小を区別せずに比べる
$ pnpm -C packages/web exec vitest run src/actions/ActionDispatcher.test.ts
     × 変えたかどうかは開いた時点の名前で比べ、大小は区別する 25ms
      Tests  1 failed | 76 passed (77)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [] to deeply equal [ [ 'workspace.rename', …(1) ] ]
restored: packages/web/src/actions/ActionDispatcher.ts (cmp ok)

$ # 変異: 手掛かりを tab のときだけ消す
$ pnpm -C packages/web exec vitest run src/components/NameDialog.test.ts
     × workspace のときだけ、空で確定すると自動の名前に戻ることを入力欄に結んで示す。自動の名前ならそれも添える 13ms
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: renamePane には出さない: expected true to be false // Object.is equality
restored: packages/web/src/components/NameDialog.vue (cmp ok)
```

### T9（E2E）——サーバが「1」を付け、web が空の確定で何も送らない（以前の形）ビルド

```
$ # 変異: サーバが名前を渡さない作成に「1」を付ける（以前の形）＋ web が空の確定で何も送らない（以前の形）
$ pnpm --filter @wtm/e2e exec playwright test src/specs/workspace-auto-label.spec.ts
  ✘  1 src/specs/workspace-auto-label.spec.ts:72:1 › 既定の workspace と、リポジトリのサブディレクトリで開いた workspace が、どのブラウザにも最初から根の名前で出る（AC1・AC4・AC8・AC9） (7.4s)
  ✘  2 src/specs/workspace-auto-label.spec.ts:122:1 › 名前を付けるとほかのブラウザにも出て、キーだけで名前を消して確定すると自動の名前に戻る（AC6・AC10・AC-I2・AC-I3） (7.5s)
    Error: expect(locator).toHaveText(expected) failed
    - Expected  - 1
    + Received  + 1
    Error: expect(locator).toContainText(expected) failed
    Expected substring: "いまは自動の名前です"
    Received string:    "空にして確定すると、自動の名前（リポジトリ名かフォルダ名）に戻ります。"
  2 failed
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 1: playwright test src/specs/workspace-auto-label.spec.ts
restored: packages/server/src/session/SessionService.ts, packages/web/src/actions/ActionDispatcher.ts (cmp ok)
```

### T9 の点検の指摘を直した後——「1」で作ってから後で自動の名前に直すビルド（受けた workspace.created の判定だけが落ちる）

```
$ # 変異: 名前を渡さない作成を「1」で作ってから、後で workspace.updated で自動の名前に直す（サイドバーの見た目は同じになる）
$ pnpm --filter @wtm/e2e exec playwright test src/specs/workspace-auto-label.spec.ts -g "既定の workspace"
  ✘  1 src/specs/workspace-auto-label.spec.ts:86:1 › 既定の workspace と、リポジトリのサブディレクトリで開いた workspace が、どのブラウザにも最初から根の名前で出る（AC1・AC4・AC8・AC9） (4.5s)
  1) src/specs/workspace-auto-label.spec.ts:86:1 › 既定の workspace と、リポジトリのサブディレクトリで開いた workspace が、どのブラウザにも最初から根の名前で出る（AC1・AC4・AC8・AC9） 
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  -  3
    + Received  + 11
    -     "label": "label-repo",
    +     "cwd": "/tmp/wtm-e2e-label-BO7YnS/label-repo/pkg/deep",
    +     "label": "1",
      114 |     expect.objectContaining({ label: name, autoLabel: true }),
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/workspace-auto-label.spec.ts:113:91
    Error Context: test-results/workspace-auto-label-既定の-w-0e0e1-初から根の名前で出る（AC1・AC4・AC8・AC9）/error-context.md
    test-results/workspace-auto-label-既定の-w-0e0e1-初から根の名前で出る（AC1・AC4・AC8・AC9）/trace.zip
        pnpm exec playwright show-trace test-results/workspace-auto-label-既定の-w-0e0e1-初から根の名前で出る（AC1・AC4・AC8・AC9）/trace.zip
  1 failed
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

### review ラウンド 1 の差し戻しの後——上限の後に問い合わせを止める・冷却・復元を 1 つずつ

```
$ # 変異: 上限の後も fs に問い合わせる（signal を見ない）
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts src/session/SessionService.test.ts
      Tests  71 passed (71)
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: 上限を超えても冷却しない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × しばらくは fs に問い合わせずフォルダ名にし、冷却が過ぎたらまた根を探す 47ms
       × 復元では 1 つずつ決め、1 つが上限を超えたら残りは問い合わせずフォルダ名にする 84ms
      Tests  2 failed | 48 passed (50)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 'r' to be 'src' // Object.is equality
AssertionError: 止まった 1 つ（w1 の最初の stat）の後は問い合わせない: expected [ '/r/a', '/r/b', '/r/c' ] to deeply equal [ '/r/a' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 復元で名前を並べて決める
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 復元では 1 つずつ決め、1 つが上限を超えたら残りは問い合わせずフォルダ名にする 60ms
      Tests  1 failed | 49 passed (50)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 止まった 1 つ（w1 の最初の stat）の後は問い合わせない: expected [ '/r/a', '/r/b', '/r/c' ] to deeply equal [ '/r/a' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 冷却が明けない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × しばらくは fs に問い合わせずフォルダ名にし、冷却が過ぎたらまた根を探す 48ms
      Tests  1 failed | 49 passed (50)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 冷却が過ぎたらまた根を探す: expected 'src' to be 'r' // Object.is equality
restored: packages/server/src/session/SessionService.ts (cmp ok)

（上の「上限の後も fs に問い合わせる」が通ったので、止まった stat を「上限より遅れて返る」形に替えて確かめ直した）

$ # 変異: 上限の後も fs に問い合わせる（signal を見ない。テストを直した後）
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 上限を超えたら、それ以上 fs に問い合わせず、onTimeout を 1 度呼ぶ 6ms
      Tests  1 failed | 20 passed (21)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 止まった 1 つの後は問い合わせない: expected [ '/r/a/b', '/r/a/b/.git', …(9) ] to deeply equal [ '/r/a/b' ]
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)
```

### review ラウンド 2 の差し戻しの後——「止まった問い合わせをどう扱うか」を支える項目 1〜5

```
「止まった問い合わせをどう扱うか」を支える項目（1〜5）を 1 つずつ壊した（review ラウンド 2 の差し戻しの後）。

$ # 変異: 1. 上限の後もたどりが fs に問い合わせる（signal を見ない）
$ pnpm -C packages/server exec vitest run src/session/workspaceLabel.test.ts
     × 上限を超えたら、それ以上 fs に問い合わせず、onTimeout を 1 度呼ぶ 8ms
      Tests  1 failed | 20 passed (21)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 止まった 1 つの後は問い合わせない: expected [ '/r/a/b', '/r/a/b/.git', …(9) ] to deeply equal [ '/r/a/b' ]
restored: packages/server/src/session/workspaceLabel.ts (cmp ok)

$ # 変異: 2a. 止まった問い合わせが返っても元に戻さない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 上限を超えた問い合わせが返るまでは fs に問い合わせずフォルダ名にし、返ったらまた根を探す 57ms
      Tests  1 failed | 50 passed (51)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 返ったらまた根を探す: expected 'src' to be 'r' // Object.is equality
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 2b. 止まっている間も根を探す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 上限を超えた問い合わせが返るまでは fs に問い合わせずフォルダ名にし、返ったらまた根を探す 64ms
       × 復元では 1 つずつ決め、1 つが上限を超えたら残りは問い合わせずフォルダ名にする 81ms
      Tests  2 failed | 49 passed (51)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 止まった問い合わせが返るまでは問い合わせない: expected 2 to be 1 // Object.is equality
AssertionError: 止まった 1 つ（w1 の最初の stat）の後は問い合わせない: expected [ '/r/a', '/r/b', '/r/c' ] to deeply equal [ '/r/a' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 2c. 返るのを待たずにすぐ元に戻す
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 上限を超えた問い合わせが返るまでは fs に問い合わせずフォルダ名にし、返ったらまた根を探す 61ms
       × 復元では 1 つずつ決め、1 つが上限を超えたら残りは問い合わせずフォルダ名にする 81ms
      Tests  2 failed | 49 passed (51)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 止まった問い合わせが返るまでは問い合わせない: expected 2 to be 1 // Object.is equality
AssertionError: 止まった 1 つ（w1 の最初の stat）の後は問い合わせない: expected [ '/r/a', '/r/b', '/r/c' ] to deeply equal [ '/r/a' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 3a. 復元に合計の期限を設けない
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする 34ms
      Tests  1 failed | 50 passed (51)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: w1 は根を探して r、期限を過ぎた w2・w3 はフォルダ名: expected [ 'r', 'r', 'r' ] to deeply equal [ 'r', 'b', 'c' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 3b. 期限を差し替えられない壁時計で測る
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする 24ms
      Tests  1 failed | 50 passed (51)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: w1 は根を探して r、期限を過ぎた w2・w3 はフォルダ名: expected [ 'r', 'r', 'r' ] to deeply equal [ 'r', 'b', 'c' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 4. onTimeout を守らずに resolve より先に呼ぶ
$ pnpm -C packages/server exec vitest run src/session/withTimeout.test.ts
     × onTimeout が投げても、待っている側は null で戻る 6ms
      Tests  1 failed | 2 passed (3)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
restored: packages/server/src/session/withTimeout.ts (cmp ok)

$ # 変異: 5. 止まっている間に付けたフォルダ名を付けた名前にする
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 上限を超えた問い合わせが返るまでは fs に問い合わせずフォルダ名にし、返ったらまた根を探す 42ms
      Tests  1 failed | 50 passed (51)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { id: 'w2', label: 'src', …(6) } to match object { label: 'src', autoLabel: true }
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

ラウンド 1 の直し（60 秒の冷却）の負の対照（上の `nc-R1.txt` の「冷却しない」「冷却が明けない」）は、ラウンド 2 で冷却を「返るまで」に替えたので、2a〜2c が置き換える。

### review ラウンド 3 の差し戻しの後（修正は新しい実装のコンテキストに委ねた）——数を戻す順序・復元の期限のログ

```
$ # 変異: onTimeout で数を戻す処理を logger.warn の後に付ける（直す前の順序）
$ git diff --no-index --unified=1 /tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak packages/server/src/session/SessionService.ts
diff --git a/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak b/packages/server/src/session/SessionService.ts
index 980622d..a130591 100644
--- a/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak
+++ b/packages/server/src/session/SessionService.ts
@@ -123,3 +123,3 @@ export class SessionService {
         this.labelLookupsStuck++;
-        // 数を戻す処理はログより先に付ける——warn が投げても数が戻る（review ラウンド 3）。
+        this.logger.warn("workspace label lookup timed out; using folder names until it returns", { stuck: this.labelLookupsStuck });
         void settled.then(() => {
@@ -127,3 +127,2 @@ export class SessionService {
         });
-        this.logger.warn("workspace label lookup timed out; using folder names until it returns", { stuck: this.labelLookupsStuck });
         labelDeps.onTimeout?.(settled);
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts -t "上限を超えたときのログが投げても"

 RUN  v5.0.1 /workspaces/web-tn-multiplexer/packages/server

 ❯ src/session/SessionService.test.ts (52 tests | 1 failed | 51 skipped) 57ms
   ❯ SessionService — workspace の自動の名前 (14)
     ❯ 名前を決める処理が上限を超えた後 (4)
       × 上限を超えたときのログが投げても、問い合わせが返ったらまた根を探す 55ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/session/SessionService.test.ts > SessionService — workspace の自動の名前 > 名前を決める処理が上限を超えた後 > 上限を超えたときのログが投げても、問い合わせが返ったらまた根を探す
AssertionError: warn が投げても数が戻り、また根を探す: expected 'src' to be 'r' // Object.is equality

Expected: "r"
Received: "src"

 ❯ src/session/SessionService.test.ts:1022:63
    1020|       await new Promise((r) => setTimeout(r, 10));
    1021|       const second = await service.createWorkspace("/r/src", undefined…
    1022|       expect(second.workspace.label, "warn が投げても数が戻り、また根を探す").toBe("r"…
       |                                                               ^
    1023|     });
    1024|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 51 skipped (52)
   Start at  18:13:40
   Duration  437ms (transform 60%, import 22%, tests 17%, worker 1%)

(exit=1)
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: restore の期限を過ぎたときの logger.warn を消す
$ git diff --no-index --unified=1 /tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak packages/server/src/session/SessionService.ts
diff --git a/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak b/packages/server/src/session/SessionService.ts
index 980622d..4735412 100644
--- a/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak
+++ b/packages/server/src/session/SessionService.ts
@@ -568,6 +568,3 @@ export class SessionService {
           warnedOverBudget = true;
-          this.logger.warn("workspace label lookup over restore budget; using folder names for the rest", {
-            budgetMs: RESTORE_LABEL_BUDGET_MS,
-            remaining: data.workspaces.length - i,
-          });
+
         }
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts -t "復元は合計の期限を過ぎたら"

 RUN  v5.0.1 /workspaces/web-tn-multiplexer/packages/server

 ❯ src/session/SessionService.test.ts (52 tests | 1 failed | 51 skipped) 35ms
   ❯ SessionService — workspace の自動の名前 (14)
     ❯ 名前を決める処理が上限を超えた後 (4)
       × 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ） 33ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/session/SessionService.test.ts > SessionService — workspace の自動の名前 > 名前を決める処理が上限を超えた後 > 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ）
AssertionError: 期限を過ぎたら警告を 1 度だけ（w2・w3 の 2 つとも過ぎているが 1 度）: expected [] to deeply equal [ { level: 'warn', …(2) } ]

- Expected
+ Received

- [
-   {
-     "fields": {
-       "budgetMs": 1000,
-       "remaining": 2,
-     },
-     "level": "warn",
-     "msg": "workspace label lookup over restore budget; using folder names for the rest",
-   },
- ]
+ []

 ❯ src/session/SessionService.test.ts:1070:71
    1068|       expect(calls.every((p) => p.startsWith("/r/a") || p === "/r/.git…
    1069|       const overBudget = logger.lines.filter((l) => l.level === "warn"…
    1070|       expect(overBudget, "期限を過ぎたら警告を 1 度だけ（w2・w3 の 2 つとも過ぎているが 1 度）").…
       |                                                                       ^
    1071|         { level: "warn", msg: "workspace label lookup over restore bud…
    1072|       ]);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 51 skipped (52)
   Start at  18:13:41
   Duration  437ms (transform 65%, import 23%, tests 11%, worker 1%)

(exit=1)
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: restore の期限の warn の 1 度だけの守り（warnedOverBudget）を外す
$ git diff --no-index --unified=1 /tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak packages/server/src/session/SessionService.ts
diff --git a/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak b/packages/server/src/session/SessionService.ts
index 980622d..cb312e7 100644
--- a/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/fix-r3/SessionService.ts.bak
+++ b/packages/server/src/session/SessionService.ts
@@ -566,3 +566,3 @@ export class SessionService {
         if (this.clock.now() < deadline) return false;
-        if (!warnedOverBudget) {
+        {
           warnedOverBudget = true;
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts -t "復元は合計の期限を過ぎたら"

 RUN  v5.0.1 /workspaces/web-tn-multiplexer/packages/server

 ❯ src/session/SessionService.test.ts (52 tests | 1 failed | 51 skipped) 44ms
   ❯ SessionService — workspace の自動の名前 (14)
     ❯ 名前を決める処理が上限を超えた後 (4)
       × 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ） 40ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/session/SessionService.test.ts > SessionService — workspace の自動の名前 > 名前を決める処理が上限を超えた後 > 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ）
AssertionError: 期限を過ぎたら警告を 1 度だけ（w2・w3 の 2 つとも過ぎているが 1 度）: expected [ { level: 'warn', …(2) }, …(1) ] to deeply equal [ { level: 'warn', …(2) } ]

- Expected
+ Received

@@ -5,6 +5,14 @@
        "remaining": 2,
      },
      "level": "warn",
      "msg": "workspace label lookup over restore budget; using folder names for the rest",
    },
+   {
+     "fields": {
+       "budgetMs": 1000,
+       "remaining": 1,
+     },
+     "level": "warn",
+     "msg": "workspace label lookup over restore budget; using folder names for the rest",
+   },
  ]

 ❯ src/session/SessionService.test.ts:1070:71
    1068|       expect(calls.every((p) => p.startsWith("/r/a") || p === "/r/.git…
    1069|       const overBudget = logger.lines.filter((l) => l.level === "warn"…
    1070|       expect(overBudget, "期限を過ぎたら警告を 1 度だけ（w2・w3 の 2 つとも過ぎているが 1 度）").…
       |                                                                       ^
    1071|         { level: "warn", msg: "workspace label lookup over restore bud…
    1072|       ]);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 51 skipped (52)
   Start at  18:13:42
   Duration  640ms (transform 64%, import 26%, tests 9%, worker 1%)

(exit=1)
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

### review ラウンド 4 の nit を直した後——期限と付けた名前の順・警告の数

```
$ # 変異: 期限を付けた名前より先に見る（順を入れ替える）
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ） 40ms
      Tests  1 failed | 51 passed (52)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: w1 は根を探して r、期限を過ぎた w2・w4 はフォルダ名、w3 は付けた名前: expected [ 'r', 'b', 'c', 'd' ] to deeply equal [ 'r', 'b', 'mine', 'd' ]
restored: packages/server/src/session/SessionService.ts (cmp ok)

$ # 変異: 残りの数に付けた名前も数える
$ pnpm -C packages/server exec vitest run src/session/SessionService.test.ts
       × 復元は合計の期限を過ぎたら、残りを問い合わせずフォルダ名にする（警告は 1 度だけ） 34ms
      Tests  1 failed | 51 passed (52)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 期限を過ぎたら警告を 1 度だけ（w2・w3 の 2 つとも過ぎているが 1 度）: expected [ { level: 'warn', …(2) } ] to deeply equal [ { level: 'warn', …(2) } ]
restored: packages/server/src/session/SessionService.ts (cmp ok)
```

## 起動確認（smoke）

この work はサブコマンド・オプションを足していない（`workspace.rename` の `label` に null を足しただけ）ので、`smokeCommands` は増やさない。
smoke は名前を渡して workspace を作る（`packages/server/src/smoke.ts:203` の `label: "smoke"`）ので、付けた名前のまま題名の判定も変わらない。

```
$ aidev smoke
smoke: 20260921-workspace-auto-label
smoke: starting server on 127.0.0.1:45007 (state dir /tmp/wtm-smoke-7PWTFg)
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

- ~~E2E の一式は未実行~~ → deliver の直前に回した：`pnpm --filter @wtm/e2e test` — **94 passed** / 0 failed / 0 flaky（6.7 分。review ラウンド 4 の nit を直した後のビルド）。
- **Windows ネイティブは実機で確かめていない**。ホームの `~`（大小を問わない）と根のパスは `path.win32` の単体で確かめたが、リポジトリの中の根の見つけ方は Windows では単体でも
  確かめていない（`docs/verification.md` の Windows の項目で確かめる）。
- **macOS は検証環境が無い**（規則は `node:path` の POSIX と同じ）。
- 相対の `gitdir:` を字面で畳むので、cwd がシンボリックリンクの中だと herdr・git と答えが違いうる（注記して受け入れた。T2 の点検）。
- 遅い・止まったファイルシステムの上では、上限を超えた問い合わせが返るまで新しい workspace の名前もフォルダ名になり、復元は合計 1 秒を過ぎたら残りをフォルダ名にする
  （`docs/verification.md` の「既知の制約」）。実物の止まったマウント（hard の NFS）では確かめていない（偽の fs で、返らない・遅れて返る stat と、進む時計を作って単体で確かめた）。
