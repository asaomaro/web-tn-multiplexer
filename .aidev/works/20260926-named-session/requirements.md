# 要件: 名前付き session（herdr の `--session <name>` 相当）

## 背景 / 課題

herdr には「名前付き session」がある（`docs/herdr-parity.md` の H33。backlog
`product-roadmap.md`「セッション永続化の拡張: 名前付き session〔D8〕」）。herdr では
`herdr --session <name>`（または `herdr session attach <name>`）で、pane・socket・保存状態が
**まるごと別の**実行時の名前空間を使い、`herdr session list / stop / delete` で一覧・停止・削除できる
（一次資料: herdr `src/session.rs`・`src/cli.rs` の `run_session_command`・
`docs/versions/0.9.1/website/src/content/docs/concepts.mdx`「Session」節）。

本製品では、同じことをするには利用者が `--state-dir <任意のパス>` を自分で決めて覚えておく必要がある
（`docs/tls-setup.md`「手元用と LAN 用を並行して動かす（`--state-dir` を分ける）」）。
状態ディレクトリの置き場所・名前の付け方は利用者任せで、いま幾つあるか・どれが動いているかを知る手段も、
使わなくなった分を安全に消す手段も無い（手で `rm -rf` するしかなく、動いている最中のものを消しうる）。

## 目的 / ゴール

- 利用者が**名前だけで**別々の保存状態（token・workspace・pane・設定連携）を使い分けられ、
  その置き場所を覚えていなくてよい状態。
- 名前付き session の一覧（動いているか・どこにあるか）が 1 コマンドで分かり、
  **動いていない**名前付き session だけを安全に消せる状態。
- 名前を指定しない利用者には何も変わらない状態（既存の保存状態・既存の `--state-dir` の使い方がそのまま動く）。

## ユーザーストーリー

- US1: 手元用と LAN 用・仕事用と私用などで `wtm serve` を並行して動かす利用者として、`--session <名前>` だけで
  別の保存状態を使いたい。なぜなら、状態ディレクトリのパスを自分で決めて毎回正確に打つのは面倒で、
  打ち間違えると別の（空の）状態で起動してしまうから。また、起動した画面や失敗の案内を見て、どの session か・どう分ければよいかが分かれば迷わないから。（受け入れ: AC1, AC2, AC3, AC4, AC5, AC10, AC12, AC13）
- US2: 名前付き session を使っている利用者として、どんな名前付き session があり、どれが動いているかを一覧したい。
  なぜなら、どの名前で何を動かしたかを忘れても、止め忘れ・消し忘れを見つけられるから。（受け入れ: AC6）
- US3: 使わなくなった名前付き session を片付けたい利用者として、名前を指定して消したい。
  なぜなら、手で `rm -rf` すると動いている最中の状態や、名前を打ち間違えて別の場所を消しかねないから。
  （受け入れ: AC7, AC8）
- US4: 既存の利用者として、名前付き session を使わない限り、今までの起動方法・保存状態がそのまま使えてほしい。
  なぜなら、更新しただけで workspace・pane・token が消えたり場所が変わったりすると困るから。（受け入れ: AC9）
- US6: 本製品を初めて使う・久しぶりに使う利用者として、名前付き session の使い方と herdr との違いを docs で知りたい。
  なぜなら、herdr から移ってきた利用者は同じ操作を探すし、できないこと（stop 等）を知らないと試して迷うから。（受け入れ: AC11）
- US5: 運用者として、名前に何を渡してもサーバの状態ディレクトリの外を読み書き・削除しないでほしい。
  なぜなら、名前はそのままディレクトリ名に使われるので、`../` 等で任意の場所を指せると事故や攻撃につながるから。
  （受け入れ: AC2, AC8）

## スコープ

### 対象

- `wtm serve` と `wtm token reset` に、名前付き session を選ぶ指定を足す。
- 名前の規則（受け付ける文字・長さ・予約名）と、規則外の名前を起動前に断ること。
- 名前付き session の一覧（`wtm session list`）と削除（`wtm session delete <name>`）。
- 既定の session（名前を指定しない場合）を herdr と同じく `default` という名前でも指せること。
- 起動時の表示・既存の案内文（ポート使用中・状態ディレクトリ使用中）での名前付き session への言及。
- 利用者向け docs（`docs/tls-setup.md`「起動と運用の注意」・`docs/verification.md`）と
  `docs/herdr-parity.md` の H33 行の更新。

### 対象外

- **動いている名前付き session を CLI から止めること**（herdr の `herdr session stop <name>`）。
  本製品のサーバは外部から止める経路（herdr の `server.stop` を受ける socket）を持たない。
  backlog に兄弟の行として残す（design で理由を詰める）。
- **ブラウザの画面での session の表示・切り替え**（herdr の `session attach` はターミナルのクライアントが
  別の socket に繋ぎ直す操作。Web 版では別の session は別の URL（ポート）なので、切り替えはブラウザで
  その URL を開くことに当たる）。backlog に兄弟の行として残す。
- **session ごとにポートを覚えておくこと**（名前だけで同じポートに起動し直す）。同上。
- herdr の環境変数 `HERDR_SESSION`（CLI の既定の session を環境変数で選ぶ）に当たるもの。
- wtmctl（`packages/cli`）の変更。wtmctl は URL（`--url`）で繋ぐので、別の session には別の URL を渡せば足りる。
- 既存の保存状態を名前付き session へ移す（移行）機能。
- E2E（packages/e2e）の追加・実行（利用者の方針）。

## 機能要件

