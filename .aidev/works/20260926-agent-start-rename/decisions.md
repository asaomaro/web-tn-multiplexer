# 判断の記録（20260926-agent-start-rename）

## D1: 実行三層（full）と範囲の選定——本 work は「名前」（`agent rename` と名前による対象指定）だけを着地させ、`agent start` は兄弟の backlog 項目に割る

- **背景**: backlog 項目（`.aidev/backlog/product-roadmap.md` の「エージェント自動化: `agent start`・`agent rename` と
  名前による対象指定」。`docs/herdr-parity.md` の H39 の残り）は、herdr の一次資料
  （`/workspaces/web-tn-multiplexer/scratchpad/herdr`。以下 herdr）を読むと性質の違う 2 つの塊に分かれる:
  1. **名前**——検出済みのエージェントに名前を付け・外す（`agent rename <target> <name>|--clear`。
     herdr `src/cli/agent.rs:751-768`・`src/app/agents.rs:91-142`）、エージェントを指す全コマンドが
     「一意な live な名前 または そのエージェントが居る pane ID」を受ける（`src/app/terminal_targets.rs:75-104`・
     `docs/next/website/src/content/docs/cli-reference.mdx:346`）、名前は `[a-z][a-z0-9_-]{0,31}` で live な
     エージェント間で一意（`src/app/agents.rs:14-20, 101-109`）、名前は pane の今の住人に付いて、住人が終了・
     入れ替わると消える（`cli-reference.mdx:348`・`src/terminal/state.rs:1970-1990`）。
     名前は `AgentInfo` の新しい項目になるので protocol・server・web・cli に波及する。
  2. **起動**——`agent start <name> --kind KIND --pane ID [--timeout MS] [-- <args>]`（`src/app/agents.rs:144-231`・
     `src/cli/agent.rs:289-436`）。空いているシェル pane の判定（前面プロセスグループがシェル自身だけ・
     シェル名が既知。`src/platform/mod.rs:330-341, 422-437`）、kind から実行ファイルを決める固定表
     （`src/detect/mod.rs:153-182`）、シェルごとの引数のクォート（POSIX／PowerShell。`src/platform/mod.rs:361-391`）、
     起動中（pending）→ blocked/active の状態機械と 3 秒の猶予・既定 30 秒の締め切り
     （`src/terminal/state.rs:1917-2046`）、CLI 側の待ち合わせと再試行（`src/cli/agent.rs:355-436, 562-630`）。
     **start は名前を必須にする**（`cli-reference.mdx:346`「Agents started through `agent start` require a name」）。
- **決定**: 本 work は **1（名前）だけ**を対象にする。2（`agent start`）は backlog に `[ ]` の兄弟として割って残す
  （deliver で行を割る）。三層判定は **full**（protocol の型を変え、server・web・cli の 4 パッケージに波及する。
  light の条件「振る舞いを変えない小規模」に当たらない）。
- **理由・代替案**:
  - **start は名前の上に載る**。herdr の start は名前を必須にし、起動完了の待ち合わせも名前で相手を追う
    （`src/cli/agent.rs:562-630` の `wait_for_named_agent`）。名前の置き場・一意性・消える条件が先に固まって
    いないと、start の設計が名前の設計を兼ねることになり、1 つの PR が 2 つの独立した判断（名前のモデルと
    「任意のコマンド実行にならない起動」）を抱える。
  - **start は安全面の判断が重い**。pane の PTY にシェルのコマンド行を書き込む機能で、kind の固定表・引数の
    クォート（bash/zsh/fish/pwsh/cmd.exe でそれぞれ違う）・Windows（ConPTY。前面プロセスグループが無く、
    herdr も「シェルが初期化中か」を判定できない。`src/cli/agent.rs:680-686`）の扱いを、独立に設計・レビュー
    したい。名前と一緒にすると差分が大きくなり、独立レビューの目が安全面に集中しにくくなる。
  - 代替案 A「start と名前を 1 PR で」: 上の 2 点で不採用。代替案 B「start だけ先に（名前なし）」: herdr の
    start の契約（名前必須）から外れ、後で名前を足すと start の CLI の形が変わるので不採用。
  - 名前だけでも利用者に価値がある: 手で起動したエージェントに名前を付け、以後 `wtmctl agent prompt reviewer …`
    のように pane ID を調べ直さずに指せる（pane を分割・移動しても名前は同じ住人に付いたまま）。
- **影響**:
  - `AgentInfo`（`packages/protocol/src/model.ts:107`）に名前を足す。形（必須か省略可か）と既存の表示・保存・
    プロトコルとの互換は design で扱う。
  - backlog の兄弟: 「`agent start`（空いているシェル pane の判定・kind の固定表・引数のクォート・起動完了の
    待ち合わせ。本 work の名前の上に載せる）」を deliver で `[ ]` として残す。
  - `docs/herdr-parity.md` の H39 は「一部対応」のまま、名前の対応を書き足す。

## D2: 名前の置き場は `SessionService`（公開している `Pane.agent`）とし、`AgentTracker` には持たせない

- **背景**: 名前を検出（`AgentTracker` の `info`）に持たせるか、公開状態（`SessionService` の `Pane.agent`）に持たせるか
  （research「design への申し送り」）。
- **決定**: `SessionService.renameAgent` が `Pane.agent` に名前を載せ、`updatePaneRuntime` が「同じ `instanceId` なら前の名前を
  引き継ぐ」。`AgentTracker` は名前を知らない。
