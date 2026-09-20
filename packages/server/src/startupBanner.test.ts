import { describe, expect, it } from "vitest";
import { lastChanceTokenLines, startupLines } from "./startupBanner.js";

const base = { scheme: "https" as const, port: 8443, extraOrigins: [], lanAddresses: ["192.168.1.50"] };

describe("startupLines（起動時の表示。D101・D102・D103）", () => {
  it("token を作ったときは、開ける URL ごとに #token= を付け、今だけ表示する旨を添える", () => {
    const lines = startupLines({ ...base, host: "0.0.0.0", freshToken: "TOK" });
    expect(lines).toEqual([
      "wtm: listening on 0.0.0.0 port 8443 (https)",
      "wtm: open https://localhost:8443/#token=TOK",
      "wtm: open https://192.168.1.50:8443/#token=TOK",
      "wtm: (token 付きの URL は今だけ表示します)",
    ]);
  });

  it("token を作っていなければ URL だけと、token reset の案内", () => {
    const lines = startupLines({ ...base, host: "127.0.0.1", scheme: "http", port: 7780, freshToken: undefined });
    expect(lines).toEqual([
      "wtm: listening on 127.0.0.1 port 7780 (http)",
      "wtm: open http://127.0.0.1:7780/",
      "wtm: token を忘れた場合は「wtm token reset」で作り直せます",
    ]);
  });

  it("ゾーン付きの IPv6（URL にできない）で待ち受けても投げず、作った token を表示する（以前は Invalid URL で token を失った）", () => {
    const lines = startupLines({ ...base, host: "fe80::1%eth0", freshToken: "TOK" });
    expect(lines[0]).toBe("wtm: listening on [fe80::1%eth0] port 8443 (https)");
    expect(lines.some((l) => l.startsWith("wtm: open "))).toBe(false);
    expect(lines).toContain("wtm: token（今回作成）: TOK");
    expect(lines).toContain("wtm: (token は今だけ表示します)");
    expect(lines.join("\n")).toContain("--origin");
  });

  it("ゾーン付きの IPv6 でも --origin を渡せば、それを開ける URL として表示する", () => {
    const lines = startupLines({ ...base, host: "fe80::1%eth0", extraOrigins: ["https://box.example:8443"], freshToken: "TOK" });
    expect(lines).toContain("wtm: open https://box.example:8443/#token=TOK");
    expect(lines.some((l) => l.includes("fe80") && l.startsWith("wtm: open "))).toBe(false);
  });
});

describe("lastChanceTokenLines", () => {
  it("token を表示し、失くしたら token reset で作り直せることを添える", () => {
    const lines = lastChanceTokenLines("TOK");
    expect(lines[0]).toBe("wtm: token（今回作成・この表示が最後）: TOK");
    expect(lines.join("\n")).toContain("wtm token reset");
  });
});
