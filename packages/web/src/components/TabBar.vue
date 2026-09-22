<script setup lang="ts">
import { computed, inject, nextTick, onUnmounted, ref, watch } from "vue";
import { ActionDispatcherKey, ConnectionKey, TerminalRegistryKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";

/**
 * tab の一覧（design「サイドバー」隣接の tab バー。D56 の訂正 9・10）。状態の印は出さない、拡大中は「Z」だけ。
 * tab バー上のホイールで前後の tab に切り替える（D56 の訂正 11。研究 F3 に無いが herdr にある操作）。
 *
 * **tab が1個のときは自動で隠す**（20260922-appearance-settings-rest。design「US2」・AC4〜AC6）。
 * 切り替える先が無いので、常に表示し続ける意味が無い——空いた縦の領域を端末に使う。
 * **右端に現在時刻を出す**（design「US3」・AC7・AC8。tab バーが表示されているときだけ、装飾的な情報
 * として `aria-hidden` で出す）。
 */
const session = useSessionStore();
const view = useViewStore();
const actions = inject(ActionDispatcherKey);
const conn = inject(ConnectionKey);
const registry = inject(TerminalRegistryKey, undefined);

const tabs = computed(() => {
  const ws = view.workspaceId ? session.workspaces.get(view.workspaceId) : undefined;
  if (!ws) return [];
  return ws.tabIds.map((id) => session.tabs.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
});

const root = ref<HTMLElement | null>(null);
/** tab バーが見えているか（`v-if` と同じ条件をここにも持つ）。 */
const visible = computed(() => tabs.value.length !== 1);

/**
 * tab バーの中にフォーカスがあるまま非表示になるとき（自動非表示。AC-I6）、選ばれている pane の
 * 端末へフォーカスを戻す。**`onBeforeUnmount` ではなく `watch`**——`v-if` はこのコンポーネント
 * 自身のテンプレートの根に付いており、親（`App.vue`）は `<TabBar/>` を常に描いたままなので、
 * コンポーネント自体の mount/unmount は起きない（`PaneFrame.vue` の `onBeforeUnmount` は、親
 * `PaneLayout.vue` が `:key` で**コンポーネントごと**入れ替える〔D86〕から効く——構造が違う）。
 * `watch` の既定のタイミング（DOM の更新より前）を使い、消える直前（DOM がまだ古いまま）の
 * `document.activeElement` を見る。
 */
watch(visible, (isVisible) => {
  if (isVisible) return;
  if (!root.value?.contains(document.activeElement)) return;
  void nextTick(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    if (view.focusedPaneId) registry?.focus(view.focusedPaneId);
  });
});

/**
 * 現在時刻（AC7・AC8）。15秒ごとに更新——分の変わり目を最大15秒の遅延で拾えば足りる（design「US3」）。
 * **表示されている間だけ動かす**——`v-if` はこのコンポーネント自身の内側にあり、隠れていても
 * コンポーネント自体は生き続けるので、素朴に `onMounted`/`onUnmounted` だけに任せると隠れている
 * 間も無駄に動き続ける。
 */
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | undefined;
watch(
  visible,
  (isVisible) => {
    clearInterval(clockTimer);
    clockTimer = undefined;
    if (!isVisible) return;
    now.value = new Date(); // 隠れていた間に古くなった値を、出た瞬間に最新へ
    clockTimer = setInterval(() => (now.value = new Date()), 15_000);
  },
  { immediate: true },
);
onUnmounted(() => clearInterval(clockTimer));
const clockText = computed(() => {
  const h = String(now.value.getHours()).padStart(2, "0");
  const m = String(now.value.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
});

function selectTab(tabId: string): void {
  const tab = session.tabs.get(tabId);
  if (!tab || !view.workspaceId) return;
  view.setView(view.workspaceId, tabId);
  view.focusPane(tab.focusedPaneId);
  void conn?.request("tab.focus", { tabId }).catch(() => undefined);
}

function onContextMenu(ev: MouseEvent, tabId: string): void {
  ev.preventDefault();
  actions?.openContextMenu({ kind: "tab", tabId }, { x: ev.clientX, y: ev.clientY });
}

/**
 * 新しいタブ。`view.workspaceId` は `string | null` で `newTabInWorkspace` は `string` を要るので、
 * **テンプレートではなくここで null を外す**（`:disabled` を付けてもテンプレート式の型は狭まらない）。
 * タブが 0 個でも押せる——タブが無い workspace こそ導線が要る（右クリックの対象が消えるため）。
 */
function onNewTab(): void {
  const id = view.workspaceId;
  if (id) actions?.newTabInWorkspace(id);
}

function onWheel(ev: WheelEvent): void {
  ev.preventDefault();
  actions?.run({ type: "tabDelta", delta: ev.deltaY > 0 ? 1 : -1 });
}
</script>

<template>
  <div v-if="tabs.length !== 1" ref="root" class="tab-bar" @wheel="onWheel">
    <!-- `role="tablist"` が持てるのは `tab` だけなので、＋ と時刻はこの入れ子の外に置く。 -->
    <div class="tab-bar-tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="tab-bar-item"
        :class="{ 'tab-bar-item-active': tab.id === view.tabId }"
        :aria-selected="tab.id === view.tabId"
        @click="selectTab(tab.id)"
        @contextmenu="onContextMenu($event, tab.id)"
      >
        <span class="tab-bar-label">{{ tab.label }}</span>
        <span v-if="tab.zoomedPaneId" class="tab-bar-zoomed">Z</span>
      </button>
    </div>
    <button type="button" class="tab-bar-new" :disabled="!view.workspaceId" aria-label="新しいタブ" @click="onNewTab" @keydown.stop>＋</button>
    <span class="tab-bar-clock" aria-hidden="true">{{ clockText }}</span>
  </div>
</template>

<style scoped>
/* 05-e2e-docs T3 の E2E で発見：この component にも `<style>` が一度も存在しなかった（PaneLayout.vue・
 * Splitter.vue と同様。D92）。`.app-main`（App.vue）が `flex-direction:column` なので、ここは
 * 横並びの帯として `flex:none` で高さだけ確保する。 */
.tab-bar {
  flex: none;
  display: flex;
  background: var(--wtm-menu-bg, #282a36);
  border-bottom: 1px solid var(--wtm-menu-border, #44475a);
}
/* 横スクロールはタブの列だけ。＋ は右端に残す（スクロールの向こうへ消えない）。 */
.tab-bar-tabs {
  display: flex;
  min-width: 0;
  overflow-x: auto;
}
/* 高さをタブと揃える。`font: inherit` を落とすと既定のボタンフォントで行の高さが変わり、
 * 帯が高くなって PTY の行が減る（AC14）。 */
.tab-bar-new {
  flex: none;
  padding: 0.5em 0.8em;
  font: inherit;
  color: var(--wtm-fg, #f8f8f2);
  background: none;
  /* 最後のタブが既に `border-right` を持つので、ここで左にも引くと境目だけ 2px になる（border は重ならない）。 */
  border: none;
  cursor: pointer;
}
.tab-bar-new:hover:not(:disabled) {
  background: var(--wtm-menu-hover-bg, #343746);
}
.tab-bar-new:disabled {
  opacity: 0.4;
  cursor: default;
}
.tab-bar-item {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.5em 1em;
  font: inherit;
  color: var(--wtm-fg, #f8f8f2);
  background: none;
  border: none;
  border-right: 1px solid var(--wtm-menu-border, #44475a);
  cursor: pointer;
  white-space: nowrap;
}
.tab-bar-item-active {
  background: var(--wtm-menu-active-bg, #44475a);
}
.tab-bar-zoomed {
  opacity: 0.7;
  font-size: 0.85em;
}
/* 現在時刻（20260922-appearance-settings-rest。design「US3」・AC7）。装飾的な情報なので控えめに。 */
.tab-bar-clock {
  flex: none;
  align-self: center;
  padding: 0 0.8em;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}
</style>
