# テスト結果: pnpm のスクリプトを「失敗が見える」形にする

## 実行したもの
- `pnpm -s typecheck` — exit 0、無出力（0バイト）
- `pnpm -s build` — exit 0、無出力（0バイト）
- `pnpm -s test`（`vitest run`。web/protocol/server/cli の4パッケージを `test.projects` で
  横断） — 161 files / 3010 tests、すべて pass
- `pnpm -s lint`（`eslint . --ext .ts`） — exit 1（`scratchpad/herdr/` 配下と
  `packages/cli/src/ansiStrip.ts` の既存の lint エラー・警告のみ。`git show main:
  packages/cli/src/ansiStrip.ts` と `diff` で main と同一であることを確認済み——この work の
  変更とは無関係な既存の問題。`scripts/run-quiet.mjs`・`package.json` はどちらも lint 対象に
  含まれているが、指摘は一切無い）
- `aidev coverage --strict` — `coverage-summary: ac=5 design=5/5(100%) tasks=5/5(100%)
  task_rows=1 no_ac=0 ac_none=0 gaps=0` / `coverage-gaps: struct=0 cover=0`（exit 0）
- `aidev smoke` — pass（web・cli の2本）

## 受け入れ基準ごとの判定
- AC1: pass — `packages/protocol/src/index.ts` に型エラーを一時的に仕込み、`pnpm -s typecheck`
  を実行すると、標準出力に対象パッケージ名（`packages/protocol`）・対象ファイル
  （`src/index.ts(11,7)`）・エラーメッセージ（`error TS2322: ...`）が残り、終了コードが2に
  なることを確認（decisions.md D2 の A）。
- AC2: pass — 同様に `pnpm -s build` を実行すると、`tsc -b` の同じ型エラーで失敗し、内容が
  残り、終了コードが1になることを確認（decisions.md D2 の B）。
- AC3: pass — 型エラーを戻した状態で `pnpm -s typecheck`・`pnpm -s build` を実行すると、
  どちらも出力が一切無く（0バイト）、終了コード0で終わることを確認（D2 の G）。`pnpm build`
  （-s 無し）の成功時には vite の途中経過と「Some chunks are larger than 500 kB」警告がそのまま
  流れることも確認（D2 の H。review round1 の指摘で修正した点）。
- AC4: pass — `pnpm -s test`・`pnpm -s lint`（既存の無関係な問題のみ）が無改修のまま動作する
  ことを確認。
- AC5: pass — `typecheck`・`build` の両方について、`-s` あり（D2 の A・B。ラッパーのバナー付き）
  と `-s` 無し（D2 の C・D。素通しなので pnpm 自身の出力のまま）の4パターンすべてで、型エラーを
  仕込んだ状態の失敗の内容が標準出力に残ることを確認。

## 失敗の証跡（負の確認。regression-negative-control.md）

decisions.md D2 に A〜H の生ログ（コマンド出力をファイルへリダイレクトしたものをそのまま貼付）を
記録済み。修正が効いていることを、直した箇所を1つずつ戻して落ちることで確かめている:

1. **E**: `package.json` を HEAD の形（ラッパー無し）へ戻して `pnpm -s typecheck` → 出力0バイト・
   exit 2（元のバグの再現）。
2. **F**: `scripts/run-quiet.mjs` から `delete childEnv.npm_config_reporter` /
   `delete childEnv.npm_config_loglevel` の2行だけを外して `pnpm -s typecheck` → バナー行だけで
   中身が空・exit 2（継承した `npm_config_reporter=silent` で内側の pnpm も黙る、という2段目の
   原因の再現）。
3. どちらも戻したあと、`packages/protocol/src/index.ts`・`package.json`・`scripts/run-quiet.mjs` が
   `cmp` で元と一致することを確認。

taskcheck 2ラウンド（上限到達。decisions.md D5・D6）、review round1（should 3・nit 3。
decisions.md D7）への対応を経た状態での結果。

## 起動確認（smoke）
```
$ pnpm -s build && pnpm -s smoke
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## 未検証の穴（skip / 環境不足）
- Windows ネイティブ・macOS での `scripts/run-quiet.mjs`（`spawn(command, { shell: true })`）の
  動作は未検証（この開発環境は Linux のみ）。ただし `typecheck`・`build` の呼び出し文字列
  自体は変更前と同じ内容（`pnpm -r --filter=./packages/* run <script>`）で、`shell: true` は
  各 OS の既定シェル（POSIX は `/bin/sh`、Windows は `cmd.exe`）を使うため、変更前から
  この2スクリプトが動いていた OS では同様に動くと考えられる。この work の範囲では自動 CI が無く手元検証もこの環境に限られるため、
  他 OS での確認は本 work のスコープ外とする。
