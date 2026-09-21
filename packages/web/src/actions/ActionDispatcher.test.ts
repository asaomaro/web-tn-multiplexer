import type { MethodName, ParamsOf, ResultOf } from "@wtm/protocol";
import type { Pane, Tab, Workspace } from "@wtm/protocol";
import { createPinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyInputController } from "../keys/KeyInputController.js";
import { KeyRouter, type KeyRouterClock } from "../keys/KeyRouter.js";
import { DEFAULT_KEYMAP } from "../keys/keymap.js";
import { clientErrorMessage } from "../net/clientError.js";
import type { ConnectionPort } from "../net/ports.js";
import { RendererPool, type WebglAddonLike } from "../term/RendererPool.js";
import { TerminalRegistry } from "../term/TerminalRegistry.js";
import { MouseBridge } from "../term/MouseBridge.js";
import { useSessionStore } from "../store/session.js";
import { useViewStore } from "../store/view.js";
import { InputGate } from "../net/InputGate.js";
import { ActionDispatcher } from "./ActionDispatcher.js";

let pinia: Pinia;

beforeEach(() => {
  sessionStorage.clear();
  pinia = createPinia();
});

function makeConnection(): ConnectionPort & {
  requests: [MethodName, unknown][];
  resolveWith: Partial<Record<MethodName, unknown>>;
  /** その方式を失敗させる。`Connection` と同じ `<code>: <message>` の形の Error を投げる（clientError.ts の `errorCodeOf`）。 */
  rejectWith: Partial<Record<MethodName, string>>;
} {
  return {
    requests: [],
    resolveWith: {},
    rejectWith: {},
    request<M extends MethodName>(method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
      this.requests.push([method, params]);
      const code = this.rejectWith[method];
      if (code !== undefined) return Promise.reject(new Error(`${code}: from server`));
      return Promise.resolve((this.resolveWith[method] ?? {}) as ResultOf<M>);
    },
    sendInput: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    connect: vi.fn(),
  };
}

