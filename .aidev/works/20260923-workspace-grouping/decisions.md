# 決定記録

## D1: 「任意の束ね」は名前付きグループとして実装する（herdr に前例が無い独自拡張）

- **背景**: research.md F3 で、herdr のグループ化は完全に自動（Git の共通ディレクトリが同じ
  workspace を束ねるだけ）で、利用者が手動でグループを作る API・設定が存在しないことが判明した。
  backlog の「任意の束ね」は herdr を模倣できず、独自に設計する必要があった。
- **決定**: 利用者が名前を付けて作成・編集・削除できる「手動グループ」として実装する。worktree
  グループと同じ見た目（折りたたみ可能なセクション）でサイドバーに表示する。
- **理由・代替案**: 代替案（workspace に自由なタグ〔色・文字列〕を付けられるだけの軽量版）も
  提示したが、利用者は「worktree グループと見た目が揃う階層化されたグループ UI」を選んだ
  （タグ版は実装は軽いが、サイドバー上で worktree グループと見た目が揃わない）。
- **影響**: `Workspace.groupId`（既に予約済み）を手動グループの所属先として実際に使う。グループ
  自体の実体（id・名前）を持つ新しいデータ構造が要る（design で確定）。

## D2: herdr の付帯機能2つ（グループの一括移動・一括クローズ）を今回のスコープに含める

- **背景**: research.md で、herdr の `workspace.move_block`（グループをまとめて動かす）・
  `close_group`（グループの親を閉じると子も一括で閉じる）という付帯機能が見つかった。
  必須ではないため、含めるかどうかを利用者に確認した。
- **決定**: 両方とも今回のスコープに含める。
- **理由・代替案**: 利用者の選択。「グループをまとめて移動」は、グループというまとまりを作る
  以上、メンバーを1つずつ動かすしかないのでは実用性が低いと判断されたため必須級として含めた。
  「一括クローズ」は worktree の後片付けの手間を減らす付帯機能として、あわせて含めることにした。
- **影響**: requirements.md の対象・AC9・AC10 に反映。design でグループの一括移動・一括クローズの
  具体的な操作方法を確定する。

## D3: workspace の並べ替えは D&D を主とし、キーバインドも付加する

- **背景**: 「グループをまとめて移動」（D2）には D&D が自然に馴染む一方、tab の並べ替え
  （`20260923-missing-keybinding-actions`）の前例はキーバインド（`move_tab_previous`/
  `move_tab_next`。`{tabId, direction}` の delta 移動）だった。どちらの操作方式にするか、
  または両方を実装するかを利用者に確認した。
- **決定**: 両方実装する。sidebar 上でのドラッグ＆ドロップ（`20260923-pane-name-dnd-swap` で
  確立したポインタドラッグの流儀を踏襲。主な操作方法）と、キーボード操作（新しい `ActionId` 2つ。
  `move_tab_previous`/`move_tab_next` と同じ delta 移動の形）の両方を提供する。
- **理由・代替案**: 代替案（D&D のみ）は AC-I3「キーボードだけで完結するか」の規範
  （`.aidev/conventions/` は無いが、過去の work〔`20260923-pane-name-dnd-swap`〕で確立した
  相互作用の受け入れ基準の型）に合わせにくい。キーバインドのみの代替案は「グループをまとめて
  動かす」操作がぎこちなくなる（1歩ずつしか動かせないと、離れた位置へ動かすのに何度も押す
  必要がある）。両方実装することで、それぞれの操作方法の強みを両立させた。
- **影響**: `workspace.move` protocol メソッドの params の形は、D&D の「どこへドロップしたか」
  （anchor 指定）とキーバインドの「1歩前後」（delta 指定）の両方を表現できる形にする必要がある
  （design で確定。herdr の `WorkspaceMoveParams{workspace_id, insert_index}` と `tab.move` の
  `{tabId, direction}` の両方を参考にする）。

## D4: requirements 承認後、design 工程からモードを autonomous へ切り替えた

