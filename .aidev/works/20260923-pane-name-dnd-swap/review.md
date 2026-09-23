# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [should][conv:-] packages/server/src/surface/methods/pane.ts:81 `pane.swap_with` だけ `sizeAuthority.noteInteraction` の呼び出しを `if (ok)` で条件分岐しており、無条件で呼ぶ兄弟ハンドラ（`pane.swap` 等）と一貫しない / 対応: 修正済（T3・ラウンド1。無条件呼び出しに統一）
- [should][conv:regression-negative-control] packages/web/src/components/PaneFrame.test.ts:400-423 の AC6 テスト（自分自身・pane 以外へのドロップ）が `swapPanesByDrag` 未呼び出ししか確認せず、`view.paneDrag` が `null` に戻ることを確認していなかった / 対応: 修正済（T6・ラウンド1。両ケースに `expect(useViewStore(pinia).paneDrag).toBeNull()` を追加）
- [should][conv:regression-negative-control!] D6（PaneFrame.vue:130-131 のフォーカス委譲）の回帰テスト（PaneFrame.test.ts:380-398）が「修正前のコードで落ちる」ことを未確認だった（規約が要求する記録が無かった） / 対応: 修正済（T6・ラウンド1）。該当2行を一時的に削除し `pnpm --filter @wtm/web test -- --run PaneFrame -t "入れ替え後、ドラッグした pane にフォーカスが残る"` を実行した生の出力:
  ```
  AssertionError: expected 'p9' to be 'p1' // Object.is equality
  Expected: "p1"
  Received: "p9"
   ❯ src/components/PaneFrame.test.ts:408:47
  ```
  確認後に2行を復元し、`git diff --stat` が復元前と同一（158 insertions(+), 14 deletions(-)）であることを確認、`pnpm --filter @wtm/web test -- --run PaneFrame` で31件 green に戻ったことを確認済み。
- [nit][conv:regression-negative-control] `DRAG_THRESHOLD_PX`（6px）の境界値（ちょうど6px）を検証するテストが無く、`<` を `<=` に変える変異等を検出できなかった / 対応: 修正済（T6・ラウンド1。ちょうど6pxでドラッグが始まることを確認するテストを追加）
- [should][conv:-] `paneDrag`（T4）のドラッグ中にモーダルダイアログが開いても取り消す経路が無かった。design が precedent として引用する `Sidebar.vue` の幅ドラッグには同じ状況で `endDrag()` を呼ぶ `watch(() => view.openDialog, ...)` があり（`showModal()` で文書が inert になったときポインタ捕捉が外れるか確かめた出所が無いため）、新しいドラッグはこれを踏襲していなかった / 対応: 修正済（cross・ラウンド2。`PaneFrame.vue` に同じ `watch` を追加し、`isDragSource` のときだけ `cancelDrag()`。回帰テストを追加し、`watch` を無効化すると落ちることを確認して復元済み）

## ラウンド 1（2026-09-23）

- [must][conv:-] `.pane-frame-name` の `pointer-events` を `none`→`auto` に変えた結果、DOM順で `.pane-frame-edge` より後に描画される名前ラベルが、その真上を覆うようになった。名前ラベルには `@contextmenu` ハンドラが無く、兄弟要素（`.pane-frame-edge`）なのでバブリングでも拾えないため、名前ラベルの上での右クリックが枠まで届かず pane のメニューが開かなくなっていた（AC-I5 の「右クリックでのメニューに影響しないこと」に対する回帰）。coding のタスク点検・cross 点検はいずれも `pointer-events: auto` の範囲が名前ラベルに限定されていることまでしか確認しておらず、右クリックの経路までは見ていなかった / 対応: 修正済（`.pane-frame-name` にも `@contextmenu="onContextMenu"` を追加。回帰テストを追加し、ハンドラを外すと落ちることを確認して復元済み）
- [should][conv:-] `onNamePointerDown` にテキスト選択を防ぐ処置（`user-select: none`）が無く、掴み手そのものが文字列であるため、実ブラウザでドラッグ中にテキストがハイライトされる余地があった（`Sidebar.vue` の幅ドラッグの帯とは違い実害がある） / 対応: 修正済（`.pane-frame-name` に `user-select: none` を追加）
- [should][conv:-] requirements.md AC1「境界線が常に見え」という文言と、実装（名前が無い pane では境界線ごと表示しない）の関係が decisions.md に記録されておらず、解釈が追跡できなかった / 対応: 修正済（decisions.md D9 に「常に見える」は名前が実際に表示される pane に限る、という解釈を記録）
- [should][conv:-] decisions.md D7 が「PTY の行数が減ることを docs/verification.md へ追記する」と明記していたが、本 work の diff に該当箇所が無かった / 対応: 修正済（docs/verification.md に本機能の検証項目を追加。PTY 行数の実測手順・右クリックメニューの確認を含む）
- [should][conv:regression-negative-control] `onBeforeUnmount` の「ドラッグ元の pane 自身が消えたら `cancelDrag()`」（別クライアントの close 等）に対応するテストが無かった（design「エラー処理」節が想定する異常系の片割れ） / 対応: 修正済（回帰テストを追加し、判定を無効化すると落ちることを確認して復元済み）
- [nit][conv:-] `showBorder`/`reserveNameSpace` の JSDoc コメントが、対応する行とずれて連続配置されており可読性を下げていた / 対応: 修正済（それぞれ対応する行の直前に置き直した）

## ラウンド 2（2026-09-23）

別コンテキストでラウンド1の5件それぞれの解消を確認（must・should の2件は対応箇所を一時的に無効化し実際に落ちることを確認した上で復元）。修正差分自体が持ち込んだ新しい must/should も無し。指摘なし。
