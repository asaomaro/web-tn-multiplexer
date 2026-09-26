# 判断の記録（20260926-pane-direct-connect）

## D1: 範囲——`terminal attach` 相当（対話の直結＋書き込み所有者の排他）だけにし、observe・control は兄弟項目へ割る

- **背景**: backlog の行（`.aidev/backlog/product-roadmap.md`「pane 直接接続・制御ストリーム」）は herdr の `terminal attach`・
  `terminal session observe`・`terminal session control` の 3 つをまとめている。1 PR で着地できる最小の有用な部分を選ぶよう指示されている。
  一次資料（`scratchpad/herdr/`。requirements.md「herdr の仕様」）を読むと、3 つの共通の核は「pane ごとの書き込み所有者の排他」と
  「直結中の大きさの鍵」で、observe はそれを持たない（閲覧だけ）、control は同じ所有者の上に NDJSON の入出力を足したもの。
- **決定**: `wtmctl pane attach <paneId> [--takeover]`（対話の直結）と、それが要するサーバ側の所有者・大きさの鍵・所有者の変化の知らせだけを
  今回の範囲にする。observe（閲覧専用の NDJSON）と control（NDJSON の入出力）・直結中のサーバ側スクロール・ブラウザでの直結中の表示は
  backlog に `[ ]` の兄弟として残す。
- **理由・代替案**:
  - 利用者に最も直接の価値があるのは「SSH 先の端末から pane を操作する」ことで、それは attach だけで満たせる。observe は既存の `pane.subscribe`
    ＋ `pane read --follow --raw` で出力を追う近い手段が既にあり（形式が NDJSON でない・大きさの指定が無い違いはある）、今回足す価値が相対的に小さい。
  - control は attach と同じ所有者の仕組みの上に載るので、先に所有者（と大きさの鍵）を入れておけば後から NDJSON の枠だけを足せる。逆順（observe だけ先）
    だと、backlog の文言が「前提が異なる」と書いた排他の部分がまるごと残り、この項目の核心に触れない。
  - 3 つまとめて 1 PR にする案は、NDJSON の 2 形式（出力のフレーム・stdin のコマンド）と対話の raw モードの両方を同時に設計・検証することになり、
    直前の work（agent-prompt-send-keys: 3407 本・負の確認 22 通り）と比べても 1 PR の分量を超える。
- **影響**: backlog の行を deliver で `[x]`（attach）と `[ ]`（observe/control・スクロール・ブラウザの表示・`agent attach`）に割る。
  `docs/herdr-parity.md` の H40 は「一部対応」になる。

## D2: 直結の所有者と大きさの鍵は `SizeAuthority` に持たせる

- **背景**: 直結中の pane の大きさはブラウザのサイズ権限より直結を優先させる必要がある（requirements FR7）。所有者の表を置く場所の候補は
  (a) `SizeAuthority` に足す、(b) 新しい部品（`AttachRegistry`）を作り SizeAuthority から参照する。
- **決定**: (a)。
- **理由・代替案**: PTY の大きさを変える経路は `applyOwnerSize` の 1 箇所だけ（research F2）で、接続が切れたときの後始末 `onClientGone` も既に WsGateway から
  呼ばれている（F4）。(b) は SizeAuthority → AttachRegistry の依存と、WsGateway からの 2 本目の後始末の呼び出し（または SizeAuthority からの転送）が要り、
  「大きさを誰が決めるか」の判断が 2 か所に分かれる。SizeAuthority の責務（tab ごとのサイズ権限）は「pane の大きさを誰が決めるか」に広がるが、判断の場所は 1 つに保てる。
- **影響**: `DefaultSizeAuthority` のコンストラクタに省略可能な第 3 引数（イベントの発行先）を足す。既存の 2 引数の組み立て（テスト）はそのまま動く。

## D3: 所有者の変化は全クライアントへのイベント `pane.attach_changed` で知らせる

- **背景**: `--takeover` で奪われた側の `wtmctl` を終わらせる必要がある（requirements FR6）。herdr はサーバが旧所有者へ切断理由を送って外す
  （`headless.rs:1861-1868`）。
- **決定**: `pane.attach_changed {paneId, clientId|null}` を bus で全クライアントへ発行し、`wtmctl` は自分以外の clientId なら `attach_taken_over` で終わる。
- **理由・代替案**: 当人の接続を閉じる案（close コードで理由を伝える）は、SizeAuthority から WsGateway の接続表への新しい経路が要り、同じ接続で別の用事をしている
  外部クライアントまで切る。イベントは既存の bus → 全接続の経路（`WsGateway.ts:82-84`）に乗るだけで、ブラウザは知らないイベントを無視する（research F5）ので
  web を変えずに済み、後続の「ブラウザでの直結中の表示」がそのまま使える。clientId を全体へ配ることは、既に `tab.sizeOwnerClientId` が snapshot・イベントで
  配られているのと同じ扱い。奪われた後も旧所有者の接続は（CLI が閉じるまで）出力を受け続けるが、所有者でなくなるので大きさは変えられない（`not_attached`）。
