import type { NotifyKind } from "./policy.js";
import type { SoundPort, SoundResult } from "./ports.js";

/**
 * 通知音。**音源ファイルを同梱せず `OscillatorNode` で作る**（design の退けた代替案）——
 * ライセンスと容量が要らず、なにより **`AudioContext.state` で「鳴らせたか」を判定できる**（AC13）。
 * herdr が mp3 を埋め込んでいるのは外部プレイヤーに渡す都合で、ブラウザには当てはまらない。
 *
 * **自動再生の制限**はページの読み込みごとに利用者の操作を要求する。本製品は端末に打鍵するので
 * 実質ほぼ解除されるが、「開いて放置 → 別タブ → 最初の通知」は未解除で来うる。
 * そのとき **`"blocked"` を返して黙って捨てない**。
 */

/** 2 音の高さ（Hz）。入力待ちは**上がる**、完了は**下がる**——耳で区別できるように向きを変える（AC2）。 */
const TONES: Record<NotifyKind, readonly [number, number]> = {
  blocked: [660, 990],
  done: [880, 587],
};

const TONE_MS = 110;
const GAP_MS = 40;
/** 包絡線の立ち上がり。**付けないと start/stop でプツッというクリック音が出る**。 */
const ATTACK_S = 0.008;
const RELEASE_S = 0.09;

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const w = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class ToneSound implements SoundPort {
  /** **1 つを使い回す**（通知のたびに new すると上限に当たる）。 */
  #ctx: AudioContext | null = null;
  #unsupported = false;

  #context(): AudioContext | null {
    if (this.#unsupported) return null;
    if (this.#ctx) return this.#ctx;
    const Ctor = audioContextCtor();
    if (!Ctor) {
      this.#unsupported = true;
      return null;
    }
    try {
      this.#ctx = new Ctor();
      return this.#ctx;
    } catch {
      this.#unsupported = true;
      return null;
    }
  }

  play(kind: NotifyKind): SoundResult {
    const ctx = this.#context();
    if (!ctx) return "unsupported";
    // 利用者がこの画面をまだ操作していなければ `suspended` のまま——**鳴らない事実を返す**。
    if (ctx.state !== "running") return "blocked";

    try {
      const [a, b] = TONES[kind];
      this.#beep(ctx, a, ctx.currentTime);
      this.#beep(ctx, b, ctx.currentTime + (TONE_MS + GAP_MS) / 1000);
      return "played";
    } catch {
      return "blocked";
    }
  }

  /** 利用者の操作から呼ぶ（案内の［許可する］・設定で音を「入」にしたとき）。 */
  unlock(): void {
    const ctx = this.#context();
    if (!ctx || ctx.state === "running") return;
    void ctx.resume().catch(() => undefined); // 失敗しても次の `play` が `"blocked"` を返すだけ
  }

  #beep(ctx: AudioContext, hz: number, at: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(hz, at);
    // 包絡線：無音 → 立ち上げ → 減衰。`exponentialRampToValueAtTime` は 0 を取れないので小さい値へ。
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ATTACK_S + RELEASE_S);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + ATTACK_S + RELEASE_S + 0.01);
  }
}
