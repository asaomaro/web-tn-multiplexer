# 仕様: workspace のグルーピングと並べ替え

## 概要

worktree 自動グループ（Git の共通ディレクトリで動的に求める。永続化しない）・手動グループ
（`Workspace.groupId` を実際に使う新しいデータ構造。永続化する）・workspace の並べ替え
（D&D 主・キーバインド併用。新規 protocol メソッド）の3つを実装する。Sidebar.vue のフラットな
一覧を、グループ構造を持つ描画へ拡張する。

実装後は、同じリポジトリの worktree が自動的に束ねられて見分けやすくなり、利用者が任意の
workspace を名前付きグループへ自由にまとめられ、workspace の並び順を D&D・キーボードのどちらでも
（グループはまとまりを保ったまま）変えられ、worktree 本体を閉じる際に束ねた worktree も一括で
片付けられる状態になる（requirements.md「目的 / ゴール」に対応）。

## 設計方針

- **worktree 自動グループは動的に求め、一切永続化しない**（herdr と同じ。research.md F2・F3）。
  `GitInfoPoller`（5秒周期。`packages/server/src/git/GitInfoPoller.ts`）が workspace ごとに
  git 情報を取る既存の仕組みに、Git 共通ディレクトリのパス（`git rev-parse --git-common-dir` の
  正規化パス）も一緒に取らせ、`GitInfo` に `repoKey: string | null` として追加する。**同じ
  `repoKey` を持つ workspace が2つ以上あるときだけ**、クライアント側（`Sidebar.vue`）で
  グループとして表示する（`repoKey` そのものが「グループの実体」で、サーバ側に別のデータ構造は
  持たない）。
- **手動グループは新しいデータ構造として永続化する**。`WorkspaceGroup { id, label }` を
  `packages/protocol/src/model.ts` に新設し、`SessionModel` が保持・`session.json` へ保存する。
  `Workspace.groupId`（既に予約済み。`packages/protocol/src/model.ts:26`）が実際に使われる
  ようになる——`groupId !== null` の workspace は、その `WorkspaceGroup` のメンバー。
- **`packages/server/src/git/worktree.ts` の既存の公開関数 `resolveCommonDir`（`cwd` と
  `--git-common-dir` の生出力から絶対パスを解決する純関数。`WorktreeService.repoNameOf` が既に
  使っている）をそのまま `GitInfoPoller` からも呼ぶ**（研究時点では private だと誤認していたが、
  直接確認したところ `export` 済みの純関数だった——新しい共有モジュールを作る必要は無い）。
  `GitInfoPoller.probe` が `git rev-parse --git-common-dir`（`repoKey` 用）・`git rev-parse
  --git-dir`（`isLinkedWorktree` 判定用。両者を比較）を実行し、`resolveCommonDir` で絶対化する。
- **手動グループと worktree 自動グループが重なったときは、手動グループを優先する**（決定。
  requirements「未確定事項」への回答。decisions.md D2）。`groupId !== null`（手動グループに
  入っている）workspace は、`repoKey` が同じ workspace が他にあっても worktree 自動グループには
  含めない——手動グループの下にだけ表示する。**理由**: 2つの階層構造を同時に描画する UI は複雑に
  なりすぎる。利用者が worktree を手動グループへ入れれば、それは「worktree の自動束ねより自分の
  整理を優先したい」という明示的な意思表示として扱える。
- **`workspace.move`（キーバインド用。delta 指定）と `workspace.move_to`（D&D 用。anchor 指定・
  複数 ID 対応）の2つの protocol メソッドを新設する**（決定。requirements「未確定事項」への回答。
  decisions.md D3）。`workspace.move_to` が複数の workspace ID を受け取れることで、単一
  workspace のドラッグ（1件の配列）とグループの一括移動（メンバー全員の配列。herdr の
  `WorkspaceMoveBlockParams` 相当。research.md F4）の両方を同じメソッドで表現する——2つの別々の
  メソッドを持たずに済む。
