# レビュー: workspace のメニューから Git worktree を作る・開く

## タスク点検ログ（coding 工程内・「3.3」(b)）

20 タスク（T1〜T20）を点検した（`mode: autonomous` は全タスク必須）。T21 は自前の差分を持たない
（test 工程で消化。decisions.md D1）ので対象外。**委譲は 2 本にまとめた**——protocol/server 側（T1〜T11）と
web/E2E 側（T12〜T20）。指摘は計 7 件（must 0 / should 2 / nit 5）。

### 実装の指摘

- [should][conv:-] `packages/server/src/git/WorktreeService.ts` `create()` が repo 名を得るためだけに
  `this.list(workspaceId)` を呼んでおり、**作成 1 回で git を 4 回起動していた**（一覧は捨てるだけ） /
  対応: 修正済（T8。`private repoNameOf(cwd)` を切り出して `list` と共用し、`create` は 3 回に減った）
- [nit][conv:-] `packages/web/src/actions/ActionDispatcher.ts` `existing.activeTabId ?? existing.tabIds[0]` が
  到達しない分岐だった（`Workspace.activeTabId` は必須の `TabId`。`packages/protocol/src/model.ts:24`）。
  他の 5 箇所はすべて `ws.activeTabId` を直に使っており、ここだけ形が違った / 対応: 修正済（T13。`??` ごと削除）
- [nit][conv:-] `packages/web/src/App.vue` 2 つのダイアログだけインデントが 6 スペース（兄弟は 4）で、
  import の位置も周囲のアルファベット順から外れていた / 対応: 修正済（T15）
- [nit][conv:-] `packages/web/src/components/WorktreeOpenDialog.vue` `@click` に複数文
  （`selected = index; accept();`）をインラインで書いていた。`GotoPicker.vue:303` は単一のメソッド呼び出しに
  寄せている / 対応: 修正済（T15。`choose(index)` を切り出した）
- [nit][conv:-] `packages/web/src/components/HelpDialog.test.ts` 同じ assertion
  （`"未対応（後続: 通知）"`）が 2 行重複していた（コピペの取り残し） / 対応: 修正済（T16）

### テストの指摘（いずれも「緑だが何も守っていない」類）

- [should][conv:regression-negative-control!] `packages/web/src/actions/ActionDispatcher.test.ts`
  **失敗時の toast を確かめるテストが 1 つも無かった**。`makeConnection()` の `request` は常に resolve する
  実装だったので、`worktreeErrorMessage`（`errorCodeOf` → `clientErrorMessage`）の経路は**一度も実行されて
  いなかった**。点検が実地に確認：この関数を固定文言を返す実装に差し替えても、web の全テストが緑のままだった /
  対応: 修正済（T19。`makeConnection` に `rejectWith` を足し、コードごとに文言が違うこと・読めないコードは
  汎用の文言に落ちることを 3 件で固定した。壊すと 2 件落ちることを再確認）
- [should][conv:regression-negative-control!] `packages/web/src/components/ContextMenu.test.ts`
  `「worktree の項目は、それぞれの入口を呼ぶ」`が `li[2]`（新しい worktree）しか押しておらず、
  `li[3]`（worktree を開く…）は未検証だった。点検が実地に確認：`ContextMenu.vue` の
  `actions.openWorktree(...)` を `actions.newWorktree(...)` に差し替えても全 21 件が緑のままだった /
  対応: 修正済（T17。`li[3]` の押下を足した。壊すと落ちることを再確認）

### タスクをまたぐ点検（手順 5.5 の `cross`）

**指摘 7 件（must 1 / should 5 / nit 1）**。いずれも 1 タスクの差分には現れない——片方の判定が
既存コードにある、あるいは 3 層に散っているため。

- [must][conv:-] **`create` が返すパスと `list` が返すパスの作り方が違う**。前者は
  `defaultCheckoutPath` で組み立てた文字列、後者は **git が realpath 済みの文字列**
  （`packages/server/src/git/WorktreeService.ts` ↔ `worktree.ts`）。web の「既に開いている」判定は
  `w.cwd === path` の完全一致なので、**`$HOME` の経路に symlink が 1 つでもあるマシンでは、
  作った worktree を一覧から選ぶと 2 つ目の workspace ができる**（AC6 が防ごうとした事象そのもの）。
  この開発機では再現せず、**一致は環境の偶然に依存していた** / 対応: 修正済（decisions.md D5。
  `rev-parse --show-toplevel` で git に聞く。symlink 経由のテストを追加）
- [should][conv:-] **「git リポジトリか」を 2 つの別々の判定が支えており、コミットの無い repo で食い違う**
  （メニューは `rev-parse --abbrev-ref HEAD`、サーバは `--git-common-dir`）。D3 の「理由はサーバが返す」が
  この経路だけ成立せず、利用者には「サーバのログを確かめてください」としか出なかった /
  対応: 修正済（decisions.md D6。`worktree_no_commits` を足した）
