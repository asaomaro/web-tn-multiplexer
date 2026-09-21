import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceKindKey, NotificationControllerKey } from "../injection.js";
import type { NotificationController } from "../notify/NotificationController.js";
import type { DesktopPermission } from "../notify/ports.js";
import { useNotificationsStore } from "../store/notifications.js";
import { useSessionStore } from "../store/session.js";
import { useSettingsStore } from "../store/settings.js";
import { useViewStore } from "../store/view.js";
import SettingsDialog from "./SettingsDialog.vue";

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

async function openDialog(controller = makeController(), kind?: "desktop" | "mobile") {
  const view = useViewStore(pinia);
  // `DeviceKindKey` は既定値つきで受ける（provide しなければ "desktop"）。モバイルのテストだけ渡す。
  const provide: Record<symbol, unknown> = { [NotificationControllerKey as symbol]: controller.c };
  if (kind) provide[DeviceKindKey as symbol] = kind;
  const wrapper = mount(SettingsDialog, {
    global: { plugins: [pinia], provide },
    attachTo: document.body,
  });
  view.openDialogWithContext({ kind: "settings" });
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
  return { wrapper, view, controller };
}

const switches = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.findAll('[role="switch"]');
/**
 * 「通知」節の中の switch だけ（20260921-herdr-settings-gaps で表示の節の switch が加わった）。
 * `switches(w)[0..2]` は通知の 3 つのまま（表示の節は後ろにある）なので、個々の操作のテストはそのまま使える。
 */
const notifySwitches = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
  w.findAll('section[aria-labelledby="settings-notify"] [role="switch"]');

