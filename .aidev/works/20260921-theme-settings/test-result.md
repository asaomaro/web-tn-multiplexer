# テスト結果: テーマを選び、OS の明暗に合わせて切り替える（herdr のテーマ）

## 実行したもの

- `pnpm build` — exit 0（E2E は build した dist を使う）
- `pnpm -C packages/protocol exec vitest run` — 57 passed / 0 failed（6 files）
- `pnpm -C packages/server exec vitest run` — 616 passed / 0 failed（48 files）
- `pnpm -C packages/web exec vitest run` — 1167 passed / 0 failed（71 files）
- `pnpm -C packages/{protocol,server,web,e2e} run typecheck` — 4 つとも exit 0。`pnpm run lint` — exit 0
- 影響を受ける E2E（利用者の指示どおり一式ではなく該当の spec だけ。一式は deliver の直前に 1 回）：
  `theme-settings.spec.ts`・`settings.spec.ts`・`mobile.spec.ts`・`scrollback-copy.spec.ts`・`keys-mouse-dialogs.spec.ts`・`notifications.spec.ts`・
  `reconnect-restore.spec.ts` — ラウンド 1 は 55 passed / 1 failed（下の「失敗の証跡」）。`mobile.spec.ts` の期待を直した後、
  `mobile.spec.ts` — 6 passed / 0 failed。合わせて 56 本すべて通過（theme-settings 7・settings 11 を含む）
- `aidev smoke` — pass（下の「起動確認」）
- deliver の直前の E2E の一式 — 100 passed / 2 failed（負荷による時間切れ。単独・3 回の繰り返しで通過。下の「失敗の証跡」）
- review ラウンド 1 の差し戻しの後：`pnpm -C packages/web exec vitest run` — 1202 passed / 0 failed、型の検査・lint — exit 0、
  `theme-settings.spec.ts` — 8 passed（モバイルの自動の切替・明るいテーマの pane の枠を足した）、`keys-mouse-dialogs.spec.ts`・`workspace-tab-pane.spec.ts` — 23 passed
- review ラウンド 2 の差し戻しの後：`pnpm -C packages/web exec vitest run` — 1203 passed / 0 failed、型の検査・lint — exit 0。
  直し（警告を薄めない）を守るのは単体 `packages/web/src/theme/uiTokens.test.ts` の「警告の文字を薄めない（Sidebar.vue）」（下の負の対照）。
  E2E の `notifications.spec.ts`・`theme-settings.spec.ts` — 16 passed は、サイドバーの見た目の回帰の確認として走らせた（「未検証」を見る E2E は無い。
  review ラウンド 3 で記述を直した）

- review ラウンド 3 の差し戻しの後（記述とコメントだけの直し。decisions D16 の理由・dracula で変わった箇所の一覧）：`pnpm -C packages/web exec vitest run` — 1203 passed / 0 failed、lint — exit 0

## 受け入れ基準ごとの判定

- AC1: pass — 単体 `SettingsDialog.test.ts`（17 個・暗い 10／明るい 7 の 2 群・dracula に「（既定）」）、E2E `theme-settings.spec.ts` の 1 本目（17 個の選択肢）。
- AC2: pass — E2E 1 本目：キーで選ぶたびにサイドバーの計算済みの背景と、分割した 2 つの端末の背景が替わる。部品の色は全部 CSS 変数から
  （単体 `uiTokens.test.ts` の「部品の CSS の透明度」と、直に書いた色が予備の値以外に残っていないこと——T10 の点検で grep）。状態の記号・エラー・警告・
  暗幕は変数の値が全テーマで決まる（`uiTokens.test.ts`）。モバイルは AC13。
- AC3: pass — E2E 2 本目（開き直すと本体が走る前の `<html>` の inline の変数が選んだテーマ。自動の切替が切なら OS が暗くても固定の組）・3 本目（自動の切替が入なら
  そのときの OS の明暗に合ったほう）・別のブラウザは dracula。単体 `themeBoot.test.ts`（控えから本体と同じ組を選ぶ）・`settings.test.ts`（4 つの値の保存と読み戻し）。
- AC4: pass — 単体 `themes.test.ts`（値ごとの落とし先）・`settings.test.ts`（何も無ければ dracula）・`uiTokens.test.ts`（dracula の 18 変数と color-scheme が
  今の値。変えたのは decisions D1〜D3 だけ。変数の外では、規則をそろえるための例外としてサイドバーの「未検証」を薄めずに描く——decisions D16）・
  `App.vue` の `:root` との一致。E2E 1 本目・`settings.spec.ts:234`（blocked の色が今の値）。
- AC5: pass — E2E 3 本目（`emulateMedia` で OS の明暗を替えると再読み込み無しで追従）・1 本目（「暗いとき」をキーで選ぶと使われる）。単体 `ThemeController.test.ts`。
- AC6: pass — 単体 `themes.test.ts`（7 組と、対の無い 3 つは暗い＝自身・明るい＝catppuccin-latte）・`SettingsDialog.test.ts`（「既定（〈対〉）」の表示と null に戻す）。
- AC7: pass — E2E 1 本目（切り替えを Space で入切し、切ると 1 つのテーマに戻る。「いま使っているテーマ」の文）。単体 `settings.test.ts`（1 つのテーマを選ぶと切れる）。
- AC8: pass — E2E 4 本目：pane の中で node に OSC 11 を問い合わせさせ、ブラウザが受けた画面で答えを読む。開いた直後（接続ごとの送り直し）・見ているだけの
  別のブラウザ・入力して操作を取った別のブラウザ・テーマを替えた後の 4 通り。単体 `answerPalette.test.ts`（引き方の 4 段）・`Mirror.test.ts`（問い合わせの
  瞬間に引く）・`index.test.ts`（作る方式が作る前に操作の時刻を進める。decisions D13）。
- AC9: pass — 単体 `uiTokens.test.ts` が 17 テーマ × design の表の相手（文字 4.5・薄めた文字 0.7 で 4.5・状態の 4 色 3・フォーカスの枠 3・再接続の幕の上の文字 4.5）。
  入力欄の枠とフォーカスの枠は E2E 1 本目で Chromium の描いた色をダイアログの計算済みの背景と比べる（nord・catppuccin-latte。decisions D4）。
  review ラウンド 1 で、選ばれている pane の枠（背景・端末の背景に 3:1）と選択の面（枠の背景に 1.5）を全テーマの検査に足した（decisions D15。E2E でも明るいテーマの枠を測る）。
- AC10: pass — E2E 1 本目（明るいテーマで `<html>` の `color-scheme` が light）・単体 `ThemeController.test.ts`・`themeBoot.test.ts`。
- AC11: pass — `docs/herdr-parity.md` の H24（herdr との違い 9 つ・対象外の理由）と H25（4 節）。T17 の点検で実装と突き合わせた。
- AC12: pass — `docs/verification.md` の前提の説明・Linux の手元の 3 項目（テーマ・OS の明暗・色の問い合わせ）・他の機器の節の 1 行・既知の制約 2 つ。
  色の問い合わせの手順のコマンドは T17 の点検が PTY で動くことを確かめた。
- AC13: pass — E2E のモバイルの 2 本（`IPHONE_13`。上のバーの［設定］から選ぶと上のバー・追加のキー・端末の色が替わり、開き直しても残る。
  自動の切替が入っていれば OS の明暗を替えると上のバーと端末の色が追従する——review ラウンド 1 で足した）。
- AC14: pass — `.aidev/backlog/product-roadmap.md` に 2 件（色の個別の上書き・明暗の変化をアプリへ知らせる）。
- AC-I1: pass — E2E 1 本目（`prefix+s` で開き Esc で閉じる）・モバイル（［設定］で開き［閉じる］）・既存の `settings.spec.ts`（3 つの入口）。
- AC-I2: pass — E2E 1 本目（選んだ時点で反映、Esc で閉じても残る、開く前の dracula を選び直すと元に戻る）。
- AC-I3: pass — E2E 1 本目（Tab で「テーマ」へ、上下キーで選ぶ、Tab で切り替えへ移って Space、「暗いとき」を上下キー、Shift+Tab で戻って Space、Esc）。
- AC-I4: pass — E2E 1 本目（選んだ後も選択肢にフォーカス、切り替えを押してもそこに残る、閉じると端末の入力欄へ戻る）・単体 `SettingsDialog.test.ts`。
- AC-I5: pass — E2E 5 本目（テーマが替わってもスクロールのつまみの位置・copy モードの選択・打ちかけの入力が保たれる）・6 本目（ダイアログの上の Ctrl+B→c が
  名前のダイアログを開かず、端末へ何も送らない）。単体 `TerminalRegistry.test.ts`（`options.theme` だけを替え、作り直さず中身を保つ）。

## 失敗の証跡

### test ラウンド 1（影響を受ける E2E の 7 spec）

```
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts src/specs/settings.spec.ts src/specs/mobile.spec.ts src/specs/scrollback-copy.spec.ts src/specs/keys-mouse-dialogs.spec.ts src/specs/notifications.spec.ts src/specs/reconnect-restore.spec.ts --reporter=line  # exit 1
  1) src/specs/mobile.spec.ts:189:1 › 「この端末に合わせる」を有効にしたまま繋ぎ直すと、新しい接続でも client.fit を送り直し、PTY をスマートフォンの大きさに戻す（D108） 

    Error: 新しい接続で client.view → client.fit → pane.subscribe の順に送る

    新しい接続で client.view → client.fit → pane.subscribe の順に送る

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Array [
        "client.hello",
    +   "client.theme",
        "client.view",
        "client.fit",
    -   "pane.subscribe",
      ]

    Call Log:
    - Timeout 5000ms exceeded while waiting on the predicate

      250 |   await expect.soft
      251 |     .poll(() => ws.sent(1).map((r) => r.method).slice(0, 4), { message: "新しい接続で client.view → client.fit → pane.subscribe の順に送る" })
    > 252 |     .toEqual(["client.hello", "client.view", "client.fit", "pane.subscribe"]);
          |      ^
      253 |   expect.soft(ws.sent(1).find((r) => r.method === "client.fit")?.params, "送り直す client.fit は有効").toEqual({ enabled: true });
      254 |
      255 |   // サーバの PTY がスマートフォンの大きさ（新しい接続の申告。表示領域は変わっていないので切断の前と同じ）に戻る。
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/mobile.spec.ts:252:6

  1 failed
  55 passed (4.5m)
```

