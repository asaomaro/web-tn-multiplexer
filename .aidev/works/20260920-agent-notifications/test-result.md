# テスト結果: エージェントの「入力待ち」「完了」を、画面を見ていなくても知らせる

## 実行したもの

**ラウンド 4**（PR #5 提出後。利用者の実機確認で見つかった T24 を直した後。最終の数字）

- `pnpm build` — exit 0
- `vitest run --root packages/protocol` — 18 passed / 0 failed / 0 skipped
- `vitest run --root packages/server` — 507 passed / 0 failed / 0 skipped
- `vitest run --root packages/web` — **842 passed** / 0 failed / 0 skipped（T24 で +8 件）
- `pnpm -C packages/e2e test`（既定の E2E 一式）— **77 passed**（6.6m。**1 回で全部通った**。
  T24 でタッチ端末の 1 本を足したので 76 → 77）
- `pnpm -C packages/{protocol,server,web,e2e} typecheck` — 4 つとも exit 0
- `pnpm lint` — exit 0
- `aidev smoke` — pass（exit 0）

**この work 以降、一式を回すのは deliver の直前 1 回にする**（利用者の指示。`workers: 1` で 5〜8 分
かかるので、直している間は該当の spec だけを走らせる）。T24 の間もそうした。

### ラウンド 3（review ラウンド2 の 4 件を直した後。PR #5 提出時点の数字）

**`pnpm build` を通してから E2E を走らせた**（先行 work の decisions D8：`packages/e2e` の test は
再ビルドせず dist を読むので、直さずに走らせると古いバンドルを見る）。

- `pnpm build` — exit 0
- `vitest run --root packages/protocol` — 18 passed / 0 failed / 0 skipped
- `vitest run --root packages/server` — 507 passed / 0 failed / 0 skipped
- `vitest run --root packages/web` — **834 passed** / 0 failed / 0 skipped（この work で +約 190 件）
- `pnpm -C packages/e2e test`（既定の E2E 一式）— **4 回走らせた**:
  1 回目 74/75（`workspace-tab-pane.spec.ts` が時間切れ・6.3m）、2 回目 **75/75**（6.1m）、
  3 回目 74/75（`mobile.spec.ts` の D105・4.7m）、**4 回目 76/76**（4.6m）
- `pnpm -C packages/e2e test -- src/specs/notifications.spec.ts` — **7 passed**（38.5s）
- `pnpm -C packages/{protocol,server,web,e2e} typecheck` — 4 つとも exit 0
- `pnpm lint` — exit 0
- `aidev smoke` — pass（exit 0。ラウンド 4 でも通した）

**E2E は 1 本ずつ走らせた**（`workers: 1`。同時に走らせると無関係な失敗が出る）。

### 一式で落ちた 2 件について（どちらも単独では通る）

`workspace-tab-pane.spec.ts:154`（pane の分割・リサイズ・フォーカス移動）が **30 秒の時間切れ**。

- **単独で走らせると 10 件とも pass**（1.8m）。
- **2 回目の一式では 75 件すべて pass**。
- この work の差分でこの spec に関わるのは `PaneFrame.vue` の 1 行（呼び名の連鎖を共有の関数へ）だけで、
  **振る舞いは変えていない**（同じ式を関数に移しただけ。単体テストで固定済み）。

**ラウンド 2 の一式**では `mobile.spec.ts:77`（D105）が落ちた。これは**先行 work から backlog に
登録済みの既知の不安定な失敗**で、単独では 6 件とも pass（20.3s）。この work が `mobile/` に触れたのは
**上部バーにボタンを 1 つ足しただけ**（`MobileShell.vue` の +4 行）で、D105 が見ている
「隠れた pane の PTY の大きさ」とは無関係。

→ **どちらも負荷による不安定な失敗**と判断した。**4 回のうち 2 回は別々の spec が落ち、2 回は全部通った**
——再現性のある失敗ではない。ただし**この work は E2E に 6 本（約 34 秒ぶん）足している**ので、
一式の所要が延びて時間切れに触れやすくなっている可能性はある。**backlog へ送る**
（一式の安定性は先行 work から続く課題）。

## 受け入れ基準ごとの判定

