# テスト結果: workspace のメニューから Git worktree を作る・開く

## 実行したもの

**ラウンド 3**（review ラウンド2 の nit 4 件を直した後。**`pnpm build` を通してから E2E を走らせた**。decisions.md D8）

- `pnpm build` — exit 0（**E2E の前に必ず通す**。下記「ビルドの取り違え」）
- `vitest run --root packages/protocol` — 18 passed / 0 failed / 0 skipped
- `vitest run --root packages/server` — 507 passed / 0 failed / 0 skipped
- `vitest run --root packages/web` — 636 passed / 0 failed / 0 skipped
- `pnpm -C packages/e2e test -- src/specs/workspace-tab-pane.spec.ts` — 10 passed（32.7s。worktree の 2 本を含む）
- `pnpm -C packages/e2e test`（既定の E2E 一式） — **69 passed / 0 failed**（3.5m）
- `pnpm -C packages/{protocol,server,web,e2e} typecheck` — 4 つとも exit 0
- `pnpm lint` — exit 0
- `aidev smoke` — pass（exit 0）

**E2E は 1 本ずつ走らせた**（同時に走らせると無関係な失敗が出る。先行 work の記録）。

**`mobile.spec.ts` の D105 について**: **ラウンド 2 の一式では落ち、ラウンド 1 と 3 では通った**。
一式のときだけ落ちる不安定な失敗で、**この work の前からの既知**（先行 work の記録、backlog に登録済み）。
落ちたラウンドでも単独実行は 6 件 pass。この work の差分は `packages/web/src/mobile/` に 1 行も
触れていない（`git diff --name-only` で確認）。3 ラウンドで 1 回だけ落ちたことが、
再現性のない失敗という見立てを裏付けている。

### ビルドの取り違え（このラウンドで判明。decisions.md D8）

**`pnpm -C packages/e2e test` は再ビルドしない**。サーバは `@wtm/server`（`exports` が
**`./dist/testkit.js`**）を、ブラウザは `packages/web/dist` を読む。ラウンド1 の CSS の修正を入れた直後に
E2E が落ちたが、**原因は修正が効いていないことではなく、修正前のバンドルを見ていたこと**だった
（dist は 19:59 の `aidev smoke` のもの、修正は 20:08）。`pnpm build` 後は 10 件とも pass。

**この取り違えは静かに効く**——直さずに走らせても「通った」ように見える。そのため
**ラウンド1 の結果（69 passed）は、cross 点検の修正が入る前のビルドに対するものだった可能性がある**。
上の数字はすべて `pnpm build` の後に取り直したもの。

## 受け入れ基準ごとの判定

- AC1: pass — `ContextMenu.test.ts`（git ありで 4 項目・押すと `newWorktree`／`openWorktree` を呼ぶ）、
  `WorktreeCreateDialog.test.ts`（初期値が `suggestedBranch`）、E2E（`prefix+G` で候補入りのダイアログ）
- AC2: pass — `WorktreeCreateDialog.test.ts`（`issue/137 Spaces` → `issue-137-spaces` のパス表示）、
  E2E（`.worktree-dialog-preview-path` が `/.wtm/worktrees/` を含み、作られた workspace の cwd と一致）
- AC3: pass — `ActionDispatcher.test.ts`（`worktree.create` → `workspace.create` の順と引数）、
  `WorktreeService.test.ts`（本物の git で worktree ができ一覧に増える）、空欄では何も送らない、E2E
- AC4: pass — `worktree.test.ts`（`parseWorktreeListPorcelain` が bare と prunable を落とす。
  prunable は前方一致）、`WorktreeOpenDialog.test.ts`（一覧の中身）
- AC5: pass — `ActionDispatcher.test.ts`（未知のパスなら `workspace.create`／一覧が空ならダイアログを開かず toast）、E2E
- AC6: pass — `ActionDispatcher.test.ts`（既存なら `workspace.create` を呼ばず、**焦点の pane も移る**）、
  `WorktreeService.test.ts`（**symlink 経由の root でも `create` の戻り値が `list` と一致する**。cross 点検の must）、E2E
- AC7: pass — `WorktreeService.test.ts`（本物の git で 7 ケースが**別々のコード**になる：
  `worktree_path_exists` / `worktree_branch_in_use` / `worktree_no_commits` /
  `worktree_invalid_branch`（不正な名前・階層の衝突の 2 通り）/ `not_a_git_repository` / `worktree_failed`）、
  `clientError.test.ts`（6 つの文言が互いに違う）、
  `ActionDispatcher.test.ts`（**失敗の toast がコードごとに違い、読めないコードは汎用に落ちる**）
- AC8: pass — `ContextMenu.test.ts`（git でなければ 2 項目だけ）
- AC9: pass — E2E（閉じた後に `git worktree list --porcelain` を叩いて残っていることを確認）
- AC10: pass — `GitInfoPoller.test.ts` が既存のまま通る（`GitRunner` の戻り値に `stderr` を足したが、
  既存の呼び出しは `code`/`stdout` しか見ていない）