- **「開いた順」はミュータブルな並び順そのものになる**（決定。requirements「未確定事項」への
  回答）。`tab.move`（`20260923-missing-keybinding-actions`）で `Workspace.tabIds: string[]` が
  「保存された順＝操作対象の順」という扱いになったのと同じ考え方を、workspace 全体の並びにも
  適用する——「開いた順」は「サーバに保存されている実際の順序」を指すようになり、
  `workspace.move`/`workspace.move_to` で変えられる。「名前順」はグループ構造の**外側**（グループ
  同士の並び・グループに属さない workspace の並び）だけをアルファベット順に並べ替え、**グループの
  中の並び順には適用しない**（グループ内の並びは常に「開いた順」——グループというまとまり自体が
  利用者の意図的な整理なので、中身を勝手に並べ替えない）。
- **`SessionModel.workspaces`（`Map<WorkspaceId, Workspace>`）はそのまま使う**。並べ替えは
  `[...map.entries()]` を並べ替えてから `new Map(...)` で作り直す方式にする（`tabIds` の splice と
  同じ考え方を、Map の反復順に対して適用する）。新しいフィールド（`workspaceOrder` 配列等）は
  追加しない——Map の反復順（挿入順）がそのまま「開いた順」を表す、という既存の前提
  （`Sidebar.vue`・`orderedWorkspaceIds` が既に依拠している）を崩さない。

### 検討した代替案

- **worktree 自動グループもサーバ側に永続化する**（`groupId` を worktree グループにも使う）:
  検討したが、herdr は完全に動的（サーバ側の実体を持たない。research.md F2）で、動的な方が
  「利用者が git 上で worktree を作った・消した」という外部の変化に自動追従できる（永続化すると
  同期を取り続ける必要が生まれる）。手動グループだけ永続化する非対称な設計のほうが、それぞれの
  性質（自動 vs 意図的な整理）に合っている。
- **手動グループと worktree 自動グループを両方同時に表示する**（1つの workspace が二重に
  グループ化されうる）: 検討したが、herdr に前例が無くゼロから設計する必要があり、UI が
  複雑になりすぎる（入れ子の入れ子、どちらのグループがどちらに優先するかの視覚的な表現）。
  「手動グループが優先」という単純な規則のほうが、実装も利用者の理解も単純になる。
- **`workspace.move` 1本に絞り、`insert_index` 方式（herdr そのもの）にする**: 検討したが、
  `tab.move` が既に `{id, direction}` という delta 方式を確立しており、キーバインドには
  この形が自然に馴染む。D&D には anchor 方式（`move_to`）が自然に馴染む。両方の操作方法を
  自然な形で提供するには、2つのメソッドに分けるほうが無理がない。

## 対象範囲

- `packages/protocol/src/model.ts`：`WorkspaceGroup` 型の新設。`GitInfo` に `repoKey`・
  `isLinkedWorktree` を追加。`AgentIntegrationKind` 等と同様、`Workspace.groupId` は既存のまま
  （型は変えない）。
- `packages/protocol/src/messages.ts`：`workspace.move`・`workspace.move_to`・グループの
  作成/名前変更/削除/追加/削除（membership）の新規メソッド。
- `packages/server/src/git/GitInfoPoller.ts`：`repoKey`・`isLinkedWorktree` を取得して `GitInfo`
  に含める（既存の `packages/server/src/git/worktree.ts` の `resolveCommonDir` を再利用。新規の
  共有モジュールは不要——`WorktreeService.ts` は変更しない）。
- `packages/server/src/session/SessionModel.ts`：`WorkspaceGroup` の保持・`moveWorkspace`/
  `moveWorkspacesTo`・グループの作成/名前変更/削除/メンバー追加・削除・`closeWorkspace` の
  `closeLinkedWorktrees` オプション。
- `packages/server/src/session/SessionService.ts`：上記の RPC 化・イベント配信。
- `packages/server/src/persist/SessionFile.ts`：`groups: SessionFileGroup[]`（型は
  「インターフェース / データ構造」節で定義）・`SessionFileWorkspace.groupId` の追加（schema は
  据え置き。`autoLabel`・`agentSession` と同じ「optional 追加」方式）。
- `packages/web/src/components/Sidebar.vue`：グループ構造を持つ描画・D&D（個別・グループ一括）。
- `packages/web/src/components/ContextMenu.vue`：workspace メニューへグループ関連の項目を追加。
  グループのヘッダー行専用の右クリックメニュー（新設）も追加する。
