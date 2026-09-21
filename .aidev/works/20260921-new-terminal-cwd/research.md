# 調査: 新しい workspace・tab・pane を、いま見ている場所で開く（herdr の `terminal.new_cwd`）

調査は委譲し（読むだけ）、要点を自分で確かめた。herdr の出所は `herdrdev/herdr` の commit `da6bcd5969779bfe0396bcf89a8025d4375d611e`。

## 調査の問い

- Q1: pane の「いまの場所」（シェルで `cd` した後）を、サーバはどう知るか。OS ごとに。
- Q2: 新しい workspace・tab・分割の場所は、いまどう決まるか。protocol は場所を受け付けるか。
- Q3: 無い場所で開こうとしたら何が起きるか。検証はあるか。
- Q4: 「いま見ている pane」を、サーバと web はそれぞれ知っているか。
- Q5: worktree を開く経路は、場所をどう渡しているか。
- Q6: herdr の `terminal.new_cwd` の意味。
- Q7: テストで確かめられる範囲。

## 判明した事実

### pane の「いまの場所」（Q1）

- **F1**: **Linux にはプロセスの cwd を読む関数がある**（`readlink("/proc/<pid>/cwd")`。
  `packages/server/src/platform/LinuxProcessInspector.ts:65`・`:120`）。対象はシェル自身ではなく**前面プロセスグループ**
  （tpgid を読む `readTpgid` `:43-57`、グループの全員を `/proc` の走査で集める `scanProcessGroupMembers` `:92-109`）。
  シェルがプロンプトで待っているときは tpgid がシェル自身なので、得られるのはシェルの cwd
  （実プロセスでの確認: `LinuxProcessInspector.integration.test.ts:8-28`）。
- **F2**: **Windows は cwd を読めない**（`WindowsProcessInspector` は常に `cwd: null`。`packages/server/src/platform/WindowsProcessInspector.ts:40`・`:49`）。
  **macOS 専用の inspector は無い**——win32 以外は `LinuxProcessInspector`（`packages/server/src/composeServer.ts:64-68`）で、
  macOS には `/proc` が無いので前面プロセスの検出を諦める（`LinuxProcessInspector.ts:24-27`）。
- **F3**: **シェルが出す OSC 7 を解釈している**（`packages/server/src/terminal/Mirror.ts:77-83` のハンドラ、`parseOsc7` `:185-193`、
  値は `cwdHint()` `:129-131`）。
- **F4**: **`Pane.cwd` は実行中に書き換わる。更新元は `AgentMonitor` だけ**。値は `leader?.cwd ?? host.mirror.cwdHint()`
  （`packages/server/src/agent/AgentMonitor.ts:171-173`・`:190`）→ `SessionService.updatePaneRuntime`（`packages/server/src/session/SessionService.ts:345-368`）
  → `SessionModel.updatePaneRuntime`（`packages/server/src/session/SessionModel.ts:466-477`）。
  判定の周期は、出力のあった pane が 500ms・無い pane が 1000ms（`AgentMonitor.ts:21-27`・`:137-142`）。
  cwd が変わったときだけ `pane.updated` を出して保存する（`SessionService.ts:353`・`:364-367`）。
  **Linux・WSL2 では `cd` から最大およそ 0.5〜1 秒遅れて反映される**（コードから導いた値。実測していない）。
  **Windows と macOS は OSC 7 を出すシェルのときだけ反映**（`docs/verification.md:145-149` が Windows の既知の制約として記録）。
- **F5**: 前面でプログラムが動いている間は、`Pane.cwd` はそのプログラムの cwd になる（`leader?.cwd`。推測: エージェントを起動した
  場所なので、ふつうはシェルの場所と同じ）。
- **F6**: **`Workspace.cwd` は作ったときに固定され、以後は更新されない**（書くのは `reserveWorkspace` `SessionModel.ts:162` と
  `restoreWorkspace` `:525` だけ）。**git の情報（`GitInfoPoller.ts:47`）と worktree（`WorktreeService.ts:72-75`）はこれを使う**。
- **F7**: シェルの pid はサーバが持っている（`TerminalHost.pid`。`packages/server/src/terminal/TerminalHost.ts:10`・`:72-73`）。

### いまの場所の決まり方と protocol（Q2）

- **F8**: `workspace.create` は `{ cwd?, label? }` で**場所を受け付ける**（`packages/protocol/src/messages.ts:61-64`）。
  `tab.create` は `{ workspaceId?, label? }` で**受け付けない**（`:83-86`）。`pane.split` は `{ paneId, direction, ratio? }` で**受け付けない**（`:104-108`）。
- **F9**: サーバ側: workspace は `cwd ?? this.defaultCwd`（`SessionService.ts:121-122`）、tab は `ws.cwd`（`:175-180`）、
  分割は `source.cwd`（`:235-245`）。**分割は F4 のとおり Linux では `cd` に追従する＝すでに「引き継ぐ」に近い**
  （単体テストは「分割元の cwd を引き継ぐ」ことだけを見ている `SessionService.test.ts:216-224`）。
