# 仕様: workspace のメニューから Git worktree を作る・開く

## 概要

3 つの層すべてに機能を足す。**サーバに worktree の一覧と作成を置き、web はそれを呼ぶだけ**にする。

- protocol: `worktree.list` / `worktree.create` の 2 メソッドと、一覧の要素の型。
- server: `git worktree list --porcelain` の解析と `git worktree add` の実行。
- web: メニューの 2 項目、ダイアログ 2 つ、`prefix+G`。

**「worktree を開く」に専用のメソッドは作らない**——それは「その cwd で `workspace.create` する」だけで、
既にある機能そのものだから（研究 F: `SessionService.createWorkspace(cwd, label)`）。

## 設計方針

1. **「git リポジトリか」はメニューを開くたびにサーバへ聞かない**。`Workspace.git` を使う
   （`GitInfoPoller` が埋める）。**5 秒遅れる**（research F7）が、その代わり
   **メニューを開く操作が同期のまま**になる。聞きに行く形にすると、右クリックしてから項目が出るまで
   待たされるか、出た後に項目が増える（どちらも操作として悪い）。
   - **遅れの影響を `prefix+G` で埋める**。キーは `Workspace.git` を見ないで常に効かせ、
     git でなければ**サーバが `not_a_git_repository` を返して toast に出る**。
     つまり「メニューに出ない間もキーからは始められ、git でなければ理由が出る」。
2. **worktree の作成先とブランチ名の生成は herdr と同じ規則にする**（research F1・F2）。
   利用者が herdr から移ってきたときに**同じ場所に同じ名前で作られる**ほうが分かりやすい。
   移植になるので `NOTICE` と `third_party/herdr/README.md` に 1 行足す（既存の `ManifestStore` 等と同じ扱い）。
   ただし置き場所の根は **`~/.wtm/worktrees`**（この製品の名前）にする。
3. **git の失敗は「分類したコード」で返し、文言は web 側で日本語にする**。
   この PJ には既に規約がある——**サーバの `message` は利用者に見せず、`code` で引いて日本語にする**
   （`packages/web/src/net/clientError.ts` の D107。「以前はサーバの英語の固定文をそのまま toast に出していた」）。
   生の stderr を出すのはこの規約に反する。**herdr も英語の診断を分類している**（`LC_ALL=C` を付ける理由がそれ）ので、
   同じ形にする: サーバが stderr を見て `worktree_branch_in_use` / `worktree_path_exists` /
   `not_a_git_repository` / `worktree_failed` のどれかに分類し、**生の stderr はサーバのログにだけ残す**。
   - **`ErrorCode` は閉じた union**（`packages/protocol/src/errors.ts:2`）なので、**4 つとも足す必要がある**。
   - **stderr の先頭 1 行を使ってはいけない**——`git worktree add` は失敗時も 1 行目が
     `Preparing worktree (...)` という進行の表示で、理由（`fatal: …`）は 2 行目に出る（点検が実機で確認）。
     分類にもログにも**`fatal:` / `error:` で始まる行**を使う。
4. **ダイアログは既存の 2 つの形に寄せる**（research F8）。作成は `NameDialog` 型（入力 1 つ＋確定）、
   一覧は `GotoPicker` 型（`role="listbox"` ＋ ↑↓）。
   ただし**既存の部品を改造せず、新しい component を 2 つ作る**——`NameDialog` は
   「1 行の入力で名前を決める」4 種類のために作られており、パスのプレビューや一覧を足すと責務が混ざる。

## 対象範囲

