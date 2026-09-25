# 要件: keydown を止めるボタンにフォーカスが残っていても prefix・直接のキーを効かせる

## 背景 / 課題

サイドバー・tab バーの一部のボタン（`@keydown.stop`。`packages/web/src/components/
Sidebar.vue` に6箇所・`TabBar.vue` に1箇所）は、押した直後にフォーカスがそのボタンに
残った状態だと、keydown イベントが `main.ts` のグローバルな `window.addEventListener
("keydown", ...)`（`KeyInputController`/`KeyRouter` を経由して prefix・直接のキーを
処理する経路）まで届かない。利用者は端末をクリックし直すまで prefix・直接のキーが効かない
（`.aidev/works/20260921-keybinding-customization/decisions.md` D11(1)）。

D11(1) はこの問題を発見しつつ、「`@keydown.stop` は入力欄・ボタンの Enter/Space を守る
ために付けてあるので、この work では触らない」として意図的に見送り、
`docs/verification.md`「既知の制約」（897行目）に記録し、backlog に本行を立てていた。
D11(1) の理由節は、代案（`window` の keydown を capture フェーズにする）を「入力欄
（名前の変更等）へ打つキーまで prefix・直接のキーに取られうる」として明示的に却下している。

## 目的 / ゴール

対象のボタンにフォーカスが残っていても、ボタン自身の操作（Enter/Space での活性化・マウス
操作）を壊さずに、prefix・直接のキーが効く状態にする（変更しない範囲は「スコープ / 対象外」
節に記載）。

## ユーザーストーリー

- US1: web-tn-multiplexer の利用者として、サイドバー・tab バーのボタンを押した直後に、
  端末をクリックし直さずに prefix・直接のキーを使いたい。なぜなら、いま毎回クリックし
  直す一手間が要り、D11(1) が「別の work で直す」として送っていた欠落だから。（受け入れ:
  AC1, AC2, AC4）
- US2: 開発者として、この修正が対象ボタン自身の Enter/Space 活性化・既存のマウス操作・
  `main.ts`/`KeyRouter` 側のロジックを一切壊さないことを保証したい。なぜなら、これは
  「keydown を無条件に止める」という過剰な手段を「必要な範囲だけ止める」に絞るピンポイント
  修正であって、キー処理全体の設計を変える機能追加ではないから。（受け入れ: AC3, AC4, AC5,
  AC7）

## スコープ

### 対象

- `packages/web/src/components/Sidebar.vue` の6箇所の `@keydown.stop`（並び順
  （workspace）・グループ折りたたみ▸・＋新規・メニュー・並び順（agents）・サイドバー
  折りたたみ«/»）を、無修飾の Enter/Space のときだけ `stopPropagation()` する選択的な
  ハンドラに置き換える（`PaneFrame.vue:238-246` の `onKeydown` と同じ考え方——ただし
  対象は素の `<button>` 要素であり、独自の `preventDefault()`＋手動起動は不要。「依拠する
  既存の事実」参照）。
- `packages/web/src/components/TabBar.vue` の1箇所（＋。tab バー）も同様に置き換える。
- `docs/verification.md`「既知の制約」（897行目）の記述を、修正後の実際の挙動に合わせて
  更新する。
- `packages/e2e/src/specs/key-bindings.spec.ts`（171行目のテスト名にある「`keydown` を
  止めるボタンの上は既知の制約」という注記）を、実際に直った範囲に合わせて更新する。
- `packages/e2e/src/specs/key-bindings.spec.ts` に、実ブラウザで「ボタンにフォーカスが
  残ったまま prefix・直接のキーが実際に効く」ことを確認する新規テストを3件足す（review
  指摘。AC1/AC2/AC4 は単体テストの間接的な signal だけでなく、実ブラウザでの裏付けを持つ
  ——AC1 が最初から許容していた「代表性を要する確認（E2E 等）」の選択を、この work で
  実際に採る）。`Sidebar.vue`・`TabBar.vue` はモジュールを共有しない別々の実装なので、
  それぞれに代表1箇所を置く: サイドバーの「並び順」ボタン（AC1: prefix 経由・AC2: prefix
  を経由しない直接キー、の2テスト）と、tab バーの「＋」ボタン（AC4: prefix 経由、1テスト）。

### 対象外

- `main.ts`・`KeyInputController`・`KeyRouter`・`packages/web/src/keys/assign.ts` の変更。
  D11(1) が却下した「`window` の keydown を capture フェーズにする」代案は採らない。
