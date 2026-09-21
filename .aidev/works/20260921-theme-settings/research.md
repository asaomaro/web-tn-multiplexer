# 調査: テーマを選び、OS の明暗に合わせて切り替える（herdr のテーマ）

herdr の版は前 work と同じ `da6bcd5969779bfe0396bcf89a8025d4375d611e`。配色集は `mbadolato/iTerm2-Color-Schemes` の
`0b55a9e609daa0727be7d0d4705616dbe8d08fed`（2026-09-21 の master）に固定して読んだ。

## 調査の問い

- Q1: herdr のテーマは何を決めていて、明暗の切替・設定画面での選び方はどう動くか。
- Q2: 17 テーマの**端末の色**（文字・背景・カーソル・選択・16 色）をどこから取れるか。そのまま使えるか。
- Q3: herdr の**画面の枠の色**（`Palette`）は本製品の色の項目にどう当たり、コントラストは足りるか。
- Q4: 本製品の web で、色はどこに書かれているか（CSS 変数・直に書いた色の全数）。
- Q5: xterm.js 6 で、開いている端末のテーマを再読み込み無しで替えられるか。既定の色は何か。
- Q6: 読み込みの直後に既定の暗い配色が出ないようにできるか（CSP・配信の制約）。
- Q7: 色の問い合わせ（OSC 4/10/11/12）に、サイズを決めているブラウザの配色で答えるには、何をどこに足すか。
- Q8: テーマを選ぶ部品と明暗の自動の切替の、確立した UI のパターンは何か（AC-I2 の戻し方）。
- Q9: E2E で OS の明暗と色の問い合わせをどう確かめられるか。既存のテストのどれが色に依るか。

## 判明した事実

### Q1 herdr のテーマ

- F1: herdr のテーマは**herdr 自身の画面の枠（サイドバー・tab バー・パネル等）の色だけ**を決める。構造体 `Palette` の 19 項目
  （`accent`・`panel_bg`・`sidebar_bg`・`active_row_bg`・`selection_bg`・`surface0`・`surface1`・`surface_dim`・`overlay0`・
  `overlay1`・`text`・`subtext0`・`mauve`・`green`・`yellow`・`red`・`blue`・`teal`・`peach`）。各テーマの値は
  `src/app/state.rs:78-527`（`Palette::catppuccin()` 〜 `vesper()`、`from_name` は `:528-550`）。
  **pane の中の端末の色は herdr は持たず、ホストの端末（herdr を動かしている端末エミュレータ）の色がそのまま出る**。
- F2: herdr は**ホストの端末の実際の色を pane の中のアプリへ伝える**：起動時にホストへ `OSC 10;?`・`OSC 11;?`（と 256 色の
  `OSC 4;n;?`）を問い合わせ、その答えを各 pane の端末の状態に入れる（`src/terminal_theme.rs` の `host_terminal_theme_query_sequence`・
  `TerminalTheme`、`src/app/theme_sync.rs` の `set_host_terminal_theme` → `apply_host_terminal_theme_to_panes`）。明暗は
  ホストが報告する（`CSI ? 996 n` への `CSI ? 997 ; 1|2 n`、mode 2031 の通知）か、背景の輝度から推す
  （`RgbColor::inferred_appearance`：`299R+587G+114B >= 128000` なら明るい）。明暗の変化も pane へ伝える
  （`apply_host_terminal_appearance_to_panes`）。
- F3: 名前は 18 種（`src/config/theme.rs:4-23` の `THEME_NAMES`）。別名あり（`:25-47`。`catppuccin-mocha`・`latte`・`light`・
  `tokyonight`・`gruvbox-dark`・`onedark`・`solarized-dark`・`lotus`・`rosepine`・`dawn` 等）。`terminal` は画面の枠を
  ホストの 16 色の名前付きの色で描くテーマ（`state.rs:128-152` が `Color::Blue` 等を使う）。
