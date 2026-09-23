<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ActionDispatcherKey, TerminalRegistryKey } from "../injection.js";
import { paneNameOf } from "../store/paneName.js";
import { useSessionStore } from "../store/session.js";
import { useSettingsStore } from "../store/settings.js";
import { useViewStore } from "../store/view.js";

/**
 * pane の枠（design M7 の後半「pane の枠の右クリックは常にメニューを開く」。D110）。`PaneLayout` が葉（測る要素）の外側を
 * これで包む——枠の太さの分は葉の外なので、`ViewSync` が葉で測る cols/rows に入らない（端末の外の縁になる）。
 *
 * - 枠（`.pane-frame-edge`）の右クリックは、その pane の `rightClick` の設定やアプリのマウスの報告に関わらず、常に pane の
 *   メニューを開く（`MouseBridge` は端末の上の右クリックだけを振り分ける）。「右クリックを pane に送る」にした pane で、
 *   マウスを使うアプリが動いている間も、ここからメニューを開いて戻せる。
 * - 枠の押下は、その pane を選んで端末にフォーカスする（M1。枠そのものにはフォーカスを移さない）。
 * - キーボード：枠は APG の menu button（`role=button`・`aria-haspopup=menu`）で、Enter・Space・↓・Shift+F10・
 *   ContextMenu キーでメニューを開く。メニューを Esc で閉じると枠へ戻る（`ContextMenu`）。**Tab で止まるのは選ばれている
 *   pane（`view.focusedPaneId`）の枠だけ**（roving tabindex。`TerminalPane` の端末の入力欄も同じ。独立点検 #2）——端末は Tab を
 *   そのまま受け取るので、ほかの pane の端末や枠が Tab の順に並んでいると、先頭の pane の端末で止まって 2 つ目以降の pane の枠へ
 *   届かなかった。pane を prefix のキー（`h/j/k/l`・`Tab`）で選び、端末の外（tab バー）から Tab で来る。
 * - 枠の中（枠そのもの・端末）にフォーカスがあるまま枠が消える（pane を閉じた）と、フォーカスは body に落ちる。そのときは選ばれて
 *   いる pane の端末へ移す（独立点検 #4：選ばれていない pane のメニューから「閉じる」を選ぶと、`focusedPaneId` が変わらないので
 *   ほかに移す処理が無かった）。
 * - 枠は端末（葉）の後ろに敷き、葉を `position: relative` で上に重ねる——枠の要素は端末を包まないので、操作できる要素の
 *   入れ子にならない。
 * - エージェント名の可視ラベル（`.pane-frame-name`。20260922-appearance-settings-rest。opt-in・AC11）は、
 *   **`.pane-frame-body`（端末）より後の兄弟**として置く——`z-index:auto` の重なりは DOM 順で後のものが
 *   上に来るため、枠（`.pane-frame-edge`）の中に置くと端末の不透明な内容の下に隠れて見えなくなる
 *   （taskcheck がスクリーンショットで実際に発見した不具合。`pointer-events: none` で端末のクリックは妨げない）。
 *
 * `enabled` が false（モバイルの `MobileShell`・単体テスト）なら枠を描かず、ストアにも触れない（`enabled` は作った後に
 * 変えない前提。モバイルは葉を PTY の大きさの縮小の枠に置くので、縁を足すと端末がはみ出る）。
 */
const props = defineProps<{ paneId: string; enabled?: boolean }>();

const actions = inject(ActionDispatcherKey, undefined);
const registry = inject(TerminalRegistryKey, undefined);
const session = props.enabled ? useSessionStore() : null;
const view = props.enabled ? useViewStore() : null;
const settings = props.enabled ? useSettingsStore() : null;
const edge = ref<HTMLElement | null>(null);

