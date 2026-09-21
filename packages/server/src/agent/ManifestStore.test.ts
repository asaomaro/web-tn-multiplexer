import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ManifestSource } from "../infra/ManifestSource.js";
import { FsManifestSource } from "../infra/FsManifestSource.js";
import { MemoryLogger } from "../log/Logger.js";
import { DefaultManifestStore } from "./ManifestStore.js";

const REAL_MANIFEST_DIR = join(import.meta.dirname, "..", "..", "..", "..", "third_party", "herdr", "agent-detection");

/** テスト用の偽の `ManifestSource`（in-memory）。 */
class FakeManifestSource implements ManifestSource {
  constructor(private readonly files: Record<string, string>) {}
  async list(): Promise<string[]> {
    return Object.keys(this.files).filter((n) => n.endsWith(".toml")).sort();
  }
  async read(name: string): Promise<string> {
    const content = this.files[name];
    if (content === undefined) throw new Error(`ENOENT: ${name}`);
    return content;
  }
}

describe("DefaultManifestStore — third_party/herdr/agent-detection の実物（T3 のテスト方針）", () => {
  it("22件全部が読み込めてコンパイルできる（index.toml を除く。U2 の確認と対になる）", async () => {
    const source = new FsManifestSource(REAL_MANIFEST_DIR);
    const logger = new MemoryLogger();
    const store = await DefaultManifestStore.load(source, logger);
    const summaries = store.summaries();
    expect(summaries.length).toBe(22);
    const failed = summaries.filter((s) => !s.ok);
    expect(failed).toEqual([]);
    for (const s of summaries) {
      expect(store.get(s.kind)).toBeDefined();
      expect(s.ruleCount).toBeGreaterThan(0);
    }
  });

  it("claude と codex の manifest が取れ、優先度の異なる複数ルールを持つ", async () => {
    const source = new FsManifestSource(REAL_MANIFEST_DIR);
    const store = await DefaultManifestStore.load(source, new MemoryLogger());
    const claude = store.get("claude");
    expect(claude?.rules.length).toBeGreaterThan(5);
    expect(new Set(claude?.rules.map((r) => r.priority)).size).toBeGreaterThan(1);
    expect(store.get("codex")?.rules.length).toBeGreaterThan(0);
  });
});

