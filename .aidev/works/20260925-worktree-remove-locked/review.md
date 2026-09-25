# レビュー: ロック済み worktree の削除

## タスク点検ログ

- [should][conv:regression-negative-control] T2（`WorktreeService.ts`）: `decisions.md` D1 の
  負の確認ログに、「元に戻したあとファイルが一致することを確認した」という記録が無かった
  （テストが通ることの確認はあったが、規約が求める別項目）。 / 対応: `decisions.md` D1 に、
  `git diff --stat` で復元後の差分サイズが taskcheck 前と一致することを確認した旨を追記した。
  / src: T2 taskcheck round1

- [should][conv:-] T6（`ConfirmDialog.test.ts`）: 「reason: locked でも y キーで確定・n キーで
  取り消す（AC-I3）」というテスト名だったが、本体は `y` キーの確定パスしか叩いておらず、`n`
  キーでの取り消しを一度もトリガー・検証していない見せかけの検証だった。 / 対応: テストを
  `y` キー確定のみのテストに改題し、`n` キーの取り消し（`openWorktree` が呼ばれ
  `confirmWorktreeRemoveForce` は呼ばれない）を検証する別テストを新設した。 / src: T6 taskcheck
  round1

T1・T4 は findings 0 で通過。