/** 利用者が付けた名前 → エージェント名 → 端末のタイトル の順に拾う。どれも無ければ空。 */
const paneName = computed(() => {
  const pane = session?.panes.get(props.paneId);
  // 連鎖の正典は `store/paneName.ts` の `paneNameOf`。ここは**名前が無ければ空**にする
  // （枠のラベルは名前が無ければ付けない）ので、既定値に空文字を渡す。
  return pane ? paneNameOf(pane, "") : "";
});
/** pane そのものの名前。枠の `aria-label` は**メニューボタン**の名前なので流用しない（AC8）。 */
const paneLabel = computed(() => (paneName.value ? `pane「${paneName.value}」` : "pane"));
/** 枠（メニューボタン）の名前。 */
const label = computed(() => (paneName.value ? `pane「${paneName.value}」のメニュー` : "pane のメニュー"));
/** 選ばれている pane の枠だけを Tab で止まる場所にする（roving tabindex。独立点検 #2）。 */
const selected = computed(() => view?.focusedPaneId === props.paneId);
const root = ref<HTMLElement | null>(null);

/**
 * legend の分の余白を確保するか（20260923-pane-name-dnd-swap）。**名前が無い pane も含め、設定が
 * 有効な間はすべての pane に同じ余白を入れる**——pane ごとに有無が割れると、隣り合う pane の上端が
 * そろわなくなる（同じ tab 内の分割は上端をそろえる前提のレイアウトのため）。
 */
const reserveNameSpace = computed(() => !!(props.enabled && settings?.paneAgentNameVisible));
/**
 * 枠線に埋め込む名前表示を出すか（20260923-pane-name-dnd-swap。herdr の見た目に寄せた。design「4.」）。
 * 名前が無ければ枠も出さない——空の legend は意味が無い（decisions.md D9）。
 */
const showBorder = computed(() => !!(props.enabled && settings?.paneAgentNameVisible && paneName.value));
/** 今このpaneがドラッグのドロップ候補になっているか（別の PaneFrame インスタンスがドラッグ元）。 */
const isDropTarget = computed(() => {
  const drag = view?.paneDrag;
  return !!drag && drag.overPaneId === props.paneId && drag.sourcePaneId !== props.paneId;
});
/** 自分がドラッグ元か（ドラッグ中は自分の名前を薄くする等の見た目に使う）。 */
const isDragSource = computed(() => view?.paneDrag?.sourcePaneId === props.paneId);

const DRAG_THRESHOLD_PX = 6;
let dragStart: { x: number; y: number; pointerId: number } | null = null;

function onEscapeDuringDrag(ev: KeyboardEvent): void {
  if (ev.key !== "Escape") return;
  cancelDrag();
}

function cancelDrag(): void {
  dragStart = null;
  if (view?.paneDrag) view.endPaneDrag();
  window.removeEventListener("keydown", onEscapeDuringDrag);
}

/** `document.elementFromPoint` から最も近い `[data-pane-id]` 祖先の pane id を求める。 */
function paneIdAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return (el?.closest("[data-pane-id]") as HTMLElement | null)?.dataset.paneId ?? null;
}

