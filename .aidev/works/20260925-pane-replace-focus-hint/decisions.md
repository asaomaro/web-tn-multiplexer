# 決定記録

## D1: T2（`SessionModel.replacePane`）の負の確認

- 背景・決定: T2 で `replacePane` の戻り値に追加した `successorPaneId: paneId` を一時的に
  取り除き、新規テスト（AC2）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`successorPaneId: paneId` を一時的に取り除いた場合）

```
FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > replacePane > 戻り値の successorPaneId は生存した pane（ドラッグした pane）を指す（AC2）
AssertionError: expected undefined to be 'p1' // Object.is equality

- Expected: "p1"
+ Received: undefined

 ❯ src/session/SessionModel.test.ts:365:39

 Test Files  1 failed (1)
      Tests  1 failed | 93 skipped (94)
```

復元すると `SessionModel.test.ts` 全94件が pass することを確認した（既存の `replacePane`
テストを含む——回帰なし）。

## D2: T4（`viewRepair.ts`）の負の確認——D5 の再現バグをそのまま検知した

- 背景・決定: T4 で追加した `successorHint` 優先の判定ブロックを一時的に取り除き（既存の
  `focusedPaneId = cur.focusedPaneId && live.includes(cur.focusedPaneId) ? cur.focusedPaneId
  : live[0]!;` に戻し）、新規テスト（AC4。`.aidev/works/20260924-pane-dnd-split-move/
  decisions.md` D5 の再現ケース）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`successorHint` 優先の判定ブロックを一時的に取り除いた場合）

```
FAIL  src/store/viewRepair.test.ts > repairView（D97） > successorHint が生きていれば、DFS-first-leaf より優先して採用する（AC4。D5 の再現）
AssertionError: expected 'p_other' to be 'p_hint' // Object.is equality

Expected: "p_hint"
Received: "p_other"

 ❯ src/store/viewRepair.test.ts:99:35

 Test Files  1 failed (1)
      Tests  1 failed | 12 skipped (13)
```

この失敗（`p_other` が選ばれ `p_hint` にならない）は、`.aidev/works/20260924-pane-dnd-split-move/
decisions.md` D5 が記録した実害シナリオ（DFS順だと `p2` が選ばれてしまう）そのものであり、
このテストが実際に D5 の不具合を捕まえられることを裏付ける。復元すると
`viewRepair.test.ts` 全13件が pass することを確認した（既存のフォールバックテストを
含む——回帰なし）。

## D3: T3（`SessionService.replacePane`）の負の確認

- 背景・決定: T3 で `replacePane` の `pane.closed` 発行に追加した
  `successorPaneId: result.successorPaneId` を一時的に取り除き（元の
  `data: { paneId: pid }` に戻し）、新規テスト（AC2 の配線確認）が実際に落ちることを
  確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`replacePane` の `pane.closed` 発行から `successorPaneId` を一時的に
取り除いた場合）

```
FAIL  src/session/SessionService.test.ts > SessionService — tabs and panes > replacePane: 発行する pane.closed の successorPaneId は生存した pane（ドラッグした pane）を指す（AC2）
AssertionError: expected [ { paneId: 'p2' } ] to deeply equal [ { paneId: 'p2', …(1) } ]

- Expected
+ Received

  [
    {
      "paneId": "p2",
-     "successorPaneId": "p1",
    },
  ]

 ❯ src/session/SessionService.test.ts:336:28

 Test Files  1 failed (1)
      Tests  1 failed | 95 skipped (96)
```

復元すると `SessionService.test.ts` 全96件が pass することを確認した（既存の `closePane`/
`closeTab`/`closeWorkspace`/`replacePane` のイベント列検証テストを含む——回帰なし）。

## D4: T5（`StoreAdapter.applyEvent`）の負の確認——エンドツーエンドで D5 を再現した

- 背景・決定: T5 で `applyEvent` に追加した `pane.closed` からのヒント抽出・受け渡しを
  一時的に取り除き（元の `this.applyViewRepair();`（引数無し）に戻し）、新規テスト
  （AC6）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`applyEvent` のヒント抽出・受け渡しを一時的に取り除いた場合）

```
FAIL  src/store/StoreAdapter.test.ts > StoreAdapter > pane.closed の successorPaneId があれば、DFS-first-leaf より優先してそちらへ焦点を移す（AC6）
AssertionError: expected 'p_other' to be 'p_hint' // Object.is equality

Expected: "p_hint"
Received: "p_other"

 ❯ src/store/StoreAdapter.test.ts:208:32

 Test Files  1 failed (1)
      Tests  1 failed | 28 skipped (29)
```

