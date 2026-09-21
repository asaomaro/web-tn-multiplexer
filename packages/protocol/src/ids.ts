/**
 * ID の形式。design.md「識別子」・architecture.md「識別子」参照。
 * サーバ全体で種類ごとに単調増加する整数を、接頭辞付きの文字列にしたもの。
 * 例: workspace は "w1"、tab は "t1"、pane は "p1"、レイアウトの分割ノードは "s1"、
 *     検出したエージェントのインスタンスは "a1"。
 */
export type WorkspaceId = string;
export type TabId = string;
export type PaneId = string;
export type SplitId = string;
export type AgentInstanceId = string;
export type ClientId = string;

export type IdKind = "w" | "t" | "p" | "s" | "a";

/** 種類ごとの次の番号（`session.json` の `nextId` に対応）。 */
export type NextIdCounters = Record<IdKind, number>;

export function formatId(kind: IdKind, n: number): string {
  return `${kind}${n}`;
}

const ID_RE = /^([a-z])([1-9][0-9]*)$/;

/** id の接頭辞から種類を取り出す。形式が不正なら null。 */
export function parseId(id: string): { kind: IdKind; n: number } | null {
  const m = ID_RE.exec(id);
  if (!m) return null;
  const kind = m[1] as IdKind;
  if (kind !== "w" && kind !== "t" && kind !== "p" && kind !== "s" && kind !== "a") return null;
  return { kind, n: Number(m[2]) };
}
