# タスク: キー割り当てを変え、prefix を使わない直接のキーも使えるようにする（herdr のキー設定）

## 実装方針

下から積む。**純粋な部品（chord・カタログ・保存・解決・検証・戻し）を先に作って単体テストで固め**、そのあと Router・入力の入口・store・main の結線、
画面（節「キー」・キー一覧・トースト・通知の案内・モバイル）、E2E、文書の順。純粋な部品は DOM にも Vue にも依存しないので、環境差（Option・AltGr）や衝突の規則は
ここで合成イベントとテーブルで守る。**Router の置き換え（T7）は既存テスト約 45 か所が依存する `DEFAULT_KEYMAP` の型に触れる**が、名前を残して解決した既定の表を指すようにするので、
その約 45 か所は**書き換えず、変わらずに通ることを確かめる**（書き換えるのは `comboKey` の単体テストだけ）。

## 作業順序と依存関係

下の `依存:` に従う。ほかに次の順序の理由がある。

- **T4 は旧 `DEFAULT_KEYMAP`（Map）を残したまま、解決した既定の表を `DEFAULT_RESOLVED_KEYMAP` として足す**。旧表と 1:1 であることは T4 のテストで**旧表を固定したリテラル**と比べて守る
  （T7 で旧表を置き換えた後では比べる相手が無い）。T7 で `DEFAULT_KEYMAP` を解決した表に置き換え、`HelpDialog.vue:30` の 1 行（`DEFAULT_KEYMAP.get`）も同時に直す
  （全面の書き換えは T13）。これで **T4〜T13 のどの時点でも型が通る**。
- **T1 に `keyInputOf`（DOM のイベント → `KeyInput`。今の `toKeyInput`）と `isDirectChord`（「ctrl・alt・cmd を含む chord か F キー」の判定）を置く**。取り込み（T11）・入口（T8）が同じ変換を使い、
  T3（保存の検証）・T4（予約）・T5（取り込みの検証）が同じ判定を使う（規則を 1 か所に集める）。
- T5（検証）と T6（戻し・おすすめ）は T4 の後・Router より前に置ける純粋な部品（依存は T4・T5 だけ）。
- T11（節「キー」の取り込み）は T5・T9 が固まってから。戻し・おすすめの画面（T12）はその上に足す。
- T15（E2E）は `pnpm build` した dist で走る。ここで初めて、実ブラウザ（Chromium）でのフォーカスの戻り・Esc・実際のキー入力の経路（xterm・window）が確かめられる。
- T17（文書）の H26・H12 の行は、T16（backlog）で決める項目名を指すので、T16 の後。

## リスク / 留意点

- **押すたびの経路（`KeyRouter.handle`）に手を入れる**。`chordOf` は文字列 1 つ・`Map` 2 回だけにし、`ResolvedKeymap` は割り当てが変わったときに 1 回だけ作って渡す（押すたびに作り直さない）。
- **既存テストが多い**（`new KeyRouter(DEFAULT_KEYMAP, …)` が約 45 か所）。名前を残すので書き換えない。書き換えるのは `comboKey` のテスト・`HelpDialog.test.ts`・`SettingsDialog.test.ts` の節の数・E2E `settings.spec.ts` の節の数だけ。
- **環境差は実機で確かめられない**（Option・AltGr・Firefox・Safari）。合成イベントの単体テストと verification.md の手の確認に分ける。
- **取り込み待ちのキーが漏れる**（Esc でダイアログが閉じる・prefix に入る）。Chromium の実測（research F25）を E2E で再現して守る。
- **保存値の互換**：`wtm.prefs.v1` の `keys` は新しい項目。無ければ既定。読み込みは値ごとに落とす。

## テスト方針

- 単体（vitest）：chord・カタログ・保存・解決・検証・戻し・Router・Controller・store・`KeySettings`・`HelpDialog`・`Toast`・通知の案内・`ExtraKeys`。
  **旧 `DEFAULT_KEYMAP` を固定したリテラルとの一致**（AC1・AC2）、**AC6 の (a)〜(g)**、**壊れた保存値**（AC8）を表で網羅する。
- E2E（Playwright・Chromium・ビルドした dist）：prefix の変更・割り当ての追加・置き換え・削除・直接のキー・衝突の拒否・保存（再読み込み）・操作ごと／すべて戻す・おすすめの一式・キー一覧・
  取り込み待ちの Esc・キーボードだけで通す・フォーカスの戻り・モバイルの Prefix ボタン。影響する spec だけを回す。
- **一式（単体・E2E）は test 工程の最後に 1 回**（deliver 直前を兼ねる）。あわせて smoke と、結線を 1 本ずつ外して落ちることを確かめる負の確認（`regression-negative-control` の流儀）。
  受け入れ基準ごとの判定は `test-result.md` に書く。

## タスク

