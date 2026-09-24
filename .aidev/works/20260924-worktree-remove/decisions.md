# 決定記録

## D1: `ConfirmDialog.vue` の確定ボタンの文言を、worktree の削除系だけ「削除」にする

- 背景: design.md のインターフェース節は `confirm()`/`cancel()`/`message` の分岐だけを示しており、
  確定ボタンの文言（テンプレートの `<button>閉じる</button>`）には触れていなかった。実装時に
  気付いた——このボタンは `confirmClose`/`confirmReplacePane` 向けに「閉じる」固定で書かれており、
  worktree の削除（ディスク上の checkout を実際に消す、より破壊性の高い操作）にそのまま流用すると、
  「閉じる」という文言が実際の操作（削除）を正しく表さない。
- 決定: `confirmLabel`（computed）を追加し、`kind` が `confirmWorktreeRemove`/
  `confirmWorktreeRemoveForce` のときだけボタンの文言を「削除」にする。それ以外
  （`confirmClose`/`confirmReplacePane`）は従来どおり「閉じる」のまま。
- 理由 / 代替案: 「常に『閉じる』のまま変えない」案も検討したが、requirements の非機能要件
  「破壊的操作なので確認を経ずに実行しない」の趣旨（操作の意味が利用者に正しく伝わること）に
  照らすと、ボタンの文言が操作の性質と食い違うのは望ましくない。`message` の文面（「削除しますか」）
  と揃える方が一貫している。
- 影響: `packages/web/src/components/ConfirmDialog.vue`（T7）のみ。design.md の当該箇所は
  この決定を反映した実装と読み替える。requirements/design の受け入れ基準・AC の対応には
  影響しない（AC-I1〜AC-I5 のいずれも文言そのものは規定していない）。