原因：既存の `mobile.spec.ts:250-252` が、新しい接続でページが送る要求の先頭 4 つを `["client.hello", "client.view", "client.fit", "pane.subscribe"]` と
決め打ちしていた。この work で接続ごとにテーマを送り直す（`main.ts` の `connection.onOpened(() => themeController.resend())`。design D6・AC8）ので、
`client.theme` が hello の直後に入る。製品の振る舞いは意図どおりで、テストの期待を直す（fit の並びは `client.theme` を除いて見て、テーマも送り直す
ことを別に確かめる）。

### deliver の直前の E2E の一式

```
$ pnpm build && pnpm -C packages/e2e exec playwright test --reporter=line  # exit 1（11.7 分。普段は 6 分ほど。負荷平均は 9 を超えていた）
  1) src/specs/terminal-app.spec.ts:15:1 › vim: 全画面 TUI が alternate screen へ入り、編集・保存・終了できる（崩れの無いことの確認） 
    Test timeout of 30000ms exceeded.
  2) src/specs/terminal-app.spec.ts:42:1 › top: 別の全画面 TUI も崩れずにフルスクリーン描画・終了できる（htop はこの検証環境に無いため代替。decisions.md D90 参照） 
    Test timeout of 30000ms exceeded.
  2 failed
  100 passed (11.7m)
```

落ちた 2 本は、どちらも 30 秒の時間切れ。落ちたときのページの画面は「再接続中…／つながるまで入力できません」（ブラウザの WebSocket が切れていた）で、
サーバの異常のログは無い。単独で走らせると通り、3 回繰り返しても全部通った：

```
$ pnpm -C packages/e2e exec playwright test src/specs/terminal-app.spec.ts -g "vim|top" --reporter=line  # exit 0
  2 passed (12.4s)
$ pnpm -C packages/e2e exec playwright test src/specs/terminal-app.spec.ts --repeat-each=3 --reporter=line  # exit 0
  21 passed (1.3m)
```

負荷による接続の途切れと判断した（この 2 本はテーマを設定していないブラウザで、色の問い合わせには以前と同じ dracula で答える。この work の変更が
接続を切る経路は無い）。一式の残り 100 本は通過。

## 負の対照（条項 `regression-negative-control`）

直した箇所・守る規則を戻す変異を入れ、テストが落ちること、元に戻したこと（`cmp`）を確かめた。変異の差分とテストの出力をそのまま貼る。
coding の間に取った記録のうち、抜き出しで生の出力になっていなかったもの（T2・T5・T6・T8）は、test 工程で差分と出力を省かない形に取り直した。

### T2（端末の配色の規則。decisions D5・D10）

```
$ # 変異: 規則 (a) から『背景のほうが大きい』を外す
$ git diff（変異）
--- a/packages/protocol/src/theme.ts
+++ b/packages/protocol/src/theme.ts
@@ -321 +321 @@
-    if (fgSel < 3 && bgSel > fgSel) out.selectionForeground = p.background;
+    if (fgSel < 3) out.selectionForeground = p.background;
$ pnpm -C packages/protocol exec vitest run src/theme.test.ts  # exit 1
     × 規則 (a)：選んだ文字を背景色にするのは、ちょうど 5 つ（design D2・decisions D5） 6ms
     × 文字と選択の比が 3 未満でも、背景のほうがもっと悪ければ当てない（tokyo-night-day の形） 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme.test.ts > TERMINAL_PALETTES > 規則 (a)：選んだ文字を背景色にするのは、ちょうど 5 つ（design D2・decisions D5）
AssertionError: expected [ 'catppuccin', …(5) ] to deeply equal [ 'catppuccin', 'nord', …(3) ]
 FAIL  src/theme.test.ts > finalizePalette > 文字と選択の比が 3 未満でも、背景のほうがもっと悪ければ当てない（tokyo-night-day の形）
AssertionError: expected '#e1e2e7' to be undefined
$ # 元に戻した: cmp packages/protocol/src/theme.ts → 一致

$ # 変異: 規則 (b) を外す
$ git diff（変異）
--- a/packages/protocol/src/theme.ts
+++ b/packages/protocol/src/theme.ts
@@ -323 +322,0 @@
-  if (contrastRatio(p.cursor, p.background) < 3) out.cursor = p.foreground;
$ pnpm -C packages/protocol exec vitest run src/theme.test.ts  # exit 1
     × 規則 (c)：dracula 以外は、ブロックカーソルの下の文字が背景色で、カーソルとの比が 3 以上（decisions D10） 3ms
     × 規則 (b)：カーソルを文字の色にするのは catppuccin-latte と one-light の 2 つ。どのテーマでもカーソルと背景の比は 3 以上 3ms
     × カーソルが背景に溶けるなら文字の色にし、見えるならそのまま 1ms
 Test Files  1 failed (1)
      Tests  3 failed | 13 passed (16)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme.test.ts > TERMINAL_PALETTES > 規則 (c)：dracula 以外は、ブロックカーソルの下の文字が背景色で、カーソルとの比が 3 以上（decisions D10）
AssertionError: catppuccin-latte: expected 2.3360251825992453 to be greater than or equal to 3
 FAIL  src/theme.test.ts > TERMINAL_PALETTES > 規則 (b)：カーソルを文字の色にするのは catppuccin-latte と one-light の 2 つ。どのテーマでもカーソルと背景の比は 3 以上
AssertionError: expected '#dc8a78' to be '#4c4f69' // Object.is equality
 FAIL  src/theme.test.ts > finalizePalette > カーソルが背景に溶けるなら文字の色にし、見えるならそのまま
AssertionError: expected '#bbbbbb' to be '#2a2c33' // Object.is equality
$ # 元に戻した: cmp packages/protocol/src/theme.ts → 一致

$ # 変異: 規則 (b) を無条件にする
$ git diff（変異）
--- a/packages/protocol/src/theme.ts
+++ b/packages/protocol/src/theme.ts
@@ -323 +323 @@
-  if (contrastRatio(p.cursor, p.background) < 3) out.cursor = p.foreground;
+  out.cursor = p.foreground;
$ pnpm -C packages/protocol exec vitest run src/theme.test.ts  # exit 1
     × 規則 (b)：カーソルを文字の色にするのは catppuccin-latte と one-light の 2 つ。どのテーマでもカーソルと背景の比は 3 以上 9ms
     × カーソルが背景に溶けるなら文字の色にし、見えるならそのまま 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme.test.ts > TERMINAL_PALETTES > 規則 (b)：カーソルを文字の色にするのは catppuccin-latte と one-light の 2 つ。どのテーマでもカーソルと背景の比は 3 以上
AssertionError: expected '#cdd6f4' to be '#f5e0dc' // Object.is equality
 FAIL  src/theme.test.ts > finalizePalette > カーソルが背景に溶けるなら文字の色にし、見えるならそのまま
AssertionError: expected '#dcd7ba' to be '#f5e0dc' // Object.is equality
$ # 元に戻した: cmp packages/protocol/src/theme.ts → 一致

$ # 変異: 規則 (c) を外す（カーソルの下の文字を渡さない。decisions D10）
$ git diff（変異）
--- a/packages/protocol/src/theme.ts
+++ b/packages/protocol/src/theme.ts
@@ -324 +323,0 @@
-  if (p.cursorAccent === undefined) out.cursorAccent = p.background;
$ pnpm -C packages/protocol exec vitest run src/theme.test.ts  # exit 1
     × 規則 (c)：dracula 以外は、ブロックカーソルの下の文字が背景色で、カーソルとの比が 3 以上（decisions D10） 8ms
 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme.test.ts > TERMINAL_PALETTES > 規則 (c)：dracula 以外は、ブロックカーソルの下の文字が背景色で、カーソルとの比が 3 以上（decisions D10）
AssertionError: catppuccin: expected undefined to be '#1e1e2e' // Object.is equality
$ # 元に戻した: cmp packages/protocol/src/theme.ts → 一致
```

### T5（答えの引き方。design D6・decisions D7・D8）

