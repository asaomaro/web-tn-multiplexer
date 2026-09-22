import { THEME_NAMES } from "@wtm/protocol";
import { mount } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceKindKey, NotificationControllerKey } from "../injection.js";
import type { NotificationController } from "../notify/NotificationController.js";
import type { DesktopPermission } from "../notify/ports.js";
import { useNotificationsStore } from "../store/notifications.js";
import { useSessionStore } from "../store/session.js";
import { useSettingsStore } from "../store/settings.js";
import { readPrefs, useViewStore } from "../store/view.js";
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
// 20260921-herdr-settings-gaps：通知だけのダイアログを、見出しで節に分けた「設定」に広げた（20260921-theme-settings で「テーマ」を足して 4 節）。

const radios = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.findAll('input[type="radio"][name="settings-scrollback"]');
const checkedRadio = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
  radios(w).filter((r) => (r.element as HTMLInputElement).checked);
const radioLabel = (r: ReturnType<typeof radios>[number]) => r.element.parentElement!.textContent!.trim();

describe("SettingsDialog — 5 つの節（AC12）", () => {
  it("見出し「通知」「テーマ」「表示」「端末」「キー」の 5 節が、この順で 1 枚に並ぶ（テーマは 20260921-theme-settings、キーは 20260921-keybinding-customization で足した）", async () => {
    const { wrapper } = await openDialog();
    expect(wrapper.findAll("section h3").map((h) => h.text())).toEqual(["通知", "テーマ", "表示", "端末", "キー"]);
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

// 20260922-appearance-settings-rest T5（design「振る舞いの詳細」US4）。
describe("SettingsDialog — 表示の節 — pane の枠・隙間の太さ／エージェント名表示（AC9〜AC12・AC-I1〜AC-I4）", () => {
  const displaySection = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    w.get('section[aria-labelledby="settings-display"]');
  const frameRadios = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    displaySection(w).findAll('input[type="radio"][name="settings-pane-frame-thickness"]');
  const checkedFrameRadio = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    frameRadios(w).filter((r) => (r.element as HTMLInputElement).checked);
  const radioValue = (r: ReturnType<typeof frameRadios>[number]): string => (r.element as HTMLInputElement).value;
  // 表示の節の switch は2つ（記号表示・エージェント名表示）。**並び順（何番目か）には頼らない**
  // ——`symbolsSwitch`（先頭固定）と違い、この節は switch が今回 1→2 に増えた実績があり、今後も
  // 増えうる。並び替え・追加があっても無言で違うボタンを拾わないよう、文言で絞る（taskcheck の指摘）。
  const agentNameSwitch = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    displaySection(w)
      .findAll('[role="switch"]')
      .find((sw) => sw.text().includes("エージェント名"))!;

  it("枠の太さは既定で選ばれ、選ぶと保存されて再読み込みしても残る（AC9）", async () => {
    const { wrapper } = await openDialog();
    expect(checkedFrameRadio(wrapper).map(radioValue)).toEqual(["default"]);

    const thick = frameRadios(wrapper).find((r) => radioValue(r) === "thick")!;
    await thick.trigger("change");
    expect(useSettingsStore(pinia).paneFrameThickness).toBe("thick");
    expect(readPrefs()["paneFrameThickness"]).toBe("thick");
    expect(useSettingsStore(createPinia()).paneFrameThickness, "再読み込みしても残る").toBe("thick");
    await wrapper.vm.$nextTick();
    expect(checkedFrameRadio(wrapper).map(radioValue)).toEqual(["thick"]); // 常にちょうど1つ
  });

  it("エージェント名表示の switch は既定で「切」（AC10）", async () => {
    const { wrapper } = await openDialog();
    expect(agentNameSwitch(wrapper).attributes("aria-checked")).toBe("false");
  });

  it("押すと「入」になって保存され、もう一度押すと戻る（確定ボタンは無い。AC-I2）", async () => {
    const { wrapper } = await openDialog();
    await agentNameSwitch(wrapper).trigger("click");
    expect(useSettingsStore(pinia).paneAgentNameVisible).toBe(true);
    expect(agentNameSwitch(wrapper).attributes("aria-checked")).toBe("true");
    expect(useSettingsStore(createPinia()).paneAgentNameVisible, "再読み込みしても残る").toBe(true);
    await agentNameSwitch(wrapper).trigger("click");
    expect(useSettingsStore(pinia).paneAgentNameVisible).toBe(false);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
  });

  it("枠の太さ・エージェント名表示のどちらも、開閉の概念を持たない常設の部品（AC-I1）", async () => {
    const { wrapper } = await openDialog();
    // ダイアログの外の状態（`view.openDialog` 等）を変えずに、いつでも存在・操作できる
    // （個別の開閉フラグや別ダイアログを持たない）ことを、部品が最初から見えていることで確かめる。
    expect(frameRadios(wrapper).length).toBeGreaterThan(0);
    expect(agentNameSwitch(wrapper).exists()).toBe(true);
  });

  it("選んでもフォーカスは選んだ部品に留まる（AC-I4）", async () => {
    const { wrapper } = await openDialog();
    const thick = frameRadios(wrapper).find((r) => radioValue(r) === "thick")!;
    (thick.element as HTMLInputElement).focus();
    await thick.trigger("change");
    expect(document.activeElement).toBe(thick.element);

    const sw = agentNameSwitch(wrapper);
    (sw.element as HTMLButtonElement).focus();
    await sw.trigger("click");
    expect(document.activeElement).toBe(sw.element);
  });

  it("矢印キー（radio）・Enter/Space（switch）という既存の操作方法で操作できる（AC-I3）", async () => {
    const { wrapper } = await openDialog();
    // ネイティブの radio/button の既定の操作方法をそのまま使っているだけ（独自の keydown 処理を
    // 足していない）ことを、type 属性・role 属性の実物で確かめる（実際のキー操作は jsdom/happy-dom
    // ではネイティブのフォーカス移動・活性化を再現しないため、E2E 側で実際の Tab/Enter を確かめる）。
    for (const r of frameRadios(wrapper)) expect(r.attributes("type")).toBe("radio");
    expect(agentNameSwitch(wrapper).element.tagName).toBe("BUTTON");
    expect(agentNameSwitch(wrapper).attributes("type")).toBe("button");
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

// 新しく開く場所（20260921-new-terminal-cwd の design D8）。
describe("SettingsDialog — 端末の節 — 新しく開く場所（AC4・AC10・AC-I1・AC-I2）", () => {
  const cwdRadios = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    w.findAll('input[type="radio"][name="settings-new-cwd"]');
  const checkedCwd = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    cwdRadios(w)
      .filter((r) => (r.element as HTMLInputElement).checked)
      .map(radioLabel);
  const pathField = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) =>
    w.get<HTMLInputElement>('input[type="text"][aria-label="指定した場所のパス"]');

  it("端末の節に 4 つの方針が並び、既定は「引き継ぐ」（AC4）", async () => {
    const { wrapper } = await openDialog();
    const section = wrapper.get('section[aria-labelledby="settings-terminal"]');
    expect(section.findAll('input[name="settings-new-cwd"]')).toHaveLength(4);
    expect(cwdRadios(wrapper).map(radioLabel)).toEqual([
      "引き継ぐ（いま見ている pane の場所）",
      "ホーム",
      "サーバを起動した場所",
      "指定した場所",
    ]);
    expect(checkedCwd(wrapper)).toEqual(["引き継ぐ（いま見ている pane の場所）"]);
  });

  it("方針は選んだ時点で保存され、その行が選ばれる（確定ボタンは無い）", async () => {
    const { wrapper } = await openDialog();
    await cwdRadios(wrapper)[1]!.trigger("change");
    expect(useSettingsStore(pinia).newCwdPolicy).toBe("home");
    expect(useSettingsStore(createPinia()).newCwdPolicy, "再読み込みしても残る").toBe("home");
    expect(checkedCwd(wrapper)).toEqual(["ホーム"]);
  });

  it("パスの入力欄は「指定した場所」を選んでいる間だけ使える", async () => {
    const { wrapper } = await openDialog();
    expect(pathField(wrapper).element.disabled).toBe(true);
    await cwdRadios(wrapper)[3]!.trigger("change");
    expect(pathField(wrapper).element.disabled).toBe(false);
    await cwdRadios(wrapper)[2]!.trigger("change");
    expect(pathField(wrapper).element.disabled).toBe(true);
  });

  /** 打つ（`input` だけを起こす）。`setValue` は `change` も起こすので、打っている途中の再現には使わない。 */
  async function typeInto(field: ReturnType<typeof pathField>, value: string): Promise<void> {
    field.element.value = value;
    await field.trigger("input");
  }

  // AC-I2：打ちかけの途中の値で開いてしまわない。
  it("パスは打っている途中（input・Enter 以外のキー）では保存せず、入れ終えたとき（change）に保存する", async () => {
    useSettingsStore(pinia).setNewCwdPolicy("path");
    const { wrapper } = await openDialog();
    const field = pathField(wrapper);
    await typeInto(field, "~/wo");
    await field.trigger("keydown", { key: "o" });
    expect(useSettingsStore(pinia).newCwdPath, "打っている途中").toBe("");
    await typeInto(field, "~/work");
    await field.trigger("change");
    expect(useSettingsStore(pinia).newCwdPath).toBe("~/work");
    expect(useSettingsStore(createPinia()).newCwdPath, "再読み込みしても残る").toBe("~/work");
  });

  it("Enter でも保存する。ただし IME の変換を確定する Enter では保存しない", async () => {
    useSettingsStore(pinia).setNewCwdPolicy("path");
    const { wrapper } = await openDialog();
    const field = pathField(wrapper);
    await typeInto(field, "~/ドキュメント");
    await field.trigger("keydown", { key: "Enter", isComposing: true });
    await field.trigger("keydown", { key: "Enter", keyCode: 229 }); // Safari は確定の keydown で isComposing が false
    expect(useSettingsStore(pinia).newCwdPath, "変換の確定では保存しない").toBe("");
    await field.trigger("keydown", { key: "Enter" });
    expect(useSettingsStore(pinia).newCwdPath).toBe("~/ドキュメント");
  });

  it("同じ値なら保存し直さない", async () => {
    const store = useSettingsStore(pinia);
    store.setNewCwdPolicy("path");
    store.setNewCwdPath("~/same");
    const saved: unknown[] = [];
    store.$onAction(({ name, args }) => {
      if (name === "setNewCwdPath") saved.push(args[0]);
    });
    const { wrapper } = await openDialog();
    await pathField(wrapper).trigger("change");
    await pathField(wrapper).trigger("keydown", { key: "Enter" });
    expect(saved).toEqual([]);
  });

  // 閉じる操作は取り消しではない（design D8 の「離れたとき」。decisions D8）。Chromium は閉じてフォーカスが外れると `change` を立てるが、
  // happy-dom は立てないので、ここで通るのは閉じる側で確定しているから。
  it.each([
    ["Esc", (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.get("dialog").trigger("cancel")],
    ["閉じる", (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.findAll("button").find((b) => b.text() === "閉じる")!.trigger("click")],
    ["背景", (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.get("dialog").trigger("click")],
  ])("打ちかけのまま閉じても（%s）、入れた値は保存される（AC-I1）", async (_label, close) => {
    useSettingsStore(pinia).setNewCwdPolicy("path");
    useSettingsStore(pinia).setNewCwdPath("~/saved");
    const { wrapper, view } = await openDialog();
    await typeInto(pathField(wrapper), "~/typed");
    await close(wrapper);
    expect(view.dialogContext).toBeNull();
    expect(useSettingsStore(pinia).newCwdPath).toBe("~/typed");
  });

  // 開いている間にほかの状態で描き直されても、打ちかけの文字を保存値で上書きしない（`:value` の一方向の結び付けだと上書きされる）。
  it("開いている間に描き直されても、打ちかけの文字は消えない", async () => {
    useSettingsStore(pinia).setNewCwdPolicy("path");
    useSettingsStore(pinia).setNewCwdPath("~/saved");
    const { wrapper } = await openDialog();
    await typeInto(pathField(wrapper), "~/half");
    useNotificationsStore(pinia).soundBlocked = true; // 通知の節の注記が変わる＝ダイアログが描き直される
    await wrapper.vm.$nextTick();
    expect(pathField(wrapper).element.value).toBe("~/half");
  });

  it("開き直すと、入力欄は保存した値から始まる", async () => {
    useSettingsStore(pinia).setNewCwdPolicy("path");
    const { wrapper, view } = await openDialog();
    await typeInto(pathField(wrapper), "~/one");
    await wrapper.get("dialog").trigger("cancel");
    useSettingsStore(pinia).setNewCwdPath("~/changed-elsewhere");
    view.openDialogWithContext({ kind: "settings" });
    await wrapper.vm.$nextTick();
    expect(pathField(wrapper).element.value).toBe("~/changed-elsewhere");
  });

  it("入力欄に名前と注記が付いている（読み上げでパスの欄と分かる）", async () => {
    const { wrapper } = await openDialog();
    const field = pathField(wrapper);
    const noteId = field.attributes("aria-describedby")!;
    expect(wrapper.get(`#${noteId}`).text()).toContain("絶対パスか ~/ で始まるパス");
  });

  it("閉じても選んだ方針と入れたパスは残る（AC-I1）", async () => {
    const { wrapper, view } = await openDialog();
    await cwdRadios(wrapper)[3]!.trigger("change");
    await typeInto(pathField(wrapper), "~/p");
    await pathField(wrapper).trigger("change");
    await wrapper.findAll("button").find((b) => b.text() === "閉じる")!.trigger("click");
    expect(view.dialogContext).toBeNull();
    expect(useSettingsStore(pinia).newCwdPolicy).toBe("path");
    expect(useSettingsStore(pinia).newCwdPath).toBe("~/p");
  });
});

// 20260921-theme-settings：テーマの節（design D4・decisions D11。AC1・AC5〜AC7・AC-I2・AC-I4）。
describe("SettingsDialog — テーマの節", () => {
  const themeSection = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.get('section[aria-labelledby="settings-theme"]');
  const selects = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => themeSection(w).findAll("select");

  it("「テーマ」の選択肢は 17 個（暗い 10・明るい 7 の 2 群）で、dracula に「（既定）」。いまの値が選ばれている", async () => {
    const { wrapper } = await openDialog();
    const [main] = selects(wrapper);
    const groups = main!.findAll("optgroup");
    expect(groups.map((g) => g.attributes("label"))).toEqual(["暗いテーマ", "明るいテーマ"]);
    expect(groups.map((g) => g.findAll("option").length)).toEqual([10, 7]);
    expect(main!.findAll("option").map((o) => o.attributes("value")).sort()).toEqual([...THEME_NAMES].sort());
    expect(main!.find('option[value="dracula"]').text()).toBe("Dracula（既定）");
    expect((main!.element as HTMLSelectElement).value).toBe("dracula");
    // 自動の切替が切の間は、明るいとき・暗いときの欄は出さない。
    expect(selects(wrapper)).toHaveLength(1);
    expect(themeSection(wrapper).get("#settings-theme-note").text()).toBe("いま使っているテーマ：Dracula");
  });

  it("選んだ時点で反映・保存し（確定ボタンは無い）、フォーカスは選んだ部品に残る（AC-I2・AC-I4）", async () => {
    const { wrapper } = await openDialog();
    const settings = useSettingsStore(pinia);
    const main = selects(wrapper)[0]!;
    (main.element as HTMLSelectElement).focus();
    await main.setValue("gruvbox-light");
    expect(settings.theme).toBe("gruvbox-light");
    expect(readPrefs()["theme"]).toBe("gruvbox-light");
    expect(document.activeElement).toBe(main.element);
    expect(themeSection(wrapper).get("#settings-theme-note").text()).toBe("いま使っているテーマ：Gruvbox Light");
  });

  it("「OS の明暗に合わせる」を入れると明るいとき・暗いときが出て、既定は 1 つのテーマの対（AC5・AC6・AC7）", async () => {
    const { wrapper } = await openDialog();
    const settings = useSettingsStore(pinia);
    settings.setTheme("tokyo-night");
    await wrapper.vm.$nextTick();
    const sw = themeSection(wrapper).get('[role="switch"]');
    expect(sw.attributes("aria-checked")).toBe("false");
    await sw.trigger("click");
    expect(settings.themeAuto).toBe(true);
    expect(sw.attributes("aria-checked")).toBe("true");
    const [, light, dark] = selects(wrapper);
    expect(light!.find('option[value=""]').text()).toBe("既定（Tokyo Night Day）");
    expect(dark!.find('option[value=""]').text()).toBe("既定（Tokyo Night）");
    expect((light!.element as HTMLSelectElement).value).toBe("");
    // 明るいとき・暗いときは 17 のどれからでも選べる（明るいときに暗いテーマも）。
    expect(light!.findAll("option[value]").filter((o) => o.attributes("value") !== "")).toHaveLength(17);
    settings.systemDark = false;
    await wrapper.vm.$nextTick();
    expect(themeSection(wrapper).get("#settings-theme-note").text()).toBe("いま使っているテーマ：Tokyo Night Day（OS の設定が明るいため）");
    expect(themeSection(wrapper).text()).toContain("「テーマ」でほかのテーマを選ぶと、合わせるのをやめてそのテーマにします");
  });

  it("明るいとき・暗いときを選ぶと保存し、「既定」を選ぶと null に戻る。自動の切替中に 1 つのテーマを選ぶと切れる（AC6・AC7）", async () => {
    const { wrapper } = await openDialog();
    const settings = useSettingsStore(pinia);
    await themeSection(wrapper).get('[role="switch"]').trigger("click");
    const [, light, dark] = selects(wrapper);
    await light!.setValue("one-light");
    expect(settings.themeLight).toBe("one-light");
    expect(readPrefs()["themeLight"]).toBe("one-light");
    await dark!.setValue("vesper");
    expect(settings.themeDark).toBe("vesper");
    await light!.setValue("");
    expect(settings.themeLight).toBeNull();
    expect(readPrefs()["themeLight"]).toBeNull();
    await selects(wrapper)[0]!.setValue("nord");
    expect(settings.theme).toBe("nord");
    expect(settings.themeAuto).toBe(false);
    await wrapper.vm.$nextTick();
    expect(selects(wrapper)).toHaveLength(1);
  });
});

describe("SettingsDialog — テーマの節（名前付けと値の束縛）", () => {
  const themeSection = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => w.get('section[aria-labelledby="settings-theme"]');
  const selects = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]) => themeSection(w).findAll("select");

  it("3 つの選択肢は <label> で名前が付き、「テーマ」は自動の切替の注記といまのテーマの注記に結び付く", async () => {
    const { wrapper } = await openDialog();
    const settings = useSettingsStore(pinia);
    settings.setThemeAuto(true);
    await wrapper.vm.$nextTick();
    const names = selects(wrapper).map((sel) => sel.element.closest("label")?.querySelector("span")?.textContent);
    expect(names).toEqual(["テーマ", "明るいとき", "暗いとき"]);
    const describedBy = selects(wrapper)[0]!.attributes("aria-describedby")!.split(" ");
    expect(describedBy).toEqual(["settings-theme-auto-note", "settings-theme-note"]);
    for (const id of describedBy) expect(themeSection(wrapper).find(`#${id}`).exists(), id).toBe(true);
    expect(themeSection(wrapper).get("#settings-theme-note").attributes("aria-live")).toBe("polite");
  });

  it("自動の切替の注記と欄は切り替えの下に出る（押した切り替えの位置がずれない）。押してもフォーカスは切り替えに残る", async () => {
    const { wrapper } = await openDialog();
    const sw = themeSection(wrapper).get('[role="switch"]');
    (sw.element as HTMLButtonElement).focus();
    await sw.trigger("click");
    const note = themeSection(wrapper).get("#settings-theme-auto-note");
    // 切り替えより後ろ（DOM の順）にある。
    expect(sw.element.compareDocumentPosition(note.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(sw.element);
  });

  it("明るいとき・暗いときの選ばれた値は store に追従する（保存値・null に戻したとき）", async () => {
    const { wrapper } = await openDialog();
    const settings = useSettingsStore(pinia);
    settings.setThemeLight("one-light");
    settings.setThemeDark("vesper");
    settings.setThemeAuto(true);
    await wrapper.vm.$nextTick();
    const [, light, dark] = selects(wrapper);
    expect((light!.element as HTMLSelectElement).value).toBe("one-light");
    expect((dark!.element as HTMLSelectElement).value).toBe("vesper");
    settings.setThemeLight(null);
    await wrapper.vm.$nextTick();
    expect((light!.element as HTMLSelectElement).value).toBe("");
  });
});

// 20260921-keybinding-customization：節「キー」の取り込み待ちの間は、ネイティブの cancel（Esc）で設定画面を閉じない（AC-I5）。
describe("SettingsDialog — 節「キー」の取り込み待ちと Esc（AC-I1・AC-I5）", () => {
  const nativeCancel = (w: Awaited<ReturnType<typeof openDialog>>["wrapper"]): Event => {
    const ev = new Event("cancel", { cancelable: true });
    w.find("dialog").element.dispatchEvent(ev);
    return ev;
  };

  it("取り込み待ちの間にネイティブの cancel が来ても、設定画面を閉じない。取り込みを終えれば、いつもどおり閉じる", async () => {
    const { wrapper, view } = await openDialog();
    await wrapper.find("[data-prefix-change]").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".keys-capture").exists()).toBe(true);
    const ev = nativeCancel(wrapper);
    await wrapper.vm.$nextTick();
    expect(ev.defaultPrevented).toBe(true); // 既定の close は止める
    expect(view.openDialog).toBe("settings"); // 閉じない
    expect(wrapper.find(".keys-capture").exists()).toBe(true); // 取り込み待ちのまま（Esc の取り消しは取り込みの部品の keydown が受ける）

    // Esc の keydown で取り込みを取り消したあとは、cancel でいつもどおり閉じる
    await wrapper.find(".keys-capture").trigger("keydown", { key: "Escape" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".keys-capture").exists()).toBe(false);
    expect(view.openDialog).toBe("settings"); // Esc 1 回で閉じない
    await new Promise((resolve) => setTimeout(resolve, 0)); // 利用者が次に押した Esc（次のタスク）
    nativeCancel(wrapper);
    await wrapper.vm.$nextTick();
    expect(view.openDialog).toBeNull();
  });

  it("Esc の keydown で取り込みを取り消した直後に cancel が来ても（Firefox・Safari で起きうる順序）、設定画面は閉じない", async () => {
    const { wrapper, view } = await openDialog();
    await wrapper.find("[data-prefix-change]").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await wrapper.find(".keys-capture").trigger("keydown", { key: "Escape" });
    const ev = nativeCancel(wrapper); // 同じタスクの中で、keydown の既定動作として来る
    await wrapper.vm.$nextTick();
    expect(ev.defaultPrevented).toBe(true);
    expect(view.openDialog).toBe("settings"); // 閉じない
    // 次のタスク以降（利用者が次に押した Esc）は、いつもどおり閉じる
    await new Promise((resolve) => setTimeout(resolve, 0));
    nativeCancel(wrapper);
    await wrapper.vm.$nextTick();
    expect(view.openDialog).toBeNull();
  });

  it("取り込み待ちでなければ、cancel（Esc）で閉じる（既存の挙動）", async () => {
    const { wrapper, view } = await openDialog();
    nativeCancel(wrapper);
    await wrapper.vm.$nextTick();
    expect(view.openDialog).toBeNull();
  });
});

// 20260921-keybinding-customization：設定画面から節「キー」へ端末の種類が渡る（D11。`:kind="kind"` の結線）。
describe("SettingsDialog — 節「キー」への端末の種類（モバイルの一言）", () => {
  it("モバイルのときだけ、節「キー」に画面のキーボードでは取り込めない旨の一言が出る", async () => {
    const mobile = await openDialog(makeController(), "mobile");
    expect(mobile.wrapper.find(".keys-mobile-note").exists()).toBe(true);
    expect(mobile.wrapper.find(".keys-mobile-note").text()).toContain("画面のキーボードでは割り当てを取り込めません");
    mobile.wrapper.unmount();
    document.body.innerHTML = "";
    const desktop = await openDialog();
    expect(desktop.wrapper.find(".keys-mobile-note").exists()).toBe(false);
  });
});
