# タスク: モバイル UI（04-mobile）

## 実装方針

- 親のメタ tasks（`../tasks.md`）の割れ目どおり、`packages/web/src/mobile/*` を新規に作る。既存の
  `03-web-desktop` の部品（`store/*`・`net/Connection`・`keys/KeyInputController`・`TerminalRegistry`・
  `TerminalPane.vue`）はそのまま再利用し、**モバイル固有の差分だけ**を足す：1 列レイアウト・pane の
  ピッカー・追加キーの列・タッチのスクロール・fit の切替・visual viewport 対応。
- 「境界の約束：なし」（親のメタ tasks の表）——このサブタスクの成果物を他のサブタスクは使わない。
  一方で `main.ts`/`App.vue`（03 の成果物）は、デスクトップ / モバイルの切り替えを担う唯一の場所なので、
  このサブタスクで改修する（統合点が他に無いため）。
- **最初のタスクは U4（xterm.js 6.0.0 のタッチスクロールの不具合）の実地確認**（親のメタ tasks
  「作業順序と依存関係」）。見立てが外れれば、以降のタスクを分解し直す。

## 作業順序と依存関係

下の `依存:` に従う。特記事項のみ:
- T1（判定・U4 確認）を最初に済ませてから T2（タッチのスクロール）に進む——U4 の結論（自前実装で
  補うか、版を上げて解決するか）で T2 の要否・実装方針が変わるため。
- T3（ExtraKeys）・T4（PanePicker）は独立（対象ファイルが重ならない）ので並行できる。
- T5（MobileShell）は T2・T3・T4 の成果を組み立てるので、それらの後。
- T8（`main.ts`/`App.vue` の結線）は最後——モバイル判定・シェル・fit・visual viewport が全て揃ってから
  実際に繋ぎ込む。

## リスク / 留意点

- **xterm.js はモバイルを公式にサポートしていない**（research.md F10.9）。タッチのスクロール（U4）以外にも
  未解決の不具合（Android Chrome＋Gboard の文字乱れ #3600、タッチ端末でのコピペ不可 #3727）があるが、
  design の対象範囲（AC12「一覧の確認・pane の切替・入力」）はこれらに直接は踏み込まない——**発生しても
  このサブタスクの対象外**（xterm.js 自体の既知の制約として 05 の対応表に載せる）。
- **サイズの縮小表示**：モバイルは既定でサイズ権限を取らない（D13）ので、サーバ側が決めた cols/rows の
  ままの pixel サイズで届く pane を、画面幅に収まるよう CSS で縮小する必要がある——T20（03-web-desktop）の
  `terminal-pane-scaled` は「中央寄せ」だけで「縮小」はしていない（確認済み）。**縮小の計算はこのサブ
  タスクで新規に作る**。
- **`kind: 'mobile'` の判定（pointer: coarse）と、1 列レイアウトの判定（画面幅 768px 未満）は別軸**
  （design「モバイル」の 2 つの箇条書き）。ノート PC でウィンドウを狭くしても `pointer: coarse` にはならず
  `kind` は `desktop` のまま——レイアウトだけ 1 列になってよい（design の記述どおり、2 つを独立に扱う）。

## テスト方針

- 親のメタ tasks「04：追加キーの one-shot / lock、モバイルの判定、fit の切替」に沿った単体テスト
  （Vitest。各タスクで対象のファイルと一緒に書く。03-web-desktop と同じ粒度）。
- `mobile/TouchScroll.ts`・`mobile/detect.ts` は状態を持たない・DOM に依存しない関数を中心に置き、
  純粋なロジックの単体テストで確かめる（`@vue/test-utils` が要るのはコンポーネントだけ）。
- E2E 一式（モバイルのエミュレーション）は 05-e2e-docs の成果物（親のメタ tasks）。ただし
  03-web-desktop の test 工程で「実地の確認（disposable script）」が実際に不具合を 2 件発見した実績が
  あるため、このサブタスクの test 工程でも同様の使い捨てスクリプト（Playwright の `devices["iPhone 13"]`
  相当のモバイルエミュレーション）で一巡だけ確かめる（正式な E2E の代わりにはしない。詳しさは 05 に譲る）。

## タスク

