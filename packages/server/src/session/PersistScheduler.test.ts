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
