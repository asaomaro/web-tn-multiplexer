# タスク: 05-e2e-docs（E2E・性能計測・docs）

## 実装方針

- architecture.md の申し送り 16 段階（「E2E（Playwright）・性能の計測（AC17）・docs（TLS・WSL2・検証手順）・
  3 OS の検証（AC16）」）のうち、**この subtask で作るのは自動化できる部分**（Linux で完結する E2E 一式と
  計測の仕組み、docs）。3 OS 横断の実施・実機（iOS Safari / Android Chrome）・別マシンからの TLS 接続は、
  親の統合 test の対象（親メタ tasks.md「テスト方針」）——このズレを毎タスクで意識する。
- E2E は新規パッケージ `packages/e2e` に置く（`server`/`web`/`protocol` と並列。design には未記載の追加判断——
  E2E は「Web に依存しない部品」でも「サーバの一部」でもなく、両者をビルドして結ぶ独立した検証層のため）。
  `smoke.ts`（01・03-web-desktop T26）と、03/04 の test 工程で書いた disposable script（実地の確認）の
  知見（実サーバの起動・ビルド済み web の配信・Playwright での操作）をそのまま土台にする——car 車輪の
  再発明をしない。
- design.md「受け入れ基準との対応」の AC ごとの記述（`design.md:659-721`）が、E2E が何を確かめるべきかの
  正典。各タスクの `AC:` 欄はこの記述と対応させる。
- AC15（herdr との対応表）は、research.md F7（49 項目の分類。H01〜H49）と design.md の「MVP の項目と AC の
  対応」表（`design.md:722-744`）が**既に**満たしている中身を、独立した docs の成果物として整形・検証する
  タスクを 1 つ置く（このタスクが無いと `aidev coverage` の AC15 が永遠に gap のまま——04-mobile の
  review で気づいた）。
- **偽のエージェント**（AC6/AC7 の E2E。design「AC6」の「Claude Code と Codex は実際に起動して」は親の
  統合 test の担当。この subtask では 02-agent-detection の `ManifestEngine` が実際に処理できる、実物と
  同じ形の画面（フィクスチャ）を pane に流し込んで 5 状態を再現する——02 の単体テストで使った fixture の
  流用を検討する）。

## 作業順序

1. T1（足場）を最初に作り、以降のタスクはこの上に E2E ファイルを積む（他は並行しても良い）。
2. AC17（性能計測）は E2E の型が固まってから（T2〜T5 のどれかで一度計測の書き方を確立してから）が良いので
   T9 に置く。
3. docs（T10〜T12）は実装に依存しないので、E2E の合間に進めても良い。

## リスク / 留意点

- **IME の自動化**：Playwright は実 OS の IME を経由しない（`page.keyboard.insertText` で `compositionstart`/
  `compositionend` を合成する必要がある）。xterm.js 側の実際の変換窓の見た目は自動化できない——
  自動テストは「合成中の文字が表示され、確定で PTY へ届く」までを確かめ、変換候補窓の見た目の確認は
  `docs/verification.md`（実機・手動）に回す。
- **性能計測の再現性**：CI や重い開発機では p95 50ms の絶対値が環境依存でぶれる。この subtask では
  「計測の仕組み」を作ることが目的で、**閾値超過を test の pass/fail に直結させない**
  （出力された数値を記録するだけ。合否判定は親の統合 test で環境を選んで行う）——04-mobile の
  test-result.md にならい、判断の理由を明記する。
- **Windows ConPTY 固有の挙動**（node-pty の既知の不具合。research.md F8.1）：この subtask は Linux 専用の
  検証なので対象外。`docs/verification.md` に Windows 実施時の既知の注意点として書き残す。
- **02-agent-detection の fixture 流用**：02 のフィクスチャが単体テスト専用の形（画面の断片）だった場合、
  E2E（実物の pane・PTY）で同じ画面を再現するには打ち込むコマンド（`printf` 等）に変換し直す必要がある
  ——着手時に 02 の該当テストを読んで確認する。

## テスト方針

- 05 自身の test 工程：**E2E そのものが成果物**（親メタ tasks.md）。`packages/e2e` の全 spec が
  ローカルの Linux で通ることを確かめる。加えて `pnpm -s typecheck && pnpm -s lint`。
