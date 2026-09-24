# 調査: D&D による pane の別 tab・別 workspace への移動

## 調査の問い

- Q1: 既存の pane を「新しい PTY を作らず」別の tab の一員にする既存の primitive はあるか。
- Q2: 移動元の tab が空になったとき、既存の `closeTabInternal` はそのまま使えるか。
- Q3: `Pane.tabId` は移動時に書き換えられる単純なフィールドか。
- Q4: クライアント側のドロップ先検出（tab バーの tab・サイドバーの workspace 行）に必要な DOM の
  仕掛けは何か。既存の D&D（`PaneFrame.vue`・`Sidebar.vue`）とどう組み合わせるか。
- Q5: この操作は `20260924-pane-dnd-split-move` の `replacePane` のような破壊的操作（busy 確認が
  要る）か。
- Q6: `viewRepair.ts`（decisions.md D5 で発見した focus 復帰の食い違い）は、この work でさらに
  悪化するか。

## 判明した事実

### サーバ側の既存 primitive

- F1: `createTab`/`reserveTab`（`SessionModel.ts:240-280`）は**常に新しい pane を作る**
  （`makePane(paneId, tabId, init)` を呼ぶ。`paneId` は `nextId("p")` で新規発行）。**既存の
  pane を「そのまま」新しい tab の内容にする primitive は無い**——新しい関数が要る。
- F2: `closeTabInternal`（`SessionModel.ts:511-531`）は、tab の中の**全ての葉（pane）を
  `this.panes` から削除する**（`removedPaneIds = Layout.leaves(tab.layout); for (const pid of
  removedPaneIds) this.panes.delete(pid)`）。**これは「pane を閉じる」ための関数**——移動元の tab
  が空になったからといってこれをそのまま呼ぶと、移動しようとしている pane 自体を `this.panes`
  から消してしまう（移動ではなく削除になる）。**移動元の tab を「空になったので片付ける」ときは、
  `closeTabInternal` の変種（pane を削除せず、tab の器だけを消す版）が要る**——design が新しい
  関数を用意すること。
- F3: `Pane.tabId`（`packages/protocol/src/model.ts:70`）は単純な `TabId` フィールドで、
  導出値ではない。`this.panes.set(paneId, {...pane, tabId: newTabId})` で書き換えられる
  （`SessionModel.ts` の他のメソッド〔`renameWorkspace`・`renameTab`〕と同じ「スプレッドで
  一部だけ書き換えて再セット」パターンが使える）。
- F4: `moveToEdge`/`replacePane`（`SessionModel.ts`。`20260924-pane-dnd-split-move`）は
  いずれも**同一 tab 内**の操作で、`pane.tabId` を書き換える必要が無かった。本 work が
  初めて `pane.tabId` を書き換える操作になる。
- F5: `splitPane`（`SessionModel.ts:297-310`）は分割時に `zoomedPaneId: null`（対象 tab の
  zoom を解除する。D100）。**移動先 tab に既存の zoom があった場合も同じ扱いにできる**
  （`splitPane` と同じ理由——新しく入る pane が zoom 中の別の pane に隠れたまま焦点だけ
  移るのを防ぐ）。移動元 tab 側も、`closePane`/`moveToEdge`/`replacePane` と同じく
  `zoomedPaneId: null` を無条件に適用する既存パターンをそのまま使える。

### protocol の既存スキーマ

- F6: `TabCreateParams`/`TabCreateResult`（`packages/protocol/src/messages.ts:177-186`）:
  `{workspaceId?, label?, newCwd?}` → `{tab, pane, cwdFallback?}`。**`pane` は必ず新規**
  （`newCwd` は新しい PTY の cwd 決定に使うオプション）。既存の pane を運ぶ形にはなっていない
  ——新しい RPC（またはこの型の拡張）が要る。
- F7: `PaneMoveToEdgeParams`/`PaneReplaceParams`（`messages.ts`。`20260924-pane-dnd-split-move`）
  はいずれも `{paneId, targetPaneId, ...}` の形で、対象 pane を id で指す。新しい RPC も
  この形（移動する pane の id ＋ 移動先を指す id）に揃えるのが自然。

### クライアント側の既存 D&D 機構

