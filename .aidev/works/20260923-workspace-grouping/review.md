# レビュー: workspace のグルーピングと並べ替え

## タスク点検ログ

- [must][conv:-] `WorkspaceCloseParams.closeLinkedWorktrees` を `z.boolean().default(false)` にすると
  `z.infer` の TS 型で必須フィールドになり、既存の呼び出し元（`packages/cli/src/commands/
  workspace.ts:33`）が型エラーになる（`pnpm typecheck` で確認） / 対応: `z.boolean().optional()` に変更し、
  既定は `SessionService.closeWorkspace(id, closeLinkedWorktrees = false)` の JS 既定引数に委ねた。
  `packages/protocol/src/messages.ts:124`・`messages.test.ts` を修正。 / src: T5 taskcheck round1
- [must][conv:-] `SessionService.sameGit()`（`:846-853`）が `repoKey`/`isLinkedWorktree` を比較しておらず、
  branch/ahead/behind が同じまま repoKey/isLinkedWorktree だけ変わるケース（worktree 自動グループ判定の
  根幹データ）で `updateWorkspaceGit` が早期リターンし、モデル更新・`workspace.updated` 配布ごと
  握りつぶされていた / 対応: 比較式に `a.repoKey === b.repoKey && a.isLinkedWorktree === b.isLinkedWorktree`
  を追加。`SessionService.test.ts` に3件の回帰テスト追加（負の確認：修正前のコードで実際に落ちることを
  確認済み）。 / src: T5 taskcheck round1
- [should][conv:-] `SessionModel.moveWorkspacesTo`（`:460-472`）が「実質無変化」なドロップ（移動後の並びが
  移動前と同一）を検出せず、`moveTab`/`moveWorkspace` の「無変化なら null」規約から外れていた——無意味な
  `workspace.order_changed` 配布と永続化書き込みが起きる / 対応: 並べ替え後の配列を移動前と比較し、
  同一なら null を返すガードを追加。回帰テストを1件追加（負の確認済み）。 / src: T5 taskcheck round1
- [should][conv:-] `SessionService.ts` のグループ操作メソッド（`renameGroup`/`setGroupCollapsed`/
  `deleteGroup`/`addToGroup` の groupId 引数）が素の `string` で、`SessionModel` 側が `GroupId` 型
  （`WorkspaceId`/`TabId` と同じ流儀）を使っているのと揃っていなかった / 対応: 4メソッドの引数型を
  `GroupId` に変更。 / src: T5 taskcheck round1
- [nit][conv:-] `messages.ts` の `GroupRenameParams`/`GroupDeleteParams`/`GroupAddMemberParams`/
  `GroupSetCollapsedParams` がそれぞれ `groupId: z.string().min(1)` を個別に書いており、
  `workspaceId`/`tabId`/`paneId`/`splitId` の共有 const 化の流儀と揃っていなかった / 対応: 共有 const
  `groupId` を新設し、4箇所を置き換えた。 / src: T5 taskcheck round1
- [should][conv:-] `workspaceGrouping.ts` の `autoGroupsOf`（`:33-46`）の「本体が候補に無ければ先頭を
  暫定的に親にする」フォールバックが、design が想定する「GitInfoPoller の周期の谷間」だけでなく、
  「本体が手動グループに入っていて候補〔groupId===null〕から恒常的に外れている」ケースにも発火し、
  linked worktree の1つを本体と誤って表示し続けてしまう / 対応: フォールバック発火前に、渡された
  workspace 全体（候補フィルタ前）に本体が実在しないかを確認するガードを追加。本体が別の場所
  （手動グループ）に実在する場合は、その repoKey の自動グループ自体を作らない。回帰テストを2件追加
  （負の確認済み）。 / src: T9 taskcheck round1
- [nit][conv:-] `linkedWorktreeChildrenOf`（`:68-81`）は呼び出しごとに `autoGroupsOf` を全件再計算する
  ため、workspace 1件ずつループしながら呼ぶ使い方をすると O(n²) 相当になりうる / 対応: 想定する
  呼び出し方（`ConfirmDialog` が開いたときに対象1件だけ呼ぶ。ループでは使わない）を明記するコメントを
  追加。実際の呼び出し箇所（T17）もこの前提を守る。 / src: T9 taskcheck round1
