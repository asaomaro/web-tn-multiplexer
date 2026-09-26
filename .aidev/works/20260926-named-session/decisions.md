# 判断の記録（20260926-named-session）

## D1: 着手の判定と、1 PR に収める範囲（2026-09-26・requirements）

- 背景: backlog `product-roadmap.md`「セッション永続化の拡張: 名前付き session〔D8〕」を autonomous で進める
  （主エージェントの依頼。worktree `feature/named-session`）。依存 `20260918-web-terminal-multiplexer` は deliver 済み。
  herdr の名前付き session は（一次資料 `scratchpad/herdr/src/session.rs`・`src/cli.rs`）
  (1) `--session <name>`／`session attach <name>` で選ぶ、(2) 状態は `<config_dir>/sessions/<name>/`（既定の session は
  `<config_dir>` 直下）、(3) `default` は既定の session の別名、(4) `session list [--json]`・`stop <name>`・`delete <name>`、
  (5) socket も session ごと（`sessions/<name>/herdr.sock`）、(6) 名前は 1〜64 バイトの ASCII 英数字と `.` `_` `-`、
  `.`/`..` 不可、(7) 環境変数 `HERDR_SESSION` で CLI の既定を選べる、から成る。
- 決定: この PR では (1)(2)(3)(4 のうち list・delete)(5 は状態ディレクトリごと既に分かれる)(6) を入れる。
  `stop`・ブラウザでの session の表示/切り替え・session ごとのポートの記憶・環境変数は対象外とし、backlog に兄弟の行として残す。
  profile は full のまま（CLI の新しいサブコマンド・削除という破壊的な操作・名前の規則という安全面を含むため light ではない）。
- 理由・代替案:
  - `stop` は herdr では session の socket に `server.stop` を送る。本製品のサーバは外から止める経路を持たず、
    足すなら `wtm.lock` の pid へシグナルを送る形になるが、pid の再利用（`docs/tls-setup.md` が既に書いている）で
    無関係なプロセスを止めうる。安全に作るには別の設計（止めるための認証つきの経路）が要るので分けた。
  - Web 版では別の session は別の URL（ポート）で、`attach` に当たるのは「その URL をブラウザで開く」こと。
    画面での session 名の表示・切り替えは UI の work になるので分けた。
  - 環境変数は、pane の中から起動した `wtm serve` が親の session を暗黙に引き継ぐ等の驚きを生みうるうえ、
    本製品の CLI（wtmctl）は URL で繋ぐので herdr ほどの必要が無い。
- 影響: backlog に `[ ]` の兄弟（stop・画面表示と切り替え・ポートの記憶）を deliver で足す。research 工程は挟まない
  （herdr の仕様と本製品の状態ディレクトリの使われ方は requirements の段階で一次資料を直読して確かめ、
  パスの長さの副作用は手元で実測した——design の「依拠する既存の事実」に出所つきで書く）。

## D2: 置き場所・`--state-dir` との関係・名前の規則・socket のパス長（2026-09-26・design）

- 背景: design で requirements の未確定事項（置き場所・規則の細部・パスの長さの副作用・動いているかの判定）を決める。
  autonomous で humanGates は空なので、方針の事前承認は取らず、方針と採らなかった案をここに残して design の承認で受ける。
- 決定:
  1. 置き場所は `<既定の状態ディレクトリ>/sessions/<name>/`（herdr の `config_dir/sessions/<name>` と同じ形）。既定の session は今までどおり。
  2. `--state-dir D --session N` は `D/sessions/N`（`--state-dir` を「既定の session の状態ディレクトリ」とみなす）。
  3. 名前の規則は herdr の `validate_name` に「先頭の `-` 不可・末尾の `.` 不可・Windows の予約デバイス名不可」を足す。
  4. 公式フック連携の Unix socket のパスが上限（Linux は実測 108 バイト、他は 103 とみなす）を超えるなら、起動前に
     `ConfigError`（終了コード 2）で「短い名前か短い --state-dir を」と案内する。
  5. 動いているかは `wtm.lock` を読み取り専用で判定（`StateDirLock.inspect()`）。削除はロックを取ってから消す。
