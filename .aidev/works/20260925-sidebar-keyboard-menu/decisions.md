# 決定記録

## D1: 負の確認（regression-negative-control.md 準拠）の実施記録

- 背景: T4（`ActionDispatcher.ts` の `openMenu` case）・T5（`Sidebar.vue` の `watch`）は
  この work の中核ロジックで、design が明示的に要求する挙動（DOM 非依存・一度きりのトリガー）
  を検証する新規テストを書いた。規約に従い、実装を一時的に外して新規テストが実際に失敗する
  ことを確認した。
- 決定: 両方とも負の確認を実施し、下記の生ログのとおり実際に red になることを確認、実装を
  戻して green に戻ることを再確認した。
- 影響: コードへの影響なし（検証行為のみ）。以下に生ログを残す。

### T4（`ActionDispatcher.navigate` の `case "openMenu"`）を外した場合

```
FAIL  src/actions/ActionDispatcher.test.ts > ActionDispatcher — navigate > openMenu: 選択があれば navigateMenuRequested を立てる。DOM には一切触れない（20260925-sidebar-keyboard-menu。design「設計方針」）
AssertionError: expected false to be true // Object.is equality
 ❯ src/actions/ActionDispatcher.test.ts:718:40
```

修正を戻すと該当テスト・`ActionDispatcher.test.ts` 全143件とも pass。

### T5（`Sidebar.vue` の `watch`）を外した場合

```
FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > navigateMenuRequested が立つと、選択中の行の位置で UiPort.openContextMenu を呼び、要求を消す
AssertionError: expected "vi.fn()" to be called with arguments: [ { kind: 'workspace', …(1) }, …(1) ]
Number of calls: 0
 ❯ src/components/Sidebar.test.ts:153:29

FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > navigateMenuRequested が立っても選択が無ければ何も呼ばない
AssertionError: expected true to be false // Object.is equality
 ❯ src/components/Sidebar.test.ts:165:40

FAIL  src/components/Sidebar.test.ts > Sidebar — spaces > 該当する行の DOM が見つからなければ {x:0,y:0} にフォールバックする（design「エラー処理 / 異常系」）
AssertionError: expected "vi.fn()" to be called with arguments: [ { kind: 'workspace', …(1) }, …(1) ]
Number of calls: 0
 ❯ src/components/Sidebar.test.ts:176:29
```

修正を戻すと該当3件・`Sidebar.test.ts` 全68件とも pass。

## D2: `navigateKeys.test.ts`・`navigateKeymap.test.ts`・`HelpDialog.test.ts`・
   `KeySettings.test.ts` の既存テストが、7件目のカタログエントリ追加で実際に壊れた

- 背景: T2（`navigateKeys.ts` に `navigate_open_menu` を追加）は、design が想定したとおり
  カタログ機構を汎用のまま使う変更だが、既存のテスト側に「6操作」を前提にした**ハードコード**
  （件数・配列の厳密一致・`rows[N]` の絶対インデックス参照）が複数あり、追加した瞬間に
  複数のテストファイルで実際に失敗した。design.md・tasks.md はこれを予見していなかった
  （設計時点では「カタログ機構は既存6件を無改修で扱える」という前向きな事実だけを確認して
  いたが、既存テスト側の脆さまでは調べていなかった）。
- 決定: 実際に壊れた既存テストを、この work の一部として修正する（新しい機能追加が既存の
  同じ関心事のテストを壊した場合は、その場で直すのがこのセッションの一貫した扱い）。
  - `navigateKeys.test.ts`: `toHaveLength(6)`→`7`、id 一覧の厳密一致に `navigate_open_menu`
    を追加、action の厳密一致にも追加。
  - `navigateKeymap.test.ts`: 既定の割り当て確認に `navigate_open_menu`→`space` を追加、
    `ownerOf`/`actionFor` の確認にも追加。
  - `HelpDialog.test.ts`: 「移動」群の `dt` 厳密一致配列に `"space"` を挿入（3箇所: 初期表示・
    割り当て変更後・矢印の固定フォールバック確認）。3件目は `rows[3]`（旧・pane 左）が
    `rows[4]` にずれたため、絶対インデックス参照も直した。
  - `KeySettings.test.ts`: `.keys-details` の総数 `toHaveLength(55)`（"49 + navigate 6" の
    コメント付き）を3箇所とも `56`（"49 + navigate 7"）に修正。`navigate_open_menu` の一覧
    表示テストを新設（`navSummaryText("navigate_open_menu")` が `"space"` になること）。
- 理由 / 代替案: 既存テストを壊れたまま放置する選択肢は無い（回帰）。ハードコードされた
  絶対値・絶対インデックスへの依存自体を構造的に無くす（例えば `toHaveLength` を動的な
  `NAVIGATE_KEYS.length` 参照に変える）ことも検討したが、既存のテストの書き方（このリポジトリの
  他のテストも具体的な期待値をそのまま書く流儀）を踏襲し、この work の範囲を超える既存テストの
  リファクタリングはしなかった。
