# レビュー: workspace の既定の名前を、開いた場所（リポジトリ）から自動で付ける

## タスク点検ログ（coding 工程内・「3.3」(b)）

`mode: autonomous` なので、自前の差分を生むタスクはすべて点検する（T10 は差分を持たないので対象外）。指摘はその場で直した。

### T1（protocol の `autoLabel`・`WorkspaceRenameParams`）

- [nit][conv:-] 空白だけの `label` がスキーマを通ることをテストが守っていなかった（`.trim().min(1)` に替えても通った。design D10 は「`min(1)` は空白だけを通す」
  ことを前提にサーバで trim する）/ 対応: 空白だけが通ることを見る 1 行を足した
- [nit][conv:-] `autoLabel` の JSDoc の括弧書きが実際の規則より狭かった（ホームの `~`・根のパス、detached の worktree はパスの末尾）/ 対応: 書き足した

### T3（`SessionModel` の `autoLabel`）

- [should][conv:regression-negative-control] 復元のテストが `restoreWorkspace(data, true)` の一方向しか見ておらず、`autoLabel: true` に固定する変異が通った
  （付けた名前の workspace が復元で自動の名前として扱われる）/ 対応: `false` で復元する 1 行を足し、同じ変異で落ちることを確かめた（`nc-T3.txt`）
- [nit][conv:-] `restoreWorkspace` の行内のコメントが呼ぶ側の規則を言い直していて、design D10（空白だけも自動）が抜けていた / 対応: 「呼ぶ側が決める」だけにした
- [nit][conv:-] 足したテストの上のコメントが長く、`it` の題名とほぼ同じだった / 対応: 題名に無い事情（以前は印が無かった）だけにした

### T2（`session/workspaceLabel.ts`）

負の対照（`nc-T2.txt`）：`HEAD` を確かめない・`gitdir:` をたどらない・`core.bare` を見ない・ホームの `~` を外す、の 4 つがすべて落ちた。

- [should][conv:regression-negative-control] 上限のテストの「タイマーを残さない」は発火し終えた後に見ていて何も守っていなかった（`clearTimeout` を外しても、上限を 100ms にしても通った）/
  対応: 前の work の `newCwd.test.ts` と同じく「上限の前には決まらない」と「先に決まればタイマーを残さない」に分けた
- [nit][conv:-] config の見出しの扱いが herdr と違った（引用符つき・閉じていない見出しで節を抜けていた。herdr は素通りして前の節のまま）/ 対応: herdr の
  `simple_git_config_section` にそろえ、その違いを見るテストを足した
- [nit][conv:-] 正典の規則のうち守られていない分岐があった（bare の形の `objects`・`refs`・根の名前が空のときの代わり・`core.bare` の大小・`findGitRoot` の `resolve`）/
  対応: 1 つずつテストを足した（偽の fs は OS と同じく `..` を畳んで引くようにした）
- [nit][conv:-] 相対の `gitdir:` を字面で畳むので、cwd がシンボリックリンクの中だと herdr・git と答えが違いうる / 対応: 違いとして注記した（まれなので受け入れる）
- [nit][conv:-] Windows の UNC の共有の根は共有名になる（herdr はパスそのもの）/ 対応: 意図した違いとして注記した

直した後の負の対照（`nc-T2b.txt`）：7 つの変異がすべて落ちた。

### T4（作成で自動の名前）

負の対照（`nc-T4.txt`）：名前を渡さない経路に「1」を戻す・空白だけを付けた名前にする・名前を待つのを起動の後（commit の直前）へ移す、の 3 つがすべて落ちた。

- [should][conv:-] 自動の名前が「方針で決めた場所」（`resolvedCwd`）から付くことを守るテストが無かった（`autoLabelFor(cwd ?? defaultCwd)` に変えても通った。
  新しいテストはどれも場所を `cwd` で直接渡していた）/ 対応: `makeNewCwdService` に偽の名前の deps を渡し、「引き継ぐ」で `cd` した先の名前・代わりの場所の名前を
  見るテストを足した。同じ変異で落ちることを確かめた（`nc-T45b.txt`）
