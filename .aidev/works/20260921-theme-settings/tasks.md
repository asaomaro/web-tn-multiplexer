# タスク: テーマを選び、OS の明暗に合わせて切り替える（herdr のテーマ）

## 実装方針

**protocol（色の計算 → テーマの表 → 方式）→ server（受け口 → 答え）→ web（名前の解決 → 画面の枠の色 → 置き換え → 保存 → 端末 →
当てる部品・最初の描画 → 設定の欄）→ 文書 → E2E** の順に積む。規則は 1 か所ずつに置いて単体で総当たりする：色の計算は
`protocol/src/color.ts`、端末の配色の規則は `finalizePalette`、答えの引き方は `answerPaletteFor`、名前の解決は `resolveTheme`、
画面の枠の色は `uiTokens`。**protocol を変えたら `pnpm -C packages/protocol build`**（server・web は `dist` を読む）。
データ（16 テーマの端末の配色・herdr の画面の枠の配色）は配色集・herdr の版を固定したファイルから機械的に書き出した値を貼る
（手で写さない。出典をファイルごとに注記する）。回帰を守るテストは条項 `regression-negative-control` のとおり「直した箇所を戻すと落ちる」
ことを確かめ、生の出力を `test-result.md` に貼る。

## 作業順序と依存関係

下の `依存:` に従う。依存では表せない理由だけ書く。

- **E2E の一式は deliver の直前に 1 回だけ回す**（利用者の指示）。直している間と test 工程では、影響を受ける spec だけ
  （新しい `theme-settings.spec.ts`・`settings.spec.ts`〔設定の節〕・`mobile.spec.ts`〔上のバー・追加のキー〕・`scrollback-copy.spec.ts`〔copy モード〕・
  `keys-mouse-dialogs.spec.ts`〔ダイアログ〕）。

## リスク / 留意点

- **dracula の見た目を変えない**（変えるのは decisions D1〜D3 の 3 か所と、規則をそろえるための例外 D16（サイドバーの「未検証」を薄めずに描く）だけ）。`settings.spec.ts:234` の blocked の色 `rgb(255, 110, 110)` は
  そのまま通ること。`App.vue` の `:root` と `uiTokens("dracula")` の一致は単体テストで守る（design D3）。
- `DEFAULT_THEME` の名前と値は残す（`Mirror.test.ts:27-38` とサーバの既定の答えが使う）。
- `composeServer.ts` は `terminals` を `clients` より先に作る（design D6）。配色を引く関数は「後から埋める箱」越しに渡し、箱が空の間は dracula。
- `public/theme-boot.js` は型の検査の外にある素の JS。明暗の選び方を本体と揃えることは `themeBoot.test.ts` で守る（design D5）。
- 新しい `<select>` は、既存の設定ダイアログの流儀（選んだ時点で反映と保存）に合わせる。IME・Esc の扱いは既存の `@cancel` に任せる。

## テスト方針

- protocol：`color.ts` の計算（既知の比・丸め・`ensureContrast` の不透明度）、`theme.ts` の表（17 個・16 色の形・dracula＝今の値・
  D2 の規則が当たるテーマがちょうど 5 つと 2 つ・明暗の分類が背景の輝度と合う）、`client.theme` のスキーマ。
- server：`answerPaletteFor` の順（権限者 → 表示している人の最新 → dracula）、Mirror が関数の値で答える（問い合わせの瞬間に引く）、
  `client.theme` の受け口と `ClientRegistry.setTheme`。
- web：`resolveTheme`・`lightDarkOf`・`loadThemePrefs`（値ごとの落とし先）、`uiTokens` の全テーマ × design の表の相手（AC9）と
  `App.vue` の `:root` の一致、`ThemeController`（当てる・省略・控えを書く時点・OS の明暗・送り直し）、`theme-boot.js`（控えの選び方・
  壊れた控え・`matchMedia` 無し）、設定の store、`TerminalRegistry.setTheme`、設定ダイアログの欄。
- E2E（`theme-settings.spec.ts`。判定はブラウザ：DOM の計算済みの色・`color-scheme`、ブラウザが受けた画面、クリップボード。条項
  `e2e-observe-browser`）：キーだけでテーマを選ぶ → 画面の枠と端末の背景が替わる、再読み込みの最初の描画、OS の明暗の追従、色の問い合わせの
  答え（research F38 の方法）、入力欄とフォーカスの枠の比（decisions D4）、選択・スクロール・打ちかけの入力が保たれる（AC-I5）、ダイアログの上のキーが
  ショートカットへ漏れない、モバイルの文脈。
