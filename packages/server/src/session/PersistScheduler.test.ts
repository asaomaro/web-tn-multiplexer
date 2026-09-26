import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultPersistScheduler } from "./PersistScheduler.js";

describe("DefaultPersistScheduler.cancel（D102：復元の前に失敗した起動の保存の予約を取り消す）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("予約した保存を取り消し、時間がたっても保存しない", async () => {
    const save = vi.fn(async () => undefined);
    const persist = new DefaultPersistScheduler(save, 500);
    persist.touch();
    persist.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });

  it("取り消した後も、次の touch はふつうに保存する", async () => {
    const save = vi.fn(async () => undefined);
    const persist = new DefaultPersistScheduler(save, 500);
    persist.touch();
    persist.cancel();
    persist.touch();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("予約が無いときの cancel は何もしない", async () => {
    const save = vi.fn(async () => undefined);
    const persist = new DefaultPersistScheduler(save, 500);
    persist.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });
});

/** 手で解決・失敗させる save。呼ばれた回数と、同時に実行中の数の最大値を数える。 */
function manualSave() {
  const calls: { resolve: () => void; reject: (err: Error) => void }[] = [];
  let running = 0;
  let maxRunning = 0;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        const settle = (fn: () => void) => () => {
          running -= 1;
          fn();
        };
        calls.push({ resolve: settle(resolve), reject: (err) => settle(() => reject(err))() });
      }),
  );
  return { save, calls, maxRunning: () => maxRunning };
}

describe("DefaultPersistScheduler：進行中の保存より後の要求（20260926-persist-flush-drops-changes）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("保存中に flush すると、その保存の後にもう1回保存し、それを待って解決する", async () => {
    const { save, calls } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    const first = persist.flush();
    let flushed = false;
    const second = persist.flush().then(() => {
      flushed = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    calls[0]!.resolve();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(flushed).toBe(false);
    calls[1]!.resolve();
    await second;
    expect(flushed).toBe(true);
    // 追加の保存を終えた後の flush は、また新しく保存する
    const third = persist.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(3);
    calls[2]!.resolve();
    await third;
  });

  it("保存中に予約の時刻が来ると、その保存の後にもう1回保存する", async () => {
    const { save, calls } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    persist.touch();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    persist.touch();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    calls[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    calls[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("保存中の flush と予約を何度重ねても追加の保存は1回で、2つの保存が同時に走らない", async () => {
    const { save, calls, maxRunning } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    const first = persist.flush();
    const waits = [persist.flush(), persist.flush()];
    persist.touch();
    await vi.advanceTimersByTimeAsync(500);
    waits.push(persist.flush());
    calls[0]!.resolve();
    await first;
    // 追加の保存が始まる前の隙間でも、別の保存を始めない
    waits.push(persist.flush());
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    calls[1]!.resolve();
    await Promise.all(waits);
    expect(save).toHaveBeenCalledTimes(2);
    expect(maxRunning()).toBe(1);
  });

  it("保存中に続けて flush しても、先の flush は後の flush に追加の保存を取り消されず、その完了を待って解決する", async () => {
    const { save, calls } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    const first = persist.flush();
    let earlierFlushed = false;
    const earlier = persist.flush().then(() => {
      earlierFlushed = true;
    });
    const later = persist.flush();
    calls[0]!.resolve();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(earlierFlushed).toBe(false);
    calls[1]!.resolve();
    await Promise.all([earlier, later]);
    expect(earlierFlushed).toBe(true);
  });

  it("進行中の保存が失敗しても、その間に要求した保存は行い、flush はその結果で解決する", async () => {
    const { save, calls } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    const first = persist.flush();
    const second = persist.flush();
    calls[0]!.reject(new Error("disk full"));
    await expect(first).rejects.toThrow("disk full");
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    calls[1]!.resolve();
    await expect(second).resolves.toBeUndefined();
  });

  it("追加の保存が失敗したら、それを待つ flush は失敗する（握りつぶさない）", async () => {
    const { save, calls } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    const first = persist.flush();
    const second = persist.flush();
    calls[0]!.resolve();
    await expect(first).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    calls[1]!.reject(new Error("disk full"));
    await expect(second).rejects.toThrow("disk full");
  });

  it("保存中でなければ flush はすぐ1回だけ保存する", async () => {
    const save = vi.fn(async () => undefined);
    const persist = new DefaultPersistScheduler(save, 500);
    await persist.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("cancel は、まだ始まっていない追加の保存も取り消す", async () => {
    const { save, calls } = manualSave();
    const persist = new DefaultPersistScheduler(save, 500);
    const first = persist.flush();
    persist.touch();
    await vi.advanceTimersByTimeAsync(500);
    persist.cancel();
    calls[0]!.resolve();
    await first;
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
