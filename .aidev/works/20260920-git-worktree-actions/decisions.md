# 決定記録

## D1: AC10・AC11・AC-I5 は coding ではなく test 工程で消化する

- 背景: この 3 つは「既存の振る舞いを壊していない」ことを求めるもので、対応する T18 は
  一式を走らせるだけで coding 工程の差分を持たない。
- 決定: **T18 は coding では未チェックのまま承認してよい**（`aidev-30-tasks` 手順 6）。
- 理由 / 代替案: coding 中に毎回 E2E 一式（約 4 分）を回すと刻みが粗くなる。
- 影響: `aidev-40-coding` の完了の目安と形の上で食い違うので、この記録を証跡とする。

## D2: git の失敗は生のメッセージではなく「分類したコード」で返す

- 背景: 要件 AC7 は「git が出した理由が利用者に見える」ことを求める。当初の設計は
  **stderr の先頭 1 行を `RpcError` の message に載せて toast に出す**形だった。
  独立点検で 2 つの誤りが分かった。
  1. **この PJ には既に規約がある**——`packages/web/src/net/clientError.ts` の D107 が
     「サーバの `message` は使わず `code` で引いて日本語にする」と定めており、
     「以前はサーバの英語の固定文をそのまま toast に出していた」のを直した経緯が書かれている。
  2. **stderr の先頭 1 行は理由ではない**。`git worktree add` は失敗時も 1 行目が
     `Preparing worktree (...)` という進行の表示で、理由（`fatal: …`）は 2 行目に出る
     （点検が git 2.43 で実測。3 つの失敗ケースすべてで同じ形）。
- 決定: **サーバが stderr の `fatal:` / `error:` の行を見てコードに分類し、web がコードから日本語を引く**。
  `ErrorCode` に `not_a_git_repository` / `worktree_branch_in_use` / `worktree_path_exists` /
  `worktree_failed` を足す。**生の stderr はサーバのログにだけ残す**。
- 理由 / 代替案: 生のまま出す案は D107 に反する。**herdr 自身も英語の診断で分類している**
  （`LC_ALL=C` を付けるのがその前提）ので、分類する形は移植元とも整合する。
- 影響: AC7 の判定が「文言が出るか」から「**ケースごとに別のコードになるか**」に変わる。
  要件の AC7 の書き方も合わせる。

## D3: 「git リポジトリか」は `Workspace.git`（5 秒周期）で判定し、遅れは `prefix+G` で埋める

- 背景: メニューの出し分け（AC8）に使える情報は `Workspace.git` だが、
  `GitInfoPoller` の周期が 5000ms なので、**workspace を作った直後は最大 5 秒 null** のまま
  （research F7）。その間はメニューに worktree の項目が出ない。
- 決定: **`Workspace.git` を使い、遅れは受け入れる**。代わりに `prefix+G` は `git` を見ずに常に効かせ、
  git でなければサーバが `not_a_git_repository` を返して理由が出るようにする。
- 理由 / 代替案: メニューを開くたびにサーバへ聞く案は、**右クリックしてから項目が出るまで待たされる**か、
  **出た後に項目が増える**かのどちらかになる。どちらも操作として悪い。
  `workspace.create` の応答に git の情報を含める案は、サーバ側の責務が増える割に
  「作った直後の 5 秒」しか救わない。
- 影響: 作った直後にメニューから worktree を作ろうとすると項目が無い。**backlog へ送る**
  （`Workspace.git` の即時化）。

## D4: サーバのエラーコードは、`Connection` を変えずに文字列から取り出す

- 背景: 失敗の理由をコードごとの日本語にする（D2）には `code` が要る。ところが
  `Connection`（`net/Connection.ts:293`）は **`new Error(`${code}: ${message}`)` という文字列で reject** する
  ——`code` はプロパティとして残らない。design ではここを「実装時に確かめる」としていた。
- 決定: **`Connection` は変えず**、`net/clientError.ts` に `errorCodeOf(err)`（先頭の `<code>: ` を読む）を足して、
  `clientErrorMessage(code)` と組み合わせる。
- 理由 / 代替案: `Connection` が `code` を持つエラーを投げる形にするのが本筋だが、
  **この work の範囲外の共有部品**で、既存の全ての `.catch` が影響を受ける。
  取り出す側を 1 つ足すほうが、変更の及ぶ範囲が小さく戻しやすい。
- 影響: エラーの文言の書式（`<code>: <message>`）に依存する。**書式が変わると黙って汎用の文言に落ちる**ので、
  `errorCodeOf` の単体テストで書式を固定する。本筋の直し（`Connection` が `code` を持つ）は backlog へ。

## D5: `worktree.create` は「組み立てたパス」ではなく「git が記録したパス」を返す

- 背景: cross 点検（タスクをまたぐ不変条件の点検）の must。`create` は `defaultCheckoutPath` で
  組み立てた文字列をそのまま返していたが、`list` が返すのは **git が realpath 済みの文字列**。
  **git は worktree の登録時に symlink を解決する**（実測：`/tmp/l/wt1` へ `worktree add` →
  `worktree list --porcelain` は `/tmp/real/wt1`）。web の「既に開いている」判定は `w.cwd === path` の
  完全一致なので、**`$HOME` の経路に symlink が 1 つでもあるマシンでは、作った worktree を一覧から
  選ぶと 2 つ目の workspace ができる**——AC6 が防ごうとした事象そのものが起きる。
  この開発機の `$HOME` は symlink ではないため再現せず、**一致は環境の偶然に依存していた**。
