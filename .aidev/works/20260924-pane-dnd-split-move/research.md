# 調査: D&D による pane の分割・分割解除

## 調査の問い

- Q1: サーバ側のレイアウト操作（`LayoutTree.ts`）は、既存の pane を「分割」「分割解除（吸収）」する
  操作を、新しい純関数を足さずに既存の組み合わせだけで表現できるか。
- Q2: 分割方向（上下左右）は、現状のモデルでどこまで表現できるか。
- Q3: `pane.split`/`pane.close`/`pane.swap_with` の RPC・イベント配布の既存パターンはどう繋がっているか。
- Q4: `PaneFrame.vue` の既存ドラッグ機構（`20260923-pane-name-dnd-swap`）を、ゾーン判定（縁/中央）に
  拡張するにはどこを触るか。
- Q5: ドロップ先のゾーン判定（縁と中央の境界）について、確立した UI パターンはあるか。
- Q6: zoom（`pane.zoom`）中の pane はこの操作とどう干渉するか。
- Q7: `20260923-pane-name-dnd-swap` の taskcheck/review で見つかった落とし穴のうち、この work にも
  当てはまるものは何か。

## 判明した事実

### レイアウト木の操作（`LayoutTree.ts`）

- F1: `LayoutNode` は二分木（`{type:"pane",paneId}` か `{type:"split",id,dir,ratio,a,b}`）。
  `dir: SplitDirection` は **`"right"｜"down"` の2値のみ**（`packages/protocol/src/model.ts:8,64`）。
  「左」「上」という方向は**モデルに存在しない**。
- F2: `split(node, targetPaneId, direction, newPaneId, newSplitId, ratio=0.5)`
  （`LayoutTree.ts:29-49`）は、`targetPaneId` の葉を `{type:"split", dir:direction, a:{target}, b:{new}}`
  に置き換える。**`target` は常に `a`（左/上）、`new` は常に `b`（右/下）に固定**——「新しい pane を
  target の左/上に挿入する」ことは、この関数の引数の順序だけでは表現できない。
  `newPaneId` が既に木の中に存在するかどうかはチェックしない（呼び出し側の責任）。
- F3: `remove(node, paneId)`（`LayoutTree.ts:56-66`）は、`paneId` を木から取り除き、**親の split が
  1枚の pane しか持たなくなったらその split を消して残った側を親の位置へ引き上げる**
  （コメント「tmux の pane 削除と同じたたみ方」）。**最後の1枚を消そうとすると `null` を返す**
  （tab を閉じる合図。呼び出し側が処理する。コメントに明記）。
- F4: `swap(node, paneIdA, paneIdB)`（`LayoutTree.ts:69-76`）は、木の**形は変えず**2つの葉の
  `paneId` を交換するだけの純関数。`paneIdA`/`paneIdB` は隣接である必要が無い
  （`SessionModel.swapPaneWith` のコメントに明記。`SessionModel.ts:617-619`）。
- F5: **「分割解除（ドロップ先の中央）」は、既存の `swap` + `remove` の2手で表現できる**
  （このセッションで手計算により確認。新しい LayoutTree 関数は不要）:
  1. `swapped = swap(node, X, Y)`（X がドラッグした pane、Y がドロップ先）→ X が Y の旧位置へ、
     Y が X の旧位置へ、互いに入れ替わる。
  2. `result = remove(swapped, Y)`（Y は今 X の旧位置にいる）→ その split が畳まれ、X の旧い兄弟が
     昇格する。結果、X は Y の旧位置（旧スペース）をそのまま占め、Y は消え、X の旧位置の split も
     畳まれている。要件の「両側で畳まれる」（AC6）を1回の `swap`+`remove` で満たす。
  2パネルしかない tab（X・Y の2枚だけ）でも成立することを手計算で確認済み（`swap` は形を変えない
  ため実質 no-op、`remove(_, Y)` で1枚 X だけの木になる）。
