# 仕様: キーの設定の使い勝手

## 概要

節「キー」に (1) 操作名・群名での絞り込み、(2) 衝突したときの「こちらへ移す」、(3) macOS の非 US
配列での Option chord 表示の補正、(4) 全画面のときだけ有効にできる Keyboard Lock、の 4 つを足す。
4 つは互いに低結合（別々のファイル・別々の状態）なので、architecture 工程は挟まず、この design.md
の中で各機能ごとにインターフェースを決める。

## 設計方針

- 既存の構造にできるだけ乗せる。絞り込みは `actionsByGroup`（computed）の計算を拡張するだけ、
  「こちらへ移す」は `validateAssignment`/`apply` の既存の流れに 1 分岐足すだけ、macOS 表示補正は
  「表示だけを変換する純粋関数」を足すだけ、Keyboard Lock は `ThemeController` と同型の
  コントローラークラスを新設する（研究F16）。
- 実験的 API（`getLayoutMap`・`keyboard.lock`）は**必ず feature-detect + try/catch**で包み、
  無い・失敗する環境では例外を投げず今までの挙動のまま（AC9・AC14）。

## 対象範囲

- 変更: `packages/web/src/components/KeySettings.vue`（絞り込み欄・「こちらへ移す」・macOS 表示
  補正の呼び出し・Keyboard Lock の switch）。
- 変更: `packages/web/src/keys/assign.ts`（`AssignResult` に `conflict` フィールドを追加）。
- 新規: `packages/web/src/keys/chordDisplay.ts`（macOS 表示補正の純粋関数）。
- 新規: `packages/web/src/keys/KeyboardLockController.ts`（`ThemeController` と同型）。
- 変更: `packages/web/src/store/settings.ts`（`keyboardLockInFullscreen` の boolean 設定 1 つ）。
- 変更: `packages/web/src/main.ts`（`KeyboardLockController` の生成・起動）。
- 変更なし: `packages/web/src/keys/keymap.ts`・`packages/web/src/keys/keyPrefs.ts`・サーバー・
  protocol。macOS の表示補正は `chord.ts` 自体（`chordOf`・`parseChord`・`recoverOptionKey`）を
  変えない——新しいファイルに表示専用の変換を足す（AC10 の根拠）。

## 依拠する既存の事実

- 群と一覧は `actionsByGroup`（computed）が `GROUPS.map((group) => ({ group, actions:
  ACTIONS.filter(...) }))` で作る（`packages/web/src/components/KeySettings.vue:35-38`。research
  F2）。
- 衝突判定は `validateBinding`（`packages/web/src/keys/assign.ts:111-177`）の `owner !== id` の
  分岐（`:168-172`）。`km.ownerOf(via, c)` が持ち主の `ActionId` を返す（research F5・F6）。
  **`KeySettings.vue` が直接呼ぶのは公開関数 `validateAssignment`**（`assign.ts:62-84`）で、
  対象が `binding` のとき内部で `validateBinding` へ委譲する（同じ呼び出し階層。20260922-
  keybinding-presets の design で確認済みの関係）——`AssignResult` は `validateAssignment` の
  戻り値の型なので、本 design のコード例・AC 対応では両方の名前が出てくる。
- 置き換え（[変更]）後のフォーカス送り先は `apply()`
  （`packages/web/src/components/KeySettings.vue:123-146`）の `findChangeButton` パターン
  （research F7）。
- macOS 判定は `isMacPlatform()`（`packages/web/src/term/MouseBridge.ts:53`）が既にあり、
  `main.ts:100` で `setOptionComposes` に使われている（research F10）。
- chord 文字と `code` の対応は `chordToKeyInput`（`packages/web/src/keys/chord.ts:388-415`）と
  同じ規則（英字 1 文字なら `Key${大文字}`。research F12）。