| ファイル | 変更 |
|---|---|
| `packages/protocol/src/messages.ts` | `WorktreeListParams/Result`・`WorktreeCreateParams/Result`、`METHOD_SCHEMAS` と `MethodResultMap` に 2 行ずつ（A1） |
| `packages/protocol/src/model.ts` | `WorktreeEntry`（一覧の要素） |
| `packages/protocol/src/errors.ts` | `ErrorCode` に 4 つ足す（閉じた union なので必須） |
| `packages/protocol/src/worktreePath.ts` | **新規**。`branchToPathSlug` / `defaultCheckoutPath`（server と web が共用する純粋関数） |
| `packages/web/src/net/clientError.ts` | 足した `ErrorCode` の日本語（`Record<ErrorCode, string>` なので**足さないと型が落ちる**） |
| `packages/server/src/surface/methods/index.test.ts` | `MethodDeps` をリテラルで組んでいる（`:109`）ので `worktrees` を足す |
| `packages/server/src/ws/WsGateway.integration.test.ts` | 同上（`:113`） |
| `packages/server/src/infra/GitRunner.ts` | 戻り値に `stderr` を足す（A3） |
| `packages/server/src/git/worktree.ts` | **新規**。名前の生成・パスの組み立て・porcelain の解析（純粋関数） |
| `packages/server/src/git/WorktreeService.ts` | **新規**。`list` と `create`（`GitRunner` を使う） |
| `packages/server/src/surface/methods/worktree.ts` | **新規**。2 つの方式を登録（A5・A6） |
| `packages/server/src/surface/methods/deps.ts` | `MethodDeps` に `worktrees` を足す |
| `packages/server/src/surface/methods/index.ts` | `registerWorktreeMethods` を呼ぶ |
| `packages/server/src/composeServer.ts` | `WorktreeService` を組み立てて `MethodDeps` へ（A7） |
| `packages/web/src/store/view.ts` | `DialogContext` に 2 種類（A9） |
| `packages/web/src/components/ContextMenu.vue` | workspace の分岐に 2 項目（A13） |
| `packages/web/src/components/WorktreeCreateDialog.vue` | **新規**（A10 の形） |
| `packages/web/src/components/WorktreeOpenDialog.vue` | **新規**（A11 の形） |
| `packages/web/src/App.vue` | 2 つのダイアログを置く |
| `packages/web/src/actions/ActionDispatcher.ts` | 開く・確定の 4 メソッド（A12 の形） |
| `packages/web/src/keys/actions.ts`・`keymap.ts` | `newWorktree` を足し、`NOT_YET` の `G` を置き換える（A14） |
| `NOTICE`・`third_party/herdr/README.md` | 移植した旨を 1 行 |
| 各テスト・E2E | 下記「テストの置き方」 |

## 依拠する既存の事実

- `METHOD_SCHEMAS`（`messages.ts:155-180`）と `MethodResultMap`（`:184-209`）は**両方直す必要がある**
  （片方だけだと型が落ちる。research F5）。
- `ControlSurface.invoke`（`ControlSurface.ts:31-50`）は **`RpcError` だけを利用者へ透過**させ、
  他の例外は `internal` に丸める（research F6）。
- `MethodDeps`（`methods/deps.ts:7-12`）に git 関係は無い。`composeServer.ts:140` で
  `ChildProcessGitRunner` が作られ `:150-153` で `MethodDeps` が組まれる（research F6）。
- `GitRunner.run` は `spawn("git", args, { cwd })` で**シェルを介さない**。
  `stdio` の 3 番目が `"ignore"` で**stderr を捨てている**（`GitRunner.ts:11`）。
- `Workspace.git` は `branch` / `ahead` / `behind` だけで、**5000ms 周期**（`GitInfoPoller.ts:5`）。
  `rev-parse` が 0 以外なら null（`:51-70`）。
- `DialogContext` は union（`store/view.ts:74-81`）。`openDialogWithContext` が焦点を退避し、
  `closeDialog` が戻す（`:159-163`・`:174-180`）。
- 既存のダイアログはネイティブ `<dialog>` で、Esc は `cancel` を `preventDefault` して自前で閉じる
  （`NameDialog.vue:55-70`・`GotoPicker.vue:175-201`）。
