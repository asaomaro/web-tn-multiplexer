# 調査: Web ターミナルマルチプレクサ（herdr 相当）— MVP 基盤

> **出典の略記**
> - `[H]<file>:<行>` = herdr 公式ドキュメントのソース（v0.9.1＝調査時点の最新安定版）
>   https://github.com/herdrdev/herdr/blob/da6bcd5969779bfe0396bcf89a8025d4375d611e/docs/versions/0.9.1/website/src/content/docs/<file>
>   （`docs/versions/manifest.json` の `"current": "0.9.1"`。herdr.dev/docs はこのソースから生成される。
>   旧 URL `github.com/ogulcancelik/herdr` は herdrdev/herdr へ 301 で転送される）
> - `[H-cfg]<key>` = 同 v0.9.1 の設定リファレンス `docs/versions/0.9.1/website/src/data/config-reference.json` の該当キー（型・既定値・説明）
> - `[H-root]<path>` = 同コミットのリポジトリ直下からのパス（`CHANGELOG.md`・`LICENSE`・`distribution/` 等）
> - 外部の技術情報は各項目に URL を添える。**(推測)** と書いたものは出典の無い推論。
> - **herdr のライセンスは現在 Apache-2.0**（F12 参照。requirements の「AGPL」は古い情報だった）。
>   本調査で読んだのはドキュメントと状態判定ルール（`distribution/agent-detection/`）だけで、Rust のソースコードは読んでいない。

## 調査の問い

- Q1: herdr の全機能項目は何か。それぞれを本製品でどう扱うか（MVP / 後続 work / 非対応）。→ AC15
- Q2: herdr の既定キー割り当てとモードの正確な内容（解説記事同士で食い違っていた）。→ AC13
- Q3: herdr のマウス操作の一覧。→ AC14
- Q4: エージェントの検出方法と 5 状態の定義（`done` の意味、状態の集約）。主要エージェントとして何を選ぶか。→ AC6, AC7
- Q5: 複数クライアントが同時に接続したときの画面サイズと表示の扱い。→ AC9
- Q6: 「セッション状態」の範囲。サーバ再起動をまたぐ復元まで含むか。→ AC8
- Q7: 技術スタック（TypeScript / Rust）の比較材料。PTY、サーバ側の端末状態の保持、Windows ConPTY、配布形態。
- Q8: 別マシンのブラウザから安全に接続する方法（認証・暗号化・既知の落とし穴）と、先行事例。→ AC10, AC11
- Q9: ブラウザ上の制約（捕まえられないキー、IME、モバイルでのソフトキーボード、クリップボード、描画性能）。→ AC4, AC5, AC12, AC-I5
- Q10: UI 部品の確立したパターン（WAI-ARIA APG）と、端末マルチプレクサの慣習とのぶつかり方。→ AC-I1〜AC-I5
- Q11: 実装の起点（アンカー）。

## 判明した事実

### F1: herdr の概念モデル（Q1）

- F1.1 階層は **session → workspace → tab → pane**。workspace は最上位のプロジェクト単位で、tab と pane を持つ。
  サイドバー上の workspace の状態は、配下のエージェントから集約される（`[H]concepts.mdx:8-12`）。
- F1.2 tab は workspace 内のレイアウト。pane は実際の端末で、右と下へ分割でき、名前変更・出力の読み取り・入力の送信・閉じることができる（`[H]concepts.mdx:14-24`）。
- F1.3 session は永続するサーバの名前空間。名前付き session は pane・ソケット・永続状態が完全に独立する（`[H]concepts.mdx:53-65`、`[H]persistence-remote.mdx:16-38`）。
- F1.4 サーバが pane とプロセスの状態を持ち、クライアントは UI にすぎない。クライアントを切り離してもサーバとエージェントは動き続ける（`[H]concepts.mdx:67-81`）。
- F1.5 モードは 3 つ：**terminal**（キーを pane へ送る）、**prefix**（prefix の後の 1 キーを herdr の操作として受ける）、**navigate**（workspace を移動するための常駐モード）（`[H]concepts.mdx:83-89`）。
  さらに **copy mode** と **resize mode** がある（`[H]keyboard.mdx:38-42`）。

### F2: 既定キー割り当て（Q2）

**解説記事同士の食い違いは次のとおり解消した**：下へ分割は `prefix+minus`（`h` ではない）、新規 tab は `prefix+c`、新規 workspace は `prefix+shift+n`
（`[H]keyboard.mdx:22-28`、`[H-cfg]keys.split_horizontal`、`[H-cfg]keys.new_tab`、`[H-cfg]keys.new_workspace`）。

既定値の全体（`[H-cfg]keys.*`。`unset` は既定では割り当てなし）:

| 分類 | 操作（キー名） | 既定 |
|---|---|---|
| 共通 | prefix（`keys.prefix`） | `ctrl+b` |
| 共通 | キー一覧のヘルプ（`help`） | `prefix+?`（ヘルプ内で `/` による絞り込み、Backspace で編集、`ctrl+u` で消去。`[H]keyboard.mdx:18`） |
| 共通 | 設定を開く（`settings`） | `prefix+s` |
| 共通 | クライアントを切り離す（`detach`） | `prefix+q` |
| 共通 | 設定の再読み込み（`reload_config`） | `prefix+shift+r` |
| 共通 | 表示中の通知の対象へ移動（`open_notification_target`） | `prefix+o` |
| 共通 | サイドバーの折りたたみ（`toggle_sidebar`） | `prefix+b` |
| 共通 | セッション内の移動先を選ぶ（`goto`） | `prefix+g` |
| workspace | 新規（`new_workspace`） | `prefix+shift+n` |
| workspace | 名前変更（`rename_workspace`） | `prefix+shift+w` |
| workspace | 閉じる（`close_workspace`） | `prefix+shift+d` |
| workspace | 移動用の画面（`workspace_picker`） | `prefix+w`（navigate モードに入る） |
| workspace | 前 / 次、1〜9 番へ（`previous_workspace` / `next_workspace` / `switch_workspace`） | unset |
| workspace | Git worktree の作成（`new_worktree`） | `prefix+shift+g`（開く / 削除は unset） |
| navigate | workspace の選択を上 / 下へ | `up` / `down` |
| navigate | pane の選択を左 / 下 / 上 / 右へ | `h` / `j` / `k` / `l`（左右の矢印は常に左右の別名） |
| tab | 新規（`new_tab`） | `prefix+c` |
| tab | 名前変更（`rename_tab`） | `prefix+shift+t` |
| tab | 前 / 次（`previous_tab` / `next_tab`） | `prefix+p` / `prefix+n` |
| tab | 1〜9 番へ（`switch_tab`） | `prefix+1..9` |
| tab | 閉じる（`close_tab`） | `prefix+shift+x` |
| tab | 並び順を前 / 後へ（`move_tab_previous` / `move_tab_next`） | unset |
| pane | 左 / 下 / 上 / 右へフォーカス（`focus_pane_*`） | `prefix+h/j/k/l` |
| pane | 左 / 下 / 上 / 右と入れ替え（`swap_pane_*`） | `prefix+shift+h/j/k/l` |
| pane | 次 / 前へ巡回（`cycle_pane_next` / `cycle_pane_previous`） | `prefix+tab` / `prefix+shift+tab` |
| pane | 右へ分割（`split_vertical`） | `prefix+v` |
| pane | 下へ分割（`split_horizontal`） | `prefix+minus` |
| pane | 閉じる（`close_pane`） | `prefix+x` |
| pane | 拡大表示の切替（`zoom`） | `prefix+z` |
| pane | resize モード（`resize_mode`） | `prefix+r`（1 打ちで広げ縮めする `resize_pane_*` は unset） |
| pane | 名前変更（`rename_pane`） | `prefix+shift+p` |
| pane | copy モード（`copy_mode`） | `prefix+[` |
| pane | スクロールバックを `$EDITOR` で開く（`edit_scrollback`） | `prefix+e` |
| pane | 直前にフォーカスした pane へ（`last_pane`） | unset |
| agent | 前 / 次、1〜9 番へ（`previous_agent` / `next_agent` / `focus_agent`） | unset |
| remote | クリップボードの画像をリモートへ（`remote_image_paste`） | `ctrl+v` |

