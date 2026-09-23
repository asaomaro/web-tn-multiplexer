# レビュー: キーの設定の使い勝手

## タスク点検ログ

- T1（`assign.ts` の `conflict` フィールド）: 0 件。
- T2（`chordDisplay.ts`）: 2 件（nit 1・should 1）。`layoutChar.length !== 1` の防御的な分岐が
  design のコード例と食い違って見える点（nit）はコメントで理由を明記。その分岐のテストが
  無かった点（should）は新規テスト（デッドキー合成途中を想定した多文字・空文字のケース）を
  追加し、`.aidev/conventions/regression-negative-control.md` に従い変異で落ちることを確認した。
- T3（`store/settings.ts`）: 1 件（nit）。design.md「US4」節に、D4（`storage` イベント追従を
  意図的に足さない）と矛盾する古い記述（`statusSymbols` と同じ形＝`storage` イベント追従込み）が
  残っていた。該当箇所を訂正した。
- T4（`KeyboardLockController.ts`）: 1 件（should）。AC14 の「reject」経路（`.catch(() =>
  undefined)`）を検証するテストが、実際には同期的な `throw` しか検証しておらず無効だった
  （taskcheck が `.catch()` だけを外す変異で確認）。新しいテストを追加する過程で、
  `window` の `unhandledrejection` イベント（happy-dom）・Node の `process` レベルの
  `unhandledRejection`（`setTimeout` で 1 周回しても）のいずれも、`vi.fn()` が戻り値の
  Promise を内部で消費するため検出できないことが分かった（`.aidev/conventions/
  regression-negative-control.md` の趣旨どおり、自分でも変異させて空振りを確認したうえで
  手法を変更）。最終的に、戻り値の `.catch` メソッドを直接差し替えて呼び出し回数を数える形に
  書き直し、`.catch()` を外すと実際に落ちる（呼び出し回数が0になる）ことを確認した。

- T5（`main.ts` の配線）: 0 件。
- T6（`KeySettings.vue` の US1・US2）: 1 件（should）。AC-I10 の新規テストが、実際には
  「こちらへ移す」ボタンが出ている状態を一度も作らずに既存ボタンの存在だけを確認しており、
  既存の別テストと実質重複していた（追加した並びを崩す回帰を検知できていなかった）。衝突を
  起こしてボタンを実際に出した状態で確認する形に修正し、変異で検出力を確認した。
- T7（`KeySettings.vue` の US3・US4）: 0 件。`onMounted` の macOS+`getLayoutMap` 分岐・チップの
  表示用/機能用の値の分離（AC10）・switch の markup/CSS が design と decisions（D5）に一致することを
  確認。`list.map(displayFor)` → `list.map((b) => b)` の変異で AC8 のテストが実際に落ちることも確認済み。
- T8（`key-bindings.spec.ts` の E2E）: 2 件（should 1・nit 1）。実装中に、この E2E 環境が実は
  `navigator.keyboard` を持つ（decisions D6）ことが分かり、tasks.md 原文の想定を訂正して4本を書いた。
  (should) tasks.md の T8 は AC-I3・AC-I8（絞り込み欄・「こちらへ移す」への Tab のみでの到達）を
  `AC:` に挙げていたが、新規テストは `.fill()`/`.click()` で直接操作しており、実際の Tab 到達を
  検証していなかった（既存の「キーボードだけで通せる」テストという先例があるのに踏襲していなかった）。
  絞り込みのテストに「prefix の［変更］から Tab で絞り込み欄へ入り、一致した行まで Tab で辿り着く」、
  「こちらへ移す」のテストに「押した［追加：prefix の後］から Tab で「こちらへ移す」まで辿り着き
  Enter で押せる」をそれぞれ足して直した。(nit) Keyboard Lock の switch のテストが「表示も変わらない」
  と謳いながら switch を切り替える前の表示しか確認しておらず、切り替え後の再確認が無かった点は、
  切り替え後にもう一度同じ表示を確認するアサーションを足して直した。
