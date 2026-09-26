# 判断の記録（20260926-edit-scrollback）

## D1: この work の範囲（着手時）

- 背景: backlog の「端末機能の拡張: 端末内の画像表示、スクロールバックを $EDITOR で開く〔D8〕」は 2 つの
  独立した機能を 1 行に持つ。主エージェントの指示で、この work は「スクロールバックを $EDITOR で開く」
  （herdr `edit_scrollback`。`docs/herdr-parity.md` H11）だけを扱う。
- 決定: profile は full（protocol・server・web をまたぎ、安全性〔一時ファイル・シェルへの注入〕を扱うため
  light の条件〔振る舞い不変・小規模〕を外れる）。画像表示（H13）は対象外とし、deliver で backlog 行を
  `[x]`（この分）と `[ ]`（画像表示）の兄弟に割る。
- 理由・代替案: 2 機能を 1 work にまとめると、Kitty graphics（xterm.js の画像アドオン・サーバのミラーでの
  画像の扱い）の調査が加わり規模が読めない。分ければこの分を先に着地できる。
- 影響: requirements の「対象外」に画像表示を明記。deliver の backlog 消し込みは行の分割になる。

## D2: research 工程は挟まない（requirements 終了時の判定）

- 背景: `protocol.md`「4.5」の 5 条件で research の要否を判定する。
- 決定: 挟まない。
- 理由: ①未確定事項 3 件はどれも design の中で既存コードを読めば決められる（選択の問題で、調査で
  潰す不確実性ではない）②既存挙動（`pane.split`・`pane.zoom`・`pane.closed` の `successorPaneId`・
  `TerminalManager.create` の `shell`/`args`・`XtermMirror` の buffer）は requirements を書く前に
  コードを直読して確認済み ③技術的実現性（node-pty に argv を渡す・xterm headless の buffer から
  行を読む・`fs.mkdtemp`）は既存コードと Node の標準 API で足りる ④影響は protocol・server・web の 3 パッケージに
  またがるが、既存の操作追加（20260923-missing-keybinding-actions の `tab.move`）と同じ型の横断で、
  新しい境界は作らない ⑤利用者が操作する新しい部品（ポップオーバー等）は作らない（キー 1 つと、
  既存の pane の表示）。herdr の一次資料は requirements の表で直読済み。
- 影響: 次工程は design。

## D3: requirements の独立点検（2 ラウンドで上限）

- 背景: requirements の doccheck を 2 ラウンド（上限）行った（1 回目 9 件・2 回目 7 件。どれも内部一貫性の指摘で must は無し）。
- 決定: 2 回目の指摘のうち should 2 件（専用の一時ディレクトリが F3 に無い・Windows の既定が AC2 と食い違う）と nit 4 件
  （Windows の権限の基準・AC13 の参照・停止時の後片付けの対象範囲・異常終了時の扱い）は最小の差分で直した。
  残る nit 1 件（F8 の失敗の 4 場合が AC5 で「等」にまとめられている）は直さず、design の「受け入れ基準との対応」で
  4 場合を個別に書き、test で個別に確かめる。3 回目の点検はしない（上限）。Windows の既定のエディタ（`VISUAL`/`EDITOR`
  が無いとき）は requirements の段で「失敗にする」と決めた（herdr は notepad.exe。理由は F4 に記載）。
- 影響: design の未確定事項は `pane.closed` の `successorPaneId` の流用可否の 1 件だけ。

## D4: 書き出すのは通常バッファ（`buffer.normal`）

- 背景: xterm のミラーには通常バッファと代替画面がある。`bottomLines` は `buffer.active` を読む。herdr（ghostty の
  `recent_unwrapped_text_snapshot`）がどちらの画面を読むかは、一次資料を追ったが ghostty 側の実装（FFI の先）までは
  確かめていない（未確認）。
- 決定: 通常バッファを読む。
- 理由・代替案: スクロールバックを持つのは通常バッファだけで、代替画面（vim・less 等）には履歴が無い。`buffer.active` に
  すると、代替画面のアプリの中で押したときに画面 1 枚分しか開けない。US1（長い出力を扱う）には通常バッファが合う。
- 影響: 代替画面の中身（例: less が表示中の画面）はエディタに出ない。docs の herdr との違いに書く。

## D5: 「後続」の案内（`notYet`）の仕組みを外す

- 背景: `NOT_YET_BINDINGS` に残っていたのは `e` の 1 件だけ。
- 決定: `Action` の `notYet`・`NOT_YET_BINDINGS` と表へ入れる処理・`ActionDispatcher` の case・`HelpDialog` の `notYetEntry` を外す。
- 理由・代替案: 残すと空の配列を回す死んだ経路になり、キー一覧の表示はテストでも踏めなくなる。画像表示（H13）は herdr に既定の
  キーが無いので、案内を出す相手が無い。将来要るなら、そのとき戻せばよい。
