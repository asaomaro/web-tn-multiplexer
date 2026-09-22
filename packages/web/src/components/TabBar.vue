<script setup lang="ts">
import { computed, inject } from "vue";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useSettingsStore } from "../store/settings.js";
import { useViewStore } from "../store/view.js";
import { useTabBarClock } from "../tabbar/tabBarClock.js";
import {
  formatDatetime,
  type TabBarPosition,
  type TabBarRightEntry,
} from "../tabbar/tabBarRight.js";

/**
 * tab の一覧（design「サイドバー」隣接の tab バー。D56 の訂正 9・10）。状態の印は出さない、拡大中は「Z」だけ。
 * tab バー上のホイールで前後の tab に切り替える（D56 の訂正 11。research F3 に無いが herdr にある操作）。
 *
 * 20260922-tabbar-pane-appearance：位置（`position` prop。design AC1）・自動非表示（AC2）・右端のエントリ
 * （AC3・AC4）を足す。**`position` だけは呼び出し側（`App.vue`）から prop で受け取り**、それ以外
 * （`hideTabBarWhenSingleTab`・`tabBarRight`・`tabBarRightSeparator`）は既存の `session`/`view` と同じように
 * `useSettingsStore()` を直接見る（design「振る舞いの詳細」）。
 */
const props = withDefaults(defineProps<{ position?: TabBarPosition }>(), { position: "top" });

const session = useSessionStore();
const view = useViewStore();
const settings = useSettingsStore();
const actions = inject(ActionDispatcherKey);
const conn = inject(ConnectionKey);

const tabs = computed(() => {
  const ws = view.workspaceId ? session.workspaces.get(view.workspaceId) : undefined;
  if (!ws) return [];
  return ws.tabIds.map((id) => session.tabs.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
});

/** tab が 1 つなら自動的に隠す（AC2）。隠れている間は「＋新しいタブ」も消える（herdr と同じ）。 */
const tabBarVisible = computed(() => tabs.value.length > 1 || !settings.hideTabBarWhenSingleTab);

/** いま表示中の tab（右端の zoom エントリに使う）。 */
const currentTab = computed(() => (view.tabId ? session.tabs.get(view.tabId) : undefined));

/** `tabBarRight` に `datetime` 種別が 1 つでもあるときだけ時計を動かす（design「振る舞いの詳細」）。 */
const hasDatetimeEntry = computed(() => settings.tabBarRight.some((e) => e.kind === "datetime"));
const now = useTabBarClock(hasDatetimeEntry);

function entryText(entry: TabBarRightEntry): string {
  switch (entry.kind) {
    case "zoom":
      return currentTab.value?.zoomedPaneId ? "Z" : "";
    case "hostname":
      return session.host?.hostname ?? "";
    case "datetime":
      return formatDatetime(entry.format, now.value);
    case "text":
      return entry.text;
  }
}

/** 右端の帯の文字列（AC3・AC4）。空文字のエントリも位置は保つ——区切り文字が詰まって見えても許容する（design）。 */
const rightText = computed(() =>
  settings.tabBarRight.map(entryText).join(settings.tabBarRightSeparator),
);

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
  <div
    v-if="tabBarVisible"
    class="tab-bar"
    :class="`tab-bar-${props.position}`"
    :style="{ order: props.position === 'bottom' ? 1 : 0 }"
    @wheel="onWheel"
  >
    <!-- `role="tablist"` が持てるのは `tab` だけなので、＋ と右端の帯はこの入れ子の外に置く。 -->
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
    <span v-if="rightText" class="tab-bar-right" aria-hidden="true">{{ rightText }}</span>
  </div>
</template>

<style scoped>
/* 05-e2e-docs T3 の E2E で発見：この component にも `<style>` が一度も存在しなかった（PaneLayout.vue・
 * Splitter.vue と同様。D92）。`.app-main`（App.vue）が `flex-direction:column` なので、ここは
 * 横並びの帯として `flex:none` で高さだけ確保する。 */
.tab-bar {
  flex: none;
  display: flex;
  align-items: center;
  background: var(--wtm-menu-bg, #282a36);
}
/* 区切り線は帯が接する側に置く（20260922-tabbar-pane-appearance）。上：pane 領域との境が下側。
 * 下：pane 領域との境が上側。 */
.tab-bar-top {
  border-bottom: 1px solid var(--wtm-menu-border, #44475a);
}
.tab-bar-bottom {
  border-top: 1px solid var(--wtm-menu-border, #44475a);
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
/* 右端の帯（20260922-tabbar-pane-appearance。AC3・AC4）。タブの列・＋ の後、帯の右端に寄せる。 */
.tab-bar-right {
  flex: 1 1 auto;
  padding: 0 0.8em;
  overflow: hidden;
  text-align: right;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--wtm-fg, #f8f8f2);
  opacity: 0.75;
  font-size: 0.9em;
}
</style>
