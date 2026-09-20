/**
 * `packages/server` の公開面（05-e2e-docs T1。design には無い追加判断）。
 * このパッケージはこれまで CLI（`bin: wtm`）としてしか公開しておらず、外の package から import する経路が
 * 無かった。`packages/e2e` は `smoke.ts`（01・03-web-desktop T26）と同じ土台（実サーバをプロセス内で組み立て、
 * Playwright の実ブラウザから駆動する）で E2E を書くため、必要な最小限だけをここでバレル公開する
 * （`package.json` の `main`/`types` はこのファイルを指す）。
 */
export { composeServer, type ComposedServer } from "./composeServer.js";
export type { RawServeArgs, ServeOptions } from "./config.js";
/**
 * 起動時に表示する LAN の IPv4 を選ぶ純関数（サーバ自身が使うもの）。e2e の tls-lan が「このマシンに表示されるべき
 * LAN の IPv4 があるのにサーバが 1 つも表示しない」退行を skip ではなく失敗にするために、同じ条件を重ねて持たずに使う（D103）。
 */
export { lanIpv4Addresses, type InterfaceAddress } from "./util/net.js";
