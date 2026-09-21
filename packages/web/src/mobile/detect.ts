import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/** design「モバイル」の「判定」。768 CSS px 未満なら 1 列のレイアウトにする。 */
const MOBILE_BREAKPOINT_PX = 768;

/**
 * 画面幅が {@link MOBILE_BREAKPOINT_PX} 未満かどうか（design「モバイル」の判定。リアクティブ）。
 * Vue のコンポーネントの `setup()` から呼ぶ（`onMounted`/`onBeforeUnmount` を使うため）。
 * `isCoarsePointer()` とは独立の軸——ウィンドウを狭くしたデスクトップでも 1 列になってよい
 * （tasks.md「リスク / 留意点」）。
 */
export function isMobileViewport(): Ref<boolean> {
  const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
  const matches = ref(query.matches);
  const onChange = (ev: MediaQueryListEvent): void => {
    matches.value = ev.matches;
  };
  onMounted(() => query.addEventListener("change", onChange));
  onBeforeUnmount(() => query.removeEventListener("change", onChange));
  return matches;
}

/**
 * `(pointer: coarse)`（design「モバイル」の判定）。起動時に 1 回だけ評価し、`client.hello` の `kind`
 * （`'desktop' | 'mobile'`）に使う。コンポーネントの外（`main.ts`）からも呼べるよう、Vue の
 * ライフサイクルフックに依存しない素の関数にする。
 */
export function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}
