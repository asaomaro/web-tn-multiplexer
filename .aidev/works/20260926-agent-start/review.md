# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/protocol/src/messages.ts:474 「timeout はスキーマでは弾かない」は整数の制約と食い違う / 対応: 修正済（「timeout の範囲は」。T1・ラウンド1）
- [nit][conv:-] packages/protocol/src/agentStart.test.ts:32 kind の集合が `AGENTS` と一致することを見ていない / 対応: 修正済（server の `agentStart.test.ts` で `AGENTS` の kind の集合と完全一致を比べる。T1・ラウンド1）
- [must][conv:-] packages/server/src/agent/agentStart.ts:60 継続行（PS2。引用符が開いたまま）のシェルでは Ctrl-E・Ctrl-U で消えず、打ち込んだ行の `'` が利用者の引用を閉じて引数が実行される（実物の bash・dash で再現） / 対応: 修正済（先に Ctrl-C を別の書き込みで送り 200 ms 後に行。decisions.md D9。T2・ラウンド1）
- [should][conv:-] packages/server/src/session/SessionService.ts:910 検出時の名前付けの 2 つの守り（名前が他で使われていれば付けない・同じ instanceId では予約を終えない）を壊してもテストが落ちない / 対応: 修正済（2 本追加。T3・ラウンド1）
- [should][conv:-] packages/server/src/agent/AgentStarter.ts:107 `writeModal` の `build` の中で確かめ直していないので、他の入力の後ろで待つ間に検出されたエージェントの入力欄に打ち込みうる / 対応: 修正済（`build` の中でエージェントの有無を確かめ、居れば投げて予約を解く。T4・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/agent/AgentStarter.test.ts:221 await 後の確かめ直し（host の差し替え・名前の取られ）にテストが無く、閉じた pane の code を固定していない / 対応: 修正済（ケースを足し code を固定。T4・ラウンド1）
- [nit][conv:-] .aidev/works/20260926-agent-start/design.md:108,201 `startInput` と手順 12 が D9 より前のまま / 対応: 修正済（D9 に合わせた。T4・ラウンド1）
- [nit][conv:-] packages/server/src/agent/AgentStarter.ts:102 名前の再検査が beginAgentLaunch の中にあることが読めない / 対応: 修正済（コメント。T4・ラウンド1）
- [should][conv:-] packages/server/src/surface/methods/agent.ts:140 `noteInteraction` を起動の後に呼んでいて design・既存の agent.prompt と逆。エージェントが移る前の大きさで起動しうる / 対応: 修正済（打ち込む前に記録。T5・ラウンド1）
- [nit][conv:-] packages/cli/src/agentStartWait.test.ts:63 コメント（idle）とテストの中身（working）が合わない / 対応: 修正済（T7・ラウンド1）
- [must][conv:-] packages/cli/src/smoke.ts:194 smoke のサーバは本物の PATH・HOME のままで、`agent start` の拒否が 1 つの検査に懸かっており、退行すると本物の claude を起動しうる / 対応: 修正済（HOME を隔離し、PATH の先頭に呼ばれたら印を残して失敗する偽の claude を置き、印が無いことも確かめる。T8・ラウンド1）
- [should][conv:-] packages/cli/src/agentStart.integration.test.ts:177 継続行（PS2）になったことを待たずに起動しており、Ctrl-C が未読の打鍵ごと捨てた場合も通る / 対応: 修正済（画面の最後の行が `>` になるのを待つ。T8・ラウンド1）
- [should][conv:-] packages/cli/src/agentStart.integration.test.ts:175 bash（readline）の打ちかけを確かめていない / 対応: 修正済（bash の打ちかけのテストを追加。画面に打ちかけが出たのを待ってから起動。T8・ラウンド1）
- [should][conv:-] packages/cli/src/agentStart.integration.test.ts:237 `sleep 30` の間に打ち込まれていても 500 ms では気づけない / 対応: 修正済（`sleep 4` の終了後まで待ち、偽の claude の記録・検出・画面を確かめる。T8・ラウンド1）
- [nit][conv:-] packages/cli/src/agentStart.integration.test.ts:147 composeServer が失敗したときに環境変数の復元・後始末が行われず、FAKE_ARGV_LOG を元に戻さない / 対応: 修正済（try/finally・savedEnv に含める。T8・ラウンド1）
- [nit][conv:-] packages/cli/src/agentStart.integration.test.ts:119 pane のシェルが偽の claude を解決していることを確かめていない / 対応: 修正済（`command -v claude` を印のファイルに書かせて比べる。T8・ラウンド1）
- [should][conv:-] docs/wtmctl.md:162 D9 の残るリスク（200 ms は保証でない）と `$?` が 130 になることが書かれていない / 対応: 修正済（T9・ラウンド1）
- [nit][conv:-] docs/wtmctl.md:177 負の整数の --timeout は範囲外ではなく使用誤りになる / 対応: 修正済（「0 以上の整数でなければ」。T9・ラウンド1）
- [should][conv:-] packages/server/src/agent/AgentStarter.ts:134 復元で打ち込んだ会話の再開（まだ検出されていない）がある pane を空きとみなし、Ctrl-C で再開を捨てる・再開したエージェントに打ち込む・再開したものに名前を付けて成功と誤る / 対応: 修正済（`SessionService.hasPendingResume`：再開を打ち込んでから 30 秒以内でまだ検出されていない pane は `agent_pane_busy`。decisions.md D12。cross・ラウンド1）
- [nit][conv:-] packages/cli/src/commands/agentStart.ts:63 CLI とサーバで締め切りの起点が違い、CLI の timeout の後も数秒予約が残る / 対応: 修正済（docs に明記。cross・ラウンド1）
- [nit][conv:-] packages/web/src/net/clientError.ts:53 timeout の範囲の数値を web に直書き / 対応: 修正済（数値を書かない文言に。cross・ラウンド1）

