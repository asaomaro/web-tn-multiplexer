# テスト結果: pane の枠の描画モードと隙間の入切

## 実行したもの

- `pnpm -s test`（worktree 直下。全パッケージの vitest）— Test Files 162 passed (162) / Tests 3042 passed (3042)（exit=0。coding の最後の修正の後に実行）
- 対象ファイル単体: `npx vitest run src/layout/paneChrome.test.ts src/store/settings.test.ts src/components/PaneFrame.test.ts
  src/components/PaneLayout.test.ts src/components/SettingsDialog.test.ts src/actions/ActionDispatcher.test.ts`（packages/web）— すべて pass
- `pnpm -s typecheck` — exit=0 ／ `pnpm -s build` — exit=0 ／ 変更した TS ファイルの `npx eslint` — exit=0
- `aidev smoke` — pass（2 本。下の「起動確認」）
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 追加した挙動 17 箇所を 1 つずつ壊して対応するテストを走らせる
  スクリプト（scratchpad の `negctl.py`。毎回元に戻して `cmp` で一致を確認）— 17 変異すべてでテストが落ち、全ファイル復元済み
  （前後の `git diff --stat` も一致）。出力は下の「失敗の証跡」。
- E2E（packages/e2e の playwright）は走らせていない（利用者の方針）。

## 受け入れ基準ごとの判定

- AC1: pass — 既定（保存値なし・壊れた値）で「常に」「入」（settings.test）。props 省略・既定設定の `PaneFrame` と、単一 pane・入れ子分割の
  `PaneLayout` で 4 辺 `var(--wtm-pane-gap, 4px)`・名前表示時の上 `calc(var(--wtm-pane-gap, 4px) + 1.2em)`（変更前の CSS と同じ値）・選択の強調あり・
  `pane-frame-edge-flush` なし（PaneFrame.test・PaneLayout.test）。負の確認 N5・N6。
- AC2: pass — 「分割時だけ」で単一 pane の tab は余白 0・強調なし、入れ子分割と zoom 中は 4 辺に余白・強調あり（PaneLayout.test）。N1・N13・N14。
- AC3: pass — 「表示しない」で外周の辺 0・強調なし・名前なし（paneChrome.test・PaneLayout.test・PaneFrame.test）。N3・N9・N10。
- AC4: pass — 隙間切で隣と接する辺だけ 0、入れ子 `p1 | (p2 / p3)` の各辺（PaneLayout.test）、隣が 1 辺だけの入力を 4 辺とも（paneChrome.test）。N2・N4・N15。
- AC5: pass — 「表示しない」×隙間入で隣と接する辺にだけ余白（paneChrome.test・PaneLayout.test）。
- AC6: pass — 設定画面の操作・`set*` で ref と `wtm.prefs.v1` が更新され新しいストアが読み戻す（settings.test・SettingsDialog.test）、
  `storage` 追従（settings.test）、`reloadConfig`（ActionDispatcher.test）、ストアを変えるとその場で余白が変わる（PaneFrame.test）。N7・N8・N16・N17。
- AC7: pass — `paneFrames` 無し（モバイル）は設定を「表示しない」×隙間切にしても `.pane-frame-enabled` も余白の style も付かない（PaneLayout.test・PaneFrame.test）。
- AC8: pass — `docs/herdr-parity.md` の H23 行と `docs/verification.md` の確認手順を更新（目視。taskcheck T7 で文言・既定キーを照合）。
- AC9: pass — 余白を取る辺の値が常に `var(--wtm-pane-gap, 4px)`（太さの CSS 変数）であること（PaneLayout.test の「表示しない×隙間入」「常に×隙間切」）。
  CSS 変数の実際の px（2/4/6）への解決は happy-dom では確かめられない（下の穴）。
- AC-I1: pass — 「表示」節にラジオ群（legend「pane の枠の表示」）・隙間のスイッチ・`aria-describedby` の説明文がある。閉じても値は残る（SettingsDialog.test）。
- AC-I2: pass — `@change`／`@click` で即反映・保存（確定ボタンなし）。押し直しで元に戻る（SettingsDialog.test）。
- AC-I3: 一部 pass — ラジオが同じ name の 1 群であること・スイッチが button であることを確認。ネイティブのラジオの矢印キーでの移動・
  Space/Enter での押下はブラウザの挙動で、happy-dom では再現しない（下の穴）。
- AC-I4: pass — 操作後の `document.activeElement` がその部品のまま（SettingsDialog.test）。
- AC-I5: 一部 pass — 枠を描かない pane でも枠は `tabindex=0`・`aria-current`・Enter でメニューが開き、`pane-frame-edge-flush` が付く（PaneFrame.test）。
  その class による端末の上の線（`::after`）が実画面で見えることは未確認（下の穴）。

