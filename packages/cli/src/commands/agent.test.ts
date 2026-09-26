import type { AgentInfo, ServerEvent } from "@wtm/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionStore } from "../session.js";
import { RpcFailure, type WtmClient } from "../wsClient.js";
import { runAgentGet, runAgentList, runAgentRead, runAgentWait } from "./agent.js";

vi.mock("../withSession.js", () => ({ withSession: vi.fn() }));
vi.mock("../output.js", () => ({ printJson: vi.fn(), printLine: vi.fn(), printRaw: vi.fn() }));

import { printJson, printLine } from "../output.js";
import { withSession } from "../withSession.js";

const mockedWithSession = vi.mocked(withSession);
const mockedPrintJson = vi.mocked(printJson);
const mockedPrintLine = vi.mocked(printLine);

function agent(patch: Partial<AgentInfo> = {}): AgentInfo {
  return {
    instanceId: "a1",
    kind: "claude",
    label: "Claude Code",
    state: "working",
    completionSeq: 0,
    serverSeenSeq: 0,
    verified: true,
    since: 1000,
    ...patch,
  };
}

interface PaneSeed {
  id: string;
  tabId: string;
  agent: AgentInfo | null;
}

interface FakeClient extends WtmClient {
  emitEvent(evt: ServerEvent): void;
  emitSnapshot(paneId: string, text: string): void;
  emitClose(code: number, reason: string): void;
}

/**
 * 実物の `WsWtmClient` と同じく、`hello(cb)` は応答を受け取ったその場で `cb` を購読に加える。`withHello` は応答と
 * 同じ受信の塊で直後に届くイベント（購読の登録より後・Promise の続きより前に配られる）、`beforeHello` は応答より
 * 前に届いた（snapshot より古い）イベントを模す。
 */
function fakeClient(
  panes: PaneSeed[],
  opts: { beforeHello?: ServerEvent[]; withHello?: ServerEvent[] } = {},
): FakeClient {
  const eventCbs: ((evt: ServerEvent) => void)[] = [];
  const snapshotCbs: ((paneId: string, cols: number, rows: number, text: string) => void)[] = [];
  const closeCbs: ((code: number, reason: string) => void)[] = [];
  const emitEvent = (evt: ServerEvent): void => eventCbs.forEach((cb) => cb(evt));
  return {
    hello: vi.fn((cb?: (evt: ServerEvent) => void) => {
      (opts.beforeHello ?? []).forEach(emitEvent);
      if (cb) eventCbs.push(cb);
      (opts.withHello ?? []).forEach(emitEvent);
      return Promise.resolve({
        clientId: "c1",
        snapshot: {
          panes,
          tabs: [
            { id: "t1", workspaceId: "w1" },
            { id: "t2", workspaceId: "w2" },
          ],
          limits: { scrollbackLines: 5000 },
        },
      });
    }),
    request: vi.fn(() => Promise.resolve({})),
    sendInput: vi.fn(),
    onEvent: vi.fn((cb: (evt: ServerEvent) => void) => eventCbs.push(cb)),
    onOutput: vi.fn(),
    onSnapshot: vi.fn((cb: (paneId: string, cols: number, rows: number, text: string) => void) =>
      snapshotCbs.push(cb),
    ),
    onClose: vi.fn((cb: (code: number, reason: string) => void) => closeCbs.push(cb)),
    close: vi.fn(),
    emitEvent,
    emitSnapshot: (paneId: string, text: string) =>
      snapshotCbs.forEach((cb) => cb(paneId, 80, 24, text)),
    emitClose: (code: number, reason: string) => closeCbs.forEach((cb) => cb(code, reason)),
  } as unknown as FakeClient;
}

function statusChanged(paneId: string, a: AgentInfo | null): ServerEvent {
  return { event: "pane.agent_status_changed", data: { paneId, agent: a } };
}

const OPTS = { url: "http://127.0.0.1:7780", token: undefined };
const store = {} as SessionStore;

function useClient(client: FakeClient): void {
  mockedWithSession.mockImplementation(async (_o, _s, fn) => fn(client));
}

