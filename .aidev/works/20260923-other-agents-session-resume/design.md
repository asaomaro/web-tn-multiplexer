# 仕様: Claude Code・Codex 以外の6エージェントへセッション再開対応を広げる

## 概要

既存の `AgentIntegrationInstaller`（Claude Code・Codex の2 kind だけを前提にした実装）を、
6エージェント（Cursor Agent CLI・GitHub Copilot CLI・Devin CLI・Droid・Grok CLI・Qwen Code）を
含む8 kind に対応させる。research.md F4 で判明したとおり、6エージェントは設定ファイルの
トップレベル構造（3パターン）・hook エントリの形（5パターン以上）がそれぞれ異なるため、
**「per-kind の spec オブジェクトのテーブル」**という形で一般化する（`pathsFor` の単純な分岐拡張では
吸収できない。research F3→F4 の訂正を踏まえる）。

## 設計方針

- **`HookSpec` インターフェースを新設し、kind ごとに1つずつ実装を持つ**（`claude`/`codex` の既存実装も
  同じ形へ寄せる——2種類の実装（既存2 kind は独自コード、新規6 kind は別の仕組み）を並存させない）。
  `HookSpec` が持つのは、既存の `KindPaths`（`configFile`・`hooksDir`・`binName`。`isOnPath` の
  CLI 検出にそのまま使う）に加えて、「SessionStart 相当の配列がオブジェクト内のどこにあるか
  （`entriesPath`。ネストしたキーの経路）」「1エントリの組み立て方（`buildEntry`）」「あるエントリが
  本製品のものかの判定（`isOurs`）」の3点——読み込み・書き込み・マージ・アトミック書き出しは共通の
  汎用ロジックのまま（既存の `readJsonObject`/`writeFileAtomic` 呼び出し等は変えない）。
- **`entriesPath`（例 `["hooks","SessionStart"]` / `["hooks","sessionStart"]` / `["SessionStart"]`）を
  汎用の `getPath`/`setPath` ヘルパーで辿る**ことで、「`hooks` にラップされているか」「PascalCase か
  camelCase か」「ラップ無しでトップレベル直下か」という F4 で判明した3パターンの違いを、
  分岐コードを増やさずに1つの経路指定で吸収する。
- **GitHub Copilot CLI・Grok CLI はディレクトリ＋glob（`~/.copilot/hooks/*.json`・`~/.grok/hooks/*.json`）
  なので、利用者の既存設定を読み書きせず、本製品専用のファイル（`wtm-agent-report.json`）を
  そのディレクトリへ置く**——読み込み時に既存の他の hook 定義とマージする必要が無く、
  `configFile` がこの専用ファイルを指すよう `HookSpec` を定義するだけで、他の JSON マージ実装
  （Claude Code・Codex 等）と**全く同じ共通アルゴリズム**（読み込み→エントリ配列を書き換え→
  アトミック書き出し）にそのまま収まる（特別扱いのコードを増やさない。「振る舞いの詳細」参照）。
- **hook スクリプト本体（`agent-hook-report.cjs`）は1行だけ直す**——stdin JSON のフィールド名は
  6エージェント中4つ（Cursor・Devin・Droid・Qwen Code）が既存の `session_id`（snake_case）と一致するが、
  Grok CLI は `sessionId`（camelCase）、GitHub Copilot CLI は両方の変種が文書化されている
  （research F4）。`payload.session_id ?? payload.sessionId` のフォールバックで両方を吸収する
  （kind ごとの分岐は要らない——hook スクリプトは「JSON からIDを取り出す」責務だけで、
  取り出し方が2パターンしか無いため）。
- **Devin CLI の設定ファイルパスは未確定**（research F4・R2）。design でもう一段確認を試みたが
  公式ドキュメントに記載が見つからなかったため、Claude Code の `CLAUDE_CONFIG_DIR` と同じ設計
  （環境変数オーバーライド＋妥当な既定パス）を踏襲し、既定パスは同業他社（Droid の `~/.factory/`）と
  同じ命名規則から類推した `~/.devin/hooks.json`（`DEVIN_CONFIG_DIR` があれば優先）を採用する。
  **この1点だけは「合理的な推測」であることを decisions.md・`docs/verification.md` に明記する**
  （他5エージェントは exact なパスが文書で確認済み。decisions D4）。

### 検討した代替案