- cross（T1〜T8 横断）: 3 件（should 3）。(1) 節「キー」の prefix 行（`.keys-prefix .keys-binding`）が
  `displayFor` を経由せず `settings.keymap.prefix` を生で表示しており、prefix 自体を `alt+<文字>`
  にしている macOS の非 US 配列の利用者には AC8 の表示補正が効かなかった
  （`bindingsText`・chip 一覧は経由していたのに prefix 行だけ取り残されていた）→
  `displayFor(settings.keymap.prefix)` に直し、`KeySettings.test.ts` に prefix 側の置き換えを
  確かめる新規テストを足した。(2) chip の［変更］［削除］ボタンの `aria-label` が生の binding
  文字列を埋め込んでおり、可視の `<code>`（`displayFor(b)`）と食い違っていた（読み上げでは
  補正前の chord が聞こえる）→ 両方の `aria-label` を `displayFor(b)` 経由に直し、新規テストで
  `aria-label` の文言と `data-change`（機能用の生の値）の両方を確認した。(3) `main.ts` の
  `keyboard: navigator.keyboard ?? null` の配線を壊す変異（`keyboard: null` に固定）をしても、
  typecheck・単体テスト・既存の E2E のどれも検出しなかった（AC12・AC13 の「実際に効く経路」は
  decisions D6 により手動確認へ意図的に回しているが、「main.ts の配線自体が生きているか」を
  見る自動テストが1つも無かった）→ この環境は実際に fullscreen と `keyboard.lock()` が動く
  （decisions D6）ことを利用して、実際に全画面へ入り `keyboard.lock()` が `LOCKED_CODES` で
  呼ばれ、抜けると `unlock()` が呼ばれることを確認する E2E を新規に足した（OS・ブラウザ側の
  実効果自体は変わらず手動確認の対象。ここで閉じたのは「呼ばれたか」という配線の生死だけ）。
  3件とも `packages/web/src/components/KeySettings.vue`・`KeySettings.test.ts`・
  `packages/e2e/src/specs/key-bindings.spec.ts` で修正し、修正前の状態に戻す変異で新規テストが
  実際に落ちることを自分で確認したうえで復元し、型検査・単体テスト（1505件）・E2E
  （`key-bindings.spec.ts` 19件）が全部通ることを再確認した。

## レビュー ラウンド1

要件適合（`requirements.md` の AC1〜AC14・AC-I1〜AC-I12 を1件ずつ実装と突き合わせ）・価値適合
（背景/課題の4項目それぞれに対応する解決策になっているか）は、taskcheck・cross 点検の対象外
（`protocol-check.md`）なのでこの工程で確認した。`aidev coverage --strict` は
`coverage-gaps: struct=0 cover=0`。正確性・規約適合・保守性は taskcheck（T1〜T8）・cross で
既に深く点検済みだが、この工程でも差分全体を通しで読み直し、以下の1件を新たに見つけた。

- [must][conv:-] 「こちらへ移す」ボタン（`data-move-here`）が、案内文（`.keys-message`）の
  すぐ後ろに置かれているが、**sticky で画面下に固定されているのは `.keys-message` 単体だけ**で、
  ボタン自身は sticky ではない普通の要素として `.keys-message` の「固定されていない本来の位置」の
  直後に続く。節「キー」の一覧を少し下へスクロールしただけで、案内の帯は画面の下端に張り付いて
  見えるのに、ボタンはダイアログの可視領域のかなり外（実測: ダイアログの高さ 704px に対しボタンの
  y 座標が 1880px 前後）に取り残される。`toBeVisible()` は CSS の可視性だけを見て表示領域内かは
  見ないため、既存の E2E テスト（`.click()` は自動スクロールする・Tab 到達のループも表示領域を
  問わない）はこの不具合をすり抜けていた。`boundingBox()` で実測して発見。AC4（「こちらへ移す」
  ボタンが出る）・AC-I6（「案内文の直後に現れる」）は文字どおりには満たしているが、**この work の
  目的そのもの（衝突をその場で解決する使い勝手）を裏切る**——スクロールして探さないと押せない
  ボタンは、事実上「その場で解決」になっていない。
  — 根拠: `packages/web/src/components/KeySettings.vue`（修正前の `.keys-message` 単体の
  `position: sticky`）
  — 対応: 案内文とボタンを `.keys-status-band` という1つの sticky コンテナへまとめ、両方が常に
  一緒に画面内へ来るようにした。既存の WCAG テスト（「下に固定した結果の文は…隠さない」）が
  `.keys-message` の boundingBox を測っていた箇所を `.keys-status-band` に直し（固定される帯自体が
  変わったため）、新規に「ボタンが追加のスクロール無しでダイアログの可視領域内に収まる」ことを
  実測するテストを足した。修正前の状態に戻す変異でこの新規テストが実際に落ちる
  （`Received: 1908.5` に対し期待 `<= 713`）ことを確認したうえで復元し、型検査・単体テスト
  （1505件）・E2E（`key-bindings.spec.ts` 20件）が全部通ることを再確認した。