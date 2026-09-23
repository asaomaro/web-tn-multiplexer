# 調査: サーバ再起動後のエージェント会話の再開

## 調査の問い

- Q1: herdr は実際にどうやって「エージェントの会話の再開」を実現しているか（研究開始時点では
  20260918 の research.md F6.2「連携が報告した会話 ID が前提」という間接情報しかなかった）。
- Q2: Claude Code・Codex 自身は、ID を使わずに「このディレクトリの直近の会話を再開する」機能を
  公式に持っているか。持つ場合、複数 pane が同じディレクトリで同時に使うと何が起きるか。
- Q3: Claude Code・Codex 以外の herdr 対応エージェント（22種）に、同様の再開手段はあるか。
- Q4: Claude Code の `SessionStart` フック・Codex の `hooks` 機能の正確な設定書式・受け取る
  ペイロード・実行時の安全性（起動を遅延させないか、環境変数を引き継ぐか）は何か。
- Q5: herdr は連携（フック）のインストールをどうトリガーしているか（自動か、明示操作か）。

## 判明した事実

### F1: herdr 本来の「会話の再開」は、公式フック経由の正確なセッションIDが前提（Q1）

herdr 公式ドキュメント（`https://github.com/herdrdev/herdr` の `docs/versions/0.9.1/website/src/content/docs/*.mdx`。
`herdr.dev/docs/...` として公開。リリース 0.9.1 を主に参照。`docs/next`（未リリース）との差分は
Qwen Code/Letta Code の追加程度で、以下の結論に影響しない）を実際に取得して確認した。

- F1.1 `session-state.mdx`「Native agent session restore」節（全文引用）：
  > "Some agents can resume their own conversation sessions. Herdr can use official
  > integration-reported session references to restart supported agent panes after a Herdr
  > server restart."
  >
  > "Native agent session restore is enabled by default." 無効化は `[session] resume_agents_on_restore = false`。
  >
  > "Herdr only resumes panes that reported a native session reference through a current
  > official Herdr integration."
  >
  > "Unsupported, missing, invalid, duplicated, or stale session references restore as normal
  > shells in the saved pane directory."
  - **ID なしの「直近を再開」的なフォールバックへの言及は、`session-state.mdx`/`integrations.mdx`/
    `agents.mdx` のいずれにも一切無い**（3ファイルとも確認済み）。herdr は「正確な ID か、さもなくば
    ただのシェル」という二択の設計。
- F1.2 `session-state.mdx` の resume コマンド表（一部抜粋。全 18 エージェント分が列挙されている）：

  | agent | resume command |
  |---|---|
  | Claude Code | `claude --resume <id>` |
  | Codex | `codex resume <id>` |
  | Cursor Agent CLI | `cursor-agent --resume <id>` |
  | GitHub Copilot CLI | `copilot --resume=<id>` |
  | Devin CLI | `devin --resume <id>` |
  | Droid | `droid --resume <id>` |
  | Grok CLI | `grok --resume <id>` |
  | Antigravity CLI | `agy --conversation <id>` |
  | Kimi Code CLI | `kimi --session <id>` |
  | Qoder CLI | `qodercli --resume <id>` |
  | Qwen Code | `qwen --resume <id>` |
  | Letta Code | `letta --conversation <id>` |
  | OpenCode | `opencode --session <id>` |
  | Kilo Code CLI | `kilo --session <id>` |
  | Hermes Agent | `hermes --resume <id>` |
  | MastraCode | `mastracode --thread <id>` |
  | Pi | `pi --session <path-or-id>` |
  | OMP | `omp --resume=<path-or-id>` |

  いずれも **ID 必須**。
- F1.3 `integrations.mdx`「How Herdr uses integrations」節（全文引用）：
  > "Herdr uses integrations in two ways:"
  >
  > | Integration type | Agents | Effect |
  > |---|---|---|
  > | Lifecycle authority | Pi, OMP, Kimi Code CLI, OpenCode, Kilo Code CLI, MastraCode | フックが idle/working/blocked を報告し、画面判定を使わない |
  > | Session identity | Claude Code, Codex, GitHub Copilot CLI, Devin CLI, Droid, Qoder CLI, Qwen Code, Letta Code, Cursor Agent CLI, Hermes Agent, Antigravity CLI, Grok CLI | フックは再開用のセッション参照だけを報告。状態は引き続き画面判定 |

  Claude Code・Codex は「Session identity」群＝**状態判定は本製品と同じ画面判定のまま、
  フックが担うのはセッションIDの報告だけ**（20260918 research.md F4.3 と整合）。
