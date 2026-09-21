# 調査: このブラウザの設定を増やす（サイドバーの幅・状態の記号・scrollback）

調査は 2 本に分けて委譲し（状態表示とサイドバー／scrollback と設定ダイアログと E2E）、
**herdr の実装は上流のリポジトリ（`herdrdev/herdr` の `da6bcd5`。本製品が判定ルールを取り込んだのと同じ版）を
GitHub API で直接読んで**確かめた。**「リポジトリに資料が無い」で終わらせず、一次資料まで行った**。

出典の表記: `[H]<path>:<line>` は herdr（`https://github.com/herdrdev/herdr/blob/da6bcd5969779bfe0396bcf89a8025d4375d611e/<path>`）。

## 調査の問い

- Q1: エージェントの状態は、いま画面のどこに・どう出ているか。記号を足すならどこに効くか。
- Q2: herdr の記号表示は、どの字形を・どの既定で使っているか。
- Q3: 色覚特性への配慮として、何を満たせばよいか。どんな字形なら崩れないか。
- Q4: サイドバーの幅と折りたたみは、どこに持たれ、どう保存できるか。herdr はどうしているか。
- Q5: scrollback はサーバからブラウザまでどう流れ、ブラウザ側で変えるとどこに効くか。
- Q6: 設定ダイアログの現状と、節に分けるときの確立したパターン。
- Q7: 「ブラウザを閉じて開き直す」「別のブラウザで開く」「モバイル」を E2E でどう確かめられるか。

## 判明した事実

### 状態表示の現状（Q1）

- **F1**: 状態の値は、サーバが決める 4 つ（`AgentState = blocked | working | idle | unknown`。
  `packages/protocol/src/model.ts:4`）と、ブラウザが足す `done` の 5 つ（`DisplayState`。`model.ts:6`）。
  pane 1 つの表示状態は `displayStateFor`（`packages/web/src/store/seen.ts:57-61`）が決め、
  **エージェントが居なければ `null`**（`Pane.agent: AgentInfo | null`。`model.ts:66`）。
- **F2**: 集約は `aggregate`（`seen.ts:67-74`）で、優先度 `STATE_PRIORITY`（`seen.ts:48-54`）は
  blocked 4 > done 3 > working 2 > idle 1 > unknown 0。**herdr と同じ**（`[H]src/client/shell.rs:202-211`）。
- **F3**: 状態が出ている場所は **3 つ**で、**CSS が 3 か所に複製**されている。
  - サイドバーの Space 行（`packages/web/src/components/Sidebar.vue:138`）と Agent パネル（`:171`）。
    CSS は `:276-299`。
  - goto（`prefix+g`）の一覧（`packages/web/src/components/GotoPicker.vue:312`、CSS `:380-402`）。
  - モバイルの pane ピッカー（`packages/web/src/mobile/PanePicker.vue:91`・`:95`・`:108`、CSS `:162-185`）。
  - `Sidebar.vue:202-204` のコメントが「`GotoPicker.vue`/`PanePicker.vue` の配色に揃える」と書いている
    ＝**複製は意図的に揃えられているが、1 か所にまとまってはいない**。
  - タブバー（`TabBar.vue:8`）と pane の枠（`PaneFrame.vue:145-147`）には状態を出していない。
- **F4**: **`unknown` とエージェントが居ない行（`'none'`）が同じ見た目**。どの箇所も
  `:data-state="state ?? 'none'"` で null を `'none'` に置き換え、CSS の規則は blocked / working /
  done / idle の 4 つにしか無い。**`unknown` と `none` は既定の見た目**
  （`currentColor` の丸・`opacity: 0.3`。`Sidebar.vue:276-283`）に落ちる。
- **F5**: 点は `width/height: 0.6em`・`border-radius: 50%`、色は blocked `#ff5555` / working `#f1fa8c` /
  done `#50fa7b` / idle `#6272a4`（`Sidebar.vue:276-299`）。**`aria-label`・`title`・テキストのどれも無い**。
- **F6**: サイドバーとピッカーの文字は `system-ui, sans-serif`（`packages/web/src/App.vue:103`）で、
  **端末のフォントではない**。畳んだサイドバーは幅 `3em`（`Sidebar.vue:217-219`）で、行は点だけになる。
- **F7**: goto の状態の絞り込みは `b/w/i/d` の 4 つで `unknown` が無い（`GotoPicker.vue:33`）。
  絞り込み中は状態名を英語のまま文字で出す（`:296`）。

