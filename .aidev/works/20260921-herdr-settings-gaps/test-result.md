# テスト結果: このブラウザの設定を増やす（サイドバーの幅・状態の記号・scrollback）

## 実行したもの

**ラウンド 2**（review ラウンド1 の指摘を T13 で直した後。最終の数字）

- `pnpm build` — exit 0
- `vitest run --root packages/protocol` — 18 passed ／ `packages/server` — 507 passed ／ `packages/web` — **927 passed**（0 failed / 0 skipped）
- `pnpm -C packages/e2e test -- <影響を受ける 6 本>` — **42 passed**（3.1m）
- `pnpm -C packages/{protocol,server,web,e2e} typecheck` — 4 つとも exit 0 ／ `pnpm lint` — exit 0 ／ `aidev smoke` — pass
- **deliver の直前の E2E 一式**（`pnpm -C packages/e2e test`。review ラウンド2 の nit を直した後）— **88 passed**（7.0m。**1 回で全部通った**。
  この work で 11 本足したので 77 → 88）

### ラウンド 1（review の前）

**`pnpm build` を通してから E2E を走らせた**（`packages/e2e` の test は再ビルドせず dist を読む）。

- `pnpm build` — exit 0
- `vitest run --root packages/protocol` — 18 passed / 0 failed / 0 skipped
- `vitest run --root packages/server` — 507 passed / 0 failed / 0 skipped
- `vitest run --root packages/web` — **925 passed** / 0 failed / 0 skipped（この work で +44 件。881 → 925）
- `pnpm -C packages/e2e test -- <この work の影響を受ける 6 本>` — **42 passed**（3.2m）。
  新しい `settings.spec.ts`（10 本）・`notifications.spec.ts`（設定ダイアログのセレクタ）・`agent-detection.spec.ts`
  （`.sidebar-state-icon[data-state]`。design D2 の「セレクタは変わらない」を守る唯一の E2E）・`workspace-tab-pane.spec.ts`
  （サイドバーの幅と折りたたみ）・`terminal-app.spec.ts`（サイドバーのセレクタ）・`mobile.spec.ts`（モバイルのピッカーと上のバー）
- `pnpm -C packages/{protocol,server,web,e2e} typecheck` — 4 つとも exit 0
- `pnpm lint` — exit 0
- `aidev smoke` — pass（exit 0）

**E2E の一式は deliver の直前に 1 回回す**（利用者の指示「少しの修正ですべて回すのは時間とみあいません」。decisions D4）。
結果は上の「ラウンド 2」の最後の行。

## 受け入れ基準ごとの判定

- AC1: pass — 単体（`view.test.ts`・`Sidebar.test.ts` の保存の経路ごと）＋ E2E（ドラッグで 300px → `storageState` を持ち越した新しい context で 300px）
- AC2: pass — 単体＋ E2E（`prefix+b` で畳む → 持ち越した新しい context で `.sidebar-collapsed`）
- AC3: pass — 単体（4 つの `load*` の総当たり・ストアの壊れた値）＋ E2E（壊れた JSON と範囲外の値で既定。**仕込みがページに届いたことを前提として確かめ、
  同じ経路で正しい値を仕込むとその値で開く対照つき**）
- AC4: pass — 単体（`stateGlyph` の 5 つが別の字形・絵文字の属性を持たない）＋ E2E（入力待ちの行が `×`）
- AC5: pass — E2E（入力待ちの行の `getComputedStyle(el).color` が `rgb(255, 110, 110)`。review ラウンド1 で WCAG 1.4.11 のため #ff5555 から
  明るくした——decisions D6）。vitest は `<style>` を読まないので単体では見ない
