# 要件: 外部操作 API / CLI（herdr の socket API / CLI 相当）

## 背景 / 課題

本製品（Web ターミナルマルチプレクサ）は、ブラウザ⇄サーバの WebSocket（JSON RPC＋バイナリフレーム）でしか
操作できない。herdr（TUI 版の相当製品）は、ローカルソケット（Unix domain socket / Windows named pipe）越しの
JSON API と、それをラップする CLI を持ち、スクリプト・他のツール・他のエージェントから workspace の作成・分割・
入力送信・出力読取・状態購読ができる（`.aidev/works/20260918-web-terminal-multiplexer/research.md` F7 の
H38〜H40）。本製品にはこの手段が無く、`.aidev/backlog/product-roadmap.md` 10 行目の項目として後続に回されていた。

外部から操作できないと、ブラウザを手で開かずに自動化（CI・定型作業）したり、他の AI エージェント（オーケストレーター）が
本製品の pane を使って別のエージェントと連携する、といった使い方ができない。

## 目的 / ゴール

ブラウザを介さずに、外部のスクリプト・CLI・他のプロセス（他の AI エージェント含む）から、動いている `wtm serve` の
workspace / tab / pane を**作成・分割・入力送信・出力読取・状態購読**できる状態にする。既存のブラウザ操作・
既存の認証の仕組みは変えない。

## ユーザーストーリー

- US1: 開発者・CI スクリプトとして、ブラウザを開かずに新しい workspace を作ってコマンドを実行し、その結果を読み取りたい。
  なぜなら、手でブラウザを操作せずに定型作業や検証を自動化できるから。（受け入れ: AC1, AC2, AC7, AC8）
- US2: 別の AI エージェント（オーケストレーター）として、既存セッションの pane に入力を送り、出力を読み、
  状態変化（pane の作成・close・エージェント状態変化など）を購読して次の判断に使いたい。なぜなら、人間のブラウザ操作を
  待たずに複数のエージェント・複数の pane をまたいだ連携ができるから。（受け入れ: AC3, AC4, AC5, AC6）
- US3: 運用者として、既存の token 認証・Origin/Host 許可の仕組みのまま外部 CLI を使いたい。なぜなら、
  別の認証機構を覚えたり、新しい攻撃面（新規ソケット・新規認証エンドポイント等）を増やしたくないから。
  （受け入れ: AC9, AC10, AC11）
- US4: この work のメンテナ・後続 work の担当者として、`docs/herdr-parity.md` の対応表が現状を正しく
  反映していてほしい。なぜなら、対応表が古いままだと「後続に何が残っているか」を追跡できず、
  同じ範囲を重複して調査・実装してしまうから。（受け入れ: AC12）

## スコープ

### 対象

- 外部操作用 CLI（新規パッケージ。バイナリ名は `wtmctl`）。1 回の呼び出しで 1 コマンドを実行し終了する
  （herdr の CLI ラッパーと同じ使用感。対話シェルは提供しない）。
- CLI が使う認証・トランスポートは**既存のものをそのまま再利用**する：`POST /api/login`（token）→ session cookie →
  `/ws` への接続（`client.hello` → 既存の JSON RPC 方式 + 入力用バイナリフレーム）。新しい認証エンドポイント・
  新しいトランスポート（Unix domain socket・named pipe 等）は追加しない。
- 操作コマンド：
  - workspace の作成・close・rename（既存 RPC `workspace.create` / `.close` / `.rename` を CLI から叩く）
  - tab の作成・close（既存 RPC `tab.create` / `.close`）
  - pane の分割・close（既存 RPC `pane.split` / `.close`）
  - pane への入力送信（既存のバイナリ INPUT フレームで、生テキスト送信 / 実行〔テキスト＋Enter〕の 2 段）
  - pane の出力読取（既存 RPC `pane.subscribe` が返す SNAPSHOT を 1 回読む／`--follow` で OUTPUT を継続的に読み続ける。
    **これは herdr の「閲覧専用の購読」（H40。後述「対象外」参照）とは別物**——既存の `pane.subscribe` を
    そのまま呼ぶだけで、専用の排他制御・専用フレーミング・タイムアウト規約は持たない。単に「その CLI 呼び出しの
    間だけ出力を受け取り続けるか、1 回で終えるか」の違い）
  - 状態の一括取得（`client.hello` の応答に載る `SessionSnapshot` をそのまま出す）
  - 状態購読（`/ws` が全クライアントへ配る `ServerEvent`〔`workspace.created` 等〕を NDJSON として流し続ける）
- 認証の CLI 側の扱い：token でのログインとセッションのローカルキャッシュ（毎回 token を打たずに済む）、
  失効時の 1 回だけの再ログイン。
