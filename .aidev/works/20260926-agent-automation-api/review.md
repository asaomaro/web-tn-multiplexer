# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [should][conv:-] packages/cli/src/agentStatus.ts:35-56 `toAgentView` の引数が design と違うのに記録が無い / 対応: 修正済（decisions.md D7 に記録。T1・ラウンド1）
- [should][conv:-] packages/cli/src/commands/pane.ts:104,111-112 `readPaneSnapshot` の中で解除すると `pane read` が「解除 → 表示」に入れ替わり、解除の応答が失敗したとき画面を出さずに失敗する / 対応: 修正済（解除を呼び出し側へ戻し、順序のテストを追加。decisions.md D8。T3・ラウンド1）
- [must][conv:-] packages/cli/src/commands/agent.ts:141-148 `await hello()` の後で `onEvent` を登録すると、応答と同じ受信の塊で直後に届いたイベントを取りこぼし、無期限の wait がハングしうる / 対応: 修正済（hello の応答処理の同期区間で購読する。decisions.md D9。T4・ラウンド1）
- [should][conv:regression-negative-control] packages/cli/src/commands/agent.test.ts:86-89 偽クライアントが購読の登録を待ってからイベントを出すため、取りこぼしと古いイベントでの誤判定が検証されていない / 対応: 修正済（2 ケースを追加し修正前の形で落ちることを確認。T4・ラウンド1）
- [nit][conv:-] packages/cli/src/agent.integration.test.ts:155-161,175-184 hello の観測を wait 自体と競わせておらず、hello 前の失敗がタイムアウトとしてしか見えない / 対応: 修正済（`Promise.race`。T6・ラウンド1）
- [nit][conv:-] packages/cli/src/agent.integration.test.ts:156-166,204-216 stdout のスパイの復元が try/finally に入っていない / 対応: 修正済（T6・ラウンド1）
- [nit][conv:-] packages/cli/src/smoke.ts:100-105 「空の一覧になる」と書きながら配列かどうかしか確かめていない / 対応: 修正済（空であることを確かめる。T7・ラウンド1）
- [should][conv:-] docs/wtmctl.md:71 例の `pane run` は LF を送るだけで、raw mode のエージェントでは Enter にならないことがある / 対応: 修正済（`pane input` で文字と CR を別々に送る例にし、未検証であることを明記。T8・ラウンド1）
- [nit][conv:-] docs/wtmctl.md:62-63 `agent read --timeout` の意味と既定値が無い / 対応: 修正済（T8・ラウンド1）
- [nit][conv:-] docs/wtmctl.md:60-61 `agent wait` の `connection_closed` が無い / 対応: 修正済（T8・ラウンド1）
- [nit][conv:-] docs/wtmctl.md:49 `idle` の説明が一度も完了していない場合に合わない / 対応: 修正済（T8・ラウンド1）
- [should][conv:-] docs/wtmctl.md:49-50 `done`/`idle` の説明がサーバの既読（フォーカスが移ったときだけ進む）と合わず、ブラウザのバッジと食い違う場面が書かれていない / 対応: 修正済（decisions.md D10。cross・ラウンド1）

## ラウンド 1（2026-09-26・独立レビュー〔別コンテキスト〕）
- [should][conv:-] packages/cli/src/commands/agent.ts:274 alternate screen を使うエージェントでは SNAPSHOT が「通常画面（スクロールバック込み）＋改行なしで `\x1b[?1049h\x1b[H`＋alt screen」になり、`agent read` の末尾 N 行に古いシェルの履歴が混ざり境目の行がつながる / 対応: 修正済（最後の `\x1b[?1049h` より後ろだけを今の画面として読む。回帰テスト追加）
- [nit][conv:-] packages/cli/src/cliArgs.ts:318 `agent wait --timeout` に上限が無く、2^31-1 を超えると Node が 1ms に丸めて即 timeout になる / 対応: 修正済（2147483647 を超える値は使い方の誤り）
- [nit][conv:-] docs/wtmctl.md:65 無期限の wait は半開きの TCP で永久に待ちうる（死活確認が無い） / 対応: 修正済（docs に「長い待ちでは --timeout を付ける」を追記）
- [nit][conv:-] docs/wtmctl.md:80 例の `--until working` はすぐ blocked に移ると時間切れになる / 対応: 修正済（`--until working --until blocked`）

## ラウンド 2（2026-09-26・独立レビュー〔別コンテキスト〕。前ラウンドの解消と今回の差分に絞る）
- 前ラウンドの 4 件はすべて解消を確認（addon-serialize は alt buffer のときだけ `ESC[?1049h` を付け、抜けた後の SNAPSHOT には残らないことを再現で確認）。
- [nit][conv:-] packages/cli/src/agentStatus.ts:92-93 / docs/wtmctl.md:70 `--raw` の出力は alt screen の `ESC[H` やモード設定を含むのに docs に注意が無い / 対応: 修正済（docs に一言追記）
