# 仕様: pane 名の legend 表示とドラッグでの入れ替え

## 概要

`PaneFrame.vue` の pane 名表示を、herdr のような「枠線に埋め込む legend 風」の見た目に変え、
フォーカス中/フォーカス無しで配色を変える。あわせて、この名前ラベルをポインタでつまんで別の pane へ
ドロップすると、同一 tab 内でその2つの pane を入れ替える機能を追加する（Web ならではの直接操作。
herdr には無い）。

## 設計方針

- ドラッグは **Pointer Events**（`pointerdown`/`pointermove`/`pointerup`/`pointercancel`/
  `setPointerCapture`）で実装する。**HTML5 Drag and Drop API は使わない**——このコードベースの
  既存のドラッグ実装（`Sidebar.vue` の幅ドラッグ・`Splitter.vue` の比率ドラッグ）がすべて Pointer
  Events を使っており、揃える方が保守しやすい。HTML5 DnD はゴースト画像の見た目を細かく制御しにくく、
  タッチ対応も別途ポリフィルが要る（`PaneFrame` はデスクトップ限定〔`enabled` prop〕なので実害は
  無いが、将来の統一のために避ける）。
- ドロップ先の判定は、ポインタ捕捉先（ドラッグ元の名前ラベル）に届き続ける `pointermove`/`pointerup`
  イベントの座標から `document.elementFromPoint(x, y)` で実際にポインタの下にある要素を調べ、
  そこから最も近い `[data-pane-id]` 祖先を辿って求める（ポインタ捕捉中は「実際にポインタの下にある
  要素」ではなく「捕捉した要素」にイベントが届くため。`Sidebar.vue` の 1 次元ドラッグと違い、
  今回は「今どの pane の上にいるか」を毎回調べる必要がある）。
- ドラッグの状態（どの pane をドラッグ中か・今どの pane の上にいるか）は、複数の `PaneFrame`
  インスタンスをまたいで共有する必要があるため、`store/view.ts` の他の一時 UI 状態
  （`contextMenu`・`dialogContext`）と同じ流儀で ref を追加する（`paneDrag`）。
- 色は**新しい CSS 変数を追加しない**。`uiTokens.ts` の `CSS_VARS`（19個、全17テーマでコントラスト
  検証済み）に新規追加すると全テーマの値決め・検証が必要になり過剰。既存の `--wtm-menu-border`
  （opacity を下げて「薄い」枠に流用）と `--wtm-pane-current`（フォーカス中にそのまま使う。
  既存の `.pane-frame-edge-current` と同じ色）を再利用する。
- 新しい RPC 方式 `pane.swap_with` を追加する（既存の方向ベース `pane.swap` とは別物。**既存の
  `pane.swap` は変更しない**）。

## 対象範囲

- `packages/web/src/components/PaneFrame.vue`（見た目・ドラッグの発火）
- `packages/web/src/store/view.ts`（`paneDrag` 状態）
- `packages/web/src/actions/ActionDispatcher.ts`（`swapPanesByDrag`）
- `packages/protocol/src/messages.ts`（`PaneSwapWithParams`/`Result`・`METHOD_SCHEMAS`）
- `packages/server/src/session/SessionModel.ts`（`swapPaneWith`）
- `packages/server/src/session/SessionService.ts`（`swapPaneWith`）
- `packages/server/src/surface/methods/pane.ts`（`pane.swap_with` ハンドラ）

## 依拠する既存の事実

- `Layout.swap(node, paneIdA, paneIdB)` は**既に任意の2つの pane id を受け付ける汎用関数**
  （隣接である必要は無い） — `packages/server/src/session/LayoutTree.ts:69-76`。既存の
  `SessionModel.swapPane(paneId, direction)` は `Layout.neighbor` で隣を求めてからこれを呼ぶ
  だけ（`packages/server/src/session/SessionModel.ts:424-432`）。新しい `swapPaneWith` は
  neighbor 探索を省いて直接 `Layout.swap` を呼ぶだけで済む。
- `swapPane` は `focusedPaneId`/`zoomedPaneId` を一切書き換えていない（tab の対象は pane id の
  参照であり、木の中の位置が変わってもそのまま有効なため）。**この事実だけでは AC-I4 は満たせない**
  ——`focusedPaneId` が変わらないのは「元々フォーカスされていた pane が（動いても）フォーカスされ
  続ける」ことの説明であって、「ドラッグした pane（フォーカスされていたとは限らない）にフォーカスが
  移る」こととは別物。実際に動作確認（screenshot）したところ、フォーカス中の pane とは別の pane を
  ドラッグすると、入れ替え後もフォーカスは元のまま（動かした方には移らない）だった。
  **`PaneFrame.vue` 側で、入れ替えが成立したら明示的に `view.focusPane(props.paneId)`・
  `registry.focus(props.paneId)` を呼ぶ**（既存の「枠クリックで選ぶ」と同じ呼び出し。design D6
  として決定を追記）。