- **`pathsFor` の戻り値に「形式（JSON構造のバリエーション）」を持たせて分岐を増やす**（当初の F3 の
  想定）: 検討したが、5パターンのエントリ形をすべて `if`/`switch` で分岐すると `install`/`uninstall`/
  `status` の共通ロジックにまで分岐が染み出し、可読性が落ちる。`HookSpec` オブジェクトに
  「その kind 固有の振る舞い」を閉じ込め、共通ロジック側は `HookSpec` のメソッドを呼ぶだけにする方が、
  既存2 kind への影響も無く、テストも kind ごとに独立して書ける。
- **GitHub Copilot CLI・Grok CLI も他と同じく「利用者の既存ファイルを読み込んでマージ」する**:
  検討したが、これらは glob ディレクトリ形式で「どのファイル名でもよい」ため、**マージ対象となる
  唯一の既存ファイルが定まらない**（複数の `.json` が既にあるかもしれない）。専用ファイルを
  置くだけにすれば、既存の他の hook 定義を一切読まず壊さない——「書き込み範囲の限定」
  （非機能要件）にも合致する。

## 対象範囲

- `packages/protocol/src/model.ts`：`AgentIntegrationKind` に6つ追加。
- `packages/server/src/agent/AgentIntegrationInstaller.ts`：`HookSpec` インターフェースの新設、
  `pathsFor`/`sessionStartEntries`/`buildEntry`/`isOurs` を `HookSpec` テーブル方式へ書き換え
  （`claude`/`codex` も含めて統一）。`commandsOf`（コマンド文字列の取り出し）は per-kind の `isOurs`
  実装の内部に個別に吸収し、独立した汎用関数としては残さない——kind によってコマンド文字列の
  在り処（`entry.command` 直下か `entry.hooks[].command` の入れ子か `entry.bash`/`entry.powershell` か）が
  異なるため（下記 HookSpec 一覧の「`isOurs` の見る場所」列）。
- `packages/server/src/agent/AgentIntegrationService.ts`：`KINDS` 定数に6つ追加。
- `packages/server/src/agent/resumeCommand.ts`：6 case 追加。
- `packages/server/assets/agent-hook-report.cjs`：stdin のフィールド名を `session_id ?? sessionId` に。
- `packages/web/src/components/SettingsDialog.vue`：`AGENT_INTEGRATION_KINDS` 配列に6つ追加。
- `docs/herdr-parity.md`：H32 の更新。
- `docs/verification.md`：6エージェントとも実機未検証である旨・Devin CLI のパスが推測である旨を追記。

## 依拠する既存の事実

- `packages/server/src/agent/AgentIntegrationInstaller.ts`（既存全体）：`pathsFor`（27-34行）が
  唯一の per-kind 分岐で、他は完全に汎用。ただし `sessionStartEntries`（60-66行）・`commandsOf`
  （67-75行）・`isOurs`（76-78行）・`buildEntry`（84-93行）は `root.hooks.SessionStart` という
  **固定の構造**を前提にしており、これも kind に依存させる必要がある（research F3→F4）。
- `packages/server/src/agent/resumeCommand.ts:20-30`：`switch(kind)` で resume コマンドを返す。
  未知の kind は `undefined`（フォールバック。AC3/AC4 と同じ設計をそのまま使う）。
- `packages/server/src/session/SessionService.ts:713-719`（`maybeResumeAgentSession`）が pane 復元時の
  フォールバックの実体——`resumeCommandFor` が `undefined` を返す（未対応 kind・不正な ID 等）場合は
  何も書き込まず、pane は普通のシェルのまま（`20260923-agent-session-resume` design D10）。
  AC2〜AC4 が指す「pane 復元のフォールバックロジック」はこの関数を指し、本 work では変更しない。
- `packages/server/assets/agent-hook-report.cjs:40-43`：`payload.session_id` だけを読む。
  `paneId`/`sock`/`kind` が無ければ何もしない（本製品の pane の外で呼ばれても無害。設計は変えない）。
- `packages/server/src/agent/AgentIntegrationService.ts:7`：`KINDS = ["claude", "codex"]` が
  `status()` の対象一覧（`pathsFor` とは別の、もう1箇所の per-kind リスト）。
- `packages/web/src/components/SettingsDialog.vue:324-327`：`AGENT_INTEGRATION_KINDS` 配列
  （`{value, label}[]`）への `v-for` で UI が描画される（テンプレートの複製不要）。
- `packages/server/src/session/SessionService.ts:581`（`reportAgentSession`）が、hook から届いた
  `sessionId` を pane に紐づける入口。実際の永続化は `packages/server/src/persist/SessionFile.ts:22,80`
  の `agentSession?: {kind, sessionId, reportedAt}`（pane ごとのフィールド。ファイル名は
  `session.json`）——AC5 の「`session.json` の永続化」はこれを指す。この経路自体は
  `20260923-agent-session-resume` で確立済みで、本 work では変更しない。
