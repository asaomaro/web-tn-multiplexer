<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { ActionDispatcherKey } from "../injection.js";
import { useViewStore } from "../store/view.js";

/**
 * 既にある worktree を選んで開くダイアログ（20260920-git-worktree-actions の AC4・AC5）。
 *
 * 形は `GotoPicker` に寄せる（ネイティブの `<dialog>` ＋ `role="listbox"` ＋ 自前のキー処理）。
 * **一覧はサーバから受け取った時点で確定している**（`worktree.list` の応答を `dialogContext` に載せて開く）ので、
 * ここでは絞り込みや再取得をしない——`GotoPicker` のような検索は、worktree の数では要らない。
 *
 * **bare と prunable はサーバで落としてある**（開けないものを見せない）。
 */
const view = useViewStore();
const actions = inject(ActionDispatcherKey);

const dialogEl = ref<HTMLDialogElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
const selected = ref(0);

const entries = computed(() => (view.dialogContext?.kind === "worktreeOpen" ? view.dialogContext.entries : []));

watch(
  () => view.dialogContext,
  (next) => {
    if (next?.kind === "worktreeOpen") {
      selected.value = 0;
      void nextTick(() => {
        dialogEl.value?.showModal();
        listEl.value?.focus();
      });
    } else {
      dialogEl.value?.close();
    }
  },
);

function move(delta: number): void {
  const n = entries.value.length;
  if (n === 0) return;
  selected.value = (selected.value + delta + n) % n;
}

const accept = (): void => {
  const entry = entries.value[selected.value];
  if (entry) actions?.confirmWorktreeOpen(entry.path);
};

/** クリックで選んでそのまま確定する（`GotoPicker.vue` の `selectRow` と同じ流儀）。 */
function choose(index: number): void {
  selected.value = index;
  accept();
}

function cancel(): void {
  view.closeDialog();
}

function onNativeCancel(ev: Event): void {
  ev.preventDefault();
  cancel();
}

/** `GotoPicker` と同じ流儀：↑↓ と j/k で移動、Enter で確定、Esc で閉じる。 */
function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === "Escape") {
    ev.preventDefault();
    cancel();
    return;
  }
  if (ev.key === "Enter") {
    ev.preventDefault();
    accept();
    return;
  }
  if (ev.key === "ArrowDown" || ev.key === "j") {
    ev.preventDefault();
    move(1);
    return;
  }
  if (ev.key === "ArrowUp" || ev.key === "k") {
    ev.preventDefault();
    move(-1);
  }
}
</script>

<template>
  <!-- キー処理は `<ul>` ではなく `<dialog>` で受ける（`GotoPicker` / `HelpDialog` と同じ形。review ラウンド1）。
       `<ul>` に付けると、見出しなど focusable でない所をクリックしただけで焦点が外れ、以後 ↑↓/Enter が届かない。 -->
  <dialog
    ref="dialogEl"
    class="worktree-open-dialog"
    aria-label="worktree を開く"
    @cancel="onNativeCancel"
    @click.self="cancel"
    @keydown="onKeydown"
  >
    <p class="worktree-open-dialog-title">worktree を開く</p>
    <ul ref="listEl" class="worktree-open-dialog-list" role="listbox" tabindex="-1">
      <li
        v-for="(entry, index) in entries"
        :key="entry.path"
        class="worktree-open-dialog-item"
        :class="{ 'worktree-open-dialog-item-selected': index === selected }"
        role="option"
        :aria-selected="index === selected"
        @click="choose(index)"
      >
        <span class="worktree-open-dialog-branch">{{ entry.branch ?? "(detached)" }}</span>
        <span class="worktree-open-dialog-path">{{ entry.path }}</span>
      </li>
    </ul>
  </dialog>
</template>

<style scoped>
.worktree-open-dialog {
  border: 1px solid var(--wtm-menu-border, #44475a);
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-menu-fg, #f8f8f2);
  border-radius: 4px;
  min-width: 32em;
  padding: 1em;
}
.worktree-open-dialog::backdrop {
  background: var(--wtm-backdrop, rgba(0, 0, 0, 0.4));
}
.worktree-open-dialog-title {
  margin: 0 0 0.6em;
  font-size: 0.9em;
  opacity: 0.75;
}
.worktree-open-dialog-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 60vh;
  overflow-y: auto;
}
.worktree-open-dialog-item {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  padding: 0.4em 0.6em;
  cursor: pointer;
}
.worktree-open-dialog-item:hover {
  background: var(--wtm-menu-hover-bg, #343746);
}
/* `:hover` と詳細度をそろえ、後に置くことで選択中を勝たせる（`Sidebar.vue` と同じ形。review ラウンド1）。
 * そろえないと `:hover`（0,2,0）が `-selected`（0,1,0）に勝ち、**選択中の行にポインタが乗ると
 * 選択色が消えて、↑↓ で選んで Enter という主操作でどれが確定されるか読めなくなる**。 */
.worktree-open-dialog-item.worktree-open-dialog-item-selected {
  background: var(--wtm-menu-active-bg, #44475a);
}
.worktree-open-dialog-path {
  font-size: 0.85em;
  opacity: 0.75;
  overflow-wrap: anywhere;
}
</style>
