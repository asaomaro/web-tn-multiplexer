# レビューガイド: テーマを選び、OS の明暗に合わせて切り替える（herdr のテーマ）

## 変更概要 / 目的

配色は Dracula 系の 1 種に固定だった。herdr と同じ 17 の組み込みテーマ（`terminal` を除く）を**このブラウザごと**に選べ、OS の明暗に合わせて
「明るいとき」「暗いとき」のテーマへ自動で切り替えられるようにした。herdr のテーマは herdr 自身の画面の枠だけを決めるが、ブラウザでは端末も本製品が
描くので、**1 つのテーマが画面の枠と端末の配色の両方を決める**。さらに、端末の中のアプリの色の問い合わせ（OSC 10/11/12/4。nvim が背景の明暗を
調べる等）に、**その tab の大きさを決めている——ふつうは操作している——ブラウザのテーマの色**で答える（以前は固定の Dracula で答え、明るい画面の
アプリが暗い背景用の色を出していた）。既定は今までと同じ Dracula。

## 重要ポイント

- **テーマは名前で扱う**（design D1）。端末の配色は protocol（`packages/protocol/src/theme.ts:329` `TERMINAL_PALETTES`）にあり、web の表示とサーバの
  答えが同じ値を引く。サーバへは名前だけを送る（`client.theme`）。上流の配色（iTerm2-Color-Schemes の版を固定）に 3 つの規則（選んだ文字・カーソル・
  カーソルの下の文字が見えないものだけ直す）を当てる（`finalizePalette` `:316`。decisions D5・D10）。
- **画面の枠の色は herdr の配色から組み立て、WCAG に足りない色だけ明度を寄せる**（`packages/web/src/theme/uiTokens.ts:294` `build`）。dracula は今の値の
  定数。17 テーマ × 表の相手（文字 4.5・0.7 に薄めた文字 4.5・状態の記号 3・フォーカスの枠 3・選ばれている pane の枠 3・選択の面 1.5・再接続の幕の上の文字）
  を単体テストで総当たりする（`uiTokens.test.ts`）。review で 3 回直した（選ばれている pane の枠・選択の面〔D15〕、薄められた警告の文字〔D16〕）。
- **答えの引き方**（`packages/server/src/clients/answerPalette.ts:33`）：tab の大きさを決めている人 → その tab を見ている人のうち最後に操作した人 →
  テーマを伝えた全員のうち最後に操作した人（作ったばかりでモデルに入っていない pane 等）→ dracula。「最後に操作した時刻」は接続しただけでは 0 で、
  作る操作の前にも進める（decisions D7・D8・D13）。Mirror は問い合わせの瞬間に引く（`Mirror.ts:73-75`）。
- **最初の描画でちらつかない**（design D5）：CSP で inline のスクリプトが使えないので、同じオリジンの classic のスクリプト
  `packages/web/public/theme-boot.js` が `<head>` で「設定から作った 3 組の控え」から明暗で 1 組を選んで当てる。名前の解決と配色の表は持たず、
  明暗の選び方だけを本体（`themes.ts:64` `resolveTheme`）と同じにし、`themeBoot.test.ts` で揃っていることを守る。
- **設定の画面**は既存の流儀（選んだ時点で反映と保存、Esc で閉じても残る）。herdr の「試し見・Enter で確定・Esc で戻す」は採らなかった（design D4）。
  節「テーマ」を通知と表示の間に足した（4 節。decisions D11）。

## 処理フロー

```mermaid
sequenceDiagram
  participant B as ブラウザ（main.ts・ThemeController）
  participant H as theme-boot.js（<head>）
  participant S as サーバ（ClientRegistry・answerPalette）
  participant M as Mirror（pane ごと）
  participant A as pane の中のアプリ
  H->>H: 控え（wtm.themeBoot.v1）から明暗で 1 組を選び CSS 変数を当てる
  B->>B: start()：設定と OS の明暗から名前を決め、CSS 変数・color-scheme・全端末へ当てる
  B->>S: client.hello → client.theme {theme}（接続ごとに送り直す）
  B->>S: 設定・OS の明暗が変わったら client.theme
  A->>M: OSC 11 ; ?
  M->>S: answerPaletteFor(paneId)（問い合わせの瞬間に引く）
  S-->>M: tab の大きさを決めている人のテーマの配色
  M-->>A: OSC 11 ; rgb:…
```

## 主要な変更箇所

- `packages/protocol/src/color.ts` — WCAG の相対輝度・コントラスト比・混色・`ensureContrast`（新規）
- `packages/protocol/src/theme.ts` — 17 テーマの名前・明暗・上流の配色・規則・`TERMINAL_PALETTES`
- `packages/protocol/src/messages.ts` — 方式 `client.theme`
- `packages/server/src/clients/answerPalette.ts` — 答えの引き方と「後から埋める箱」（新規）。`ClientRegistry.ts`（`theme`・`lastActedAt`）、
  `SizeAuthority.ts`（操作の時刻を資格を問わず進める）、`surface/methods/{client,tab,workspace,pane}.ts`、`terminal/{Mirror,TerminalHost,TerminalManager}.ts`、
  `composeServer.ts`
- `packages/web/src/theme/{themes,uiTokens,ThemeController}.ts`・`public/theme-boot.js`（新規）、`store/settings.ts`、`term/{theme,TerminalRegistry}.ts`、
  `main.ts:147` `:155-177`、`components/SettingsDialog.vue:288`、`App.vue` の `:root`、直に書いていた色の置き換え（11 ファイル）
- `packages/e2e/src/specs/theme-settings.spec.ts`（新規。8 本）・`settings.spec.ts`・`mobile.spec.ts`
- 文書：`docs/herdr-parity.md`（H24・H25）・`docs/verification.md`、backlog に 3 件

## リスク / 確認したい点

- **dracula でも変わる箇所がある**（decisions D1〜D3・D16）：押された状態のボタンの背景（#6272a4 → #6070a1）、goto の一覧の補足の文字（0.6 → 0.7）、
  `color-scheme: dark` でブラウザが描く入力欄・ラジオ・ボタン・スクロールバーが暗くなる、サイドバーの「未検証」を薄めない。
- **色の問い合わせには 1 つの色でしか答えられない**：同じ pane を明るいテーマと暗いテーマのブラウザで見ると、片方ではアプリの配色が合わない（既知の制約）。
  明暗の変化をアプリへ知らせる DSR 996・mode 2031 は未対応（backlog）。
- **Chromium 以外・macOS・実際の OS の明暗の設定は確かめていない**（E2E は Chromium と `emulateMedia`）。Firefox・Safari の入力欄とフォーカスの枠、
  macOS の `<select>` の操作は `docs/verification.md` の手で確かめる項目にした。
- 上流の配色のまま残した選択の背景が、一部のテーマで端末の背景と近い（one-light 1.11 等。backlog に起票）。
