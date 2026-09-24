# 決定記録

## D1: backlog 項目「D&D による pane の分割 / 分割解除 / 移動」のうち、本 work では「分割」「分割解除」だけを扱う

- 背景: 対象の backlog 行は「分割 / 分割解除 / 移動」の3要素を1行にまとめている。うち「移動」は
  `20260923-pane-name-dnd-swap` が既に「同一 tab 内の入れ替え」を対応済みで、「別 tab・別 workspace
  への移動」だけが残っている。この残りの「移動」は、ドロップ先の対象（tab バーの各 tab・サイドバーの
  各 workspace）・pane を別 workspace へ移すときのサーバ間の整合性（プロセスは同じサーバ上で動いて
  いるので技術的には可能だが、UI 上のドロップ先の設計・受け入れ基準が「分割」「分割解除」とは
  性質が異なる）など、独立して設計・検証できる別の塊である。
- 決定: 本 work（`20260924-pane-dnd-split-move`）は「分割」「分割解除」だけを対象とし、「別 tab・
  別 workspace への移動」は新しい backlog 行として切り出す。
- 理由 / 代替案: 3要素を1つの work に詰め込むと、`20260923-pane-name-dnd-swap` が確立した
  「小さく区切って着実に届ける」方針から外れる。3要素はドロップ先の種類（pane の縁・pane の中央・
  tab バー・サイドバー）がそれぞれ異なり、実装量・検証量も大きい。分割して積み残しを可視化する
  方が、`aidev coverage`・review の見通しも良い。
- 影響: `requirements.md`「対象外」に明記。deliver 時に backlog へ「別 tab・別 workspace への
  pane の移動」の新規行を追加する。

## D2: ゾーン判定の純関数（`zoneAt`）を `PaneFrame.vue` から切り出したファイルに置く

- 背景: design.md の疑似コードは `zoneAt` を `PaneFrame.vue` 内のインライン関数として書いたが、
  このリポジトリでは `workspaceOrder.ts`・`workspaceGrouping.ts`・`agentOrder.ts` 等、複数箇所
  （または単体テストの書きやすさ）が絡む純関数はコンポーネントから切り出す慣習が一貫している。
- 決定: `packages/web/src/term/paneDragZone.ts` に `zoneAt` を新規作成する（tasks.md T7）。
  design.md が定めた**振る舞い**（30% しきい値・左右優先の tie-break）は変えない。
- 理由 / 代替案: インラインのままでも動作は同じだが、単体テストが `PaneFrame.vue` 全体のマウントを
  経由しないと書けなくなり、既存の慣習・テストのしやすさから外れる。
- 影響: tasks.md T7 が新規ファイルとして扱う。design.md 自体の修正は不要（配置場所は design の
  スコープ外の実装細部と判断）。

## D3: T10（既存 pane 関連テストの回帰確認）は coding ではなく test 工程で消化する

- 背景: tasks.md の他タスク（T1〜T9）は全て新規追加（既存関数・既存 RPC・既存コンポーネントの
  分岐を変更しない設計。design.md「対象範囲」）のため、既存テストへの回帰確認はコード変更を
  伴わない「確認だけ」のタスクになる。
- 決定: T10 は `aidev-40-coding` の完了の目安の例外（「test / deliver で消化するタスクは未チェックの
  まま承認してよい」）に該当するものとして扱い、test 工程で実施する。
- 影響: coding 承認時、T10 は未チェックのまま `tasks_done` から除く。test 工程の
  `test-result.md`「実行したもの」で回帰確認の結果を記録する。

## D4: `PaneFrame.vue` の名前ラベルドラッグは、`20260923-pane-name-dnd-swap` の「ドロップ先を
   問わず入れ替え」から、縁/中央のゾーン方式（分割/分割解除）へ完全に置き換える

- 背景: T9（`PaneFrame.vue` へのゾーン判定の組み込み）を実装している最中に、requirements.md
  自身の矛盾に気付いた。「目的/ゴール」と旧 AC11 は「ドロップ先のどこに落とすかで『入れ替え』
  『分割』『分割解除』の**3つ**が決まる」「`pane.swap_with`（同一 tab 内入れ替え）は…従来どおり
  動作する（回帰なし）」と書いていたが、design.md 以降は**縁＝分割・中央＝分割解除の2ゾーンだけ**
  を実装しており、「入れ替え」が入る隙間が最初から無かった（3つの結果を2つのゾーンだけで
  表現しようとしていた）。
- 決定: 縁＝分割（`moveToEdge`）・中央＝分割解除（`replacePane`）の2ゾーンに一本化する。
  「ドロップ先を問わず入れ替え」（`20260923-pane-name-dnd-swap` の既存挙動）は、この新しい
  ゾーン方式に**置き換わる**——`PaneFrame.vue` の `onNamePointerUp` はもう `swapPanesByDrag` を
  呼ばない。requirements.md の該当箇所（目的/ゴール・機能要件・AC11）を、この決定に合わせて
  修正した（`aidev verify` 的には承認済み文書の書き換えだが、本文と実装の食い違いを残すほうが
  害が大きいため、この decisions.md への記録をもって修正の正当性の記録とする）。