- F2.1 **ヘルプ上の案内は「最初に覚える 5 つ」**：新規 tab、右 / 下へ分割、pane 間の移動、workspace の移動、切り離し（`[H]keyboard.mdx:20-28`）。
- F2.2 **navigate モード**では Enter で選んだ workspace を有効にし、Esc か prefix キーで取り消す（`[H]connecting-machines.mdx:48`）。
- F2.3 **copy モード**の操作：`h/j/k/l`、`w/b/e`・`W/B/E`、`{`/`}`、`PageUp`/`PageDown`、`ctrl+b`/`ctrl+f`、`ctrl+u`/`ctrl+d` で移動。`/` と `?` で検索、`n`/`N` で繰り返し。
  `v` か Space で選択開始、`y` か Enter でコピー、`q` か Esc で抜ける。copy モード中も pane の出力は止まらない
  （`[H]keyboard.mdx:83-87`）。
- F2.4 **prefix キーそのものを端末へ送る方法**は、pane 単体への接続（direct attach）については `ctrl+b ctrl+b` と明記されている
  （`[H]agents.mdx:149`、`[H]persistence-remote.mdx:129`）。**通常の UI での送り方はドキュメントに記載が無い（未確認）**。
- F2.5 **herdr 自身の入力欄**（名前変更ダイアログ等）には emacs 風の編集キーがある（`Ctrl+W` で直前の単語を切り取る等）。Enter で確定、Esc で取り消し（`[H]keyboard.mdx:65-81`）。
- F2.6 prefix を使わない直接のキー（chord）も割り当てられる。推奨は `ctrl+alt` 系（`[H]keyboard.mdx:98-132`）。**これはカスタマイズ（後続 work）の範囲**。

### F3: マウス操作（Q3）

herdr は「マウス前提（mouse-native）」で、すべての操作をマウスでも行えるとしている（`[H]concepts.mdx:26-28`、`[H]index.mdx:23`）。

| # | 操作 | 根拠 |
|---|---|---|
| M1 | pane・tab・workspace・エージェントをクリックしてフォーカス | `[H]concepts.mdx:28`、`[H]quick-start.mdx:20` |
| M2 | 分割の境界をドラッグしてリサイズ | 同上 |
| M3 | 右クリックのメニュー（pane の分割・tab の作成など） | `[H]quick-start.mdx:20`、`[H]keyboard.mdx:10` |
| M4 | ドラッグで選択すると、離した時点でクリップボードへコピー（`ui.copy_on_select`、既定 true） | `[H]quick-start.mdx:20`、`[H-cfg]ui.copy_on_select` |
| M5 | ダブルクリックで単語を選択。2 回目を押したままドラッグすると単語単位で範囲を広げる | `[H]quick-start.mdx:20` |
| M6 | `Ctrl`+クリックでリンクを開く（OSC 8 のハイパーリンクと `http(s)://` の URL。折り返しをまたぐものも）。Ctrl を押しながら重ねると下線 | `[H]quick-start.mdx:22` |
| M7 | 右クリックを pane 内のアプリへ渡す（修飾キー付き、または pane ごとの設定。pane の枠を右クリックすれば herdr のメニューに戻る） | `[H]quick-start.mdx:24`、`[H-cfg]ui.right_click_passthrough_modifier` |
| M8 | ホイールでスクロール（1 ノッチ 3 行。`ui.mouse_scroll_lines`） | `[H-cfg]ui.mouse_scroll_lines`、`[H]agents.mdx:151` |
| M9 | pane 横のスクロールバーを操作（`ui.pane_scrollbars`、既定 true） | `[H-cfg]ui.pane_scrollbars` |
| M10 | サイドバーのマシンの矢印をクリックして、そのマシンの workspace 一覧を折りたたむ / 広げる | `[H]connecting-machines.mdx:46` |
| M11 | 端末アプリへのマウス入力の受け渡し（アプリがマウス報告を求めているとき） | `[H]socket-api.mdx`「`pane.input.set`」節（L166-171） |

- F3.1 マウスの取り込みを無効にする設定（`ui.mouse_capture = false`）がある（`[H]concepts.mdx:30-35`）。
- F3.2 **pane の D&D による移動・分割は、herdr の UI の機能としては記載が無い**。pane の移動は CLI / API の `pane move`（別 tab への分割挿入、新規 tab、新規 workspace）として存在する（`[H]cli-reference.mdx:220-222`）。

### F4: エージェントの検出と状態（Q4）

- F4.1 **5 状態の定義**（`[H]concepts.mdx:41-51`）:
  - `blocked`：入力・承認・判断が必要
  - `working`：実行中
  - `done`：終わったが、まだ利用者が見ていない
  - `idle`：終わったか待機中で、すでに見た
  - `unknown`：確信をもって分類できない

  **`done` は「未読」の概念**で、どの完了を表示済みかはクライアントごとに記録する。CLI / API はサーバ側の既読状態を使い、`idle` も `done` も「入力を受け付けられる」を意味する（同 L51、`[H]cli-reference.mdx:354`）。
- F4.2 **検出の仕組み**：まず pane の前面プロセス（foreground process）でエージェントを特定する。状態は次のどちらか 1 つの情報源（status authority）で決まる（`[H]agents.mdx:41-51`）。
  - lifecycle hooks を持つエージェントで、連携（integration）が入っていて報告している場合 → その報告
  - それ以外 → **pane の画面下部のスナップショット**を、エージェントごとの TOML の判定ルール（manifest）で照合する。OSC によるタイトルや進捗も判定材料に使う
- F4.3 **Claude Code と Codex はどちらも画面判定（screen manifest）で状態を決める**。連携を入れても、提供されるのはセッションの識別子（再開用）だけ（`[H]agents.mdx:29-30`、`[H]integrations.mdx:62-65`）。
- F4.4 **blocked の判定は意図的に厳格**：承認・質問・権限確認の画面に一致したときだけ `blocked` にする。どのルールにも一致しなければ `idle` に倒す（`[H]agents.mdx:59-63`）。
- F4.5 **状態の集約**：blocked のエージェントがいると、その pane・tab・workspace が blocked に見える。working がいれば workspace が active に見える。done は利用者が見るまで表示が残る（`[H]agents.mdx:92-98`）。
- F4.6 **検出できるエージェント**は 22 種（Pi、OMP、GitHub Copilot CLI、Devin CLI、Kimi Code CLI、Hermes Agent、Qoder CLI、Qwen Code、Letta Code、Droid、OpenCode、Kilo Code CLI、MastraCode、Claude Code、Codex、Cursor Agent CLI、Amp、Grok CLI、Antigravity CLI、Kiro CLI、Maki、Muse）。
  ほかに Gemini CLI と Cline も検出するが、検証は浅い（`[H]agents.mdx:14-39`）。
- F4.7 判定ルールは herdr.dev から自動更新され、利用者が上書きもできる。判定の根拠を表示する `herdr agent explain` がある（`[H]agents.mdx:65-88`）。
- F4.8 ラッパー越しにエージェントを起動するときは、`HERDR_AGENT=<agent>` で種別を明示できる。Linux の制限された環境向けに、子プロセスグループから推定するモードもある（`[H]agents.mdx:53-57`）。
- F4.9 **Windows では前面プロセスグループが使えない**。代わりに pane のシェルの子孫プロセスを走査し、npm / Node や Git Bash を経由した起動も追う（`[H]windows-beta.mdx:52`）。

### F5: 複数クライアント（Q5）

- F5.1 クライアントが 1 つなら、全 tab がそのサイズに従う。複数なら、各クライアントは別々の workspace / tab を表示できる。
  **同じ tab を見ているときは、最後にフォーカス・選択・操作したクライアントがその tab の pane サイズを決める**（`[H]concepts.mdx:73`、`[H]configuration.mdx:57-65`）。
- F5.2 クライアントが 1 つもいないとき、既存の pane は最後のサイズを保つ。新しい pane は 120×40 の仮想端末サイズで作られる（`[H-cfg]server.headless_cols` / `headless_rows`）。
- F5.3 done の既読は各クライアントが別々に持つ（F4.1）。

### F6: セッション状態の範囲（Q6）