```
$ # 変異: 権限者の配色を見ない（表示している人を先に見る）
$ git diff（変異）
--- a/packages/server/src/clients/answerPalette.ts
+++ b/packages/server/src/clients/answerPalette.ts
@@ -38 +37,0 @@
-    if (owner?.theme) return TERMINAL_PALETTES[owner.theme];
$ pnpm -C packages/server exec vitest run src/clients/answerPalette.test.ts  # exit 1
     × 1. サイズを決めているクライアントのテーマで答える——ほかに最近操作した人がいても 19ms
     × 1. 権限者が別の tab を表示していても（権限は前の tab に残る。SizeAuthority の注記）、権限者の配色で答える 3ms
 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 1. サイズを決めているクライアントのテーマで答える——ほかに最近操作した人がいても
AssertionError: expected { foreground: '#d8dee9', …(6) } to be { foreground: '#4c4f69', …(5) } // Object.is equality
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 1. 権限者が別の tab を表示していても（権限は前の tab に残る。SizeAuthority の注記）、権限者の配色で答える
AssertionError: expected { foreground: '#d8dee9', …(6) } to be { foreground: '#ffffff', …(5) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/clients/answerPalette.ts → 一致

$ # 変異: 表示している人の最新でなく最初を取る
$ git diff（変異）
--- a/packages/server/src/clients/answerPalette.ts
+++ b/packages/server/src/clients/answerPalette.ts
@@ -51 +51 @@
-    if (!latest || c.lastActedAt > latest.lastActedAt) latest = c;
+    if (!latest || c.lastActedAt < latest.lastActedAt) latest = c;
$ pnpm -C packages/server exec vitest run src/clients/answerPalette.test.ts  # exit 1
     × 2. 権限者がまだテーマを伝えていなければ、その tab を表示していてテーマを伝えた人のうち最後に操作した人 11ms
     × 2. 一度も操作していない後から来た人（接続の時刻だけが新しい）は、操作した人に勝たない（decisions D13） 3ms
     × 3. その tab に答えられる人がいなければ（新しい tab はまだ誰も見ていない）、テーマを伝えた全員のうち最後に操作した人 2ms
     × 3. pane・tab がまだ引けない（起動の猶予の間・消えた tab）ときも、テーマを伝えた全員のうち最後に操作した人 2ms
 Test Files  1 failed (1)
      Tests  4 failed | 7 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 2. 権限者がまだテーマを伝えていなければ、その tab を表示していてテーマを伝えた人のうち最後に操作した人
AssertionError: expected { foreground: '#ebdbb2', …(5) } to be { foreground: '#575279', …(5) } // Object.is equality
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 2. 一度も操作していない後から来た人（接続の時刻だけが新しい）は、操作した人に勝たない（decisions D13）
AssertionError: expected { foreground: '#ffffff', …(5) } to be { foreground: '#d8dee9', …(6) } // Object.is equality
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 3. その tab に答えられる人がいなければ（新しい tab はまだ誰も見ていない）、テーマを伝えた全員のうち最後に操作した人
AssertionError: expected { foreground: '#d8dee9', …(6) } to be { foreground: '#3c3836', …(6) } // Object.is equality
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 3. pane・tab がまだ引けない（起動の猶予の間・消えた tab）ときも、テーマを伝えた全員のうち最後に操作した人
AssertionError: expected { foreground: '#ffffff', …(5) } to be { foreground: '#2a2c33', …(5) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/clients/answerPalette.ts → 一致

$ # 変異: attach 前に dracula を返さない
$ git diff（変異）
--- a/packages/server/src/clients/answerPalette.ts
+++ b/packages/server/src/clients/answerPalette.ts
@@ -64 +64 @@
-    paletteFor: (paneId) => (deps ? answerPaletteFor(paneId, deps) : DEFAULT_THEME),
+    paletteFor: (paneId) => (deps ? answerPaletteFor(paneId, deps) : TERMINAL_PALETTES.catppuccin),
$ pnpm -C packages/server exec vitest run src/clients/answerPalette.test.ts  # exit 1
     × attach されるまでは dracula、attach 後は answerPaletteFor の答え 11ms
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/clients/answerPalette.test.ts > createPaletteSource（composeServer の後から埋める箱） > attach されるまでは dracula、attach 後は answerPaletteFor の答え
AssertionError: expected { foreground: '#cdd6f4', …(6) } to be { foreground: '#f8f8f2', …(3) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/clients/answerPalette.ts → 一致

$ # 変異: 3 段目（テーマを伝えた全員のうち最後に操作した人）を外す
$ git diff（変異）
--- a/packages/server/src/clients/answerPalette.ts
+++ b/packages/server/src/clients/answerPalette.ts
@@ -42,2 +42 @@
-  const anyone = latestWithTheme(deps.clients.list(), () => true);
-  return anyone ? TERMINAL_PALETTES[anyone] : DEFAULT_THEME;
+  return DEFAULT_THEME;
$ pnpm -C packages/server exec vitest run src/clients/answerPalette.test.ts  # exit 1
     × 3. その tab に答えられる人がいなければ（新しい tab はまだ誰も見ていない）、テーマを伝えた全員のうち最後に操作した人 30ms
     × 3. pane・tab がまだ引けない（起動の猶予の間・消えた tab）ときも、テーマを伝えた全員のうち最後に操作した人 13ms
 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 3. その tab に答えられる人がいなければ（新しい tab はまだ誰も見ていない）、テーマを伝えた全員のうち最後に操作した人
AssertionError: expected { foreground: '#f8f8f2', …(3) } to be { foreground: '#3c3836', …(6) } // Object.is equality
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 3. pane・tab がまだ引けない（起動の猶予の間・消えた tab）ときも、テーマを伝えた全員のうち最後に操作した人
AssertionError: expected { foreground: '#f8f8f2', …(3) } to be { foreground: '#2a2c33', …(5) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/clients/answerPalette.ts → 一致

$ # 変異: 操作の時刻を資格の判定の後に戻す（decisions D7）
$ git diff（変異）
--- a/packages/server/src/clients/SizeAuthority.ts
+++ b/packages/server/src/clients/SizeAuthority.ts
@@ -53,0 +54 @@
+    if (!canDecideSize(client)) return; // fit していないモバイルは権限を取らない
@@ -55 +55,0 @@
-    if (!canDecideSize(client)) return; // fit していないモバイルは権限を取らない
$ pnpm -C packages/server exec vitest run src/clients/SizeAuthority.test.ts  # exit 1
     × fit していないモバイルの入力でも操作の時刻は進み（権限は取らない）、色の問い合わせには後から入力したモバイルの配色で答える（20260921-theme-settings の decisions D7） 19ms
 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — モバイルは既定でサイズを決めない（D13・D106） > fit していないモバイルの入力でも操作の時刻は進み（権限は取らない）、色の問い合わせには後から入力したモバイルの配色で答える（20260921-theme-settings の decisions D7）
AssertionError: expected 1000 to be 3000 // Object.is equality
$ # 元に戻した: cmp packages/server/src/clients/SizeAuthority.ts → 一致
```

### T6（Mirror は問い合わせの瞬間に引く）

```
$ # 変異: TerminalManager が作るときに 1 回引いて保持する
$ git diff（変異）
--- a/packages/server/src/terminal/TerminalManager.ts
+++ b/packages/server/src/terminal/TerminalManager.ts
@@ -64 +64 @@
-      paletteFor ? () => paletteFor(paneId) : undefined,
+      paletteFor ? ((p) => () => p)(paletteFor(paneId)) : undefined,
$ pnpm -C packages/server exec vitest run src/terminal/TerminalManager.integration.test.ts  # exit 1
     × paletteFor を pane ごとに Mirror へ渡す（色の問い合わせの答え。20260921-theme-settings の design D6） 18ms
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/terminal/TerminalManager.integration.test.ts > DefaultTerminalManager (integration) > paletteFor を pane ごとに Mirror へ渡す（色の問い合わせの答え。20260921-theme-settings の design D6）
AssertionError: expected [ 'p2' ] to deeply equal []
$ # 元に戻した: cmp packages/server/src/terminal/TerminalManager.ts → 一致
```

### T8（名前の解決と保存値の読み込み）

```
$ # 変異: 対の無いテーマの明るい側を自身にする（herdr と同じ）
$ git diff（変異）
--- a/packages/web/src/theme/themes.ts
+++ b/packages/web/src/theme/themes.ts
@@ -46 +46 @@
-  return pair ? { dark: pair[0], light: pair[1] } : { dark: name, light: LIGHT_FALLBACK };
+  return pair ? { dark: pair[0], light: pair[1] } : { dark: name, light: name };
$ pnpm -C packages/web exec vitest run src/theme/themes.test.ts  # exit 1
     × 対の無い dracula・nord・vesper は、暗いときが自身・明るいときが catppuccin-latte（herdr は明暗とも自身） 9ms
     × どのテーマでも、対の明るい側は明るいテーマ・暗い側は暗いテーマ 3ms
 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/themes.test.ts > siblingThemes（AC6・design D7） > 対の無い dracula・nord・vesper は、暗いときが自身・明るいときが catppuccin-latte（herdr は明暗とも自身）
AssertionError: expected { dark: 'dracula', light: 'dracula' } to deeply equal { dark: 'dracula', …(1) }
 FAIL  src/theme/themes.test.ts > siblingThemes（AC6・design D7） > どのテーマでも、対の明るい側は明るいテーマ・暗い側は暗いテーマ
AssertionError: dracula: expected 'dark' to be 'light' // Object.is equality
$ # 元に戻した: cmp packages/web/src/theme/themes.ts → 一致

$ # 変異: 壊れた themeLight を dracula に落とす
$ git diff（変異）
--- a/packages/web/src/theme/themes.ts
+++ b/packages/web/src/theme/themes.ts
@@ -78 +78 @@
-    light: isThemeName(raw["themeLight"]) ? raw["themeLight"] : null,
+    light: isThemeName(raw["themeLight"]) ? raw["themeLight"] : DEFAULT_THEME_NAME,
$ pnpm -C packages/web exec vitest run src/theme/themes.test.ts  # exit 1
     × 何も保存していなければ dracula・切・対の既定 11ms
     × 壊れた値・知らない名前は、その値だけを落とす（ほかの値は保つ） 3ms
     × 壊れた「明るいとき」は dracula ではなく対の既定（null）に落ち、解決すると 1 つのテーマの対になる 2ms
 Test Files  1 failed (1)
      Tests  3 failed | 10 passed (13)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/themes.test.ts > loadThemePrefs（AC4：値ごとに落とす） > 何も保存していなければ dracula・切・対の既定
AssertionError: expected { theme: 'dracula', auto: false, …(2) } to deeply equal { theme: 'dracula', auto: false, …(2) }
 FAIL  src/theme/themes.test.ts > loadThemePrefs（AC4：値ごとに落とす） > 壊れた値・知らない名前は、その値だけを落とす（ほかの値は保つ）
AssertionError: expected { theme: 'nord', auto: false, …(2) } to deeply equal { theme: 'nord', auto: false, …(2) }
 FAIL  src/theme/themes.test.ts > loadThemePrefs（AC4：値ごとに落とす） > 壊れた「明るいとき」は dracula ではなく対の既定（null）に落ち、解決すると 1 つのテーマの対になる
AssertionError: expected 'dracula' to be null
$ # 元に戻した: cmp packages/web/src/theme/themes.ts → 一致

$ # 変異: 保存した themeAuto の「切」を「入」として読む
$ git diff（変異）
--- a/packages/web/src/theme/themes.ts
+++ b/packages/web/src/theme/themes.ts
@@ -77 +77 @@
-    auto: typeof raw["themeAuto"] === "boolean" ? raw["themeAuto"] : false,
+    auto: typeof raw["themeAuto"] === "boolean",
$ pnpm -C packages/web exec vitest run src/theme/themes.test.ts  # exit 1
     × 保存した「切」はそのまま切として読む（入に戻さない） 7ms
 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/themes.test.ts > loadThemePrefs（AC4：値ごとに落とす） > 保存した「切」はそのまま切として読む（入に戻さない）
AssertionError: expected true to be false // Object.is equality
$ # 元に戻した: cmp packages/web/src/theme/themes.ts → 一致
```

