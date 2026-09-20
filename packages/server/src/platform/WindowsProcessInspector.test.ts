import { describe, expect, it } from "vitest";
import { parseWindowsCommandLine, WindowsProcessInspector, type WindowsProcessTreeNode, type WindowsProcessTreeProvider } from "./WindowsProcessInspector.js";

class FakeTreeProvider implements WindowsProcessTreeProvider {
  constructor(private readonly tree: WindowsProcessTreeNode | undefined) {}
  async getProcessTree(_rootPid: number): Promise<WindowsProcessTreeNode | undefined> {
    return this.tree;
  }
}

describe("WindowsProcessInspector", () => {
  it("returns null when the shell pid cannot be found", async () => {
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(undefined));
    expect(await inspector.foreground(100)).toBeNull();
  });

  it("returns the shell itself when it has no children", async () => {
    const tree: WindowsProcessTreeNode = { pid: 100, name: "powershell.exe", children: [] };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const fg = await inspector.foreground(100);
    expect(fg).toEqual({ pid: 100, exe: "powershell.exe", argv: ["powershell.exe"], cwd: null });
    expect(inspector.isBusy(100, fg)).toBe(false);
  });

  it("walks to the deepest single-child descendant (e.g. npm -> node -> claude)", async () => {
    const tree: WindowsProcessTreeNode = {
      pid: 100,
      name: "powershell.exe",
      children: [
        {
          pid: 101,
          name: "npm.cmd",
          commandLine: "npm.cmd exec claude",
          children: [
            {
              pid: 102,
              name: "node.exe",
              commandLine: 'node.exe "C:\\claude\\cli.js" --resume abc',
              children: [],
            },
          ],
        },
      ],
    };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const fg = await inspector.foreground(100);
    expect(fg?.pid).toBe(102);
    expect(fg?.argv).toEqual(["node.exe", "C:\\claude\\cli.js", "--resume", "abc"]);
    expect(inspector.isBusy(100, fg)).toBe(true);
  });

  it("foregroundJob returns every process along the path from shell to the deepest descendant (D45・T5)", async () => {
    const tree: WindowsProcessTreeNode = {
      pid: 100,
      name: "powershell.exe",
      children: [
        {
          pid: 101,
          name: "npm.cmd",
          commandLine: "npm.cmd exec claude",
          children: [
            { pid: 102, name: "node.exe", commandLine: 'node.exe "C:\\claude\\cli.js" --resume abc', children: [] },
          ],
        },
      ],
    };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const job = await inspector.foregroundJob(100);
    expect(job).not.toBeNull();
    expect(job?.processGroupId).toBe(100);
    expect(job?.processes.map((p) => p.pid)).toEqual([100, 101, 102]); // シェル自身から末端まで全部
    expect(job?.processes[2]?.argv).toEqual(["node.exe", "C:\\claude\\cli.js", "--resume", "abc"]);
  });

  it("foregroundJob follows the deeper branch when the tree forks (deepestPathNodes。review 指摘。should。既存の fork/tie-break のテストは foreground() だけを使い、foregroundJob 側の新しい deepestPathNodes を経由していなかった)", async () => {
    const tree: WindowsProcessTreeNode = {
      pid: 1,
      name: "shell",
      children: [
        { pid: 2, name: "shallow", children: [] },
        { pid: 3, name: "deep1", children: [{ pid: 4, name: "deep2", children: [] }] },
      ],
    };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const job = await inspector.foregroundJob(1);
    expect(job?.processes.map((p) => p.pid)).toEqual([1, 3, 4]); // shell → 深い方の枝を通しで全部（浅い枝2は含まない）
  });

  it("foregroundJob: 深さが同点の枝では、最初に見つかった枝の経路をそのまま返す（deepestPathNodes のタイブレーク）", async () => {
    const tree: WindowsProcessTreeNode = {
      pid: 1,
      name: "shell",
      children: [
        { pid: 2, name: "first-branch", children: [{ pid: 20, name: "first-leaf", children: [] }] },
        { pid: 3, name: "second-branch", children: [{ pid: 30, name: "second-leaf", children: [] }] },
      ],
    };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const job = await inspector.foregroundJob(1);
    expect(job?.processes.map((p) => p.pid)).toEqual([1, 2, 20]); // 最初の枝の経路（3・30 は含まない）
  });

  it("foregroundJob returns null when the process tree cannot be found", async () => {
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(undefined));
    expect(await inspector.foregroundJob(999)).toBeNull();
  });

  it("picks the deeper branch when the tree forks", async () => {
    const tree: WindowsProcessTreeNode = {
      pid: 1,
      name: "shell",
      children: [
        { pid: 2, name: "shallow", children: [] },
        { pid: 3, name: "deep1", children: [{ pid: 4, name: "deep2", children: [] }] },
      ],
    };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const fg = await inspector.foreground(1);
    expect(fg?.pid).toBe(4);
  });

  it("tie-break: with equal-depth branches, picks the first one found (レビュー指摘の回帰テスト)", async () => {
    const tree: WindowsProcessTreeNode = {
      pid: 1,
      name: "shell",
      children: [
        { pid: 2, name: "first-branch", children: [{ pid: 20, name: "first-leaf", children: [] }] },
        { pid: 3, name: "second-branch", children: [{ pid: 30, name: "second-leaf", children: [] }] },
      ],
    };
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(tree));
    const fg = await inspector.foreground(1);
    expect(fg?.pid).toBe(20); // 最初の枝（同じ深さなら後の枝で上書きしない）
  });

  it("defaultShell is powershell.exe", () => {
    const inspector = new WindowsProcessInspector(new FakeTreeProvider(undefined));
    expect(inspector.defaultShell().shell).toBe("powershell.exe");
  });
});

describe("parseWindowsCommandLine", () => {
  it("splits unquoted arguments on whitespace", () => {
    expect(parseWindowsCommandLine("node.exe cli.js --resume abc", "node.exe")).toEqual([
      "node.exe",
      "cli.js",
      "--resume",
      "abc",
    ]);
  });

  it("keeps quoted segments together", () => {
    expect(parseWindowsCommandLine('node.exe "C:\\Program Files\\claude\\cli.js"', "node.exe")).toEqual([
      "node.exe",
      "C:\\Program Files\\claude\\cli.js",
    ]);
  });

  it("falls back to the executable name when there is no command line", () => {
    expect(parseWindowsCommandLine(undefined, "node.exe")).toEqual(["node.exe"]);
  });
});
