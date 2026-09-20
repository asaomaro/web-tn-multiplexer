import type { Action } from "./actions.js";

/**
 * herdr 互換の既定キー表（design.md「既定のキー」、D56 で herdr のソースと突き合わせて確定）。
 * prefix（`Ctrl+B`）の直後の 1 キーだけを扱う——MVP の範囲外のキーは `notYet` で「後続」案内にする。
 *
 * キーは `comboKey()`（`KeyRouter.ts`）の形式：`[ctrl+][alt+][meta+]<event.key>`。
 * 文字キーは `event.key` の大小（シフトの有無）でそのまま区別できる（`H` は shift+h）。
 * シフトで `.key` が変わらないキー（`Tab` 等）だけ `shift+` を明示的な接頭辞として足す。
 */
export type Keymap = ReadonlyMap<string, Action>;

const NOT_YET: [string, Action][] = [
  ["R", { type: "notYet", work: "外観と設定" }],
  ["e", { type: "notYet", work: "端末機能の拡張" }],
];

const TAB_INDEX_ENTRIES: [string, Action][] = Array.from({ length: 9 }, (_, i) => {
  const index = i + 1;
  return [String(index), { type: "tabIndex", index }] as [string, Action];
});

export const DEFAULT_KEYMAP: Keymap = new Map<string, Action>([
  // pane
  ["v", { type: "split", dir: "right" }],
  ["-", { type: "split", dir: "down" }],
  ["h", { type: "focusDir", dir: "left" }],
  ["j", { type: "focusDir", dir: "down" }],
  ["k", { type: "focusDir", dir: "up" }],
  ["l", { type: "focusDir", dir: "right" }],
  ["H", { type: "swap", dir: "left" }],
  ["J", { type: "swap", dir: "down" }],
  ["K", { type: "swap", dir: "up" }],
  ["L", { type: "swap", dir: "right" }],
  ["Tab", { type: "cyclePane", delta: 1 }],
  ["shift+Tab", { type: "cyclePane", delta: -1 }],
  ["x", { type: "closePane" }],
  ["z", { type: "zoom" }],
  ["r", { type: "enterMode", mode: "resize" }],
  ["P", { type: "renamePane" }],
  ["[", { type: "enterMode", mode: "copy" }],
  // tab
  ["c", { type: "newTab" }],
  ["n", { type: "tabDelta", delta: 1 }],
  ["p", { type: "tabDelta", delta: -1 }],
  ...TAB_INDEX_ENTRIES,
  ["T", { type: "renameTab" }],
  ["X", { type: "closeTab" }],
  // workspace
  ["N", { type: "newWorkspace" }],
  ["W", { type: "renameWorkspace" }],
  ["D", { type: "closeWorkspace" }],
  // worktree（20260920-git-worktree-actions）。herdr の `new_worktree` の既定も prefix+shift+g。
  ["G", { type: "newWorktree" }],
  // 通知（20260920-agent-notifications）。`s` は herdr の `settings` と同じ位置——
  // 後で「外観と設定」が来たら、このダイアログを育てればよい（別のキーを作らない）。
  ["s", { type: "notifySettings" }],
  ["o", { type: "nextNotification" }],
  ["w", { type: "enterMode", mode: "navigate" }],
  // 共通
  ["?", { type: "help" }],
  ["g", { type: "goto" }],
  ["b", { type: "toggleSidebar" }],
  ["q", { type: "detach" }],
  // 後続
  ...NOT_YET,
]);
