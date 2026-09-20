# 仕様: 選択状態の表示をそろえ、強調をホバーから選択へ移す

## 概要

「いま選ばれているもの」を、**状態ごとに別のプロパティ／別のトークンへ割り当て直す**。
- サイドバー: 「表示中」＝背景（タブと同じトークン）／「navigate のカーソル」＝輪郭線／「ホバー」＝別トークンの背景。
- pane の枠: 「選択中」＝帯の内側に 2px の線。ホバーの強調は廃止。
- 併せて、状態を `aria-current` で支援技術へ渡し、**サイドバーの横スクロールバーの原因 2 つ**
  （2 行目のテキストが縮まない／幅変更のつまみが 3px はみ出す）を潰す。

既存のクラス名は**消さない**（テストと E2E が掴んでいる）。追加と、既存クラスの**宣言の中身**の差し替えで済ませる。

## 設計方針

1. **「持続する状態」は背景、「一時的なカーソル」は線**という語彙にそろえる。
   表示中はページを開いている限り続くので背景（面）で、navigate のカーソルはモードを抜ければ消えるので線（輪郭）。
   この割り当てなら 1 つの行が両方に当たっても**面と線が重なって同時に読める**（AC2）。
   すでにリポジトリ内に前例がある——`.pane-frame-edge:focus-visible`（`PaneFrame.vue:131-135`）が
   一時的な焦点を `outline` で表している。
2. **`sidebar-row-selected` は navigate のカーソルのまま**にし、表示中は**新しいクラス**にする。
   相乗りさせると `workspace-tab-pane.spec.ts:51`（navigate を抜けたら `.sidebar-row-selected` が 0 件）が
   必ず落ちる（requirements の AC9）。
3. **枠の線は `border`** で描く。research F4 のとおり `position: absolute; inset: 0` の要素では
   border が containing block の内側に収まり**外寸が変わらない**。`getComputedStyle` で
   `borderTopWidth` として一意に読めるので AC6 を機械判定できる。`box-shadow` は返り値の並び順が
   仕様から決まらず、`outline` は `:focus-visible` と取り合う（research F5）。
4. **支援技術へは `aria-current`**。`aria-selected` は role の無い `div` では UA が MUST ignore（research F1）。
   pane 側は枠（`role="button"`）に付けると「ボタンが current」になる（research F3）ので、
   **外側の `.pane-frame` を `role="group"` + `aria-label` にして**そこへ付ける。
5. **横スクロールバーは「テキストを縮める」だけでは消えない**。`.sidebar-divider` が
   `right: -3px; width: 6px`（`Sidebar.vue:216-224`）で containing block の外へ 3px はみ出しており、
   **テキストが 1 文字も無くても 3px 分のスクロール領域が常にできる**（実測: `scrollWidth` 243 /
   `clientWidth` 240。つまみを消すと 240/240）。`.sidebar` は `overflow-y: auto` の結果
   `overflow-x` も `auto` に計算されるので、この 3px でスクロールバーが出る。
   **つまみを内側へ寄せて（`right: 0`）原因を断つ**。つまみのドラッグは移動量の差分
   （`Sidebar.vue:87` の `ev.clientX - dragStartX`）で幅を決めるので、位置を 3px ずらしても挙動は変わらない。

## 対象範囲

| ファイル | 変更 |
|---|---|
| `packages/web/src/App.vue` | `:root` に `--wtm-menu-hover-bg` を追加（`App.vue:77-84`） |
| `packages/web/src/components/Sidebar.vue` | 表示中のクラスと `aria-current`（A1）／2 行目の省略（A3・A6）／`overflow-x` とつまみの位置（A4・`:216-224`）／3 状態のスタイル（A5） |
| `packages/web/src/components/PaneFrame.vue` | 選択中のクラス（A7・A8）／`title` 削除（A8）／`:hover` 廃止・`border` 追加（A9）／ルートの role・aria（A8） |
| `packages/web/src/components/Sidebar.test.ts` | 表示中・3 状態・省略の単体テストを追加 |
| `packages/web/src/components/PaneFrame.test.ts` | 選択中のクラス・`title` 不在・`aria-current` の単体テストを追加 |
| `packages/e2e/src/specs/workspace-tab-pane.spec.ts` | AC3（横溢れ）の E2E を追加（git のお膳立てを含む） |
| `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts` | AC5（ホバーで変わらない）・AC6（線の太さ）・AC-I3（選択の移動）の E2E を追加 |
| `docs/verification.md` | `:86` の「ポインタを重ねると色が付き」を実物に合わせて直す（AC5 でホバー強調が無くなるため） |