- AC11: pass — 上記のとおり単体 1154 件・E2E 69 件がすべて通る。テスト側を直したのは
  `clientError.test.ts`（AC7：`worktree_failed` の文言を「作成」に限定しない言い直しに追随）のみ
- AC-I1: pass — 両ダイアログの `Esc` テスト（`cancel` イベント経由で `closeDialog`）
- AC-I2: pass — 同上＋ Enter 確定（`<form method="dialog" @submit.prevent>`）・クリック確定
- AC-I3: pass — E2E が **`prefix+G` だけ**で作成まで通している（マウス操作なし）。
  一覧のキー処理は `<dialog>` で受ける（`WorktreeOpenDialog.test.ts` が、一覧の外で押したキーでも
  選択が動くことを固定。`<ul>` に付いていると通らない）。E2E は**選択中の行に hover しても選択色が
  消えない**ことも実物の CSS で確認している。
  「worktree を開く…」がメニュー（マウス）だけなのは要件どおり（backlog へ）
- AC-I4: pass — `showModal()` ＋ 入力欄 `focus()`／一覧 `focus()`、閉じたら `preDialogFocusPaneId` へ戻る既存経路
- AC-I5: pass — `KeyInputController` が `view.openDialog !== null` の間は即 return（既存の仕組み）。
  メニューの既存 2 項目の位置は `ContextMenu.test.ts` が順序ごと固定

## 失敗の証跡

**review ラウンド1 で差し戻し（`sent_back`）が 1 回発生した**（should 3・nit 4）。以下がそのラウンドで
実際に観測した失敗の生の出力。

### ラウンド 2 で観測した失敗（1）: 選択色が hover に負ける（review ラウンド1 の should）

```
$ pnpm -C packages/e2e test -- src/specs/workspace-tab-pane.spec.ts
  ✘  10 src/specs/workspace-tab-pane.spec.ts:532:1 › worktree：一覧から開ける。既に開いている worktree を選んでも増えない（AC5・AC6） (6.0s)
    Error: hover しても選択色のまま

    expect(received).toBe(expected) // Object.is equality

    Expected: "rgb(68, 71, 90)"
    Received: "rgb(52, 55, 70)"

  1 failed
  9 passed (33.6s)
```

`rgb(68,71,90)` が選択色（`#44475a`）、`rgb(52,55,70)` が hover 色（`#343746`）。
**この失敗は「修正が効いていない」ことではなく「修正前のバンドルを見ていた」ことが原因**だった
（上記「ビルドの取り違え」）。`pnpm build` の後は 10 件とも pass。
**足した検証自体は正しく効いている**——修正前の CSS を的確に捕まえている。

### ラウンド 2 で観測した失敗（2）: `mobile.spec.ts` の D105（この work とは無関係）

```
$ pnpm -C packages/e2e test
  ✘  65 src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105） (2.1s)
  1 failed
  68 passed (3.5m)

$ pnpm -C packages/e2e test -- src/specs/mobile.spec.ts
  6 passed (18.7s)
```

一式のときだけ落ち、単独では通る。**この work の差分は `packages/web/src/mobile/` に触れていない**。

### ラウンド 3 の負の対照（review ラウンド1・2 の修正。条項 `regression-negative-control`）

**review ラウンド2 の指摘どおり**、ラウンド1 の修正のうち生の出力を残していなかった 3 件
（label / `worktree_invalid_branch` / `recordedPath`）と、ラウンド2 で足した分類を、壊して落ちることを確かめた。

```
$ vitest run --root packages/server src/git/WorktreeService.test.ts   # (b) 分類 2 つと (c) フォールバックを戻した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected RpcError: git worktree add failed (worktr… { code: '…' } to match object { code: 'worktree_invalid_branch' }
AssertionError: expected RpcError: git worktree add failed (worktr… { code: '…' } to match object { code: 'worktree_invalid_branch' }
AssertionError: expected 'worktree_failed' to be 'worktree_invalid_branch' // Object.is equality
AssertionError: expected 'worktree_failed' to be 'worktree_invalid_branch' // Object.is equality
 Test Files  1 failed (1)
      Tests  4 failed | 17 passed (21)

$ vitest run --root packages/web src/actions/ActionDispatcher.test.ts   # (a) label を渡さない状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { cwd: '/root/wtm/feature-x' } to deeply equal { cwd: '/root/wtm/feature-x', …(1) }
AssertionError: expected [ 'workspace.create', { cwd: '/w/a' } ] to deeply equal [ 'workspace.create', …(1) ]
AssertionError: expected [ 'workspace.create', …(1) ] to deeply equal [ 'workspace.create', …(1) ]
 Test Files  1 failed (1)
      Tests  3 failed | 58 passed (61)
```

```
$ vitest run --root packages/server src/git/WorktreeService.test.ts   # (c) recordedPath のフォールバックを外した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
RpcError: git could not be run: rev-parse
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```

