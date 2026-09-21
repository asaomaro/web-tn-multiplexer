# 仕様: このブラウザの設定を増やす（サイドバーの幅・状態の記号・scrollback）

## 概要

3 つの穴を、**web だけで**埋める。

1. **サイドバーの幅と折りたたみ**は「設定の項目」ではなく**操作した結果を覚える**（herdr と同じ扱い。research F20）。
   `wtm.prefs.v1` に 2 つ足し、ドラッグを終えた時点と畳んだ時点で書き、起動時に読み戻す。
2. **状態の記号**は herdr の `symbols` の字形（blocked `×` / working `◐` / done `✓` / idle `○` / unknown `·`。F8）を
   **色と併記**し、**読み上げ用の名前**も付ける。3 か所に複製されている状態の点（F3）を
   **1 つの部品 `StateIcon.vue` に寄せて**、字形の決定を 1 か所にする。**既定は「入」**（herdr と逆。D3）。
3. **scrollback** はこのブラウザの設定にし、ブラウザが使う行数を決める関数（`main.ts:116`）を純粋関数に置き換える。
   **数を選んだときはサーバの上限で押さえ、「自動」はいまと同じ値**（デスクトップはサーバの上限、モバイルは 1000）。
   **サーバの上限を超える値は選ばせない**。

そのうえで、`prefix+s` の通知だけのダイアログを**見出しで 3 節に分けた「設定」**へ広げ、
入口 3 つ（`prefix+s`・サイドバーの［メニュー］・モバイルの上のバー）の名前を「設定」にそろえる。

## 設計方針

### D1: 幅と折りたたみは「覚える」だけで、設定ダイアログには出さない

herdr は幅と折りたたみを**端末ごとの preferences**（`[H]src/client/shell/preferences.rs:18-24`）に保存し、
設定画面の項目にはしていない（config が持つのは既定値と範囲だけ。`[H]src/config/model.rs:904-912`）。
**利用者がドラッグで決めた幅を、ダイアログでもう一度数字で選ばせる理由が無い**。
requirements の「表示」節は**記号表示だけ**になる（AC12 の「3 節すべて」は通知・表示・端末で満たす）。

- 退けた案: 「表示」節に幅のスライダーを置く——ドラッグと二重の操作になり、どちらが正か分からなくなる。

### D2: 状態の点を `StateIcon.vue` に寄せる

いまは同じ配色の CSS が `Sidebar.vue`・`GotoPicker.vue`・`PanePicker.vue` の 3 か所にある（F3）。
ここに字形と読み上げの名前を足すと、**3 か所が別々にずれる**（前 work で pane の呼び名の複製を
`store/paneName.ts` の 1 か所にまとめたのと同じ筋。20260920-agent-notifications の decisions）。
herdr も `status_icon` 1 つを全箇所で共有している（F10）。

- 呼ぶ側は**自分のクラスを付けて使う**（`<StateIcon class="sidebar-state-icon" :state />`）。Vue の属性の
  引き継ぎで根要素にクラスが付くので、**既存のテストと E2E のセレクタ（`.sidebar-state-icon` 等）は変わらない**。
- 見た目（色・字形・大きさ・形）は `StateIcon.vue` が持つ。**呼ぶ側の状態の点のルールは丸ごと消す**
  （`Sidebar.vue:276-299`・`GotoPicker.vue:380-402`・`PanePicker.vue:162-185`）。scoped CSS でも**親の規則は子の根要素に
  効く**（D2 がクラスの引き継ぎで頼っているのと同じ仕組み）ので、配色だけ消すと `width/height: 0.6em`・
  `border-radius: 50%`・`background: currentColor` が残り、**字形の後ろに塗りの丸が描かれる**。
  呼ぶ側に残すのは並びのための余白だけ。

### D3: 記号表示の既定は「入」（herdr は「切」）

herdr の既定は `dots`（F9）。requirements は「色だけに頼る状態を既定にしない」と定めた。
**WCAG 1.4.1（色の使用・レベル A）**は色を唯一の手段にすることを禁じており（F12）、
**既定で違反している状態を出荷しない**のが筋。herdr から来た利用者には見た目が変わるが、
字形は herdr の `symbols` と同じなので「herdr の記号表示を入れた状態」として説明できる。
**decisions に記録する**。

### D4: 字形は herdr の `symbols` をそのまま使い、幅を固定した箱に入れる

| 状態 | 字形 | 読み上げの名前 |
|---|---|---|
| blocked | `×`（U+00D7） | 入力待ち |
| working | `◐`（U+25D0） | 作業中 |
| done | `✓`（U+2713） | 完了 |
| idle | `○`（U+25CB） | 待機中 |
| unknown | `·`（U+00B7） | 状態不明 |
| （エージェントが居ない） | **字形は出さない**。いまの薄い丸はそのまま | 名前も出さない（`aria-hidden`） |

