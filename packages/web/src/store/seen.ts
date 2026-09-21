import type { AgentInfo, DisplayState } from "@wtm/protocol";
import { defineStore } from "pinia";
import { ref } from "vue";

const STORAGE_KEY = "wtm.seen.v1";

function loadFromStorage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 保存できなくても致命的ではない（次回の起動で既読が再初期化されるだけ）。
  }
}

/**
 * エージェントの `instanceId` ごとの既読（architecture.md「store/seen」）。ブラウザごとに別々に持つ
 * （design「エージェントの状態」。`[H]concepts.mdx:51` と同じ）。
 */
export const useSeenStore = defineStore("seen", () => {
  const seen = ref<Record<string, number>>(loadFromStorage());

  /** 記録が無ければ `fallback`（サーバの `serverSeenSeq`）を返す。 */
  function getSeenSeq(instanceId: string, fallback: number): number {
    return seen.value[instanceId] ?? fallback;
  }

  function markSeen(instanceId: string, seq: number): void {
    if (seen.value[instanceId] === seq) return;
    seen.value = { ...seen.value, [instanceId]: seq };
    saveToStorage(seen.value);
  }

  return { seen, getSeenSeq, markSeen };
});

/** D19：利用者の対応が要る順。数値が大きいほど優先。 */
export const STATE_PRIORITY: Record<DisplayState, number> = {
  blocked: 4,
  done: 3,
  working: 2,
  idle: 1,
  unknown: 0,
};

/** pane 単体の表示用の状態。`done` は `idle` かつ `completionSeq > seenSeq` のとき（design「エージェントの状態」）。 */
export function displayStateFor(agent: AgentInfo | null, seenSeq: number): DisplayState | null {
  if (!agent) return null;
  if (agent.state === "idle" && agent.completionSeq > seenSeq) return "done";
  return agent.state;
}

/**
 * 複数の表示状態から代表を選ぶ（D19。pane → tab → workspace と段を踏んでも数学的に同じ結果になるので、
 * tab の段は経由せず全 pane から直接求める。D56 の訂正 6）。エージェントの居ない pane（null）は無視する。
 */
export function aggregate(states: (DisplayState | null)[]): DisplayState | null {
  let best: DisplayState | null = null;
  for (const s of states) {
    if (s === null) continue;
    if (best === null || STATE_PRIORITY[s] > STATE_PRIORITY[best]) best = s;
  }
  return best;
}

/**
 * 既読を進めてよいか（D56 の訂正 6）：pane が表示に含まれていて（破棄されていない）、かつウィンドウの
 * フォーカスが失われたと分かっていないとき（`document.hasFocus()` が false と確認できていなければ進める）。
 */
export function shouldMarkSeen(paneVisible: boolean, windowFocused: boolean): boolean {
  return paneVisible && windowFocused;
}
