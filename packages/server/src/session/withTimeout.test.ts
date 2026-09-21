import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./withTimeout.js";

afterEach(() => {
  vi.useRealTimers();
});

// 上限つきの待ちの共通部品（前の work の読み直しと、名前を決める処理が使う。20260921-workspace-auto-label の review ラウンド 1・2）。
// 上限・reject・同期で投げる・タイマーの後始末は、使う側のテスト（newCwd.test.ts・workspaceLabel.test.ts）が見ている。
describe("withTimeout", () => {
  it("上限を超えたら先に null で戻し、onTimeout に、待つのをやめた処理が後から終わると解決する settled を渡す", async () => {
    vi.useFakeTimers();
    let finish: (v: string) => void = () => undefined;
    const slow = new Promise<string>((r) => (finish = r));
    let settled: Promise<void> | undefined;
    const pending = withTimeout(
      () => slow,
      100,
      (s) => (settled = s),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBeNull();
    let done = false;
    void settled!.then(() => (done = true));
    await Promise.resolve();
    expect(done, "まだ終わっていない").toBe(false);
    finish("late");
    await settled;
    expect(done).toBe(true);
  });

  it("onTimeout が投げても、待っている側は null で戻る", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      () => new Promise<string>(() => undefined),
      100,
      () => {
        throw new Error("boom");
      },
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBeNull();
  });

  it("先に終われば onTimeout は呼ばない", async () => {
    const onTimeout = vi.fn();
    expect(await withTimeout(async () => "ok", 100, onTimeout)).toBe("ok");
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