- F4: 自動の切替：`auto_switch`（既定 false）・`dark_name`・`light_name`。省略時は `name` の**対**（`src/app/mod.rs:219-244` の
  `sibling_theme_names`。7 組。対の無い名前は `(name, name)`＝明暗とも同じ）。明暗が分からない間は暗いほう
  （`mod.rs:302-330` の `resolve_effective_theme`：`appearance.unwrap_or(Dark)`）。知らない名前は暗いなら `catppuccin`、
  明るいなら `catppuccin-latte` に落とす（`mod.rs:278-289`・`theme.rs:74-96` の診断）。
- F5: 既定のテーマは `catppuccin`（`theme.rs:61`・`mod.rs:250-254`）。
- F6: 設定画面のテーマの節（`src/client/shell/settings.rs`）：18 の名前の一覧。**選択を上下に動かすたびに試し見**
  （`move_settings_selection` → `preview_selected_theme`。`:108-156`）、**Enter で確定して設定ファイルへ書き、画面を閉じる**
  （`apply_settings_choice` の `ClientSettingsSection::Theme`。`:185-198`）、**Esc で開く前のテーマに戻す**
  （`cancel_settings_overlay`。`:157-163`）。文書は「設定画面で手で選ぶと `auto_switch` が切れる」
  （`website/src/content/docs/configuration.mdx:262`）。設定画面に自動の切替・明暗のテーマの項目は**無い**（設定ファイルだけ）。
- F7: 色の個別の上書き `[theme.custom]` と `[theme.custom.light]`/`[theme.custom.dark]`（`theme.rs:99-151`）は設定ファイルだけ。
  適用順は組み込み → custom → 明暗別（`mod.rs:278-300`）。

### Q2 端末の色の出典

- F8: `iTerm2-Color-Schemes` の `windowsterminal/*.json` に、17 テーマとも対応する配色がある（1 つ 21 項目：`name`・16 色
  〔`black`〜`white`・`brightBlack`〜`brightWhite`。紫は `purple`〕・`background`・`foreground`・`cursorColor`・
  `selectionBackground`。**`selectionForeground` は無い**）。herdr の画面の枠の背景（`panel_bg`）と端末の背景が同じ・近い
  ものを対応させた：

  | テーマ | 配色集のファイル | 端末の背景 / 文字 | herdr の `panel_bg` |
  |---|---|---|---|
  | catppuccin | `Catppuccin Mocha.json` | #1e1e2e / #cdd6f4 | #181825 |
  | catppuccin-latte | `Catppuccin Latte.json` | #eff1f5 / #4c4f69 | #eff1f5 |
  | tokyo-night | `TokyoNight.json`（Night） | #1a1b26 / #c0caf5 | #1a1b26 |
  | tokyo-night-day | `TokyoNight Day.json` | #e1e2e7 / #3760bf | #e1e2e7 |
  | dracula | `Dracula.json` | #282a36 / #f8f8f2 | #282a36 |
  | nord | `Nord.json` | #2e3440 / #d8dee9 | #2e3440 |
  | gruvbox | `Gruvbox Dark.json` | #282828 / #ebdbb2 | #282828 |
  | gruvbox-light | `Gruvbox Light.json` | #fbf1c7 / #3c3836 | #fbf1c7 |
  | one-dark | `Atom One Dark.json` | #21252b / #abb2bf | #282c34 |
  | one-light | `Atom One Light.json` | #f9f9f9 / #2a2c33 | #fafafa |
  | solarized | `iTerm2 Solarized Dark.json` | #002b36 / #839496 | #002b36 |
  | solarized-light | `iTerm2 Solarized Light.json` | #fdf6e3 / #657b83 | #fdf6e3 |
  | kanagawa | `Kanagawa Wave.json` | #1f1f28 / #dcd7ba | #1f1f28 |
  | kanagawa-lotus | `Kanagawa Lotus.json` | #f2ecbc / #545464 | #f2ecbc |
  | rose-pine | `Rose Pine.json` | #191724 / #e0def4 | #191724 |
  | rose-pine-dawn | `Rose Pine Dawn.json` | #faf4ed / #575279 | #faf4ed |
  | vesper | `Vesper.json` | #101010 / #ffffff | #1a1a1a |

