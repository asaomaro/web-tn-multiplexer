# 仕様: D&D による pane の分割・分割解除

## 概要

`20260923-pane-name-dnd-swap` が確立した「pane の名前ラベルをドラッグする」操作を拡張し、
ドロップ先の pane 内のどこ（縁 or 中央）へ落としたかで、次の2つの新しい結果を追加する。

- **縁（上/下/左/右）へドロップ**: ドロップ先の pane をその方向へ分割し、ドラッグした pane が
  新しい区画に入る（新しい pane は作らない。既存の pane が移動する）。
- **中央へドロップ**: ドロップ先の pane を閉じ、ドラッグした pane がそのスペースを引き継ぐ
  （分割の解除）。

いずれの操作でも、ドラッグした pane の元の位置の split は自動的に畳まれる。

## 設計方針

- **レイアウト操作はサーバ側の `LayoutTree.ts`（純関数）に閉じる**（既存の `split`/`remove`/`swap`
  と同じ設計原則。architecture.md「LayoutTree」相当）。クライアントはゾーン判定と RPC 呼び出しだけを
  担い、レイアウトの木構造の計算はしない（既存の `pane.swap_with` と同じ責務分担）。
- **「分割」「分割解除」の2操作を合わせて、新規の `LayoutTree` 純関数は `insertAtEdge` 1つだけ
  追加する**（research.md F5・F6）。内訳: 「分割解除」（`replacePane`）は既存の `swap`+`remove`
  だけで表現でき新規関数は不要（F5）。「分割」（`moveToEdge`）は既存の `split()` では4方向を
  表現できない（F6・design 判断の理由）ため `insertAtEdge` を新設する。新規に大きな状態機械は
  導入しない。
- **RPC は `pane.swap_with` と同じ「同一 tab 内限定・失敗時は何もしない」方針を踏襲する**
  （research.md F9）。
- **ratio は常に 0.5 固定**（requirements.md「対象外」）。新しく出来る分割の比率調整は、既存の
  境界ドラッグ（リサイズ）に任せる。
- **クライアントのドラッグ機構は `20260923-pane-name-dnd-swap` の Pointer Events 方式をそのまま
  拡張する**（HTML5 Drag and Drop API は使わない。research.md F12）。ゾーン判定を追加するだけで、
  ドラッグの開始・キャンセル・後始末（Esc・ダイアログ・自分自身の消失）の骨格は変えない
  （research.md F17。ゼロから作り直さない）。

## 対象範囲

- `packages/protocol/src/messages.ts`: 新規 RPC `pane.move_to_edge`・`pane.replace` のパラメータ・
  結果型を追加。
- `packages/server/src/session/LayoutTree.ts`: 新規純関数 `insertAtEdge`（4方向対応）を追加。
  既存の `split`/`remove`/`swap` は変更しない。
- `packages/server/src/session/SessionModel.ts`: `moveToEdge`・`replacePane` メソッドを追加
  （`swapPaneWith`/`closePane`/`splitPane` が precedent）。
- `packages/server/src/session/SessionService.ts`: 上記を呼び出し `layout.updated`（と、
  `replacePane` はプロセス破棄も伴うため `pane.closed`/`workspace.updated` 等 `closePane` と同種の
  イベント）を配布するハンドラを追加。
- `packages/server/src/surface/methods/pane.ts`: 上記2つの RPC を登録。
- `packages/web/src/store/view.ts`: `paneDrag` に `overZone` フィールドを追加。
- `packages/web/src/components/PaneFrame.vue`: ゾーン判定（`zoneAt`）・ゾーンごとの視覚
  フィードバック（CSS）・ドロップ確定時の新 RPC 呼び出しを追加。
- `packages/web/src/actions/ActionDispatcher.ts`: `movePaneToEdge`・`replacePaneWithDrag`
  （`swapPanesByDrag` と同じ形）を追加。

## 依拠する既存の事実

- `LayoutNode`/`SplitDirection`（`"right"|"down"` の2値のみ）の定義:
  `packages/protocol/src/model.ts:8,64`（research.md F1）。
- `LayoutTree.split`/`remove`/`swap` の正確な挙動: `packages/server/src/session/LayoutTree.ts:29-76`
  （research.md F2〜F4。このセッションで実物を再確認済み）。
