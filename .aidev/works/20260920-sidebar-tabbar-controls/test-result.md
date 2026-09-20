# テスト結果: サイドバーとタブバーに、マウスで使える操作を足す

## 実行したもの

- `pnpm -C packages/protocol test` — **11 passed** / 0 failed / 0 skipped
- `pnpm -C packages/server test` — **476 passed** / 0 failed / 0 skipped
- `pnpm -C packages/web test` — **608 passed** / 0 failed / 0 skipped（この work で 21 件増えた）
- `pnpm -r typecheck` — exit 0
- `pnpm -r build` — exit 0
- `pnpm exec playwright test`（既定・workers=1） — **66 passed / 1 failed** / 0 skipped
  （この work で 4 件増え、既存 2 件の期待を直した）
- `aidev smoke` — pass（exit 0）

合計 **1095 件の単体テストが全て合格**。E2E の 1 件の失敗は**この work と因果の無い既知の不安定なテスト**
（`mobile.spec.ts` の D105。先行 work `20260920-ui-selection-visuals` の decisions.md D2 で
「一式で走らせたときだけ落ちる」ことを確かめ、backlog に起票済み）。

### 測り方についての注意（この work で踏んだ失敗）

**E2E 一式を 3 本同時に走らせて、資源の取り合いで 5〜6 件が落ちた**ことがあった
（1 本 4.2 分のはずが 8.8 分・10.0 分かかっていた）。落ちたのは `workspace-tab-pane` や
`auth-rejection` など、この work と無関係な spec。**他を全部止めてから 1 本だけ走らせ直したら
66 passed / 1 failed に戻った**。上の数字はその clean な実行のもの。

### レビューの指摘を直した後の再実行（最終）

review ラウンド 1 の 2 件（ソートの表示名を日本語へ・「メニュー」に `aria-expanded`）を直して走らせ直した。

- 単体: protocol 11 / server 476 / web 608 — **全て合格**（`aria-expanded` のテストを 1 件足した）
- `pnpm -r typecheck` / `pnpm -r build` / `aidev smoke` — 合格
- E2E: **66 passed / 1 failed**（3.3 分。落ちたのは既知の `mobile.spec.ts` の D105）

**この 3.3 分の実行が、他を一切走らせていない状態で取った唯一の信頼できる数字**。
上で書いたとおり、同時実行したときは 6.5〜10.0 分かかり、無関係な spec が 3〜6 件落ちていた。

## 受け入れ基準ごとの判定

- AC1: pass — 折りたたみボタンが `toggleSidebar` を送る。**畳んだ状態でも押せて戻せる**
  （`Sidebar.test.ts`「折りたたんでも、折りたたみの帯は残り押せる」＋ E2E で実際にトグル）。
- AC2: pass — `aria-expanded` が「サイドバーが開いているか」で切り替わる（単体・E2E とも）。
- AC3: pass — 「新規」で `workspace.create` が送られ、行が 1 つ増える（単体で `run` の引数、E2E で DOM の件数）。
- AC4: pass — 「メニュー」が `{ kind: "global" }` のメニューを開き、項目は「キー割り当て」「移動」「切り離し」
  （`ContextMenu.test.ts` で文言・順序・渡る action を確認）。
- AC5: pass — E2E でキーボードだけで開閉し、元のボタンへフォーカスが戻ることを確認。
  操作の実装は既存の `ContextMenu.vue` をそのまま使っている。
- AC6: pass — ＋ が `newTabInWorkspace` を呼ぶ。**タブが 0 件でも押せる**（単体）。E2E で名前入力が開く。
- AC7: pass — ソートのボタンの表示が現在値で、押すと切り替わる（`Sidebar.test.ts`。
  **当初このテストが無く、独立点検の must で気づいて足した**）。
- AC8: pass — 優先度の降順、同点は `since` の新しい順（単体の 2 ケース）。
- AC9: pass — `grouped` では挿入順のまま（単体）。
- AC10: pass — `localStorage`（`wtm.prefs.v1`）。(a) E2E で `page.reload()` 後も `priority`、
  (b) 単体で新しいストアが読み戻す。壊れた値・例外環境も単体で確認。
- AC11: pass — 折りたたむと 2 つの帯が消え、折りたたみの帯だけ残る（単体で帯ごとに確認）。
  E2E で折りたたみ時に `.sidebar` が横へ溢れないことも確認。
- AC12: pass — キーの経路（`keymap` → `KeyRouter` → `run`）に触れていない。既存 E2E の通過で確認。
- AC13: pass — 既存の単体テストは全て通る。既存 E2E は**Tab の到達順の期待 2 件だけ**直した
  （理由は AC6・AC-I3。＋ を Tab で使えるようにした結果。decisions.md D2）。
- AC14: pass — E2E で ＋ を隠したときと表示したときの帯の高さが一致。
  **この判定は 2 度書き直している**（下記「失敗の証跡」2）。
