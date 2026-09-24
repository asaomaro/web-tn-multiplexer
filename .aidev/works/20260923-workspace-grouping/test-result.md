# テスト結果: workspace のグルーピングと並べ替え

## 実行したもの
- `pnpm -s typecheck`（ルート、全パッケージ横断） — exit 0（型エラーなし）
- `pnpm -s test`（ルート、全パッケージ横断） — 2787 passed / 0 failed / 0 skipped（160 ファイル）
- `aidev smoke` — web・cli とも PASS（下記「起動確認」参照）
- `aidev coverage --strict` — `ac=16 design=16/16(100%) tasks=16/16(100%) gaps=0`（struct=0 / cover=0）
- test 工程内で発見した抜け（`Sidebar.vue` の worktree 自動グループ版
  `visibleChildren` 分岐に専用テストが無かった）に対し `Sidebar.test.ts` へ 2 件追加し、
  この会話の一貫した方針どおり負の確認（一時的に実装を壊して新テストが失敗することを確認 →
  復元して全体が緑に戻ることを確認）を実施済み。

## 受け入れ基準ごとの判定
- AC1: pass — `workspaceGrouping.test.ts`「autoGroupsOf」で、同じ `repoKey` の workspace が
  2件以上のときだけ束ねることを確認（`isLinkedWorktree` の親子判定・本体不在時の暫定親フォールバック
  ・手動グループ優先の除外を含む6ケース）。サーバ側は `SessionModel.test.ts`
  「linkedWorktreeGroupMembers」で同じ判定をカバー（cross-check 2 ラウンドで client/server の
  実装乖離を検出・修正済み）。
- AC2: pass — 上記「1件なら束ねない」ケース（`workspaceGrouping.test.ts:30`）で確認。
- AC3: pass — `Sidebar.test.ts`「Sidebar — グループの表示」で、折りたたみ・展開のトグル、および
  折りたたみ中でも focus 中の workspace の行だけ見える例外を確認。手動グループ版（既存、AC6 と共有の
  ロジック）に加え、この test 工程で **worktree 自動グループ版の専用テストが欠けていたことを発見**し、
  2件追加（`Sidebar.test.ts` の「worktree 自動グループが折りたたまれていても…」「…focus 中の
  workspace が無ければ、本体の行だけになる」）。`Sidebar.vue:116` の `visibleChildren` 分岐を
  一時的に壊して新テストが失敗すること、復元後に59件全て通ることを確認済み（負の確認完了）。
- AC4: pass — `SessionService.test.ts:530`（`createGroup` → `group.created` イベント）、
  RPC レベルは `surface/methods/index.test.ts:355`（`group.create` 呼び出しの往復）で確認。
- AC5: pass — 同上テストブロックで `rename`/`toggle_collapsed`/`add_member`/`remove_member`/`delete`
  の全経路を確認。存在しない `groupId` に対する `group.rename` のエラー応答も
  `index.test.ts:375` でカバー。
- AC6: pass — `WorkspaceGroup.collapsed` のサーバ永続化は `SessionFile.test.ts` のラウンドトリップ
  テストで、focus 中 workspace の例外表示は `Sidebar.test.ts` の「折りたたみ中でも focus 中の
  workspace があればその行だけは見える（AC6）」で確認。
- AC7: pass — `Sidebar.test.ts`「Sidebar — workspace 行の D&D」で、閾値未満の移動はクリック扱い、
  閾値超えかつ別行上でのドロップで `moveWorkspacesByDrag` が呼ばれることを確認
  （`ActionDispatcher.test.ts` 側で `workspace.move_to` への変換も確認）。
- AC8: pass — `bindings.test.ts` で `move_workspace_previous`/`move_workspace_next` の登録、
  `ActionDispatcher.test.ts:1046` 以降で `moveWorkspace` が `workspace.move` を送ること
  （対象 workspace が無い／session に存在しない場合は送らないガードを含む）を確認。
- AC9: pass — `Sidebar.test.ts:703`「グループのヘッダー行をドラッグすると、そのグループの全メンバー
  id をまとめて動かす（AC9）」で確認。
- AC10: pass — `SessionService.test.ts:573` 以降（`closeLinkedWorktrees=true` で同じ `repoKey` の
  linked worktree を道連れに閉じる／対象を持たなければ単体のみ／既定 `false` では回帰しないことを
  含む3ケース）、RPC レベルは `index.test.ts:332`、UI 側は `ConfirmDialog.test.ts:126` 以降
  （チェックボックスの表示条件・既定オフ・複数対象では出さない）、`ActionDispatcher.test.ts:429`
  以降（単一 workspace 対象にだけ適用する防御的ガードを含む）で確認。
