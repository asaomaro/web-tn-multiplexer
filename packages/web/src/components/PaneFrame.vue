<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref } from "vue";
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

onBeforeUnmount(() => {
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
    :class="{ 'pane-frame-enabled': enabled }"
    :role="enabled ? 'group' : undefined"
    :aria-label="enabled ? paneLabel : undefined"
    :aria-current="enabled && selected ? 'true' : undefined"
  >
    <div
      v-if="enabled"
      ref="edge"
      class="pane-frame-edge"
      :class="{ 'pane-frame-edge-current': selected }"
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
      v-if="enabled && settings?.paneAgentNameVisible && paneName"
      class="pane-frame-name"
      aria-hidden="true"
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
.pane-frame-edge:focus-visible {
  outline: 1px solid var(--wtm-fg, #f8f8f2);
  outline-offset: -1px;
  background: var(--wtm-menu-active-bg, #44475a);
}
/*
 * pane にエージェント名を表示する opt-in の設定（20260922-appearance-settings-rest。design「US4」・AC11）。
 * `.pane-frame-edge` の隅に小さく重ねる——`.pane-frame-edge` 自身がクリック（メニューを開く）を処理するので、
 * `pointer-events: none` でこの帯の上のクリックも同じ扱いにする（枠のクリック領域を狭めない）。
 */
.pane-frame-name {
  position: absolute;
  top: 0;
  left: 0;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
  font-size: 0.75em;
  padding: 0.1em 0.4em;
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-menu-fg, #f8f8f2);
  border-bottom-right-radius: 3px;
  opacity: 0.85;
}
/* 枠（absolute）より後に描くよう relative にして、端末を枠の上に重ねる（中央の押下・右クリックは端末へ届く）。 */
.pane-frame-body {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
