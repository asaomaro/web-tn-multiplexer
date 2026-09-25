# 仕様: Connection のエラーがコードをプロパティで持つ

## 概要

`Connection.ts` の `handleText` は、サーバの RPC エラー応答（`envelope.error`。既に
`{ code: string; message: string }` という構造化された形でサーバから届く）を、
`new Error(`${code}: ${message}`)` という単一の文字列に潰してから reject している。
`clientError.ts` の `errorCodeOf` はこの文字列を正規表現でパースし直して `code` を取り出す。

この work では、`envelope.error` を文字列に潰す際に **`code` を `Error` のプロパティとしても
残す**（`message` の文字列書式は変えない）。`errorCodeOf` は `.code` プロパティを最優先で読み、
無ければ既存の正規表現へフォールバックする。これにより、`code` の取得が文字列書式に依存しなく
なり、既存の呼び出し元・既存のテストは無改修のまま動作し続ける。

## 設計方針

- **`Error` をサブクラス化しない。素の `Error` に `code` プロパティを生やす**（`Object.assign`
  等）。`@wtm/protocol` に既存の `RpcError` クラスがあり検討したが、その `code` の型は
  サーバ側の判別可能な union `ErrorCode` を要求する一方、`Connection.ts` が受け取る
  `envelope.error.code` の型は `string`（サーバから見て web は未知の `code` も届きうる
  ——将来サーバが新しい `code` を足しても web 側の型定義更新を待たずに届く、という既存の
  設計を壊さない）。`RpcError` を使うには `as ErrorCode` の型アサーションが要り、web 側の
  型の緩さ（`errorCodeOf` の戻り値も `string | null`）と噛み合わない。プロパティを生やす
  だけなら、この型の緩さを保ったまま `code` を運べる。
  - 代替案（`RpcError` を採用し `message` から `${code}: ` の接頭辞を除く）は退けた——
    `Connection.test.ts` の既存アサーション（`rejects.toThrow(/not_found/)`）が `message`
    に依存しており、書き換えを要する。得られる価値（開発者向けログの整形）に対して
    変更範囲が不釣り合いに大きい（requirements.md「スコープ / 対象外」）。
- **`errorCodeOf` は `.code` 優先＋既存の正規表現フォールバックの順に変える**。フォールバックを
  残すことで、`.code` を持たない値（`Connection.ts` の他の2箇所——`not connected`・
  `connection closed`——が投げる素の `Error`、および `ActionDispatcher.test.ts` のフェイクが
  独自に組み立てる文字列）は従来どおり動作する。

## 対象範囲

- `packages/web/src/net/Connection.ts`（`handleText` の該当箇所）
- `packages/web/src/net/Connection.test.ts`（新規テスト追加）
- `packages/web/src/net/clientError.ts`（`errorCodeOf`）
- `packages/web/src/net/clientError.test.ts`（新規テスト追加）

## 依拠する既存の事実

- `Connection.ts:288` の型定義: `const envelope = msg as { id: string; result?: unknown;
  error?: { code: string; message: string } };`——サーバのエラー応答は届いた時点で `code` と
  `message` が既に別フィールド。
- `Connection.ts:292-293`:
  ```ts
  if (envelope.error) {
    pending.reject(new Error(`${envelope.error.code}: ${envelope.error.message}`));
  }
  ```
  この1行が、構造化された `code`/`message` を単一の文字列に潰している箇所（今回変更する）。
- `Connection.ts` の他の reject 箇所（`code` を持たない。変更対象外）:
  `request()` の `not connected (method=${method})`（146-150行）、`handleClose()` の
  `"connection closed"`（330-333行）。
- `clientError.ts:43-46`:
  ```ts
  export function errorCodeOf(err: unknown): string | null {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
    return /^([a-z_]+): /.exec(message)?.[1] ?? null;
  }
  ```
- `errorCodeOf` の呼び出し元は `ActionDispatcher.ts:26`（import）・`:355`
  （`sendWorktreeRemove` の catch）・`:1120`（`worktreeErrorMessage`。`newWorktree`/
  `openWorktree`/`confirmWorktreeCreate` 等、複数の catch から使われる）。いずれも
  `errorCodeOf(err)` の戻り値（`string | null`）だけを見ており、`err` 自体の型・追加
  プロパティの有無には依存しない——`.code` を追加しても呼び出し元は無改修で動く。
