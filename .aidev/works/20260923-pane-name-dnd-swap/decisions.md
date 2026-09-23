# 決定記録

## D1: ドラッグは Pointer Events で実装し、HTML5 Drag and Drop API は使わない

- 背景: pane 名ラベルを掴んで別の pane へドロップする操作の実装方式には2案あった。
- 決定: `pointerdown`/`pointermove`/`pointerup`/`setPointerCapture` を使う。
- 理由 / 代替案: HTML5 DnD（`draggable`/`dragstart`/`drop`）はブラウザ既定のゴースト画像・
  カーソル挙動が強く、ドロップ候補の強調などの見た目を細かく制御しづらい。また `Sidebar.vue`・
  `Splitter.vue` の既存のドラッグ実装がどちらも Pointer Events を使っており、揃える方が
  保守しやすい。タッチ対応の差も理由の一つだが、`PaneFrame` の枠・名前表示はデスクトップ限定
  （`enabled` prop）なので今回は決定打ではない。
- 影響: ドロップ先の判定を `document.elementFromPoint` で自前に行う必要がある（design「設計方針」）。

## D2: 同一 tab 内の入れ替えのみを対象にする（別 tab・workspace への移動は対象外）

- 背景: backlog の既存項目「D&D による pane の分割 / 分割解除 / 移動」は本 work より広い範囲を指す。
- 決定: 今回は「同一 tab 内の2つの pane を入れ替える」ことだけを実装する。
- 理由 / 代替案: 利用者の要望は「pane の入れ替え」であり、別 tab・workspace への移動は求められて
  いない。範囲を広げると、ドロップ先が tab バー・サイドバーになる場合の UI 設計が別途必要になり
  スコープが膨らむ。
- 影響: backlog の該当行は「入れ替え」を消し込んだ残り（分割・分割解除・別 tab/workspace への移動）
  として残す（deliver で行う）。

## D3: 色は新しい CSS 変数を追加せず、既存の `--wtm-menu-border`・`--wtm-pane-current` を再利用する

- 背景: `uiTokens.ts` の `CSS_VARS` は19個で、全17テーマに対して値決め・WCAG コントラスト検証
  （`uiTokens.test.ts`）が要る「閉じた集合」として運用されている。
- 決定: 「フォーカス無しの薄い枠・名前」に新しいテーマ変数を追加しない。既存の `--wtm-menu-border`
  を薄めた色（`color-mix` 等。coding で確定）として使う。フォーカス中は既存の `--wtm-pane-current`
  をそのまま使う。
- 理由 / 代替案: 新変数を追加すると 17 テーマぶんの値決めと検証が必要になり、この work の本題
  （見た目の legend 化・ドラッグでの入れ替え）に対して不釣り合いに大きい追加作業になる。
- 影響: 将来、テーマごとに個別調整したくなった場合は、別途 `CSS_VARS` への追加を検討する
  （このwork では対象外）。

## D4: `pane.swap_with`（新規 RPC）を追加し、既存の `pane.swap`（方向ベース）は変更しない

- 背景: 既存の `pane.swap` は「フォーカス中の pane」から「ある方向の隣」への入れ替えに限定される。
  ドラッグでは任意の2つの pane（隣接とは限らない）を指定する必要がある。
- 決定: 別の RPC `pane.swap_with(paneId, otherPaneId)` を新設する。
- 理由 / 代替案: 既存の `pane.swap` に「方向」の代わりに「対象 pane id」を渡す形へ拡張する案も
  検討したが、`Dir` 型の意味が変わってしまい、キーボード操作（既存の呼び出し元）に影響する
  リスクがある。別の方式にする方が安全（requirements の非機能要件「既存の pane.swap は変更しない」）。
- 影響: `SessionModel.swapPaneWith` は `Layout.swap`（既に任意の2 pane id を受け付ける汎用実装）を
  直接呼ぶだけで済み、実装コストは小さい。

## D5: `.aidev/backlog/product-roadmap.md` の消し込みは deliver 工程で行う

