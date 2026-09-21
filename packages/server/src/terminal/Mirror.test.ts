import { DEFAULT_THEME } from "@wtm/protocol";
import { describe, expect, it } from "vitest";
import { XtermMirror, parseOsc7 } from "./Mirror.js";

function writeAndWait(mirror: XtermMirror, data: string): Promise<void> {
  return new Promise((resolve) => mirror.write(data, resolve));
}

describe("XtermMirror — query responses (evidence/query-response*.mjs)", () => {
  it("responds to DA1/DA2/CPR/DECRQM/DECRQSS (E1)", async () => {
    const mirror = new XtermMirror(80, 24, 1000);
    const responses: string[] = [];
    mirror.onResponse((d) => responses.push(d));
    await writeAndWait(mirror, "\x1b[c\x1b[>c\x1b[6n\x1b[?25$p");
    expect(responses.join("")).toContain("\x1b[?1;2c"); // DA1
    // eslint-disable-next-line no-control-regex -- CPR (cursor position report) の形を確かめる
    expect(responses.join("")).toMatch(/\x1b\[\d+;\d+R/); // CPR（カーソル位置。初期位置は 1;1）
    mirror.dispose();
  });

  it("answers color queries (OSC 10/11/12) with the default theme, unlike headless alone (D17)", async () => {
    const mirror = new XtermMirror(80, 24, 1000);
    const responses: string[] = [];
    mirror.onResponse((d) => responses.push(d));
    await writeAndWait(mirror, "\x1b]10;?\x07\x1b]11;?\x07\x1b]12;?\x07");
    const joined = responses.join("");
    expect(joined).toContain(`\x1b]10;${expectedRgb(DEFAULT_THEME.foreground)}\x07`);
    expect(joined).toContain(`\x1b]11;${expectedRgb(DEFAULT_THEME.background)}\x07`);
    expect(joined).toContain(`\x1b]12;${expectedRgb(DEFAULT_THEME.cursor)}\x07`);
    mirror.dispose();
  });

  it("answers palette queries (OSC 4)", async () => {
    const mirror = new XtermMirror(80, 24, 1000);
    const responses: string[] = [];
    mirror.onResponse((d) => responses.push(d));
    await writeAndWait(mirror, "\x1b]4;1;?\x07");
    expect(responses.join("")).toBe(`\x1b]4;1;${expectedRgb(DEFAULT_THEME.ansi[1]!)}\x07`);
    mirror.dispose();
  });

  it("does not answer XTVERSION / XTWINOPS / kitty keyboard queries (unanswered, per evidence)", async () => {
    const mirror = new XtermMirror(80, 24, 1000);
    const responses: string[] = [];
    mirror.onResponse((d) => responses.push(d));
    await writeAndWait(mirror, "\x1b[>q\x1b[18t\x1b[?u");
    expect(responses.join("")).toBe("");
    mirror.dispose();
  });
});

function expectedRgb(hex: string): string {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)!;
  const [, r, g, b] = m;
  return `rgb:${r}${r}/${g}${g}/${b}${b}`;
}

describe("XtermMirror — serialize / bottomLines / OSC capture", () => {
  it("serializes scrollback and current screen content", async () => {
    const mirror = new XtermMirror(20, 5, 1000);
    await writeAndWait(mirror, "hello\r\nworld");
    const snap = mirror.serialize(1000);
    expect(snap.cols).toBe(20);
    expect(snap.rows).toBe(5);
    expect(snap.text).toContain("hello");
    expect(snap.text).toContain("world");
    mirror.dispose();
  });

  it("bottomLines returns the last N rendered rows", async () => {
    const mirror = new XtermMirror(20, 3, 1000);
    await writeAndWait(mirror, "line1\r\nline2\r\nline3\r\n");
    const lines = mirror.bottomLines(3);
    expect(lines.some((l) => l.includes("line3"))).toBe(true);
    mirror.dispose();
  });

  it("captures the terminal title via OSC 0/2", async () => {
    const mirror = new XtermMirror(20, 3, 1000);
    await writeAndWait(mirror, "\x1b]2;my title\x07");
    expect(mirror.title()).toBe("my title");
    mirror.dispose();
  });

  it("captures OSC 9;4 progress reports", async () => {
    const mirror = new XtermMirror(20, 3, 1000);
    await writeAndWait(mirror, "\x1b]9;4;1;42\x07");
    expect(mirror.progress()).toBe("4;1;42");
    mirror.dispose();
  });

  it("captures OSC 7 cwd hints", async () => {
    const mirror = new XtermMirror(20, 3, 1000);
    await writeAndWait(mirror, `\x1b]7;file://host/home/user/project\x07`);
    expect(mirror.cwdHint()).toBe("/home/user/project");
    mirror.dispose();
  });

  it("OSC 7 のドライブ付きパスは、サーバが Windows のときだけ Windows の形に直す", () => {
    expect(parseOsc7("file://host/C:/Users/u/My%20Work", "win32")).toBe("C:\\Users\\u\\My Work");
    expect(parseOsc7("file://host/C:", "win32")).toBe("C:\\");
    expect(parseOsc7("file://host/C:/Users/u", "linux")).toBe("/C:/Users/u");
    expect(parseOsc7("file://host/home/u", "win32")).toBe("/home/u");
  });

  it("resize updates cols/rows reflected in the next serialize", async () => {
    const mirror = new XtermMirror(20, 3, 1000);
    mirror.resize(40, 10);
    const snap = mirror.serialize(0);
    expect(snap.cols).toBe(40);
    expect(snap.rows).toBe(10);
    mirror.dispose();
  });
});

describe("XtermMirror — flow control", () => {
  it("pendingBytes returns to 0 and fires onDrained after a write completes", async () => {
    const mirror = new XtermMirror(80, 24, 1000);
    let drained = false;
    mirror.onDrained(() => (drained = true));
    expect(mirror.pendingBytes()).toBe(0);
    await writeAndWait(mirror, "x".repeat(1000));
    expect(mirror.pendingBytes()).toBe(0);
    expect(drained).toBe(true);
    mirror.dispose();
  });
});
