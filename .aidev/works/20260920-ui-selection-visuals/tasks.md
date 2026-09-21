# タスク: 選択状態の表示をそろえ、強調をホバーから選択へ移す

## 実装方針

design の 4 方針を、**ファイル単位ではなく「1 つの受け入れ基準を閉じる単位」**で刻む。
`Sidebar.vue` と `PaneFrame.vue` に変更が集中するので、**同一ファイルを触るタスクは直列**にする
（`aidev-40-coding` の手順 2：`対象` が重なるものは並行させない）。

順序は「トークン → テンプレート → スタイル → テスト」。先に CSS 変数を置かないと
スタイルのタスクが未定義の変数を参照することになるため。

## 作業順序と依存関係

下の `依存:` に従う。それでは表せない順序の理由だけ書く。

- **T10（横溢れの E2E）は T4 と T5 の両方が終わってから**。横スクロールバーの原因は
  「2 行目が縮まない」と「つまみが 3px はみ出す」の 2 つで、片方だけ直しても判定は落ちたままになる（design の方針 5）。
- **同じファイルを触るタスクは直列**。`Sidebar.vue` は T2→T3→T4→T5、`PaneFrame.vue` は T6→T7、
  `keys-mouse-dialogs.spec.ts` は T11→T12。
- **回帰テストは「直す前に落ちること」を必ず確かめる**（`.aidev/conventions/regression-negative-control.md`）。
  手順は下の「テスト方針」に書く。

## リスク / 留意点

- `.pane-frame-edge` に `border` を足すと外寸が変わる、という誤解が起きやすい。
  `position:absolute; inset:0` なので変わらない（design「依拠する既存の事実」。実測済み）が、
  **`padding: 4px` が変わっていないことを E2E で必ず確かめる**（T11）。PTY の行・列に波及するため。
- `overflow-x: hidden` を足してもスクロール領域（`scrollWidth`）は縮まない。
  原因 2 つ（T4・T5）を直さないと T10 は通らない。
- `PaneFrame` は `enabled=false`（モバイル）のとき `session` / `view` を取らない。
  ルートに pane の名前を出す属性を足すときは `enabled` の条件を付けないと null 参照になる。
- **セレクタの詳細度**：表示中は `.sidebar-row.sidebar-row-current`（(0,3,0)）で書く。
  単一クラス `.sidebar-row-current`（(0,2,0)）にすると、順序に関わらず `.sidebar-row:hover`（(0,3,0)）が勝ち、
  「表示中 + マウス」で表示中の色にならない（scoped の `[data-v-…]` が 1 つ加わるので各+1）。

## テスト方針

- **単体（vitest + @vue/test-utils）**: クラスの有無・属性の有無・付け替わり。
  jsdom / happy-dom は scoped CSS を適用しないので、**見た目そのものは単体では確かめられない**
  （design の「`Sidebar.test.ts` に省略の単体テストを追加」も、確かめられるのは
  `sidebar-git-counts` が付くところまで。省略が効いているかは T10 の E2E で見る）。
- **E2E（Playwright）**: 計算後のスタイルと実測（`getComputedStyle` / `scrollWidth` / `clientWidth`）。
  ホバーは `locator.hover()` が `.pane-frame-body` に横取りされるので、
  **`page.mouse.move(area.x + 2, …)` で 4px 帯の座標を直接指す**（既存の `keys-mouse-dialogs.spec.ts:201-203` と同じ流儀）。
- **負の対照の手順**（条項 `regression-negative-control`。T10・T11 で必須）:
  1. 新しい spec を書く。**まだ実装は入れない**（実装より先に書けるので「戻す」作業は要らない）。
  2. `pnpm -r build` で `packages/web/dist` を作り直してから走らせる
     （サーバは dist を配るので、ビルドしないと `.vue` の状態が反映されない）。
  3. **落ちることを確かめ、生の出力を `test-result.md` に貼る**（要約に置き換えない）。
  4. 実装を入れ、もう一度ビルドしてから走らせて通ることを確かめる。
  5. もし実装を先に入れてしまったら、**直した箇所だけを戻して** 2〜3 を行い、戻した後に `git diff` が空であることを確認する。
