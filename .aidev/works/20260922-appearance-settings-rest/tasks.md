# タスク: 外観と設定の残り（サイドバー行・tab バー・pane 枠・設定の再読み込み）

## 実装方針

design.md の5つの US（US1: workspace 並び順／US2: tab バー自動非表示／US3: tab バー時刻表示／
US4: pane の枠/隙間/エージェント名／US5: 設定の再読み込み）を、ストア層（`view.ts`/
`settings.ts`）→ UI 層（`Sidebar.vue`・`PaneFrame.vue`+`Splitter.vue`・`SettingsDialog.vue`・
`TabBar.vue`）→ 横断（`reload_config`）→ E2E の順で積む。UI 層の4タスク（T2・T4・T5・T6）は
文章上は列挙順に書いたが、`依存:` が示すとおり実際には T2 が T1 だけに、T4・T5 が**互いに
依存せず** T3 だけに、T6 がどこにも依存しない、という並行できる兄弟関係にある
（タスク番号の順序は着手順の目安であって、依存の強制ではない）。同一ファイルへの変更は
1タスクにまとめる（ファイルの重複による並行不可・不要な手戻りを避けるため）——
`PaneFrame.vue` を触る US4 の枠の CSS 変数化とエージェント名表示は1つ（T4）に、
`TabBar.vue` を触る US2・US3（自動非表示・フォーカス退避・時刻表示）は1つ（T6）に、
`settings.ts` を触る US4 の2つの新規設定（`paneFrameThickness`・`paneAgentNameVisible`）は
1つ（T3）にまとめる（`view.ts` に `workspaceSort` だけを持つ T1 と役割は同じだが、
`settings.ts` 側はこの work で2つの独立した設定を同時に足すため、まとめておく方が
`readPrefs`/`writePrefs` を経由する既存パターンの追加を1箇所で完結できる）。

## 作業順序と依存関係

下の `依存:` に従う。補足が要る箇所だけ書く：
- T7（reload_config）は、読み直す対象に `workspaceSort`（T1）・`paneFrameThickness`・
  `paneAgentNameVisible`（T3）を含むため、両方に依存する。
- T8（E2E）は実装がすべて揃ってからまとめて書く（design の mermaid 相当の横断確認は無いが、
  複数 US にまたがる操作〔例: 設定を変えてから reload_config で戻す〕は無いので、E2E は
  US ごとに独立したテストで足りる）。

## リスク / 留意点

- `PaneFrame.vue`/`Splitter.vue`/`App.vue` の CSS 変数（`--wtm-pane-gap`）は、値の出所
  （`settings.paneFrameThickness` → px 数）を1箇所（`PANE_FRAME_THICKNESS_PX`）に集約し、
  `PaneFrame.vue`・`Splitter.vue` 双方が同じ変数名を読むことを T4 の中で確認する。
- `ActionDispatcher.ts` の `reloadConfig` 分岐は、design の「申し送り」どおり、対象の `load*`
  関数が `export` されているかを T7 の着手時に確認し、されていなければ `export` を足す
  （design で「存在」は確認済みだが「export」は未確認）。
- `TabBar.vue` の自動非表示は、既存の `TabBar.test.ts`（tabs が2個以上の前提で書かれている
  可能性がある）に対する回帰が無いか、T6 で必ず確認する。

## テスト方針

- 各タスクは対応する `*.test.ts`（`view.test.ts`・`settings.test.ts`・`Sidebar.test.ts`・
  `TabBar.test.ts`・`PaneFrame.test.ts`・`Splitter.test.ts`・`SettingsDialog.test.ts`・
  `ActionDispatcher.test.ts`・`bindings.test.ts`・`keymap.test.ts`）に unit test を足す。
- T8 で `packages/e2e` に E2E を足す（対象 spec は T8 で決める。既存の `sidebar-tabbar-*.spec.ts`
  相当があれば拡張し、無ければ新規）。
- 全タスク完了後、`pnpm exec vitest run`（全体）・対象 E2E spec・`pnpm -s typecheck`・
  `aidev smoke` を実行する。全 spec の E2E は deliver 直前に1回（`e2e-affected-specs-only` の
  運用どおり）。

## タスク