- サーバ側の変更は**必要最小限**に留める：`client.hello` の `kind` に、ブラウザではない外部クライアントを表す値を
  1 つ追加する（design で確定）。それ以外の RPC・イベント・認証・Origin 判定は変更しない。この追加は、
  pane のサイズをどのクライアントが決めてよいかを判定する既存の仕組み（サイズ権限の判定。
  `packages/server/src/clients/SizeAuthority.ts`）にも関わる——画面を持たない CLI が誤ってサイズ権限を
  持たないようにする（AC10 参照）。
- `docs/herdr-parity.md` の H38・H39・H40 行を、この work の対応内容に応じて更新する（H41 行は別の未マージ PR の
  対象なので触らない）。

### 対象外（後続へ）

- **H39: エージェント自動化**（`agent start` / `agent prompt --wait` / `agent wait` / `agent read` 相当。
  herdr 独自のエージェント lifecycle 管理・agent skill ファイルの配布を含む）。理由は research.md 参照。
- **H40: pane 単体への直接接続・閲覧専用の購読・制御ストリーム**
  （`terminal attach` / `terminal session observe` / `terminal session control` 相当）。herdr のこれらは
  「1 つの書き込み所有者を排他的に奪い合う（`--takeover`）」「base64 の ANSI フレームを専用の
  newline-delimited JSON プロトコルで流す」「無進行 30 秒で切断する」といった、**本 work の
  `wtmctl pane read --follow`（上記「対象」）とは異なる専用の設計**を要する（排他制御・専用フレーミング・
  タイムアウト規約はいずれも本 work にはない）。理由の詳細は research.md F5 参照。
- 複数ホストの集約（herdr の `--machine` 経由の転送）、named session（複数の独立したサーバ名前空間）、
  plugin（`plugin install` 等）、通知の外部送出（`notification show` 相当）。いずれも herdr 側にも存在するが、
  本 backlog 項目の文言（「workspace 作成・分割・入力送信・出力読取・状態購読」）の範囲外。
- pane の出力読取における herdr 相当の `--source visible|recent|recent-unwrapped|detection` の作り分け・
  bracketed paste を使った atomic な submit（herdr の `pane run` 相当の高度化）。MVP は「現在の画面
  （SNAPSHOT）」と「以後の出力（OUTPUT の継続）」の 2 種類だけを提供する。
- Windows・macOS の実機での動作確認（`docs/verification.md` の実機検証の対象に含めない）。CLI は Node の
  `fetch`/`ws` だけを使い、サーバ側もこの work では OS 固有コードを追加しないため、原理上は動くはずだが
  **未検証のまま残す**（後述の非機能要件）。

## 機能要件

- FR1: `wtmctl login --url <URL> --token <TOKEN>` で `/api/login` を叩き、得た session cookie をローカル
  （利用者のホームディレクトリ配下）にキャッシュする。
- FR2: `wtmctl workspace create [--cwd <path>] [--label <text>]` で workspace（＋最初の tab・pane）を作成し、
  作成された workspace / tab / pane の ID を JSON で標準出力へ返す。
- FR3: `wtmctl workspace close <workspaceId>` / `wtmctl workspace rename <workspaceId> <label>`。
- FR4: `wtmctl tab create [--workspace <id>] [--label <text>]` / `wtmctl tab close <tabId>`。
- FR5: `wtmctl pane split <paneId> --direction right|down [--ratio <n>]` で分割し、新しい pane の ID を返す。
- FR6: `wtmctl pane close <paneId>`。
- FR7: `wtmctl pane input <paneId> <text>` で、指定した pane へ生のバイト列（UTF-8）をそのまま送る（Enter は
  付けない。herdr の `pane send-text` に相当）。
- FR8: `wtmctl pane run <paneId> <command>` で、指定した pane へ `<command>` に続けて改行を送る（herdr の
  `pane run` に相当する簡易版。bracketed paste のような atomic 化は行わない——上記「対象外」参照）。
- FR9: `wtmctl pane read <paneId> [--follow] [--raw] [--timeout <ms>]` で、その時点の画面内容
  （SNAPSHOT）を取得して表示する。`--follow` を付けると、以後届く出力（OUTPUT）を Ctrl-C まで標準出力へ
  流し続ける。既定は ANSI エスケープを簡易的に除去したテキストで表示し、`--raw` で除去前のバイト列をそのまま出す。
- FR10: `wtmctl snapshot [--url <URL>]` で、動いているサーバの `SessionSnapshot`
  （workspace / tab / pane / agent の状態一式）を JSON で一括取得する。
- FR11: `wtmctl watch [--json]` で、`/ws` が配る状態変化イベント（`workspace.created` 等）を NDJSON として
  標準出力へ流し続ける（Ctrl-C まで）。
