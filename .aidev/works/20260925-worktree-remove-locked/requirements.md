# 要件: ロック済み worktree の削除

## 背景 / 課題

`20260924-worktree-remove` で worktree の削除（`worktree.remove`）を実装したが、`git worktree
lock` でロックされた worktree を削除しようとすると、`classifyWorktreeRemoveError`（`WorktreeService.ts`）
のどの分岐にもマッチせず、汎用の `worktree_failed` に落ちる。利用者には
「worktree の操作に失敗しました。サーバのログを確かめてください。」という、原因が伝わらない
メッセージしか出ない。

実機では `git worktree remove`（`--force` 1回でも）はロック済みの対象に対して
`fatal: cannot remove a locked working tree; use 'remove -f -f' to override or unlock first`
で失敗し、`--force` を**2回**（`-f -f`）渡すと成功する。既存の dirty 時の2段階確認フロー
（`sendWorktreeRemove`。通常削除→失敗→`--force` 確認→再送）と同じ形に lock も乗せれば、
`--force` を1回しか渡していない現状のサーバ側実装を直すだけで、利用者は「片付けたいのに
汎用エラーで行き詰まる」状態から抜けられる。

`20260924-worktree-remove` の review round1 で見つかり、優先度が低いとして記録のみで見送られ、
backlog（`.aidev/backlog/product-roadmap.md` 331行目）に残っていた項目。

## 目的 / ゴール

ロック済みの worktree を削除しようとした利用者が、「ロックされている」ことを理解した上で、
（意図すれば）ブラウザの操作だけで削除を完了できる状態にする。既存の dirty worktree の削除
フローは、この変更後も従来どおり動作し続ける状態を保つ。

## ユーザーストーリー

- US1: web-tn-multiplexer の利用者として、ロック済みの worktree を削除しようとしたとき、
  原因不明の汎用エラーではなく「ロックされている」ことを知らされたい。なぜなら、汎用メッセージ
  のままだと不具合なのか自分の操作ミスなのか区別できず、次に何をすればよいか分からないから。
  （受け入れ: AC1, AC5）
- US2: 利用者として、ロック済みの worktree でも、それでも削除するか選んで実行したい。なぜなら、
  レビュー用に一時的にロックした worktree を使い終えた後、手で `git worktree unlock` を叩かず
  片付けたい場面があるから。（受け入れ: AC2, AC3）

## スコープ

### 対象

- サーバ側 `classifyWorktreeRemoveError`（`packages/server/src/git/WorktreeService.ts`）に、
  ロック済みを示す stderr パターンの分類を追加する。
- サーバ側 `DefaultWorktreeService.remove()` の `--force` の付け方を、既存 dirty 系との後方互換を
  保ったまま「ロック済みでも削除できる」形に変える。
- 新しいエラーコード（`packages/protocol/src/errors.ts` の `ErrorCode`）と、対応する利用者向け
  メッセージ（`packages/web/src/net/clientError.ts`）を追加する。
- クライアント側の削除確認フロー（`ActionDispatcher.ts` の `sendWorktreeRemove`・
  `ConfirmDialog.vue`）を、ロック済みの場合も `--force` 確認へ進めるように拡張する。

### 対象外

- `git worktree unlock`（ロック解除）を UI から行う機能。本 work は「ロックされたままでも
  `--force` で削除できる」ことのみを扱う（herdr の `-f -f` 相当）。
- `git worktree lock`（ロックを掛ける）機能。本 work では扱わない。
- `20260924-worktree-remove` review round1 で同時に見つかった別項目
  （削除確認ダイアログの `openWorkspaceId` が開いた瞬間のスナップショットで再評価されない狭い
  競合。design が既存のトレードオフとして受け入れ済みで、本 work のスコープ外）。

## 機能要件

- ロック済み worktree に対する削除の失敗を、専用のエラーコードとして分類する。
- 通常削除（force無し）がロック済みで失敗したら、利用者に「ロックされている」ことが伝わる
  確認を経て、`--force` での削除を選べる。
- `--force` で確定すると、ロック済みの worktree（dirty の有無を問わず）が実際に削除される。
- 既存の dirty worktree の削除（`--force` 確認フロー）は、変更後も従来どおり成功する。

## 非機能要件 / 制約

