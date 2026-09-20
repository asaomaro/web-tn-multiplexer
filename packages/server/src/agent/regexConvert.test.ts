import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { convertRustRegex } from "./regexConvert.js";

// third_party/herdr/agent-detection/*.toml（D5。無改変で取り込み済み）から、実際に使われている全ての
// regex/line_regex を抜き出して変換を確かめる（tasks.md T2「23ファイルに含まれる全正規表現…」）。
const MANIFEST_DIR = join(import.meta.dirname, "..", "..", "..", "..", "third_party", "herdr", "agent-detection");

interface RawGate {
  regex?: string[];
  line_regex?: string[];
  all?: RawGate[];
  any?: RawGate[];
  not?: RawGate[];
}
interface RawManifest {
  rules?: (RawGate & { id: string })[];
}

function* walkGates(gate: RawGate): Generator<{ regex: string[]; line_regex: string[] }> {
  yield { regex: gate.regex ?? [], line_regex: gate.line_regex ?? [] };
  for (const nested of [...(gate.all ?? []), ...(gate.any ?? []), ...(gate.not ?? [])]) {
    yield* walkGates(nested);
  }
}

async function collectAllPatterns(): Promise<{ file: string; ruleId: string; field: "regex" | "line_regex"; pattern: string }[]> {
  const out: { file: string; ruleId: string; field: "regex" | "line_regex"; pattern: string }[] = [];
  const files = (await readdir(MANIFEST_DIR)).filter((f) => f.endsWith(".toml") && f !== "index.toml");
  for (const file of files) {
    const raw = await readFile(join(MANIFEST_DIR, file), "utf8");
    const manifest = parse(raw) as RawManifest;
    for (const rule of manifest.rules ?? []) {
      for (const gate of walkGates(rule)) {
        for (const p of gate.regex) out.push({ file, ruleId: rule.id, field: "regex", pattern: p });
        for (const p of gate.line_regex) out.push({ file, ruleId: rule.id, field: "line_regex", pattern: p });
      }
    }
  }
  return out;
}

describe("convertRustRegex — herdr の23ファイル全件（U2）", () => {
  it("全ての regex/line_regex が変換でき、有効な RegExp になる", async () => {
    const patterns = await collectAllPatterns();
    expect(patterns.length).toBeGreaterThan(90); // 実測 103 件（減っていたら third_party の中身が変わった合図）
    const failures: string[] = [];
    for (const { file, ruleId, field, pattern } of patterns) {
      const result = convertRustRegex(pattern);
      if (!result.ok) failures.push(`${file}:${ruleId}:${field} ${JSON.stringify(pattern)} — ${result.reason}`);
    }
    expect(failures).toEqual([]);
  });
});

describe("convertRustRegex — 個別の構文", () => {
  it("\\x{HHHH} を \\u{HHHH} に変換する（可変長。u フラグが立つ）", () => {
    const r = convertRustRegex("^[\\x{2800}-\\x{28FF}] ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.flags).toContain("u");
    expect(r.regex.test("⠁ working")).toBe(true);
    expect(r.regex.test("a working")).toBe(false);
  });

  it("固定4桁の \\uHHHH はそのまま通す（Rust でも JS でも同じ意味）", () => {
    const r = convertRustRegex("^\\s*[\\u2800-\\u28FF]+\\s+\\p{Alphabetic}+\\w*ing\\b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.test("⠁ loading")).toBe(true);
  });

  it("先頭の (?i) を外部フラグへ移す", () => {
    const r = convertRustRegex("(?i)esc to close\\s*$");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.flags).toContain("i");
    expect(r.regex.test("ESC TO CLOSE")).toBe(true);
  });

  it("先頭の (?m) を外部フラグへ移す", () => {
    const r = convertRustRegex("(?m)^\\s*❯\\s*$");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.flags).toContain("m");
    expect(r.regex.test("line1\n  ❯  \nline3")).toBe(true);
  });

  it("先頭の (?s) を外部フラグへ移す（. が改行にも一致する）", () => {
    const r = convertRustRegex("(?s).+");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.flags).toContain("s");
    expect(r.regex.test("a\nb")).toBe(true);
  });

  it("\\A は文字列の絶対先頭だけに一致する（行頭には一致しない）", () => {
    // codex.toml の trust_directory と同じ形。
    const r = convertRustRegex("\\A> You are in [^\\r\\n]+(?:\\r?\\n|$)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.test("> You are in /tmp\n")).toBe(true);
    expect(r.regex.test("prefix\n> You are in /tmp\n")).toBe(false); // 2行目の "> You are in" は \A に一致しない
  });

  it("\\z は (?m) が同じ式に付いていても文字列の絶対末尾だけに一致する（codex weak_blocker の形）", () => {
    const r = convertRustRegex("(?m)^›[⠁⠂⠄⠈⠐⠠⡀⢀][^\\n]*(?:\\n(?:[^•■✗✓\\n][^\\n]*)?)*\\z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.test("›⠁ working on it")).toBe(true);
    // 続く行が通常のテキストなら (?:\n...)* に吸収されて末尾まで届く。
    expect(r.regex.test("›⠁ working on it\nmore stuff after")).toBe(true);
    // 続く行がブロックの印（•■✗✓）で始まると (?:\n...)* に吸収されず、\z の手前で終端に届かない。
    expect(r.regex.test("›⠁ working on it\n•done")).toBe(false);
  });

  it("\\p{Alphabetic} をそのまま通す（JS が直接対応する Unicode プロパティ名）", () => {
    const r = convertRustRegex("^\\s*(◔|◑|◕|●)\\s+\\p{Alphabetic}");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regex.test("◔ Thinking")).toBe(true);
    expect(r.regex.test("◔ 123")).toBe(false);
  });

  it("式の途中に現れる (?i) は変換できない扱いにする（herdr の23ファイルには実例が無いが、念のため）", () => {
    const r = convertRustRegex("abc(?i)def");
    expect(r.ok).toBe(false);
  });

  it("壊れた正規表現は ok:false を返す（例外を投げない）", () => {
    const r = convertRustRegex("[unterminated");
    expect(r.ok).toBe(false);
  });
});
