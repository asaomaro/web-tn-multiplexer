<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { ActionDispatcherKey, ConnectionKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useSeenStore, aggregate, displayStateFor, STATE_PRIORITY } from "../store/seen.js";
import { type AgentSort, useViewStore } from "../store/view.js";

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
    // いま表示している workspace か（`PaneFrame` の `selected` と同じ考え方で、判定は 1 箇所に置く）。
    const isCurrent = ws.id === view.workspaceId;
    return { workspace: ws, state: aggregate(states) as keyof typeof STATE_PRIORITY | null, showGit, isCurrent };
  }),
);

/** 全体のメニューが開いているか（`PaneFrame` の枠のボタンと同じく `aria-expanded` で伝える）。 */
const globalMenuOpen = computed(() => view.contextMenu?.target.kind === "global");

/** 並び順の表示名。内部の値（`grouped` / `priority`）をそのまま出さない（decisions.md D6）。 */
const AGENT_SORT_LABEL: Record<AgentSort, string> = { grouped: "グループ順", priority: "優先度順" };

const agents = computed(() => {
  const rows = [...session.panes.values()]
    .filter((p) => p.agent)
    .map((p) => {
      const tab = session.tabs.get(p.tabId);
      const ws = tab ? session.workspaces.get(tab.workspaceId) : undefined;
      const agent = p.agent!;
      const state = displayStateFor(agent, seen.getSeenSeq(agent.instanceId, agent.serverSeenSeq));
      return { pane: p, tab, workspace: ws, agent, state };
    });
  // `grouped` は並べ替えない——サーバが返す順（workspace 順 → tab 順 → pane 順）がそのままグループになる（herdr と同じ）。
  if (view.agentSort === "grouped") return rows;
  // `priority`：手を動かす必要がある順。同点なら状態が最近変わったものを上に。
  // `sort` は安定なので、両方同点なら `grouped` の並びが残る。
  return [...rows].sort((a, b) => {
    const byState = STATE_PRIORITY[b.state ?? "unknown"] - STATE_PRIORITY[a.state ?? "unknown"];
    return byState !== 0 ? byState : b.agent.since - a.agent.since;
  });
});

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

/** 新しい workspace を作る。キーの `prefix+shift+n` と同じ経路（`ActionDispatcher.run`）を通す。 */
function onNewWorkspace(): void {
  actions?.run({ type: "newWorkspace" });
}

/** 全体のメニューを、押したボタンの位置に開く（`ContextMenu` が中身と操作を引き受ける）。 */
function onOpenGlobalMenu(ev: MouseEvent): void {
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  actions?.openContextMenu({ kind: "global" }, { x: rect.left, y: rect.top });
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
        v-for="{ workspace, state, showGit, isCurrent } in spaces"
        :key="workspace.id"
        class="sidebar-row"
        :class="{
          'sidebar-row-current': isCurrent,
          'sidebar-row-selected': view.mode === 'navigate' && view.navigateSelection === workspace.id,
        }"
        :aria-current="isCurrent ? 'true' : undefined"
        @click="focusWorkspace(workspace.id)"
        @contextmenu="onWorkspaceContextMenu($event, workspace.id)"
      >
        <div class="sidebar-row-line1">
          <span class="sidebar-state-icon" :data-state="state ?? 'none'" />
          <span v-if="!view.sidebarCollapsed" class="sidebar-label">{{ workspace.label }}</span>
        </div>
        <div v-if="!view.sidebarCollapsed && showGit" class="sidebar-row-line2">
          <span>{{ workspace.git!.branch }}</span>
          <span class="sidebar-git-counts">↑{{ workspace.git!.ahead }} ↓{{ workspace.git!.behind }}</span>
        </div>
      </div>

      <div v-if="!view.sidebarCollapsed" class="sidebar-section-footer">
        <button type="button" class="sidebar-btn" @click="onNewWorkspace" @keydown.stop>＋ 新規</button>
        <button
          type="button"
          class="sidebar-btn sidebar-btn-right"
          aria-haspopup="menu"
          :aria-expanded="globalMenuOpen ? 'true' : 'false'"
          @click="onOpenGlobalMenu"
          @keydown.stop
        >
          メニュー
        </button>
      </div>
    </section>

    <section class="sidebar-agents" aria-label="agents">
      <div v-if="!view.sidebarCollapsed" class="sidebar-section-header">
        <span class="sidebar-section-title">agents</span>
        <button type="button" class="sidebar-btn sidebar-sort-btn" :aria-label="`並び順: ${AGENT_SORT_LABEL[view.agentSort]}（押すと切り替え）`" @click="view.toggleAgentSort()" @keydown.stop>
          {{ AGENT_SORT_LABEL[view.agentSort] }}
        </button>
      </div>
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

    <div class="sidebar-footer">
      <button
        type="button"
        class="sidebar-btn sidebar-collapse-btn"
        :aria-expanded="!view.sidebarCollapsed"
        :aria-label="view.sidebarCollapsed ? 'サイドバーを開く' : 'サイドバーを畳む'"
        @click="actions?.run({ type: 'toggleSidebar' })"
        @keydown.stop
      >
        {{ view.sidebarCollapsed ? "»" : "«" }}
      </button>
    </div>

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
  /* `overflow-y` を指定すると `overflow-x` も `auto` に計算されるので、横は明示して止める（AC3）。 */
  overflow-x: hidden;
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
/* 3 つの状態を別の表し方に分ける（20260920-ui-selection-visuals の AC2）。以前は hover と
 * navigate の選択が同じ宣言で、しかもタブのアクティブと同じ色だったので見分けが付かなかった。
 * 持続する状態（表示中）は面、一時的なカーソル（navigate）は線にして、重なっても両方読めるようにする。 */
