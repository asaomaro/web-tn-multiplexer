# レビュー: エージェントの「入力待ち」「完了」を、画面を見ていなくても知らせる

## タスク点検ログ（coding 工程内・「3.3」(b)）

22 タスク（T1〜T22）を点検した（`mode: autonomous` は全タスク必須）。T23 は自前の差分を持たない
（test 工程で消化）ので対象外。**委譲は 6 本にまとめた**（純粋関数／ストアと既存部品／配送の実装／
制御／UI と結線／E2E）。指摘は計 **28 件**（must 3 / should 14 / nit 11）。

### 実装の指摘

- [must][conv:-] `packages/web/src/components/NotificationSettingsDialog.vue` **許可の状態が
  最初に評価したときの値で固まっていた**。`Notification.permission` は reactive ではないので
  `computed` から呼ぶと更新されず、**許可を取っても行が「切」のまま、もう一度押しても切に戻せない**
  （AC8・AC-I2 が成立しない）/ 対応: 修正済（`ref` に持ち、「開いたとき」と「許可を求めた後」に読み直す）
- [must][conv:-] `packages/web/src/notify/NotificationController.ts` **OS 通知のクリックが、
  ダイアログを開いたまま表示と焦点を動かしていた**。この製品には「ダイアログ中は `focusedPaneId` を
  直接動かさず、閉じたときに戻す先だけ差し替える」既存の規則（D97）があり、`prefix+o` は
  `main.ts` の window keydown が遮断するが、**OS 通知のクリックは外から来る非同期の経路なので
  守りが効かない**。素通しすると、閉じたときに焦点が開く前の pane へ戻され、
  **表示中の tab に含まれない pane が焦点のまま**残る / 対応: 修正済（`applyViewRepair` と同じ形に）
- [must][conv:-] `packages/web/src/notify/NotificationController.ts` **許可を確かめずに OS 通知を出していた**。
  拒否されている状態で `show()` が `false` を返すと、それを「この環境では原理的に出せない」
  （Android Chrome の合図）と取り違えて **`desktopUsable` を恒久的に落とし**、設定が AC8 ではなく
  AC12 を表示し、以後そのページでは再許可しても出なくなる / 対応: 修正済（許可の門を足した）
- [should][conv:-] `packages/web/src/notify/policy.ts` **スナップショットから誤った鍵を作れた**。
  鍵の形だけでは「本当にその状態か」が分からず（`completionSeq` が 0 でも `done` の鍵は作れる、
  `since` は状態を問わず常にある）、**切断中に現れただけのエージェントに「完了しました」「入力待ちです」**
  と言いうる。イベント経路には `prev` との比較という守りがあるが、スナップショットには無かった /
  対応: 修正済（`snapshotKeys` という述語を置いた）
- [should][conv:-] `packages/web/src/notify/NotificationController.ts` **再接続で消えた pane が掃除されない**。
  `pane.closed` は接続中にしか届かず、スナップショットは差分ではなく丸ごとの置き換えなので、
  **切断中に閉じられた pane の鍵が永久に残り、待ち行列の枠を占め、OS 通知も閉じられない** /
  対応: 修正済（スナップショット適用時に、載っていない pane を掃除する）
- [should][conv:-] `packages/web/src/notify/DesktopNotifier.ts` **古い通知の close が新しい登録を消していた**。
  同じ pane で出し直すと、以後 `closeByTag` が何もしなくなり OS 通知が残り続ける /
  対応: 修正済（消すのは「いま登録されているのが自分自身のとき」だけ）
- [should][conv:-] `packages/web/src/store/notifications.ts` 判定済みの掃除を件数の上限（LRU）にすると、
  **長く入力待ちのままの鍵ほど古い側に落ちて押し出され、再接続で再通知される** /
  対応: 設計段階で pane の寿命に変更済（この点検では確認のみ）
