# タスク: 明暗の変化を端末の中のアプリへ知らせる（DSR 996/mode 2031）

## 実装方針

design.md の層ごとに、下から上（`answerPalette.ts` のリファクタ・新設 → `Mirror.ts` の
CSI/ESC ハンドラ → `TerminalHost`/`TerminalManager` の配線 → `composeServer.ts` の配線 →
`client.theme` ハンドラの push トリガー → 回帰確認）の順で積む。`依存: なし` のタスク
（T1・T2）は互いにファイルが重ならないため並行可（このセッションの他 work と同じ考え方）。

## 作業順序と依存関係

下の `依存:` に従う。T1・T2 は `依存: なし` で互いにファイルも重ならないため並行可。

## リスク / 留意点

- **CSI ハンドラは `Ps` が `996`/`2031` 以外なら必ず `false` を返す**（T2。design「エラー処理」
  ——既存の他の私用シーケンスを壊さないための唯一の防御線）。
- **mode 2031 の有効化そのものでは通知しない**（T2。design「設計方針」——herdr の実際の挙動
  〔`scratchpad/herdr/src/pane/terminal.rs:6105-6138`〕に合わせた、値が変わったときだけ
  通知する規則）。
- **`resolveThemeFor` への切り出しで `answerPalette.test.ts` の既存の期待を壊さないこと**
  （T1。優先順位4段階の意味は変えない）。

## テスト方針

- `answerPalette.test.ts`: `resolveThemeFor` 切り出し後も既存テストが無改修で通ることに加え、
  `answerAppearanceFor` の4段階の優先順位を単体テストで確認する。
- `Mirror.test.ts`: `CSI ?996n` への応答・`CSI ?2031h/l` の有効化/解除・通知（appearance が
  変わったときだけ）・RIS でのリセット・既存の OSC/DA1/DA2/CPR/DECRQM/DECRQSS の無改修動作を
  単体テストで確認する。
- `surface/methods/index.test.ts`: `client.theme` ハンドラが push トリガーとして正しく
  `notifyAppearanceMayHaveChanged` を呼ぶことを確認する。
- 全タスク完了後、既存の pane/terminal/theme 関連テスト全体が無改修のまま通ることを確認する
  （AC6。coding ではなく test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `answerPalette.ts` に `resolveThemeFor` を切り出し、`answerAppearanceFor` を新設し、
      `createPaletteSource` を拡張する。
      対象: `packages/server/src/clients/answerPalette.ts`（`answerPaletteFor`:33-44・
      `createPaletteSource`:61-69 が precedent）・`answerPalette.test.ts` / 根拠: design.md
      「インターフェース / データ構造 > answerPalette.ts」
      依存: なし
      AC: AC1

- [x] T2: `Mirror.ts` に CSI ハンドラ3種（`?996n`・`?2031h`・`?2031l`）・ESC ハンドラ（RIS）・
      `appearance` コンストラクタ引数・`notifyAppearanceMayHaveChanged` を追加する。
      対象: `packages/server/src/terminal/Mirror.ts`（既存の OSC ハンドラ登録:68-94・
      `emitResponse`:158-160・`handleColorQuery`:162-166 が precedent）・`Mirror.test.ts` /
      根拠: design.md「インターフェース / データ構造 > Mirror.ts」「振る舞いの詳細」
      依存: なし
      AC: AC1, AC2, AC3, AC4, AC5

- [x] T3: `TerminalHost`/`TerminalManager` に `appearance`/`appearanceFor` 引数を中継する。
      対象: `packages/server/src/terminal/TerminalHost.ts`（`palette` 引数の中継が
      precedent）・`packages/server/src/terminal/TerminalManager.ts`（`paletteFor` 引数の
      中継が precedent） / 根拠: design.md「対象範囲」
      依存: T2
      AC: AC1, AC2, AC3

- [x] T4: `composeServer.ts` で `appearanceFor` を `TerminalManager` へ渡す配線を追加する。
      対象: `packages/server/src/composeServer.ts:151`（`createPaletteSource()` の呼び出し
      箇所が precedent） / 根拠: design.md「対象範囲」
      依存: T1, T3
      AC: AC1, AC2, AC3

- [x] T5: `client.theme` ハンドラに、全 pane への push トリガーを追加する。
      対象: `packages/server/src/surface/methods/client.ts:34-40`・`index.test.ts`
      （既存の `client.theme` テストの並び） / 根拠: design.md「インターフェース /
      データ構造 > client.ts」
      依存: T2, T4
      AC: AC2

- [x] T6: 既存の pane/terminal/theme 関連テストが全て無改修のまま通ることを確認する
      （回帰確認）。**coding ではなく test 工程で消化する**（このセッションの他 work と
      同じ扱い）。
      対象: `Mirror.test.ts`・`answerPalette.test.ts`・`surface/methods/index.test.ts`・
      `WsGateway.integration.test.ts`（既存ファイルをそのまま実行するだけ。変更はしない） /
      根拠: design.md「対象範囲」（変更しない、とされる既存ファイル群）
      依存: T5
      AC: AC6
