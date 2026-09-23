# 仕様: 色の個別の上書き（herdr の `[theme.custom]` 相当）

## 概要

設定画面の節「テーマ」に、上級者向けの折りたたみ「色の個別の上書き」を足す。中身は、本製品が実際に使う 19 個の CSS 変数
（`packages/web/src/theme/uiTokens.ts` の `CSS_VARS`）それぞれについて、「明るいとき」「暗いとき」の色を 1 つずつ上書きできる
一覧。入力は押した瞬間に検証・反映・保存する（確定ボタンは無い。既存の節と同じ）。保存は `wtm.prefs.v1` の新しいキー
`themeOverrides` に、既定（＝上書き無し）との差だけを持つ。

## 設計方針

- **herdr の 19 トークンではなく、本製品の 19 個の CSS 変数を上書きの対象にする**（research F4）。名前も粒度も herdr と
  1:1 ではないが、「個々の色を選び直さずに変えられる」という US1〜3 の価値は満たす。
- **「常に」の層は持たず、「明るいとき」「暗いとき」の 2 層だけ**（herdr は `auto_switch` 有効時だけ `.light`/`.dark` を
  重ねるが、本製品はテーマ自体を明暗の対で選ぶ既存の設計〔20260921-theme-settings〕があるので、2 層だけで実用上足りる。
  research F2 の意図的な逸脱）。
- **反映は `ThemeController` の適用経路に乗せる**が、`apply(name)` の「同じ名前なら省く」最適化（research F5）は壊さない
  ——上書きの変更は別の経路（`applyOverrides()`）で反映する。
- **上書きは画面の枠（CSS 変数）だけに効き、端末の中の色（`TERMINAL_PALETTES`・xterm.js の 16 色）には効かない**
  （herdr の `[theme.custom]` も画面側のトークンだけを扱い、端末の色は別。requirements の「対象」に暗黙のこの前提を明記
  していなかったので、ここで確定する）。
- **色の妥当性は `CSS.supports` ではなく、実物の要素の `style.color` へ代入して読み戻す方式**（research F10。happy-dom の
  `CSS.supports` はスタブで単体テストが機能しない）。
- **保存・setter は「二重の守り」パターン**（20260921-keybinding-customization の `store/settings.ts` の `replaceKeyPrefs`
  と同じ形。読み直して正規化し、状態・保存のどちらも変わらなければ何もしない）を再利用する。同じブラウザの別のウィンドウの
  変更には `storage` イベントで追従する（同 work の decisions D13 と同じ理由）。

## 対象範囲

- 新規: `packages/web/src/theme/themeOverrides.ts`（+ `.test.ts`）
- 変更: `packages/web/src/theme/ThemeController.ts`（+ `.test.ts`）
- 変更: `packages/web/src/store/settings.ts`（+ `.test.ts`）
- 変更: `packages/web/src/components/SettingsDialog.vue`（+ `.test.ts`）
- 変更: `packages/e2e/src/specs/theme-settings.spec.ts`
- 変更: `docs/herdr-parity.md`・`docs/verification.md`・`.aidev/backlog/product-roadmap.md`

## 依拠する既存の事実

- `CSS_VARS`（19 個の CSS 変数名の配列）・`uiTokens(name): UiTokens`（`vars`・`colorScheme` を返す純粋関数） —
  `packages/web/src/theme/uiTokens.ts:16-35,361-369`（research A1・F7）
- `ThemeController.apply(name)` の早期 return と、唯一の呼び出し元（`effectiveTheme` の watch） —
  `packages/web/src/theme/ThemeController.ts:75-77,94-103`（research F5）
- `ThemeController.writeBoot()`／`bootVars(name)`（保存値から控えを作る） — 同 `ThemeController.ts:105-135`（research F8）
- `theme-boot.js` は `chosen.vars` をそのまま `setProperty` するだけ（変更不要） —
  `packages/web/public/theme-boot.js:1-29`（research A7）
