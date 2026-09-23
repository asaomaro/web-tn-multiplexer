import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { useSettingsStore } from "../store/settings.js";
import {
  KeyboardLockController,
  LOCKED_CODES,
  type KeyboardLockControllerOptions,
} from "./KeyboardLockController.js";

/** `document` の `fullscreenElement`/`fullscreenchange` の偽物。`enter()`/`exit()` で切り替える。 */
function fakeDoc() {
  const listeners = new Set<() => void>();
  const doc = {
    fullscreenElement: null as Element | null,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  return {
    doc: doc as unknown as KeyboardLockControllerOptions["doc"],
    enter() {
      doc.fullscreenElement = {} as Element;
      for (const fn of listeners) fn();
    },
    exit() {
      doc.fullscreenElement = null;
      for (const fn of listeners) fn();
    },
    listenerCount: () => listeners.size,
  };
}

function fakeKeyboard() {
  return {
    lock: vi.fn(() => Promise.resolve()),
    unlock: vi.fn(),
  };
}

describe("KeyboardLockController（20260922-keybinding-usability。design「US4」）", () => {
  it("有効かつ全画面のとき lock(LOCKED_CODES) を呼ぶ（AC12）", () => {
    const { doc, enter } = fakeDoc();
    const keyboard = fakeKeyboard();
    const settings = { keyboardLockInFullscreen: true };
    const c = new KeyboardLockController({ settings, doc, keyboard });
    c.start();
    expect(keyboard.lock).not.toHaveBeenCalled(); // 全画面でないので最初は呼ばない
    enter();
    expect(keyboard.lock).toHaveBeenCalledTimes(1);
    expect(keyboard.lock).toHaveBeenCalledWith([...LOCKED_CODES]);
  });

  it("全画面を抜けると unlock() を呼ぶ（AC13）", () => {
    const { doc, enter, exit } = fakeDoc();
    const keyboard = fakeKeyboard();
    const settings = { keyboardLockInFullscreen: true };
    const c = new KeyboardLockController({ settings, doc, keyboard });
    c.start();
    enter();
    exit();
    expect(keyboard.unlock).toHaveBeenCalled();
  });

  it("keyboard が null（API 無し）のときは何も呼ばず、例外も投げない（AC14）", () => {
    const { doc, enter } = fakeDoc();
    const settings = { keyboardLockInFullscreen: true };
    const c = new KeyboardLockController({ settings, doc, keyboard: null });
    expect(() => {
      c.start();
      enter();
    }).not.toThrow();
  });

  it("lock()/unlock() が同期的に throw しても sync() は例外を投げない（AC14）", () => {
    const { doc, enter, exit } = fakeDoc();
    const keyboard = {
      lock: vi.fn(() => {
        throw new Error("boom");
      }),
      unlock: vi.fn(() => {
        throw new Error("boom");
      }),
    };
    const settings = { keyboardLockInFullscreen: true };
    const c = new KeyboardLockController({ settings, doc, keyboard });
    expect(() => {
      c.start();
      enter();
      exit();
    }).not.toThrow();
  });

  it("lock() が reject しても、その戻り値に `.catch()` が呼ばれ、外へ伝播しない（AC14）", async () => {
    // Node の `process.on("unhandledRejection")` で確かめる案は、`vi.fn()` が戻り値の Promise を
    // 内部で自前に消費（`mock.results` の記録）してしまい、`.catch()` の有無に関わらず「未処理」に
    // ならなかった（実際に試して確認済み）。**戻り値に `.catch` が呼ばれたかを直接数える**、より
    // 確実な形で確かめる。
    const { doc, enter } = fakeDoc();
    const rejection = new Error("boom");
    let catchCallCount = 0;
    const rejected: Promise<void> = Promise.reject(rejection);
    // 元の `.catch` を上書きして呼び出し回数を数える（`rejected` 自体の動きは変えない）。
    rejected.catch = ((fn?: (reason: unknown) => void) => {
      catchCallCount += 1;
      return Promise.prototype.catch.call(rejected, fn);
    }) as typeof rejected.catch;
    const keyboard = { lock: vi.fn(() => rejected), unlock: vi.fn() };
    const settings = { keyboardLockInFullscreen: true };
    const c = new KeyboardLockController({ settings, doc, keyboard });
    c.start();
    enter();
    expect(keyboard.lock).toHaveBeenCalledTimes(1);
    expect(catchCallCount, "sync() は lock() の戻り値へ .catch() を呼んでいるはず").toBe(1);
    await rejected.catch(() => undefined); // このテスト自体から reject を漏らさない後始末
  });

  it("keyboardLockInFullscreen が無効なら、全画面に入っても lock() を呼ばない", () => {
    const { doc, enter } = fakeDoc();
    const keyboard = fakeKeyboard();
    const settings = { keyboardLockInFullscreen: false };
    const c = new KeyboardLockController({ settings, doc, keyboard });
    c.start();
    enter();
    expect(keyboard.lock).not.toHaveBeenCalled();
  });

  it("全画面中に設定を無効へ切り替えると unlock() を呼ぶ（watch 経由。実物の Pinia ストアで確認）", async () => {
    const { doc, enter } = fakeDoc();
    const keyboard = fakeKeyboard();
    const settings = useSettingsStore(createPinia());
    settings.setKeyboardLockInFullscreen(true);
    const c = new KeyboardLockController({ settings, doc, keyboard });
    c.start();
    enter();
    expect(keyboard.lock).toHaveBeenCalledTimes(1);
    settings.setKeyboardLockInFullscreen(false);
    await nextTick();
    expect(keyboard.unlock).toHaveBeenCalled();
  });

  it("stop() の後は fullscreenchange に反応しない", () => {
    const { doc, enter, listenerCount } = fakeDoc();
    const keyboard = fakeKeyboard();
    const settings = { keyboardLockInFullscreen: true };
    const c = new KeyboardLockController({ settings, doc, keyboard });
    c.start();
    expect(listenerCount()).toBe(1);
    c.stop();
    expect(listenerCount()).toBe(0);
    enter();
    expect(keyboard.lock).not.toHaveBeenCalled();
  });
});