- AC1: pass — `NotificationController.test.ts`（入力待ちへの遷移・完了の前進・続いている間は繰り返さない・
  初めて見る pane では完了を出さない）、E2E（実物のエージェント判定を通した入力待ち）
- AC2: pass — `describe.test.ts`（呼び名）、`ToneSound.test.ts`（入力待ちは上がる 2 音・完了は下がる 2 音）、
  `NotificationController.test.ts`（文言が分かれる）
- AC3: pass — `policy.test.ts`（**表の 3 行 × 3 経路を総当たり**）、`NotificationController.test.ts`（3 行を実地に）、
  E2E（(a) 3 つとも出る／(b) トーストだけ／(c) 何も出ない）
- AC4: pass — `NotificationController.test.ts`（1 秒の間に戻ったら知らせない・別の入力待ちへ変わっても古い方は出さない）
- AC5: pass — `NotificationController.test.ts`（フォーカスが戻ってから出る・既にあればその場で出す・
  経路が全部「切」でも出る・重ねない・押したら消える・一度消費したら出ない）、E2E（1 度だけ）
- AC6: pass — `notifications.test.ts`（3 つ独立・保存・**他の設定を壊さない**）、
  `view.test.ts`（`wtm.prefs.v1` の併合を往復で固定）、`NotificationSettingsDialog.test.ts`
- AC7: pass — `DesktopNotifier.test.ts`（`granted` 以外では作りにいかない）、
  `NotificationSettingsDialog.test.ts`（**開いただけでは求めない**・押すと求める）
- AC8: pass — `NotificationSettingsDialog.test.ts`（4 状態＋**許可を取ったら追従して切にも戻せる**）
- AC9: pass — `policy.test.ts`（同 pane の置き換え・9 件目で最古・上限超過の一括破棄）、`notifications.test.ts`
- AC10: pass — `NotificationController.test.ts`（先頭を消費・次を押すと次へ）、E2E（**tab バーの選択状態で判定**）
- AC11: pass — `NotificationController.test.ts`（空・対象が消えている・**途中で捨てて移ったときも知らせる**・
  全滅で 1 回だけ・捨てた件が無ければ余計な知らせを出さない）、E2E。
  **ラウンド 1 の時点では後半（「その旨を出して次へ進む」）を満たしていなかった**（レビューの指摘。decisions D8）
- AC12: pass — `DesktopNotifier.test.ts`（`Notification` が無い／構築が throw する環境）、
  `NotificationSettingsDialog.test.ts`（同じ表示に落ちる）
- AC13: pass — `ToneSound.test.ts`（`suspended` なら `"blocked"`・**unlock の直後はまだ鳴らない**）、
  `NotificationController.test.ts`（**「この環境で使えない」と「いま鳴らせない」を分ける**。decisions D10）、
  `NotificationSettingsDialog.test.ts`（3 状態で理由を出す）
- AC14: pass — `policy.test.ts`（鍵が `since`／`completionSeq` で決まる）、
  `StoreAdapter.test.ts`（`first` は初回だけ）、`NotificationController.test.ts`（初回は基準線・
  再接続で繰り返さない・**切断中の取りこぼしは拾う**・**タイマ発火後の再接続でも二重配送しない**）
- AC15: pass — `DesktopNotifier.test.ts`（クリックで `window.focus` → 閉じる → 渡された関数）、
  `NotificationController.test.ts`（**先頭ではなくその 1 件**）、E2E（tab バーで判定）
- AC16: pass — `ActionDispatcher.test.ts`（2 つの case）、`ContextMenu.test.ts`（メニューの位置と action）、
  `MobileShell.test.ts`（上部バーのボタン）、`KeyRouter.test.ts`（`prefix+s` / `prefix+o`）、
  `HelpDialog.test.ts`（実態と一致し、壊れた表示を出さない）、E2E（`prefix+s`）
- AC17: pass — 上記のとおり単体 1353 件・E2E 75 件が通る。テスト側を直したのは
  **落ちると設計で予告していた 3 件**（`KeyRouter.test.ts` / `HelpDialog.test.ts` / `ContextMenu.test.ts`）と、
  待ち行列の「同じ pane は置き換える」規則で期待が変わった 2 件、`App.test.ts` の provide 追加のみ
