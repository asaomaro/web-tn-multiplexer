<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { ActionDispatcherKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import { linkedWorktreeChildrenOf } from "../store/workspaceGrouping.js";

/**
 * 閉じる確認ダイアログ（T23。design「ダイアログ」）。`view.dialogContext.kind === "confirmClose"` を扱う。
 * `role=alertdialog`・最初のフォーカスは「キャンセル」・`y`/`n` でも確定/取り消しできる。
 * 「束ねた worktree も一緒に閉じる」チェックボックス（20260923-workspace-grouping。herdr の
 * `close_group` 相当）は、対象が worktree 自動グループの本体（親）1件のときだけ出す。
 *
 * `kind === "confirmReplacePane"`（20260924-pane-dnd-split-move。review 指摘 must）も同じ
 * ダイアログで扱う——D&D での分割解除（`pane.replace`）のドロップ先が busy なときの確認。
 * `pane.close` と同じ D23 の安全策を踏襲する（既存の busy pane 確認と見た目・操作感を揃える）。
 */
const session = useSessionStore();
const view = useViewStore();
const actions = inject(ActionDispatcherKey);
if (!actions) throw new Error("ConfirmDialog: ActionDispatcherKey が provide されていません");

const dialogEl = ref<HTMLDialogElement | null>(null);
const cancelBtn = ref<HTMLButtonElement | null>(null);
/** 「束ねた worktree も一緒に閉じる」チェックボックスの状態。既定オフ（design「振る舞いの詳細（一括クローズ）」）。 */
const closeLinkedWorktrees = ref(false);

const TARGET_LABEL: Record<"pane" | "tab" | "workspace", string> = {
  pane: "pane",
  tab: "tab",
  workspace: "workspace",
};

const message = computed(() => {
  const ctx = view.dialogContext;
  if (ctx?.kind === "confirmClose") {
    const labels = ctx.targets.map((t) => TARGET_LABEL[t.type]);
    return `閉じますか？（${labels.join("・")}）`;
  }
  if (ctx?.kind === "confirmReplacePane") {
    return "ドロップ先の pane はまだ動作中です。閉じてドラッグした pane に置き換えますか？";
  }
  return "";
});

/** 対象が worktree 自動グループの本体（親）1件のときだけ、束ねられた linked worktree を返す（無ければ空）。 */
const linkedWorktrees = computed(() => {
  const ctx = view.dialogContext;
  if (ctx?.kind !== "confirmClose" || ctx.targets.length !== 1) return [];
  const target = ctx.targets[0]!;
  if (target.type !== "workspace") return [];
  return linkedWorktreeChildrenOf(target.id, [...session.workspaces.values()]);
});

watch(
  () => view.dialogContext,
  (ctx) => {
    if (ctx?.kind === "confirmClose" || ctx?.kind === "confirmReplacePane") {
      closeLinkedWorktrees.value = false; // 開くたびに既定オフへ戻す（confirmClose 以外では未使用）
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
  if (view.dialogContext?.kind === "confirmReplacePane") actions.confirmReplacePane();
  else actions.confirmClose(closeLinkedWorktrees.value);
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
    <label v-if="linkedWorktrees.length > 0" class="confirm-dialog-linked-worktrees">
      <input v-model="closeLinkedWorktrees" type="checkbox" />
      束ねた worktree も一緒に閉じる（{{ linkedWorktrees.length }} 件）
    </label>
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
  background: var(--wtm-backdrop, rgba(0, 0, 0, 0.4));
}
.confirm-dialog-message {
  margin: 0 0 1em;
}
.confirm-dialog-linked-worktrees {
  display: flex;
  align-items: center;
  gap: 0.4em;
  margin: 0 0 1em;
  font-size: 0.9em;
}
.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
}
</style>
