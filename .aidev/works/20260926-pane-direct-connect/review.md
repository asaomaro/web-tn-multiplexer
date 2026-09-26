# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [must][conv:-] packages/web/src/net/clientError.ts:13 `ErrorCode` に `pane_attached`・`not_attached` を足すと `MESSAGES: Record<ErrorCode, string>` の網羅が崩れ web の型検査が失敗する / 対応: 修正済（T1・ラウンド1。網羅表に 2 行追加。decisions D7）
- [should][conv:regression-negative-control] packages/server/src/clients/SizeAuthority.test.ts 「移譲の後に解放する」テストが順序を確かめていなかった（権限者と所有者が別クライアント） / 対応: 修正済（T2・ラウンド1。同じクライアントが権限者かつ所有者で移譲先が無い場合のテストを追加）
- [nit][conv:-] packages/server/src/clients/SizeAuthority.test.ts AC4 のテストの noteInteraction・fit が既に権限者のクライアントで呼ばれ applyOwnerSize まで届いていなかった / 対応: 修正済（T2・ラウンド1。別のデスクトップの操作・権限者でないモバイルの fit で権限を取る形に変更）
- [nit][conv:-] packages/server/src/clients/SizeAuthority.test.ts pane が閉じた後の解放のテストの assertion が弱い / 対応: 修正済（T2・ラウンド1。null のイベントと pane.size_changed が増えないことを確認）
- [nit][conv:-] packages/cli/src/attachKeys.test.ts:9 新規ファイルが prettier（printWidth 100）で整形されていない / 対応: 修正済（T4・ラウンド1。新規ファイルに prettier --write）
- [nit][conv:-] packages/server/src/surface/methods/attach.ts:13 新規ファイルが prettier で整形されていない / 対応: 修正済（T3・ラウンド1。prettier --write）
- [should][conv:-] packages/cli/src/commands/attach.ts:110 自分の clientId を知る前に届いた `{clientId: null}` で所有済みと誤判定し、その後の別クライアントの直結で attach_taken_over に誤って確定しうる / 対応: 修正済（T6・ラウンド1。`myClientId !== null` を条件に追加し、null→other の順のテストを追加）
- [should][conv:-] packages/cli/src/commands/attach.ts:186 `pane.subscribe` の応答待ちの間の切断で、raw モードのまま要求の時間切れ（10 秒）まで固まり timeout で終わる / 対応: 修正済（T6・ラウンド1。終わりの Promise と race させ、応答を返さない subscribe での切断のテストを追加）
- [nit][conv:-] packages/cli/src/commands/attach.test.ts:316 テスト名が「出力・打鍵」だが打鍵を確かめていない / 対応: 修正済（T6・ラウンド1。名前を中身に合わせた。打鍵の購読の解除は expectRestored の listeners()==0 が見る）
- [should][conv:-] packages/cli/src/attach.integration.test.ts:222 切り離し後のブラウザへの `pane.attach_changed`（null）を待たずに 1 回だけ見ており、別ソケットの到着順で負荷時に落ちうる / 対応: 修正済（T7・ラウンド1。vi.waitFor で包んだ）
- [nit][conv:-] packages/cli/src/attach.integration.test.ts:174 途中で assertion が落ちたときに直結の接続が afterAll まで残る / 対応: 許容（失敗時だけ残り、afterAll の server.close() で閉じる。通ったときの正確性に影響しない）
- [nit][conv:-] docs/wtmctl.md:62 終了コードの一覧に pane_attached が無く、herdr の節が使い方の誤り（2）を抜かしていた / 対応: 修正済（T9・ラウンド1）
- [nit][conv:-] packages/cli/src/commands/attach.ts:125 pane_closed は pane.closed（ブラウザ等から閉じたとき）でも出るのに message と docs が「プロセスが終わった」だけ / 対応: 修正済（cross・ラウンド1。message と docs/wtmctl.md の文言を広げた）

