---
backlog: product-roadmap
kind: split
parent: 20260918-web-terminal-multiplexer
---

# product-roadmap

<!-- 項目は行頭の `- [ ]` で書く（見出しに書くと aidev status の未着手件数から漏れる） -->
- [ ] 外部操作 API / CLI: herdr の socket API / CLI 相当（workspace 作成・分割・入力送信・出力読取・状態購読を外部から） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] キーバインドのカスタマイズ: 割り当ての変更・保存、herdr 互換以外のプリセット (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] workspace のグルーピング: herdr 同等の Git worktree グループ＋利用者による任意の束ね、workspace・tab の並べ替え〔D6〕 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] D&D による pane の分割 / 分割解除 / 移動（Web 固有の操作） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] エージェント対応の拡充: 主要数種以外の検出、herdr の integrations / plugins 相当 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] 複数ホストの集約: herdr の remote / several machines 相当。複数ホストのセッションを 1 画面に (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] ノードによるオーケストレーション: セッションをノード表示し、マウスで繋いで状態トリガ・出力受け渡し・監督関係を設定（外部操作 API の後） (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/requirements.md）
- [ ] 通知: 完了・入力待ちのアプリ内トースト / OS 通知（HTTPS・PWA 前提）/ 音、通知の対象への移動（herdr prefix+o）〔D8〕 (needs: 20260918-web-terminal-multiplexer)（出典: .aidev/works/20260918-web-terminal-multiplexer/research.md）
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