- AC-I1: pass — `NotificationSettingsDialog.test.ts`（Esc・背景のクリック・閉じても設定が残る）、E2E
- AC-I2: pass — 同上（押した時点で反映・確定ボタンが無い・もう一度押すと戻る）
- AC-I3: pass — `Toast.test.ts`（`sticky` の閉じるボタンと行動ボタンが `<button>`）、E2E（**キーだけで
  `prefix+s` → Space → Esc、および `prefix+o`**）
- AC-I4: pass — `NotificationSettingsDialog.test.ts`（最初の切り替えへ focus）、E2E
- AC-I5: pass — `openDialogWithContext` を使うので `main.ts` がキーを端末へ流さない（既存の仕組み）。
  トーストは既存と同じ位置・同じ `aria-live`

## 失敗の証跡

差し戻し（`sent_back`）は発生していない。**ただし「緑だが何も守っていないテスト」を炙り出すために、
条項 `regression-negative-control` の負の対照を 9 回行った**。以下はその生の出力。

### 1. キーとメニューを差し替えた直後（設計が「落ちる」と予告していた 3 件）

```
$ npx vitest run --root packages/web   # キーとメニューを差し替えた直後（T20 で直す前）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/ContextMenu.test.ts > ContextMenu — global > キー割り当て・移動・切り離しの 3 項目を、この順で出す
AssertionError: expected [ 'キー割り当て', '移動', '通知の設定', '切り離し' ] to deeply equal [ 'キー割り当て', '移動', '切り離し' ]
 FAIL  src/components/HelpDialog.test.ts > HelpDialog — 表示 > 後続のキーは灰色クラスで「未対応（後続: ◯◯）」と出す
AssertionError: expected '全体?キー一覧qこのブラウザを切り離すs未対応（後続: ）shift+r未…' to contain '未対応（後続: 通知）'
 FAIL  src/keys/KeyRouter.test.ts > KeyRouter — prefix モード > 後続のキー（例 s）は notYet の action を返し、terminal へ戻る
AssertionError: expected { kind: 'action', …(1) } to deeply equal { kind: 'action', action: { …(2) } }
      Tests  3 failed | 813 passed (816)
```

設計の予告どおりの 3 件が、予告どおりに落ちた。ヘルプに出ている
**「未対応（後続: ）」という壊れた表示**も、設計が「直さないとこうなる」と書いていたもの。

### 2. 純粋関数（T1〜T4 の点検で足した守り）

```
$ vitest run --root packages/web src/notify/   # (a) snapshotKeys の守りを外し (b) while を if にした状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ { kind: 'blocked', …(1) }, …(1) ] to deeply equal [ { kind: 'blocked', …(1) } ]
AssertionError: expected [ { kind: 'blocked', …(1) }, …(1) ] to deeply equal []
AssertionError: expected [ { kind: 'blocked', …(1) }, …(1) ] to deeply equal []
AssertionError: expected [ { kind: 'blocked', …(1) }, …(1) ] to deeply equal [ { kind: 'done', key: 'done:a1:2' } ]
AssertionError: expected 11 to be 8 // Object.is equality
 Test Files  1 failed | 1 passed (2)
      Tests  5 failed | 36 passed (41)
```

### 3. 制御の要（点検が「テストが守っていない」と指摘した 3 つ）

**1 度目は 3 つのうち 2 つが落ちなかった**——壊し方を模すタイミングが実際の穴とずれていた。

```
$ (a) 判定済みへ入れるのを「配送後」へ移した状態
      Tests  53 passed (53)

$ (b) 案内の契機を「判定した時点」から「配送する時点」へ移した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: でも案内は出る: expected '' to contain 'OS の通知でも受け取れます'
      Tests  1 failed | 52 passed (53)

$ (c) await nextTick() を外して同期で配送する状態
      Tests  53 passed (53)
```

テストを組み直した後（2 本目のタイマも発火させる／遅延を挟まない完了で表示を落とす）:

```
$ (a) 判定済みへ入れるのを「配送後」へ移した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: OS 通知は 1 回: expected [ 'p1', 'p1' ] to deeply equal [ 'p1' ]
      Tests  1 failed | 52 passed (53)

$ (c) await nextTick() を外して同期で配送する状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 確定後の値（非表示）で判定して知らせる: expected [] to have a length of 1 but got +0
      Tests  1 failed | 52 passed (53)
```

