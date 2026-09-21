# タスク: このブラウザの設定を増やす（サイドバーの幅・状態の記号・scrollback）

## 実装方針

**純粋関数 → ストア → 部品 → 結線 → 入口とダイアログ → 文書 → E2E** の順に積む。
純粋関数（T1・T2）を先に固めて単体で総当たりし、ストア（T3・T4）はその上に作る（design「テストの置き方」）。
部品と結線はストアの形が決まってから。入口とダイアログの改名は**既存テストが落ちることを先に確かめてから**直す
（条項 `regression-negative-control`。落ちる箇所は design の表にある）。入口の改名（T8）はどこにも依存しないので、
順序の上では早く着手してよい。

## 作業順序と依存関係

下の `依存:` に従う。依存では表せない順序の理由だけ書く。

- **E2E の一式は deliver の直前に 1 回だけ回す**（利用者の指示。前 work の `test-result.md` の「ラウンド 4」に記録）。
  直している間と test 工程では、**この work の影響を受ける spec だけ**を走らせる（T12）。影響を受ける spec は
  **新しい spec（T11）・`notifications.spec.ts`（設定ダイアログ）・`agent-detection.spec.ts`（`.sidebar-state-icon[data-state]`。
  design D2 の「セレクタは変わらない」を守る唯一の E2E）・`workspace-tab-pane.spec.ts`（サイドバーの幅と折りたたみ）・
  `terminal-app.spec.ts`（サイドバーのセレクタを使う）・`mobile.spec.ts`（モバイルのピッカーと上のバー）**。

## リスク / 留意点

- **scoped CSS**: 呼ぶ側の状態の点のルールを丸ごと消さないと、`StateIcon` の字形の後ろに塗りの丸が描かれる（design D2）。
- **`addInitScript` で `wtm.prefs.v1` を仕込むと保存を確かめたことにならない**（research F35）。保存の E2E は `storageState`。
- **ネイティブのラジオの矢印の挙動は happy-dom では再現しない**。AC-I3 は E2E（T11）で見る。
- **vitest は SFC の `<style>` を読まない**。色（AC5）は E2E（T11）で見る。
- 改名で落ちる既存テストは design「テストの置き方」の表のとおりで、**持ち場は 3 つに分かれる**:
  文脈と入口の改名で落ちるもの（表の 1・2 行目）は T8、ダイアログの節で落ちる `NotificationSettingsDialog.test.ts:62-68`・
  `:235-237` は T9、E2E のセレクタ `notifications.spec.ts:385` は T11。**どの持ち場でも、先に落ちることを確かめてから直す**。
  **`NotificationController.test.ts:944` は型だけで落ちる**（vue-tsc がテストも検査する）ので、vitest だけ見ていると気づかない。

## テスト方針

- 純粋関数（`load*`・`scrollbackChoices`・`effectiveScrollback`・`stateGlyph`・`stateLabel`）は単体で総当たり。
- 部品（`StateIcon`・`SettingsDialog`・`Sidebar`）は単体（happy-dom）で役割・`aria-*`・保存を見る。
- **負の対照**: 回帰を守るテストは、直した箇所を戻して落ちることを確かめ、生の出力を `test-result.md` に貼る。
- E2E は 1 本の新しい spec（T11）。判定はブラウザの側（DOM・computed style・ブラウザが送ったフレーム）。

## タスク

- [x] T1: 状態の字形と読み上げの名前の表を作る（`stateGlyph`・`stateLabel`）。5 状態は別の字形、`null` は空と `null`
      対象: `packages/web/src/store/stateIndicator.ts`（新規）とそのテスト / 根拠: design D4・「純粋関数」、先例 `packages/web/src/store/paneName.ts`
      依存: なし
      AC: AC4, AC8
- [x] T2: scrollback を決める純粋関数を作る（`ScrollbackPref`・`MOBILE_SCROLLBACK_LINES`・`loadScrollbackPref`・
      `scrollbackChoices(limit, saved?)`・`effectiveScrollback`）。`MOBILE_SCROLLBACK_LINES` は `main.ts:45` から移す
      対象: `packages/web/src/term/scrollback.ts`（新規）とそのテスト、`packages/web/src/main.ts:45` / 根拠: design D5・「純粋関数」・「エラー処理」、research F21〜F25
      依存: なし
      AC: AC3, AC9, AC11
