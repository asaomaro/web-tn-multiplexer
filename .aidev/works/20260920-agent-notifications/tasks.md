# タスク: エージェントの「入力待ち」「完了」を、画面を見ていなくても知らせる

## 実装方針

**下から積む**——純粋関数 → port の型 → ストア → 制御 → UI → キー → E2E。
逆にすると、上の層が未定義の型を参照して途中で typecheck が通らない状態が続く。

**純粋関数を先に切り出す**（規則の置き場）。`routesFor`（利用者の状態 → どの経路）・
待ち行列の操作・`describeTarget`（呼び名）は **`notify/` に純粋関数として置き**、
ブラウザ API に一切触れない。規則を先に固めると、`NotificationController` の単体テストが
「遅延と結線」だけに集中できる。

**ブラウザ API は port の裏だけ**。`Notification` と `AudioContext` に触るのは
`DesktopNotifier.ts` と `ToneSound.ts` の 2 ファイルに限る。ここが守られていれば、
`NotificationController` は差し替えた port で完全に単体テストできる。

**decisions.md D6 の申し送りに従い、design の 2 巡目の修正が集中した 4 箇所を別々のタスクに割る**
——**判定済みの寿命（T10）・待ち行列の出入り（T14）・案内の重複抑止（T15）・呼び名の組み立て（T1）**。
まとめると、タスク単位の独立点検でこの 4 つを個別に見られなくなる。

## 作業順序と依存関係

順序は `依存:` に全て落としてある。理由だけ書く。

- **T1〜T4（純粋関数と port の型）が終わるまで、ストアも制御も書けない**。型が無いため。
- **T5（prefs の併合）と T6（`Toast` 型・`DialogContext`）は `store/view.ts` の同じファイル**なので
  **必ず直列**（並行させない）。
- **T9（`StoreAdapter` の注入口）は T13 の前**。`NotificationController` が受け取る形が決まらない。
- **T13 と T14 は同じ `NotificationController.ts`** なので直列。ただし
  **点検は別々にかける**（D6）——T13 は「検知・判定・遅延」、T14 は「待ち行列の出入り」。
- **順序は T16（部品）→ T17（結線と設置）→ T18（動作）→ T19（入口）**。この順でないと、
  **入口だけ先に生きて中身が無い**時期ができる:
  - 設置（`App.vue`）が入口より後だと、`prefix+s` を押した時点で `openDialog` が立って
    `keys.setMode("dialog")` になり、**何も描かれないままキーが効かなくなる**
    （`main.ts:160-163` `:171-172`。再読み込みするまで戻らない）。
  - `ActionDispatcher` の case が keymap の差し替えより後だと、
    **`prefix+s` が黙って何もしない**時期ができる（`switch` に `default` も網羅性検査も無い）。
- **T20（落ちる既存テスト 3 件）は T19 の後**。先に落ちることを確かめる必要がある。
- **T22（E2E）は最後**。UI と結線が揃わないと書けない。

## リスク / 留意点

- **`judged` に入れるのは「遅延を仕掛けた時点」**（design 振る舞い 2）。**発火を待ってから入れると、
  その 1 秒の間に再接続のスナップショットが来て二重に配送される**。T13 で必ず守る。
- **`judged` の掃除は件数の上限ではなく pane の寿命**（`onPaneClosed`）。件数の LRU にすると、
  **長く `blocked` のままの鍵が押し出されて再通知される**。T10 で必ず守る。
- **待ち行列に入る条件は「(c) 見ている ではないとき」で、トーストの入／切とは独立**
  （decisions D4）。`routes.toast` で条件にすると、**トースト切・OS 通知入の利用者で
  `prefix+o` が効かなくなる**。T14 で必ず守る。
- **`closeByTag` は `drop` と watch の両方から呼ぶ**。`drop` だけにすると
  **利用者がトーストを消しても OS 通知が残る**。T14。
- **OS 通知のクリックは「その 1 件」を消費する**（先頭ではない）。`tag = pane id` で
  複数同時に出るので、先頭を消費すると別の pane へ飛ぶ。T14。
- **`AgentInfo.label` は種類名**（「Claude Code」）。pane を特定できないので
  `pane.label || pane.agent?.label || pane.title || …` の連鎖を使う（`GotoPicker.vue:78`）。T1。
- **利用者の状態を読むのは `await nextTick()` の後**。`visible` は `TerminalPane` の
  mount/unmount に連動し、そのフックは Vue のパッチ後に走る。T13。
