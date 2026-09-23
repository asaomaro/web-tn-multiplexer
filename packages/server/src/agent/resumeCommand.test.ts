import { describe, expect, it } from "vitest";
import { resumeCommandFor } from "./resumeCommand.js";

describe("resumeCommandFor", () => {
  it("builds the Claude Code resume command", () => {
    expect(resumeCommandFor("claude", "1f9c-uuid")).toBe("claude --resume 1f9c-uuid");
  });

  it("builds the Codex resume command", () => {
    expect(resumeCommandFor("codex", "thr_123")).toBe("codex resume thr_123");
  });

  it("returns undefined for an unknown kind", () => {
    expect(resumeCommandFor("gemini", "abc")).toBeUndefined();
  });

  it("rejects a sessionId with shell metacharacters", () => {
    expect(resumeCommandFor("claude", "abc; rm -rf ~")).toBeUndefined();
    expect(resumeCommandFor("claude", "abc`whoami`")).toBeUndefined();
    expect(resumeCommandFor("claude", "abc$(id)")).toBeUndefined();
    expect(resumeCommandFor("claude", "abc\ndef")).toBeUndefined();
  });

  it("allows a path-like sessionId", () => {
    expect(resumeCommandFor("claude", "/home/user/.claude/projects/foo/1f9c.jsonl")).toBe(
      "claude --resume /home/user/.claude/projects/foo/1f9c.jsonl",
    );
  });
});