- F6: **「分割（ドロップ先の縁）」は `remove` + `split` の2手で表現できるが、F1/F2 の制約により
  「右」「下」の2方向にしか素直に対応できない**:
  1. `withoutX = remove(node, X)`（X を旧位置から除去。X≠Y かつ Y も木内に存在するため、
     このケースで `remove` が `null` を返すことは無い）。
  2. `result = split(withoutX, Y, direction, X, newSplitId)`。
  - **「右」「下」の縁は上記で狙いどおり**（Y が a=左/上、X が b=右/下に来る）。
  - **「左」「上」の縁は F2 の制約でそのまま実現できない**（`split()` は常に target=a・new=b の
    順で置く。X を Y の左/上に置きたい場合、target/new の役割を逆にする必要があるが、
    現状の `split()` の引数の意味〔target 自身が分割される〕とは合わない）。
    **「左」「上」への分割を実現するには、`LayoutTree.ts` に新しい関数（例:
    どちらの pane を `a` 側に置くか選べる版の `split`、あるいは `insertSibling` 相当）を
    足すか、既存の `split()` にオプション引数を足す必要がある**——design で決めること
    （このセッションでは決定しない。requirements.md AC1 は4方向を要求しているため、この
    ギャップは design が必ず解消する必要がある）。

### RPC・イベント配布の既存パターン

- F7: `pane.split`（`packages/server/src/surface/methods/pane.ts:17` → `SessionService.splitPane`
  `SessionService.ts:450-479`）は**新しい PTY を実際にスポーンする**（`this.spawnForPane(newPaneId, ...)`。
  `SessionService.ts:463`）。つまり既存の `pane.split` は「新しい pane（新しいプロセス）を作って
  分割する」専用で、**「既存の pane を移動して分割する」ためにはそのまま使えない**
  （新しい RPC か、既存 RPC のバリアントが要る）。
- F8: `pane.close`（`SessionService.closePane`。`SessionService.ts:482-505`）は
  `this.model.closePane(paneId)` の結果（`removedPaneIds`/`removedTabIds`/`closedWorkspaceId`）に
  応じて `pane.closed`・`tab.closed`・`workspace.closed`・`workspace.updated`・`layout.updated` を
  使い分けて配布する。**プロセスの破棄（`this.terminals.dispose(pid)`）も行う**——「分割解除」で
  ドロップ先の pane を閉じる操作は、既存の `pane.close`（または `SessionModel.closePane`）と
  同じ「プロセスを実際に終了させる」経路を通る必要がある（AC7 の裏付け）。
- F9: `pane.swap_with`（`packages/server/src/surface/methods/pane.ts:77` →
  `SessionService.swapPaneWith`。`SessionService.ts:541-549` → `SessionModel.swapPaneWith`。
  `SessionModel.ts:621-629`）が**最も近い precedent**——プロセスを一切触らず、レイアウト木だけを
  書き換えて `layout.updated` イベント（`data:{tab}`）を1回配布するだけの単純な形。
  `SessionModel.swapPaneWith` は「同一 tab の別 pane でなければ何もせず `false`」を返す
  （`paneId===otherPaneId` ガード・`other.tabId !== pane.tabId` ガード）。**新しい「分割」
  「分割解除」の RPC も、同じ「同一 tab 内限定・成否を bool で返す」形にすることが自然**
  （requirements.md AC9「同一 pane 自身へのドロップ・tab の外側へのドロップでは何も起きない」と整合）。
- F10: **配布イベントは `layout.updated`**（`packages/protocol/src/events.ts:58-59`）であって
  `tab.updated` ではない（requirements.md の非機能要件がこの点を「design で確定する」としていたが、
  既存の precedent〔F9〕から `layout.updated` を使うのが自然——design で明記すること）。
- F11: `PaneSplitParams`/`PaneSwapWithParams`/`PaneCloseParams` の現行スキーマ
  （`packages/protocol/src/messages.ts:205-245`）:
  ```ts
  PaneSplitParams = { paneId, direction: "right"|"down", ratio?: number(0.05-0.95), newCwd?: NewCwd }
  PaneCloseParams = { paneId }
  PaneSwapWithParams = { paneId, otherPaneId }
  ```
  新しい「分割（既存 pane を移動）」RPC は、`PaneSplitParams` に似た形（`paneId`＝ドロップ先,
  `direction`, ただし「新しい pane を作る」の代わりに「移動する既存 pane の id」を渡す形）になる
  はず。「分割解除」RPC は `PaneSwapWithParams` に似た形（`paneId`＝ドラッグした pane,
  `otherPaneId`＝閉じる対象）になるはず。**具体的なパラメータ名・1つの複合 RPC にまとめるか
  2つに分けるかは design で決める**（このセッションでは決定しない）。