- [should][conv:-] **`setView` と `focusPane` を対で呼ぶ規則が、5 箇所中この work の 1 箇所だけ欠けていた**
  （`ActionDispatcher.confirmWorktreeOpen` の「既に開いている」分岐）。移った直後は前の workspace の pane が
  焦点のままで、**打鍵が見えていない端末へ流れる** / 対応: 修正済（既存 4 箇所と同じ形にし、テストを追加）
- [should][conv:-] **移植の記録が 3 箇所あるのに、更新したのは 2 箇所**。`NOTICE` と
  `third_party/herdr/README.md` は直したが、機能の有無を宣言する `docs/herdr-parity.md:56` の H37 が
  「後続」のままで、**同じ事実が 2 箇所で矛盾していた** / 対応: 修正済（H37 を実装済みと後続に割った）
- [should][conv:-] **E2E が開発機の本物の `~/.wtm/worktrees` に worktree を作り、消していなかった**
  （実測で残骸 4 件）/ 対応: 修正済（decisions.md D7。`afterEach` で片付け、既存の残骸も削除）
- [should][conv:-] **`GitRunner` が reject する経路だけエラーコードの鎖から外れていた**
  （git が無い・時間切れが素の `Error` として `internal` に潰れる。design「エラー処理 / 異常系」と食い違う）/
  対応: 修正済（`RpcError("worktree_failed")` に包み、テストを追加）
- [nit][conv:-] `worktree_failed` を一覧の失敗にも使っているのに、文言が「worktree を**作成**できませんでした」で
  作成に限定されていた / 対応: 修正済（「worktree の操作に失敗しました」に言い直した）

**鎖として壊れていないことを確認した点**（指摘なし）: エラーコードの経路は 4 つとも
protocol → server → `ControlSurface` → `Connection` → `errorCodeOf` → 日本語まで繋がっている。
3 層の契約（引数名・省略可否・戻り値）は `METHOD_SCHEMAS` と `MethodResultMap` の両方に入っている。
パスの**組み立て**規則は protocol の 1 箇所だけで、web のプレビューとサーバの作成先はずれない
（ずれるのは上の must の git 側の正規化だけ）。条項 `e2e-observe-browser` に違反なし。

### 負の対照の記録（条項 `regression-negative-control`）

タスク点検の should 2 件と、cross の修正 4 件（must の symlink・`worktree_no_commits`・`GitRunner` の包み・
`focusPane`）について、**直したあとに同じ壊し方をもう一度**適用し、落ちることを確かめた
（タスク点検の分は 3 件、cross の分は 5 件の assertion が落ちた）。生の出力は `test-result.md`。
壊したファイルはすべて `cmp` で復元を確認済み。

## ラウンド 1

**指摘 7 件（must 0 / should 3 / nit 4）**。点検で潰した分（タスク点検 7・cross 7）は再掲していない。

- [should][conv:-] `packages/web/src/actions/ActionDispatcher.ts:232` **worktree の workspace に label を渡していない**
  （`request("workspace.create", { cwd })`）。サーバの既定は `"1"`（`SessionService.ts:126`）で、サイドバーの行は
  `workspace.label` しか出さない。2 行目のブランチ表示は `showGit = !!ws.git && (ahead > 0 || behind > 0)`
  （`Sidebar.vue:32`）で、**新しい worktree は上流が無く 0/0 なので構造上出ない**。結果、worktree を 2 つ作ると
  サイドバーに `1` が 3 行並び、**どれがどの worktree か画面から分からない**。AC は満たすが
  US1「複数の作業を並行する」・US3「どちらで作業していたか分からなくなる」の**価値に届いていない**。
  E2E 自身が区別のために label を渡しており、その必要性をコメントで認めている
  （`workspace-tab-pane.spec.ts:500`「既定の workspace も "1" なのでラベルで区別する」）
- [should][conv:-] `packages/server/src/git/WorktreeService.ts:27-38` **不正なブランチ名が catch-all に落ちる**。
  ダイアログは空白以外を何でも確定でき（`WorktreeCreateDialog.vue:34` は `trim() !== ""` だけ）、プレビューは
  空白を `-` に畳んだ**もっともらしいパス**を見せる。実測：`git worktree add -b "foo bar"` は
  `fatal: 'foo bar' is not a valid branch name` で、分類のどのパターンにも当たらず `worktree_failed`
  ＝「サーバのログを確かめてください」になる。**US4「『失敗しました』だけでは、ブランチ名を変えればよいのか
  判断できない」がそのまま残る経路**（D6 が `worktree_no_commits` を足したのと同じ型の穴）
