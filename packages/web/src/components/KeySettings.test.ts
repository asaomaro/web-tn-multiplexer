import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { useSettingsStore } from "../store/settings.js";
import { readPrefs, useViewStore } from "../store/view.js";
import KeySettings from "./KeySettings.vue";

let pinia: Pinia;
let wrapper: VueWrapper | null = null;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  localStorage.clear();
  document.body.innerHTML = "";
});

async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
}

async function mountKeys() {
  const view = useViewStore(pinia);
  view.openDialogWithContext({ kind: "settings" });
  const w = mount(KeySettings, { global: { plugins: [pinia] }, attachTo: document.body });
  wrapper = w;
  await settle();
  return { w, view, settings: useSettingsStore(pinia) };
}

function press(el: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

const capture = (): HTMLElement | null => document.querySelector<HTMLElement>(".keys-capture");
const row = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-action="${id}"]`)!;
const summaryText = (id: string): string =>
  row(id).querySelector(".keys-bindings")!.textContent!.trim();
const status = (): string => document.querySelector('[role="status"]')!.textContent!.trim();
const changeBtn = (id: string, binding: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-change="${id}|${binding}"]`)!;
const addBtn = (id: string, via: "prefix" | "direct"): HTMLElement =>
  row(id).querySelector<HTMLElement>(`[data-add="${via}"]`)!;
const deleteBtn = (id: string, binding: string): HTMLElement =>
  Array.from(row(id).querySelectorAll<HTMLElement>("button")).find((b) =>
    b.getAttribute("aria-label")?.endsWith(`の ${binding} を削除`),
  )!;
const prefixBtn = (): HTMLElement => document.querySelector<HTMLElement>("[data-prefix-change]")!;

describe("KeySettings — 一覧（AC1）", () => {
  it("prefix と、3 群 34 個の操作の現在の割り当てが見える（既定は今のキー）。割り当てなしは「なし」", async () => {
    const { settings } = await mountKeys();
    expect(document.querySelector("h3")!.textContent).toBe("キー");
    expect(document.querySelector(".keys-prefix .keys-binding")!.textContent).toBe("ctrl+b");
    expect(
      Array.from(document.querySelectorAll(".keys-group-name")).map((h) => h.textContent),
    ).toEqual(["全体", "workspace / tab", "pane"]);
    expect(document.querySelectorAll(".keys-details")).toHaveLength(34);
    expect(summaryText("split_vertical")).toBe("prefix+v");
    expect(summaryText("switch_tab")).toBe("prefix+1..9");
    expect(summaryText("cycle_pane_previous")).toBe("prefix+shift+tab");
    settings.setKeyBindings("help", []);
    await settle();
    expect(summaryText("help")).toBe("なし");
  });

  it("おすすめの一式の注記：環境で届かないキーがあり、［変更］で付け替える", async () => {
    await mountKeys();
    const note = document.querySelector(".keys-recommended-note")!.textContent!;
    expect(note).toContain("Ctrl+Alt+L");
    expect(note).toContain("AltGr");
    expect(note).toContain("［変更］で付け替えてください");
    // おすすめのボタンから注記へ結ばれている（Tab だけで辿る利用者にも、ボタンの説明として届く）。
    const btn = document.querySelector<HTMLElement>("[data-recommended]")!;
    const id = btn.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)?.textContent).toBe(note);
  });

  it("節は見出しで名前が付いている（読み上げ）。割り当てごとの操作のボタンは、何の操作かが分かる名前を持つ", async () => {
    await mountKeys();
    const sec = document.querySelector("section")!;
    expect(sec.querySelector(`#${sec.getAttribute("aria-labelledby")}`)).not.toBeNull();
    expect(changeBtn("split_vertical", "prefix+v").getAttribute("aria-label")).toBe(
      "「右へ分割」の prefix+v を変更",
    );
    expect(deleteBtn("split_vertical", "prefix+v")).toBeDefined();
    expect(addBtn("goto", "direct").getAttribute("aria-label")).toBe(
      "追加：直接（「goto（workspace・tab・pane から探す）」）",
    );
  });
});