## 依拠する既存の事実

- `.sidebar-row:hover` と `.sidebar-row-selected` が**同一ルール**で `--wtm-menu-active-bg` を使う（`Sidebar.vue:168-171`）。
- タブのアクティブも `--wtm-menu-active-bg`（`TabBar.vue:85-87`）。`--wtm-menu-border` と同値 `#44475a`（`App.vue:82-83`）。
- `.sidebar` は `overflow-y: auto` だけ（`Sidebar.vue:146`）。1 行目の `.sidebar-label` は
  `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`（`Sidebar.vue:184-188`）だが、
  2 行目の `<span>`（`Sidebar.vue:110-113`・`:126-129`）には無い。
- `.sidebar-row-line2` は `display:flex; gap:0.6em`（`Sidebar.vue:177-183`）。
- `.sidebar-divider` は `position:absolute; top:0; right:-3px; width:6px; height:100%`（`Sidebar.vue:216-224`）。
- 幅のドラッグは差分で決まる（`Sidebar.vue:87`）。ダブルクリックで既定幅へ戻す（`Sidebar.vue:72-77`）。
- spaces の 2 行目は `showGit`＝`!!ws.git && (ahead > 0 || behind > 0)` のときだけ（`Sidebar.vue:32`）。
- `GitInfoPoller` は `git rev-list --left-right --count @{u}...HEAD` で ahead / behind を数え、
  **上流が無ければ 0/0 のまま**（`GitInfoPoller.ts:56-64`）。周期は 5000ms（`GitInfoPoller.ts:5`）で、
  `start()` は workspace 作成より前に呼ばれる（`composeServer.ts:212`）。
- `PaneFrame` の `selected` は `view?.focusedPaneId === props.paneId`（`PaneFrame.vue:43`）で、
  使われているのは `:tabindex`（`PaneFrame.vue:97`）だけ。
- 枠は `v-if="enabled"`（`PaneFrame.vue:93`）。`enabled` が false のとき `session` / `view` を取らない（`PaneFrame.vue:33-34`）。
- `.pane-frame` は `position: relative; box-sizing: border-box`（`PaneFrame.vue:113-118`）、
  `.pane-frame-enabled` が `padding: 4px`（`:120-122`）、`.pane-frame-edge` が `position:absolute; inset:0`（`:123-127`）。
- `.pane-frame-body` が枠の中央に重なるので、Playwright の `locator.hover()` は
  「body がポインタを横取りする」で時間切れになる。既存 E2E は座標を直接指定している
  （`keys-mouse-dialogs.spec.ts:201-203` の `page.mouse.click(area.x + 2, …)`）。
- `--wtm-bg` は `#1e1f29`（`App.vue:78`）。
- `WorkspaceCreateParams` は `cwd` を受ける（`packages/protocol/src/messages.ts`）。
- `Sidebar.vue` は `useViewStore` を既に import 済み（`view.workspaceId` の参照だけが 0 件）。

## インターフェース / データ構造

### 新しい CSS 変数（`App.vue` の `:root`）

```css
--wtm-menu-hover-bg: #343746;   /* --wtm-menu-bg(#282a36) より明るく --wtm-menu-active-bg(#44475a) より暗い */
```

