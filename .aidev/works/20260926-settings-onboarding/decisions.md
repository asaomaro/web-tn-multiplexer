# 判断の記録（20260926-settings-onboarding）

## D1: backlog 行「外観と設定の残り（未着手分）」のうち H25b（設定の onboarding）だけを対象にする

- 背景: backlog 行（`.aidev/backlog/product-roadmap.md` の「外観と設定の残り（未着手分）」）は
  (1) サイドバー行の色の条件付け・独自トークン（H21）と (2) 設定の onboarding（H25b）の 2 つを含む。依頼者（親エージェント
  経由の利用者の指示）はこの work の対象を (2) に限った。依存 `(needs: 20260918-web-terminal-multiplexer)` は着地済みで充足している。
  別の worktree（`agent-prompt-send-keys`。主に `packages/cli`）が並行して進んでいる。
- 決定: この work は H25b（初回の案内）だけを扱う。H21 は対象外とし、deliver で backlog 行を `[x]`（H25b 分）と `[ ]`（H21）の
  兄弟に割って残す。
- 理由・代替案: 2 つは互いに独立した部品（サイドバーの行の色／初回の案内）で、1 PR にまとめる理由が無い。触るのは
  `packages/web` だけで、並行する work（`packages/cli`）とファイルが重ならない。
- 影響: 三層判定は full（新しいダイアログを足し、設定ストア・通知ストア・設定画面・起動の配線にまたがる）。利用者が操作する
  部品（ダイアログ）を作るので research を挟む（protocol「4.5」の 5 条件目）。

## D2: 案内の中身は「入口の説明＋テーマ・キーのプリセット・通知の選択」の 1 枚にする（herdr の現行版と 0.2 系の合成）

- 背景: herdr の現行版の案内は説明と［continue］だけで、続けると設定画面の連携の節を開く（requirements「背景」）。0.2 系は通知の選択だった
  （`CHANGELOG.md:1190`）。依頼は「初回に主要な選択を案内する」意図を既存の設定の仕組みで写すこと。
- 決定: 1 枚のダイアログに、herdr の説明（マウス・prefix・キー一覧・設定）と、テーマ・キーのプリセット・通知の選択を並べる。連携は
  「設定にある」と書くだけにする。
- 理由・代替案: (a) herdr と同じ説明だけ → 「主要な選択」を案内できない。(b) 複数ページのウィザード → ページ送りのキー処理・フォーカス管理が
  増え、項目は 3 つで 1 枚に収まる。(c) 連携の導入まで案内から押させる → サーバ全体のファイルを書き換える操作で、ブラウザごとの初回の
  案内から押させるには重い（requirements「対象外」）。
- 影響: 選択は下書きで持ち、確定で反映する（design「確定」）。

## D3: テーマのプレビューはしない

- 背景: 下書きで持つので、選んだだけでは画面の色が変わらない。
- 決定: プレビューしない。選択肢に明／暗の区別が分かる名前（設定画面と同じ `THEME_LABELS`）を出す。
- 理由・代替案: プレビューすると `ThemeController`（`settings.effectiveTheme` を見て当てる）に一時的な上書きの経路を足し、スキップで確実に
  戻す必要がある（戻し漏れは「スキップで何も変わらない」AC4 の破れ）。確定後すぐ見え、設定画面で即時に選び直せるので、初回の案内では
  見送る。
- 影響: 利用者は確定してから色を見る。docs に「あとで設定で選び直せる」と書く。

## D4: 既存の利用者の判定は 3 つの痕跡＋`onboarding` の有無で、起動時に 1 回・localStorage を直接読む

- 背景: `readPrefs` は読めない環境で `{}` を返し「空」と区別できない（research F10）。キー一覧の案内の印は初回の pane フォーカスで書かれ、
  同じ読み込みの中で判定すると初回の利用者を既存の利用者と誤る（research F9）。`wtm.themeBoot.v1` は起動のたびに書かれる（F8）。
- 決定: `store/onboarding.ts` の `isFreshBrowser` が `wtm.prefs.v1`（空オブジェクトは「無い」扱い）・`wtm.hint.prefixHelp.v1`・`wtm.seen.v1` を
  直接読み、どれも無いときだけ true。読めない・壊れているときは false。`main.ts` で接続より前にストアを作って判定を固定する。
  案内済みは `wtm.prefs.v1` の `onboarding: false`（herdr の名前・値）。