- 負の対照：回帰を守るテスト（規則・落とし先・答えの順・省略）は、直した箇所を戻して落ちることを確かめる。

## タスク

- [x] T1: `packages/protocol/src/color.ts`（新規）：`relativeLuminance`・`contrastRatio`・`mixHex`（四捨五入）・`ensureContrast`（`alpha` 付き）と
      単体テスト。`src/index.ts` から export
      対象: 新規 `packages/protocol/src/color.ts`・`color.test.ts`、`packages/protocol/src/index.ts` / 根拠: design「インターフェース」protocol
      依存: なし
      AC: AC9
- [x] T2: `packages/protocol/src/theme.ts`：`THEME_NAMES`・`ThemeName`・`isThemeName`・`DEFAULT_THEME_NAME`・`THEME_APPEARANCE`・
      `TerminalPalette` の選択の 2 項目・`TERMINAL_UPSTREAM`（16 テーマ。配色集 `0b55a9e` の値を書き出して貼る）・`finalizePalette`（D2 の 2 規則）・
      `TERMINAL_PALETTES`（dracula は `DEFAULT_THEME`）と単体テスト。`pnpm -C packages/protocol build`
      **負の対照**: `finalizePalette` の規則 (a) から「背景のほうが大きい」の条件を外すと tokyo-night-day に当たり「ちょうど 5 つ」の検査が落ちる／
      規則 (b) を外すと「2 つ」の検査が落ちる
      対象: `packages/protocol/src/theme.ts:1-29`、新規 `theme.test.ts` / 根拠: design D2、research F8〜F11、decisions D5
      依存: T1
      AC: AC1, AC2, AC4
- [x] T3: protocol の方式 `client.theme`（`ClientThemeParams`・`METHOD_SCHEMAS`・結果の型）とスキーマのテスト。`pnpm -C packages/protocol build`
      対象: `packages/protocol/src/messages.ts:21-41` `:215-250`・`messages.test.ts` / 根拠: design D1、research F30
      依存: T2
      AC: AC8
- [x] T4: server の受け口：`ClientRecord.theme`（register で null）・`ClientRegistry.setTheme`、`surface/methods/client.ts` に `client.theme`、テスト
      対象: `packages/server/src/clients/ClientRegistry.ts:12-80`・`ClientRegistry.test.ts`、`packages/server/src/surface/methods/client.ts`・`index.test.ts` /
      根拠: design「インターフェース」server、research F29・F30
      依存: T3
      AC: AC8
- [x] T5: server `clients/answerPalette.ts`（新規）：`AnswerPaletteDeps`・`answerPaletteFor`（D6 の順）・`createPaletteSource`（attach されるまで
      `DEFAULT_THEME`）と `answerPalette.test.ts`
      **負の対照**: 権限者より表示している人を先に見ると／表示している人の最新でなく最初を取ると／attach 前に DEFAULT_THEME を返さないと、それぞれ落ちる
      対象: 新規 `packages/server/src/clients/answerPalette.ts`・`answerPalette.test.ts`、`SizeAuthority.ts:49-57`（操作の時刻。decisions D7）/ 根拠: design D6、research F27〜F29
      依存: T4
      AC: AC8
- [x] T6: server の Mirror：`XtermMirror` が `palette: () => TerminalPalette` を受けて問い合わせの瞬間に呼ぶ、`DefaultTerminalHost`・
      `DefaultTerminalManager` が `paletteFor` を渡す。`Mirror.test.ts`（既定のまま通る・関数の値で答える・呼ぶたびに引き直す）
      **負の対照**: 作るときに 1 回だけ引いて保持すると「後から替わった配色で答える」テストが落ちる
      対象: `packages/server/src/terminal/Mirror.ts:52-66` `:152-176`、`TerminalHost.ts:32-40`、`TerminalManager.ts:25-52`、`Mirror.test.ts` /
      根拠: design D6・「インターフェース」server、research F26・F27
      依存: T2
      AC: AC8
- [x] T7: `composeServer.ts` の結線：`createPaletteSource()` を `DefaultTerminalManager` に渡し、`clients` を作った直後に `attach`
      （`getPane`・`getTab` は `session`）
      対象: `packages/server/src/composeServer.ts:123` `:165-166` / 根拠: design D6
      依存: T5, T6
      AC: AC8
