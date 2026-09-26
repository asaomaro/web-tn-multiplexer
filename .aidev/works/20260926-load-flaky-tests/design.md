# 仕様: 高負荷のときだけ落ちる単体・結合テストをなくす

## 概要

原因は 3 種類に分かれる（research.md F1〜F12）。

1. **製品の不具合**: `wtmctl` のセッションキャッシュ（`FsSessionStore`）が、書き込みの途中を読ませ、同じプロセス内の同時の保存で
   片方を失う。`main.integration.test.ts` の AC9 はこれで落ちていた（負荷と無関係）。→ 製品を直し、回帰テストを足す。
2. **資源の取り方**: 空きポートを「番号だけ取って閉じ、後で listen」する。→ 組み立て直して取り直す共通の手段（`composeServer` 系）と、
   `listen(0)` の結果を使う形（自分で `http.Server` を listen させる系）に替える。
3. **時間の上限**: 実サーバ・実 PTY・実 git・画面全体の描画を行う `it` が、既定の 5000ms（または中の待ちと同じ長さ）しか持たない。
   → 重い理由を確かめたテスト（ファイル）にだけ、負荷の下の実測に基づく上限を与える。

## 設計方針

### 1. `FsSessionStore`（製品）

- **書き込みを原子的にする**: 同じディレクトリに一時ファイル（`mkdtemp(<dir>/.tmp-)` の中の `write`）を作って書き、`chmod 0600`
  （Windows 以外）→ `rename` で置き換え、一時ディレクトリを消す。server の `writeFileAtomic`（`packages/server/src/persist/atomicFile.ts:9-23`）
  と同じ形。cli は server に実行時の依存を持たない（`packages/cli/package.json`）ので、関数を cli 側に置く（写す）。
  → 読み手（同じプロセスでも別のプロセスでも）は、置き換えの前か後の完全な内容だけを読む。
- **読む→変える→書くを直列化する**: モジュールに `Map<ファイルパス, Promise<void>>` の鎖を持ち、`set`/`clear` をファイルパスごとに
  順に実行する（同じパスを指す別のインスタンスも同じ鎖に乗る）。`get` は鎖に乗せない（原子的な置き換えで途中を読まないため）。
- **採らない案**: プロセスをまたぐ排他（ロックファイル）。別プロセス同士が**同時に保存**したときの後勝ち（別の origin の 1 件が消え、
  次の操作で再ログインを求める）は残るが、「空を読んで全部消す」は原子的な置き換えで消える。影響の大きさに比べて、ロックの残骸・
  Windows の扱いのほうが重い（backlog の兄弟に残す）。

### 2. 空きポート

- **`composeServer` を待ち受けさせるテスト**: `composeServerOnFreePort(args, opts)` を server に置き、`testkit.ts` から出す（cli のテストが
  使う）。空きポートを選んで組み立て、`opts.start`（既定は `server.listen()`）を呼び、**`EADDRINUSE` で失敗したら閉じて組み立て直す**
  （既定 5 回）。それ以外の失敗は閉じて投げ直す。
  - **`listen(0)` の結果を使う形を採らない理由**（requirements の未確定事項）: `composeServer` のポートは組み立ての時点で Origin の
    許可リスト（`DefaultOriginPolicy`）に渡り、`port: "0"` は `parsePort` が設定の誤りとして断る（既存のテスト `config.test.ts:71-73`）。
    `listen(0)` を通すには `wtm serve --port 0` の意味（利用者に見える CLI の振る舞い）を変えることになり、「API への影響は最小限に」
    の制約に反する。取り直しは、失敗した `listen()` が状態を残さない（research F7）ので安全にやり直せる。
  - 取り直しても**テストが確かめる内容は変わらない**: 組み立てと待ち受けの間に何かを挟むテスト（D103 #1 の token reset・D102 の 503）は、
    その処理を `opts.start` に入れて**取り直すたびに最初からやり直す**。
  - わざと `EADDRINUSE` を起こすテスト（blocker を listen させる D101・D102・D103 の各 `it`）と、2 つ目がロックで断られることを見る
    `it`（bind しない）は、この手段を使わない（確かめている内容が消えるため）。
