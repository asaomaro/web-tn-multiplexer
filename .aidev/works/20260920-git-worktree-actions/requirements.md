# 要件: workspace のメニューから Git worktree を作る・開く

## 背景 / 課題

利用者から「herdr は workspace を右クリックすると rename と close だけでなく
**new worktree** と **open worktree** が出る。herdr のコードを参考に、無ければ実装してほしい」という要望。

現状はリポジトリのコードで裏が取れている。

1. **workspace の右クリックメニューは 2 項目しか無い**。`ContextMenu.vue` の `workspace` の分岐は
   「名前の変更」「閉じる」だけで、コメントに
   「herdr は worktree 対応で 4 パターンあるが、本製品はグルーピングが対象外なので常にこの 2 項目（D56 の訂正 10）」
   と、**意図して見送った**ことが書かれている。
2. **worktree の機能はどこにも無い**。`worktree` という語はコメントとテスト名にしか出てこず、
   **サーバの制御メソッドにも `@wtm/protocol` の型にも無い**。
   サーバの git の機能は読み取りだけ（`git/GitInfoPoller.ts` が `rev-parse` と `rev-list` を打つ）。
3. `docs/herdr-parity.md:56`（H37「Git worktree の作成・一覧・削除とグループ化」）は
   後続「workspace のグルーピング」に回してあり、`.aidev/backlog/product-roadmap.md:12` に項目がある。

### 使えるもの / 足りないもの（実装の前提）

- **`GitRunner`（`packages/server/src/infra/GitRunner.ts`）は使える**。
  `spawn("git", args, { cwd })` で**シェルを介さない**ので、ブランチ名に何が入っても注入にならない。
- **ただし stderr を捨てている**（`stdio: ["ignore", "pipe", "ignore"]`）。
  `git worktree add` が失敗したとき、**理由を利用者に返せない**（「失敗しました」しか出せない）。
  作成の失敗は日常的に起きる（同じブランチが既にチェックアウト済み・パスが既に存在・リポジトリでない）ので、
  **stderr を拾えるようにする必要がある**。
- `workspace.create` は `cwd` を受け取れる（`WorkspaceCreateParams`）。
  `SessionService.createWorkspace(cwd, label)` がその cwd でシェルを起動する。
  **つまり「worktree を作る」と「その場所で workspace を開く」は分けて考えられる**。

### herdr（`da6bcd5`）ではどうなっているか

参照元。**同じにするのではなく、Web と本製品の構造に読み替える**（判断は design）。

- メニューは**リポジトリの状態で 4 通り**に変わる（`src/client/shell/context_menu.rs:4-43`）。
  git でなければ Rename / Close の 2 つ。git なら **New worktree** と **Open worktree...** が増える。
  worktree のチェックアウト側では代わりに **Delete worktree checkout...**。
- **New worktree**: ブランチ名を自動生成（`worktree/<形容詞>-<名詞>-<4桁hex>`。`src/worktree.rs:21-32`）して
  入力欄に入れ、作成先パスのプレビューを見せる。確定で
  `git worktree add [-b <branch>] <path> [<base>]` を実行（`src/worktree.rs:239-279`）。
  base は常に `HEAD`。作成先は `{worktree_directory}/{repo_name}/{branch のスラグ}`
  （既定 `~/.herdr/worktrees`。`src/worktree.rs:171-173`）。
- **Open worktree...**: `git worktree list --porcelain` で一覧を取り（`src/worktree.rs:494-517`）、
  bare と prunable を除いて選ばせる。確定すると**その場所を workspace として開くだけ**
  （`git worktree add` はしない）。既に開いていればその workspace を再利用。
- どちらも**まずサーバへ一覧を問い合わせてから**ダイアログを開く（`src/client/shell/worktrees.rs:220-228`）。

## 目的 / ゴール

- **workspace を右クリックするだけで、新しい Git worktree を作って作業を始められる**状態。
  端末で `git worktree add` を打ち、パスを決め、そこで新しい workspace を開く、という手順が要らない。
- **既にある worktree へ、一覧から選んで移れる**状態。パスを覚えていなくてよい。
- **失敗したときに理由が分かる**状態（「同じブランチが既にチェックアウトされている」等が読める）。
- git リポジトリでない workspace では**この 2 項目が出ない**状態（押せない項目を見せない）。

## ユーザーストーリー

- US1: **複数の作業を並行する人**として、workspace のメニューから新しい worktree を作りたい。
  なぜなら、今は端末に戻って `git worktree add` を打ち、置き場所を自分で決め、
  そこで workspace を開き直す必要があるから。（受け入れ: AC1, AC2, AC3）
- US2: **作業を切り替える人**として、既にある worktree を一覧から選んで開きたい。
  なぜなら、worktree のパスは `~/.wtm/worktrees/…` のように深く、覚えて打ち込むのが現実的でないから。（受け入れ: AC4, AC5）
- US3: **作業を切り替える人**として、既に開いている worktree を選んだら**そこへ移る**だけにしてほしい。
  なぜなら、同じ場所の workspace が 2 つできると、どちらで作業していたか分からなくなるから。（受け入れ: AC6）