- 背景: `aidev-70-deliver`「3.5」の規約は backlog の `[x]` 化を deliver 工程の作業と定めており
  （PR/コミット参照を伴う記録のため）、coding 時点ではまだ書けない（20260923-agent-session-resume
  の D13 と同じ判断）。
- 決定: T8 のうち `docs/herdr-parity.md` の更新は coding 工程で行い、
  `.aidev/backlog/product-roadmap.md` の該当行の分割は deliver 工程に回す。
- 影響: T8 は coding 承認の時点では完全にはチェック済みにならない。

## D6: 入れ替え確定時、ドラッグした pane に明示的にフォーカスを移す

- 背景: T5・T6 実装後、実際にブラウザで動かして screenshot を撮って確認したところ
  （`run` スキルでの目視確認。coding の一部として実施）、フォーカス中でない pane をドラッグして
  フォーカス中の pane の位置へドロップすると、入れ替え後もフォーカスは元のまま（動かした方には
  移らない）ことが分かった。design 時点の想定（「`swapPane` が `focusedPaneId` を書き換えない
  ことから自動的に満たされる」）は誤りだった——「元々フォーカスされていた pane がフォーカスされ
  続ける」ことと「ドラッグした pane にフォーカスが移る」ことは、ドラッグした pane と元々フォーカス
  されていた pane が別物のときに食い違う。
- 決定: `PaneFrame.vue` の `onNamePointerUp` で、入れ替えが成立したら明示的に
  `view.focusPane(props.paneId)`・`registry.focus(props.paneId)` を呼ぶ（既存の「枠をクリックで
  選ぶ」と同じ呼び出し）。
- 理由 / 代替案: AC-I4 の文言どおり「ドラッグした pane にフォーカスが残る」を字義どおり実装した。
  「入れ替え前にフォーカスされていた方にフォーカスを残す」という代替案は検討していない——利用者が
  今まさに操作した（掴んで動かした）ものにフォーカスが移る方が、マウス操作の直感に合うと判断した。
- 影響: `PaneFrame.test.ts` に回帰テストを追加した（フォーカス中でない pane をドラッグしても、
  ドラッグした方にフォーカスが移ることを確認）。design.md の該当記述も訂正した。

## D7: 名前の legend 表示は pane の外へはみ出させない（tab バー非表示時でも切れない）

- 背景: T5 実装後の目視確認（screenshot）で、`.pane-frame-name` を境界線の真上に
  `translateY(-50%)` で半分だけ乗せる設計（design の当初案）だと、tab が1個で tab バーが
  自動的に隠れている（20260922-appearance-settings-rest）ときに、一番上の pane の名前が画面の外まで
  はみ出して切れることが分かった（`.pane-frame` の外側に余白が無いため）。
- 決定: `.pane-frame-name` を `.pane-frame` の内側（上に確保した余白の中）に完全に収める設計に変更した
  （`translateY(-50%)` をやめ、`top: 0.15em` の固定位置にした）。あわせて `paneAgentNameVisible` が
  有効な間、全 pane に一律で上の余白（`padding-top: gap + 1.2em`）を確保するクラス
  （`.pane-frame-enabled-named`）を追加した——**個々の pane に名前があるかどうかに関わらず一律に**
  確保する（隣り合う pane の上端をそろえるため。design「4.」に追記）。
- 理由 / 代替案: 「tab バーが無いときだけ余白を増やす」という条件分岐も考えたが、tab バーの
  表示状態は`TabBar.vue`の内部状態で`PaneFrame.vue`からは追いにくく、余白を常に確保する方が単純で
  tab バーの有無に依存しない（tab バーが出ているときは単に少し余白が余るだけで実害は無い）。
- 影響: `paneAgentNameVisible` を有効にすると、既存の枠の太さ変更（`paneFrameThickness`）と同じく
  PTY の行数が実際に減る（意図した副作用。docs/verification.md へ追記する）。