- [x] T1: `mobile/detect.ts`（`isMobileViewport()`：画面幅 768px 未満をリアクティブに返す。`matchMedia`
      の変化を監視する。`isCoarsePointer()`：`(pointer: coarse)` を起動時に 1 回評価し、`client.hello` の
      `kind` に使う）。**U4（xterm.js 6.0.0 のタッチスクロールの不具合）を実地に確認する**——npm の
      `@xterm/xterm` の最新安定版はまだ 6.0.0 のまま（修正 #5563 は 6.1.0 の beta にしか無い。2026-09-18
      時点で確認）。beta 依存は採らず、design の指示どおり自前のタッチ処理（T2）で補う方針を
      decisions.md に記録する。
      対象: `packages/web/src/mobile/detect.ts`（新規）/ 根拠: design「モバイル」の判定・architecture
      「最初に確かめる未確認事項」の U4
      依存: なし
      AC: AC12
      完了メモ: U4 は実機の Chromium（Playwright、モバイルのエミュレーション）で `Touch`/`TouchEvent`
      を実際に発火させて確認（スワイプ前後で `viewportY` が動かないことを確認。D83）。happy-dom の
      `matchMedia` は生成時点の `window.innerWidth` を静的に評価するだけで、リサイズ後の "change" は
      自分で発火しないと判明——テストでは `window.matchMedia` 自体をフェイクに差し替えて "change" を
      手動発火させる方式にした。`isCoarsePointer()` は Vue のライフサイクルフックに依存しない素の関数に
      した（`main.ts` からコンポーネント外で呼ぶため）。テスト: `detect.test.ts`（4 件）。
- [x] T2: `mobile/TouchScroll.ts`（U4 の補完。`touchstart`/`touchmove`/`touchend` を監視し、縦方向の
      移動量をセルの高さ（`measure.ts` の仕組みを流用）で行数に換算して `Terminal.scrollLines()` を呼ぶ。
      横方向優位のジェスチャ（選択・水平スクロール）と衝突しないよう、縦/横の優位性で振り分ける）。
      対象: `packages/web/src/mobile/TouchScroll.ts`（新規）/ 根拠: design「スクロールと入力」
      依存: T1
      完了メモ: `ViewSync.ts` の `defaultGetCellSize`（内部関数）を `term/measure.ts` の
      `getCellSize()`（公開関数）へ切り出し、`ViewSync.ts` と `TouchScroll.ts` の両方で共有した
      （3 箇所目の重複を避けるため。T26/D77 の `depthFirstPaneIds` の切り出しと同じ判断）。
      符号の向き（指を上＝新しい内容へ進む＝正の値、指を下＝scrollback を遡る＝負の値）を明記。
      縦横の判定は最初の 8px の移動で確定し、以後は同じ touchstart〜touchend の間固定する。
      `touch-action` の CSS は呼び出し側（T5・MobileShell.vue）の責務とし、doc comment に明記した。
      テスト: `TouchScroll.test.ts`（8 件）。
      AC: AC12
- [x] T3: `injection.ts` に `KeyInputControllerKey` を追加（モバイルの部品が `KeyInputController.injectKey`
      へ届けるため。今まで注入の対象になっていなかった）。`mobile/ExtraKeys.vue`（追加キーの列：
      `Esc`・`Tab`・`Ctrl`・`Alt`・`↑`・`↓`・`←`・`→`・`PgUp`・`PgDn`・`Prefix`。`Ctrl`/`Alt` はタップで
      次の 1 キーだけ効く one-shot、長押しでロック。`Prefix` は `Ctrl+B` の `KeyInput` を直接
      `injectKey` する。列は開閉できる）。
      対象: `packages/web/src/injection.ts`（追記）・`packages/web/src/mobile/ExtraKeys.vue`（新規）/
      根拠: design「追加キーの列」・architecture「keys/KeyInputController.ts」の `injectKey`
      依存: なし
      AC: AC12, AC-I1, AC-I3
      完了メモ: 実装中に `KeyInputController.injectKey`（T10 実装済み）が `KeyRouter` の `pass` 決定
      （矢印・PgUp/PgDn 等、ほぼ全ての ExtraKeys のキーがこれに当たる）に対して何もしないことに気づいた
      ——`pass` は「xterm.js 自身に既定処理させる」という意味だが、`injectKey` には合成できる実物の
      `KeyboardEvent` が無いため。`KeyInputController.ts` を拡張し、`pass` を対応表でバイト列に変換する
      経路と、`Ctrl`/`Alt` の one-shot/lock（`setPendingModifier`。実物のソフトキーボードでの入力にも
      効く）を追加した（D84。DECCKM 等の端末モードは見ない簡略化）。ExtraKeys 自体の Ctrl/Alt の
      「armed」視覚表示は、実際に消費された瞬間を `KeyInputController` から知らされる仕組みが無いため、
      列の何かを次に押すまでは表示が残りうる簡略化として明記した（D84・ExtraKeys.vue の doc comment）。
      テスト: `KeyInputController.test.ts` に 7 件追加（既存 11 件は回帰なし）・`ExtraKeys.test.ts`
      （6 件）。