- 確定の手本は `ActionDispatcher.confirmNewTab`（`:144-161`）。**`holdInput`（D99）を挟む**。
- `SessionService.createWorkspace(cwd, label)`（`SessionService.ts:121`）が cwd を受ける。
- `keymap.ts:13-19` の `NOT_YET` に `["G", { type: "notYet", work: "グルーピング" }]` がある。
- 既存の git のテストは**本物の git を使う**（`GitInfoPoller.test.ts:14,51,87`。フェイクは無い）。

## インターフェース / データ構造

### protocol

```ts
/** `git worktree list --porcelain` の 1 エントリ（bare と prunable は**サーバ側で落とす**）。 */
export interface WorktreeEntry {
  path: string;
  branch: string | null;   // detached なら null
}

export const WorktreeListParams = z.object({ workspaceId: z.string() });
export interface WorktreeListResult {
  /** 作成先の根。ダイアログのパスのプレビューに使う。 */
  worktreeRoot: string;
  /** リポジトリの名前（作成先の 2 段目）。 */
  repoName: string;
  /** 自動生成したブランチ名の候補。 */
  suggestedBranch: string;
  entries: WorktreeEntry[];
}

export const WorktreeCreateParams = z.object({ workspaceId: z.string(), branch: z.string().min(1) });
export interface WorktreeCreateResult { path: string }
```

- **`worktree.list` が「開く」と「作る」の両方の入口**になる（herdr と同じ。research の herdr の項）。
  作るときも先に呼ぶのは、**パスのプレビューに `worktreeRoot` と `repoName` が要る**から。
- `worktree.create` は**作るだけ**で workspace は開かない。開くのは web が続けて
  `workspace.create({ cwd: path })` を呼ぶ（設計方針の「専用メソッドを作らない」）。

### server: `git/worktree.ts`（純粋関数。単体テストしやすい形）

```ts
export function generatedBranchSlug(seed: number): string;   // research F1 と同じ規則
export function parseWorktreeListPorcelain(stdout: string): WorktreeEntry[]; // bare/prunable を落とす
export function repoNameFromGitCommonDir(absCommonDir: string): string;
```

**`branchToPathSlug` と `defaultCheckoutPath` はここには置かず `@wtm/protocol` に置く**
（`packages/protocol/src/worktreePath.ts`）。web も同じ規則でパスのプレビューを出すので、
2 箇所に書くと必ずずれる。**protocol は `node:*` を一切 import していない**
（`package.json` の依存は zod だけ。`grep "node:" packages/protocol/src` は 0 件）ので、
`path.join` は使わず**`/` で連結する**。`worktreeRoot` はサーバが送る時点で `/` 区切りに正規化しておく。

**`repoNameFromGitCommonDir` に渡すのは絶対パス**。`git rev-parse --git-common-dir` は
**リポジトリの直下で実行すると相対の `.git` を返す**（点検が実機で確認）ので、
そのまま親のディレクトリ名を取ると `.` になる。`--path-format=absolute` を付けるか、
`path.resolve(cwd, commonDir)` で絶対化してから渡す。

- **`worktreeRoot` は `~/.wtm/worktrees`**（`os.homedir()` で組み立てる）。
- **`repoName`** は `git rev-parse --git-common-dir` の結果から取る
  （末尾が `.git` ならその親のディレクトリ名、そうでなければそのディレクトリ名。取れなければ `"repo"`）。

### server: `git/WorktreeService.ts`

```ts
export interface WorktreeService {
  list(workspaceId: string): Promise<WorktreeListResult>;
  create(workspaceId: string, branch: string): Promise<WorktreeCreateResult>;
}
```

- workspace の cwd は `SessionService.getWorkspace(id)`（`SessionService.ts:90-91`）から引く。
  **`undefined` のときは `RpcError("not_found", …)`**——`WorktreeService` は `SessionService` の外なので、
  既存メソッドが使う private な `requireWorkspace`（`NotFoundError` を投げる）には乗れない。
- `list`: `git rev-parse --git-common-dir` → 失敗なら `RpcError("not_a_git_repository", …)`。
  続けて `git worktree list --porcelain`。
