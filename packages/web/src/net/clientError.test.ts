import { describe, expect, it } from "vitest";
import { clientErrorMessage } from "./clientError.js";

describe("clientErrorMessage（D107：client.error の英語の message をそのまま出さず、code から日本語の文言を引く）", () => {
  it("今のサーバが送る invalid_params（1MB を超える貼り付け等）は、送った分が端末に届いていないことを日本語で示す", () => {
    const text = clientErrorMessage("invalid_params");
    expect(text).toContain("1MB を超えた");
    expect(text).toContain("端末に届いていません");
    expect(text).not.toMatch(/malformed|frame/i);
  });

  it.each(["unauthorized", "not_found", "spawn_failed", "internal"])("design のエラーコード %s にも日本語の文言がある（汎用の文言ではない）", (code) => {
    const text = clientErrorMessage(code);
    expect(text).not.toContain(code);
    expect(text).toMatch(/[ぁ-んァ-ン]/);
  });

  it("知らない code は汎用の日本語の文言にその code を添える", () => {
    expect(clientErrorMessage("too_many_frames")).toBe("サーバでエラーが起きました（too_many_frames）。");
  });

  it("Object の既定のプロパティ名（toString 等）は知らない code として扱う", () => {
    expect(clientErrorMessage("toString")).toBe("サーバでエラーが起きました（toString）。");
    expect(clientErrorMessage("__proto__")).toBe("サーバでエラーが起きました（__proto__）。");
  });
});
