# 調査: エージェントの「入力待ち」「完了」を、画面を見ていなくても知らせる

`requirements.md` の「未確定事項 / 確認したいこと」を事実で埋める。**設計判断は design へ送る**。

herdr のソースは `/tmp/.../scratchpad/herdr`（commit `da6bcd5`）。以下 `herdr:` と略す。
**Web 検索は使っていない**——この製品のコードと herdr のソース、および記憶に基づく知識で答え、
**知識由来のものは「知識・未実測」と明記**する。

## 調査の問い

- Q1: 「その pane を見ている」をどう判定できるか。
- Q2: 「変化」をどの層で検知できるか。スナップショットとイベントを区別できるか。
- Q3: 再接続・サーバ再起動をまたいで「同じ出来事か」を識別する鍵は何か（AC14）。
- Q4: 通知の 3 経路（OS 通知・音・トースト）を、この製品の既存の部品にどう乗せるか。
- Q5: 外の規範（Notification API・自動再生ポリシー・APG・通知の作法）と、要件の表は整合するか。
- Q6: herdr の待ち行列はそのまま移植できるか。
- Q7: E2E で「OS 通知が出たか」「音が鳴ったか」をブラウザ側から観測できるか（条項 `e2e-observe-browser`）。
- Q8: この work に着手した理由（herdr の設定 132 項目の調査）を記録する。

## 判明した事実

### F1〜F9: 「その pane を見ている」の判定（Q1）

- **F1**: 表示中の pane の集合は `TerminalRegistry` が `private readonly visible = new Set<string>()` として
  **既に持っている**（`packages/web/src/term/TerminalRegistry.ts:61`）。`acquire()` が足し（`:82` `:87`）、
  `release()` が消す（`:93-95`）。**外から読み出す口は無い**——公開メンバーに `visible` を返すものは無く、
  内部では `evictIfNeeded` の除外条件にだけ使っている（`:100`）。
- **F2**: `acquire`/`release` の呼び出し元は **`TerminalPane.vue` の `onMounted`（`:39-45`）と
  `onBeforeUnmount`（`:47-52`）だけ**。つまり visible ＝「`TerminalPane` が DOM にマウントされている pane」。
- **F3**: **zoom 中**は `PaneLayout` が `singlePaneId` の 1 つだけを描く
  （`packages/web/src/components/PaneLayout.vue:110` `:179`）ので、非 zoom の pane は unmount され
  `release` される。→ visible ＝ 1 件。
- **F4**: **モバイル**は `view.focusedPaneId` の 1 つだけを描く
  （`packages/web/src/mobile/MobileShell.vue:44-45` `:90-101`）。→ visible ＝ 常に 1 件。
- **F5**: **detached / 認証待ち**は `App.vue:40-42` が `app-shell` ごと差し替えるので **visible は空**。
  →「見ている pane は 1 つも無い」と正しく判定できる。
- **F6**: `status: "failed"` の pane は `onMounted` が早期 return する（`TerminalPane.vue:40`）ので
  **一度も acquire されない**＝ visible に入らない。
- **F7**: **`visible` は素の `Set` で Vue の reactive ではない**。`watch` できないので、
  判定の時点で pull で読む必要がある。
- **F8**: 代替案（registry を触らず、ストアから描画規則を再現する）は可能
  （`view.workspaceId`/`view.tabId` → `tab.zoomedPaneId` と `depthFirstPaneIds(tab.layout)`
  （`packages/web/src/term/layoutOrder.ts:7`）、モバイルなら `view.focusedPaneId`）。
  ただし **`PaneLayout` の描画規則を二重に持つ**ことになる。
- **F9**: `TerminalRegistryKey` は具象クラスを provide している（`packages/web/src/injection.ts:14`）ので、
  **メソッドを足しても port の契約は壊れない**（`TerminalSinkPort` は 3 メソッドのみ）。

### F10〜F15: 変化の検知と、識別の鍵（Q2・Q3）

- **F10**: **スナップショットとイベントを区別できるのは `StoreAdapter` だけ**——
  `applySnapshot(s, clientId)`（`packages/web/src/store/StoreAdapter.ts:29`）と `applyEvent(e)`（`:40`）が
  入口で分かれ、その下は同じ `session` のミューテーションに合流する。**Pinia の watch からは区別できない**。