- **既定の E2E 一式**と**全パッケージの単体テスト**は test 工程で 1 回通す（T14。coding 中は触ったパッケージだけ）。
  なお `mobile.spec.ts` の D105 のテストは**この work に着手する前から失敗している**（decisions.md D2）。
  この work の変更はモバイルに届かないので、**落ちたままでも原因をこの work に帰さない**。
- **backlog へ送るもの**は design の「backlog へ送るもの」2 件（強調色のコントラスト／xterm.js のカーソル）と
  decisions.md D2（`mobile.spec.ts` の D105）。deliver で起票する。

## タスク

- [x] T1: `App.vue` の `:root` に `--wtm-menu-hover-bg: #343746;` を足す
      （単独では見た目が変わらない。効き目の確認は T3 と T10 で行う）
      対象: `packages/web/src/App.vue:77-84` / 根拠: research A10
      依存: なし
      AC: AC2
- [x] T2: `Sidebar.vue` の workspace 行に「表示中」のクラスと `aria-current` を束縛する
      （`view.workspaceId` と一致する行に `sidebar-row-current` と `aria-current="true"`。
      一致しない行には**属性ごと付けない**。agents 区画の行には付けない）
      対象: `packages/web/src/components/Sidebar.vue:98-105` / 根拠: research A1
      依存: なし
      AC: AC1, AC8
- [x] T3: `Sidebar.vue` の 3 状態のスタイルを分ける（ホバー＝`.sidebar-row:hover` に
      `var(--wtm-menu-hover-bg, #343746)`、表示中＝**`.sidebar-row.sidebar-row-current`**（詳細度を同点にする）に
      `var(--wtm-menu-active-bg, #44475a)` を `:hover` より**後**に置く、
      navigate カーソル＝`.sidebar-row-selected` を `outline: 1px solid var(--wtm-fg, #f8f8f2); outline-offset: -1px;` に差し替える）
      対象: `packages/web/src/components/Sidebar.vue:168-171` / 根拠: research A5
      依存: T1, T2
      AC: AC1, AC2
- [x] T4: `Sidebar.vue` の 2 行目を横に溢れなくする（`↑n ↓n` の `<span>` に `sidebar-git-counts` を足し、
      `.sidebar-row-line2 > span` に `overflow/text-overflow/white-space` の 3 宣言、
      `sidebar-git-counts` と `sidebar-unverified` に `flex: none`。**`min-width: 0` は足さない**——no-op）
      対象: `packages/web/src/components/Sidebar.vue:110-113` `:126-129` `:177-183` `:213-215` / 根拠: research A3・A6
      依存: T3
      AC: AC3
- [x] T5: `Sidebar.vue` の幅変更のつまみを内側へ寄せ（`right: -3px` → `right: 0`。decisions.md D3）、
      `.sidebar` に `overflow-x: hidden` を足す
      対象: `packages/web/src/components/Sidebar.vue:216-224` `:141-150` / 根拠: research A4
      依存: T4
      AC: AC3
- [x] T6: `PaneFrame.vue` の強調を選択に移す（`.pane-frame-edge:hover` のルールを削除し、
      `pane-frame-edge-current` を `selected` に束縛して
      `border: 2px solid var(--wtm-menu-border, #44475a)` を当てる。**`var()` の第 2 引数を落とさない**）
      対象: `packages/web/src/components/PaneFrame.vue:92-105` `:128-130` / 根拠: research A7・A9
      依存: なし
      AC: AC4, AC5, AC6
- [x] T7: `PaneFrame.vue` の `title` を外し、ルート要素に `role="group"` ＋ `aria-label` ＋ `aria-current` を付ける
      （**`enabled` のときだけ**。`aria-label` は既存の `label` computed（メニューの名前）を流用せず、
      pane を指す別の文字列 `pane「<名前>」`／名前が無ければ `pane` を新しい computed で作る）
      対象: `packages/web/src/components/PaneFrame.vue:91` `:101` `:37-41` / 根拠: research A8
      依存: T6
      AC: AC7, AC8
