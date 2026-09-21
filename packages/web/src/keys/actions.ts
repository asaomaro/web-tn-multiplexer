/**
 * `keys/` 全体で共有する型（architecture.md「keys/KeyRouter.ts」）。Vue にも DOM にも依存しない。
 */

export type Dir = "left" | "right" | "up" | "down";

export type Mode = "terminal" | "prefix" | "navigate" | "copy" | "resize" | "dialog";

export interface KeyInput {
  key: string;
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  type: "keydown" | "keyup" | "keypress";
  composing: boolean;
}

export type KeyDecision =
  | { kind: "pass" } // xterm.js に渡す（terminal モードの通常の入力）
  | { kind: "consume" } // 何もせず捨てる（割り当ての無いキー・keydown 以外のイベント等）
  | { kind: "send"; bytes: string } // 端末へ直接送る（Ctrl+B Ctrl+B → '\x02'）
  | { kind: "action"; action: Action };

/**
 * copy モードの移動の単位（D56 の訂正 5。herdr の `copy_mode.rs` の全キーを移植）。
 */
export type CopyCommand =
  | {
      op: "move";
      unit: "char" | "word" | "WORD" | "wordEnd" | "WORDEnd" | "paragraph" | "page" | "halfPage" | "line" | "lineStart" | "lineEnd" | "bufferTop" | "bufferBottom";
      dir: -1 | 1;
    }
  | { op: "searchStart"; dir: -1 | 1 }
  | { op: "searchInput"; text: string }
  | { op: "searchNext"; reverse: boolean }
  | { op: "selectStart"; linewise: boolean }
  | { op: "yank" }
  | { op: "clearOrExit" }
  | { op: "exit" };

export type Action =
  | { type: "split"; dir: "right" | "down" }
  | { type: "focusDir"; dir: Dir }
  | { type: "swap"; dir: Dir }
  | { type: "cyclePane"; delta: 1 | -1 }
  | { type: "closePane" }
  | { type: "zoom" }
  | { type: "renamePane" }
  | { type: "newTab" }
  | { type: "tabDelta"; delta: 1 | -1 }
  | { type: "tabIndex"; index: number }
  | { type: "renameTab" }
  | { type: "closeTab" }
  | { type: "newWorkspace" }
  | { type: "renameWorkspace" }
  | { type: "closeWorkspace" }
  | { type: "enterMode"; mode: "navigate" | "copy" | "resize" }
  | { type: "exitMode" }
  | { type: "help" }
  | { type: "goto" }
  | { type: "toggleSidebar" }
  | { type: "newWorktree" } // 20260920-git-worktree-actions（prefix+G）
  | { type: "detach" }
  | { type: "notYet"; work: string } // 後続のキー
  | { type: "navigate"; op: "up" | "down" | "paneDir" | "activate" | "cancel"; dir?: Dir }
  | { type: "resizeBy"; dir: Dir; amount: number }
  | { type: "copy"; cmd: CopyCommand };
