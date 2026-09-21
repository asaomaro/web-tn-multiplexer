/**
 * 上限つきで待つ（20260921-new-terminal-cwd の読み直し・20260921-workspace-auto-label の名前を決める処理の共通部品）。
 * **上限を超えた・reject した・同期で投げた**ら null を返す（呼ぶ側の作成を失敗させない）。捨てた Promise が後から reject しても
 * 未処理の拒否にしない（`AgentMonitor.foregroundJobWithTimeout` と同じ）。上限のタイマーは先に決まったら片付ける。
 *
 * `onTimeout` は上限を超えたときに 1 度だけ呼ぶ。`resolve` を先に呼ぶので `onTimeout` が投げても待っている側は戻る。`onTimeout` は待っている側が
 * 再開する前に同期で走る（`SessionService` はこの順序——数が増えてから呼び手が再開する——に依っている）。渡す `settled` は、
 * 待つのをやめた処理が後から終わった（成功・失敗のどちらでも）ときに解決する——**待つのをやめても、始めた処理（fs の stat 等）は取り消されない**
 * ので、呼ぶ側はそれが返るまで同じ処理を出さない、に使える。
 */
export async function withTimeout<T>(
  start: () => Promise<T>,
  ms: number,
  onTimeout?: (settled: Promise<void>) => void,
): Promise<T | null> {
  let real: Promise<T>;
  try {
    real = start();
  } catch {
    return null;
  }
  const settled = real.then(
    () => undefined,
    () => undefined,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
      try {
        onTimeout?.(settled);
      } catch {
        // 合図の失敗は待っている側に響かせない（ここで投げるとタイマーの中の捕捉されない例外になる）。
      }
    }, ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([real.catch(() => null), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
