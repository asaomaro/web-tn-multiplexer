# 仕様: エージェントの「入力待ち」「完了」を、画面を見ていなくても知らせる

## 概要

`requirements.md` の 22 の受け入れ基準を、**web パッケージだけ**の変更で満たす
（protocol・server は変更しない。research「影響範囲」）。

構造は 4 層に分ける。**「いつ知らせるか」と「どう知らせるか」を分ける**のが要点——
前者は純粋な判定に寄せてテストしやすくし、後者はブラウザ API に触るので port の裏へ隠す。

1. **検知**（`StoreAdapter`）: サーバのイベント／スナップショットから「知らせるべき出来事」を取り出す。
2. **判定**（`notify/policy.ts`・純粋関数）: 利用者の状態と設定から、**どの経路を使うか**を決める。
3. **実行**（`notify/NotificationController.ts`）: 遅延・待ち行列・port の呼び出し。
4. **配送**（`notify/ports.ts` と実装）: OS 通知と音。**ブラウザ API はここにだけ置く**。

状態（設定・待ち行列・**判定済み**・案内・`desktopUsable` / `soundBlocked`）は
`store/notifications.ts`（Pinia）に置く。

## 設計方針

**この製品の既存の流儀に合わせることを優先する**。新しい仕組みを作るのは、既存に無いもの
（待ち行列・OS 通知・音）に限る。

- ダイアログは `ConfirmDialog` と同じ形（ネイティブ `<dialog>` ＋ `showModal()` ＋ `@cancel` の抑止）。
- トーストは**既存の `Toast` を拡張**する（別の入れ物を作らない。research F26）。
- 設定は既存の `wtm.prefs.v1` に**併合式で**足す（research F30）。
  **キーの所有者は `store/view.ts`**——そこに `readPrefs(): Record<string, unknown>` と
  `writePrefs(patch: Record<string, unknown>)`（読んで併合して書く）を置き、
  **`agentSort` も通知の設定も同じ 2 つを通す**。2 つのストアが同じキーを別々に
  read-modify-write すると、どちらかが消える（AC6 が壊れる）。
  `writePrefs` は**読みも書きも同じ try/catch の内側**に入れる（research F33）。
- 「その pane へ移る」は既存の 3 手（`setView` → `focusPane` → `*.focus`）に従う（research F40）。

### 退けた代替案

- **ストアの watch で変化を見る**: `applySnapshot` と `applyEvent` を区別できない（research F10）ので、
  再接続のたびに一斉に出る（AC14 が満たせない）。**`StoreAdapter` に挿す**。
- **`displayStateFor` / 既読（`wtm.seen.v1`）を使う**: フォーカス中は `done` が成立しない
  （requirements「既存の実装で…」）。**判定済みを別に持つ**。
- **描画規則をストアから再現して「見ている pane」を求める**（research F8）: `PaneLayout` の規則が
  変わったときに黙ってずれる。**`TerminalRegistry` に読み出し口を足す**（唯一の正典を保つ）。
- **音源ファイルを同梱**: ライセンス・容量に加え、**鳴らせたかどうかを判定しにくい**。
  `OscillatorNode` なら `AudioContext.state` で判定でき、AC13 に直結する（research F86）。
- **`<input type="checkbox">`**: この製品の流儀から最も遠い（research F91）。

## 対象範囲

### 新規

| ファイル | 役割 |
|---|---|
| `packages/web/src/store/notifications.ts` | 設定・待ち行列・判定済み・案内・環境の可否（Pinia） |
| `packages/web/src/notify/policy.ts` | **純粋関数**。どの経路を使うか・待ち行列の操作 |
| `packages/web/src/notify/describe.ts` | **純粋関数**。対象の呼び名の組み立て |
| `packages/web/src/notify/ports.ts` | `DesktopNotifierPort` / `SoundPort` の型 |
| `packages/web/src/notify/DesktopNotifier.ts` | Notification API の実装 |
| `packages/web/src/notify/ToneSound.ts` | `AudioContext` + `OscillatorNode` の実装 |
| `packages/web/src/notify/NotificationController.ts` | 遅延・配送の結線 |
| `packages/web/src/components/NotificationSettingsDialog.vue` | 設定ダイアログ |

### 変更

| ファイル | 変更 |
|---|---|
| `packages/web/src/term/TerminalRegistry.ts` | `isVisible(paneId)` / `visiblePaneIds()` を公開 |
| `packages/web/src/store/StoreAdapter.ts` | `onAgentChanged` / `onSnapshotApplied` / `onPaneClosed` を足す |
| `packages/web/src/store/view.ts` | prefs を併合式に、`Toast` に種別、`DialogContext` に 1 種 |
| `packages/web/src/components/Toast.vue` | 種別で自動消去を分岐、行動ボタン、コンパクト表示、高さ上限 |
| `packages/web/src/components/ContextMenu.vue` | global に「通知の設定」＋ `:88-89` のコメント |
| `packages/web/src/mobile/MobileShell.vue` | 上部バーに 4 つ目のボタン |
| `packages/web/src/keys/keymap.ts` `keys/actions.ts` | `prefix+s` `prefix+o` を差し替え |
| `packages/web/src/actions/ActionDispatcher.ts` | 2 つの入口と「次の知らせへ移る」 |
| `packages/web/src/components/HelpDialog.vue` | `s` `o` の行（research F38。直さないと壊れた表示） |
| `packages/web/src/App.vue` | **`NotificationSettingsDialog` を置く**（既存のダイアログと同じ `:67-76`。モバイル分岐の外） |
| `packages/web/src/main.ts` | `NotificationController` の組み立てと結線 |
| `docs/herdr-parity.md` | H29 の行（`:51`） |