- 4 つは絵文字の属性を持たず（F13）、**`color` を受け継ぐので色と併記できる**。`✓` は `Emoji=No`。
- Ambiguous 幅（F14）は、**幅 `1em`・中央寄せの箱**で吸収する（サイドバーは端末のセルではなく `system-ui` で描く。F6）。
- **読み上げの名前はいまの点にも無い**（F5。WCAG 1.1.1）。記号表示が「切」でも名前は付ける。
- 名前の語は既存の文言に合わせる（通知のトースト「入力待ちです」「完了しました」。
  `packages/web/src/notify/NotificationController.ts:29`）。
- 退けた案: **CSS で描く形**（三角・半円・塗りの円・中抜きの円・点線の円を `clip-path` や `border` で描く）——
  フォントに頼らない利点はあるが、herdr と同じ字形を選ぶほうが
  「何を真似たか」が説明でき、字形を変える判断を後から 1 か所で行える。**`✓` のフォント対応が薄い環境が
  見つかったら**、そのとき `StateIcon.vue` の中だけで CSS に差し替えられる（D2 で 1 か所にしてあるので）。
- 退けた案: ASCII 中心の記号（blocked `!`・working `~`・done `✓`・idle `-`・unknown `?`）——意味は直感的だが、
  herdr と違う字形を選ぶ理由が無い。

### D5: scrollback は「自動」＋サーバの上限以下の段階から選ぶ

- 値は `"auto" | number`。**既定は `"auto"`**＝**いまの振る舞いのまま**（デスクトップはサーバの上限、
  モバイルは 1000。F23。**モバイルの 1000 はサーバの上限で押さえない**——いまの `main.ts:116` も押さえていない）。
  **何も設定していない利用者の見え方は変わらない**。
- 選択肢は `[1000, 2000, 5000, 10000]` のうち**サーバの上限以下**と、**サーバの上限そのもの**（重複は除く）。
  **上限を超える値は出さない**——出すとエラーは出ないがサーバの上限分しか届かず（F25）、選んだ意味が無い。
- 部品は**ネイティブのラジオの組**（`<fieldset>`＋`<legend>`＋`<input type="radio">`）。
  APG の Radio Group と同じく**矢印で移動すると同時に選択**され（F33）、キー処理を自前で書かずに済む。
  通過した値も保存されるが、効くのは次に開く pane からなので実害は無い。
- 「自動」の行には**この端末でいま効く行数**を添える（例「自動（この端末では 1,000 行）」）。
  モバイルの利用者が「自動＝何行か」を知る手段がほかに無い。
- 保存した数値が**あとでサーバの上限を超えた**（サーバを小さい `--scrollback` で起動し直した）場合は、
  **使うときに上限で頭を押さえる**。保存値は書き換えない（上限が戻れば元の選択が効く）。
- **ダイアログでは常にちょうど 1 つのラジオが選ばれている**ようにする。選ばれて見えるのは
  `pref === "auto"` なら「自動」、数なら `min(pref, limit)` の行。上限を超えた保存値は押さえた値＝上限の行になり、
  上限は必ず選択肢にある。**上限以下で標準の段階に無い保存値**（例: 上限 3000 のときに選んだ 3000 を、
  上限 10000 のサーバで開いた）は `scrollbackChoices(limit, saved)` が**選択肢に足す**。
  ネイティブのラジオの組は、Tab で入ると**選ばれている行**にフォーカスが来る（AC-I3）。

### D6: 購読の行数は、その端末を作ったときの値を使う

いまブラウザは行数を**2 か所で別々に読む**（xterm を作るとき `TerminalRegistry.ts:184-190` と、
購読を送るとき `ViewSync.ts:103-106`。F24）。**値が変わらない前提**では問題にならなかったが、
**この work で利用者が途中で変えられるようになる**ので、その間に変えると xterm の容量と購読の行数が食い違う。
`TermEntry` に作ったときの行数を持たせ、購読はそれを使う。

### D7: 設定ダイアログは「見出し付きのグループ」で 1 枚にする

項目は 3 節で 5 つ（通知 3・表示 1・端末 1）。APG のパターン（F32）のうち、
**見出し付きのグループ**は全項目が常に見え、Tab で順に進むだけでキー処理が要らず、先例（`HelpDialog.vue`。F31）がある。

