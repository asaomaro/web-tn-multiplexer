import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { XtermCopyTarget } from "./CopyTarget.js";

let term: Terminal;
let search: SearchAddon;
let target: XtermCopyTarget;

async function writeLines(lines: string[]): Promise<void> {
  await new Promise<void>((resolve) => {
    term.write(lines.join("\r\n"), () => resolve());
  });
}

beforeEach(() => {
  term = new Terminal({ cols: 20, rows: 5, allowProposedApi: true });
  term.open(document.createElement("div"));
  search = new SearchAddon();
  term.loadAddon(search);
});

afterEach(() => {
  term.dispose();
});

describe("XtermCopyTarget — move: char/line", () => {
  it("char は同じ行の中で動く（行末で止まる。行をまたがない）", async () => {
    await writeLines(["hello", "world"]);
    target = new XtermCopyTarget(term, search);
    // 初期位置はカーソル位置（2 行目「world」の末尾）。1 行目「hello」の先頭へ移ってから確かめる。
    target.apply({ op: "move", unit: "line", dir: -1 });
    for (let i = 0; i < 10; i++) target.apply({ op: "move", unit: "char", dir: -1 });
    target.apply({ op: "selectStart", linewise: false });
    target.apply({ op: "move", unit: "char", dir: 1 });
    target.apply({ op: "move", unit: "char", dir: 1 });
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText).toBe("hel");
  });

  it("line は行を上下に動く", async () => {
    await writeLines(["aaa", "bbb", "ccc"]);
    target = new XtermCopyTarget(term, search);
    for (let i = 0; i < 10; i++) target.apply({ op: "move", unit: "char", dir: -1 });
    target.apply({ op: "move", unit: "line", dir: -1 });
    target.apply({ op: "move", unit: "line", dir: -1 });
    target.apply({ op: "selectStart", linewise: true });
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText?.trim()).toBe("aaa");
  });
});

describe("XtermCopyTarget — move: word/WORD/wordEnd", () => {
  it("word は次の語の先頭へ進む（句読点は別の語として区切る）", async () => {
    await writeLines(["foo.bar baz"]);
    target = new XtermCopyTarget(term, search);
    for (let i = 0; i < 20; i++) target.apply({ op: "move", unit: "char", dir: -1 }); // 行頭へ
    target.apply({ op: "selectStart", linewise: false });
    target.apply({ op: "move", unit: "word", dir: 1 }); // "foo" -> "."（句読点で語の境界）
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText).toBe("foo.");
  });

  it("paragraph は直前の空行で止まる（vim の {/} と同じく空行そのものが境界）", async () => {
    await writeLines(["a", "b", "", "c", "d"]);
    target = new XtermCopyTarget(term, search);
    target.apply({ op: "move", unit: "line", dir: -1 }); // 末尾「d」から「c」へ
    target.apply({ op: "selectStart", linewise: true });
    target.apply({ op: "move", unit: "paragraph", dir: -1 }); // 空行で止まる（「a」「b」までは行かない）
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText).toContain("c");
    expect(copiedText).not.toContain("a");
    expect(copiedText).not.toContain("b");
  });

  it("page は term.rows ぶん動く", async () => {
    await writeLines(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    target = new XtermCopyTarget(term, search); // term は 5 行（rows: 5）
    target.apply({ op: "move", unit: "line", dir: -1 }); // 末尾「9」から
    target.apply({ op: "selectStart", linewise: true });
    target.apply({ op: "move", unit: "page", dir: -1 }); // rows(5) ぶん上へ（開始行「8」から「3」へ）
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText?.trim().split(/\r?\n/)).toEqual(["3", "4", "5", "6", "7", "8"]);
  });

  it("wordEnd は語の末尾へ進む", async () => {
    await writeLines(["foo bar"]);
    target = new XtermCopyTarget(term, search);
    for (let i = 0; i < 20; i++) target.apply({ op: "move", unit: "char", dir: -1 }); // 行頭 "f"
    target.apply({ op: "selectStart", linewise: false });
    target.apply({ op: "move", unit: "wordEnd", dir: 1 }); // "f" -> "o"(foo の末尾)
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText).toBe("foo");
  });

  it("WORD は句読点をまたいで空白だけで区切る", async () => {
    await writeLines(["foo.bar baz"]);
    target = new XtermCopyTarget(term, search);
    for (let i = 0; i < 20; i++) target.apply({ op: "move", unit: "char", dir: -1 });
    target.apply({ op: "selectStart", linewise: false });
    target.apply({ op: "move", unit: "WORD", dir: 1 }); // "foo.bar" 全体を飛び越えて "baz" の先頭へ
    const { copiedText } = target.apply({ op: "yank" });
    // vim の visual モードと同じく、移動先（次の WORD の先頭の 1 文字）を含めて選択する。
    expect(copiedText).toBe("foo.bar b");
  });
});