.sidebar-row:hover {
  background: var(--wtm-menu-hover-bg, #343746);
}
/* `.sidebar-row:hover` と詳細度をそろえ、後に置くことで表示中を勝たせる（一時的な状態で上書きしない）。 */
.sidebar-row.sidebar-row-current {
  background: var(--wtm-menu-active-bg, #44475a);
}
.sidebar-row-selected {
  outline: 1px solid var(--wtm-fg, #f8f8f2);
  outline-offset: -1px;
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
/* 長いブランチ名・エージェント名を省略記号で切る（AC3）。flex アイテムに overflow があると
 * main 軸の自動最小サイズが 0 になって縮む——1 行目の `.sidebar-label` と同じ仕組み。 */
.sidebar-row-line2 > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 縮めると意味を失うので縮ませない。 */
.sidebar-git-counts {
  flex: none;
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
  flex: none;
  color: #ffb86c;
}
/* 以前は `right: -3px` で外へ 3px はみ出しており、文字が 1 つも無くても横スクロールバーが出ていた
 * （decisions.md D3）。幅の変更は移動量の差分で決まるので、内側へ寄せても操作感は変わらない。 */
/* ボタンの帯（20260920-sidebar-tabbar-controls）。`.sidebar-divider` が右端 6px を縦一杯に覆うので、
 * その分だけ内側に寄せてボタンがつまみの下に潜らないようにする。 */
.sidebar-section-footer,
.sidebar-section-header,
.sidebar-footer {
  display: flex;
  align-items: center;
  gap: 0.4em;
  flex: none;
  padding: 0.2em 0.8em;
  padding-right: calc(0.8em + 6px);
}
.sidebar-section-header {
  border-bottom: 1px solid var(--wtm-menu-border, #44475a);
}
/* 内容が短いときは下端へ寄る。`.sidebar` の overflow は動かさない（decisions.md D3）。 */
.sidebar-footer {
  margin-top: auto;
  justify-content: flex-end;
}
.sidebar-section-title {
  font-size: 0.85em;
  opacity: 0.75;
}
.sidebar-btn {
  font: inherit;
  font-size: 0.85em;
  color: var(--wtm-fg, #f8f8f2);
  background: none;
  border: none;
  padding: 0.2em 0.4em;
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.sidebar-btn:hover {
  background: var(--wtm-menu-hover-bg, #343746);
}
.sidebar-btn-right,
.sidebar-sort-btn {
  margin-left: auto;
}
.sidebar-collapse-btn {
  padding: 0.2em 0.5em;
}
.sidebar-divider {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
}
</style>