**なぜ新設するか**: 既存の 6 変数はどれも「面の色」として意味が決まっており、
ホバー専用の弱い面が無い。`--wtm-menu-active-bg` を使い回すと 3 状態が同色になる（requirements の背景 2）。

### 新しい CSS クラス

| クラス | 付く条件 | 意味 |
|---|---|---|
| `sidebar-row-current` | `workspace.id === view.workspaceId` | いま表示している workspace |
| `sidebar-git-counts` | 常に（`↑n ↓n` の `<span>`） | 縮ませない印 |
| `pane-frame-edge-current` | `selected`（`PaneFrame.vue:43`） | いま選ばれている pane |

既存の `sidebar-row-selected`（navigate カーソル）と `.pane-frame-edge` は**名前を変えない**。

### ARIA

| 要素 | 属性 |
|---|---|
| サイドバーの workspace 行（`Sidebar.vue:98-105`） | `:aria-current="isCurrent ? 'true' : undefined"` |
| `.pane-frame`（`PaneFrame.vue:91`。`enabled` のときだけ） | `role="group"` + `:aria-label`（pane の名前）+ `:aria-current="selected ? 'true' : undefined"` |

- **値は `true`**（"Represents the current item within a set."）。`location` は「環境や文脈の中の現在位置」で
  フローチャートの現在地のような用途なので、一覧の中の 1 件を指すこの場面は `true` が合う（research F2）。
- **`false` を書かずに属性ごと落とす**。`aria-current` は属性が無ければ既定 `false` で、
  **UA / AT は露出してはならない**（research F2）。
  既存のタブは `:aria-selected="tab.id === view.tabId"` で `false` も出す（`TabBar.vue:50`）が、
  **それは `aria-selected` が「選択可能だが今は非選択」という意味を持つから**で、
  `aria-current` の `false` には対応する意味が無い。流儀が分かれるのはこの違いによる（requirements の AC8）。
- `.pane-frame` を `generic` のままにすると `aria-label` が Prohibited で名前を付けられない（research F3 の選択肢 1）。
  **`role="group"` にして名前を付ける**（選択肢 2）。名前は既存の `label` computed（`PaneFrame.vue:37-41`）を
  流用せず、**メニューではなく pane を指す名前**にする（`pane「build」` / 名前が無ければ `pane`）。
- 枠（`.pane-frame-edge`）の `role="button"` / `aria-haspopup` / `aria-expanded` / `aria-label` は**そのまま**。
  既存の `getByRole` は button・menuitem・separator・alert・alertdialog・tab しか使っていないので、
  `group` を足しても既存のアサートは壊れない。

## 振る舞いの詳細

### サイドバーの 3 状態

```css
/* 1. ホバー（一番弱い。agents 区画の行にも効く） */
.sidebar-row:hover { background: var(--wtm-menu-hover-bg, #343746); }
/* 2. 表示中（タブのアクティブと同じトークン）。:hover と同じ詳細度で、後に置いて勝たせる */
.sidebar-row.sidebar-row-current { background: var(--wtm-menu-active-bg, #44475a); }
/* 3. navigate のカーソル（面ではなく線。表示中と重ねて読める） */
.sidebar-row-selected { outline: 1px solid var(--wtm-fg, #f8f8f2); outline-offset: -1px; }
```

- **詳細度と順序**: `<style scoped>` なので実際には `[data-v-…]` が 1 つ付き、
  `.sidebar-row:hover[data-v-…]` と `.sidebar-row.sidebar-row-current[data-v-…]` はどちらも (0,3,0)。
  **同点なので後に書いたほうが勝つ**。表示中の行にマウスを乗せても表示中の色のままにする
  （持続する状態を一時的な状態で上書きしない）。
- `.sidebar-row-selected` は背景を触らないので、1・2 のどちらとも重なる（AC2）。
- **`sidebar-row-current` は spaces 区画だけ**。agents 区画の行（`Sidebar.vue:118`）には付けない
  （agents 行が指すのは pane で、その選択は枠で表す）。ホバーは両区画で同じ。

