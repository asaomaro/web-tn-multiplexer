# レビュー: 04-mobile（モバイル UI）

## ラウンド 1（2026-09-19）

対象: T1〜T8 の全実装（`packages/web/src/mobile/*`）と、04-mobile が触った横断ファイル
（`packages/web/src/keys/KeyInputController.ts`・`packages/web/src/injection.ts`・
`packages/web/src/term/measure.ts`・`packages/web/src/main.ts`・`packages/web/src/App.vue`・
D86 で修正した `packages/web/src/components/PaneLayout.vue`）。観点は要件適合（AC12・AC-I1・AC-I3・
AC7・AC9・AC17）・価値適合・正確性・規約適合（`.aidev/conventions/` が空のため全件 `[conv:-]`）・
保守性。`decisions.md` の D83〜D86（herdr 実測による判断・意図的な簡略化・test 工程で発見した
`PaneLayout` の実バグ）を前提として読んだ上で、それらでは拾われていない指摘を洗い出した。
`03-web-desktop` の review（D82・`ContextMenu.vue` 等の既存パターン）とも突き合わせて、同種の不具合が
04-mobile 側の新規ファイルに紛れ込んでいないかを重点的に確認した。

- [should] `ExtraKeys.vue` の「Alt」を armed（one-shot／lock）にしたまま「Prefix」ボタンを押すと
  タップが無反応になる。原因は `KeyInputController.applyPendingModifier`（`keys/KeyInputController.ts`）が、
  Prefix ボタンの合成キー（`{key:"b", ctrl:true, alt:false}`。既に `ctrl:true` 済み）にも
  無条件で `alt:true` を重ねてしまうこと。結果の combo が `"ctrl+alt+b"` になり、`KeyRouter.handle`
  （`keys/KeyRouter.ts:79`）の `combo === "ctrl+b"` 厳密一致に外れて prefix へ入れず、かつ `"b"` は
  `INJECT_PASSTHROUGH_BYTES` に無いキーなので `injectKey` は何もしない——タッチのみで再現し、外部
  キーボードは不要（(packages/web/src/keys/KeyInputController.ts:126)）[conv:-]
- [should] `PanePicker.vue`（pane の全画面ピッカー。AC12/AC7 の mobile 版の入口）が `Esc` で閉じられない。
  他のダイアログ（`NameDialog`・`ConfirmDialog`・`HelpDialog`・`GotoPicker`）は native `<dialog>` の
  `Esc` 対応にまかせているが、`PanePicker` は `role="dialog"` の素の `<div>` で `keydown` を一切
  受けておらず、`×` ボタンでしか閉じられない。AC-I1「`Esc`...で閉じる」の精神に反する
  (packages/web/src/mobile/PanePicker.vue) [conv:-]

上記 2 件を修正済み：
1. `applyPendingModifier` に「渡されたキーが既に `ctrl`/`alt` を持っているときは重ねない」ガードを追加
   （`k.ctrl || k.alt` なら早期 return）。pending の状態自体は消費しない——Prefix のような既に完成した
   特殊キーの注入で無駄に消費すると、直後に打つはずだった本来のキーから修飾が失われるため。
2. `PanePicker.vue` に `ContextMenu.vue`（03-web-desktop）と同じ手法（root 要素に `tabindex="-1"` を付け
   マウント時に `.focus()`、その要素で `@keydown.esc` を受ける）で `Esc` 対応を追加した。
   `view.openDialog`／`KeyRouter` のモード同期（`main.ts`）までは踏み込まなかった——`KeyRouter` は
   `terminal` モード中は `ctrl+b` 以外すべて `pass`（`KeyRouter.ts:79`）で実害が無く、`ContextMenu` も
   同じ特性のまま 03-web-desktop の review を通っている。`PanePicker` はタッチが主で外部キーボードの
   併用は稀なエッジケースと判断し、最小の diff（`Esc` 対応の追加のみ）にとどめた（decisions.md D87）。

回帰テストを追加（`KeyInputController.test.ts` に 1 件・`PanePicker.test.ts` に 1 件）。修正後、
`pnpm -s typecheck && pnpm -s lint && pnpm -s test`（733 passed）・`pnpm -s build && aidev smoke`（pass）
を再確認済み。

それ以外に確認した観点（指摘なし、または nit）:
- **(a) `PaneLayout`（D86）と同種の「単一スロットの再利用に `:key` が無い」不具合が他に無いか**：
  `TerminalPane` の呼び出し元は `App.vue`／`mobile/MobileShell.vue` の 2 箇所のみで、どちらも
  `PaneLayout` の `#pane` スロット経由（D86 で修正済みの `:key="singlePaneId"` の内側）——他に同種の
  パターンは無い。
