# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/server/src/terminal/historyAnsi.ts `truncateHistoryAnsi` 切り口がちょうど行の頭のとき 1 行余計に捨てていた / 対応: 修正済（T1・ラウンド1。直前の CRLF を見る＋テスト）
- [nit][conv:-] packages/server/src/terminal/historyAnsi.test.ts 文字列型の途中の ESC・0x9B 以外の C1・サロゲートの対の経路にテストが無かった / 対応: 修正済（T1・ラウンド1）
- [should][conv:-] packages/server/src/persist/PaneHistoryFile.test.ts 「ENOENT 以外の読み取りの失敗は投げる」を確かめるテストが無く、変異（無条件に missing）で通った / 対応: 修正済（T3・ラウンド1。EISDIR のテスト）
- [should][conv:-] packages/server/src/persist/PaneHistoryFile.test.ts too_large のテストが「読まずに」と `bytes` を確かめていなかった / 対応: 修正済（T3・ラウンド1。bytes の一致と 0o000 のファイル）
- [nit][conv:-] packages/server/src/persist/PaneHistoryFile.test.ts pane ごとの上限が UTF-8 のバイト数であることを確かめていなかった / 対応: 修正済（T3・ラウンド1）
- [nit][conv:-] packages/server/src/persist/PaneHistoryFile.ts corrupt の理由に JSON.parse の文言（中身の一部を含む）を入れていた / 対応: 修正済（T3・ラウンド1。固定の文言と項目の位置・種類だけ）
- [nit][conv:-] packages/server/src/persist/PaneHistoryFile.test.ts `__proto__` のテストの最後の確かめが何も確かめていなかった / 対応: 修正済（T3・ラウンド1）
- [nit][conv:-] packages/server/src/persist/PaneHistoryFile.ts paneId の `.max(64)` に根拠もテストも無かった / 対応: 修正済（T3・ラウンド1。上限を外し SessionFile にそろえた）
- [should][conv:-] packages/server/src/terminal/Mirror.test.ts 「最後のカーソルの位置合わせを含めない」を確かめておらず、`range` を外す変異で通った（区切りの行を上書きする退行） / 対応: 修正済（T2・ラウンド1。カーソルを戻した入力で完全一致）
- [should][conv:-] packages/server/src/terminal/Mirror.test.ts 代替画面のテストが、読む先を代替画面にする変異で通った / 対応: 修正済（T2・ラウンド1。通常バッファの最後の行を代替画面の中身より下に置いて完全一致）
- [should][conv:-] packages/server/src/terminal/Mirror.test.ts 「最後の空でない行まで」を確かめておらず、末尾の空行を含める変異で通った / 対応: 修正済（T2・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/Mirror.test.ts 0 行目だけが空でない場合の境界が未検証 / 対応: 修正済（T2・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/session/PaneHistoryRecorder.test.ts flush の上限切れで取り出しに進まないことを確かめておらず、`return` を消す変異で通った / 対応: 修正済（T4・ラウンド1。上限切れの後の中身を変えて、前回のものが書かれることを確かめる）
- [should][conv:regression-negative-control] packages/server/src/session/PaneHistoryRecorder.test.ts 端末の無い pane の経路が、投げて何も書かない変異でも通った / 対応: 修正済（T4・ラウンド1。書いた件数と警告の無いことを確かめる）
- [nit][conv:-] docs/tls-setup.md 正常な停止に SIGHUP が抜けていた / 対応: 修正済（T8・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/composeServer.integration.test.ts 定期保存の開始・停止の組み立てを確かめるテストが無く、`start()`/`stop()` を消す変異で通った / 対応: 修正済（T9・ラウンド1。composeServer に間隔の差し替えの口を足し、停止を待たずに書くこと・停止の後に書かないことを確かめる）
- [should][conv:-] packages/server/src/composeServer.integration.test.ts AC12 の確かめが復元の後に作った pane を見ていて、流し込みの経路を通っていなかった / 対応: 修正済（T9・ラウンド1。画面履歴から項目を除いた pane を復元させる）
- [nit][conv:-] packages/server/src/composeServer.ts close() で flush が投げると定期保存のタイマーが残りうる / 対応: 修正済（T9・ラウンド1。止めるのを flush の前へ、listen の失敗時にも止める）
- [should][conv:-] packages/server/src/persist/PaneHistoryFile.ts 書いている途中で落ちて残った `.tmp-*`（画面の内容を持ちうる）を、無効で起動したときの消去が片付けていなかった / 対応: 修正済（cross・ラウンド1。clear が起動時に `.tmp-*` も消す＋テスト）
- [nit][conv:-] packages/server/src/session/SessionService.ts 120 桁を超える幅で保存した行の `CSI n C` が、120 桁で作るミラーへ流すと右端で止まり詰まる / 対応: 許容（decisions D7。backlog へ）
- [nit][conv:-] packages/server/src/terminal/historyAnsi.ts 巨大な 1 論理行が上限を超えると、行の境目で切る切り詰めが見えていた内容を落とす / 対応: 許容（decisions D7。backlog へ）

