<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { DEFAULT_KEYMAP } from "../keys/keymap.js";
import { useViewStore } from "../store/view.js";

/**
 * キー一覧（T24。design「ダイアログ」「ヘルプ」。herdr `src/input/keybind_help.rs`
 * `keybind_help_groups()`/`filter_keybind_help_groups()` を移植——群（全体・移動・workspace / tab・pane）
 * ごとの一覧、`custom` 群は本製品にカスタムキーバインドが無いので常に出さない（D56 の訂正 8）。
 * 絞り込みは herdr と同じくキー表記・説明の部分一致（大小無視）で、一致 0 件の群は丸ごと消える。
 *
 * Esc/Enter/スクロールの分岐は herdr の `route_overlay_key`（`overlay_input.rs:773-873`）を実測して
 * 確定した（D76）：**絞り込み中**は Esc で絞り込みの文字を消して検索欄から離れる（閉じない）・Enter は
 * 絞り込み中でも閉じる・↑↓/PageUp/PageDown はスクロールするが `j`/`k` は文字として入力欄へ入るだけ
 * （スクロールしない。ブラウザの `<input>` の既定動作にまかせる）。**絞り込んでいないとき**は
 * Esc・Enter・`?` で閉じ、`j/k`・PageUp/PageDown・Home/End でスクロールする。
 */
interface HelpEntry {
  keys: string;
  label: string;
  grayed?: boolean;
}
interface HelpGroup {
  name: string;
  entries: HelpEntry[];
}

/** `keymap.ts` の `notYet` の案内文をそのまま使う（design「後続のキーは灰色」）。 */
function notYet(rawKey: string, displayKeys: string): HelpEntry {
  const action = DEFAULT_KEYMAP.get(rawKey);
  const work = action?.type === "notYet" ? action.work : "";
  return { keys: displayKeys, label: `未対応（後続: ${work}）`, grayed: true };
}

// herdr の keybind_help_groups() の群分けに合わせる（D76。本製品の縮小版キー表に合わせて中身は書き直す）。
// H/J/K/L（swap）は herdr のヘルプにも出てこないので、ここでも出さない（D76）。
const HELP_GROUPS: HelpGroup[] = [
  {
    name: "全体",
    entries: [
      { keys: "?", label: "キー一覧" },
      { keys: "q", label: "このブラウザを切り離す" },
      notYet("s", "s"),
      notYet("R", "shift+r"),
      notYet("o", "o"),
    ],
  },
  {
    name: "移動",
    entries: [
      { keys: "esc", label: "戻る" },
      { keys: "↑ / ↓", label: "workspace の一覧を選ぶ" },
      { keys: "h / j / k / l ・← / →", label: "pane を選ぶ" },
      { keys: "tab / shift+tab", label: "pane を巡回する" },
      { keys: "enter", label: "選んだ workspace を開く" },
    ],
  },
  {
    name: "workspace / tab",
    entries: [
      { keys: "w", label: "workspace の一覧へ（navigate モード）" },
      { keys: "g", label: "goto（workspace・tab・pane から探す）" },
      { keys: "shift+n", label: "新規 workspace" },
      { keys: "shift+w", label: "workspace の名前を変更" },
      { keys: "shift+d", label: "workspace を閉じる" },
      { keys: "shift+g", label: "新しい worktree" },
      { keys: "c", label: "新規 tab" },
      { keys: "n / p", label: "次 / 前の tab" },
      { keys: "1..9", label: "tab を切り替え" },
      { keys: "shift+t", label: "tab の名前を変更" },
      { keys: "shift+x", label: "tab を閉じる" },
    ],
  },
  {
    name: "pane",
    entries: [
      { keys: "v", label: "右へ分割" },
      { keys: "-", label: "下へ分割" },
      { keys: "h / j / k / l", label: "隣の pane へフォーカス" },
      { keys: "x", label: "pane を閉じる" },
      { keys: "shift+p", label: "pane の名前を変更" },
      { keys: "z", label: "拡大表示" },
      { keys: "r", label: "resize モード" },
      { keys: "[", label: "copy モード" },
      { keys: "b", label: "サイドバーの折りたたみ" },
      notYet("e", "e"),
    ],
  },
];

const SCROLL_LINE = 32;
const SCROLL_PAGE = 240;

const view = useViewStore();

const dialogEl = ref<HTMLDialogElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
const queryInputEl = ref<HTMLInputElement | null>(null);
const query = ref("");

const filteredGroups = computed<HelpGroup[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return HELP_GROUPS;
  return HELP_GROUPS.map((g) => ({ name: g.name, entries: g.entries.filter((e) => e.keys.toLowerCase().includes(q) || e.label.toLowerCase().includes(q)) })).filter(
    (g) => g.entries.length > 0,
  );
});

watch(
  () => view.dialogContext,
  (ctx) => {
    if (ctx?.kind === "help") {
      query.value = "";
      void nextTick(() => {
        dialogEl.value?.showModal();
        listEl.value?.focus();
      });
    } else {
      dialogEl.value?.close();
    }
  },
);

const close = (): void => {
  view.closeDialog();
};

function onNativeCancel(ev: Event): void {
  ev.preventDefault();
  close();
}

