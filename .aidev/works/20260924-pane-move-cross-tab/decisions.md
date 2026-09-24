# 決定記録

## D1: T10（既存 pane/tab/workspace 関連テストの回帰確認）は coding ではなく test 工程で消化する

- 背景: tasks.md の他タスク（T1〜T9）は全て新規追加（既存関数・既存 RPC・既存コンポーネントの
  分岐を変更しない設計。design.md「対象範囲」）のため、既存テストへの回帰確認はコード変更を
  伴わない「確認だけ」のタスクになる。`20260924-pane-dnd-split-move` の decisions.md D3 と
  同じ状況・同じ判断。
- 決定: T10 は `aidev-40-coding` の完了の目安の例外（「test / deliver で消化するタスクは未チェックの
  まま承認してよい」）に該当するものとして扱い、test 工程で実施する。
- 影響: coding 承認時、T10 は未チェックのまま `tasks_done` から除く。test 工程の
  `test-result.md`「実行したもの」で回帰確認の結果を記録する。

## D2: `view.setView`/`focusPane` は `PaneFrame.vue` ではなく `ActionDispatcher` 側（RPC の
   応答を待ってから）で呼ぶ

- 背景: design.md「クライアント側: ドロップ先の拡張」は「確定後、いずれの経路でも
  `view?.setView(...)`...を呼ぶ」と、`PaneFrame.vue`（呼び出し元）側での実行を示唆する書き方
  だった。しかし T8 の実装中に気付いた——`movePaneToTab` の対象 tab は呼び出し時点で既知
  （`hit.tabId`）だが、`movePaneToNewTab` は新しい tab の id をサーバの応答が返るまで知りようが
  ない。両者で扱いを分けると、`PaneFrame.vue` 側の分岐が複雑になり、かつ「RPC が失敗（`ok:false`）
  したのに view だけ切り替わる」という食い違いを避けるには、いずれにせよ応答を待つ必要がある。
- 決定: `movePaneToTab`・`movePaneToNewTab` とも `ActionDispatcher` 内で RPC の応答
  （`Promise.then`）を待ってから `ok` を確認し、`true` のときだけ `view.setView`/`focusPane`・
  `registry.focus` を呼ぶ。`PaneFrame.vue` は RPC を発火するだけで、view の切り替えには関与しない
  （design が示唆した「呼び出し元で行う」という形からの小さな逸脱）。
- 理由 / 代替案: 「`movePaneToTab` だけ同期的に `PaneFrame.vue` 側で行う」代替案は、2つの
  似たアクションの間で呼び出し元の責務が非対称になり分かりにくい。また「RPC 失敗時に表示だけ
  移ってしまう」問題（design「エラー処理」の「失敗時は何もしない」という既存方針と矛盾する）を
  `movePaneToTab` の方でも生む。応答を待つ形に統一するのが最も単純で一貫性がある。
- 影響: `packages/web/src/actions/ActionDispatcher.ts` の2つの新規メソッドが view の切り替えまで
  担う。`packages/web/src/components/PaneFrame.vue`（T9）は、tab/workspace 種別のドロップでは
  `view.setView`/`focusPane` を呼ばない（`ActionDispatcher` に任せる）——design.md のその節の
  記述は、この決定を踏まえた実装だと読み替える。

## D3: `moveToTab`・`moveToNewTab` は `pane.updated`（移動した pane 自身）も発行する
   （design.md の「複数クライアントでの同期」節の漏れを coding 中に発見・修正）