- [x] T8: web `theme/themes.ts`（新規）：`THEME_LABELS`（17 個）・`siblingThemes`（7 組＋D7）・`lightDarkOf`・`resolveTheme`・`loadThemePrefs`（値ごとの
      落とし先）と単体テスト
      **負の対照**: 対の無いテーマの明るい側を自身にすると／壊れた `themeLight` を dracula に落とすと（AC6 の既定でなく）、それぞれ落ちる
      対象: 新規 `packages/web/src/theme/themes.ts`・`themes.test.ts` / 根拠: design D7・「振る舞いの詳細」名前の解決・「エラー処理」
      依存: T2
      AC: AC4, AC5, AC6, AC7
- [x] T9: web `theme/uiTokens.ts`（新規）：`CSS_VARS`・dracula の定数（decisions D1 の #6070a1 を含む）・herdr の配色の抜粋（herdr `da6bcd5` の
      `state.rs:78-527` から書き出して貼る）・design の表の組み立て・`subtleOver`。`App.vue` の `:root` に新しい変数と `color-scheme: dark` を足す。
      単体テスト：全テーマ × 表の相手（AC9）、`App.vue` の `:root` と `uiTokens("dracula")` の一致
      **負の対照**: `uiTokens` の組み立て（文字の色を寄せる `ensureContrast` の呼び出し）から `alpha = 0.7` を外すと、テストの「0.7 に薄めた文字が 4.5」の
      検査が明るい 7 テーマと one-dark・solarized で落ちる／`App.vue` の値を 1 つ変えると一致の検査が落ちる
      対象: 新規 `packages/web/src/theme/uiTokens.ts`・`uiTokens.test.ts`、`packages/web/src/App.vue:83-93` / 根拠: design D3・表、research F13〜F15、
      decisions D1・D6
      依存: T1, T2
      AC: AC2, AC4, AC9, AC10
- [x] T10: web の直に書いた色の置き換え（design「直に書いた色の置き換え」の 11 ファイル。置き換え先の変数と dracula の値は T9 で決まる）、
      `GotoPicker.vue` の `.goto-picker-meta` を 0.7（decisions D2）、`MobileShell.vue`・`ExtraKeys.vue` の押された状態の文字を `--wtm-accent-fg` にし
      `--wtm-accent` の予備を #6070a1 に揃える。既存の部品のテストが通ること
      対象: `StateIcon.vue:66-76`・`Sidebar.vue:315`・`LoginView.vue:189` `:202`・`ReconnectOverlay.vue:77` `:104` `:108`・`HelpDialog.vue:260`・
      `WorktreeOpenDialog.vue:128`・`GotoPicker.vue:342` `:392-395`・`WorktreeCreateDialog.vue:97`・`ConfirmDialog.vue:97`・`NameDialog.vue:140`・
      `SettingsDialog.vue:330`・`MobileShell.vue:153-155`・`ExtraKeys.vue:133-135` / 根拠: design「直に書いた色の置き換え」、research F16
      依存: T9
      AC: AC2, AC9, AC13
- [x] T11: web `store/settings.ts`：初期値を `loadThemePrefs(readPrefs())` から取る `theme`・`themeAuto`・`themeLight`・`themeDark`、`systemDark`（初期 true）・
      `effectiveTheme`、`setTheme`（自動の切替を切る）・`setThemeAuto`・`setThemeLight`・`setThemeDark`（null で既定に戻す）と単体テスト
      （`systemDark` を変えると `effectiveTheme` が替わる、null を入れると対の既定に戻り 1 つのテーマの変更に追従する、を含む）
      **負の対照**: `setTheme` が自動の切替を切らないと AC7 のテストが落ちる
      対象: `packages/web/src/store/settings.ts:60-105`・`settings.test.ts` / 根拠: design「インターフェース」web・「振る舞いの詳細」設定を変える操作
      依存: T8
      AC: AC3, AC4, AC5, AC6, AC7
- [x] T12: web の端末：`term/theme.ts` の `toXtermTheme(palette)`（選択の 2 項目も渡す）、`TerminalRegistry` の `getTheme`（作るとき）と
      `setTheme`（全端末の `options.theme` だけを替え、作り直さない）と単体テスト
      対象: `packages/web/src/term/theme.ts:24-34`、`packages/web/src/term/TerminalRegistry.ts:65` `:192-198`・`TerminalRegistry.test.ts` /
      根拠: design「インターフェース」web、research F20〜F22
      依存: T2
      AC: AC2, AC-I5
