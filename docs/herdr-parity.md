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
| H02 | tab の作成・名前変更・切替・閉じる | MVP | AC2 |
| H03 | pane の分割・閉じる・フォーカス移動・巡回・入れ替え・拡大表示・resize モード・名前変更 | MVP | AC3 |
| H04 | tab・workspace の並べ替え | 後続:workspace のグルーピング | — |
| H05 | 端末としての pane（全画面 TUI・色・マウス報告・ブラケットペースト） | MVP | AC4 |
| H06 | scrollback（既定 10MB）・ホイール・スクロールバー | MVP | AC5 |
| H07 | copy モード（キーボードでの選択・検索・コピー） | MVP | AC5 |
| H08 | マウスでの選択とコピー（M4・M5）・貼り付け | MVP | AC5 |
| H09 | リンクを開く（M6） | MVP | AC14 |
| H10 | 右クリックのメニュー（M3）とアプリへの受け渡し（M7） | MVP | AC14 |
| H11 | scrollback を `$EDITOR` で開く | 新規後続(提案):端末機能の拡張 | — |
| H12 | ポップアップ端末・独自コマンドのキー割り当て | 後続:キーバインドのカスタマイズ | — |
| H13 | 端末内の画像表示（Kitty graphics） | 新規後続(提案):端末機能の拡張 | — |
| H14 | 端末タイトルの取得と外側の端末のタイトル | 読み替え（MVP） | AC4（ブラウザのタブタイトル） |
| H15 | CJK IME の候補窓位置合わせ・prefix 中の IME 切替 | 読み替え（MVP：IME 入力）／非対応（自動切替） | AC4 |
| H16 | エージェントの検出と5状態・状態の集約・`done` の既読管理 | MVP（主要数種＋汎用） | AC6, AC7 |
| H17 | 残りのエージェントの検出・判定ルールの自動更新・`agent explain` | 後続:エージェント対応の拡充 | — |
| H18 | エージェント連携（integrations）の導入・削除・独自エージェントの状態報告 | 後続:エージェント対応の拡充 | — |
| H19 | サイドバー（Space パネル・Agent パネル）・折りたたみ・ソート | MVP（既定の表示だけ） | AC6, AC7 |
| H20 | Space 行の Git ブランチと ahead/behind の表示 | MVP | 既定の Space 行に含む |
| H21 | サイドバーの行の並び・色の条件付け・独自トークン | 新規後続(提案):外観と設定 | — |
| H22 | tab バーの位置・右端の状態表示・自動非表示 | 新規後続(提案):外観と設定 | — |
| H23 | pane の枠・隙間・エージェント名表示の設定 | 新規後続(提案):外観と設定 | — |
| H24 | テーマ（組み込み＋色の上書き＋明暗自動切替） | 新規後続(提案):外観と設定 | — |
| H25 | 設定画面・設定の再読み込み・onboarding | 新規後続(提案):外観と設定 | — |
| H26 | キー割り当ての変更・prefix を使わない直接のキー | 後続:キーバインドのカスタマイズ | — |
| H27 | ヘルプ（`prefix+?`）と絞り込み | MVP | AC13, AC-I1 |
| H28 | navigate モード（`prefix+w`）と goto（`prefix+g`） | MVP | AC13, AC-I3 |
| H29 | 通知（トースト／外側端末／OS／音） | 新規後続(提案):通知 | — |
| H30 | 切り離し（`prefix+q`）と再接続 | MVP（読み替え：このブラウザの接続だけを切る） | AC8 |
| H31 | サーバ再起動後のレイアウト復元 | **MVP**（ゲートで確定・decisions.md D7） | AC18 |
| H32 | 画面履歴の保存・再生、エージェント会話の再開、live handoff | 新規後続(提案):セッション永続化の拡張 | — |
| H33 | 名前付き session | 新規後続(提案):セッション永続化の拡張 | — |
| H34 | 複数クライアントの同時接続とサイズの決め方 | MVP | AC9 |
| H35 | モバイル向けの1列表示と移動用メニュー | MVP | AC12 |
| H36 | 新規 pane の既定シェル・起動モード・cwd の方針 | MVP（既定の挙動だけ） | AC3（分割時の cwd 引き継ぎ） |
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