- **F11**: pane のエージェント情報は **`pane.agent_status_changed`** で届く
  （`packages/protocol/src/events.ts:52-53`）。`StoreAdapter.ts:91-93` が `session.paneAgentStatusChanged` へ渡す。
- **F12**: サーバは **AgentInfo が実際に変わったときだけ**このイベントを出し
  （`packages/server/src/session/SessionService.ts:359`）、**`pane.updated` より先に publish する**（`:361-366`）。
  → `StoreAdapter` の `case "pane.agent_status_changed"` で**ストアを更新する直前に**
  `session.panes.get(paneId)?.agent` を読めば、**本物の「前の値」が取れる**。
- **F13**: `session` ストアは**前の値を一切保持しない**（`store/session.ts:17`。`applySnapshot` は `:28` で
  Map を丸ごと作り直す）。「前の値」は通知層が自前で持つしかない。
- **F14**: `AgentInfo` は `instanceId`（`packages/protocol/src/model.ts:70`）・`completionSeq`（`:76`）・
  **`since`（状態が変わった時刻・epoch ms。`:81-82`）** を持つ。
- **F15**: **`since` は状態が変わらない限り保持される**——
  `since: judgment.state !== previous.state ? now : current.since`
  （`packages/server/src/agent/AgentTracker.ts:111`）。**この値はサーバのメモリにあり、
  クライアントの再接続では変わらない**（`applySnapshot` が何度来ても同じ値が届く）。
  一方**サーバ再起動では失われる**——エージェントの状態は `SessionFile` に永続化されていない
  （`packages/server/src/persist/SessionFile.ts:11-17` の `SessionFilePane` は
  `id`/`label`/`cwd`/`shell`/`status` のみ。**この調査で確認**）。再起動後は新しい `instanceId` になるので、
  別の出来事として扱われる——これは正しい振る舞い。
  → **`instanceId + since`（入力待ち）と `instanceId + completionSeq`（完了）が、
  AC14 が求める「同じ出来事か」の鍵になる**。

### F16〜F18: モバイルの上部バー

- **F16**: `<header class="mobile-shell-bar">` の中身は 3 つ（`mobile/MobileShell.vue:80-84`）:
  `.mobile-shell-title`（`flex:1; min-width:0; ellipsis`）／`.mobile-shell-fit-btn`（`flex:none`）／
  `.mobile-shell-keyboard-btn`（`flex:none`・`⌨` の 1 文字・`aria-label="キーボード"`）。
  バーは `display:flex; justify-content:space-between; padding:.5em`（`:116-123`）。
- **F17**: **4 つ目を足せる**——タイトルが `flex:1; min-width:0` で縮む側を引き受けるので、
  `flex:none` のアイコンボタンを増やす余地がある。既存 2 ボタンは `aria-pressed` で状態を出す形。
- **F18**: 既存テストは**すべてクラス名で要素を取っている**（`mobile/MobileShell.test.ts`・
  `packages/e2e/src/specs/mobile.spec.ts`）。位置やインデックスで取っている箇所は無いので、
  **4 つ目を足しても既存テストは壊れない**。

### F19〜F23: ダイアログ（Q4）

- **F19**: **切り替えを並べるダイアログに一番近いのは `ConfirmDialog.vue`**——入力欄が無くボタンだけで、
  開いたら特定のボタンへフォーカスする（`:30-42` の watch → `showModal()` → `focus()`、
  `:70-78` の `<dialog role="alertdialog" aria-modal="true" @cancel @click.self @keydown>`）。
  `NameDialog` / `WorktreeCreateDialog` は「入力＋OK/キャンセル」なので、確定ボタンを置かない設計と合わない。
- **F20**: **既存のダイアログに切り替え（トグル）は 1 つも無い**。`role="switch"` も
  `<input type="checkbox">` も**リポジトリ全体に 0 件**。トグルの表現は**すべて `<button :aria-pressed>`**
  （`mobile/ExtraKeys.vue:85,96`、`mobile/MobileShell.vue:82,83`）。
- **F21**: `view.openDialogWithContext(ctx)`（`store/view.ts:162-166`）が `preDialogFocusPaneId` を控えて
  `openDialog` を立て、`closeDialog()`（`:178-183`）が戻す。`DialogContext` は union（`:74-84`）。