- **理由・代替案**: 代替案「`AgentMonitor` に `renameAgent` を足し tracker の `info` に名前を持たせる」は、(1) 一意性の検査に
  全 pane を見る必要があり結局 `SessionService` を読む、(2) 検出を経ずに注入したエージェント（cli の smoke。research F2.4）には
  tracker が無く名前を付けられない、(3) RPC の依存（`MethodDeps`）に `AgentMonitor` を足すことになる、ので不採用。
  名前は利用者の決めた値で、検出の結果ではない。
- **影響**: 引き継ぎを忘れると判定の周期ごとに名前が消える（research R1）。テストで「判定の周期をまたいで残る」
  「別の instanceId では消える」を確かめる。

## D3: `AgentInfo.name` は省略可（`name?: string`）にする

- **背景**: herdr の `AgentInfo.name` は `Option<String>`（常に出る）。本製品で `name: string | null` の必須にするか。
- **決定**: 省略可。省略＝名前なし。CLI の出力（`AgentView`）は `name: string | null` に正規化して常に出す。
- **理由・代替案**: 必須にすると `AgentInfo` のリテラルを持つ 30 ファイル（research F2.5）の型検査が落ち、並行 work が触っている
  テストファイルとも広く重なる。受け手（web・cli）は同じリポジトリから同時に配られる（research F3.4）が、保存もされない
  （F3.1・F3.2）ので、省略可で失うものは「名前が無いことを明示的に表せない」ことだけで、`undefined` と `null` を区別する
  使い道が無い。
- **影響**: `renameAgent` の `--clear` は項目を消したオブジェクトを作る（`name: undefined` を残さない）。

## D4: 名前の解決は CLI（hello の snapshot）で行い、サーバの RPC は pane ID だけを受ける

- **背景**: herdr はサーバで解決する（`resolve_agent_target`）。本製品の既存の CLI は hello の snapshot で pane を引き、書き込みの
  RPC に `instanceId` を添えてサーバが照合する（research F4.1〜F4.3）。
- **決定**: `resolveAgentTarget(snapshot, target)` を CLI に置き、解決後は既存どおり `paneId`＋`instanceId` で RPC を呼ぶ。
- **理由・代替案**: 代替案「全 RPC に `target` を足してサーバで解決」は、読み取り系（`agent get/wait/read`）が RPC ではなく hello の
  snapshot とイベントで動いている（research F4.1・F4.3）ため、結局 CLI 側にも解決が要り二重になる。CLI で解決して `instanceId` を
  渡せば、解決から書き込みまでの間の入れ替わりは既存のサーバの照合がそのまま防ぐ（FR12）。
- **影響**: サーバ側に名前での指定の入口は無い（web は名前で指す操作を持たない）。`agent_target_ambiguous` は CLI が出す。

## D5: CLI の Command の `paneId` は `target` に改名しない（design からの逸脱）

- **背景**: design「インターフェース / データ構造」は、`agent-get/wait/read/prompt/send-keys` の Command の `paneId` を
  `target` に改名するとしていた。実際に改名すると、型検査が `agent.integration.test.ts`・`agentPrompt.integration.test.ts`・
  `commands/agent.test.ts`・`cliArgs.test.ts` の 30 か所ほどで落ちる。
- **決定**: 型の項目名は `paneId` のまま残し、「pane ID かエージェントの名前」であることを型の直前のコメントで示す。
  利用者に見える部分（USAGE・help の `<target>`・使用誤りの `missing target`）は `target` にする。
- **理由・代替案**: 結合テスト（`*.integration.test.ts`）は並行 work（`load-flaky-tests`。高負荷時だけ落ちるテストの修正）が
  触っているファイルで、項目名の機械的な改名は振る舞いを変えずにマージの衝突だけを増やす。改名の価値（読みやすさ）より
  衝突を避けるほうを取った。
- **影響**: `commands/agent.ts` の `cmd.paneId` は解決前の文字列（名前でありうる）。解決後は `resolveAgentTarget` の戻り値の
  `paneId` だけを RPC に渡す（`cmd.paneId` を RPC に直接渡す箇所は残していない）。

## D6: 携帯の pane 選択（PanePicker）と移動の候補（GotoPicker）も名前に合わせた（tasks の対象の追加）

- **背景**: design の web の範囲は `paneNameOf` とサイドバーだけだった。taskcheck T7 で、呼び名が名前に変わると移動の候補の絞り込みが
  種類の表示名で引けなくなること、cross 点検で携帯のエージェント一覧（`packages/web/src/mobile/PanePicker.vue:110`）が名前を出さないことが分かった。
- **決定**: GotoPicker の絞り込みに `pane.agent?.label` を足し（名前と種類の両方で引ける）、PanePicker は「名前（種類）」で出す。
- **理由・代替案**: 対象外にして requirements に書く案は、US4（CLI で付けた名前と画面のエージェントの対応付け）と携帯だけ食い違う状態を残すので不採用。
- **影響**: tasks.md の T7 の対象に 2 ファイルを追記。docs/wtmctl.md に携帯の一覧を追記。

## D7: `updatePaneRuntime` が名前付きの `AgentInfo` をそのまま反映する点は今回は直さない（review ラウンド 1 の nit）

- **背景**: 独立レビューで、`updatePaneRuntime` は `patch.agent.name` があれば書式・一意性を検査せずに反映すると指摘された。
- **決定**: 許容する。名前を書く本番の経路は `renameAgent` だけで、`updatePaneRuntime` の呼び出し元（`AgentMonitor`）は名前を持たない。
- **理由・代替案**: 「常に正規化して `patch.agent.name` を無視する」案は妥当だが、test 通過後の振る舞いの変更になり、本 work の利用者に見える差は無い。
- **影響**: backlog の `agent start` 兄弟項目で、起動時に名前を付ける経路を `renameAgent`（または同じ検査）経由にすることを申し送る。
