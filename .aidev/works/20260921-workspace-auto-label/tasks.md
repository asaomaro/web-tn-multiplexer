# タスク: workspace の既定の名前を、開いた場所（リポジトリ）から自動で付ける

## 実装方針

**protocol → server の規則（純粋な部分）→ server のモデル → server の作成・名前変更・復元 → web → 文書 → E2E** の順に積む。
名前を決める規則は `session/workspaceLabel.ts` の 1 か所（design D3）に置いて単体で総当たりし、`SessionService` は呼ぶだけにする。
**protocol を変えたら `pnpm -C packages/protocol build` で `dist` を作り直す**（server・web は `dist` を読む）。
`Workspace.autoLabel` は省略できない項目なので（design D2）、protocol を変えた時点で型で落ちる所（web のテストの組み立て 14 ファイルと、server の本体
`SessionModel.ts:177`・`:526` の `const workspace: Workspace`）を同じタスクで暫定の値にして、**どのタスクの後も typecheck と単体を緑に保つ**。
`SessionModel` の引数を変えるタスクも、呼び出し側（`SessionService`）を暫定の値で合わせる（後のタスクで本物にする）。
回帰を守るテストは条項 `regression-negative-control` のとおり「直した箇所を戻すと落ちる」ことを確かめる。

## 作業順序と依存関係

下の `依存:` に従う。依存では表せない理由だけ書く。

- **E2E の一式は deliver の直前に 1 回だけ回す**（利用者の指示）。直している間と test 工程では、影響を受ける spec だけ（新しい spec・
  `new-terminal-cwd.spec.ts`〔名前を渡さない `prefix+N`＝予約の前に await を足す経路〕・`workspace-tab-pane.spec.ts`〔名前の変更・worktree〕・
  `keys-mouse-dialogs.spec.ts`〔名前のダイアログ〕・`reconnect-restore.spec.ts`〔復元〕・`mobile.spec.ts`〔上のバー〕・`notifications.spec.ts`〔通知の場所〕）。
- **E2E の前には必ず `pnpm build`**（`@wtm/server` は `dist/testkit.js` を読み、web は `packages/web/dist` から配られる）。E2E で負の対照を取るときは、
  壊した状態でビルドして走らせ、戻した状態でビルドし直す。

## リスク / 留意点

- **`createWorkspace` は名前を決めてから予約と起動へ進む**（design D4b・decisions D1）。起動の成功から commit までの間に await を挟まない
  （挟むと、その間に終わったシェルの pane が残る）。既存のテストではこの順序の違反を捕まえられない（どれも「猶予の後、名前を決めている間にシェルが
  終わる」形を作らない）ので、**T4 で順序を固定するテストを足す**（偽の deps の stat を保留にしている間は `terminals.create` が呼ばれない）。
- 名前を確かめるテストは偽の deps を渡す（`makeService`・`makeNewCwdService` の両方）。名前を確かめない既存のテストは既定の deps（本物の fs）のままでよい
  （design「テストの置き方」）。
- E2E の既定の workspace の名前が「1」からこのリポジトリの根の名前に変わる（research F16）。
- `surface/methods/workspace.ts` の名前変更のハンドラは async にして await する（design「対象範囲」）。

## テスト方針

- server の規則（`folderLabel`・`findGitRoot`・`autoWorkspaceLabel`）は偽の fs で総当たりし、本物の一時ディレクトリ（`git init`・`git worktree add`・git の無いフォルダ）でも
  確かめる。**`findGitRoot` の返り値（根のパスか null か）を見る**——名前だけを比べると、根が見つからなくてもフォルダ名の規則で同じ名前になる場合がある。
- `SessionService` は偽の `TerminalManager` と偽の deps で、作成の 3 経路・名前変更（null・世代）・復元（`"1"`・`autoLabel`・決め直し）を見る。保存に `autoLabel` が
  載ることは `composeServer.integration.test.ts`（`toSessionFileData` は非公開なので、保存した `session.json` を読む）。
- web は単体（`confirmRenameWorkspace`・`NameDialog` の手掛かり）。
- E2E は新しい spec 1 本。判定はブラウザ（サイドバー・goto の DOM、ブラウザが受けた JSON のイベント）。
- 負の対照：回帰を守るテストは、直した箇所を戻して落ちることを確かめ、生の出力を `test-result.md` に貼る。