## 依拠する既存の事実

`research.md` の F 番号で示す（すべて `file:line` 付きで確認済み）。

- 表示中 pane は `TerminalRegistry.visible`（`term/TerminalRegistry.ts:61`）に**既にある**が private（F1）。
  出入りは `TerminalPane` の mount/unmount のみ（F2）。zoom・モバイル・detached でも正しい（F3・F4・F5）。
  **reactive ではない**ので pull で読む（F7）。
- スナップショットとイベントを区別できるのは `StoreAdapter` だけ（F10。`store/StoreAdapter.ts:29` `:40`）。
- 前の値は `session.paneAgentStatusChanged` を呼ぶ**直前**にしか取れない（F12・F13。`:91-93`）。
  **サーバが `pane.agent_status_changed` を `pane.updated` より先に出す**ことに依存する
  （`packages/server/src/session/SessionService.ts:361-366`）。
- **`since` はクライアント再接続で変わらない**（F15。`packages/server/src/agent/AgentTracker.ts:111`）。
  サーバ再起動では `instanceId` ごと新しくなる（エージェントの状態は `SessionFile` に永続化されていない）。
- 既存トーストの自動消去は `Toast.vue:41-50`、型は `{ id, message }`（F24・F25）。
  トーストは `<div>` で **Tab の順に入らない**（F27）。下から上へ縦積み（F28）。
- `<dialog>.showModal()` は top layer なのでトーストより上（F29）。
- prefs の保存は全置換（F30）。`store/view.test.ts:42-52` は `getItem` だけを throw させる（F33）。
- `HelpDialog` は keymap と機械的に同期していない（F38）。差し替えで
  `keys/KeyRouter.test.ts:135-138` と `components/HelpDialog.test.ts:39` が落ちる（F39）。
- 「その pane へ移る」の形は 5 ファイルに重複、共通関数は無い（F41）。逆引きの先例は `GotoPicker.vue:151-158`（F42）。
- E2E に `addInitScript` の先例が 1 つある（F47。`performance.spec.ts:100-126`）。`localStorage` の
  事前設定の仕組みは無い（F49）。`notifications` 権限を付けている箇所も無い（F53）。
- **未確認**（知識のみ。research F72〜F94）: Notification API の作法・自動再生ポリシー・APG・通知の慣習。
  **実機での確認は test 工程と利用者の実機確認に送る**。

## インターフェース / データ構造

### 知らせる出来事と、その鍵

```ts
/** 知らせる出来事の種類。文言・音・OS 通知のタイトルがこれで分かれる（AC2）。 */
export type NotifyKind = "blocked" | "done";

/**
 * 「同じ出来事か」を識別する鍵（AC14）。**クライアントの再接続では変わらない**——
 * `since` はサーバの `AgentTracker` が状態の変わった時刻として保持する（research F15）。
 * サーバ再起動では `instanceId` ごと新しくなるので、別の出来事として扱われる（正しい）。
 */
export type NotifyKey = string; // `blocked:<instanceId>:<since>` / `done:<instanceId>:<completionSeq>`

export function notifyKeyOf(kind: NotifyKind, agent: AgentInfo): NotifyKey;
```

### 待ち行列の 1 件

```ts
export interface QueuedNotification {
  key: NotifyKey;
  kind: NotifyKind;
  paneId: string;
  /** 出来事が起きた時点の表示名（pane・tab・workspace）。**後から引き直さない**——
   *  対象が閉じられても、何の知らせだったかは読めるべき（AC11 で「もうありません」と出すときに要る）。 */
  label: string;
  at: number;
  /** 対応するトーストの id（`view.toasts`）。**トーストを「切」にしていれば `null`**
   *  （待ち行列に入る条件はトーストの入／切とは独立。振る舞い 4）。 */
  toastId: number | null;
}
```

### 設定

```ts
export interface NotifyPrefs {
  toast: boolean;   // 既定 true
  desktop: boolean; // 既定 false（許可が要る。AC7）
  sound: boolean;   // 既定 false
}
```

`wtm.prefs.v1` に `{ agentSort, notify: NotifyPrefs, notifyHintDone: boolean, notifyHintPending: boolean }`
として**併合で**保存する。

### 判定（純粋関数）