`[H]session-state.mdx:8-15` の表のとおり:

| 場面 | プロセスの継続 | レイアウトの復元 | 直近の画面 | エージェントの会話の再開 |
|---|---|---|---|---|
| 切り離して再接続 | する | する | する（生きている端末から） | する（プロセスが止まっていない） |
| サーバ再起動 | しない | する（workspace / tab / pane / cwd / レイアウト / フォーカス） | 画面履歴を有効にしたときだけ | 公式連携で会話 ID が分かるときだけ |
| 更新（handoff あり） | できる範囲で継続 | する | する | する |

- F6.1 画面履歴の保存（`experimental.pane_history`）は**既定で無効**。秘密情報が含まれうるため（`[H]session-state.mdx:39-50`）。
- F6.2 会話の再開は Claude Code なら `claude --resume <id>`、Codex なら `codex resume <id>`。連携が報告した会話 ID が前提（`[H]session-state.mdx:52-94`）。

### F7: herdr の全機能一覧と、本製品での扱いの提案（Q1 → AC15）

分類の凡例:
- **MVP** = 本 work で作る
- **後続:◯◯** = `.aidev/backlog/product-roadmap.md` の既存の項目に入れる
- **新規後続(提案)** = backlog にまだ無い項目として提案したもの。**research のゲートで 5 群すべてを後続 work として追加すると決まった**（decisions.md D8）。
  追加先は `.aidev/backlog/product-roadmap.md` の同名の項目
- **ゲートでの確定事項**：H31 は MVP に変更した（D7・AC18）。H37 の後続 work は worktree グループと任意の束ねの両方を扱う（D6）
- **読み替え** = Web では前提が違うので、同じ目的を別の形で満たす
- **非対応** = 本製品では扱わない（理由つき）

| ID | herdr の機能 | 根拠 | 提案 | 対応 AC / 備考 |
|---|---|---|---|---|
| H01 | workspace の作成・名前変更・切替・閉じる（閉じる前に確認。`ui.confirm_close` 既定 true） | `[H]concepts.mdx:8-12`、`[H-cfg]ui.confirm_close` | MVP | AC1, AC-I2 |
| H02 | tab の作成・名前変更・切替（前後・1〜9 番）・閉じる。作成時に名前を尋ねる（`ui.prompt_new_tab_name` 既定 true）。最後の tab を閉じると workspace も閉じる | `[H]keyboard.mdx:44-51`、`[H-cfg]ui.prompt_new_tab_name`、`[H]cli-reference.mdx:198` | MVP | AC2 |
| H03 | pane の右・下への分割、閉じる、方向でのフォーカス移動、巡回、入れ替え、拡大表示、resize モード、名前変更 | `[H]keyboard.mdx:34-42`、`[H-cfg]keys.*` | MVP | AC3（入れ替え・拡大表示・巡回は AC3 に含めて検証する） |
| H04 | tab の並べ替え、workspace の並べ替え | `[H-cfg]keys.move_tab_*`、`[H]socket-api.mdx:103`（`workspace.move`） | 後続:workspace のグルーピング | 並べ替えとグルーピングはどちらも一覧の構造を扱う |
| H05 | 端末としての pane（全画面 TUI、色、マウス報告、ブラケットペースト） | `[H]concepts.mdx:20-24`、`[H]cli-reference.mdx:266` | MVP | AC4 |
| H06 | スクロールバック（pane あたり既定 10MB）、ホイール、スクロールバー | `[H-cfg]advanced.scrollback_limit_bytes`、M8、M9 | MVP | AC5 |
| H07 | copy モード（キーボードでの選択・検索・コピー） | F2.3 | MVP | AC5 |
| H08 | マウスでの選択とコピー（M4・M5）、貼り付け | F3 | MVP | AC5 |
| H09 | リンクを開く（M6） | F3 | MVP | AC14 |
| H10 | 右クリックのメニュー（M3）と、右クリックのアプリへの受け渡し（M7） | F3 | MVP | AC14 |
| H11 | スクロールバックを `$EDITOR` で開く（`prefix+e`） | `[H-cfg]keys.edit_scrollback` | 新規後続(提案):端末機能の拡張 | |
| H12 | ポップアップの端末・独自コマンドのキー割り当て（popup / pane / shell / plugin_action） | `[H]configuration.mdx:181-238` | 後続:キーバインドのカスタマイズ | 独自コマンドはキー設定と一体 |
| H13 | 端末内の画像表示（Kitty graphics） | `[H]configuration.mdx:513-526` | 新規後続(提案):端末機能の拡張 | Web では xterm.js 側の画像対応で実現する (推測) |
| H14 | 端末タイトル（OSC 0/2）の取得と、外側の端末のウィンドウタイトル（`ui.window_title`） | `[H]configuration.mdx:327-340`、`[H]agents.mdx:139` | 読み替え（MVP） | ブラウザのタブのタイトルとして出す |
| H15 | CJK IME の候補窓の位置合わせ、prefix 中の IME 切替（macOS / Windows の韓国語 IME のみ） | `[H]configuration.mdx:539-564` | 読み替え（MVP：IME 入力は AC4）／ IME の自動切替は非対応 | ブラウザから OS の IME は切り替えられない (推測) |
| H16 | エージェントの検出と 5 状態、状態の集約、`done` の既読管理 | F4 | MVP（主要数種＋汎用） | AC6, AC7 |
| H17 | 残りのエージェントの検出、判定ルールの自動更新と上書き、`agent explain`、`HERDR_AGENT` | F4.6〜F4.8 | 後続:エージェント対応の拡充 | |
| H18 | エージェント連携（integrations）の導入・削除・状態確認、独自エージェントの状態報告 | `[H]integrations.mdx` 全体 | 後続:エージェント対応の拡充 | |
| H19 | サイドバー（workspace の一覧＝Space パネル、エージェントの一覧＝Agent パネル）、折りたたみ、ソート（`spaces` / `priority`） | `[H]configuration.mdx:299-469`、`[H-cfg]ui.agent_panel_sort` | MVP（既定の表示だけ） | AC6, AC7 |
| H20 | Space 行の Git ブランチと ahead / behind の表示 | `[H]configuration.mdx:363-391` | MVP | 既定の Space 行に含まれるため |
| H21 | サイドバーの行の並び・色の条件付け・独自トークン（`$name`） | `[H]configuration.mdx:351-469` | 新規後続(提案):外観と設定 | 独自トークンの報告は後続:外部操作 API |
| H22 | tab バーの位置、右端の状態表示（時刻・ホスト名・コマンド結果）、tab が 1 つなら隠す | `[H]configuration.mdx:305-325` | 新規後続(提案):外観と設定 | |
| H23 | pane の枠・隙間・枠へのエージェント名表示、状態表示を記号にする設定 | `[H-cfg]ui.pane_borders` ほか、`[H]configuration.mdx:342-349` | 新規後続(提案):外観と設定 | MVP は既定の見た目だけ |
| H24 | テーマ（組み込み＋個別の色の上書き＋明暗の自動切替） | `[H]configuration.mdx:240-297` | 新規後続(提案):外観と設定 | MVP は既定のテーマ 1 つ (推測で十分) |
| H25 | 設定画面（`prefix+s`）、設定の再読み込み、初回の案内（onboarding） | `[H-cfg]keys.settings`、`[H]configuration.mdx:35-51` | 新規後続(提案):外観と設定 | |
| H26 | キー割り当ての変更、prefix を使わない直接のキー、既定への戻し | `[H]configuration.mdx:124-179`、`[H]keyboard.mdx:89-132` | 後続:キーバインドのカスタマイズ | |
| H27 | ヘルプ（`prefix+?`）と絞り込み | F2 表 | MVP | AC13, AC-I1 |
| H28 | navigate モード（`prefix+w`）と goto（`prefix+g`） | F1.5、F2.2 | MVP | AC13, AC-I3 |
| H29 | 通知（アプリ内トースト / 外側の端末 / OS / なし。既定 off、1 秒遅延、表示中の tab は抑止）、音（既定 on、エージェントごと）、通知の対象へ移動（`prefix+o`） | `[H]configuration.mdx:471-507`、`[H-cfg]ui.toast.*`、`[H-cfg]ui.sound.*` | 新規後続(提案):通知 | Web Notifications API は HTTPS が前提（F10 参照） |
| H30 | 切り離し（`prefix+q`）と再接続。クライアントが消えても処理は継続 | F1.4、F6 | MVP（読み替え：`prefix+q` はこのブラウザの接続を切る） | AC8 |
| H31 | サーバ再起動後のレイアウト復元（workspace / tab / pane / cwd / フォーカス） | F6 | **MVP**（ゲートで確定・D7） | AC18 |
| H32 | 画面履歴の保存と再生（opt-in）、エージェントの会話の再開、live handoff | F6.1、F6.2、`[H]session-state.mdx:96-115` | 新規後続(提案):セッション永続化の拡張 | 会話の再開は連携（H18）が前提 |
| H33 | 名前付き session | F1.3 | 新規後続(提案):セッション永続化の拡張 | MVP は既定 session 1 つ |
| H34 | 複数クライアントの同時接続とサイズの決め方（F5） | F5 | MVP | AC9 |
| H35 | モバイル向けの 1 列表示（端末幅 64 桁以下）と移動用メニュー | `[H-cfg]ui.mobile_width_threshold`、`[H]how-to-work.mdx:47-69` | MVP | AC12 |
| H36 | 新規 pane の既定シェル・起動モード・作業ディレクトリの方針（`new_cwd = follow`） | `[H]configuration.mdx:67-94` | MVP（既定の挙動だけ）／設定は後続:外観と設定 | cwd を引き継ぐ既定の挙動は操作感に直結する |
| H37 | Git worktree の作成・一覧・削除と、元の workspace の下へのグループ化 | `[H]configuration.mdx:96-111`、`[H]cli-reference.mdx:172-185` | 後続:workspace のグルーピング | **herdr のグループ化は worktree を単位にしたもの**。後続 work は worktree グループと任意の束ねの両方を扱う（ゲートで確定・D6） |
| H38 | CLI / socket API（workspace・tab・pane・agent の操作、読み取り、待ち合わせ、イベントの購読、`session.snapshot`、メタデータの報告） | `[H]cli-reference.mdx`、`[H]socket-api.mdx` 全体 | 後続:外部操作 API / CLI | |
| H39 | エージェント自動化（`agent start` / `prompt --wait` / `wait` / `read`）とエージェント向けの skill | `[H]agent-automation.mdx`、`[H]agent-skill.mdx` | 後続:外部操作 API / CLI | オーケストレーション（後続）の土台 |
| H40 | pane 単体への接続・閲覧専用の購読・制御ストリーム（`terminal attach` / `session observe` / `session control`） | `[H]persistence-remote.mdx:109-159` | 後続:外部操作 API / CLI | |
| H41 | pane の移動（別 tab・新規 tab・新規 workspace へ） | `[H]cli-reference.mdx:220-222` | 後続:D&D による pane の分割 / 分割解除 / 移動 | UI 操作は D&D で提供する |
| H42 | プラグイン（manifest・アクション・イベントフック・pane・リンクハンドラ）、マーケットプレイス | `[H]plugins.mdx`、`[H]marketplace.mdx` | 後続:エージェント対応の拡充 | 範囲が大きいので独立した work に割る案もある |
| H43 | 保存済みマシン（ローカル＋複数の SSH 先を 1 画面に）、`--remote`、`--machine` による CLI の転送 | `[H]connecting-machines.mdx`、`[H]persistence-remote.mdx:40-107` | 後続:複数ホストの集約 | |
| H44 | リモートへのクリップボード画像の転送 | `[H]how-to-work.mdx:80-82`、`[H-cfg]keys.remote_image_paste` | 後続:複数ホストの集約 | |
| H45 | 自己更新・更新チャネル・バージョン確認 | `[H]install.mdx:104-150`、`[H-cfg]update.*` | 新規後続(提案):配布と運用 | |
| H46 | シェル補完、ログ、`--default-config` | `[H]cli-reference.mdx:86-118`、`[H]configuration.mdx:577-589` | 新規後続(提案):配布と運用（ログは MVP にも最低限必要） | |
| H47 | herdr の中で herdr を起動する（入れ子）の許可 | `[H-cfg]experimental.allow_nested` | 非対応 | ブラウザ UI の中で入れ子にする意味が無い (推測) |
| H48 | 外側の端末に固有の設定（`ui.host_cursor`、`ui.redraw_on_focus_gained`、`ui.mouse_capture`） | `[H-cfg]ui.host_cursor` ほか | 非対応 | 外側の端末が存在しない。描画はブラウザが担う |
| H49 | Windows ネイティブ（ConPTY）での動作。pane への直接接続・handoff・前面プロセスグループは Windows 非対応 | `[H]windows-beta.mdx:28-125` | MVP（本体の動作）／ herdr と同じく一部非対応 | AC16 |

