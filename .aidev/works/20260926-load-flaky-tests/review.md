# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）

- [should][conv:regression-negative-control] packages/cli/src/session.test.ts 失敗で直列化の鎖が止まる変異（`tail = run`）を捕まえるテストが無い / 対応: 修正済（T1・ラウンド1。「保存が 1 度失敗しても…」を足し、変異で落ちることを確かめた）
- [should][conv:-] packages/cli/src/session.ts Windows の `rename` は置き換え先を別のハンドルが開いていると EPERM 等で失敗しうる（推測） / 対応: 許容（decisions D7。確かめられないので backlog の兄弟と未検証の穴に残す）
- [nit][conv:-] packages/cli/src/session.test.ts AC1 のテストで writer が失敗すると reader が止まらない / 対応: 修正済（T1・ラウンド1。try/finally）
- [nit][conv:-] packages/cli/src/session.ts `load` は ENOENT 以外の読み取りエラーも空とみなす（変更前からの挙動） / 対応: 許容（decisions D7）
- [should][conv:regression-negative-control] packages/server/src/composeServerOnFreePort.ts 失敗時の `server.close()` を消す変異を捕まえるテストが無い / 対応: 修正済（T2・ラウンド1。「待ち受けた後に失敗したら、閉じてから投げる」を足し、変異で落ちることを確かめた）
- [nit][conv:-] packages/server/src/composeServerOnFreePort.ts `host` を角括弧のまま `listen(0)` に渡す / 対応: 修正済（T2・ラウンド1。`unbracketHost`）
- [nit][conv:-] packages/server/src/composeServerOnFreePort.integration.test.ts 取り直しのテスト自身が番号だけ先に取る / 対応: 修正済（T2・ラウンド1。2 回目以降は `getFreePort` に戻し、`taken` でないことを見る）
- [nit][conv:-] packages/server/src/composeServerOnFreePort.integration.test.ts コメントの「composeServer のファイルの既定と同じ」がまだ事実でない / 対応: 修正済（T5 で composeServer.integration に 15 秒の既定を入れる。コメントは D5 を指す形に直した）
- [should][conv:-] packages/server/src/composeServer.integration.test.ts 置き換えで残った未使用の `port`・`port1`・`port2`（5 か所） / 対応: 修正済（T3・ラウンド1）
- [should][conv:-] packages/server/src/ws/WsGateway.integration.test.ts・http/HttpServer.integration.test.ts `getFreePort` を消して使われなくなった import / 対応: 修正済（T3・ラウンド1）
- [nit][conv:-] packages/server/src/http/HttpServer.integration.test.ts 消した手順を説明する JSDoc が `startServer` に残った / 対応: 修正済（T3・ラウンド1）
- [should][conv:-] packages/server/src/composeServerOnFreePort.integration.test.ts 上限 15 秒が実測に基づかない（cross） / 対応: 修正済（cross・ラウンド1。条件 C で測り直して 10 秒。decisions D8）
- [nit][conv:-] 時間の上限のコメントの decisions の参照に work 名が無いものが混じる（cross） / 対応: 修正済（cross・ラウンド1）

## ラウンド 1（2026-09-27。別コンテキストの opus に委譲。must 0・should 0・nit 7）

- [nit][conv:-] packages/server/src/composeServerOnFreePort.ts:50 新規 2 ファイルと HEAD で整形済みの packages/cli/src/session.test.ts・packages/server/src/testkit.ts が prettier を通らない / 対応: 修正済（`prettier --write` を新規か HEAD で整形済みのファイルにだけ当てた）
- [nit][conv:-] .aidev/works/20260926-load-flaky-tests/decisions.md:47 D3 の影響に testkit の export が「2 つ」とあるが実際は 3 つ（test-result の AC9 と食い違う） / 対応: 修正済（既存エントリは書き換えず D10 で訂正を追記）
- [nit][conv:-] packages/server/src/git/GitInfoPoller.test.ts:408 同じ describe の `vi.waitFor(() => expect(runs).toContain(repoA))` が既定の 1 秒のまま（start 直後に記録されるので実害は小さい） / 対応: 許容（D10）
- [nit][conv:-] packages/cli/src/main.integration.test.ts:155 `--follow` の it の中の待ち（5 秒＋8 秒）が上限 20 秒の半分を超える（上限を据え置いた it なので D5 の規則の対象外） / 対応: 許容（D10 に「規則を当てるのは上限を変えた it だけ」と明記）
- [nit][conv:-] packages/cli/src/session.test.ts:97 AC1 の読み手が `get` だけで生の `readFile`＋`JSON.parse` が無い・コメントの「別のインスタンスだから鎖の外」が不正確 / 対応: 許容（負の確認で 5/5 落ちるので検出力は足りている。D10）
- [nit][conv:-] packages/cli/src/session.ts:94 session.json がシンボリックリンクだと `rename` でリンク自体を通常ファイルに置き換える（server の writeFileAtomic と同じ振る舞い） / 対応: 許容（既知の制約として D10 に残す）
- [nit][conv:-] packages/server/src/composeServerOnFreePort.ts:26 `listenOnFreePort` は compose と関係が無いのに同じファイルに同居 / 対応: 許容（D10）

要件適合（AC1〜AC10）・価値適合・負の確認（test-result の生ログ）・serializeUpdate と composeServerOnFreePort の正確性は問題なし。
この差分が持ち込んだものではない既存の欠陥 2 件は backlog へ回した（main.integration の `captureStdout().restore()` が finally に無い・attach.integration の no-control-regex）。