- 性能計測（T9）は「動いて数値が出ること」を確かめるに留め、数値そのものの合否は問わない（上記リスク参照）。
- docs（T10〜T12）は「記載どおりに実行すれば成功する」ことを、可能な範囲で自分で辿って確認する
  （TLS は自己署名や mkcert のローカル発行まで、実際の別マシン接続は親の統合 test）。

## タスク

- [x] T1: `packages/e2e` の足場——Playwright（Chromium）・実サーバの起動とビルド済み web の配信・
      デスクトップ/モバイル（`devices["iPhone 13"]`）のフィクスチャ・後始末（サーバ停止・一時ディレクトリ削除）。
      `smoke.ts`・03/04 の disposable script の知見を移植する。
      AC: なし
      完了メモ: 新規パッケージ `packages/e2e`（`@wtm/e2e`）。`packages/server` は今まで CLI としてしか
      公開していなかったため、`src/testkit.ts`（`composeServer`/`ComposedServer`/`RawServeArgs`/
      `ServeOptions` のバレル）を追加し `package.json` の `main`/`types` をそこへ向けた（server 側の変更。
      design には無い追加判断）。`support/freePort.ts`（`smoke.ts` と同じ空きポート取得）・
      `support/wsClient.ts`（`smoke.ts` の 1 つの持続的な `message` ハンドラの形を踏襲した型付き WS
      クライアント。`request`/`waitForOutput` に加え、イベント（`{event,data}`）の `lastEvent`/
      `waitForEvent` を新設——AC17（状態反映の計測）・reconnect 系のテストで使う）・`support/appServer.ts`
      （1 テスト 1 サーバ。空きポート・専用の一時 state dir・ログイン済み cookie・`openClient()` で
      `client.hello` 済みの WS クライアントを返す）・`support/fixtures.ts`（`@playwright/test` の
      `test.extend` で `appServer` fixture を追加）。`playwright.config.ts` は `baseURL`/`webServer` を
      使わない（サーバは各テストが自分で起動するため）。**`vitest.config.ts`（`test.projects:
      ["packages/*"]`）が `.spec.ts` も拾ってしまうため**（vitest 5 の既定 include は
      `**/*.{test,spec}.?(c|m)[jt]s?(x)`。実測して確認）、`packages/e2e/vitest.config.ts` で
      `test.include: []` にして vitest の対象から外した。`smoke.spec.ts` で疎通を確認——**自分の WS
      クライアントで `pane.subscribe` を呼んでいない pane の OUTPUT は届かない**（ブラウザ側の購読とは
      別接続なので自動では見えない）ことをここで発見し、`wsClient.ts` の doc に明記した（以降の spec は
      この注意を踏まえて書く）。`pnpm -s typecheck && lint && test`（733 passed。vitest は不変）・
      `pnpm --filter @wtm/e2e test`（1 passed）を確認。
- [x] T2: AC1〜AC3 の E2E——workspace/tab/pane の作成・名前変更・切替・閉じる（確認ダイアログ含む）、
      分割・境界のリサイズ・方向でのフォーカス移動・巡回・入れ替え・拡大表示・resize モード。
      AC: AC1, AC2, AC3
      完了メモ: `packages/e2e/src/specs/workspace-tab-pane.spec.ts`（4 test）。実地の確認（実物の
      Chromium）で 2 件の実バグを発見・修正した（詳細は decisions.md D88・D89）：
      (1) `workspace.create`/`tab.create`/`tab.close` 系が `workspace.tabIds` の変化を伝える
      WebSocket イベント（`tab.created`・`workspace.updated`）の一部を出していなかった
      （`packages/server/src/session/SessionService.ts`。01-server-core 由来）。
      (2) `KeyInputController.handleTerminalKey` が `preventDefault()` を一度も呼んでおらず、
      prefix の2打目のキー（ほぼ全ての割り当てキー）がアクションとして処理されると同時に、
      素の文字としても端末へ入力されていた（`packages/web/src/keys/KeyInputController.ts`。
      03-web-desktop 由来）。
      どちらも `SessionService.test.ts`・`KeyInputController.test.ts` に回帰テストを追加。
      「境界のリサイズ」は `.splitter` をキーボード操作で動かし `layout.set_split_ratio` の反映を
      `layout.updated` で確認、「入れ替え」は巡回順（深さ優先の leaves）が入れ替わることで確認、
      「方向でのフォーカス移動」「巡回」はマーカー文字列を打って実際に届く pane で確認——いずれも
      DOM の見た目だけでなく、実際にどの pane が入力を受けているかを検証する形にした
      （`pane.created`/`layout.updated` の到着と、クライアント側の焦点の更新は非同期でずれうる
      ことを T2 で学んだ。decisions.md D89 の「教訓」参照）。
