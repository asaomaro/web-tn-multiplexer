# テスト結果: worktree の削除

## 実行したもの

- `packages/protocol`: `npx tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — 68 passed / 0 failed / 0 skipped
- `packages/server`: `npx tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — 779 passed / 0 failed / 0 skipped
- `packages/web`: `npx vue-tsc --noEmit -p tsconfig.typecheck.json` — 0 errors /
  `npx vitest run` — 1940 passed / 0 failed / 0 skipped
- ルート: `pnpm -s typecheck` — exit 0（3パッケージ横断の再確認。`pnpm -s test` でも
  2920 passed / 0 failed を確認済み）
- `aidev smoke` — PASS（web・CLI 双方。下記「起動確認」参照）
- `aidev coverage --strict` — ac=16 design=16/16(100%) tasks=16/16(100%) gaps=0

**review round1（should 2件・修正見送り should 1件・nit 1件）を受けた coding への差し戻し後、
再度この工程を実施した。** 直した2点（`ActionDispatcher.ts` の「削除対象が一覧を開いた元の
workspace 自身なら openWorktree を呼ばない」・「RPC 応答待ち中に他のダイアログを奪わない」）は
いずれも負の確認（修正前のコードに戻すと新テスト3件が実際に失敗することを確認）済み。
web のテスト総数が 1937→1940（+3）に増えている。

T1〜T8 のいずれについても、実装時に追加したテストは全て上記の一括実行に含まれる
（個別の pass 件数は各タスクの taskcheck ラウンドで既に確認済み。ここでは work 全体としての
再実行結果を記録する）。T2 の taskcheck で発見・修正した「`WorktreeService` interface への
`remove` 追加が対象外の2ファイル（`surface/methods/index.test.ts`・
`ws/WsGateway.integration.test.ts` の `stubWorktrees`）の型検査を壊していた」件は、
このセッションで `tsconfig.json`（テストを含まない）ではなく `tsconfig.typecheck.json`
（テストを含む。`pnpm typecheck` が実際に使う設定）を使うよう自分の確認手順を修正したことで
発見できた——以後この work のテスト工程では一貫して `tsconfig.typecheck.json` を使っている。

## T9（回帰確認）の実施内容

tasks.md の T9 はこの工程で消化する（decisions は無し——単純な既存テスト実行の確認のため、
`20260924-pane-dnd-split-move`/`20260924-pane-move-cross-tab` の decisions.md D3/D1 と
同じ扱いだが、今回は判断を要する分岐が無かったので記録は省く）。

- `WorktreeService.test.ts`（`list`/`create` 関連の既存21テスト）: 無改修のまま全て pass。
- `ConfirmDialog.test.ts`（`confirmClose`/`confirmReplacePane` 関連の既存17テスト）: 無改修の
  まま全て pass（新しい `CONFIRM_DIALOG_KINDS` 判定・`cancel()` の arrow function 化を経ても
  影響なし）。
- `WorktreeOpenDialog.test.ts`（既存7テスト。↑↓/Enter/Esc/クリックでの確定）: 無改修のまま
  全て pass（`onKeydown` への `Delete`/`Backspace` 追加・`ArrowUp` 分岐への `return` 追加後も
  影響なし）。
- `ActionDispatcher.test.ts`（`newWorktree`/`confirmWorktreeCreate`/`confirmWorktreeOpen`
  関連の既存テスト）: 無改修のまま全て pass。
- `surface/methods/index.test.ts`・`ws/WsGateway.integration.test.ts`: 無改修のまま全て
  pass（`stubWorktrees` への `remove` スタブ追加は T2 taskcheck で対応済み——これ自体は
  「既存ファイルの変更」だが、型を満たすための最小限の追加で、テストの内容・検証対象は
  変えていない）。
- 既存の worktree 作成・開く（`worktree.create`/`confirmWorktreeOpen`）の RPC・キーバインド・
  D&D（pane 移動・workspace 並べ替え）関連のテストも上記の一括実行（`pnpm -s test`）に含まれ、
  全て pass。

## 受け入れ基準ごとの判定

- AC1: pass — `WorktreeOpenDialog.test.ts`「削除ボタンで removeWorktree を呼ぶ」・
  「Delete/Backspace キーで削除する」で確認。
- AC2: pass — `WorktreeService.test.ts`「remove」describe の「成功すると、その worktree は
  一覧から消える」で確認（本物の git を使い、`list()` で実際に消えたことを確認）。
- AC3: pass — `ActionDispatcher.test.ts`「confirmWorktreeRemove：...成功すると一覧を開き直す」
  で確認。design で「即座に開き直す」形に確定した（`worktree.list` を開き直すまでもなく反映、
  ではなく、開き直すことで反映する形）。
- AC4: pass — `ConfirmDialog.test.ts`「開いている workspace と一致すれば、閉じることに
  触れたメッセージになる」・`ActionDispatcher.test.ts`「removeWorktree：...openWorkspaceId
  に入る」で確認。
- AC5: pass — `WorktreeService.test.ts`「開いている workspace の cwd と一致すれば、成功後に
  その workspace を閉じる」で確認（`session.closedWorkspaceIds` を検証）。
