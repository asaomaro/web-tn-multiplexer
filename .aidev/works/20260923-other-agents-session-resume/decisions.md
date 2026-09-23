# 決定記録

## D1: 対象を herdr の16エージェントから「session identity」型10エージェントへ絞った

- **背景**: backlog の「セッション永続化の拡張（残り）」は4つの異なる機能（画面履歴の保存再生・
  名前付き session・live handoff・16エージェントへの resume 対応）を束ねていた。利用者に確認したところ
  4つとも着手する意向だったため、まず本 work（16エージェントへの resume 対応）に単独で着手し、
  backlog を4分割した（他3つは別行として残した）。
- **決定**: 16エージェントのうち、herdr が「session identity」型（hook はセッションIDの報告だけを行い、
  状態判定は引き続き画面検出——Claude Code・Codex と同じ統合方式）と分類する10エージェントに絞る。
  「lifecycle authority」型6エージェント（Kimi Code CLI・OpenCode・Kilo Code CLI・MastraCode・Pi・OMP）は
  別の backlog 項目へ切り出した。
- **理由・代替案**: 代替案（16エージェント全部を1 work で扱う）は、「lifecycle authority」型が
  本製品にまだ無い新しい統合方式（状態を hook から受け取る経路）を要求し、既存の
  `AgentIntegrationInstaller`（画面検出との組み合わせを前提にした設計）と噛み合わない。1つの work に
  混ぜると設計判断が二重化し、レビューも難しくなる。利用者に選択肢を示し、10エージェント（同じ
  パターンの拡張で済む方）から着手する案を選んでもらった。
- **影響**: `.aidev/backlog/product-roadmap.md` に「session identity」型10エージェントの行と
  「lifecycle authority」型6エージェントの行を分けて記録した。

## D2: 10エージェントのうち Antigravity CLI・Qoder CLI を対象から外した（実地調査で hook が無いと判明）

- **背景**: D1 で10エージェントに絞った後、requirements 前に各エージェントの公式ドキュメントを
  直接確認した。最初の調査委託（サブエージェント）は10エージェント全てに `SessionStart` 相当の
  hook があると報告したが、**この報告を鵜呑みにせず、報告にある URL を1つずつ自分で
  `WebFetch`/`WebSearch` して再検証した**。
- **決定**: Antigravity CLI（`https://antigravity.google/docs/hooks/` を直接確認。イベントは
  `PreToolUse`/`PostToolUse`/`PreInvocation`/`PostInvocation`/`Stop` の5つのみで、セッション開始時に
  一度だけ発火するイベントが無い）と、Qoder CLI（`https://docs.qoder.com/en/cli/hooks` を直接確認。
  「Qoder does not support the SessionStart hook event」と文書自身が明記）の2つを対象から外し、
  8エージェントで進めることにした。
- **理由・代替案**: 検証の結果、**Qoder CLI については最初の調査委託の報告が誤り（ハルシネーション）
  だったことが判明した**——報告は「Yes — SessionStart」「Include — 高信頼度」としていたが、
  一次資料は明確にこれを否定していた。もし直接検証せずにこの報告のまま設計・実装へ進んでいたら、
  存在しない hook 機構を前提にしたコードを書くことになっていた。代替案（`PreInvocation` 等、
  別のイベントを無理やり session-start の代わりに使う）は、design での検討事項として一応残したが、
  利用者との協議で不採用とした（design の前提が崩れるリスクが高く非推奨と判断）。
- **影響**: `.aidev/backlog/product-roadmap.md` に非対応の理由（URL付き）を明記した行を追加した。
  この経緯は **「生成された調査報告は一次資料で裏を取ってから requirements/design に反映する」**という
  教訓として、requirements.md の非機能要件にも明記した。

## D3: design 直前の再検証で Letta Code・Hermes Agent の2つをさらに対象から外し、6エージェントにした

- **背景**: requirements 承認後、design に入る前に「未確定事項」で申し送った各エージェントの
  exact な設定ファイルパス・stdin JSON のフィールド名を一次資料で個別に再確認した（requirements.md
  非機能要件「一次資料の再検証を徹底する」の実施）。8エージェント中6つ（Cursor Agent CLI・
  GitHub Copilot CLI・Devin CLI・Droid・Grok CLI・Qwen Code）は設定ファイルの構造・hook エントリの形・
  セッションIDの受け渡しフィールド名まで公式ドキュメントで確認できた。しかし残り2つに実質的な
  ドキュメント上の欠落が見つかった：
  - **Letta Code**: `SessionStart` hook がセッション/会話IDを含むことは文書に書かれているが
    （"Session events include agent and conversation IDs"）、**stdin JSON の具体的なフィールド名が
    どこにも明記されていない**（`PreToolUse`/`Stop` 等、他の hook には具体例があるのに
    `SessionStart` だけ無い）。
  - **Hermes Agent**: `~/.hermes/config.yaml` の shell hook がセッションIDをどう受け取るかが
    未文書化なうえ、公式ドキュメントを深追いすると、**hook の中心的な設計が Python の
    コールバック関数（`def my_callback(session_id: str, ...)`）を前提にしている**ことが分かった。
    本製品が想定する「任意の shell コマンドをサブプロセスとして起動し、そこへ情報を渡す」方式
    （Claude Code・Codex を含む他7エージェント全てがこの方式）とは**アーキテクチャの前提が違う**
    可能性が高い——「YAML だから実装コストが高い」という当初の想定より根が深い問題だった。
