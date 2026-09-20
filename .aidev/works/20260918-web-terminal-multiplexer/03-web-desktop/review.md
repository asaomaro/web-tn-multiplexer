# レビュー: 03-web-desktop（Web デスクトップ UI）

## ラウンド 1（2026-09-18）

対象: T1〜T26 の全実装（`packages/web/src/*`・`packages/server/src/smoke.ts`）。観点は要件適合・価値適合・
正確性・規約適合（`.aidev/conventions/` が空のため全件 `[conv:-]`）・保守性。

`decisions.md` の D55〜D81（herdr 実測による訂正・意図的な簡略化・test 工程で発見した実バグ 2 件）を
前提として読んだ上で、それらでは拾われていない指摘を洗い出した。

- [must] `view.restoreView` の「前回の tab がまだあれば復元する」分岐が `focusedPaneId` を設定していない
  ため、ページの再読み込み（F5）のたびにどの pane にもキーボードフォーカスが入らず、AC-I3（マウス無しで
  全操作）に反する (packages/web/src/store/view.ts:77) [conv:-]

上記 1 件を修正済み（D82）：`restoreView` の引数を「tab の存在確認」から「tab の focusedPaneId の解決」に
変え、復元時にも正しくフォーカスを合わせるようにした。回帰テストを `view.test.ts`・`StoreAdapter.test.ts`
に追加。修正後、`pnpm -s typecheck && pnpm -s lint && pnpm -s test`（686 passed）・`aidev smoke`（pass）を
再確認済み。

## ラウンド 2（2026-09-18・修正の確認）

ラウンド 1 の指摘（`view.restoreView` の `focusedPaneId`）の修正を確認した。`aidev coverage --strict` は
ラウンド 1 時点と同じ結果（gap は AC15 のみ、対象外）——修正が被覆に悪影響を与えていない。
`packages/web/src/store/view.ts`/`StoreAdapter.ts` の差分を再読し、`findTabFocusedPaneId` が
「tab が存在しない」場合に `null` を返す契約と、`StoreAdapter.ts` 側の実装（`tab.workspaceId !==
workspaceId` のときも `null` を返す）が一致していることを確認した。新規の指摘なし。

それ以外に確認した観点（指摘なし）:
- composition root（`main.ts`）の循環 port 結線（D77）・端末フォーカス中の window keydown ガード・
  ダイアログ⇔`KeyRouter` モード同期：正しく機能している。
- `ActionDispatcher`/`store/view` のダイアログ確定・取り消し・フォーカス復元の契約：一貫している。
- 4 つのダイアログ（NameDialog・ConfirmDialog・HelpDialog・GotoPicker）のキーボード/マウス操作：
  design のダイアログ共通規則・herdr 実測（D76）と整合。
- `smoke.ts` の WebSocket クライアント書き直し（D79）：持続的な 1 つのハンドラで取りこぼしが無い、
  レースの心配も無い設計になっている。
- `KeyRouter.ts` の D81 修正の完全性：`CopyMode`/`ResizeMode`/`NavigateMode` はいずれも「未対応キーは
  黙って無視する」設計のため、修飾キー単体による同種の不具合は起きないことをコードで確認済み。

## 総評

要件（AC1〜AC18・AC-I1〜AC-I5）・design への対応は `aidev coverage --strict` で被覆漏れが無いことを
確認済み（AC15 は subtask 横断の対応表であり、このコード自体のタスクを要しない——gap として残るが
`aidev coverage` 自体が「全 subtask の tasks が済むまで致命にしない」としている）。
D55〜D82 の記録から、herdr との挙動差・実装時の判断・test/review で発見した不具合のいずれも、
根拠と対処が追跡可能な形で残っている。今回の review で見つかった 1 件（F5 再読み込み後のフォーカス
喪失）は影響範囲が広い（毎回のリロードで発生）ため must としたが、修正は単一関数のシグネチャ変更に
閉じており、他コンポーネントへの波及は無い。修正・再検証済みのため、deliver へ進めて問題ない。


## ラウンド 3（2026-09-19・T27／D95：切断中は入力を止める）

