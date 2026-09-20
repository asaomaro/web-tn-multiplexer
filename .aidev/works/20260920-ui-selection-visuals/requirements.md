# 要件: 選択状態の表示をそろえ、強調をホバーから選択へ移す

## 背景 / 課題

利用者から、画面の「いまどれが選ばれているか」が読み取れないという指摘が 4 件挙がった。
**1〜4 の現状はリポジトリのコードで裏が取れている。5 は利用者が実物を見ての評価**（コードからは出てこない）。

1. **サイドバーの workspace 行に、表示中であることを示す常時の見た目が無い。**
   `Sidebar.vue:102` の選択クラスは `view.mode === 'navigate' && view.navigateSelection === workspace.id`
   だけを見ており、`Sidebar.vue` は **`view.workspaceId` を一度も参照していない**（出現 0 件）。
   一方タブは `TabBar.vue:49` の `tab-bar-item-active`（`TabBar.vue:85-87`）で**常時**ハイライトされる。
   同じ「いま見ているもの」なのに、タブとサイドバーで扱いが非対称になっている。
2. **サイドバーの 3 つの状態が同じ色で潰れている。** `Sidebar.vue:168-171` は
   `.sidebar-row:hover` と `.sidebar-row-selected` を**同一のルール**にまとめ、どちらも
   `--wtm-menu-active-bg` を使う。この変数は `TabBar.vue:85-87` のアクティブタブと同じ値で、
   さらに `App.vue:82-83` で `--wtm-menu-border` とも同色（どちらも `#44475a`）。
   したがって「表示中」を素直にタブと同じトークンで足すと、**ホバー・navigate カーソル・表示中の 3 つが
   同じ見た目になる**。3 つを見分けられるようにするには、ホバーか navigate カーソルの側も変える必要がある。
3. **サイドバーの一覧に横スクロールバーが出る。** `Sidebar.vue:146` は `overflow-y: auto` だけを指定しており、
   CSS の overflow は片方が `visible` 以外だと他方の `visible` も `auto` に計算されるため、横にもスクロールバーが出る。
   横に伸びる原因は 2 行目（`.sidebar-row-line2`。`Sidebar.vue:177-183`）の中の `<span>`
   （ブランチ名・`↑n ↓n`・エージェント名・「未検証」。`Sidebar.vue:110-113`・`126-129`）に
   `text-overflow: ellipsis` も `min-width: 0` も無いこと。1 行目のラベルには ellipsis がある（`Sidebar.vue:184-188`）。
   溢れる `<span>` は spaces 区画と agents 区画の**両方**にある。
   なお spaces 区画の 2 行目は `showGit`（`Sidebar.vue:32`）が真のときだけ描かれ、条件は
   **`ws.git` があり、かつ `ahead > 0` または `behind > 0`**。
4. **選ばれている pane に見た目が無い。** `PaneFrame.vue:43` の `selected`
   （`view.focusedPaneId === props.paneId`）は `:tabindex`（`PaneFrame.vue:97`）にしか使われておらず、
   対応する CSS クラスが無い。**強調はホバーでだけ起きる**（`PaneFrame.vue:128-130` の
   `.pane-frame-edge:hover`）——マウスを置いた場所が光るだけで、選択とは無関係。
   さらに枠には `title="右クリックで pane のメニュー"`（`PaneFrame.vue:101`）のツールチップがあり、
   枠の上にマウスを置くたびに出る。
   なお現状、選ばれている pane を見分ける手掛かりは端末（xterm.js）のカーソル描画だけで、
   **本 PJ はその描き方を設定していない**（`cursorStyle` / `cursorInactiveStyle` の指定はリポジトリ全体で 0 件。
   `TerminalRegistry.ts:172-177` の `new Terminal({...})` は既定のまま）。