- 理由・代替案: 別キー（`wtm.onboarding.v1`）にすると、`writePrefs` に集める方針（`store/view.ts:49-53`）から外れる。
- 影響: 案内済みを書くと prefs が空でなくなるので、判定は「prefs が空か」だけで案内済みも兼ねる。

## D5: キーのプリセットはモバイルでは出さない

- 背景: モバイルは画面のキーボードで組み合わせのキーを取り込めない（`KeySettings.vue` の注記）。設定画面は節を出して一言添えている。
- 決定: 案内ではモバイルのときキーの行とプリセットの選択を出さない。
- 理由・代替案: 初回の案内は短く保つ。物理キーボードをつないだ利用者は設定画面の「キー」で足せる。
- 影響: AC10 のテストでモバイルのとき出ないことを確かめる。

## D6: 起動時の案内は、接続が最初に open になった後に開く

- 背景: 端末にフォーカスが入る前に `showModal()` すると、閉じたときネイティブの `<dialog>` が戻す先が body になり、端末へ入力できない
  （research F6）。`restoreView` は開いている間の焦点の移し直し（`retargetPreDialogFocus`）を通らない（F4・F5）。
- 決定: `connectionState === "open"` かつ `openDialog === null` になってから `nextTick` の後に開く。
- 理由・代替案: App の mount 直後に開く案は上の理由で退けた。`focusedPaneId` を待つ案は、pane が 1 つも無い状態（あり得るかは未確認）で
  永久に開かない。
- 影響: 実ブラウザでのフォーカスの戻り（xterm へ）は happy-dom で確かめられないので、test-result の「未検証の穴」に書く。

## D7: architecture は挟まず、subtask にも割らない

- 背景: protocol「4.5」の architecture の 4 条件と、tasks の split 判定。
- 決定: どちらも行わない。
- 理由・代替案: モジュール境界は動かさない（既存のダイアログ・ストアの形に 1 つ足すだけ。依存の向きも既存どおり `components → store`）。
  新しい構造・パターンの選択は無く、状態は「案内済み」の 1 つ。4 タスクで 1 PR に収まる。
- 影響: tasks → coding へ直行する。

## D8: `wtm.prefs.v1` は中身を見ず、あれば既存の利用者の痕跡とする（design の「空オブジェクトは無い扱い」を改める）

- 背景: T1 のタスク点検で、キーの割り当てを既定に戻すと `writePrefs({ keys: undefined })` が `{}` を残す既存の利用者がいると分かった
  （`packages/web/src/store/settings.ts:385`、`packages/web/src/keys/keyPrefs.ts:142`）。design（`store/onboarding.ts` 節）と D4 は `{}` を「無い」扱いにしていた。
- 決定: `wtm.prefs.v1` が存在すれば（中身・形を問わず）痕跡とみなす。
- 理由・代替案: 本製品の書き手は `writePrefs` だけで、キーが存在する＝一度は何かを書いた利用者。中身を見る理由が無く、見ると上の経路で誤る。
  壊れた JSON を別扱いする分岐も不要になる。
- 影響: design の「`wtm.prefs.v1` が無い、または JSON のオブジェクトでキーが 0 個」は「`wtm.prefs.v1` が無い」と読み替える。負の確認は変更後の行でやり直した。

## D9: 説明の出し分けは画面幅、キーのプリセットは指の操作で決める（D5 を補う）

- 背景: cross 点検で、案内が説明の出し分け（サイドバー／上のバー）を `DeviceKindKey`（`isCoarsePointer()`）で決めていたため、1 列の画面を
  出すかの判定（`isMobileViewport()`・幅 768px 未満。`packages/web/src/App.vue:41,58`）と食い違い、狭くしたデスクトップの窓と幅の広いタブレットで
  画面に無い部品を案内すると分かった（`packages/web/src/mobile/detect.ts` のコメントも 2 つは別の軸と明記している）。
- 決定: マウス・キーの説明と上のバーの案内の出し分けは `isMobileViewport()`、キーのプリセットを出さない判定（D5）は `DeviceKindKey` のまま。
- 理由・代替案: 説明は「いま画面にある部品」を指すので配置の判定に揃える。プリセットは「組み合わせのキーを打てるか」なので入力装置の判定に揃える。
- 影響: requirements の AC10 の「モバイル（1 列の画面）」は画面幅の側。docs の H25b と verification の記述を合わせて直した。