- F8: `PaneFrame.vue`（`onNamePointerDown`/`onNamePointerMove`/`onNamePointerUp`）は
  `document.elementFromPoint` → `[data-pane-id]` 祖先 探索でドロップ先を特定する。**ドラッグの
  開始・6px 閾値・Esc/ダイアログ/自消失での後始末は、ドラッグ元（`PaneFrame.vue` インスタンス）
  だけが持つロジックで、ドロップ**先**は「その座標に何があるか」を都度探すだけ**——ドロップ先の
  コンポーネント（`TabBar.vue`・`Sidebar.vue`）自身は、ドラッグ用の pointer イベントハンドラを
  一切持つ必要が無い。`data-*` 属性でマークされているだけでよい（`Sidebar.vue` 自身の workspace
  並べ替え D&D は完全に別のドラッグ元・別の状態〔`view.workspaceDrag`〕を持つ、独立した機構）。
- F9: `TabBar.vue`（`packages/web/src/components/TabBar.vue:140-156`）: tab は `<button
  v-for="tab in tabs" :key="tab.id">` で描画。**`data-tab-id` 等の DOM 属性は無い**
  （`:key` は Vue 内部の差分検出用で DOM には出ない）。ドラッグ/ドロップのハンドラも一切無い
  （確認済み。`grep` で pointerdown 等ゼロ件）。ドロップ先として使うには
  `:data-tab-id="tab.id"` の追加が要る（`PaneFrame.vue`/`Sidebar.vue` と同じ命名慣習）。
- F10: `Sidebar.vue` の `data-workspace-row-key`（`Sidebar.vue:214` 付近。既存）は、行の**一意な
  key**（`group:<id>` または workspace id）を持つが、これは**workspace 並べ替え用**の仕組みで、
  必ずしも「1つの workspace」を指すとは限らない——`SpaceRow.workspace: Workspace | null` を見る
  必要がある（`workspaceRow()`〔`Sidebar.vue:77`〕が作る行は `workspace` フィールドに実際の
  `Workspace` を持つが、手動グループの**ヘッダー行**〔`workspace: null`。`Sidebar.vue` 内の
  該当箇所〕は特定の workspace を表さない）。**pane を「この workspace へ」ドロップする機能は、
  `row.workspace` が非 null の行だけを有効なドロップ先として扱う必要がある**——`dropAnchorId`
  （workspace 並べ替え用の別の概念）をそのまま流用してはいけない。

## 影響範囲

- `packages/protocol/src/messages.ts`（新規 RPC: 例 `pane.move_to_tab`〔既存 tab へ〕・
  `pane.move_to_new_tab`〔新規 tab として workspace へ〕）。
- `packages/server/src/session/SessionModel.ts`（新規: 既存 pane を運ぶ tab 作成の変種、
  空になった tab を pane を消さずに片付ける `closeTabInternal` の変種、`pane.tabId` の書き換え）。
- `packages/server/src/session/SessionService.ts`・`packages/server/src/surface/methods/`
  （新規ハンドラの追加。イベント配布は `layout.updated`〔両方の tab〕・`tab.created`〔新規 tab の
  場合〕・`pane.created`〔無い。既存 pane を運ぶだけなので新規 pane イベントは不要〕・
  `tab.closed`〔移動元が空になった場合〕の組み合わせになる見込み）。
- `packages/web/src/components/TabBar.vue`（`data-tab-id` 属性の追加のみ。新しい pointer
  ハンドラは不要——F8）。
- `packages/web/src/components/Sidebar.vue`（`row.workspace` を見て有効なドロップ先か判定する
  ロジックの追加。既存の `data-workspace-row-key` はそのまま流用）。
- `packages/web/src/components/PaneFrame.vue`（`dropTargetAt` 相当の探索先に `[data-tab-id]`・
  `[data-workspace-row-key]` を追加）。
- `packages/web/src/actions/ActionDispatcher.ts`（新アクション2つ）。

## 実現性 / リスク

- R1 **`closeTabInternal` を移動元の後始末にそのまま使うと、移動しているはずの pane を消して
  しまう**（F2）。design で「pane を保持したまま tab の器だけを消す」変種を明確に定義すること
  ——このセッションで最も重要な落とし穴。
