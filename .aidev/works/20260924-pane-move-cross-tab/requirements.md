# 要件: D&D による pane の別 tab・別 workspace への移動

紐づく charter ゴール: なし（`.aidev/charter.md` 未導入）。

`.aidev/backlog/product-roadmap.md` の項目「D&D による pane の別 tab・別 workspace への移動」
（出典: `.aidev/works/20260924-pane-dnd-split-move/decisions.md` D1）に対応する。同一 tab 内の
入れ替え・分割・分割解除は既に対応済み（`20260923-pane-name-dnd-swap`・
`20260924-pane-dnd-split-move`）。本 work は、その3つが対象外としていた「pane を別の tab・
別の workspace へ移す」を扱う。

## 背景 / 課題

現状、pane の名前ラベルをドラッグできる範囲は「同一 tab 内の別の pane」に限られる
（`20260923-pane-name-dnd-swap`・`20260924-pane-dnd-split-move`）。pane を別の tab・別の
workspace へ移したい場合、直接の手段が無く、閉じて作り直す（動いているプロセス・スクロールバックを
失う）しかない。herdr のソース（`scratchpad/herdr`）を `move_pane`/`MovePaneTo`/`detach_pane`
等で検索したが、pane を tab 間・workspace 間で移動する利用者向けコマンドは見つからなかった
（`detach_pane` は close 系の内部実装のみ）——herdr にそもそも無い機能である以上、Web ならではの
直接操作として、サイドバー・tab バーという既存の視覚的な「移動先」を活かして実現する。

## 目的 / ゴール

- 利用者が、既存の pane（名前ラベルを摘まむ）を**tab バーの既存の tab**へドラッグ＆ドロップする
  ことで、その pane が元の tab から取り除かれ（元の位置の split は自動的に畳まれる）、ドロップ先の
  tab の中に加わる状態。
- 利用者が、既存の pane を**サイドバーの workspace の行**へドラッグ＆ドロップすることで、
  その pane が元の tab から取り除かれ、ドロップ先の workspace 内に新しい tab として作られる状態。
- 既存の同一 tab 内の操作（入れ替え・分割・分割解除）は変わらず使える状態
  （マウス操作の対象を広げるもので、既存の操作を置き換えない）。

## ユーザーストーリー

- US1: 複数の tab を並行して使う利用者として、ある tab で動いている pane を、別の tab へ
  そのままドラッグで移したい。なぜなら、作業の途中でその pane を別の作業（別の tab）に
  合流させたくなることがあり、閉じて作り直すと動いているプロセス・スクロールバックを
  失ってしまうから。（受け入れ: AC1〜AC4, AC9〜AC11, AC-I1〜AC-I5）
- US2: 複数の workspace（リポジトリ・worktree）を並行して開く利用者として、ある workspace の
  pane を、別の workspace へドラッグで移したい。なぜなら、作業対象を別のリポジトリへ移す際、
  その pane（例えばログを表示している端末）を新しい workspace へ持って行きたいことがあるから。
  （受け入れ: AC5〜AC11, AC-I1〜AC-I5）

## スコープ

### 対象

- `PaneFrame.vue` の既存の名前ラベルドラッグ機構を拡張し、ドロップ先が**同一 tab 内の pane**
  （既存）以外に、**tab バーの tab**・**サイドバーの workspace 行**も検出できるようにする。
- tab バーの既存 tab へドロップ: その tab へ pane を移す（対象 tab の内容へ split で加わる。
  具体的な分割方向・対象は design で確定する）。
- サイドバーの workspace 行へドロップ: その workspace に新しい tab を作り、そこへ pane を移す。
- どちらの操作でも、pane が元々あった tab の元の位置の split は自動的に畳まれ、兄弟がスペースを
  引き継ぐ（既存の `pane.close`/`moveToEdge` と同じ「兄弟を昇格する」処理を使う）。元の tab に
  他の pane が無かった場合（移動する pane が唯一の pane だった場合）、その tab は空になる
  ——空の tab を残すか自動的に閉じるかは design で決める。
- 移動後、フォーカスは移動した pane に残る（既存の分割・分割解除と同じ方針）。
- ドラッグ中の視覚的フィードバック（ドロップ先候補の tab / workspace 行が分かる表示）。
- ドロップ操作の失敗時（範囲外・無効な対象）は何も起きない（現状維持）。

### 対象外

- サイドバーの「workspace 内の特定の tab」へ直接ドロップする経路（workspace 行全体へのドロップの
  みを対象とする。tab を指定したい場合は tab バー側のドロップを使う）。
- pane を別の**サーバ**（別マシン）へ移す（herdr の remote/複数ホスト相当。別の backlog 項目）。
- 移動先の tab・workspace が存在しない場合の「新規作成しながら移動」（サイドバーの「+」ボタン等への
  ドロップ。今回はサイドバーに既に表示されている workspace 行・tab バーに既に表示されている tab
  への移動に限る）。
- タッチ操作でのドラッグ（既存の pane D&D 一式と同じ制約。デスクトップ限定のまま）。
- 名前が無い pane でのドラッグ操作（既存の制約を引き継ぐ）。

## 機能要件