describe("XtermCopyTarget — selectStart / yank / clearOrExit / exit", () => {
  it("selectStart（文字単位）から yank で選択したテキストを返し、抜ける", async () => {
    await writeLines(["hello world"]);
    target = new XtermCopyTarget(term, search);
    for (let i = 0; i < 20; i++) target.apply({ op: "move", unit: "char", dir: -1 });
    target.apply({ op: "selectStart", linewise: false });
    for (let i = 0; i < 4; i++) target.apply({ op: "move", unit: "char", dir: 1 });
    const result = target.apply({ op: "yank" });
    expect(result).toEqual({ copiedText: "hello", exited: true });
    expect(term.hasSelection()).toBe(false);
  });

  it("clearOrExit: 選択があれば消すだけ（抜けない）", async () => {
    await writeLines(["hello"]);
    target = new XtermCopyTarget(term, search);
    target.apply({ op: "selectStart", linewise: false });
    expect(term.hasSelection()).toBe(true);
    const result = target.apply({ op: "clearOrExit" });
    expect(result.exited).toBeUndefined();
    expect(term.hasSelection()).toBe(false);
  });

  it("clearOrExit: 選択が無ければ抜ける", async () => {
    await writeLines(["hello"]);
    target = new XtermCopyTarget(term, search);
    const result = target.apply({ op: "clearOrExit" });
    expect(result).toEqual({ exited: true });
  });

  it("exit は選択を消して常に抜ける", async () => {
    await writeLines(["hello"]);
    target = new XtermCopyTarget(term, search);
    target.apply({ op: "selectStart", linewise: false });
    const result = target.apply({ op: "exit" });
    expect(result).toEqual({ exited: true });
    expect(term.hasSelection()).toBe(false);
  });

  it("yank: 選択が無ければ空文字列を返す", async () => {
    await writeLines(["hello"]);
    target = new XtermCopyTarget(term, search);
    const result = target.apply({ op: "yank" });
    expect(result).toEqual({ copiedText: "", exited: true });
  });
});

describe("XtermCopyTarget — 検索", () => {
  it("searchStart の後に searchInput で findNext を呼ぶ（例外を投げない）", async () => {
    await writeLines(["needle in a haystack", "another needle here"]);
    target = new XtermCopyTarget(term, search);
    expect(() => {
      target.apply({ op: "searchStart", dir: 1 });
      target.apply({ op: "searchInput", text: "needle" });
    }).not.toThrow();
  });

  it("searchNext の reverse で逆向きに検索する（例外を投げない）", async () => {
    await writeLines(["needle in a haystack", "another needle here"]);
    target = new XtermCopyTarget(term, search);
    target.apply({ op: "searchStart", dir: 1 });
    target.apply({ op: "searchInput", text: "needle" });
    expect(() => target.apply({ op: "searchNext", reverse: true })).not.toThrow();
  });

  it("選択が無いときの yank は現在の検索の一致を返す（herdr の確認済みの挙動。D56）", async () => {
    await writeLines(["needle in a haystack"]);
    target = new XtermCopyTarget(term, search);
    expect(term.hasSelection()).toBe(false);
    target.apply({ op: "searchStart", dir: 1 });
    target.apply({ op: "searchInput", text: "needle" });
    // SearchAddon.findNext は実物の xterm.js で一致箇所を選択状態にする（実測で確認）ので、
    // CopyTarget 側で特別扱いをしなくても yank がそのまま検索の一致を返す。
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText).toBe("needle");
  });

  it("検索が当たった後、あらためて V で選択し直しても、一致した行が選択される（検索前の位置に戻らない。D94）", async () => {
    await writeLines(["aaa", "bbb", "needle-line", "ccc", "ddd"]);
    target = new XtermCopyTarget(term, search); // カーソルは末尾（"ddd"）から始まる
    target.apply({ op: "searchStart", dir: -1 }); // 上向きに探す
    target.apply({ op: "searchInput", text: "needle-line" });
    // 検索直後に selectStart（V 相当）で選択し直す——これが D94 発見時の実際の操作列。
    target.apply({ op: "selectStart", linewise: true });
    const { copiedText } = target.apply({ op: "yank" });
    expect(copiedText?.trim()).toBe("needle-line"); // "ddd"（検索前の古いカーソル位置）ではない
  });
});

describe("XtermCopyTarget — resetCursor（05-e2e-docs T4。D94）", () => {
  it("construct 後に端末へ新しく書かれた内容があっても、resetCursor で現在の末尾位置へ合わせ直せる", async () => {
    await writeLines(["old-1", "old-2"]);
    target = new XtermCopyTarget(term, search); // ここでカーソル位置を読む（"old-2" の末尾）
    // pane を acquire した直後は少ない出力しか無いが、その後たくさん出力される——という実際の使われ方を再現する。
    await writeLines(["", "new-1", "new-2", "new-3"]);
    // resetCursor しないままだと、依然として "old-2"（construct 時点の位置）を指したまま。
    target.apply({ op: "selectStart", linewise: true });
    expect(target.apply({ op: "yank" }).copiedText?.trim()).toBe("old-2");

    target.apply({ op: "selectStart", linewise: false }); // 選択を作り直す前に一旦解除された状態から
    target.resetCursor();
    target.apply({ op: "selectStart", linewise: true });
    expect(target.apply({ op: "yank" }).copiedText?.trim()).toBe("new-3"); // 今の末尾（最新の行）を指す
  });

  it("resetCursor は前回の選択・検索の状態も捨てる", async () => {
    await writeLines(["needle here", "more text"]);
    target = new XtermCopyTarget(term, search);
    target.apply({ op: "selectStart", linewise: false });
    target.apply({ op: "searchStart", dir: 1 });
    target.apply({ op: "searchInput", text: "needle" });
    expect(term.hasSelection()).toBe(true);

    target.resetCursor();
    expect(term.hasSelection()).toBe(false);
    // 検索語も忘れている——searchNext を呼んでも（新しい語の入力無しには）何も起きないことを確かめる。
    expect(() => target.apply({ op: "searchNext", reverse: false })).not.toThrow();
  });
});