describe("DefaultManifestStore — 検証（herdr の validate_manifest を移植。D46）", () => {
  const INDEX = `schema_version = 1\n[[agents]]\nid = "x"\npath = "x.toml"\n`;

  async function loadOne(xToml: string): Promise<{ ok: boolean; error: string | null }> {
    const source = new FakeManifestSource({ "index.toml": INDEX, "x.toml": xToml });
    const store = await DefaultManifestStore.load(source, new MemoryLogger());
    const [summary] = store.summaries();
    return { ok: summary!.ok, error: summary!.error };
  }

  it("ルールが0件なら無効", async () => {
    const r = await loadOne(`id = "x"\n`);
    expect(r.ok).toBe(false);
  });

  it("空の id は無効", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = ""\nstate = "idle"\ncontains = ["a"]\n`);
    expect(r.ok).toBe(false);
  });

  it("skip_state_update は state=unknown を要求する", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\nskip_state_update = true\ncontains = ["a"]\n`);
    expect(r.ok).toBe(false);
  });

  it("skip_state_update は state 自体を省略しても無効（herdr は「明示的に unknown」を要求する。省略時の\
既定値埋め込みでは区別できない。review 指摘。should）", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nskip_state_update = true\ncontains = ["a"]\n`);
    expect(r.ok).toBe(false);
  });

  it("state を省略した通常のルール（skip_state_update 無し）は unknown として読み込める（herdr の\
unwrap_or(AgentState::Unknown)）", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\ncontains = ["a"]\n`);
    expect(r.ok).toBe(true);
  });

  it("skip_state_update と visible_* の同時指定は無効", async () => {
    const r = await loadOne(
      `id = "x"\n[[rules]]\nid = "r1"\nstate = "unknown"\nskip_state_update = true\nvisible_idle = true\ncontains = ["a"]\n`,
    );
    expect(r.ok).toBe(false);
  });

  it("未知の region 名は無効", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\nregion = "nonexistent_region"\ncontains = ["a"]\n`);
    expect(r.ok).toBe(false);
  });

  it("top_non_empty_lines は min_engine_version >= 3 を要求する", async () => {
    const withoutVersion = await loadOne(
      `id = "x"\nmin_engine_version = 2\n[[rules]]\nid = "r1"\nstate = "idle"\nregion = "top_non_empty_lines(3)"\ncontains = ["a"]\n`,
    );
    expect(withoutVersion.ok).toBe(false);
    const withVersion = await loadOne(
      `id = "x"\nmin_engine_version = 3\n[[rules]]\nid = "r1"\nstate = "idle"\nregion = "top_non_empty_lines(3)"\ncontains = ["a"]\n`,
    );
    expect(withVersion.ok).toBe(true);
  });

  it("top_non_empty_lines(0) は先頭ゼロ・0件を許さない（herdr の top_region_count）", async () => {
    const r = await loadOne(`id = "x"\nmin_engine_version = 3\n[[rules]]\nid = "r1"\nstate = "idle"\nregion = "top_non_empty_lines(0)"\ncontains = ["a"]\n`);
    expect(r.ok).toBe(false);
  });

  it("肯定の matcher が無い gate は無効", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\nnot = [{ contains = ["a"] }]\n`);
    expect(r.ok).toBe(false);
  });

  it("空の not gate は無効", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\ncontains = ["a"]\nnot = [{}]\n`);
    expect(r.ok).toBe(false);
  });

  it("壊れた正規表現は無効", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\nregex = ["[unterminated"]\n`);
    expect(r.ok).toBe(false);
  });

  it("gate の深さが上限（8）を超えたら無効", async () => {
    let nested = `{ contains = ["a"] }`;
    for (let i = 0; i < 9; i++) nested = `{ all = [${nested}] }`;
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\nall = [${nested}]\n`);
    expect(r.ok).toBe(false);
  });

  it("ルール数が上限（128）を超えたら無効（review 指摘。should。未検証だった検証上限）", async () => {
    const rules = (n: number): string =>
      Array.from({ length: n }, (_, i) => `[[rules]]\nid = "r${i}"\nstate = "idle"\ncontains = ["a${i}"]\n`).join("");
    const atLimit = await loadOne(`id = "x"\n${rules(128)}`);
    expect(atLimit.ok).toBe(true);
    const overLimit = await loadOne(`id = "x"\n${rules(129)}`);
    expect(overLimit.ok).toBe(false);
  });

  it("1つの gate の直接の matcher 数が上限（32）を超えたら無効（review 指摘。should。未検証だった検証上限）", async () => {
    const contains = (n: number): string => `[${Array.from({ length: n }, (_, i) => `"a${i}"`).join(", ")}]`;
    const atLimit = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\ncontains = ${contains(32)}\n`);
    expect(atLimit.ok).toBe(true);
    const overLimit = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\ncontains = ${contains(33)}\n`);
    expect(overLimit.ok).toBe(false);
  });

  it("index.toml が読めない/壊れていても起動は続ける（要約が0件になるだけ）", async () => {
    const source = new FakeManifestSource({});
    const store = await DefaultManifestStore.load(source, new MemoryLogger());
    expect(store.summaries()).toEqual([]);
    expect(store.get("claude")).toBeUndefined();
  });

  it("正しい manifest はロードできる（対照）", async () => {
    const r = await loadOne(`id = "x"\n[[rules]]\nid = "r1"\nstate = "idle"\ncontains = ["a"]\n`);
    expect(r.ok).toBe(true);
  });
});