### herdr の記号表示（Q2）

- **F8**: herdr の字形（`[H]src/client/shell.rs:177-196` の `status_icon`）。

  | 状態 | `dots`（既定） | `symbols` |
  |---|---|---|
  | blocked | `●` | `×` |
  | working | `●` | `◐` |
  | done | `●` | `✓` |
  | idle | `○` | `○` |
  | unknown | `·` | `·` |

  **`dots` では blocked / working / done が同じ `●` で、色だけが違う**＝本製品のいまの点と同じ構造。
- **F9**: **herdr の既定は `dots`**（`[H]src/config/model.rs:111-117` の `#[default] Dots`、
  `:963` のコメント「Default: "dots"」、`:1188`）。**requirements は既定を「入」（記号）にしている**ので、
  **herdr と既定が逆になる**。
- **F10**: herdr は同じ `status_icon` をサイドバー・Agent パネル・モバイルで共有している
  （`[H]src/client/shell/sidebar.rs:85`・`:152`・`:703`、`mobile.rs` にも `status_indicators`）。
  **字形の決定は 1 か所**。
- **F11**: 本製品の対応表 `docs/herdr-parity.md:45` の **H23 は「pane の枠・隙間・エージェント名表示の設定」**で、
  前々 work の調査の原文（`.aidev/works/20260918-web-terminal-multiplexer/research.md:194`）にあった
  「**状態表示を記号にする設定**」が**落ちている**。記号に対応する行は、いま対応表に無い。

### 色覚特性への配慮（Q3。WCAG 2.2 と Unicode の UAX #11・UTS #51。知識による）

- **F12**: **WCAG 1.4.1 色の使用（A）**——色を唯一の手段にしてはいけない。いまの点はこれに当たる。
  **1.1.1 非テキストコンテンツ（A）**——情報を持つ図形には代わりのテキストが要る。いまの点には無い（F5）。
  **1.4.11 非テキストのコントラスト（AA）**——情報を伝える図形は隣の色と 3:1 以上。
  委譲先の手計算の概算で idle `#6272a4` 対 背景 `#282a36` が約 3.0:1、`none`/`unknown` が約 2.5:1（**未実測**）。
- **F13**: **絵文字にならない文字を選ぶ**（UTS #51）。`Emoji=Yes` の文字（▶ ✔ ✖ ⚠ ⏸ など）は環境により
  カラー絵文字で描かれ、**`color` を受け継がない**＝色と併記できない。
  herdr の 5 字形のうち `×`（U+00D7）・`◐`（U+25D0）・`○`（U+25CB）・`·`（U+00B7）は絵文字の属性を持たない。
  **`✓`（U+2713）は `Emoji=No`** だが、フォントの対応が薄い環境がある（**未実測**）。
- **F14**: **幅**（UAX #11）。図形の多く（● ○ ◐）は East Asian Width が **Ambiguous** で、
  日本語フォントでは全角・欧文フォントでは半角になる。サイドバーは端末のセルではなく
  `system-ui` で描く（F6）ので、**幅を固定した箱に入れれば吸収できる**。

### サイドバーの幅と折りたたみ（Q4）

- **F15**: 幅は **component の中の `ref`**（`Sidebar.vue:22` `const width = ref(DEFAULT_WIDTH)`）で、
  **ストアに無い**。定数は `DEFAULT_WIDTH = 240`・`MIN_WIDTH = 160`・`MAX_WIDTH = 360`（`:12-14`）。
  ドラッグは `pointerdown`（`:98-110`。350ms 以内の 2 回目で既定に戻す `:99-104`）→ `pointermove`
  （`:112-115`。範囲に収める）→ `pointerup`（`:117-119`）。**`pointercancel`・`lostpointercapture` の処理は無い**。
  幅が効くのは展開中だけ（`:123`）。
- **F16**: 折りたたみは `view.ts:158` の `sidebarCollapsed = ref(false)`、切り替えは `toggleSidebar()`（`:261-263`）。
  `prefix+b`（`keys/keymap.ts:63` → `actions/ActionDispatcher.ts:122-123`）と畳むボタン（`Sidebar.vue:185-194`）が
  同じ経路。**どちらも保存しない**。
- **F17**: **畳むと［メニュー］ボタンが消える**（`Sidebar.vue:147` の `v-if="!view.sidebarCollapsed"`）。
  **畳んだ利用者の設定への入口は `prefix+s` だけ**になる。