```ts
/** 利用者の状態（AC3 の表の行を決める 2 つの軸）。 */
export interface Audience {
  windowFocused: boolean;
  paneVisible: boolean;
}

export interface Routes { toast: boolean; desktop: boolean; sound: boolean }

/**
 * requirements「知らせ方と、その使い分け」の表を、そのまま 1 つの関数にする。
 * - フォーカス無し      → 3 つとも（設定で入のものだけ）
 * - フォーカス有り・非表示 → トーストだけ
 * - 見ている            → 何も出さない
 */
export function routesFor(a: Audience, prefs: NotifyPrefs): Routes;
```

### port（ブラウザ API はここにだけ）

```ts
export type DesktopPermission = "default" | "granted" | "denied" | "unsupported";

export interface DesktopNotifierPort {
  /** `Notification` が無い／非セキュアな文脈なら `"unsupported"`（AC12）。 */
  permission(): DesktopPermission;
  /** **利用者の操作からのみ呼ぶ**（AC7。research F73）。 */
  request(): Promise<DesktopPermission>;
  /** `tag` は pane id。同じ pane の通知は置き換わる（research F74）。
   *  **構築に失敗したら `false` を返す**——Android Chrome は `new Notification()` を拒む（research F78）。 */
  show(o: { title: string; body: string; tag: string; onClick: () => void }): boolean;
  closeByTag(tag: string): void;
}

export type SoundResult = "played" | "blocked" | "unsupported";

export interface SoundPort {
  /** 自動再生に阻まれたら `"blocked"`（AC13。research F81・F82）。 */
  play(kind: NotifyKind): SoundResult;
  /** 利用者の操作から呼んで `AudioContext` を `running` にする。 */
  unlock(): void;
}
```

### トーストの拡張

```ts
export interface Toast {
  id: number;
  message: string;
  /** 既定（`undefined`）は今までどおり 4 秒で消える。`"sticky"` は消えない（requirements）。 */
  kind?: "sticky";
  /** 行動ボタン。`sticky` のときだけ置く。**トースト本体のクリックは今までどおり「消す」**なので、
   *  ボタン側で `@click.stop` する（research F27 の当たり判定）。 */
  actions?: { label: string; run: () => void }[];
}
```

## 振る舞いの詳細

### 1. 検知（`StoreAdapter`）

`StoreAdapterOptions` に 2 つ足す（既存の `onPaneExited` / `onClientError` と同じ、省略可の注入）。

```ts
/** `next` は `null` を取りうる（`PaneAgentStatusChangedEvent.data.agent` が `AgentInfo | null`。
 *  `packages/protocol/src/events.ts:52-53`）。`prev` は Map 引きなので `undefined` も来る——
 *  **呼ぶ側で `?? null` に正規化する**。 */
onAgentChanged?: (paneId: string, prev: AgentInfo | null, next: AgentInfo | null) => void;
onSnapshotApplied?: (panes: { paneId: string; agent: AgentInfo | null }[], first: boolean) => void;
/** **待ち行列の掃除に要る**（振る舞い 5）。`pane.exited` とは別のイベントなので
 *  既存の `onPaneExited` では代用できない（`store/StoreAdapter.ts:88-89`）。 */
onPaneClosed?: (paneId: string) => void;
```

- `applyEventToSession` の `case "pane.agent_status_changed"`（`:91-93`）で、
  **`session.paneAgentStatusChanged` を呼ぶ前に** `session.panes.get(paneId)?.agent` を読み、
  更新した**後**に `onAgentChanged(paneId, prev, next)` を呼ぶ。
  **この順序はサーバが `pane.agent_status_changed` を `pane.updated` より先に出すことに依存する**
  （コメントで明記する）。
- `applySnapshot` で `onSnapshotApplied(全 pane の agent, first)` を呼ぶ。
  **`first` は `StoreAdapter` が自分で持つ**（`#seenFirstSnapshot`）——`session.clientId` の有無では
  判定できない（再接続でも埋まる。research 申し送り 2）。

### 2. 出来事の取り出し

**「判定済み」の集合（`judged: Set<NotifyKey>`）を 1 つ持つ**。名前は「知らせ済み」ではなく
**「判定済み」**——**出さないと決めた場合も入れる**（下記）。入れないと、
「見ていたから出さなかった」出来事が**再接続のスナップショットで後から一斉に出る**（AC14 が壊れる）。

- **イベント経路**（`next` は `null` を取りうる）:
  - `next?.state === "blocked" && prev?.state !== "blocked"` → `blocked` の候補。
  - `next != null && prev != null && next.completionSeq > prev.completionSeq` → `done` の候補。
    **初めて見る pane（`prev == null`）では `done` を出さない**——前の値が無いので「前進した」と言えない
    （`AgentInfo.completionSeq` は省略不可の `number`。`packages/protocol/src/model.ts:76`）。
- **スナップショット経路**: 各 pane の現在の `agent` から `blocked` と `done` の**両方**の鍵を作る。
  **`done` もスナップショットから判定できる**——鍵が `done:<instanceId>:<completionSeq>` なので、
  **`judged` に無い ＝ 前回見たときより `completionSeq` が進んだ**と分かる（差分を自分で持っている）。
  - **`first === true`** → 何も出さず、**作った鍵をすべて `judged` に入れる**（＝基準線。AC14 前半）。
  - **`first === false`** → **`judged` に無い鍵を `blocked` も `done` も知らせる**
    （AC14 後半）。これで**切断中に入力待ちになったものも、切断中に完了したものも取りこぼさない**
    ——`Connection` は自動で繋ぎ直す（`net/Connection.ts:401-403`）ので瞬断は実際に起きる（US2）。
  - ただし **`agent == null` の pane からは鍵を作らない**。

