import { describe, expect, it } from "vitest";
import { NodePtyBackend } from "../pty/NodePtyBackend.js";
import { DefaultTerminalHost } from "./TerminalHost.js";

// 実物のシェル（cat：入力をそのまま返す）で、出力の経路・問い合わせへの応答・resize・exit を確かめる。
describe.skipIf(process.platform === "win32")("DefaultTerminalHost (integration)", () => {
  it("mirrors output to both the client (via fanout) and the mirror, and answers queries by writing back to the pty", async () => {
    // `stty raw -echo` で正準モード（行バッファリング・カーネルのカレット表示エコー）を外す。
    // 素の cat のままだと、改行が来るまで cat が入力を読まず、カーネルの表示用エコー
    // （ESC を "^[" と表示する）が先に返ってしまい、DA1 と認識されない（実機で確認済み）。
    // 実際の対話アプリ（vim・claude 等）は起動時に raw モードへ切り替えるので、この設定は実態に近い。
    const backend = new NodePtyBackend();
    const proc = backend.spawn({ shell: "/bin/sh", args: ["-c", "stty raw -echo; cat"], cwd: process.cwd(), env: process.env as Record<string, string>, cols: 80, rows: 24 });
    const host = new DefaultTerminalHost("p1", proc, 80, 24, 1000);
    try {
      // 問い合わせ（DA1）を pane へ送ると、ミラーが応答を作り、TerminalHost がそれを PTY（cat）へ書き戻す。
      // cat はそれをそのままエコーするので、OUTPUT 経路に DA1 の応答が現れるはずである。
      const outputs: string[] = [];
      const fanoutPush = host.fanout.push.bind(host.fanout);
      host.fanout.push = (chunk: Uint8Array) => {
        outputs.push(new TextDecoder().decode(chunk));
        fanoutPush(chunk);
      };
      // stty が raw モードへ切り替わるまでの短い猶予を置いてから問い合わせを送る（早すぎると
      // 正準モードのまま届いてしまう）。
      await new Promise((r) => setTimeout(r, 100));
      host.write("\x1b[c");
      await waitFor(() => outputs.join("").includes("\x1b[?1;2c"), 2000);
      expect(outputs.join("")).toContain("\x1b[?1;2c");
    } finally {
      host.dispose();
    }
  });

  it("updates lastOutputAt when data arrives", async () => {
    const backend = new NodePtyBackend();
    const proc = backend.spawn({ shell: "/bin/sh", args: ["-c", "cat"], cwd: process.cwd(), env: process.env as Record<string, string>, cols: 80, rows: 24 });
    const host = new DefaultTerminalHost("p1", proc, 80, 24, 1000);
    try {
      const before = host.lastOutputAt();
      await new Promise((r) => setTimeout(r, 20));
      host.write("hello\n");
      await new Promise((r) => setTimeout(r, 100));
      expect(host.lastOutputAt()).toBeGreaterThan(before);
    } finally {
      host.dispose();
    }
  });

  it("fires onExit when the shell exits, and disposing does not throw afterward", async () => {
    const backend = new NodePtyBackend();
    const proc = backend.spawn({ shell: "/bin/sh", args: ["-c", "exit 7"], cwd: process.cwd(), env: process.env as Record<string, string>, cols: 80, rows: 24 });
    const host = new DefaultTerminalHost("p1", proc, 80, 24, 1000);
    try {
      const exitCode = await new Promise<number>((resolve) => host.onExit(resolve));
      expect(exitCode).toBe(7);
    } finally {
      expect(() => host.dispose()).not.toThrow();
    }
  });

  it("resize propagates to both the pty and the mirror", async () => {
    const backend = new NodePtyBackend();
    const proc = backend.spawn({ shell: "/bin/sh", args: ["-c", "cat"], cwd: process.cwd(), env: process.env as Record<string, string>, cols: 80, rows: 24 });
    const host = new DefaultTerminalHost("p1", proc, 80, 24, 1000);
    try {
      host.resize(120, 40);
      const snap = host.mirror.serialize(0);
      expect(snap.cols).toBe(120);
      expect(snap.rows).toBe(40);
    } finally {
      host.dispose();
    }
  });
});

async function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 20));
  }
}