function realClock(): KeyRouterClock {
  return { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
}

class FakeWebglAddon implements WebglAddonLike {
  activate(): void {}
  dispose(): void {}
  onContextLoss(): { dispose(): void } {
    return { dispose: () => undefined };
  }
}

/** T17/T18 共通のテスト用の組み立て（実物の KeyRouter・TerminalRegistry を使う。軽量な部品なので実害は無い）。 */
function makeDispatcher(
  conn: ConnectionPort,
  extra: { notifications?: { focusNext(): void } } = {},
): { dispatcher: ActionDispatcher; registry: TerminalRegistry; keys: KeyInputController } {
  const router = new KeyRouter(DEFAULT_KEYMAP, realClock());
  const keys = new KeyInputController(router, conn);
  const renderers = new RendererPool({ capacity: 100, createWebglAddon: () => new FakeWebglAddon() });
  const registry = new TerminalRegistry({
    capacity: 100,
    conn,
    renderers,
    keys,
    createMouseBridge: (term, paneId) => new MouseBridge({ term, paneId, ui: { toast: () => undefined, openContextMenu: () => undefined }, getRightClickTarget: () => "herdr" }),
  });
  const dispatcher = new ActionDispatcher({ conn, pinia, registry, keys, notifications: { focusNext: () => undefined }, ...extra });
  const view = useViewStore(pinia);
  keys.bind({ action: dispatcher, focus: dispatcher, mode: { onModeChange: (m) => view.onModeChange(m) } });
  return { dispatcher, registry, keys };
}

function makeWorkspace(id: string, tabIds: string[] = [], overrides: Partial<Workspace> = {}): Workspace {
  return { id, label: id, cwd: "/", tabIds, activeTabId: tabIds[0] ?? "", groupId: null, git: null, ...overrides };
}
function makeTab(id: string, workspaceId: string, focusedPaneId = "p1"): Tab {
  return { id, workspaceId, label: id, layout: { type: "pane", paneId: focusedPaneId }, focusedPaneId, zoomedPaneId: null, sizeOwnerClientId: null };
}
function makePane(id: string, tabId: string, busy = false): Pane {
  return { id, tabId, label: null, cwd: "/", shell: "/bin/bash", cols: 80, rows: 24, status: "running", failure: null, busy, title: "", rightClick: "herdr", agent: null };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ActionDispatcher — 分割・フォーカス移動・入れ替え", () => {
  it("split: pane.split を送り、応答の pane にフォーカスする（AC-I4）", async () => {
    const conn = makeConnection();
    conn.resolveWith["pane.split"] = { pane: { id: "p2" } };
    const view = useViewStore(pinia);
    view.focusPane("p1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "split", dir: "right" });
    await flush();
    expect(conn.requests).toEqual([["pane.split", { paneId: "p1", direction: "right" }]]);
    expect(view.focusedPaneId).toBe("p2");
  });

  it("split：応答を待つ間に打った文字は、新しい pane へ届く（D99。InputGate）", async () => {
    const conn = makeConnection();
    let resolveSplit: (v: unknown) => void = () => undefined;
    conn.request = function <M extends MethodName>(method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
      this.requests.push([method, params]);
      return new Promise((r) => (resolveSplit = r as (v: unknown) => void));
    };
    const gate = new InputGate(conn);
    const view = useViewStore(pinia);
    view.focusPane("p1");
    const { registry, keys } = makeDispatcher(conn);
    const dispatcher = new ActionDispatcher({ conn, pinia, registry, keys, input: gate, notifications: { focusNext: () => undefined } });
    dispatcher.run({ type: "split", dir: "right" });
    gate.sendInput("p1", "ls\r"); // 応答の前に、まだ焦点のある p1 で打った
    expect(conn.sendInput).not.toHaveBeenCalled();
    useSessionStore(pinia).paneUpserted(makePane("p2", "t1")); // 実際は pane.created が応答より先に届く
    resolveSplit({ pane: { id: "p2" } });
    await flush();
    expect(view.focusedPaneId).toBe("p2");
    expect(conn.sendInput).toHaveBeenCalledWith("p2", "ls\r");
  });

  it("split が失敗したら、溜めた文字は元の pane へ届く（D99）", async () => {
    const conn = makeConnection();
    conn.request = function <M extends MethodName>(method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
      this.requests.push([method, params]);
      return Promise.reject(new Error("spawn_failed"));
    };
    const gate = new InputGate(conn);
    const view = useViewStore(pinia);
    view.focusPane("p1");
    const { registry, keys } = makeDispatcher(conn);
    new ActionDispatcher({ conn, pinia, registry, keys, input: gate, notifications: { focusNext: () => undefined } }).run({ type: "split", dir: "right" });
    gate.sendInput("p1", "ls");
    expect(conn.sendInput).not.toHaveBeenCalled(); // 失敗が分かるまでは溜めている
    await flush();
    expect(conn.sendInput).toHaveBeenCalledWith("p1", "ls");
  });

  it("新しい pane が応答の時点で既に閉じていたら（シェルが猶予中に終わった）、溜めた文字は元の pane へ（D99・独立点検の指摘）", async () => {
    const conn = makeConnection();
    conn.resolveWith["pane.split"] = { pane: { id: "p2" } }; // p2 は session に無い（閉じた）
    const gate = new InputGate(conn);
    const view = useViewStore(pinia);
    view.focusPane("p1");
    const { registry, keys } = makeDispatcher(conn);
    new ActionDispatcher({ conn, pinia, registry, keys, input: gate, notifications: { focusNext: () => undefined } }).run({ type: "split", dir: "right" });
    gate.sendInput("p1", "ls");
    await flush();
    expect(conn.sendInput).toHaveBeenCalledWith("p1", "ls");
  });

  it("新しい tab（confirmNewTab）：応答を待つ間に打った文字は新しい tab の pane へ（D99）", async () => {
    const conn = makeConnection();
    conn.resolveWith["tab.create"] = { tab: makeTab("t2", "w1", "p2"), pane: makePane("p2", "t2") };
    const gate = new InputGate(conn);
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.paneUpserted(makePane("p2", "t2")); // 実際は pane.created が応答より先に届く
    view.setView("w1", "t1");
    view.focusPane("p1");
    view.openDialogWithContext({ kind: "newTab", workspaceId: "w1" });
    const { registry, keys } = makeDispatcher(conn);
    new ActionDispatcher({ conn, pinia, registry, keys, input: gate, notifications: { focusNext: () => undefined } }).confirmNewTab("second");
    gate.sendInput("p1", "pwd");
    expect(conn.sendInput).not.toHaveBeenCalled();
    await flush();
    expect(view.focusedPaneId).toBe("p2");
    expect(conn.sendInput).toHaveBeenCalledWith("p2", "pwd");
  });

  /** p1｜（p2 上／p3 下）のレイアウトの tab を用意する（focusDir のテスト用）。 */
  function setupLShapedTab(): ReturnType<typeof useViewStore> {
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted({
      ...makeTab("t1", "w1", "p3"),
      layout: {
        type: "split",
        id: "s1",
        dir: "right",
        ratio: 0.5,
        a: { type: "pane", paneId: "p1" },
        b: { type: "split", id: "s2", dir: "down", ratio: 0.5, a: { type: "pane", paneId: "p2" }, b: { type: "pane", paneId: "p3" } },
      },
    });
    view.setView("w1", "t1");
    view.focusPane("p3");
    return view;
  }

  it("focusDir: 移動先をクライアントで求めて、応答を待たずに即座にフォーカスを移し、pane.focus を送る（D97）", () => {
    const conn = makeConnection();
    const view = setupLShapedTab();
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "focusDir", dir: "up" });
    expect(view.focusedPaneId).toBe("p2"); // 同期的に（await 無しで）移っている
    expect(conn.requests).toEqual([["pane.focus", { paneId: "p2" }]]);
    dispatcher.run({ type: "focusDir", dir: "left" });
    expect(view.focusedPaneId).toBe("p1");
  });

  it("focusDir: その方向に pane が無ければ何もしない（要求も送らない）", () => {
    const conn = makeConnection();
    const view = setupLShapedTab();
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "focusDir", dir: "right" }); // p3 は右端
    expect(view.focusedPaneId).toBe("p3");
    expect(conn.requests).toEqual([]);
  });

  it("swap: pane.swap を送る（フォーカスは変えない）", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.focusPane("p1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "swap", dir: "up" });
    expect(conn.requests).toEqual([["pane.swap", { paneId: "p1", direction: "up" }]]);
    expect(view.focusedPaneId).toBe("p1");
  });

  it("zoom: pane.zoom(mode:'toggle') を送る", () => {
    const conn = makeConnection();
    useViewStore(pinia).focusPane("p1");
    makeDispatcher(conn).dispatcher.run({ type: "zoom" });
    expect(conn.requests).toEqual([["pane.zoom", { paneId: "p1", mode: "toggle" }]]);
  });

  it("フォーカス中の pane が無ければ何もしない", () => {
    const conn = makeConnection();
    makeDispatcher(conn).dispatcher.run({ type: "split", dir: "right" });
    expect(conn.requests).toEqual([]);
  });
});