### 4. 設定ダイアログ（許可の状態が固まる must）

```
$ vitest run --root packages/web src/components/NotificationSettingsDialog.test.ts   # 許可を computed から直に読む（reactive でない）状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 許可の後は「入」: expected 'false' to be 'true' // Object.is equality
AssertionError: 読み直して押せなくする: expected undefined to be defined
      Tests  2 failed | 17 passed (19)
```

### 5. E2E（点検が「壊しても通った」と報告した 2 つ）

```
$ (a) 表の (c) 行を潰した状態 — 「見ている pane では何も出ない」
    expect(locator).toHaveClass(expected) failed
    Expected pattern: /tab-bar-item-active/
    Received string:  "tab-bar-item"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.

$ (b) #focusEntry から setView を落とした状態 — 「prefix+o」と「OS 通知のクリック」
    expect(locator).toHaveClass(expected) failed
    Expected pattern: /tab-bar-item-active/
    Received string:  "tab-bar-item"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
```

### 6. `cross` 点検の修正

```
$ (a) ダイアログ中でも焦点を直接動かす状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 焦点は直接動かさない（入力欄からフォーカスを奪わない）: expected 'p1' to be 'p-other' // Object.is equality
      Tests  1 failed | 127 passed (128)

$ (b) 再接続で消えた pane を掃除しない状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 待ち行列から消える: expected [ { key: 'blocked:a-p1:5', …(5) } ] to have a length of +0 but got 1
      Tests  1 failed | 127 passed (128)

$ (c) 呼び名の連鎖を ?? にした状態（3 箇所が 1 本になっているので、まとめて落ちるはず）
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/GotoPicker.test.ts > GotoPicker — 木の表示 > 最初から全展開（workspace → tab → pane）
 FAIL  src/notify/describe.test.ts > paneNameOf > 空文字は「値なし」として次へ落とす（`??` ではなく `||`）
 FAIL  src/notify/describe.test.ts > describeTarget > pane・tab・workspace が揃えば「pane 名（workspace / tab）」
 FAIL  src/notify/describe.test.ts > describeTarget > tab が引けなければ pane の名前だけ
```

**(c) が 7 件落ちている**のは、呼び名の連鎖を 3 箇所から 1 本にまとめたため——
**1 箇所を壊すと 3 箇所すべてが落ちる**ようになり、複製が解消されたことの実証になっている。

壊したファイルはすべて `cmp` で復元を確認済み。

### 7. レビュー ラウンド1 の修正（AC11 の文言・`unsupported` の畳み込み・トーストの［移動］）

```
$ レビュー指摘 3 件（AC11 の文言・unsupported の畳み込み・トーストの［移動］）を戻した状態
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 捨てたことも知らせる: expected [] to deeply equal [ '知らせの対象はすでに閉じられていました。' ]
AssertionError: 使えない環境として覚える: expected true to be false // Object.is equality
AssertionError: expected undefined to deeply equal [ '移動' ]
      Tests  3 failed | 146 passed (149)
```

### 8. レビュー ラウンド2 の修正（`ellipsis` が効いていなかった）

**CSS の効き目は単体テストでは確かめられない**ので、実ブラウザで［移動］が視界に入るかを見る E2E を足し、
幅の縛りを外して落ちることを確かめた。

```
$ 幅の縛りと min-width を外した状態（ellipsis が空振りする）
    Error: expect(locator).toBeInViewport() failed
    Expected: in viewport
    Received: viewport ratio 0
           - unexpected value "viewport ratio 0"
  1 failed
 ELIFECYCLE  Test failed. See above for more details.
```

**`viewport ratio 0`**——ボタンが画面の外へ完全に出ていた。**D9（知らせから移る手段を与える）の
目的を直撃する**不具合で、**幅を「design に無い」として外したことが原因**だった。

### 9. T24（PR レビュー（人間）の指摘。自動再生の解除）

**実機で使った利用者が見つけた不具合**——設定の注記は「どこかを押すと鳴るようになります」と言うのに、
解除の経路が 2 か所しか無く、画面のどこを押しても解除されなかった。**負の対照を 5 つ**行った
（A・B・E は単体、C・D は条項どおり**戻した状態でビルドし直してから** E2E）。