- 退けた案: Tabs——隠れた節を見渡せず、roving tabindex を自前で書く。5 項目には過剰。
- 退けた案: Accordion——畳んだ節で 1 手増える。5 項目なら全部開いていてよい。
- ファイル名と文脈名も改める（`NotificationSettingsDialog.vue` → `SettingsDialog.vue`、
  `DialogContext` の `notifySettings` → `settings`、action の `notifySettings` → `settings`）。
  中身が通知だけではなくなるので、名前が中身と食い違ったまま残さない。

### D8: 入口の名前を「設定」にそろえ、モバイルは文字のボタンにする

- サイドバーの［メニュー］の項目「通知の設定」→「設定」（`ContextMenu.vue:98`）。
- ヘルプの `s` の表記「通知の設定」→「設定」（`HelpDialog.vue:43`）。
- モバイルの上のバーの 🔔 → **「設定」という文字のボタン**。🔔 は絵文字（F13）で環境により見た目が変わり、
  **設定全体を開くのに通知の絵を出すと中身と食い違う**。`⚙`（U+2699）も `Emoji=Yes` なので避ける。
- **畳んだサイドバーには［メニュー］が無い**（F17。`Sidebar.vue:147`）。これは既存の振る舞いで、この work では
  変えない（畳んだ利用者は `prefix+s` で開ける）。requirements の入口 3 つは「展開中の［メニュー］」を指す。

## 対象範囲

- 新規: `packages/web/src/components/StateIcon.vue`（D2・D4）、`packages/web/src/store/stateIndicator.ts`（字形と名前の表）、
  `packages/web/src/store/settings.ts`
  （記号表示と scrollback の設定。D5）、`packages/web/src/term/scrollback.ts`（行数を決める純粋関数。D5）。
- 改名: `packages/web/src/components/NotificationSettingsDialog.vue` → `SettingsDialog.vue`（とそのテスト）。
- 変更: `packages/web/src/store/view.ts`（幅と折りたたみの保存・読み戻し、`DialogContext`）、
  `packages/web/src/components/Sidebar.vue`（幅をストアから読み書き、`StateIcon` を使う）、
  `packages/web/src/components/GotoPicker.vue`・`packages/web/src/mobile/PanePicker.vue`（`StateIcon` を使う）、
  `packages/web/src/main.ts`（`getScrollbackLines`）、`packages/web/src/term/TerminalRegistry.ts`・
  `packages/web/src/term/ViewSync.ts`（D6）、入口（`ContextMenu.vue`・`MobileShell.vue`・`HelpDialog.vue`・
  `keys/keymap.ts`・`keys/actions.ts`・`actions/ActionDispatcher.ts`）、`App.vue`（ダイアログの取り付け）、
  `packages/web/src/injection.ts`（`DeviceKindKey`）。
- 文書: `docs/herdr-parity.md`（H06・H19・H23・H25）、`docs/tls-setup.md:476-492`、`docs/verification.md:51-53`・`:457`
  （どちらも「モバイルは 1,000 行」と書いている）、`docs/verification.md:110`・`:452`・`:568`（状態の表示を「丸」「丸の色」と
  書いている。既定で記号が出るので見え方と合わなくなる）。
- E2E: 新規 spec（設定の保存と入口）。

## 依拠する既存の事実

- `localStorage` の `wtm.prefs.v1` の読み書きが `readPrefs()`／`writePrefs(patch)` に集約され、`writePrefs` は
  **併合**で書き、どちらも try/catch の内側（`packages/web/src/store/view.ts:42`・`:50-59`・`:62-69`）。
- 壊れた値を既定に落とす先例（`view.ts:71-74` `loadAgentSort`、`packages/web/src/store/notifications.ts:20-26`）。
- 幅は `Sidebar.vue` の中の `ref`（`packages/web/src/components/Sidebar.vue:22`）、範囲 160〜360・既定 240（`:12-14`）、
  ドラッグは `pointerdown`/`pointermove`/`pointerup`（`:98-119`）で、**`pointercancel`・`lostpointercapture` の処理は無い**。
- 折りたたみは `view.ts:158` の `ref(false)`、切り替えは `toggleSidebar()`（`:261-263`）。
- 状態の点は 3 か所（`Sidebar.vue:138`・`:171`、`GotoPicker.vue:312`、`PanePicker.vue:91`・`:95`・`:108`）で、
  **どれも `:data-state="state ?? 'none'"`**。CSS は各ファイルにある（`Sidebar.vue:276-299` 等）。
- 表示状態は `displayStateFor`（`packages/web/src/store/seen.ts:57-61`）が決め、エージェントが居なければ `null`。
- ブラウザの行数は `main.ts:116` の `getScrollbackLines` 1 つで決まり、`TerminalRegistry`（`main.ts:135`）と
  `ViewSync`（`main.ts:139`）の両方へ渡されている。モバイルの 1000 は `main.ts:45`。
