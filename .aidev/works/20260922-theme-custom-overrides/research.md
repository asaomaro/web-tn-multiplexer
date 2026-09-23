# 調査: 色の個別の上書き（herdr の `[theme.custom]` 相当）

## 調査の問い

- Q1: herdr の `[theme.custom]` は何をどう上書きし、明暗（`.light`/`.dark`）とどう関係するか。
- Q2: 本製品の画面の色（CSS 変数）はどこで・どう計算され、どこへ当てられるか。
- Q3: 上書きを実行時に反映する経路（`ThemeController`）は、いまの実装のままで対応できるか。落とし穴は無いか。
- Q4: 保存・起動時の控え（`theme-boot.js`）はどう扱うか。
- Q5: 色の妥当性はどう判定するか（herdr は hex・named colors・`rgb()`・reset のいずれも受ける）。

## 判明した事実

- F1: herdr の `[theme.custom]` は 19 個のトークン（`accent`・`panel_bg`・`sidebar_bg`・`active_row_bg`・`selection_bg`・
  `surface0`・`surface1`・`surface_dim`・`overlay0`・`overlay1`・`text`・`subtext0`・`mauve`・`green`・`yellow`・`red`・`blue`・
  `teal`・`peach`）を、選んだテーマの上に直接上書きする。値は hex・named color・`rgb(r,g,b)`・reset の別名（`reset`/`default`/
  `none`/`transparent`）のいずれか（herdr の `docs/versions/0.9.1/website/src/content/docs/configuration.mdx:280`）。
- F2: `auto_switch`（テーマの自動明暗切替）が**入っているときだけ**、`[theme.custom.light]`／`[theme.custom.dark]` が
  `[theme.custom]` の**上に**重ねて当たる（同 `configuration.mdx:288-297`：「When `auto_switch` is enabled, optional light
  and dark subtables layer on top」「適用順は built-in theme → `[theme.custom]` → `.light`/`.dark`」）。`auto_switch` が
  切なら `.light`/`.dark` は無視され、`[theme.custom]` だけが（選んだ 1 つのテーマの明暗に関わらず）当たる。
  → **本 work は「常に当たる」層を持たない設計**（design で決定）なので、この herdr の制約（`.light`/`.dark` は
  auto_switch 限定）をそのまま踏襲せず、**「明るいとき」「暗いとき」は自動切替の有無に関わらず、いま解決したテーマの
  明暗（`colorScheme`）で選ぶ**——そうしないと自動切替を使わない利用者（1 つのテーマ固定）は上書きが一切効かなくなる。
  意図的な逸脱として decisions に残す。
- F3: herdr の `theme.custom` の各キーの意味（`config-reference.json` 抜粋。`accent`／`panel_bg` 等は「そのトークンを
  そのまま上書き」、`sidebar_bg`／`active_row_bg`／`selection_bg` は少し特殊）：`sidebar_bg` は「省くとサイドバーはホスト
  端末の背景のまま」（＝既定は独立した背景を持たない）、`active_row_bg` は「選ばれている Space・フォーカスした Agent の行の
  背景だけを変える（区切り・スクロールバーの軌道には触れない）」、`selection_bg` は「サイドバーの navigate モードの
  カーソル行の背景だけを変える」。
- F4: 本製品の画面の色は 19 個の CSS 変数（`packages/web/src/theme/uiTokens.ts:16-35` の `CSS_VARS`）で、herdr の
  トークンとは名前も粒度も 1:1 ではない：

  | 本製品の CSS 変数 | 意味（`.aidev/works/20260921-theme-settings/design.md:245-259`） | herdr の近い概念 |
  |---|---|---|
  | `--wtm-bg` | 画面地の背景 | （herdr は端末の背景をそのまま使う。近いものなし） |
  | `--wtm-fg` | 画面地の文字 | `text` に近い |
  | `--wtm-menu-bg` | メニュー・ダイアログ・サイドバー等の背景 | `panel_bg` |
  | `--wtm-menu-fg` | 同じ面の文字 | `text` |
  | `--wtm-menu-border` | 区切りの線 | `surface0` |
  | `--wtm-menu-active-bg` | 選ばれている行の背景（メニュー・goto・tab・**サイドバーの選択行**） | `active_row_bg`（サイドバーの分）／`surface0` |
  | `--wtm-menu-hover-bg` | ホバーの背景 | （herdr に対応する独立トークン無し） |
  | `--wtm-accent` | 強調の色（フォーカスの枠等） | `accent` |
  | `--wtm-accent-fg` | 強調の上の文字 | （派生。herdr に対応無し） |
  | `--wtm-error-fg` | エラーの文字 | `red` |
  | `--wtm-warn-fg` | 警告の文字 | `peach` |
  | `--wtm-state-blocked`／`working`／`done`／`idle` | 状態アイコンの色 | `red`／`yellow`／`green`／`overlay1` |
  | `--wtm-subtle-bg` | 薄い強調の背景 | （対応無し） |
  | `--wtm-backdrop`／`--wtm-backdrop-strong` | ダイアログ・再接続の幕 | （対応無し） |
  | `--wtm-pane-current` | 選ばれている pane の枠 | `surface0` に近い |

  herdr の `sidebar_bg`・`selection_bg`・`surface1`・`surface_dim`・`overlay0`・`subtext0`・`mauve`・`blue`・`teal` に
  ぴったり対応する本製品の CSS 変数は無い（本製品はサイドバーの背景を独立させていない・上流の Catppuccin 系の中間色を
  そのまま公開していない）。→ **本 work は herdr の 19 トークンではなく、本製品の 19 個の CSS 変数を上書きの対象にする**
  （design で決定。requirements の「対象外」に記載済み）。
