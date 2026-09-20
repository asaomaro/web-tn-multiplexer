import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useViewStore } from "./view.js";

let pinia: Pinia;

beforeEach(() => {
  sessionStorage.clear();
  pinia = createPinia();
});
afterEach(() => {
  sessionStorage.clear();
});

describe("useViewStore — restoreView", () => {
  it("sessionStorage に前回の tab があり、まだ存在すればそれを使う（その tab の focusedPaneId へフォーカスする）", () => {
    const store = useViewStore(pinia);
    store.setView("w1", "t1");
    const store2 = useViewStore(createPinia()); // 新しいストア（再起動を模する）が同じ sessionStorage を読む
    store2.restoreView(
      () => "p1", // その tab の（サーバ全体で最後にフォーカスされた）pane
      { workspaceId: "w9", tabId: "t9", paneId: "p9" },
    );
    expect(store2.workspaceId).toBe("w1");
    expect(store2.tabId).toBe("t1");
    expect(store2.focusedPaneId).toBe("p1"); // ページ再読み込み後もキーボード操作を再開できる（AC-I3）
  });

  it("前回の tab がもう無ければサーバの focus を使う", () => {
    const store = useViewStore(pinia);
    store.setView("w1", "t1");
    const store2 = useViewStore(createPinia());
    store2.restoreView(
      () => null, // 前回の tab は無い
      { workspaceId: "w2", tabId: "t2", paneId: "p2" },
    );
    expect(store2.workspaceId).toBe("w2");
    expect(store2.tabId).toBe("t2");
    expect(store2.focusedPaneId).toBe("p2");
  });

  it("sessionStorage に何も無く、サーバの focus も無ければ何も設定しない", () => {
    const store = useViewStore(pinia);
    store.restoreView(() => "p1", null);
    expect(store.workspaceId).toBeNull();
    expect(store.tabId).toBeNull();
  });
});

describe("useViewStore — setView / focusPane", () => {
  it("setView は sessionStorage にも保存する", () => {
    const store = useViewStore(pinia);
    store.setView("w1", "t1");
    expect(sessionStorage.getItem("wtm.view.v1")).toBe(JSON.stringify({ workspaceId: "w1", tabId: "t1" }));
  });

  it("focusPane", () => {
    const store = useViewStore(pinia);
    store.focusPane("p1");
    expect(store.focusedPaneId).toBe("p1");
    store.focusPane(null);
    expect(store.focusedPaneId).toBeNull();
  });
});

describe("useViewStore — モード・ダイアログ・接続状態", () => {
  it("onModeChange はモードを反映し、isPrefixWaiting も連動する", () => {
    const store = useViewStore(pinia);
    expect(store.isPrefixWaiting).toBe(false);
    store.onModeChange("prefix");
    expect(store.mode).toBe("prefix");
    expect(store.isPrefixWaiting).toBe(true);
  });

  it("setOpenDialog", () => {
    const store = useViewStore(pinia);
    store.setOpenDialog("help");
    expect(store.openDialog).toBe("help");
    store.setOpenDialog(null);
    expect(store.openDialog).toBeNull();
  });

  it("openDialogWithContext: 開く前の focus を覚え、closeDialog で戻す（AC-I4）", () => {
    const store = useViewStore(pinia);
    store.focusPane("p1");
    store.openDialogWithContext({ kind: "newTab", workspaceId: "w1" });
    expect(store.openDialog).toBe("newTab");
    expect(store.dialogContext).toEqual({ kind: "newTab", workspaceId: "w1" });

    store.focusPane(null); // ダイアログが開いている間はフォーカスが外れている想定
    store.closeDialog();
    expect(store.openDialog).toBeNull();
    expect(store.dialogContext).toBeNull();
    expect(store.focusedPaneId).toBe("p1"); // 開く前の pane に戻る
  });

  it("onConnectionState: 'open' になると authRequired を解除する", () => {
    const store = useViewStore(pinia);
    store.onAuthRequired();
    expect(store.authRequired).toBe(true);
    store.onConnectionState("connecting");
    expect(store.authRequired).toBe(true); // まだ解除しない
    store.onConnectionState("open");
    expect(store.connectionState).toBe("open");
    expect(store.authRequired).toBe(false);
  });

  it("onConnectionState: 'rejected'（/api/session が 403＝Cookie は有効）も authRequired を解除する（D107：ログイン画面の「接続中…」のまま止めない）", () => {
    const store = useViewStore(pinia);
    store.onAuthRequired();
    store.onConnectionState("connecting");
    store.onConnectionState("rejected");
    expect(store.connectionState).toBe("rejected");
    expect(store.authRequired).toBe(false);
  });

  it("setOriginRejectSuspected：繋ぎ直しの手がかり（D107）を立てる・下ろす", () => {
    const store = useViewStore(pinia);
    expect(store.originRejectSuspected).toBe(false);
    store.setOriginRejectSuspected(true);
    expect(store.originRejectSuspected).toBe(true);
    store.setOriginRejectSuspected(false);
    expect(store.originRejectSuspected).toBe(false);
  });

  it("onAuthRequired は呼ばれるたびに authRequiredCount を増やす（authRequired が既に true でも。D105：ログイン画面の接続待ちを戻す合図）", () => {
    const store = useViewStore(pinia);
    expect(store.authRequiredCount).toBe(0);
    store.onAuthRequired();
    store.onAuthRequired();
    expect(store.authRequired).toBe(true);
    expect(store.authRequiredCount).toBe(2);
  });

  it("toggleSidebar", () => {
    const store = useViewStore(pinia);
    expect(store.sidebarCollapsed).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarCollapsed).toBe(true);
    store.toggleSidebar();
    expect(store.sidebarCollapsed).toBe(false);
  });
});

describe("useViewStore — toast", () => {
  it("toast は追加され、dismissToast で消える", () => {
    const store = useViewStore(pinia);
    const id = store.toast("コピーしました");
    expect(store.toasts).toEqual([{ id, message: "コピーしました" }]);
    store.dismissToast(id);
    expect(store.toasts).toEqual([]);
  });

  it("複数のトーストを保持できる", () => {
    const store = useViewStore(pinia);
    store.toast("1つ目");
    store.toast("2つ目");
    expect(store.toasts.map((t) => t.message)).toEqual(["1つ目", "2つ目"]);
  });
});