- [x] T1: `view.ts` に workspace の並び順設定を足す：`WorkspaceSort` 型（`"opened"|"name"`）・
      `loadWorkspaceSort()`（壊れた値は `"opened"` へ）・`saveWorkspaceSort()`・
      `workspaceSort` ref・`toggleWorkspaceSort()`（`agentSort`/`toggleAgentSort` と1:1対応。
      design「インターフェース / データ構造」の `view.ts` 節のコード例どおり）。store の
      `return {...}` に `workspaceSort`・`toggleWorkspaceSort` を追加。
      対象: `packages/web/src/store/view.ts:35-78`（`agentSort` 一式のすぐ近く）/ 根拠: design
      「インターフェース / データ構造」・「依拠する既存の事実」
      依存: なし
      AC: AC3
- [x] T2: `Sidebar.vue` の spaces 区画に、agents 区画と同じ形の区画ヘッダー（見出し「spaces」＋
      並び順ボタン。`WORKSPACE_SORT_LABEL: Record<WorkspaceSort, string> = { opened: "開いた順",
      name: "名前順" }`）を追加する（`.sidebar-collapsed` のときは非表示。既存の
      `.sidebar-section-header` の `v-if` 条件を踏襲）。`spaces` computed に、
      `view.workspaceSort === "name"` のときだけ `workspace.label` を `localeCompare` で
      並べ替える分岐を足す（`agents` の `grouped`/`priority` 分岐と同じ形）。
      対象: `packages/web/src/components/Sidebar.vue:23-30,147-172,184-191` / 根拠: design
      「振る舞いの詳細」US1
      依存: T1
      AC: AC1, AC2
- [x] T3: `settings.ts` に pane の枠・隙間の太さ設定とエージェント名表示設定を足す：
      `PaneFrameThickness` 型（`"thin"|"default"|"thick"`）・`PANE_FRAME_THICKNESS_PX`
      （`{thin:2, default:4, thick:6}`）・`loadPaneFrameThickness(raw)`（既定 `"default"`）・
      `loadPaneAgentNameVisible(raw)`（既定 `false`）・対応する ref・`setPaneFrameThickness`・
      `setPaneAgentNameVisible`（`statusSymbols`/`loadStatusSymbols`/`setStatusSymbols` と同じ形。
      design「インターフェース / データ構造」の `settings.ts` 節のコード例どおり）。store の
      `return {...}` に追加。
      対象: `packages/web/src/store/settings.ts:32-34,76,102-105`（`statusSymbols` 一式の近く）
      / 根拠: design「インターフェース / データ構造」
      補足: T1（`workspaceSort`）と同じ「既定値へのフォールバック＋`wtm.prefs.v1` への保存」の
      形を持つが、対応する単体の AC が無い（requirements の AC9〜AC12 はいずれも「設定画面に
      switch/選択肢がある」という UI の存在を求めており、AC1〜AC3〔並び順〕のように「保存され、
      再読み込み後も残る」ことだけを独立に問う AC を requirements 側が立てていない）。
      永続化そのものは T5・T8 が UI を通じて間接的に確認する。
      依存: なし
      AC: なし
- [x] T4: `PaneFrame.vue`・`Splitter.vue`・`App.vue` に枠・隙間の太さと、pane 上のエージェント名の
      可視表示を実装する。(a) `App.vue` の `:root` 相当（既存の `--wtm-*` 変数を定義している
      箇所）で `--wtm-pane-gap` を `settings.paneFrameThickness` から
      `PANE_FRAME_THICKNESS_PX` で引いた px 数にバインドする。(b) `PaneFrame.vue:134-136` の
      `.pane-frame-enabled { padding: 4px; }` と `Splitter.vue:121-127` の生の `4px` を、
      いずれも `var(--wtm-pane-gap, 4px)` に置き換える。(c) `PaneFrame.vue` に
      `<span v-if="settings.paneAgentNameVisible && paneName" class="pane-frame-name"
      aria-hidden="true">{{ paneName }}</span>` を `.pane-frame-edge` の中へ追加する
      （`pointer-events: none` で既存のクリック領域〔メニューを開く〕を妨げない位置・
      スタイルにする）。
      対象: `packages/web/src/components/PaneFrame.vue:39-46,97-124,133-136`・
      `packages/web/src/components/Splitter.vue:121-127`・`packages/web/src/App.vue`（`:root`
      相当の CSS 変数定義箇所） / 根拠: design「振る舞いの詳細」US4・「インターフェース /
      データ構造」`PaneFrame.vue`／`Splitter.vue` 節
      依存: T3
      AC: AC9, AC11, AC12