- 新規ダイアログ（グループの作成・グループへ追加の選択）。
- `packages/web/src/keys/bindings.ts`・`ActionDispatcher.ts`：`move_workspace_previous`/
  `move_workspace_next` の新規 `ActionId`。`ActionDispatcher` に D&D 確定用の
  `moveWorkspacesByDrag(workspaceIds, beforeWorkspaceId)` を新設（`workspace.move_to` を送る）。
- `packages/web/src/store/view.ts`：workspace の D&D 状態（`paneDrag` と同じ形）。worktree 自動
  グループの折りたたみ状態を持つ `collapsedAutoGroups: Set<string>`（`repoKey` の集合）も追加する。
- `docs/herdr-parity.md`：H04・H37・H37b の更新。

## 依拠する既存の事実

- `packages/protocol/src/model.ts:26`：`Workspace.groupId: string | null` が既に予約されている
  （コメント「後続『workspace のグルーピング』用に予約。MVP では常に null」）。
- `packages/server/src/session/SessionModel.ts:186,589`：`groupId` を常に `null` に設定している
  唯一の2箇所（他に代入する箇所は無い）。
- `packages/server/src/git/WorktreeService.ts:74-87`（`repoNameOf`）と
  `packages/server/src/git/worktree.ts:72-82`（`repoNameFromGitCommonDir`・`resolveCommonDir`）：
  `git rev-parse --git-common-dir` の生出力を `resolveCommonDir(cwd, stdout)`
  （**既に `export` 済みの純関数**）で絶対パスへ解決し、`repoNameFromGitCommonDir` でリポジトリ名を
  取り出す。`resolveCommonDir` 自体は絶対パスを返すので、`GitInfoPoller` から直接呼べる。
- `packages/server/src/git/GitInfoPoller.ts:46-70`（`pollWorkspace`/`probe`）：workspace ごとに
  5秒周期で git 情報（`branch`・`ahead`・`behind`）を取り、`session.updateWorkspaceGit(ws.id, git)`
  で反映する既存の仕組み。`repoKey` もここで一緒に取得するのが自然（同じ cwd に対して git を
  もう1回余分に走らせずに済む）。
- `packages/server/src/session/SessionModel.ts:75`（`workspaces = new Map<WorkspaceId,
  Workspace>()`）：Map の反復順（挿入順）が既存の「開いた順」の実体（`listWorkspaces()`
  経由で `Sidebar.vue`・`orderedWorkspaceIds` が依拠）。
- `packages/server/src/session/SessionModel.ts:341`（`moveTab`）：`tabIds: string[]` を
  `splice` の remove→insert で並べ替える既存の実装（`20260923-missing-keybinding-actions`
  decisions D10）。境界（先頭/末尾）の巡回を含む同じロジックを `workspace.move` にも適用する。
- `packages/web/src/components/PaneFrame.vue:78-134`（`onNamePointerDown`/`onNamePointerMove`/
  `onNamePointerUp`）：`20260923-pane-name-dnd-swap` で確立したポインタドラッグの流儀
  （6px の閾値・`setPointerCapture`・`document.elementFromPoint` によるドロップ先判定・Esc での
  取り消し）。`packages/web/src/store/view.ts:194,306-317`（`paneDrag`/`startPaneDrag`/
  `setPaneDragOver`/`endPaneDrag`）が対応する状態管理。workspace の D&D もこの形をそのまま踏襲する。
- `packages/web/src/components/ContextMenu.vue:71-86`：workspace の右クリックメニューの
  既存項目（名前の変更・閉じる・新しい worktree・worktree を開く…）。グループ関連の項目は
  この分岐に追加する。
- `packages/web/src/components/WorktreeOpenDialog.vue:22,27`・`packages/web/src/store/view.ts:164`
  （`{kind:"worktreeOpen", workspaceId, entries}`）：サーバから一覧を取ってから選択式のダイアログを
  開く既存パターン。「グループへ追加」の選択ダイアログもこの形を踏襲する。