5. **強調される枠が太い**（利用者の評価）。枠の実体は `padding: 4px` の縁（`PaneFrame.vue:120-122`）で、
   ホバー時はその 4px 帯が**全面塗り**になる（`PaneFrame.vue:128-130`）。

`docs/herdr-parity.md:38`（H19「サイドバー・折りたたみ・ソート」＝ MVP は既定の表示だけ）のとおり、
サイドバーの見せ方は最小限に留めていた。その最小限が実際に使うと読み取れなかった、というのがこの work の起点。

参考（herdr `da6bcd5` の実装）:
- **herdr にペイン境界のホバー強調は無い**。境界の色は `focused ? accent : overlay0` の 2 値だけで、
  線の太さも変わらない（`src/ui/panes.rs:481-495`）。
- herdr のサイドバーは「表示中（`active_row_bg`）」と「navigate カーソル（`selection_bg`）」を**別の色で**描き、
  タブのアクティブ（`accent`）とも違う色を使う（`src/client/shell/sidebar.rs:297-307`・`tabs.rs:103-116`）。
  ただし herdr のその 2 つは `if / else if` の**排他**で、同時には描かない（`sidebar.rs:301-307`）。
  本 work の AC2 はそれより強く「同時に読み取れる」ことを求める（1 つの行が表示中かつ navigate 選択中に
  なるのは通常の操作で起きるため）。

## 目的 / ゴール

- サイドバーを見れば、**いま表示しているワークスペースがどれかが、モードに関係なく分かる**状態。
- サイドバーの上で、**「表示中」「キーボードのカーソル」「マウスが乗っている」の 3 つが取り違えられない**状態。
- サイドバーの一覧が**横に溢れず、横スクロールバーが出ない**状態。
- **いま選ばれている pane が枠の見た目で分かる**状態。強調はマウスの位置ではなく選択で決まる。
- 枠にマウスを置いても**説明のツールチップが出ない**状態。
- 上記が**目に見える形だけでなく、支援技術にも伝わる**状態（色だけで伝えない）。

## ユーザーストーリー

- US1: **wtm を使う人**として、サイドバーを見ただけで今どのワークスペースにいるかを知りたい。
  なぜなら、タブは常時ハイライトされるのにサイドバーはされず、workspace を複数持つと現在地を見失うから。（受け入れ: AC1, AC2）
- US2: **wtm を使う人**として、サイドバーの一覧を横スクロールせずに読みたい。
  なぜなら、長いブランチ名やエージェント名があるだけで横スクロールバーが出て、縦の一覧が読みにくくなるから。（受け入れ: AC3）
- US3: **pane を分割して使う人**として、今どの pane に入力が行くかを枠で知りたい。
  なぜなら、端末のカーソルの形だけが手掛かりでは、pane が増えるほど見分けられないから。（受け入れ: AC4）
- US4: **マウスで操作する人**として、マウスを動かしただけで画面が光らないでほしい。
  なぜなら、選択と無関係な強調とツールチップが、どれが選ばれているかの判断を邪魔するから。（受け入れ: AC5, AC7）
- US5: **pane を分割して使う人**として、選択の枠が主張しすぎないでほしい。
  なぜなら、4px の帯が全面塗りになると端末の文字より枠のほうが目立ち、かえって読みにくいから。（受け入れ: AC6）
- US6: **スクリーンリーダーを使う人**として、今どの workspace / pane が選ばれているかを知りたい。
  なぜなら、背景色だけで表した状態は支援技術に届かないから。（受け入れ: AC8）

**AC9 はどの US にも紐づかない**——既存の振る舞いを壊していないことを求める回帰の基準で、
新しい価値ではないため（非機能側の基準として `完了条件` に並べる）。

## スコープ

### 対象
- `packages/web/src/components/Sidebar.vue`
  （表示中の行の見た目と意味論／navigate カーソルとホバーの描き分け／行の横方向の縮み）
- `packages/web/src/components/PaneFrame.vue`
  （選択中の枠／ホバー強調の廃止／ツールチップの削除／選択の意味論）