- 既存の `worktree_dirty`/`worktree_not_a_worktree`/`worktree_is_main` の分類・メッセージ・
  確認フロー・キーボード操作は変更しない（回帰させない）。**`worktree_failed`（汎用の分類先）
  だけは対象が変わる**——AC1 により、ロック起因の失敗はこの汎用分類から専用のエラーコードへ
  移る。それ以外の原因（未知のエラー等）による失敗は、引き続き `worktree_failed` に分類される
  （分類ロジックからロック用の分岐が1つ増えるだけで、既存の分岐・既存の原因による判定結果は
  変わらない）。
- `--force` の付け方の変更（1回→2回）が、ロックされていない通常の dirty worktree の削除に
  副作用を起こさないこと（実機の git で確認する）。

## 完了条件 (受け入れ基準)

- [ ] AC1: ロック済み worktree に対する `git worktree remove`（force無し）の失敗を、
  `classifyWorktreeRemoveError` が専用のエラーコードに分類し、汎用の `worktree_failed` に
  落ちない。
- [ ] AC2: AC1 の状態から、利用者が `--force` での削除を選べる（既存の dirty 時の確認フローに
  合流する、または design で定める形で到達できる）。
- [ ] AC3: AC2 で確定すると、ロック済みの worktree（dirty の有無を問わず）が実際に削除される。
- [ ] AC4: `--force` の付け方を変更した後も、ロックされていない dirty worktree の削除確認
  フローは従来どおり成功する（回帰なし）。
- [ ] AC5: 削除確認・エラーメッセージに、「ロックされている」ことが（汎用メッセージより
  具体的に）伝わる文言が使われる。
- [ ] AC6: 既存の `worktree_dirty`/`worktree_not_a_worktree`/`worktree_is_main` の分類・
  メッセージ・確認フロー・キーボード操作は、この work の変更後も従来どおり動作する。また、
  ロック以外の原因による失敗は、この work の変更後も引き続き `worktree_failed`（汎用分類）に
  分類される（AC1 が切り出すのはロック起因のケースのみで、`worktree_failed` という分類先
  自体は残る）。

（AC4, AC6 はどのユーザーストーリーにも紐づかない基準——既存機能の非破壊性——として並べている。）

## 相互作用の受け入れ基準

`20260924-worktree-remove` が確立した確認ダイアログ（`ConfirmDialog.vue` の拡張。通常削除確認→
dirty 時は `--force` 確認へ進む2段階式）を、lock の場合にどう扱うか（既存の dirty 確認と同じ
文言に乗せるか、lock 専用の文言を出し分けるか）は design で確定する。ここでは、既存の
相互作用の規約（AC-I1〜AC-I5、`.aidev/works/20260924-worktree-remove/requirements.md` 参照）が
lock のケースでも崩れないことだけを求める。（AC-I1〜AC-I5 は AC4・AC6 と同様、どのユーザー
ストーリーにも紐づかない基準——相互作用の規約はテンプレート上ストーリー非紐づけが通常の扱い）。

- [ ] AC-I1 開く / 閉じる: lock 時の `--force` 確認も、既存の dirty 時の確認と同じ
  `ConfirmDialog.vue` の枠組みで開閉する（新しいダイアログ種別を増やさない）。
- [ ] AC-I2 確定 / 取り消し: `--force` 確認で確定すると削除が実行される。取り消すと一覧
  ダイアログが開き直り、削除は実行されない（既存の dirty 時と同じ）。
- [ ] AC-I3 キーボードだけで完結するか: lock 時の `--force` 確認も、既存の dirty 時と同じ
  キー割り当て（↑↓/Enter/Esc）で完結する。
- [ ] AC-I4 フォーカスの行き先: lock 時の `--force` 確認も、既存の dirty 時と同じく最初の
  フォーカスは安全側（「キャンセル」相当）に置く。
- [ ] AC-I5 既存の操作を妨げないか: lock 判定・`--force` 確認の追加が、一覧ダイアログの既存の
  「選んで開く」操作や、dirty 時の既存フローを妨げない。

## 未確定事項 / 確認したいこと

- lock 時の `--force` 確認メッセージを、既存の dirty 時のメッセージ（「未コミットの変更が
  残っています」）と共有するか、lock 専用の文言を出し分けるか（design で確定する）。
- ロック済みかつ dirty でもある worktree（両方の条件が同時に成立する場合）の分類・メッセージを
  どちらのエラーコードにするか（design で確定する。実機確認では lock のエラーが dirty より先に
  出ることが分かっている——`classifyWorktreeRemoveError` は stderr の最初の `fatal:`/`error:` 行
  だけを見る構造のため）。