- **背景**: 利用者から「autonomous で進めて」との明示指示があった。
- **決定**: `state.yml` の `mode` を `interactive` から `autonomous` へ書き換えた
  （`humanGates: []` は変更なし——全工程を自動で進める）。以降の design・tasks・coding・test・
  review は各工程内で自律判断し、通常どおり `aidev approve` で進める。deliver は
  `20260923-missing-keybinding-actions`・`20260923-other-agents-session-resume` と同じく
  「コミット→PR作成で停止・自動マージはしない」（protocol.md「10.」）。
- **理由・代替案**: 利用者の指示どおり。
- **影響**: 以降、方針の複数案があっても事前承認を待たず自律判断し、理由を decisions.md に残す
  （`protocol-autonomous.md`）。

## D5: workspace の並び替えを配布する新規イベント `workspace.order_changed` を design に追加する

- **背景**: tasks 工程で `packages/web/src/store/StoreAdapter.ts:89-141`（`applyEventToSession`）と
  `packages/web/src/store/session.ts:38-40`（`workspaceUpserted`：`workspaces.value.set(w.id, w)`）を
  直接確認したところ、**JS の `Map.set` は既存キーの挿入位置を変えない**——`workspace.updated` を
  何回送っても、ブラウザ側 `session.workspaces` の反復順（＝「開いた順」の実体。research.md F1・
  design.md「依拠する既存の事実」）は動かない。`moveWorkspace`/`moveWorkspacesTo`（design.md
  「インターフェース/データ構造」）はサーバ側 `Map` を作り直すだけで、動かした workspace 自身の
  フィールドは変わらないため、**既存の `workspace.updated`（`WorkspaceUpdatedEvent`）だけでは
  並び替えをブラウザへ伝えられない**——design.md にこの伝達経路が無いことに気付いた（design の
  記述漏れ。doccheck は内部一貫性しか見ないため機械的には拾えない類の欠落）。
- **決定**: 新しいイベント `WorkspaceOrderChangedEvent { event: "workspace.order_changed"; data:
  { workspaceIds: string[] } }` を `packages/protocol/src/events.ts` の `ServerEvent` に追加する。
  `moveWorkspace`/`moveWorkspacesTo` が成功したら（実際に順序が変わったときだけ）全クライアントへ
  配布する。ブラウザ側は `StoreAdapter.applyEventToSession` に `case "workspace.order_changed"` を
  追加し、`session.ts` に新しい `reorderWorkspaces(workspaceIds: string[])` を足す——サーバと同じ
  「エントリを並べ替えてから `new Map(...)` で作り直す」技法（design.md「設計方針」）をブラウザ側にも
  適用する。イベントに含まれない（ローカルにまだ無い）ID は無視し、ローカルにあるがイベントに
  含まれない workspace は末尾に残す（防御的——競合するイベント順序があっても壊れない）。
- **理由・代替案**: 代替案（`WorkspaceUpdatedEvent` を全動かした workspace ぶん配って、受信側で
  受信順を新しい順序として扱う）も検討したが、**イベントの配送順序に並び順の意味を持たせるのは
  壊れやすい**（WebSocket は同一接続内で順序を保証するが、複数動いた場合に「何番目に受け取ったか」を
  順序として使うコードは読みにくく、テストでも意図が伝わりにくい）。明示的に配列で渡す方が
  正しさが読み取りやすい。
- **影響**: `packages/protocol/src/events.ts`（新規イベント型）・`packages/server/src/session/
  SessionService.ts`（`moveWorkspace`/`moveWorkspacesTo` 呼び出し後の配布）・
  `packages/web/src/store/StoreAdapter.ts`・`packages/web/src/store/session.ts`
  （`reorderWorkspaces`）に反映する（tasks.md へ反映）。design.md の対象範囲・データ構造・
  「対象範囲」には直接書き足さない（doccheck 済みの2ラウンドを再び消費しないため）——この
  decisions.md の記載を正とし、tasks.md 側で実装対象として明記する。

## D6: coding 中の利用者指示により、deliver では PR 作成のあとマージまで行う