- F9: **`Dracula.json` の 16 色・背景・文字・カーソルは、今の `DEFAULT_THEME`（`packages/protocol/src/theme.ts:18-29`）と一致する**
  （`selectionBackground` #44475a だけが追加）。今の web は選択の色を指定していない（`packages/web/src/term/theme.ts:24-34`）ので、
  **今の選択の色は xterm.js の既定（下の F22）**。
- F10: 配色集の `selectionBackground` は、**選択した文字の色を反転させる前提**（iTerm 等）の値を含む。xterm.js は
  `selectionForeground` を指定しない限り文字の色を変えないので、そのまま使うと**選んだ文字が背景に溶ける**テーマが 5 つある。
  全テーマの「文字と選択の背景」／「背景と選択の背景」の比（WCAG の相対輝度）：catppuccin 1.14／12.95・catppuccin-latte 3.02／2.34・
  tokyo-night 5.64／1.88・tokyo-night-day 2.49／1.81・nord 1.17／10.84・gruvbox 4.75／2.26・gruvbox-light 1.00／10.22・
  one-dark 5.52／1.31・one-light 11.91／1.11・solarized 4.11／1.16・solarized-light 3.64／1.14・kanagawa 1.00／11.26・
  kanagawa-lotus 1.00／6.19・rose-pine 7.93／1.69・rose-pine-dawn 5.25／1.27・vesper 3.81／5.00。herdr の `selection_bg`（サイドバーの選択の行の背景）なら、文字とのコントラストは
  全テーマで 3.1〜15.7。
- F11: カーソルの色と背景のコントラストが低いものがある：one-light 1.8（#bbbbbb）・catppuccin-latte 2.3（#dc8a78）。ほかは 4.1 以上。
- F12: 配色の各テーマの元の配布元は MIT などの許諾（Dracula・Catppuccin・Nord・Gruvbox・Rosé Pine・Kanagawa・Solarized 等）。
  色の値は事実の記録だが、出典（配色集のファイル名と版）をコードに書いておくと追える。

### Q3 画面の枠の色とコントラスト

- F13: herdr の `Palette` を**そのまま使うと、WCAG のコントラストを満たさない組み合わせが多い**（`panel_bg` を背景とした比）：
  - 文字（`text`）が 4.5 未満：solarized-light 4.1。tokyo-night-day はちょうど 4.5。
  - 状態の色（`green`・`yellow`・`red`・`blue`）が 3 未満：catppuccin-latte の yellow 2.3・peach 2.6、gruvbox-light の yellow（`surface0` 上 2.8）、
    one-light の green/yellow 3.1（`surface0` 上 2.8）、solarized-light の green/yellow 3.0、tokyo-night-day の red 3.0（`surface0` 上 2.3）、
    rose-pine-dawn の yellow 2.1、kanagawa-lotus の peach 3.0、dracula の red は `surface0` 上で 2.9 等。
  - 淡い文字（`overlay0`）はほぼ全テーマで 3 未満（1.7〜4.0）。
  暗いテーマの多くは文字・状態とも余裕がある（catppuccin・tokyo-night・rose-pine・vesper 等）。**明るいテーマ 7 種は状態の黄が
  軒並み足りない**。したがって画面の枠には、herdr の値を出発点に**足りない色だけ明度を寄せる**（色相を保つ）処理が要る。
