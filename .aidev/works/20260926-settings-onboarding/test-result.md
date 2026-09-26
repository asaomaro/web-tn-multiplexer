# テスト結果（20260926-settings-onboarding）

## 実行したもの（test ラウンド 4。review ラウンド 1 の差し戻しと D12 の修正のあと）

終了コードで判定した（出力をファイルへリダイレクトし、`echo $?` を別に取った）。

- `pnpm -s build` — exit 0
- `pnpm -s typecheck`（build の後）— exit 0
- `pnpm -s test`（全パッケージ）1 回目 — exit 0。171 files / 3363 passed / 0 failed / 0 skipped
- `pnpm -s test` 2 回目 — exit 1。`packages/server/src/git/GitInfoPoller.test.ts:296` が `Error: Test timed out in 5000ms.`（下の「高負荷のときだけ落ちたもの」の 1 本目と同じ。load average 20）。単独で 3 回流して 23 passed ×3
- `pnpm -s test` 3 回目 — exit 0。171 files / 3363 passed / 0 failed / 0 skipped
- `pnpm -s test` 4 回目 — exit 0。171 files / 3363 passed / 0 failed / 0 skipped（3 回目と 4 回目で、続けて 2 回通った）
- `aidev smoke`（3 本）— pass（下の「起動確認」）
- E2E（`packages/e2e`）は走らせていない（利用者の方針）。

### 高負荷のときだけ落ちたもの（バックログ「単体・結合テストが高負荷のときだけ落ちる」の種類）

coding 中と test ラウンド 1 の全体の実行で、次の既存のテストが落ちた（どれもこの work が触っていないテストで、落ち方は既定 5 秒のタイムアウト・結合テストの待ち切れ。
別の worktree・別のセッションの全体テストと同時に走り、load average は 10〜19）。それぞれ単独で 3 回流して 3 回とも通り、その後の全体の実行（上の 2 回）も通った。

- `packages/server/src/git/GitInfoPoller.test.ts`「最初の pane が別のリポジトリへ移ると…」— `Error: Test timed out in 5000ms.`（coding 中の全体の実行）。単独 3 回: 23 passed ×3
- `packages/web/src/components/SettingsDialog.test.ts:1071`「すべての上書きを既定に戻すボタンは確認を挟み…」— `Error: Test timed out in 5000ms.`（ラウンド 1 の 3 回目の全体の実行）。単独 3 回: 90 passed ×3
- `packages/server/src/composeServer.integration.test.ts`「実物の PTY で偽の 'claude' を起動すると…」— `timed out waiting for event pane.agent_status_changed`（同）。単独 3 回: 24 passed ×3

## 受け入れ基準ごとの判定

- AC1: pass — `store/onboarding.test.ts`（`isFreshBrowser` の各痕跡・空・壊れた値）、`OnboardingDialog.test.ts`「痕跡の無いブラウザでは、接続が open になってから開く」、`App.test.ts`「本体に置かれ…開く」。実物の Chromium では起動確認の新しい段（人が使うブラウザに見せたページ）で開くことを確かめた。
- AC2: pass — `onboarding.test.ts`「既存の利用者のブラウザでは false で、判定は何も書かない」（localStorage の全キーを前後で比べる）、`OnboardingDialog.test.ts`「既存の利用者のブラウザでは開かず、保存値も変えない」。
- AC3: pass — 確定の反映のテスト（テーマ＝`setTheme` と同じ保存値、プリセット＝設定画面の経路で足した `keys` と一致、通知＝`notify`）。「使わない」は `keys` を書かない。
- AC4: pass — スキップで何も反映しない（`readPrefs()` が `{ onboarding: false }` だけ、自動再生の解除・許可の要求が呼ばれない）。
- AC5: pass — スキップ・確定のあと、新しいストアでは出ない。起動確認でも再読み込みで出ないことを確かめた。
- AC6: pass — `SettingsDialog.test.ts`「［はじめの案内を開く］で案内に切り替わり…」、`OnboardingDialog.test.ts`「既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない」「開き直すと、現在の設定から始める」。
- AC7: pass — 既定・変更後・割り当てなしの 3 通りで、prefix・キー一覧・設定の表記を確かめた。
- AC8: pass — `isFreshBrowser(null)`・`getItem` が throw で false。
- AC9: pass — 許可が default なら確定の中で求め、granted で入れる・拒否ならトースト・許可済みなら求めない・拒否／未対応なら押せない。確定で `markHintAnswered`、スキップでは呼ばない。`NotificationController.test.ts` で、出ている案内を消して以後出さないこと。
- AC10: pass（コンポーネントの範囲）— 1 列の画面・指の操作・その組み合わせで説明とプリセットの出し分け、画面上の 2 つのボタンで閉じる。**画面からはみ出さないことは実機で確かめていない**（下の「未検証の穴」）。
- AC11: pass — 既存の保存値の読み方・既定値は変えていない。全体の単体テスト（既存の `settings`・`notifications`・`Toast`・`SettingsDialog` のテストを含む）が 2 回とも通った。
- AC12: pass — `docs/herdr-parity.md` の H25b 行、`docs/verification.md` の説明と手で確かめる手順（T6・T7 のタスク点検で実装との食い違いを直した）。
- AC-I1: pass — 起動時／設定画面から開く、スキップ・Esc・確定で閉じる、背景のクリックで閉じない。
- AC-I2: pass — 確定だけが反映、スキップ・Esc は反映しない。
- AC-I3: pass（部分）— 見出しは `tabindex=-1`、選択は label 付きの select・radio・checkbox・button（Tab で辿れるネイティブの要素）、Esc でスキップ。**Tab が案内の中だけを巡ること（ネイティブの dialog のフォーカスの閉じ込め）は確かめていない**。
- AC-I4: pass — 開くと見出しへフォーカス（コンポーネントテストと実物の Chromium の両方）。**Esc で閉じると端末へフォーカスが戻り、クリックせずに打った文字が PTY まで届く**ことを起動確認で確かめた（負の確認つき）。
- AC-I5: pass（部分）— 開いている間 `view.openDialog` が埋まる（`main.ts` の watch で KeyRouter が dialog モード）。案内が開いている間は端末のクリックが遮られることを、ラウンド 1 の起動確認の失敗として観測した。**開いている間に打った文字が端末へ届かないことは自動では確かめていない**（手順は docs/verification.md）。

