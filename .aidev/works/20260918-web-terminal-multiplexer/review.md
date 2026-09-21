# レビュー記録: 20260918-web-terminal-multiplexer（統合 review）

## ラウンド 1（2026-09-19・統合 review。独立レビューに委譲）

見たもの：親の tasks.md の割れ目と producer→consumer の契約・各 subtask の「未検証の穴」の照合・家族全体の差分。
`aidev coverage`：gaps=0（ac=23、design 23/23・tasks 23/23）。各 subtask の review で見たことは繰り返さない。

- [must][conv:-] 自動の再接続（切断・D102 の 503 からの再試行・再ログイン）でも DetachedView の「再接続」でも、新しい接続に表示と購読を張り直さない。サーバは接続ごとに新しい clientId を振り、購読・view・fit をそれに持つが、Web は `ViewSync.lastPayload` を接続をまたいで持ち同じ内容の `client.view` を送らず、`pane.subscribe` は xterm.js を新しく作ったときしか予約せず、`client.fit` は利用者の操作のときしか送らない。再接続の後は表示中の pane に OUTPUT も SNAPSHOT も届かず画面が止まる（入力だけは PTY に届く）。AC8 に反する。E2E の AC8 は新しいブラウザのコンテキストでしか確かめておらず、D95 の test は出力をテスト自身のクライアントで見ているので捉えられない — 根拠: packages/server/src/ws/WsGateway.ts:52; packages/web/src/term/ViewSync.ts:28,45-46; packages/web/src/term/TerminalRegistry.ts:69-79; packages/web/src/net/Connection.ts:178-186; packages/web/src/mobile/useFitToScreen.ts:63-66; design.md:777-778 → **03（と 04 の fit）**
- [must][conv:-] `SizeAuthority.onViewChanged` が、権限者のいない tab を fit していないモバイルにも渡す（`noteInteraction`・`transferOwnership` にある `kind==="desktop"||fit` の確認がここだけ無い）。デスクトップを閉じた後にスマートフォンで開くだけで PTY がスマートフォンの大きさに縮む。D13・design.md:673 に反する。D105 の E2E と背景の記述はこの違反を前提にしている — 根拠: packages/server/src/clients/SizeAuthority.ts:46-48; packages/e2e/src/specs/mobile.spec.ts:73; decisions.md D105 → **01（E2E の前提は 03 で直す）**
- [must][conv:-] `client.view`（サイズの申告）が表示領域の変化に追従しない。PaneLayout が commit するのは mount と自身の描き直しのときだけで、Web に resize／ResizeObserver の結線が無い。窓の大きさ・サイドバーの幅や折りたたみを変えても PTY は古い大きさのまま。モバイルでは ViewSync が縮小の枠（naturalSize×scale）の中の葉を測るので、2 回目以降の commit で fit 中は今のサーバの大きさをそのまま申告し「この端末に合わせる」が効かない。E2E の「サイズ変更への追従」は分割しか確かめていない — 根拠: packages/web/src/components/PaneLayout.vue:94-95,100; packages/web/src/term/ViewSync.ts:38; packages/web/src/mobile/MobileShell.vue:72-73,144-145 → **03（デスクトップ）・04（モバイルの測り方）**
- [should][conv:-] 有効な Cookie を持ったまま Origin/Host だけが許可外になる（`--origin` を付けずに再起動・転送した名前で開く）と、`/ws` は 403 で断るが `/api/session` は Origin を見ずに 204 を返すので、Web は「再接続中…」のまま理由を示さず再試行を続ける — 根拠: packages/server/src/ws/WsServerWs.ts:90; packages/server/src/http/HttpServer.ts:144-146; packages/web/src/net/Connection.ts:273-279; design.md:342 → **01（`/api/session` も Origin を見る）・03（理由の表示）**
- [should][conv:-] 親の test-result.md ラウンド6「未検証の穴」が docs/verification.md の手順で確かめるとしているのに、手順の無い項目がある（AC12 の再接続の後のソフトキーボード・隠れた pane の大きさ・ログイン画面、AC16 の Windows でのロックの判定・コンソールを閉じたとき・大文字のホスト名、AC17 の実機での計測の手順と合否の基準、M7、claude／codex 以外のエージェント）。「copy モードの一部の移動キー」は D63 で意図して実装していないので実機の確認の対象ではない — 根拠: docs/verification.md:70-73,91-115,207-265 → **05**
- [nit][conv:-] 同じ規則・契約を server と web で二重に持っている（レイアウトの隣と深さ優先の順・`/api/login` の状態コードの意味・ログインの制限の回数） — 根拠: packages/server/src/session/LayoutTree.ts:117-150 と packages/web/src/term/layoutOrder.ts:7-46 ほか → backlog へ
- [nit][conv:-] `LoginRateLimiter` と WsGateway の不正なフレームの窓が `Date.now()` のまま（D103 で LogThrottle と OriginRejectionLog は単調な時計に直した） — 根拠: packages/server/src/auth/LoginRateLimiter.ts:15; packages/server/src/ws/WsGateway.ts:145 → **01**
- [nit][conv:-] 02 の AgentMonitor が判定の失敗を pane ごと・周期ごとに間引かず error で書く（Windows で前面プロセスの取得が詰まり続けると server.log が伸び続ける） — 根拠: packages/server/src/agent/AgentMonitor.ts:145-147 → backlog へ
- [nit][conv:-] サーバが送る `client.error` の message は英語の固定文で、Web がそのまま toast に出す（1MB を超える貼り付けで「malformed frame」が見える） — 根拠: packages/server/src/ws/WsGateway.ts:151; packages/web/src/main.ts:72 → **03**
- [nit][conv:-] 利用者に説明済みとされた既知の制約（TCP の半開きの間は入力が黙って消える・IME の変換中の文字は新しい pane へ流す分として溜まらない）が docs に無い — 根拠: decisions.md D95・D99 → **05**