- [x] T3: サイドバーの幅と折りたたみを `wtm.prefs.v1` に保存・読み戻しする（`SIDEBAR_WIDTH`・`loadSidebarWidth`・
      `loadSidebarCollapsed`・`sidebarWidth`・`setSidebarWidth`（保存しない）・`commitSidebarWidth`・`toggleSidebar` が保存する）
      対象: `packages/web/src/store/view.ts:42-78` `readPrefs`/`writePrefs`、`:158` `sidebarCollapsed`、`:261-263` `toggleSidebar`、
      `packages/web/src/store/view.test.ts` / 根拠: design D1・「ストア」、research F15〜F19
      依存: なし
      AC: AC1, AC2, AC3
- [x] T4: 記号表示と scrollback の設定のストアを作る（`loadStatusSymbols`・`statusSymbols`（既定 true）・`scrollback`・
      `setStatusSymbols`・`setScrollback`。反映と保存を同時に）
      対象: `packages/web/src/store/settings.ts`（新規）とそのテスト / 根拠: design D3・D5・「ストア」、先例 `packages/web/src/store/notifications.ts:20-26`
      依存: T2
      AC: AC3, AC7, AC10
- [x] T5: `StateIcon.vue` を作り、サイドバー・goto・モバイルのピッカーの 3 か所をこれに置き換える。
      **呼ぶ側の状態の点の CSS は丸ごと消す**。記号「切」ではいまの丸、居ない行は字形なしの薄い丸、読み上げの名前は常に付ける。
      AC5（色）の確かめは T11
      対象: `packages/web/src/components/StateIcon.vue`（新規）と `StateIcon.test.ts`（新規）、`packages/web/src/components/Sidebar.vue:138` `:171` `:276-299`
      `packages/web/src/components/GotoPicker.vue:312` `:380-402` `packages/web/src/mobile/PanePicker.vue:91` `:95` `:108` `:162-185` / 根拠: design D2・D4、research F3〜F6
      依存: T1, T4
      AC: AC4, AC5, AC6, AC8
- [x] T6: サイドバーの幅をストアから読み書きする。ドラッグ中は反映だけ、`pointerup`・`pointercancel`・`lostpointercapture`・
      ダブルクリックで保存（divider の要素に `@pointercancel`・`@lostpointercapture` を足す）。
      **ドラッグ中にダイアログが開いたら（`view.openDialog` の watch）その時点で終えて保存する**。
      `Sidebar.test.ts` に、**保存の経路ごとの単体**（`pointerup`・`pointercancel`・`lostpointercapture`・ダブルクリック・
      ダイアログが開いたとき〔AC-I5〕）と、**ドラッグ中は保存しない**ことを足す（E2E が通すのは `pointerup` の経路だけ）
      対象: `packages/web/src/components/Sidebar.vue:12-22` `:98-119` `:123` `:197`、`packages/web/src/components/Sidebar.test.ts:379-405` / 根拠: design「振る舞いの詳細」サイドバー・AC-I5、research F15
      依存: T3
      AC: AC1, AC-I5
- [x] T7: scrollback を結線する。`getScrollbackLines` を `effectiveScrollback(settings.scrollback, kind, limit)` にし、
      `injection.ts` に `DeviceKindKey` を足して `main.ts` で provide する。`TermEntry` に `scrollback: number | undefined` を持たせ
      （作る所のオブジェクトにも入れる）、`ViewSync` の購読は `registry.get(paneId)?.scrollback ?? getScrollbackLines()`。
      「作ったときの値が優先される」単体テストを `ViewSync.test.ts` に足し、**`registry.get(...)?.scrollback` を読まない形に戻すと
      落ちることを負の対照で確かめる**
      対象: `packages/web/src/main.ts:47` `:116` `:135` `:139` `:244-249` `packages/web/src/injection.ts`
      `packages/web/src/term/TerminalRegistry.ts:16-23` `:74` `:184-190` `:231-238` `packages/web/src/term/ViewSync.ts:103-106`
      `packages/web/src/term/ViewSync.test.ts` / 根拠: design D5・D6・「振る舞いの詳細」、research F23〜F26
      依存: T2, T4
      AC: AC9, AC11
