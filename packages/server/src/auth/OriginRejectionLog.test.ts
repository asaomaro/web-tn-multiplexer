import { describe, expect, it, vi } from "vitest";
import { MemoryLogger } from "../log/Logger.js";
import type { OriginPolicy } from "./OriginPolicy.js";
import {
  ORIGIN_LOG_MAX_CHARS,
  ORIGIN_LOG_MAX_ENTRIES,
  ORIGIN_LOG_MAX_LINES_PER_WINDOW,
  ORIGIN_LOG_WINDOW_MS,
  OriginRejectionLog,
} from "./OriginRejectionLog.js";

const policy: OriginPolicy = { isAllowed: () => false, isHostAllowed: () => false, allowedHostPorts: () => ["localhost:7780", "127.0.0.1:7780"] };

function setup(opts: { extraOrigins?: string[]; maxLinesPerWindow?: number } = {}) {
  let t = 1_000_000;
  const logger = new MemoryLogger();
  const log = new OriginRejectionLog(logger, policy, { now: () => t, ...opts });
  const warns = () => logger.lines.filter((l) => l.level === "warn" && l.msg === "origin rejected");
  return { log, warns, advance: (ms: number) => (t += ms) };
}

const reject = { path: "/api/login", remoteAddress: "192.0.2.1", origin: "https://evil.example", host: "evil.example:7780" };

describe("OriginRejectionLog（Origin の拒否のログの間引き。D102）", () => {
  it("接続元・Origin・Host・許可ホストの一覧・対処を書く", () => {
    const { log, warns } = setup();
    log.record(reject);
    expect(warns()).toHaveLength(1);
    expect(warns()[0]!.fields).toMatchObject({
      path: "/api/login",
      remoteAddress: "192.0.2.1",
      origin: "https://evil.example",
      host: "evil.example:7780",
      allowed: ["localhost:7780", "127.0.0.1:7780"],
    });
    expect(String(warns()[0]!.fields?.["hint"])).toContain("--origin");
  });

  it("同じ（接続元・Origin・Host）は 60 秒に 1 回だけ書き、次の行に書かなかった件数を載せる", () => {
    const { log, warns, advance } = setup();
    log.record(reject);
    for (let i = 0; i < 50; i++) {
      advance(1000);
      log.record({ ...reject, path: i % 2 ? "/ws" : "/api/login" }); // 経路が違っても同じ相手・同じヘッダなら 1 回
    }
    expect(warns()).toHaveLength(1);
    advance(ORIGIN_LOG_WINDOW_MS - 50_000); // 最初の行から 60 秒ちょうど
    log.record(reject);
    expect(warns()).toHaveLength(2);
    expect(warns()[1]!.fields?.["suppressed"]).toBe(50);
    advance(1);
    log.record(reject);
    expect(warns()).toHaveLength(2);
  });

  it("接続元・Origin・Host のどれかが違えば別に書く", () => {
    const { log, warns } = setup();
    log.record(reject);
    log.record({ ...reject, remoteAddress: "192.0.2.2" });
    log.record({ ...reject, origin: "https://other.example" });
    log.record({ ...reject, host: "other.example:7780" });
    log.record({ ...reject, origin: undefined });
    expect(warns()).toHaveLength(5);
  });

  it("Origin・Host は 200 文字で切る（認証前の相手が送る長いヘッダをそのまま書かない）", () => {
    const { log, warns } = setup();
    const long = `https://${"a".repeat(16_000)}.example`;
    log.record({ ...reject, origin: long, host: "h".repeat(16_000) });
    const fields = warns()[0]!.fields!;
    expect(String(fields["origin"]).length).toBeLessThan(ORIGIN_LOG_MAX_CHARS + 30);
    expect(String(fields["origin"])).toContain(`(${long.length} chars)`);
    expect(String(fields["host"]).length).toBeLessThan(ORIGIN_LOG_MAX_CHARS + 30);
  });

  it("組を毎回変えても、全体で 60 秒に上限の行数までしか書かず、超えた件数を次の行に載せる（独立点検の指摘）", () => {
    const { log, warns, advance } = setup();
    for (let i = 0; i < ORIGIN_LOG_MAX_LINES_PER_WINDOW + 5; i++) log.record({ ...reject, origin: `https://o${i}.example` });
    expect(warns()).toHaveLength(ORIGIN_LOG_MAX_LINES_PER_WINDOW);
    advance(ORIGIN_LOG_WINDOW_MS);
    log.record({ ...reject, origin: "https://after.example" });
    expect(warns()).toHaveLength(ORIGIN_LOG_MAX_LINES_PER_WINDOW + 1);
    expect(warns().at(-1)?.fields).toMatchObject({ suppressedOverall: 5 });
  });

  it("--origin で許可した Origin もログに添える（渡した値との食い違いを確かめられるように）", () => {
    const { log, warns } = setup({ extraOrigins: ["https://my.tailnet.ts.net:7780"] });
    log.record(reject);
    expect(warns()[0]?.fields).toMatchObject({ extraOrigins: ["https://my.tailnet.ts.net:7780"] });
  });

  it("間引きの表は上限を超えたら空にする（組み合わせを変え続けても表が膨らまない）", () => {
    const { log, warns } = setup({ maxLinesPerWindow: Number.POSITIVE_INFINITY }); // 表の上限だけを見る
    log.record(reject);
    for (let i = 1; i < ORIGIN_LOG_MAX_ENTRIES; i++) log.record({ ...reject, origin: `https://o${i}.example` });
    expect(warns()).toHaveLength(ORIGIN_LOG_MAX_ENTRIES); // 表はちょうど上限
    log.record(reject); // 表にある（間引かれる）
    expect(warns()).toHaveLength(ORIGIN_LOG_MAX_ENTRIES);
    log.record({ ...reject, origin: "https://new.example" }); // 上限で表を空にしてから入れる
    expect(warns()).toHaveLength(ORIGIN_LOG_MAX_ENTRIES + 1);
    log.record(reject); // 空にしたので、60 秒以内でも改めて書く
    expect(warns()).toHaveLength(ORIGIN_LOG_MAX_ENTRIES + 2);
  });
});