- boolean の設定 1 つを足す既存パターンは `statusSymbols`
  （`packages/web/src/store/settings.ts:31-32`〔`loadStatusSymbols`〕・`:76`〔`ref`〕・
  `:102-105`〔`setStatusSymbols`〕）。**`statusSymbols` 自体には専用の `storage` イベント追従が
  無い**——ウィンドウ間の即時同期を持つのは `keys`（`keyPrefs`）だけ（`:186-193`。`writePrefs` が
  1 つの丸ごとの値を上書きしてしまうケースの特別な手当て）。単純な boolean はページの再読み込みで
  拾えれば十分という既存の判断に倣い、`keyboardLockInFullscreen` にも専用の `storage` リスナーは
  足さない（decisions D4）。
- コントローラークラスの型は `ThemeController`
  （`packages/web/src/theme/ThemeController.ts` 一式。`start()`/`stop()`・`this.stops` に
  後始末を積む・`main.ts:159-172` で生成し `app.mount` 前に `start()`）。

## インターフェース / データ構造

### US1: 絞り込み

```ts
// KeySettings.vue の <script setup> に追加
const filterText = ref("");
const actionsByGroup = computed(() => {
  const q = filterText.value.trim().toLowerCase();
  const matches = (a: ActionDef, group: ActionGroup): boolean =>
    q === "" || a.label.toLowerCase().includes(q) || group.toLowerCase().includes(q);
  return GROUPS.map((group) => ({
    group,
    actions: ACTIONS.filter((a) => a.group === group && matches(a, group)),
  })).filter((g) => g.actions.length > 0); // AC2：0 件の群は見出しごと消える
});
```

`<input>` は `.keys-prefix`（prefix の行）の**直後**、群の一覧より**前**に置く（未確定事項の
解消：prefix は絞り込みの対象ではないため、絞り込みが効く範囲＝群の一覧に隣接させる）。

```html
<div class="keys-filter">
  <label class="keys-filter-label" for="keys-filter-input">絞り込み</label>
  <input id="keys-filter-input" type="text" v-model="filterText" class="keys-filter-input"
         placeholder="操作名・群名で絞り込む" />
</div>
```

### US2: こちらへ移す

`AssignResult`（`assign.ts`）に `conflict` を追加する。**「移せる」条件は「owner の
`bindingsOf` に、衝突した chord と完全一致する（範囲でない）文字列があること」**（research
F6）——範囲の一部だけが衝突しているときは `conflict` を付けない（AC7 を機械的に満たす）。

```ts
export type AssignResult =
  | { ok: true; binding: string }
  | {
      ok: false;
      reason: string;
      ignore?: true;
      /** 衝突相手（AC4〜AC7。「こちらへ移す」が出せるときだけ付く）。 */
      conflict?: { ownerId: ActionId; via: "prefix" | "direct"; chord: string };
    };
```

`validateBinding` の該当分岐（現状 `:168-172`）を次のように変える（`owner !== id` のときだけ）：

```ts
if (owner !== id) {
  const single = formatBinding({ via, chord: c, range: false });
  const conflict = km.bindingsOf(owner).includes(single)
    ? { ownerId: owner, via, chord: c }
    : undefined; // 範囲の一部などで単一の chord として特定できない（AC7）
  return {
    ok: false,
    reason: `${display(via, c)} は「${labelOf(owner)}」がすでに使っています。`,
    conflict,
  };
}
```

`KeySettings.vue` 側。**`conflict.via`/`conflict.chord` は、対象（target）側が取り込もうとした
via・chord とも一致する**（`conflict` が付くのは「対象の via・chord がそのまま owner の単一の
割り当てと衝突した」ときだけなので、移す先の binding 文字列は `conflict` から
`formatBinding({via: conflict.via, chord: conflict.chord, range: false})` として一意に求まり、
別途 `binding` を持ち回る必要が無い）：

