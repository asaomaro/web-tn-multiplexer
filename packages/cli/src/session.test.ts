import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FsSessionStore } from "./session.js";

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "wtmctl-session-test-"));
  filePath = join(dir, "nested", "session.json"); // ディレクトリが無い状態から始める（mkdir の確認も兼ねる）
});

afterEach(() => {
  // vitest はプロセス終了時にまとめて掃除される tmp を使っているため、明示的な rm は必須ではない
  // （既存の他パッケージのテストも同様。`mkdtemp` の戻り値をそのまま使い捨てる）。
});

describe("FsSessionStore", () => {
  it("ファイルが無ければ get は undefined", async () => {
    const store = new FsSessionStore(filePath);
    expect(await store.get("http://127.0.0.1:7780")).toBeUndefined();
  });

  it("set した cookie を get で取り出せる", async () => {
    const store = new FsSessionStore(filePath);
    await store.set("http://127.0.0.1:7780", "wtm_session=abc");
    expect(await store.get("http://127.0.0.1:7780")).toBe("wtm_session=abc");
  });

  it("URL の path/query が違っても origin が同じなら同じキーとして扱う", async () => {
    const store = new FsSessionStore(filePath);
    await store.set("http://127.0.0.1:7780/some/path?x=1", "wtm_session=abc");
    expect(await store.get("http://127.0.0.1:7780")).toBe("wtm_session=abc");
  });

  it("host/port が違えば別のキー（別サーバのセッションを混同しない）", async () => {
    const store = new FsSessionStore(filePath);
    await store.set("http://127.0.0.1:7780", "wtm_session=a");
    await store.set("http://127.0.0.1:7781", "wtm_session=b");
    expect(await store.get("http://127.0.0.1:7780")).toBe("wtm_session=a");
    expect(await store.get("http://127.0.0.1:7781")).toBe("wtm_session=b");
  });

  it("clear するとその URL の cookie だけ消える", async () => {
    const store = new FsSessionStore(filePath);
    await store.set("http://127.0.0.1:7780", "wtm_session=a");
    await store.set("http://127.0.0.1:7781", "wtm_session=b");
    await store.clear("http://127.0.0.1:7780");
    expect(await store.get("http://127.0.0.1:7780")).toBeUndefined();
    expect(await store.get("http://127.0.0.1:7781")).toBe("wtm_session=b");
  });

  it("存在しない URL の clear は何もしない（例外を投げない）", async () => {
    const store = new FsSessionStore(filePath);
    await expect(store.clear("http://127.0.0.1:7780")).resolves.toBeUndefined();
  });

  it.each([
    ["壊れた JSON", "not json at all"],
    ["JSON だが形が違う（配列）", "[1,2,3]"],
    ["sessions が無い", "{}"],
    ["sessions の値が壊れている", JSON.stringify({ sessions: { "http://h": { cookie: 123 } } })],
  ])("ファイルが壊れている（%s）場合は空として扱う", async (_label, raw) => {
    await mkdir(join(dir, "nested"), { recursive: true });
    await writeFile(filePath, raw, "utf8");
    const store = new FsSessionStore(filePath);
    expect(await store.get("http://127.0.0.1:7780")).toBeUndefined();
    // 壊れていても書き込みはできる（上書きされる）。
    await store.set("http://127.0.0.1:7780", "wtm_session=fresh");
    expect(await store.get("http://127.0.0.1:7780")).toBe("wtm_session=fresh");
  });

  it("ディレクトリを 0700・ファイルを 0600 で作る", async () => {
    const store = new FsSessionStore(filePath);
    await store.set("http://127.0.0.1:7780", "wtm_session=a");
    const dirStat = await stat(join(dir, "nested"));
    const fileStat = await stat(filePath);
    expect(dirStat.mode & 0o777).toBe(0o700);
    expect(fileStat.mode & 0o777).toBe(0o600);
  });
});