- **F22**: **フォーカスの退避・復元は pane 単位で、DOM 要素単位ではない**。`closeDialog` は
  `focusedPaneId` を書き戻すだけで、`TerminalPane.vue:54-60` の watch が `term.focus()` する。
  → **サイドバーの「メニュー」から開いた場合、閉じたときに戻るのはメニューボタンではなく端末**
  （既存の「キー割り当て」「移動」も同じ）。DOM 要素へ戻す仕組みを持つのは `ContextMenu.vue:32,39-44` の
  `returnFocusTo` だけ。
- **F23**: ダイアログが開いている間、`main.ts:171-176` の window keydown は先頭で `return` して
  **端末へ何も流さない**。→ AC-I5 は `openDialogWithContext` を使えば自動的に満たされる。

### F24〜F29: トースト（Q4）

- **F24**: `Toast` 型は `{ id: number; message: string }` のみ（`store/view.ts:65-68`）。
- **F25**: 自動消去は **`Toast.vue` 側**——新しく増えた id 全部に
  `setTimeout(() => view.dismissToast(id), 4000)` を掛ける（`components/Toast.vue:41-50`）。
  **ストア側には寿命の概念が無い**。
- **F26**: → **自動で消えないトーストを混ぜるには `Toast` 型に種別を足すのが最小**。
  `Toast.vue:47` で分岐する。別の入れ物にすると `aria-live` の領域と重なり順が二重になる。
- **F27**: 消す手段は**要素全体の `@click`**（`Toast.vue:59`）。トーストは `<div>` で
  **tabindex を持たず Tab の順に入らない**——**キーボードだけでは消せない**（AC-I3 に関わる）。
- **F28**: 位置は `position:fixed; left:50%; bottom:3.5em; flex-direction:column; gap:.4em; z-index:950`
  （`:66-75`）。**下から上へ縦積み**。
- **F29**: ネイティブの `<dialog>.showModal()` は **top layer** に出るので、**z-index に関わらずトーストより上**。
  設定ダイアログを開いている間、トーストは backdrop の下に隠れる（知識＋既存ダイアログが全部 `showModal()`）。

### F30〜F34: `wtm.prefs.v1`

- **F30**: 書きは `JSON.stringify({ agentSort: v })` の**全置換**（`store/view.ts:56-62`）。
  読み側は `"agentSort" in parsed` を見るだけなので、**併合式に直しても読みは壊れない**。
- **F31**: `localStorage.clear()` している既存テストは 8 ファイル。いずれも前提を消すだけで、
  **併合式に直して壊れるものは無い**。
- **F32**: **保存された生の JSON 文字列を突き合わせているテストは 1 つも無い**。
- **F33**: ただし `store/view.test.ts:42-52`「localStorage が読めない環境でも動く」は
  **`Storage.prototype.getItem` だけを throw させる**。併合式の保存は「読んでから書く」ので、
  **保存側の `getItem` も try/catch の内側に入れないとこのテストが落ちる**。
- **F34**: prefs はストア生成時に 1 度だけ読む（`view.ts:117`）。

### F35〜F39: キー割り当て

- **F35**: `NOT_YET`（`keys/keymap.ts:13-18`）に `["s", …"外観と設定"]`・`["R", …"外観と設定"]`・
  `["o", …"通知"]`・`["e", …"端末機能の拡張"]`。`DEFAULT_KEYMAP` の末尾に `...NOT_YET`（`:64`）で展開。
- **F36**: `Action` は union（`keys/actions.ts:43-69`）。新しい種類はここに足す。
- **F37**: `notYet` の実行は `ActionDispatcher.ts:127-129` の `case "notYet"`。
- **F38**: **`HelpDialog.vue` の一覧は `HELP_GROUPS` に全部ハードコード**（`:37-89`）。
  `notYet(rawKey, displayKeys)` ヘルパ（`:29-33`）が `DEFAULT_KEYMAP.get(rawKey)` から `work` を引くので、
  **`s`/`o` が `notYet` でなくなると `work` が `""` になり「未対応（後続: ）」と出る**。編集は必須。
- **F39**: 差し替えで**落ちる既存テスト**: `keys/KeyRouter.test.ts:135-138`（`s` が notYet であること）と
  `components/HelpDialog.test.ts:39`（`"未対応（後続: 通知）"`）。
  `HelpDialog.test.ts:38` の `"未対応（後続: 外観と設定）"` は `R` が残るので**生き残る**。