- [x] T5: `SettingsDialog.vue` の「表示」節に、pane の枠・隙間の太さの選択肢（`fieldset` +
      3つの radio「細い/既定/太い」。`scrollback`・`newCwdPolicy` の既存の radio 群と同じ形）と、
      「pane にエージェント名を表示する」の switch（`.settings-switch`。`statusSymbols` と
      同じ形）を追加する。選択・クリックの瞬間に `settings.setPaneFrameThickness(v)`／
      `settings.setPaneAgentNameVisible(v)` を呼び、確認ダイアログは挟まず、フォーカスは
      選んだ部品に留める（フォーカスを動かすコードを書かない）。
      対象: `packages/web/src/components/SettingsDialog.vue:354-386`（「表示」節） / 根拠:
      design「振る舞いの詳細」US4・「依拠する既存の事実」の `SettingsDialog.vue:357,367-386`
      依存: T3
      AC: AC10, AC-I1, AC-I2, AC-I3, AC-I4
- [x] T6: `TabBar.vue` に自動非表示・フォーカス退避・時刻表示を実装する。(a) ルート要素に
      `v-if="tabs.length > 1"` を足す。(b) `PaneFrame.vue:53-61` と同じ形の `onBeforeUnmount`
      を足し、非表示になる直前に `document.activeElement` が `TabBar.vue` のルート要素の内側
      にあれば、`nextTick` 後に選択中 pane（`view.focusedPaneId`）の端末へ
      `registry.focus(...)` でフォーカスを戻す。(c) `now = ref(new Date())` を持たせ、
      `onMounted` で `setInterval(() => (now.value = new Date()), 15_000)`・`onUnmounted` で
      `clearInterval`。tab 一覧と「＋」ボタンの間（または右）に `HH:mm`（24時間表記）の
      時刻表示を `aria-hidden="true"` で追加する。(d) 既存の `TabBar.test.ts` が tabs 1個の
      ケースを前提にしたテストを持っていないか確認し、`v-if="tabs.length > 1"` の追加で
      既存テストが意図せず壊れていないこと（tabs 1個のケースの既存テストがあれば、その
      期待値をこの work の新しい挙動に合わせて更新すること）を確認する。
      対象: `packages/web/src/components/TabBar.vue`（全体）・
      `packages/web/src/components/TabBar.test.ts` / 根拠: design「振る舞いの詳細」US2・US3・
      「依拠する既存の事実」の `TabBar.vue` 節・`PaneFrame.vue:53-61`（フォーカス退避の先例。
      参照のみ、編集はしない）
      依存: なし
      AC: AC4, AC5, AC6, AC7, AC8, AC-I6
- [x] T7: `prefix+shift+r` に「設定を読み直す」操作を実装する。(a) `actions.ts` の `Action`
      判別共用体に `{ type: "reloadConfig" }` を追加。(b) `bindings.ts` の `ACTIONS` に
      `{ id: "reload_config", label: "設定を読み直す", group: "全体", defaults:
      ["prefix+shift+r"], action: { type: "reloadConfig" } }` を追加。(c) `keymap.ts:25-28` の
      `NOT_YET_BINDINGS` から `["shift+r", ...]` の行を削除する。(d) `ActionDispatcher.ts` の
      `dispatch` に `case "reloadConfig":` を追加し、`settings`・`view` 各ストアの `load*`
      関数を呼び直して対応する ref へ再代入する（`settings.ts` 側は `readPrefs()` を1回呼んで
      各キーの raw 値を渡す形、`view.ts` 側は `load*()` を引数無しで呼ぶ形。design「US5」参照）。
      対象の設定: `statusSymbols`・`scrollback`・`newCwdPolicy`・`newCwdPath`・`theme`系4つ・
      `paneFrameThickness`・`paneAgentNameVisible`・`sidebarWidth`・`sidebarCollapsed`・
      `agentSort`・`workspaceSort`。最後に `this.view.toast("設定を読み直しました。")`。
      workspace・tab・pane の構成・フォーカスには一切触れない。対象の `load*` 関数が
      `export` されていなければ、`view.ts`/`settings.ts` 側でも `export` を足す
      （design「申し送り」参照）。
      対象: `packages/web/src/keys/actions.ts:47-73`・`packages/web/src/keys/bindings.ts`
      （`ACTIONS` 配列）・`packages/web/src/keys/keymap.ts:25-28`・
      `packages/web/src/actions/ActionDispatcher.ts:48-51,71,139`・
      `packages/web/src/store/view.ts`・`packages/web/src/store/settings.ts`（`load*` の
      `export` 漏れがあれば、その関数の宣言だけを直す） / 根拠: design「振る舞いの
      詳細」US5・「依拠する既存の事実」
      依存: T1, T3
      AC: AC13, AC14, AC15, AC-I5