- FR12: 認証エラー（`/ws` の upgrade が 401 等）を受けたら、キャッシュしたセッションを破棄し、token が
  分かっていれば（`--token` 明示 or 直前の FR1 のキャッシュに紐づく token 保存はしない——後述の非機能要件）
  1 回だけ再ログインして再試行する。再試行できなければ、原因が分かるエラーメッセージを添えて終了コード 1 で終わる。
- FR13: すべてのコマンドは、成功時は結果を JSON で標準出力へ、失敗時はエラーを JSON で標準エラーへ出し、
  終了コードで成否を表す（0=成功、1=サーバ・プロトコルのエラー、2=CLI 自身の使い方の誤り。herdr の
  `cli-reference.mdx`「Wait commands have no default timeout … invalid CLI syntax exits with status 2」と
  同じ切り分け）。

## 非機能要件 / 制約

- **新しい認証方式・新しいネットワークトランスポートを追加しない**。CLI は既存の `POST /api/login` →
  session cookie → `/ws` の経路だけを使う（design で「なぜ Unix domain socket 等を追加しないか」を記録する）。
- **Origin/Host の許可リストを CLI 用に緩めない**。CLI は接続先の URL から Origin ヘッダを自分で組み立てて送る
  （ブラウザと同じ「許可された宛先しか使えない」制約を CLI 自身も受ける）。
- CLI は Node.js（`>=24`。他パッケージと同じ）で動く。OS 固有の実装（PTY・ConPTY 等）は持たない――
  実機（Windows・macOS）での動作確認はこの work のスコープ外（「対象外」参照。未検証のまま残す）。
- 既存のビルド・型検査・単体テスト・起動確認（`aidev smoke`）を壊さない。
- **トークンをディスクに保存しない**（FR1 でキャッシュするのは session cookie のみ）。再ログインが必要な場面
  （FR12）では、利用者が改めて `--token` を渡すか `wtmctl login` を打ち直す前提とする（安全側に倒す。
  token はサーバの全操作を奪える強い認証情報のため）。

## 完了条件 (受け入れ基準)

- [ ] AC1: `wtmctl workspace create` を実行すると、サーバ上に新しい workspace が作られ、
      workspace / tab / pane の ID を含む JSON が標準出力に出る（サーバ側の `workspace.create` の結果と一致）。
- [ ] AC2: `wtmctl pane split` を実行すると、既存 pane が指定した方向に分割され、新しい pane の ID が返る。
- [ ] AC3: `wtmctl pane input` / `wtmctl pane run` で送った入力が、対象 pane の実プロセス（シェル）に届く
      （実 PTY での往復を確認する）。
- [ ] AC4: `wtmctl pane read` で、その時点の画面内容を取得できる。`--follow` を付けると、以後の出力
      （他クライアントの操作によるものを含む）を継続的に受け取れる。
- [ ] AC5: `wtmctl snapshot` で、動いている workspace / tab / pane / agent の状態を一括取得できる。
- [ ] AC6: `wtmctl watch` で、別のクライアント（ブラウザ等）が起こした状態変化イベントを、遅滞なく
      （ポーリングでなく push で）受け取れる。
- [ ] AC7: 有効な token を持たない呼び出しはすべて失敗し、有効な token でログインした後はセッションが
      再利用され、以後のコマンドは毎回 token を要求しない。
- [ ] AC8: `wtmctl` はビルド後、既存の `pnpm -s build` / `pnpm -s typecheck` / `pnpm -s test` /
      `aidev smoke` のいずれも壊さない（新規パッケージの追加によるモノレポ設定の破損が無いことを含む）。
- [ ] AC9: 許可リスト外の Origin/Host からの接続は、CLI 経由でも既存どおり拒否される
      （`OriginPolicy` の既存の判定をそのまま通ることを確認する。CLI 用の迂回経路を作らない）。
- [ ] AC10: `client.hello` の `kind` に外部クライアント用の値を追加しても、既存の `desktop` / `mobile`
      クライアントの挙動（特に pane サイズ権限 `SizeAuthority` の判定）が変わらない（既存のユニットテストが
      無改造または最小限の追加で示す。回帰が無いこと）。
- [ ] AC11: 新しい認証エンドポイント・新しいネットワークトランスポート（Unix domain socket・named pipe 等）を
      追加していないことを review で確認する（design の decisions.md に理由を記録済みであること）。
- [ ] AC12: `docs/herdr-parity.md` の H38・H39・H40 行が、この work の対応内容（H38: 対応した範囲。
      H39・H40: 後続として残すこと）を反映して更新されている。

## 未確定事項 / 確認したいこと

- なし（herdr の socket API / CLI の正確な形状は research.md で確認済み。設計判断〔既存 WS 再利用 vs 新規
  ソケット、`kind` の追加、session cookie のキャッシュ場所〕は design.md で確定する）。