- **F18**: このブラウザに残す仕組みは既にある。`localStorage` の **`wtm.prefs.v1`** に JSON 1 つ
  （`view.ts:42`）。読み書きは **`readPrefs()`（`:50-59`）と `writePrefs(patch)`（`:62-69`）に集約**され、
  `writePrefs` は既存の値に**併合**し、読みも書きも try/catch の内側。壊れた JSON・配列は `{}`。
  いま入っているのは `agentSort`・`notify{toast,desktop,sound}`・`notifyHintPending`・`notifyHintDone`。
- **F19**: 壊れた値の扱いの先例は 2 つ。`loadAgentSort`（`view.ts:71-74`。許される値でなければ既定）、
  `loadPrefs`（`store/notifications.ts:20-26`。項目ごとに `typeof` を確かめる）。
  **範囲外の数値を丸める先例は無い**。
- **F20**: **herdr は「最後に調整した値」と「既定値」を分けて持つ**。
  - 端末ごとの preferences（`[H]src/client/shell/preferences.rs:18-24` の `ClientChromePreferences`）に
    `sidebar_width`・`sidebar_section_split`・`sidebar_collapsed` を保存する（`Option` なので未保存と区別できる）。
  - config（`[H]src/config/model.rs:904-912`）は既定値と範囲（`sidebar_width` 既定 26 列・
    `sidebar_min_width` 18・`sidebar_max_width` 36・`sidebar_start_collapsed` 既定 false）。
  - つまり herdr で幅を保存するのは**設定画面の項目ではなく、操作した結果を覚える仕組み**。

### scrollback の経路（Q5）

- **F21**: サーバの `--scrollback` は**行**単位（herdr はバイト。`docs/herdr-parity.md:28` の H06「既定 10MB」）。
  受け取りは `packages/server/src/cliArgs.ts:63-64`、検証は `packages/server/src/config.ts:65-72`。
  **既定 5000・上限 10000**（`config.ts:9-10`）。10000 を超える値は**黙って 10000 に丸める**（`:71`）。
- **F22**: 効く先は 2 つ。(1) サーバのミラーの行数（`composeServer.ts:122` → … → `Mirror.ts:52-53`）。
  (2) クライアントへ知らせる上限（`SessionService.ts:85` の snapshot `limits.scrollbackLines` →
  web `store/session.ts:30`。受け取る前の初期値は 5000、`session.ts:19`）。
- **F23**: ブラウザが使う行数は **1 つの関数**で決まる（`packages/web/src/main.ts:116`）:
  `getScrollbackLines = () => kind === "mobile" ? MOBILE_SCROLLBACK_LINES : session.limits.scrollbackLines`。
  `MOBILE_SCROLLBACK_LINES = 1000`（`main.ts:45`）。`kind` は `isCoarsePointer()`
  （`mobile/detect.ts:28-30`。`(pointer: coarse)`）で決まり、**画面幅の 1 列レイアウトとは別**。
- **F24**: その関数は **2 か所で読まれる**。xterm.js を作るとき（`term/TerminalRegistry.ts:184-190`。
  `new Terminal({ scrollback })`）と、`pane.subscribe` を送るとき（`term/ViewSync.ts:103-106`）。
  **読む時点がずれるので、その間に設定が変わると xterm の行数と購読の行数が食い違いうる**（推測）。
- **F25**: **サーバはクライアントの求めた行数を明示的には切らない**（`surface/methods/subscribe.ts:13` が
  そのまま渡す）。ただし SNAPSHOT はミラーにある分しか作れない（serialize addon が `constrain` する）ので、
  **上限を超えて求めてもエラーは出ず、サーバの上限分が届く**。protocol の型にも上限の検査は無い
  （`protocol/src/messages.ts:46-49`）。
- **F26**: xterm.js の `scrollback` が効くのは**作る時点の 1 回**。ただし LRU から追い出された端末は
  次に表示すると作り直される（`TerminalRegistry.ts:111-122`・`:241-254`）。容量はデスクトップ 24・
  **モバイル 2**（`main.ts:41`・`:43`）で、**モバイルは pane を切り替えるとすぐ作り直される**。
- **F27**: 利用者向けの文書に「モバイルは `--scrollback` にかかわらず 1,000 行」とある
  （`docs/tls-setup.md:476-492`）。**この work で変わるので直す対象**。

### 設定ダイアログ（Q6）

