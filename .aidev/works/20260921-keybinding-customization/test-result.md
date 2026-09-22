# テスト結果: キー割り当てのカスタマイズ（20260921-keybinding-customization）

## 実行したもの

すべて `/workspaces/web-tn-multiplexer`（WSL の Linux・Chromium）。**判定は終了コード**で行った（`pnpm -s` は失敗しても何も出さないので、出力の有無を合否にしない）。
この work の test は **4 回**行った——1 回目：review の前／2 回目：ラウンド 1 の指摘 8 件を直したあと／3 回目：ラウンド 2 の指摘 4 件を直したあと／4 回目：ラウンド 3 の指摘 1 件（テストの穴）を直したあと。**下は 4 回目（最終の木）**。

- `pnpm exec vitest run`（protocol・server・web の全単体）— **131 files / 2138 tests passed / 0 failed / 0 skipped**
- `pnpm typecheck` — exit 0（web・e2e ほか全パッケージ）
- `pnpm lint` — exit 0（`eslint . --ext .ts`。`.vue` は対象外）
- `pnpm build` — exit 0
- E2E — 4 回目は**回していない**：ラウンド 3 の直しは**テストと docs だけで、本番コードは 3 回目から変わっていない**。**一式（116 本）は 2 回目の木、影響する 2 spec（25 本）は 3 回目の木で通っている**（3 回目のログは下の 3 回目の節と同じ）
- `aidev smoke` — pass（下の「起動確認」）
- 負の確認（変異 → 落ちる → 戻す → `cmp`）— 下の「失敗の証跡」

```
$ pnpm exec vitest run
 Test Files  131 passed (131)
      Tests  2138 passed (2138)
exit=0

$ pnpm typecheck
exit=0

$ pnpm lint
exit=0

$ pnpm build
exit=0
```

**1 回目**：単体 2122・E2E 一式 116 passed（8.1 分）・smoke pass。**2 回目**：単体 2128・E2E 一式 116 passed（9.1 分）・smoke pass。**3 回目**：単体 2134・E2E（key-bindings＋settings）25 passed（55.6 秒）・smoke pass。

## 受け入れ基準ごとの判定

判定は「どのテストが何を確かめたか」で書く。**環境差（Firefox・Safari・macOS の Option・Windows の AltGr・実機・IME）は自動では確かめられていない**（下の「未検証の穴」）。