describe("KeySettings — prefix の変更（AC3・AC-I1〜I5）", () => {
  it("［変更］で取り込み待ちに入り、フォーカスが取り込みの部品へ移る。押したキーで確定し、フォーカスは［変更］へ戻る", async () => {
    const { w, settings } = await mountKeys();
    prefixBtn().focus();
    prefixBtn().click();
    await settle();
    expect(capture()).not.toBeNull();
    expect(document.activeElement).toBe(capture());
    expect(w.emitted("update:capturing")?.[0]).toEqual([true]);

    press(capture()!, "a", { ctrlKey: true });
    await settle();
    expect(settings.keymap.prefix).toBe("ctrl+a");
    expect(document.querySelector(".keys-prefix .keys-binding")!.textContent).toBe("ctrl+a");
    expect(status()).toBe("prefix を ctrl+a にしました。");
    expect(capture()).toBeNull();
    expect(document.activeElement).toBe(prefixBtn());
    expect(w.emitted("update:capturing")?.at(-1)).toEqual([false]);
    expect((readPrefs()["keys"] as { prefix: string }).prefix).toBe("ctrl+a");
  });

  it("送れない形は理由を出して元のまま終わる（AC6・AC-I2）", async () => {
    const { settings } = await mountKeys();
    prefixBtn().click();
    await settle();
    press(capture()!, "a"); // 修飾なし
    await settle();
    expect(settings.keymap.prefix).toBe("ctrl+b");
    expect(status()).toContain("prefix には");
    expect(capture()).toBeNull();
    expect(document.activeElement).toBe(prefixBtn());
  });

  it("いま直接のキーに使われているキーは prefix にできない（持ち主の名前を出す）", async () => {
    const { settings } = await mountKeys();
    settings.setKeyBindings("goto", ["prefix+g", "ctrl+g"]);
    prefixBtn().click();
    await settle();
    press(capture()!, "g", { ctrlKey: true });
    await settle();
    expect(status()).toContain("goto");
    expect(settings.keymap.prefix).toBe("ctrl+b");
  });
});

