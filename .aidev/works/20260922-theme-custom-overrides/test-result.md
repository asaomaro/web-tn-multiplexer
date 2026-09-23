# テスト結果: 色の個別の上書き（20260922-theme-custom-overrides）

## 実行したもの

すべて `/workspaces/web-tn-multiplexer`（WSL の Linux・Chromium）。**判定は終了コード**で行った。
この work の test は **2 回**行った——1 回目：review の前／2 回目：review ラウンド 1 の指摘 4 件（should 1・nit 3。すべて
文言・並び順・重複呼び出しの整理で、振る舞いは変えていない）を直したあと。**下は 2 回目（最終の木）**。

- `pnpm exec vitest run`（web）— **78 files / 1508 tests passed / 0 failed**（1 回目は protocol・server も含む全体で
  132 files / 2181 tests passed。2 回目の直しは web だけなので web だけ回した）
- `pnpm typecheck`・`pnpm lint`・`pnpm build` — いずれも exit 0
- `theme-settings.spec.ts`（影響する spec）— **12 passed / 0 failed**（58.2 秒）。**一式（120 本）は 1 回目の木で通っている**
  （少しの修正ごとに一式は回さない方針）
- `aidev smoke` — pass（1・2 回目とも）

```
$ pnpm exec vitest run   （web。2 回目）
 Test Files  78 passed (78)
      Tests  1508 passed (1508)
exit=0
```

**1 回目**：単体（全体）2181・E2E 一式 120 passed（10.2 分）・smoke pass。

## 受け入れ基準ごとの判定

- AC1: pass — `SettingsDialog.vue` の折りたたみに 19 個の CSS 変数 × 2（明るいとき・暗いとき）の入力欄（`SettingsDialog.test.ts`
  「折りたたみ…19 個の CSS 変数」・E2E「色を上書きすると…」）
- AC2: pass — `ThemeController.computeVars`／`mergeVars` がコントラスト調整後の値にそのまま重ねる（`ThemeController.test.ts`
  「上書きは、コントラスト調整済みの計算結果の上にそのまま当たる」・E2E で `getComputedStyle` を確認）
- AC3: pass — `colorScheme` で層を選ぶ（`themeAuto` は見ない）。`ThemeController.test.ts`「auto が切のまま…明るいときの
  上書きが効く」・E2E「『明るいとき』『暗いとき』は…」
- AC4: pass — テーマを替えても上書きは残り、新しい `colorScheme` の層に切り替わる（同上のテスト・E2E で dracula→one-light→dracula
  を確認）
- AC5: pass — `isValidCssColor`（`style.color` 方式）で拒否し、理由を示して元の値へ戻す（`themeOverrides.test.ts`・
  `SettingsDialog.test.ts`・E2E「妥当でない値は理由を示して拒否し…」）
- AC6: pass — 色ごとの「既定に戻す」（`resetThemeOverride`）。ボタンは上書き中だけ表示・フォーカスは同じ行の入力欄へ
  （`SettingsDialog.test.ts`・E2E）
- AC7: pass — 「すべての上書きを既定に戻す」は確認を挟み、戻すとすべて消え `wtm.prefs.v1` から `themeOverrides` が消える
  （`store/settings.test.ts`・`SettingsDialog.test.ts`・E2E「すべての上書きを既定に戻す…」。E2E は既定値そのものとの一致まで確認）
- AC8: pass — 既定との差だけを保存し、壊れた値は値ごとに落とす（`themeOverrides.test.ts`・`store/settings.test.ts`）。別の
  ウィンドウの `storage` イベントにも追従する
- AC9: pass — `writeBoot`／`bootVars` が保存された（`readPrefs()` の）上書きを含めて控えを作る（`ThemeController.test.ts`
  「控え（writeBoot）にも上書きが入る」「控えの上書きも保存された設定から作る」・E2E「再読み込みでも最初から当たる」）
- AC10: pass — `docs/herdr-parity.md`（H24b）・`docs/verification.md`（機能の説明・手で確かめる項目・既知の制約）を更新
- AC11: pass — `.aidev/backlog/product-roadmap.md` の該当行を `[x]`（根拠つき）
- AC12: pass — `CSS_VAR_LABELS`（19 個の日本語の短い説明）を各行に表示（型で 19 個の網羅を強制。`themeOverrides.test.ts`）
- AC-I1: pass — `<details>`（既定は閉じている。標準の開閉）
- AC-I2: pass — 確定は `change`／`Enter`。「すべて既定に戻す」はインライン確認
- AC-I3: pass — `SettingsDialog.test.ts`「キーボードだけで通せる」（Tab で辿り、Enter で確定・確認・戻す）
- AC-I4: pass — 確定時はフォーカスを動かさない。「既定に戻す」を押すとボタンが消え、同じ行の入力欄へ移る
- AC-I5: pass — 設定画面は既存のダイアログ（`view.openDialog`）に乗るだけで、この画面のキー操作を新たに横取りしない
  （既存の入力欄と同じ配線。単体レベルでは検証できないため、この点は design・decisions に明記し、E2E は「設定画面の上の
  キーは…漏れない」という既存のテスト（このファイルの既存テスト）が同じ配線を検証している）