- AC6: pass — `WorktreeService.test.ts`「未コミットの変更（dirty）があると worktree_dirty で
  失敗し、削除されない」・`classifyWorktreeRemoveError`「未コミットの変更が残っている」で確認。
- AC7: pass — `ActionDispatcher.test.ts`「dirty で失敗すると...--force 確認を開く」・
  `ConfirmDialog.test.ts`「dirty での --force 確認は専用のメッセージ」で確認。
- AC8: pass — `WorktreeService.test.ts`「dirty でも --force を付ければ削除できる」・
  `ActionDispatcher.test.ts`「confirmWorktreeRemoveForce：worktree.remove(force:true) を送る」
  で確認。
- AC9: pass — `WorktreeService.test.ts`「既に worktree でない対象は worktree_not_a_worktree」・
  「main working tree は削除できない」・`ActionDispatcher.test.ts`「dirty 以外の失敗は、
  トーストで知らせてから一覧を開き直す」で確認。
- AC10: pass（開いている workspace を閉じる副作用については確認済み。一覧自体の即時同期は
  design で対象外と確定——下記「未検証の穴」参照）— `WorktreeService.test.ts`「開いている
  workspace の cwd と一致すれば、成功後にその workspace を閉じる」の `closeWorkspace` 呼び出しが
  既存の `pane.closed`/`tab.closed`/`workspace.closed` イベント配布（この work では変更していない
  既存の仕組み）を経由することをコードで確認済み。
- AC11: pass — T9 の回帰確認（上記）で、`worktree.create`/`confirmWorktreeOpen`・既存の
  `ConfirmDialog`/`WorktreeOpenDialog` の振る舞い・既存のキーバインド・既存の D&D 操作が
  無改修のテストで全て通ることを確認。
- AC-I1: pass — `ConfirmDialog.test.ts`「role=alertdialog で開き、最初のフォーカスは
  「キャンセル」」・`ActionDispatcher.test.ts` の各 `openWorktree` 呼び出し確認。
- AC-I2: pass — `ConfirmDialog.test.ts`「「削除」ボタンで confirmWorktreeRemove を呼ぶ」・
  「「キャンセル」ボタンは削除を送らず、一覧ダイアログへ戻る」で確認。
- AC-I3: pass — `WorktreeOpenDialog.test.ts`「Delete キーで、選択中の項目を削除する」・
  「Backspace キーでも同様に削除する」・`ConfirmDialog.test.ts`「y で削除を確定・n で
  キャンセル」で確認。
- AC-I4: pass — `ConfirmDialog.test.ts`「role=alertdialog で開き、最初のフォーカスは
  「キャンセル」（AC-I4）」で確認（`confirmWorktreeRemove`/`confirmWorktreeRemoveForce` 双方）。
- AC-I5: pass — `WorktreeOpenDialog.test.ts`「削除ボタンのクリックは行の「開く」へ伝播しない」・
  「Delete/Backspace は既存の ↑↓/Enter/Escape と衝突しない」で確認。

## 失敗の証跡

このラウンドでは失敗が発生していない。T1〜T8 のコーディング中の taskcheck ラウンドで見つかった
指摘（T1: nit 1件、T2: must 1件・should 1件・nit 1件、T7: should 1件）は全て `review.md`
「タスク点検ログ」に記録済みで、いずれもその場で修正し、修正後の再実行で pass している
（T2 の must 指摘は負の確認済み——修正前のコードに戻すと新テストが実際に失敗することを確認）。
test 工程としての実行では最初から全て pass だった。

## 起動確認（smoke）

```
$ aidev smoke
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:38326 (state dir /tmp/wtm-smoke-KJkXUR)
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
$ pnpm --filter @wtm/cli run smoke
smoke(cli): wtmctl workspace create ok (pane p2)
smoke(cli): wtmctl pane run ok (no --token needed; cached session reused)
smoke(cli): wtmctl pane read ok (echo round trip confirmed)
smoke(cli): wtmctl snapshot ok
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

この work は新しい起動経路（サブコマンド・オプション）を追加していないため、
`smokeCommands` への追記は不要（既存の smoke がそのまま成果物の起動を確認する）。

## 未検証の穴（skip / 環境不足）

- **実ブラウザでの複数タブ・複数クライアント同時接続による目視の D&D・削除確認は行っていない**
  （このセッションの既定方針: E2E はユーザー依頼のときだけ実施。今回はユーザーからの明示的な
  E2E 実施依頼が無かったため、vitest（happy-dom）と本物の git（`WorktreeService.test.ts`）に
  よる単体テストのみで検証した）。AC1・AC10 は、ブラウザでの実際のポインタ操作・複数
  WebSocket 接続ではなく、コンポーネント単体テストと `SessionService.closeWorkspace` の
  既存イベント配布のコードレベルの確認に留まる。
- **submodule を含む worktree の削除エラー文字列（`classifyWorktreeRemoveError` の
  `worktree_dirty` 分岐の一部）は実機未検証**（design.md「依拠する既存の事実」で明記済み。
  このリポジトリ自体に submodule が無く、意図的に作らない限り再現できない。herdr のソースに
  ある文字列をそのまま踏襲している）。
- **WSL/Windows など実機・複数 OS 環境での確認も行っていない**（同上の理由）。
