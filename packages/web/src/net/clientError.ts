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
  // worktree（20260920-git-worktree-actions）。git の生の診断は見せず、種類ごとにここで日本語にする。
  not_a_git_repository: "この workspace は Git リポジトリではありません。",
  worktree_branch_in_use: "そのブランチは既に別の場所でチェックアウトされています。別の名前にしてください。",
  worktree_path_exists: "作成先のパスが既にあります。別のブランチ名にしてください。",
  worktree_no_commits: "このリポジトリにはまだコミットが 1 つもないため、worktree を作れません。",
  worktree_invalid_branch: "そのブランチ名は Git が受け付けません（空白などは使えません）。別の名前にしてください。",
  // **「作成」と言い切らない**——一覧の取得の失敗にも同じコードを使うので（`WorktreeService.list`）。
  worktree_failed: "worktree の操作に失敗しました。サーバのログを確かめてください。",
};

/**
 * `Connection` が投げるエラー（`net/Connection.ts`：`new Error(`<code>: <message>`)`）から code を取り出す。
 * **`Connection` 自身は code をプロパティに持たない**ので、書式を読むしかない（decisions.md D4）。
 * 読めなければ null——呼ぶ側は汎用の文言に落とす。
 */
export function errorCodeOf(err: unknown): string | null {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /^([a-z_]+): /.exec(message)?.[1] ?? null;
}

export function clientErrorMessage(code: string): string {
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code as ErrorCode] : `サーバでエラーが起きました（${code}）。`;
}