- [should][conv:-] `packages/web/src/components/NotificationSettingsDialog.vue` `inject` に有無の検査が無く、
  **結線を落としても壊れずに「この環境では使えません」という嘘の理由**を出していた /
  対応: 修正済（`ConfirmDialog` と同じく throw）
- [nit][conv:-] `packages/web/src/actions/ActionDispatcher.ts` 到達しない分岐・`Toast.vue` に design に無い
  `max-width`・`main.ts` の使わないオプション / 対応: すべて修正済
- [nit][conv:-] `packages/web/src/notify/describe.ts` **pane の呼び名の連鎖が 3 箇所に複製されていた**
  （`describe.ts`・`GotoPicker.vue`・`PaneFrame.vue`）。候補を 1 つ足す／順を変える改修で
  **どれか 1 つだけが黙ってずれる** / 対応: 修正済（1 本にまとめ、既定値だけ呼ぶ側が決める形に）

### テストの指摘（いずれも「緑だが何も守っていない」類）

- [should][conv:regression-negative-control!] `packages/web/src/notify/NotificationController.test.ts`
  **「判定済みへ入れるのは遅延を仕掛けた時点」を守っていなかった**。300ms 地点で再接続する形だったので、
  守っていたのは `#pending` の番人で、**本当の穴（タイマ発火後・配送前）は再現されていなかった** /
  対応: 修正済（2 本目のタイマも発火させる形に。壊すと落ちることを確認）
- [should][conv:regression-negative-control!] 同上 **「`await nextTick()` の後に読む」を守っていなかった**。
  どのテストも表示の状態をティックの前後で変えていなかった / 対応: 修正済
  （遅延を挟まない完了で、呼んだ直後に表示を落とす形に。壊すと落ちる）
- [should][conv:regression-negative-control!] 同上 **「案内の契機は判定した時点」を守っていなかった**。
  案内のテストが表の (b) でしか発火させておらず、**(c)（見ている pane）と「揺れて配送されなかった」**
  が無かった / 対応: 修正済
- [must][conv:e2e-observe-browser] `packages/e2e/src/specs/notifications.spec.ts`
  **「見ている pane では何も出ない」が、表の判定を丸ごと潰しても通っていた**。
  配送は検知の 1 秒後なのに、**状態が届いた直後に `toHaveCount(0)` を測っていた**——
  否定の主張を、それが偽になりうる時点より前に測っていた / 対応: 修正済
  （別 tab の pane の知らせが出たこと＝肯定の合図を待ってから測る。壊すと落ちる）
- [must][conv:e2e-observe-browser!] 同上 **「その pane へ移った」の判定が、テスト自身の WS クライアントの
  `session.focus_changed` だけだった**（コメントには「ブラウザ側で確かめる」と書いてあるのに）。
  **`setView` を落としても 2 本とも通る**——先行 work で指摘された「`setView` と `focusPane` を対で呼ぶ
  規則の欠落」と同じ壊れ方を素通しする / 対応: 修正済（tab バーの選択状態を見る。壊すと落ちる）
- [should][conv:e2e-observe-browser!] 同上 **利用者の状態を整えるのが 1〜1.5 秒の競走になっていた**
  （検知の後に「フォーカスを外す」「別 tab へ移る」を仕込んでいた）/ 対応: 修正済
  （偽エージェントが入力待ちになる時点を**ファイルの出現で制御**し、窓そのものを無くした）
- [should][conv:-] `packages/web/src/notify/*.test.ts` **偽物が実物とずれていて穴を隠していた**——
  `Notification.close()` が close イベントを起こさない・`AudioContext.resume()` が同期・
  `Notification.permission` が常に同じ値を返す。**実物に寄せたら、隠れていた不具合が 2 つ出た** /
  対応: すべて修正済（偽物を実物に合わせ、それぞれの穴を突くテストを追加）
