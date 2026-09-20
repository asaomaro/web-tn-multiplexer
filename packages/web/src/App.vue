<script setup lang="ts">
import { computed } from "vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ContextMenu from "./components/ContextMenu.vue";
import DetachedView from "./components/DetachedView.vue";
import GotoPicker from "./components/GotoPicker.vue";
import HelpDialog from "./components/HelpDialog.vue";
import LoginView from "./components/LoginView.vue";
import NameDialog from "./components/NameDialog.vue";
import PaneLayout from "./components/PaneLayout.vue";
import PrefixIndicator from "./components/PrefixIndicator.vue";
import ReconnectOverlay from "./components/ReconnectOverlay.vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import TerminalPane from "./components/TerminalPane.vue";
import Toast from "./components/Toast.vue";
import { isMobileViewport } from "./mobile/detect.js";
import MobileShell from "./mobile/MobileShell.vue";
import { useSessionStore } from "./store/session.js";
import { useViewStore } from "./store/view.js";

/**
 * 接続の状態で LoginView / DetachedView / 本体を切り替える（T26。design「接続・ログイン・初回表示」
 * 「client.detach」）。本体はさらに、画面幅で 1 列（`MobileShell`）/ デスクトップの本体を切り替える
 * （04-mobile T8。`isMobileViewport()` は `client.hello` の `kind`——`isCoarsePointer()`、`main.ts`——とは
 * 別軸：ウィンドウを狭くしたデスクトップでも 1 列になってよい）。
 * 部品の配線（circular port の bind を含む）は `main.ts`（composition root）の責務——ここはテンプレートの
 * 切り替えと、現在の tab のレイアウト木を `PaneLayout` へ渡すだけ。
 */
const session = useSessionStore();
const view = useViewStore();

const currentTab = computed(() => (view.tabId ? session.tabs.get(view.tabId) : undefined));
const isMobile = isMobileViewport();
</script>

<template>
  <LoginView v-if="view.authRequired" />
  <DetachedView v-else-if="view.connectionState === 'detached'" />
  <div v-else class="app-shell">
    <MobileShell v-if="isMobile" />
    <template v-else>
      <Sidebar />
      <div class="app-main">
        <TabBar />
        <div class="app-panes">
          <!-- 窓の大きさ・サイドバーの幅や折りたたみの変化に client.view を追従させる（D107）。pane ごとに枠を描く（右クリックで
               常にメニューを開く縁。D110）。どちらもモバイルの MobileShell には付けない -->
          <PaneLayout
            v-if="currentTab && view.workspaceId"
            :workspace-id="view.workspaceId"
            :tab-id="currentTab.id"
            :layout="currentTab.layout"
            :zoomed-pane-id="currentTab.zoomedPaneId"
            follow-resize
            pane-frames
          >
            <template #pane="{ paneId }">
              <TerminalPane :pane-id="paneId" />
            </template>
          </PaneLayout>
        </div>
      </div>
    </template>
    <ContextMenu />
    <NameDialog />
    <ConfirmDialog />
    <HelpDialog />
    <GotoPicker />
    <PrefixIndicator />
    <Toast />
    <ReconnectOverlay />
  </div>
</template>

<style>
:root {
  --wtm-bg: #1e1f29;
  --wtm-fg: #f8f8f2;
  --wtm-menu-bg: #282a36;
  --wtm-menu-fg: #f8f8f2;
  --wtm-menu-border: #44475a;
  --wtm-menu-active-bg: #44475a;
  /* 一時的なホバーの面。--wtm-menu-bg(#282a36) より明るく --wtm-menu-active-bg(#44475a) より暗い色にして、
   * 表示中と取り違えないようにする。 */
  --wtm-menu-hover-bg: #343746;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  background: var(--wtm-bg);
  color: var(--wtm-fg);
  font-family: system-ui, sans-serif;
}
.app-shell {
  display: flex;
  height: 100%;
}
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.app-panes {
  flex: 1;
  min-height: 0;
}
</style>