## タスク

- [x] T1: protocol の `Workspace` に `autoLabel: boolean`、`WorkspaceRenameParams.label` を `z.string().min(1).nullable()` に。スキーマのテスト。
      `pnpm -C packages/protocol build`。型で落ちる所を暫定の値で合わせる：web のテストの組み立て 14 ファイル（`autoLabel: false`）と server の本体の
      `SessionModel.ts:177`・`:526`（`autoLabel: false`。T3 で本物にする）。**T1 の後に全パッケージの typecheck と単体が緑**
      対象: `packages/protocol/src/model.ts:18-29`・`packages/protocol/src/messages.ts:103`、web の 14 ファイル（design D2）、`packages/server/src/session/SessionModel.ts:177` `:526` /
      根拠: design D2・D5、research F8・F14
      依存: なし
      AC: なし
- [x] T2: `packages/server/src/session/workspaceLabel.ts` を作る（`folderLabel`・`findGitRoot`・`gitConfigValue`・`autoWorkspaceLabel`・`defaultWorkspaceLabelDeps`）。
      規則は design「`findGitRoot` の規則（ここが正典）」。上限 200ms・投げない（`home()` が投げても）・`deps.path` で win32 を確かめる。
      テストは偽の fs の総当たりに加え、**本物の一時ディレクトリで 3 通り**（`git init` したリポジトリのサブディレクトリ・`git worktree add` した worktree の
      サブディレクトリ・git の無いフォルダ）。**`findGitRoot` の返り値を見る**。`.git` の中（`.git/hooks`）で開くと主の根の名前になる
      **負の対照**: `HEAD` を確かめない・`gitdir:` をたどらない・`core.bare` を見ない・ホームの `~` を外す、でそれぞれ落ちる
      対象: 新規、先例 `packages/server/src/session/newCwd.ts`（`liveCwdWithin`・`isUsableDir`）/ 根拠: design D3・D4、research F1〜F3・F15
      依存: なし
      AC: AC1, AC2, AC3
- [x] T3: `SessionModel` の 4 か所で `autoLabel` を扱う（`reserveWorkspace(cwd, label, autoLabel, init)`・一括版 `createWorkspace(…, autoLabel = false)`・
      `renameWorkspace(id, label, autoLabel)`・`restoreWorkspace(data, autoLabel)`）。**呼び出し側の `SessionService.ts:157`・`:182`・`:510`（`this.model.restoreWorkspace`）を
      暫定の値（今までどおりの名前・`autoLabel: false`）で合わせる**（T4〜T6 で本物にする）。`SessionModel.test.ts:209` の 2 引数の呼び出しを直す
      対象: `packages/server/src/session/SessionModel.ts:162-203` `:205` `:525`、`SessionModel.test.ts`、`SessionService.ts:157` `:182` `:510` / 根拠: design D2・「インターフェース」SessionModel
      依存: T1
      AC: なし
- [x] T4: `SessionService` の作成（名前が無い・空白だけなら自動の名前を決めてから予約と起動。名前を渡したら await しない。呼ぶ側でも `.catch`。design D4b・D10）と
      `ensureNotEmpty`・`recreateIfEmpty`（名前を渡さない）。`SessionServiceOptions.workspaceLabelDeps?`。**順序を固定するテスト**（偽の deps の stat を保留に
      している間は `terminals.create` が呼ばれず、応答も `workspace.created` も出ない）
      **負の対照**: 名前を渡さない経路に「1」を戻すと落ちる／空白だけの名前を付けた名前にすると落ちる／await を `spawnForPane` の後へ移すと順序のテストが落ちる
      対象: `packages/server/src/session/SessionService.ts:140-180` `:475` `:482`、`SessionService.test.ts`（`makeService`・`makeNewCwdService`）/ 根拠: design D4b・D10、decisions D1、research F6
      依存: T2, T3
      AC: AC1, AC3, AC4, AC9
