# テスト結果: workspace の自動の名前と git の情報を、最初の pane のいまの場所に追従させる

## 実行したもの
- `pnpm -s test`（全パッケージの vitest）— 1 回目: 3044 passed / 1 failed（下の「失敗の証跡」）。直した後の 2 回目: 3045 passed / 0 failed / 0 skipped（161 ファイル）
- `pnpm -s typecheck` — exit 0
- `pnpm -s build` — exit 0
- `aidev smoke` — pass（2 本）
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 直した箇所を 32 通りに 1 つずつ壊すスクリプト（scratchpad の `mutate.py`）で、毎回元に戻して `cmp` で一致を確認
- E2E（playwright）は走らせていない（利用者の方針）。

## 受け入れ基準ごとの判定
- AC1: pass — `GitInfoPoller.test.ts`「最初の pane が別のリポジトリへ移ると…」（実物の git。名前と git が 1 回の `workspace.updated`）、`SessionService.test.ts`「最初の pane が別のリポジトリへ移ると…」。Linux 以外（OSC 7）は既存の `Pane.cwd` の仕組みに依るので未検証（下の穴）。
- AC2: pass — 「git の外へ移ると…」（GitInfoPoller・SessionService の両方）。
- AC3: pass — 「付けた名前は変えず、git だけ…」（両方）。
- AC4: pass — 「いまの場所は最初の tab の…」（SessionService）、「最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない」（GitInfoPoller）。
- AC5: pass — SessionService「最初の pane を閉じる・入れ替える・先頭の tab を並べ替えると…」、GitInfoPoller の AC5 の 4 件（閉じる・入れ替え・tab を閉じる・並べ替え）。`pane.closed`・`tab.closed` の購読そのものは見分けられない（decisions D7。M26・M27）。
- AC6: pass — 「見直しの間に場所が変わったら…」（両方）、「名前を空にして確定した待ちの間に場所が変わったら…」。
- AC7: pass — 「名前を空にして確定すると、開いた場所ではなく…」。
- AC8: pass — 「復元は、保存の最初の tab の先頭の pane の場所から…」（SessionService）、「復元した workspace は…git と名前を取る」（GitInfoPoller）、保存の tab の並び（composeServer 統合テスト）。
- AC9: pass — AC4 のテストで `Workspace.cwd` が変わらないこと（SessionService・GitInfoPoller）。開いた場所を読む既存の処理（新しい tab・worktree）には手を入れていない（差分）。
- AC10: pass — 変化は既存の `workspace.updated` で配る（GitInfoPoller の AC1 のテストがイベントを数える）。ブラウザでの表示は E2E を走らせていないので未検証。
- AC11: pass — 「場所が変わっていなければ名前を決め直さない」「名前を空にして確定した場所も記録し…」「復元…記録する」（fs の問い合わせを数える）、GitInfoPoller の AC4・AC11（git の問い合わせを数える）。
- AC12: pass — `docs/herdr-parity.md` の H01b・H20 を読んで requirements の「herdr との違い」と照合（T4 の点検で指摘 5 件を直した）。
- AC13: pass — `docs/verification.md` の説明・既知の制約・確かめ方を読んで照合。手動の確かめ方そのものは未実施（下の穴）。
- AC14: pass — 保存の項目は足していない（差分）。「復元は…（以前の版の保存でも）」が `autoLabel` の印の無い保存から戻す。
- AC15: pass — 「止まった fs のためにフォルダ名で代えた名前は…」「待つ前から詰まっていて…」「復元で上限を超えて…」「追従で degraded の名前を入れたら…」。待ち終える前に詰まりが解ける順序は単体で作れない（decisions D6）。

## 負の確認（生の出力。mutate.py が書いた mutation-raw.txt をそのまま）