- `packages/web/src/actions/ActionDispatcher.ts:536-538`（`closeWorkspaceById`）：常に
  `confirmClose` ダイアログを開く（busy 以外でも確認する。既存のコメント「herdr は worktree
  グループ経由でも busy 以外の追加確認をするが、本製品はグルーピングが対象外」は**本 work で
  古くなる**——グルーピングを対象外とする前提が崩れるため、コメントを更新する）。
- `packages/web/src/store/view.ts:159`（`{kind:"confirmClose", targets:
  {type:"pane"|"tab"|"workspace", id}[]}`）：複数対象をまとめて確認できる既存の形。
- `packages/protocol/src/model.ts:127`（`SessionSnapshot`）・
  `packages/protocol/src/messages.ts:122-123,292`（`WorkspaceCloseParams`・`METHOD_SCHEMAS` での
  `"workspace.close"` 登録）：どちらも既存の型・schema として確認済み（「未確認」のヘッジは外す）。

## インターフェース / データ構造

### protocol（`packages/protocol/src/model.ts`）

```ts
export interface WorkspaceGroup {
  id: string;   // "g1", "g2", ... （既存の id 採番の流儀に揃える）
  label: string;
  /** 折りたたみ状態（サーバ全体で共有。AC6）。worktree 自動グループの折りたたみ状態は
   *  ここではなく `view.ts` の `collapsedAutoGroups`（ブラウザ単位）に持つ——別の永続化先。 */
  collapsed: boolean;
}

export interface GitInfo {
  branch: string | null;
  ahead: number;
  behind: number;
  /** Git 共通ディレクトリの絶対パス（正規化済み）。worktree 自動グループの判定キー。
   *  git 管理外なら null（20260923-workspace-grouping）。 */
  repoKey: string | null;
  /**
   * linked worktree か（本体＝false）。`git rev-parse --git-dir` と `--git-common-dir` を
   * 両方解決して比較する——**本体はこの2つが同じパスを指し、linked worktree は異なる**
   * （`--git-dir` は `<common-dir>/worktrees/<name>` を指す。標準的な Git の仕組み）。
   * `repoKey` が null（git 管理外）のときは常に false（20260923-workspace-grouping）。
   */
  isLinkedWorktree: boolean;
}
```

`Workspace.groupId` は型を変えない（既に `string | null`）。`SessionSnapshot`
（`packages/protocol/src/model.ts:127`）に `groups: WorkspaceGroup[]` を追加する。

### persist（`packages/server/src/persist/SessionFile.ts`）

```ts
export interface SessionFileGroup {
  id: string;
  label: string;
  collapsed: boolean; // WorkspaceGroup.collapsed と同じ意味・同じ値をそのまま永続化する
}
```

`SessionFileData` に `groups: SessionFileGroup[]`（既定 `[]`）を追加し、`SessionFileWorkspace` に
`groupId?: string | null` を追加する（`SessionFileDataSchema` 等の zod schema も同様に拡張する。
既存の `autoLabel`・`agentSession` と同じ「optional 追加」方式——旧形式の `session.json` は
`groups` 無し・`groupId` 無しとして読み込め、後方互換を保つ）。`WorkspaceGroup` との対応は
1:1（id・label・collapsed をそのまま読み書きするだけで、変換ロジックは不要）。

### protocol（`packages/protocol/src/messages.ts`）

```ts
// キーバインド用（delta 指定。tab.move と同じ形）
export const WorkspaceMoveParams = z.object({ workspaceId, direction: z.enum(["previous", "next"]) });

// D&D 用（anchor 指定。複数 ID で単一ドラッグ・グループ一括移動の両方を表す）
export const WorkspaceMoveToParams = z.object({
  workspaceIds: z.array(workspaceId).min(1),
  beforeWorkspaceId: workspaceId.nullable(), // null なら末尾へ
});

// 手動グループ
export const GroupCreateParams = z.object({ label: z.string().min(1) });
export const GroupRenameParams = z.object({ groupId: z.string(), label: z.string().min(1) });
export const GroupDeleteParams = z.object({ groupId: z.string() }); // メンバーは外れるだけ（消えない）
export const GroupAddMemberParams = z.object({ groupId: z.string(), workspaceId });
export const GroupRemoveMemberParams = z.object({ workspaceId }); // 現在のグループから外す

// 一括クローズ（既存の WorkspaceCloseParams（messages.ts:122-123）に closeLinkedWorktrees を追加）
export const WorkspaceCloseParams = z.object({ workspaceId, closeLinkedWorktrees: z.boolean().default(false) });
```