- 既存のドラッグ実装のパターン（pointer capture・`pointerup`/`pointercancel`/`lostpointercapture`
  すべてで終了処理・ダブルクリック検出のための時刻比較） —
  `packages/web/src/components/Sidebar.vue:104-153`（幅ドラッグ）。
- `store/view.ts` の一時 UI 状態の持ち方（`ref` ＋ 開始/終了の関数） —
  `packages/web/src/store/view.ts:179-287`（`dialogContext`・`contextMenu`）。
- `.pane-frame-name` は現在 `pointer-events: none`（`PaneFrame.vue:185`）で、枠のクリックに
  素通りさせている。ドラッグ対応にはこの要素自身が pointer イベントを受ける必要がある。
- `CSS_VARS`（19個、全テーマ検証済み） — `packages/web/src/theme/uiTokens.ts:16-36`。

## インターフェース / データ構造

### 1. `store/view.ts` の新しい状態

```ts
export interface PaneDragState {
  /** ドラッグ元の pane。 */
  sourcePaneId: string;
  /** 現在ポインタの下にある、ドロップ候補の pane（無ければ null）。 */
  overPaneId: string | null;
}
```

`paneDrag = ref<PaneDragState | null>(null)`。操作：
- `startPaneDrag(paneId: string): void` — `paneDrag.value = { sourcePaneId: paneId, overPaneId: null }`。
- `setPaneDragOver(paneId: string | null): void` — `overPaneId` だけ更新（同値なら何もしない。
  `pointermove` 毎に無駄な再描画を避ける）。
- `endPaneDrag(): void` — `paneDrag.value = null`。

### 2. RPC 方式（`packages/protocol/src/messages.ts`）

```ts
export const PaneSwapWithParams = z.object({ paneId, otherPaneId: paneId });
export interface PaneSwapWithResult {
  ok: boolean; // 同一 tab でない・同じ pane 同士 等、何も起きなかったときは false
}
```
`METHOD_SCHEMAS`/`MethodResultMap` に `"pane.swap_with"` を追加する。

### 3. サーバ側

```ts
// SessionModel.ts
swapPaneWith(paneId: PaneId, otherPaneId: PaneId): boolean {
  if (paneId === otherPaneId) return false;
  const pane = this.requirePane(paneId);
  const other = this.panes.get(otherPaneId);
  if (!other || other.tabId !== pane.tabId) return false; // 同一 tab 限定（design 方針）
  const tab = this.requireTab(pane.tabId);
  this.tabs.set(tab.id, { ...tab, layout: Layout.swap(tab.layout, paneId, otherPaneId) });
  return true;
}
```
```ts
// SessionService.ts（swapPane と同じ形）
swapPaneWith(paneId: PaneId, otherPaneId: PaneId): boolean {
  const ok = this.model.swapPaneWith(paneId, otherPaneId);
  if (ok) {
    const pane = this.requirePane(paneId);
    this.bus.publish({ event: "layout.updated", data: { tab: this.requireTab(pane.tabId) } });
    this.persist.touch();
  }
  return ok;
}
```
`requirePane(paneId)` が投げる可能性（存在しない paneId）はそのまま RPC エラーにする
（`otherPaneId` が存在しない・別 tab のときは例外にせず `false` を返す——クライアントが誤って
別tabへドロップさせることは通常の UI 操作では起きない想定だが、サーバは信用せず静かに無視する。
design 方針「AC6 と同じ扱い」）。

### 4. `PaneFrame.vue` の見た目

```html
<div
  ref="root"
  class="pane-frame"
  :data-pane-id="paneId"
  ...
>
  <div class="pane-frame-edge" :class="{ 'pane-frame-edge-current': selected, 'pane-frame-edge-named': showBorder }" ... />
  <div class="pane-frame-body"><slot /></div>
  <span
    v-if="showBorder"
    class="pane-frame-name"
    :class="{ 'pane-frame-name-current': selected, 'pane-frame-name-drop-target': isDropTarget }"
    aria-hidden="true"
    @pointerdown="onNamePointerDown"
    @pointermove="onNamePointerMove"
    @pointerup="onNamePointerUp"
    @pointercancel="onNamePointerCancel"
    @lostpointercapture="onNamePointerCancel"
    >{{ paneName }}</span
  >
</div>
```
- `showBorder = computed(() => settings?.paneAgentNameVisible && !!paneName.value)`
  （**枠線＋legend は名前があるときだけ出す**。requirements の対象「`paneAgentNameVisible` が
  有効なとき」と一致。名前が無ければ枠も出さない——空の legend は意味が無い）。
