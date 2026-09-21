import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationControllerKey } from "../injection.js";
import type { NotificationController } from "../notify/NotificationController.js";
import type { DesktopPermission } from "../notify/ports.js";
import { useNotificationsStore } from "../store/notifications.js";
import { useViewStore } from "../store/view.js";
import NotificationSettingsDialog from "./NotificationSettingsDialog.vue";

let pinia: Pinia;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  // `happy-dom` の `<dialog>` は showModal/close を持たない場合があるので、必要な面だけ生やす。
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
});
afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

function makeController(opts: { permission?: DesktopPermission; requestResult?: DesktopPermission } = {}) {
  // **実物の `Notification.permission` は外で変わる**（利用者が許可する／ブラウザの設定を変える）。
  // 常に同じ値を返す偽物にすると、「許可を取っても画面が追従しない」穴が見えなくなる。
  let permission: DesktopPermission = opts.permission ?? "granted";
  const requestDesktopPermission = vi.fn(async () => {
    permission = opts.requestResult ?? "granted";
    return permission;
  });
  const unlockSound = vi.fn();
  const c = {
    desktopPermission: () => permission,
    requestDesktopPermission,
    unlockSound,
  } as unknown as NotificationController;
  return { c, requestDesktopPermission, unlockSound, setPermission: (p: DesktopPermission) => void (permission = p) };
}

async function openDialog(controller = makeController()) {
  const view = useViewStore(pinia);
  const wrapper = mount(NotificationSettingsDialog, {
    global: { plugins: [pinia], provide: { [NotificationControllerKey as symbol]: controller.c } },
    attachTo: document.body,
  });
  view.openDialogWithContext({ kind: "notifySettings" });
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
  return { wrapper, view, controller };
}

const switches = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.findAll('[role="switch"]');

describe("NotificationSettingsDialog — 切り替え（AC6・AC-I2）", () => {
  // **decisions D2**：APG の switch は「on/off を表し、操作が即座に効く」もの。確定ボタンを置かない。
  it("3 つの切り替えを role=switch で出し、いまの値を aria-checked で示す", async () => {
    const { wrapper } = await openDialog();
    const sw = switches(wrapper);
    expect(sw).toHaveLength(3);
    expect(sw.map((s) => s.attributes("aria-checked"))).toEqual(["true", "false", "false"]); // 既定
    expect(sw.map((s) => s.element.tagName), "Tab で辿れる <button>").toEqual(["BUTTON", "BUTTON", "BUTTON"]);
  });

  it("押した時点で反映され、保存される（確定ボタンは無い）", async () => {
    const { wrapper } = await openDialog();
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);

    await switches(wrapper)[0]!.trigger("click");
    expect(useNotificationsStore(pinia).prefs.toast).toBe(false);
    expect(useNotificationsStore(createPinia()).prefs.toast, "再読み込みしても残る").toBe(false);
  });

  it("もう一度押すと戻る", async () => {
    const { wrapper } = await openDialog();
    await switches(wrapper)[2]!.trigger("click");
    expect(useNotificationsStore(pinia).prefs.sound).toBe(true);
    await switches(wrapper)[2]!.trigger("click");
    expect(useNotificationsStore(pinia).prefs.sound).toBe(false);
  });
});