### server（`SessionModel`）

```ts
private groups = new Map<string, WorkspaceGroup>();

createGroup(label: string): WorkspaceGroup;
renameGroup(id: string, label: string): WorkspaceGroup;
deleteGroup(id: string): void;              // メンバーの groupId を null に戻す
addToGroup(workspaceId: WorkspaceId, groupId: string): Workspace;
removeFromGroup(workspaceId: WorkspaceId): Workspace; // groupId を null に戻す

/** 対象 workspace を1つ隣へ（巡回込み）。moveTab と同じ splice remove→insert（D10 と同じ理由）。 */
moveWorkspace(id: WorkspaceId, direction: "previous" | "next"): Workspace[] | null; // 変化後の全順序

/** workspaceIds をまとめて beforeWorkspaceId の直前へ（null なら末尾）。相対順序は保つ。 */
moveWorkspacesTo(workspaceIds: WorkspaceId[], beforeWorkspaceId: WorkspaceId | null): Workspace[] | null;

/** 既存の closeWorkspace(id) を拡張。closeLinkedWorktrees が true かつ id が worktree 自動
 *  グループの本体（isLinkedWorktree === false）なら、同じ repoKey を持つ子も連鎖して閉じる。
 *  既存シグネチャは `packages/server/src/session/SessionModel.ts:380`。 */
closeWorkspace(id: WorkspaceId, opts?: { closeLinkedWorktrees?: boolean }): RemovalResult;
```

連鎖クローズの判定・実行主体は `SessionModel.closeWorkspace`（既存の唯一の実体。
`SessionModel.ts:380-384`）。`SessionService.closeWorkspace`（`SessionService.ts:275-276`）は
既存どおり `this.model.closeWorkspace(id)` を呼ぶだけの RPC 経路で、`closeLinkedWorktrees` を
そのまま素通しする——連鎖の実ロジックは持たない。

`moveWorkspace`/`moveWorkspacesTo` の実装は、`[...this.workspaces.entries()]` を並べ替えてから
`this.workspaces = new Map(reordered)` で作り直す（「設計方針」参照）。

### server（`GitInfoPoller.probe` の拡張。既存の `resolveCommonDir` を再利用）

擬似コード：

```ts
const commonResult = await git.run(cwd, ["rev-parse", "--git-common-dir"], TIMEOUT);
const repoKey = commonResult.code === 0 ? resolveCommonDir(cwd, commonResult.stdout) : null;

let isLinkedWorktree = false;
if (repoKey) {
  const dirResult = await git.run(cwd, ["rev-parse", "--git-dir"], TIMEOUT);
  if (dirResult.code === 0) isLinkedWorktree = resolveCommonDir(cwd, dirResult.stdout) !== repoKey;
}
```

（`resolveCommonDir` は `packages/server/src/git/worktree.ts` からそのまま import する。
`--git-dir` の生出力も同じ絶対化ロジックで解決してよい——「cwd に対する相対パスを絶対化する」という
処理自体は共通で、対象が `--git-common-dir` か `--git-dir` かは呼び出し側の関心事）。
`WorktreeService.ts` は変更しない（既存の `repoNameOf` はそのまま）。cwd ごとに git コマンドが
1つ増える（5秒周期のポーリングなので許容範囲——既存の `probe` も1 cwd あたり2コマンド実行済み）。

## 振る舞いの詳細

### worktree 自動グループの表示（クライアント側。`Sidebar.vue`）

```
workspaces = [...session.workspaces.values()]
manualGroups = groupBy(workspaces.filter(w => w.groupId !== null), w => w.groupId)
autoGroupCandidates = workspaces.filter(w => w.groupId === null && w.git?.repoKey)
autoGroups = groupBy(autoGroupCandidates, w => w.git.repoKey)
  .filter(group => group.length >= 2)  // 1人なら束ねない（AC2）
```