- [x] T8: `Sidebar.test.ts` に単体テストを足す（表示中のクラスと `aria-current` が付く／付かない、
      表示中かつ navigate 選択で 2 クラスが同時に付く、agents 行には表示中が付かない、
      `↑n ↓n` に `sidebar-git-counts` が付く）
      対象: `packages/web/src/components/Sidebar.test.ts:68-83`（git の 2 行目）
      `:108-116`（navigate 選択。この直後に足す） / 根拠: research A11
      依存: T2, T4
      AC: AC1, AC2, AC3, AC8
- [x] T9: `PaneFrame.test.ts` に単体テストを足す（選択中の枠に `pane-frame-edge-current` が付き、
      選択を移すと移る／`title` 属性が無い／`aria-label` は残る／ルートの `role` と `aria-current`）
      対象: `packages/web/src/components/PaneFrame.test.ts:115-129`（aria 系）
      `:132-146`（選択の移動） / 根拠: research A11
      依存: T7
      AC: AC4, AC7, AC8
- [x] T10: 横スクロールバーの E2E を足す。**先に実装前の版で落ちることを確かめる**（テスト方針の「負の対照の手順」）。
      お膳立て:（1）`mkdtemp` で一時ディレクトリを作り `git init --bare origin.git`、
      （2）`git clone origin.git work`、（3）**work で最初のコミットを作る**（`git commit --allow-empty`。
      これが無いと push も `rev-parse --abbrev-ref HEAD` も失敗する）、
      （4）**区切り文字（`-` `/` `_`）を含まない長いブランチ名**で `git checkout -b` して `git push -u origin <branch>`、
      （5）もう 1 つ空コミットを足して ahead=1 にする。
      そのうえで `client.request("workspace.create", { cwd })`（前例: `reconnect-restore.spec.ts:70`）、
      2 行目が出るのを `expect.poll`（timeout 15s。`GitInfoPoller` は 5s 周期）で待ち、
      `.sidebar` の `scrollWidth <= clientWidth` を既定幅と折りたたみ時（`prefix+b`）の両方で確かめる
      対象: `packages/e2e/src/specs/workspace-tab-pane.spec.ts` （新しい test を追加）
      依存: T5
      AC: AC3
- [x] T11: 枠の E2E を足す（選択中の枠の `borderTopWidth === "2px"` と `.pane-frame` の `paddingTop === "4px"`、
      `page.mouse.move` で 4px 帯にポインタを乗せる前後で `backgroundColor` と `borderTopWidth` が変わらないこと）。
      **先に実装前の版で落ちることを確かめる**
      対象: `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts` （新しい test を追加）
      依存: T6
      AC: AC5, AC6
- [x] T12: 選択の移動の E2E を足す（2 つに分割し、`prefix+h` / `prefix+l` で選び直すと
      `pane-frame-edge-current` が付いている枠が入れ替わる）
      対象: `packages/e2e/src/specs/keys-mouse-dialogs.spec.ts:267-290` / 根拠: 既存の 2 ペインのテストに合流
      依存: T6, T11
      AC: AC-I3
- [x] T13: `docs/verification.md` の pane の枠の説明から「ポインタを重ねると色が付き」を外し、
      選択中の枠に線が出る旨へ直す
      対象: `docs/verification.md:86`
      依存: T6
      AC: AC7
- [ ] T14: 全パッケージの単体テストと既定の E2E を**走らせて結果を記録する**
      （**test 工程で消化する**。coding 工程では未チェックのまま承認してよい。decisions.md D1）
      対象: 未特定（走らせるだけで自前の差分を持たない）
      依存: T8, T9, T10, T11, T12, T13
      AC: AC9, AC-I1, AC-I2, AC-I4, AC-I5