- **影響**: protocol の `ServerEvent` に 1 種足す。web の型検査は通る（網羅チェックが無い）。

## D4: 手元の端末は代替画面に入って使い、終わるときにモードを戻して出る

- **背景**: 生の PTY の出力をそのまま手元へ流すので、pane が設定したモード（マウスの報告・bracketed paste・カーソルの非表示・代替画面）が手元に残る
  （research「実現性 / リスク」）。herdr はサーバで描き直したフレームを送るのでこの問題が小さい。
- **決定**: 最初に `ESC[?1049h ESC[H ESC[2J`（代替画面に入って消す）を書き、終わるときに主なモードを戻す列（design「インターフェース」の `RESTORE`）の最後に
  `ESC[?1049l` を書く。kitty keyboard のフラグ・modifyOtherKeys は戻さない。
- **理由・代替案**: 代替画面に入らず画面を消すだけの案は、切り離した後に直結前の手元の画面（シェルの履歴）が戻らない。代替画面に入る案は tmux 等と同じで、
  切り離せば元の画面が戻る。pane の中のアプリが代替画面から出る（`ESC[?1049l`）と手元も主画面へ出てしまい、そこへ出力が重なる——生の出力を流す限り避けられない
  （避けるには手元でも端末エミュレータを持って描き直す必要があり、今回の範囲を超える）。kitty keyboard の pop（`ESC[<u`）は、pane が push していなければ
  手元のシェル（fish 等）が push した分を外してしまうので入れない。これらは `docs/wtmctl.md` に既知の違いとして書く。
- **影響**: 本物のエージェント（kitty keyboard を有効にするもの）を直結して切り離した後、手元の端末のキー入力の符号化が戻らない可能性がある（未検証の穴として残す）。

## D5: 実物の PTY の上で `wtmctl pane attach` を確かめるため、`NodePtyBackend` を `@wtm/server` の公開面に足す

- **背景**: raw モード・`Ctrl+B q`・大きさの追従は、偽の端末の単体・結合テストだけでは「ビルドした `wtmctl` が本物の端末で使える」ことを示さない
  （protocol「起動確認（smoke）」）。cli の smoke は子プロセスを `execFile` で起動し、stdin は端末ではない（research F7）。
- **決定**: `packages/server/src/testkit.ts` から `NodePtyBackend` を export し、cli の smoke でビルド済みの `node dist/main.js pane attach` を node-pty の PTY の中で起動して
  `echo` の往復と `Ctrl+B q` での終了コード 0 を確かめる。`.aidev/config.yml` は変えない（既存の 2 本目 `pnpm --filter @wtm/cli run smoke` が走らせる）。
- **理由・代替案**: cli に node-pty を devDependency として足す案は lockfile と package.json を変える（並行作業と衝突しやすい）。`script` コマンドで PTY を作る案は
  util-linux に依存し OS を選ぶ。server は既に node-pty を持ち、cli は `@wtm/server` を devDependency に持つ（`packages/cli/package.json`）。
- **影響**: `@wtm/server` の公開面が 1 つ増える（テスト用。`testkit.ts` の既存の方針「必要な最小限だけ」に沿う）。

## D6: architecture 工程は挟まない・design の独立点検は 1 ラウンドで止める

- **背景**: protocol.md「4.5」の architecture の 4 条件を design 終了時に確かめた。design の独立点検（ラウンド 1）は 9 件（should 4・nit 5）。
- **決定**: architecture は挟まない。点検の指摘は最小の差分で直し（出所の追記・pane が閉じたときの所有者の扱い・CLI だけの code の置き場・
  raw モードの後の想定外の失敗）、ラウンド 2 は行わない。
- **理由・代替案**: 責務の移動・新しい依存の向きは無い（SizeAuthority の中に所有者を足し、新しい方式は既存の SizeAuthority を呼ぶだけ。decisions D2）。
  インターフェースは RPC 3 つ・イベント 1 つで、状態は「pane → 所有者」の 1 表（design の stateDiagram）。tasks に直接分解できる粒度まで design に書けている。
  指摘はどれも追記で閉じ、方針を変えるものは無かった（指摘 1 件目の「pane が閉じたとき」は既存の後始末に乗る扱いを明記しただけ）。
- **影響**: 残る疑問は review の独立レビューに委ねる。

## D7: web の `clientError.ts` の網羅表に `pane_attached`・`not_attached` を 2 行だけ足す（design の「web は変えない」からの逸脱）

- **背景**: T1 のタスク点検で、`ErrorCode` に 2 つ足すと `packages/web/src/net/clientError.ts:13` の `MESSAGES: Record<ErrorCode, string>`
  （全 code の網羅を型が要求する）が型エラーになると分かった（`vue-tsc` EXIT=2）。design は web の変更をイベントの switch についてしか確かめていなかった。