### サイドバーの横スクロールバー（原因は 2 つ）

```css
/* 原因 1: 2 行目のテキストが縮まない */
.sidebar-row-line2 > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-git-counts,                       /* ↑n ↓n */
.sidebar-unverified { flex: none; }        /* 「未検証」 */
/* 原因 2: 幅変更のつまみが 3px はみ出す */
.sidebar-divider { right: 0; }             /* -3px から変更 */
/* 歯止め */
.sidebar { overflow-x: hidden; }
```

- 縮むのは**ブランチ名とエージェント名だけ**。`↑n ↓n` と「未検証」は `flex: none` で縮ませない
  （requirements の機能要件）。`↑n ↓n` の `<span>`（`Sidebar.vue:112`）に
  `class="sidebar-git-counts"` を足す。
- **効いているのは `> span` の `overflow: hidden` だけ**（flex アイテムの main 軸の自動最小サイズが 0 になる）。
  `.sidebar-row-line1` / `.sidebar-row-line2` は `.sidebar-row`（`flex-direction: column`）の
  flex アイテムなので cross 軸の `min-width` は既に 0 相当、`.sidebar-row` 自体は `<section>` 直下の
  ブロックで flex アイテムですらない。**したがって `min-width: 0` は足さない**（no-op になるだけ）。
- `overflow-x: hidden` は「今は出ているスクロールバーを止める」ための宣言で、飾りではない
  （`overflow-y: auto` だけだと `overflow-x` は `auto` に計算され、3px でもスクロールバーが出る）。
  ただし `hidden` でも**スクロール領域は残る**ので、`scrollWidth` は原因 1・2 を直さないと縮まない。
- 折りたたみ時（`.sidebar-collapsed`。`width: 3em`）は 2 行目もラベルも `v-if` で描かれない
  （`Sidebar.vue:108`・`:110`・`:121`・`:126`）ので、残るのは状態アイコン（`0.6em`）と
  `padding: 0.4em 0.8em` だけ。原因 2 を直せば折りたたみ時も溢れない。

### pane の枠

```css
/* .pane-frame-edge:hover のルールは削除する（AC5） */
.pane-frame-edge-current { border: 2px solid var(--wtm-menu-border, #44475a); }
```

- `border-style` を必ず書く（`solid`）。書かないと width が 0 になる（research F4）。
- `.pane-frame-edge` は `inset: 0` なので border は内側に収まり、`.pane-frame-enabled` の
  `padding: 4px` は変わらない（AC6 の後半。実測で確認済み）。見た目は**4px 帯の外側 2px が塗られ、
  内側 2px は地のまま**。
- `:focus-visible`（`PaneFrame.vue:131-135`）は**そのまま残す**。`outline` は `border` と別プロパティなので
  重ねて描ける。キーボードの焦点は選択より強い一時的な合図として区別する（requirements の非機能要件）。
  なお `outline-offset: -1px` の線は border box の内側 1〜2px に出るので、**2px の選択線の内側 1px に重なる**。
  今は `--wtm-menu-border` と `--wtm-menu-active-bg` が同色なので見え方は変わらないが、
  **backlog 1（色を変える）を実施すると焦点時に選択線が 1px 食われる**——そのときに一緒に見直す。
- 色は `--wtm-menu-border`（これまでホバーで使っていた色）。地色とのコントラストの件は
  requirements の非機能要件のとおり backlog へ送る。

### 状態の組み合わせ

| 状況 | サイドバーの行 | pane の枠 |
|---|---|---|
| 何もしていない | 地のまま | 選択中の pane だけ 2px の線 |
| マウスを乗せた | 弱い背景 | **変わらない** |
| 表示中 | タブと同じ背景 | — |
| 表示中 + マウス | タブと同じ背景（ホバーは負ける） | — |
| navigate 中のカーソル | 輪郭線（背景は下の状態のまま） | — |
| 枠にキーボード焦点 | — | `:focus-visible` の帯の全面塗り＋`outline`（選択線はその下） |