**A. 鳴らせなかった知らせの後の解除をやめる**

```
--- 負の対照 A：鳴らせなかった知らせの後の解除をやめた ---
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/notify/NotificationController.test.ts > NotificationController — 音が使えない環境（AC13） > 鳴らせなかった知らせの後は解除を試み、解除できたら印を下ろす
AssertionError: 諦めずに解除を試みる: expected "vi.fn()" to be called once, but got 0 times
 ❯ src/notify/NotificationController.test.ts:1033:40
    1031|     await fire(h);
    1032|     const store = useNotificationsStore(pinia);
--
 Test Files  1 failed (1)
      Tests  1 failed | 68 passed (69)
   Start at  09:41:02
   Duration  509ms (environment 39%, transform 27%, tests 19%, import 13%, worker 1%)

restored: cmp ok
```

**B. `noteUserGesture()` を何もしないようにする**

```
--- 負の対照 B：noteUserGesture() を何もしないようにした ---
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/notify/NotificationController.test.ts > NotificationController — 利用者の操作で自動再生を解除する（AC13） > 音が「入」なら、画面のどこかを操作した時点で解除しにいく
AssertionError: expected "vi.fn()" to be called once, but got 0 times
 ❯ src/notify/NotificationController.test.ts:1078:28
    1076|     useNotificationsStore(pinia).setPrefs({ sound: true });
--
 Test Files  1 failed (1)
      Tests  2 failed | 67 passed (69)
   Start at  09:41:03
   Duration  502ms (environment 40%, transform 26%, tests 20%, import 13%, worker 1%)

restored: cmp ok
```

**E. 解除できても「鳴らせませんでした」の印を下ろさないようにする**

```
--- 負の対照 E：解除できても「鳴らせませんでした」の印を下ろさないようにした ---
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/notify/NotificationController.test.ts > NotificationController — 音が使えない環境（AC13） > 鳴らせなかった知らせの後は解除を試み、解除できたら印を下ろす
AssertionError: 解除できた時点で印が下りる: expected true to be false // Object.is equality

- Expected
--
 Test Files  1 failed | 1 passed (2)
      Tests  3 failed | 86 passed (89)
   Start at  09:41:04
   Duration  1.04s (transform 34%, environment 32%, tests 19%, import 15%, worker 1%)

restored: cmp ok
```

**C. `main.ts` の `pointerdown`/`pointerup`/`keydown` の結線をすべて外す**（E2E）

```
--- 負の対照 C：main.ts の結線をすべて外して再ビルドした（E2E） ---
  ✘  1 src/specs/notifications.spec.ts:221:1 › 通知：入力待ちになると、トースト・OS 通知・音がそろって出る（AC1・AC3） (12.2s)
  ✘  2 src/specs/notifications.spec.ts:420:3 › タッチ端末 › 通知：タッチ端末でも知らせが届き、音が鳴る（AC13） (10.7s)
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('#e2e-notify-probe .e2e-tone')
    Expected: 2
    Received: 0
      - Expect "toHaveCount" locator('#e2e-notify-probe .e2e-tone') with timeout 5000ms
      - waiting for locator('#e2e-notify-probe .e2e-tone')
      236 |   await expect(page.locator("#e2e-notify-probe .e2e-notification")).toHaveCount(1, { timeout: 5000 });
      237 |   await expect(page.locator("#e2e-notify-probe .e2e-notification").first()).toHaveAttribute("data-title", /入力待ち/);
    > 238 |   await expect(page.locator("#e2e-notify-probe .e2e-tone")).toHaveCount(2); // 2 音
    Error: タッチ端末でも音の経路が通る
    expect(locator).toHaveCount(expected) failed
    Locator:  locator('#e2e-notify-probe .e2e-tone')
restored: cmp ok
```

**C がこの work で一番重い**。E2E の偽 `AudioContext` はそれまで `state = "running"` で始まっており、
**結線が無くても鳴っているように見えていた**（実物は「まだ操作されていないページ」では `suspended`）。
偽物を実物に合わせて初めて、この E2E が結線を守るようになった——外すと音が 0 になる。

**D. `pointerup` だけを外す**（タッチ端末のテスト）——**落ちなかった**