- **自分で `http.Server` を listen させるテスト**（`WsGateway.integration.test.ts`・`HttpServer.integration.test.ts`）: `listen(0, host)` で
  待ち受け、`address().port` を読んで、Origin の方針に渡した**同じ `opts` オブジェクト**の `port` を書き換える
  （`DefaultOriginPolicy` は検査のたびに `this.opts.port` を読む。`OriginPolicy.ts:33-34`）。取り合いそのものが起きない。

### 3. 時間の上限

- **規則（1 つ）**: 上限を与える**単位**（`it`・`describe`・ファイル）ごとに、その単位に含まれる `it` の「負荷の下の所要の最大」m を取り、
  今の上限が 2m に満たなければ、上限を **2m 以上の 5 秒単位の切り上げ**にする。m は着手前の負荷の実行すべて（条件 C の `preC-*`・
  `measC-*`、条件 F の `pre-b4-*`。`runs/*.json`）の最大で、**時間切れで落ちた回はその時点の所要**を数える（`maxdur.py`）。
  `it` の中の待ち（`waitForEvent`・`vi.waitFor`）は、`it` の上限の半分に置く（今は待ちと `it` の上限が同じか近く、待ちが自分の締め切りに
  届く前に `it` が時間切れになる）。
- **単位の選び方**: どの `it` も同じ重いもの（`App`／`SettingsDialog` を丸ごと描く）を持つ web の 3 ファイルは**ファイル**（`vi.setConfig`）。
  `it` ごとに重さが違い、既に `it` ごとの上限を持つ cli の `main.integration`・server の `composeServer.integration` は **`it`**（上限を持たない
  `it` をまとめて扱うため、`composeServer.integration` だけファイルの既定も置く）。`GitInfoPoller` は追従の **`describe`**。
- **値**（m → 値。m の出所は research F11 と `maxdur.py` の出力。test-result.md に貼る）:

  | 単位 | m（ms） | 今 | 値 |
  |---|---|---|---|
  | cli `main.integration` workspace create（81 行） | 4437 | 5 秒（既定） | 10 秒 |
  | cli `main.integration` watch（185 行） | 15109（落ちた回） | 15 秒 | 35 秒 |
  | cli `main.integration` そのほか | `--follow` 9570・pane run 4523・split 2312・login 2146 ほか | 5〜20 秒 | 変えない（2m 以下） |
  | server `composeServer.integration` ファイルの既定 | 上限を持たない `it` の最大は D103 #1 の 5292（落ちた回） | 5 秒（既定） | 15 秒 |
  | server `composeServer.integration` `--session work`（68 行） | 15654 | 20 秒 | 35 秒 |
  | server `composeServer.integration` 偽の claude（646 行） | 12519（落ちた回） | 15 秒・待ち 8 秒 | 30 秒・待ち 15 秒 |
  | server `composeServer.integration` persists（448 行） | 5082 | 10 秒 | 15 秒 |
  | server `GitInfoPoller` 追従の `describe`（225 行） | 6322（落ちた回） | 5 秒（既定）・待ち 5 秒 | 15 秒・`{ timeout: 5000 }` の待ち 7.5 秒 |
  | web `App.test.ts` | 6266（落ちた回） | 5 秒（既定） | 15 秒 |
  | web `SettingsDialog.test.ts` | 5650（落ちた回） | 5 秒（既定） | 15 秒 |
  | web `SettingsDialog.symbolsNote.test.ts` | 3270 | 5 秒（既定） | 10 秒 |

  `composeServer.integration` のほかの明示の上限（10・15・20 秒）は 2m 以上ある（`maxdur.py` の出力で確かめた）。
- 一律（ルートや project の `testTimeout`）には上げない。

### 負荷の条件（修正前・修正後の比較）