- F14: 今の本製品の画面の枠（dracula 相当）の値は herdr の dracula と一部違う：本製品 `--wtm-menu-active-bg` #44475a
  （herdr `surface0` と同じ）・`--wtm-menu-hover-bg` #343746（herdr に無い中間色）・`--wtm-bg` #1e1f29（herdr に無い。
  `panel_bg` より暗い）・アクセント #6272a4（herdr `accent` は #bd93f9）。状態の色は前 work で WCAG に合わせて選び直した値
  （blocked #ff6e6e・working #f1fa8c・done #50fa7b・idle #8a9ad0。`packages/web/src/components/StateIcon.vue:59-76`）。

### Q4 本製品の web の色

- F15: CSS 変数は `App.vue:83-93` の `:root` に 7 つ（`--wtm-bg` #1e1f29・`--wtm-fg` #f8f8f2・`--wtm-menu-bg` #282a36・
  `--wtm-menu-fg` #f8f8f2・`--wtm-menu-border` #44475a・`--wtm-menu-active-bg` #44475a・`--wtm-menu-hover-bg` #343746）。
  **`--wtm-accent`（`MobileShell.vue:154`・`ExtraKeys.vue:134`）と `--wtm-error-fg`（`TerminalPane.vue:94`）は `:root` に定義が無く**、
  各所の `var(..., #6272a4)`・`var(..., #ff5555)` の予備の値で描かれている。ほぼ全ての部品が `var(--wtm-…, <予備の値>)` の形で読む
  （23 ファイル）。
- F16: **変数を通らずに直に書いた色**（テーマで変わらない）：
  - 状態の記号 4 色：`StateIcon.vue:66-76`。
  - 警告の橙 #ffb86c：`Sidebar.vue:315`。
  - エラーの赤 #ff5555：`LoginView.vue:189`・`ReconnectOverlay.vue:104`。
  - 淡い面 `rgba(255, 255, 255, 0.08)`：`LoginView.vue:202`・`ReconnectOverlay.vue:108`（暗い背景前提の明るい重ね）。
  - 暗幕 `rgba(0, 0, 0, 0.4)`・`rgb(0 0 0 / 40%)`・`rgba(0, 0, 0, 0.5)`：`HelpDialog.vue:260`・`WorktreeOpenDialog.vue:128`・
    `GotoPicker.vue:342`・`WorktreeCreateDialog.vue:97`・`ConfirmDialog.vue:97`・`NameDialog.vue:140`・`SettingsDialog.vue:330`・
    `ReconnectOverlay.vue:77`。
  - TS に直に書いた色は無い（`grep '#[0-9a-f]{6}'` は `term/theme.ts` 経由の `DEFAULT_THEME` だけ）。
- F17: `color-scheme` の指定がどこにも無い（`grep color-scheme packages/web` が空）。ブラウザ標準の部品（ラジオ・チェックボックス・
  入力欄・`<select>` の一覧・スクロールバー）は既定の**明るい**描き方で、暗い背景の上に明るい部品が出ている（今も）。
  CSS の `color-scheme: light | dark` を `:root` に置くと、これらの描き方と既定の文字・背景の色がそれに従う（CSS Color Adjustment
  Module Level 1）。
- F18: 設定ダイアログの今の形（`SettingsDialog.vue:203-306`）：見出し付きの 3 節（通知・表示・端末）。切り替えは `role="switch"` の
  ボタン、選ぶものは `<fieldset>` の中のラジオ（scrollback・新しく開く場所）。**押した・選んだ時点で反映と保存**、確定ボタンは無い
  （前 work の AC-I2。`store/settings.ts:66-95` の `set*` が反映と `writePrefs` を同時に行う）。`<select>` は web のどこにも無い。
- F19: 設定の保存は `wtm.prefs.v1`（`store/view.ts:42`）を `readPrefs`（`:50`）・`writePrefs`（`:62`）で読み書きする。
  値ごとに `load*`（型が違えば既定）で読む（`store/settings.ts:21-40`）。

### Q5 xterm.js 6 のテーマ

- F20: 版は `@xterm/xterm` 6.0.0・`@xterm/addon-webgl` 0.19.0（`packages/web/package.json:14-18`）。端末は作るときに
  `theme: toXtermTheme()` を渡すだけ（`TerminalRegistry.ts:192-198`）。端末は `entries`（`:65`）の Map にある。