- [x] T3: AC4 の E2E——vim・htop を実際に起動して全画面 TUI の崩れが無いこと、256色/TrueColor、全角文字、
      IME（合成イベントの模擬）、マウス報告（アプリ側が受ける入力）、pane サイズ変更への追従。
      AC: AC4
      完了メモ: `packages/e2e/src/specs/terminal-app.spec.ts`（5 test）。htop はこの検証環境に無く
      （`apt-get` に sudo が要り即時導入できない）、`top` で代替した（decisions.md D90）。
      マウス報告（アプリ側が xterm.js のネイティブなマウストラッキングを受けるか）は、実地に
      `?1000h`/`?1006h` を有効化した上で Playwright の合成マウスイベントを送っても SGR レポートが
      観測できず、design が「xterm.js が扱う」と明記して製品側の責務外としている領域でもあるため
      自動検証を見送った（docs/verification.md の手動確認へ引き継ぐ）。色・全角は xterm.js の
      canvas（WebGL）描画を DOM から読み取れないため、実際のバイト列（エスケープシーケンス・UTF-8）が
      欠落なく往復することで確認し、ピクセル単位の描画確認はしていない。
      **実地の確認で 2 件の製品側の実バグを発見・修正した**（詳細は decisions.md D91・D92）。
      あわせて spec 自身の書き方の判断（htop の代替・typed echo と実行後出力の取り違え・IME の
      `compositionend`・`tput cols` の読み取り・マウス報告の見送り・並列実行時の失敗の切り分け）を
      decisions.md D90 に記録した（製品側の不具合ではない。D90 は T3 の時点で書き漏らしており、
      review ラウンド 1 の指摘で書き起こした）：
      (1) typed echo と実行後出力を区別しない待ち方で誤検出しかけた（spec 自身の問題。D90）。
      (2) `PaneLayout.vue` の `commitView`（`client.view` を送る唯一の経路）が `onUpdated` にしか
      繋がっておらず、初回マウント（分割等を一度もしない、最も基本的な「開いて使うだけ」の経路）では
      一度も呼ばれず、PTY が永久に headless の既定値（120x40）のまま固定されていた（`onMounted` を
      追加。D91）。
      (3) `PaneLayout.vue`・`Splitter.vue`・`TabBar.vue`・`Sidebar.vue` の 4 component に `<style>` が
      一度も存在せず、複数 pane が横／縦に並ばず常にブロック要素として縦積みになっていた（サイドバー・
      tab バーも位置・見た目が付いていなかった）。4 component に CSS を追加（D92）。
      いずれも `SessionModel`/`SessionService`/`KeyInputController` 単体テストの範囲外（(2)(3) は
      happy-dom にレイアウトが無いため単体テストでは原理的に検出できない）で、実地の Playwright
      （実物の Chromium・`boundingBox()`・`getComputedStyle()`）で初めて検出できた。
      `pnpm -s typecheck && lint && test`（740 passed）・`pnpm -s build && aidev smoke`・`packages/e2e`
      の全 spec（workers=1 で 3 回連続 pass。並列実行時の間欠的な失敗はこのサンドボックスの資源競合
      （Chromium・サーバを複数同時起動）によるもので、この work の変更に起因する回帰ではないことを
      無関係な既存テストも同様に間欠失敗することで確認済み）。
- [x] T4: AC5 の E2E——scrollback を遡る、copy モードでの選択・検索・コピー、マウスでの選択とコピー
      （M4・M5）、`Ctrl+Shift+V` での貼り付け。
      AC: AC5
      完了メモ: `packages/e2e/src/specs/scrollback-copy.spec.ts`（4 test）。実地の確認で 2 件の
      製品側の実バグを発見・修正した（詳細は decisions.md D93・D94）：
      (1) copy モードの検索（`/`・`?`）が、検索語を実際に入力する経路が 03-web-desktop の時点で
      一度も実装されておらず完全に機能していなかった（`CopyMode.ts`）。
      (2) copy モードのカーソルが pane を acquire した時点（ページを開いた直後）の位置に固定され、
      scrollback を溜めてから copy モードに入っても現在位置から始まらない／検索が当たった後に
      選択し直すと検索前の古い位置に戻る、の2件（`CopyTarget.ts`・`ActionDispatcher.ts`）。
      `CopyMode.test.ts`・`CopyTarget.test.ts`・`ActionDispatcher.test.ts` に回帰テストを追加。
      M5（ダブルクリックで単語選択）は 03-web-desktop の D65 で実地に確認済みのため本タスクでは
      再確認していない（xterm.js 既定の挙動のまま、製品側の追加実装が無い＝回帰の余地が薄いため）。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `packages/e2e` の全 14 spec を `--workers=1` で確認済み。
