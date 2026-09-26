# 仕様: pane の枠にフォーカスがある間の prefix・後のキーの割り当てを保護する

## 概要

`packages/web/src/keys/keymap.ts` の `RESERVED_AFTER_PREFIX`（prefix の後のキーとして
割り当てられない chord の一覧）に、Enter（`enter`）・Space（`space`）・ArrowDown（`down`）・
Shift+F10（`shift+f10`）と、前3つの shift 付き（`shift+enter`・`shift+space`・`shift+down`）の
計7エントリを追加する。既存の `esc`・`ctrl+shift+v` の2エントリと同じ形
（chord → 拒否理由の文字列）を踏襲する。加えて `RESERVED_DIRECT`（直接のキーとして割り当てら
れない chord の一覧）に `shift+f10` を追加し、型を `ReadonlySet<string>` から
`ReadonlyMap<string, string>` へ変更する（T1 round2 taskcheck の指摘。理由は「インターフェース /
データ構造」）。プロダクトコードの変更は `keymap.ts`・`assign.ts` の2ファイルに閉じ、他には
回帰テスト（「対象範囲」参照）だけを足す。

## 設計方針

既存の予約の仕組み（`RESERVED_AFTER_PREFIX`）へ素直に7エントリ足すだけで閉じる、最小の変更を
採る。代替案として `PaneFrame.vue` 側の `onKeydown` を変更する案も検討したが、
`PaneFrame.vue` の既存の実装（マウスではフォーカスを奪わない`onMouseDown`の
`ev.preventDefault()`。`PaneFrame.vue:225-229`・ctrl/alt/meta 付きは無条件で bubble する
`onKeydown`の`if (!opens || ev.ctrlKey || ev.altKey || ev.metaKey) return;`。
`PaneFrame.vue:238-246`）は正しく、変更の必要が無いと判明したため採らない（コンポーネント側に
手を入れると、`RESERVED_AFTER_PREFIX` という「他の場所が先取りするキーは割り当てさせない」
既存の設計原則から外れ、同種の衝突（貼り付けの `ctrl+shift+v`）と扱いが不揃いになる）。
**shift は上記の判定条件に含まれない**ため、無修飾だけでなく shift 付き
（`shift+enter`・`shift+space`・`shift+down`）も同じ穴を持ち、6エントリとも予約が必要
（review round1 の指摘。research F3・F10）。

**F10 だけは別の穴の形を持つ**（T1 round2 taskcheck の指摘。research F11）。`PaneFrame.vue` の
F10 サブ条件（`ev.key === "F10" && ev.shiftKey`）は shift 付きのときだけ発火するため無印の
`f10` は対象外だが、`shift+f10` は `chord.ts` の `F_KEY` 機構（`NAMED_KEYS` とは独立）で
表現できるうえ、`isDirectChord`（`chord.ts:282-286`）が F キーを shift の有無に関わらず
direct として通すため、**prefix の後・直接の両方**で割り当てが通ってしまう。よって
`RESERVED_AFTER_PREFIX` だけでなく `RESERVED_DIRECT` にも `shift+f10` を追加する必要がある。
`RESERVED_DIRECT` は当初 `ReadonlySet<string>` で、参照側（`assign.ts:138-139`・
`keymap.ts:126-127`）が「は貼り付けに使うので」という `ctrl+shift+v` 専用の固定文言を
ハードコードしていた（research F12）。ここへ `shift+f10` を素朴に足すと、画面に事実と異なる
理由（「shift+f10 は貼り付けに使うので…」）が出てしまうため、`RESERVED_DIRECT` も
`RESERVED_AFTER_PREFIX` と同じ `ReadonlyMap<string, string>`（chord → 理由）へ変更し、
参照側を `.get()` ベースへ書き換える。

## 対象範囲