- `readPrefs`/`writePrefs`（`wtm.prefs.v1` の読み書きの唯一の入口） — `packages/web/src/store/view.ts:42-65`（research F9）
- `CssVar`（`CSS_VARS` の要素の型。`themeOverrides.ts` が import する） — `packages/web/src/theme/uiTokens.ts:37`
- `keys/keyPrefs.ts`＋`store/settings.ts` の `replaceKeyPrefs`（既定との差だけを持つ保存・二重の守り・`storage` 追従の
  実例） — `packages/web/src/store/settings.ts:168-198`（20260921-keybinding-customization の実装。review 3 ラウンドで
  固まった形。同 work の decisions D13）
- happy-dom の `CSS.supports` は常に `true` を返すスタブ、`el.style.color = …` は実物の CSS の `<color>` 文法で検証する
  — research F10（node + happy-dom で実測）

## インターフェース / データ構造

### `packages/web/src/theme/themeOverrides.ts`（新規）

```ts
import type { CssVar } from "./uiTokens.js";

/** 1 つの明暗の層（上書きしている CSS 変数だけを持つ）。 */
export type ThemeOverrideLayer = Partial<Record<CssVar, string>>;

/** 上書きの全体（明るいとき・暗いとき）。 */
export interface ThemeOverrides {
  readonly light: ThemeOverrideLayer;
  readonly dark: ThemeOverrideLayer;
}

export type ThemeOverrideBucket = "light" | "dark";

export function emptyThemeOverrides(): ThemeOverrides;

/** 実物の要素へ代入して読み戻す（research F10）。空文字列・空白だけは false（＝「未入力」）。 */
export function isValidCssColor(value: unknown): value is string;

/** 保存値を**値ごとに**読む。層が無ければ空、キーが `CssVar` でない・値が妥当な色でなければその 1 項目だけを落とす。 */
export function loadThemeOverrides(raw: unknown): ThemeOverrides;

/** 保存する形（両方の層が空なら `undefined`＝`wtm.prefs.v1` から `themeOverrides` ごと消える）。 */
export function serializeThemeOverrides(
  o: ThemeOverrides,
): { light?: Record<string, string>; dark?: Record<string, string> } | undefined;

/** 1 項目を差し替えた新しい `ThemeOverrides`（イミュータブル）。`value` は妥当な色である前提——空文字列や無効な値の
 * 特別扱いはしない（呼び出し側が振り分ける。下の「空文字列の扱い」参照）。 */
export function withOverride(o: ThemeOverrides, bucket: ThemeOverrideBucket, key: CssVar, value: string): ThemeOverrides;

/** 1 項目を外した新しい `ThemeOverrides`。 */
export function withoutOverride(o: ThemeOverrides, bucket: ThemeOverrideBucket, key: CssVar): ThemeOverrides;

/** 既定の値 (`base`) に、1 つの層 (`layer`) を重ねる（純粋。`ThemeController` と `writeBoot` の両方が使う）。 */
export function mergeVars(base: Record<CssVar, string>, layer: ThemeOverrideLayer): Record<CssVar, string>;

/** 画面に出す、その CSS 変数の使われ方の短い日本語（AC12）。19 個すべてに 1 行ずつ（research F4 の表から）。 */
export const CSS_VAR_LABELS: Readonly<Record<CssVar, string>>;
```

**空文字列の扱い**：`withOverride` 自身は空文字列を特別扱いしない（呼び出し側の責務）。確定した値が空文字列（trim 後）なら、
**`SettingsDialog.vue` が `withOverride`／`setThemeOverride` を呼ぶ前に振り分け**、`resetThemeOverride`（＝`withoutOverride`
経由）を呼ぶ——利用者が入力を空にして確定する操作は、直感的に「戻す」と同じであるべきで、「無効な値」としてエラーを出すのは
体験として不自然（design 決定。requirements には無い判断なので decisions に記録）。呼び出し経路の全体は下の
「`SettingsDialog.vue`（変更）」の確定処理（1〜3）を正とする。

### `packages/web/src/theme/ThemeController.ts`（変更）