- `ViewSync` は `registry` を持っている（`packages/web/src/term/ViewSync.ts:8`）。
- サーバの上限は snapshot の `limits.scrollbackLines` で届き（`packages/web/src/store/session.ts:30`）、
  受け取る前の初期値は 5000（`session.ts:19`）。サーバは求めた行数を明示的には切らない（F25）。
- 設定ダイアログの作法（ネイティブ `<dialog>`・`role="switch"`・押した時点で保存・Esc と背景クリック・
  開いたら最初の項目へ・閉じたら開く前の pane へ）は `NotificationSettingsDialog.vue:65-112` と
  `view.ts:204-225`。ダイアログ中は window の keydown が何もしない（`main.ts:212-213`）。
- 入口 3 つ（`keys/keymap.ts:57`・`ContextMenu.vue:98`・`MobileShell.vue:86`）。モバイルは
  ActionDispatcher を通らず `view.openDialogWithContext` を直接呼ぶ。
- herdr の字形と既定（`[H]src/client/shell.rs:177-196`、`[H]src/config/model.rs:111-117`）。
- herdr の幅の保存（`[H]src/client/shell/preferences.rs:18-24`）。

## インターフェース / データ構造

### `wtm.prefs.v1` に足すキー

| キー | 型 | 既定 | 読み込みの検証 |
|---|---|---|---|
| `sidebarWidth` | number | 240 | 有限の数で、160〜360 の範囲。**外れたら既定**（丸めない） |
| `sidebarCollapsed` | boolean | false | `=== true` のときだけ真 |
| `statusSymbols` | boolean | **true** | boolean でなければ既定（true） |
| `scrollback` | `"auto"` \| number | `"auto"` | `"auto"`、または**非負の整数**。それ以外は `"auto"` |

- **scrollback の「範囲」は非負の整数**で、**サーバの上限は範囲に含めない**。上限は起動のたびに変わりうる
  実行時の値で、保存した値の正しさではない（D5）。0 を受けるのは、サーバが `--scrollback 0` を受け付けるため
  （`packages/server/src/config.ts:68`）——受けないと、上限 0 のサーバで 0 を選んでも読み直すと「自動」に戻る。
- 範囲外の幅を**丸めずに既定へ落とす**のは、**160〜360 の外の値は保存しえない**（ドラッグは範囲に収める）
  ので、範囲外は**壊れた値**だから（AC3 の「範囲外のときは既定」）。

### 純粋関数（単体で総当たりする）

```ts
// store/view.ts
export const SIDEBAR_WIDTH = { default: 240, min: 160, max: 360 } as const;
export function loadSidebarWidth(raw: unknown): number;          // 検証して number。外れたら default
export function loadSidebarCollapsed(raw: unknown): boolean;     // `=== true` のときだけ真
// store/settings.ts
export function loadStatusSymbols(raw: unknown): boolean;       // boolean でなければ true（既定。D3）
// term/scrollback.ts
export type ScrollbackPref = "auto" | number;
export const MOBILE_SCROLLBACK_LINES = 1000;                    // main.ts:45 から移す
export function loadScrollbackPref(raw: unknown): ScrollbackPref;
export function scrollbackChoices(limit: number, saved?: number): number[];
//   [1000,2000,5000,10000] ∩ (≤limit) ∪ {limit} ∪ {saved（≤limit のときだけ）}、重複なし・昇順
export function effectiveScrollback(pref: ScrollbackPref, kind: "desktop" | "mobile", limit: number): number;
//   pref === "auto" → kind === "mobile" ? 1000 : limit   （**いまの main.ts:116 と同じ**。押さえない）
//   pref が数       → min(pref, limit)
// store/stateIndicator.ts（`store/paneName.ts` と同じく .ts に置く。`<script setup>` からは export できない）
export function stateGlyph(state: DisplayState | null): string;  // 表 D4。null は ""
export function stateLabel(state: DisplayState | null): string | null;
```

### ストア

- `useViewStore`: `sidebarWidth: Ref<number>`、`setSidebarWidth(px)`（範囲に収めて反映するだけ。**保存しない**）、
  `commitSidebarWidth()`（いまの値を保存する）、`toggleSidebar()` は**切り替えと同時に保存する**。
  起動時に `readPrefs()` から両方を読む。
- `useSettingsStore`（新規。`store/settings.ts`）: `statusSymbols: Ref<boolean>`、`scrollback: Ref<ScrollbackPref>`、
  `setStatusSymbols(v)`・`setScrollback(v)`（反映と保存を同時に）。起動時に `readPrefs()` から読む。

### 部品

