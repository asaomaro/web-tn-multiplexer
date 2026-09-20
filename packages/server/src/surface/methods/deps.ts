import type { SessionService } from "../../session/SessionService.js";
import type { ClientRegistry } from "../../clients/ClientRegistry.js";
import type { SizeAuthority } from "../../clients/SizeAuthority.js";
import type { TerminalManager } from "../../terminal/TerminalManager.js";

/** 方式のハンドラが使う部品一式（architecture.md「surface/methods/*.ts」の依存）。 */
export interface MethodDeps {
  session: SessionService;
  clients: ClientRegistry;
  sizeAuthority: SizeAuthority;
  terminals: TerminalManager;
}