describe("ActionDispatcher — cyclePane（レイアウト木の深さ優先）", () => {
  it("2 分割された tab で次/前へ回る（端で反対へ）", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.tabUpserted({
      id: "t1",
      workspaceId: "w1",
      label: "t1",
      layout: { type: "split", id: "s1", dir: "right", ratio: 0.5, a: { type: "pane", paneId: "p1" }, b: { type: "pane", paneId: "p2" } },
      focusedPaneId: "p1",
      zoomedPaneId: null,
      sizeOwnerClientId: null,
    });
    view.setView("w1", "t1");
    view.focusPane("p1");
    const { dispatcher } = makeDispatcher(conn);

    dispatcher.run({ type: "cyclePane", delta: 1 });
    expect(view.focusedPaneId).toBe("p2");
    expect(conn.requests.at(-1)).toEqual(["pane.focus", { paneId: "p2" }]);

    dispatcher.run({ type: "cyclePane", delta: 1 }); // 端から反対へ
    expect(view.focusedPaneId).toBe("p1");

    dispatcher.run({ type: "cyclePane", delta: -1 }); // 前へ（反対へ回る）
    expect(view.focusedPaneId).toBe("p2");
  });
});

describe("ActionDispatcher — tab の切替（delta/index）", () => {
  it("tabDelta: workspace の tabIds の順で動く（端で反対へ）", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1", "t2", "t3"]));
    session.tabUpserted(makeTab("t1", "w1", "p1"));
    session.tabUpserted(makeTab("t2", "w1", "p2"));
    session.tabUpserted(makeTab("t3", "w1", "p3"));
    view.setView("w1", "t3");
    const { dispatcher } = makeDispatcher(conn);

    dispatcher.run({ type: "tabDelta", delta: 1 }); // 端から反対へ
    expect(view.tabId).toBe("t1");
    expect(view.focusedPaneId).toBe("p1");
  });

  it("tabIndex: 1 始まりで workspace の tabIds を引く", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1", "t2"]));
    session.tabUpserted(makeTab("t2", "w1", "p2"));
    view.setView("w1", "t1");
    makeDispatcher(conn).dispatcher.run({ type: "tabIndex", index: 2 });
    expect(view.tabId).toBe("t2");
    expect(view.focusedPaneId).toBe("p2");
  });
});

describe("ActionDispatcher — newTab（ダイアログを開く。herdr の prompt_new_tab_name）", () => {
  it("newTab は tab.create を直接送らず、ダイアログを開く", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.setView("w1", "t1");
    makeDispatcher(conn).dispatcher.run({ type: "newTab" });
    expect(conn.requests).toEqual([]);
    expect(view.dialogContext).toEqual({ kind: "newTab", workspaceId: "w1" });
  });

  it("confirmNewTab: tab.create を送り、応答の tab/pane へ切り替える", async () => {
    const conn = makeConnection();
    conn.resolveWith["tab.create"] = { tab: { id: "t9" }, pane: { id: "p9" } };
    const view = useViewStore(pinia);
    view.setView("w1", "t1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "newTab" });
    dispatcher.confirmNewTab("my tab");
    expect(conn.requests).toEqual([["tab.create", { workspaceId: "w1", label: "my tab" }]]);
    await flush();
    expect(view.tabId).toBe("t9");
    expect(view.focusedPaneId).toBe("p9");
    expect(view.dialogContext).toBeNull();
  });

  it("confirmNewTab: 空欄なら label を送らない（既定の名前は herdr 側の規約。design「ダイアログ」）", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.setView("w1", "t1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "newTab" });
    dispatcher.confirmNewTab("   ");
    expect(conn.requests).toEqual([["tab.create", { workspaceId: "w1" }]]);
  });
});