M9（apply の自動の判定を消す）は生き残った——`followedLabel` が付けた名前で null を返し、待つ間に名前を付ければ世代が進むので、`applyWorkspaceIdentity` の `ws.autoLabel` の判定は二重の守り（同じ世代のまま自動でなくなる経路が無い）。M26・M27 は decisions D7 のとおり見分けられない。ほかの 29 個はすべて落ちた。M32 は統合テストを直した後に取り直した（2 つ目のブロック）。

```
=== M1 pollWorkspace を開いた場所に戻す
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
     × 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10） 5194ms
     × git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2） 5140ms
     × 付けた名前は変えず、git だけがいまの場所のものになる（AC3） 5117ms
       × pane.closed：最初の pane を閉じる 5085ms
       × layout.updated：入れ替える 5076ms
       × tab.closed：先頭の tab を閉じる 5063ms
       × workspace.updated：tab を並べ替える 5064ms
     × 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6） 5073ms
     × 復元した workspace は、保存の最初の pane の場所で git と名前を取る（AC8） 93ms
      Tests  9 failed | 14 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 9 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
restored: cmp ok
=== M2 identityCwdOf を開いた場所に戻す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × いまの場所は最初の tab の、画面の並びで先頭の pane の場所。ほかの pane・ほかの tab の場所では変わらず、開いた場所も変えない（AC4・AC9） 34ms
     × 最初の pane を閉じる・入れ替える・先頭の tab を並べ替えると、新しい最初の pane の場所になる（AC5） 15ms
     × 最初の pane が別のリポジトリへ移ると、その根の名前と git を 1 つの workspace.updated で入れて保存を予約する（AC1・AC2・AC10） 11ms
     × 場所が変わっていなければ名前を決め直さない（fs に問い合わせない。AC11） 9ms
     × 付けた名前は変えず、git だけ入れる（AC3） 11ms
     × 見直しの間に名前を付けたら、名前は捨てて付けた名前が勝つ（git は入れる。design D5） 9ms
     × 名前を空にして確定すると、開いた場所ではなく最初の pane のいまの場所の名前になる（AC7） 9ms
     × 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6） 8ms
     × 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5） 9ms
     × 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11） 9ms
     × 追従で degraded の名前を入れたら、決め直し済みと記録しない（AC15） 7ms
     × 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10） 5097ms
restored: cmp ok
=== M3 最初の pane ではなく焦点の pane
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × いまの場所は最初の tab の、画面の並びで先頭の pane の場所。ほかの pane・ほかの tab の場所では変わらず、開いた場所も変えない（AC4・AC9） 34ms
     × 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11） 185ms
       × pane.closed：最初の pane を閉じる 168ms
       × layout.updated：入れ替える 172ms
      Tests  4 failed | 134 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が代わると、新しい最初の pane の場所に追従する（AC5） > pane.closed：最初の pane を閉じる
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が代わると、新しい最初の pane の場所に追従する（AC5） > layout.updated：入れ替える
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > いまの場所は最初の tab の、画面の並びで先頭の pane の場所。ほかの pane・ほかの tab の場所では変わらず、開いた場所も変えない（AC4・AC9）
restored: cmp ok
=== M4 最初の tab ではなく表示中の tab
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × いまの場所は最初の tab の、画面の並びで先頭の pane の場所。ほかの pane・ほかの tab の場所では変わらず、開いた場所も変えない（AC4・AC9） 36ms
     × 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11） 202ms
      Tests  2 failed | 136 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > いまの場所は最初の tab の、画面の並びで先頭の pane の場所。ほかの pane・ほかの tab の場所では変わらず、開いた場所も変えない（AC4・AC9）
restored: cmp ok
=== M5 followedLabel の決め済みの早期リターンを消す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 場所が変わっていなければ名前を決め直さない（fs に問い合わせない。AC11） 25ms
     × 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14） 14ms
     × 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11） 7ms
      Tests  3 failed | 135 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 場所が変わっていなければ名前を決め直さない（fs に問い合わせない。AC11）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11）
restored: cmp ok
=== M6 followedLabel の付けた名前の早期リターンを消す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 付けた名前は変えず、git だけ入れる（AC3） 19ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 付けた名前は変えず、git だけ入れる（AC3）
restored: cmp ok
=== M7 apply の古い場所の判定を消す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 見直しの間に場所が変わったら、名前も git も捨てる（AC6） 26ms
     × 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6） 346ms
      Tests  2 failed | 136 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 見直しの間に場所が変わったら、名前も git も捨てる（AC6）
restored: cmp ok
=== M8 apply の世代の判定を消す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 見直しの間に名前を付けたら、名前は捨てて付けた名前が勝つ（git は入れる。design D5） 27ms
     × 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5） 8ms
      Tests  2 failed | 136 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 見直しの間に名前を付けたら、名前は捨てて付けた名前が勝つ（git は入れる。design D5）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5）
restored: cmp ok
=== M9 apply の自動の判定を消す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=0)
      Tests  138 passed (138)
restored: cmp ok
=== M10 apply で degraded でも記録する
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 追従で degraded の名前を入れたら、決め直し済みと記録しない（AC15） 24ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 追従で degraded の名前を入れたら、決め直し済みと記録しない（AC15）
restored: cmp ok
=== M11 followedLabel の世代を待った後で取る
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5） 27ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5）
restored: cmp ok
=== M12 名前変更を開いた場所から決める
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 見直しの間に名前を付けたら、名前は捨てて付けた名前が勝つ（git は入れる。design D5） 31ms
     × 名前を空にして確定すると、開いた場所ではなく最初の pane のいまの場所の名前になる（AC7） 8ms
     × 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6） 9ms
     × 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5） 9ms
     × 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11） 7ms
      Tests  5 failed | 133 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 見直しの間に名前を付けたら、名前は捨てて付けた名前が勝つ（git は入れる。design D5）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定すると、開いた場所ではなく最初の pane のいまの場所の名前になる（AC7）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 世代は待つ前に取る：見直しの待ちの間に名前を付けて自動に戻したら、見直しの名前は捨てる（design D5）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11）
restored: cmp ok
=== M13 名前変更の待ちの間の場所の変化を見ない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6） 28ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6）
restored: cmp ok
=== M14 名前変更の決め直しの上限で古い名前を入れる
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6） 28ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定した待ちの間に場所が変わったら、新しい場所で決め直す。決まらなければ名前は入れず自動の印だけ立てる（AC6）
restored: cmp ok
=== M15 名前変更で場所を記録しない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11） 23ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 名前を空にして確定した場所も記録し、同じ場所では決め直さない（AC11）
restored: cmp ok
=== M16 復元を開いた場所から決める
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14） 37ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14）
restored: cmp ok
=== M17 復元の最初の pane を配列の先頭にする
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14） 32ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14）
restored: cmp ok
=== M18 復元で degraded でも記録する
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 復元で上限を超えてフォルダ名にした名前は、決め直し済みと記録しない（AC15） 53ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 復元で上限を超えてフォルダ名にした名前は、決め直し済みと記録しない（AC15）
restored: cmp ok
=== M19 復元で場所を記録しない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14） 29ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 復元は、保存の最初の tab の先頭の pane の場所から名前を決める（以前の版の保存でも。AC8・AC14）
restored: cmp ok
=== M20 作成で場所を記録しない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 場所が変わっていなければ名前を決め直さない（fs に問い合わせない。AC11） 21ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 場所が変わっていなければ名前を決め直さない（fs に問い合わせない。AC11）
restored: cmp ok
=== M21 待つ前の詰まりを degraded にしない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 待つ前から詰まっていてフォルダ名にした名前も、決め直し済みと記録しない（AC15） 62ms
      Tests  1 failed | 137 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 待つ前から詰まっていてフォルダ名にした名前も、決め直し済みと記録しない（AC15）
restored: cmp ok
=== M22 待つ間の上限超えを degraded にしない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 止まった fs のためにフォルダ名で代えた名前は、決め直し済みと記録しない（次の見直しで決め直す。AC15） 51ms
     × 復元で上限を超えてフォルダ名にした名前は、決め直し済みと記録しない（AC15） 40ms
     × 待つ間に上限を超え、返る前に詰まりが解けても、代えたフォルダ名は degraded（待ち終えた時点の詰まりでは決めない。AC15） 39ms
      Tests  3 failed | 135 passed (138)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 止まった fs のためにフォルダ名で代えた名前は、決め直し済みと記録しない（次の見直しで決め直す。AC15）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 復元で上限を超えてフォルダ名にした名前は、決め直し済みと記録しない（AC15）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 待つ間に上限を超え、返る前に詰まりが解けても、代えたフォルダ名は degraded（待ち終えた時点の詰まりでは決めない。AC15）
restored: cmp ok
=== M23 購読から pane.updated を外す
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
     × 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10） 5077ms
     × git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2） 5062ms
     × 付けた名前は変えず、git だけがいまの場所のものになる（AC3） 5059ms
     × 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6） 5061ms
      Tests  4 failed | 19 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 付けた名前は変えず、git だけがいまの場所のものになる（AC3）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6）
restored: cmp ok
=== M24 購読から layout.updated を外す
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
       × layout.updated：入れ替える 5079ms
      Tests  1 failed | 22 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が代わると、新しい最初の pane の場所に追従する（AC5） > layout.updated：入れ替える
restored: cmp ok
=== M25 購読から workspace.updated を外す
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
       × workspace.updated：tab を並べ替える 5104ms
      Tests  1 failed | 22 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が代わると、新しい最初の pane の場所に追従する（AC5） > workspace.updated：tab を並べ替える
restored: cmp ok
=== M26 購読から pane.closed を外す（D7：捕まえられない見込み）
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=0)
      Tests  23 passed (23)
restored: cmp ok
=== M27 購読から tab.closed を外す（D7：捕まえられない見込み）
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=0)
      Tests  23 passed (23)
restored: cmp ok
=== M28 followMoves の比較を消す（毎回見直す）
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
     × 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11） 273ms
     × stop の後は場所が変わっても見直さない 258ms
      Tests  2 failed | 21 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > stop の後は場所が変わっても見直さない
restored: cmp ok
=== M29 polledCwd を待つ前に入れない
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
     × 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10） 5203ms
     × git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2） 5213ms
     × 付けた名前は変えず、git だけがいまの場所のものになる（AC3） 5195ms
       × pane.closed：最初の pane を閉じる 5144ms
       × layout.updated：入れ替える 5097ms
       × tab.closed：先頭の tab を閉じる 5212ms
       × workspace.updated：tab を並べ替える 5351ms
     × 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6） 5410ms
      Tests  8 failed | 15 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2）
restored: cmp ok
=== M30 stop で購読を外さない
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
     × stop の後は場所が変わっても見直さない 774ms
      Tests  1 failed | 22 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > stop の後は場所が変わっても見直さない
restored: cmp ok
=== M31 名前を決めずに git だけ
$ npx vitest run src/git/GitInfoPoller.test.ts   (exit=1)
     × 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10） 5852ms
     × git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2） 5679ms
       × pane.closed：最初の pane を閉じる 5149ms
       × layout.updated：入れ替える 5177ms
       × tab.closed：先頭の tab を閉じる 5133ms
       × workspace.updated：tab を並べ替える 5124ms
     × 見直しの間に場所が変わったら、古い場所の結果で上書きしない（AC6） 5114ms
      Tests  7 failed | 16 passed (23)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が別のリポジトリへ移ると、名前と git が 1 つの workspace.updated でそのリポジトリのものになる（AC1・AC10）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > git の外へ移ると、名前がフォルダ名になり git の情報が消える（AC2）
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane が代わると、新しい最初の pane の場所に追従する（AC5） > pane.closed：最初の pane を閉じる
restored: cmp ok
=== M32 保存の tab を作った順に戻す
$ npx vitest run src/composeServer.integration.test.ts   (exit=1)
     × 保存した session.json の tab は並べ替えた順（workspace の tabIds の順） 1139ms
      Tests  1 failed | 20 passed (21)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/composeServer.integration.test.ts > composeServer (integration) > 保存した session.json の tab は並べ替えた順（workspace の tabIds の順）
restored: cmp ok
```

