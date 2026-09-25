# 仕様: 既読（wtm.seen.v1）の意味論を直す

## 概要

`main.ts` の `markVisibleAgentsSeen`（既読を進める唯一の呼び出し元）を、pane ごとに
`shouldMarkSeen(registry.isVisible(pane.id), document.hasFocus())`（既存の
`store/seen.ts` の純関数。既に単体テスト済みだが本番未使用）で判定してから
`seen.markSeen` を呼ぶ形に直す。加えて、`TerminalRegistry.isVisible` が Vue の reactive
ではないため既存の2つの発火点（`completionSeq` の変化・ウィンドウの `focus` イベント）では
拾えない「ウィンドウは既にフォーカスされたまま、利用者が pane を切り替えて表示する」という
遷移を、`TerminalPane.vue` の `onMounted`（pane が実際に画面へマウントされる、まさにその
瞬間）に同じ `shouldMarkSeen` の判定を1行足すことで拾う。

## 設計方針

- **`shouldMarkSeen`（既存・単体テスト済み。F3）をそのまま使う**: `store/seen.ts` の
  純関数を書き換えず、呼び出し側（`main.ts`・新規に `TerminalPane.vue`）を直すだけにする。
  ロジックを新設しない。
- **`main.ts` の掃引ループは `store/seen.ts` に切り出し、`sweepMarkSeen` として単体テスト
  可能にする**（`main.ts` は export を1つも持たない副作用専用のエントリポイントで
  `main.test.ts` が存在せず、この work が直す `markVisibleAgentsSeen` の不具合そのものが
  「不具合を直す」規約（`.aidev/conventions/regression-negative-control.md`）の対象なので、
  main.ts に留めたままでは負の確認ができる回帰テストを書けない）。`TerminalPane.vue`
  （自分自身が今まさにマウントされた、という1 pane 分の通知）は「対象の集合」が根本的に
  違う（全 pane の掃引 vs 自分1つ）うえ、`TerminalPane.test.ts` という既存のテスト基盤が
  あるため、`sweepMarkSeen` を無理に1 pane 用にも使い回さず、`shouldMarkSeen(...)` →
  `seen.markSeen(...)` という2行をそのまま書く（過剰な共通化はしない）。
- **`TerminalPane.vue` の `onMounted` では `paneVisible` を自明に `true` とする**:
  `onMounted` 自身が「このコンポーネントが今マウントされた」＝「この pane が今画面に出た」
  という事実そのものなので、`registry.isVisible(props.paneId)` を呼んで確かめ直す必要が
  ない（呼んでも同じ `true` が返るだけ——`isVisible` は `onMounted`/`onBeforeUnmount` が
  出し入れする `Set` を見るだけなので、F2〔`isVisible` の契約〕と F6〔`onMounted` が
  `registry.acquire` を呼ぶ既存の事実〕から導ける）。
- **`main.ts` 側の掃引（`markVisibleAgentsSeen`）は `nextTick()` の後で `isVisible` を読む**:
  `TerminalRegistry.ts` 自身のドキュメントコメント（研究F2）が「読む側は `await nextTick()`
  の後に呼ぶ」と明記しているため、`completionSeq` の変化・`focus` イベントのどちらの発火点
  でも、この契約どおり `nextTick()` を挟んでから `registry.isVisible` を読む（既存の2つの
  発火点自体〔`watch` の対象・`focus` イベント〕は変えない——読むタイミングだけ1段遅らせる）。
- **`main.ts`・`TerminalPane.vue` の間で新しい import 関係は作らない**: `main.ts` は
  export を1つも持たない副作用専用のエントリポイント（研究F5）で、他のモジュールから
  import されることを想定していない。`TerminalPane.vue` は `store/seen.ts`
  （`shouldMarkSeen`・`useSeenStore`）を直接 import する——`main.ts` を経由しない。

## 対象範囲

- `packages/web/src/store/seen.ts`: 新規のテスト可能な純関数 `sweepMarkSeen` を追加する
  （`shouldMarkSeen`・`markSeen` 自体は無改修——それらを呼ぶだけの薄い掃引ロジック）。
- `packages/web/src/main.ts`: `markVisibleAgentsSeen` の本体を `sweepMarkSeen` の呼び出しに
  差し替える。`nextTick`（`vue`）・`sweepMarkSeen`（`store/seen.js`）の import を追加。
- `packages/web/src/components/TerminalPane.vue`: `onMounted` に、マウントした pane の
  エージェントが既読条件を満たせば `seen.markSeen` を呼ぶ2文を追加。`shouldMarkSeen`・
  `useSeenStore` の import を追加。