/** 名前ラベルの押し下げ。まだドラッグ扱いにしない（閾値を超えるまでは「ただのクリック」。AC-I1・AC-I5）。 */
function onNamePointerDown(ev: PointerEvent): void {
  dragStart = { x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId };
  (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
}

function onNamePointerMove(ev: PointerEvent): void {
  if (!dragStart || ev.pointerId !== dragStart.pointerId) return;
  if (!view?.paneDrag) {
    const dx = ev.clientX - dragStart.x;
    const dy = ev.clientY - dragStart.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    view?.startPaneDrag(props.paneId);
    window.addEventListener("keydown", onEscapeDuringDrag);
  }
  view?.setPaneDragOver(paneIdAt(ev.clientX, ev.clientY));
}

/** 離した：ドラッグ済みならドロップを確定、閾値未満ならクリック（枠を押したのと同じ扱い。AC-I5）。 */
function onNamePointerUp(ev: PointerEvent): void {
  if (!dragStart || ev.pointerId !== dragStart.pointerId) return;
  const wasDragging = !!view?.paneDrag;
  const target = wasDragging ? paneIdAt(ev.clientX, ev.clientY) : null;
  dragStart = null;
  if (wasDragging) {
    view?.endPaneDrag();
    window.removeEventListener("keydown", onEscapeDuringDrag);
    if (target && target !== props.paneId) {
      actions?.swapPanesByDrag(props.paneId, target);
      // ドラッグした pane にフォーカスを残す（AC-I4）。入れ替え前にフォーカスが別の pane に
      // あった場合、`focusedPaneId` を書き換えないと、そちらの pane が新しい位置にフォーカスを
      // 持ち続けてしまう（`swapPaneWith` は id の参照を変えないため。design の申し送り）。
      view?.focusPane(props.paneId);
      registry?.focus(props.paneId);
    }
  } else {
    view?.focusPane(props.paneId);
    registry?.focus(props.paneId);
  }
}

function onNamePointerCancel(ev: PointerEvent): void {
  if (dragStart && ev.pointerId !== dragStart.pointerId) return;
  cancelDrag();
}

/*
 * ドラッグ中にダイアログが開いたら、その時点で取り消す（`Sidebar.vue` の幅ドラッグと同じ precedent。
 * design「依拠する既存の事実」）。`showModal()` で文書が inert になったとき、ポインタの捕捉が外れる
 * のか・捕捉先へ `pointerup`/`pointercancel` が届き続けるのかは確かめた出所が無い。分からない挙動に
 * 頼らない（cross-cutting 独立点検で発見。review.md 参照）。
 */
watch(
  () => view?.openDialog,
  (dialog) => {
    if (dialog !== null && isDragSource.value) cancelDrag();
  },
);

onBeforeUnmount(() => {
  // ドラッグ中にこの pane 自身が消えた（別クライアントの close 等）ら、リスナーの残留・宙に浮いた
  // ドラッグ状態を残さない（20260923-pane-name-dnd-swap）。
  if (isDragSource.value) cancelDrag();
  if (!view || !root.value?.contains(document.activeElement)) return;
  // 描き直しで入れ替わる新しい端末が自分でフォーカスする（`TerminalPane`）ので、それでも body に落ちていたときだけ移す。
  void nextTick(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    if (view.focusedPaneId) registry?.focus(view.focusedPaneId);
  });
});

const menuOpen = computed(() => {
  const target = view?.contextMenu?.target;
  return target?.kind === "pane" && target.paneId === props.paneId;
});

function openMenu(at: { x: number; y: number }): void {
  actions?.openContextMenu({ kind: "pane", paneId: props.paneId }, at);
}

/** M1：枠の押下でも pane を選び、端末にフォーカスする（枠が Tab で止まる要素でも、クリックではフォーカスを奪わない）。 */
function onMouseDown(ev: MouseEvent): void {
  ev.preventDefault();
  view?.focusPane(props.paneId);
  registry?.focus(props.paneId);
}

/** M7：枠の右クリックは常に pane のメニューを開く（D110）。 */
function onContextMenu(ev: MouseEvent): void {
  ev.preventDefault();
  openMenu({ x: ev.clientX, y: ev.clientY });
}

/** APG の menu button：Enter・Space・↓ で開く。文脈メニューの慣習の Shift+F10・ContextMenu キーでも開く。 */
function onKeydown(ev: KeyboardEvent): void {
  const opens = ev.key === "Enter" || ev.key === " " || ev.key === "ArrowDown" || ev.key === "ContextMenu" || (ev.key === "F10" && ev.shiftKey);
  if (!opens || ev.ctrlKey || ev.altKey || ev.metaKey) return;
  ev.preventDefault();
  // `main.ts` の window の keydown（端末の外のキーを `KeyInputController` へ流す）に二重に渡さない。
  ev.stopPropagation();
  const rect = edge.value?.getBoundingClientRect();
  openMenu({ x: rect?.left ?? 0, y: rect?.top ?? 0 });
}
</script>