- **coding 時点の追記**: `.pane-frame-edge-current.pane-frame-edge-named` の
  border-color だけを上書きする実装（当初案）は、CSS の詳細度の都合で `.pane-frame-edge-named` の
  `border`（shorthand。幅も含む）に幅を1pxへ戻されてしまい、フォーカス中の枠が意図した2pxではなく
  1pxになっていた（screenshot で発見）。`border-width: 2px` も明示して修正した。

## D8: ドラッグ中にダイアログが開いたら、その時点で取り消す

- 背景: coding 工程のタスクをまたぐ独立点検（cross・ラウンド2）で、`paneDrag`（T4）にはドラッグ中に
  モーダルダイアログが開いたときの後始末が無いことが分かった。design の「依拠する既存の事実」が
  precedent として引用する `Sidebar.vue`（幅ドラッグ）の同じ状況の実装（`Sidebar.vue:141-150`）は
  `watch(() => view.openDialog, (d) => { if (d !== null) endDrag(); })` で能動的に取り消しており、
  そのコメントは「`showModal()` で文書が inert になったとき、捕捉先へ `pointerup`/`pointercancel` が
  届き続けるか確かめた出所が無い。分からない挙動に頼らない」としている。新しい pane 名ドラッグは
  同じ Pointer Events 依存（`setPointerCapture`）でありながら、Esc キーでの取り消しだけを precedent
  から採用しており、この対応を据え置いていた。
- 決定: `PaneFrame.vue` に同じ形の `watch(() => view?.openDialog, ...)` を追加し、自分がドラッグ元
  （`isDragSource`）のときだけ `cancelDrag()` を呼ぶ。
- 理由 / 代替案: `view.ts` 側（`openDialogWithContext`）で一律 `endPaneDrag()` を呼ぶ案も検討したが、
  ドラッグ元でない `PaneFrame` インスタンスの `dragStart`（ローカル変数）やイベントリスナーの後始末は
  `cancelDrag()` でしか行えないため、`Sidebar.vue` と同じく各インスタンス側の `watch` にした。
- 影響: `PaneFrame.test.ts` に回帰テストを追加した（`watch` を無効化すると落ちることを確認して復元済み。
  [[regression-negative-control]]）。実害は RPC が送られないため入れ替えの誤動作ではなく、ドロップ候補の
  ハイライト・`grabbing` カーソルが宙に浮いて固着する UI 上の不具合だった。

## D9: 名前が無い pane には legend の枠を出さない（AC1 の「常に見える」は名前がある pane に限る）

- 背景: review 工程で、requirements.md AC1「`paneAgentNameVisible` が有効なとき、pane の枠に沿った
  境界線が**常に**見え」という文言と、実装（`showBorder`。名前が無い pane では境界線ごと表示しない）が
  食い違って見えるという指摘があった。design「4.」は「名前が無ければ枠も出さない——空の legend は
  意味が無い」と理由付けしていたが、この解釈が decisions.md に記録されておらず、AC1 の文言との関係が
  追跡できなかった。
- 決定: 「常に見える」は**名前が実際に表示される pane** に限った要求と解釈する。名前の無い pane
  （エージェント名も端末タイトルも無い、利用者が名前を付けていない pane）には legend 自体が無意味な
  ため、境界線も出さない。同一 tab 内で名前の有無が混在する画面では、フォーカスの有無を示す強調枠が
  名前の有る pane にしか出ない見た目のムラが生じるが、これは「意味の無い空の枠を出さない」ことの
  副作用として許容する。
- 理由 / 代替案: 名前が無くても枠だけ出す案も検討したが、`paneAgentNameVisible` は「エージェント名を
  見せる」ための設定であり、名前が無い pane にまで枠を出すと、この設定の目的（US1）から外れた
  常時表示の枠設定に変質してしまう（既存の `paneFrameThickness`〔常時の枠〕と役割が重複する）。
- 影響: requirements.md 自体は承認済みのため文言は変更せず、この decisions.md の記録を実装の
  正典とする（review.md 参照）。