- F21: `term.options.theme = …` を代入すると、xterm.js は `onSpecificOptionChange("theme")` で色を作り直し
  （`lib/xterm.mjs` の `_setTheme`）、WebGL の描画も `onChangeColors` で文字の atlas を作り直す（`addon-webgl.mjs`）。
  **開いている端末をそのまま替えられる**（画面の中身・scrollback は保たれる。描き直しだけ）。
- F22: `ITheme` は `foreground`・`background`・`cursor`・`cursorAccent`・`selectionBackground`・`selectionForeground`・
  `selectionInactiveBackground`・`scrollbarSlider*`（既定は `foreground` の 20/40/50%）・16 色など（`typings/xterm.d.ts:343-380`）。
  **選択の色の既定は `rgba(255, 255, 255, 0.3)`**（`lib/xterm.mjs`）——**明るい背景ではほぼ見えない**ので、明るいテーマでは
  指定が要る。スクロールバーは `foreground` から作られるので明るいテーマでも見える。

### Q6 最初の描画

- F23: CSP は `default-src 'self'; … style-src 'self' 'unsafe-inline'`（`packages/server/src/http/HttpServer.ts:25-26`）。
  `script-src` は `default-src` に従うので、**`index.html` に直に書いたスクリプト（inline）は動かない**。同じオリジンの外部の
  スクリプト（`<script src="/…">`）は動く。
- F24: `index.html`（`packages/web/index.html`）は `<script type="module" src="/src/main.ts">` だけ。module のスクリプトは文書の解析の後に
  走るので、それより前に描かれる可能性がある。`<head>` に置いた**型の無い（classic）外部スクリプトは描画を止めて先に走る**。
  Vite は `public/` の中身をそのまま `dist/` へ写す（`packages/web/public` は今は無い）。サーバは `dist` の下のファイルを
  どれでも配る（`HttpServer.ts:175-201`）。
- F25: `main.ts` は pinia と各 store を作り（`:52-56`）、最後に `app.mount("#app")`（`:258`）。ログイン画面（`LoginView`）も
  同じアプリの中（`App.vue:41`）なので、store が決めた色がログイン画面にも効く。

### Q7 色の問い合わせへの答え

- F26: 今の答えはサーバの `XtermMirror` が作る：`registerOscHandler(10|11|12)` と `(4)`（`packages/server/src/terminal/Mirror.ts:62-66`）が
  `DEFAULT_THEME` の値を `rgb:RRRR/GGGG/BBBB` で返す（`:152-176`）。問い合わせでない OSC（色の設定）は関与しない。
  ブラウザの xterm.js の答えは握りつぶしている（`packages/web/src/term/QueryFilter.ts`。二重に答えないため）。
- F27: `XtermMirror` は `DefaultTerminalHost` が作り（`TerminalHost.ts:39`）、それは `DefaultTerminalManager` が作る
  （`TerminalManager.ts:52`）。Mirror は pane を知っている（`TerminalHost.paneId`）が、tab・クライアントは知らない。
- F28: サイズを決めているブラウザは **tab ごとに `Tab.sizeOwnerClientId`**（`packages/protocol/src/model.ts:46`）。
  決めるのは `DefaultSizeAuthority`（`packages/server/src/clients/SizeAuthority.ts`）。持てるのはデスクトップか fit を入れたクライアントだけ
  （`canDecideSize`）。持つ人がいなければ null。
- F29: クライアントごとの状態は `ClientRecord`（`packages/server/src/clients/ClientRegistry.ts:12-19`：`kind`・`fit`・`view`・
  `lastInteractionAt`・`subscriptions`）。**接続ごとに新しい clientId**で、前の接続の状態は引き継がない（`Connection.ts:161-165`）。
