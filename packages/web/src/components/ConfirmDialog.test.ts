import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "@wtm/protocol";
import { ActionDispatcherKey } from "../injection.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import ConfirmDialog from "./ConfirmDialog.vue";

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

function makeWorkspace(id: string, overrides: Partial<Workspace> = {}): Workspace {
  return { id, label: id, cwd: `/${id}`, tabIds: [], activeTabId: "", groupId: null, git: null, autoLabel: false, ...overrides };
}

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

// 20260923-workspace-grouping（herdr の close_group 相当）。
describe("ConfirmDialog — 束ねた worktree も一緒に閉じる", () => {
  function setUpAutoGroup(): void {
    const session = useSessionStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", { git: { branch: "main", ahead: 0, behind: 0, repoKey: "/r/.git", isLinkedWorktree: false } }));
    session.workspaceUpserted(makeWorkspace("w2", { git: { branch: "feature", ahead: 0, behind: 0, repoKey: "/r/.git", isLinkedWorktree: true } }));
  }

  it("対象が worktree 自動グループの本体1件なら、束ねられた件数付きのチェックボックスを出す（既定オフ）", async () => {
    setUpAutoGroup();
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "workspace", id: "w1" }] });
    await wrapper.vm.$nextTick();
    const checkbox = wrapper.find('input[type="checkbox"]');
    expect(checkbox.exists()).toBe(true);
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.get(".confirm-dialog-linked-worktrees").text()).toContain("1 件");
  });

  it("チェックを入れて確定すると true を渡す", async () => {
    setUpAutoGroup();
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "workspace", id: "w1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.findAll("button")[1]!.trigger("click");
    expect(actions.confirmClose).toHaveBeenCalledWith(true);
  });

  it("チェックを入れないまま確定すると false を渡す", async () => {
    setUpAutoGroup();
    const view = useViewStore(pinia);
    const actions = makeActions();
    const wrapper = mountDialog(actions);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "workspace", id: "w1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.findAll("button")[1]!.trigger("click");
    expect(actions.confirmClose).toHaveBeenCalledWith(false);
  });

  it("対象が worktree 自動グループの本体でなければチェックボックスを出さない", async () => {
    setUpAutoGroup();
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    // w2（linked worktree 自身）を閉じる場合は対象外。
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "workspace", id: "w2" }] });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
  });

  it("対象が複数（pane と workspace の混在等）ならチェックボックスを出さない", async () => {
    setUpAutoGroup();
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({
      kind: "confirmClose",
      targets: [
        { type: "workspace", id: "w1" },
        { type: "pane", id: "p1" },
      ],
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
  });

  it("開き直すたびにチェック状態を既定オフへ戻す", async () => {
    setUpAutoGroup();
    const view = useViewStore(pinia);
    const wrapper = mountDialog(makeActions());
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "workspace", id: "w1" }] });
    await wrapper.vm.$nextTick();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    view.closeDialog();
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "workspace", id: "w1" }] });
    await wrapper.vm.$nextTick();
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false);
  });
});