- [x] T8: action と文脈を `notifySettings` → `settings` に改め、入口の文言を「設定」にそろえる
      （`ContextMenu` の項目・`HelpDialog` の `s`・モバイルのボタンを文字「設定」とクラス `.mobile-shell-settings-btn` に）。
      **ダイアログが文脈を見る所（`NotificationSettingsDialog.vue:68`）とそのテストの開き方（`:52`・`:141`）もここで改める**
      ——T9 に残すと、T8 だけでは型検査で落ち、`prefix+s` でも開かなくなる（単独で検証できない）。
      **先に、落ちる既存テストが落ちることを確かめてから直す**
      対象: `packages/web/src/keys/keymap.ts:57` `packages/web/src/keys/actions.ts:65` `packages/web/src/actions/ActionDispatcher.ts:137-138`
      `packages/web/src/store/view.ts:126` `packages/web/src/components/ContextMenu.vue:98` `packages/web/src/components/HelpDialog.vue:43`
      `packages/web/src/mobile/MobileShell.vue:84-86` `:151` `packages/web/src/components/NotificationSettingsDialog.vue:9-10`（注記） `:68`、
      テスト `packages/web/src/keys/KeyRouter.test.ts:146` `packages/web/src/mobile/MobileShell.test.ts:292-299`
      `packages/web/src/actions/ActionDispatcher.test.ts:902-907` `packages/web/src/components/ContextMenu.test.ts:184-193`
      `packages/web/src/components/HelpDialog.test.ts:41` `packages/web/src/notify/NotificationController.test.ts:944`
      `packages/web/src/components/NotificationSettingsDialog.test.ts:52` `:141` / 根拠: design D7・D8・「テストの置き方」の表、research F30
      依存: なし
      AC: AC12, AC13, AC14, AC-I1
- [x] T9: `NotificationSettingsDialog.vue` を `SettingsDialog.vue` に改め、見出しで 3 節（通知・表示・端末）に分ける。
      通知の 3 つは同じ実装で移し、表示に switch「状態を記号でも示す」、端末に scrollback のラジオの組
      （「自動（この端末では N 行）」＋ `scrollbackChoices`、常に 1 つ選ばれている）。クラスは `.settings-*` に改める。
      **`kind` は `inject(DeviceKindKey, "desktop")`（既定値つきで throw しない）で受け、`isCoarsePointer()` を呼び直さない**
      （design「振る舞いの詳細」の設定ダイアログ）。既存の単体テストは改名先へ移し、**そのままでは通らない 2 か所だけ直す**
      （switch を数える箇所を「通知」節に限る・ダイアログの名前を見る箇所。**先に落ちることを確かめてから直す**）。
      **開いたときに「自動」の行の N を読む**処理を watch（`:65-78`。文脈の名前は T8 で改め済み）に足す。
      **テンプレートと `<style scoped>` のクラスは同時に改める**（片方だけだと scoped CSS が当たらず見た目が崩れ、
      vitest は `<style>` を読まないのでどのテストでも捕まらない）。背景クリックで閉じて結果が残ること・
      表示の switch とラジオの保存を単体で足す。`App.vue` の取り付けも改める。AC-I3（矢印）の確かめは T11
      対象: `packages/web/src/components/NotificationSettingsDialog.vue`（→ `SettingsDialog.vue`）`:22`（throw の文言） `:65-78`
      `:115-155` `:158-221`（`<style scoped>`）、
      `packages/web/src/components/NotificationSettingsDialog.test.ts`（→ `SettingsDialog.test.ts`）`:62-68` `:235-237`
      `packages/web/src/App.vue:10`（import） `:73` / 根拠: design D5・D7・「インターフェース」の設定ダイアログ・「振る舞いの詳細」の設定ダイアログ・AC14、research F28・F29・F32・F33
      依存: T4, T7, T8
      AC: AC6, AC9, AC12, AC13, AC14, AC-I1, AC-I2, AC-I3, AC-I4
