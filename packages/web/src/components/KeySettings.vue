<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  applyRecommended,
  planReset,
  validateAssignment,
  type AssignResult,
  type AssignTarget,
} from "../keys/assign.js";
import {
  ACTIONS,
  actionDef,
  type ActionDef,
  type ActionGroup,
  type ActionId,
} from "../keys/bindings.js";
import { formatBinding, keyInputOf, type KeyboardEventLike } from "../keys/chord.js";
import { displayBinding, type LayoutMap } from "../keys/chordDisplay.js";
import { useSettingsStore } from "../store/settings.js";
import { useViewStore } from "../store/view.js";
import { isMacPlatform } from "../term/MouseBridge.js";

/**
 * 設定の節「キー」（20260921-keybinding-customization。design「取り込み」「節「キー」の構成」・D9）。**押したキーをそのまま取り込んで割り当てる**——
 * macOS のキーボードショートカットや Discord の Keybinds と同じ（確定は押した瞬間。research F28）。通れば即反映・保存（確定ボタンを置かない）、
 * 通らなければ理由を出して元のまま。
 *
 * - 各操作を `<details>`（開閉は標準の Enter/Space）で並べ、開くと割り当て 1 つずつの［変更］［削除］と、操作ごとの［追加：prefix の後］［追加：直接］が出る
 *   （タブ停止を操作数＋開いた 1 行に抑える。D9）。prefix の行は［変更］。
 * - **取り込み待ちは 1 つだけ**。取り込みの部品（`<button>`）へフォーカスを移し、`keydown` を `preventDefault()`＋`stopPropagation()` で受けて漏らさない
 *   （Esc でダイアログが閉じる・prefix に入る・端末へ届く、を起こさない。AC-I5）。Esc で取り消し。フォーカスを失う・ダイアログを閉じるでも元のまま終わる（AC-I1）。
 * - 終わったら**押したボタンへフォーカスを戻す**（確定して chip が作り直されるときは新しい割り当ての［変更］へ。削除は同じ行の次の部品へ。AC-I4）。
 *   ただし**フォーカスを失って終わるときは戻さない**（利用者が別の部品を選んだのを奪い返さない）。
 * - 結果は `role="status"` の 1 行に出す（読み上げ。画面の下に固定して、長い一覧のどこを操作しても見える）。
 */
const settings = useSettingsStore();
const view = useViewStore();

/** 取り込み待ちか（親の設定画面へ知らせる。取り込み待ちの間はネイティブの `cancel`〔Esc〕で設定画面を閉じない）。 */
const capturing = defineModel<boolean>("capturing", { default: false });
/** 端末の種類。モバイルは画面のキーボードでキーの組み合わせを取り込めないので、一言添える（AC1 のため節自体は出す。D11）。 */
const props = withDefaults(defineProps<{ kind?: "desktop" | "mobile" }>(), { kind: "desktop" });

const GROUPS: readonly ActionGroup[] = ["全体", "workspace / tab", "pane"];
/** 操作名・群名での絞り込み（20260922-keybinding-usability。design「US1」・AC1〜AC3）。 */
const filterText = ref("");
const actionsByGroup = computed(() => {
  const q = filterText.value.trim().toLowerCase();
  const matches = (a: ActionDef, group: ActionGroup): boolean =>
    q === "" || a.label.toLowerCase().includes(q) || group.toLowerCase().includes(q);
  return GROUPS.map((group) => ({
    group,
    actions: ACTIONS.filter((a) => a.group === group && matches(a, group)),
  })).filter((g) => g.actions.length > 0); // AC2：0 件の群は見出しごと消える
});

const root = ref<HTMLElement | null>(null);
const message = ref("");
/** いま取り込み待ちの対象（無ければ null）。 */
const target = ref<AssignTarget | null>(null);
/** 取り込み待ちを始めたボタン（終わったら戻す先）。 */
let trigger: HTMLElement | null = null;
/**
 * 衝突して「こちらへ移す」を出せる状態（20260922-keybinding-usability。design「US2」）。
 * 次の取り込み・ダイアログを閉じるで消える（AC6）。
 */
const pendingMove = ref<{
  target: Extract<AssignTarget, { kind: "binding" }>;
  conflict: NonNullable<Extract<AssignResult, { ok: false }>["conflict"]>;
} | null>(null);

