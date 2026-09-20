# タスク: workspace のメニューから Git worktree を作る・開く

## 実装方針

**下の層から積む**——protocol（型）→ server（機能）→ web（操作）。
逆にすると、上の層が未定義の型やメソッドを参照することになり、途中で typecheck が通らない状態が続く。

**純粋関数を先に切り出す**（規則の置き場）。`branchToPathSlug` / `defaultCheckoutPath` は
protocol に、`generatedBranchSlug` / `parseWorktreeListPorcelain` / `repoNameFromGitCommonDir` は server に。
規則を先に固めてからサービスを書くと、サービスの単体テストが「git の実行」だけに集中できる。

**ダイアログとテストは 1 つずつ割る**。作成用と一覧用は形が違う（入力 1 つ vs 一覧）ので、
まとめるとタスク単位の点検の粒度が粗くなる。

## 作業順序と依存関係

順序は `依存:` に全て落としてある。理由だけ書く。

- **T1〜T4（protocol）が終わるまで server も web も書けない**。型が無いため。
- **T4（`ErrorCode` に 4 つ）と T5（web の文言）は対**。`clientError.ts` の `MESSAGES` は
  `Record<ErrorCode, string>` なので、**コードを足して文言を足さないと型が落ちる**。
- **T8（`WorktreeService`）は T4 にも依存する**。`RpcError("worktree_branch_in_use")` 等を書くので、
  `ErrorCode` に足す前に着手すると typecheck が壊れる。
- **T8 を足すとリテラルで `MethodDeps` を組む既存テスト 2 件が壊れる**
  （`methods/index.test.ts:109`・`ws/WsGateway.integration.test.ts:113`）。同じ T10 で直す。
- **T13 は T5 にも依存する**。失敗の文言を `code` から引くので、`clientError` の表が先に要る。

## リスク / 留意点

- **`ActionDispatcher.run()` の `switch` に `case "newWorktree"` を足す**（`ActionDispatcher.ts:57-141`）。
  **この switch に `default` も網羅性の検査も無い**ので、足し忘れても**型では落ちず、
  `prefix+G` が黙って何もしない**。T13 で必ず足す。
- **`git rev-parse --git-common-dir` はリポジトリ直下だと相対の `.git` を返す**（design の実機確認）。
  絶対化してから `repoNameFromGitCommonDir` に渡さないと、repo 名が `.` になる。
- **`git worktree add` の失敗の理由は stderr の 2 行目**（1 行目は `Preparing worktree (...)`）。
  `fatal:` / `error:` で始まる行を拾う。
- **protocol に `node:*` を持ち込まない**（web のビルドが壊れる）。パスは `/` で連結する。
- **`show-ref` の exit 1 は「ブランチが無い」で正常**。0 以外をまとめてエラーにしない。
- **生の stderr を利用者に見せない**（D107・decisions.md D2）。分類したコードだけを返し、stderr はログへ。
- **E2E はこのリポジトリ自身に worktree を作らない**。使い捨てのリポジトリを用意する。
- **E2E は 1 本ずつ走らせる**。

## テスト方針

design の「テストの置き方」に従う。要点:

- 純粋関数は**herdr のテストの実値**を期待値にする（research F1・F2 に逐語がある）。
- `WorktreeService` は**本物の git**（既存の `GitInfoPoller.test.ts` と同じ流儀）。
- **負の対照**（条項 `regression-negative-control`）: 新機能なので「実装前は要素が無くて落ちる」では弱い。
  **実装後に振る舞いを壊して**落ちることを確かめる（分類を 1 つに潰す／既に開いている判定を外す／
  `branchToPathSlug` の畳み込みを外す）。
  **壊した後は必ず元に戻し、`git diff` か `cmp` でファイルが一致することを確認する**（条項の要求）。
  生の出力は `test-result.md` に貼る（要約に置き換えない）。
- 一式（全パッケージの単体 ＋ 既定の E2E）は test 工程で 1 回通す（T21）。
  `mobile.spec.ts` の D105 は**この work の前から一式のときだけ落ちる**（先行 work の記録）。

## タスク