**`judged` に入れるのは「その鍵の面倒を見ると決めた時点」**——具体的には
**遅延を仕掛けた時点（`blocked` の 1000ms を `setTimeout` した瞬間）** と
**遅延の無い `done` の判定直後**。**発火を待ってから入れてはいけない**——
その 1 秒の間に再接続のスナップショットが来ると、**同じ鍵で 2 本目の保留が立ち、
音と OS 通知が二重に出る**（待ち行列は同 pane の置き換えで 1 件に収束するが、配送は 2 回走る）。

3 経路とも偽（表の (c) 見ている）でも入れる。**入れ忘れると再接続で一斉に出る**ので、
**判定と記録を 1 つの関数にまとめる**（`policy.ts` の `decide()` が `{ routes, key }` を返し、
呼ぶ側が**必ず** `judged.add(paneId, key)` してから遅延／配送へ進む）。

**`judged` の掃除は件数の上限ではなく、pane の寿命で行う**——**`onPaneClosed(paneId)` で
その pane の鍵を捨てる**。件数の LRU にすると、**長く `blocked` のままの鍵ほど古い側に落ちて
押し出され、再接続のスナップショットで再通知される**（AC1「状態が続いている間は繰り返さない」が壊れる）。
そのため `judged` は `Map<paneId, Set<NotifyKey>>` で持つ。

### 3. 遅延と揺れ（AC4）

- `blocked` は **1000ms 待ってから**、`session.panes.get(paneId)?.agent` を**もう一度見て**
  まだ同じ鍵（`instanceId + since` が一致）なら知らせる。違えば捨てる。
  これは herdr の「保留 → 発火時に再確認」（research F68）を単純化したもの。
- `done` は**揺れの待ちはしない**。**サーバ側に既に保留がある**（`AgentTracker` の working→idle 700ms×3）。
- **ただし利用者の状態を読むのは、必ず `await nextTick()` の後**（`queueMicrotask` ではない）。
  `visible` は `TerminalPane` の `onMounted`/`onBeforeUnmount` に連動し（`components/TerminalPane.vue:39-52`）、
  そのフックは **Vue のパッチ後（post-flush）** に走る。`PaneLayout.vue:178` は `:key="singlePaneId"` で
  unmount＋mount を同じパッチに載せるので、**途中で読むと `visible` が空になりうる**。
  `nextTick()` は「DOM とフックが確定した後」を意味するので、これを指定する。
- **スナップショット経路（`first === false`）も同じ扱い**——`applySnapshot` は panes の Map を
  丸ごと作り直す（`store/session.ts:28`）ので**再描画が走り、`visible` が最も揺れる瞬間**。
  `await nextTick()` の後に利用者の状態を読む。**`blocked` の 1000ms の待ちはこの経路でも通す**
  （再接続直後は状態が落ち着いていないため）。

### 4. 経路の決定と配送

```
routes = routesFor({ windowFocused: document.hasFocus(),
                     paneVisible: registry.isVisible(paneId) }, prefs)
```

- `routes.toast` → `view.toast(message, { kind: "sticky" })` し、**待ち行列に 1 件積む**（1 対 1）。
- `routes.desktop` → `permission() === "granted"` のときだけ `show(...)`。
  **`show` が `false` を返したら**（Android Chrome。research F78）`desktopUsable = false` を立て、
  設定に「この環境では使えません」を出す（AC12 の経路と共通化）。
- `routes.sound` → `play(kind)`。`"blocked"` が返ったら `soundBlocked = true` を立てる（AC13）。

**`desktopUsable`（既定 true）と `soundBlocked`（既定 false）は `store/notifications.ts` に置く**
（概要の「状態」に含める）。**下ろす条件**は、`desktopUsable` は下ろさない（環境の性質なので
その画面の間は変わらない）、`soundBlocked` は**次に `play()` が `"played"` を返したときに下ろす**
（解除されたら表示も消える）。

**`closeByTag(paneId)` は `drop(key)` の中から呼ぶ**（振る舞い 5）——`prefix+o` で移ったとき・
トーストを消したとき・pane が閉じたときに、**OS 通知も一緒に消える**
（research F75 の「`window.focus()` の後に `close()`」の作法もここで満たす）。

**`unlock()` は 2 箇所から呼ぶ**: 案内の［許可する］（振る舞い 7）と、
**設定ダイアログで音の切り替えを「入」にしたとき**——どちらも利用者の操作なので、
そこで `AudioContext` を `running` にしておけば、以後その画面では鳴る（research F82・F83）。

