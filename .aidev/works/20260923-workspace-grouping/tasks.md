# タスク: workspace のグルーピングと並べ替え

## 実装方針

design.md の3層（protocol → server → web）の順で積む。各層は自分より下の層が固まってから
着手する（`tab.move`・`20260923-other-agents-session-resume` と同じ順序）。

**coding 中に見つけた設計ギャップ**（decisions.md D5）: `workspace.move`/`workspace.move_to` は
サーバ側 `Map` の並びを作り直すだけで、動いた workspace 自身のフィールドは変わらない。
既存の `WorkspaceUpdatedEvent` だけではブラウザ側 `session.workspaces`（`Map.set` は既存キーの
位置を動かさない）に並び替えを伝えられないため、新規イベント `workspace.order_changed` を
protocol に追加する（T3・T7・T8 が実装する）。

グループの CRUD（作成・名前変更・削除・追加・削除）は、既存の `workspace.created`/`updated`/
`closed`・`tab.created`/`updated`/`closed`（「entity 単位の created/updated/+もう1つのイベント」
の型）に倣うが、3つ目の名前はそのまま「closed」を流用せず `group.deleted` にする——
`workspace.closed`/`tab.closed` は「PTY を閉じる」という実体のある操作を指す語で、グループには
その意味の「閉じる」が無く、レコードを消すだけなので `deleted` のほうが実態に合う（`group.create`/
`group.delete`〔RPC の method 名。design.md「インターフェース/データ構造」〕とも呼び名を揃えられる）。
結果として `group.created`/`group.updated`/`group.deleted` を新設する（design.md には RPC/
イベントの結線までは書かれていないが、「対象範囲」の SessionService.ts 項目「上記の RPC 化・
イベント配信」が指す実装詳細そのもの——設計からの逸脱ではなく、design が委譲した実装レベルの
決定）。メンバー追加・削除（`groupId` の変更）は既存の `workspace.updated` にそのまま乗せる
（`Workspace.groupId` は `Workspace` 自身のフィールドなので、この1本で足りる）。

## 作業順序と依存関係

下の `依存:` に従う。大まかな波は次のとおり：
1. protocol（T1〜T3）
2. server（T4〜T7）
3. web の土台（T8〜T11：store・純関数・keybinding・`MouseBridge.ts` の `MenuTarget` 拡張）
4. web の実装（T12〜T17：ActionDispatcher・UI コンポーネント・dialog 結線）
5. 仕上げ（T18：herdr 対応表の更新。他タスクが実装した内容をまとめて記す）

## リスク / 留意点

- `NextIdCountersSchema`（`SessionFile.ts`）は `NextIdCounters` の全フィールドを必須で読む。
  `g` を単純に必須追加すると、**この work より前に保存された `session.json`（`g` を持たない）の
  読み込みが壊れる**。`autoLabel`/`agentSession` と同じ「optional 追加」の考え方を数値カウンタにも
  適用し、`z.number().default(1)` で「無ければ 1」として読む（T6）。
- `Map.set`（`workspaceUpserted`／サーバ側 `SessionModel`）は既存キーの挿入位置を動かさない
  （decisions.md D5）。並び替えは常に「配列を並べ替えてから `new Map(...)` で作り直す」——
  個々のフィールド更新と混同しない（T5・T8）。
- worktree 自動グループと手動グループの重なり（手動グループが優先。design「設計方針」）を
  `workspaceGrouping.ts`（T9）の純関数に閉じ込め、Sidebar.vue・ConfirmDialog.vue の両方から
  同じロジックを再利用する（重複実装による food のズレを防ぐ）。

## テスト方針

- server・protocol は vitest（既存の `*.test.ts` 追加・拡張）。`SessionModel`/`GitInfoPoller`/
  `SessionFile`/`SessionService` それぞれの既存テストファイルに追記する。
- web は vitest + `@vue/test-utils`（既存コンポーネントテストと同じ形）。純関数
  （`workspaceGrouping.ts`）は状態機械的な性質があるため、`.aidev/conventions/
  regression-negative-control.md`・過去の「負の確認は変異の網羅で」の教訓に倣い、正常系だけで
  なく「1件しかない」「重なっている」「repoKey が無い」等の境界・変異ケースを機械的に網羅する。
- E2E は本 work の範囲では追加・実行しない（ユーザー依頼が無い限り。プロジェクトの既定運用）。
  test 工程の `test-result.md`「未検証の穴」に明記する。
- 各タスクの実装と同じタスク内でテストも更新する（本 work の先行2作業と同じ粒度）。

## タスク

- [x] T1: protocol の型を拡張する（`WorkspaceGroup`・`GitInfo.repoKey`/`isLinkedWorktree`・
      `SessionSnapshot.groups`・id 種別 `"g"`）
      対象: `packages/protocol/src/model.ts:12-16,26,127-136`（`GitInfo`・`Workspace.groupId`・
      `SessionSnapshot`）／`packages/protocol/src/ids.ts`（`IdKind`・`parseId`）／
      根拠: design.md「インターフェース/データ構造」
      依存: なし
      AC: AC1, AC2, AC4, AC5, AC6