describe("ActionDispatcher — newWorkspace（名前を尋ねず直接作る。herdr の prompt_new_workspace_name）", () => {
  it("workspace.create を直接送り、応答へ切り替える", async () => {
    const conn = makeConnection();
    conn.resolveWith["workspace.create"] = { workspace: { id: "w9" }, tab: { id: "t9" }, pane: { id: "p9" } };
    const view = useViewStore(pinia);
    makeDispatcher(conn).dispatcher.run({ type: "newWorkspace" });
    expect(conn.requests).toEqual([["workspace.create", {}]]);
    await flush();
    expect(view.workspaceId).toBe("w9");
    expect(view.tabId).toBe("t9");
    expect(view.focusedPaneId).toBe("p9");
  });
});

describe("ActionDispatcher — 閉じる前の確認（D23。busy な pane を含むときだけ・workspace は常に）", () => {
  it("closePane: busy でなければ確認せず直接閉じる", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", "t1", false));
    view.focusPane("p1");
    makeDispatcher(conn).dispatcher.run({ type: "closePane" });
    expect(conn.requests).toEqual([["pane.close", { paneId: "p1" }]]);
    expect(view.dialogContext).toBeNull();
  });

  it("closePane: busy なら確認ダイアログを開き、直接は閉じない", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", "t1", true));
    view.focusPane("p1");
    makeDispatcher(conn).dispatcher.run({ type: "closePane" });
    expect(conn.requests).toEqual([]);
    expect(view.dialogContext).toEqual({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
  });

  it("closeTab: tab 内のどれかが busy なら確認する", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", "t1", false));
    session.paneUpserted(makePane("p2", "t1", true));
    view.setView("w1", "t1");
    makeDispatcher(conn).dispatcher.run({ type: "closeTab" });
    expect(conn.requests).toEqual([]);
    expect(view.dialogContext).toEqual({ kind: "confirmClose", targets: [{ type: "tab", id: "t1" }] });
  });

  it("closeTab: どれも busy でなければ直接閉じる", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted(makePane("p1", "t1", false));
    view.setView("w1", "t1");
    makeDispatcher(conn).dispatcher.run({ type: "closeTab" });
    expect(conn.requests).toEqual([["tab.close", { tabId: "t1" }]]);
  });

  it("closeWorkspace: busy かどうかによらず常に確認する", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.setView("w1", "t1");
    makeDispatcher(conn).dispatcher.run({ type: "closeWorkspace" });
    expect(conn.requests).toEqual([]);
    expect(view.dialogContext).toEqual({ kind: "confirmClose", targets: [{ type: "workspace", id: "w1" }] });
  });

  it("confirmClose: 対象それぞれの close を送り、ダイアログを閉じる", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "confirmClose", targets: [{ type: "pane", id: "p1" }] });
    makeDispatcher(conn).dispatcher.confirmClose();
    expect(conn.requests).toEqual([["pane.close", { paneId: "p1" }]]);
    expect(view.dialogContext).toBeNull();
  });
});

describe("ActionDispatcher — navigate", () => {
  it("enterMode(navigate) は現在の workspace を選択の初期値にする", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.setView("w1", "t1");
    makeDispatcher(conn).dispatcher.run({ type: "enterMode", mode: "navigate" });
    expect(view.navigateSelection).toBe("w1");
  });

  it("enterMode(copy/resize) は navigateSelection を変えない", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    makeDispatcher(conn).dispatcher.run({ type: "enterMode", mode: "copy" });
    expect(view.navigateSelection).toBeNull();
  });

  it("up/down は workspace の一覧を順に回る（端で反対へ）", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    session.workspaceUpserted(makeWorkspace("w2"));
    view.setNavigateSelection("w1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "navigate", op: "down" });
    expect(view.navigateSelection).toBe("w2");
    dispatcher.run({ type: "navigate", op: "down" }); // 端から反対へ
    expect(view.navigateSelection).toBe("w1");
    dispatcher.run({ type: "navigate", op: "up" });
    expect(view.navigateSelection).toBe("w2");
  });

  it("activate: 選択中の workspace の activeTabId へ切り替え、workspace.focus を送る", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted({ ...makeWorkspace("w1", ["t1"]), activeTabId: "t1" });
    session.tabUpserted(makeTab("t1", "w1", "p1"));
    view.setNavigateSelection("w1");
    makeDispatcher(conn).dispatcher.run({ type: "navigate", op: "activate" });
    expect(view.workspaceId).toBe("w1");
    expect(view.tabId).toBe("t1");
    expect(view.focusedPaneId).toBe("p1");
    expect(view.navigateSelection).toBeNull();
    expect(conn.requests).toEqual([["workspace.focus", { workspaceId: "w1" }]]);
  });

  it("cancel: 選択を消すだけで何も送らない", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.setNavigateSelection("w1");
    makeDispatcher(conn).dispatcher.run({ type: "navigate", op: "cancel" });
    expect(view.navigateSelection).toBeNull();
    expect(conn.requests).toEqual([]);
  });

  it("paneDir は focusDir と同じ経路を使う", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1", ["t1"]));
    session.tabUpserted({ ...makeTab("t1", "w1", "p1"), layout: { type: "split", id: "s1", dir: "down", ratio: 0.5, a: { type: "pane", paneId: "p1" }, b: { type: "pane", paneId: "p2" } } });
    view.setView("w1", "t1");
    view.focusPane("p1");
    makeDispatcher(conn).dispatcher.run({ type: "navigate", op: "paneDir", dir: "down" });
    expect(conn.requests).toEqual([["pane.focus", { paneId: "p2" }]]);
    expect(view.focusedPaneId).toBe("p2");
  });
});