describe("KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5）", () => {
  it("Esc で取り消し、何も変えない。keydown は preventDefault・stopPropagation される（ダイアログを閉じない）", async () => {
    const { settings } = await mountKeys();
    let leaked = 0;
    document.addEventListener("keydown", () => (leaked += 1));
    prefixBtn().click();
    await settle();
    const ev = press(capture()!, "Escape");
    await settle();
    expect(ev.defaultPrevented).toBe(true);
    expect(leaked).toBe(0); // stopPropagation：親（ダイアログ・window）へ届かない
    expect(settings.keymap.prefix).toBe("ctrl+b");
    expect(status(), "取り消しは理由を出さない（検証で拒否したのではない）").toBe("");
    expect(capture()).toBeNull();
    expect(document.activeElement).toBe(prefixBtn());
  });

  it("Esc で取り消したあと、親へ「取り込み待ちが終わった」と知らせるのは次のタスク（ネイティブの cancel が keydown のあとに来ても閉じないため）", async () => {
    const { w } = await mountKeys();
    prefixBtn().click();
    await settle();
    press(capture()!, "Escape");
    await settle();
    expect(capture()).toBeNull(); // 取り込み待ちの部品は直ちに消える
    expect(w.emitted("update:capturing")?.at(-1), "まだ知らせていない").toEqual([true]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(w.emitted("update:capturing")?.at(-1)).toEqual([false]);
  });

  it("Esc のあと次のタスクの前に別の取り込みが始まったら、遅らせた知らせで新しい取り込み待ちを終わらせない（親には true のまま）", async () => {
    const { w } = await mountKeys();
    prefixBtn().click();
    await settle();
    press(capture()!, "Escape"); // 知らせはタイマー（次のタスク）へ回る
    await settle();
    addBtn("goto", "prefix").click(); // タイマーが動く前に、別の取り込みを始める
    await settle();
    expect(capture()).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 遅らせた知らせが動く
    expect(w.emitted("update:capturing")?.at(-1), "新しい取り込み待ちは続いている").toEqual([true]);
    expect(capture()).not.toBeNull();
  });

  it("取り込み待ちの間に押したキー（確定するキーも）は、どれも親へ漏れず、既定の動作が止まる", async () => {
    await mountKeys();
    let leaked = 0;
    document.addEventListener("keydown", () => (leaked += 1));
    addBtn("goto", "prefix").click();
    await settle();
    const shift = press(capture()!, "Shift", { shiftKey: true });
    const tab = press(capture()!, "y");
    await settle();
    expect(shift.defaultPrevented).toBe(true);
    expect(tab.defaultPrevented).toBe(true);
    expect(leaked).toBe(0);
  });

  it("取り込み待ちでない間は、設定画面の Esc・Tab はそのまま（親へ届く）", async () => {
    await mountKeys();
    let seen = 0;
    document.addEventListener("keydown", () => (seen += 1));
    press(prefixBtn(), "Escape");
    press(prefixBtn(), "Tab");
    expect(seen).toBe(2);
  });

  it("フォーカスを失うと元のまま終わる。**フォーカスは奪い返さない**（利用者が選んだ別の部品のまま）", async () => {
    const { w, settings } = await mountKeys();
    addBtn("goto", "prefix").click();
    await settle();
    const other = addBtn("zoom", "direct");
    other.focus();
    await settle();
    expect(capture()).toBeNull();
    expect(document.activeElement).toBe(other);
    expect(w.emitted("update:capturing")?.at(-1)).toEqual([false]);
    expect(settings.keymap.bindingsOf("goto")).toEqual(["prefix+g"]);
  });

  it.each([
    ["prefix の［変更］", () => prefixBtn()],
    ["割り当ての［変更］", () => changeBtn("split_vertical", "prefix+v")],
    ["［追加］", () => addBtn("goto", "direct")],
  ])(
    "フォーカスを失うと、%s で始めた取り込みも元のまま終わる（親には false。3 つの入口が同じ部品を使う）",
    async (_name, start) => {
      const { w } = await mountKeys();
      start().click();
      await settle();
      expect(capture()).not.toBeNull();
      expect(w.emitted("update:capturing")?.at(-1)).toEqual([true]);
      const other = addBtn("zoom", "prefix");
      other.focus();
      await settle();
      expect(capture()).toBeNull();
      expect(w.emitted("update:capturing")?.at(-1)).toEqual([false]);
      expect(document.activeElement).toBe(other);
    },
  );

  it("設定画面が閉じると、取り込み待ちは元のまま終わる", async () => {
    const { w, view } = await mountKeys();
    prefixBtn().click();
    await settle();
    expect(capture()).not.toBeNull();
    view.closeDialog();
    await settle();
    expect(capture()).toBeNull();
    expect(w.emitted("update:capturing")?.at(-1)).toEqual([false]);
  });

  it("設定画面を閉じると、前回の結果の文も消える（開き直したとき持ち越さない）", async () => {
    const { view } = await mountKeys();
    prefixBtn().click();
    await settle();
    press(capture()!, "a", { ctrlKey: true });
    await settle();
    expect(status()).toBe("prefix を ctrl+a にしました。");
    view.closeDialog();
    await settle();
    expect(status()).toBe("");
  });

  it("取り込み待ちは同時に 1 つだけ（別の［追加］を押すと移る）", async () => {
    await mountKeys();
    addBtn("goto", "prefix").click();
    await settle();
    addBtn("zoom", "direct").click();
    await settle();
    expect(document.querySelectorAll(".keys-capture")).toHaveLength(1);
    expect(row("zoom").querySelector(".keys-capture")).not.toBeNull();
  });
});

describe("KeySettings — 割り当ての追加・変更・削除（AC4・AC-I4）", () => {
  it("［追加：prefix の後］：押したキーで足され、フォーカスは押した［追加］へ戻る", async () => {
    const { settings } = await mountKeys();
    addBtn("goto", "prefix").focus();
    addBtn("goto", "prefix").click();
    await settle();
    press(capture()!, "y");
    await settle();
    expect(settings.keymap.bindingsOf("goto")).toEqual(["prefix+g", "prefix+y"]);
    expect(summaryText("goto")).toBe("prefix+g / prefix+y");
    expect(status()).toBe(
      "「goto（workspace・tab・pane から探す）」に prefix+y を割り当てました。",
    );
    expect(document.activeElement).toBe(addBtn("goto", "prefix"));
  });

  it("［変更］：その割り当てを置き換え、フォーカスは新しい割り当ての［変更］へ移る（chip が作り直されるため）", async () => {
    const { settings } = await mountKeys();
    changeBtn("split_vertical", "prefix+v").click();
    await settle();
    press(capture()!, "|", { shiftKey: true });
    await settle();
    expect(settings.keymap.bindingsOf("split_vertical")).toEqual(["prefix+|"]);
    expect(settings.keymap.prefixMap.has("v")).toBe(false);
    expect(document.activeElement).toBe(changeBtn("split_vertical", "prefix+|"));
  });

  it("［追加：直接］：ctrl+alt の chord を直接のキーとして足す", async () => {
    const { settings } = await mountKeys();
    addBtn("split_vertical", "direct").click();
    await settle();
    press(capture()!, "d", { ctrlKey: true, altKey: true });
    await settle();
    expect(settings.keymap.bindingsOf("split_vertical")).toEqual(["prefix+v", "ctrl+alt+d"]);
    expect(settings.keymap.directMap.get("ctrl+alt+d")).toEqual({ type: "split", dir: "right" });
  });

  it("［削除］：割り当てを外す。フォーカスは同じ行の次の［変更］、無ければ［追加：prefix の後］へ", async () => {
    const { settings } = await mountKeys();
    settings.setKeyBindings("goto", ["prefix+g", "prefix+y", "ctrl+alt+g"]);
    await settle();
    deleteBtn("goto", "prefix+g").click();
    await settle();
    expect(settings.keymap.bindingsOf("goto")).toEqual(["prefix+y", "ctrl+alt+g"]);
    expect(document.activeElement).toBe(changeBtn("goto", "prefix+y")); // 消えた位置の次
    deleteBtn("goto", "ctrl+alt+g").click();
    await settle();
    expect(settings.keymap.bindingsOf("goto")).toEqual(["prefix+y"]);
    expect(document.activeElement).toBe(addBtn("goto", "prefix")); // 最後を消したので、次の部品は無い→［追加：prefix の後］
    deleteBtn("goto", "prefix+y").click();
    await settle();
    expect(settings.keymap.bindingsOf("goto")).toEqual([]);
    expect(summaryText("goto")).toBe("なし");
    expect(document.activeElement).toBe(addBtn("goto", "prefix"));
    expect(status()).toContain("外しました");
  });

  it("外したキーは、別の操作へ割り当てられるようになる", async () => {
    const { settings } = await mountKeys();
    deleteBtn("split_vertical", "prefix+v").click();
    await settle();
    addBtn("goto", "prefix").click();
    await settle();
    press(capture()!, "v");
    await settle();
    expect(settings.keymap.ownerOf("prefix", "v")).toBe("goto");
  });
});

describe("KeySettings — 拒否（AC6・AC-I2）", () => {
  it("(a) すでに別の操作が使っているキーは理由（持ち主の名前）を出して、元のまま終わり、フォーカスは押したボタンへ戻る", async () => {
    const { settings } = await mountKeys();
    addBtn("goto", "prefix").focus();
    addBtn("goto", "prefix").click();
    await settle();
    press(capture()!, "v");
    await settle();
    expect(status()).toContain("右へ分割");
    expect(settings.keymap.bindingsOf("goto")).toEqual(["prefix+g"]);
    expect(capture()).toBeNull();
    expect(document.activeElement).toBe(addBtn("goto", "prefix"));
  });

  it("(d) 直接のキーとして、修飾キーの無い文字は拒否する", async () => {
    const { settings } = await mountKeys();
    addBtn("zoom", "direct").click();
    await settle();
    press(capture()!, "y");
    await settle();
    expect(status()).toContain("直接のキーにできません");
    expect(settings.keymap.bindingsOf("zoom")).toEqual(["prefix+z"]);
  });

  it("修飾キー単体は取り込まず、理由を出して待ち続ける。続けて押した文字で確定する（chord の途中）", async () => {
    const { settings } = await mountKeys();
    addBtn("zoom", "direct").click();
    await settle();
    press(capture()!, "Control", { ctrlKey: true });
    await settle();
    expect(capture()).not.toBeNull();
    expect(status()).toContain("修飾キーだけでは");
    press(capture()!, "Alt", { ctrlKey: true, altKey: true });
    press(capture()!, "y", { ctrlKey: true, altKey: true });
    await settle();
    expect(settings.keymap.bindingsOf("zoom")).toEqual(["prefix+z", "ctrl+alt+y"]);
    expect(capture()).toBeNull();
  });

  it("IME の変換中・押しっぱなしの繰り返しは無視して待ち続ける", async () => {
    await mountKeys();
    addBtn("goto", "prefix").click();
    await settle();
    press(capture()!, "y", { isComposing: true });
    press(capture()!, "y", { repeat: true });
    await settle();
    expect(capture()).not.toBeNull();
  });
});

describe("KeySettings — 範囲 1..9（AC7）", () => {
  it("数字のキー 1 つで、その修飾の組の範囲になる。数字以外は拒否する", async () => {
    const { settings } = await mountKeys();
    addBtn("switch_tab", "prefix").click();
    await settle();
    press(capture()!, "a", { altKey: true });
    await settle();
    expect(status()).toContain("1〜9 の数字");
    addBtn("switch_tab", "prefix").click();
    await settle();
    press(capture()!, "3", { altKey: true });
    await settle();
    expect(settings.keymap.bindingsOf("switch_tab")).toEqual(["prefix+1..9", "prefix+alt+1..9"]);
    expect(settings.keymap.prefixMap.get("alt+7")).toEqual({ type: "tabIndex", index: 7 });
  });
});

describe("KeySettings — キーボードだけで通せる（AC-I3）", () => {
  it("操作の行は <details>（標準の開閉）・操作はどれも <button>（Enter/Space で押せる）・取り込みの部品も <button>", async () => {
    await mountKeys();
    expect(row("goto").tagName).toBe("DETAILS");
    expect(row("goto").querySelector("summary")).not.toBeNull();
    for (const b of Array.from(document.querySelectorAll(".keys-btn, .keys-capture")))
      expect(b.tagName).toBe("BUTTON");
    addBtn("goto", "prefix").click();
    await settle();
    expect(capture()!.tagName).toBe("BUTTON");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T12：既定へ戻す（AC9）・おすすめの直接のキー（AC10）・モバイルの一言（AC1・D11）
// ---------------------------------------------------------------------------------------------------------------------

const resetActionBtn = (id: string): HTMLElement | null =>
  row(id).querySelector<HTMLElement>("[data-reset-action]");
const resetPrefixBtn = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-reset-prefix]");
const resetAllBtn = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-reset-all]");
const recommendedBtn = (): HTMLElement =>
  document.querySelector<HTMLElement>("[data-recommended]")!;
const confirmYes = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-confirm-yes]");
const confirmNo = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-confirm-no]");

describe("KeySettings — 操作ごとの既定へ戻す（AC9）", () => {
  it("［既定に戻す］は上書きしている操作にだけ出る。押すと既定の割り当てへ戻り、フォーカスは［追加：prefix の後］へ", async () => {
    const { settings } = await mountKeys();
    expect(resetActionBtn("zoom")).toBeNull();
    settings.setKeyBindings("zoom", ["prefix+y"]);
    await settle();
    expect(resetActionBtn("zoom")).not.toBeNull();
    expect(resetActionBtn("goto")).toBeNull(); // 他の操作は変わらず出ない
    resetActionBtn("zoom")!.click();
    await settle();
    expect(settings.keymap.bindingsOf("zoom")).toEqual(["prefix+z"]);
    expect(status()).toBe("「拡大表示」を既定へ戻しました。");
    expect(resetActionBtn("zoom")).toBeNull();
    expect(document.activeElement).toBe(addBtn("zoom", "prefix"));
    expect(readPrefs()).not.toHaveProperty("keys");
  });

  it("既定のキーを別の操作が使っていれば、その分は戻さず、持ち主の名前を出す", async () => {
    const { settings } = await mountKeys();
    settings.setKeyBindings("zoom", ["prefix+y"]);
    settings.setKeyBindings("goto", ["prefix+z"]);
    await settle();
    resetActionBtn("zoom")!.click();
    await settle();
    expect(settings.keymap.bindingsOf("zoom")).toEqual([]);
    expect(status()).toContain("上書きを外しました"); // 何も戻っていないので「戻しました」とは言わない
    expect(status()).not.toContain("既定へ戻しました");
    expect(status()).toContain("戻せなかった既定のキー");
    expect(status()).toContain("goto");
    expect(status().match(/prefix\+z/g), "キーが二重に出ない").toHaveLength(1);
  });

  it("割り当てなし（[]）にした操作も戻せる", async () => {
    const { settings } = await mountKeys();
    deleteBtn("help", "prefix+?").click();
    await settle();
    expect(summaryText("help")).toBe("なし");
    expect(resetActionBtn("help")).not.toBeNull();
    resetActionBtn("help")!.click();
    await settle();
    expect(settings.keymap.bindingsOf("help")).toEqual(["prefix+?"]);
  });
});

describe("KeySettings — prefix の既定へ戻す（AC9）", () => {
  it("［既定に戻す］は prefix を変えているときだけ出る。押すと ctrl+b へ戻り、フォーカスは［変更］へ", async () => {
    const { settings } = await mountKeys();
    expect(resetPrefixBtn()).toBeNull();
    settings.setKeyPrefix("ctrl+a");
    await settle();
    resetPrefixBtn()!.click();
    await settle();
    expect(settings.keymap.prefix).toBe("ctrl+b");
    expect(status()).toBe("prefix を既定（ctrl+b）へ戻しました。");
    expect(resetPrefixBtn()).toBeNull();
    expect(document.activeElement).toBe(prefixBtn());
  });

  it("既定の ctrl+b が直接のキー・prefix の後のキーに使われていれば戻さず、理由（持ち主の名前）を出す", async () => {
    const { settings } = await mountKeys();
    settings.setKeyPrefix("ctrl+a");
    settings.setKeyBindings("goto", ["prefix+g", "ctrl+b"]);
    await settle();
    resetPrefixBtn()!.click();
    await settle();
    expect(settings.keymap.prefix).toBe("ctrl+a");
    expect(status()).toContain("goto");
  });
});

describe("KeySettings — すべてを既定へ戻す（インラインの確認。AC9・AC-I2）", () => {
  async function overridden() {
    const ctx = await mountKeys();
    ctx.settings.setKeyPrefix("ctrl+a");
    ctx.settings.setKeyBindings("zoom", ["prefix+y"]);
    ctx.settings.setKeyBindings("help", []);
    await settle();
    return ctx;
  }

  it("押すと確認が出て、フォーカスは安全側の［やめる］へ移る。まだ何も変わらない", async () => {
    const { settings } = await overridden();
    resetAllBtn()!.click();
    await settle();
    expect(confirmYes()).not.toBeNull();
    expect(resetAllBtn()).toBeNull();
    expect(document.activeElement).toBe(confirmNo());
    expect(settings.keymap.prefix).toBe("ctrl+a");
  });

  it("［やめる］：何も変えず、確認を閉じ、フォーカスは［すべて既定に戻す］へ戻る", async () => {
    const { settings } = await overridden();
    resetAllBtn()!.click();
    await settle();
    confirmNo()!.click();
    await settle();
    expect(confirmYes()).toBeNull();
    expect(document.activeElement).toBe(resetAllBtn());
    expect(settings.keymap.prefix).toBe("ctrl+a");
    expect(settings.keymap.bindingsOf("zoom")).toEqual(["prefix+y"]);
  });

  it("［戻す］：prefix も操作もすべて既定へ戻り（AC2 の状態）、keys が消える", async () => {
    const { settings } = await overridden();
    resetAllBtn()!.click();
    await settle();
    confirmYes()!.click();
    await settle();
    expect(settings.keyPrefs).toEqual({ prefix: null, bindings: {} });
    expect(settings.keymap.prefix).toBe("ctrl+b");
    expect(settings.keymap.bindingsOf("help")).toEqual(["prefix+?"]);
    expect(status()).toBe("すべての割り当てと prefix を既定へ戻しました。");
    expect(readPrefs()).not.toHaveProperty("keys");
    expect(document.activeElement).toBe(resetAllBtn());
  });

  it("確認の中の Esc は確認を閉じるだけで、親（設定画面）へ届かない", async () => {
    await overridden();
    let leaked = 0;
    document.addEventListener("keydown", () => (leaked += 1));
    resetAllBtn()!.click();
    await settle();
    const ev = press(confirmNo()!, "Escape");
    await settle();
    expect(ev.defaultPrevented).toBe(true);
    expect(leaked).toBe(0);
    expect(confirmYes()).toBeNull();
    expect(document.activeElement).toBe(resetAllBtn());
  });

  it("設定画面が閉じると、確認は消える（開き直したとき出たままにならない）", async () => {
    const { view } = await overridden();
    resetAllBtn()!.click();
    await settle();
    view.closeDialog();
    await settle();
    expect(confirmYes()).toBeNull();
  });
});

describe("KeySettings — herdr のおすすめの直接のキー（AC10）", () => {
  it("押すと 10 個の直接のキーが足され、足した数と一覧が出る。prefix の後のキーは残る", async () => {
    const { settings } = await mountKeys();
    recommendedBtn().click();
    await settle();
    expect(settings.keymap.directMap.size).toBe(10);
    expect(settings.keymap.bindingsOf("focus_pane_left")).toEqual(["prefix+h", "ctrl+alt+h"]);
    expect(summaryText("focus_pane_left")).toBe("prefix+h / ctrl+alt+h");
    expect(status()).toContain("10 個足しました");
    expect(status()).toContain("ctrl+alt+shift+d");
  });

  it("もう一度押すと、すでに全部入っていることを知らせる（冪等）", async () => {
    const { settings } = await mountKeys();
    recommendedBtn().click();
    await settle();
    const before = JSON.stringify(settings.keyPrefs);
    recommendedBtn().click();
    await settle();
    expect(JSON.stringify(settings.keyPrefs)).toBe(before);
    expect(status()).toBe("おすすめの直接のキーは、すでに全部入っています。");
  });

  it("別の操作が使っている chord は足さず、理由（持ち主の名前）を出す。残りは足す（足した数・キーが二重に出ない）", async () => {
    const { settings } = await mountKeys();
    settings.setKeyBindings("help", ["prefix+?", "ctrl+alt+z"]);
    await settle();
    recommendedBtn().click();
    await settle();
    expect(settings.keymap.bindingsOf("zoom")).toEqual(["prefix+z"]);
    expect(settings.keymap.directMap.size).toBe(10); // help の ctrl+alt+z を含めて 10（zoom の分は足さない）
    expect(status()).toContain("9 個足しました");
    expect(status()).toContain("足さなかった分：ctrl+alt+z");
    expect(status()).toContain("キー一覧");
    expect(status().match(/ctrl\+alt\+z/g), "足さなかった分でキーは 1 回だけ").toHaveLength(1);
  });

  it("足した分と、その操作がすでに持っていた分が混ざる：足した数とすでにあった分を別々に言う", async () => {
    const { settings } = await mountKeys();
    settings.setKeyBindings("zoom", ["prefix+z", "ctrl+alt+z"]); // 一式の 1 つをすでに持っている
    await settle();
    recommendedBtn().click();
    await settle();
    expect(status()).toContain("直接のキーを 9 個足しました"); // すでにあった 1 個は数えない
    expect(status()).toContain("すでにあった分：ctrl+alt+z");
    expect(status()).not.toContain("足さなかった分");
  });

  it("すでに全部あるうえで 1 個が別の操作の持ち物になったときは、「全部入っています」と言わず、足さなかった分を出す", async () => {
    const { settings } = await mountKeys();
    recommendedBtn().click();
    await settle();
    settings.setKeyBindings("zoom", ["prefix+z"]); // 拡大表示から ctrl+alt+z を外す
    settings.setKeyBindings("help", ["prefix+?", "ctrl+alt+z"]); // その chord を別の操作が持つ
    await settle();
    recommendedBtn().click();
    await settle();
    expect(status()).not.toContain("すでに全部入っています");
    expect(status()).toContain("すでにあった分");
    expect(status()).toContain("足さなかった分：ctrl+alt+z");
    expect(status()).not.toContain("足しました");
  });

  it("prefix と同じ chord は足さず、理由（prefix）を出す", async () => {
    const { settings } = await mountKeys();
    settings.setKeyPrefix("ctrl+alt+h");
    await settle();
    recommendedBtn().click();
    await settle();
    expect(settings.keymap.bindingsOf("focus_pane_left")).toEqual(["prefix+h"]);
    expect(status()).toContain("足さなかった分");
    expect(status()).toContain("prefix");
    expect(status()).toContain("9 個足しました");
  });
});

describe("KeySettings — モバイルの一言（AC1・D11）", () => {
  it("モバイルのときだけ、画面のキーボードでは取り込めないことを添える（節そのものは出す）", async () => {
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "settings" });
    wrapper = mount(KeySettings, {
      global: { plugins: [pinia] },
      attachTo: document.body,
      props: { kind: "mobile" },
    });
    await settle();
    expect(document.querySelector("h3")!.textContent).toBe("キー");
    expect(document.querySelector(".keys-mobile-note")!.textContent).toContain(
      "画面のキーボードでは割り当てを取り込めません",
    );
    // 先頭（取り込めると言う案内の文より前）に置く
    expect(document.querySelector("section > p")!.classList.contains("keys-mobile-note")).toBe(
      true,
    );
    wrapper.unmount();
    document.body.innerHTML = "";
    wrapper = mount(KeySettings, { global: { plugins: [pinia] }, attachTo: document.body });
    await settle();
    expect(document.querySelector(".keys-mobile-note")).toBeNull();
  });
});