T1（protocol）・T2（`SessionModel`）・T3（`SessionService`）・T4（`viewRepair`）がそれぞれ
独立に正しくても、このエンドツーエンドの配線（T5）が欠けていれば
`.aidev/works/20260924-pane-dnd-split-move/decisions.md` D5 の実害がそのまま再現すること
を、この負の確認が裏付けている。復元すると `StoreAdapter.test.ts` 全29件が pass することを
確認した（既存の D97 関連テストを含む——回帰なし）。

## D5: T5 taskcheck round1 の should 指摘への対応——ヒントの「使い捨て」性質の負の確認

- 背景・決定: taskcheck T5 round1 が、`successorHint` が「使い捨て」（次の無関係な
  `pane.closed` に引き継がれない）であることを直接確認するテストが無いと指摘した。
  新規テスト（「successorHint は使い捨て——次の無関係な pane.closed には引き継がれない」）を
  追加し、`applyEvent` にヒントを一時的にインスタンスフィールドへ保持させる（使い捨てでは
  なくする）変異を加えて、実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`applyEvent` にヒントをインスタンスフィールドへ保持させ、次のイベントへ
誤って使い回す変異を加えた場合）

```
FAIL  src/store/StoreAdapter.test.ts > StoreAdapter > successorHint は使い捨て——次の無関係な pane.closed には引き継がれない（design「設計方針」）
AssertionError: expected 'p_hint' to be 'p_other' // Object.is equality

Expected: "p_other"
Received: "p_hint"

 ❯ src/store/StoreAdapter.test.ts:234:32

 Test Files  1 failed (1)
      Tests  1 failed | 29 skipped (30)
```

1回目のイベントのヒント（`p_hint`）が、無関係な2回目のイベント（ヒント無し）でも誤って
再利用され、本来 DFS-first-leaf で選ばれるべき `p_other` の代わりに `p_hint` が選ばれて
しまうことを確認した。復元すると `StoreAdapter.test.ts` 全30件が pass することを確認した。

## D6: T3 taskcheck round1 の must/should 指摘への対応——`publishPaneClosed` の統一と、
   3箇所（`closePane`/`closeTab`/`closeWorkspace`）のキー不在テストの負の確認

- 背景・決定: taskcheck T3 round1 が2件の must（`exactOptionalPropertyTypes` の下での型
  エラー・`closePane` の新規テストが `toEqual({ successorPaneId: undefined })` で無効な
  回帰テストだったこと）と1件の should（`closeTab`/`closeWorkspace` に同種のテストが
  無いこと）を指摘した。`SessionService` に private ヘルパー `publishPaneClosed(paneId,
  successorPaneId)` を新設し（`successorPaneId === undefined` のときキー自体を含めない）、
  4箇所全てをこのヘルパー経由に統一した。`closePane`/`closeTab`/`closeWorkspace` の3箇所に
  `Object.hasOwn` でキーの不在を確認するテストを追加・修正した。
- 負の確認: `publishPaneClosed` を一時的に「`successorPaneId` が `undefined` でも常にキーを
  含める（ダミー値で埋める）」形に変異させ、3件の新規テストが実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`publishPaneClosed` を「常にキーを含める」形に一時的に変異させた場合）

```
FAIL  src/session/SessionService.test.ts > SessionService — tabs and panes > closePane: 発行する pane.closed に successorPaneId のキー自体が含まれない（回帰。AC3）
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ src/session/SessionService.test.ts:353:66

FAIL  src/session/SessionService.test.ts > SessionService — tabs and panes > closeTab: 発行する pane.closed に successorPaneId のキー自体が含まれない（回帰。AC3）
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ src/session/SessionService.test.ts:368:87

FAIL  src/session/SessionService.test.ts > SessionService — tabs and panes > closeWorkspace: 発行する pane.closed に successorPaneId のキー自体が含まれない（回帰。AC3）
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ src/session/SessionService.test.ts:382:87

 Test Files  1 failed (1)
      Tests  3 failed | 95 skipped (98)
```

復元すると `SessionService.test.ts` 全98件が pass し、`npx tsc --noEmit -p
tsconfig.typecheck.json` も exit 0 になることを確認した。