- `pane.split` は新しい PTY を実際にスポーンする（既存の pane を移すことには使えない）:
  `SessionService.ts:450-479`（research.md F7）。
- `pane.close` のプロセス破棄・イベント配布の分岐: `SessionService.ts:482-505`
  （research.md F8）。
- `pane.swap_with` の precedent（レイアウトのみ書き換え、`layout.updated` を1回配布）:
  `SessionModel.ts:621-629`・`SessionService.ts:541-549`（research.md F9）。
- 配布イベントは `layout.updated`（`tab.updated` ではない）: `packages/protocol/src/events.ts:58-59`
  （research.md F10）。
- クライアントの既存ドラッグ機構一式（Pointer Events・`DRAG_THRESHOLD_PX`・`paneIdAt`・
  `cancelDrag`・Esc/ダイアログ/自消失の後始末）: `PaneFrame.vue:78-168`（research.md F12〜F17）。
- zoom 中は他の pane が DOM に存在しないため、この機能への特別なガードは基本的に不要という想定:
  `PaneLayout.vue:110`（research.md F20。**未確認の推定**——test 工程で実機/ブラウザ確認する）。
- 縁/中央のしきい値の一般知識（VS Code のエディタ分割。一次資料未確認）: research.md F18。
  **本 design はこれを「確立パターンに倣った推定値」として採用し、一次資料で検証したとは主張しない**
  （research.md R4 への対応）。

## インターフェース / データ構造

### `LayoutTree.ts`（新規関数）

```ts
export type Edge = "top" | "bottom" | "left" | "right";

/**
 * `targetPaneId` の葉を、`edge` 側に `newPaneId` を置く形の split に置き換える。
 * `split()`（既存）は常に target=a・new=b だが、`insertAtEdge` は `edge` に応じて
 * target/new のどちらを a（左/上）に置くかを決める：
 *   - edge "right"|"bottom" → target=a, new=b（＝既存の split() と同じ結果。dir は
 *     "right"|"down" のまま）
 *   - edge "left"|"top"     → new=a, target=b（dir は同じ軸の "right"|"down" のまま。
 *     a/b の中身だけが入れ替わる）
 * ratio は常に 0.5（このセッションの対象。呼び出し側で他の値を渡すことは想定しない）。
 */
export function insertAtEdge(
  node: LayoutNode,
  targetPaneId: PaneId,
  edge: Edge,
  newPaneId: PaneId,
  newSplitId: SplitId,
): LayoutNode;
```

実装方針（`split()` を再利用せず、同じ形の再帰を独立に書く——`split()` に `edge` 引数を
足して分岐させるより、既存関数を非破壊のまま残すほうが `pane.split`（既存のキーバインド分割）の
挙動に対する回帰リスクが無い）:

```ts
export function insertAtEdge(node, targetPaneId, edge, newPaneId, newSplitId): LayoutNode {
  if (isPaneNode(node)) {
    if (node.paneId !== targetPaneId) return node;
    const dir: SplitDirection = edge === "left" || edge === "right" ? "right" : "down";
    const targetNode = { type: "pane", paneId: targetPaneId } as const;
    const newNode = { type: "pane", paneId: newPaneId } as const;
    const [a, b] = edge === "left" || edge === "top" ? [newNode, targetNode] : [targetNode, newNode];
    return { type: "split", id: newSplitId, dir, ratio: 0.5, a, b };
  }
  return { ...node, a: insertAtEdge(node.a, ...), b: insertAtEdge(node.b, ...) };
}
```

### protocol（`packages/protocol/src/messages.ts`）

```ts
// 「分割」（縁へドロップ）：paneId（ドラッグした既存 pane）を、targetPaneId の edge 側へ移す。
export const PaneMoveToEdgeParams = z.object({
  paneId,           // ドラッグした pane（移動する側）
  targetPaneId: paneId, // ドロップ先の pane
  edge: z.enum(["top", "bottom", "left", "right"]),
});
export interface PaneMoveToEdgeResult {
  /** 対象外（同一 pane・別 tab 等）で何も起きなかったときは false。design「エラー処理」。 */
  ok: boolean; // 実装時、既存の `PaneSwapWithResult` と同じフィールド名 `ok` に揃えた。
}

// 「分割解除」（中央へドロップ）：paneId（ドラッグした pane。生き残る）が targetPaneId
// （ドロップ先。閉じる）の位置とスペースを引き継ぐ。
export const PaneReplaceParams = z.object({
  paneId,       // ドラッグした pane（生き残る側）
  targetPaneId: paneId, // ドロップ先の pane（閉じられる側）
});
export interface PaneReplaceResult {
  ok: boolean; // 実装時、既存の `PaneSwapWithResult` と同じフィールド名 `ok` に揃えた。
}
```