- **F10**: `defaultCwd` は `process.cwd()`（`composeServer.ts:136`）＝サーバを起動した場所。起動オプションに cwd 系は無い
  （`packages/server/src/config.ts:13-23`・`packages/server/src/cliArgs.ts:44-67`）。
- **F11**: ホームディレクトリ（`os.homedir()`）はサーバが 2 か所で使っている（`config.ts:39`・`:42`、`WorktreeService.ts:17-19`）。
  **利用者が入れたパスの `~` を展開する先例は無い**。

### 無い場所で開こうとしたら（Q3）

- **F12**: **渡された場所の検証は無い**（`createWorkspace`・`createTab`・`splitPane`・`spawnForPane` のどれも `stat` しない）。
- **F13**: 無いディレクトリで pty を起動すると、Linux・macOS は子プロセスの `chdir` が失敗して `_exit(1)`
  （node-pty の `src/unix/pty.cc:457-461`・`spawn-helper.cc:17-18`）→ `spawnForPane` の 300ms の猶予の中で終了を受けて失敗
  （`SessionService.ts:29`・`:410-419`・`:493-514`）→ **`RpcError("spawn_failed")` で作成そのものが失敗**（workspace `:133-136`・
  tab `:181-183`・分割 `:239`）。web は「workspace を作成できませんでした」等を出す（`ActionDispatcher.ts:446`・`:183`・`:311`）。
  Windows も `CreateProcessW` の失敗で同様（推測）。
- **F14**: サーバからクライアントへ「別の場所で開いた」を伝える口は無い（汎用のイベントは `client.error` だけ。`packages/protocol/src/events.ts:64`）。
  伝えるなら応答の中身に足す必要がある。

### 「いま見ている pane」（Q4）

- **F15**: **web は各 pane の cwd を持っている**（`pane.updated` を反映。`packages/web/src/store/StoreAdapter.ts:108`。GotoPicker が表示
  `GotoPicker.vue:81-82`）。焦点の pane は**ブラウザごと**の `view.focusedPaneId`（`packages/web/src/store/view.ts`）。
- **F16**: **サーバはクライアントごとの焦点の pane を知らない**（`client.view` の params は `{ workspaceId, tabId, visible[] }`。
  `messages.ts:31-35`）。サーバの `SessionModel.focus`・`Tab.focusedPaneId` はサーバ全体で 1 つで、**pane のクリックでは変わらない**
  （`TerminalPane.vue:65`・`PaneFrame.vue:75` はローカルの `view.focusPane` だけ）——クライアントが見ている pane とずれうる。
- **F17**: web の要求の「元」: `newWorkspace` は何も渡さない（`ActionDispatcher.ts:435-448`）。tab の作成は `workspaceId` だけ
  （`:168-185`。入口は `prefix+c`・TabBar の［＋］`TabBar.vue:42`・tab の右クリック「新規」`ContextMenu.vue:66`——**右クリックした tab の
  workspace で、見ている workspace とは限らない**）。分割は `view.focusedPaneId`（`:295-298`）か右クリックした pane（`ContextMenu.vue:54-55`）。

### worktree（Q5）

- **F18**: worktree を開く経路は `workspace.create { cwd, label }`（`ActionDispatcher.ts:254-266` の `openWorkspaceAt`）。
  場所は git が記録したパス（`WorktreeService.ts:124-145`）。**「明示された場所」を見分ける材料は、いまは params に `cwd` があるかだけ**。

### herdr（Q6）

- **F19**: `new_cwd = "follow"`（既定）は元の pane か workspace を引き継ぎ、元が無ければ `$HOME`。`"home"`・`"current"`（herdr を起動した
  場所）・固定のパス。**CLI や API の `--cwd` の明示が勝つ**（`docs/next/website/src/content/docs/configuration.mdx:89-94`、
  `src/config/model.rs:220-241`）。herdr はこれを**サーバ側の設定**（`[terminal]`）として持つ（1 人で使う前提）。

### テスト（Q7）

- **F20**: E2E で `pwd` を打って場所を確かめる先例がある（`packages/e2e/src/specs/reconnect-restore.spec.ts:67-106`）。
  新しい pane にすぐ打つ先例も（`workspace-tab-pane.spec.ts:303-331`）。テストのクライアントから `cd` を送れる（`WtmTestClient.sendInput`）、
  `pane.updated` で `Pane.cwd` の反映を待てる（`wsClient.ts:169-192`）。**`cd` の後に新しい pane の場所を確かめる E2E はまだ無い**。