- `packages/web/src/App.vue`（3 つを描き分けるために配色トークンを増やす場合のみ。AC2 の手段）
- 上記の既存テスト（`Sidebar.test.ts` / `PaneFrame.test.ts`）と、回帰テストの追加
- **計算後のスタイルを見ないと判定できない受け入れ基準（AC3・AC5・AC6）の E2E**
  （`packages/e2e/src/specs/` の既存 spec に足す）

### 対象外
- サイドバーの行の内容・並び順・折りたたみボタン・ソート（別 work「サイドバーとタブバーの操作」で扱う）
- 配色そのもののカスタマイズ機構・テーマ切替
  （`docs/herdr-parity.md:40` の H21「サイドバーの行の色の条件付け・独自トークン」と `:43` の H24「テーマ」。
  pane の枠の設定は `:42` の H23。いずれも後続「外観と設定」）
- モバイル（`MobileShell.vue`）の画面。`App.vue:41-43` のとおりモバイルでは `MobileShell` を描くので
  `Sidebar` は現れず、`PaneFrame` を描く `PaneLayout.vue:178` へ `pane-frames` を渡すのもデスクトップ側だけ
  （`App.vue:56`。`MobileShell.vue:90-101` は渡さない）。この work の変更はモバイルに届かない
- 端末（xterm.js）側のカーソル描画の設定（背景 4 の後半）。backlog へ送る

## 機能要件

- サイドバーの workspace 行は、`view.workspaceId` と一致する行を**常時**ハイライトする。
  ハイライトはタブバーのアクティブタブと同じ配色トークン（`--wtm-menu-active-bg`）を使う。
- 背景 2 のとおりそれだけでは 3 つが同色になるので、**ホバーと navigate カーソルは別の表し方にする**。
  少なくとも「表示中」とは別のトークン、または背景以外のプロパティ（輪郭線など）で区別する。
- **「表示中」は workspace 行だけの状態**。agents 区画の行には付けない（agents 行が指すのは pane で、
  その選択は pane の枠で表す）。ホバーの扱いは spaces / agents の両区画で同じでよい。
- サイドバーの行は横に溢れない（長い文字列は省略記号で切る）。spaces と agents の両区画で成り立つこと。
- **縮めてよいのはブランチ名とエージェント名だけ**。`↑n ↓n`（`Sidebar.vue:111`）と
  「未検証」（`Sidebar.vue:128`）は情報量が小さく省略すると意味を失うので、縮めない。
- pane の枠は、選ばれている pane のときだけ強調する。ホバーでは強調しない。
- 強調する枠は、4px の帯を全面塗りにするのではなく、**帯の内側に細く**描く。
- 枠の `title` 属性を外す（`aria-label` は支援技術のために残す）。
- 表示中の workspace と選択中の pane は、支援技術にも状態として伝わるようにする。

## 非機能要件 / 制約

- **pane の枠の外寸（`.pane-frame-enabled` の `padding: 4px`）を変えない**。端末の使える大きさが変わると
  PTY の行・列が変わり、`client.view` → `SizeAuthority` の経路と、pane の大きさを確かめている
  E2E（`keys-mouse-dialogs.spec.ts` / `terminal-app.spec.ts`）の期待値に波及する。
  細く見せるのは枠の**描き方**（帯の内側に描く）で行い、帯の外へはみ出さない。
- **`:focus-visible` の見た目（`PaneFrame.vue:131-135`）は現状のまま残す**。これは 4px 帯を
  `--wtm-menu-active-bg` で全面塗りする、US5 が問題にしたのと同じ描き方だが、
  **キーボードの焦点は「選択」より強い一時的な合図**として区別したいので、意図して据え置く
  （マウス操作では出ない。`PaneFrame.vue:66-70` がクリック時に焦点を端末へ渡すため）。