- F1.4 `integrations.mdx` の Claude Code / Codex 個別節（全文引用）：
  > "## Claude Code — The hook reports Claude Code session identity to the local Herdr socket
  > on session start. Claude Code state comes from Herdr's screen manifest detection. Herdr uses
  > `~/.claude` by default, or `CLAUDE_CONFIG_DIR` when set. ... Install writes
  > `hooks/herdr-agent-state.sh` and updates `settings.json` with Herdr hook entries."
  >
  > "## Codex — The Codex hook reports session identity through the same local socket API used
  > by other integrations. Codex state comes from Herdr's screen manifest detection. Herdr uses
  > `~/.codex` by default, or `CODEX_HOME` when set. ... ensures `[features] hooks = true` in
  > `config.toml`."

  → herdr は **Claude Code / Codex 自身が公式に持つフック機構**（F4 参照）をそのまま使っており、
  herdr 独自のフック方式ではない。herdr 固有なのは「report 先（herdr 自身のローカル socket）」と
  「インストーラ（設定ファイルへの書き込み処理）」だけ。**本 work が計画する
  「同じ公式フックを使い、report 先を本製品自身の受け口に変える」という方針は、herdr が実運用で
  証明済みの方式を踏襲するもの**であり、新規性のリスクは低いと判断できる。
- F1.5 `agents.mdx` の Integration role 表（20 エージェント中）：
  - **state and session**（lifecycle 権威＋resume 両方）: Pi, OMP, Kimi Code CLI, OpenCode,
    Kilo Code CLI, MastraCode
  - **session**（resume 用 ID のみ）: GitHub Copilot CLI, Devin CLI, Hermes Agent, Qoder CLI,
    Qwen Code, Letta Code, Droid, Claude Code, Codex, Cursor Agent CLI, Grok CLI, Antigravity CLI
  - **none**（画面判定のみ、resume 報告なし）: Amp, Kiro CLI, Maki, Muse
  - 表外・記載薄い: Gemini CLI, Cline（"Detected but less thoroughly tested" とのみ）

### F2: herdr の連携インストールは「検出は自動・インストールは常に明示操作」（Q5）

- F2.1 `integrations.mdx` 冒頭：
  > "Herdr detects supported agents automatically. Install official integrations when you want
  > native agent session restore, direct lifecycle reports, or both."

  検出（自動）とインストール（明示）を明確に分離している。
- F2.2 インストール操作そのもの（`integrations.mdx`・`cli-reference.mdx`）：
  > "Open settings inside Herdr and use the integrations tab to install recommended integrations
  > for agents found on your `PATH`, or run commands manually:" → `herdr integration install claude`
  > （pi/omp/codex/copilot/devin/droid/kimi/opencode/kilo/hermes/qodercli/qwen/letta/cursor/
  > mastracode/antigravity-cli/grok も同型）。
  `cli-reference.mdx` には `herdr integration install <name>` / `uninstall <name>` /
  `status [--outdated-only]` の3 verb のみ。**一括・非対話フラグ（`--yes`/`--all` 相当）は
  `integration` サブコマンドには存在しない**（別サブコマンド `herdr plugin install ... --yes` と
  混同しないこと）。
- F2.3 唯一の自動的な導線は**初回オンボーディング**（`configuration.mdx`）：
  > "Herdr shows first-run setup when `onboarding` is missing or true. Continuing from onboarding
  > writes `onboarding = false` and opens settings on the integrations tab."

  「integrations タブを開く」ところまでは自動だが、**個々のエージェントのインストール実行は
  利用者の選択が要る**。config-reference.json（全設定キーの原本、1522行）を全文検索しても
  `integration`/`auto_install` に一致するキーは無く、**サイレントな自動インストールの設定は
  存在しない**。
- 結論: **検出＝自動、導入＝常に明示操作**という設計は、本 work の requirements.md
  AC-I1（明示操作でのみ導入）と整合する。追加の設計変更は不要。

### F3: Claude Code・Codex 自身の「ID なし」機能と、その並行利用時のリスク（Q2）

herdr の連携とは独立に、両 CLI 自身が持つ機能（公式ドキュメント確認済み）。

- F3.1 Claude Code: `claude --continue`/`-c` は cwd 内の直近の会話を ID なしで再開する
  （code.claude.com/docs/en/sessions）。**同じディレクトリで2つの端末が同じ会話を fork せず再開すると、
  両方のメッセージが1つの transcript に混線する**（公式ドキュメントに明記）。回避には
  `--continue --fork-session` で独立コピーを作る必要がある。`--resume`（ID 無し）は
  インタラクティブなピッカーを開くため、非対話の自動復元には使えない。