**待ち行列に積むのは「表の (c)（その pane を見ている）ではないとき」**——
**`routes.toast` が真のときだけ、ではない**。トーストを「切」にして OS 通知だけ「入」にした利用者では
`routes.toast` が常に偽になり、**待ち行列が空のままで `prefix+o` も OS 通知のクリックも効かなくなる**
（AC10・AC11・AC15 が壊れる）。requirements が「トーストと 1 対 1」と書いているのは**行の話**
（(a) と (b) は入り (c) は入らない）で、経路の入／切とは独立。

**したがって「トーストの無い待ち行列の件」がありうる**。`QueuedNotification.toastId` は
**`number | null`** とし、`drop` は `toastId != null` のときだけ `dismissToast` を呼ぶ。

#### 文言（AC2・requirements の機能要件）

**対象の呼び名**は `describeTarget(session, paneId)` で組み立てる（`notify/describe.ts`・純粋関数）。

**`AgentInfo.label` は使えない**——あれはエージェントの**種類名**で
（`packages/server/src/agent/agents.ts:22` の `{ kind: "claude", label: "Claude Code" }`）、
**同じ tab で 2 つの Claude Code を回すと文言が完全に同じになる**。
requirements の機能要件は「**どの workspace のどの pane か**」を求めている。

**既存の呼び名の流儀に従う**（`packages/web/src/components/GotoPicker.vue:78`）:

```ts
// `title` は未設定なら空文字なので `??` ではなく `||` で繋ぐ（GotoPicker のコメントどおり）
const paneName = pane.label || pane.agent?.label || pane.title || `pane ${paneId}`;
target = `${paneName}（${workspaceLabel} / ${tabLabel}）`;
```

**引けないときの落とし方**（`GotoPicker.vue:151-158` は workspace を引いておらず手本にならない）:

| 引けないもの | 戻り値 |
|---|---|
| pane が無い | `"（閉じられた pane）"` |
| tab が無い | pane 名だけ（`` `${paneName}` ``） |
| workspace が無い | `` `${paneName}（${tabLabel}）` `` |

**`describeTarget` は出来事が起きた時点で 1 度だけ呼び、結果を `QueuedNotification.label` に入れる**
——後から引き直さない（対象が閉じられても何の知らせだったかは読める）。

| 経路 | `blocked`（入力待ち） | `done`（完了） |
|---|---|---|
| トースト | `${target} が入力待ちです` | `${target} が完了しました` |
| OS 通知 title | `入力待ち: ${paneName}` | `完了: ${paneName}` |
| OS 通知 body | `${workspaceLabel} / ${tabLabel}` | 同左 |
| 音 | 高い 2 音（上がる） | 低い 2 音（下がる） |

`QueuedNotification.label` には組み立て済みの `target` を入れ、**後から引き直さない**
（対象が閉じられても何の知らせだったかは読める）。

### 5. 待ち行列の規則（`notify/policy.ts` の純粋関数）

herdr から移植できるのは 3 つの規則だけ（research F55・F59。**構造は違う**ので移植ではなく再設計）。

- **同じ pane の古いものは消してから新しいものを末尾に積む**（herdr `:119-132`）。
  消した分のトーストも消す。
- **9 件目で最も古いものを捨てる**（herdr `:50-53` の `pop_front`）。そのトーストも消す。
- **pane が閉じたら、その pane の件を捨てる**（herdr の `retire_endpoint_notifications`。research F61）。
  `StoreAdapter` の `case "pane.closed"` に結線する。
- **利用者がトーストを消したら、対応する 1 件も消す**。

**1 対 1 を保つために、出入りを 2 本に限定する**（素朴に watch すると再入する）。

- **待ち行列から消す側**は必ず `drop(key)` を通る——`drop` は (1) 待ち行列から外し、
  (2) **まだ残っていれば** `view.dismissToast(toastId)` を呼び、(3) `desktop.closeByTag(paneId)` を呼ぶ。
  置き換え・上限超過・pane 閉鎖・`prefix+o`・OS 通知のクリックは**すべて `drop` を経由する**。
- **利用者が消した側**は `view.toasts` の id 一覧の watch で拾う——**待ち行列にあるのに
  トーストが消えている件を外し、`desktop.closeByTag(paneId)` を呼ぶ**。
  **`dismissToast` は呼ばない**（既に消えている）ので**再入しない**
  （`drop` → `dismissToast` → watch → 既に待ち行列に無い → 何もしない）。
  **`closeByTag` は両方の経路から呼ぶ**——`drop` からだけにすると、
  **利用者がトーストを消しても OS 通知が残る**。
- `sticky` は自動消去のタイマーに掛からない（`Toast.vue:47` の分岐）ので、**この watch が唯一の観測点**。

### 6. `prefix+o`（AC10・AC11）

**移動の本体は `focusEntry(key)` の 1 つ**にし、`prefix+o`（先頭）と
**OS 通知のクリック（その 1 件）**の両方がこれを呼ぶ。

```ts
/** 指定の 1 件へ移る。対象が消えていれば false を返す（呼ぶ側が次を試す）。 */
function focusEntry(key: NotifyKey): boolean;
```

**`prefix+o`**:

1. 待ち行列が空 → `view.toast("未処理の知らせはありません。")`（**既存の 4 秒のトースト**。
   通知の 3 経路の入／切とは無関係に必ず出す。requirements）。