- [x] T2: protocol messages を拡張する（`workspace.move`/`workspace.move_to`・グループ CRUD の
      params/result・`WorkspaceCloseParams.closeLinkedWorktrees`）
      対象: `packages/protocol/src/messages.ts:122-123,281-353`（`WorkspaceCloseParams`・
      `METHOD_SCHEMAS`・`MethodResultMap`）／根拠: design.md「インターフェース/データ構造」
      依存: T1
      AC: AC4, AC5, AC7, AC8, AC9, AC10

- [x] T3: protocol events を拡張する（`workspace.order_changed`・`group.created`/`updated`/
      `deleted`）
      対象: `packages/protocol/src/events.ts:74-92`（`ServerEvent`）／根拠: decisions.md D5・
      「実装方針」
      依存: T1
      AC: AC4, AC5, AC7, AC8, AC9

- [x] T4: `GitInfoPoller.probe` を拡張し `repoKey`/`isLinkedWorktree` を取得する
      対象: `packages/server/src/git/GitInfoPoller.ts:46-70`（`probe`）／
      `packages/server/src/git/worktree.ts:72-82`（`resolveCommonDir` を import して使う。
      この関数自体は変更しない）／根拠: design.md「server（GitInfoPoller.probe の拡張）」
      （T9・T13 は `Workspace.git.repoKey`/`isLinkedWorktree` という**値**を消費するが、
      その型は T1 が定義するので、コード上の `依存:` は T4 ではなく T1 で足りる——実行時に
      本物の値が埋まるのは T4・T7 が揃ってから。単体テストは fixture の `Workspace.git` を
      直接組み立てて検証する）
      依存: T1
      AC: AC1, AC2

- [x] T5: `SessionModel` にグループ CRUD・`moveWorkspace`/`moveWorkspacesTo`・
      `closeWorkspace` の `closeLinkedWorktrees` 連鎖を実装する
      対象: `packages/server/src/session/SessionModel.ts:74-97`（`groups` Map・`nextIdCounters`
      に `g` を追加）・`:380-384`（`closeWorkspace`）／グループ CRUD 5 メソッド・
      `moveWorkspace`/`moveWorkspacesTo` 自体は新規メソッドで既存の行番号は無い——`:341`
      （`moveTab`。並べ替えメソッドの実装パターンの参考）の近くに追加する／
      根拠: design.md「server（SessionModel）」
      依存: T1, T2
      AC: AC2, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11

- [x] T6: `SessionFile.ts` にグループ・`groupId`・`nextId.g` の永続化を追加する（後方互換の
      「optional 追加」方式。「リスク/留意点」参照）
      対象: `packages/server/src/persist/SessionFile.ts:32-111`（`SessionFileWorkspace`・
      `SessionFileData`・`NextIdCountersSchema`・`SessionFileWorkspaceSchema`・
      `SessionFileDataSchema`）／根拠: design.md「persist（SessionFile.ts）」
      依存: T1, T5
      AC: AC5, AC6

- [x] T7: `SessionService` に RPC・イベント配信・復元（`restore()`）を結線する
      （`workspace.move`/`move_to`/`close`・`group.create`/`rename`/`delete`/`add_member`/
      `remove_member`。成功時に `workspace.order_changed`/`group.*`/`workspace.updated` を配布）
      対象: `packages/server/src/session/SessionService.ts:275-276`（`closeWorkspace`）・
      `:336-339`（`moveTab` 相当の実装パターン）／根拠: design.md「対象範囲」・decisions.md D5
      依存: T2, T3, T5, T6
      AC: AC4, AC5, AC7, AC8, AC9, AC10

- [x] T8: web の `session.ts`/`StoreAdapter.ts` にグループ状態・`workspace.order_changed`/
      `group.*` イベントの反映を実装する（`reorderWorkspaces` 新設）
      対象: `packages/web/src/store/session.ts:15,21-29,38-43`（`workspaces`・`applySnapshot`・
      `workspaceUpserted`）／`packages/web/src/store/StoreAdapter.ts:89-141`
      （`applyEventToSession`）／根拠: decisions.md D5
      依存: T1, T3
      AC: AC4, AC5, AC6, AC7, AC8, AC9

- [x] T9: `workspaceGrouping.ts`（新規・純関数）を実装する（`manualGroupsOf`・`autoGroupsOf`・
      `groupedWorkspaceRows`・`linkedWorktreeChildrenOf`）
      対象: 新規 `packages/web/src/store/workspaceGrouping.ts`（`packages/web/src/store/
      workspaceOrder.ts` と同じ「純関数・複数箇所から共有」の形を踏襲）／根拠: design.md
      「振る舞いの詳細」（`manualGroups`/`autoGroups` の擬似コード）・decisions.md D2
      依存: T1
      AC: AC1, AC2, AC3, AC6, AC9, AC10

