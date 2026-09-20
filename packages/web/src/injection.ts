import type { InjectionKey } from "vue";
import type { ActionDispatcher } from "./actions/ActionDispatcher.js";
import type { KeyInputController } from "./keys/KeyInputController.js";
import type { NotificationController } from "./notify/NotificationController.js";
import type { ConnectionPort } from "./net/ports.js";
import type { TerminalRegistry } from "./term/TerminalRegistry.js";
import type { ViewSync } from "./term/ViewSync.js";

/**
 * コンポーネントへ渡す部品の provide/inject キー（`main.ts` が組み立てて provide する。T26）。
 * `store/*` は Pinia 自身の仕組み（`useSessionStore()` 等）で届くので、ここには含めない。
 */
export const ConnectionKey: InjectionKey<ConnectionPort> = Symbol("connection");
export const ActionDispatcherKey: InjectionKey<ActionDispatcher> = Symbol("actionDispatcher");
export const TerminalRegistryKey: InjectionKey<TerminalRegistry> = Symbol("terminalRegistry");
export const ViewSyncKey: InjectionKey<ViewSync> = Symbol("viewSync");
/** 通知（20260920-agent-notifications）。設定ダイアログが許可と音の解除に触る。 */
export const NotificationControllerKey: InjectionKey<NotificationController> = Symbol("notificationController");
/** `mobile/ExtraKeys.vue`（04-mobile T3）が `injectKey` へ直接キーを流すために使う。 */
export const KeyInputControllerKey: InjectionKey<KeyInputController> = Symbol("keyInputController");