- **決定**: Letta Code・Hermes Agent を対象から外し、**6エージェント**（Cursor Agent CLI・
  GitHub Copilot CLI・Devin CLI・Droid・Grok CLI・Qwen Code）に絞る。
- **理由・代替案**: 代替案（フィールド名を他エージェントとの類推で推測して実装する）は、
  D2 で得た教訓（一次資料の裏取りをしないと誤った前提で実装することになる）に反する。実機検証が
  そもそもできない本 work では、「ドキュメントに書いていないことを実装で埋める」のは
  「動くかどうか誰にも確かめようがない機能を、確認もせず出荷する」ことに等しく、リスクに見合わない
  と利用者と判断した。
- **影響**: `requirements.md`「対象8エージェント」を6エージェントへ書き換える。
  `.aidev/backlog/product-roadmap.md` の該当行も6エージェントに更新し、Letta Code・Hermes Agent は
  Antigravity CLI・Qoder CLI と同様の「非対応」行へ移す。

## D4: Devin CLI の設定ファイルパスは推測値（`~/.devin/hooks.json`）を採用する

- **背景**: design 工程で Devin CLI の hook 設定ファイルの exact なパスをもう一段確認しようとしたが
  （`docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks` を再度 `WebFetch`）、公式ドキュメントに
  記載が見当たらなかった（research.md F4・R2）。`SessionStart` hook 自体の実在・エントリの形
  （`{matcher, hooks:[{type:"command",command,timeout}]}`）・stdin JSON のフィールド名（`session_id`）は
  確認済みだが、その設定を**どのファイルに書くか**だけが未確認のまま残った。
- **決定**: Claude Code の `CLAUDE_CONFIG_DIR` と同じ設計（環境変数オーバーライド＋既定パス）を
  踏襲し、既定パスは `~/.devin/hooks.json`（`DEVIN_CONFIG_DIR` 環境変数があれば優先）とする。
  この決定を「他5エージェントとは確度が異なる推測」として `docs/verification.md` に明記する
  （requirements.md「目的 / ゴール」の「公式ドキュメントの記述どおりに実装」という原則の唯一の例外）。
- **理由・代替案**: 代替案（Devin CLI を対象から外す）も検討したが、hook の実在・エントリの形・
  ID受け渡しは確認済みで、**未確認なのはファイル名の慣習だけ**——同じベンダー系統の類似ツール
  （Droid の `~/.factory/hooks.json`。ともに「1単語のツール名を隠しディレクトリ名にし、直下に
  `hooks.json` を置く」という広く見られる慣習）から類推できる範囲であり、Letta Code・Hermes Agent
  （hook の実在自体や ID 受け渡しの仕組みそのものが未確認）とは性質が異なると判断し、対象に残した。
- **影響**: `AgentIntegrationInstaller.ts` の `devin` の `HookSpec.configFile` にこの既定値を実装する。
  `docs/verification.md` に、この1点が推測であることを明記する（design「ドメイン固有の考慮」）。

## D5: `packages/protocol/src/messages.ts` の `agentIntegrationKind`（zod）は design に無かった第3の一覧だった

- **背景**: T1（`AgentIntegrationKind` union の拡張）の後、T12（`SettingsDialog.vue`）で
  `pnpm --filter @wtm/web typecheck` を実行したところ、`ActionDispatcher.ts` の
  `installAgentIntegration`/`uninstallAgentIntegration` で「`AgentIntegrationKind` を
  `"claude" | "codex"` に代入できない」という型エラーが出た。原因は `messages.ts:247` の
  `const agentIntegrationKind = z.enum(["claude", "codex"])`——`AgentIntegrationInstallParams`/
  `AgentIntegrationUninstallParams` の zod スキーマが、`model.ts` の `AgentIntegrationKind` とは
  **別に**この2値だけをハードコードしていた。design「依拠する既存の事実」は `AgentIntegrationInstaller.ts`
  の `pathsFor`・`AgentIntegrationService.ts` の `KINDS`・`SettingsDialog.vue` の
  `AGENT_INTEGRATION_KINDS` の3箇所しか挙げておらず、この protocol 側の第4の一覧を見落としていた。
- **決定**: `agentIntegrationKind` に6つ追加し、`model.ts` の `AgentIntegrationKind` と値を揃える
  （コメントで同期を明記）。
- **理由・代替案**: 代替案（zod スキーマ側を `model.ts` の union から動的に導出する）も考えたが、
  既存の `messages.ts` の他の enum 定義も同様に手書きの `z.enum([...])` で、動的導出をここだけ
  導入すると一貫性が崩れる。既存の書き方に揃えた。
- **影響**: `packages/protocol/src/messages.ts:247`。この修正により `ActionDispatcher.ts` の型エラーが
  解消した（コード自体の変更は不要——protocol 側の schema が正しくなれば自然に通る）。design.md
  「依拠する既存の事実」に本来含めるべきだった1件として、ここに記録する（design.md 自体は
  事後訂正しない——D2・D8 と同じ方針）。