- `packages/web/src/keys/keymap.ts`（`RESERVED_AFTER_PREFIX` に7エントリ追加、`RESERVED_DIRECT`
  を `Map` 化して `shift+f10` を追加、`resolveKeymap` 内の直接のキー判定の参照を `.get()` へ）
- `packages/web/src/keys/assign.ts`（`validateBinding` の直接のキー分岐（138-139行目）の
  `RESERVED_DIRECT` 参照を `.has()`＋固定文言から `.get()` ベースへ）
- `packages/web/src/keys/keymap.test.ts`（回帰テスト）
- `packages/web/src/keys/assign.test.ts`（回帰テスト）

## 依拠する既存の事実

- `RESERVED_AFTER_PREFIX`（`keymap.ts:35-38`）は `ReadonlyMap<string, string>`（chord → 拒否
  理由の文字列）。既存の2エントリ: `PREFIX_CANCEL_CHORD`（`esc`）→「Esc は prefix の取り消しに
  使うので、prefix の後のキーにできません。」、`"ctrl+shift+v"` →「ctrl+shift+v は貼り付けに
  使うので、prefix の後のキーにできません。」
- `assign.ts:150-151`（`validateAssignment` の prefix-後 分岐）: `RESERVED_AFTER_PREFIX.get(chord)`
  を引き、見つかれば `{ ok: false, reason }` を返すだけ。ロジック変更は不要
  （research 実装アンカー A1、コードを読んで確認済み）。
- `RESERVED_DIRECT`（`keymap.ts:44`。T1 round2 taskcheck 前は `ReadonlySet<string>`）は
  `new Set(["ctrl+shift+v"])` の1エントリのみ。参照側は2か所——`assign.ts:138-139`
  （`validateBinding` の直接のキー分岐）が `RESERVED_DIRECT.has(chord)` を見て
  `` `${chord} は貼り付けに使うので、直接のキーにできません。` `` という**固定文言**を返し、
  `keymap.ts:126-127`（`resolveKeymap` の `register`）も同様に
  `` `${chord} は貼り付けに使うので直接のキーにできません` `` を組み立てている。どちらも
  `RESERVED_AFTER_PREFIX` のような理由付きの `Map` ではなく、`ctrl+shift+v`（貼り付け）専用の
  文言を埋め込んでいた（コードを読んで確認済み。research F12）。
- `isDirectChord`（`chord.ts:282-286`）: `return p.ctrl || p.alt || p.cmd || F_KEY.test(p.key);`。
  ctrl/alt/cmd のいずれかを持つ chord、または `F_KEY`（`chord.ts:122`。F1〜F24）にマッチする
  chord を direct として許す。**shift の有無を見ない**ため、F キーは shift 付きでも direct を
  通る（`shift+f10` が該当。research F11）。
- `KeySettings.vue:295`: `if (result.reason !== "") message.value = result.reason;`
  ——`assign.ts` が返す `reason` 文字列をそのまま画面に出す既存の配線で、拒否理由の内容に
  よる分岐は無い。**この work のための画面側の変更は不要**（requirements.md「未確定事項」を
  ここで解消する）。
- chord 表記: `chord.ts:68-84`（`NAMED_KEYS`）で `Enter → "enter"`・`" " → "space"`・
  `ArrowDown → "down"`。`ContextMenu`・`F10` はこの表に無く、chord 文字列として表現する
  手段が無い（この表に無いキーは `parseChord`/`formatChord` の往復ができないため。
  `chord.ts:68-84` の一覧を確認済み）。
- `PaneFrame.vue:225-229`（`onMouseDown`）: `ev.preventDefault()` を呼び、ブラウザの既定の
  フォーカス付与（クリックでの `pane-frame-edge` へのフォーカス移動）を防ぐ。
