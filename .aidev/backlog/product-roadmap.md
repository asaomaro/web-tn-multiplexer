---
backlog: product-roadmap
kind: split
parent: 20260918-web-terminal-multiplexer
---

# product-roadmap

<!-- 項目は行頭の `- [ ]` で書く（見出しに書くと aidev status の未着手件数から漏れる） -->
- [ ] 外部操作 API / CLI: herdr の socket API / CLI 相当（workspace 作成・分割・入力送信・出力読取・状態購読を外部から） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [x] キーバインドのカスタマイズ: 割り当ての変更・保存（prefix の変更・操作ごとの割り当て・prefix なしの直接のキー）（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
  → 着地: 20260921-keybinding-customization（feature/keybinding-customization）。prefix と 34 の操作の割り当てを、設定画面の節「キー」で**押したキーを取り込んで**変えられる
  （`packages/web/src/components/KeySettings.vue`）。1 つの操作に複数持てて、prefix の後のキーに加えて**直接のキー**（`ctrl+alt+d` のように prefix なしの 1 打。terminal モードだけ。
  `packages/web/src/keys/KeyRouter.ts` の `handleDirect`）も付けられる。衝突・予約・使えない形は理由を出して拒否（`packages/web/src/keys/assign.ts` の `validateAssignment`）、
  保存はブラウザごとに既定との差だけ（`wtm.prefs.v1` の `keys`。`packages/web/src/keys/keyPrefs.ts`）で、壊れた値は値ごとに落として既定へ戻す。キー一覧・トースト・通知の案内文・
  モバイルの Prefix ボタンは同じ解決した表（`packages/web/src/keys/keymap.ts` の `resolveKeymap`）から作り、herdr の `ctrl+alt` の一式も 1 操作で足せる。既定のままなら
  今までのキー操作は変わらない（旧 `DEFAULT_KEYMAP` を固定した値との 1:1 を単体テストで守る。例外は decisions D8 の CapsLock＋Shift）。サーバ・protocol は変えていない。
  実測: 単体（全パッケージ）2138 本・E2E 一式 116 本（うち `key-bindings.spec.ts` 14 本・`settings.spec.ts` 11 本）・smoke pass。回帰テストは変異で落ちることを確かめ、生出力を `.aidev/works/20260921-keybinding-customization/test-result.md` に貼った（AltGr の判定は 97 個の変異を網羅）。独立 review 3 ラウンド（must 0・should 4・nit 9 を解消。差し戻しは上限の 3 回）。herdr 互換以外のプリセットは下の別の行に残した
- [ ] キーバインドのプリセット（herdr 互換以外）: tmux 風などの割り当ての一式を選べるようにする。20260921-keybinding-customization で割り当ての変更・保存は済んだので、残りはプリセット（herdr の既定・herdr の文書の
  `ctrl+alt` の直接のキーの一式〔いまは「足す」ボタン〕に加え、tmux 風の `%`・`"`・`o`・`x` 等）。プリセットは `keys/bindings.ts` の `ActionDef.defaults` と同じ形の表で持てる（出典: .aidev/works/20260921-keybinding-customization/requirements.md の対象外）
- [ ] navigate モードの移動キーを変えられるようにする: herdr の `navigate_workspace_up/down`・`navigate_pane_left/down/up/right`（prefix なしの素のキーを書ける別の表。`esc`・`enter`・`tab`・左右の矢印・素の `1`〜`9` は予約）。
  いまの navigate・resize・copy モードの中のキーは固定（`NavigateMode.ts`・`ResizeMode.ts`・`CopyMode.ts`）。herdr でも copy・resize の中は固定なので、対象は navigate の 6 キー（出典: .aidev/works/20260921-keybinding-customization/requirements.md の対象外）
