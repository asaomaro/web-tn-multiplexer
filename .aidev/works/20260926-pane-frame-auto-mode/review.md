# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）

- [should][conv:regression-negative-control] `packages/web/src/layout/paneChrome.test.ts` `resolvePaneChrome` の辺の対応を右の辺でしか縛っておらず、`top: pad("bottom")` 等 4 つの変異が生き残った / 対応: 修正済（T1・ラウンド1。隣が 1 辺だけの入力を 4 辺とも試すテストを足し、4 変異とも落ちることを確認）
- [nit][conv:regression-negative-control] `packages/web/src/actions/ActionDispatcher.test.ts:975-979` 壊れた値の reloadConfig のテストで、ストアが最初から既定値のため追加行を消しても通っていた / 対応: 修正済（T6・ラウンド1。読み直す前にストアを既定以外にした）
- [should][conv:-] `packages/web/src/components/PaneFrame.vue` `.pane-frame-edge-flush:focus-visible` が枠そのものに `pointer-events: none` を付けており、余白が一部残る pane ではキーボードで枠にフォーカス中、残った余白の押下・右クリックが枠に届かない / 対応: 修正済（T3・ラウンド1。線を `::after` 疑似要素に移し、そちらだけ `pointer-events: none`。decisions D7）
- [nit][conv:-] `packages/web/src/components/PaneFrame.vue` 余白を inline style に移した後も、消した CSS 規則（`.pane-frame-enabled` の 4px・`.pane-frame-enabled-named`）を前提にしたコメントが 2 か所残っていた / 対応: 修正済（T3・ラウンド1）
- [nit][conv:-] `packages/web/src/components/PaneFrame.vue` `::after` の線（z-index:1）が xterm のスクロールバー（z-index:11）に一部隠れる / 対応: 修正済（T3・ラウンド2。z-index を 12 にした）
- [should][conv:regression-negative-control] `packages/web/src/components/SettingsDialog.test.ts` ラジオの `@change` を値固定（`'auto'`）に変えてもテストが通った（"auto" しか選んでいなかった） / 対応: 修正済（T5・ラウンド1。3 値とも選ぶテストにし、値固定の変異で落ちることを確認）
- [nit][conv:-] `packages/web/src/components/SettingsDialog.test.ts` 新しい describe がテーマの節のコメントと describe の間に割り込んでいた / 対応: 修正済（T5・ラウンド1）
- [nit][conv:-] `docs/verification.md` フォーカスの線を「白い線」と書いていたが色はテーマの文字色 / 対応: 修正済（T7・ラウンド1）
- [nit][conv:-] `docs/herdr-parity.md:46` 描画モードの名前が設定画面の文言（分割しているときだけ）と違っていた / 対応: 修正済（T7・ラウンド1）
- [nit][conv:-] `packages/web/src/components/PaneLayout.vue:124` zoom 中に `NO_NEIGHBORS` を渡す分岐は、zoom を root だけが受け root は常に隣なしのため効かず、テストも拘束していなかった / 対応: 修正済（T4・ラウンド1。分岐を消して `ownNeighbors` を渡し、理由をコメントに書いた）
- [nit][conv:-] `packages/web/src/components/SettingsDialog.vue:703` 説明文が「枠を表示しない pane では右クリックの経路が無くなる」と言い切っていたが、隙間が入なら隣と接する辺の余白は残り押せる / 対応: 修正済（cross・ラウンド1。「余白の無い辺（外周の辺と、隙間を切ったときの隣と接する辺）では」と範囲を限った）

## ラウンド 1（2026-09-26T02:57Z。独立レビュー〔別コンテキスト・opus〕）

- [should][conv:-] `docs/verification.md:271-272` 新しい確認手順が「どの組み合わせでも列・行数が余白に合わせて変わる」を期待値にしているが、余白の変化は 1 辺 2〜6px で 1 セルに届かないことがあり、直前の太さの手順の但し書き（変わらないこともある）と食い違う / 対応: 差し戻し（coding）
- [nit][conv:-] `packages/web/src/components/SettingsDialog.vue:702-711` 説明文が「枠を表示しないとき」だけに触れ、「常に」で隙間を切ったときも隣と接する辺では右クリックの経路・選択の強調が無くなることに触れていない / 対応: 差し戻しに合わせて修正

## ラウンド 2（2026-09-26T03:05Z。前ラウンドの指摘の解消とその差分に絞って確認）

- 指摘なし。ラウンド 1 の should（`docs/verification.md` の期待値）は既存の太さの手順と同じ但し書きに揃い、nit（説明文）は隙間切の場合まで
  広げたうえで隙間のスイッチにも同じ説明を `aria-describedby` で結んだ（SettingsDialog.test で確認）。再テスト green・smoke pass。
- walkthrough.md は書かない（差分は中程度〔実装 16 ファイル・約 520 行〕で、モジュール境界の移動も複雑な制御フローも無い。規則は design.md の表で読める）。
