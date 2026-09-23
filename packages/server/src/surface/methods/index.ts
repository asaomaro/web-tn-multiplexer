import type { ControlSurface } from "../ControlSurface.js";
import type { MethodDeps } from "./deps.js";
import { registerClientMethods } from "./client.js";
import { registerSubscribeMethods } from "./subscribe.js";
import { registerWorkspaceMethods } from "./workspace.js";
import { registerTabMethods } from "./tab.js";
import { registerPaneMethods } from "./pane.js";
import { registerLayoutMethods } from "./layout.js";
import { registerWorktreeMethods } from "./worktree.js";
import { registerAgentIntegrationMethods } from "./agentIntegration.js";

export type { MethodDeps } from "./deps.js";

/** design「方式」の表＋architecture「方式の追加と変更」の全方式を登録する
 *  （worktree の 2 つ・20260923-agent-session-resume の agent_integration 4 つを含む）。 */
export function registerAllMethods(surface: ControlSurface, deps: MethodDeps): void {
  registerClientMethods(surface, deps);
  registerSubscribeMethods(surface, deps);
  registerWorkspaceMethods(surface, deps);
  registerTabMethods(surface, deps);
  registerPaneMethods(surface, deps);
  registerLayoutMethods(surface, deps);
  registerWorktreeMethods(surface, deps);
  registerAgentIntegrationMethods(surface, deps);
}