```vue
<!-- StateIcon.vue -->
<span class="state-icon" :data-state="state ?? 'none'" :data-symbols="symbols ? 'on' : 'off'"
      :role="state ? 'img' : undefined" :aria-label="label ?? undefined"
      :aria-hidden="state ? undefined : 'true'" :title="label ?? undefined">{{ symbols ? glyph : "" }}</span>
```

- `symbols` は `useSettingsStore().statusSymbols`。**記号「切」のときはいまの点**（CSS の丸）を描く。
- `TermEntry` に `scrollback: number | undefined` を足す（`getScrollbackLines` は省略できる＝xterm.js の既定。
  `TerminalRegistry.ts:40-44`）。**新しい読み出し口は足さない**——既存の `registry.get(paneId)?.scrollback`
  （`TerminalRegistry.ts:74`）で読める。`ViewSync` の購読は `registry.get(paneId)?.scrollback ?? getScrollbackLines()`。

### 設定ダイアログ

```
<dialog aria-labelledby="settings-title">
  <h2 id="settings-title">設定</h2>
  <section aria-labelledby="settings-notify">  <h3>通知</h3>  既存の 3 つの switch（意味は変えない。AC14）
  <section aria-labelledby="settings-display"> <h3>表示</h3>  switch「状態を記号でも示す」
  <section aria-labelledby="settings-terminal"><h3>端末</h3>  fieldset「scrollback（新しく開く pane から）」
                                                             radio: 自動（この端末では N 行）/ 1,000 行 / …
  <p>この設定はこのブラウザにだけ効きます。Esc で閉じます。</p>
</dialog>
```

## 振る舞いの詳細

### サイドバー

- 起動: `sidebarWidth`・`sidebarCollapsed` を `readPrefs()` から読み、検証して反映（最初の描画から効く）。
- ドラッグ中: `setSidebarWidth` で反映するだけ（**`localStorage` へは書かない**。毎フレームの同期 I/O を避ける）。
- ドラッグの終わり: `pointerup`・**`pointercancel`・`lostpointercapture`** のいずれでも `commitSidebarWidth()`。
- **ドラッグ中にダイアログが開いたら、その時点でドラッグを終えて保存する**（`view.openDialog` を watch）。
  `showModal()` で文書が inert になったとき、捕捉が外れるのか・捕捉先へ `pointerup` が届き続けるのかは
  **確かめた出所が無い**。**分からない挙動に頼らず**、こちらで終わらせる（AC-I5）。
  **取り消されたドラッグでも、見えている幅を覚える**（戻す先の値を持っていないうえ、見えている幅と保存値が
  食い違うほうが分かりにくい）。
- ダブルクリックで既定へ戻したときも保存する。
- 折りたたみ: `toggleSidebar()` が切り替えと同時に保存する（`prefix+b` と畳むボタンは同じ経路。F16）。

### 状態の記号

- 記号「入」: 表 D4 の字形を色で描く。**エージェントが居ない行は字形を出さず、いまの薄い丸のまま**
  （requirements の「記号を出さない（いまと同じ見え方）」。空の箱にすると、**畳んだサイドバーでは行が点だけ**
  （`Sidebar.vue:138-139`）なので、エージェントの居ない workspace の行に何も描かれなくなる）。
  `unknown` の `·` と、居ない行の薄い丸は**形で見分けが付く**（いまは両方とも薄い丸で区別が付かない。F4）。
- 記号「切」: いまの見た目（色の丸。`unknown`・`none` は薄い丸）。**読み上げの名前はどちらでも付ける**。
- 設定を変えると、サイドバー・goto・モバイルのピッカーの 3 か所が同時に切り替わる（1 つのストアを読む）。

### scrollback

- `getScrollbackLines = () => effectiveScrollback(settings.scrollback, kind, session.limits.scrollbackLines)`。
- 端末を作るときにこの値を `TermEntry.scrollback` に持ち、購読もその値を使う（D6）。
- **既に作ってある端末は変えない**（requirements の対象外）。LRU で作り直された端末には新しい値が効く（F26）。

### 設定ダイアログ

- 開く: `prefix+s`／サイドバーの［メニュー］→「設定」／モバイルの上のバーの「設定」。どれも
  `view.openDialogWithContext({ kind: "settings" })`。
