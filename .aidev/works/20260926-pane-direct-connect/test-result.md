# テスト結果: `wtmctl pane attach`（20260926-pane-direct-connect）

> ラウンド 1（下の各節）の後、review ラウンド 1 の差し戻し（問い合わせの取り除き・戻す列・切り離し中の扱い・シグナル・AC1 の実物での確認）を
> 直して test をやり直した。その結果は末尾の「ラウンド 2」。**着地の判定はラウンド 2 の結果による**。

## 実行したもの

- `pnpm -s build` → exit 0、`pnpm -s typecheck` → exit 0（build を先に。web の `vue-tsc` を含む）
- 追加・変更したテストの単体実行: protocol `messages.test.ts` 29 passed／server `SizeAuthority.test.ts` 37 passed・`surface/methods/attach.test.ts` 6 passed／
  cli `attachKeys.test.ts` 5 passed・`commands/attach.test.ts` 13 passed・`cliArgs.test.ts` 96 passed・`attach.integration.test.ts` 4 passed（実サーバ・実 PTY）
- 全体 `pnpm -s test` を 4 回（下の生出力）。この work の最終の差分で **run2 と run4 の 2 回が全件 pass**（3530 passed / 0 failed / 0 skipped）。
  run1・run3 はそれぞれ 1 件だけ落ちた——どちらも backlog「単体・結合テストが高負荷のときだけ落ちる」に挙がっている種類（下の「失敗の証跡」）。
- `aidev smoke`（3 本）→ pass。cli の smoke に実物の PTY での `pane attach` の一巡を足した（下の「起動確認」）。
- 負の確認（足した判定を 1 つずつ壊す）26 通り → 全て検出（下の「負の確認」）。

```
$ pnpm -s test   # run1
 Test Files  1 failed | 176 passed (177)
      Tests  1 failed | 3529 passed (3530)
$ pnpm -s test   # run2
 Test Files  177 passed (177)
      Tests  3530 passed (3530)
$ pnpm -s test   # run3
 Test Files  1 failed | 176 passed (177)
      Tests  1 failed | 3529 passed (3530)
$ pnpm -s test   # run4
 Test Files  177 passed (177)
      Tests  3530 passed (3530)
```

## 受け入れ基準ごとの判定

- AC1: pass — 結合テスト「画面と出力が手元に届き…」で代替画面の列・SNAPSHOT の後に echo の結果行が手元に届く。smoke で実物の PTY でも echo の往復。
- AC2: pass — 同テストで手元から打った `echo` が pane で実行される（結果の行だけを判定）。単体でも INPUT の送信（C12 で検出）。
- AC3: pass — 単体（SizeAuthority・方式・CLI の attach_resize）と結合（サーバのモデルの pane が 100x30→90x25）。smoke で node-pty の resize が 90x25 に反映。
- AC4: pass — 単体（別のデスクトップの操作・権限者でないモバイルの fit・client.view でも直結中の pane は 120x40 のまま、同じ tab のほかの pane は変わる。M1 で検出）と、
  結合（desktop として hello したクライアントの client.view 60x18 でも 100x30 のまま）。
- AC5: pass — 単体（not_a_tty・withSession を呼ばない・端末に書かない。C1 で検出）と smoke（execFile の stdin で終了コード 1・stderr に not_a_tty）。
- AC6: pass — 単体（AttachKeyFilter 5 件・K1〜K4 で検出、Ctrl+B q で pane.detach を送って正常終了・C9 で検出）、結合（切り離し後も pane が残る）、smoke（実物の PTY で Ctrl+B q → 終了コード 0・pane が残る）。
- AC7: pass — 単体で 4 つの終わり方と subscribe の失敗のそれぞれで RESTORE と raw モードの戻し（C7・C8 で検出）、切断で connection_closed（C5・C6 で検出）。
- AC8: pass — 単体（M2 で検出）と結合（2 本目が pane_attached・手元に何も書かない・1 本目の打鍵は届き続ける）。
- AC9: pass — 単体（takeover で所有者と大きさが入れ替わり、イベントが出る。CLI は自分以外の clientId で attach_taken_over。C13・C3 で検出）と結合（1 本目が attach_taken_over・大きさが 81x23）。
- AC10: pass — 単体（detach・切断で tab の権限者の大きさへ戻る／権限者がいなければ直結の大きさのまま／移譲の後に解放。M4・M5・M6 で検出）と結合（切り離し後にブラウザの 60x18 へ戻る）。
- AC11: pass — 結合で、直結中にブラウザ相当の購読へ同じ出力が届き、ブラウザ相当からの INPUT の結果が手元に届く。
- AC12: pass — 結合で /ws の upgrade が Cookie 無しで 401、偽の Origin で 403（`pane.attach` まで届かない）。新しい方式は ControlSurface にだけ登録（`packages/server/src/surface/methods/index.ts`）。
- AC13: pass — 単体（pane.exited・pane.closed で pane_closed。C4 で検出）と結合（直結中のシェルに `exit` で pane_closed）。
- AC14: pass — `docs/wtmctl.md` に「pane への直結」節と「herdr との対応と違い > pane attach」、`docs/herdr-parity.md` の H40 を更新（T9 のタスク点検で実装と照合）。