- `create`:
  1. `git show-ref --verify --quiet refs/heads/<branch>` で**存在を確かめる**
     （**exit 1 は「無い」で正常**。research F3）。
  2. 無ければ `git worktree add -b <branch> <path> HEAD`、あれば `git worktree add <path> <branch>`。
  3. 失敗したら **stderr の先頭 1 行**を載せて `RpcError("worktree_failed", …)`。
- **すべての実行で `LC_ALL=C` を付ける**（research F3）。

### server: `GitRunner` の変更

```ts
run(cwd, args, timeoutMs): Promise<{ code: number; stdout: string; stderr: string }>;
```

`stdio` の 3 番目を `"pipe"` にして溜める。**`GitInfoPoller` は `stderr` を読まないので無変更**（AC10）。
`LC_ALL=C` は `spawn` の `env` に足す（`{ ...process.env, LC_ALL: "C" }`）。

### web: `DialogContext` に 2 種類

```ts
| { kind: "worktreeCreate"; workspaceId: string; info: WorktreeListResult }
| { kind: "worktreeOpen"; workspaceId: string; entries: WorktreeEntry[] }
```

**サーバへ聞いてから開く**（herdr と同じ）ので、開く時点で中身が揃っている。

## 振る舞いの詳細

### メニューの出し分け（AC8）

`ContextMenu.vue` の workspace の分岐で `session.workspaces.get(id)?.git` を見る。
非 null（＝git リポジトリ）のときだけ 2 項目を足す。

```
git が null  → 名前の変更 / 閉じる
git がある   → 名前の変更 / 閉じる / 新しい worktree / worktree を開く…
```

**5 秒の遅れは受け入れる**（設計方針 1）。`prefix+G` は `git` を見ないので、その間も始められる。

### 新しい worktree（AC1〜AC3・AC7）

1. `actions.newWorktree(workspaceId)` が `worktree.list` を呼ぶ。
   失敗（git でない等）は `toast` に理由を出して終わり。
2. 応答を `DialogContext` に載せてダイアログを開く。
   入力欄の初期値は `suggestedBranch`、**全選択**（`NameDialog` と同じ）。
3. 入力が変わるたび、`defaultCheckoutPath(worktreeRoot, repoName, branch)` を**ブラウザ側で**組み立てて見せる
   （サーバと同じ関数が要るので、**`branchToPathSlug` と `defaultCheckoutPath` は `@wtm/protocol` に置く**
   ——server と web の両方から使うため。規則を 2 箇所に書くと必ずずれる）。
4. 確定で `worktree.create` → 成功したら `workspace.create({ cwd: result.path })` →
   `setView` / `focusPane`（`confirmNewTab` と同じ形。`holdInput` も同じ）。
5. 失敗は **`code` から日本語を引いて** `toast` に出す（`clientErrorMessage` と同じ表。設計方針 3・decisions.md D2）。
   **`RpcError` の `message` は使わない**（D107）。既存の `.catch` は固定文言だが、
   ここは**ケースごとに違う理由を出すのが AC7 の要求**なので、`err.code` を見る形にする
   （`Connection` が投げるエラーから `code` を取れることを実装時に確かめる）。

### worktree を開く（AC4〜AC6）

1. `actions.openWorktree(workspaceId)` が `worktree.list` を呼ぶ。
2. `entries` が空なら**ダイアログを開かず** `toast`（「この repo に worktree はありません」）。
3. そうでなければ一覧のダイアログ。↑↓ で選び Enter で確定。
4. 確定したら、**まず `session.workspaces` の中に同じ cwd の workspace が無いか探す**。
   - あれば `setView` でそこへ移る（`workspace.create` を呼ばない。AC6）。
   - 無ければ `workspace.create({ cwd: entry.path })`。

### `prefix+G`

`keymap.ts` の `NOT_YET` から `G` を外し、`["G", { type: "newWorktree" }]` を `// workspace` の並びへ。
`actions.ts` の `Action` に `{ type: "newWorktree" }` を足し、`ActionDispatcher.run` の
`case "newWorktree"` が `view.workspaceId` を確かめて `newWorktree(id)` を呼ぶ。

