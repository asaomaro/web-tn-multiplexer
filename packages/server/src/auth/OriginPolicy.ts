import { formatUrlHost, isWildcardHost } from "../util/net.js";
import type { NetworkInfo } from "../infra/OsNetworkInfo.js";

export interface OriginPolicyOptions {
  host: string;
  port: number;
  /** `wss:`/`https:` を使うか（TLS が有効かどうか。design「Origin の許可リスト」は scheme を Host と対にして見る）。 */
  secure: boolean;
  /** `--origin` で追加された、完全な Origin 文字列（`https://example.ts.net:7780` 等）。 */
  extraOrigins: string[];
}

/** 許可ホストの計算と Origin の判定（architecture.md「OriginPolicy」・design.md「Origin の許可リスト」）。 */
export interface OriginPolicy {
  /** Origin と Host の判定（`/ws`・`/api/login`。Origin が無ければ拒否）。 */
  isAllowed(origin: string | undefined, hostHeader: string | undefined): boolean;
  /**
   * Host だけの判定（D106。ブラウザは同じオリジンの GET に Origin を付けないので、`/api/session` はこれで見る）。許可ホスト
   * （`allowedHostPorts`）か、`--origin` で足した Origin のホスト（`URL.host`——既定ポートならポート無し、それ以外は
   * `host:port`。既定ポートの Origin ならポート付きの `host:443`／`host:80` も）と一致すれば許す。
   */
  isHostAllowed(hostHeader: string | undefined): boolean;
  /** 診断・ログ用に、現在の許可ホスト一覧（`host:port` の形）を返す。 */
  allowedHostPorts(): string[];
}

export class DefaultOriginPolicy implements OriginPolicy {
  constructor(
    private readonly opts: OriginPolicyOptions,
    private readonly net: NetworkInfo,
  ) {}

  allowedHostPorts(): string[] {
    const port = this.opts.port;
    // scheme の既定ポート（http:80 / https:443）では、ブラウザが Host/Origin ヘッダからポートを省略する。
    // ポート付きの形だけを許可リストに入れていると、既定ポートで直接待ち受ける構成が実質ロックアウトに
    // なる（レビュー指摘）ので、その場合はポート無しの形も許可リストに加える。
    const isDefaultPort = this.opts.secure ? port === 443 : port === 80;
    const hosts = new Set<string>();
    // ホスト名は大文字小文字を区別しない——ブラウザは Host/Origin を小文字で送るので、小文字にそろえて持つ
    // （Windows のホスト名 `DESKTOP-…` や `--host` に大文字を含む名前を渡した場合に拒否しないため。D101 の独立点検）。
    const add = (host: string): void => {
      const h = formatUrlHost(host.toLowerCase());
      hosts.add(`${h}:${port}`);
      if (isDefaultPort) hosts.add(h);
    };
    add("localhost");
    add("127.0.0.1");
    add("::1");
    if (isWildcardHost(this.opts.host)) {
      // 0.0.0.0 / :: で待ち受けているときは、ホストの全インタフェースの IP とホスト名を許す
      // （DNS rebinding を防ぐため、それ以外の Host ヘッダは拒否する。research.md F9.3）。
      for (const addr of this.net.addresses()) add(addr);
      for (const h of this.net.hostnames()) add(h);
    } else {
      add(this.opts.host); // ループバックの名前（`foo.localhost` 等）も、明示されたらそのまま許す
    }
    return [...hosts];
  }

  isAllowed(origin: string | undefined, hostHeader: string | undefined): boolean {
    const o = origin?.toLowerCase();
    if (o !== undefined && this.opts.extraOrigins.some((extra) => extra.toLowerCase() === o)) return true;
    if (!o || !hostHeader) return false;
    const host = hostHeader.toLowerCase();
    if (!this.allowedHostPorts().includes(host)) return false;
    const scheme = this.opts.secure ? "https" : "http";
    return o === `${scheme}://${host}`;
  }

  isHostAllowed(hostHeader: string | undefined): boolean {
    if (!hostHeader) return false;
    const host = hostHeader.toLowerCase();
    if (this.allowedHostPorts().includes(host)) return true;
    // `--origin` の Origin は（`isAllowed` では）Host を問わずに許すが、Origin の無い GET では Host しか見られないので、
    // その Origin のホストで照らす（ポート転送・Tailscale の名前ではブラウザが開いた宛先がそのまま Host に載る。D106）。
    return this.opts.extraOrigins.some((extra) => originHosts(extra).includes(host));
  }
}

/**
 * Origin 文字列が表す Host ヘッダの形（小文字）。`URL.host`（既定ポートは省かれる）に加え、既定ポートの Origin なら
 * ポート付きの形（https は `:443`、http は `:80`）も返す——待ち受けの既定ポートでポート無しの形も許す `allowedHostPorts` の
 * 逆で、前段のプロキシが `Host: $host:$server_port`（nginx）のようにポートを付けて送る構成でも一致させる（D106）。
 * 解釈できなければ空。
 */
function originHosts(origin: string): string[] {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return [];
  }
  const host = url.host.toLowerCase();
  if (url.port !== "") return [host];
  const defaultPort = url.protocol === "https:" ? 443 : url.protocol === "http:" ? 80 : undefined;
  return defaultPort === undefined ? [host] : [host, `${host}:${defaultPort}`];
}