- `packages/server/src/persist/IntegrationFile.ts:11-19`（`IntegrationFileData`）が持つのは
  `autoResumeEnabled` の1項目だけ（`integrations.json` に保存）。**hook の導入状況（「有効化」の実体）は
  ここに持たない**——`AgentIntegrationInstaller.status()` が各エージェントの設定ファイル自体を
  都度読んで判定する設計（`AgentIntegrationService.ts` のコメント「design D4」）。AC6 の
  「連携の有効化・無効化・状態確認がサーバ側に永続化される」は、前者（自動再開の可否）は
  `IntegrationFile`、後者（導入状況そのもの）は各エージェントの設定ファイル（`HookSpec.configFile`が
  指す実ファイル）が担う——どちらもサーバのファイルシステムであり、ブラウザのリロードに影響されない。
- research.md F4 の表（6エージェントの exact な設定ファイル・トップレベル構造・エントリ形・
  stdin フィールド名）。

## インターフェース / データ構造

### `HookSpec`（新設。`AgentIntegrationInstaller.ts` 内）

```ts
interface HookSpec {
  configFile(env: NodeJS.ProcessEnv, home: string): string;
  hooksDir(env: NodeJS.ProcessEnv, home: string): string;
  binName: string;
  /** SessionStart 相当の配列が、設定ファイルのオブジェクト内のどこにあるか（ネストしたキーの経路）。 */
  entriesPath: string[];
  /** 1エントリを組み立てる。 */
  buildEntry(scriptPath: string, kind: AgentIntegrationKind): JsonObject;
  /** そのエントリが本製品の hook か判定する（コマンド文字列に `HOOK_SCRIPT_NAME` を含むか）。 */
  isOurs(entry: unknown): boolean;
}

const HOOK_SPECS: Record<AgentIntegrationKind, HookSpec> = { claude: {...}, codex: {...}, cursor: {...}, ... };
```

`getPath(root, path)`/`setPath(root, path, entries)` は既存の `readJsonObject`/`writeFileAtomic` の
間に挟む汎用ヘルパー（新規）。`sessionStartEntries(root, spec)` は `getPath(root, spec.entriesPath)`
を呼ぶだけになり、`buildEntry`/`isOurs` は `spec` へ委譲する。`FsAgentIntegrationInstaller` の
`status`/`install`/`uninstall` は `pathsFor(kind)` の代わりに `HOOK_SPECS[kind]` を引くだけに変わる
（メソッドのシグネチャ・呼び出し側は変えない）。

### 8 kind の `HookSpec` 一覧

| kind | `binName`（PATH検出用） | `configFile` | `hooksDir` | `entriesPath` | エントリの形（`buildEntry` の戻り値） | `isOurs` の見る場所 |
|---|---|---|---|---|---|---|
| `claude`（既存・変更なし） | `claude` | `CLAUDE_CONFIG_DIR ?? ~/.claude` + `/settings.json` | 同 + `/hooks` | `["hooks","SessionStart"]` | `{matcher:"startup\|resume", hooks:[{type:"command",command,async:true}]}` | `entry.hooks[].command` |
| `codex`（既存・変更なし） | `codex` | `CODEX_HOME ?? ~/.codex` + `/hooks.json` | 同 + `/hooks` | `["hooks","SessionStart"]` | 同上 | 同上 |
| `cursor` | `cursor-agent` | `~/.cursor/hooks.json` | `~/.cursor/hooks` | `["hooks","sessionStart"]`（**小文字始まり**） | `{type:"command", command}`（`hooks[]`の入れ子無し。F4） | `entry.command` |
| `copilot` | `copilot` | `~/.copilot/hooks/wtm-agent-report.json`（**専用ファイル**。glob ディレクトリのため既存ファイルは読まない） | `~/.copilot/hooks` | `["hooks","sessionStart"]` | `{type:"command", bash:command, powershell:command, timeoutSec:10}`（bash/powershell 分岐。F4） | `entry.bash`（`entry.powershell` も同じ値のため片方で足りる） |
| `devin` | `devin` | `DEVIN_CONFIG_DIR ?? ~/.devin` + `/hooks.json`（**パス未確認・推測。decisions D4**） | 同 + `/hooks` | `["SessionStart"]`（`hooks` ラップ無し） | `{matcher:"", hooks:[{type:"command",command,timeout:10}]}`（`async`ではなく`timeout`。F4） | `entry.hooks[].command` |
| `droid` | `droid` | `~/.factory/hooks.json` | `~/.factory/hooks` | `["SessionStart"]` | 同上（devin と同形。F4） | `entry.hooks[].command` |
| `grok` | `grok` | `~/.grok/hooks/wtm-agent-report.json`（**専用ファイル**。glob ディレクトリのため） | `~/.grok/hooks` | `["hooks","SessionStart"]` | `{matcher:"", type:"command", command, timeout:10}`（`hooks[]`の入れ子無し。F4） | `entry.command` |
| `qwen` | `qwen` | `~/.qwen/settings.json` | `~/.qwen/hooks` | `["hooks","SessionStart"]` | `{type:"command", command, name:"wtm-agent-report", async:true}`（`hooks[]`の入れ子無し。F4） | `entry.command` |