対象: T27 の差分（`net/Connection.ts`・`term/TerminalRegistry.ts`・`main.ts`・`components/ReconnectOverlay.vue`
と各テスト）。タスク点検（delegated・指摘 7 件、全て反映済み。下の「タスク点検ログ」）で直した後の最終形を
読んだ。観点は要件適合（AC8）・価値適合（利用者の判断「切断中は入力を止める」の意図）・正確性・規約・保守性。

指摘なし。確認した観点：
- **要件適合（AC8）**：再接続で構成と画面が戻る既存の振る舞いを壊していない——`open` を hello 成功後に
  移した影響は、実物の Chromium での既存の E2E 28 件（再接続・サーバ再起動・複数クライアント・ログイン拒否
  を含む）が全て pass することで確認済み（test-result.md のこのラウンド）。
- **価値適合**：利用者が選んだのは「打った文字が黙って消えるのを防ぐ」ための可視化。`connecting` と
  `reconnecting` の両方でオーバーレイが「つながるまで入力できません」を示し、その間 `onData` 経由の入力は
  送らない。**切断の瞬間をまたいだ入力の先頭が欠けること自体は残る**（保存して後で送る案は選ばれなかった）
  ことを D95「残る制約」に明記し、利用者にも説明済み。
- **正確性**：`applySnapshot` → `onConnectionState("open")` の順で、`setInputEnabled` は `onData` の時点で
  見るフラグなので、snapshot で新しく作られる xterm.js との順序に依存しない。hello 失敗・切断・401・
  detach・4401 の各経路で `open` のまま入力を受け付ける窓が残っていないことをコードで確認した
  （単体テストで各経路を押さえている）。`scheduleReconnect` の `reconnecting` は `handleClose` と重複するが
  無害（再試行の socket が開かずに閉じた場合も同じ経路を通るので、意図の明示として残す）。
- **既知の差**（D95 の 4 に記載済み、許容）：hello 待ちの短い間は socket が開いているため、
  `KeyInputController` が直接送るバイト列（`ExtraKeys` の注入等）は送られる。接続は実際に使えるので実害は無い。
- 規約：`.aidev/conventions/` が空のため条項参照は無し。コメント・テストの書き方は周辺に揃っている。


## ラウンド 4（2026-09-19・T28／D96：xterm.css、T29／D97：焦点と表示の食い違い。親の統合 test からの差し戻し）

対象: T28・T29 の差分と各テスト。T29 はタスク点検（delegated・指摘 4 件、全て反映済み）の後の最終形を読んだ。

指摘なし。確認した観点：
- **要件適合**：T28 は AC4（端末の表示）そのもの——修正前は端末の中身が一切見えていなかった。smoke に描画の
  確認を足し、import を外すと smoke が落ちることを実地に確かめた（今後の test 工程で毎回確かめられる）。
  T29 は AC1〜AC3（閉じた後も操作を続けられる）・AC-I3（キーボードだけで続けられる）・AC-I4（焦点の行き先）。
  いずれも常設の E2E に「閉じた後、クリックせずにそのまま入力が届く」を足して確かめている。
- **価値適合**：閉じた後に何も表示されない・どこにも焦点が無い、は MVP の基本操作を壊していた。方向での焦点移動
  直後の入力の取りこぼしは、LAN 越しで遅延が増えるほど起きやすい。どちらも利用者に直接見える問題を直している。
- **正確性**：`neighborPaneId` はサーバの `LayoutTree.neighbor` と同じ規則（点検で1行ずつ突き合わせ済み・同じ期待値の
  テスト）。`repairView` は「閉じたものの代わり」をサーバの規則（残りの先頭・最初の葉）だけで選び、生きている pane を
  持たない tab・workspace を選ばない。ダイアログ中は戻り先だけを差し替える。
- **残る制約（許容。利用者に相談する）**：分割・新しい tab・新しい workspace の直後、サーバが新しい pane を作るまでの
  入力は移動前の pane に入る（D97）。zoom 中の方向移動が隠れた pane へ焦点を移すのは修正前と同じ振る舞い。