- `apply(name)` の中身を、`computeVars(name)` を経由するように変える：
  ```ts
  private computeVars(name: ThemeName): Record<CssVar, string> {
    const base = uiTokens(name);
    const layer = base.colorScheme === "light" ? this.opts.settings.themeOverrides.light : this.opts.settings.themeOverrides.dark;
    return mergeVars(base.vars, layer);
  }
  apply(name: ThemeName): void {
    if (name === this.applied) return;
    this.applied = name;
    const vars = this.computeVars(name);
    for (const key of CSS_VARS) this.opts.root.style.setProperty(key, vars[key]);
    this.opts.root.style.colorScheme = uiTokens(name).colorScheme;
    // …dataset・setTerminalTheme・sendTheme は変えない（上書きは画面の枠だけ。端末の色・サーバへ伝える名前は既定のまま）
  }
  ```
- 新設 `applyOverrides(): void`：`this.applied` が null（`start()` 前）なら何もしない。null でなければ `computeVars(this.applied)`
  を計算し直して `CSS_VARS` を `setProperty` する（`applied` は書き換えない。`setTerminalTheme`／`sendTheme` は呼ばない
  ——上書きは端末色にもサーバへ伝える名前にも影響しない）。
- `start()` に上書きの watch を足す：`watch(() => settings.themeOverrides, () => { this.applyOverrides(); this.writeBoot(); })`。
  **`themeOverrides` は store の setter がイミュータブルに丸ごと差し替える**（`keyPrefs` と同じ）ので、深い watch は要らない。
  `writeBoot()` もここで呼ぶ——上書きを変えた直後に控えが古いままだと、次に開いたとき一瞬既定の色が出てから上書きに変わる
  （AC9）。
- `writeBoot()` の `bootVars(name)` 相当を、控え用に上書きも含めた形にする：
  ```ts
  function bootVars(name: ThemeName, overrides: ThemeOverrides): BootVars {
    const base = uiTokens(name);
    const layer = base.colorScheme === "light" ? overrides.light : overrides.dark;
    return { vars: mergeVars(base.vars, layer), colorScheme: base.colorScheme };
  }
  ```
  `writeBoot()` 本体は、`readPrefs()` から**保存された** `themeOverrides` も読み（`loadThemeOverrides(readPrefs()["themeOverrides"])`。
  既存の「保存された設定から控えを作る」方針〔research F8〕と揃える——このタブの store の上書きではなく、保存値を使う）、
  `fixed`／`light`／`dark` の 3 組それぞれに渡す。

### `packages/web/src/store/settings.ts`（変更）

- `themeOverrides = ref<ThemeOverrides>(loadThemeOverrides(initial["themeOverrides"]))`
- `function replaceThemeOverrides(next: ThemeOverrides): void`（`replaceKeyPrefs` と同じ形。読み直して正規化、状態・保存の
  両方が同じなら何もしない、`writePrefs({ themeOverrides: serialized })`）
- `setThemeOverride(bucket, key, value)`／`resetThemeOverride(bucket, key)`／`resetAllThemeOverrides()` は、いずれも
  `replaceThemeOverrides` を呼ぶだけの薄い関数（`withOverride`／`withoutOverride`／`emptyThemeOverrides()` を渡す）。
- 既存の `storage` イベントの listener（`keys` の追従。20260921-keybinding-customization で追加）に、`themeOverrides` の
  追従も足す（同じ listener の中で両方チェックする。listener を増やさない）。

### `packages/web/src/components/SettingsDialog.vue`（変更）

- 節「テーマ」の末尾に `<details>`（`summary`＝「色の個別の上書き（上級者向け）」）を足す。
- 中身：19 行のリスト。各行＝ラベル＋短い説明（`CSS_VAR_LABELS`）＋「明るいとき」の入力＋既定に戻すボタン（上書き中だけ）
  ＋「暗いとき」の入力＋既定に戻すボタン（上書き中だけ）。「上書き中か」の判定は、コンポーネント内のローカルな関数
  `isOverridden(bucket, key): boolean`（`settings.themeOverrides[bucket][key] !== undefined`）——`themeOverrides.ts` の
  エクスポートではなく、`KeySettings.vue` の `isOverridden`（`store/settings.ts` の `keyPrefs.bindings[id]` を見る）と
  同じ位置づけの、画面専用の小さな判定。