## 起動確認（smoke）

```
smoke: 20260926-settings-onboarding
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:39262 (state dir /tmp/wtm-smoke-DEJnoq)
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
smoke(web): 初めてのブラウザで、はじめの案内が端末の表示のあとに開き、見出しにフォーカスがある
smoke(web): Esc で閉じると端末へフォーカスが戻り、案内済みだけが保存される
smoke(web): 開き直しても、はじめの案内は出ない
smoke(web): はじめの案内を閉じたあと、クリックせずに打った文字が PTY まで届いた
smoke: PASS
$ pnpm --filter @wtm/cli run smoke

> @wtm/cli@0.1.0 smoke /workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/cli
> node --enable-source-maps dist/smoke.js

smoke(cli): temp server state dir /tmp/wtmctl-smoke-state-gEh8Pv, sandboxed HOME /tmp/wtmctl-smoke-home-KawJMN
smoke(cli): server listening on http://127.0.0.1:39092
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): PASS
$ d=$(mktemp -d) && mkdir -p "$d/sessions/smoke" && node packages/server/dist/main.js token reset --session smoke --state-dir "$d" && test -f "$d/sessions/smoke/auth.json" && node packages/server/dist/main.js session list --state-dir "$d" | grep -q '^smoke ' && node packages/server/dist/main.js session delete smoke --state-dir "$d" && test ! -e "$d/sessions/smoke"; rc=$?; rm -rf "$d"; exit $rc
wtm: new token: <伏せた（一時ディレクトリの使い捨ての token）>
wtm: deleted session smoke (/tmp/tmp.evK50dthnn/sessions/smoke)
smoke: pass (exit 0, 3 本)
```


## 負の確認（`.aidev/conventions/regression-negative-control.md`）

足した箇所を 1 つずつ壊し（`mutate.py` が 1 変異ずつ当てて vitest を走らせ、元に戻して `cmp` で一致を確かめる）、テストが落ちることを確かめた。下は出力をそのまま差し込んだもの。

### T1（`store/onboarding.ts`・キーの定数）— 1 回目（`npx vitest run src/store/onboarding.test.ts`）

```
M1 [null storage を true に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × localStorage を取れない（null）・読むと throw する環境では false 32ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > localStorage を取れない（null）・読むと throw する環境では false
M2 [キー一覧の印を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × キー一覧の案内の表示済みの印 があれば false（既存の利用者） 71ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > キー一覧の案内の表示済みの印 があれば false（既存の利用者）
M3 [既読を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × エージェントの既読の記録 があれば false（既存の利用者） 46ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > エージェントの既読の記録 があれば false（既存の利用者）
M4 [prefs が無いとき false] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 13 passed (15)
    × 3 つの痕跡がどれも無いときだけ true 188ms
    × 作った時点の localStorage で判定する（あとで痕跡が書かれても変わらない） 197ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > 3 つの痕跡がどれも無いときだけ true
M5 [壊れた prefs を true に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  3 failed | 12 passed (15)
    × 壊れた wtm.prefs.v1（配列）は痕跡があるとみなして false 44ms
    × 壊れた wtm.prefs.v1（null）は痕跡があるとみなして false 4ms
    × 壊れた wtm.prefs.v1（文字列）は痕跡があるとみなして false 3ms
M6 [配列を許す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × 壊れた wtm.prefs.v1（配列）は痕跡があるとみなして false 133ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > 壊れた wtm.prefs.v1（配列）は痕跡があるとみなして false
M7 [キーの数を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  3 failed | 12 passed (15)
    × 保存された設定 があれば false（既存の利用者） 135ms
    × 案内済み があれば false（既存の利用者） 26ms
    × markDone は onboarding: false を書き、次の起動では出さない（AC5） 41ms
M8 [throw を true に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 13 passed (15)
    × 壊れた wtm.prefs.v1（JSON でない）は痕跡があるとみなして false 113ms
    × localStorage を取れない（null）・読むと throw する環境では false 15ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > 壊れた wtm.prefs.v1（JSON でない）は痕跡があるとみなして false
M9 [markDone が pending を下ろさない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × markDone は onboarding: false を書き、次の起動では出さない（AC5） 221ms
    FAIL  src/store/onboarding.test.ts > useOnboardingStore > markDone は onboarding: false を書き、次の起動では出さない（AC5）
M10 [markDone が書かない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × markDone は onboarding: false を書き、次の起動では出さない（AC5） 88ms
    FAIL  src/store/onboarding.test.ts > useOnboardingStore > markDone は onboarding: false を書き、次の起動では出さない（AC5）
M11 [markStartupOpened が立てない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × markStartupOpened は起動時に開いた印を立てる 54ms
    FAIL  src/store/onboarding.test.ts > useOnboardingStore > markStartupOpened は起動時に開いた印を立てる
M12 [判定を毎回読み直す（作った時点で固定しない）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  3 failed | 12 passed (15)
    × 作った時点の localStorage で判定する（あとで痕跡が書かれても変わらない） 204ms
    × 既存の利用者のブラウザでは false で、判定は何も書かない（AC2） 34ms
    × markDone は onboarding: false を書き、次の起動では出さない（AC5） 23ms
M13 [hint キーの値を変える] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × キー一覧の案内の表示済みの印 があれば false（既存の利用者） 72ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > キー一覧の案内の表示済みの印 があれば false（既存の利用者）
M14 [seen キーの値を変える] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × エージェントの既読の記録 があれば false（既存の利用者） 141ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > エージェントの既読の記録 があれば false（既存の利用者）
```