- [should][conv:-] `packages/web/src/components/WorktreeOpenDialog.vue:140` **`:hover`（詳細度 0,2,0）が
  `-selected`（0,1,0）に勝つ**ので、選択中の行にポインタが乗ると選択色が消え、別の行を hover すると 2 行光る。
  ↑↓ で選んで Enter という主操作（AC-I3）で、どれが確定されるか読めない。
  **直前の work がこの型の不具合を直したばかりで、`Sidebar.vue:239-243` に「詳細度をそろえ、後に置いて
  持続する状態を勝たせる」という手本とコメントがある**
- [nit][conv:-] `packages/server/src/git/WorktreeService.ts:124-128` `recordedPath` のコメントは
  「引けなければ組み立てた文字列のまま返す」と書いているが、フォールバックは `code !== 0` しか見ていない。
  `this.run` は reject を `RpcError` に**変換して投げる**ので、その経路では**worktree は作られているのに
  「失敗しました」になる**。コメントの意図と実装が食い違っている
- [nit][conv:-] `packages/web/src/components/WorktreeOpenDialog.vue:92` キー処理の受け口が `<ul>`。
  手本の `GotoPicker.vue:292` と `HelpDialog.vue:217` は `<dialog>` に付けている。focusable でない所を
  クリックすると `<ul>` から焦点が外れ、以後 ↑↓/Enter が届かない。`<dialog>` の `aria-label` も無い
- [nit][conv:e2e-observe-browser] `packages/e2e/src/specs/workspace-tab-pane.spec.ts:575-577`
  AC6 の**「そこへ移る」側をブラウザで観測していない**（閉じることと行が増えないことだけ）。
  `.sidebar-row-current` / `aria-current` が使える。違反ではないが条項の狙いから半分欠けている
- [nit][conv:-] `packages/web/src/store/view.ts:6` 同じ `@wtm/protocol` からの import が**2 本に分かれている**
  （`:1` に既にある）

## ラウンド 2

**指摘 4 件（must 0 / should 0 / nit 4）**。ラウンド1 の 7 件は**すべて直っていると判定**された
（点検者が 1 件ずつ実コードで確認。label の呼び出し元 2 つ・`ErrorCode` の網羅・CSS の詳細度・
`recordedPath` の try/catch・`<dialog>` へのキー処理の移動・E2E の `aria-current` 観測・import の統合）。
**nit のみなので差し戻さず、この工程で直した**（直した後、全パッケージの単体・E2E 一式・smoke を取り直した）。

- [nit][conv:-] `packages/server/src/git/WorktreeService.ts:41` **ブランチ名の階層衝突が catch-all に落ちる**。
  実測：`foo` があるとき `foo/bar` は `fatal: cannot lock ref 'refs/heads/foo/bar': 'refs/heads/foo' exists; …`
  で、`already exists` にも `is not a valid branch name` にも当たらず `worktree_failed`＝
  「サーバのログを確かめてください」になる。ラウンド1 で塞いだのと**同じ型の穴が 1 つ残っていた** /
  対応: 修正済（`worktree_invalid_branch` に分類。本物の git と `classifyWorktreeError` の両方でテスト）
- [nit][conv:-] `packages/server/src/git/WorktreeService.ts:132-137` `recordedPath` の
  **2 つのフォールバックが無言**で、同ファイルの `this.run`（`log.warn` を出す）と流儀も割れていた。
  **D5（must）の不変条件が痕跡なく劣化しうる** / 対応: 修正済（どちらの経路にも `log.warn` を足した）
- [nit][conv:-] `docs/herdr-parity.md:56` **私がラウンド 1 で足した H37 行の「分類」欄の値が凡例に無く**、
  「対応 AC」欄の `AC1〜AC6` が他の全行（20260918 work の AC 体系）と別体系を指していて、
  **同じ表の中で AC1 が 2 つの意味を持っていた** / 対応: 修正済（凡例に work slug の行を足し、
  AC 欄に「（同 work）」を併記）
- [nit][conv:regression-negative-control!] `test-result.md` **ラウンド1 の修正 4 件のうち、
  生の失敗出力が載っているのは CSS の 1 件だけ**。残り 3 件は散文の主張のみで、条項の
  「落ちたときの生の出力を貼る。要約に置き換えない」を満たしていなかった /
  対応: 修正済（3 件とも壊して落ちることを確かめ、生の出力を `test-result.md` に貼った。
  **うち 1 件は 1 度目の壊し方が足りず緑のままだったので、壊し方を変えて落ちることまで確かめた**）

## 判定

ラウンド 2 の 4 件は nit のみ。**must / should は残っていない**。
被覆は `aidev coverage` が gaps=0（design 16/16・tasks 16/16。tasks 承認時から変化なし）。