- F30: クライアントの状態を送る方式の先例は `client.fit`（`packages/protocol/src/messages.ts:38`・`METHOD_SCHEMAS` の `:215-218`、
  サーバ `surface/methods/client.ts` の `register("client.fit")`、web `mobile/useFitToScreen.ts:81`）。新しい接続では
  `connection.onOpened(() => viewSync.onConnectionOpened())`（`main.ts:147-150`）で送り直している。
- F31: DSR 996・mode 2031 には、サーバも web も応答していない（`grep -rn "996\|2031" packages/*/src` が空）。

```mermaid
sequenceDiagram
  participant App as pane の中のアプリ
  participant M as Mirror（サーバ）
  participant R as ClientRegistry / Tab
  participant B as ブラウザ（サイズ権限あり）
  B->>R: （今は無い）表示している配色を伝える
  App->>M: OSC 11 ; ?
  M->>M: 今は DEFAULT_THEME の背景で答える
  M-->>App: OSC 11 ; rgb:2828/2a2a/3636
```

### Q8 UI の規範

- F32: **VS Code**（一次資料 `microsoft/vscode-docs` `docs/configure/themes.md:14-22`・`:46-57`）：色のテーマの選び方は、一覧で
  上下キーを動かすと**試し見**、Enter で確定（Esc で開く前に戻す）。**OS の明暗への追従**は `window.autoDetectColorScheme`
  （切り替え 1 つ）と、**明るいとき・暗いときに使うテーマ**（`Preferred Light Color Theme`・`Preferred Dark Color Theme`）の
  2 つの設定。設定エディタ上のテーマの項目は**プルダウン**で、選んだ時点で反映される。
- F33: **GitHub**（一次資料 `github/docs` `content/get-started/accessibility/managing-your-theme-settings.md`）：外観の設定の
  「Theme mode」のプルダウンで **Single theme / Sync with system** を選び、前者なら 1 つのテーマ、後者なら **day theme と
  night theme** を選ぶ。確定ボタンは無い（選んだ時点で反映）。
- F34: **herdr**：F6 のとおり。一覧で試し見、Enter で確定、Esc で戻す。自動の切替は設定画面に無い。
- F35: WAI-ARIA APG：1 つを選ぶ部品は radio group・listbox、またはネイティブの `<select>`。ネイティブの `<select>` は
  キーボード（閉じたまま上下キーで値が変わる〔Windows・Linux の Chrome〕、開いて選ぶ）・スクリーンリーダー・モバイルの OS の
  選び方をそのまま持つ。本製品の設定ダイアログは既存の選ぶ項目をラジオで作っている（F18）が、17 個を並べると節が長くなる。
- F36: 食い違い：**試し見と Esc での取り消し**は一覧の中を移って選ぶ形（VS Code の選び方・herdr）のもので、**設定の画面の中の項目**
  （VS Code の設定エディタ・GitHub の外観の設定・本製品の既存の節）は**選んだ時点で反映と保存、取り消しは選び直し**。

### Q9 テスト

- F37: Playwright 1.63（`packages/e2e/package.json:16`）は `page.emulateMedia({ colorScheme: "light" | "dark" })` で OS の明暗を
  切り替えられる（`types.d.ts:2749-2788`）。**コンテキストの既定の `colorScheme` は `light`**（Playwright の既定）。
  既存の E2E に `emulateMedia`・`colorScheme` の使用は無い。
- F38: 色の問い合わせの答えは PTY の入力として pane のアプリに届くので、E2E では pane の中で「問い合わせて答えを表示する」小さな
  プログラム（例：`node -e` で raw モードにして `\x1b]11;?\x07` を書き、受けた文字列を出す）を走らせ、ブラウザが受けた画面で
  答えを見る形になる。E2E の pane の中では `node` が PATH にある（テストを走らせる node と同じ環境）。
