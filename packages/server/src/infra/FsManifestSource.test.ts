import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FsManifestSource } from "./FsManifestSource.js";

const here = dirname(fileURLToPath(import.meta.url));
// packages/server/src/infra -> リポジトリルート/third_party/herdr/agent-detection
const manifestDir = join(here, "..", "..", "..", "..", "third_party", "herdr", "agent-detection");

describe("FsManifestSource", () => {
  it("lists all 23 herdr manifest files", async () => {
    const source = new FsManifestSource(manifestDir);
    const files = await source.list();
    expect(files.length).toBe(23);
    expect(files).toContain("claude.toml");
    expect(files).toContain("codex.toml");
    expect(files).toContain("index.toml");
    expect(files).toEqual([...files].sort()); // 安定した順序
  });

  it("reads a manifest file's raw content", async () => {
    const source = new FsManifestSource(manifestDir);
    const content = await source.read("claude.toml");
    expect(content).toContain('id = "claude"');
  });
});