- 条件 C: busy loop（`sh -c 'while :; do :; done'`）を 12 本（コア数と同じ）走らせ、15 秒後に対象の 6 ファイル（`main.integration`・
  `composeServer.integration`・`GitInfoPoller`・`App`・`SettingsDialog`・`SettingsDialog.symbolsNote` の各 test）だけを `npx vitest run`
  で流す。load average の推移を 10 秒ごとに記録し、終わったら busy loop を止める（`loadrun.sh`）。
- 条件 F: busy loop 4 本＋全体テスト（`npx vitest run`）。
- 修正前: 条件 C を 6 回（6 回とも落ちた）・条件 F を 4 回（2 回落ちた）。着手前に実施済み（research F10）。修正後: 同じ回数以上。

## 対象範囲

- 製品: `packages/cli/src/session.ts`
- テスト: `packages/cli/src/session.test.ts`・`main.integration.test.ts`・`agent.integration.test.ts`・`agentPrompt.integration.test.ts`・
  `attach.integration.test.ts`・`wsClient.test.ts`／`packages/server/src/composeServerOnFreePort.ts`（新規）・同 `.test.ts`（新規）・
  `testkit.ts`・`composeServer.integration.test.ts`・`ws/WsGateway.integration.test.ts`・`http/HttpServer.integration.test.ts`・
  `git/GitInfoPoller.test.ts`／`packages/web/src/App.test.ts`・`components/SettingsDialog.test.ts`・`components/SettingsDialog.symbolsNote.test.ts`

## 依拠する既存の事実

- `FsSessionStore.save` は `writeFile` で直接書く・`load` は読めなければ空を返す（`packages/cli/src/session.ts` `save`・`load`）。research F1・F2。
- server の原子的な書き込みの形（`packages/server/src/persist/atomicFile.ts:9-23` `writeFileAtomic`）。
- cli は server に実行時の依存を持たない（`packages/cli/package.json` の `dependencies` は `@wtm/protocol`・`ws` だけ。`@wtm/server` は `devDependencies`）。
- cli のテストは `@wtm/server` を `dist/testkit.js` 経由で使う（`packages/server/package.json` の `main`）。
- `composeServer` のポートの扱い（`packages/server/src/config.ts` `parsePort`・`config.test.ts:71-73`・`composeServer.ts:111-114`）。research F6。
- 待ち受けに失敗した `listen()` は状態を残さず、`close()` を呼んでよい（`composeServer.integration.test.ts` の D101・D102・D103 の `it`）。research F7。
- `DefaultOriginPolicy` は `opts.port` を検査のたびに読む（`packages/server/src/auth/OriginPolicy.ts:33-34`）。research F8。
- `vi.setConfig` はそのファイルにだけ効く（**未確認**——型定義の説明は「Updates runtime config」だけ。coding で、別のファイルの `it` が
  5000ms のままであることを確かめ、効く範囲がファイルを越えるなら `afterAll(vi.resetConfig)` を足す）。
- `ComposedServer` は `options`（`port` を含む `ServeOptions`）・`listen()`・`close()` を持つ（`packages/server/src/composeServer.ts:44-70`）。
  `RawServeArgs` は `host?`・`port?`（文字列）ほかを持つ（`packages/server/src/config.ts:32-43`）。

## インターフェース / データ構造

```ts
// packages/server/src/composeServerOnFreePort.ts（testkit から export）
export function getFreePort(host?: string): Promise<number>;
export interface ComposeOnFreePortOptions {
  /** 待ち受けの手順（既定: server.listen()）。組み立てと待ち受けの間に何かを挟むテストが渡す。取り直すたびに呼ばれる。 */
  start?: (server: ComposedServer, port: number) => Promise<void>;
  /** 取り直す回数の上限（既定 5）。 */
  attempts?: number;
  /** 空きポートの選び方（既定 getFreePort）。取り直しを確かめるテストが差し替える。 */
  pickPort?: (host: string) => Promise<number>;
}
export function composeServerOnFreePort(args: Omit<RawServeArgs, "port">, opts?: ComposeOnFreePortOptions): Promise<ComposedServer>;
```