`binName` は6エージェントとも resume コマンド（research F2）の先頭語（実行ファイル名）と一致する。
`kind` の文字列（プロトコルの union 型の値）と `binName` が異なるのは `cursor`（`binName` は
`cursor-agent`）だけで、他5つは `kind` と `binName` が同じ文字列になる。

`command` はどのエントリでも共通で `node "${scriptPath}" ${kind}`（既存の `buildEntry` と同じ組み立て。
`HOOK_SCRIPT_NAME`・`hookScriptPathFor` は変えない）。`matcher`/`timeout`/`async` 等、ドキュメントに
明記が無いフィールドは追加しない（推測でフィールドを増やさない。non-functional「一次資料の再検証を
徹底する」）。

### protocol（`packages/protocol/src/model.ts`）

```ts
export type AgentIntegrationKind = "claude" | "codex" | "cursor" | "copilot" | "devin" | "droid" | "grok" | "qwen";
```

`Record<AgentIntegrationKind, AgentIntegrationStatus>`（`messages.ts:262`）は型定義のみで自動的に
8 kind 分を要求するようになる（TypeScript の網羅性チェック。research F3）。

### `resumeCommand.ts` の6 case

```ts
case "cursor": return `cursor-agent --resume ${sessionId}`;
case "copilot": return `copilot --resume=${sessionId}`;
case "devin": return `devin --resume ${sessionId}`;
case "droid": return `droid --resume ${sessionId}`;
case "grok": return `grok --resume ${sessionId}`;
case "qwen": return `qwen --resume ${sessionId}`;
```

（research.md F2 の表・herdr resume コマンドと一致。`SAFE_SESSION_ID` の検証・`default: undefined` の
フォールバックは変えない。）

### hook スクリプト（`agent-hook-report.cjs`）

```js
// 変更前: sessionId = payload && payload.session_id;
// 変更後:
sessionId = payload && (payload.session_id || payload.sessionId);
```

（`kind` は既存どおり `process.argv[2]` で受け取るだけ——スクリプト自体に kind ごとの分岐は増やさない。
6エージェントとも `command` を `node "${scriptPath}" ${kind}` の形で呼ぶため、スクリプトから見れば
違いは stdin JSON のフィールド名の2パターンだけ。）

## 振る舞いの詳細

- `FsAgentIntegrationInstaller.status/install/uninstall` の内部実装：
  ```
  spec = HOOK_SPECS[kind]
  paths = { configFile: spec.configFile(env, home), hooksDir: spec.hooksDir(env, home), binName: spec.binName }
  root = readJsonObject(paths.configFile)  // 既存のまま
  entries = getPath(root, spec.entriesPath)  // sessionStartEntries 相当
  // install: entries.some(spec.isOurs) なら "既に導入済み"、そうでなければ
  //   entries に spec.buildEntry(scriptPath, kind) を追加 → setPath で書き戻し
  // uninstall: entries.filter(e => !spec.isOurs(e)) → setPath で書き戻し
  // status: entries.some(spec.isOurs) が installed
  ```
  既存の Claude Code・Codex の `status`/`install`/`uninstall` の呼び出し側（`AgentIntegrationService`・
  protocol・UI）は一切変えない——`HookSpec` への置き換えは `AgentIntegrationInstaller.ts` の内部実装
  だけに閉じる。
