# タスク: herdr にあって本製品に操作自体が無いものを足して割り当てられるようにする

## 実装方針

design.md の対象範囲を、依存の向きに沿って下から積む：
1. protocol（`tab.move` の型）→ server（`SessionModel`/`SessionService`/surface 登録）
2. web の土台（`Action` 型・共有純関数2つ・`view.lastFocusedPaneId`）
3. web のカタログ登録（`bindings.ts`）と実行本体（`ActionDispatcher`）
4. `Sidebar.vue` の最小リファクタ（共有純関数を使う形へ）
5. 既存テストの一般化（`switch_tab` だけを前提にした文言・アサーション）
6. `docs/herdr-parity.md` の更新
7. 全体の回帰確認（test 工程で実施。詳細は「テスト方針」）

subtask には割らない（不可分——web/server/protocol が1つの機能として結合しており、個別に検証・デリバリ
できる単位に切り出せない。decisions.md D6 と同じ判断軸）。

## 作業順序と依存関係

下の `依存:` に従う。並行できるのは T1/T2/T4/T5/T6/T7（対象ファイルが重ならない5系統：protocol（T1）・
server の型非依存部分（T2）・web の Action 型（T4）・web の2つの新規純関数（T5・T6）・view.ts（T7）。
系統は5つだがタスクは6件——「web の2つの新規純関数」の系統だけ T5・T6 の2タスクを含む）。

## リスク / 留意点

- `bindings.test.ts:33`（`defaults.length > 0` を全操作に要求）・`keymap.test.ts:220`（`switch_tab` 専用の
  文言に依存）は**このリポジトリで初めて崩れる前提**なので、直し忘れると `pnpm -s test` が赤くなる
  （research「実現性 / リスク」R3）。
- `Sidebar.vue` のリファクタ（T11）は振る舞いを変えないことが前提。`Sidebar.test.ts` を無変更のまま
  通すことで確認する（1件でも変更が要れば設計から逸脱している合図）。
- `ActionDispatcher.activateNavigateSelection` の抽出（`focusWorkspaceById` への切り出し。T9）も同様に、
  既存の `navigate` テスト（`activate: 選択中の workspace の activeTabId へ切り替え…`）を無変更で通す。

## テスト方針

- 単体テスト中心（design「対象範囲」の一覧どおり、新規・既存双方のファイルを更新）。
- E2E は対象外（requirements「対象外」）。
- `aidev smoke` は test 工程で通常どおり実施。
- 全体回帰（`pnpm -s -r test`。AC10）は T15 として立てるが、**消化するのは test 工程**（coding では
  チェックしない。理由は decisions.md D7）。

## タスク

- [x] T1: `packages/protocol/src/messages.ts` に `tab.move` を追加する（`tabMoveDirection` enum・
      `TabMoveParams`・`METHOD_SCHEMAS["tab.move"]`・`MethodResultMap["tab.move"]`）。
      `messages.test.ts` に `TabMoveParams` の parse テストを1件足す（`PaneSplitParams` と同じ形）。
      対象: `packages/protocol/src/messages.ts:15-19`（enum 群の近く）・`:141`（`TabCloseParams` の直後）・
      `:274`（`METHOD_SCHEMAS`）・`:310`（`MethodResultMap`） / 根拠: design「インターフェース / データ構造」
      依存: なし
      AC: AC5

- [x] T2: `SessionModel.moveTab(id, direction): Workspace | null` を追加する（対象 tab とその隣を
      `tabIds` 配列内で swap、巡回込み。`tabIds.length <= 1` は `null` を返す no-op）。
      `SessionModel.test.ts` に単体テストを足す（`renameTab`/`closeTab` の既存テストと同じ形。単一 tab
      workspace での no-op、3 tab での前後巡回、末尾/先頭での巡回を確認）。
      対象: `packages/server/src/session/SessionModel.ts:324-326`（`closeTab`/`closeTabInternal` の近く）
      / 根拠: design「インターフェース / データ構造」`SessionModel.moveTab`
      依存: なし
      AC: AC5

- [x] T3: `SessionService.moveTab` を追加し（`model.moveTab` を呼び、結果があれば `workspace.updated` を
      publish・`persist.touch()`）、`surface/methods/tab.ts` に `tab.move` のハンドラを登録する。
      `SessionService.test.ts`・`packages/server/src/surface/methods/index.test.ts` に統合テストを足す
      （`workspace.updated` が発行されること・単一 tab では発行されないこと）。
      対象: `packages/server/src/session/SessionService.ts:324-334`（`renameTab`/`focusTab` の近く）・
      `packages/server/src/surface/methods/tab.ts:15-21`（`tab.rename` の近く） / 根拠: design
      「インターフェース / データ構造」
      依存: T1, T2
      AC: AC5