- F3.2 Codex: `codex resume --last` は cwd 内の直近セッションを ID なしで再開する
  （developers.openai.com/codex）。**Codex 0.155.1 以降、同じ会話を2つ目のプロセスが resume すると
  「🔒 This conversation is open in another app」でロックされ、手動で `R` を押すまで進まない**
  （openai/codex#46652）。
- F3.3 上記のとおり、**同一ディレクトリに同種エージェントの pane が複数ある場合、ID なし方式では
  正しく個別再開できない**（Claude Code は混線、Codex はロック）。この事実が、利用者との協議で
  「ID なし方式ではなく、Claude Code・Codex に限定した正確な ID 方式（フック連携）を今回実装する」
  という決定の直接の根拠になった（decisions.md 参照）。

### F4: Claude Code の `SessionStart` フックの正確な仕様（Q4）

出典: `code.claude.com/docs/en/hooks`・`code.claude.com/docs/en/hooks-guide`・
`code.claude.com/docs/en/settings`（すべて現行の公式ドキュメント。旧 `docs.claude.com` は
`code.claude.com` へ 301 リダイレクト）。

- F4.1 設定は `settings.json`（プロジェクトの `.claude/settings.json` /
  `.claude/settings.local.json`、または利用者の `~/.claude/settings.json`）の `hooks` キー配下、
  `SessionStart` 配列に置く：
  ```json
  {
    "hooks": {
      "SessionStart": [
        {
          "matcher": "startup|resume",
          "hooks": [{ "type": "command", "command": "...", "async": true }]
        }
      ]
    }
  }
  ```
  `matcher` は `source` フィールド（`startup`/`resume`/`clear`/`compact`/`fork`）に対する正規表現。
  省略・空文字なら全ソースに発火。**「既存の `hooks` キーがあれば置き換えず、イベント名を
  兄弟キーとして追加する」**ことが公式ガイドで明示されている（他ツール・利用者自身の hooks を壊さない）。
- F4.2 hook へは **stdin に JSON** で渡る（コマンド型の場合）。共通フィールド：`session_id`・
  `transcript_path`・`cwd`・`hook_event_name`・`permission_mode`。`SessionStart` 固有フィールドは
  **`source`**（`startup`/`resume`/`clear`/`compact`/`fork`）。`model` は `SessionStart` だけが
  受け取りうる（常にではない）。
- F4.3 **環境変数はそのまま引き継がれる**（公式ドキュメント原文）：「A hook process inherits the
  parent environment, apart from the `OTEL_*` exporter variables ... and, when
  `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`, the variables it strips.」→ pane 起動時に環境変数
  （例: pane の id）を仕込んでおけば、hook スクリプトから読める。
- F4.4 **`SessionStart` は終了コードでセッション開始をブロックできない**（「Session already
  started; exit code 2 isn't honored」）。ただし**既定のタイムアウトは 600 秒**（`SessionStart` は
  短縮タイムアウト対象イベントの一覧に含まれない）ため、hook コマンド自体が長時間ハングすると
  `claude` の起動がその分待たされる。`"async": true` を付ければバックグラウンド実行になり、
  起動を遅延させない。**hook はターミナルを持たない**（`/dev/tty` を開けない）ため、
  ソケット/ファイル/HTTP 経由で報告する設計にする必要がある。
- F4.5 グローバル設定は macOS/Linux が `~/.claude/settings.json`、Windows は
  `%USERPROFILE%\.claude\settings.json`。`CLAUDE_CONFIG_DIR` を設定している場合はそちらを使う
  （3 OS 共通で上書きされる）。

### F5: Codex の `hooks` 機能の正確な仕様（Q4）

出典: `developers.openai.com/codex/hooks`（`learn.chatgpt.com/docs/hooks` からリダイレクト）・
`developers.openai.com/codex/config-advanced`。openai/codex#2150（メンテナ本人のコメントで
v0.114 に experimental merge されたことを確認）。

- F5.1 Codex の hooks は Claude Code のものと**意図的に近い設計**（イベント名・`matcher`・
  `type: "command"` の形が同じ）。ドキュメント自身が「Codex sets `CLAUDE_PLUGIN_ROOT`/
  `CLAUDE_PLUGIN_DATA` for compatibility with existing plugin hooks」と明言しており、
  互換性は偶然ではない。既定で有効（`[features] hooks = false` で無効化）。
