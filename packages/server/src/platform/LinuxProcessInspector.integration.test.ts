import { describe, expect, it } from "vitest";
import { NodePtyBackend } from "../pty/NodePtyBackend.js";
import { LinuxProcessInspector } from "./LinuxProcessInspector.js";

// /proc を直接読むので、Linux 上で実物のプロセスを使って確かめる（T7「テスト方針」）。
// tpgid は制御端末を持つプロセスにしか付かないため、plain な child_process ではなく PTY 経由で起動する。
describe.skipIf(process.platform !== "linux")("LinuxProcessInspector (integration)", () => {
  it("reports the shell itself as foreground when it has no child", async () => {
    const backend = new NodePtyBackend();
    const pty = backend.spawn({
      shell: "/bin/sh",
      args: [],
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      cols: 80,
      rows: 24,
    });
    try {
      await new Promise((r) => setTimeout(r, 150));
      const inspector = new LinuxProcessInspector();
      const fg = await inspector.foreground(pty.pid);
      expect(fg).not.toBeNull();
      expect(fg?.pid).toBe(pty.pid); // シェル自身が前面（子プロセスが無い）
      expect(fg?.cwd).toBe(process.cwd());
    } finally {
      pty.kill();
    }
  });

  it("reports a foreground child process (e.g. sleep) instead of the shell", async () => {
    // `sh -c "cmd"` は非対話（job control 無し）で、シェル自身が foreground pgrp のままになる
    // （dash で実測済み）。実際の pane は対話シェルなので、bash を対話起動して
    // プロンプトへコマンドを打ち込む形で試験する（job control が働き、tpgid が子のものに変わる）。
    const backend = new NodePtyBackend();
    const pty = backend.spawn({
      shell: "/bin/bash",
      args: ["--norc", "--noprofile"],
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      cols: 80,
      rows: 24,
    });
    try {
      await new Promise((r) => setTimeout(r, 200));
      pty.write("sleep 5\n");
      await new Promise((r) => setTimeout(r, 300));
      const inspector = new LinuxProcessInspector();
      const fg = await inspector.foreground(pty.pid);
      expect(fg).not.toBeNull();
      expect(fg?.pid).not.toBe(pty.pid); // job control で別プロセスグループに変わっている
      expect(fg?.argv[0]).toContain("sleep");
      expect(inspector.isBusy(pty.pid, fg)).toBe(true);
    } finally {
      pty.kill();
    }
  });

  it("returns null for a pid that does not exist", async () => {
    const inspector = new LinuxProcessInspector();
    const fg = await inspector.foreground(999999);
    expect(fg).toBeNull();
  });

  it("foregroundJob reports the single foreground process for a plain command (D45・T5)", async () => {
    const backend = new NodePtyBackend();
    const pty = backend.spawn({ shell: "/bin/bash", args: ["--norc", "--noprofile"], cwd: process.cwd(), env: process.env as Record<string, string>, cols: 80, rows: 24 });
    try {
      await new Promise((r) => setTimeout(r, 200));
      pty.write("sleep 5\n");
      await new Promise((r) => setTimeout(r, 300));
      const inspector = new LinuxProcessInspector();
      const job = await inspector.foregroundJob(pty.pid);
      expect(job).not.toBeNull();
      expect(job?.processes.length).toBe(1);
      expect(job?.processes[0]?.argv[0]).toContain("sleep");
      // foreground()（単一プロセス）と一致する。
      const fg = await inspector.foreground(pty.pid);
      expect(job?.processGroupId).toBe(fg?.pid);
    } finally {
      pty.kill();
    }
  });

  it("foregroundJob collects every process in a pipeline's foreground group (D45・T5)", async () => {
    // パイプライン（`a | b`）は同じプロセスグループに複数のプロセスを作る。npm/node のラッパー越しの
    // 起動（D45）を模した最小のケース：グループの全メンバーを拾えることを確かめる。
    const backend = new NodePtyBackend();
    const pty = backend.spawn({ shell: "/bin/bash", args: ["--norc", "--noprofile"], cwd: process.cwd(), env: process.env as Record<string, string>, cols: 80, rows: 24 });
    try {
      await new Promise((r) => setTimeout(r, 200));
      pty.write("sleep 5 | cat\n");
      await new Promise((r) => setTimeout(r, 300));
      const inspector = new LinuxProcessInspector();
      const job = await inspector.foregroundJob(pty.pid);
      expect(job).not.toBeNull();
      expect(job!.processes.length).toBeGreaterThanOrEqual(2);
      const names = job!.processes.map((p) => p.argv[0] ?? "");
      expect(names.some((n) => n.includes("sleep"))).toBe(true);
      expect(names.some((n) => n.includes("cat"))).toBe(true);
    } finally {
      pty.kill();
    }
  });

  it("foregroundJob returns null for a pid that does not exist", async () => {
    const inspector = new LinuxProcessInspector();
    expect(await inspector.foregroundJob(999999)).toBeNull();
  });

  it("defaultShell honors $SHELL, falling back to /bin/sh", () => {
    const inspector = new LinuxProcessInspector();
    const withShell = process.env["SHELL"];
    expect(inspector.defaultShell().shell).toBe(withShell || "/bin/sh");
  });

  it("isBusy is false for the shell itself and true for a different pid", () => {
    const inspector = new LinuxProcessInspector();
    expect(inspector.isBusy(100, { pid: 100, exe: "/bin/sh", argv: ["sh"], cwd: null })).toBe(false);
    expect(inspector.isBusy(100, { pid: 200, exe: "vim", argv: ["vim"], cwd: null })).toBe(true);
    expect(inspector.isBusy(100, null)).toBe(false);
  });
});
