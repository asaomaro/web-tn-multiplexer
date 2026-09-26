import type { AgentInfo, ServerEvent, SessionSnapshot } from "@wtm/protocol";
import {
  currentScreen,
  judgeWait,
  lastLines,
  resolveUntil,
  toAgentView,
  type AgentStatus,
  type AgentView,
} from "../agentStatus.js";
import { stripAnsi } from "../ansiStrip.js";
import type { Command } from "../cliArgs.js";
import { printJson, printLine } from "../output.js";
import type { SessionStore } from "../session.js";
import { withSession } from "../withSession.js";
import { RpcFailure, type WtmClient } from "../wsClient.js";
import { readPaneSnapshot } from "./pane.js";

/** `agent list` / `get` / `wait` / `read`（20260926-agent-automation-api design.md「振る舞いの詳細」）。 */

type AgentListCmd = Extract<Command, { kind: "agent-list" }>;
type AgentGetCmd = Extract<Command, { kind: "agent-get" }>;
type AgentWaitCmd = Extract<Command, { kind: "agent-wait" }>;
type AgentReadCmd = Extract<Command, { kind: "agent-read" }>;

interface AgentPane {
  paneId: string;
  tabId: string;
  agent: AgentInfo;
}

function workspacesByTab(snapshot: SessionSnapshot): Map<string, string> {
  return new Map(snapshot.tabs.map((t) => [t.id, t.workspaceId]));
}

function requireAgentPane(snapshot: SessionSnapshot, paneId: string): AgentPane {
  const pane = snapshot.panes.find((p) => p.id === paneId);
  if (!pane) throw new RpcFailure("agent_not_found", `pane not found: ${paneId}`);
  if (!pane.agent) throw new RpcFailure("agent_not_found", `no agent detected in pane: ${paneId}`);
  return { paneId: pane.id, tabId: pane.tabId, agent: pane.agent };
}

function viewOf(target: AgentPane, workspaces: Map<string, string>): AgentView {
  return toAgentView(
    {
      paneId: target.paneId,
      tabId: target.tabId,
      workspaceId: workspaces.get(target.tabId) ?? null,
    },
    target.agent,
  );
}

export async function runAgentList(cmd: AgentListCmd, store: SessionStore): Promise<void> {
  const hello = await withSession(cmd.opts, store, async (client) => client.hello());
  const workspaces = workspacesByTab(hello.snapshot);
  const agents = hello.snapshot.panes.flatMap((p) =>
    p.agent ? [viewOf({ paneId: p.id, tabId: p.tabId, agent: p.agent }, workspaces)] : [],
  );
  printJson({ agents });
}

export async function runAgentGet(cmd: AgentGetCmd, store: SessionStore): Promise<void> {
  const hello = await withSession(cmd.opts, store, async (client) => client.hello());
  const target = requireAgentPane(hello.snapshot, cmd.paneId);
  printJson({ agent: viewOf(target, workspacesByTab(hello.snapshot)) });
}

function notRunning(): RpcFailure {
  return new RpcFailure("agent_not_running", "agent is no longer running in the target pane");
}

/** hello の応答の直後から届いたイベントを溜めておき、待ちを始めたら溜めた分から順に渡す。 */
class EventFeed {
  private readonly buffered: ServerEvent[] = [];
  private sink: ((evt: ServerEvent) => void) | null = null;

  readonly push = (evt: ServerEvent): void => {
    if (this.sink) this.sink(evt);
    else this.buffered.push(evt);
  };

  drain(sink: (evt: ServerEvent) => void): void {
    this.sink = sink;
    for (const evt of this.buffered.splice(0)) sink(evt);
  }
}

/**
 * hello の応答より後のイベント（snapshot より新しい）で状態を追い、一致・消失・時間切れ・切断のどれかで終わる。
 * 待ち始めのエージェント（`instanceId`）が入れ替わったら消失として扱う。
 */
function waitForAgent(
  client: WtmClient,
  events: EventFeed,
  target: AgentPane,
  workspaces: Map<string, string>,
  until: readonly AgentStatus[],
  timeoutMs: number | undefined,
): Promise<AgentView> {
  const expectedInstanceId = target.agent.instanceId;
  let tabId = target.tabId;
  return new Promise<AgentView>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      fn();
    };
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        finish(() => reject(new RpcFailure("timeout", "timed out waiting for agent status")));
      }, timeoutMs);
    }
    client.onClose((_code, reason) => {
      finish(() =>
        reject(
          new RpcFailure(
            "connection_closed",
            `server closed the connection: ${reason || "(no reason given)"}`,
          ),
        ),
      );
    });
    events.drain((evt: ServerEvent) => {
      if (settled) return;
      switch (evt.event) {
        case "tab.created":
        case "tab.updated":
          workspaces.set(evt.data.tab.id, evt.data.tab.workspaceId);
          return;
        case "pane.updated":
          if (evt.data.pane.id === target.paneId) tabId = evt.data.pane.tabId;
          return;
        case "pane.closed":
          if (evt.data.paneId === target.paneId) finish(() => reject(notRunning()));
          return;
        case "pane.agent_status_changed": {
          if (evt.data.paneId !== target.paneId) return;
          const agent = evt.data.agent;
          const verdict = judgeWait(expectedInstanceId, agent, until);
          if (verdict === "gone" || agent === null) finish(() => reject(notRunning()));
          else if (verdict === "match") {
            finish(() => resolve(viewOf({ paneId: target.paneId, tabId, agent }, workspaces)));
          }
          return;
        }
        default:
          return;
      }
    });
  });
}

export async function runAgentWait(cmd: AgentWaitCmd, store: SessionStore): Promise<void> {
  const agent = await withSession(cmd.opts, store, async (client) => {
    const events = new EventFeed();
    const hello = await client.hello(events.push);
    const target = requireAgentPane(hello.snapshot, cmd.paneId);
    const workspaces = workspacesByTab(hello.snapshot);
    const until = resolveUntil(cmd.until);
    if (judgeWait(target.agent.instanceId, target.agent, until) === "match") {
      return viewOf(target, workspaces);
    }
    return waitForAgent(client, events, target, workspaces, until, cmd.timeoutMs);
  });
  printJson({ agent });
}

export async function runAgentRead(cmd: AgentReadCmd, store: SessionStore): Promise<void> {
  const text = await withSession(cmd.opts, store, async (client) => {
    const hello = await client.hello();
    requireAgentPane(hello.snapshot, cmd.paneId);
    const snapshot = await readPaneSnapshot(
      client,
      cmd.paneId,
      hello.snapshot.limits.scrollbackLines,
      cmd.timeoutMs,
    );
    await client.request("pane.unsubscribe", { paneId: cmd.paneId });
    return snapshot;
  });
  const screen = currentScreen(text);
  printLine(lastLines(cmd.raw ? screen : stripAnsi(screen), cmd.lines));
}