### クライアント側の既存ドラッグ機構（`PaneFrame.vue`。`20260923-pane-name-dnd-swap`）

- F12: ドラッグは Pointer Events（`pointerdown`/`pointermove`/`pointerup`/`pointercancel`。
  `setPointerCapture`）で実装されている。**HTML5 Drag and Drop API は使っていない**
  （`.aidev/works/20260923-pane-name-dnd-swap/decisions.md` D1。ブラウザ既定のゴースト画像・
  カーソル挙動を避けるため）。`DRAG_THRESHOLD_PX = 6`（`PaneFrame.vue:78`）。
- F13: `paneIdAt(x, y)`（`PaneFrame.vue:93-96`）が `document.elementFromPoint` →
  `closest("[data-pane-id]")` でドロップ先候補の pane id を求める。**現状はどの pane かだけを
  判定し、pane 内のどの位置（縁/中央）かは見ていない**——ゾーン判定を足すには、この関数の呼び出し元
  （`onNamePointerMove`/`onNamePointerUp`）で、対象 pane の `getBoundingClientRect()` と
  ポインタ座標を比較する処理を追加することになる。
- F14: ドラッグの状態は `view.paneDrag = {sourcePaneId, overPaneId} | null`
  （`packages/web/src/store/view.ts:214`）。`startPaneDrag`/`setPaneDragOver`/`endPaneDrag`
  （`view.ts:336-348`）。**`overPaneId` は pane 単位の文字列で、ゾーン情報を持たない**——
  新しい機能では `overZone`（例: `"top"|"bottom"|"left"|"right"|"center"|null`）のような
  フィールドをこの状態に追加する必要がある。
- F15: `isDropTarget`（`PaneFrame.vue:71-74`）は `drag.overPaneId === props.paneId &&
  drag.sourcePaneId !== props.paneId` という真偽値で、`.pane-frame-edge-drop-target`
  （CSS。ハイライト）に使われる。**pane 単位のみ**——ゾーンごとのハイライトには、ゾーンごとの
  CSS クラス（例: 4辺のオーバーレイ要素、または `:class` にゾーン名を足す）が要る。
- F16: ドロップの確定は `onNamePointerUp`（`PaneFrame.vue:117-137`）。`target = paneIdAt(...)`
  が自分以外の有効な pane なら `actions?.swapPanesByDrag(props.paneId, target)` を呼び
  （`ActionDispatcher.ts:534-536` → `conn.request("pane.swap_with", {paneId, otherPaneId})`）、
  その後 `view?.focusPane(props.paneId)`・`registry?.focus(props.paneId)` で**ドラッグした pane
  自身に明示的にフォーカスを移す**（`decisions.md` D6。`swapPaneWith` は `focusedPaneId` を
  書き換えないため、呼び出し元が明示的に移す必要があると判明した経緯あり——要件AC8 と同じ形）。
- F17: `onEscapeDuringDrag`（`PaneFrame.vue:81-90`）で Esc キー押下時に `cancelDrag()`。
  さらに `watch(() => view?.openDialog, ...)`（`PaneFrame.vue:150-155`）で、ドラッグ中に
  モーダルダイアログが開いたら `isDragSource` の場合だけ即座に `cancelDrag()`
  （`decisions.md` D8。taskcheck の cross-check round2 で発見された欠落——Esc だけを precedent から
  採用し、ダイアログ経由の中断を見落としていた）。
  `onBeforeUnmount`（`PaneFrame.vue:157-168`）でも、ドラッグ中に自分自身が消えたら
  `cancelDrag()`（他クライアントの close 等）。**この2つの後始末（ダイアログ・自分の消失）を
  新しい分割/分割解除の実装でも同じパターンで踏襲する必要がある**。

### UI パターン（縁 vs 中央のしきい値）— 一般知識。今回のセッションで一次資料は確認していない