- AC6: pass — 単体（`StateIcon` の「切」で字形が空・`data-symbols="off"`）＋ E2E（表示の節の switch を切ると字形が消える）
- AC7: pass — 単体（`loadStatusSymbols` の既定が true）＋ E2E（何も仕込まない context で記号が出る）
- AC8: pass — 単体（`null` で字形も名前も出さず `aria-hidden`）＋ E2E（エージェントの居ない workspace の行の文字が空）
- AC9: pass — E2E（**同じページのまま**、選ぶ前の pane は 5,000 行、選んだ後に開いた pane は 1,000 行を `pane.subscribe` で求める。pane の id で分けて見る）
- AC10: pass — 単体（ストアの読み戻し）＋ E2E（持ち越した新しい context で「1,000 行」が選ばれている）
- AC11: pass — 単体（`effectiveScrollback` はモバイルでも数を優先）＋ E2E（iPhone 13 で 5,000 行を選び、開き直した pane が 5,000 行を求める。
  選ぶ前は 1,000 行＝以前と同じ）
- AC12: pass — E2E（`prefix+s` で開き、見出し「通知」「表示」「端末」）
- AC13: pass — E2E（iPhone 13 で上のバーの「設定」から開き、3 節と「自動（この端末では 1,000 行）」）
- AC14: pass — 単体（通知の節の既存テスト 20 件を改名先で通した。直したのは 2 か所だけ）＋ E2E（`notifications.spec.ts` の設定のテスト）
- AC15: pass — E2E（1 つ目の context で設定を変えたことを**前提として確かめてから**、別の context では 240px・展開・記号「入」・「自動」）
- AC16: pass — 文書の目視（`docs/herdr-parity.md` の H06・H19 を更新、H23b を追加、H25／H25b に分割）
- AC-I1: pass — E2E（`prefix+s`・サイドバーの［メニュー］→「設定」・モバイルの「設定」の 3 経路で開き、Esc で閉じる）＋ 単体（背景クリックで閉じても結果が残る）
- AC-I2: pass — 単体（switch は押した時点、ラジオは `change` の時点で保存。確定ボタンが無い）
- AC-I3: pass — E2E（キーだけで Tab で端末の節のラジオへ入り〔`toBeFocused`〕、矢印で選び、閉じて開き直すと選んだ行が選ばれている）
- AC-I4: pass — 単体（開いたら最初の switch へフォーカス。既存のテストを改名先で通した）
- AC-I5: pass — 単体（ドラッグ中にダイアログが開いたら、その時点で終えて保存し、以後の `pointermove` を無視する）

## 失敗の証跡

差し戻し（`sent_back`）は発生していない。**ただし条項 `regression-negative-control` に従い、回帰を守るテストは直した箇所を戻して落ちることを
確かめた**（タスクの点検で「壊しても通る」と指摘されたものは特に）。以下はその生の出力。

### 1. 既存テストが予告どおり落ちることを確かめてから直した（T8・T9・T11）

**T8（action・文脈・入口の改名）**——実装だけ改名し、テストはまだ直していない状態:

