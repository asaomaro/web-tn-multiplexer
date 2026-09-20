# 調査: workspace のメニューから Git worktree を作る・開く

requirements の「未確定事項」4 件（置き場所の既定値／ブランチ名の生成方式／git かどうかの判定／
ダイアログの作り）を、herdr のソースとこの製品の実物で埋める。**設計判断は design へ送る**。

herdr のソースは `/tmp/claude-1000/…/scratchpad/herdr`（commit `da6bcd5`）。以下 `herdr:` と略す。

## 調査の問い

- Q1: herdr の worktree の実装の細部（移植の参考）。
- Q2: この製品でメソッド・ダイアログ・サービスをどう足すか。
- Q3: 既存のテストがどう git を扱っているか。
- Q4: 実装アンカー。

## 判明した事実

### F1: herdr のブランチ名の自動生成（`herdr:src/worktree.rs:21-32`）

```rust
const DEFAULT_WORKTREE_PREFIX: &str = "worktree";           // :4
adjectives = ["brave","calm","clear","green","lucky","quiet","rapid","silver"]
nouns      = ["river","cloud","field","forest","harbor","meadow","stone","valley"]
adjective = adjectives[seed % 8]
noun      = nouns[(seed / 8) % 8]
suffix    = seed & 0xffff
format!("worktree/{adjective}-{noun}-{suffix:04x}")
```

herdr 自身のテスト（`:580-582`）: `seed=0` → `worktree/brave-river-0000`、
`seed=9` → `worktree/calm-cloud-0009`。

### F2: ブランチ名 → パスの変換（`herdr:src/worktree.rs:34-54`）

ASCII 英数字は小文字にしてそのまま、**それ以外の連続は `-` 1 個に畳む**、前後の `-` を落とす。
空になったら `"worktree"`。テスト（`:631-641`）:
`worktree/brave-river` → `worktree-brave-river`、
`issue/137 Worktree Spaces` → `issue-137-worktree-spaces`、`///` → `worktree`。

作成先は `root / repo_name / branch_to_path_slug(branch)`（`:171-173`）。
テスト（`:741-750`）: root `/home/me/.herdr/worktrees`・repo `herdr`・branch `worktree/brave-river`
→ `/home/me/.herdr/worktrees/herdr/worktree-brave-river`。

### F3: 作成のコマンドは**ブランチの有無で 2 通り**（`herdr:src/worktree.rs:239-278`・`:309-322`）

- 既にあるか: `git -C <repo_root> show-ref --verify --quiet refs/heads/<branch>`（`:280-307`）。
  **exit 0 なら存在、exit 1 なら不在、それ以外はエラー**。
- 新規ブランチ: `git -C <repo_root> worktree add -b <branch> <path> <base>`（base は `HEAD`）。
  herdr のテストの実値（`:901-921`）: `["-C","/repo/herdr","worktree","add","-b","worktree/brave-river","/w/herdr/worktree-brave-river","HEAD"]`
- 既存ブランチ: `git -C <repo_root> worktree add <path> <branch>`（`-b` も base も無し。`:925-943`）
- **`LC_ALL=C` を付けて実行する**（`:324-344`）。理由はコメントどおり
  「エラーの種類を git の英語の診断メッセージで判別するため」——ロケールで訳されると判定が壊れる。

### F4: 一覧は `git worktree list --porcelain`（`herdr:src/worktree.rs:425-514`）

読む行は 5 種類（`:425-492`）:
`worktree <path>`（エントリの開始）／`branch <ref>`（`refs/heads/` を剥がす）／
`detached`（完全一致）／`bare`（完全一致）／`prunable…`（**前方一致**。値は捨てる）。
**空行でエントリが確定**し、フラグはリセットされる。

### F5: この製品でメソッドを足す手順（`packages/protocol/src/messages.ts`）

**2 箇所を両方直さないと型が落ちる**（片方だけだと `MethodName` と `MethodResultMap` が食い違う）:

1. `z.object(...)` で Params スキーマ＋`z.infer` の型（例 `:61-65` の `WorkspaceCreateParams`）。
   戻り値がある方式は `export interface XxxResult`（`:66-70`）。空なら `Record<string, never>`（`:186`）。
2. `METHOD_SCHEMAS`（`:155-180`）に「方式名 → スキーマ」を足す。`MethodName = keyof typeof METHOD_SCHEMAS`（`:182`）。
3. `MethodResultMap`（`:184-209`）に「方式名 → Result 型」を足す。

`ParamsOf<M>` / `ResultOf<M>` は `:211-212`。

### F6: サーバ側の登録とエラーの返し方

