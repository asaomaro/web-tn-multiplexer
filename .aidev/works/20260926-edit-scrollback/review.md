# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/server/src/terminal/Mirror.ts:177 折り返した行の途中を EL で消すと、右端の書いていないセルが詰まって 1 行につながる（xterm.js の選択コピーと同じ振る舞い。全角の折り返しとの兼ね合い） / 対応: 許容（decisions.md D12 に記録。T2・ラウンド1）
- [should][conv:-] packages/server/src/terminal/scrollbackEditor.test.ts:162 シンボリックリンクを置くテストが Windows で除外されていない（開発者モードでないと EPERM） / 対応: 修正済（リンク版を POSIX 限定にし、OS を問わない通常ファイル版を足した。T3・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/terminal/scrollbackEditor.test.ts:26 注入のテストの子プロセスが packages/server を cwd にしており、防御が壊れると痕跡が作業ツリーに残って後の実行まで落ちる / 対応: 修正済（`cwd: work`。T3・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/scrollbackEditor.test.ts:78 偽のエディタのパスを EDITOR に引用せず埋め込んでおり、TMPDIR に空白があるとテストが落ちる / 対応: 修正済（単引用符で囲んだ。T3・ラウンド1）
- [should][conv:-] packages/server/src/session/SessionModel.ts:62 `RemovalResult.successorPaneId` の説明が「replacePane だけが埋める」のまま / 対応: 修正済（T4・ラウンド1）
- [nit][conv:regression-negative-control] packages/server/src/session/SessionModel.test.ts:106 後継が無いときに「キーが無い」ことを確かめておらず、常に代入する変異が生き残る / 対応: 修正済（`Object.hasOwn` で確かめる。T4・ラウンド1）
- [nit][conv:-] T4 の点検用の差分に T3 のファイルの一時的な変異が混ざっていた（並行する点検者の変異の最中に差分を取った） / 対応: 許容（作業ツリーのファイルは正しいことを確かめた。以後は点検者の変異が終わってから差分を取る。T4・ラウンド1）
- [should][conv:regression-negative-control!] packages/server/src/session/SessionService.ts:655 猶予中にエディタが 0 で終わる経路（すぐ閉じる）を守るテストが無く、行を消しても全件通った / 対応: 修正済（テストを足し、消すと落ちることを負の確認 T5-13 で確かめた。T5・ラウンド1）
- [nit][conv:-] packages/server/src/session/SessionService.test.ts:184 起動の猶予の間に対象が閉じられたテストが例外の種類を見ていない / 対応: 修正済（`NotFoundError` を確かめる。T5・ラウンド1）
- [should][conv:regression-negative-control!] packages/server/src/surface/methods/pane.ts:155 `sizeAuthority.noteInteraction` を守るテストが無く、消しても全件通った / 対応: 修正済（送ったクライアントがサイズ権限を取るテストを足し、負の確認 T7-4 で落ちることを確かめた。T7・ラウンド1）
- [nit][conv:-] packages/server/src/composeServer.ts:303-307 停止処理の最中に届いた `editScrollback` が一覧を空にした後に登録すると、一時ディレクトリが残りうる / 対応: 許容（分割でも同じ時間帯に PTY が孤児になる既存の穴と同じ種類で、起きる時間はごく短い。残っても 0700。T7・ラウンド1）
- [nit][conv:-] packages/server/src/terminal/scrollbackEditor.ts:69 Windows ではプロセスを終わらせた直後の `rm` が EBUSY/EPERM で失敗しうる（推測） / 対応: 許容（warn のログに残る。Windows 実機は未検証の穴に書く。T7・ラウンド1）
- [should][conv:regression-negative-control!] packages/server/src/session/SessionService.ts:693 拡大表示を戻す条件の「元の pane が同じ tab にある」をテストが守っておらず、外すと元の pane を別の tab へ移した後によその tab に拡大表示がかかる / 対応: 修正済（moveToTab の後に閉じるテストを足し、負の確認 T6-6。T6・ラウンド1）
- [should][conv:regression-negative-control!] packages/server/src/session/SessionService.ts:674 停止時に削除の途中のものを待つ部分をテストが守っていない / 対応: 修正済（閉じた直後に dispose して戻った時点で空であることを見るテスト。負の確認 T6-7。T6・ラウンド1）
- [nit][conv:regression-negative-control] packages/server/src/session/SessionService.ts:780-787 replacePane でエディタの pane が閉じられる経路のテストが無い / 対応: 修正済（テストを足した。T6・ラウンド1）
- [nit][conv:regression-negative-control] packages/server/src/session/SessionService.ts:430-431 記録の削除（`scrollbackEditors.delete`・`scrollbackCleanups.delete`）を消しても落ちるテストが無い / 対応: 許容（害は記録が残ることと停止時の force の rm の二重だけ。private の中身を覗くテストは足さない。T6・ラウンド1）
- [nit][conv:-] packages/web/src/keys/keymap.ts:60,66 `ResolvedKeymap` の説明に「後続」の案内の記述が残っていた / 対応: 修正済（T8・ラウンド1）
- [nit][conv:-] packages/web/src/keys/keymap.test.ts:64,95 ほか コメントがもう無い `NOT_YET_BINDINGS` を経緯として指している / 対応: 許容（「〜だった」という経緯の記述として読める。T8・ラウンド1）
- [nit][conv:-] packages/web/src/keys/KeyRouter.test.ts:127 「`shift+r` が未対応のまま残る」の古いコメント / 対応: 修正済（削除。T8・ラウンド1）
- [nit][conv:-] packages/web/src/components/HelpDialog.test.ts:171 「（後続の shift+r）」の古いコメント / 対応: 修正済（T8・ラウンド1）
- [should][conv:-] docs/verification.md:583 AC13 の段落の `e` の期待に、Windows ネイティブで `VISUAL`/`EDITOR` が無いときはトーストになる但し書きが無い / 対応: 修正済（T9・ラウンド1）
- [nit][conv:-] docs/verification.md:349 手動確認が `/tmp/wtm-scrollback-*` を直に書き、`TMPDIR` の環境や `ls` をどこで打つかが書かれていない / 対応: 修正済（vim の `:!ls` で確かめる手順にし、`TMPDIR` を注記。T9・ラウンド1）
- [nit][conv:-] docs/verification.md:347 手動確認の項目が AC5・AC7 を名乗っているが確かめていない / 対応: 修正済（AC1〜AC4・AC6・AC8 に絞り、AC5・AC7 は単体テストと注記。T9・ラウンド1）
- [should][conv:regression-negative-control] packages/web/src/actions/ActionDispatcher.ts:596 エディタが猶予中に終わると応答の前に pane が閉じているのに、web が閉じた pane へ焦点を移し、打った文字も捨てる（タスクをまたぐ不変条件。cross） / 対応: 修正済（pane が残っているときだけ焦点を移す。テストと負の確認 cross-1。cross・ラウンド1）
- [nit][conv:-] packages/server/src/session/SessionService.ts:695 「closePane 由来では常に undefined」のコメントが事実と逆になった / 対応: 修正済（cross・ラウンド1）
- [nit][conv:-] packages/web/src/store/viewRepair.ts:34,72 後継のヒントの説明が `replacePane` 由来だけのまま / 対応: 修正済（cross・ラウンド1）

