# 仕様: サーバ再起動後のエージェント会話の再開

## 概要

Claude Code・Codex それぞれが公式に持つ **hooks 拡張機構**（`SessionStart` イベント）を使い、
両エージェントが起動・再開するたびに「どの pane で・どの会話IDか」を本製品のサーバへ報告させる。
報告された会話IDは pane ごとに `session.json` へ永続化し、サーバ再起動時の pane 復元で
`claude --resume <id>` / `codex resume <id>` を自動投入する。フックの導入（グローバル設定への
書き込み）は利用者の明示操作でのみ行い、自動再開の可否は導入後に切り替えられる
（すべて requirements.md の決定と research.md F1〜F6 に基づく）。

## 設計方針

herdr 自身が使っているのと同じ拡張点（Claude Code の `SessionStart` hook、Codex の `hooks` 機能。
research.md F1.4・F4・F5）をそのまま使い、report 先だけを herdr のローカル socket ではなく
本製品自身のローカル socket に変える。herdr 独自の socket プロトコルへは依存しない
（本製品用に新規設計する。理由: 非公開・herdr 内部実装への依存を避けるため。decisions.md D1）。

pane と会話IDの対応は **`WTM_PANE_ID` 環境変数**で行う（cwd マッチングのような推測をしない）。
pane 起動時にサーバが環境変数として `WTM_PANE_ID`・`WTM_AGENT_REPORT_SOCKET` を注入し、
シェル→エージェントCLI→hook スクリプトへ OS の通常のプロセス継承でそのまま渡る
（research.md F4.3・F5.3 で確認済み）。hook スクリプトはこの2つの環境変数と、stdin から届く
`session_id` を、指定された socket へ投げるだけの極小の Node スクリプト。

## 対象範囲

- 変更/追加: `packages/protocol`（新しい方式・型）、`packages/server/src/agent/`（フック導入・
  report 受信・復元コマンド解決）、`packages/server/src/persist/`（自動再開設定の永続化）、
  `packages/server/src/session/`（pane ごとの会話ID保持・復元時のコマンド投入）、
  `packages/server/src/terminal/`（pane 起動時の環境変数注入）、`packages/server/src/surface/methods/`
  （新しい RPC）、`packages/web/src/components/SettingsDialog.vue`（導入・状態表示・自動再開切替のUI）。
- 対象外は requirements.md のとおり（他 20 エージェント・画面履歴・名前付き session・live handoff）。

## 依拠する既存の事実

- 復元時に pane ごとにプレーンなシェルを起動しているだけであること —
  `packages/server/src/session/SessionService.ts:612-620`（`restorePaneProcess`）・
  `packages/server/src/persist/SessionFile.ts:9-16`（`SessionFilePane` は `agent` を持たない）。
- 保存はライブスナップショットから都度組み立てる（`p.agent` を含め、pane 型に持たせれば自動的に
  保存対象になる） — `packages/server/src/composeServer.ts:284-310`（`toSessionFileData`）。
- 保存のトリガ（`persist.touch()`）は現状 `cwd` の変化だけを見ている —
  `packages/server/src/session/SessionService.ts:462-484`（`updatePaneRuntime`。line 484）。
- pane 起動時に環境変数を上書きできる既存の口 —
  `packages/server/src/terminal/TerminalManager.ts:6-12`（`CreatePaneOptions.env`）。
- pane 起動後にコマンド文字列を書き込める既存の口 —
  `packages/server/src/terminal/TerminalHost.ts:78-80`（`write()`）。
- RPC 方式の登録パターン — `packages/server/src/surface/methods/worktree.ts`・
  `packages/server/src/surface/methods/deps.ts`（`MethodDeps`）・`packages/protocol/src/messages.ts`
  （`METHOD_SCHEMAS`）。
- 永続化モジュールの既存パターン（アトミック書き込み・壊れたファイルの扱い） —
  `packages/server/src/persist/AuthFile.ts`・`packages/server/src/persist/SessionFile.ts`。
- 状態ディレクトリの単一起動ロック（socket ファイルの置き場所として同じ `stateDir` を使ってよい根拠） —
  `packages/server/src/persist/StateDirLock.ts`（D103）。
- 以上すべて research.md の実装アンカー A1〜A8 と対応。

## インターフェース / データ構造

### 1. pane ごとの会話ID（サーバ内部の状態・永続化）

```ts
// packages/protocol/src/model.ts への追加
export type AgentIntegrationKind = "claude" | "codex";

export interface AgentSessionRef {
  kind: AgentIntegrationKind;
  sessionId: string;
  /** 報告を受けた時刻（epoch ms）。診断・将来の失効判定に使う。 */
  reportedAt: number;
}
```