- 理由・代替案:
  - 置き場所の代替案「既定の状態ディレクトリと兄弟（`web-tn-multiplexer-<name>`）」は、一覧で親を走査しにくく、
    `--state-dir` との関係も決めにくいので退けた。
  - `--state-dir` と `--session` の併用を禁じる案は、LAN 用に別ディスクへ状態を置いている利用者がその下で名前付き session を
    使えなくなるので退けた。
  - 名前の規則を herdr のまま（足さない）にする案: `--session -x` で作った session が `wtm session delete -x`（`-x` を
    オプションと読む）で消せず、Windows ネイティブで `work.` と `work`・`con` が問題になる（本製品は Windows ネイティブも対象）。
    herdr より厳しくしても herdr の利用者が困る名前はほぼ無い。
  - socket のパス長: 代替案「長ければ短い別の場所（`/tmp` 等）に socket を置く」は、共有の `/tmp` で他の利用者に名前を先取り
    される等の安全面の設計が要るので退けた。既定の状態ディレクトリ（`~/.local/state/web-tn-multiplexer`、この環境で 43 バイト）
    なら 37 バイト程度までの名前は通る。名前の上限を 64 から縮める案は、ホームのパスの長さ次第でどのみち保証にならないので退けた。
    既存の起動でも、今まで `EINVAL` の終了コード 1（token を作った後）で落ちていた長さだけが案内つきの終了コード 2 に変わる
    （起動できていた長さは実測の上限なので変わらない）。macOS の 104 バイトは未確認（手元に無い）。
- 影響: tasks・test はこの 5 点を AC2・AC6〜AC9 の検証対象にする。docs に「名前は短めに」の注意を書く。

## D3: design の独立点検が上限（2 ラウンド）に達した／`ConfigError` を別ファイルへ（2026-09-26・design→coding）

- 背景: design の doccheck は 1 巡目 10 件・2 巡目 5 件（いずれも関数名・置き場所・出所の書き漏れ等）。上限 2 に達した。
  また実装で `persist/namedSession.ts` が `ConfigError` を使うと、`config.ts`→`namedSession.ts`→`config.ts` の循環 import になる。
- 決定: 2 巡目の 5 件はその場で直し、3 巡目は行わず design を承認する（残る疑問は review に委ねる）。`ConfigError` は
  `src/configError.ts` へ移し、`config.ts` から同じ名前で再 export する（既存の import はそのまま動く）。
- 理由・代替案: 2 巡目の指摘はいずれも記述の書き漏れで、方針の誤りは出ていない。循環は ESM では関数の中でしか使わないので
  動きはするが、評価順に依存するので避けた。
- 影響: 対象範囲に `src/configError.ts`（新規）が加わる。

## D4: 点検の並行で同じファイルが壊れた件と、削除を「移してから消す」に変えた件（2026-09-26・coding）

- 背景: T1 と T3 の点検を並行して委譲したところ、両者が同じ `persist/namedSession.ts` に変異を入れ、T3 の点検者が退避した
  「元の内容」が T1 の変異の途中の状態だった。書き戻しの結果、`.`/`..` を断る 1 行が消えた（T3 の点検者が自己申告。
  `check-T1/orig.ts` と diff して 1 行だけの差と確認し、そこから戻して `cmp` で一致を確かめた）。また T3 の点検で、
  ロックを取ってからその場で `rm -r` すると、`wtm.lock` が先に消えた後に起動した wtm がロックを取れてしまう（推測・未再現）と指摘された。
- 決定:
  1. 同じファイルに変異を入れうる点検は並行させない。並行させるときは、変異してよいファイルを点検者ごとに分けて指示する。
     T1・T3 の変異の結果は信用できないので、直した後に 2 巡目の点検を直列で行う。
  2. 削除は、ロックを持ったまま `sessions/<name>~deleting-<pid>-<時刻>`（`~` を含むので規則に合わず、一覧にも `--session` にも
     出ない）へ `rename` してから `rm -r` する。`rename` の失敗は `remove-failed`（ロックを放す）。
  3. 起動時の表示の「token を忘れた場合は…」と、起動の途中の失敗の token の表示の案内を、名前付き session のときは
     `wtm token reset --session <名前>` にする（付けないと既定の session の token を作り直してしまう。design の起動時の表示の節に無かった追加）。