- AC1: pass — 節「キー」が 5 つ目の節として出て、prefix と 34 操作（3 群）の現在の割り当てが一覧に見える（`KeySettings.test.ts`「一覧（AC1）」・E2E `settings.spec.ts` の 5 節・モバイルの一言・`key-bindings.spec.ts` のモバイル）。何も変えなければ既定と同じ内容（`keymap.test.ts` が旧 `DEFAULT_KEYMAP` を固定した値と 1:1）
- AC2: pass（例外 1 つ）— 既定の解決が旧表と 1:1（`keymap.test.ts`）・3 秒の時間切れ・Esc・割り当てのないキーは既存の `KeyRouter.test.ts` が通る・E2E 一式 116 本が通る。**例外**: CapsLock を入れて Shift を押した文字キーは shift 付きとして引く（decisions D8。verification.md に既知の制約として記載）
- AC3: pass — `KeyRouter.test.ts`「prefix の変更（AC3）」（新しい prefix で入る・旧い prefix は `pass`・2 度押しは `prefixBytes`）、`chord.test.ts`（`prefixBytes`）、E2E「prefix を ctrl+a に変えると…」（ブラウザが**実際に送った INPUT フレーム**で、旧 `ctrl+b`＝`\x02` が端末へ届き、2 度押しが `\x01` を送ることを確認。再読み込み後も残る）、モバイルの E2E（Prefix ボタンが `alt+x` を注入し `ESC x` を送る）
- AC4: pass — `assign.test.ts`・`keymap.test.ts`・`KeySettings.test.ts`（追加・置き換え・削除）、E2E「置き換え（［変更］）」（キー一覧の `prefix+?` を `prefix+y` にすると `prefix+y` で開き、外した `prefix+?` は何も起こさない）、E2E「キーボードだけで通せる」
- AC5: pass（範囲は decisions D11）— `KeyRouter.test.ts`「直接のキー」（terminal モードでだけ・repeat は食う・`enterMode` の押しっぱなし）、E2E「直接のキー：ctrl+alt+d…」（分割でき、**ブラウザが送ったフレームに `\x1b\x04` が無い**ことを、分割の応答を待ってから確認）、E2E「端末の外…でも、直接のキーは効く」（サイドバーの行をクリックして端末から焦点を外した状態）。**`keydown` を止めるボタンにフォーカスが残る間は届かない**（既存の挙動。verification.md の既知の制約・backlog に起票）
- AC6: pass — `assign.test.ts`（(a)〜(g)。理由文に持ち主の名前）・`keymap.test.ts`（読み込みでも同じ規則で落とす）・E2E「衝突は理由を出して拒否し…」。(c) は画面では Esc が取り消しになる（requirements に書き戻し済み）。(e) AltGr は `chord.test.ts`（`isAltGrComposed`）・`KeyRouter.test.ts`（実行時にも直接のキーに当てない）の合成イベントまで（**実機は未確認**）
- AC7: pass — `chord.test.ts`（`expandRange`）・`keymap.test.ts`・`KeySettings.test.ts`（範囲の取り込み・案内）
- AC8: pass — `store/settings.test.ts`（保存は既定との差だけ・壊れた値は値ごとに落とす・他の設定を消さない・同じ内容は書かず表を作り直さない）、`keyPrefs.test.ts`、E2E「壊れた保存値は値ごとに落として…」・「prefix を ctrl+a に…再読み込みでも残る」。反映は `main.ts` の `watch`→`router.setKeymap`（変異で E2E が落ちることを確認）
- AC9: pass — `assign.test.ts`（`planReset`）・`KeySettings.test.ts`・E2E「［既定に戻す］：操作ごと・prefix…」・「すべて既定に戻す」（確認を挟む・［やめる］で何も変えない・［戻す］で `keys` ごと消える）・「キーボードだけで通せる」（［既定に戻す］まで）
- AC10: pass — `assign.test.ts`（`applyRecommended` は冪等・足せなかった分は理由つき）・E2E「おすすめの直接のキー（ctrl+alt）を足すと、prefix なしで pane を行き来できる」
- AC11: pass — `HelpDialog.test.ts`・`Toast.test.ts`・`NotificationController.test.ts`（案内は現在の割り当て。**出ている案内も追従する**）・`ExtraKeys.test.ts`・E2E「キー一覧とトーストは現在の割り当てを出す」
- AC12: pass — navigate・resize・copy モードの中のキー・マウス・サーバは変えていない。既存の単体・E2E の一式が通る（上の 2138 本・116 本〔一式は 2 回目の木〕）
- AC13: pass（手の確認は未実施）— `docs/herdr-parity.md`（H12・H25・H26）と `docs/verification.md`（機能の説明・手で確かめる項目・既知の制約）を更新。手の確認そのものは実機で行う（後で）
- AC14: pass — `.aidev/backlog/product-roadmap.md`：元の項目を `[x]`（根拠つき）とし、残りを 6 行に分けて起票（プリセット・navigate 用のキー・herdr にある操作・独自コマンドのキー・ボタン上でも効かせる・使い勝手）
- AC-I1: pass — E2E「取り込み待ちの Esc は取り込みだけを取り消し、設定画面は閉じない」（Esc 1 回で閉じない・取り込み待ちでなければ Esc で閉じる）、`KeySettings.test.ts`・`SettingsDialog.test.ts`（ネイティブ `cancel` が keydown のあとに来ても閉じない）。**Firefox・Safari の `cancel` の順序は未確認**
- AC-I2: pass — E2E「衝突は理由を出して拒否し、元のまま終わって…」・`KeySettings.test.ts`（確定は押したキーそのもの・理由は `role="status"`）
- AC-I3: pass — E2E「キーボードだけで通せる」（行へ Tab→Enter で開く→［追加］→キー→Shift+Tab で［削除］→もう一度足す→Tab 2 回で［既定に戻す］→Enter）。［変更］［追加］［削除］は `<button>`
- AC-I4: pass — 各 E2E が `toBeFocused` で確認（取り込み待ちの部品へ移る・確定したら押したボタン〔置き換えは作り直された［変更］〕へ戻る・削除は次の部品／無ければ［追加：prefix の後］・戻しは同じ行の［追加：prefix の後］／prefix の［変更］）。下に固定した結果の文がフォーカスした部品を隠さないことも E2E で確認（`scroll-padding-bottom` を外すと落ちる）
- AC-I5: pass — 取り込み待ちの間のキーは `preventDefault`＋`stopPropagation` される（`KeySettings.test.ts`。**この 2 つを外す変異で落ちる**のが本体の守り）。E2E が観測しているのは、Esc 1 回で設定画面が閉じない・Tab でフォーカスが動かない（取り込む）・同じ prefix（ctrl+b）を押しても設定は変わらず取り込みが終わる、まで。**「prefix の帯が出ない」「送ったフレームが空」の否定は、取り込みの処理が無くても成り立つ**（設定画面は `showModal()` で背後が inert・window の listener はダイアログ中は何もしない・ルーターは dialog モード）ので、漏れの証拠には数えない（review ラウンド 1 の指摘）

## 失敗の証跡

**このラウンドでは、テストが落ちて coding へ差し戻す事態は起きていない**（一式が通った）。以下は、`regression-negative-control` に従う**負の確認**（修正・配線の箇所だけを壊す→テストが落ちる→元に戻して `cmp` で一致を確認）の生出力（該当行を、そのまま抜粋。全文は作業場所に残してある）。

### 負の確認で「落ちなかった」ものを 2 件見つけ、テストを直した（この工程で起きた唯一の失敗）

変異が**全テストを通った**＝その回帰テストは不具合を捕まえていなかった。どちらも、モードの解釈（ResizeMode・NavigateMode）を渡さないルーターでテストしており、解釈の無いモードは何を受けても `consume` するので、漏れが見えなかった。実物の解釈を渡すテストへ直し、同じ変異で落ちることを確かめた。

