# 調査: 選択状態の表示をそろえ、強調をホバーから選択へ移す

requirements の「未確定事項」3 件（ARIA 属性の選び方・枠を細く描く CSS・3 状態の描き分け）を、
一次資料（W3C / MDN）とリポジトリの実物で埋める。**設計判断は design へ送る**。

## 調査の問い

- Q1: role を持たない `<div>` の行の一覧で「今表示中の 1 行」を示すのは `aria-current` か `aria-selected` か。
- Q2: `role="button"` のメニューボタン（pane の枠）に「この pane が選ばれている」を表す属性を付けてよいか。
- Q3: 外寸（`padding: 4px`）を変えずに内側へ 2px の線を描く CSS はどれか。`getComputedStyle` で機械的に読めるか。
- Q4: 変更の起点になる実装アンカーはどこか。

## 判明した事実

### F1: `aria-selected` は role の無い `div` では**使えない**（UA が無視する）

- `aria-selected` の **Used in Roles は `gridcell` / `option` / `row` / `tab`**、Inherits into Roles は
  `columnheader` / `rowheader` / `treeitem` だけ（WAI-ARIA 1.2 §aria-selected。
  https://www.w3.org/TR/wai-aria-1.2/#aria-selected ）。
- WAI-ARIA 1.2 §8.6 は **「role が対応していない要素に置かれた非 global の state / property を、
  UA は MUST ignore」**と規定する（ https://www.w3.org/TR/wai-aria-1.2/#x8-6-state-and-property-attribute-processing ）。
  素の `div` の暗黙 role は `generic` で、その states 一覧に `aria-selected` は無い。
- MDN も同旨で、**「他の role では、現在選択されている状態は `aria-current` で表す」**と明記
  （ https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-selected ）。

### F2: `aria-current` は **global state** なので、role の無い `div` でも有効

- WAI-ARIA 1.2 §6.5 Global States and Properties の一覧に `aria-current (state)` が含まれる
  （ https://www.w3.org/TR/wai-aria-1.2/#global_states ）。Used in Roles は "All elements of the base markup"。
- 値（ https://www.w3.org/TR/wai-aria-1.2/#aria-current ）: `page` / `step` / `location` / `date` / `time` /
  `true`（**"Represents the current item within a set."**）/ `false`（既定）。
  一覧外の値は AT が `true` として扱う SHOULD。属性が無い／空なら `false` で、**UA / AT は露出してはならない**。
- 作者向けの規範:
  - "Authors **SHOULD** only mark one element in a set of elements as current with `aria-current`."
  - "Authors **SHOULD NOT** use `aria-current` as a substitute for `aria-selected` in widgets where
    `aria-selected` has the same meaning."（例として `tablist` の `tab` を挙げる）
    → サイドバーの行は `tablist` でも `listbox` でもないので、この禁止には当たらない。
- **リポジトリに `aria-current` の使用例は無い**（grep 0 件）。既存の選択の表し方は
  `TabBar.vue:42`（`role="tablist"`）+ `:45`（`role="tab"`）+ `:50`（`:aria-selected`）、
  `GotoPicker.vue:297`（`role="listbox"`）+ `:301`（`role="option"`）+ `:304`（`:aria-selected`）の 2 例で、
  **どちらも role を明示している**。サイドバーの行（`Sidebar.vue:98-105`・`:118`）は role 無しの素の `div`。

### F3: pane の枠（`role="button"`）に `aria-current` を付けると「ボタンが current」になる

- `button` role の Inherited States and Properties に `aria-current` は含まれるので**無視はされない**
  （ https://www.w3.org/TR/wai-aria-1.2/#button ）。
  しかし `aria-current` の定義は「集合の中の**現在の項目を表す要素**」なので、accessibility tree 上は
  `aria-label="pane「x」のメニュー"` を持つ**メニューボタンが current** と露出する。
- `button` の Supported States and Properties は `aria-disabled` / `aria-haspopup` / `aria-expanded` /
  `aria-pressed` のみ。`aria-pressed` は**トグルボタンの押下状態**を意味するので、選択状態とは意味が違う。
- APG の Menu Button パターンに選択状態の規定は**無い**
  （ https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ 。確認したが該当記述なし）。
