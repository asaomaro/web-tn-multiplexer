# タスク: 外部操作 API / CLI（herdr の socket API / CLI 相当）

## 実装方針

1. **サーバ側の最小変更を先に片付ける**（T2：`clientKind` に `"external"` を追加）。他のタスクから
   独立しており、後回しにすると CLI 側の型（`ParamsOf<"client.hello">`）が一時的に不正確になる。
2. **`packages/cli` の土台**（package.json / tsconfig / 最小の `main.ts`）を作り、`pnpm install` で
   モノレポに組み込む（T1）。ここでビルドが通ることを確認してから積み上げる。
3. **独立した純粋関数・ユーティリティ**（`cliArgs`・`session`・`ansiStrip`・`httpAuth`/`wsClient`）を積む。
4. それらを束ねる `withSession`/`output`、さらに `commands/*` 層、最後に `main.ts` で結線する。
5. **実サーバでの統合テスト**（`main.integration.test.ts`）で、ビルドした構成が実際に動くことを確認する。
6. **CLI 自身の起動確認**（`packages/cli/src/smoke.ts`）を新設し、`.aidev/config.yml` を
   `smokeCommands:` のブロック形式にして1行足す（`aidev-50-test`「この work が新しい入口を足したなら
   smokeCommands に1行足す」に従う）。
7. `docs/herdr-parity.md` の対応表を更新する。

## 作業順序と依存関係

下の各タスクの `依存:` に従う。T1・T2 は依存が無く、対象ファイルも重ならない
（T1: `packages/cli/` 新規、T2: `packages/protocol/`・`packages/server/` 既存）ため並行できるが、
**単一セッションでの実装のため直列に進める**（`aidev-40-coding`「迷えば直列」）。

## リスク / 留意点

- `pnpm install` が `pnpm-lock.yaml` を書き換える。deliver でコミットする差分にロックファイルの更新が
  含まれることを忘れない（無関係な依存更新が紛れ込んでいないか、コミット前に diff を見る）。
- WS upgrade の 401 検出は Node の `ws` パッケージの `"unexpected-response"` イベント。`"error"` イベントでは
  ないことを取り違えると `AuthError` の分岐が動かない（design「依拠する既存の事実」で確認済み。実装時も
  ユニットテストで実際に 401 を起こして確認する）。
- OUTPUT フレームは `Uint8Array`。マルチバイト文字の境界分割に注意する（`TextDecoder` の `stream: true`）。
- `pane.subscribe` の SNAPSHOT が届くタイミングは PTY・イベントループ依存。統合テストのタイムアウトは
  余裕を持たせる（design の既定 5000ms より長い待ち時間をテスト側では許容する）。
- **独立点検の逸脱への対応**（decisions.md D9）：design の doccheck で、委譲先の汎用サブエージェントが
  指示範囲を超えてファイル編集・`aidev` CLI 操作まで行った。coding の taskcheck ではこれを踏まえ、
  委譲プロンプトに「Edit/Write/Bash での `aidev` 操作は行わないこと」を明示の禁止事項として太字で加える
  （手順5「タスク単位の独立点検」参照）。

## テスト方針

- **純粋関数**（`cliArgs.ts`・`ansiStrip.ts`・`session.ts`）は単体テストで検証する。`ansiStrip.ts` は
  変異的なケース（BEL 終端の無い OSC・途中で切れたエスケープ・連続するエスケープ・エスケープを含まない
  プレーンテキスト）を機械的に網羅する。
- **`WtmClient`・`commands/*` 層は実サーバ（`@wtm/server` の `composeServer`）を使った統合テストで検証する**
  （モックの WS サーバは作らない——本物の `AuthService`/`OriginPolicy` を経由させることが AC9 の検証
  そのものであるため）。
- **CLI のビルド成果物（`dist/main.js`）自体を子プロセスとして起動する smoke**（T14）を新設し、
  `.aidev/config.yml` を `smokeCommands:` 化する。
- **`.aidev/conventions/regression-negative-control.md` は該当なし**（本 work は不具合修正ではなく
  新規機能の追加のため、「修正前に落ちることを確認する」対象が無い。`[conv:-]`）。
