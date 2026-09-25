# 要件: レイアウト操作後のグローバル focus の更新

## 背景 / 課題

`SessionModel` は「セッション全体のグローバル focus」（`this.focus`。`session.json` に
永続化され、ローカル保存 view の無い新規クライアントの再接続時・サーバ再起動時の復元先になる）
と、「tab ごとのローカル focus」（`tab.focusedPaneId`）を別々に持つ。`focusPane`/`focusTab`/
`focusWorkspace`/`commitTab`/`splitPane` 等、利用者が明示的にフォーカスを変える操作は両方を
更新するが、レイアウトだけを書き換える pane 操作（`swapPaneWith`/`moveToEdge`/`replacePane`/
`moveToTab`/`moveToNewTab`）は、原則として `this.focus` を更新しない（`replacePane` だけ、
削除された pane がたまたま tab のローカル focus だった場合の「救済」としてのみ更新する。
`moveToNewTab` は主経路では更新するが、下記の調査結果のとおり特定条件下で上書きされ
無効化される——「原則として」に対する唯一の例外だが、実質的には機能していない）。

結果、ローカル保存 view の無い新規クライアントが、pane を移動した直後に再接続すると、
移動先ではなく元の `this.focus` が指す pane へ復元されうる
（`.aidev/works/20260924-pane-move-cross-tab/decisions.md` D4）。

D4 は `moveToTab`/`moveToNewTab` について「この横断的な設計判断は work のスコープを超える」
として backlog へ送り、`.aidev/backlog/product-roadmap.md` の該当行（337行目）は
`swapPaneWith`/`moveToEdge`/`replacePane` も含めて挙げている。

この work の準備調査（feasibility 確認・design 前の直接コード確認）で、backlog の記述と
現状のコードに次のずれがあることが分かった：

- `moveToNewTab` は実は主経路で既に `this.setFocus(...)` を呼んでいる
  （`SessionModel.ts:656`）。ただし、移動元 tab が空になり `closeEmptyTabShell` で
  自動的に閉じられる場合（`SessionModel.ts:659`）、移動元 workspace 側の「救済」ロジック
  （`closeEmptyTabShell` 内、`SessionModel.ts:597-600`）が、直前に設定した移動先の
  `this.focus` を無条件に上書きしてしまう——移動元 tab が移動元 workspace の
  `activeTabId` だった場合に起きる（実機で追跡確認済み）。
- `replacePane` は「削除された pane が tab のローカル focus だった」場合に限り
  `this.focus` を更新する（`SessionModel.ts:769`）。これは `closePane` と同じ「消えた
  focus の救済」パターンであり、「生存した pane が新たにこの領域を代表する」という
  今回求める一貫した規則そのものではない。
- `swapPaneWith`（`pane.swap_with` RPC）は、`20260924-pane-dnd-split-move` で web の UI が
  縁/中央のドロップゾーン方式（`moveToEdge`/`replacePane`）に一本化されたため、**現在の
  web UI からは呼ばれていない**（`ActionDispatcher.ts:607-613` のコメント参照）。
  `packages/server/src/surface/methods/pane.ts:81-88` に RPC としては現役で登録されている
  （CLI・将来の UI・外部の自動操作からは呼べる）。

## 目的 / ゴール

pane の位置・所属を書き換える操作（`swapPaneWith`・`moveToEdge`・`replacePane`・
`moveToTab`・`moveToNewTab`）が成功したあと、セッション全体のグローバル focus
（`this.focus`）が、その操作で動かした pane（`paneId`）を指す状態にする。ローカル保存
view の無い新規クライアントの再接続・サーバ再起動のどちらでも、直近のレイアウト操作の
結果が復元される状態を実現する。

## ユーザーストーリー

- US1: web-tn-multiplexer の利用者として、pane を別の tab・workspace・位置へ移動した
  直後に別のブラウザタブ／別の端末で（ローカル保存 view を持たない状態で）接続したとき、
  移動した pane を中心とした画面が復元されてほしい。なぜなら、直前に自分が行った操作の
  結果が新しい接続に反映されないと、操作が失敗したように見え、混乱するから。
  （受け入れ: AC1, AC2, AC3, AC4, AC5）
- US2: 開発者として、この修正が既存の `tab.focusedPaneId`・`workspace.activeTabId`・
  既存の配布イベント・既存のテストを壊さないことを保証したい。なぜなら、これは
  「グローバル focus という1つのフィールドの更新漏れ」を埋めるバグ修正であって、
  レイアウトや配布の挙動を変える機能追加ではないから。（受け入れ: AC6, AC7）

## スコープ

### 対象

- `SessionModel.ts` の `swapPaneWith`・`moveToEdge`・`replacePane`・`moveToTab`・
  `moveToNewTab` が、成功時に `this.focus` を「動かした pane（`paneId`）」を指すよう
  更新する。
- `moveToNewTab`（および今回 `this.focus` を新たに更新する `moveToTab`）で、移動元 tab が
  空になり `closeEmptyTabShell` により自動的に閉じられる場合、その内部の「救済」ロジックが
  今回設定した移動先の `this.focus` を上書きしないようにする。