2. **先頭から順に試す**——対象が消えている件は `drop(key)` で捨てて次へ進む（**その場で続ける**）。
   最初に到達できた 1 件へ移り、その件を `drop` して終わる。
3. **全部消えていた場合**は「知らせの対象はすでに閉じられています。」を**1 回だけ**出して終わる
   （捨てた件数ぶん繰り返さない）。
   **herdr は消費せず留める**（research F58）が、**この製品のトーストは自動で消えない**ので、
   留めると待ち行列が永久に詰まる。**意図的に逆の判断**（decisions に残す）。

**OS 通知のクリック（AC15）**: `show()` に渡す `onClick` が**その通知の `key` を閉じ込める**。
`window.focus()` → `focusEntry(key)` → `drop(key)`。
**先頭ではなくクリックされた 1 件を消費する**——OS 通知は `tag = pane id` で pane ごとに
複数同時に出るので、先頭を消費すると**別の pane へ飛ぶ**。対象が消えていれば
「知らせの対象はすでに閉じられています。」を出して `drop` だけする。

### 7. 案内（AC5・US8）

- **最初の出来事を「判定した」とき** `hintPending = true` を立てる（**その場では出さない**）。
  **経路が 3 つとも偽でも立てる**——利用者が全部「切」にしていても案内は出す
  （requirements の機能要件：案内は通知の設定の入／切とは無関係）。
  「知らせを出したとき」にすると、**全部切のとき案内が永久に出ない**。
- `hintPending` は **prefs に保存する**（`wtm.prefs.v1` の `notifyHintPending`）。
  メモリに置くと、**フォーカスが戻る前に再読み込みしたら失われて次の出来事まで出ない**。
- **出す契機は 2 つ**（`hintPending && !notifyHintDone` **かつ、案内のトーストがまだ出ていない**とき）:
  1. `window` の `focus` が発火したとき。
  2. **立てた時点で既にフォーカスがあるなら、その場で出す**——表の (b)（フォーカス有り・pane 非表示）で
     最初の出来事が起きると `focus` は発火しないので、これが無いと**離れて戻るまで出ない**。
     **これは requirements の「知らせが起きた瞬間には出さない」を上書きする**。
     要件がそう書いたのは「誰も見ていないタブに出て消費されるのを防ぐため」で、
     **既にフォーカスがある場合はその懸念が当たらない**（利用者は見ている）。
     **意図的な上書き**（decisions に残す）。
- **重ねない**: 案内のトーストの id を `hintToastId` に持ち、既に出ていれば出さない。
  持たないと、押さずに放置したまま**フォーカスのたびに 1 枚ずつ増える**（`sticky` なので消えない）。
- **利用者が案内のトーストを（ボタンではなく）本体のクリックで消した場合も消費する**
  ——`notifyHintDone = true`。消したのは「いまは要らない」という反応なので、
  次のフォーカスでまた出すのは催促になる。
- 文言:「エージェントの入力待ち・完了を、OS の通知でも受け取れますか？」
  行動ボタン **［許可する］［あとで］**。
  **この案内だけは 1 行に畳まない**（振る舞い 10 の例外）——問いかけ＋ボタン 2 つを
  `nowrap` + `ellipsis` にすると、狭い画面で本文が読めなくなる。US8 の導線そのものなので読めることを優先する。
- ［許可する］→ `sound.unlock()` ＋ `desktop.request()`（**利用者の操作なので AC7 を満たす**）、
  `granted` なら `prefs.desktop = true`。［あとで］→ 何もしない。
- **どちらを押しても `notifyHintDone = true` にし、`hintPending = false` にして
  案内のトーストを `dismissToast` で消す**（`sticky` は自動で消えないので、押した後に
  消えないトーストが残ってはいけない）。放置しただけでは消費しない。

### 8. 設定ダイアログ（AC6〜AC8・AC12・AC13・AC16・AC-I1〜I5）

- `DialogContext` に `{ kind: "notifySettings" }` を足す。開閉は `openDialogWithContext` / `closeDialog`
  （AC-I5 はこれで自動的に満たされる。research F23）。
- 形は `ConfirmDialog`（`<dialog>` ＋ `showModal()` ＋ `@cancel` を `preventDefault` ＋ `@click.self`）。
- 3 つの切り替えは **`<button role="switch" :aria-checked>`**。
  **`aria-pressed` ではなく `switch` にする理由**: APG は switch を「on/off を表し、**操作が即座に効く**もの」と
  定義しており（research F89）、AC-I2（押した時点で反映・確定ボタンを置かない）と一致する。
  既存の `aria-pressed`（`ExtraKeys` / モバイルの fit）は**道具のモード**であって設定ではない。
  **これが本製品で最初の設定面なので、ここで switch を基準にする**（decisions に残す）。
- **OS 通知の行だけ状態で見え方が変わる**:
  - `"unsupported"` または `desktopUsable === false` → 切り替えを `disabled` にし
    「この環境では使えません」（AC12。**モバイルはここに落ちる**）。
  - `"denied"` → `disabled` ＋「ブラウザで拒否されています」（AC8）。
  - `"default"` → 切り替えは押せるが、押すと `request()` を呼ぶ（AC8）。
  - `"granted"` → 普通の切り替え。
