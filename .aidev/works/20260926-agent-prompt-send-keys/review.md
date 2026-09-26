# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/protocol/src/messages.test.ts:6 `MAX_AGENT_PROMPT_BYTES` の import が並び順から外れていた / 対応: 修正済（T1・ラウンド1）
- [nit][conv:-] packages/protocol/src/messages.ts:400 1MB の上限は JSON に符号化する前のバイト数で、制御文字の多い本文は WebSocket の上限（4MB）で先に切られうることが書かれていない / 対応: 修正済（コメントを追記。T1・ラウンド1）
- [should][conv:-] packages/server/src/agent/agentInput.test.ts 表の alt 列（alt+esc・alt+tab・ctrl+alt）と ctrl+記号（`@\]^_`）を確かめておらず、変異が生き残った / 対応: 修正済（行を足し、変異 T2-M18〜M21 が落ちることを確認。T2・ラウンド1）
- [should][conv:-] packages/server/src/agent/agentInput.test.ts 記号名の大半・別名 option・修飾名と F キーの大小無視を確かめていなかった / 対応: 修正済（行を足し、変異 T2-M22〜M25 が落ちることを確認。T2・ラウンド1）
- [nit][conv:-] packages/server/src/agent/agentInput.ts 新規ファイルが prettier で整形されていない / 対応: 修正済（`prettier --write`。T2・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/terminal/Mirror.test.ts flush のテストがタイマー 1 回分を待つだけの誤った実装を捕まえられない / 対応: 修正済（大きな出力の後ろの切り替えを確かめるテストを足し、変異 T3-M4 が落ちることを確認。T3・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/Mirror.test.ts テスト名が言う「書いた直後はまだ古い」を確かめていない / 対応: 修正済（flush 前の値を確かめる行を足した。T3・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/OutputFanout.test.ts・AgentMonitor.test.ts 偽物の戻り値の型をその場で書いていた / 対応: 修正済（`InputModes` を import。T3・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/TerminalHost.ts:170 `drainQueue` の catch のコメントが実際に来る例外（想定外のもの）と合っていない / 対応: 修正済（握りつぶす理由——busy が戻らなくなるのを防ぐ——に書き直した。T4・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/TerminalHost.test.ts 終了時に遅延のタイマーを解除することを確かめていない / 対応: 修正済（`vi.getTimerCount()` で確かめ、変異 T4-M14 が落ちることを確認。`wakeDelay` を外す変異は、既に reject 済みの Promise の続きが止まったまま残るだけで外から観測できないので捕まえない。T4・ラウンド1）
- [should][conv:-] packages/server/src/surface/methods/agent.ts:38 blocked の検査が受け付け時の 1 回だけで、別の入力の後ろで待つ間にダイアログが出るとダイアログへ本文と Enter を書いてしまう / 対応: 修正済（書く直前に blocked・消失・入れ替わりを確かめ直す。decisions.md D7。変異 T5-M12〜M14 が落ちることを確認。T5・ラウンド1）
- [nit][conv:-] packages/web/src/net/clientError.ts `agent_prompt_failed` の文言が原因を「端末が閉じた」と言い切っている / 対応: 修正済（「等」を付けて言い切らない形に。T12・ラウンド1）
- [nit][conv:-] packages/web/src/net/clientError.ts `agent_not_found` の文言が pane の無い場合を含まない / 対応: 修正済（T12・ラウンド1）
- [nit][conv:-] packages/web/src/net/clientError.test.ts 5 つの文言が互いに違うことを確かめていない / 対応: 修正済（T12・ラウンド1）
- [should][conv:-] docs/wtmctl.md `agent_prompt_failed`（本文を書いた後に端末が閉じた）が「送られなかったとは限らない」code の説明から抜けていた / 対応: 修正済（T9・ラウンド1）
- [should][conv:-] docs/wtmctl.md 書く直前の再確認で送らないと言い切っていた（判定の周期と 300ms の間の窓が残る） / 対応: 修正済（窓が残ることを書いた。T9・ラウンド1）
- [nit][conv:-] docs/wtmctl.md 「`C-c` も可」が emacs 式の書き方全般に読める / 対応: 修正済（別名は `C-c` だけと書いた。T9・ラウンド1）
- [nit][conv:-] docs/wtmctl.md 本文が `--` で始まると使い方の誤りになる制約が書かれていない / 対応: 修正済（T9・ラウンド1）
- [must][conv:regression-negative-control] packages/cli/src/agentPrompt.integration.test.ts:155 「working を経て返る」を確かめておらず、活動の確認を省く変異で通る / 対応: 一部修正（返った時刻の assert を足し、応答で即座に返る変異 T8-M6 が落ちることを確認。指摘の変異 T8-M5 はこの事象列では等価で結合テストでは捕まらないため、単体テストで担保。decisions.md D9。T8・ラウンド1）
- [should][conv:-] packages/cli/src/agentPrompt.integration.test.ts:37 working が 1.5 秒しか続かず負荷下で検出が取りこぼしうる / 対応: 修正済（4 秒に延ばした。T8・ラウンド1）
- [should][conv:-] packages/cli/src/agentPrompt.integration.test.ts:160 遅延 Enter の判定が偽のエージェントの受信時刻に頼る / 対応: 許容（遅延の値そのものは単体テスト〔T4・T5〕で確かめる。結合テストは「別の読み取りで間を置いて届く」を残し、落ちたときに切り分けられるよう受信記録を assert のメッセージに出すようにした。T8・ラウンド1）
- [should][conv:-] packages/cli/src/agentPrompt.integration.test.ts:182 send-keys の待ちが既定の 1 秒 / 対応: 修正済（10 秒に。T8・ラウンド1）
- [nit][conv:-] packages/cli/src/agentPrompt.integration.test.ts design の置き場（既存ファイル）と違う理由が記録されていない / 対応: 修正済（decisions.md D8。T8・ラウンド1）
- [should][conv:regression-negative-control] packages/cli/src/commands/agent.test.ts:517 `--wait` 無しで「応答のエージェント」を出すことをテストが捕まえない（hello と応答が同じ値） / 対応: 修正済（応答を区別できる値にし、変異 T7-M14 が落ちることを確認。T7・ラウンド1）
- [should][conv:regression-negative-control] packages/cli/src/commands/agent.test.ts:608 `--until` の複数指定のテストが `--until` の反映を捕まえない / 対応: 修正済（途中の確認を十分に待ち、最後に status を確かめる。変異 T7-M15 が落ちることを確認。T7・ラウンド1）
- [nit][conv:-] packages/cli/src/commands/agent.ts:288 hello の間に締め切りを過ぎても送ってしまう / 対応: 修正済（送らずに timeout。変異 T7-M16 が落ちることを確認。T7・ラウンド1）
- [nit][conv:-] packages/cli/src/smoke.ts:129 ログが確かめていない「遅延 Enter」を言っている / 対応: 修正済（観測した事実だけに。T13・ラウンド1）
- [nit][conv:-] packages/cli/src/smoke.ts:113 send-keys は終了コードだけを見ている / 対応: 許容（smoke の目的は RPC までの配線。キーの届き方は結合テストで確かめる。ログを「RPC が受け付けた」に直した。T13・ラウンド1）
- [should][conv:-] packages/server/src/surface/methods/agent.ts:71 `agent.prompt` が受け付けた時点のエージェントを返すため、待ち行列の間に working から idle に戻ると CLI の --wait が活動の確認を省いて早く返る（cross） / 対応: 修正済（本文を書く直前のエージェントを返す。変異 X-M1 が落ちることを確認。cross・ラウンド1）
- [should][conv:-] docs/wtmctl.md:91 `agent_not_running`・`connection_closed` も「送られなかったとは限らない」code に入っていない（送信前の入れ替わりでは入れ替わった先に送られている） / 対応: 修正済（cross・ラウンド1）
- [nit][conv:-] docs/wtmctl.md:85 `agent_prompt_failed` を「本文は書かれている」と言い切っている / 対応: 修正済（書かれている場合もいない場合もある、に。cross・ラウンド1）