`repoKey` が同じ workspace のうち、`git.isLinkedWorktree === false` の1件を「本体（親）」として
先頭に描画し、他（`isLinkedWorktree === true`）を子としてインデントする（herdr と同じ並び。
research.md F3）。理論上、同じ `repoKey` を持つ workspace が複数あっても本体（`false`）は必ず
高々1件（同じリポジトリを開ける「本体の checkout」は1箇所だけのため）。万一 `GitInfoPoller` の
周期の谷間で本体が見つからない場合（例えば起動直後）は、先頭の workspace を暫定的に親として
描画する（フォールバック。次の周期で実際の判定に置き換わる）。

### 折りたたみ

- worktree 自動グループ：折りたたみ状態はブラウザごとの `localStorage`（`view.ts` に
  `collapsedAutoGroups: Set<string>`〔`repoKey` の集合〕を追加。既存の `sidebarCollapsed` と同じ
  読み書きの流儀）。
- 手動グループ：折りたたみ状態はサーバ全体で共有（`WorkspaceGroup` に `collapsed: boolean` を
  持たせる。AC6「サーバに永続化されブラウザを閉じても残る」——`SessionFileData.groups` に含める）。
- どちらも、折りたたみ中でもその中に focus 中の workspace があれば、その行だけは見える
  （`view.workspaceId` と `groupId`/`repoKey` の一致を見て、折りたたみの `v-if` に例外を作る）。

### workspace の並べ替え（D&D）

`PaneFrame.vue` の `onNamePointerDown`/`onNamePointerMove`/`onNamePointerUp`（依拠する既存の事実）
と同じ形を `Sidebar.vue` の workspace 行・グループのヘッダー行に適用する：

```
onRowPointerDown: dragStart 記録・setPointerCapture
onRowPointerMove: 閾値(6px)を超えたら view.startWorkspaceDrag(idsBeingDragged) を呼ぶ
  - 通常の workspace 行なら idsBeingDragged = [workspace.id]
  - グループのヘッダー行なら idsBeingDragged = そのグループの全メンバー id（AC9）
  view.setWorkspaceDragOver(elementFromPoint の行の workspace.id)
onRowPointerUp: ドロップ先が決まっていれば
  actions.moveWorkspacesByDrag(idsBeingDragged, dropTargetWorkspaceId) を呼ぶ
  → conn.request("workspace.move_to", { workspaceIds: idsBeingDragged, beforeWorkspaceId: dropTargetWorkspaceId })
  Esc・範囲外へのドロップは何もしない（AC-I2）
```

### workspace の並べ替え（キーバインド）

`bindings.ts` に `move_workspace_previous`/`move_workspace_next`（`defaults: []`。
`20260923-missing-keybinding-actions` の12操作と同じ「既定キー無し」の流儀）を追加し、
`ActionDispatcher` が `conn.request("workspace.move", { workspaceId: view.workspaceId,
direction })` を送る。対象は現在 focus 中の workspace（`view.workspaceId`）。グループの内側・
外側を問わず、フラットな順序上で隣と入れ替わる（「検討した代替案」参照——キーバインドはグループの
まとまりを保つ動きはしない。まとまりを保った移動は D&D の役割）。

### グループの作成・追加・削除（UI）

`ContextMenu.vue` の `target.kind === "workspace"` 分岐に追加：
- 「新しいグループを作る…」→ `NameDialog` 相当（名前を1つ入力するダイアログ。既存の
  `renameWorkspace`/`renameTab` と同じ部品を再利用）で名前を確定 → `group.create` →
  作成したグループへ、右クリック元の workspace を追加。
- 「グループへ追加…」（既存グループが1件以上あるとき）→ `WorktreeOpenDialog.vue` と同じ
  「一覧から選ぶ」形のダイアログでグループを選択 → `group.add_member`。
- 「グループから外す」（`groupId !== null` のときだけ）→ `group.remove_member`。
- グループのヘッダー行自体の右クリックメニュー（新設）：「名前を変更」→ `group.rename`／
  「グループを削除」→ `group.delete`。

### 一括クローズ

