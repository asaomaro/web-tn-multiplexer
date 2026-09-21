import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * ソフトキーボード対応（04-mobile T7。design「スクロールと入力」：「ソフトキーボードで入力するときは、
 * visual viewport の高さに合わせて表示領域を詰める」）。`window.visualViewport`（無ければ
 * `window.innerHeight`。ソフトキーボードを検知できない環境向けのフォールバック）の高さを追跡する。
 * ソフトキーボードが開くとブラウザは visual viewport だけを縮める（レイアウトの viewport はそのまま。
 * research.md F10.9）ので、この高さをそのまま表示領域の高さに使えば、ソフトキーボードの上に収まる。
 *
 * 窓の `resize` でも読み直す（04-mobile T9・D108）。`client.view` の大きさはこの高さを当てた表示領域で測る（`usePaneArea`）ので、
 * 回転・窓の大きさの変化を取りこぼすと PTY の大きさが追従しない。`window.visualViewport` が無い環境（フォールバック）は
 * 以前は初期値のまま変わらなかった。ある環境でも、窓の変化では両方が届きうる（同じ値を入れ直すだけ）。
 *
 * **ピンチの拡大率を掛け戻す**（D108 の独立点検 #1）。`visualViewport.height` は見えている範囲を CSS px で表すので、拡大すると
 * 拡大率の分だけ縮む（2 倍なら半分）。そのまま当てると、fit 中はピンチのたびに表示領域が縮んで PTY の行が変わり、100ms ごとに
 * SIGWINCH を送っていた。`height × scale` は拡大率に左右されない「拡大していないときの見えている高さ」（ソフトキーボードの分は
 * 引かれたまま）なので、拡大しても変わらず、拡大したままソフトキーボードを開閉したときは追従できる。
 */
export function useVisualViewportHeight(): Ref<number> {
  const height = ref(readUnzoomedHeight());

  function onResize(): void {
    height.value = readUnzoomedHeight();
  }

  onMounted(() => {
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("resize", onResize);
  });
  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener("resize", onResize);
    window.removeEventListener("resize", onResize);
  });

  return height;
}

/**
 * visual viewport の高さから拡大（ピンチ）の分を除いた値（CSS px）。拡大していなければ `height` そのまま（以前と同じ値）。
 * 拡大中は `height × scale` を 1/100 px に丸める——`height` は float32 の精度で届く（例：664 を 1.5 倍に拡大すると
 * 442.66668701171875）ので、掛け戻した値の端数（664.00003 等）で表示領域の大きさを揺らさない。
 */
function readUnzoomedHeight(): number {
  const vv = window.visualViewport;
  if (!vv) return window.innerHeight;
  const scale = vv.scale;
  if (scale === 1 || !(scale > 0)) return vv.height; // 拡大率を持たない実装は拡大していないものとして扱う
  return Math.round(vv.height * scale * 100) / 100;
}