- roving tabindex（`PaneFrame.vue:97`）を変えない。
- **強調の色は利用者の指定どおり、これまでホバーで使っていた色（`--wtm-menu-border` = `#44475a`）を使う**。
  pane の地色（`--wtm-bg` = `#1e1f29`。`App.vue:78`）との輝度比は約 1.8:1 で、非テキスト要素の目安 3:1 を
  下回るが、**これは現行のホバー強調とまったく同じ条件**であり、この work で新たに下がるものではない。
  色を選べるようにするのは「外観と設定」（H21 / H24）の範囲なので、**この制限は backlog へ送る**。
- 既存のクラス名を E2E と単体テストが掴んでいる。**消す場合はテスト側も同じ変更に含める**。
  - `.sidebar-row` / `.sidebar-row-selected` / `.sidebar-spaces` / `.sidebar-agents` / `.sidebar-collapsed`:
    `workspace-tab-pane.spec.ts:24,44,51,62,68`・`agent-detection.spec.ts:87-88`・`terminal-app.spec.ts:235`・
    `Sidebar.test.ts:108-115`（navigate 選択）・`Sidebar.test.ts:68-84`（git の 2 行目）
  - `.pane-frame` / `.pane-frame-edge`: `keys-mouse-dialogs.spec.ts:232,252-255,281`
- 配色は既存の CSS 変数の流儀（`App.vue:77-84` の `--wtm-*`）に従い、色を直接書かない。

## 完了条件 (受け入れ基準)

- [ ] AC1: サイドバーの workspace 行のうち `view.workspaceId` と一致する行が、モードに関係なく常時ハイライトされる。
      そのハイライトはタブバーのアクティブタブと同じ配色トークン（`--wtm-menu-active-bg`）を使う。
      判定は単体テスト（クラスの有無）＋スタイル定義の確認。
- [ ] AC2: 「表示中」「navigate の選択カーソル」「マウスホバー」が、**それぞれ異なる CSS の表し方**で描かれる
      （別の配色トークン、または背景以外のプロパティ）。同じ行が表示中かつ navigate 選択中のときも、両方が同時に読み取れる。
      判定はスタイル定義で行う（どの宣言がどの状態に対応するかが 1 対 1 で辿れること）＋
      単体テストで 2 つのクラスが同時に付くこと。
- [ ] AC3: サイドバーに横スクロールバーが出ない。判定は E2E で `.sidebar` の `scrollWidth <= clientWidth`。
      お膳立てとして、**上流付きの git リポジトリを一時ディレクトリに作り（長いブランチ名で 1 コミット ahead）**、
      その cwd で `workspace.create`（`WorkspaceCreateParams.cwd`。`packages/protocol/src/messages.ts`）して
      spaces 区画の 2 行目（`showGit` の条件は `Sidebar.vue:32`）を実際に描かせる。
      既定幅のときと、折りたたみ時（`prefix+b` → `.sidebar-collapsed`）の両方で確かめる。
- [ ] AC4: `view.focusedPaneId` と一致する pane の枠が強調表示される。強調の色はこれまでホバーで使っていた色
      （`--wtm-menu-border`）と同じ。選択が他の pane へ移ると、強調も一緒に移る。
      判定は単体テスト（クラスの有無と移動）。
- [ ] AC5: pane の枠にマウスを乗せても見た目が変わらない。判定は E2E で、枠に `hover` する前と後の
      計算後のスタイル（背景色・線の太さ）が一致すること。マウスカーソルの形（`cursor: context-menu`。
      `PaneFrame.vue:126`）はこの基準の対象外で、現状のまま残す。
- [ ] AC6: 強調表示の線の太さが 2px 以下で、4px の帯の内側に収まっている。かつ `.pane-frame-enabled` の
      `padding` は `4px` のまま。判定は E2E で選択中の枠の計算後のスタイルを読み、
      線の太さ（design で決めた 1 つのプロパティ）と padding を確かめる。
