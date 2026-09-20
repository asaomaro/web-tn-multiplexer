import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useViewStore } from "../store/view.js";
import HelpDialog from "./HelpDialog.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

function mountDialog() {
  return mount(HelpDialog, { global: { plugins: [pinia] }, attachTo: document.body });
}

async function open(view: ReturnType<typeof useViewStore>, wrapper: ReturnType<typeof mountDialog>) {
  view.openDialogWithContext({ kind: "help" });
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
}

describe("HelpDialog — 表示", () => {
  it("4 つの群（全体・移動・workspace / tab・pane）を出す。custom は無い", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    const names = wrapper.findAll(".help-dialog-group-name").map((el) => el.text());
    expect(names).toEqual(["全体", "移動", "workspace / tab", "pane"]);
  });

  it("後続のキーは灰色クラスで「未対応（後続: ◯◯）」と出す", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    const grayed = wrapper.findAll(".help-dialog-grayed");
    expect(grayed.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("未対応（後続: 外観と設定）");
    expect(wrapper.text()).toContain("未対応（後続: 通知）");
    // `shift+g`（グルーピングの枠）は 20260920-git-worktree-actions で「新しい worktree」に置き換わった。
    expect(wrapper.text()).toContain("新しい worktree");
    expect(wrapper.text()).toContain("未対応（後続: 端末機能の拡張）");
  });

  it("H/J/K/L（swap）は herdr のヘルプにも出ないので、ここにも出さない（D76）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    expect(wrapper.text()).not.toContain("入れ替え");
  });

  it("/ で絞り込むと、一致 0 件の群は消える", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    await wrapper.get("input").setValue("拡大");
    const names = wrapper.findAll(".help-dialog-group-name").map((el) => el.text());
    expect(names).toEqual(["pane"]);
    expect(wrapper.findAll("dt").map((el) => el.text())).toEqual(["z"]);
  });
});

describe("HelpDialog — Esc/Enter/? の分岐", () => {
  it("絞り込み中の Esc は文字を消して検索欄から離れる（閉じない）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    const input = wrapper.get("input");
    await input.setValue("zoom");
    (input.element as HTMLInputElement).focus();
    await wrapper.get("dialog").trigger("keydown", { key: "Escape" });
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(view.dialogContext).not.toBeNull();
    expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(true);
  });

  it("絞り込み中でも Enter は閉じる", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    const input = wrapper.get("input");
    await input.setValue("zoom");
    (input.element as HTMLInputElement).focus();
    await wrapper.get("dialog").trigger("keydown", { key: "Enter" });
    expect(view.dialogContext).toBeNull();
  });

  it("絞り込んでいないときは Esc・Enter・? で閉じる", async () => {
    const view = useViewStore(pinia);
    for (const key of ["Escape", "Enter", "?"]) {
      const wrapper = mountDialog();
      await open(view, wrapper);
      await wrapper.get("dialog").trigger("keydown", { key });
      expect(view.dialogContext).toBeNull();
      wrapper.unmount();
    }
  });

  it("外側（backdrop）のクリックで閉じる", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    await wrapper.get("dialog").trigger("click");
    expect(view.dialogContext).toBeNull();
  });
});

describe("HelpDialog — スクロール", () => {
  it("絞り込んでいないときは j/k・PageUp/PageDown・Home/End でスクロールする", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    const list = wrapper.get(".help-dialog-list").element as HTMLElement;
    list.scrollTop = 100;

    await wrapper.get("dialog").trigger("keydown", { key: "j" });
    expect(list.scrollTop).toBe(132);
    await wrapper.get("dialog").trigger("keydown", { key: "k" });
    expect(list.scrollTop).toBe(100);
    await wrapper.get("dialog").trigger("keydown", { key: "PageDown" });
    expect(list.scrollTop).toBe(340);
    await wrapper.get("dialog").trigger("keydown", { key: "Home" });
    expect(list.scrollTop).toBe(0);
  });

  it("絞り込み中は j/k はスクロールせず（入力欄の文字として入る）、矢印/PageUp/PageDownはスクロールする", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog();
    await open(view, wrapper);
    const input = wrapper.get("input");
    (input.element as HTMLInputElement).focus();
    const list = wrapper.get(".help-dialog-list").element as HTMLElement;
    list.scrollTop = 50;

    await wrapper.get("dialog").trigger("keydown", { key: "j" });
    expect(list.scrollTop).toBe(50); // 効かない

    await wrapper.get("dialog").trigger("keydown", { key: "ArrowDown" });
    expect(list.scrollTop).toBe(82); // 効く
  });
});