### T9（画面の枠の色。薄めた文字・App.vue との一致）

```
$ # 変異: uiTokens の組み立てから alpha = 0.7 を外す（不透明で寄せる）
$ git diff（変異）
--- a/packages/web/src/theme/uiTokens.ts
+++ b/packages/web/src/theme/uiTokens.ts
@@ -306 +305,0 @@
-      MUTED_TEXT_ALPHA,
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 10ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色 1ms
     × 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から） 13ms
 Test Files  1 failed (1)
      Tests  11 failed | 132 passed (143)
⎯⎯⎯⎯⎯⎯ Failed Tests 11 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > uiTokens(catppuccin-latte) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 2.9066606192693847 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(tokyo-night-day) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 2.729385952904319 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(gruvbox-light) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 3.9103954616257663 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-dark) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 3.3555729447398566 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-light) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 4.039327295230605 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 2.9774350399916796 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized-light) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 2.6779248392313915 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized-light) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 4.108485176187855 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(kanagawa-lotus) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 2.8334396103202524 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(rose-pine-dawn) > 文字は 0.7 に薄めても、背景・枠・hover・選択の行・淡い面の上で 4.5 以上。枠の文字も同じ色
AssertionError: expected 3.5037900536536903 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > 組み立ての規則（design の表） > 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から）
AssertionError: expected { '--wtm-bg': '#e5e7eb', …(17) } to deeply equal { '--wtm-bg': '#e5e7eb', …(17) }
$ # 元に戻した: cmp packages/web/src/theme/uiTokens.ts → 一致

$ # 変異: App.vue の :root の値を 1 つ変える（hover）
$ git diff（変異）
--- a/packages/web/src/App.vue
+++ b/packages/web/src/App.vue
@@ -98 +98 @@
-  --wtm-menu-hover-bg: #343746;
+  --wtm-menu-hover-bg: #353746;
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × App.vue の :root（JS が走る前の既定）は uiTokens("dracula") の写し 13ms
 Test Files  1 failed (1)
      Tests  1 failed | 142 passed (143)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > dracula は今の見た目 > App.vue の :root（JS が走る前の既定）は uiTokens("dracula") の写し
AssertionError: expected { 'color-scheme': 'dark', …(18) } to deeply equal { '--wtm-bg': '#1e1f29', …(18) }
$ # 元に戻した: cmp packages/web/src/App.vue → 一致
```

### T10（再接続の幕・goto の補足の透明度。decisions D2・D9）

```
$ # 変異: 明るいテーマの強い幕を黒のまま（全テーマ同じ値）に戻す
$ git diff（変異）
--- a/packages/web/src/theme/uiTokens.ts
+++ b/packages/web/src/theme/uiTokens.ts
@@ -342 +342 @@
-      "--wtm-backdrop-strong": dark ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.6)",
+      "--wtm-backdrop-strong": "rgba(0, 0, 0, 0.5)",
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 6ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9） 1ms
     × 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から） 8ms
 Test Files  1 failed (1)
      Tests  8 failed | 135 passed (143)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > uiTokens(catppuccin-latte) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.7251211087556095 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(tokyo-night-day) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.6403272260488495 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(gruvbox-light) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.6321856129562993 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-light) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.577794365314392 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized-light) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.606647444886116 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(kanagawa-lotus) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.5769161254495754 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(rose-pine-dawn) > 再接続の表示の文字（強い幕の上に直に描き、0.85 に薄める）は、幕を重ねた端末の背景・背景の上で 4.5 以上（decisions D9）
AssertionError: expected 2.558321964245665 to be greater than or equal to 4.5
 FAIL  src/theme/uiTokens.test.ts > 組み立ての規則（design の表） > 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から）
AssertionError: expected { '--wtm-bg': '#e5e7eb', …(17) } to deeply equal { '--wtm-bg': '#e5e7eb', …(17) }
$ # 元に戻した: cmp packages/web/src/theme/uiTokens.ts → 一致

$ # 変異: goto の補足の透明度を 0.6 に戻す
$ git diff（変異）
--- a/packages/web/src/components/GotoPicker.vue
+++ b/packages/web/src/components/GotoPicker.vue
@@ -396 +396 @@
-  opacity: 0.7;
+  opacity: 0.6;
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 無効な部品・未対応の行・状態の丸を除き、opacity は MUTED_TEXT_ALPHA 以上 16ms
 Test Files  1 failed (1)
      Tests  1 failed | 142 passed (143)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > 部品の CSS の透明度 > 無効な部品・未対応の行・状態の丸を除き、opacity は MUTED_TEXT_ALPHA 以上
AssertionError: expected [ Array(1) ] to deeply equal []
$ # 元に戻した: cmp packages/web/src/components/GotoPicker.vue → 一致
```

### T11（設定の store）

```
$ # 変異: setTheme が自動の切替を切らない
$ git diff（変異）
--- a/packages/web/src/store/settings.ts
+++ b/packages/web/src/store/settings.ts
@@ -119,2 +119 @@
-    themeAuto.value = false;
-    writePrefs({ theme: v, themeAuto: false });
+    writePrefs({ theme: v });
$ pnpm -C packages/web exec vitest run src/store/settings.test.ts  # exit 1
     × 1 つのテーマを選ぶと反映・保存され、自動の切替が入っていたら切る（AC7） 14ms
 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/store/settings.test.ts > useSettingsStore — テーマ（20260921-theme-settings） > 1 つのテーマを選ぶと反映・保存され、自動の切替が入っていたら切る（AC7）
AssertionError: expected true to be false // Object.is equality
$ # 元に戻した: cmp packages/web/src/store/settings.ts → 一致

$ # 変異: setThemeAuto が保存しない
$ git diff（変異）
--- a/packages/web/src/store/settings.ts
+++ b/packages/web/src/store/settings.ts
@@ -126 +125,0 @@
-    writePrefs({ themeAuto: v });
$ pnpm -C packages/web exec vitest run src/store/settings.test.ts  # exit 1
     × 自動の切替が入っていれば、OS の明暗（systemDark）でいま使うテーマが替わる。切ると 1 つのテーマに戻る（AC5・AC7） 10ms
     × 明るいとき・暗いときを選ぶと保存され、null を入れると対の既定に戻り、1 つのテーマの変更に追従する（AC6） 6ms
 Test Files  1 failed (1)
      Tests  2 failed | 21 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/store/settings.test.ts > useSettingsStore — テーマ（20260921-theme-settings） > 自動の切替が入っていれば、OS の明暗（systemDark）でいま使うテーマが替わる。切ると 1 つのテーマに戻る（AC5・AC7）
AssertionError: expected false to be true // Object.is equality
 FAIL  src/store/settings.test.ts > useSettingsStore — テーマ（20260921-theme-settings） > 明るいとき・暗いときを選ぶと保存され、null を入れると対の既定に戻り、1 つのテーマの変更に追従する（AC6）
AssertionError: expected 'kanagawa' to be 'kanagawa-lotus' // Object.is equality
$ # 元に戻した: cmp packages/web/src/store/settings.ts → 一致

$ # 変異: setThemeDark が保存しない
$ git diff（変異）
--- a/packages/web/src/store/settings.ts
+++ b/packages/web/src/store/settings.ts
@@ -138 +137,0 @@
-    writePrefs({ themeDark: v });
$ pnpm -C packages/web exec vitest run src/store/settings.test.ts  # exit 1
     × 明るいとき・暗いときを選ぶと保存され、null を入れると対の既定に戻り、1 つのテーマの変更に追従する（AC6） 15ms
 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/store/settings.test.ts > useSettingsStore — テーマ（20260921-theme-settings） > 明るいとき・暗いときを選ぶと保存され、null を入れると対の既定に戻り、1 つのテーマの変更に追従する（AC6）
AssertionError: expected undefined to be 'vesper' // Object.is equality
$ # 元に戻した: cmp packages/web/src/store/settings.ts → 一致
```

### T12（端末の入れ替え）

