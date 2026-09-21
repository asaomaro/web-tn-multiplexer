/**
 * `AgentTracker` のテスト。working→idle の保留のケースは herdr のソース（`da6bcd5`。Apache-2.0・D5）の
 * `src/pane/agent_detection.rs` の `pending_idle_holds_working_to_plain_idle_until_confirmed` を、
 * 本製品の `TrackerJudgment`/`FakeClock` の形に書き換えて移植した（T11。移植元は該当 `describe` に
 * herdr 側の関数名で明記する）。原文の Rust コードそのままではなく、TypeScript として書き直している。
 * 他のケース（起動猶予・visible の即時反映等）は本製品の設計に基づく自前のテスト。
 */
import { describe, expect, it } from "vitest";
import { AgentTracker, type Clock, type TrackerJudgment } from "./AgentTracker.js";

class FakeClock implements Clock {
  private t = 0;
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

function judgment(state: TrackerJudgment["state"], opts: Partial<TrackerJudgment> = {}): TrackerJudgment {
  return { state, visibleIdle: false, visibleBlocker: false, visibleWorking: false, ...opts };
}

function makeTracker(): { tracker: AgentTracker; clock: FakeClock; ids: string[] } {
  const clock = new FakeClock();
  const ids: string[] = [];
  let n = 0;
  const tracker = new AgentTracker(() => {
    n++;
    const id = `a${n}`;
    ids.push(id);
    return id;
  }, clock);
  return { tracker, clock, ids };
}

/** 3秒の起動猶予を抜ける（D46）。猶予中は判定しないので、猶予明け後にもう1回 update を呼ぶ必要がある。 */
function passStartupGrace(tracker: AgentTracker, clock: FakeClock): void {
  clock.advance(3000);
}

describe("AgentTracker — 新規検出と起動猶予（D46）", () => {
  it("新しい kind を見つけると instanceId を振り、state=unknown で即座に知らせる", () => {
    const { tracker, ids } = makeTracker();
    const result = tracker.update("claude", judgment("working", { visibleWorking: true }));
    expect(result).not.toBe("unchanged");
    expect(result).not.toBeNull();
    if (result && result !== "unchanged") {
      expect(result.instanceId).toBe(ids[0]);
      expect(result.kind).toBe("claude");
      expect(result.label).toBe("Claude Code");
      expect(result.verified).toBe(true);
      expect(result.state).toBe("unknown"); // 「判定中」の中間状態ではなく既存の unknown を使う（D46）
    }
  });

  it("猶予中（3秒未満）は判定を反映しない", () => {
    const { tracker, clock } = makeTracker();
    tracker.update("claude", judgment("working", { visibleWorking: true }));
    clock.advance(2999);
    const result = tracker.update("claude", judgment("blocked", { visibleBlocker: true }));
    expect(result).toBe("unchanged");
    expect(tracker.current()?.state).toBe("unknown");
  });

  it("猶予が明けたら判定を反映する", () => {
    const { tracker, clock } = makeTracker();
    tracker.update("claude", judgment("working", { visibleWorking: true }));
    passStartupGrace(tracker, clock);
    const result = tracker.update("claude", judgment("working", { visibleWorking: true }));
    expect(result).not.toBe("unchanged");
    if (result && result !== "unchanged") expect(result.state).toBe("working");
  });

  it("エージェントが別の種類に変わったら新しい instanceId を振り直す", () => {
    const { tracker, clock, ids } = makeTracker();
    tracker.update("claude", judgment("working", { visibleWorking: true }));
    passStartupGrace(tracker, clock);
    tracker.update("claude", judgment("working", { visibleWorking: true }));

    const switched = tracker.update("codex", judgment("working", { visibleWorking: true }));
    expect(switched).not.toBe("unchanged");
    if (switched && switched !== "unchanged") {
      expect(switched.instanceId).toBe(ids[1]);
      expect(switched.instanceId).not.toBe(ids[0]);
      expect(switched.kind).toBe("codex");
      expect(switched.completionSeq).toBe(0); // 新しいインスタンスなのでリセットされる
    }
  });

  it("kind が null（前面にエージェントがいない）になったら agent は null に戻る", () => {
    const { tracker, clock } = makeTracker();
    tracker.update("claude", judgment("working", { visibleWorking: true }));
    passStartupGrace(tracker, clock);
    tracker.update("claude", judgment("working", { visibleWorking: true }));

    const gone = tracker.update(null, "skip");
    expect(gone).toBeNull();
    expect(tracker.current()).toBeNull();
  });

  it("何も無い状態から kind=null が続いても unchanged のまま（無駄な更新を出さない）", () => {
    const { tracker } = makeTracker();
    expect(tracker.update(null, "skip")).toBe("unchanged");
    expect(tracker.update(null, "skip")).toBe("unchanged");
  });
});

describe("AgentTracker — working→idle の保留（herdr の pending_idle_holds_working_to_plain_idle_until_confirmed の移植）", () => {
  function readyTracker(): { tracker: AgentTracker; clock: FakeClock } {
    const { tracker, clock } = makeTracker();
    tracker.update("codex", judgment("unknown"));
    passStartupGrace(tracker, clock);
    tracker.update("codex", judgment("working", { visibleWorking: true }));
    return { tracker, clock };
  }

  it("素の idle（visible_idle/visible_blocker 無し）は3回確認するまで保留し、4回目で反映する", () => {
    const { tracker, clock } = readyTracker();
    const plainIdle = judgment("idle");

    expect(tracker.update("codex", plainIdle)).toBe("unchanged"); // 1回目：保留開始
    expect(tracker.current()?.state).toBe("working");
    clock.advance(100);
    expect(tracker.update("codex", plainIdle)).toBe("unchanged"); // 2回目
    clock.advance(100);
    expect(tracker.update("codex", plainIdle)).toBe("unchanged"); // 3回目
    clock.advance(100);
    const released = tracker.update("codex", plainIdle); // 4回目：確認3回に達して反映
    expect(released).not.toBe("unchanged");
    if (released && released !== "unchanged") {
      expect(released.state).toBe("idle");
      expect(released.completionSeq).toBe(1); // working→idle が実際に反映されたので done の元が1増える
    }
  });

  it("700ms の上限に達したら、確認回数に届いていなくても保留を終える", () => {
    const { tracker, clock } = readyTracker();
    const plainIdle = judgment("idle");
    tracker.update("codex", plainIdle); // 1回目
    clock.advance(750); // 上限（700ms）を超える
    const released = tracker.update("codex", plainIdle);
    expect(released).not.toBe("unchanged");
    if (released && released !== "unchanged") expect(released.state).toBe("idle");
  });

  it("visible_idle が立っている idle は保留せず即座に反映する", () => {
    const { tracker } = readyTracker();
    const result = tracker.update("codex", judgment("idle", { visibleIdle: true }));
    expect(result).not.toBe("unchanged");
    if (result && result !== "unchanged") expect(result.state).toBe("idle");
  });

  it("visible_blocker が立っている blocked は保留せず即座に反映する", () => {
    const { tracker } = readyTracker();
    const result = tracker.update("codex", judgment("blocked", { visibleBlocker: true }));
    expect(result).not.toBe("unchanged");
    if (result && result !== "unchanged") expect(result.state).toBe("blocked");
  });

  it("working のまま変化が無ければ何も発行しない", () => {
    const { tracker } = readyTracker();
    expect(tracker.update("codex", judgment("working", { visibleWorking: true }))).toBe("unchanged");
  });
});

describe("AgentTracker — skip_state_update", () => {
  it("'skip' が来ても状態は変わらない", () => {
    const { tracker, clock } = makeTracker();
    tracker.update("claude", judgment("working", { visibleWorking: true }));
    passStartupGrace(tracker, clock);
    tracker.update("claude", judgment("working", { visibleWorking: true }));

    expect(tracker.update("claude", "skip")).toBe("unchanged");
    expect(tracker.current()?.state).toBe("working");
  });
});

describe("AgentTracker — markSeen（design「done（未読）」）", () => {
  it("completionSeq に追いついていなければ serverSeenSeq を更新して知らせる", () => {
    const { tracker, clock } = makeTracker();
    tracker.update("codex", judgment("unknown"));
    passStartupGrace(tracker, clock);
    tracker.update("codex", judgment("working", { visibleWorking: true }));
    tracker.update("codex", judgment("idle", { visibleIdle: true })); // completionSeq が1増える

    expect(tracker.current()?.completionSeq).toBe(1);
    expect(tracker.current()?.serverSeenSeq).toBe(0);

    const seen = tracker.markSeen();
    expect(seen?.serverSeenSeq).toBe(1);
    expect(tracker.markSeen()).toBeNull(); // 既に追いついていれば変化なし
  });

  it("エージェントが居ないときは何もしない", () => {
    const { tracker } = makeTracker();
    expect(tracker.markSeen()).toBeNull();
  });
});