`closeWorkspaceById` が対象の workspace を確認する際、その workspace が worktree 自動グループの
本体（親）で子（linked worktree）が1件以上あれば、`ConfirmDialog` に「束ねた worktree も
一緒に閉じる」チェックボックス（既定オフ）を追加する。チェックして確定すると
`workspace.close` に `closeLinkedWorktrees: true` を付けて送る——サーバ側
（`SessionModel.closeWorkspace`。`SessionService.closeWorkspace` はそのまま素通しするだけ）が
そのグループの子 workspace も連鎖して閉じる（herdr の `close_group`。research.md F4）。

## ドメイン固有の考慮

- herdr との対応は `docs/herdr-parity.md` H04（並べ替え。workspace 側が今回で完結）・H37
  （worktree グループ。完了）・H37b の更新（グループ化の部分が完了。worktree の削除は別行のまま）で
  記す。手動グループは herdr に前例が無い独自拡張として明記する。

## エラー処理 / 異常系

- グループが空になっても（全メンバーが外れても）グループ自体は自動削除しない——利用者が明示的に
  削除するまで残る（名前だけの空グループは無害。herdr にも「グループが空になったら自動で消す」
  相当の概念が無い）。
- `workspace.move_to` の `beforeWorkspaceId` が既に存在しない workspace を指す場合は
  `NotFoundError`（既存の `requireWorkspace` の流儀）。
- `group.add_member`/`group.remove_member` の対象 workspace・グループが存在しない場合は
  `NotFoundError`。

## 受け入れ基準との対応

- AC1: `GitInfoPoller` が求める `repoKey` が同じ workspace が2つ以上のとき、`Sidebar.vue` の
  `autoGroups` 計算がグループとして扱う。
- AC2: `autoGroups` の `.filter(group => group.length >= 2)` が単独の workspace を除外する。
- AC3: `collapsedAutoGroups`（ブラウザ単位）で折りたたみ・展開。focus 中の workspace は
  `view.workspaceId` との一致で例外的に見せる。
- AC4: `group.create` → `SessionModel.createGroup`。
- AC5: `group.add_member`/`group.remove_member`・`group.rename`・`group.delete`。
- AC6: `WorkspaceGroup.collapsed`（サーバ永続化）・focus 中の workspace の例外表示（AC3 と同じ
  ロジックを手動グループにも適用）。
- AC7: D&D（`onRowPointerMove`/`onRowPointerUp` → `workspace.move_to`）。
- AC8: キーバインド（`move_workspace_previous`/`next` → `workspace.move`）。
- AC9: グループのヘッダー行をドラッグすると `idsBeingDragged` がメンバー全員になり、
  `workspace.move_to` が複数 ID をまとめて動かす。
- AC10: `closeLinkedWorktrees` オプション付きの `workspace.close`。
- AC11: 既存の `orderedWorkspaceIds`・`view.workspaceSort` のロジック自体は変更しない
  （「開いた順」の意味が「ミュータブルな実際の順序」になる点は設計方針で明記したとおりだが、
  トグル自体の実装・既存のテストは維持する）。
- AC-I1: 折りたたみアイコン（クリックのトグル）が `collapsedAutoGroups`/`WorkspaceGroup.collapsed`
  を即座に反映する（AC3・AC6 と同じ実装）。
- AC-I2: 「workspace の並べ替え（D&D）」節のとおり、`onRowPointerUp` でドロップ先が無ければ
  何もしない。Esc は `PaneFrame.vue` の `onEscapeDuringDrag`（依拠する既存の事実）と同じ形で
  ドラッグ状態を破棄するだけで `workspace.move_to` を送らない。
- AC-I3: グループ関連の操作は全て `ContextMenu.vue`（既存のキーボードだけで開閉できる経路）から
  到達する。並べ替えはキーバインド（AC8）でも完結する。
- AC-I4: D&D 確定後・キーバインド移動後とも、対象の workspace（グループ一括ドラッグならその
  workspace 自身）へのフォーカスを維持する（既存の focus 管理を変えない。新規のフォーカス移動先は
  導入しない）。
- AC-I5: 折りたたみ・D&D のポインタイベントは `Sidebar.vue` の workspace 行・グループのヘッダー行に
  閉じており、既存の workspace 切替・右クリックメニュー・並び順トグル・agents 区画のイベント経路は
  変更しない（「対象範囲」に挙げたファイル以外は触らない）。