- 開いたら最初の switch（通知の「画面の中で知らせる」）へフォーカス。閉じたら開く前の pane へ戻る（既存）。
- ラジオは `change` で保存する。「自動」の行の N は、開いたときの `effectiveScrollback("auto", kind, limit)`。
- **`kind` の出所**: いまは `main.ts:47` のモジュール内の定数で、どこにも渡されていない（`App.vue:37` の
  1 列レイアウトの判定は別の軸）。**`injection.ts` に `DeviceKindKey` を足し、`main.ts` が `provide` する**
  （既存の `ConnectionKey` 等と同じ流儀。`main.ts:244-249`）。ダイアログは **`inject(DeviceKindKey, "desktop")`**
  （既定値つき）で受ける。**provide が無くても throw しない**——通知の制御器（無いと嘘の理由を出すので throw する。
  `NotificationSettingsDialog.vue:22`）と違い、これが効くのは「自動」の行に添える行数の表示だけで、
  既存の単体テスト（`NotificationSettingsDialog.test.ts:48-51`・`App.test.ts:82-96`）の provide を増やさずに済む。
  **結線を落とした場合はモバイルの E2E（AC13）が「自動（この端末では 1,000 行）」の文言で捕まえる**。
  **`isCoarsePointer()` を呼び直さない**——判定が 2 か所に割れると、`getScrollbackLines` とダイアログの表示が
  食い違いうる。

## ドメイン固有の考慮

- **端末の種類（`kind`）は `(pointer: coarse)` で決まる**（F23）。窓を狭めたデスクトップは 1 列レイアウトでも
  `desktop` 扱い。この work はこの判定を変えない。
- 設定は `localStorage`（オリジンごと）に残る＝**同じブラウザの別タブには、再読み込みするまで反映されない**。
  requirements は「このブラウザに残る」までを求めており、タブ間の即時の同期は対象外とする。

## エラー処理 / 異常系

| 状況 | 扱い |
|---|---|
| `localStorage` が使えない（プライベートウィンドウ等） | 既定で動く。書き込みの失敗は黙る（`writePrefs` の既存の作法） |
| `wtm.prefs.v1` が壊れた JSON | `readPrefs()` が `{}` を返し、4 つとも既定（AC3） |
| 幅が範囲外・数でない | 240（AC3） |
| `scrollback` が負・小数・文字列 | `"auto"`（AC3） |
| 保存した `scrollback` がサーバの上限を超える | 使うときに上限で頭を押さえる。保存値はそのまま（D5） |
| サーバの上限が 1000 未満（`--scrollback 500` 等） | 選択肢は「自動」とその上限（と、上限以下の保存値。`scrollbackChoices`）。**モバイルの自動は 1000 のまま**（いまと同じ。D5 の「見え方は変わらない」） |
| サーバの上限が 0（`--scrollback 0`） | 選択肢は「自動」と 0。0 を選べば保存され、読み直しても 0 |
| snapshot の前（`limits` の初期値 5000） | 既存どおり。端末は snapshot の後に作られる |

## テストの置き方

- **純粋関数**（`loadSidebarWidth`・`loadSidebarCollapsed`・`loadStatusSymbols`・`loadScrollbackPref`・
  `scrollbackChoices`・`effectiveScrollback`・`stateGlyph`・`stateLabel`）は単体で総当たりする。
- `StateIcon.vue`・`SettingsDialog.vue`・`Sidebar.vue` は単体（happy-dom）で、役割・`aria-*`・保存を見る。
- **保存の確認は E2E で `storageState` を持ち越して行う**（research F34）。`addInitScript` で `wtm.prefs.v1` を
  仕込むと再読み込みのたびに上書きされ、**保存を確かめたことにならない**（F35）。
- **scrollback はブラウザが送った `pane.subscribe` の `scrollbackLines` を CDP で読む**（F38）。xterm の buffer は
  DOM に出ていないので、**何を観測したかを spec に書く**（条項 `e2e-observe-browser`）。
- モバイルは iPhone 13 のエミュレーション（`(pointer: coarse)` が真になることを実測済み。F37）。
- **この設計で落ちる既存テスト**（条項 `regression-negative-control`：**先に落ちることを確かめてから直す**）:
  | 変更 | 落ちるテスト |
  |---|---|
  | 入口の文言（D8） | `MobileShell.test.ts:292-297`（aria-label）・`ContextMenu.test.ts:184`・`HelpDialog.test.ts:41` |
  | action／`DialogContext` の改名（D7） | `KeyRouter.test.ts:146`・`MobileShell.test.ts:299`・`ActionDispatcher.test.ts:902-907`・`ContextMenu.test.ts:187-193`・`NotificationController.test.ts:944`（型。`tsconfig.typecheck.json` はテストも検査する）・**`NotificationSettingsDialog.test.ts:52`・`:141`**（開き方）。**ダイアログが文脈を見る `NotificationSettingsDialog.vue:68` も同時に改める**（片方だけだと型検査で落ち、開かなくなる） |
  | ダイアログの改名と節（D7） | `NotificationSettingsDialog.test.ts` の 2 か所（AC14）、E2E `notifications.spec.ts:385`（`.notify-settings`） |