- 影響: web のテストのうち `notYet`／`e` を前提にしたものを `edit_scrollback` の確認へ置き換える。

## D6: パスは位置引数で渡し、後片付けはサーバ側の 1 か所

- 背景: herdr は `shell_quote` したパスを script に埋め込み、script の `rm -f` とサーバの後片付けの二重で消す。
- 決定: `sh -c <固定の script> wtm-edit-scrollback <path>` で `$1` として渡す。一時ファイルは専用の一時ディレクトリに置き、
  消すのは `SessionService.publishPaneClosed`（pane を閉じる全経路が通る）・起動の失敗・停止時の 3 か所の同じ関数。
- 理由・代替案: 位置引数なら引用の関数の誤りが注入になる余地が無い。消す場所をサーバ側に寄せれば Windows でも同じで、テストで確かめられる。
- 影響: サーバが異常終了したときは dir が残る（0700 で守られる）。requirements AC8 の但し書きのとおり。

## D7: design の独立点検（2 ラウンドで上限）と architecture を挟まない判定

- 背景: design の doccheck を 2 ラウンド行った（1 回目 9 件〔must 1: 起動 script の表記が節ごとに違い、`$` を
  エスケープしない書き方が混ざっていた〕・2 回目 7 件〔行番号の出所・参照の向きなど、すべて should/nit〕）。
- 決定: 2 回目の指摘は全件を最小の差分で直した。3 回目はしない（上限）。script の正典はインターフェースの節の 1 か所とし、
  実物の `/bin/sh`（dash）で、空白・`"`・`$`・`;`・`'` を含むパスが偽のエディタに 1 引数で届くことを scratchpad で事前に
  確かめた（`EDITOR="<偽> --wait"` で argc=2・パスが 1 語）。テストは T3 で同じ形を固定する。
  architecture（protocol.md「4.5」の 4 条件）は挟まない: モジュール境界を動かさない（既存の `SessionService`・`TerminalManager`・
  `Mirror` に口を足し、新規は純関数と fs の小さな部品 1 ファイル）／新しい構造・パターンの選択が無い（`pane.split` と同じ形）／
  インターフェースは要求 1 つと記録の Map 1 つ／tasks に直接落とせる粒度まで書けている。
- 影響: 次工程は tasks。

## D8: T9（backlog 行の分割）は deliver で消化する

- 背景: AC13（backlog 行を割る）は coding の変更ではなく、deliver の「台帳の同期」（`aidev-70-deliver`「3.5」）で行う作業。
- 決定: tasks.md に T9 として立て、coding の承認時は未チェックのまま残す。消化は deliver。
- 影響: coding の `tasks_done` は 8（T1〜T8）になる。

## D9: tasks の独立点検で T5 を割り、番号を振り直した

- 背景: tasks の doccheck（1 回目 7 件）で「T5 が大きすぎる（開く側と閉じる側が混ざる）」などの指摘を受けた。
- 決定: SessionService を「開く側」（T5）と「閉じる側」（T6）に割り、以降を T7〜T10 に振り直した。D8 の「T9（backlog）」は
  **T10** に読み替える（coding の `tasks_done` は T1〜T9 の 9）。他の指摘（偽 Mirror・AC8 の割り当て・`TerminalManager` の引数の
  テスト・T7 の AC・`KeySettings.test`・オプションの明記）も tasks.md に反映した。
- 影響: なし（design は変えない）。

## D10: tasks の独立点検（2 ラウンドで上限）

- 背景: tasks の doccheck 2 回目は nit 2 件（作業順序の文と `依存:` のずれ・T3 に `CreatePaneOptions.args` が混ざっていた）。
- 決定: 2 件とも直した（`args` は `spawnForPane` のコマンド指定の前提なので T5 へ寄せた）。3 回目はしない（上限）。
- 影響: T3 は `scrollbackEditor.ts` だけ、T5 に `TerminalManager.ts` と新規 `TerminalManager.test.ts` が加わる。

## D11: `plainText` の折り返しの境目も `translateToString(true)` にした（design から逸脱）

- 背景: design（振る舞い 5）は「次の行が折り返しの続きなら右端を削らずに `translateToString(false)`」としていた。T2 の負の確認で、
  境目に**書いた**空白は `true` でも残る（xterm の trimRight は書いていないセルだけを落とす）ことが分かり、`false` の分岐が
  テストで区別できなかった。さらに全角の文字が右端の 1 セルに入らず折り返したとき、`false` だと空きのセルが空白として挟まる
  （`abcdefghi あ` になる）。