- **glob ディレクトリ形式（Copilot・Grok）**: `configFile` が本製品専用のファイル
  （`hooksDir` 直下の `wtm-agent-report.json`）を指す**だけ**で、`install`/`uninstall`/`status` は
  上記と**全く同じ共通アルゴリズム**をそのまま使う（特別扱いをしない）。他の既存 `*.json` ファイルは
  そもそも `configFile` が指さないため読み書き対象にならず、「書き込み範囲の限定」が保たれる。
  `uninstall` 後、専用ファイルは削除されず `{"hooks":{"sessionStart":[]}}` のような空のエントリ配列を
  持つ状態で残る（既存の Claude Code・Codex の uninstall——設定ファイル自体は残し、配列からエントリを
  外すだけ——と同じ挙動。`status` は `entries.some(spec.isOurs)` が false になるため「未導入」と
  正しく判定する。ファイル自体の削除は行わない——共通アルゴリズムから逸脱させないための意図的な判断）。

## ドメイン固有の考慮

- **Devin CLI のパス未確認**（上記「設計方針」）は、`docs/verification.md` に「このエージェントだけ
  パスが公式ドキュメントで確認できておらず、実装は類推に基づく」と明記する（他5エージェントとは
  確度が異なることを利用者に伝える）。
- herdr との対応は `docs/herdr-parity.md` H32 に新しい行（H32b 等）を追加し、6エージェント分の
  対応状況・herdr との差異（herdr は自身の連携プロトコル経由、本製品は各エージェントの公式フックを
  直接使う——既存の H32 の記述と同じ論法）を記す。

## エラー処理 / 異常系

- 未知の `kind`・不正な `sessionId` は `resumeCommandFor` が `undefined` を返す（既存と同じ。変更なし）。
- `HookSpec.configFile` が指すファイルが存在しない・JSON として読めない場合の扱いは既存の
  `readJsonObject`（ENOENT は空オブジェクト、パース失敗は `{ok:false}`）をそのまま使う——8 kind
  共通の挙動（既存の Claude Code・Codex と変えない）。
- glob ディレクトリ形式（Copilot・Grok）で `hooksDir` が存在しない場合、`install` が `mkdir` する
  （既存の `mkdir(paths.hooksDir, {recursive:true})` をそのまま再利用）。

## 受け入れ基準との対応

- AC1: `HOOK_SPECS` の6エントリと `HookSpec.buildEntry`/`entriesPath` が、research F4 の表どおりの
  設定ファイル・hook エントリを書き込む。単体テストで各 kind の書き込み結果を F4 の表と突き合わせる。
- AC2: 連携を有効化していないエージェントの pane は現状どおり復元される——`maybeResumeAgentSession`
  は `agentSession` が無ければ何もしない（「依拠する既存の事実」参照。変更なし）。
- AC3: 対象エージェントが未検出・識別子未報告の pane も同様——`agentSession` フィールド自体が
  存在しないため AC2 と同じ経路で現状どおり復元される。
- AC4: 保存された識別子が無効・失効している場合、`resumeCommandFor`（未知 kind・不正 `sessionId` で
  `undefined`を返す。既存の `SAFE_SESSION_ID` 検証は変更しない）が `undefined` を返し、
  `maybeResumeAgentSession` が何も書き込まない——pane は `failed` にならず通常のシェルのまま。
- AC5: `session.json`（`SessionFile.ts:22,80` の `agentSession`。「依拠する既存の事実」参照）の永続化
  （pane 単位）は既存の仕組みをそのまま使うため、新規のロジック無し。8 kind 分のテストケースを
  追加して確認する。
- AC6: 自動再開の可否は `AgentIntegrationService`（`KINDS` に6追加するだけ）・`IntegrationFile` の
  永続化が既存のまま担う。導入状況そのものは各エージェントの設定ファイル（`HookSpec.configFile`）
  自体に書き込まれることで永続化される（「依拠する既存の事実」参照）。
- AC7: 既存の Claude Code・Codex 向けテストを無変更のまま通すことで確認する（`HookSpec` の `claude`/
  `codex` エントリが既存の `pathsFor`/`buildEntry` と同じ結果を返すことを、リファクタの正しさとして
  既存テストで検証する）。
- AC8: `docs/herdr-parity.md` H32 の更新・`docs/verification.md` への追記。
- AC-I1: `AGENT_INTEGRATION_KINDS` 配列に6エントリ追加するだけで、既存の導入操作 UI
  （有効化前の説明表示を含む）がそのまま6エージェント分に対応する。
- AC-I2: 同様に、既存の解除操作 UI がそのまま対応する（新しい UI ロジックを追加しない）。
- AC-I3: 同様に、既存の状態表示 UI がそのまま対応する。
- AC-I4: `AGENT_INTEGRATION_KINDS` への配列追加はテンプレートの複製を伴わないため、設定画面の他の項目
  （Claude Code・Codex の節を含む）のテンプレート・操作性に影響しない（「依拠する既存の事実」の
  `v-for` 構造を参照）。
