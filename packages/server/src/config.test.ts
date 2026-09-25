import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULTS,
  bindFailureHint,
  defaultStateDir,
  isBindFailure,
  listenFailureHint,
  resolveServeOptions,
  stateDirInUseError,
} from "./config.js";

describe("resolveServeOptions", () => {
  it("uses defaults when nothing is given", () => {
    const opts = resolveServeOptions({});
    expect(opts.host).toBe(DEFAULTS.host);
    expect(opts.port).toBe(DEFAULTS.port);
    expect(opts.scrollbackLines).toBe(DEFAULTS.scrollbackLines);
  });

  it("allows a loopback host without a certificate", () => {
    expect(() => resolveServeOptions({ host: "127.0.0.1" })).not.toThrow();
    expect(() => resolveServeOptions({ host: "localhost" })).not.toThrow();
  });

  it("refuses a non-loopback host without a certificate", () => {
    expect(() => resolveServeOptions({ host: "0.0.0.0" })).toThrow(ConfigError);
    expect(() => resolveServeOptions({ host: "192.168.1.5" })).toThrow(ConfigError);
  });

  it("accepts a non-loopback host when cert and key are both given", () => {
    const opts = resolveServeOptions({ host: "0.0.0.0", cert: "c.pem", key: "k.pem" });
    expect(opts.cert).toBe("c.pem");
    expect(opts.key).toBe("k.pem");
  });

  it("refuses cert without key and vice versa", () => {
    expect(() => resolveServeOptions({ host: "127.0.0.1", cert: "c.pem" })).toThrow(ConfigError);
    expect(() => resolveServeOptions({ host: "127.0.0.1", key: "k.pem" })).toThrow(ConfigError);
  });

  it("caps scrollback at the maximum", () => {
    const opts = resolveServeOptions({ scrollback: "999999" });
    expect(opts.scrollbackLines).toBe(DEFAULTS.scrollbackLinesMax);
  });

  it("rejects a negative or non-numeric scrollback", () => {
    expect(() => resolveServeOptions({ scrollback: "-1" })).toThrow(ConfigError);
    expect(() => resolveServeOptions({ scrollback: "abc" })).toThrow(ConfigError);
  });

  it("worktreeDir は素通しする（既定値の解決はしない。20260924-worktree-dir-config）", () => {
    expect(resolveServeOptions({}).worktreeDir).toBeUndefined();
    expect(resolveServeOptions({ worktreeDir: "/custom/worktrees" }).worktreeDir).toBe("/custom/worktrees");
  });

  it("--host の角括弧付きの IPv6 は角括弧を外す（listen が名前として引いて落ちないように。D101）", () => {
    expect(resolveServeOptions({ host: "[::1]" }).host).toBe("::1");
    expect(resolveServeOptions({ host: "[::]", cert: "c.pem", key: "k.pem" }).host).toBe("::");
  });

  it("--origin はブラウザが送る Origin と同じ形にそろえ、Origin でないものは拒む（D101）", () => {
    const opts = resolveServeOptions({ origin: ["https://My.Tailnet.ts.net:443/", "http://x.example:7780"] });
    expect(opts.extraOrigins).toEqual(["https://my.tailnet.ts.net", "http://x.example:7780"]);
    expect(() => resolveServeOptions({ origin: ["my.tailnet.ts.net"] })).toThrow(ConfigError);
    expect(() => resolveServeOptions({ origin: ["ftp://x.example"] })).toThrow(ConfigError);
  });

  it("rejects an out-of-range port", () => {
    expect(() => resolveServeOptions({ port: "0" })).toThrow(ConfigError);
    expect(() => resolveServeOptions({ port: "70000" })).toThrow(ConfigError);
  });
});

