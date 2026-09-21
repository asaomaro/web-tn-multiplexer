# 調査: workspace の既定の名前を、開いた場所（リポジトリ）から自動で付ける

## 調査の問い

- Q1: herdr は git の根をどう見つけ、自動の名前をどう決めるか（`.git` がファイルの worktree・submodule・bare・根のパス・ホーム）。
- Q2: 本製品で workspace の名前が決まる・変わる・保存される・復元される経路はどこか。
- Q3: 名前の変化はどうブラウザへ届くか（ほかのブラウザを含む）。
- Q4: 名前を変えるダイアログ（`NameDialog`）の確定の流れと、「変えていなければ送らない」の先例。
- Q5: 以前の版の `session.json` との互換（新しい項目を古い版が読めるか・古いファイルを新しい版が読めるか）。
- Q6: パスの末尾の名前・ホームの判定の OS ごとの挙動。
- Q7: 既存のテストは既定の名前「1」に依存しているか。E2E で git のリポジトリを作れるか。

## 判明した事実

### herdr（commit `da6bcd5969779bfe0396bcf89a8025d4375d611e`）

- F1: 自動の名前は `automatic_workspace_label(cwd, repo_root)`＝**根のフォルダ名**（`src/workspace/git/discovery.rs:66-72`）。根が無ければ
  `fallback_label_from_cwd(cwd)`＝`HOME` 環境変数と一致すれば `~`、そうでなければ cwd の末尾の名前、末尾の名前が無ければパスそのもの（`:30-43`）。
- F2: 根の見つけ方は `git_repo_root(start)`：start から親へたどり、各階層で `git_dir_for_repo_root` が返す git のディレクトリに `HEAD` という
  ファイルがあればそこが根（`discovery.rs:311-329`）。`git_dir_for_repo_root` は `.git` がディレクトリならそれ、**`.git` がファイルで `gitdir: <path>`
  なら、その path（相対なら根からの相対）**、bare の形（`HEAD`・`objects/`・`refs/` がある）ならその場所自身（`:198-220`）。**git のコマンドは使わない**
  （ファイルを読むだけ）。`.git` ディレクトリがあっても中に `HEAD` が無ければ根とみなさない（`:637-646` のテスト）。
- F3: よって linked worktree（`.git` がファイル）はその worktree の根のフォルダ名、submodule（`.git` がファイルで `gitdir: ../.git/modules/x`）は
  submodule の根のフォルダ名になる（F2 の規則から導かれる。submodule の実例のテストは未確認）。
- F4: 表示の名前は `display_name`：`custom_name` があればそれ、無ければ自動の名前（`src/workspace.rs:1023-1029`）。自動の名前の元の場所は最初の tab の
  根の pane の「いまの場所」（`:1031-1047`）。周期の git の更新で自動の名前が変わったら、`custom_name` が無いときだけ変化として扱う
  （`src/app/actions.rs:1420-1423`）。
- F5: 画面の名前変更は、workspace なら空でなければ送り（変えていなくても）、サーバは無条件に `set_custom_name`（`src/client/shell/overlay_input.rs:955`・
  `src/app/api/workspaces.rs:115`）。tab は「自動の名前のまま変えていない」なら送らない（`overlay_input.rs` の `auto_name && trimmed == original_name`）。
  自動の名前へ戻す操作は無い。worktree を開く・作る操作は `label: None`（`src/client/shell/worktrees.rs:272`・`:327`）。

### 本製品

- F6: 既定の名前「1」を入れている場所は 3 か所：`SessionService.createWorkspace` の `label ?? "1"`（`packages/server/src/session/SessionService.ts:157`）、
  起動時の `ensureNotEmpty`（`:475`）と最後を閉じた後の `recreateIfEmpty`（`:482`）の `createWorkspace(this.defaultCwd, "1")`。tab の「1」は
  `SessionModel.reserveWorkspace` の中（`SessionModel.ts:171`）で、workspace の名前とは別。
- F7: 名前を渡して作る経路は worktree を開く・作る操作だけ（`packages/web/src/actions/ActionDispatcher.ts:254-256` の `openWorkspaceAt` が
  `{ cwd, label }`。label はブランチ名、detached ならパスの末尾——`:251`）。［＋ 新規］・`prefix+N` は `{ newCwd }` だけ（`:472` の `newWorkspace`）。