未検証の穴の照合：各 subtask の項目は、親の統合 test で閉じた（a）・読解で閉じた（b）・実機の確認に回した（c）のどれかに当たる。
ただし 04 の「transform: scale() のサイズの正確さ」は読解の結果、欠陥あり（上の must 3）。手順が無い c は上の should 2。

差し戻しの順：01 → 03 → 04 → 05（01 のサーバの振る舞いを 03 が前提にするため）。

## ラウンド 2（2026-09-20・ラウンド1 の差し戻し（01 T29・03 T33／T34・04 T9・05 T15／T16）の後。独立レビューに委譲）

ラウンド1 の must 3・should 2 と、直した nit（`client.error` の日本語化・単調な時計）は**すべて解消**（根拠は独立レビューの報告
のとおり——再接続の全経路で `client.view` →（fit）→ `pane.subscribe` を張り直す・`canDecideSize` が全経路に入った・デスクトップと
モバイルの両方が表示領域の変化に追従する・`/api/session` の 403 で黙って繰り返さない・実機の手順が揃った）。`aidev coverage`：gaps=0。

- [nit][conv:-] docs/verification.md「既知の制約」に、D110 の範囲外の 2 件（マウス報告を求めるアプリの上での Ctrl＋クリックの二重・モバイルには pane の枠が無い）が無く、backlog にしか無かった。M7 の確認の手順の途中で出会いうる — 根拠: docs/verification.md「既知の制約」 / 対応: 修正済（この review で 2 件を追記）
- [nit][conv:-] packages/web/src/net/Connection.ts 前段のプロキシが Host を書き換える構成で、サーバの起動の途中（`/ws` が 503）に開くと `rejected`（「`--origin` を加えて」）と誤った理由を出す（「再試行」で回復する狭い経路。403＋503 の切り分けが無い） — 根拠: packages/web/src/net/Connection.ts:346-351,366-368; packages/server/src/ws/WsServerWs.ts:88-96 / 対応: backlog へ

- [nit][conv:-] packages/server/src/clients/SizeAuthority.ts 移譲先を選ぶ `lastInteractionAt`（`ClientRegistry` の `Date.now()`）だけが壁時計のまま（D103・D106 で他は単調な時計に移した） — 根拠: packages/server/src/clients/SizeAuthority.ts:136; packages/server/src/clients/ClientRegistry.ts:78 / 対応: backlog へ（walkthrough.md の作成中に発見）

判定：must・should なし。レビュー補助として `walkthrough.md` を作る（差分が大きく、責務が複数パッケージにまたがるため。
protocol.md「レビュー補助の3条件」の 1・2 に該当）。