```ts
const pendingMove = ref<{
  target: Extract<AssignTarget, { kind: "binding" }>;
  conflict: NonNullable<Extract<AssignResult, { ok: false }>["conflict"]>;
} | null>(null);

function onCaptureKeydown(ev: KeyboardEvent): void {
  // …（既存のまま。validateAssignment の結果を受けたあと）
  if (!result.ok) {
    if (result.reason !== "") message.value = result.reason;
    if (result.ignore === true) return;
    pendingMove.value =
      result.conflict && t.kind === "binding" ? { target: t, conflict: result.conflict } : null;
    endCapture();
    return;
  }
  pendingMove.value = null;
  endCapture(apply(t, result.binding));
}

function moveHere(): void {
  const pending = pendingMove.value;
  if (pending === null) return;
  const { target, conflict } = pending;
  const binding = formatBinding({ via: conflict.via, chord: conflict.chord, range: false });
  settings.setKeyBindings(
    conflict.ownerId,
    bindingsOf(conflict.ownerId).filter((b) => b !== binding),
  );
  apply(target, binding); // 対象へ足す（衝突が消えたので今度は通る）
  message.value = `${binding} を「${actionDef(conflict.ownerId)?.label ?? conflict.ownerId}」から「${actionDef(target.id)?.label ?? target.id}」へ移しました。`;
  pendingMove.value = null;
  void nextTick(() => findChangeButton(target.id, binding)?.focus()); // AC-I9
}
```

`pendingMove` は `startCapture`・ダイアログを閉じたときの `watch`（既存。`message.value = ""` と
同じ箇所）でも `null` に戻す（AC6：明示的に押さない限り何も変わらない、を「次の操作が来たら
消える」で満たす）。

`data-move-here` 属性の新規ボタンを `message` の直後（`role="status"` の中ではなく、隣接する
別要素）に `v-if="pendingMove !== null"` で出す（AC-I6）。

### US3: macOS の Option chord 表示

新規 `packages/web/src/keys/chordDisplay.ts`：

```ts
/** `navigator.keyboard.getLayoutMap()` が返す物に必要な形だけを切り出した最小のインターフェース（テストで差し替えやすくする）。 */
export interface LayoutMap {
  get(code: string): string | undefined;
}

/**
 * chord の表示文字列を、いまのキー配列の実際の文字へ置き換える（**表示だけ**。取り込み・照合は
 * chord.ts のまま。design「US3」・AC8〜AC10）。`alt` を含み `ctrl`・`cmd` を含まない、大小のある
 * 1 文字の chord だけが対象（`recoverOptionKey` が復元する対象と同じ範囲）。
 */
export function displayBinding(binding: string, layoutMap: LayoutMap | null): string {
  if (layoutMap === null) return binding;
  const parsed = parseBinding(binding);
  if (parsed === null) return binding;
  const parts = parseChord(parsed.chord);
  if (parts === null || !parts.alt || parts.ctrl || parts.cmd) return binding;
  if (!/^[a-z]$/.test(parts.key)) return binding; // 英字 1 文字だけが対象
  const layoutChar = layoutMap.get(`Key${parts.key.toUpperCase()}`);
  if (layoutChar === undefined || layoutChar.length !== 1) return binding; // 1 文字でない値（デッドキー合成途中等）は対象外
  if (layoutChar.toLowerCase() === parts.key) return binding; // 変わらないなら今までの表示のまま
  const shift = parts.shift || layoutChar !== layoutChar.toLowerCase();
  const newChord = formatChord({ ...parts, key: layoutChar.toLowerCase(), shift });
  return formatBinding({ ...parsed, chord: newChord });
}
```

`KeySettings.vue` は起動時（`onMounted`）に、`isMacPlatform()` かつ
`navigator.keyboard?.getLayoutMap` が関数のときだけ呼び、結果を `ref<LayoutMap | null>(null)` へ
格納する（失敗は `catch` して `null` のまま＝AC9）。`bindingsText`/`summaryText` は
`bindingsOf(id).map((b) => displayBinding(b, layoutMap.value))` を経由する。

