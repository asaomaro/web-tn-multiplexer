import type { ErrorCode } from "@wtm/protocol";

/**
 * サーバの `client.error`（要求 id の無いフレームへの通知。design「WebSocket の通信」のイベント表）を、利用者に見せる
 * 日本語の文言にする（D107。統合 review ラウンド1 で発見：以前はサーバの英語の固定文 `message`——「malformed frame」
 * 等——をそのまま toast に出していた）。`message` は使わず `code`（design「エラーコード」）で引く。知らない code は
 * 汎用の文言にその code を添える（サーバが先に新しい code を足しても、何が起きたかの手がかりを残す）。
 *
 * 今のサーバが `client.error` で送るのは `invalid_params` だけ（`WsGateway.registerInvalidFrame`：解析できない JSON・
 * id／method の無い JSON・不正なバイナリ・INPUT 以外のバイナリ・1MB を超える INPUT）。この Web が送るフレームで実際に
 * 起きうるのは、1 回で 1MB を超える貼り付け（その INPUT はサーバが捨てる。design「大きすぎる入力（1MB 超）」）。
 */
const MESSAGES: Record<ErrorCode, string> = {
  invalid_params: "送った内容をサーバが受け付けませんでした（1 回の貼り付けが 1MB を超えた等）。その分は端末に届いていません。",
  unauthorized: "ログインが無効になったため、サーバが受け付けませんでした。",
  not_found: "対象が見つかりませんでした（既に閉じられた pane・tab 等）。",
  spawn_failed: "シェルを起動できませんでした。",
  internal: "サーバの内部でエラーが起きました。サーバのログを確かめてください。",
};

export function clientErrorMessage(code: string): string {
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code as ErrorCode] : `サーバでエラーが起きました（${code}）。`;
}