- F5: `ThemeController.apply(name)`（`packages/web/src/theme/ThemeController.ts:94-103`）は、**直前に当てた名前と同じなら
  何もしない**（`if (name === this.applied) return;`）。上書きの値だけが変わってテーマの名前（`effectiveTheme`）が変わらない
  場合、この関数を素朴に再利用すると**再適用されない**（早期 return に阻まれる）。`apply` を呼ぶ唯一の経路は
  `watch(() => settings.effectiveTheme, (name) => this.apply(name))`（`ThemeController.ts:75-77`）で、これも
  `effectiveTheme`（テーマ名の解決結果）にしか反応しない——上書きの値の変化では発火しない。
  → **上書きの反映には、`apply()` とは別の経路が要る**（design で「上書きの適用」を新設）。
- F6: `apply()` は `CSS_VARS` を順に `root.style.setProperty(key, tokens.vars[key])` で当てる。インラインスタイル
  なので、`App.vue` の `:root { --wtm-bg: #1e1f29; … }`（起動時のフォールバック）より必ず勝つ。**上書きを同じ
  `root.style.setProperty` で、基本の値の後に当てれば、素直に上書きが効く**（`!important` 等は不要）。
- F7: `uiTokens(name)` はテーマごとにキャッシュされる純粋関数（`uiTokens.ts:361-369`）。呼ぶたびに重い計算をし直さない。
  上書きの適用のたびに `uiTokens(this.applied)` を呼び直しても問題ない。
- F8: 起動用の控え（`theme-boot.js`・`BOOT_KEY`＝`"wtm.themeBoot.v1"`）は `ThemeController.writeBoot()`
  （`ThemeController.ts:105-120`）が**保存された設定（`readPrefs()`）から**作る（このタブの store からではなく。
  20260921-theme-settings review ラウンド 1 の直し）。`BootCache` は `{ auto, fixed, light, dark }`（各 `BootVars`＝
  `{ vars, colorScheme }`）。`public/theme-boot.js` はこれを読み、最初の描画で `:root` に当てる。
- F9: 保存の場所は他の設定と同じ `wtm.prefs.v1`（`readPrefs`/`writePrefs`。`packages/web/src/store/view.ts:42-65`）。
  キー割り当て（`keys`）と同じ「既定との差だけを持つ」規約が、テーマの設定（`theme`・`themeAuto`・`themeLight`・
  `themeDark`）にも既に使われている（`store/settings.ts`）。上書きも同じ規約に合わせる（新しいトップレベルキー、
  例 `themeOverrides`）。
- F10: 色の妥当性判定：**`CSS.supports("color", value)` は使えない**——happy-dom（本リポジトリの単体テストの DOM 実装）では
  常に `true` を返すスタブで、どんな文字列（`"notacolor"`・空文字列・`"__proto__"` 等）も通ってしまう（node で実測。
  `happy-dom` 20 系。`grep -rn "CSS.supports" packages/web` は 0 件——今まで使われていない）。単体テストで拒否側を
  確かめられない検証は、`regression-negative-control` の観点で採用できない。
  **代わりに、実物の要素の `style.color` へ代入して読み戻す方法**が、happy-dom でも実物のブラウザと同じく本物の CSS の
  `<color>` 文法で検証する（happy-dom は `CSSStyleDeclaration` を素朴なスタブにしていない）。実測（node + happy-dom）：
  `el.style.color = "#fff"` → `"#fff"`（通る）、`= "notacolor"` → `""`（拒否）、`= "#gggggg"`（桁の中身が不正）→ `""`
  （拒否）、`= "#12345"`（桁数が不正）→ `""`（拒否）、`= "reset"`（herdr の別名。CSS の色ではない）→ `""`（拒否——
  本製品は herdr の `reset`/`default`/`none` のような別名の値を実装しない方針〔requirements〕と整合する）、
  `= "rgb(1,2,3)"`／`= "hsl(120, 100%, 50%)"`／`= "red"`／`= "transparent"`／`= "inherit"`／`= "currentColor"` は通る
  （実物のブラウザの `<color>` 文法と同じ）。`constructor`・`__proto__` は無害に拒否される（プロトタイプ経由で汚染しない。
  文字列を CSS の値として試すだけで、オブジェクトのプロパティとしては触れない）。