- F18: VS Code のエディタグループのドラッグ分割は広く知られた挙動として、ドロップ先グループの
  端に近い領域（目安: その軸の 25〜33% 程度）にホバーするとその方向への分割を示すハイライトが出て、
  それ以外（中央寄りの残り）は「そのグループへタブとして統合」を示すハイライトになる。
  **この数値は一般的な知識で、この調査セッション中に VS Code の一次資料・ソースコードを
  確認したものではない**（`ToolSearch`/`WebSearch`/`WebFetch` の利用可否をこのセッションでは
  確認していない）。design がこの値を正式に採用する場合は、独自に妥当性を検証するか、
  「確立したパターンに倣った推定値」であることを明記した上で採用すること。
- F19: Windows Terminal・tmux にはマウスドラッグでの pane 分割 UI は無い（tmux は端末アプリで
  そもそも自由な pane ドラッグの概念が無い。Windows Terminal は現行バージョンでタブのドラッグは
  あるが pane 分割はキーボード/コマンドパレット操作のみ、という一般的な認識）。**これも一次資料の
  確認はしていない**——design が確立パターンとして引用するなら VS Code が最有力の precedent になる。

### zoom（`pane.zoom`）との干渉

- F20: `PaneLayout.vue:110` `singlePaneId = props.zoomedPaneId ?? (...)` —
  **zoom 中は zoom されている pane 以外、レイアウト木の他の pane はそもそも DOM に描画されない**
  （`pane-layout-zoomed` クラス。他の `PaneFrame` インスタンス自体が存在しない）。
  したがって、zoom 中は「別の pane の縁/中央へドロップする」という操作の対象（ドロップ先）が
  画面上に存在せず、**この機能への特別なガードは基本的に不要**——ドラッグを試みても
  `paneIdAt`/`elementFromPoint` が他の pane を見つけられないため自然に不成立になる、という
  想定（実機/E2E での確認は test 工程で行う）。
- F21: `SessionModel.ts:332` のコメント「pane を閉じたら zoom を解除する（herdr の
  `Tab::detach_pane` と同じ。D100）」——「分割解除」でドロップ先の pane を閉じる際、その pane が
  たまたま `zoomedPaneId` だった場合（別クライアントが zoom していた等）の解除は、既存の
  `closePane`/`LayoutTree` 経由の処理に**既に含まれている**はず（`LayoutTree.remove`ではなく
  `SessionModel` 側の別ロジック。coding 時に該当箇所を確認すること。未特定）。

## 影響範囲

- `packages/protocol/src/messages.ts`（新規/拡張 RPC パラメータ）・`packages/protocol/src/events.ts`
  （既存の `layout.updated` を再利用する見込み。新規イベントは恐らく不要）。
- `packages/server/src/session/LayoutTree.ts`（「左」「上」への分割を表現する新しい関数、または
  既存 `split()` の拡張。F6 参照）。
- `packages/server/src/session/SessionModel.ts`・`SessionService.ts`（新しい RPC ハンドラの追加。
  `swapPaneWith`/`splitPane`/`closePane` が precedent）。
- `packages/server/src/surface/methods/pane.ts`（RPC 登録）。
- `packages/web/src/store/view.ts`（`paneDrag` にゾーン情報を追加）。
- `packages/web/src/components/PaneFrame.vue`（ゾーン判定・ゾーンごとの視覚フィードバック・
  ドロップ確定時の新 RPC 呼び出し）。
- `packages/web/src/actions/ActionDispatcher.ts`（`swapPanesByDrag` と同じ形の新しいメソッド）。

## 実現性 / リスク

- R1 **「左」「上」への分割は既存の `LayoutTree.split()` だけでは表現できない**（F6）。design で
  新しい純関数（または `split()` の拡張）を確定させる必要がある。ここを甘く見積もると、4方向対応の
  AC1 がタスク分解時に想定より大きくなる。
- R2 **「分割解除」は `swap`+`remove` の組み合わせで実現できる**という手計算（F5）は、このセッション
  内での机上検証であり、実装時にユニットテストで必ず裏付けること（design/tasks の申し送り）。
- R3 zoom 中のガードは「自然に不成立になるはず」という推測（F20）にとどまり、実機/ブラウザでの
  確認はしていない。test 工程で明示的に確認すること。