- **音の行**は `soundBlocked` のとき「この画面をまだ操作していないため鳴らせませんでした」を添える（AC13）。
- 開いたら**最初の切り替え**へ `focus()`（AC-I4 前半）。閉じたら `closeDialog` が
  **開く前の pane** へ戻す（AC-I4 後半。**既存のダイアログと同じ**＝ requirements の文言どおり。research F22）。

### 9. 入口（AC16）

- **サイドバーのメニュー**: `ContextMenu.vue` の global 分岐（`:93-97`）に「通知の設定」を、
  **「移動」と「切り離し」の間**に足す——`:89` のコメントが
  「切り離しは押し間違えると接続が切れるので最後」と定めているため。
  並びは **キー割り当て / 移動 / 通知の設定 / 切り離し**。
  `:88-89` のコメントを requirements「先行 work の判断を変える点」に合わせて直す。
- **モバイルの上部バー**: `MobileShell.vue` に 4 つ目の `flex:none` のボタン（`🔔`・`aria-label="通知の設定"`）。
- **`prefix+s`**: `NOT_YET` から外し `{ type: "notifySettings" }` に。`HelpDialog.vue:43` も直す。
- **`prefix+o`**: `NOT_YET` から外し `{ type: "nextNotification" }` に。`HelpDialog.vue:45` も直す。

### 10. トーストの見え方（research のリスク）

- **`sticky` のトーストには閉じる `<button>`（`aria-label="閉じる"`）を置く**。
  既存のトーストは `<div>` で Tab の順に入らず、消す手段は要素全体のクリックだけ（research F27）。
  4 秒で消える既存のものでは実害が無かったが、**この work のトーストは消えない**ので、
  キーボードだけの利用者が 8 枚を片付けられない（AC-I3）。`prefix+o` で 1 件ずつ消費する以外の道を残す。
- **この work のトーストは 1 行に畳む**（`white-space: nowrap; text-overflow: ellipsis`）。
  8 枚 × 約 2em では画面を覆うため（research F28）。
- **入れ物に `max-height: 40vh; overflow-y: auto`** を付ける。8 枚でも画面を占有しない。
- **設定ダイアログを開いている間はトーストが見えない**（top layer。research F29）。
  **受け入れる**——設定を閉じれば見える。知らせは待ち行列に残っている。

## ドメイン固有の考慮

- **D107**: 利用者に見せる文言はすべて日本語。サーバの生のメッセージは使わない
  （この work はサーバのエラーを扱わない）。
- **複数クライアント**: 設定も知らせ済みもブラウザごと（`wtm.prefs.v1` / メモリ）。
  同じセッションを 2 つのブラウザで開けば**両方が独立に知らせる**（requirements の非機能要件）。
- **`prefix` の遮断**: ダイアログが開いている間、`main.ts:171-176` が端末へキーを流さない（research F23）。

## エラー処理 / 異常系

| 事象 | 扱い |
|---|---|
| `Notification` が無い／非セキュアな文脈 | `permission()` が `"unsupported"`。設定に「この環境では使えません」（AC12） |
| `new Notification()` が throw（Android Chrome） | `show()` が `false`。`desktopUsable = false` を立てて同上（AC12） |
| 許可が `denied` | 切り替えを `disabled` ＋ 理由（AC8） |
| 自動再生に阻まれた | `play()` が `"blocked"`。設定に理由（AC13）。**黙って無視しない** |
| `AudioContext` が作れない | `play()` が `"unsupported"`。音の行を `disabled` |
| `localStorage` が読めない／書けない | 既存と同じく try/catch で握る（この画面の間だけ効く） |
| `prefix+o` の対象が消えている | その旨を出して**次へ進む**（herdr と逆。上記 6） |
| pane が閉じた | その pane の待ち行列とトーストを捨てる |

## 受け入れ基準との対応

- AC1: 検知（振る舞い 1・2）が `blocked` への遷移と `completionSeq` の前進だけを拾い、
  **鍵（`NotifyKey`）が知らせ済みに入っていれば出さない**ので、状態が続く間は繰り返さない。
  入力は `pane.agent_status_changed` の `prev`/`next`（`StoreAdapter`）。
- AC2: `NotifyKind` で文言・OS 通知のタイトル・音の高さが分かれる（振る舞い 4・`ToneSound`）。
- AC3: `routesFor(Audience, prefs)`（純粋関数）が requirements の表をそのまま実装する。
  入力は `document.hasFocus()` と `TerminalRegistry.isVisible(paneId)`。
- AC4: `blocked` は 1000ms 後に**鍵が一致するか再確認**してから知らせる（振る舞い 3）。
- AC5: `hintPending` を立て、**フォーカスが戻ってから** `sticky` の案内を出す。
  消費は［許可する］／［あとで］を押したとき（振る舞い 7）。`notifyHintDone` を prefs に保存。
- AC6: `NotifyPrefs` の 3 つを独立に持ち、`wtm.prefs.v1` へ**併合式で**保存する
  （既存の `agentSort` が消えない）。