- **背景**: coding 工程の途中で利用者から「終わったらPRとmergeまで進めておいて」との明示指示が
  届いた。D4 で確定していた既定（autonomous でも「コミット→PR作成で停止・自動マージはしない」。
  `aidev-70-deliver`「autonomous モード時」）を、この work 限定で上書きする指示。
- **決定**: deliver 工程で PR を作成したあと、test（既に緑）・review（must/should 解消済み）を
  確認したうえで、そのまま `gh pr merge` 相当の操作まで行う。D4 の一般則自体は変えない
  （次の work では既定〔PR 作成で停止〕に戻る）。
- **理由・代替案**: 利用者の明示指示どおり。
- **影響**: deliver 工程の最終ステップとして PR マージを追加する。マージ後の worktree 撤去
  （`aidev worktree rm`）は本 work では worktree を使っていない（通常の作業ブランチ）ため対象外。

## D7: 手動グループの折りたたみ切り替えに新規 RPC `group.set_collapsed` を追加する

- **背景**: T5（`SessionModel`）の実装中、design.md「インターフェース/データ構造」の
  `SessionModel` 節（グループ CRUD のメソッド一覧）には `createGroup`/`renameGroup`/
  `deleteGroup`/`addToGroup`/`removeFromGroup` しか無く、`WorkspaceGroup.collapsed`
  （design 済み。AC6「サーバに永続化されブラウザを閉じても残る」）を切り替える手段が無いことに
  気付いた——design はデータ構造（`collapsed: boolean` フィールド自体）までは確定したが、
  それを変更する RPC までは書いていなかった（design の記述漏れ。doccheck は内部一貫性しか
  見ないため機械的には拾えない類——D5 と同じ種類のギャップ）。
- **決定**: `packages/protocol/src/messages.ts` に `GroupSetCollapsedParams { groupId, collapsed }`
  を新設し、`group.set_collapsed` として `METHOD_SCHEMAS`/`MethodResultMap` に登録する
  （結果は空。実体は `group.updated` イベントで配る——`group.rename`/`group.delete` と同じ
  「RPC は空応答、実体はイベント」の形）。`SessionModel.setGroupCollapsed(id, collapsed):
  WorkspaceGroup` を追加する。
- **理由・代替案**: 代替案（`group.rename` に `collapsed?` を足して1本化する）も検討したが、
  「名前を変えたいだけなのに折りたたみ状態も一緒に送らないといけない」呼び出し側の負担が増える。
  既存の `tab.move`/`workspace.close` のように「1操作＝1メソッド」に揃えるほうが呼び出し側が単純。
- **影響**: T2（既に完了・taskcheck 済み）に対する追加。`packages/protocol/src/messages.ts`・
  `SessionModel.ts`・`SessionService.ts`（T7）・`ActionDispatcher.ts`（T12）・`Sidebar.vue`
  （T13）に反映する。tasks.md 自体は書き換えない（該当タスクの記述「グループ CRUD」
  「折りたたみ状態」の範囲内の実装詳細として扱う）。

## D8: `composeServer.ts` の `toSessionFileData` が groups/groupId の save 経路として見つかった

- **背景**: T6（`SessionFile.ts`）実装後の typecheck で、`packages/server/src/composeServer.ts:327`
  の `toSessionFileData(session)`（`SessionFileData` を組み立てて `session.json` へ保存する関数）が
  `groups`/`workspaces[].groupId` を欠いたまま `SessionFileData` を返そうとしてエラーになった。
  `SessionModel.restoreWorkspace`/`restoreGroup`（読み込み側）は design/research で見つけていたが、
  この保存側の関数は research.md・design.md のどちらにも登場せず、tasks.md のどのタスクの
  `対象` にも挙げていなかった（探索漏れ。T7 の unplanned_lookups として数える）。
- **決定**: `toSessionFileData` に `groups: snapshot.groups.map(...)` と各 workspace の
  `groupId: ws.groupId` を追加した。
- **理由・代替案**: 唯一の保存経路なので、追加しないと手動グループ・`groupId` がプロセス再起動で
  失われる（AC6「サーバに永続化されブラウザを閉じても残る」を満たせない）。
