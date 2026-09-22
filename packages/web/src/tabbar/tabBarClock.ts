import { onBeforeUnmount, ref, watch, type Ref } from "vue";

const TICK_MS = 1000;

/**
 * tab バー右端の日時エントリ用の時計（20260922-tabbar-pane-appearance。design「振る舞いの詳細 / tab バー右端の
 * エントリ」）。1 秒間隔で更新される `Date` を返す。**`active` が偽の間はタイマーを張らない**——`tabBarRight` に
 * `datetime` 種別が 1 つも無い workspace で、無駄な再描画を起こさないため。
 */
export function useTabBarClock(active: Ref<boolean>): Ref<Date> {
  const now = ref(new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    if (timer) return;
    now.value = new Date(); // 再開の瞬間の値をすぐ反映（次の tick を待たない）
    timer = setInterval(() => {
      now.value = new Date();
    }, TICK_MS);
  }

  function stop(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  watch(active, (isActive) => (isActive ? start() : stop()), { immediate: true });
  onBeforeUnmount(stop);

  return now;
}