## D10: 初めての利用者のキー一覧のトーストが、はじめの案内の裏で使い切られるのは許容する

- 背景: cross 点検の nit。起動時は `restoreView` で pane にフォーカスが入った時点で `Toast.vue` がキー一覧の案内を出して印を書き、その直後に
  はじめの案内が開く（`packages/web/src/components/Toast.vue:34-44`、`packages/web/src/net/Connection.ts:239-242`）。
- 決定: この work では変えない。
- 理由・代替案: はじめの案内はデスクトップでキー一覧のキー（現在の割り当て）を載せているので、利用者が受け取る情報は減らない。
  Toast に「案内が出る予定か」を読ませる案は、`Toast.test.ts` の前提（痕跡の無い localStorage で案内が出る）を変え、Toast の方針
  （出せないときは使い切らない）を別の条件に広げることになるので、見送る。
- 影響: 1 列の画面では、はじめの案内にキー一覧のキーは無いが、同じトーストはもともとモバイルでは意味が薄い（物理キーボードが無い）。

## D11: 自動操作されているブラウザ（`navigator.webdriver === true`）では、はじめの案内を自動では出さない。起動確認で本物のブラウザの案内を確かめる

- 背景: test ラウンド 1 で `aidev smoke`（ビルドした `wtm` を Playwright の Chromium で開く）が、新しいプロファイルで開いたはじめの案内に
  端末のクリックを遮られて失敗した（test-result.md「失敗の証跡」）。E2E（`packages/e2e` の 19 spec）も localStorage の空の新しい context で
  開くので、同じく全面的に遮られる（例: `keys-mouse-dialogs.spec.ts` は端末をクリックしてから prefix を押す——案内が開いていると
  KeyRouter が dialog モードでキーを食う）。
- 決定: `useOnboardingStore` の起動時の判定を `!navigator.webdriver && isFreshBrowser(...)` にする。設定画面からの開き直しは自動操作でも使える。
  `smoke.ts` に、`navigator.webdriver` を false に見せたページではじめの案内が開き、Esc で閉じると端末へフォーカスが戻り、
  `onboarding: false` が保存されることを確かめる段を足す。
- 理由・代替案: (a) E2E の各 spec・smoke で localStorage に案内済みを仕込む → 手で `browser.newContext()` する spec が 8 本あり、
  prefs の中身をそのまま比べる spec もある（`key-bindings.spec.ts:75` 等）。利用者の方針で E2E を走らせられないので、19 spec の変更を
  検証できないまま着地することになる。(b) smoke で案内を閉じるだけ → E2E は壊れたまま。`navigator.webdriver` は WebDriver 仕様で
  自動操作中だけ true になる値で、人が使うブラウザでは false（初回の案内・ツアーを自動操作で出さないのは広く使われる扱い）。
- 影響: E2E・smoke の既存の前提（新しい context は案内を出さない＝今までと同じ画面）が保たれる。本物のブラウザでの案内の確認は smoke の新しい段が
  担う（happy-dom で確かめられなかったフォーカスの戻りもここで確かめる）。docs の H25b と verification に「自動操作では出ない」を書く。

## D12: 設定画面を実際に置く案内のテスト 1 本だけ、時間の上限を 15 秒にする

- 背景: review ラウンド 1 で、`OnboardingDialog.test.ts` の「既存の利用者でも設定画面から開け…」が高負荷で既定 5 秒を越えると指摘され、動的 import を静的 import に替えた（T8）。
  それでも test ラウンド 3 の全体の 1 回目（load average 21）で同じ it が時間切れになった（test-result.md「test ラウンド 3」）。前ラウンドの修正は変換の時間だけを外し、
  1200 行を超える `SettingsDialog.vue` と `KeySettings.vue` を実際に置く重さは残っていた。
- 決定: この it だけ上限を 15 秒にする。ほかに足したテストのうち設定画面・App 全体を置くものは、既存の同じファイルのテストと同じ重さ（既存のテストも同じ負荷で落ちる。バックログ「単体・結合テストが高負荷のときだけ落ちる」）。
- 理由・代替案: 設定画面を偽物に差し替えると、「設定画面のボタンから案内が開き、設定画面が閉じる」という結線そのものを確かめられない。先例は `composeServer.integration.test.ts:256` の `15000`。
- 影響: 無し（テストの上限だけ）。