- [ ] herdr にあって本製品に操作自体が無いものを足して割り当てられるようにする: **既定なし**の操作——前後の workspace への移動（`previous_workspace`・`next_workspace`）・直前の pane（`last_pane`）・
  tab の並べ替え（`move_tab_previous/next`）・pane の resize の直接のキー（`resize_pane_*`。`resizeBy` の操作は既にある）・agent への移動（`previous_agent`・`next_agent`・`focus_agent`）。
  **既定を持つ**操作——scrollback を `$EDITOR` で開く（`edit_scrollback`＝herdr の既定 `prefix+e`）・設定の再読み込み（`reload_config`＝`prefix+shift+r`）は、いま「後続」の案内としてそのキーを使っている
  （`packages/web/src/keys/keymap.ts` の `NOT_YET_BINDINGS`）ので、実装したら**その案内を置き換える**。**実装の本体は別の行**（`edit_scrollback` は「端末機能の拡張」・`reload_config` は「外観と設定の残り」の設定の再読み込み）で、
  この行は「キーの割り当てに載せる分」だけ（同じ機能を 2 行で掴まない）。操作を足す work であって、割り当てを変える work ではない（出典: .aidev/works/20260921-keybinding-customization/requirements.md の対象外）
- [ ] 独自コマンドのキー: herdr の `[[keys.command]]`（`type` が `popup`・`pane`・`shell`・`plugin_action`）。サーバで任意のコマンドを走らせる仕組みと、その権限の設計が要る。`docs/herdr-parity.md` の H12（ポップアップ端末・独自コマンドのキー割り当て）（出典: .aidev/works/20260921-keybinding-customization/requirements.md の対象外）
- [ ] サイドバー・tab バーのボタン（`@keydown.stop`）や pane の枠にフォーカスがある間も、prefix・直接のキーを効かせる: いまはそのボタンにフォーカスが残ると、端末をクリックするまで届かない（prefix でも同じ既存の挙動）。
  ボタンの Enter/Space と入力欄への入力を守ったまま、修飾キー付き・prefix のキーだけを window へ通す形が要る（出典: .aidev/works/20260921-keybinding-customization/decisions.md D11）
- [ ] キーの設定の使い勝手: 節「キー」の操作の絞り込み（いまは 34 個の `<details>` を順に開く）、衝突したときの「こちらへ移す」、macOS の非 US 配列で Option の chord の表示を押した字に合わせる
  （`navigator.keyboard.getLayoutMap()`。Chromium 系だけ。decisions D7）、ブラウザが先に受けるキーを全画面のときだけ届ける（Keyboard Lock API。実験的。research F27）（出典: .aidev/works/20260921-keybinding-customization/decisions.md の D7・research.md の F27。操作の絞り込みと「こちらへ移す」は、この work の実装で出た改善案）
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
- [x] 外観と設定: テーマと明暗の切替〔D8〕（出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
  → 着地: 20260921-theme-settings（feature/theme-settings）。herdr の組み込みテーマ 17 種（`terminal` を除く）をブラウザごとに選べ、OS の明暗
  （`prefers-color-scheme`）に合わせて「明るいとき」「暗いとき」のテーマへ自動で切り替える。1 つのテーマが画面の枠（CSS 変数。`packages/web/src/theme/uiTokens.ts`）と
  端末の配色（`packages/protocol/src/theme.ts` の `TERMINAL_PALETTES`）の両方を決め、端末の中のアプリの色の問い合わせ（OSC 10/11/12/4）には tab の大きさを
  決めているブラウザのテーマで答える（`packages/server/src/clients/answerPalette.ts`）。最初の描画は `packages/web/public/theme-boot.js`。画面の枠の色は
  17 テーマとも WCAG のコントラスト（文字 4.5・状態の記号 3 等）を満たすよう寄せ、単体テストで総当たり。既定は今までと同じ Dracula。
  実測: 単体 protocol 57・server 616・web 1203 本、E2E `theme-settings.spec.ts` 8 本（ほかの影響を受ける spec を含め一式で確認）。
  色の個別の上書き・明暗の変化をアプリへ知らせる（DSR 996・mode 2031）・選択の背景の見やすさは下の別の行に起こした