- 変更しない: `packages/web/src/store/seen.ts` の既存の輸出（`shouldMarkSeen`・`markSeen`・
  `displayStateFor`・`aggregate`・`STATE_PRIORITY`）・
  `packages/web/src/term/TerminalRegistry.ts`（`isVisible`・`acquire`/`release` は無改修）・
  `packages/web/src/notify/NotificationController.ts`（既に正しい。この work が参考にする
  precedent のまま）。

## 依拠する既存の事実

- **F1（現状のバグの実体）**: `main.ts:288-293` の `markVisibleAgentsSeen` は
  `document.hasFocus()` だけを見て、`session.panes.values()` の**全件**を既読にする
  （コード直上のコメント「意図的な簡略化」——`markSeen` が冪等だから「対象を広げても実害は
  無い」としているが、これが `displayStateFor` の `done` 判定を常に不成立にする実害を
  生んでいる）。発火点は `completionSeq` の変化を見る `watch`（`main.ts:294`）と
  `window.addEventListener("focus", ...)`（`main.ts:295`）の2つ。
- **F2（`isVisible` の契約）**: `TerminalRegistry.ts:114-126` の `isVisible(paneId)` は
  `TerminalPane.vue` の `onMounted`/`onBeforeUnmount` だけが出し入れする `Set<string>`
  （`visible`）を見る——「`TerminalPane` が DOM にマウントされている」と同義（zoom・
  モバイル単画面・切り離しでも正しく出る、とドキュメントに明記）。ただし**この `Set` は
  Vue の reactive ではなく `watch` できない**——「知らせる直前に pull で読むこと」
  「読む側は `await nextTick()` の後に呼ぶ（mount/unmount のフックは Vue のパッチ後に走る
  ので、途中で読むと tab の切り替え中に空を拾う）」と明記されている。
- **F3（`shouldMarkSeen` の実体）**: `store/seen.ts:76-82` の
  `shouldMarkSeen(paneVisible: boolean, windowFocused: boolean): boolean { return
  paneVisible && windowFocused; }`。単体テスト（`seen.test.ts`）以外からの参照は無い
  （grep で確認済み）。
- **F4（`isPaneVisible`/`hasFocus` の既存 precedent）**: `main.ts:211-215` の
  `NotificationController` 構築で、既に `isPaneVisible: (paneId) => registry.isVisible
  (paneId)` を渡している——「`registry.isVisible` を可視性の入力として使う」という配線は
  この work が初めてではなく、既に確立したパターン。
- **F5（`main.ts` は export を持たない）**: `packages/web/src/main.ts` に `export` は
  1つも無い（grep で確認済み）——アプリの起動時に副作用を実行するエントリポイントで、
  他のモジュールから import されることを想定していない（`main.test.ts` も存在しない）。
- **F6（`TerminalPane.vue` の `onMounted` の現状）**: `TerminalPane.vue:39-45` は、
  冒頭（40行目）で `if (failed.value) return;`（復元できなかった pane はここで打ち切る）
  してから `registry.acquire(props.paneId)` を呼んで要素を差し込み、`syncTabStop()`・
  フォーカスの当て直しを行う。`session`（`useSessionStore()`）・`view`（`useViewStore()`）
  は既にこのファイルで import・使用済み。`pane`（`computed(() => session.panes.get
  (props.paneId))`）から `pane.value?.agent` で該当 pane のエージェントを引ける
  （`TerminalPane.vue:21`）。

## インターフェース / データ構造

### `store/seen.ts`（新規追加。無改修の `shouldMarkSeen`/`markSeen` を呼ぶだけの薄い掃引）

```ts
import type { AgentInfo, DisplayState, Pane } from "@wtm/protocol"; // Pane を追加

/**
 * session 内の pane を掃引し、`shouldMarkSeen` を満たすものだけ既読を進める
 * （20260925-seen-semantics-fix。design「設計方針」）。`main.ts`（export を持たず単体テスト
 * できないエントリポイント）から独立してテストできるよう、ここへ切り出した。
 */
export function sweepMarkSeen(
  panes: Iterable<Pick<Pane, "id" | "agent">>,
  isVisible: (paneId: string) => boolean,
  windowFocused: boolean,
  markSeen: (instanceId: string, seq: number) => void,
): void {
  for (const pane of panes) {
    if (pane.agent && shouldMarkSeen(isVisible(pane.id), windowFocused)) {
      markSeen(pane.agent.instanceId, pane.agent.completionSeq);
    }
  }
}
```