describe("OriginRejectionLog.admit（判定 → 記録 → 403 を 1 か所に。D103）", () => {
  const makeGate = (allowed: boolean) => {
    const logger = new MemoryLogger();
    const gate = new OriginRejectionLog(logger, { isAllowed: () => allowed, isHostAllowed: () => allowed, allowedHostPorts: () => ["localhost:7780"] });
    return { gate, logger };
  };

  it("許可するなら true を返し、記録も deny もしない", () => {
    const { gate, logger } = makeGate(true);
    let denied = 0;
    expect(gate.admit(reject, () => denied++)).toBe(true);
    expect(denied).toBe(0);
    expect(logger.lines).toEqual([]);
  });

  it("許可しないなら記録してから deny を呼び、false を返す（記録は record と同じく間引く）", () => {
    const { gate, logger } = makeGate(false);
    const order: string[] = [];
    const origWarn = logger.warn.bind(logger);
    logger.warn = (msg, fields) => {
      order.push("warn");
      origWarn(msg, fields);
    };
    expect(gate.admit(reject, () => order.push("deny"))).toBe(false);
    expect(order).toEqual(["warn", "deny"]);
    expect(gate.admit(reject, () => order.push("deny"))).toBe(false); // 2 回目は間引く（deny はする）
    expect(order).toEqual(["warn", "deny", "deny"]);
  });
});

describe("OriginRejectionLog.admitGet（Origin を付けない GET。D106）", () => {
  /** isAllowed は Origin が "https://ok.example" のときだけ、isHostAllowed は Host が "ok.example" のときだけ許す偽物。 */
  const makeGate = () => {
    const logger = new MemoryLogger();
    const gate = new OriginRejectionLog(logger, {
      isAllowed: (origin) => origin === "https://ok.example",
      isHostAllowed: (host) => host === "ok.example",
      allowedHostPorts: () => ["ok.example"],
    });
    const warns = () => logger.lines.filter((l) => l.level === "warn" && l.msg === "origin rejected");
    return { gate, warns };
  };
  const get = { path: "/api/session", remoteAddress: "192.0.2.1" };

  it("Origin が無ければ Host だけで判定する", () => {
    const { gate, warns } = makeGate();
    let denied = 0;
    expect(gate.admitGet({ ...get, origin: undefined, host: "ok.example" }, () => denied++)).toBe(true);
    expect(gate.admitGet({ ...get, origin: undefined, host: "evil.example" }, () => denied++)).toBe(false);
    expect(denied).toBe(1);
    expect(warns().map((l) => l.fields?.["host"])).toEqual(["evil.example"]);
  });

  it("Origin が付いていれば admit と同じ規則で判定する（付いていて許可外なら、Host が許可内でも拒否）", () => {
    const { gate, warns } = makeGate();
    let denied = 0;
    expect(gate.admitGet({ ...get, origin: "https://evil.example", host: "ok.example" }, () => denied++)).toBe(false);
    expect(gate.admitGet({ ...get, origin: "https://ok.example", host: "other.example" }, () => denied++)).toBe(true);
    expect(denied).toBe(1);
    expect(warns().map((l) => l.fields?.["origin"])).toEqual(["https://evil.example"]);
  });
});

describe("OriginRejectionLog の既定の時計（D103 の独立点検 #8）", () => {
  it("単調な時計（performance.now）で数える——壁時計（Date.now）が戻っても、同じ組を 60 秒後にまた書く", () => {
    const wall = vi.spyOn(Date, "now").mockReturnValue(50_000_000);
    let mono = 5_000;
    const perf = vi.spyOn(performance, "now").mockImplementation(() => mono);
    try {
      const logger = new MemoryLogger();
      const log = new OriginRejectionLog(logger, policy);
      log.record(reject);
      wall.mockReturnValue(50_000_000 - 3_600_000); // 壁時計が 1 時間戻る
      mono += ORIGIN_LOG_WINDOW_MS;
      log.record(reject);
      expect(logger.lines.filter((l) => l.msg === "origin rejected")).toHaveLength(2);
    } finally {
      wall.mockRestore();
      perf.mockRestore();
    }
  });
});
