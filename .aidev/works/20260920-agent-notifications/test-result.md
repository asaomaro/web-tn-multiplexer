# テスト結果: エージェントの「入力待ち」「完了」を、画面を見ていなくても知らせる

## 実行したもの

**ラウンド 3**（review ラウンド2 の 4 件を直した後。数字はすべてこの時点のもの）

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
- `aidev smoke` — pass（exit 0）

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

## 起動確認（smoke）

```
smoke: 20260920-agent-notifications
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:46243 (state dir /tmp/wtm-smoke-mRps4W)
{"ts":"2026-09-20T15:41:51.665Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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

この work は**新しい入口（サブコマンド・オプション）を足していない**（追加したのはブラウザ側の
キーとメニューで、smoke は既にブラウザでの往復を確認している）ので、`smokeCommands` への追加は不要と判断した。

## 未検証の穴（skip / 環境不足）

- **OS 通知と音の実機での確認**。E2E は `Notification` と `AudioContext` を**差し替えて**呼ばれた事実を
  観測しており、**実際に OS の通知が出るか・音が鳴るかは確かめていない**（ブラウザの自動化では
  原理的に観測できない）。**利用者の実機確認に送る**。
- **モバイルでの OS 通知**。Android Chrome は `new Notification()` が throw し、iOS はホーム画面に
  追加した web アプリでしか出せない（research F78・F79）。**実装は「この環境では使えません」に
  落とす経路を持つが、実機で確かめてはいない**。
- **自動再生の制限**。`AudioContext` が `suspended` のまま来る経路（開いて放置 → 別タブ → 最初の通知）は
  単体テストで固定しているが、**実ブラウザでその状況を作ってはいない**。
- **許可ダイアログの実挙動**。`requestPermission()` がユーザー操作を要求する条件はブラウザごとに違う
  （research F73）。差し替えた偽物でしか通していない。
- **E2E 一式の安定性**。1 回目に `workspace-tab-pane.spec.ts` が時間切れで落ちた（2 回目は通った）。
  先行 work から続く課題で、この work が 6 本足したことで所要が延びている。backlog へ。