- 戻り値の `server.options.port` が実際に待ち受けたポート。
- `FsSessionStore` の公開面（`get`/`set`/`clear`・コンストラクタ）は変えない。

## 振る舞いの詳細

- `composeServerOnFreePort`: `for attempt in 1..attempts`: `port = await pickPort(host)` → `server = await composeServer({ ...args, port: String(port) })`
  → `try { await start(server, port); return server } catch (err) { await server.close().catch(() => undefined); if (!EADDRINUSE(err) || 最後) throw err }`。
  `EADDRINUSE` の判定は `err.code === "EADDRINUSE"`。`host` は `args.host ?? "127.0.0.1"`。
- `FsSessionStore.set`/`clear`: `serialize(filePath, async () => { load → 変更 → saveAtomic })`。鎖の前の要素が失敗しても次は走る
  （`prev.catch(() => {})` に繋ぐ）。呼び出し元には自分の結果（成功・失敗）を返す。

## ドメイン固有の考慮

- セッションキャッシュのファイル・ディレクトリの権限（0600／0700）は今と同じ（一時ファイルに 0600 を付けてから `rename`）。
- 3 OS: `mkdtemp`・`writeFile`・`chmod`（win32 以外）・`rename`・`rm` だけを使う。

## エラー処理 / 異常系

- 一時ファイルへの書き込み・`rename` の失敗は、今の `writeFile` の失敗と同じく `set`/`clear` の reject として返す。一時ディレクトリは
  `finally` で消す（失敗は握りつぶす）。
- `composeServerOnFreePort` が上限まで取り直しても `EADDRINUSE` なら、最後のエラーを投げる。

## 受け入れ基準との対応

- AC1: `session.test.ts` に「書き込みと並行した読み取りが、書き込み前後のどちらかを読む（別の origin の cookie が常に読める）」を足す。
  入力は同じファイルへの `set` の連続（書き手）と `get`・生の `readFile`＋`JSON.parse`（読み手）。修正を戻して落ちる出力を test-result.md に貼る。
- AC2: `session.test.ts` に「2 つの origin を `Promise.all` で同時に `set` して両方残る」「同じパスの別インスタンスでも残る」を足す。負の確認も同じ。
- AC3: `main.integration.test.ts` を単独で 20 回（修正前・修正後）。修正前は着手前に 20 回流して 2 回落ちた（research F12）。
- AC4: `composeServerOnFreePort.test.ts` で、最初に選ぶポートを blocker が使っている状態（`pickPort` を差し替え）から待ち受けに成功すること、
  `EADDRINUSE` 以外の失敗は取り直さないこと、上限で諦めることを確かめる。置き換える先: `composeServerOnFreePort` を使うのは
  server の `composeServer.integration.test.ts` と cli の `main`・`agent`・`agentPrompt`・`attach` の `*.integration.test.ts`・`wsClient.test.ts`、
  `listen(0)` を使うのは server の `ws/WsGateway.integration.test.ts`・`http/HttpServer.integration.test.ts`。
- AC5: 上の「3. 時間の上限」。実測値と選んだ値を decisions.md に記録する。
- AC6: 「負荷の条件」の C・F を修正後に同じ回数以上流し、生の出力（summary・失敗の抜粋・load の推移）を test-result.md に貼る。
- AC7: `git diff` で対象のテストファイルの `expect(`・`it(`（`it.each` 等を含む）の数を修正前後で数えて示す。
- AC8: test 工程で `pnpm -s build` → `pnpm -s typecheck` → `pnpm -s test`（2 回）→ `aidev smoke` を打ち、それぞれ `> file 2>&1; echo $?` で
  終了コードを残す。
- AC9: 公開 API の差分は `testkit.ts` への export の追加だけ（`wtm serve`・`composeServer` は変えない）。`git diff` で示す。
- AC10: `FsSessionStore` の書き込みは「ドメイン固有の考慮」に挙げた API（`mkdtemp`・`writeFile`・`chmod`（win32 以外）・`rename`・`rm`）だけ。
  Windows は未検証の穴として test-result.md に残す。