- [x] T5: 名前変更（null・空白だけで自動に戻す。世代の番号を `SessionService` の Map に持ち、名前変更のたびに進め、workspace が閉じたら消す——design D9・D10）と
      surface のハンドラ（async・await・要求の時点で無い workspace は not_found）。自動に戻す間に workspace が閉じられたら何もしない（投げない）テスト
      **負の対照**: 付けた名前の変更で世代を進めないと「null の待ちの間に付けた名前が来たら付けた名前が勝つ」が落ちる
      対象: `SessionService.ts:181-185`、世代を消す 3 か所 `SessionService.ts:199`（`closeWorkspace`）`:261`（`closeTab`）`:315`（`closePane` の連鎖）、
      `packages/server/src/surface/methods/workspace.ts:13-18`、`surface/methods/index.test.ts` / 根拠: design D5・D9・「エラー処理 / 異常系」
      依存: T4
      AC: AC6, AC10
- [x] T6: 保存と復元。`SessionFileWorkspace.autoLabel?: boolean | undefined`（`SessionFile.test.ts` で有る形・無い形）、`toSessionFileData` が書く
      （`composeServer.integration.test.ts` で保存した `session.json` を読んで確かめる）、`restore` が `autoLabel ?? label === "1"`（空・空白だけの名前も自動。design D10）で決め、
      自動なら cwd から決め直す（付けた名前はそのまま）
      **負の対照**: 復元で決め直さない／付けた名前も決め直す／保存で `autoLabel` を書かない、でそれぞれ落ちる
      対象: `packages/server/src/persist/SessionFile.ts:26-32` `:78-84` とそのテスト、`packages/server/src/composeServer.ts:278-305`、`composeServer.integration.test.ts`、
      `SessionService.ts:486-510` / 根拠: design D6・D10、research F9・F10
      依存: T4
      AC: AC5, AC6, AC7
- [x] T7: web。`dialogContext` の `renameWorkspace` に `currentAutoLabel`（`renameWorkspaceById` が開いた時点の値を入れる）、`confirmRenameWorkspace`
      （空 → null・自動のまま変えず → 送らない）、`NameDialog` の手掛かり（workspace のときだけ）。既存の `ActionDispatcher.test.ts:757` の context の完全一致と
      `NameDialog.test.ts:120` の context を直す
      **負の対照**: 変えずに確定で送る・空で null を送らない・手掛かりを tab でも出す、でそれぞれ落ちる
      対象: `packages/web/src/store/view.ts:138`、`packages/web/src/actions/ActionDispatcher.ts:576-607`、`packages/web/src/components/NameDialog.vue` とそれぞれのテスト /
      根拠: design D7・D8
      依存: T1
      AC: AC6, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5
- [x] T8: 文書。`docs/herdr-parity.md` に自動の名前の行（herdr との違い 5 つ——design の AC11）、`docs/verification.md` に規則と確かめ方（Windows のホーム・根）
      対象: `docs/herdr-parity.md`・`docs/verification.md` / 根拠: design「ドメイン固有の考慮」、requirements AC11・AC12
      依存: T5, T6, T7
      AC: AC11, AC12
- [x] T9: E2E（新しい spec 1 本）。**`pnpm build` の後に**走らせる。一時ディレクトリで `git init` したリポジトリのサブディレクトリへ `cd` → `prefix+N` →
      2 つのブラウザのサイドバーの spaces 欄に根の名前（ほかのブラウザが受けた `workspace.created` の `label` が最初から根の名前——`support/frames.ts` に
      ブラウザが受けた JSON のイベントを記録する道具を足す。今の `watchReceivedFrames` はバイナリだけ）、goto の一覧・絞り込み、名前を付ける → ほかのブラウザ →
      空で確定 → 自動の名前（両方のブラウザ）、既定の workspace の名前（期待値は `git rev-parse --show-toplevel` で求める）。agents 欄・モバイル・通知・タブの題名は読解（design の AC8）
      対象: `packages/e2e/src/specs/`（新規）、`packages/e2e/src/support/frames.ts:59-75`（`watchReceivedFrames` の隣）/ 根拠: design「テストの置き方」、条項 `e2e-observe-browser`
      依存: T5, T7
      AC: AC1, AC4, AC6, AC8, AC9, AC10, AC-I2, AC-I3
- [ ] T10: 全パッケージの単体テストと、影響を受ける E2E の spec を走らせて結果を記録する（**test 工程で消化する**。decisions D3）。**`pnpm build` を通してから E2E**。
      E2E の一式は deliver の直前に 1 回
      対象: 未特定（走らせるだけ）
      依存: T8, T9
      AC: なし