const bindingsOf = (id: ActionId): readonly string[] => settings.keymap.bindingsOf(id);
/**
 * macOS の非 US 配列での Option chord 表示の補正（20260922-keybinding-usability。design「US3」・
 * AC8〜AC10）。`getLayoutMap()` が使えない環境・macOS 以外では `null` のまま（AC9。取得中も
 * `null` なので、取得できるまでは今までどおりの表示のまま）。
 */
const layoutMap = ref<LayoutMap | null>(null);
onMounted(async () => {
  if (!isMacPlatform()) return;
  const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<LayoutMap> } })
    .keyboard;
  if (typeof keyboard?.getLayoutMap !== "function") return;
  try {
    layoutMap.value = await keyboard.getLayoutMap();
  } catch {
    // AC9：取得できない環境では今までの表示のまま。
  }
});
const displayFor = (binding: string): string => displayBinding(binding, layoutMap.value);
const bindingsText = (id: ActionId): string => {
  const list = bindingsOf(id);
  return list.length === 0 ? "なし" : list.map(displayFor).join(" / ");
};
const viaOf = (binding: string): "prefix" | "direct" =>
  binding.startsWith("prefix+") ? "prefix" : "direct";

const PREFIX_TARGET: AssignTarget = { kind: "prefix" };
const addTarget = (id: ActionId, via: "prefix" | "direct"): AssignTarget => ({
  kind: "binding",
  id,
  via,
});
const changeTarget = (id: ActionId, binding: string): AssignTarget => ({
  kind: "binding",
  id,
  via: viaOf(binding),
  replacing: binding,
});

function isCapturing(t: AssignTarget): boolean {
  const cur = target.value;
  if (cur === null || cur.kind !== t.kind) return false;
  if (cur.kind === "prefix" || t.kind === "prefix") return true;
  return cur.id === t.id && cur.via === t.via && cur.replacing === t.replacing;
}

/** 取り込みの部品の案内（対象によって変える）。 */
function captureHint(t: AssignTarget): string {
  if (t.kind === "prefix")
    return "prefix にするキーを押してください（ctrl+英字など。Esc で取り消し）";
  if (actionDef(t.id)?.indexed === true)
    return "1〜9 の数字のキーを押してください（修飾キーと一緒でも。Esc で取り消し）";
  if (t.via === "direct") return "ctrl や alt を組み合わせたキーを押してください（Esc で取り消し）";
  return "prefix の後に押すキーを押してください（Esc で取り消し）";
}

function startCapture(t: AssignTarget, ev: Event): void {
  trigger = ev.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
  target.value = t;
  message.value = "";
  pendingMove.value = null; // 前回の衝突の「こちらへ移す」は次の取り込みで消える（AC6）
  capturing.value = true;
  void nextTick(() => root.value?.querySelector<HTMLElement>(".keys-capture")?.focus());
}

/**
 * 取り込み待ちを終える。`focus` は終わったあとのフォーカス：省略は押したボタン・関数はその戻り値・`"none"` は動かさない
 * （フォーカスを失って終わるとき。利用者が選んだ別の部品を奪い返さない）。
 */
function endCapture(
  focus?: "none" | (() => HTMLElement | null),
  opts?: { holdCancel?: boolean },
): void {
  if (target.value === null) return;
  const back = trigger;
  target.value = null;
  trigger = null;
  if (opts?.holdCancel === true) {
    // Esc で取り消したとき：親（設定画面）へ「取り込み待ちが終わった」と知らせるのを、次のタスクまで遅らせる。Chromium は Esc の keydown の `preventDefault()` で
    // ネイティブの `cancel` が起きないが、Firefox・Safari は未確認——keydown のあとに `cancel` が来ても、まだ取り込み待ちと見えて設定画面を閉じない
    // （`cancel` は keydown の既定動作として同じタスクの中で来る。マイクロタスクでは早すぎる）。
    setTimeout(() => {
      if (target.value === null) capturing.value = false;
    }, 0);
  } else {
    capturing.value = false;
  }
  if (focus === "none") return;
  void nextTick(() => {
    const el = typeof focus === "function" ? focus() : back?.isConnected ? back : null;
    el?.focus();
  });
}