## エラー処理 / 異常系

- `view.workspaceId` が null（どの workspace も表示していない）→ どの行にも `sidebar-row-current` が付かず、
  `aria-current` も付かない。`Sidebar.vue` は `view.workspaceId` を読むだけなので例外は起きない。
- `view.focusedPaneId` が null → どの枠にも `pane-frame-edge-current` が付かない。
- `enabled` が false（モバイル）→ 枠そのものが描かれない（`PaneFrame.vue:93`）。
  ルートの `role` / `aria-label` / `aria-current` も**`enabled` のときだけ**付ける
  （false のとき `session` / `view` が null なので、名前を作れない。`PaneFrame.vue:33-34`）。
- 上流が無い git リポジトリ → `ahead=behind=0` で 2 行目は描かれない（`GitInfoPoller.ts:56-64`）。
  これは既存の仕様であり変えない。AC3 の E2E は**上流を張って**お膳立てする。
- CSS 変数が未定義の環境 → 既存の流儀どおり `var(--x, <既定値>)` の第 2 引数で落とす。

## ドメイン固有の考慮

- **PTY の大きさに影響させない**。`padding` を触らない設計にしてあるので、`client.view` →
  `SizeAuthority` の経路（D106）と、pane の大きさを測る E2E の期待値は変わらない。
  つまみの位置（`right`）も `.sidebar` の幅を変えないので、pane の幅にも影響しない。
- **モバイルには届かない**（`App.vue:41-43`）。`MobileShell` は `Sidebar` を描かず、
  `PaneLayout` へ `pane-frames` を渡さない。

## 受け入れ基準との対応

- AC1: `Sidebar.vue` の workspace 行に `sidebar-row-current` を束縛し、`.sidebar-row.sidebar-row-current` で
  `--wtm-menu-active-bg` を使う。入力の出所は `useViewStore().workspaceId`（`store/view.ts`。
  `Sidebar.vue` は `useViewStore` を import 済みで、このプロパティを新たに読む）。
- AC2: 上の「サイドバーの 3 状態」の 3 つの宣言が、3 状態と 1 対 1 に対応する
  （ホバー＝`--wtm-menu-hover-bg` の背景／表示中＝`--wtm-menu-active-bg` の背景／カーソル＝`outline`）。
  面と線なので同時に読める。単体テストで 2 クラスが同時に付くことを確かめる。
- AC3: 上の「サイドバーの横スクロールバー」の宣言群。入力の出所は `workspace.git`（`GitInfoPoller` が埋める）と
  `pane.agent.label`。E2E のお膳立てと判定は次のとおり。
  - 一時ディレクトリに `git init --bare` の原本を作り、clone して
    **区切り文字（`-` `/` `_`）を含まない長いブランチ名**（折り返せる機会が無いと横へ溢れる）で
    `git push -u`（**上流が無いと ahead が 0 のままで 2 行目が描かれない**）、さらに空コミットを 1 つ足して ahead=1 にする。
  - その作業ツリーを `workspace.create` の `cwd`（`WorkspaceCreateParams`）に渡す。
  - `GitInfoPoller` は 5000ms 周期で workspace 作成より後の周回で拾うので、
    2 行目が出るのを **`expect.poll`（timeout 15s）**で待つ（既定の 5s では足りない）。
  - 判定は `.sidebar` の `scrollWidth <= clientWidth` を、既定幅と折りたたみ時（`prefix+b`）の両方で。
    **修正前は落ちる**（つまみの 3px だけで 243/240、長いブランチ名があるとさらに広がる）。
- AC4: `pane-frame-edge-current` を `selected`（`PaneFrame.vue:43`）に束縛。色は `--wtm-menu-border`。
  入力の出所は `useViewStore().focusedPaneId`。単体テストで、選択を移すとクラスが移ることを確かめる。