## 失敗の証跡

このラウンドでは受け入れ基準の検証で失敗は発生していない。以下は負の確認（意図して壊したときに落ちること）の生の出力：

```
$ python3 negctl.py
N1 framed の auto 条件を外す（分割時だけ→常に扱い）（src/layout/paneChrome.ts）: exit=1 Tests  3 failed | 34 passed (37) / 復元 cmp=一致
    × 分割時だけ：分割していなければ枠なし・余白なし、分割していれば常にと同じ（AC2） 17ms
    × 枠なし×隙間入：隣と接する辺にだけ余白（AC5） 5ms
    × 分割時だけ：単一 pane の tab は余白・強調なし、分割（zoom 中を含む）は常にと同じ（AC2） 19ms
N2 隣の辺で隙間を無視する（src/layout/paneChrome.ts）: exit=1 Tests  4 failed | 33 passed (37) / 復元 cmp=一致
    × 隙間切：隣と接する辺だけ余白なし、外周は枠の設定どおり（AC4） 18ms
    × 辺ごとに、その辺の隣だけを見る（隣が 1 辺だけの入力を 4 辺とも試す。AC4・AC5） 2ms
    × 常に×隙間切：入れ子でも辺ごとに隣を判定し、隣と接する辺だけ 0（AC4・AC9） 27ms
N3 外周の辺で枠を無視する（src/layout/paneChrome.ts）: exit=1 Tests  7 failed | 30 passed (37) / 復元 cmp=一致
    × 分割時だけ：分割していなければ枠なし・余白なし、分割していれば常にと同じ（AC2） 17ms
    × 表示しない：分割の有無に関わらず枠なし、外周の辺は余白なし（AC3） 3ms
    × 辺ごとに、その辺の隣だけを見る（隣が 1 辺だけの入力を 4 辺とも試す。AC4・AC5） 2ms
N4 childNeighbors の right 分割の a/b を取り違える（src/layout/paneChrome.ts）: exit=1 Tests  4 failed | 33 passed (37) / 復元 cmp=一致
    × 右分割：a は右に、b は左に隣を持つ 17ms
    × 入れ子：親の隣を引き継いで 1 辺足す（親は変えない） 2ms
    × 表示しない×隙間入：外周の辺は 0、隣と接する辺にだけ余白（AC3・AC5・AC9） 30ms
N5 loadPaneBorders の既定を herdr と同じ auto にする（src/store/settings.ts）: exit=1 Tests  2 failed | 73 passed (75) / 復元 cmp=一致
    × 読み込み：3 値・boolean はそのまま、それ以外は既定の「常に」「入」（decisions D2） 9ms
    × 何も保存されていなければ「常に」「入」、壊れた値でも同じ 2ms
N6 loadPaneGaps の既定を false にする（src/store/settings.ts）: exit=1 Tests  2 failed | 73 passed (75) / 復元 cmp=一致
    × 読み込み：3 値・boolean はそのまま、それ以外は既定の「常に」「入」（decisions D2） 14ms
    × 何も保存されていなければ「常に」「入」、壊れた値でも同じ 3ms
N7 storage 追従から paneBorders を外す（src/store/settings.ts）: exit=1 Tests  1 failed | 74 passed (75) / 復元 cmp=一致
    × 別のタブ・ウィンドウでの変更に storage イベントで追従する 16ms
N8 reloadConfig から paneGaps を外す（src/actions/ActionDispatcher.ts）: exit=1 Tests  2 failed | 142 passed (144) / 復元 cmp=一致
    × localStorage（wtm.prefs.v1）の今の値を settings・view ストアへ読み直し、トーストを出す（AC13・AC14） 28ms
    × 壊れた値は既定へ落ちる（load* の壊れた値の扱いをそのまま引き継ぐ） 4ms
N9 PaneFrame の強調を framed に関わらず出す（src/components/PaneFrame.vue）: exit=1 Tests  2 failed | 71 passed (73) / 復元 cmp=一致
    × 枠を描かない pane：余白 0・強調なし・名前なし。Tab で止まりキーでメニューが開き、フォーカスの見え方の class が付く（AC-I5） 14ms
    × 分割時だけ：単一 pane の tab は余白・強調なし、分割（zoom 中を含む）は常にと同じ（AC2） 31ms
N10 PaneFrame の名前の余白を framed に関わらず取る（src/components/PaneFrame.vue）: exit=1 Tests  1 failed | 44 passed (45) / 復元 cmp=一致
    × 枠を描かない pane：余白 0・強調なし・名前なし。Tab で止まりキーでメニューが開き、フォーカスの見え方の class が付く（AC-I5） 40ms
N11 flush の条件を「全辺 0」にする（src/components/PaneFrame.vue）: exit=1 Tests  1 failed | 44 passed (45) / 復元 cmp=一致
    × 枠ありで隙間切・上に隣：名前の余白は 1.2em だけ残し、隣の辺は 0（AC1 の名前と AC4 の組み合わせ） 28ms
N12 名前の上余白で、上の辺が 0 のときも隙間を足す（src/components/PaneFrame.vue）: exit=1 Tests  1 failed | 44 passed (45) / 復元 cmp=一致
    × 枠ありで隙間切・上に隣：名前の余白は 1.2em だけ残し、隣の辺は 0（AC1 の名前と AC4 の組み合わせ） 38ms
N13 PaneLayout の root の multiPane を常に false（src/components/PaneLayout.vue）: exit=1 Tests  1 failed | 27 passed (28) / 復元 cmp=一致
    × 分割時だけ：単一 pane の tab は余白・強調なし、分割（zoom 中を含む）は常にと同じ（AC2） 69ms
N14 PaneLayout で子へ multiPane を渡さない（a 側）（src/components/PaneLayout.vue）: exit=1 Tests  1 failed | 27 passed (28) / 復元 cmp=一致
    × 分割時だけ：単一 pane の tab は余白・強調なし、分割（zoom 中を含む）は常にと同じ（AC2） 43ms
N15 PaneLayout で子の隣を足さない（b 側に親の隣をそのまま）（src/components/PaneLayout.vue）: exit=1 Tests  2 failed | 26 passed (28) / 復元 cmp=一致
    × 表示しない×隙間入：外周の辺は 0、隣と接する辺にだけ余白（AC3・AC5・AC9） 38ms
    × 常に×隙間切：入れ子でも辺ごとに隣を判定し、隣と接する辺だけ 0（AC4・AC9） 27ms
N16 設定画面のラジオの値を固定する（src/components/SettingsDialog.vue）: exit=1 Tests  1 failed | 87 passed (88) / 復元 cmp=一致
    × 選ぶとその場で反映・保存され、フォーカスはそのラジオに留まる。閉じても値は残る（AC6・AC-I1・AC-I2・AC-I4） 104ms
N17 設定画面の隙間のスイッチを反転しない（src/components/SettingsDialog.vue）: exit=1 Tests  1 failed | 87 passed (88) / 復元 cmp=一致
    × 隙間の switch は button（Space/Enter で押せる）で既定「入」。押すと「切」になり保存され、フォーカスは留まる（AC6・AC-I2〜AC-I4） 76ms
RESULT: 全変異でテストが落ち、全ファイル復元済み
```

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260926-pane-frame-auto-mode
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:39410 (state dir /tmp/wtm-smoke-1gZe5T)
{"ts":"2026-09-26T02:48:07.805Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/pane-frame-auto-mode/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-HFezE6, sandboxed HOME /tmp/wtmctl-smoke-home-fSRcxM
{"ts":"2026-09-26T02:48:13.694Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
smoke(cli): server listening on http://127.0.0.1:38958
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## 未検証の穴（skip / 環境不足）

- 実画面の見え方: 余白 0 の辺・枠なしの pane の見た目、`::after` のフォーカスの線が端末（xterm の canvas・スクロールバー）の上に出ること、
  名前の legend の位置。E2E を回していないため未確認（`docs/verification.md` に手順を足した）。
- 端末の cols/rows が余白の変化に追従すること: 既存の `followResize`（ResizeObserver）に乗る設計で、単体テストでは葉の大きさを測れない。未確認。
- CSS 変数 `--wtm-pane-gap` の px（2/4/6）への解決: happy-dom は `var()` を解決しない。値が CSS 変数の式であることまでを確認。
- ネイティブのラジオの矢印キー操作・button の Space/Enter（AC-I3）: ブラウザの既定挙動のため単体テストでは再現しない。
- 既存の E2E（`appearance-settings.spec.ts` の既定 4px の padding、`settings.spec.ts` の Tab での移動〔上限を 12→40 回に上げた。decisions D9〕）は
  未実行。既定の見た目の値は変えていないので前者の前提は崩れない見込み（推測）。

## 再テスト（review ラウンド 1 の差し戻し後）

- 変更: `docs/verification.md` の期待値に但し書き（列・行数が変わらないこともある）、設定画面の説明文を隙間切の場合まで広げ、
  隙間のスイッチにも `aria-describedby` を付けた（SettingsDialog.test に説明文の確認を足した）。
- `pnpm -s typecheck` — exit=0 ／ `pnpm -s test` — Test Files 162 passed (162) / Tests 3042 passed (3042)（exit=0）／
  `aidev smoke`（`pnpm -s build` を含む）— pass（2 本）。
- このラウンドでは失敗は発生していない。