### F40〜F45: 「その pane へ移る」

- **F40**: 形は**どこも同じ 3 手**——`view.setView(workspaceId, tabId)` → `view.focusPane(paneId)` →
  `conn.request("pane.focus"|…)`（fire-and-forget）。`setView` は pane に触らない（`store/view.ts:143-147`）。
- **F41**: **再利用できる共通関数は無い**。同じ 3 手が **5 ファイルに重複**している
  （`ActionDispatcher.ts` の 6 箇所・`GotoPicker.vue:137-159`・`Sidebar.vue:67-80`・`TabBar.vue:25`・
  `mobile/PanePicker.vue:60,69,76`）。
- **F42**: **pane id 1 つから逆引きして移る**実装に一番近いのは `GotoPicker.vue:151-158`
  （`panes.get(paneId).tabId` → `tabs.get(tabId).workspaceId` → 3 手）。component のローカル関数で import できない。
- **F43**: `session` に「pane id → workspace id」の getter は**無い**（2 段引きを毎回手書き）。
- **F45**: サイドバーの「メニュー」は `<button aria-haspopup="menu" :aria-expanded>`（`Sidebar.vue:149-158`）。
  全体メニューの項目は `ContextMenu.vue:93-97` の 3 つで、**`:88-89` のコメントが
  「設定画面が無いので herdr の settings は入れない」と書いている**（要件が変えると宣言している箇所）。

### F46〜F53: E2E の下地（Q7）

- **F47**: **`page.addInitScript` は既に使われている**——`packages/e2e/src/specs/performance.spec.ts:100-126` の
  `installPaintProbe(page)`。`window.__probe` を置き、`window.WebSocket` をサブクラスに差し替えて記録する。
  `page.goto()` の**前**に呼ぶ（`:151` `:183`）。**この 1 箇所のみ**。
- **F49**: E2E で `localStorage` を触っている箇所は **0 件**（事前設定の仕組みが無い）。
- **F51**: 条項 `.aidev/conventions/e2e-observe-browser.md` の骨子は「判定は利用者が見る場所（DOM・描画・
  ブラウザが受けた／送ったフレーム）で行う」「直接読めないときは**何を代わりに観測したかを spec の
  コメントに書く**。固定時間待ちだけを根拠にしない」（`:17-27`）。
- **F53**: `playwright.config.ts` は `Desktop Chrome` のみ、`use.permissions` の設定は**無く**、
  権限は `context.grantPermissions(["clipboard-read","clipboard-write"], {origin})`（`support/keys.ts:6-8`）で
  個別に付けている。**`notifications` を付けている箇所は無い**。

### F54〜F61: herdr の待ち行列（Q6）

- **F54**: 上限は `const MAX_QUEUED_NOTIFICATIONS: usize = 8;`（`herdr:src/client/shell/notification_policy.rs:3`）。
- **F55**: `:50-53` は **9 件目で `pop_front()`（最も古いものを捨てる）**。
  **ただし herdr は「今見えている 1 件」と「待ち行列（最大 8）」を別に持つ**（`:46-49`）ので、
  実際の保持は **1 + 8 = 最大 9**。**herdr のトーストは同時に 1 枚しか出ない**。
- **F56**: `:119-132` は**同じ pane の古いものを `retain` で消してから新しいものを末尾に積む**。
  **元の順番は引き継がない**。
- **F57**: `:65-95` が `prefix+o` の実体。消費するのは**待ち行列の先頭ではなく「今見えている 1 件」**で、
  消費すると次を繰り上げる（`:81`）。
- **F58**: `:69-76` は**到達不能な対象**の扱い——`"{label} is unavailable"` を出して `return` し、
  **通知は消費されず、その場に残る**。→ **要件の「対象が無ければその旨を出して次へ進む」は herdr と逆**。
- **F59**: herdr のトーストは**自動で消える**（NeedsAttention 8 秒・Finished 5 秒。`:15-22`）。
  本製品の「自動で消えない」は意図的な差。
- **F61**: 接続先が消えたら、その接続先の通知を全部捨てる（`retire_endpoint_notifications`。`:25-38`）。
  → **pane や workspace が閉じたら待ち行列から消す**相当物が要る。

### F62〜F71: herdr の配送と音