/** 確定した割り当てを store へ渡し、終わったあとにフォーカスを戻す先を返す。 */
function apply(t: AssignTarget, binding: string): (() => HTMLElement | null) | undefined {
  if (t.kind === "prefix") {
    settings.setKeyPrefix(binding);
    message.value = `prefix を ${binding} にしました。`;
    return undefined; // ［変更］は残るので、押したボタンへ戻る
  }
  const current = bindingsOf(t.id);
  const list =
    t.replacing !== undefined && current.includes(t.replacing)
      ? current.map((b) => (b === t.replacing ? binding : b))
      : [...current, binding];
  settings.setKeyBindings(t.id, list);
  message.value = `「${actionDef(t.id)?.label ?? t.id}」に ${binding} を割り当てました。`;
  // 置き換えたときは chip が作り直されるので、新しい割り当ての［変更］へ。追加のときは押した［追加］が残るのでそこへ。
  if (t.replacing === undefined) return undefined;
  return () => findChangeButton(t.id, binding);
}

function findChangeButton(id: ActionId, binding: string): HTMLElement | null {
  const all = root.value?.querySelectorAll<HTMLElement>("[data-change]") ?? [];
  for (const el of all) if (el.dataset["change"] === `${id}|${binding}`) return el;
  return null;
}

/**
 * 取り込みの部品（3 つの入口：prefix の［変更］・割り当ての［変更］・［追加］）が共有する属性とハンドラ。**入口ごとに書き写さない**——片方だけ外れても気づけず、
 * `blur` で取り込みが終わらないと `capturing` が残って、親（設定画面）が Esc を無視し続ける。
 */
const captureAttrs = {
  type: "button",
  class: "keys-capture",
  onKeydown: onCaptureKeydown,
  onBlur: () => endCapture("none"),
} as const;

function onCaptureKeydown(ev: KeyboardEvent): void {
  const t = target.value;
  if (t === null) return;
  // 取り込み待ちの間のキーは、端末・prefix 状態・ブラウザの標準の動作へ漏らさない（AC-I5）。Esc でダイアログも閉じない。
  ev.preventDefault();
  ev.stopPropagation();
  if (
    ev.key === "Escape" &&
    !ev.ctrlKey &&
    !ev.altKey &&
    !ev.metaKey &&
    !ev.shiftKey &&
    !ev.isComposing
  ) {
    message.value = "";
    endCapture(undefined, { holdCancel: true });
    return;
  }
  const result = validateAssignment(
    settings.keymap,
    t,
    keyInputOf(ev as unknown as KeyboardEventLike),
  );
  if (!result.ok) {
    if (result.reason !== "") message.value = result.reason;
    if (result.ignore === true) return; // 修飾キー単体・IME・繰り返し：待ち続ける
    // 衝突相手が単一の割り当てとして特定できるときだけ「こちらへ移す」を出せる（AC4・AC7）。
    pendingMove.value =
      result.conflict && t.kind === "binding" ? { target: t, conflict: result.conflict } : null;
    endCapture(); // 通らなかった：理由を出して、元のまま終わる（AC-I2）
    return;
  }
  pendingMove.value = null;
  endCapture(apply(t, result.binding));
}

/** 衝突相手からその chord を外し、いま入力中の対象へ割り当てる（AC5。確認ダイアログを挟まない）。 */
function moveHere(): void {
  const pending = pendingMove.value;
  if (pending === null) return;
  const { target: moveTarget, conflict } = pending;
  const binding = formatBinding({ via: conflict.via, chord: conflict.chord, range: false });
  settings.setKeyBindings(
    conflict.ownerId,
    bindingsOf(conflict.ownerId).filter((b) => b !== binding),
  );
  apply(moveTarget, binding); // 衝突が消えたので今度は通る
  message.value = `${binding} を「${actionDef(conflict.ownerId)?.label ?? conflict.ownerId}」から「${actionDef(moveTarget.id)?.label ?? moveTarget.id}」へ移しました。`;
  pendingMove.value = null;
  void nextTick(() => findChangeButton(moveTarget.id, binding)?.focus()); // AC-I9
}

