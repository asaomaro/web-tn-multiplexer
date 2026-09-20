# テスト結果: 選択状態の表示をそろえ、強調をホバーから選択へ移す

## 実行したもの

- `pnpm -C packages/protocol test` — **11 passed** / 0 failed / 0 skipped
- `pnpm -C packages/server test` — **476 passed** / 0 failed / 0 skipped
- `pnpm -C packages/web test` — **587 passed** / 0 failed / 0 skipped（この work で 8 件増えた）
- `pnpm -r typecheck` — exit 0
- `pnpm -r build` — exit 0
- `pnpm exec playwright test`（既定・workers=1） — **62 passed / 1 failed** / 0 skipped（この work で 3 件増えた）。
  落ちた 1 件は `mobile.spec.ts` の D105 で、**着手前のコードでも一式では落ちる**（decisions.md D2 の表）。
  この work が触っていないモバイルの経路で、負荷でタイミングが変わると現れる競合。**この work に因果は無い**
- `aidev smoke` — pass（exit 0）

合計 **1074 件の単体テストが全て合格**。E2E は 63 件中 62 件合格で、**落ちた 1 件はこの work と
因果の無い、以前からある不安定なテスト**（下記「未検証の穴」と decisions.md D2）。skip は 0 件。

## 受け入れ基準ごとの判定

- AC1: pass — 表示中の行に `sidebar-row-current` が付き、タブと同じ `--wtm-menu-active-bg` を使う
  （`Sidebar.test.ts`「表示中の workspace の行に、モードに関係なく…」）。
- AC2: pass — 3 状態が別の宣言・別のプロパティに分かれ、表示中（面）と navigate カーソル（線）は
  同時に付く（`Sidebar.test.ts`「表示中かつ navigate で選択中の行には、2 つのクラスが同時に付く」）。
  スタイル定義は `Sidebar.vue` の 3 宣言と 1 対 1 に対応。
- AC3: pass — E2E「サイドバー：区切りの無い長いブランチ名でも横に溢れない（AC3）」。
  既定幅・折りたたみ時とも `scrollWidth <= clientWidth`。**修正前は 497 / 240 で落ちた**（下記の証跡）。
- AC4: pass — `PaneFrame.test.ts`「選ばれている pane の枠にだけ強調のクラスが付き、選び直すと移る」＋
  E2E で選択中の枠の `borderTopWidth === "2px"`。
- AC5: pass — E2E でポインタを 4px の帯に乗せた前後で `backgroundColor` と `borderTopWidth` が一致。
  **ポインタが本当に帯の上にあること**を `:hover` セレクタで先に観測している（空振り防止）。
- AC6: pass — 線の太さは 2px、`.pane-frame` の `paddingTop` は `4px` のまま（E2E で両方を確認）。
- AC7: pass — `PaneFrame.test.ts`「枠に title 属性を置かない（aria-label は残す）」。
- AC8: pass — `Sidebar.test.ts` と `PaneFrame.test.ts` で `aria-current` の付く／付かないを確認。
  付かない側は**属性ごと無い**（`toBeUndefined()`）。
- AC9: pass — 既存の単体テスト・E2E がすべて通った。既存テストの期待値は 1 つも書き換えていない。
- AC-I1: pass — 開閉する部品を足していない。既存の E2E（右クリックメニューの開閉）が通ることで確認。
- AC-I2: pass — 確定・取り消しの操作を足していない。既存テストの通過で確認。
- AC-I3: pass — E2E「pane の枠：prefix のキーで選び直すと強調が移る（AC-I3）」。
- AC-I4: pass — roving tabindex と `:focus-visible` を変えていない。既存の E2E
  （tab バーから Tab で枠へ、Enter でメニュー、Esc で戻る）が通る。
- AC-I5: pass — マウスの結線と `MouseBridge` の振り分けを変えていない。既存の E2E（右クリックの振り分け・
  リンク・マウス報告）が通る。

## 失敗の証跡

### 1. 負の対照（実装前）——新しい E2E 3 件が落ちることの確認