- **`Notification.requestPermission()` は利用者の操作からのみ**。起動経路から呼ばない。T11・T15・T16。
  **T11 が `request()` を実装し、T15（案内の［許可する］）と T16（`default` の切り替え）だけが呼ぶ**。
- **部品は `injection.ts` のキー＋`main.ts` の `app.provide` で渡す**（既存の流儀）。
  `ActionDispatcher` は `ActionDispatcherOptions`（`ActionDispatcher.ts:14-21`）で受け取る。
  **キーを足すのは T16（使う側と同じタスク）、`app.provide` は T17（結線）**。
- **`view.toast()` は第 2 引数を取るように変える**（`store/view.ts:223-227`）。
  型だけ足しても `sticky` を渡せない。T6。
- **`new Notification()` は Android Chrome で throw する**。`show()` を try/catch で包み `false` を返す。T11。
- **`prefix+s` / `prefix+o` を差し替えると既存テストが 3 件落ちる**
  （`KeyRouter.test.ts:135-138`・`HelpDialog.test.ts:39`・`ContextMenu.test.ts:182`）。T20 で直す。
- **`ContextMenu` の項目は「移動」と「切り離し」の間**（`ContextMenu.vue:89` のコメント）。T19。
- **E2E は 1 本ずつ**。**`pnpm build` を通してから走らせる**（先行 work の decisions D8）。

## テスト方針

design の「テストの置き方」に従う。要点:

- **純粋関数は単体で厚く**。特に `routesFor` は **requirements の表の 3 行 × 3 経路を総当たり**で固定する。
- **`NotificationController` は port を差し替えて単体**。遅延は `vi.useFakeTimers()`（既存に 19 件の先例）。
- **E2E は `page.addInitScript` で `window.Notification` と `AudioContext` を差し替え、
  呼ばれた事実を DOM に残して観測する**（条項 `e2e-observe-browser`。`performance.spec.ts:100-126` が雛形）。
  **観測の代替であることを spec のコメントに書く**（条項の要求）。
- **負の対照**（条項 `regression-negative-control`）: 新機能なので「実装前は要素が無い」では弱い。
  **実装後に壊して**落ちることを確かめる——**表の 1 行を潰す／鍵から `since` を外す／
  待ち行列の上限を外す／`first` の分岐を外す／`judged` を発火後に入れる**の 5 つ。
  **壊した後は必ず戻し、`cmp` で一致を確認する**。生の出力は `test-result.md` に貼る。
- 一式（全パッケージの単体 ＋ 既定の E2E）は **test 工程で 1 回通す（T23）**。

## タスク

- [x] T1: `notify/describe.ts` を作る（`describeTarget(session, paneId)`）＋単体テスト。
      **`AgentInfo.label` を先頭に置かない**（「Claude Code」等の**種類名**なので pane を特定できない）。
      `pane.label || pane.agent?.label || pane.title || \`pane ${paneId}\`` の連鎖
      （**末尾が `GotoPicker.vue:78` の `` `pane ${index + 1}` `` と違うのは意図的**——
      `describeTarget` は tab 内の順番を持たないため）。
      **pane / tab / workspace が引けないときの 3 つの落とし方**も固定する
      対象: `packages/web/src/notify/describe.ts`（新規）・`describe.test.ts`（新規） / 根拠: design 振る舞い 4「文言」
      依存: なし
      AC: AC2
- [x] T2: `notify/policy.ts` に **`NotifyKind` / `NotifyKey` / `notifyKeyOf(kind, agent)` /
      `routesFor(Audience, prefs)` / `decide()`** を作る＋単体テスト。
      `decide()` は `{ routes, key }` を返す（**判定と記録を 1 つにまとめ、`judged` への入れ忘れを防ぐ**）。
      `routesFor` は**表の 3 行 × 3 経路を総当たり**で固定する
      対象: `packages/web/src/notify/policy.ts`（新規）・`policy.test.ts`（新規） / 根拠: design インターフェース「鍵」「判定」・振る舞い 2
      依存: なし
      AC: AC1, AC3
- [x] T3: `notify/policy.ts` に待ち行列の純粋関数を足す＋単体テスト
      （**同 pane の置き換え**・**9 件目で最古を捨てる**・**pane の件を一括で捨てる**）
      対象: `packages/web/src/notify/policy.ts`・`policy.test.ts` / 根拠: design 振る舞い 5
      依存: T2
      AC: AC9