/** 割り当てを 1 つ外す。フォーカスは同じ行の次の部品（無ければ［追加：prefix の後］）へ。 */
function removeBinding(id: ActionId, binding: string, ev: Event): void {
  const current = bindingsOf(id);
  const index = current.indexOf(binding);
  const row = (ev.currentTarget as HTMLElement | null)?.closest("details") ?? null;
  settings.setKeyBindings(
    id,
    current.filter((b) => b !== binding),
  );
  message.value = `「${actionDef(id)?.label ?? id}」から ${binding} を外しました。`;
  void nextTick(() => {
    // 消えた位置に繰り上がった割り当ての［変更］（＝同じ行の次の部品）。最後を消したときは無いので［追加：prefix の後］へ。
    const changes = row?.querySelectorAll<HTMLElement>("[data-change]") ?? [];
    (changes[index] ?? row?.querySelector<HTMLElement>("[data-add='prefix']"))?.focus();
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// 既定へ戻す（AC9）・おすすめの直接のキー（AC10）
// ---------------------------------------------------------------------------------------------------------------------

const isOverridden = (id: ActionId): boolean => settings.keyPrefs.bindings[id] !== undefined;

/** 足せなかった・戻せなかった理由を 1 つの節にする。理由が**そのキーで始まる**ときはそのまま（キーが二重に出ない）、そうでなければキーを添える。 */
function describeSkip(key: string, reason: string): string {
  const text = reason.replace(/。$/, "");
  return text.startsWith(key) ? text : `${key}（${text}）`;
}

/** 操作の割り当てを既定へ戻す。フォーカスは同じ行の［追加：prefix の後］へ（［既定に戻す］は上書きが無くなると消えるため）。 */
function resetAction(id: ActionId, ev: Event): void {
  const row = (ev.currentTarget as HTMLElement | null)?.closest("details") ?? null;
  const plan = planReset(settings.keymap, settings.keyPrefs, { kind: "action", id });
  if (!plan.ok) {
    message.value = plan.reason;
    return;
  }
  settings.replaceKeyPrefs(plan.prefs);
  const label = actionDef(id)?.label ?? id;
  // 既定のキーを別の操作が使っていて戻せなかった分があれば、「戻しました」とは言わず、上書きを外したことと戻せなかった分を言う。
  message.value =
    plan.skipped.length === 0
      ? `「${label}」を既定へ戻しました。`
      : `「${label}」の上書きを外しました。戻せなかった既定のキー：${plan.skipped.map((k) => describeSkip(k.binding, k.reason)).join("、")}。`;
  void nextTick(() => row?.querySelector<HTMLElement>("[data-add='prefix']")?.focus());
}

/** prefix を既定へ戻す。既定の prefix が別の割り当てに使われていれば戻さず、理由を出す。フォーカスは［変更］へ。 */
function resetPrefix(): void {
  const plan = planReset(settings.keymap, settings.keyPrefs, { kind: "prefix" });
  if (!plan.ok) {
    message.value = plan.reason;
    return;
  }
  settings.replaceKeyPrefs(plan.prefs);
  message.value = `prefix を既定（${settings.keymap.prefix}）へ戻しました。`;
  void nextTick(() => root.value?.querySelector<HTMLElement>("[data-prefix-change]")?.focus());
}

/** 全画面のとき Keyboard Lock を使うかの入切（20260922-keybinding-usability。design「US4」・AC11）。 */
function toggleKeyboardLock(): void {
  settings.setKeyboardLockInFullscreen(!settings.keyboardLockInFullscreen);
}

/** herdr が文書で勧める `ctrl+alt` の直接のキーの一式を足す（冪等）。足せなかった分は理由つきで知らせる。 */
function addRecommended(): void {
  const r = applyRecommended(settings.keymap, settings.keyPrefs);
  settings.replaceKeyPrefs(r.prefs);
  const parts: string[] = [];
  if (r.added.length > 0)
    parts.push(`直接のキーを ${r.added.length} 個足しました：${r.added.join("、")}。`);
  if (r.added.length === 0 && r.skipped.length === 0)
    parts.push("おすすめの直接のキーは、すでに全部入っています。");
  else if (r.already.length > 0) parts.push(`すでにあった分：${r.already.join("、")}。`);
  if (r.skipped.length > 0)
    parts.push(
      `足さなかった分：${r.skipped.map((k) => describeSkip(k.chord, k.reason)).join("、")}。`,
    );
  message.value = parts.join("");
}

/** すべてを既定へ戻す（取り消せないので、インラインの確認を挟む。フォーカスは安全側の［やめる］）。 */
const confirmingReset = ref(false);

function askResetAll(): void {
  confirmingReset.value = true;
  void nextTick(() => root.value?.querySelector<HTMLElement>("[data-confirm-no]")?.focus());
}

function endResetConfirm(): void {
  confirmingReset.value = false;
  void nextTick(() => root.value?.querySelector<HTMLElement>("[data-reset-all]")?.focus());
}

function confirmResetAll(): void {
  settings.resetAllKeys();
  message.value = "すべての割り当てと prefix を既定へ戻しました。";
  endResetConfirm();
}

// ダイアログを閉じる（設定画面が閉じる・別のダイアログへ移る）と、取り込み待ちは元のまま終わる（AC-I1）。
watch(
  () => view.openDialog,
  (open) => {
    if (open !== "settings") {
      endCapture("none");
      confirmingReset.value = false; // 開き直したとき、確認が出たままにならない
      message.value = ""; // 前回の結果の文を持ち越さない
      pendingMove.value = null; // 「こちらへ移す」も閉じたら消える（AC6）
    }
  },
);
</script>

<template>
  <section ref="root" class="settings-section" aria-labelledby="settings-keys">
    <h3 id="settings-keys" class="settings-heading">キー</h3>
    <p v-if="props.kind === 'mobile'" class="settings-note keys-mobile-note">
      画面のキーボードでは割り当てを取り込めません。物理キーボードをつないだときに使えます。
    </p>
    <p class="settings-note keys-lead">
      押したキーがそのまま割り当てられます。Esc で取り消し。ブラウザが先に受けるキー（Ctrl+T
      など）は画面に届かないので、割り当てられません。
    </p>

    <div class="keys-prefix">
      <span class="keys-prefix-label">prefix</span>
      <code class="keys-binding">{{ displayFor(settings.keymap.prefix) }}</code>
      <button
        type="button"
        class="keys-btn"
        data-prefix-change
        aria-label="prefix を変更"
        @click="startCapture(PREFIX_TARGET, $event)"
      >
        変更
      </button>
      <button
        v-if="settings.keyPrefs.prefix !== null"
        type="button"
        class="keys-btn"
        data-reset-prefix
        aria-label="prefix を既定に戻す"
        @click="resetPrefix"
      >
        既定に戻す
      </button>
      <button v-if="isCapturing(PREFIX_TARGET)" v-bind="captureAttrs">
        {{ captureHint(PREFIX_TARGET) }}
      </button>
    </div>

    <div class="keys-filter">
      <label class="keys-filter-label" for="keys-filter-input">絞り込み</label>
      <input
        id="keys-filter-input"
        v-model="filterText"
        type="text"
        class="keys-filter-input"
        placeholder="操作名・群名で絞り込む"
      />
    </div>

    <div
      v-for="g in actionsByGroup"
      :key="g.group"
      class="keys-group"
      role="group"
      :aria-label="g.group"
    >
      <h4 class="keys-group-name">{{ g.group }}</h4>
      <ul class="keys-list">
        <li v-for="def in g.actions" :key="def.id" class="keys-item">
          <details class="keys-details" :data-action="def.id">
            <summary class="keys-summary">
              <span class="keys-action-label">{{ def.label }}</span>
              <span
                class="keys-bindings"
                :class="{ 'keys-none': bindingsOf(def.id).length === 0 }"
                >{{ bindingsText(def.id) }}</span
              >
            </summary>
            <div class="keys-editor">
              <ul class="keys-chips">
                <li v-for="b in bindingsOf(def.id)" :key="b" class="keys-chip">
                  <code class="keys-binding">{{ displayFor(b) }}</code>
                  <button
                    type="button"
                    class="keys-btn"
                    :data-change="`${def.id}|${b}`"
                    :aria-label="`「${def.label}」の ${displayFor(b)} を変更`"
                    @click="startCapture(changeTarget(def.id, b), $event)"
                  >
                    変更
                  </button>
                  <button
                    type="button"
                    class="keys-btn"
                    :aria-label="`「${def.label}」の ${displayFor(b)} を削除`"
                    @click="removeBinding(def.id, b, $event)"
                  >
                    削除
                  </button>
                  <button v-if="isCapturing(changeTarget(def.id, b))" v-bind="captureAttrs">
                    {{ captureHint(changeTarget(def.id, b)) }}
                  </button>
                </li>
              </ul>
              <div class="keys-add">
                <button
                  type="button"
                  class="keys-btn"
                  data-add="prefix"
                  :aria-label="`追加：prefix の後（「${def.label}」）`"
                  @click="startCapture(addTarget(def.id, 'prefix'), $event)"
                >
                  追加：prefix の後
                </button>
                <button
                  type="button"
                  class="keys-btn"
                  data-add="direct"
                  :aria-label="`追加：直接（「${def.label}」）`"
                  @click="startCapture(addTarget(def.id, 'direct'), $event)"
                >
                  追加：直接
                </button>
              </div>
              <button
                v-if="isOverridden(def.id)"
                type="button"
                class="keys-btn keys-reset"
                data-reset-action
                :aria-label="`「${def.label}」を既定に戻す`"
                @click="resetAction(def.id, $event)"
              >
                既定に戻す
              </button>
              <template v-for="via in ['prefix', 'direct'] as const" :key="via">
                <button v-if="isCapturing(addTarget(def.id, via))" v-bind="captureAttrs">
                  {{ captureHint(addTarget(def.id, via)) }}
                </button>
              </template>
            </div>
          </details>
        </li>
      </ul>
    </div>

    <div class="keys-bulk">
      <button
        type="button"
        class="keys-btn"
        data-recommended
        aria-describedby="keys-recommended-note"
        @click="addRecommended"
      >
        herdr のおすすめの直接のキー（ctrl+alt）を足す
      </button>
      <button
        v-if="!confirmingReset"
        type="button"
        class="keys-btn"
        data-reset-all
        @click="askResetAll"
      >
        すべて既定に戻す
      </button>
      <div
        v-else
        class="keys-confirm"
        role="group"
        aria-label="すべて既定に戻す確認"
        @keydown.esc.stop.prevent="endResetConfirm"
      >
        <span>すべての割り当てと prefix を既定へ戻します。取り消せません。</span>
        <button type="button" class="keys-btn" data-confirm-yes @click="confirmResetAll">
          戻す
        </button>
        <button type="button" class="keys-btn" data-confirm-no @click="endResetConfirm">
          やめる
        </button>
      </div>
    </div>

    <p id="keys-recommended-note" class="settings-note keys-recommended-note">
      おすすめの一式には、環境によって届かないキーがあります（Linux のデスクトップの一部では
      Ctrl+Alt+L を OS が先に使います。AltGr で [ ] を打つキー配列では Ctrl+Alt+[ ]
      は使えません）。届かないキーは［変更］で付け替えてください。
    </p>

    <button
      type="button"
      role="switch"
      class="settings-switch"
      :aria-checked="settings.keyboardLockInFullscreen"
      @click="toggleKeyboardLock"
    >
      <span class="settings-mark">{{ settings.keyboardLockInFullscreen ? "入" : "切" }}</span>
      <span>全画面のとき、ブラウザ予約キーも使う（実験的。対応ブラウザのみ）</span>
    </button>

    <div class="keys-status-band">
      <p class="keys-message" role="status" aria-live="polite">{{ message }}</p>
      <button
        v-if="pendingMove !== null"
        type="button"
        class="keys-btn keys-move-here"
        data-move-here
        @click="moveHere"
      >
        こちらへ移す
      </button>
    </div>
  </section>
</template>

<style scoped>
/* Vue の scoped は、親（`SettingsDialog`）の属性が子のルート要素にしか付かない——見出しと案内文に親の `.settings-heading`・`.settings-note` は当たらないので、
   ほかの 4 節と同じ見た目をここに持たせる。 */
.settings-heading {
  margin: 0 0 0.5em;
  font-size: 0.95em;
  font-weight: bold;
  opacity: 0.85;
}
.settings-note {
  margin: 0.3em 0 0;
  font-size: 0.85em;
  opacity: 0.8;
}
.keys-lead {
  margin-bottom: 0.6em;
}
.keys-prefix {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em 0.6em;
  margin-bottom: 0.8em;
}
.keys-prefix-label {
  font-weight: bold;
}
.keys-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em 0.6em;
  margin-bottom: 0.4em;
}
.keys-filter-label {
  font-size: 0.9em;
}
.keys-filter-input {
  font: inherit;
  color: inherit;
  background: var(--wtm-menu-bg, #282a36);
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 4px;
  padding: 0.15em 0.5em;
  min-height: 1.75rem;
  flex: 1 1 12em;
}
.keys-group {
  margin-top: 0.8em;
}
.keys-group-name {
  margin: 0 0 0.3em;
  font-size: 0.9em;
  opacity: 0.85;
}
.keys-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2em;
}
.keys-details {
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 4px;
}
.keys-summary {
  display: flex;
  justify-content: space-between;
  gap: 0.8em;
  padding: 0.3em 0.6em;
  cursor: pointer;
  min-height: 1.75rem;
  align-items: center;
}
.keys-bindings {
  font-family: monospace;
  font-size: 0.9em;
  text-align: right;
  overflow-wrap: anywhere;
}
.keys-none {
  opacity: 0.7;
  font-family: inherit;
}
.keys-editor {
  padding: 0.4em 0.6em 0.6em;
  border-top: 1px solid var(--wtm-menu-border, #44475a);
}
.keys-chips {
  list-style: none;
  margin: 0 0 0.4em;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}
.keys-chip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3em 0.5em;
}
.keys-binding {
  font-family: monospace;
  background: var(--wtm-subtle-bg, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 3px;
  padding: 0 0.4em;
}
.keys-add {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
}
.keys-btn {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 4px;
  padding: 0.15em 0.7em;
  min-height: 1.75rem;
  cursor: pointer;
}
/* 取り込み待ち：ほかのボタンと見分けがつくよう、枠を太くして背景を付ける（色だけに頼らない）。 */
.keys-capture {
  font: inherit;
  color: inherit;
  background: var(--wtm-menu-active-bg, #44475a);
  border: 2px dashed var(--wtm-accent, #6070a1);
  border-radius: 4px;
  padding: 0.3em 0.7em;
  min-height: 1.75rem;
  margin-top: 0.4em;
  cursor: default;
  text-align: left;
}
.keys-bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  margin-top: 0.8em;
}
.keys-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em 0.6em;
}
/* `SettingsDialog.vue` の `.settings-switch`/`.settings-mark` と同じ見た目（scoped は親から効かないため
   ここで再現する。冒頭の注記と同じ理由。20260922-keybinding-usability・design「US4」）。 */
.settings-switch {
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
  margin-top: 0.6em;
  cursor: pointer;
  text-align: left;
}
.settings-mark {
  flex: none;
  min-width: 2em;
  text-align: center;
  border: 1px solid var(--wtm-menu-border, #44475a);
  border-radius: 3px;
  padding: 0 0.2em;
}
.settings-switch[aria-checked="true"] .settings-mark {
  background: var(--wtm-menu-active-bg, #44475a);
}
/*
 * 長い一覧のどこを操作しても結果が見えるよう、画面（ダイアログ）の下に固定する。
 * **固定する帯はこの `.keys-status-band` 自身**（20260922-keybinding-usability。review 指摘で追加）——
 * `.keys-message` 単体を sticky にすると、その直後に置く「こちらへ移す」ボタンは sticky ではない
 * 普通の要素として `.keys-message` の「本来の（固定されていない）位置」の直後に続くため、一覧を
 * 少し下へスクロールしただけで帯が下端に張り付いても、ボタン自身は画面の外（ダイアログの可視領域の
 * 下）に取り残される（実地に `boundingBox()` で確認した実測のバグ）。帯ごと（文言＋ボタン）を
 * 1 つの sticky 要素にすることで、両方が常に一緒に画面内へ来る。
 */
.keys-status-band {
  position: sticky;
  /* ダイアログの padding（1em）の内側で止まると、その下の帯を中身が透けて流れる——題名の行と同じく、padding を固定する側へ持たせて下端まで伸ばす。 */
  bottom: -1em;
  margin: 0.6em 0 0;
  padding: 0.3em 0 1em;
  background: var(--wtm-menu-bg, #282a36);
}
.keys-message {
  margin: 0;
  min-height: 1.4em;
  font-size: 0.9em;
}
.keys-move-here {
  margin-top: 0.4em;
}
</style>
