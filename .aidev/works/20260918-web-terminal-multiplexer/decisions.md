# 判断の記録

## D1: 三層判定は full（2026-09-18・aidev-00-start）

- **背景**: 空のリポジトリに新しくアプリを構築する work。
- **決定**: `profile: full`（`mode: interactive`）で起こす。
- **理由・代替案**: 振る舞いの新規追加であり、light の前提（振る舞いを変えない小規模）に当たらない。ユーザーも full を選択した。
- **影響**: requirements → design → tasks を個別のゲートで通す。

## D2: 製品全体を複数 work に分け、本 work は MVP 基盤に絞る（2026-09-18・requirements）

- **背景**: 依頼の範囲（herdr 相当のコア、外部操作 API、グルーピング、D&D、キーカスタマイズ、複数ホスト、ノードによるオーケストレーション）は PR 1 本に収まらない。
  いずれも基盤の上に載る機能で、単独で検証・デリバリできる。
- **決定**: 本 work は MVP 基盤（端末・workspace / tab / pane・エージェント状態・detach 後の継続・既定キー・マウス・1 ホスト＋認証・3 OS・モバイル）に絞る。
  残りは後続 work とし、requirements 承認後に backlog へ登録する。
- **理由・代替案**: 3 層決定木（DESIGN「5.」）で「単独で検証・デリバリ可能＝別 work」に当たる。
  代替案の「全体を 1 work で subtask 分割」は PR が過大になるため、ユーザーの選択で不採用。
- **影響**: design は後続 work（複数ホスト集約・外部操作 API・オーケストレーション）を作り直さずに載せられる構造を前提にする。

## D3: smokeCommand は技術スタックが決まるまで未設定のままにする（2026-09-18・aidev-00-start）

- **背景**: PJ が空で起動方法が無い。
- **決定**: `smokeCommand: none` とは書かず、未設定のままにする（`aidev smoke` は exit 2 で止まる）。
- **理由・代替案**: `none` にすると、起動確認を一度もしないまま合格扱いになる。
- **影響**: design か coding で起動方法が決まった時点で `.aidev/config.yml` に設定する。test 工程より前に必須。

## D4: requirements 承認後の訂正を research のゲートで扱う（2026-09-18・research）

- **背景**: research で、承認済みの requirements と食い違う事実（herdr のライセンス）と、範囲を決め直す材料（グルーピングの意味、backlog に無い機能群、再起動後の復元）が見つかった。
- **決定**: `aidev unapprove requirements` で工程を戻さず、research のゲートでユーザーに 4 点を確認し、その回答を requirements.md に〔D5〜D8〕の印を付けて反映する。
- **理由・代替案**: 訂正はどれも局所的で、ユーザーがゲートで明示的に回答している。工程を戻すと requirements → research の再承認が必要になるが、得られる確認は同じ。
  代替案の「工程を戻す」は不採用。
- **影響**: requirements.md の該当箇所に〔訂正 D5〕等の印が付く。metrics.yml に requirements の再承認は記録されない。

## D5: herdr の資産は Apache-2.0 の条件を守って流用してよい（2026-09-18・research ゲート）

- **背景**: herdr は 0.8.0（2026-08-03）で AGPL-3.0-or-later から Apache-2.0 に変わっていた（research.md F12.1）。requirements の「AGPL なので流用しない」は古い情報に基づいていた。
- **決定**: 著作権表示・LICENSE・NOTICE を保持し、変更した旨を示すことを条件に、herdr の資産（状態判定ルールの TOML、Rust を選ぶ場合のコード等）を流用してよい。
- **理由・代替案**: ユーザーの選択。代替案の「ライセンスが許しても流用しない」は不採用。
- **影響**: design で状態判定ルールの流用と追従の方法を検討する。流用した場合は、配布物に LICENSE / NOTICE を含める。

## D6: 後続の「workspace のグルーピング」は worktree グループと任意の束ねの両方（2026-09-18・research ゲート）

- **背景**: herdr のグループ化は、Git worktree を元の workspace の下に束ねるもの（research.md F7 の H37）。
- **決定**: 後続 work は、herdr と同等の worktree グループと、利用者による任意の束ねの両方を扱う。workspace・tab の並べ替え（H04）も同じ work に含める。
- **理由・代替案**: ユーザーの選択。
- **影響**: `.aidev/backlog/product-roadmap.md` の該当行を更新する。MVP の設計では、workspace を束ねる親子関係を後から足せるデータモデルにする。

## D7: サーバ再起動後のレイアウト復元を MVP に含める（2026-09-18・research ゲート）

- **背景**: herdr はサーバ再起動後に、workspace / tab / pane / cwd / レイアウト / フォーカスを復元する（research.md F6）。README でも筆頭の特徴に挙げている。
- **決定**: MVP に含める。requirements に F13 と AC18 を追加する。画面履歴の再生とエージェントの会話の再開は含めない（後続「セッション永続化の拡張」）。
- **理由・代替案**: ユーザーの選択。仕組みはデータの保存と再構成だけで難度は高くない（推測）。代替案の「後続に回す」は不採用。
- **影響**: design で、セッションの状態を保存する形式と保存の契機を決める。

## D8: backlog に無かった herdr の機能群を後続 work として追加する（2026-09-18・research ゲート）

- **背景**: herdr の棚卸し（research.md F7）で、既存の backlog のどれにも入らない機能群が見つかった。
- **決定**: 5 項目を backlog に追加する：通知、外観と設定、セッション永続化の拡張、端末機能の拡張、配布と運用。
- **理由・代替案**: ユーザーがすべてを選択した。
- **影響**: F7 の「新規後続(提案)」は「後続」に確定する。「非対応」に残るのは H47・H48 と、H15 のうち IME の自動切替だけ。

---

# design の方針（2026-09-18・design 開始時。**承認待ち**。承認後に結果を各エントリへ追記する）

## D9: サーバの技術スタック

- **背景**: requirements が TypeScript か Rust の比較検討を求めている（非機能要件「技術スタック」）。材料は research.md F8 の比較表。
- **案**:
  - **A（推奨）TypeScript**：Node.js 24 LTS＋`node-pty` 1.2 系＋`@xterm/headless`＋`@xterm/addon-serialize`
  - B Rust：`portable-pty`（herdr のパッチを流用）＋`libghostty-vt`＋axum
  - C Rust で herdr のサーバ部分を fork して Web のフロントを付ける
- **推奨理由（A）**:
  1. 再接続時の画面復元（AC8）で、サーバとブラウザが**同じエミュレータ（xterm.js）**を使うので、復元した画面が一致しやすい（F8.4）。
  2. ブラウザ側は xterm.js と TypeScript で確定している。**プロトコルの型をサーバとブラウザで直接共有**できる。
  3. Linux・Windows の両方で、VS Code がこの構成（node-pty＋headless）を大規模に出荷している実績がある（F8.1、F8.4）。
  4. requirements は単一バイナリを求めていない。配布は後続「配布と運用」の範囲。
- **B を退ける理由**：画面復元の要になる `libghostty-vt` は API が未安定で、ビルドに Zig が要る（F8.5）。
  他の crate は scrollback を書き出せない。型の共有にはスキーマ生成が要る。
- **C を退ける理由**：herdr は TUI を前提にした大きなコードベースで、fork の追従コストが読めない。
  requirements は「herdr との相互運用」を対象外にしており、fork はその境界を曖昧にする。
- **A のリスクと手当て**
  - node-pty 1.2 は beta（Linux 向けのビルド済みバイナリは 1.2 から）→ 版を固定する。
  - Windows の既知バグ（conhost の残留等）→ 3 OS 検証（AC16）で確認する。
  - serialize addon は experimental → 復元できない状態（OSC 8 のリンク・画像）を仕様に明記する。
- **将来への手当て**：プロトコルを言語に依存しない JSON の仕様として定義する。後で Rust のサーバに置き換える道を残す（D11）。

## D10: フロントエンドの構成

- **案**:
  - **A（推奨）React＋Vite＋xterm.js 6**
  - B Svelte
  - C SolidJS
  - D フレームワークなし（Web Components）
- **推奨理由（A）**:
  - 後続「ノードによるオーケストレーション」のノード編集で、最も成熟した React Flow（xyflow）が使える。
  - VS Code の Web 版を含め、xterm.js を React に載せた事例が多い。
- **B・C を退ける理由**：描画性能では有利だが、ノード編集の部品の選択肢が狭い（推測）。
- **D を退ける理由**：サイドバーの木構造・ダイアログ・モバイル UI の状態管理を自前で書く量が多い。

## D11: ブラウザとサーバの通信

- **案**:
  - **A（推奨）単一の WebSocket**：制御（JSON）と端末の出力（バイナリ）を 1 本に多重化する。
  - B zellij 方式の 2 本（端末用と制御用。F9.1）
  - C HTTP＋SSE
- **推奨理由（A）**
  1. 認証の検査点が 1 つで済む。
  2. 制御メッセージは **herdr の socket API の方式名と event 名に寄せる**（`workspace.create`、`pane.split`、`events.subscribe`、`session.snapshot` 等。research.md「影響範囲」）。
     後続「外部操作 API / CLI」は同じ操作面を別の経路（ローカルソケット）で公開するだけで済む。
  3. **端末の出力は、そのクライアントが画面に表示している pane だけ流す**（herdr の surface interest と同じ考え方。F7 の H43 の説明）。
     表示し始めたときに serialize したスナップショットを送り、以後は差分を流す。
     16 pane・大量出力でもブラウザが固まらないようにするため（非機能要件「応答性」「規模」）。
- **B を退ける理由**：認証の検査点が 2 つになる。1 本でもバイナリのフレームで区別できる。
- **C を退ける理由**：入力が別経路になり、遅延が増える。

## D12: 認証と TLS

- **案**:
  - **A（推奨）常に認証する（localhost でも）**
  - B localhost は認証なし
- **A の内容**
  - ログイン用 token は起動時に生成し、1 回だけ表示する。保存はハッシュ（Node 組み込みの scrypt）で行う。
  - ブラウザは token を POST で送り、HttpOnly・`SameSite=Strict`・（HTTPS 時）`Secure` の Cookie に交換する。
  - WebSocket の handshake では、毎回 Origin を許可リストで検証し、Cookie も検証する。
  - ログインの試行回数を制限する。応答ヘッダに CSP・`X-Frame-Options: DENY`・`Referrer-Policy: no-referrer` を付ける。
  - **ループバック以外で待ち受けるときは、証明書（cert / key）が無ければ起動を拒否する**（zellij 方式。F9.1）。
  - 利便のため `https://host:port/#token=…` 形式の URL を表示する。フラグメントはサーバに送られず、ページが読み取って POST し、URL から消す（F9.2・F9.3）。
- **推奨理由（A）**：requirements は「認証を経ないアクセスは一切の操作を許さない」（AC10）。
  localhost でも、DNS rebinding・同じホストの他のユーザー・別ポートの dev サーバからの接続を防げない（F9.3）。
- **B を退ける理由**：上記のリスクが残る。VS Code `serve-web` も localhost で token を必須にしている（F9.2）。
- **MVP の範囲外**：閲覧専用 token、リバースプロキシの背後での運用（後続）。

## D13: 複数クライアントの画面サイズ

- **案**:
  - **A（推奨）herdr 互換の方式＋モバイルは既定でサイズを奪わない**
  - B zellij 方式（tab を見ているクライアントの最小サイズ）
- **A の内容**
  - デスクトップは、同じ tab を見ているクライアントのうち**最後に操作したものがサイズを決める**（F5.1）。
  - **モバイルのクライアントは既定でサイズを決めない**。pane を画面幅に合わせて縮小し、パンで表示する（F9.7 の zellij の「画面に合わせる」）。
  - 利用者が明示的に「この端末に合わせる」を選んだときだけ、サイズを取る。
- **推奨理由（A）**：herdr と同じ操作感（requirements のゴール）を保ちつつ、スマートフォンで一言返しただけでデスクトップ側の pane が縮む事故を防ぐ。
- **B を退ける理由**：スマートフォンが繋がっている間、デスクトップの pane が常に縮む。

## D14: エージェントの状態判定

- **案**:
  - **A（推奨）herdr の判定ルール（TOML）を同梱し、判定エンジンを TypeScript で実装する**
  - B 自前でルールを書く
  - C hooks 主体
- **A の内容**
  - 同梱は D5 の条件に従う（LICENSE / NOTICE を含める）。
  - ルールの記法は小さい：切り出し範囲 11 種、照合は `contains` / `regex` / `line_regex` / `any` / `all`＋`not`、`priority`（調査済み）。
  - **前面プロセスとエージェントの対応表**（ルールには含まれない）は自前で持つ。Linux は `/proc` の cmdline、Windows は子孫プロセスの走査（F8.10・F8.11）。
  - **MVP で検証するのは Claude Code と Codex**（AC6）。他の約 20 種はルールを同梱して動かすが、**「未検証」と明示**する。
  - 汎用検出：ルールの無いプロセスはエージェントとして扱わない。既知のエージェントでルールに当たらなければ `idle` とする（herdr と同じ。F4.4）。
- **推奨理由（A）**：herdr と同じ精度を短い工数で得られ、ルールの更新にも追従できる（F12.2・F12.3）。
- **B を退ける理由**：各エージェントの UI の変化への追従を自前で抱える。
- **C を退ける理由**：Claude Code・Codex の hooks は遷移を取りこぼす（F13.4）。herdr もこの 2 つは画面判定で決めている。
- **MVP の範囲外**：ルールの自動更新。同梱した版で固定し、追従は後続「エージェント対応の拡充」。

## D15: そのほかの方針（推奨のみ。異論がなければこのまま進める）

- **プロセス構成**：MVP は単一のサーバプロセス（PTY も同じプロセス）。更新時の引き継ぎ（後続）で分離を検討する。
- **永続化**：セッションの形（workspace / tab / pane / レイアウト / cwd / フォーカス）を設定ディレクトリの `session.json` に保存する。一時ファイルに書いてから rename する。
  読めないときは退避してから新規に始める（herdr と同じ。F6）。
- **レイアウトのモデル**：tab ごとに二分木（分割方向・比率・子）。拡大表示（zoom）は tab のフラグ。
- **リポジトリ構成**：pnpm workspace で `packages/protocol`（型とスキーマ）・`packages/server`・`packages/web` の 3 つ。テストは Vitest（単体）と Playwright（E2E、モバイルのエミュレーションを含む）。
- **起動確認（smoke）**：`pnpm smoke` で、空いているポートにサーバを起動し、ログイン → pane の作成 → `echo` の往復を確かめてから終了する（D3 の宿題）。

---

# design の方針の承認結果（2026-09-18・ユーザー回答）

## D9 の結果: **Node.js＋差し替え可能な抽象化**（案 A を修正して採用）

- ユーザーから「TypeScript の実行速度は？ Node ではなく Bun が良いか」と質問があった。計測して回答した（`evidence/README.md`）。
  - VT 解析は Node 約 52 MB/s、Bun 約 73 MB/s（約 1.4 倍）。serialize はほぼ同じ。メモリは 1 pane 約 25MB（scrollback 1 万行）で同じ。
  - Bun は PTY に未解決の障害が 3 件ある（2026-09-18 に GitHub API で open を確認）：
    - node-pty の出力が届かない（oven-sh/bun#25822）
    - Bun.Terminal で exit が来ない（#40289）
    - Bun.Terminal に流量制御が無い（#41410）
- **決定**: Node.js 24 LTS＋node-pty で作る。PTY と WebSocket サーバは interface の裏に置き、Bun の PTY が安定したら差し替えられるようにする。
- **退けた案**: Bun（上記の障害）、Rust（D9 の B・C の理由）。

## D10 の結果: **Vue 3＋Vite。ノードの操作は自前で実装する**

- ユーザーから「React はエージェントの応答を受信するたびに再レンダリングされるのでは」と懸念が示された。
  **端末の出力は UI フレームワークの state を通さない**（設計規則。D16）ことを説明したうえで、ユーザーが Vue 3＋Vite を選んだ。
- 後続「ノードによるオーケストレーション」のノード編集は、ライブラリ（Vue Flow 等）を使わず自前で実装する（ユーザーの指示）。
- **退けた案**: React＋Vite（ユーザーの選択外）、Svelte 5。

## D11〜D15 の結果: 推奨案のまま採用（異論なし）

- D12・D13 はユーザーが推奨案を明示的に選んだ。D11・D14・D15 は異論が出なかった。

## D16: 端末の出力は UI フレームワークの state を通さない（設計規則）

- **背景**: D10 のやり取りで、出力のたびの再描画が懸念された。
- **決定**: WebSocket で受けた出力のバイト列は、pane ごとの xterm.js インスタンスへ直接 `write()` する。Vue のリアクティブな状態には入れない。
  Vue が扱うのは構造（workspace / tab / レイアウト）と状態（エージェントの状態等）だけ。状態は pane 単位で購読し、変わった行だけ更新する。
- **理由**: 出力は毎秒 MB 単位になりうる。どのフレームワークでもリアクティブな状態に入れれば重くなる。xterm.js は自前の描画系を持つ。
- **影響**: review で「出力が Vue の state を通っていないか」を点検の観点にする。

# design で新たに決めたこと（2026-09-18・design.md 作成時。design のゲートで承認を受ける）

## D17: 端末からの問い合わせにはサーバのミラーだけが応答する

- **背景**: 端末アプリは DA1・CPR 等を問い合わせる。xterm.js はブラウザ側でもサーバ側（headless）でも応答する（evidence の query-response で確認）。
- **決定**: 応答するのはサーバのミラーだけにする。ブラウザの xterm.js は、該当の問い合わせを `registerCsiHandler` / `registerOscHandler` で握りつぶす。
- **理由・代替案**: 応答元が複数だと、接続しているブラウザの台数分だけ応答が PTY に届く。ブラウザが 1 台も無いときにも応答が要る（Windows の新しい ConPTY は DA1 の応答を待つ。research.md F8.8）。
  代替案の「サイズ権限を持つブラウザが応答する」は、ブラウザが無いときに応答できないので不採用。
- **影響**: ブラウザ側で握りつぶす問い合わせの一覧を保守する。フォーカスの報告（`CSI ? 1004`）は利用者の操作なので、サイズ権限を持つクライアントだけがブラウザ側で送る。

## D18: シェルが終了したら pane を閉じる

- **背景**: herdr のドキュメントに、シェル終了時の pane の扱いが書かれていない（design.md の U3）。
- **決定**: tmux の既定（remain-on-exit off）と同じく、pane を閉じる。最後の pane なら tab を、最後の tab なら workspace を閉じる。
- **理由・代替案**: 代替案の「終了した pane を残して表示する」は、閉じる操作が 1 回増える。herdr の挙動が分かったら合わせ直す。
- **影響**: 復元時にシェルの起動に失敗した pane は、閉じずに理由を表示する（閉じると、利用者が気づかないまま構成が消えるため）。

## D19: 状態の集約の順は blocked ＞ done ＞ working ＞ idle ＞ unknown

- **背景**: herdr は「blocked は上位を blocked に見せる」「working は workspace を active に見せる」「done は見るまで残る」としか書いていない（`[H]agents.mdx:94-96`）。
- **決定**: 利用者の対応が要る順に並べる。入力待ち（blocked）→ 結果を見るべき（done）→ 実行中（working）→ 待機（idle）→ 不明（unknown）。
- **影響**: herdr の実装の順が分かったら合わせ直す（Apache-2.0 のソースで確認できる）。

## D20: scrollback の既定は 5,000 行（上限 10,000 行）

- **背景**: 実測で、1 万行・120 桁の headless は 1 pane 約 25MB、16 pane で約 400MB だった（evidence/README.md）。
- **決定**: 既定 5,000 行（16 pane で約 200MB の見込み）。`--scrollback` で 10,000 行まで増やせる。
- **理由・代替案**: herdr の既定は「pane あたり 10MB（バイト）」で単位が違う。行数で持つのは、xterm.js の設定が行数だから。

## D21: prefix 待ちは 3 秒で解除する

- **背景**: requirements の AC-I1 が「Esc か一定時間の経過で解除」を求めている。herdr の挙動は未確認。
- **決定**: 3 秒。後続「キーバインドのカスタマイズ」で設定できるようにする。

## D22: 製品の仮称とコマンド名は `wtm`

- **決定**: コマンド名を `wtm`（web terminal multiplexer）、状態ディレクトリ名を `web-tn-multiplexer`、Cookie 名を `wtm_session`、環境変数の接頭辞を `WTM_` とする。
- **影響**: 正式な名前が決まったら、配布の work でまとめて変える。

## D23: resize モードのキーと、閉じる前に確認する条件

- **背景**: herdr のドキュメントに、resize モードのキーと pane を閉じるときの確認の有無が書かれていない（design.md U3）。
- **決定**: resize モードは `h/j/k/l` と矢印で、1 回ごとに境界を 2% 動かす。
  閉じる前に確認するのは、対象に `busy`（前面プロセスがシェル以外）の pane を含むときと、workspace を閉じるとき（herdr の `ui.confirm_close` の既定 true）。
- **影響**: herdr の挙動が分かったら合わせ直す。

## D24: workspace が 1 つも無くなったら自動で作る

- **背景**: 閉じる操作や D18 の連鎖で、workspace が 0 個になりうる（design の独立点検の指摘）。
- **決定**: サーバがホームディレクトリで新しい workspace を自動的に作り、`workspace.created` を配る。
- **理由**: herdr は「workspace が無ければ自動で 1 つ開く」（`[H]quick-start.mdx:16`）。

## design の独立点検（1 巡目）の記録（2026-09-18）

- 委譲した点検で 32 件（must 2・should 17・nit 13）の指摘があり、すべて design.md に反映した。
- must の 1 つ（色の問い合わせと XTVERSION にミラーが応答する根拠が無い）は、手元で確かめて**ミラーは応答しない**と分かった（evidence/query-response-2.mjs）。
  色の問い合わせにはサーバが応答する処理を足し、XTVERSION 等にはどこからも応答しないと決めた（design.md「ブラウザ側での問い合わせの握りつぶし」）。

---

# architecture の方針（2026-09-18・architecture 開始時。**承認待ち**）

## D25: サーバの内部構造は「操作面・ドメイン・アダプタ」の 3 層にする

- **案**:
  - **A（推奨）**：`ControlSurface`（方式名 → ハンドラの登録表。入力は zod で検証）→ `SessionService`（ドメインの操作）→ `EventBus`（型付きのイベント）。
    WebSocket は `ControlSurface` と `EventBus` につなぐアダプタにすぎず、後続「外部操作 API / CLI」はローカルソケットのアダプタを足すだけにする。
  - B：WebSocket のハンドラが直接モデルを操作する。
- **推奨理由**：design の方針 4（同じ操作面を後続の API で公開する）を構造で保証する。単体テストもトランスポート抜きで書ける。
- **B を退ける理由**：後続の API で、ハンドラを書き直すか WebSocket に依存したまま流用することになる。

## D26: pane ごとの端末は `TerminalHost` にまとめる

- **案**:
  - **A（推奨）**：pane ごとに `TerminalHost`＝`PtyBackend` のインスタンス＋`Mirror`（headless・serialize・OSC の取得）＋`OutputFanout`（購読者への配信・溜め置き・流量制御）をまとめる。
    `SessionService` は pane の id から `TerminalHost` を引く。エージェント判定（`AgentMonitor`）は `TerminalHost` から画面と前面プロセスを読むだけにする。
  - B：PTY・ミラー・配信をそれぞれ独立したサービスにして、pane の id で結ぶ。
- **推奨理由**：design の「スナップショットと差分の継ぎ目」と「流量制御」は、PTY・ミラー・配信の 3 つが同じ順序で動くことが前提。1 つの部品に閉じると、順序の保証を 1 か所で持てる。

## D27: Web UI の状態は Pinia、端末は非リアクティブな登録簿、キーは Vue に依存しない状態機械

- **案**:
  - **A（推奨）**：構造と状態は Pinia のストア。xterm.js のインスタンスは `markRaw` した `TerminalRegistry`（Vue の外）。
    キー操作の状態機械 `KeyRouter` は Vue に依存しない純粋な TypeScript にし、単体テストで全遷移を確かめる。
  - B：Pinia を使わず、`reactive()` のモジュールで持つ。
- **推奨理由**：Vue の標準で、開発ツールで状態を追える。D16（出力は state を通さない）を、登録簿を Vue の外に置く形で構造にする。

## D28: 表示から外れた pane の xterm.js は破棄し、再び表示するときにスナップショットから作り直す

- **案**:
  - **A（推奨）**：pane が表示から外れたら（tab の切替・workspace の切替）、xterm.js を破棄して出力の購読もやめる。
    再び表示するときは、新しく作ってサーバの SNAPSHOT で復元する（5,000 行で数十 ms の見込み。E3 の 1 万行 57ms からの推測）。
  - B：作った xterm.js はすべて保持し、隠れている pane にも出力を流し続ける。
- **推奨理由**：design の方針 5（表示中の pane だけ流す）と一致する。ブラウザのメモリが pane の総数ではなく表示中の数に比例するので、モバイルでも持つ。再接続時と同じ経路なので、復元の不具合をふだんの操作で見つけやすい。
- **B を退ける理由**：tab の切替は速いが、ブラウザ側にも pane の数だけ scrollback を持つ（1 pane 約 12〜25MB の見込み）。隠れている pane にも出力を流すので、流量の問題が表示中でない pane から起きる。
- **A の代償**：tab を切り替えるたびに、xterm.js の生成と SNAPSHOT の転送が走る。切り替えの体感が悪ければ、「直前に表示していた tab の分だけ残す」キャッシュを足す。

## D29: 細かな部品の選定（推奨のみ）

- 入力の検証：zod 4（4.6 系）。後続の API で JSON Schema を書き出せる（herdr の `herdr api schema` 相当）。
- TOML の読み込み：`smol-toml`（1.8 系）。
- WebSocket：`ws`（8.21 系）。`WsServer` の interface の裏に置く（D9）。
- テスト：Vitest（5 系）、E2E は Playwright（1.63 系）。ビルドは Vite（8 系）と tsc。

# architecture の方針の承認結果（2026-09-18・ユーザー回答）

## D28 の結果: **表示したことのある pane の xterm.js を上限付きで保持する（LRU）**（案 A を差し替え）

- ユーザーから「破棄して作り直す場合、切替のたびに出力を受信し直すのか」と質問があった。計測して回答した（evidence/README.md「スナップショットの大きさ」）。
  - 受信し直すのは「画面＋scrollback」のスナップショット。5,000 行で 328KB（deflate 後 34KB）、serialize はサーバで 56ms。
  - Node は単一スレッドなので、4 pane の tab に切り替えると約 220ms、ほかの pane の処理が止まる（推測）。非機能要件の p95 50ms に響く恐れがある。
- **決定**: ブラウザは、表示したことのある pane の xterm.js を LRU で保持する。上限はデスクトップ 24 pane、モバイル 2 pane（表示中＋直前）。
  保持している pane には出力を流し続ける。スナップショットを送るのは、初めて表示するとき・上限で破棄した pane を再び表示するとき・再接続したときだけ。
- **design への影響**: 方針 5「表示中の pane だけ流す」を「**ブラウザが保持している pane だけ流す**」に改める。
  購読は `client.view`（表示とサイズの申告）から切り離し、`pane.subscribe` / `pane.unsubscribe` の方式で行う（D30）。
- **退けた案**: 破棄して作り直す（上記の CPU の懸念）、すべて保持する（ブラウザのメモリが pane の総数に比例する）。

## D25〜D27・D29 の結果: 推奨案のまま採用（異論なし）

## D30: 出力の購読は、表示の申告とは別の方式にする

- **背景**: D28 で、購読の範囲（保持している pane）と表示の範囲（サイズ権限に使う）が一致しなくなった。
- **決定**: `pane.subscribe { paneId, scrollbackLines }` で SNAPSHOT と以後の OUTPUT を受け始め、`pane.unsubscribe { paneId }` で止める。
  `client.view` は、表示している tab と pane のサイズの申告だけに使う。
- **影響**: design.md の方式の表と「接続・ログイン・初回表示」の流れは、architecture.md の定義を正とする。

## D31: WebSocket は permessage-deflate で圧縮する

- **背景**: スナップショットは deflate で約 1/10 になる（evidence）。
- **決定**: `ws` の `perMessageDeflate` を有効にする。ただし 1KB 未満のメッセージは圧縮しない（キー入力のエコーの遅延を増やさないため。`threshold: 1024`）。

## architecture の独立点検（1 巡目）の記録と、全面改稿の判断（2026-09-18）

- 委譲した点検で 29 件（must 4・should 15・nit 10）の指摘があった。
  中心は「図の辺・表の依存・interface・シーケンスの食い違い」で、互いに絡み合っていた（例：EventBus の層、モデルを書き換える役、Web の port）。
- **決定**: 最小の差分で当てる規約（protocol-check.md）から外れ、節の構成を保ったまま**全面改稿**した。
- **理由**: 図と 2 つの表を 1 か所ずつ直すと、直した辺が別の表とずれる連鎖が起きる。3 つを同時に書き直すほうが整合を取りやすい。
- **影響**: protocol-check.md の実測（2 巡目の指摘の多くが 1 巡目の修正由来）に当たる恐れがあるので、2 巡目の独立点検を勧める。
- **改稿で新たに決めたこと**（architecture.md「設計判断」の「新」の行）
  - EventBus はドメイン層に置く。
  - モデルを書き換える入口は SessionService 1 つにする。
  - MethodContext に ClientSink を含める。
  - Web の `net/`・`term/`・`keys/` は port 越しに UI とつなぐ。
  - `ViewSync` が「client.view → pane.subscribe」の順を保証する。
  - `KeyInputController` がキー入力の橋渡しを担う。
  - copy モードの命令は `CopyCommand` として `ActionDispatcher` 経由で `CopyTarget` に渡す。
  - モバイルの WebGL の上限は 2（LRU の容量に合わせる）。

## architecture の独立点検（2 巡目・上限）の記録（2026-09-18）

- 2 巡目の指摘は 25 件（must 0・should 15・nit 10）。1 巡目の 29 件（must 4）から減り、must は無くなった。
- すべてを**最小の差分**（29 か所の置換）で反映した。主な内容：
  - 図の辺の補完、Web の循環する port を「作った後に bind する 2 段階」で組み立てること
  - OS に触る処理を基盤の interface（`ManifestSource`・`GitRunner`・`NetworkInfo`）に移すこと
  - セッションの失効を `auth.session_revoked` で WsGateway に伝えること
  - モードの持ち主を `KeyRouter` 1 つにすること
  - 継ぎ目の手順に世代番号を付けること
  - `TerminalManager` などの interface を足すこと
  - tasks の順序を依存に合わせること
- **上限（2 巡）に達したので、3 巡目は行わない**（protocol-check.md「上限で止まったら深追いしない」）。
  2 巡目の修正が新たに生んだ食い違いが残っている可能性がある。tasks での分解（`対象` 欄を書くとき）と 60 review で拾う。

---

# tasks の方針（2026-09-18・tasks 開始時。**承認待ち**）

## D32: subtask に分割するか（split 判定。DESIGN「5.」の 3 層決定木）

- **判定の材料**
  - 単独でデリバリできるか → できない（サーバだけ・UI だけでは利用者に届かない。1 PR で着地させる前提＝D2）。
  - 規模 → 大きい（architecture の実装順で 16 段階、タスクは 60〜80 件の見込み）。
  - 結合 → 高い（protocol を介して一緒に動かして初めて検証できる）。
  - → 決定木の中段「**subtask 分割（1 PR を保ったまま、内部を段階的に実装・レビュー）**」に当たる。
- **案**
  - **A（推奨）5 つの subtask**：`01-server-core`（architecture の申し送りの 1〜8・10）→ `02-agent-detection`（9）→ `03-web-desktop`（11〜14）→ `04-mobile`（15）→ `05-e2e-docs`（16 のうち E2E・計測・docs の成果物）。
    3 OS での実機検証（AC16）とスマートフォンの実機確認は、親の統合 test で行う。
  - B 3 つの subtask：サーバ（エージェント判定を含む）→ Web（モバイルを含む）→ E2E・docs。
  - C 分割しない（1 つの tasks.md に 60〜80 件）。
- **推奨理由（A）**
  - エージェント判定は独立した部品群で、herdr のソースの確認（U1）という不確実性を抱えている。サーバの基盤から切り離すと、レビューの単位が小さくなる。
  - モバイルはデスクトップの UI の上に載る差分で、xterm.js のタッチの不具合（U4）という別の不確実性がある。
- **B を退ける理由**：1 つの subtask が 30 件を超え、段階的なレビューの効果が薄れる。
- **C を退ける理由**：レビューの単位が PR 全体になり、指摘が統合の後にまとめて出る。

## D32 の結果: **5 つの subtask に分割する**（案 A。ユーザーが選択）

- `01-server-core` → `02-agent-detection`（01 に依存）・`03-web-desktop`（01 に依存）→ `04-mobile`（03 に依存）→ `05-e2e-docs`（02・03・04 に依存）。
  `aidev new --parent … --depends …` で作成した。
- 親の `tasks.md` はメタ tasks（割れ目・順序・受け入れ基準の分担・リスク・テスト方針）で、`T<n>` のチェックリストは持たない。
  そのため、親の tasks の承認は `tasks_planned=0 tasks_anchored=0` で記録する（測っていないのではなく、親にはタスクが無い）。
- 3 OS での検証（AC16）と実機の確認は、親の統合 test で行う。

## D33: D18（シェル終了時の pane の扱い）の確認は 01-server-core で行う（2026-09-18・01 の tasks）

- **背景**: 親の tasks.md は herdr の挙動の確認（D18・D19・D21・D23）を 03 の最初のタスクに置いた。しかし D18 は `SessionService`（01 の範囲）で実装する。
- **決定**: D18 の確認だけを 01 の T14 に移す（T17 より前）。D19・D21・D23 は予定どおり 03 で確かめる。
- **理由**: 実装する subtask で確かめないと、01 の review の後に 03 で覆って 01 へ差し戻すことになる。範囲（どの subtask が何を作るか）は変えていない。

## D34: 本製品のライセンスは MIT（2026-09-18・01 の tasks のゲートでユーザーが選択）

- **決定**: 本製品は MIT ライセンス。herdr 由来の資産（判定ルールの TOML）は Apache-2.0 の表示（`NOTICE`・`third_party/herdr/LICENSE`）を残して同梱する（D5）。
- **影響**: 01 の T2 でルートに `LICENSE`（MIT）を置く。

## D35: pane のシェルは対話モードで起動する（`-c` を使わない）（2026-09-18・01-server-core T7）

- **背景**: T7 の結合テストで、`/bin/sh -c "sleep 5"`（非対話）では job control が働かず、シェル自身の pid が
  ずっと前面プロセスグループのままになり、`ProcessInspector.foreground()` が子プロセス（`sleep`）を検出できないことが分かった。
  対話起動の bash（`--norc --noprofile` をプロンプトに続けて）に `sleep 5\n` を送った場合は、job control が働いて
  正しく子プロセスへ切り替わることを実測で確認した（Linux・bash・dash で確認。evidence 相当は T7 の結合テスト自体）。
- **決定**: `TerminalManager.create`（T13）が起動する pane のシェルは、**常に対話モードで起動する**
  （`-c` などでコマンドを直接実行しない。design の既定シェルは元々 `$SHELL` を引数無しで起動する想定で、
  この制約と矛盾しない）。`smoke.ts`（T22）で `echo` を確かめるときも、対話シェルへ入力として送る（`-c echo` にしない）。
- **理由・代替案**: 前面プロセスの検出（AC6・エージェント判定）が pane 全体の価値の根幹で、非対話シェルではそれが機能しない。
  代替の「`/proc` 以外の手段で検出する」は、herdr も同じ tpgid 方式を使っており、確立した方法から外れる理由が無い。
- **影響**: 02-agent-detection・03-web-desktop のいずれでも、pane の起動経路が対話シェルであることを前提にしてよい。

## D36: D18・D24 を herdr のソースで確認した結果（2026-09-18・01-server-core T14）

- **確認方法**: herdr のソース（`da6bcd5`。Apache-2.0。D5）の `src/app/actions.rs` の `handle_pane_died` と、
  `src/api/schema/events.rs` の `EventData::PaneExited` を直読した。
- **D18（シェル終了時に pane を閉じる）は herdr の実装と一致していた**。
  `handle_pane_died` は `ws.remove_pane(pane_id)` を呼び、それが workspace 最後の pane なら workspace 自体も
  `self.workspaces.remove(ws_idx)` で削除する。design.md の「pane を閉じる。最後の pane なら tab を、最後の tab なら workspace を閉じる」と同じ連鎖。
  **確定**（D18 は自前の想定のままでよい。「herdr の挙動は未確認」の注記を外してよい）。
- **`pane.exited` は `pane.closed` と別のイベントとして先に出る**ことも確認した
  （`app/api.rs`：`PaneDied` を受けたら先に `EventKind::PaneExited` を発行し、その後にレイアウトの除去処理が続く）。
  design.md のイベント表はこれと一致している（`pane.exited` → `pane.closed` の順。architecture.md の独立点検で確定済み）。
- **D24（workspace が 0 個になったら自動作成）は herdr と食い違うことが分かった**。
  `handle_pane_died` は、workspace が 0 個になっても新しい workspace を自動作成しない
  （`self.workspaces.is_empty()` のとき `self.mode = Mode::Navigate` にするだけ）。
  自動作成は**起動時に session が空だったときだけ**（`quick-start.mdx`「When a session has no workspaces, Herdr opens one automatically」は起動の文脈の記述だった）。
- **決定**: D24 は herdr と違う独自の挙動として維持する（起動時だけでなく、実行中に 0 個になったときも自動作成する）。
  理由：workspace が 1 つも無い状態の専用 UI（herdr の Navigate モード相当の空表示）を作らずに済み、実装が単純になる。
  AC1〜AC3 はこの挙動を妨げない。**deliver までに herdr との対応表（AC15）へ「D24: workspace 0 個時の自動作成は herdr と異なる（意図的な差異）」と明記する**。
- **影響**: T17（SessionService）はこの決定のとおり実装する（既に architecture.md の記述と一致しているので変更不要）。

## D37: シェルの起動失敗は「短い猶予の間に終了するか」で判定する（2026-09-18・01-server-core T13）

- **背景**: 実測すると、node-pty の `spawn()` は存在しない実行ファイルを渡しても**同期的には例外を投げない**。
  fork 済みの子プロセスの中で `execvp` が失敗し、`execvp(3) failed.: No such file or directory` を出力してから
  非同期に `onExit`（exitCode 1）が届く（数十 ms 程度）。design.md の「シェルの起動に失敗…要求には spawn_failed を返す」は、
  これが同期的に分かる前提の書き方だったが、実際は非同期にしか分からない。
- **決定**: `TerminalManager.create()`（T13）は architecture.md どおり**同期**のまま、例外は投げない。
  「起動に失敗したか」の判定は **T17（SessionService）が担う**：`create()` の直後に短い猶予
  （既定 300ms。設定可能にする）を置き、その間に `TerminalHost.onExit` が非 0 の終了コードで発火したら
  失敗と判定する。
  - 新規作成（`workspace.create` 等）で失敗したら、`spawn_failed` を返し、`SessionModel` への変更は
    コミットしない（成功を確認してからモデルを更新する順にする。design の「作りかけの pane は作らない」と一致）。
  - 復元（`restore`）で失敗したら、pane を `status: 'failed'` にする（design のとおり）。
- **理由・代替案**: 代替の「`spawn()` を Promise 化して常に非同期にする」は architecture.md の
  `TerminalManager` の interface（同期）を変えることになり、独立点検を経た構造を書き直すことになる。
  猶予時間による判定は、herdr の `agent_start` の待ち合わせ（`agent_not_ready`）と同じ考え方。
- **影響**: T17 の実装で、この猶予判定のロジックを持つ。T13 では単に `onExit` を配るだけでよい。

## D38: AuthService の実装で明確にした 2 点（2026-09-18・01-server-core T15）

- **`auth.session_revoked` はクライアント向けの `ServerEvent`（`@wtm/protocol`）とは別の、専用の内部通知にした**。
  architecture.md の表は AuthService の依存に `EventBus` を挙げていたが、`ServerEvent` の一覧
  （design.md・`packages/protocol/src/events.ts`）にセッション失効は無い。ブラウザに見せる必要のない
  サーバ内部の信号なので、`AuthService.onSessionRevoked(cb)` という専用の口にした。
- **`AuthService.initialize()` を追加した**。`verifySession` は同期（ディスクへ触らない）にしたため、
  `auth.json` を読み込む非同期の一手間をどこかで済ませる必要がある。T22（`main.ts`）は、起動時に
  `authService.initialize()`（または `ensureToken()`。どちらも内部で読み込みを済ませる）を、
  最初の HTTP / WebSocket 接続を受け付ける前に呼ぶこと。
- **影響**: T20（WsGateway）は `AuthService.onSessionRevoked` を購読して close コード `4401` を送る。

## D39: テストファイルも型検査する `pnpm typecheck` を足場に追加（2026-09-18・01-server-core T17）

- **背景**: T1 で `tsc -b` の対象からテストファイルを除外した（dist にテストが混ざるのを防ぐため）。
  その結果、テストファイルの型の食い違い（例：SessionModel のリファクタで消した `autoCreated` を
  参照したままのテスト）が `tsc -b` でも `vitest run`（esbuild は型を検査しない）でも検出されず、
  T17 の作業中に手作業で見つけて直す事態になった。
- **決定**: 各パッケージに `tsconfig.typecheck.json`（テストを除外しない・`noEmit`）を追加し、
  `pnpm typecheck`（ルート）で全パッケージの型を検査する。ビルド成果物には影響しない。
- **影響**: 以後のタスクでは、ビルド・テスト・lint に加えて `pnpm typecheck` も通すこと。
  T1 の「テスト」欄には無かった手順なので、ここに追記する形で補う。

## D40: `@xterm/headless`・`@xterm/addon-serialize` は default import で受けて実行時に分解する（2026-09-18・01-server-core T22）

- **背景**: `smoke.ts` を実物の Node（`node dist/smoke.js`）で初めて動かしたところ、
  `import { Terminal } from "@xterm/headless"` が実行時に `SyntaxError: … does not provide an export named 'Terminal'` で落ちた。
  両パッケージは minify された単一ファイルの CJS バンドル（webpack 出力）で、
  Node の ESM ローダの cjs-module-lexer が named export を静的解析できない。
  **vitest（esbuild 経由）のテストは変換の緩さでこの欠陥を見逃していた**——ユニット・結合テストが全部通っていたのに、
  実行ファイルとして動かすまで気づけなかった。
- **決定**: `import xtermHeadless from "@xterm/headless"`（default import）で名前空間オブジェクトを受け、
  `const { Terminal } = xtermHeadless` のように実行時に取り出す（`node-pty`・`@vscode/windows-process-tree` と同じ回避策）。
  Node の ESM は「default import は CJS の `module.exports` 全体を指す」という仕様上必ず効くため、
  named import と違って静的解析に依存しない。
- **理由・代替案**: 代替の「vitest の型検査（`--typecheck`）を通す」は今回の欠陥を検出できない
  （型は合っていて、失敗するのは実行時の ESM/CJS 相互運用だけのため）。
- **影響**: **この種のパッケージ（named export の少ない minify された CJS）を今後追加するときは、
  ユニットテストが通っても `node dist/*.js` で実際に動かして確かめる**ことを review の観点に加える。
  02-agent-detection・03-web-desktop で新しい依存を足すときも同様に注意する。

## D41: ESLint の除外パターンをリポジトリ全体で効くように直した（2026-09-18・01-server-core T22）

- **背景**: T1 で置いた `.eslintrc.cjs` の `ignorePatterns: ["dist/**", ...]` は、ESLint の起動ディレクトリからの相対パスとして解釈される。
  各パッケージを個別に lint する（`eslint packages/server/src --ext .ts` 等）ときは影響が無いが、
  ルートから `eslint . --ext .ts`（`pnpm lint`）を打つと `packages/*/dist/**` にはマッチせず、
  ビルド成果物の `.d.ts` を検査してしまっていた（T22 で気づいた）。
- **決定**: `["**/dist/**", "**/node_modules/**", "*.cjs"]` に直す。
- **影響**: 以後のタスクでも `pnpm lint`（ルートから）が使える。個別パッケージへの lint はこれまでどおり。

## D42: `closeWorkspace`・`closeTab` が連鎖で消える pane/tab のイベントを出していなかったのを直した（2026-09-18・01-server-core coding 工程終了時の cross taskcheck）

- **背景**: `aidev-40-coding` 手順5.5（タスクをまたぐ不変条件の点検）で、`SessionService.closeWorkspace`・
  `closeTab` の2つが、連鎖で一緒に消える pane・tab の PTY は破棄するのに、対応する `pane.closed`・`tab.closed`
  イベントを出していないことが分かった（`closePane` は正しく `result.removedPaneIds` をループして
  `pane.closed` を出していたのに、兄弟メソッドの2つだけ実装が漏れていた）。design.md の
  「連鎖して閉じるときは pane.closed → tab.closed → workspace.closed の順に送る」という規則に違反していた。
  `SessionModel` 側にも同じ理由の欠陥があった：`RemovalResult.closedTabId` が単数だったため、
  `closeWorkspace` を直接呼んで複数 tab が同時に消えるケースを表現できなかった（常に `null` になっていた）。
- **決定**:
  - `RemovalResult.closedTabId: TabId | null` を `removedTabIds: TabId[]` に変える（閉じた順の配列。
    要求した pane/tab/workspace 自身の連鎖で消えた tab を全て含む）。
  - `SessionService.closeWorkspace`・`closeTab`・`closePane` の3メソッドとも、`removedPaneIds` を
    ループして `pane.closed` を、`removedTabIds` をループして `tab.closed` を、その後に
    `workspace.closed`（あれば）を出す、という同じ形に揃える。
  - `SessionModel.test.ts`・`SessionService.test.ts` に、`closeTab`・`closeWorkspace` を**直接**呼んで
    複数 pane・複数 tab を一度に閉じるケースの回帰テストを足す（今まで `closePane`／シェル終了(D18) 経由の
    連鎖しか自動テストで確かめておらず、直接呼ぶ経路の欠陥が素通りしていた）。
- **理由・代替案**: 代替の「`closedTabId` を残したまま、複数 tab のケースだけ別のフィールドを足す」は
  フィールドが2種類の意味を持つことになり分かりにくい。`removedPaneIds` と同じ複数形の配列に統一する方が、
  呼び出し側（`SessionService`）の3メソッドを同じ形のループで書けて一貫する。
- **影響**: `SessionModel.ts`・`SessionService.ts`・`SessionModel.test.ts`・`SessionService.test.ts` を変更。
  他に `closedTabId`/`RemovalResult` を参照する箇所は無かった（grep で確認済み）。
  タスク単位の独立点検（`aidev-40-coding` 手順5）はこの work では `mode: interactive` のため未実施
  （`対象: 未特定` だった T14 は差分を生まないタスクだったため対象外）だったが、
  手順5.5 の cross taskcheck（work 全体をまたぐ不変条件の点検）でこの欠陥を検出できた。

## D43: review ラウンド1（20件）を全て修正（2026-09-18・01-server-core）

- **背景**: review 工程で独立レビューに委譲した結果、must 7件・should 10件・nit 3件（計20件）の指摘を受けた
  （全文は `01-server-core/review.md`「ラウンド1」）。coding 工程へ差し戻し、全件対応した。
- **主な修正**（詳細はコード中のコメントと `review.md` を参照）:
  - **D37 の順序違反の是正**: `SessionModel.createWorkspace`/`createTab` を `reserveWorkspace`/`commitWorkspace`・
    `reserveTab`/`commitTab` に分割し、`splitPane` と同じ「reserve → spawn 確認 → commit」の順に揃えた
    （以前は逆順で、spawn 確認前にモデルへコミットしていた）。`Pane` オブジェクトの組み立ても
    `makePane` ヘルパーへ共通化（4箇所の重複を解消）。
  - **D37 の猶予中 0-exit で zombie pane になる欠陥の是正**: `raceSpawn`/`spawnForPane` が
    `alreadyExited` を返すようにし、猶予中に既に終了していた場合は呼び出し側（create 系4箇所）が
    モデルへコミットした**直後**に `closePaneAfterExit` を自分で呼ぶ（`TerminalHost.onExit` は
    一度きり・同期発火でリプレイしないため、後から登録した listener は既に発火済みの終了イベントを
    永久に受け取れないことが原因だった）。
  - **`TerminalManager.create()` の PTY 破棄漏れ**: 自前の `onExit` ハンドラが `hosts` から削除するだけで
    `host.dispose()` を呼んでいなかった（`SessionService` 側の `dispose(paneId)` が後から呼ばれても
    既に Map に無いので何もしない）ため、`Mirror`（xterm headless インスタンス。最大 ~25MB/pane）が
    解放されないリークになっていた。ここで直接 `dispose()` するよう修正（`TerminalHost.dispose()` は
    多重呼び出し安全）。
  - **`ControlSurface.invoke` が `SessionModel.NotFoundError` を捕捉していなかった**: `requireX` を経ない
    約13個の `SessionService` メソッドで未知 id を渡すと `not_found` ではなく `internal` になっていた。
    `ControlSurface.invoke` で `NotFoundError` も `not_found` に読み替えるようにし、`pane.focus` に
    残っていた手作業の回避ガードは不要になったので削除した。同時に、想定外の例外はクライアントへ
    生のメッセージを返さず（内部パス等の漏洩防止）、サーバ側ログにだけ残すようにした（`ControlSurface`
    に任意の `Logger` を注入）。
  - **`SizeAuthority.transferOwnership` の資格フィルタ漏れ**: `noteInteraction` にはある
    「fit していないモバイルは権限を取らない」条件が抜けており、非 fit のモバイルへ権限が渡って
    pane が縮む事故が起きえた（D13 の想定外）。条件を揃えた。
  - **`persist.touch()` の呼び忘れ**: focus/レイアウト系8メソッド（focusWorkspace/focusTab/focusPane/
    focusPaneDirection/swapPane/zoomPane/resizePaneByDirection/setSplitRatio）が `session.json` に
    永続化される値を変えるのに保存を予約していなかった（非グレースフル終了で変更が消える）。全て追加。
  - **`updatePaneRuntime` の無条件発行**: `busy`/`title` が「値が変わったか」ではなく「渡されたか」で
    `pane.updated` を発行していたため、AgentMonitor の周期呼び出し（02-agent-detection）のたびに
    変化が無くても全クライアントへ配信していた。値の変化を見るように直した。
  - **`composeServer().close()` が WebSocket を閉じない**: `wsServer`/`WsGateway` が返り値に保持されておらず、
    ブラウザが1つでも繋がったまま SIGINT/SIGTERM すると `httpServer.server.close()` が永久にコールバックを
    呼ばなかった（要 SIGKILL）。`WsServer` に `closeAll(code, reason)` を足し、`close()` から呼ぶようにした。
  - **その他 should**: `AuthService.verifySession` の TTL 失効時に `liveSessionIds` が漏れる／
    `LoginRateLimiter` の空エントリが残り続ける／`WsServerWs` に `maxPayload` が無かった（design の
    「大きすぎる入力（1MB超）」の判定自体も `WsGateway` に実装が無かったので、この機に追加した）／
    `WindowsProcessInspector.deepestNode` の tie-break が `>=` で最後の枝を優先してしまっていた
    （コメントどおり `>` に）／`PersistScheduler` の再入（`touch()` のタイマーと `flush()` が同時に
    `save()` を走らせうった。進行中の保存に相乗りするよう修正）／`OriginPolicy` が scheme の既定ポート
    （80/443）で待ち受けるときにポート無しの Host/Origin を拒否していた（ブラウザは既定ポートを省略する）／
    `SessionFile`/`AuthFile` の `load()` が `schema` としか見ず残りを無検証キャストしていた（zod で
    深く検証するように変更。D29 のパターンに揃えた）。
  - **nit 3件**: `FileLogger` のコメント修正（`debug`/`info` は実際は stdout）、
    `TerminalManager.create()` の `defaultShell()` 二重呼び出しの解消、D24 の自動作成チェックの
    重複を `recreateIfEmpty()` へ集約。
- **副産物で見つけた別のバグ（review 指摘には無い）**: `composeServer.integration.test.ts` の
  `afterEach` が `Promise.all(cleanups...)` で `server.close()`（`persist.flush()` でステートディレクトリへ
  書き込む）と `rm(stateDir, …)`（それを丸ごと消す）を**並行**に走らせており、フルスイート実行時に
  ときどき `ENOENT` で落ちる原因になっていた（close→rm の順で push しているのに並行実行では
  順序が保証されない）。逐次実行に変更して解消した。
- **影響**: `SessionModel.ts`・`SessionService.ts`・`TerminalManager.ts`・`ControlSurface.ts`・
  `surface/methods/pane.ts`・`SizeAuthority.ts`・`composeServer.ts`・`WsServer.ts`・`WsServerWs.ts`・
  `WsGateway.ts`・`AuthService.ts`・`LoginRateLimiter.ts`・`WindowsProcessInspector.ts`・
  `PersistScheduler.ts`・`OriginPolicy.ts`・`SessionFile.ts`・`AuthFile.ts`・`log/Logger.ts` を変更。
  テストも複数追加・更新（D42 の項と合わせて、`SessionModel.RemovalResult` 由来の `closedTabId`→
  `removedTabIds` の変更点は D42 を参照）。修正後、typecheck/lint/build/テスト（protocol 11・server 214）
  ／`aidev smoke` を全て確認済み。

## D44: review ラウンド2（2件）を修正。`spawnForPane` を使う残り全箇所の同じ不変条件を確認（2026-09-18・01-server-core）

- **背景**: D43 の修正を独立検証に委譲したところ、`splitPane` に `createTab` と同じ孤児化防止ガードが
  漏れていた（should）ことと、`ControlSurface.ts` の import が architecture.md の依存表に無い層を
  直接指していた（nit）ことが分かった（`01-server-core/review.md`「ラウンド2」）。
- **決定**: 両方を修正。`splitPane` に `createTab` と同型の try/catch（`model.splitPane` が失敗したら
  `terminals.dispose(newPaneId)` してから rethrow）を追加し、回帰テストも足した。`ControlSurface.ts` の
  `NotFoundError` の import 元を `session/SessionModel.js` から `session/SessionService.js`（再エクスポート）へ変更。
- **2回目の差し戻しのプロトコル**（`aidev event review sent_back` が促す）に従い、「この指摘は D43 の修正に
  由来するか」を確認 → Yes。よって `spawnForPane` を呼ぶ残り全箇所で同じ不変条件
  （猶予中に対象が消えたら孤児化した PTY を破棄する）が保たれているか棚卸しした:
  - `createWorkspace`：新規 workspace 自体を作るだけで、消えうる「親」が無い（reserveWorkspace は
    既存データを参照しない）。構造的にこの種の孤児化は起きない。
  - `restorePaneProcess`：`SessionService.restore()` の呼び出し元は `composeServer.listen()` で、
    `httpServer.server.listen()`（クライアント接続の受付開始）より**前**に完了する。この間は
    並行する RPC が一切存在しないため、対象が「猶予中に消える」余地が無い。
  - 結果：`createTab`・`splitPane` の2箇所だけがこの不変条件の対象で、どちらも修正済み。
- **影響**: `SessionService.ts`（splitPane）・`ControlSurface.ts`・`SessionService.test.ts`（回帰テスト追加）。
  typecheck/lint/build/テスト（protocol 11・server 215）／`aidev smoke` を全て確認済み。

## D45: 02-agent-detection の tasks で herdr のソースを先読みし、design との差分を分解に織り込む（2026-09-18・02-agent-detection tasks）

- **背景**: 分解の `対象` を特定するため、herdr のソース（`da6bcd5`。01 の T14 で取得済みの手元の clone。Apache-2.0・D5）の
  判定まわりの位置と規模を確かめた（深い読解は coding の T1＝U1 で行う）。その結果、design.md の記述だけでは
  herdr と同じ精度にならない点が 3 つ見つかった。
  1. **状態の反映にヒステリシスがある**（`src/pane/agent_detection.rs`）: working → 素の idle への遷移は、
     3 回の確認（`AGENT_PENDING_IDLE_CONFIRMATIONS`）か 700ms（`AGENT_PENDING_IDLE_CAP`）まで保留し、その間は
     100ms 間隔で再確認する。ルールの `visible_idle`・`visible_blocker` が立っていれば保留せず即座に反映する。
     design の「判定結果をそのまま反映」では、working と idle が画面の一瞬の揺れで往復し、そのたびに
     `completionSeq` が増えて**偽の done** が出る。
  2. **エージェントの特定は前面プロセス 1 つではなく前面ジョブ（前面プロセスグループの全プロセス）で行う**
     （`src/detect/mod.rs` の `identify_agent_in_job`）: まずグループリーダーを見て、だめなら全プロセスを優先度つきで走査する。
     `npx`・`npm exec`・node のラッパー・Windows の `cmd`/`powershell` 経由の起動を拾うため。
  3. **実行ファイル名 → エージェントの対応は herdr に実装がある**（`normalized_process_name`・既知のパッケージのパス・
     ランタイム（node/bun/python）の引数の解釈・`agent_label`）。design は「自前の対応表。パッケージのパスは未確認（推測）」
     としていたが、推測で作らず herdr の実装を移植できる。
  そのほか: エンジンは使用中の 11 種に加えて未使用の region（`bottom_lines(N)`・`above_prompt_box`・
  `current_prompt_block_marker`・`after_current_prompt_block_marker`）も持ち、`min_engine_version` は最大 3。
  `src/detect/manifest/tests.rs` に画面の fixture を使ったテストが 57 件ある。
- **決定（tasks での見立て。T1 で確定させ、外れたら tasks を分解し直す）**:
  - `AgentTracker` に herdr と同じ反映の判断（保留・`visible_*` による即時反映）を入れる。そのため
    `ManifestEngine.evaluate` の戻り値に `visibleIdle`・`visibleBlocker`・`visibleWorking` を足す（architecture の
    シグネチャの拡張）。
  - `ProcessInspector` に `foregroundJob(shellPid)` を**追加**する（01 の既存の `foreground`・`isBusy` は変えない。
    01 との境界の約束「ProcessInspector を 02 も使う」の範囲での追加）。`ProcessMatcher.match` はジョブを受け取る。
  - `ProcessMatcher` と表示名・別名の表は herdr から移植する。`verified` は design のとおり claude・codex だけ true。
  - エンジンは version 3 を名乗り、herdr のエンジンが持つ全 region を実装する（未使用の 4 種も。将来のルール更新に備える）。
  - herdr から移植したコード・テストには、ファイルの冒頭に出所と変更した旨を書き、NOTICE と
    `third_party/herdr/README.md` に追記する（Apache-2.0 の条件。D5）。
- **範囲への影響**: なし（作るモジュールと担当の AC は親の tasks の割れ目のまま。細部の精度を herdr に合わせるだけ）。
  ただし `ProcessInspector` の interface の追加は 01 の成果物に手を入れるので、review で重点的に見る。

## D46: T1（U1）— herdr の判定エンジン・前面ジョブの意味論を確定（2026-09-18・02-agent-detection T1）

herdr のソース（`da6bcd5`。Apache-2.0・D5。このセッションでは `/tmp/.../scratchpad/herdr` に都度 clone し直す
——scratchpad はセッションをまたいで残らない）を直読して、D45 の見立てを確定・修正した。以下は `packages/server/src/agent/*`
実装時の正典として扱う（`対象` の細部はここを見る）。

### region の切り出し（`[herdr]src/detect/manifest.rs` の `region()` とその先の各関数）

- OSC 系（`osc_title`・`osc_progress`）は画面ではなく専用のフィールドから取る。
- `whole_recent`：画面そのまま。
- `after_last_prompt_marker`／`before_current_prompt_marker`／`whole_recent_without_current_prompt_marker`／
  `current_prompt_block_marker`／`after_current_prompt_block_marker`：**codex 専用**。「現在のプロンプト行」＝
  最後の `›`（または `› ` で始まる）行のうち、その後ろに `•`/`■`/`✗`/`✓` で始まる行（ブロックの印）が
  1 つも無いもの。無ければ「現在のプロンプト行」は無し。
- `prompt_box_body`／`above_prompt_box`／`last_non_empty_above_prompt_box`：**claude 専用**。「プロンプトの箱」の上端＝
  末尾から数えて **2 本目**の水平線（`─` が3個以上、または1〜2個+以降が空白のみの行）。箱の本体＝その次の行から、
  その下の最初の水平線（無ければ末尾）まで。
- `after_last_horizontal_rule`：末尾から見て最後の水平線より後ろ全部。
- `bottom_lines(N)`／`bottom_non_empty_lines(N)`／`top_non_empty_lines(N)`：件数指定。
  **`top_non_empty_lines` だけ `min_engine_version >= 3` が要る**（herdr の `TOP_NON_EMPTY_LINES_ENGINE_VERSION`）。
  ほかの region は `min_engine_version` を見ない。
- 未対応の region 名は空文字列を返す（herdr は `_ => ""`）。**ManifestStore の検証ではこれを許さず、
  未知の region はロード時に弾く**（design の「読めないファイルは無効にする」をルール単位に厳格化する。T3 で決定）。

### gate（`contains`／`regex`／`line_regex`／`all`／`any`／`not`）の評価（`compiled_gate_matches`）

- `contains`：**全部**（AND）が、小文字化した region テキストに部分一致すること（`contains` 側も小文字化して比較。大小文字を無視）。
- `regex`：**全部**（AND）が region テキストのどこかに一致すること（`RegExp.test`。`^`/`$` は式に `(?m)` が無ければ全体の先頭/末尾のみ）。
- `line_regex`：**各パターンが**、region テキストの行の**どれか1行に**一致すること（パターン間は AND、行の中では OR）。
- `all`：ネストした gate が**全部** true（空なら常に true）。
- `any`：ネストした gate が**1 つ以上** true（**空なら判定しない**＝制約として働かない。空 any は必ず通る）。
- `not`：ネストした gate が **1 つでも** true なら、この gate は false（何一つ一致してはいけない）。
- 上記を全部満たして初めて gate は true。**1 つの gate に複数の観点（`contains`＋`regex`等）を同時に書けば、それらは AND で
  効く**（design にこの粒度の説明は無かった。T4 で `evaluateGate` を素直にこの手順で書く）。

### ルールの選択（`evaluate_loaded_manifest`）

- ルールは **toml に書かれた順に全件評価する**（`priority`順に並べ替えて先頭一致で止める、ではない）。
- 一致したルールの中から `priority` が**最大**のものを採る。**同点は最初に出会った方（toml の先頭に近い方）を残す**
  （`if previous.priority >= rule.priority` で上書きしない）。design の「priorityの高い順に評価」はこの「全件評価して
  最大を選ぶ・同点は先勝ち」という意味だった（tasks の想定どおり要確認扱いにしてよかった）。
- 1 つも一致しなければ：**既知のエージェントなら idle**（`DEFAULT_KNOWN_AGENT_IDLE_FALLBACK`）、**未知のエージェント
  （ManifestStore に無い kind）なら unknown**。design の「どのルールにも一致しなければ idle」は「既知のエージェント」限定
  だった（`kind` が `unknown` のケースの既定は idle ではなく unknown。T4/T7 で反映する）。
- `visible_idle`/`visible_blocker`/`visible_working` は、**一致したルール自身のフラグ**かつ**そのルールの `state` が
  対応する状態と一致するとき**だけ true（例：`visible_blocker` は一致ルールが `visible_blocker=true` かつ `state="blocked"`
  のときだけ true）。design はこの出力を `ManifestEngine.evaluate` の戻り値に持っていなかったので、D45 のとおり
  戻り値へ追加する（T4）。

### ManifestStore の検証（`validate_manifest`。T3 で移植）

- ルール数 1〜128。`id` は空文字不可。`region` は既知の名前（件数指定 region は数値部分も検査）。
- `skip_state_update=true` のルールは **`state="unknown"` を明示していて、かつ `visible_*` が全部 false**でなければならない
  （design には「`skip_state_update` の間は状態を更新しない」としか無かった。この制約も検証に含める）。
- gate の入れ子は深さ 8 まで、gate 総数 512 まで、1 gate あたりの matcher（contains+regex+line_regex）は 32 まで、
  matcher 総数 1024 まで、matcher 1 件の長さは 512 文字まで。
- **すべての gate は「肯定の matcher」（contains/regex/line_regex/all/anyのいずれか非空）を持たねばならない**（`not` だけの
  gate は無効）。`not` に渡す gate は「何らかの matcher」を持たねばならない（空の not は無効）。
- 正規表現は全部コンパイルできること。
- 1 つのファイルの中でこの検証に落ちたら、**そのエージェントだけ無効にする**（design のとおり）。

### 反映のヒステリシス（`[herdr]src/pane/agent_detection.rs`。T7 で移植）

D45 で見つけた 3 回/700ms の保留に加えて、**もう1つ herdr にある仕組みを見つけた**（design には無い）：

- **エージェントを新規に見つけた瞬間は、3 秒間まったく判定しない**（`AGENT_STARTUP_GRACE_WINDOW`）。
  その間は状態を `unknown` のまま据え置く（design の「判定中という中間状態は持たない」は守れる——`unknown` は
  `AgentState` に既にある値であって、新しい状態を増やすわけではない）。3 秒経ってから最初の判定を行う。
  **理由（推測）**：起動直後の画面（スプラッシュ等）で誤判定するのを防ぐため。
- **決定**：本製品でも採用する。`instanceId` を振った直後の `pane.agent_status_changed` は `state: 'unknown'` で送り、
  3 秒間は `ManifestEngine.evaluate` を呼ばない。design の記述と文言上は違って見えるが、状態の種類を増やさないという
  本質は守っている。反対の判断（3秒を待たず即座に判定する。design の文言に厳密に従う）を採る場合は、この D46 を
  訂正して理由を残すこと。
- working→idle の保留（3 回の確認 or 700ms）は D45 のとおり。ただし herdr は 100ms 間隔で再確認しており、
  `AgentMonitor` の通常周期（500ms/1秒）のままでは 3 回に達する前に 700ms の上限へ先に当たる（tasks.md のリスク欄で
  指摘済み）。T9 で、保留中の pane だけ 100ms 間隔にする。

### 前面ジョブの取得（`[herdr]src/platform/linux.rs`・`windows.rs`）

- Linux：tpgid の取得は既存の `LinuxProcessInspector.foreground` と同じ（`/proc/<pid>/stat` の8番目）。
  herdr はそこから**前面プロセスグループの全メンバー**を集める（`process_group_id` と一致する `pgrp` を持つ
  プロセスを、**シェル自身の子孫と、プロセスグループリーダーの子孫の双方を起点にした、予算付きの幅優先探索**
  （`/proc/<pid>/task/<tid>/children`）で集める。`/proc` 全体は走査しない）。
  **決定（簡略化）**：本製品は**シェル自身の子孫だけを起点にした、件数上限つきの幅優先探索**にする
  （もう1つの起点＝プロセスグループリーダーからの探索は省く）。プロセスグループリーダーがシェルの子孫でない
  珍しいケース（別プロセスに再親化された等）は前面ジョブを見落としうるが、pane のシェルが自分の子として
  起動する通常の使い方では十分。herdr 相当の完全な挙動が要ると分かったら、この決定を訂正して両起点に広げる。
- Windows：既存の `WindowsProcessInspector` の「シェルの子孫を辿り、最も深い経路を選ぶ」は herdr と同じ考え方
  （`deepestNode`）。`foregroundJob` は「シェルから対象までの経路上の全プロセス」を返すよう拡張する（D45 のとおり）。

### プロセス名 → エージェントの対応表（`[herdr]src/detect/mod.rs`。T6 で移植）

- `lookup_agent`：22 種の別名表（`claude`/`claude-code`、`cursor`/`cursor-agent` 等）。**この表をそのまま TypeScript へ
  移植する**（design の「自前の推測」は不要になった）。`muse-bin-<数字…>` の特別扱いも含む。
- `normalized_process_name`：実際に使う「候補名」の決め方。①実行ファイル名が汎用ランタイム/シェル名
  （node/bun/python*/sh/bash/zsh/fish/cmd/powershell/pwsh/tmux）なら、引数からラップされたエージェント名を
  取ろうとする（`wrapped_agent_name_from_runtime_argv`：node の `cursor-agent` バンドル検出、
  `-e`/`-c`/`/c`/`-Command` 等のスクリプト引数越しの実行、Windows の `cmd`/`powershell` の入れ子コマンド解析）。
  ②それで取れなければ実行ファイル名自体で判定。③node/bun 越しに qwen/cline/letta を見つける特別扱い。
  ④argv[0] やコマンドラインの先頭語からの判定。⑤最後は実効名をそのまま返す。
  既知のパッケージパス（pi・kimi・qwen・mastracode・letta の node_modules 配下）の対応表も移植する。
- `identify_agent_in_job`：まずプロセスグループリーダー自身を見る（Letta だけ「対話的か」の追加判定がある）。
  だめなら全プロセスを **優先度**（実効名が生の名前と違う＝3、生の名前が一致し汎用ランタイムでない＝2、
  汎用ランタイム/シェル名のまま＝1）でスコアリングし、**同点は先に見つかった方を残す**（`>=` ではなく採用側の
  比較が `>` 相当）。
- 手元の実物の `claude`（2.1.276）・`codex` の cmdline を fixture に加える（T6 のテスト方針どおり）。

### 未使用のまま残す herdr の仕組み（今回は移植しない。理由つき）

- リモートの判定ルール自動更新（`manifest_update.rs`）：D34/D5 のとおり無改変・固定版で取り込む方針なので不要。
- hooks 連携（`hook_authority`。`terminal/state.rs`）：design 済みの範囲外（Claude Code/Codex は画面判定のみを使う。
  F4.3）。将来の外部操作 API の work で扱う候補。
- `Agent::Omp`・`Agent::Mastracode`：画面マニフェストを持たない（`SCREEN_MANIFEST_AGENTS` に含まれない）。
  本製品の `third_party/herdr/agent-detection/` にも対応する toml が無い（22 種で一致）ので、対象外のままでよい。

### `stabilize_agent_detection`（`terminal/state.rs`）

このバージョンの herdr では実質何もしない（`detection.state` をそのまま返すだけ）。追加のロジックは無い。

## D47: T2（U2）— Rust 正規表現 → JavaScript RegExp の変換規則を確定（2026-09-18・02-agent-detection T2）

`third_party/herdr/agent-detection/*.toml`（22 ファイル。index.toml を除く）に実際に書かれている
`regex`/`line_regex` を smol-toml で全部抜き出し（gate の入れ子＝`all`/`any`/`not` の中も含めて）実測したところ、
**103 件**あった。使われている構文の範囲は限定的で、以下の変換規則で全件が `new RegExp` に通ることを
`regexConvert.test.ts`（tasks.md T2 のテスト方針どおり）で確認した。

- **`\x{HHHH}`（可変長 1〜6 桁）→ `\u{HHHH}`**。`u` フラグを常に立てる（`\p{…}` も使うため）。
- **固定 4 桁の `\uHHHH`（波括弧無し）はそのまま素通しする**。Rust の `regex` クレートでも JS でも同じ意味
  （単一の UTF-16 コード単位）なので変換不要。実測した 103 件の中に `\x{…}` 形と `\uHHHH` 形の両方が混在していた
  （例: `claude.toml` は `\x{2800}`、`antigravity.toml` は `⠀`）。
- **先頭の `(?i)`／`(?m)`／`(?s)`（またはその組み合わせ）を外部フラグへ移す**。実測した 22＋4＋3 件は全て式の
  先頭にしか現れなかった（式の途中に現れる例は0件）。途中に現れたら変換できない扱いにする
  （JS には式の一部だけへ効かせる同等の構文が標準では無い。ES2025 の modifier group `(?i:...)` は使っていない
  ——herdr 側が使っていないので対応不要）。
- **`\A`（ヘイスタックの絶対先頭）→ `(?<![^])`**、**`\z`（絶対末尾）→ `(?![^])`**（「直前/直後に何も無い」の
  否定後読み/先読み）。Rust の `\A`/`\z` は `(?m)` を立てても行境界には反応しない絶対指定だが、JS の `^`/`$` は
  `m` フラグで行境界に変わってしまうため、単純に `^`/`$` へ置き換えると意味が変わる。**`codex.toml` の
  `weak_blocker`／`screen_working_fallback` は `(?m)` と `\z` を同じ式に同居させており、これを確かめて
  初めて気づいた**（`regexConvert.test.ts` に固有のテストを残した）。
- 未対応（今回は 0 件）：名前付きグループ・POSIX 文字クラス・先読み/後読み（Rust の `regex` クレートは
  そもそもバックトラックが無く、これらを元から持たない）。
- **既知の限界（受け入れる）**：JS の `\d`/`\w`/`\b` は常に ASCII 基準（`u` フラグを立てても変わらない）だが、
  Rust の `regex` クレートは既定で Unicode 対応（`\d`/`\w` が非 ASCII の数字・単語文字にも一致しうる）。
  実測した 103 件はいずれも ASCII の文脈（`esc`・`yes`・数字の件数等）でしか `\d`/`\w`/`\b` を使っておらず、
  実害は無いと判断した（tasks.md の「代表的な文字列で Rust と同じ結果になること」の範囲では十分）。
  将来のルール更新で非 ASCII 文字に `\d`/`\w`/`\b` を使う式が追加されたら、この判断を見直す。
- **決定**：この変換規則を `packages/server/src/agent/regexConvert.ts` の `convertRustRegex()` として実装した。
  変換できない式は例外を投げず `{ ok: false, reason }` を返す（呼び出し側＝T3 の `ManifestStore` が、
  そのルールだけを無効にする）。

## D48: T5 — Linux の `foregroundJob` は `/proc` 全体走査にした（D46 の「簡略化」は実は必須だった）（2026-09-18・02-agent-detection T5）

- **背景**: D46 では「herdr は `/proc/<pid>/task/<tid>/children` を使った起点2つの探索をするが、
  本製品はシェルの子孫だけを起点にした単純な探索にする」という**簡略化**として書いた。
  実装にあたりこのセッションの環境（WSL2）で実測したところ、**`/proc/<pid>/task/<tid>/children`
  自体が存在しなかった**（`cat /proc/self/task/$$/children` → ENOENT。カーネル 6.6.87.2-microsoft-standard-WSL2）。
  この機能は `CONFIG_PROC_CHILDREN` に依存し、WSL2 のカーネルでは有効になっていない。
  WSL2 は本製品の必須対象 OS（requirements）なので、herdr と同じ方式には**そもそも頼れない**
  （「簡略化」ではなく「必須の代替」だった）。
- **決定**: `/proc` 配下の数値ディレクトリを全て走査し、各 `/proc/<pid>/stat` の `pgrp`
  （")" の後ろの3番目のフィールド）が対象の tpgid と一致するものを集める方式にした
  （`LinuxProcessInspector.foregroundJob`）。子孫の探索を一切しないので、シェルの子孫かどうかに
  依存せず、WSL2 を含めどの Linux 環境でも動く。
- **理由・代替案**: 代替の「シェルの子孫だけを `ppid` を辿って集める」（`/proc` 全体は読まない）も
  検討したが、`/proc/<pid>/status` 等から `ppid` を集めるにも結局 `/proc` を広く読む必要があり、
  複雑さの割に速度上の優位が小さいと判断した。実測（T5 のテスト。実物の bash でパイプラインを作り、
  `foregroundJob` が両方のプロセスを拾えることを確認済み）では十分高速だった。
- **影響**: `AgentMonitor`（T9）が pane ごとに毎周期これを呼ぶと `/proc` 走査がパネル数に比例して
  繰り返されるので、T9 で 16 pane の 1 周期の所要時間を測るときに重点的に見ること（AC17）。
  遅ければ、1周期に1回だけ `/proc` を走査してプロセス一覧を使い回す形に変える余地がある。

## D49: T6 — `ProcessMatcher`/`agents.ts` の移植で意図的に省いた herdr の挙動（2026-09-18・02-agent-detection T6）

herdr の `identify_agent_in_job`・`normalized_process_name`・`lookup_agent` 一式（`da6bcd5:src/detect/mod.rs`。
Apache-2.0・D5）を移植した（`packages/server/src/agent/{agents,ProcessMatcher}.ts`）。以下は意図的に省いた:

- **`resolved_agent_name_from_path_token`**（トークンをファイルシステムで正規化し、シンボリックリンクの先の
  basename で再判定する）：`ProcessMatcher` は純関数の対応表（architecture.md）なので、ファイル I/O を持ち込まない。
  実害の見積り：このマシンで実際に `claude`・`codex` を起動して `/proc` から cmdline を採取したところ
  （T6 のコーディング時に実測。`node -e` でポーリング）、どちらも `comm`/`argv[0]` が直接 `"claude"`／`"codex"`
  で、basename 一致だけで識別できた（symlink 解決が要らないケース）。この省略が実際に効いてくるのは、
  basename からもパッケージパスからも判定できない**エイリアスされた実行ファイル名**（稀）に限られる。
- **Letta 専用の「対話的な起動か」の追加判定**（`is_interactive_letta_process`。誤検出の抑制が目的）：
  他のエージェントと同じ扱いにした。MVP の検証対象（claude・codex）には無関係。
- **`cmdline_argv0_agent_name`**：herdr は `ForegroundProcess.cmdline`（生の1本の文字列）を別に持つが、
  本製品の `ForegroundProcess` は `argv: string[]` しか持たない（`argv.join(" ")` の先頭語は
  `argv[0]` と同じになるため、`argv0AgentName` と重複する）。省略して `argv0AgentName` だけにした。
- **`Agent::Omp`・`Agent::Mastracode`**：D46 のとおり対象外（画面マニフェストが無い）。
- **`process_priority` の「実際の名前と違うか」の比較先**：herdr は `ForegroundProcess.name`（素の comm）と
  比較するが、本製品の `ForegroundProcess` には `exe`（`argv[0]` があればそれ、無ければ comm）しか無い。
  `exe` 自身の basename と比較する形に読み替えた（`normalized_process_name` が返す候補と、
  そのプロセス自身の素の名前が違うかどうか、という判定の意図は保たれている）。
- **確認**: `packages/server/src/agent/ProcessMatcher.test.ts` に、herdr の `identify_agent_in_job_*` 系
  テストの移植（node 越しの codex/qwen、cline のネイティブ/ラップ起動）と、実物の claude・codex の
  cmdline を使ったテストを含めて51件、全て通ることを確認した。

## D50: T7 — `AgentTracker` で省いた herdr の仕組み（安定 blocked の周期的な再発行）（2026-09-18・02-agent-detection T7）

- **背景**: herdr の `should_publish_detection_update`（`[herdr]src/pane/agent_detection.rs`）は、
  `visible_blocker` が2周期連続で true のとき、800ms（`STABLE_VISIBLE_SIGNAL_REFRESH`）ごとに
  **状態が変わっていなくても** `pane.agent_status_changed` 相当の発行を促す仕組みを持つ
  （T7 のコーディング中に読んで見つけた。D46 には無かった）。
- **決定**: 移植しない。理由：本製品の `AgentInfo.since`（「状態が変わった時刻」）は実際に状態が
  変わったときだけ更新する設計にしており、この周期的な再発行を足しても `since` は変わらない
  （herdr 側でこの再発行が何に使われているかはソースからは断定できなかった——UIの再描画のトリガ等、
  本製品の設計には無い前提に依存している可能性がある）。状態そのものの反映（保留・3秒の起動猶予）は
  忠実に移植済み。
- **影響**: `AgentTracker.shouldPublish` は `state`/`visibleIdle`/`visibleBlocker`/`visibleWorking` の
  変化だけを見る。将来、サイドバーで「blocked のまま何分経過したか」のような表示が要ると分かったら、
  この決定を見直す（03-web-desktop の設計時に検討）。

## D51: T9 — `AgentTracker.needsFastRecheck` が猶予明けの境界の心拍で誤って false を返す（`AgentMonitor.test.ts` のテストで発覚）（2026-09-18・02-agent-detection T9）

- **背景**: `AgentMonitor.test.ts` の「working→素の idle」テストで、3秒の起動猶予を抜けた直後に
  pane の状態が `working` に反映されない不具合が出た（`vitest` の偽時計固有の問題を最初疑い、
  `vi.useFakeTimers({ loopLimit: … })` を試すなど回り道をしたが、`tick()` 自体は毎回（35/35）
  正しく発火しており、偽時計側の問題ではなかった）。
- **原因**: `AgentTracker.needsFastRecheck()`（旧実装）は `startupGraceUntil !== null && now < startupGraceUntil`
  という**時刻比較**で「猶予中か」を判定していた。猶予がちょうど明ける心拍（`now === startupGraceUntil`）では
  これが `false` を返すため、`AgentMonitor.maybeJudge` の間隔選択が `FAST_RECHECK_INTERVAL_MS`（100ms）から
  `ACTIVE_INTERVAL_MS`（500ms）/`IDLE_INTERVAL_MS`（1000ms）に落ち、**猶予明けを実際に処理する（`unknown`→
  実際の状態へ遷移させる）はずのその回の判定自体が、次の間隔が経つまで後回しになっていた**。
  `AgentTracker.update()` 側の猶予終了判定はもともと `now < startupGraceUntil`（同じ境界）で正しく「明けた」
  と判断できていたのに、`needsFastRecheck()` 側だけ1心拍分ずれていた（対称性の欠落）。
  これは `vitest` の偽時計の不具合ではなく、**実際の本番タイマーでも起きる実装のバグ**だった
  （HEARTBEAT_MS=100 が STARTUP_GRACE_MS=3000 を割り切るため、テストでは境界が毎回きっちり一致し、
  症状が安定して再現していた）。
- **決定**: `needsFastRecheck()` を `this.pendingIdle !== null || this.startupGraceUntil !== null`
  （非 null だけを見る。時刻比較をしない）に直した。`startupGraceUntil` は `update()` の中で、猶予明けの
  判定をその回に行った**後**でだけ null に戻るので、猶予明けを処理するその回の心拍は必ず fast recheck の
  対象になる。`isInStartupGrace`（旧・private メソッド）は削除した。
- **影響**: `packages/server/src/agent/AgentTracker.ts`。`AgentMonitor.test.ts` の6件全てが安定して通るようになった
  （5回連続実行で確認）。working→idle の保留（`pendingIdle`）側は元々 `!== null` だけを見ていたので対称に直った形。

## D52: T9 — 16 pane での `AgentMonitor` 1周期の所要時間を実測（AC17）（2026-09-18・02-agent-detection T9）

- **背景**: tasks.md のリスク欄「Linux は `/proc/*/stat` の走査（pane の数 × プロセス数）が周期ごとに走るので、
  1周期の所要時間を測って記録する」（AC17）。design.md は「判定そのものは数ms（推測）」としていたが未検証だった。
- **計測**: `evidence/agent-monitor-cycle.mjs`（新規）。実物の PTY 16 個（`/bin/bash` 対話起動）＋実物の
  `LinuxProcessInspector.foregroundJob`（D48 の `/proc` 全体走査フォールバック）＋実物の `claude.toml` マニフェストで、
  `AgentMonitor.tick()` と同じ形（16 pane 分を `Promise.all` で並行に `foregroundJob` → `evaluate`）を3周連続で測った。
  結果は `evidence/README.md`「AgentMonitor の1周期の所要時間」に記録（2回の実行：1周目 198.91/209.33ms、
  2周目 118.54/135.74ms、3周目 110.69/114.58ms。計測時のシステムの総プロセス数は56）。
- **決定**: **「数ms」という design.md の推測は誤りだった**と記録する（実際は16 pane 並行で 110〜210ms/周、
  安定後で110〜135ms/周）。ただし `requirements.md` の非機能要件「状態反映：2秒以内」には十分収まっており
  （1周期が仮に210msでも判定間隔500ms/1000msに対して無視できる比率）、**design.md・実装の変更は不要**と判断した。
  支配的なコストは pane ごとに独立して `/proc` を丸ごと読み直す `scanProcessGroupMembers`（D48）——
  システム全体のプロセス数 × pane 数に比例するため、プロセス数の多い実機（今回の計測機は56と少ない部類）では
  さらに伸びる可能性がある。
- **将来の最適化候補（今回は実施しない。スコープ外）**: `AgentMonitor.tick()` は元々1回の心拍で全 pane を
  順に見ているので、`/proc` の読み取り自体を pane ごとではなく**心拍1回につき1回**にまとめて
  （`readdir("/proc")` と各 pid の `stat` を1回だけ読み、`pgrp` ごとにグルーピングしたものを各 pane が引く）
  高速化できる余地がある。2秒の非機能要件に抵触していない現時点では過剰実装と判断し、行わない。
  pane 数が増える／プロセス数が多い環境での劣化が実際に問題になったら、この決定を見直す。

## D53: T10 — `composeServer` への組み込み方（2026-09-18・02-agent-detection T10）

- **判定ルールのディレクトリ解決**: `webDistDirFor()`（既存）と同じ形で `manifestDirFor()` を追加した
  （`packages/server/dist/composeServer.js` から見て `../../../third_party/herdr/agent-detection`。
  `webDistDirFor` より1段深い——`third_party` はリポジトリ直下で `packages/` の外にあるため）。
  成果物を配る際は `third_party/herdr`（ライセンス表示ごと）も同梱する前提（D5・D34）。
- **`ProcessInspector` の共有**: `composeServer` は元々 `pickProcessInspector()` の戻り値を
  `DefaultTerminalManager` のコンストラクタへ直接渡していた（変数に取らない書き方）。`AgentMonitor` にも
  同じインスタンスを渡す必要があるので、`processInspector` という変数に一度受けてから両方へ渡す形に変えた
  （実装への影響はこの1点のみ。プロセス検出の実装自体は変えていない）。
- **`ManifestStore` を `ComposedServer` に公開**: tasks.md の「smoke.ts で判定ルールの読み込みが全件成功して
  いることを確かめる」を満たすため、`ComposedServer` に `manifestStore: ManifestStore` を追加した
  （`session`/`gitPoller`/`persist` と同じ扱い）。`smoke.ts` は `summaries()` を見て、1件でも `ok:false` なら
  `FAIL` にする（個々の失敗自体は `ManifestStore.loadAll` が既に `logger.warn` で出しているので、ここでは
  起動時の要約ログ（`logger.info("agent manifests loaded", {ok, total})`）を1行足しただけ）。
- **結合テストでの偽エージェントの作り方**（`composeServer.integration.test.ts`）: 実物の `claude` 実行ファイルは
  無いので、一時ディレクトリに `claude` という名前の実行可能な bash スクリプト（claude.toml の
  `live_turn_working` ルールに当たる1行を出力してから `sleep 30` で居座る）を作り、そのディレクトリを
  `process.env.PATH` の先頭に足してから `composeServer(...)` を呼んだ（`TerminalManager.create` は
  明示の `env` が無ければ `process.env` をそのまま使うので、以降に spawn される pane のシェルが新しい
  PATH を継承する）。`:` 区切りの PATH 前置は POSIX 限定なので、このテストは `it.skipIf(process.platform === "win32")`
  にした（Windows での前面プロセス判定は T5 の `WindowsProcessInspector` の単体テスト（fake のプロセスツリー）
  で別途確認済み。tasks.md「Windows ネイティブ：単体テストは Linux で回す」の方針どおり）。
- **確認**: `composeServer.integration.test.ts` に7件目として追加し、既存6件と合わせて全て通ることを確認した。
  `pnpm run smoke`（ビルド後）でも `agent manifests ok (22/22)` を含めて `PASS` することを確認した。

## D54: T11 — herdr から移植したコード・テストの帰属表示（2026-09-18・02-agent-detection T11）

- **背景**: `third_party/herdr/agent-detection/*.toml`（データ）の無改変取り込みは 01-server-core の時点で
  `NOTICE`・`third_party/herdr/README.md` に既に記録済み（D5・D34）。02-agent-detection では、herdr の
  **Rust の実装（判定エンジン・前面プロセス識別・状態遷移のヒステリシス）を TypeScript へ移植**した
  （T3・T4・T6・T7）。データだけでなくコードの移植にも Apache-2.0 4(b)（変更したファイルである旨の告知）が
  掛かるので、その帰属表示を別途行う必要があった。
- **確認**: T3・T4・T6・T7 で作った実装ファイル（`ManifestStore.ts`・`ManifestEngine.ts`・`ProcessMatcher.ts`・
  `agents.ts`・`AgentTracker.ts`・`regexConvert.ts`）は、コーディング時点で既に冒頭コメントに herdr の
  出所（`da6bcd5` のパス）・Apache-2.0・decisions.md の参照を書いていた（D46・D47・D49・D50 参照）ので、
  この工程での追加変更は不要だった。
- **決定**: 抜けていたのはテストファイル側——herdr の Rust テストケース（fixture・期待値）を移植した
  `ManifestEngine.test.ts`・`ProcessMatcher.test.ts`・`AgentTracker.test.ts` の3ファイルには、
  移植元の herdr 側の関数名が各 `describe` の見出しにはあったが、ファイル冒頭の出所表示（commit hash・
  Apache-2.0・「書き直している」旨）が無かった。この3ファイルへ冒頭コメントを追加した。
  ルートの `NOTICE` と `third_party/herdr/README.md` に、上記の「実装（Rust）を TypeScript へ移植した」旨と
  対応表（本製品のファイル ↔ herdr 側のパス）を追記した（`ManifestStore.test.ts` は herdr の Rust テストを
  移植したものではなく、実物の toml ファイルを読む自前のテストなので対象外）。
- **影響**: `NOTICE`・`third_party/herdr/README.md`・`ManifestEngine.test.ts`・`ProcessMatcher.test.ts`・
  `AgentTracker.test.ts`（コメントのみの変更。テストの内容・結果は変えていない。109件全て変わらず通ることを確認）。

## D55: 03-web-desktop の tasks で herdr のソースを先読みし、design との差分を分解に織り込む（2026-09-18・03-web-desktop tasks）

- **背景**: 親 tasks は herdr の挙動の確認（D19・D21・D23）を 03 の最初のタスクに置いている。02 の D45 と同じく、分解の
  記述を正しくするため、tasks の段階で herdr のソース（`da6bcd5`。手元の clone。Apache-2.0・D5）の UI まわりを先読みした
  （委譲した調査＋主要 3 点は主エージェントが直読で確認：`src/client/shell/input.rs:576-605`・`src/app/api/panes.rs:711-716`・
  `src/client/shell/actions.rs:106-125`）。herdr の対話 UI は `src/client/shell/` にある（`src/app/` ではない）。
- **見立て（T1 で確定させ、外れたら tasks を直す）**:
  1. **prefix の時間切れ（D21）**: herdr には時間切れが無い。prefix 中にもう一度 prefix で `Ctrl+B` そのものを送り、Esc で取り消し、
     割り当てのあるキーは実行して元のモードへ（copy モード中の pane なら copy へ戻る）、割り当ての無いキーは取り消して捨てる。
     → **requirements の AC-I1 が「Esc か一定時間の経過で解除」を求めているので、3 秒の時間切れは維持する**（herdr との意図的な差。
     05 の対応表に載せる）。それ以外の prefix の振る舞いは herdr に合わせる。
  2. **閉じる前の確認（D23）**: herdr が確認するのは workspace を閉じるときだけ（`ui.confirm_close` の既定 true）。busy の pane・tab の
     確認は無い。→ **requirements の AC-I2 が「実行中のプロセスがある pane / tab / workspace を閉じる操作は確認を挟む」を求めて
     いるので、busy の確認は維持する**（意図的な差。05 の対応表に載せる）。workspace は常に確認する（herdr と同じ）。
  3. **resize モード（D23）**: `h/j/k/l` と矢印で、1 回ごとに分割の比率を **0.05** 動かす（design の 2% は誤り）。Esc・Enter・`r` で抜け、
     それ以外のキーは無視する。→ herdr に合わせる（比率の上下限はサーバ（01）の 0.05〜0.95 のまま。herdr は 0.1〜0.9）。
  4. **navigate モード**: `↑/↓` で workspace の選択を動かし（デスクトップは端で反対へ回る）、Enter で決定して抜ける。Esc・prefix で
     取り消し。`1-9` で workspace を切り替えて抜ける。`h/j/k/l`・`←/→`・Tab・Shift+Tab は pane のフォーカスを動かし navigate に留まる。
     prefix の割り当てが prefix 無しで効き（workspace の操作は選択中の workspace が対象）、実行後に抜ける。→ herdr に合わせる。
  5. **copy モード**: design の一覧に加え `0 ^ $`・Home/End・`g/G`。Esc はまず選択・検索を消し、無ければ抜ける。選択が無い `y` は
     現在の検索の一致をコピーする。copy モード中も prefix が効く。copy モードは pane に属し、その pane に戻ると再開する。
     → herdr に合わせる（architecture の `CopyCommand` 型に単位を足す。型の拡張）。
  6. **集約（D19）と done**: 順は blocked ＞ done ＞ working ＞ idle ＞ unknown で **design と同じ**（workspace は全 pane の最大。
     pane → tab → workspace と段を踏んでも最大は同じ）。done はクライアントごとで、**pane が描画されていて、かつウィンドウに
     フォーカスがあるとき**に既読になる（design は `visibilityState == 'visible'`）。→ 既読の条件は herdr に合わせる。
     初期値（design：記録が無ければ `serverSeenSeq`）は design のまま（herdr は接続時に全部を既読とみなす。差は小さい）。
  7. **goto（`prefix+g`）**: 一覧ではなく workspace → tab → pane の木（herdr はその上に machine）。`/` で文字の絞り込み（名前・
     ブランチ・cwd）、`b/w/i/d` で状態の絞り込み・`a` で解除、Space で開閉、`j/k`・`ctrl+d/u` で移動、Enter で移動、Esc は検索を
     抜けてから閉じる。→ herdr に合わせる（design の combobox＋listbox を改める）。
  8. **ヘルプ**: 群（全体・移動・workspace / tab・pane）ごとの一覧。`/` で絞り込み（キーと名前の部分一致・大小無視）、絞り込み中の
     Esc は絞り込みを抜ける、それ以外は Esc・Enter・`?` で閉じる、`j/k`・PgUp/PgDn・Home/End でスクロール。→ herdr に合わせる。
  9. **サイドバー**: 「spaces」と「agents」の 2 区画。space の行は［状態の印・名前］と［ブランチ・↑N ↓M］、agent の行は
     ［状態の印・workspace・tab］と［エージェント名］。tab バーには状態の印を出さない（拡大中だけ「Z」）。herdr に「未検証」の印は
     無い。→ 行の内容は herdr に合わせる。「未検証」の印は design の判断として残す（意図的な差）。
  10. **右クリックのメニュー**: pane＝名前の変更・名前の消去（名前があるときだけ）・フォーカス中の pane と入れ替え・右へ分割・
      下へ分割・拡大・「右クリックを pane に送る / herdr のメニューを使う」・閉じる。tab＝新規・名前の変更・閉じる。
      workspace＝名前の変更・閉じる（worktree の項目は後続「グルーピング」）。→ herdr に合わせ、Web 固有の「貼り付け」を pane の
      メニューに足す（端末の貼り付けを持たないブラウザのため。design のまま）。
  11. **マウスの追加**: tab バーの上のホイールで前 / 次の tab、pane の上のホイールはまず pane にフォーカスする、サイドバーの幅の
      ドラッグとダブルクリックでの戻し。research F3（M1〜M11）に無い操作がある。→ T1 で F3 と突き合わせ、MVP に入れるか
      後続にするかを決める（AC14 は「MVP 範囲の機能に対応するもの」）。
  12. **名前の入力**: 新しい tab は名前を尋ね、tab の数＋1 を入力済みにする。空または変更なしで確定したら名前を送らない。
      新しい workspace は尋ねない。→ herdr に合わせる。なお herdr の名前の無い tab は位置で番号が振り直されるが、本製品のサーバ（01）は
      作成時に番号を名前として固定する（`SessionModel.reserveTab`）。差は小さいので 01 は変えず、05 の対応表に載せる。
  - 既定キー表（design「既定のキー」の MVP の行と後続の行）は herdr の既定と**一致**した（`src/config/model.rs:1082-1146`）。
  - pane の巡回はレイアウト木の深さ優先・端で反対へ回る（design と同じ）。
- **範囲への影響**: なし（作る部品と担当の AC は親 tasks の割れ目のまま）。細部を herdr に合わせるだけ。requirements と食い違う
  2 点（prefix の時間切れ・busy の確認）は requirements を優先し、意図的な差として 05 の対応表（AC15）に載せる。

## D56: T1 — herdr の UI 挙動（D55）を引用付きで検証し、11 点を訂正（2026-09-18・03-web-desktop T1）

- **検証方法**: D55 の 12 項目＋既定キー・pane 巡回の 2 点を、herdr のソース（`da6bcd5`）に対して `path:line` 引用付きで
  独立に検証させた（一部はさらに3系統へ委譲し、うち2件の重要な主張——クライアント側の既読の条件・新規 tab の名前の
  事前入力——を再度別経路で確かめさせて一致を確認）。以下は「見立て（D55）→ 確定（本決定）」の差分のみを記す
  （見立てのまま確定したものは省く。全文の引用は検証の記録を参照）。
- **確定 1（prefix。D55-1）**: 見立てのとおり確定。追加：サーバ側でキー割り当てが変わると、prefix/navigate/resize は
  強制的に terminal へ戻る（`src/client/shell/state.rs:1361-1367`）。
- **訂正 2（閉じる前の確認。D55-2）**: 「workspace を閉じるときだけ」に加え、**worktree グループの一部である workspace の
  最後の tab／最後の pane を閉じるときも、サーバが `confirmation_required` を返しクライアントが確認を出す**
  （`src/app/api/tabs.rs:235-241`・`panes.rs:1862-1870`）。**本製品はグルーピング機構自体が対象外**（D6・後続 work）
  なので、この経路は実装しない（コードには影響しない。T17 の記述はそのままでよい）。
- **訂正 3（resize。D55-3）**: 比率 0.05・上限 0.1〜0.9・`Esc`/`Enter`/`r` で抜けるのは確定。**方向の意味論を訂正**：
  「フォーカス中の pane を広げる」ではなく「**キーの方向にある最寄りの境界を動かす**（無ければ反対側にフォールバック）」
  （`src/layout.rs:281-305`）。例：右側の pane で `l` を押すと、右に境界が無ければ左の境界が動き、その pane は**縮む**。
  **本製品はレイアウト木が二分木**（`LayoutNode`。00-server-core で確定済み）で herdr と構造が異なるため、この意味論を
  そのまま移植できるとは限らない——**T7 でどちらの意味論を採るか決め、decisions.md に理由を残す**（二分木では
  「フォーカス中の分割ノードの ratio を動かす」の方が単純で、二分木の下では両者が一致するケースが多いと見込まれるが、
  ネストした分割では herdr の「最寄りの境界」と食い違いうる。実装しながら確かめる）。また `Ctrl+L` 等、修飾キー付きでも
  同じキーコードなら反応する（herdr は `key.code` だけを見る）。本製品は modifier を見るかどうかも T7 で決める。
- **訂正 4（navigate。D55-4）**: **`Tab`/`Shift+Tab` は navigate モードに留まらず、実行後に抜ける**
  （`preserve_navigate: false`。design の想定と逆）。`h/j/k/l`・`←/→` だけが navigate に留まる。`1-9` は
  `switch_workspace` という空既定の割り当てとは別の、ハードコードされた直接処理。追加：`↑/↓` は全オンライン
  エンドポイント（本製品は 1 ホスト固定なので該当なし。対象外のまま）をまたぐ。→ **T7 を訂正**：Tab/Shift+Tab は
  cyclePane と同じ「実行して抜ける」扱いにする。
- **訂正 5（copy モード。D55-5）**: キー一覧に `w b e W B E`・`{ }`・`Ctrl+B/F`（ページ）・`Ctrl+U/D`（半ページ）・
  `PgUp/PgDn`・`V`（行選択）・`q`（抜ける）・`n/N`（検索の繰り返し）・`/`・`?` を追加（D55 の一覧は `0 ^ $`・Home/End・
  `g/G` しか追加していなかったが、実際はほぼ全項目が抜けていた——**design の元の一覧はほぼ正しく、D55 が過小に
  書いていた**）。追加の事実：**copy モードは同時に 1 pane しか持てない**（別の pane で入れると前のものは破棄される）。
  → **T8 を訂正**：キー一覧を design の元の記述＋`0 ^ $`・Home/End・`g/G` に戻す（D55 の「design の一覧に4つ足す」は
  正しかった。T1 の指摘は「D55 のまとめ方が過小だった」であって design 自体は概ね正しかった）。同時に 1 pane だけと
  いう制約は `KeyRouter`（モードは pane をまたいだ 1 つの状態機械）ではなく `CopyTarget`／`TerminalRegistry` 側の
  責務なので T9 に反映する。
- **訂正 6（集約・既読。D55-6）**: 優先順位は確定。**集約は tab の段を経由しない**（workspace は全 pane の直接の
  max。design の pane→tab→workspace の「段階」は実装上の話で、**結果としては同じ値になる**——tab の状態も
  「その tab の pane の max」なので、workspace の「全 pane の max」と「各 tab の max の max」は数学的に同値。
  実装をどちらで書いてもよいが、**tab 単体の状態（サイドバーの tab の行）は要らないなら計算しなくてよい**、
  というだけの違い。design のサイドバーは tab の行に状態を出さないので、workspace は直接全 pane から集約してよい）。
  **既読の条件を訂正**：「pane が表示中の tab にありページが見えている」ではなく「**pane が描画された表示の中に
  含まれていて、ウィンドウのフォーカスが失われたと分かっていない**（不明なら“フォーカスあり”扱い）」。
  加えて、**herdr にはクライアントごとの既読とは別に、サーバ側・セッション全体で共有される既読もある**
  （tab/workspace の切替や `pane.focus` で進む）。**本製品は design のとおりクライアントごとの既読だけにする**
  （サーバ側の共有既読は、複数クライアントが同じ完了を別々に確認できる herdr の設計と一部矛盾しており、
  design の「done はクライアントごと」（US2 該当）のほうが要件に合う。意図的な差として 05 の対応表に載せる）。
  → **T15 を訂正**：既読を進める条件を「pane が表示中（`document.visibilityState` ではなく、pane が破棄されず
  表示に含まれていること）かつ `document.hasFocus()` が false と分かっていない（true または未確認）」にする。
- **訂正 7（goto。D55-7）**: machine の段は herdr がホスト 2 台以上のときだけ（本製品は 1 ホスト固定なので**常に
  無い**。T1 で判断済みの内容と一致）。`G` が最後へ（`g` ではない）、Home/End もある。フィルタの対象に tab の名前も
  含む。`Backspace` は文字絞り込みだけでなく状態フィルタも消す。**最初から全展開**（design の「絞り込みなしで木」は
  正しいが、D55 の「最初から展開」は確定）。`Esc` は検索を外すが**絞り込みの内容は残る**（消えるのは D55 の誤り）。
  → **T24 を訂正**：`g` ではなく `G`、Home/End を追加、`Esc` は入力欄からフォーカスを外すだけで検索条件は保持。
- **訂正 8（ヘルプ。D55-8）**: 群は「全体・移動・workspace / tab・pane」に加え、割り当てがあるときだけ出る
  「custom」群がある（本製品はカスタムキーバインドが対象外＝後続 work なので、**custom 群は本製品では常に空＝
  出さない**）。絞り込み中の `Esc` は絞り込みを消して離れる（抜けない）、`Enter` は絞り込み中でも閉じる、
  `j/k`・PgUp/PgDn・Home/End は絞り込み中は効かない。→ **T24 を訂正**：絞り込み中の `Esc`/`Enter`/スクロールキーの
  扱いを上記に合わせる。
- **訂正 9（サイドバー。D55-9）**: `prefix+b` は単純な 2 値の切替（`sidebar_collapsed`）で、見た目は既定で
  compact（幅 4。hidden は幅 0 の設定）。エージェントの行の既定トークンに「マシン」が入る（本製品は 1 ホスト固定
  なのでマシン名は意味を持たない。**表示しないか、常に固定のホスト名を出すかは T1 の続き＝T21 の実装時に決める**）。
  → **T1 の折り込みは完了**（残りは実装判断として T21 に残す）。「未検証」の印は design の意図的な追加として維持。
- **訂正 10（右クリックのメニュー。D55-10）**: pane・tab のメニューは確定。**workspace のメニューは 4 パターン**
  （非 git／git／worktree の子／子を持つ）——**本製品は git worktree のグルーピングが対象外**（D6）なので、
  常に「非 git」パターン（名前の変更・閉じる）でよい。「フォーカス中の pane と入れ替え」は、フォーカス中の pane が
  自分以外のときだけ出す。→ **T18/T22 を訂正**：workspace のメニューは「名前の変更・閉じる」の 2 項目に固定。
  「フォーカス中の pane と入れ替え」に条件を付ける。
- **確定 11（マウス。D55-11）**: 一覧はほぼ確定。**トリプルクリックは無い**（ダブルクリックのみ）。分割の境界の
  ドラッグに「ダブルクリックで戻す」は無い（サイドバーの幅の境界にだけある。design のマウス表 M2 にダブルクリック
  復元の記述は無いので影響なし）。追加：tab バーのホイールで前後の tab、サイドバーの幅のドラッグ＋ダブルクリックで
  既定幅へ戻す、サイドバーの各行のドラッグでの並べ替え（本製品はサイドバーの並べ替えを提供しない。D6 の後続扱い。
  対象外）。→ **T21・T22 を訂正**：research F3 に無いが採るもの（サイドバー幅のドラッグとダブルクリックでの復元＝
  T21・`components/Sidebar`、tab バーのホイールでの前後の tab＝T22・`components/TabBar`）を追加。並べ替えは対象外のまま。
- **確定 12（名前の入力。D55-12）**: 訂正なし（`prompt_new_workspace_name` が設定可能という点は本製品の対象外
  ——設定画面自体が後続 work なので、design の既定値（尋ねない）のまま固定でよい）。
- **既定キー（追記）**: `remote_image_paste = ctrl+v` という prefix 無しの直接キーが herdr にある
  （画像を pane へ貼り付ける機能。本製品は画像の貼り付けに対応しない——design のクリップボードはテキストのみ
  （AC5・M4・M6 はテキストとリンクだけ）。**対象外として 05 の対応表に載せる**。追加のタスクは無い）。
- **pane 巡回（追記）**: 2 つの経路がある（`prefix+tab` はその tab の pane 全体・navigate モードの Tab は表示中の
  pane surface）。**本製品は「レイアウト木の深さ優先」の 1 経路しか無い**（表示範囲＝保持している pane という概念
  はあるが＝LRU＝D28、巡回対象はレイアウト木全体で変わらない）ので、区別は不要。
- **範囲への影響**: T7・T8・T9・T15・T17・T18・T21・T22・T24 の記述をこの決定に沿って直す（コードはまだ無いので
  タスクの記述を直すだけ。すでに実装したタスクがあれば差分を出す必要があるが、この時点ではまだ T2 までしか
  終えていない）。範囲（作る部品・担当の AC）そのものは変えない。

## D57: T2 — `vitest.workspace.ts`（`defineWorkspace`）が vitest 5 系で機能しない（`test.projects` へ置き換え）（2026-09-18・03-web-desktop T2）

- **背景**: T2 で `packages/web/vitest.config.ts` に `environment: "happy-dom"` を設定したが、ルートから
  `pnpm test`（`vitest run`。ルートの `vitest.workspace.ts` 経由）で実行すると `document is not defined` になった。
  `packages/web` だけで直接 `vitest run` すると通る。
- **原因の確認**: `node_modules` 内の vitest 5.0.1 の型定義・実装のどちらにも `defineWorkspace`／`workspace` 関連の
  コードが存在しない（`grep` で 0 件）。実測で、ルートに `test.projects: ["packages/*"]` を持つ `vitest.config.ts` を
  置くと `packages/web` の `vitest.config.ts`（`environment: "happy-dom"`）が正しく適用されることを確認した
  （`typeof document` が `"object"` になる）。**`vitest.workspace.ts`（`defineWorkspace`）は vitest 5 系で黙って
  無視され、全 project が既定の node 環境にフォールバックする**（01-server-core が `vitest.workspace.ts` を作った
  当時のドキュメント・慣習に基づいていたが、現在インストールされている vitest 5.0.1 では既に削除された API だった。
  `packages/protocol`・`packages/server` は node 環境のままでよいテストしか無かったため、この session まで
  症状が表面化しなかった）。
- **決定**: ルートの `vitest.workspace.ts` を削除し、`vitest.config.ts`（`test: { projects: ["packages/*"] }`）に
  置き換える。各パッケージの `vitest.config.ts`（`packages/web` 等）はそのまま `projects` の各エントリとして読まれる。
- **確認**: 置き換え後、`pnpm -s test` で 40 ファイル・357 件（旧 356 件＋`document` を使う xterm smoke テストの
  1 件が新たに通るようになった分）が全て通ることを確認した。
- **影響**: `packages/protocol`・`packages/server` の既存テストの実行結果は変わらない（node 環境のまま）。
  `.aidev/config.yml` 等の変更は不要（`aidev smoke`／CI はいずれも `pnpm test`／`vitest run` を経由するだけで、
  `vitest.workspace.ts` の存在を直接前提にしていない）。

## D58: T3 — `Connection` の close 二重処理バグと、`vi.waitFor`×偽の時計の相互作用（2026-09-18・03-web-desktop T3）

- **背景（実装上のバグ）**: `net/Connection`（`ConnectionPort` の実装）の `openSocket()` は、接続直後の
  `client.hello` が失敗したら `ws.close()` を呼んで通常の close 処理（再接続の判断）に合流させる設計だった。
  しかし `handleClose()` は close のたびに保留中の要求（`client.hello` を含む）を reject するため、この
  reject を受けた `.catch(() => ws.close())` が**既に閉じた直後の同じ socket に対してもう一度 `close()` を
  呼んでしまう**——実物の `WebSocket` は close 済みへの `close()` を no-op とする仕様だが、それに暗黙に依存
  していた。close コード `4401`（認証失効）や `client.detach` の直後にこの二重発火が起きると、
  「意図した切断で再接続しない」はずが、２回目の（コード `1000` 等の）close 処理で誤って
  `verifySessionThenScheduleReconnect()` が走り、再接続ループへ入ってしまう不具合があった
  （テストで実際に発生を確認——`FakeWebSocket.close()` を実物と同じ「close 済みなら no-op」に直したうえで、
  `Connection.openSocket()` 側にも `closeHandled` フラグを追加し、1 socket につき `handleClose` を高々 1 回
  しか呼ばないようにした。二重防御——テスト用の実装だけに頼らない）。
- **背景（テストのタイミング）**: 再接続のバックオフ（1〜30 秒の倍々）を偽の時計（`vi.useFakeTimers()`）で
  検証する際、非同期の `/api/session` 確認（マイクロタスク）が終わるのを **`vi.waitFor` で待つと、
  この vitest（5.0.1）では `vi.waitFor` 自身が内部で偽の時計を進めることがあり**、隣接する再接続の
  バックオフタイマーを実際の意図より早く発火させてしまうことを実測で確認した（`vi.waitFor` 無しで
  `vi.advanceTimersByTimeAsync(0)` によるマイクロタスクの掃き出し＋直後の同期的な `expect` に置き換えたところ、
  症状が消え、テストの実行時間も 637ms→21ms に短縮した——待っていたのは実際には不要な待ち時間だった）。
- **決定**: 偽の時計を使うテストでは、非同期チェーンの完了を待つのに `vi.waitFor` を使わず、
  `await vi.advanceTimersByTimeAsync(0)`（時計は進めずマイクロタスクだけ流す）の後に同期の `expect` を書く。
  正確な時刻境界を跨ぐ確認（「まだ早い」「ちょうどで発火する」）は `vi.advanceTimersByTimeAsync(N)` を
  正確な値で呼び、直後は同期的に確認する（タイマーのコールバック自体は同期関数なので、待つ必要が無い）。
  **今後の subtask・タスク（T14 のストア・05-e2e-docs 等）で偽の時計を使うテストを書くときも同じ方針に従う**。
- **決定（再接続テストの設計）**: バックオフの倍々を検証するテストは、**一度も `open()` せずに閉じ続ける**
  （`openSocket()` の `onopen` は `reconnectAttempt` を 0 に戻す設計——これは意図的な挙動で、herdr 同様
  「繋がったら 1 秒からやり直す」——なので、途中で開いてしまうとバックオフの継続が壊れる）。
  「開けたら 1 秒からやり直す」ことは別のテスト（`Connection.test.ts`）で確認済み。
- **影響**: `packages/web/src/net/Connection.ts`（`closeHandled` フラグの追加）・
  `packages/web/src/net/Connection.test.ts`（`FakeWebSocket.close()` の no-op 化、`vi.waitFor` を全廃し
  `flush()` ヘルパへ置き換え、バックオフのテストの構成を修正）。

## D59: T4 — `@xterm/xterm`（クライアント側）の問い合わせへの応答は非同期（マクロタスク）で届く（2026-09-18・03-web-desktop T4）

- **背景**: `QueryFilter` のテストで、`term.write("\x1b[c")`（DA1）の直後に `onData` を同期的に確認すると、
  filter の有無にかかわらず応答が「出ていない」ように見えた（filter が効いているのか、単に応答がまだ届いて
  いないだけなのかを区別できない）。マイクロタスクを 2 回流しても届かず、`setTimeout(resolve, 0)`（マクロ
  タスク）を 1 回挟むと確実に届くことを実測で確認した（`@xterm/xterm` 6.0.0。`write()` 自身のコールバックは
  「入力の反映」を示すだけで、問い合わせへの応答はそれとは別の内部キュー（レンダリングループ寄り）で
  処理されるとみられる。サーバ側の `@xterm/headless` は `write()` のコールバックと同じ経路で同期的に近い
  形で応答を出す＝Mirror.ts の実装はそのままでよい。挙動が違うのはブラウザ側だけ）。
- **決定**: ブラウザ側の xterm.js の問い合わせへの応答（DA1 等）を確認するテストは、`write()` の後に
  マクロタスクを 1 回（`await new Promise(r => setTimeout(r, 0))`）挟んでから確認する。**確認しないテストは、
  握りつぶせていない不具合を「たまたま速く判定したので見えなかった」だけで見逃す**——実際に、`installQueryFilter`
  を書く前段（T2）で作った素朴な確認用テストがこの誤りを含んでいたので直した（`xterm-smoke.test.ts`）。
- **副次的な発見**: これは同時に、**ブラウザ側の `@xterm/xterm` が DA1 に実際に応答する**ことの実証にもなった
  （design.md の U5「ブラウザ側の xterm.js が色の問い合わせに応答するか未確認」と同種の未確認事項。DA1 は
  応答することが分かった。色の問い合わせ（OSC 10/11/12・OSC 4）については `QueryFilter.test.ts` で個別に
  確認済み——filter を付けた場合に応答が出ないことは確認したが、**filter 無しで色の問い合わせが実際に応答
  するかどうか自体は確認していない**。D17 の設計は「握りつぶす」ことが目的なので実害は無い。参考情報として
  残す）。
- **影響**: `packages/web/src/term/QueryFilter.test.ts`（新規）・`packages/web/src/term/xterm-smoke.test.ts`（修正）。

## D60: T5 — `RendererPool` のモバイルの WebGL 上限は design.md（4）ではなく architecture.md（2）を採る（2026-09-18・03-web-desktop T5）

- **背景**: design.md「流量制御」は「WebGL は表示中の pane に最大 12 個（モバイルは 4 個）」、architecture.md の
  `term/RendererPool` の行は「表示中の最大 12・モバイル 2」——モバイルの数値が食い違う。architecture.md の
  冒頭は D28・D30 の 2 点だけを「この文書を正とする」と明記しており、この項目は該当しない（見落としによる
  不整合の可能性が高い）。
- **決定**: architecture.md の値（モバイル 2）を採る。**理由**: D28 の最終決定（architecture.md「D28 の結果」）で
  `TerminalRegistry` の LRU 容量自体がモバイル 2 pane（表示中＋直前）に確定している——保持している pane が
  最大 2 個しか無いのに WebGL の上限を 4 にする意味が無く、design.md の「4」は D28 改訂前の値が取り残された
  ものと判断できる。`RendererPool` の容量は `TerminalRegistry`（T12）が渡す値に一致させ、デスクトップ 12・
  モバイル 2 を既定にする（`RendererPoolOptions.capacity` として外から渡す設計はそのまま）。
- **影響**: `packages/web/src/term/RendererPool.ts` 自体の実装は容量を外から受け取るだけなので変更不要
  （この決定は T12/T26 で実際に渡す値に反映する）。design.md の「4」は誤りとして扱う（design.md 自体は
  訂正しない。decisions.md の記録を正とする）。

## D61: T7 — resize モードの境界の意味論は 01-server-core の既存実装のまま維持する（herdr の「最寄りの境界」は採らない）（2026-09-18・03-web-desktop T7）

- **背景**: D56 の訂正 3 で、herdr の resize モードは「キーの方向の最寄りの境界を動かす（無ければ反対側にフォールバック）」
  ことが分かった。一方、01-server-core は既に `LayoutTree.resizeBy`（`packages/server/src/session/LayoutTree.ts:87-99`）を
  実装済みで、**フォーカス中の pane の直接の親 split だけを見る**（祖先を遡らない・フォールバックも無い。軸が
  合わなければ何もしない）という、より単純な意味論になっている（herdr の正確な意味が未確認だった時点の自前の決定）。
- **決定**: **01-server-core の既存の意味論を変えない**。理由：(1) 01 は承認済みで着地済みの成果物であり、
  この subtask（03）の範囲外——変えるなら 01 の coding へ差し戻す規模の変更になる。(2) 既存の意味論は「間違っている」
  のではなく単純化されたもので、実害（クラッシュ・誤動作）は無い——一部のネストしたレイアウトで、herdr なら動く
  キーが本製品では何も起きないことがあるだけ。(3) T7（`ResizeMode`）の責務は「どのキーが押されたか→`resizeBy`
  アクション」の変換だけで、境界をどう探すかはサーバ側（`SessionService.resizePaneByDirection`→`LayoutTree.resizeBy`）
  の責務であり、この subtask の担当領域の外。
- **影響**: `ResizeMode` は h/j/k/l・矢印→`{type:'resizeBy', dir, amount:0.05}` を送るだけの単純な実装でよい。
  herdr との差（ネストしたレイアウトでの境界の探し方）は 05 の対応表（AC15）に「意図的な簡略化」として載せる。

## D62: T7 — `NavigateMode` は 1〜9 の直接切替と「prefix 無しで効く割り当て」を実装しない（architecture の `Action` 型の範囲に留める）（2026-09-18・03-web-desktop T7）

- **背景**: D56 の訂正 4 で、herdr の navigate モードには `1-9` での workspace の直接切替と、prefix の割り当てが
  prefix 無しで（`Tab`/`Shift+Tab` を除き）効いて実行後に抜ける、という 2 つの追加の挙動があることが分かった。
  一方、architecture.md の `Action` 型の `navigate` は `op: 'up' | 'down' | 'paneDir' | 'activate' | 'cancel'` の
  5 種類しか無く、workspace の直接切替や他のアクションの実行を表現する形が無い。
- **決定**: **architecture.md で既に確定している `Action` の形を変えない**。`NavigateMode` は上記 5 種類の
  op だけを実装する（`↑/↓`→up/down、`h/j/k/l`・`←/→`→paneDir、Enter→activate＋抜ける、Esc→cancel＋抜ける）。
  `1-9` と「prefix の割り当てが prefix 無しで効く」は**この work では実装しない**（意図的な簡略化）。
- **理由**: (1) `Action` 型は `keys/KeyRouter.ts` の型として architecture で既に定義済みで、他のタスク（`ActionDispatcher`
  等）もこれを前提にしている——ここで型を広げると影響範囲が読み切れない。(2) 「prefix 無しで他の全アクションが
  効く」は、`NavigateMode` が `keymap` 全体への参照を持つ必要が生まれ、「Vue にも DOM にも依存しない・
  副作用を持たない」という設計判断（architecture「設計判断」の該当行）とは矛盾しないが、`SubModeInterpreter`
  の责務を大きく広げることになり、この 1 タスクの範囲を超える。
- **影響**: `NavigateMode.test.ts` に、上記 2 点を**やっていないことの確認**は書かない（無いことのテストは
  網羅的にはできないため）。05 の対応表（AC15）に「navigate モードの 1-9 直接切替・prefix 無しでの他操作は
  未実装（意図的な簡略化）」として載せる。

## D63: T8 — `CopyMode` のキー一覧は design.md の原文どおりに実装する（`0 ^ $`・Home/End・`g/G`・`ctrl+b` は見送り）（2026-09-18・03-web-desktop T8）

- **背景**: D55（tasks 段階の見立て）は copy モードのキー一覧に `0 ^ $`・Home/End・`g/G` を追加候補として挙げたが、
  D56（T1 の検証）はこの 3 点を再確認も否定もせず、別の観点（design.md の原文が実は正しかったこと・`Ctrl+B/F` の
  ペア・単一 pane 制約）だけを確定させた。未確認のまま実装すると、確かめていない前提の上に機能を積むことになる。
- **決定**: この work では **design.md の原文の一覧のまま**実装する：移動 `h/j/k/l`・`w/b/e`・`W/B/E`・`{`/`}`・
  `PageUp`/`PageDown`・`ctrl+f`・`ctrl+u`/`ctrl+d`、検索 `/`・`?`・`n`/`N`、選択 `v`・Space・`V`、コピー `y`・`Enter`、
  抜ける `q`・`Esc`。`0`・`^`・`$`・Home・End・`g`・`G` は追加しない（未確認のまま。05 の対応表に「未確認のまま
  見送った候補」として残す）。
- **`ctrl+b` も追加しない**：`KeyRouter`（T6）は `ctrl+b` を prefix の判定として最優先で処理し、`copy` モードの
  `SubModeInterpreter` へは委譲しない（D56 の「copy モード中も prefix が効く」と一致する実装）。したがって
  `CopyMode` 側に `ctrl+b`（ページ戻る）を割り当てても実行されない——死んだキーを実装しない。
- **`Esc`（`clearOrExit`）は KeyRouter に `exit: true` を返さない**：`Esc` は「選択・検索が有れば消す／無ければ抜ける」の
  2 択で、どちらかは xterm.js 側の状態（`CopyTarget`）を見ないと分からない。`CopyMode.handle()` は
  `{action: {type:'copy', cmd:{op:'clearOrExit'}}}` を返すだけにとどめ、実際に抜けるかどうかの判断とモード遷移
  （`KeyRouter.setMode('terminal')`）は `ActionDispatcher`（T18）が `CopyTarget.apply(cmd)` の戻り値
  （`exited: boolean`）を見てから行う。`q`・`y`・`Enter` は常に抜けるので `exit: true` をその場で返してよい。
- **影響**: T9（`CopyTarget`）は `clearOrExit` を受けたら「選択・検索があれば消す。無ければ `exited: true`」を
  返す実装にする。T18（`ActionDispatcher`）は `copy` アクションの結果が `exited: true` のときだけ
  `KeyInputController.setMode('terminal')` を呼ぶ。

## D64: T9 — `CopyTarget` の単語/WORD/段落の移動は行をまたがない・段落は空行そのものを境界にする（2026-09-18・03-web-desktop T9）

- **背景**: herdr の copy モードの単語・段落の移動が、実際に画面をまたいでどこまで探索するか（複数行にわたる
  単語の折り返しの扱い等）はソースを深追いしておらず未確認。xterm.js の `IBuffer.getLine()` は 1 行ずつしか
  取れないため、複数行にまたがる探索は実装コストが上がる。
- **決定**: `word`/`WORD`/`wordEnd`/`WORDEnd` の移動は**現在行の中だけ**を探す。見つからなければ隣の行の
  先頭（前方）/末尾（後方）へ移るだけで、その行の中身までは探索し続けない（vim・tmux の完全な語の探索より
  単純）。`paragraph` は vim の `{`/`}` と同じく、**空行そのものを境界として止まる**（空行を飛び越えて次の
  非空行までは進まない）。`selectStart` 後の移動は vim の visual モードと同じ規約（移動先の 1 文字を含めて
  選択する。テストで実際の xterm.js の選択・yank の結果から確認した——最初の想定「移動先の直前で止まる」は
  誤りで、実物で確かめて訂正した）。
- **影響**: `packages/web/src/term/CopyTarget.ts`。05 の対応表（AC15）に「単語/WORD の移動が行をまたがない」を
  意図的な簡略化として載せる。

## D65: T11 — M5（ダブルクリックで単語を選択）は実物のブラウザで確認済み。自前の補完は不要（2026-09-18・03-web-desktop T11）

- **背景**: design.md の M5 は「xterm.js がダブルクリックで単語を選択することは未確認。無ければ `select()` API で
  補う」としていた。happy-dom にはレイアウト（`getBoundingClientRect` 等）が無く、テスト環境では確認できない。
- **確認方法**: `packages/web` を実際に `vite dev` で起動し、Playwright の実物の Chromium で `@xterm/xterm` を
  マウントしたページを開き、`page.mouse.dblclick()` で本物のダブルクリックを行った。「hello world」の
  「world」の上でダブルクリックすると `term.hasSelection() === true`・`term.getSelection() === 'world'` に
  なることを確認した（この session 内で実施。確認用のファイルは削除済み）。
- **決定**: `@xterm/xterm` 6.0.0 の既定の挙動のままでよい。`select()` API を使った自前の補完は実装しない。
- **影響**: `MouseBridge`（T11）はダブルクリックの処理を持たない（xterm.js 自身に任せる）。

## D66: T12 — `TerminalRegistry` のコンストラクタは architecture の型と実装を分けた（`MouseBridge` はファクトリ・`QueryFilter` は直接呼ぶ）（2026-09-18・03-web-desktop T12）

- **背景**: architecture.md の `TerminalRegistry` のコンストラクタの型は
  `(capacity, conn, renderers, keys, mouse: MouseBridge, queries: QueryFilter)` と、単一のインスタンスを
  注入する形で書かれている。しかし T11 で作った `MouseBridge` は pane ごとの `term`・`paneId`・
  `rightClick` の設定を持って構築する設計にした（1 インスタンス＝1 pane）。`QueryFilter`（T4）は
  状態を持たない関数 `installQueryFilter(term)` として作った（クラスではない）。
- **決定**: `TerminalRegistry` は `MouseBridge` を**pane ごとに作るファクトリ**
  （`createMouseBridge: (term, paneId) => MouseBridge`）として受け取り、`QueryFilter` は注入せず
  `installQueryFilter(term)` をそのまま呼ぶ。`capacity`・`conn`・`renderers`・`keys`（`KeyInputController`。
  こちらは pane をまたいで共有する 1 つの状態機械なので architecture のとおり単一インスタンス）は
  architecture のとおり。
- **理由**: architecture.md のインターフェース節は「構造を決めるための sketch」（同文書の位置づけの記述）で、
  下位のタスク（T4・T11）の実際の設計判断（状態を持つかどうか）を反映して調整してよい。`MouseBridge` を
  無理に単一インスタンス化すると、pane ごとの右クリック設定を外から都度渡す必要が生じ、責務が濁る。
- **影響**: `packages/web/src/term/TerminalRegistry.ts`。T26（Web の `main.ts`）で `createMouseBridge` の
  ファクトリを組み立てる（`ui`・`getRightClickTarget` をクロージャで渡す）。

## D67: T14 — `StoreAdapter` の認証・接続状態は `store/view`（T16）へ直接依存せず、注入したコールバックへ委ねる（2026-09-18・03-web-desktop T14）

- **背景**: `StoreAdapter`（`StorePort` の実装）は `onAuthRequired`/`onConnectionState` も持つが、これらは
  意味的には `store/view`（このクライアントの表示・接続状態。T16）の関心事。しかし tasks の依存順序は
  T14（`store/session`・`StoreAdapter`）→ T16（`store/view`）で、T14 の時点で `store/view` はまだ無い。
- **決定**: `StoreAdapter` は `onAuthRequired`/`onConnectionState`（と `pane.exited`/`client.error` という
  トースト向けの2つのイベントも）を**注入したコールバック**として受け取る（`store/session` の直接のメソッドは
  呼ばない）。T26（Web の `main.ts`）で、これらのコールバックを実際の `store/view` のメソッドに bind する。
- **影響**: `packages/web/src/store/StoreAdapter.ts`。T16 の `store/view` 実装時、これらのコールバックが
  想定どおりの形（引数・戻り値）で呼べることを確認する。

## D68: T17 — `newWorkspace` は名前を尋ねずに直接作る（`newTab` とは違う。D56 訂正 12 の見落としの訂正）（2026-09-18・03-web-desktop T17）

- **背景**: 実装しながら design.md を読み直すと、「新規 workspace の作成（`prefix+shift+n`）は名前を尋ねない
  （`ui.prompt_new_workspace_name` の既定 false）」と明記されていた（D56 の訂正 12 で herdr の実際の既定値も
  確認済み）。当初 `newWorkspace` を `newTab` と同じダイアログ経由のフローとして実装しかけていたが、
  これは design と食い違う誤りだった。
- **決定**: `newWorkspace` アクションは `workspace.create({})` を**直接**送り、応答（`workspace`・`tab`・`pane`）
  を受けてその workspace/tab へ切り替え、新しい pane へフォーカスする（AC-I4）。ダイアログは開かない。
  `newTab` は design のとおり空欄のダイアログを経由する（`ui.prompt_new_tab_name` の既定 true）。
- **影響**: `store/view.ts` の `DialogContext` から未使用だった `'newWorkspace'` の枝を削除した。
  `packages/web/src/actions/ActionDispatcher.ts`。

## D69: T18 — 「フォーカス中の pane と入れ替え」（右クリックメニュー）はプロトコルの制約で未実装（2026-09-18・03-web-desktop T18）

- **背景**: design のマウス操作 M3・D56 の訂正 10 は、pane の右クリックメニューに「フォーカス中の pane と
  入れ替え」を挙げている（自分以外の pane がフォーカス中のときだけ表示）。実装しようとして、01-server-core の
  `pane.swap` 方式（`PaneSwapParams = {paneId, direction}`）が**方向で決まる隣の pane としか入れ替えられない**
  ことが分かった（`packages/server/src/surface/methods/pane.ts:61-68`）。`LayoutTree.swap(node, paneIdA, paneIdB)`
  という**任意の 2 pane を入れ替える純関数自体は既に存在する**が、WebSocket の方式としては公開されていない。
- **決定**: この work では実装しない（`ActionDispatcher` にメソッドを置かず、対応する処理を持たない）。
  **理由**: (1) 01-server-core は承認済みで着地済み——`pane.swap` に新しい引数の形（`targetPaneId` 等）を足すのは
  01 の protocol・handler・テストに触れる変更で、この subtask（03）の範囲を超える。(2) 他のメニュー項目
  （名前の変更・分割・拡大表示・右クリックの宛先の切替・貼り付け・閉じる）は全て既存の方式で足りており、
  この 1 項目だけが例外。(3) MVP の他の受け入れ基準（AC14「マウス操作」は「MVP範囲の機能に対応するもの」と
  範囲を限定している）を妨げない。
- **影響**: `components/ContextMenu`（T22）は、pane のメニューにこの項目を出さない（意図的な省略）。
  05 の対応表（AC15）に「pane の右クリックメニューの『フォーカス中の pane と入れ替え』は未実装——
  `pane.swap` が方向指定のみのため。任意の 2 pane を入れ替える `LayoutTree.swap` 自体は 01 に実装済み」と
  載せる。後続で必要になれば、01 の `pane.swap` に `targetPaneId` を足す形で対応できる（実装済みの関数を
  公開するだけなので変更は小さい）。

## D70: T19 — Vue コンポーネントへの部品の受け渡しは provide/inject（`injection.ts`）にする（2026-09-18・03-web-desktop T19）

- **背景**: architecture.md はコンポーネント間の依存を型だけで示しており、Vue コンポーネントが
  `ConnectionPort`・`ActionDispatcher`・`TerminalRegistry`・`ViewSync` を実際にどう受け取るかは決めていない
  （`store/*` は Pinia 自身の仕組みで届くが、これらはそうではない）。
- **決定**: `packages/web/src/injection.ts` に型付きの `InjectionKey` を定義し、`main.ts`（T26）が
  `app.provide(...)` する。コンポーネントは `inject(Key)` で受け取る（無ければ例外を投げて早期に気づけるようにする）。
  props でのバケツリレーは、`PaneLayout` の再帰のような「途中の階層が使わない値を下へ流すだけ」の場面でのみ行う
  （`registerLeaf` はこの理由で props 越しに明示的に流す。inject にしないのは、同じ木の中で複数系統
  （zoom 中の単独 pane・通常の再帰）が混在するため、コンポーネントツリーの位置に紐付く provide より
  明示的な props の方が読みやすいと判断した）。
- **影響**: `packages/web/src/injection.ts`（新規）。T20 以降のコンポーネントもこのキーを使う。

## D71: T19 — `PaneLayout` は `TerminalPane`（T20）へ直接依存せず、名前付きスロットで疎結合にする（2026-09-18・03-web-desktop T19）

- **背景**: tasks の依存順序は T19（`PaneLayout`）→ T20（`TerminalPane`）。`PaneLayout` は葉ノードで pane の中身を
  描く必要があるが、`TerminalPane` はまだ存在しない。
- **決定**: 葉ノードの中身を `#pane="{ paneId }"` という名前付きスコープ付きスロットに委ねる。再帰する分割ノードは
  このスロットを子の `PaneLayout` へそのまま転送する（`<template #pane="slotProps">...</template>` を再帰の各段に書く）。
  ルートの使用側（`App.vue`。T26）が `<PaneLayout ...><template #pane="{ paneId }"><TerminalPane :pane-id="paneId" /></template></PaneLayout>`
  の形でスロットの中身を渡す。
- **影響**: `packages/web/src/components/PaneLayout.vue`。テストでは実物の `TerminalPane` の代わりに
  簡単なダミーの要素をスロットへ渡して検証した（`PaneLayout.test.ts`）。

## D72: T20 — `client.hello` の `clientId` がどこにも保存されていなかった（サイズ権限の判定に必要。T3 の見落としを T20 で発見・修正）（2026-09-18・03-web-desktop T20）

- **背景**: `TerminalPane`（T20）はサイズ権限を持たないときサーバのサイズで描く（design「サイズ権限」）必要が
  あり、それには「このクライアントが `Tab.sizeOwnerClientId` と一致するか」を判定できないといけない。
  実装しようとして、`Connection.ts`（T3）が `client.hello` の応答から `snapshot` だけを `StorePort.applySnapshot`
  へ渡し、**`clientId` を渡さずに捨てていた**ことが分かった——自分の `clientId` がどこにも保存されていなかった。
- **決定**: `StorePort.applySnapshot` の型を `(s: SessionSnapshot, clientId: string) => void` に広げ、
  `Connection.ts`・`StoreAdapter.ts`・`store/session.ts` を揃えて直した。`store/session.ts` に `clientId` の
  ref と、`hasSizeAuthority(tabId)`（`tabs.get(tabId)?.sizeOwnerClientId === clientId.value`）を追加した。
- **影響**: `packages/web/src/net/ports.ts`・`Connection.ts`・`store/session.ts`・`store/StoreAdapter.ts` と、
  それぞれのテスト（`clientId` を渡す形に更新。`Connection.test.ts` に `helloClientIds` の確認を追加）。
  既存の 578 件のテストは全て通ったまま（新規 1 件を含め 579 件）。T3・T14 の時点では気づけなかった
  （サイズ権限を実際に使う T20 で初めて必要になった）。

## D73: T22 — `ActionDispatcher` の構造操作・名前変更・閉じるメソッドに「任意の対象」版を追加（右クリックメニューはフォーカス中とは限らない）（2026-09-18・03-web-desktop T22）

- **背景**: `ContextMenu`（T22）は右クリックした pane/tab/workspace を対象に操作する必要があるが、
  T17/T18 で作った `ActionDispatcher` の `split`/`zoom`/`closePane`/`closeTab`/`closeWorkspace`/
  `beginRenamePane`/`beginRenameTab`/`beginRenameWorkspace`（すべて private）は、すべて
  `view.focusedPaneId`/`view.tabId`/`view.workspaceId`（＝表示中・フォーカス中のもの）を対象にする実装に
  なっていた——キーボード操作（prefix 経由）は常にこれらが対象で正しいが、右クリックは**フォーカス中とは
  限らない pane/tab/workspace**を対象にできる必要がある。
- **決定**: 各 private メソッドから「対象の解決」（`view.*` を読む）と「実際の処理」を分離し、後者を
  `splitPane(paneId, dir)`・`zoomPane(paneId)`・`closePaneById(paneId)`・`renamePaneById(paneId)`・
  `newTabInWorkspace(workspaceId)`・`renameTabById(tabId)`・`closeTabById(tabId)`・
  `renameWorkspaceById(workspaceId)`・`closeWorkspaceById(workspaceId)` として public 化した。
  private な `split`/`zoom`/`closePane`/`closeTab`/`closeWorkspace`/`beginRenameXxx` は
  「`view.*` から対象を解決してから public 版を呼ぶ」薄いラッパーに変えた（キーボード経由の既存の挙動は
  変えていない——42 件の既存テストがそのまま通ることを確認済み）。
- **影響**: `packages/web/src/actions/ActionDispatcher.ts`。`ContextMenu.vue`（T22）はこれらの public
  メソッドを直接呼ぶ。フォーカス中の pane と入れ替え（D69）以外の全メニュー項目が、右クリックした対象へ
  正しく作用する。

## D74: T23 — 新規 tab の名前ダイアログは「空欄なら送らない」だけを実装し、「変更なしなら送らない」は簡略化した（2026-09-18・03-web-desktop T23）

- **背景**: design/D55 の 12 は「新規 tab の名前入力は tab の数＋1 を入力済みにし、**空または変更なし**で
  確定したら名前を送らない（herdr はサーバ側の自動採番に任せる）」という仕様。`ActionDispatcher.confirmNewTab`
  （T17/T18 で先に実装済み）は既に `trimmed ? { label: trimmed } : {}` という「空欄なら送らない」判定を持って
  いたが、「プリフィルした値から変更していなければ送らない」判定は無かった。
- **決定**: `NameDialog.vue`（T23）はプリフィルした値をそのまま送信対象として `confirmNewTab` に渡すだけにし、
  「変更なし」の検出（プリフィル値を別途保持して比較する等）は実装しない。空欄のみを「送らない」トリガーとする。
- **理由 / 代替案**: プリフィルの値（tab 数＋1）は、たいていの場合サーバの自動採番結果と一致する
  （tab が削除・並べ替えされていなければ）。ユーザーが変更せずに確定した場合、明示的にその値を送っても
  観測できる tab 名は自動採番と同じになることがほとんどで、差が出るのは「他クライアントの操作で tab 数が
  ずれた後に確定する」ような稀なレースのみ（送った名前が古い連番のままになる）。この程度の稀な不整合のために
  「変更なし」検出用の状態管理を足す複雑さは見合わないと判断した。
- **影響**: `packages/web/src/components/NameDialog.vue`。将来この差が問題になれば、プリフィル時の初期値を
  別 ref に保持し `confirm()` で `value.value === initialLabel.value` を空欄と同様に扱うよう拡張できる
  （`ActionDispatcher.confirmNewTab` 側の変更は不要）。

## D75: T24 準備中の herdr 追加調査で D74 の前提が誤りと判明——「変更なしなら送らない」を実装し直した（2026-09-18・03-web-desktop T23）

- **背景**: D74 は「新規 tab の名前ダイアログは『空欄なら送らない』だけを実装し、『変更なしなら送らない』は
  簡略化する」という判断だったが、T24（HelpDialog/GotoPicker）の下調べで herdr のソースを読み直したところ、
  「変更なしなら送らない」の正確な実装がそのまま見つかった：
  `src/client/shell/overlay_input.rs:963-975`（`ClientRenameTarget::NewTab` の確定処理）——
  `label: (!trimmed.is_empty() && trimmed != default_name).then(|| trimmed.to_owned())`。
  `default_name` はダイアログを開いた時点の `tab 数＋1`（同ファイル 384-396 行）。**空文字列だけでなく、
  プリフィル値のまま変更せず確定した場合も名前を送らない**、という判定が実在した。D74 は「稀な不整合の
  ために複雑さを足す価値がない」という判断だったが、実装コストは（プリフィル時点の値を 1 つ覚えておいて
  比較するだけで）見積もっていたより低く、herdr の一次資料に確認が取れた以上、簡略化する理由が無くなった。
- **決定**: D74 を撤回し、`NameDialog.vue` にプリフィル時点の値（`openedWithValue`）を保持して、
  `newTab` の確定時に `trimmed === openedWithValue.trim()` なら空文字を `confirmNewTab` に渡すよう修正
  （`ActionDispatcher.confirmNewTab` 側の「空なら送らない」判定にそのまま合流させる。
  `ActionDispatcher.ts` 自体の変更は不要）。
- **追加で確認した事実（今回のついでの調査。範囲外だが記録）**:
  - `ClientRenameTarget::NewWorkspace` にも同種の `trimmed != suggested_name` 判定がある
    （`overlay_input.rs:950-951`）が、**本製品の `newWorkspace` は名前を尋ねない**（D68。
    `prompt_new_workspace_name` の既定 false）ため無関係。
  - `ClientRenameTarget::Tab`（既存 tab の rename）は `!(trimmed.is_empty() || auto_name && trimmed ==
    original_name)`（`overlay_input.rs:980`）——**`auto_name`（自動採番のままか＝一度も手動で
    改名されていないか）のときだけ「変更なし」を判定する**。本製品の `Tab` 型
    （`packages/protocol/src/model.ts`）には対応するフラグ（herdr の `custom_label` 相当）が無く、
    プロトコル拡張なしには再現できない。**`confirmRenameTab` はこの「変更なしなら送らない」を実装せず、
    既存どおり「空なら送らない」だけとする**（意図的な簡略化として維持。プロトコルが対象外なので
    D74 のときとは違い、実装コストの見積もり違いではなく本物の制約）。
  - `ClientRenameTarget::Workspace`（既存 workspace の rename）は `!trimmed.is_empty()` のみ
    （`overlay_input.rs:955`）——「変更なし」判定は無い。`confirmRenameWorkspace` は既に整合している。
- **影響**: `packages/web/src/components/NameDialog.vue`（`newTab` の確定処理）。
  `NameDialog.test.ts` に「プリフィルのまま確定すると名前を送らない」テストを追加。

## D76: T24 — HelpDialog/GotoPicker の実装前に herdr のキー配線を直接読んで確定（D55/D56 を上回る精度）（2026-09-18・03-web-desktop T24）

- **背景**: `tasks.md` の T24 の記述（design「ダイアログ」＋ D56 訂正7・8）は群の名前・大まかな Esc/Enter の
  扱いまでは確定していたが、(a) どのキーがどの群に属するか、(b) `?`/`goto` を含む個々のキーの群、(c) Esc/Enter/
  スクロール/状態フィルタの正確な相互作用（特に「絞り込み中」の定義そのもの）までは踏み込んでいなかった。
  実装前に herdr のソース（`da6bcd5`）を直接読んで確定した。
- **確認した一次資料**:
  - `src/input/keybind_help.rs` `keybind_help_groups()`：群は `"global"`・`"navigation"`・
    `"workspaces / tabs"`・`"panes"`（＋ `custom_commands` が空でなければ `"custom"`）。**`swap_pane_*`
    （H/J/K/L 相当）はどの群にも列挙されていない**——herdr 自身のヘルプにも出ない。本製品もこれに倣い
    HelpDialog に出さない。`toggle_sidebar` は `"panes"` 群、`goto`（`session navigator`）は
    `"workspaces / tabs"` 群——直感的な「全体」ではない。`help`/`settings`/`detach`/`reload_config`/
    `open_notification_target` が `"global"`。Tab/Shift+Tab の cyclePane はハードコードされた
    `"navigation"` 群のエントリ（`cycle_pane_next`/`previous` という別の設定可能キーが `"panes"` 群に
    別途あるが、本製品は Tab/Shift+Tab の 1 経路しか無い＝D56 追記「pane 巡回」と整合）。
  - `src/client/shell/overlay_input.rs:628-771`（Navigator＝GotoPicker のキー配線）・`773-873`
    （Help＝HelpDialog のキー配線）：Esc/Enter/`/`/状態フィルタ（b/w/i/d）/`a`/Space/Backspace/
    Home/End・G/Ctrl+d・u/Ctrl+n・p の分岐を実測。**Navigator の Esc（絞り込み中）は `search_focused`
    を false にするだけで `query`/`filter` を一切変更しない**（絞り込みの内容は保持される）。
    **Help の Esc（絞り込み中）は `search_focused=false` に加えて `query.clear()` と `scroll=0` も行う**
    （絞り込みの文字を消す）。この 2 つの Esc の非対称性が最初のうっかりミスの種になりやすい点として、
    両コンポーネントの実装コメントに明記した。
  - `src/client/shell/overlay_input.rs:193-217`（`open_navigator_overlay`）：`expanded_workspaces` は
    開いた時点の全 workspace で初期化される——D56 訂正7「最初から全展開」の直接の裏付け。
  - `src/client/shell/aggregate_navigation.rs:278-422`（`navigator_rows`）：フィルタ中の行の採否は
    「自分が一致 OR 子に一致がある」の再帰（ボトムアップ）。フィルタ中は `expanded_workspaces` を無視して
    子を常に見せる（折りたたんでいても一致すれば展開されて出る）。
- **本製品向けの意図的な単純化**（縮小キー表・存在しないフィールドによる制約）:
  - herdr の "navigation" 群には `1..9: switch workspace`（workspace 番号切替）があるが、本製品の
    navigate モード（T7）にこの操作は無い（`prefix+1..9` は tab 切替）ので HelpDialog には載せない。
  - HelpDialog の「全体」群から herdr の `entry(prefix, "prefix mode")`（prefix キー自身の案内行）は
    省いた——ダイアログ自体が prefix 経由でしか開けないため、開いた後にもう一度 prefix を案内する価値が
    薄いと判断（実装コストの節約ではなく UX 判断）。
  - herdr の Help の絞り込み中は「素の ↑/↓/PageUp/PageDown はスクロールする（Char ではない keycode の
    ため）が、`n`/`p` は Ctrl 付きのみ」という細かい分岐があり、本実装もこれを再現した（ブラウザの
    `<input>` は素の j/k を文字として消費するので、tasks.md の「絞り込み中は j/k 等のスクロールは効かない」
    という記述と、矢印キーは効くという herdr の実際の挙動は両立する——同じキー入力ハンドラで、
    `document.activeElement === 検索欄` のときだけ ArrowUp/Down/PageUp/PageDown を横取りしてスクロール、
    それ以外（j/k を含む）は `<input>` の既定動作に委ねた）。
  - GotoPicker の「外側（背景）クリックで閉じる」は、herdr 側にマウスでの背景クリック相当の記述が
    見当たらなかったため、design.md のダイアログ共通規則（AC-I1）をそのまま適用し、絞り込み中かどうかに
    関わらず常に閉じる（Esc のような分岐は付けない）。NameDialog/ConfirmDialog と同じ扱いに揃えた。
- **影響**: `packages/web/src/components/HelpDialog.vue`・`GotoPicker.vue`（新規）。
  `depthFirstPaneIds`（レイアウト木の深さ優先探索）を `ActionDispatcher.ts` のプライベート関数から
  `packages/web/src/term/layoutOrder.ts` へ切り出し、`ActionDispatcher.ts` と `GotoPicker.vue` の両方から
  使う（3 箇所目の重複を避けるため。T22 までは 1 箇所だけだったので気づかなかった）。

## D77: T26 — composition root（`main.ts`）の循環 port の結線方式（既存の `bind()` に加えて「箱」パターンを採用）（2026-09-18・03-web-desktop T26）

- **背景**: `net/Connection`（`sink: TerminalSinkPort` を要求）と `term/TerminalRegistry`（`conn:
  ConnectionPort` を要求）は互いを要求し合う——どちらを先に作っても他方が無い。同様に
  `TerminalRegistry.createMouseBridge` は `ActionDispatcher`（`UiPort`）を要求するが、`ActionDispatcher`
  自体は `registry`/`keys` を要求するので `TerminalRegistry` より後にしか作れない。
  `KeyInputController.bind()`（T10）は同じ問題を「後から埋めるメソッド」で解決済みだったが、
  `Connection`/`TerminalRegistry`/`ActionDispatcher` にはそのような bind メソッドが無い
  （architecture.md の宣言どおりコンストラクタで受け取る形）。
- **決定**: 対象の型を変えずに、composition root（`main.ts`）側だけで解決する。「後から埋める箱」
  （`{ current?: T }` という最小限のオブジェクト）を経由して、実体が無い間はクロージャで箱を参照する
  ポート実装（`sinkProxy`・`createMouseBridge` 内の `actionDispatcherBox.current!`）を渡す。
  箱の中身は実際に呼ばれる前（＝配線が全て終わった後）に必ず埋まる。
  素の `let x; ...; x = value;` ではなく箱にしたのは、ESLint の `prefer-const` が
  「宣言と代入が離れていても代入が 1 回だけなら `const` にできる」と誤検知するため
  （`registry`/`actionDispatcher` 自体は "箱" 越しではなく直接 `const` で束縛でき、箱は本当に
  前方参照が要る 2 箇所——`sinkProxy` と `createMouseBridge`——だけに限定した）。
- **影響**: `packages/web/src/main.ts`。`Connection.ts`/`TerminalRegistry.ts`/`ActionDispatcher.ts` 自体の
  型・実装は変更していない。

## D78: T26 — HelpDialog/GotoPicker の `display: flex` が `<dialog>` の既定の非表示を上書きしていた（実機の smoke で発見）（2026-09-18・03-web-desktop T26）

- **背景**: `HelpDialog.vue`/`GotoPicker.vue`（T24）の `<style scoped>` は `.help-dialog { ...; display:
  flex; ... }` のように、内部レイアウト用の `display: flex` を **`<dialog>` 要素のクラスへ無条件に**
  指定していた。ネイティブ `<dialog>` は UA スタイルシートで `dialog:not([open]) { display: none }` と
  なっているが、**author（作者）スタイルは origin の優先順位で UA スタイルより常に勝つ**——
  specificity を比較するまでもなく、無条件の `.help-dialog { display: flex }` が `dialog:not([open])`
  を上書きし、**`showModal()` を呼んでいなくても（＝閉じていても）ダイアログが描画され続け、
  クリックを奪う**。
  happy-dom（全単体テストの実行環境）は `<dialog>` の描画規則（UA スタイルシートの適用）を再現しない
  ため、`.open` プロパティだけを見る単体テストではこの不具合を検出できない——T26 で実物の Chromium を
  使う smoke（テスト方針「実地の確認」）を組んで初めて発見した
  （`.xterm-helper-textarea` をクリックしようとしたら `<input class="goto-picker-list">...` の subtree が
  pointer events を奪っている、という Playwright のエラーで気づいた。スクリーンショットで実際に
  HelpDialog の全キー一覧と GotoPicker の検索欄が、閉じているはずなのに画面に出ていることを確認した）。
- **決定**: `display` の宣言を `.help-dialog[open]`/`.goto-picker[open]` に限定する（閉じている間は
  `display` を一切宣言せず、UA の既定 `display: none` に任せる）。`NameDialog.vue`/`ConfirmDialog.vue`
  はそもそも `display` を宣言していないため対象外（実機で個別に確認済み）。
- **影響**: `packages/web/src/components/HelpDialog.vue`・`GotoPicker.vue`。単体テストは変更不要
  （`.open` プロパティの検証は元々正しかった。描画規則の不整合は smoke でしか検出できない種類の不具合
  だったので、再発防止はコードコメントと本記録に残すのみ——同種のミスを繰り返さないよう、
  今後 `<dialog>` に `<style>` を書くときは `display` を必ず `[open]` に限定する、という注意点として）。

## D79: T26 — smoke.ts 自身の WebSocket クライアントに、待っていない間に届いた message を取りこぼすバグがあった（2026-09-18・03-web-desktop T26）

- **背景**: 元の `smoke.ts`（01-server-core/02-agent-detection 由来）の `nextMessage`/`requestResponse`/
  `waitForOutput` は、呼ばれるたびに `ws.once("message", ...)` を新しく張る方式だった。この方式は
  「常に次の呼び出しがすぐ続く」（要求を送ったら即座にその応答を待つ、入力を送ったら即座に出力を待つ）
  という前提の上でしか正しく動かない——**何も待っていない間隔**（`ws.once` を再び張り直すまでの間）に
  届いた message は、どの listener にも拾われずに失われる。
  T26 で「ブラウザを起動して操作する」フェーズ（`checkWebUiRendersAndAcceptsInput`。数秒かかる）を
  `waitForOutput` の呼び出しの**間**に挟んだところ、ブラウザが打った echo の応答がまさにこの空白期間に
  届いて消え、後続の `waitForOutput` が届くはずのない message を待ち続けて毎回タイムアウトした
  （`ws.on("message", ...)` で全メッセージを常時ログする一時的なデバッグを入れて初めて、
  「届いてはいるが、待っている側が誰もいないタイミングで届いている」と判明した）。
- **決定**: `net/Connection.ts`（web 側の本物のクライアント）と同じ設計にする——**接続直後に 1 つだけ
  持続的な `ws.on("message", ...)` ハンドラを張り**、テキスト応答は `id` で pending の Map へ振り分け、
  OUTPUT フレームは pane ごとにバッファへ溜め続ける。`waitForOutput` は「もう届いているか」を
  ポーリングで見るだけにする（新しい listener を張らない）。空白期間があっても取りこぼさない。
- **影響**: `packages/server/src/smoke.ts`（`createSmokeClient` を新設、`nextMessage`/`requestResponse`/
  `waitForOutput` の旧実装を置き換え）。`aidev smoke`（`.aidev/config.yml` の `smokeCommand`）は
  `pnpm -s build && pnpm -s smoke` のまま変更不要。

## D80: T26 — Web UI の smoke 確認に `playwright` を追加（devDependency）。ブラウザ本体は別途 `playwright install chromium` が要る（2026-09-18・03-web-desktop T26）

- **背景**: T26 の受け入れ基準（テスト方針「実地の確認」）は「実物のサーバ＋ビルドした Web UI を
  Playwright の Chromium で開いて一巡を確かめる」ことを要求するが、このリポジトリには
  `playwright`/`playwright-core` の依存が無かった（herdr のクライアント調査で使っていたブラウザは
  マシンのキャッシュ（`~/.cache/ms-playwright/`）に残っていただけの、プロジェクトの依存としては
  存在しない一時的なものだった）。
- **決定**: `packages/server` に `playwright`（devDependency。`smoke.ts` からのみ使う——`bin: wtm` の
  本体には含めない）を追加し、`pnpm exec playwright install chromium` でブラウザ本体を取得した
  （`playwright-core` ではなく `playwright` を選んだ理由：後者はブラウザのダウンロード・バージョン
  整合をコマンド 1 つで管理でき、`executablePath` をハードコードせずに済む——マシン固有のパスに
  依存すると別の環境で smoke が動かなくなる）。
- **影響**: `packages/server/package.json`（`playwright` を追加）。**この environment 以外で `aidev
  smoke` を初めて走らせるときは `pnpm exec playwright install chromium` を先に実行する必要がある**
  （`node_modules` にブラウザ本体は同梱されない。CI/新しい環境向けの申し送り。test-result.md の
  「未検証の穴」に記録する）。

## D81: test 工程の実地の確認で発見——prefix 中の `Shift` 単体 keydown が prefix を誤って抜けさせ、`prefix+Shift+<文字>` が全滅していた（2026-09-18・03-web-desktop test）

- **背景**: T26 コーディング完了後、test 工程の「実地の確認」（tasks.md テスト方針。design「相互作用の
  受け入れ基準」・AC-I3）として、使い捨ての Playwright スクリプトで実物の Chromium から
  ログイン→表示→入力エコー→分割→名前変更→閉じる を一巡させたところ、「分割」までは成功するが
  「名前変更」（`prefix+shift+t`）だけが失敗し続けた。
- **原因**: ブラウザは `Shift+T` の入力で、本命の `T`（`shiftKey:true`）より**必ず先に `Shift` 単体の
  keydown**（`{key:"Shift", shiftKey:true, ctrlKey:false}`）を発火する——これは合成入力（Playwright）
  だけでなく実際のキーボードでも同じ順序で起きる標準的な DOM の挙動。`KeyRouter.handleInPrefix`
  （T6）は「割り当ての無いキーは prefix を抜けて terminal へ戻る」という設計だったため、`comboKey`
  が裸の `"Shift"` を返すこの keydown を「割り当ての無いキー」と誤認して**即座に prefix を抜けてしまい**、
  直後に届く本命の `T` は terminal モードでの素通り（文字入力）として処理されてしまっていた。
  影響範囲は `prefix+Shift+<1文字>` を使う全キー——`P`（renamePane）・`T`（renameTab）・`X`（closeTab）・
  `N`（newWorkspace）・`W`（renameWorkspace）・`D`（closeWorkspace）・`H`/`J`/`K`/`L`（swap）・
  `R`（notYet）。
  単体テスト（`KeyRouter.test.ts`）は `KeyInput` を直接組み立てて `router.handle()` へ渡す形だったため、
  「shift 済みの結果のキー（`"T"` 等）」しか渡しておらず、ブラウザが実際に**先に送る `Shift` 単体の
  keydown** を再現していなかった——実機の Chromium を使う test 工程の「実地の確認」でしか検出できない
  種類の不具合だった（happy-dom の単体テストでは原理的に検出不能）。
- **決定**: `handleInPrefix` の先頭に、修飾キー単体（`Shift`/`Control`/`Alt`/`Meta`/`AltGraph`。
  `KeyboardEvent.key` の標準値）を prefix を維持したまま無視するガードを追加した
  （`MODIFIER_ONLY_KEYS`）。3 秒のタイムアウト timer には触れない（`clearPrefixTimer()` を呼ぶ前に
  return する）——修飾キー単体の到達で残り時間を消費したり延ばしたりしない。
  `CopyMode`/`ResizeMode`/`NavigateMode`（`SubModeInterpreter`）は元々「未対応のキーは `{}`（何もしない）
  を返すだけで、モードを抜ける副作用が無い」設計だったため、**この種の不具合は起きない**ことをコードで
  確認済み（`KeyRouter` の prefix ハンドリングだけが持つ「未対応キー＝モードを抜ける」という特有の設計に
  起因していた）。
- **影響**: `packages/web/src/keys/KeyRouter.ts`（`handleInPrefix` の修正）。`KeyRouter.test.ts` に回帰
  テストを 2 件追加。coding 工程を一度 unapprove して再度 approve し直した（`aidev unapprove coding` →
  修正 → `aidev approve coding`）。test-result.md にラウンド 1（失敗の生出力）・ラウンド 2（修正後の
  成功）の両方を記録。
- **教訓**: 「使い捨てスクリプトでの実地の確認」は tasks.md のテスト方針に既に明記されていたが、
  もし省略していたら、この不具合は 05-e2e-docs まで（あるいはそれ以降まで）発見されなかった可能性が
  高い——単体テストは「実装した関数の入出力」は検証できても、「ブラウザが実際にどの順でイベントを
  発火するか」という前提そのものの誤りは検証できないため。

## D82: review 工程で発見——`view.restoreView` が「前回の tab を復元する」分岐で `focusedPaneId` を設定していなかった（2026-09-18・03-web-desktop review）

- **背景**: T16 で実装した `store/view.ts` の `restoreView` は、`sessionStorage` に前回の tab が残っていて
  まだ存在する場合、`setView(...)` だけ呼んで即座に `return` しており、`focusedPaneId` を一度も設定して
  いなかった。サーバの `focus` を使う側の分岐（前回の tab がもう無い場合）は `focusedPaneId` も設定して
  いたため、この非対称性が見落とされていた。T16 の単体テスト自体も「前回の tab を復元する」ケースで
  `focusedPaneId` を検証しておらず、同じ見落としを引き継いでいた。
  影響：**ページの再読み込み（F5）のたびに**（`sessionStorage` は tab を閉じるまで残る）、workspace/tab は
  正しく復元されるのに、どの pane にもキーボードフォーカスが入らない状態になる——利用者が手でどこかの
  pane をクリックするまで、`prefix` を含む一切のキーボード操作を再開できない。AC-I3（MVP の全操作を
  マウス無しで行える）に反する高頻度パス（毎回のリロード）の不具合。
  T26 のコーディング完了後の review 工程で、`aidev-60-review` の要件適合の観点から発見した
  （`packages/web/src/store/view.ts:77` 付近）。
- **決定**: `restoreView` の引数を `tabExists: (workspaceId, tabId) => boolean` から
  `findTabFocusedPaneId: (workspaceId, tabId) => string | null` に変える——「tab が存在するか」と
  「その tab の（サーバ全体で最後にフォーカスされた）pane」を 1 回の呼び出しで同時に得る。前回の tab を
  復元する分岐でも、この戻り値を `focusedPaneId` に設定するようにした。
- **影響**: `packages/web/src/store/view.ts`（`restoreView` のシグネチャと実装）・
  `packages/web/src/store/StoreAdapter.ts`（呼び出し側のコールバックを `tab.focusedPaneId` を返す形に
  変更）。`view.test.ts` の既存テストを新しいシグネチャに合わせて更新し、`focusedPaneId` の検証を追加。
  `StoreAdapter.test.ts` に、ページ再読み込みを模す回帰テストを追加（2 つの pinia インスタンスで
  「1 回目の接続でサーバの focus に従う」→「2 回目（再読み込み相当）で前回の tab の focusedPaneId へ
  フォーカスする」ことを確認）。
- **教訓**: T16 のコーディング時点でテストが「その分岐で `focusedPaneId` が正しいか」を検証していなかった
  ことが直接の原因——分岐ごとに全ての観測可能な副作用（ここでは `workspaceId`/`tabId` だけでなく
  `focusedPaneId` も）を検証する、という基本に立ち返る教訓として記録する。

## D83: T1 — U4（xterm.js 6.0.0 のタッチスクロール不具合）を実地に確認。beta 依存は採らず自前実装で補う（2026-09-18・04-mobile T1）

- **背景**: research.md F10.9・design「モバイル」は「`@xterm/xterm` 6.0.0 のタッチスクロールは壊れている
  （#5489）。修正を含む版の有無を coding 時に確かめ、無ければ自前のタッチ処理で補う」としていた。
  04-mobile の tasks 工程の直前に、この不確実性を実地に確認した。
- **確認方法**: (1) `npm view @xterm/xterm dist-tags` で安定版の状況を確認——`latest: 6.0.0`（本製品が
  使っている版のまま）、`beta: 6.1.0-beta.304`。#5563（修正 PR）は 6.1.0 系にしか入っておらず、
  **安定版はまだ存在しない**（2026-09-18 時点）。
  (2) 実物の Chromium（Playwright、`devices["iPhone 13"]` でモバイルのエミュレーション）で、実際に
  scrollback を溜めた `Terminal` に対して `touchstart`/`touchmove`/`touchend` を（実機と同じ
  `Touch`/`TouchEvent` オブジェクトで）発火させ、`term.buffer.active.viewportY` が動くかを確認した。
  スワイプの前後で `viewportY` は変化せず（`71` → `71`）、**タッチによるスクロールが実際に機能していない
  ことを確認した**（研究時点の #5489 の記述と一致）。
- **決定**: 6.1.0 の beta には上げない（未リリースの安定版に依存すると、破壊的変更・未修正のリグレッション
  を製品のコード（サーバへの入力を扱う端末エミュレータ）に持ち込むリスクがあり、MVP としては見合わない
  と判断）。design の指示どおり、**自前のタッチ処理**（`mobile/TouchScroll.ts`。T2）で縦スワイプを
  `Terminal.scrollLines()`（公開 API。`xterm.d.ts:1211`）へ変換して補う。
- **影響**: `packages/web/src/mobile/detect.ts`（T1）・`TouchScroll.ts`（T2）。`@xterm/xterm` の
  バージョンは 6.0.0 に固定したまま変更しない。将来、安定版に #5563 相当の修正が入ったら、
  `TouchScroll.ts` の自前実装を外せるかを再検討する（05 の「herdr との対応表」・対象外一覧に、
  xterm.js のモバイル未解決課題（Android Chrome＋Gboard の文字乱れ #3600・タッチ端末でのコピペ不可
  #3727）と合わせて記録する）。

## D84: T3 — `KeyInputController` を拡張して `injectKey` の `pass` 決定と、ExtraKeys の Ctrl/Alt（one-shot/lock）に対応（2026-09-18・04-mobile T3）

- **背景**: `KeyInputController.injectKey(k: KeyInput)`（T10・03-web-desktop）は既存のまま使うと、
  `KeyRouter.handle()` が `{kind:"pass"}`（端末の既定動作という意味）を返した場合に**何もしない**——
  `pass` は本来「xterm.js 自身の既定処理に委ねる」という意味だが、`injectKey` には合成できる実物の
  `KeyboardEvent` が無く、xterm.js の内部処理を経由させられないため。design の追加キーの列
  （`Esc`・`Tab`・`↑`・`↓`・`←`・`→`・`PgUp`・`PgDn`）はどれも terminal モードでは `pass` になる
  （`KeyRouter` は `ctrl+b` 以外は全て `pass` を返す）ので、**このままでは ExtraKeys の矢印キー等が
  一切機能しない**ことに実装中に気づいた。
  また design「追加キーの列」の `Ctrl`/`Alt`（タップで one-shot・長押しでロック）は、**実際のソフト
  キーボードで打った 1 文字**（xterm.js の内部 textarea への本物の keydown。`handleTerminalKey` 経由）
  にも重ねられる必要がある（`Ctrl+C` で SIGINT を送る、等）——`injectKey` だけを拡張しても、
  ソフトキーボードからの入力には届かない。
- **決定**:
  1. `injectKey` の `pass` 決定を、`INJECT_PASSTHROUGH_BYTES`（`Escape`→`\x1b`・`Tab`→`\t`・矢印→
     `CSI A/B/C/D`・`PgUp`/`PgDn`→`CSI 5~`/`CSI 6~`）で直接バイト列に変換して送るようにした。
     **DECCKM（アプリケーションカーソルキーモード）等の端末モードは見ない簡略化**——
     `KeyInputController` は `paneId → Terminal` の対応を持たない設計（`attach` のたびに呼び出し側から
     渡されるだけ）で、モードを問い合わせるには設計を変える必要があり、MVP では見送った。
     影響は ExtraKeys の矢印ボタンに限られる（vim 等がカーソルキーモードを切り替えていても、
     ExtraKeys の矢印は常に通常モードの並びで送る。実物のソフトキーボードの矢印キー——デバイスに
     あれば——は `handleTerminalKey` 経由で xterm.js 自身が正しく処理するので影響を受けない）。
  2. `KeyInputController.setPendingModifier(mod, {locked?})` を追加した。`handleTerminalKey`（実物の
     xterm.js 経由）・`handleDomKey`・`injectKey` のどの経路でも、次（lock ならそれ以降ずっと）の
     実キー入力に ctrl/alt を重ねる。`Ctrl+<英字>` は標準の制御コード（1〜26）、`Alt+<1文字>` は
     ESC 前置（多くの端末エミュレータの慣習）に変換する。**実物の Ctrl/Alt が既に付いているキーには
     適用しない**（`!raw.ctrl && !raw.alt` を条件にする——物理キーボード＋ExtraKeys を同時に使っても
     二重に修飾されない）。
- **影響**: `packages/web/src/keys/KeyInputController.ts`。回帰テストは既存の 11 件がそのまま通ることを
  確認済み（`KeyInputController.test.ts`）。新規に 7 件追加（`injectKey` の対応表・pending modifier の
  one-shot / lock・実物の xterm.js 経由での適用・実物の Ctrl が既に付いている場合は上書きしない）。

## D85: T6 — `useFitToScreen` の `watch` に `immediate: true` が漏れていた（自分のテストで発見・修正）（2026-09-18・04-mobile T6）

- **背景**: `useFitToScreen.ts` の最初の実装は `watch([opts.paneId, opts.container, fitEnabled],
  recompute, { flush: "post" })` としていた——Vue の `watch()`（`watchEffect` ではない）は既定で
  `immediate: true` を指定しない限り**マウント直後には実行されない**。`paneId`/`container` は
  `MobileShell.vue` 側で最初からすでに値が入った状態で渡すため、これらの ref が「変化」することは
  無く、`recompute()` が一度も呼ばれないまま `scale` が既定値の `1` に固定され続ける不具合になっていた。
  実装直後に自分で書いたテスト（`useFitToScreen.test.ts`）が「既定では縮小する」ケースで
  `scale.value` が `1` のままなことをそのまま検出した。
- **決定**: `{ flush: "post", immediate: true }` に直した。あわせて、pane の cols/rows がサーバから
  届いて変わったとき（`client.fit` 後の実際のリサイズを含む）にも再計算されるよう、`paneDims`
  （`cols x rows` の文字列）を watch の対象に加えた（元の実装はこれも見ていなかった——`session.panes`
  の変化に反応する経路が無かった）。
- **影響**: `packages/web/src/mobile/useFitToScreen.ts`。テストに再現ケースと回帰確認を追加
  （`useFitToScreen.test.ts`、pane のサイズ変更で `naturalSize`/`scale` が再計算されることを含む 5 件）。

## D86: test 工程の実地の確認で発見——`PaneLayout` の単一 pane の leaf に `:key` が無く、モバイルで表示中の pane を切り替えても古い pane を握ったままだった（2026-09-18・04-mobile test）

- **背景**: `MobileShell.vue`（T5）は `PaneLayout`（03-web-desktop T19）を `{type:'pane', paneId:
  currentPaneId}` という**変化しうる**単一ノードのレイアウト木で再利用している（D77 の隣接判断。
  ViewSync の配線を重複させないため）。ところが `PaneLayout` の単一 pane の leaf 要素
  （`<div v-if="singlePaneId" ...>`）に `:key` を付けていなかったため、`paneId` prop（＝
  `singlePaneId`）が変わっても Vue は同じ DOM 要素・同じ `TerminalPane` インスタンスを再利用するだけで、
  `onMounted`/`onBeforeUnmount`（＝`TerminalRegistry.acquire`/`release`）が再発火しない。
  実地の確認（Playwright・iPhone 13 のエミュレーション）で「Prefix ボタン → `v`（分割）」を試したところ、
  分割で新しく作った pane（`pane.split` は成功し、`ActionDispatcher.splitPane` が新しい pane を
  `view.focusPane` する）にフォーカスが移っても、画面には**依然として古い pane が表示され続け**、
  `client.view` の `visible` 申告が一時的に古い pane（`cols:1,rows:1` の退化した値）と新しい pane の
  両方を含む不整合な状態になっていた（CDP で WebSocket フレームを直接見て発見）。
- **決定**: `PaneLayout.vue` の単一 pane の leaf 要素に `:key="singlePaneId"` を付けた。`paneId` が
  変わると Vue が leaf 要素ごと（＝中の `TerminalPane` ごと）破棄・再生成するようになり、
  `acquire`/`release` が正しいタイミングで発火するようになった。
  **デスクトップ側への影響は無い**——各 leaf の `paneId` はレイアウト木の構造上ずっと同じ値なので、
  key の値が変わらず余分な再マウントは起きない。
- **影響**: `packages/web/src/components/PaneLayout.vue`（03-web-desktop T19 の成果物。04-mobile の
  test 工程で発見・修正）。既存の `PaneLayout.test.ts`（03-web-desktop）が回帰なく通ることを確認済み。
  この不具合は単体テストでは検出できなかった——`PaneLayout`単体のテストは「ある1つの`paneId`で正しく
  描画されるか」は見るが、「表示するpaneが動的に切り替わったときの再マウント」というシナリオは
  MobileShellのような「同じスロットのpaneIdが変わる」使い方をして初めて顕在化するため。

## D87: review 工程で発見——`ExtraKeys` の Prefix ボタンが Alt の pending modifier と衝突する不具合／`PanePicker` に Esc での閉じ方が無かった不具合（2026-09-18・04-mobile review）

- **背景**: 04-mobile の review（`ExtraKeys.vue`・`PanePicker.vue`・`KeyInputController.ts` 等を通読）で、
  コード読解のみで再現できる 2 件の実バグを見つけた（いずれもブラウザでの実地の確認は不要——ロジックを
  追えば確定できる種類の不具合）。
  1. **Prefix ボタンが Alt の pending modifier に汚染される**：`ExtraKeys` の「Alt」を armed（one-shot
     または lock）にしたまま「Prefix」ボタンを押すと、`KeyInputController.applyPendingModifier` が
     Prefix の合成キー（`{key:"b", ctrl:true, alt:false}`。既に `ctrl:true` 済み）に `alt:true` を
     追加で重ねてしまい、`combo` が `"ctrl+alt+b"` になる。`KeyRouter.handle` は `combo === "ctrl+b"` を
     厳密一致でしか見ないため prefix に入れず、かつ `"b"` は `INJECT_PASSTHROUGH_BYTES` に無いので
     `injectKey` は何もしない——タップしても無反応、という壊れ方をする（タッチのみで再現し、外部
     キーボードは不要）。
  2. **`PanePicker`（全画面のピッカー）に Esc での閉じ方が無い**：他のダイアログ（`NameDialog`・
     `ConfirmDialog`・`HelpDialog`・`GotoPicker`）は native `<dialog>` の `Esc` 対応にまかせているが、
     `PanePicker` は `role="dialog"` の素の `<div>` で、`×` ボタンでしか閉じられなかった。AC-I1
     「`Esc` または外側クリックで閉じる」の精神に反する（全画面オーバーレイなので「外側クリック」は
     設計上該当しないが、`Esc` は他のダイアログと同様に効くべき）。
- **決定**:
  1. `applyPendingModifier` を「渡されたキーが既に `ctrl`/`alt` を持っているときは重ねない」ガード付きに
     変えた（`k.ctrl || k.alt` なら早期 return）。pending の状態自体は消費しない——Prefix のような
     既に完成した特殊キーで無駄に消費すると、直後に打つはずだった本来のキーから修飾が失われるため。
  2. `PanePicker.vue` に `ContextMenu.vue`（03-web-desktop）と同じ手法（root 要素に `tabindex="-1"` を
     付けてマウント時に `.focus()`、その要素で `@keydown.esc` を受ける）で Esc 対応を追加した。
     `view.openDialog`／`KeyRouter` のモード同期（`main.ts`）までは踏み込まなかった——`KeyRouter` は
     `terminal` モード中は `ctrl+b` 以外すべて `pass`（`KeyRouter.ts:79`）で実害が無く（`ContextMenu`
     も同じ特性のまま 03-web-desktop の review を通っている）、`PanePicker` はタッチが主で外部
     キーボードの併用は稀なエッジケースと判断し、最小の diff（Esc 対応の追加のみ）にとどめた。
- **影響**: `packages/web/src/keys/KeyInputController.ts`・`packages/web/src/mobile/PanePicker.vue`。
  回帰テストを追加（`KeyInputController.test.ts` に 1 件、`PanePicker.test.ts` に 1 件。
  `pnpm -s typecheck && lint && test` で 733 passed、`aidev smoke` も pass を確認済み）。

## D88: T2 の E2E で発見——`workspace.create`／`tab.create`／`tab.close` 系の連鎖が、`workspace.tabIds` の変化を
クライアントへ知らせる WebSocket イベントを一部出していなかった（2026-09-18・05-e2e-docs T2）

- **背景**: `packages/e2e` T2（AC1〜AC3 の E2E。`workspace-tab-pane.spec.ts`）を実物のサーバ＋実物の
  Chromium で走らせたところ、2 件の再現性のある失敗を見つけた（`--workers=1` でも同じく失敗する
  ——並行実行の資源競合ではなく、実装のバグ）。
  1. **「workspace: 作成・名前変更・切替・閉じる」**: `prefix+N`（新しい workspace）の直後、
     新しい pane の `.xterm-helper-textarea` が 30 秒待っても現れない（`terminal-pane` の DOM 要素数が
     0 のまま）。CDP で WebSocket フレームを見ると、サーバは `workspace.created`・`pane.created` の
     2 イベントだけを送り、**新しい tab を知らせる `tab.created` を一度も送っていなかった**
     （`SessionService.createWorkspace`）。`App.vue` の `currentTab = computed(() =>
     session.tabs.get(view.tabId))`（`App.vue:33`）が新しい tab を見つけられず、`<PaneLayout v-if=
     "currentTab && ...">` が常に `false` のまま——`ActionDispatcher.newWorkspace()` は
     `workspace.create` の応答（`r.tab`）から `view.setView(r.workspace.id, r.tab.id)` を呼んでいて
     `view.tabId` 自体は正しく `t2` になるのに、`session.tabs` 側にその tab が一度も登録されない、
     という非対称な壊れ方だった。
  2. **「tab: 作成・名前変更・番号での切替・閉じる」**: `prefix+c`（新しい tab）で `NameDialog` に
     "second-tab" と入力して OK を押しても、`.tab-bar-item` の数が `1` のまま増えない。CDP のフレームを
     見ると `tab.created`・`pane.created` はちゃんと届いており、サーバ側の tab 作成自体は成功していた。
     原因は `TabBar.vue` 側：`tabs = computed(() => ws.tabIds.map(id => session.tabs.get(id))...)`
     （`TabBar.vue:16-20`）——**`ws.tabIds` を読んでいる**が、`SessionService.createTab` は
     `tab.created`／`pane.created` だけを publish し、**`workspace.tabIds` が変わったことを知らせる
     `workspace.updated` を一度も出していなかった**。`SessionModel.commitTab`
     （`SessionModel.ts:250`）はモデル内部の `workspace.tabIds`/`activeTabId` を正しく更新しているのに、
     それをクライアントへ伝える手段が無かった——**サーバのモデルとクライアントの表示が、次の
     再接続（`client.hello` の新しい snapshot）までズレたままになる**、という設計の不変条件
     （「`client.hello` 以降は個々のイベントだけでセッション全体の状態が追随できる」）を破る不具合。
     同じ理由で `closeTab`／`closePane`（連鎖で tab ごと閉じるが workspace 自体は生き残るケース）にも
     同型の欠落があることをコード読解で確認した（`SessionService.closeTab`/`closePane` はどちらも
     `workspace.closed` を「workspace 自体が閉じたとき」だけ出し、「tab が減っただけ」のケースを
     知らせていない）。
  この不具合はどちらも `01-server-core`（`SessionService`）由来——`03-web-desktop`（`TabBar.vue`・
  `App.vue`）・`01-server-core` の単体テストのどちらでも検出できなかった（`SessionService.test.ts` は
  `events` の一覧だけを見て `session.tabs`/`workspace.tabIds` 側の反映は見ていない。`TabBar.test.ts` は
  `session`/`view` ストアへ直接 upsert してから描画を確認するので、実際の WebSocket イベントの
  過不足を経由しない）。D86（04-mobile）と同じ構図——単体テストが「各層それぞれの中身」しか見ず、
  「層をまたいだ実際のイベントの過不足」は実物のサーバ・実物のブラウザでの E2E でしか顕在化しない。
- **決定**: `SessionService.ts` の 4 箇所を直した。
  1. `createWorkspace`: `workspace.created` の直後に `tab.created`（`reserved.tab`）を追加で publish。
  2. `createTab`: `tab.created`／`pane.created` の後に、`this.model.getWorkspace(ws.id)` を取り直して
     `workspace.updated` を追加で publish（`commitTab` が更新した `tabIds`/`activeTabId` を反映）。
  3. `closeTab`: `result.closedWorkspaceId` が無い（workspace は生き残った）場合、`tab.closed` の後に
     `workspace.updated` を追加で publish。tab の `workspaceId` は `model.closeTab` で tab が消える
     **前**に控えておく必要がある（消えた後は辿れない）。
  4. `closePane`: `pane` を閉じた結果 tab ごと連鎖して閉じたが（`removedTabIds.length > 0`）workspace
     自体は生き残った場合も、同じく `workspace.updated` を追加で publish。
  publish の順序は既存の慣習（`splitPane` の「子（`pane.created`）を先に出してから、それを参照する
  親の更新（`layout.updated`）を出す」）に揃えた——`createWorkspace`/`createTab` は「子を作ってから
  親を指す」、`closeTab`/`closePane` は「子を消してから親の更新」の形。
- **影響**: `packages/server/src/session/SessionService.ts`。`SessionService.test.ts` の既存2件
  （`createWorkspace`・「closing the only pane closes the tab and workspace…（D24）」）を新しい
  イベント列に合わせて更新し、新規に3件追加（`createTab`／`closeTab`／`closePane` それぞれが
  `workspace.updated` を出すことの確認）。`WsGateway.integration.test.ts` の3件（メッセージを
  **固定の受信順**で読んでいたテスト）を、増えた `tab.created` の分だけ読み飛ばすよう修正
  （`nextMessage`/`makeInbox` は id で対応付けず、届いた順に読むテスト用ヘルパーのため、
  イベントを増やすと必ずこの手当てが要る）。`pnpm -s typecheck && lint && test`（736 passed）・
  `pnpm --filter @wtm/e2e test`（`debug*.spec.ts` は使い捨てなので削除済み。5 passed。
  `workspace-tab-pane.spec.ts` の2件の失敗がこの修正で解消したことを確認——workspace 作成テストは
  タイムアウト 30s→3.8s、tab 作成テストは tab 数が 1→2 で増えるようになった）・`pnpm -s build &&
  aidev smoke` を確認済み。
- **教訓**: 「モデルが正しく更新される」ことと「その更新がクライアントへ伝わる」ことは別の不変条件で、
  後者を検証するには実物の WebSocket イベント列を実際に流してみるしかない——`SessionModel.test.ts`
  （モデル層）・`SessionService.test.ts`（`events` の名前だけ）・`TabBar.test.ts`（ストアへ直接 upsert）
  のどの単体テストも、この2層の対応漏れを検出できる形になっていなかった。

## D89: T2 の E2E で発見——`KeyInputController` が `false`（処理済み）を返す決定で `preventDefault()` を
一度も呼んでおらず、prefix の 2 打目のキー（ほぼ全ての割り当てキー）がアクションとして処理されると
同時に、素の文字として端末へも入力されていた（2026-09-18・05-e2e-docs T2）

- **背景**: T2 の境界のリサイズ・巡回・入れ替えの spec を書いている最中、`prefix+-`（下分割）の直後に
  「巡回の前提を作る」ための `k` を送ったところ、サーバへは `pane.focus_direction({paneId:"p2",...})`
  が送られ（`p3` からではなく！）、かつ分割先の pane（p2）の raw 出力に、コマンドを打つ**前**の
  プロンプトの直後に素の `-` が 1 文字だけ挟まっていた（`$ -`）ことに気づいた。CDP で WebSocket の
  フレームを直接見て切り分けた。
  原因は `packages/web/src/keys/KeyInputController.ts` の `handleTerminalKey`（`term.attachCustomKeyEventHandler`
  に渡す関数）——`this.dispatch(decision, paneId)` が `false`（＝「ここで処理済み。端末の既定動作は
  させない」の意味で `attachCustomKeyEventHandler` の戻り値として使う）を返す経路のうち、
  `isManualPasteShortcut` の分岐**以外**では一度も `ev.preventDefault()` を呼んでいなかった。
  xterm.js の `attachCustomKeyEventHandler` は「`false` を返せば xterm **自身**の既定処理はしない」
  というだけで（実際に xterm.js 本体のソース `_keyDown` を読むと、カスタムハンドラが `false` を返した
  時点で `preventDefault()` を呼ばずに即座に return している）、**ブラウザ自身の既定動作
  （フォーカス中の隠し `<textarea>`（`xterm-helper-textarea`）へその文字を実際に挿入すること）を
  止めるのは呼び出し側の責務**——xterm.js の公式ドキュメントにも「consumers に `stop propagation
  and/or prevent the default action` の権限を与える」と明記されている（＝任せられているだけで、
  自動ではしてくれない）。`addEventListener` に渡した関数の戻り値はブラウザからは無視される
  （古い `onkeydown="return false"` 属性ハンドラの慣習とは別物）ため、xterm.js の内部 `_keyDown` が
  `false` を返しても、実際のブラウザの「テキストの挿入」という既定動作は一切妨げられていなかった。
  実地の Playwright（実物の Chromium）で `v`（分割）を単独で確かめたところ、素の `v` が確かに端末へ
  literal input として届くことを再現・確認した（`?`（ヘルプ）はダイアログが同じ tick 内でフォーカスを
  奪うため症状が隠れていたが、根本原因は同じ）。
  **影響範囲は非常に広い**——`DEFAULT_KEYMAP` のほぼ全てのキー（`v`・`h`・`j`・`k`・`l`・`H`・`J`・
  `K`・`L`・`Tab`・`x`・`z`・`r`・`P`・`[`・`c`・`n`・`p`・`1`〜`9`・`T`・`X`・`N`・`W`・`D`・`w`・
  `?`・`g`・`b`・`q`）と、prefix 中の割り当ての無いキー（consume）が対象。**Ctrl 修飾のキー
  （`Ctrl+B` 自体等）はブラウザに文字挿入の既定動作が無いため症状が出ない**——これが、これまでの
  膨大な実地の確認・単体テストで一度も気づかれずに済んでいた理由（`waitForOutput` の部分一致検証や、
  目視確認では、コマンド文字列の**先頭**に紛れ込んだ 1 文字は見落としやすい）。
- **決定**: `handleTerminalKey` を `resolveTerminalKey`（判定の本体）と、その戻り値が `false` なら
  必ず `ev.preventDefault()` を呼んでから返す薄いラッパーに分けた。paste 分岐にあった個別の
  `preventDefault()` 呼び出しは、このラッパーに一本化したので削除した（重複を無くしただけで挙動は
  変わらない）。`handleDomKey`（`main.ts` の呼び出し側が `if (!passThrough) ev.preventDefault()` を
  既にしている）・`injectKey`（実物の `KeyboardEvent` を持たない）は対象外——今回の欠落は
  `handleTerminalKey` 経由（xterm.js の customKeyEventHandler 契約）に固有。
- **影響**: `packages/web/src/keys/KeyInputController.ts`。回帰テストを 3 件追加
  （`KeyInputController.test.ts`——`false` を返す決定（action・consume の両方）で `preventDefault` が
  呼ばれること、`pass` では呼ばれないこと）。`pnpm -s typecheck && lint && test`（739 passed）・
  `packages/e2e` の `pane` spec で実地に再確認（修正前は `-` が漏れて `k`/`J` 以降の手順が全てズレて
  失敗していたが、修正後は全て pass）。
- **teaching（このスプリントで見つけた2つ目の教訓）**: 実地の E2E 自身にも罠があった——
  `wsClient.ts` の `waitForEvent` は `lastEvent` と同じキャッシュを見るため、`predicate` を省略して
  同種のイベントを2回目以降待つと**直前の操作の古いイベントへ即座に解決してしまう**（この spec の
  最初のバージョンは `-` split 後の `pane.created` を無条件で待ち、**1 回目の分割（`v`）の
  `pane.created` に即座に解決してしまっていた**——結果、`k` を送るタイミングが分割の RPC 応答
  （`pane.split` 自体。サーバの PTY 起動を `await` するため時間がかかる）より早くなり、
  `view.focusedPaneId` がまだ更新されていない状態で `k` を送っていた）。`wsClient.ts` の
  `waitForEvent` の JSDoc にこの罠を明記した（`predicate` で既知の id を除外する）。合わせて、
  分割直後は「新しい pane へ実際に入力できるか」を型入力で確認してから次の操作へ進むよう spec を
  直した（`pane.created` イベントの到着だけでは、クライアント側の `view.focusedPaneId` 更新——
  `pane.split` 自体の RPC 応答を待つ非同期処理——の完了を保証しない）。

## D90: T3 — AC4 の E2E の検証範囲と、spec 自身の書き方の判断（htop の代替・typed echo の早期一致・
IME の `compositionend`・`tput cols` の読み取り・マウス報告の見送り・並列実行時の失敗の切り分け）
（2026-09-18・05-e2e-docs T3）

製品側の不具合ではなく、**AC4 の E2E をどう書き、どこまでを自動で確かめるか**の判断をまとめて記録する
（同じ T3 で見つかった製品側の実バグは D91・D92）。いずれも `packages/e2e/src/specs/terminal-app.spec.ts`
の注記と `tasks.md` T3 の完了メモが参照している。本来 T3 の coding 時に書くべきだったが書き漏らし、
05-e2e-docs の review（ラウンド 1）で「参照先が存在しない」ことを指摘されて書き起こした。

- **背景**: design.md AC4「検証は vim・htop・Claude Code で行う」「256 色 / TrueColor・全角・マウスの報告は
  xterm.js が扱う」「IME は xterm.js の textarea が受ける」「サイズへの追従は `client.view` → サイズ権限 →
  PTY の resize」を E2E にする過程で、次の 6 点の判断が要った。
- **決定**:
  1. **htop の代わりに `top` を使う**。この検証環境には htop が無く（`which htop` が見つからない）、
     `apt-get install` には sudo が要る（`sudo -n true` がパスワードを要求する）ため即時に導入できない。
     `top`（procps）で「別の全画面 TUI も崩れずにフルスクリーン描画・終了できる」ことを代わりに確かめる。
     なお `top` は htop と違い alternate screen（`?1049h`）を使わず、カーソルホーム＋全画面クリアで
     再描画する実装だった（実地に確認）——spec は `\x1b[H` とヘッダ行 `PID` の到着で判定する形にした。
     htop 自体での目視確認は `docs/verification.md`「Linux」の手動確認に回す。
  2. **「実行後の出力」を待つときは、typed echo には絶対に現れない文字列を needle にする**。シェルは
     打った文字をその場でエコーするので、`printf '\e[38;2;…mMARK'` の `MARK` のような単語を待つと、
     **まだ実行されていない入力中のエコー**に一致して早期に解決してしまう（実地に誤検出しかけた）。
     実際の ESC バイト（0x1B）は `printf` が実行されて初めて出るので、`"\x1b[38;2;12;34;56m"` のような
     本物の制御シーケンスを needle にする。
  3. **IME の合成入力は `compositionend` の後で `textarea.value` を書き換えない**。xterm.js 本体の
     `CompositionHelper.compositionend` は、確定した文字列を `setTimeout(…, 0)` の中で `textarea.value` から
     読み出して PTY へ送る——先に `ta.value = ""` で消していたため何も送られていなかった（実地に確認）。
     spec は `compositionend` を発火し、PTY への到着を確認してから値を消す順にした。合成中に「何も送られて
     いない」ことは、バイト数の完全一致ではなく「合成中の文字列を含まない」ことで確かめる（シェル起動直後の
     タイトル設定等、無関係な OUTPUT が待ちの間に届いてフレーキーになったため）。
  4. **`tput cols` の読み取りは「実行後に新しく現れた、数字だけの 1 行」に絞る**。`echo marker-$(cmd)` の
     ように固定文字列を埋め込むと 2. と同じ理由で早期に一致する。コマンド自体が数字を含まない `tput cols`
     を使い、実行前の出力の長さを基準に、それ以降に現れた `[\r\n](\d{1,4})\r\n` だけを読む——直前の区切りは
     `\r\n`（Enter のエコー）だけでなく `\e[?2004l\r`（bracketed paste の無効化直後、`\n` を伴わない）の形でも
     現れることを実地に確認した。
  5. **マウス報告（アプリが xterm.js のネイティブなマウストラッキングを受け取れるか）の自動検証は見送る**。
     `?1000h`/`?1006h` を有効化した上で Playwright の合成マウスイベントを送っても SGR レポートが観測
     できず、かつ design が「マウスの報告は xterm.js が扱う」と明記して製品側の責務外としている。
     実際の確認は `docs/verification.md`「Linux」の手動確認に回す（M11 と合わせて `docs/herdr-parity.md`
     「未検証のまま見送った項目」にも記録）。色・全角も同じ理由（xterm.js は canvas/WebGL 描画で DOM から
     読めない）でバイト列の往復だけを確かめ、ピクセル単位の描画は確かめない。
  6. **並列実行（既定の `--workers`）での間欠的な失敗は、このサンドボックスの資源競合として扱い、
     判定は `--workers=1` を基準にする**。T3 の spec を並列で走らせると間欠的にタイムアウトしたが、
     この work の変更と無関係な既存の spec（`smoke.spec.ts` 等）も同じように間欠失敗すること、
     `--workers=1` では連続して全件 pass することから、Chromium とサーバを同時に複数起動したときの
     CPU/メモリの競合と判断した（製品側の回帰ではない）。以後の T4〜T11・test 工程もこの基準で判定した。
- **理由 / 代替案**: 1. は htop を導入できる環境（親の統合 test・`docs/verification.md` の手動確認）で
  補えるため、この subtask のために環境へ手を入れない。5. は xterm.js の内部イベントを直接叩く形でなら
  検証できる可能性があるが、それは製品ではなく xterm.js 自身の挙動を試すことになり、E2E の目的
  （製品の配線の確認）から外れるため採らなかった。6. は `playwright.config.ts` の既定の `workers` を 1 に
  固定する案もあったが、資源に余裕のある環境（CI 等）での並列実行を妨げないよう、設定はそのままにして
  判定の運用で吸収した。
- **影響**: `packages/e2e/src/specs/terminal-app.spec.ts`（5 test）。製品コードへの変更は無い。
  `docs/verification.md`「Linux」に htop・マウス報告・IME の候補窓・色の目視確認を手動の確認項目として
  残した（マウス報告の項目は 05-e2e-docs review ラウンド 1 の指摘対応で追記——当初は T3 の完了メモが
  「手動確認へ引き継ぐ」と書きながら、docs 側に該当項目が無かった）。

## D91: T3 の E2E で発見——`PaneLayout.vue` の `commitView`（`client.view` を送る唯一の経路）が
`onUpdated` にしか繋がっておらず、初回マウントでは一度も呼ばれていなかった（2026-09-18・05-e2e-docs T3）

- **背景**: T3「pane サイズ変更への追従」の spec を書いている最中、ページを開いた直後（分割等を一度も
  していない状態）に `tput cols` を打つと、常に `120`（`SessionService.ts` の `HEADLESS_COLS`）が
  返ることに気づいた——ブラウザの実際のビューポート幅とは無関係に、**workspace 作成時の headless な
  既定値のまま固定**されていた。CDP で WebSocket の生フレームを見ると、ページを開いてから何をしても
  （タイピング・`setViewportSize` での明示的なリサイズを含む）`client.view` が一度も送られていない
  ことを確認した。
  原因は `packages/web/src/components/PaneLayout.vue`：`viewSync.commit()`（`client.view` を送り、
  予約された `pane.subscribe` も送る唯一の経路）を呼ぶ `commitView()` が `onUpdated(commitView)` にしか
  登録されておらず、**`onMounted` には一度も登録されていなかった**。Vue の `onUpdated` は「再描画
  （props やテンプレートが参照する reactive な値の変化）」でのみ発火し、**コンポーネント自身の初回
  マウントでは発火しない**——テンプレート ref のコールバック（`setLeafEl` → `ownLeaves.set(...)`）が
  マウント中に実行され `ownLeaves`（`reactive` な Map）を書き換えても、`PaneLayout` 自身のテンプレートは
  `ownLeaves` の中身を直接参照していない（`v-for` 等で描画に使っていない、ブックキーピング専用の内部状態）
  ため、Vue のリアクティブ依存としては追跡されず、`onUpdated` の再発火条件にならない。
  結果：**分割・zoom のトグル・tab の切替など、`PaneLayout` 自身の props（`layout`/`zoomedPaneId`/
  `tabId`/`workspaceId`）を変える操作を一度もしていない、ごく普通の「開いて 1 つの pane をそのまま使う」
  セッションでは、PTY のサイズが永久に `120x40`（headless の既定値）に固定されたままになる**
  ——ブラウザの実際の表示領域とは食い違ったサイズのまま。design.md AC4「サイズへの追従は `client.view`
  → サイズ権限 → PTY の resize」が、最も基本的な「ただ開いて使うだけ」の経路で機能していなかった。
  `SizeAuthority.applyOwnerSize`（`packages/server/src/clients/SizeAuthority.ts`）は `client.view` が
  一度も届いていないクライアントの `client.view` を「無し」として扱い早期 return するため、タイピングで
  `noteInteraction`（サイズ権限の取得）が起きても実際の resize には繋がらない——権限の「所有権」の
  bookkeeping と「実際のリサイズ」が別々の経路になっていることも、この不具合が静かに素通りしてきた一因。
  03-web-desktop・04-mobile の膨大な実地の確認・単体テストのどれも、**「ページを開いた直後、何もせず
  `pane.cols` を確かめる」という検証を一度もしていなかった**ため検出されなかった（split 等の操作を
  伴うテストは、その操作自体が `onUpdated` を発火させて偶然この不具合を隠してしまう）。
- **決定**: `PaneLayout.vue` に `onMounted(commitView)` を追加した（`onUpdated(commitView)` はそのまま
  残す——再描画のたびの再送信も必要）。テンプレート ref は Vue の仕様上 `onMounted` の発火前に必ず
  設定済みなので、`ownLeaves` は呼び出し時点で正しく埋まっている。
- **影響**: `packages/web/src/components/PaneLayout.vue`。`PaneLayout.test.ts` の既存テスト
  （「描画後に `ViewSync.commit` を…呼ぶ」）を「初回マウント直後に 1 回」の確認へ書き替え、
  「再描画のたびにも呼ぶ（2 回目）」のテストを新設した。`pnpm -s typecheck && lint && test`
  （740 passed）・実地の確認（Playwright）で、ページを開いてから 1.5 秒後に `client.hello` を撮り直し、
  `pane.cols/rows` がブラウザの実際のビューポート幅（148x24 相当）に一致することを確認した
  （修正前は `120x40` のまま固定されていた）。

## D92: T3 の E2E で発見——`PaneLayout.vue`・`Splitter.vue`・`TabBar.vue`・`Sidebar.vue` に `<style>` が
一度も存在せず、pane の分割が横／縦に並ばず常にブロック要素として縦積みになっていた（2026-09-18・
05-e2e-docs T3）

- **背景**: D91 の修正で「分割の前後で `tput cols` の値が変わるはず」の確認ができるようになったところ、
  分割してもなお `beforeCols`/`afterCols` が変わらないという新しい不具合に遭遇した。`.terminal-pane`
  の実際の `boundingBox()` を比べたところ、分割後の 2 つの pane が**横に並ばず、上下に積み重なって
  いる**（しかも「右へ分割」しても、である）ことを確認した。`getComputedStyle` で確かめると
  `.pane-layout-split` の `display` は `block`（`flex` ではない）——テンプレートの `:style="{flexBasis:
  ...}"` はフレックスコンテナの中でしか効かないため、実質何も効いていなかった。
  さらに調べると、**`packages/web/src/components/PaneLayout.vue`・`Splitter.vue`・`TabBar.vue`・
  `Sidebar.vue` の 4 つとも `<style>` ブロックが一度も存在しない**（`grep -c "<style"` が全て `0`）ことが
  判明した——ダイアログ・オーバーレイ系の component（`ContextMenu`・`NameDialog`・`HelpDialog` 等）は
  すべて `<style scoped>` を持っているのに対し、**アプリの骨格そのもの（サイドバー・tab バー・pane の
  分割・境界線）には CSS が一度も書かれていなかった**。`App.vue` のグローバル `<style>` は
  `.app-shell`/`.app-main`/`.app-panes`（コンテナの外枠）までしか定義しておらず、その内側（サイドバーの
  横幅・行の見た目・tab バーの帯・pane の分割方向）を担う CSS が丸ごと欠けていた。
  **実際の見た目**：サイドバーは横に固定幅で出ず、tab バーは帯として見えず、複数 pane は常に縦積みの
  素の `<div>` として表示され、境界線（`Splitter`）も太さ 0 に近いブロックとして埋もれる——実際のブラウザで
  開いた製品は、これまでのどの工程（03-web-desktop・04-mobile）のレビューでも「構造（DOM の個数）」と
  「キーボード操作の結果」でしか検証しておらず、**複数 pane が実際にどう配置されているか（座標）を
  確かめたテストが一度も無かった**ため、この規模の欠落が最後まで気づかれずに残っていた。
- **決定**: 4 つの component に `<style scoped>`（`Splitter.vue` は非 scoped）を追加し、意図されていた
  構造（`App.vue` の DOM 構成・`Sidebar.vue`/`Splitter.vue` の変数名や `DEFAULT_WIDTH` 等の実装コメントから
  読み取れる設計意図）どおりに描画されるようにした。既存のダイアログ系 component が使っている CSS
  カスタムプロパティ（`--wtm-bg`・`--wtm-menu-bg`・`--wtm-menu-border`・`--wtm-menu-active-bg` 等）と、
  状態の配色（`GotoPicker.vue`/`PanePicker.vue` の `data-state` の blocked/working/done/idle の色）に
  揃えて一貫させた。**この work（05-e2e-docs）の本来のスコープを超える視覚デザインの作り込み
  （アイコン・細かな余白の調整等）はしていない**——「構造的に正しく配置される」ことまでを直す範囲とし、
  見た目の微調整は別途の判断に委ねる。
  - `PaneLayout.vue`: `.pane-layout-split{display:flex}` ＋ `.right`/`.down` の `flex-direction`。
  - `Splitter.vue`: `flex:none` の固定太さ（4px）と `cursor: col-resize/row-resize`。
  - `TabBar.vue`: `flex:none` の横並びの帯。
  - `Sidebar.vue`: `flex:none` の固定幅（`DEFAULT_WIDTH`）・行のホバー/選択・折りたたみ幅。
- **影響**: 上記 4 ファイル。既存の単体テスト（`PaneLayout.test.ts`・`Splitter.test.ts`・
  `TabBar.test.ts`・`Sidebar.test.ts`）は DOM 構造とクラス名だけを見ているため、CSS を足しても
  回帰なく通ることを確認済み（happy-dom はレイアウトを持たないため、これらの単体テストは
  そもそもこの種の不具合を検出できない——実地の Playwright だけが検出できた）。`pnpm -s typecheck &&
  lint && test`（740 passed）・実地の確認（Playwright）で、分割後の 2 pane が実際に横に並ぶこと
  （`boundingBox` の y が同じで x が異なる）、サイドバーが `x:0, width:~241px` に固定表示されること、
  tab バーがサイドバーの右に帯として表示されることを確認した。
- **教訓**: 構造的な正しさ（DOM の存在・個数・属性）とキーボード操作の正しさだけでは、
  「実際にどう見えるか」を検証したことにならない。`happy-dom`（単体テスト）はレイアウトエンジンを
  持たないため、この種の欠落は原理的に検出できない——**複数要素が同時に見える画面では、少なくとも
  1 つは実物のブラウザで `boundingBox()`（座標）を比較する検証を持つべき**（D86 の「同じ画面に複数
  pane が同時に見える状況は実地でしか検出できない」という教訓と同じ系統の、より広い教訓）。

## D93: T4 の E2E で発見——copy モードの検索（`/`・`?`）が、検索語を入力する経路が一度も実装されておらず
完全に機能していなかった（2026-09-18・05-e2e-docs T4）

- **背景**: AC5 の E2E（copy モードの検索）を書くために、`prefix+[` → `/` → `beta` → `Enter` という
  design.md の手順どおりの操作を実地の Playwright（実物の Chromium）で試したところ、検索が一切
  機能しなかった（scrollback を検索しても該当行へジャンプしない）。
  コードを読むと、`CopyTarget.ts`（T9・03-web-desktop）は `searchInput`（`{op:"searchInput", text}`）を
  受け取って `SearchAddon.findNext`/`findPrevious` を呼ぶ実装を**既に持っていた**（`CopyTarget.test.ts`
  にも単体テストがある）——**しかし `CopyMode.ts`（T8・同じく 03-web-desktop）の `toCommand()` には
  `searchInput` を生成するキーが 1 つも無かった**。`/`・`?` は `searchStart`（検索の**方向**を覚えるだけ）
  を返すのみで、続けて打った文字（例：`beta`）はそのまま copy モードの通常のキー割り当てとして
  解釈されてしまう——`b`＝単語を戻る・`e`＝単語の末尾へ・`t`/`a`＝割り当て無し（何もしない）。つまり
  「検索語を入力する」という UI 側の経路が、T9 が受け口を作った時点から一度も実装されないままだった
  （`CopyTarget.ts` 自身のコメントに「実際にどう文字を集めるか（専用の入力欄か）は T18 の側で決める」
  とあり、T18（`ActionDispatcher`）側でも実装されていなかった）。
  `CopyMode.test.ts`・`CopyTarget.test.ts` はそれぞれの層だけを見ており、**層をまたいだ「検索語が
  実際に組み立てられて渡るか」という結線**は、どちらの単体テストの守備範囲にも入っていなかった
  （D88・D89 と同じ構図——サーバ/クライアントの結線ではなく、モジュール間の結線が単体テストの
  境界の外に落ちていた）。
- **決定**: `CopyMode` 自身に検索語の収集を実装した（`ActionDispatcher` 側に持たせる案も検討したが、
  「次のキーをどう解釈するか」を決めるのはキーの意味を知っている `CopyMode`／`KeyRouter` の責務であり、
  `ActionDispatcher` に持たせると「収集中は copy モードの通常のキー割り当てを無視する」という
  ルーティングの判断を 2 箇所に分けることになるため見送った）。
  `/`・`?` を押すと `searching` フラグを立て、以後のキー入力は copy モードの通常の解釈をせず検索語の
  組み立てに使う：印字可能な 1 文字は末尾に追加、`Backspace` で 1 文字消す、`Enter` で確定して
  `searchInput` を返す（空なら何もしない）、`Escape` で取り消す（どちらも copy モード自体からは
  抜けない——vim の `/` の挙動に合わせた）。修飾キー付き（Ctrl/Alt/Meta）は無視する（暴発防止）。
  **見送ったもの**：検索語の入力中であることを画面に示す可視のインジケータ（`PrefixIndicator.vue`
  相当のもの）は追加しなかった——このタスクの主眼は「検索が機能する状態に戻す」ことで、UI の可視化は
  別の改善として扱う（キーボードのみでの操作自体は完結する。目が見えている利用者には打ち込んだ文字列が
  見えないという UX 上の弱さは残るが、05 の対応表（herdr-parity）に既知の制約として記録する）。
- **影響**: `packages/web/src/keys/CopyMode.ts`。`CopyMode.test.ts` を全面的に書き直した——共有インスタンス
  （`describe` レベルで 1 つの `mode` を全 `it` で使い回す元の形）のままだと、この修正後は「`/` の直後に
  `?` を押す」という既存テストの並びが「? を検索語の 1 文字として食う」という新しい仕様と衝突するため、
  `beforeEach` で毎回新しいインスタンスを作る形に変えた（検索語の入力の検証を別の `describe` に追加）。
  `packages/e2e/src/specs/scrollback-copy.spec.ts`（T4）で実地に再確認（修正前は検索がヒットせず、
  修正後は `beta` を検索して該当行へジャンプし、選択・yank でクリップボードへ正しくコピーされることを
  確認）。`pnpm -s typecheck && lint && test`（748 passed）を確認済み。

## D94: T4 の E2E で発見——copy モードのカーソルが pane の acquire 時点の位置に固定されたままで、
scrollback を溜めてから copy モードに入っても現在位置から始まらない／検索が当たった後の選択が
検索前の古い位置から始まる、の2件（2026-09-18・05-e2e-docs T4）

- **背景**: D93 の修復後、AC5 の E2E（scrollback を遡って yank する・検索して yank する）を実地の
  Playwright（実物の Chromium）で走らせたところ、2 件の追加の不具合が見つかった。
  1. **copy モードのカーソルが「今」の位置から始まらない**：`XtermCopyTarget`（T9・03-web-desktop）は
     `TerminalRegistry.create()`（pane を acquire したとき。ページを開いた直後、ほぼ何も出力が無い時点）
     で**一度だけ**作られ、コンストラクタでそのときのカーソル位置（`buf.baseY + buf.cursorY`）を
     `this.cursor` に固定していた。以後 copy モードへ何度入り直しても、この構築時点の位置から一度も
     更新されない——大量に出力してから `prefix+[` で copy モードに入っても、末尾（今見ている場所）
     ではなく、pane を開いた直後のほぼ先頭に固定されたままだった。`CopyTarget.test.ts` の単体テストは
     `writeLines()` で内容を書いてから `new XtermCopyTarget(...)` するという順序が常に一致していた
     （「後から追加で書く」ケースを一度も書いていなかった）ため、構築時点の位置を前提にした実装のまま
     気づかれずに来ていた（D88・D89・D93 と同じ、層をまたいだ実際の使われ方が単体テストの守備範囲の
     外に落ちていたパターン）。
  2. **検索が当たった後、選択し直すと検索前の位置に戻る**：`CopyTarget.runSearch()` は
     `SearchAddon.findNext`/`findPrevious` を呼ぶだけで、`this.cursor` を一致箇所へ合わせていなかった
     （xterm.js 自身の選択状態だけが動く）。検索の直後に `y`（yank）だけをすれば `term.getSelection()`
     を直接読むので問題は起きないが、design の想定どおり「検索して見つけた行を `v`/`V` であらためて
     選択し直す」と、`selectStart` が古い `this.cursor`（検索前の位置）から選択を作ってしまい、
     検索が当たったこと自体が無意味になっていた。`CopyTarget.test.ts` の検索の単体テストは
     「検索してすぐ yank」の並びしか確認しておらず、「検索してから選択し直す」という設計文書どおりの
     操作列を一度も検証していなかった。
- **決定**:
  1. `CopyTarget` インターフェースに `resetCursor(): void` を追加した。`XtermCopyTarget` は
     構築時と同じ計算（`buf.baseY + buf.cursorY`）をやり直し、選択・検索語も一緒に捨てる
     （前回の copy モードの名残を残さない）。`ActionDispatcher` の `enterMode` ハンドラで、
     `mode === "copy"` のときにフォーカス中の pane の `resetCursor()` を呼ぶ——`prefix+[` を押すたび
     （＝ copy モードに入るたび）に必ず今の位置へ合わせ直る。
  2. `CopyTarget.runSearch()` で、検索が当たったら（`findNext`/`findPrevious` が `true` を返したら）
     `term.getSelectionPosition()`（`IBufferRange`）を読み、`this.cursor` を一致箇所の先頭へ合わせて
     `this.anchor` を消す（検索は「新しい位置への移動」として扱う。選択を検索をまたいで伸ばす機能は
     design に無いため見送った）。**`IBufferCellPosition` の doc コメントは「1-based」と書いているが、
     単体テストで実測すると 0-based だった**（`x`/`y` とも `IBuffer.cursorY`/`baseY` と同じ 0-based の
     絶対座標として素直に扱えた。ドキュメントと実装の食い違いを実測で確認し、実測を優先した——
     このプロジェクト全体の一貫した方針: `AGENTS.md`「疑わしきは docs を見るな、実物を見よ」相当）。
  3. **E2E 側でも別の落とし穴が2つ見つかった**（製品側の不具合ではなく spec 自身の設計の問題として
     記録する）：(a) `PageUp` は端末の行数（`term.rows`）に依存して移動量が変わるため、遡る行数を
     厳密に予測できない——`k`（1 行ずつ）に変えた。(b) 検索語に「自分が打ち込んだコマンド文字列そのもの」
     を含めると（`echo ${needle}` 等）、前方検索（`/`）は末尾から折り返してバッファの先頭
     （＝コマンドのエコーそのもの）に含まれる同じ文字列を先に見つけてしまう——後方検索（`?`）に変えて
     回避した。
- **影響**: `packages/web/src/term/CopyTarget.ts`（`resetCursor`・`runSearch` の座標合わせ）・
  `packages/web/src/actions/ActionDispatcher.ts`（`enterMode` での呼び出し）。
  `CopyTarget.test.ts` に 3 件（`resetCursor` 2 件・検索直後の選択し直し 1 件）、
  `ActionDispatcher.test.ts` に 1 件（`enterMode` が `resetCursor` を呼ぶこと）追加。
  `pnpm -s typecheck && lint && test`（752 passed）・`packages/e2e` の全 14 spec を `--workers=1` で
  2 回連続 pass（並列実行時の間欠的な失敗は D90/T3 で確認済みのこのサンドボックス固有の資源競合であり、
  この work の回帰ではない）・`pnpm -s build && aidev smoke` を確認済み。

## D95: 接続が使える状態（`open`）でない間は端末への入力を止め、止めていることを重ねて表示する（2026-09-19・利用者の判断。03-web-desktop へ戻して実装）

- **背景**: 05-e2e-docs の review 中の E2E で、高負荷下でブラウザの WebSocket が一度切れた直後に打った
  `echo …` の先頭 2 文字が失われ、シェルが `ho: コマンドが見つかりません` と返した（**訂正（D97）**：その後の
  調査で、この実例は切断ではなく方向での焦点移動の応答待ちが原因だったと分かった。ただし「切断中の入力を
  黙って捨てる」こと自体は実際の切断で起こるので、以下の決定は引き続き有効）。
  `Connection.sendInput` は未接続中の入力を**黙って捨てる**設計（design「エラー処理 / 異常系」の
  「WebSocket の切断」の行は再接続の間隔だけを定め、切断中の入力の扱いを書いていない）で、
  `ReconnectOverlay.vue` も「利用者の操作を止めるものではない」として入力を止めていなかった。
  サーバ側のエコーが無いので打った文字は表示もされず、利用者は欠けたまま実行されたことに気づけない。
- **選択肢**（利用者に提示）: (1) 今のまま・既知の制約として docs に明記、(2) 再接続まで溜めて送る
  （上限と、その間に pane が閉じた場合の扱いを決める必要がある。古い入力を状況の変わった端末へ
  後から流し込む危険もある）、(3) 切断中は入力を止め、止めていることをはっきり示す。
- **決定**: (3)。**利用者の判断**（2026-09-19）。
  1. **`open` の意味を「hello が通って使える状態」に揃えた**（`net/Connection.ts`）。以前は socket が
     開いた時点で `open` にしていたため、hello が失敗して閉じ直すまでの間、入力を受け付けたまま捨てていた。
     また切断を検知した時点で（`/api/session` の確認を待たずに）`reconnecting` にする——以前は確認が
     終わるまで `open` のまま残っていた。
  2. `open` 以外の間は、xterm.js が出す入力（キー・貼り付け・IME の確定・マウス報告。すべて `onData` を
     通る）を `TerminalRegistry` の `onData` で止める（`setInputEnabled`。`main.ts` が
     `view.connectionState` を watch して呼ぶ）。**xterm.js の `disableStdin` は使わない**——6.0.0 では
     内部の textarea を `readOnly` にするため、モバイルでは再接続のたびにソフトキーボードが閉じうる
     （独立点検で指摘）。止めた文字は溜めない（あとから流し込まない）。
  3. `ReconnectOverlay.vue` を `connecting`（初回・「再接続」ボタンの直後）と `reconnecting` の両方で出し、
     「つながるまで入力できません」を添える。`pointer-events: none` はそのまま（scrollback を読む・
     選択する操作は止めない）。ログイン画面・切り離し画面の間は App.vue が本体ごと差し替えるので出ない。
  4. `KeyInputController` が `onData` を通さずに直接送るバイト列（`ExtraKeys` の注入・pending の Ctrl/Alt・
     prefix の二度押しの `\x02`）は、未接続なら `Connection.sendInput` が捨てる既存の挙動のまま——
     オーバーレイが入力できないことを示しているので、黙って消えることにはならない。
- **残る制約**（利用者に説明済み）: 止めていることを**見えるようにする**変更であって、打った文字を保存して
  あとで送るものではない。切断の瞬間をまたいで打てば、先頭が欠けることは起こりうる（画面にはその旨が出る）。
  また、ソケットが実際には切れているのにブラウザがまだ検知していない間（TCP の半開き）は防げない。
- **design との差**: design「エラー処理 / 異常系」の「WebSocket の切断」の行に「切断中（接続・再接続の
  あいだ）は端末への入力を止め、その旨を重ねて表示する」を足す意味の変更。design.md 自体は承認済みの
  成果物なので書き換えず、この D95 を正とする。
- **影響**: `packages/web/src/net/Connection.ts`・`packages/web/src/term/TerminalRegistry.ts`・
  `packages/web/src/main.ts`・`packages/web/src/components/ReconnectOverlay.vue`（03-web-desktop の成果物。
  03 の tasks.md に T27 を足して coding → test → review をやり直す）。受け入れ基準は AC8（再接続）。
  回帰テスト：`Connection.test.ts`（hello が通るまで open にしない・hello 失敗で open にならない・
  切断で即 reconnecting・切断後の 401 で再接続しない）、`TerminalRegistry.test.ts`（止めている間は送らない・
  あとから作った xterm.js も止まる・`disableStdin` は使わない）、`ReconnectOverlay.test.ts`。
  実機（iOS/Android）でソフトキーボードの挙動を確かめるのは親の統合 test の AC12 の実機確認に含める。

## D96: 親の統合 test で発見——`@xterm/xterm/css/xterm.css` が Web のどこからも読み込まれておらず、端末の中身が一切見えていなかった（2026-09-19・親の統合 test → 03-web-desktop へ差し戻し）

- **背景**: 親の統合 test で実物の Claude Code・Codex を pane の中で起動し、スクリーンショットを見たところ、
  サイドバーのエージェントの表示は正しいのに**端末の領域が真っ白**だった。切り分けると、描画用の WebGL
  canvas が `.xterm-screen`（top 39）ではなく `top: 739`（ビューポートの高さ 720 の外）に置かれていた。
  xterm.js は必須の CSS（`@xterm/xterm/css/xterm.css`：canvas を絶対配置で重ねる・入力用 textarea を隠す等）
  を利用側が読み込む前提だが、`packages/web` のどこからも読み込んでおらず、ビルドした CSS にも xterm の
  ルールが一つも無かった。canvas が通常のフローで縦に積まれ、文字を描いた canvas が端末の下へ押し出されて
  いた。入力用の textarea も左上に小さな枠として見えていた。
  **03-web-desktop の T12（TerminalRegistry）以来ずっとこの状態**だったが、単体テスト（happy-dom は
  レイアウトを持たない）・smoke（PTY とのバイト列の往復だけを見る）・05 の E2E（バイト列・DOM の要素数・
  `boundingBox`・`getComputedStyle` で判定し、画面に文字が描かれているかは見ていなかった。WebGL の canvas は
  DOM から読めないため）のどれも捕まえられなかった。
- **決定**: `packages/web/src/main.ts` で `import "@xterm/xterm/css/xterm.css";` する（デスクトップ・モバイルの
  共通の入口）。回帰の防止として `smoke.ts` の Web の確認に「描画用 canvas が `.xterm-screen` の枠の中に
  あり、入力用 textarea が見えていない（opacity 0）」を足した——**import を外すと smoke が
  `terminal canvas is outside .xterm-screen` で失敗することを実地に確かめた**（ネガティブコントロール）。
  `aidev smoke` は各 test 工程で必ず走るので、ここに置けば今後も毎回確かめられる。
- **影響**: `packages/web/src/main.ts`・`packages/server/src/smoke.ts`（03-web-desktop の T26 の成果物）。
  03 の tasks.md に T28 を足して coding → test → review をやり直す。受け入れ基準は AC4（端末の表示）。
- **教訓**: E2E の判定を「バイト列が往復したか」だけに寄せると、**画面に何も映っていない**という最も基本的な
  不具合がすり抜ける。少なくとも一度は、実物のブラウザのスクリーンショットを人（またはモデル）の目で
  見ること——今回は実物のエージェントの見た目を確かめるために撮った 1 枚で初めて気づいた。
- **付随して見つけたこと**: ビルド（`tsc -b`）が `[...document.querySelectorAll()]`（`DOM.Iterable` が要る）で落ちた。
  smoke.ts は `Array.from` に直した。当初ここに「`typecheck` はこれを見逃した（設定の差）」と書いたが**誤り**（2026-09-19
  訂正）——同じコードに戻して確かめると `pnpm -s typecheck` も exit 2 で落ちる。見逃したのは確かめ方のほうで、
  **`pnpm -s`（silent）の再帰実行は失敗しても子の出力を一切出さない**ため、`pnpm -s typecheck 2>&1 | tail` では
  出力も終了コードも消えていた。以後、typecheck・lint・build は出力をファイルへ落とし、終了コードを別に見る。

## D97: 焦点の移動がサーバの応答待ちで遅れる・表示中のものを閉じると何も表示されない、の2系統を直す（2026-09-19・親の統合 test → 03-web-desktop の test で発見・差し戻し）

- **背景**: D96（xterm.css）を入れた後、`workspace-tab-pane.spec.ts` の pane の test が 3 回中 2 回落ちるように
  なった。失敗時のページのスナップショットに「再接続中…」が出ていたので接続の切断を疑ったが、ブラウザ側
  （Playwright の WebSocket イベント・`connectionState` の遷移のログ）とサーバ側（`ws` の close イベント）の
  両方を記録すると、**WebSocket は test の間一度も閉じておらず、`connectionState` も `open` のままだった**。
  「再接続中」は、test の後片付けでサーバを止めた**後に**撮られたスナップショットに写っていただけだった。
  **05-e2e-docs の review で「高負荷下で原因不明の WebSocket の切断」とされていた間欠的な失敗も、同じ見かけに
  よる誤認だった可能性が高い**（その回の記録も、根拠はスナップショットの「再接続中」だった）。
  フォーカスとキーの行き先を記録すると、本当の原因は次のとおり：
  1. **方向での焦点移動が応答待ち**：`prefix+h/j/k/l` は `pane.focus_direction` の RPC の応答を受けてから焦点を
     移していた。その往復（実測 約 35ms）の間に打った文字は、移動前にフォーカスのあった要素へ届く——端末以外
     （この test では境界線 `.splitter`）なら捨てられ、端末なら移動前の pane に入る。test の `echo` の先頭 2 文字が
     消えて `ho: コマンドが見つかりません` になっていたのはこれ。LAN 越しで遅延が大きいと、手で速く打っても起こる。
     巡回（`Tab`）はクライアントで移動先を求めて即座に移しており、方向の移動だけがこうなっていた。
  2. 「同じ不変条件（焦点を動かす操作の直後の入力は、新しい焦点へ届く）を支える箇所」を洗い出す過程で、
     **表示中の pane / tab / workspace を閉じたときに、表示と焦点を移し直す処理がどこにも無い**ことも見つけた。
     実物の Chromium で確かめると：pane を閉じると焦点が BODY へ落ちてクリックするまで入力できない、
     **tab を閉じると端末が 1 つも表示されない**（`view.tabId` が閉じた tab を指したまま）、**workspace を閉じると
     tab バーごと消える**。05 の E2E は tab の数・サイドバーの行の数しか見ておらず、すり抜けていた。
- **決定**:
  1. 方向での焦点移動を**クライアントで先に求めて即座に移し**、`pane.focus` を送る（`cyclePane` と同じ形）。
     サーバの `LayoutTree.neighbor` と同じ規則を `packages/web/src/term/layoutOrder.ts` の `neighborPaneId` に
     移植した（`depthFirstPaneIds` を既にクライアントに持っているのと同じ扱い。規則の一致はサーバ側と同じ
     期待値のテストで確かめる）。サーバの `pane.focus_direction` 方式自体は残す（API の一部）。
  2. 表示中のものが閉じられたら、残っているものへ表示と焦点を移す：`packages/web/src/store/viewRepair.ts` の
     `repairView`（純粋関数）を `StoreAdapter.applyEvent` のたびに呼ぶ。選び方はサーバが閉じたときに選ぶものと
     揃える（閉じた tab の代わりは残りの先頭、閉じた pane の代わりはレイアウト木の最初の葉）。イベントは
     pane.closed → tab.closed → workspace.updated の順で 1 つずつ届き、途中では tab の `focusedPaneId`・
     workspace の `activeTabId`・レイアウト木がまだ古いので、「実際に存在するもの」だけから選ぶ。
     別のブラウザが閉じた場合にも効く。
- **残る制約（利用者に相談する）**: 分割（`v`/`-`）・新しい tab（`c`）・新しい workspace（`N`）の直後は、
  新しい pane をサーバが作るまで（シェルの起動確認の猶予 300ms を含む。D37）焦点を移せないので、その間に
  打った文字は**移動前の pane に入る**（失われはしない）。解消するには「焦点を動かす操作の応答待ちの間の入力を
  溜め、新しい焦点へ流す」仕組みが要る。
- **影響**: `packages/web/src/actions/ActionDispatcher.ts`・`packages/web/src/term/layoutOrder.ts`・
  `packages/web/src/store/viewRepair.ts`（新規）・`packages/web/src/store/StoreAdapter.ts`。03 の T29。
  受け入れ基準は AC1〜AC3・AC-I3・AC-I4。D95 の「背景」に書いた `ho: コマンドが見つかりません` の実例は、
  切断ではなくこの焦点移動の遅れが原因だった（D95 の変更そのものは、実際の切断に対して引き続き有効）。
- **教訓**: 失敗時のページのスナップショットは、fixture の後片付けの**後**に撮られることがある。画面に写った状態
  だけで原因を決めず、該当する出来事（接続の開閉・状態の遷移）を時刻つきで記録して確かめる。

## D98: 流量制御を実際に働かせる——`onDrain` が一度も呼ばれていなかった・OUTPUT の圧縮で送信の出口が詰まっていた（2026-09-19・親の統合 test → 01-server-core へ差し戻し）

- **背景**: 親の統合 test で AC17 の計測を作り直した。05 の「規模」の計測は `yes > /dev/null &` で、出力が端末を通らず
  「大量出力が流れる pane」になっていなかった（`yes &` に直した）。直した計測では、1 つの pane に `yes` を流すと、
  **同じ接続の別の pane の出力が 8〜10 秒たっても一切届かなかった**（サーバだけの計測・ブラウザ込みの計測の両方）。
  サーバ内部に一時的なログを入れて切り分けた結果、原因は 2 つ：
  1. **`onDrain` が一度も呼ばれない**：`OutputFanout` はクライアントの `bufferedAmount` が 2MB を超えると購読を stale にし、
     256KB を下回ったら `retryStale` で新しい SNAPSHOT を送り直す設計（design「流量制御」）。その `retryStale` の起点の
     `WsServerWs.onDrain` は `ws` の WebSocket に `"drain"` を登録していたが、`ws`（8.21.3）の WebSocket は `drain` を
     emit しない（`lib/websocket.js` が利用側に emit するのは `open`・`close` 等だけ）。出力を出し続ける pane はミラーが
     追いつくたびにも `retryStale` が呼ばれる（`TerminalHost`）ので回復するが、**混んでいる瞬間に小さな出力を出して黙った
     pane は永久に止まったまま**になる。
  2. **OUTPUT の 1 通ずつの圧縮で送信の出口が詰まる**：PTY の出力（〜4KB ずつ）を 1 通ずつ permessage-deflate で非同期に
     圧縮していたため、送信バッファが減る速さが**約 0.8MB/s** まで落ちていた（実測）。大量出力の約 2MB の後ろに他の pane の
     出力が並び、静かな pane の応答が 2.5 秒以上かかっていた。一時的に permessage-deflate を切ると、同じ条件で静かな pane の
     応答は 1〜29ms になった。
- **決定**:
  1. `WsServerWs.onDrain` を 50ms ごとに呼ぶ形にした（閾値の判定と「止めた購読があるか」は `retryStale` 自身が行う）。
     接続が閉じたらタイマーを止める。
  2. OUTPUT フレームだけは圧縮せずに送る（`ws.send(frame, { compress: false })`）。SNAPSHOT・JSON は従来どおり圧縮する
     （D31 の意図：大きなスナップショットの帯域を節約する、は保つ）。permessage-deflate そのものを切る案は、SNAPSHOT の
     帯域の節約まで失うので採らなかった。
  3. 閾値（2MB／256KB）は変えない。変える判断は、GPU の無いこのサンドボックスではなく実機で測ってからにする（下記）。
- **修正後の計測**（このサンドボックス：ソフトウェアの WebGL・ホストのロードアベレージ 3〜5）：大量出力の pane の隣の pane の
  出力は届くようになった（止まらない）。ただし最大速度の `yes` を流し続けたままの遅延は、サーバだけで p95 約 250ms、
  16 pane をブラウザに同時表示した状態で p95 約 700ms（描画フレームの最大間隔は約 150ms で、ブラウザは固まってはいない）。
  サーバ側は、大量出力の処理（PTY の読み取りとサーバ内のミラーでの解析）がイベントループを占めることが効いている。
  requirements の「p95 50ms」はこの極端な条件ではこの環境で満たせていない——**実機で測って判断する**（利用者に相談する）。
- **影響**: `packages/server/src/ws/WsServerWs.ts`・`WsServer.ts`・`WsGateway.ts`（01 の T23）。回帰テスト 2 件
  （`WsGateway.integration.test.ts`）。受け入れ基準は AC17。

## D99: 新しい pane を作る操作の応答を待つ間の入力を溜め、新しい pane へ流す（2026-09-19・利用者の判断。03-web-desktop へ戻して実装）

- **背景**: D97 の「残る制約」。分割（`v`/`-`）・新しい tab（`c`）・新しい workspace（`N`）は、サーバが新しい pane を作って
  応答を返すまで（シェルの起動確認の猶予 300ms を含む。D37）焦点を移せない。その間に打った文字は移動前の pane に入っていた
  （実物の Chromium で、`prefix+v` の直後に `echo …` を打つと先頭の `echo wtm-e2e-a` が元の pane に入ることを確認）。
- **選択肢**（利用者に提示）: (1) 今のまま・制約として明記、(2) 溜めて新しい pane へ流す（tmux に近い振る舞い）。
- **決定**: (2)。**利用者の判断**（2026-09-19）。
  - `packages/web/src/net/InputGate.ts`（新規）：`ConnectionPort` を包み、`sendInput` 以外は素通しする入力の関所。
    保持の間は、保持を始めたときに焦点のあった pane 宛ての入力を溜める（他の pane 宛ての入力とフォーカスの報告は溜めない）。
    `release(新しい pane)` で溜めた分を順番どおりに新しい pane へ、`cancel()`（要求の失敗）で元の pane へ流す。応答が来ないまま
    5 秒たったら元の pane へ流す（入力を失わない）。保持の最中に次の保持が始まったら、溜めた分を引き継いで後の操作の結果へ流す。
  - 入力は全て `sendInput` を通る（xterm.js の `onData`・`KeyInputController` の直接の送信）ので、`main.ts` で関所を
    `TerminalRegistry`・`KeyInputController` の送り先にすれば、1 か所で全ての経路を扱える。
  - `ActionDispatcher` の `splitPane`・`confirmNewTab`・`newWorkspace` が要求の前に `holdInput` し、応答で焦点を移してから
    `release`、失敗なら `cancel` する。新しい pane が既に閉じている（シェルが猶予中に終わった）・zoom で隠れているときは
    `release` せず元の pane へ戻す。
  - **溜めないもの**（独立点検の指摘で追加）：ポインタ操作から出た入力（マウスの報告・alt screen でのホイールの矢印キーへの
    変換）——元の pane の上での操作なので、新しいシェルへ流すと履歴の呼び出し等の意図しない入力になる。`TerminalRegistry`
    が `origin: "pointer"` の印を付ける（キャプチャ段階で立て、イベントの配送後のタスクで下ろす）。
  - **保持が重なったら**（`prefix+v` を 2 回すばやく押す等）順番つきの列にし、打った順番とどの操作の後に打ったかを保つ。
  - **既知の制約**：IME の変換中の文字は `onData` に出る前なので溜まらない（確定が応答の後なら元の pane に入る。変更前と同じ）。
    貼り付けはキー入力と同じく `onData` を通るので溜められ、新しい pane へ届く。
- **影響**: `packages/web/src/net/InputGate.ts`（新規）・`packages/web/src/actions/ActionDispatcher.ts`・`packages/web/src/main.ts`
  （03 の T30）。受け入れ基準は AC1〜AC3・AC-I4。E2E に「作る操作の直後に打った文字が新しい pane に届く」を足し、**関所を外すと
  落ちる**ことを確かめた。D97 の「残る制約」はこれで解消。

## D100: 分割・pane を閉じる操作で zoom を解除する（2026-09-19・03 の T30 の独立点検で発見 → 01-server-core へ差し戻し）

- **背景**: D99 の実装の独立点検で、zoom 中に分割すると新しい pane が隠れたまま焦点だけが移ることが分かった
  （`SessionModel.splitPane` は `zoomedPaneId` をそのまま残していた。閉じるほうも、zoom 中の pane 自身を閉じたときだけ解除）。
  利用者から見ると、分割したのに画面が変わらず、打った文字は見えない pane へ入る。
- **決定**: 参照実装の herdr に合わせる——`Tab::split_pane_with_runtime` と `Tab::detach_pane` はどちらも `zoomed = false`
  にする。`SessionModel.splitPane` は分割した tab の `zoomedPaneId` を `null` に、`closePane` は（どの pane を閉じても）
  tab が残るなら `zoomedPaneId` を `null` にする。
- **理由 / 代替案**: 「分割しても zoom を保つ」は tmux の既定（tmux は分割で zoom を解除する）とも herdr とも違い、利用者が
  新しい pane を見失う。クライアント側だけで zoom を外す案は、サーバの状態と食い違い、他のクライアントに伝わらないので退けた。
- **影響**: `packages/server/src/session/SessionModel.ts`（01 の T24）。クライアントへは既存の `layout.updated`（tab 全体）で
  届くのでプロトコルの変更は無い。03 の `ActionDispatcher.releaseHold` の「zoom で隠れているなら元の pane へ戻す」は、
  応答までの間に別のクライアントが zoom した場合の保険として残す（コメントを更新）。受け入れ基準は AC3・AC-I4。

## D101: `0.0.0.0` / `::` で待ち受けるときは、開ける URL（`localhost` と LAN の IPv4）を並べて表示する（2026-09-19・親の統合 test の残件 → 01-server-core）

- **背景**: `wtm serve --host 0.0.0.0 …` の起動時の表示が `wtm: open https://0.0.0.0:8443/#token=…` だった。`0.0.0.0` は
  待ち受けのための指定で、ブラウザで開く宛先にはならない（別のマシンからは開けない）。token 付きの URL はこの一度しか
  表示しないので、利用者は URL を手で組み立て直すことになる（docs/verification.md は「表示された URL を開いてログインできる」
  を確かめる手順になっている）。
- **決定**: ワイルドカードで待ち受けるときは `localhost` と、このマシンの LAN の IPv4（ループバックの I/F に載ったもの＝
  `internal` と、リンクローカル `169.254.*` を除く）ごとに `wtm: open <URL>/#token=…` を 1 行ずつ表示する。
  `127.*` の前方一致だけでは足りない——WSL2 は `lo` に `10.255.255.254` を載せる（独立点検の指摘。`NetworkInfo.lanAddresses()`）。明示したホストはそのまま（IPv6 は角括弧で囲む）。どれも
  `OriginPolicy` が許可するアドレスに含まれる。token を表示しない起動（2 回目以降）でも、開ける URL は表示する。
- **理由 / 代替案**: IPv6 のアドレスは利用者が打ちにくく、リンクローカルは別のマシンから使えないので並べない（`--host` に
  明示すれば表示する）。ホスト名を並べる案は、証明書の SAN・名前解決の有無で開けるかが変わるので退けた。
- **付随して直したこと**（独立点検で発見。表示した URL が拒否されないことの前提）: `OriginPolicy` はホスト名の大文字小文字を
  区別して比べていたため、ブラウザが小文字で送る `Host` を拒否していた——**Windows のホスト名（`DESKTOP-…`）でアクセスすると
  ログインできない**（AC16 の実機確認で踏むはずだった）。小文字にそろえて比べる。また明示したループバックの名前
  （`--host foo.localhost`）を許可リストに入れていなかったので入れる。さらに（ラウンド2）：`--host [::1]` の角括弧を外す
  （`listen()` が名前として引いて落ちていた）・待ち受けの失敗（ポートが使用中等）は未処理の 'error' で落とさず、案内を出して
  終了コード 2 にする・`--origin` を `URL.origin` にそろえる（`https://x:443`・末尾の `/` がブラウザの Origin と一致しなかった。
  docs/tls-setup.md の Tailscale の例にポートが無く、既定の 7780 ではそのままでは一致しなかったのも直す）。
  T25 の独立点検はこのラウンド2で上限（`maxTaskCheckRounds`=2）に達した。ラウンド2の修正は、修正を外すと落ちるテストと
  実物の CLI（`--host [::1]`・ポートが使用中・不正な `--origin`）で確かめ、残りの確認は 01 の review に委ねる。
- **影響**: `packages/server/src/util/net.ts`（`accessUrls`・`lanIpv4Addresses`・`formatUrlHost`）・`infra/OsNetworkInfo.ts`・
  `auth/OriginPolicy.ts`・`config.ts`・`composeServer.ts`・`main.ts`・`docs/tls-setup.md`（01 の T25）。`packages/e2e/src/specs/tls-lan.spec.ts` は、LAN の IP の URL が表示される
  ことを確かめる形にした。

## D102: ブラウザが届く宛先はサーバから見えない——`--origin` を表示の先頭に・Origin の拒否をログに・待ち受けを起動の最初に（2026-09-19・01 の review ラウンド5 → 01-server-core。同日、T26 の独立点検の 9 件を反映）

- **背景**: 01 の review ラウンド5（T25／D101 の最終形の独立レビュー）で 9 件。根本の原因は 2 つ。
  1. **起動時の表示と Origin の許可リストが、どちらも「サーバ自身のインタフェースのアドレス・ホスト名＋待ち受けポート」
     だけから作られていた**。ブラウザが実際にどこへ（アドレス・ポート・名前）つなぎ、どの `Host`/`Origin` を送り、証明書の
     どの名前と照合されるか、の模型が無い。これが要件の対象の構成（AC11 の TLS での遠隔接続・AC16 の Linux / WSL2 / Windows）で崩れる。
     - **WSL2 の NAT＋Windows の portproxy**：ブラウザが開くのは `https://<母艦の LAN の IP>:8443` で、WSL のインタフェースに無い。
       docs/tls-setup.md の方法B どおりに進めると `--port` も無く（既定 7780）、`/api/login` が 403 になりログインできなかった（must）。
     - **Tailscale・リバースプロキシ**：ブラウザはサーバから見えない名前を使い、証明書もその名前にしか一致しない。`--origin` で
       許可はできたが、表示される URL はどれも証明書と一致せず、token 付きの URL を手で組み立て直すことになった（D101 の問題そのもの）。
     - **docker・仮想スイッチのブリッジを持つホスト**：`docker0`・`br-*`・`vEthernet (WSL)` 等のアドレスがインタフェースに載り、
       別のマシンからは届かないのに表示に（先頭にも）並んだ。
     - 拒否したことがサーバのログに残らず、クライアントも 403 を token の誤りと同じ文言で表示するため、利用者は token が違うと
       思い込み `wtm token reset` へ進む。
  2. **`composeServer` の順序**：token の作成 → 復元（保存された全 pane のシェルを猶予 300ms つきで起動）→ poller → bind。
     待ち受けに失敗すると（典型は「同じ state-dir の wtm が既に動いている」）、作った token を一度も表示せずに失い、全シェルを
     起動し、その間の `persist.touch()`（と `close()` の flush）で動いている側の `session.json` を上書きしえた。
- **決定**:
  1. **仕様として明記する**：許可リストと表示は、サーバ自身のインタフェースからしか作れない。ブラウザが開く宛先（アドレス・
     ポート・名前）がそこに無い構成（ポート転送・リバースプロキシ・Tailscale の名前）では **`--origin` が必須**で、
     **その Origin を開ける URL の先頭に表示する**（`accessUrls(…, extraOrigins)`。`URL.origin` で比べて重複を除く。純関数のまま）。
     構成ごとの `--port`・`--origin`・開く URL・証明書の SAN の表を design「起動時の表示」の後に置く：
     | 構成 | `--port` | `--origin` | 開く URL | SAN |
     |---|---|---|---|---|
     | Linux（LAN） | 任意 | IP・`os.hostname()` で開くなら不要（`.local`・FQDN 等の別名なら必要） | 表示される LAN の IP | LAN の IP |
     | WSL2 mirrored | 任意 | 不要 | 表示される母艦の LAN の IP | 母艦の LAN の IP |
     | WSL2 NAT＋portproxy | `connectport`（＝`listenport`） | `https://<母艦の LAN の IP>:<listenport>` | `--origin`（先頭） | 母艦の LAN の IP |
     | Windows ネイティブ | 任意（除外ポート範囲の外） | 不要 | 表示される LAN の IP | LAN の IP |
     | Tailscale | 任意 | `https://<machine>.<tailnet>.ts.net:<port>` | `--origin`（先頭） | ts.net の名前 |
  2. **Origin/Host の拒否をログに残す**（design「エラー処理 / 異常系」の「Origin の不一致」の要求。未実装だった）：
     `HttpServer`（`/api/login`）・`WsServerWs`（`/ws`）で `warn("origin rejected", { path, remoteAddress, origin, host,
     allowed: allowedHostPorts(), [suppressed], hint })`。`hint` は「`--origin` で許可できる」旨（`ORIGIN_REJECTED_HINT`）。
     **拒否は認証の前に誰でも何度でも起こせ、`Origin`/`Host` は相手が自由に送れ（約 16KB まで）、`server.log` はローテーション
     しない**（T26 の独立点検）ので、共通の `auth/OriginRejectionLog` が、同じ（接続元・`Origin`・`Host`）を 60 秒に 1 回だけ
     書き（その間に書かなかった件数は次の行の `suppressed`）、`Origin`・`Host` を 200 文字で切り、間引きの表は 1000 件を超えたら
     空にする。`composeServer` は 1 つを `HttpServer` と `WsServerWs` で共有する（時計は差し替えられる）。クライアントの
     403 と 401 の文言の区別は 03（Web）の範囲で、ここでは触らない。
  3. **待ち受けを起動の最初に行う**：`listen()` = bind（'error' で reject）→ token（`ensureToken`）→ 復元／`ensureNotEmpty` →
     poller → `/ws` の受け付けの開始。`freshToken` は getter にし、`listen()` が resolve するまでは `undefined`（API は変えずに
     読む時点だけを後ろへ）。`/ws` は受け付けを始めるまで 503（`WsServerWs.setReady`）——復元は bus にイベントを出さないので、
     途中で hello したクライアントは作りかけのスナップショットのまま取り残される。Web は間隔を空けて繋ぎ直すので 503 で足りる。
     `close()` は復元を済ませる前なら `session.json` へ書かず、残っている保存の予約も取り消す（`PersistScheduler.cancel()`。
     失敗した起動を閉じると空の状態で上書きしていた・復元の途中の予約が 500ms 後に作りかけの状態を書きえた）。`close()` は
     最初に `setReady(false)` にし、`closeAll` の後に届いた upgrade を通さない。証明書の読み込み・解釈の失敗は組み立て時に
     `ConfigError`（終了コード 2）にする（token はまだ作っていないので失わない）。
     **不変条件：作った token は必ず一度表示される**。bind の失敗では作らない。bind の後（token を作った後）の段で起動に
     失敗したとき（例：既定のシェルが無く、最初の workspace の作成が `spawn_failed` になる）は、`freshToken` は読めるままで、
     `main` が失敗の表示の前に `wtm: token（今回作成・この表示が最後）: <token>` と「失くしたら `wtm token reset`」を出す
     （T26 の独立点検：以前は終了コード 1 で token を一度も表示せずに終わっていた）。順序（bind → token → 復元）は変えない。
  4. **待ち受けの失敗の文言**：`main` は bind の段階の失敗（`syscall` が `listen`/`getaddrinfo` で、`code` が `EADDRINUSE`・
     `EACCES`・`EADDRNOTAVAIL`・`ENOTFOUND`・`EAI_AGAIN`）だけを `ConfigError`（終了コード 2）にし、それ以外はそのまま投げる
     （`code` だけで見ると、bind の後の token の保存の `EACCES` を「ポートの権限」と取り違える）。案内は純関数
     `listenFailureHint(code)`（`config.ts`）。`EADDRINUSE` は「別のポートで並行して動かすなら `--state-dir` も分ける」を添える
     （同じ state-dir の 2 つが `session.json`・`auth.json` を互いに上書きする）。`EAI_AGAIN`（名前解決の一時的な失敗）は
     `ENOTFOUND` と同じ案内。`EACCES` は Linux の 1024 未満のポートと Windows の除外ポート範囲（`netsh interface ipv4 show
     excludedportrange protocol=tcp`）を案内する。ホストは `formatUrlHost` で IPv6 を角括弧で囲む。`listening on` の行は
     `wtm: listening on 0.0.0.0 port 8443 (https)` と URL の形をやめる（端末がリンクにして開けない `0.0.0.0` を開かせない。
     この行を解析している箇所は無いことを確かめた）。token 付きの URL は `listen()` の成功後にだけ表示する。
  5. **仮想のブリッジを表示から除く**（許可リストは変えない）：`InterfaceAddress` に `name` を足し、`lanIpv4Addresses` が
     Linux の `docker*`・`br-<12 桁の 16 進>`（docker のユーザー定義ネットワークだけ）・`virbr*`・`veth*`・`cni*`・`podman*`
     （と `lxcbr*`・`lxdbr*`・`vboxnet*`・`vmnet*`）、Windows の Hyper-V の内部スイッチ（`vEthernet (WSL)`・
     `vEthernet (WSL (Hyper-V firewall))`・`vEthernet (Default Switch)`・`vEthernet (nat)`・`vEthernet (DockerNAT)` と
     **完全に一致する名前**）と VirtualBox・VMware のホストオンリー/NAT のアダプタ（`VirtualBox Host-Only Network[ #n]`・
     `VMware Network Adapter VMnet<n>`）を除く。**利用者が名前を付けたものは前方一致で落とさない**：外部スイッチを作ると
     母艦の実際の LAN の IP は物理 NIC ではなく `vEthernet (<スイッチ名>)` に載り、スイッチ名は利用者が付ける（既定は
     `New Virtual Switch`。`WSLBridge`・`WSL-External` のように既知の名前で始まることもある）ので、`External` という名前でも
     前方一致でも見分けられない。`br-lan`・`br-ex` 等も利用者・OpenStack 等が付けるブリッジで、実際の LAN の IP が載りうる
     （T26 の独立点検：以前は `vEthernet (WSL` と `br-` の前方一致で、これらを落としていた）。LAN の IP を表示から落とす害
     （URL を手で組み立て直す）のほうが、内部スイッチを 1 行多く出す害より大きいので、ツールが付ける名前だけを除く。WSL2 の mirrored モードでは
     Windows の仮想アダプタも `eth1` 等で見え、名前では見分けられない（表示に残りうる。docs に書く）。e2e の tls-lan は、
     除外の条件を重ねて持たず、サーバが表示した localhost 以外の最初の URL の IP につなぎ、それがこのマシンの非ループバックの
     IPv4 のどれかであることを確かめる形にした（`WTM_LAN_IP` の上書きと、LAN の IPv4 が無ければ飛ばすのは保つ）。
  6. **角括弧の処理を 1 か所に**：`util/net.ts` の `unbracketHost` を `config.ts`（`--host`）と `formatUrlHost` が使う。
     `config.ts` が先に外すので、`isLoopbackHost` の `"[::1]"`・`isWildcardHost` の `"[::]"` の分岐（到達しない）を消す。
- **理由 / 代替案**:
  - ブラウザが届く宛先を自動で推測する案（portproxy の設定を読む・Windows 側の IP を WSL から引く・逆引き）は、WSL・
    Windows・Tailscale・プロキシごとに別の仕組みが要り、推測が外れると許可リストを広げすぎる（DNS rebinding 対策が崩れる）
    ので退けた。利用者は自分が開く URL を知っているので、それを `--origin` で渡してもらい、表示の先頭に出して確かめられるようにする。
  - bind だけを先に済ませて token の表示を後にする代わりに、「失敗したら作った token を消す」案は、消す前に落ちた場合に残り、
    シェルの起動と `session.json` の上書きも防げないので退けた。
  - `/ws` を受け付けてから hello の応答を復元の完了まで待たせる案は、待たせる仕組み（保留の列）が新しく要るうえ、ブラウザの
    再接続（503 → 間隔を空けて再試行）で同じ効果が得られるので退けた。
- **影響**: `packages/server/src/util/net.ts`（`unbracketHost`・`accessUrls` の `extraOrigins`・`InterfaceAddress.name`・
  仮想ブリッジの除外）・`infra/OsNetworkInfo.ts`・`config.ts`（`listenFailureHint`）・`main.ts`・`composeServer.ts`（起動の順序・
  `freshToken` の getter・`close()`・証明書の `ConfigError`）・`auth/OriginRejectionLog.ts`（`ORIGIN_REJECTED_HINT`・間引き）・
  `http/HttpServer.ts`・`ws/WsServerWs.ts`（ログ・`setReady`）・`smoke.ts`・`packages/e2e/src/support/appServer.ts`・
  `packages/e2e/src/specs/tls-lan.spec.ts`・`docs/tls-setup.md`・`docs/verification.md`、design（「Origin の許可リスト」・
  「起動オプション」・「起動時の表示」と構成の表・「再起動後の復元」・「WSL2」・「エラー処理 / 異常系」）・architecture
  （「6. 起動と再起動後の復元」・`WsServerWs`・`NetworkInfo`）。テスト：`net.test.ts`（`--origin` が先頭・重複の除去・
  仮想ブリッジ）・`OriginPolicy.test.ts`（表示する URL に `--origin` を含む・WSL2 NAT の転送で届く Host は拒否し `--origin`
  で許す）・`config.test.ts`（`listenFailureHint`）・`HttpServer`／`WsGateway` の結合テスト（`origin rejected` の warn）・
  `composeServer.integration.test.ts`（初回の bind の失敗で token を作らない・保存された状態があり bind に失敗してもシェルを
  起動せず `session.json` を書き換えない——どちらも**変更前の順序に戻すと落ちる**ことを確かめた——・証明書を読めない・
  起動の途中の `/ws` は 503・token を作った後の失敗でも `freshToken` を読める）。T26 の独立点検の反映で
  `auth/OriginRejectionLog.ts`（新規。`OriginRejectionLog.test.ts` で時計を差し替えて間引きを確かめる）・
  `session/PersistScheduler.ts`（`cancel()`。`PersistScheduler.test.ts` 新規）も。受け入れ基準は AC10・AC11・AC16・AC18。
- **範囲外で見つけたこと（→ 01 の T27 で修正済み）**: `wtm serve --shell` は `ServeOptions.shell` に入るだけで、`TerminalManager`・
  `SessionService` のどこにも渡されておらず効いていない（新しい pane は常に `ProcessInspector.defaultShell()`＝`$SHELL`）。
  T26 の確認では `--shell /nonexistent` の代わりに `SHELL=/nonexistent` で「token を作った後の失敗」を再現した。
  T26 の独立点検はラウンド2で上限（`maxTaskCheckRounds`=2）に達した。ラウンド2の指摘（`origin rejected` を組を変えて
  書かせ続けられる→全体でも 60 秒に 20 行まで・`--origin` の値もログに添える）は直し、全体の上限は外すと落ちるテストで
  確かめた。残りの確認は 01 の review に委ねる。
  T27：`SessionService` に `shell` を渡し、`spawnForPane` が `TerminalManager.create` へ渡す（`composeServer` が
  `options.shell` を渡す）。単体テスト 2 件（外すと落ちる）と、実物の CLI（`--shell /bin/sh` で pane のプロセスが `/bin/sh`・
  `--shell /nonexistent` で起動に失敗し token を表示）で確かめた。pane の `shell` にも `--shell` の値を記録する（以前は常に
  空文字。復元は保存値を読まず今の `--shell` か OS の既定で起動する——design の `Pane.shell`）。

## D103: 同じ state-dir の二重起動を `wtm.lock` で止める・認証前の不正な入力で error 行を書かせない・作った token を必ず表示する（2026-09-19・01 の review ラウンド6 → 01-server-core）

- **背景**: 01 の review ラウンド6（T26／T27（D102）の最終形の独立レビュー）の 01 の範囲で 6 件。
  1. 認証前の誰でも `GET //`・`///`・`/\` 等（`new URL(req.url, base)` が例外を投げる request-target）を送るだけで、
     `http request failed`／`ws upgrade failed` の error 行を間引きなしで 1 行ずつ書かせられた（D102 が Origin の拒否で
     塞いだのと同じ穴）。実物の CLI で確かめる途中で、同じ形の経路がもう 1 つ見つかった：`%` の並びが壊れた Cookie の値
     （`wtm_session=%E0%A4%A`）で `decodeURIComponent` が投げ、`/api/session`・`/api/logout`・`/ws` の 3 つとも error 行
     （と 500）になった。また、知らないセッションの `POST /api/logout` が 1 回ごとに `auth.json` を書き直していた。
  2. 同じ state-dir の二重起動は、ポートも同じときしか（bind の `EADDRINUSE` で）止まらなかった。docs は手元用 7780・
     LAN 用 8443 で起動させるので、ポート違いの二重起動が起きやすく、その場合は 2 つ目も起動し、全シェルを二重に起動し、
     `session.json`・`auth.json` を互いに上書きし合った（実物の CLI で再現）。design の「同じ state-dir の wtm が既に動いている
     典型に効く」（bind を最初に行う理由。D102）は言い過ぎだった。
  3. 「作った token は必ず一度表示される」（D102）が `listen()` の catch の中でしか保証されておらず、`listen()` の成功後の URL の
     組み立てで投げると token を失った（`--host fe80::…%eth0` で `Invalid URL`。実物の CLI で再現：終了コード 1・auth.json は
     保存済み・token は一度も表示されない）。
  4. e2e の tls-lan は、サーバが LAN の URL を 1 つも表示しないと skip していたので、実際の NIC まで表示から除く退行が skip に
     なって見えなかった。
  5. design「Origin の許可リスト」・エラー表と architecture の `OriginRejectionLog`・§6 が T26 ラウンド2 の最終形（全体の上限・
     `extraOrigins`・`EAI_AGAIN`）に追従していなかった。
  6. Origin の判定 → 記録 → 403 が `HttpServer` と `WsServerWs` で重複し、`originRejections` を省くと `extraOrigins` の無い別の
     `OriginRejectionLog` を黙って作った（間引きの状態も分かれる）。bind の失敗の判定が `main.ts`（`syscall`）と `config.ts`
     （`code`）に割れていた。
- **決定**:
  1. **request-target は `util/net` の純関数 `requestPathname` で解釈する**。origin-form（`/…`）は固定の基底
     （`http://internal.invalid`）に**文字列として連結して**解釈する——`//`・`///`・`/\`・`//foo` は例外にもスキーム相対にも
     ならず、ただの経路（`//`・`//foo` 等。ホストは変わらない）として静的配信（SPA）へ進む。`//evil.example/api/login` は
     `/api/login` ではなく、`//ws` は `/ws` ではない（以前は `new URL(raw, base)` で相対 URL として解決していたので、`//` 等は
     例外、`//x/…` はスキーム相対でホスト `x` の `/…` になっていた）。absolute-form（`http(s)://…`）はその経路。それ以外
     （`*`・authority-form）は `undefined` で、HTTP は 400、upgrade は `HTTP/1.1 400 Bad Request` を書いて閉じ、**ログに書かない**
     （誰でも送れる入力の誤り）。壊れた Cookie の値はセッション無し（401）として扱う。知らないセッションの logout では
     `auth.json` を書き直さない。それでも残る想定外の失敗の error 行（`http request failed`・`ws upgrade failed`）は新しい
     `log/LogThrottle`（60 秒に 20 行。超えた件数は次の行の `suppressed`。時計は単調な `performance.now()`）で間引く。
     `OriginRejectionLog` の全体の上限も同じ `LogThrottle` で数え、組ごとの間隔も同じ単調な時計で測る。
  2. **状態ディレクトリの排他のロック `<状態ディレクトリ>/wtm.lock`（`persist/StateDirLock`）**。中身は pid とホスト名
     （`os.hostname()`）の 2 行。`listen()` の最初（auth.json の読み込み・bind・token・復元より前）に `wx` で作る。**auth.json は
     ロックを取ってから読む**（組み立ての時点では読まない）。既にあれば中身を見て、使用中なら `StateDirInUseError` →
     `composeServer` が `ConfigError`（`config.ts` の `stateDirInUseError`。終了コード 2。使っている pid（とホスト）・別の
     `--state-dir` を指定する案内・ロックを消してよい場合の案内）にする。使用中とみなすのは：
     - **ホスト名が自分と違う**：別のマシン（共有のディレクトリ）か別のコンテナ（ボリュームの共有）で、pid 名前空間が違い
       生死を確かめられない（どちらも pid 1 のこともある）。落ちて残ったものなら案内のとおり消してもらう。
     - 自分と同じ pid：このプロセスが持っているとき（テストで同じ状態ディレクトリに 2 つ組み立てた）だけ。持っていなければ
       前に同じホスト・同じ pid で動いて落ちたプロセスの残りとして取り直す（同じコンテナの再起動で毎回 pid 1 等になる）。
     - それ以外：pid が生きている（`process.kill(pid, 0)`。`EPERM` も生きている）。
     ホスト名の無い pid だけのロック（この決定の最初の形）は同じホストのものとして扱う。使用中でなければ（落ちて残った
     ロック）消して取り直す。中身を読めない（pid を書く前に落ちた）ロックは少し待って読み直し、読めなければ取り直す。
     `release` は自分の pid とホスト名が書かれているときだけ消し、**失敗しても投げない**（warn を書くだけ）。`close()` の最後
     （`session.json` を書き終えてから。途中で失敗しても）と、失敗した `listen()`（復元前の保存の予約を取り消してから）で放す。
     `main` の終了のシグナル（SIGINT・SIGTERM・SIGHUP。`listen()` の前から受け付ける）の経路は `close()` を通る。落ちて残った
     ロックは pid を見て取り直すので、消し損ねてもよい。`EADDRINUSE` の案内から「同じ --state-dir の wtm が既に動いていないか
     確かめる」を外した（その場合は bind の前にロックで断るので）。
  3. **`wtm token reset` もロックを取る**（動いていれば終了コード 2 で断り、`wtm serve` を止めてから実行するよう案内する）。
     動いている `wtm serve` は token とセッションをメモリに持ったまま `auth.json` を読み直さないので、動いている間に書き換えると
     新しい token は受け付けられず、次のログイン・ログアウト・セッションの延長の保存で `auth.json` が古い token に書き戻される。
     「止めてから実行」が正しく動く唯一の手順なので、それを強制するだけにした（単純さを優先）。design の「接続中の失効
     （`wtm token reset`）で 4401」は起きなくなるので design を直した。
  4. **作った token を必ず一度表示する**：`main` は `listen()` から起動の表示までを 1 つの try で囲み、catch（`close()` を待つ前）
     と finally で「まだ表示していなければ token を表示する」。起動の途中で終了のシグナルを受けたときも表示する（下記 T28 #4）。表示の行は純関数 `startupLines`（新しい `startupBanner.ts`）で先に
     全部組み立て、組み立てに失敗したら token を表示し、待ち受けたまま・ロックを持ったまま終わらないよう `close()` してから
     投げる。**ゾーン付きの IPv6 は URL にしない**（`accessUrls` は `new URL` できないものを並べず、例外を投げない）。WHATWG URL は
     ゾーン識別子を受け付けず、RFC 6874 の `%25` の形（`https://[fe80::1%25eth0]:8443`）も `Invalid URL` になることを確かめた
     （ブラウザでも開けない）ので、`%`→`%25` の案は採れない。URL が 1 つも無ければ「`--origin` で渡せば表示する」と
     `wtm: token（今回作成）: <token>` を表示する。
  5. e2e の tls-lan は、表示されるべき LAN の IPv4 を**サーバ自身の純関数 `lanIpv4Addresses`**（`@wtm/server` の testkit から
     公開。条件を重ねて持たない）でこのマシンのインタフェースから求め、それがあるのに表示が一致しない（1 つも無い・落とした・
     別のものを出した）なら失敗にする（比べる値は、サーバの出力を受けた直後にインタフェースを列挙し直して求める）。skip は
     表示されるべきものが本当に無いときだけ。`WTM_LAN_IP` の上書きは保つ。
     純関数そのものの退行（条件の誤り）は e2e では両側が同じ関数なので見えず、`net.test.ts` の単体テストが受け持つ。
  6. **Origin の判定 → 記録 → 403 を `OriginRejectionLog.admit(r, deny)` の 1 か所に**。`HttpServer`・`WsServerWs` は
     `OriginPolicy` の代わりに `OriginRejectionLog`（`OriginPolicy` を持つ）を**必須の引数**で受け取る（省けないので別の実体を
     作れない）。**bind の失敗の判定を `config.ts` に集める**：`isBindFailure`（`syscall` が `listen`・`bind`・`getaddrinfo`）を
     `main.ts` から移し、`listenFailureHint(code)` と合わせた `bindFailureHint(err)` を `main` が使う。
- **付随して直したこと**（実物の CLI の確認で発見）: `wtm token reset` が一度も動いていなかった——`parseArgs` がサブコマンドの
  語 `reset` もオプションとして読み、`unknown option: reset`（終了コード 2）で終わっていた。`parseArgs` を `cliArgs.ts` に分けて
  （`main.ts` は読み込むと起動するので単体テストできない）、オプションとサブコマンドの語を分けて読む（下記 T28 #6）。
- **T28 の独立点検（8 件）の反映**（2026-09-19。上の決定はこの反映後の最終形）:
  1. [should] 組み立て（`composeServer()`）が `auth.initialize()` で auth.json を読んでから `listen()` がロックを取っていたので、
     その間に `wtm token reset` が走ると、serve は古い token をメモリに持ったまま起動し、新しい token を 401 で拒み、古い token を
     受け付け、次のログインで auth.json を古い token に書き戻した（dist で再現）。→ `auth.initialize()` を `listen()` のロックの
     直後へ移した。結合テスト（組み立てと `listen()` の間に作り直す）と、実物の CLI（ロックの取得を 3 秒遅らせる preload で
     窓を広げ、その間に `token reset`：直す前は新しい token 401・古い token 204・auth.json は古い token に戻る／直した後は
     新しい token 204・古い token 401・auth.json は新しい token）で確かめた。
  2. [nit] 「同じ pid で自分が持っていないロックは古い」が pid 名前空間をまたぐと誤る（ボリュームを共有する 2 つのコンテナが
     どちらも pid 1）。→ ロックにホスト名を書き、違えば使用中とみなす（上記 2）。同じ理由で、ホスト名が違えば pid が違っても
     生死を確かめない（こちらの名前空間では死んで見えても、相手の名前空間では生きているかもしれない）。pid だけの古い形は
     同じホストとみなす。コンテナを作り直すとホスト名が変わるので、落ちて残ったロックはそのとき手で消す（案内に出す）。
     boot id はコンテナどうしで共有される（カーネルの値）ので見分けに使えず、採らなかった。
  3. [nit] `release()` が `ENOENT` 以外の unlink の失敗（Windows のウイルス対策・インデクサの `EPERM`/`EBUSY`）を投げ直し、
     `listen()` の catch では元の bind の失敗（終了コード 2 と案内）を隠して終了コード 1 にし、`close()` では正常な終了を終了
     コード 1 にしていた。→ 投げずに warn を書く（残ったロックは pid を見て取り直せる）。
  4. [nit] SIGINT/SIGTERM を起動の表示の後に受け付けており、SIGHUP はどこでも受けていなかった。復元の途中で受けると即座に
     終わり、作った token を表示せず、ロックを残した（実物の CLI で再現：終了コード 143・token の表示なし・ロックが残る）。→
     SIGINT・SIGTERM・SIGHUP を `listen()` の前に受け付け、起動の途中なら token を表示し、その段（復元等）を終えてから `close()`
     して終わる（`close()` と `listen()` を並行させない。もう一度受けたら待たずに終わる）。SIGHUP は `nohup` の下で無視されて
     いるなら付けない案も検討したが、**Node は起動時にシグナルの扱いを既定に戻すので `nohup` の下でも SIGHUP で終わっていた**
     （実測：終了コード 129）ので、常に受けて閉じて終わる。端末を閉じても動かし続けるなら `setsid`・tmux・systemd 等を使う。
  5. [nit] `requestPathname` が `//foo` を 400 にしていた（利用者が `https://host//foo` と打つとブラウザは `//foo` を送る。
     以前は SPA を返していた）。→ origin-form は基底に文字列として連結して解釈する（上記 1）。`//ws` は `/ws` ではないことも
     結合テストで確かめた。
  6. [nit] `cliArgs`：未知のコマンド・サブコマンド（`wtm token rest`）が help（終了コード 0）になっていた・
     `wtm token --state-dir D reset` が動かなかった・`token reset` が serve のオプション（`--host` 等）を黙って受け付けていた。→
     どれも `ConfigError`（終了コード 2・使い方つき）。オプションとサブコマンドの語の順は問わない。help はコマンドが無い・
     `help`・`--help`・`-h` のときだけ。
  7. [nit] e2e の tls-lan が、読み込み時に列挙したインタフェースとサーバの後の列挙を比べていた。→ サーバの出力を受けた直後に
     列挙し直して比べる。
  8. [nit] `LogThrottle` と `OriginRejectionLog` の既定の時計が `Date.now`（壁時計は戻りうり、戻ると窓が終わらない）。→ 単調な
     `performance.now()` を既定にし、差し替えは残した。同じ種類の `LoginRateLimiter`（`Date.now`）はこの点検の範囲外として
     残した（01 の review に委ねる）。
- **理由 / 代替案**:
  - ロックを OS のファイルロック（`flock`・`LockFileEx`）にする案は、Node の標準に無く（ネイティブのモジュールが要る）、
    WSL の `/mnt/c` 等のファイルシステムで挙動が変わるので退けた。pid を書く方式は、落ちたプロセスの残りを pid で見分けられ、
    消し損ねても次の起動が取り直せる。pid の再利用（別のプロセスが同じ pid）は見分けられないので、案内でロックを消すよう伝える。
    古いロックを 2 つの起動が同時に取り直す競合（起動がミリ秒単位で重なったときだけ）は扱わない。
  - ロックを `composeServer()`（組み立て）で取る案は、組み立てだけして `listen()` しない使い方（テスト・smoke）で残り、また
    組み立ての失敗（証明書）で放す経路が増えるので、`listen()` の最初にした。そのぶん組み立ては状態のファイルを読みも書きも
    しない（`server.log` に追記するだけ。auth.json はロックの後に読む——T28 #1）。
  - 不正な request-target を warn で間引いて書く案は、利用者が直せるものではなく（相手の入力の誤り）、書く価値が無いので、
    書かずに 400 にした。`//` 等を 400 にする案（この決定の最初の形）は、ブラウザが実際に送る `//foo` を拒むので退けた（T28 #5）。
  - `token reset` を動いている間にも許し、サーバ側で `auth.json` の変更を監視して読み直す案は、監視の仕組みと、読み直しと
    サーバ自身の書き込みの競合の扱いが新しく要るので退けた（MVP では「止めてから」で足りる）。
- **影響**: `packages/server/src/persist/StateDirLock.ts`（新規）・`log/LogThrottle.ts`（新規）・`startupBanner.ts`（新規）・
  `cliArgs.ts`（新規。`main.ts` から移動）・`util/net.ts`（`requestPathname`・`accessUrls`）・`auth/OriginRejectionLog.ts`（`admit`・
  `LogThrottle`）・`auth/AuthService.ts`（Cookie の解釈・logout）・`http/HttpServer.ts`・`ws/WsServerWs.ts`・`composeServer.ts`
  （ロック）・`config.ts`（`isBindFailure`・`bindFailureHint`・`stateDirInUseError`・`EADDRINUSE` の案内）・`main.ts`・
  `testkit.ts`（`lanIpv4Addresses` の公開）・`packages/e2e/src/specs/tls-lan.spec.ts`、design（「Origin の許可リスト」・「HTTP」・
  「永続化の形式」・「起動オプション」・「起動時の表示」・「再起動後の復元」・「エラー処理 / 異常系」）・architecture（`main.ts`・
  `config.ts`・`HttpServer`・`WsServerWs`・`AuthService`・`OriginRejectionLog`・`StateDirLock`・`util/net`・`LogThrottle`・
  「6. 起動と再起動後の復元」）。テスト：`StateDirLock.test.ts`・`LogThrottle.test.ts`・`startupBanner.test.ts`・`cliArgs.test.ts`
  （新規）、`net.test.ts`（`requestPathname`・ゾーン付きの IPv6）・`OriginRejectionLog.test.ts`（`admit`）・`AuthService.test.ts`
  （壊れた Cookie・知らないセッションの logout）・`config.test.ts`（`bindFailureHint`・`stateDirInUseError`）・`HttpServer` の結合
  テスト（`node:net` で生の `//`・`///`・`/\`・`//host/…` を送り 400 でログが空・壊れた Cookie・500 の error 行の間引き）・
  `WsGateway` の結合テスト（生の upgrade で 400・壊れた Cookie で 401、どちらも error 行なし）・`composeServer.integration.test.ts`
  （同じ state-dir・違うポートの 2 つ目は `ConfigError` で、シェルを起動せず `session.json`・`auth.json` の中身も mtime も
  変えない・1 つ目を閉じれば起動できる／`listen()` の失敗でロックを放す／組み立てと `listen()` の間の token reset）。T28 の反映で
  `StateDirLock.test.ts`（ホスト名・pid だけの古い形・消せなくても投げない）・`cliArgs.test.ts`（未知のコマンド・サブコマンド・
  語の順・serve のオプション）・`LogThrottle.test.ts`／`OriginRejectionLog.test.ts`（壁時計が戻っても単調な時計で数える）・
  `net.test.ts`／`HttpServer`／`WsGateway` の結合テスト（`//`・`/\`・`//foo` は SPA・`//ws` は `/ws` ではない・`*` は 400）も。
  どれも修正を外すと落ちることを確かめた（#4 は実物の CLI で、SIGTERM・SIGHUP・SIGINT を復元の途中で送り、token の表示・
  終了コード 0・ロックが残らないことを確かめた。直す前の位置に戻すと終了コード 143・token の表示なし・ロックが残る）。
  docs（`docs/`）の追従は 05 の範囲で、ここでは触らない（`--state-dir` を分ける案内・`token reset` は止めてから・端末を閉じると
  SIGHUP で閉じて終わる（動かし続けるなら `setsid`・tmux・systemd 等）・別のホスト／作り直したコンテナのロックは手で消す、等）。
  受け入れ基準は AC10・AC11・AC18。
- **進め方の判断（主エージェント）**: 01 の review はこのラウンド6で 4 回目の差し戻し（`maxSendBacks`=3 を超える）。ただし
  ラウンド5の 9 件はすべて解消しており、ラウンド6の指摘は**同じ失敗の繰り返しではなく**、レビューの範囲を広げたことで見えた
  以前からの別の穴（request-target・state-dir の二重起動・token reset・Cookie）だったので、原因究明（`aidev debug` の
  ラウンド2）は使わなかった。「同じコンテキストで回し続けない」の趣旨は守り、修正は新しい実装コンテキストに任せた。
  05（docs）・03（ログイン画面の文言）が持ち主の指摘は、親の test-result.md「持ち越し」に記録し、統合 test／統合 review で戻す。

## D104: E2E の spec を 1 つずつ走らせる（`workers: 1`）・ブラウザ側の反映を画面で確かめてから操作する・docs を D100〜D103 と実際の構成に合わせる（2026-09-19・親の統合 test ラウンド4 → 05-e2e-docs T13・T14）

- **背景**:
  1. 既定の起動方法 `pnpm --filter @wtm/e2e test`（`fullyParallel: true`・ワーカー数の指定なし）は、12 CPU のこの検証環境で
     6 ワーカーになり、大量出力（`yes`）を流す性能計測の spec が他の spec と同時に走って落ちた（親の統合 test ラウンド4 で 9 failed。
     T13 の着手時のやり直しでも 10 failed / 25 passed）。計測値も汚れる（1 文字の往復の p95：並列で 146ms、1 つずつで 9ms）。
  2. **性能計測の spec を除いても、並列では毎回落ちた**（6 ワーカーで 2 回：3 failed・8 failed。vim・top・pane・workspace・
     agent-detection・multi-client 等の時間切れ）。どの spec も実物のサーバ（PTY・シェル）と、ソフトウェアの GL で描く Chromium を
     1 組ずつ動かすので CPU を取り合い、キー入力・描画・判定の周期が遅れる。05 の以前の記録の「並列時の間欠的な失敗」もこれ。
  3. `workspace-tab-pane.spec.ts` の pane の test の巡回の段：入れ替え（`prefix+J`）の完了を**テスト自身の WebSocket クライアント**の
     `layout.updated` で判定してすぐ `prefix+Tab` を押していた。巡回はブラウザが持つレイアウトの並びで次の pane を決めて先に焦点を
     移す（`ActionDispatcher.cyclePane`。D97）ので、ブラウザが入れ替えを反映する前に押すと p1 ではなく p3 へ移り、打った文字が p3 に
     入る（01 の T28 の test で 1 回落ちた）。
  4. docs（`docs/tls-setup.md`・`docs/verification.md`）が D100〜D103 と実際の構成に追従していなかった（親の test-result.md
     「持ち越し」の 05（docs））。
- **決定**:
  1. **`packages/e2e/playwright.config.ts` を `workers: 1` にする**（`fullyParallel: true` は 1 ワーカーでは意味が無いので外した）。
     性能計測も他の spec と重ならない。全体で約 3 分。**ルートの `package.json` に E2E の入口は足さない**（既存の
     `pnpm --filter @wtm/e2e test` が docs と CI の基準で、入口を増やすと docs が割れる。既存のスクリプトは変えていない）。
  2. **ブラウザが持つ状態に依存する操作の前に、ブラウザ側に反映されたことをブラウザから確かめる**
     （`packages/e2e/src/support/panes.ts`）。製品の DOM に pane の id は出ていないので、2 つの窓を使い分ける：
     - `watchShownPanes`：ブラウザ自身が送る `client.view`（描いた pane の id）を CDP で読む。新しい workspace・分割で
       「新しい pane へ表示が切り替わった」ことは「新しい pane が含まれる」で待つ（新しい pane は応答の中の表示の切り替えまで
       描かれず、同じ処理で焦点の移動と D99 の入力の関所の解放も済む）。pane の id そのものなので要素の作り直しに影響されない。
     - `markFocusedPane`・`shownPanes`：xterm.js の要素（`TerminalRegistry` が pane ごとに使い回し、レイアウトが変わると付け直す
       `.terminal-pane-mount` の子）にテストが印（`data-e2e-pane`）を付け、DOM の順（＝深さ優先の順。`PaneLayout.vue`）で読む。
       `client.view` の並びは DOM の順ではないので、**並び**だけはこちらで見る。全部に印の付いた並びを待つので、要素が
       作り直されれば一致せず時間切れで落ちる（誤って通らない）。最初の形は「印の無い pane」を待つ形（`["?"]`）も使って
       いたが、作り直された古い pane（モバイルの LRU の追い出し・製品の変更）でも通ってしまうので、独立点検の指摘でやめた。
     - `focusedPaneIndex`：焦点のある pane の DOM の順の位置（印を使わない）。
     「テストのクライアントのイベントを待ってから、ブラウザ側の状態に依存する操作をする」同じ形の箇所をすべて直した：
     - `workspace-tab-pane.spec.ts` の pane の test：入れ替えの後、画面の並びが `[p1,p3,p2]` になるのを待ってから巡回する
       （入れ替えの前に `[p1,p2,p3]` であることも確かめる）。
     - 同 workspace の test：`prefix+N` の後、ブラウザの `client.view` に新しい pane が含まれるのを待ってから端末をクリックする
       （切り替わる前にクリックすると p1 を押す）。
     - `keys-mouse-dialogs.spec.ts` の goto の test：同じく新しい workspace の pane（p2）が `client.view` に含まれるのを待ってから
       goto を開く。goto の一覧は今の pane の行から選び始めるので、以前は始まる行が決まらず「p1 か p2 のどちらかに届けばよい」と
       していた——p2 に届く場合は何も切り替えておらず、goto で移れることの確認になっていなかった。p1 に名前（`goto-target`）を
       付け、選択が「現在地」（p2）の行から始まること・`ArrowUp` 3 回の後に選んでいる行が p1 の pane の行であることを Enter の
       前に確かめ、p1 に届く（p2 に届かない）ことを確かめる形に強めた（選択は先頭で止まり、workspace・tab の行で Enter しても
       p1 へ移るので、Enter の前に確かめないと最初の選択の位置が崩れても通る。独立点検の指摘）。
     - `mobile.spec.ts`：分割の後、`client.view` に p2 が含まれるのを待ってから端末をクリックする。
     - `terminal-app.spec.ts` の pane のサイズの test（独立点検の指摘で追加）：分割の後に待っていた `pane.size_changed` は、
       ブラウザが分割後のレイアウトを描いて送った `client.view` から来るもので、ブラウザが分割の**応答**（p2 へ焦点を移し、
       入力の関所を解放する）を処理したことまでは意味しない。その前に p1 をクリックして `tput cols` を打つと、後から来る応答で
       焦点が p2 へ移り、関所に溜まった入力も p2 へ流れる。焦点が p2（DOM の順で 2 番目）へ移ったこと（`focusedPaneIndex`）を
       待ってからクリックする。
     **見送ったもの**：copy モードで端末の中身を読む spec（`scrollback-copy.spec.ts`・`reconnect-restore.spec.ts` の AC8）も、
     テストのクライアントで出力の到着を確かめた後に、ブラウザの xterm.js の中身に依存して操作する（固定の 300ms 待ち）。
     WebGL で描くので中身を DOM から読めず、画面から反映を確かめる窓が無い。1 つずつ走らせる形では通っているので直さない。
     `agent-detection.spec.ts` の行のクリックは、確かめるのがサーバの `session.focus_changed` だけでブラウザ側の状態に依存しない。
  3. **docs**：
     - `wtm` は PATH に無い（`@wtm/server` は private のワークスペースのパッケージ）：実際の起動 `node packages/server/dist/main.js
       serve …`（使い方は `… --help`。`serve --help` は未知のオプションで終了コード 2）を示し、両 docs の冒頭で「docs の `wtm` は
       その略」と定義して、bash の alias と PowerShell の関数を添えた。例はすべて `wtm` にそろえ、alias の効かない `setsid` の例だけ
       フルパス。
     - ファイアウォールを構成ごとに（`docs/tls-setup.md`「手順4」）：Linux（ufw・firewalld）・WSL2 の mirrored（Hyper-V
       ファイアウォール。`New-NetFirewallHyperVRule … -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'`、または
       `Set-NetFirewallHyperVVMSetting … -DefaultInboundAction Allow`。通常の `New-NetFirewallRule` では開かない）・WSL2 の
       NAT＋portproxy（portproxy は Windows 側で待ち受けるので通常の規則。既存の規則は正しく、`-Profile Private` を足した）・
       Windows ネイティブ（node.exe の許可のダイアログ・ブロックの規則が許可より優先されること・ネットワークのプロファイル）。
     - Tailscale の鍵の権限：`sudo tailscale cert` の鍵は root の 0600 で、一般ユーザーの `wtm serve --key` は `cannot read --key`
       （終了コード 2）。`sudo tailscale set --operator=$USER` の後に sudo なしで `tailscale cert`、または `sudo chown`。
     - AC11 を 3 環境それぞれに（`docs/verification.md`「別のマシンからの TLS 接続（AC11）」）：共通の準備・Linux・WSL2
       （mirrored／NAT＋portproxy）・Windows ネイティブ・共通の AC1〜AC9 の一巡を、チェックボックスと期待する結果つきで。
       独立点検の指摘で：起動はどの環境も LAN 用の専用の状態ディレクトリ（`~/.local/state/wtm-lan`・
       `$env:LOCALAPPDATA\wtm-lan`）と証明書の置き場所（`~/wtm-cert`・`$HOME\wtm-cert`）を明示してそろえ、Windows ネイティブも
       `wtm`（PowerShell の関数）で書く。token 付きの URL はその状態ディレクトリで初めての起動の 1 回だけなので、期待する結果に
       「2 回目以降はログイン画面に控えた token を入れる（無ければ止めて `wtm token reset --state-dir …`）」を書いた（手元の確認の
       項目も同じ）。WSL2 で母艦のブラウザにも CA を入れることも書いた。
     - mkcert の CA を別のマシンに入れる方法（`docs/tls-setup.md`「手順1」）：渡すのは `rootCA.pem` だけ・PC は
       `CAROOT` を指定して `mkcert -install`（mkcert の README）・Firefox は独自のストア・iOS はプロファイルを入れて
       「証明書信頼設定」でオン・Android は利用者の CA。
     - 独立点検の指摘で直した誤り：WSL2 も ConPTY を通ると書いていた（WSL2 のサーバは Linux として Unix の PTY を使う。ConPTY は
       Windows ネイティブだけ）・母艦の LAN の IP の例が 192.168.1.50 と 192.168.1.20 で割れていた（192.168.1.50 にそろえ、SAN と
       `--origin` が一致する）・node.exe の規則の一覧が nvm-windows・volta・fnm のシムでは何も出ない場合の代わり
       （`Get-NetFirewallApplicationFilter -All` を `node.exe` で絞る・`Get-Process node` の Path・GUI の「プログラム」列）。
     - リバースプロキシ（`docs/tls-setup.md`「リバースプロキシの後ろに置く」）：ルートのパスで公開（`/api`・`/ws`・`/assets` が
       絶対パス・Cookie が `Path=/`）・`/ws` の Upgrade の転送・`--origin`・ログインの失敗の制限（接続元の IP ごとに 1 分に 5 回・
       1 時間に 20 回。`LoginRateLimiter.ts`）をプロキシ・portproxy の後ろの全員で共有・wtm は ping を送らないので無通信の
       タイムアウトを長く。nginx の例。
     - D102・D103 の振る舞い（`docs/tls-setup.md`「起動と運用の注意」、`docs/verification.md`「前提」から参照）：起動時の表示
       （`wtm: listening on 0.0.0.0 port 8443 (https)`・`--origin` が先頭の `wtm: open` の行・URL を作れないときの token の行）・
       手元用と LAN 用は `--state-dir` を分ける（同じ state-dir の 2 つ目は `wtm.lock` で止まる）・`wtm token reset` は serve を
       止めてから（動いている間は断る。今は動く）・端末を閉じると SIGHUP で終わる（`nohup` でも。tmux・`setsid`・systemd）・
       別のホスト／作り直したコンテナの `wtm.lock` は手で消す。
     - 壊れていた参照を直した：`docs/verification.md` の design「新規 pane の既定シェル」（無い）→「起動オプション（`wtm serve`）」、
       design「pane の cwd」→「再起動後の復元」の「pane の cwd」。`playwright.config.ts` のコメントの `support/server.ts`（無い）→
       `support/fixtures.ts`。
- **理由 / 代替案**:
  - Playwright の projects で「機能」（並列）と「性能」（`dependencies` で後から 1 つで）に分ける案は、性能計測は分離できるが、
    機能の spec 同士の並列でも落ちる（背景 2）ので足りない。ワーカー数を 2〜3 に絞る案は、CPU の少ない・混んだマシン
    （この検証環境もソフトウェアの GL・負荷 3〜5）でどこまで絞れば足りるかが決まらない。1 つずつなら約 3 分で、単純で、
    どのマシンでも同じ条件になる。`--workers` で増やすと、どちらも崩れることを `playwright.config.ts` に書いた。
  - ブラウザの Vue・Pinia の内部（`__vue_app__`）からレイアウトを読む案は、製品の内部の構造に依存するので退けた。固定の時間を
    待つ案は、遅いマシンでは足りず速いマシンでは無駄なので退けた。
  - docs の Tailscale・Windows・PowerShell・Hyper-V ファイアウォール・iOS／Android の CA の入れ方は、この検証環境（Linux。
    Tailscale・Windows・実機無し）では実行できないので、公式 docs の形に合わせ、未確認である旨と公式 docs への参照を添えた。
  - 新しい pane への切り替えを `client.view` が「新しい pane **だけ**」になることで待つ案は、下の「範囲外で見つけたこと」の
    不具合で成り立たない（古い pane が 1×1 で残る）ので「含まれる」で待つ。直ったあとも「含まれる」のまま通る。
- **確かめたこと**: 既定の起動方法を 2 回：どちらも 35 passed・終了コード 0（3.3 分・3.1 分）。直した pane の test を
  `--workers=1 --repeat-each=5` で 5 passed。負の対照：一時の spec でブラウザへのメッセージだけを順序を保って 1.5 秒遅らせ、
  待ちの無い形は 2 回とも巡回の文字が p3 に入って落ち、待つ形は 2 回とも p1 に入って通った（一時の spec は消した）。
  独立点検の指摘の反映の後：直した 5 つの test（workspace・pane・goto・mobile・terminal-app のサイズ）を `--repeat-each=3` で
  15 passed、既定の起動方法を 1 回。terminal-app の負の対照：一時の spec でブラウザへの**応答**だけを 1.5 秒遅らせ、
  焦点の移動を待たない形は 2 回とも p1 をクリックして打った文字が p2 に入って落ち、待つ形は 2 回とも p1 に入って通った。
  docs の AC11 の Linux の手順（`~/wtm-cert`・`--state-dir ~/.local/state/wtm-lan`。HOME を一時のディレクトリにして実行）で、
  初回の起動は `#token=…` 付き・2 回目は `#token=` 無しと「token を忘れた場合は…」・動作中の `token reset --state-dir …` は
  終了コード 2・止めた後は 0 になることを確かめた。
  docs のうちこのマシンで動くものは実際に動かした：`--help`・証明書なしの拒否・初回／2 回目の起動の表示・同じ state-dir の
  2 つ目（終了コード 2）・動作中の `token reset`（終了コード 2）と停止後（0）・読めない `--key`（終了コード 2）・別のホストの
  `wtm.lock`（終了コード 2。消せば起動）・端末（pty）を閉じると SIGHUP で閉じて終わる（`nohup` でも）・docs の形の `setsid` は
  端末を閉じても残り SIGTERM で止まる・tmux・alias。nginx の例は docker の nginx で動かし、`nginx -t` が通り、ログイン 204・
  `/ws` の hello まで通ること、`/ws` の節を外すと WebSocket がつながらない（HTTP 200）こと、`--origin` を外すと 403 と
  `origin rejected`、token を 5 回誤ると正しい token も 429 になることを確かめた。
- **影響**: `packages/e2e/playwright.config.ts`・`packages/e2e/src/support/panes.ts`（新規）・`packages/e2e/src/specs/`
  （`workspace-tab-pane.spec.ts`・`keys-mouse-dialogs.spec.ts`・`mobile.spec.ts`・`terminal-app.spec.ts`・`performance.spec.ts` の
  コメント）・
  `docs/tls-setup.md`・`docs/verification.md`。製品のコード（`packages/server/src`・`packages/web/src`）は変えていない。
  受け入れ基準は AC11・AC16・AC17。
- **範囲外で見つけたこと（製品の不具合。03（Web）の範囲。ここでは直さず、親へ報告）**: `PaneLayout.vue` の単一 pane の葉の
  `:ref="(el) => setLeafEl(singlePaneId!, el)"` は、外すとき（`el` が null）の呼び出しでも**その時点の** `singlePaneId`（もう新しい
  pane の id）を読むので、表示から外れた pane の登録（`ownLeaves`）が消えず、切り離された要素のまま残る。`ViewSync.commit` は
  その要素の大きさ 0 から `cols: 1, rows: 1` を求めて `client.view` に載せ続ける。実測（一時の spec。消した）：
  - デスクトップで新しい workspace へ切り替えると `{"workspaceId":"w2","tabId":"t2","visible":[{"paneId":"p1","cols":1,"rows":1},{"paneId":"p2",…}]}`。
    p1 は別の tab なのでサーバは大きさに使わない（`SizeAuthority.applyOwnerSize` が tab で絞る）。
  - **モバイルで分割（表示する pane の切り替え）すると、同じ tab の p1 が 1×1 のまま載り、サイズ権限を持つモバイルのブラウザの
    `client.view` でサーバが p1 の PTY を 1×1 に resize する**（`client.hello` の p1：53×24 → 1×1）。隠れた pane の TUI・
    エージェントの画面が 1 桁に折り返され、ミラーの画面もその大きさになる（表示し直せば戻る）。D86 の `:key` の修正は
    インスタンスの取り違えを直したが、この登録の残りは直っていなかった。

## D105: 表示から外れた pane の登録を、その葉を描いたときの pane と要素で外す・ログインの失敗を理由ごとに示す（2026-09-19・親の統合 test ラウンド5 → 03-web-desktop T31・T32。同日、独立点検の T32 の 4 件と「接続中…」の表示を反映）

- **背景**:
  1. （T31。05 の T13 の作業中に発見・D104「範囲外で見つけたこと」）`PaneLayout.vue` の単一 pane の葉は
     `:ref="(el) => setLeafEl(singlePaneId!, el)"` だった。表示する pane が変わると（モバイルの切り替え・zoom の対象の変更・
     デスクトップの tab／workspace の切り替え・分割の中の子の pane の変更）、`:key` が変わって古い葉が外れ、Vue は**最後に描いた回の**
     関数 ref を `null` で呼ぶ。その関数は `singlePaneId`（computed）を呼ばれた時点で読むので、既に新しい pane の id になっており、
     古い pane の登録が `ownLeaves` に残る。切り離された要素の大きさ 0 から `ViewSync.commit` が `cols:1, rows:1` を求め、
     `client.view` に載せ続ける。同じ tab のまま隠れた pane が残るモバイル（最初に `client.view` を送ってサイズ権限を持つ）では、
     サーバがその pane の PTY を 1×1 に縮める（実測 53×24 → 1×1。隠れた TUI・エージェントの画面が 1 桁で折り返す）。デスクトップの
     tab／workspace の切り替えでは、残るのは別の tab の pane なのでサーバは使わない（`SizeAuthority.applyOwnerSize` が tab で絞る）
     が、送る中身は誤っていた。D86 の `:key` の修正はインスタンスの取り違えを直したが、この登録の残りは直っていなかった。
     **［D106 の注記］**「最初に `client.view` を送ってサイズ権限を持つ」は、当時のサーバの振る舞い（fit していないモバイルにも
     権限を渡す `SizeAuthority.onViewChanged`）の記述で、それ自体が D13 に反する不具合だった。D106 で直した後は、この 1×1 の
     縮みは「この端末に合わせる」（`client.fit`）を有効にしたモバイルで起きる。E2E（`mobile.spec.ts` の D105 の test）も
     fit を押して権限を取らせる形に D106 で直した。
  2. （T32。01 の review ラウンド5）`Connection.login` が 204 以外を全て `false` にし、`LoginView` が 401（token の誤り）・
     403（Origin／Host の不一致）・429（失敗の続きすぎ）・通信の失敗を同じ「ログインできませんでした」で出していた。403 の利用者は
     token が違うと思い込み `wtm token reset` へ進んでしまう（直すべきは `wtm serve --origin <その Origin>`。サーバのログの
     `origin rejected` の hint と同じ）。
- **決定**:
  1. **葉の関数 ref を、描いた時点の paneId に結び付けて作る**（`leafRef(paneId)`。テンプレートは `:ref="leafRef(singlePaneId)"`）。
     引数はその回の描画で決まった値なので、外すときも「その葉の pane」を外せる。`null` には要素が無いので、付けたときの要素を
     関数の中に覚えておき、外すときに渡す。
     - 登録の口は `registerLeaf(paneId, el, attached)` にし、**解除は、今その paneId に登録されている要素が `el` のときだけ効く**
       ようにした。子どうしで pane が入れ替わる（`J`）と、新しい葉（子 A の p2）の登録が古い葉（子 B の p2）の解除より先に届く。
       paneId だけで消すと、付いたばかりの p2 を消してしまう（単体テストで確認：素朴に paneId だけで外す形は入れ替えの test が落ちる。
       修正前のコードは「その時点の id を読む」誤りのおかげで入れ替えだけはたまたま正しかった）。
     - 子の PaneLayout（分割の中）も同じ葉のテンプレートを使うので、同じ直しで済む。root の `onBeforeUnmount` は `ownLeaves` を空にする。
  2. **`login` は小さな判別可能な結果を返す**（`net/ports.ts` の `LoginResult`：`{ok:true}`／`bad_token`（401）／`origin_rejected`
     （403）／`rate_limited`（429。`retryAfterSeconds`）／`http_error`（それ以外。`status`）／`network_error`（fetch 自体の失敗））。
     reject しない。`InputGate` は素通し。**wtm 自身は `Retry-After` を付けない**（`HttpServer.handleLogin`・`LoginRateLimiter`）ので、
     値が入るのは前段のプロキシ等が付けた場合だけ。読み方は `net/retryAfter.ts`（`Connection.login` と `LoginView` が同じ規則を使う）：
     `retryAfterSeconds` は **1 以上 1 日（86400 秒）以下の整数か null**。秒数（数字だけ）と IMF-fixdate（RFC 9110 が送り手に
     求める形）だけを読み、`0`・過去の日付は 1 秒（「0 秒ほど」と出さない）、有限でない・1 日を超える値（「Infinity 分」になる）・
     `Date.parse` が何かの日付に読んでしまう文字列（"soon 5" 等）・廃止された日付の形（RFC 850・時差の無い asctime）・負の数・小数は
     null（ログイン画面はサーバの制限からの既定の文言に戻る）。`LoginView` も表示の前に同じ正規化を通す（独立点検の指摘）。
  3. **`LoginView` は理由ごとに文言を出す**：401「token が違います」（控えが無ければ serve を止めて `wtm token reset`）／403
     「このページのアドレス（`window.location.origin`）からのログインを、サーバが許可していません。この拒否は token とは関係ありません
     （token はまだ確かめていません）。サーバのログには origin rejected」と、写せる形の `--origin <その Origin>` を別の行に——サーバは
     429 → Origin／Host（403）→ 本文（400）→ token（401）の順に確かめるので、403 の時点では token の正誤は分からない。正しいとも
     言わず、作り直しも勧めない（独立点検の指摘。当初は「token の誤りではないので wtm token reset は不要」と書いていた）／429「失敗が
     続いたため一時的に止めている（この間は正しい token でも入れない）」＋ `Retry-After` があればその時間、無ければサーバの制限
     （接続元ごとに 1 分に 5 回・1 時間に 20 回）から「1 分ほど（1 時間に 20 回に**達した**ときは最長 1 時間）」（`LoginRateLimiter` は
     `>= HOUR_LIMIT` で止める。当初の「超えた」は不正確——独立点検の指摘）／通信の失敗「サーバに接続できません」／その他
     「HTTP <状態>」。`#token=` の自動ログインが失敗しても token は入力欄に残る（URL からは消した後なので、消すと失われる。
     単体テストと E2E で確かめる）。
  4. テストの道具：`support/wsClient.ts` に `paneSize(paneId)`（hello の snapshot・`pane.created`・`pane.size_changed` から追う
     サーバの大きさ）、`support/panes.ts` に `watchClientView`（ブラウザが送った `client.view` の中身。`watchShownPanes` はその上に
     作り直した。振る舞いは同じ）。
  5. **ログインできた後、アプリの画面へ替わるまでは「接続中…」を出し、入力欄とボタンを止める**（`LoginView`。下の「503 の
     調査」で見つけた件。親の指示で (b) を採った）。この画面は `authRequired` が下りる（接続が `open` になる）まで出たままで、
     以前は `/ws` が 503（サーバの起動の途中。D102）の間、入力できる状態のまま何も表示せずに残っていた。`authRequired` の意味
     （`open` になるまで下ろさない。`view.test.ts` が明示的に確かめている）は変えない。
     - **止めたままにしない**：接続の確認で再び認証を求められる経路——`checkSessionThenOpen` の `/api/session` が 401・`/ws` の close
       4401・切断後の `verifySessionThenScheduleReconnect` の 401——はどれも `StorePort.onAuthRequired` を呼ぶだけで、`authRequired` は
       既に true、`connectionState` も変わらない（`connecting` のまま）ので、画面からは見分けられなかった。`store/view` に
       `authRequiredCount`（`onAuthRequired` のたびに増える）を足し、`LoginView` はそれが増えたら接続待ちを解いて「ログインはできましたが、
       接続の確認でサーバがログインを受け付けませんでした（Cookie が保存されていない・その間に token が作り直された等）。もう一度
       ログインしてください」を出す（token は入力欄に残る）。
     - 通信の失敗が続く間（サーバが止まっている等）は「接続中…」のまま（裏で繋ぎ直しを続け、つながれば替わる。重ね表示の
       「再接続中…」と同じ扱い）。
- **理由 / 代替案**:
  - T31：`ViewSync.commit`／`commitView` で切り離された要素（`isConnected` が false）を除く案は、登録の漏れ（切り離された要素が
    `ownLeaves` に溜まり続ける）を隠すだけで、単体テストでも捉えられなくなるので退けた。root の PaneLayout に tab・pane の key を
    付けて作り直す案は、zoom・分割の中の子の場合を直せず、全ての `TerminalPane` を作り直すので退けた。
  - T32：403 の文言にこのページの Origin を入れるのは、それがそのまま `--origin` に渡す値だから（サーバはブラウザが届いた宛先を
    知りえない。D102）。E2E の 403 は `page.route` で作らず、Chromium の `--host-resolver-rules` で許可リストに無い名前
    （`wtm-e2e.test`）を 127.0.0.1 へ向けて実物のサーバに拒否させた——利用者が LAN の名前・転送したポートで開いたときと同じ形で、
    本物の `window.location.origin` と本物の Origin／Host の検査を通る。429 も実物（誤った token を 5 回送った後にブラウザが正しい
    token を送る）。`Retry-After` と通信の失敗だけは `page.route` で作る。サーバに `Retry-After` を足す案は、`packages/server/src` を
    変えない範囲の外なので見送った（足すなら `LoginRateLimiter` が解除までの時間を返す形になる）。
  - 「接続中…」：(a)「`connecting` で `authRequired` を下ろしてアプリの画面の重ね表示へ移す」案は、`authRequired` の意味を変え、
    ログインの直後に 401 になると画面を作り直して入力欄の token を失うので退けた。止めたままにしない合図を `connectionState` から
    取る案は、上のとおり 401 の経路で変わらないので成り立たない。E2E の「接続中…」は、本物の 503 の代わりに `page.routeWebSocket` で
    最初の `/ws` を hello に答えないまま 3 秒後に閉じる（ブラウザからは同じく「つながらない間」。本物の 503 は一時の spec で別に確かめた）。
- **確かめたこと**: `pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 907 passed（882 → +25）/ `pnpm -s build`（exit 0）/
  `pnpm -s smoke` — PASS / 既定の起動方法 `pnpm --filter @wtm/e2e test` — 40 passed（exit 0。35 → +5）/ 直した 2 つの spec
  （`mobile.spec.ts`・`auth-rejection.spec.ts`）を `--repeat-each=3` で 27 passed。
  **独立点検の反映の後**（T32 の 4 件と「接続中…」）：`pnpm -s typecheck`・`pnpm -s lint`（exit 0）/ `pnpm -s test` — 922 passed
  （+15）/ `pnpm -s build`（exit 0）/ 既定の起動方法 — 42 passed（exit 0。3.2 分）/ `auth-rejection.spec.ts` を `--repeat-each=3` で
  27 passed。負の対照：`net/retryAfter.ts` を前の版の振る舞いに戻すと単体テストが 8 件落ちる（「0 秒ほど待って」「Infinity 分ほど
  待って」と出る・"soon 5" が 0・999…9 が Infinity）。`LoginView` の「接続中…」を外すと単体 2 件・E2E 2 件が落ち、「接続中…」は出すが
  接続待ちから戻す処理を外すと（止めたままになる形）単体 1 件・E2E 1 件（401 の test）が落ちる。一時の spec（本物の 503 を返す
  中継。消した）で、ログインの直後の 503 の間は「接続中…」で入力欄が止まり、受け付けが始まるとアプリの画面へ替わることも確かめた。
  **負の対照**（最初の版。製品のコードだけを元に戻す）：単体テストは 24 件落ちた（PaneLayout の 3 件——単一 pane・zoom・分割の中の子で
  外れた pane が `connected:false` のまま残る。Connection の 11 件——login は `false` が返る・`parseRetryAfter` は無い。LoginView の
  10 件——結果の形が違いエラーを出さない、または「ログインできませんでした」のまま）。E2E は 6 件落ちた：モバイルの test は隠れた p1 が `{cols:53, rows:24}` → `{cols:1, rows:1}`、ブラウザの
  `client.view` が `["p1","p2"]`、ログインの 5 件は `.login-view-error` が「ログインできませんでした」のまま（403 の test ではサーバの
  ログに `origin rejected`（origin `http://wtm-e2e.test:<port>`）が出ていることも確かめた）。戻すとすべて通る。入れ替え（`J`）・zoom の
  解除の単体テストは修正前のコードでも通る（上の 1 の理由）——素朴な直し（paneId だけで外す）では入れ替えの test が落ちることを
  別に確かめた。
- **503 の調査**: `/ws` の 503（起動の途中。D102）の間のブラウザ——一時の spec（`/ws` の upgrade にだけ 503 を返す TCP の中継を
  挟む。消した）で実測：
  - **ログイン済み（Cookie が有効）でページを開く・サーバを再起動する**：`/api/session` は 204（`auth.json` は待ち受けの前に読む）
    → `/ws` が 503 → close（1006）→「再接続中…」の重ね表示のまま 1 → 2 → 4 秒と間隔を空けて繋ぎ直し、受け付けが始まれば次の試みで
    つながる。ログイン画面もエラーも出ない。期待どおり。
  - **Cookie が無く、起動の途中にログインした**（保存した `#token=` 付きの URL・手で token を入れる）：ログインは 204 → `connect()`
    → `/ws` が 503 の間、**ログイン画面が入力できる状態のまま、何も表示せずに残る**（重ね表示は出ない）。裏では繋ぎ直しを続け、
    受け付けが始まるとアプリの画面に替わる。原因は `store/view` が `authRequired` を `open` になるまで下ろさないこと（`view.test.ts` が
    「connecting ではまだ解除しない」と明示的に確かめている、意図した振る舞い）。→ 決定 5 の「接続中…」で直した（親の指示で (b)）。
- **影響**: `packages/web/src/components/PaneLayout.vue`・`packages/web/src/net/ports.ts`・`packages/web/src/net/Connection.ts`・
  `packages/web/src/net/retryAfter.ts`（新規）・`packages/web/src/net/InputGate.ts`・`packages/web/src/components/LoginView.vue`・
  `packages/web/src/store/view.ts`（`authRequiredCount`）、テスト（`PaneLayout.test.ts`・`Connection.test.ts`・`retryAfter.test.ts`（新規）・
  `LoginView.test.ts`・`InputGate.test.ts`・`view.test.ts`）、E2E（`packages/e2e/src/specs/mobile.spec.ts`・`auth-rejection.spec.ts`・
  `packages/e2e/src/support/wsClient.ts`・`panes.ts`）、docs（`docs/verification.md`「うまくいかないとき」——403 は画面に理由と
  `--origin <このページの Origin>` の行が出る・token とは関係ない・429 は「20 回に達したら」／`docs/tls-setup.md`「手順2」の 403 の説明と
  「リバースプロキシの後ろに置く」の 429 の言い方）。`packages/server/src` は変えていない。受け入れ基準は AC4・AC10・AC11・AC12。

## D106: サイズ権限の資格をすべての経路で確かめる・`/api/session` も許可外の Host/Origin を 403 で断る・残りの窓を単調な時計にする（2026-09-19・統合 review ラウンド1 → 01-server-core T29。同日、独立点検の 4 件を反映）

- **背景**: 統合 review ラウンド1 の 01 の範囲の 3 件。
  1. （must）`SizeAuthority.onViewChanged` だけが資格（デスクトップか、`client.fit` を有効にしたモバイル）を確かめず、誰も権限を
     持たない tab を fit していないモバイルにも渡していた（`noteInteraction`・`transferOwnership` は確かめていた）。デスクトップを
     閉じた後にスマートフォンで開くだけで PTY がスマートフォンの大きさに縮んだ。D13・design「モバイル」の「既定ではサイズ権限を
     取らず」に反する。あわせて、`client.fit` のハンドラは `onViewChanged` を呼ぶだけだったので、(a) 有効にしても他のクライアントが
     持つ tab では権限を取れず（design「`client.fit` でサイズ権限を取る」）、(b) 無効にしても権限を持ち続け、その後の `client.view`
     で大きさを決め続けた。
  2. （should）有効な Cookie のまま Host/Origin だけが許可外になる（`--origin` を付けずに再起動した・転送した名前で開いた）と、
     `/ws` は 403 なのに `GET /api/session` は Host/Origin を見ずに 204 を返し、Web は理由を示さず「再接続中…」のまま再試行を続けた。
  3. （nit）`LoginRateLimiter` と `WsGateway` の不正なフレームの窓が `Date.now()` のままだった（D103 は `LogThrottle`・
     `OriginRejectionLog` だけを単調な時計にした）。
- **決定**:
  1. **資格の確認を 1 つの関数（`canDecideSize`：`kind === "desktop" || fit`）にまとめ、権限を取る・受け取るすべての経路で使う**
     （移譲の候補を選ぶ所のコメントも「`canDecideSize`（D13・D106）と同じ資格」に直した。独立点検 #5）。
     - `onViewChanged`：資格の無いクライアントは、誰も権限を持たない tab でも取らず、大きさも変えない。権限を持ったまま資格を
       失っていたら（fit を無効にした後に `onFitChanged` を経ずに来た場合の保険）手放す。
     - **`onFitChanged(clientId)` を足し、`client.fit` のハンドラはそれを呼ぶ**：有効にしたら**種別を問わず**表示中の tab の
       権限を（他のクライアントが持っていても）取り、申告済みの view の大きさを当てる（利用者の明示の操作なので
       `noteInteraction` と同じく取る）。view がまだ無ければ何もしない（最初の `client.view` で、誰も持たない tab なら取る）。
       無効にして資格を失ったら（モバイル）持っている権限をすべて手放す（切断と同じ移譲：その tab を見ていて最後に操作した
       資格のある別のクライアントへ移すか、居なければ無しにして大きさを保つ）。デスクトップは fit を無効にしても資格が残るので
       手放さない。
       - **独立点検 #1**：最初の版のこの記述は「デスクトップの `client.fit` は何も変えない」だったが、コードは `fit` を種別より
         先に見ていて、デスクトップの `enabled:true` でも権限を取っていた（記述とコードの食い違い）。実際に起きる：1 列の画面は
         幅で決まり（`mobile/detect.ts` の `isMobileViewport`）、`client.hello` の種別（`(pointer: coarse)`）とは別なので、幅を
         狭めたデスクトップの窓にも `MobileShell` の「この端末に合わせる」が出て `client.fit` を送る（`App.vue`）。**押すのは
         「この画面に PTY を合わせたい」という意思なので、種別を問わず取る**（親の判断で案 (2)）。記述と design・コメントを
         コードに合わせ、テストで固定した。
     - **`onKindChanged(clientId)` を足し、`client.hello` のハンドラは種別を決めた後にそれを呼ぶ**（独立点検 #3）：`client.hello` は
       いつでも種別を変えられるので、デスクトップとして権限を取った後に fit していないモバイルとして hello し直すと、資格が無いまま
       権限者に居座っていた。資格を失ったら `onFitChanged(false)` と同じく手放す（資格のある種別に変わったときは何もしない）。
     - 移譲（`transferOwnership`）は従来どおり資格のあるクライアントだけを候補にする。
  2. **`GET /api/session` は、Cookie が有効なら Host（Origin が付いていれば Origin も）を確かめ、許可外なら 403**（記録は `/ws`・
     `/api/login` と同じ `OriginRejectionLog`。間引きの状態も共有）。
     - ブラウザは同じオリジンの GET に Origin を付けないので、**Host で見る**。`OriginPolicy.isHostAllowed(host)` を足した：許可
       ホスト（`allowedHostPorts`）か、`--origin` の Origin の `URL.host`（既定ポートならポート無し、それ以外は `host:port`。
       `--origin https://x.ts.net:7780` → `x.ts.net:7780`、`--origin https://x.ts.net` → `x.ts.net`）と一致すれば許す。
       **既定ポートの Origin なら、ポートを付けた形（https は `x.ts.net:443`、http は `:80`）も許す**（独立点検 #4。待ち受けの
       既定ポートでポート無しの形も許す `allowedHostPorts` と対称にし、nginx の `proxy_set_header Host $host:$server_port` の
       ような、ポートを付けて送る前段にも合わせる）。既定でないポートの Origin はそのポートだけ（`x.ts.net:7780` の Origin で
       `x.ts.net:443` は許さない）。
       `isAllowed` は `--origin` の Origin に一致すれば Host を問わないが、Origin の無い GET では Host しか無いので、その Origin の
       ホストで照らす。
     - `OriginRejectionLog.admitGet(r, deny)` を足した：Origin が無ければ `isHostAllowed`、付いていれば `isAllowed`（`admit` と
       同じ規則。付いていて許可外なら Host が許可内でも拒否）。判定 → 記録 → `deny` は `admit` と共通の 1 か所（D103）。
     - **Cookie の確認を先にする**（無効なら Host を問わず 401、ログにも書かない）。Web は `/api/session` が 401 のときだけログイン
       画面を出し、ログインの POST の 403 で理由と `--origin <このページの Origin>` を示す（D105）。Host を先に見ると、Cookie の
       無い最初の訪問を許可外の宛先で開いたブラウザがログイン画面に届かず、理由も出ない。Cookie の無い相手（DNS rebinding の
       ページ等。Cookie はホストに結び付くので送られない）に返すのは今までどおり 401 だけで、何も漏らさない。
     - **検査するのは `/api/session` だけ**：`/api/login`・`/ws` は従来どおり Origin と Host（`admit`）。静的ファイルは検査しない
       （ログイン画面を出す必要があり、秘密を含まない。AC10）。`POST /api/logout` も検査しない（その Cookie のセッションを消す
       だけで、許可外の宛先からでもログアウトできてよい）。
     - Web での 403 の扱い（理由の表示）は 03 の範囲。それまでの Web は 401 以外と同じく再接続を続ける（振る舞いは以前と同じ）。
  3. **`LoginRateLimiter` の既定の時計と `WsGateway` の不正なフレームの窓を `monotonicNow`（`performance.now()`）にする**。
     どちらも差し替えられる（`LoginRateLimiter` は従来の `clock` 引数、`WsGateway` は最後の引数 `opts.now`）。`WsGateway` の
     窓の始まりの初期値は 0 から `-∞` にした（単調な時計はプロセスの起動からの経過なので、0 から始めると起動直後の最初の窓が
     短くなる）。
- **理由 / 代替案**:
  - `onViewChanged` に条件を足すだけにして `client.fit` を変えない案は、「fit を有効にすると権限を取る」（design）が誰も持たない
    tab でしか効かず、無効にしても権限が残る（fit しないモバイルが大きさを決め続ける）ので退けた。fit を無効にしても権限を残し、
    `onViewChanged` で大きさだけ当てない案は、帳簿上の権限者が居座り、同じ tab を見ているデスクトップへ `client.view` で移らない
    ので退けた。
  - `/api/session` で Host を Cookie より先に見る案（`/ws`・`/api/login` と同じ順）は、上の理由でログイン画面に届かなくなる。
    実際に、その順にして `auth-rejection.spec.ts` を走らせると D105 の 403 の test（`wtm-e2e.test` で開く）が
    `page.waitForResponse: Test timeout of 30000ms exceeded`（ログインの POST が送られない）で落ちた（戻して build し直した）。
  - `isHostAllowed` で `--origin` のホスト名だけ（ポートを問わず）を許す案は、`proxy_set_header Host $host`（nginx。ポートを
    落とす）で標準でないポートに置く構成を救えるが、許す範囲を `--origin` の意味より広げるので退けた（既定ポートを付けた
    `$host:$server_port` の形は、同じ宛先の別の書き方なので許す。独立点検 #4）。残る制約：前段のプロキシが
    `Host` を許可ホストでも `--origin` のホストでもない名前に書き換える構成では、`/ws`（Origin で許す）は通るが `/api/session` は
    403 になる（プロキシに元の `Host` を渡させるか、書き換え先を `--origin` に足す。design に書いた）。docs の nginx の例
    （`proxy_set_header Host` 無し＝`127.0.0.1:7780` を送る）はそのまま通る。
- **確かめたこと**: `pnpm -s typecheck`・`pnpm -s lint`・`pnpm -s build`（exit 0）/ `pnpm -s test` — 948 passed（922 → +26）/
  `pnpm -s smoke` — PASS / 既定の起動方法 `pnpm --filter @wtm/e2e test` — spec を直す前は 41 passed・1 failed（exit 1。4.0 分。
  落ちたのは下の「影響」の `mobile.spec.ts` の D105 の test で、この決定の想定どおり）、直した後は下の「E2E の直し」のとおり。
  足したテスト：`SizeAuthority.test.ts` 10 件・`surface/methods/index.test.ts` 1 件（`client.hello` mobile → `client.view` では
  取らない → `client.fit` true で取る → false で手放し、その後の `client.view` で動かない）・`HttpServer.integration.test.ts` 6 件・
  `OriginPolicy.test.ts` 4 件・`OriginRejectionLog.test.ts` 2 件・`LoginRateLimiter.test.ts` 1 件・`WsGateway.integration.test.ts` 2 件。
  **負の対照**（製品のコードだけを戻す）：`onViewChanged` の資格の確認だけを外すと 7 件、`SizeAuthority` と `client.fit` の
  ハンドラを修正前に戻すと 9 件落ちる（デスクトップの 1 件は前後とも通る回帰の見張り）。`handleSession` を修正前に戻すと 3 件
  （有効な Cookie と許可外の Host が 204）、`isHostAllowed` が `--origin` のホストを見ないと 3 件、Host を Cookie より先に見ると
  1 件（Cookie 無し・許可外の Host が 403）落ちる。時計を `Date.now()` に戻すと 3 件落ちる（壁時計が 2 時間進むと制限が解ける・
  注入した時計を無視して 11 回目で閉じる・壁時計が 1 時間進むと窓が終わり閉じない）。戻すとすべて通る。
  **実物の CLI**（一時の `--state-dir`）：`--origin https://x.ts.net:7780` で起動し curl でログイン → `/api/session` は
  Host `127.0.0.1:<port>`・`x.ts.net:7780` で 204、`wtm.example:<port>` で 403（`origin rejected`・`path:"/api/session"`・
  `extraOrigins` 付きの warn）、Cookie 無しなら 401。同じ state-dir で `--origin` 無しで再起動（review の筋書き）→ 同じ Cookie で
  Host `127.0.0.1` は 204、`x.ts.net:7780` は 403（`/ws` の upgrade も同じ宛先で 403）、Origin `http://evil.example` 付きは 403、
  静的ファイルは 200。起動したプロセスはすべて止めた。
  **独立点検の反映の後**（#1・#3・#4・#5）：`pnpm -s typecheck`・`pnpm -s lint`・`pnpm -s build`（exit 0）/ `pnpm -s test` —
  955 passed（948 → +7：`SizeAuthority.test.ts` 5 件・`surface/methods/index.test.ts` 1 件（`client.hello` desktop → `client.view`
  で取る → `client.hello` mobile で手放す）・`OriginPolicy.test.ts` 1 件。ほかに `HttpServer.integration.test.ts` の既存の test に `:443` の
  1 行）/ 既定の起動方法 `pnpm --filter @wtm/e2e test` — 42 passed（exit 0。3.1 分）。**負の対照**：fit を有効にしても
  取るのをモバイルだけにすると 2 件（デスクトップの fit:true で取らない・その後の fit:false の test も前提で落ちる）、fit を無効に
  したら種別を問わず手放すと 2 件（デスクトップが fit:false で権限を失う）、`onKindChanged` が何もしないと 2 件（hello し直しても
  権限者のまま）、`--origin` のホストを `URL.host` の形だけにすると 2 件（`y.ts.net:443` が拒否・`wtm.example.com:443` が 403）
  落ちる。戻すとすべて通る。
- **影響**: `packages/server/src/clients/SizeAuthority.ts`・`surface/methods/client.ts`・`http/HttpServer.ts`・`auth/OriginPolicy.ts`・
  `auth/OriginRejectionLog.ts`・`auth/LoginRateLimiter.ts`・`ws/WsGateway.ts`、テスト（上記）、E2E（`packages/e2e/src/specs/mobile.spec.ts`
  の D105 の test。下記）、decisions D105 の背景への注記、design「WebSocket の通信」の
  Origin の許可リストと切断の見分け方・「HTTP」の表と試行回数の制限・「サイズ権限」・「モバイル」のサイズ・エラー表の 2 行、
  architecture の `HttpServer`・`WsGateway`・`SizeAuthority`・`OriginPolicy`・`OriginRejectionLog`・`LoginRateLimiter` の行・
  `SizeAuthority` のシグネチャ・§7。受け入れ基準は AC8・AC10・AC12。
  - **E2E の直し（(a) の直接の結果なので、ここ（T29）で直した）**：`packages/e2e/src/specs/mobile.spec.ts` の「表示する pane を
    切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105）」は、「誰も権限を持たない tab は最初に
    `client.view` を送ったクライアント（fit していないモバイルのブラウザ）が持つ」——D13 に反する振る舞い——を前提にしていたので、
    (a) の後は前提の待ち（`p1Settled`）で落ちた：
    `Received: {"shown":{…"visible":[{"paneId":"p1","cols":53,"rows":24}]},"server":{"cols":120,"rows":40}}`（2 回とも同じ）。
    fit していないモバイルはどの PTY の大きさも変えないので、そのまま待ちだけを外すと「隠れた p1 の PTY の大きさ」の確かめは
    意味を失う。**分割の前に「この端末に合わせる」を押し（`aria-pressed="true"` を待つ）、ブラウザに正当に権限を取らせる**形に
    した（コメントの「サイズ権限はブラウザが持つ」「最初に `client.view` を送ったクライアントが持つ」も直した）。2 つの確かめ
    （隠れた p1 のサーバの大きさが分割の前のまま・`client.view` が p2 だけを載せる）はそのまま。D105 の背景の同じ前提には
    注記を添えた（書き換えていない）。
    - `mobile.spec.ts` を `--repeat-each=3`：6 passed（exit 0）。既定の起動方法 `pnpm --filter @wtm/e2e test`：42 passed（exit 0。3.1 分）。
    - **負の対照**：`packages/web/src/components/PaneLayout.vue` を一時的に D105 より前の形（`:ref="(el) => setLeafEl(singlePaneId!, el)"`・
      外すときは paneId だけで消す `registerLeaf(paneId, el | null)`）に戻して build すると、直した test が落ちる（exit 1）：
      隠れた p1 が `{cols:53, rows:24}` → `{cols:1, rows:1}`（`expect.soft`）、`client.view` が `["p1","p2"]`。2 つの確かめとも
      効いている。戻して（元のファイルと一致を `cmp` で確認）build し直した。
  - **範囲外で見つけたこと**：design「権限の移り方」の「権限者が別の tab へ移ったら移す」は実装されていない（`SizeAuthority` は
    view の tab の切り替えで前の tab の権限を手放さない。`applyOwnerSize` が view の tab で絞るので前の tab の大きさは動かず、
    その tab を見ている資格のある別のクライアントは操作すれば権限を取れる）。T29 の範囲外なので直さず、コメントに書いた。
    docs（`docs/tls-setup.md`「リバースプロキシの後ろに置く」の「渡さないと `/api/login`・`/ws` が 403」）に `/api/session` と
    Host の書き換えの注意を足すのは 05 の範囲。
  - **独立点検 #2（→ 03/04。ここでは直さない）**：再接続するとサーバは新しい clientId を fit:false で登録するが、Web は
    `fitEnabled` を持ち越したまま `client.fit` を送り直さない（「この端末に合わせる」が押された表示のまま、サーバでは権限を
    取らない）。`client.view` も送り直されないことがある（`ViewSync.lastPayload` が接続をまたいで同じ内容を送らない。統合 review
    ラウンド1 の must 1 と同じ根）。

## D107: 繋ぎ直すたびに表示と購読を張り直す・表示領域の大きさに `client.view` を追従させる・`/api/session` の 403 で理由を示して止まる・`client.error` を日本語にする（2026-09-19・統合 review ラウンド1 → 03-web-desktop T33。同日、独立点検の 5 件を反映）

- **背景**: 統合 review ラウンド1 の 03 の範囲の 4 件（と、サーバの D106 を前提にする件）。
  1. （must）サーバは WebSocket の接続ごとに新しい clientId を振り（`WsGateway.handleConnection`）、購読・表示（`client.view`）・
     fit をその clientId に持つ。Web は `ViewSync.lastPayload` を接続をまたいで持って同じ内容の `client.view` を送らず、
     `pane.subscribe` は xterm.js を新しく作ったとき（`TerminalRegistry.acquire`）しか予約せず、`client.hello` が通った後
     （`Connection` の hello の `.then`）にも何も送り直さなかった。自動の再接続・503 等からの再試行・再ログイン・
     DetachedView の「再接続」の後は、表示中の pane に OUTPUT も SNAPSHOT も届かず画面が止まった（入力だけは PTY に届く）。
     AC8 に反する。E2E の AC8 は新しいブラウザのコンテキスト（xterm.js も作り直す）でしか確かめておらず、D95 の test は出力を
     テスト自身のクライアントで見ていたので捉えられなかった。
  2. （must・デスクトップの分）`PaneLayout.vue` が commit するのは mount と自身の描き直しのときだけで（`commitView` は expose
     していたが誰も呼んでいなかった）、窓の大きさ・サイドバーの幅や折りたたみを変えても `client.view` を送り直さず、PTY は古い
     大きさのままだった。E2E の「サイズ変更への追従」は分割（`PaneLayout` 自身の描き直し）しか確かめていなかった。モバイルの
     測り方（縮小の枠の中の葉を測る）は 04 の範囲。
  3. （should）有効な Cookie のまま Host だけが許可外になると（`--origin` を付けずに再起動した・転送した名前で開いた）、サーバの
     D106 から `/api/session` も 403 を返すが、Web は 204・401 以外を「繋ぎ直す」と扱い、「再接続中…」（ログインの直後なら
     ログイン画面の「接続中…」）のまま理由を示さず繋ぎ直し続けた。
  4. （nit）サーバの `client.error` の `message`（英語の固定文。1MB を超える貼り付けで「malformed frame」）を `main.ts` が
     そのまま toast に出していた。
  - review の must 2（`SizeAuthority.onViewChanged`）の「E2E の前提は 03 で直す」分（`mobile.spec.ts` の D105 の test）は、
    サーバの D106（T29）で直し済み（fit を押して権限を取らせる形）。ここでは何もしていない（直した test はこの作業でも通る）。
- **決定**:
  1. **「新しい接続の hello が通った」合図で、表示と購読を張り直す**。
     - `Connection.onOpened(listener)`：hello が通るたび（`applySnapshot` と `onConnectionState("open")` の後）に clientId を渡して
       呼ぶ。外す関数を返す。listener の例外は後のタスクで投げ直す（hello の `.then` の中で投げると `.catch(() => ws.close())`
       に落ちて繋ぎ直しを繰り返すため）。`ConnectionPort` には足さず、`Connection` のメソッドにした（使うのは `main.ts` だけ。
       port に足すと `InputGate` と各テストの偽物が全部変わる）。`main.ts` は `connection.onOpened(() => viewSync.onConnectionOpened())`。
     - `ViewSync.onConnectionOpened()`：`lastPayload` を捨て（同じ内容でも `client.view` を送る）、`TerminalRegistry.markAllUnsubscribed()`
       で生きている全ての端末を「今の接続では未購読」にし、root の `PaneLayout` が付けた関数（`ViewSync.attachCommitter`。mount で
       付け、unmount で外す）で今の表示を commit し直す。`PaneLayout` はその関数を `nextTick` まで遅らせる（hello の snapshot で
       描き直した後の葉を測る）。root が無い間（ログイン画面・切り離し画面）は、後で mount したときの commit が同じ役を果たす。
       unmount の後は commit しない（`mounted` の旗。外れた後に `nextTick`・タイマーから古い props で送らない）。
     - **閉じてから次の hello が通るまでは何も送らない**（独立点検 #4）。`ViewSync` は `onConnectionOpened` で上げ、
       `onConnectionClosed`（`Connection.onClosed`——開けた接続・開く前に閉じた試みのどちらでも、閉じるたびに呼ぶ。`main.ts` が
       つなぐ）で下ろす旗を持ち、下りている間の `commit` は `client.view`・`pane.subscribe` を送らず、`lastPayload` も予約の購読も
       触らない。最初の版は、WebSocket が開いてから hello の応答が届くまでの間の commit（大きさの変化のタイマー・レイアウトの
       イベント・重ね表示越しのクリック）を新しい接続へ送り、表示の申告より先の購読や、hello の後の張り直しとの SNAPSHOT の
       二重送りになりえた。送らなかった分は `onConnectionOpened` の commit し直しで送る。
     - `TerminalRegistry` の予約は「今の接続で未購読の pane」の集合（`unsubscribed`）にし、`takePendingSubscriptions(shown)` は
       **今 commit する表示の pane のうち**未購読のものだけを取り出す。隠れている（LRU に残っている）端末は、次に表示されたときに
       購読する。順序は従来どおり `client.view` → `pane.subscribe`（サイズを決めてからスナップショットを取る）。
     - **04 向けの口 `ViewSync.onViewEstablished(listener)`**：新しい接続で最初の `client.view` を送った直後、続く `pane.subscribe` より
       前に呼ぶ（初回の接続でも呼ぶ）。サーバの `client.fit` は表示の無い接続では権限を取らない（D106 の `onFitChanged`）ので、
       「この端末に合わせる」を有効にしたまま繋ぎ直したモバイルは、ここで `client.fit({enabled:true})` を送り直す。`request` は
       同期的に送るので `client.view` → `client.fit` → `pane.subscribe` の順に届き、SNAPSHOT は fit で決まった大きさで取られる。
       送り直すのは 04（D106 の独立点検 #2 の `fitEnabled` の持ち越しも 04）。
     - **SNAPSHOT を受けたときの消し方を、書き込みの列の中に移した**（`TerminalRegistry.onSnapshot`：`resize` → `write("\x1bc" + text)`。
       以前は `term.reset()` → `resize` → `write(text)`）。サーバは SNAPSHOT → 溜め置きの OUTPUT → 以後の OUTPUT の順に送る
       （design「スナップショットと差分の継ぎ目」）ので、サーバの側では重なりも抜けも無い。だが `term.reset()` はその場で消すだけで、
       xterm.js がまだ処理していない書き込み（`term.write` は非同期に処理する）を消さないので、それが消した後の画面に流れ込み、
       SNAPSHOT の前に古い出力が重なる（単体テストで確認：`old-line-1`・`old-line-2first` … と重なった）。既に中身のある端末へ
       SNAPSHOT が届くのは、この再接続と流量制御からの再開。RIS は xterm.js の中で `term.reset()` と同じ処理をし（`InputHandler.fullReset`
       → `onRequestReset` → `reset()`）、大きさを保つ。scrollback は SNAPSHOT（サーバのミラーの `scrollbackLines` 行）のものだけに
       置き換わる（切断の前の scrollback と重ならない。単体テストで確認）。
  2. **`PaneLayout` の `followResize`（デスクトップの `App.vue` だけが付ける）**：root が、登録された葉の要素を `ResizeObserver` で
     見て、変化があれば 100ms に 1 回まで（間隔の中の変化はまとめ、最後の変化の分は必ず）commit し直す。見張りは要素ごとで、
     同じ要素を描き直しのたびに `observe` し直さない（し直すと通知が出直す）。外れた葉は見るのをやめ、unmount で `disconnect`・
     待っている commit を捨てる。同じ cols/rows なら `ViewSync` が送らない。
     - **モバイル（`MobileShell`）には付けない**：葉は縮小の枠（`naturalSize` × `scale`。`naturalSize` はサーバの PTY の大きさ ×
       セルの寸法）の中にあり、葉の大きさは PTY の大きさで決まる。葉を見て commit すると、fit 中（権限あり）は「PTY の大きさ →
       葉 → 測った cols/rows → PTY の大きさ」が回る。一時の spec（iPhone 13 のエミュレーション。`MobileShell` に `follow-resize` を
       付けて build。消した）で実測：「この端末に合わせる」を押すと、ブラウザが測った 53×17 に対しサーバの PTY は 51×17 まで
       縮んでから止まった（寸法の端数の切り捨て。環境によってはさらに縮みうる）。今のコード（付けない）では、fit の後に commit
       が起きないので縮まない。モバイルの測り方（縮小の枠ではなく表示領域の大きさを測る）と、その変化への追従は 04 で直す。
       幅を 768px 未満に狭めたデスクトップの窓も `MobileShell` に替わる（`isMobileViewport` は窓の幅に追従する）ので、その幅の
       中での大きさの変化も 04 の直しまでは追従しない（768px 以上へ戻せば本体に替わり、mount の commit で送る）。
  3. **`/api/session` が 403 なら `/ws` を 1 回だけ試し、それも開く前に閉じたら `ConnectionState` の `rejected` にして、繋ぎ直さない**
     （`Connection.checkSession` が 204／401／403／それ以外を分ける。接続の前の確認・切断の後の確認のどちらでも。403 の後の
     試みは、開けばそのまま hello へ進む）。
     - **403 だけでは止めない**（独立点検 #2）：`/api/session` は Host で、`/ws` は Origin で許すかを見る（Origin が `--origin` に
       一致すれば Host を問わない）。前段のプロキシが Host を許可外の名前に書き換え、`--origin` は正しい構成（D106 の残る制約）では、
       `/api/session` だけが 403 で `/ws` はつながる。T33 の前の Web は 403 を「繋ぎ直す」と扱っていたので繋がっていたが、最初の版は
       403 だけで `rejected` に止まり、既にある `--origin` を足すよう示していた（逆戻り）。`/ws` も開く前に閉じたとき（＝ Origin も
       許可外）だけ止める。
     - `ReconnectOverlay` が、「再接続中…」の代わりに理由（「このページのアドレス（<Origin>）からの接続を、サーバが許可していません。
       ログイン（Cookie）は有効です——token を作り直す必要はありません。サーバのログには origin rejected と出ます」）と、写せる形の
       `--origin <このページの Origin>`（ログイン画面の 403 と同じ示し方。D105）と、リバースプロキシの Host の注意（D106 の残る制約）と、
       「再試行」ボタン（`connect()`）を出す。重ね表示のまま（端末は出たまま scrollback を読める・選べる。ボタンのある枠だけが
       ポインタを受ける）。入力は `open` でないので止まったまま（D95）。
     - `store/view` は `rejected` でも `authRequired` を下ろす：サーバは Cookie を先に確かめ、無効なら Host を問わず 401 を返す
       （D106）ので、403 は Cookie が有効な証拠。ログインの直後の確認で 403 になっても、ログイン画面の「接続中…」のまま止めず、
       本体の重ね表示で理由を示す。
  4. （独立点検 #1）**`/api/session` は 204 なのに WebSocket が開く前に閉じる試みが 3 回続いたら、「再接続中…」に手がかりを
     添える**（繋ぎ直しは続ける）。docs/tls-setup.md の nginx の例（`proxy_set_header Host` 無し＝`127.0.0.1:7780` を渡す）のように
     Host を許可内の名前で渡すプロキシの下で、`--origin` を付けずにサーバを起動し直すと、`/api/session`（Host で見る。同じオリジン
     の GET に Origin は付かない）は 204、`/ws`（Origin `https://wtm.example.com` で見る）は 403 になる。ブラウザは upgrade の状態
     コードを見られないので、1006 → 204 → 繋ぎ直し、を理由を示さず繰り返していた。
     - `Connection` が数え（開く前に閉じた socket の後の確認が 204 のときだけ。開いてから閉じた試み・確認が通らない試み（サーバが
       止まっている等）は数えない）、3 回目で `StorePort.onOriginRejectSuspected(true)`。開けたとき・`connect()`（「再接続」
       「再試行」）で 0 に戻し、出していれば `false`。1・2 回目は起動の途中（`/ws` の 503。D102）でも起きるので出さない（間隔は
       1・2・4 秒なので、約 7 秒続いてから出る）。
     - `store/view` の `originRejectSuspected`（`StoreAdapter` の省略可の `onOriginRejectSuspected` で `main.ts` がつなぐ）を
       `ReconnectOverlay` が見て、「再接続中…」の下に「ログインは有効なのに WebSocket だけがつながらないので、サーバがこのページの
       アドレス（<Origin>）を拒否しているかもしれません（リバースプロキシの後ろ等）。ログに origin rejected と出ていれば、次を加えて
       起動し直してください（起動の途中なら、しばらく待てばつながります。繋ぎ直しは続けています）」と `--origin <Origin>` の行を
       添える（枠だけがポインタを受け、行を選んで写せる）。断定できないので `rejected` にはしない。
     - ログイン画面の「接続中…」（ログインの直後）には出さない：ログインの POST は `/ws` と同じ検査（Origin と Host）を通るので、
       ログインできた直後に `/ws` だけが 403 になるのは、その間にサーバが起動し直された場合だけ。
  5. **`client.error` は `code` から日本語の文言を引く**（`net/clientError.ts` の `clientErrorMessage`）。`invalid_params`（今の
     サーバが送る唯一の code。この Web が起こしうるのは 1MB を超える貼り付け）は「送った内容をサーバが受け付けませんでした
     （1 回の貼り付けが 1MB を超えた等）。その分は端末に届いていません。」。design のほかのエラーコードにも文言を用意し、知らない
     code は「サーバでエラーが起きました（<code>）。」。`message` は使わない。
  6. （独立点検の反映で直した。最初の版では下の「範囲外で見つけたこと」に書いた）**ブラウザの xterm.js を、`pane.subscribe` で
     SNAPSHOT に求める行数と同じ `scrollback` で作る**（`TerminalRegistry` の `getScrollbackLines`。`main.ts` が `ViewSync` と同じ
     関数を渡す：デスクトップは `limits.scrollbackLines`（既定 5,000・上限 10,000）、モバイルは 1,000）。以前は指定せず、xterm.js の
     既定の 1,000 行を超える分を捨てていた（AC5「以後はブラウザの xterm.js が持つ」の行数が `--scrollback` にそろっていなかった）。
     - **メモリ**：xterm.js は 1 セル 12 バイト（`BufferLine` の `CELL_SIZE = 3` の Uint32）なので、120 列なら 1 行 約 1.4KB、
       5,000 行で 1 端末 約 7MB。デスクトップの LRU（24）が全部埋まると 約 170MB（`--scrollback 10000` なら 約 340MB）。行は出力が
       溜まった分だけ確保するので、短い pane はそこまで使わない。モバイルは 1,000 行 × 2 端末のまま。サーバのミラーも同じ行数を
       持つ（design「scrollback のメモリ」）。ブラウザの分を減らしたくなったら、ここの値だけを下げる（SNAPSHOT に求める行数も
       合わせて下げないと、超えた分を受け取って捨てることになる）。
     - 作るときの値を使う。ページを開いたまま `--scrollback` を変えてサーバを起動し直すと、既にある端末は前の行数のまま
       （新しく作る端末と、SNAPSHOT に求める行数は新しい値）。
- **既知の制約（独立点検 #3。サーバの follow-up）**：SNAPSHOT を受けると端末を RIS で初期化してから書く（`term.reset()` の頃も
  同じ）が、サーバの SNAPSHOT（`@xterm/addon-serialize` 0.14.0 の `_serializeModes`）が書き出すモードは、カーソルキー・キーパッド・
  bracketed paste・挿入・origin・逆方向の折り返し・フォーカスの報告・折り返しの無効化・マウス追跡（9／1000／1002／1003）だけで、
  **カーソルの表示（`?25`）・SGR のマウスの符号化（`?1006`）・スクロール領域（DECSTBM）・カーソルの形（DECSCUSR）・文字集合
  （G0〜G3）・DECSC で保存したカーソル**は書き出さない。初期化で既定に戻り、SNAPSHOT で戻らない——カーソルを隠している TUI の
  カーソルが見える、SGR のマウスの符号化を求めていたアプリへ旧来の符号化で報告する（座標の大きい端でずれる・誤読される）、
  スクロール領域を使う画面の次の描画が崩れる、等。ページを開き直したとき（初回の購読）も同じだが、T33 で**自動の再接続のたびに**
  SNAPSHOT で書き直すようになったので、起きる機会が増えた（TUI が画面を描き直すまで、または操作するまで続く）。サーバを変えない
  範囲の外なので直さない。直すなら `Mirror` が parser の hook で `?25`・`?1006`・DECSTBM・DECSCUSR を追い、SNAPSHOT の末尾に
  足す（backlog）。research.md F8.4 の「スクロール領域等」を出力するという記述は誤りなので注記した（書き換えていない）。
- **理由 / 代替案**:
  - 合図を `view.connectionState` の `watch`（`open` になったら）で取る案は、Vue のスケジューラを挟んで順序が間接的になり、
    `open` のまま 4401 で閉じてログインし直す経路で値が変わらない場合を考える必要があるので、`Connection` から直接の合図にした。
  - 再接続の直後に LRU の全ての端末を購読し直す案は、デスクトップで最大 24 個・各 5,000 行の SNAPSHOT を一度に取り寄せる
    （サーバの serialize は 1 万行で約 57ms）ので退け、表示中の分だけにした（隠れている分は表示したときに購読する）。
  - `ViewSync` が最後の `ViewCommit`（要素ごと）を覚えて自分で送り直す案は、root が外れている間（ログイン画面等）に切り離された
    要素を測って 1×1 を送る（D105 と同じ形の誤り）ので退け、root が付ける commit の関数にした。
  - 表示領域の見張りを `.app-panes`（本体の入れ物）に付ける案もあるが、測るのは葉なので葉を見る（分割・zoom で葉が替わっても
    同じ仕組みで追える）。フレームごと（`requestAnimationFrame`）にまとめる案は、`ResizeObserver` の通知がもともとフレームごと
    なので減らないため、100ms の間隔にした。
  - 403 を切り離し画面のような専用の画面で出す案は、端末を隠す（scrollback を読めなくなる）ので退け、D95 と同じ重ね表示に
    した。
  - 独立点検 #1 の手がかりを、`/ws` の失敗の回数だけ（`/api/session` を見ない）で出す案は、サーバが止まっている間にも出て誤る
    ので退けた。確認が 204（Cookie は有効・サーバは動いている・Host は許可内）のときだけ数える。回数（3）は、起動の途中の 503
    （D102。復元は通常 1 秒ほど）で出さないための値。
  - 独立点検 #4 の旗を `view.connectionState` の `watch` で下ろす案は、`open` のまま 4401 で閉じる経路で値が変わらないので、
    `Connection` の閉じるたびの合図（`onClosed`）にした。
  - E2E：`page.routeWebSocket` はページの WebSocket を Playwright の偽物に差し替えるので、CDP の `Network.webSocketFrameReceived`
    にフレームが出ない。切断を作る test は中継の中でサーバ → ページのフレームを記録し（ページの WebSocket が受けたものそのもの）、
    切断を作らない test（「再接続」ボタン・サーバの再起動）は CDP で見る（`support/frames.ts`）。403 は実物のサーバでは作れない
    （Cookie はホストに結び付くので、許可外の名前で開き直すと Cookie が無い）ので、`page.route` で `/api/session` を、実物の応答が
    204 のときだけ 403 にし（Cookie が無効なら実物の 401 のまま）、`/ws` の試みもつながずに閉じる。本物の 503 は作れないので、
    「つながらない試み」は中継で閉じて代える（サーバの再起動の test は、止まっている間・起動の途中の本物の失敗を含む）。
    中継のハンドラの中でサーバへつながずに閉じると、ページの WebSocket は **open を出さずに**閉じる（Playwright 1.63 の偽物は、
    ハンドラが終わってから open を出し、既に閉じていれば出さない。コードを読んで確認し、独立点検 #1・#2 の test——開く前に閉じた
    試みだけを数える・`rejected` にする——が通ることでも確かめた）。ブラウザから見て、実物の upgrade の 403・503 と同じ形になる。
- **確かめたこと**: `pnpm -s typecheck`・`pnpm -s lint`・`pnpm -s build`（exit 0）/ `pnpm -s test` — 989 passed（955 → +34）/
  `pnpm -s smoke` — PASS / 既定の起動方法 `pnpm --filter @wtm/e2e test` — 49 passed（exit 0。42 → +7。3.1 分。文言と spec を整えた後の
  最後の回も 49 passed・4.5 分）/ 直した 3 つの spec（`reconnect-restore.spec.ts`・`auth-rejection.spec.ts`・`terminal-app.spec.ts`）を
  `--repeat-each=3` で 72 passed（exit 0。最後の回も 72 passed）。
  足したテスト：`Connection.test.ts` 6 件・`ViewSync.test.ts` 6 件・`TerminalRegistry.test.ts` 5 件・`PaneLayout.test.ts` 5 件・
  `App.test.ts` 3 件・`ReconnectOverlay.test.ts` 1 件・`view.test.ts` 1 件・`clientError.test.ts`（新規）7 件。E2E：
  `reconnect-restore.spec.ts` 4 件（自動の再接続・つながらない試みを 2 回挟んだ再試行・「再接続」ボタン・サーバの再起動。どれも
  **ブラウザが受けた**新しい接続の SNAPSHOT と OUTPUT を見る）・`terminal-app.spec.ts` 1 件（窓を狭める・サイドバーを折りたたむ・
  窓を広げるのそれぞれで、サーバの PTY の大きさがブラウザの申告にそろい、`tput cols` も一致し、落ち着いた後 1 秒は `client.view` を
  送らない）・`auth-rejection.spec.ts` 2 件（ログインの直後の 403・表示中の切断の後の 403。理由と `--origin` が出て、3 秒の間
  `/api/session` も `/ws` も試みず、「再試行」で繋がる）。
  **負の対照**（製品のコードだけを T33 の前に戻す）：単体テストは 29 件と 1 ファイル（`clientError.test.ts`。読み込めない）が落ちる：
  `Connection` 5（`onOpened` 3・403 2。「403 以外は従来どおり繋ぎ直す」は前後とも通る回帰の見張り）・`ReconnectOverlay` 1・`view` 1・
  App 3・`PaneLayout` 4（「`followResize` を付けない呼び出しは見ない」は前後とも通る）・`TerminalRegistry` 4（購読し直し 3・SNAPSHOT の
  重なり 1）・`ViewSync` 11。`ViewSync` の 11 件は、偽の registry を `takePendingSubscriptions(shown)` の形にしたので、前の `ViewSync`
  （引数無しで呼ぶ）ではどれも TypeError で落ちる——うち 5 件は既存の振る舞いの test で、振る舞いの確かめにはなっていない。そこで
  新しいコードに 1 か所ずつ誤りを入れて確かめた（戻して一致を確認）：`onConnectionOpened` が `lastPayload` を捨てない → 5 件
  （`ViewSync` 3・App 2）、未購読に戻さない → 5 件（同）、隠れている pane も購読する → 1 件、`PaneLayout` の commit の関数が
  `nextTick` を待たない → 1 件、大きさの変化をまとめずに毎回 commit する → 2 件、同じ葉を描き直しのたびに `observe` し直す → 1 件、
  SNAPSHOT の消し方だけを `term.reset()` に戻す → 1 件（「`old-line-1`・`old-line-2first`・`old-line-1`・`old-line-2`・`new-line`」と
  古い出力が重なる）。
  E2E（web の src 全体を T33 の前に戻して build）は D107 の 7 件がすべて落ちる：再接続の 4 件は新しい接続で p1 の SNAPSHOT も
  OUTPUT もブラウザに届かない（`Received string: ""`・`Received: 0`。その間の `client.waitForOutput`——打った文字が PTY に届く——は
  通っている）、窓の test は「窓を狭めると PTY の列が減る」が `Expected: < 148 / Received: 148`、403 の 2 件は `.reconnect-overlay-panel`
  が出ない（element(s) not found）。戻して（元のファイルと一致を `diff -r` で確認）build し直した。
  **独立点検の 5 件の反映の後**：`pnpm -s typecheck`・`pnpm -s lint`・`pnpm -s build`（exit 0）/ `pnpm -s test` — 1000 passed
  （989 → +11：`Connection.test.ts` 403 の 3 件を 5 件に作り直し・手がかり 3 件・`onClosed` 1 件、`TerminalRegistry.test.ts` 2 件
  （scrollback）、`ViewSync.test.ts` の hello の前の test を作り直し、`view.test.ts`・`ReconnectOverlay.test.ts`・`StoreAdapter.test.ts`
  各 1 件）/ `pnpm -s smoke` — PASS / 既定の起動方法 — 51 passed（exit 0。49 → +2。4.2 分）/ 直した 3 つの spec を `--repeat-each=3` で
  78 passed（exit 0）。E2E は `auth-rejection.spec.ts` の D107 を 4 件にした：403 で `/ws` も断られる（ログインの直後・表示中の切断の後。
  `/ws` を 1 回だけ試して止まる）・403 でも `/ws` が通る（繋がり、切断の後も繋ぎ直す）・`/api/session` は 204 で `/ws` だけが断られ
  続ける（3 回目で手がかり、繋ぎ直しは続け、開けたら消える）。
  **負の対照**（直した箇所だけを 1 つずつ戻す。戻して一致を確認）：#1 の数えを外す → 単体 2 件（`expected [] to deeply equal [ true ]`）、
  #2 を最初の版（接続の前の確認の 403 で `/ws` を試さず `rejected`）に戻す → 4 件（`expected [] to have a length of 1 but got +0` 等）、
  切断の後の確認の 403 で同じくする → 3 件（`expected 'rejected' to be 'reconnecting'`）、#4 の旗を見ない → 1 件（hello の前の commit が
  `[ [ 'client.view', …(1) ], …(1) ]` を送る）、#6 の `scrollback` を渡さない → 1 件（`expected 1000 to be 5000`）。E2E（web の src を
  最初の版の T33 に戻して build）：D107 の 4 件が落ちる——#1 は `.reconnect-overlay-hint` が出ない（element(s) not found）、#2 の
  「`/ws` が通る」は `.xterm-helper-textarea` が 15 秒出ない（`rejected` で止まる）、`/ws` も断られる 2 件は `ws.refusedCount()` が
  `Expected: 1 / Received: 0`（`/ws` を試さずに止まる）。
- **影響**: `packages/web/src/net/Connection.ts`・`net/ports.ts`（`ConnectionState` の `rejected`・`StorePort.onOriginRejectSuspected`）・
  `store/StoreAdapter.ts`・`net/clientError.ts`（新規）・
  `term/ViewSync.ts`・`term/TerminalRegistry.ts`・`components/PaneLayout.vue`・`components/ReconnectOverlay.vue`・`App.vue`（`follow-resize`）・
  `store/view.ts`・`main.ts`、テスト（上記）、E2E（`packages/e2e/src/specs/reconnect-restore.spec.ts`・`terminal-app.spec.ts`・
  `auth-rejection.spec.ts`、`packages/e2e/src/support/frames.ts`（新規）・`panes.ts`（`watchClientViews`））、design「WebSocket の通信」の
  切断の見分け方・`client.view` の行・「モバイル」のサイズ・エラー表の 2 行・AC8、architecture の `net/Connection`・`TerminalRegistry`・
  `ViewSync`・`components/*` の行・port のシグネチャ・§1 のシーケンスの注記・§7、research.md F8.4 への注記（独立点検 #3）。
  `packages/server/src` は変えていない。受け入れ基準は AC4・AC5・AC8・AC10・AC11。
  - **04 がすること**：(1) `ViewSync.onViewEstablished` で、`fitEnabled` なら `client.fit({enabled:true})` を送り直す（`useFitToScreen`。
    `ViewSyncKey` で inject できる）。(2) モバイルの測り方を、縮小の枠の中の葉ではなく表示領域の大きさにし、その変化への追従を
    付ける——`MobileShell` に `follow-resize` をそのまま付けてはいけない（上の実測のとおり fit 中に縮む）。
  - **範囲外で見つけたこと**（独立点検の反映で直した——決定 6）：ブラウザの xterm.js は `scrollback` を指定せずに作っている（`TerminalRegistry.create`）ので、既定の
    1,000 行しか持たない。デスクトップは SNAPSHOT に `limits.scrollbackLines`（既定 5,000）行を申告して受け取るが、1,000 行を超えた
    分は xterm.js が捨てる（AC5「以後はブラウザの xterm.js が持つ」の行数が `--scrollback` にそろっていない）。再接続の前後で同じ
    （どちらも 1,000 行）なので、この作業の直しの対象ではない。そろえるなら `terminalOptions.scrollback` を
    `limits.scrollbackLines`（モバイルは 1,000）にする（ブラウザのメモリとの兼ね合いの判断が要る）。

## D108: 繋ぎ直した後も「この端末に合わせる」を送り直す・モバイルの `client.view` を表示領域の大きさで申告し、その変化に追従させる（2026-09-20・統合 review ラウンド1 → 04-mobile T9。同日、独立点検の 4 件を反映）

- **背景**: 統合 review ラウンド1 の 04 の範囲の 2 件（D106 の独立点検 #2・D107 の「04 がすること」）。
  1. （must）サーバは WebSocket の接続ごとに新しい clientId を fit:false で登録する（D106）が、`useFitToScreen` は `fitEnabled` を
     接続をまたいで持ったまま `client.fit` を送り直さなかった。自動の再接続・再ログイン・「再接続」の後は、「この端末に合わせる」が
     押された表示（`aria-pressed="true"`）のまま、サーバではサイズを決める資格が無く（D106 の `canDecideSize`）、切断の間に別の
     クライアントが決めた大きさのまま等倍（`scale` 1）で描いて画面からはみ出した。
  2. （must）`ViewSync` はモバイルでも葉を `getBoundingClientRect()` で測っていたが、`MobileShell` の葉は縮小の枠（`naturalSize` ×
     `scale`。`naturalSize` はサーバの PTY の大きさ × セルの寸法）の中にあり、大きさが PTY の大きさで決まる。
     - fit 中は「この端末に合わせる」が PTY を表示領域の大きさへ広げも縮めもできなかった：iPhone 13 のエミュレーション（390×664）で、
       表示領域には 53×41 が収まるのに、最初の申告（xterm.js の既定の 24 行で描いた葉の高さ）の 53×24 で PTY が止まった（下の E2E
       の負の対照で実測）。
     - fit していないクライアントも、表示領域ではなく葉の大きさを申告していた（D106 から PTY の大きさには効かないが、誤ったデータ）。
     - 表示領域の変化（回転・窓の幅・ソフトキーボード・追加キーの列）に追従しなかった。葉を見て追従させる `followResize` を付けると、
       fit 中に「PTY の大きさ → 葉 → 申告 → PTY の大きさ」が回って縮む（D107 で実測：53 → 51 列）ので、D107 はモバイルに付けなかった。
- **決定**:
  1. **`useFitToScreen` が `ViewSync.onViewEstablished` で、有効なら `client.fit({enabled:true})` を送り直す**（初回の接続でも呼ばれる
     が、初回は無効なので何も送らない）。`request` は同期的に送るので、サーバには `client.view` → `client.fit` → `pane.subscribe` の
     順に届く。`client.fit` は表示のある接続でしか権限を取らない（D106 の `onFitChanged`）のでこの順が要り、SNAPSHOT は fit で決まった
     大きさで取られる。listener は unmount で外す。`MobileShell` は `ViewSyncKey` を inject し、無ければ `ConnectionKey`・
     `TerminalRegistryKey` と同じく投げる（送り直せないまま黙って動かさない）。
     - **`toggleFit` は hello の通った接続がある間（`view.connectionState === 'open'`）だけ送る**。切断中・hello 待ちに押したら手元の
       状態（ボタンの表示・`scale`）だけを替え、有効にした分は次の接続の `onViewEstablished` で送る。無効にした分は送らなくてよい
       （新しい接続は fit:false から始まる）。以前は WebSocket が開いてから hello の応答までの間に押すと、hello より先に `client.fit`
       を送りえた（D107「hello の前は何も送らない」）。`ReconnectOverlay` の重ね表示は `pointer-events: none` なので、切断中でも
       上部のバーのボタンは押せる。
  2. **モバイルの `client.view` は、表示領域（`.mobile-shell-pane`。上部のバーと追加キーの列を除いた pane の置き場）いっぱいに端末を
     置いたときの大きさ（表示領域 ÷ セルの寸法）にする**。
     - 03 の範囲には最小の口だけを足した：`ViewCommit.measureSinglePane?(paneId, element)`（`ViewSync.commit` は、表示が 1 つの pane
       だけで付いていればそれで、それ以外は従来どおり葉の `getBoundingClientRect()` で枠を測る）と、`PaneLayout` の `measureSinglePane`
       prop（root のときだけ効き、付いていれば commit の `measureSinglePane` に載せる。付けないデスクトップの commit の中身は以前と
       同じ——キーも載せない）。
       - **pane ごとの口ではない**（独立点検 #2。最初の版は `measure`・`measureLeaf` という名前で、pane ごとの測り方の口に見えた）：
         表示領域の全体を 1 つの pane に当てる測り方なので、名前で「表示が 1 つの pane だけのとき」を示し、`ViewSync` は `visible` が
         2 つ以上の commit では使わずに葉を測る（開発時（`import.meta.env.DEV`）は 1 度だけ `console.warn`）。`MobileShell` は単一 pane の
         木（`{type:'pane', paneId}`）しか描かないので、この前提は成り立つ——`usePaneArea` の `measureSinglePane` の隣にも書いた。
     - `mobile/usePaneArea.ts`（新規）の `measureSinglePane` が表示領域の `getBoundingClientRect()` を返し（`paneId` を問わない）、
       `MobileShell` が `PaneLayout` に `:measure-single-pane` で渡す。表示領域の大きさはレイアウト（画面の幅・`useVisualViewportHeight` の高さ・バーと追加キーの列）だけで
       決まり（`flex: 1`・`min-height: 0`・`overflow: hidden`）、中身の縮小の枠——PTY の大きさ——に左右されないので、申告と PTY の
       大きさは互いに影響しない（D107 の循環は起きない）。セルの寸法は従来どおり xterm.js の実物（`getCellSize`。`transform` の影響を
       受けない）。
     - **追従**：`usePaneArea` が表示領域の要素を `ResizeObserver` で見て、変化があれば 100ms に 1 回まで（間隔の中の変化はまとめ、
       最後の変化の分は必ず）`PaneLayout` の `commitView`（expose 済み）を呼ぶ。間隔（`RESIZE_COMMIT_INTERVAL_MS`）と間引き
       （`createTrailingThrottle`）は `term/resizeThrottle.ts`（新規）に置き、デスクトップの `PaneLayout` の `followResize` と共有する
       （独立点検 #3。最初の版は同じ 100ms の定数と間引きを 2 か所に書いていた。振る舞いは変えていない）。回転・窓の幅・
       ソフトキーボード（visual viewport の高さを `.mobile-shell` に当てるので表示領域が縮む）・追加キーの列の開閉のどれでも表示領域の
       大きさが変わる。同じ cols/rows なら `ViewSync` が送らない。unmount で見るのをやめ、待っている commit を捨てる。`followResize`
       （葉を見る）はモバイルに付けないまま。
     - `useVisualViewportHeight` は窓の `resize` でも読み直す（`window.visualViewport` が無い環境のフォールバックは、以前は初期値の
       まま回転にも追従しなかった）。
     - **ピンチの拡大率を掛け戻す**（独立点検 #1）：`visualViewport.height` は見えている範囲を CSS px で表すので、拡大すると拡大率の
       分だけ縮む。最初の版はそのまま `.mobile-shell` に当てていたので、fit 中はピンチのたびに表示領域が縮み、PTY の行が変わって
       100ms ごとに SIGWINCH を送った（iPhone 13 のエミュレーションで 53×41 → 1.5 倍で 53×26 → 2 倍で 53×18）。拡大中（`scale !== 1`）は
       `height × scale` を 1/100 px に丸めて使う——拡大率に左右されない「拡大していないときの見えている高さ」（ソフトキーボードの分は
       引かれたまま）。`height` は float32 の精度で届く（664 を 1.5 倍に拡大すると 442.66668701171875。掛け戻すと 664.00003）ので、
       丸めて端数で揺らさない。拡大していなければ以前と同じ値（`height` そのまま）。拡大したまま開いたページの初期値も同じく掛け戻す。
  3. **サイズ権限の意味（D13・D106）は変えない**：fit していないモバイルの申告は表示・購読のために送るが PTY の大きさを変えず、fit 中は
     PTY がこの申告（スマートフォンの表示領域から決まる大きさ）になる。幅を 768px 未満に狭めたデスクトップの窓（`MobileShell` に
     替わる。種別は desktop なので資格がある）も表示領域で申告し、その幅の中での大きさの変化に追従するようになった（D107 の
     「04 の直しまでは追従しない」の解消）。
- **理由 / 代替案**:
  - `MobileShell` に `followResize` を付ける案は D107 の実測のとおり縮む。`followResize` のまま `measureSinglePane` だけ足す案は、循環は
    しないが、葉の大きさは PTY の大きさが変わったときにしか変わらないので表示領域の変化（回転）を捉えられない——見るべきは表示領域の
    要素。
  - `ViewSync` に全体の測り方を差し替える口（`setMeasure` 等）を持たせる案は、どの shell が付けたかの状態を `ViewSync` が持ち、
    `MobileShell` とデスクトップの本体の入れ替わり（幅で替わる）の順序に依存するので退けた。root の `PaneLayout` の prop → commit
    ごとの `measureSinglePane` なら、付ける shell が明示的で、外し忘れが無い。
  - `MobileShell` が cols/rows を直接渡す案は、セルの寸法（xterm.js）を `MobileShell` の側でも読むことになり、`ViewSync` の計算
    （`measure`）と二重になるので、大きさ（px）を返す関数にした。
  - （独立点検 #2）単一 pane の前提の見張りを `usePaneArea` の側に置き、「`MobileShell` が表示している pane の id と違う pane を
    測れと言われたら警告して葉を測る」とする案は、表示する pane を切り替えた直後（`currentPaneId` は替わったが `PaneLayout` がまだ
    描き直していない間）に間引きのタイマーから commit が来ると、古い pane を縮小の枠の中の葉で測り、fit 中はその PTY を縮めうるので
    退けた。表示の数を知っているのは `ViewSync` なので、そこで「1 つだけのときに使う」とした（切り替えの途中でも表示は 1 つなので、
    以前と同じく表示領域で測る）。
  - （独立点検 #1）拡大中は高さを変えない（止める）案は、ピンチでは変わらないことが確実だが、拡大したままソフトキーボードを開閉しても
    表示領域が追従せず（拡大率が 1 に戻るまで）、拡大率がちょうど 1 に戻らない環境では止まったままになる。掛け戻す案は、拡大しても
    値が変わらず（端数は丸める。cols/rows が同じなら `ViewSync` も送らない）、拡大中のソフトキーボードにも追従できるので、こちらを
    安全と判断した。どちらも `visualViewport` の仕様（`height` は拡大後の CSS px・`scale` は拡大率）に依るのは同じ。
  - 表示領域を `clientWidth`/`clientHeight` で測る案は、整数に丸めるので切り上がると端数ぶん 1 行多く申告しうる（表示領域の高さは
    616.34px のような端数を持つ）。デスクトップの葉と同じ `getBoundingClientRect()` にした。
  - `toggleFit` の関所を `ViewSync` の旗（`connectionReady`）で取る案は、`ViewSync` に読み出し口を足すことになる。`view.connectionState`
    の `open` は hello の後（`applySnapshot`・`onConnectionState('open')` の後に `onOpened`）に立ち、閉じると同じ同期の処理の中で
    `reconnecting`・`detached`・`rejected` に替わる。`open` のまま 4401 で閉じる経路（D107）はログイン画面に替わって `MobileShell` が
    外れるので押せない——同じ意味になるので、既にある状態を使った。
  - ソフトキーボードの開閉でも、fit 中は PTY の行が変わる（SIGWINCH）。表示領域に収めるのが「この端末に合わせる」の意味（design
    「スクロールと入力」の「visual viewport の高さに合わせて表示領域を詰める」）なので追従させ、開閉のアニメーションの間は 100ms の
    間隔でまとめる。
- **確かめたこと**: `pnpm -s typecheck`・`pnpm -s lint`・`pnpm -s build`（exit 0）/ `pnpm -s test` — 1017 passed（1000 → +17。
  94 files）/ `pnpm -s smoke` — PASS / 既定の起動方法 `pnpm --filter @wtm/e2e test` — 53 passed（exit 0。51 → +2。4.4 分）/
  `mobile.spec.ts` を `--repeat-each=3` — 12 passed（exit 0）。
  足したテスト：`useFitToScreen.test.ts` 4 件（実物の `ViewSync` で、繋ぎ直した後に `client.view` → `client.fit` → `pane.subscribe`・
  初回と無効にした後は送らない・hello の前の切り替えは送らず次の接続で送る・unmount で listener を外す。既存の 5 件は
  `connectionState` を `open` にして始める形にした）・`usePaneArea.test.ts`（新規）5 件・`ViewSync.test.ts` 1 件・`PaneLayout.test.ts`
  2 件・`useVisualViewport.test.ts` 1 件・`MobileShell.test.ts` 4 件（実物の `ViewSync`・`TerminalRegistry`・`PaneLayout` で、表示領域と
  葉に別の大きさを当てて表示領域で申告すること・表示領域の変化で 100ms に 1 回まで送り直し、PTY の大きさ（縮小の枠と葉）が変わっても
  申告が変わらないこと・fit を有効にしたまま繋ぎ直す順・切断中に押した分。既存の「この端末に合わせる」の test は `ViewSyncKey` を
  provide し `open` にして始める形にした）。E2E（`mobile.spec.ts`。iPhone 13 のエミュレーション）2 件：
  (a) fit してから、ページの WebSocket を中継して（`routeRecordingWebSocket`）切り、繋ぎ直しを断っている間にデスクトップのクライアントが
  同じ tab を見て操作し PTY を別の大きさにする → 繋ぎ直させると、新しい接続でページが `client.hello` → `client.view` → `client.fit`
  （`{enabled:true}`）→ `pane.subscribe` の順に送り、サーバの PTY がスマートフォンの申告（53×41）に戻る。
  (b) fit していない間は、申告が表示領域いっぱいの大きさ（ブラウザの DOM の表示領域と縮小の枠から別に割り出した値）に一致し、横長
  （750×342）へ回すと申告が追従する（53×41 → 102×19）が、ブラウザから打った文字のエコーで同期した後もサーバの PTY は 120×40 のまま
  （D13・D106）。「この端末に合わせる」で PTY が 102×19 になり、追加キーの列を開くと行が減り、縦長へ戻すと列が減って行が増え、どれも
  申告＝サーバ＝表示領域いっぱいで落ち着く。落ち着いた後 1 秒は `client.view` を送らず、PTY も動かない。
  **負の対照**（E2E。web の製品のコードだけを変えて build し直し、`mobile.spec.ts` を走らせた。戻して一致を `diff -r` で確認し、
  build し直した）：
  - web の src 全体を T9 の前に戻す：D108 の 2 件が落ちる（既存の 2 件は通る）。(a) は前提の「fit した PTY は表示領域いっぱい」
    （`expect.soft`）が `Expected: "53x24" / Received: "53x41"`、新しい接続の要求の順に `client.fit` が無く（`client.hello`・
    `client.view`・`pane.subscribe`）、送り直す `client.fit` が `undefined`、PTY はデスクトップの大きさのまま
    （`{"shown":{"cols":82,"rows":29},"server":{"cols":83,"rows":29}}`）。(b) は最初の確かめで申告 53×24・表示領域いっぱいは 53×41。
  - `onViewEstablished` の送り直しだけを外す：(a) だけが落ちる（順に `client.fit` が無い・PTY がデスクトップの 83×46 のまま、
    申告は 53×41）。
  - 表示領域の `ResizeObserver` だけを外す（測り方は表示領域のまま）：(b) だけが落ちる（「回すと申告の列が増える」が
    `Expected: > 53 / Received: 53`）。
  - 追従は付けたまま、測るのを葉に戻す（D107 の「`follow-resize` をそのまま付ける」に相当）：D108 の 2 件が落ちる。申告は 53×17
    （D107 の実測と同じ）、(a) の繋ぎ直した後の PTY は 82×22 で落ち着き、切断の前の 53×17 に戻らない（申告が PTY の大きさに左右される）。
  **負の対照**（単体。製品のコードに 1 か所ずつ誤りを入れ、`vitest --project @wtm/web` を走らせて戻した。戻した後の一致を確認）：
  送り直しを外す → 5 件（`useFitToScreen` 3・`MobileShell` 2）、`toggleFit` の関所を外す → 2 件、`PaneLayout` が `measure` を渡さない →
  4 件、`ViewSync` が `measure` を無視する → 4 件、`usePaneArea` が葉を測る → 4 件、間隔でまとめずに毎回 commit する → 3 件、窓の
  `resize` を聞かない → 1 件。製品のコードをすべて T9 の前に戻す（テストは新しいまま）→ 10 件と 1 ファイル（`usePaneArea.test.ts`。
  読み込めない）が落ちる。新しいテストのうち「初回の接続（無効のまま）では何も送らない」「付けなければ commit に measure を載せない」
  の 2 件は前後とも通る回帰の見張り。
  **独立点検の 4 件の反映の後**（最初の版の `measure`・`measureLeaf` は #2 で `measureSinglePane` に改めた）：`pnpm -s typecheck`・
  `pnpm -s lint`・`pnpm -s build`（exit 0）/ `pnpm -s test` — 1023 passed（1017 → +6。95 files）/ `pnpm -s smoke` — PASS / 既定の起動方法
  `pnpm --filter @wtm/e2e test` — 54 passed（exit 0。53 → +1。4.8 分）/ `mobile.spec.ts` を `--repeat-each=3` — 15 passed（exit 0）。
  足したテスト：`useVisualViewport.test.ts` 2 件（#1：拡大しても高さが変わらず、拡大したままのソフトキーボードには追従する・拡大した
  まま開いたときの初期値）・`ViewSync.test.ts` 1 件（#2：表示が 2 つなら `measureSinglePane` を使わず葉を測り、警告は 1 度だけ）・
  `resizeThrottle.test.ts`（新規）3 件（#3）。E2E 1 件（#1。`mobile.spec.ts`）：fit して落ち着いた後、CDP の
  `Emulation.setPageScaleFactor` で 1.5 倍・2 倍・1 倍にし（`visualViewport.scale` が変わるのを確かめてから 1 秒待つ）、どれでも
  `client.view` を送らず PTY の大きさも変わらない（ピンチの合成 `Input.synthesizePinchGesture` はこの環境では拡大しなかった）。
  #4：E2E の表示領域いっぱいの大きさの計算は、縮小の枠の `style.width`（Chromium は CSS の長さを 6 桁に丸めて返す。`388.667px`）を
  列数で割るのをやめ、製品（`getCellSize`）と同じ出どころのセルの寸法（xterm.js の `_core._renderService.dimensions.css.cell`。
  Vue のアプリが provide した `TerminalRegistry` から読むだけ）を読むようにした。製品と同じ値（同じ要素の `getBoundingClientRect()`・
  同じセルの寸法）から切り捨てるので一致し、比が整数から 1e-3 以内のときだけ浮動小数の誤差として境目の両側を許す（この環境の
  セルは 7.333333333333333×15。WebGL の描画のセルの寸法は列数によらない）。#3 の後も `PaneLayout.test.ts` の `followResize` の既存の
  test はそのまま通る（振る舞いは同じ）。
  **負の対照**：#1 の掛け戻しを外す（`height` そのまま。最初の版と同じ）→ 単体 2 件、E2E はピンチの test だけが落ちる
  （拡大率 1.5 で `client.view` を送り（`Expected: 1 / Received: 2`）、PTY が 53×41 → 53×26）。#2 の見張りを外す（表示の数を見ずに
  使う）→ 単体 1 件。#3 の間引きをまとめずに予約し直す形に壊す → 3 件（`resizeThrottle`・`PaneLayout` の `followResize`・
  `usePaneArea` の追従——2 か所とも共有の間引きを使っている）。#4 の新しい計算が区別できること：web の src を T9 の前に戻して build
  すると、(a)・(b) は以前と同じ所で落ち（申告 53×24 に対し、読んだセルの寸法から表示領域いっぱいは 53×41）、ピンチの test も前提の
  落ち着き（表示領域いっぱい）で落ちる。どれも戻して一致を確認し、build し直した。
- **影響**: `packages/web/src/mobile/useFitToScreen.ts`・`mobile/usePaneArea.ts`（新規）・`mobile/MobileShell.vue`・
  `mobile/useVisualViewport.ts`、03 の範囲の口（`term/ViewSync.ts` の `ViewCommit.measureSinglePane`・`MeasuredSize`、`components/PaneLayout.vue` の
  `measureSinglePane`、`term/resizeThrottle.ts`（新規。`PaneLayout` の `followResize` も使う））、テスト（上記）、E2E（`packages/e2e/src/specs/mobile.spec.ts`
  に 3 件、`packages/e2e/src/support/frames.ts` の `routeRecordingWebSocket` にページが送った要求の記録 `sent(connection)`）、design
  「WebSocket の通信」の `client.view`・`client.fit` の行・「モバイル」のサイズ・スクロールと入力、architecture の `term/ViewSync`・
  `components/*`・`mobile/*` の行・`ViewSync` のシグネチャ。
  `packages/server` は変えていない。受け入れ基準は AC8・AC12。
  - **範囲外で見つけたこと（直していない。follow-up の候補）**：
    - `fitEnabled` は `MobileShell`（`useFitToScreen`）の中に持つので、幅でデスクトップの本体へ替わってから戻ると（タブレットの回転で
      768px をまたぐ等）押していない表示に戻るが、同じ接続のサーバでは fit:true のまま（表示とサーバの食い違い）。
    - fit 中でも、別の資格のあるクライアントが操作で権限を取り返すと（`noteInteraction`）PTY はその大きさになるが、`useFitToScreen` は
      fit の有無だけで `scale` を決める（権限の有無を見ない）ので、モバイルは等倍のまま描いてはみ出す。
    - どちらも T9 の前からある振る舞い。

## D109: 実機の確認に回した項目の手順を docs/verification.md に揃え、既知の制約を 1 か所にまとめ、D106〜D108 を docs に反映する（2026-09-20・統合 review ラウンド1 → 05-e2e-docs T15）

- **背景**: 統合 review ラウンド1 の 05 の範囲の 2 件。(1)（should）親の test-result.md ラウンド6「未検証の穴」が
  `docs/verification.md` の手順で確かめるとしているのに、手順の無い項目があった（AC12 の再接続の後のソフトキーボード・隠れた pane の
  大きさ・ログイン画面、AC16 の Windows でのロックの判定・コンソールを閉じたとき・大文字のホスト名、AC17 の実機での計測の手順と
  合否の基準、M7、claude／codex 以外のエージェント）。(2)（nit）利用者に説明済みの既知の制約（D95・D99）が docs に無い。
  あわせて 01 の D106・03 の D107・04 の D108 の振る舞いを docs に反映する。利用者は後で `docs/verification.md` に沿って実機で
  確かめるので、**実機の確認に回した項目はすべて、チェックボックスと期待する結果つきの手順を持つ**ことを基準にした。
- **決定**:
  1. `docs/verification.md` に足した手順：
     - AC12（「実機（iOS Safari・Android Chrome。AC12）」を「準備とログイン」「1 列のレイアウトと入力」「「この端末に合わせる」と
       サイズ」「再接続」に分けた）：CA の入れ方（`docs/tls-setup.md`「手順1」へ）・ログイン画面の理由ごとの文言（D105。401・429・
       通信の失敗・「接続中…」、任意で `.local` の名前での 403）・押していない間は PTY を変えない（D106）・押すと画面いっぱい／回転・
       ソフトキーボード・追加キーの列への追従／ピンチでは変わらない（D108）・手放す・隠れた pane の大きさ（D105。
       `while sleep 1; do stty size; done` で `1 1` が一度も出ない）・再接続の後もソフトキーボードが閉じず出力が届く（D95・D107）・
       再接続の後も「この端末に合わせる」が効く（D108）。PTY の大きさは `stty size` で見る。
     - AC16 の Windows ネイティブ：同じ state-dir の二重起動と `token reset` の拒否（`$LASTEXITCODE` 2）・`Stop-Process -Force` で
       残したロックの取り直し・コンソールを閉じたときの終わり方（10 秒後に `wtm.lock` が無く、構成が戻る）・大文字のホスト名
       （AC11 の「Windows ネイティブ」）。上の一巡は AC1〜AC9 だけで、WSL2・Windows ネイティブの AC10・AC13・AC14・AC18 の手順が
       無かったので「共通：AC10・AC13・AC14・AC18（AC16）」を足し、各環境の最後の項目から参照した。Tailscale・リバースプロキシの
       実環境（test-result.md の未検証の穴）も「任意：Tailscale・リバースプロキシ（使う構成だけ）」に置いた。
     - AC17：「性能の計測（AC17）」の節。コマンドは `pnpm --filter @wtm/e2e exec playwright test performance agent-detection --headed`
       （Linux か WSL2 で）。`pnpm --filter @wtm/e2e test performance --headed` は pnpm が `--headed` を自分のオプションとして
       `Unknown option` で断る（`test -- …` なら通る）ので、既存の docs の Chromium の導入と同じ `exec playwright …` の形にした。
       出る 4 行の意味の表と合否：応答性は `[AC17 遅延・描画まで]` の p95 が 50ms 以内、状態反映は `agent-detection.spec.ts` が
       passed（中で、画面が出てからサーバが `pane.agent_status_changed` を知らせるまで 2 秒未満を assert している。サイドバーの
       描画は含まない）、規模・大量出力は `[AC17 規模・描画まで]` の p95 が 50ms 以内なら合格で、超えたら
       16 pane の 1 つで `yes` を流したまま手で操作して、要件の「他の pane とブラウザの操作が固まらない」を満たすかを利用者が判断する。
       LAN の往復は、別のマシンからの `ping` の最大を足す近似で代える（spec はサーバとブラウザが同じマシン。近似でよいかは
       利用者の判断）。Windows ネイティブでは走らせない
       （spec が pane に `yes` を打つ）。WSL2 の Chromium は SwiftShader になりうるので、WebGL の描画器の名前を出す 1 行を添え、
       その場合は Windows の Chrome・Edge での手の確認を判断の中心にする。`docs/herdr-parity.md` の「AC17 の絶対値の合否判定」は
       「自動テストでは問わず、実機の手順で利用者が判断する」に揃えた。
     - M7（「Linux（CI・手元）」。`printf '\e[?1000h\e[?1006h'; cat -v` で届いた報告を見る 3 段）・claude／codex 以外のエージェント
       （起動時のログの `"msg":"agent manifests loaded","ok":22,"total":22`、使っているものを 2〜3 種、「未検証」の表示と状態の丸の色）・
       scrollback の行数（`seq 1 6000` で先頭が 1000 の少し手前）。共通の一巡に、AC4 の窓・サイドバーの大きさへの追従（D107）・
       AC8 の同じページのままの再接続（D107）・AC9 の大きさの決まり方（D106）を足した。
  2. **既知の制約は `docs/verification.md`「既知の制約」の 1 か所にまとめた**：TCP の半開きの間の入力が黙って消える（D95。
     ハートビートが無い）・新しい pane を作る操作の直後の IME の変換中の文字（D99）・スナップショットで戻らない端末のモード
     （D107）と OSC 8 のリンク（design の AC8 が「docs に明記する」としていたのに無かった）・「この端末に合わせる」の食い違い 2 件
     （D108 の範囲外で見つけたこと）。`docs/herdr-parity.md`「未検証のまま見送った項目」・`docs/tls-setup.md`「リバースプロキシの
     後ろに置く」・`docs/verification.md`「うまくいかないとき」から参照する。
  3. copy モードの `0`・`^`・`$`・Home/End・`g`/`G`・`ctrl+b` は「**実装していない**（D63）ので確かめる対象ではない」と
     `docs/herdr-parity.md` と `docs/verification.md` の最後の節に明記した（以前の「未確認のまま…実装した」は、実装したと読めた）。
  4. D106・D107 の振る舞い：`docs/tls-setup.md`「手順2」に、Cookie が有効なまま許可外になったときの `/api/session` の 403・
     「接続できません（このアドレスは許可されていません）」の枠と「再試行」・3 回目の手がかり、`--origin` の既定ポートの
     `Host: <名前>:443`。「リバースプロキシの後ろに置く」に `Host` を書き換えない注意。「起動と運用の注意」に「scrollback の行数と
     メモリ（`--scrollback`）」。`docs/verification.md` の「うまくいかないとき」を節にし、403 の枠・手がかり・「接続中…」から
     進まない・日本語の通知・文字が消えるときを足した。
- **理由 / 代替案**:
  - 既知の制約を `docs/herdr-parity.md` の見送りの一覧に置く案は、そちらは herdr との機能の差の表で、確かめる人が手順の途中で
    読む docs ではないので退けた。
  - 大量出力中の 16 pane の合否を数値だけで決める案は、`yes` が要件の想定（ビルドログ等）よりずっと重く、このサンドボックスでは
    p95 が 370〜780ms で常に超える一方、要件の本文は「固まらない」なので、数値で合格しなければ手で確かめて利用者が判断する形にした。
  - ログイン画面の 403 を実機で必ず作る手順（ポート転送を張る等）は重いので、`.local` の名前が引ける環境だけの任意にした
    （文言そのものは E2E の `auth-rejection.spec.ts` で確かめている）。
  - ネストした箇条書きは、6 桁の字下げだと CommonMark では入れ子の一覧にならない（段落の続きになる）ので、M7 とログイン画面は
    項目ごとのチェックボックスに分けた。
- **確かめたこと**（このマシン——WSL2 の上のコンテナの Linux——で動くものは実際に動かした。起動したサーバは止めた）:
  - `pnpm --filter @wtm/e2e exec playwright test performance agent-detection` — 5 passed（1.5 分）。docs の例の 4 行はこの回の値。
    `--headed`（WSLg の窓）でも、performance だけで 4 passed（1.9 分）、docs のとおりの
    `… performance agent-detection --headed` で 5 passed（2.3 分。p95：描画まで 50ms・16 pane の描画まで 544ms・描画フレームの
    最大間隔 133ms）。
    `exec playwright test performance --list`・`--headed --list`・`test -- performance --list` は 4 件、`test performance --list` は
    pnpm の `Unknown option: 'list'`。WebGL の描画器を出す 1 行は、ヘッドレス・`headless: false` ともに SwiftShader を出した。
  - `wtm.lock`（Windows の手順の Linux での対応）：2 つ目の `serve` と動作中の `token reset` は終了コード 2 と docs の文言、`kill -9`
    の後もロックが残り、次の起動が取り直す（新しい pid）、SIGTERM で終わるとロックが消える。
  - D106：`--origin https://wtm.example.com` で、有効な Cookie の `/api/session` が `Host` `127.0.0.1:<port>`・`wtm.example.com`・
    `wtm.example.com:443` で 204、`wtm.example.com:8443`・`wtm-backend:<port>` で 403（`origin rejected`・`"path":"/api/session"`）。
  - D101：このマシンのホスト名は大文字（`OSK2-024680-2`）。docs の `openssl` の自己署名で `--host 0.0.0.0` に起動し、`Host`・`Origin`
    が大文字・小文字のどちらでも `/api/login` 204、別の名前は 403。
  - scrollback：一時のスクリプト（Playwright。scratchpad）で `seq 1 6000` の後の xterm.js の先頭の行が `951`（137 列×51 行の
    窓）、ページを開き直しても `951`、`--scrollback 2000` では `3951`。
  - M7・M6：一時のスクリプトで、下の「範囲外で見つけたこと」の 1・3 を確かめた。`stty size` の出力は「行数 列数」。`ping -c 3`。
  - PowerShell・Windows・実機のスマートフォン・Tailscale のコマンドは、この環境では動かせない（公式の docs とソースに合わせた）。
  - `pnpm -s lint`・`pnpm -s typecheck`（docs だけの変更なので影響なし）。
- **影響**: `docs/verification.md`・`docs/tls-setup.md`・`docs/herdr-parity.md`。製品のコード・テストは変えていない。受け入れ基準は
  AC11・AC12・AC16・AC17。
- **範囲外で見つけたこと（製品の不具合。ここでは直さず、親へ報告。docs には「2026-09-20 の時点では」と注記した）**:
  1. M7：既定の `rightClick: 'herdr'` でも、アプリがマウス報告を求めていると、右クリックでメニューが開くと同時に右ボタンの報告
     （`\e[<2;…M`・`\e[<2;…m`）もアプリへ届く。`MouseBridge.handleContextMenu` は contextmenu の既定の動作を止めてメニューを開く
     だけで、xterm.js 自身の mousedown が送る報告を止めていない（一時のスクリプトで、既定のままの右クリック 1 回でメニューが開き、
     報告も 1 組届くことを確かめた）。→ 03。
  2. M7 の後半「pane の枠の右クリックは常にメニューを開く」（design のマウス操作の表）が未実装：contextmenu を受けるのは xterm.js の
     要素だけで、「右クリックを pane に送る」にした後は、マウス報告を求めるアプリが動いている間、その pane のメニューを開く手段が
     無い（コードの読解）。→ 03。
  3. M6：Ctrl（macOS は Cmd）を押さないクリックでもリンクを開く（`WebLinksAddon` に渡す handler が修飾キーを見ていない。一時の
     スクリプトで、修飾キーなしのクリックで新しいページが開くことを確かめた）。design の M6 は「Ctrl を押しながらのクリック」。→ 03。
  4. タッチが主の端末（`(pointer: coarse)` → `kind: 'mobile'`）で幅が 768px 以上（タブレットの横長等）だとデスクトップの画面になるが、
     「この端末に合わせる」は `MobileShell` にしか無く、種別が mobile なので D106 の資格（`canDecideSize`）を持てず、PTY の大きさを
     決める手段が無い（コードの読解のみ。実機では未確認）。AC12 の対象はスマートフォンなので、要否の判断が要る。→ 04。
- **独立点検の 18 件の反映**（2026-09-20。上の決定と「確かめたこと」は反映後の形に直した）:
  - AC17：状態反映の合否は「サーバが状態の変化を知らせるまで 2 秒未満（spec が assert する。サイドバーの描画は含まない）」と書き、
    「自動の E2E はこの値で合否を決めない」を `performance.spec.ts` だけの話に直した。LAN は近似であることを明記し、`ping` は
    平均でなく最大、母艦の Windows が ICMPv4 のエコー要求を止める場合の規則（`FPS-ICMP4-ERQ-In`。未確認）を足した。手の確認の
    16 pane は `performance.spec.ts` と同じ 4×4 の分け方の手順にした（分割で焦点が新しい pane へ移るので、キーのくり返しだけでは
    端が細くなる）。`--headed` には画面が要り、無ければ外すこと（値は SwiftShader のもの）。
  - `--scrollback 2000` の確かめは、ページを開き直してから `seq 1 6000` をやり直す（開いたままのページの端末は作ったときの 5,000 行
    のまま）。AC8 のページを開いたままの起動し直しは、構成と新しいシェルのプロンプトが戻り、前の画面と scrollback は戻らない。
  - Tailscale・リバースプロキシの任意の手順は、先に手元用（7780）と LAN 用（8443・`wtm-lan`）の `wtm serve` を止める（止めないと
    `already in use`・`EADDRINUSE`）。AC12 は 3 環境それぞれで行うことを明記し、PowerShell での `stty size`・ループ・`date` の
    置き換え（未確認）の表を足した（ログイン画面の文言はブラウザ側なので 1 環境でよい）。
  - 実機：ピンチは `touch-action: pan-x` の端末の上ではなく、上部のバーか追加キーの列の上で行い、実際に拡大されたことを確かめて
    から判断する。1 列のレイアウトの項目を、1 列の表示・追加キーの列・prefix のキー・pane ピッカー（workspace と tab の行、
    エージェントの pane の行。エージェントの居ない pane の行は無い）の具体的な手順と期待に分けた。手放すと、同じ tab を見ている PC へ
    すぐ権限が移る（打たなくてよい）。既知の制約の「はみ出す」は、スマートフォンで 1 文字打てば取り直せる（INPUT も権限を取る）。
  - 細部：手がかりが出るまでは、接続が切れた後なら約 7 秒・ページを開いた直後なら約 3 秒。copy モードの `ctrl+b` は prefix になる。
    herdr-parity.md の「Linux」「Windows ネイティブ」の参照を節の名前どおりに。PowerShell の関数は定義した窓でしか使えない
    （`$PROFILE`）。429 は 1 分以内に 5 回。`origin rejected` のログは同じ組ごとに 60 秒に 1 回。AC13 の `Ctrl+B` の二度押しは
    `cat -v` で `^B` を見る（Linux・WSL2 で）。
  - 確かめたこと（追加）：一時のスクリプト（Playwright）で、4×4 の手順で同じ大きさ（337×239）の 16 pane が 4 列 4 段に並ぶこと、
    `cat -v` への `Ctrl+B` の二度押しが `^B` になること、ページを開いたままの起動し直しで前の出力が消えて新しいプロンプトが出て、
    その後の出力も届き、開いたままの端末の scrollback が 5,000 のまま・開き直すと 2,000 になること。`127.0.0.1:7811` を使っている
    間に `0.0.0.0:7811` へ bind すると `EADDRINUSE`。画面の無い環境（`DISPLAY`・`WAYLAND_DISPLAY` を外す）では `headless: false`
    の起動が失敗する。`pnpm -s lint`・`pnpm -s typecheck` は exit 0。

## D110: 右クリックでメニューを開くときはマウスの報告を送らない・pane の枠を足す・リンクは Ctrl（macOS は Cmd）＋クリックだけで開く（2026-09-20・05 の T15 で発見（D109）→ 03-web-desktop T34）

- **背景**: D109 の「範囲外で見つけたこと」1〜3（design のマウス操作の表の M6・M7 との違い）。
  1. （M7 の前半）既定の `rightClick: 'herdr'` でも、アプリがマウスの報告を求めていると、右クリックでメニューが開くと同時に
     右ボタンの報告（`\e[<2;…M`・`\e[<2;…m`）もアプリへ届いた。`MouseBridge` は contextmenu でメニューを開くだけで、xterm.js が
     `term.element` の mousedown（bubble）で送る報告を止めていなかった。
  2. （M7 の後半）design の「pane の枠の右クリックは常にメニューを開く」が未実装で、「右クリックを pane に送る」にした後は、マウスを
     使うアプリが動いている間、その pane のメニューを開く（既定へ戻す）手段が無かった。枠にあたる要素も無かった。
  3. （M6）Ctrl を押さないクリックでも、出力の中の URL が新しいタブに開いた（`WebLinksAddon` に渡す handler が修飾キーを見ていない）。
     OSC 8 のリンクは `linkHandler` が無く、xterm.js の既定（修飾キーを見ずに `confirm()` を出して開く）のままだった。下線も修飾キーに
     関わらず、重ねると常に出た。
- **決定**:
  1. **M7 の前半（`term/MouseBridge.ts`）**：`term.element` に mousedown の**キャプチャ**の listener を付け、メニューを開く右クリック
     （右ボタン。macOS では Ctrl＋主ボタンも副ボタンのクリックになるので含める）で、アプリが報告を求めている（`mouseTrackingMode` が
     `none` でない）ときは `stopPropagation`・`preventDefault` して xterm.js の mousedown に届かせない——xterm.js は押した報告も、離した
     報告の document の listener もその処理の中で作るので、両方出なくなる。止めると xterm.js の mousedown がしていたフォーカス（M1）も
     走らないので `term.focus()` を呼ぶ（`TerminalPane` のキャプチャの `focusPane` は、既に選ばれている pane では DOM のフォーカスを
     戻さない）。ほかのボタンを押したまま右クリックした場合は、先の押下で付いた xterm.js の listener が右ボタンの離した報告を送るので、
     止めた押下と同じボタンの mouseup を document のキャプチャで 1 回だけ止める。
     - その mouseup を取りこぼしたとき（押している間に窓のフォーカスを奪われた・窓の外で離した等）は、窓の blur と、次の押下・動き
       （document のキャプチャ）でそのボタンが離れている（`buttons` にそのビットが無い）と分かった時点で止める待ちを外す（独立点検 #1）。
     - 止めた mouseup が最後に離したボタン（`buttons` が 0）なら、報告にならないボタン（`button` 3）の mouseup を document へ送って、
       xterm.js のマウスの追跡（押下の後に document へ付ける mouseup・ドラッグの listener。xterm.js はどのボタンも押していない mouseup
       で外す）を終わらせる（独立点検 #3）。xterm.js は主・中・副の 3 つとホイールしか報告しないので、この mouseup から報告は作らない。
     - `rightClick` が `pane` で報告を求めているとき（アプリへ渡す）と、報告を求めていないとき（xterm.js も報告を作らない）は何もせず
       xterm.js に任せる（以前と同じ）。D99 の印付け（`TerminalRegistry` の包みの要素のキャプチャ）は親の要素で先に走るので影響しない。
  2. **M7 の後半（`components/PaneFrame.vue` 新規・`PaneLayout.vue`・`App.vue`）**：デスクトップの本体の `PaneLayout` に `paneFrames`
     を付け、各葉を `PaneFrame` で包む。枠は**葉（`ViewSync` が測る要素）の外側**の 4px の縁（分割の境界の `Splitter` と同じ太さ。
     ふだんは背景の色で、重ねると境界の色、キーボードの焦点では白い線）。
     - 枠の右クリックは、`rightClick` の設定やアプリの報告に関わらず、常にその pane のメニューを開く（`UiPort.openContextMenu`）。
       枠の押下は pane を選んで端末にフォーカスする（M1。枠そのものはフォーカスを取らない）。
     - キーボード：枠は APG の menu button（`role=button`・`aria-haspopup=menu`・`aria-expanded`・pane の名前入りの `aria-label`）。
       Enter・Space・↓・Shift+F10・ContextMenu キーで開き、`main.ts` の window の keydown へは渡さない。**Tab で止まるのは選ばれている
       pane（`view.focusedPaneId`）の枠と端末だけ**（roving tabindex：選ばれていない pane の枠と、端末の入力欄（xterm.js の textarea。
       `TerminalPane` が上書きする）は `tabindex=-1`。独立点検 #2）。キーボードの道筋は、prefix のキー（`h/j/k/l`・`Tab`）で pane を
       選び、端末の外（ページの先頭。端末の中では Tab・Shift+Tab は端末へ届くので、ブラウザのキーで出る）から Tab で、サイドバー
       （Chromium ではスクロールできる要素として止まる）→ tab バーの tab → その pane より前の分割の境界（`Splitter`）→ その pane の枠。
       枠から Tab でその pane の端末へ入る。
     - `ContextMenu` は Esc・項目の選択で閉じたら、開く前にフォーカスしていた要素へ戻す（APG の Menu。以前は戻さず、閉じるとフォーカスが
       body に落ちて、右クリックした端末へも打てなくなっていた）。項目の処理がフォーカスを移すもの（ダイアログ・分割）は、戻した後に
       移し直す。外側のクリックでは戻さない。戻す先がもう文書に無ければ、選ばれている pane の端末へ移す。戻した先が後で消えるとき
       （選ばれていない pane を「閉じる」——`focusedPaneId` が変わらないので、ほかに移す処理が無い）は、`PaneFrame` が、枠の中にフォーカスが
       あるまま外れたら次の描画の後に（body に落ちていれば）選ばれている pane の端末へ移す（独立点検 #4）。
     - 枠の要素は端末を包まない（葉の兄弟として後ろに敷き、葉を `position: relative` で上に重ねる）——操作できる要素の入れ子にしない。
     - モバイル（`MobileShell`）には付けない：葉を PTY の大きさの縮小の枠に置くので、縁を足すと端末がはみ出る。
  3. **M6（`term/MouseBridge.ts`）**：OSC 8 の `linkHandler`（`allowNonHttpProtocols: false`）と `WebLinksAddon` の handler の両方を
     同じ条件で開く：主ボタンのクリックで、Ctrl（macOS は Cmd）を押していて、scheme が http/https のときだけ
     `window.open(url, '_blank', 'noopener,noreferrer')`。ただのクリック・右クリック（xterm.js はボタンを見ずに離したときに開こうとする）・
     `javascript:`・`file:`・`mailto:` 等は開かない。
     - 下線と指のカーソルは修飾キーを押している間だけ出す。xterm.js はリンクの `decorations` を読んで下線を出し、重なった後は自分の
       追跡用のもの（代入すると描き直す）へ差し替えるので、提供元が返すリンクに「今の修飾キーの状態」を返す `decorations` と、重なりを
       追う `hover`/`leave` を付け、修飾キーが変わったら重なっているリンクの `decorations` に代入する。OSC 8 の提供元は xterm.js が
       作るときに内部で登録し公開 API で差し替えられないので、内部の `_core._linkProviderService.linkProviders` の各提供元の
       `provideLinks` を包む（配列は差し替えない。`term/measure.ts` の `getCellSize` と同じく、版を固定した xterm.js 6.0.0 の内部。
       見つからなければ何もしない——開くかどうかは公開 API の handler で決めているので、崩れるのは下線・カーソルの出し分けだけ）。
       修飾キーの状態は window の keydown/keyup（キャプチャ）・`term.element` の mousemove（キャプチャ。リンクの判定より先）で追い、
       窓を離れたら（blur）押していない扱いに戻す。
     - 依存は増やしていない：`@xterm/addon-web-links` 0.12.0 は既に `packages/web` の依存にあり、`@xterm/xterm` 6.0.0 と同じコミット
       （`f447274`）から出た版（`package.json` の `commit`）。`package.json`・`pnpm-lock.yaml` は変えていない。
  4. **タッチ端末ではリンクを開かない**（D109 の指示の判断）：タップには修飾キーが無いので、上の条件で開かない。長押し等の別の開き方は
     用意しない（Android の長押しは contextmenu＝pane のメニュー。ソフトキーボードで修飾キーを押したままタップする手段は無い）。
     `docs/verification.md`「既知の制約」に書いた。
- **理由 / 代替案**:
  - 枠を `TerminalPane` の中（padding）に置く案は、`ViewSync` が葉で測る大きさより端末の置き場が狭くなり、右端・下端の文字が切れる
    （測り方を枠の分だけ引く形にすると `ViewSync` が枠を知ることになる）。端末の縁の上に透明な帯を重ねる案は、先頭の列・行の端の
    クリックをアプリから奪う。pane の名前の帯（タイトル）を足す案は 1 行ぶん高さを使い見た目が大きく変わる（herdr の枠は罫線で、
    名前の表示は H23＝後続）。葉の外側の縁なら、測る大きさ・端末の中のクリックはそのままで、見た目の変化は 4px の余白だけ。
  - 右ボタンの mousedown を報告の有無に関わらず常に止める案は、報告を求めていないときの xterm.js の処理（選択・フォーカス）を理由なく
    変えるので退けた。contextmenu で止める案は遅い（報告は mousedown で送られている）。
  - pane のメニューを開く prefix のキーを足す案は、既定のキーは herdr 互換（D56）で herdr に無いので足さなかった。メニューの項目のうち
    キーの無いのは「右クリックを pane に送る／herdr のメニューを使う」だけで、枠の Tab・Enter で届く。
  - （独立点検 #2）枠だけを roving tabindex にする案（指摘の案）は、実際の Tab の順を確かめると足りなかった：tab バーの次は DOM の順で
    先頭の pane の端末の入力欄で、端末は Tab を受け取るのでそこで止まり、2 つ目以降の pane の枠へは届かない。端末の入力欄も選ばれて
    いる pane だけを Tab で止まる場所にした（選ばれていない pane の端末に Tab で入ると、`focusedPaneId` と違う pane にキーが入る
    食い違いにもなっていた）。正の tabindex で枠を前に並べる案は、ページ全体の Tab の順を崩すので退けた。端末から出るのがブラウザの
    キー頼みなのは design の「フォーカスの抜け道」（`prefix+w` は DOM のフォーカスを動かさない）と同じ制約で、ここでは変えていない。
  - （独立点検 #3）止めた最後の mouseup をそのまま xterm.js に見せて listener を外させる案は、アプリが押しを受けていない右ボタンの
    離した報告を受けるので退け、報告にならない mouseup で外させた。
  - 開く scheme を広げる（`mailto:` 等）案は、OSC 8 はアプリが任意の URI を表示の文字と別に出せ、独自の scheme は OS のアプリを起動
    しうるので、xterm.js の既定と `WebLinksAddon` の範囲に揃えて http/https だけにした。
- **確かめたこと**（このマシン——WSL2 の上のコンテナの Linux——の Chromium・happy-dom）:
  - 単体：`MouseBridge.test.ts`（29 件。本物の xterm.js に、happy-dom で測れない座標の計算だけを差し替えて、報告（`onData`）・リンクの
    判定（`Linkifier`）・指のカーソルのクラスを観測）・`PaneFrame.test.ts`（12 件）・`ContextMenu.test.ts`（4 件追加）・
    `PaneLayout.test.ts`（4 件追加）・`TerminalPane.test.ts`（1 件追加）・`App.test.ts`（2 件追加）。
  - E2E：`keys-mouse-dialogs.spec.ts` に 4 件（M7 の既定の宛先：左クリックの報告が `cat -v` に出ることを対照に、右クリックでメニューが
    開き、ブラウザが送った INPUT（CDP）にも `cat -v` の行にも `<2;` が無く、Esc で端末へフォーカスが戻る／「pane に送る」：端末の上の
    右クリックは `^[[<2;…M^[[<2;…m` が出てメニューは開かず、pane の置き場の左端（`.app-panes` の左 2px）の右クリックでメニューが
    開き、そこから既定へ戻せる／枠のキーボード：tab バーから Tab で枠、Enter で開き、Esc で枠へ戻る／M6：URL と OSC 8 の両方で、
    ただのクリックでは 1.5 秒の間に新しいページが開かず、Ctrl＋クリックで開いたページの URL が一致し、Ctrl を押している間だけ指の
    カーソル）と、独立点検 #2 の 1 件（2 つに分けた右の pane を prefix のキーで選び直し、tab バーから Tab で「境界 → 右の pane の枠」と
    進み、Enter・↓・Enter で「右クリックを pane に送る」が右の pane にだけ効き、閉じると枠へ戻り、Tab で右の pane の端末へ入る）、
    `mobile.spec.ts` に 1 件（iPhone 13 のエミュレーションでタップしても開かない。押す前に、修飾キーを押して重ねると指のカーソルが出る
    ことで、ブラウザが URL を描いてリンクと判定していることを確かめる）。
  - 負の対照（修正を外すと落ちる）：単体は `MouseBridge.test.ts` の 10 件（例：herdr のまま報告が 2 つ（`\x1b[<2;2;2M`・`\x1b[<2;2;2m`）
    届く、ただのクリックで `openLink` が呼ばれる、OSC 8 で `confirm` が呼ばれる）、`ContextMenu`・`PaneLayout`・`App` の 6 件。E2E は
    新しい 5 件すべて（修正前の web を `vite build` して実行）：M7 の既定の宛先は送った INPUT に `\u001b[<2;9;3M`・`\u001b[<2;9;3m`、
    枠は右クリックでメニューが出ない（報告はアプリへ）、キーボードは枠が無い、M6 は URL のただのクリックで `opened`、タップで
    `opened: http://127.0.0.1:…/wtm-e2e-touch-link`。
  - E2E を書く途中で、xterm.js がリンクの判定を行ごとに覚え、同じ行の中を動く間は出力が変わっても判定し直さないことを確かめた
    （端末をクリックした行に、URL の無い頃の判定が残り、Ctrl を押しても指のカーソルが出なかった）。テストはいったん別の行へ動かして
    から重ねる（モバイルは別の行を先にタップする。そうしないと修正前の版でもリンクと判定されず、負の対照にならない）。
  - `pnpm -s typecheck`・`pnpm -s lint`・`pnpm -s test`（1066 passed）・`pnpm -s build`・`pnpm -s smoke`（PASS）はどれも exit 0。
    既定の E2E（`pnpm --filter @wtm/e2e test`）60 passed。変えた 2 つの spec の `--repeat-each=3` は 45 passed（独立点検の反映の後）。画面の写し（分割した
    2 pane・枠に重ねたとき・枠のメニュー・枠のキーボードの焦点）で見た目を確かめた。
- **影響**: `packages/web/src/term/MouseBridge.ts`・`components/PaneFrame.vue`（新規）・`components/PaneLayout.vue`・`components/ContextMenu.vue`・
  `components/TerminalPane.vue`（端末の入力欄の roving tabindex）・`App.vue` と各テスト（`PaneFrame.test.ts` は新規）、`packages/e2e/src/specs/keys-mouse-dialogs.spec.ts`・`mobile.spec.ts`・
  `support/frames.ts`（`watchSentInput`）、design.md（M3・M6・M7）・architecture.md（`term/MouseBridge`・`components/*`）・
  `docs/verification.md`（M7 の手順・AC14 のリンク・実機のリンク・既知の制約）・`docs/herdr-parity.md`（M7 の自動化）。
  `TerminalRegistry.ts`（tasks.md の対象に挙がっていた）は変えていない（止める listener は `MouseBridge` が `term.element` に付け、
  枠は測る大きさの都合で `TerminalPane` の中ではなく葉の外に置いた）。サーバは変えていない。受け入れ基準は AC14。
- **範囲外で見つけたこと（直していない）**:
  1. 上の xterm.js のリンクの行ごとの判定の覚え方（upstream の振る舞い）：出力の直後にポインタが同じ行の上にあると、別の行へ動かすまで
     リンクにならない。`docs/verification.md` の AC14 のリンクの手順に、別の行へ動かしてから重ねる旨を書いた。
  2. アプリがマウスの報告を求めているときに Ctrl＋クリックでリンクを開くと、xterm.js は Ctrl つきの左クリックの報告もアプリへ送る
     （リンクを開くのと両方）。design に定めが無いので変えていない。
  3. モバイル（`MobileShell`）には枠が無く、「pane に送る」にした pane でマウスを使うアプリが動いている間は、スマートフォンからその
     pane のメニュー（長押し＝contextmenu）を開けない（設定は pane ごとにサーバが持つので、PC で「pane に送る」にするとスマートフォンにも
     効く）。04 の範囲。要否の判断が要る。
- **独立点検の 5 件の反映**（2026-09-20。上の決定・理由・確かめたことは反映後の形に直した）:
  1. （should）止めた押下の mouseup を取りこぼすと、document のキャプチャの待ちが残り、後の関係の無い同じボタンの mouseup（「pane に
     送る」の右ボタンの離した報告、macOS の Ctrl＋クリックなら次の左クリックの離した報告・選択の終わり・M4 のコピー）を止めた →
     窓の blur・次の押下や動きでそのボタンが離れていると分かった時点で外す。単体 4 件（blur・mousemove・mousedown・macOS）。
  2. （should）Tab で届くのが先頭の pane の枠だけだった（その次の端末で止まる）→ 選ばれている pane の枠と端末だけを Tab で止まる場所に
     した（上の「理由 / 代替案」）。単体 2 件・E2E 1 件。design の M7・`docs/verification.md` の M7 の 4 に道筋を書いた。
  3. （nit）左を押す → 右を押す → 左を離す → 右を離す、の順で xterm.js の document の listener が残り、その後の mouseup・ドラッグが
     アプリへ報告された → 最後の mouseup を止めたら報告にならない mouseup で追跡を終わらせる。単体 1 件（1002 のモードで、その後の
     端末の外のドラッグと離す操作が報告されない）。
  4. （nit）「閉じる」等で戻す先が消えるとフォーカスが body に落ちた → 戻す先が無ければ、また枠の中にフォーカスがあるまま枠が外れたら、
     選ばれている pane の端末へ移す。単体 4 件。
  5. （nit）`mobile.spec.ts` のタップの前の固定の 500ms の待ち → 修飾キーを押して重ねると指のカーソルが出るのを待つ（ブラウザが描いて
     リンクと判定した印。修正前の版でも出るので、負の対照は成り立つ）。
  - 負の対照（反映の前の T34 の版に戻すと落ちる）：#1・#3 は `MouseBridge.test.ts` の新しい 5 件（#3：`[<0;2;2M, <0;2;2m]` のはずが
    `<32;2;2M`（ドラッグ）と `<0;2;2m` が足される。#1：「pane に送る」の右クリックの離した報告 `<2;2;2m`、macOS の次の左クリックの
    `<0;2;2m` が消える）。#2 は E2E で、tab バーから Tab の順が `frame@pane1 → terminal@pane1 → terminal@pane1 → terminal@pane1`
    （端末で止まり右の pane の枠へ届かない）。単体の #2・#4 は 5 件。#5 は T34 の前の版で `opened: http://127.0.0.1:…/wtm-e2e-touch-link`。

## D111: 着地前の `aidev verify` の 2 件の WARN について（2026-09-20・deliver）

- **背景**: `aidev verify` は PASS だが、次の 2 件の WARN が出る。黙って着地させると、後から読んだ人に
  「記録漏れを見落とした」のか「理由があって踏まなかった」のかが区別できないので、ここに残す。
- **(1) 親の test の差し戻しが 5 回（上限 3）だが `aidev debug` の記録が無い**:
  差し戻しの原因は毎回異なり、いずれもその場で特定できていた——D96（xterm.css の読み込み漏れ）・D98（流量制御）・
  05 の E2E の設定（並列で性能計測が他の spec と競合。D104）・03 の 2 件（隠れた pane の 1×1・ログインの文言。D105）・
  05 の E2E の支援（SNAPSHOT を出力として数えない。T16。購読を遅らせる一時の spec で決定的に再現）。
  `protocol-debug.md` の狙いは「同じ失敗を繰り返しているときに、まっさらなコンテキストへ原因究明を委譲する」ことなので、
  原因が特定済みで再現もできている差し戻しには使わなかった。**同じ趣旨の「同じコンテキストで回し続けない」は守り**、
  修正はすべて新しい実装コンテキストへ委ねた。なお 01 の review の差し戻し（4 回目）では `aidev debug` を実際に使い、
  その結論（`retry`）に従っている（`01-server-core/decisions.md` の「デバッグ D1」）。
- **(2) 04 の coding の `start` 3 回に対し `approved` 4 回**:
  統合 review の差し戻しで 04 を開き直したとき（T9）、`unapprove` の後に `event coding start` を打っているが、
  それ以前のどこかで `start` を 1 回打ち漏らしている（どの回かは metrics.yml からは特定できない）。
  `protocol.md`「8.」のとおり**後から ts を辻褄合わせしない**ので、04 の coding の所要時間は 1 回分が欠けたまま扱う。
