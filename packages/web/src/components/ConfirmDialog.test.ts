import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey } from "../injection.js";
import { useViewStore } from "../store/view.js";
import ConfirmDialog from "./ConfirmDialog.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

function makeActions() {
  return { confirmClose: vi.fn() };
}

function mountDialog(actions: ReturnType<typeof makeActions>) {
  return mount(ConfirmDialog, {
    global: { plugins: [pinia], provide: { [ActionDispatcherKey as symbol]: actions } },
    attachTo: document.body,
  });
}

describe("ConfirmDialog — 表示", () => {
  it("role=alertdialog を持ち、開いたら最初のフォーカスは「キャンセル」", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    const dialog = wrapper.get("dialog").element as HTMLDialogElement;
    expect(dialog.getAttribute("role")).toBe("alertdialog");
    expect(dialog.open).toBe(true);
    const cancelBtn = wrapper.findAll("button")[0]!.element;
    expect(document.activeElement).toBe(cancelBtn);
  });

  it("対象外の dialogContext では閉じたまま", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "x" });
    await wrapper.vm.$nextTick();
    expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(false);
  });
});

describe("ConfirmDialog — 確定・取り消し", () => {
  it("「閉じる」ボタンで confirmClose を呼ぶ", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.findAll("button")[1]!.trigger("click");
    expect(actions.confirmClose).toHaveBeenCalledTimes(1);
  });

  it("「キャンセル」ボタンで取り消し、confirmClose を呼ばずに閉じる", async () => {
    const view = useViewStore(pinia);
    view.focusPane("p0");
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.findAll("button")[0]!.trigger("click");
    expect(actions.confirmClose).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();
    expect(view.focusedPaneId).toBe("p0");
  });

  it("Esc（dialog の cancel イベント）で取り消す", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.get("dialog").trigger("cancel");
    expect(actions.confirmClose).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();
  });

  it("外側（backdrop）のクリックで取り消す", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.get("dialog").trigger("click");
    expect(actions.confirmClose).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();
  });

  it("y で確定・n で取り消す", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);

    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "tab", id: "t1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.get("dialog").trigger("keydown", { key: "n" });
    expect(actions.confirmClose).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();

    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "tab", id: "t1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.get("dialog").trigger("keydown", { key: "y" });
    expect(actions.confirmClose).toHaveBeenCalledTimes(1);
  });
});