- **決定**: 前例（同ファイルの `agent_*`。20260926-agent-prompt-send-keys が「ブラウザには通常来ないが網羅のため登録」した）に倣い、日本語の文言を 2 行足す。
- **理由・代替案**: 2 つを `ErrorCode` に入れない案は、サーバの `RpcError` が `ErrorCode` しか受け付けないため、`internal` 等の別の code に丸めることになり
  CLI が理由を区別できない。並行している onboarding の worktree はこのファイルを変えていない（`git status` で確認）ので衝突しにくい。
- **影響**: `packages/web` の変更は `packages/web/src/net/clientError.ts` の 3 行（コメント含む）だけ。PR 本文に明記する。

## D8: 直結では pane の出力から端末への問い合わせを CLI 側で取り除く（review ラウンド 1 の must）

- **背景**: 生の出力をそのまま手元の端末へ書くと、DA1/DA2・CPR・DECRQM・DECRQSS・OSC 4/10/11/12 等の問い合わせに手元の端末も答え、
  その答えが stdin → INPUT で pane に届く。サーバのミラーも答えるので二重になり、遅れた方が入力行のごみになる。
  PJ の不変条件は「答えるのはサーバのミラーだけ、ブラウザは握りつぶす」（`packages/web/src/term/QueryFilter.ts:3-7`・D17）。
- **決定**: CLI に `TerminalQueryFilter`（`packages/cli/src/attachOutput.ts`）を置き、SNAPSHOT と OUTPUT から問い合わせの列を取り除いてから書く。
  取り除く種類は `QueryFilter.ts` と同じもの（DA・DSR/CPR・DECRQM・XTVERSION・DECRQSS・色の問い合わせ）に、手元の端末なら答えうるもの
  （kitty keyboard のフラグの問い合わせ `CSI ? u`・XTGETTCAP・窓の報告 `CSI 11/13/14/…t`・DECID `ESC Z`・OSC 52 のクリップボードの読み出し）を足す。
  列が出力の区切りをまたいでも持ち越して判定する（上限 64KB）。
- **理由・代替案**: (a) 直結中はミラーに答えさせず手元の端末に答えさせる案は、サーバ側に直結の有無で応答を切り替える分岐（TerminalHost まで）が要り、
  色の答え（ブラウザごとのテーマ）の規則（20260921-theme-settings）とも食い違う。(b) stdin 側で手元の端末の答えを落とす案は、答えと打鍵を
  区別できない（ESC で始まるキー列と形が重なる）。既存の不変条件をそのまま守れる (c)＝出力側で取り除く案にした。
  OSC 52 の読み出しは、手元の端末が答えると**手元のクリップボードの中身を pane へ送る**ことになるので、二重の答えとは別に取り除く理由がある。
- **影響**: `docs/wtmctl.md` に書いた。本物の端末エミュレータ（xterm・kitty 等）が答えないことは実物で確かめていない（結合テストは偽の端末に DA1 の列が
  書かれないこと、smoke は node-pty の PTY での一巡）。

## D9: 終わるときに戻す列を広げ、切り離しを始めたら打鍵を止め、シグナルを切り離しとして扱う（review ラウンド 1 の should・nit）

- **背景**: RESTORE_SCREEN にカーソルの形・スクロール領域・自動折り返し・原点モード・文字集合の戻しが無かった。`Ctrl+B q` の後も detach の応答まで
  打鍵が pane に送られ、その間の切断は `connection_closed`（1）になった。SIGTERM 等では finally が走らず手元の端末が raw・代替画面のまま残った。
- **決定**: RESTORE_SCREEN に `CSI 0 SP q`・`CSI r`・`CSI ? 7 h`・`CSI ? 6 l`・`ESC ( B` を足す（DECSTR は使わない——手元の端末の設定まで初期化しうる）。
  切り離しを始めたら（`detaching`）打鍵を送らず、その間の切断は正常な切り離しとして 0 で終える。`AttachTerminal.onSignal`（SIGTERM・SIGHUP）で切り離しを始める。
- **影響**: smoke で実物の PTY に代替画面から出る列が書かれることも確かめる。

## D10: 切り離しを始めた後は、切断・奪取・pane の終了のどれが先に届いても正常な切り離し（0）として終える（T11 のタスク点検）

- **背景**: D9 で「切り離し中の切断は 0」にしたが、同じ間に届いた奪取・pane の終了は 1 のままで、detach の応答とイベントのどちらが先に届くかで終了コードが変わった。
- **決定**: `detaching` の間はそれらもすべて `finish()`（0）にする。利用者は既に `Ctrl+B q` で切り離しを選んでおり、その後に起きたことで失敗扱いにしない。
- **影響**: `packages/cli/src/commands/attach.ts` の `onEvent`。単体テストを追加。