- 理由 / 代替案:
  - **両立させる代替案**（縁/中央に加えて「ドロップ先を問わず」で入れ替えも生かす）は不可能——
    「pane を pane へドロップする」という1つの操作の中で、位置（縁か中央か）以外に「入れ替えか
    分割解除か」を区別する信号が無い。
  - **中央＝入れ替え、分割解除は別の trigger（例: 右クリックメニュー）にする代替案**も検討したが、
    US2「不要になった pane を隣の pane へドラッグして重ねるだけで…譲りたい」という、この work が
    ユーザーから明示的に選ばれた核心の要求（D&D での分割解除）を満たせなくなる。この work の目的は
    「D&D による pane の分割・分割解除」であり、分割解除こそが主目的の半分を占める——それを
    ドラッグ操作の外に追い出すのは本末転倒。
  - **安全面の検討**: 「入れ替え」（非破壊）と「分割解除」（`targetPaneId` のプロセスを実際に
    終了させる、破壊的操作）を同じジェスチャ（同じ場所へのドロップ）に割り当てると、
    `20260923-pane-name-dnd-swap` に慣れた利用者が「ただの入れ替えのつもり」でドロップして
    誤ってプロセスを終了させる事故が起きうる。この懸念とのトレードオフとして、**中央ゾーンの
    視覚フィードバック（`.pane-frame-zone-center`）を、縁のゾーンと明確に異なる強調表示にする**
    （design の「視覚フィードバック」節を実装する際に、破壊的な操作であることが伝わる見た目に
    する。T9 のタスク点検で確認する）。
  - 完全に安全側に倒す代替案（今回は分割解除を実装しない）も検討したが、これは D1 で既に
    「今回は分割・分割解除の2つを扱う」と決めたスコープそのものを覆すことになり、後退が大きい。
- 影響:
  - `requirements.md`「目的/ゴール」「機能要件」「AC11」を修正（この decisions.md を根拠として
    引用）。
  - `packages/web/src/actions/ActionDispatcher.ts` の `swapPanesByDrag` は、呼び出し元
    （`PaneFrame.vue`）が無くなるため削除する（T9 の一部として。死んだコードを残さない）。
  - `packages/server/src/session/SessionModel.ts`/`SessionService.ts`/`surface/methods/pane.ts`
    の `swapPaneWith`/`pane.swap_with`（RPC そのもの）は**削除しない**——`replacePane` が内部で
    `LayoutTree.swap` を使っており（research.md F5）、RPC 自体が壊れているわけではなく、
    CLI・外部操作 API 等 UI 以外からの将来の呼び出し余地を潰すほどの理由が無いため。
    既存の `SessionModel.test.ts`/`SessionService.test.ts` の `swapPaneWith` 系テストは無改修のまま
    残す（AC11 の「pane.swap_with は変更しない」を字義どおり満たす）。
  - `packages/web/src/components/PaneFrame.test.ts` の、旧「ドロップ先を問わず `swapPanesByDrag`
    を呼ぶ」テストは、新しいゾーン方式（縁→`movePaneToEdge`・中央→`replacePaneWithDrag`）を
    確かめるテストに書き換える（T9）。

## D5: `replacePane` の後継 focus 選択と、クライアント側 `viewRepair.ts` の汎用フォールバックとの
   食い違いは、この work では直さず backlog へ送る

- 背景: cross-check（coding 全体の独立点検）で発見。`SessionModel.replacePane`（`SessionModel.ts`）は
  ドロップ先（`targetPaneId`）が focus 中だった場合の後継を**必ずドラッグした pane（`paneId`）**に
  する（design「振る舞いの詳細」）。一方、`packages/web/src/store/viewRepair.ts`
  （`pane.closed` を受けて、自分の focus が消えた pane を指していたら代わりを選ぶ、クライアント
  共通のロジック）は、「閉じた pane の代わりはレイアウト木の**最初の葉**（DFS順）」という
  `SessionModel.closePane` の既存規則だけを実装しており（`viewRepair.ts:21-24,66` のコメントに
  明記）、`replacePane` の「特定の pane が後継」という新しい規則を知らない。
  `SessionModel.test.ts` の実例で検証済み：`replacePane` 後のレイアウトが
  `{a: p2, b: paneId}`（DFS順は `[p2, paneId]`）になるケースでは、`live[0]` は `p2` であり
  `paneId`（実際の後継）と一致しない。
  **実害の範囲**：ドラッグを行った本人のクライアントは無関係（`PaneFrame.vue` が
  `view.focusPane(props.paneId)` を明示的に呼ぶ）。影響するのは、**同じ tab を見ている別クライアント
  が、たまたまローカルで `targetPaneId`（消える側）へ focus していた**場合のみ——`pane.closed` を
  受けた `repairView` が「最初の葉」（`p2`）へ飛ばしてしまい、視覚的にその位置を引き継いだはずの
  `paneId` ではなく別の pane に focus が移る。
- 決定: 今回は修正せず、`.aidev/backlog/product-roadmap.md` に follow-up 項目を追加する。
- 理由 / 代替案: 正しく直すには、`pane.closed`（または `layout.updated`）イベントに「閉じた pane に
  focus していたクライアントへの、推奨後継 pane」のヒントを新設し、`repairView` がそれを
  `closePane` 由来の「最初の葉」より優先して使う形にする必要がある——これは protocol
  （`packages/protocol/src/events.ts`）の変更を伴い、`repairView` は `closePane`・`replacePane`
  以外の将来の閉鎖経路すべてに影響する共有ロジックなので、影響範囲の検証もこの work の範囲を
  大きく超える。実害も「複数クライアントが同時に同じ tab を見ていて、かつ片方が他方の
  ドラッグ操作でちょうど消える pane に focus していた」という狭い条件が重なった場合に限られる
  （データ消失・誤操作ではなく、focus が想定と違う pane へ移るだけ）。
- 影響: コード変更なし。`.aidev/backlog/product-roadmap.md` に追記（`aidev backlog add`。
  `--source` は本 review.md）。`test-result.md`「未検証の穴」にも同内容を記録し、deliver の
  PR 本文「既知の制約」へ引き継ぐ。