- [x] T4: `notify/ports.ts` を作る（`DesktopNotifierPort` / `SoundPort` / `DesktopPermission` / `SoundResult`）。
      **型だけ**（実装は T11・T12）
      対象: `packages/web/src/notify/ports.ts`（新規） / 根拠: design インターフェース「port」
      依存: なし
      AC: AC7, AC12, AC13
- [x] T5: `store/view.ts` の prefs を **`readPrefs()` / `writePrefs(patch)` の併合式**に直す＋単体テスト。
      **`agentSort` の読み書きもこの 2 つを通す**。**読みも書きも同じ try/catch の内側**に入れる
      対象: `packages/web/src/store/view.ts:42-62` / 根拠: research F30・F33、design 設計方針
      依存: なし
      AC: AC6
- [x] T6: `store/view.ts` の `Toast` に `kind?: "sticky"` と `actions?` を足し、
      **`toast(message, opts?)` が第 2 引数を取るように変え**（`:223-227`。型だけでは `sticky` を渡せない）、
      `DialogContext` に `{ kind: "notifySettings" }` を足す
      対象: `packages/web/src/store/view.ts:64-68` `:74-84` `:223-227` / 根拠: design インターフェース「トーストの拡張」
      依存: T5
      AC: AC-I1, AC-I5
- [x] T7: `components/Toast.vue` を直す＋単体テスト（**`sticky` は自動消去に掛けない**・
      **行動ボタンと閉じるボタン（`<button>`・`@click.stop`）**・**1 行に畳む**・
      **入れ物に `max-height: 40vh; overflow-y: auto`**。**案内だけは畳まない**）
      対象: `packages/web/src/components/Toast.vue:41-50` `:57-83`・`Toast.test.ts` / 根拠: design 振る舞い 10
      依存: T6
      AC: AC-I3, AC-I5
- [x] T8: `term/TerminalRegistry.ts` に **`isVisible(paneId)`** を公開する＋単体テスト
      （`acquire`/`release` に連動すること）。**`visiblePaneIds()` は作らない**——用途が無い
      （design の表の表記は過剰。decisions に残す）
      対象: `packages/web/src/term/TerminalRegistry.ts:61` `:78-95` / 根拠: research F1・F9
      依存: なし
      AC: AC3
- [x] T9: `store/StoreAdapter.ts` に `onAgentChanged` / `onSnapshotApplied` / `onPaneClosed` を足す＋単体テスト。
      **`prev` は `session.paneAgentStatusChanged` を呼ぶ前に読む**（順序依存をコメントに残す）。
      **`first` は `StoreAdapter` が自分で持つ**
      対象: `packages/web/src/store/StoreAdapter.ts:8-18` `:29-38` `:88-93`・`StoreAdapter.test.ts` / 根拠: research F10・F12
      依存: なし
      AC: AC1, AC14
- [x] T10: `store/notifications.ts` を作る＋単体テスト（設定・待ち行列・**判定済み（`Map<paneId, Set<key>>`）**・
      案内の状態・`desktopUsable` / `soundBlocked`）。**`judged` の掃除は pane の寿命**
      （件数の LRU にしない）。設定は T5 の `readPrefs`/`writePrefs` を通す
      対象: `packages/web/src/store/notifications.ts`（新規）・`notifications.test.ts`（新規） / 根拠: design 概要・振る舞い 2
      依存: T3, T5
      AC: AC5, AC6, AC9, AC14
- [x] T11: `notify/DesktopNotifier.ts` を作る＋単体テスト（`permission()` の 4 値・
      **`request()`（呼ぶのは T15・T16 だけ。起動経路から呼ばない）**・
      **`show()` を try/catch で包んで `false` を返す**（Android Chrome）・`tag` による置き換え・
      `onClick` で `window.focus()` → 渡された関数・`closeByTag`）
      対象: `packages/web/src/notify/DesktopNotifier.ts`（新規）・`.test.ts`（新規） / 根拠: research F72〜F80
      依存: T4
      AC: AC7, AC8, AC12, AC15
- [x] T12: `notify/ToneSound.ts` を作る＋単体テスト（`AudioContext` は 1 つを使い回す・
      **包絡線つきの 2 音**で `blocked`／`done` を鳴らし分ける・`suspended` なら `"blocked"` を返す・
      `unlock()` で `resume()`）
      対象: `packages/web/src/notify/ToneSound.ts`（新規）・`.test.ts`（新規） / 根拠: research F81〜F87
      依存: T4
      AC: AC2, AC13