- F5.2 `SessionStart` イベントが存在し、`matcher` は `source`（`startup`/`resume`/`clear`/
  `compact`）でフィルタする。設定例（公式ドキュメント原文）：
  ```toml
  [[hooks.SessionStart]]
  matcher = "^compact$"

  [[hooks.SessionStart.hooks]]
  type = "command"
  command = '/usr/bin/python3 "$(git rev-parse --show-toplevel)/.codex/hooks/session_start.py"'
  ```
  設定の置き場所は `~/.codex/hooks.json`・`~/.codex/config.toml`・リポジトリ配下の
  `.codex/hooks.json`・`.codex/config.toml`（本 work では利用者単位の `~/.codex/hooks.json` を使う
  想定。`config.toml` を直接いじるより、専用ファイルの方が導入・解除が単純で他設定を壊しにくい）。
- F5.3 ペイロードは **stdin JSON**。共通フィールド：`session_id`・`transcript_path`・`cwd`・
  `hook_event_name`・`model`・`turn_id`。例（`SessionEnd` のものだが共通形はそのまま）：
  ```json
  { "session_id": "thr_123", "transcript_path": "/workspace/.codex/rollout.jsonl",
    "cwd": "/workspace", "hook_event_name": "SessionEnd", "reason": "other" }
  ```
- F5.4 **既定はブロッキング**（「Codex waits for a command hook to finish before continuing」）、
  既定タイムアウトは 600 秒（`SessionEnd`/`Interrupt` は 1〜3 秒）。`async = true` で
  バックグラウンド実行にできる（`SessionEnd` を除く）。Claude Code と同じく、
  **本製品の hook は `async: true` にして起動を遅延させない設計にする**。
- F5.5 `CODEX_HOME`（既定 `~/.codex`）を上書き可能。Windows のパスは一次資料で直接の文言は
  取れなかったが、`~/.codex` の解決規則から `%USERPROFILE%\.codex` になると推測される
  （二次資料で裏付けあり、一次資料の直接引用ではない点に注意）。
- F5.6 別機構の `notify`（`agent-turn-complete` イベントのみ、`sys.argv[1]` に JSON。
  `thread-id`/`cwd` を含む）も存在するが、**発火が最初のターン完了後で SessionStart より遅い**ため、
  本用途には使わない（起動直後に ID を捕捉したいため）。

### F6: 環境変数の引き継ぎ経路（Q4 の補足。design への申し送り）

本製品はすでに pane 起動時に `CreatePaneOptions.env` を渡せる口を持つ
（`packages/server/src/terminal/TerminalManager.ts:6-12`）。F4.3・F5.3 により、
ここで `WTM_PANE_ID` のような環境変数を仕込めば、シェル→（利用者が起動する）`claude`/`codex`→
その hook スクリプトまで、通常の OS プロセス継承でそのまま渡ることが確認できた
（Claude Code は明文で確認、Codex は「ドキュメントに反する記述が無い」ことまでの確認）。

## 影響範囲

- `packages/server/src/persist/SessionFile.ts`: `SessionFilePane` にセッションID相当の項目を追加する
  スキーマ変更が要る（`schema: 1` → 2 への互換 upgrade、または optional field 追加で足りるかは design
  で判断）。
- `packages/server/src/session/SessionService.ts`: `restorePaneProcess`/`spawnForPane` 周りに
  「exact-ID resume コマンドの投入」を差し込む。`updatePaneRuntime` の `touch()` 条件
  （現状 `cwdChanged` のみ。line 484）に、報告された ID の変化も足す必要がある。
- `packages/server/src/terminal/TerminalManager.ts` / `TerminalHost.ts`: pane 起動時の環境変数注入
  （`CreatePaneOptions.env`）と、起動直後にコマンド文字列を書き込む経路（`TerminalHost.write`）は
  既存の口をそのまま使える。
- 新規: hook スクリプトのインストーラ（`~/.claude/settings.json` の `hooks.SessionStart` 追記、
  `~/.codex/hooks.json` の新規/追記）と、report を受け取るローカル IPC（設計で確定。案:
  Unix domain socket。Windows は名前付きパイプ相当）。
- `packages/web/src/components/SettingsDialog.vue`: 導入状態表示・導入/解除操作・自動再開 ON/OFF の
  UI を追加する新しい節が要る。
- `packages/protocol`: pane の永続化データ・設定 RPC に新しいフィールドが要る可能性（design で確定）。

## 実現性 / リスク

- 技術的には実現可能（両 CLI とも公式ドキュメントに明記された安定した拡張点を使う。herdr も
  同じ拡張点を使って実運用している実績がある）。