- `ActionDispatcher.test.ts:33-45` 付近のフェイク `ConnectionPort` は、`Connection` 本体とは
  独立に `new Error(`${code}: from server`)` という同じ文字列書式を自前で再現しており、
  `Connection.ts` を直しても自動的には追随しない（`.code` を持たないまま）——
  `errorCodeOf` の正規表現フォールバックが効き続けるので、このフェイクは無改修のまま
  動作し続ける（回帰しない）。
- `@wtm/protocol` の `RpcError`（`packages/protocol/src/errors.ts:29-30`）: `readonly code:
  ErrorCode` を持つ `Error` のサブクラス。`packages/server/src` 配下で `RpcError` を import
  している実装ファイルは8件（`grep -rln "RpcError" packages/server/src` で確認）——
  `ControlSurface.ts`・`SessionService.ts`・`WorktreeService.ts` 等、サーバ側の複数レイヤーで
  使われている。web 側は未採用（上記「設計方針」で理由を記載）。

## インターフェース / データ構造

### `packages/web/src/net/Connection.ts`

```ts
if (envelope.error) {
  const err = new Error(`${envelope.error.code}: ${envelope.error.message}`);
  Object.assign(err, { code: envelope.error.code });
  pending.reject(err);
}
```

`message` の文字列は完全に従来どおり。`code` プロパティが1つ追加されるだけ。

### `packages/web/src/net/clientError.ts`

```ts
export function errorCodeOf(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /^([a-z_]+): /.exec(message)?.[1] ?? null;
}
```

## 振る舞いの詳細

- サーバの RPC エラー応答 → `Connection.ts` が `code` プロパティ付きの `Error` で reject
  → `errorCodeOf` が `.code` を最優先で読み、正規表現を経由せずに直接返す（AC1・AC2）。
- `.code` を持たない値（クライアント側合成のエラー・既存のテストフェイク）→ `errorCodeOf` は
  従来どおり正規表現フォールバックで判定する（AC3）。
- `message` の文字列内容・書式は一切変わらない（AC4）。既存のログ・既存のアサーションに
  影響しない。
- `ActionDispatcher.ts` の分岐（`code === "worktree_dirty"` 等）は `errorCodeOf(err)` の
  戻り値だけを見ているので、`.code` 経由でも正規表現経由でも同じ結果になり、無改修で動く
  （AC5）。

## ドメイン固有の考慮

- 該当なし（herdr との機能差ではなく、内部実装の頑健化）。

## エラー処理 / 異常系

- `envelope.error.code` がサーバから届かない・空文字列等の異常値であっても、`Object.assign`
  はそのまま代入するだけで例外を投げない。`errorCodeOf` 側は `typeof code === "string"` を
  確認してから返すので、空文字列は「truthy でない code」として正規表現フォールバックには
  落ちない（空文字列は `typeof === "string"` を満たすため、`.code` の値がそのまま
  `errorCodeOf` の戻り値になる——これは既存の正規表現パースでも空文字列に近い結果は
  区別されないため、新たに弱くなる挙動ではない）。この事象は理論上の入力であり、サーバが
  実際に空の `code` を返すことは無い（`RpcError` のコンストラクタは `ErrorCode` union の
  非空文字列のみを受け付ける）。

## 受け入れ基準との対応

- AC1: `Connection.ts` の `handleText` を、`Object.assign` で `code` プロパティを付与する
  形に変更する（入力: サーバの RPC エラー応答の `envelope.error.code`。依拠する既存の事実、
  `Connection.ts:288` 参照）。
- AC2: `errorCodeOf` を `.code` 優先の判定に変更する（入力: `errorCodeOf` に渡される値。
  依拠する既存の事実、`clientError.ts:43-46` 参照）。
- AC3: `errorCodeOf` の正規表現フォールバックをコードとして残す（入力: `.code` を持たない値。
  `ActionDispatcher.test.ts` のフェイク `ConnectionPort` が該当——依拠する既存の事実、
  `ActionDispatcher.test.ts:33-45` 参照）。このフェイクが無改修のまま通ることで確認する。
- AC4: `Connection.ts` の変更で `message` の文字列組み立て（入力: `envelope.error.code`/
  `envelope.error.message`。依拠する既存の事実、`Connection.ts:288` 参照）のテンプレート
  リテラル部分は変更しない。
- AC5: `Connection.test.ts`・`clientError.test.ts`・`ActionDispatcher.test.ts`（入力: 各
  ファイルの既存テストケース。対象範囲、参照）の既存テストが
  無改修のまま通ることで確認する（test 工程で最終確認）。