- [should][conv:-] `ActionDispatcher.toggleGroupCollapsed` がクライアント側で `!group.collapsed` を
  計算して送っており、応答前に連続で呼ばれる（すばやい2回クリック）と両方が同じ古い値から同じ結果を
  送り、2回目が効かなくなる。`pane.zoom` の `mode: "toggle"` と同じ「サーバに決めさせる」流儀と
  不整合だった / 対応: `group.set_collapsed { groupId, collapsed }` を `group.toggle_collapsed
  { groupId }` に置き換え、`SessionModel.toggleGroupCollapsed`（サーバ側で反転）に変更した。
  プロトコル・SessionModel・SessionService・surface/methods・ActionDispatcher・関連テストを
  一括更新。 / src: T10 taskcheck round1
- [should][conv:-] `ActionDispatcher.confirmCreateGroup` の `group.create`→`group.add_member` の
  チェーンだけ `void` が付いておらず、ファイル内の他の投げっぱなしリクエストと不整合だった / 対応:
  `void` を追加。 / src: T10 taskcheck round1
- [should][conv:-] 同じ `confirmCreateGroup` で、`group.create` 成功後の `group.add_member` だけが
  失敗した場合も「グループを作成できませんでした」という同じ文言を出しており、実際にはグループ自体は
  作成済み（空のグループが残る）なのに「作成失敗」と誤って伝えていた / 対応: `group.add_member` の
  失敗を別の catch で受け、「グループは作成しましたが、workspace の追加に失敗しました。」に分けた
  （ロールバックはしない——空のグループは design のエラー処理どおり無害）。回帰テストを2件追加。 /
  src: T10 taskcheck round1
- [should][conv:-] `confirmClose(closeLinkedWorktrees)` が `ctx.targets` 内の workspace 対象すべてに
  同じ値を渡しており、`ConfirmDialog.vue` 側の表示条件（workspace 対象1件のときだけチェックボックスを
  出す）と実際には結び付いていなかった——将来 workspace 対象が複数になる呼び出し元が増えると、
  意図しない workspace の worktree まで一緒に閉じる恐れがあった / 対応: workspace 対象が1件のときだけ
  `closeLinkedWorktrees` を適用するガードを追加。回帰テストを1件追加。 / src: T10 taskcheck round1
- [nit][conv:-] `ContextMenu.vue` でグループの「名前を変更」だけ、pane・tab・workspace の既存3箇所
  （「名前の変更」）と助詞が異なっていた / 対応: 「名前の変更」に統一。 / src: T10 taskcheck round1
- [nit][conv:-] `ActionDispatcher.moveWorkspace` が `moveTab`（tab の実在を確かめてから送る）と違い、
  `view.workspaceId` の実在確認をせずに送っていた（閉じた直後の stale な id で空振りの要求を送る
  ——サーバ側で無視されるだけで実害は小さい） / 対応: `session.workspaces.has(workspaceId)` の
  確認を追加。回帰テストを1件追加。 / src: T10 taskcheck round1
- [must][conv:-] `Sidebar.vue` の `.sidebar-row-drop-target`（`:331`）の条件式が、ホバー中の行の
  `dropAnchorId` と**その行自身の** `dragIds` を比較しており、`dropAnchorId` は常にその行の
  `dragIds` に含まれるため論理積が原理的に常に false——ドロップ候補のハイライトが一度も表示されない
  死んだロジックだった / 対応: 比較対象を「ホバー中の行自身の dragIds」ではなく「ドラッグの発生源
  （`view.workspaceDrag.sourceIds`）」に変更。回帰テストを1件追加（負の確認：修正前の条件式に
  戻すと実際に落ちることを確認済み）。 / src: T13 taskcheck round1
- [must][conv:-] グループの折りたたみボタン（`.sidebar-group-toggle`）が `@click.stop` しか
  持たず、`@pointerdown`/`@pointerup` は行へ伝播していた。実際のクリックは pointerdown→pointerup→
  click の順にすべてバブルするため、行の `onRowPointerDown`/`onRowPointerUp` も発火し——手動
  グループの頭では `onToggleCollapse` が2重に呼ばれ、worktree 自動グループの頭では意図せず
  `focusWorkspace` が呼ばれてしまっていた（コメントに明記した意図「二重に起こさない」に反する
  実装だった） / 対応: ボタンに `@pointerdown.stop`・`@pointerup.stop` を追加。回帰テストを2件
  追加（負の確認：`.stop` を外すと実際に落ちる——ただし最初に書いたテストは `.trigger("click")`
  だけで pointerdown/pointerup を発火させておらず、`.stop` の有無に関わらず通っていた。バグを
  再現できていなかったテストと気付き、pointerdown/pointerup も明示的に発火する形に書き直してから
  負の確認をやり直した）。 / src: T13 taskcheck round1
