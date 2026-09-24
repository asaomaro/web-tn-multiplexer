# テスト結果: D&D による pane の分割・分割解除

## 実行したもの
- `pnpm -s typecheck`（ルート、全パッケージ横断） — exit 0
- `pnpm -s test`（ルート、全パッケージ横断） — 2829 passed / 0 failed（161 ファイル）
- `aidev smoke` — web・cli とも PASS
- `aidev coverage --strict` — `ac=16 design=16/16(100%) tasks=16/16(100%) gaps=0`
- T10（回帰確認。coding ではなく test 工程で消化。decisions.md D3）:
  `LayoutTree.test.ts`（15件）・`SessionModel.test.ts`（68件）・`SessionService.test.ts`（86件）・
  `surface/methods/index.test.ts`・`PaneFrame.test.ts`（36件）・`ActionDispatcher.test.ts`
  を個別に再実行し、いずれも無改修分を含め全件 green を確認済み。

## 受け入れ基準ごとの判定
- AC1: pass — `LayoutTree.test.ts`「insertAtEdge」で4方向を確認（`SessionModel.test.ts`
  「moveToEdge」で実際の呼び出し経路も確認）。`PaneFrame.test.ts`「縁（右）で離すと
  movePaneToEdge(…, 'right') を呼ぶ」でクライアント側も確認。
- AC2: pass — `LayoutTree.test.ts`「insertAtEdge: ネストした木でも対象の葉だけを置き換える」・
  `SessionModel.test.ts`「元あった場所の split は畳まれる（3枚の木で確認）」。
- AC3: pass — `insertAtEdge` が返す `LayoutNode` は既存の `{type:"split",...}` と同じ形（`split()`
  と共通の構造）であることをコード上で確認済み。既存の `setRatio`/`resizeBy`（`LayoutTree.test.ts`
  の既存テスト、無改修のまま green）が新しい split にもそのまま適用できることは、データ構造が
  同一である以上、追加の専用テストを要さない（`insertAtEdge` が独自の型を導入していないため）。
- AC4: pass — `PaneFrame.test.ts`「ホバー中のゾーンに応じたオーバーレイだけが出て、ドラッグ元には
  出ない」でゾーンごとのハイライト切り替えを確認。`paneDragZone.test.ts`（7件）でしきい値の
  判定自体を確認。
- AC5: pass — `SessionModel.test.ts`「replacePane: ドロップ先を閉じ、ドラッグした pane がその位置と
  スペースを引き継ぐ」・`PaneFrame.test.ts`「中央で離すと replacePaneWithDrag(自分, 相手) を呼ぶ」。
- AC6: pass — `SessionModel.test.ts`「replacePane: 両側で split が畳まれる（2 pane だけの tab でも
  成立する。research.md F5）」。
- AC7: pass — `SessionService.test.ts`「replacePane: ドロップ先のプロセスを破棄し、pane.closed →
  layout.updated の順に publish する」（`FakeTerminalHost.disposed` で実際の破棄を確認）。
- AC8: pass — `PaneFrame.test.ts`「確定後、ドラッグした pane にフォーカスが残る（確定前に別の pane
  が選ばれていても）」。
- AC9: pass — `SessionModel.test.ts`「moveToEdge/replacePane: 自分自身の縁/では何もしない」「別 tab
  の pane へは動かさない/とは何もしない」。`PaneFrame.test.ts`「自分自身の上・pane 以外の上で
  離すと何もしない」。
- AC10: pass — `SessionService.test.ts`「moveToEdge/replacePane: 成功すると layout.updated を
  publish する」（`layout.updated` が既存の全購読クライアントへの配布経路であることは
  `pane.swap_with`/`pane.split` と共通の既存の仕組み。design「複数クライアントでの同期」節）。
  実際に2ブラウザを起動しての目視確認は行っていない（後述「未検証の穴」）。
- AC11: pass — `LayoutTree.split`/`remove`/`swap`・`SessionModel.swapPaneWith`・
  `SessionService.swapPaneWith`・`pane.swap_with` RPC 登録・`SessionModel.test.ts`/
  `SessionService.test.ts` の `swapPaneWith` 系テストは、いずれもこの work で一切変更していない
  （T2〜T5 は新規関数・新規 RPC の追加のみ）。既存のキーバインドによる分割・pane を閉じる操作も
  変更していない。回帰確認（T10）で無改修のまま全件 green を確認済み。
  **ただし decisions.md D4 のとおり、`20260923-pane-name-dnd-swap` が確立した「名前ラベルの
  ドラッグはドロップ先を問わず入れ替え」というクライアント側の挙動は、縁/中央のゾーン方式に
  意図的に置き換わっている**（`swapPanesByDrag` は削除。`pane.swap_with` RPC 自体は無変更・
  無到達のまま残る）。これは要件の修正（AC11 の書き直し）を伴う正当な置き換えであり、回帰では
  ない。
- AC-I1: pass — `PaneFrame.test.ts`「閾値未満のまま離すとドラッグにならず、既存のクリック（pane を
  選ぶ）にフォールバックする」「ちょうど閾値（6px）動かすとドラッグが始まる」。
