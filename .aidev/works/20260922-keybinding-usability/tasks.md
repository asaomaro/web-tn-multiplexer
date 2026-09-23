# タスク: キーの設定の使い勝手

## 実装方針

design の「対象範囲」に沿って、まず独立したファイル（`assign.ts`・`chordDisplay.ts`・
`store/settings.ts`）を積み、それに依存する `KeyboardLockController.ts` を続けて積み、最後に
`KeySettings.vue`（4 機能すべての UI を持つ唯一のファイル）へ組み込む。`KeySettings.vue` は
1 ファイルに US1〜US4 の UI が集まるため、このファイルへの変更だけは 2 タスクに分けて直列に積む
（同時並行にすると差分が競合する）。

## 作業順序と依存関係

- T1（`assign.ts`）・T2（`chordDisplay.ts`）・T3（`store/settings.ts`）は互いに対象ファイルが
  重ならないので並行できる。
- T4 は T3（`keyboardLockInFullscreen` の型）に依存。T5 は T4 に依存。
- T6（`KeySettings.vue` の US1・US2）は T1 の `conflict` フィールドに依存。
- T7（`KeySettings.vue` の US3・US4）は T2・T3 に依存し、かつ T6 と同じファイルを触るため T6 の後。
- T8（E2E）は T5・T7（配線が全部終わったあと）に依存。

## リスク / 留意点

- US3（`getLayoutMap`）・US4（`keyboard.lock`）は Chromium 系限定・実験的 API で、この開発環境
  （Linux headless Chromium）では使えない可能性が高い。単体テストは `LayoutMap`/`keyboard` を
  **モックのインターフェースで差し替えて**検証し（design のインターフェースがそのために
  `getLayoutMap`ではなく最小限の `LayoutMap`/`keyboard` 型を受け取る形にしてある）、E2E は
  「API が無い環境でも switch が出て、有効にしても壊れない」という feature-detect 側の経路を
  確認する（T8(c)。AC9・AC14 が対象）。API が実際に効く経路（AC8・AC12・AC13 の中核）は
  `docs/verification.md` の手動確認へ回す。
- `KeySettings.vue` は T6・T7 の 2 段階で触るため、T6 の完了後に一度 `pnpm exec vitest run` で
  緑を確認してから T7 に進む（間に壊れた状態を残さない）。
- `.aidev/conventions/regression-negative-control.md`・`.aidev/conventions/e2e-observe-browser.md`
  に従う（既存 work と同じ）。

## テスト方針

- 単体（vitest）: 各新規・変更ファイルにテストを添える（`assign.test.ts`・`chordDisplay.test.ts`
  〔新規〕・`settings.test.ts`・`KeyboardLockController.test.ts`〔新規〕・`KeySettings.test.ts`）。
- E2E（playwright）: `key-bindings.spec.ts` に追加。判定はブラウザの観測で行う
  （`.aidev/conventions/e2e-observe-browser.md`）。
- E2E は着手した spec だけをその都度実行し、test 工程の最後に一式を 1 回回す。

## タスク

- [x] T1: `assign.ts` の `AssignResult` に `conflict` フィールドを足す（design「US2」のコード例
      どおり）。`validateBinding` の `owner !== id` 分岐（`:168-172`）で、`km.bindingsOf(owner)`
      に単一形の binding 文字列が含まれるときだけ `conflict` を付ける。単体テストを足す：
      (a) 別の操作の単一の割り当てと衝突したとき `conflict` が付く、(b) 範囲の操作
      （`switch_tab`）の一部と衝突したときは `conflict` が付かない（design の該当判定）、
      (c) 既存のテスト（衝突時の `reason` 文言）が変更後も全て通る（回帰なし）。
      対象: `packages/web/src/keys/assign.ts:111-177`・`packages/web/src/keys/assign.test.ts`
      依存: なし
      AC: AC4, AC7