### F8: 技術スタックの材料（Q7）

**PTY（端末プロセスの生成）**

- F8.1 **node-pty**（TypeScript）
  - 安定版は 1.1.0、beta は 1.2.0-beta.15（`npm view node-pty dist-tags` で確認）。
  - 1.1.0 は Linux 向けのビルド済みバイナリが無く、導入時にネイティブビルドが要る。1.2.0-beta で linux-x64 / arm64 が加わった。
  - 1.2 系で winpty を削除し、Windows 10 1809 以降の ConPTY だけになった。
    https://github.com/microsoft/node-pty/pull/868
  - 新しい ConPTY（同梱の `conpty.dll`）は `useConptyDll` オプションで使える（試験扱い・既定 false）。
  - Windows には未解決のバグがある：シェルの終了ごとに conhost.exe が残る（#965）、kill の競合（#952・#967）、終了後の resize で例外（#827）。
    https://github.com/microsoft/node-pty/issues/965
- F8.2 **Bun / Deno では node-pty の動作が不安定**。
  - Bun：公式サポート外（Bun #25822 が open）。組み込みの `Bun.Terminal` は v1.3.14 から ConPTY に対応したが、未解決の不具合がある。
    https://bun.com/blog/bun-v1.3.14 、https://github.com/oven-sh/bun/issues/25822
  - Deno：組み込みの PTY API が無い（deno#3994）。
- F8.3 **portable-pty 0.9.0**（Rust・wezterm）：Unix と ConPTY の両方に対応する。
  herdr はこれに 3 つのパッチを当てている（`[H-root]vendor/portable-pty.patches.md`）。
  1. PATH 上の `conpty.dll` を読み込む危険への対策：同梱の固定版をハッシュで検証してから、絶対パスで読み込む
  2. `cmd.exe /d /c` に生のコマンドを渡す
  3. レジストリ由来の不正な環境変数を除外する

**サーバ側での端末状態の保持（再接続時の復元＝AC8）**

- F8.4 **@xterm/headless 6.0.0＋@xterm/addon-serialize 0.14.0**（TypeScript）
  - ブラウザ側と**同じエミュレータ**（xterm.js）なので、復元した画面が一致しやすい。
  - ただし serialize addon は README 自身が「experimental / still under construction」と明記している（README を直接確認）。
    https://github.com/xtermjs/xterm.js/tree/master/addons/addon-serialize
  - 出力するもの：通常画面＋scrollback、alt 画面、主要なモード（カーソルキー・bracketed paste・マウス追跡 1000/1002/1003・スクロール領域等）。
    - ［D107 の注記（2026-09-19・03 の T33 の独立点検 #3）］「スクロール領域」は誤り。0.14.0 の `_serializeModes` が書き出すのは
      カーソルキー（`?1`）・キーパッド（`?66`）・bracketed paste（`?2004`）・挿入（`4h`）・origin（`?6`）・逆方向の折り返し（`?45`）・
      フォーカスの報告（`?1004`）・折り返しの無効化（`?7l`）・マウス追跡（`?9`／`?1000`／`?1002`／`?1003`）だけで、スクロール領域
      （DECSTBM）・カーソルの表示（`?25`）・SGR のマウスの符号化（`?1006`）・カーソルの形（DECSCUSR）・文字集合（G0〜G3）・DECSC は
      書き出さない（`src/SerializeAddon.ts` を直接確認）。影響と follow-up は decisions.md D107「既知の制約」。
  - **出力しないもの**：OSC 8 のリンク（#4531）、画像（#5845）。
  - 性能は 80 桁 × 1 万行で約 180ms（xterm.js #4470）。VS Code の再接続も headless＋serialize を使っている（同 issue）。