- pane の名前ラベルをドラッグし、tab バーの既存の tab にドロップすると、その pane が対象 tab の
  中へ移る。
- pane の名前ラベルをドラッグし、サイドバーの workspace 行にドロップすると、その workspace に
  新しい tab が作られ、そこへ pane が移る。
- どちらの移動でも、pane が元あった tab の分割は自動的に畳まれる。
- 移動後、フォーカスは移動した pane に残る。
- 既存の同一 tab 内の入れ替え・分割・分割解除、既存のキーバインドによる分割・pane を閉じる操作は
  変わらず動作する（回帰なし）。

## 非機能要件 / 制約

- 複数クライアントが同じ tab/workspace を開いている場合、移動の結果は既存のイベント配布の仕組み
  （`layout.updated`・`tab.created`・`workspace.updated` 等）で全クライアントに反映される
  （design で確定）。
- パフォーマンス上の新しい制約は無い（既存の pane 操作と同程度の操作頻度・レイテンシを想定）。

## 相互作用の受け入れ基準

利用者が操作する部品（pane のドラッグ＆ドロップ）を拡張するため記載する。

- [ ] AC-I1 開く / 閉じる: ドラッグは名前ラベルの pointerdown→閾値超えの pointermove で始まり
  （既存の 6px 閾値）、pointerup で終わる。ドロップ先が無効・範囲外なら何も起きず、レイアウトは
  元のまま。
- [ ] AC-I2 確定 / 取り消し: pointerup で有効なドロップ先（tab バーの tab・サイドバーの
  workspace 行）の上にいれば確定する。ドラッグ中に Esc を押すとドラッグを取り消し、レイアウトは
  元のまま（既存の `onEscapeDuringDrag` と同じ経路）。
- [ ] AC-I3 キーボードだけで完結するか: この操作自体はマウス/ポインタ操作前提（既存の pane D&D と
  同じ位置づけ）。同じ結果（別 tab・別 workspace への移動）へのキーボードだけの到達経路は
  この work では設けない（design で明記）。
- [ ] AC-I4 フォーカスの行き先: ドロップ確定後、移動した pane にフォーカスが残る。
- [ ] AC-I5 既存の操作を妨げないか: tab バー・サイドバーの既存のクリック・右クリックメニュー・
  既存の D&D（workspace の並べ替え・pane の同一 tab 内操作）の経路は変更しない。

## 完了条件 (受け入れ基準)

- [ ] AC1: pane の名前ラベルをドラッグし、tab バーの既存の tab にドロップすると、その pane が
  対象 tab の中へ移る。
- [ ] AC2: AC1 で、pane が元あった tab の分割は畳まれ、兄弟がスペースを引き継ぐ。
- [ ] AC3: AC1 で、移動先の tab が pane を1枚も持っていなかった場合（そのような tab は通常
  存在しないが、design で扱いを確定する）を除き、既存の pane の隣に split で加わる。
- [ ] AC4: ドラッグ中、tab バーのどの tab がドロップ候補かが視覚的に分かる。
- [ ] AC5: pane の名前ラベルをドラッグし、サイドバーの workspace 行にドロップすると、その
  workspace に新しい tab が作られ、そこへ pane が移る。
- [ ] AC6: AC5 で、pane が元あった tab の分割は畳まれる。元の tab に他の pane が無かった場合の
  扱いは design で確定する。
- [ ] AC7: ドラッグ中、サイドバーのどの workspace 行がドロップ候補かが視覚的に分かる。
- [ ] AC8: AC1・AC5 いずれの移動後も、フォーカスは移動した pane に残る。
- [ ] AC9: 範囲外・無効な対象（同一 tab・同一 workspace の重複ドロップ等 design が定めるガード）
  へのドロップでは何も起きない（レイアウト不変）。
- [ ] AC10: 複数クライアントが対象の tab/workspace を開いているとき、一方の移動操作がもう
  一方の画面にも反映される。
- [ ] AC11: 既存の同一 tab 内の入れ替え（`pane.swap_with`）・分割（`pane.move_to_edge`）・
  分割解除（`pane.replace`）・既存のキーバインドによる分割・pane を閉じる操作は、この work の
  変更後も従来どおり動作する。

## 未確定事項 / 確認したいこと

- tab バーの tab へドロップしたとき、対象 tab の**どの pane**の**どの方向**へ split で加わるかは
  design で決める（tab バーの tab 要素は面積が小さく、`PaneFrame` の縁/中央のようなゾーン細分は
  現実的でない——単一の既定の挙動にする）。
- 移動元の tab が空になったとき（移動する pane がその tab で唯一だった場合）、その tab を
  自動的に閉じるか、空のまま残すかは design で決める（既存の `LayoutTree.remove` は最後の1枚を
  消すと `null` を返し、呼び出し側が tab を閉じる規約になっている——`closePane`/`moveToEdge`/
  `replacePane` の既存の扱いとの整合を design で確認する）。
- サーバ側の RPC 設計（`pane.move_to_tab`/`pane.move_to_new_tab` のような新規 RPC を追加するか、
  既存の `moveToEdge`/`replacePane` を拡張するか）は design で決める。