- AC-I2: pass — `PaneFrame.test.ts`「ドラッグ中に Esc を押すと取り消され、離しても何も送らない」
  「ドラッグ中にダイアログが開くと取り消され、離しても何も送らない」（`20260923-pane-name-dnd-swap`
  から継承した既存の後始末経路。この work は新しいコードを足していない）。
- AC-I3: pass — 既存のキーバインドによる分割・pane を閉じる操作の経路はこの work で一切触っておらず
  （「対象範囲」に無い）、回帰確認（T10）で無改修のまま green。
- AC-I4: pass — AC8 と同じ（`view?.focusPane`/`registry?.focus` の明示呼び出し）。
- AC-I5: pass — 境界のリサイズ・既存のキーバインド操作の経路は「対象範囲」に無く、この work では
  触っていない。`20260923-pane-name-dnd-swap` から継承する後始末（Esc・ダイアログ・自消失）も
  そのまま流用しており、既存の防御が崩れる余地が無い（回帰確認済み）。

## 失敗の証跡
このラウンドでは失敗が発生していない。

ただし、coding 工程の途中（T3・SessionModel.test.ts）で、自分が手計算した期待値
（`insertAtEdge` の「元あった場所の split が畳まれる」ケース）を誤って書いたことによる
テスト失敗を1件経験している（実装のバグではなく、テストの期待値のミス）:

```
$ npx vitest run src/session/SessionModel.test.ts
 FAIL  src/session/SessionModel.test.ts > SessionModel — focus / navigation > moveToEdge >
   元あった場所の split は畳まれる（3枚の木で確認）
AssertionError: expected { type: 'split', id: 's1', …(4) } to deeply equal { Object (type, id, ...) }
（a/b の入れ子構造が期待値と逆だった）
```

期待値を実装の実際の出力に合わせて修正し（トップレベルの split が残り、その a 側が新しい
入れ子の split に置き換わる、という正しい構造に修正）、以降は green。

## 起動確認（smoke）

```
$ aidev smoke
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke(web): PASS
smoke(cli): server listening on http://127.0.0.1:38306
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

GO（exit 0）。この work は既存の `smokeCommands` がカバーする表面（web 接続・pane 入出力、cli
ワークフロー）に新しい入口を追加していない（pane の D&D 分割・分割解除は既存のサイドバー・
RPC 経路の拡張であり、独立した起動確認対象ではない）ため、`smokeCommands` への追加は不要と判断。

## 追記（review 指摘 must の修正後の再検証）

review 工程の独立点検で must 1件（中央ドロップでの分割解除が busy な pane を確認なしに閉じていた。
`review.md`「レビュー（review 工程）」参照）が見つかり、coding へ差し戻さず review 内で
`closePaneById`/`closeTabById` と同じ D23 の確認ダイアログパターンで修正した。回帰テストを
`ActionDispatcher.test.ts` に4件・`ConfirmDialog.test.ts` に4件追加、負の確認済み。

再検証:
```
$ pnpm -s typecheck   # exit 0
$ pnpm -s test        # 2837 passed / 0 failed（161 ファイル。修正前 2829 → 新規8件追加）
$ aidev coverage --strict   # ac=16 design=16/16 tasks=16/16 gaps=0（変化なし）
$ aidev smoke          # web・cli とも PASS（変化なし）
```

AC5・AC7（分割解除・プロセス終了）の判定は上記の修正を踏まえ pass のまま変更なし（busy pane への
確認ゲートは既存の D23 パターンの一貫した適用であり、AC の記述自体を変える必要は無い——
「ドロップ先の pane が閉じられ…プロセスが終了する」という結果自体は同じで、busy なときだけ
確認を挟む経路が追加されただけ）。

## 未検証の穴（skip / 環境不足）
- **E2E（Playwright）は未実行**（プロジェクトの運用: ユーザーからの明示的な依頼があるときだけ
  実行する。今回は依頼が無かったため未実行）。D&D のポインタ操作としての検証は jsdom 上の
  `pointerdown`/`pointermove`/`pointerup` イベント合成（`20260923-pane-name-dnd-swap`・
  `20260923-workspace-grouping` の既存パターンを踏襲）で行っており、実ブラウザでの視覚的な確認
  （ドラッグ中のゾーンオーバーレイの見た目・色の見分けやすさ）は行っていない。
- **複数クライアント同時操作（AC10）の実ブラウザでの目視確認は未実施**。`layout.updated` の
  配布経路は既存の `pane.swap_with`/`pane.split` と共通の仕組みであり、unit/integration
  レベル（`SessionService.test.ts` でのイベント publish 確認）でのみ検証した。
- **decisions.md D5（未対応・backlog送り）**: 複数クライアントで同じ tab を見ているとき、
  一方の分割解除でドロップ先が閉じられると、その pane へローカルで focus していた別クライアントの
  focus 復帰先（`viewRepair.ts` の「最初の葉」フォールバック）が、`replacePane` の実際の後継
  （ドラッグした pane 自身）とずれることがある。cross-check で発見・確認済みだが、修正には
  protocol への「推奨後継」ヒント追加が必要で本 work の範囲を超えるため、backlog へ送った。
- **ゾーンのしきい値（30%）は「確立パターンに倣った推定値」**（research.md F18・design.md）。
  VS Code のエディタ分割の一般的な挙動を参考にしたが、一次資料での検証はしていない。実際に
  触って極端に狭い/広いと感じる場合は今後調整可能。