## ラウンド 1（review 工程・opus の別コンテキストに委譲）
- [should][conv:-] packages/server/src/agent/AgentStarter.ts:94 前面の確認（`checkShell`）と書き込み（`writeModal`）の間が非同期で、書き込む直前に前面を確かめ直していない。確認の後にブラウザから打たれた `vim foo⏎` 等が前面になると、Ctrl-C とコマンド行がそのプログラムに入る（FR6 に反する） / 対応: 修正済（`ModalInput.prepare` を足し、他の入力を後回しにしている間に前面を確かめ直す。残る fork・exec の途中の瞬間は docs に明記。decisions.md D13）
- [nit][conv:-] packages/server/src/agent/agentStart.ts:68 シェルの判定は argv[0] の名前だけで、argv[0] を書き換えたプロセス（`exec -a bash <prog>`）をシェルと判定する / 対応: 見送り（pane の中で `exec -a` を打てる者はもう pane を操作できるので権限の境界ではない。検出〔`ProcessMatcher`〕も同じ argv[0] で揃えている。decisions.md D13）
- [nit][conv:-] packages/server/src/surface/methods/agent.ts:141 `noteInteraction` を検査より前に呼ぶので、拒否される要求（busy の再試行）も操作として記録される / 対応: 修正済（`AgentStarter.start` の `onAccepted` で、予約の後・書き込みの前に記録。decisions.md D13）
- [nit][conv:-] packages/server/src/session/SessionService.ts:1201 pane を閉じても `resumeWrittenAt` の項目が消えない / 対応: 修正済（`publishPaneClosed` で消す）
- [nit][conv:-] docs/wtmctl.md:154 「前面がシェル自身だけの pane にしか打ち込まない」と言い切っており、確認と書き込みの間の競り合いの残るリスクが書かれていない / 対応: 修正済（2 回の確認・残る瞬間・確かめ直しの間の入力の遅れを書いた）

## ラウンド 2（review 工程・同じ別コンテキストに委譲。範囲はラウンド 1 の解消と修正差分の must/should）
ラウンド 1 の 5 件はすべて解消（argv[0] の nit は D13 の理由で見送りに同意）。修正差分に must・should は無し。
- [nit][conv:-] packages/server/src/terminal/TerminalHost.prepare.test.ts:36 prepare を待つ間に dispose・closeInput したとき build を呼ばず何も書かないことを直接見るテストが無い / 対応: 見送り（`runModal` の `activeModal !== job` の検査は既存の flush の待ちと同じ経路で、既存の `TerminalHost.test.ts` が終了時の reject を確かめている）
- [nit][conv:-] packages/server/src/agent/AgentStarter.ts:114 prepare で前面を最長 2 秒待つ間、その pane への打鍵が止まる（docs に記載済み） / 対応: 見送り（docs に記載。体感が問題になれば上限を短くする）