- **`.aidev/conventions/e2e-observe-browser.md` も該当なし**（本 work はブラウザ描画を伴わない。CLI は
  Node 上で完結し、E2E〔Playwright〕は追加しない。AGENTS.md の方針どおり、明示のユーザー依頼が無い限り
  E2E 一式は回さない）。

## タスク

- [x] T1: `packages/cli` パッケージの土台を作る（`package.json`・`tsconfig.json`・`tsconfig.typecheck.json`・
      最小の `main.ts`〔`--help` で使い方を出すだけ〕）。`pnpm install` を実行してワークスペースに組み込み、
      `pnpm --filter @wtm/cli build` が通ることを確認する。
      対象: `packages/cli/package.json`・`packages/cli/tsconfig.json`・`packages/cli/tsconfig.typecheck.json`・
      `packages/cli/src/main.ts`（すべて新規） / 根拠: design.md「対象範囲・新規」、
      `packages/server/package.json`（同形の既存パッケージ）
      依存: なし
      AC: AC8

- [x] T2: `clientKind` に `"external"` を追加し、既存の `desktop`/`mobile` の挙動（特に `SizeAuthority` の
      資格判定）に回帰が無いことを示す単体テストを足す。
      対象: `packages/protocol/src/messages.ts:14`・`packages/server/src/clients/ClientRegistry.ts:4`・
      `packages/server/src/clients/SizeAuthority.test.ts`（追記） / 根拠: design.md「対象範囲・変更」
      「依拠する既存の事実」、decisions.md D4
      依存: なし
      AC: AC10
      **アンカー外の追加対応（decisions.md D11）**: `packages/web/src/net/ports.ts`・
      `packages/web/src/injection.ts`（`DeviceKindKey` の型を新設の `DeviceKind` に分離）。
      design には無かった `packages/web` の型エラーが `pnpm --filter @wtm/web typecheck` で見つかったため。

- [x] T3: `cliArgs.ts`（コマンドライン引数パーサ）と単体テスト。design「コマンド一覧」の全サブコマンドを
      判別共用体 `Command` に変換する。解析エラーは `CliUsageError` を投げる。
      対象: `packages/cli/src/cliArgs.ts`（新規） / 根拠: design.md「インターフェース/データ構造・コマンド一覧」、
      `packages/server/src/cliArgs.ts:22-87`（同じ流儀の既存実装）
      依存: T1
      AC: なし

- [x] T4: `session.ts`（`SessionStore`：cookie のローカルキャッシュ）と単体テスト。
      対象: `packages/cli/src/session.ts`（新規） / 根拠: design.md「`SessionStore`」節
      依存: T1
      AC: AC7

- [x] T5: `httpAuth.ts`（`login`）と `wsClient.ts`（`WtmClient`：接続・`hello`・`request`・`sendInput`・
      `onEvent`/`onOutput`/`onSnapshot`/`onClose`・`AuthError` 検出）。単体テストは実サーバに対して行う
      （T5 の時点では最小の疎通確認のみ。詳細な統合確認は T12）。
      対象: `packages/cli/src/httpAuth.ts`・`packages/cli/src/wsClient.ts`（新規） / 根拠: design.md
      「`WtmClient`」節、「依拠する既存の事実」、`packages/server/src/smoke.ts:159-231`
      依存: T1
      AC: なし

- [x] T6: `withSession.ts`（キャッシュ＋1回だけの再ログイン）と `output.ts`（`reportAndExit` による
      終了コード・JSON 整形）。
      対象: `packages/cli/src/withSession.ts`・`packages/cli/src/output.ts`（新規） / 根拠: design.md
      「振る舞いの詳細・認証」節、「終了コードと出力」節
      依存: T4, T5
      AC: AC7

- [x] T7: `ansiStrip.ts` と単体テスト（BEL 終端の無い OSC・途中で切れたエスケープ・連続エスケープ・
      プレーンテキストを含む変異的なケースを網羅）。
      対象: `packages/cli/src/ansiStrip.ts`（新規） / 根拠: design.md「`stripAnsi`」節、decisions.md D8
      依存: なし
      AC: なし

