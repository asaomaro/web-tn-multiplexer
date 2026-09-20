import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDispatcherKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import NameDialog from "./NameDialog.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

function makeActions() {
  return {
    confirmNewTab: vi.fn(),
    confirmRenamePane: vi.fn(),
    confirmRenameTab: vi.fn(),
    confirmRenameWorkspace: vi.fn(),
  };
}

function mountDialog(actions: ReturnType<typeof makeActions>) {
  return mount(NameDialog, {
    global: { plugins: [pinia], provide: { [ActionDispatcherKey as symbol]: actions } },
    attachTo: document.body,
  });
}

describe("NameDialog — 表示と入力初期値", () => {
  it("newTab は tab の数＋1 を入力済みにする（D55 の 12）", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ id: "w1", label: "w1", cwd: "/", tabIds: ["t1", "t2"], activeTabId: "t1", groupId: null, git: null });
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "newTab", workspaceId: "w1" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    const input = wrapper.get("input").element as HTMLInputElement;
    expect(input.value).toBe("3");
    expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(true);
  });

  it("renamePane/renameTab/renameWorkspace は今の名前を入力済みにする", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "my pane" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("my pane");
  });

  it("全選択で開く（selectionStart/selectionEnd が全体を覆う）", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "renameTab", tabId: "t1", currentLabel: "abc" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    const input = wrapper.get("input").element as HTMLInputElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(3);
  });

  it("対象外の dialogContext（confirmClose 等）では閉じたまま", async () => {
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    await wrapper.vm.$nextTick();
    expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(false);
  });
});

describe("NameDialog — 確定・取り消し", () => {
  it("Enter（submit）で該当する confirm* を呼ぶ（newTab）", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ id: "w1", label: "w1", cwd: "/", tabIds: [], activeTabId: "", groupId: null, git: null });
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "newTab", workspaceId: "w1" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await wrapper.get("input").setValue("build");
    await wrapper.get("form").trigger("submit");
    expect(actions.confirmNewTab).toHaveBeenCalledWith("build");
  });

  it("newTab はプリフィルのまま変更せず確定すると、confirmNewTab に空文字を渡す（herdr overlay_input.rs 971 行。D75）", async () => {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ id: "w1", label: "w1", cwd: "/", tabIds: ["t1", "t2"], activeTabId: "t1", groupId: null, git: null });
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "newTab", workspaceId: "w1" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("3");
    await wrapper.get("form").trigger("submit"); // 何も編集せずそのまま確定
    expect(actions.confirmNewTab).toHaveBeenCalledWith("");
  });

  it("Enter（submit）で該当する confirm* を呼ぶ（renamePane/renameTab/renameWorkspace）", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);

    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "x" });
    await wrapper.vm.$nextTick();
    await wrapper.get("input").setValue("new-name");
    await wrapper.get("form").trigger("submit");
    expect(actions.confirmRenamePane).toHaveBeenCalledWith("new-name");

    view.openDialogWithContext({ kind: "renameTab", tabId: "t1", currentLabel: "x" });
    await wrapper.vm.$nextTick();
    await wrapper.get("input").setValue("new-tab-name");
    await wrapper.get("form").trigger("submit");
    expect(actions.confirmRenameTab).toHaveBeenCalledWith("new-tab-name");

    view.openDialogWithContext({ kind: "renameWorkspace", workspaceId: "w1", currentLabel: "x" });
    await wrapper.vm.$nextTick();
    await wrapper.get("input").setValue("new-ws-name");
    await wrapper.get("form").trigger("submit");
    expect(actions.confirmRenameWorkspace).toHaveBeenCalledWith("new-ws-name");
  });

  it("キャンセルボタンで取り消し、confirm* を呼ばずに閉じて元の pane へフォーカスを戻す", async () => {
    const view = useViewStore(pinia);
    view.focusPane("p0");
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "x" });
    view.focusPane(null); // ダイアログが開いている間に DOM フォーカスが移った状態を模す
    await wrapper.vm.$nextTick();
    await wrapper.get("button[type=button]").trigger("click");
    expect(actions.confirmRenamePane).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();
    expect(view.focusedPaneId).toBe("p0");
  });

  it("Esc（dialog の cancel イベント）で取り消す", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "x" });
    await wrapper.vm.$nextTick();
    await wrapper.get("dialog").trigger("cancel");
    expect(actions.confirmRenamePane).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();
  });

  it("外側（backdrop）のクリックで取り消す", async () => {
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "x" });
    await wrapper.vm.$nextTick();
    await wrapper.get("dialog").trigger("click"); // dialog 要素自身へのクリック＝backdrop クリック相当
    expect(actions.confirmRenamePane).not.toHaveBeenCalled();
    expect(view.dialogContext).toBeNull();
  });
});