- 規約：`.aidev/conventions/` が空のため条項参照は無し。


## ラウンド 5（2026-09-19・T30／D99：新しい pane を作る操作の応答待ちの間の入力を溜める。利用者の判断）

対象: T30 の差分（`net/InputGate.ts`・`ActionDispatcher.ts`・`main.ts`・`ports.ts`・`TerminalRegistry.ts`）と各テスト。
タスク点検（delegated・指摘 6 件）を反映した後の最終形を読んだ。

指摘なし。確認した観点：
- **要件適合・価値適合**：利用者が選んだ「溜めて新しい pane へ流す」を満たす——分割・新しい workspace の直後に打った行が
  新しい pane に先頭から丸ごと届くことを E2E で確かめた（関所を外すと落ちる）。溜めてはいけない入力（ポインタ操作・
  フォーカスの報告・他の pane 宛て）は溜めない。
- **正確性**：入力は全て `sendInput` を通るので、関所 1 か所で全ての経路を扱える。保持の列は、古いほうから順に流し先が
  決まったものだけ流すので、応答の順番が入れ替わっても打った順番を追い越さない（単体テスト）。流し先が受けられない
  （閉じている・zoom で隠れている）ときは元の pane へ戻す。応答が来なくても 5 秒で元の pane へ流し、入力を失わない。
