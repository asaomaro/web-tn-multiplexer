/**
 * 表示領域の大きさが変わってから `client.view` を commit し直すまでの最短の間隔（ms）。デスクトップの `PaneLayout` の
 * `followResize`（D107）とモバイルの `usePaneArea`（D108）で共有する——窓の端のドラッグ・回転・ソフトキーボードの開閉の
 * アニメーションの間、フレームごとに PTY の大きさを変えて SIGWINCH を送り続けない。
 */
export const RESIZE_COMMIT_INTERVAL_MS = 100;

export interface TrailingThrottle {
  /** `fn` を呼ぶ予約をする（予約が待っている間の呼び出しは、その予約にまとめる）。 */
  schedule(): void;
  /** 待っている予約を捨てる（後始末。その後の `schedule` はまた効く）。 */
  cancel(): void;
}

/**
 * 大きさの変化の通知を間引く（D107・D108 で `PaneLayout` と `usePaneArea` に同じものを書いていたのをまとめた）。最初の
 * `schedule()` から `intervalMs` 後に `fn` を 1 回呼び、その間の `schedule()` はまとめる。`fn` はタイマーが来たときの状態で
 * 測るので、間隔の中の最後の変化の分も必ず反映される。`fn` を呼んだ後の `schedule()` は新しい予約になる。
 */
export function createTrailingThrottle(fn: () => void, intervalMs: number = RESIZE_COMMIT_INTERVAL_MS): TrailingThrottle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(): void {
      if (timer !== null) return; // 間隔の中の変化はまとめる（タイマーが来たときの大きさで測る）
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, intervalMs);
    },
    cancel(): void {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