### `main.ts`

```ts
import { nextTick, createApp, watch } from "vue"; // nextTick を追加
import { sweepMarkSeen, useSeenStore } from "./store/seen.js"; // sweepMarkSeen を追加

// 既読の送出。pane ごとに「実際に表示されているか」×「ウィンドウにフォーカスがあるか」を見る
// （20260925-seen-semantics-fix。design「設計方針」）。isVisible は reactive ではないため、
// nextTick() の後に読む（TerminalRegistry.ts のドキュメントコメントの契約どおり）。
function markVisibleAgentsSeen(): void {
  void nextTick(() => {
    sweepMarkSeen(session.panes.values(), (paneId) => registry.isVisible(paneId), document.hasFocus(), seen.markSeen);
  });
}
watch(() => [...session.panes.values()].map((p) => p.agent?.completionSeq ?? -1), markVisibleAgentsSeen, { deep: true });
window.addEventListener("focus", markVisibleAgentsSeen);
```

### `TerminalPane.vue`

```ts
import { shouldMarkSeen, useSeenStore } from "../store/seen.js";
// ...
const seen = useSeenStore();

onMounted(() => {
  if (failed.value) return;
  entry = registry.acquire(props.paneId);
  mountPoint.value?.appendChild(entry.element);
  syncTabStop();
  if (view.focusedPaneId === props.paneId) entry.term.focus();
  // 20260925-seen-semantics-fix：この pane が今まさに表示された、という事実そのものなので
  // paneVisible は自明に true（design「設計方針」）。ウィンドウが既にフォーカスされたまま
  // 表示に切り替わった遷移を拾う——main.ts の2つの発火点（completionSeq の変化・window の
  // focus）だけでは拾えなかった（isVisible が非 reactive なため）。
  const agent = pane.value?.agent;
  if (agent && shouldMarkSeen(true, document.hasFocus())) seen.markSeen(agent.instanceId, agent.completionSeq);
});
```

## 振る舞いの詳細

1. **非表示 pane の完了（AC1）**: `completionSeq` が変わり `markVisibleAgentsSeen` が発火 →
   `nextTick()` の後、対象 pane で `registry.isVisible(pane.id)` が `false` →
   `shouldMarkSeen(false, ...)` が `false` → `markSeen` を呼ばない → `seenSeq` は古いまま →
   `displayStateFor` が `completionSeq > seenSeq` を満たし `"done"` を返す。
2. **表示中 pane の完了（AC2）**: 同じ発火点で、対象 pane が表示中なら
   `registry.isVisible` が `true`・`windowFocused` も `true` なら `shouldMarkSeen` が
   `true` → `markSeen` が呼ばれ `seenSeq` が進む → `displayStateFor` は `"idle"`
   （既読済み）を返す。
3. **非表示だった pane を後から表示（AC3）**: 利用者が tab/pane を切り替える →
   `TerminalPane.vue` が新しくマウントされる（`view.setView`/`focusPane` 等、既存の
   view 切替経路。この work では触らない）→ `onMounted` が発火 →
   `shouldMarkSeen(true, document.hasFocus())` → `windowFocused` が `true` なら
   `markSeen` を呼ぶ。
4. **ウィンドウがフォーカスを取り戻す（AC4）**: `focus` イベント → `markVisibleAgentsSeen` →
   `nextTick()` の後、session の全 pane を回るが、`registry.isVisible` が `true` の
   pane だけが `markSeen` の対象になる（非表示の pane は対象外のまま——挙動の変更点）。

## ドメイン固有の考慮

- 該当なし（PJ 固有の論点に直接紐づく判断はない。既存の `isVisible`/`shouldMarkSeen`
  という確立済みの部品を正しく配線するだけの work）。

## エラー処理 / 異常系

- `pane.agent` が `null`（エージェントが動いていない pane）: 両方の呼び出し箇所とも
  既存どおり `if (agent)`/`if (pane.agent)` でガードし、既読の対象にしない（既存の挙動を
  維持）。
- `TerminalPane.vue` の `failed.value`（復元できなかった pane）: `onMounted` の先頭で
  早期 return するため（既存のコード。研究F6）、既読の判定コードにも到達しない——
  エージェントは元々存在しないので実害なし。

## 受け入れ基準との対応

- AC1: 「振る舞いの詳細」手順1。
- AC2: 「振る舞いの詳細」手順2。
- AC3: 「振る舞いの詳細」手順3。
- AC4: 「振る舞いの詳細」手順4。
