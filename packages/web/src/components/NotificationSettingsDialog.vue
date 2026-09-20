<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { NotificationControllerKey } from "../injection.js";
import type { DesktopPermission } from "../notify/ports.js";
import { useNotificationsStore } from "../store/notifications.js";
import { useViewStore } from "../store/view.js";

/**
 * 通知の設定（20260920-agent-notifications の AC6〜AC8・AC12・AC13）。
 * `view.dialogContext.kind === "notifySettings"` を扱う。形は `ConfirmDialog` と同じ
 * （ネイティブ `<dialog>` ＋ `showModal()` ＋ `@cancel` の抑止）。
 *
 * **切り替えは `role="switch"`**（decisions D2）——APG は switch を「on/off を表し、**操作が即座に効く**もの」
 * と定義しており、AC-I2（押した時点で反映・確定ボタンを置かない）と一致する。
 * 既存の `aria-pressed`（`ExtraKeys` 等）は道具のモードであって設定ではない。
 */
const view = useViewStore();
const store = useNotificationsStore();
const controller = inject(NotificationControllerKey);
// 既存のダイアログと同じ流儀（`ConfirmDialog.vue`）。握りつぶすと、結線を落としたときに
// **「この環境では使えません」という嘘の理由**が利用者に出て、誰も気づかない。
if (!controller) throw new Error("NotificationSettingsDialog: NotificationControllerKey が provide されていません");

const dialogEl = ref<HTMLDialogElement | null>(null);
const firstSwitch = ref<HTMLButtonElement | null>(null);

/**
 * 許可の状態は**明示的に読み直す**（`Notification.permission` は reactive ではないので、
 * computed から呼ぶと**最初に評価したときの値で固まる**——許可を取っても行が「切」のまま、
 * もう一度押しても切に戻せない）。読み直すのは「開いたとき」と「許可を求めた後」。
 */
const permission = ref<DesktopPermission>(controller.desktopPermission());
// `controller` を参照するので arrow function にする（`function` 宣言だと const 絞り込みが効かない。
// `ConfirmDialog.vue` と同じ事情）。
const refreshPermission = (): void => {
  permission.value = controller.desktopPermission();
};

/** OS 通知の行の状態。許可（AC8）と「この環境では使えない」（AC12）を取り違えない。 */
const desktopState = computed<"usable" | "needsPermission" | "denied" | "unusable">(() => {
  if (!store.desktopUsable) return "unusable"; // 実際に出そうとして失敗した（Android Chrome 等）
  if (permission.value === "unsupported") return "unusable";
  if (permission.value === "denied") return "denied";
  return permission.value === "granted" ? "usable" : "needsPermission";
});

const desktopNote = computed(() => {
  switch (desktopState.value) {
    case "unusable":
      return "この環境では使えません（ブラウザが対応していないか、この画面からは出せません）。";
    case "denied":
      return "ブラウザで拒否されています。許可するにはブラウザの設定から変えてください。";
    case "needsPermission":
      return "押すとブラウザに許可を求めます。";
    default:
      return "";
  }
});

const soundNote = computed(() => {
  if (!store.soundUsable) return "この環境では音を鳴らせません（ブラウザが対応していません）。";
  return store.soundBlocked ? "この画面をまだ操作していないため鳴らせませんでした。どこかを押すと鳴るようになります。" : "";
});

watch(
  () => view.dialogContext,
  (ctx) => {
    if (ctx?.kind === "notifySettings") {
      refreshPermission(); // 開くたびに読み直す（前回開いてから外で変わっているかもしれない）
      void nextTick(() => {
        dialogEl.value?.showModal();
        firstSwitch.value?.focus();
      });
    } else {
      dialogEl.value?.close();
    }
  },
);

function toggleToast(): void {
  store.setPrefs({ toast: !store.prefs.toast });
}