- [x] T8: E2E を足す（`.aidev/conventions/e2e-observe-browser.md` に従い、判定は DOM・実際に
      送受信されたフレームで行う。design の US 単位では4系統に分かれるが、いずれも実物の
      ブラウザで一連の操作を通す確認で、対象 spec も1つに収まる見込みのため、E2E だけは
      他タスクと違い複数 US をまとめて1タスクにする——`aidev-40-coding` が言う「1タスク=1つの
      検証可能な変更」は実装タスクの粒度の話で、E2E のような横断確認タスクには従来から
      適用していない〔20260922-keybinding-usability の T8 も同様〕）。(a) workspace を2つ以上
      開いた状態で並び順トグルを押すと、サイドバーの spaces 区画の表示順が実際に入れ替わる
      ことを確認する（AC1・AC2。AC3〔既定値・保存の永続化〕は `localStorage` の読み書きだけの
      事実で、ブラウザを介さない T1 の unit test で十分検証できるため、E2E では重複確認しない）。
      (b) tab を1個→2個→1個と増減させ、tab バーの表示・非表示が実際に切り替わり、非表示の間も
      `prefix+c`（新規 tab）が機能することを確認する（AC4〜AC6）。tab バーの要素にフォーカスが
      あるまま tab が1個に減ったとき、フォーカスが失われず端末へ戻ることを確認する（AC-I6）。
      (c) tab バーに時刻の表示があることを確認する（AC7。定期更新〔AC8〕は実時間を待つ検証が
      不安定になりやすいので、`setInterval` の呼び出し自体は T6 の unit test の対象とし、E2E は
      「表示されている」ことだけ確認する。理由を decisions に残す）。(d) 設定画面で枠の太さを
      変えると pane の見た目（実測の枠の太さ）が変わり、エージェント名表示の switch を有効にすると
      pane にエージェント名が可視で出ることを確認する（AC9〜AC12）。この2つの新規部品を
      **実際に Tab で辿り着いて操作できる**ことも確認する（AC-I3・AC-I4。AC-I1・AC-I2〔開閉・
      確定の概念が無い／確認ダイアログを挟まない〕は、ダイアログや別状態を伴わない単純な
      DOM の事実で T5 の component test で十分検証できるため、E2E では重複確認しない）。
      (e) `prefix+shift+r` を押すと `role="status"` に「設定を読み直しました。」が出て、
      開いている workspace・tab・pane の構成が変わらないことを確認する（AC13〜AC15。AC-I5
      〔`defaults` の重複が無い〕は静的な `ACTIONS` 配列の事実で、T7 の unit test
      〔`bindings.test.ts`〕で十分検証できるため、E2E では重複確認しない）。
      対象: `packages/e2e/src/specs/`（対象 spec は着手時に決める。既存の `sidebar-tabbar-*`
      相当があれば拡張、無ければ新規） / 根拠: design「受け入れ基準との対応」全体
      依存: T2, T4, T5, T6, T7
      AC: AC1, AC2, AC4, AC5, AC6, AC7, AC9, AC10, AC11, AC12, AC13, AC14, AC15, AC-I3, AC-I4, AC-I6
