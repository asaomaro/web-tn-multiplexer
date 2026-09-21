# レビューガイド: 01-server-core（サーバ基盤）

## 変更概要 / 目的

herdr 相当のターミナルマルチプレクサを web 化する製品の MVP のうち、**サーバ側の基盤**（端末・
workspace/tab/pane の状態管理・認証・WebSocket 通信・永続化・再起動後の復元）を新規実装した
（`packages/protocol`・`packages/server`。空リポジトリへの green-field 実装、22 タスク）。
requirements/design/architecture の全文は `.aidev/works/20260918-web-terminal-multiplexer/` 直下、
本 subtask 固有の方針は `01-server-core/tasks.md`「実装方針」を参照。

## 重要ポイント

- **層構造**（architecture.md）: adapter（ws/http）→ surface（`ControlSurface`・RPC dispatch）→
  domain（`SessionService`・`SessionModel`・`TerminalManager` 等）→ infra（`NodePtyBackend`・
  `ProcessInspector`・persist・git）。`SessionModel` は副作用なしの純粋な状態木で、書き換えは
  必ず `SessionService` 経由（依存の規則）。
- **PTY 起動の成功確認は非同期にしか分からない**（D37）: node-pty の `spawn()` は存在しない実行ファイルを
  渡しても同期的に例外を投げない。`SessionService.spawnForPane`/`raceSpawn` が短い猶予（既定300ms）の間に
  `onExit` が非0で発火するかで判定する。**この猶予中に対象（workspace/tab/pane）を Map へコミットして
  よいのは、成功が確認できてから**——`reserveWorkspace`/`commitWorkspace`・`reserveTab`/`commitTab`
  （`SessionModel.ts`）はこの順序を守るための reserve/commit 分割。review で一度この順序が逆になっている
  欠陥が見つかり（D43）、修正した。
- **猶予中に code 0 で即終了する pane**（D37 の連鎖）: 起動は成功したが同時にプロセスも終了している、
  という珍しいケース。`TerminalHost.onExit` は一度きり・同期発火でリプレイしないため、後から
  `onExit` を登録する素朴な実装では二度とイベントを受け取れず zombie pane になる（review で発見・
  D43 で修正）。`raceSpawn` が `alreadyExited` を返し、呼び出し側がモデルへコミットした**直後**に
  自分で `closePaneAfterExit` を呼ぶ形にした。
- **OutputFanout の状態機械**（`terminal/OutputFanout.ts`）: 購読者ごとに buffering → live ⇄ stale の
  3状態（architecture.md の図のとおり）。世代番号（`generation`）で、破棄・やり直した継ぎ目の古い
  `write('', cb)` コールバックを無効化する。
- **流量制御**: `Mirror.pendingBytes() > 1MB` で `pty.pause()`、`onDrained`（<256KB）で `resume()` と
  `fanout.retryStale()`。design の数値をそのまま定数化。
- **D18 の連鎖と D24 の意図的な herdr との差異**: シェル終了 → pane を閉じる → 最後の pane なら tab も →
  最後の tab なら workspace も、という連鎖は herdr のソース（Apache-2.0）を直読して確認済み（D36）。
  ただし workspace が実行中に 0 個になったときの自動再作成（D24）は herdr と異なり本製品独自の挙動
  （herdr は起動時のみ自動作成。空表示 UI を作らずに済ませるための意図的な差異）。
- **CJS/ESM interop の落とし穴**（D40）: `@xterm/headless`・`@xterm/addon-serialize`・`node-pty` は
  minify された CJS バンドルで、named import が Node の実行時に失敗する（vitest/esbuild は素通りする）。
  `Mirror.ts` 等は default import してから分解する形にしてある。**新しい依存を足すときはコンパイル後の
  成果物を実際に `node` で実行して確認すること**（`pnpm build && node dist/smoke.js`）。

## 処理フロー（pane 作成の代表例）

```mermaid
sequenceDiagram
    participant C as Client (WS)
    participant CS as ControlSurface
    participant SS as SessionService
    participant SM as SessionModel
    participant TM as TerminalManager

    C->>CS: workspace.create
    CS->>SS: createWorkspace(cwd, label)
    SS->>SM: reserveWorkspace(...)  Note: まだ Map に入れない
    SS->>TM: create(paneId, opts)   Note: PTY を spawn
    SS->>SS: raceSpawn(host, graceMs) 待つ
    alt spawn 失敗
        SS->>TM: dispose(paneId)
        SS-->>CS: throw RpcError(spawn_failed)
    else 成功
        SS->>SM: commitWorkspace(reserved)  Note: ここで初めて Map へ
        SS->>C: workspace.created / pane.created
        opt 猶予中に code 0 で即終了していた
            SS->>SS: closePaneAfterExit(paneId, 0)
            Note: D18 の連鎖 → D24 の自動再作成
        end
    end
```

## 主要な変更箇所

- `packages/server/src/session/SessionModel.ts` — 状態の中心。`reserveWorkspace`/`commitWorkspace`・
  `reserveTab`/`commitTab`（D43）、`makePane` ヘルパー、`RemovalResult.removedTabIds`（D42）。
- `packages/server/src/session/SessionService.ts` — オーケストレーション。`spawnForPane`/`raceSpawn`/
  `closePaneAfterExit`/`wireExit`（D37・D43）、`recreateIfEmpty`（D24）。
- `packages/server/src/terminal/{Mirror,OutputFanout,TerminalHost,TerminalManager}.ts` — PTY 出力パイプライン。
- `packages/server/src/ws/{WsGateway,WsServer,WsServerWs}.ts` — WebSocket 層。`closeAll`（D43・
  グレースフルシャットダウン）、1MB 超入力フレームの破棄（design「大きすぎる入力」・D43）。
- `packages/server/src/surface/ControlSurface.ts` — RPC dispatch。`NotFoundError` の一元的な読み替え（D43）。
- `packages/server/src/clients/SizeAuthority.ts` — サイズ権限の決定・移譲。
- `packages/server/src/auth/*` — 認証・Origin 検証・レート制限。
- `packages/server/src/persist/*` — `session.json`/`auth.json` の原子的な読み書き（zod での検証。D43）。
- `packages/server/src/composeServer.ts`・`main.ts`・`smoke.ts` — 組み立て（composition root）と起動確認。

## リスク / 確認したい点

- **ブラウザ側の描画・操作（AC4/5/7 の一部）・実機 Windows（AC16）・実ネットワーク越し複数ホスト（AC11）・
  p95 応答性の実測（AC17）は、この subtask の test では検証できていない**
  （`01-server-core/test-result.md`「未検証の穴」に明記。03-web-desktop・04-mobile・05-e2e-docs へ引き継ぐ）。
- review で見つかった指摘は全て修正済み（must 7・should 11・nit 4。`review.md`「ラウンド1〜3」・
  decisions.md D42〜D44）。特に D43 のグレースフルシャットダウン（`composeServer().close()` が
  WebSocket を閉じておらず、ブラウザが繋がったままだと永久にハングしていた）は本番運用で確実に
  踏む不具合だったため、回帰テストを直接追加して確認済み。