- 一次資料に基づく置き場所の選択肢:
  1. 外側の `.pane-frame`（`PaneFrame.vue:91`。現状 role 無し＝`generic`）に `aria-current`。
     `generic` の Inherited States and Properties に `aria-current` があるので有効。
     **ただし `generic` は `aria-label` / `aria-labelledby` が Prohibited**（Name From: prohibited）なので、
     この要素に名前は付けられない（名前の無い要素の current は AT に伝わりにくい）。
  2. `.pane-frame` を `role="group"` + `aria-label` にして `aria-current` を付ける。
     `group` は Name From: author なので `aria-label` を置ける（ https://www.w3.org/TR/wai-aria-1.2/#group ）。
  3. `role="region"` 等の landmark にする（§group: 目次に載せる価値があるなら region）。
  4. 枠の `aria-label`（`PaneFrame.vue:37-41` の `label`）に状態を織り込む（一次資料に可否の記述なし）。
  5. `aria-selected` は `button` の Used in Roles に無いので **MUST ignore**（使えない）。

### F4: `position: absolute` + `inset: 0` の要素に `border` を付けても**外寸は変わらない**

- CSS Position 3 の絶対配置の制約式（ https://www.w3.org/TR/css-position-3/#abs-non-replaced-width ）:
  `left + margin-left + border-left-width + padding-left + width + padding-right + border-right-width
  + margin-right + right = containing block の幅`（高さも同様）。
  `left/right/top/bottom` が 0・`margin` 0・`width/height: auto` なら、**border の分だけ `width` が縮んで解かれる**。
  → border は containing block の内側に収まり、はみ出さない。
- `.pane-frame-edge` の containing block は `.pane-frame`（`PaneFrame.vue:114` の `position: relative`）の
  **padding box**。`.pane-frame` に border は無いので padding box ＝ 要素の全面で、
  edge は 4px の帯を含む pane 全面を覆う。border 2px はその**全面矩形の内周**に描かれる
  （＝見た目は 4px 帯の外側 2px が塗られ、内側 2px は地のまま）。
- `box-sizing` は継承されない。`PaneFrame.vue:115` の `box-sizing: border-box` は `.pane-frame` にだけ効く
  （リポジトリに `*` へのグローバル指定は無い。grep で `PaneFrame.vue:115` と `HelpDialog.vue:266` の 2 箇所のみ）。
  ただし上の制約式により、content-box でも結論は同じ。
- `getComputedStyle` で読めるのは `borderTopWidth` 等（"2px"）・`borderTopStyle`・`borderTopColor`。
  **`border-style` を付け忘れると width は 0 になる**（CSS Backgrounds 3 §3.2: "No border. Color and width are ignored"）。

### F5: `box-shadow: inset` と `outline` もレイアウトに影響しないが、いずれも難点がある

- `box-shadow`: "Shadows do not influence layout"（CSS Backgrounds 3 §6.1.3
  https://drafts.csswg.org/css-backgrounds-3/#shadow-layers ）。inset は padding box の内側にクリップされる。
  **難点**: `getComputedStyle` の返り値は単一の `boxShadow` 文字列で、**並び順（色が先か `inset` が先か）が
  仕様から一意に決まらない**（Canonical order: per grammar）。E2E で完全一致は取れない。
- `outline` + 負の `outline-offset`: "Outlines do not take up space"、負値は border box の内側へ縮む
  （CSS UI 4 §3・§3.5 https://drafts.csswg.org/css-ui-4/#outline-offset ）。
  **難点**: `.pane-frame-edge:focus-visible`（`PaneFrame.vue:131-135`）が**既に `outline` と
  `outline-offset: -1px` を使っている**ので、同じ要素で同じプロパティを取り合う。
- ヒットテストへの影響は **CSS 仕様に規範定義が無い**（CSS UI 4 §5.1.1 が
  "The specifics of hit testing are out of scope of this specification" と明言）。
  ただし border / box-shadow / outline のいずれも border edge を変えないので、ヒット領域は変わらないと読める。

### F6: サイドバーの 2 行目が描かれる条件

`Sidebar.vue:32` の `showGit` は **`!!ws.git && (ws.git.ahead > 0 || ws.git.behind > 0)`**。
つまり E2E で spaces 区画の 2 行目を描かせるには、**上流を持ち 1 コミット以上 ahead（または behind）の
git リポジトリ**を cwd にした workspace が要る。`workspace.create` は `cwd` を受け取れる
（`packages/protocol/src/messages.ts` の `WorkspaceCreateParams`）。

## 影響範囲

- `Sidebar.vue`（テンプレート 2 箇所・スタイル 6 箇所）／`PaneFrame.vue`（テンプレート 2 箇所・スタイル 2 箇所）／
  `App.vue`（`:root` の変数）。いずれもデスクトップ側だけ（`App.vue:41-43`）。
- 既存テスト: `Sidebar.test.ts:68-83`（git 2 行目）・`:108-116`（navigate 選択）、
  `PaneFrame.test.ts:79-98`・`:115-129`・`:132-146`（属性系）。