- **既知の制約**（D99 に記録）：IME の変換中の文字は溜まらない。
- 規約：`.aidev/conventions/` が空のため条項参照は無し。

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [should][conv:-] packages/e2e/src/specs/debug-offline-input.spec.ts 使い捨ての実地確認用 spec が Playwright の testDir に残っている / 対応: 修正済（T27・ラウンド1。test 工程の実地の確認で使ったあと削除する）
- [nit][conv:-] packages/web/src/term/TerminalRegistry.ts setInputEnabled のコメントが「経路ごとに塞がなくてよい」としているが、KeyInputController が直接送るバイト列は止まらない / 対応: 修正済（T27・ラウンド1。例外をコメントに明記）
- [nit][conv:-] packages/web/src/components/ReconnectOverlay.vue `connecting`（「再接続」ボタンの直後等）の間は入力が止まるのに何も表示されない / 対応: 修正済（T27・ラウンド1。connecting でも出す）
- [nit][conv:-] packages/web/src/net/Connection.ts:156 socket が開いた時点で open にしており、hello 失敗時は閉じ直すまで入力を受け付けたまま捨てる / 対応: 修正済（T27・ラウンド1。open を hello 成功後に移した）
- [nit][conv:-] packages/web/src/term/TerminalRegistry.ts xterm.js の disableStdin は内部 textarea を readOnly にし、モバイルで再接続のたびにソフトキーボードが閉じうる / 対応: 修正済（T27・ラウンド1。onData で止める方式に変更。実機の確認は親の統合 test の AC12）
- [nit][conv:-] packages/web/src/net/Connection.test.ts 切断後の /api/session が 401 の経路（reconnecting を先に出すようになった経路）にテストが無い / 対応: 修正済（T27・ラウンド1。テストを追加）
- [nit][conv:-] decisions.md D95・03 の tasks.md T27 の影響／対象に Connection.ts が無い / 対応: 修正済（T27・ラウンド1）
- [should][conv:-] packages/web/src/store/StoreAdapter.ts ダイアログを開いている間に焦点の pane が閉じられると、移し直しが `term.focus()` を起こしてダイアログからフォーカスを奪い、閉じた後は `preDialogFocusPaneId`（閉じた pane）へ戻ってしまう / 対応: 修正済（T29・ラウンド1。ダイアログ中は `retargetPreDialogFocus` で戻り先だけ差し替える）
- [should][conv:-] packages/web/src/store/viewRepair.ts 代わりの tab / pane を、焦点の移動では更新されない古い `activeTabId`・`tab.focusedPaneId` から選んでおり、サーバの選ぶものとずれる / 対応: 修正済（T29・ラウンド1。閉じたものの代わりはサーバの規則（残りの先頭・最初の葉）だけで選ぶ）
- [should][conv:-] packages/web/src/store/viewRepair.ts tab が 2 つ以上ある workspace を閉じる連鎖の途中で、中身の無い（これから閉じられる）tab へ表示を移し、閉じた pane の xterm.js を作って購読しに行く / 対応: 修正済（T29・ラウンド1。生きている pane を持たない tab・workspace は無いものとして扱う）
- [nit][conv:-] packages/web/src/store/StoreAdapter.ts private メソッド `repairView()` が import した関数と同名で再帰に見える / 対応: 修正済（T29・ラウンド1。`applyViewRepair` に改名）
- [should][conv:-] packages/web/src/actions/ActionDispatcher.ts zoom 中に分割すると新しい pane は隠れたままなのに溜めた入力がそこへ流れ、以後の入力は元の pane に入って 1 行が分かれる / 対応: 修正済（T30・ラウンド1。流し先が zoom で隠れているときは元の pane へ戻す。根本の「分割しても zoom を解除しない」は 01 の D100）
- [should][conv:-] packages/web/src/net/InputGate.ts 元の pane の上でのポインタ操作（マウスの報告・ホイールの矢印キー）まで溜めて新しいシェルへ流す / 対応: 修正済（T30・ラウンド1。`origin: "pointer"` は溜めない）
- [nit][conv:-] packages/web/src/net/InputGate.ts 保持が重なると入力の順番と宛先が崩れる / 対応: 修正済（T30・ラウンド1。順番つきの列にした）
- [nit][conv:-] packages/web/src/actions/ActionDispatcher.ts 流し先の pane が既に閉じていると溜めた文字が捨てられる / 対応: 修正済（T30・ラウンド1。元の pane へ戻す）
- [nit][conv:-] packages/web/src/net/InputGate.ts IME の変換中の文字は保持の対象にならない / 対応: 許容（T30・ラウンド1。変更前と同じ振る舞い。D99 に既知の制約として記録）
- [nit][conv:-] packages/e2e/src/specs/workspace-tab-pane.spec.ts・packages/web/src/actions/ActionDispatcher.test.ts テストが主張を示しきれていない / 対応: 修正済（T30・ラウンド1）
- [should][conv:-] docs/verification.md 「403 は token の誤りと同じ表示になりうる」が T32 の後の画面（403 専用の文言と写せる `--origin` の行）と食い違っていた（T32） / 対応: 修正済
- [nit][conv:-] packages/web/src/components/LoginView.vue 403 の文言が「token の誤りではない」と言い切っていたが、サーバは 403 の時点では token をまだ確かめていない（T32） / 対応: 修正済
- [nit][conv:-] packages/web/src/components/LoginView.vue 429 の「20 回を超えたとき」が実際の制限（20 回に達した時点で止める）とずれていた（T32） / 対応: 修正済
- [nit][conv:-] packages/web/src/net/Connection.ts `Retry-After` の 0・過去の日付・極端に大きい値で「0 秒ほど」「Infinity 分ほど」と出ていた（T32） / 対応: 修正済

## ラウンド 6（2026-09-19・T31／T32（D105）。親の統合 test ラウンド5 からの差し戻し）

見たもの：`aidev coverage`（gaps=0）・要件適合（AC12／AC4：モバイルで表示する pane を切り替えても隠れた pane の PTY が縮まない。
AC10／AC11：ログインの失敗の理由が分かり、403 では写せる `--origin` の行が出る）・価値適合（403 の利用者が token の誤りと思い込んで
`wtm token reset` へ進まない。起動の途中にログインしても「接続中…」で待ち、固まらない——どれも実物のサーバの E2E で確認）・
正確さ（タスク点検で T31 は 0 件、T32 は 4 件を反映。Vue の関数 ref の呼ばれ方は点検側が Vue 3.5 の `setRef` を読んで確認）。

指摘なし。