`Pane` 型（`packages/protocol/src/model.ts`）に `agentSession: AgentSessionRef | null` を追加する。
`packages/server/src/persist/SessionFile.ts` の `SessionFilePane` にも
`agentSession?: { kind: string; sessionId: string; reportedAt: number } | undefined` を追加する
（既存の `autoLabel?: boolean` と同じ「optional 追加・schema 番号は据え置き」方式。古い版の
`session.json` はこのフィールドが無いだけで壊れたファイルにはならない。design D2）。

### 2. 自動再開の設定（サーバ全体・新規ファイル）

新規 `packages/server/src/persist/IntegrationFile.ts`（`AuthFile.ts`と同じアトミック書き込みパターン）。
`<stateDir>/integrations.json`:

```ts
export interface IntegrationFileData {
  schema: 1;
  /** herdr の `resume_agents_on_restore` に相当。既定 true（design D3）。 */
  autoResumeEnabled: boolean;
}
```

**導入状態（`installed`）自体は永続化しない**。Claude Code / Codex の設定ファイルを都度読んで
「本製品のフックが登録されているか」を判定する（design D4）。理由: 利用者が手動で
`~/.claude/settings.json` からフックを消した場合に、本製品側の記憶と実体がズレることを避けるため。

### 3. RPC 方式（`packages/protocol/src/messages.ts`）

```ts
export const AgentIntegrationStatusParams = z.object({});
export interface AgentIntegrationStatus {
  cliDetected: boolean; // PATH 上に実行ファイルが見つかるか（情報提供のみ）
  installed: boolean;   // 対象エージェントの設定にフックが登録されているか（都度判定）
}
export interface AgentIntegrationStatusResult {
  autoResumeEnabled: boolean;
  agents: Record<AgentIntegrationKind, AgentIntegrationStatus>;
}

export const AgentIntegrationInstallParams = z.object({ kind: z.enum(["claude", "codex"]) });
export interface AgentIntegrationInstallResult { ok: boolean; message: string | null }

export const AgentIntegrationUninstallParams = z.object({ kind: z.enum(["claude", "codex"]) });
// result は Install と同形

export const AgentIntegrationSetAutoResumeParams = z.object({ enabled: z.boolean() });
```

`METHOD_SCHEMAS` に `agent_integration.status` / `agent_integration.install` /
`agent_integration.uninstall` / `agent_integration.set_auto_resume` を追加する（既存の
`pane.input.set` 等と同じスネークケース混在の命名慣習に合わせる）。

イベント: 導入状態・自動再開設定が変わったら、全クライアントへ配布する
`agent_integration.changed`（payload は `AgentIntegrationStatusResult` と同形）を
`packages/protocol/src/events.ts` に追加する（`pane.agent` イベントと同じパターン）。

### 4. ローカル report 経路（新規: `packages/server/src/agent/AgentReportSocket.ts`）

- Unix（Linux/macOS）: Unix domain socket、パスは `<stateDir>/agent-report.sock`
  （`stateDir` は既に `StateDirLock` で単一起動が保証されている場所。D103 を再利用）。
- Windows: 同じ Node `net` API で `\\.\pipe\wtm-agent-report-<stateDir のハッシュ>` を listen する
  （Node は `net.Server.listen(path)` が Windows では自動的に名前付きパイプとして扱う。
  `stateDir` のハッシュを名前に含めるのは、named pipe がファイルシステムパスを持たず
  グローバル名前空間になるため、複数の `stateDir` を衝突させないための代替）。
- ファイル権限: Unix socket は作成直後に `chmod 0600` する（同一利用者のみ接続可）。
  Windows の named pipe は既定の DACL がローカルの認証済みユーザーに広く許可されるため、
  作成時に明示的な security descriptor で現在の利用者に限定する（design D5・実装は coding 工程）。
- プロトコル: 改行区切りの JSON、1接続1メッセージ。
  ```json
  {"paneId": "p3", "kind": "claude", "sessionId": "1f9c...-uuid"}
  ```
  サーバは `paneId` が現在のセッションに実在するか、`kind` が既知の値かを検査し、
  一致しなければ黙って破棄する（エラーを返さない——hook 側は結果を待たないため。design 方針:
  「報告経路は best-effort、失敗しても pane の復元は現状のフォールバックに落ちるだけ」）。

### 5. hook スクリプト（新規: サーバの配布物に同梱する小さな Node スクリプト）

`packages/server` のインストール物に `assets/agent-hook-report.cjs`（仮）として同梱し、
導入時に `~/.claude/hooks/wtm-agent-report.cjs` / `~/.codex/hooks/wtm-agent-report.cjs` へ
**コピー**する（herdr が `hooks/herdr-agent-state.sh` を書き込むのと同じ発想。design D6:
本体を参照ではなくコピーにする理由——本製品の実行ファイルの場所が変わって壊れないようにするため）。

