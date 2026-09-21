import { Terminal } from "@xterm/xterm";
import { describe, expect, it } from "vitest";

/**
 * テスト環境（happy-dom）で実物の @xterm/xterm が生成・write・パーサのハンドラの登録まで動くことを確かめる
 * 足場の確認（T2）。各部品（QueryFilter 等）のテストがこの前提の上に立つので、恒久的な回帰として残す。
 */
describe("xterm smoke (happy-dom)", () => {
  it("creates a Terminal, opens it into a DOM element, and writes text", async () => {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    const el = document.createElement("div");
    document.body.appendChild(el);
    term.open(el);

    await new Promise<void>((resolve) => {
      term.write("hello", () => resolve());
    });

    expect(term.buffer.active.getLine(0)?.translateToString(true)).toBe("hello");
    term.dispose();
  });

  it("registers a CSI handler and can intercept a query without emitting a response", async () => {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    term.open(document.createElement("div"));
    let responded = false;
    term.onData(() => {
      responded = true;
    });
    term.parser.registerCsiHandler({ final: "c" }, () => true);
    term.write("\x1b[c");
    // xterm.js の問い合わせへの応答は write() の直後ではなくマクロタスクで届く（QueryFilter.test.ts で実測）。
    // ここで待たずに確認すると、実際には握りつぶせていなくても「まだ出ていないだけ」で誤って通る。
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(responded).toBe(false);
    term.dispose();
  });
});