- **F62**: **状態が変わったときだけ**通知する（`herdr:src/app/actions.rs:131-156`。`new_state == prev_state`
  なら None）。`Blocked` → `NeedsAttention`、`Idle` かつ完了遷移 → `Finished`。
- **F64**: **抑止の条件**は `target_active`＝**同じ接続先かつイベントの `tab_id` が
  `focused_tab_id` と一致**（`notification_policy.rs:243-265`）。
  → **herdr の「見ている」は tab 粒度**（pane 粒度ではない）。
- **F65**: **音の抑止は Finished だけ**（`:198-199`）。→ **herdr は入力待ちの音を、見ている tab でも鳴らす**。
  本製品の表（(c) 見ている → 鳴らさない）は herdr と違う判断。
- **F66**: 配送の分岐（`:211-238`）は「フォーカスがあり、かつ見ている tab のときだけ外部通知を抑える」構造で、
  **本製品の表と同型**。
- **F67**: **遅延は「保留 → 発火時に再確認」**（`:105-111` で `deadline` を付けて積み、`:173-176` で待つ）。
  **音・外部通知・トーストが全部まとめて同じだけ遅れる**。既定 `delay_seconds = 1`。
- **F68**: **遅延中の再確認が herdr の揺れ対策の本体**（`:267-318`）——発火時に自分の snapshot を見て、
  入力待ちはまだ `Blocked`・完了はまだ `Done` のときだけ通す。そうでなければ捨てる（`Stale`）。
  → **要件の「blocked は 1 秒保たれたときだけ」は、これを単純化したもの**。
- **F70**: 音の素材は **バイナリに埋め込んだ mp3 2 本**を外部プレイヤーに渡す方式（`herdr:src/sound.rs:27-28` `:39-64`）。
  **ブラウザには当てはまらない**。
- **F71**: herdr の既定は **配送 `Off`・音 `enabled = true`**（`herdr:src/config/model.rs:1212`・
  `src/config/sound.rs:157`）＝「トースト切／音入」。**本製品の既定（トースト入／OS 通知切／音切）とは違う**。

### F72〜F80: Notification API（Q5。**知識・未実測**）

- **F72**: `Notification.permission` は `"default"` / `"granted"` / `"denied"` の 3 値。
- **F73**: `requestPermission()` は **Firefox 72+ と Safari が「一時的なユーザー操作」を要求**する。
  Chrome は厳密には要求しないが quiet UI を出すので、**ボタン押下から呼ぶのが唯一安全**（AC7 と合致）。
- **F74**: **`tag` が同じ通知は同一オリジン内で置き換わる**。再度アラートしたいときは `renotify: true`
  （`tag` 必須）。→ 要件の「同じ pane の通知は `tag` で置き換える」は素直に実現できる。`tag` は pane id が自然。
- **F75**: `notification.onclick` の中では **`window.focus()` が働く**（通知のクリックはユーザー操作扱い）。
  作法として `window.focus()` の後に `notification.close()`。
  **未確認**: OS やウィンドウマネージャによっては前面化が taskbar の点滅に留まる。
- **F76**: `requireInteraction: true` は **Chrome デスクトップのみ**。Firefox・Safari は無視する。
- **F77**: **Notification API はセキュアコンテキスト（https か localhost）が必須**。
  → 本製品は http でも動く構成なので、**AC12 の「使えない環境」は現実に起きる**。
- **F78**: **Android の Chrome では `new Notification()` が使えない**
  （`Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead`）。
  → **Service Worker が対象外である以上、モバイルでは OS 通知を出せない**。
- **F79**: **iOS / iPadOS の Safari** は、ホーム画面に追加した web アプリ（iOS 16.4+）でしか通知を出せない。
  → **iOS でも OS 通知は使えない**。
- **F80**: 通知の「クリック」は**ページが生きている間しか受け取れない**（非 persistent notification）。

### F81〜F87: 音の自動再生（Q5。**知識・未実測**）

- **F81**: `play()` は阻まれると **`NotAllowedError` で reject する Promise** を返す。**必ず `.catch()`**。
- **F82**: `AudioContext` をユーザー操作の外で作ると **`state === "suspended"`**。
  ユーザー操作のハンドラの中で `resume()` すると `"running"` になる。
- **F83**: **「粘り」はドキュメント単位（ページの読み込みごと）**。一度でもユーザーが操作すれば
  そのページが閉じられるまで再生できる。**再読み込みでリセットされる**。