- F40: 薄めて描く（`opacity`）箇所の全数（`grep -rn "opacity:" packages/web/src/components packages/web/src/mobile` から 0 と 1 を除いたもの）：
  `SettingsDialog.vue:384`（0.5・無効な切り替え）・`:401`（0.8）・`:410`（0.85）・`:446`（0.7）、`GotoPicker.vue:390`（0.7）・`:394`（0.6）・`:401`（0.7）、
  `LoginView.vue:186`（0.85）、`StateIcon.vue:85`（0.3・状態の無い丸。文字ではない）、`HelpDialog.vue:275`（0.8）・`:291`（0.5・未対応の行）・
  `:294`（0.7）、`WorktreeCreateDialog.vue:113`（0.75）、`Sidebar.vue:295`・`:341`（0.75）、`WorktreeOpenDialog.vue:133`・`:160`（0.75）、
  `TabBar.vue:106`（0.4・無効なボタン）・`:127`（0.7）、`NameDialog.vue:154`（0.8）、`ReconnectOverlay.vue:84`（0.85）。
- F39: 色を確かめている既存の E2E：`settings.spec.ts:234`（既定の配色で blocked の記号の色が `rgb(255, 110, 110)`）。ほかは
  背景色が「選択の色のまま」等の相対の比較（`workspace-tab-pane.spec.ts:579-585`）。サーバの単体 `Mirror.test.ts:27-38` は
  `DEFAULT_THEME` の値で答えることを見る。

## 影響範囲

- **protocol**：`TerminalPalette`（選択の色・カーソルの文字の色を足すか）、17 テーマの端末の配色、新しい方式（表示している配色を
  サーバへ伝える）。protocol を変えたら `dist` の作り直しが要る。
- **server**：`Mirror` の色の答え（固定の `DEFAULT_THEME` → pane ごとに引く）、`TerminalHost`・`TerminalManager` の組み立て、
  `ClientRegistry`（配色を持つ）、`surface/methods/client.ts`（方式の受け口）、`composeServer.ts`（結線）。
- **web**：テーマの定義と画面の枠の色（CSS 変数）、`App.vue` の `:root`、F16 の直に書いた色（暗幕以外 4 ファイル＋暗幕 8 か所。重なりを除いて 11 ファイル）、
  `term/theme.ts`・`TerminalRegistry`（作るときの色と、開いている端末の入れ替え）、`store/settings.ts`（保存と読み込み）、
  `SettingsDialog.vue`（テーマの節）、`main.ts`（接続ごとに配色を送る・OS の明暗の追従）、`index.html`（最初の描画）。
- **E2E**：新しい spec。`settings.spec.ts`（設定ダイアログの節が増える）。
- **文書**：`docs/herdr-parity.md` の H24、`docs/verification.md`、backlog。

## 実現性 / リスク

- 端末の色の入れ替えは xterm.js の標準の機能で済む（F21）。画面の枠は CSS 変数を差し替えるだけで大半が追従する（F15）。
- **コントラストの調整が要るテーマが多い**（F13）。調整を手で 17 テーマ分書くと誤りやすい——**機械的に寄せて、全テーマをテストで
  確かめる**形が安全。
- **選択の色**（F10）と**カーソルの色**（F11）は、配色集の値のままでは見えないテーマがある。
- 最初の描画（F23・F24）は CSP の中で解ける（同じオリジンの外部スクリプト）が、テーマの名前の決め方（自動の切替・壊れた値）を
  そのスクリプトと本体の 2 か所に持つと食い違いうる。
- 色の問い合わせの答えは、サイズを決めているブラウザが変わる・切断する・テーマを変える、の各時点で正しい配色を引ける必要がある
  （Mirror が答える瞬間に引けばよい）。

## 実装アンカー

- A1: 端末の配色の型と既定（`packages/protocol/src/theme.ts:5-29` `TerminalPalette` `DEFAULT_THEME`）— 17 テーマの配色を置く先。
- A2: web の xterm.js のテーマへの変換（`packages/web/src/term/theme.ts:24` `toXtermTheme`）と、作るときの指定
  （`packages/web/src/term/TerminalRegistry.ts:195`）・端末の一覧（`:65` `entries`）。
