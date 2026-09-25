# レビュー: keydown を止めるボタンにフォーカスが残っていても prefix・直接のキーを効かせる

## レビュー指摘（ラウンド2）

- [nit][conv:-] tasks.md T6 の「依存: T1」が、AC4（tab バー）テストが実際には
  `TabBar.vue`（T2 が追加した `onButtonKeydown`）に依存している事実を反映していなかった
  （T6 は AC1・AC2＝Sidebar＝T1 と AC4＝TabBar＝T2 の両方を検証するテストを含む）。実害は
  無い（T6 追加時点で T1・T2 は既に完了済み）が、依存記録の正確性のため修正。
  / 対応: 「依存: T1, T2」に修正した。
- [nit][conv:-] review.md の締めの総括段落が、T3・cross の round1→round2 の遷移
  （「修正後 round2 で findings 0」）は明記する一方、同じ経過を辿った T6 について同様の
  一文が無かった。 / 対応: T6 の round1（4件）→round2（0件）を追記した。

## レビュー指摘（ラウンド1）

- [should][conv:-] この work の核心的価値（AC1/AC2/AC4：対象ボタンにフォーカスが残ったまま
  prefix・直接のキーが実際に効く）が、実ブラウザでの観測ではなく、happy-dom 上で「合成
  keydown が `window` の `vi.fn()` へ到達するか」という間接的な signal（`Sidebar.test.ts`/
  `TabBar.test.ts` の新設テスト）だけで確認されている。requirements.md AC1（85-89行目）は
  「単体テストでは全6箇所を、代表性を要する確認（E2E 等）では代表1箇所を確認すれば足りる
  ——確認の粒度は design/tasks で確定する」と E2E 確認の選択肢を残していたが、design.md
  「受け入れ基準との対応」AC1/AC2/AC4（143-158行目）はその選択について特段の理由を記さない
  まま単体テストのみに絞り、tasks.md にも新規 E2E タスクは無かった。実ブラウザで「ボタンを
  クリックしてフォーカスを残したまま prefix キーを押すと実際に prefix モードへ入り、続く
  キーが効く」ことを示す E2E は既存・新規とも存在しなかった。 / 対応: `key-bindings.spec.ts`
  のAC5テストと同型（ボタンをクリック→フォーカスが残ることを確認→prefixキー→効果を確認）
  の代表1箇所（＋新規ボタン）の E2E を新設した（新タスク T6）。requirements.md AC7・
  design.md の該当節を、この追加を反映する形に更新した。詳細は decisions.md D5 参照。
  / src: review round1

## タスク点検ログ

- [must][conv:-] T3（`docs/verification.md`）: 「pane の枠は Enter・Space・↓・ContextMenu・
  Shift+F10 の keydown を無条件に止める」という記述が不正確だった。`PaneFrame.vue:238-246`
  の `onKeydown` は `if (!opens || ev.ctrlKey || ev.altKey || ev.metaKey) return;` で
  修飾キー（Ctrl・Alt・Meta）を見てから止めており、真に無条件ではない。「無条件」は
  この work では修正前の Sidebar/TabBar の `@keydown.stop`（キー種別を一切問わず止める
  挙動）を指す語として使っていたため、pane の枠に転用すると逆方向の誤解（pane の枠を
  旧 Sidebar 並みの無選別な停止と誤読させる）を招く。 / 対応: 「無修飾の Enter・Space・
  ↓・ContextMenu・Shift+F10 の keydown を止める（修飾キー付きは止めない）」に書き直した。
  / src: T3 taskcheck round1
- [nit][conv:-] T3（`docs/verification.md`）: サイドバー折りたたみボタンは状態で切り替わる
  字形を「«/»」と両方明記したのに対し、グループ折りたたみボタン（`Sidebar.vue:425`。
  `{{ row.collapsed ? "▸" : "▾" }}` で同様に2字形を持つ）は「▸」のみの表記で、同一文内で
  精度の粒度が揃っていなかった。 / 対応: 「▸/▾」に統一した。 / src: T3 taskcheck round1

T1・T2・T4 は findings 0 で通過。

- [should][conv:-] T6（`key-bindings.spec.ts`）: 新設テストが「AC4」を名乗っていたが、
  `Sidebar.vue` のボタンしか操作しておらず、design が「`Sidebar.vue`/`TabBar.vue` は
  モジュールを共有しない」としたとおり別々の `onButtonKeydown`（同型だが同一参照ではない）
  である以上、`TabBar.vue` 側のコピペ漏れ等はこのテストでは検知できなかった。
  / 対応: `TabBar.vue`「＋」ボタン（`.focus()` を使用——`.click()` は名前入力ダイアログを
  開いてフォーカスを奪う副作用を持つため）を対象にした独立のテストを追加した。
  / src: T6 taskcheck round1
- [should][conv:-] T6（`key-bindings.spec.ts`）: 新設テストが「AC2」を名乗っていたが、
  実際に送っていたのは prefix 経由（`prefixKey`）のみで、AC2 が指す「prefix を経由しない
  直接のキー」の経路を一度も送っていなかった。 / 対応: `openWithPrefs` で
  `ctrl+alt+d` を割り当てた独立のテストを追加し、prefix 経由（AC1）と直接キー経由（AC2）
  を別テストで確認する形にした。 / src: T6 taskcheck round1
- [should][conv:-] T6: 対象ボタンの選定・確認方法を「＋新規ボタン」「`.focus()`」から
  「並び順ボタン」「`.click()`」へ変更したのに、requirements.md・design.md が旧記述の
  まま更新されておらず、decisions.md（実装の実態）と食い違っていた。 / 対応:
  requirements.md「対象」節・AC8、design.md「受け入れ基準との対応 AC8」を実装（3テストへ
  分割した現状）に合わせて更新した。 / src: T6 taskcheck round1
- [should][conv:regression-negative-control!] T6: decisions.md D5 の負の確認ログが、
  同じ work の D1・D2 と比べて要約寄りで、規約が求める「生の出力」の水準に達していな
  かった。 / 対応: 3テストぶんの Playwright の失敗ブロック（テスト名・行番号・
  `expect.poll` の期待値/実際値・呼び出し箇所）と、復元後の再実行結果（`23 passed`・
  無関係な既存失敗1件）を生ログとして貼り直した。 / src: T6 taskcheck round1

- [should][conv:-] cross: `packages/e2e/src/specs/appearance-settings.spec.ts:97-99` の
  コメントが、T2（`TabBar.vue`）修正前の前提（「`.tab-bar-new` だけ `@keydown.stop` が付いて
  おり、フォーカスしたままだと `prefix+X` が届かない」）のまま取り残されていた。この work の
  スコープ（Sidebar.vue/TabBar.vue とそのテスト・docs/verification.md・key-bindings.spec.ts）
  には元々含まれていない別ファイルだが、T2 の変更で前提そのものが古くなったコメントなので
  修正した。 / 対応: コメントを、`.tab-bar-item` を使う理由（この AC がタブ項目への
  フォーカスを検証対象としている）と、`.tab-bar-new` へフォーカスが残っていても今は
  `prefix+X` が届く旨に書き直した。アサーション自体は無改修。 / src: cross taskcheck round1

T3 は round1 で2件（must 1・nit 1）見つかり、修正後 round2 で findings 0（本ファイル冒頭参照）。
cross は round1 で上記1件（should）を見つけ、その場で修正した。
T6 は round1 で4件（should 4）見つかり、修正後 round2 で findings 0
（`metrics.yml`: `report, task: T6, findings: 4` @17:53:43Z → `report, task: T6, findings: 0`
@18:01:30Z。本ファイル冒頭参照）。