```
--- 負の対照 D：pointerup を外して再ビルドした（タッチ端末のテスト） ---
  ✓  1 src/specs/notifications.spec.ts:415:3 › タッチ端末 › 通知：タップだけで自動再生が解除され、音が鳴る（AC13・D12） (6.3s)
  1 passed (7.3s)
restored: cmp ok
```

**落ちない＝そのテストはその不具合を捕まえていない**（条項 `regression-negative-control`）。
理由を測った。タップの前後で `navigator.userActivation` を読むと、**何も操作していない時点で既に
`hasBeenActive=true`** を返す:

```
before: hasBeenActive=true isActive=true
pointerdown: hasBeenActive=true isActive=true
touchstart: hasBeenActive=true isActive=true
pointerup: hasBeenActive=true isActive=true
touchend: hasBeenActive=true isActive=true
click: hasBeenActive=true isActive=true
```

つまり Playwright の chromium は**常に「操作済み」として振る舞う**ので、
「タッチの `pointerdown` では活性化しない」という**仕様上の違いを E2E では再現できない**。
テストの主張を実際に確かめられる範囲（タッチ端末でも知らせが届き、音の経路が通る）に直し、
**`pointerup` の要否は「未検証の穴」へ送った**。

## 実機確認の結果（PR 提出後。利用者）

**E2E は本物のエージェントを起動できず**（`claude` を名乗るスクリプトで代用）、**OS 通知と音も
差し替えた偽物**でしか観測していない。その穴を利用者が実機で埋めた。環境は
**WSL2 上のサーバ ＋ Windows のブラウザ**（`localhost` で接続。secure context なので `Notification` が使える）。

- **本物の Claude Code をエージェントとして見分ける** — OK
- **入力待ちの判定**（herdr の `claude.toml` の `live_blocked_form` 等が、いまの版の実物の画面で効く）— OK
- **完了の判定**（`AgentTracker` の working→idle）— OK
- **画面の中の知らせと［移動］**で、別の workspace の pane へ移れる — OK
- **ブラウザが前面のときは OS 通知も音も出さない**（`routesFor` の経路 (b)）— OK
- **ブラウザが裏のとき OS 通知が出る** — OK（Windows の通知として）
- **音が鳴る** — OK
- **OS 通知のクリックで、その pane へ移れる** — OK
- **許可ダイアログ**（`requestPermission()` の実挙動）— OK（設定で「入」にした操作から出て、許可が通った）

**この確認の中で不具合が 1 件見つかり、T24 として直した**（上の「失敗の証跡 9.」）。

## 未検証の穴（skip / 環境不足）

- **モバイル（携帯・タブレット）**。Android Chrome は `new Notification()` が throw し、iOS はホーム画面に
  追加した web アプリでしか出せない（research F78・F79）。**実装は「この環境では使えません」に
  落とす経路を持つが、実機で確かめてはいない**。
- **タッチでの自動再生の解除**（T24 の `pointerup`）。**この面はテストで守れない**——負の対照 D の
  とおり、Playwright の chromium はタップ前から `hasBeenActive=true` を返し、
  「タッチの `pointerdown` は活性化しない」という仕様上の違いを再現できない。
  **仕様を読んで直しただけで、実機のタッチでは確かめていない**。E2E が見ているのは
  「タッチ端末でも知らせが届き、音の経路が通る」ところまで。
- **自動再生の制限が実際に掛かる状況**。`AudioContext` が `suspended` のまま来る経路
  （読み込み直して放置 → 裏に回す → 最初の知らせ）は単体テストと E2E（偽物を `suspended` で始める）で
  固定しているが、**実ブラウザでその状況を作ってはいない**。利用者の実機確認は、端末をクリックしてから
  待つ流れだった（＝解除済みの経路）。
- **OS 通知が Windows 側の設定で抑えられる場合**。集中モード（応答不可）やブラウザごとの通知の
  オフは、こちらからは見えない（`show()` は成功を返す）。設定に出す手立てが無いことを
  **既知の制限として PR に書く**。
- **E2E 一式の安定性**。1 回目に `workspace-tab-pane.spec.ts` が時間切れで落ちた（2 回目は通った）。
  **T24 の後にもう一度走らせたときも同じ spec が落ち、単独では 10/10 通った**（下記）。
  先行 work から続く課題で、この work が 6 本足したことで所要が延びている。backlog へ。
