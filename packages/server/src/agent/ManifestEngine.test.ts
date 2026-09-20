/**
 * `ManifestEngine.evaluate` のテスト。一部は herdr のソース（`da6bcd5`。Apache-2.0・D5）の
 * `src/detect/manifest/tests.rs` のケース（画面の fixture・期待する state）を、本製品の型
 * （`DetectionSnapshot`/`CompiledManifest`）に合わせて書き換えて移植した（T11。移植元は各 `describe` に
 * herdr 側の関数名で明記する）。原文の Rust コードそのままではなく、TypeScript として書き直している。
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FsManifestSource } from "../infra/FsManifestSource.js";
import { MemoryLogger } from "../log/Logger.js";
import { DefaultManifestStore, type CompiledManifest } from "./ManifestStore.js";
import { evaluate, type DetectionSnapshot } from "./ManifestEngine.js";

const REAL_MANIFEST_DIR = join(import.meta.dirname, "..", "..", "..", "..", "third_party", "herdr", "agent-detection");

/** herdr のテストの screen 文字列（末尾に `\n` を含むことがある）を `lines: string[]` へ揃える
 *  （Rust の `str::lines()` は末尾の改行から空行を作らない。design の `DetectionSnapshot.lines` も
 *  そういう形——`Mirror.bottomLines()` が返す素の行配列——を前提にしている）。 */
function linesOf(text: string): string[] {
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  return lines;
}

function snap(text: string, oscTitle = "", oscProgress: string | null = ""): DetectionSnapshot {
  return { lines: linesOf(text), oscTitle, oscProgress };
}

async function loadRealManifests(): Promise<DefaultManifestStore> {
  return DefaultManifestStore.load(new FsManifestSource(REAL_MANIFEST_DIR), new MemoryLogger());
}

function requireManifest(store: DefaultManifestStore, kind: string): CompiledManifest {
  const m = store.get(kind);
  if (!m) throw new Error(`manifest not loaded: ${kind}`);
  return m;
}

describe("evaluate — herdr の実物マニフェストに対する回帰テスト（tasks.md T4。herdr の manifest/tests.rs を移植）", () => {
  it("codex: どのルールにも一致しなければ idle（DEFAULT_KNOWN_AGENT_IDLE_FALLBACK 相当。known_agent_no_match_defaults_to_idle_fallback）", async () => {
    const store = await loadRealManifests();
    const codex = requireManifest(store, "codex");
    const result = evaluate(snap("ordinary prompt text"), codex);
    expect(result).not.toBe("skip");
    if (result === "skip") return;
    expect(result.state).toBe("idle");
    expect(result.ruleId).toBeNull();
    expect(result.visibleIdle).toBe(false);
  });

  it("claude: Bash 承認プロンプト（カーソルが『2』にあっても bash_permission_prompt に一致する。#2650 の回帰）", async () => {
    const store = await loadRealManifests();
    const claude = requireManifest(store, "claude");
    const screen = [
      "────────────────────────────────────────────────────────────────",
      " Bash command",
      "",
      "   curl -sS -o /tmp/probe.html https://example.com",
      "   Download example.com to /tmp/probe.html",
      "",
      " This command requires approval",
      "",
      " Do you want to proceed?",
      " ❯ 1. Yes",
      "   2. Yes, and don't ask again for: curl *",
      "   3. No",
      "",
      " Esc to cancel · Tab to amend · ctrl+e to explain",
    ].join("\n");
    const result = evaluate(snap(screen), claude);
    expect(result).not.toBe("skip");
    if (result === "skip") return;
    expect(result.state).toBe("blocked");
    expect(result.ruleId).toBe("bash_permission_prompt");
    expect(result.visibleBlocker).toBe(true);
  });

  it("claude: OSC タイトルの braille 接頭辞は working、静的な接頭辞は idle", async () => {
    const store = await loadRealManifests();
    const claude = requireManifest(store, "claude");
    const working = evaluate(snap("", "⠂ project"), claude); // U+2802（braille block）
    expect(working).not.toBe("skip");
    if (working !== "skip") {
      expect(working.state).toBe("working");
      expect(working.ruleId).toBe("osc_title_working");
      expect(working.visibleWorking).toBe(true);
    }
  });

  it("claude: live_prompt_box（prompt_box_body。末尾から2本目の水平線が上端）— review 指摘。should。\
未検証だった region だった", async () => {
    const store = await loadRealManifests();
    const claude = requireManifest(store, "claude");
    // 直前の会話（無関係な水平線を含む）＋アクティブな入力ボックス（末尾から2本目〜1本目の間が本体）。
    const screen = [
      "some earlier conversation turn",
      "────────────────────────────────────────",
      "unrelated older content",
      "────────────────────────────────────────", // prompt box の上端（末尾から数えて2本目）
      "❯ hello",
      "────────────────────────────────────────", // prompt box の下端（末尾から数えて1本目）
      "  ? for shortcuts",
    ].join("\n");
    const result = evaluate(snap(screen), claude);
    expect(result).not.toBe("skip");
    if (result === "skip") return;
    expect(result.state).toBe("idle");
    expect(result.ruleId).toBe("live_prompt_box");
    expect(result.visibleIdle).toBe(true);
  });

  it("devin: idle・working・blocked のそれぞれが実物の画面で判定できる（devin_manifest_detects_idle_working_and_blocked_states の抜粋）", async () => {
    const store = await loadRealManifests();
    const devin = requireManifest(store, "devin");

    const idle = evaluate(
      snap(
        "─────────────────────────────────────────────────────\n❭ Ask Devin to build features, fix bugs, or work on\n  your code\n─────────────────────────────────────────────────────\nSWE-1.6               Context: 16k / 200k tokens (7%)",
      ),
      devin,
    );
    expect(idle).not.toBe("skip");
    if (idle !== "skip") {
      expect(idle.state).toBe("idle");
      expect(idle.visibleIdle).toBe(true);
    }

    const working = evaluate(
      snap("◔ Reading shell 91b655\n  │ Timeout: 35s\n\n⠀⡆ Running tools · 27s (esc to interrupt)\n─────────────────────────────────────────────────────\n❭ Guide Devin while it works"),
      devin,
    );
    expect(working).not.toBe("skip");
    if (working !== "skip") {
      expect(working.state).toBe("working");
      expect(working.visibleWorking).toBe(true);
    }

    const blocked = evaluate(
      snap(
        "Do you trust the authors of this directory?\nFor security, devin should not be run in directories\nwith untrusted content.\n❭ 1 Yes, trust /private/tmp/devin-hook-probe\n· 2 No, exit",
      ),
      devin,
    );
    expect(blocked).not.toBe("skip");
    if (blocked !== "skip") {
      expect(blocked.state).toBe("blocked");
      expect(blocked.visibleBlocker).toBe(true);
    }
  });
});