- **購読の行数（D6）では既存テストは落ちない**（`ViewSync.test.ts:36` の偽の registry の `get` は `scrollback` を持たないので
  `?? getScrollbackLines()` に落ち、期待値のまま通る）。**新しいテスト**「作ったときの値が `getScrollbackLines` より
  優先される」を足し、その負の対照（`registry.get(...)?.scrollback` を読まない形に戻すと落ちる）で守りを確かめる。
- **クラス名と名前は改める**（中身と食い違ったまま残さない。D7）: ダイアログ `.notify-settings` → `.settings-dialog`、
  **子のクラスもすべて** `.notify-settings-*`（`-title`・`-list`・`-row`・`-switch`・`-mark`・`-note`・`-hint`）→
  `.settings-*`（表示・端末の節も同じクラスを使う）、
  モバイルのボタン `.mobile-shell-notify-btn`（`aria-label="通知の設定"`）→ `.mobile-shell-settings-btn`（文字「設定」）。
  E2E のセレクタもあわせて直す。

## 受け入れ基準との対応

- AC1: 幅の入力は**ドラッグ**（`Sidebar.vue` の `pointermove`）。`pointerup` 等で `commitSidebarWidth()` が
  `wtm.prefs.v1.sidebarWidth` に書き、起動時に `loadSidebarWidth(readPrefs().sidebarWidth)` で戻す。
  E2E は `storageState` を持ち越した新しい context で幅を測る。
- AC2: 入力は**畳むボタン／`prefix+b`**（どちらも `toggleSidebar()`）。切り替えと同時に `sidebarCollapsed` を書き、
  起動時に読み戻す。E2E は AC1 と同じ持ち越しで `.sidebar-collapsed` を見る。
- AC3: 入力は**保存された `wtm.prefs.v1`**。4 つの `load*`（`loadSidebarWidth`・`loadSidebarCollapsed`・
  `loadStatusSymbols`・`loadScrollbackPref`）がそれぞれ既定へ落とす（表「インターフェース」）。
  **scrollback の「範囲外」は非負の整数でないこと**で、サーバの上限を超える値は範囲外ではない（使うときに押さえる。D5）。
  E2E は `storageState` で壊れた値を 1 回だけ仕込んで起動する（F35）。
- AC4: 入力は**表示状態**（`displayStateFor`／`aggregate` の結果）と `statusSymbols`。`StateIcon` が表 D4 の字形を出す。
  5 つが別の字形であることは `stateGlyph` の単体で総当たりする。
- AC5: `StateIcon` は字形を `color`（状態ごとの色）で描く。**確かめ方は E2E**——vitest は SFC の `<style>` を
  読み込まない（`packages/web/vitest.config.ts` に `css` の指定が無く、既定の `css.include` は空）ので、
  happy-dom からは色が見えない。E2E で入力待ちのエージェントの行の `getComputedStyle(el).color` が
  blocked の色であり、**かつ字形が `×`** であることを読む。
- AC6: 入力は「表示」節の switch → `setStatusSymbols(false)`。`StateIcon` は字形を出さず、いまの丸を描く。
  確かめ方は単体（`StateIcon` の文字が空で `data-symbols="off"`）と E2E（切り替えた後の行の文字が空）。
- AC7: `statusSymbols` の既定が `true`（`loadStatusSymbols(undefined) === true`）。E2E は何も仕込まない context で見る。
- AC8: 入力は `state === null`（エージェントが居ない。`displayStateFor` が返す）。`StateIcon` は字形も名前も出さない
  （`aria-hidden`）。確かめ方は単体（`stateGlyph(null) === ""`・`aria-hidden="true"`）と E2E（エージェントの居ない
  workspace の行の文字が空）。
- AC9: 入力は**設定ダイアログのラジオ**（`change`）。`setScrollback` → 次に作る端末で `effectiveScrollback` が効き、
  購読の `scrollbackLines` に出る（D6）。E2E は CDP で `pane.subscribe` を読む。
- AC10: `scrollback` は `wtm.prefs.v1` に保存し、起動時に `loadScrollbackPref` で戻す。E2E は `storageState` を持ち越した
  新しい context で、**設定ダイアログの端末の節で選んだ行のラジオが選ばれている**ことと、**新しく開いた pane の
  `pane.subscribe` がその行数を送る**ことを見る（判定はブラウザの側。条項 `e2e-observe-browser`）。
- AC11: `effectiveScrollback` が `kind === "mobile"` でも**数の設定を優先**する（1000 の固定は `"auto"` のときだけ）。
  E2E は iPhone 13 で数を選び、新しい pane の購読を読む。