## エラー処理 / 異常系

- **git リポジトリでない** → `worktree.list` が `RpcError("not_a_git_repository")`。
  メニューからは出ない（AC8）が、`prefix+G` からは toast で理由が出る。
- **同じブランチが既にチェックアウト済み** → stderr に `fatal: '<branch>' is already used by worktree at …`
  → `worktree_branch_in_use`。web は「そのブランチは既に別の場所で使われています」。
- **作成先のパスが既に存在** → stderr に `fatal: '<path>' already exists` → `worktree_path_exists`。
  web は「作成先のパスが既にあります」。
- **それ以外の失敗** → `worktree_failed`。web は「worktree を作成できませんでした（サーバのログを確かめてください）」。
  **生の stderr はサーバのログにだけ残す**（D107）。
- **ブランチ名が空** → `z.string().min(1)` でサーバが `invalid_params`。
  web 側もボタンを `disabled` にして送らない。
- **一覧が空** → ダイアログを開かず toast（AC5）。
- **worktree の workspace を閉じる** → 既存の `workspace.close` のまま。
  **ディスクには触れない**（AC9）。この work で `git worktree remove` は一切呼ばない。
- **`git` コマンドが無い / 時間切れ** → `GitRunner` が reject。`RpcError` に包んで toast。

## ドメイン固有の考慮

- **`git` の引数は配列**（`GitRunner` の既存の形）。ブランチ名は利用者が自由に入力するので、
  文字列に組み立ててシェルへ渡さない。
- **`LC_ALL=C`**（research F3）。エラーの分類を英語の診断に頼る前提を壊さない。
- **`~/.wtm/worktrees` の外には作らない**。`branchToPathSlug` が `/` や `..` を `-` に畳むので、
  入力で親ディレクトリへ抜けられない（research F2）。

## 受け入れ基準との対応

- AC1: `ContextMenu.vue` の workspace の分岐に「新しい worktree」。押すと `worktree.list` →
  ダイアログ。入力の初期値は `suggestedBranch`（サーバが `generatedBranchSlug` で作る）。
  入力の出所は `worktree.list` の応答。判定は単体テスト（メニューの項目・ダイアログの初期値）。
- AC2: ダイアログが `defaultCheckoutPath(worktreeRoot, repoName, branch)` を表示する。
  入力の出所は `worktree.list` の `worktreeRoot` / `repoName` と入力欄。判定は単体テスト。
- AC3: 確定で `worktree.create` → `workspace.create({ cwd })` → `setView` / `focusPane`。
  空なら送らない。判定は単体テスト（送る引数）＋ E2E（実際に worktree ができて workspace が増える）。
- AC4: `worktree.list` の `entries`。**bare と prunable はサーバの `parseWorktreeListPorcelain` で落とす**。
  判定はサーバの単体テスト（porcelain の文字列を食わせる）＋ E2E。
- AC5: 一覧から選ぶと `workspace.create({ cwd })`。空なら toast。判定は単体テスト＋ E2E。
- AC6: 確定の前に同じ cwd の workspace を探し、あれば `setView` だけ。判定は単体テスト。
- AC7: `WorktreeService.create` が stderr の `fatal:` の行を見て**コードに分類**し、
  web が `clientErrorMessage` 相当で日本語にする。入力の出所は git の stderr（`LC_ALL=C` で英語に固定）。
  判定はサーバの単体テスト（本物の git で、同じブランチを 2 回 add／既存パスへ add して
  **それぞれ別のコードになる**ことを確かめる）＋ web の単体テスト（コード → 文言）。
- AC8: `ContextMenu.vue` が `workspace.git` の非 null を見る。判定は単体テスト（git あり／なしの 2 ケース）。
- AC9: この work で `git worktree remove` を呼ばない。`workspace.close` に触れない。
  判定は単体テスト（`closeWorkspace` の経路に git の呼び出しが無いこと）＋ E2E（閉じた後もパスが残る）。