describe("SettingsDialog — 通知の節 — 切り替え（AC6・AC-I2）", () => {
  // **decisions D2**：APG の switch は「on/off を表し、操作が即座に効く」もの。確定ボタンを置かない。
  it("3 つの切り替えを role=switch で出し、いまの値を aria-checked で示す", async () => {
    const { wrapper } = await openDialog();
    const sw = notifySwitches(wrapper);
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
describe("SettingsDialog — 通知の節 — OS 通知の 4 状態（AC8・AC12）", () => {
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
    view.openDialogWithContext({ kind: "settings" });
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

describe("SettingsDialog — 通知の節 — 音（AC13）", () => {
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

describe("SettingsDialog — 通知の節 — 開閉とフォーカス（AC-I1・AC-I4）", () => {
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

  // 20260921-herdr-settings-gaps で見出し「設定」を持つようになった。名前は見出しを指す（文字を二重に持たない）。
  it("ダイアログに名前が付いている（読み上げで何の設定か分かる）", async () => {
    const { wrapper } = await openDialog();
    const id = wrapper.get("dialog").attributes("aria-labelledby");
    expect(id).toBe("settings-title");
    expect(wrapper.get(`#${id}`).text()).toBe("設定");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 20260921-herdr-settings-gaps：通知だけのダイアログを、見出しで 3 節（通知・表示・端末）に分けた「設定」に広げた。

const radios = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.findAll('input[type="radio"][name="settings-scrollback"]');
const checkedRadio = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
  radios(w).filter((r) => (r.element as HTMLInputElement).checked);
const radioLabel = (r: ReturnType<typeof radios>[number]) => r.element.parentElement!.textContent!.trim();

describe("SettingsDialog — 3 つの節（AC12）", () => {
  it("見出し「通知」「表示」「端末」の 3 節が、この順で 1 枚に並ぶ", async () => {
    const { wrapper } = await openDialog();
    expect(wrapper.findAll("section h3").map((h) => h.text())).toEqual(["通知", "表示", "端末"]);
    // 節は見出しで名前が付いている（読み上げで節の名前が分かる）。
    for (const sec of wrapper.findAll("section")) {
      const id = sec.attributes("aria-labelledby")!;
      expect(sec.find(`#${id}`).exists(), `${id} の見出しがある`).toBe(true);
    }
  });
});

describe("SettingsDialog — 表示の節（AC6・AC7・AC-I2）", () => {
  const symbolsSwitch = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    w.get('section[aria-labelledby="settings-display"] [role="switch"]');

  it("記号表示の switch は既定で「入」", async () => {
    const { wrapper } = await openDialog();
    expect(symbolsSwitch(wrapper).attributes("aria-checked")).toBe("true");
  });

  it("押すと「切」になって保存され、もう一度押すと戻る（確定ボタンは無い）", async () => {
    const { wrapper } = await openDialog();
    await symbolsSwitch(wrapper).trigger("click");
    expect(useSettingsStore(pinia).statusSymbols).toBe(false);
    expect(symbolsSwitch(wrapper).attributes("aria-checked")).toBe("false");
    expect(useSettingsStore(createPinia()).statusSymbols, "再読み込みしても残る").toBe(false);
    await symbolsSwitch(wrapper).trigger("click");
    expect(useSettingsStore(pinia).statusSymbols).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
  });
});

describe("SettingsDialog — 端末の節（AC9・AC-I2）", () => {
  it("既定は「自動」が選ばれ、デスクトップではサーバの上限の行数を添える", async () => {
    const { wrapper } = await openDialog();
    const checked = checkedRadio(wrapper);
    expect(checked).toHaveLength(1);
    expect(radioLabel(checked[0]!)).toBe("自動（この端末では 5,000 行）");
    // 選択肢はサーバの上限（既定 5,000）以下だけ。
    expect(radios(wrapper).map(radioLabel)).toEqual(["自動（この端末では 5,000 行）", "1,000 行", "2,000 行", "5,000 行"]);
  });

  // モバイルの利用者が「自動＝何行か」を知る手段がほかに無い。
  it("モバイルでは「自動」に 1,000 行と添える", async () => {
    const { wrapper } = await openDialog(makeController(), "mobile");
    expect(radioLabel(checkedRadio(wrapper)[0]!)).toBe("自動（この端末では 1,000 行）");
  });

  // テストの側で `.checked` を入れない——入れると「その行が選ばれる」が自分の入れた状態を読むだけになる。
  // 選ばれて見えるのは部品の `:checked`（保存した値から決まる）であることを見る。
  it("行を選ぶと保存され、その行が選ばれる（確定ボタンは無い）", async () => {
    const { wrapper } = await openDialog();
    await radios(wrapper).find((r) => radioLabel(r) === "2,000 行")!.trigger("change");
    expect(useSettingsStore(pinia).scrollback).toBe(2000);
    expect(useSettingsStore(createPinia()).scrollback, "再読み込みしても残る").toBe(2000);
    expect(checkedRadio(wrapper).map(radioLabel)).toEqual(["2,000 行"]);

    await radios(wrapper)[0]!.trigger("change");
    expect(useSettingsStore(pinia).scrollback).toBe("auto");
    expect(checkedRadio(wrapper).map(radioLabel)).toEqual(["自動（この端末では 5,000 行）"]);
  });

  // 実物の App は起動時にこのダイアログを取り付け（`App.vue`）、そのときの `limits` は既定の 5,000。本当の上限は後から
  // snapshot で届く——**開いた後の変化に追従すること**が本番の道（decisions D5 が computed を選んだ理由）。
  it("取り付けた後にサーバの上限が届くと、「自動」の行数・選択肢・選ばれている行が追従する", async () => {
    useSettingsStore(pinia).setScrollback(10000);
    const { wrapper } = await openDialog();
    expect(checkedRadio(wrapper).map(radioLabel), "上限 5,000 で押さえた行").toEqual(["5,000 行"]);

    useSessionStore(pinia).limits = { scrollbackLines: 10000 };
    await wrapper.vm.$nextTick();
    expect(radios(wrapper).map(radioLabel)).toEqual(["自動（この端末では 10,000 行）", "1,000 行", "2,000 行", "5,000 行", "10,000 行"]);
    expect(checkedRadio(wrapper).map(radioLabel), "上限が上がれば保存値そのものの行").toEqual(["10,000 行"]);
  });

  it("設定の値が外から変わると、選ばれている行も移る", async () => {
    const { wrapper } = await openDialog();
    useSettingsStore(pinia).setScrollback(1000);
    await wrapper.vm.$nextTick();
    expect(checkedRadio(wrapper).map(radioLabel)).toEqual(["1,000 行"]);
  });

  it("サーバの上限を超える値は選択肢に出さない", async () => {
    useSessionStore(pinia).limits = { scrollbackLines: 3000 };
    const { wrapper } = await openDialog();
    expect(radios(wrapper).map(radioLabel)).toEqual(["自動（この端末では 3,000 行）", "1,000 行", "2,000 行", "3,000 行"]);
  });

  // D5：ダイアログでは**いつもちょうど 1 つ**の行が選ばれている。
  it("保存値がサーバの上限を超えていたら、押さえた値（＝上限）の行が選ばれる（保存値は書き換えない）", async () => {
    useSettingsStore(pinia).setScrollback(10000);
    const { wrapper } = await openDialog();
    expect(checkedRadio(wrapper).map(radioLabel)).toEqual(["5,000 行"]);
    expect(useSettingsStore(pinia).scrollback).toBe(10000);
  });

  it("上限以下で段階に無い保存値は、選択肢に足されて選ばれる", async () => {
    useSessionStore(pinia).limits = { scrollbackLines: 10000 };
    useSettingsStore(pinia).setScrollback(3000);
    const { wrapper } = await openDialog();
    expect(checkedRadio(wrapper).map(radioLabel)).toEqual(["3,000 行"]);
  });
});

describe("SettingsDialog — 閉じても押した結果は残る（AC-I1）", () => {
  // モバイルには Esc キーが無く、ダイアログが画面いっぱいだと背景のタップの余地も無い（review ラウンド1）。
  it("「閉じる」で閉じても、押した結果は残る（確定ボタンではない）", async () => {
    const { wrapper, view } = await openDialog();
    await wrapper.get('section[aria-labelledby="settings-display"] [role="switch"]').trigger("click");
    const close = wrapper.findAll("button").find((b) => b.text() === "閉じる")!;
    expect(close.attributes("type")).toBe("button");
    await close.trigger("click");
    expect(view.dialogContext).toBeNull();
    expect(useSettingsStore(pinia).statusSymbols).toBe(false);
  });

  it("背景のクリックで閉じても、表示の節と端末の節の変更は残る", async () => {
    const { wrapper, view } = await openDialog();
    await wrapper.get('section[aria-labelledby="settings-display"] [role="switch"]').trigger("click");
    await radios(wrapper).find((r) => radioLabel(r) === "1,000 行")!.trigger("change");
    await wrapper.get("dialog").trigger("click");
    expect(view.dialogContext).toBeNull();
    expect(useSettingsStore(pinia).statusSymbols).toBe(false);
    expect(useSettingsStore(pinia).scrollback).toBe(1000);
  });
});
