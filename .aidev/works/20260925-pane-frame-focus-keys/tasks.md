# タスク: pane の枠にフォーカスがある間の prefix・後のキーの割り当てを保護する

## 実装方針

design の対象範囲は `packages/web/src/keys/keymap.ts`（`RESERVED_AFTER_PREFIX` への7エントリ
追加、`RESERVED_DIRECT` の `Map` 化）・`packages/web/src/keys/assign.ts`（`RESERVED_DIRECT`
参照の書き換え）というプロダクトコード2ファイルと、それを検証する2つのテストファイルへの
回帰テスト追加だけで、依存関係も単純（テストは実装の後）なので、1タスクにまとめて実装＋テスト
を一度に行う（design「対象範囲」参照。4ファイルとも小さな追記のみで、分割してもレビューの
単位が薄くなるだけで得るものが無い）。

## 作業順序と依存関係

下の `依存:` に従う（1タスクのみ）。

## リスク / 留意点

- `RESERVED_AFTER_PREFIX` のコメント（`keymap.ts:32-34`）は現状「`ctrl+shift+v` は
  `KeyInputController` が先取りする」という理由だけを説明しているので、新しい7エントリの
  理由（pane の枠のメニューボタンが先取りする。無修飾・shift 付きの両方。F10 は shift 付きの
  ときだけ）も併記する形に更新する（design「インターフェース / データ構造」参照）。
- `RESERVED_DIRECT` は `shift+f10` のためだけに変更する（`Set`→`Map`。design「対象範囲」・
  AC5・AC7。requirements の当初の「対象外」は誤りだったため訂正済み——research F11・F12）。
- `PaneFrame.vue` の `onKeydown` の判定は `ev.shiftKey` を見ないため、無修飾だけでなく
  shift 付き（`shift+enter`・`shift+space`・`shift+down`）も同じ穴を持つ（review round1の
  指摘。design「設計方針」「依拠する既存の事実」参照）。3キー×2（無修飾/shift）＝6エントリ
  に加え、F10 専用のサブ条件（shift 付きのときだけ発火）ゆえの `shift+f10` を7個目として
  忘れずに足す（T1 round2 taskcheck の指摘）。
- `RESERVED_DIRECT` の型変更に伴い、参照側2か所（`assign.ts:138-139`・`keymap.ts:126-127`）の
  「は貼り付けに使うので」固定文言のハードコードを `.get()` ベースへ書き換える——書き換え
  漏れがあると `shift+f10` の拒否理由が事実と異なる（「貼り付け」）まま出てしまう。

## テスト方針

- `assign.test.ts`: `validateAssignment(DEFAULT_KEYMAP, after("goto"), key({ key: "Enter" }))`・
  `key({ key: " " })`・`key({ key: "ArrowDown" })` の3ケースで `reason` を確認する
  （design「受け入れ基準との対応」AC1〜AC3）。shift 付き（`key({ key: "Enter", shift: true })`
  等）も同様に3ケース確認する（AC6）。`shift+f10` は prefix の後のキー（`after(...)`）と
  直接のキー（`direct(...)`）の両方を確認する——直接のキー側は理由に「pane の枠のメニュー」を
  含み「貼り付け」を含まないことも確認する（AC7）。
- `keymap.test.ts`: `resolveKeymap` に予約された chord（`prefix+enter` 等、shift 付きの
  `prefix+shift+enter` 等も含む）を含む `bindings` を渡し、読み込み時に落ちて既定へ戻ることを
  確認する（既存の `keymap.test.ts:181-193`・`245` と同型。design AC1〜AC3・AC6）。
  `prefix+shift+f10`（既存の shift 付きテストへ追加）と、直接の `shift+f10`（新設テスト）も
  同様に確認する（AC7）。
- 回帰確認: 既存の `esc`（`assign.test.ts:217-224`）・`ctrl+shift+v`（prefix の後:
  `assign.test.ts:226-236`・直接: "(f) ctrl+shift+v は貼り付けに使うので拒否する"）の拒否
  テスト、`keymap.test.ts:245` の予約テストが、`RESERVED_DIRECT` の型変更後も無改修のまま
  通ることを確認する（design AC4）。direct 系の既存テストも `shift+f10` 以外は無改修のまま
  通ることを確認する（design AC5）。

## タスク

- [x] T1: `packages/web/src/keys/keymap.ts` の `RESERVED_AFTER_PREFIX` に `enter`・`space`・
      `down`・`shift+enter`・`shift+space`・`shift+down`・`shift+f10` の7エントリを追加し、
      `RESERVED_DIRECT` を `ReadonlySet<string>` から `ReadonlyMap<string, string>` へ変更して
      `shift+f10` を追加する。`assign.ts` の `RESERVED_DIRECT` 参照（138-139行目）を `.get()`
      ベースへ書き換える。コメントを更新する。`assign.test.ts`・`keymap.test.ts` に回帰確認
      テストを足す。
      対象: `packages/web/src/keys/keymap.ts:32-59`・`packages/web/src/keys/assign.ts:137-139`・
      `packages/web/src/keys/assign.test.ts`・`packages/web/src/keys/keymap.test.ts` /
      根拠: design.md「インターフェース / データ構造」
      依存: なし
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7