- 入力は draft（ローカルの文字列）を持ち、`@change`／`@keydown.enter`（IME 中は無視）で確定する（`pathDraft` と同じ形。
  research F11）。確定時：
  1. 空文字列（trim 後）なら `resetThemeOverride(bucket, key)`。
  2. `isValidCssColor(draft)` が偽なら、理由（「色として読めません」）を `role="status"` に出し、元の値（現在の上書き、
     無ければ空）へ draft を戻す。反映も保存もしない（AC5）。
  3. 妥当なら `setThemeOverride(bucket, key, draft)`。
- 「すべての上書きを既定に戻す」ボタン＋インライン確認（`keys` の `askResetAll`／`confirmingReset` と同じ形）。
- フォーカス：確定は入力欄に留まる（AC-I4）。「既定に戻す」ボタンを押すと（上書きが消えてボタン自体も消えるので）フォーカスは
  同じ行の入力欄へ移す（`nextTick` で）。「すべて既定に戻す」の確認は `keys` と同じ配置（やめる側に既定のフォーカス）。

## 振る舞いの詳細

- **入出力・状態遷移**：上書きの状態は `themeOverrides`（`{light, dark}`）の 1 か所。読み書きは `loadThemeOverrides`／
  `serializeThemeOverrides` を必ず経由する（値ごとに落とす。AC8）。
- **エッジケース**：
  - 上書きしている CSS 変数がテーマの計算そのもの（`uiTokens.ts`）に将来増減しても、`CSS_VARS` に無いキーの保存値は
    `loadThemeOverrides` が黙って落とす（`Record<CssVar,string>` の型に無いキーは無視。壊れた保存値と同じ扱い）。
  - 同じ CSS 変数を「明るいとき」「暗いとき」の両方で上書きしていても、いま当たっている `colorScheme` の層だけが効く
    （もう一方は保存されたまま、次にその明暗になったときに効く。AC4）。
  - 上書きが 0 個になれば `themeOverrides` キーごと `wtm.prefs.v1` から消える（`keys` と同じ「差が無くなれば消す」規則）。
- **実装上の制約**（「エラー処理 / 異常系」とは別の話）：`isValidCssColor` の実装（`style.color` への代入）は DOM が要る。
  この関数は `theme/` 配下（既に DOM 前提のモジュール群）に置き、SSR や Node 単体では呼ばない（本製品はブラウザだけで
  動く web クライアントなので問題ない）。

## ドメイン固有の考慮

- herdr との違いは docs/herdr-parity.md に書く：①上書きの対象が herdr の 19 トークンではなく本製品の 19 個の CSS 変数
  （対応表つき）②「常に」の層を持たず明暗の 2 層だけ③値の検証は herdr の `reset`/`default`/`none` のような別名を実装せず、
  「既定に戻す」ボタンで代える（空欄での確定も同じ扱い）④上書きに自動のコントラスト補正はしない（herdr と同じ）。

## エラー処理 / 異常系

- 壊れた保存値（`themeOverrides` が配列・文字列・数値等）は `loadThemeOverrides` が空として扱い、ほかの設定を道連れに
  しない（`resolveKeymap`／`loadKeyPrefs` と同じ「値ごとに落とす」設計）。

## 受け入れ基準との対応

- AC1: `SettingsDialog.vue` の新しい `<details>` に、`CSS_VARS`（19 個）× 2（明るいとき・暗いとき）の入力欄を並べる。
  入力の出所：`uiTokens.ts` の `CSS_VARS`。
- AC2: `ThemeController.computeVars`／`mergeVars` が、`uiTokens(name).vars`（コントラスト調整後の計算結果）の上に
  上書きの層をそのまま重ねる（`mergeVars` はコントラストの再計算をしない）。
- AC3: `computeVars` は `uiTokens(name).colorScheme` で層を選ぶ（`settings.themeAuto` は見ない。research F2 の逸脱）。
- AC4: 上書きは `themeOverrides`（CSS 変数のキーで持つ）に保存され、`ThemeController.apply(name)` はテーマを替えるたびに
  `computeVars(name)` を呼び直すので、新しいテーマの `colorScheme` に合う層がそのまま効く。入力の出所：
  `settings.theme`／`themeAuto`／`themeLight`／`themeDark`（既存。20260921-theme-settings）の変化。
