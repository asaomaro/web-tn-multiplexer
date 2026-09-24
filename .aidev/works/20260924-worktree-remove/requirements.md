# 要件: worktree の削除

## 背景 / 課題

`20260920-git-worktree-actions` で worktree の作成（`worktree.create`）と一覧・開く
（`worktree.list`/`worktree.open` 相当の `confirmWorktreeOpen`）を実装したが、削除はその work の
対象外として明記されたまま残っている（`WorktreeService.ts:10`「**削除はこの work の対象外**」）。
結果、利用者は一度作った worktree checkout を UI から片付けられない。特に「時間切れ等で登録だけ
残った中途半端な worktree」（`worktree.create` の途中でクライアントが切断された等）は、`git`
コマンドを直接叩く以外に消す手段が無い。

herdr には対応する機能（`worktree.remove` API・context メニューの「Delete worktree
checkout...」・dirty 時の `--force` 確認）が既にある。web-tn-multiplexer 側の欠落を埋める。

## 目的 / ゴール

利用者が、ブラウザの操作だけで不要になった worktree checkout を安全に片付けられる状態にする。
具体的には:

- 現在 workspace として開いている worktree も、開いていない（登録だけ残った・作成後に一度も
  開かれていない）worktree も、どちらも UI から削除できる状態。
- 未コミットの変更が残っている worktree を、意図せず・気付かずに削除できない状態
  （かつ、意図すれば削除できる状態）。

## ユーザーストーリー

- US1: web-tn-multiplexer の利用者として、もう使わない worktree checkout を一覧から削除したい。
  なぜなら、ディスク上に残り続ける中途半端な checkout（ブランチだけ残る・レビュー用の一時
  ブランチ等）を、`git worktree remove` を手で叩かずに片付けたいから。（受け入れ: AC1, AC2, AC3）
- US2: 利用者として、削除しようとした worktree がまだ workspace として開かれている場合、
  何が起きるか（その workspace が閉じられること）を確認してから進めたい。なぜなら、動いている
  プロセスやスクロールバックを持つ workspace を、気付かずに消してしまうことを避けたいから。
  （受け入れ: AC4, AC5）
- US3: 利用者として、未コミットの変更が残っている worktree を削除しようとしたとき、その旨を
  知らされたうえで、それでも削除するか選びたい。なぜなら、変更を失うことになると気付かないまま
  削除してしまう事故を避けたいが、レビュー後の使い捨てブランチ等、意図して破棄したい場面もある
  から。（受け入れ: AC6, AC7, AC8）

## スコープ

### 対象

- 既存の worktree 一覧（`worktree.list`。`WorktreeOpenDialog.vue` が表示する一覧）の各行から
  削除を実行できるようにする（現在開いている workspace の worktree・開いていない worktree の
  両方が対象）。
- 削除対象の worktree が現在 workspace として開かれている場合、削除と同時にその workspace を
  閉じる（herdr の「Delete worktree checkout...」と同じ挙動。開いている workspace の worktree
  だけを対象外にはしない）。
- 未コミットの変更（dirty）が残っている worktree の削除は、通常の削除が失敗した後、
  `--force` での再実行を利用者に確認してから行う（herdr の2段階式と同じ）。
- サーバ側 `git worktree remove` の実行（`WorktreeService`）・削除失敗の理由の分類
  （dirty／その他）・RPC の追加。

### 対象外

- worktree の作成先ディレクトリ（`~/.wtm/worktrees` 固定）の変更（既存 backlog の別項目）。
- ブランチ自体の削除（`git branch -d`）: `git worktree remove` はブランチを削除しない
  （worktree の checkout だけを消す）。ブランチの削除は本 work では扱わない。
- CLI（`wtmctl`）からの worktree 削除。Web UI からの操作のみを対象とする。
- 複数選択しての一括削除。1件ずつの削除のみ。

## 機能要件

- 一覧の各行に削除の操作（ボタン等）を追加する。
- 削除確定前に、対象が何であるか（パス・現在開いている workspace かどうか）が分かる確認を経る。
- サーバは `git worktree remove`（dirty なら `--force` 付きで再実行）を実行し、結果を返す。
- 削除に成功したら、一覧・（開いていた場合は）workspace/tab/pane の状態を全クライアントへ同期する。
- 削除に失敗したら（dirty 以外の理由。例: パスが worktree でなくなっている）、理由を利用者に
  分かる形で伝える（`worktreeErrorMessage` の既存の枠組みに乗せる）。

## 非機能要件 / 制約

- 破壊的操作（ディスク上の checkout を消す）なので、確認を経ずに実行しない（既存の D23
  パターン——busy な pane/tab/workspace を閉じる前に確認する——と同じ考え方をここにも適用する）。
- 既存の `worktree.list`/`worktree.create`/`confirmWorktreeOpen` の挙動・既存のキーバインド・
  既存の D&D（pane 移動・workspace 並べ替え）は変更しない。

## 完了条件 (受け入れ基準)