- [x] T5: AC6・AC7 の E2E——02-agent-detection の判定ルールで検出できる実物と同じ形の画面を pane に
      流し込み、5 状態（`idle`/`working`/`blocked`/`done`/`unknown` 等。design の定義に従う）とサイドバーへの
      反映、workspace/tab への状態の集約、サイドバーの行のクリックでのフォーカス移動を確かめる。
      AC: AC6, AC7
      完了メモ: `packages/e2e/src/specs/agent-detection.spec.ts`（1 test）。**偽のエージェント**
      （tasks.md「実装方針」）：`bash -c 'exec -a claude bash <script>'` で argv[0] を "claude" に
      差し替え、`ManifestEngine.test.ts`（02-agent-detection）と全く同じ画面 fixture（bash 承認の
      blocked 画面）を実物の PTY に流し込む。シバン（`#!/bin/bash`）経由だとカーネルが argv[0] を
      インタプリタ名へ書き換えてしまうため使わなかった（実地に確認して判明）。
      idle→blocked の遷移が2秒以内にサイドバーへ反映されること（AC6）、行のクリックで実際に
      `pane.focus` が飛んで該当 pane へ焦点が移ること（AC7。`session.focus_changed` で確認——p1 は
      fake-claude が sleep 中で対話的シェルではないため、入力のエコーではなくイベントで確かめた）を
      検証した。「done」（`DisplayState`。`@wtm/protocol`）は `ManifestEngine`/`AgentTracker` が出す
      生の `AgentState`（`blocked`/`working`/`idle`/`unknown`）には含まれない**クライアント側だけの
      派生状態**（`store/seen.ts` の未読判定）と分かったため、本タスクでは実機のエージェント検出の
      配線確認に絞り、done の集約ロジック自体は 03-web-desktop の `store/seen.test.ts`（単体テスト）で
      既に検証済みとして重複させなかった。idle・working・unknown の各状態はルールの当たり判定自体は
      `ManifestEngine.test.ts` で網羅済みのため、E2E では配線を代表する1状態（blocked。複数行に
      またがる最も複雑な当たり判定）に絞った——過剰な重複を避ける判断（`aidev-50-test` の「単体テストの
      守備範囲を再掲しない」と同じ考え方）。
      **実地の確認で1件、設計どおりの仕様を再確認した**（不具合ではない）：`AgentTracker` には新しく
      見つけたエージェントの判定を止める3秒の起動猶予（`AGENT_STARTUP_GRACE_WINDOW`。02-agent-detection
      D46）があり、design の「状態反映は2秒以内」はこの猶予の**後**に成立する基準だと実地の計測で
      確認した（最初この区別を知らずに計測し、3秒超のレイテンシを不具合と誤認しかけた——猶予明け後の
      遷移だけを計測する形に spec を直した）。
      `pnpm -s typecheck && lint && test`（752 passed。この T では unit test は増やしていない）・
      `pnpm -s build && aidev smoke`・spec 自体を `--workers=1 --repeat-each=2` で安定して pass
      することを確認済み。