スクリプトの振る舞い（擬似コード）:
```js
#!/usr/bin/env node
const paneId = process.env.WTM_PANE_ID;
const sock = process.env.WTM_AGENT_REPORT_SOCKET;
if (!paneId || !sock) process.exit(0); // 本製品の pane の外で動いている claude/codex には無害
const kind = process.argv[2]; // "claude" | "codex"（フック登録時に固定で渡す）
// stdin の JSON を読み、session_id を取り出す
// sock（Unix socket／Windows named pipe）へ接続し {paneId, kind, sessionId} を1行 JSON で送り、閉じる
// 何が起きても例外を投げない・非ゼロ終了しない（SessionStart はブロックしないが、行儀として）
```

### 6. フック登録の書式（Claude Code / Codex）

- Claude Code（`~/.claude/settings.json` または `CLAUDE_CONFIG_DIR` 配下。research.md F4.1・F4.5）:
  ```json
  {
    "hooks": {
      "SessionStart": [
        {
          "matcher": "startup|resume",
          "hooks": [
            { "type": "command", "command": "node ~/.claude/hooks/wtm-agent-report.cjs claude", "async": true }
          ]
        }
      ]
    }
  }
  ```
  既存の `hooks.SessionStart` 配列があれば要素を1つ追記する（置き換えない。F4.1）。
  本製品のエントリだと分かるよう、`command` 文字列に固定のスクリプト名
  （`wtm-agent-report.cjs`）を必ず含める——**これが `installed` 判定・uninstall 時の
  一致条件になる**（design D4 の「都度判定」の実装根拠）。
- Codex（`~/.codex/hooks.json` または `CODEX_HOME` 配下。research.md F5.2・F5.5）:
  ```json
  {
    "hooks": {
      "SessionStart": [
        {
          "matcher": "startup|resume",
          "hooks": [
            { "type": "command", "command": "node ~/.codex/hooks/wtm-agent-report.cjs codex", "async": true }
          ]
        }
      ]
    }
  }
  ```
  専用ファイル `hooks.json` を使う（`config.toml` は触らない。理由: TOML の部分編集より
  JSON の非破壊マージの方が安全に実装できるため。research.md F5.2 の申し送りどおり。design D7）。
  Codex の `[features] hooks` は既定で有効なので、config.toml 側の変更は不要
  （research.md F5.1）。

## 振る舞いの詳細

### 導入（`agent_integration.install`）

1. 対象エージェントの hooks 設定ファイルを読む（無ければ空から作る）。
2. 本製品のエントリが既に無いか確認する（`wtm-agent-report.cjs` を含む command が無いか）。
   既にあれば何もせず `{ ok: true, message: "既に導入済み" }` を返す（冪等）。
3. hook スクリプトを `~/.claude/hooks/` または `~/.codex/hooks/` へコピーする
   （ディレクトリが無ければ作る）。
4. 設定ファイルへ非破壊的にエントリを追記し、アトミックに書き込む
   （`atomicFile.ts` の `writeFileAtomic` を再利用。既存ファイルが壊れた JSON なら
   `{ ok: false, message: "設定ファイルを解釈できませんでした（<path>）" }` を返し、書き込まない）。
5. `agent_integration.changed` を配布する。

### 解除（`agent_integration.uninstall`）

- 該当 command を含むエントリだけを取り除く（他のフックは残す）。
  スクリプトファイル自体も削除する（design D6 の裏返し）。
- 元から無ければ `{ ok: true, message: "未導入でした" }`。

### 会話IDの報告受信（`AgentReportSocket`）

1. 接続を受け、1行の JSON をパースする。
2. `paneId`/`kind` を検証し、`SessionModel` にその pane が存在すれば
   `pane.agentSession = { kind, sessionId, reportedAt: now }` を反映する
   （新規 `SessionModel.setAgentSession(paneId, ref)`）。
3. `persist.touch()` を呼ぶ（`updatePaneRuntime` の `cwdChanged` 相当の新しい条件として、
   会話IDの変化・消去も対象にする。design D8）。

### 既存の agent 検出との連動（会話IDの失効）

- `SessionService.updatePaneRuntime` で、画面判定の `pane.agent` が **非 null → null** に
  遷移したら（＝そのエージェントの画面がもう検出されない＝会話が終わった/pane がプレーンな
  シェルに戻った）、`pane.agentSession` も同時に `null` にする（design D9）。
  理由: 古い会話IDを、無関係になった pane に対して復元時に投入しないため
  （利用者が Claude Code を終了して `git status` 等を打っている pane が、次のサーバ再起動で
  勝手に古い会話を再開してしまう事故を防ぐ）。