- F8.5 **Rust 側の候補**
  - `vt100` 0.16：scrollback を出力しない。
  - `avt` 0.18：両画面を復元できるが scrollback は含まない。
  - `alacritty_terminal`：VT への書き出し機能が無い。
  - `libghostty-vt`（crate 0.2.1）：VT 形式への書き出し（palette・modes・OSC 8・kitty keyboard 等）ができ最も高機能。ただし API は未安定と明記されており、ビルドに Zig 0.16 が要る。
    https://github.com/uzaaft/libghostty-rs 、https://github.com/ghostty-org/ghostty/blob/main/include/ghostty/vt/formatter.h
  - **herdr は libghostty-vt を採用し、パッチを当てている**（`[H-root]vendor/libghostty-vt.patches.md`）。

**Windows ConPTY**

- F8.6 最小要件は Windows 10 1809 / Server 2019。
  https://learn.microsoft.com/en-us/windows/console/createpseudoconsole
- F8.7 新しい ConPTY は Windows に取り込まれず、NuGet `Microsoft.Windows.Console.ConPTY`（MIT）で配布される。
  herdr もこれを同梱している：古い system ConPTY が Kitty keyboard のシーケンスを落とすため（`[H]windows-beta.mdx:106-108`）。
  https://www.nuget.org/packages/Microsoft.Windows.Console.ConPTY
- F8.8 ConPTY はアプリの出力を再エンコードする（意味は同じだがバイト列は一致しない）。
  新しい ConPTY は DA1 の応答を待つため、**ブラウザが 1 台も繋がっていないときはサーバが代わりに応答する必要がある**（node-pty #894 からの推測）。
  https://github.com/microsoft/node-pty/issues/894
- F8.9 Windows のカーソルは再描画中にちらつく。herdr はこれを避けるため、既定でカーソルをセルとして描いている。その代わり IME の候補窓の位置がずれる（`[H]windows-beta.mdx:89-102`）。

**前面プロセスの検出（エージェントの特定＝AC6）**

- F8.10 **Linux**
  - `tcgetpgrp(master_fd)` で得た前面プロセスグループの `/proc/<pgid>/cmdline` を読む。
  - node-pty の `pty.process` はこの方法で argv[0] だけを返す。
  - `claude` / `codex` は Node 製で argv[0] が `node` になりうるので、**cmdline 全体を見る必要がある**（推測）。
- F8.11 **Windows**
  - node-pty の `pty.process` は生成時に渡した名前を返すだけで、前面プロセスは分からない。
  - シェルの PID から子孫プロセスを走査する必要がある。herdr もこの方式（F4.9）。

**配布（単一バイナリ）**

- F8.12 **TypeScript**
  - Node SEA：組み込み以外のモジュールは require できず、`.node` は一時ファイルに書き出して読み込む。
    https://nodejs.org/api/single-executable-applications.html
  - Bun `--compile`：クロスコンパイルに対応するが、node-pty の動的 require は取り込まれない（推測）。
  - **node-pty を単一バイナリにまとめるのは難所**。
- F8.13 **Rust**：素直に単一バイナリになる。ただし新しい ConPTY を使うなら、`conpty.dll` と `OpenConsole.exe` は言語を問わず別ファイルで同梱する。

**比較**（F8.1〜F8.13 の整理。判断は design で行う）

| 観点 | TypeScript（Node＋node-pty＋xterm headless） | Rust（portable-pty＋libghostty-vt 等） |
|---|---|---|
| PTY | VS Code で実績。Windows は ConPTY 専用化の途中で既知バグあり | 実績あり（wezterm・herdr）。ConPTY の読み込みには herdr 相当の手当てが要る |
| 端末状態の復元 | **ブラウザと同じエミュレータで一致性が高い**。addon は experimental で、大きな scrollback だと遅い | libghostty-vt は高機能だが未安定・Zig 依存。他の crate は scrollback を出せない |
| 前面プロセスの検出 | Linux は `pty.process`＋cmdline。Windows は自前で走査 | 同じ（`process_group_leader()`／`sysinfo` で走査） |
| WebSocket / TLS | `ws` 等で容易 | axum＋tokio-tungstenite＋rustls |
| 単一バイナリ | 難所（ネイティブモジュール） | 素直 |
| ブラウザとの型共有 | そのまま共有できる | スキーマから生成する必要がある（推測） |
| herdr の資産の流用（F12） | 状態判定ルール（TOML データ）は流用できる。判定の実行部は再実装 | ルールに加え、Rust のコードも Apache-2.0 の条件で参照・流用できる |

### F9: 別マシンからの安全な接続（Q8）

- F9.1 **zellij の Web クライアント**（0.43 以降。最も近い先行事例）
  https://zellij.dev/documentation/web-client.html
  - **ループバック以外のアドレスに証明書なしで bind しようとすると起動を拒否し、この制約は無効化できない。**
    https://github.com/zellij-org/zellij/blob/main/zellij-client/src/web_client/utils.rs
  - 認証の流れ：
    - ログイン用 token は 1 回だけ表示し、ハッシュで保存する。
    - ブラウザは token を POST で送り、HttpOnly・`SameSite=Strict`・（HTTPS 時）`Secure` の Cookie に交換する。
    - ログイン token を失効させると、そこから派生したセッションも失効する。
    - https://github.com/zellij-org/zellij/blob/main/zellij-client/src/web_client/http_handlers.rs
  - 全レスポンスに CSP、`X-Frame-Options: DENY`、`Referrer-Policy` を付ける。
  - 端末の入出力と制御（リサイズ等）は **WebSocket を 2 本に分けて**送る（`/ws/terminal` と `/ws/control`）。
  - 0.44 で閲覧専用の token、0.45（2026-08-20）でモバイル向け UI と PWA のインストールに対応した。
    https://zellij.dev/news/nested-sessions-kitty-graphics-new-ui/
- F9.2 **ほかの Web 端末**
  - VS Code `serve-web`：connection token が必須。起動時に `?tkn=` 付きの URL を出し、受け取った token を Cookie へ移して、302 リダイレクトで URL から消す。
    https://github.com/microsoft/vscode/blob/main/src/vs/server/node/webClientServer.ts
  - code-server：ログインの試行回数を制限し（毎分 2 回＋毎時 12 回）、「認証と暗号化なしで公開するな」と警告している。
    https://coder.com/docs/code-server/FAQ
  - ttyd / GoTTY：既定で書き込み不可。接続ごとに別プロセスを起動する。
- F9.3 **既知の落とし穴**
  - **CSWSH（クロスサイト WebSocket ハイジャック）**：ブラウザは WebSocket の handshake にも Cookie を付けるので、**Origin を許可リストで検証しなければならない**。
    https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
    - code-server はこれで CVE-2023-26114（CVSS 9.3）を出している。
      https://security.snyk.io/vuln/SNYK-JS-CODESERVER-3368148
  - **URL 内の token**：Referer とアクセスログから漏れる。
  - **DNS rebinding**：localhost で待ち受けるサーバは Origin の検証が必須（MCP 仕様が MUST としている）。
    https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
  - **Cookie はポートで分離されない**（RFC 6265 §8.5）。同じ開発ホストの別ポートで動く dev サーバからの接続は `SameSite` だけでは防げない（推測）。
- F9.4 **secure context（HTTPS か localhost）が必要な API**
  - 対象：Clipboard API、Service Worker / PWA、`Keyboard.lock()`、Notifications。
    https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
  - **LAN の IP に HTTP でつなぐと、これらはすべて使えない。**
  - iOS の Web 通知は、HTTPS かつホーム画面に追加した Web アプリに限られる。
    https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- F9.5 **証明書の入手手段**
  - `tailscale cert`：Let's Encrypt の証明書が取れる。ただしマシン名が Certificate Transparency ログで公開される。
    https://tailscale.com/kb/1153/enabling-https
  - mkcert、自己署名。自己署名は iPad で動かない例がある（code-server のガイド）。
