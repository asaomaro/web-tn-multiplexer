---
backlog: product-roadmap
kind: split
parent: 20260918-web-terminal-multiplexer
---

# product-roadmap

<!-- 項目は行頭の `- [ ]` で書く（見出しに書くと aidev status の未着手件数から漏れる） -->
- [ ] 外部操作 API / CLI: herdr の socket API / CLI 相当（workspace 作成・分割・入力送信・出力読取・状態購読を外部から） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] キーバインドのカスタマイズ: 割り当ての変更・保存、herdr 互換以外のプリセット (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [x] Git worktree の作成と一覧（上の項目のうち worktree そのものを扱う部分）: 20260920-git-worktree-actions で対応。
      workspace の右クリックメニューに「新しい worktree」「worktree を開く…」、キーは `prefix+G`。
      作成先は `~/.wtm/worktrees/<repo>/<branch-slug>`（`packages/protocol/src/worktreePath.ts:37-41`）。
      失敗は 6 つのコードに分類して日本語にする（`packages/web/src/net/clientError.ts:19-25`）。
      実測: 実装 36 ファイル・単体 1161 件 / E2E 69 件 pass。**削除とグループ化は下の行に残っている**
- [ ] workspace のグルーピング: herdr 同等の Git worktree グループ＋利用者による任意の束ね、workspace・tab の並べ替え〔D6〕。
      **worktree の作成・一覧は 20260920-git-worktree-actions で済んだので、残りはグループ化と並べ替え** (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] D&D による pane の分割 / 分割解除 / 移動（Web 固有の操作） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] エージェント対応の拡充: 主要数種以外の検出、herdr の integrations / plugins 相当 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] 複数ホストの集約: herdr の remote / several machines 相当。複数ホストのセッションを 1 画面に (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] ノードによるオーケストレーション: セッションをノード表示し、マウスで繋いで状態トリガ・出力受け渡し・監督関係を設定（外部操作 API の後） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [x] 通知: 完了・入力待ちのアプリ内トースト / OS 通知 / 音、通知の対象への移動（herdr prefix+o）:
      20260920-agent-notifications で対応。エージェントが**入力待ち**になった／**完了**したとき、
      利用者の状態に応じて 3 経路を使い分ける（フォーカス無し→OS 通知・音・トースト／
      フォーカス有りで pane 非表示→トーストだけ／見ている pane→何も出さない。
      `packages/web/src/notify/policy.ts` の `routesFor`）。待ち行列は最大 8 件で
      `prefix+o`・トーストの［移動］・OS 通知のクリックから対象へ移れる。
      設定はサイドバーのメニュー・モバイルの上部バー・`prefix+s` の 3 入口。
      実測: 実装 30 ファイル・単体 1359 件 / E2E 76 件 pass。
      **PWA 化（ページを閉じている間の通知）・通知音の差し替え・エージェントごとの音は下の行に残っている**
- [ ] 通知の残り: **PWA 化**（Service Worker ＋ Push。ページを閉じている間の通知）／
      通知音の差し替え（herdr の `ui.sound.path` 等）／エージェントごとの音の入切
      （herdr の `ui.sound.agents.<agent>`）／通知の履歴の一覧（出典: .aidev/works/20260920-agent-notifications/requirements.md の対象外）