- AC11: pass — 既存の `orderedWorkspaceIds`・`view.workspaceSort` のロジック自体は変更しておらず
  （`Sidebar.vue:84` の `groupedWorkspaceRows` 呼び出しに `view.workspaceSort` をそのまま渡す形）、
  既存のソート関連テスト（`Sidebar.test.ts`「Sidebar — agents の並び順」等）が全て緑のまま。
- AC-I1: pass — 折りたたみアイコンのクリックが `collapsedAutoGroups`/`WorkspaceGroup.collapsed`
  を即座に反映することは AC3・AC6 のテストで確認済み。トグルボタンの `@pointerdown.stop`/
  `@pointerup.stop`（二重発火の回帰テストを含む）で確認。
- AC-I2: pass — `Sidebar.test.ts` の D&D ブロックで、ドロップ先が無い（閾値未満の移動）場合は
  `moveWorkspacesByDrag` を呼ばずクリック（フォーカス）として扱うことを確認。Esc によるドラッグ
  破棄は `PaneFrame.vue` の既存パターンを踏襲した実装で、`onRowPointerCancel`/Escape ハンドラの
  存在をコードで確認済み（`workspace.move_to` を送らない設計どおり、専用の破棄テストは D&D
  ブロックの「閾値未満は send しない」ケースと同じ経路で暗黙にカバーされる）。
- AC-I3: pass — グループ関連操作は全て `ContextMenu.vue` 経由（`ContextMenu.test.ts` の
  「新しいグループを作る…」「グループへ追加…」「グループから外す」「名前の変更」
  「グループを削除」の各項目テスト）で、既存のキーボードだけで開閉できる経路に載っていることを確認。
  並べ替えはキーバインド（AC8）でも完結する。
- AC-I4: pass（コード確認） — `moveWorkspace`/`moveWorkspacesByDrag`/`toggleGroupCollapsed` の
  いずれの実装（`ActionDispatcher.ts`）も `view.setView` 等のフォーカス変更 API を一切呼ばない
  （既存の focus 管理コードに変更なし）。テストの `expect(conn.requests).toEqual([...])` で
  送信内容のみを検証しており、view state への副作用が無いことは実装のレビューで確認。
- AC-I5: pass — `pnpm -s test` 全体（2787 件）が回帰なしで通過しており、workspace 切替・
  右クリックメニュー・並び順トグル・agents 区画の既存テストが変更なしに全て緑。折りたたみ・D&D の
  ポインタイベントハンドラは `Sidebar.vue` の workspace 行・グループヘッダー行の要素に閉じて
  `.stop` 修飾子が付いており、他要素への波及がないことをコードで確認。

## 失敗の証跡
このラウンドでは失敗が発生していない（全 AC 一次確認・2件のテスト追加・負の確認まで含め、
最終実行はすべて green）。

test 工程中に発見した唯一の抜け（AC3 の worktree 自動グループ版専用テストの欠如）は、
テスト追加時点で該当ロジック自体はバグなく実装済みだったため、テスト失敗という形では現れていない
（テストの不在であり、実装の不具合ではなかった）。追加したテストに対する負の確認の記録：

```
# Sidebar.vue:116 を一時的に破壊（row.collapsed に関わらず children を空にする）
$ npx vitest run src/components/Sidebar.test.ts -t "focus 中の子 workspace はその行だけ見える"
 FAIL  src/components/Sidebar.test.ts > Sidebar — グループの表示 >
   worktree 自動グループが折りたたまれていても、focus 中の子 workspace はその行だけ見える（AC3）
AssertionError: expected [ 'main' ] to deeply equal [ 'main', 'wt' ]
 Tests  1 failed | 58 skipped (59)

# 復元後
$ npx vitest run src/components/Sidebar.test.ts
 Test Files  1 passed (1)
      Tests  59 passed (59)
```

coding 工程（タスク点検・cross-check）で発見・修正されたバグの負の確認は
`review.md`「タスク点検ログ」に記録済み（test 工程の対象外、母集団が異なるためここでは再掲しない）。

## 起動確認（smoke）