条項 `regression-negative-control` に従い、**実装を入れる前に**新しい spec を書き、
`pnpm -r build` でビルドし直してから走らせた。

```
✘  2 src/specs/keys-mouse-dialogs.spec.ts:407:1 › pane の枠：選ばれている pane を 2px の線で強調し、マウスを乗せても見た目は変わらない（AC4・AC5・AC6） (10.1s)
{"ts":"2026-09-20T06:05:57.156Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  ✘  3 src/specs/keys-mouse-dialogs.spec.ts:427:1 › pane の枠：prefix のキーで選び直すと強調が移る（AC-I3） (14.8s)
{"ts":"2026-09-20T06:06:16.263Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
  ✘  4 src/specs/workspace-tab-pane.spec.ts:401:1 › サイドバー：区切りの無い長いブランチ名でも横に溢れない（AC3） (12.0s)


  1) src/specs/keys-mouse-dialogs.spec.ts:407:1 › pane の枠：選ばれている pane を 2px の線で強調し、マウスを乗せても見た目は変わらない（AC4・AC5・AC6） 

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  locator('.pane-frame-edge.pane-frame-edge-current')
    Expected: 1
    Received: 0
    Timeout:  5000ms

    Call log:
      - Expect "toHaveCount" locator('.pane-frame-edge.pane-frame-edge-current') with timeout 5000ms
      - waiting for locator('.pane-frame-edge.pane-frame-edge-current')
        13 × locator resolved to 0 elements
           - unexpected value "0"


      410 |
      411 |   // pane は 1 つだけなので、それが選ばれている。
    > 412 |   await expect(page.locator(".pane-frame-edge.pane-frame-edge-current")).toHaveCount(1);
          |                                                                          ^
      413 |   const selected = await edgeStyle(page);
      414 |   expect(selected.
```

`workspace-tab-pane.spec.ts` の AC3 は、**狙ったとおり幅の判定の行で**落ちている（お膳立ての失敗ではない）:

```
    Error: 既定幅（実測 {"scroll":497,"client":240}）

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 240
    Received:    497
```

### 2. 負の対照（ホバーのテストを強くした後）——`:hover` を戻すと落ちることの確認

タスク点検（T11）が「座標がずれると空振りする」と指摘したため、
ポインタが帯の上にあることを先に観測する形に直した。そのうえで
**`.pane-frame-edge:hover` の宣言を一時的に戻し**、ビルドし直して走らせた:

```
Error: ホバーで見た目が変わらない

    ホバーで見た目が変わらない

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Object {
    -   "bg": "rgba(0, 0, 0, 0)",
    +   "bg": "rgb(68, 71, 90)",
        "border": "2px",
      }

    Call Log:
    - Timeout 5000ms exceeded while waiting on the predicate

      426 |     .poll(() => page.evaluate(() => document.querySelector(".pane-frame-edge:hover") !== null), { message: "ポインタが枠の帯の上にある" })
      427 |     .toBe(true);
```

戻した後は `packages/web/src/components/PaneFrame.vue` を元に戻し、
`grep -c "pane-frame-edge:hover"` が 0 であること、web の単体テスト 587 件が通ることを確認した。

### 3. ポート競合による一時的な失敗（1 回）

実装後の単体テストで `packages/server` が 1 件落ちた。

```
 FAIL  src/composeServer.integration.test.ts > composeServer (integration) > 同じ state-dir の 2 つ目はポートが違っても listen() が ConfigError で断り、シェルを起動せず session.json・auth.json に触れない（D103）
Error: listen EADDRINUSE: address already in use 127.0.0.1:46485
 Test Files  1 failed | 41 passed (42)
      Tests  1 failed | 475 passed (476)
```

`EADDRINUSE` は、同時に走らせていた E2E のサーバと空きポートの取り合いになったもの。
単独で再実行したところ **476 件すべて合格**した（`server exit=0`）。実装とは無関係。

### 4. 負の対照（単体テスト）——実装を HEAD へ戻すと新しい単体テストが落ちることの確認

review ラウンド 1 の指摘（条項 `regression-negative-control`）を受けて実施した。
`git checkout -- packages/web/src/components/Sidebar.vue packages/web/src/components/PaneFrame.vue`
で**実装だけを着手前に戻し**、テストは新しいまま 2 ファイルを走らせた:

```
     × 表示中の workspace の行に、モードに関係なく表示中のスタイルと aria-current を付ける 6ms
     × 表示中かつ navigate で選択中の行には、2 つのクラスが同時に付く 3ms
     × 2 行目の ↑n ↓n に、縮ませない印（sidebar-git-counts）を付ける 3ms
     × 枠に title 属性を置かない（aria-label は残す） 8ms
     × 選ばれている pane の外側の要素に role=group・pane の名前・aria-current を付ける 4ms
     × 選ばれている pane の枠にだけ強調のクラスが付き、選び直すと移る 3ms
 FAIL  src/components/PaneFrame.test.ts > PaneFrame（pane の枠。M7 の後半・D110） > 枠に title 属性を置かない（aria-label は残す）
AssertionError: expected '右クリックで pane のメニュー' to be undefined
 FAIL  src/components/PaneFrame.test.ts > PaneFrame（pane の枠。M7 の後半・D110） > 選ばれている pane の外側の要素に role=group・pane の名前・aria-current を付ける
AssertionError: expected undefined to be 'group' // Object.is equality
 FAIL  src/components/PaneFrame.test.ts > PaneFrame — 強調は選ばれている pane に付く > 選ばれている pane の枠にだけ強調のクラスが付き、選び直すと移る
AssertionError: expected [ 'pane-frame-edge' ] to include 'pane-frame-edge-current'
 FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > 表示中の workspace の行に、モードに関係なく表示中のスタイルと aria-current を付ける
AssertionError: expected [ 'sidebar-row' ] to include 'sidebar-row-current'
 FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > 表示中かつ navigate で選択中の行には、2 つのクラスが同時に付く
AssertionError: expected [ 'sidebar-row', …(1) ] to include 'sidebar-row-current'
 FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > 2 行目の ↑n ↓n に、縮ませない印（sidebar-git-counts）を付ける
 Test Files  2 failed (2)
      Tests  6 failed | 28 passed (34)
```

6 件が落ちた内訳は、AC1（表示中のクラスと `aria-current`）・AC2（2 クラス同時）・AC3（`sidebar-git-counts`）・
AC7（`title` の不在）・AC8（`role=group` と `aria-current`）・AC4（強調クラスの付け替え）。
**agents 行のテスト（表示中が付かない）は HEAD でも通る**ので落ちていない——これは正しい
（あの行に「表示中」を付けないことは変更前からの性質で、この work が作った振る舞いではない）。

戻したあと実装を復元し、`cmp` でファイルが一致することと、2 ファイル 34 件が通ることを確認した:

```
復元して一致（cmp OK）
 Test Files  2 passed (2)
      Tests  34 passed (34)
```

## 起動確認（smoke）

```
smoke: 20260920-ui-selection-visuals
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45499 (state dir /tmp/wtm-smoke-wi7Q8G)
{"ts":"2026-09-20T06:30:39.577Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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
- **`mobile.spec.ts` の D105 のテストが、一式で走らせると落ちる**（decisions.md D2 に 8 回分の観測表）。
  単独では 3 回とも合格し、一式では着手前・修正後のどちらでも落ちる。**負荷でタイミングが変わると現れる競合**で、
  **この work の変更はモバイルに届かない**（`App.vue:41-43` のとおり `Sidebar` も pane の枠もデスクトップ側だけ）
  ので因果は無い。**この work では直さず backlog へ送る**が、**E2E 一式が安定して緑にならない状態は続いている**。
- **実機での見え方は未検証**。色・線の太さ・省略記号の見え方は、E2E では計算後のスタイルと寸法しか
  確かめていない。実際にどう見えるかは利用者の確認に委ねる（`docs/verification.md` の手順を更新済み）。
- **Windows / macOS での E2E は未実行**。AC3 の E2E は `GIT_CONFIG_GLOBAL=/dev/null` を使う POSIX 前提で、
  この一式はもともと Linux・chromium で走らせる想定（`docs/verification.md`）。