**対象範囲を節「キー」の一覧表示に限る**（decisions D3。ヘルプ・トースト・通知・モバイルの
Prefix ボタンは対象外——research F13 の「未確認」を踏まえ、この work では確実に検証できる範囲に
留める）。

### US4: Keyboard Lock

`store/settings.ts` に `keyboardLockInFullscreen`（boolean・既定 `false`）を、`statusSymbols` と
同じ形で追加する（`loadKeyboardLockInFullscreen`・`ref`・`setKeyboardLockInFullscreen`）。
専用の `storage` イベント追従は足さない（decisions D4。「依拠する既存の事実」参照）。

新規 `packages/web/src/keys/KeyboardLockController.ts`（`ThemeController` と同型）：

```ts
/** requirements.md の対象（20260921-keybinding-customization の research.md F27 由来）が挙げた
 *  予約キーの物理コード（`code`）。`Ctrl+Shift+T/N/W` も同じキーを使うので重複しない。 */
export const LOCKED_CODES: readonly string[] = [
  "KeyT", "KeyN", "KeyW", "Tab", "PageUp", "PageDown",
];

export interface KeyboardLockControllerOptions {
  settings: { keyboardLockInFullscreen: boolean };
  doc: Pick<Document, "addEventListener" | "removeEventListener"> & { fullscreenElement: Element | null };
  /** `navigator.keyboard`。無い環境（Firefox・Safari 等）では null。 */
  keyboard: { lock(codes?: string[]): Promise<void>; unlock(): void } | null;
}

export class KeyboardLockController {
  private readonly stops: (() => void)[] = [];
  constructor(private readonly opts: KeyboardLockControllerOptions) {}

  start(): void {
    const { doc, settings } = this.opts;
    const onChange = (): void => this.sync();
    doc.addEventListener("fullscreenchange", onChange);
    this.stops.push(() => doc.removeEventListener("fullscreenchange", onChange));
    const stopWatch = watch(() => settings.keyboardLockInFullscreen, () => this.sync());
    this.stops.push(stopWatch);
    this.sync();
  }

  stop(): void {
    for (const stop of this.stops.splice(0)) stop();
  }

  private sync(): void {
    const { doc, settings, keyboard } = this.opts;
    if (keyboard === null) return; // AC14：無い環境では何もしない
    const shouldLock = settings.keyboardLockInFullscreen && doc.fullscreenElement !== null;
    try {
      if (shouldLock) void keyboard.lock([...LOCKED_CODES]).catch(() => undefined);
      else keyboard.unlock();
    } catch {
      /* AC14：例外を投げない */
    }
  }
}
```

`main.ts` は `navigator.keyboard`（`Navigator` の DOM 型定義に `keyboard` が無いため、
`(navigator as Navigator & { keyboard?: { lock(codes?: string[]): Promise<void>; unlock(): void } })
.keyboard ?? null` の形で feature-detect）を渡して
`new KeyboardLockController({...}).start()` を、`ThemeController` と同じ箇所（`app.mount` 前）で
呼ぶ。

設定画面（`#keys-recommended-note` の直後）に switch を 1 つ足す。**既存の
`SettingsDialog.vue` の switch（`role="switch"` の `<button>` + `.settings-mark`。
`settings-display` 節の `statusSymbols` の switch と同じ形。`SettingsDialog.vue:353-361`
アンカー）に揃える**——ネイティブの `<input type="checkbox">` ではなく、この PJ の既存の switch の
語彙に合わせる（decisions D5）。scoped CSS は親から子（`KeySettings.vue`）へ効かないため、
`.settings-switch`/`.settings-mark` を `KeySettings.vue` 側にも再現する（冒頭の注記と同じ理由）：

```html
<button type="button" role="switch" class="settings-switch"
        :aria-checked="settings.keyboardLockInFullscreen" @click="toggleKeyboardLock">
  <span class="settings-mark">{{ settings.keyboardLockInFullscreen ? "入" : "切" }}</span>
  <span>全画面のとき、ブラウザ予約キーも使う（実験的。対応ブラウザのみ）</span>
</button>
```