`METHOD_SCHEMAS`/`MethodResultMap` に `"pane.move_to_edge"`・`"pane.replace"` として登録する
（既存の `pane.*` と同じ並び。`packages/protocol/src/messages.ts:356` 付近）。

### クライアント状態（`view.ts`）

```ts
paneDrag: { sourcePaneId: string; overPaneId: string | null; overZone: Zone | null } | null
// Zone = "top" | "bottom" | "left" | "right" | "center"
```

`setPaneDragOver(paneId, zone)` に拡張する（現行は `setPaneDragOver(paneId)` のみ。
呼び出し元は1箇所 `PaneFrame.vue` の `onNamePointerMove` のみなので、破壊的な拡張で問題ない）。

## 振る舞いの詳細

### サーバ側: `insertAtEdge` を使う「分割」（`pane.move_to_edge`）

`SessionModel.moveToEdge(paneId, targetPaneId, edge)`:

1. `paneId === targetPaneId` なら何もせず `false`（自分自身へのドロップ。AC9）。
2. `paneId`・`targetPaneId` が同じ tab に属さないなら何もせず `false`（AC9・design 方針は
   `swapPaneWith` と同じ「同一 tab 限定」）。
3. `withoutSource = LayoutTree.remove(tab.layout, paneId)`。
   - `withoutSource` が `null`（`paneId` が tab に残る唯一の pane だった）場合は、
     分割先の `targetPaneId` も同じ tab に存在しえない（tab には1枚しか無いのに別の
     `targetPaneId` が存在するのは矛盾）ので、この分岐に到達するのは
     `targetPaneId` が見つからず 2 で既に弾かれているケースのみ——防御的に `false` を返す。
4. `result = LayoutTree.insertAtEdge(withoutSource, targetPaneId, edge, paneId, newSplitId())`。
5. `tab.layout = result`。`layout.updated` イベントを配布（`{tab}`。F10 の precedent）。
6. `focusedPaneId` は変更しない（クライアント側がドロップ確定後に明示的に focus する。F16 と
   同じ設計。AC8 はクライアント側の責務）。
7. `true` を返す。

### サーバ側: `swap`+`remove` を使う「分割解除」（`pane.replace`）

`SessionModel.replacePane(paneId, targetPaneId)`:

1. `paneId === targetPaneId` なら何もせず `false`。
2. 同じ tab に属さないなら何もせず `false`。
3. `swapped = LayoutTree.swap(tab.layout, paneId, targetPaneId)`（research.md F5 の手順1）。
4. `result = LayoutTree.remove(swapped, targetPaneId)`（F5 の手順2）。
   - `result` が `null` になるのは「tab に pane が1枚だけ」の場合だが、そもそも2枚の pane
     （`paneId`・`targetPaneId`）が同一 tab に別々に存在することが前提（1で除外済み）なので、
     ここで `null` になることは無い（tab には最低2枚ある）。念のため `null` なら防御的に `false`。
5. `tab.layout = result`。
6. `targetPaneId` のプロセスを実際に終了させる（`this.terminals.dispose(targetPane.pid)`。
   `closePane` と同じ経路。research.md F8・AC7）。`targetPaneId` を `this.panes` から削除。
7. イベント配布は `closePane` のパターンを踏襲する: `pane.closed`（`targetPaneId` について）・
   `layout.updated`（`{tab}`）を配布。`targetPaneId` がたまたま `tab.zoomedPaneId` だったときは
   既存の `closePane` と同じズーム解除処理を通す（`SessionModel.ts:332` 相当。research.md F21）。
8. `true` を返す。

### クライアント側: ゾーン判定

`PaneFrame.vue` の `onNamePointerMove`/`onNamePointerUp` で、ドロップ先候補の pane 要素の
`getBoundingClientRect()` とポインタ座標から `Zone` を決める:

```ts
function zoneAt(rect: DOMRect, x: number, y: number): Zone {
  const relX = (x - rect.left) / rect.width; // 0..1
  const relY = (y - rect.top) / rect.height;
  const EDGE = 0.3; // 30%。research.md F18「確立パターンに倣った推定値」（VS Code 相当。一次資料未検証）
  if (relX < EDGE) return "left";
  if (relX > 1 - EDGE) return "right";
  if (relY < EDGE) return "top";
  if (relY > 1 - EDGE) return "bottom";
  return "center";
}
```

上下左右のどれにも該当しない中央の領域が "center"。**優先順位は左右を先に判定してから上下**
（正方形に近い pane で四隅にカーソルがあるとき、左右優先で決める——tie-break の一貫性のため。
どちらを優先しても許容できる違いだが、実装を1つに固定して振る舞いを予測可能にする）。

`paneIdAt(x, y)` で対象 pane の要素を特定した後、その要素の `getBoundingClientRect()` と
上記 `zoneAt` を組み合わせて `view.setPaneDragOver(paneId, zone)` を呼ぶ。

### クライアント側: ドロップ確定

`onNamePointerUp`:

```ts
const targetPaneId = paneIdAt(ev.clientX, ev.clientY);
// **`view.paneDrag.overZone` は使わない**（直前の pointermove 時点のもので、離した瞬間の座標とは
// 理論上ずれうる。ハイライトと実際に呼ぶ RPC が食い違わないよう、`paneIdAt` と同じく pointerup の
// 実座標からその場で再計算する——「対象を特定する」ロジックは move/up で常に同じ関数を使う）。
const zone = targetPaneId ? zoneAt(document.querySelector(`[data-pane-id="${targetPaneId}"]`)!.getBoundingClientRect(), ev.clientX, ev.clientY) : null;
if (targetPaneId && zone && targetPaneId !== props.paneId) {
  if (zone === "center") {
    actions?.replacePaneWithDrag(props.paneId, targetPaneId);
  } else {
    actions?.movePaneToEdge(props.paneId, targetPaneId, zone);
  }
  view?.focusPane(props.paneId);
  registry?.focus(props.paneId);
}
```

（`swapPanesByDrag` の既存の呼び出し形・フォーカス処理〔F16〕をそのまま踏襲。既存の
`pane.swap_with`〔同一 pane 上へのドロップで何も起きない挙動〕と同じガードを追加する。）

### 視覚フィードバック

`isDropTarget`（既存。`PaneFrame.vue:71-74`）を拡張した `overZone` computed
（`view.paneDrag?.overPaneId === paneId` のときだけ `view.paneDrag.overZone` を返す）を使い、
現在のゾーンに応じた**1つの**オーバーレイ要素を描画する（`v-if="overZone"`、クラスは
`.pane-frame-zone-top`/`-bottom`/`-left`/`-right`/`-center` を動的に付与。5つの要素を常に
描画して `.active` で切り替えるのではなく、対象の1つだけを都度描画する形に単純化した
——観測できる見た目は変わらない）。**中央（分割解除）だけ色を変える**
（`--wtm-error-fg` の赤系。decisions.md D4「安全面の検討」）——縁（分割。プロセスは失われない）
と違い、中央はプロセスを実際に終了させる破壊的な操作であることを見た目で伝える。

### 複数クライアントでの同期（AC10）

`layout.updated`（`{tab}`）が既存の配布経路（`pane.swap_with`・`pane.split` と同じ）で
全購読クライアントに配られる。クライアント側の `session.ts` は既存の `layout.updated` ハンドラを
そのまま使う（この work での変更不要——`tab.layout` を丸ごと置き換えるだけの既存ハンドラが
新しい形の `LayoutNode` も問題なく受け取れる。`LayoutNode` の型自体は変えていないため）。

## ドメイン固有の考慮

- **`ratio` の意味**（`LayoutNode.ratio`）は「`a` 側が占める割合」（既存の `split()`/`setRatio`
  の実装から。`packages/server/src/session/LayoutTree.ts` の `resizeBy` 参照）。`insertAtEdge`
  で edge が "left"/"top"（new が a）のときも ratio=0.5 固定なので、a/b どちらが何であれ
  50/50 になる（対称なので `ratio` の意味の違いは今回は表面化しない）。