- [x] T4: `packages/web/src/keys/actions.ts` の `Action` 判別共用体に5つの type を追加する
      （`workspaceDelta`・`lastPane`・`moveTab`・`agentDelta`・`focusAgentIndex`）。
      対象: `packages/web/src/keys/actions.ts:47-76` / 根拠: design「インターフェース / データ構造」
      依存: なし
      AC: AC1, AC3, AC5, AC7

- [x] T5: 新規 `packages/web/src/store/workspaceOrder.ts` に `orderedWorkspaceIds(workspaces, sort)` を
      実装する（`opened`＝渡された順・`name`＝`label.localeCompare` 昇順。`Sidebar.vue` の既存 `spaces`
      computed のソート規則をそのまま移設）。`workspaceOrder.test.ts` を新規作成する。
      対象: 新規ファイル / 根拠: design「インターフェース / データ構造」`store/workspaceOrder.ts`、
      移設元 `packages/web/src/components/Sidebar.vue:28-40`
      依存: なし
      AC: AC3, AC4

- [x] T6: 新規 `packages/web/src/store/agentOrder.ts` に `orderedAgentPaneIds(entries, sort)` を実装する
      （`grouped`＝渡された順・`priority`＝状態優先度降順→`since` 降順。`Sidebar.vue` の既存 `agents`
      computed のソート規則をそのまま移設）。`agentOrder.test.ts` を新規作成する。
      対象: 新規ファイル / 根拠: design「インターフェース / データ構造」`store/agentOrder.ts`、
      移設元 `packages/web/src/components/Sidebar.vue:48-66`
      依存: なし
      AC: AC7

- [x] T7: `packages/web/src/store/view.ts` に `lastFocusedPaneId` を追加し、`focusPane` の中で
      「変更前の `focusedPaneId` が非 null かつ新しい値と異なるとき」に更新する。`view.test.ts` に
      `focusPane` のトグル追跡のテストを足す（design「振る舞いの詳細」`last_pane` のコード片どおり）。
      対象: `packages/web/src/store/view.ts:242-244`（`focusPane`）・`:346-388`（`return` の公開一覧に
      `lastFocusedPaneId` を追加） / 根拠: design「振る舞いの詳細」
      依存: なし
      AC: AC1, AC2

- [x] T8: `packages/web/src/keys/bindings.ts` の `ACTIONS` に12エントリを追加する（design「インターフェース
      / データ構造」の表どおり。`resize_pane_*` は `ResizeMode.ts` の `RESIZE_STEP` を import して使う。
      `focus_agent` は `indexed: true`）。
      対象: `packages/web/src/keys/bindings.ts`（`workspace / tab` 群の末尾＝`close_tab` の直後・`pane` 群の
      末尾＝`toggle_sidebar` の直後） / 根拠: design「インターフェース / データ構造」の表
      依存: T4
      AC: AC1, AC3, AC5, AC6, AC7, AC8

- [x] T9: `ActionDispatcher` に実行本体を足す。
      - 共有 private ヘルパー `focusWorkspaceById(workspaceId)`（既存 `activateNavigateSelection` の
        workspace 取得〜`workspace.focus` request 部分を抽出）・`focusPaneAcrossViews(paneId)`（新規。
        `Sidebar.vue` の `focusPane` と同じ形）を追加する。
      - `activateNavigateSelection` を `focusWorkspaceById` を呼ぶ形に書き換える（振る舞いは変えない）。
      - `run()` の switch に `workspaceDelta`・`lastPane`・`moveTab`・`agentDelta`・`focusAgentIndex` の
        5ケースを追加し、design「振る舞いの詳細」の擬似コードどおりに private メソッドを実装する。
      対象: `packages/web/src/actions/ActionDispatcher.ts:85-187`（`run()`）・`:554-565`
      （`activateNavigateSelection`）・末尾付近に新規 private メソッド群を追加 / 根拠: design
      「振る舞いの詳細」全節
      依存: T1, T4, T5, T6, T7
      AC: AC1, AC2, AC3, AC4, AC5, AC7