/** `runAgentWait` が hello を送り、イベントの購読が始まるまで待つ。 */
async function waitForSubscription(client: FakeClient): Promise<void> {
  await vi.waitFor(() => expect(client.hello).toHaveBeenCalledWith(expect.any(Function)));
}

beforeEach(() => {
  mockedWithSession.mockReset();
  mockedPrintJson.mockReset();
  mockedPrintLine.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runAgentList", () => {
  it("エージェントの居る pane だけを、workspace と状態（done を含む）つきで並べる", async () => {
    useClient(
      fakeClient([
        {
          id: "p1",
          tabId: "t1",
          agent: agent({ state: "idle", completionSeq: 1, serverSeenSeq: 0 }),
        },
        { id: "p2", tabId: "t1", agent: null },
        {
          id: "p3",
          tabId: "t2",
          agent: agent({ instanceId: "a3", kind: "codex", state: "blocked" }),
        },
      ]),
    );
    await runAgentList({ kind: "agent-list", opts: OPTS }, store);
    expect(mockedWithSession).toHaveBeenCalledWith(OPTS, store, expect.any(Function));
    const out = mockedPrintJson.mock.calls[0]![0] as {
      agents: { paneId: string; workspaceId: string; status: string }[];
    };
    expect(out.agents.map((a) => [a.paneId, a.workspaceId, a.status])).toEqual([
      ["p1", "w1", "done"],
      ["p3", "w2", "blocked"],
    ]);
  });

  it("1 件も無ければ空の一覧", async () => {
    useClient(fakeClient([{ id: "p1", tabId: "t1", agent: null }]));
    await runAgentList({ kind: "agent-list", opts: OPTS }, store);
    expect(mockedPrintJson).toHaveBeenCalledWith({ agents: [] });
  });
});

describe("runAgentGet", () => {
  it("{ agent } の形で 1 件を出す", async () => {
    useClient(fakeClient([{ id: "p1", tabId: "t1", agent: agent({ state: "idle" }) }]));
    await runAgentGet({ kind: "agent-get", opts: OPTS, paneId: "p1" }, store);
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({
        paneId: "p1",
        tabId: "t1",
        workspaceId: "w1",
        status: "idle",
        kind: "claude",
      }),
    });
  });

  it.each([
    ["pane が無い", "p9"],
    ["エージェントが居ない", "p2"],
  ])("%s なら agent_not_found", async (_label, paneId) => {
    useClient(fakeClient([{ id: "p2", tabId: "t1", agent: null }]));
    await expect(
      runAgentGet({ kind: "agent-get", opts: OPTS, paneId }, store),
    ).rejects.toMatchObject({
      code: "agent_not_found",
    });
    expect(mockedPrintJson).not.toHaveBeenCalled();
  });
});

