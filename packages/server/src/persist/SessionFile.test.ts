import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTempDir } from "./atomicFile.js";
import { FsSessionFile, type SessionFileData } from "./SessionFile.js";

function sample(): SessionFileData {
  return {
    schema: 1,
    savedAt: "2026-09-18T10:00:00Z",
    nextId: { w: 2, t: 2, p: 2, s: 1, a: 1 },
    workspaces: [
      {
        id: "w1",
        label: "api",
        cwd: "/home/u/api",
        activeTabId: "t1",
        tabs: [
          {
            id: "t1",
            label: "agents",
            focusedPaneId: "p1",
            zoomedPaneId: null,
            layout: { type: "pane", paneId: "p1" },
            panes: [{ id: "p1", label: null, cwd: "/home/u/api", shell: "/bin/bash" }],
          },
        ],
      },
    ],
    focus: { workspaceId: "w1", tabId: "t1", paneId: "p1" },
  };
}

describe("FsSessionFile", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempDir("wtm-session-");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reports missing before the first save", async () => {
    const file = new FsSessionFile(dir);
    const result = await file.load();
    expect(result.kind).toBe("missing");
  });

  it("round-trips a saved session", async () => {
    const file = new FsSessionFile(dir);
    const data = sample();
    await file.save(data);
    const result = await file.load();
    expect(result).toEqual({ kind: "ok", data });
  });

  // 20260921-workspace-auto-label：名前が自動かの印は任意の項目。以前の版の保存（印が無い）も読める。
  it("workspace の autoLabel は有っても無くても読め、そのまま往復する", async () => {
    const file = new FsSessionFile(dir);
    const data = sample();
    const withFlag: SessionFileData = { ...data, workspaces: [{ ...data.workspaces[0]!, autoLabel: true }] };
    await file.save(withFlag);
    expect(await file.load()).toEqual({ kind: "ok", data: withFlag });
    await file.save(data); // 以前の版の形（印が無い）
    expect(await file.load()).toEqual({ kind: "ok", data });
  });

  it("reports corrupt for an unsupported schema version", async () => {
    const file = new FsSessionFile(dir);
    // 直接壊れたスキーマを書き込む（将来のバージョンからの読み込みなど）。
    const { writeFileAtomic } = await import("./atomicFile.js");
    const { join } = await import("node:path");
    await writeFileAtomic(join(dir, "session.json"), JSON.stringify({ schema: 99, workspaces: [] }));
    const result = await file.load();
    expect(result.kind).toBe("corrupt");
  });
});