- AC7: `request()` は**［許可する］と OS 通知の切り替え（`default` のとき）からのみ**呼ぶ。
  起動経路のどこからも呼ばない。
- AC8: `permission()` の 4 値で設定の見え方を分ける（振る舞い 8）。
- AC9: `policy.ts` の待ち行列が上限 8・最古を捨てる・同 pane を置き換える（振る舞い 5）。
- AC10: `prefix+o` が先頭を消費して 3 手で移る（振る舞い 6）。
- AC11: 空のとき・対象が消えたときの文言（振る舞い 6）。**既存の 4 秒のトースト**で出す。
- AC12: `"unsupported"` と `desktopUsable === false` を同じ表示に落とす（振る舞い 8・異常系）。
- AC13: `SoundResult === "blocked"` を `soundBlocked` に立て、設定に出す（振る舞い 8）。
- AC14: `onSnapshotApplied(_, first)` の 2 経路（振る舞い 2）と、再接続で変わらない `NotifyKey`
  （`instanceId + since`。research F15）。
- AC15: OS 通知の `onClick` が `window.focus()` → `prefix+o` と同じ移動（振る舞い 6 を共用）。
- AC16: 3 つの入口（振る舞い 9）。`HelpDialog` も直す。
- AC17: 既存の単体テストと E2E を通す。**落ちると分かっている 3 件**を、
  **先に落ちることを確かめてから**直す:
  - `packages/web/src/keys/KeyRouter.test.ts:135-138`（`s` が `notYet` であること。research F39）
  - `packages/web/src/components/HelpDialog.test.ts:39`（`"未対応（後続: 通知）"`。research F39）
  - **`packages/web/src/components/ContextMenu.test.ts:182`**（global の 3 項目を `toEqual` で
    完全一致。項目を足すと必ず落ちる。**research に載っていなかった 3 件目**）
  なお `ContextMenu.test.ts:190` は `li[1]` を「移動」と仮定しているが、**「移動」の後ろに足す**ので
  そのまま通る（上記 9）。
- AC-I1: ネイティブ `<dialog>` の `cancel` を `preventDefault` して `closeDialog()`（`ConfirmDialog` と同型）。
  設定は押した時点で `wtm.prefs.v1` に入っているので、閉じても保たれる。
- AC-I2: 切り替えは `@click` で即反映。確定ボタンを置かない。
- AC-I3: `prefix+s` で直接開ける。メニュー経由でも、**サイドバーの「メニュー」は `<button>` で
  Tab で到達でき**（先行 work の AC-I3 が受け入れ済み）、開いた後は ↑↓/Enter で選べる。
  ダイアログの中は `<button role="switch">` が Tab の順に入り Space/Enter で切り替わる。
  `prefix+o` もキーだけ。**`sticky` トーストの行動ボタンと閉じるボタンは `<button>` なので
  Tab で押せる**——既存のトーストがキーボードで消せない問題（research F27）を、
  **この work が足す消えないトーストについては閉じるボタンで塞ぐ**（振る舞い 10）。
- AC-I4: 開いたら最初の切り替えへ `focus()`、閉じたら `closeDialog` が開く前の pane へ戻す。
- AC-I5: `openDialogWithContext` を使うので `main.ts:171-176` が端末へキーを流さない。
  トーストは既存と同じ位置・同じ `aria-live`。自動で消えない点と 1 行に畳む点だけが違う。

## テストの置き方

- **純粋関数**（`notify/policy.ts`・`notifyKeyOf`・`routesFor`・待ち行列）は単体で厚く。
  **requirements の表の 3 行 × 3 経路を総当たり**で固定する。
- **`NotificationController`** は port を差し替えて単体。遅延は `vi.useFakeTimers()`（既存に 19 件の先例）。
- **`StoreAdapter`** は既存の `StoreAdapter.test.ts` に足す（`onAgentChanged` の `prev` が
  **本物の前の値**であること、`first` の判定）。
- **ダイアログ**は `WorktreeCreateDialog.test.ts` と同じ流儀（`role="switch"` の `aria-checked`・
  Esc・`disabled` の 4 状態）。
- **E2E** は条項 `e2e-observe-browser` に従い、**`page.addInitScript` で `window.Notification` と
  `AudioContext` を差し替え、呼ばれた事実を DOM に残して観測する**（research F47 の `installPaintProbe` が雛形）。
  `grantPermissions(["notifications"])` より、**AC7・AC12・AC13 の否定側も同じ仕掛けで書ける**のが利点。
  観測の代替であることを**spec のコメントに書く**（条項の要求）。
- **負の対照**（条項 `regression-negative-control`）: 新機能なので「実装前は要素が無い」では弱い。
  **実装後に壊して**落ちることを確かめる（表の 1 行を潰す／鍵から `since` を外す／
  待ち行列の上限を外す／`first` の分岐を外す）。**壊した後は必ず戻し、`cmp` で一致を確認する**。
  生の出力は `test-result.md` に貼る。
- **E2E は 1 本ずつ**。**`pnpm build` を通してから走らせる**（先行 work の decisions D8）。