- **F84**: **本製品では実質ほぼ解除される**（端末に打鍵するので）。ただし
  **「開いて放置し、別タブへ行ってから最初の通知」は未解除で来うる**。これが AC13 が要る理由。
- **F85**: **外部ファイル無しで短い通知音を作れる**: `AudioContext` + `OscillatorNode` + `GainNode` の包絡線
  （立ち上がり 5〜10ms・減衰 150〜300ms）。**包絡線なしで start/stop するとクリック音が出る**ので必須。
  入力待ち／完了は周波数か 2 音の向き（上がる／下がる）で作り分ける。
- **F86**: 是非——**利点**はライセンス・容量・同梱が不要で、`AudioContext.state` で
  **鳴らせたか否かを明示的に判定できる**（AC13 に直結）。**欠点**は素の正弦波が安っぽいこと。
  **この work では `OscillatorNode` が妥当**（herdr の mp3 同梱は外部プレイヤーに渡す都合によるもの）。
- **F87**: `AudioContext` は **1 つを使い回す**（通知のたびに new すると上限に当たる）。

### F88〜F91: WAI-ARIA APG（Q5。**知識・未実測**）

- **F88**: **Dialog (Modal)** はネイティブ `<dialog>.showModal()` が modality・Esc・フォーカスの閉じ込め・
  top layer・`::backdrop` を**ブラウザ側で提供する**。既存の実装（F19・F21）をそのまま踏襲すればよい。
- **F89**: **Switch** は `role="switch"` + `aria-checked`。APG は「checkbox と違い on/off を表し、
  **操作が即座に効く**もの」と定義。→ **AC-I2（押した時点で反映・確定ボタンを置かない）に
  意味論として最も合う**。
- **F91**: **この製品の既存はどちらにも寄っていない**（F20）——トグルは全部 `<button :aria-pressed>`。
  `aria-pressed` のトグルボタンも APG の「Button (Toggle)」として正当。
  **`<input type="checkbox">` はこの製品の流儀から最も遠い**（フォーム確定の含み・既存 CSS に合う見た目が無い）。

### F92〜F94: 通知の作法（Q5。**知識・実例は未確認**）

- **F92**: 「アプリが前面のときは OS 通知を出さない」は広く行われている。
  Slack は**いま見ているチャンネル**の通知を出さず、Discord も同様。Element・Teams も同種の抑止を持つ。
- **F93**: Notification API の仕様そのものに自動抑止は無く、**アプリ側の責務**。
- **F94**: **要件の表は上の慣習と整合する**。さらに (b)（同じ画面でも見ていない対象はアプリ内で知らせる）を
  設けている点は Slack/Discord の**チャンネル単位の抑止と同型**で、慣習の精緻化にあたる。
  herdr も同じ形（tab 粒度。F64・F66）。相違は herdr が入力待ちの音を抑止しない点だけ（F65）。

### F95: この work に着手した理由（Q8）

利用者の依頼で **herdr の設定（`~/.config/herdr/config.toml` と `prefix+s` の設定画面）で変えられる項目を
全件洗い出し**、本製品の実装状況と突き合わせた。結果は **132 項目**（非キー割り当て 69 ＋ キー割り当て 63）で、

| 分類 | 件数 |
|---|---|
| 実装済み（wtm でも設定できる） | 3（`ui.agent_panel_sort` / `advanced.scrollback_limit_bytes` / `terminal.default_shell`） |
| 機能はあるが設定にできない | 22 |
| 未実装 | 31 |
| 本製品では不要（外側端末・ssh・OS の入力ソース等、前提が違う） | 13 |

価値の順位は **①通知 ②キー割り当ての変更 ③テーマと明暗追従 ④サイドバー幅・折りたたみ状態の保存
⑤新しい workspace の cwd**。**①を選んだのは、本製品の目的（複数のエージェントを見張る）に直結し、
かつ `Notification`・`Audio`・`vibrate` の呼び出しがリポジトリに 1 つも無い**＝いま完全に穴だから。
`docs/herdr-parity.md` の **H29** が「新規後続(提案):通知」のまま（`:51`）なのもこの穴に対応する。

## 影響範囲

- **web のみ**（protocol・server は変更不要）。ただし `TerminalRegistry` に読み出し口を足す場合は
  `packages/web/src/term/` に触る。
