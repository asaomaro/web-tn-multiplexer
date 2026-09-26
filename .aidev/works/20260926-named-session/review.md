# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）

- [nit][conv:regression-negative-control] packages/server/src/persist/namedSession.test.ts 予約名の COM0・LPT0 を確かめる名前が無く `com[1-9]` への退行を捕まえられない / 対応: 修正済（T1・ラウンド1。com0・LPT0 を追加）
- [nit][conv:regression-negative-control] packages/server/src/persist/namedSession.test.ts 予約名の正規表現の `^` を外しても通る（末尾だけ予約名の使える名前が無い） / 対応: 修正済（T1・ラウンド1。xcon・mycom1 を追加）
- [nit][conv:-] packages/server/src/persist/namedSession.test.ts hint の確認が try/catch の中だけで、投げなくなっても通る / 対応: 修正済（T1・ラウンド1。toThrow(objectContaining)）
- [nit][conv:regression-negative-control] packages/server/src/persist/StateDirLock.test.ts inspect のテストが同じ pid の枝（heldInThisProcess）を通らない / 対応: 修正済（T2・ラウンド1）
- [must][conv:-] packages/server/src/persist/namedSession.ts:25 並行した点検者どうしの変異の書き戻しで `.`/`..` を断る行が消えた（コードの欠陥ではなく点検の事故） / 対応: 修正済（T3・ラウンド1。check-T1/orig.ts から戻し cmp で一致。decisions D4）
- [should][conv:-] packages/server/src/persist/namedSession.ts `deleteSession` ロックを取ってその場で rm -r すると wtm.lock が先に消えた後の起動がロックを取れる / 対応: 修正済（T3・ラウンド1。`~deleting-` の名前へ rename してから消す。decisions D4）
- [nit][conv:-] packages/server/src/persist/namedSession.test.ts 一覧で別のホストの持ち主の host を載せる分岐を通っていない / 対応: 修正済（T3・ラウンド1）
- [nit][conv:-] packages/server/src/persist/namedSession.test.ts remove-failed と普通のファイルの not-directory を通っていない / 対応: 修正済（T3・ラウンド1）
- [should][conv:-] packages/server/src/cliArgs.ts:19,24 parseArgs の doc コメントが token reset の --state-dir だけ・session を書いていない / 対応: 修正済（T5・ラウンド1）
- [nit][conv:-] packages/server/src/cliArgs.ts:92 `--json is not an option of wtm token` が既存の `wtm token reset` の書き方とそろっていない / 対応: 修正済（T5・ラウンド1）
- [nit][conv:-] packages/server/src/cliArgs.ts `wtm session delete`（名前なし）が unknown subcommand になり原因が分かりにくい / 対応: 修正済（T5・ラウンド1。missing session name）
- [nit][conv:-] packages/server/src/main.ts 新しいコマンドの振り分けと token reset の --session が未配線 / 対応: 修正済（T7 で配線。T5 の差分の外）
- [should][conv:regression-negative-control] packages/server/src/startupBanner.test.ts 名前付き session の行を token を作った初回で確かめていない / 対応: 修正済（T6・ラウンド1。URL あり・URL 0 件）
- [nit][conv:-] packages/server/src/persist/namedSession.ts:35-38 規則外の名前の ConfigError の message（どの名前をなぜ断ったか）を確かめていない / 対応: 修正済（T1・ラウンド2）
- [should][conv:-] packages/server/src/config.ts パス長の案内が `--session` なしの起動にも「--session に短い名前」を勧める（既定の session に --session を足すとパスは長くなる） / 対応: 修正済（T4・ラウンド1。名前付きのときだけ出す）
- [should][conv:-] docs/tls-setup.md 「消している間に起動しても wtm.lock で止まる」が rename 後には成り立たない / 対応: 修正済（T9・ラウンド1）
- [should][conv:-] docs/verification.md `running (pid …)` という表示は出ない（pid は行末） / 対応: 修正済（T9・ラウンド1）
- [nit][conv:-] docs/tls-setup.md delete の --json と、規則外の名前の終了コード 2 が読み取りにくい / 対応: 修正済（T9・ラウンド1）
- [should][conv:regression-negative-control!] packages/server/src/persist/namedSession.test.ts rename してから消す直しを捕まえるテストが無い（その場で rm に戻しても通る） / 対応: 修正済（T3・ラウンド2。stuck サブディレクトリで rm だけを途中で失敗させ、元の名前が残らないことを確かめる）
- [should][conv:-] packages/server/src/persist/namedSession.ts:169-175 rm の途中の失敗を remove-failed に包む分岐を通っていない / 対応: 修正済（T3・ラウンド2。上と同じテスト）
- [nit][conv:-] packages/server/src/persist/namedSession.test.ts `~deleting-` を一覧に出さないテストが deleteSession を呼ばず、既存の規則外の文字の除外と重複 / 対応: 修正済（T3・ラウンド2。rm の途中の失敗のテストの中で一覧を確かめる形に置き換え）
- [nit][conv:-] packages/server/src/persist/namedSession.ts:88 `.sort()` を消しても通る（readdir の順がたまたま名前順） / 対応: 修正済（T3・ラウンド2。8 件を逆順に作る）
- [should][conv:-] packages/server/src/sessionCommands.ts:22 別のホストの `(pid N on host)` の分岐をテストが通っていない / 対応: 修正済（T7・ラウンド1）
- [nit][conv:-] packages/server/src/sessionCommands.ts:91-93 token reset の後にロックを放すことを確かめていない / 対応: 修正済（T7・ラウンド1）
- [should][conv:-] packages/server/src/composeServer.integration.test.ts:69-79 AC1 の「既定の session の状態を読まない」を確かめていない（base が空） / 対応: 修正済（T8・ラウンド1。既定の session に目印の workspace と動いているロックを置き、work が復元せず、3 ファイルの内容と mtime が変わらないことを確かめる）
- [nit][conv:-] packages/server/src/composeServer.integration.test.ts:101 `join(base, "..", "escape")` の断定は実装に関係なく通る / 対応: 修正済（T8・ラウンド1。削除）
- [nit][conv:-] packages/server/src/composeServer.integration.test.ts:81-89 2 つ目の起動の後始末が cleanups に無い・2 つの listening を 1 つの真偽値で断定 / 対応: 修正済（T8・ラウンド1）
- [should][conv:-] packages/server/src/startupBanner.ts `tokenResetCommand` が名前だけで組み立て、`--state-dir D --session lan` で起動したとき案内が別の session（既定の下の lan）を指す（cross） / 対応: 修正済（cross・ラウンド1。`--state-dir` を渡して起動したならそれも付ける）
- [nit][conv:-] packages/server/src/sessionCommands.ts `wtm token reset --session <打ち間違い>` が新しい session を黙って作る（delete は存在を確かめるのと食い違う）（cross） / 対応: 修正済（cross・ラウンド1。無ければ ConfigError で断る。decisions D6）
- [nit][conv:-] docs/tls-setup.md:406 状態ディレクトリ使用中の案内の出力例が旧文面のまま（cross） / 対応: 修正済（cross・ラウンド1）