- **F28**: `NotificationSettingsDialog.vue` はネイティブ `<dialog>` ＋ `showModal()`、`aria-label="通知の設定"`（`:116`）、
  **節は無く** `<ul>` に 3 行（`:118-153`）。切り替えは `<button role="switch" :aria-checked>`（`:120-150`）で、
  押した時点で保存（`:80-103`。D2 の注記 `:13-15`）。開くと最初の switch へフォーカス（`:65-78`）。
  Esc は `@cancel` で `preventDefault` して `closeDialog()`（`:109-112`）、背景クリックは `@click.self`（`:116`）。
  閉じると開く前の pane にフォーカスが戻る（`store/view.ts:220-225`）。
  **理由の文（`:137`・`:151`）は `aria-describedby` で結ばれていない**。
- **F29**: ダイアログ中は `keys.setMode("dialog")`（`main.ts:201-204`）で、window の keydown は何もしない
  （`main.ts:212-213`）＝**ダイアログの中で矢印キーを自前で扱っても横取りされない**。
- **F30**: 入口は 3 つ。`prefix+s`（`keymap.ts:57` → `actions.ts:65` → `ActionDispatcher.ts:137-138`）、
  サイドバーの［メニュー］→「通知の設定」（`ContextMenu.vue:98`）、モバイルの 🔔（`MobileShell.vue:86`。
  **ActionDispatcher を通らず** `view.openDialogWithContext` を直接呼ぶ）。
  文言を見ている単体テストが 4 つある（`MobileShell.test.ts:292-297`・`ContextMenu.test.ts:178-180`・
  `HelpDialog.test.ts:41`・`KeyRouter.test.ts:143`）＝**改名すると落ちる**。ヘルプの表記は `HelpDialog.vue:43`。
- **F31**: 節を持つダイアログの先例は `HelpDialog.vue`（群ごとに `<section>` と `<h3>`。`:222-223`）。
  一覧を持つ先例は `GotoPicker.vue`（`role="listbox"`。`:298-305`）。
- **F32**: WAI-ARIA APG の「節に分ける」パターン（知識による）:
  - **見出し付きのグループ**（`<section>`＋見出し、または `role="group"`＋`aria-labelledby`）——全項目が常に見え、
    Tab で順に進むだけでキー処理が要らない。先例は `HelpDialog`。項目が増えると長くなる。
  - **`fieldset`/`legend`**——ネイティブ。ラジオの組に最適。
  - **Tabs**——節の切り替えは速いが、隠れた節は見渡せず、roving tabindex を自前で書く。
  - **Accordion**——縦に並びモバイルに合うが、畳んだ節は 1 手増える。
- **F33**: 値を選ぶ部品（知識による）:
  - **ラジオの組**（APG Radio Group）——矢印で**移動すると同時に選択**。即時反映だと通過した値も反映されるが、
    scrollback は「次に開く pane に効く」＋保存だけなので実害は小さい（推測）。選択肢が全部見える。
  - **`<select>`**——場所を取らず、モバイルは OS のピッカーになる。閉じたまま矢印で動かしたときの `change` の
    出方はブラウザで違う（**未検証**）。
  - スライダー・`<input type=number>`——離散の少数の値には不向き／打ちかけの値の検証が要る。

### テストで確かめられる範囲（Q7）

- **F34**: 「ブラウザを閉じて開き直す」に最も近いのは、`context.storageState()` を取って `context.close()` し、
  `browser.newContext({ storageState })` で開き直す形（`localStorage` を持ち越し、`sessionStorage` は持ち越さない。
  Playwright 1.63.0、`packages/e2e/package.json:16`）。
  **ただの `close()` → `newContext()` では `localStorage` が空になる**ので、既存の
  `reconnect-restore.spec.ts:17-46`（この形）は**設定が残ることの確認には使えない**。
  `page.reload()` の先例は `keys-mouse-dialogs.spec.ts:510-522`。
- **F35**: **`page.addInitScript` は再読み込みのたびに走り直す**。`notifications.spec.ts:45-49` のように
  `wtm.prefs.v1` をそこで仕込むと、**reload のたびに上書きされ、保存の確認にならない**。
  壊れた値を 1 回だけ仕込むなら `newContext({ storageState: { origins: [{ origin, localStorage: [...] }] } })`。
- **F36**: 「別のブラウザで開く」は `browser.newContext()`（保存域が空）で再現できる。先例は
  `multi-client.spec.ts:40-58`（context を 2 つ）。
