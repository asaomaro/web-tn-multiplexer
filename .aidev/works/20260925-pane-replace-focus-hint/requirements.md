# 要件: pane.replace の後継 focus ヒント

## 背景 / 課題

複数クライアントが同じ tab を見ている状況で、片方が名前ラベルのドラッグを pane の中央へ
ドロップして分割解除する（`replacePane`）と、消える pane（`targetPaneId`）へ別のクライアントが
ローカルで focus していた場合、その別クライアントの focus 復帰先が想定とずれる。

`SessionModel.replacePane`（`packages/server/src/session/SessionModel.ts:762-786`）は、
ドロップ先（`targetPaneId`）が tab のローカル focus だったかどうかに関わらず、後継を**常に
ドラッグした pane（`paneId`）自身**にする（20260925-pane-move-global-focus で、この規則を
`this.focus`（グローバル）にも適用済み）。一方、クライアント側の `viewRepair.ts`
（`packages/web/src/store/viewRepair.ts`）は、`SessionModel.closePane` の既存規則
（「閉じた pane の代わりはレイアウト木の最初の葉（DFS順）」）だけを実装しており
（`viewRepair.ts:21-24,66` のコメントに明記）、`replacePane` 固有の「後継は必ずドラッグした
pane」という規則を知らない。`pane.closed`/`layout.updated` イベントのどちらにも、この後継を
伝えるフィールドが無いため、クライアント側からは区別できない。

`.aidev/works/20260924-pane-dnd-split-move/decisions.md` D5 が発見し、「正しく直すには
`pane.closed` イベントに推奨後継のヒントを新設し、`repairView` がそれを優先する形にする必要が
あるが、protocol の変更を伴い影響範囲の検証がその work の範囲を超える」として backlog へ
送っていた（`.aidev/backlog/product-roadmap.md`）。

## 目的 / ゴール

複数クライアントで同じ tab を見ている状態で `pane.replace` が実行されたとき、消える pane に
ローカルで focus していた別クライアントの focus が、サーバの規則どおりドラッグした pane
（`paneId`）へ正しく復帰する状態にする。`closePane`/`closeTab`/`closeWorkspace` 経由の
既存の focus 復帰（DFS-first-leaf）は変更しない。

## ユーザーストーリー

- US1: 複数クライアントで同じ tab を見ている利用者として、片方が `pane.replace`
  （分割解除のドラッグ）をしたとき、消える pane に自分がローカルで focus していても、
  正しくドラッグした pane に focus が移ってほしい。なぜなら、意図しない別の pane へ focus が
  飛ぶと混乱するから（decisions.md D5 が記録した実害）。（受け入れ: AC2, AC4, AC6）
- US2: 開発者として、この修正が既存の `closePane`/`closeTab`/`closeWorkspace` の focus 復帰
  挙動を変えないことを保証したい。なぜなら、これは `replacePane` 固有の欠落を埋める
  ピンポイントな修正であって、共有ロジック（`viewRepair.ts`）全体の挙動を変える機能追加では
  ないから。（受け入れ: AC3, AC5, AC7）

## スコープ

### 対象

- `pane.closed` イベントの `data` に、任意の「推奨後継 pane」のヒントを追加する。
- `SessionModel`/`SessionService` の `replacePane` が、この後継ヒントとして生存した pane
  （`paneId`）を返す・イベントに含める。
- クライアント側 `viewRepair.ts` の `repairView` が、このヒントを受け取れるようにし、
  ヒントが（生きている状態で）与えられていれば、既存の DFS-first-leaf の既定より優先して
  採用する。
- `StoreAdapter.ts` が `pane.closed` イベントからヒントを取り出し、直後の
  `applyViewRepair()` 呼び出しへ受け渡す配線を追加する。

### 対象外

- `closePane`/`closeTab`/`closeWorkspace` がこのヒントを送るようにすること。これらは
  既存の後継選択（tab のローカル focus が消えた pane だった場合、レイアウト木の最初の葉を
  選ぶ）と `viewRepair.ts` の既定の規則が既に一致しているため、ヒントを付与する必要が無い
  （decisions.md D5 が懸念した「`viewRepair.ts` は将来の閉鎖経路すべてに影響する共有ロジック」
  という影響範囲を、ヒントを送る側は `replacePane` だけに限定することで避ける。ヒントを
  受け取る側の仕組みは汎用的に作るが、今回実際に送るのは `replacePane` のみ）。