- [should][conv:-] ドラッグ中に対象行が DOM から消えるケース（他クライアントの操作で workspace が
  閉じる・グループが折りたたまれる等）の後始末が、`PaneFrame.vue`（`@lostpointercapture` も張る）と
  比べて手薄だった / 対応: 行に `@lostpointercapture="onRowPointerCancel($event)"` を追加
  （`PaneFrame.vue` の `onNamePointerCancel` と同じ形）。 / src: T13 taskcheck round1
- [should][conv:-] `onRowPointerUp` が、ドロップ確定時に使う対象を「ドラッグ開始時点のスナップ
  ショット」ではなく「pointerup 時点でテンプレートに束縛された（再計算されうる）`row`」から
  取っていた——ドラッグ中に `spaces` が再計算される（グループ構成が変わる等）と、ハイライトで
  見せていた移動対象と実際に移動する workspace の集合がずれるおそれがあった / 対応:
  `workspaceDragStart.row`（開始時点のスナップショット）を `draggedRow` として保持し、ドロップ
  確定時はそちらの `dragIds`/`workspace` を使うよう変更。回帰テストを1件追加（負の確認済み）。 /
  src: T13 taskcheck round1
- [should][conv:-] 手動グループのヘッダー行の `dropAnchorId`（`allIds[0]`）が、その先頭メンバー
  行自身の `dropAnchorId`（`ws.id`）と同じ値になる（両方とも同じ workspace id）ため、展開状態で
  どちらかにポインタが乗ると**両方**が `sidebar-row-drop-target` としてハイライトされてしまって
  いた（実際にポインタが乗っているのは片方だけ） / 対応: ホバー中の行の特定を `dropAnchorId`
  （ドロップ先の workspace id。複数行で重複しうる）ではなく、常に一意な `row.key` で行うよう変更
  （`data-workspace-row-key` 属性・`view.workspaceDrag.overRowKey`〔`overWorkspaceId` から改名〕・
  `dropAnchorForRowKey` で行 key → 実際の anchor id を引く）。回帰テストを1件追加（負の確認：
  古い `dropAnchorId` 比較に戻すと実際に落ちることを確認済み）。 / src: T13 taskcheck round2
- [should][conv:-] ドラッグの掴み手になる `.sidebar-row`（ラベルの文字列を含む）に
  `user-select: none` が無く、ドラッグ中に文字列が選択される見た目の不具合がありえた
  （`PaneFrame.vue` の `.pane-frame-name` は同じ理由で明示的に追加済み） / 対応:
  `.sidebar-row` に `user-select: none` を追加。 / src: T13 taskcheck round2
- [must][conv:-] worktree 自動グループの「本体（親）」判定が、クライアント
  （`workspaceGrouping.ts` の `autoGroupsOf`）とサーバ（`SessionModel.
  linkedWorktreeGroupMembers`）で食い違っていた——サーバ側は `groupId`（手動グループ優先）を
  見ておらず、手動グループに入っている linked worktree も無条件に一括クローズの対象に含めて
  しまい、`ConfirmDialog` が表示する件数（クライアント側の計算）より実際に閉じる件数（サーバ側の
  計算）が多くなりうる不整合があった / 対応: `linkedWorktreeGroupMembers` を `autoGroupsOf` と
  全く同じロジック（`groupId===null` の候補フィルタ→ 2件未満なら空 → 明示的な本体が無ければ先頭を
  暫定親に）に書き直した（サーバとクライアントは別ランタイムなので実装は共有せず、ロジックを
  書き写して揃えた）。回帰テストを4件追加（負の確認済み）。 / src: cross-check round1
- [must][conv:-] 「GitInfoPoller の周期の谷間で本体が候補に無ければ先頭を暫定的に親にする」
  フォールバック（design にも明記。クライアント側にのみ実装済みだった）がサーバ側に無く、
  `linkedWorktreeGroupMembers` は暫定親についても `isLinkedWorktree` を理由に本体でないと
  判定して空を返していた——チェックボックスが「束ねて閉じる」と約束したのに、実際には何も
  束ねずに終わる無言の不整合があった / 対応: 上記の書き直しに暫定親のフォールバックも含めて
  一緒に直した（同じ修正で両方解消）。 / src: cross-check round1