```ts
function toggleKeyboardLock(): void {
  settings.setKeyboardLockInFullscreen(!settings.keyboardLockInFullscreen);
}
```

## 振る舞いの詳細

- US1: 絞り込み欄は `filterText` の変更のたびに同期的に再計算される（`computed`）。フォーカスは
  Vue の `v-model` が要素を再利用する限り奪われない（`<input>` 自体は `v-for` の対象ではなく
  常に同じ DOM ノード。AC-I4）。
- US2: 「こちらへ移す」は衝突が起きた**その回だけ**有効。次に別の取り込みを始めた（`startCapture`）
  か、ダイアログを閉じると `pendingMove` がクリアされ、ボタンは消える（AC6。「インターフェース /
  データ構造」US2 が定義する 2 箇所のクリア処理のみ——絞り込み欄の入力では消さない。絞り込みで
  衝突した行自体が一覧から外れても、ボタンは案内文と一緒に残ってよい）。移した後のフォーカスは
  新しい割り当ての［変更］ボタン（AC-I9。既存の置き換えパターンと同じ）。
- US3: `getLayoutMap()` は非同期（Promise）なので、マウント直後は今までの表示のまま、取得できた
  時点で再描画される（`ref` の更新で `computed` が再評価される。ちらつきは許容——実験的機能の
  対象環境〔Chromium・macOS〕でしか発生しない）。
- US4: `fullscreenchange` は全画面に入った・出た**両方**で発火するので、`sync()` 1 つで
  ロック・アンロックの両方を賄える。設定の switch を切り替えたときも `watch` 経由で `sync()` が
  呼ばれ、全画面中に無効化すればその場で `unlock()` される。

## ドメイン固有の考慮

- US3・US4 はいずれも「実験的 API・Chromium 系限定」という制約が本製品のドメイン
  （ブラウザ間差異を吸収しない方針＝可能なら機能を出し、無理なら黙って今までどおり）とそろう
  設計にする——既存の `isAltGrComposed`（AltGr 判定。`code`/`key` の比較だけで `getLayoutMap` は
  使わない）や macOS の Option 復元（`recoverOptionKey`）と同じ、**使えない環境では黙って
  今までどおりに倒す** feature-detect の流儀を踏襲する。`getLayoutMap`・`keyboard.lock` の
  実際の呼び出しはこの work で初めて足す（「対象範囲」）。

## エラー処理 / 異常系

- `navigator.keyboard.getLayoutMap()` が reject する・存在しない → `layoutMap.value` は `null` の
  まま。表示は今までどおり（AC9）。
- `navigator.keyboard.lock()` が reject する・`navigator.keyboard` 自体が無い →
  `KeyboardLockController.sync()` は `catch` で握りつぶす。switch 自体は出るが効果が無い
  （AC14）。
- 「こちらへ移す」で衝突相手の割り当てを外した直後に `apply()` が失敗する事態は無い
  （`conflict` を付ける条件＝「owner がその chord を単独で持っている」を満たしていれば、外した
  瞬間に `owner` 側の占有が消え、`apply()` は検証済みの `binding` をそのまま書き込むだけなので
  失敗しない）。

## 受け入れ基準との対応

- AC1: 「インターフェース / データ構造」US1 の `actionsByGroup`（`matches` 関数）。
      入力の出所: `filterText`（利用者の入力）。
- AC2: 同上、`.filter((g) => g.actions.length > 0)`。
- AC3: `filterText.value === ""` のとき `matches` が常に true を返す。
- AC4: US2 の `validateBinding` の `conflict` 付与 → `KeySettings.vue` の `pendingMove`。
      入力の出所: `validateAssignment` の戻り値（`assign.ts`）。
