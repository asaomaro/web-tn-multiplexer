# 仕様: keydown を止めるボタンにフォーカスが残っていても prefix・直接のキーを効かせる

## 概要

`Sidebar.vue`（6箇所）・`TabBar.vue`（1箇所）の `@keydown.stop` は、ボタンの Enter/Space
での二重発火を防ぐために keydown を無条件に止めており、結果として `main.ts` のグローバルな
keydown ハンドラ（prefix・直接のキーの処理経路）に何も届かなくなっている。この work では、
各ファイルに小さな共有ハンドラ（`onButtonKeydown`）を1つずつ定義し、無修飾の Enter/Space の
ときだけ `stopPropagation()` する（`preventDefault()` はしない——対象は素の `<button>` 要素
なので、ネイティブな活性化を妨げないため必要ない）形に置き換える。`main.ts`・
`KeyInputController`・`KeyRouter`・`assign.ts` には触れない。

## 設計方針

- **`PaneFrame.vue:238-246` の `onKeydown` と同じ判定ロジック（無修飾の開始キーだけ止める）
  を踏襲するが、`preventDefault()` は呼ばない**。`PaneFrame.vue` の対象
  （`pane-frame-edge`。`PaneFrame.vue:259-266` の `<div ... role="button" ...>`）は
  ネイティブな Enter/Space 活性化を持たない `<div>` であり、独自に `preventDefault()` して
  メニューを手動で開く必要がある（依拠する既存の事実、参照）。今回の対象は素の
  `<button type="button">` なので、ブラウザの既定動作（依拠する既存の事実「ブラウザの
  標準動作」参照）がそのまま働く——`stopPropagation()` だけで「`main.ts` へ二重に届かない」
  という目的（design の元の理由。依拠する既存の事実、参照）は達成でき、`preventDefault()` は
  不要かつ有害（ボタン自身の活性化を妨げてしまう）。
- **共有ハンドラは各ファイルに1つずつ定義する**（`Sidebar.vue` の6箇所は同じ
  `onButtonKeydown` を参照、`TabBar.vue` は自分の1箇所に同名の関数を定義）。2ファイル間で
  共有するモジュールは作らない——ロジックは4行程度で、`packages/web/src/keys/` 配下の
  既存ファイル（依拠する既存の事実、参照）はいずれもキー文字列の解決・状態管理のロジックで
  あり、Vue コンポーネントの DOM イベントハンドラを置く場所として使われていない。重複は
  2箇所（各ファイル1つ）に留まり、共有インフラを増やすほどの規模ではない。
- **navigate モードとの相互作用は新しい設計判断を加えない**（requirements「スコープ /
  対象外」）。`PaneFrame.vue`/`ContextMenu.vue` も同様に「フォーカス中の要素が自分の
  Enter/Space を優先する」という規則を持っており、今回追加するボタンもこの確立した
  優先順位にそのまま従う。

## 対象範囲

- `packages/web/src/components/Sidebar.vue`（6箇所の `@keydown.stop` を置き換え、
  `onButtonKeydown` を新設）
- `packages/web/src/components/TabBar.vue`（1箇所の `@keydown.stop` を置き換え、
  `onButtonKeydown` を新設）
- `packages/web/src/components/Sidebar.test.ts`・`TabBar.test.ts`（確認テストを追加）
- `docs/verification.md`（897-899行目の既知の制約の記述を更新）
- `packages/e2e/src/specs/key-bindings.spec.ts`（171行目のテスト名の注記を更新。
  アサーション自体は変更しない——requirements「対象外」・AC7 参照）
- `.aidev/backlog/product-roadmap.md`（該当行を完了に。deliver で対応）

## 依拠する既存の事実

- `packages/web/src/main.ts:269-280` の `window.addEventListener("keydown", ...)`:
  `view.openDialog` が開いていれば・`document.activeElement` が
  `.xterm-helper-textarea`（端末自身）なら何もしない。それ以外は `keys.handleDomKey(ev)`
  を呼び、`pass` でなければ `ev.preventDefault()`。コメント（273-276行目）に「端末以外
  （サイドバー・tab バー等）にフォーカスがあるときの keydown」を受け止める設計だと明記
  されている——ボタン側の `stopPropagation()` が発火元で伝播を断っているために届かない、
  という構図。
- `packages/web/src/components/PaneFrame.vue:238-246` の `onKeydown`:
  `ev.key === "Enter" || ev.key === " " || ev.key === "ArrowDown" || ev.key ===
  "ContextMenu" || (ev.key === "F10" && ev.shiftKey)` かつ修飾キー無しのときだけ
  `preventDefault()`＋`stopPropagation()`（コメント「`main.ts` の window の keydown に
  二重に渡さない」）。それ以外のキーは何もせず bubble させる。