### T1 — タスク点検の指摘（D8）で判定を直したあとの行（同じテスト）

```
M1 [prefs の有無を逆に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  10 failed | 5 passed (15)
    × 3 つの痕跡がどれも無いときだけ true 40ms
    × wtm.prefs.v1 は中身が空のオブジェクトでも痕跡（キーを既定に戻した利用者は {} が残る） 3ms
    × 保存された設定 があれば false（既存の利用者） 3ms
M2 [prefs を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  8 failed | 7 passed (15)
    × wtm.prefs.v1 は中身が空のオブジェクトでも痕跡（キーを既定に戻した利用者は {} が残る） 22ms
    × 保存された設定 があれば false（既存の利用者） 3ms
    × 案内済み があれば false（既存の利用者） 2ms
M3 [prefs の中身が空なら痕跡としない（直す前の形）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 14 passed (15)
    × wtm.prefs.v1 は中身が空のオブジェクトでも痕跡（キーを既定に戻した利用者は {} が残る） 31ms
    FAIL  src/store/onboarding.test.ts > isFreshBrowser（20260926-settings-onboarding の AC1・AC2・AC8） > wtm.prefs.v1 は中身が空のオブジェクトでも痕跡（キーを既定に戻した利用者は {} が残る）
```

### T2（`OnboardingDialog.vue` の骨組み・`App.vue`）— `npx vitest run src/components/OnboardingDialog.test.ts src/App.test.ts`

```
M1 [pending を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 24 passed (26)
    × 既存の利用者のブラウザでは開かず、保存値も変えない 25ms
    × スキップのあと、次の起動では開かない（AC5） 19ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > 既存の利用者のブラウザでは開かず、保存値も変えない
M2 [起動時に開いた印を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 閉じないまま（案内済みにならないまま）再接続しても、2 回目は開かない 21ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > 閉じないまま（案内済みにならないまま）再接続しても、2 回目は開かない
M3 [接続の open を待たない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 痕跡の無いブラウザでは、接続が open になってから開く（それまでは開かない） 58ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > 痕跡の無いブラウザでは、接続が open になってから開く（それまでは開かない）
M4 [ほかのダイアログを待たない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × ほかのダイアログが開いている間は待ち、閉じたら開く 24ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > ほかのダイアログが開いている間は待ち、閉じたら開く
M5 [開いた印を立てない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 24 passed (26)
    × 1 回の読み込みで起動時に開くのは 1 回だけ（再接続しても開き直さない） 28ms
    × 閉じないまま（案内済みにならないまま）再接続しても、2 回目は開かない 12ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > 1 回の読み込みで起動時に開くのは 1 回だけ（再接続しても開き直さない）
M6 [起動時に開かない] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  7 failed | 19 passed (26)
    × 痕跡の無いブラウザでは、接続が open になってから開く（それまでは開かない） 87ms
    × ほかのダイアログが開いている間は待ち、閉じたら開く 11ms
    × 背景（ダイアログ自身）のクリックでは閉じない 7ms
M7 [immediate を外す] SURVIVED exit=0 restored_cmp=identical
    Test Files  2 passed (2)
    Tests  26 passed (26)
M8 [showModal しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 痕跡の無いブラウザでは、接続が open になってから開く（それまでは開かない） 99ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > 痕跡の無いブラウザでは、接続が open になってから開く（それまでは開かない）
M9 [見出しへフォーカスしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 開いたら見出しへフォーカスし、見出しは Tab の順には入らない（tabindex=-1） 33ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — フォーカス（AC-I3・AC-I4・AC-I5） > 開いたら見出しへフォーカスし、見出しは Tab の順には入らない（tabindex=-1）
M10 [閉じるとき close しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × ［スキップ］で閉じ、案内済みだけを保存する（ほかの保存値は書かない） 26ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — スキップ・Esc・背景（AC4・AC5・AC-I1・AC-I2） > ［スキップ］で閉じ、案内済みだけを保存する（ほかの保存値は書かない）
M11 [スキップで案内済みにしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  3 failed | 23 passed (26)
    × ［スキップ］で閉じ、案内済みだけを保存する（ほかの保存値は書かない） 41ms
    × Esc（ネイティブの cancel）はスキップと同じで、既定の close は止める 13ms
    × スキップのあと、次の起動では開かない（AC5） 27ms
M12 [スキップで閉じない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  4 failed | 22 passed (26)
    × 1 回の読み込みで起動時に開くのは 1 回だけ（再接続しても開き直さない） 18ms
    × ［スキップ］で閉じ、案内済みだけを保存する（ほかの保存値は書かない） 12ms
    × Esc（ネイティブの cancel）はスキップと同じで、既定の close は止める 7ms
M13 [cancel の既定を止めない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × Esc（ネイティブの cancel）はスキップと同じで、既定の close は止める 41ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — スキップ・Esc・背景（AC4・AC5・AC-I1・AC-I2） > Esc（ネイティブの cancel）はスキップと同じで、既定の close は止める
M14 [cancel でスキップしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × Esc（ネイティブの cancel）はスキップと同じで、既定の close は止める 29ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — スキップ・Esc・背景（AC4・AC5・AC-I1・AC-I2） > Esc（ネイティブの cancel）はスキップと同じで、既定の close は止める
M15 [背景クリックで閉じる] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 背景（ダイアログ自身）のクリックでは閉じない 51ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — スキップ・Esc・背景（AC4・AC5・AC-I1・AC-I2） > 背景（ダイアログ自身）のクリックでは閉じない
M16 [見出しの tabindex を外す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 開いたら見出しへフォーカスし、見出しは Tab の順には入らない（tabindex=-1） 47ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — フォーカス（AC-I3・AC-I4・AC-I5） > 開いたら見出しへフォーカスし、見出しは Tab の順には入らない（tabindex=-1）
M17 [aria-labelledby を外す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 開いたら見出しへフォーカスし、見出しは Tab の順には入らない（tabindex=-1） 75ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — フォーカス（AC-I3・AC-I4・AC-I5） > 開いたら見出しへフォーカスし、見出しは Tab の順には入らない（tabindex=-1）
M18 [App に置かない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 25 passed (26)
    × 本体に置かれ、痕跡の無いブラウザで接続が open になると開く 170ms
    FAIL  src/App.test.ts > App — はじめの案内 > 本体に置かれ、痕跡の無いブラウザで接続が open になると開く
```