```
$ pnpm exec vitest run packages/web/src/keys/KeyRouter.test.ts
 Test Files  1 passed (1)
      Tests  46 passed (46)
exit=0
```
（1 件目：`KeyRouter.handleDirect` の `this.directHeld = chord;` を消す。T7 で見つけた実バグ——`enterMode` の直接のキーを押しっぱなしにすると、繰り返しが入ったモードのキーとして渡り、resize から抜ける——の回帰テストが通ってしまった）

```
$ pnpm exec vitest run packages/web/src/keys/KeyRouter.test.ts
 ❯ |@wtm/web| src/keys/KeyRouter.test.ts (46 tests | 1 failed) 26ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/KeyRouter.test.ts > KeyRouter — 直接のキー（AC5。D4） > enterMode の直接のキーを押しっぱなしにしても、繰り返しが入ったモードのキーとして渡らない（resize から抜けない・copy が動かない）
AssertionError: expected 'terminal' to be 'resize' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 45 passed (46)
exit=1
```
（直したあとの同じ変異：落ちる）

```
$ pnpm exec vitest run packages/web/src/keys/KeyInputController.test.ts
 Test Files  1 passed (1)
      Tests  33 passed (33)
exit=0
```
（2 件目：`KeyInputController.injectPrefix` の「prefix に入れるモードでだけ働く」の判定を消す。T8 の回帰テストが通ってしまった）

```
$ pnpm exec vitest run packages/web/src/keys/KeyInputController.test.ts
 ❯ |@wtm/web| src/keys/KeyInputController.test.ts (33 tests | 1 failed) 154ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/KeyInputController.test.ts > KeyInputController.injectPrefix — モバイルの Prefix ボタン（AC11） > navigate・resize・dialog モードでは何もしない（そのモードのキーは修飾キーを見ないので、変えた prefix が pane の移動・resize になってしまう）
AssertionError: navigate: expected [ { type: 'navigate', …(2) } ] to deeply equal []
 Test Files  1 failed (1)
      Tests  1 failed | 32 passed (33)
exit=1
```
（直したあとの同じ変異：落ちる）

### cross 点検の修正

同じ判定を複数箇所で持たない・実行時にも AltGr で合成された文字を直接のキーに当てない・案内が追従する、を固定するテスト。

```
$ pnpm exec vitest run packages/web/src/keys/KeyRouter.test.ts
 ❯ |@wtm/web| src/keys/KeyRouter.test.ts (46 tests | 1 failed) 37ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/KeyRouter.test.ts > KeyRouter — 直接のキー（AC5。D4） > AltGr で合成された文字（ドイツ語配列の AltGr+8＝[）は ctrl+alt+[ の直接のキーに当てず端末へ通す。US 配列の ctrl+alt+[ は altGraph が真でも効く（D6a）
AssertionError: expected { kind: 'action', action: { …(2) } } to deeply equal { kind: 'pass' }
 Test Files  1 failed (1)
      Tests  1 failed | 45 passed (46)
exit=1
```

（`altgr-guard`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts packages/web/src/keys/keyPrefs.test.ts
 ❯ |@wtm/web| src/keys/chord.test.ts (43 tests | 1 failed) 110ms
 ❯ |@wtm/web| src/keys/keyPrefs.test.ts (22 tests | 1 failed) 52ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/chord.test.ts > chordOf の出力は必ず parseChord で読み戻せる（照合は chordOf の正規形に集める） > 読む側も同じ規則：İ・空白の文字は parseChord・parseBinding でも読めない（chordOf が引かない chord を、手で書き換えた保存値が持ち込めない）
AssertionError: shift+İ: expected { ctrl: false, alt: false, …(3) } to be null
 FAIL  |@wtm/web| src/keys/keyPrefs.test.ts > normalizeBinding — 操作ごとの有効な割り当て > 読めない・文字列でない値は null
AssertionError: prefix+İ: expected 'prefix+shift+i̇' to be null
 Test Files  2 failed (2)
      Tests  2 failed | 63 passed (65)
exit=1
```

（`parse-chordchar`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/keys/keymap.test.ts packages/web/src/keys/assign.test.ts
 ❯ |@wtm/web| src/keys/keymap.test.ts (24 tests | 1 failed) 170ms
 ❯ |@wtm/web| src/keys/assign.test.ts (42 tests | 1 failed) 257ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)） > (c) prefix の後の ctrl+shift+v も拒否する（貼り付けがルーターより先に取るので、割り当てても効かない）
 FAIL  |@wtm/web| src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） > 予約：prefix の後の Esc・ctrl+shift+v（貼り付けが先に取る）、直接の ctrl+shift+v、直接で使えない形（文字・名前のあるキー・shift だけ）は落とす
AssertionError: expected [ 'prefix+ctrl+shift+v', 'ctrl+alt+z' ] to deeply equal [ 'ctrl+alt+z' ]
 Test Files  2 failed (2)
      Tests  2 failed | 64 passed (66)
exit=1
```

（`reserved-paste`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/notify/NotificationController.test.ts
 ❯ |@wtm/web| src/notify/NotificationController.test.ts (74 tests | 1 failed) 287ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/notify/NotificationController.test.ts > NotificationController — 案内（AC5） > 案内が出ている間に prefix・割り当てを変えても、文が追従する（sticky で残っているため）
