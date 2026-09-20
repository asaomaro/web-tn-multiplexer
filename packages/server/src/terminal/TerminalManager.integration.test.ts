import { describe, expect, it } from "vitest";
import { NodePtyBackend } from "../pty/NodePtyBackend.js";
import { LinuxProcessInspector } from "../platform/LinuxProcessInspector.js";
import { DefaultTerminalManager } from "./TerminalManager.js";

describe.skipIf(process.platform === "win32")("DefaultTerminalManager (integration)", () => {
  it("creates a host reachable via get(), and dispose() removes it", async () => {
    const manager = new DefaultTerminalManager(new NodePtyBackend(), new LinuxProcessInspector(), 1000);
    const host = manager.create("p1", { cwd: process.cwd(), shell: "/bin/sh", cols: 80, rows: 24 });
    expect(manager.get("p1")).toBe(host);
    manager.dispose("p1");
    expect(manager.get("p1")).toBeUndefined();
  });

  it("uses the process inspector's default shell when none is given", () => {
    const manager = new DefaultTerminalManager(new NodePtyBackend(), new LinuxProcessInspector(), 1000);
    const host = manager.create("p1", { cwd: process.cwd(), cols: 80, rows: 24 });
    expect(host.pid).toBeGreaterThan(0);
    manager.dispose("p1");
  });

  it("removes the host automatically when the shell exits on its own", async () => {
    const manager = new DefaultTerminalManager(new NodePtyBackend(), new LinuxProcessInspector(), 1000);
    // CreatePaneOptions には引数を渡す口が無いので、それ自体で即終了するプログラムを使う。
    const host = manager.create("p1", { cwd: process.cwd(), shell: "/bin/true", cols: 80, rows: 24 });
    await new Promise<void>((resolve) => host.onExit(() => resolve()));
    await new Promise((r) => setTimeout(r, 20)); // onExit のリスナーが呼ばれた後、Map から消えるまでの猶予
    expect(manager.get("p1")).toBeUndefined();
  });

  it("resize() forwards to the host", () => {
    const manager = new DefaultTerminalManager(new NodePtyBackend(), new LinuxProcessInspector(), 1000);
    const host = manager.create("p1", { cwd: process.cwd(), shell: "/bin/sh", cols: 80, rows: 24 });
    manager.resize("p1", 100, 30);
    expect(host.mirror.serialize(0)).toMatchObject({ cols: 100, rows: 30 });
    manager.dispose("p1");
  });
});
