import type { MethodName, ParamsOf, ResultOf } from "@wtm/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputGate } from "./InputGate.js";
import type { ConnectionPort } from "./ports.js";

function makeConn(): ConnectionPort & { sent: [string, string | Uint8Array][] } {
  return {
    sent: [],
    request<M extends MethodName>(_m: M, _p: ParamsOf<M>): Promise<ResultOf<M>> {
      return Promise.resolve({} as ResultOf<M>);
    },
    sendInput(paneId, bytes) {
      this.sent.push([paneId, bytes]);
    },
    login: vi.fn(),
    logout: vi.fn(),
    connect: vi.fn(),
  };
}

describe("InputGate（D99）", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("保持していなければ、そのまま送る", () => {
    const conn = makeConn();
    new InputGate(conn).sendInput("p1", "a");
    expect(conn.sent).toEqual([["p1", "a"]]);
  });

  it("保持の間に元の pane 宛てに打った文字は溜め、release で新しい pane へ順番どおりに流す", () => {
    const conn = makeConn();
    const gate = new InputGate(conn);
    const hold = gate.holdInput("p1");
    gate.sendInput("p1", "l");
    gate.sendInput("p1", new Uint8Array([0x73]));
    gate.sendInput("p1", "\r");
    expect(conn.sent).toEqual([]);
    hold.release("p2");
    expect(conn.sent).toEqual([["p2", "l"], ["p2", new Uint8Array([0x73])], ["p2", "\r"]]);
    gate.sendInput("p1", "x"); // 保持が終わったら素通し
    expect(conn.sent.at(-1)).toEqual(["p1", "x"]);
  });

  it("cancel（要求が失敗した）なら、溜めた分を元の pane へ流す", () => {
    const conn = makeConn();
    const gate = new InputGate(conn);
    const hold = gate.holdInput("p1");
    gate.sendInput("p1", "ls");
    hold.cancel();
    expect(conn.sent).toEqual([["p1", "ls"]]);
  });

  it("応答が来ないまま時間切れになったら、溜めた分を元の pane へ流す（入力を失わない）", () => {
    const conn = makeConn();
    const gate = new InputGate(conn, { timeoutMs: 1000 });
    gate.holdInput("p1");
    gate.sendInput("p1", "ls");
    vi.advanceTimersByTime(999);
    expect(conn.sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(conn.sent).toEqual([["p1", "ls"]]);
  });

  it("他の pane 宛ての入力・フォーカスの報告・ポインタ操作から出た入力は溜めない（独立点検の指摘）", () => {
    const conn = makeConn();
    const gate = new InputGate(conn);
    gate.holdInput("p1");
    gate.sendInput("p9", "x");
    gate.sendInput("p1", "\x1b[O");
    gate.sendInput("p1", "\x1b[A", "pointer"); // alt screen でのホイール→矢印キー
    gate.sendInput("p1", "\x1b[<64;10;5M", "pointer"); // マウスの報告
    expect(conn.sent).toEqual([
      ["p9", "x"],
      ["p1", "\x1b[O"],
      ["p1", "\x1b[A"],
      ["p1", "\x1b[<64;10;5M"],
    ]);
  });

  it("保持が重なったら（prefix+v を 2 回すばやく）、それぞれの操作の後に打った文字をそれぞれの新しい pane へ、打った順に流す", () => {
    const conn = makeConn();
    const gate = new InputGate(conn);
    const first = gate.holdInput("p1");
    gate.sendInput("p1", "a"); // 1 回目の操作の後
    const second = gate.holdInput("p1"); // 焦点はまだ p1
    gate.sendInput("p1", "b"); // 2 回目の操作の後
    first.release("p2"); // 1 回目の応答：焦点は p2 へ
    expect(conn.sent).toEqual([["p2", "a"]]);
    gate.sendInput("p2", "c"); // 焦点の移った p2 で打ったが、2 回目の操作の後なので 2 回目の新しい pane へ
    second.release("p3");
    expect(conn.sent).toEqual([["p2", "a"], ["p3", "b"], ["p3", "c"]]);
  });

  it("後の操作の応答が先に来ても、先に打った文字を追い越さない", () => {
    const conn = makeConn();
    const gate = new InputGate(conn);
    const first = gate.holdInput("p1");
    gate.sendInput("p1", "a");
    const second = gate.holdInput("p1");
    gate.sendInput("p1", "b");
    second.release("p3"); // 後の応答が先に来た
    gate.sendInput("p3", "c"); // 焦点の移った p3 で打った
    expect(conn.sent).toEqual([]); // 先の保持が終わるまで流さない
    first.release("p2");
    expect(conn.sent).toEqual([["p2", "a"], ["p3", "b"], ["p3", "c"]]);
    gate.sendInput("p3", "d"); // 全部終わったら素通し
    expect(conn.sent.at(-1)).toEqual(["p3", "d"]);
  });

  it("sendInput 以外（request 等）は素通し", async () => {
    const conn = makeConn();
    const spy = vi.spyOn(conn, "request");
    await new InputGate(conn).request("pane.focus", { paneId: "p1" });
    expect(spy).toHaveBeenCalledWith("pane.focus", { paneId: "p1" });
  });

  it("login は失敗の理由（D105 の `LoginResult`）をそのまま返す", async () => {
    const conn = makeConn();
    vi.mocked(conn.login).mockResolvedValue({ ok: false, reason: "origin_rejected" });
    await expect(new InputGate(conn).login("tok")).resolves.toEqual({ ok: false, reason: "origin_rejected" });
    expect(conn.login).toHaveBeenCalledWith("tok");
  });
});