- F9.6 **WSL2**：既定の NAT モードでは、Windows 側からは localhost で届く。LAN やスマートフォンからは portproxy か mirrored モードが必要。
  https://learn.microsoft.com/en-us/windows/wsl/networking
- F9.7 **複数クライアントのサイズの先行事例**
  - tmux：`window-size` の既定は `latest`（最後に操作したクライアントのサイズ）。閲覧専用のクライアントはサイズに影響させない（`ignore-size`）。
    https://github.com/tmux/tmux/blob/master/options-table.c
  - zellij 0.45：tab ごとに、見ているクライアントの最小サイズに合わせる。モバイルには「画面に合わせる」の切替とパン操作がある。
    https://github.com/zellij-org/zellij/issues/5624
  - **herdr の方式（F5.1）は tmux の `latest` と同じ考え方**。

### F10: ブラウザの制約（Q9）

**キー入力**

- F10.1 **Chrome / Edge の通常のタブでは、次のキーをページが止められない**
  - 対象：`Ctrl+W`・`Ctrl+F4`・`Ctrl+Shift+W`・`Alt+F4`・`Ctrl+T`・`Ctrl+N`・`Ctrl+Shift+N`・`Ctrl+Shift+T`・`Ctrl+Tab`・`Ctrl+Shift+Tab`・`Ctrl+PgDn`・`Ctrl+PgUp`。
  - ブラウザがページより先に処理するため、preventDefault が効かない。
    https://github.com/chromium/chromium/blob/main/chrome/browser/ui/browser_command_controller.cc 、
    https://github.com/chromium/chromium/blob/main/chrome/browser/ui/accelerator_table.cc
  - **素の `Ctrl+B` は予約されておらず、ページで捕まえられる**（予約表にあるのは `Ctrl+Shift+B` 等だけ）。
  - 予約されていないブラウザのショートカット（`Ctrl+F` 等）も、先にページへ届く。
- F10.2 **例外 1：インストールした PWA のウィンドウ**
  - 予約キーが無くなる（上記 browser_command_controller.cc）。
  - ただし VS Code の PWA では、iframe にフォーカスがあると `Ctrl+W` でアプリごと閉じる不具合が報告されている。
    https://github.com/microsoft/vscode/issues/150735
- F10.3 **例外 2：`Keyboard.lock()`**
  - 使える条件：HTTPS、ユーザー操作をきっかけにした全画面。
  - 実質 Chromium だけの機能。
    https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock
- F10.4 **prefix の横取りの口**
  - xterm.js の `attachCustomKeyEventHandler` は、xterm がキーを処理する前に呼ばれる。戻り値で xterm に処理させるかを決め、呼び出し側で preventDefault してよい。
  - keydown 以外のイベントでも呼ばれる。
    https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts
  - **IME の変換中（`isComposing` か keyCode 229）は prefix と判定しない必要がある**（推測）。
  - VS Code も同じ口で、2 段キーと「シェルに渡さない」コマンドを横取りしている。Esc はターミナルへ残している。
    https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts

**xterm.js**

- F10.5 **版と描画方式**
  - 安定版は 6.0.0（`npm view @xterm/xterm version` で確認）。
  - 6.0.0 で canvas レンダラーが削除され、描画は DOM（既定）か WebGL だけになった。
    https://github.com/xtermjs/xterm.js/releases/tag/6.0.0
- F10.6 **WebGL コンテキストの上限**
  - Chromium の既定の上限はデスクトップで 16、Android で 8。上限はページ内で共有され、超えると一番古いものが失われる。
    https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc
  - xterm.js の「1 ページに多数の端末」の課題（#4379）は未解決。
  - VS Code は、コンテキストが失われたら DOM レンダラーへ戻している。
    https://github.com/xtermjs/xterm.js/issues/4379
  - **requirements の「pane 16 個」は、デスクトップの上限にちょうど当たる**（推測：すべてを WebGL で描くと上限を超える）。
- F10.7 **全角文字と IME**
  - 全角の幅を正しく扱うには unicode11 アドオンが要る。
    https://github.com/xtermjs/xterm.js/tree/master/addons/addon-unicode11
  - IME には未解決の不具合がある：keyCode 229 を返す IME で 2 文字目が消える（#5887）、iPad で韓国語が合成されない（#3836）。
- F10.8 **マウス**：アプリがマウス追跡中でも、Shift+クリックで通常の選択に切り替えられる（macOS 以外）。
  https://github.com/xtermjs/xterm.js/blob/master/src/browser/services/SelectionService.ts
- F10.9 **モバイル**
  - xterm.js はモバイルを公式にはサポートしていない（README）。
  - 6.0.0 でタッチスクロールが壊れた（#5489）。修正は 6.0.0 より後に入った（#5563）。
  - Android Chrome＋Gboard で文字が乱れる（#3600）、タッチ端末でコピペできない（#3727）は未解決。
    https://github.com/xtermjs/xterm.js/issues/5377
  - 画面キーボードは visual viewport だけを縮める。
    https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport

**クリップボード**

- F10.10 **Clipboard API は secure context が前提**（F9.4）。
  - Chromium で読み取るには `clipboard-read` の許可が要る。
  - Safari / Firefox では、読み取り時に「ペースト」のメニューが出る。
    https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API

### F11: UI 部品の確立したパターン（Q10）

**WAI-ARIA APG の該当パターン**

| 部品 | パターン | 開く・確定・取り消し・キーボード・フォーカス | 出典 |
|---|---|---|---|
| tab バー | Tabs | ←/→ で移動し端で反対側へ回る。Tab で列に入るとアクティブな tab へ、次の Tab で列の外へ出る。表示が遅れないならフォーカスと同時に切り替える。Delete で閉じる（任意） | https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ |
| サイドバー（workspace ＞ エージェント） | Tree View | 入ると選択中のノードへフォーカスする。→ で開く／子へ、← で閉じる／親へ。↑↓・Home/End・Enter で実行。文字入力での先頭一致移動を推奨。**行の中にボタンを置くなら Treegrid** | https://www.w3.org/WAI/ARIA/apg/patterns/treeview/ |
| 分割の境界 | Window Splitter | フォーカスできる `role=separator` に `aria-valuenow`/`min`/`max` を付ける。矢印で動かし、Enter で畳む／戻す | https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/ |
| 名前変更 | Dialog（モーダル） | 背面を操作不可にし、Tab はダイアログ内で循環、Esc で閉じる。**閉じたら呼び出し元へフォーカスを戻す**。`<dialog>.showModal()` なら背面の操作不可と Esc での閉じる動作をブラウザが担う | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ 、https://html.spec.whatwg.org/multipage/interactive-elements.html |
| 閉じる前の確認 | Alert Dialog | 見本では、最初のフォーカスを最も安全な選択肢（No）に置く | https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/examples/alertdialog/ |

- F11.1 **WCAG 2.1.2（キーボードトラップ）**：フォーカスを閉じ込めてよいのは、抜け方を利用者に知らせる場合だけ。
  https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html
  - **端末は Tab と Esc を丸ごと受け取るので、この基準に当たる**。

**端末マルチプレクサの慣習**

- F11.2 **tmux**
  https://github.com/tmux/tmux/blob/master/key-bindings.c
  - `C-b C-b` で prefix そのものをアプリへ送る。
  - `x` は「kill-pane #P? (y/n)」と確認してから閉じる。
  - 名前変更は今の名前を入力済みにしてプロンプトを出す。
- F11.3 **zellij**
  - `x` で確認なしに閉じる。終了時の確認を求める issue #467 は 2021 年から未解決。
  - locked モードでは、解除キー以外のキーをすべてアプリへ通す。
    https://github.com/zellij-org/zellij/issues/467
- F11.4 **herdr**
  - workspace を閉じるときは既定で確認する（`[H-cfg]ui.confirm_close`、F7 の H01）。
  - pane を閉じるとき（`prefix+x`）に確認するかは、ドキュメントに記載が無い（未確認）。

**Web の慣習と端末の慣習のぶつかり方と、既存製品の解き方**