```
=== M32 保存の tab を作った順に戻す
$ npx vitest run src/composeServer.integration.test.ts   (exit=1)
     × 保存した session.json の tab は並べ替えた順（workspace の tabIds の順） 1108ms
      Tests  1 failed | 20 passed (21)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/composeServer.integration.test.ts > composeServer (integration) > 保存した session.json の tab は並べ替えた順（workspace の tabIds の順）
restored: cmp ok
```

## 失敗の証跡

1 回目の `pnpm -s test`（一式を並べて走らせる負荷の下）で、足した統合テストが落ちた。単独で 3 回走らせると通った（`npx vitest run src/composeServer.integration.test.ts` 21 passed ×3）。既定のシェルが猶予の間に終わり tab ごと閉じたと見て、テストを「待つだけのシェル」で起動する形に直し、一式を取り直して 3045 passed。

```
$ pnpm -s test
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 保存した session.json の tab は並べ替えた順（workspace の tabIds の順）
AssertionError: expected [ 't2' ] to deeply equal [ 't3', 't2' ]

- Expected
+ Received

  [
-   "t3",
    "t2",
  ]

 ❯ src/composeServer.integration.test.ts:363:88
    361|     await server.persist.flush();
    362|     const saved = JSON.parse(await readFile(join(stateDir, "session.js…
    363|     expect(saved.workspaces.find((w) => w.id === workspace.id)!.tabs.m…
       |                                                                                        ^
    364|   }, 10000);
    365|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 160 passed (161)
      Tests  1 failed | 3044 passed (3045)
   Start at  12:00:33
   Duration  73.51s (tests 42%, environment 32%, transform 13%, import 12%, worker 1%)

Environment  |@wtm/web| happy-dom was created 90 times · 205.90s total, 44% of tracked time
```

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260926-workspace-label-follow-cwd
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38782 (state dir /tmp/wtm-smoke-LXJsgz)
{"ts":"2026-09-26T03:07:05.244Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/workspace-label-follow-cwd/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-k3mAV3, sandboxed HOME /tmp/wtmctl-smoke-home-Ri1GJe
{"ts":"2026-09-26T03:07:09.558Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:37834
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## 未検証の穴（skip / 環境不足）
- E2E（`workspace-auto-label.spec.ts` の前提を直した 1 本目を含む）は走らせていない（利用者の方針）。ブラウザのサイドバーでの見え方（AC1・AC10）は単体（サーバのイベント）までで、描画は未確認。
- macOS・Windows ネイティブ（OSC 7 で知らせるシェル）での追従は未検証。既存の `Pane.cwd` の仕組み（20260921-new-terminal-cwd）に依る。
- `docs/verification.md` に足した手動の確かめ方は未実施。
- decisions D6（待ち終える前に詰まりが解ける順序・reject の経路）・D7（`pane.closed`・`tab.closed` の購読）はテストで捕まえられず、読解で確かめた。

## ラウンド 2（review ラウンド 1 の差し戻し後。T6・T7）

### 実行したもの
- `pnpm -s test` — 3050 passed / 0 failed / 0 skipped（161 ファイル）
- `pnpm -s typecheck` — exit 0
- `aidev smoke`（`pnpm -s build` を含む）— pass（2 本）

### 受け入れ基準の追加の判定
- AC9（改めた内容）: pass — worktree の一覧・作成がいまの場所のリポジトリで行われ（`WorktreeService.test.ts`「list・create は workspace のいまの場所…」）、
  いまの場所が消えていれば開いた場所で行う（「いまの場所が消えていれば…」）。開いた場所そのもの（`Workspace.cwd`）は変えない（ラウンド 1 のテスト）。
- AC11（追加）: pass — リンクを含む論理パスと監視の実パスが同じディレクトリなら名前を決め直さない・fs をたどらない
  （「開いた場所（リンクを含む論理パス）と監視が入れた実パスが…」）。解決できない・詰まっている間の扱いも（2 本）。

### 負の確認（生の出力）

```
=== M33 worktree を開いた場所に戻す
$ npx vitest run src/git/WorktreeService.test.ts   (exit=1)
     × list・create は workspace のいまの場所（identityCwdOf）のリポジトリで行う（開いた場所ではない） 405ms
      Tests  1 failed | 38 passed (39)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/WorktreeService.test.ts > DefaultWorktreeService（本物の git を使う。既存の GitInfoPoller.test.ts と同じ流儀） > list・create は workspace のいまの場所（identityCwdOf）のリポジトリで行う（開いた場所ではない）
restored: cmp ok
=== M36 worktree の消えた場所の代わりを消す
$ npx vitest run src/git/WorktreeService.test.ts   (exit=1)
     × いまの場所が消えていれば、開いた場所のリポジトリで行う 343ms
      Tests  1 failed | 38 passed (39)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/WorktreeService.test.ts > DefaultWorktreeService（本物の git を使う。既存の GitInfoPoller.test.ts と同じ流儀） > いまの場所が消えていれば、開いた場所のリポジトリで行う
restored: cmp ok
=== M37 解決できないときも同じとみなす
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × リンクを解決できない場所どうしは同じとみなさず、決め直す 161ms
     × fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える 44ms
      Tests  2 failed | 139 passed (141)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > リンクを解決できない場所どうしは同じとみなさず、決め直す
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える
restored: cmp ok
=== M38 詰まっている間も解決しに行く
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える 177ms
      Tests  1 failed | 140 passed (141)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える
restored: cmp ok
=== M39 解決の上限超えを数えない
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える 106ms
     × stop の後は場所が変わっても見直さない 712ms
      Tests  2 failed | 139 passed (141)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > stop の後は場所が変わっても見直さない
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える
restored: cmp ok
=== M34 同じディレクトリの判定を消す
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 開いた場所（リンクを含む論理パス）と監視が入れた実パスが同じディレクトリなら、名前を決め直さない 139ms
     × fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える 20ms
     × 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11） 823ms
      Tests  3 failed | 138 passed (141)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/git/GitInfoPoller.test.ts > DefaultGitInfoPoller — 最初の pane のいまの場所への追従 > 最初の pane 以外の場所の変化・場所の変わらないイベントでは git に問い合わせない（AC4・AC11）
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 開いた場所（リンクを含む論理パス）と監視が入れた実パスが同じディレクトリなら、名前を決め直さない
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > fs が詰まっている間はリンクを解決しに行かない。解決が上限を超えたら詰まりとして数える
restored: cmp ok
=== M35 同じディレクトリを文字列で比べる
$ npx vitest run src/session/SessionService.test.ts src/git/GitInfoPoller.test.ts   (exit=1)
     × 開いた場所（リンクを含む論理パス）と監視が入れた実パスが同じディレクトリなら、名前を決め直さない 83ms
      Tests  1 failed | 140 passed (141)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/session/SessionService.test.ts > SessionService — 最初の pane のいまの場所（名前の追従） > 開いた場所（リンクを含む論理パス）と監視が入れた実パスが同じディレクトリなら、名前を決め直さない
restored: cmp ok
```

### 失敗の証跡
このラウンドでは失敗が発生していない。

### 起動確認（smoke）

```
$ aidev smoke
smoke: 20260926-workspace-label-follow-cwd
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:39490 (state dir /tmp/wtm-smoke-IXWISF)
{"ts":"2026-09-26T03:27:13.419Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/workspace-label-follow-cwd/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-H6uTWv, sandboxed HOME /tmp/wtmctl-smoke-home-fjk9VS
{"ts":"2026-09-26T03:27:19.663Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:38080
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```