- [x] T2: `packages/web/src/keys/chordDisplay.ts`（新規）に `LayoutMap` 型と `displayBinding()`
      を実装する（design「US3」のコード例どおり）。単体テストを足す：
      (a) `layoutMap` が null のとき元の binding をそのまま返す（AC9）、
      (b) `alt` を含む英字 1 文字の binding で、layoutMap が別の文字を返すとき置き換わる（AC8）、
      (c) `ctrl`/`cmd` を含む・英字 1 文字でない binding は対象外で元のまま、
      (d) `chordDisplay.ts` は取り込み・照合に関わる関数（`chordOf`・`recoverOptionKey`・
      `validateAssignment`/`validateBinding`）を一切 import していないこと（`parseBinding`・
      `parseChord`・`formatChord`・`formatBinding` は読み取り用の純粋関数として使ってよい。
      design の AC10 の対応どおり。import 文を確認する形でよい）。
      対象: `packages/web/src/keys/chordDisplay.ts`（新規）・
      `packages/web/src/keys/chordDisplay.test.ts`（新規）
      依存: なし
      AC: AC8, AC9, AC10

- [x] T3: `store/settings.ts` に `keyboardLockInFullscreen`（boolean・既定 `false`）を、
      `statusSymbols` と同じ形（`loadKeyboardLockInFullscreen`・`ref`・
      `setKeyboardLockInFullscreen`）で足す。`statusSymbols` 自体には専用の `storage` イベント
      追従が無い（decisions D4。それを持つのは `keys` だけ）ので、`keyboardLockInFullscreen` にも
      追加しない。単体テストを足す：既定値・setter の反映と永続化（既存の `statusSymbols` の
      テストと同じ形）。
      対象: `packages/web/src/store/settings.ts:31-32,76,102-105`（アンカー）・
      `packages/web/src/store/settings.test.ts`
      依存: なし
      AC: AC11

- [x] T4: `packages/web/src/keys/KeyboardLockController.ts`（新規）を design の「US4」のコード例
      どおりに実装する（`LOCKED_CODES`・`KeyboardLockControllerOptions`・
      `KeyboardLockController`）。単体テストを足す：`doc`/`keyboard`/`settings` を偽物に差し替えて
      (a) `keyboardLockInFullscreen=true` かつ `fullscreenElement` があるとき `lock()` が
      `LOCKED_CODES` の内容で呼ばれる（AC12）、(b) `fullscreenElement` が無くなると `unlock()` が
      呼ばれる（AC13）、(c) `keyboard` が `null` のときは何も呼ばない・例外を投げない（AC14）、
      (d) `keyboard.lock`/`unlock` が reject/throw しても `sync()` 自体は例外を投げない（AC14）、
      (e) `stop()` の後は `fullscreenchange`/`watch` に反応しない。
      対象: `packages/web/src/keys/KeyboardLockController.ts`（新規）・同 `.test.ts`（新規）・
      参考: `packages/web/src/theme/ThemeController.ts`（同型）
      依存: T3
      AC: AC12, AC13, AC14, AC-I12

- [x] T5: `main.ts` に `KeyboardLockController` の生成・`start()` 呼び出しを足す
      （`ThemeController` と同じ箇所、`app.mount` より前）。`navigator.keyboard` の
      feature-detect（design のコード例どおり）。配線の接続確認が目的で、判定ロジック自体の
      単体テストは T4 で担保済みなので、ここでは `main.ts` が正しく生成・起動していることを
      確認する程度でよい。
      対象: `packages/web/src/main.ts:159-172`（`ThemeController` のアンカー）
      依存: T4
      AC: AC12, AC13, AC14