- R2 `Sidebar.vue` の `dropAnchorId`（workspace 並べ替え用）とこの work が新設する
  「pane をこの workspace へ」の判定を混同しないこと（F10）。
- R3 tab バーの tab 要素は面積が小さく、`PaneFrame` の縁/中央のようなゾーン細分は現実的でない
  （requirements.md の未確定事項どおり）。design で単一の既定挙動を決めること。
- R4 **この操作は破壊的ではない**（プロセスを一切終了させない。`replacePane` と違い busy 確認は
  不要と判断できる——念のため design で明記する）。
- R5 `viewRepair.ts`（decisions.md D5）は、この work で**悪化しない**（このセッションで確認）:
  移動元 tab の視点では「pane がレイアウトから消える」ことは既存の `pane.close` と区別が
  付かず、`viewRepair` の既存の「最初の葉へフォールバック」がそのまま正しく機能する
  （`replacePane` のような「特定の後継がいる」ケースではないため、D5 のような食い違いは
  生じない）。移動先 tab の視点では、新しい pane が増えるだけで `repairView` の対象外
  （現在の表示が無効になるケースではない）。

## 実装アンカー

- A1: 既存 pane を保持する tab 作成 — `packages/server/src/session/SessionModel.ts:240-280`
  （`reserveTab`/`commitTab` が precedent。新しい関数は `makePane` を呼ばず、既存の `Pane`
  オブジェクトをそのまま使う）。
- A2: 移動元の空 tab の後始末 — `packages/server/src/session/SessionModel.ts:511-531`
  （`closeTabInternal` の変種。pane を削除しない点だけが違う）。
- A3: protocol スキーマの precedent — `packages/protocol/src/messages.ts:177-186`
  （`TabCreateParams`/`Result`）・`:246-269`（`PaneMoveToEdgeParams`/`PaneReplaceParams`。
  未特定——design で正確な行番号を確認）。
- A4: クライアントのドロップ先マーカー — `packages/web/src/components/TabBar.vue:142-153`
  （`data-tab-id` を追加する箇所）・`packages/web/src/components/Sidebar.vue`
  （既存の `data-workspace-row-key`。`row.workspace` 判定を追加する箇所は未特定——design/coding
  で確認）。
- A5: ドラッグ機構の拡張 — `packages/web/src/components/PaneFrame.vue`
  （`dropTargetAt`/`paneElementAt` 相当。`20260924-pane-dnd-split-move` で既に `[data-pane-id]`
  探索の形が確立している）。

## 実装時の注意

- **`closeTabInternal` を移動元の後始末に流用しないこと**（R1）。新しい変種を用意する。
- `pane.tabId` の書き換えを忘れると、移動先の tab には表示されるが `Pane` オブジェクト自体は
  古い tab を指したままになり、後続の操作（`closePane` 等が `pane.tabId` から tab を辿る箇所）が
  壊れる。書き換えを含む一連の操作を1つのメソッド内でアトミックに行うこと。
- 移動元・移動先どちらの tab も、既存の `zoomedPaneId: null`（D100 パターン）を適用する
  （F5）。

## design への申し送り

- R1（`closeTabInternal` の変種）の正確な形を最優先で決めること。
- R3（tab バーへドロップしたときの既定の分割方向・対象 pane）を決めること——
  `20260924-pane-dnd-split-move` の `moveToEdge` と同様「対象 tab の focus 中の pane を
  direction=right で分割」が最も単純で一貫性がある候補（design で確定）。
- 移動元 tab が空になったときの扱い（requirements.md の未確定事項）は、R1 の変種を前提に
  「常に tab を自動的に閉じる」（`closePane`/`moveToEdge` 系が「最後の1枚を消すと tab が
  閉じる」という既存の一貫した規則をそのまま踏襲）を design の第一候補として検討すること。
- **外部 UI パターンの調査は今回のセッションでは実施していない**（VS Code のタブ間ドラッグ等の
  確立パターンは、`20260924-pane-dnd-split-move` の research.md 同様「一次資料未検証」として
  扱うべきだが、このセッションでは時間の都合上その調査自体を行っていない——design が独自に
  必要と判断した場合に行うこと。この点は `20260924-pane-dnd-split-move` の research.md の
  ような「確認したが未検証」ではなく「未実施」である点を区別して記録する）。