### 復元（`SessionService.restorePaneProcess`）

1. 現状どおり `spawnForPane` でプレーンなシェルを起動する（変更しない。AC3・AC4・AC6 の
   フォールバックをこの共通経路のまま保つ——design D10：わざと分岐を増やさない）。
2. 起動に成功し、かつ保存されていた `paneData.agentSession` があり、かつ
   `IntegrationFileData.autoResumeEnabled` が true であれば、対応する resume コマンドを
   `TerminalHost.write()` で1行投入する：
   - `claude`: ``claude --resume <sessionId>\r``
   - `codex`: ``codex resume <sessionId>\r``
3. 複数 pane が同じ cwd・同じ kind でも、**pane ごとに別々の `sessionId` を持つため無条件に
   全 pane で投入する**（requirements.md の決定どおり。重複排除ロジックは持たない。design D11）。
4. コマンドが無効だった場合（会話が見つからない等）は、対象 CLI 自身がエラーを出して
   終了し、その pane は通常のシェルに戻る（AC6。追加の検査はしない。研究の F3.1〜F3.3 で
   確認したとおり両 CLI ともクリーンなエラー終了をする）。

## ドメイン固有の考慮

- **herdr との違いの記録**（herdr-parity.md へ反映する内容）: herdr は herdr 独自のローカル
  socket プロトコルと汎用の「連携」概念（22エージェント対応）を持つが、本製品は
  Claude Code・Codex の2エージェントに限定し、各社公式の hooks 機構を直接使う独自実装にする
  （herdr のプロトコル・実装には依存しない）。
- **導入操作は明示的**（herdr と同じ設計。research.md F2）。自動検出はするが自動インストールはしない。

## エラー処理 / 異常系

- hooks 設定ファイルが壊れている（不正 JSON）→ 導入操作はエラーを返し、書き込まない
  （利用者に手動修復を促すメッセージ）。
- 対象 CLI が PATH に無い → `cliDetected: false` を状態表示に出すが、導入操作自体は妨げない
  （利用者が後からインストールする可能性があるため）。
- report socket が既に使用中（前回のサーバが不正終了して残った等）→ bind 失敗時は
  作り直す（`StateDirLock` と同様、stale なソケットファイルの検出・削除を行う。design D12）。
- 復元時に resume コマンドが失敗する → 上記「振る舞いの詳細・復元」4. のとおり、
  CLI 自身のエラー出力で終わり、pane は `failed` にしない（AC6）。

## 受け入れ基準との対応

- AC1: 「復元」1〜2 で実現（Claude Code 向け resume コマンドの自動投入）。
- AC2: 「復元」1〜2 で実現（Codex 向け resume コマンドの自動投入。AC1 と同じ経路を kind で分岐）。
- AC3: 「復元」1 が既存の `spawnForPane` を変更しないことで保たれる。
- AC4: `pane.agentSession` が無い pane には「復元」2 が発火しないことで保たれる。
- AC5: 「復元」3（pane ごとの一意な `sessionId` により無条件に投入）。
- AC6: 「エラー処理」の最終項（CLI 自身のエラー終了に委ねる）。
- AC7: `IntegrationFileData`（サーバ側永続化）と `agent_integration.status`/`changed` により、
  ブラウザのリロードをまたいで一貫した状態が見える。
- AC-I1: 「振る舞いの詳細・導入」（`agent_integration.install` が「何が変わるか」を UI 側で
  提示できるよう、`AgentIntegrationInstallResult.message` と install 前の状態説明を設定画面に置く）。
- AC-I2: 「振る舞いの詳細・解除」（`agent_integration.uninstall`）。
- AC-I3: `agent_integration.status`（`cliDetected`/`installed` を都度返す。design D4）。
- AC-I4: `agent_integration.set_auto_resume` と `IntegrationFileData.autoResumeEnabled`
  （design D3。切替は即座に永続化され、次回の復元から有効）。
- AC-I5: 新しい節を既存の `SettingsDialog.vue` の節構成に追加するだけで、既存の節のロジック・
  DOM 構造には触れない（既存節と同じ「独立した節を1つ追加する」パターンを踏襲。
  20260922-appearance-settings-rest・20260922-theme-custom-overrides と同じやり方）。
  UI 配置は既存の「端末」節の次を想定（tasks で確定）。

## 未確定事項（tasks へ）

- named pipe の Windows 専用実装・権限設定の具体コード（design D5 は方針のみ）。
- stale なソケットファイルの具体的な検出手順（D12 は方針のみ）。
- `SettingsDialog.vue` 内の正確な配置・文言。