M7 が生き残ったので「置かれた時点で接続がすでに open なら、すぐ開く」を足し、同じ変異をやり直した:

```
M1 [immediate を外す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 26 passed (27)
    × 置かれた時点で接続がすでに open なら（ログインし直した後に本体が描かれた等）、すぐ開く 30ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 起動時に開く（AC1・AC2・AC5） > 置かれた時点で接続がすでに open なら（ログインし直した後に本体が描かれた等）、すぐ開く
```

### T3（選択と確定の反映・`markHintAnswered`）— `npx vitest run src/components/OnboardingDialog.test.ts src/notify/NotificationController.test.ts`

```
M1 [OS 通知を外すを反映しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 入れていた OS 通知を外して確定すると切る 53ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 入れていた OS 通知を外して確定すると切る
M2 [許可済みでも求める] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × すでに許可されていれば、求めずに入れる 29ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > すでに許可されていれば、求めずに入れる
M3 [許可を求めない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 104 passed (106)
    × 許可がまだなら、確定の操作の中で許可を求め、許可されたら入れる 22ms
    × 許可されなかったら入れず、理由をトーストで知らせる 21ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可がまだなら、確定の操作の中で許可を求め、許可されたら入れる
M4 [OS 通知の変化を見ない（常に同じ扱い）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 入れていた OS 通知を外して確定すると切る 35ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 入れていた OS 通知を外して確定すると切る
M5 [音の解除をしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する 73ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する
M6 [音を反映しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する 102ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する
M7 [音を変化でなく常に反映] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く 75ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く
M8 [トーストを反映しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する 69ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する
M9 [通知の保存をしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  3 failed | 103 passed (106)
    × トースト・音を変えて確定すると通知の保存値になり、音を入れたら自動再生を解除する 78ms
    × すでに許可されていれば、求めずに入れる 38ms
    × 入れていた OS 通知を外して確定すると切る 29ms
M10 [通知を変化が無くても保存] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く 55ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く
M11 [テーマを反映しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く 31ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く
M12 [テーマを変えなくても setTheme] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 何も変えずに確定すると、案内済みのほかは保存値を変えない（自動の切替も外さない） 47ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > 何も変えずに確定すると、案内済みのほかは保存値を変えない（自動の切替も外さない）
M13 [プリセットを反映しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 104 passed (106)
    × キーのプリセットを選んで確定すると、設定画面の［足す］と同じ割り当てが保存される 42ms
    × プリセットで足せなかった分があれば、件数をトーストで知らせる 33ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > キーのプリセットを選んで確定すると、設定画面の［足す］と同じ割り当てが保存される
M14 [プリセットの保存をしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × キーのプリセットを選んで確定すると、設定画面の［足す］と同じ割り当てが保存される 44ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > キーのプリセットを選んで確定すると、設定画面の［足す］と同じ割り当てが保存される
M15 [足せなかった分を知らせない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × プリセットで足せなかった分があれば、件数をトーストで知らせる 51ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > プリセットで足せなかった分があれば、件数をトーストで知らせる
M16 [案内に答えた扱いにしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 確定すると OS 通知の案内に答えた扱いにする。スキップでは触らない 21ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 確定すると OS 通知の案内に答えた扱いにする。スキップでは触らない
M17 [確定で案内済みにしない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 104 passed (106)
    × 何も変えずに確定すると、案内済みのほかは保存値を変えない（自動の切替も外さない） 38ms
    × テーマを選んで確定すると、設定画面で選んだのと同じ保存値になり、その場で効く 25ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > 何も変えずに確定すると、案内済みのほかは保存値を変えない（自動の切替も外さない）
M18 [確定で閉じない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 104 passed (106)
    × 何も変えずに確定すると、案内済みのほかは保存値を変えない（自動の切替も外さない） 39ms
    × 許可がまだなら、確定の操作の中で許可を求め、許可されたら入れる 10ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > 何も変えずに確定すると、案内済みのほかは保存値を変えない（自動の切替も外さない）
M19 [許可されても入れない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 許可がまだなら、確定の操作の中で許可を求め、許可されたら入れる 24ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可がまだなら、確定の操作の中で許可を求め、許可されたら入れる
M20 [拒否を知らせない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 許可されなかったら入れず、理由をトーストで知らせる 23ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可されなかったら入れず、理由をトーストで知らせる
M21 [開くとき許可を読み直さない] SURVIVED exit=0 restored_cmp=identical
    Test Files  2 passed (2)
    Tests  106 passed (106)
M22 [開くとき下書きを作り直さない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 開き直すと、現在の設定から始める（前回の選びかけを持ち越さない） 41ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 選択の初期値（AC3・AC6） > 開き直すと、現在の設定から始める（前回の選びかけを持ち越さない）
M23 [開くとき initial を控えない] SURVIVED exit=0 restored_cmp=identical
    Test Files  2 passed (2)
    Tests  106 passed (106)
M24 [OS 通知の初期値で許可を見ない] SURVIVED exit=0 restored_cmp=identical
    Test Files  2 passed (2)
    Tests  106 passed (106)
M25 [拒否でも押せる] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 許可が denied なら OS 通知の選択を押せず、理由を添える 32ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可が denied なら OS 通知の選択を押せず、理由を添える
M26 [音を鳴らせなくても押せる] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 105 passed (106)
    × 音を鳴らせない環境では音の選択を押せない 19ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 音を鳴らせない環境では音の選択を押せない
M27 [注記を結ばない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 104 passed (106)
    × 許可が denied なら OS 通知の選択を押せず、理由を添える 39ms
    × 許可が unsupported なら OS 通知の選択を押せず、理由を添える 18ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可が denied なら OS 通知の選択を押せず、理由を添える
M28 [markHintAnswered が消費しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  2 failed | 104 passed (106)
    × markHintAnswered：出ている案内を消して消費する（設定は変えない） 33ms
    × markHintAnswered：まだ出ていなくても、以後の知らせで案内を出さない 8ms
    FAIL  src/notify/NotificationController.test.ts > NotificationController — 案内（AC5） > markHintAnswered：出ている案内を消して消費する（設定は変えない）
```