AssertionError: expected 'エージェントの入力待ち・完了を、OS の通知でも受け取れますか？（後から …' to contain '（後から alt+x s でも変えられます）'
 Test Files  1 failed (1)
      Tests  1 failed | 73 passed (74)
exit=1
```

（`hint-follow`：変異を戻したあと `cmp` で元と一致を確認）

### T9（store）

`replaceKeyPrefs` の等価判定・読み直し・保存の直し・すべて戻す。

```
$ pnpm exec vitest run packages/web/src/store/settings.test.ts
 ❯ |@wtm/web| src/store/settings.test.ts (37 tests | 1 failed) 79ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/store/settings.test.ts > useSettingsStore — キーの戻し（AC9） > 同じ内容を渡し直しても、書かず、keymap も作り直さない（購読は変えたときだけ動く。押すたびに作り直さない）
AssertionError: expected "setItem" to not be called at all, but actually been called 3 times
 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
exit=1
```

（`store-early`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/store/settings.test.ts
 ❯ |@wtm/web| src/store/settings.test.ts (37 tests | 1 failed) 71ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/store/settings.test.ts > useSettingsStore — キーの割り当て（AC8） > replaceKeyPrefs を直に呼んでも、読めない値は反映も保存もしない（二重の守り。setKeyPrefix・setKeyBindings は手前で弾くので、ここでしか届かない）
AssertionError: expected { prefix: 'cmd+b', bindings: { …(1) } } to deeply equal { prefix: null, bindings: {} }
 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
exit=1
```

（`store-normalized`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/store/settings.test.ts
 ❯ |@wtm/web| src/store/settings.test.ts (37 tests | 1 failed) 79ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/store/settings.test.ts > useSettingsStore — キーの割り当て（AC8） > replaceKeyPrefs を直に呼んでも、読めない値は反映も保存もしない（二重の守り。setKeyPrefix・setKeyBindings は手前で弾くので、ここでしか届かない）
AssertionError: expected { prefix: 'cmd+b', bindings: { …(1) } } to deeply equal { bindings: { zoom: [ 'prefix+y' ] } }
 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
exit=1
```

（`store-writeraw`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/store/settings.test.ts
 ❯ |@wtm/web| src/store/settings.test.ts (37 tests | 1 failed) 78ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/store/settings.test.ts > useSettingsStore — キーの戻し（AC9） > 壊れた keys が保存に残っていても、すべて戻す・prefix を戻す操作で保存が直る（状態は既定のまま・表は作り直さない）
AssertionError: expected { keys: 'x' } to not have property "keys"
 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
exit=1
```

（`store-stored`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/store/settings.test.ts
 ❯ |@wtm/web| src/store/settings.test.ts (37 tests | 1 failed) 85ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/store/settings.test.ts > useSettingsStore — キーの戻し（AC9） > すべて戻すは、prefix を変えたままでも prefix も戻す
AssertionError: expected 'ctrl+a' to be 'ctrl+b' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
exit=1
```

（`store-resetall`：変異を戻したあと `cmp` で元と一致を確認）

### T11・T12・T8・T14（設定画面の結線・モバイル）

取り込み待ちの Esc の遅延通知とその条件・ネイティブ `cancel` の抑止・`kind` の受け渡し・Prefix ボタン。

```
$ pnpm exec vitest run packages/web/src/components/KeySettings.test.ts
 ❯ |@wtm/web| src/components/KeySettings.test.ts (42 tests | 1 failed) 1603ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5） > Esc のあと次のタスクの前に別の取り込みが始まったら、遅らせた知らせで新しい取り込み待ちを終わらせない（親には true のまま）
AssertionError: 新しい取り込み待ちは続いている: expected [ false ] to deeply equal [ true ]
 Test Files  1 failed (1)
      Tests  1 failed | 41 passed (42)
exit=1
```

（`keysettings-guard`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/components/KeySettings.test.ts packages/web/src/components/SettingsDialog.test.ts
 ❯ |@wtm/web| src/components/KeySettings.test.ts (42 tests | 1 failed) 2661ms
 ❯ |@wtm/web| src/components/SettingsDialog.test.ts (57 tests | 1 failed) 3561ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5） > Esc で取り消したあと、親へ「取り込み待ちが終わった」と知らせるのは次のタスク（ネイティブの cancel が keydown のあとに来ても閉じないため）
AssertionError: まだ知らせていない: expected [ false ] to deeply equal [ true ]
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 節「キー」の取り込み待ちと Esc（AC-I1・AC-I5） > Esc の keydown で取り込みを取り消した直後に cancel が来ても（Firefox・Safari で起きうる順序）、設定画面は閉じない
AssertionError: expected null to be 'settings' // Object.is equality
 Test Files  2 failed (2)
      Tests  2 failed | 97 passed (99)
exit=1
```

（`keysettings-holdcancel`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/components/SettingsDialog.test.ts packages/web/src/components/KeySettings.test.ts
 ❯ |@wtm/web| src/components/SettingsDialog.test.ts (57 tests | 2 failed) 3749ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 節「キー」の取り込み待ちと Esc（AC-I1・AC-I5） > 取り込み待ちの間にネイティブの cancel が来ても、設定画面を閉じない。取り込みを終えれば、いつもどおり閉じる