- **F37**: **iPhone 13 のエミュレーションで `(pointer: coarse)` は真になる**（実測。
  `{"coarse":true,"fine":false,"touch":1}`）＝**E2E でモバイルの `kind` の経路を通せる**。
  🔔 を押す E2E は無い（単体の `MobileShell.test.ts:292-297` が `aria-label` を見るだけ）。
- **F38**: ブラウザが送った `pane.subscribe` の `scrollbackLines` は、CDP の `Network.webSocketFrameSent` で読める
  （先例 `support/panes.ts:52-70` が `client.view` を同じ手で読んでいる）。xterm の buffer は window に出ていない。
  サーバの `--scrollback` を変えたテストは fixture が引数なしなので、spec から `startAppServer({ scrollback })`
  （`support/appServer.ts:49-56`・`:68`）を直接呼ぶ必要がある。

## 影響範囲

- **web のみ**（protocol・server は変えない）。
- 状態の記号: `Sidebar.vue`・`GotoPicker.vue`・`PanePicker.vue`（F3。CSS が 3 か所）。**1 か所へ寄せるかは design**。
- サイドバー: `Sidebar.vue`（幅の ref）・`store/view.ts`（折りたたみ・prefs）。
- scrollback: `main.ts:116`（決める関数）・`TerminalRegistry.ts`・`ViewSync.ts`（F24）。
- 設定ダイアログ: `NotificationSettingsDialog.vue`（節に分ける／改名）、入口 3 つ（F30）とヘルプの表記。
- 文書: `docs/herdr-parity.md`（H06・H19・H23・H25）、`docs/tls-setup.md:476-492`（F27）。
- **落ちる既存テスト**: 入口の文言を見ている 4 つ（F30）。

## 実現性 / リスク

- **既定を herdr と逆にする**（F9）。requirements の判断（色だけに頼る状態を既定にしない）は WCAG 1.4.1 に沿うが、
  **herdr から来た利用者には見た目が変わる**。design で理由を記録する。
- **字形の見分け**。herdr の `symbols` は idle `○` と unknown `·` が小さいと見分けにくい可能性がある（推測）。
  畳んだサイドバーの 3em の行でも読める大きさが要る。
- **幅の保存の書き込み頻度**。`pointermove` ごとに `localStorage` へ書くと同期 I/O が毎フレーム走る。
  `pointerup` で書けば 1 回だが、**`pointercancel` の処理が無い**（F15）ので、取り消されたドラッグの幅が残るか
  消えるかが今は決まっていない。
- **scrollback をサーバの上限より大きくしたとき**（F25）: エラーは出ないが、ブラウザの xterm だけが長く持ち、
  再接続の SNAPSHOT はサーバの上限分に戻る（推測）。**UI で上限を超える値を選ばせない**のが素直。
- **2 か所で読む**（F24）ことによる食い違い。

## 実装アンカー

- A1 ブラウザの scrollback を決める関数（`packages/web/src/main.ts:45`・`:116` `getScrollbackLines`）——設定値を読み、
  `session.limits.scrollbackLines` で頭を押さえる所。
- A2 xterm.js を作る所（`packages/web/src/term/TerminalRegistry.ts:184-190` `create`）。
- A3 購読の行数（`packages/web/src/term/ViewSync.ts:103-106`。注記 `:9-10` も 1000 を前提にしている）。
- A4 prefs の読み書きと検証の雛形（`packages/web/src/store/view.ts:42-78` `readPrefs`/`writePrefs`/`loadAgentSort`）、
  折りたたみ（`:158`・`:261-263`）、ダイアログの文脈 `notifySettings`（`:126`）。
- A5 サイドバーの幅とドラッグ（`packages/web/src/components/Sidebar.vue:12-22`・`:98-119`）、
  ［メニュー］が消える条件（`:147`）、状態の点（`:138`・`:171`・CSS `:276-299`）。
- A6 goto の状態の点（`packages/web/src/components/GotoPicker.vue:312`・CSS `:380-402`）。
- A7 モバイルの状態の点（`packages/web/src/mobile/PanePicker.vue:91`・`:95`・`:108`・CSS `:162-185`）。
- A8 表示状態と集約（`packages/web/src/store/seen.ts:48-74`）——`null` と `'none'` の区別はここ。
- A9 設定ダイアログ（`packages/web/src/components/NotificationSettingsDialog.vue:65-78`・`:115-155`）。
- A10 入口とヘルプの表記（`packages/web/src/components/ContextMenu.vue:98`、`packages/web/src/mobile/MobileShell.vue:86`、
  `packages/web/src/components/HelpDialog.vue:43`、`packages/web/src/keys/keymap.ts:57`、
  `packages/web/src/keys/actions.ts:65`、`packages/web/src/actions/ActionDispatcher.ts:137-138`）。