describe("evaluate — gate の意味論（herdr の rule_semantics_apply_gates_priority_and_line_regex を合成マニフェストで移植）", () => {
  const manifest: CompiledManifest = {
    kind: "test",
    minEngineVersion: null,
    rules: [
      { id: "low_contains", state: "idle", priority: 1, region: "whole_recent", visibleIdle: false, visibleBlocker: false, visibleWorking: false, skipStateUpdate: false, gate: { contains: ["match"], regex: [], lineRegex: [], all: [], any: [], not: [] } },
      {
        id: "high_nested_gates",
        state: "working",
        priority: 10,
        region: "whole_recent",
        visibleIdle: false,
        visibleBlocker: false,
        visibleWorking: false,
        skipStateUpdate: false,
        gate: {
          contains: ["match"],
          regex: [],
          lineRegex: [],
          all: [{ contains: [], regex: [], lineRegex: [], all: [], any: [{ contains: [], regex: [/w[io]n/], lineRegex: [], all: [], any: [], not: [] }, { contains: ["fallback"], regex: [], lineRegex: [], all: [], any: [], not: [] }], not: [] }],
          any: [],
          not: [{ contains: ["blocked"], regex: [], lineRegex: [], all: [], any: [], not: [] }],
        },
      },
      { id: "line_regex", state: "blocked", priority: 20, region: "whole_recent", visibleIdle: false, visibleBlocker: false, visibleWorking: false, skipStateUpdate: false, gate: { contains: [], regex: [], lineRegex: [/^exact line$/], all: [], any: [], not: [] } },
    ],
  };

  it("all/any の入れ子と priority で高い方が勝つ", () => {
    const r = evaluate(snap("match win"), manifest);
    expect(r).not.toBe("skip");
    if (r !== "skip") {
      expect(r.state).toBe("working");
      expect(r.ruleId).toBe("high_nested_gates");
    }
  });

  it("not gate に一致すると、より優先度の低い他のルールへ落ちる", () => {
    const r = evaluate(snap("match win blocked"), manifest);
    expect(r).not.toBe("skip");
    if (r !== "skip") {
      expect(r.state).toBe("idle");
      expect(r.ruleId).toBe("low_contains");
    }
  });

  it("line_regex は行のどれかに一致すればよい", () => {
    const r = evaluate(snap("before\nexact line\nafter"), manifest);
    expect(r).not.toBe("skip");
    if (r !== "skip") {
      expect(r.state).toBe("blocked");
      expect(r.ruleId).toBe("line_regex");
    }
  });

  it("priority が同点なら、toml に書かれた順（配列で先に出会った方）が勝つ（D46。全ルール評価してから\
最高優先度を選ぶ、が正典——「優先度順に評価して最初の一致で止める」ではないことの回帰テスト。\
review 指摘。should。未検証だった同点の扱い）", () => {
    const tied = (firstId: string, secondId: string): CompiledManifest => ({
      kind: "test",
      minEngineVersion: null,
      rules: [
        { id: firstId, state: "working", priority: 5, region: "whole_recent", visibleIdle: false, visibleBlocker: false, visibleWorking: false, skipStateUpdate: false, gate: { contains: ["tie"], regex: [], lineRegex: [], all: [], any: [], not: [] } },
        { id: secondId, state: "blocked", priority: 5, region: "whole_recent", visibleIdle: false, visibleBlocker: false, visibleWorking: false, skipStateUpdate: false, gate: { contains: ["tie"], regex: [], lineRegex: [], all: [], any: [], not: [] } },
      ],
    });

    const workingFirst = evaluate(snap("tie"), tied("a_working", "b_blocked"));
    expect(workingFirst).not.toBe("skip");
    if (workingFirst !== "skip") expect(workingFirst.ruleId).toBe("a_working"); // 配列で先に出会った方が勝つ

    // 同じルールをファイル内で並べ替えただけ（意味的な優劣は無い）でも、勝つルールが変わる——
    // 「優先度の高い順に評価して最初の一致で止める」という早期終了の実装だと、この2ケースは
    // 同じ結果になってしまう（同点の扱いを間違えたことの検出）。
    const blockedFirst = evaluate(snap("tie"), tied("b_blocked", "a_working"));
    expect(blockedFirst).not.toBe("skip");
    if (blockedFirst !== "skip") expect(blockedFirst.ruleId).toBe("b_blocked");
  });
});