describe("defaultStateDir", () => {
  it("uses %LOCALAPPDATA% on Windows", () => {
    const dir = defaultStateDir({ LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" }, "win32");
    expect(dir).toContain("web-tn-multiplexer");
    expect(dir.startsWith("C:\\Users\\u\\AppData\\Local")).toBe(true);
  });

  it("uses XDG_STATE_HOME on Linux", () => {
    const dir = defaultStateDir({ XDG_STATE_HOME: "/home/u/.local/state" }, "linux");
    expect(dir).toBe("/home/u/.local/state/web-tn-multiplexer");
  });
});

describe("listenFailureHint（待ち受けの失敗の案内。D102）", () => {
  it("ポートが使用中：--port と、並行して動かすなら --state-dir も分けることを案内する", () => {
    const hint = listenFailureHint("EADDRINUSE");
    expect(hint).toContain("別のプロセスが使っています");
    expect(hint).toContain("--state-dir");
    expect(hint).toContain("--port");
    // 同じ state-dir の 2 つ目はポートを変えても wtm.lock で止まる（D103）ので、state-dir も分けるよう添える
    expect(hint).toContain("並行して動かすなら --state-dir も分け");
  });

  it("権限なし：Linux の 1024 未満のポートと、Windows の除外ポート範囲を案内する", () => {
    const hint = listenFailureHint("EACCES");
    expect(hint).toContain("1024");
    expect(hint).toContain("netsh interface ipv4 show excludedportrange protocol=tcp");
  });

  it("このマシンに無いアドレス・解決できない名前：--host を案内する", () => {
    expect(listenFailureHint("EADDRNOTAVAIL")).toContain("--host");
    expect(listenFailureHint("ENOTFOUND")).toContain("--host");
    // 名前解決の一時的な失敗（getaddrinfo の EAI_AGAIN）も ENOTFOUND と同じ扱い
    expect(listenFailureHint("EAI_AGAIN")).toBe(listenFailureHint("ENOTFOUND"));
  });

  it("待ち受けの設定で直せない失敗には案内を返さない（呼び出し側が投げ直す）", () => {
    expect(listenFailureHint("EMFILE")).toBeUndefined();
    expect(listenFailureHint(undefined)).toBeUndefined();
  });
});

/** `net.Server.listen` が 'error' で渡すものと同じ形（`syscall`・`code` 付きの Error）。 */
function sysError(syscall: string, code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${syscall} ${code}`), { syscall, code });
}

describe("isBindFailure / bindFailureHint（待ち受けの失敗の判定を 1 か所に。D103）", () => {
  it("bind・名前解決の段階の失敗（syscall が listen・bind・getaddrinfo）だけを拾い、案内を返す", () => {
    expect(isBindFailure(sysError("listen", "EADDRINUSE"))).toBe(true);
    expect(bindFailureHint(sysError("listen", "EADDRINUSE"))).toBe(listenFailureHint("EADDRINUSE"));
    expect(bindFailureHint(sysError("bind", "EACCES"))).toBe(listenFailureHint("EACCES"));
    expect(bindFailureHint(sysError("listen", "EADDRNOTAVAIL"))).toBe(listenFailureHint("EADDRNOTAVAIL"));
    expect(bindFailureHint(sysError("getaddrinfo", "ENOTFOUND"))).toBe(listenFailureHint("ENOTFOUND"));
    expect(bindFailureHint(sysError("getaddrinfo", "EAI_AGAIN"))).toBe(listenFailureHint("ENOTFOUND"));
  });

  it("bind の後の失敗（状態ディレクトリの書き込みの EACCES 等）を「ポートの権限」と取り違えない", () => {
    expect(isBindFailure(sysError("open", "EACCES"))).toBe(false);
    expect(bindFailureHint(sysError("open", "EACCES"))).toBeUndefined();
    expect(bindFailureHint(sysError("rename", "EACCES"))).toBeUndefined();
  });

  it("bind の段階でも案内の無い失敗・Error でないもの・ConfigError には案内を返さない（呼び出し側が投げ直す）", () => {
    expect(bindFailureHint(sysError("listen", "EMFILE"))).toBeUndefined();
    expect(bindFailureHint(new Error("failed to start a shell"))).toBeUndefined();
    expect(bindFailureHint(new ConfigError("x", "y"))).toBeUndefined();
    expect(bindFailureHint(undefined)).toBeUndefined();
    expect(bindFailureHint({ syscall: "listen", code: "EADDRINUSE" })).toBeUndefined(); // Error でない
  });
});

describe("stateDirInUseError（同じ state-dir の二重起動。D103）", () => {
  const inUse = { pid: 4242, lockPath: "/s/wtm.lock" };

  it("serve：使っている pid と、別の --state-dir を指定する案内・pid の再利用ならロックを消す案内", () => {
    const err = stateDirInUseError(inUse, "/s", "serve");
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.message).toContain("/s");
    expect(err.message).toContain("pid 4242");
    expect(err.hint).toContain("--state-dir に別のディレクトリ");
    expect(err.hint).toContain("/s/wtm.lock を消して");
  });

  it("持ち主が別のホスト（別のコンテナ）なら、そのホスト名と、動いていなければロックを消す案内を出す（D103 の独立点検 #2）", () => {
    const err = stateDirInUseError({ ...inUse, otherHost: "container-b" }, "/s", "serve");
    expect(err.message).toContain("pid 4242 on container-b");
    expect(err.hint).toContain("container-b");
    expect(err.hint).toContain("/s/wtm.lock を消して");
  });

  it("token reset：動いている wtm serve を止めてから実行するよう案内する", () => {
    const err = stateDirInUseError(inUse, "/s", "token-reset");
    expect(err.message).toContain("pid 4242");
    expect(err.hint).toContain("wtm serve を止めてから wtm token reset");
  });
});