- **F21**: サーバの単体テストは偽の `TerminalManager` が起動の options（cwd を含む）を記録する（`SessionService.test.ts:54-66`）。
  本物の pty で起動失敗を確かめる先例（`composeServer.integration.test.ts:225-244`）、`/proc` の cwd を確かめる先例
  （`LinuxProcessInspector.integration.test.ts:8-28`。Linux 限定）がある。

## 影響範囲

- **protocol**: `tab.create`・`pane.split`（と `workspace.create`）の params と、応答に「別の場所で開いた」を載せるなら結果の型。
- **server**: `SessionService` の 3 つの作成、場所の検証、ホームの展開。いまの場所をその場で読むなら `ProcessInspector` に口を足す。
- **web**: 3 つの作成の要求（`ActionDispatcher`）、方針をブラウザで選ぶなら設定（`SettingsDialog`・`store/settings.ts`）。
- **文書**: `docs/herdr-parity.md:61`（H36）、`docs/verification.md`。

## 実現性 / リスク

- **反映の遅れ**（F4）: web が持っている `pane.cwd` を使うと、`cd` の直後（1 秒以内）に作ると古い場所で開く。サーバがその場で読めば
  Linux では遅れが無い（F1）が、macOS・Windows では OSC 7 頼みのまま（F2・F3）。
- **作成の失敗**（F13）: 使えない場所を渡すと作成そのものが失敗する。「開けなくなることは無い」（requirements）には、**サーバでの検証と
  代わりの場所**が要る。ただし worktree（F18）は明示した場所なので、**代わりの場所へ黙って回すと誤り**（worktree ではない場所に開いてしまう）。
- **焦点の食い違い**（F16）: 「いま見ている pane」を知っているのはブラウザだけ。サーバで方針を決めるなら、元の pane を要求に載せる必要がある。
- **tab の右クリック「新規」**（F17）は見ている workspace とは限らない——「その workspace の中で、いま見ている pane」が無い場合がある。

## 実装アンカー

- A1 workspace の作成（`packages/server/src/session/SessionService.ts:121-136`）
- A2 tab の作成（同 `:175-183`）
- A3 分割（同 `:235-245`）
- A4 起動と失敗（同 `:410-419`・`:493-514`。検証を差し込む位置の候補）
- A5 `defaultCwd`（`packages/server/src/composeServer.ts:136`）
- A6 protocol の params（`packages/protocol/src/messages.ts:61-64`・`:83-86`・`:104-108`）と結果の型
- A7 いまの場所を読む口（`packages/server/src/platform/ProcessInspector.ts:22-31`・`LinuxProcessInspector.ts:59-70`）
- A8 `Pane.cwd` の更新（`packages/server/src/agent/AgentMonitor.ts:166-192`）
- A9 web の 3 つの作成（`packages/web/src/actions/ActionDispatcher.ts:435-448`・`:168-185`・`:301-313`）
- A10 worktree を開く（同 `:254-266`。明示した場所のまま）
- A11 設定（`packages/web/src/components/SettingsDialog.vue`・`packages/web/src/store/settings.ts`）
- A12 文書（`docs/herdr-parity.md:61`・`docs/verification.md`）

## 実装時の注意

- **`Workspace.cwd` を書き換えない**（F6）——git の情報と worktree がそれを「その workspace のリポジトリ」として使っている。
  新しい tab を別の場所で開いても、workspace の場所は作ったときのまま。
- **E2E で `cd` の後に作るときは `pane.updated` を待つ**（F4 の遅れ）。待たないと、古い場所で開いて落ちる（競走）。
- worktree を開く経路（F18）は、方針の影響を受けない形にする。
- テストの偽物は実物の制約に合わせる（例: 無い場所で起動すると失敗する）。

## design への申し送り

- **方針をどこで持つか**: (a) ブラウザごとの設定（この work の直前の work と同じ流儀。設定の「端末」の節）——ブラウザが方針と元の pane を
  要求に載せる。(b) サーバの起動時の指定（herdr と同じくサーバ側）——要求に元の pane だけ載せる。**(a) なら「携帯ではホーム」のように
  ブラウザで変えられる**。どちらでも protocol に足すものは要る（F8・F16）。
- **いまの場所を誰が決めるか**: web が持っている `pane.cwd`（最大 1 秒遅れ）を送るか、サーバが作成の時点で読み直すか（Linux なら遅れ無し）。
- **検証と代わりの場所**: サーバで行う。**方針から決めた場所だけ**を代わりの場所へ回し、worktree の明示した場所は今までどおり失敗させる。
  「別の場所で開いた」は応答に載せ、**指定した場所の方針のときだけ**知らせる（requirements AC5・AC9）。
- requirements の AC9 は「使えないときはサーバを起動した場所」、AC5 は「以前と同じ場所（tab は workspace の場所）」で、代わりの場所が
  2 つある。**1 つにそろえるか**を design で決める（そろえるなら requirements を直す）。
- `~` の展開はサーバで（ホームを知っているのはサーバ。F11）。
