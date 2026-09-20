# 計測の証跡（design D9 の判断材料）

- 計測日: 2026-09-18 / 環境: WSL2・Intel Core i5-1335U・Node 24.15.0・Bun 1.4.2
- 依存: `@xterm/headless@6.0.0` `@xterm/addon-serialize@0.14.0`（`npm i` してから実行）
- 実行: `node bench.mjs` / `bun bench.mjs`（VT 解析と serialize）、`node --expose-gc mem.mjs` / `bun mem.mjs`（メモリ）

## 結果（3 回の値）

| 項目 | Node 24.15 | Bun 1.4.2 |
|---|---|---|
| VT 解析（58.3MB の合成ログ。120×40・scrollback 1 万行） | 51.7 / 54.4 / 52.5 MB/s | 73.6 / 75.5 / 70.9 MB/s |
| serialize（scrollback 1 万行 → 582KB） | 57 / 59 / 56 ms | 80 / 68 / 62 ms |
| 16 pane × scrollback 1 万行（120 桁）の RSS 増分 | 400 MB（1 pane 25 MB） | 391 MB（1 pane 24.4 MB） |

合成ログの中身は `bench.mjs` の `makeChunk()`（SGR 色・24bit 色・全角文字・`\r` による進捗行・カーソル移動）。

## 端末からの問い合わせへの応答（design「端末からの問い合わせ」の根拠）

`node query-response.mjs` の結果（@xterm/headless 6.0.0）：
`\x1b[c`（DA1）→ `\x1b[?1;2c`、`\x1b[>c`（DA2）→ `\x1b[>0;276;0c`、`\x1b[6n`（CPR）→ `\x1b[1;6R`、
`\x1b[?25$p`（DECRQM）→ `\x1b[?25;1$y` が `onData` に出る。`parser.registerCsiHandler` / `registerOscHandler` も存在する。

## node-pty 1.2.0-beta.15 の型定義（`npm pack` した tarball の `typings/node-pty.d.ts`）

`pause(): void`（L193）、`resume(): void`（L198）、`useConptyDll?: boolean`（L105）、`readonly process: string`（L136）がある。

## 追加の問い合わせ（design の独立点検の指摘を受けて確認。`node query-response-2.mjs`）

@xterm/headless 6.0.0 の応答：DECRQSS（`DCS $ q m ST`）→ `\x1bP1$r0m\x1b\\`、DSR 5（`CSI 5 n`）→ `\x1b[0n`。
**応答しないもの**：OSC 10/11/12 `;?`（前景・背景・カーソルの色）、OSC 4（パレット）、XTVERSION（`CSI > q`）、XTWINOPS 18（`CSI 18 t`）、kitty keyboard の問い合わせ（`CSI ? u`）。

## スナップショットの大きさ（architecture D28 の判断材料。`node snapsize.mjs`）

120 桁・scrollback 1 万行の headless に 1.2 万行の合成ログを書いた後、`serialize({ scrollback: N })` を測った（deflate は zlib level 1）。

| N（行） | serialize | 非圧縮 | deflate 後 | 圧縮率 |
|---|---|---|---|---|
| 0 | 4 ms | 3 KB | 1 KB 未満 | 6.1 |
| 1,000 | 24 ms | 68 KB | 7 KB | 9.5 |
| 5,000 | 56 ms | 328 KB | 34 KB | 9.6 |
| 10,000 | 89 ms | 654 KB | 67 KB | 9.7 |

## AgentMonitor の1周期の所要時間（02-agent-detection T9・AC17・decisions.md D52。`node agent-monitor-cycle.mjs`）

計測日: 2026-09-18 / 環境: WSL2・Node 24.15.0 / 実物の PTY 16 個（`/bin/bash` 対話起動）＋実物の
`LinuxProcessInspector.foregroundJob`（D48 の `/proc` 全体走査フォールバック）＋実物の `claude.toml` マニフェスト。
計測時のシステムの総プロセス数：56（`/proc` 直下の数字ディレクトリ）。`AgentMonitor.tick()` と同じ形
（16 pane 分を `Promise.all` で並行に `foregroundJob` → `evaluate`）で3周分を連続して測った。

| 周 | 実行1回目 | 実行2回目 |
|---|---|---|
| 1周目（コールドキャッシュ） | 198.91 ms | 209.33 ms |
| 2周目 | 118.54 ms | 135.74 ms |
| 3周目 | 110.69 ms | 114.58 ms |

**設計の「判定そのものは数ms（推測）」（design.md「判定の周期」）は外れていた**——実際は 16 pane 分・並行で
おおよそ **110〜210ms/周**（安定後は 110〜135ms）。ただし非機能要件（`requirements.md`「状態反映」：
状態変化が2秒以内に反映）には十分収まる。支配的なコストは pane ごとに `/proc` を丸ごと読み直す
`scanProcessGroupMembers`（D48）で、システム全体のプロセス数 × pane 数に比例する
（このベンチ環境はプロセス数が少ない部類。プロセス数が多い実機ではさらに伸びる）。decisions.md D52 に判断を残した。
