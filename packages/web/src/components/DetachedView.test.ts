import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ConnectionKey } from "../injection.js";
import DetachedView from "./DetachedView.vue";

describe("DetachedView", () => {
  it("「再接続」ボタンで connect() を呼ぶ", async () => {
    const conn = { connect: vi.fn(), login: vi.fn(), request: vi.fn(), sendInput: vi.fn(), logout: vi.fn() };
    const wrapper = mount(DetachedView, { global: { provide: { [ConnectionKey as symbol]: conn } } });
    expect(wrapper.text()).toContain("切り離しました");
    await wrapper.get("button").trigger("click");
    expect(conn.connect).toHaveBeenCalledTimes(1);
  });
});