- `packages/web/src/components/Sidebar.vue` の `@keydown.stop` 6箇所（372, 411, 425, 432,
  442, 468行目）・`packages/web/src/components/TabBar.vue` の1箇所（157行目）。いずれも
  `<button type="button">` 要素上。
- `.aidev/works/20260921-keybinding-customization/decisions.md` D11(1)（101-119行目）:
  この問題を発見しつつ「`@keydown.stop` は入力欄・ボタンの Enter/Space を守るために
  あるので、この work では触らない」として見送り、`docs/verification.md` の既知の制約
  （897-899行目）へ記録、backlog へ送った経緯。理由節（117-118行目）が代案（`window` の
  keydown を capture フェーズにする）を「入力欄へ打つキーまで prefix・直接のキーに
  取られうる」として明示的に却下している。
- `docs/verification.md:897-899` の既知の制約の現在の記述（サイドバーの［＋新規］
  ［メニュー］［並び順］［«］・tab バーの［＋］は `keydown` を止め、pane の枠は
  Enter・Space・↓ を止める、という説明）。
- `packages/e2e/src/specs/key-bindings.spec.ts:171` のテスト名
  「端末の外（フォーカスできない要素＝サイドバーの行をクリックした後）でも、直接のキーは
  効く（AC5。`keydown` を止めるボタンの上は既知の制約）」。本文（175-189行目）は
  「フォーカスできない要素（サイドバーの行）をクリックした後」のシナリオを検証しており、
  ボタンにフォーカスが残るケース自体は検証していない——テスト名の注記だけがこの work の
  対象。
- `packages/web/src/components/PaneFrame.test.ts:101-111` の「キーボード：開くキーは
  window の keydown（端末の外のキーの処理）へ渡さず、ほかのキー（Tab・prefix 等）は渡す」
  テスト（実際の `window.addEventListener` スパイで、対象要素から Enter を dispatch しても
  window 側が呼ばれないこと・修飾付き/他のキーでは呼ばれることを確認する構造）。この work
  の新規テストが従う型。
- ブラウザの `<button>` 要素のキーボード活性化（Enter/Space で `click` を発火する既定動作）
  は、実ブラウザの挙動であり、この work のテスト実行環境（`packages/web/vitest.config.ts:7`
  の `environment: "happy-dom"`）では**再現されない**——このセッションで実機確認した
  （素の `<button>` を作り `dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))`
  しても `click` は発火しない。happy-dom は合成 keydown からの既定活性化を実装していない）。
  一方、`preventDefault()` を呼んだかどうか（`ev.defaultPrevented`）は happy-dom でも
  正しく反映される。したがって、この work の単体テストでは「`click` が実際に発火すること」
  は検証できず、「`ev.defaultPrevented` が `false` のままであること」（＝コード側が既定動作を
  妨げていないこと）を検証する——実ブラウザでの活性化そのものは、既存の Vue の慣習上
  ここでは新たに e2e 化しない（「設計方針」の代替案検討、参照）。

## インターフェース / データ構造

### `packages/web/src/components/Sidebar.vue`

```ts
/** ボタンの Enter/Space を main.ts の window keydown（prefix・直接のキーの経路）へ二重に
 * 渡さない（20260925-focus-trapped-keybindings。design「設計方針」）。preventDefault は
 * しない——ネイティブな活性化（click）は妨げない。 */
function onButtonKeydown(ev: KeyboardEvent): void {
  if ((ev.key === "Enter" || ev.key === " ") && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
    ev.stopPropagation();
  }
}
```

6箇所の `@keydown.stop` を `@keydown="onButtonKeydown"` に置き換える（属性の追加位置は
既存の `@keydown.stop` と同じ）。

### `packages/web/src/components/TabBar.vue`

同じ関数定義（`onButtonKeydown`）を1つ追加し、157行目の `@keydown.stop` を
`@keydown="onButtonKeydown"` に置き換える。

## 振る舞いの詳細

- 対象ボタンにフォーカスがある状態で Enter/Space（無修飾）を押す: ボタンは従来どおり
  `click` を発火する（ネイティブ動作。妨げない）。keydown イベントは `stopPropagation()`
  で止まり、`main.ts` の window keydown には届かない（従来と同じ。AC3）。
- 対象ボタンにフォーカスがある状態で prefix キー・修飾付きの直接のキーを押す:
  `onButtonKeydown` は何もしない（早期 return 相当）ので、keydown はそのまま bubble し、
  `main.ts` の window keydown へ届く。`view.openDialog`/`xterm-helper-textarea` の
  ガードにも当たらないため、`keys.handleDomKey(ev)` が呼ばれ、prefix・直接のキーとして
  処理される（AC1・AC2・AC4）。
- 対象ボタンにフォーカスがある状態で Tab 等: `onButtonKeydown` は何もしないので、ブラウザ
  既定のフォーカス移動がそのまま働く（AC5）。

## ドメイン固有の考慮

