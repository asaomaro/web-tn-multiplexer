<script setup lang="ts">
import { inject, nextTick, ref, watch } from "vue";
import { ActionDispatcherKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";

/**
 * 名前の入力ダイアログ（T23。design「ダイアログ」）。`view.dialogContext` の
 * `newTab` / `renamePane` / `renameTab` / `renameWorkspace` を扱う。今の名前を入力済み・全選択で開く。
 * 新規 tab は tab の数＋1 を入力済みにする（D55 の 12）。空欄で確定した場合は `ActionDispatcher` 側で
 * 名前を送らない（`confirmNewTab`/`confirmRenameTab`/`confirmRenameWorkspace` が判定する）。
 * 新規 tab は「プリフィルした値から変更していない」場合も送らない（herdr の `overlay_input.rs`
 * `trimmed != default_name` と同じ。D75）——このコンポーネントがプリフィル値を空文字に読み替えて
 * `confirmNewTab` に渡す（`ActionDispatcher` 側の「空なら送らない」判定をそのまま使う）。
 */
const NAME_KINDS = new Set(["newTab", "renamePane", "renameTab", "renameWorkspace"]);

const session = useSessionStore();
const view = useViewStore();
const actions = inject(ActionDispatcherKey);
if (!actions) throw new Error("NameDialog: ActionDispatcherKey が provide されていません");

const dialogEl = ref<HTMLDialogElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const value = ref("");
/** 開いたときのプリフィル値（newTab の「変更なし」判定用。D75）。 */
let openedWithValue = "";

function initialValue(): string {
  const ctx = view.dialogContext;
  if (!ctx) return "";
  if (ctx.kind === "newTab") {
    const ws = session.workspaces.get(ctx.workspaceId);
    return ws ? String(ws.tabIds.length + 1) : "";
  }
  if (ctx.kind === "renamePane" || ctx.kind === "renameTab" || ctx.kind === "renameWorkspace") return ctx.currentLabel;
  return "";
}

function title(): string {
  switch (view.dialogContext?.kind) {
    case "newTab":
      return "新しい tab の名前";
    case "renamePane":
      return "pane の名前を変更";
    case "renameTab":
      return "tab の名前を変更";
    case "renameWorkspace":
      return "workspace の名前を変更";
    default:
      return "";
  }
}

watch(
  () => view.dialogContext,
  (ctx) => {
    if (ctx && NAME_KINDS.has(ctx.kind)) {
      value.value = initialValue();
      openedWithValue = value.value;
      void nextTick(() => {
        dialogEl.value?.showModal();
        inputEl.value?.focus();
        inputEl.value?.select();
      });
    } else {
      dialogEl.value?.close();
    }
  },
);

// `actions` を参照するので、TS の const 絞り込みが効く arrow function（`function` 宣言は不可。narrow が外れる）。
const confirm = (): void => {
  const ctx = view.dialogContext;
  if (!ctx) return;
  if (ctx.kind === "newTab") {
    const trimmed = value.value.trim();
    // プリフィルから変更していなければ、送信対象を空文字にして「送らない」判定へ合流させる（D75）。
    actions.confirmNewTab(trimmed === openedWithValue.trim() ? "" : value.value);
  } else if (ctx.kind === "renamePane") actions.confirmRenamePane(value.value);
  else if (ctx.kind === "renameTab") actions.confirmRenameTab(value.value);
  else if (ctx.kind === "renameWorkspace") actions.confirmRenameWorkspace(value.value);
};

function cancel(): void {
  view.closeDialog();
}

/** ネイティブの Esc（`<dialog>` の `cancel` イベント）。既定の close は抑止し、状態の後始末は `cancel()` に任せる。 */
function onNativeCancel(ev: Event): void {
  ev.preventDefault();
  cancel();
}
</script>

<template>
  <dialog ref="dialogEl" class="name-dialog" @cancel="onNativeCancel" @click.self="cancel">
    <form method="dialog" @submit.prevent="confirm">
      <label class="name-dialog-label">
        <span>{{ title() }}</span>
        <input ref="inputEl" v-model="value" type="text" class="name-dialog-input" />
      </label>
      <div class="name-dialog-actions">
        <button type="button" @click="cancel">キャンセル</button>
        <button type="submit">OK</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.name-dialog {
  border: 1px solid var(--wtm-menu-border, #44475a);
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-menu-fg, #f8f8f2);
  border-radius: 4px;
  min-width: 20em;
  padding: 1em;
}
.name-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.name-dialog-label {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}
.name-dialog-input {
  font: inherit;
  padding: 0.3em 0.5em;
}
.name-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
  margin-top: 1em;
}
</style>