```
$ # 変異: setTheme が表示中の端末だけを替える（隠れた端末を替え損ねる）
$ git diff（変異）
--- a/packages/web/src/term/TerminalRegistry.ts
+++ b/packages/web/src/term/TerminalRegistry.ts
@@ -111 +111 @@
-    for (const entry of this.entries.values()) entry.term.options.theme = theme;
+    for (const id of this.visible) { const e = this.entries.get(id); if (e) e.term.options.theme = theme; }
$ pnpm -C packages/web exec vitest run src/term/TerminalRegistry.test.ts  # exit 1
       × setTheme は隠れている端末も含めて options.theme だけを替え、端末を作り直さず中身を保つ。dracula に戻すと選択の色は既定に戻る 67ms
 Test Files  1 failed (1)
      Tests  1 failed | 26 passed (27)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/TerminalRegistry.test.ts > TerminalRegistry > テーマ > setTheme は隠れている端末も含めて options.theme だけを替え、端末を作り直さず中身を保つ。dracula に戻すと選択の色は既定に戻る
AssertionError: expected { foreground: '#f8f8f2', …(18) } to match object { background: '#2e3440' }
$ # 元に戻した: cmp packages/web/src/term/TerminalRegistry.ts → 一致

$ # 変異: setTheme が前の配色と混ぜる（dracula に戻しても前のテーマの選択の色が残る）
$ git diff（変異）
--- a/packages/web/src/term/TerminalRegistry.ts
+++ b/packages/web/src/term/TerminalRegistry.ts
@@ -111 +111 @@
-    for (const entry of this.entries.values()) entry.term.options.theme = theme;
+    for (const entry of this.entries.values()) entry.term.options.theme = { ...entry.term.options.theme, ...theme };
$ pnpm -C packages/web exec vitest run src/term/TerminalRegistry.test.ts  # exit 1
       × setTheme は隠れている端末も含めて options.theme だけを替え、端末を作り直さず中身を保つ。dracula に戻すと選択の色は既定に戻る 68ms
 Test Files  1 failed (1)
      Tests  1 failed | 26 passed (27)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/TerminalRegistry.test.ts > TerminalRegistry > テーマ > setTheme は隠れている端末も含めて options.theme だけを替え、端末を作り直さず中身を保つ。dracula に戻すと選択の色は既定に戻る
AssertionError: expected { foreground: '#f8f8f2', …(21) } to not have property "selectionBackground"
$ # 元に戻した: cmp packages/web/src/term/TerminalRegistry.ts → 一致

$ # 変異: setTheme の前に中身を消す（reset）
$ git diff（変異）
--- a/packages/web/src/term/TerminalRegistry.ts
+++ b/packages/web/src/term/TerminalRegistry.ts
@@ -111 +111 @@
-    for (const entry of this.entries.values()) entry.term.options.theme = theme;
+    for (const entry of this.entries.values()) { entry.term.reset(); entry.term.options.theme = theme; }
$ pnpm -C packages/web exec vitest run src/term/TerminalRegistry.test.ts  # exit 1
       × setTheme は隠れている端末も含めて options.theme だけを替え、端末を作り直さず中身を保つ。dracula に戻すと選択の色は既定に戻る 63ms
 Test Files  1 failed (1)
      Tests  1 failed | 26 passed (27)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/TerminalRegistry.test.ts > TerminalRegistry > テーマ > setTheme は隠れている端末も含めて options.theme だけを替え、端末を作り直さず中身を保つ。dracula に戻すと選択の色は既定に戻る
AssertionError: expected '' to be 'keep-this' // Object.is equality
$ # 元に戻した: cmp packages/web/src/term/TerminalRegistry.ts → 一致
```

### T12 の点検の後（カーソルの下の文字。decisions D10）

```
$ # 変異: 規則 (c) を外す（カーソルの下の文字を渡さない）
$ git diff（変異）
--- a/packages/protocol/src/theme.ts
+++ b/packages/protocol/src/theme.ts
@@ -324 +323,0 @@
-  if (p.cursorAccent === undefined) out.cursorAccent = p.background;
$ pnpm -C packages/protocol exec vitest run src/theme.test.ts  # exit 1
     × 規則 (c)：dracula 以外は、ブロックカーソルの下の文字が背景色で、カーソルとの比が 3 以上（decisions D10） 18ms
 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme.test.ts > TERMINAL_PALETTES > 規則 (c)：dracula 以外は、ブロックカーソルの下の文字が背景色で、カーソルとの比が 3 以上（decisions D10）
AssertionError: catppuccin: expected undefined to be '#1e1e2e' // Object.is equality
$ # 元に戻した: cmp packages/protocol/src/theme.ts → 一致
```

### T13（ThemeController）

```
$ # 変異: start() の 1 回目を省略する（applied を空にしない・初期値を dracula にする）
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -47 +47 @@
-  private applied: ThemeName | null = null;
+  private applied: ThemeName | null = "dracula";
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × resend は直前に当てた名前を送り直す。start の前は何もしない 9ms
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > resend・控えの書き込みの失敗 > resend は直前に当てた名前を送り直す。start の前は何もしない
AssertionError: expected [ 'dracula' ] to deeply equal []
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致

$ # 変異: start() の 1 回目を省略する（applied を空にしない）
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -59 +58,0 @@
-    this.applied = null; // 1 回目は省略しない（start の前に apply が呼ばれていても・stop の後に start し直しても）
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × start の前に apply が呼ばれていても、start は同じ名前でも当て直す 11ms
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > start の前に apply が呼ばれていても、start は同じ名前でも当て直す
AssertionError: expected '' to be '#282a36' // Object.is equality
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致

$ # 変異: OS の明暗の変化でも控えを書く
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -73 +73,4 @@
-      (name) => this.apply(name),
+      (name) => {
+        this.apply(name);
+        this.writeBoot();
+      },
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × OS の明暗が変わると当て直し（AC5）、控えは書き直さない（中身が変わらない） 14ms
     × 自動の切替が入っていて既定の対のまま 1 つのテーマを選んでも、途中の状態のテーマを当てたり送ったりしない（1 回だけ） 3ms
 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > OS の明暗が変わると当て直し（AC5）、控えは書き直さない（中身が変わらない）
AssertionError: expected 2 to be 1 // Object.is equality
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > 自動の切替が入っていて既定の対のまま 1 つのテーマを選んでも、途中の状態のテーマを当てたり送ったりしない（1 回だけ）
AssertionError: expected 3 to be 2 // Object.is equality
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致

$ # 変異: 同期で追う（途中の状態のテーマを当てる）
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -73,0 +74 @@
+      { flush: "sync" },
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × 自動の切替が入っていて既定の対のまま 1 つのテーマを選んでも、途中の状態のテーマを当てたり送ったりしない（1 回だけ） 11ms
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > 自動の切替が入っていて既定の対のまま 1 つのテーマを選んでも、途中の状態のテーマを当てたり送ったりしない（1 回だけ）
AssertionError: expected [ 'dracula', 'catppuccin', …(1) ] to deeply equal [ 'dracula', 'catppuccin-latte' ]
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致

$ # 変異: 控えを書く条件から themeAuto を外す
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -78 +77,0 @@
-        () => settings.themeAuto,
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × 設定を変えると当て直し、控えを書き直す。いま使うテーマが変わらなくても（暗いときに「明るいとき」を変えた）控えは書き直す 14ms
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > 設定を変えると当て直し、控えを書き直す。いま使うテーマが変わらなくても（暗いときに「明るいとき」を変えた）控えは書き直す
AssertionError: expected false to be true // Object.is equality
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致

$ # 変異: 控えの dark の組を light で書く
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -118 +118 @@
-      dark: bootVars(ld.dark),
+      dark: bootVars(ld.light),
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × 「暗いとき」を変えると控えの dark の組を書き直す。最初の控えは固定・明るいとき・暗いときを 1 つのテーマの対で持つ 28ms
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > 「暗いとき」を変えると控えの dark の組を書き直す。最初の控えは固定・明るいとき・暗いときを 1 つのテーマの対で持つ
AssertionError: expected { auto: false, fixed: { …(2) }, …(2) } to deeply equal { auto: false, fixed: { …(2) }, …(2) }
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致
```

### T14（theme-boot.js）

