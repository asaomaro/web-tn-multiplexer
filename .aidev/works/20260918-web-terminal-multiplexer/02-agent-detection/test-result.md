# テスト結果: 02-agent-detection（エージェント状態判定）

subtask の test（protocol-subtask.md）につき、範囲は**単独で検証可能な範囲**に限定する。tasks.md 冒頭の
「担当の AC＝AC6（判定一式）・AC16（Windows の前面プロセスでの判定）・AC17（判定の周期）」に沿って検証する。
サイドバー等での実際の表示（03-web-desktop）、ブラウザ視点の e2e（応答性 p95・状態反映の実測。05-e2e-docs）、
Windows 実機・herdr 対応エージェントの実機確認は、この subtask の範囲外（「未検証の穴」に明記）。

## 実行したもの

- `pnpm -r --filter=./packages/* run typecheck`（`tsconfig.typecheck.json`）— 2/2 passed
- `pnpm exec eslint . --ext .ts`（リポジトリルートから）— 0 errors
- `packages/protocol`: `pnpm exec vitest run` — 11 passed / 0 failed / 0 skipped
- `packages/server`: `pnpm exec vitest run` — 331 passed / 0 failed / 0 skipped（36 ファイル。実物の PTY・実物の
  `/proc`・実物の 22 herdr マニフェストを使う結合テストを含む: `composeServer.integration.test.ts` 7件
  （うち1件は実物の PTY で偽の `claude` 実行ファイルを起動して `pane.agent_status_changed` を確認するもの。
  T10）、`LinuxProcessInspector.integration.test.ts`、`ManifestStore.test.ts`/`ManifestEngine.test.ts`
  （実物の `third_party/herdr/agent-detection/*.toml` 22件全件の読み込み）ほか）
- `aidev smoke`（`pnpm -s build && pnpm -s smoke`）— pass（後述。`agent manifests ok (22/22)` を含む）
- `node .aidev/works/20260918-web-terminal-multiplexer/evidence/agent-monitor-cycle.mjs`（AC17。実物の PTY
  16個＋実物の `/proc` 走査＋実物の claude マニフェストで、`AgentMonitor.tick()` と同じ並行判定を3周計測）
  — 結果は `evidence/README.md`「AgentMonitor の1周期の所要時間」・decisions.md D52 に記録済み

## 受け入れ基準ごとの判定

（AC の番号は requirements.md。この subtask が担当するのは AC6・AC16・AC17 のみ——他の AC は
01-server-core/03-web-desktop/04-mobile/05-e2e-docs の担当で、`aidev coverage` にもタスクが無い形で出ている）

- **AC6**（前面プロセスからエージェントの種類を判定し、画面の内容から working/idle/blocked/unknown の状態と
  busy を求め、一覧に反映する一式）: **pass**——
  - 前面ジョブの収集（`LinuxProcessInspector.foregroundJob`）: `LinuxProcessInspector.integration.test.ts`
    （実物の bash+PTY。単一プロセス・パイプラインの両方）。
  - プロセス名 → エージェント種類（`ProcessMatcher.match`・`agents.ts`）: `ProcessMatcher.test.ts` 51件
    （herdr の `identify_agent_in_job`/`identify_known_agents` の移植ケース＋実物の claude/codex の
    cmdline＋自作の Windows cmd/powershell ラッパーのケース）。
  - 判定ルールの読み込み・検証（`ManifestStore`）: `ManifestStore.test.ts`（実物の22ファイル全件＋13件の
    合成された検証失敗ケース）。
  - 判定ルールの評価（`ManifestEngine.evaluate`）: `ManifestEngine.test.ts` 12件（herdr の
    `manifest/tests.rs` の移植ケース＋claude/codex/devin の実物ルールでの working/idle/blocked/skip）。
  - 状態遷移のヒステリシス（`AgentTracker`。3秒の起動猶予・working→idle の保留）: `AgentTracker.test.ts`
    14件（herdr の `pending_idle_holds_working_to_plain_idle_until_confirmed` の移植を含む）。
  - 判定の周期と `SessionService.updatePaneRuntime` への反映一式（`AgentMonitor`）: `AgentMonitor.test.ts`
    6件（周期・直列化・保留中の短い再確認・focus による既読・pane 消滅への耐性・stop()）。
  - **end-to-end での確認**: `composeServer.integration.test.ts` に、実物の PTY で偽の `claude` 実行ファイル
    （`live_turn_working` ルールに当たる画面を出す）を起動し、実物の WebSocket 経由で
    `pane.agent_status_changed`（`kind==='claude'`）が届くことを確認するテストを追加した（T10）。
  - **未検証の穴**: `agents.ts` の `AGENT_DESCRIPTORS` は claude・codex だけ `verified: true`
    （decisions.md D46）。他の約20エージェント（qwen・gemini・cline 等）は herdr のマニフェストが読み込め・
    コンパイルできること、判定エンジン自体（region 抽出・gate 評価）が正しいことまでは確認しているが、
    実際にそれらのソフトウェアを起動して画面の一致を個別に確認してはいない（herdr 側の検証に依拠。
    本製品としては未検証）。