- [x] T10: 文書を直す。`docs/herdr-parity.md` の H06・H19 を更新し、**H23b（状態表示を記号にする設定。既定が herdr と逆で
      あることも書く。decisions D1）を足し、H25 を H25（設定画面）／H25b（再読み込み・onboarding。後続）に割る**。
      `docs/tls-setup.md` と `docs/verification.md` の「モバイルは 1,000 行」を直し、`docs/verification.md` で状態の表示を
      「丸」「丸の色」と書いている箇所を、既定で記号が出る見え方に合わせる
      対象: `docs/herdr-parity.md:28` `:41` `:45` `:47` `docs/tls-setup.md:476-492`
      `docs/verification.md:51-53` `:110` `:452` `:457` `:568` / 根拠: design AC16・対象範囲、research F11・F27
      依存: T5, T6, T9
      AC: AC16
- [x] T11: E2E を足す（新しい spec 1 本）。
      `storageState` の持ち越しで幅・折りたたみ・scrollback が残ること（AC1・AC2・AC10）、壊れた値で既定になること（AC3）、
      別の context では既定のままであること（AC15。判定は画面の状態）、
      何も設定しない利用者に記号が出ること・入力待ちの行の字形 `×` と色・居ない行に字形が無いこと・
      表示の switch を切ると字形が消えること（AC5・AC6・AC7・AC8）、
      `prefix+s`・［メニュー］・モバイルの「設定」の 3 経路で開けて 3 節が見え、**Esc で閉じる**こと（AC12・AC13・AC-I1）、
      **モバイルでは端末の節に「自動（この端末では 1,000 行）」と出る**こと（`DeviceKindKey` の結線の安全網。design「振る舞いの詳細」）、
      キーだけで端末の節のラジオを選べること（AC-I3）、新しく開いた pane の `pane.subscribe` の行数（AC9・AC11。CDP で読む）。
      既存の `notifications.spec.ts:385` のセレクタ（`.notify-settings`）も直す
      対象: `packages/e2e/src/specs/`（新規 spec）`packages/e2e/src/specs/notifications.spec.ts:385`
      `packages/e2e/src/support/panes.ts:52-70` `packages/e2e/src/support/appServer.ts:49-56` / 根拠: design「テストの置き方」・各 AC の確かめ方、条項 `e2e-observe-browser`、research F34〜F38
      依存: T5, T6, T7, T9
      AC: AC1, AC2, AC3, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC15, AC-I1, AC-I3
- [x] T13: review ラウンド1 の指摘に対応する。設定ダイアログに「閉じる」を置き、狭い画面に収め、ラジオの行に押せる高さを付け、
      注記を字形と名前の組にする。状態の印の blocked と idle の色を WCAG 1.4.11 の 3:1 以上に上げ、記号を太字にし、状態不明の
      opacity を外す。モバイルの文字のボタンに押せる高さ。`DISPLAY_STATES` を `STATE_PRIORITY` から導く。T5 の回帰（ラベルの位置）と
      design D2 の回帰（字形の後ろの丸）を守る E2E を足す。`docs/verification.md` に字形の目視の手順を足す
      対象: `packages/web/src/components/SettingsDialog.vue` `packages/web/src/components/StateIcon.vue` `packages/web/src/mobile/MobileShell.vue`
      `packages/web/src/store/stateIndicator.ts` `packages/web/src/term/TerminalRegistry.ts:47` `packages/e2e/src/specs/settings.spec.ts`
      `docs/verification.md:305` `:306` `:454` / 根拠: review.md「レビュー ラウンド1」
      依存: T11
      AC: AC4, AC5, AC8, AC13, AC-I1
- [ ] T12: 全パッケージの単体テストと、**この work の影響を受ける E2E の spec**（「作業順序と依存関係」に名前で挙げた 6 本）
      を走らせて結果を記録する
      （**test 工程で消化する**。coding では未チェックのまま承認してよい）。**`pnpm build` を通してから E2E を走らせる**。
      **E2E の一式は deliver の直前に 1 回**（review から差し戻されたら、戻った後の deliver の直前に回す）
      対象: 未特定（走らせるだけで自前の差分を持たない）
      依存: T10, T11
      AC: なし