- [x] T6: AC8・AC18 の E2E——ブラウザを閉じて（`client.detach`／タブを閉じる）再接続すると構成と画面
      （scrollback 含む）が戻ること、サーバプロセスを止めて再び起動しても workspace/tab/pane の構成と
      各 pane の cwd が復元されること。
      AC: AC8, AC18
      完了メモ: `packages/e2e/src/specs/reconnect-restore.spec.ts`（2 test）。`support/appServer.ts` に
      `restart()` を追加（`stateDir` を残したまま `ComposedServer` を作り直す。AC18 の要——`close()` は
      `stateDir` ごと消すので使えない）。AC8 は `prefix+q`（detach）→ 別ブラウザコンテキストで再接続→
      copy モードで yank して scrollback が実際にブラウザへ戻っていることをクリップボード経由で確認
      （xterm.js は canvas 描画のため DOM からは読めない。D93/D94 と同じ手法）。AC18 は
      `workspace.create({cwd: <一時ディレクトリ>})` で作った workspace を `appServer.restart()` の前後で
      比較し、id・名前・レイアウト・cwd が一致すること、実際に `pwd` を打ってそのディレクトリで
      シェルが起動していることを確認した。
      **実地の確認で1件、想定と異なる実際の挙動を発見した**（不具合ではなく、テストの想定を直した）：
      再起動のたびに新しいログイン用トークンが発行されると想定していたが、`composeServer` の
      `freshToken` は「今回新しく作った」ときだけ立つフラグで、既存の `stateDir` から起動し直した
      場合はトークンが変わらず永続化済みのものがそのまま使える（実物の `wtm serve` の挙動と一致。
      `main.ts` が「この URL は今だけ表示します」と案内するのも初回起動時のみの意図と整合する）。
      `appServer.restart()` はこの実際の挙動に合わせ、`freshToken` が無ければ直前のトークンを引き継ぐ。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `packages/e2e` の全 17 spec を `--workers=1` で確認済み（`appServer.ts` は共有ファイルのため、
      既存の全 spec が回帰なく通ることも確認した）。
- [x] T7: AC9 の E2E——2 つのブラウザコンテキストから同じセッションへ同時接続し、どちらからも表示・入力が
      でき、サイズ権限の決まり方どおりに動くこと。
      AC: AC9
      完了メモ: `packages/e2e/src/specs/multi-client.spec.ts`（1 test）。2 つの実物のブラウザ
      コンテキスト（`browser.newContext()`）で同じサーバへ同時接続し、それぞれの `clientId` を CDP の
      WebSocket フレーム観測で拾い（`WtmTestClient` は別接続なのでブラウザ自身の `clientId` は分からない）、
      (1) 誰も権限を持たない tab は最初に `client.view` を送ったクライアント（先に繋いだ page1）が持つ、
      (2) どちらのブラウザから打っても入力が PTY へ届く、(3) 後から入力した page2 へサイズ権限が移る
      （design「サイズ権限」の「権限を取る操作：入力…」）ことを確認した。
      **実装中、この spec 自身に Promise の合成ミス（デッドロック）を作り込んで気づいた**（製品側の
      不具合ではない）：CDP のセットアップ（`Network.enable`。navigate 前に済ませる必要がある）と
      フレーム待ちを1つの async 関数にまとめて `await` すると、Promise の自動フラット化により
      navigate する前にフレーム待ちまで完了してしまい、`page.goto()` が一生呼ばれず固まった
      （`prepareClientIdCapture` を「セットアップの await」と「フレーム待ちを返す関数」の2段に分けて解消）。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      spec 自体を `--workers=1 --repeat-each=3` で安定して pass することを確認済み。
- [x] T8: AC10 の E2E——Cookie 無し・Origin 不一致・token 誤りの 3 パターンが拒否されることを確かめる。
      AC: AC10
      完了メモ: `packages/e2e/src/specs/auth-rejection.spec.ts`（3 test）。生の 401/403 自体は
      `packages/server` の integration test（`HttpServer.integration.test.ts`・
      `WsGateway.integration.test.ts`）で既に厳密に確認済みのため、この E2E は**利用者から見た結果**に
      絞った：token 誤り／Cookie 無しはどちらも実物のブラウザで `LoginView.vue` のログイン画面のまま・
      端末へ繋がらないことを確認。Origin 不一致は普通の同一オリジンナビゲーションでは再現できない
      （ブラウザは常に自分のページの Origin を正しく送る）ため、生の `fetch` で 403 を確認した
      （他の2つと対称に「拒否されること」を確かめる形。過剰な重複を避けるため、integration test で
      既に検証済みの HTTP ステータス・ヘッダの細部までは再検証しない判断）。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `packages/e2e` の全 21 spec を `--workers=1` で確認済み。