- A3: 画面の枠の CSS 変数（`packages/web/src/App.vue:83-93`）。
- A4: 直に書いた色（F16 の各行）。
- A5: 設定の store（`packages/web/src/store/settings.ts:60-105` `useSettingsStore`）と保存（`packages/web/src/store/view.ts:50` `readPrefs`・`:62` `writePrefs`）。
- A6: 設定ダイアログの節（`packages/web/src/components/SettingsDialog.vue:250-261` 表示の節、`:320-440` の style）。
- A7: 起動の順序（`packages/web/src/main.ts:52-56` store、`:147-150` 接続ごと、`:258` mount）と `packages/web/index.html`。
- A8: サーバの色の答え（`packages/server/src/terminal/Mirror.ts:62-66` `:152-176`）と組み立て（`TerminalHost.ts:39`・`TerminalManager.ts:52`）。
- A9: クライアントの状態（`packages/server/src/clients/ClientRegistry.ts:12-19` `ClientRecord`）と方式（`packages/server/src/surface/methods/client.ts`）、
  protocol の方式の表（`packages/protocol/src/messages.ts:21-41` `:215-250`）。
- A10: サイズ権限（`packages/protocol/src/model.ts:46` `Tab.sizeOwnerClientId`）。
- A11: E2E の先例（`packages/e2e/src/specs/settings.spec.ts`・`new-terminal-cwd.spec.ts`・`support/frames.ts`）。

## 実装時の注意

- **dracula の色は今の値を 1 つも変えない**（`settings.spec.ts:234` が blocked の色を見ている）。今の値は herdr の dracula と違う（F14）ので、
  herdr の `Palette` から機械的に作ると今の見た目が変わる。dracula だけは今の値を正とする。
- `--wtm-accent`・`--wtm-error-fg` は今は `:root` に無い（F15）。テーマで決めるなら `:root` に足す。
- 暗幕の `rgba(0,0,0,.4)` は明るいテーマでも暗い幕として働く（ダイアログを浮かせる）。一方 `rgba(255,255,255,.08)`（F16）は
  明るい背景では見えない。
- `store/view.ts` の注記どおり、`wtm.prefs.v1` の読み書きは `readPrefs`/`writePrefs` だけを通す。
- protocol を変えたら `pnpm -C packages/protocol build`（server・web は `dist` を読む）。E2E の前は `pnpm build`。
- Mirror の OSC のハンドラは **同期**で答えを返す（`registerOscHandler` は boolean を返す）。配色を引く処理も同期で済ませる。
- `ClientRecord` は接続ごと。再接続した直後は、新しい接続で配色が届くまで配色を知らない。

## design への申し送り

- 画面の枠の色の組み立て方：herdr の `Palette` から本製品の変数へどう当て、**コントラストの足りない色をどう寄せるか**（F13）。
  dracula だけ今の値（F14）。暗幕・淡い面・`color-scheme`（F16・F17）の扱い。
- 端末の選択の色（F10）・カーソルの色（F11）の直し方。
- 最初の描画（F23・F24）：外部スクリプトで先に決めるか、どう 2 か所の食い違いを防ぐか。
- テーマの選び方（F32〜F36）：本製品の設定の節の流儀（選んだ時点で反映と保存）に合わせるか、試し見と取り消しを入れるか。
  → AC-I2 に書き戻す。自動の切替は VS Code・GitHub の「切り替え＋明るいとき・暗いとき」の形が確立している。
- 配色をサーバへ伝える方式（`client.fit` の先例。F30）と、Mirror が答える瞬間の引き方（F26〜F28）。サイズを決めているブラウザが
  いない・配色がまだ届いていないときの答え（AC8 に書き戻す）。
- 対の無いテーマの明暗の既定（AC6 に書き戻す）。herdr は `(name, name)`（F4）。