- [x] T1: `@wtm/protocol` に `WorktreeEntry` と 2 つの方式の型を足す（`WorktreeListParams/Result`・
      `WorktreeCreateParams/Result`）。**`METHOD_SCHEMAS` と `MethodResultMap` の両方**に足す
      対象: `packages/protocol/src/model.ts` `packages/protocol/src/messages.ts:155-212` / 根拠: research A1
      依存: なし
      AC: AC3, AC4
- [x] T2: `packages/protocol/src/worktreePath.ts` を作る（`branchToPathSlug` / `defaultCheckoutPath`）。
      **`node:*` を import しない**。`/` で連結する
      対象: `packages/protocol/src/worktreePath.ts`（新規）・`packages/protocol/src/index.ts`（再輸出）
      依存: なし
      AC: AC2
- [x] T3: T2 の単体テストを足す（herdr のテストの実値を期待値にする。`worktree/brave-river` →
      `worktree-brave-river`、`issue/137 Worktree Spaces` → `issue-137-worktree-spaces`、`///` → `worktree`）
      対象: `packages/protocol/src/worktreePath.test.ts`（新規）
      依存: T2
      AC: AC2
- [x] T4: `ErrorCode` に `not_a_git_repository` / `worktree_branch_in_use` / `worktree_path_exists` /
      `worktree_failed` を足す
      対象: `packages/protocol/src/errors.ts:2` / 根拠: research A2
      依存: なし
      AC: AC7
- [x] T5: `clientError.ts` の `MESSAGES` に 4 つの日本語を足す（**型を通すために T4 の直後**）
      対象: `packages/web/src/net/clientError.ts:14-20`
      依存: T4
      AC: AC7
- [x] T6: `GitRunner` の戻り値に `stderr` を足し、`stdio` の 3 番目を `pipe` に、`env` に `LC_ALL=C` を足す
      対象: `packages/server/src/infra/GitRunner.ts:8-38` / 根拠: research A3
      依存: なし
      AC: AC7, AC10
- [x] T7: `packages/server/src/git/worktree.ts` を作る（`generatedBranchSlug` /
      `parseWorktreeListPorcelain`（bare と prunable を落とす。prunable は**前方一致**）/
      `repoNameFromGitCommonDir`）＋その単体テスト。
      **herdr からの移植なので `NOTICE` と `third_party/herdr/README.md` に 1 行足す**
      （既存の `ManifestStore` 等と同じ書き方）
      対象: `packages/server/src/git/worktree.ts`・`worktree.test.ts`（新規）・`NOTICE`・`third_party/herdr/README.md`
      依存: T1
      AC: AC1, AC4
- [x] T8: `packages/server/src/git/WorktreeService.ts` を作る（`list` / `create`）。
      cwd は `SessionService.getWorkspace` から引き、**無ければ `RpcError("not_found")`**。
      `create` は `show-ref` で分岐し、失敗は stderr の `fatal:` の行で**コードに分類**する
      対象: `packages/server/src/git/WorktreeService.ts`（新規） / 根拠: research A5・A8
      依存: T4, T6, T7
      AC: AC3, AC7
- [x] T9: `WorktreeService` の単体テストを足す（**本物の git**。作成の成功／同じブランチで 2 回／
      既存パスへ、の 3 ケースで**コードが分かれる**こと。git でないディレクトリで `not_a_git_repository`）
      対象: `packages/server/src/git/WorktreeService.test.ts`（新規） / 根拠: research A15
      依存: T8
      AC: AC4, AC7
- [x] T10: 方式を登録する（`worktree.list` / `worktree.create`）。`MethodDeps` に `worktrees` を足し、
      **リテラルで組んでいる既存テスト 2 件も直す**
      対象: `packages/server/src/surface/methods/worktree.ts`（新規）・`methods/deps.ts:7-12`・
      `methods/index.ts:13-20`・`methods/index.test.ts:109`・`ws/WsGateway.integration.test.ts:113`
      依存: T8
      AC: AC3, AC4
- [x] T11: `composeServer` で `WorktreeService` を組み立てて `MethodDeps` へ渡す
      対象: `packages/server/src/composeServer.ts:140` `:150-153` / 根拠: research A7
      依存: T10
      AC: AC3, AC4
