/**
 * エージェントの名前の書式（20260926-agent-start-rename）。herdr の `valid_agent_name`（`src/app/agents.rs`）と同じ
 * `[a-z][a-z0-9_-]{0,31}`。
 */

export const AGENT_NAME_MAX_LENGTH = 32;

const AGENT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export function isValidAgentName(name: string): boolean {
  return AGENT_NAME_PATTERN.test(name);
}

export const INVALID_AGENT_NAME_MESSAGE =
  "agent name must start with a lowercase letter and contain only lowercase letters, digits, '-' or '_' (1-32 characters)";