## ラウンド 1（2026-09-26T10:26:20Z。独立レビュー・opus）
- [must][conv:-] packages/cli/src/commands/attach.ts:148-153 pane の生の出力に含まれる端末への問い合わせ（DA1/DA2・CPR・DECRQM・DECRQSS・OSC 4/10/11/12）を手元の端末にそのまま書くので、手元の端末も答えて stdin → INPUT で pane に届き、サーバのミラーの答え（Mirror.ts:94-101）と二重になる。「応答はサーバのミラーだけ」という既存の不変条件（web/src/term/QueryFilter.ts:3-7・D17）に反し、遅れた答えが入力行のごみになる / 対応: 差し戻し（CLI 側で出力から問い合わせを取り除く）
- [should][conv:-] packages/cli/src/commands/attach.ts:35-39 RESTORE_SCREEN にカーソルの形（DECSCUSR）・スクロール領域（DECSTBM）・自動折り返し・原点モード・文字集合の戻しが無い / 対応: 差し戻し
- [should][conv:regression-negative-control] packages/cli/src/attach.integration.test.ts:164-193 AC1 の「見えている画面が描かれ」（直結前の中身が SNAPSHOT で届くこと・直結の大きさで描かれること）を実物で確かめていない / 対応: 差し戻し
- [nit][conv:-] packages/cli/src/commands/attach.ts:163-173 Ctrl+B q の後、pane.detach の応答まで打鍵が pane へ送られ、その間の切断は connection_closed（1）になる / 対応: 差し戻し（同時に直す）
- [nit][conv:-] packages/cli/src/commands/attach.ts:72-82 SIGTERM 等のシグナルで終わると手元の端末が raw・代替画面のまま残る。smoke も代替画面から出る列を確かめていない / 対応: 差し戻し（同時に直す）
- [should][conv:-] packages/cli/src/commands/attach.ts:177-188 送り直された SNAPSHOT の前に、前の出力の書きかけの列と復号途中のバイトが付き、SNAPSHOT が OSC に取り込まれうる / 対応: 修正済（T10・ラウンド1。SNAPSHOT で持ち越しを捨て decoder を作り直す。テスト追加）
- [should][conv:-] packages/cli/src/attachOutput.ts:66-72 文字列の列の中の `\` 以外が続く ESC で文字列を打ち切らず、続く問い合わせが残り出力も止まる / 対応: 修正済（T10・ラウンド1）
- [should][conv:-] packages/cli/src/attachOutput.ts:96 `CSI > Pp n`（XTMODKEYS の無効化）まで取り除いていた / 対応: 修正済（T10・ラウンド1。前置きが無いか `?` のときだけ）
- [nit][conv:-] packages/cli/src/attachOutput.ts:95-100 中間文字を確かめず DECCARA（`CSI … $ t`）を窓の報告として消していた / 対応: 修正済（T10・ラウンド1）
- [nit][conv:-] packages/cli/src/attachOutput.ts:91-101 XTQMODKEYS・XTSMGRAPHICS の読み出し・DECRQPSR・ENQ を取り除いていなかった / 対応: 修正済（T10・ラウンド1）
- [should][conv:regression-negative-control] packages/cli/src/commands/attach.ts:73-80 実物の processTerminal().onSignal（SIGTERM・SIGHUP の付け外し）を確かめるテストが無い / 対応: 修正済（T11・ラウンド1。process のリスナーを確かめるテスト追加）
- [nit][conv:-] packages/cli/src/commands/attach.ts:219-223 SIGHUP で端末が既に無いときの戻しの書き込み・raw の戻しが EIO で落ちうる / 対応: 修正済（T11・ラウンド1。try で包み、raw の間は stdin/stdout の error を無視）
- [nit][conv:-] packages/cli/src/commands/attach.ts:40 `CSI r` がカーソルを左上へ動かす / 対応: 修正済（T11・ラウンド1。ESC 7・ESC 8 で挟む）
- [nit][conv:-] packages/cli/src/commands/attach.ts:120-139 切り離しを始めた後の奪取・pane の終了はイベントの届く順で終了コードが変わる / 対応: 修正済（T11・ラウンド1。切り離し中はどれも正常終了。decisions D10）
- [should][conv:-] packages/cli/src/attach.integration.test.ts:202 `read -t 2` が実時間に依存 / 対応: 修正済（T12・ラウンド1。-t を外し vitest の上限付きの待ちに任せる）
- [nit][conv:-] packages/cli/src/smoke.ts:107 代替画面から出る列の有無だけで順序を見ていない / 対応: 修正済（T12・ラウンド1。marker より後に出たことを確かめる）

## ラウンド 2（2026-09-26T10:58:16Z。独立レビュー・opus。範囲はラウンド 1 の指摘の解消とその後の差分の must/should）
- ラウンド 1 の 5 件: must（問い合わせの二重応答）・should 2 件・nit（切り離し中の扱い）は解消済み。nit（シグナル）はおおむね解消（下の 1 件目が残る）。
- [nit][conv:-] packages/cli/src/commands/attach.ts:58-70,243-252 SIGHUP で端末が既に無いとき、戻しの書き込みの失敗は次の tick に 'error' で出るが、同じ tick の setRawMode(false) で error の受け手を外すので受け手の無い 'error' で落ちうる / 対応: 許容（nit・範囲外の手戻りを避ける。backlog の兄弟項目に残した）
- [nit][conv:-] packages/cli/src/attachOutput.ts:62-68,81-82 列の途中の ESC・CSI の中の C0（`ESC ESC [6n`・`ESC [6 BS n`・`ESC ( ESC [c`）で問い合わせが素通りする。普通のアプリは出さない列 / 対応: 許容（nit。backlog の兄弟項目に残した）
