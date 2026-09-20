import { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";

/** `@xterm/addon-webgl` の `WebglAddon` のうち、この部品が使う分だけを切り出した interface（テストで差し替える）。 */
export interface WebglAddonLike {
  activate(terminal: Terminal): void;
  dispose(): void;
  onContextLoss(listener: () => void): { dispose(): void };
}

export interface RendererPoolOptions {
  /** 表示中の WebGL の上限（デスクトップ 12・モバイル 2。architecture「term/RendererPool」）。 */
  capacity: number;
  createWebglAddon?: () => WebglAddonLike;
}

/**
 * WebGL の割り当て（architecture.md「term/RendererPool」）。上限に達したら DOM レンダラーのままにする。
 * `onContextLoss` が来たら WebGL を破棄して DOM に戻す（design「流量制御」の描画の節）。
 */
export class RendererPool {
  private readonly capacity: number;
  private readonly createWebglAddon: () => WebglAddonLike;
  private readonly active = new Map<string, WebglAddonLike>();

  constructor(opts: RendererPoolOptions) {
    this.capacity = opts.capacity;
    this.createWebglAddon = opts.createWebglAddon ?? defaultCreateWebglAddon;
  }

  /** 空きがあれば `term` に WebGL を load して true を返す。上限に達していれば何もせず false（DOM のまま）。 */
  tryAcquire(paneId: string, term: Terminal): boolean {
    if (this.active.has(paneId)) return true;
    if (this.active.size >= this.capacity) return false;
    const addon = this.createWebglAddon();
    const onLoss = addon.onContextLoss(() => this.release(paneId));
    try {
      term.loadAddon(addon as unknown as Parameters<Terminal["loadAddon"]>[0]);
    } catch {
      onLoss.dispose();
      return false; // 生成・有効化に失敗（GPU 制限等）。DOM のまま
    }
    this.active.set(paneId, addon);
    return true;
  }

  /** WebGL を手放す（pane の破棄・表示から外れたとき・onContextLoss）。上限の枠が 1 つ空く。 */
  release(paneId: string): void {
    const addon = this.active.get(paneId);
    if (!addon) return;
    this.active.delete(paneId);
    addon.dispose();
  }

  isUsingWebgl(paneId: string): boolean {
    return this.active.has(paneId);
  }

  get size(): number {
    return this.active.size;
  }
}

function defaultCreateWebglAddon(): WebglAddonLike {
  // 実物の WebglAddon（テストでは差し替える。happy-dom には WebGL2 のコンテキストが無いため）。
  return new WebglAddon() as unknown as WebglAddonLike;
}
