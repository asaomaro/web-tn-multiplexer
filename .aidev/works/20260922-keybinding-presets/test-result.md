# テスト結果: キーバインドのプリセット

## 実行したもの

- `pnpm test`（root。全パッケージの vitest）— 132 files / 2150 tests passed
- `pnpm -s typecheck`（root）— exit 0
- `pnpm -s lint`（root）— exit 0
- `pnpm build`（root）— 成功
- `aidev smoke` — pass（exit 0）
- `pnpm exec playwright test`（packages/e2e、一式）— 結果は下記「E2E（一式）」参照

## 受け入れ基準ごとの判定

- AC1: pass — `KeySettings.test.ts`「プリセットを選ぶ（AC1・AC2・AC-I1・AC-I3）」の1件目
  （`<select>` の options が `["herdr-ctrl-alt","tmux"]`・既定は先頭）で確認。
- AC2: pass — 同 describe の2件目（tmux 風を選んで足すと `bindingsOf` に `prefix+%`・`prefix+left` が
  入る）で確認。E2E `key-bindings.spec.ts`「「tmux 風」プリセットを選んで足すと…」でも、実際に
  `prefix+%` で pane が分割されることをブラウザの描画（`.pane-frame` の数）で確認。
- AC3: pass — `assign.test.ts`「一般化」describe の1件目（`prefix+…` のエントリを冪等に足す）、
  および既存の「もう一度足しても何も変わらない」テスト（一般化後も継続して pass）で確認。
- AC4: pass — `assign.test.ts`「別の操作が使っているキー・prefix と同じキーは足さず」テスト
  （一般化後も継続して pass）、`KeySettings.test.ts`「すでに全部あるうえで…」テストで確認。
- AC5: pass — `presets.test.ts`（`KEY_PRESETS` の2件・全エントリが `parseBinding` を通る）で、
  新しいプリセットが `[ActionId, binding][]` の表 1 つで表現できることを確認。
  加えて design.md に「表を1つ足すだけ」の設計意図を明記（AC5 は設計の性質そのものなので、
  実装がその形を保っていることをコードレビュー〔taskcheck〕でも確認済み）。
- AC6: pass — `assign.test.ts` の既存の `RECOMMENDED_DIRECT` 関連テスト（10 組の一覧・冪等性・衝突判定）
  が一般化後も**変更なしで**全て pass。案内文の文言変更は decisions D3 の解釈どおり許容し、
  `KeySettings.test.ts`・`key-bindings.spec.ts` 側のアサーションを新文言に更新した（回帰ではなく
  意図した変更であることを、変更前の文言に戻すと新テストが落ちることで確認済み——各タスクの
  taskcheck の「タスク点検ログ」参照）。
- AC7: pass — `KeySettings.test.ts`「tmux 風を足したあと［すべて既定に戻す］を押すと…（AC7）」で、
  tmux 風で足した分も含めて `keyPrefs.bindings` が空になることを確認。
- AC-I1: pass — `KeySettings.test.ts`「ダイアログを閉じて開き直しても…（AC-I1）」で確認。
- AC-I2: pass — 設計どおり、確定は［足す］ボタンを押した時点（既存の「おすすめ」ボタンと同じ即時反映
  パターンを維持。新規の確認ダイアログは無いことをコードで確認）。
- AC-I3: pass — `KeySettings.test.ts`「キーボードだけで `<select>` → ［足す］の順に Tab で辿れる」、
  E2E でも `<select>` の `selectOption` → ［足す］の click という素朴な操作列で機能することを確認
  （タブ順を壊す実装〔`tabindex` の誤用等〕が無いことは単体テストの DOM 順チェックで担保）。
- AC-I4: pass — `addPreset` は既存の `addRecommended` と同じ非同期の `endCapture` を経由しない実装
  （明示的な `focus()` 呼び出しをしない＝ブラウザの既定の click 後フォーカス維持に任せる設計をコードで確認）。
- AC-I5: pass — `<select>` に `keydown` ハンドラを持たせていないこと、`.keys-capture` の
  `onCaptureKeydown` とは独立した要素であることをコードで確認（既存の取り込み待ちの動作を検証する
  既存テスト群が一般化後も全て pass していることでも裏付け）。

## 失敗の証跡

このラウンドでは失敗が発生していない（全ての単体テスト・typecheck・lint・smoke・E2E が初回から
pass した。doccheck・taskcheck の各ラウンドで見つかった指摘は `review.md`「タスク点検ログ」参照——
これらは coding 工程内の独立点検で、test 工程の失敗ではない）。

## 起動確認（smoke）

```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45863 (state dir /tmp/wtm-smoke-Xq67Mt)
{"ts":"2026-09-22T06:42:57.574Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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
smoke: pass (exit 0)
```

この work は新しい入口（サブコマンド・オプション）を足していないので、`smokeCommands` の追加は不要
（節「キー」の中の一括操作の一部を一般化しただけで、既存の smoke の経路——ログイン→接続→pane 表示→
入力の往復——には影響しない）。