AssertionError: expected null to be 'settings' // Object.is equality
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 節「キー」の取り込み待ちと Esc（AC-I1・AC-I5） > Esc の keydown で取り込みを取り消した直後に cancel が来ても（Firefox・Safari で起きうる順序）、設定画面は閉じない
AssertionError: expected null to be 'settings' // Object.is equality
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 97 passed (99)
exit=1
```

（`settings-native-cancel`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/components/SettingsDialog.test.ts
 ❯ |@wtm/web| src/components/SettingsDialog.test.ts (57 tests | 1 failed) 2323ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/components/SettingsDialog.test.ts > SettingsDialog — 節「キー」への端末の種類（モバイルの一言） > モバイルのときだけ、節「キー」に画面のキーボードでは取り込めない旨の一言が出る
AssertionError: expected false to be true // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 56 passed (57)
exit=1
```

（`settings-kind`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/mobile
 ❯ |@wtm/web| src/mobile/ExtraKeys.test.ts (7 tests | 2 failed) 85ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/mobile/ExtraKeys.test.ts > ExtraKeys — 単純なキー > Ctrl を armed（one-shot）にして Prefix を押すと、注入のあとに待機を解除する（lock は残る）
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 FAIL  |@wtm/web| src/mobile/ExtraKeys.test.ts > ExtraKeys — 単純なキー > Prefix は injectPrefix を呼ぶ（いまの prefix を注入する。どのキーかは KeyInputController が Router から得る。AC11）
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 Test Files  1 failed | 7 passed (8)
      Tests  2 failed | 55 passed (57)
exit=1
```

（`extrakeys-injectprefix`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/keys/KeyInputController.test.ts
 ❯ |@wtm/web| src/keys/KeyInputController.test.ts (33 tests | 1 failed) 131ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/KeyInputController.test.ts > KeyInputController.injectPrefix — モバイルの Prefix ボタン（AC11） > 待機中の Ctrl/Alt（ExtraKeys）は重ねない：F キーの prefix でも prefix に入れ、待機は消費しない（次の実キーに残る）
AssertionError: expected 'terminal' to be 'prefix' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 32 passed (33)
exit=1
```

（`controller-injectprefix-pending`：変異を戻したあと `cmp` で元と一致を確認）

### T1・T4（chord・解決）

Option の復元は既定で無効・プロトタイプ経由の名前を引かない・上書きが全部落ちたら既定へ戻る。

```
$ pnpm exec vitest run packages/web/src/keys
 ❯ |@wtm/web| src/keys/chord.test.ts (43 tests | 1 failed) 42ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/chord.test.ts > chordOf — macOS の Option の文字化け（D6b。setOptionComposes が有効なときだけ） > 既定は戻さない（ほかの環境の入力を書き換えない）
AssertionError: expected 'alt+d' to be 'alt+∂' // Object.is equality
 Test Files  1 failed | 9 passed (10)
      Tests  1 failed | 245 passed (246)
exit=1
```

（`chord-option-default`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/keys
 ❯ |@wtm/web| src/keys/chord.test.ts (43 tests | 3 failed) 64ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/chord.test.ts > chordOf — KeyInput の正規形（D3） > プロトタイプ経由の名前（constructor・__proto__）は引かない
AssertionError: expected 'function Object() { [native code] }' to be null
 FAIL  |@wtm/web| src/keys/chord.test.ts > parseChord / formatChord > 読めないものは null（meta は herdr では alt の意味なので受けない・キーが 2 つ・空の要素・数字や記号への shift+）
AssertionError: ctrl+a+constructor: expected { ctrl: true, alt: false, …(4) } to be null
 FAIL  |@wtm/web| src/keys/chord.test.ts > parseBinding / formatBinding > 範囲 1..9（修飾は ctrl・alt・cmd。shift は不可）
AssertionError: expected { via: 'prefix', chord: '1', …(1) } to be null
 Test Files  1 failed | 9 passed (10)
      Tests  3 failed | 243 passed (246)
exit=1
```

（`chord-own`：変異を戻したあと `cmp` で元と一致を確認）

```
$ pnpm exec vitest run packages/web/src/keys
 ❯ |@wtm/web| src/keys/keymap.test.ts (24 tests | 4 failed) 51ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |@wtm/web| src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） > 上書き同士の衝突は、カタログの順で先を残し、後を落として記録する。後が全部落ちたら既定へ戻る
AssertionError: expected [] to deeply equal [ 'prefix+g' ]
 FAIL  |@wtm/web| src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） > 上書きが全部落ちたら既定へ戻る（予約・読めない値でも同じ）。元から [] の操作は割り当てなしのまま
AssertionError: prefix+esc: expected [] to deeply equal [ 'prefix+z' ]
 FAIL  |@wtm/web| src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） > bindingsOf は正規形で返す（入力が非正規形でも）
AssertionError: expected [] to deeply equal [ 'prefix+g' ]
 FAIL  |@wtm/web| src/keys/keymap.test.ts > resolveKeymap — 範囲（AC7） > 範囲の 9 個のどれか 1 つでも衝突・予約なら、範囲全体を落とす
AssertionError: expected [] to deeply equal [ 'prefix+shift+x' ]
 Test Files  1 failed | 9 passed (10)
      Tests  4 failed | 242 passed (246)