- `PaneFrame.vue:238-246`（`onKeydown`）: `if (!opens || ev.ctrlKey || ev.altKey ||
  ev.metaKey) return;` により、ctrl/alt/meta 付きの keydown は無条件で bubble する
  （`stopPropagation()` を呼ばない）。**`ev.shiftKey` はこの判定に含まれない**——
  Shift+Enter・Shift+Space・Shift+ArrowDown も `opens` が true なら `stopPropagation()`
  される（review round1 で判明）。`opens` の定義のうち F10 だけは
  `(ev.key === "F10" && ev.shiftKey)` という自分専用のサブ条件を持つ——**F10 は shift 付きの
  ときだけ** `opens` に含まれる（無印の `f10` は対象外。T1 round2 taskcheck で判明。research F11）。
- `chord.ts:170-190`（`parseChord`）の shift 禁止規則（`if (parts.shift && (key === "plus" ||
  (isSingleChar(key) && !isCased(key)))) return null;`）は「大小のない1文字（数字・記号）」
  だけが対象で、`enter`/`space`/`down` のような複数文字の名前付きキーには掛からない。よって
  `shift+enter`・`shift+space`・`shift+down` は画面から実際に取り込み・保存できる有効な
  chord である。
- `packages/web/src/keys/keymap.test.ts:245`（既存の `ctrl+shift+v`・`esc` 予約のテスト。
  同型のテストを追加する土台として使える）・`packages/web/src/keys/assign.test.ts:217-224`
  （`esc` 拒否のテスト）・`assign.test.ts:226-236`（`ctrl+shift+v` 拒否のテスト）。

## インターフェース / データ構造

`keymap.ts` の変更差分（イメージ）:

```ts
export const RESERVED_AFTER_PREFIX: ReadonlyMap<string, string> = new Map([
  [PREFIX_CANCEL_CHORD, "Esc は prefix の取り消しに使うので、prefix の後のキーにできません。"],
  ["ctrl+shift+v", "ctrl+shift+v は貼り付けに使うので、prefix の後のキーにできません。"],
  ["enter", "Enter は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["space", "Space は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["down", "↓ は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+enter", "Shift+Enter は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+space", "Shift+Space は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+down", "Shift+↓ は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+f10", "Shift+F10 は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
]);

export const RESERVED_DIRECT: ReadonlyMap<string, string> = new Map([
  ["ctrl+shift+v", "ctrl+shift+v は貼り付けに使うので、直接のキーにできません。"],
  ["shift+f10", "Shift+F10 は pane の枠のメニューを開くキーとして使うので、直接のキーにできません。"],
]);
```

（コメント（33行目）は既存の `ctrl+shift+v` 由来の説明のみなので、この7件の理由も一言添えて
更新する——「別の場所が先に取る」という既存の説明に、「pane の枠が Tab で選べたときに自分の
メニューを開くキーとして使う（無修飾・shift 付きの両方。F10 は shift 付きのときだけ）」という
理由を並記する形にする。`RESERVED_DIRECT` は `Set` から `Map` へ型を変える——`ctrl+shift+v` の
既存の拒否理由文言は変えず、`shift+f10` は新しい理由を持つ。参照側（`assign.ts:138-139`・
`keymap.ts:126-127`）も `.has()`＋固定文言から `.get()` ベースへ書き換える。）

## 振る舞いの詳細

- ユーザーがキー割り当て画面で prefix の後のキーとして Enter・Space・ArrowDown・
  Shift+Enter・Shift+Space・Shift+ArrowDown・Shift+F10（chord 表記 `enter`・`space`・`down`・
  `shift+enter`・`shift+space`・`shift+down`・`shift+f10`）を取り込もうとすると、
  `validateAssignment` が `RESERVED_AFTER_PREFIX` から拒否理由を引いて `{ ok: false, reason }`
  を返す（既存の `esc`・`ctrl+shift+v` と同じ経路）。
