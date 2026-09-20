<script setup lang="ts">
import { watch } from "vue";
import { useViewStore } from "../store/view.js";

/**
 * トースト表示（T25）。`view.toasts` を並べ、クリックまたは一定時間で消す（design「短く表示する」）。
 * 「pane にフォーカスが入ったら一度だけ `Ctrl+B ?` でキー一覧」の案内（design「フォーカスの抜け道
 * （WCAG 2.1.2）」）を、最初に pane へフォーカスが入ったときに一度だけ出す
 * （`localStorage` で「表示済み」を覚える。ブラウザをまたいでも二度と出さない）。
 */
const HINT_STORAGE_KEY = "wtm.hint.prefixHelp.v1";
const AUTO_DISMISS_MS = 4000;

const view = useViewStore();

function hasShownHint(): boolean {
  try {
    return localStorage.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return true; // 読めない環境では、二度と邪魔しない側に倒す
  }
}
function markHintShown(): void {
  try {
    localStorage.setItem(HINT_STORAGE_KEY, "1");
  } catch {
    // 保存できなくても致命的ではない（次回また出るだけ）
  }
}

watch(
  () => view.focusedPaneId,
  (id) => {
    if (!id || hasShownHint()) return;
    markHintShown();
    view.toast("Ctrl+B ? でキー一覧");
  },
  { immediate: true },
);

// 新しく増えた toast だけに自動消去のタイマーを掛ける（同じ id に何度も掛けない）。
watch(
  () => view.toasts.map((t) => t.id),
  (ids, oldIds) => {
    const before = new Set(oldIds ?? []);
    for (const id of ids) {
      if (!before.has(id)) setTimeout(() => view.dismissToast(id), AUTO_DISMISS_MS);
    }
  },
);

function dismiss(id: number): void {
  view.dismissToast(id);
}
</script>

<template>
  <div class="toast-list" aria-live="polite">
    <div v-for="t in view.toasts" :key="t.id" class="toast" @click="dismiss(t.id)">
      {{ t.message }}
    </div>
  </div>
</template>

<style scoped>
.toast-list {
  position: fixed;
  left: 50%;
  bottom: 3.5em;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  z-index: 950;
}
.toast {
  padding: 0.4em 1em;
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-fg, #f8f8f2);
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 4px;
  cursor: pointer;
}
</style>