- 触る既存ファイル: `store/view.ts`（prefs・`DialogContext`・`Toast` 型）、`store/StoreAdapter.ts`（検知）、
  `term/TerminalRegistry.ts`（visible の口）、`components/Toast.vue`（自動消去の分岐）、
  `components/ContextMenu.vue`（global に項目＋コメント）、`components/Sidebar.vue`（変更不要の見込み）、
  `mobile/MobileShell.vue`（4 つ目のボタン）、`keys/keymap.ts`・`keys/actions.ts`・
  `actions/ActionDispatcher.ts`・`components/HelpDialog.vue`（`prefix+s`・`prefix+o`）、
  `docs/herdr-parity.md`（H29）。
- **落ちる既存テスト（F39）**: `keys/KeyRouter.test.ts:135-138`・`components/HelpDialog.test.ts:39`。
  **先に落ちることを確かめてから直す**（条項 `regression-negative-control`）。

## 実現性 / リスク

- **モバイルでは OS 通知が原理的に出せない**（F78・F79）。**要件に書かれていない制約**で、design で扱う。
- **8 枚のトーストが同時に出る見え方**（F28 の縦積み・`bottom:3.5em` から上へ）が未検証。8 × 約 2em は
  画面をかなり覆う。herdr は 1 枚ずつ出す（F55）。
- **設定ダイアログを開いている間はトーストが見えない**（F29 の top layer）。
- **トーストをキーボードで消せない**（F27）。
- `since` が **サーバのメモリにしか無い**（F15）ので、サーバ再起動をまたぐと別の出来事になる。
  これは正しい振る舞いだが、E2E で `restart()` を使うテストを書くなら踏まえる。

## 実装アンカー

- A1 表示中 pane の集合（`packages/web/src/term/TerminalRegistry.ts:61` `visible`）— private。
  読み出し口を足す。出入りは `acquire`（`:78-91`）/ `release`（`:93-95`）。
- A2 スナップショットとイベントの分岐点（`packages/web/src/store/StoreAdapter.ts:29` `applySnapshot` /
  `:40` `applyEvent` / `:64-107` `applyEventToSession`）— **検知はここに挿す**。
- A3 エージェント変化の適用（`packages/web/src/store/StoreAdapter.ts:91-93`）—
  **この行の前で前の値を読む**。
- A4 識別の鍵（`packages/protocol/src/model.ts:68-83` の `instanceId` / `completionSeq` / `since`）。
  既読の先例（`packages/web/src/store/seen.ts:30-45`）。
- A5 ダイアログの雛形（`packages/web/src/components/ConfirmDialog.vue:30-42` `:70-78`、
  ネイティブ Esc の抑止は `NameDialog.vue:89-93`）。
- A6 文脈と開閉（`packages/web/src/store/view.ts:74-84` `DialogContext` / `:162-166` / `:178-183`）。
- A7 トーストの型と操作（`packages/web/src/store/view.ts:64-68` / `:223-227` / `:229-231`）、
  自動消去のタイマー（`packages/web/src/components/Toast.vue:41-50`）— **ここに種別の分岐**。
- A8 prefs（`packages/web/src/store/view.ts:42` `:44-54` `:56-62`）— 併合式に直す。
  注意が要るテスト（`packages/web/src/store/view.test.ts:42-52`）。
- A9 キー表（`packages/web/src/keys/keymap.ts:13-18` `:64`）、Action 型（`keys/actions.ts:43-69`）、
  ヘルプ（`components/HelpDialog.vue:29-33` `:43` `:45`）。
- A10 「その pane へ移る」の既存実装（`packages/web/src/components/GotoPicker.vue:151-158`）。
  重複の一覧は F41。
- A11 メニューへ項目を足す場所（`packages/web/src/components/ContextMenu.vue:93-97` の global 分岐 /
  `:88-89` 直すコメント）。
- A12 モバイル上部バー（`packages/web/src/mobile/MobileShell.vue:80-84` / `:116-159` CSS）。
- A13 E2E の `addInitScript` の先例（`packages/e2e/src/specs/performance.spec.ts:100-126`、
  呼び出しは `:151` `:183` で `goto` の前）、`grantPermissions` の先例（`support/keys.ts:6-8`）。
- A14 更新対象（`docs/herdr-parity.md:51` の H29 の行）。
- **未特定**: 通知の状態を置くストアの場所 — 既存に該当なし。`store/` に新設するか `view` に足すかは design。