- US4: **失敗に出くわす人**として、作れなかった理由を読みたい。
  なぜなら、「失敗しました」だけでは、ブランチ名を変えればよいのか、別の場所が要るのかが判断できないから。（受け入れ: AC7）
- US5: **git を使っていない人**として、関係のない項目を見せないでほしい。
  なぜなら、押しても必ず失敗する項目がメニューにあると、何が使えるのか分からなくなるから。（受け入れ: AC8）
- US6: **キーボードで操作する人**として、少なくとも「新しい worktree」はキーだけで始めたい。
  なぜなら、**workspace のメニューはマウスでしか開けない**（サイドバーの行に `tabindex` も `keydown` も無い）ので、
  メニューにしか入口が無いとキーボードだけの人には届かないから。（受け入れ: AC-I3, AC-I4）

## スコープ

### 対象
- `packages/protocol`（worktree の型と 3 つのメソッドの引数・戻り値）
- `packages/server/src/infra/GitRunner.ts`（**stderr を拾えるようにする**）
- `packages/server/src/git/`（worktree の一覧・作成のサービス）
- `packages/server/src/surface/methods/`（`worktree.list` / `worktree.create` / `worktree.open`）
- `packages/web/src/components/ContextMenu.vue`（workspace の分岐に 2 項目）
- `packages/web` のダイアログ 2 つ（作成・一覧）と `ActionDispatcher`
- 上記のテストと E2E

### 対象外
- **worktree の削除**（herdr の `Delete worktree checkout...`）。利用者の要望は「new と open」の 2 つ。
  作ったものを消す手段が無いのは片手落ちだが、削除は**取り返しがつかない操作**で確認の設計が要るため、
  この work では扱わず backlog へ送る。
- **worktree のグループ化**（`Workspace.groupId` は `@wtm/protocol` にあるが常に null。D6）。
  サイドバーで親子に束ねる表示は `.aidev/backlog/product-roadmap.md:12` の残り。
- **workspace / tab の並べ替え**（同じ backlog 項目の残り）。
- **worktree の置き場所の設定**（herdr は `[worktrees]` セクションの `directory`。`[ui]` とは並列で、その下ではない）。この製品に設定ファイルが無いため
  （`docs/herdr-parity.md` の H25 は後続）。**固定の既定値を使い、変えられるようにするのは backlog**。
- リモートの取得（`git fetch`）やブランチの追跡設定。

## 機能要件

- workspace の右クリックメニューに、**その workspace が git リポジトリのときだけ**
  「新しい worktree」「worktree を開く…」を足す。
- **「新しい worktree」にキー操作も割り当てる**。`prefix+G`（`keymap.ts` の `NOT_YET` に
  「グルーピング」用として予約されている枠）を使う。**herdr の既定も `prefix+shift+g`** なので同じ位置になる。
  「worktree を開く…」は herdr でも既定の割り当てが無いので、メニューからだけにする。
- **新しい worktree**:
  - ブランチ名の初期値を自動生成し、入力欄に入れて開く（利用者は上書きできる）。
  - **作成先のパスを入力の内容に応じて見せる**（確定前にどこに作られるか分かる）。
  - 確定すると worktree を作り、**その場所を新しい workspace として開いて表示を移す**。
  - **入力されたブランチが既にあるかどうかで作り方を変える**（herdr と同じ）。
    既にあるなら `git worktree add <path> <branch>`、無いなら `git worktree add -b <branch> <path> HEAD`。
    区別しないと、既存ブランチ名を入れたときに必ず失敗する。
  - ブランチ名が空なら確定できない。
- **worktree を開く…**:
  - 既にある worktree の一覧を出す（パスとブランチ名）。**bare と prunable は除く**。
  - 1 つも無いときは、その旨を伝えて閉じられる。
  - 選ぶと、その場所を workspace として開いて表示を移す。
    **既にその場所の workspace があれば、新しく作らずそこへ移る**。
- 失敗したときは**git が出した理由**（stderr の要約）を利用者に見せる。
- どちらのダイアログも、既存のダイアログ（`NameDialog` / `GotoPicker`）と**同じキー操作**で使える。

## 非機能要件 / 制約

- **`git` の引数は配列で渡す**（`GitRunner` の既存の形）。文字列に組み立ててシェルへ渡さない
  ——ブランチ名は利用者が自由に入力できるため。
- **`GitRunner` の変更は既存の利用者（`GitInfoPoller`）を壊さない**（戻り値を増やす形にする）。
- **長い処理でサーバを止めない**。`git worktree add` はネットワークを使わないが、
  大きなリポジトリでは数秒かかる。既存の `GitRunner` は timeout を受け取るので、それに従う。
- **`.aidev/conventions/regression-negative-control.md`**: 回帰テストは修正前に落ちることを確かめる。
- **`.aidev/conventions/e2e-observe-browser.md`**: E2E の判定はブラウザ側の観測で行う。
- 既存のクラス名・メソッド名を壊さない。既存のテストと E2E が通ること。
- **E2E は他の E2E と同時に走らせない**（この環境では資源の取り合いで無関係な spec が落ちる。
  先行 work `20260920-sidebar-tabbar-controls` の `test-result.md` に実測がある）。