## 失敗の証跡

**このラウンドでは、テストが落ちて coding へ差し戻す事態は起きていない**（一式が通った）。以下は `regression-negative-control`
に従う**負の確認**（配線を壊す→落ちる→戻す→`cmp`）の生出力。coding 中に行った各タスクの点検（T1〜T6。`review.md`「タスク点検
ログ」参照）に加え、test 工程では**結線（wiring）レベル**の確認を行った。

### `ThemeController.start()` の `themeOverrides` の watch を外す（画面の反映が止まる）

`packages/web/src/theme/ThemeController.ts` の `stopOverrides` の watch を外してビルドし直し、E2E で確認：

```
  ✘  1 src/specs/theme-settings.spec.ts:474:1 › 色を上書きすると、その場で画面の枠に反映され、再読み込みでも最初から当たる（ちらつかない。AC1・AC2・AC9） (2.2s)
    Error: 確定した瞬間に反映
    Expected: "#ff00ff"
    Received: "#6070a1"
    > 483 |   expect(await computedAccent(o.page), "確定した瞬間に反映").toBe("#ff00ff");
  1 failed
```

（戻したあと `cmp` で元と一致、ビルドし直して exit 0）

### store の `return` から `themeOverrides` を落とす（コンポーネントが参照できなくなる）

`packages/web/src/store/settings.ts` の `return {...}` から `themeOverrides` を外して typecheck：

```
src/components/SettingsDialog.test.ts(640,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(653,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(655,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(657,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(666,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(681,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(694,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(710,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(715,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(745,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.test.ts(752,21): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref
src/components/SettingsDialog.vue(255,74): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; n
src/components/SettingsDialog.vue(260,19): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; n
src/components/SettingsDialog.vue(276,41): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; n
src/store/settings.test.ts(445,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(451,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(454,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(460,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(469,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(477,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(515,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(516,28): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/store/settings.test.ts(518,18): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdPo
src/theme/ThemeController.ts(91,22): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwdP
src/theme/ThemeController.ts(111,42): error TS2551: Property 'themeOverrides' does not exist on type 'Store<"settings", Pick<{ statusSymbols: Ref<boolean, boolean>; scrollback: Ref<ScrollbackPref, ScrollbackPref>; newCwd
```

（`SettingsDialog.vue`・`SettingsDialog.test.ts`・`store/settings.test.ts`・`ThemeController.ts` の計 25 箇所で型エラー
（`themeOverrides` を参照している全箇所。上の出力は先頭 25 行）。戻したあと `cmp` で元と一致、typecheck exit 0 を確認）

**この負の確認では、いずれも意図した変異で落ちることを確認した**（生出力のとおり）。

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260922-theme-custom-overrides
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45679 (state dir /tmp/wtm-smoke-KwW9nl)
{"ts":"2026-09-22T02:36:17.962Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
smoke exit=0
```

**この work は新しい入口（サブコマンド・オプション・API）を足していない**（web の画面と、ブラウザ内のテーマの適用経路だけ。
サーバ・protocol は無変更）ので、`smokeCommands` への追加は無し。

## 未検証の穴（skip / 環境不足）

自動のテストは **Linux の Chromium だけ**。次は実機・別ブラウザで確かめていない（`docs/verification.md` の既知の制約に
既存の記載があるものと同じ範囲。deliver の PR 本文へ引き継ぐ）。

- **Firefox・Safari・macOS・Windows**：この work は既存の `<input type="text">`・`<details>`・ネイティブの確認ダイアログの
  組み合わせのみで、20260921-theme-settings・20260921-keybinding-customization が既に洗い出した環境差（ブラウザが描く
  入力欄の見た目・ネイティブ `cancel` の順序等）と同じ範囲に留まる。個別の新しい環境差は増えていない（判断であり、実機の
  確認はしていない）。
- E2E の一式は 1 回目の木で実行した（120 本）。review の直しのあと（文言・並び順の整理のみ）は影響する 1 spec（12 本）だけ回した
  （少しの修正ごとには一式を回さない方針）