## 実装時の注意

- **`visible` は reactive ではない**（F7）。`watch` できないので知らせる直前に pull で読む。
  `acquire`/`release` は DOM のマウントに連動するので tab 切り替えの最中は一瞬ずれうる。
  `blocked` は 1 秒待つので問題にならないが、**完了はクライアント側で待たない**ので、
  イベント処理と同じ tick で読むと切り替え途中の値を拾う可能性がある。
- **「前の値」は `session.paneAgentStatusChanged` を呼ぶ前にしか取れない**（F12・F13）。
  **サーバが `pane.agent_status_changed` を `pane.updated` より先に出す**ことに依存しているので、
  その旨をコメントに残す。
- **`HelpDialog.vue` は keymap と機械的に同期していない**（F38）。直さないと「未対応（後続: ）」になる。
- **prefs の保存を併合式にするとき、読みも保存も try/catch の内側に入れる**（F33）。
- **`requestPermission()` はユーザー操作から呼ぶ**（F73）。AC5 の案内の中に「許可する」ボタンを置き、
  その click から呼ぶ。**トーストのクリックが今は「消す」に割り当たっている**（F27）ので当たり判定の設計が要る。
- **`AudioContext` は 1 つを使い回す**（F87）。包絡線なしで鳴らすとクリック音（F85）。
- **E2E は `addInitScript` で `Notification` と音を差し替え、呼ばれた事実を DOM に残す**のが
  条項 `e2e-observe-browser` に素直（F47・F51）。`grantPermissions(["notifications"])` より、
  **AC7（許可を取るまで出ない）・AC12・AC13 の否定側も同じ仕掛けで書ける**点が利点。
- **E2E に localStorage の事前設定の仕組みが無い**（F49）。「案内は 1 度だけ」の 2 回目を確かめるには
  `addInitScript` で印を置く必要がある。

## design への申し送り

1. **「見ている pane」の取り方を 2 案から選ぶ**: (a) `TerminalRegistry` に読み出し口を足す（単一の正典）、
   (b) ストアから描画規則を再現する（registry に触らないが規則が二重化。F8）。**(a) を推す**。
2. **検知は `StoreAdapter` に置く**（F10）。`applyEvent` 側と `applySnapshot` 側の 2 経路に分ける
   （要件の機能要件がまさにこの形）。**初回のスナップショットかどうかは通知層が自分で持つ**
   ——`session.clientId` の有無では判定できない（再接続でも埋まる）。
3. **「知らせ済み」の鍵は `instanceId + since`（入力待ち）と `instanceId + completionSeq`（完了）**。
   `since` がクライアント再接続で変わらないことは**この調査で確認済み**（F15）。
4. **モバイルでは OS 通知が原理的に出せない**（F78・F79）。設定の「OS 通知」は、
   `window.Notification` の有無と**実際に構築できるか**で「この環境では使えません」に落ちる経路を
   AC12 と共通化する。**要件に無い制約なので decisions に残す**。
5. **音は `OscillatorNode` で作る**（F85・F86）。
6. **トグルの要素は `<button role="switch" :aria-checked>` か `<button :aria-pressed>`**。
   `<input type="checkbox">` は採らない。**design で 1 つに決めて理由を残す**。
7. **ダイアログを閉じたときのフォーカスは「開く前の pane」に戻る**（F22）。AC-I4 を文字どおり
   （メニューボタンへ戻す）にするなら `ContextMenu` の `returnFocusTo` と同じ仕掛けが要る。
   既存ダイアログは pane に戻るので、**揃えるか変えるかの判断が要る**。
8. **`prefix+o` の「対象が無いとき」は herdr と逆の判断**（F58）。明記して理由を残す。
9. **待ち行列は herdr の移植ではなく再設計**（F55・F59）。移植できる規則は 3 つだけ
   （上限の `pop_front`・同 pane の置き換え・対象消滅時の破棄）。
   **8 枚が同時に出る見え方**（F28）を design で確かめる。
10. **既定値が herdr と違う**（F71）。意図的な差なら decisions に残す。
11. **残った未確定**: (a) 8 枚同時のトーストの見え方、(b) 設定ダイアログを開いている間に来た知らせの見え方
    （F29）、(c) 消えないトーストをキーボードで消せるようにするか（F27）。