describe("ActionDispatcher — resizeBy", () => {
  it("pane.resize を送る", () => {
    const conn = makeConnection();
    useViewStore(pinia).focusPane("p1");
    makeDispatcher(conn).dispatcher.run({ type: "resizeBy", dir: "left", amount: 0.05 });
    expect(conn.requests).toEqual([["pane.resize", { paneId: "p1", direction: "left", amount: 0.05 }]]);
  });
});

describe("ActionDispatcher — copy（D63：exited の判断はここで行う）", () => {
  it("CopyTarget.apply を呼び、copiedText があればクリップボードへ書き込んでトーストを出す", async () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    const { dispatcher, registry } = makeDispatcher(conn);
    const entry = registry.acquire("p1");
    await new Promise<void>((resolve) => entry.term.write("hello", () => resolve()));
    view.focusPane("p1");
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    dispatcher.run({ type: "copy", cmd: { op: "selectStart", linewise: false } });
    dispatcher.run({ type: "copy", cmd: { op: "move", unit: "char", dir: 1 } });
    dispatcher.run({ type: "copy", cmd: { op: "move", unit: "char", dir: 1 } });
    dispatcher.run({ type: "copy", cmd: { op: "yank" } });
    await flush();
    expect(writeTextSpy).toHaveBeenCalled();
    expect(view.toasts.map((t) => t.message)).toContain("コピーしました");
    entry.term.dispose();
  });

  it("exited: true なら keys.setMode('terminal') を呼び、view.mode に反映される", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    const { dispatcher, registry, keys } = makeDispatcher(conn);
    const entry = registry.acquire("p1");
    view.focusPane("p1");
    keys.setMode("copy"); // router 自身の状態も 'copy' にしておく（setMode の変化判定に効く）
    expect(view.mode).toBe("copy");
    dispatcher.run({ type: "copy", cmd: { op: "exit" } });
    expect(view.mode).toBe("terminal");
    entry.term.dispose();
  });

  it("フォーカス中の pane が無ければ何もしない（例外を投げない）", () => {
    const conn = makeConnection();
    const { dispatcher } = makeDispatcher(conn);
    expect(() => dispatcher.run({ type: "copy", cmd: { op: "exit" } })).not.toThrow();
  });

  it("copy モードに入るたび、フォーカス中の pane の CopyTarget.resetCursor を呼ぶ（D94）", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    const { dispatcher, registry } = makeDispatcher(conn);
    const entry = registry.acquire("p1");
    view.focusPane("p1");
    const spy = vi.spyOn(entry.copy, "resetCursor");

    dispatcher.run({ type: "enterMode", mode: "copy" });
    expect(spy).toHaveBeenCalledTimes(1);

    dispatcher.run({ type: "enterMode", mode: "navigate" }); // copy 以外では呼ばない
    expect(spy).toHaveBeenCalledTimes(1);
    entry.term.dispose();
  });
});

describe("ActionDispatcher — 名前の変更", () => {
  it("renamePane: 現在の名前を入れてダイアログを開く", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted({ ...makePane("p1", "t1"), label: "old" });
    view.focusPane("p1");
    makeDispatcher(conn).dispatcher.run({ type: "renamePane" });
    expect(view.dialogContext).toEqual({ kind: "renamePane", paneId: "p1", currentLabel: "old" });
  });

  it("confirmRenamePane: pane.rename を送る", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "old" });
    makeDispatcher(conn).dispatcher.confirmRenamePane("new name");
    expect(conn.requests).toEqual([["pane.rename", { paneId: "p1", label: "new name" }]]);
    expect(view.dialogContext).toBeNull();
  });

  it("confirmRenamePane: 空欄なら label:null を送る（名前の消去と同じ扱い）", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "renamePane", paneId: "p1", currentLabel: "old" });
    makeDispatcher(conn).dispatcher.confirmRenamePane("   ");
    expect(conn.requests).toEqual([["pane.rename", { paneId: "p1", label: null }]]);
  });

  it("renameTab/confirmRenameTab: 空欄はサーバの検証（min 1）に合わせて送らない", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.tabUpserted(makeTab("t1", "w1"));
    view.setView("w1", "t1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "renameTab" });
    expect(view.dialogContext).toMatchObject({ kind: "renameTab", tabId: "t1" });
    dispatcher.confirmRenameTab("");
    expect(conn.requests).toEqual([]); // 空欄は送らない
    expect(view.dialogContext).toBeNull(); // でもダイアログは閉じる

    dispatcher.run({ type: "renameTab" });
    dispatcher.confirmRenameTab("new name");
    expect(conn.requests).toEqual([["tab.rename", { tabId: "t1", label: "new name" }]]);
  });

  it("renameWorkspace/confirmRenameWorkspace", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w1"));
    view.setView("w1", "t1");
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "renameWorkspace" });
    expect(view.dialogContext).toMatchObject({ kind: "renameWorkspace", workspaceId: "w1" });
    dispatcher.confirmRenameWorkspace("new name");
    expect(conn.requests).toEqual([["workspace.rename", { workspaceId: "w1", label: "new name" }]]);
  });
});