M21・M23・M24 が生き残ったので、「許可の状態は開くたびに読み直す」「置いたあとで設定が変わっても、開いた時点の値を基準にする」「保存が「入」でも許可が無ければ選択は外れて見え、何も変えずに確定しても保存値は変えない」を足し、同じ変異をやり直した:

```
M1 [開くとき許可を読み直さない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 108 passed (109)
    × 許可の状態は開くたびに読み直す（置いたあとで拒否に変わっていれば押せない） 36ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可の状態は開くたびに読み直す（置いたあとで拒否に変わっていれば押せない）
M2 [開くとき initial を控えない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 108 passed (109)
    × 置いたあとで設定が変わっても、開いた時点の値を基準にする（何も変えずに確定しても自動の切替を外さない） 40ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > 置いたあとで設定が変わっても、開いた時点の値を基準にする（何も変えずに確定しても自動の切替を外さない）
M3 [OS 通知の初期値で許可を見ない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 108 passed (109)
    × 保存が「入」でも許可が無ければ選択は外れて見え、何も変えずに確定しても保存値は変えない 40ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 保存が「入」でも許可が無ければ選択は外れて見え、何も変えずに確定しても保存値は変えない
```

### T3 — タスク点検の指摘（OS の明暗に合わせている間のテーマの選び直し）を直した分

```
M1 [触ったかを見ない（値の比較だけ）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 41 passed (42)
    × OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする 40ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする
M2 [合わせていなくても触れば setTheme] SURVIVED exit=0 restored_cmp=identical
    Test Files  1 passed (1)
    Tests  42 passed (42)
M3 [触った印を立てない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 41 passed (42)
    × OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする 28ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする
M4 [開くとき触った印を下ろさない] SURVIVED exit=0 restored_cmp=identical
    Test Files  1 passed (1)
    Tests  42 passed (42)
M5 [注記を出さない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 41 passed (42)
    × OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする 139ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする
M6 [注記を結ばない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 41 passed (42)
    × OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする 33ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > OS の明暗に合わせている間は注記を添え、同じテーマを選び直して確定すると合わせるのをやめてそのテーマにする
```

M2・M4 が生き残ったので、「合わせていないときに同じテーマを選び直しても、保存値は増えない」「前に開いたときの選び直しを持ち越さない」を足し、同じ変異をやり直した:

```
M1 [合わせていなくても触れば setTheme] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × 合わせていないときに同じテーマを選び直しても、保存値は増えない 198ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > 合わせていないときに同じテーマを選び直しても、保存値は増えない
M2 [開くとき触った印を下ろさない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × 前に開いたときの選び直しを持ち越さない（開き直して触らずに確定すれば、合わせたまま） 116ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 確定の反映（AC3・AC-I2） > 前に開いたときの選び直しを持ち越さない（開き直して触らずに確定すれば、合わせたまま）
```

### T4（主要な操作の入口の説明・モバイル）— `npx vitest run src/components/OnboardingDialog.test.ts`

```
M1 [モバイルを判定しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × キーの説明とプリセットを出さず、上のバーの［設定］を案内する。画面上のボタンで確定・スキップできる 40ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — モバイル（AC10） > キーの説明とプリセットを出さず、上のバーの［設定］を案内する。画面上のボタンで確定・スキップできる
M2 [常にモバイル扱い] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  8 failed | 36 passed (44)
    × 初回は既定（テーマは既定・プリセットは使わない・通知はトーストだけ） 67ms
    × キーのプリセットを選んで確定すると、設定画面の［足す］と同じ割り当てが保存される 24ms
    × プリセットで足せなかった分があれば、件数をトーストで知らせる 40ms
M3 [キー一覧の割り当てなしの経路を書かない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × 割り当てが無い操作は、キーを書かずにサイドバーのメニューの経路を書く 42ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > 割り当てが無い操作は、キーを書かずにサイドバーのメニューの経路を書く
M4 [設定の割り当てなしの経路を書かない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × 割り当てが無い操作は、キーを書かずにサイドバーのメニューの経路を書く 80ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > 割り当てが無い操作は、キーを書かずにサイドバーのメニューの経路を書く
M5 [キー一覧を固定の表記に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 42 passed (44)
    × 割り当てを変えると、その割り当てで書く 71ms
    × 割り当てが無い操作は、キーを書かずにサイドバーのメニューの経路を書く 59ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > 割り当てを変えると、その割り当てで書く
M6 [設定を固定の表記に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 42 passed (44)
    × 割り当てを変えると、その割り当てで書く 219ms
    × 割り当てが無い操作は、キーを書かずにサイドバーのメニューの経路を書く 100ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > 割り当てを変えると、その割り当てで書く
M7 [prefix を固定の表記に] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × 割り当てを変えると、その割り当てで書く 78ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > 割り当てを変えると、その割り当てで書く
M8 [プリセットをモバイルでも出す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 43 passed (44)
    × キーの説明とプリセットを出さず、上のバーの［設定］を案内する。画面上のボタンで確定・スキップできる 42ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — モバイル（AC10） > キーの説明とプリセットを出さず、上のバーの［設定］を案内する。画面上のボタンで確定・スキップできる
M9 [連携の案内を消す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 42 passed (44)
    × エージェント連携は設定にあることと、この案内を設定から開き直せることを書く 154ms
    × 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない 5400ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > エージェント連携は設定にあることと、この案内を設定から開き直せることを書く
```

