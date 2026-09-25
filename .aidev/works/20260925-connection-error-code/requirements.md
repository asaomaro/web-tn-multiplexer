# 要件: Connection のエラーがコードをプロパティで持つ

## 背景 / 課題

`packages/web/src/net/Connection.ts` はサーバのエラー応答を
`new Error(`${code}: ${message}`)` という文字列で reject し、
`packages/web/src/net/clientError.ts` の `errorCodeOf` が正規表現でその文字列から `code` を
取り出している。書式が変わると（例えばサーバ側のメッセージ文言に `: ` が含まれる等）黙って
`code` の取得に失敗し、汎用の日本語文言に落ちる——利用者には何が起きたか伝わらないまま
静かに劣化する（`.aidev/works/20260920-git-worktree-actions/decisions.md` D4）。D4 では
「本筋の直しは `Connection` が `code` をプロパティとして持つ形」としつつ、その work の
範囲外として backlog に送っていた（`.aidev/backlog/product-roadmap.md`）。

## 目的 / ゴール

`errorCodeOf` が文字列の書式解析に頼らず、構造化された `code` から確実にエラー種別を取得できる
状態にする。既存の呼び出し元（`ActionDispatcher.ts` の worktree 系分岐等）・既存のテストは、
この変更後も無改修で動作し続ける状態を保つ。

## ユーザーストーリー

- US1: web-tn-multiplexer の開発者として、サーバのエラーメッセージの文言が変わっても、`code`
  に基づく分岐（dirty/locked の確認フロー等）が静かに壊れないようにしたい。なぜなら、現状は
  正規表現でのパースに依存しており、書式変更が検知されずに汎用文言へ劣化する（D4 の指摘
  どおり）から。（受け入れ: AC1, AC2）
- US2: 開発者として、既存の振る舞い（メッセージ文言・既存の分岐・既存のテスト）を壊さずに
  この改善を入れたい。なぜなら、これは内部実装の頑健化であって、機能追加ではないから。
  （受け入れ: AC3, AC4, AC5）

## スコープ

### 対象

- `Connection.ts` がサーバのエラー応答（`envelope.error`）を reject する際、`code` を
  プロパティとして持つ `Error` を作る。
- `clientError.ts` の `errorCodeOf` を、`.code` プロパティを最優先で読み、無ければ既存の
  正規表現へフォールバックする形に変える。

### 対象外

- `Error.message` の文字列書式（`${code}: ${message}`）自体を変えること（D4 が言う「本筋」の
  完全な形——`@wtm/protocol` の `RpcError` を採用し `message` から `code` の接頭辞を除くこと）
  はこの work では行わない。`message` 文字列を変えると `Connection.test.ts` の既存
  アサーション・`ActionDispatcher.test.ts` のフェイク実装との整合を大きく崩す割に、得られる
  価値（開発者向けログの見た目が多少整う程度）が小さいため、スコープ外とする（理由は
  decisions.md に記録する）。
- クライアント側で合成されるエラー（`not connected`・`connection closed`）への `code` 付与。
  これらはそもそもサーバ由来の `code` を持たないため対象外。
- 正規表現フォールバックの撤去。この work では `.code` を追加するだけで、フォールバックは
  将来の別 work まで残す（後方互換性の当面の保険として）。

## 機能要件

- `Connection.ts` は、サーバの RPC エラー応答を reject するとき、reject する `Error` に
  `code`（サーバが返した文字列）をプロパティとして持たせる。
- `errorCodeOf` は、渡された値が `code` プロパティ（文字列）を持てばそれを最優先で返し、
  無ければ既存の正規表現によるパースにフォールバックする。

## 非機能要件 / 制約

- 既存の `Error.message` の文字列書式は変更しない（回帰させない）。
- 既存の `errorCodeOf` の呼び出し元（`ActionDispatcher.ts` の worktree 系分岐・
  `worktreeErrorMessage`）は無改修で、この変更後も従来どおり動作する。
- 既存のテスト（`Connection.test.ts`・`clientError.test.ts`・`ActionDispatcher.test.ts`）は
  無改修のまま通る。

## 完了条件 (受け入れ基準)

- [ ] AC1: `Connection.ts` がサーバのエラー応答を reject するとき、reject される `Error` が
  `code`（文字列）プロパティを持つ。
- [ ] AC2: `errorCodeOf` が `.code` プロパティを最優先で読み、それを返す。
- [ ] AC3: `.code` プロパティを持たない従来型のエラー（正規表現書式の文字列のみ）に対しては、
  `errorCodeOf` は既存の正規表現フォールバックで従来どおりの値を返す。
- [ ] AC4: `Error.message` の文字列書式（`${code}: ${message}`）は変更しない。
- [ ] AC5: 既存の `Connection.test.ts`・`clientError.test.ts`・`ActionDispatcher.test.ts` が
  この work の変更後も無改修のまま通る。

## 未確定事項 / 確認したいこと

- なし（backlog 選定時の feasibility 調査で主要な論点は解消済み——上記「スコープ」の「対象外」
  節に理由を記載）。