- **(b) `ExtraKeys.vue` の長押し／タップの判定**：`pointerdown`/`pointerup`/`pointercancel` のみで
  `pointerleave`/`pointerout` は無い。指をボタンの外へ滑らせて離した場合、タッチは暗黙のポインタ
  キャプチャ（Pointer Events の実装慣行）で最初にタップした要素が `pointerup` を受け続けるため
  Chromium 実機では機能上問題ないが、明示的な `pointercapture` API は使っていない——nit。
- **(c) `useFitToScreen.ts` の `ResizeObserver`**：`container` が確定した直後に `watch(...,
  {immediate:true})` の `recompute()` と `ResizeObserver` の初回発火が二重に走りうるが、`recompute()`
  は副作用の無い冪等な計算（ref の再代入のみ）なので実害は無い——nit。`disconnect()` は
  `onBeforeUnmount` で確実に呼ばれておりリークは無い。
- **(d) `MobileShell.vue` の `view.focusedPaneId === null` 時の挙動**：`currentPaneLayout` が `null`
  になり pane 領域が空のまま描画される（クラッシュしない）。workspace 作成直後は必ず 1 pane 以上
  存在する設計（herdr 仕様）なので実害は無い。
- **(e) `playwright` の devDependency（`packages/server/package.json`）**：重複や誤ったスコープは無い。
  04-mobile はモバイルエミュレーションでも同じ依存を再利用しており、追加は不要だった。
- AC12・AC-I1・AC-I3・AC7・AC9・AC17：`aidev coverage --strict` で design/tasks の対応を確認済み
  （coding 承認時点）。実装の正しさは本ラウンドのコード読解と、test 工程の実地の確認
  （disposable script。`test-result.md`）で検証した。

## ラウンド 2（2026-09-19・修正の確認）

ラウンド 1 の 2 件の修正を確認した。`aidev coverage --strict` はラウンド 1 時点と同じ結果（gap は AC15
のみ、対象外）——修正が被覆に悪影響を与えていない。`KeyInputController.ts`/`PanePicker.vue` の差分を
再読し、以下を確認した：
- `applyPendingModifier` のガードは `handleDomKey`/`handleTerminalKey`/`injectKey` の全経路で共有されて
  おり、修正の効果は 3 経路すべてに及ぶ（個別に直す必要が無い設計になっていることを確認）。
- `PanePicker` の `Esc` 対応は、選択・×ボタンによる既存の close 経路と衝突しない（`emit("close")` を
  呼ぶ点は共通）。

新規の指摘なし。

## 総評

要件（AC12・AC-I1・AC-I3・AC7・AC9・AC17）・design への対応は `aidev coverage --strict` で被覆漏れが
無いことを確認済み（AC15 は subtask 横断の対応表であり対象外）。D83〜D87 の記録から、herdr との
挙動差・実装時の判断・test/review で発見した不具合のいずれも、根拠と対処が追跡可能な形で残っている。
今回の review で見つかった 2 件（Prefix ボタンと Alt の pending modifier の衝突、`PanePicker` の `Esc`
未対応）はいずれもタッチ主体の基本フロー（disposable script で実地確認済み）を壊すものではなく、
外部キーボード併用時のみ顕在化するエッジケースだったため `should` としたが、原因と直し方が明確で
波及も小さいため、その場で修正・再検証した。デスクトップ側（03-web-desktop）のコードへの影響は
無く、`ContextMenu.vue` 等の既存パターンとの一貫性も確認済み。修正・再検証済みのため、`05-e2e-docs`
へ進めて問題ない。

## タスク点検ログ（T9。coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/web/src/mobile/useVisualViewport.ts ピンチで拡大すると `visualViewport.height` が縮み、fit 中は PTY の行が変わり SIGWINCH が 100ms ごとに出る（T9） / 対応: 修正済
- [nit][conv:-] packages/web/src/mobile/usePaneArea.ts `measure` が paneId を見ず表示領域全体を返す（単一 pane の前提がコードに書かれていない）（T9） / 対応: 修正済
- [nit][conv:-] packages/web/src/mobile/usePaneArea.ts・components/PaneLayout.vue 追従の間隔 100ms と間引きの処理が二重（T9） / 対応: 修正済
- [nit][conv:-] packages/e2e/src/specs/mobile.spec.ts セルの寸法をインラインスタイル（有効数字 6 桁）から割り出し、境界で 1 ずれうる（T9） / 対応: 修正済

## ラウンド 3（2026-09-20・T9（D108）。統合 review ラウンド1 からの差し戻し）

見たもの：統合 review ラウンド1 の 04 の範囲（must 3 のモバイル側の測り方・T29 の点検の「再接続の後の fit」）が解消したか・要件適合
（AC8・AC12・D13）・価値適合（スマートフォンで「この端末に合わせる」が表示領域いっぱいになり、回転・キーボード・再接続の後も効き続ける
——エミュレーションの E2E で確認）。正確さはタスク点検（独立）で見て 4 件（nit）を反映。

指摘なし。

件数（ラウンド1〜3 の通算。タスク点検ログは数えない）：must 0・should 2・nit 3（前回の承認の通算のまま）。