- 決定: `create` は成功後に、作った worktree で `git rev-parse --show-toplevel` を引き、
  **その文字列を返す**（`list` の出力と一致することを実測で確認）。引けなければ組み立てた文字列のまま返す
  （add は成功しているので、作成自体は失敗にしない）。git の実行は 1 回増えて 4 回になる。
- 理由 / 代替案: Node 側で `realpath` しても git の正規化と一致する保証がない（git は独自に解決する）。
  「git に聞く」のが唯一ずれない方法。web 側で緩い比較にする案は、**ずれの原因をサーバに残したまま
  症状だけ隠す**ので採らなかった。
- 影響: `WorktreeService.test.ts` に symlink 経由の root で `create` と `list` が一致することを見るテストを足した
  （戻すと落ちることを確認済み）。既存の「組み立てた文字列と一致する」テストはそのまま通る（symlink が無い環境では同じ値）。

## D6: コミットが 1 つも無いリポジトリに `worktree_no_commits` を足す

- 背景: cross 点検の should。「この workspace は git か」を **2 つの別々の判定が支えていた**——
  メニューの出し分けは `Workspace.git`（`rev-parse --abbrev-ref HEAD`）、サーバは
  `rev-parse --git-common-dir`。**コミットが 1 つも無い repo で両者は食い違う**（実測：前者 exit 128、
  後者 exit 0）。このとき D3 の「キーは常に効かせ、git でなければサーバが理由を返す」が成立せず、
  `prefix+G` は成功してダイアログが開き、確定して初めて `fatal: invalid reference: HEAD` で落ち、
  catch-all の `worktree_failed`＝「サーバのログを確かめてください」になる。**理由が利用者に届かない
  唯一の経路**だった。
- 決定: 判定を 1 つに寄せるのではなく、**分類を 1 つ増やす**。`classifyWorktreeError` が
  `invalid reference: HEAD` を `worktree_no_commits` に畳み、web が「このリポジトリにはまだコミットが
  1 つもないため、worktree を作れません。」と出す。
- 理由 / 代替案: 判定を揃える案（メニュー側も `--git-common-dir` にする）は、**コミットの無い repo で
  メニューに項目が出るのに押すと必ず失敗する**ことになり、かえって悪い。D3 の方針（キーは常に効かせ、
  理由はサーバから返す）は正しく、**足りなかったのは理由の側**だった。
- 影響: `ErrorCode` に 1 つ追加（protocol）、`MESSAGES` に 1 つ追加（web）。本物の git を使う単体テストと
  `classifyWorktreeError` の単体テストを足した。

## D7: E2E は作った worktree を `afterEach` で片付ける

- 背景: cross 点検の should。worktree の作成先はサーバ既定の `~/.wtm/worktrees` で、
  **E2E からは差し替え口が無い**（`composeServer` が `root` を渡していない）。結果、
  **開発機に残骸が 4 つ溜まっていた**（参照先の `/tmp` の repo は消えているので孤児）。
- 決定: spec 側で後片付けする。`makePlainRepo()` が作った repo を集合に覚え、`afterEach` で
  `~/.wtm/worktrees/<repo 名>` と repo 本体を消す（**テストが途中で落ちても消えるよう** `afterEach`）。
- 理由 / 代替案: サーバに root の差し替え口（env 等）を足す案は、**この work の範囲を超える設定の話**に
  なるうえ、E2E 以外に使い道が無い。残骸の掃除という目的には spec 側の後片付けで足りる。
  ただし「作成先を設定できること」自体は要望として残るので backlog に起こす。
- 影響: 既存の残骸 4 つも削除した。

## D8: E2E は「ビルドしてから」走らせる（`pnpm -C packages/e2e test` は再ビルドしない）

- 背景: review ラウンド1 の CSS の指摘（`:hover` が選択色に勝つ）を直して E2E を走らせたところ**落ちた**。
  調べると **E2E は再ビルドしない**。`packages/e2e` の `test` は `playwright test` だけで、
  サーバは `@wtm/server`（`exports` が **`./dist/testkit.js`**）を読み、ブラウザは `packages/web/dist` を読む。
  このとき dist は `aidev smoke` の `pnpm -s build`（19:59）のもので、CSS の修正（20:08）は入っていなかった。
  **落ちたのは修正が効いていないからではなく、修正前のバンドルを見ていたから**（ビルド後は 10 件とも pass）。
- 決定: **この work では、E2E を走らせる前に必ず `pnpm build` を通す**。test-result.md にもその順序で記録する。
- 理由 / 代替案: `packages/e2e` の `test` を `pnpm -w build && playwright test` にするのが本筋だが、
  **E2E を 1 本ずつ走らせる運用（D104）では毎回 build が挟まって遅くなる**うえ、
  `packages/e2e/package.json` は他の work とも共有する。**手順の変更で足りる問題を設定の変更で塞がない**。
- 影響: **これは静かに効く穴**——コードを直さずに E2E を走らせても「通った」ように見え、
  逆に直した直後に走らせると「落ちた」ように見える。**この work の最初の E2E 一式（69 件 pass）も、
  cross 点検の修正が入る前のビルドに対して走っていた可能性がある**ので、ビルド後に走らせ直した
  （結果は test-result.md）。恒久対策（`test` スクリプトか CI で build を前置する）は backlog へ。