- 影響: `packages/web/src/keys/navigateKeys.test.ts`・`navigateKeymap.test.ts`・
  `packages/web/src/components/HelpDialog.test.ts`・`KeySettings.test.ts`。実装コード
  （`navigateKeys.ts` 本体）への影響は無い。

## D3: taskcheck（T5・T6）の指摘への対応

- T5 round1（should）: 新規テスト3件が「DOM 処理より前に要求を消す」という順序（design
  「エラー処理 / 異常系」の例外安全性の根拠）自体を検証できていない、という指摘。対応:
  `openContextMenu` のモックの中で「呼ばれた瞬間の `navigateMenuRequested`」を記録する
  テストを追加した。負の確認: `Sidebar.vue` の `clearNavigateMenuRequest()` の呼び出しを
  一時的に `actions?.openContextMenu(...)` の後ろへ移すと、新テストが実際に
  `AssertionError: expected true to be false`（`Sidebar.test.ts:198`）で失敗することを
  確認し、順序を戻すと69件全て pass することを確認した。
- T6 round1（should）: `HelpDialog.vue` の JSDoc 3箇所が「6操作」のまま更新されておらず、
  `navigateKeys.ts` 側で既に行った「当初6件→7件目が加わった」という注記との食い違いがある、
  という指摘。対応: 3箇所とも `NAVIGATE_KEYS` カタログの何件目かという表現に書き直した。
- 影響: `packages/web/src/components/Sidebar.test.ts`（テスト追加のみ）・`HelpDialog.vue`
  （コメントのみ）。実装の振る舞いへの影響は無い。

## D4: `ContextMenu.vue` に `ev.stopPropagation()` を追加する（review round1 must）

- 背景: review round1 で、`ContextMenu.vue` の `onKeydown`（`ev.preventDefault()` は呼ぶが
  `ev.stopPropagation()` を一切呼ばない）と、`main.ts` の window レベルの keydown listener
  （`view.openDialog`・`xterm-helper-textarea` しかガードせず `view.contextMenu` を見ていない）
  の組み合わせにより、navigate モード中にメニューを開いた状態で矢印キー・`Space`・`Escape` を
  押すと、メニュー内の処理と**同時に**同じキーが window まで bubble し、`KeyRouter` が
  `"navigate"` モードのまま `NavigateMode.handle` へ渡してしまうことが発覚した。実害:
  (1) 矢印キーでメニュー内ハイライトが動くのと同時に `navigateSelection` も別行へ動く
  （design が明記する「メニューを閉じても navigateSelection は保持される（触らない）」に、
  閉じる前から反する）。(2) `Space` でメニューを開いた直後の次の keydown で `openMenu`
  action が再発火し、`Sidebar.vue` の `watch` がメニューを再度開いてしまう。
  design.md「依拠する既存の事実」F7・F8（研究時点）は「実 DOM フォーカスがメニュー自身に
  あるため他の経路には届かない」という誤った前提に基づいていた（実際は `stopPropagation()`
  が無ければ bubble する）。
- 決定: `ContextMenu.vue` の `onKeydown` の4分岐すべてに `ev.stopPropagation()` を追加する
  （`PaneFrame.vue:238-246` の既存パターンと同じ）。`ContextMenu.vue` は design.md 当初
  「変更しない」対象だったが、design を修正しこの1行の変更を対象範囲へ追加した。
- 理由 / 代替案: `main.ts` の window listener 側に `if (view.contextMenu) return;` を足す
  代替案も検討したが、(1) `PaneFrame.vue` に既に存在する確立したパターンとの一貫性を
  優先し、(2) `main.ts` にはこの種のロジックを検証する既存のテスト基盤が無く
  （`main.ts` 用のテストファイルが存在しない）、`ContextMenu.test.ts`（既存のコンポーネント
  テスト基盤がある）で直接・具体的に検証できる方を選んだ。
- 影響: `packages/web/src/components/ContextMenu.vue`（4箇所に `stopPropagation()` 追加）・
  `packages/web/src/components/ContextMenu.test.ts`（新規2件: 矢印キー・Escape/Enter が
  window まで二重配送されないことを実際に `window.addEventListener` を張って確認）・
  `research.md` F8 を訂正・`design.md`「対象範囲」に `ContextMenu.vue` を追加。負の確認:
  `stopPropagation()` を4箇所とも一時的に外すと、新規テスト2件が実際に失敗する
  （`expect(onWindowKeydown).not.toHaveBeenCalled()` が red）ことを確認し、戻すと
  `ContextMenu.test.ts` 全28件・typecheck とも green に戻ることを確認した。