describe("ActionDispatcher — help/goto/toggleSidebar/detach/notYet", () => {
  it("help/goto はダイアログを開く", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.run({ type: "help" });
    expect(view.dialogContext).toEqual({ kind: "help" });
    dispatcher.run({ type: "goto" });
    expect(view.dialogContext).toEqual({ kind: "goto" });
  });

  it("toggleSidebar", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    makeDispatcher(conn).dispatcher.run({ type: "toggleSidebar" });
    expect(view.sidebarCollapsed).toBe(true);
  });

  it("detach: client.detach を送る", () => {
    const conn = makeConnection();
    makeDispatcher(conn).dispatcher.run({ type: "detach" });
    expect(conn.requests).toEqual([["client.detach", {}]]);
  });

  it("notYet: 後続案内のトーストを出す", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    makeDispatcher(conn).dispatcher.run({ type: "notYet", work: "外観と設定" });
    expect(view.toasts.map((t) => t.message)).toContain("未対応（後続: 外観と設定）");
  });
});

describe("ActionDispatcher — メニュー専用の操作（D56 の訂正 10）", () => {
  it("clearPaneName: pane.rename(label:null) を送る", () => {
    const conn = makeConnection();
    makeDispatcher(conn).dispatcher.clearPaneName("p1");
    expect(conn.requests).toEqual([["pane.rename", { paneId: "p1", label: null }]]);
  });

  it("setRightClickTarget: pane.input.set を送る", () => {
    const conn = makeConnection();
    makeDispatcher(conn).dispatcher.setRightClickTarget("p1", "pane");
    expect(conn.requests).toEqual([["pane.input.set", { paneId: "p1", rightClick: "pane" }]]);
  });

  it("pasteFromMenu: クリップボードから読んで term.paste する", async () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    const { dispatcher, registry } = makeDispatcher(conn);
    const entry = registry.acquire("p1");
    view.focusPane("p1");
    vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("pasted");
    const pasteSpy = vi.spyOn(entry.term, "paste").mockImplementation(() => undefined);
    dispatcher.pasteFromMenu();
    await flush();
    expect(pasteSpy).toHaveBeenCalledWith("pasted");
    entry.term.dispose();
  });

  it("pasteIntoPane: 右クリックした pane（フォーカス中とは無関係）へ貼り付ける", async () => {
    const conn = makeConnection();
    const { dispatcher, registry } = makeDispatcher(conn);
    const entry = registry.acquire("p2");
    useViewStore(pinia).focusPane("p1"); // フォーカスは別の pane
    vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("pasted");
    const pasteSpy = vi.spyOn(entry.term, "paste").mockImplementation(() => undefined);
    dispatcher.pasteIntoPane("p2");
    await flush();
    expect(pasteSpy).toHaveBeenCalledWith("pasted");
    entry.term.dispose();
  });
});

describe("ActionDispatcher — UiPort", () => {
  it("openContextMenu/toast は view ストアへ反映する", () => {
    const conn = makeConnection();
    const view = useViewStore(pinia);
    const { dispatcher } = makeDispatcher(conn);
    dispatcher.openContextMenu({ kind: "pane", paneId: "p1" }, { x: 1, y: 2 });
    expect(view.contextMenu).toEqual({ target: { kind: "pane", paneId: "p1" }, at: { x: 1, y: 2 } });
    dispatcher.toast("hi");
    expect(view.toasts.map((t) => t.message)).toContain("hi");
  });
});

describe("ActionDispatcher — T22 向けの「任意の対象」メソッド（フォーカス中/表示中とは限らない）", () => {
  it("splitPane/zoomPane/closePaneById/renamePaneById は指定した paneId を使う（フォーカス中の pane とは無関係）", async () => {
    const conn = makeConnection();
    conn.resolveWith["pane.split"] = { pane: { id: "p9" } };
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.paneUpserted({ ...makePane("p2", "t1"), label: "old" });
    view.focusPane("p1"); // フォーカスは別の pane
    const { dispatcher } = makeDispatcher(conn);

    dispatcher.splitPane("p2", "right");
    await flush();
    expect(conn.requests).toContainEqual(["pane.split", { paneId: "p2", direction: "right" }]);
    expect(view.focusedPaneId).toBe("p9"); // 新しい pane にはフォーカスする（AC-I4 は維持）

    dispatcher.zoomPane("p2");
    expect(conn.requests).toContainEqual(["pane.zoom", { paneId: "p2", mode: "toggle" }]);

    dispatcher.renamePaneById("p2");
    expect(view.dialogContext).toEqual({ kind: "renamePane", paneId: "p2", currentLabel: "old" });

    dispatcher.closePaneById("p2");
    expect(conn.requests).toContainEqual(["pane.close", { paneId: "p2" }]);
  });

  it("newTabInWorkspace/renameTabById/closeTabById は指定した対象を使う（表示中の workspace/tab とは無関係）", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.tabUpserted(makeTab("t9", "w9"));
    view.setView("w1", "t1"); // 表示中は別の workspace/tab
    const { dispatcher } = makeDispatcher(conn);

    dispatcher.newTabInWorkspace("w9");
    expect(view.dialogContext).toEqual({ kind: "newTab", workspaceId: "w9" });

    dispatcher.renameTabById("t9");
    expect(view.dialogContext).toEqual({ kind: "renameTab", tabId: "t9", currentLabel: "t9" });

    dispatcher.closeTabById("t9");
    expect(conn.requests).toContainEqual(["tab.close", { tabId: "t9" }]);
  });

  it("renameWorkspaceById/closeWorkspaceById は指定した対象を使う（表示中の workspace とは無関係）", () => {
    const conn = makeConnection();
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w9"));
    view.setView("w1", "t1");
    const { dispatcher } = makeDispatcher(conn);

    dispatcher.renameWorkspaceById("w9");
    expect(view.dialogContext).toEqual({ kind: "renameWorkspace", workspaceId: "w9", currentLabel: "w9" });

    dispatcher.closeWorkspaceById("w9");
    expect(view.dialogContext).toEqual({ kind: "confirmClose", targets: [{ type: "workspace", id: "w9" }] });
  });
});

