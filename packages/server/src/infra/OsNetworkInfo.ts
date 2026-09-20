import { hostname, networkInterfaces } from "node:os";
import { lanIpv4Addresses } from "../util/net.js";

/** ホストが持つ実際の IP アドレスとホスト名を抽象化する口（architecture.md「infra/*」）。OriginPolicy が使う。 */
export interface NetworkInfo {
  addresses(): string[];
  /** 別のマシンから宛先にできる IPv4 アドレス（`lanIpv4Addresses`）。起動時に開ける URL を表示するのに使う（D101・D102）。 */
  lanAddresses(): string[];
  hostnames(): string[];
}

export class OsNetworkInfo implements NetworkInfo {
  addresses(): string[] {
    const out: string[] = [];
    const ifaces = networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] ?? []) {
        out.push(info.address);
      }
    }
    return out;
  }

  lanAddresses(): string[] {
    // 仮想のブリッジ（docker0・vEthernet (WSL) 等）を名前で除くので、インタフェースの名前も渡す（D102）。
    return lanIpv4Addresses(
      Object.entries(networkInterfaces()).flatMap(([name, list]) =>
        (list ?? []).map((a) => ({ name, address: a.address, family: a.family, internal: a.internal })),
      ),
    );
  }

  hostnames(): string[] {
    // MVP: OS のホスト名だけ。DNS 逆引きは行わない（design「Origin の許可リスト」は待ち受けアドレス・
    // ホスト名の完全一致で見る方針で、逆引きに頼る設計にしていない）。
    return [hostname()];
  }
}