- [x] T9: AC12 の E2E——モバイルのエミュレーションで、1 列レイアウト・pane ピッカー・追加キーの列・
      Prefix ボタン・「この端末に合わせる」の一巡を確かめる（04-mobile の test 工程の disposable script を
      正式な spec に育てる）。
      AC: AC12
      完了メモ: `packages/e2e/src/specs/mobile.spec.ts`（1 test）。`devices["iPhone 13"]` は既定で
      webkit を使う（`defaultBrowserType: "webkit"`）が、この検証環境には chromium しか無いため、
      viewport・タッチ・UA だけを借りて `defaultBrowserType: "chromium"` で上書きした（実地に確認して
      判明。webkit が使える環境ならこの上書きを外せば実物の Safari エンジンでも検証できる）。
      1 列レイアウト（サイドバーが出ない）・pane ピッカーの開閉・追加キーの列（11 個のボタン）・
      Prefix ボタン＋実キーボードでの分割（分割してもモバイルは常に 1 pane だけ表示・新しい pane へ
      実際に切り替わって入力が届くことを確認——D86 の回帰確認を兼ねる）・「この端末に合わせる」の
      押下状態の一巡を確認した。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `packages/e2e` の全 22 spec を `--workers=1` で確認済み。
- [x] T10: AC13・AC14・AC-I1〜AC-I5 の E2E——`DEFAULT_KEYMAP`（`packages/web/src/keys/keymap.ts`）を
      走査してキーごとの割り当てが実際に動くこと、`MouseBridge` が実装するマウス操作（M1〜M9・M11）、
      ダイアログ/ヘルプの開閉（キー操作とクリックの両方・Esc・外側クリック）、キーボードだけでの一巡
      （マウス不使用）、フォーカスの行き先（AC-I4）、prefix 直後以外は端末へ届くこと（AC-I5）。
      AC: AC13, AC14, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
      完了メモ: `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts`（4 test）。`DEFAULT_KEYMAP` の
      個々のキー（workspace/tab/pane の作成・名前変更・切替・閉じる、分割・境界のリサイズ・
      フォーカス移動・巡回・入れ替え・拡大表示・resize モード、copy モードの移動・検索・選択・コピー）は
      既に `workspace-tab-pane.spec.ts`・`scrollback-copy.spec.ts`・`terminal-app.spec.ts` で実地に
      確認済みのため、この T では**まだ確認が無かった残りの面**に絞った：ヘルプダイアログの表示内容と
      Esc での閉じ方・閉じた後のフォーカスの戻り先（AC-I1・AC-I4）、goto ピッカーでのマウス無しの
      pane 切替（AC-I3）、右クリックメニュー（M3。実地の確認は本 spec が初めて）、prefix 経由でない
      文字は素直に端末へ届くこと（AC-I5）。M1（クリックでフォーカス）・M4・M5（選択・コピー）は
      既存の spec 群で間接的に確認済み。M2（Splitter のドラッグ）は T2 でキーボード操作の等価な経路
      （矢印キー）を確認済み——ポインタでのドラッグ自体は `Splitter.test.ts`（単体テスト。03-web-desktop）
      で確認済みのためここでは重複させない。M6（リンクの Ctrl+クリック）・M8（ホイール）・M9
      （スクロールバー）は xterm.js 自身の既定の挙動（design の該当箇所の注記どおり、製品側の追加実装が
      無い）ため対象外とした。M7（`rightClick` 設定に応じた右クリックの振り分け）・M11（マウス報告中の
      Shift+クリック）は実地の自動検証が難しく（アプリ側の受信確認が要る／プラットフォーム依存）、
      05 の対応表（herdr-parity。AC15）の「未検証のまま見送った」項目として記録する。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `packages/e2e` の全 26 spec を `--workers=1` で確認済み。
- [x] T11: AC17 の計測の仕組み——1 文字の INPUT→OUTPUT の遅延（200 回の p95）、pane 16 個＋大量出力中の
      別 pane の遅延、エージェントの状態変化から `pane.agent_status_changed` までの時間。結果を出力する
      （合否は問わない。上記リスク参照）。
      AC: AC17
      完了メモ: `packages/e2e/src/specs/performance.spec.ts`（2 test）。`WtmTestClient`
      （`support/wsClient.ts`）に `sendInput`/`armNextOutput` を追加——ブラウザの `page.keyboard` 経由だと
      Playwright 自身の入力遅延が上乗せされて計測にならないため、生の INPUT フレームを直接送る形にした。
      `armNextOutput` は「新しい OUTPUT が届いたら即座に解決する」（ポーリングしない）専用の待機で、
      既存の `waitForOutput`（内容の部分一致・50ms ポーリング）をそのまま流用すると (1) ポーリングの
      粒度が実際の遅延（数ms〜数十ms）にそのまま上乗せされる、(2) 200 回のループで同じ1文字を
      使い回すと2回目以降は「既に溜まっている分」に前回のぶんが残っていて即座に0msで解決してしまい
      計測にならない、の2点で不適切だったため新設した（内容を見ず「新しく届いたか」だけを判定する）。
      実測値（この検証環境）：1文字の往復 200 回で p50≈3.5ms・p95≈5ms、pane 16 個＋1 個で
      `yes > /dev/null &` を流しながら別 pane を測ると p95≈20〜40ms（負荷で遅延が伸びる、design の
      流量制御が効いている状況として妥当な傾向）。「状態の反映」（判定ルールに当たる画面から
      `pane.agent_status_changed` まで）は T5（`agent-detection.spec.ts`）で既に2秒以内であることを
      実地に計測・アサート済みのため、ここでは重複させなかった。
      tasks.md のリスクどおり、**数値そのものの合否は問わない**——`console.log` に出力し、計測自体が
      正しく機能していること（有限・非負・回数どおり）だけをテストの合否にした。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `packages/e2e` の全 28 spec を `--workers=1` で確認済み（`wsClient.ts` は共有ファイルのため、
      既存の全 spec が回帰なく通ることも確認した）。