## 負の確認（test 工程での再検証。規約 `regression-negative-control`）

coding 工程の各タスク点検（T1〜T4・cross）で、実装した本人（委譲したエージェント）による負の確認は
実施済み（`review.md`「タスク点検ログ」参照）。test 工程では、**タスクをまたぐ結合点**を対象に
もう一段の負の確認を実施した。

`packages/web/src/components/KeySettings.vue` の `addPreset` 内、`<select>` の選択値を実際に使う行

```ts
const preset = KEY_PRESETS.find((p) => p.id === selectedPresetId.value) ?? KEY_PRESETS[0]!;
```

を、選択を無視して常に先頭のプリセットを使う実装

```ts
const preset = KEY_PRESETS[0]!;
```

に書き換えて `pnpm exec vitest run src/components/KeySettings.test.ts` を実行したところ、期待どおり
AC2・AC7 を検証する2件が失敗した：

```
 FAIL  src/components/KeySettings.test.ts > KeySettings — プリセットを選ぶ（AC1・AC2・AC-I1・AC-I3） > 「tmux 風」を選んで足すと、tmux 風の割り当てが足され、案内文にプリセット名が出る（AC2）
AssertionError: expected [ 'prefix+v', 'ctrl+alt+d' ] to deeply equal [ 'prefix+v', 'prefix+%' ]

- Expected
+ Received

  [
    "prefix+v",
-   "prefix+%",
+   "ctrl+alt+d",
  ]

 FAIL  src/components/KeySettings.test.ts > KeySettings — プリセットを選ぶ（AC1・AC2・AC-I1・AC-I3） > tmux 風を足したあと［すべて既定に戻す］を押すと、tmux 風の分も含めて全部消える（AC7）
AssertionError: expected [ 'prefix+v', 'ctrl+alt+d' ] to include 'prefix+%'

 Test Files  1 failed (1)
      Tests  2 failed | 49 passed (51)
```

`cp` でバックアップから復元し、`diff` で元ファイルと完全一致することを確認したうえで、
`pnpm exec vitest run src/components/KeySettings.test.ts` を再実行し 51 件全て pass に戻ることを
確認した。`pnpm build` で成果物も元の状態に作り直した。

## 未検証の穴（skip / 環境不足）

- 自動テストは Linux の Chromium だけ（既存の `key-bindings.spec.ts` の方針と同じ）。Firefox・Safari・
  Windows・macOS での `<select>` の操作性は `docs/verification.md` の手動確認項目に回した
  （新規追加：「キーバインドのプリセット（20260922-keybinding-presets）」）。
- tmux の対応表（`PRESET_TMUX`）は tmux 実機での動作確認はしていない（research F10 が tmux 公式
  man page の記述に基づく机上の対応表であり、本製品側の `prefix+%` 等の chord が正しく動くことは
  単体テスト・E2E で確認済みだが、「tmux ユーザーの実際の指の記憶と一致するか」は対象外）。

## E2E（一式）

`pnpm exec playwright test`（`packages/e2e`。workers:1）を 2 回実行した。

**1 回目**（117 本）：116 passed / 1 failed。

```
  1) src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105）

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Object {
        "cols": 53,
    -   "rows": 41,
    +   "rows": 37,
      }

      124 |   expect.soft(client.paneSize(p1)).toEqual(before);

  1 failed
    src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105）
  116 passed (12.7m)
```

失敗した `mobile.spec.ts`（モバイルのピッカーで pane を切り替えたときの PTY サイズ保持。D105）は
この work（キーバインドのプリセット）が触っていない機能で、この work の新規・変更テストは
`key-bindings.spec.ts` の 2 本を含め全て pass していた。切り分けのため、失敗したテストだけを単独で
3 回再実行したところ 3/3 pass した：

```
=== run 1 ===
  ✓  1 src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105） (9.4s)
  1 passed (10.2s)
=== run 2 ===
  ✓  1 src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105） (9.6s)
  1 passed (10.7s)
=== run 3 ===
  ✓  1 src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105） (8.8s)
  1 passed (9.8s)
```

**2 回目**（一式、117 本）：**117 passed（15.2 分）**。D105 のテストも今回は pass した。

```
  ✓  113 src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105） (11.9s)
  ...
  117 passed (15.2m)
```

**結論**：1 回目の失敗は、一式（117 本・実物のサーバ・実物の PTY を毎回起動）を通しで走らせたときの
負荷依存の不安定さ（`rows` が 41 期待に対し 37 に短時間だけ収まっていた——PTY のリサイズが
タイミングによっては一瞬遅れて反映される既存の類の不安定さ）で、この work の変更に起因しない
（この work は `mobile.spec.ts` の対象コード・DOM 構造のいずれにも触れていない）。単独実行・一式の
2 回目実行のいずれでも再現しなかったため、coding 工程への差し戻しは行わない。