- 決定: 常に `translateToString(true)` にする。全角の折り返しのテストを足した（`false` に戻すと落ちる）。行を閉じるときの右端の
  空白の削除（書いた空白を含む）は `replace(/ +$/, "")` で別に行う。
- 影響: design の振る舞い 5 の記述と実装が違う（こちらが正）。

## D12: 折り返した行の途中を消した場合の詰まりは許容する（T2 の点検の nit）

- 背景: D11 で常に `translateToString(true)` にしたため、折り返した行の途中を EL（行末まで消去）で消すと、右端の書いていない
  セルが詰まって次の行とつながる（例: 10 桁で `abcdefghijKL` の後に 1 行目の 6 桁目から消すと `abcdeKL`）。点検者が
  `@xterm/headless` で実測。
- 決定: 直さない。
- 理由: xterm.js 自身の選択コピーも折り返しの行を trimRight でつなぐので同じ結果になる。全角の折り返し（D11）を正しく扱う方を
  優先する。書いた空白は残るので、普通の出力（上書きではなく追記）では起きない。
- 影響: なし。

## D13: 負の確認の道具の取り違え（事故）と復旧

- 背景: 負の確認の自作スクリプト（scratchpad の `mutate.py`）が退避先を 1 つの固定パスにしていた。T8（web）の負の確認を裏で
  走らせている間に T6（server）の負の確認を並行して走らせたため、互いの退避ファイルを上書きし、`SessionService.ts` に
  `bindings.ts` の中身が、`ActionDispatcher.ts` に `SessionService.ts`（T6 の変更入り）の中身が、`bindings.ts` に変異した版が
  書き戻された。
- 決定: 3 ファイルをタスクごとのスナップショット（scratchpad/snap/T5b）と取り違えた先の中身から復旧し、スナップショットとの `cmp`・
  T6 の変更だけが差分に残ることを `diff` で確かめた。スクリプトは退避先を実行ごとの一時ファイルにし、`flock` で同時に走らせない
  ようにした。取り違えの間に取った T6・T8 の負の確認の記録は捨て（`*.corrupted.log`）、取り直す。
- 影響: コードへの影響なし（復旧済み）。以後の負の確認は直列に走らせる。

## D14: review ラウンド 1 の差し戻しへの対応

- 背景: 独立レビュー（ラウンド 1）で should 1（停止時の後片付けの 1 行を守るテストが無い）・nit 2（再起動後の見え方が docs に無い・後片付けが `try` の後段）。
- 決定: `composeServer.close()` の `disposeScrollbackEditors()` を `finally` へ移し、実物の PTY でエディタを開いたまま `close()` して
  一時ディレクトリが消えることを確かめる結合テストを足した（`TMPDIR`・`EDITOR` をテストの中で差し替え、終われば戻す）。再起動後の
  見え方は直さず（F10 の範囲。保存形式に手を入れない）、`docs/herdr-parity.md` H11 ⑤ に書き足した。
- 影響: test-result.md の「未検証の穴」から `close()` の項を外す。

## D15: `finally` の位置のテストは足さない／点検中に残った一時ディレクトリの扱い

- 背景: T7 のラウンド 2 の点検で、`disposeScrollbackEditors()` を `finally` に置いたことを守るテストが無いと nit。また `/tmp/wtm-scrollback-Kj0yvG`（14:17 作成・空）が残っていた。
- 決定: 位置のテストは足さない（`close()` の途中を投げさせるには agentMonitor 等に偽物を差し込む必要があり、nit に見合わない）。残っていたディレクトリは、
  サーバのテスト一式を走らせる前後で `/tmp/wtm-scrollback-*` の数が変わらない（1→1）ことを確かめたうえで、点検の変異（後片付けを外した版を走らせた）の
  名残と判断して消した。
- 影響: なし。

## D16: 全体テストの負荷下の失敗は既存の不安定なテスト（この work の変更と無関係）

- 背景: review の差し戻し後の全体テストで、`composeServer.integration.test.ts` の「保存した session.json の tab は並べ替えた順」
  （2 つ目の tab が消える）・「偽の 'claude' で pane.agent_status_changed」（タイムアウト）と `packages/cli` の `main.integration.test.ts`
  が、共有マシンの負荷（load average 17〜30。別の worktree の build・test が並行）の下で落ちた。
- 確認: 変更した server・protocol のソース 8 ファイルを一時的に HEAD の内容に戻して（snapshot から戻し `cmp` で一致を確認）同じテストだけを
  5 回走らせると 2 回落ちた（`HEAD: passed failed passed failed passed`）。この work が持ち込んだ不安定さではない。
- 決定: 負荷が下がるのを待って全体テストを 2 回流し直し、2 回とも通ったものを test-result.md に貼る。不安定なテスト自体の修正はこの work の範囲外。
- 影響: なし。
