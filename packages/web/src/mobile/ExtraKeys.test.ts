import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyInputControllerKey } from "../injection.js";
import ExtraKeys from "./ExtraKeys.vue";

function makeKeys() {
  return { injectKey: vi.fn(), injectPrefix: vi.fn(), setPendingModifier: vi.fn() };
}

function mountExtraKeys(keys: ReturnType<typeof makeKeys>) {
  return mount(ExtraKeys, { global: { provide: { [KeyInputControllerKey as symbol]: keys } } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ExtraKeys — 単純なキー", () => {
  it("Esc/Tab/矢印/PgUp/PgDn を injectKey する", async () => {
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    await buttons[labels.indexOf("Esc")]!.trigger("click");
    expect(keys.injectKey).toHaveBeenLastCalledWith(expect.objectContaining({ key: "Escape" }));
    await buttons[labels.indexOf("↑")]!.trigger("click");
    expect(keys.injectKey).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
    await buttons[labels.indexOf("PgDn")]!.trigger("click");
    expect(keys.injectKey).toHaveBeenLastCalledWith(expect.objectContaining({ key: "PageDown" }));
  });

  it("Ctrl を armed（one-shot）にして Prefix を押すと、注入のあとに待機を解除する（lock は残る）", async () => {
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    await buttons[labels.indexOf("Ctrl")]!.trigger("pointerdown");
    await buttons[labels.indexOf("Ctrl")]!.trigger("pointerup");
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith({ ctrl: true, alt: false }, { locked: false });
    await wrapper.get("button:last-child").trigger("click");
    expect(keys.injectPrefix).toHaveBeenCalledTimes(1);
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith(null, { locked: false }); // one-shot は使い切って解除
  });

  it("Prefix は injectPrefix を呼ぶ（いまの prefix を注入する。どのキーかは KeyInputController が Router から得る。AC11）", async () => {
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    await wrapper.get("button:last-child").trigger("click");
    expect(keys.injectPrefix).toHaveBeenCalledTimes(1);
    expect(keys.injectKey, "ctrl+b を直に注入しない（prefix を変えると別のキーになる）").not.toHaveBeenCalled();
  });
});

describe("ExtraKeys — Ctrl/Alt の one-shot / lock", () => {
  function ctrlButton(wrapper: ReturnType<typeof mountExtraKeys>) {
    return wrapper.findAll("button").find((b) => b.text() === "Ctrl")!;
  }

  it("短いタップ（one-shot）：setPendingModifier で ctrl:true を armed にし、次のキーの後は解除する", async () => {
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    const btn = ctrlButton(wrapper);
    await btn.trigger("pointerdown");
    await btn.trigger("pointerup");
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith({ ctrl: true, alt: false }, { locked: false });
    expect(btn.classes()).toContain("extra-keys-btn-active");

    await wrapper.get("button").trigger("click"); // Esc（一番目のボタン）
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith(null, { locked: false });
    expect(btn.classes()).not.toContain("extra-keys-btn-active");
  });

  it("もう一度タップすると armed を解除する", async () => {
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    const btn = ctrlButton(wrapper);
    await btn.trigger("pointerdown");
    await btn.trigger("pointerup");
    expect(btn.classes()).toContain("extra-keys-btn-active");
    await btn.trigger("pointerdown");
    await btn.trigger("pointerup");
    expect(btn.classes()).not.toContain("extra-keys-btn-active");
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith(null, { locked: false });
  });

  it("長押し（lock）：500ms 経つと locked になり、キーを使っても armed のまま残る", async () => {
    vi.useFakeTimers();
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    const btn = ctrlButton(wrapper);
    await btn.trigger("pointerdown");
    await vi.advanceTimersByTimeAsync(500);
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith({ ctrl: true, alt: false }, { locked: true });
    await btn.trigger("pointerup"); // 長押しの後の pointerup はトグルしない
    expect(btn.classes()).toContain("extra-keys-btn-active");

    await wrapper.get("button").trigger("click"); // Esc
    expect(btn.classes()).toContain("extra-keys-btn-active"); // lock は消費後も残る
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith({ ctrl: true, alt: false }, { locked: true });
  });

  it("500ms 未満で離せば one-shot のまま（lock にならない）", async () => {
    vi.useFakeTimers();
    const keys = makeKeys();
    const wrapper = mountExtraKeys(keys);
    const btn = ctrlButton(wrapper);
    await btn.trigger("pointerdown");
    await vi.advanceTimersByTimeAsync(200);
    await btn.trigger("pointerup");
    expect(keys.setPendingModifier).toHaveBeenLastCalledWith({ ctrl: true, alt: false }, { locked: false });
  });
});