- [should][conv:-] テストの factory が `as AgentInfo` 等で型を押し込み、必須フィールドを落としていた
  （protocol に項目が増えても型で気づけない）/ 対応: 修正済（キャストを外した）

### タスクをまたぐ点検（手順 5.5 の `cross`）

**指摘 4 件（must 1 / should 2 / nit 1）**。内容は上の must 2 件目・should 2 件目・nit の呼び名、
および下記。いずれも 1 タスクの差分には現れない。

- [should][conv:-] **「利用者がその出来事を見た」の判定が 2 つに分かれ、片方が他方を打ち消す**——
  この work は表の (b)（フォーカス有り・pane 非表示）で知らせると決めたが、
  `main.ts` の `markVisibleAgentsSeen` は**フォーカスがあれば全 pane を既読にする**ので、
  同じ完了について**トーストは「完了しました」と言うのにサイドバーに `done` の印が無い**状態になる。
  正しい規則である `shouldMarkSeen(paneVisible, windowFocused)` は**本番から 1 箇所も呼ばれていない**。
  **この work が `TerminalRegistry.isVisible` を足したことで、結線できる前提が揃った** /
  対応: **直さない**——requirements が「既読の意味論の変更はこの work では扱わない」と明示的に
  対象外にしている（直すと `done` の表示条件が変わりサイドバーの見え方に波及する）。
  **backlog へ送る**（`isVisible` が揃ったという新しい事実つきで）

### 負の対照の記録（条項 `regression-negative-control`）

タスク点検と cross の修正のうち **12 件**について、**直したあとに壊して落ちることを確かめた**。
生の出力は `test-result.md`。壊したファイルはすべて `cmp` で復元を確認済み。

**1 度目の壊し方が足りず「落ちない」と誤判定しかけた例が 2 件**ある（`recordedPath` の try/catch が
`RpcError` を飲んでいた／再接続のテストで 2 本目のタイマを発火させていなかった）。
**「壊したのに落ちない」を「守られている」と読み違えない**ために、壊し方が効いているかまで確かめた。

## ラウンド 1

**指摘 6 件（must 0 / should 3 / nit 3）**。点検で潰した分（タスク点検 28・cross 4）は再掲していない。

- [should][conv:-] `packages/web/src/notify/NotificationController.ts:224-233`
  **AC11 の後半「先頭の pane が既に無ければ**その旨を出して**次の件へ進む」を満たしていない**。
  文言は**全件が到達不能だったときにしか出さない**ので、後ろに到達できる件があると
  「`prefix+o` を 1 回押しただけでトーストが 2 枚消えて別の pane に着いた」ように見える。
  decisions D1 は herdr との差しか書いておらず、**AC11 との差は記録されていない**
  （`test-result.md` は AC11 を pass と判定していた）/ 対応: 修正済（捨てた件があれば必ず 1 回出す）
- [should][conv:-] `packages/web/src/notify/NotificationController.ts:186-188`
  **`SoundResult` の `"unsupported"` がどこにも出ない**。`soundBlocked = r === "blocked"` が
  `"unsupported"` を `false` に畳むので、**音の行は「入」のまま注記も `disabled` も出ず、
  永久に鳴らない設定を利用者が「入」だと思い続ける**。design の異常系の表は
  「`AudioContext` が作れない → 音の行を `disabled`」と定めており、**この 1 行だけ実装されていなかった** /
  対応: 修正済（`soundUsable` を足し、設定で `disabled` ＋ 理由を出す）
- [should][conv:-] `packages/web/src/notify/NotificationController.ts:161`・`components/Toast.vue:63`
  **【価値適合 US4】既定のままでは、知らせから対象へ移る手段が `prefix+o` しかない**
  （OS 通知は既定「切」で許可も要る）。しかも知らせのトーストは**本体クリックが「消す」**なので、
  **「知らせをクリックする」という最も自然な操作が、対象へ行くどころか行き先ごと捨てる**。
  マウス／タッチ主体の利用者（モバイルはサイドバーも無い）には US4 が既定で成立しない /
  対応: 修正済（知らせのトーストに［移動］のボタンを足した）