- 背景: T3（SessionService のイベント配布）の実装前に、design.md が挙げていたイベント集合
  （`layout.updated`・`tab.created`/`tab.closed`・`workspace.updated`/`workspace.closed`）が
  クライアント側の受信処理でどう反映されるかを確認した。`packages/web/src/store/StoreAdapter.ts`
  を見ると、`layout.updated` は `session.tabUpserted(tab)` のみを呼び、`Pane` レコード自体は
  一切更新しない（`pane.updated`/`pane.created` だけが `session.paneUpserted(pane)` を呼ぶ）。
  一方、クライアント側には `pane.tabId` を直接参照して「この pane は今どの tab に属するか」を
  判定するコードが複数ある——`packages/web/src/store/viewRepair.ts:32` の `liveLeaves`
  （`s.panes.get(id)?.tabId === t.id` で判定。フォーカス修復の生存判定に使う）、
  `packages/web/src/actions/ActionDispatcher.ts:684` の `closeTabById` の busy 判定
  （`session.panes` を `tabId` で絞り込む）。design.md のイベント集合のままだと、pane を
  別 tab へ移動した後もクライアントの `session.panes.get(paneId).tabId` が移動前の tab を
  指したまま残り、上記2箇所が誤判定する（移動先 tab の `liveLeaves` からその pane が漏れる／
  移動元 tab の busy 判定にその pane が居座り続ける等）。
- 決定: `moveToTab`・`moveToNewTab` とも、移動した pane 自身の `pane.updated`
  （新しい `tabId` を含む `Pane`）を、`layout.updated`/`tab.created` 等と並べて必ず1回発行する。
- 理由 / 代替案: 「クライアント側で `layout.updated` 受信時に `tab.layout` の葉から
  `pane.tabId` を推測して書き換える」代替案も考えたが、`StoreAdapter.ts` の他のイベント処理は
  どれも「サーバが送った値をそのまま反映する」だけで推測をしていない——ここだけ推測を混ぜると
  一貫性が崩れ、かつサーバ側は既に更新後の `Pane` を持っているので推測する理由が無い。
  素直に `pane.updated` を足すのが最小の修正。
- 影響: `packages/server/src/session/SessionService.ts` の `moveToTab`/`moveToNewTab`
  （T3）が対象。design.md「複数クライアントでの同期」節を修正済み（この決定を反映）。

## D4: `SessionModel.moveToTab`/`moveToNewTab` はセッション全体のグローバル focus
   （`this.focus`）を更新しない——review round1 の nit 指摘への対応を見送る

- 背景: review round1 で、design「振る舞いの詳細」の「AC8 をサーバ側でも一貫させる」という
  記述に対し、実装は `tab.focusedPaneId` の更新のみで、`session.json` に永続化されローカル
  保存 view の無い新規クライアントの復元先になる `this.focus` までは更新していない、という
  指摘があった（nit）。
- 決定: この work では修正しない。`moveToEdge`/`replacePane`（前回作業
  `20260924-pane-dnd-split-move`）も同じく `this.focus` を更新しておらず、これは本 work
  固有の後退ではなく既存の一貫した挙動（`setFocus` を呼ぶのは `focusPane`/`focusTab`/
  `commitTab` 等、利用者が明示的に focus を変える操作だけで、レイアウトを書き換えるだけの
  操作〔`swapPaneWith`・`moveToEdge`・`replacePane`・今回の `moveToTab`/`moveToNewTab`〕は
  `tab.focusedPaneId` だけを更新する、という既存の切り分けに従っている）。
- 理由 / 代替案: `this.focus` の扱いを変えるなら `moveToEdge`/`replacePane` も含めた横断的な
  設計判断が必要で、この work のスコープ（AC1〜AC11）を超える。個別に今回の2メソッドだけ
  `this.focus` を更新すると、逆に「レイアウト操作は `tab.focusedPaneId` だけ」という既存の
  一貫性を崩すことになり、他の操作との非対称が新たに生まれる。
- 影響: 実害は「ローカル保存 view の無い新規クライアントが、直後に再接続すると移動した pane
  ではなく元のグローバル focus が指す pane へ復元されうる」という狭いシナリオに限られる
  （design.md の当該記述と実装の粒度のずれは記録に留める）。将来 `this.focus` の扱いを
  見直すなら、`moveToEdge`/`replacePane` も含めて backlog へ。