- [x] T6: `KeySettings.vue` に US1（絞り込み）・US2（こちらへ移す）を design のコード例どおりに
      実装する：`filterText`・`actionsByGroup` の拡張・絞り込み `<input>`（design が示す位置：
      `.keys-prefix` の直後、群の一覧より前）・`pendingMove`・`moveHere()`・
      `onCaptureKeydown` の `conflict` 分岐・「こちらへ移す」ボタン（`data-move-here`）。
      `KeySettings.test.ts` に新規テストを足す：
      (a) 絞り込み欄は最初から（開閉操作なしで）表示され、一致する操作だけが残る・大小無視
      （AC1・AC-I1）、
      (b) 0 件の群は見出しごと消える（AC2）、
      (c) 入力を空にすると全部戻る（確定操作を経ない即時反映。AC3・AC-I2）、
      (d) 絞り込み中もフォーカスが `<input>` に残る（AC-I4）、
      (e) 取り込み待ち（`.keys-capture` が出ている間）は絞り込み欄の `keydown` が取り込みハンドラに
      奪われない・絞り込み欄への入力が取り込み待ちの状態を変えない（AC-I5）、
      (f) 衝突が無い通常の状態では「こちらへ移す」ボタンが存在せず、衝突したときだけ現れる
      （AC4・AC-I6）、
      (g) 押すと確認ダイアログを挟まずその場で衝突相手から外れ対象へ移り、フォーカスが
      新しい割り当ての［変更］へ行く（AC5・AC-I7・AC-I9）、
      (h) 使わずに別の取り込みを始める・ダイアログを閉じると消え、何も変わらない（AC6）、
      (i) prefix 自身との衝突・範囲の操作との衝突では出ない（AC7）、
      (j) Tab だけで絞り込み欄・「こちらへ移す」ボタンに到達できる（AC-I3・AC-I8）、
      (k) 「こちらへ移す」ボタンを足しても、既存の［変更］［削除］［追加：prefix の後］
      ［追加：直接］の各ボタンの `data-*` 属性・並び順は変わらない（AC-I10）。
      対象: `packages/web/src/components/KeySettings.vue`・
      `packages/web/src/components/KeySettings.test.ts`
      依存: T1
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5, AC-I6, AC-I7, AC-I8, AC-I9, AC-I10

- [x] T7: `KeySettings.vue` に US3（macOS 表示補正）・US4（Keyboard Lock の switch）を
      design のコード例どおりに実装する：`onMounted` での `layoutMap` の取得（`isMacPlatform()`
      かつ `getLayoutMap` が関数のときだけ、try/catch）・`bindingsText`/`summaryText` を
      `displayBinding()` 経由に変更・Keyboard Lock の switch（`settings.keyboardLockInFullscreen`
      を表示・切り替え）。`KeySettings.test.ts` に新規テストを足す：
      (a) `layoutMap` を偽物に差し替えたとき、`alt` を含む binding の表示が置き換わる（AC8）、
      (b) `layoutMap` が無い・`getLayoutMap` が無い・reject するときは元の表示のまま（AC9）、
      (c) 表示が変わっても `settings.keyPrefs`/`keymap.bindingsOf` の実際の値（保存・照合に
      使う文字列）は変わらない（AC10）、
      (d) switch の初期状態・切り替えが `settings.keyboardLockInFullscreen` に反映される
      （AC11）、
      (e) 説明文言に「全画面」「対応ブラウザ」の語を含む（AC-I11）。
      対象: `packages/web/src/components/KeySettings.vue`・
      `packages/web/src/components/KeySettings.test.ts`
      依存: T2, T3, T6
      AC: AC8, AC9, AC10, AC11, AC-I11

- [x] T8: E2E `key-bindings.spec.ts` に新規テストを足す：
      (a) 絞り込み欄に文字を打つと一致する行だけが見える・空にすると戻る（AC1〜AC3。
      `.keys-details` の数を数える、`.aidev/conventions/e2e-observe-browser.md` に従い DOM で
      判定）、
      (b) 衝突を起こして「こちらへ移す」を押すと、衝突相手の割り当てが外れ対象へ移ることを
      `.keys-bindings` の表示で確認する（AC4・AC5）、
      (c) Keyboard Lock の switch を有効にしても、全画面でなければ既存のキー操作
      （`prefixKey` 経由の分割等）が壊れないことを確認する（AC-I12）。この E2E 環境
      （Linux headless Chromium）は `navigator.keyboard.lock`/`getLayoutMap` を持たない
      見込みが高く、この (c) は**その「API が無い環境」を実地で踏む**ことになるので、
      switch を有効にしても例外でページが壊れないこと（AC14）・節「キー」の表示が今までどおり
      であること（AC9）も合わせて確認する。**API が実際に効く経路**（全画面での `lock()`・
      macOS での `getLayoutMap` の置き換え。AC8・AC12・AC13 の中核）はこの環境では検証できず、
      `docs/verification.md` の手動確認へ回す（decisions に理由を残す）。
      対象: `packages/e2e/src/specs/key-bindings.spec.ts`
      依存: T5, T7
      AC: AC1, AC2, AC3, AC4, AC5, AC9, AC14, AC-I3, AC-I8, AC-I12