```
$ # 変異: 明暗の選び方を変える（暗いときに明るい組）
$ git diff（変異）
--- a/packages/web/public/theme-boot.js
+++ b/packages/web/public/theme-boot.js
@@ -18 +18 @@
-    var chosen = cache.auto === true ? (dark ? cache.dark : cache.light) : cache.fixed;
+    var chosen = cache.auto === true ? (dark ? cache.light : cache.dark) : cache.fixed;
$ pnpm -C packages/web exec vitest run src/theme/themeBoot.test.ts  # exit 1
     × tokyo-night・自動 入・OS が暗い 17ms
     × tokyo-night・自動 入・OS が明るい 7ms
     × nord・自動 入・OS が暗い 6ms
     × nord・自動 入・OS が明るい 4ms
     × vesper・自動 入・OS が暗い 6ms
     × vesper・自動 入・OS が明るい 5ms
     × matchMedia が無ければ暗い扱い（本体の store の systemDark の既定と同じ） 4ms
 Test Files  1 failed (1)
      Tests  7 failed | 12 passed (19)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > tokyo-night・自動 入・OS が暗い
AssertionError: expected { '--wtm-bg': '#d8d9de', …(17) } to deeply equal { '--wtm-bg': '#14141d', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > tokyo-night・自動 入・OS が明るい
AssertionError: expected { '--wtm-bg': '#14141d', …(17) } to deeply equal { '--wtm-bg': '#d8d9de', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > nord・自動 入・OS が暗い
AssertionError: expected { '--wtm-bg': '#e5e7eb', …(17) } to deeply equal { '--wtm-bg': '#232730', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > nord・自動 入・OS が明るい
AssertionError: expected { '--wtm-bg': '#232730', …(17) } to deeply equal { '--wtm-bg': '#e5e7eb', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > vesper・自動 入・OS が暗い
AssertionError: expected { '--wtm-bg': '#1e1f29', …(17) } to deeply equal { '--wtm-bg': '#f3ecda', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > vesper・自動 入・OS が明るい
AssertionError: expected { '--wtm-bg': '#f3ecda', …(17) } to deeply equal { '--wtm-bg': '#1e1f29', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > matchMedia が無ければ暗い扱い（本体の store の systemDark の既定と同じ）
AssertionError: expected { '--wtm-bg': '#e5e7eb', …(17) } to deeply equal { '--wtm-bg': '#12121c', …(17) }
$ # 元に戻した: cmp packages/web/public/theme-boot.js → 一致

$ # 変異: matchMedia が無いときを明るい扱いにする
$ git diff（変異）
--- a/packages/web/public/theme-boot.js
+++ b/packages/web/public/theme-boot.js
@@ -17 +17 @@
-      typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : true;
+      typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : false;
$ pnpm -C packages/web exec vitest run src/theme/themeBoot.test.ts  # exit 1
     × matchMedia が無ければ暗い扱い（本体の store の systemDark の既定と同じ） 31ms
 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > matchMedia が無ければ暗い扱い（本体の store の systemDark の既定と同じ）
AssertionError: expected { '--wtm-bg': '#e5e7eb', …(17) } to deeply equal { '--wtm-bg': '#12121c', …(17) }
$ # 元に戻した: cmp packages/web/public/theme-boot.js → 一致

$ # 変異: 問い合わせを light に変える
$ git diff（変異）
--- a/packages/web/public/theme-boot.js
+++ b/packages/web/public/theme-boot.js
@@ -17 +17 @@
-      typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : true;
+      typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)").matches : true;
$ pnpm -C packages/web exec vitest run src/theme/themeBoot.test.ts  # exit 1
     × dracula・自動 切・OS が暗い 19ms
     × dracula・自動 切・OS が明るい 3ms
     × gruvbox-light・自動 切・OS が暗い 4ms
     × gruvbox-light・自動 切・OS が明るい 2ms
     × tokyo-night・自動 入・OS が暗い 4ms
     × tokyo-night・自動 入・OS が明るい 4ms
     × nord・自動 入・OS が暗い 2ms
     × nord・自動 入・OS が明るい 2ms
     × vesper・自動 入・OS が暗い 3ms
     × vesper・自動 入・OS が明るい 2ms
     × 17 のテーマすべての固定の控えを当てられる 2ms
     × --wtm- で始まらない名前・文字列でない値は当てない 1ms
 Test Files  1 failed (1)
      Tests  12 failed | 7 passed (19)
⎯⎯⎯⎯⎯⎯ Failed Tests 12 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > dracula・自動 切・OS が暗い
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > dracula・自動 切・OS が明るい
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > vesper・自動 入・OS が明るい
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#1e1f29', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > gruvbox-light・自動 切・OS が暗い
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > gruvbox-light・自動 切・OS が明るい
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#f1e7bf', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > tokyo-night・自動 入・OS が暗い
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#14141d', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > tokyo-night・自動 入・OS が明るい
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#d8d9de', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > nord・自動 入・OS が暗い
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#232730', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > nord・自動 入・OS が明るい
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#e5e7eb', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > vesper・自動 入・OS が暗い
AssertionError: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#f3ecda', …(17) }
 FAIL  src/theme/themeBoot.test.ts > theme-boot.js は本体と同じ組を選ぶ（design D5） > 17 のテーマすべての固定の控えを当てられる
AssertionError: catppuccin: expected { '--wtm-bg': '', …(17) } to deeply equal { '--wtm-bg': '#12121c', …(17) }
 FAIL  src/theme/themeBoot.test.ts > 控えが無い・壊れているときは何もしない（起動できなくならない） > --wtm- で始まらない名前・文字列でない値は当てない
AssertionError: expected '' to be '#101010' // Object.is equality
$ # 元に戻した: cmp packages/web/public/theme-boot.js → 一致
```

### cross の点検の後（作る前の操作の時刻・接続しただけの人。decisions D13）

```
$ # 変異: tab.create の受け口が作る前に操作の時刻を進めない
$ git diff（変異）
--- a/packages/server/src/surface/methods/tab.ts
+++ b/packages/server/src/surface/methods/tab.ts
@@ -10 +9,0 @@
-      deps.clients.touch(ctx.clientId);
$ pnpm -C packages/server exec vitest run src/surface/methods/index.test.ts  # exit 1
     × 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13） 12ms
 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13）
AssertionError: tab.create: expected { foreground: '#ffffff', …(5) } to be { foreground: '#4c4f69', …(5) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/surface/methods/tab.ts → 一致

$ # 変異: pane.split の受け口が作る前に操作の時刻を進めない
$ git diff（変異）
--- a/packages/server/src/surface/methods/pane.ts
+++ b/packages/server/src/surface/methods/pane.ts
@@ -19 +18,0 @@
-      deps.clients.touch(ctx.clientId); // 起動の猶予より前に（色の問い合わせの答え。20260921-theme-settings の decisions D13）
$ pnpm -C packages/server exec vitest run src/surface/methods/index.test.ts  # exit 1
     × 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13） 22ms
 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/surface/methods/index.test.ts > registerAllMethods — client / workspace / tab / pane flow > 作る方式（tab・workspace・分割）は、作る前に作った人の操作の時刻を進める——起動の猶予の間の色の問い合わせにも作った人の配色で答える（20260921-theme-settings の decisions D13）
AssertionError: pane.split: expected { foreground: '#ffffff', …(5) } to be { foreground: '#4c4f69', …(5) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/surface/methods/pane.ts → 一致

$ # 変異: 答えに接続の時刻から始まる lastInteractionAt を使う
$ git diff（変異）
--- a/packages/server/src/clients/answerPalette.ts
+++ b/packages/server/src/clients/answerPalette.ts
@@ -51 +51 @@
-    if (!latest || c.lastActedAt > latest.lastActedAt) latest = c;
+    if (!latest || c.lastInteractionAt > latest.lastInteractionAt) latest = c;
$ pnpm -C packages/server exec vitest run src/clients/answerPalette.test.ts  # exit 1
     × 2. 一度も操作していない後から来た人（接続の時刻だけが新しい）は、操作した人に勝たない（decisions D13） 8ms
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/clients/answerPalette.test.ts > answerPaletteFor（design D6 の順） > 2. 一度も操作していない後から来た人（接続の時刻だけが新しい）は、操作した人に勝たない（decisions D13）
AssertionError: expected { foreground: '#ffffff', …(5) } to be { foreground: '#d8dee9', …(6) } // Object.is equality
$ # 元に戻した: cmp packages/server/src/clients/answerPalette.ts → 一致
```

### T18（E2E が結線と控えを守る。web をビルドし直して走らせた）