<template>
  <div
    ref="root"
    class="pane-frame"
    :class="{ 'pane-frame-enabled': enabled, 'pane-frame-enabled-named': reserveNameSpace }"
    :data-pane-id="enabled ? paneId : undefined"
    :role="enabled ? 'group' : undefined"
    :aria-label="enabled ? paneLabel : undefined"
    :aria-current="enabled && selected ? 'true' : undefined"
  >
    <div
      v-if="enabled"
      ref="edge"
      class="pane-frame-edge"
      :class="{ 'pane-frame-edge-current': selected, 'pane-frame-edge-named': showBorder, 'pane-frame-edge-drop-target': isDropTarget }"
      role="button"
      :tabindex="selected ? 0 : -1"
      aria-haspopup="menu"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      :aria-label="label"
      @mousedown="onMouseDown"
      @contextmenu="onContextMenu"
      @keydown="onKeydown"
    />
    <div class="pane-frame-body">
      <slot />
    </div>
    <!-- `.pane-frame-body`（端末。DOM 順で後）より後に置く——z-index:auto の重なりは DOM 順で
         後のものが上に来るため、`.pane-frame-edge` の中に置くと端末の不透明な内容の下に隠れて
         見えなくなる（taskcheck が実際のスクリーンショットで発見。review.md 参照）。 -->
    <span
      v-if="showBorder"
      class="pane-frame-name"
      :class="{ 'pane-frame-name-current': selected, 'pane-frame-name-dragging': isDragSource }"
      aria-hidden="true"
      @pointerdown="onNamePointerDown"
      @pointermove="onNamePointerMove"
      @pointerup="onNamePointerUp"
      @pointercancel="onNamePointerCancel"
      @lostpointercapture="onNamePointerCancel"
      @contextmenu="onContextMenu"
      >{{ paneName }}</span
    >
  </div>
</template>

<style scoped>
.pane-frame {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}
/* 枠の太さ。分割の境界（`Splitter` の --wtm-pane-gap）と同じにする。ふだんは背景と同じ色で、端末の外の縁に見える。
 * 値そのもの（既定 4px）は `App.vue` が `settings.paneFrameThickness` から配る CSS 変数
 * （20260922-appearance-settings-rest）。変数が届いていない場所（このコンポーネント単体のテスト等）は
 * 今までどおり 4px にフォールバックする。 */
.pane-frame-enabled {
  padding: var(--wtm-pane-gap, 4px);
}
/*
 * legend（枠に埋め込む名前）のための上の余白（20260923-pane-name-dnd-swap）。tab が1個で
 * tab バーが自動で隠れている（20260922-appearance-settings-rest）ときは、一番上の pane の外側に
 * 余白が無く、名前が画面の外まではみ出て切れる（screenshot を撮って実際に確認・修正した不具合）。
 * `.pane-frame-name` を `.pane-frame` の外へ一切はみ出させない設計にし、この余白の中に収める。
 * PTY の行数はこの内側の大きさから決まる（`ViewSync` が測る）ので、この余白を足した分だけ実際に
 * 行数が減る——見た目の整合を優先する意図的な副作用（`paneFrameThickness` の変更と同じ扱い）。
 */
.pane-frame-enabled-named {
  padding-top: calc(var(--wtm-pane-gap, 4px) + 1.2em);
}
.pane-frame-edge {
  position: absolute;
  inset: 0;
  cursor: context-menu;
}
/* 強調はホバーではなく選択で起きる（20260920-ui-selection-visuals の AC4・AC5）。
 * `inset: 0` の絶対配置なので border は内側に収まり、`.pane-frame-enabled` の 4px は変わらない
 * ——外寸が変わると PTY の行・列が変わってしまう。 */