- `layout.updated` イベントへの同種のヒント追加。D5・backlog選定時の feasibility 調査の
  どちらも、`pane.closed` への追加だけで十分と判断している。
- `moveToTab`/`moveToNewTab`/`swapPaneWith`/`moveToEdge` 等、`replacePane` 以外の pane
  移動操作への同種のヒント追加。これらは pane を削除しない（`pane.closed` を発行しない）ため、
  そもそも今回のヒントの対象外。
- グローバル focus（`this.focus`／`session.focus_changed`）に関する変更。
  20260925-pane-move-global-focus で `replacePane` は既にグローバル focus を正しく更新
  済み。この work が扱うのは、それとは別の経路——`viewRepair.ts` が使う「表示中クライアント
  自身のローカル focus の復帰」——の欠落。

## 機能要件

- `pane.closed` イベントの型が、任意の後継 pane の id を運べる。
- `replacePane` は、削除される pane に対応する `pane.closed` を発行するとき、後継として
  生存した pane（`paneId`）の id を含める。
- `closePane`/`closeTab`/`closeWorkspace` が発行する `pane.closed` は、このフィールドを
  含めない（既存どおり）。
- `viewRepair.ts` の `repairView` は、自分がローカルで focus していた pane が消えた場合、
  直前に届いた `pane.closed` に後継ヒントがあり、かつその pane がまだ生きていれば、それを
  最優先で選ぶ。ヒントが無い、またはヒントの指す pane も既に存在しなければ、既存の
  DFS-first-leaf の規則にフォールバックする。
- `StoreAdapter.ts` は、`pane.closed` イベントを処理する際にその後継ヒントを取り出し、
  同じイベント処理の一部として行う直後の表示復帰（`repairView` の呼び出し）へ受け渡す。

## 非機能要件 / 制約

- protocol の後方互換性を壊さない（新しいフィールドは任意（optional）とし、既存の
  イベント発行元・消費元は無改修で動作し続ける）。
- 既存の `viewRepair.test.ts`・`SessionModel.test.ts`・`SessionService.test.ts` は無改修の
  まま通る。

## 完了条件 (受け入れ基準)

- [ ] AC1: `pane.closed` イベントの `data` が、任意の後継 pane の id（`successorPaneId`
  等の名前は design で確定する）を持てる。
- [ ] AC2: `replacePane` によって pane が消えるとき、発行される `pane.closed` の後継ヒントが、
  生存した pane（ドラッグした pane。`paneId`）の id になる。
- [ ] AC3: `closePane`/`closeTab`/`closeWorkspace` によって pane が消えるとき、発行される
  `pane.closed` に後継ヒントは含まれない（既存の挙動と同一）。
- [ ] AC4: `repairView` が、後継ヒントを受け取り、かつそのヒントが指す pane がまだ生きて
  いれば、DFS-first-leaf の既定より優先してそれを選ぶ。
- [ ] AC5: ヒントが無い、またはヒントの指す pane が既に存在しない場合は、既存の
  DFS-first-leaf の規則にフォールバックする。
- [ ] AC6: 別クライアントが、消える pane（`targetPaneId`）へローカルで focus していた状態で
  `pane.replace` が実行されたとき、`pane.closed` を受けたそのクライアントの focus が、
  ドラッグした pane（`paneId`）を指す（decisions.md D5 の実害シナリオがこの work で解消
  されることを示す確認）。
- [ ] AC7: 既存の `viewRepair.test.ts`・`SessionModel.test.ts`・`SessionService.test.ts` の
  既存テストが、この work の変更後も無改修のまま通る。

（AC1 はどのユーザーストーリーにも紐づかない基準——後続の AC2〜AC6 が動作するための型レベルの
前提条件（`pane.closed` がそもそも後継ヒントを運べる形になっていること）であり、それ自体は
利用者から見える振る舞いを持たないため、ストーリーからは参照していない。）

## 未確定事項 / 確認したいこと

- なし（backlog 選定時の feasibility 調査・decisions.md D5 で主要な論点は解消済み——上記
  「スコープ」の「対象外」節に理由を記載）。