- **影響**: `packages/server/src/composeServer.ts`（コード修正済み）。同種の save/restore
  ペアが他にも漏れていないか、T7 の実装中に `SessionService.restore()` 側も含めて確認する。

## D9: RPC 名 → `SessionService` の結線を担う `packages/server/src/surface/methods/*.ts` が
       研究・設計・tasks のどこにも挙がっていなかった

- **背景**: T7 の実装中に、`packages/protocol/src/messages.ts` の `METHOD_SCHEMAS` に登録した
  方式名（`workspace.move`・`group.create` 等）を実際に呼べるようにするには、もう1層
  `packages/server/src/surface/methods/*.ts`（`ControlSurface.register` で方式名と
  `SessionService` の呼び出しを結ぶ層。`workspace.ts`・`tab.ts` 等、方式カテゴリごとに1ファイル）
  と、その一覧を束ねる `index.ts`（`registerAllMethods`）を触る必要があると判明した。
  research.md・design.md のどちらもこの層に触れておらず（`SessionService` までで止まっていた）、
  tasks.md T7 の `対象` にも挙げていなかった（D8 と同じ種類の探索漏れ。T7 の
  `unplanned_lookups` として数える）。
- **決定**: `packages/server/src/surface/methods/workspace.ts` の `workspace.close` ハンドラを
  `closeLinkedWorktrees` 対応に拡張し、`workspace.move`/`workspace.move_to` ハンドラを追加する。
  新設の `group.ts`（`group.create`/`rename`/`delete`/`add_member`/`remove_member`/
  `set_collapsed`）を追加し、`index.ts` の `registerAllMethods` に `registerGroupMethods` を
  加える。
- **理由・代替案**: 唯一の結線経路なので、追加しないと protocol に方式を登録しただけで
  RPC として一切呼べない（`ControlSurface` が「未登録の方式」として拒否する）。
- **影響**: `packages/server/src/surface/methods/workspace.ts`・新規 `group.ts`・`index.ts`
  （コード修正済み）。

## D10: D7 の `group.set_collapsed` を `group.toggle_collapsed` に置き換えた

- **背景**: T10 のタスク点検（round1）で、`ActionDispatcher.toggleGroupCollapsed` がクライアント側で
  `!group.collapsed` を計算して送る形（D7 で決めた `group.set_collapsed { groupId, collapsed }`）だと、
  応答が返る前に連続で呼ばれたとき（すばやい2回クリック）両方が同じ古い値から同じ反転値を送ってしまい、
  2回目のトグルが効かなくなる競合が指摘された。
- **決定**: `group.set_collapsed { groupId, collapsed: boolean }` を `group.toggle_collapsed
  { groupId }` に置き換えた。`SessionModel.setGroupCollapsed(id, collapsed)` も
  `toggleGroupCollapsed(id)`（サーバ側で `!group.collapsed` を計算）に変更。
- **理由・代替案**: 既存の `pane.zoom` が `mode: "toggle"` で同じ問題（サーバの最新値から
  決めさせる）を解決済みで、その流儀に揃えた。代替案（クライアント側で楽観的更新＋サーバ応答で
  補正）も考えたが、単純な「値を渡さずサーバに反転させる」ほうが実装も単純で、既存の確立した
  流儀とも一致する。
- **影響**: D7 の内容はこの置き換えで上書きされる（D7 自体は経緯の記録として残す）。
  `packages/protocol/src/messages.ts`・`SessionModel.ts`・`SessionService.ts`・
  `surface/methods/group.ts`・`ActionDispatcher.ts`・関連テストを一括更新済み。

## D11: review 工程の指摘により、画面の並びとキーボード操作の対象順を再び一致させる共有関数を追加した