**1 度目の (c) は壊し方が足りなかった**——`this.run` に戻しただけでは自分で足した `try/catch` が
`RpcError` を飲んでしまい、テストは緑のままだった。`try/catch` ごと外して初めて
`RpcError: git could not be run: rev-parse` で落ちた（2 つ目のブロック）。
**「壊したのに落ちない」を「守られている」と読み違えないために、壊し方が効いているかまで確かめる必要がある**。

壊した 2 ファイルはいずれも `cmp` で復元を確認済み。

### 負の対照（条項 `regression-negative-control`）

**「緑だが何も守っていないテスト」を炙り出すために、
実装をわざと壊して落ちることを確かめる負の対照（条項 `regression-negative-control`）を 2 回行った**。
以下はその生の出力。

### 1. タスク点検で見つかった 2 件（壊した状態での出力）

```
$ npx vitest run --root packages/web src/actions/ActionDispatcher.test.ts src/components/ContextMenu.test.ts   # 実装を壊した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 'worktree の操作に失敗しました。' to be 'そのブランチは既に別の場所でチェックアウトされています。別の名前にしてくだ…' // Object.is equality
AssertionError: expected 'worktree の操作に失敗しました。' to be 'この workspace は Git リポジトリではありません。' // Object.is equality
AssertionError: expected "vi.fn()" to be called with arguments: [ 'w1' ]
 Test Files  2 failed (2)
      Tests  3 failed | 78 passed (81)
```

壊したのは `worktreeErrorMessage` を固定文言を返す実装に差し替えたこと、および
`ContextMenu.vue` の `actions.openWorktree(...)` を `actions.newWorktree(...)` に差し替えたこと。
**この 2 つは、テストを足す前は壊しても全件 green のままだった**（点検が実地に確認）。
復元後 `cmp` で 2 ファイルとも一致を確認。

### 2. cross 点検で見つかった 4 件（壊した状態での出力）

```
$ vitest run packages/server src/git/WorktreeService.test.ts  +  packages/web ActionDispatcher/clientError   # cross 指摘の修正を 4 つとも戻した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: create の戻り値が list と同じ文字列: expected '/tmp/wtm-worktree-link-xX6QSn/root/wt…' to be '/tmp/wtm-worktree-real-zj7lYP/wtm-wor…' // Object.is equality
AssertionError: expected RpcError: git worktree add failed (worktr… { code: '…' } to match object { code: 'worktree_no_commits' }
AssertionError: expected Error: spawn git ENOENT to be an instance of RpcError
AssertionError: expected 'worktree_failed' to be 'worktree_no_commits' // Object.is equality
 Test Files  1 failed (1)
      Tests  4 failed | 12 passed (16)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: その tab で最後に見ていた pane へ焦点が移る: expected 'p-elsewhere' to be 'p9' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 59 passed (60)
```

戻したのは (a) `create` が git に聞かず組み立てた文字列を返す、(b) `invalid reference: HEAD` の分類を外す、
(c) `GitRunner` の reject を `RpcError` に包まない、(d) 「既に開いている」分岐で `focusPane` を呼ばない、の 4 つ。
復元後 `cmp` で 2 ファイルとも一致を確認。

**(a) の出力が cross 点検の must そのもの**——`/tmp/wtm-worktree-link-…/root/…`（組み立てた文字列）と
`/tmp/wtm-worktree-real-…/…`（git が記録したパス）が食い違っている。

## 起動確認（smoke）

```
smoke: 20260920-git-worktree-actions
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46243 (state dir /tmp/wtm-smoke-1EeY0W)
{"ts":"2026-09-20T10:59:52.557Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

この work は**新しい入口（サブコマンド・オプション）を足していない**（追加したのは WebSocket の方式 2 つで、
smoke は既に WebSocket 経由の往復を確認している）ので、`smokeCommands` への追加は不要と判断した。

## 未検証の穴（skip / 環境不足）

- **`$HOME` の経路に symlink があるマシンでの実機確認**。cross 点検の must（decisions.md D5）は
  symlink を張った単体テストで再現・修正・負の対照まで確認したが、**この開発機の `$HOME` は symlink ではない**
  ので、実際にそういう環境で通しては**いない**。macOS（`/tmp` → `/private/tmp`）や、ホームを symlink で
  張っている環境での確認は未実施。
- **Windows**。パスの組み立ては `/` 区切りに正規化しているが（`defaultWorktreeRoot`）、
  Windows 上で `git worktree add` を通してはいない。
- **大きなリポジトリでの 10 秒の時間切れ**。`GIT_TIMEOUT_MS = 10_000` を超える `worktree add` は
  途中で `kill` され、**登録だけ残った中途半端な worktree が生じうる**（cross 点検が指摘）。
  この work に削除が無いので UI からは片付けられない。時間切れそのものは `worktree_failed` に
  包まれることを単体テストで確認済みだが、**実際に時間切れさせる試験は行っていない**。deliver で backlog へ。
- **AC1〜AC9 の実機（実ブラウザ・実端末）での目視**。E2E（Chromium）では通しているが、
  利用者の実機での確認は未実施。