- F11.5 **Esc**：モーダルにフォーカスがある間だけ Esc で閉じるようにすれば、それ以外の Esc は端末に届くので両立する。
- F11.6 **Tab**
  - VS Code は `Ctrl+M` で「Tab でフォーカスを移す」モードを切り替え、状態をステータスバーに出す。F6 / Shift+F6 で画面の領域を巡回する。
    https://code.visualstudio.com/docs/configure/accessibility/accessibility
- F11.7 **ページ内のショートカットとの衝突**
  - JupyterLab は、端末にフォーカスがあるとき自分の `Ctrl+B` を発火させないように修正した。
    https://github.com/jupyterlab/jupyterlab/issues/17423

**モバイルでの修飾キーと prefix キーのパターン**

- F11.8 **ソフトキーボードの上に 1〜2 段のキー列を置くのが定着したパターン**
  - Termux：既定は ESC / - HOME ↑ END PGUP と TAB CTRL ALT ← ↓ → PGDN。
    https://github.com/termux/termux-app/tree/master/termux-shared/src/main/java/com/termux/shared/termux/extrakeys
  - Blink Shell（外付けキーボードが繋がると隠れる）、Termius も同じ形。
  - **修飾キーは「タップで次の 1 キーだけ、長押しでロック」が共通**。
- F11.9 **zellij の Web クライアントのモバイル UI**
  - 実際のビューポートに合わせてリサイズし、縦スワイプをスクロールに変換する。
  - 足りないキーを補う画面キーボードと、**キー操作なしで使える pane / tab のピッカー**を出す。
    https://zellij.dev/documentation/web-client.html
- F11.10 **herdr のモバイル表示**：端末幅 64 桁以下で 1 列の表示に切り替わり、移動用のメニューを出す（F7 の H35）。

## 影響範囲

- **リポジトリは空**（`.aidev/` と `.gitignore` 以外にファイルが無い）。既存コードへの波及は無い。
- **本 work の設計は、backlog にある後続 work の前提になる**（`.aidev/backlog/product-roadmap.md`）。
  - 外部操作 API：herdr の CLI / API と UI は同じ操作面を共有している（`[H]socket-api.mdx:18`「The layers share the same control surface.」）。
    また、`session.snapshot`＋`events.subscribe` によるクライアントの初期化手順が定められている（`[H]socket-api.mdx`「`session.snapshot`」節）。
    **本 work でブラウザとサーバの間の通信をどう作るかが、そのまま後続の API の土台になる**。
  - 複数ホストの集約：herdr ではマシンごとに独立したサーバを持ち、クライアントが束ねている（`[H]connecting-machines.mdx:8`）。
  - オーケストレーション：herdr の `agent prompt --wait` / `agent wait` / `pane wait-output`（`[H]agent-automation.mdx:59-70`）が、状態トリガと出力受け渡しの素材になる。

```mermaid
flowchart LR
  subgraph herdr の状態判定（F4.2）
    P[pane の PTY] --> FG{前面プロセスで<br/>エージェントを特定}
    FG -->|lifecycle hooks の連携あり| H[hooks の報告が状態を決める]
    FG -->|それ以外| S[画面下部のスナップショット<br/>＋OSC タイトル・進捗]
    S --> M[TOML の判定ルールと照合]
    M --> ST[blocked / working / idle / unknown]
    H --> ST
    ST --> R[pane → tab → workspace へ集約]
    ST --> D[done：完了を未読として表示]
  end
```

## 実現性 / リスク

- R1 **技術的な実現性はある**：同じ構成の先行事例がある（zellij の Web クライアント、VS Code の端末の再接続、herdr の TUI）。
- R2 **再接続時の画面復元の精度**：TypeScript の serialize addon は experimental で、OSC 8 のリンクと画像を書き出さない（F8.4）。
  Rust 側で最も高機能な libghostty-vt は API が未安定（F8.5）。**どちらを選んでも一部の状態は復元されない前提になる**。
- R3 **Windows ネイティブが最大の不確定要素**
  - ConPTY の不具合（F8.1）、新しい ConPTY の同梱（F8.7）、DA1 の代理応答（F8.8）、前面プロセスの検出（F8.11）、カーソルと IME（F8.9）。
  - herdr も Windows の一部機能を非対応としている（`[H]windows-beta.mdx:116-125`）。
  - **MVP の受け入れ基準（AC16）で 3 環境の検証を求めているので、検証環境の手配が前提になる**。
- R4 **モバイル**：xterm.js がモバイルを公式にサポートしておらず、タッチスクロールと Android の入力に未解決の不具合がある（F10.9）。
  AC12 は「一覧の確認・pane の切替・入力」に限っているが、入力の品質は xterm.js の版に依存する。
- R5 **セキュリティ**
  - 端末への入力は、ホスト上の任意のコマンド実行と同じ。
  - Origin の検証漏れで CVSS 9.3 の脆弱性を出した実例がある（F9.3）。
  - HTTP では Clipboard API 等が使えない（F9.4）ので、TLS を必須にするかどうかが機能にも効く。
- R6 **描画性能**：WebGL の上限（デスクトップ 16）に、requirements の pane 16 個がちょうど当たる（F10.6）。
- R7 **状態判定の精度**：画面判定はエージェントの UI が変わると外れる。herdr はルールを頻繁に更新している（F12.3）。
  流用するにしても、自前で作るにしても、追従の仕組みが要る。

## 実装アンカー

**リポジトリは空で、既存コードのアンカーは無い**（未特定ではなく「存在しない」）。以下は外部ライブラリの入口と、流用候補の資産。

- A1 PTY（TypeScript）：`node-pty` の `spawn(file, args, { cols, rows, useConptyDll })` → `IPty.onData` / `write` / `resize` / `kill` / `pid` / `process`
  （https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts）
- A2 PTY（Rust）：`portable_pty::native_pty_system().openpty(PtySize)` → `slave.spawn_command(CommandBuilder)`、
  `master.try_clone_reader()` / `take_writer()` / `resize()` / `process_group_leader()`（https://docs.rs/portable-pty）
- A3 サーバ側の端末状態（TypeScript）：`@xterm/headless` の `new Terminal({ cols, rows, scrollback, allowProposedApi })` → `write()`、端末からの応答は `onData` で PTY へ返す。
  `@xterm/addon-serialize` の `SerializeAddon.serialize({ scrollback, excludeAltBuffer })`
- A4 サーバ側の端末状態（Rust）：`libghostty_vt::Terminal`＋formatter（C API `ghostty_formatter_terminal_new` / `ghostty_formatter_format_alloc`）、
  または `avt::Vt::dump()`（scrollback なし）
- A5 ブラウザ側の端末：`@xterm/xterm` の `Terminal`。
  - 使う口：`attachCustomKeyEventHandler`（prefix の横取り）、`onTitleChange`、`onBell`、`parser.registerOscHandler`、`windowsPty`（Windows の reflow 対策）、`modes.mouseTrackingMode`。
  - 使うアドオン：`@xterm/addon-webgl`（`onContextLoss`）、`@xterm/addon-unicode11`、`@xterm/addon-web-links`、`@xterm/addon-clipboard`。
- A6 状態判定ルール（流用候補・Apache-2.0）：`[H-root]distribution/agent-detection/claude.toml`、`codex.toml`、`index.toml` ほか計 23 ファイル
- A7 前面プロセス
  - Linux：`tcgetpgrp(master_fd)` → `/proc/<pgid>/cmdline`（https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html）
  - Windows：シェルの PID から子孫を走査（Toolhelp32 / `sysinfo`）
- A8 新しい ConPTY：NuGet `Microsoft.Windows.Console.ConPTY`（`conpty.dll`＋`OpenConsole.exe`）

## 実装時の注意

- **エージェントの argv[0] は `node` になりうる**。`claude` / `codex` を前面プロセス名だけで判定しない（F8.10）。
- **ブラウザが 1 台も繋がっていない間も、端末からの問い合わせ（DA1・カーソル位置など）にサーバが応答しないと、Windows でシェルの起動が遅れる**（F8.8）。
  サーバ側のエミュレータの応答を PTY へ返す経路を、クライアントの有無と独立させる。