```
$ # 変異: 接続ごとにテーマを送り直さない（resend の登録を外す）
$ git diff（変異）
--- a/packages/web/src/main.ts
+++ b/packages/web/src/main.ts
@@ -177 +176,0 @@
-connection.onOpened(() => themeController.resend());
$ pnpm -C packages/web run build  # exit 0
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts -g 色の問い合わせには --reporter=line  # exit 1
Running 1 test using 1 worker
src/specs/theme-settings.spec.ts:331:1 › 色の問い合わせには、その tab の大きさを決めている——操作している——ブラウザのテーマの色で答える。開いた直後から（AC8）
{"ts":"2026-09-21T12:43:09.655Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  1) src/specs/theme-settings.spec.ts:331:1 › 色の問い合わせには、その tab の大きさを決めている——操作している——ブラウザのテーマの色で答える。開いた直後から（AC8） 
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: "rgb:fbfb/f1f1/c7c7"
    Received: "rgb:2828/2a2a/3636"
      338 |   const a = await openBrowser(browser, appServer, { prefs: { theme: "gruvbox-light" } });
      339 |   const paneId = a.shown()[0]!;
    > 340 |   expect(await askBackground(a, paneId, script, "1")).toBe(xtermRgb(TERMINAL_PALETTES["gruvbox-light"].background));
          |                                                       ^
      341 |
      342 |   // もう 1 つのブラウザ（vesper）が同じ pane を見ているだけなら、答えは操作している a のまま。
      343 |   const b = await openBrowser(browser, appServer, { prefs: { theme: "vesper" } });
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:340:55
    Error Context: test-results/theme-settings-色の問い合わせには、そ-1cbfc-ブラウザのテーマの色で答える。開いた直後から（AC8）/error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/theme-settings-色の問い合わせには、そ-1cbfc-ブラウザのテーマの色で答える。開いた直後から（AC8）/trace.zip
    Usage:
        pnpm exec playwright show-trace test-results/theme-settings-色の問い合わせには、そ-1cbfc-ブラウザのテーマの色で答える。開いた直後から（AC8）/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
  1 failed
    src/specs/theme-settings.spec.ts:331:1 › 色の問い合わせには、その tab の大きさを決めている——操作している——ブラウザのテーマの色で答える。開いた直後から（AC8） 
$ # 元に戻した: cmp packages/web/src/main.ts → 一致

$ # 変異: 作る端末にいまのテーマを渡さない（getTheme を外す）
$ git diff（変異）
--- a/packages/web/src/main.ts
+++ b/packages/web/src/main.ts
@@ -147 +146,0 @@
-  getTheme: () => toXtermTheme(TERMINAL_PALETTES[settings.effectiveTheme]),
$ pnpm -C packages/web run build  # exit 0
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts -g 選んだテーマはこのブラウザに残り --reporter=line  # exit 1
Running 1 test using 1 worker
src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4）
{"ts":"2026-09-21T12:43:37.759Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  1) src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4） 
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 1
    + Received  + 1
      Array [
    -   "rgb(239, 241, 245)",
    +   "rgb(40, 42, 54)",
      ]
    Call Log:
    - Timeout 5000ms exceeded while waiting on the predicate
      151 | /** 全ての端末の背景が、そのテーマの端末の背景になるまで待つ。 */
      152 | async function expectTerminals(page: Page, name: ThemeName, count: number): Promise<void> {
    > 153 |   await expect.poll(() => terminalBgs(page)).toEqual(Array(count).fill(hexToRgb(TERMINAL_PALETTES[name].background)));
          |                                              ^
      154 | }
      155 |
      156 | /**
        at expectTerminals (/workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:153:46)
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:259:9
    Error Context: test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/trace.zip
    Usage:
        pnpm exec playwright show-trace test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
  1 failed
    src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4） 
$ # 元に戻した: cmp packages/web/src/main.ts → 一致

$ # 変異: 控えを書かない（storage を null にする）
$ git diff（変異）
--- a/packages/web/src/main.ts
+++ b/packages/web/src/main.ts
@@ -163 +163 @@
-      return window.localStorage; // 取得そのものが投げる環境がある（サンドボックスの iframe 等）
+      return null; // 変異
$ pnpm -C packages/web run build  # exit 0
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts -g 選んだテーマはこのブラウザに残り --reporter=line  # exit 1
Running 1 test using 1 worker
src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4）
{"ts":"2026-09-21T12:44:49.670Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  1) src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4） 
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 2
    + Received  + 2
      Object {
    -   "colorScheme": "light",
    -   "menuBg": "#eff1f5",
    +   "colorScheme": "",
    +   "menuBg": "",
      }
      255 |   expect(await sidebarBg(o.page)).toBe(hexToRgb(MENU_BG["catppuccin-latte"]!));
      256 |   await reloadAndWait(o);
    > 257 |   expect(await firstPaint(o.page)).toEqual({ menuBg: MENU_BG["catppuccin-latte"], colorScheme: "light" });
          |                                    ^
      258 |   expect(await sidebarBg(o.page)).toBe(hexToRgb(MENU_BG["catppuccin-latte"]!));
      259 |   await expectTerminals(o.page, "catppuccin-latte", 1);
      260 |   await focusTerminal(o.page);
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:257:36
    Error Context: test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/trace.zip
    Usage:
        pnpm exec playwright show-trace test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
  1 failed
    src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4） 
$ # 元に戻した: cmp packages/web/src/main.ts → 一致

$ # 変異: 控えを常に固定の組で当てる（自動の切替を見ない）
$ git diff（変異）
--- a/packages/web/public/theme-boot.js
+++ b/packages/web/public/theme-boot.js
@@ -18 +18 @@
-    var chosen = cache.auto === true ? (dark ? cache.dark : cache.light) : cache.fixed;
+    var chosen = cache.fixed;
$ pnpm -C packages/web run build  # exit 0
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts -g OS の明暗に合わせる --reporter=line  # exit 1
Running 1 test using 1 worker
src/specs/theme-settings.spec.ts:273:1 › OS の明暗に合わせる：OS を切り替えると再読み込み無しで追従し、開き直しの最初の描画もそのときの OS に合ったほう（AC5・AC3・AC7）
{"ts":"2026-09-21T12:45:42.516Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  1) src/specs/theme-settings.spec.ts:273:1 › OS の明暗に合わせる：OS を切り替えると再読み込み無しで追従し、開き直しの最初の描画もそのときの OS に合ったほう（AC5・AC3・AC7） 
    Test timeout of 30000ms exceeded.
    Error: OS を明るくして開き直すと、控えの明るい側
    expect(received).toEqual(expected) // deep equality
    - Expected  - 2
    + Received  + 2
      Object {
    -   "colorScheme": "light",
    -   "menuBg": "#eff1f5",
    +   "colorScheme": "dark",
    +   "menuBg": "#181825",
      }
      293 |   await o.page.emulateMedia({ colorScheme: "light" });
      294 |   await reloadAndWait(o);
    > 295 |   expect(await firstPaint(o.page), "OS を明るくして開き直すと、控えの明るい側").toEqual({ menuBg: MENU_BG["catppuccin-latte"], colorScheme: "light" });
          |                                                              ^
      296 |   await o.context.close();
      297 | });
      298 |
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:295:62
    Error Context: test-results/theme-settings-OS-の明暗に合わせる-8a73e-のときの-OS-に合ったほう（AC5・AC3・AC7）/error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/theme-settings-OS-の明暗に合わせる-8a73e-のときの-OS-に合ったほう（AC5・AC3・AC7）/trace.zip
    Usage:
        pnpm exec playwright show-trace test-results/theme-settings-OS-の明暗に合わせる-8a73e-のときの-OS-に合ったほう（AC5・AC3・AC7）/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
  1 failed
    src/specs/theme-settings.spec.ts:273:1 › OS の明暗に合わせる：OS を切り替えると再読み込み無しで追従し、開き直しの最初の描画もそのときの OS に合ったほう（AC5・AC3・AC7） 
$ # 元に戻した: cmp packages/web/public/theme-boot.js → 一致

$ # 変異: 控えを常に OS の明暗で選ぶ（固定を見ない）
$ git diff（変異）
--- a/packages/web/public/theme-boot.js
+++ b/packages/web/public/theme-boot.js
@@ -18 +18 @@
-    var chosen = cache.auto === true ? (dark ? cache.dark : cache.light) : cache.fixed;
+    var chosen = (dark ? cache.dark : cache.light);
$ pnpm -C packages/web run build  # exit 0
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts -g 選んだテーマはこのブラウザに残り --reporter=line  # exit 1
Running 1 test using 1 worker
src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4）
{"ts":"2026-09-21T12:48:07.516Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  1) src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4） 
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 2
    + Received  + 2
      Object {
    -   "colorScheme": "light",
    -   "menuBg": "#eff1f5",
    +   "colorScheme": "dark",
    +   "menuBg": "#181825",
      }
      255 |   expect(await sidebarBg(o.page)).toBe(hexToRgb(MENU_BG["catppuccin-latte"]!));
      256 |   await reloadAndWait(o);
    > 257 |   expect(await firstPaint(o.page)).toEqual({ menuBg: MENU_BG["catppuccin-latte"], colorScheme: "light" });
          |                                    ^
      258 |   expect(await sidebarBg(o.page)).toBe(hexToRgb(MENU_BG["catppuccin-latte"]!));
      259 |   await expectTerminals(o.page, "catppuccin-latte", 1);
      260 |   await focusTerminal(o.page);
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:257:36
    Error Context: test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/trace.zip
    Usage:
        pnpm exec playwright show-trace test-results/theme-settings-選んだテーマはこのブラ-fabff-そのテーマ。別のブラウザは既定のまま（AC3・AC4）/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
  1 failed
    src/specs/theme-settings.spec.ts:248:1 › 選んだテーマはこのブラウザに残り、開き直すと本体が走る前から出る。開き直した後に作る端末もそのテーマ。別のブラウザは既定のまま（AC3・AC4） 
$ # 元に戻した: cmp packages/web/public/theme-boot.js → 一致
```

### review ラウンド 1 の差し戻しの後（選ばれている pane の枠・選択の面・控えを保存された設定から作る。decisions D15）