- **背景**: review（独立点検）で must 指摘。`Sidebar.vue` の `spaces` 計算をこの work の coding 中に
  `orderedWorkspaceIds`（素の開いた順）から `groupedWorkspaceRows`（グループをブロック単位でまとめる）
  へ切り替えたが、同じ「画面の並び＝操作対象順」という不変条件（`store/workspaceOrder.ts` のコメントが
  明記。20260923-missing-keybinding-actions の design D4 相当）に依拠していた
  `ActionDispatcher.workspaceDelta`（`previous_workspace`/`next_workspace`）・`navigate`（サイドバー内
  ジャンプ選択の up/down）の更新が漏れていた。手動グループに A・B、無所属の C が開いた順で
  `[A, C, B]`（画面は「A→B→C」）のとき、A に focus 中の `next_workspace` が画面上の隣の B ではなく
  C へ飛ぶ、という実害のある回帰だった。
- **決定**: `packages/web/src/store/workspaceGrouping.ts` に `visibleWorkspaceIdsInOrder`（画面に
  実際に見えている workspace id を描画順で返す。グループのヘッダー行や折りたたみ中の非focus子は
  含めない）と、その内部で使う `visibleGroupMembers`（折りたたみ＋focus例外の判定。`Sidebar.vue`
  自身の描画にも使わせ、手動/自動グループ用に重複していた同じ内容の三項演算子2箇所を統一した）を
  追加。`workspaceDelta`・`navigate` の up/down は両方この関数に切り替えた。
- **理由・代替案**: 代替案として「グループはキーボード操作では無視する（従来どおり素の順序のまま）」
  も検討したが、design がそもそも「グループは画面上の整理」という位置づけで導入したものである以上、
  キーボードだけ古い順序を辿るのは利用者から見て一貫性を欠く（見えている順と押した回数が対応しない）。
  画面の描画と操作対象順を同じ関数で求める既存パターン（`workspaceOrder.ts`・`agentOrder.ts` と同じ
  「純関数・複数箇所から共有」の形）を踏襲する方が、design の既存方針にも合致し、実装も単純。
  なお `navigate` の up/down は従来 `view.workspaceSort` すら見ない素の反復順だった（この work とは
  無関係な既存の欠落）が、共有関数への置き換えで副次的にこれも解消した——同じ関数を使う以上、
  意図的にsort-blindのままにする理由が無いため許容した。
- **影響**: `packages/web/src/store/workspaceGrouping.ts`（追加）・
  `packages/web/src/components/Sidebar.vue`（既存の三項演算子2箇所を共有関数呼び出しに置換）・
  `packages/web/src/actions/ActionDispatcher.ts`（`workspaceDelta`・`navigate`）を更新。
  旧来の `orderedWorkspaceIds`（`packages/web/src/store/workspaceOrder.ts`）は本番コードからの
  呼び出し元が0件になったが、design.md の AC11「既存の `orderedWorkspaceIds`・
  `view.workspaceSort` のロジック自体は変更しない（既存のテストは維持する）」を文字通り守るため
  削除しなかった——ロジック自体にもそのテストにも一切手を入れていない（呼び出し元が変わっただけ）。
  回帰テストを `ActionDispatcher.test.ts` に2件、`workspaceGrouping.test.ts` に単体テスト9件追加、
  負の確認済み。

## D12: review 工程の指摘により、グループのメンバー行への drop を頭の行へ正規化した

- **背景**: review（独立点検）で should 指摘。design「設計方針」はグループの内部の並びを常に
  「開いた順」に固定する（ドラッグで並べ替えない）と定めており、その実装（`groupedWorkspaceRows`
  がトップレベルの描画位置をグループの頭の index だけで決める）自体は正しかった。しかし D&D の
  ドロップ先ハイライト（`onRowPointerMove`）は実際にホバーした特定のメンバー行にそのまま付いて
  いたため、「グループの頭以外のメンバー行へドロップしても、実際の見た目は常に頭へドロップしたのと
  区別が付かない（特定の配置では見た目が完全に無変化）」のに「`workspace.move_to` は実際に状態を
  変更・配信してしまう」という、ハイライトと実効果の食い違いがあった。
- **決定**: `Sidebar.vue` に `groupHeadRowKeyFor`（ホバー中の行がグループのメンバー行〈頭以外〉
  なら、そのグループの頭の行 key に正規化する）を追加し、ホバー中のハイライト
  （`onRowPointerMove`→`setWorkspaceDragOver`）とドロップ確定（`onRowPointerUp`→
  `dropAnchorForRowKey`）の両方でこれを経由させた。