- [x] T8: `commands/workspace.ts`・`commands/tab.ts`（create/close/rename・create/close）と、
      fake `WtmClient` を使った単体テスト。
      対象: `packages/cli/src/commands/workspace.ts`・`packages/cli/src/commands/tab.ts`（新規） / 根拠:
      design.md「`workspace create`/`tab create`/`pane split`」節・「`workspace close/rename`/`tab close`/
      `pane close`」節
      依存: T6
      AC: AC1

- [x] T9: `commands/pane.ts`（split/close/input/run/read）と、fake `WtmClient` を使った単体テスト
      （`pane input`/`run` の「snapshot に無い paneId は即 exit 1」、`pane read` の `--raw`/既定の
      ANSI 除去の切り替えを含む）。
      対象: `packages/cli/src/commands/pane.ts`（新規） / 根拠: design.md「`pane input`/`pane run`」節・
      「`pane read`」節
      依存: T6, T7
      AC: AC2, AC3, AC4

- [x] T10: `commands/session.ts`（`login`/`snapshot`/`watch`）と、fake `WtmClient` を使った単体テスト
      （`watch` の既定表示／`--json` の切り替えを含む）。
      対象: `packages/cli/src/commands/session.ts`（新規） / 根拠: design.md「`snapshot`」節・「`watch`」節
      依存: T6
      AC: AC5, AC6

- [x] T11: `main.ts` を組み上げ、全サブコマンドをディスパッチする（`--help`/`help` を含む）。
      対象: `packages/cli/src/main.ts`（更新） / 根拠: design.md「インターフェース/データ構造・コマンド一覧」
      依存: T3, T8, T9, T10
      AC: なし

- [x] T12: `main.integration.test.ts`：`@wtm/server` の `composeServer` で実サーバ・実 PTY を起動し、
      login → workspace create → pane split → pane input/run（実 PTY で echo の往復）→ pane read
      （`--follow` 含む）→ snapshot → watch（別クライアントが起こしたイベントを受け取る）→ セッション
      キャッシュ（2回目は login を呼ばない）→ 許可されていない Origin を送って拒否されることの一巡を確認する。
      対象: `packages/cli/src/main.integration.test.ts`（新規） / 根拠: design.md「対象範囲・新規」
      「受け入れ基準との対応」
      依存: T11
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC9

- [x] T13: `docs/herdr-parity.md` の H38・H39・H40 行を更新する（H38: 本 work の対応範囲と slug・対応 AC。
      H39・H40: decisions.md D2 で確定した後続 backlog 項目名「エージェント自動化 API / CLI」
      「pane 直接接続・制御ストリーム」を追記。H41 行は触らない）。
      対象: `docs/herdr-parity.md:68-70` / 根拠: decisions.md D2、AGENTS.md の指示
      依存: なし
      AC: AC12

- [x] T14: `packages/cli/src/smoke.ts`（起動確認。ビルド済みの `dist/main.js` を子プロセスとして起動し、
      login・workspace create・pane input（echo）・pane read・snapshot・watch の一巡を実サーバに対して
      確認する。`packages/server/src/smoke.ts` と同じ「exit 0=pass / 例外で exit 1」の形にする）と、
      `.aidev/config.yml` を `smokeCommands:` のブロック形式にして1行足す。
      対象: `packages/cli/src/smoke.ts`（新規）・`.aidev/config.yml` / 根拠: `aidev-50-test`「この work が
      新しい入口を足したなら smokeCommands に1行足す」、`packages/server/src/smoke.ts`（同形の既存実装）
      依存: T11
      AC: AC8

- [x] T15: 最終確認は **coding ではなく test 工程で消化する**（decisions.md に記録済みの方針。
      `aidev-30-tasks`「6.」の「coding ではなく test / deliver で消化する」に従う）。test 工程で
      `pnpm -s build && pnpm -s typecheck && pnpm -s test && aidev smoke` を通し、`git diff` で
      `packages/server/src/http/HttpServer.ts`・`packages/server/src/ws/WsServerWs.ts`・
      `packages/server/src/main.ts`（サーバ起動オプション）に変更が無いこと（＝新しい HTTP ルート・
      ポート・ソケットを追加していないこと）を確認する。**coding 承認時はこのタスクを未チェックのまま進める**。
      対象: 未特定（確認作業） / 根拠: design.md「受け入れ基準との対応」AC8・AC11
      依存: T12, T13, T14
      AC: AC8, AC11