- [ ] AC1: worktree 一覧（`WorktreeOpenDialog.vue`）の各行から、その worktree の削除を実行できる。
- [ ] AC2: 削除に成功すると、その worktree はサーバ上（`git worktree list`）からも一覧からも消える。
- [ ] AC3: 削除に成功すると、`worktree.list` を開き直さなくても一覧の表示が更新される
  （現在開いているダイアログに反映される、または次に開いたときに反映される——design で確定する）。
- [ ] AC4: 削除対象の worktree が現在 workspace として開かれている場合、削除の確認時にその旨が
  分かる（その workspace が閉じられることが伝わる）。
- [ ] AC5: AC4 の状態で削除を確定すると、その workspace（tab・pane を含む）も一緒に閉じられる。
- [ ] AC6: 削除対象の worktree に未コミットの変更（dirty）がある場合、通常の削除は失敗し、
  利用者に「未コミットの変更がある」ことが伝わる。
- [ ] AC7: AC6 の状態から、利用者が `--force` での削除を選べる。
- [ ] AC8: AC7 で確定すると、変更を含めて削除される（`git worktree remove --force`）。
- [ ] AC9: 削除対象が既に worktree でなくなっている等、dirty 以外の理由で失敗した場合、理由が
  利用者に伝わり、レイアウト・一覧は変化しない。
- [ ] AC10: 複数クライアントが同じ repo の worktree 一覧・関連 workspace を開いているとき、
  一方の削除操作がもう一方にも反映される。
- [ ] AC11: 既存の worktree 作成（`worktree.create`）・開く（`confirmWorktreeOpen`）・
  既存のキーバインド・既存の D&D 操作は、この work の変更後も従来どおり動作する。

（AC9〜AC11 はどのユーザーストーリーにも紐づかない基準——エラー処理・複数クライアント同期・
既存機能の非破壊性——として並べている。テンプレートの指針どおり、ストーリーに紐づかない `AC`
があってもよい扱い。）

## 相互作用の受け入れ基準

`WorktreeOpenDialog.vue`（既存の一覧ダイアログ）に削除操作を追加するため記載する。

- [ ] AC-I1 開く / 閉じる: 削除の確認は、既存の `ConfirmDialog.vue` の拡張として開く
  （`confirmClose`/`confirmReplacePane` と同じ形）。**`view.dialogContext` は単一の値であり、
  一覧ダイアログの「上に重ねて」表示する仕組みは無い**（design で修正・確認済み。当初の
  想定はこの技術的事実と食い違っていた）——確認ダイアログを開く時点で一覧ダイアログの表示は
  終わり、確認が確定・取り消し・失敗のいずれで終わっても、一覧ダイアログを**開き直す**
  （`worktree.list` を再取得し直す。既存の `openWorktree` の再呼び出しで足りる）ことで
  「元の一覧に戻れる」という利用者体験を実現する。
- [ ] AC-I2 確定 / 取り消し: 確認ダイアログで確定すると削除が実行される。取り消すと一覧ダイアログ
  が開き直る（AC-I1 のとおり）。dirty で失敗したときの `--force` 確認（AC7）も、取り消せば
  一覧ダイアログが開き直り、削除は実行されない。
- [ ] AC-I3 キーボードだけで完結するか: 一覧ダイアログの既存のキーボード操作（↑↓/Enter/Esc）に
  加え、削除操作・dirty 時の `--force` 確認（AC7）もキーボードから到達できる（具体的なキー割り
  当ては design で確定する）。
- [ ] AC-I4 フォーカスの行き先: 確認ダイアログが開いたら最初のフォーカスは安全側
  （「キャンセル」相当）に置く（既存の `ConfirmDialog.vue` と同じ規約）。通常の削除確認から
  dirty 時の `--force` 確認へ進むときのフォーカス遷移（新しいダイアログの最初のフォーカスも
  同じく安全側か等）・削除後・キャンセル後のフォーカスの戻り先は design で確定する。
- [ ] AC-I5 既存の操作を妨げないか: 一覧ダイアログの既存の「選んで開く」操作（行のクリック・
  Enter）を、新しい削除操作が誤って引き起こさない（別の操作要素として明確に分離する）。

## 未確定事項 / 確認したいこと

- 削除ボタンの正確な見た目・配置（行内のアイコンボタンか、選択後の別ボタンか）。
- 「開いている workspace を閉じてから削除」と「dirty なら --force 確認」の2つの確認を、
  1つのダイアログにまとめるか、順番に出すか（design で確定する）。
- 削除成功後、一覧ダイアログ自体を閉じるか、開いたまま該当行だけ消すか（design で確定する）。
- AC-I3: 削除操作・dirty 時の `--force` 確認への具体的なキー割り当て（design で確定する）。
- AC-I4: 通常の削除確認から dirty 時の `--force` 確認へ進むときのフォーカス遷移先、
  削除後・キャンセル後のフォーカスの戻り先（design で確定する）。