// **AC8 と AC12 を取り違えない**——許可が無いだけなのか、環境が対応していないのか。
describe("NotificationSettingsDialog — OS 通知の 4 状態（AC8・AC12）", () => {
  it("granted：普通に切り替えられる", async () => {
    const { wrapper } = await openDialog(makeController({ permission: "granted" }));
    const sw = switches(wrapper)[1]!;
    expect(sw.attributes("disabled")).toBeUndefined();
    await sw.trigger("click");
    expect(useNotificationsStore(pinia).prefs.desktop).toBe(true);
  });

  it("denied：押せなくして理由を出す", async () => {
    const { wrapper } = await openDialog(makeController({ permission: "denied" }));
    expect(switches(wrapper)[1]!.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("ブラウザで拒否されています");
  });

  // **AC7**：ページを開いただけでは求めない。押したときだけ。
  it("default：押すまで許可を求めない。押すと求める", async () => {
    const { wrapper, controller } = await openDialog(makeController({ permission: "default", requestResult: "granted" }));
    expect(controller.requestDesktopPermission, "開いただけでは呼ばない").not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("押すとブラウザに許可を求めます");

    await switches(wrapper)[1]!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(controller.requestDesktopPermission).toHaveBeenCalledOnce();
    expect(useNotificationsStore(pinia).prefs.desktop).toBe(true);
  });

  // **`Notification.permission` は reactive ではない**ので、computed から呼ぶと最初の値で固まる。
  // 固まると、許可を取っても行が「切」のままで、**もう一度押しても切に戻せない**。
  it("許可を取ったら、その場で行が「入」に変わり、もう一度押せば「切」に戻せる", async () => {
    const { wrapper } = await openDialog(makeController({ permission: "default", requestResult: "granted" }));
    await switches(wrapper)[1]!.trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(switches(wrapper)[1]!.attributes("aria-checked"), "許可の後は「入」").toBe("true");
    expect(wrapper.text(), "「押すと求めます」は消える").not.toContain("押すとブラウザに許可を求めます");

    await switches(wrapper)[1]!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(switches(wrapper)[1]!.attributes("aria-checked"), "切に戻せる").toBe("false");
    expect(useNotificationsStore(pinia).prefs.desktop).toBe(false);
  });

  // 外（ブラウザの設定）で変わることもある。開いたときに読み直す。
  it("開き直すと許可の状態を読み直す", async () => {
    const controller = makeController({ permission: "granted" });
    const { wrapper, view } = await openDialog(controller);
    expect(switches(wrapper)[1]!.attributes("disabled")).toBeUndefined();

    view.closeDialog();
    controller.setPermission("denied"); // 利用者がブラウザの設定で取り消した
    view.openDialogWithContext({ kind: "notifySettings" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(switches(wrapper)[1]!.attributes("disabled"), "読み直して押せなくする").toBeDefined();
  });

  it("default で拒否されたら「入」にしない", async () => {
    const { wrapper } = await openDialog(makeController({ permission: "default", requestResult: "denied" }));
    await switches(wrapper)[1]!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(useNotificationsStore(pinia).prefs.desktop).toBe(false);
  });

  it("この環境では使えない（実際に出そうとして失敗した）：押せなくして、その旨を出す", async () => {
    const { wrapper } = await openDialog();
    useNotificationsStore(pinia).desktopUsable = false;
    await wrapper.vm.$nextTick();
    expect(switches(wrapper)[1]!.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("この環境では使えません");
  });

  it("Notification が無い環境も同じ扱いにする（AC12）", async () => {
    const { wrapper } = await openDialog(makeController({ permission: "unsupported" }));
    expect(switches(wrapper)[1]!.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("この環境では使えません");
  });

  // 設定が「入」でも、許可が外れたら「切」に見せる（嘘をつかない）。
  it("設定が「入」でも、許可が無ければ「切」と示す", async () => {
    useNotificationsStore(pinia).setPrefs({ desktop: true });
    const { wrapper } = await openDialog(makeController({ permission: "denied" }));
    expect(switches(wrapper)[1]!.attributes("aria-checked")).toBe("false");
  });
});

describe("NotificationSettingsDialog — 音（AC13）", () => {
  // 自動再生の解除は**利用者の操作の中**でしかできない。「入」にした瞬間がその機会。
  it("「入」にしたら自動再生を解除しにいく", async () => {
    const { wrapper, controller } = await openDialog();
    await switches(wrapper)[2]!.trigger("click");
    expect(controller.unlockSound).toHaveBeenCalledOnce();
  });

  it("「切」にするときは解除しにいかない", async () => {
    useNotificationsStore(pinia).setPrefs({ sound: true });
    const { wrapper, controller } = await openDialog();
    await switches(wrapper)[2]!.trigger("click");
    expect(controller.unlockSound).not.toHaveBeenCalled();
  });

  // review ラウンド1：「この環境では鳴らせない」と「この画面をまだ操作していない」は別の話。
  // 畳むと、**永久に鳴らない設定を利用者が「入」だと思い続ける**。
  it("音を鳴らせない環境では押せなくして、その旨を出す", async () => {
    useNotificationsStore(pinia).setPrefs({ sound: true });
    const { wrapper } = await openDialog();
    useNotificationsStore(pinia).soundUsable = false;
    await wrapper.vm.$nextTick();

    const sound = switches(wrapper)[2]!;
    expect(sound.attributes("disabled")).toBeDefined();
    expect(sound.attributes("aria-checked"), "「入」だと嘘をつかない").toBe("false");
    expect(wrapper.text()).toContain("この環境では音を鳴らせません");
  });

  it("鳴らせなかったときは理由を出す（黙って失敗しない）", async () => {
    const { wrapper } = await openDialog();
    expect(wrapper.text()).not.toContain("鳴らせませんでした");
    useNotificationsStore(pinia).soundBlocked = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("鳴らせませんでした");
  });
});

describe("NotificationSettingsDialog — 開閉とフォーカス（AC-I1・AC-I4）", () => {
  it("Esc で閉じ、設定は保たれる", async () => {
    const { wrapper, view } = await openDialog();
    await switches(wrapper)[0]!.trigger("click");

    await wrapper.get("dialog").trigger("cancel");
    expect(view.dialogContext).toBeNull();
    expect(useNotificationsStore(pinia).prefs.toast, "閉じても押した結果が正典").toBe(false);
  });

  it("背景のクリックでも閉じる", async () => {
    const { wrapper, view } = await openDialog();
    await wrapper.get("dialog").trigger("click");
    expect(view.dialogContext).toBeNull();
  });

  it("開いたら最初の切り替えへフォーカスが移る", async () => {
    const { wrapper } = await openDialog();
    expect(document.activeElement).toBe(switches(wrapper)[0]!.element);
  });

  it("ダイアログに名前が付いている（読み上げで何の設定か分かる）", async () => {
    const { wrapper } = await openDialog();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe("通知の設定");
  });
});