## ラウンド 1（2026-09-26T15:47:41Z）
- [should][conv:-] packages/server/src/persist/PaneHistoryFile.ts:125-134 clear が `.tmp-*` の削除で投げると本体（秘密を含む画面履歴）を消さずに抜ける。AC5 の経路では次の起動で新しい p1 に古い画面が流れうる / 対応: 差し戻し（本体を先に消し、一時ディレクトリの片付けの失敗は握りつぶす）
- [should][conv:-] packages/server/src/persist/PaneHistoryFile.ts:125-127 状態ディレクトリ直下の `.tmp-` で始まるものを、wtm が作ったか確かめずに再帰で消す（`--state-dir` は任意の場所を指せる） / 対応: 差し戻し（mkdtemp の形〔`.tmp-`＋6 文字・中身が `write` だけ〕に絞る）
- [nit][conv:-] packages/server/src/session/PaneHistoryRecorder.ts:92,120-121 取り直した内容が前回と同じでも書き直す（代替画面のアプリ・スピナーの pane で 30 秒ごとに書き直しが続く） / 対応: 差し戻しに合わせて修正（内容が同じなら変化なしとみなす）
- [should][conv:regression-negative-control] packages/server/src/session/PaneHistoryRecorder.test.ts 内容が同じときに取り出しの時刻を進めることを確かめておらず、消す変異で通った / 対応: 修正済（T4・ラウンド2。3 回目の保存で取り直さないこと・停止時の savedAt を確かめる）
- [should][conv:-] .aidev/works/20260926-screen-history-replay/design.md「保存」 比較の key と savedAt の扱いが実装と食い違う / 対応: 修正済（T4・ラウンド2。decisions D8 に記録）
- [nit][conv:-] packages/server/src/session/PaneHistoryRecorder.ts 内容が同じ pane の savedAt が古いまま書かれる / 対応: 修正済（T4・ラウンド2。savedAt も進める）
- [should][conv:regression-negative-control] packages/server/src/persist/PaneHistoryFile.test.ts 「片付けの失敗で本体を消さずに抜けない」のテストが直す前の形でも通った / 対応: 修正済（T3・ラウンド2。状態ディレクトリを 0o300 にして片付けを投げさせる。直す前の順序に戻す変異 R1 で落ちることを確認）
- [should][conv:-] packages/server/src/persist/PaneHistoryFile.ts 起動の途中でも `/api/login` が書く `.tmp-*` を消しうる / 対応: 修正済（T3・ラウンド2。10 分より新しいものは残す。decisions D8）

## ラウンド 2（2026-09-26T16:01:21Z）
- ラウンド 1 の 3 件はすべて解消（独立レビュアーが file:line で確認）。修正の差分に新しい must/should は無し。
- [nit][conv:-] packages/server/src/session/PaneHistoryRecorder.ts:54 `lastWrittenKey` のコメントが直す前の `id@at` のまま / 対応: 修正済（コメントのみ）