- AC-I1 / AC-I2: pass — 開閉と取り消しは既存の `ContextMenu.vue` の挙動。単体（Esc で何も実行しない）と E2E で確認。
- AC-I3: pass — E2E で**Tab を押して到達順を記録**し、足した 4 つのボタンが DOM の順
  （新規 → メニュー → ソート → 折りたたみ）で出ることを確認。折りたたみ時の順も別途確認。
- AC-I4: pass — メニューを閉じると開いたボタンへ戻る（E2E）。
- AC-I5: pass — ボタンに `@keydown.stop` を付け、端末へキーを漏らさない。既存 E2E の通過で確認。

## 失敗の証跡

### 1. ＋ が Tab の到達順を変え、既存 E2E 2 件が落ちた（想定どおり）

`decisions.md` D2 のとおり、＋ を Tab で使えるようにすると順が変わる。**直す前に落ちることを確かめた**:

```
  ✘   7 src/specs/keys-mouse-dialogs.spec.ts:226:1 › pane の枠はキーボードでも開ける：tab バーから Tab で枠に止まり、Enter でメニューを開き、Esc で枠へ戻る（M7 の後半・D110） (6.3s)
  ✘   8 src/specs/keys-mouse-dialogs.spec.ts:267:1 › 分割した 2 つ目の pane も、prefix のキーで選んでから、tab バーから Tab でその枠へ移り、キーボードだけでそのメニューを使える（M7 の後半・D110） (2.1s)
    Error: expect(locator).toBeFocused() failed
    Error: expect(received).toEqual(expected) // deep equality
  2 failed
  9 passed (33.4s)
```

そのうえで `describeFocus` に ＋ の分岐を足し、期待を `["newTab", "splitter", "frame@pane2"]` に直した
（**期待を緩めたのではなく、増えた 1 段を明示した**）。

### 2. AC14 の最初のテストが「何も確かめていなかった」（decisions.md D4）

当初は「`.tab-bar` の高さ === `.tab-bar-item` の高さ ＋ 下線」で見ていた。実装後に通ったので
採用しかけたが、条項どおり壊して確かめたところ **`.tab-bar-new` の `padding` を `0.5em` → `0.9em` に
しても通った**:

```
  1 passed (2.6s)
```

原因は flex の既定（`align-items: stretch`）で、**タブも ＋ も同じ行の高さへ引き伸ばされる**こと。
等式は ＋ が何 px でも成り立つ。実測すると padding 0.9em のときタブ・＋ とも 44.78px、帯 45.78px で、
等式は確かに成立していた。

**「＋ を `display:none` にしたときと比べる」に書き直したところ、同じ壊し方で落ちるようになった**:

```
    Error: ＋ の有無で帯の高さが変わらない（あり 45.78125 / なし 33）
  1 failed
```

### 3. 新しい E2E・単体テストが「振る舞いを壊すと落ちる」ことの確認

新しい機能のテストは、実装前に走らせても「要素が無い」で落ちるだけで、
**押した結果が正しいかは何も確かめていない**。そこで実装後に振る舞いだけを壊して確かめた
（「新規」の `@click` を空に、ソートの比較関数を `() => 0` に）:

```
  ✘  2 src/specs/workspace-tab-pane.spec.ts:430:1 › サイドバーとタブバーのボタンが、キー操作と同じ結果になる（AC1・AC3・AC6・AC12） (9.5s)
    Error: timed out waiting for event "workspace.created"
  1 failed
  1 passed (12.3s)
```

```
     × 「新規」はキーの prefix+shift+N と同じ action を送る（AC3） 6ms
     × priority では状態の優先度の降順に並ぶ（AC8） 13ms
     × priority で優先度が同じなら、状態が最近変わったものが上（AC8） 5ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
```

壊した実装は `cmp` で元に戻したことを確認済み。

## 起動確認（smoke）

```
smoke: 20260920-sidebar-tabbar-controls
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46319 (state dir /tmp/wtm-smoke-ez2TyK)
{"ts":"2026-09-20T08:17:15.424Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

## 未検証の穴（skip / 環境不足）

- **skip は 0 件**（単体・E2E とも）。
- **`mobile.spec.ts` の D105 が一式のときだけ落ちる**（先行 work の decisions.md D2）。
  この work もモバイルに届かない（`MobileShell.vue` は `Sidebar.vue` も `TabBar.vue` も import していない）ので
  因果は無い。backlog に起票済み。
- **見た目そのものは未検証**。ボタンの配置・余白・色の印象は、E2E では計算後のスタイルと寸法しか
  確かめていない。実機での確認は利用者に委ねる。
- **`.sidebar-section-footer`（新規・メニュー）は行が多いと画面外へ流れる**（横断の点検が指摘）。
  折りたたみの帯だけは `margin-top: auto` で常に見える。backlog へ送る。
- **Windows / macOS での E2E は未実行**（この一式はもともと Linux・chromium 前提）。