- R4 VS Code の縁/中央のしきい値（F18）は未検証の一般知識。design が具体的な px/% を決める際は、
  「確立パターンに倣った推定値」である旨を design.md に明記すること（doccheck で「出所の無い断定」
  として指摘されないように）。

## 実装アンカー

- A1: レイアウト操作の純関数 — `packages/server/src/session/LayoutTree.ts`
  （`split`/`remove`/`swap` は既存。「左/上」対応の新関数は未特定 — design で仕様を固めてから
  coding 側で追加）。
- A2: サーバ RPC ハンドラの precedent — `packages/server/src/session/SessionService.ts:541-549`
  `swapPaneWith`（最小の precedent）・`:450-479` `splitPane`（イベント配布の precedent）。
- A3: RPC 登録 — `packages/server/src/surface/methods/pane.ts:77`（`pane.swap_with` の登録箇所。
  新しい RPC もここに並べる）。
- A4: protocol スキーマ — `packages/protocol/src/messages.ts:205-245`。
- A5: クライアントのドラッグ機構 — `packages/web/src/components/PaneFrame.vue:78-142`
  （`onNamePointerDown`/`onNamePointerMove`/`onNamePointerUp`/`paneIdAt`/`cancelDrag`/
  `onEscapeDuringDrag`）。ゾーン判定はこの中の `onNamePointerMove`/`onNamePointerUp` に追加する
  ことになる（未特定 — 具体的な挿入位置は coding 側で確定）。
- A6: ドラッグ状態ストア — `packages/web/src/store/view.ts:214,336-348`（`paneDrag`/
  `startPaneDrag`/`setPaneDragOver`/`endPaneDrag`）。
- A7: ドラッグ確定のディスパッチ — `packages/web/src/actions/ActionDispatcher.ts:534-536`
  （`swapPanesByDrag`。新しい分割/分割解除のメソッドもこの近くに追加する見込み）。
- A8: 既存テストの型 — `packages/web/src/components/PaneFrame.test.ts:26`
  （`actions = {openContextMenu, swapPanesByDrag}` のモック形。新しいアクションもここに足す）。

## 実装時の注意

- `pane.split`（既存）は新しい PTY を実際にスポーンする（F7）。今回の「D&D 分割」は**既存の pane を
  移動するだけ**なので、既存の `pane.split` ハンドラをそのまま使い回すことはできない
  （新しいハンドラが要る。既存の `pane.split` 自体は変更しない——requirements AC11）。
- 「分割解除」でドロップ先の pane を閉じる際は、**必ず実際にプロセスを終了させる**
  （`this.terminals.dispose`。F8）。レイアウト木の操作だけでプロセスを放置しないこと。
- `swap`+`remove` の組み合わせ（F5）は、`swap` が2つの pane の**位置**を交換するだけで
  `focusedPaneId`・`zoomedPaneId` 等の他のフィールドは書き換えない点に注意
  （`swapPaneWith` の precedent と同じく、フォーカスは呼び出し側が明示的に移す必要がある。F16）。
- ドラッグ中の後始末（Esc・ダイアログが開く・自分自身が消える）は、`20260923-pane-name-dnd-swap`
  が3ラウンドかけて確立したパターン（F17）をそのまま踏襲すること。ゼロから作り直さない。

## design への申し送り

- R1（「左」「上」の分割表現）を最優先で解決すること。4方向すべてを model 層で対称に表現する
  新しい関数を1つ足すか、「常に "right"/"down" で表現し、target/new の役割をどちらの pane に
  割り当てるかを引数で選べるようにする」形に `split()` を拡張するか、design で決定する。
- RPC の形（F11）: 「既存 pane を移動して分割する」と「既存 pane に吸収させて片方を閉じる」を
  1つの複合 RPC にまとめるか、2つの RPC に分けるか（`pane.split_with`/`pane.absorb_into` 等の
  命名も含め）は design の判断。
- ゾーン判定のしきい値（F18・R4）は「確立パターンに倣った推定値」である旨を明記した上で決定すること。
- ドラッグ状態（`paneDrag`）へのゾーン情報追加（F14）・ゾーンごとの視覚フィードバック（F15）の
  具体的な CSS/DOM 構造は design で確定する。