```
$ vitest run（実装だけ改名し、テストはまだ直していない）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — 通知 > notifySettings で設定のダイアログが開く
AssertionError: expected null to deeply equal { kind: 'notifySettings' }
 FAIL  src/components/ContextMenu.test.ts > ContextMenu — global > キー割り当て・移動・通知の設定・切り離しを、この順で出す
AssertionError: expected [ 'キー割り当て', '移動', '設定', '切り離し' ] to deeply equal [ 'キー割り当て', '移動', '通知の設定', '切り離し' ]
 FAIL  src/components/ContextMenu.test.ts > ContextMenu — global > 「通知の設定」を選ぶと、キー操作と同じ action が渡る
AssertionError: expected "vi.fn()" to be called with arguments: [ { type: 'notifySettings' } ]
 FAIL  src/components/HelpDialog.test.ts > HelpDialog — 表示 > 後続のキーは灰色クラスで「未対応（後続: ◯◯）」と出す
AssertionError: expected '全体?キー一覧qこのブラウザを切り離すs設定shift+r未対応（後続: …' to contain '通知の設定'
 FAIL  src/components/NotificationSettingsDialog.test.ts > NotificationSettingsDialog — OS 通知の 4 状態（AC8・AC12） > 開き直すと許可の状態を読み直す
AssertionError: 読み直して押せなくする: expected undefined to be defined
 FAIL  src/components/NotificationSettingsDialog.test.ts > NotificationSettingsDialog — 開閉とフォーカス（AC-I1・AC-I4） > 開いたら最初の切り替えへフォーカスが移る
AssertionError: expected <body><div data-v-app>…(1)</div></body> to be <button data-v-9ec312ce …(4)>…(2)</button> // Object.is equality
 FAIL  src/keys/KeyRouter.test.ts > KeyRouter — prefix モード > prefix+s は通知の設定、prefix+o は次の知らせへ移る
AssertionError: expected { kind: 'action', …(1) } to deeply equal { kind: 'action', …(1) }
 FAIL  src/mobile/MobileShell.test.ts > MobileShell — 通知の設定への入口 > 上部バーのボタンで設定が開く
      Tests  8 failed | 873 passed (881)
$ vue-tsc --noEmit（型検査。テストも対象）
src/actions/ActionDispatcher.test.ts(905,22): error TS2322: Type '"notifySettings"' is not assignable to type '"navigate" | "copy" | "split" | "focusDir" | "swap" | "cyclePane" | "closePane" | "zoom" | "renamePane" | "newTab" | "tabDelta" | "tabIndex" | "renameTab" | "closeTab" | "newWorkspace" | ... 12 more ... | "resizeBy"'.
src/components/NotificationSettingsDialog.test.ts(52,32): error TS2322: Type '"notifySettings"' is not assignable to type '"renamePane" | "newTab" | "renameTab" | "renameWorkspace" | "help" | "goto" | "settings" | "confirmClose" | "worktreeCreate" | "worktreeOpen"'.
src/components/NotificationSettingsDialog.test.ts(141,34): error TS2322: Type '"notifySettings"' is not assignable to type '"renamePane" | "newTab" | "renameTab" | "renameWorkspace" | "help" | "goto" | "settings" | "confirmClose" | "worktreeCreate" | "worktreeOpen"'.
src/keys/KeyRouter.test.ts(146,95): error TS2322: Type '"notifySettings"' is not assignable to type '"navigate" | "copy" | "split" | "focusDir" | "swap" | "cyclePane" | "closePane" | "zoom" | "renamePane" | "newTab" | "tabDelta" | "tabIndex" | "renameTab" | "closeTab" | "newWorkspace" | ... 12 more ... | "resizeBy"'.
src/notify/NotificationController.test.ts(944,34): error TS2322: Type '"notifySettings"' is not assignable to type '"renamePane" | "newTab" | "renameTab" | "renameWorkspace" | "help" | "goto" | "settings" | "confirmClose" | "worktreeCreate" | "worktreeOpen"'.
--- 負の対照: s の表記を「通知」にした
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/HelpDialog.test.ts > HelpDialog — 表示 > 後続のキーは灰色クラスで「未対応（後続: ◯◯）」と出す
AssertionError: expected '通知' to be '設定' // Object.is equality
      Tests  1 failed | 9 passed (10)
restored: cmp ok
```

**T9（ダイアログを 3 節に）**——実装を作り替え、移したテストはまだ直していない状態、とその後の負の対照:

```
$ vitest run SettingsDialog.test.ts（実装を 3 節に作り替え、移したテストはまだ直していない）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 通知の節 — 切り替え（AC6・AC-I2） > 3 つの切り替えを role=switch で出し、いまの値を aria-checked で示す
AssertionError: expected [ DOMWrapper{ …(3) }, …(3) ] to have a length of 3 but got 4
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 通知の節 — 開閉とフォーカス（AC-I1・AC-I4） > ダイアログに名前が付いている（読み上げで何の設定か分かる）
AssertionError: expected undefined to be '通知の設定' // Object.is equality
      Tests  2 failed | 18 passed (20)
--- 負の対照 T9-a：選ばれて見える行を上限で押さえない
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 保存値がサーバの上限を超えていたら、押さえた値（＝上限）の行が選ばれる（保存値は書き換えない）
AssertionError: expected [] to deeply equal [ '5,000 行' ]
      Tests  1 failed | 29 passed (30)
--- 負の対照 T9-b：端末の種類を inject せず "desktop" に固定した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > モバイルでは「自動」に 1,000 行と添える
AssertionError: expected '自動（この端末では 5,000 行）' to be '自動（この端末では 1,000 行）' // Object.is equality
      Tests  1 failed | 29 passed (30)
restored: cmp ok
--- 負の対照 T9-c：上限を取り付けた時点の値に写す（reactive でなくする）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 取り付けた後にサーバの上限が届くと、「自動」の行数・選択肢・選ばれている行が追従する
AssertionError: expected [ '自動（この端末では 5,000 行）', …(3) ] to deeply equal [ '自動（この端末では 10,000 行）', …(4) ]
      Tests  1 failed | 31 passed (32)
--- 負の対照 T9-d：ラジオの :checked を外した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 行を選ぶと保存され、その行が選ばれる（確定ボタンは無い）
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 取り付けた後にサーバの上限が届くと、「自動」の行数・選択肢・選ばれている行が追従する
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 設定の値が外から変わると、選ばれている行も移る
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 保存値がサーバの上限を超えていたら、押さえた値（＝上限）の行が選ばれる（保存値は書き換えない）
 FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — 端末の節（AC9・AC-I2） > 上限以下で段階に無い保存値は、選択肢に足されて選ばれる
      Tests  5 failed | 27 passed (32)
restored: cmp ok
```

**T11（E2E のセレクタ）**——直す前:

```
$ playwright test notifications.spec.ts -g "キーだけで切り替えられる"（セレクタを直す前）
  ✘  1 src/specs/notifications.spec.ts:380:1 › 通知：prefix+s で設定を開き、キーだけで切り替えられる（AC16・AC-I3） (7.1s)
    Error: expect(locator).toBeVisible() failed
    Locator: locator('.notify-settings')
    Expected: visible
    Error: element(s) not found
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
```

### 2. 純粋関数とストア（T1・T2）

```
--- 負の対照: done を ✅ にした
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/store/stateIndicator.test.ts > stateGlyph > herdr の symbols と同じ字形を返す
AssertionError: expected [ '×', '◐', '✅', '○', '·' ] to deeply equal [ '×', '◐', '✓', '○', '·' ]
 FAIL  src/store/stateIndicator.test.ts > stateGlyph > 絵文字の属性（Emoji=Yes）を持つ文字を使わない
AssertionError: ✅ は絵文字の属性を持つ: expected true to be false // Object.is equality
      Tests  2 failed | 4 passed (6)
restored: cmp ok
```

```
--- 負の対照 1: 自動のデスクトップを定数 5000 にした
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/scrollback.test.ts > effectiveScrollback > 自動: デスクトップはサーバの上限、モバイルは 1000
AssertionError: 上限 10000: expected 5000 to be 10000 // Object.is equality
      Tests  1 failed | 13 passed (14)
--- 負の対照 2: 保存値の判定を `saved && …` にした
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/scrollback.test.ts > scrollbackChoices > 保存値が 0 でも足す
AssertionError: expected [ 1000, 2000, 5000 ] to deeply equal [ +0, 1000, 2000, 5000 ]
      Tests  1 failed | 13 passed (14)
restored: cmp ok
```

### 3. サイドバーの幅のドラッグと保存（T6）

```
--- 負の対照 T6-a：ダイアログが開いたらドラッグを終える watch を外した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/Sidebar.test.ts > Sidebar — 幅を覚える > ドラッグ中にダイアログが開いたら、その時点で終えて保存し、以後の pointermove を無視する
AssertionError: expected undefined to be 320 // Object.is equality
      Tests  1 failed | 35 passed (36)
--- 負の対照 T6-b：divider の @pointercancel を外した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/Sidebar.test.ts > Sidebar — 幅を覚える > pointercancel でドラッグを終えると、見えている幅を保存する
AssertionError: expected undefined to be 300 // Object.is equality
      Tests  1 failed | 35 passed (36)
restored: cmp ok
--- 負の対照 T6-c：畳んでいる間のガードを外した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/Sidebar.test.ts > Sidebar — 幅を覚える > 畳んでいる間は、境目を動かしても幅も保存値も変わらない
AssertionError: expected 340 to be 240 // Object.is equality
      Tests  1 failed | 39 passed (40)
--- 負の対照 T6-d：ドラッグの起点を既定の 240 に固定した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/Sidebar.test.ts > Sidebar — 幅を覚える > ドラッグの起点は保存された幅で、pointermove は起点からの移動量で決まる
AssertionError: expected '290px' to be '330px' // Object.is equality
      Tests  1 failed | 39 passed (40)
restored: cmp ok
```