- [must][conv:-] cross-check round1 で `linkedWorktreeGroupMembers` を `autoGroupsOf` に揃えた
  際、client 側が持つ**もう一つのガード**（「候補の中に本体が無ければ、本体が全 workspace の
  どこにも実在しないときだけ先頭を暫定親にする——手動グループ等で候補から外れているだけで本体が
  実在するなら、フォールバックせずグループを作らない」）を移植し忘れていた——サーバ側は無条件に
  「候補の中に本体が無ければ先頭へフォールバック」していたため、本体が手動グループに入っていて
  候補から外れているケースで、client は「束ねるものは無い」と判断するのに server 単体は「束ねる
  ものがある」と答える食い違いが再度残っていた（round1 のドキュメントコメントは「全く同じ判定を
  行う」と書いていたが、実際には一致していなかった） / 対応: `explicitParent` が見つからない場合、
  `realMainExistsElsewhere`（`repoKey` が同じで `isLinkedWorktree===false` な workspace が
  candidates 以外を含む全体に存在するか）を確認し、存在すれば `[]` を返すガードを追加——
  `autoGroupsOf` の `workspaces.some(...)` 分岐と同じ形。回帰テストを1件追加（負の確認：ガードを
  外すと実際に落ちることを確認済み）。 / src: cross-check round2

## レビュー（review 工程）

独立点検（別コンテキストの subagent に委譲。`requirements.md`/`design.md`/`decisions.md`/
`review.md`（タスク点検ログ）/AGENTS.md/`test-result.md` を通読させたうえで diff 全体を読ませた）。
タスク点検・cross-check で既出の指摘（上記）は対象外とし、それらが構造的に拾いにくい
「価値適合・規約適合・保守性・複数の設計判断の組み合わせで初めて表面化する不整合」に絞った。

### ラウンド1

- [must][conv:-] `packages/web/src/components/Sidebar.vue`（`spaces` 計算。20260923-workspace-grouping
  で `orderedWorkspaceIds` から `groupedWorkspaceRows` に切り替え）と
  `packages/web/src/actions/ActionDispatcher.ts` の `workspaceDelta`（`previous_workspace`/
  `next_workspace`）・`navigate`（サイドバー内のジャンプ選択の up/down）の食い違い。画面の並びが
  グループ導入でブロック単位に変わったのに、`workspaceDelta`/`navigate` は据え置きの素の反復順の
  ままで、`store/workspaceOrder.ts` が明記する不変条件（画面で見る順と操作の対象順を構造的に
  一致させる。design D4 相当）をこの work が破っていた。手動グループに A・B、無所属の C が
  flat 順で `[A, C, B]`（画面上は「A→B→C」）のとき、A に focus 中に next_workspace を押すと
  画面上 A の真下の B ではなく C へ飛ぶ、という実害。 / 対応:
  `packages/web/src/store/workspaceGrouping.ts` に `visibleWorkspaceIdsInOrder`（画面に実際に
  見えている workspace id を描画順で返す共有純関数。グループのヘッダー行・折りたたみ中の
  非focus子は含めない）を追加し、`workspaceDelta`・`navigate` の up/down 双方をこれに切り替えた
  （`navigate` の up/down は従来 `workspaceSort` すら見ていなかった素の反復順だったため、この
  置き換えで副次的にその欠落も解消している——同じ共有関数を使う以上、別々の対応にする理由が無い
  ため意図的に含めた）。折りたたみ＋focus例外の判定（`Sidebar.vue` に手動/自動グループ用に
  2箇所あった同じ内容のインライン三項演算子）も `visibleGroupMembers` という1つの共有関数に
  まとめ、`Sidebar.vue`・新ヘルパーの両方がそこを呼ぶ形にした（同じ判定を複数箇所に書き分けない）。
  回帰テストを `ActionDispatcher.test.ts` に2件・`workspaceGrouping.test.ts` に9件追加、
  負の確認済み（`workspaceDelta`/`navigate` を元の素の反復順に戻すと新テスト2件が実際に失敗する
  ことを確認 → 復元）。旧来の `orderedWorkspaceIds`（`workspaceOrder.ts`）は本番コードの呼び出し元が
  0件になったが、design.md AC11「既存の `orderedWorkspaceIds`… の既存のテストは維持する」を
  文字通り守るため削除しなかった（ロジック自体・そのテストには一切手を入れていない）。
  / src: review round1

