# タスク: 画面履歴の保存と再生（opt-in）

## 実装方針

design の部品を下から積む。純粋な関数（安全化・切り詰め・区切り）→ ミラーの取り出し → ファイル → 保存の係 → 復元での流し込み →
組み立て（CLI・起動・停止）→ 表示 → docs。各部品は単体テストで確かめ、最後に実 PTY の結合テストで往復を確かめる。

## 作業順序と依存関係

下の `依存:` に従う。T1（安全化）を先に作るのは、AC8 の許可リストが直列化の出力（research F2）を落とさないことを、
T2 の実物のミラーのテストで早めに確かめるため。

## リスク / 留意点

- `Mirror` のインターフェースに足すと、`implements Mirror` の偽物（`agent/AgentMonitor.test.ts`・`terminal/OutputFanout.test.ts`）が型で落ちる。T2 で直す。
- `SessionService.test.ts` の `FakeTerminalHost.mirror` は `plainText` だけの偽物。T5 で `write` を足す。
- 結合テストは実 PTY と実シェルを使う。共有マシンの負荷で遅くなりうるので、出力を待つときは期限つきのポーリングにする。
- prettier は新規ファイルと HEAD で整形済みのファイルにだけ `--write`（プロジェクトの慣習）。
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 安全化（T1・T3）・取り違え防止と無効のときの消去（T9 の `listen()`）・
  会話再開の除外と流し込みの順序（T5）・変化なしなら書かない（T4）は、
  実装を壊して落ちることを確かめる（test 工程）。

## テスト方針

- 単体（vitest）: `historyAnsi.test.ts`・`Mirror.test.ts`・`PaneHistoryFile.test.ts`・`PaneHistoryRecorder.test.ts`・`SessionService.test.ts`・
  `cliArgs.test.ts`・`config.test.ts`・`startupBanner.test.ts`。
- 結合: `composeServer.integration.test.ts`（実 PTY。AC1・AC2・AC4・AC5・AC6・AC7〔壊れたファイルでも起動〕・AC12）。
- 全体: `pnpm -s build && pnpm -s typecheck`（終了コードで判断）・`pnpm -s test`・`pnpm -s lint`・`aidev smoke`。E2E は実行しない。
- 負の確認: 変異を入れて該当テストが落ちることを、生のログをファイルに残して確かめ、`cmp` で元に戻ったことを確かめる。

## タスク

- [x] T1: 安全化・切り詰め・区切り（`sanitizeHistoryAnsi`・`truncateHistoryAnsi`・`historyReplayText`・`PANE_HISTORY_MAX_PANE_BYTES`）とその単体テスト
      対象: `packages/server/src/terminal/historyAnsi.ts`（新規）・`historyAnsi.test.ts`（新規） / 根拠: design「`terminal/historyAnsi.ts`」・decisions D3・D4・D5
      依存: なし
      AC: AC7, AC8
- [x] T2: `Mirror.historyAnsi()`（通常バッファの最後の空でない行まで・モードとカーソルの位置合わせ無し）と単体テスト（代替画面の中・色・安全化した内容を流しても応答もモードの変更も無い）、`Mirror` の偽物の更新
      対象: `packages/server/src/terminal/Mirror.ts` `XtermMirror.serialize` の隣・`Mirror.test.ts`・`agent/AgentMonitor.test.ts` `FakeMirror`・`terminal/OutputFanout.test.ts` `FakeMirror` / 根拠: research A1
      依存: T1
      AC: AC1, AC8
- [x] T3: `session-history.json` の読み書き・消去（`FsPaneHistoryFile`。0600・上限・壊れたファイル・安全化して返す）と単体テスト
      対象: `packages/server/src/persist/PaneHistoryFile.ts`（新規）・`PaneHistoryFile.test.ts`（新規）、`persist/atomicFile.ts` `writeFileAtomic` / 根拠: research A4
      依存: T1
      AC: AC6, AC7, AC8
- [x] T4: 保存の係（`PaneHistoryRecorder`。定期保存・出力の無い pane は再利用・変化なしなら書かない・上限・失敗はログ・直列）と単体テスト
      対象: `packages/server/src/session/PaneHistoryRecorder.ts`（新規）・`PaneHistoryRecorder.test.ts`（新規）、`session/withTimeout.ts` / 根拠: design「保存」
      依存: T2, T3
      AC: AC1, AC3, AC7, AC13
- [x] T5: 復元で流し込む（`SessionService.restore(data, { paneHistory })`・`spawnForPane` の `seed`・`resumeCommandForRestore`）と単体テスト
      対象: `packages/server/src/session/SessionService.ts` `restore`・`restorePaneProcess`・`spawnForPane`・`maybeResumeAgentSession`、`SessionService.test.ts` `FakeTerminalHost` / 根拠: research A2・A3
      依存: T1, T3
      AC: AC2, AC9, AC12
- [x] T6: `--pane-history` の解析と設定（`cliArgs`・`config`・`main.ts` の help）と単体テスト
      対象: `packages/server/src/cliArgs.ts` `parseArgs`・`USAGE`、`config.ts` `RawServeArgs`・`ServeOptions`・`resolveServeOptions`、`main.ts` `printHelp`、`cliArgs.test.ts`・`config.test.ts` / 根拠: research A6
      依存: なし
      AC: AC11
- [x] T9: 組み立て（`composeServer` の起動での読み込み・消去〔無効のとき・取り違え防止〕・定期保存の開始、停止時の保存）と結合テスト
      対象: `packages/server/src/composeServer.ts` `listen()`・`close()`、`composeServer.integration.test.ts` / 根拠: research A5
      依存: T4, T5, T6
      AC: AC1, AC2, AC4, AC5, AC6, AC7, AC12, AC13
- [x] T7: 起動の表示（`StartupInfo.paneHistoryPath`・`main.ts` から渡す）と単体テスト
      対象: `packages/server/src/startupBanner.ts` `startupLines`・`startupBanner.test.ts`・`main.ts` の `startupLines({...})` / 根拠: research A7
      依存: T9
      AC: AC11
- [x] T8: docs（`docs/tls-setup.md` の起動オプションの節・`docs/verification.md` の手動確認・`docs/herdr-parity.md` の H32）
      対象: `docs/tls-setup.md`（`--scrollback` の節の近く）・`docs/verification.md`・`docs/herdr-parity.md:62` / 根拠: design「ドメイン固有の考慮」
      依存: T9
      AC: AC10