- [x] T1: chord の文法・変換・判定（`keys/chord.ts`）と `KeyInput` の拡張
      対象: 新規 `packages/web/src/keys/chord.ts`・新規 `packages/web/src/keys/chord.test.ts`・`packages/web/src/keys/actions.ts:9-18`（`altGraph?`・`repeat?` を足す）。
      `chordOf`・`parseChord`/`formatChord`・`parseBinding`/`formatBinding`・`expandRange`・`isDirectChord`・`prefixBytes`・`chordToKeyInput`・`isAltGrComposed`（US 配列の小さな表を含む）・`keyInputOf`（今の `toKeyInput`。
      移す元 `packages/web/src/keys/KeyInputController.ts:24-49`）。置き換える元の規則 `packages/web/src/keys/KeyRouter.ts:41-48`（`comboKey`）。 根拠: design「chord の文法」・D3・D4・D5・D6
      依存: なし
      AC: AC2, AC3, AC5, AC6, AC7
- [x] T2: 操作のカタログ（`keys/bindings.ts`。34 個・既定の割り当て・表示名・群）
      対象: 新規 `packages/web/src/keys/bindings.ts`・新規 `packages/web/src/keys/bindings.test.ts`（id の重複なし・既定が `parseBinding` を通る・34 個）。元の旧表 `packages/web/src/keys/keymap.ts:23-67` と `Action` の型 `packages/web/src/keys/actions.ts:37-60`。 根拠: design「操作のカタログ」
      依存: T1
      AC: AC1, AC2, AC4, AC7
- [x] T3: 保存の読み書き（`keys/keyPrefs.ts`。`loadKeyPrefs`・`serializeKeyPrefs`）
      対象: 新規 `packages/web/src/keys/keyPrefs.ts`・新規 `packages/web/src/keys/keyPrefs.test.ts`（壊れた値を値ごとに落とす・全部落ちたら既定へ・`[]` は割り当てなし）。読み込みの流儀 `packages/web/src/store/settings.ts:17-60`・`packages/web/src/store/view.ts:50-70`。 根拠: design「保存」・D2・D7
      依存: T1, T2
      AC: AC8
- [x] T4: 解決した表（`keys/keymap.ts`。`resolveKeymap`・`ResolvedKeymap`・`DEFAULT_RESOLVED_KEYMAP`）
      対象: `packages/web/src/keys/keymap.ts`（`resolveKeymap` を足す。**旧 `DEFAULT_KEYMAP` は T7 まで残す**）・新規 `packages/web/src/keys/keymap.test.ts`
      （**旧表を固定したリテラルとの一致**＝AC1・AC2 の主な守り・上書きが既定に勝つ・衝突の落とし方・範囲・`NOT_YET`・予約）。 根拠: design「解決した表」・D7
      依存: T1, T2, T3
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8
- [x] T5: 取り込みの検証（`keys/assign.ts` の `validateAssignment`）
      対象: 新規 `packages/web/src/keys/assign.ts`・新規 `packages/web/src/keys/assign.test.ts`（AC6 の (a)〜(g)・prefix にできない形・範囲・shift 付きの数字・修飾キー単体は `ignore`）。 根拠: design「取り込みの検証」
      依存: T4
      AC: AC3, AC4, AC6, AC7
- [x] T6: 戻しとおすすめ（`keys/assign.ts` の `planReset`・`RECOMMENDED_DIRECT`・`applyRecommended`）
      対象: `packages/web/src/keys/assign.ts`・`packages/web/src/keys/assign.test.ts`。 根拠: design「おすすめの直接のキー」「戻し方」
      依存: T5
      AC: AC9, AC10
- [x] T7: Router を解決した表で動かし、直接のキーを引く（`KeyRouter.ts`）。旧 `comboKey` と旧 `DEFAULT_KEYMAP`（Map）を置き換える
      対象: `packages/web/src/keys/KeyRouter.ts:41-160`（`setKeymap`・`prefixKeyInput()` を足す）・`packages/web/src/keys/keymap.ts`（旧 `DEFAULT_KEYMAP`〔Map〕を削除し、`DEFAULT_RESOLVED_KEYMAP` を `DEFAULT_KEYMAP` に改名する）・
      `packages/web/src/components/HelpDialog.vue:30`（`DEFAULT_KEYMAP.get` の 1 行だけ）・`packages/web/src/keys/KeyRouter.test.ts:47-54`（`comboKey` のテストを `chordOf` へ）と、直接のキー・prefix の変更・`repeat` の新しいテスト。
      `new KeyRouter(DEFAULT_KEYMAP` の約 45 か所のテストは**書き換えず、通ることを確かめる**。 根拠: design「Router」・D3・D4
      依存: T4
      AC: AC2, AC3, AC4, AC5, AC11, AC12
- [x] T8: 入力の入口（`KeyInputController.ts`）：`keyInputOf` を使い、`altGraph`・`repeat` を渡す。`injectPrefix()`
      対象: `packages/web/src/keys/KeyInputController.ts:24-49`（`toKeyInput` を `keyInputOf` に置き換え・`KeyboardEventLike` を chord.ts から再エクスポート）・`:162-176`（`injectKey`。`injectPrefix()`＝`injectKey(router.prefixKeyInput())`）・
      `packages/web/src/keys/KeyInputController.test.ts`。 根拠: design「`KeyInput` の拡張」・案内の追従
      依存: T1, T7
      AC: AC3, AC5, AC11
