import type { AgentInfo, AgentState } from "@wtm/protocol";
import { stripAnsi } from "./ansiStrip.js";

/**
 * `wtmctl agent` の判定（20260926-agent-automation-api design.md「`agentStatus.ts`」）。
 * 状態の名前は herdr の `agent_status`（`done` を含む 5 値）に揃える。
 */

export type AgentStatus = "working" | "blocked" | "idle" | "done" | "unknown";

export const AGENT_STATUSES: readonly AgentStatus[] = [
  "working",
  "blocked",
  "idle",
  "done",
  "unknown",
];

/** herdr の `agent_wait_statuses`（`src/api/wait.rs`）と同じ既定。`unknown` は明示したときだけ一致させる。 */
export const DEFAULT_UNTIL: readonly AgentStatus[] = ["idle", "done", "blocked"];

/**
 * `packages/web/src/store/seen.ts` の `displayStateFor` に、既読としてサーバの `serverSeenSeq` を渡した場合と同じ規則
 * （cli は web に依存しないので複製している。規則を変えるときは両方を揃える）。
 */
export function statusOf(agent: AgentInfo): AgentStatus {
  if (agent.state === "idle" && agent.completionSeq > agent.serverSeenSeq) return "done";
  return agent.state;
}

export function resolveUntil(until: readonly AgentStatus[]): readonly AgentStatus[] {
  return until.length > 0 ? until : DEFAULT_UNTIL;
}

export interface AgentLocation {
  paneId: string;
  tabId: string;
  workspaceId: string | null;
}

export interface AgentView {
  paneId: string;
  workspaceId: string | null;
  tabId: string;
  status: AgentStatus;
  kind: string;
  label: string;
  state: AgentState;
  instanceId: string;
  completionSeq: number;
  serverSeenSeq: number;
  since: number;
  verified: boolean;
}

export function toAgentView(loc: AgentLocation, agent: AgentInfo): AgentView {
  return {
    paneId: loc.paneId,
    workspaceId: loc.workspaceId,
    tabId: loc.tabId,
    status: statusOf(agent),
    kind: agent.kind,
    label: agent.label,
    state: agent.state,
    instanceId: agent.instanceId,
    completionSeq: agent.completionSeq,
    serverSeenSeq: agent.serverSeenSeq,
    since: agent.since,
    verified: agent.verified,
  };
}

export type WaitVerdict = "match" | "gone" | "pending";

/** 待ち始めのエージェント（`expectedInstanceId`）が居なくなった・入れ替わったら `gone`。 */
export function judgeWait(
  expectedInstanceId: string,
  current: AgentInfo | null,
  until: readonly AgentStatus[],
): WaitVerdict {
  if (current === null || current.instanceId !== expectedInstanceId) return "gone";
  return until.includes(statusOf(current)) ? "match" : "pending";
}

const ALT_SCREEN_ENTER = "\u001B[?1049h";

/**
 * alternate screen が有効な pane の SNAPSHOT は「通常画面（スクロールバック込み）」の直後に改行を挟まず
 * `ESC[?1049h` と alt screen の中身が続く（`@xterm/addon-serialize` の出力）。今の画面として後ろだけを返す。
 */
export function currentScreen(raw: string): string {
  const i = raw.lastIndexOf(ALT_SCREEN_ENTER);
  return i < 0 ? raw : raw.slice(i + ALT_SCREEN_ENTER.length);
}

/** 末尾の空行（ANSI を除いて空白だけの行）を捨ててから、最後の `n` 行を返す。 */
export function lastLines(text: string, n: number): string {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && stripAnsi(lines[lines.length - 1]!).trim() === "") lines.pop();
  return lines.slice(-n).join("\n");
}