- [x] T13: `notify/NotificationController.ts` の**検知・判定・遅延**を作る＋単体テスト。
      **`judged` に入れるのは遅延を仕掛けた時点**／**利用者の状態は `await nextTick()` の後に
      `registry.isVisible()` と `document.hasFocus()` で読む**／**`blocked` は 1000ms 後に
      鍵が一致するか再確認**／**スナップショット経路は `first` で 2 分岐し、
      `blocked` も `done` も `judged` に無い鍵を知らせる**
      対象: `packages/web/src/notify/NotificationController.ts`（新規）・`.test.ts`（新規） / 根拠: design 振る舞い 1〜4
      依存: T1, T7, T8, T9, T10, T11, T12
      AC: AC1, AC2, AC3, AC4, AC14
- [x] T14: 同ファイルに**待ち行列の出入り**を足す＋単体テスト。
      **積む条件は「(c) ではないとき」でトーストの入／切と独立**（`toastId` は `number | null`）／
      **出口は `drop(key)` の 1 本**（待ち行列から外す → 残っていれば `dismissToast` → `closeByTag`）／
      **`view.toasts` の watch は外して `closeByTag` するだけ**（`dismissToast` を呼ばない）／
      **`focusEntry(key)`** を `prefix+o`（先頭から順に）と **OS 通知のクリック（その 1 件）**で共用
      対象: `packages/web/src/notify/NotificationController.ts`・`.test.ts` / 根拠: design 振る舞い 5・6、decisions D1・D4
      依存: T13
      AC: AC9, AC10, AC11, AC15
- [x] T15: 同ファイルに**案内**を足す＋単体テスト。**契機は「判定した」とき**（経路が全部切でも立てる）／
      **`notifyHintPending` は prefs に保存**／**既にフォーカスがあればその場で出す**／
      **`hintToastId` で重ねない**／**ボタンでも本体のクリックでも消費する**／
      **［許可する］は `sound.unlock()` → `desktop.request()` → `granted` なら `prefs.desktop = true`**
      対象: `packages/web/src/notify/NotificationController.ts`・`.test.ts` / 根拠: design 振る舞い 7、decisions D3
      依存: T14
      AC: AC5
- [x] T16: `components/NotificationSettingsDialog.vue` を作る＋単体テスト。**`injection.ts` に
      `NotificationControllerKey` も足す**（この製品でコンポーネントが部品を受け取る唯一の口。
      無いとダイアログが ports に触れない）。
      `ConfirmDialog` の形／**3 つの `<button role="switch" :aria-checked>`**／
      **OS 通知の行は 4 状態で見え方が変わる**（`granted`／`denied`／`default`（押すと `request()`）／使えない）／
      **音の行は `soundBlocked` のとき理由を添え、「入」にしたら `unlock()`**／
      開いたら最初の切り替えへ `focus()`
      対象: `packages/web/src/components/NotificationSettingsDialog.vue`（新規）・`.test.ts`（新規）・
      `packages/web/src/injection.ts:12-17` / 根拠: design 振る舞い 8、decisions D2
      依存: T7, T10, T11, T12
      AC: AC6, AC7, AC8, AC12, AC13, AC-I1, AC-I2, AC-I4
- [x] T17: **結線する**——`main.ts` で `NotificationController` を組み立て（`registry` の後・
      `ActionDispatcher` の前にしか置けない）、`StoreAdapter` の options に T9 の 3 つを渡し、
      `app.provide` で配り、**`App.vue` にダイアログを置く**。
      **入口（T19）より先に置く**——設置が後だと、`prefix+s` を押した時点で
      `openDialog` が立って `keys.setMode("dialog")` になり、**何も描かれないままキーが効かなくなる**
      （`main.ts:160-163` `:171-172`。再読み込みするまで戻らない）
      対象: `packages/web/src/main.ts:68-76` `:109-137` `:201-207`・
      `packages/web/src/App.vue:1-20` `:67-76` / 根拠: design 対象範囲、research F10
      依存: T15, T16
      AC: AC16