- AC10: `GitRunner` の戻り値を増やすだけで `GitInfoPoller` は無変更。
  判定は既存の `GitInfoPoller.test.ts` が通ること。
- AC11: 既存の単体テストと既定の E2E が通る。
- AC-I1: ダイアログはネイティブ `<dialog>` で、`cancel` を `preventDefault` して `closeDialog()`。
  閉じた時点で `worktree.create` は呼ばれていない（確定でしか呼ばない）。判定は単体テスト。
- AC-I2: 作成は `<form method="dialog" @submit.prevent>` で Enter 確定（`NameDialog` と同じ）。
  一覧は Enter とクリック。Esc で何も起きない。判定は単体テスト。
- AC-I3: `prefix+G` で作成を始められる。ダイアログは 2 つともキーで完結（一覧は ↑↓）。
  判定は E2E（キーだけで worktree を作る）。
- AC-I4: `openDialogWithContext` / `closeDialog` が焦点を退避・復元する（既存の仕組み）。
  判定は既存 E2E と同じ形の確認。
- AC-I5: ダイアログの中のキーを端末へ流さない（ネイティブ `<dialog>` のモーダルなので既定で届かない）。
  メニューの既存 2 項目の位置と動作を変えない。判定は既存テストの通過。

## テストの置き方

- **純粋関数（`git/worktree.ts` と `protocol/worktreePath.ts`）**: 単体テストで規則そのものを固定する。
  herdr のテストの実値をそのまま期待値に使える（research F1・F2 に逐語で写してある）。
  porcelain の解析は**文字列を食わせる**ので git は要らない。
- **`WorktreeService`**: 既存の `GitInfoPoller.test.ts` と同じく**本物の git を使う**
  （フェイクは無い。research F9）。一時ディレクトリにリポジトリを作り、
  作成の成功・**同じブランチで 2 回**・**既存パスへ**の 3 ケースで**コードが分かれる**ことを確かめる。
- **web**: メニューの出し分け（git あり／なし）、ダイアログの初期値とパスのプレビュー、
  確定で送る引数、既に開いている worktree を選んだときに `workspace.create` を**呼ばない**こと。
- **E2E**: 使い捨てのリポジトリ（先行 work の `makeAheadRepo` と同じ形）を作り、その cwd で
  `workspace.create` してから、**キーだけで**（`prefix+G`）worktree を作って workspace が増えることを確かめる。
  **このリポジトリ自身に対して worktree を作らない**（requirements の非機能要件）。
- **負の対照**（条項）: 新しいテストは、実装を壊すと落ちることを確かめる。
  新機能なので「実装前は要素が無くて落ちる」だけでは弱い——**振る舞いを壊して**確かめる
  （分類を 1 つに潰す／既に開いている判定を外す／`branchToPathSlug` の畳み込みを外す）。
- **E2E は 1 本ずつ走らせる**（同時に走らせると資源の取り合いで無関係な spec が落ちる。先行 work の実測）。

## backlog へ送るもの（deliver で起票）

1. **worktree の削除**（herdr の `Delete worktree checkout...`）。作れるのに消せない。
   取り返しがつかない操作なので、確認の設計と合わせて別 work で。
2. **workspace のメニューをキーボードから開けない**。`Sidebar.vue` の行に `tabindex` も `keydown` も無く、
   pane の枠（`PaneFrame.vue`）だけが対応済み。この work は `prefix+G` で迂回したが、
   「worktree を開く…」や既存の「名前の変更」「閉じる」はメニュー経由の手段がマウスだけのまま。
3. **worktree の置き場所を選べるようにする**。いまは `~/.wtm/worktrees` 固定。
   herdr は設定ファイルの `[worktrees] directory`。この製品に設定ファイルが無いので「外観と設定」と同時に。
4. **`Workspace.git` の遅れ**。5 秒周期なので、workspace を作った直後はメニューに worktree の項目が出ない。
   `workspace.create` の応答に含めるか、作成直後に 1 回だけ即時に取る等の手当て。