.pane-frame-edge-current {
  /* 選ばれている pane の枠はテーマごとに背景から 3:1 に寄せた色（20260921-theme-settings の decisions D15。dracula は今と同じ #44475a）。 */
  border: 2px solid var(--wtm-pane-current, #44475a);
}
/*
 * 名前を legend 風に表示するときだけ、フォーカスの無い pane にも薄い枠を出す（herdr の見た目に
 * 寄せた。20260923-pane-name-dnd-swap の design D3・AC1・AC3）。**新しいテーマ変数は足さず**、
 * 既存の `--wtm-menu-border` を `color-mix` で薄めるだけにする（17テーマぶんの値決め・
 * コントラスト検証を避ける）。フォーカス中は `.pane-frame-edge-current` の 2px の強調色をそのまま使う
 * （下の詳細度: `.pane-frame-edge-current.pane-frame-edge-named` が `.pane-frame-edge-named` 単体より
 * 詳細度が高いので、フォーカス中はこちらが勝つ）。
 */
.pane-frame-edge-named {
  /* 55% だと画面上でほぼ見えなかった（screenshot で確認）ので、視認できる強さまで上げた。 */
  border: 1px solid color-mix(in srgb, var(--wtm-menu-border, #44475a) 80%, transparent);
}
.pane-frame-edge-current.pane-frame-edge-named {
  /* `border` の shorthand（`.pane-frame-edge-named`）が幅を 1px に戻してしまうため、幅も明示し直す
   * （screenshot で 1px になっていることを確認して修正）。 */
  border-width: 2px;
  border-color: var(--wtm-pane-current, #44475a);
}
/* ドロップ候補（20260923-pane-name-dnd-swap）：ドラッグ中、ポインタの下にある pane を強調する。 */
.pane-frame-edge-drop-target {
  outline: 2px dashed var(--wtm-accent, #8be9fd);
  outline-offset: -2px;
}
.pane-frame-edge:focus-visible {
  outline: 1px solid var(--wtm-fg, #f8f8f2);
  outline-offset: -1px;
  background: var(--wtm-menu-active-bg, #44475a);
}
/*
 * pane にエージェント名を表示する opt-in の設定（20260922-appearance-settings-rest。design「US4」・AC11）。
 * 20260923-pane-name-dnd-swap で、枠線に埋め込む legend 風の見た目に変更した（herdr の見た目に寄せた）。
 * `top: 0` ＋ `translateY(-50%)` で `.pane-frame-edge` の境界線の上に重ね、背景色（`--wtm-bg`。
 * pane の外側の地色と同じ）で線を隠すことで「線に埋め込まれた」ように見せる。
 * ドラッグの掴み手にするため `pointer-events` は `auto`（以前は `none` だった。AC-I1・AC-I5 は
 * script 側の閾値判定で担保する——名前ラベルの上の単純なクリックは、枠を押したのと同じ
 * 「pane を選ぶ」動作にフォールバックする）。
 */
.pane-frame-name {
  position: absolute;
  /* `.pane-frame` の外へはみ出させない（`.pane-frame-enabled-named` が確保した余白の中に収める。
   * tab バーが無く画面の一番上に pane が接しているときでも切れない）。 */
  top: 0.15em;
  left: 0.6em;
  max-width: calc(100% - 1.2em);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  /* ドラッグ中にテキストとして選択（ハイライト）されないようにする（review 指摘。
   * 掴み手そのものが文字列なので、`Sidebar.vue` の幅ドラッグの帯とは違い実害がある）。 */
  user-select: none;
  font-size: 0.75em;
  padding: 0 0.4em;
  background: var(--wtm-bg, #1e1f29);
  color: color-mix(in srgb, var(--wtm-menu-fg, #f8f8f2) 55%, transparent);
}
.pane-frame-name-current {
  /* herdr の見た目（NAME1 が太字の地の色）に合わせる。`--wtm-pane-current` は枠線用に
   * 3:1（非テキストの WCAG コントラスト）で選ばれた色なので、文字色（4.5:1 が要る）には使わない。 */
  color: var(--wtm-fg, #f8f8f2);
  font-weight: bold;
}
.pane-frame-name-dragging {
  cursor: grabbing;
}
/* 枠（absolute）より後に描くよう relative にして、端末を枠の上に重ねる（中央の押下・右クリックは端末へ届く）。 */
.pane-frame-body {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