- [x] T18: **動作の側**——`keys/actions.ts` の `Action` union に `{ type: "notifySettings" }` と
      `{ type: "nextNotification" }` を足し、`ActionDispatcher` に 2 つの case と
      `NotificationController` の受け取り口（`ActionDispatcherOptions`）を足す＋単体テスト。
      **`run()` の `switch` には `default` も網羅性の検査も無い**ので、足し忘れても型では落ちない。
      **キーの差し替え（T19）より先**——逆順だと `prefix+s` が黙って何もしない時期ができる
      対象: `packages/web/src/keys/actions.ts:43-69`・
      `packages/web/src/actions/ActionDispatcher.ts:14-21` `:58-149` / 根拠: research F35・F37
      依存: T17
      AC: AC10, AC11
- [x] T19: **入口 3 つ**を足す＋単体テスト。`keymap.ts` の `s` → `notifySettings`・`o` → `nextNotification`／
      `ContextMenu.vue` の global に**「移動」と「切り離し」の間**へ「通知の設定」（`:88-89` のコメントも直す）／
      `MobileShell.vue` の上部バーに 4 つ目のボタン。
      **`prefix+o` が実際に効くのはこのタスクから**（T18 までは `o` が `notYet` のまま）
      対象: `packages/web/src/keys/keymap.ts:13-18`・`packages/web/src/components/ContextMenu.vue:88-97`・
      `packages/web/src/mobile/MobileShell.vue:80-84` / 根拠: design 振る舞い 9
      依存: T18
      AC: AC10, AC11, AC16, AC-I3
- [x] T20: `HelpDialog.vue` の `s`・`o` の行を直し、**落ちる既存テスト 3 件を直す**。
      **先に落ちることを確かめてから直す**（条項 `regression-negative-control`）
      対象: `packages/web/src/components/HelpDialog.vue:43` `:45`・`keys/KeyRouter.test.ts:135-138`・
      `components/HelpDialog.test.ts:39`・`components/ContextMenu.test.ts:182` / 根拠: research F38・F39、design AC16・AC17
      依存: T19
      AC: AC16, AC17
- [x] T21: `docs/herdr-parity.md` の H29 の行をこの work の内容に更新する
      対象: `docs/herdr-parity.md:51` / 根拠: requirements スコープ「その他」
      依存: T20
      AC: なし
- [x] T22: E2E を足す。**`page.addInitScript` で `Notification` と `AudioContext` を差し替え、
      呼ばれた事実を DOM に残して観測する**（**代替であることを spec のコメントに書く**）。
      **同じ `addInitScript` で `wtm.prefs.v1` も仕込む**——E2E に localStorage の事前設定の
      仕組みが無く（research F49）、**既定は OS 通知 切**（decisions D5）なので、
      通知の経路も「案内は 1 度だけ」の 2 回目も仕込まないと確かめられない。
      入力待ちで知らせが出ること／見ている pane では出ないこと／`prefix+o` で移ること／
      OS 通知のクリックでその 1 件へ移ること／案内が 1 度だけ出ること
      対象: `packages/e2e/src/specs/`（新規 spec） / 根拠: design「テストの置き方」、条項 `e2e-observe-browser`、research F49
      依存: T20
      AC: AC1, AC3, AC5, AC10, AC15, AC-I3
- [x] T24: **利用者の操作で自動再生を解除する**（PR レビュー（人間）の指摘）。
      設定の注記「どこかを押すと鳴るようになります」が事実ではなかった——解除の経路は
      「設定で音を入にした瞬間」と「案内の［許可する］」の 2 つだけで、**自動再生の制限は
      ページの読み込みごとに掛かり直す**ため、読み込み直した後の利用者には効かない。
      `main.ts` が `pointerdown`/`keydown` を拾って `noteUserGesture()` を呼ぶ経路を足し、
      `play()` 自身も鳴らせなかったときに解除を試みる。
      **E2E の偽 `AudioContext` を実物に合わせて `suspended` で始める**（`running` だと
      結線が無くても鳴って見え、穴が隠れる）
      対象: `packages/web/src/notify/ToneSound.ts:55` `packages/web/src/notify/NotificationController.ts:351`
      `packages/web/src/main.ts` `packages/e2e/src/specs/notifications.spec.ts:92`
      依存: T22
      AC: AC13
- [ ] T23: 全パッケージの単体テストと既定の E2E を走らせて結果を記録する
      （**test 工程で消化する**。coding では未チェックのまま承認してよい）。
      **`pnpm build` を通してから E2E を走らせる**
      対象: 未特定（走らせるだけで自前の差分を持たない）
      依存: T22
      AC: AC17