- AC5: `.pane-frame-edge:hover`（`PaneFrame.vue:128-130`）のルールを削除。E2E は
  **`page.mouse.move(area.x + 2, …)` で 4px 帯の座標を直接指す**（`locator.hover()` は
  `.pane-frame-body` に横取りされて時間切れになる。`keys-mouse-dialogs.spec.ts:201-203` と同じ流儀）。
  ポインタを乗せる前後で `backgroundColor` と `borderTopWidth` が一致することを確かめる。
- AC6: `border: 2px solid`。E2E で選択中の枠の `borderTopWidth === "2px"` と、
  `.pane-frame` の `paddingTop === "4px"` を確かめる。
- AC7: `PaneFrame.vue:101` の `title` を削除。`aria-label`（`:100`）は残す。単体テストで確かめる。
  併せて `docs/verification.md:86` の記述（ポインタを重ねると色が付く）を直す。
- AC8: `aria-current="true"` を、表示中の workspace 行と、選択中の pane の `.pane-frame`
  （`role="group"` + `aria-label`）に付ける。付かない側は属性ごと無い。単体テストで確かめる。
- AC9: クラス名を消さないので既存テストはそのまま通る。`workspace-tab-pane.spec.ts:51` は
  `sidebar-row-selected` を navigate 専用のまま残すので通る。`Sidebar.test.ts:68-83`（git 2 行目のテキスト）は
  `<span>` を増やさないので通る（`↑n ↓n` の span に class を足すだけ）。
  `terminal-app.spec.ts:235`（折りたたみ）はつまみの位置を変えても `.sidebar` の幅が変わらないので通る。
- AC-I1: 開閉する部品を足さない。枠の右クリックメニューの結線（`PaneFrame.vue:73-76`）を変えない。
  既存 E2E（`keys-mouse-dialogs.spec.ts:232-244`）の通過で確認。
- AC-I2: 確定・取り消しを伴う操作を足さない。`view.focusPane` の意味を変えない。既存テストの通過で確認。
- AC-I3: `prefix+h/j/k/l`（`keymap.ts:30-33` の `focusDir`）で選び直すと `pane-frame-edge-current` が移ることを
  E2E（`keys-mouse-dialogs.spec.ts` の 2 ペインのテスト）で確かめる。
- AC-I4: `:tabindex`（`PaneFrame.vue:97`）と `:focus-visible`（`:131-135`）を変えない。
  既存 E2E（`keys-mouse-dialogs.spec.ts:252-255`）の通過で確認。
- AC-I5: マウスの結線（`onMouseDown` / `onContextMenu` / `MouseBridge`）を変えない。既存 E2E の通過で確認。

## backlog へ送るもの（deliver で起票）

1. **強調色のコントラスト**: 選択中の枠の色 `--wtm-menu-border`（`#44475a`）は、pane の地色
   `--wtm-bg`（`#1e1f29`）との輝度比が約 1.8:1 で、非テキスト要素の目安 3:1 を下回る。
   現行のホバー強調と同条件なので退行ではないが、色を選べるようにするのは「外観と設定」（H21 / H24）の範囲。
   **直すときは `:focus-visible` の `outline-offset: -1px` が選択線の内側 1px に重なる点も一緒に見直す**。
2. **同色の衝突（`--wtm-menu-border` と `--wtm-menu-active-bg` がどちらも `#44475a`）**: spaces 区画の
   **最後の行が「表示中」のとき、その行の背景と `.sidebar-agents` の `border-top` が同色になり、
   区切り線が見えなくなる**（横断の点検が指摘）。以前は navigate のカーソルが乗った一瞬だけだったが、
   「表示中」は常時付くのでこの状態が続きうる。上の 1 と同じ根（2 つのトークンが同値）なので、
   色を分けるときに一緒に直す。
3. **xterm.js のカーソルの描き方**: `cursorStyle` / `cursorInactiveStyle` をリポジトリで一度も設定しておらず
   （`TerminalRegistry.ts:172-177`）、非フォーカスの pane のカーソルの見え方が xterm.js の既定任せ。
