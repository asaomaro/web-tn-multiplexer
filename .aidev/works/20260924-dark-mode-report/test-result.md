# テスト結果: 明暗の変化を端末の中のアプリへ知らせる（DSR 996/mode 2031）

## review round1 差し戻し後の再実行（追記）

review round1 の must（`handleAppearanceQuery`/`handleMode2031` が複数 Pm 束ねに対応しておらず
`true` を返して連鎖を止めていた問題。decisions.md D2）を修正後、以下を再実行した。

- `packages/server`: `npx tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — **796 passed**（Mirror.test.ts に review round1 の再現テスト2件を追加。
  794→796）/ 0 failed
- ルート: `pnpm -s typecheck` — exit 0 / `pnpm -s test` — **2937 passed**（2935→2937）/ 0 failed
- `aidev coverage --strict` — ac=6 design=6/6(100%) tasks=6/6(100%) gaps=0（T2 の既存範囲内の
  修正のため、タスクの追加・AC の変更なし）
- 負の確認の生ログは decisions.md D2「失敗の生ログ」に記録済み（regression-negative-control.md
  準拠）。

## 実行したもの（review round1 差し戻し前・当初の記録）

- `packages/protocol`: `npx tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — 68 passed / 0 failed / 0 skipped
- `packages/server`: `npx tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — 794 passed / 0 failed / 0 skipped
- `packages/web`: 変更なし（design「対象範囲」で変更しない、と確定済み）。ルートの一括実行に
  含めて無改修であることを確認。
- ルート: `pnpm -s typecheck` — exit 0（3パッケージ横断の再確認）・`pnpm -s test` —
  2935 passed / 0 failed（protocol 68・server 794・web 2073。web は本 work の変更対象外だが
  無改修で全て pass することを確認）
- `aidev smoke` — PASS（web・CLI 双方。下記「起動確認」参照）
- `aidev coverage --strict` — ac=6 design=6/6(100%) tasks=6/6(100%) gaps=0

T1〜T5 のいずれについても、実装時に追加したテストは全て上記の一括実行に含まれる（個別の
pass 件数は各タスクの taskcheck ラウンドで既に確認済み。ここでは work 全体としての再実行結果
を記録する）。

## T6（回帰確認）の実施内容

tasks.md の T6 はこの工程で消化する（判断を要する分岐が無かったため decisions.md への記録は
省く——単純な既存テスト実行の確認）。

- `Mirror.test.ts`（既存13テスト。DA1/DA2/CPR/DECRQM/DECRQSS・OSC 4/7/9/10/11/12 の応答）:
  無改修のまま全て pass。
- `answerPalette.test.ts`（既存11テスト。`answerPaletteFor` の4段階の優先順位）: 無改修のまま
  全て pass（`resolveThemeFor` への切り出し後も同じ結果）。
- `surface/methods/index.test.ts`（既存20テスト。`client.theme`/`client.hello`/`client.view`/
  `client.fit` 等）: 無改修のまま全て pass。
- `WsGateway.integration.test.ts`: 無改修のまま全て pass（`Mirror` interface 拡張に伴う
  波及修正〔`AgentMonitor.test.ts`・`OutputFanout.test.ts` の `FakeMirror` への1行追加〕は
  T2 taskcheck で対応済み。テストの内容・検証対象は変えていない）。
- 既存の `TerminalHost`/`TerminalManager`（`palette`/`paletteFor` の既存の色の問い合わせ動作）・
  `composeServer.ts` 経由の起動（`aidev smoke` で確認）も上記の一括実行に含まれ、全て pass。

## 受け入れ基準ごとの判定

- AC1: pass — `Mirror.test.ts`「CSI ?996n に、appearance() が dark なら ?997;1n、light なら
  ?997;2n で答える」・「appearance を渡さなければ既定（dracula=dark）で答える」で確認。
- AC2: pass — `Mirror.test.ts`「CSI ?2031h を送っていれば...notifyAppearanceMayHaveChanged で
  通知される」・`surface/methods/index.test.ts`「client.theme は、全 pane の
  Mirror.notifyAppearanceMayHaveChanged を呼ぶ」で確認。OS の自動切替は、design 作成時に
  確認した既存の `ThemeController`/`client.theme` 経路（`packages/web/src/theme/
  ThemeController.ts:44-45`）にそのまま乗るため、この work では新しいコードを要さない
  （web パッケージは無改修）。
- AC3: pass — `Mirror.test.ts`「CSI ?2031l を送ると、以後 appearance が変わっても通知しない」
  で確認。
- AC4: pass — 新しい状態（`mode2031Enabled`・`lastReportedAppearance`）は `XtermMirror`
  インスタンスのフィールドで、既存の pane 破棄の経路（`TerminalHost.dispose()`→`Mirror.
  dispose()`）にそのまま乗ることを design で確認済み。新しい後始末コードは無いため、既存の
  `TerminalManager`/`TerminalHost` の破棄テスト（この work では変更していない）がそのまま
  裏付けになる。
- AC5: pass — `Mirror.test.ts` の全テストが、pane ごとに独立した `XtermMirror` インスタンス
  （`new XtermMirror(...)`）を個別に作って検証しており、pane 間の独立性が構造上保証されている
  ことを確認。
- AC6: pass — T6 の回帰確認（上記）で、既存の OSC/DSR ハンドラ・テーマ切替・pane 操作が
  無改修のテストで全て通ることを確認。

## 失敗の証跡

このラウンドでは失敗が発生していない。T1〜T5 のコーディング中に見つかった指摘は
`review.md`「タスク点検ログ」節に記録が無い（全タスク taskcheck findings=0——正常）。
decisions.md D1（`CSI ?2031h` 有効化時の `lastReportedAppearance` 捕捉）は coding 中に自分の
新規テストで発見した設計上の抜けで、修正前は実際にテストが失敗していたことを T2 taskcheck の
独立点検でも再現・確認済み（負の確認）。test 工程としての実行では最初から全て pass だった。

## 起動確認（smoke）

```
$ aidev smoke
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
$ pnpm --filter @wtm/cli run smoke
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

この work は新しい起動経路（サブコマンド・オプション）を追加していないため、
`smokeCommands` への追記は不要（既存の smoke がそのまま成果物の起動を確認する）。

## 未検証の穴（skip / 環境不足）

- **実際の端末アプリ（vim・bat・delta 等、DSR 996/mode 2031 に対応したプログラム）を pane の
  中で動かしての目視確認は行っていない**（このセッションの既定方針: E2E はユーザー依頼の
  ときだけ実施。今回はユーザーからの明示的な E2E 実施依頼が無かったため、`XtermMirror` の
  headless エンジンに直接エスケープシーケンスを書き込む単体テストのみで検証した）。
  AC1〜AC3 は、実際のブラウザでのテーマ切替操作・実際の PTY・実際のプログラムではなく、
  `Mirror.write()`/`onResponse`/`notifyAppearanceMayHaveChanged()` の直接呼び出しレベルの
  確認に留まる。
- **複数クライアントが同じ pane を別々のテーマで見ている状況での実際の動作確認は行っていない**
  （`answerAppearanceFor`/`resolveThemeFor` の優先順位は単体テストで確認済みだが、実際の
  複数ブラウザでの目視確認ではない）。
- **WSL/Windows など実機・複数 OS 環境での確認も行っていない**（同上の理由）。