describe("runAgentWait", () => {
  const waitCmd = (
    patch: {
      until?: ("working" | "blocked" | "idle" | "done" | "unknown")[];
      timeoutMs?: number;
    } = {},
  ) => ({
    kind: "agent-wait" as const,
    opts: OPTS,
    paneId: "p1",
    until: patch.until ?? [],
    timeoutMs: patch.timeoutMs,
  });

  it("呼び出し時点で一致していれば、イベントを待たずに返す", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent({ state: "blocked" }) }]);
    useClient(client);
    await runAgentWait(waitCmd(), store);
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({ status: "blocked" }),
    });
  });

  it("working の間は返らず、idle（未読の完了あり）になったら done で返る", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent({ state: "working" }) }]);
    useClient(client);
    let done = false;
    const p = runAgentWait(waitCmd(), store).then(() => (done = true));
    await waitForSubscription(client);

    client.emitEvent(statusChanged("p1", agent({ state: "unknown" })));
    client.emitEvent(statusChanged("p2", agent({ instanceId: "other", state: "idle" })));
    await Promise.resolve();
    expect(done).toBe(false);

    client.emitEvent(statusChanged("p1", agent({ state: "idle", completionSeq: 1 })));
    await p;
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({
        paneId: "p1",
        status: "done",
        state: "idle",
        completionSeq: 1,
      }),
    });
  });

  it("hello の応答と同じ受信の塊で直後に届いたイベントも取りこぼさない", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent({ state: "working" }) }], {
      withHello: [statusChanged("p1", agent({ state: "blocked" }))],
    });
    useClient(client);
    await runAgentWait(waitCmd({ timeoutMs: 1000 }), store);
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({ status: "blocked" }),
    });
  });

  it("hello の応答より前に届いた（snapshot より古い）イベントでは判定しない", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent({ state: "working" }) }], {
      beforeHello: [statusChanged("p1", agent({ state: "idle" }))],
    });
    useClient(client);
    let done = false;
    const p = runAgentWait(waitCmd(), store).then(() => (done = true));
    await waitForSubscription(client);
    await new Promise((r) => setImmediate(r));
    expect(done).toBe(false);
    client.emitEvent(statusChanged("p1", agent({ state: "idle", completionSeq: 1 })));
    await p;
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({ status: "done" }),
    });
  });

  it("--until を複数指定するとそのどれかで返る（既定外の working でも）", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent({ state: "idle" }) }]);
    useClient(client);
    const p = runAgentWait(waitCmd({ until: ["working", "unknown"] }), store);
    await waitForSubscription(client);
    client.emitEvent(statusChanged("p1", agent({ state: "blocked" })));
    client.emitEvent(statusChanged("p1", agent({ state: "working" })));
    await p;
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({ status: "working" }),
    });
  });

  it("pane が別の tab へ移ったら、出力の tabId/workspaceId を移動後の値にする", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const p = runAgentWait(waitCmd(), store);
    await waitForSubscription(client);
    client.emitEvent({
      event: "tab.created",
      data: { tab: { id: "t3", workspaceId: "w3" } },
    } as ServerEvent);
    client.emitEvent({
      event: "pane.updated",
      data: { pane: { id: "p1", tabId: "t3" } },
    } as ServerEvent);
    client.emitEvent(statusChanged("p1", agent({ state: "idle" })));
    await p;
    expect(mockedPrintJson).toHaveBeenCalledWith({
      agent: expect.objectContaining({ tabId: "t3", workspaceId: "w3" }),
    });
  });

  it.each([
    ["エージェントが居なくなる（null）", statusChanged("p1", null)],
    [
      "別のエージェントに入れ替わる（instanceId が違う）",
      statusChanged("p1", agent({ instanceId: "a2", state: "idle" })),
    ],
    ["pane が閉じる", { event: "pane.closed", data: { paneId: "p1" } } as ServerEvent],
  ])("%s と agent_not_running", async (_label, evt) => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const p = runAgentWait(waitCmd(), store);
    await waitForSubscription(client);
    client.emitEvent({ event: "pane.closed", data: { paneId: "p2" } } as ServerEvent);
    client.emitEvent(evt);
    await expect(p).rejects.toMatchObject({ code: "agent_not_running" });
    expect(mockedPrintJson).not.toHaveBeenCalled();
  });

  it("--timeout 内に一致しなければ timeout", async () => {
    vi.useFakeTimers();
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const p = runAgentWait(waitCmd({ timeoutMs: 1000 }), store);
    const settled = p.then(
      () => "resolved",
      (e: unknown) => e,
    );
    await waitForSubscription(client);
    await vi.advanceTimersByTimeAsync(999);
    client.emitEvent(statusChanged("p1", agent({ state: "working" })));
    await vi.advanceTimersByTimeAsync(1);
    const result = await settled;
    expect(result).toBeInstanceOf(RpcFailure);
    expect(result).toMatchObject({
      code: "timeout",
      message: "timed out waiting for agent status",
    });
  });

  it("--timeout を省略すると時間切れのタイマーを持たない（RPC の上限 10 秒より長く待っても返らない）", async () => {
    vi.useFakeTimers();
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    let settled = false;
    const p = runAgentWait(waitCmd(), store).finally(() => (settled = true));
    await waitForSubscription(client);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
    client.emitEvent(statusChanged("p1", agent({ state: "idle" })));
    await p;
  });

  it("一致したらタイマーを解除する", async () => {
    vi.useFakeTimers();
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const p = runAgentWait(waitCmd({ timeoutMs: 5000 }), store);
    await waitForSubscription(client);
    expect(vi.getTimerCount()).toBe(1);
    client.emitEvent(statusChanged("p1", agent({ state: "idle" })));
    await p;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("待っている間にサーバが切断したら connection_closed", async () => {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const p = runAgentWait(waitCmd(), store);
    await waitForSubscription(client);
    client.emitClose(1006, "");
    await expect(p).rejects.toMatchObject({ code: "connection_closed" });
  });

  it.each([
    ["pane が無い", "p9"],
    ["エージェントが居ない", "p2"],
  ])("%s なら agent_not_found", async (_label, paneId) => {
    useClient(fakeClient([{ id: "p2", tabId: "t1", agent: null }]));
    await expect(runAgentWait({ ...waitCmd(), paneId }, store)).rejects.toMatchObject({
      code: "agent_not_found",
    });
  });
});