- [x] T4: `mobile/PanePicker.vue`（全画面のピッカー。workspace / tab の一覧とエージェントの一覧を出し、
      タップで `pane.focus`/`tab.focus`/`workspace.focus` を送って切り替える。エージェントの状態集約は
      `store/seen`（`aggregate`/`displayStateFor`）を `Sidebar.vue` と同じ要領で使う）。
      対象: `packages/web/src/mobile/PanePicker.vue`（新規）/ 根拠: design「1 列のレイアウト」・
      research.md F11.9（zellij の Web のモバイル UI）
      依存: なし
      AC: AC12, AC7
      完了メモ: design の「workspace/tab の切替」と「pane のピッカー」を 1 つの全画面コンポーネントに
      まとめた（workspace→tab→agent の一覧を 1 画面で。zellij 型の考え方を踏まえた実装判断）。
      選択すると `close` を emit するだけで、開閉自体は `MobileShell.vue`（T5）に委ねる。
      `Sidebar.vue`（03-web-desktop T21）と同じ集約パターン（`session.panesInWorkspace`・
      `aggregate`/`displayStateFor`）を再利用。テスト: `PanePicker.test.ts`（5 件）。
- [x] T5: `mobile/MobileShell.vue`（1 列レイアウト本体。上部バー：workspace/tab 名の表示・ピッカーを開く
      ボタン・「この端末に合わせる」トグル・キーボード（ExtraKeys）の開閉ボタン。中央：現在の tab の
      フォーカス中の pane を 1 つだけ `TerminalPane` で表示。下部：開いていれば `ExtraKeys`。
      `TouchScroll` を中央の pane 領域に取り付ける）。
      対象: `packages/web/src/mobile/MobileShell.vue`（新規）/ 根拠: design「1 列のレイアウト」
      依存: T2, T3, T4
      AC: AC12
      完了メモ: pane の表示は `PaneLayout`（03-web-desktop T19）を **`{type:'pane', paneId}` という
      単一ノードのレイアウト木**で再利用した——`ViewSync.commit`（`client.view` の送出）の配線を
      複製せずに済む（デスクトップの分割があってもモバイルはフォーカス中の 1 つだけを見せる。design
      どおり）。`TouchScroll` は `registry.get(paneId)?.term`（`TerminalRegistry` の既存の公開メソッド）
      で現在の pane の `Terminal` を取り、`watch([currentPaneId, paneContainer], ..., {flush:"post"})`
      で pane の切り替えのたびに張り直す——`flush:"post"` は必須（`TerminalPane` が新しい pane を
      acquire し終える前に張ろうとして `registry.get()` が undefined を返すレースを避けるため。
      テストで実際に踏んで気づいた）。「この端末に合わせる」トグル自体は T6 で追記する（今回はプレース
      ホルダのボタンを置いていない——T6 が上部バーに足す）。テスト: `MobileShell.test.ts`（4 件。実物の
      `TerminalRegistry`/xterm.js でタッチスワイプが `scrollLines` を呼ぶことまで確認）。
- [x] T6: サイズの縮小表示（`mobile/useFitToScreen.ts`。pane の pixel サイズ（`cols × cellWidth`）が
      画面幅を超える分を `transform: scale()` で画面幅に収める。「この端末に合わせる」有効時は
      `client.fit` を送ってサイズ権限を取り、縮小せず等倍で表示する）。
      対象: `packages/web/src/mobile/useFitToScreen.ts`（新規）・`MobileShell.vue`（組み込み）/
      根拠: design「サイズ」
      依存: T5
      AC: AC12, AC9
      完了メモ: 実装中に気づいた点——xterm.js は自分の cols/rows で決まる pixel サイズのまま描画し、
      マウント先の DOM 要素の CSS サイズには自動で合わせない。`transform: scale()` だけではレイアウト上の
      大きさが変わらないため、マウント先の要素に `width:100%` のような相対サイズのままだと「小さい
      入れ物いっぱいに描いてから縮める」循環になり縮小の意味が無い——`useFitToScreen` は `scale` に加えて
      `naturalSize`（`cols × cellWidth` の明示的な px）も返し、`MobileShell.vue` はこれを明示的な
      `width`/`height` として当ててから `scale()` を重ねる。自分のテストで `watch` に `immediate: true`
      が漏れている不具合（`scale` が既定値の 1 から一度も更新されない）を発見・修正した（D85）。
      pane の cols/rows がサーバから届いて変わったとき（`client.fit` 後の実際のリサイズを含む）の
      再計算も D85 で追加。**視覚的な縮小の正確さ（実機での見た目）は単体テストの範囲外**——test 工程の
      モバイルエミュレーションでの実地の確認で見る（テスト方針）。テスト: `useFitToScreen.test.ts`
      （5 件）・`MobileShell.test.ts` に 1 件追加（既存 4 件は回帰なし）。