- **理由・代替案**: 代替案として「ドロップされた workspace を自動的にそのグループへ加入させる
  （`group.add_member` も呼ぶ）」も検討したが、design が既に「グループへの加入は明示的な操作
  （コンテキストメニューの『グループへ追加…』）で行う」と定めている既存方針に反するため退けた。
  「グループの頭以外は有効なドロップ先にしない（ハイライトを出さない）」も検討したが、頭の行への
  ドロップと全く同じ効果になる以上、ハイライトを出さない理由が無く、ホバー中に何も反応しないほうが
  かえって「何が起きるか分からない」体験になる。頭の行へ正規化してハイライトと実効果を一致させる
  案が最小の変更で最も一貫性が高い。
- **影響**: `packages/web/src/components/Sidebar.vue` を更新。既存の「手動グループのヘッダー行と
  その先頭メンバー行は同じ dropAnchorId を持つが、ホバー中の行だけがハイライトされる」テストは
  この正規化で前提（メンバー行は自分自身がハイライトされる）が変わったため、新しい挙動を確認する
  テスト3件に書き直した。負の確認済み。

## D13: AC8 キーバインドによる並べ替えの edge case（非アンカーメンバーの無視覚的な no-op）は
   今回は直さず backlog へ送った

- **背景**: review round1 の修正（D11・D12）を反映した最終 diff を自分で読み直している際に発見。
  `ActionDispatcher.moveWorkspace`（`move_workspace_previous`/`next`。AC8）→
  `SessionModel.moveWorkspace` は、flat な `[...workspaces.keys()]` 上で対象を**隣接1件とだけ**
  入れ替える単純な実装（グループを一切考慮しない。既存の T2/T3 実装・テストとも無関係な事前検証）。
  手動グループの**アンカーでないメンバー**を動かすとき、flat 上の隣が「同じグループの別メンバー」
  なら intra-group の表示順が変わり見える一方、隣が「別グループ/無所属の workspace」で、かつその
  入れ替えがグループの先頭（アンカー）の flat 位置をまたがない場合は、画面上のトップレベルの並びが
  一切変化しない（キーを押しても何も起きたように見えない）ことを手計算で確認した
  （`SessionModel.moveWorkspace`（`SessionModel.ts:467`）と `groupedWorkspaceRows` の組み合わせで
  再現可能。実際に workspaceGrouping.test.ts 等で自動テスト化はしていない——机上の確認に留まる）。
  design.md の概要「workspace の並び順を D&D・キーボードのどちらでも（グループはまとまりを保った
  まま）変えられ」という記述と、この edge case は厳密には整合しない。
- **決定**: このラウンドでは修正しない。`.aidev/backlog/product-roadmap.md` に follow-up 項目を
  追加し、次の機会に送る。
- **理由・代替案**: D11・D12（このラウンドで既に修正した2件）と違い、正しく直すには
  `workspace.move`（delta 方式の protocol メソッド。design decisions D3 でキーバインド用に
  意図して delta 方式を選定済み）を D&D の `workspace.move_to`（anchor 方式）のような
  グループ認識の仕組みへ作り替える必要があり、protocol・server・client の3層にまたがる設計変更に
  なる——review 1ラウンドの是正としては不釣り合いに大きい。また influenced 範囲は狭い
  （① 手動グループが存在し、② その**非アンカー**メンバーに対して、③ D&D ではなくキーバインドで
  移動し、④ flat 上の隣が偶然「グループの先頭をまたがない」位置にある、の4条件が重なる場合のみ）。
  independent review（別コンテキストの subagent）もこの edge case は指摘しておらず、
  D&D 側（finding 2 = D12）ほど発見・遭遇されやすいものではないと判断した。
- **影響**: コード変更なし。`.aidev/backlog/product-roadmap.md` に追記
  （`aidev backlog add`。`--source` は本 review.md）。`test-result.md`「未検証の穴」にも
  同内容を記録し、deliver の PR 本文「既知の制約」へ引き継ぐ。
