# レビュー: レイアウト操作後のグローバル focus の更新

## タスク点検ログ

- [should][conv:-] T1（`swapPaneWith`・`moveToEdge`）: `swapPaneWith` には失敗パス
  （`paneId === otherPaneId`）で `this.focus` が変わらないことを確認するテストがあったが、
  `moveToEdge` には対称なテストが無かった。 / 対応: `moveToEdge` にも「失敗（自分自身の縁）
  では、グローバル focus を変えない」テストを追加した。 / src: T1 taskcheck round1
- [should][conv:-] cross（全5メソッド）: `swapPaneWith`・`moveToEdge` だけが失敗パスで
  `this.focus` が変わらないことを確認するテストを持ち、`replacePane`・`moveToTab`・
  `moveToNewTab` には対称なテストが無かった（コード自体は5メソッドとも早期 return で
  `this.focus` に触れておらず、機能上のバグではない——テストカバレッジの非対称）。
  / 対応: `replacePane`・`moveToTab`・`moveToNewTab` それぞれの失敗パステストの直後に、
  同じ観点の focus 不変テストを追加した。 / src: cross-task check round1

## review round1

- [nit][conv:-] requirements.md「対象外」は `closeEmptyTabShell` の広い潜在的不具合の
  スコープ外判断について「理由を decisions.md に記録し」と明記していたが、実際の記録は
  design.md にのみあり decisions.md に対応するエントリが無かった。 / 対応: decisions.md に
  D0 として、この判断の背景・決定・理由・影響（backlog への追加は deliver 工程で行う旨）を
  追記した。 / src: review round1

WALKTHROUGH: 不要（SessionModel.ts 1ファイル・5メソッドへの1行追加＋1箇所の呼び出し順
入れ替えに閉じており、cross-module ではない。review が確認済み）。