- **prefix の判定は keydown だけで行い、IME の変換中は無視する**（F10.4）。`Ctrl+B` を 2 回で、`\x02` そのものを送る慣習がある（F11.2、F2.4）。
- **herdr の入力欄の編集キー（`Ctrl+W` で単語を削除等）は、ブラウザでは `Ctrl+W` がタブを閉じるので再現できない**（F2.5、F10.1）。Web の入力欄の標準の編集操作で読み替える。
- **WebGL は見えている pane にだけ使い、コンテキストが失われたら DOM へ戻す**（F10.6）。
- **WebSocket の handshake では、毎回 Origin を許可リストで検証する**。Cookie の `SameSite` だけに頼らない（F9.3）。
- **token を URL に残さない**：`#` フラグメントか POST で渡すか、受け取ったら Cookie へ移してリダイレクトで消す（F9.2）。
- **xterm.js はモバイルの修正の取り込み状況を見て版を固定する**（F10.9）。
- **herdr の判定ルールの正規表現は Rust の構文**。JavaScript へ持ち込むときは `\x{...}` などを変換する（F12.2）。

## design への申し送り

**requirements への影響（research のゲートで確定し、requirements.md へ反映済み）**

1. **ライセンス**（F12.1）→ Apache-2.0 の条件を守って流用してよい（D5）。requirements の記述を訂正した。
2. **「workspace のグルーピング」の意味**（F7 の H37）→ worktree グループと任意の束ねの両方（D6）。
3. **backlog に無い herdr の機能 5 群**（F7）→ すべて後続 work として backlog に追加した（D8）。
4. **サーバ再起動後のレイアウト復元**（F6、H31）→ MVP に含めた（D7、F13・AC18）。
   根拠：herdr の README は「detach しても止まらない」を筆頭の特徴に挙げており、再起動後のレイアウト復元もその一部（`[H-root]README.md:31`）。
5. **pane 16 個の数値**（R6）→ WebGL の上限に当たる。数値は維持し、design で描画方式の混在（WebGL と DOM）を前提にする。

**design で決めること（事実の材料は上記の各節）**

- **技術スタック**（F8 の比較表）
  - TypeScript：復元の一致性と型の共有に強い。単一バイナリと Windows の成熟度に弱い。
  - Rust：単一バイナリと herdr のコードの流用に強い。復元用ライブラリの安定性とブラウザとの型共有に弱い。
- **ブラウザとサーバの通信**：後続の外部操作 API と同じ操作面にする（影響範囲）。
  herdr の `session.snapshot`＋`events.subscribe` の初期化手順と、zellij の「端末用と制御用の 2 本の WebSocket」（F9.1）が参考になる。
- **認証と TLS**（F9）
  - ループバック以外で TLS なしの起動を拒否する（zellij 方式）か。
  - token から Cookie への交換、Origin の検証、ログインの試行回数制限、閲覧専用 token の有無。
  - WSL2 から LAN へ出す手順（F9.6）。
- **複数クライアントのサイズの決め方**（F5、F9.7）
  - herdr・tmux の方式は「最後に操作したクライアントに合わせる」。
  - **スマートフォンで操作するとデスクトップ側の pane が縮む**ので、モバイルには zellij の「画面に合わせる＋パン」を組み合わせるかを決める。
- **状態判定**（F4・F12・F13）
  - herdr のルールを流用するか。流用するなら追従の方法。
  - hooks（Claude の `PermissionRequest` 等）を補助に使うか。
  - Windows で子孫プロセスを走査する方法。
- **キーとフォーカス**（F10.4、F11）
  - 端末が Tab と Esc を受け取る前提で、サイドバーや tab バーへ抜ける道（prefix＋キー、F6 巡回等）をどう示すか（WCAG 2.1.2）。
  - サイドバーを Tree にするか Treegrid にするか。
  - 確認ダイアログの最初のフォーカスを取り消し側に置くか。
- **モバイルの UI**（F11.8〜F11.10）：追加キー列（修飾キーは 1 回だけ／ロック）、prefix ボタン、pane / tab のピッカー、1 列の表示への切替条件。
- **HTTP で開かれたときの劣化の仕方**（F9.4、F10.10）：クリップボード・通知が使えない前提の代替手段。
- **起動確認（smoke）の方法**：`.aidev/config.yml` の `smokeCommand` を決める（decisions.md D3）。

**残った未確定事項（research では解消できなかったもの）**

- 通常の UI で prefix キーそのものを端末へ送る方法（F2.4。herdr のドキュメントに記載なし）→ design で `Ctrl+B Ctrl+B` を採るか決める。
- herdr が pane を閉じるときに確認するか（F11.4）→ requirements の AC-I2（実行中なら確認）を維持する前提で進めてよいか。
- モバイルの対象ブラウザ（iOS Safari と Android Chrome の両方か）→ requirements の未確定事項のまま。
- 主要エージェントの範囲 → 判定ルールを流用するなら、22 種すべてを低コストで対象にできる可能性がある（推測）。design で判断する。

### F12: herdr のライセンスと流用できる資産

- F12.1 **herdr は 0.8.0（2026-08-03）で AGPL-3.0-or-later から Apache-2.0 へライセンスを変更した**
  （`[H-root]CHANGELOG.md:238`「Relicensed Herdr from AGPL-3.0-or-later to Apache-2.0.」、`[H-root]LICENSE`、`[H-root]Cargo.toml:7` の `license = "Apache-2.0"`）。
  GitHub API でも herdrdev/herdr のライセンスは `Apache-2.0` と返る。
  - requirements の「herdr のソースコードの流用（AGPL のため）」「ライセンス: herdr（AGPL-3.0-or-later）のコードは流用しない」は、**この変更より前の情報に基づいていた**。
  - Apache-2.0 では、著作権表示と LICENSE を残し、変更した旨を示せば流用できる（Apache-2.0 第 4 条）。
- F12.2 **状態判定ルールは TOML のデータとして、エージェントごとに分けて置かれている**（`[H-root]distribution/agent-detection/`、23 ファイル）。
  - 例：`claude.toml` は 230 行、`codex.toml` は 103 行。
  - 各ルールは `state`・`priority`・`region`・`regex` / `line_regex`・`not` から成る。`region` には `osc_title`・`bottom_non_empty_lines(12)`・`last_non_empty_above_prompt_box` 等がある。
  - ファイルごとに `version` と `min_engine_version` を持つ。
  - 正規表現は Rust の構文で書かれている（例 `\x{2800}`）。JavaScript で使うなら構文の変換が要る（推測）。
  - **このルールを流用すれば、herdr と同じ精度の状態判定を短い工数で得られる**（推測）。ただし判定の実行部（region の切り出し・優先順位・`not` の評価）は自前で実装する必要がある。
- F12.3 **ルールは頻繁に更新されている**：`claude.toml` の `updated_at` は 2026-09-11 で、herdr.dev から自動配信もされている（`[H]agents.mdx:65-67`）。
  流用する場合は、取り込んだ版をどう追従するかを決める必要がある。

### F13: エージェントの状態を知る手段（Q4 の補足）

- F13.1 **Claude Code の hooks**
  https://code.claude.com/docs/en/hooks
  - 主なイベント：`SessionStart`・`UserPromptSubmit`・`PreToolUse`・`PermissionRequest`・`Notification`・`Stop`。
  - `http` 型のハンドラで、任意の URL へ JSON を POST できる。
  - `Notification` の `permission_prompt` は約 6 秒後、`idle_prompt` は約 60 秒後に発火する。**即座に知りたいなら `PermissionRequest` を使う**と明記されている。
- F13.2 **Codex CLI**
  - `notify` は `agent-turn-complete` だけを外部プログラムに渡す。
  - hooks には `PermissionRequest`・`Stop` 等があり、`hooks.json` で設定する。
    https://learn.chatgpt.com/docs/hooks
- F13.3 **端末のエスケープシーケンスによる信号**
  - OSC 9（通知、`9;4` は進捗）、OSC 777、OSC 99、OSC 133（プロンプト・コマンドの区切り）、OSC 0/2（タイトル）、BEL。
  - xterm.js には `onBell`・`onTitleChange`・`parser.registerOscHandler` がある。
    https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts
- F13.4 **herdr が Claude Code と Codex の状態を画面判定で決めていること**（F4.3）と整合する。hooks だけでは遷移（承認の結果、Esc による中断等）を取りこぼすため（`[H]agents.mdx:51`）。
