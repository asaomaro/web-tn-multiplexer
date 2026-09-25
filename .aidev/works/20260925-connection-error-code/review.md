# レビュー: Connection のエラーがコードをプロパティで持つ

## タスク点検ログ

T1・T2・cross は findings 0 で通過。

## review round1

- [nit][conv:regression-negative-control] `decisions.md` D1・D2: 「元に戻して落ちることを
  確認 → 復元して全件 pass」の生ログはあったが、`.aidev/conventions/
  regression-negative-control.md` が求める「復元後、ファイルが一致することを diff/cmp で
  確認する」記録が無かった。 / 対応: D1・D2 それぞれに、`git diff --numstat` の結果が
  taskcheck 前と同じ値に戻っていることを確認した旨を追記した。 / src: review round1