function scrollBy(delta: number): void {
  listEl.value?.scrollBy({ top: delta });
}
function scrollTo(top: number): void {
  if (!listEl.value) return;
  listEl.value.scrollTop = top;
}

const onDialogKeydown = (ev: KeyboardEvent): void => {
  const filtering = document.activeElement === queryInputEl.value;
  const key = ev.key;

  if (filtering) {
    if (key === "Escape") {
      ev.preventDefault();
      query.value = ""; // 絞り込みを消して検索欄から離れる。閉じない（D56 の訂正 8）。
      queryInputEl.value?.blur();
      return;
    }
    if (key === "Enter") {
      ev.preventDefault();
      close(); // 絞り込み中でも Enter は閉じる。
      return;
    }
    if (key === "ArrowUp") {
      ev.preventDefault();
      scrollBy(-SCROLL_LINE);
    } else if (key === "ArrowDown") {
      ev.preventDefault();
      scrollBy(SCROLL_LINE);
    } else if (key === "PageUp") {
      ev.preventDefault();
      scrollBy(-SCROLL_PAGE);
    } else if (key === "PageDown") {
      ev.preventDefault();
      scrollBy(SCROLL_PAGE);
    }
    // j/k・Home/End は絞り込み中は効かない（`<input>` への通常の文字入力・カーソル移動に任せる）。
    return;
  }

  if (key === "Escape" || key === "Enter" || key === "?") {
    ev.preventDefault();
    close();
    return;
  }
  if (key === "Home") {
    ev.preventDefault();
    scrollTo(0);
    return;
  }
  if (key === "End") {
    ev.preventDefault();
    scrollTo(Number.MAX_SAFE_INTEGER);
    return;
  }
  if (key === "/") {
    ev.preventDefault();
    queryInputEl.value?.focus();
    return;
  }
  if (key === "j" || key === "ArrowDown") {
    ev.preventDefault();
    scrollBy(SCROLL_LINE);
    return;
  }
  if (key === "k" || key === "ArrowUp") {
    ev.preventDefault();
    scrollBy(-SCROLL_LINE);
    return;
  }
  if (key === "PageDown") {
    ev.preventDefault();
    scrollBy(SCROLL_PAGE);
    return;
  }
  if (key === "PageUp") {
    ev.preventDefault();
    scrollBy(-SCROLL_PAGE);
  }
};
</script>

<template>
  <dialog ref="dialogEl" class="help-dialog" aria-label="キー一覧" @cancel="onNativeCancel" @click.self="close" @keydown="onDialogKeydown">
    <div class="help-dialog-search">
      <input ref="queryInputEl" v-model="query" type="text" placeholder="/ で絞り込み" aria-label="キー一覧を絞り込み" />
    </div>
    <div ref="listEl" class="help-dialog-list" tabindex="-1">
      <section v-for="group in filteredGroups" :key="group.name" class="help-dialog-group">
        <h3 class="help-dialog-group-name">{{ group.name }}</h3>
        <dl>
          <template v-for="entry in group.entries" :key="entry.keys + entry.label">
            <dt :class="{ 'help-dialog-grayed': entry.grayed }">{{ entry.keys }}</dt>
            <dd :class="{ 'help-dialog-grayed': entry.grayed }">{{ entry.label }}</dd>
          </template>
        </dl>
      </section>
      <p v-if="filteredGroups.length === 0" class="help-dialog-empty">一致するキーがありません</p>
    </div>
    <div class="help-dialog-actions">
      <button type="button" @click="close">閉じる</button>
    </div>
  </dialog>
</template>

<style scoped>
/* `display` は `[open]` に限定する——`<dialog>` は閉じている間 UA の既定スタイルで `display: none` に
   なるが、`.help-dialog { display: flex }` のように無条件に指定すると author 側の宣言が UA の既定
   （オリジンが低い）を上書きしてしまい、閉じていても描画されクリックを奪ってしまう
   （実機の Chromium を使う smoke（T26）で発見。単体テストは happy-dom で `<dialog>` の描画規則を
   再現しないため見つからなかった）。 */
.help-dialog {
  border: 1px solid var(--wtm-menu-border, #44475a);
  background: var(--wtm-menu-bg, #282a36);
  color: var(--wtm-menu-fg, #f8f8f2);
  border-radius: 4px;
  width: min(40em, 90vw);
  max-height: 80vh;
  padding: 1em;
}
.help-dialog[open] {
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}
.help-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.help-dialog-search input {
  width: 100%;
  font: inherit;
  padding: 0.3em 0.5em;
  box-sizing: border-box;
}
.help-dialog-list {
  overflow-y: auto;
  min-height: 0;
}
.help-dialog-group-name {
  margin: 0.5em 0 0.25em;
  font-size: 0.9em;
  opacity: 0.8;
}
.help-dialog-list dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.15em 1em;
  margin: 0;
}
.help-dialog-list dt {
  font-family: monospace;
  white-space: nowrap;
}
.help-dialog-list dd {
  margin: 0;
}
.help-dialog-grayed {
  opacity: 0.5;
}
.help-dialog-empty {
  opacity: 0.7;
}
.help-dialog-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