exit=1
```

（`keymap-fallback`：変異を戻したあと `cmp` で元と一致を確認）

### review ラウンド 1 の直しの負の確認（2 回目の test）

`captureAttrs` の `onBlur` を消す（取り込みの部品の 3 入口〔prefix の［変更］・割り当ての［変更］・［追加］〕が同じ部品を使うこと。以前は prefix・［変更］の入口で `@blur` を外しても通った）:

```
$ pnpm exec vitest run packages/web/src/components/KeySettings.test.ts
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5） > フォーカスを失うと元のまま終わる。**フォーカスは奪い返さない**（利用者が選んだ別の部品のまま）
AssertionError: expected <button data-v-916cdd3a …(2)></button> to be null
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5） > フォーカスを失うと、prefix の［変更］ で始めた取り込みも元のまま終わる（親には false。3 つの入口が同じ部品を使う）
AssertionError: expected <button data-v-916cdd3a …(2)></button> to be null
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5） > フォーカスを失うと、割り当ての［変更］ で始めた取り込みも元のまま終わる（親には false。3 つの入口が同じ部品を使う）
AssertionError: expected <button data-v-916cdd3a …(2)></button> to be null
 FAIL  |@wtm/web| src/components/KeySettings.test.ts > KeySettings — 取り込み待ちの取り消しと漏らさない（AC-I1・AC-I5） > フォーカスを失うと、［追加］ で始めた取り込みも元のまま終わる（親には false。3 つの入口が同じ部品を使う）
AssertionError: expected <button data-v-916cdd3a …(2)></button> to be null
 Test Files  1 failed (1)
      Tests  4 failed | 42 passed (46)