- リスク1: 両社のフック機能は比較的新しい（Codex は "Experimentally merged" と明記）。
  利用中の CLI バージョンによってはフックが効かない可能性がある——導入前にバージョン確認を促す、
  または `SessionStart` が届かなくても実害が出ない設計（届かなければ従来どおりプレーンなシェル）
  にすることでこのリスクを吸収する。
- リスク2: hook が同期実行（既定）だと起動を最大 600 秒待たせうる。**`async: true` を必ず付ける**
  ことで対処（F4.4・F5.4）。
- リスク3: report 経路（ローカル socket 等）の安全性——他利用者・他プロセスが偽の ID を報告できたり、
  他 pane の情報を読めたりしない設計が要る（design で具体化。要件の非機能要件に既に明記）。

## 実装アンカー

- A1: pane 起動時の環境変数注入口（`CreatePaneOptions.env`）—
  `packages/server/src/terminal/TerminalManager.ts:6-12`・`:45-56`（`create()` が
  `env: opts.env ?? process.env` を組み立てて `ptyBackend.spawn` に渡す）。
- A2: pane 起動直後にコマンド文字列を書き込む口 —
  `packages/server/src/terminal/TerminalHost.ts:78-80`（`write(input)` → `this.pty.write(input)`）。
- A3: 復元時の pane 起動処理 —
  `packages/server/src/session/SessionService.ts:612-620`（`restorePaneProcess`）・
  `:527-536`（`spawnForPane`）。exact-ID resume コマンドの投入はこの直後に差し込む。
- A4: 永続化の書式と保存処理 —
  `packages/server/src/persist/SessionFile.ts:9-16`（`SessionFilePane`）・
  `packages/server/src/composeServer.ts:284-310`（`toSessionFileData`。ライブの `pane.agent`
  から都度組み立てるため、pane 型に持たせれば保存には自動的に乗る）。
- A5: 保存の起動条件（debounce のトリガ） —
  `packages/server/src/session/SessionService.ts:462-484`（`updatePaneRuntime`。
  現状 `cwdChanged` のときだけ `persist.touch()` を呼ぶ。line 484）。
- A6: `AgentInfo`/`Pane` の型定義 — `packages/protocol/src/model.ts:60-89`。
- A7: 設定画面（UI の追加先の候補） — `packages/web/src/components/SettingsDialog.vue`
  （20260922-appearance-settings-rest・20260922-theme-custom-overrides で節を追加してきた実績パターン）。
- A8: report を受け取るローカル IPC の新設場所 — 未特定（design で決定。`packages/server/src/agent/`
  配下に新設するのが既存構成と整合的）。

## 実装時の注意

- **`updatePaneRuntime` の `touch()` 条件を広げるときは、既存の `cwdChanged` 判定を壊さない**
  （line 484 の `if (cwdChanged) this.persist.touch();` に条件を追加する形にする。既存テスト
  `SessionService.test.ts` の cwd 変化時の保存挙動を回帰させないこと）。
- **hook は必ず `async: true`（Codex は `async = true`）にする**。同期のままだと最悪 600 秒
  `claude`/`codex` の起動を止めてしまう（F4.4・F5.4）。
- **hook スクリプトは `/dev/tty` を開けない**（F4.4 の注記）。ファイル/ソケット経由でしか
  報告できない前提で設計すること。
- **`hooks` キーの非破壊マージが必須**（F4.1）。利用者が既に独自の `SessionStart` フックを
  `~/.claude/settings.json` に持っている場合、配列に追記する形にし、置き換えない。
  `~/.codex/hooks.json` 側は本製品専用ファイルにできるなら、そちらの方が非破壊マージの実装が単純になる
  （F5.2 の申し送りと同じ理由）。
- **`CLAUDE_CONFIG_DIR`/`CODEX_HOME` を尊重する**（F4.5・F5.5）。既定パス固定で書き込むと、
  これらを設定している利用者の環境では効かない・別の場所に書いてしまう。

## design への申し送り

- report 経路の具体的な実装（Unix domain socket／名前付きパイプ／ループバック限定 HTTP）、
  ファイルの置き場所・パーミッション。
- `SessionFilePane` のスキーマ変更方法（後方互換）。
- hook インストーラの実装（対象ファイルの読み込み→非破壊マージ→書き込み。既存の `hooks` キーを
  壊さないこと。F4.1 の公式ガイドの注意点を守る）。
- 設定 UI の配置（どの節に「エージェント連携」を置くか。既存の通知・テーマ・表示・端末・キーの並びとの整合）。
- 複数 pane・同一 cwd・同一種別のケースでの exact-ID 方式の検証（決定: 全 pane で再開を試みる。
  ID が pane ごとに一意なので理論上は衝突しない。decisions.md 参照）。
