import { describe, expect, it } from "vitest";
import { AGENT_NAME_MAX_LENGTH, isValidAgentName } from "./agentName.js";
import { AgentRenameParams, METHOD_SCHEMAS } from "./messages.js";

// herdr の `agent_names_use_a_small_cli_safe_grammar`（src/app/agents.rs）と同じ例。
describe("isValidAgentName", () => {
  it("英小文字で始まり、英小文字・数字・'-'・'_' の 1〜32 文字を受け付ける", () => {
    for (const name of [
      "a",
      "reviewer-one",
      "reviewer_2",
      "a".repeat(AGENT_NAME_MAX_LENGTH),
      "p1",
    ]) {
      expect(isValidAgentName(name), name).toBe(true);
    }
  });

  it("空・前後の空白・空白を含む・大文字・数字始まり・'.'・33 文字・改行は拒む", () => {
    for (const name of [
      "",
      " reviewer",
      "reviewer ",
      "reviewer one",
      "Reviewer",
      "1reviewer",
      "reviewer.one",
      "a".repeat(AGENT_NAME_MAX_LENGTH + 1),
      "reviewer\n",
      "-reviewer",
      "_reviewer",
      "revíewer",
    ]) {
      expect(isValidAgentName(name), JSON.stringify(name)).toBe(false);
    }
  });
});

describe("AgentRenameParams", () => {
  it("name は文字列か null（書式はスキーマでは弾かない）。instanceId は省略できる", () => {
    expect(AgentRenameParams.parse({ paneId: "p1", name: "reviewer" })).toEqual({
      paneId: "p1",
      name: "reviewer",
    });
    expect(AgentRenameParams.parse({ paneId: "p1", instanceId: "a1", name: null })).toEqual({
      paneId: "p1",
      instanceId: "a1",
      name: null,
    });
    expect(AgentRenameParams.parse({ paneId: "p1", name: "Bad Name" }).name).toBe("Bad Name");
    expect(() => AgentRenameParams.parse({ paneId: "p1" })).toThrow();
    expect(() => AgentRenameParams.parse({ paneId: "", name: "x" })).toThrow();
    expect(() => AgentRenameParams.parse({ paneId: "p1", instanceId: "", name: "x" })).toThrow();
  });

  it("方式の表にある", () => {
    expect(METHOD_SCHEMAS["agent.rename"]).toBe(AgentRenameParams);
  });
});