// 20260920-git-worktree-actions。**サーバに聞いてからダイアログを開く**ので、開くまでに 1 往復ある。
describe("ActionDispatcher — worktree", () => {
  const LIST = { worktreeRoot: "/root", repoName: "wtm", suggestedBranch: "worktree/brave-river-0000", entries: [{ path: "/w/a", branch: "a" }] };

  it("newWorktree：一覧を取ってから作成のダイアログを開く（AC1）", async () => {
    const conn = makeConnection();
    conn.resolveWith["worktree.list"] = LIST;
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    dispatcher.newWorktree("w1");
    await Promise.resolve();
    await Promise.resolve();
    expect(conn.requests[0]).toEqual(["worktree.list", { workspaceId: "w1" }]);
    expect(view.dialogContext).toMatchObject({ kind: "worktreeCreate", workspaceId: "w1" });
  });

  it("openWorktree：一覧が空ならダイアログを開かず知らせる（AC5）", async () => {
    const conn = makeConnection();
    conn.resolveWith["worktree.list"] = { ...LIST, entries: [] };
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    dispatcher.openWorktree("w1");
    await Promise.resolve();
    await Promise.resolve();
    expect(view.dialogContext).toBeNull();
    expect(view.toasts.length).toBe(1);
  });

  it("confirmWorktreeCreate：作ってから、その場所を cwd に workspace を開く（AC3）", async () => {
    const conn = makeConnection();
    conn.resolveWith["worktree.create"] = { path: "/root/wtm/feature-x" };
    conn.resolveWith["workspace.create"] = { workspace: makeWorkspace("w2", ["t2"]), tab: makeTab("t2", "w2", "p2"), pane: makePane("p2", "t2") };
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "worktreeCreate", workspaceId: "w1", info: LIST });
    dispatcher.confirmWorktreeCreate("feature/x");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(conn.requests.map(([m]) => m)).toEqual(["worktree.create", "workspace.create"]);
    expect(conn.requests[0]![1]).toEqual({ workspaceId: "w1", branch: "feature/x" });
    // **label にブランチ名を渡す**（review ラウンド1）。渡さないとサーバの既定 `"1"` になり、
    // サイドバーに `1` が並んでどの worktree か分からなくなる（ブランチの 2 行目は上流が無いと出ない）。
    expect(conn.requests[1]![1]).toEqual({ cwd: "/root/wtm/feature-x", label: "feature/x" });
  });

  it("confirmWorktreeCreate：空では何も送らない（AC3）", () => {
    const conn = makeConnection();
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "worktreeCreate", workspaceId: "w1", info: LIST });
    dispatcher.confirmWorktreeCreate("   ");
    expect(conn.requests).toEqual([]);
  });

  // AC6：同じ場所の workspace が 2 つできると、どちらで作業していたか分からなくなる。
  it("confirmWorktreeOpen：既に開いている場所ならそこへ移るだけで、workspace.create を呼ばない（AC6）", () => {
    const conn = makeConnection();
    const { dispatcher } = makeDispatcher(conn);
    const session = useSessionStore(pinia);
    const view = useViewStore(pinia);
    session.workspaceUpserted(makeWorkspace("w9", ["t9"], { cwd: "/w/a" }));
    session.tabUpserted(makeTab("t9", "w9", "p9"));
    view.focusPane("p-elsewhere"); // 別の workspace の pane を見ている状態から移る
    view.openDialogWithContext({ kind: "worktreeOpen", workspaceId: "w1", entries: LIST.entries });
    dispatcher.confirmWorktreeOpen("/w/a");
    expect(conn.requests.map(([m]) => m)).not.toContain("workspace.create");
    expect(view.workspaceId).toBe("w9");
    // `setView` は焦点の pane を触らないので、対で移さないと**打鍵が見えていない端末へ流れる**
    // （Sidebar・GotoPicker・goto・PanePicker はどれも対で呼んでいる）。
    expect(view.focusedPaneId, "その tab で最後に見ていた pane へ焦点が移る").toBe("p9");
  });

  it("confirmWorktreeOpen：まだ開いていない場所なら workspace.create を送る（AC5）", () => {
    const conn = makeConnection();
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "worktreeOpen", workspaceId: "w1", entries: LIST.entries });
    dispatcher.confirmWorktreeOpen("/w/a"); // 一覧にある項目（branch: "a"）
    expect(conn.requests[0]).toEqual(["workspace.create", { cwd: "/w/a", label: "a" }]);
  });

  it("confirmWorktreeOpen：branch が null（detached）ならパスの末尾を label にする", () => {
    const conn = makeConnection();
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    view.openDialogWithContext({ kind: "worktreeOpen", workspaceId: "w1", entries: [{ path: "/w/detached-here", branch: null }] });
    dispatcher.confirmWorktreeOpen("/w/detached-here");
    expect(conn.requests[0]).toEqual(["workspace.create", { cwd: "/w/detached-here", label: "detached-here" }]);
  });

  // AC7：**この describe が繋がりを見る唯一の場所**。コード→日本語の対応表そのものは clientError.test.ts が
  // 固定しているが、`ActionDispatcher` がその表へ橋渡ししているかは、失敗させてみないと分からない
  // （固定の文言を返す実装に差し替えても、それ以外のテストは全て通ってしまう）。
  async function toastAfterFailure(method: MethodName, code: string, run: (d: ActionDispatcher, v: ReturnType<typeof useViewStore>) => void): Promise<string> {
    const conn = makeConnection();
    conn.resolveWith["worktree.list"] = LIST;
    conn.rejectWith[method] = code;
    const { dispatcher } = makeDispatcher(conn);
    const view = useViewStore(pinia);
    const before = view.toasts.length; // 同じ it の中で 2 回呼ぶので、増えた 1 件だけを見る
    run(dispatcher, view);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.toasts.length).toBe(before + 1);
    return view.toasts[before]!.message;
  }

  it("worktree.create の失敗は、コードごとに違う日本語で知らせる（AC7）", async () => {
    const inUse = await toastAfterFailure("worktree.create", "worktree_branch_in_use", (d, v) => {
      v.openDialogWithContext({ kind: "worktreeCreate", workspaceId: "w1", info: LIST });
      d.confirmWorktreeCreate("feature/x");
    });
    const exists = await toastAfterFailure("worktree.create", "worktree_path_exists", (d, v) => {
      v.openDialogWithContext({ kind: "worktreeCreate", workspaceId: "w1", info: LIST });
      d.confirmWorktreeCreate("feature/x");
    });
    expect(inUse).toBe(clientErrorMessage("worktree_branch_in_use"));
    expect(exists).toBe(clientErrorMessage("worktree_path_exists"));
    expect(inUse).not.toBe(exists);
  });

  it("worktree.list と workspace.create の失敗も、同じ経路で日本語にする（AC7）", async () => {
    const listFailed = await toastAfterFailure("worktree.list", "not_a_git_repository", (d) => d.newWorktree("w1"));
    expect(listFailed).toBe(clientErrorMessage("not_a_git_repository"));

    const openFailed = await toastAfterFailure("workspace.create", "not_found", (d, v) => {
      v.openDialogWithContext({ kind: "worktreeOpen", workspaceId: "w1", entries: LIST.entries });
      d.confirmWorktreeOpen("/w/new");
    });
    expect(openFailed).toBe(clientErrorMessage("not_found"));
  });

  it("コードを読み取れない失敗は、汎用の文言に落とす（AC7）", async () => {
    const message = await toastAfterFailure("worktree.list", "", (d) => d.openWorktree("w1"));
    expect(message).toBe("worktree の操作に失敗しました。");
  });
});

// 20260920-agent-notifications：`run()` の switch に `default` も網羅性の検査も無いので、
// **足し忘れてもキーが黙って何もしないだけで型では落ちない**。ここで結線を固定する。
describe("ActionDispatcher — 通知", () => {
  it("notifySettings で設定のダイアログが開く", () => {
    const { dispatcher } = makeDispatcher(makeConnection());
    const view = useViewStore(pinia);
    dispatcher.run({ type: "notifySettings" });
    expect(view.dialogContext).toEqual({ kind: "notifySettings" });
    expect(view.openDialog, "ダイアログのモードに入る（端末へキーを流さない）").toBe("notifySettings");
  });

  it("nextNotification で次の知らせへ移る", () => {
    const conn = makeConnection();
    const focusNext = vi.fn();
    const { dispatcher } = makeDispatcher(conn, { notifications: { focusNext } });
    dispatcher.run({ type: "nextNotification" });
    expect(focusNext).toHaveBeenCalledOnce();
  });

  it("通知を繋いでいなくても落ちない（テスト・古い呼び出し元）", () => {
    const { dispatcher } = makeDispatcher(makeConnection());
    expect(() => dispatcher.run({ type: "nextNotification" })).not.toThrow();
  });
});