- F8: 名前の変更は `workspace.rename`（`WorkspaceRenameParams`：`label: z.string().min(1)`——`packages/protocol/src/messages.ts:103`）→
  `SessionService.renameWorkspace`（`:181-185`）→ `SessionModel.renameWorkspace`（`:205`）→ `workspace.updated` を publish。pane は `label: z.string().nullable()`
  （`messages.ts:153`）で、null で自動の名前に戻る（web は `trimmed || null`——`ActionDispatcher.ts:588`）。
- F9: 保存は `toSessionFileData`（`packages/server/src/composeServer.ts:278-305`）が `Workspace` の `id`・`label`・`cwd`・`activeTabId`・`tabs` を書く。
  復元は `SessionService.restore`（`:486`）→ `SessionModel.restoreWorkspace(data)`（`SessionModel.ts:525`）が `label: data.label` をそのまま使う。
  `session.json` の検証は zod の `SessionFileWorkspaceSchema`（`packages/server/src/persist/SessionFile.ts:78-84`）で、`schema: z.literal(1)`（`:93`）。
- F10: zod は 4.x（`packages/server/package.json:24`）。`z.object` は**知らない項目を捨てて通す**（strip が既定。`SessionFile.ts` に `.strict()` は無い）。
  よって、workspace に任意の項目を足した新しい `session.json` を古い版が読んでも、その項目を捨てて読める（壊れたファイルにはならない）。
  逆に、新しい版が古いファイル（項目が無い）を読むには、足す項目を任意（`optional`）にすればよい。
- F11: git の情報は `DefaultGitInfoPoller`（`packages/server/src/git/GitInfoPoller.ts`）が 5 秒ごとに各 workspace の `ws.cwd` で
  `git rev-parse --abbrev-ref HEAD` 等を走らせ（`:47`・`:53`）、変わったときだけ `SessionService.updateWorkspaceGit`（`:419-425`）→ `workspace.updated`。
  **git のコマンドに依存**しており、根のパスは取っていない。
- F12: web は `workspace.created`・`workspace.updated` を同じく `workspaceUpserted` で受ける（`packages/web/src/store/StoreAdapter.ts:90-91`）。
  サーバのイベントはすべての接続へ配られるので、ほかのブラウザにも再読み込みなしで届く（既存の名前変更と同じ経路）。
- F13: `NameDialog`（`packages/web/src/components/NameDialog.vue`）は開いたときに今の名前を入れて全選択する（`initialValue`・`:36`・`:62-64`）。
  「変えていなければ送らない」は新しい tab だけ（`openedWithValue` と比べて空文字にする——`:27`・D75）。workspace の確定は
  `ActionDispatcher.confirmRenameWorkspace`（`:601-607`）で、**空なら何もしない**（`:606`）。ダイアログの題名は kind ごと（`title()`）。
- F14: `Workspace` の型は `id`・`label`・`cwd`・`tabIds`・`activeTabId`・`groupId`・`git`（`packages/protocol/src/model.ts:18-29`）。付けた名前かどうかを
  表す項目は無い。
- F15: Node の `path.basename("/")` と `path.win32.basename("C:\\")` は空文字、`path.basename("/home/u/repo/")` は `repo`（手元の Node で確認）。
  ホームは `os.homedir()`（Windows は `USERPROFILE`）。前の work の `newCwd.ts` も `os.homedir` を使っている。
- F16: 既存の単体テストで workspace の名前「1」を期待しているものは見つからない（`packages/server/src` のテストを grep）。E2E は
  `workspace-tab-pane.spec.ts:500` のコメント「既定の workspace も "1" なのでラベルで区別する」があるだけで、名前「1」を判定には使っていない。
  E2E のサーバはテストのプロセスの中で動き、`defaultCwd` は `process.cwd()`（`packages/e2e`）で、これは git のリポジトリの中（このリポジトリ）。
  **E2E の既定の workspace の自動の名前は `web-tn-multiplexer`（リポジトリの根のフォルダ名）になる**。E2E では一時ディレクトリで `git init` すれば
  リポジトリを作れる（`workspace-tab-pane.spec.ts` の worktree のテストに先例がある）。

## 影響範囲

- server：`SessionService`（作成の 3 経路・名前変更・復元）、`SessionModel`（`reserveWorkspace`・`renameWorkspace`・`restoreWorkspace`）、
  `composeServer.toSessionFileData`、`persist/SessionFile.ts` の型と検証、新しく名前を決める関数。