- [x] T12: docs 一式——`docs/verification.md`（3 OS・実機の検証手順。何を・どう確かめるか、既知の注意点
      （Windows の ConPTY 等）を含む）、`docs/tls-setup.md`（`--host 0.0.0.0 --cert --key` の起動と、
      mkcert / `tailscale cert` での証明書の用意）、`docs/herdr-parity.md`（research.md F7 の 49 項目の
      分類と design.md の AC 対応表を整形し、MVP の項目がすべていずれかの AC で検証されていることを
      確認して明記する。AC15 の直接の根拠）。
      AC: AC11, AC15, AC16
      完了メモ: `docs/tls-setup.md`・`docs/verification.md`・`docs/herdr-parity.md` を作成。
      「記載どおりに実行すれば成功する」ことを、この検証環境で実際に辿って確認した（tasks.md
      「テスト方針」のとおり。TLS は自己署名や mkcert のローカル発行まで、実際の別マシン接続は
      親の統合 test）：(1) 非ループバックホストへ証明書なしで bind しようとすると実際に拒否される
      ことを確認（`cannot bind to non-loopback host "0.0.0.0" without a certificate`）、
      (2) docs 記載の `openssl` コマンドで自己署名証明書を実際に生成し、(3) `--host 0.0.0.0 --cert --key`
      で実際にサーバが HTTPS で起動し、(4) 実際に HTTPS リクエストが通ることまで確認した（`mkcert`
      自体はこの検証環境に無いため、コマンドの記載内容はソース（`packages/server/src/config.ts`・
      `OriginPolicy.ts`）の実装と突き合わせて確認するに留めた）。
      `docs/herdr-parity.md` は research.md F7 の 49 項目をそのまま整形し（内容の書き換えはしていない）、
      `aidev coverage --strict` で **gaps=0**（`coverage-gaps: struct=0 cover=0`）になることを確認した
      ——AC15 の直接の根拠。
      `pnpm -s typecheck && lint && test`（752 passed）・`pnpm -s build && aidev smoke`・
      `aidev coverage --strict`（gaps=0）を確認済み。
- [x] T13: 既定の起動方法（`pnpm --filter @wtm/e2e test`）で E2E が通るようにする（親 decisions.md D104。親の統合 test ラウンド4 で
      9 failed）。大量出力の性能計測の spec を他の spec と同時に走らせない（計測値も汚れる）。あわせて `workspace-tab-pane.spec.ts:142`
      の巡回の段の競合（入れ替えの完了をテスト自身の WebSocket クライアントで判定していて、ブラウザ側の反映を待っていない）を直す。
      対象: `packages/e2e/playwright.config.ts`・`packages/e2e/src/specs/performance.spec.ts`・`packages/e2e/src/specs/workspace-tab-pane.spec.ts`・
      ルートの `package.json`（E2E の入口を置くなら）
      依存: T11
      AC: AC17
