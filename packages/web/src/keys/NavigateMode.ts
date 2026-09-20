import type { Action, KeyInput } from "./actions.js";
import type { SubModeInterpreter } from "./KeyRouter.js";

/**
 * navigate モード（`prefix+w`）の解釈（architecture.md「keys/NavigateMode.ts」）。副作用を持たない。
 * `↑/↓` は workspace の選択、`h/j/k/l`・`←/→` は pane のフォーカス（どちらも実際の一覧・移動先を
 * 知らないので、選択の計算とレイアウト上の移動は `Action` を受け取った側＝store/ActionDispatcher が行う）。
 * `1-9` の直接切替・prefix 割り当ての prefix 無しでの実行は実装しない（D62。意図的な簡略化）。
 */
export class NavigateMode implements SubModeInterpreter {
  handle(k: KeyInput): { action?: Action; exit?: boolean } {
    switch (k.key) {
      case "ArrowUp":
        return { action: { type: "navigate", op: "up" } };
      case "ArrowDown":
        return { action: { type: "navigate", op: "down" } };
      case "h":
      case "ArrowLeft":
        return { action: { type: "navigate", op: "paneDir", dir: "left" } };
      case "j":
        return { action: { type: "navigate", op: "paneDir", dir: "down" } };
      case "k":
        return { action: { type: "navigate", op: "paneDir", dir: "up" } };
      case "l":
      case "ArrowRight":
        return { action: { type: "navigate", op: "paneDir", dir: "right" } };
      case "Enter":
        return { action: { type: "navigate", op: "activate" }, exit: true };
      case "Escape":
        return { action: { type: "navigate", op: "cancel" }, exit: true };
      default:
        return {};
    }
  }
}