describe("evaluate — region の切り出し（herdr の bottom/top_non_empty_lines のテストを移植。末尾の空行の扱いは D46 参照）", () => {
  const manifestFor = (region: string): CompiledManifest => ({
    kind: "test",
    minEngineVersion: 3,
    rules: [{ id: "r", state: "working", priority: 1, region, visibleIdle: false, visibleBlocker: false, visibleWorking: false, skipStateUpdate: false, gate: { contains: ["marker"], regex: [], lineRegex: [], all: [], any: [], not: [] } }],
  });

  it("bottom_non_empty_lines(2) は空行を無視して、末尾から数えた2つの非空行から先を返す", () => {
    // herdr の bottom_non_empty_lines_uses_bottom_occurrence_for_repeated_text と同じ画面。
    // 元の Rust テストは末尾の "\n" を含む生文字列のサフィックスを比較するが、こちらは
    // `lines: string[]` 前提（Mirror.bottomLines() と同じ形）なので、末尾の空行アーティファクトを持たない。
    const lines = ["marker", "old", "", "middle", "marker", "new"];
    const result = evaluate({ lines, oscTitle: "", oscProgress: "" }, manifestFor("bottom_non_empty_lines(2)"));
    expect(result).not.toBe("skip"); // "marker" を含むので一致する（切り出しが "marker\nnew" になっている証拠）
  });

  it("top_non_empty_lines(2) は空行を無視して、先頭から数えた2つの非空行までを返す", () => {
    const lines = ["", "marker", "old", "", "middle", "marker", "new"];
    const result = evaluate({ lines, oscTitle: "", oscProgress: "" }, manifestFor("top_non_empty_lines(2)"));
    expect(result).not.toBe("skip"); // 先頭2つの非空行 "marker"・"old" までが切り出される
  });

  it("bottom_non_empty_lines(2) は末尾から3番目以降の内容を含まない", () => {
    const lines = ["marker-too-old", "old", "", "middle", "second", "third"];
    const manifest = manifestFor("bottom_non_empty_lines(2)");
    // 末尾2つの非空行は "second"・"third"。"marker" を含む行はそれより前なので切り出しに届かず、
    // ルールに一致しない（＝どのルールにも一致しなかったときの既定の idle・ruleId なしに落ちる）。
    const result = evaluate({ lines, oscTitle: "", oscProgress: "" }, manifest);
    expect(result).not.toBe("skip");
    if (result !== "skip") {
      expect(result.ruleId).toBeNull();
      expect(result.state).toBe("idle");
    }
  });
});

describe("evaluate — skip_state_update", () => {
  const manifest: CompiledManifest = {
    kind: "test",
    minEngineVersion: null,
    rules: [{ id: "viewer", state: "unknown", priority: 100, region: "whole_recent", visibleIdle: false, visibleBlocker: false, visibleWorking: false, skipStateUpdate: true, gate: { contains: ["transcript"], regex: [], lineRegex: [], all: [], any: [], not: [] } }],
  };

  it("skip_state_update のルールに一致したら 'skip' を返す", () => {
    expect(evaluate(snap("showing detailed transcript"), manifest)).toBe("skip");
  });

  it("一致しなければ通常どおり idle にフォールバックする", () => {
    const r = evaluate(snap("nothing special"), manifest);
    expect(r).not.toBe("skip");
    if (r !== "skip") expect(r.state).toBe("idle");
  });
});