- [nit][conv:-] `packages/web/src/actions/ActionDispatcher.ts:22` `notifications` が省略可で、
  **結線を落とすと `prefix+o` が完全に無反応**になる（requirements は「キーを押したのに無反応を作らない」と
  書いている）。同種の問題は `NotificationSettingsDialog` の `inject` で must として throw に倒したのに、
  ここは逆の扱いだった / 対応: 修正済（必須にして、落とすと**型で落ちる**ようにした）
- [nit][conv:-] `packages/web/src/notify/NotificationController.ts:31`
  **【価値適合 US8】案内の文言が、設定がどこにあるかを言わない**。［あとで］を押すと二度と出ないので、
  後から通知を入れたくなった利用者に手掛かりが残らない / 対応: 修正済（入口を文言に添えた）
- [nit][conv:-] `packages/web/src/notify/describe.ts:44` 呼び名の連鎖を 1 本にまとめたのは良いが、
  **置き場が `notify/`** なので、通知と無関係な `GotoPicker` と `PaneFrame` が通知モジュールに依存する
  向きになった / 対応: 修正済（`store/paneName.ts` へ移した）

## ラウンド 2

**指摘 4 件（must 0 / should 1 / nit 3）**。ラウンド1 の 6 件は**すべて直っていると判定**された。
**nit のみではないので直したうえで**、全パッケージの単体・通知の E2E・smoke を取り直した。

- [should][conv:-] `packages/web/src/components/Toast.vue:101-105`
  **`text-overflow: ellipsis` が効いていなかった**。幅を縛るものがどこにも無く、
  **flex の子は min-content（`nowrap` の全文幅）より縮まない**ので、長い呼び名
  （`paneNameOf` の 3 番目の候補は端末のタイトル＝コマンド行がそのまま入る）でトーストが横へ伸び、
  **後ろに並ぶ［移動］と［×］が視界の外へ出る**。**D9（マウス／タッチの利用者に移動する手段を与える）の
  目的を直撃する** / 対応: 修正済（`max-width` と `min-width: 0` を足した）。
  **直接の原因は、タスク点検の nit で `max-width` を「design に無い」として外したこと**——
  外したものが実は効いていた。**CSS の効き目は単体では確かめられない**ので、
  **実ブラウザで［移動］が視界に入るかを見る E2E を足した**（外すと `viewport ratio 0` で落ちる）
- [nit][conv:-] `packages/web/src/notify/NotificationController.ts` `moved` が**死んだ変数**で、
  `void moved;` が lint を黙らせるためだけに置かれていた（D8 の編集の残骸）/ 対応: 修正済（削除）
- [nit][conv:-] `GotoPicker.vue` / `PaneFrame.vue` / `describe.ts` / `paneName.test.ts`
  **`paneNameOf` を移したのに、コメントが旧位置を指したまま**だった。
  **「候補を足すとどれか 1 つだけが黙ってずれる」を無くすための移動なのに、案内の側が同じずれ方をしていた** /
  対応: 修正済（4 箇所）
- [nit][conv:-] `design.md:401-403` が D8 以前の規則のままで、**同じ状況の文言が実装内で 2 つに割れていた**
  （`prefix+o` は「閉じられていました」、［移動］は「閉じられています」）。
  **D9 で［移動］が `focusNotification` を呼ぶようになったため、まったく同じ状況で押した場所によって
  文言が変わる**状態だった / 対応: 修正済（定数に 1 本化。design は D8 が上書きする旨を記録）

## 判定

ラウンド 2 の 4 件を直した。**must は 1 件も残っていない**。
被覆は `aidev coverage` が gaps=0（design 22/22・tasks 22/22。tasks 承認時から変化なし）。