## ラウンド 1（2026-09-26・独立レビュー〔別コンテキスト〕）
- [should][conv:regression-negative-control!] packages/server/src/composeServer.ts:304 正常な停止での後片付け（AC8）を実現する `close()` の 1 行を守るテストが無く、消しても全テストが通る。`close()` を呼ぶ結合テストが既にあるので足せる / 対応: 差し戻し（coding）
- [nit][conv:-] packages/server/src/session/SessionModel.ts:928 再起動するとエディタの pane が拡大表示・焦点を持ったまま普通のシェルとして戻り、元の pane は隠れたまま。docs の H11 ⑤ と AC12 のテストがこの見え方に触れていない / 対応: docs に追記（coding）
- [nit][conv:-] packages/server/src/composeServer.ts:294-304 `disposeScrollbackEditors()` が `try` の後段にあり、先の処理が投げると呼ばれない / 対応: `finally` へ移す（coding）
- [nit][conv:regression-negative-control] packages/server/src/composeServer.ts:290-313 `finally` へ移したことを守るテストが無い（try の末尾へ戻しても通る） / 対応: 許容（途中の処理を投げさせる結合テストは停止処理の全体に偽物を差し込む必要があり、nit に見合わない。decisions.md D15。T7・ラウンド2）

## ラウンド 2（2026-09-26・独立レビュー〔別コンテキスト〕。範囲: ラウンド 1 の指摘の解消と、その後の差分）
- 指摘なし（must 0・should 0・nit 0）。ラウンド 1 の 3 件はすべて解消: ① `composeServer.integration.test.ts` の結合テスト（点検者が自分でも `disposeScrollbackEditors()` の行を消して落ちることを確かめ、戻して `cmp` 一致）② `docs/herdr-parity.md` H11 ⑤ の追記は実装（再起動で `scrollbackEditors` が空になり拡大表示を戻さない）と一致 ③ `finally` へ移した（中身は投げないので後ろの `lock.release()` を妨げない）。テストの `process.env` の差し替え・復元、`EDITOR="sleep 30 #"`（パスがコメントになる・`close()` で PTY ごと終わり `sleep` が残らない）、専用の `tmpRoot` による後片付けも問題なし。
- 通算（ラウンド 1・2。タスク点検ログは数えない）: must 0・should 1・nit 2。