- [x] T10: `view.ts`（D&D 状態・折りたたみ状態・dialogContext 拡張）と `MouseBridge.ts`
      （`MenuTarget` に `group` を追加）を実装する
      対象: `packages/web/src/store/view.ts:153-166`（`DialogContext`）・`:184-194`
      （`dialogContext`・`paneDrag`）・`:208-219`（`sidebarCollapsed` と同じ `localStorage`
      流儀）／`packages/web/src/term/MouseBridge.ts:9-13`（`MenuTarget`）／根拠: design.md
      「対象範囲」・「振る舞いの詳細」
      依存: T1
      AC: AC3, AC7, AC9, AC-I1, AC-I2

- [x] T11: `bindings.ts` に `move_workspace_previous`/`move_workspace_next` を追加する
      （`defaults: []`）
      対象: `packages/web/src/keys/bindings.ts`（`move_tab_previous`/`move_tab_next` と同じ形。
      未特定——具体的な追加位置は探索）／根拠: design.md「振る舞いの詳細（キーバインド）」
      依存: なし
      AC: AC8, AC-I3

- [x] T12: `ActionDispatcher.ts` に並べ替え・グループ CRUD・一括クローズの dispatch を実装する
      （`moveWorkspacesByDrag`・キーバインド 2 つの実行・`createGroup`/`confirmCreateGroup`・
      `renameGroupById`/`confirmRenameGroup`・`deleteGroupById`・`addWorkspaceToGroup`/
      `confirmAddToGroup`・`removeWorkspaceFromGroup`・`closeWorkspaceById`/`confirmClose` の
      `closeLinkedWorktrees` 対応）
      対象: `packages/web/src/actions/ActionDispatcher.ts:379-388`（`confirmClose`）・
      `:504-538`（`closePaneById`〜`closeWorkspaceById`）・`:237-253`（`newWorktree`/
      `openWorktree`。グループ版の型として踏襲）／根拠: design.md「振る舞いの詳細」
      依存: T2, T7, T8, T9, T10, T11
      AC: AC4, AC5, AC7, AC8, AC9, AC10, AC-I2, AC-I4

- [x] T13: `Sidebar.vue` をグループ構造を持つ描画に拡張し、workspace 行・グループヘッダー行に
      D&D を実装する
      対象: `packages/web/src/components/Sidebar.vue:30-44`（`spaces` computed）・`:163-183`
      （テンプレートの行部分）／根拠: design.md「振る舞いの詳細（worktree 自動グループの表示・
      D&D）」
      依存: T9, T10, T12
      AC: AC1, AC2, AC3, AC6, AC7, AC9, AC-I1, AC-I5

- [x] T14: `ContextMenu.vue` にグループ関連の項目とグループヘッダー行専用メニューを追加する
      対象: `packages/web/src/components/ContextMenu.vue:71-87`（`target.kind === "workspace"`
      分岐）・`:46-101`（`items` computed に `group` kind の分岐を追加）／根拠: design.md
      「振る舞いの詳細（グループの作成・追加・削除）」
      依存: T10, T12
      AC: AC4, AC5, AC-I3

- [x] T15: `NameDialog.vue` を `createGroup`/`renameGroup` にも対応させる
      対象: `packages/web/src/components/NameDialog.vue:17-54`（`NAME_KINDS`・`initialValue`・
      `title`・`confirm`）／根拠: design.md「振る舞いの詳細」（`NameDialog` 相当の再利用）
      依存: T10, T12
      AC: AC4, AC5, AC-I3

- [x] T16: 「グループへ追加」の選択ダイアログ（新規。`WorktreeOpenDialog.vue` を型として踏襲）を
      実装し、`App.vue` に結線する
      対象: 新規 `packages/web/src/components/GroupPickerDialog.vue`（型は
      `packages/web/src/components/WorktreeOpenDialog.vue` 全体）／
      `packages/web/src/App.vue:81-84`（`<NameDialog />`〜`<ConfirmDialog />` の並び）／
      根拠: design.md「振る舞いの詳細（グループへ追加…）」
      依存: T10, T12
      AC: AC5, AC-I3

- [x] T17: `ConfirmDialog.vue` に「束ねた worktree も一緒に閉じる」チェックボックスを追加する
      対象: `packages/web/src/components/ConfirmDialog.vue`（`message` computed・`confirm`・
      テンプレート）／根拠: design.md「振る舞いの詳細（一括クローズ）」
      依存: T9, T12
      AC: AC10

- [x] T18: `docs/herdr-parity.md` の H04・H37b を更新する（H37 は変更不要）
      対象: `docs/herdr-parity.md:27`（H04）・`:70`（H37b）／根拠: design.md「ドメイン固有の考慮」
      依存: T1, T5, T7, T9, T13, T14, T15, T16, T17
      AC: なし
