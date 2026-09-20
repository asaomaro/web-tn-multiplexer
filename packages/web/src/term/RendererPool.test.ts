import { Terminal } from "@xterm/xterm";
import { describe, expect, it } from "vitest";
import { RendererPool, type WebglAddonLike } from "./RendererPool.js";

class FakeWebglAddon implements WebglAddonLike {
  disposed = false;
  private lossListeners = new Set<() => void>();
  activate(): void {
    /* テストでは何もしない */
  }
  dispose(): void {
    this.disposed = true;
  }
  onContextLoss(listener: () => void): { dispose(): void } {
    this.lossListeners.add(listener);
    return { dispose: () => this.lossListeners.delete(listener) };
  }
  simulateContextLoss(): void {
    for (const fn of [...this.lossListeners]) fn();
  }
}

function makeTerm(): Terminal {
  const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  term.open(document.createElement("div"));
  return term;
}

describe("RendererPool", () => {
  it("容量まで WebGL を割り当てる", () => {
    const addons: FakeWebglAddon[] = [];
    const pool = new RendererPool({
      capacity: 2,
      createWebglAddon: () => {
        const a = new FakeWebglAddon();
        addons.push(a);
        return a;
      },
    });
    const t1 = makeTerm();
    const t2 = makeTerm();
    const t3 = makeTerm();

    expect(pool.tryAcquire("p1", t1)).toBe(true);
    expect(pool.tryAcquire("p2", t2)).toBe(true);
    expect(pool.tryAcquire("p3", t3)).toBe(false); // 容量超過。DOM のまま
    expect(pool.size).toBe(2);
    expect(pool.isUsingWebgl("p1")).toBe(true);
    expect(pool.isUsingWebgl("p3")).toBe(false);

    t1.dispose();
    t2.dispose();
    t3.dispose();
  });

  it("release で枠が空き、次の割り当てができる", () => {
    const pool = new RendererPool({ capacity: 1, createWebglAddon: () => new FakeWebglAddon() });
    const t1 = makeTerm();
    const t2 = makeTerm();
    expect(pool.tryAcquire("p1", t1)).toBe(true);
    expect(pool.tryAcquire("p2", t2)).toBe(false);

    pool.release("p1");
    expect(pool.isUsingWebgl("p1")).toBe(false);
    expect(pool.tryAcquire("p2", t2)).toBe(true);

    t1.dispose();
    t2.dispose();
  });

  it("同じ pane への tryAcquire は冪等（既に持っていれば再取得しない）", () => {
    let created = 0;
    const pool = new RendererPool({
      capacity: 1,
      createWebglAddon: () => {
        created++;
        return new FakeWebglAddon();
      },
    });
    const t1 = makeTerm();
    expect(pool.tryAcquire("p1", t1)).toBe(true);
    expect(pool.tryAcquire("p1", t1)).toBe(true);
    expect(created).toBe(1);
    t1.dispose();
  });

  it("onContextLoss が来たら release して DOM に戻す（枠が空く）", () => {
    let addon: FakeWebglAddon | undefined;
    const pool = new RendererPool({
      capacity: 1,
      createWebglAddon: () => {
        addon = new FakeWebglAddon();
        return addon;
      },
    });
    const t1 = makeTerm();
    const t2 = makeTerm();
    pool.tryAcquire("p1", t1);
    expect(pool.tryAcquire("p2", t2)).toBe(false);

    addon!.simulateContextLoss();
    expect(addon!.disposed).toBe(true);
    expect(pool.isUsingWebgl("p1")).toBe(false);
    expect(pool.tryAcquire("p2", t2)).toBe(true);

    t1.dispose();
    t2.dispose();
  });
});