## ラウンド 1（2026-09-26T08:30Z・独立レビュー〔委譲〕）
- [should][conv:-] packages/server/src/agent/agentInput.ts:14 本文の中の `ESC[201~`（`ESC[200~`）を取り除かずに包むため、貼り付けの終わりの印を含む本文では印の後ろが打鍵として届き、途中で確定されうる / 対応: 差し戻し（包むときに印を取り除く。D11）
- [should][conv:-] packages/server/src/surface/methods/agent.ts:52 CLI が hello で見たエージェントの instanceId をサーバに渡さず、hello から受け付けまでに入れ替わった別のエージェントへ送りうる（send-keys では別のダイアログに答えうる） / 対応: 差し戻し（RPC に省略可能な instanceId を足し、違えば何も書かずに agent_not_found。D12）
- [should][conv:-] .aidev/backlog/product-roadmap.md:386 「実際のエージェントでの送信確認」の条件が `[x]` で消える・test-result の AC14 を backlog が `[ ]` のうちに pass としている / 対応: 差し戻し（本物のエージェントでの確認を兄弟の `[ ]` として deliver で残す。AC14 の判定の書き方を直す）

## ラウンド 2（2026-09-26T09:00Z・独立レビュー〔委譲〕。範囲はラウンド 1 の指摘の解消とその後の差分）
- [should][conv:-] packages/server/src/agent/agentInput.ts:22 印の除去が 1 回の走査だけで、入れ子にした印（`ESC[20ESC[201~1~`）は取り除いた後に `ESC[201~` が組み上がって残る / 対応: 差し戻し（変わらなくなるまで繰り返して取り除く）
- ラウンド 1 の指摘 2（instanceId）・3（backlog の計画と AC14 の書き方）は解消と判定された。

## ラウンド 3（2026-09-26T09:20Z・独立レビュー〔委譲〕。範囲はラウンド 2 の指摘の解消とその修正の差分）
指摘なし（ラウンド 2 の指摘は解消と判定。`agentInput.test.ts` の入れ子 2 例を手で追って確認、103 件通過）。
通算: must 0 / should 4（ラウンド 1: 3・ラウンド 2: 1）/ nit 0。walkthrough.md を書いた（差分が大きく、protocol・server・cli にまたがるため）。