- [nit][conv:-] `placeFor` の注記（方針の無い要求は起動まで同期）が、workspace の作成で名前を待つ例外を書いていなかった / 対応: 例外を書き足した

### T5（名前変更で自動に戻す・世代の番号）

負の対照（`nc-T5.txt`）：付けた名前で世代を進めない・null を付けた名前にする・入口で await しない、は落ちた。「待っている間に閉じられたかを確かめない」は通った——
閉じたときに世代を消しているので世代の確認だけで守られる（二重の守り。片方を外しても通るのは許容した）。

- [should][conv:-] 2 本のテストが private の `workspaceLabelDeps` を `as unknown as` で書き換えて待ちを作っていた（型で守られず、名前が変わると黙って効かなくなる。
  先例も無い）/ 対応: 待ちを入れた deps をコンストラクタで渡す形（`gated()`）にした
- [nit][conv:-] 名前変更の後の保存の予約（`persist.touch`）を守るテストが無かった / 対応: null で戻すと 1 回・捨てた結果では予約しない、を見るテストを足した（`nc-T45b.txt`）
- [nit][conv:-] surface のテストが名前を確かめているのに本物の fs で決めていた / 対応: `makeContext` に偽の名前の deps を渡した
- [nit][conv:-] コメントとテストの題名の「NotFoundError」「同期で」が実際と違った（`RpcError("not_found")` の拒否）/ 対応: 直した

### T6（保存と復元）

負の対照（`nc-T6.txt`）：復元で決め直さない・付けた名前も決め直す・以前の版の「1」を付けた名前とみなす・保存で `autoLabel` を書かない、の 4 つがすべて落ちた。

- [should][conv:regression-negative-control] 新しい版で利用者が「1」と付けた workspace（`{ label: "1", autoLabel: false }`）の復元がテストに無く、`??` を `||` に変える
  （付けた名前「1」が復元のたびに自動の名前で上書きされる）変異が通った / 対応: その場合を足し、同じ変異で落ちることを確かめた（`nc-T6b.txt`）
- [nit][conv:-] 復元で全 workspace の名前を `Promise.all` で一度に決めると、上限のタイマーも一斉に始まり、workspace が多いと全部が上限に達してフォルダ名に
  落ちる（点検者が手元の ext4 で 400 個のとき全部落ちることを実測）/ 対応: 同時に決めるのを 8 個までにした（`RESTORE_LABEL_CONCURRENCY`）
- [nit][conv:-] index 付きの `forEach` と `!`、同じ呼び出しに `autoLabel` が 2 つあった / 対応: 名前と印を組にした配列を `for…of` で回す形にした

### T7（web の名前変更ダイアログ）

負の対照（`nc-T7.txt`）：変えずに確定しても送る・空で何もしない・手掛かりを tab でも出す・開いた時点の `autoLabel` を入れない、の 4 つがすべて落ちた。

- [should][conv:-] `NameDialog.vue` 冒頭のコメントが「空欄なら `confirmRenameWorkspace` は送らない」のまま残っていた / 対応: 空なら自動の名前に戻すと書き直した
- [should][conv:regression-negative-control] design D7 のうち「自動の名前のときに空で確定しても null を送る」と「開いた時点の値で判定する」をテストが守っていなかった /
  対応: 2 つのテストを足した（`nc-T7b.txt`）
- [nit][conv:-] 変えたかの判定で、trim した入力と trim していない今の名前を比べていた（前後に空白のあるフォルダ名で固定されてしまう）/ 対応: 両辺を trim した
- [nit][conv:-] 大小を区別して比べること・手掛かりを pane の名前変更と新しい tab で出さないことをテストが守っていなかった / 対応: テストを足した（`nc-T7b.txt`）
- [nit][conv:-] 手掛かりの 1 行がダイアログを横に広げ、自動か付けた名前かで幅が変わった / 対応: `max-width: min(30em, calc(100% - 16px))` で折り返させた
- [nit][conv:-] テストファイルの末尾に空行が増えていた / 対応: 消した
- [nit][conv:-] `DialogContext` の union の中で足したコメントだけが JSDoc だった / 対応: 行コメントにそろえた

### T8（文書）