- [x] T10: `ActionDispatcher.test.ts` に、T9 で足した5つの Action 型（`workspaceDelta`・`lastPane`・
      `moveTab`・`agentDelta`・`focusAgentIndex`。対応する `ActionId` は8個）分のテストケースを追加する
      （`workspaceDelta` の巡回・単一 workspace の no-op、`lastPane` のトグル・既に閉じた pane の
      no-op・同一 pane の no-op、`moveTab` が `tab.move` を送ること、`agentDelta` の巡回・0件の
      no-op・現在 focus が一覧に無いときの先頭/末尾、`focusAgentIndex` の直接ジャンプ・範囲外の
      no-op——あわせて11ケース）。既存の `navigate — activate` テストが無変更で通ることも確認する
      （T9 のリファクタの回帰確認）。
      対象: `packages/web/src/actions/ActionDispatcher.test.ts`（新規 `describe` ブロックを末尾に追加） /
      根拠: 既存の `tabDelta`/`navigate up/down` テスト（`:283-297`, `:442-456`）と同じ形
      依存: T9
      AC: AC1, AC2, AC3, AC4, AC5, AC7

- [x] T11: `Sidebar.vue` の `spaces`/`agents` computed を `orderedWorkspaceIds`/`orderedAgentPaneIds` を
      呼ぶ形にリファクタする（振る舞いは変えない。design decisions D4）。`Sidebar.test.ts` を無変更のまま
      通すことで正しさを確認する。表示順と `previous_agent`/`next_agent`/`focus_agent` の操作対象順を
      一致させる非機能要件を、この共有実装によって満たす（AC7 の前提）。
      対象: `packages/web/src/components/Sidebar.vue:28-66` / 根拠: design「振る舞いの詳細」・decisions D4
      依存: T5, T6
      AC: AC7

- [x] T12: `packages/web/src/keys/keymap.ts` の範囲ミスマッチのエラー文言を一般化する（「範囲 1..9 は
      tab の番号選択だけに使えます」→ design「ドメイン固有の考慮」の文言）。`keymap.test.ts:220` の
      部分文字列アサーションを新しい文言に合わせて更新する。
      対象: `packages/web/src/keys/keymap.ts:99-104`・`packages/web/src/keys/keymap.test.ts:220` / 根拠:
      design「ドメイン固有の考慮」（`focus_agent` を2つ目の indexed 操作にする副作用として位置づけている）
      依存: T8
      AC: AC7, AC8

- [x] T13: `bindings.test.ts` を2点直す：(1) `:33` の `expect(a.defaults.length, a.id).toBeGreaterThan(0)`
      を、既定キー無しの12操作を除外する（または `defaults: []` を許容する）形に変える。(2) `:41-42` の
      `indexed.map(...).toEqual(["switch_tab"])` を `["switch_tab", "focus_agent"]`（`ACTIONS` 内の登場順）
      に更新する。冒頭コメント（`:24`「範囲の操作（`indexed`。`switch_tab` だけ）」）の「だけ」も外す。
      対象: `packages/web/src/keys/bindings.test.ts:31-43`・`packages/web/src/keys/bindings.ts:24` / 根拠:
      research「実現性 / リスク」R3
      依存: T8
      AC: AC7, AC8

- [x] T14: `docs/herdr-parity.md` の H26 を更新する（「対象外」列挙から
      「前後の workspace・直前の pane・tab の並べ替え・pane の resize の直接のキー・agent への移動」を
      取り消し線で外す。`scrollback を $EDITOR で開く` は残す）。新しい H26d 行を追加し、実装内容・herdr
      との違い（`tab.move` を `insertIndex` ではなく `direction` にした点等）を記す（H26c の粒度に合わせる）。
      対象: `docs/herdr-parity.md:52`（H26 の行）・H26c の直後に新規行を追加 / 根拠: requirements AC9・
      design「ドメイン固有の考慮」
      依存: T3, T9
      AC: AC9

- [x] T15: 全体回帰確認（`pnpm -s -r test`。既存35操作・prefix・navigate・resize・copy モードのテストが
      無変更で通ることを実測する）。**この項目は coding では消化しない**——`aidev-50-test` 工程で実施し、
      そこでチェックを入れる（decisions.md D7）。test 工程で実施・確認済み（test-result.md 参照）。
      対象: リポジトリ全体 / 根拠: requirements AC10
      依存: T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14
      AC: AC10
