# herdr との対応表（AC15）

herdr（Apache-2.0。commit `da6bcd5969779bfe0396bcf89a8025d4375d611e`）の全機能一覧を洗い出し、本製品での
扱いを分類したもの（research.md F7）。この docs は、research.md の生の調査結果を**成果物として整形し、
MVP に分類した項目がすべて何らかの受け入れ基準（AC）で検証されていることを確認する**役割を持つ
（05-e2e-docs T12。このタスクが無いと `aidev coverage` の AC15 が gap のまま残る——04-mobile の review で
気づいた教訓）。

## 分類の凡例

- **MVP** = この一連の work（20260918-web-terminal-multiplexer）で作った
- **後続:◯◯** = `.aidev/backlog/product-roadmap.md` の同名の項目へ回した（この work の対象外）
- **非対応** = 本製品では扱わない（理由つき）
- **読み替え** = herdr と前提が違う（Web ブラウザ・複数クライアント等）ため、同じ目的を別の形で満たす
- **work の slug**（`20260920-…` 等）= MVP の後に、その work で作った。
  **「対応 AC」欄はその work の `requirements.md` の ID を指す**——MVP 行の AC（20260918 の体系）とは別物なので、
  どの work の AC かを欄に併記する

## 対応表

| ID | herdr の機能 | 分類 | 対応 AC |
|---|---|---|---|
| H01 | workspace の作成・名前変更・切替・閉じる（確認あり） | MVP | AC1, AC-I2 |
| H01b | workspace の自動の名前（名前を付けていない workspace を、リポジトリの根のフォルダ名・git の外ならフォルダ名・ホームなら `~` で呼ぶ。リポジトリの判定が先） | 20260921-workspace-auto-label（**herdr との違い**：① `cd` に追従しない——開いた場所で決め、復元のときに決め直す（herdr は最初の tab の根の pane のいまの場所に追従。本製品はサイドバーの git の情報も開いた場所から取るので、名前だけ追従させない）② 名前を空にして確定すると自動の名前に戻せる（herdr には戻す操作が無い）③ 自動の名前のまま変えずに確定しても付けた名前にしない（herdr の workspace は固定する。herdr の tab の名前変更と本製品の新しい tab〔D75〕と同じ扱いにそろえた）④ worktree を開く・作る操作はブランチ名を付ける（herdr は名前を渡さず自動の名前）⑤ ホームの判定は `os.homedir()` との比較で、Windows では大小を問わない（herdr は `HOME` 環境変数との比較で、Windows では既定で `HOME` が無い）⑥ Windows の UNC の共有の根（`\\srv\share\`）は共有名になる（herdr はパスそのもの。読みやすいので受け入れた）） | AC1〜AC10・AC-I2（同 work） |
| H02 | tab の作成・名前変更・切替・閉じる | MVP | AC2 |
| H03 | pane の分割・閉じる・フォーカス移動・巡回・入れ替え・拡大表示・resize モード・名前変更 | MVP | AC3 |
| H04 | tab・workspace の並べ替え | 後続:workspace のグルーピング | — |
| H05 | 端末としての pane（全画面 TUI・色・マウス報告・ブラケットペースト） | MVP | AC4 |
| H06 | scrollback（既定 10MB）・ホイール・スクロールバー | MVP（このブラウザでの行数の設定は 20260921-herdr-settings-gaps） | AC5（MVP）・AC3・AC9〜AC11（20260921-herdr-settings-gaps） |
| H07 | copy モード（キーボードでの選択・検索・コピー） | MVP | AC5 |
| H08 | マウスでの選択とコピー（M4・M5）・貼り付け | MVP | AC5 |
| H09 | リンクを開く（M6） | MVP | AC14 |
| H10 | 右クリックのメニュー（M3）とアプリへの受け渡し（M7） | MVP | AC14 |
| H11 | scrollback を `$EDITOR` で開く | 新規後続(提案):端末機能の拡張 | — |
| H12 | ポップアップ端末・独自コマンドのキー割り当て | 後続:独自コマンドのキー（20260921-keybinding-customization で「キーバインドのカスタマイズ」が済み、独自コマンドは別の項目に分けた） | — |
| H13 | 端末内の画像表示（Kitty graphics） | 新規後続(提案):端末機能の拡張 | — |
| H14 | 端末タイトルの取得と外側の端末のタイトル | 読み替え（MVP） | AC4（ブラウザのタブタイトル） |
| H15 | CJK IME の候補窓位置合わせ・prefix 中の IME 切替 | 読み替え（MVP：IME 入力）／非対応（自動切替） | AC4 |
| H16 | エージェントの検出と5状態・状態の集約・`done` の既読管理 | MVP（主要数種＋汎用） | AC6, AC7 |
| H17 | 残りのエージェントの検出・判定ルールの自動更新・`agent explain` | 後続:エージェント対応の拡充 | — |
| H18 | エージェント連携（integrations）の導入・削除・独自エージェントの状態報告 | 後続:エージェント対応の拡充 | — |
| H19 | サイドバー（Space パネル・Agent パネル）・折りたたみ・ソート | MVP（既定の表示だけ。幅と折りたたみを覚えるのは 20260921-herdr-settings-gaps） | AC6, AC7（MVP）・AC1〜AC3（20260921-herdr-settings-gaps） |
| H20 | Space 行の Git ブランチと ahead/behind の表示 | MVP | 既定の Space 行に含む |
| H21 | サイドバーの行の並び・色の条件付け・独自トークン | 新規後続(提案):外観と設定 | — |
| H22 | tab バーの位置・右端の状態表示・自動非表示 | 新規後続(提案):外観と設定 | — |
| H23 | pane の枠・隙間・エージェント名表示の設定 | 新規後続(提案):外観と設定 | — |
| H23b | 状態表示を記号にする設定（`ui.status_indicators`。字形は herdr の `symbols` と同じ × ◐ ✓ ○ ·） | 20260921-herdr-settings-gaps（**既定は herdr と逆で「記号」**。herdr は `dots`。色だけで伝える状態を既定にしない——WCAG 1.4.1・同 work の decisions D1） | AC3〜AC8（同 work） |
| H24 | テーマ（組み込み＋色の上書き＋明暗自動切替） | 20260921-theme-settings（組み込み 17 種と明暗の自動の切替。**herdr との違い**：① テーマが**端末の配色も**決める（herdr のテーマは herdr の画面の枠だけで、端末の中はホストの端末の色。ブラウザではその端末を本製品が描く）。端末の配色は各テーマの上流の配色（iTerm2-Color-Schemes）で、選んだ文字・カーソルが見えないものだけ規則で直し、ブロックカーソルの下の文字は背景色で描く ② 既定は dracula（herdr は catppuccin。今までの配色を変えない——コントラストのための押された状態の背景（アクセント）と goto の一覧の補足の文字、ブラウザが描く入力欄等を暗くした点、全テーマで規則をそろえてサイドバーの「未検証」を薄めずに描く点を除く。同 work の decisions D1〜D3・D16）③ `terminal` テーマは無い（ブラウザにホストの端末が無い）④ 自動の切替と明るいとき・暗いときを**設定画面から**選べる（herdr は設定ファイルだけ）。OS の明暗はブラウザの `prefers-color-scheme` から取る（herdr はホストの端末の報告）⑤ 対の無いテーマ（dracula・nord・vesper）の明るいときは catppuccin-latte（herdr は同じテーマのまま）⑥ 設定画面で**選んだ時点で保存**し、Esc で閉じても戻さない（herdr は選択を動かすと試し見・Enter で確定・Esc で戻す。本製品のほかの設定と同じ流儀にした）⑦ **ブラウザ（プロファイル）ごと**の設定（herdr はクライアントの機器の設定ファイル `config.toml`。SSH の先を見ていても手元の設定）⑧ 端末の中のアプリの色の問い合わせ（OSC 4/10/11/12）には、その tab の大きさを決めている——ふつうは操作している——ブラウザのテーマの色で答える（herdr はホストの端末の色）⑨ 画面の枠の色は WCAG のコントラストに足りるよう明度を寄せる（herdr の値をそのまま使わない）。**対象外**（後続。`.aidev/backlog/product-roadmap.md`）：明暗の変化をアプリへ知らせる（DSR 996・mode 2031。以前から応えておらず後退ではない）・端末の選択の背景の見やすさ（上流の配色そのものの改善）。色の個別の上書きは 20260922-theme-custom-overrides で対応（次の行）） | AC1〜AC14・AC-I1〜AC-I5（同 work） |
| H24b | 色の個別の上書き（`[theme.custom]` と明暗別の `.light`/`.dark`） | 20260922-theme-custom-overrides（設定の節「テーマ」に上級者向けの折りたたみを足し、本製品が実際に使う 19 個の CSS 変数（画面の枠の色。`uiTokens.ts` の `CSS_VARS`）を、明るいとき・暗いときの 2 層で 1 つずつ上書きできる。**herdr との違い**：① herdr の 19 トークン（`accent`・`panel_bg`・`sidebar_bg` 等の Catppuccin 由来の中間の意味付け）ではなく、本製品の 19 個の CSS 変数が対象（1:1 に対応しない。名前も粒度も違う）② herdr の「常に（`theme.custom` 本体）」に当たる第 3 の層は無い——本製品はテーマ自体を明暗の対で選ぶ設計があるため、2 層で足りる。かつ herdr は `.light`/`.dark` を `auto_switch` が入のときだけ重ねるが、本製品は自動切替の有無に関わらず、いま画面に当たっている明暗（`colorScheme`）で選ぶ（自動切替が切のままでも上書きが効く）③ 上書きに herdr の `reset`/`default`/`none` のような別名は無く、色ごとの［既定に戻す］ボタンで代える（空欄で確定しても同じ）④ 上書きした色に自動のコントラスト調整はしない（herdr と同じ。利用者の責任）⑤ 保存はこのブラウザだけ・既定との差だけ（herdr は設定ファイル）。実測: 単体（web）・E2E `theme-settings.spec.ts` 12 本（ほかの影響を受ける spec を含め一式で確認）） | AC1〜AC12・AC-I1〜AC-I5（同 work） |
| H25 | 設定画面（`prefix+s`。通知・テーマ・表示・端末・キーの 5 節。テーマは 20260921-theme-settings、キーは 20260921-keybinding-customization で足した） | 20260921-herdr-settings-gaps | AC12〜AC14（同 work） |
| H25b | 設定の再読み込み・onboarding | 新規後続(提案):外観と設定 | — |
| H26 | キー割り当ての変更・prefix を使わない直接のキー | 20260921-keybinding-customization（prefix と 34 の操作の割り当てを変えられ、直接のキー〔prefix なしの 1 打〕も付けられる。**herdr との違い**：① 編集は**設定画面の節「キー」**で、押したキーを取り込んで割り当てる（herdr は設定ファイル `[keys]` を書いて再読み込み。本製品には利用者が書く設定ファイルが無い）。保存は**ブラウザごと**の既定との差だけ（herdr のキー設定もクライアントの機器の設定）② 操作の名前は herdr の `[keys]` の項目名（`split_vertical`・`focus_pane_left`・`switch_tab`…）、記法は herdr の `prefix+shift+h`・`ctrl+alt+d`・`prefix+alt+1..9`。**`meta` は受けない**（herdr では alt の意味なので誤解を避ける。`cmd`・`super` は Cmd/Win）③ **prefix は端末へ送れる形だけ**（`ctrl+英字`〔`ctrl+[`・`ctrl+space` 等の制御文字を含む〕・`alt+1 文字`・`ctrl+alt+英字`・修飾なしの F1〜F12。2 度押しでそのキー自身を端末へ送るため。herdr の `esc` や `f12` のうち `esc` は不可）④ 直接のキーは **ctrl・alt・cmd を含む chord か F キー**（herdr は修飾なし〔shift だけを含む〕の印字できる文字だけを「安全でない」として無効にし、修飾なしの `tab`・`enter`・矢印・`esc` や `shift+tab` は通す。**本製品はそれらも拒否する**——端末の入力を奪うため。**herdr より厳しい**）。**terminal モードでだけ**引き、押しっぱなしの繰り返しは食う ⑤ **ブラウザ・OS が先に受けるキー（`Ctrl+T`・`Ctrl+N`・`Ctrl+W` 等）は画面に届かず割り当てられない**（herdr の「Alt・Cmd は端末次第」の相当。全画面のときだけ使える Keyboard Lock API は使わない）⑥ AltGr で合成された文字は取り込まない（配列で変わる）。macOS の Option の文字化けは `code` で元へ戻す（macOS のときだけ）⑦ herdr の「衝突は先に登録した方を残し後を無効にする」を読み込みにも使い（上書きが既定に勝つ）、編集の画面は衝突を作らせず理由を出す ⑧ herdr が文書で勧める `ctrl+alt` の直接のキーの一式を 1 操作で足せる（環境で届かないキーがある——Linux のデスクトップの一部の `Ctrl+Alt+L`・AltGr で `[` `]` を打つ配列の `Ctrl+Alt+[` `]`——ので、ボタンの脇に注記し、［変更］で付け替える）⑨ キー一覧・トースト・通知の案内文・モバイルの Prefix ボタンは現在の割り当てに従う。**対象外**（後続。`.aidev/backlog/product-roadmap.md`）：herdr 互換以外のプリセット・navigate モードの移動キー（herdr の `navigate_*`。copy・resize の中は herdr でも固定）・herdr にあって本製品に操作自体が無いもの〔前後の workspace・直前の pane・tab の並べ替え・pane の resize の直接のキー・agent への移動・scrollback を `$EDITOR` で開く・設定の再読み込み〕・独自コマンドのキー〔H12〕・節「キー」の操作の絞り込み） | AC1〜AC14・AC-I1〜AC-I5（同 work） |
| H27 | ヘルプ（`prefix+?`）と絞り込み | MVP | AC13, AC-I1 |
| H28 | navigate モード（`prefix+w`）と goto（`prefix+g`） | MVP | AC13, AC-I3 |
| H29 | 通知（アプリ内トースト／OS 通知／音／`prefix+o` で対象へ移動） | 20260920-agent-notifications | AC1〜AC16（同 work） |
| H29b | 通知音の差し替え・エージェントごとの音・外側端末への委譲 | 非対応（音源の同梱はせず内蔵音のみ。外側端末はブラウザに無い） |  — |
| H30 | 切り離し（`prefix+q`）と再接続 | MVP（読み替え：このブラウザの接続だけを切る） | AC8 |
| H31 | サーバ再起動後のレイアウト復元 | **MVP**（ゲートで確定・decisions.md D7） | AC18 |
| H32 | 画面履歴の保存・再生、エージェント会話の再開、live handoff | 新規後続(提案):セッション永続化の拡張 | — |
| H33 | 名前付き session | 新規後続(提案):セッション永続化の拡張 | — |
| H34 | 複数クライアントの同時接続とサイズの決め方 | MVP | AC9 |
| H35 | モバイル向けの1列表示と移動用メニュー | MVP | AC12 |
| H36 | 新規 pane の既定シェル・起動モード | MVP（既定の挙動だけ。シェルは `--shell`。herdr の `terminal.shell_mode`（ログインシェルにするか）に当たる設定は無い） | AC3・AC16（分割した pane・Windows ネイティブの pane が既定のシェルで起動する） |
| H36b | 新しく開く場所の方針（`terminal.new_cwd`：引き継ぐ・ホーム・起動した場所・指定した場所） | 20260921-new-terminal-cwd（**置き場所が herdr と違う**：herdr はサーバの設定ファイル、本製品は**ブラウザごと**の設定（`prefix+s` の「端末」）で、作成の要求に載せる。既定は herdr と同じ「引き継ぐ」で、新しい workspace・tab・分割のすべてに効く。**元の pane が無いときの代わりも違う**：herdr は `$HOME`、本製品は以前と同じ場所（新しい workspace ならサーバを起動した場所、tab ならその workspace の場所）。worktree を開く操作は herdr の `--cwd` と同じく明示した場所が勝つ） | AC1〜AC11（同 work） |
| H37 | Git worktree の作成と一覧（workspace のメニュー・`prefix+G`） | 20260920-git-worktree-actions | AC1〜AC6（同 work） |
| H37b | Git worktree の削除とグループ化 | 後続:workspace のグルーピング | — |
| H38 | CLI / socket API（workspace・tab・pane・agent の操作） | 後続:外部操作 API / CLI | — |
| H39 | エージェント自動化（`agent start`／`prompt --wait` 等） | 後続:外部操作 API / CLI | — |
| H40 | pane 単体接続・閲覧専用購読・制御ストリーム | 後続:外部操作 API / CLI | — |
| H41 | pane の移動（別 tab・新規 tab・新規 workspace） | 後続:D&D による pane の分割/分割解除/移動 | — |
| H42 | プラグイン（manifest・アクション・イベントフック等） | 後続:エージェント対応の拡充 | — |
| H43 | 保存済みマシン（複数 SSH 先の集約）・`--remote`・`--machine` | 後続:複数ホストの集約 | — |
| H44 | リモートへのクリップボード画像の転送 | 後続:複数ホストの集約 | — |
| H45 | 自己更新・更新チャネル・バージョン確認 | 新規後続(提案):配布と運用 | — |
| H46 | シェル補完・ログ・`--default-config` | 新規後続(提案):配布と運用（ログは MVP に最低限必要） | — |
| H47 | herdr の中で herdr を起動する（入れ子）の許可 | 非対応（ブラウザ UI の入れ子に意味が無い） | — |
| H48 | 外側の端末固有の設定（host_cursor 等） | 非対応（外側の端末が存在しない） | — |
| H49 | Windows ネイティブ（ConPTY）での動作 | MVP（本体の動作）／herdr と同じく一部非対応 | AC16 |

**確認**：MVP に分類した全項目（H01〜H03, H05〜H10, H14, H15, H16, H19, H20, H27, H28, H30, H31, H34, H35,
H36, H49）が、上の表のとおりいずれかの AC を持つ。`aidev coverage --strict` が示す gap が 0 件であることを
tasks 工程で確認済み（このタスクは、その被覆が実際の docs としても読める形になっているかの仕上げ）。

## 未検証のまま見送った項目

自動テスト・実機検証のどちらでも確認していない、または意図的に省略したふるまい。
「不具合」ではなく、**MVP としてどこまで確かめたかの境界線**として記録する。使っていて出会う今の版の限界
（接続が黙って切れている間の入力・IME の変換中の文字・再接続で戻らない端末のモード・「この端末に合わせる」の食い違い）は
`docs/verification.md`「既知の制約」にまとめた。

- **copy モードの `0`・`^`・`$`・Home/End・`g`/`G`・`ctrl+b`**：**実装していない**（意図して見送った。decisions.md D63・
  03-web-desktop T8）。copy モードのキーは design.md の原文の一覧どおり（移動 `h/j/k/l`・`w/b/e`・`W/B/E`・`{`/`}`・
  `PageUp`/`PageDown`・`ctrl+f`・`ctrl+u`/`ctrl+d`、検索、選択、コピー）。`0`〜`G` の 7 つは herdr が持つかをソースを深追いせず
  未確認のまま足さず、`ctrl+b` は copy モードの中でも prefix として効くので、割り当てても働かないため足さなかった。copy モードで押しても
  何も起きないのが今の仕様で、実機の確認の対象ではない。
- **M11（マウス報告中の Shift+クリックでの選択）**：アプリ側が実際に受け取ったかの自動検証が難しく（マウス報告を解釈する
  アプリの実装に依存する）、05-e2e-docs T10 では自動化を見送った。`docs/verification.md`「Linux（CI・手元）」の手元の項目で、
  人手で確かめる。M7（右クリックの振り分けと pane の枠）も同じ理由で見送っていたが、2026-09-20 に見つけた 2 件の不具合
  （既定の宛先のままでも右ボタンの報告がアプリへ届く・pane の枠の右クリックが未実装。decisions.md D109）を D110 で直したときに
  E2E（`packages/e2e/src/specs/keys-mouse-dialogs.spec.ts`。`cat -v` の行に出る報告と、ブラウザが送った入力の両方で確かめる）を
  足した。手元の手順も `docs/verification.md` に残す。
- **IME の変換候補窓の実際の見た目・位置合わせ**：Playwright は実 OS の IME を経由しないため、
  合成イベント（`compositionstart`/`compositionend`）を直接発火する形でしか自動確認できない
  （`terminal-app.spec.ts`）。実際の候補窓の見た目は `docs/verification.md`「Linux（CI・手元）」の手動確認に委ねる。
  CJK IME の候補窓の位置合わせ自体（H15 の一部）は非対応。
- **`ProcessMatcher` で意図的に省いた herdr の挙動**（decisions.md D49・02-agent-detection T6）：
  シンボリックリンクをファイルシステムで解決する処理（純関数に保つ設計のため）、Letta 専用の
  「対話的な起動か」の追加判定、`Agent::Omp`・`Agent::Mastracode`（画面マニフェストが無いため対象外）。
- **xterm.js のモバイル未解決課題**（decisions.md D83）：Android Chrome＋Gboard の文字入力の乱れ
  （upstream #3600）、タッチ端末でのコピー＆ペースト不可（upstream #3727）。本製品のコードでは
  回避策を入れていない（upstream の課題として扱う）。
- **node-pty の Windows（ConPTY）の既知の不具合**（research.md F8.1）：シェル終了ごとの `conhost.exe`
  残留（#965）・kill の競合（#952・#967）・閉じた pane の resize での例外（#827）。本製品側の回避策は
  入れていない。`docs/verification.md`「Windows ネイティブ（WSL2 の母艦の Windows で直接）」で実害の有無を確認する運用にした。
- **AC17 の絶対値の合否判定（自動テストでは問わない）**：`packages/e2e/src/specs/performance.spec.ts`（T11）は値を出すだけで、
  p95 等の絶対値の合否を自動では判定しない（環境依存でぶれるため。tasks.md のリスク参照）。合否は、GPU があり負荷の少ない
  実機で `docs/verification.md`「性能の計測（AC17）」の手順で測り、利用者が判断する（とくに大量出力中の 16 pane）。