- AC5: `moveHere()` 関数（US2）。
- AC6: `pendingMove` のクリア条件（「振る舞いの詳細」US2）。
- AC7: `conflict` を付けない条件（`km.bindingsOf(owner).includes(single)` が偽のとき。
      「インターフェース / データ構造」US2）。
- AC8: `displayBinding()`（US3）。入力の出所: `navigator.keyboard.getLayoutMap()` の結果
      （`layoutMap` ref）。
- AC9: `displayBinding()` の `layoutMap === null` 早期 return、および `onMounted` の
      `isMacPlatform()`/`getLayoutMap` の feature-detect（「エラー処理 / 異常系」）。
- AC10: `displayBinding()` は `parseBinding`・`parseChord`・`formatChord`・`formatBinding`（既存の
      **読み書きだけの純粋関数**）を読み取りに使うが、取り込み・照合に関わる関数
      （`chordOf`・`recoverOptionKey`・`validateAssignment`/`validateBinding`）は一切呼ばない・
      変えない（「対象範囲」）。保存される chord 文字列自体もこの関数の外では一切変更しない。
- AC11: `store/settings.ts` の `keyboardLockInFullscreen`（既定 `false`）と、設定画面の switch
      （US4）。
- AC12: `KeyboardLockController.sync()` が `shouldLock` のとき `keyboard.lock([...LOCKED_CODES])` を
      呼ぶ。届いたキーは既存の `KeyRouter`/`KeyInputController` の経路をそのまま通る
      （変更していないため。AC-I12）。
- AC13: `sync()` が `shouldLock` が偽のとき `keyboard.unlock()` を呼ぶ（`fullscreenchange` で
      全画面を抜けたときに発火）。
- AC14: `KeyboardLockController.sync()` の `keyboard === null` 早期 return と `try/catch`
      （「エラー処理 / 異常系」）。
- AC-I1: 絞り込み欄は `.keys-filter` の常設の `<input>` で、開閉の概念を持たない（US1 の
      テンプレート例）。
- AC-I2: `filterText` は `v-model` で入力のたびに即時反映。確定操作は無い（US1 の
      「インターフェース / データ構造」）。
- AC-I3: `<input id="keys-filter-input">` は通常のタブ順に乗る通常の `<input>`（追加の
      `tabindex` を持たない。US1 のテンプレート例）。
- AC-I4: 「振る舞いの詳細」US1（`v-model` が同じ DOM ノードを再利用するためフォーカスが
      奪われない）。
- AC-I5: 絞り込み欄が `.keys-capture` の外にある独立した `<input>` であること（既存の取り込み
      ハンドラは `.keys-capture` 要素にしか付かないため、干渉しない）。
- AC-I6: `pendingMove !== null` のときだけ「こちらへ移す」ボタンを出す（US2の
      「インターフェース / データ構造」）。
- AC-I7: `moveHere()` は呼ばれた時点で即座に確定する処理で、確認ダイアログを挟まない（US2の
      `moveHere()` 本体）。
- AC-I8: 「こちらへ移す」ボタンは通常の `<button>` で、通常のタブ順で到達できる（`data-move-here`
      属性は選択用で、フォーカス制御には関与しない）。
- AC-I9: `moveHere()` 末尾の `findChangeButton(target.id, binding)?.focus()`。
- AC-I10: 新規ボタンはテンプレート上 `message` の直後に足すだけで、既存の削除・変更・追加の
      各ボタンの並びには手を入れない（「対象範囲」に既存ファイルの変更点として明記のとおり、
      既存要素の削除・並べ替えは行わない）。
- AC-I11: switch の説明文言に「全画面のとき」「実験的。対応ブラウザのみ」を明記（US4の
      テンプレート例）。
- AC-I12: `KeyboardLockController` は `fullscreenchange`・`keyboard.lock`/`unlock` の呼び出しに
      閉じており、`KeyRouter`/`KeyInputController`（届いたキーの処理）を一切変更しない
      （「対象範囲」の「変更なし」一覧に `keymap.ts` 等を含めているとおり）。