### T4 — タスク点検の指摘（マウスの操作の行が網の外）で足したテスト

```
M1 [マウスの操作の行を消す] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 45 passed (46)
    × デスクトップではマウスの操作（サイドバーのクリック・境界のドラッグ・右クリックのメニュー）を書く 341ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 主要な操作の入口（AC7） > デスクトップではマウスの操作（サイドバーのクリック・境界のドラッグ・右クリックのメニュー）を書く
M2 [モバイルでもマウスの行を出す（v-if を外す）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  no tests
    FAIL  src/components/OnboardingDialog.test.ts [ src/components/OnboardingDialog.test.ts ]
```

M2 はテンプレートのコンパイルエラー（`v-else` の相手が消える）で落ちただけで、振る舞いを捕まえたとは言えないので、`v-if` を常に真にする変異でやり直した:

```
M1 [モバイルでもデスクトップの説明を出す（v-if を常に真に）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 44 passed (46)
    × キーの説明とプリセットを出さず、上のバーの［設定］を案内する。画面上の［この設定ではじめる］で閉じる 48ms
    × モバイルでも画面上の［スキップ］で閉じ、何も反映しない 34ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — モバイル（AC10） > キーの説明とプリセットを出さず、上のバーの［設定］を案内する。画面上の［この設定ではじめる］で閉じる
```

### T5（設定画面の［はじめの案内を開く］）— `npx vitest run src/components/SettingsDialog.test.ts src/components/OnboardingDialog.test.ts`

```
M1 [ボタンを押しても開かない] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  2 failed | 131 passed (133)
    × 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない 515ms
    × ［はじめの案内を開く］で案内に切り替わり、設定画面は閉じる 522ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 設定画面から開き直す（AC6） > 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない
M2 [ボタンが設定を開き直す] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  2 failed | 131 passed (133)
    × 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない 567ms
    × ［はじめの案内を開く］で案内に切り替わり、設定画面は閉じる 175ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 設定画面から開き直す（AC6） > 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない
M3 [ボタンを置かない] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  2 failed | 131 passed (133)
    × 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない 412ms
    × ［はじめの案内を開く］で案内に切り替わり、設定画面は閉じる 307ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 設定画面から開き直す（AC6） > 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない
```

### T5 — タスク点検の指摘（案内へ切り替える前に打ちかけのパスを確定する）を直した分

```
M1 [案内へ切り替える前にパスを確定しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed | 1 passed (2)
    Tests  1 failed | 135 passed (136)
    × 打ちかけの「指定した場所」は、案内へ切り替える前に保存する（閉じる経路と同じ） 156ms
    FAIL  src/components/SettingsDialog.test.ts > SettingsDialog — はじめの案内を開く > 打ちかけの「指定した場所」は、案内へ切り替える前に保存する（閉じる経路と同じ）
M2 [ボタンを押しても開かない] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  2 failed | 134 passed (136)
    × 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない 300ms
    × ［はじめの案内を開く］で案内に切り替わり、設定画面は閉じる 289ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — 設定画面から開き直す（AC6） > 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない
```

### cross 点検の指摘（画面幅と指の操作の判定を分ける。D9）— `npx vitest run src/components/OnboardingDialog.test.ts`

```
M1 [説明の出し分けを指の操作の判定に戻す（直す前の形）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 46 passed (48)
    × 狭くしたデスクトップの窓（1 列の画面・指の操作ではない）では、上のバーを案内し、プリセットは出す 73ms
    × 幅の広いタブレット（指の操作・1 列ではない）では、サイドバーの説明を出し、プリセットは出さない 28ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — モバイル（AC10・D9） > 狭くしたデスクトップの窓（1 列の画面・指の操作ではない）では、上のバーを案内し、プリセットは出す
M2 [プリセットの出し分けを画面幅の判定にする] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 46 passed (48)
    × 狭くしたデスクトップの窓（1 列の画面・指の操作ではない）では、上のバーを案内し、プリセットは出す 63ms
    × 幅の広いタブレット（指の操作・1 列ではない）では、サイドバーの説明を出し、プリセットは出さない 169ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — モバイル（AC10・D9） > 狭くしたデスクトップの窓（1 列の画面・指の操作ではない）では、上のバーを案内し、プリセットは出す
M3 [指の操作を判定しない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  2 failed | 46 passed (48)
    × 1 列の画面では、マウスとキーの説明の代わりに上のバーの［設定］を案内し、画面上の［この設定ではじめる］で閉じる 63ms
    × 幅の広いタブレット（指の操作・1 列ではない）では、サイドバーの説明を出し、プリセットは出さない 43ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — モバイル（AC10・D9） > 1 列の画面では、マウスとキーの説明の代わりに上のバーの［設定］を案内し、画面上の［この設定ではじめる］で閉じる
```

## 失敗の証跡

### test ラウンド 1（2026-09-26）— 起動確認（`aidev smoke`）が失敗

単体は全体で 2 回通った（下の「実行したもの」）が、`aidev smoke` の 1 本目（ビルドした `wtm` とブラウザでの一巡）が、**新しいプロファイルのブラウザで開いたはじめの案内が端末のクリックを遮って**失敗した。smoke と E2E（`packages/e2e`）はどれも localStorage の空の新しい context で開くので、同じことが E2E 一式でも起きる。出力（色の制御文字だけ除いた）:

```
smoke: 20260926-settings-onboarding
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:39386 (state dir /tmp/wtm-smoke-J0tPwS)
{"ts":"2026-09-26T09:42:29.959Z","level":"info","msg":"agent manifests loaded","ok":22,"total":22}
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
smoke: FAIL locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.xterm-helper-textarea')
    - locator resolved to <textarea tabindex="0" autocorrect="off" spellcheck="false" autocapitalize="off" aria-multiline="false" aria-label="Terminal input" class="xterm-helper-textarea"></textarea>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p data-v-4f7354bb="" class="onboarding-lead"> コーディングエージェントのための、ブラウザで使う端末のワークスペースです。 </p> from <dialog open="" data-v-4f7354bb="" class="onboarding-dialog" aria-labelledby="onboarding-title">…</dialog> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p data-v-4f7354bb="" class="onboarding-lead"> コーディングエージェントのための、ブラウザで使う端末のワークスペースです。 </p> from <dialog open="" data-v-4f7354bb="" class="onboarding-dialog" aria-labelledby="onboarding-title">…</dialog> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    50 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <p data-v-4f7354bb="" class="onboarding-lead"> コーディングエージェントのための、ブラウザで使う端末のワークスペースです。 </p> from <dialog open="" data-v-4f7354bb="" class="onboarding-dialog" aria-labelledby="onboarding-title">…</dialog> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

    at checkWebUiRendersAndAcceptsInput (/workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/server/src/smoke.ts:148:50)
    at async main (/workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/server/src/smoke.ts:221:5) {
  log: [
    "  - waiting for locator('.xterm-helper-textarea')",
    '    - locator resolved to <textarea tabindex="0" autocorrect="off" spellcheck="false" autocapitalize="off" aria-multiline="false" aria-label="Terminal input" class="xterm-helper-textarea"></textarea>',
    '  - attempting click action',
    '    2 × waiting for element to be visible, enabled and stable',
    '      - element is visible, enabled and stable',
    '      - scrolling into view if needed',
    '      - done scrolling',
    '      - <p data-v-4f7354bb="" class="onboarding-lead"> コーディングエージェントのための、ブラウザで使う端末のワークスペースです。 </p> from <dialog open="" data-v-4f7354bb="" class="onboarding-dialog" aria-labelledby="onboarding-title">…</dialog> subtree intercepts pointer events',
    '    - retrying click action',
    '    - waiting 20ms',
    '    2 × waiting for element to be visible, enabled and stable',
    '      - element is visible, enabled and stable',
    '      - scrolling into view if needed',
    '      - done scrolling',
    '      - <p data-v-4f7354bb="" class="onboarding-lead"> コーディングエージェントのための、ブラウザで使う端末のワークスペースです。 </p> from <dialog open="" data-v-4f7354bb="" class="onboarding-dialog" aria-labelledby="onboarding-title">…</dialog> subtree intercepts pointer events',
    '    - retrying click action',
    '      - waiting 100ms',
    '    50 × waiting for element to be visible, enabled and stable',
    '       - element is visible, enabled and stable',
    '       - scrolling into view if needed',
    '       - done scrolling',
    '       - <p data-v-4f7354bb="" class="onboarding-lead"> コーディングエージェントのための、ブラウザで使う端末のワークスペースです。 </p> from <dialog open="" data-v-4f7354bb="" class="onboarding-dialog" aria-labelledby="onboarding-title">…</dialog> subtree intercepts pointer events',
    '     - retrying click action',
    '       - waiting 500ms'
  ],
  name: 'TimeoutError'
}
smoke: fail (exit 1, 3 本)
```

### 差し戻し後（D11）— `navigator.webdriver` の判定の変異（`npx vitest run src/store/onboarding.test.ts src/App.test.ts`）

```
M1 [自動操作でも出す（webdriver を見ない）] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  2 failed | 29 passed (31)
    × 自動操作されているブラウザ（navigator.webdriver）では、痕跡が無くても出さない（D11） 59ms
    × 自動操作されているブラウザ（navigator.webdriver）では開かない（起動確認・E2E を遮らない。D11） 293ms
    FAIL  src/App.test.ts > App — はじめの案内 > 自動操作されているブラウザ（navigator.webdriver）では開かない（起動確認・E2E を遮らない。D11）
M2 [webdriver の判定を逆に] DETECTED exit=1 restored_cmp=identical
    Test Files  2 failed (2)
    Tests  5 failed | 26 passed (31)
    × 作った時点の localStorage で判定する（あとで痕跡が書かれても変わらない） 56ms
    × markDone は onboarding: false を書き、次の起動では出さない（AC5） 4ms
    × 自動操作されているブラウザ（navigator.webdriver）では、痕跡が無くても出さない（D11） 3ms
```

### 差し戻し後（D11）— 起動確認の新しい段の負の確認

`OnboardingDialog.vue` の起動時の条件から `view.connectionState === "open" &&` を `true &&` に替え（接続を待たずに開く）、`pnpm -s build && pnpm -s smoke` を流した。案内がログイン前の本体の描画で開いて消費され、ブラウザでは二度と開かず、新しい段が検知した（design D6 の実害の形）。戻したあと `cmp` で一致を確かめ、ビルドし直した。出力（Playwright の呼び出しログの字下げ行は省いた）:

```
smoke: starting server on 127.0.0.1:39798 (state dir /tmp/wtm-smoke-XZGj8P)
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
smoke: FAIL page.waitForSelector: Timeout 15000ms exceeded.
Call log:

}
exit=1
```

### 差し戻し後（D11）— 起動確認の「Esc で閉じると端末へフォーカスが戻る」の負の確認（T7 のタスク点検の指摘）

`OnboardingDialog.vue` の閉じる処理（`dialogEl.value?.close();` の直後）に `(document.activeElement as HTMLElement | null)?.blur();` を足し（案内は開くが、閉じてもフォーカスが端末へ戻らない形）、`pnpm -s build && pnpm -s smoke` を流した。戻したあと `cmp` で一致を確かめ、ビルドし直した:

```
smoke: starting server on 127.0.0.1:39784 (state dir /tmp/wtm-smoke-D4LGry)
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
smoke(web): 初めてのブラウザで、はじめの案内が端末の表示のあとに開き、見出しにフォーカスがある
smoke: FAIL Error: focus did not return to the terminal after closing onboarding: {"focusedClass":"","prefs":"{\"onboarding\":false}"}
    at checkOnboardingInRealBrowser (/workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/server/src/smoke.ts:191:13)
    at async main (/workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/server/src/smoke.ts:279:5)
exit=1
```

### review ラウンド 1 の差し戻しの修正 — `npx vitest run src/components/OnboardingDialog.test.ts`

```
M1 [置き直しで描き直さない（dialogContext の watch の immediate を外す）] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 49 passed (50)
    × 開いている間に外され（ログイン画面へ切り替わる等）、置き直されたら、案内を描き直す 75ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — フォーカス（AC-I3・AC-I4・AC-I5） > 開いている間に外され（ログイン画面へ切り替わる等）、置き直されたら、案内を描き直す
M2 [拒否と閉じただけで文を分けない] DETECTED exit=1 restored_cmp=identical
    Test Files  1 failed (1)
    Tests  1 failed | 49 passed (50)
    × 許可の答えが default なら入れず、答えに合わせた理由をトーストで知らせる 25ms
    FAIL  src/components/OnboardingDialog.test.ts > OnboardingDialog — OS 通知と案内（AC9） > 許可の答えが default なら入れず、答えに合わせた理由をトーストで知らせる
```

### review ラウンド 1 の差し戻しの修正 — 起動確認の「再読み込みのあと案内が出ない」の負の確認

`store/onboarding.ts` の起動時の判定から `isFreshBrowser(...)` を外し（案内済みでも出す形）、`pnpm -s build && pnpm -s smoke` を流した。戻したあと `cmp` で一致を確かめ、ビルドし直した:

```
smoke: starting server on 127.0.0.1:39460 (state dir /tmp/wtm-smoke-tqy2QB)
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
smoke(web): 初めてのブラウザで、はじめの案内が端末の表示のあとに開き、見出しにフォーカスがある
smoke(web): Esc で閉じると端末へフォーカスが戻り、案内済みだけが保存される
smoke: FAIL Error: onboarding opened again after it was marked done
    at checkOnboardingInRealBrowser (/workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/server/src/smoke.ts:213:77)
    at async main (/workspaces/web-tn-multiplexer-wt/settings-onboarding/packages/server/src/smoke.ts:287:5)
exit=1
```

### test ラウンド 3（review ラウンド 1 の修正のあと）— 全体の 1 回目で、足したテストが高負荷で時間切れ

`pnpm -s test` の 1 回目（load average 21）で、この work で足した `OnboardingDialog.test.ts`「既存の利用者でも設定画面から開け…」（1200 行を超える `SettingsDialog.vue` と `KeySettings.vue` を実際に置く）が既定 5 秒で時間切れになった（既存の `composeServer.integration.test.ts` も同時に時間切れ）。2 回目は 3363 passed。高負荷で落ちるテストをこの work で増やさないため、この it だけ上限を 15 秒にした（同じ形の先例: `composeServer.integration.test.ts:256` の `15000`）。出力:

```
70: FAIL  |@wtm/web| src/components/OnboardingDialog.test.ts > OnboardingDialog — 設定画面から開き直す（AC6） > 既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない
71-Error: Test timed out in 5000ms.
72-If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
73- ❯ src/components/OnboardingDialog.test.ts:642:3
74-    640|
75-    641| describe("OnboardingDialog — 設定画面から開き直す（AC6）", () => {
76-    642|   it("既存の利用者でも設定画面から開け、スキップすれば設定は何も変わらない", async () => {
77-       |   ^
78-    643|     const prefs = { theme: "nord", notify: { toast: false, desktop: fa…
--
83: FAIL  |@wtm/server| src/composeServer.integration.test.ts > composeServer (integration) > 組み立て（composeServer）と listen() の間に token reset が走っても、listen() はロックの後に auth.json を読むので新しい token で動く（D103 の独立点検 #1）
84-Error: Test timed out in 5000ms.
85-If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
86- ❯ src/composeServer.integration.test.ts:258:3
87-    256|   }, 15000);
88-    257|
89-    258|   it("組み立て（composeServer）と listen() の間に token reset が走っても、listen() はロッ…
90-       |   ^
91-    259|     // 以前は組み立ての時点で auth.json を読んでいたため、その後・ロックの前に `wtm token reset`（ロック…
 Test Files  2 failed | 169 passed (171)
      Tests  2 failed | 3361 passed (3363)
```

## 未検証の穴（skip / 環境不足）

- E2E（`packages/e2e`）は走らせていない（利用者の方針）。E2E は自動操作のブラウザなので案内は出ない（D11）——既存の spec への影響は無い見込みだが、実行では確かめていない。
- 実機（iOS Safari・Android Chrome）とデスクトップの Firefox・Safari での見た目・はみ出し・フォーカスの戻りは確かめていない（起動確認は Chromium だけ）。`docs/verification.md` の手順で手で見る。
- ［この設定ではじめる］で閉じたときの端末へのフォーカスの戻りは、起動確認では Esc の経路だけを見ている（同じ `closeDialog` と `<dialog>` の `close()` を通る）。
- Tab が案内の中だけを巡ること、開いている間に打った文字が端末へ届かないことは、ネイティブの `<dialog>` の inert に任せており、自動では確かめていない。
- OS 通知の許可のダイアログ（ブラウザの本物の許可の問い合わせ）は偽の制御器で確かめた。