- `isDropTarget = computed(() => view?.paneDrag?.overPaneId === props.paneId && view.paneDrag.sourcePaneId !== props.paneId)`
- CSS（要点。厳密な px/色は coding で詰める）：
  - `.pane-frame-edge-named`：`border: 1px solid var(--wtm-menu-border, #44475a)` に
    `opacity` ではなく **`border-color` に `color-mix` 相当の薄め**を使う案と、単純に
    `.pane-frame` 全体に `opacity` を掛けない案（`opacity` は端末の中身まで薄くしてしまうため
    **不可**——枠と名前ラベルの色だけを薄くする。`border-color` を直接、薄めた色で指定する）。
  - `.pane-frame-edge-current.pane-frame-edge-named`：`border-color: var(--wtm-pane-current, #44475a)`
    （フォーカス中は既存の強調色をそのまま使う。太さも `.pane-frame-edge-current` の 2px を維持）。
  - `.pane-frame-name`：`position: absolute; top: 0; transform: translateY(-50%);` で境界線の上に
    重ね、`background` を pane の外側の背景色に合わせて線を隠す（legend の見た目）。
    `pointer-events: auto`（旧 `none` から変更）・`cursor: grab`（ドラッグ中は `grabbing`）。
  - `.pane-frame-name-drop-target`：ドロップ候補であることが分かる強調（例:
    `outline: 2px dashed var(--wtm-accent, …)`）。

### 5. ドラッグの発火（`PaneFrame.vue` script）

```ts
const DRAG_THRESHOLD_PX = 6;
let dragStart: { x: number; y: number; pointerId: number } | null = null;

function onNamePointerDown(ev: PointerEvent): void {
  dragStart = { x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId };
  (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  // まだ view.startPaneDrag は呼ばない——閾値を超えるまでは「ただのクリック」として扱う。
}

function onNamePointerMove(ev: PointerEvent): void {
  if (!dragStart || ev.pointerId !== dragStart.pointerId) return;
  if (!view?.paneDrag) {
    const dx = ev.clientX - dragStart.x, dy = ev.clientY - dragStart.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    view?.startPaneDrag(props.paneId); // ここで初めてドラッグ開始
  }
  view?.setPaneDragOver(paneIdAt(ev.clientX, ev.clientY));
}

function onNamePointerUp(ev: PointerEvent): void {
  if (!dragStart || ev.pointerId !== dragStart.pointerId) return;
  const wasDragging = !!view?.paneDrag;
  const target = wasDragging ? paneIdAt(ev.clientX, ev.clientY) : null;
  dragStart = null;
  if (wasDragging) {
    view?.endPaneDrag();
    if (target && target !== props.paneId) actions?.swapPanesByDrag(props.paneId, target);
  } else {
    // 閾値未満のまま離した＝クリック。既存の「枠を押すとフォーカスする」動作へ委ねる（AC-I5）。
    view?.focusPane(props.paneId);
    registry?.focus(props.paneId);
  }
}

function onNamePointerCancel(): void {
  dragStart = null;
  if (view?.paneDrag) view.endPaneDrag();
}

/** `document.elementFromPoint` から最も近い `[data-pane-id]` 祖先を辿る。 */
function paneIdAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return (el?.closest("[data-pane-id]") as HTMLElement | null)?.dataset.paneId ?? null;
}
```
- Esc での取り消し（AC-I2）：ドラッグ中は `window` に一時的な `keydown` リスナーを足し、
  `Escape` で `view.endPaneDrag()`（`dragStart` も null に）する。リスナーはドラッグ開始時に
  `addEventListener`、終了時（`onNamePointerUp`/`onNamePointerCancel`・`onBeforeUnmount`）に
  `removeEventListener` する（`Sidebar.vue` のダイアログ監視〔ドラッグ中にダイアログが開いたら
  終える〕と同じ「外部要因での中断」への配慮を Esc にも適用する）。

### 6. `ActionDispatcher.ts`

```ts
swapPanesByDrag(paneId: string, otherPaneId: string): void {
  void this.conn.request("pane.swap_with", { paneId, otherPaneId }).catch(() => undefined);
}
```
既存の `swap(dir: Dir)`（方向ベース）とは別メソッド。呼び出し元（`PaneFrame.vue`）は
`Promise` を待たない（サーバの `layout.updated` イベントで各クライアントの表示が揃う。
既存の `pane.swap` の呼び出し方と同じ「投げっぱなし」。AC7）。

