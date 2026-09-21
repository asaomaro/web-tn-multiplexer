<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { ActionDispatcherKey } from "../injection.js";
import { useViewStore } from "../store/view.js";

/**
 * 閉じる確認ダイアログ（T23。design「ダイアログ」）。`view.dialogContext.kind === "confirmClose"` を扱う。
 * `role=alertdialog`・最初のフォーカスは「キャンセル」・`y`/`n` でも確定/取り消しできる。
 */
const view = useViewStore();
const actions = inject(ActionDispatcherKey);
if (!actions) throw new Error("ConfirmDialog: ActionDispatcherKey が provide されていません");

const dialogEl = ref<HTMLDialogElement | null>(null);
const cancelBtn = ref<HTMLButtonElement | null>(null);

const TARGET_LABEL: Record<"pane" | "tab" | "workspace", string> = {
  pane: "pane",
  tab: "tab",
  workspace: "workspace",
};

const message = computed(() => {
  const ctx = view.dialogContext;
  if (ctx?.kind !== "confirmClose") return "";
  const labels = ctx.targets.map((t) => TARGET_LABEL[t.type]);
  return `閉じますか？（${labels.join("・")}）`;
});

watch(
  () => view.dialogContext,
  (ctx) => {
    if (ctx?.kind === "confirmClose") {
      void nextTick(() => {
        dialogEl.value?.showModal();
        cancelBtn.value?.focus();
      });
    } else {
      dialogEl.value?.close();
    }
  },
);

// `actions` を参照するので arrow function にする（`function` 宣言だと const 絞り込みが効かない）。
const confirm = (): void => {
  actions.confirmClose();
};

function cancel(): void {
  view.closeDialog();
}

function onNativeCancel(ev: Event): void {
  ev.preventDefault();
  cancel();
}

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === "y" || ev.key === "Y") {
    ev.preventDefault();
    confirm();
  } else if (ev.key === "n" || ev.key === "N") {
    ev.preventDefault();
    cancel();
  }
}
</script>

<template>
  <dialog
    ref="dialogEl"
    role="alertdialog"
    aria-modal="true"
    class="confirm-dialog"
    @cancel="onNativeCancel"
    @click.self="cancel"
    @keydown="onKeydown"
  >
    <p class="confirm-dialog-message">{{ message }}</p>
    <div class="confirm-dialog-actions">
      <button ref="cancelBtn" type="button" @click="cancel">キャンセル</button>
      <button type="button" @click="confirm">閉じる</button>
    </div>
  </dialog>
</template>

<style scoped>
.confirm-dialog {
  border: 1px solid var(--wtm-menu-border, #44475a);
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-menu-fg, #f8f8f2);
  border-radius: 4px;
  min-width: 18em;
  padding: 1em;
}
.confirm-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.confirm-dialog-message {
  margin: 0 0 1em;
}
.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
}
</style>