```
$ aidev smoke
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke(web): PASS
smoke(cli): server listening on http://127.0.0.1:39346
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

GO（exit 0、web・cli の両方が起動〜基本往復まで到達）。この work は既存の `smokeCommands` が
カバーする表面（web 接続・pane 入出力、cli ワークフロー）に新しい入口を追加していない
（workspace グルーピングは既存のサイドバー・RPC 経路の拡張であり、独立した起動確認対象ではない）
ため、`smokeCommands` への追加は不要と判断。

## 追記（review 差し戻しラウンド1の修正後の再検証）

review 工程の独立点検で must 1件・should 1件が見つかり、coding へ差し戻して修正した
（詳細は `review.md`「レビュー（review 工程）」節・`decisions.md` D11/D12）。

- **must（AC8/AC-I4 に関わる回帰）**: `Sidebar.vue` の描画がグループをブロック単位でまとめる形に
  切り替わっていたのに、`ActionDispatcher.workspaceDelta`（`previous_workspace`/`next_workspace`）・
  `navigate`（サイドバー内ジャンプ選択の up/down）が旧来の素の反復順のままだったため、画面上の
  隣と実際の移動先が食い違う回帰があった。`visibleWorkspaceIdsInOrder`（共有純関数）に統一して修正。
  回帰テストを `ActionDispatcher.test.ts` に2件追加、負の確認済み（元の実装に戻すと2件とも
  実際に失敗することを確認 → 復元）。
- **should（AC7/AC9 の edge case）**: グループの頭以外のメンバー行へドロップしたときのハイライトと
  実際の効果が食い違っていた（design の「グループ内部は開いた順で固定」というポリシー自体は
  正しく実装されていたが、ハイライトがそれと整合していなかった）。`groupHeadRowKeyFor` による
  正規化で修正。既存テスト1件を新しい挙動に合わせて書き直し、新規2件を追加、負の確認済み。

再検証:
```
$ pnpm -s typecheck   # exit 0
$ pnpm -s test        # 2800 passed / 0 failed（160 ファイル。修正前 2787 → 新規13件追加）
$ aidev coverage --strict   # ac=16 design=16/16 tasks=16/16 gaps=0（変化なし）
$ aidev smoke          # web・cli とも PASS（変化なし）
```

AC8・AC-I4 の判定は上記の修正を踏まえ pass のまま変更なし（修正後に検証し直した上での pass）。
AC7・AC9 も同様（修正後の再検証込みで pass）。

## 未検証の穴（skip / 環境不足）
- **E2E（Playwright）は実行していない**。プロジェクトの運用（このリポジトリでの直近の合意）では
  E2E はユーザーからの明示的な依頼があるときだけ実行し、通常の検証は vitest（jsdom/happy-dom）に
  限定する（共有マシン上でのリソース競合により、E2E は無関係な大量失敗を招きやすいため）。
  今回の作業でユーザーからの明示的な E2E 依頼は無かったため未実行。
  D&D・折りたたみの実クリック/ポインタ操作としての検証は jsdom 上の `pointerdown`/`pointermove`/
  `pointerup` イベント合成（`PaneFrame.test.ts` の既存パターンを踏襲）で行っており、実ブラウザでの
  視覚的な確認（ドラッグ中のカーソル追従・ハイライト表示の見た目）は行っていない。
- **複数クライアント間の同時実行（マルチクライアント）でのグループ操作の競合**は、
  `toggleGroupCollapsed` のサーバ側トグル計算（`group.toggle_collapsed`。decisions D10）という
  設計でレースコンディション自体は解消済みだが、実際に2クライアントを同時起動しての目視確認は
  行っていない（unit/integration レベルの `service.toggleGroupCollapsed` 2回呼び出しテストで
  「もう一度で戻る」ことのみ確認）。
- **実機（3 OS）でのタッチ操作・実際のマウス操作でのフィーリング**は、`docs/` にある実機検証手順の
  対象だが、今回は未実施（this work の範囲外の運用手順であり、E2E と同様ユーザー依頼ベース）。
- **AC8（キーバインドでの並べ替え）の edge case**: 手動グループの非アンカーメンバーを
  `move_workspace_previous`/`next` で動かすとき、flat 配列上の隣が別グループ/無所属で、かつ
  グループのアンカー位置をまたがない場合、画面上は無反応に見えることがある（review round2 で
  机上確認、自動テスト化はしていない。`decisions.md` D13・`review.md`「ラウンド2」参照）。
  D&D 側の同種の問題は修正済み（D12）。キーバインド側は protocol 変更を要するため今回は
  backlog（`.aidev/backlog/product-roadmap.md`）へ送り、コード修正は保留。