- F1: `wtm serve --session <name>` は、名前 `<name>` の session の状態ディレクトリ（token・workspace/pane の保存・
  連携の設定・ログ・ロック）を使って起動する。その状態ディレクトリが無ければ作る（herdr の「Use or create」）。
- F2: 名前付き session の状態ディレクトリは、既定の session の状態ディレクトリの**下の決まった場所**に置く
  （利用者が場所を覚えなくてよい）。`--state-dir` と併用したときは、`--state-dir` を既定の session の
  状態ディレクトリとみなし、その下に置く。
- F3: `--session default` は名前を指定しないのと同じ（既定の session）。
- F4: 名前が規則に合わなければ、何も作らず・読まずに、理由と規則を示して終了コード 2 で止まる。
- F5: `wtm token reset --session <name>` は、その名前付き session の token を作り直す。
- F6: `wtm session list` は既定の session と全ての名前付き session を、名前・動いているか・状態ディレクトリとともに
  一覧する（機械向けの出力も選べる）。
- F7: `wtm session delete <name>` は、動いていない名前付き session の状態ディレクトリを丸ごと消す。
  動いているもの・既定の session・存在しないもの・規則外の名前は消さずに断る。
- F8: 同じ名前付き session の `wtm serve` を 2 つ動かそうとすると、既存の `wtm.lock` と同じく 2 つ目が止まる。
- F9: 名前付き session で起動したときは、起動時の表示でどの session か分かる。
- F10: ポートが使用中・状態ディレクトリが使用中の案内は、並行して動かす手段として名前付き session も示す。

## 非機能要件 / 制約

- **互換性（必須）**: `--session` を付けなければ、状態ディレクトリの場所・中身の形式・起動時の表示・案内の
  終了コードは今までと同じ。既存の `session.json`・`auth.json` 等は移動も変換もしない。
- **安全性**: 名前はディレクトリ名として使うので、パスの区切り・`.`/`..`・制御文字・OS の予約名等で状態ディレクトリの
  外や別の場所を指せないこと。削除は、規則に合う名前の、実在するディレクトリ（シンボリックリンクでない）の、
  動いていないものに限る。
- **可搬性**: Linux・macOS・WSL2・Windows ネイティブで同じ名前の規則が通ること（Windows で作れない・別名に
  なる名前を受け付けない）。
- 検証は vitest（単体・結合）と `aidev smoke`。E2E は走らせない。

## 完了条件 (受け入れ基準)

- [ ] AC1: `wtm serve --session work` が、既定の状態ディレクトリの下の名前付きの場所に状態（`wtm.lock`・`auth.json`・`session.json` 等）を作って起動し、既定の session の状態ディレクトリ直下の `session.json`・`auth.json` を読み書きしない。
- [ ] AC2: 規則外の名前（空・`.`・`..`・`/` や `\` を含む・長すぎる・許可外の文字・OS の予約名等。細部と長さの上限は design で決める）を `--session` に渡すと、状態ディレクトリを作らず・既存の状態ファイルを読まずに、終了コード 2 で理由を示して止まる（`wtm serve`・`wtm token reset`・`wtm session delete` のどれでも）。
- [ ] AC3: `--session default` は `--session` を付けないのと同じ状態ディレクトリを使う。
- [ ] AC4: `--state-dir D --session work` は `D` の下の名前付きの場所を使う。
- [ ] AC5: 同じ名前付き session の 2 つ目の `wtm serve` は `wtm.lock` で止まり、別の名前の session は（ポートを変えれば）並行して動く。
- [ ] AC6: `wtm session list` が既定の session と名前付き session を名前順に、動いているか（running / stopped）と状態ディレクトリつきで出し、`--json` で同じ内容を JSON で出す。規則外の名前のディレクトリ・ディレクトリでないもの（ファイル・シンボリックリンク）は出さない。
- [ ] AC7: `wtm session delete <name>` が、動いていない名前付き session の状態ディレクトリを丸ごと消し、動いている session・`default`・存在しない名前は消さずに終了コード 1 以上で理由を示す。
- [ ] AC8: `wtm session delete` は、名前の綴りがディレクトリの実際の名前と完全に一致するとき（大文字小文字を区別しない FS での別の綴りを含め）だけ消し、シンボリックリンクは辿らず消さない。
- [ ] AC9: `--session` を付けない `wtm serve`・`wtm token reset` の状態ディレクトリ・起動時の表示・案内の終了コードが変更前と同じである（既存のテストが通り、表示の差分が名前付きのときだけに限られる）。
- [ ] AC10: 名前付き session で起動したとき、起動時の表示にその名前が出る。
- [ ] AC12: `wtm token reset --session work` が名前付き session `work` の token だけを作り直し、既定の session の `auth.json` を変えない。
- [ ] AC13: ポートが使用中（`EADDRINUSE`）・状態ディレクトリが使用中（`wtm.lock`）の案内に、並行して動かす手段として `--session` が含まれる。
- [ ] AC11: 利用者向け docs（`docs/tls-setup.md`・`docs/verification.md`）と `docs/herdr-parity.md` の H33 行が、名前付き session の使い方・herdr との違い・対象外にしたものを説明している。

## 未確定事項 / 確認したいこと

- 名前付き session の状態ディレクトリの具体的な場所（herdr は `<config_dir>/sessions/<name>`）→ design で決める。
- 名前の規則の細部（herdr の規則に何を足すか。Windows の予約名・末尾の `.`）→ design で決める。
- 状態ディレクトリが深くなることでの副作用（パスの長さに制限のあるもの）→ design で確かめる。
- 「動いているか」の判定方法（herdr は socket に繋がるか）→ design で決める。