- [ ] AC7: pane の枠に `title` 属性が無い（ツールチップが出ない）。`aria-label` は残っている。
      判定は単体テスト。
- [ ] AC8: 表示中の workspace の行と、選択中の pane に、状態を機械可読に示す ARIA 属性が付き、
      そうでない行・pane には付かない。**具体の属性名と付与先は design で決める**——サイドバーの行は
      role を持たない素の `div`（`Sidebar.vue:98-105`）で、pane の枠の `aria-label` は
      「pane「x」のメニュー」というメニューボタンの名前（`PaneFrame.vue:96-100`）なので、
      タブの `aria-selected`（`TabBar.vue:50`）の流儀と揃うように選ぶこと。判定は単体テスト。
- [ ] AC9: 既存の単体テストと既定の E2E が、この変更の後も全て通る。とくに
      **`workspace-tab-pane.spec.ts:51`（navigate を抜けたら `.sidebar-spaces .sidebar-row-selected` が 0 件）**
      が通り続けること——「表示中」のハイライトを既存の `sidebar-row-selected` に相乗りさせると必ず落ちるので、
      別のクラスにする。テスト側を直した場合は、**直した理由が AC1〜AC8 のどれかに紐づくこと**。

## 相互作用の受け入れ基準（UI を伴う work のみ）

- [ ] AC-I1 開く / 閉じる: **該当なし**（この work は新しく開閉する部品を足さない）。枠の右クリックメニューの
      開閉（`PaneFrame.vue:73-76`・`ContextMenu.vue`）は変えない。確認は AC9 の既存 E2E の通過をもって行う。
- [ ] AC-I2 確定 / 取り消し: **該当なし**（見た目と意味論だけの変更で、確定・取り消しを伴う操作を足さない）。
      pane の選択（`view.focusPane`）の意味は変えない。確認は AC9 の既存テストの通過をもって行う。
- [ ] AC-I3 キーボードだけで完結するか: 選択の強調は、**既定の経路である `prefix+h/j/k/l`（`focusDir`。
      `keymap.ts:30-33`）**でも、navigate モード（`NavigateMode`）でも、マウスでの選択でも同じように出る。
      マウスを一度も使わずに「今どれが選ばれているか」が分かる。
      判定は E2E（`keys-mouse-dialogs.spec.ts:286-289` と同じ経路で選び直し、強調が移ることを確かめる）。
- [ ] AC-I4 フォーカスの行き先: 枠の `:focus-visible` の見た目と roving tabindex（`PaneFrame.vue:97`）を変えない。
      選択の強調が付いても、Tab の止まる場所は選ばれている pane の枠のままである。
      判定は AC9 の既存 E2E（`keys-mouse-dialogs.spec.ts:232`・`252-255`）の通過。
- [ ] AC-I5 既存の操作を妨げないか: 枠の上のマウス操作（押下で選択・右クリックでメニュー）と、
      端末側へのマウス報告（`MouseBridge`）の振り分けを変えない。
      判定は AC9 の既存 E2E（`keys-mouse-dialogs.spec.ts` の右クリック・マウス報告のテスト）の通過。

## 未確定事項 / 確認したいこと

- 3 つの状態（表示中・navigate カーソル・ホバー）をどのプロパティで描き分けるかは design で決める
  （AC2 の「1 対 1 で辿れること」を満たすこと）。
- 枠の線をどのプロパティで描くか（`border` / `box-shadow: inset` / `outline` の内側寄せ）は design で決める。
  AC6 の判定はそこで決めた 1 つのプロパティに対して行う。
- AC8 の ARIA 属性の選び方（`aria-current` か `aria-selected` か、付与先はどの要素か）は design で決める。
- 背景 4 の後半（xterm.js のカーソルの描き方を設定していない）と、非機能要件に書いた
  **強調色のコントラスト比 1.8:1** は、この work の対象外として backlog へ送る（deliver で起票）。
