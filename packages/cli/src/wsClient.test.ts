import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { composeServer, type ComposedServer } from "@wtm/server";
import { login } from "./httpAuth.js";
import { AuthError, RpcFailure, connect, type WtmClient } from "./wsClient.js";

/**
 * T5 の時点では「実サーバに対する最小の疎通確認」だけを行う（design.md「対象範囲・新規」の T5 の説明）。
 * echo の往復・`pane.subscribe` の SNAPSHOT/OUTPUT・`watch`/`snapshot` コマンドとしての一巡は T12
 * （`main.integration.test.ts`）で確認する。
 */

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
    probe.on("error", reject);
  });
}

let server: ComposedServer;
let origin: string;
let token: string;

beforeEach(async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "wtmctl-wsclient-test-"));
  const port = await getFreePort();
  server = await composeServer({ host: "127.0.0.1", port: String(port), stateDir, origin: [] });
  await server.listen();
  origin = `http://127.0.0.1:${port}`;
  token = server.freshToken!;
});

afterEach(async () => {
  await server.close();
});

describe("connect/WtmClient — 実サーバへの最小の疎通確認", () => {
  it("login -> connect -> hello -> request -> close の一巡", async () => {
    const cookie = await login(origin, token);
    const client: WtmClient = await connect(origin, cookie);
    try {
      const hello = await client.hello();
      expect(hello.clientId).toEqual(expect.any(String));
      expect(hello.snapshot.protocol).toBe(1);

      const created = await client.request("workspace.create", { cwd: process.cwd(), label: "wsclient-test" });
      expect(created.workspace.label).toBe("wsclient-test");
      expect(created.pane.id).toEqual(expect.any(String));
    } finally {
      client.close();
    }
  });

  it("無効な cookie は AuthError（401）", async () => {
    await expect(connect(origin, "wtm_session=not-a-real-session")).rejects.toThrow(AuthError);
  });

  it("存在しない RPC 方式を呼ぶと RpcFailure", async () => {
    const cookie = await login(origin, token);
    const client = await connect(origin, cookie);
    try {
      // @ts-expect-error 存在しない方式をわざと呼ぶ（サーバの not_found を確かめる）
      await expect(client.request("no.such.method", {})).rejects.toThrow(RpcFailure);
    } finally {
      client.close();
    }
  });
});