- 理由・代替案: 2 の代替案「rm の前後でロックを取り直す」は、消している間のどの時点でも同じ隙間が残る。rename は同じ
  ファイルシステムの中では原子的なので、元の名前は「ロック付きで存在する」か「存在しない（新しく作られる）」のどちらかになる。
- 影響: design の削除の手順 6 を実装が上書きした（review で design との差として読む）。T1・T3 は 2 巡目の点検を行う。

## D5: T3 のタスク点検が上限（2 ラウンド）に達した（2026-09-26・coding）

- 背景: T3（一覧と削除）の点検は 1 巡目 4 件（うち 1 件は点検の並行の事故。D4）・2 巡目 4 件。2 巡目は「rename してから消す」直しを
  捕まえるテストが無い等、テストの不足だけで、実装の欠陥の指摘は無かった。
- 決定: 2 巡目の 4 件を直し（rm の途中の失敗で元の名前が残らないことを確かめるテスト等）、3 巡目は行わない。残る疑問は review に委ねる。
  あわせて test 工程の負の確認で、rename をやめてその場で消す変異がテストで落ちることを確かめる。
- 理由・代替案: 上限は `maxTaskCheckRounds`（2）。直した内容はテストの追加だけで、実装の判定は変えていない。
- 影響: review で T3 の差分を重点的に見る。

## D6: `wtm token reset --session` は在る session だけ・案内に `--state-dir` も付ける（2026-09-26・coding の cross 点検）

- 背景: cross 点検で、(1) 起動時の表示の token の作り直しの案内が名前しか見ず、`--state-dir D --session lan` の起動で別の session を
  指す、(2) `wtm token reset --session <打ち間違い>` が `StateDirLock.acquire()` の mkdir で新しい session を黙って作る、と指摘された。
- 決定: (1) 利用者が渡した `--state-dir` を `NamedSessionInfo.stateDirArg` として表示に渡し、あれば `--state-dir …`（空白等は引用）も付ける。
  名前付きでない起動の表示は変えない（今までも `--state-dir` を付けていない。AC9 のとおり変えない——既存の小さな不足として残す）。
  (2) 名前付き session の状態ディレクトリがディレクトリとして無ければ `ConfigError`（終了コード 2）で断る。session を作るのは `wtm serve --session` だけ。
- 理由・代替案: (2) の代替案「作ってよい（herdr の use or create に倣う）」は、token だけの空の session が `wtm session list` に現れ、
  打ち間違いに気づけない。herdr には token が無いので倣う対象が無い。
- 影響: smoke の 3 本目は `mkdir -p "$d/sessions/smoke"` で session を用意してから token reset する。docs に「無い名前は断る」を書いた。

## D7: review ラウンド 1 の差し戻しへの対応（2026-09-26・coding 再開）

- 背景: 独立レビューで should 2・nit 3（review.md「ラウンド 1」）。
- 決定: (1) token の作り直しの案内に載せる `--state-dir` は、利用者が渡した値を `path.resolve` した絶対パスにし、記号を含むときは
  単一引用符で囲む（bash・PowerShell の両方で文字どおり。`'` は POSIX の `'\''`——PowerShell では崩れるが、`'` を含む状態ディレクトリは
  稀なので許容）。`NamedSessionInfo.stateDirArg` は `stateDirBase` に改名。(2) `wtm session delete` の使用中の拒否に、`wtm serve` の
  `stateDirInUseError` と同じ「落ちて残ったロックの消し方」を添える（`config.ts` の関数は循環 import になるので文面を namedSession 側に書いた）。
  (3) token reset の存在確認は `stat`（シンボリックリンクを辿る。`wtm serve --session` と同じ）で、ENOENT・ENOTDIR 以外は投げる。
  (4) `resolveServeOptions` の名前付きの判定は `sessionName` で行う。(5) namedSession.test.ts を prettier で整形。
- 理由・代替案: (1) の代替案「二重引用符で `$` 等をエスケープ」は bash と PowerShell でエスケープの文字が違う。単一引用符は両方で展開しない。
- 影響: docs の delete の項に古いロックの扱いを 1 文足した。EACCES 等を投げる分岐のテストは足していない（review に委ねる）。