- **zoom との相互作用**（research.md F20・F21）: zoom 中は他の pane が DOM に存在しないため
  ドロップ対象が無い。ズームされていた pane が「分割解除」で閉じられるケース（`replacePane` の
  対象がズーム中）は、既存の `closePane` と同じズーム解除処理を通す。

## エラー処理 / 異常系

- 自分自身へのドロップ（`paneId === targetPaneId`）: 何もしない（`false`。AC9）。
- 別 tab の pane へのドロップ: この work では tab 間の要素は同一 DOM ツリーに存在しない
  （tab 切り替えで非表示の tab の pane 要素は無い）ため、クライアント側で `paneIdAt` が
  他 tab の pane を見つけることは無い——サーバ側でも防御的に同一 tab チェックを行う
  （二重の防御。design 方針）。
- tab の外側（サイドバー・tab バー等）へのドロップ: `paneIdAt` が `null` を返すため、
  `onNamePointerUp` は何もしない（既存の `swapPanesByDrag` と同じガード）。
- RPC が `false`/`moved:false`/`replaced:false` を返した場合: クライアントは何もしない
  （トースト等のエラー表示も出さない。`pane.swap_with` の既存の扱いと同じ——「無効な組み合わせを
  選んだだけ」であり、利用者に通知するほどの異常ではないという既存方針を踏襲）。

## 受け入れ基準との対応

- AC1: `pane.move_to_edge`（`edge` に4方向。`LayoutTree.insertAtEdge` が全方向を表現する）で実現。
- AC2: `moveToEdge` の手順3（`LayoutTree.remove` で元の位置を畳む）。
- AC3: `insertAtEdge` が返す `LayoutNode` は既存の `{type:"split",...}` と同じ形なので、既存の
  リサイズ（`setRatio`/`resizeBy`）がそのまま効く（新しい特別扱いは無い）。
- AC4: クライアント側「視覚フィードバック」節のゾーンごとのオーバーレイ。
- AC5: `pane.replace`（`swap`+`remove`）で実現。
- AC6: `replacePane` の手順3・4（`swap` で位置を入れ替えてから `remove` で両方畳む。F5 で
  「両側で畳まれる」ことを手計算済み）。
- AC7: `replacePane` の手順6（`this.terminals.dispose` で実プロセスを終了）。
- AC8: クライアント側「ドロップ確定」節（`view?.focusPane`/`registry?.focus` を明示的に呼ぶ。
  `F16` と同じ設計）。
- AC9: サーバ側の「自分自身」「同一 tab でない」ガード（エラー処理節）＋クライアント側の
  `paneIdAt` が `null`/`props.paneId` を返すケースのガード。
- AC10: 「複数クライアントでの同期」節（既存の `layout.updated` 配布経路をそのまま使う）。
- AC11: 既存の `pane.split`・`pane.close`・`pane.swap_with`・`LayoutTree.split`/`remove`/`swap`
  はいずれも変更しない（新しい関数・新しい RPC を追加するだけ）。既存のテストは無改修のまま
  通ることを test 工程で確認する。
- AC-I1: 「クライアント側: ドロップ確定」節（`paneIdAt`/`props.paneId` によるガード。既存の
  pointerdown→pointermove(閾値)→pointerup の骨格を継承）。
- AC-I2: 「クライアント側: ドロップ確定」節（有効なゾーンの上で pointerup すれば確定）と、
  `20260923-pane-name-dnd-swap` から継承する Esc（`onEscapeDuringDrag`）でのキャンセル
  （research.md F17。この work で新しいコードを足さない——既存のキャンセル経路がそのまま効く）。
- AC-I3: 既存のキーバインドによる分割（`prefix+…`）・pane を閉じる操作はこの work で変更しない
  （「対象範囲」節に無い＝手を入れない。AC11 と同じ根拠）。
- AC-I4: 「クライアント側: ドロップ確定」節（`view?.focusPane`/`registry?.focus` を明示的に呼ぶ）。
- AC-I5: 「対象範囲」節にある箇所以外（境界のリサイズ・既存のキーバインド操作の経路）は触らない。
  `20260923-pane-name-dnd-swap` から継承する後始末（Esc・ダイアログ・自消失。research.md F17）も
  そのまま流用するため、既存の防御が崩れる余地が無い。