- `PaneFrame.vue`（pane の枠。Enter・Space・↓・ContextMenu・Shift+F10 を止める既存の
  実装）自体の変更。今回の対象は D11(1) が名指ししたサイドバー・tab バーのボタンのみ。
- navigate モード（`prefix+w`）中に対象ボタンへフォーカスが残っている状態の Enter/Space の
  挙動を新たに設計すること。この work の変更により「ボタンにフォーカスが残ったまま
  `prefix+w` で navigate モードへ入る」という、現状は到達不能な経路が新たに可能になり、
  その状態で Enter/Space を押すとボタン自身の活性化が優先される（navigate の確定・
  `navigate_open_menu` には届かない）——これは `PaneFrame.vue`/`ContextMenu.vue` が
  既に持つ「フォーカス中の要素が自分の Enter/Space を優先する」という確立した優先順位を
  そのまま踏襲した結果であり、この work で新しい設計判断は加えない。既知の制約として
  記録する（受け入れ: AC6）。

## 機能要件

- 対象の7箇所のボタンは、無修飾の Enter・Space の keydown のときだけ伝播を止める
  （`stopPropagation()`）。ボタンのネイティブな活性化（`click` イベントの発火）は妨げない
  （`preventDefault()` はしない）。
- 修飾キー（Ctrl・Alt・Meta）付きの keydown・その他のキー（矢印・Tab 等）は伝播を止めず、
  従来どおり `main.ts` のグローバルな keydown ハンドラまで届く。

## 非機能要件 / 制約

- `main.ts`・`KeyInputController`・`KeyRouter`・`assign.ts` は無改修。
- 対象ボタンの既存のマウス操作（クリック等）・アクセシビリティ属性（`aria-*`）は変更しない
  （AC7 が求める既存テストの無改修通過によって担保する——マウス操作・`aria-*` を直接
  検証する既存テストがそのまま通ることが、変更していないことの確認になる）。
- 既存の `Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts` は無改修のまま通る。

## 完了条件 (受け入れ基準)

- [ ] AC1: サイドバーの対象6箇所のボタンにフォーカスが残っている状態で prefix キー
  （既定 ctrl+b）を押すと、prefix モードに入り、続くキー（例: v）が効く。全6箇所は
  同一のハンドラ実装を使う想定（design で確定）なので、単体テストでは全6箇所を、
  代表性を要する確認（E2E 等）では代表1箇所を確認すれば足りる——確認の粒度は design/
  tasks で確定する。
- [ ] AC2: 同条件で、修飾付きの直接のキー（例: ctrl+alt+d）が効く（AC1 と同じ確認粒度の
  方針に従う）。
- [ ] AC3: 対象ボタン自身の Enter・Space は、従来どおり1回だけ `click` を発火する（二重
  発火しない。回帰なし）。
- [ ] AC4: tab バーの［＋］ボタンについても AC1〜AC3 と同じことが成り立つ。
- [ ] AC5: 対象ボタンの、Enter・Space 以外のキー操作（Tab でのフォーカス移動等）は妨げ
  ない。
- [ ] AC6: navigate モード中に対象ボタンへフォーカスが残っている状態で Enter/Space を
  押したときの挙動（ボタン自身の活性化が優先される）が、`docs/verification.md` の既知の
  制約として記録されている。
- [ ] AC7: 既存の `Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts` は無改修のまま
  通り、`packages/e2e/src/specs/key-bindings.spec.ts` の既存テストは171行目のテスト名の
  「既知の制約」という注記だけを更新する（既存の検証内容（アサーション）自体は変えない。
  「対象」節参照）。
- [ ] AC8: `packages/e2e/src/specs/key-bindings.spec.ts` に新設した3件の E2E テスト
  （サイドバーの「並び順」ボタン×2＝AC1・AC2、tab バーの「＋」ボタン×1＝AC4）が、
  実ブラウザで「ボタンにフォーカスが残ったまま prefix・直接のキーが実際に効く」ことを
  確認し、実際に pass する（review 指摘。「対象」節参照）。

## 未確定事項 / 確認したいこと

- なし（backlog 選定時の feasibility 調査・`.aidev/works/20260921-keybinding-
  customization/decisions.md` D11(1) で主要な論点は解消済み——上記「スコープ」の「対象外」
  節に navigate モードとの相互作用の扱いを記載）。