- **AC16**（Windows の前面プロセスでの判定）: **partial**——`WindowsProcessInspector.test.ts` 11件で、
  fake のプロセスツリー（`@vscode/windows-process-tree` を差し替え）を使い、最も深い子孫から対応表に当てる
  ロジック・`foregroundJob` の全経路収集を確認済み。**Windows 実機での確認はできていない**
  （01-server-core の test-result.md の AC16 と同じ制約。05-e2e-docs か実機での手動確認へ引き継ぐ）。
- **AC17**（この subtask の担当分＝「判定の周期」）: **pass**——`AgentMonitor.test.ts` で、出力の有無による
  500ms/1秒の切り替え、保留中の100ms再確認、pane ごとの直列化を確認済み。さらに実測として、実物の PTY 16個・
  実物の `/proc` 全体走査（D48）・実物の claude マニフェストで1周期の所要時間を測り、安定後で約110〜135ms/周
  （16 pane 分・並行）であることを確認した（design.md の「数ms（推測）」という記述は外れていたが、
  2秒以内の非機能要件には十分収まる。decisions.md D52 に詳細）。**応答性 p95 50ms・ブラウザから見た
  状態反映2秒以内の実測は、ブラウザ描画を含む e2e（05-e2e-docs）の担当**——この subtask では
  サーバ側の判定コストのみを測った。

## 失敗の証跡

このラウンド（test 工程開始後）では失敗が発生していない。coding 工程中に見つかった不具合
（`AgentTracker.needsFastRecheck` が猶予明けの境界の心拍で誤って false を返す問題）は、coding 工程の中で
発見・修正・再承認まで完了している（decisions.md D51）。詳細な原因究明の過程（vitest の偽時計を疑って
回り道をした経緯を含む）も D51 に記録済み。

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260918-web-terminal-multiplexer/02-agent-detection
note: 起動確認は work 全体の性質なので、記録は親 20260918-web-terminal-multiplexer に刻みます
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46025 (state dir /tmp/wtm-smoke-iBmLab)
{"ts":"2026-09-18T11:55:46.719Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke: PASS
smoke: pass (exit 0)
```

この work は今回、新しい入口（サブコマンド・CLI オプション）を追加していない（`AgentMonitor` は
`composeServer` の内部配線に差し込まれただけ）。`smoke.ts` に「判定ルールの読み込みが全件成功しているか」の
確認（`agent manifests ok (22/22)`）を追加したが、これは既存の `smokeCommand` が通す経路（`composeServer`→
`listen()`）の中身が増えただけなので、`smokeCommands` への複数形移行は不要と判断した
（01-server-core の同じ判断を踏襲）。

## 未検証の穴（skip / 環境不足）

- **AC16 の Windows 実機確認**（上述）。
- **claude・codex 以外の約20エージェントの実機での画面一致確認**（上述。AC6）。
- **AC17 のうちブラウザ視点の実測**（応答性 p95・状態反映2秒以内の e2e 計測）は 05-e2e-docs の担当。
- **herdr からの機能棚卸し（F12）でのエージェント検出範囲の扱い**は 01-server-core の担当範囲外の記述に
  含まれており、この subtask では扱っていない（対象外）。

## ラウンド2（review ラウンド1の指摘を修正後の再検証）

review 工程の独立レビュー（4本委譲）で見つかった1件の must と6件の should（`review.md`「ラウンド1」）を
coding 工程へ差し戻して修正した後の再検証。

### 実行したもの（再実行）
- `pnpm -r --filter=./packages/* run typecheck` — 2/2 passed
- `pnpm exec eslint . --ext .ts` — 0 errors
- `packages/protocol`+`packages/server`: `pnpm exec vitest run` — **344 passed** / 0 failed / 0 skipped
  （ラウンド1の331件に、指摘の修正に対応する回帰テストを13件追加。内訳は `decisions.md` の該当決定・
  `review.md`「ラウンド1」の各行を参照）。
- `aidev smoke`（`pnpm -s build && pnpm -s smoke`）— pass（`agent manifests ok (22/22)` を含む）

### must の直接確認（`ProcessMatcher` の同点誤判定。review.md 参照）
修正前のコードに戻して新しい回帰テスト（`ProcessMatcher.test.ts`「配列の順序に依らない」）を実行し、
実際に `cline`（誤り）を返すことを確認した上で修正を復元し、通ることを確認した
（`ProcessMatcher.ts` の該当行を一時的に戻して再現→復元。この session 内で実施）。

### should 6件の直接確認
各修正について、対応する新規回帰テストが「修正前は落ちる／修正後は通る」ことまで確認したもの
（`AgentTracker.needsFastRecheck` の境界バグと同じ轍を踏まないよう、特にタイムアウト防御と `stop()` の
排出は fake timer 下で明示的にタイミングを作って検証した）と、修正自体が明確で追加確認を要さなかったもの
（検証上限・タイブレーク・`deepestPathNodes` のテスト追加）がある。詳細は `review.md`「ラウンド1」の
各行の「対応」欄を参照。

### 受け入れ基準ごとの判定（更新）
結論は変わらない（AC6: pass・AC16: partial・AC17: pass）。今回の修正はいずれも AC6/AC17 の正しさ・堅牢性を
さらに厳密にしたもの（特に `ProcessMatcher` の同点誤判定はラップ検出の信頼性そのものに関わるため、AC6 の
「判定一式」の正確性を直接底上げした）。