- F11: 既存の類例（自由記述の文字列入力）は `SettingsDialog.vue` の「新しく開く場所」の指定パス欄
  （`pathDraft`。`SettingsDialog.vue:51,186-194,392-403`）：ローカルの draft を `v-model` で持ち、`@change`（blur・
  select 移動等）と `@keydown.enter`（IME 変換中は無視。`isComposing`／`keyCode 229`）で確定する。ただし、この欄は
  クライアント側の検証をしない（サーバが弾く）。色の上書きは**クライアント側で検証**（F10 の方式）し、通らなければ
  理由を示して元の値のまま、という「キー」節の `validateAssignment` と同じ「通れば反映・保存、通らなければ理由」
  パターンに寄せる。

## 影響範囲

- `packages/web/src/theme/uiTokens.ts`：変更なし（計算そのものには触れない。上書きは適用の後段）。
- `packages/web/src/theme/ThemeController.ts`：上書きを保持し、適用する経路を追加。`writeBoot()` にも含める。
- `packages/web/public/theme-boot.js`：変更不要（F8・A7 参照）。
- `packages/web/src/store/settings.ts`：`themeOverrides` の state・setter・保存。
- `packages/web/src/components/SettingsDialog.vue`：節「テーマ」に上書きの UI を追加。
- `docs/herdr-parity.md`（該当行）・`docs/verification.md`・`.aidev/backlog/product-roadmap.md`。

## 実現性 / リスク

- 技術的な障害は無い（CSS カスタムプロパティのインライン設定・`style.color` を使った検証はどちらも標準機能）。
- リスクは規模（19 変数 × 2 明暗＝38 の入力）と、`ThemeController` の適用経路を増やすときに既存の「同じ名前なら
  省く」最適化を壊さないこと（F5）。

## 実装アンカー

- A1: 上書きの適用対象の CSS 変数の一覧（`CSS_VARS`）— `packages/web/src/theme/uiTokens.ts:16-35`
- A2: `ThemeController.apply` の早期 return（上書き変更では発火しない経路）— `packages/web/src/theme/ThemeController.ts:94-103`
- A3: `writeBoot`（控えの作成。保存値から作る）— `packages/web/src/theme/ThemeController.ts:105-120`
- A4: `loadThemePrefs`／`resolveTheme`（テーマ名の解決。上書きのバケツ選びは `uiTokens(name).colorScheme` を使う） —
  `packages/web/src/theme/themes.ts:66-80`
- A5: `wtm.prefs.v1` の読み書き（`readPrefs`/`writePrefs`）— `packages/web/src/store/view.ts:42-65`
- A6: 設定画面「テーマ」節（上書きの UI の置き場所） — `packages/web/src/components/SettingsDialog.vue:296-345` 付近（未確認：
  正確な行は coding 時に読み直す）
- A7: `theme-boot.js`（`packages/web/public/theme-boot.js:1-29`）：`chosen.vars` を key-value でそのまま
  `root.style.setProperty` する素朴なループ。**このファイル自体は変更不要**——`ThemeController.writeBoot()` が
  書く `BootVars.vars` に、上書きをあらかじめマージ済みの値を渡せば、theme-boot 側の読み込みロジックはそのまま働く。

## 実装時の注意

- `ThemeController.apply()` の早期 return（F5）を素朴に外すと、テーマ名が変わらない普通の再描画（例：OS の明暗の
  `matchMedia` イベントが同じ値で 2 回来る等）でも常に `setProperty` を 19 回走らせることになる。上書きの変更だけを
  別経路にすれば、この最適化は保ったまま拡張できる。
- 上書きの「明るいとき」「暗いとき」は、**いま当たっているテーマの `colorScheme`**（`uiTokens(name).colorScheme`）で
  選ぶ。`settings.themeAuto` の真偽では選ばない（F2 の逸脱）——auto が切のまま明るいテーマ 1 つを固定していても、
  「明るいとき」の上書きが効くようにする。
- 「テーマ名 → colorScheme」の対応は既に `uiTokens()` が持つ（`THEME_APPEARANCE` を経由。`@wtm/protocol` にある）ので、
  新しい判定ロジックを増やさずに済む。
- 色の妥当性判定（F10）は DOM の要素が要る（`document.createElement`）。`keys/chord.ts` のような Vue・DOM に依存しない
  純粋関数ではなく、`packages/web/src/theme/` 配下（既に DOM 前提のモジュール群）に置くのが自然。

## design への申し送り

- 保存の形（`themeOverrides` の構造。`{ light: Partial<Record<CssVar,string>>, dark: Partial<Record<CssVar,string>> }`
  のような形を想定。design で確定）。
- `ThemeController` に上書きを渡す経路（コンストラクタ引数か、`apply`/新メソッドの引数か）。
- 色の妥当性判定（F10 の `style.color` 方式）をどこに置くか（`theme/` 配下の新しいモジュールが妥当。`keys/assign.ts` に
  相当する役割）。
- UI の構成（19×2 のどこを `<details>` にするか。1 つの折りたたみの中に「明るいとき」「暗いとき」を並べるか、2 つに
  分けるか）。