- AC12: 入力は `prefix+s`（`keymap.ts:57` → action `settings`）。`SettingsDialog` に 3 つの `<section>`
  （見出し「通知」「表示」「端末」）。確かめ方は E2E（`prefix+s` で開き、見出し 3 つが見える）。
- AC13: 入力は**モバイルの上のバーの「設定」**。同じ `openDialogWithContext({ kind: "settings" })`。E2E は iPhone 13。
- AC14: 通知の 3 つの switch は、`SettingsDialog` の「通知」節に**同じ実装で**移す（`toggleToast`・`toggleDesktop`・
  `toggleSound` と注記をそのまま）。既存の単体テスト（`NotificationSettingsDialog.test.ts`）は改名先へ移し、
  **意味の検証（押した結果・許可の 4 状態・音）は変えない**。**そのままでは通らない 2 か所だけ直す**
  （開き方の `kind` は文脈の改名と同時に直す。表の 2 行目）:
  - switch を数える箇所（`:62-68` の `toHaveLength(3)` と `aria-checked` の並び）→ **「通知」節の中の switch に限る**
    （`section[aria-labelledby="settings-notify"] [role="switch"]`）。表示節の switch（既定は入）が加わるため。
  - ダイアログの名前を見る箇所（`:235-237` の `aria-label="通知の設定"`）→ `aria-labelledby` が見出し「設定」を指すことを見る。
- AC15: 入力は**別の context**（`browser.newContext()`。F36）。**判定は画面の状態**——サイドバーの幅が 240px・展開、
  状態の点に字形が出ている、設定ダイアログで「自動」が選ばれている（保存域の中身では判定しない。条項 `e2e-observe-browser`）。
- AC16: `docs/herdr-parity.md` を更新する。**実装していない項目まで済みに見せないよう、行を割る**
  （前 work で H37 を H37／H37b に割った先例。`docs/herdr-parity.md` の凡例に work の slug の行がある）。
  - H06（scrollback）: 「このブラウザでの行数の設定」をこの work で足したと書く。
  - H19（サイドバー）: 幅と折りたたみの保存をこの work で足したと書く。
  - **H23 はそのまま**（pane の枠・隙間・エージェント名の表示の設定は未実装）。**新しい行 H23b**
    「状態表示を記号にする設定」を足し、この work で実装済みにする（前々 work の調査の原文。F11）。
  - **H25 を割る**: H25「設定画面」をこの work で実装済みに、**H25b「設定の再読み込み・onboarding」**を後続のまま残す。
  確かめ方は文書の目視（test 工程で行を読む）。
- AC-I1: 3 つの入口がどれも `openDialogWithContext({ kind: "settings" })`。閉じ方は既存の `<dialog>` の作法（F28）。
  確かめ方: E2E で `prefix+s`・サイドバーの［メニュー］→「設定」・モバイルの「設定」の 3 経路で開き、Esc で閉じる。
  単体（`SettingsDialog`）で背景クリックでも閉じ、押した結果が残る。
- AC-I2: switch は押した時点、ラジオは `change` の時点で `writePrefs`。確定ボタンは置かない。
  確かめ方: 単体で「表示」の switch を押す／端末のラジオを選ぶと `wtm.prefs.v1` に書かれ、`button[type=submit]` が無い。
- AC-I3: 見出し付きのグループなので **Tab で節をまたいで進み**、ラジオの中は**矢印**（ネイティブ）。
  ダイアログ中は window の keydown が何もしない（F29）ので横取りされない。
  確かめ方: E2E でキーだけで開く → Tab で端末の節のラジオへ入る → 矢印で選ぶ → Esc で閉じ、保存されたことを
  開き直したダイアログのラジオで見る（ネイティブの矢印の挙動は happy-dom では再現しないので E2E）。
- AC-I4: 開いたら最初の switch へ（既存）。閉じたら開く前の pane へ（`view.ts:204-225`。既存）。
  確かめ方: 既存の単体（開いたら最初の switch へ）を改名先で通す。閉じた後は既存の仕組みのまま。
- AC-I5: ダイアログ中のキーは既存の作法で端末へ漏らさない。**ドラッグ中にダイアログが開いたら、`view.openDialog` の
  watch でドラッグを終えて `commitSidebarWidth()` する**（「振る舞いの詳細」のサイドバー。ポインタの捕捉の挙動には頼らない）。
  確かめ方: 単体（`Sidebar`）で `pointerdown` → `pointermove` → `openDialogWithContext` の順に起こし、
  `wtm.prefs.v1.sidebarWidth` が動かした幅になっていること、その後の `pointermove` で幅が変わらないことを見る。