件数（ラウンド1〜6 の通算。タスク点検ログは数えない）：must 1・should 0・nit 0。
- [should][conv:-] packages/web/src/net/Connection.ts `/api/session` は 204 なのに `/ws` だけが 403（docs の nginx の例で `--origin` を付けずに再起動）だと、1006 → 確認 204 → 繋ぎ直しが理由を示さず続く（T33） / 対応: 修正済（確認は通るのに開けない試みが続いたら `--origin` の確認を促す）
- [should][conv:-] packages/web/src/net/Connection.ts 前段のプロキシが Host を書き換え `--origin` は正しい構成（D106 の残る制約）で、`/api/session` の 403 で `rejected` に止まり、以前は繋がっていたのに二度と繋がらない（T33） / 対応: 修正済（403 でも `/ws` を 1 回試し、それも失敗したら `rejected`）
- [should][conv:-] packages/web/src/term/TerminalRegistry.ts RIS で消えるのに SNAPSHOT で戻らない端末の状態（?25・?1006・DECSTBM・DECSCUSR 等。`@xterm/addon-serialize` 0.14.0 が出さない）があり、再接続のたびに動いている TUI が崩れうる（以前の `reset()` と新しいページでも同じ）（T33） / 対応: 既知の制約として D107 に記録し、サーバの Mirror での対応を backlog へ
- [nit][conv:-] packages/web/src/term/ViewSync.ts ws の `onopen` から hello の応答までの間の commit が新しい接続へ先に送られうる（view の無い subscribe・SNAPSHOT の二重）（T33） / 対応: 修正済（`onConnectionOpened` まで送信を控える）
- [nit][conv:-] packages/web/src/net/ports.ts・components/ReconnectOverlay.vue コメントが古い（`term.reset()`・表示のみ）（T33） / 対応: 修正済

## ラウンド 7（2026-09-20・T33（D107）。統合 review ラウンド1 からの差し戻し）

見たもの：統合 review ラウンド1 の 03 の範囲（must 1・must 3 のデスクトップ側・should 1 のクライアント側・nit の `client.error`）が
解消したか・要件適合（AC4・AC8・AC10・AC11）・価値適合（再接続しても画面が止まらない・窓を変えれば PTY が追従する・許可外の
アドレスでは理由が出る——どれも同じページのままの E2E で確認）。正確さはタスク点検（独立）で見て 4 件を反映・1 件を既知の制約に。

指摘なし。

件数（ラウンド1〜7 の通算。タスク点検ログは数えない）：must 1・should 0・nit 0。
- [should][conv:-] packages/web/src/term/MouseBridge.ts `swallowMouseUp` は同じボタンの mouseup が届いたときしか外れず、取りこぼすと無関係の mouseup を握りつぶし続ける（pane に送る pane の離した報告・macOS の Ctrl＋クリック後の左の mouseup＝選択の終わりとコピー）（T34） / 対応: 修正済
- [should][conv:-] packages/web/src/components/PaneFrame.vue キーボードの Tab で届く枠は最初の pane のものだけで、分割した状態では 2 つ目以降の pane のメニューをキーボードで開けない（design M7・D110 と食い違う）（T34） / 対応: 修正済
- [nit][conv:-] packages/web/src/term/MouseBridge.ts 左→右→左を離す→右を離すの順で xterm.js の document の listener が残り、後の mouseup・drag がアプリへ報告される（T34） / 対応: 修正済
- [nit][conv:-] packages/web/src/components/ContextMenu.vue 「閉じる」でこれから消える要素へフォーカスを戻し、選ばれていない pane の枠から開いたときに body に落ちる（T34） / 対応: 修正済
- [nit][conv:-] packages/e2e/src/specs/mobile.spec.ts タップしても開かないことの確認が固定の 500ms の待ちに頼り、遅い環境で素通りしうる（T34） / 対応: 修正済

## ラウンド 8（2026-09-20・T34（D110）。M6・M7）

見たもの：design の M3・M6・M7 と実装の一致・要件適合（AC14）・価値適合（既定の設定で右クリックがアプリへ漏れない・マウスを使う
アプリの動いている pane でもメニューを開ける・誤クリックでリンクが開かない——実物のブラウザの E2E で確認）。正確さはタスク点検
（独立）で見て 5 件を反映。

指摘なし。

件数（ラウンド1〜8 の通算。タスク点検ログは数えない）：must 1・should 0・nit 0。
