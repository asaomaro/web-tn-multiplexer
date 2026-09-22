import { ACTIONS, actionDef, DEFAULT_PREFIX, type ActionId } from "./bindings.js";
import {
  formatBinding,
  formatChord,
  isDirectChord,
  parseBinding,
  parseChord,
  prefixBytes,
} from "./chord.js";

/**
 * このブラウザに保存する割り当て（20260921-keybinding-customization。design「保存」・D2）。**既定との差だけ**を持つ——既定を保存しないので、
 * 更新で既定が変わっても差の無い操作には届く。`wtm.prefs.v1` の `keys` に `{ prefix?, bindings? }`（差が無ければ `keys` ごと消す）。
 *
 * 読み込みは**値ごとに落とす**（残りは生かす。`store/settings.ts` の他の設定と同じ流儀）。**衝突・予約の判定はここではしない**——`keymap.ts` の `resolveKeymap` が
 * 読み込みも編集も同じ規則で行う（D7）。
 */
export interface KeyPrefs {
  /** 上書きした prefix の chord。null は既定（`ctrl+b`）。 */
  prefix: string | null;
  /** 上書きした操作の割り当て（`prefix+v`・`ctrl+alt+d` の正規形の文字列）。`[]` は「割り当てなし」（既定へ戻すのではない）。 */
  bindings: Partial<Record<ActionId, string[]>>;
}

export function emptyKeyPrefs(): KeyPrefs {
  return { prefix: null, bindings: {} };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * prefix の chord を読む。**端末へ送れる形だけ**（D5。`prefixBytes` が列を返すもの）。読めない・送れない形は undefined。
 * 既定（`ctrl+b`）は正規形の `ctrl+b` を返す（「差が無い」の判断は呼ぶ側）。
 */
export function parsePrefix(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const parts = parseChord(raw);
  if (parts === null) return undefined;
  const chord = formatChord(parts);
  return prefixBytes(chord) === null ? undefined : chord;
}

/** 保存された prefix を読む。読めない・送れない形は null（＝既定）。既定と同じ値も null（差が無い）。 */
export function loadPrefix(raw: unknown): string | null {
  const chord = parsePrefix(raw);
  return chord === undefined || chord === DEFAULT_PREFIX ? null : chord;
}

/**
 * 1 つの割り当ての文字列を、その操作で有効な**正規の文字列**にする。無効は null。
 * 範囲（`1..9`）は範囲の操作でだけ・範囲の操作は範囲でだけ。直接のキーは「ctrl・alt・cmd を含む chord か F キー」（`isDirectChord`）だけ。
 */
export function normalizeBinding(id: ActionId, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const b = parseBinding(raw);
  if (b === null) return null;
  const indexed = actionDef(id)?.indexed === true;
  if (b.range !== indexed) return null;
  if (b.via === "direct" && !isDirectChord(b.chord)) return null;
  return formatBinding(b);
}

/** 割り当ての一覧を正規の文字列にし、無効・重複を落とす（順序は保つ）。 */
function normalizeList(id: ActionId, raw: readonly unknown[]): string[] {
  const list: string[] = [];
  for (const s of raw) {
    const n = normalizeBinding(id, s);
    if (n !== null && !list.includes(n)) list.push(n);
  }
  return list;
}

/** `wtm.prefs.v1` の `keys` を読む。形が違えば空（既定）。 */
export function loadKeyPrefs(raw: unknown): KeyPrefs {
  const prefs = emptyKeyPrefs();
  if (!isRecord(raw)) return prefs;
  prefs.prefix = loadPrefix(raw["prefix"]);
  const stored = raw["bindings"];
  if (!isRecord(stored)) return prefs;
  for (const def of ACTIONS) {
    // カタログの順に読む（結果が決定的になる）。未知の操作の項目は読まれない。
    const value = stored[def.id];
    if (!Array.isArray(value)) continue;
    const list = normalizeList(def.id, value);
    if (list.length === 0 && value.length > 0) continue; // 全部落ちたら、上書きを消して既定へ戻す（元から `[]` のときだけ「割り当てなし」）
    if (sameList(list, def.defaults)) continue; // 既定と同じ内容は「差」ではない
    prefs.bindings[def.id] = list;
  }
  return prefs;
}

/** 保存する形。差が無ければ undefined（`keys` ごと消す）。カタログの順に並べる。 */
export function serializeKeyPrefs(
  p: KeyPrefs,
): { prefix?: string; bindings?: Record<string, string[]> } | undefined {
  const out: { prefix?: string; bindings?: Record<string, string[]> } = {};
  if (p.prefix !== null) out.prefix = p.prefix;
  const bindings: Record<string, string[]> = {};
  for (const def of ACTIONS) {
    const list = p.bindings[def.id];
    if (list !== undefined) bindings[def.id] = [...list];
  }
  if (Object.keys(bindings).length > 0) out.bindings = bindings;
  return out.prefix === undefined && out.bindings === undefined ? undefined : out;
}

/**
 * ある操作の割り当てを差し替えた新しい `KeyPrefs`（store の setter の下請け）。無効な文字列は落とし（渡されたら反映しない）、
 * **既定と同じ内容になったら上書きを消す**（保存を最小に保ち、既定の更新が届く）。全部無効で空でない入力は、何も変えない。
 */
export function withBindings(prefs: KeyPrefs, id: ActionId, list: readonly string[]): KeyPrefs {
  const norm = normalizeList(id, list);
  if (norm.length === 0 && list.length > 0) return prefs;
  const bindings = { ...prefs.bindings };
  if (sameList(norm, actionDef(id)?.defaults ?? [])) delete bindings[id];
  else bindings[id] = norm;
  return { ...prefs, bindings };
}

/** prefix を差し替えた新しい `KeyPrefs`。null は既定へ戻す。無効な chord は何も変えない。既定と同じなら上書きを消す。 */
export function withPrefix(prefs: KeyPrefs, chord: string | null): KeyPrefs {
  if (chord === null) return { ...prefs, prefix: null };
  const parsed = parsePrefix(chord);
  if (parsed === undefined) return prefs;
  return { ...prefs, prefix: parsed === DEFAULT_PREFIX ? null : parsed };
}

/** ある操作の上書きを消す（既定へ戻す）。 */
export function withoutBindings(prefs: KeyPrefs, id: ActionId): KeyPrefs {
  if (prefs.bindings[id] === undefined) return prefs;
  const bindings = { ...prefs.bindings };
  delete bindings[id];
  return { ...prefs, bindings };
}
