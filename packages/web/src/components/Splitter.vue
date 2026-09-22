<script setup lang="ts">
import { inject, ref, watch } from "vue";
import { ConnectionKey } from "../injection.js";
import { useSettingsStore } from "../store/settings.js";

/**
 * pane の境界（M2。architecture「マウス操作」・APG の Window Splitter）。Pointer Events でドラッグし、
 * 動いている間は `layout.set_split_ratio` を 50ms 間隔にまとめて送る。キーボードの矢印で 2% ずつ動かす。
 *
 * **隙間の視覚切り替え**（20260922-tabbar-pane-appearance。design「振る舞いの詳細 / pane の枠・外周・隙間」）：
 * `settings.paneGaps` を**このコンポーネント自身が直接読む**——`multiPane`/`bordered`（`PaneFrame` 側）とは
 * 違い、構造上の位置に関わらない単純なグローバル設定なので、`App.vue`/`PaneLayout.vue` を経由して prop で
 * 通す必要が無い（decisions D4）。`paneGaps` が偽のとき、背景色を地の色（隣接する pane と同じ）に変える
 * だけで、**`width`/`height`（4px）は変えない**（分割の当たり判定・ドラッグの掴める帯の大きさに影響しない
 * ようにするため）。
 */
const props = defineProps<{
  splitId: string;
  tabId: string;
  ratio: number;
  dir: "right" | "down";
}>();

const conn = inject(ConnectionKey);
if (!conn) throw new Error("Splitter: ConnectionKey が provide されていません");

const settings = useSettingsStore();

const STEP = 0.02;
const SEND_INTERVAL_MS = 50;

const localRatio = ref(props.ratio);
const el = ref<HTMLElement | null>(null);

let dragging = false;
let dragStartClient = 0;
let dragStartRatio = 0;
let containerSize = 0;

let sendTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRatio: number | null = null;

watch(
  () => props.ratio,
  (next) => {
    if (!dragging) localRatio.value = next;
  },
);

function clamp(r: number): number {
  return Math.min(0.95, Math.max(0.05, r));
}

function scheduleSend(ratio: number): void {
  pendingRatio = ratio;
  if (sendTimer) return;
  sendTimer = setTimeout(() => {
    sendTimer = null;
    if (pendingRatio === null) return;
    const ratioToSend = pendingRatio;
    pendingRatio = null;
    void conn!.request("layout.set_split_ratio", { tabId: props.tabId, splitId: props.splitId, ratio: ratioToSend }).catch(() => undefined);
  }, SEND_INTERVAL_MS);
}

function onPointerDown(ev: PointerEvent): void {
  const parent = el.value?.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  containerSize = props.dir === "right" ? rect.width : rect.height;
  dragStartClient = props.dir === "right" ? ev.clientX : ev.clientY;
  dragStartRatio = localRatio.value;
  dragging = true;
  (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
}

function onPointerMove(ev: PointerEvent): void {
  if (!dragging || containerSize <= 0) return;
  const client = props.dir === "right" ? ev.clientX : ev.clientY;
  const next = clamp(dragStartRatio + (client - dragStartClient) / containerSize);
  localRatio.value = next;
  scheduleSend(next);
}

function onPointerUp(): void {
  dragging = false;
}

function onKeydown(ev: KeyboardEvent): void {
  const growKey = props.dir === "right" ? "ArrowRight" : "ArrowDown";
  const shrinkKey = props.dir === "right" ? "ArrowLeft" : "ArrowUp";
  if (ev.key !== growKey && ev.key !== shrinkKey) return;
  ev.preventDefault();
  const next = clamp(localRatio.value + (ev.key === growKey ? STEP : -STEP));
  localRatio.value = next;
  scheduleSend(next);
}
</script>

<template>
  <div
    ref="el"
    role="separator"
    :aria-orientation="dir === 'right' ? 'vertical' : 'horizontal'"
    :aria-valuenow="Math.round(localRatio * 100)"
    aria-valuemin="5"
    aria-valuemax="95"
    tabindex="0"
    class="splitter"
    :class="[dir, { 'splitter-no-gap': !settings.paneGaps }]"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @keydown="onKeydown"
  />
</template>

<style scoped>
/* 05-e2e-docs T3 の E2E で発見：この component にも `<style>` が一度も存在しなかった（PaneLayout.vue と
 * 同様の欠落。D92）。`flex: none` で固定の太さにし、ドラッグ・キーボードで動かせることが見た目にも
 * 分かるよう境界線の色を付ける。 */
.splitter {
  flex: none;
  background: var(--wtm-menu-border, #44475a);
  touch-action: none;
}
.splitter:focus-visible {
  background: var(--wtm-menu-active-bg, #44475a);
  outline: 1px solid var(--wtm-fg, #f8f8f2);
}
.splitter.right {
  width: 4px;
  cursor: col-resize;
}
.splitter.down {
  height: 4px;
  cursor: row-resize;
}
/* 20260922-tabbar-pane-appearance（AC7）：隙間を切ると、地続きに見えるよう地の色に変える
 * （`width`/`height` は変えない——ドラッグで掴める帯の大きさ・分割の当たり判定を変えないため）。
 * `.splitter:focus-visible`（上）の詳細度（0,2,0）が `.splitter-no-gap`（0,1,0）より高いため、
 * キーボード操作で場所が分かる既存の色は、隙間の設定に関わらずそのまま勝つ（追加のルール不要）。 */
.splitter-no-gap {
  background: var(--wtm-bg, #1e1f29);
}
</style>
