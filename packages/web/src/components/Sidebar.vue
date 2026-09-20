<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useSeenStore, aggregate, displayStateFor, type STATE_PRIORITY } from "../store/seen.js";
import { useViewStore } from "../store/view.js";

/**
 * サイドバー（D56 の訂正 9）。「spaces」（workspace の一覧）と「agents」（エージェントの一覧）の 2 区画。
 * `prefix+b` での折りたたみは `view.sidebarCollapsed` を見るだけ（切替自体は `ActionDispatcher`）。
 */
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 360;

const session = useSessionStore();
const seen = useSeenStore();
const view = useViewStore();
const actions = inject(ActionDispatcherKey);
const conn = inject(ConnectionKey);

const width = ref(DEFAULT_WIDTH);
const el = ref<HTMLElement | null>(null);
let dragging = false;
let dragStartX = 0;
let dragStartWidth = 0;
let lastDividerClick = 0;

const spaces = computed(() =>
  [...session.workspaces.values()].map((ws) => {
    const states = session.panesInWorkspace(ws.id).map((p) => displayStateFor(p.agent, seen.getSeenSeq(p.agent?.instanceId ?? "", p.agent?.serverSeenSeq ?? 0)));
    const showGit = !!ws.git && (ws.git.ahead > 0 || ws.git.behind > 0);
    return { workspace: ws, state: aggregate(states) as keyof typeof STATE_PRIORITY | null, showGit };
  }),
);

const agents = computed(() =>
  [...session.panes.values()]
    .filter((p) => p.agent)
    .map((p) => {
      const tab = session.tabs.get(p.tabId);
      const ws = tab ? session.workspaces.get(tab.workspaceId) : undefined;
      const agent = p.agent!;
      const state = displayStateFor(agent, seen.getSeenSeq(agent.instanceId, agent.serverSeenSeq));
      return { pane: p, tab, workspace: ws, agent, state };
    }),
);

/** サイドバーでの選択（M1・AC-I4・AC7）。design「フォーカス系の方式」：自分の表示を変え、サーバの
 *  「最後の選択」も更新する（ほかのクライアントの表示は動かさない）。 */
function focusWorkspace(workspaceId: string): void {
  const ws = session.workspaces.get(workspaceId);
  if (!ws) return;
  const tab = session.tabs.get(ws.activeTabId);
  view.setView(workspaceId, ws.activeTabId);
  if (tab) view.focusPane(tab.focusedPaneId);
  void conn?.request("workspace.focus", { workspaceId }).catch(() => undefined);
}

function focusPane(paneId: string, tabId: string, workspaceId: string): void {
  view.setView(workspaceId, tabId);
  view.focusPane(paneId);
  void conn?.request("pane.focus", { paneId }).catch(() => undefined);
}

function onWorkspaceContextMenu(ev: MouseEvent, workspaceId: string): void {
  ev.preventDefault();
  actions?.openContextMenu({ kind: "workspace", workspaceId }, { x: ev.clientX, y: ev.clientY });
}

function onDividerPointerDown(ev: PointerEvent): void {
  const now = Date.now();
  if (now - lastDividerClick < 350) {
    width.value = DEFAULT_WIDTH; // ダブルクリックで既定幅へ戻す（D56 の訂正 11）
    lastDividerClick = 0;
    return;
  }
  lastDividerClick = now;
  dragging = true;
  dragStartX = ev.clientX;
  dragStartWidth = width.value;
  (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
}

function onDividerPointerMove(ev: PointerEvent): void {
  if (!dragging) return;
  width.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth + (ev.clientX - dragStartX)));
}

function onDividerPointerUp(): void {
  dragging = false;
}
</script>

<template>
  <nav ref="el" class="sidebar" :class="{ 'sidebar-collapsed': view.sidebarCollapsed }" :style="view.sidebarCollapsed ? {} : { width: `${width}px` }">
    <section class="sidebar-spaces" aria-label="spaces">
      <div
        v-for="{ workspace, state, showGit } in spaces"
        :key="workspace.id"
        class="sidebar-row"
        :class="{ 'sidebar-row-selected': view.mode === 'navigate' && view.navigateSelection === workspace.id }"
        @click="focusWorkspace(workspace.id)"
        @contextmenu="onWorkspaceContextMenu($event, workspace.id)"
      >
        <div class="sidebar-row-line1">
          <span class="sidebar-state-icon" :data-state="state ?? 'none'" />
          <span v-if="!view.sidebarCollapsed" class="sidebar-label">{{ workspace.label }}</span>
        </div>
        <div v-if="!view.sidebarCollapsed && showGit" class="sidebar-row-line2">
          <span>{{ workspace.git!.branch }}</span>
          <span>↑{{ workspace.git!.ahead }} ↓{{ workspace.git!.behind }}</span>
        </div>
      </div>
    </section>

    <section class="sidebar-agents" aria-label="agents">
      <div v-for="{ pane, tab, workspace, agent, state } in agents" :key="pane.id" class="sidebar-row" @click="focusPane(pane.id, pane.tabId, workspace?.id ?? '')">
        <div class="sidebar-row-line1">
          <span class="sidebar-state-icon" :data-state="state ?? 'none'" />
          <template v-if="!view.sidebarCollapsed">
            <span class="sidebar-label">{{ workspace?.label }}</span>
            <span class="sidebar-label">{{ tab?.label }}</span>
          </template>
        </div>
        <div v-if="!view.sidebarCollapsed" class="sidebar-row-line2">
          <span>{{ agent.label }}</span>
          <span v-if="!agent.verified" class="sidebar-unverified">未検証</span>
        </div>
      </div>
    </section>

    <div class="sidebar-divider" @pointerdown="onDividerPointerDown" @pointermove="onDividerPointerMove" @pointerup="onDividerPointerUp" />
  </nav>
</template>

<style scoped>
/* 05-e2e-docs T3 の E2E で発見：この component にも `<style>` が一度も存在しなかった（PaneLayout.vue・
 * Splitter.vue・TabBar.vue と同様の欠落。D92）。`state` の色は `GotoPicker.vue`/`PanePicker.vue` の
 * `data-state` の配色（blocked/working/done/idle）に揃える。 */
.sidebar {
  flex: none;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-fg, #f8f8f2);
  border-right: 1px solid var(--wtm-menu-border, #44475a);
}
.sidebar-collapsed {
  width: 3em !important;
}
.sidebar-spaces,
.sidebar-agents {
  padding: 0.5em 0;
}
.sidebar-agents {
  border-top: 1px solid var(--wtm-menu-border, #44475a);
}
.sidebar-row {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  padding: 0.4em 0.8em;
  cursor: pointer;
}
.sidebar-row:hover,
.sidebar-row-selected {
  background: var(--wtm-menu-active-bg, #44475a);
}
.sidebar-row-line1 {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.sidebar-row-line2 {
  display: flex;
  gap: 0.6em;
  padding-left: 1.1em;
  font-size: 0.85em;
  opacity: 0.75;
}
.sidebar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sidebar-state-icon {
  width: 0.6em;
  height: 0.6em;
  flex: none;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.3;
}
.sidebar-state-icon[data-state="blocked"] {
  opacity: 1;
  color: #ff5555;
}
.sidebar-state-icon[data-state="working"] {
  opacity: 1;
  color: #f1fa8c;
}
.sidebar-state-icon[data-state="done"] {
  opacity: 1;
  color: #50fa7b;
}
.sidebar-state-icon[data-state="idle"] {
  opacity: 1;
  color: #6272a4;
}
.sidebar-unverified {
  color: #ffb86c;
}
.sidebar-divider {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
}
</style>