- [x] T13: web `theme/ThemeController.ts`（新規：`BOOT_KEY`・`BootCache`・`start`・`apply`・`writeBoot`・`current`・`resend`、OS の明暗の追従）と
      `ThemeController.test.ts`
      **負の対照**: `start()` の 1 回目を省略すると「控えが別テーマで保存値が dracula」のテストが落ちる／OS の明暗の変化で控えを書くと落ちる
      対象: 新規 `packages/web/src/theme/ThemeController.ts`・`ThemeController.test.ts` / 根拠: design D5・「振る舞いの詳細」当てる・起動用の控え・
      サーバへ伝える
      依存: T3, T9, T11, T12
      AC: AC2, AC3, AC5, AC8, AC10
- [x] T14: `packages/web/public/theme-boot.js`（新規）と `index.html` の `<head>`、`themeBoot.test.ts`（控えの選び方・壊れた控え・`matchMedia` 無し・
      本体の `resolveTheme` と同じ組を選ぶ）
      **負の対照**: `theme-boot.js` の明暗の選び方を変えると本体との一致の検査が落ちる
      対象: 新規 `packages/web/public/theme-boot.js`・`packages/web/src/theme/themeBoot.test.ts`、`packages/web/index.html` / 根拠: design D5、research F23・F24
      依存: T13
      AC: AC3, AC10
- [x] T15: `main.ts` の結線（design の順：store → `TerminalRegistry` の `getTheme` → `ThemeController.start()` → `onOpened` で `resend()` → mount）
      対象: `packages/web/src/main.ts:52-56` `:140-150` `:258` / 根拠: design「対象範囲」main.ts、research F25・F30
      依存: T13, T14
      AC: AC2, AC3, AC5, AC8
- [x] T16: web の設定ダイアログ：節「テーマ」（通知と表示の間。decisions D11）——`<select>`「テーマ」（`<optgroup>` 暗いテーマ 10・明るいテーマ 7、dracula に
      「（既定）」）・切り替え「OS の明暗に合わせる」・入のときの `<select>`「明るいとき」「暗いとき」（先頭に「既定（〈対〉）」）・いま使っているテーマの
      注記——と単体テスト
      対象: `packages/web/src/components/SettingsDialog.vue:250-261` `:320-448`・`SettingsDialog.test.ts` / 根拠: design D4・「振る舞いの詳細」設定ダイアログ
      依存: T8, T11
      AC: AC1, AC5, AC6, AC7, AC13, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
- [x] T17: 文書と起票：`docs/herdr-parity.md` の H24（design「ドメイン固有の考慮」の herdr との違い）、`docs/verification.md`（AC12 の対応の項目）、
      `aidev backlog add product-roadmap.md` で 2 件（色の個別の上書き・DSR 996/mode 2031）
      対象: `docs/herdr-parity.md:48`・`docs/verification.md`・`.aidev/backlog/product-roadmap.md` / 根拠: design AC11・AC12・AC14
      依存: T7, T16
      AC: AC11, AC12, AC14
- [x] T18: E2E `packages/e2e/src/specs/theme-settings.spec.ts`（新規）：テスト方針の E2E の項目と、T15 の点検が挙げた結線（接続ごとの送り直し・後から作る
      端末の色・控えの書き先）。`settings.spec.ts` の節の並びの判定 3 か所と題 2 か所を 4 節に直す（decisions D11）
      対象: 新規 `packages/e2e/src/specs/theme-settings.spec.ts`、先例 `settings.spec.ts`・`scrollback-copy.spec.ts:28-44`・`new-terminal-cwd.spec.ts`・
      `support/frames.ts` / 根拠: design の AC 対応（AC-I5・AC8 の確かめ方）、decisions D4、条項 `e2e-observe-browser`
      依存: T7, T10, T15, T16
      AC: AC1, AC2, AC3, AC5, AC8, AC9, AC10, AC13, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
- [ ] T19: 全パッケージの単体テスト・型の検査・lint と、影響を受ける E2E の spec を走らせて結果を記録する（**test 工程で消化する**）。
      E2E の一式は deliver の直前に 1 回
      対象: 未特定（走らせるだけ）
      依存: T17, T18
      AC: なし