- [must][conv:-] Windows の手順（`cd` した後の新しい workspace が `~`・`C:\`）は、既定の `powershell.exe` では「引き継ぐ」が `cd` に追従しない（前の work の既知の制約）
  ので、実装が正しくても期待どおりにならなかった / 対応: 場所を設定の「新しく開く場所」（ホーム・指定した場所）で選ぶ手順に書き直した
- [should][conv:-] 「Windows では単体テスト（`path.win32`）でしか確かめていない」と書いていたが、リポジトリの中の根の見つけ方は win32 の単体も無い / 対応: 書き分けた
- [should][conv:-] Linux の手順の「`wtm-plain` に `Ctrl+B W` で名前を付ける」は、直前に `~` の workspace へ表示が移っているので `~` に名前が付く /
  対応: サイドバーの行の右クリックの「名前の変更」を使う手順にした
- [should][conv:-] H01b の対応 AC に AC-I2（違い ②③ を決めている）が無かった / 対応: 足した
- [nit][conv:-] Linux の項目に「引き継ぐ」が前提であることが書いていなかった / 対応: 書いた
- [nit][conv:-] ホームの大小の違いの説明が不正確だった（herdr はドライブ文字の大小は同じに見るはず。違いは `HOME` 環境変数を読むこととフォルダ名の大小）/ 対応: 直した
- [nit][conv:-] UNC の共有の根の違い（実装のコメントに書いた 6 つ目の違い）が対応表に無かった / 対応: 足した
- [nit][conv:-] ③ の「tab と同じ扱い」が本製品の tab と読めた（本製品の tab の名前変更は変えずに確定しても送る）/ 対応: 「herdr の tab の名前変更と本製品の新しい tab」と書いた
- [nit][conv:-] 手掛かりの位置（入力欄の下）と、固定されていないことを確かめる方法の書き方 / 対応: 直した
- [nit][conv:-] 1 行が長かった / 対応: 既存の本文の幅に折り返した

### T9（E2E）

点検の前に、サーバが名前を渡さない作成に「1」を付け・web が空の確定で何も送らない（以前の形）ビルドで 2 件とも落ちることを確かめた（`nc-T9.txt`）。

- [should][conv:e2e-observe-browser!] goto の絞り込みの判定が、workspace の名前だけで当たったのかを見分けていなかった（絞り込みは pane の cwd も見る。元の pane の記録は
  エージェントの監視の見直しの後に `cd` 先へ追従するので、その前なら元の pane が既定の名前で当たり、workspace が親として残る。ブラウザ側の状態の印を待たずに判定していた）/
  対応: 絞り込んだ後に**全部の行**が既定の workspace の行だけになるまで待つ形にした（元の pane の行が当たらなくなって初めて、名前だけで当たっていると分かる）
- [nit][conv:-] 一時ディレクトリのパスに既定の名前が含まれる環境では判定が成り立たない / 対応: その場合は skip する
- [nit][conv:-] git が無い・git の外で走らせると生のエラーで落ちる。2 件目は期待値を求めるためだけに git を使っていた / 対応: 1 件目は分かる言葉で失敗させ、
  2 件目は付ける前の名前を画面から読む形にした（git に依らない）
- [nit][conv:-] `watchReceivedEvents` が `unknown` を返し、spec で型の断定を手で書いていた / 対応: `ServerEvent[]` を返し、`event` で絞るようにした。接続を分けないことを書いた
- [nit][conv:-] 2 回目のダイアログの `not.toContainText` は手掛かりが無くても通った / 対応: 付けた名前のときの文を丸ごと確かめた
- [nit][conv:-] `test.setTimeout` に理由が無く、`cd-done` を待つ `expect.poll` に `message` が無かった / 対応: 足した（2 件目の延長は外した）
- [nit][conv:regression-negative-control] 「1」を付けるビルドの負の対照はサイドバーの判定で先に落ち、`workspace.created` の判定（「1」を経ない）まで届いていなかった /
  対応: 「1」で作ってから後で自動の名前に直す（見た目は同じになる）ビルドで、`workspace.created` の判定だけが落ちることを確かめた（`nc-T9b.txt`）

### cross（タスクをまたぐ不変条件）

- [should][conv:-] 別のパッケージのコメント 3 か所が「サーバの既定の名前は "1"」を前提にしたままだった（worktree でブランチ名を渡す理由の説明・そのテスト・E2E）/
  対応: 渡さなければ worktree のフォルダ名が自動の名前になるが、ブランチ名のほうが情報が多いので渡す（herdr との違い ④）と書き直した
- [nit][conv:-] design D4b の「最悪 400ms」は、前の work の `isUsableDir`（上限なし）を見落としていた / 対応: 名前の上限が効くのは祖先の stat だけが遅い場合だと書き直した
- [nit][conv:-] design の振る舞いの詳細とエラー処理の表に、復元で同時に決める数（8 個）と `/ws` の受け付けの遅れが無かった / 対応: 書き足した
- [nit][conv:-] 文書の規則の書き方だと、ホームが git のリポジトリでも `~` と読めた（実装はリポジトリの判定が先）/ 対応: 順序を書き、手順の前提に「ホームが git の外」を書いた

## ラウンド 1（review 工程）

差分全体を別のコンテキストに点検させた（要件・価値・正確性・規約・保守性）。`aidev coverage` は tasks 承認時と同じ（ac=17、gaps=0）。

- [should][conv:-] `packages/server/src/session/workspaceLabel.ts:149-165`・`SessionService.ts:528-538` 上限の 200ms は呼ぶ側の待ちを止めるだけで、応答しない
  ファイルシステムへの stat は取り消されず、libuv のスレッドプール（既定 4 本）が止まったままになる。止まった後もたどりが親へ進んで stat を出し続ける。
  復元で 4 つ以上の自動の名前の workspace が止まったマウントの上にあると、静的ファイルの配信と `session.json` の保存まで止まる（以前の復元は cwd に fs で
  触らなかったので、この work で新しく入った壊れ方）/ 対応: coding へ差し戻す
- [nit][conv:-] `surface/methods/workspace.ts:19-20`・design の「NotFoundError（同期で）」が古いまま（T5 の点検で直した記録の残り）/ 対応: 直す
- [nit][conv:-] `SessionService.ts:532`・`:538` 復元の配列の型で `autoLabel` が任意に戻り、`?? false` で埋めている（design D2 の型で止める意図に反する）/ 対応: 型を付ける
- [nit][conv:-] `workspaceLabel.ts` の `rootWithin` が `newCwd.ts` の `liveCwdWithin` の写しで、効いていない `try/catch` がある / 対応: 上限つきの待ちを 1 つにまとめる
- [nit][conv:-] `SessionService.test.ts` の末尾に空行が増えた（T7 の点検で web で直したのと同じ）/ 対応: 消す

ラウンド 1 の対応：should は coding へ差し戻し、上限を超えたらそのたどりは fs に問い合わせない・60 秒の冷却・復元を 1 つずつ、にした（負の対照 `nc-R1.txt`）。nit 4 件も直した。

## ラウンド 2（review 工程）

どちらの should も**ラウンド 1 の直し方に由来する**（冷却の入り方・効く範囲と、1 つずつ決める復元の遅れ）。同じ規則（「止まった問い合わせをどう扱うか」）を支える箇所——
`withTimeout`・`findGitRoot` の `signal`・`SessionService` の冷却・作成・名前変更・復元・design・文書——をまとめて見直す。

- [should][conv:-] `SessionService.ts:111-117`・`:219` 1 回の名前決めが 200ms を超えただけで冷却に入り、60 秒の間**どの場所の** workspace もフォルダ名になる
  （遅いだけの fs——冷えたキャッシュ・autofs の初回・WSL2 の `/mnt/c`・イベントループの遅れ——でも入る）。文書の「応答しない fs の上で」より広い / 対応: 上限を超えた
  問い合わせが後から返ったら冷却を解く形にする（止まったままの間だけ探さない）
- [should][conv:-] design の「`/ws` の受け付けが遅れるのは最悪で上限 1 回分」は誤り（上限に達しない遅れは冷却を起こさず、1 つずつ決めると数に比例して積み上がる）/
  対応: 復元全体に合計の期限を設け、超えたら残りはフォルダ名にする
- [nit][conv:-] 冷却を `Date.now()`（壁時計）で測っている（このリポジトリは窓を単調な時計で測る——`LogThrottle.ts` の D103）/ 対応: 冷却は時計を使わない形にし、復元の期限は単調な時計で測る
- [nit][conv:-] design の「塞がるスレッドは 1 本」は 60 秒の窓ごとの数でしかない / 対応: 止まっている間は問い合わせない形にして書き直す
- [nit][conv:-] `withTimeout` が `onTimeout` を守りなしで `resolve` より先に呼ぶ（投げると呼ぶ側が永遠に待つ）/ 対応: 先に resolve し、try/catch で包む
- [nit][conv:-] `SessionService.test.ts` の末尾の空行がまだ残っていた / 対応: 消す

ラウンド 2 の対応：should 2 件はラウンド 1 の直し方に由来するので、「止まった問い合わせをどう扱うか」を支える項目を列挙して作り直した——
① 上限を超えたたどりは問い合わせない ② 上限を超えた問い合わせが**返るまでだけ**新しく根を探さない（時計を使わない。60 秒の冷却をやめた）③ 復元は合計 1 秒の
期限（単調な時計）④ 合図の関数が投げても待っている側は戻る ⑤ その間のフォルダ名も自動の名前のまま。8 通りの変異がすべて落ちた（`nc-R2.txt`）。nit 4 件も直した。

## ラウンド 3（review 工程）

- [should][conv:-] `docs/verification.md:700-704` 「既知の制約」が、止まっている間は**どの場所でも**（ローカルの正常なリポジトリでも）作成・空の確定・復元がフォルダ名になることを
  書いておらず、戻し方（空で確定・起動し直す）は止まったままの間は効かない / 対応: 見え方と戻し方（その fs が応答するようになってから `Ctrl+B W` で空にして確定）を書き直す
- [nit][conv:-] `SessionService.ts:123-127` 数を増やした後・数を戻す処理を付ける前に `logger.warn` を呼んでいて、warn が投げると数が戻らない / 対応: 戻す処理を先に付ける
- [nit][conv:-] `withTimeout.ts:6` 注記の「待っている側を先に戻してから呼ぶ」は実際の順序と逆（resolve は先だが、待っている側が再開するのは `onTimeout` の後）/ 対応: 書き直す
- [nit][conv:-] `SessionService.ts:588` 復元が合計の期限を過ぎて残りをフォルダ名にしたとき、ログが出ない / 対応: warn を 1 度出す
- [nit][conv:-] `SessionService.test.ts:955` describe の注記が「しばらく」（ラウンド 1 の冷却）のまま / 対応: 直す
- [nit][conv:-] requirements の非機能要件の例外（その場所のフォルダ名）より広がった分（止まっている間はほかの場所も・復元の合計の期限）が decisions に無く、test-result は
  AC1・AC6 を無条件に pass としていた / 対応: 受け入れた割り切りとして decisions に残し、test-result に条件を書く

ラウンド 3 の対応：差し戻しが上限（3 回）に達したが、原因は特定済み（文書の範囲の書き方と小さな順序・ログ）なので debug は省き（decisions の「デバッグ D1」）、
修正は新しい実装のコンテキストに委ねた。should と nit 5 件を直し、受け入れた割り切りを decisions D4 に残した。負の対照 3 通りがすべて落ちた（`nc-R3.txt`）。

## ラウンド 4（review 工程）

must・should は無し（nit のみ。差し戻さない）。

- [nit][conv:-] `test-result.md` の AC2・AC4 も decisions D4 の影響を受けるのに条件なしの pass だった（decisions D4 の「影響」も AC1・AC6 だけ）/ 対応: 条件を足した
- [nit][conv:regression-negative-control] 期限を過ぎた後に付けた名前の workspace を並べたテストが無く、`restoredLabel` の「付けた名前」と「期限」の判定の順を入れ替える変異を
  捕まえられなかった（遅い復元で付けた名前がフォルダ名に上書きされる）/ 対応: 期限のテストに付けた名前の workspace を足した。同じ変異で落ちることを確かめた（`nc-R4.txt`）
- [nit][conv:-] 期限の警告の `remaining` が付けた名前の workspace も数えていた / 対応: 自動の名前だけを数える（`isAutoLabel` を 1 か所にまとめた）