- [x] T9: store（`store/settings.ts`）に `keyPrefs`・`keymap`・setter を足し、保存する
      対象: `packages/web/src/store/settings.ts:57-140`（`useSettingsStore`）・`packages/web/src/store/settings.test.ts`。 根拠: design「store」・D2
      依存: T3, T4
      AC: AC3, AC4, AC8, AC9
- [x] T10: `main.ts` の結線（Router を `settings.keymap` で作り、変わったら `setKeymap`。macOS のとき `setOptionComposes(true)`）
      対象: `packages/web/src/main.ts:55-59,98-103`。 根拠: design「Router」
      依存: T7, T8, T9
      AC: AC3, AC5, AC8
- [x] T11: 節「キー」の取り込み（`components/KeySettings.vue`）と設定画面への組み込み（取り込み待ち・focus の戻し・`@cancel` の抑止・5 節）
      対象: 新規 `packages/web/src/components/KeySettings.vue`・新規 `packages/web/src/components/KeySettings.test.ts`・`packages/web/src/components/SettingsDialog.vue:235-239,344-356`（`onNativeCancel`・節の並び）・
      `packages/web/src/components/SettingsDialog.test.ts:257-270`（「4 つの節」→ 5 節）。prefix の行・操作ごとの `<details>`・割り当ての［変更］［削除］［追加：prefix の後］［追加：直接］・結果の `role="status"`。 根拠: design「取り込み」「節「キー」の構成」・D9
      依存: T5, T9
      AC: AC1, AC3, AC4, AC5, AC6, AC7, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
- [x] T12: 節「キー」の戻しとおすすめ（［既定に戻す］操作ごと・prefix・すべて＋インライン確認・おすすめの一式・モバイルの一言）
      対象: `packages/web/src/components/KeySettings.vue`・`packages/web/src/components/KeySettings.test.ts`。 根拠: design「戻し方」「おすすめの直接のキー」・D10・D11
      依存: T6, T11
      AC: AC9, AC10, AC-I2
- [x] T13: キー一覧を現在の割り当てから作る（`HelpDialog.vue`）
      対象: `packages/web/src/components/HelpDialog.vue:3,28-95`（`HELP_GROUPS`・`notYet`。「後続」の行はキーが notYet のままのときだけ・prefix の行）・`packages/web/src/components/HelpDialog.test.ts`。 根拠: design「案内の追従」・D8
      依存: T4, T7, T9
      AC: AC2, AC11
- [x] T14: トースト・通知の案内文・モバイルの Prefix ボタンを追従させる
      対象: `packages/web/src/components/Toast.vue:33-40`・`packages/web/src/components/Toast.test.ts`・`packages/web/src/notify/NotificationController.ts:33,310`・`packages/web/src/notify/NotificationController.test.ts`・
      `packages/web/src/mobile/ExtraKeys.vue:71-74`・`packages/web/src/mobile/ExtraKeys.test.ts`。 根拠: design「案内の追従」
      依存: T8, T9
      AC: AC11
- [x] T15: E2E（`key-bindings.spec.ts`）と、節の数が変わる既存の spec の更新
      対象: 新規 `packages/e2e/src/specs/key-bindings.spec.ts`・`packages/e2e/src/specs/settings.spec.ts:258,300`（「4 節」→ 5 節）・`packages/e2e/src/support/keys.ts:11-15`（`prefixKey`。既定のまま）。 根拠: 節「テスト方針」・design「受け入れ基準との対応」
      依存: T10, T11, T12, T13, T14
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC8, AC9, AC10, AC11, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
- [x] T16: 見送った項目の起票と、元の項目の分割（backlog）
      対象: `.aidev/backlog/product-roadmap.md:11`（「キーバインドのカスタマイズ」。割り当ての変更・保存は済んだ分として割る）と、末尾の新規項目（navigate の移動キー・herdr にあって本製品に無い操作・独自コマンドのキー・herdr 以外のプリセット）。 根拠: requirements「スコープ / 対象外」
      依存: なし
      AC: AC14
- [x] T17: 文書（`docs/herdr-parity.md` H26・H12・`docs/verification.md`）
      対象: `docs/herdr-parity.md:35,51`（H12 の行は、参照先の backlog 項目が割れる〔T16〕ので新しい項目名に付け替える。H26 の行を更新）・`docs/verification.md`。 根拠: research F1〜F11b・design「ドメイン固有の考慮」
      依存: T12, T16
      AC: AC13
- [x] T18: 全体の回帰（単体・E2E の一式・smoke）と負の確認 — **test 工程で消化する**（coding では実行しない）
      対象: 未特定（実行のみ。新しいコードは書かない）。 根拠: 節「テスト方針」・decisions D3
      依存: T15, T16, T17
      AC: AC12