- [ ] 外観と設定: テーマと明暗の切替、サイドバー行のカスタマイズ、tab バーの状態表示、pane の枠の設定、設定画面・再読み込み〔D8〕 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
- [ ] セッション永続化の拡張: 画面履歴の保存と再生（opt-in）、エージェントの会話の再開、名前付き session、更新時の引き継ぎ〔D8〕 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
- [ ] 端末機能の拡張: 端末内の画像表示、スクロールバックを $EDITOR で開く〔D8〕 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
- [ ] 配布と運用: 自己更新・更新チャネル、ログ、シェル補完〔D8〕 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
- [ ] 規則・契約の一元化: レイアウトの隣と深さ優先の順・`/api/login` の状態コードの意味・ログインの制限の回数を `@wtm/protocol` に置き、server と web の二重持ちをなくす (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/review.md 統合 review ラウンド1 の nit）
- [ ] AgentMonitor の判定の失敗のログを間引く（`LogThrottle`。Windows で前面プロセスの取得が詰まり続けると server.log が伸び続ける） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/review.md 統合 review ラウンド1 の nit）
- [ ] SNAPSHOT で端末のモードを戻す: サーバの Mirror が parser のハンドラでカーソルの表示（?25）・SGR のマウス報告（?1006）・スクロール領域（DECSTBM）・カーソルの形（DECSCUSR）を追い、SNAPSHOT の末尾に足す（`@xterm/addon-serialize` 0.14.0 は出さない。再接続・新しいページで動いている TUI が崩れうる） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/decisions.md D107）
- [ ] モバイルの fit の状態の持ち方: (1) fit の有無を `MobileShell` の中に持つので、幅でデスクトップの本体へ替わってから戻るとボタンは押していない表示に戻るが、サーバでは fit が有効のまま。(2) fit 中に別のクライアントが操作で権限を取り返すと、`scale` が fit の有無だけで決まるためモバイルは等倍のまま描いてはみ出す（権限の有無を見て縮小に戻す） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/decisions.md D108）
- [ ] タブレットの扱い: タッチが主で幅 768px 以上の端末はデスクトップの画面になるが、種別が mobile なので PTY の大きさを決められず「この端末に合わせる」も無い（AC12 はスマートフォンが対象。タブレットをデスクトップ扱いにするか、fit のボタンを出すかの判断が要る） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/decisions.md D109）
- [ ] マウスの細部: (1) アプリがマウス報告を求めている pane で Ctrl＋クリックすると、リンクを開くのと同時に Ctrl 付きの左クリックの報告もアプリへ届く（design に定め無し）。(2) モバイルには pane の枠が無いので、「pane に送る」にした pane でマウスを使うアプリが動いている間はスマートフォンからその pane のメニューを開けない (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/decisions.md D110）
- [ ] 拒否の理由の取り違え（狭い経路）: 前段のプロキシが Host を許可外の名前に書き換える構成（`--origin` は正しい）でサーバを起動し直すと、`/api/session` は Host で 403・`/ws` は起動の途中の 503 になり、Web が `rejected`（「`--origin` を加えて起動し直してください」）を出す。既にその `--origin` は付いているので理由が誤り（「再試行」で回復する）。403＋503 の切り分けを足す (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/review.md 統合 review ラウンド2 の nit）
- [ ] サイズ権限の移譲の時計: `SizeAuthority.transferOwnership` が `lastInteractionAt`（`ClientRegistry` の `Date.now()`）の降順で移譲先を選ぶが、D103・D106 でログの間引き・ログイン制限・不正フレームの窓を単調な時計に移した後も、ここだけ壁時計のまま（時刻が巻き戻ると「最後に操作した人が勝つ」が反転しうる） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/walkthrough.md 作成時の発見）
- [ ] E2E の観測点をブラウザ側にそろえる共通部品: support/frames.ts の CDP／中継と panes.ts の client.view 観測を入口 1 つに整理し、spec がテスト自身の WebSocket クライアントだけで合否を決められないようにする（条項 e2e-observe-browser の実装面）（出典: .aidev/works/20260918-web-terminal-multiplexer/retro.md）
- [ ] pnpm のスクリプトを「失敗が見える」形にする: pnpm -s の再帰実行は失敗時に何も出力せず終了コードだけが変わる。ルートの script か CI の呼び出しで出力と終了コードを必ず残す（この work で誤った結論を decisions.md に書き、後で訂正した）（出典: .aidev/works/20260918-web-terminal-multiplexer/retro.md）
- [ ] AC17 の実機計測の結果を反映する: GPU のある実機で大量出力中の 16 pane を測り直し、合否を決める。D98 の閾値（2MB / 256KB）の見直しを含む（出典: .aidev/works/20260918-web-terminal-multiplexer/retro.md）
- [ ] 配色トークンの衝突を解く: --wtm-menu-border と --wtm-menu-active-bg がどちらも #44475a。(1) 選択中の pane の枠（2px の線）と地色 --wtm-bg(#1e1f29) の輝度比が約 1.8:1 で非テキストの目安 3:1 を下回る。(2) spaces 区画の最後の行が表示中のとき、行の背景と .sidebar-agents の border-top が同色で区切り線が消える。直すときは :focus-visible の outline-offset:-1px が選択線の内側 1px に重なる点も一緒に見る（出典: .aidev/works/20260920-ui-selection-visuals/design.md）
- [ ] xterm.js のカーソルの描き方を決める: cursorStyle / cursorInactiveStyle をリポジトリで一度も設定しておらず（TerminalRegistry.ts の new Terminal）、フォーカスの無い pane のカーソルの見え方が xterm.js の既定任せ（出典: .aidev/works/20260920-ui-selection-visuals/design.md）
- [ ] mobile.spec.ts の D105 が一式で走らせると落ちる（単独では通る）: 分割後に隠れた pane の rows が 41→38 に変わる。負荷でタイミングが変わると現れる競合で、20260918 の着手前コードでも一式では落ちる。E2E 一式が安定して緑にならない原因（出典: .aidev/works/20260920-ui-selection-visuals/decisions.md）
- [ ] サイドバーの帯を下端に固定する: 行が多いと .sidebar-section-footer（新規・メニュー）が画面外へ流れ、「一度折りたたむ」以外に到達できないことがある（.sidebar-footer の折りたたみボタンは margin-top:auto で常に見える）。固定するには .sidebar の overflow-y を内側の入れ物へ移す必要があり、それは 20260920-ui-selection-visuals の AC3 の判定（.sidebar の scrollWidth）を空振りにするので、判定の作り直しと同時に行う（出典: .aidev/works/20260920-sidebar-tabbar-controls/design.md）
- [ ] worktree の削除（git worktree remove）: 作成と一覧だけ実装したので、UI から片付けられない。時間切れ等で登録だけ残った中途半端な worktree も消せない（WorktreeService.ts:10 に対象外と明記）（出典: .aidev/works/20260920-git-worktree-actions/decisions.md）
- [ ] worktree の作成先を設定できるようにする: いまは ~/.wtm/worktrees 固定で、DefaultWorktreeService は root を受け取れるのに composeServer.ts:141 が渡していない。herdr の worktrees.directory 相当。E2E から逃がせないため spec 側で後片付けしている（D7）（出典: .aidev/works/20260920-git-worktree-actions/decisions.md）
- [ ] E2E が古いビルドを見る: pnpm -C packages/e2e test は再ビルドせず、@wtm/server の dist と packages/web/dist を読む。直さずに走らせても通ったように見える。test スクリプトか CI で build を前置する（D8）（出典: .aidev/works/20260920-git-worktree-actions/decisions.md）
- [ ] workspace のメニューをキーボードから開く: Sidebar.vue の行に tabindex も keydown も無く、右クリック（マウス）でしか開けない。pane の枠だけ PaneFrame.vue で対応済み。「worktree を開く…」がキーだけで到達できない原因（AC-I3 の制限）（出典: .aidev/works/20260920-git-worktree-actions/decisions.md）
- [ ] Connection がエラーコードをプロパティで持つ: いまは new Error(`<code>: <message>`) の文字列で、web は書式を正規表現で読む（errorCodeOf）。書式が変わると黙って汎用の文言に落ちる（D4）（出典: .aidev/works/20260920-git-worktree-actions/decisions.md）
- [ ] Workspace.git の即時化: GitInfoPoller が 5 秒周期なので、workspace を作った直後は最大 5 秒 git が null で、メニューに worktree の項目が出ない（D3）（出典: .aidev/works/20260920-git-worktree-actions/decisions.md）
- [ ] 既読（wtm.seen.v1）の意味論を直す: markVisibleAgentsSeen はウィンドウにフォーカスがあれば pane の表示を見ずに全 pane を既読にする（main.ts の「意図的な簡略化」）。結果、フォーカス中は displayStateFor が done を返せず、通知は「完了しました」と言うのにサイドバーに印が無い。正しい規則 shouldMarkSeen(paneVisible, windowFocused) は本番から一度も呼ばれていない。20260920-agent-notifications が TerminalRegistry.isVisible を足したので、結線できる前提が揃った（出典: .aidev/works/20260920-agent-notifications/decisions.md）
- [ ] E2E 一式の安定性: 4 回走らせて 2 回、別々の spec が負荷で落ちた（workspace-tab-pane の時間切れ・mobile の D105）。どちらも単独では通る。先行 work から続く課題で、通知の 7 本が加わって所要が延びている。workers や timeout の見直し、または重い spec の分離（出典: .aidev/works/20260920-agent-notifications/decisions.md）
- [x] サイドバー幅・折りたたみ状態を保存する: UI は既にある（ドラッグで変えられる・prefix+b で畳める）のに ref() に置いているだけで、再読み込みのたびに 240px・展開に戻る。herdr は preferences に保存している。既存の wtm.prefs.v1 に 2 フィールド足すだけで済む（herdr 設定調査で投資対効果が最も高いと判断）（出典: .aidev/works/20260920-agent-notifications/research.md）
  → 着地: 20260921-herdr-settings-gaps（feature/herdr-settings-gaps）。`wtm.prefs.v1` に `sidebarWidth`・`sidebarCollapsed`（`packages/web/src/store/view.ts` の `loadSidebarWidth`・`commitSidebarWidth`・`toggleSidebar`）。ドラッグ中は書かず、終えたとき（`pointerup`・`pointercancel`・`lostpointercapture`・ダブルクリック・ダイアログが開いたとき）に 1 回だけ保存（`Sidebar.vue` の `endDrag`）。E2E `settings.spec.ts` の AC1・AC2（`storageState` を持ち越した新しい context で幅と折りたたみが戻る）
- [x] ブラウザから別のリポジトリの workspace を作れるようにする: 全 workspace がサーバの process.cwd() 固定で、web は workspace.create に cwd を送っていない。herdr の terminal.new_cwd 相当。設定というより機能の穴で、複数リポジトリを並行して見る使い方を塞いでいる（出典: .aidev/works/20260920-agent-notifications/research.md）
  → 着地: 20260921-new-terminal-cwd（feature/new-terminal-cwd）。既定は herdr と同じ「引き継ぐ」で、新しい workspace・tab・分割がいま見ている pane の、いまの場所（Linux は前面プロセスの cwd を読み直す）で開く。ホーム・起動した場所・指定した場所をブラウザごとに選べる（設定の「端末」）。規則は `packages/server/src/session/newCwd.ts` の `resolveNewCwd`、要求は `packages/web/src/actions/ActionDispatcher.ts` の `newCwdFor`。E2E `new-terminal-cwd.spec.ts`（`cd` → 新しい tab・分割・workspace → `pwd` をブラウザが受けたフレームで読む）。workspace の名前が一律「1」で見分けにくい件は別の項目に起こした
- [x] エージェントの状態表示を記号でも区別できるようにする: いまは色の点だけなので、色覚特性のある利用者に状態が読めない。herdr の ui.status_indicators = symbols 相当（blocked/working/done/idle/unknown に別々の字形）（出典: .aidev/works/20260920-agent-notifications/research.md）
  → 着地: 20260921-herdr-settings-gaps（feature/herdr-settings-gaps）。字形は herdr の `symbols` と同じ × ◐ ✓ ○ ·（`packages/web/src/store/stateIndicator.ts`）を色と併記し、読み上げの名前も付けた（`components/StateIcon.vue`。3 か所の複製を 1 部品に寄せた）。**既定は「入」で herdr（`dots`）と逆**（WCAG 1.4.1。同 work の decisions D1）。blocked と idle の色は 1.4.11 の 3:1 のため明るくした（D6。選択行の背景で 3.36・3.32）。E2E `settings.spec.ts` の AC5〜AC8
- [x] scrollback をクライアント側から設定できるようにする: いまは --scrollback でサーバ起動時にしか決められず、モバイルは 1000 行にハードコード。「このブラウザだけ長く持ちたい／スマートフォンでは軽くしたい」に応えられない（出典: .aidev/works/20260920-agent-notifications/research.md）
  → 着地: 20260921-herdr-settings-gaps（feature/herdr-settings-gaps）。`packages/web/src/term/scrollback.ts` の `effectiveScrollback`（「自動」は以前の値＝デスクトップはサーバの上限・モバイルは 1000、数を選べばサーバの上限で押さえる）と設定ダイアログの「端末」の節（`SettingsDialog.vue`）。モバイルの 1000 固定は「自動」のときだけになった。E2E `settings.spec.ts` の AC9（選んだ後に開いた pane が 1,000 行を求める）・AC11（iPhone 13 で 5,000 行を選ぶと開き直した pane が 5,000 行を求める）
- [ ] E2E の偽エージェントを support へ切り出す: 入力待ちの画面を出す偽のエージェント（exec -a claude と画面の文言）が agent-detection.spec.ts・notifications.spec.ts・settings.spec.ts の 3 か所に複製されている。判定ルール（herdr の toml）が変わると 3 か所を直すことになる。安定している 2 本の spec を書き換えるので、20260921-herdr-settings-gaps の範囲からは外した（出典: .aidev/works/20260921-herdr-settings-gaps/review.md）
- [x] workspace の既定の名前をリポジトリ名（git でなければフォルダ名）から自動で付ける: 今はどこで開いても一律に「1」で、別のリポジトリで開いた workspace がサイドバーで見分けられない。herdr は repo 名か cwd のフォルダ名を自動の名前にし（src/workspace.rs の display_name・automatic_workspace_label。名前を変えた後は変えた名前のまま）、cwd が変われば追従する。worktree を開く経路が label を明示しているのはこの穴への個別の手当て（出典: .aidev/works/20260921-new-terminal-cwd/review.md）
  → 着地: 20260921-workspace-auto-label（feature/workspace-auto-label）。名前を付けていない workspace を、開いた場所のリポジトリの根のフォルダ名（git の外ならフォルダ名・ホームなら `~`）で呼ぶ。規則は `packages/server/src/session/workspaceLabel.ts`（herdr の `git_repo_root` 等を移植。git のコマンドは使わない）、自動か付けたものかは `Workspace.autoLabel`。名前を空にして確定すると自動に戻る（herdr に無い）。`cd` への追従は別の項目に起こした。E2E `workspace-auto-label.spec.ts`（ほかのブラウザが受けた `workspace.created` の名前が最初から根の名前）
- [ ] workspace の名前と git の情報を、最初の pane のいまの場所に追従させる: 自動の名前（20260921-workspace-auto-label）とサイドバーの git の情報（GitInfoPoller）はどちらも workspace を開いた場所（Workspace.cwd）から決めていて、cd しても変わらない。herdr は最初の tab の根の pane のいまの場所から名前と git の状態を決め直す（src/workspace.rs の display_name_from_terminals）。名前だけ追従させると git の情報と食い違うので、両方をまとめて扱う（出典: .aidev/works/20260921-workspace-auto-label/requirements.md）