- [x] 外観と設定の残り: サイドバー行の並び替え（開いた順/名前順）、tab バーの自動非表示・現在時刻表示、
  pane の枠・隙間の太さとエージェント名表示、設定の再読み込み（`prefix+shift+r`）〔D8〕
  (needs: 20260918-web-terminal-multiplexer)（20260922-appearance-settings-rest。
  `packages/web/src/components/Sidebar.vue:155-161`・`packages/web/src/components/TabBar.vue`・
  `packages/web/src/components/PaneFrame.vue:107-137`・
  `packages/web/src/actions/ActionDispatcher.ts` の `reloadConfig()`。
  `docs/herdr-parity.md` H21・H22・H23・H25b。実測: unit 1504 本 green、
  E2E `appearance-settings.spec.ts` 新規6本＋既存 spec 6ファイルの回帰修正
  （最後まで安定した完走は未確認——test-result.md「E2E について」参照）〔D8〕）
- [x] 外観と設定の残り（PR #12 から選択的に取り込み）: tab バーの位置（上/下）、右端の複数エントリ
  （拡大の状態・ホスト名・日時4プリセット・固定文字列。最大16件・並び替え・区切り文字）、
  pane 領域の外周の枠〔D8〕(needs: 20260918-web-terminal-multiplexer)（
  20260922-appearance-settings-rest decisions.md [[D11]]。
  `packages/web/src/tabbar/tabBarRight.ts`（新規）・
  `packages/web/src/components/TabBar.vue`・`App.vue`・`SettingsDialog.vue`。
  旧「現在時刻の常時表示」はこの右端エントリ（日時）に統合された。
  実測: unit 1542 本 green（E2E は未実行——[[e2e-only-on-request]]。ユーザー方針で
  このラウンドでは回していない）。PR #12（`20260922-tabbar-pane-appearance`）は
  この取り込みと内容が重複するため close・branch 削除した）
- [ ] 外観と設定の残り（未着手分）: サイドバー行の色の条件付け・独自トークン（H21）、
  pane の枠の描画モード「自動」（分割時だけ表示）・隙間の入切（H23。`PaneFrame.vue` の
  「常に padding・太さ3段階」設計と両立しないため、`PaneLayout.vue` への手入れを伴う
  再設計が要る。PR #12 が持っていた設計〔`bordered`/`multiPane` prop を `PaneLayout.vue`
  経由で渡す〕が参考になる）、設定の onboarding（H25b）
  〔D8〕(needs: 20260918-web-terminal-multiplexer)（
  20260922-appearance-settings-rest の requirements「対象外」／decisions.md [[D11]]で切り出し。
  出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
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
- [ ] テーマの色の個別の上書き: herdr の `[theme.custom]`（`accent`・`panel_bg`・`sidebar_bg`・状態の色など）と明暗別の `[theme.custom.light]`/`[theme.custom.dark]`。herdr でも設定ファイルでだけ変えられる。本製品には利用者が書く設定ファイルが無いので、設定の再読み込み（H25b）と合わせて置き場所から決める（20260921-theme-settings の対象外）（出典: .aidev/works/20260921-theme-settings/requirements.md）
- [ ] 明暗の変化を端末の中のアプリへ知らせる: DSR 996（`CSI ? 996 n` → `CSI ? 997 ; 1|2 n`）への応答と mode 2031 の通知（herdr の `src/terminal_theme.rs` の `HostAppearance::color_scheme_report`）。サーバの Mirror が、その pane の tab の大きさを決めているブラウザのテーマの明暗で答え、テーマや OS の明暗が変わったら通知する。いまは応えていない（20260921-theme-settings の対象外）（出典: .aidev/works/20260921-theme-settings/requirements.md）
- [ ] 端末の選択の背景を見えるようにする: 上流の配色の選択の背景と端末の背景の比が低いテーマがあり（one-light 1.11・solarized-light 1.14・solarized 1.15・rose-pine-dawn 1.27・one-dark 1.31）、copy モードやマウスで選んだ範囲がほとんど見えない。`finalizePalette`（packages/protocol/src/theme.ts）に「選択の背景を端末の背景から寄せる」規則を足す案。20260921-theme-settings では「上流の値のまま、選んだ文字とカーソルだけ直す」（decisions D5）の内側として見送った（出典: .aidev/works/20260921-theme-settings/review.md）
