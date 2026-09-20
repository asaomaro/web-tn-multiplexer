import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopNotifier } from "./DesktopNotifier.js";

/** `Notification` の差し替え。`happy-dom` は実装を持たないので、必要な面だけ生やす。 */
interface FakeNotification {
  title: string;
  options: NotificationOptions | undefined;
  onclick: (() => void) | null;
  onclose: (() => void) | null;
  close: () => void;
  closed: boolean;
}

function installNotification(opts: { permission?: NotificationPermission; requestResult?: NotificationPermission; throwOnConstruct?: boolean } = {}) {
  const made: FakeNotification[] = [];
  const requestPermission = vi.fn(async () => opts.requestResult ?? "granted");

  class Fake {
    static permission: NotificationPermission = opts.permission ?? "granted";
    static requestPermission = requestPermission;
    onclick: (() => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;
    constructor(
      public title: string,
      public options?: NotificationOptions,
    ) {
      if (opts.throwOnConstruct) throw new TypeError("Illegal constructor.");
      made.push(this as unknown as FakeNotification);
    }
    close(): void {
      this.closed = true;
      // **実物は close イベントを（非同期に）起こす**。起こさない偽物にすると、
      // 「古い通知の close が新しい登録を消す」経路がテストから原理的に見えなくなる。
      queueMicrotask(() => this.onclose?.());
    }
  }
  vi.stubGlobal("Notification", Fake);
  return { made, requestPermission };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DesktopNotifier — permission", () => {
  it("Notification が無ければ unsupported（非セキュアな文脈・古いブラウザ）", () => {
    vi.stubGlobal("Notification", undefined);
    expect(new DesktopNotifier().permission()).toBe("unsupported");
  });

  it.each(["granted", "denied", "default"] as const)("%s をそのまま返す", (p) => {
    installNotification({ permission: p });
    expect(new DesktopNotifier().permission()).toBe(p);
  });
});

describe("DesktopNotifier — request", () => {
  it("許可されたら granted", async () => {
    installNotification({ permission: "default", requestResult: "granted" });
    expect(await new DesktopNotifier().request()).toBe("granted");
  });

  it("拒否されたら denied", async () => {
    installNotification({ permission: "default", requestResult: "denied" });
    expect(await new DesktopNotifier().request()).toBe("denied");
  });

  it("Notification が無ければ聞きに行かず unsupported", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(await new DesktopNotifier().request()).toBe("unsupported");
  });

  it("requestPermission が throw しても default で返す（押し直せる）", async () => {
    installNotification({ permission: "default" });
    (Notification as unknown as { requestPermission: () => Promise<never> }).requestPermission = () => Promise.reject(new Error("no"));
    expect(await new DesktopNotifier().request()).toBe("default");
  });
});

describe("DesktopNotifier — show", () => {
  it("許可されていれば出す。tag は pane id（同じ pane の通知は置き換わる）", () => {
    const { made } = installNotification();
    const ok = new DesktopNotifier().show({ title: "入力待ち: pane", body: "ws / tab", tag: "p1", onClick: vi.fn() });
    expect(ok).toBe(true);
    expect(made).toHaveLength(1);
    expect(made[0]!.title).toBe("入力待ち: pane");
    expect(made[0]!.options).toMatchObject({ body: "ws / tab", tag: "p1" });
  });

  // **AC7**：許可を取るまで出さない。ここが緩いと、押していないのに通知が出る。
  it.each(["default", "denied"] as const)("%s のときは作らずに false", (p) => {
    const { made } = installNotification({ permission: p });
    expect(new DesktopNotifier().show({ title: "t", body: "b", tag: "p1", onClick: vi.fn() })).toBe(false);
    expect(made).toHaveLength(0);
  });

  // **AC12**：Android Chrome は `Notification` があるのに `new Notification()` が throw する。
  // 機能検出では捕まらないので、作ってみて失敗を返すしかない。
  it("構築が throw する環境では false を返す（投げない）", () => {
    installNotification({ throwOnConstruct: true });
    const n = new DesktopNotifier();
    expect(() => n.show({ title: "t", body: "b", tag: "p1", onClick: vi.fn() })).not.toThrow();
    expect(n.show({ title: "t", body: "b", tag: "p1", onClick: vi.fn() })).toBe(false);
  });

  // **AC15**：クリックでそのタブに戻り、対象へ移る。
  it("クリックすると window.focus → 通知を閉じる → 渡された関数を呼ぶ", () => {
    const { made } = installNotification();
    const focus = vi.fn();
    vi.stubGlobal("window", { ...globalThis.window, focus });
    const onClick = vi.fn();
    new DesktopNotifier().show({ title: "t", body: "b", tag: "p1", onClick });

    made[0]!.onclick?.();
    expect(focus).toHaveBeenCalledOnce();
    expect(made[0]!.closed).toBe(true);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("DesktopNotifier — closeByTag", () => {
  it("出した通知を tag で閉じる", () => {
    const { made } = installNotification();
    const n = new DesktopNotifier();
    n.show({ title: "t", body: "b", tag: "p1", onClick: vi.fn() });
    n.closeByTag("p1");
    expect(made[0]!.closed).toBe(true);
  });

  it("出していない tag を閉じても何も起きない", () => {
    installNotification();
    expect(() => new DesktopNotifier().closeByTag("missing")).not.toThrow();
  });

  it("クリックで閉じた後に closeByTag しても二重に閉じない", () => {
    const { made } = installNotification();
    const n = new DesktopNotifier();
    vi.stubGlobal("window", { ...globalThis.window, focus: vi.fn() });
    n.show({ title: "t", body: "b", tag: "p1", onClick: vi.fn() });
    made[0]!.onclick?.();
    const closeSpy = vi.spyOn(made[0]! as unknown as { close: () => void }, "close");
    n.closeByTag("p1");
    expect(closeSpy).not.toHaveBeenCalled();
  });

  // **同じ pane の知らせは出し直される**（待ち行列の置き換え）。このとき古い通知の close が
  // 走るが、**tag だけで登録を消すと新しい通知の登録まで消え**、以後 `closeByTag` が
  // 何もしなくなって OS 通知が画面に残り続ける。
  it("同じ tag で出し直した後も、新しい通知を閉じられる", async () => {
    const { made } = installNotification();
    const n = new DesktopNotifier();
    vi.stubGlobal("window", { ...globalThis.window, focus: vi.fn() });

    n.show({ title: "1 本目", body: "b", tag: "p1", onClick: vi.fn() });
    made[0]!.onclick?.(); // 1 本目を閉じる（close イベントは非同期に来る）
    n.show({ title: "2 本目", body: "b", tag: "p1", onClick: vi.fn() });
    await Promise.resolve(); // ここで 1 本目の onclose が走る

    n.closeByTag("p1");
    expect(made[1]!.closed, "2 本目を閉じられる").toBe(true);
  });

  it("close が throw しても投げない", () => {
    const { made } = installNotification();
    const n = new DesktopNotifier();
    n.show({ title: "t", body: "b", tag: "p1", onClick: vi.fn() });
    made[0]!.close = () => {
      throw new Error("already closed");
    };
    expect(() => n.closeByTag("p1")).not.toThrow();
  });
});
