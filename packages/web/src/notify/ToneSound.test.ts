import { afterEach, describe, expect, it, vi } from "vitest";
import { ToneSound } from "./ToneSound.js";

/** `AudioContext` の差し替え。`happy-dom` は実装を持たないので、使う面だけ生やす。 */
function installAudioContext(opts: { state?: AudioContextState; throwOnConstruct?: boolean; resumeRejects?: boolean } = {}) {
  const started: { hz: number; at: number }[] = [];
  // **実物は Promise が解決してから `state` が `running` になる**。同期で変える偽物にすると、
  // 「`unlock()` の直後はまだ鳴らない」という非同期の穴がテストから見えなくなる。
  const resume = vi.fn(async () => {
    if (opts.resumeRejects) throw new Error("no");
    await Promise.resolve();
    ctx.state = "running";
  });
  const ctx = {
    state: (opts.state ?? "running") as AudioContextState,
    currentTime: 0,
    destination: {},
    resume,
    createOscillator: () => {
      const node = {
        type: "",
        frequency: { setValueAtTime: (hz: number, at: number) => started.push({ hz, at }) },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      return node;
    },
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }),
  };
  let constructed = 0;
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        if (opts.throwOnConstruct) throw new Error("no audio");
        constructed++;
        return ctx as unknown as AudioContext;
      }
    },
  );
  return { ctx, started, resume, constructedCount: () => constructed };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ToneSound — 鳴らす", () => {
  it("running なら鳴って played を返す", () => {
    installAudioContext({ state: "running" });
    expect(new ToneSound().play("blocked")).toBe("played");
  });

  // **AC2**：入力待ちと完了を耳で区別できるように、2 音の向きを変える。
  it("入力待ちは上がる 2 音、完了は下がる 2 音", () => {
    const a = installAudioContext();
    new ToneSound().play("blocked");
    expect(a.started.map((s) => s.hz)).toEqual([660, 990]);
    expect(a.started[1]!.hz, "入力待ちは上がる").toBeGreaterThan(a.started[0]!.hz);

    vi.unstubAllGlobals();
    const b = installAudioContext();
    new ToneSound().play("done");
    expect(b.started.map((s) => s.hz)).toEqual([880, 587]);
    expect(b.started[1]!.hz, "完了は下がる").toBeLessThan(b.started[0]!.hz);
  });

  it("2 音目は 1 音目より後に鳴らす（重ならない）", () => {
    const a = installAudioContext();
    new ToneSound().play("blocked");
    expect(a.started[1]!.at).toBeGreaterThan(a.started[0]!.at);
  });

  // **1 つを使い回す**（通知のたびに new すると上限に当たる）。
  it("AudioContext は 1 つだけ作る", () => {
    const a = installAudioContext();
    const s = new ToneSound();
    s.play("blocked");
    s.play("done");
    s.play("blocked");
    expect(a.constructedCount()).toBe(1);
  });
});

// **AC13**：設定が「入」でも鳴らないことがある。黙って捨てない。
describe("ToneSound — 鳴らせないとき", () => {
  it("suspended なら blocked を返す（この画面をまだ操作していない）", () => {
    const a = installAudioContext({ state: "suspended" });
    expect(new ToneSound().play("blocked")).toBe("blocked");
    expect(a.started, "音を作りにいかない").toEqual([]);
  });

  // **鳴らせなかったときに解除を試みるのは `NotificationController` 側**（印を下ろす出口を通すため。
  // `NotificationController.test.ts`「鳴らせなかった知らせの後は〜」）。ここは `play()` が
  // **黙って何かを始めない**ことだけを見る。
  it("鳴らせないときに自分で解除しにいかない（解除は呼ぶ側の仕事）", () => {
    const a = installAudioContext({ state: "suspended" });
    expect(new ToneSound().play("blocked")).toBe("blocked");
    expect(a.resume).not.toHaveBeenCalled();
  });

  it("AudioContext が無い環境では unsupported", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    expect(new ToneSound().play("blocked")).toBe("unsupported");
  });

  it("AudioContext を作れなければ unsupported（投げない）", () => {
    installAudioContext({ throwOnConstruct: true });
    const s = new ToneSound();
    expect(() => s.play("blocked")).not.toThrow();
    expect(s.play("blocked")).toBe("unsupported");
  });
});

describe("ToneSound — unlock", () => {
  // **ここでは `play()` を先に呼ばない**——`play()` 自身も解除を試みる（「鳴らせなかったときは
  // 解除を試み〜」）ようになったので、混ぜると `unlock()` が効いたのかが見えなくなる。
  it("suspended なら resume して、以後は鳴る", async () => {
    const a = installAudioContext({ state: "suspended" });
    const s = new ToneSound();

    expect(await s.unlock(), "解除できたことを返す").toBe(true);
    expect(a.resume).toHaveBeenCalledOnce();
    expect(s.play("blocked")).toBe("played");
  });

  // **呼ぶ側は `resume()` の解決を待たない**（`void s.unlock()`）ので、**直後はまだ鳴らない**。
  // 「入にしたその場で試し鳴らし」を足すと、本番では鳴らずに `soundBlocked` が誤って立つ。
  it("unlock した直後はまだ鳴らない（resume の解決を待つ必要がある）", () => {
    installAudioContext({ state: "suspended" });
    const s = new ToneSound();
    void s.unlock();
    expect(s.play("blocked"), "同じ tick ではまだ suspended").toBe("blocked");
  });

  it("既に running なら resume を呼ばない（操作のたびに呼ばれても素通りする）", async () => {
    const a = installAudioContext({ state: "running" });
    const s = new ToneSound();
    expect(await s.unlock()).toBe(true);
    expect(await s.unlock()).toBe(true);
    expect(a.resume).not.toHaveBeenCalled();
  });

  it("resume が失敗しても投げない（false を返し、次の play も blocked）", async () => {
    installAudioContext({ state: "suspended", resumeRejects: true });
    const s = new ToneSound();
    expect(await s.unlock(), "解除できなかったことを返す").toBe(false);
    expect(s.play("blocked")).toBe("blocked");
  });

  it("AudioContext が無くても投げない（false を返す）", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    await expect(new ToneSound().unlock()).resolves.toBe(false);
  });
});