exit=1
```

`isAltGrComposed` からシフトありの US の記号の表を外す（`ctrl+alt+shift+[`＝`{` 等が「AltGr で合成された文字」になる）:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > US 配列のシフトありの記号（ctrl+alt+shift+[＝{ ・? ・<）とテンキーの記号も、物理キーの文字と同じなので通す。ドイツ語配列の AltGr+7＝{ は合成
AssertionError: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 43 passed (44)
exit=1
```

`storage` イベントの追従を外す（別のウィンドウの `keys` の変更に追従せず、先の変更を上書きする）:

```
$ pnpm exec vitest run packages/web/src/store/settings.test.ts
 FAIL  |@wtm/web| src/store/settings.test.ts > useSettingsStore — キーの割り当て（AC8） > 別のウィンドウで割り当てが変わったら（storage イベント）追従し、古い状態から別の変更をしても先の変更を上書きしない
AssertionError: expected 'ctrl+b' to be 'alt+x' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 37 passed (38)
exit=1
```

（いずれも、戻したあと `cmp` で元と一致を確認）

**この 2 回目の test では、テストの失敗は起きていない**（一式が通った。負の確認で落ちたのは意図した変異による）。

### review ラウンド 2 の直しの負の確認（3 回目の test）

ラウンド 2 の should は、**ラウンド 1 の直しが作った退行**だった（`isAltGrComposed` が `shift` の状態を見ずに両方の表と比べ、フランス語の AltGr+3＝`#` 等が素通し）。2 回目の差し戻しなので、直した項だけでなく**同じ不変条件を支える 6 つの項を 1 つずつ壊した**（decisions D14）。すべて落ちる。

(t1) AltGraph の門を消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > AltGraph が偽なら合成ではない
AssertionError: expected true to be false // Object.is equality
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > テンキーの記号・Space は shift に依らず通り、AltGraph が偽ならどれも合成ではない
AssertionError: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 45 passed (47)
exit=1
```

(t2) 1 文字の門を消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > 表に無い code や 1 文字でない key は、前者は拒否側・後者は合成ではない
AssertionError: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 46 passed (47)
exit=1
```

(t3) 英数字を通す判定を消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > 英数字は通す（Firefox・Windows は Ctrl+Alt だけで AltGraph が真になる）
AssertionError: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 46 passed (47)
exit=1
```

(t4) `code` の表の引きを消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > US 配列の ctrl+alt+[ ・] ・/ は、物理キーの文字と同じなので通す
AssertionError: expected true to be false // Object.is equality
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > US 配列のシフトありの記号（ctrl+alt+shift+[＝{ ・? ・<）とテンキーの記号も、物理キーの文字と同じなので通す。ドイツ語配列の AltGr+7＝{ は合成
AssertionError: expected true to be false // Object.is equality
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > US 配列の記号キーは、同じ shift の状態の文字なら通り、違う状態の文字（AltGr の層）なら合成
AssertionError: Backquote `: expected true to be false // Object.is equality
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > テンキーの記号・Space は shift に依らず通り、AltGraph が偽ならどれも合成ではない
AssertionError: NumpadAdd shift=false: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  4 failed | 43 passed (47)
exit=1
```

(t5) shift の状態を見ずに両方の表と比べる（**ラウンド 2 が指摘した退行そのもの**）:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > AltGr の層が US のシフトの記号と同じ文字になる配列（フランス語 AltGr+3＝#・スペイン語 AltGr+2＝@・北欧 AltGr+4＝$）は、shift が偽なら合成（shift の状態を見て比べる）
AssertionError: expected false to be true // Object.is equality
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > US 配列の記号キーは、同じ shift の状態の文字なら通り、違う状態の文字（AltGr の層）なら合成
AssertionError: Backquote ~（shift なし）: expected false to be true // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 45 passed (47)
exit=1
```

(t6) テンキーの記号の表を消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > US 配列のシフトありの記号（ctrl+alt+shift+[＝{ ・? ・<）とテンキーの記号も、物理キーの文字と同じなので通す。ドイツ語配列の AltGr+7＝{ は合成
AssertionError: expected true to be false // Object.is equality
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > テンキーの記号・Space は shift に依らず通り、AltGraph が偽ならどれも合成ではない
AssertionError: NumpadAdd shift=false: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 45 passed (47)
exit=1
```

（いずれも、戻したあと `cmp` で元と一致を確認）

**この 3 回目の test では、テストの失敗は起きていない**（通った。負の確認で落ちたのは意図した変異による）。

### review ラウンド 3 の直しの負の確認（4 回目の test）

ラウンド 3 の should は**テストの穴**だった（本番コードは正しい）：D14 の「6 つの項を壊す変異が全部落ちる」は各項を**丸ごと消す**変異だけで、項の**内側**が守られていなかった。レビュアーが再現した 4 つの変異が、足したテストで落ちる：

英数字の門を `/^[a-z0-9]$/`（大文字を落とす。実物のキーボードは `Ctrl+Alt+Shift+D` で key＝`D`）に変える:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts packages/web/src/keys/assign.test.ts packages/web/src/keys/KeyRouter.test.ts
 FAIL  |@wtm/web| src/keys/KeyRouter.test.ts > KeyRouter — 直接のキー（AC5。D4） > Firefox・Windows（altGraph が真）でも、実物の大文字＋shift の Ctrl+Alt+Shift+D は直接のキー（下へ分割）に当たる
AssertionError: expected { kind: 'pass' } to deeply equal { kind: 'action', action: { …(2) } }
 FAIL  |@wtm/web| src/keys/assign.test.ts > validateAssignment — 引けないキー・AltGr（AC6 (e)） > 実物のキーボードの大文字（Ctrl+Alt+Shift+D は key＝D）も AltGraph が真で通す（おすすめ一式の ctrl+alt+shift+d が取り込める）
AssertionError: expected { ok: false, …(1) } to deeply equal { ok: true, …(1) }
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > 大文字の英数字は通す（実物のキーボードは Ctrl+Alt+Shift+D で key＝D。CapsLock で shift なしの大文字でも同じ）
AssertionError: expected true to be false // Object.is equality
 Test Files  3 failed (3)
      Tests  3 failed | 139 passed (142)
exit=1
```

shift 真で表に無い `code` の枝をフェイルオープン（`?? k.key`）にする（ポーランド語 AltGr+Shift+A＝`Ą` が取り込まれる）:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts packages/web/src/keys/assign.test.ts packages/web/src/keys/KeyRouter.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > shift 真で表に無い code の非 ASCII の文字（ポーランド語 AltGr+Shift+A＝Ą・€）は、拒否側に倒す（フェイルクローズ）
AssertionError: expected false to be true // Object.is equality
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 141 passed (142)
exit=1
```

`NumpadEqual` の項を消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts packages/web/src/keys/assign.test.ts packages/web/src/keys/KeyRouter.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > テンキーの記号・Space は shift に依らず通り、AltGraph が偽ならどれも合成ではない
AssertionError: NumpadEqual shift=false: expected true to be false // Object.is equality
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 141 passed (142)
exit=1
```

`NumpadComma` の項を消す:

```
$ pnpm exec vitest run packages/web/src/keys/chord.test.ts packages/web/src/keys/assign.test.ts packages/web/src/keys/KeyRouter.test.ts
 FAIL  |@wtm/web| src/keys/chord.test.ts > isAltGrComposed — AltGr で合成された文字（D6a） > テンキーの記号・Space は shift に依らず通り、AltGraph が偽ならどれも合成ではない
AssertionError: NumpadComma shift=false: expected true to be false // Object.is equality
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 141 passed (142)
exit=1
```

（いずれも、戻したあと `cmp` で元と一致を確認）

**手で項を挙げる方法をやめ、`isAltGrComposed` の本体と 2 つの表の各行・各記号を 1 つずつ壊す自動の変異の網羅**を回した（97 個：行の削除・`return false`→`true`・`!==`→`===`・`k.shift` の反転・表の引きの取り違え・`??` のフェイルオープン・英数字の門・表の行の削除と値の変更。実行：`chord.test.ts`・`assign.test.ts`・`KeyRouter.test.ts`）。**全部落ちる**：

```
mutants: 97
killed 97 / 97; survivors 0
```

（実行後 `chord.ts` は元と `cmp` で一致）

**この 4 回目の test では、テストの失敗は起きていない**（通った。負の確認で落ちたのは意図した変異による）。

### E2E の負の確認（ビルドした成果物を使うので、**変異した状態でビルドし直してから**走らせ、戻した状態でもう一度ビルドした）

`main.ts` の `watch(() => settings.keymap, …router.setKeymap…)` を消す（設定を変えても `KeyRouter` が古い表のまま）:

```
$ bash -c pnpm --filter @wtm/web run build > /dev/null 2>&1 && cd packages/e2e && pnpm exec playwright test src/specs/key-bindings.spec.ts -g "prefix を ctrl\+a に変えると"
  ✘  1 src/specs/key-bindings.spec.ts:86:1 › prefix を ctrl+a に変えると、新しい prefix で入り、旧い ctrl+b は端末へ届き、2 度押しは ctrl+a を端末へ送る。再読み込みでも残る（AC3・AC8・AC-I4） (6.7s)
    Error: expect(received).toContain(expected) // indexOf
    Expected substring: ""
    Received string:    ""
    > 108 |   await expect.poll(() => sentSince(sent, n)).toContain("\x02");
  1 failed
exit=1
```
（`main-setkeymap`：戻したあと `cmp` で一致・`pnpm --filter @wtm/web run build` を戻した状態でやり直し、exit 0）

`SettingsDialog.vue` の `scroll-padding-bottom` を消す（フォーカスした取り込みの部品が、下に固定した結果の文の帯に隠れる。T15 で強化したテスト）:

```
  ✘  1 src/specs/key-bindings.spec.ts:215:1 › 下に固定した結果の文は、フォーカスした部品（一覧の下のほうの取り込みの部品）を隠さない（AC-I4・WCAG 2.4.11） (12.2s)
    Error: expect(received).toBeLessThanOrEqual(expected)
    Expected: <= 671.53125
    Received:    704.578125
      236 |   expect(box && message && dialogBox).toBeTruthy();
    > 238 |   expect(box!.y + box!.height).toBeLessThanOrEqual(message!.y + 1);
      239 |   expect(box!.y).toBeGreaterThanOrEqual(dialogBox!.y);
      240 |   expect(message!.y + message!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
  1 failed
e2e exit=1
```

戻した状態（ビルドし直し）で同じテスト:

```
  ✓  1 src/specs/key-bindings.spec.ts:215:1 › 下に固定した結果の文は、フォーカスした部品（一覧の下のほうの取り込みの部品）を隠さない（AC-I4・WCAG 2.4.11） (10.6s)
  1 passed (18.7s)
e2e exit=0
```
（なお、強化する前のテストは、この変異でも通っていた——`1 passed`。スクロール位置を自動に任せていたため。T15 の点検で指摘され、帯のすぐ上まで先にスクロールしてから押す形に直した）

## 起動確認（smoke）

```
$ aidev smoke   （4 回目。1〜3 回目も pass）
smoke: 20260921-keybinding-customization
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46305 (state dir /tmp/wtm-smoke-womhYX)
{"ts":"2026-09-21T21:20:48.526Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

**この work は新しい入口（サブコマンド・オプション・API）を足していない**（web の画面と、ブラウザ内のキーの扱いだけ。サーバ・protocol は無変更）ので、`smokeCommands` への追加は無し。

## 未検証の穴（skip / 環境不足）

自動のテストは **Linux の Chromium だけ**。次は実機・別ブラウザで確かめていない（`docs/verification.md` の手で確かめる項目・既知の制約に書いた。deliver の PR 本文へ引き継ぐ）。

- **Firefox・Safari**：取り込み待ちの Esc（`keydown` のあとにネイティブの `cancel` が来る順序。単体では順序を再現して確認）・［すべて既定に戻す］の確認の Esc（保険を持たず、`keydown` の `preventDefault()` に頼る）
- **Windows（特に Firefox）**：`Ctrl+Alt+D` が取り込めること・AltGr の配列で `AltGr+Q`（`@`）が拒否されること・おすすめ一式のあと `AltGr+8`・`AltGr+9`（`[`・`]`）が端末に打てること（合成イベントまでは確認）
- **macOS**：`Option+D` が `alt+d` として取り込まれること・非 US 配列（Dvorak・QWERTZ・AZERTY）での Option の chord の表示の食い違い（decisions D7）
- **ブラウザ・OS が先に受けるキー**（`Ctrl+T`・`Ctrl+W`・`Cmd+T` 等）は画面に届かず割り当てられない（環境で変わる）
- **IME**：変換中のキーが取り込まれないこと（`isComposing`・keyCode 229 の扱いは単体まで）
- **実機（iOS Safari・Android Chrome）**：画面のキーボードでは取り込めない（一言を出す）・物理キーボードをつないだときの動作
- **`keydown` を止めるボタンにフォーカスが残る間**は prefix・直接のキーが届かない（既存の挙動。backlog に起票済み。decisions D11）
- E2E の一式は review の前と ラウンド 1 の直しのあとの 2 回（116 本）。ラウンド 2 の直しのあとは影響する 2 spec（25 本）だけ、ラウンド 3 の直しのあと（テストと docs だけ）は回していない（少しの修正ごとには回さない方針）。4 回目のあとに変えたのは、戻した（`cmp` 一致の）変異と、記録（test-result.md・review.md・decisions.md）だけ
- AltGr の判定は、物理キーの位置（`code`）を US 配列と比べる。**記号の位置が US と違う配列（Dvorak 等）は Firefox・Windows で記号が拒否されうる**（英数字は通る）・**AltGr の記号が US と同じ物理キーにある配列では合成と判定できない**（どちらも実機は未確認。verification.md の既知の制約）