- **E2E は「このリポジトリ自身」に対して worktree を作らない**。`composeServer` の `defaultCwd` は
  `process.cwd()` なので、テストが cwd を指定しないとサーバの最初の workspace は**この実リポジトリ**を指す。
  先行 work の `makeAheadRepo`（`workspace-tab-pane.spec.ts`。一時ディレクトリに bare と作業ツリーを作る）と
  同じ形で**使い捨てのリポジトリを用意し、その cwd で `workspace.create` してから**試す。

## 完了条件 (受け入れ基準)

- [ ] AC1: git リポジトリの workspace を右クリックすると「新しい worktree」が出て、押すとブランチ名の
      入力欄が開く。**初期値が自動生成されていて、そのまま確定できる**。
- [ ] AC2: そのダイアログは、入力中のブランチ名に応じて**作成先のパスを見せる**。
- [ ] AC3: 確定すると `git worktree add` が実行され、**その場所を cwd とする workspace が作られて表示が移る**。
      ブランチ名が空のときは確定できない。
- [ ] AC4: 「worktree を開く…」を押すと、既にある worktree の一覧（パスとブランチ名）が出る。
      **bare と prunable は出ない**。
- [ ] AC5: 一覧から選ぶと、その場所を cwd とする workspace が開いて表示が移る。
      一覧が空のときは、その旨が出て閉じられる。
- [ ] AC6: 既に開いている worktree を選んだときは、**新しい workspace を作らずにそこへ移る**。
- [ ] AC7: 失敗したとき（例: 同じブランチが既に別の場所にチェックアウトされている／
      作成先のパスが既に存在する）、
      **git が出した理由が利用者に見える**（「失敗しました」だけで終わらない）。
- [ ] AC8: git リポジトリでない workspace のメニューには、この 2 項目が**出ない**。
- [ ] AC9: worktree の上に開いた workspace を（既存の「閉じる」で）閉じても、
      **ディスク上の worktree はそのまま残る**（`git worktree remove` はしない）。
      削除を対象外にした以上、閉じる操作が消してしまわないことを明示する。
- [ ] AC10: `GitRunner` の変更で `GitInfoPoller` の振る舞いが変わっていない
      （ブランチ名・ahead/behind の取得が今までどおり）。
- [ ] AC11: （**AC11 はどの US にも紐づかない横断的な基準**）既存の単体テストと既定の E2E が通る。
      テスト側を直した場合は、理由が AC1〜AC10 のどれかに紐づく。

## 相互作用の受け入れ基準（UI を伴う work のみ）

- [ ] AC-I1 開く / 閉じる: 2 つのダイアログはメニューの項目で開き、**Esc で閉じる**。
      閉じたときに worktree は作られていない（作成のダイアログ）／移動していない（一覧）。
- [ ] AC-I2 確定 / 取り消し: 作成は Enter か「作成」で確定、Esc で取り消す。
      一覧は Enter か項目のクリックで確定、Esc で取り消す。取り消したとき何も起きない。
- [ ] AC-I3 キーボードだけで完結するか: **「新しい worktree」は `prefix+G` から始められ**、
      ブランチ名の入力から確定までマウス無しで通せる。開いた後のダイアログは 2 つとも
      キーだけで完結する（一覧は ↑↓ で選び Enter で確定、Esc で閉じる）。
      **「worktree を開く…」を開く手段はメニュー（マウス）だけ**——workspace のメニュー自体を
      キーボードから開けないのはこの work の前からの制限で（`Sidebar.vue` の行に `tabindex` も
      `keydown` も無い。pane の枠だけが `PaneFrame.vue` で対応済み）、**ここでは直さず backlog へ送る**。
- [ ] AC-I4 フォーカスの行き先: 開いたらダイアログの中（作成は入力欄、一覧は選択中の項目）へ移り、
      閉じたら**開く前の場所へ戻る**（既存のダイアログと同じ）。
- [ ] AC-I5 既存の操作を妨げないか: ダイアログの上のキーを端末へ漏らさない。
      メニューに 2 項目増えても、既存の「名前の変更」「閉じる」の位置と動作が変わらない。

## 未確定事項 / 確認したいこと

- **worktree の置き場所の既定値**（herdr は `~/.herdr/worktrees/<repo>/<slug>`）。
  この製品での既定を design で決める。
- **ブランチ名の自動生成の方式**（herdr は形容詞-名詞-hex）。同じ方式を採るかを design で決める。
  採るなら `NOTICE` / `third_party/herdr/README.md` の帰属表示に足す必要がある。
- **git リポジトリかどうかの判定をどこで行うか**（サーバが `Workspace` に持たせるか、
  メニューを開くたびに問い合わせるか）。`Workspace.git`（`GitInfoPoller` が埋める）を使えるかを design で確認する。
- **2 つのダイアログを既存の部品で作れるか**（`NameDialog` / `GotoPicker` の再利用）。design で決める。
