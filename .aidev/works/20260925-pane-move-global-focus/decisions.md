# 決定記録

## D0: `closeEmptyTabShell` の広い潜在的不具合はこの work では扱わない

- 背景: design 段階の調査で、`closeEmptyTabShell`（`SessionModel.ts:582-602`）の「救済」
  ロジック（対象 workspace の `activeTabId` が変わったら無条件に `this.focus` を書き換える）
  が、`this.focus` が実際にその workspace/tab を指していたかどうかに関わらず発火することが
  分かった。無関係な workspace の `this.focus` まで巻き込んで上書きしうる、より広い既存の
  潜在的な不具合（requirements.md「スコープ / 対象外」・design.md「対象外の扱いの記録」参照）。
- 決定: この work では `moveToTab`・`moveToNewTab` の `setFocus` 呼び出しを
  `closeEmptyTabShell` の後に置くことで、この work の対象である5操作の移動先が上書きされない
  ことだけを保証する。`closeEmptyTabShell` の救済ロジック自体（「そもそも救済が本当に必要な
  ときだけ発火すべきか」という設計判断）は直さない。
- 理由 / 代替案: 救済ロジック自体を直す（`this.focus` が実際に対象 workspace/tab を指して
  いたときだけ発火するよう条件を追加する）ことも検討したが、この work のスコープ
  （5操作の移動先を守ること）を超えて `closeEmptyTabShell` の意味論自体を変えることになり、
  影響範囲の見積もりに別の調査が要る。
- 影響: `.aidev/backlog/product-roadmap.md` に新しい backlog 項目として記録する
  （deliver 工程で追加）。

## D1: T1（`swapPaneWith`・`moveToEdge`）の負の確認

- 背景・決定: T1 で追加した2つの `this.setFocus(tab.workspaceId, tab.id, paneId)` 呼び出しを
  一時的に取り除き、新規テスト（AC1・AC2）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`setFocus` 呼び出しを2箇所とも一時的に取り除いた場合）

```
FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > swapPaneWith > 成功すると、グローバル focus が入れ替えを要求した pane（paneId）を指す（AC1）
AssertionError: expected { Object (workspaceId, tabId, ...) } to deeply equal { Object (workspaceId, tabId, ...) }

- Expected
+ Received

  {
-   "paneId": "p2",
+   "paneId": "p1",
    "tabId": "t1",
    "workspaceId": "w1",
  }

 ❯ src/session/SessionModel.test.ts:210:32

FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > moveToEdge > 成功すると、グローバル focus が動かした pane（paneId）を指す（AC2）
AssertionError: expected { Object (workspaceId, tabId, ...) } to deeply equal { Object (workspaceId, tabId, ...) }

- Expected
+ Received

  {
-   "paneId": "p2",
+   "paneId": "p1",
    "tabId": "t1",
    "workspaceId": "w1",
  }

 ❯ src/session/SessionModel.test.ts:312:32

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed | 80 skipped (83)
```

両テストとも、事前に `focusPane` で意図的に別の pane（`otherPaneId`/`targetPaneId` 側）へ
focus を移しておいたため、「元々 `paneId` が focus だった」ケースと区別できる形で失敗した
（`this.focus.paneId` が `p1`（直前に focus した側）のまま変わらなかった）。復元すると
`SessionModel.test.ts` 全83件が pass することを確認した。

## D2: T2（`replacePane`）の負の確認

- 背景・決定: T2 で無条件呼び出しに置き換えた `this.setFocus(tab.workspaceId, tab.id,
  paneId)` を、元の条件付き呼び出し（`if (nextFocused !== tab.focusedPaneId)
  this.setFocus(tab.workspaceId, tab.id, nextFocused)`）に一時的に戻し、新規テスト
  （AC3。「ドロップ先が tab のローカル focus 中でなくても」）が実際に落ちることを確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（無条件呼び出しを元の条件付き呼び出しに一時的に戻した場合）

