# レビュー: サイドバーの workspace 行のメニューをキーボードから開く

## タスク点検ログ

- [should][conv:-] T5（`Sidebar.vue`）: 新規テスト3件が「終わった状態」（呼ばれたか・要求が
  消えたか）しか見ておらず、design が明記する「DOM 処理より前に要求を消す」という順序
  （例外安全性）自体を検証できていなかった（呼び出し順を入れ替えても3件とも green のまま
  通ってしまうことを taskcheck が実際に確認）。 / 対応: `openContextMenu` のモックの中で
  「呼ばれた瞬間の `navigateMenuRequested`」を記録する新しいテストを追加した。負の確認:
  実装側の呼び出し順を一時的に入れ替えると新テストが実際に失敗する
  （`AssertionError: expected true to be false`）ことを確認し、元に戻して69件全て pass する
  ことを確認した。 / src: T5 taskcheck round1
- [should][conv:-] T6（`HelpDialog.vue`）: 冒頭の script doc・`navigateBindingText`・
  `navigateEntries` 直前の3箇所の JSDoc が「navigate モードの中の6操作」のまま更新されて
  おらず、`navigate_open_menu`（7件目。移動ではなくメニューを開く操作）を追加した実態と
  食い違っていた。同じ work の `navigateKeys.ts` 側は既に「当初6件→7件目が加わった」という
  注記を足していたのに、`HelpDialog.vue` 側だけ漏れていた。 / 対応: 3箇所とも実態に合わせて
  書き直した（`NAVIGATE_KEYS` カタログの何件目かという表現に統一）。 / src: T6 taskcheck round1

- [should][conv:-] cross: `KeySettings.vue` は設計どおり無改修で7件目
  （`navigate_open_menu`）を自動的に取り込み機能面は正しいが、同ファイル内6箇所の
  JSDoc/コメントが「navigate 6操作」のまま古い表記で残っていた——`HelpDialog.vue`
  （T6）は同種の指摘で既に是正済みだったのに `KeySettings.vue` だけ取り残されていた。 /
  対応: 6箇所とも「navigate 操作」（件数を書かない表現）に統一し、冒頭のコメントに
  「7つ目が加わった」旨の注記を追加した。 / src: cross-task check

すべて指摘どおり修正済み。T1〜T4 は findings 0 で通過。

## レビュー ラウンド1

- [must][conv:-] `ContextMenu.vue` がキーボードで開いている間、矢印キー・`Space` が
  window レベルの keydown listener（`main.ts:274-278`）まで二重配送され、
  `navigateSelection`・メニューの状態が意図せず変化する。根本原因: `ContextMenu.vue`
  の `onKeydown`（127-148行目）は `ev.preventDefault()` は呼ぶが `ev.stopPropagation()`
  を一切呼ばない——`PaneFrame.vue:238-246` の同種ハンドラは明示的に呼んでいる（precedent）。
  `main.ts` の window listener は `view.openDialog` と `document.activeElement` の
  `xterm-helper-textarea` 判定しかガードしておらず、`view.contextMenu` は見ていない。
  `KeyRouter`（`router.mode`）もメニューが開いている間 `"navigate"` のまま変わらない。
  実際に壊れる例: (1) navigate モード中にメニューを開いた状態で矢印キーを押すと、
  メニュー内ハイライトが動くのと同時に `navigateSelection` も別行へ動いてしまう
  （design が明記する「メニューを閉じても navigateSelection は保持される（触らない）」に、
  閉じる前から反する）。(2) `Space` でメニューを開いた直後に次の keydown（OS のキー
  リピート等）が window まで bubble し、`NavigateMode.handle` が再度 `openMenu` action を
  返して `navigateMenuRequested` を再度立て、`Sidebar.vue` の `watch` がメニューを
  再度開いてしまう。design の「`ContextMenu.vue` は無改修」という前提・research.md F8
  （「メニューが開いている間の Escape は NavigateMode.handle には届かない」）は、
  実際には構造的な保証ではなく `restoreFocus()` の戻し先がたまたま `xterm-helper-textarea`
  になる「よくあるケース」に依存した偶然の産物だった。 / 対応: 後述「対応内容」参照。
- [should][conv:-]（正確性 [must] と同根）design は「`PaneFrame.vue` の既存のキーボード
  起動パターンと一貫した実装にする」と謳うが、`PaneFrame.vue` が持つ
  `ev.stopPropagation()` に相当する安全策が `ContextMenu.vue` 側には無く、実際には
  一貫していなかった。 / 対応: 同上の fix で一貫性も回復する。
- [should][conv:-] research.md F8 の記述（「メニューが開いている間の Escape は…
  NavigateMode.handle には届かない」）が、実際には偶然の保護（`restoreFocus()` の戻し先が
  `xterm-helper-textarea` になる場合にだけ成立）に依存した不正確な断定だった。 / 対応:
  fix 後の実際のメカニズム（`stopPropagation()` による構造的な遮断）に合わせて research.md
  を訂正する。
- [should][conv:-] 今回の不具合はどのテストレイヤーにも引っかからない領域だった
  （`main.ts` の window 配線を組み立てる統合テストが無い）。「メニューが開いている間、
  window レベルのキーは届かない」ことを保証する回帰テストを足すことが望ましい。 / 対応:
  `ContextMenu.test.ts` に、実際に `document` レベルの listener を張って keydown が
  届かないことを確認するテストを追加する。
- [nit][conv:-] `Sidebar.vue:185` の `` `[data-drop-workspace-id="${workspaceId}"]` ``
  （テンプレートリテラルでの属性セレクタ構築）について、workspaceId がサーバ生成の
  内部 id 限定であることが design で明記されている点は良い、との指摘（対応不要）。

### 対応内容

`ContextMenu.vue` の `onKeydown` に `ev.stopPropagation()` を追加する（`PaneFrame.vue` と
全く同じパターン）——`ContextMenu.vue` は「変更しない」対象だったが、design.md「対象範囲」に
この1行を追記し、design を修正して実装する（design への差し戻し）。`research.md` F8 の
記述も、修正後の実際のメカニズムに合わせて訂正する。`ContextMenu.test.ts` に、window
レベルへの二重配送が実際に起きないことを確認する回帰テストを、負の確認（regression-
negative-control.md 準拠）つきで追加する。

## レビュー ラウンド2

round1 の must（`stopPropagation()` 欠落）への対応を確認した。`ContextMenu.vue` の
`onKeydown` 4分岐すべてに `ev.stopPropagation()` が入っていること（抜けなし）・
`PaneFrame.vue` との書き方の一致・新規テスト2件が実際に window レベルの二重配送を検知
できること（負の確認で実証済み）・`vitest run`（`ContextMenu.test.ts` 28件・web パッケージ
全体1948件）・`vue-tsc --noEmit` とも green であること・`stopPropagation()` の追加が他の
window/document レベルの keydown listener（`MouseBridge.ts` の capture phase・`Sidebar.vue`/
`PaneFrame.vue` の drag 中の Escape 用）と衝突しないことを確認した。

- [nit][conv:-] `ContextMenu.vue` の Enter/Space 分岐だけ `stopPropagation()` の直後に
  不要な空行があり、他の3分岐と書式が不統一だった。 / 対応: 空行を削除した。

新たな must/should の指摘なし。