- [x] T12: `DialogContext` に `worktreeCreate` / `worktreeOpen` を足す
      対象: `packages/web/src/store/view.ts:74-81` / 根拠: research A9
      依存: T1
      AC: AC1, AC4
- [x] T13: `ActionDispatcher` に 4 つ足す（`newWorktree` / `openWorktree` / `confirmWorktreeCreate` /
      `confirmWorktreeOpen`）。確定は `confirmNewTab` と同じ形（`closeDialog` → `holdInput` →
      `conn.request` → 成功で `setView`/`focusPane`）。**失敗は `err.code` から日本語を引いて toast**
      （固定文言にしない。AC7）。**開くときは同じ cwd の workspace を先に探す**。
      **`run()` の `switch` に `case "newWorktree"` を足す**（`default` が無いので足し忘れても型で落ちない）
      対象: `packages/web/src/actions/ActionDispatcher.ts:57-141`（switch）`:144-161` `:258-260` / 根拠: research A12
      依存: T5, T12
      AC: AC3, AC5, AC6, AC7
- [x] T14: 作成のダイアログを作る（`NameDialog` の形＋**パスのプレビュー**）。`App.vue` に置く
      対象: `packages/web/src/components/WorktreeCreateDialog.vue`（新規）・`packages/web/src/App.vue` / 根拠: research A10
      依存: T13
      AC: AC1, AC2, AC-I1, AC-I2
- [x] T15: 一覧のダイアログを作る（`GotoPicker` の形の `role="listbox"` ＋ ↑↓）。`App.vue` に置く
      対象: `packages/web/src/components/WorktreeOpenDialog.vue`（新規）・`packages/web/src/App.vue` / 根拠: research A11
      依存: T14
      AC: AC4, AC5, AC-I1, AC-I2
- [x] T16: メニューに 2 項目を足す（**`workspace.git` が非 null のときだけ**）。
      **`ContextMenu.vue:72` の「グルーピングが対象外なので常にこの 2 項目」のコメントを実態に合わせて直す**。
      `prefix+G` を `notYet` から `newWorktree` へ差し替える
      対象: `packages/web/src/components/ContextMenu.vue:71-77`・`packages/web/src/keys/keymap.ts:13-19`・
      `packages/web/src/keys/actions.ts` / 根拠: research A13・A14
      依存: T15
      AC: AC1, AC8, AC-I3
- [x] T17: メニューの出し分けとエラーの文言の単体テストを足す
      （git あり／なしの 2 ケース、`clientErrorMessage` の 4 つ）
      対象: `packages/web/src/components/ContextMenu.test.ts`・`packages/web/src/net/clientError.test.ts`
      依存: T16
      AC: AC7, AC8
- [x] T18: 2 つのダイアログの単体テストを足す（初期値・パスのプレビュー・一覧の中身・
      Esc で何も起きない・↑↓ で選べる）
      対象: `packages/web/src/components/WorktreeCreateDialog.test.ts`・`WorktreeOpenDialog.test.ts`（新規）
      依存: T17
      AC: AC1, AC2, AC4, AC-I1, AC-I2
- [x] T19: `ActionDispatcher` の単体テストを足す（確定で送る引数／**既に開いている worktree を
      選んだら `workspace.create` を呼ばない**／失敗の文言がコードごとに違う）
      対象: `packages/web/src/actions/ActionDispatcher.test.ts`
      依存: T18
      AC: AC3, AC5, AC6
- [x] T20: E2E を足す（使い捨てのリポジトリを作り、その cwd で `workspace.create` してから
      **`prefix+G` だけで** worktree を作って workspace が増えること／一覧から開けること／
      **閉じてもディスクに残ること**）
      対象: `packages/e2e/src/specs/workspace-tab-pane.spec.ts`（新しい test を追加） / 根拠: research A16
      依存: T19
      AC: AC3, AC5, AC9, AC-I3, AC-I4
- [ ] T21: 全パッケージの単体テストと既定の E2E を走らせて結果を記録する
      （**test 工程で消化する**。coding では未チェックのまま承認してよい。decisions.md D1）
      対象: 未特定（走らせるだけで自前の差分を持たない）
      依存: T20
      AC: AC10, AC11, AC-I5