- `ControlSurface.register(name, { schema, handler })`（`ControlSurface.ts:27-29`）。
- `invoke`（`:31-50`）: スキーマ不一致は `invalid_params`、**`RpcError` は
  `toProtocolError()` の `{code, message}` がそのまま利用者へ返る**（`protocol/src/errors.ts:16-18`）。
  それ以外の例外は `internal` に丸められ、詳細はログだけ。
  → **git の stderr を利用者に見せるなら `RpcError` に載せる必要がある**。
- `MethodDeps`（`methods/deps.ts:7-12`）は `session` / `clients` / `sizeAuthority` / `terminals` の 4 つ。
  **git 関係は入っていない**——`gitPoller` は `composeServer.ts:140` で作られるだけで `MethodDeps` に渡っていない。
  新しいサービスをハンドラから使うには**ここに足して `registerAllMethods`（`methods/index.ts:13-20`）へ渡す**。
- 組み立ては `composeServer.ts:140`（`new ChildProcessGitRunner()`）と `:150-153`（`MethodDeps` と register）。

### F7: `Workspace.git` は**すぐには埋まらない**（メニューの出し分けに直結）

- `GitInfo` は `branch` / `ahead` / `behind` だけ（`protocol/src/model.ts:12-16`）。
  **worktree のパスもリポジトリのルートも持っていない**。
- `git` が null になるのは: workspace を作った直後の初期値（`SessionModel.ts:184`・`:533`）／
  `git rev-parse --abbrev-ref HEAD` が 0 以外（`GitInfoPoller.ts:51-70`。git 管理外かコミットが無い）／
  例外（時間切れ・git が無い）。
- **`DefaultGitInfoPoller` の周期は 5000ms**（`GitInfoPoller.ts:5`）。
  つまり**workspace を作った直後は最大 5 秒間 `git` が null**で、
  「git リポジトリか」を `Workspace.git` で判定すると**その間メニューに項目が出ない**。

### F8: ダイアログは `DialogContext` の union に足す形

- `DialogContext`（`store/view.ts:74-81`）は 7 種類の union。
  `openDialogWithContext(ctx)`（`:159-163`）が `preDialogFocusPaneId` へ今の pane を退避してから開く。
  `closeDialog()`（`:174-180`）が**開く前の pane へフォーカスを戻す**。
- 既存の 2 つはどちらも**ネイティブの `<dialog>`**:
  - `NameDialog.vue`: `<form method="dialog" @submit.prevent="confirm">`（`:98`）で Enter 確定。
    `watch(() => view.dialogContext)`（`:55-70`）で `showModal()` → 入力欄に `focus()` → `select()`（全選択）。
  - `GotoPicker.vue`: `<ul role="listbox">` と自前の `@keydown`（`:203-288`）。
    `watch`（`:175-192`）で `showModal()` → 一覧に `focus()`。
  - **Esc は両方とも同じ形**——ネイティブの `cancel` を `onNativeCancel` で `preventDefault()` し、
    自分で `view.closeDialog()` を呼ぶ（`GotoPicker.vue:198-201`・`NameDialog.vue` の同名関数）。
- 確定してサーバへ送る流れの手本は `ActionDispatcher.confirmNewTab`（`:144-161`）:
  **`dialogContext.kind` を確かめる → `closeDialog()` → `holdInput`（D99）→ `conn.request` →
  成功で `setView` / `focusPane` と保留の解放、失敗で保留の取り消しと `toast`**。

### F9: 既存のテストは**本物の git を使う**

- `GitInfoPoller.test.ts` は `GitRunner` を差し替えず、`ChildProcessGitRunner` をそのまま使い、
  一時ディレクトリに本物のリポジトリを作って検証する（`:14`・`:51`・`:87`）。
  **リポジトリに `GitRunner` のフェイクは存在しない**（grep で確認）。
- E2E の `makeAheadRepo`（`workspace-tab-pane.spec.ts:375-392`）は bare ＋ clone を作り、
  `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_SYSTEM` を `/dev/null` にして利用者の設定を遮断する。

## 影響範囲

- `packages/protocol/src/messages.ts`（型 2 箇所 ＋ スキーマ）
- `packages/server`: `infra/GitRunner.ts`（stderr）／`git/` に worktree のサービス／
  `surface/methods/`（新しい方式）／`surface/methods/deps.ts`／`composeServer.ts`
- `packages/web`: `store/view.ts`（`DialogContext`）／`components/ContextMenu.vue`／
  新しいダイアログ 2 つ／`actions/ActionDispatcher.ts`／`keys/keymap.ts`・`keys/actions.ts`
- 既存テスト: `ContextMenu.test.ts`・`view.test.ts`・`GitInfoPoller.test.ts`

## 実現性 / リスク