- [should][conv:-] `Sidebar.vue` の D&D 確定（`onRowPointerUp`）と `workspaceGrouping.ts` の
  `groupedWorkspaceRows` の組み合わせ。グループの内部の並びは design「設計方針」により常に
  「開いた順」で固定（ドラッグで並べ替えない）と明記されているため、グループの**先頭（頭）以外**の
  メンバー行へドロップしても、トップレベルの描画位置はグループの頭の index だけで決まり、見た目は
  常に「グループの頭へドロップしたのと同じ」になる——にもかかわらずホバー中のハイライトは実際に
  ホバーした特定のメンバー行に付いていたため、「メンバーの数だけドロップ位置があるように見えて
  実際は1箇所しか無い」「特定の配置では見た目が完全に無変化なのに `workspace.move_to` は実際に
  状態を変更・配信してしまう」という食い違いがあった（design が既に定めた「グループは1ブロック」
  というポリシー自体は正しい実装だったが、ハイライトとの整合が取れていなかった）。 / 対応:
  `Sidebar.vue` に `groupHeadRowKeyFor`（ホバー中の行がグループのメンバー行なら、そのグループの
  頭の行 key に正規化する）を追加し、ホバー中のハイライト（`onRowPointerMove`）とドロップ確定
  （`onRowPointerUp`）の両方でこれを経由させた。以後、グループのどのメンバー行にホバー／ドロップ
  しても「頭の行へドロップしたのと同じ」として一貫し、ハイライトと実際の効果が常に一致する。
  既存の「手動グループのヘッダー行とその先頭メンバー行は同じ dropAnchorId を持つが…」テストは
  この正規化により前提が変わったため、新しい挙動（メンバー行のどこにホバーしても頭の行が
  ハイライトされる／実際に送る対象は頭の dropAnchorId になる）を確認するテストに書き直した
  （3件）。負の確認済み（正規化を外すと新テストが実際に失敗することを確認 → 復元）。
  / src: review round1

### 全体所見（round1 後）

上記2件を修正後、`pnpm -s typecheck`（exit 0）・`pnpm -s test`（2800 passed / 0 failed、160
ファイル）を再実行しグリーンを確認。

### ラウンド2（round1 の修正を自分で読み直した際の追加発見）

- [should][conv:-] `packages/server/src/session/SessionModel.ts:467`（`moveWorkspace`）が
  flat 配列上の隣接1件とだけ入れ替える単純な実装で、グループを一切考慮しない
  （T2/T3 の既存実装・既存テストとも無関係の、この work 以前からの実装のまま）。手動グループの
  **アンカーでないメンバー**をキーバインド（AC8: `move_workspace_previous`/`next`）で動かすとき、
  flat 上の隣が別グループ/無所属で、かつ入れ替えがグループのアンカーの flat 位置をまたがない
  場合、画面上のトップレベルの並びが一切変化しない（無反応に見える）。design.md 概要の
  「D&D・キーボードのどちらでも（グループはまとまりを保ったまま）変えられ」という記述と厳密には
  整合しない。D&D 側の同種の問題（round1 の should = D12）は正規化で修正済みだが、キーバインド側は
  `workspace.move`（delta 方式。design decisions D3 でキーバインド用に意図して選定済み）を
  anchor 方式へ作り替える protocol 変更が要り、review 1ラウンドの是正としては不釣り合いに大きい。
  影響範囲も狭い（手動グループの非アンカーメンバー×キーバインド操作×特定の flat 配置、の重なりが
  必要）。 / 対応: 今回は修正せず、`.aidev/backlog/product-roadmap.md` に follow-up 項目を追加
  （`decisions.md` D13）。コード変更なし・回帰なし。 / src: review round2（自己点検）

### 全体所見（round2 後）

round2 の指摘はコード変更を伴わない（backlog 送り）ため、再テストは不要。round1 の修正を含めた
最終状態で `pnpm -s typecheck`・`pnpm -s test`・`aidev coverage --strict`・`aidev smoke` は
いずれも green（test-result.md 参照）。以降のラウンドで新規指摘なし。
