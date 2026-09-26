import { describe, expect, it } from "vitest";
import { AttachKeyFilter } from "./attachKeys.js";

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

describe("AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6）", () => {
  it("接頭辞を含まない入力はそのまま送る", () => {
    expect(new AttachKeyFilter().feed(bytes("ls -la\r"))).toEqual({
      forward: bytes("ls -la\r"),
      detach: false,
    });
  });

  it("Ctrl+B q で切り離す。それより前のバイトは送り、q より後ろは捨てる", () => {
    const r = new AttachKeyFilter().feed(bytes("ab\x02qcd"));
    expect(r.detach).toBe(true);
    expect(text(r.forward)).toBe("ab");
  });

  it("Ctrl+B Ctrl+B は Ctrl+B を 1 つ送る", () => {
    expect(new AttachKeyFilter().feed(bytes("\x02\x02x"))).toEqual({
      forward: bytes("\x02x"),
      detach: false,
    });
  });

  it("Ctrl+B に続くそれ以外のバイトは両方を送る（Ctrl+B q 以外は切り離さない）", () => {
    expect(new AttachKeyFilter().feed(bytes("\x02x"))).toEqual({
      forward: bytes("\x02x"),
      detach: false,
    });
    expect(new AttachKeyFilter().feed(bytes("\x02Q"))).toEqual({
      forward: bytes("\x02Q"),
      detach: false,
    });
    expect(new AttachKeyFilter().feed(bytes("q"))).toEqual({ forward: bytes("q"), detach: false });
  });

  it("接頭辞と次のバイトが別の読み取りに分かれても同じに扱う", () => {
    const f = new AttachKeyFilter();
    expect(f.feed(bytes("a\x02"))).toEqual({ forward: bytes("a"), detach: false });
    expect(f.feed(bytes("q"))).toEqual({ forward: new Uint8Array(), detach: true });

    const g = new AttachKeyFilter();
    expect(g.feed(bytes("\x02"))).toEqual({ forward: new Uint8Array(), detach: false });
    expect(g.feed(bytes("\x02"))).toEqual({ forward: bytes("\x02"), detach: false });
    expect(g.feed(bytes("z"))).toEqual({ forward: bytes("z"), detach: false });

    const h = new AttachKeyFilter();
    expect(h.feed(bytes("\x02"))).toEqual({ forward: new Uint8Array(), detach: false });
    expect(h.feed(bytes("x\x02"))).toEqual({ forward: bytes("\x02x"), detach: false });
    expect(h.feed(bytes("q"))).toEqual({ forward: new Uint8Array(), detach: true });
  });
});