- **F7 が最大の論点**。`Workspace.git` は 5 秒周期なので、
  「git リポジトリか」をそれだけで判定すると**作った直後はメニューに項目が出ない**。
  design で「出し分けの根拠を何にするか」を決める必要がある。
- **F6 により、git の stderr を利用者に見せるには `RpcError` に載せる**（そうしないと `internal` に丸められる）。
- **F3 の「ブランチの有無で分岐」を落とすと、既存ブランチ名を入れたときに必ず失敗する**。
- F9 により、サーバ側の worktree のテストは**本物の git で書ける**（既存の流儀に合う）。
- `GitRunner` に stderr を足すのは戻り値を増やすだけなので、`GitInfoPoller` は無変更で済む（F6 の構造）。

## 実装アンカー

- A1: `packages/protocol/src/messages.ts:61-70`（方式定義の手本）・`:155-180`（`METHOD_SCHEMAS`）・
  `:184-209`（`MethodResultMap`）・`:211-212`（`ParamsOf` / `ResultOf`）
- A2: `packages/protocol/src/errors.ts:1-18`（`ErrorCode` / `RpcError`）
- A3: `packages/server/src/infra/GitRunner.ts:1-38`（`run` の形・`stdio` の第 3 要素）
- A4: `packages/server/src/git/GitInfoPoller.ts:51-70`（`probe` の分岐）・`:5`（周期 5000ms）
- A5: `packages/server/src/surface/ControlSurface.ts:27-50`（`register` / `invoke` とエラー）
- A6: `packages/server/src/surface/methods/deps.ts:7-12`・`methods/index.ts:13-20`・`methods/workspace.ts:1-36`
- A7: `packages/server/src/composeServer.ts:140`・`:150-153`
- A8: `packages/server/src/session/SessionService.ts:121`（`createWorkspace(cwd, label)`）
- A9: `packages/web/src/store/view.ts:74-81`（`DialogContext`）・`:159-163`・`:174-180`
- A10: `packages/web/src/components/NameDialog.vue:55-70`・`:73-93`・`:97-105`
- A11: `packages/web/src/components/GotoPicker.vue:175-192`・`:194-288`・`:292-310`
- A12: `packages/web/src/actions/ActionDispatcher.ts:144-161`（`confirmNewTab`）・`:258-260`（開く側）
- A13: `packages/web/src/components/ContextMenu.vue:71-77`（workspace の分岐）
- A14: `packages/web/src/keys/keymap.ts:13-19`（`NOT_YET` の `G`）・`keys/actions.ts`（`Action` の union）
- A15: `packages/server/src/git/GitInfoPoller.test.ts:14,51,87`（本物の git を使うテストの形）
- A16: `packages/e2e/src/specs/workspace-tab-pane.spec.ts:375-392`（`makeAheadRepo`）

## 実装時の注意

- **`METHOD_SCHEMAS` と `MethodResultMap` は両方直す**（F5。片方だけだと型が落ちる）。
- **利用者に見せたいエラーは `RpcError` に載せる**（F6。素の例外は `internal` に丸められる）。
- **`LC_ALL=C` を付ける**（F3）。git の英語の診断で種類を判別する前提を壊さない。
- **`show-ref` の exit 1 は「不在」で正常**（F3）。0 以外をまとめてエラーにしない。
- **`prunable` は前方一致**（F4。`prunable stale` のような値が付く）。
- ダイアログは**ネイティブ `<dialog>` ＋ `onNativeCancel` で `preventDefault`** の形にそろえる（F8）。
- 確定の流れは `confirmNewTab` に寄せる（F8）。**`holdInput` を忘れると、
  ダイアログを閉じてから応答が返るまでの入力が落ちる**（D99）。

## design への申し送り

- **「git リポジトリか」の判定の根拠**（F7）。`Workspace.git` は 5 秒遅れるので、
  そのまま使うか、別の手段（メニューを開くたびにサーバへ聞く／`workspace.create` の応答に含める）を採るかを決める。
- **worktree の置き場所の既定値**。herdr は `~/.herdr/worktrees`。この製品での既定を決める。
- **ブランチ名の生成方式**。herdr と同じ（形容詞-名詞-hex）にするなら、
  `NOTICE` と `third_party/herdr/README.md` の帰属表示に**移植した旨を足す**必要がある
  （既に `ManifestStore` 等で同じことをしている前例がある）。
- **ダイアログ 2 つの形**。作成は `NameDialog` 型（入力 1 つ＋確定）、一覧は `GotoPicker` 型
  （`role="listbox"` ＋ キー操作）に寄せられる材料が揃っている。
- **失敗の見せ方**。`toast` で足りるか、ダイアログの中に出すか。