### 4. scrollback の結線（T7）

```
--- 負の対照 T7-a：購読で作ったときの値を読まない（以前の形）に戻した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/ViewSync.test.ts > ViewSync > 購読の行数は、その端末を作ったときの値を getScrollbackLines より優先する
AssertionError: expected [ [ 'pane.subscribe', …(1) ], …(1) ] to deeply equal [ [ 'pane.subscribe', …(1) ], …(1) ]
      Tests  1 failed | 13 passed (14)
--- 負の対照 T7-b：TermEntry に作ったときの行数を入れない
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/TerminalRegistry.test.ts > TerminalRegistry > 作ったときの行数を持ち、後から getScrollbackLines が変わっても変えない
AssertionError: expected undefined to be 2000 // Object.is equality
      Tests  1 failed | 24 passed (25)
restored: cmp ok
--- 負の対照 T7-c：`??` を `||` にした（0 行を予備に落とす）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/term/ViewSync.test.ts > ViewSync > 購読の行数は、その端末を作ったときの値を getScrollbackLines より優先する
      Tests  1 failed | 13 passed (14)
restored: cmp ok
```

### 5. `main.ts` の結線を E2E が守っていること（T11。単体では原理的に見えない）

条項どおり、**戻した状態でビルドし直してから**走らせた。

```
--- 負の対照 T11-a：main.ts の DeviceKindKey の provide を外して再ビルド（モバイルの E2E）
  ✘  1 src/specs/settings.spec.ts:250:3 › モバイル › 設定：上のバーの［設定］で開き、3 節と「自動（この端末では 1,000 行）」が見える（AC13） (6.7s)
    Error: expect(locator).toHaveText(expected) failed
    Expected: "自動（この端末では 1,000 行）"
    Received: "自動（この端末では 5,000 行）"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
--- 負の対照 T11-b：main.ts の getScrollbackLines を設定を読まない以前の形に戻して再ビルド
  ✘  1 src/specs/settings.spec.ts:120:1 › 設定：scrollback の設定はブラウザを閉じて開き直しても残り、新しく開いた pane が選んだ行数を求める（AC9・AC10） (13.0s)
  ✘  2 src/specs/settings.spec.ts:261:3 › モバイル › 設定：モバイルでも数を選べば 1,000 行の固定をやめ、開き直した pane がその行数を求める（AC11） (12.0s)
    Error: expect(received).toContain(expected) // indexOf
    Error: expect(received).toContain(expected) // indexOf
  2 failed
 ELIFECYCLE  Test failed. See above for more details.
restored: cmp ok
```

### 6. cross 点検の修正（注記を状態の表から組み立てる）

```
--- 負の対照 cross：注記を直書きに戻した
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/SettingsDialog.symbolsNote.test.ts > SettingsDialog — 表示の節の注記は状態の表から組み立てる（cross 点検） > 表を差し替えると、注記の字形と名前が追従する
AssertionError: expected '色に加えて × ◐ ✓ ○ · の形でも、入力待ち・作業中・完了・待機中・…' to contain '<blocked> <working> <done> <idle> <un…'
      Tests  1 failed (1)
restored: cmp ok
```

### 7. review ラウンド1 の修正（T13）——単体では原理的に見えない CSS の回帰を E2E で守る

タスク点検 T5 で直した不具合（印の幅がエージェントの有無で変わり、ラベルが横に動く）と、design D2 の「呼ぶ側に状態の点の CSS が残ると
字形の後ろに丸が描かれる」は、vitest が `<style>` を読まないので単体では見えない。E2E に確認を足し、**戻した状態でビルドし直して**落ちることを確かめた。