- [x] T14: docs を 01 の D100〜D103 と、01 の review ラウンド6 で見つかった記述の穴に合わせる（親 decisions.md D104・親の test-result.md
      「持ち越し」）。ファイアウォールの手順を構成ごとに（WSL2 mirrored の Hyper-V ファイアウォール・Windows ネイティブ・Linux）・
      Tailscale の鍵の権限・別のマシンからの TLS の確認（AC11）を Linux・WSL2・Windows ネイティブそれぞれに・リバースプロキシの
      注意・`wtm` が PATH に無い（起動のコマンド）・`--state-dir` を分ける／`wtm.lock`・`token reset` は止めてから・SIGHUP で終わる・
      起動時の新しい表示。
      対象: `docs/tls-setup.md`・`docs/verification.md`
      依存: T12
      AC: AC11, AC16
      完了メモ（T13・T14）: 新しい実装コンテキストで実装（D104）。`workers: 1`（性能計測を外しても並列では実物のサーバと
      ソフトウェア GL の Chromium が CPU を取り合い 3〜8 件落ちたため）。巡回・workspace・goto・mobile・terminal-app の分割の段の
      「テストのクライアントのイベントを待ってブラウザを操作する」競合を、ブラウザ自身が送る `client.view`・画面の並び・焦点を
      待つ形に直した（ブラウザへの応答だけを遅らせる負の対照で、直す前の形は落ちることを確認）。docs は 01 の D100〜D103 と
      独立点検の 9 件（AC11 の手順の state-dir・ConPTY は Windows ネイティブだけ・IP の例・証明書の置き場所・CA の入れ方・
      ファイアウォール等）に合わせ、このマシンで動くコマンドは実際に動かした。既定の `pnpm --filter @wtm/e2e test` で 35 passed。
      作業中に 03 の不具合（モバイルで隠れた pane の PTY が 1×1 に縮む）を発見し、親の test-result.md「持ち越し」に記録した。
- [x] T15: 統合 review ラウンド1 の 05 の範囲を直す（親 decisions.md D109）。親の test-result.md の「未検証の穴」で実機の確認に回した項目の
      うち、docs/verification.md に手順の無いもの（AC12 の再接続の後のソフトキーボード・隠れた pane の大きさ・ログイン画面・fit と回転、
      AC16 の Windows でのロックの判定・コンソールを閉じたとき・大文字のホスト名、AC17 の実機での計測の手順と合否の基準、M7、
      claude／codex 以外のエージェント）の手順を足す。利用者に説明済みの既知の制約（TCP の半開きの間は入力が黙って消える・IME の
      変換中の文字は新しい pane へ流す分として溜まらない・再接続で戻らない端末のモード（D107））を docs に書く。01 の D106（`/api/session`
      の Host 検査・Host を書き換えるプロキシ）と 03 の D107（403 の表示・手がかり・scrollback の行数）を docs に反映する。
      対象: `docs/verification.md`・`docs/tls-setup.md`・`docs/herdr-parity.md`
      依存: T14
      AC: AC11, AC12, AC16, AC17
      完了メモ: 新しい実装コンテキストで実装（D109）。実機に回した項目をすべてチェックボックスと期待する結果つきの手順にし（AC12 の
      ログイン・fit・回転・ピンチ・再接続、AC16 の Windows のロック・コンソール・大文字のホスト名、AC17 の計測の手順と合否の基準、
      M7、他のエージェント、scrollback）、「既知の制約」の節を作り、D106〜D108 を反映した。独立点検の 18 件（AC17 の状態反映の定義・
      16 pane の作り方・`--scrollback` の開き直し・再起動で前の画面は戻らない・state-dir／ポートの衝突 等）も直した。このマシンで
      動く手順は実際に辿った。作業中に 03 の不具合 3 件（M6・M7×2）と 04 の判断事項 1 件（タブレット）を見つけ、D109 に記録した。
- [x] T16: E2E の支援のテスト用クライアントが SNAPSHOT の中身を出力として扱わず、購読の前に済んだ出力を見落とす（親の統合 test ラウンド7。
      `workspace-tab-pane.spec.ts:297` が間欠的に落ちた原因）。SNAPSHOT の本文も `paneOutput` に足す。
      対象: `packages/e2e/src/support/wsClient.ts`
      依存: T15
      AC: AC1
      完了メモ: SNAPSHOT の本文も `paneOutput` に足した。購読を 2 秒遅らせる一時の spec で、直す前は必ず `got: ""` で落ち、直した後は通る
      ことを確かめた（一時の spec は削除）。`rawOutput` の「含まない」を見る既存の test への影響が無いことは、`workspace-tab-pane.spec.ts`
      の `--repeat-each=3`（18 passed）と既定の E2E（60 passed）で確かめた。点検は同じセッションで行い指摘なし（1 行の支援の変更）。