- AC5: `SettingsDialog.vue` の確定処理が `isValidCssColor` で拒否し、`store` の setter を呼ばない。入力の出所：
  利用者が入力した draft 文字列。
- AC6: `resetThemeOverride(bucket, key)` → `withoutOverride` → `replaceThemeOverrides`。ボタンの表示は
  `isOverridden(bucket, key)`（`themeOverrides[bucket][key] !== undefined`）で判定。入力の出所：押した行の `bucket`・`key`
  （テンプレートの `v-for` から）。
- AC7: `resetAllThemeOverrides()` → `emptyThemeOverrides()` を渡す → 両方の層が空になり `serializeThemeOverrides` が
  `undefined` を返す → `writePrefs({ themeOverrides: undefined })` で該当キーが消える（`writePrefs` の実装は
  `undefined` の項目を保存しない。`keys` と同じ挙動）。
- AC8: `loadThemeOverrides`／`serializeThemeOverrides`（値ごとに落とす・既定との差だけ）。
- AC9: `writeBoot()` の `bootVars(name, overrides)` に上書きを含め、`theme-boot.js` は変更なしでそのまま当てる（research A7）。
- AC10: `docs/herdr-parity.md`・`docs/verification.md` の更新（coding のタスクとして行う）。
- AC11: `.aidev/backlog/product-roadmap.md` の該当行を `[x]` にする（deliver 時、`protocol-backlog.md` の手順どおり）。
- AC12: `CSS_VAR_LABELS`（19 個の日本語の短い説明）を各行に表示する。
- AC-I1: `<details>`（標準の開閉）。
- AC-I2: 確定は `change`／`Enter`。「すべて既定に戻す」はインライン確認（`keys` の `confirmingReset` と同じ形）。
- AC-I3: すべて `<input>`・`<button>` で、Tab の順はテンプレートの並び順（標準の DOM 順）。
- AC-I4: 確定時はフォーカスを動かさない。「既定に戻す」を押すとボタンが消えるので、`nextTick` で同じ行の入力欄へ戻す。
- AC-I5: 設定画面は既存のダイアログ（`view.openDialog` → `KeyRouter.setMode("dialog")`。20260918 の既存の結線。触らない）。

## テスト方針

- `themeOverrides.test.ts`：`isValidCssColor` の真偽表（research F10 の実測値を単体テストに固定）・`loadThemeOverrides`
  の値ごとの落とし方（壊れた層・妥当でない色・`CssVar` でないキー）・`serializeThemeOverrides` の往復・`withOverride`／
  `withoutOverride`（イミュータブル・空文字列の扱い）・`mergeVars`（層に無いキーは base のまま）。
- `ThemeController.test.ts`：`computeVars` が `colorScheme` で層を選ぶ・`apply` が上書きを含めて当てる（テーマ名が同じ
  ままでも `applyOverrides` で再適用される。研究 F5 の落とし穴の回帰）・`writeBoot` の控えに上書きが入る・上書きが無ければ
  従来どおりの値になる（回帰）。
- `store/settings.test.ts`：`setThemeOverride`／`resetThemeOverride`／`resetAllThemeOverrides` の反映・保存・二重の守り・
  同じ内容を渡し直しても書かない・別のウィンドウの `storage` イベントへの追従。
- `SettingsDialog.test.ts`：折りたたみの開閉（AC-I1）・入力の確定（反映・保存。AC-I2）・無効な値の拒否とメッセージ・
  空欄での確定＝戻す・リセットボタンの表示/非表示とフォーカスの行き先（AC-I4）・「すべて既定に戻す」の確認フロー・
  Tab の順（見出し→入力→リセット、標準の DOM 順。AC-I3）・入力欄でのテキスト編集キーが prefix・直接のキーに奪われない
  こと（AC-I5。既存の他の入力欄と同じ配線なので、KeyRouter 側の新しいテストは無く、この画面のキー操作が素通りする
  ことを見る）。
- E2E（`theme-settings.spec.ts` に追加）：ブラウザで実際に `getComputedStyle(document.documentElement)` を読み、上書きが
  当たっていること・再読み込みしても残ること・既定へ戻すと消えることを確認する（`e2e-observe-browser` 準拠）。