- protocol：`Workspace`（付けた名前かどうか）、`WorkspaceRenameParams`（空・null で自動に戻す）。
- web：`ActionDispatcher.confirmRenameWorkspace`、`NameDialog`（workspace のときの手掛かり・変えていなければ送らない）。表示の 9 か所は `label` を読むだけなので、
  `label` を表示の名前のまま保てば変わらない。
- E2E：既定の workspace の名前が変わる（F16）。名前を画面で見ている spec があれば影響する。

## 実現性 / リスク

- git の根はファイルを読むだけで見つかる（F2）。深い階層でも親へたどる stat が数十回程度。ネットワークのファイルシステムで遅い場合に備えて上限が要る
  （requirements の制約）。
- 自動の名前は `label` に入れたまま、付けた名前かどうかの印を別に持てば、web の表示は変えずに済む（F14・影響範囲）。
- 復元で決め直すと、起動時にすべての自動の名前の workspace の根を探す。数十の workspace でも stat の数は数百程度。

## 実装アンカー

- A1: 作成の既定の名前（`packages/server/src/session/SessionService.ts:157` `createWorkspace`・`:475` `ensureNotEmpty`・`:482` `recreateIfEmpty`）
- A2: 名前変更（`SessionService.ts:181-185` `renameWorkspace`、`packages/server/src/session/SessionModel.ts:205` `renameWorkspace`、
  `packages/server/src/surface/methods/workspace.ts:13-18`）
- A3: 復元と保存（`SessionService.ts:486` `restore`、`SessionModel.ts:525` `restoreWorkspace`、`packages/server/src/composeServer.ts:278-305`
  `toSessionFileData`、`packages/server/src/persist/SessionFile.ts:26-32` `SessionFileWorkspace`・`:78-84` `SessionFileWorkspaceSchema`）
- A4: protocol（`packages/protocol/src/model.ts:18-29` `Workspace`、`packages/protocol/src/messages.ts:103` `WorkspaceRenameParams`）
- A5: web の名前変更（`packages/web/src/actions/ActionDispatcher.ts:601-607` `confirmRenameWorkspace`、`packages/web/src/components/NameDialog.vue`
  `initialValue`・`title`・確定の分岐 `:52-58`）
- A6: 前の work の場所の関数の置き場の先例（`packages/server/src/session/newCwd.ts`——`isUsableDir`・`makeNewCwdDeps` と同じく、fs に触る部分を
  依存として差し替えられる形）
- A7: E2E の git のリポジトリの作り方（`packages/e2e/src/specs/workspace-tab-pane.spec.ts:480` の `git init -q -b main`・`:383-387`）

## 実装時の注意

- `label` を空にする（null にする）と、表示の 9 か所がすべて空になる。**`label` は常に表示の名前**を入れておく。
- 作成の応答に名前を載せる要件なので、名前を決めるのは `reserveWorkspace` の前（`createWorkspace` の中で `await`）。前の work で見つけたとおり、
  `createWorkspace` の中で余計な `await` を挟むと既存のテストの起動の順序が崩れることがある（前の work の `placeFor` の注記）。
- 復元（`restoreWorkspace`）は同期で呼ばれている（`SessionService.ts:489`）。決め直しを非同期にするなら、`restore` の中で先に決めてから渡す。
- `.git` のファイルの `gitdir:` は相対パスのことがある（worktree は絶対、submodule は相対が多い）。
- E2E の既定の workspace の名前が「1」から `web-tn-multiplexer` に変わる。ブラウザのタブの題名（`main.ts:243`）も変わる。題名を判定している spec が
  無いか、coding で確かめる（smoke は label `"smoke"` を明示して作る——`packages/server/src/smoke.ts:203`——ので、付けた名前のまま変わらない）。

## design への申し送り

- 付けた名前かどうかの印の持ち方（`Workspace` に `labelIsAuto`/`customLabel` 等を足し、`session.json` にも任意の項目として足す）。古いファイルは
  「1」なら自動、それ以外は付けた名前（requirements）。
- 自動に戻す要求の形（`WorkspaceRenameParams.label` を nullable にするか、別の方式にするか。pane の先例は null）。
- 名前を決める関数の形（F1〜F2 の herdr の規則を移す。fs を依存にして単体で総当たり。待ちの上限）。
- `NameDialog` の workspace のときの手掛かりの文と、「変えていなければ送らない」（自動の名前のときだけ。付けた名前を同じ名前で確定するのは何も起きない
  ので、どちらでも同じ）。
- 同じ名前の workspace を見分ける手当てはしない（requirements の対象外）。
