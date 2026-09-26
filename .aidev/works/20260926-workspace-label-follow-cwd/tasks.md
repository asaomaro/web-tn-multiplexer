# タスク: workspace の自動の名前と git の情報を、最初の pane のいまの場所に追従させる

## 実装方針

design の D1〜D7 を、サーバの内側（`SessionService`）→ 監視（`GitInfoPoller`）→ 組み立て（`composeServer`）→ E2E の前提・文書の順に積む。
`SessionService` の新しい口（`identityCwdOf`・`followedLabel`・`applyWorkspaceIdentity`）は偽の fs（`fakeLabelDeps`）で単体に確かめ、
監視との結線は実物の git（`GitInfoPoller.test.ts` の足場）で確かめる。

## 作業順序と依存関係

下の `依存:` に従う。

## リスク / 留意点

- 既存の作成の順序（名前を決めてから予約と起動。前の work の decisions D1）を変えない。
- `updatePaneRuntime` に await を足さない（毎秒の同期の処理）。
- 触るファイルはどれも HEAD で prettier の未整形なので `--write` は使わない。
- E2E は走らせない（利用者の方針）。`workspace-auto-label.spec.ts` の前提の直しは読解だけで確かめ、未検証の穴として残す。

## テスト方針

- 単体（vitest）: `SessionService.test.ts` に「最初の pane のいまの場所」の describe を足す（AC4〜AC9・AC11・AC14・AC15）。
  `GitInfoPoller.test.ts` に実物の git で `cd` 相当（`updatePaneRuntime` の `cwd`）を与える describe を足す（AC1〜AC6・AC8 の git の側・AC10。
  ほかの pane の場所が変わっても見直さないこと〔AC4〕、復元した workspace を `start()`/`pollNow()` で最初の pane の場所で取ること〔AC8〕を含む）。
  AC5 は購読するイベントの種類ごとに 1 件ずつ（`pane.closed`・`layout.updated`〔入れ替え〕・`tab.closed`・`workspace.updated`〔tab の並べ替え〕）。
  AC11 は場所が変わらないイベント（題名だけの `pane.updated`・名前だけの `workspace.updated`）で git の問い合わせが増えないことを数える。
  負の確認には、購読の対象から 1 種類ずつ外す変異を入れる。
- 文書（AC12・AC13）: 直した節を requirements の「herdr との違い」と design の振る舞いに照らして読む（test 工程で記録）。
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 直した箇所（`pollWorkspace` の場所・`identityCwdOf`・`followedLabel` の早期リターン・
  `applyWorkspaceIdentity` の古い結果を捨てる判定・`renameWorkspace`/`restoredLabel` の場所・`followMoves` の `polledCwd` との比較・`degraded` の判定〔待ち終えた
  時点の `labelLookupsStuck` で判定する誤りを含む〕・名前変更の決め直し）を 1 つずつ戻してテストが落ちることを確かめ、生の出力を貼る。
- 一式: `pnpm -s test`・`pnpm -s typecheck`・`pnpm -s build`・`aidev smoke`。

## タスク

- [x] T1: `SessionService` に最初の pane の場所（`identityCwdOf`）・`labelCwd` と `forgetWorkspace`・`followedLabel`・`applyWorkspaceIdentity` を足し、
      作成・名前変更（`identityCwdOf` から。待つ間に場所が変わったら新しい場所で決め直し、3 回を超えたら名前は入れず `autoLabel` だけ立てて `labelCwd` を消す）・
      復元（保存の最初の pane の `cwd` から）で決めた場所を記録する。`autoLabelFor` に `degraded`（待つ前の stuck・待つ間の上限超え〔`labelTimeouts` の累計〕・
      reject。待ち終えた時点の stuck では判定しない。design D3）を足す。単体テストを足す。
      対象: `packages/server/src/session/SessionService.ts:218` `createWorkspace`・`:248` `autoLabelFor`・`:260` `renameWorkspace`・`:726` `updateWorkspaceGit`・`:872` `restoredLabel`・`labelGen.delete`（5 か所）/ 根拠: research A1〜A4・A7
      依存: なし
      AC: AC4, AC6, AC7, AC8, AC9, AC11, AC14, AC15
- [x] T2: `GitInfoPoller` を、いまの場所で git と名前を一緒に見直す形にし、バスの購読で場所の変化にすぐ気づくようにする。`composeServer` でバスを渡す。
      実物の git の単体テストを足す。
      対象: `packages/server/src/git/GitInfoPoller.ts:26` constructor・`:59` `pollWorkspace`、`packages/server/src/composeServer.ts:189` / 根拠: research A5・A6
      依存: T1
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC8, AC10, AC11
- [x] T3: E2E `workspace-auto-label.spec.ts` の 1 本目を、既定の workspace の最初の pane ではなく分割した pane で `cd` する形に直す（前提の直し。走らせない）。
      対象: `packages/e2e/src/specs/workspace-auto-label.spec.ts:103-108` / 根拠: research A8・F8
      依存: T2
      AC: AC4
- [x] T4: 文書を直す: `docs/herdr-parity.md` の H01b、`docs/verification.md` の自動の名前の説明と確かめ方。
      対象: `docs/herdr-parity.md:24`・`docs/verification.md:63-69`・`:234-245` / 根拠: research「影響範囲」
      依存: T2
      AC: AC12, AC13
- [x] T5: 保存の tab を並べ替えた順（`ws.tabIds`）で書く（cross の点検で見つかった。decisions D8）。統合テストを足す。
      対象: `packages/server/src/composeServer.ts` `toSessionFileData`
      依存: T1
      AC: AC8, AC14
- [x] T6: worktree の一覧・作成・削除を、いまの場所（`identityCwdOf`）のリポジトリで行う（review ラウンド 1。decisions D10）。requirements・docs を直す。
      対象: `packages/server/src/git/WorktreeService.ts` `cwdOf`
      依存: T1
      AC: AC9
- [x] T7: リンクを含む論理パスと監視の実パスが同じディレクトリなら名前を決め直さない（review ラウンド 1。decisions D11）。
      対象: `packages/server/src/session/SessionService.ts` `followedLabel`、`packages/server/src/session/workspaceLabel.ts` `WorkspaceLabelDeps`
      依存: T1
      AC: AC11