- 直接のキー（prefix 無し）の検証は、`shift+f10` だけ新たに拒否される——`RESERVED_DIRECT` に
  `shift+f10` を追加したため（requirements「対象」）。修飾キー無し・shift のみの
  Enter/Space/ArrowDown は、直接のキーの検証（`isDirectChord`）が既に一律拒否しているので、
  この work の変更が無くても direct では割り当てられない（research F6）。`shift+f10` だけは
  `isDirectChord` の一律拒否を素通りする（F キーは shift の有無を問わず direct を通るため。
  research F11）ため、`RESERVED_DIRECT` 側の予約が要る。
- 既に保存済みの設定（`wtm.prefs.v1`）にこの7キーが prefix-後 として、または `shift+f10` が
  直接のキーとして含まれていた場合、`resolveKeymap` の「予約は落として既定へ戻す」既存の挙動
  （`keymap.test.ts:181-193` が示す既存の規則。`RESERVED_AFTER_PREFIX`/`RESERVED_DIRECT` に
  載っている chord は読み込み時に自動的に除外される）がそのまま働く——新しいコードパスを
  足す必要は無い。

## ドメイン固有の考慮

- herdr 本体にはこの制約は無い（web-tn-multiplexer 固有の GUI 要素である pane の枠の
  メニューボタンに由来する予約）。`docs/herdr-parity.md` の更新は不要（キー割り当ての
  対応表に載る性質の差分ではない）。

## エラー処理 / 異常系

- 該当なし（`assign.ts` の既存の分岐がそのまま処理するため、新しいエラーパスは追加しない）。

## 受け入れ基準との対応

- AC1: `enter` を prefix の後のキーとして割り当てようとすると、`validateAssignment` が
  `RESERVED_AFTER_PREFIX.get("enter")` の理由文字列を返し拒否される。単体テストで
  `assign.test.ts` に `validateAssignment(DEFAULT_KEYMAP, after("goto"), key({ key: "Enter" }))`
  の `reason` を確認するテストを足し、`keymap.test.ts:245` と同型の
  `resolveKeymap`（予約された chord が読み込み時に落ちて既定へ戻ることの確認）も足す。
- AC2: 同様に `space`（`key({ key: " " })`）を `assign.test.ts`・`keymap.test.ts` の両方で確認する。
- AC3: 同様に `down`（`key({ key: "ArrowDown" })`）を `assign.test.ts`・`keymap.test.ts` の
  両方で確認する。
- AC4: 既存の `esc` 拒否テスト（`assign.test.ts:217-224`）・`ctrl+shift+v` 拒否テスト
  （prefix の後: `assign.test.ts:226-236`・直接: `assign.test.ts` の "(f) ctrl+shift+v は
  貼り付けに使うので拒否する"）・`keymap.test.ts:245` の予約テストが、`RESERVED_DIRECT` の
  `Set`→`Map` 型変更後も無改修のまま通ることで確認する（回帰なし。理由文言も変わらない）。
- AC5: 直接のキー（prefix 無し）の割り当てに関する既存テスト（`assign.test.ts` の direct 系
  テスト）が、`shift+f10` 関連（AC7）を除き無改修のまま通ることで確認する。
- AC6（review round1 で追加）: `shift+enter`・`shift+space`・`shift+down` を同様に
  `assign.test.ts`（`key({ key: "Enter", shift: true })` 等）・`keymap.test.ts`
  （`resolveKeymap` に `prefix+shift+enter` 等を含む `bindings` を渡す）の両方で確認する。
- AC7（T1 round2 taskcheck で追加）: `shift+f10` を prefix の後のキー（`assign.test.ts` に
  `key({ key: "F10", shift: true })` を `after(...)` で検証するテストを追加、`keymap.test.ts`
  の `resolveKeymap` 回帰テストへ `prefix+shift+f10` を追加）・直接のキー（`assign.test.ts` に
  `direct(...)` で検証するテストを追加し、理由が「pane の枠のメニュー」を含み「貼り付け」を
  含まないことを確認、`keymap.test.ts` に `shift+f10` 単独の `resolveKeymap` テストを追加）の
  両方で確認する。