## ラウンド 1（2026-09-26）

独立レビュー（別コンテキスト・opus）。must 0・should 2・nit 3。

- [should][conv:-] packages/server/src/startupBanner.ts:70 token の作り直しの案内の `--state-dir` の引用が JSON.stringify の二重引用符で、`$`・バッククォートが bash で展開される（別の状態ディレクトリを指す）。Windows のパスは `\` が二重になり、相対パスは起動した cwd でしか正しくない / 対応: 差し戻し
- [should][conv:-] packages/server/src/persist/namedSession.ts:150-156 `wtm session delete` が使用中のロックを「止めてから消して」とだけ言い、別ホスト・作り直したコンテナ・pid の再利用の古いロックの案内が無い（止める相手がいないのに手で rm するしかない。US3 に反する） / 対応: 差し戻し
- [nit][conv:-] packages/server/src/sessionCommands.ts:81,104-109 token reset の存在確認が lstat なので、シンボリックリンクの session を断り、EACCES 等も「ありません」になる / 対応: 差し戻しに含めて直す
- [nit][conv:-] packages/server/src/config.ts:133,141 base と byteLength を 2 回ずつ計算・名前付きの判定を stateDir の比較で行っている / 対応: 差し戻しに含めて直す
- [nit][conv:-] packages/server/src/persist/namedSession.test.ts 新規ファイルなのに prettier --check が通らない / 対応: 差し戻しに含めて直す

## ラウンド 2（2026-09-26）

独立レビュー（別コンテキスト・opus）。ラウンド 1 の 5 件は 5/5 解消（引用はビルドした CLI で相対・空白・`$` を含む `--state-dir` の案内を別の cwd から打って成功、古いロックの案内はテキスト・`--json` とも確認）。must 0・should 0・nit 1。

- [nit][conv:regression-negative-control] packages/server/src/sessionCommands.ts:114 token reset の存在確認で ENOENT・ENOTDIR 以外を投げる分岐を守るテストが無い（`throw err` を `return false` にしても通る） / 対応: 許容（nit。以前は lstat の失敗をすべて「ありません」にしていたのを直した分岐で、振る舞いは読解で確かめた。後続でテストを足す余地として残す）

レビュー補助（walkthrough.md）: 書かない。差分は packages/server の CLI と状態ディレクトリの解決に閉じ（Web・protocol・SessionService は不変）、責務の境界も動かしていない。処理フローで非自明なのは削除の「ロック→rename→rm」だけで、decisions D4 と design の削除の手順に書いてある。
