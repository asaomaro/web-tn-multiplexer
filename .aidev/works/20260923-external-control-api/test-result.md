# テスト結果: 外部操作 API / CLI（herdr の socket API / CLI 相当）

## 実行したもの

- `pnpm -s build`（全パッケージのビルド） — exit 0
- `pnpm -s typecheck`（全パッケージの型検査） — exit 0
- `pnpm -s test`（全パッケージの単体・統合テスト。vitest） — **2487 passed / 0 failed / 0 skipped**（153 ファイル）
  - うち `packages/cli`：**133 passed**（`main.integration.test.ts` の8件を含む。実サーバ・実 PTY での
    統合テスト。詳細は下記「受け入れ基準ごとの判定」）
- `aidev smoke`（`.aidev/config.yml` の `smokeCommands` 2本。詳細は下記「起動確認」）— GO（2本とも pass）
- `git diff --stat` による AC11 の直接確認（`packages/server/src/http/HttpServer.ts`・
  `packages/server/src/ws/WsServerWs.ts`・`packages/server/src/main.ts` に差分が無いことを確認。
  下記「受け入れ基準ごとの判定」AC11 参照）

## 受け入れ基準ごとの判定

- AC1: pass — `wtmctl workspace create` の統合テスト（`main.integration.test.ts:81-94`）。実サーバで
  workspace/tab/pane が作られ、ID を含む JSON が返ることを確認。
- AC2: pass — `wtmctl pane split` の統合テスト（同ファイル:110-118）。新 pane の ID が既存 pane と異なることを確認。
- AC3: pass — `wtmctl pane input`/`pane run` の統合テスト（同ファイル:120-144）。実 PTY へ `echo <marker>` を
  送り、`pane read` のポーリングで marker が現れることを確認（実プロセスへの到達を実測）。
- AC4: pass — `wtmctl pane read`（`--follow` 無し／あり）の統合テスト（同ファイル:120-144, 146-183）。
  `--follow` は専用サーバでの検証（他クライアントの入力による OUTPUT の継続受信を確認）。
- AC5: pass — `wtmctl snapshot` の統合テスト（同ファイル:96-108）。作成した workspace が含まれることを確認。
- AC6: pass — `wtmctl watch` の統合テスト（同ファイル:185-225）。別クライアント（同一プロセス内の別 WS 接続）
  が起こした `workspace.created` を受け取ることを確認（固定待ち時間ではなく、見えるまで再試行する形）。
- AC7: pass — セッションキャッシュの再利用（同ファイル:96-108 が `/api/login` を呼ばないことを `fetch` の
  スパイで確認）。加えて `packages/cli/src/smoke.ts` が**別プロセス**（子プロセスとして spawn した
  `dist/main.js`）間でのキャッシュ再利用（2回目以降 `--token` 無しで動く）も実測している
  （より実運用に近い確認）。
- AC8: pass — 新規パッケージ `packages/cli` の追加が `pnpm -s build`/`pnpm -s typecheck`/`pnpm -s test`/
  `aidev smoke` のいずれも壊していないことを、本テスト工程で実行して確認した（上記「実行したもの」）。
- AC9: pass — Origin/Host 拒否がこの work の後も既存どおり効くことを、実サーバへの生 `ws` 接続
  （偽の `Origin` ヘッダ）で確認（`main.integration.test.ts:254-267`）。`403` が返ることをログ
  （`origin rejected`）とテストの両方で確認済み。
- AC10: pass — `client.hello.kind: "external"` を追加しても、既存の `desktop`/`mobile` クライアントの
  挙動（`SizeAuthority` の資格判定）に回帰が無いことを、`SizeAuthority.test.ts` の新規テスト
  （T2）で確認（「mobile client without fit」のテストと同じ判定を `external` でも確認）。
  `pnpm -s test` の全件 pass（既存 2406 件 + 本 work の追加分）にも含まれる。
- AC11: pass — `git diff --stat -- packages/server/src/http/HttpServer.ts
  packages/server/src/ws/WsServerWs.ts packages/server/src/main.ts` が**無出力**（差分ゼロ）であることを
  直接確認した。新しい HTTP ルート・新しいポート・新しいソケットを追加していない。
- AC12: pass — `docs/herdr-parity.md` の H38・H39・H40 行が、対応した範囲（H38）と後続 backlog 項目名
  （H39・H40）を反映して更新されていることを目視確認済み（T13）。H41 行は変更していない
  （AGENTS.md の指示どおり）。

## 起動確認（smoke）

```
$ pnpm -s smoke  # 1本目（既存：サーバの起動確認）
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

$ pnpm --filter @wtm/cli run smoke  # 2本目（新規：wtmctl の起動確認）
smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-yJZQtx, sandboxed HOME /tmp/wtmctl-smoke-home-MqAdJl
smoke(cli): server listening on http://127.0.0.1:38760
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS

smoke: pass (exit 0, 2 本)
```

`smokeCommands` を2本に増やした（`.aidev/config.yml`。T14）。2本目は、ビルド済みの `dist/main.js` を
**実際に子プロセスとして起動**し、`HOME`/`USERPROFILE` を一時ディレクトリへ差し替えてセッションキャッシュを
サンドボックスした状態で、`workspace create`→`pane run`→`pane read`→`snapshot` の一巡を確認する
（実行者の実際の `~/.wtmctl/session.json` には触れない）。

## 一式テストの間欠的な失敗と、その解消の確認（decisions.md D21 参照）

`pnpm --filter @wtm/cli exec vitest run` 単体では毎回 pass するのに、root の `pnpm -s test`（全パッケージ
一式）では `main.integration.test.ts` が間欠的に失敗する事象が coding 中に見つかった（`pane read --follow`/
`watch` の WS 接続を明示的に閉じずに残していたことが原因。詳細は decisions.md D21）。修正後、
**`pnpm -s test` を3回連続で実行し、3回とも `Test Files 153 passed / Tests 2487 passed` で再発しないことを
確認した**（本テスト工程の実行分を含め、coding 終盤からここまでで合計5回以上連続 pass している）。

## 未検証の穴（skip / 環境不足）

- **Windows・macOS の実機での動作確認**：requirements.md の「対象外」に明記したとおり、この work の
  スコープに含めていない。`wtmctl` は Node の `fetch`/`ws` だけを使い OS 固有コードを持たないため、
  原理上は動くはずだが、実機での確認はしていない（`docs/verification.md` の対象にも追加していない
  ——スコープ外として明示的に見送った）。
- **本物の別マシン・別ネットワーク越しの接続**（`docs/tls-setup.md` が扱う LAN・TLS 越しの構成）での
  `wtmctl` の動作は確認していない。本 work の統合テスト・smoke はいずれも `127.0.0.1`（ループバック）
  で完結している。既存の `HttpServer`/`WsGateway`/`AuthService`/`OriginPolicy` を無改造で再利用している
  設計（decisions.md D3）から、ループバックで確認できていれば LAN/TLS 越しでも同じ経路が動くと考えられるが、
  実測はしていない。
- **herdr の `send-keys`（論理キー名 → 制御シーケンス変換）相当・4種類の `--source` 分類**（`visible`/
  `recent`/`recent-unwrapped`/`detection`）は、requirements.md の「対象外」のとおり実装していない
  （未検証ではなく、意図して作らなかった範囲）。