```
$ # 変異: 選択の面を herdr の surface0 のまま（寄せない）に戻す
$ git diff（変異）
--- a/packages/web/src/theme/uiTokens.ts
+++ b/packages/web/src/theme/uiTokens.ts
@@ -301 +301 @@
-  const active = ensureContrast(p.surface0, [menuBg], MIN_SELECTED_SURFACE_RATIO, away);
+  const active = p.surface0;
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 5ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 1ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15） 0ms
     × 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から） 8ms
 Test Files  1 failed (1)
      Tests  17 failed | 160 passed (177)
⎯⎯⎯⎯⎯⎯ Failed Tests 17 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > uiTokens(catppuccin) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.3963360701234395 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(catppuccin-latte) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.3652759947338589 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(tokyo-night) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.1733562283160668 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(tokyo-night-day) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.2862396143099692 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(nord) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.2412803583883023 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(gruvbox) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.271478954329648 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(gruvbox-light) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.2090917374221757 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-dark) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.071619082170599 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-light) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.0911209986849775 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.1548100448447831 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized-light) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.13589871628495 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(kanagawa) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.1555805724311892 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(kanagawa-lotus) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.2361634936006725 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(rose-pine) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.0707018199452158 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(rose-pine-dawn) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.0975949529306095 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > uiTokens(vesper) > 選択の面（表示中の tab・行・選んだ項目）は、枠の背景から 1.5 以上離れる（review ラウンド 1。decisions D15）
AssertionError: expected 1.1073689992440297 to be greater than or equal to 1.5
 FAIL  src/theme/uiTokens.test.ts > 組み立ての規則（design の表） > 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から）
AssertionError: expected { '--wtm-bg': '#12121c', …(18) } to deeply equal { '--wtm-bg': '#12121c', …(18) }
$ # 元に戻した: cmp packages/web/src/theme/uiTokens.ts → 一致

$ # 変異: 選ばれている pane の枠を surface0 のまま（寄せない）に戻す
$ git diff（変異）
--- a/packages/web/src/theme/uiTokens.ts
+++ b/packages/web/src/theme/uiTokens.ts
@@ -352 +352 @@
-      "--wtm-pane-current": ensureContrast(p.surface0, [bg, terminalBg], 3, away),
+      "--wtm-pane-current": p.surface0,
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 5ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 1ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 1ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 1ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15） 0ms
     × 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から） 6ms
 Test Files  1 failed (1)
      Tests  17 failed | 160 passed (177)
⎯⎯⎯⎯⎯⎯ Failed Tests 17 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > uiTokens(catppuccin) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.304554633141532 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(catppuccin-latte) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.2469733706997341 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(tokyo-night) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.1733562283160668 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(tokyo-night-day) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.1805255371521064 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(nord) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.2412803583883023 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(gruvbox) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.271478954329648 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(gruvbox-light) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.1054961964832768 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-dark) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.178378511983521 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(one-light) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.0006468985453558 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.1548100448447831 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(solarized-light) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.0398285097744282 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(kanagawa) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.1555805724311892 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(kanagawa-lotus) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.13571905887988 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(rose-pine) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.0707018199452158 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(rose-pine-dawn) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.0043500133324699 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > uiTokens(vesper) > 選ばれている pane の枠は、周りの背景と端末の背景に対して 3 以上（dracula は今の #44475a のまま。decisions D15）
AssertionError: expected 1.1721536090956024 to be greater than or equal to 3
 FAIL  src/theme/uiTokens.test.ts > 組み立ての規則（design の表） > 暗いテーマ・明るいテーマの 1 つずつを値で固定する（herdr の値から寄せた結果。警告は peach・idle は overlay1 から）
AssertionError: expected { '--wtm-bg': '#12121c', …(18) } to deeply equal { '--wtm-bg': '#12121c', …(18) }
$ # 元に戻した: cmp packages/web/src/theme/uiTokens.ts → 一致

$ # 変異: PaneFrame が選ばれている pane の枠に以前の変数を使う
$ git diff（変異）
--- a/packages/web/src/components/PaneFrame.vue
+++ b/packages/web/src/components/PaneFrame.vue
@@ -147 +147 @@
-  border: 2px solid var(--wtm-pane-current, #44475a);
+  border: 2px solid var(--wtm-menu-border, #44475a);
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 0
 Test Files  1 passed (1)
      Tests  177 passed (177)
$ # 元に戻した: cmp packages/web/src/components/PaneFrame.vue → 一致

$ # 変異: 控えを このタブの store から作る（保存された設定を読まない）
$ git diff（変異）
--- a/packages/web/src/theme/ThemeController.ts
+++ b/packages/web/src/theme/ThemeController.ts
@@ -112 +112 @@
-    const saved = loadThemePrefs(readPrefs());
+    const saved = { theme: this.opts.settings.theme, auto: this.opts.settings.themeAuto, light: this.opts.settings.themeLight, dark: this.opts.settings.themeDark };
$ pnpm -C packages/web exec vitest run src/theme/ThemeController.test.ts  # exit 1
     × 控えは保存された設定から作る——同じブラウザの別のタブで 1 つのテーマを変えていても、このタブで「暗いとき」を変えたときの控えはそれに揃う 14ms
 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/ThemeController.test.ts > 変化を追う > 控えは保存された設定から作る——同じブラウザの別のタブで 1 つのテーマを変えていても、このタブで「暗いとき」を変えたときの控えはそれに揃う
AssertionError: expected '#282a36' to be '#2e3440' // Object.is equality
$ # 元に戻した: cmp packages/web/src/theme/ThemeController.ts → 一致

$ # 変異: PaneFrame が選ばれている pane の枠に以前の変数を使う（E2E で見る）
$ git diff（変異）
--- a/packages/web/src/components/PaneFrame.vue
+++ b/packages/web/src/components/PaneFrame.vue
@@ -147 +147 @@
-  border: 2px solid var(--wtm-pane-current, #44475a);
+  border: 2px solid var(--wtm-menu-border, #44475a);
$ pnpm -C packages/web run build  # exit 0
$ pnpm -C packages/e2e exec playwright test src/specs/theme-settings.spec.ts -g キーだけでテーマを選ぶと --reporter=line  # exit 1
Running 1 test using 1 worker
src/specs/theme-settings.spec.ts:175:1 › キーだけでテーマを選ぶと、画面の枠と開いている全ての端末の色がその場で替わる。自動の切替もキーで入れられ、閉じると端末へ戻り、選び直せば元に戻る（AC1・AC2・AC5・AC7・AC10・AC-I1〜AC-I4）
{"ts":"2026-09-21T13:33:02.401Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  1) src/specs/theme-settings.spec.ts:175:1 › キーだけでテーマを選ぶと、画面の枠と開いている全ての端末の色がその場で替わる。自動の切替もキーで入れられ、閉じると端末へ戻り、選び直せば元に戻る（AC1・AC2・AC5・AC7・AC10・AC-I1〜AC-I4） 
    Error: 選ばれている pane の枠 #ccd0da と背景 #e5e7eb
    expect(received).toBeGreaterThanOrEqual(expected)
    Expected: >= 3
    Received:    1.2469733706997341
      209 |   const edge = rgbToHex(await o.page.locator(".pane-frame-edge-current").first().evaluate((el) => getComputedStyle(el).borderTopColor));
      210 |   const pageBg = rgbToHex(await o.page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    > 211 |   expect(contrastRatio(edge, pageBg), `選ばれている pane の枠 ${edge} と背景 ${pageBg}`).toBeGreaterThanOrEqual(3);
          |                                                                               ^
      212 |   expect(contrastRatio(edge, TERMINAL_PALETTES["catppuccin-latte"].background)).toBeGreaterThanOrEqual(3);
      213 |
      214 |   // 自動の切替もキーだけで：Tab で切り替えへ、Space で入れる（OS は暗いので latte の対の暗い側＝catppuccin）。
        at /workspaces/web-tn-multiplexer/packages/e2e/src/specs/theme-settings.spec.ts:211:79
    Error Context: test-results/theme-settings-キーだけでテーマを選ぶ-2f84f-2・AC5・AC7・AC10・AC-I1〜AC-I4）/error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/theme-settings-キーだけでテーマを選ぶ-2f84f-2・AC5・AC7・AC10・AC-I1〜AC-I4）/trace.zip
    Usage:
        pnpm exec playwright show-trace test-results/theme-settings-キーだけでテーマを選ぶ-2f84f-2・AC5・AC7・AC10・AC-I1〜AC-I4）/trace.zip
    ────────────────────────────────────────────────────────────────────────────────────────────────
  1 failed
    src/specs/theme-settings.spec.ts:175:1 › キーだけでテーマを選ぶと、画面の枠と開いている全ての端末の色がその場で替わる。自動の切替もキーで入れられ、閉じると端末へ戻り、選び直せば元に戻る（AC1・AC2・AC5・AC7・AC10・AC-I1〜AC-I4） 
$ # 元に戻した: cmp packages/web/src/components/PaneFrame.vue → 一致
```

### review ラウンド 2 の差し戻しの後（警告の文字を薄めない。decisions D16）

```
$ # 変異: 2 行目を行ごと 0.75 に薄める（以前の形。警告も薄まる）
$ git diff（変異）
--- a/packages/web/src/components/Sidebar.vue
+++ b/packages/web/src/components/Sidebar.vue
@@ -294,0 +295 @@
+  opacity: 0.75;
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 2 行目の入れ物は薄めず、警告は不透明（補足の文字だけ 0.75） 4ms
 Test Files  1 failed (1)
      Tests  1 failed | 177 passed (178)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > 警告の文字を薄めない（Sidebar.vue） > 2 行目の入れ物は薄めず、警告は不透明（補足の文字だけ 0.75）
AssertionError: 行ごと薄めると警告も薄まる: expected '0.75' to be undefined
$ # 元に戻した: cmp packages/web/src/components/Sidebar.vue → 一致

$ # 変異: 警告を補足と同じく 0.75 に薄める
$ git diff（変異）
--- a/packages/web/src/components/Sidebar.vue
+++ b/packages/web/src/components/Sidebar.vue
@@ -307 +307 @@
-  opacity: 1;
+  opacity: 0.75;
$ pnpm -C packages/web exec vitest run src/theme/uiTokens.test.ts  # exit 1
     × 2 行目の入れ物は薄めず、警告は不透明（補足の文字だけ 0.75） 12ms
 Test Files  1 failed (1)
      Tests  1 failed | 177 passed (178)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/theme/uiTokens.test.ts > 警告の文字を薄めない（Sidebar.vue） > 2 行目の入れ物は薄めず、警告は不透明（補足の文字だけ 0.75）
AssertionError: expected '0.75' to be '1' // Object.is equality
$ # 元に戻した: cmp packages/web/src/components/Sidebar.vue → 一致
```

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260921-theme-settings
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46467 (state dir /tmp/wtm-smoke-Az0UR4)
{"ts":"2026-09-21T13:10:53.909Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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
```

この work は新しい入口（サブコマンド・オプション）を足していない（画面の設定と、サーバの受け口 `client.theme` だけ）ので、`smokeCommands` に行を足さない。

## 未検証の穴（skip / 環境不足）

- **Chromium 以外のブラウザ**（Firefox・Safari）：入力欄の枠・フォーカスの枠の描き方と `color-scheme` の効き方は E2E（Chromium）でしか確かめていない（decisions D4）。
  `docs/verification.md` の手で確かめる項目に入れた。
- **macOS の `<select>`**：閉じたまま上下キーで値が変わるのは Windows・Linux の Chrome の振る舞い。macOS では開いて選ぶ形になる見込みで、確かめていない。
- **実際の OS の明暗の切り替え**：E2E は Playwright の `emulateMedia` で切り替えた。Windows・macOS・Linux のデスクトップの設定がブラウザに届くか（WSL2 の中の
  ブラウザ等）は確かめていない（`docs/verification.md`）。
- **実際のアプリ（nvim 等）の明暗の判断**：E2E は node で OSC 11 を問い合わせて答えを読んだ。nvim の `background` が変わることは手で確かめる項目にした。
- **Windows ネイティブ・macOS のサーバ**：色の問い合わせの答えはサーバの Mirror（OS に依らない処理）だが、その OS で動かしていない。
- **E2E の一式**：利用者の指示どおり、影響を受ける 7 spec だけを走らせた。一式は deliver の直前に 1 回走らせる。
- 明暗の変化をアプリへ知らせる（DSR 996・mode 2031）と色の個別の上書きは対象外（backlog）。

