import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionStore } from "../session.js";
import type { WtmClient } from "../wsClient.js";
import { runTabClose, runTabCreate } from "./tab.js";

vi.mock("../withSession.js", () => ({ withSession: vi.fn() }));
vi.mock("../output.js", () => ({ printJson: vi.fn(), printLine: vi.fn() }));

import { printJson } from "../output.js";
import { withSession } from "../withSession.js";

const mockedWithSession = vi.mocked(withSession);
const mockedPrintJson = vi.mocked(printJson);

function fakeClient(requestImpl: (method: string, params: unknown) => unknown): WtmClient {
  return {
    hello: vi.fn().mockResolvedValue({ clientId: "c1", snapshot: {} }),
    request: vi.fn(requestImpl) as unknown as WtmClient["request"],
    sendInput: vi.fn(),
    onEvent: vi.fn(),
    onOutput: vi.fn(),
    onSnapshot: vi.fn(),
    onClose: vi.fn(),
    close: vi.fn(),
  } as unknown as WtmClient;
}

const OPTS = { url: "http://127.0.0.1:7780", token: undefined };
const store = {} as SessionStore;

beforeEach(() => {
  mockedWithSession.mockReset();
  mockedPrintJson.mockReset();
});

describe("runTabCreate", () => {
  it("workspaceId/label を渡すとその値で tab.create を呼ぶ", async () => {
    const client = fakeClient(() => ({ tab: { id: "t1" }, pane: { id: "p1" } }));
    mockedWithSession.mockImplementation(async (_opts, _store, fn) => fn(client));

    await runTabCreate({ kind: "tab-create", opts: OPTS, workspaceId: "w1", label: "logs" }, store);

    expect(client.request).toHaveBeenCalledWith("tab.create", { workspaceId: "w1", label: "logs" });
    expect(mockedPrintJson).toHaveBeenCalledWith({ tab: { id: "t1" }, pane: { id: "p1" } });
  });

  it("workspaceId/label 省略時はキーを持たないオブジェクトを渡す", async () => {
    const client = fakeClient(() => ({}));
    mockedWithSession.mockImplementation(async (_opts, _store, fn) => fn(client));

    await runTabCreate({ kind: "tab-create", opts: OPTS, workspaceId: undefined, label: undefined }, store);

    expect(client.request).toHaveBeenCalledWith("tab.create", {});
  });
});

describe("runTabClose", () => {
  it("tab.close を呼ぶ", async () => {
    const client = fakeClient(() => ({}));
    mockedWithSession.mockImplementation(async (_opts, _store, fn) => fn(client));

    await runTabClose({ kind: "tab-close", opts: OPTS, tabId: "t1" }, store);

    expect(client.request).toHaveBeenCalledWith("tab.close", { tabId: "t1" });
  });
});
