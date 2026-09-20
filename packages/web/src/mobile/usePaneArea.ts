import { onBeforeUnmount, watch, type Ref } from "vue";
import { createTrailingThrottle, RESIZE_COMMIT_INTERVAL_MS } from "../term/resizeThrottle.js";
import type { MeasuredSize } from "../term/ViewSync.js";

export interface UsePaneAreaOptions {
  /**
   * 表示領域（`MobileShell.vue` の `.mobile-shell-pane`）。上部のバーと追加キーの列を除いた、pane を置ける範囲。
   * 大きさはレイアウト（画面の幅・visual viewport の高さ・バーと追加キーの列の高さ）だけで決まり、中身（縮小の枠）の大きさ
   * ——サーバの PTY の大きさ——には左右されない（`overflow: hidden`・flex の伸縮で決まる大きさ）。
   */
  container: Ref<HTMLElement | null>;
  /** 今の表示で `client.view` を commit し直す（`PaneLayout` の `commitView`）。 */
  commit: () => void;
}

/**
 * モバイルの `client.view` の大きさを、表示領域いっぱいに端末を置いたときの大きさにし、表示領域の変化に追従させる
 * （04-mobile T9・D108。統合 review ラウンド1 で発見）。
 *
 * 以前は `ViewSync` が、`MobileShell` の縮小の枠（`naturalSize` × `scale`。`naturalSize` はサーバの PTY の大きさ × セルの寸法）の
 * 中の葉を `getBoundingClientRect()` で測っていた。そのため (1) fit 中（サイズ権限あり）は申告がサーバの今の大きさそのものに
 * なり、「この端末に合わせる」で最初に決まった大きさから画面の大きさへ広げも縮めもできなかった（iPhone 13 のエミュレーションで、
 * 53×41 が収まる表示領域に 53×24 の PTY）。(2) fit していないクライアントも表示領域ではなく葉の大きさを申告していた（D106 から PTY の
 * 大きさには効かないが、誤ったデータ）。葉の変化に追従させると「PTY の大きさ → 葉 → 申告 → PTY の大きさ」が回って縮む（D107 の実測）。
 *
 * - `measureSinglePane`：`PaneLayout` の `measureSinglePane`（→ `ViewSync.commit` の `measureSinglePane`）に渡す。葉の代わりに
 *   表示領域の大きさを返すので、`ViewSync` は「表示領域 ÷ セルの寸法」を申告する。PTY の大きさには左右されないので、上の循環は
 *   起きない。
 * - 表示領域の要素を `ResizeObserver` で見て、大きさが変われば `RESIZE_COMMIT_INTERVAL_MS` に 1 回まで（間隔の中の変化は
 *   まとめ、最後の変化の分は必ず。`term/resizeThrottle.ts`。デスクトップの `followResize` と共有）`commit` し直す。回転・窓の幅・ソフトキーボード（`useVisualViewportHeight` の高さを
 *   `.mobile-shell` に当てるので、表示領域が縮む）・追加キーの列の開閉のどれでも表示領域の大きさが変わる。同じ cols/rows なら
 *   `ViewSync` が送らない。
 *
 * サイズ権限の意味（D13・D106）は変えない：fit していないモバイルの申告はサーバの PTY の大きさを変えず（表示と購読のためには
 * 送る）、fit 中は PTY がこの申告（＝スマートフォンの表示領域から決まる大きさ）になる。
 */
export function usePaneArea(opts: UsePaneAreaOptions): { measureSinglePane: (paneId: string, element: HTMLElement) => MeasuredSize } {
  /**
   * **表示領域の全体を、表示している唯一の pane に当てる**（`paneId` を問わない）。`MobileShell` は単一 pane の木
   * （`{type:'pane', paneId}`）しか `PaneLayout` に渡さないので、表示領域 ＝ その pane の置き場になる。分割を描く使い方では
   * 成り立たないので、`ViewSync` は表示が 1 つの pane だけの commit でしかこれを呼ばない（2 つ以上なら葉を測り、開発時は警告する。
   * D108 の独立点検 #2）。
   */
  function measureSinglePane(_paneId: string, element: HTMLElement): MeasuredSize {
    // 表示領域が無い（`PaneLayout` は表示領域の中に描くので、実際には起きない）ときだけ、葉を測る以前の形に戻る。
    const rect = (opts.container.value ?? element).getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  let disposed = false;
  const commitThrottle = createTrailingThrottle(() => {
    if (!disposed) opts.commit();
  }, RESIZE_COMMIT_INTERVAL_MS);

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (!disposed) commitThrottle.schedule();
        })
      : null;
  if (resizeObserver) {
    watch(
      opts.container,
      (el, oldEl) => {
        if (oldEl) resizeObserver.unobserve(oldEl);
        if (el) resizeObserver.observe(el);
      },
      { immediate: true },
    );
  }

  onBeforeUnmount(() => {
    disposed = true;
    resizeObserver?.disconnect();
    commitThrottle.cancel();
  });

  return { measureSinglePane };
}