```
FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > replacePane > ドロップ先が tab のローカル focus 中でなくても、グローバル focus は生き残った pane（paneId）を指す（AC3）
AssertionError: expected { Object (workspaceId, tabId, ...) } to deeply equal { Object (workspaceId, tabId, ...) }

- Expected
+ Received

  {
-   "paneId": "p1",
+   "paneId": "p3",
    "tabId": "t1",
    "workspaceId": "w1",
  }

 ❯ src/session/SessionModel.test.ts:432:32

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed | 83 skipped (85)
```

新設した2件のうち「ドロップ先が focus 中だった」ケースは、この一時的な変更でも pass した
（既存の条件付きロジックが元々このケースを扱っていたため——設計どおり）。「ドロップ先が
tab のローカル focus 中でなくても」のケースだけが失敗し、無条件化の効果を正しく検知した。
復元すると `SessionModel.test.ts` 全85件が pass することを確認した。

## D3: T3（`moveToTab`・`moveToNewTab`）の負の確認

- 背景・決定: T3 の2つの変更——(1) `moveToTab` の末尾に追加した
  `this.setFocus(targetTab.workspaceId, targetTabId, paneId)`、(2) `moveToNewTab` の
  既存の `setFocus` 呼び出しを `closeEmptyTabShell` の前から後ろへ移動したこと——を
  それぞれ一時的に取り除き（`moveToTab` は呼び出しを削除、`moveToNewTab` は呼び出しを
  `closeEmptyTabShell` の前の元の位置に戻す）、新規テスト（AC4・AC5）が実際に落ちることを
  確認した。
- 影響: コードへの影響なし（確認のみ）。

### 負の確認の生ログ（`moveToTab` から `setFocus` を削除し、`moveToNewTab` の `setFocus` を
`closeEmptyTabShell` の前へ戻した場合）

```
FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > moveToTab > 成功すると、グローバル focus が移動先の tab・pane を指す（AC4）
AssertionError: expected { Object (workspaceId, tabId, ...) } to deeply equal { Object (workspaceId, tabId, ...) }
- Expected: { "paneId": "p1", "tabId": "t2", "workspaceId": "w1" }
+ Received: { "paneId": "p2", "tabId": "t2", "workspaceId": "w1" }
 ❯ src/session/SessionModel.test.ts:527:32

FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > moveToTab > 移動元 tab が移動元 workspace の active tab のまま空になり自動的に閉じても、グローバル focus は移動先を指す（AC4）
AssertionError: expected { Object (workspaceId, tabId, ...) } to deeply equal { Object (workspaceId, tabId, ...) }
- Expected: { "paneId": "p1", "tabId": "t3", "workspaceId": "w2" }
+ Received: { "paneId": "p2", "tabId": "t2", "workspaceId": "w1" }
 ❯ src/session/SessionModel.test.ts:546:32

FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > moveToNewTab > 移動元 tab が移動元 workspace の active tab のまま空になり自動的に閉じても、グローバル focus は移動先を指す（AC5）
AssertionError: expected { Object (workspaceId, tabId, ...) } to deeply equal { Object (workspaceId, tabId, ...) }
- Expected: { "paneId": "p1", "tabId": "t4", "workspaceId": "w2" }
+ Received: { "paneId": "p2", "tabId": "t2", "workspaceId": "w1" }
 ❯ src/session/SessionModel.test.ts:659:32

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed | 86 skipped (90)
```

3件とも、`this.focus` が移動元 workspace（`w1`）の別 tab（`t2`。`closeEmptyTabShell` の
「救済」が選んだ新しい active tab）とその `focusedPaneId`（`p2`）を指したまま、移動先
（`w2`）を指さないという、design「依拠する既存の事実」の実機確認と完全に一致する形で
失敗した。`moveToNewTab` の単純な成功ケース（AC5、closeEmptyTabShell が発火しない場合）は
このロールバックでも pass した（`setFocus` 自体は残っており、単に元の——バグのある——順序に
戻しただけのため）。復元すると `SessionModel.test.ts` 全90件が pass することを確認した。