## 失敗の証跡

全体テストで落ちた 2 回（この work の差分とは関係の無い既知の高負荷時の失敗。load average は 14〜16 前後）。

run1: `packages/cli/src/main.integration.test.ts`（backlog の (1) と同じ `Invalid value "undefined" for header "cookie"`）。

```
 FAIL  |@wtm/cli| src/main.integration.test.ts > wtmctl main integration（実サーバ・実 PTY） > Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）
TypeError: Invalid value "undefined" for header "cookie"
 ❯ initAsClient ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js:885:28
 ❯ new WebSocket ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js:88:7
 ❯ src/main.integration.test.ts:255:16
    253|    */
    254|   it("Origin ヘッダが許可リストに無い接続は、この work の後も既存どおり 403 で拒否される（AC9）", async …
    255|     const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
       |                ^
    256|       headers: { cookie: (await store.get(url))!, origin: "http://evil…
    257|     });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

run3: `packages/web/src/App.test.ts`（backlog の (4) と同じファイル・同じ 5000ms の時間切れ。この work は web の `clientError.ts` の網羅表しか変えていない）。

```
 FAIL  |@wtm/web| src/App.test.ts > App — pane の枠・隙間の太さの CSS 変数（AC9） > `settings.paneFrameThickness` を変えると、リアクティブに変わる（ページの再読み込み不要）
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/App.test.ts:221:3
    219|   });
    220|
    221|   it("`settings.paneFrameThickness` を変えると、リアクティブに変わる（ページの再読み込み不要）", as…
       |   ^
    222|     const settings = useSettingsStore(pinia);
    223|     const wrapper = mount(App, makeProvide(makeConnection()));

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

どちらも単独で 3 回ずつ流して全て通った:

```
$ (packages/cli) npx vitest run src/main.integration.test.ts   # 単独 1 回目
      Tests  8 passed (8)
$ (packages/cli) npx vitest run src/main.integration.test.ts   # 単独 2 回目
      Tests  8 passed (8)
$ (packages/cli) npx vitest run src/main.integration.test.ts   # 単独 3 回目
      Tests  8 passed (8)
$ (packages/web) npx vitest run src/App.test.ts   # 単独 1 回目
      Tests  13 passed (13)
$ (packages/web) npx vitest run src/App.test.ts   # 単独 2 回目
      Tests  13 passed (13)
$ (packages/web) npx vitest run src/App.test.ts   # 単独 3 回目
      Tests  13 passed (13)
```

その後の全体 run4 は全件 pass（上の「実行したもの」）。

## 負の確認（`.aidev/conventions/regression-negative-control.md`）

足した判定を 1 つずつ壊し、対応するテストが落ちることを確かめた（`scratchpad/pane-direct-connect/neg/mutate.py`。壊したファイルは毎回元に戻し `cmp` で一致を確認）。
M3・C5 は最初の実行で置き換え対象が prettier の整形後の形と合わず SKIP になったので、実物に合わせて再実行した（末尾）。

```
### M1 大きさの鍵を外す（applyOwnerSize が直結中の pane も変える）
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× 直結中はブラウザの client.view・操作・fit が直結中の pane の大きさを変えない。同じ tab のほかの pane は変わる（AC4） 145ms
× 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する） 15ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > 直結中はブラウザの client.view・操作・fit が直結中の pane の大きさを変えない。同じ tab のほかの pane は変わる（AC4）
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する）
Tests  2 failed | 41 passed (43)
restored: cmp OK

### M2 所有者がいても takeover 無しの attach を拒まない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× 別の所有者がいれば pane_attached を方式のエラーとして返し、takeover で奪える（AC8・AC9） 334ms
× 別の所有者がいれば takeover 無しの attach は pane_attached で拒まれ、所有者も大きさも変わらない（AC8） 165ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > 別の所有者がいれば takeover 無しの attach は pane_attached で拒まれ、所有者も大きさも変わらない（AC8）
FAIL  src/surface/methods/attach.test.ts > pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect） > 別の所有者がいれば pane_attached を方式のエラーとして返し、takeover で奪える（AC8・AC9）
Tests  2 failed | 41 passed (43)
restored: cmp OK

### M3 所有者が変わっても pane.attach_changed を出さない
SKIP: 置き換え対象が 0 箇所（packages/server/src/clients/SizeAuthority.ts）

### M4 切断で直結を解放しない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× 所有者の接続が切れると（onClientGone）直結を解放して tab の権限者の大きさへ戻す（AC10） 23ms
× 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する） 20ms
× tab の権限者自身が直結の所有者でもあり移譲先がいなければ、切断で自分の view の大きさへは戻さない（移譲してから解放する順序） 7ms
× pane が閉じた後の解放は大きさを戻さずに所有者だけを消す 10ms
Tests  4 failed | 39 passed (43)
restored: cmp OK

### M5 解放を tab の権限の移譲より前に行う
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× tab の権限者自身が直結の所有者でもあり移譲先がいなければ、切断で自分の view の大きさへは戻さない（移譲してから解放する順序） 60ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > tab の権限者自身が直結の所有者でもあり移譲先がいなければ、切断で自分の view の大きさへは戻さない（移譲してから解放する順序）
Tests  1 failed | 42 passed (43)
restored: cmp OK

### M6 解放しても tab の権限者の大きさへ戻さない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× detach すると所有者を消し、tab の権限者の表示の大きさへ戻し、clientId: null の pane.attach_changed を出す（AC10） 88ms
× 所有者の接続が切れると（onClientGone）直結を解放して tab の権限者の大きさへ戻す（AC10） 13ms
× 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する） 8ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > detach すると所有者を消し、tab の権限者の表示の大きさへ戻し、clientId: null の pane.attach_changed を出す（AC10）
Tests  3 failed | 40 passed (43)
restored: cmp OK

### M7 所有者でなくても attach_resize で大きさを変えられる
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× pane.attach_resize は所有者なら大きさを変え、所有者でなければ not_attached（AC3） 238ms
× resizeAttached は所有者だけが大きさを変えられる。所有者でなければ not_attached で何も変えない（AC3） 111ms
× takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9） 7ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > resizeAttached は所有者だけが大きさを変えられる。所有者でなければ not_attached で何も変えない（AC3）
Tests  3 failed | 40 passed (43)
restored: cmp OK

### M8 所有者でなくても detach で直結を終えられる
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× pane.detach は所有者なら直結を終え、所有者でない・pane が無いときは何もせず成功する 96ms
× takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9） 90ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9）
FAIL  src/surface/methods/attach.test.ts > pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect） > pane.detach は所有者なら直結を終え、所有者でない・pane が無いときは何もせず成功する
Tests  2 failed | 41 passed (43)
restored: cmp OK

### M9 方式で pane の有無を確かめない（pane.attach）
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/surface/methods/attach.ts を変異
exit=1
× 存在しない pane への attach・attach_resize は not_found で、所有者を作らない 101ms
FAIL  src/surface/methods/attach.test.ts > pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect） > 存在しない pane への attach・attach_resize は not_found で、所有者を作らない
Tests  1 failed | 42 passed (43)
restored: cmp OK

### C1 端末でなくても繋ぐ
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 端末でなければ繋がずに not_a_tty（AC5） 142ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 端末でなければ繋がずに not_a_tty（AC5）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C2 自分の clientId を知る前の null を自分とみなす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない 82ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C3 自分が所有者になる前の知らせでも奪われたとみなす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 自分が所有者になる前に届いた別のクライアントの所有者の変化（["other",null] の順）では終わらない 70ms
× 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない 60ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 自分が所有者になる前に届いた別のクライアントの所有者の変化（["other",null] の順）では終わらない
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない
Tests  2 failed | 16 passed (18)
restored: cmp OK

### C4 pane の終了で終わらない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× pane.exited で pane_closed で終わる（AC13・AC7） 5074ms
× pane.closed で pane_closed で終わる（AC13・AC7） 5027ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > pane.exited で pane_closed で終わる（AC13・AC7）
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > pane.closed で pane_closed で終わる（AC13・AC7）
Tests  2 failed | 16 passed (18)
restored: cmp OK

### C5 切断で終わらない
SKIP: 置き換え対象が 0 箇所（packages/cli/src/commands/attach.ts）

### C6 subscribe の応答だけを待つ（終わりと race しない）
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× pane.subscribe の応答を待つ間に切断されても、要求の時間切れを待たずに connection_closed で終わる（AC7） 5007ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > pane.subscribe の応答を待つ間に切断されても、要求の時間切れを待たずに connection_closed で終わる（AC7）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C7 終わるときに端末のモードを戻す列を書かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 70ms
× --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7） 56ms
× pane.exited で pane_closed で終わる（AC13・AC7） 55ms
× pane.closed で pane_closed で終わる（AC13・AC7） 55ms
Tests  7 failed | 11 passed (18)
restored: cmp OK

### C8 終わるときに raw モードを戻さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 76ms
× --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7） 55ms
× pane.exited で pane_closed で終わる（AC13・AC7） 56ms
× pane.closed で pane_closed で終わる（AC13・AC7） 55ms
Tests  7 failed | 11 passed (18)
restored: cmp OK

### C9 切り離しで pane.detach を送らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 79ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C10 代替画面に入る列を書かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 68ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C11 手元の大きさの変化を送らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさが変わると pane.attach_resize で追従する（AC3） 71ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさが変わると pane.attach_resize で追従する（AC3）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C12 打鍵を pane へ送らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 66ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### C13 --takeover を pane.attach に渡さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7） 79ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7）
Tests  1 failed | 17 passed (18)
restored: cmp OK

### K1 Ctrl+B q で切り離さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× Ctrl+B q で切り離す。それより前のバイトは送り、q より後ろは捨てる 19ms
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 5ms
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 5036ms
× 手元の大きさが変わると pane.attach_resize で追従する（AC3） 5005ms
Tests  6 failed | 12 passed (18)
restored: cmp OK

### K2 Ctrl+B Ctrl+B で Ctrl+B を 2 つ送る
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× Ctrl+B Ctrl+B は Ctrl+B を 1 つ送る 16ms
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 3ms
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > Ctrl+B Ctrl+B は Ctrl+B を 1 つ送る
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う
Tests  2 failed | 16 passed (18)
restored: cmp OK

### K3 Ctrl+B に続くその他のキーで Ctrl+B を落とす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× Ctrl+B に続くそれ以外のバイトは両方を送る（Ctrl+B q 以外は切り離さない） 26ms
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 7ms
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > Ctrl+B に続くそれ以外のバイトは両方を送る（Ctrl+B q 以外は切り離さない）
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う
Tests  2 failed | 16 passed (18)
restored: cmp OK

### K4 読み取りの境界で接頭辞の保留を捨てる
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 40ms
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う
Tests  1 failed | 17 passed (18)
restored: cmp OK

rc=0

# 以下は M3・C5 の置き換え対象を整形後の実物に合わせて再実行した出力
### M3 所有者が変わっても pane.attach_changed を出さない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× pane.attach は大きさを当てて当てた大きさを返し、pane.attach_changed を出す（AC3） 34ms
× attach は pane の大きさを直結の大きさにし、所有者を記録して pane.attach_changed を 1 回出す（AC3） 18ms
× 別の所有者がいれば takeover 無しの attach は pane_attached で拒まれ、所有者も大きさも変わらない（AC8） 6ms
× takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9） 5ms
Tests  6 failed | 37 passed (43)
restored: cmp OK

### C5 切断で終わらない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× サーバ側の切断で connection_closed で終わる（AC7） 5014ms
× pane.subscribe の応答を待つ間に切断されても、要求の時間切れを待たずに connection_closed で終わる（AC7） 5005ms
× 終わった後に届いた出力は書かない 5005ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > サーバ側の切断で connection_closed で終わる（AC7）
Tests  3 failed | 15 passed (18)
restored: cmp OK
```

## 起動確認（smoke）

`smokeCommands` の 2 本目（`pnpm --filter @wtm/cli run smoke`）の `packages/cli/src/smoke.ts` に、端末でない stdin での `not_a_tty` と、
node-pty の PTY の中でビルド済みの `wtmctl pane attach` を動かす一巡を足した（`.aidev/config.yml` は変えていない。decisions D5）。

```
$ aidev smoke
smoke: 20260926-pane-direct-connect
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38842 (state dir /tmp/wtm-smoke-fdDGIw)
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/pane-direct-connect/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-N8gjd4, sandboxed HOME /tmp/wtmctl-smoke-home-05UTZS
smoke(cli): server listening on http://127.0.0.1:39634
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: deleted session smoke (/tmp/tmp.jpVEXNu9gc/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

## 未検証の穴（skip / 環境不足）

- skip したテストは無い（0 skipped）。
- **Windows・macOS の端末からの直結**は確かめていない（Linux の node-pty の PTY と偽の端末だけ）。
- **本物のエージェント（Claude Code・Codex 等）を直結して切り離した後の手元の端末の状態**（kitty keyboard のフラグ・modifyOtherKeys を戻さない。decisions D4）は確かめていない。
- **pane の中のアプリが代替画面から出たときの手元の表示の乱れ**（生の出力を流すため。decisions D4）は既知の制約として docs に書いたが、実際の見え方は確かめていない。
- **ブラウザの画面での見え方**（直結中に pane が直結の大きさで描かれること）は E2E を走らせない方針のため確かめていない。サーバ側では `pane.size_changed` が出ることと、
  web が非所有者として `term.resize` する既存の経路（research F5）に依拠している。
- SIGTERM 等のシグナルで `wtmctl pane attach` が殺されたときの手元の端末の戻しは扱っていない（接続が切れればサーバは直結を解放する）。


## ラウンド 2（review ラウンド 1 の差し戻しの後）

### 実行したもの

- `pnpm -s build` → exit 0、`pnpm -s typecheck` → exit 0。
- 全体 `pnpm -s test` を 2 回続けて、**2 回とも全件 pass**（3587 passed / 0 failed / 0 skipped。テストファイル 178）。

```
$ pnpm -s test   # run5
 Test Files  178 passed (178)
      Tests  3587 passed (3587)
$ pnpm -s test   # run6
 Test Files  178 passed (178)
      Tests  3587 passed (3587)
```

- 追加したテスト: `packages/cli/src/attachOutput.test.ts`（問い合わせの取り除き 51 件）、`commands/attach.test.ts` に SNAPSHOT での持ち越しの破棄・
  切り離し中の打鍵の停止と切断／奪取／pane の終了・シグナル・`processTerminal().onSignal` の配線、`attach.integration.test.ts` の 1 本目に
  直結前の画面が SNAPSHOT で届くこと（AC1）・`stty size` が `30 100`（AC3）・DA1 の問い合わせを手元に書かないこと（ミラーが答え、`read -rs -d c` がそれを読む）。
- smoke に、切り離した後（印の出力より後）に代替画面から出る列が書かれることの確認を足した。

### 受け入れ基準ごとの判定（ラウンド 1 からの変化だけ）

- AC1: pass — 結合テストで、直結の前にブラウザ相当から出した `BEFORE_…` が打鍵より前に手元に届く（SNAPSHOT で見えている画面が描かれる）。
  問い合わせは手元に書かない（Q1 の変異で単体・結合の両方が落ちる）。
- AC3: pass — 結合テストで pane の中の `stty size` が手元の大きさ（`30 100`）。
- AC7: pass — 切り離し中の切断・奪取・pane の終了は正常な切り離し（0）で終わり、手元の端末を戻す（C14〜C17）。SIGTERM・SIGHUP も切り離し（C18・C19）。
- その他の AC はラウンド 1 の判定のまま（全体テスト・smoke で退行なし）。

### 失敗の証跡

全体テスト・smoke での失敗はこのラウンドでは発生していない。負の確認で、変異 Q5（中間文字を確かめない）が最初は**検出されなかった**
（`CSI … $ t` は `$` の分岐が先に扱うため、Q5 を消しても既存のテストでは違いが出なかった）:

```
### Q5 中間文字を確かめない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=0
Tests  74 passed (74)
restored: cmp OK
```

`$` 以外の中間文字を持つ列（`CSI 14 SP t`）を「残す」側のテストに足し、Q5 を再実行して検出を確かめた（下の負の確認の末尾）。

### 負の確認（ラウンド 2。40 通り＋Q5 の再実行）

ラウンド 1 の 26 通り（整形後の実物に合わせて一部の置き換え対象を直した）に、差し戻しで足した判定の 14 通り（Q1〜Q8・C14〜C19）を加えて全部流した。
Q1 は結合テストも流す。`RESTORE_SCREEN` の中身（ESC 7/8 で挟むこと等）は、テストが定数そのものと比べるので変異では検出できない（未検証の穴）。

```
### M1 大きさの鍵を外す（applyOwnerSize が直結中の pane も変える）
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× 直結中はブラウザの client.view・操作・fit が直結中の pane の大きさを変えない。同じ tab のほかの pane は変わる（AC4） 54ms
× 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する） 32ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > 直結中はブラウザの client.view・操作・fit が直結中の pane の大きさを変えない。同じ tab のほかの pane は変わる（AC4）
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する）
Tests  2 failed | 41 passed (43)
restored: cmp OK

### M2 所有者がいても takeover 無しの attach を拒まない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× 別の所有者がいれば pane_attached を方式のエラーとして返し、takeover で奪える（AC8・AC9） 98ms
× 別の所有者がいれば takeover 無しの attach は pane_attached で拒まれ、所有者も大きさも変わらない（AC8） 23ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > 別の所有者がいれば takeover 無しの attach は pane_attached で拒まれ、所有者も大きさも変わらない（AC8）
FAIL  src/surface/methods/attach.test.ts > pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect） > 別の所有者がいれば pane_attached を方式のエラーとして返し、takeover で奪える（AC8・AC9）
Tests  2 failed | 41 passed (43)
restored: cmp OK

### M3 所有者が変わっても pane.attach_changed を出さない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× pane.attach は大きさを当てて当てた大きさを返し、pane.attach_changed を出す（AC3） 140ms
× attach は pane の大きさを直結の大きさにし、所有者を記録して pane.attach_changed を 1 回出す（AC3） 52ms
× 別の所有者がいれば takeover 無しの attach は pane_attached で拒まれ、所有者も大きさも変わらない（AC8） 21ms
× takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9） 31ms
Tests  6 failed | 37 passed (43)
restored: cmp OK

### M4 切断で直結を解放しない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× 所有者の接続が切れると（onClientGone）直結を解放して tab の権限者の大きさへ戻す（AC10） 30ms
× 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する） 24ms
× tab の権限者自身が直結の所有者でもあり移譲先がいなければ、切断で自分の view の大きさへは戻さない（移譲してから解放する順序） 9ms
× pane が閉じた後の解放は大きさを戻さずに所有者だけを消す 14ms
Tests  4 failed | 39 passed (43)
restored: cmp OK

### M5 解放を tab の権限の移譲より前に行う
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× tab の権限者自身が直結の所有者でもあり移譲先がいなければ、切断で自分の view の大きさへは戻さない（移譲してから解放する順序） 41ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > tab の権限者自身が直結の所有者でもあり移譲先がいなければ、切断で自分の view の大きさへは戻さない（移譲してから解放する順序）
Tests  1 failed | 42 passed (43)
restored: cmp OK

### M6 解放しても tab の権限者の大きさへ戻さない
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× detach すると所有者を消し、tab の権限者の表示の大きさへ戻し、clientId: null の pane.attach_changed を出す（AC10） 36ms
× 所有者の接続が切れると（onClientGone）直結を解放して tab の権限者の大きさへ戻す（AC10） 10ms
× 権限者の接続と直結の所有者が同時にいなくなっても、移譲先（別のデスクトップ）の大きさへ戻る（移譲の後に解放する） 11ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > detach すると所有者を消し、tab の権限者の表示の大きさへ戻し、clientId: null の pane.attach_changed を出す（AC10）
Tests  3 failed | 40 passed (43)
restored: cmp OK

### M7 所有者でなくても attach_resize で大きさを変えられる
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× pane.attach_resize は所有者なら大きさを変え、所有者でなければ not_attached（AC3） 67ms
× resizeAttached は所有者だけが大きさを変えられる。所有者でなければ not_attached で何も変えない（AC3） 70ms
× takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9） 17ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > resizeAttached は所有者だけが大きさを変えられる。所有者でなければ not_attached で何も変えない（AC3）
Tests  3 failed | 40 passed (43)
restored: cmp OK

### M8 所有者でなくても detach で直結を終えられる
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/clients/SizeAuthority.ts を変異
exit=1
× pane.detach は所有者なら直結を終え、所有者でない・pane が無いときは何もせず成功する 27ms
× takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9） 54ms
FAIL  src/clients/SizeAuthority.test.ts > DefaultSizeAuthority — pane への直結（所有者と大きさの鍵） > takeover の attach は所有者を入れ替え、新しい所有者の大きさにし、新しい所有者で pane.attach_changed を出す。前の所有者は大きさを変えられない（AC9）
FAIL  src/surface/methods/attach.test.ts > pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect） > pane.detach は所有者なら直結を終え、所有者でない・pane が無いときは何もせず成功する
Tests  2 failed | 41 passed (43)
restored: cmp OK

### M9 方式で pane の有無を確かめない（pane.attach）
$ (packages/server) npx vitest run src/clients/SizeAuthority.test.ts src/surface/methods/attach.test.ts   # packages/server/src/surface/methods/attach.ts を変異
exit=1
× 存在しない pane への attach・attach_resize は not_found で、所有者を作らない 42ms
FAIL  src/surface/methods/attach.test.ts > pane.attach / pane.attach_resize / pane.detach（20260926-pane-direct-connect） > 存在しない pane への attach・attach_resize は not_found で、所有者を作らない
Tests  1 failed | 42 passed (43)
restored: cmp OK

### C1 端末でなくても繋ぐ
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 端末でなければ繋がずに not_a_tty（AC5） 55ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 端末でなければ繋がずに not_a_tty（AC5）
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C2 自分の clientId を知る前の null を自分とみなす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない 100ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C3 自分が所有者になる前の知らせでも奪われたとみなす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 自分が所有者になる前に届いた別のクライアントの所有者の変化（["other",null] の順）では終わらない 86ms
× 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない 99ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 自分が所有者になる前に届いた別のクライアントの所有者の変化（["other",null] の順）では終わらない
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 自分が所有者になる前に届いた別のクライアントの所有者の変化（[null,"other"] の順）では終わらない
Tests  2 failed | 72 passed (74)
restored: cmp OK

### C4 pane の終了で終わらない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× pane.exited で pane_closed で終わる（AC13・AC7） 5085ms
× pane.closed で pane_closed で終わる（AC13・AC7） 5041ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > pane.exited で pane_closed で終わる（AC13・AC7）
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > pane.closed で pane_closed で終わる（AC13・AC7）
Tests  2 failed | 72 passed (74)
restored: cmp OK

### C5 切断で終わらない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× サーバ側の切断で connection_closed で終わる（AC7） 5152ms
× pane.subscribe の応答を待つ間に切断されても、要求の時間切れを待たずに connection_closed で終わる（AC7） 5005ms
× 終わった後に届いた出力は書かない 5009ms
× Ctrl+B q の後は detach の応答を待つ間も打鍵を送らず、その間の切断も切り離しとして正常に終える 5004ms
Tests  4 failed | 70 passed (74)
restored: cmp OK

### C6 subscribe の応答だけを待つ（終わりと race しない）
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× pane.subscribe の応答を待つ間に切断されても、要求の時間切れを待たずに connection_closed で終わる（AC7） 5061ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > pane.subscribe の応答を待つ間に切断されても、要求の時間切れを待たずに connection_closed で終わる（AC7）
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C7 終わるときに端末のモードを戻す列を書かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 292ms
× --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7） 136ms
× pane.exited で pane_closed で終わる（AC13・AC7） 66ms
× pane.closed で pane_closed で終わる（AC13・AC7） 86ms
Tests  11 failed | 63 passed (74)
restored: cmp OK

### C8 終わるときに raw モードを戻さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 109ms
× --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7） 57ms
× pane.exited で pane_closed で終わる（AC13・AC7） 60ms
× pane.closed で pane_closed で終わる（AC13・AC7） 59ms
Tests  11 failed | 63 passed (74)
restored: cmp OK

### C9 切り離しで pane.detach を送らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 392ms
× SIGTERM・SIGHUP（onSignal）は切り離しと同じに扱う 72ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7）
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > SIGTERM・SIGHUP（onSignal）は切り離しと同じに扱う
Tests  2 failed | 72 passed (74)
restored: cmp OK

### C10 代替画面に入る列を書かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 210ms
× 出力と SNAPSHOT から端末への問い合わせを取り除いて書く（手元の端末に答えさせない。D8） 75ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7）
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 出力と SNAPSHOT から端末への問い合わせを取り除いて書く（手元の端末に答えさせない。D8）
Tests  2 failed | 72 passed (74)
restored: cmp OK

### C11 手元の大きさの変化を送らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさが変わると pane.attach_resize で追従する（AC3） 333ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさが変わると pane.attach_resize で追従する（AC3）
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C12 打鍵を pane へ送らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 242ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7）
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C13 --takeover を pane.attach に渡さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7） 105ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > --takeover を pane.attach に渡し、別のクライアントが所有者になったら attach_taken_over で終わる（AC9・AC7）
Tests  1 failed | 73 passed (74)
restored: cmp OK

### Q1 出力から問い合わせを取り除かない（結合テストも流す）
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachOutput.test.ts src/attach.integration.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 出力と SNAPSHOT から端末への問い合わせを取り除いて書く（手元の端末に答えさせない。D8） 226ms
× SNAPSHOT は前の出力の書きかけの列を持ち越さずに描く 57ms
× 画面と出力が手元に届き、打鍵が pane に届き、大きさは直結に揃い、ブラウザは表示と入力を続けられる。切り離すと pane は残りブラウザの大きさへ戻る（AC1・AC2・AC3・AC4・AC6・AC10・AC11） 5088ms
FAIL  src/attach.integration.test.ts > wtmctl pane attach integration（実サーバ・実 PTY・偽の手元の端末） > 画面と出力が手元に届き、打鍵が pane に届き、大きさは直結に揃い、ブラウザは表示と入力を続けられる。切り離すと pane は残りブラウザの大きさへ戻る（AC1・AC2・AC3・AC4・AC6・AC10・AC11）
Tests  3 failed | 70 passed (73)
restored: cmp OK

### Q2 SNAPSHOT で持ち越しを捨てない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× SNAPSHOT は前の出力の書きかけの列を持ち越さずに描く 135ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > SNAPSHOT は前の出力の書きかけの列を持ち越さずに描く
Tests  1 failed | 73 passed (74)
restored: cmp OK

### Q3 文字列の中の ESC で文字列を打ち切らない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=1
× 文字列の列の中で \ 以外が続く ESC は文字列を打ち切り、続く問い合わせも取り除く 83ms
FAIL  src/attachOutput.test.ts > TerminalQueryFilter（出力から端末への問い合わせを取り除く。20260926-pane-direct-connect D8） > 文字列の列の中で \ 以外が続く ESC は文字列を打ち切り、続く問い合わせも取り除く
Tests  1 failed | 73 passed (74)
restored: cmp OK

### Q4 前置きに関係なく CSI … n を問い合わせとみなす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=1
× XTMODKEYS の無効化（CSI > Pp n） は残す 90ms
FAIL  src/attachOutput.test.ts > TerminalQueryFilter（出力から端末への問い合わせを取り除く。20260926-pane-direct-connect D8） > XTMODKEYS の無効化（CSI > Pp n） は残す
Tests  1 failed | 73 passed (74)
restored: cmp OK

### Q5 中間文字を確かめない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=0
Tests  74 passed (74)
restored: cmp OK

### Q6 ENQ を取り除かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=1
× ENQ を取り除き、前後の文字は残す 14ms
FAIL  src/attachOutput.test.ts > TerminalQueryFilter（出力から端末への問い合わせを取り除く。20260926-pane-direct-connect D8） > ENQ を取り除き、前後の文字は残す
Tests  1 failed | 73 passed (74)
restored: cmp OK

### Q7 クリップボードの読み出しを取り除かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=1
× クリップボードの読み出し を取り除き、前後の文字は残す 16ms
FAIL  src/attachOutput.test.ts > TerminalQueryFilter（出力から端末への問い合わせを取り除く。20260926-pane-direct-connect D8） > クリップボードの読み出し を取り除き、前後の文字は残す
Tests  1 failed | 73 passed (74)
restored: cmp OK

### Q8 色の問い合わせを取り除かない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=1
× 前景色（BEL） を取り除き、前後の文字は残す 26ms
× 背景色（ST） を取り除き、前後の文字は残す 3ms
× カーソル色 を取り除き、前後の文字は残す 2ms
× 出力の区切りをまたぐ列は次の出力まで持ち越して判定する 2ms
Tests  5 failed | 69 passed (74)
restored: cmp OK

### C14 切り離しを始めた後も打鍵を送る
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× Ctrl+B q の後は detach の応答を待つ間も打鍵を送らず、その間の切断も切り離しとして正常に終える 64ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > Ctrl+B q の後は detach の応答を待つ間も打鍵を送らず、その間の切断も切り離しとして正常に終える
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C15 切り離し中の切断を失敗にする
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× Ctrl+B q の後は detach の応答を待つ間も打鍵を送らず、その間の切断も切り離しとして正常に終える 61ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > Ctrl+B q の後は detach の応答を待つ間も打鍵を送らず、その間の切断も切り離しとして正常に終える
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C16 切り離し中の奪取を失敗にする
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 切り離しを始めた後に届いた taken は切り離しとして正常に終える 59ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 切り離しを始めた後に届いた taken は切り離しとして正常に終える
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C17 切り離し中の pane の終了を失敗にする
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× 切り離しを始めた後に届いた closed は切り離しとして正常に終える 61ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > 切り離しを始めた後に届いた closed は切り離しとして正常に終える
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C18 シグナルで切り離さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× SIGTERM・SIGHUP（onSignal）は切り離しと同じに扱う 5044ms
FAIL  src/commands/attach.test.ts > runPaneAttach（20260926-pane-direct-connect） > SIGTERM・SIGHUP（onSignal）は切り離しと同じに扱う
Tests  1 failed | 73 passed (74)
restored: cmp OK

### C19 SIGHUP に付けない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/commands/attach.ts を変異
exit=1
× onSignal は SIGTERM と SIGHUP に付け、解除で両方から外す 48ms
FAIL  src/commands/attach.test.ts > processTerminal（実物の process への配線） > onSignal は SIGTERM と SIGHUP に付け、解除で両方から外す
Tests  1 failed | 73 passed (74)
restored: cmp OK

### K1 Ctrl+B q で切り離さない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× Ctrl+B q で切り離す。それより前のバイトは送り、q より後ろは捨てる 56ms
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 26ms
× 手元の大きさで attach し、代替画面に入って SNAPSHOT と出力を書き、打鍵を送り、Ctrl+B q で detach して正常に返る（AC1・AC2・AC6・AC7） 5067ms
× 手元の大きさが変わると pane.attach_resize で追従する（AC3） 5004ms
Tests  11 failed | 63 passed (74)
restored: cmp OK

### K2 Ctrl+B Ctrl+B で Ctrl+B を 2 つ送る
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× Ctrl+B Ctrl+B は Ctrl+B を 1 つ送る 82ms
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 10ms
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > Ctrl+B Ctrl+B は Ctrl+B を 1 つ送る
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う
Tests  2 failed | 72 passed (74)
restored: cmp OK

### K3 Ctrl+B に続くその他のキーで Ctrl+B を落とす
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× Ctrl+B に続くそれ以外のバイトは両方を送る（Ctrl+B q 以外は切り離さない） 74ms
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 19ms
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > Ctrl+B に続くそれ以外のバイトは両方を送る（Ctrl+B q 以外は切り離さない）
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う
Tests  2 failed | 72 passed (74)
restored: cmp OK

### K4 読み取りの境界で接頭辞の保留を捨てる
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachKeys.ts を変異
exit=1
× 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う 91ms
FAIL  src/attachKeys.test.ts > AttachKeyFilter（切り離しキー。20260926-pane-direct-connect AC6） > 接頭辞と次のバイトが別の読み取りに分かれても同じに扱う
Tests  1 failed | 73 passed (74)
restored: cmp OK

# Q5 のテストを足した後の再実行
### Q5 中間文字を確かめない
$ (packages/cli) npx vitest run src/commands/attach.test.ts src/attachKeys.test.ts src/attachOutput.test.ts   # packages/cli/src/attachOutput.ts を変異
exit=1
× 中間文字つきの CSI（CSI 14 SP t） は残す 41ms
FAIL  src/attachOutput.test.ts > TerminalQueryFilter（出力から端末への問い合わせを取り除く。20260926-pane-direct-connect D8） > 中間文字つきの CSI（CSI 14 SP t） は残す
Tests  1 failed | 74 passed (75)
restored: cmp OK
```

### 起動確認（smoke）

```
$ aidev smoke
smoke: 20260926-pane-direct-connect
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:39508 (state dir /tmp/wtm-smoke-Jp12UO)
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/pane-direct-connect/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-xwtWa8, sandboxed HOME /tmp/wtmctl-smoke-home-QBjM4v
smoke(cli): server listening on http://127.0.0.1:39330
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): wtmctl agent send-keys ok (the RPC accepted the keys)
smoke(cli): wtmctl agent prompt ok (submitted; the shell printed the marker)
smoke(cli): wtmctl pane attach refuses a non-terminal (not_a_tty)
smoke(cli): wtmctl pane attach ok (in a real PTY: size 100x30, echo round trip, resize 90x25, Ctrl+B q exit 0, left the alternate screen)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: deleted session smoke (/tmp/tmp.aWFckPltWx/sessions/smoke)
smoke: pass (exit 0, 3 本)
```

### 未検証の穴（ラウンド 2 で更新）

- ラウンド 1 の「未検証の穴」はそのまま残る（Windows・macOS の端末・本物のエージェント・代替画面から出たときの見え方・ブラウザの画面）。
- シグナルは「残る」から「切り離しとして扱う」に変えた（SIGTERM・SIGHUP）。**実物のシグナルを送って確かめてはいない**
  （`process` のリスナーの付け外しと、偽の端末での切り離しの経路だけ）。SIGHUP で端末が既に無いときの書き込みの失敗を無視することも実物では確かめていない。
- 問い合わせの取り除きは、**本物の端末エミュレータ（xterm・kitty・Windows Terminal 等）が答えないこと**を実物で確かめていない（偽の端末に列が書かれないことだけ）。
  取り除く種類に無い問い合わせ（例: kitty graphics の `a=q`・XTWINOPS の一部）は手元の端末が答えうる。
- `RESTORE_SCREEN` の各列（カーソルの形・スクロール領域・ESC 7/8 での退避）の効果は実物の端末で確かめていない。