describe("runAgentRead", () => {
  const readCmd = (patch: { raw?: boolean; lines?: number; timeoutMs?: number } = {}) => ({
    kind: "agent-read" as const,
    opts: OPTS,
    paneId: "p1",
    lines: patch.lines ?? 80,
    raw: patch.raw ?? false,
    timeoutMs: patch.timeoutMs ?? 5000,
  });

  async function readWith(
    text: string,
    patch: { raw?: boolean; lines?: number } = {},
  ): Promise<FakeClient> {
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const p = runAgentRead(readCmd(patch), store);
    await vi.waitFor(() =>
      expect(client.request).toHaveBeenCalledWith("pane.subscribe", {
        paneId: "p1",
        scrollbackLines: 5000,
      }),
    );
    client.emitSnapshot("p1", text);
    await p;
    return client;
  }

  it("既定は ANSI を除去し、末尾の空行を除いた最後の 80 行を出して、購読を解除する", async () => {
    const lines = Array.from({ length: 100 }, (_v, i) => `\u001B[1mline${i}\u001B[0m`);
    const client = await readWith(`${lines.join("\r\n")}\r\n\r\n`);
    const expected = Array.from({ length: 80 }, (_v, i) => `line${i + 20}`).join("\n");
    expect(mockedPrintLine).toHaveBeenCalledWith(expected);
    expect(client.request).toHaveBeenCalledWith("pane.unsubscribe", { paneId: "p1" });
  });

  it("alt screen のエージェントでは、通常画面の履歴を混ぜず今の画面だけを読む", async () => {
    await readWith("$ ls\r\nfileA\r\n$ codex\u001B[?1049h\u001B[HALT-ROW-1\r\nALT-ROW-2\r\n");
    expect(mockedPrintLine).toHaveBeenCalledWith("ALT-ROW-1\nALT-ROW-2");
  });

  it("--lines と --raw", async () => {
    await readWith("a\r\n\u001B[31mb\u001B[0m\r\nc", { raw: true, lines: 2 });
    expect(mockedPrintLine).toHaveBeenCalledWith("\u001B[31mb\u001B[0m\nc");
  });

  it("SNAPSHOT が --timeout 内に来なければ timeout", async () => {
    vi.useFakeTimers();
    const client = fakeClient([{ id: "p1", tabId: "t1", agent: agent() }]);
    useClient(client);
    const settled = runAgentRead(readCmd({ timeoutMs: 300 }), store).then(
      () => "resolved",
      (e: unknown) => e,
    );
    await vi.waitFor(() => expect(client.request).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(300);
    expect(await settled).toMatchObject({ code: "timeout" });
  });

  it.each([
    ["pane が無い", "p9"],
    ["エージェントが居ない", "p2"],
  ])("%s なら agent_not_found で、購読もしない", async (_label, paneId) => {
    const client = fakeClient([{ id: "p2", tabId: "t1", agent: null }]);
    useClient(client);
    await expect(runAgentRead({ ...readCmd(), paneId }, store)).rejects.toMatchObject({
      code: "agent_not_found",
    });
    expect(client.request).not.toHaveBeenCalled();
  });
});