- A11 E2E の土台（`packages/e2e/src/support/fixtures.ts:5-12`、`support/appServer.ts:49-56`・`:68`、
  `support/panes.ts:52-70`）、幅の E2E を足す場所（`packages/e2e/src/specs/workspace-tab-pane.spec.ts:394-442`）。
- A12 文書（`docs/herdr-parity.md:28`・`:41`・`:45`・`:47`、`docs/tls-setup.md:476-492`）。

## 実装時の注意

- **`addInitScript` で `wtm.prefs.v1` を仕込むテストでは、保存の確認ができない**（F35）。reload のたびに上書きされる。
  保存を確かめるテストは `storageState` の持ち越しで書く。
- **入口の文言を変えると単体テストが 4 つ落ちる**（F30）。条項 `regression-negative-control` に従い、
  **先に落ちることを確かめてから直す**。
- **モバイルの 🔔 は ActionDispatcher を通らない**（F30）。入口を揃えるなら、ここも同じ action を通す形に寄せると
  「3 つとも同じダイアログを開く」を 1 か所で保てる。
- **`unknown` と `none` がいま同じ見た目**（F4）。記号を足すと `unknown` にだけ字形が付くので、
  **`none` の行が見た目で `unknown` と区別できるようになる**（requirements AC8 の要求）。
- **E2E は dist を読む**。走らせる前に `pnpm build`。一式は deliver の直前 1 回（利用者の指示）。
- 前 work で E2E の偽 `AudioContext` を直したのと同じ理由で、**テストの偽物は実物の制約に合わせる**
  （例: scrollback の上限をサーバの `limits` と同じ値で持つ）。

## design への申し送り

- **字形**: herdr の `symbols`（blocked `×` / working `◐` / done `✓` / idle `○` / unknown `·`。F8）に揃えるのが
  最も説明しやすい。ただし **CSS で描く案**（フォントに頼らない）も比較する（F13・F14）。
  どちらでも **`aria-label` を付ける**（F12 の 1.1.1。いまは無い）。
- **既定**: requirements は「入」。herdr の既定は `dots`（F9）。**逆にする理由を decisions に残す**。
- **CSS の複製**（F3）: 3 か所に字形を足すと 3 か所がずれる。**1 つの部品へ寄せる**のが前 work の
  `paneNameOf` の教訓（3 か所の複製を 1 か所にまとめた）と同じ筋。
- **幅の保存**: herdr は設定画面の項目ではなく「操作した結果を覚える」（F20）。本製品も同じ扱いにするなら、
  **設定ダイアログに幅の項目は要らない**（requirements の「表示」節は記号表示だけになりうる）。
  書き込みは `pointerup`（とダブルクリック）で 1 回。`pointercancel` をどう扱うかも決める。
- **幅をストアへ上げるか**（F15）: 保存と読み戻しをストアで持つと、`Sidebar.vue` の ref と二重になる。
- **scrollback の選択肢**: 段階（例 1000 / 5000 / サーバの上限）をラジオで出し、**サーバの上限を超える値は
  出さない**（F25）。既定は「端末の種類に応じた今の値」（デスクトップはサーバの上限、モバイルは 1000）にすると、
  **何も設定していない利用者の見え方が変わらない**。
- **2 か所で読む食い違い**（F24）: `create` のときに決めた値を購読にも使う形にできるか。
- **設定ダイアログの形**: 項目は 3 節で 5〜6 個（通知 3・表示 1・端末 1）。**見出し付きのグループで 1 枚**に
  収まる（F32）。Tabs は隠れた節を見渡せず、キー処理が増える。
- **入口の名前**: 「通知の設定」→「設定」。モバイルの 🔔 は絵文字（F13）で、設定全体を開くなら字形も見直す。
- **畳んだサイドバーには［メニュー］が無い**（F17）。requirements の入口 3 つは「展開中の［メニュー］」を含意している。
- **文書**: `docs/tls-setup.md:476-492` の「モバイルは 1,000 行」を直す（F27）。
- **対応表**: H23 に「状態表示を記号にする設定」を戻すか、行を足す（F11）。