## 振る舞いの詳細

1. 利用者が pane 名ラベルをポインタで押し下げる（`pointerdown`）。まだドラッグ扱いにしない。
2. 6px 以上動いたら、その時点で `view.startPaneDrag(自分のpaneId)` を呼びドラッグ開始。以降
   `pointermove` のたびに `elementFromPoint` でポインタ直下の pane を求め、`overPaneId` を更新する
   （別の `PaneFrame` インスタンスがこれを見て `isDropTarget` の強調を出す）。
3. 有効な pane の上で離すと `pane.swap_with` を送る。サーバは同一 tab・別 pane であることを確認して
   `Layout.swap` を適用し、`layout.updated` を配布する（AC4・AC7）。
4. 無効な場所（範囲外・自分自身・pane 以外）で離す、または Esc・`pointercancel`・
   `lostpointercapture` が起きると、`view.endPaneDrag()` だけ行い RPC を送らない（AC6）。
5. 閾値未満のまま離した場合はドラッグにならず、既存の「枠クリックでフォーカス」を実行する（AC-I5）。

## ドメイン固有の考慮

- herdr との違い: herdr は TUI のためドラッグ操作自体が無い。本機能は「Web 画面であることを
  活かした独自機能」として、`docs/herdr-parity.md` の該当行（H41 の「後続」欄）に追記する。

## エラー処理 / 異常系

- `pane.swap_with` の `paneId` が存在しない: 既存の `requirePane` が `RpcError("not_found")` を
  投げる（他の方式と同じ扱い）。
- `otherPaneId` が存在しない・別 tab: 例外にせず `{ ok: false }`（AC6 の「何も起きない」と対応）。
- ドラッグ中に対象 pane が閉じられた（別クライアントの操作等）: `overPaneId` は次の `pointermove`
  で `elementFromPoint` が拾った実際の DOM から再計算されるため、消えた pane の id を指し続けない。
  ドロップ時に対象が既に無ければサーバ側の `otherPaneId` 存在チェックで無視される。

## 受け入れ基準との対応

- AC1: 「4. `PaneFrame.vue` の見た目」の `showBorder`・`.pane-frame-edge-named`。
- AC2: `.pane-frame-edge-current.pane-frame-edge-named`（既存の強調色をそのまま使う）。
- AC3: `.pane-frame-edge-named` の既定色（`--wtm-menu-border` を薄めた色）。
- AC4: 「3. サーバ側」の `swapPaneWith` ＋「5. ドラッグの発火」の `onNamePointerUp`。
- AC5: `Layout.swap` は葉（pane id）だけを入れ替え、split の `ratio`/`id`/`dir` はそのまま
  （`LayoutTree.ts:69-76` の実装そのもの。既存の `pane.swap` と同じ保証）。
- AC6: 「振る舞いの詳細」4.・「エラー処理」（サーバ側の `otherPaneId` 検査、クライアント側の
  `target !== props.paneId` 検査の二重の保険）。
- AC7: `SessionService.swapPaneWith` が `layout.updated` を publish する（既存の `pane.swap` と
  同じ配信経路。`StoreAdapter` は既に `layout.updated` を扱っている——変更不要）。
- AC-I1: 「5. ドラッグの発火」の `DRAG_THRESHOLD_PX` による開始判定。
- AC-I2: 「振る舞いの詳細」4.（範囲外・Esc・`pointercancel`）。
- AC-I3: 既存の `ActionDispatcher.swap(dir)`／`pane.swap` RPC は変更しない（設計方針・対象範囲）。
- AC-I4: `onNamePointerUp` が入れ替え成立時に明示的に `view.focusPane`/`registry.focus` を呼ぶ
  （design D6。当初「自動的に満たされる」と見立てていたが、実機確認で誤りと判明し訂正した）。
- AC-I5: `onNamePointerUp` の「閾値未満はクリックとして扱う」分岐、および `.pane-frame-name` の
  `pointer-events` を `auto` にしても `.pane-frame-edge` 自体のクリック領域・右クリックメニューには
  触れない（`.pane-frame-name` は `.pane-frame-edge` の**上に重なる小さな領域**だけで、それ以外の
  枠の領域は今までどおり `.pane-frame-edge` が直接受ける）。

## 未確定事項（tasks へ）

- ドロップ候補のハイライトの正確な CSS（`outline` の色・太さ）は coding で決める。
- `.pane-frame-edge-named` の「薄い」既定色の具体的な計算式（`--wtm-menu-border` をそのまま使うか、
  透明度を掛けるか）は coding で試して決める。