### 対象外

- `closeEmptyTabShell` の「救済」ロジック自体が、無関係な workspace の `this.focus` まで
  巻き込んで上書きしうるという、より広い既存の潜在的な不具合（今回の調査で発見。`moveToTab`・
  `moveToNewTab` の移動先を上書きしないようにする対応〔対象・機能要件参照。この2操作だけが
  `closeEmptyTabShell` を呼ぶ〕とは別に、「そもそも救済が本当に必要なときだけ発火すべきか」
  という設計判断が要る）は、この work では扱わない。理由を decisions.md に記録し、backlog に
  別項目として追加する。
- `this.focus` の変化を他クライアントへ通知する `session.focus_changed` イベントの配布を
  この5操作に追加すること。既存の設計（`.aidev/works/20260924-pane-dnd-split-move/design.md`
  「クライアント側: ドロップ確定」）は、ドラッグを行ったクライアント自身はローカルの
  `view.focusPane`/`registry.focus` で完結させ、サーバへ別途 focus の RPC を送らない
  という前提に立っている。`this.focus` はもっぱら「あとから来る／再起動後の」復元用の
  フィールドであり、この work はそのフィールドの値を正しくするだけで、既に接続中の
  他クライアントの画面を動かす新しい可視的挙動は追加しない。
- `tab.focusedPaneId`・`workspace.activeTabId` の更新ロジックの変更。`moveToEdge`
  （`20260924-pane-dnd-split-move` の設計「`focusedPaneId` は変更しない」）・
  `swapPaneWith`（位置の入れ替えのみで pane の作成・削除が無い）は元から `tab.focusedPaneId`
  に触れておらず、この work でも触れない。`replacePane` の既存の「救済」による
  `tab.focusedPaneId` の更新（削除された pane が tab のローカル focus だった場合のみ）も
  変更しない——今回追加するのは `this.focus`（グローバル）の更新だけで、`tab.focusedPaneId`
  （ローカル）の既存の規則には触れない。
- `packages/web` 側の変更。`this.focus` を読む経路（`client.hello` の snapshot・
  `session.json` の永続化・クライアントの `restoreView`）は既存のまま、正しい値が入る
  ようになるだけで、web 側のコードを変える必要は無い（design で確認する）。

## 機能要件

- `swapPaneWith`・`moveToEdge`・`replacePane`・`moveToTab`・`moveToNewTab` は、成功時に
  `this.focus` を、対象の pane（`paneId`）が属することになった workspace・tab・pane を
  指すよう更新する。
- `moveToTab`・`moveToNewTab` は、移動元 tab の自動クローズ（`closeEmptyTabShell`）が
  発生しても、最終的な `this.focus` が移動先を指したままである。

## 非機能要件 / 制約

- 既存の `tab.focusedPaneId`・`workspace.activeTabId` の更新規則・既存の配布イベント
  （`layout.updated`/`pane.updated`/`tab.*`/`workspace.*`）は変更しない。
- 既存のテスト（`SessionModel.test.ts`・`SessionService.test.ts`）は無改修のまま通る。

## 完了条件 (受け入れ基準)

（`getFocus()` は `this.focus` を返す `SessionModel` の既存の getter。以下の全 AC は
`getFocus()` の戻り値＝`this.focus` の内容を確認する。）

- [ ] AC1: `swapPaneWith(paneId, otherPaneId)` が成功すると、`getFocus()` が
  `paneId`（RPC の第1引数——入れ替えを要求された側の pane。`otherPaneId` ではない）を指す。
- [ ] AC2: `moveToEdge` が成功すると、`getFocus()` が移動した pane（`paneId`）を指す。
- [ ] AC3: `replacePane` が成功すると、`getFocus()` が生存した pane（`paneId`）を指す
  （削除された pane が tab のローカル focus だったかどうかに関わらず）。
- [ ] AC4: `moveToTab` が成功すると、`getFocus()` が移動先の tab・pane を指す。移動元 tab が
  空になり `closeEmptyTabShell` で自動的に閉じられる場合（移動元 tab が移動元 workspace の
  `activeTabId` だった場合を含む）でも、この結果は変わらない。
- [ ] AC5: `moveToNewTab` が成功すると、`getFocus()` が移動先の新しい tab・pane を指す。
  移動元 tab が空になり `closeEmptyTabShell` で自動的に閉じられる場合（移動元 tab が
  移動元 workspace の `activeTabId` だった場合を含む）でも、この結果は変わらない。
- [ ] AC6: `tab.focusedPaneId`・`workspace.activeTabId` の値・既存の配布イベント
  （`layout.updated`/`pane.updated`/`tab.*`/`workspace.*`/既存の `session.focus_changed`
  の発生条件）は、この work の変更後も従来どおり。
- [ ] AC7: 既存の `SessionModel.test.ts`・`SessionService.test.ts` が、この work の変更後も
  無改修のまま通る。

## 未確定事項 / 確認したいこと

- なし（backlog 選定時の feasibility 調査・design 前の直接コード確認で主要な論点は
  解消済み——上記「スコープ」の「対象外」節に理由を記載）。
