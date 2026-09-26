import { describe, expect, it } from "vitest";
import type { ProcessInspector } from "../platform/ProcessInspector.js";
import type { PtyBackend, PtyProcess, PtySpawnOptions } from "../pty/PtyBackend.js";
import { DefaultTerminalManager } from "./TerminalManager.js";

class RecordingBackend implements PtyBackend {
  readonly spawned: PtySpawnOptions[] = [];
  spawn(opts: PtySpawnOptions): PtyProcess {
    this.spawned.push(opts);
    const noop = { dispose: () => undefined };
    return {
      pid: 1,
      onData: () => noop,
      onExit: () => noop,
      write: () => undefined,
      resize: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      kill: () => undefined,
    };
  }
}

const inspector = {
  defaultShell: () => ({ shell: "/bin/default", args: ["-l"] }),
} as unknown as ProcessInspector;

describe("DefaultTerminalManager — 起動の引数（20260926-edit-scrollback）", () => {
  it("shell と args を渡せば、その argv で起動する", () => {
    const backend = new RecordingBackend();
    const manager = new DefaultTerminalManager(backend, inspector, 100);
    manager.create("p1", {
      cwd: "/",
      shell: "/bin/sh",
      args: ["-c", "echo", "x"],
      cols: 80,
      rows: 24,
    });
    expect(backend.spawned.map((o) => [o.shell, o.args])).toEqual([
      ["/bin/sh", ["-c", "echo", "x"]],
    ]);
    manager.dispose("p1");
  });

  it("shell だけなら引数なし、どちらも無ければ OS の既定のシェルとその引数（今までどおり）", () => {
    const backend = new RecordingBackend();
    const manager = new DefaultTerminalManager(backend, inspector, 100);
    manager.create("p1", { cwd: "/", shell: "/bin/zsh", cols: 80, rows: 24 });
    manager.create("p2", { cwd: "/", cols: 80, rows: 24 });
    expect(backend.spawned.map((o) => [o.shell, o.args])).toEqual([
      ["/bin/zsh", []],
      ["/bin/default", ["-l"]],
    ]);
    manager.dispose("p1");
    manager.dispose("p2");
  });
});