- [x] T7: ソフトキーボード対応（`mobile/useVisualViewport.ts`。`window.visualViewport` の `resize` を
      監視し、表示領域の高さをソフトキーボードの高さぶん詰める）。
      対象: `packages/web/src/mobile/useVisualViewport.ts`（新規）・`MobileShell.vue`（組み込み）/
      根拠: design「スクロールと入力」・research.md F10.9
      依存: T5
      AC: AC12, AC-I1
      完了メモ: `window.visualViewport` が無い環境（happy-dom を含む）では `window.innerHeight` に
      フォールバックする。`MobileShell.vue` の `.mobile-shell` ルートへ明示的な `height` として当てる
      （CSS の `height:100%`/`100vh` はレイアウト viewport に追従し、ソフトキーボードで縮む
      visual viewport には追従しないため）。テスト: `useVisualViewport.test.ts`（3 件）・
      `MobileShell.test.ts` に 1 件追加。
- [x] T8: `main.ts`/`App.vue` の結線（`isCoarsePointer()` の結果を `client.hello` の `kind` に渡す。
      `isMobileViewport()` の結果で `App.vue` のテンプレートを `MobileShell` / 既存のデスクトップ本体に
      切り替える——判定は独立（リスク節）。`kind === 'mobile'` のときは `TerminalRegistry`/`RendererPool`
      の容量をモバイル用（LRU 2・WebGL 2。D28・D60 と同じ値をモバイルにも適用）に切り替える。
      `KeyInputControllerKey` を provide する）。
      対象: `packages/web/src/main.ts`・`App.vue`（既存改修）/ 根拠: 親のメタ tasks「境界の約束」・
      design「判定」
      依存: T1, T5, T6, T7
      AC: AC12, AC17
      完了メモ: task には無かったが design「WebSocket の通信」の `client.view` の項（「`scrollbackLines`
      は...デスクトップは上限値、モバイルは 1000 を申告する」）も同じ `main.ts` の結線でしか実現できない
      ため、ついでに `ViewSync` の `getScrollbackLines` を `kind === 'mobile'` で 1000 を返すよう結線した
      （tasks.md 記載漏れの穴埋め。親のメタ tasks「境界の約束」の ViewSync の再利用に含まれる範囲と判断）。
      `ContextMenu`/`NameDialog`/`ConfirmDialog`/`HelpDialog`/`GotoPicker`/`PrefixIndicator`/`Toast`/
      `ReconnectOverlay`（すべて 03-web-desktop の部品）は `MobileShell`/デスクトップ本体のどちらでも
      同じものを使う（prefix 経由の Action は ExtraKeys の Prefix ボタンからも同じ経路で届くため、
      ダイアログ類はモバイル専用に作り直す必要が無かった）。テスト: `App.test.ts` に 2 件追加
      （`KeyInputControllerKey` の provide 漏れの修正＋モバイル判定での切り替え）。
      `pnpm -s build && pnpm -s smoke` で既存のデスクトップの経路が壊れていないことを確認済み——
      **モバイルの経路の実地の確認は test 工程で行う**（テスト方針）。
- [x] T9: 統合 review ラウンド1 の 04 の範囲を直す（親 decisions.md D108）。(a) 再接続の後、サーバは新しいクライアントを fit:false で
      登録するのに、Web は「この端末に合わせる」を有効にしたまま `client.fit` を送り直さない——03 の `ViewSync.onViewEstablished`
      （`client.view` の直後・`pane.subscribe` の前）で送り直す。(b) モバイルの `client.view` の大きさを、縮小の枠（naturalSize×scale）
      の中の葉ではなく表示領域の大きさで測り、表示領域の変化（回転・ソフトキーボード・窓の幅）に追従させる（fit 中に「この端末に
      合わせる」が効かない・申告と PTY の大きさが互いに影響し合うのを防ぐ）。
      対象: `packages/web/src/mobile/useFitToScreen.ts`・`packages/web/src/mobile/MobileShell.vue`・`packages/web/src/term/ViewSync.ts`（測り方の口）・E2E
      依存: T8
      AC: AC8, AC12
      完了メモ: 新しい実装コンテキストで実装（D108）。(a) `ViewSync.onViewEstablished` で fit が有効なら `client.fit` を送り直す
      （view → fit → subscribe）。(b) `usePaneArea`：`.mobile-shell-pane`（バーと追加キーの列を除いた範囲）をセルの寸法で割った大きさを
      申告し、表示領域の変化に追従（間引きは共通の `resizeThrottle`）。ピンチの拡大中は高さに拡大率を掛け戻す。単一 pane の前提を
      `measureSinglePane` の名前と見張りで明示。独立点検の 4 件（すべて nit）を直した。足したテストは修正を外すと落ちる（E2E：再接続の
      後に PTY がデスクトップの大きさのまま・申告 53×24 に対し表示領域いっぱいは 53×41・ピンチで 53×26 に縮む）。
      `pnpm -s test`（1023 passed）・既定の E2E 54 passed。