- 該当なし（herdr との機能差ではなく、`20260921-keybinding-customization` decisions.md
  D11(1) が発見し明示的に backlog へ送った内部整合性の修正）。

## エラー処理 / 異常系

- 新しいエラー処理は追加しない。`onButtonKeydown` は判定条件に当たらなければ何もしない
  純粋な早期 return で、例外を投げる経路も無い。

## 受け入れ基準との対応

- AC1: `Sidebar.vue` の6箇所を `onButtonKeydown` 参照に置き換える（入力: 各ボタンの
  keydown イベント。インターフェース節「packages/web/src/components/Sidebar.vue」参照）。
  単体テスト（`Sidebar.test.ts`）は6箇所全てを、design のこの節が「全6箇所は同一の
  ハンドラ実装を使う」と確定させたことにより、確認粒度は「同じ実装を複数箇所で使う」
  ことを踏まえて design で以下のとおり確定する: 単体テストは6箇所全てで実施する
  （実装をコピー&ペーストした際の貼り忘れを検知するため）。
- AC2: AC1 と同じ変更点で確認する（`onButtonKeydown` は Enter/Space 以外を素通しする
  ため、修飾付きの直接のキーは無条件に bubble する）。
- AC3: `onButtonKeydown` が `preventDefault()` を呼ばないことで、ネイティブな `click`
  発火が妨げられない（インターフェース節のコード例、参照）。単体テストでは
  `ev.defaultPrevented` が `false` のままであることを確認する（依拠する既存の事実
  「ブラウザの `<button>` 要素のキーボード活性化」参照——テスト環境（happy-dom）では
  実際の `click` 発火そのものは再現できないため、コード側が既定動作を妨げていないことを
  確認する形にする）。
- AC4: `TabBar.vue` に同じ関数を追加し、157行目を置き換える（インターフェース節
  「packages/web/src/components/TabBar.vue」参照）。
- AC5: `onButtonKeydown` の条件（`ev.key === "Enter" || ev.key === " "`）に当たらない
  キーでは何もしないことで担保する（インターフェース節のコード例、参照）。
- AC6: `docs/verification.md:897-899`（依拠する既存の事実、参照）の記述を、「ボタンに
  フォーカスが残っていても prefix・直接のキーは効くが、そのボタン自身が Enter/Space を
  受け取るため、navigate モード中に対象ボタンへフォーカスが残っていると Enter/Space は
  ボタンの活性化が優先される」という趣旨に書き換える。
- AC7: `Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts`（依拠する既存の事実の
  `PaneFrame.test.ts` の型を踏襲した新規テストを含め、既存テストは無改修）・
  `packages/e2e/src/specs/key-bindings.spec.ts`（171行目のテスト名だけ更新。依拠する
  既存の事実、参照）が、この work の変更後も成立することで確認する。
- AC8（review 指摘で追加。T6 taskcheck round1 の指摘で3テストに分割）: `key-bindings.spec.ts`
  に新設する3件の E2E テストで、単体テスト（happy-dom）が検証できない「実ブラウザでの
  `window` keydown 到達→`KeyRouter`→prefix・直接キーの確定→続くキーで実際に pane が
  分割される」という一連の流れを実地に確認する。`Sidebar.vue`・`TabBar.vue` の
  `onButtonKeydown` はモジュールを共有しない別々の実装（対象範囲・設計方針、参照）なので、
  それぞれに代表1箇所を置く:
  - AC1（サイドバー・prefix 経由）: `.sidebar-spaces .sidebar-sort-btn` を `.click()`
    してフォーカスが残ることを確認したうえで `prefixKey(page, "v")`（既定の
    `split_vertical` 割り当て）を送り、`paneCount(page)` が増えることを確認する。
  - AC2（サイドバー・prefix を経由しない直接キー）: `openWithPrefs` で
    `split_vertical: ["prefix+v", "ctrl+alt+d"]` を割り当てた状態で同じボタンを
    `.click()` し、`Control+Alt+d` を送って `paneCount` が増えることを確認する
    （既存の「直接のキー：ctrl+alt+d を右へ分割に足すと…」テストや AC5 のテストと同じ
    `openWithPrefs`/`paneCount` の型を踏襲）。
  - AC4（tab バー・prefix 経由）: `.tab-bar-new` を `.focus()`（`.click()` ではない——
    クリックは新しい tab の名前入力ダイアログを開いてフォーカスを奪う副作用を持つため。
    `onButtonKeydown` は keydown だけを見るので、フォーカスへ至る経路を問わず同じに
    振る舞う）してフォーカスが残ることを確認したうえで `prefixKey(page, "v")` を送り、
    `paneCount(page)` が増えることを確認する。
  「並び順」ボタンを選ぶのは、クリックしてもダイアログ等を開かず（＋新規・メニューと違い
  フォーカスを奪う副作用が無く）クリック後もボタン自身へフォーカスが残るため
  （decisions.md D5 参照）。
