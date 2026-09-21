import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

/** `smoke.ts`（`packages/server`）と同じ手法：OS に空きポートを 1 つ割り当てさせてから閉じ、その番号を使う。 */
export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
    probe.on("error", reject);
  });
}