```
--- 負の対照 R1-a：StateIcon の 1em の箱（width/height）を外して再ビルド
  ✘  1 src/specs/settings.spec.ts:211:1 › 設定：何も設定しない利用者に記号が出る。入力待ちは赤の ×、居ない行は字形なし、記号を切ると消える（AC5〜AC8） (6.9s)
    Error: エージェントの有無でラベルが横に動かない
    Expected: 30.390625
    Received: 33.921875
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
--- 負の対照 R1-b：Sidebar に以前の状態の点の CSS（.sidebar-state-icon の丸）を戻して再ビルド
  ✘  1 src/specs/settings.spec.ts:211:1 › 設定：何も設定しない利用者に記号が出る。入力待ちは赤の ×、居ない行は字形なし、記号を切ると消える（AC5〜AC8） (6.1s)
    Error: 字形の後ろに丸を描かない
    Expected: "rgba(0, 0, 0, 0)"
    Received: "rgb(255, 110, 110)"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
restored: cmp ok
--- 負の対照 R1-c：goto に以前の状態の点の CSS（.goto-picker-state の丸）を戻して再ビルド
  ✘  1 src/specs/settings.spec.ts:211:1 › 設定：何も設定しない利用者に記号が出る。入力待ちは赤の ×、居ない行は字形なし、記号を切ると消える（AC5〜AC8） (6.2s)
    Error: goto でも字形の後ろに丸を描かない
    Expected: "rgba(0, 0, 0, 0)"
    Received: "rgb(255, 110, 110)"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
restored: cmp ok
```

### 8. review ラウンド2 の修正——モバイルのピッカーと居ない行の薄い丸

```
--- 負の対照 R2-a：モバイルのピッカーに以前の丸の CSS を戻して再ビルド
  ✘  1 src/specs/settings.spec.ts:313:3 › モバイル › 設定：モバイルのピッカーの印も字形だけで、後ろに丸を描かない（AC4・D2） (6.0s)
    Error: ピッカーでも字形の後ろに丸を描かない
    Expected: "rgba(0, 0, 0, 0)"
    Received: "rgb(255, 110, 110)"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
--- 負の対照 R2-b：StateIcon の丸（::before）を消して再ビルド
  ✘  1 src/specs/settings.spec.ts:211:1 › 設定：何も設定しない利用者に記号が出る。入力待ちは赤の ×、居ない行は字形なし、記号を切ると消える（AC5〜AC8） (1.6s)
    Error: 居ない行の薄い丸
    Expected: not "none"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
restored: cmp ok
```

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260921-herdr-settings-gaps
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45945 (state dir /tmp/wtm-smoke-1QbxFH)
{"ts":"2026-09-21T03:57:30.854Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

この work は**新しい入口（サブコマンド・オプション）を足していない**（設定は既存の `prefix+s` とモバイルの上のバーから開く）ので、
`smokeCommands` には足さない。

## 未検証の穴（skip / 環境不足）

- **実機での字形の見え方**。E2E は Linux の Chromium だけ。`✓`（U+2713）のフォントの対応は環境で差がありうる
  （design D4。見つかったら `StateIcon.vue` の中だけで CSS に差し替えられる）。**Windows・macOS・iOS・Android の実機での目視は未実施**。
- **色覚特性の利用者にとっての見分けやすさ**。WCAG 1.4.1（色だけに頼らない）は字形の併記で満たした。1.4.11（非テキストのコントラスト 3:1）は
  **配色の値から計算して**満たした（decisions D6。4 つの背景すべてで 3.32 以上）が、**実際の利用者や色覚シミュレーションでは確かめていない**。
- **タッチでの操作**。モバイルの設定のボタン・ラジオはエミュレーション（iPhone 13）でしか押していない。
- **同じブラウザの別のタブへの即時の反映**は対象外（design「ドメイン固有の考慮」。再読み込みで反映される）。