/** OS 通知。**許可がまだなら、押した勢い（利用者の操作）でそのまま求める**（AC7・AC8）。 */
const toggleDesktop = async (): Promise<void> => {
  if (desktopState.value === "denied" || desktopState.value === "unusable") return;
  if (desktopState.value === "needsPermission") {
    const p = await controller.requestDesktopPermission();
    permission.value = p; // 読み直す（ここを忘れると、許可を取っても行が「切」のまま固まる）
    if (p !== "granted") return; // 拒否されたら「入」にしない
    store.setPrefs({ desktop: true });
    return;
  }
  store.setPrefs({ desktop: !store.prefs.desktop });
};

/** 音。**「入」にした瞬間が利用者の操作**なので、ここで自動再生を解除しておく（AC13）。 */
const toggleSound = (): void => {
  if (!store.soundUsable) return;
  const next = !store.prefs.sound;
  if (next) controller.unlockSound();
  store.setPrefs({ sound: next });
};

function cancel(): void {
  view.closeDialog();
}

function onNativeCancel(ev: Event): void {
  ev.preventDefault(); // 既定の close は `view` を更新しないので、こちらで閉じる
  cancel();
}
</script>

<template>
  <dialog ref="dialogEl" class="notify-settings" aria-label="通知の設定" @cancel="onNativeCancel" @click.self="cancel">
    <p class="notify-settings-title">通知の設定</p>
    <ul class="notify-settings-list">
      <li class="notify-settings-row">
        <button ref="firstSwitch" type="button" role="switch" class="notify-settings-switch" :aria-checked="store.prefs.toast" @click="toggleToast">
          <span class="notify-settings-mark">{{ store.prefs.toast ? "入" : "切" }}</span>
          <span>画面の中で知らせる</span>
        </button>
      </li>
      <li class="notify-settings-row">
        <button
          type="button"
          role="switch"
          class="notify-settings-switch"
          :aria-checked="store.prefs.desktop && desktopState === 'usable'"
          :disabled="desktopState === 'denied' || desktopState === 'unusable'"
          @click="toggleDesktop"
        >
          <span class="notify-settings-mark">{{ store.prefs.desktop && desktopState === "usable" ? "入" : "切" }}</span>
          <span>OS の通知で知らせる</span>
        </button>
        <p v-if="desktopNote" class="notify-settings-note">{{ desktopNote }}</p>
      </li>
      <li class="notify-settings-row">
        <button
          type="button"
          role="switch"
          class="notify-settings-switch"
          :aria-checked="store.prefs.sound && store.soundUsable"
          :disabled="!store.soundUsable"
          @click="toggleSound"
        >
          <span class="notify-settings-mark">{{ store.prefs.sound && store.soundUsable ? "入" : "切" }}</span>
          <span>音で知らせる</span>
        </button>
        <p v-if="soundNote" class="notify-settings-note">{{ soundNote }}</p>
      </li>
    </ul>
    <p class="notify-settings-hint">この設定はこのブラウザにだけ効きます。Esc で閉じます。</p>
  </dialog>
</template>

<style scoped>
.notify-settings {
  min-width: 22em;
  max-width: 34em;
  padding: 1em;
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-fg, #f8f8f2);
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 6px;
}
.notify-settings::backdrop {
  background: rgb(0 0 0 / 40%);
}
.notify-settings-title {
  margin: 0 0 0.8em;
  font-weight: bold;
}
.notify-settings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8em;
}
.notify-settings-switch {
  display: flex;
  align-items: center;
  gap: 0.6em;
  width: 100%;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 4px;
  padding: 0.4em 0.6em;
  cursor: pointer;
  text-align: left;
}
.notify-settings-switch:disabled {
  opacity: 0.5;
  cursor: default;
}
.notify-settings-mark {
  flex: none;
  min-width: 2em;
  text-align: center;
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 3px;
  padding: 0 0.2em;
}
.notify-settings-switch[aria-checked="true"] .notify-settings-mark {
  background: var(--wtm-menu-active-bg, #44475a);
}
.notify-settings-note {
  margin: 0.3em 0 0;
  font-size: 0.85em;
  opacity: 0.8;
}
.notify-settings-hint {
  margin: 1em 0 0;
  font-size: 0.85em;
  opacity: 0.7;
}
</style>