- 既存 E2E: `keys-mouse-dialogs.spec.ts:232,252-255,281`、`workspace-tab-pane.spec.ts:24,44,51,62,68`、
  `agent-detection.spec.ts:87`、`terminal-app.spec.ts:235`。

## 実現性 / リスク

- F4 により、**枠の線は `border` で描くのが最も素直**（外寸が変わらず、`getComputedStyle` で
  `borderTopWidth` として一意に読め、既存の `outline`（`:focus-visible`）と衝突しない）。
- F1・F2 により、**サイドバーの行は `aria-current` 一択**（`aria-selected` は仕様上無視される）。
- F3 により、**pane 側は枠（`role="button"`）ではなく外側の要素に付ける**のが筋。
  名前を付けられる形にするなら `role="group"` + `aria-label` が要る。
- F6 により、AC3 の E2E は **git リポジトリのお膳立てが必要**（一時ディレクトリに bare を作って clone し、
  長い名前のブランチで 1 コミット進める）。ここを省くと 2 行目が 1 度も描かれないまま AC3 が通ってしまう。

## 実装アンカー

- A1: サイドバーの workspace 行の `v-for` とクラス束縛（`packages/web/src/components/Sidebar.vue:98-105`。
  `v-for` は `:99`、`:class` は `:102`）
- A2: サイドバーの agents 行（`Sidebar.vue:118`。**`:class` の動的束縛は無い**）
- A3: 2 行目の `<span>` 群（workspace 側 `Sidebar.vue:110-113`、agents 側 `:126-129`）
- A4: `.sidebar` の overflow（`Sidebar.vue:146`。`overflow-y: auto` のみ）
- A5: `.sidebar-row:hover, .sidebar-row-selected` の同一ルール（`Sidebar.vue:168-171`）
- A6: `.sidebar-row-line2` / `.sidebar-label` / `.sidebar-unverified` のスタイル
  （`Sidebar.vue:177-183` / `:184-188` / `:213-215`）
- A7: `PaneFrame` の `selected` computed（`PaneFrame.vue:43`）と唯一の束縛箇所（`:97` の `:tabindex`）
- A8: `PaneFrame` のルート要素（`PaneFrame.vue:91`）と枠要素（`:92-105`。`role` は `:96`、
  `aria-label` は `:100`、**`title` は `:101`**）
- A9: `.pane-frame-edge:hover`（`PaneFrame.vue:128-130`）と `:focus-visible`（`:131-135`）
- A10: `App.vue` の `:root`（`App.vue:77-84`。`--wtm-bg` `:78` / `--wtm-menu-border` `:82` /
  `--wtm-menu-active-bg` `:83`）
- A11: 既存テスト（`Sidebar.test.ts:68-83`・`:108-116`、`PaneFrame.test.ts:79-98`・`:115-129`・`:132-146`）

## 実装時の注意

- `border` を使うなら **`border-style` を必ず添える**（F4 の最後）。
- `.pane-frame-edge` は `enabled` のときだけ描かれる（`PaneFrame.vue:93` の `v-if="enabled"`）。
  モバイルでは `enabled=false` なので枠の変更は届かない。
- `PaneFrame` は `enabled` が false のとき `session` / `view` のストアを取らない
  （`PaneFrame.vue:32-33` の `props.enabled ? useStore() : null`）。
  ルート要素に pane の名前を出す属性を足すなら、**`enabled` のときだけ**にしないと null 参照になる。
- `.sidebar-row:hover` は **agents 区画の行にも効く**（`Sidebar.vue:118` も `class="sidebar-row"`）。
- 1 行目の `.sidebar-label` が既に縮むのは、flex アイテムに `overflow: hidden` があると
  自動最小サイズが 0 になるため。2 行目の `<span>` には `overflow` が無いので縮まない（これが横溢れの原因）。

## design への申し送り

- `aria-current` の**値**（`true` か `location` か）と、pane 側の**付与先**（F3 の選択肢 1〜4）は design で決める。
- 枠の線は F4・F5 の比較から `border` を推す材料が揃っている。採否と太さ（2px 以下）を design で確定する。
- 3 状態の描き分けは「表示中＝背景（タブと同じトークン）／navigate カーソル＝背景以外／ホバー＝別トークンの背景」の
  形にすれば AC2 の「1 対 1 で辿れる」を満たせる。具体のトークン名と値は design で決める。
- AC3 の E2E の git のお膳立て（F6）を tasks に 1 タスクとして立てる。
- 未確認のまま残したもの: `boxShadow` の返り値の並び順、`outline-style: none` のときの `outlineWidth`、
  hit testing の規範定義。**いずれも `border` を選べば関係しなくなる**。
