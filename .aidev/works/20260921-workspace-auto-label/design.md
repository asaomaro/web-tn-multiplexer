# 仕様: workspace の既定の名前を、開いた場所（リポジトリ）から自動で付ける

## 概要

サーバが workspace の**自動の名前**を決める。`Workspace.label` は今までどおり**表示の名前**のまま（web の表示 9 か所は変えない）で、
それが自動の名前か付けた名前かを新しい項目 `Workspace.autoLabel` で持つ。自動の名前は herdr と同じ規則（`.git` をたどって見つけた根のフォルダ名、
git の外ならフォルダ名・ホームなら `~`・根ならパス）で、**作るとき**と**復元のとき**に決める。名前の変更は `null` を送ると自動の名前に戻る
（pane の名前の先例と同じ形）。web は、workspace の名前を変えるダイアログで空の確定を `null` にし、自動の名前のまま変えていなければ送らない。

## 設計方針

- **D1: 名前はサーバで決め、`label` は常に表示の名前**。requirements の「作った時点で名前が付いている」「どのブラウザでも同じ」「復元で決め直す」を
  満たすのはサーバだけ（research の申し送り）。web が表示のときに補う案は、9 か所の表示すべてに手を入れることになり、通知・タブの題名で
  食い違いやすいので退けた。
- **D2: 自動かどうかは `Workspace.autoLabel: boolean`（省略できない）**。サーバが `SessionModel` の 4 か所（`reserveWorkspace`・テスト向けの一括版
  `createWorkspace`（`SessionModel.ts:199-203`）・`renameWorkspace`・`restoreWorkspace`）で必ず入れる。省略できる形にすると、入れ忘れたときに
  「付けた名前」と読まれ、変えずに確定しただけで固定される（AC-I2 が黙って壊れる）ので、型で入れ忘れを止める。
  `Workspace` を組み立てているテストは web の 14 ファイル（App・ActionDispatcher・ContextMenu・GotoPicker・NameDialog・Sidebar・TabBar・MobileShell・
  PanePicker・NotificationController・describe・StoreAdapter・session・viewRepair）と server。直す。
- **D3: 根の見つけ方は herdr の `git_repo_root`・`git_dir_for_repo_root`・`git_dir_is_bare` を移す**（`.git` をたどり、git のディレクトリに `HEAD` が
  あれば根。`.git` がファイルなら `gitdir:` をたどる。bare の形は `config` の `core.bare = true` も確かめる）。**git のコマンドは使わない**
  （requirements：git が無い環境でも同じ）。既存の `GitInfoPoller` は git のコマンドに依存しているので流用しない。
- **D4: 決める待ちには上限（200ms）**。超えたらフォルダ名の規則（根を探さない）にする。前の work の読み直しの上限と同じ値・同じ形
  （`newCwd.ts` の `liveCwdWithin`）。ネットワークのファイルシステムで stat が返らないときに、作成の応答を待たせない。
- **D4b: 作成では、名前を決めてから予約と起動へ進む**（場所を決めた後・`reserveWorkspace` の前に await。名前を渡したとき——worktree——は
  await しない。`placeFor` と同じく値か Promise を返し、条件つきで await する）。
  - 退けた案（design の点検 1 ラウンド目の代案）：名前を決める処理を起動と並べ、commit の直前に await する——**起動の成功（`spawnForPane` が
    `wireExit` を付けた後）から commit までの間に await が入り、その間にシェルが終わると `closePaneAfterExit` は pane がまだモデルに無いので何もせず
    （`SessionService.ts:436`）、commit の後に死んだ pane が running のまま残る**（D37 で直した zombie と同じ形。design の点検 2 ラウンド目）。
    上限 < 猶予を構成で保証する案も、テストでは猶予を 5ms・上限を差し替えるので成り立たない。
  - 起動を同期で進める不変条件（`SessionService.ts:93-98` の注記）が前提にしているのは**分割**の孤児のテスト（前の work で実測）で、workspace の作成を
    通る既存のテスト（D24 の作り直し・`ensureNotEmpty`・名前の無い作成）はどれも結果を await しているので、予約の前の await では落ちない（coding で確かめる）。
  - 待ちが増えるのは名前を決める時間だけ（ふつうは stat が数回で数 ms、上限 200ms）。「引き継ぐ」の読み直し（上限 200ms）の後に続くので、
    上限の分は両方の和（400ms）＋起動の猶予。**ただし前の work の `resolveNewCwd` の `isUsableDir`（場所そのものの stat と access。上限なし）は
    その間に最大 2 回走るので、場所そのものの stat が止まるファイルシステムでは 400ms で止まらない**（cross の点検）。名前の上限が効くのは、
    場所そのものは読めて祖先の stat だけが遅い場合。
  - `recreateIfEmpty` の「空か」の確かめから commit までの間には、以前から起動の猶予（await）があるので、この await で新しい競走は生まれない。
- **D5: 自動に戻すのは `workspace.rename { label: null }`**。pane の `pane.rename { label: null }` と同じ形（research F8）。別の方式（`workspace.reset_label`）
  は入口を増やすので退けた。空文字は今までどおり拒む（`min(1)`）——空と null の 2 通りの「無い」を作らない。
- **D6: 以前の `session.json` は「`"1"` なら自動」**（requirements の割り切り）。新しい版は `autoLabel` を**任意の項目**として保存する（古い版は
  知らない項目を捨てて読む——research F10）。
- **D7: web は、自動の名前のまま変えていなければ送らない**（requirements。新しい tab の D75 と herdr の tab の規則にそろえる）。空（空白だけ）で確定したら
  `null` を送る。付けた名前の workspace で空にしたときも `null`（自動に戻す）。
- **D8: 手掛かりは workspace の名前変更のときだけ**、入力欄の下に 1 行「空にして確定すると、自動の名前（リポジトリ名かフォルダ名）に戻ります」。
  自動の名前のときは、今の名前が自動であることも添える（「いまは自動の名前です」）。tab・pane・新しい tab の見た目は変えない。
- **D9: 自動に戻す間の競走**。`renameWorkspace(id, null)` は自動の名前を決めるのに await する。その間に別の名前変更が来たら、後から来たほうが勝つ。
  **名前変更は（付けた名前でも null でも）必ず workspace ごとの世代の番号を 1 進め**、null の決め直しは戻ったときに世代が同じときだけ入れる。
  世代は `SessionService` の `private readonly labelGen = new Map<WorkspaceId, number>()` に持つ（`Workspace` には持たせない——protocol と snapshot に
  漏れる）。workspace が閉じたとき（`workspace.closed` を出す 3 か所：`closeWorkspace`・`closeTab` の `closedWorkspaceId`・`closePane` の連鎖）に消す。
- **D10: 空・空白だけの名前は自動**。サーバで trim して判定する：`workspace.create` の `label`・`workspace.rename` の `label`（`min(1)` は空白だけを通す）・
  復元した `label` が空・空白だけなら、付けた名前にせず自動の名前にする（web は空を null にして送るが、ほかの送り手や以前の版が保存した空の名前にも備える）。

## 対象範囲

- protocol：`packages/protocol/src/model.ts`（`Workspace.autoLabel`）、`packages/protocol/src/messages.ts`（`WorkspaceRenameParams.label` を nullable）
- server：`packages/server/src/session/workspaceLabel.ts`（新規。規則）、`SessionModel.ts`（`reserveWorkspace`・一括版 `createWorkspace`・`renameWorkspace`・
  `restoreWorkspace` が `autoLabel` を扱う）、`SessionService.ts`（作成・名前変更・復元で名前を決める）、`persist/SessionFile.ts`（`autoLabel?`）、
  `composeServer.ts`（保存に `autoLabel`）、`surface/methods/workspace.ts`（**ハンドラを async にして `renameWorkspace` を await する**——`Promise` になるので、
  await しないと `RpcError("not_found")` の拒否が `ControlSurface` の not_found への変換（`ControlSurface.ts:39-45`）に届かず未処理の拒否になり、応答も
  `workspace.updated` より先に返る）
- web：`store/view.ts:138`（`DialogContext` の `renameWorkspace` に `currentAutoLabel`）、`actions/ActionDispatcher.ts`（`renameWorkspaceById`・
  `confirmRenameWorkspace`。既存の `ActionDispatcher.test.ts:757` は context を `toEqual` で丸ごと比べているので直す）、`components/NameDialog.vue`（手掛かり）
- docs：`docs/herdr-parity.md`、`docs/verification.md`
- E2E：新しい spec 1 本

## 依拠する既存の事実

- 既定の名前「1」は `SessionService.ts:157`・`:475`・`:482`（research F6）。名前を渡すのは worktree の経路だけ（F7。`ActionDispatcher.ts:262-265`）。
- `createWorkspace` の中で `reserveWorkspace` の前に await を足すと、方針の無い要求の同期の起動が崩れる（`SessionService.ts:93-98` の注記。前の work で実測）。
  名前を渡さない作成を通る既存のテストは D24 の作り直し（`SessionService.test.ts:193`・`:272`・`:376`・`:709`）・`ensureNotEmpty`（`:513`）・
  名前の無い作成（`:619`・`:651`・`:664`・`:694`・`:702`）——どれも結果を await しているので、予約の前の await では落ちない見込み（D4b。coding で確かめる）。
- 名前の変更は `workspace.rename` → `SessionService.renameWorkspace`（`:181-185`）→ `workspace.updated`（F8）。web は `workspaceUpserted` で受け、
  イベントはすべての接続へ配られる（F12。`StoreAdapter.ts:90-91`）。
- 保存は `composeServer.ts:278-305`、復元は `SessionService.restore`（`:486`）→ `SessionModel.restoreWorkspace`（`:525`。同期）（F9）。
  zod 4 の `z.object` は知らない項目を捨てる（F10。`SessionFile.ts` に `.strict()` は無い）。
- `NameDialog` は今の名前を入れて全選択で開き、workspace の確定は `ActionDispatcher.confirmRenameWorkspace`（`:601-607`）で空なら何もしない（F13）。
  `dialogContext` の `renameWorkspace` は `currentLabel` を持つ（`ActionDispatcher.ts:579`）。
- herdr の規則（F1〜F3。`discovery.rs:30-43`・`:66-72`・`:198-220`・`:311-329`）。
- `path.basename` は根で空文字（F15）。`os.homedir()`（F15）。
- 前の work の上限つきの待ち（`packages/server/src/session/newCwd.ts` の `liveCwdWithin`）と、fs を依存にして単体にする形（`makeNewCwdDeps`・`isUsableDir`）。
- 既存のテストは名前「1」を判定に使っていない（F16）。E2E の既定の workspace は `process.cwd()`（このリポジトリの中）で開く（F16）。

## インターフェース / データ構造

### protocol

```ts
// model.ts
export interface Workspace {
  id; label: string; cwd; tabIds; activeTabId; groupId; git;
  /** true なら label はサーバが決めた自動の名前（付けた名前ではない）。20260921-workspace-auto-label。 */
  autoLabel: boolean;
}
// messages.ts
export const WorkspaceRenameParams = z.object({ workspaceId, label: z.string().min(1).nullable() }); // null で自動の名前に戻す
```

### server

```ts
// session/workspaceLabel.ts
export const AUTO_LABEL_TIMEOUT_MS = 200;
export interface WorkspaceLabelDeps {
  /** path が指すもの。無ければ null。 */
  stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean } | null>;
  readFile: (path: string) => Promise<string | null>;
  home: () => string;
  /** パスの扱い（既定は `node:path`＝サーバの OS。テストで `path.win32` を渡して Windows の形を確かめる）。 */
  path?: typeof import("node:path");
  timeoutMs?: number;
}
/** herdr の fallback_label_from_cwd：ホームなら "~"、末尾の名前、無ければパスそのもの。win32 ではホームとの比較で大小を問わない。 */
export function folderLabel(cwd: string, home: string, path?: typeof import("node:path")): string;
/** herdr の git_repo_root：cwd から親へたどって git の根を探す。無ければ null。 */
export async function findGitRoot(cwd: string, deps: WorkspaceLabelDeps): Promise<string | null>;
/**
 * 自動の名前。根があれば根の末尾の名前（空ならフォルダ名の規則）、無ければフォルダ名の規則。上限を超えたらフォルダ名の規則。**投げない**——
 * 代わりの処理（`folderLabel`・`deps.home()`）が投げても、最後はパスの末尾の名前かパスそのものを返す。
 */
export async function autoWorkspaceLabel(cwd: string, deps: WorkspaceLabelDeps): Promise<string>;
export const defaultWorkspaceLabelDeps: WorkspaceLabelDeps; // fs/promises・os.homedir（home は中で捕まえ、投げたら "" を返す＝ホームと一致しない）
```

`findGitRoot` の規則（herdr `git_repo_root`・`git_dir_for_repo_root` を移す。ここが正典）:

1. 始めの場所：`cwd` がディレクトリならそれ、そうでなければその親。
2. 各階層 `d` で git のディレクトリ `g` を求める（herdr `git_dir_for_repo_root`——`discovery.rs:198-220`）：
   - `d/.git` がディレクトリなら `g = d/.git`。
   - `d/.git` を読めて（ファイル）、中身を trim して `gitdir:` で始まるなら、その後ろを trim した `<p>`（相対なら `d` から解決）を `g` にする。
   - どちらでもなければ（`.git` が無い・`gitdir:` で始まらない）、`d` 自身が bare か：`HEAD` がファイル・`objects` と `refs` がディレクトリで、
     **`d/config` の `[core]` 節の `bare` が `true`（大小を問わない）**（herdr `git_dir_is_bare`——`:243-246`。`bare = false` の形は根にしない——`:649-659`）。
     bare なら `g = d`。
   - どれでもなければ、この階層には無い。
3. `g/HEAD` がファイルなら `d` が根。そうでなければ親へ。親が無ければ（根に着いたら）null。
4. パスの扱いは `deps.path`（既定は `node:path`）。`resolve` で正規化してからたどる。`config` の読み方は herdr の `read_git_config_value` にそろえる
   （空行・`#`・`;` の行を飛ばし、`[section]` で節を切り替え、`key = value` の値の後ろの ` #`・` ;` 以降を捨てる。節名・キーは大小を問わない）。

`SessionServiceOptions.workspaceLabelDeps?: WorkspaceLabelDeps`（省略時は `defaultWorkspaceLabelDeps`。テストは偽物を渡せる）。

`SessionModel`:

```ts
reserveWorkspace(cwd, label, autoLabel: boolean, init)   // Workspace.autoLabel を入れる
createWorkspace(cwd, label, init, autoLabel = false)     // テスト向けの一括版（SessionModel.test.ts が 26 か所で使う）。既定は付けた名前
renameWorkspace(id, label: string, autoLabel: boolean): Workspace   // 省略できない（D2）。SessionModel.test.ts:209 の 2 引数の呼び出しは直す
restoreWorkspace(data: SessionFileWorkspace, autoLabel: boolean)  // 呼ぶ側が決めた label・autoLabel を使う
```

`SessionService`:

```ts
createWorkspace(cwd, label, newCwd?)   // label（trim して空でない）があれば付けた名前。無ければ場所を決めた後に autoWorkspaceLabel を await してから予約・起動（D4b）
renameWorkspace(id, label: string | null): Promise<void>  // 要求の時点で workspace が無ければ RpcError("not_found") で拒否（待つ前に確かめる）。世代を進める（D9）。
                                                          // null なら ws.cwd から自動の名前を決め直し、世代が同じなら入れて autoLabel: true
restore(data)   // 各 workspace：autoLabel = data.autoLabel ?? (data.label === "1")。自動なら cwd から決め直す。付けた名前はそのまま
```

`ensureNotEmpty`・`recreateIfEmpty` は `createWorkspace(this.defaultCwd, undefined)`（名前を渡さない＝自動）。

`session.json`：`SessionFileWorkspace.autoLabel?: boolean | undefined`（`exactOptionalPropertyTypes` のため既存の `status?: PaneStatus | undefined` と同じ書き方。
保存では必ず書く。読むときは無くてもよい）。`schema` は 1 のまま。

### web

- `dialogContext` の `renameWorkspace` に `currentAutoLabel: boolean` を足す（開いた時点の `ws.autoLabel`。`renameWorkspaceById` が入れる）。
- `ActionDispatcher.confirmRenameWorkspace(label)`：`trimmed` が空 → `workspace.rename { label: null }`。空でなく、`ctx.currentAutoLabel` で
  `trimmed === ctx.currentLabel` → 送らない（D7。開いた時点の状態で決める——開いている間にほかのブラウザで名前が変わっても、変えずに確定した
  ことに変わりはないので送らない）。それ以外は今までどおり。
- `NameDialog.vue`：kind が `renameWorkspace` のときだけ、入力欄の下に手掛かり（D8）。`aria-describedby` で入力欄に結ぶ。

## 振る舞いの詳細

- 作成：`createWorkspace` は場所を決めた後（前の work の `placeFor` の後）、名前が無ければ `autoWorkspaceLabel(resolvedCwd)` を await してから
  `reserveWorkspace`・`spawnForPane`・commit へ進む（D4b。起動の成功から commit までの間に await を挟まない）。作成の応答・`workspace.created`・
  保存のすべてに最初から自動の名前が載る（「1」を経ない）。
- 名前変更（付けた名前）：世代を 1 進め、`label` を入れ、`autoLabel: false`。`workspace.updated`。
- 名前変更（null）：世代を 1 進め、`autoWorkspaceLabel(ws.cwd)` を await。戻ったとき、workspace がまだあり世代が同じなら、`label` を入れて
  `autoLabel: true`・`workspace.updated`。違えば何もしない。surface のハンドラはこれを await してから応答する。
- 復元：`restore` の中で、自動の workspace の名前を**1 つずつ**先に決めてから `restoreWorkspace` に渡す。付けた名前は決め直さない（review ラウンド 1。
  一度に始めると上限のタイマーも一斉に始まって workspace が多いと全部が上限に達し——T6 の点検——、応答しないマウントの上に並んでいると止まった stat が
  libuv のスレッドを塞ぎ合う）。**合計の期限（1 秒。`RESTORE_LABEL_BUDGET_MS`。単調な時計で測る）を過ぎたら、残りは根を探さずフォルダ名**（review ラウンド 2。
  1 つずつだと遅いだけの fs でも数に比例して遅れる）。`/ws` の受け付けが遅れるのは最悪で期限と 1 回分の上限の和（1.2 秒）。
- **上限を超えた後**（review ラウンド 1・2）：待つのをやめても出した stat は取り消されず、応答しないファイルシステムでは libuv のスレッド（既定 4 本）を塞ぐ。
  そこで ① 上限を超えたらそのたどりはそれ以上 fs に問い合わせない（`findGitRoot` の `signal`）、② `SessionService` は、上限を超えた問い合わせが**まだ返って
  いない間だけ**（`labelLookupsStuck`。`withTimeout` が渡す `settled` で数える）新しく根を探さずフォルダ名にする（作成・名前変更・復元のすべて）。
  遅いだけなら返った時点で元に戻り、止まったままなら問い合わせを重ねない——塞がるスレッドは、止まったと分かった時点で出ていた問い合わせの数まで
  （作成は 1 つずつ進むので、ふつうは 1 本）。時計は使わない（ラウンド 1 の 60 秒の冷却は、遅いだけの fs でも全部の場所をフォルダ名にしたので退けた）。
  止まっている間はほかの場所もフォルダ名になること・復元の合計の期限は、requirements の非機能要件の例外（その場所のフォルダ名）より広い、受け入れた
  割り切り（decisions D4）。
- 同じリポジトリの workspace は同じ名前になる（requirements の対象外）。

## ドメイン固有の考慮

- OS：パスは `node:path` の既定（サーバの OS）で扱う。Windows の根（`C:\`）は `basename` が空なので、パスそのものになる（herdr と同じ）。
  ホームは `os.homedir()` と `resolve` した後の一致。**win32 では大小を問わず比べる**（ドライブ文字の大小が揃わないことがある。herdr は `HOME` との
  完全一致で、Windows では `~` にならない場合がある——本製品の違い）。Windows の CI は無いので、Windows の形は `path.win32` を渡した単体と、
  `docs/verification.md` の Windows の手順で確かめる。
- worktree：linked worktree の `.git` はファイル（`gitdir: <主の .git>/worktrees/<名前>`）で、その中に `HEAD` があるので、worktree の根の名前になる。
  worktree を開く・作る操作は今までどおり名前を渡すので付けた名前（requirements の対象外）。
- E2E の既定の workspace は、このリポジトリの根の名前になる（research F16）。

## エラー処理 / 異常系

| 場面 | 扱い |
| --- | --- |
| stat・readFile が失敗（権限・無い） | その階層には無いものとして親へ（投げない） |
| `.git` のファイルの中身が `gitdir:` で始まらない | その階層の bare の判定へ進む（herdr と同じ） |
| 上限（200ms）を超えた | フォルダ名の規則（根を探さない）。作成は続ける |
| `autoWorkspaceLabel` の中で予期せず投げた（`home()` を含む） | 中で捕まえ、パスの末尾の名前かパスそのもの（作成を失敗させない。呼ぶ側も念のため `.catch`） |
| 自動に戻す間に workspace が閉じられた | 何もしない（`renameWorkspace` は not_found にしない。要求の時点ではあった） |
| 自動に戻す間に別の名前変更が来た | 後から来たほうが勝つ（D9） |
| 復元のときに cwd が無い | 規則 1 のとおり親から探す（親がリポジトリの中なら根の名前、そうでなければ無い場所の末尾の名前）。復元は続ける |
| 復元で自動の workspace が多い・fs が遅い | 1 つずつ決める（それぞれに上限）。合計 1 秒を過ぎたら残りはフォルダ名。警告を 1 度だけログへ（review ラウンド 3） |
| 上限を超えた（応答しないマウント・遅い fs 等） | そのたどりは以後 fs に問い合わせない。その問い合わせが返るまで、作成・名前変更・復元の自動の名前は根を探さずフォルダ名。警告をログへ |

## テストの置き方

- **server 単体**：`workspaceLabel.test.ts`——`folderLabel`（ホーム・末尾の `/`・根・Windows の形とドライブ文字の大小は `path.win32` を渡して）、`findGitRoot`
  （偽の fs：`.git` ディレクトリ・`HEAD` の無い `.git`・`.git` ファイルの相対と絶対の `gitdir:`・`gitdir:` で始まらない `.git` ファイル・bare（`core.bare = true`）と
  `bare = false` の形・`.git` の中（`.git/hooks`）で開いた場合・サブディレクトリから・消えたサブディレクトリから・根に着く）、`autoWorkspaceLabel`（上限・投げる）。
  本物の一時ディレクトリで `git init` した場所・worktree（`git worktree add`）・git の無いフォルダで確かめる（git のコマンドは前提を作るためだけ）。
- `SessionService`：作成の 3 経路で自動の名前・付けた名前（空の `label` は自動）、起動の順序が変わらないこと（既存の孤児・猶予のテストがそのまま通る）、
  名前変更の null と世代（null の待ちの間に付けた名前が来たら付けた名前が勝つ）、復元（`"1"`・`autoLabel` の有無・付けた名前・決め直し）、
  保存に `autoLabel` が載る（`composeServer` の `toSessionFileData`）。名前を確かめるテストは偽の deps を渡す（`makeService`・`makeNewCwdService` の両方）。
  名前を確かめない既存のテストは既定の deps（本物の fs）のままでよい（`/home/u` 等の無い場所はフォルダ名の規則になるだけで、結果を左右しない）。
- surface：`workspace.rename { label: null }` を await して応答する・無い workspace は not_found。
- web 単体：`confirmRenameWorkspace`（空 → null・自動のまま変えず → 送らない・付けた名前のまま → 今までどおり）、`NameDialog`（手掛かりは workspace のときだけ）。
- **E2E**：新しい spec。判定はブラウザ（DOM のサイドバー・goto、ブラウザが受けた `workspace.created` のフレーム）。
  一時ディレクトリで `git init` したリポジトリのサブディレクトリへ `cd` → `prefix+N` → 2 つのブラウザのサイドバーに根の名前（ほかのブラウザが受けた
  `workspace.created` の `label` が最初から根の名前）。名前を付ける → ほかのブラウザにも出る → 空で確定 → 自動の名前に戻る（両方のブラウザ）。
  既定の workspace の名前（このリポジトリの根の名前。期待値はテストの中で `git rev-parse --show-toplevel` で求める）。
- 負の対照（条項 `regression-negative-control`）：`HEAD` を確かめない・`gitdir:` をたどらない・変えずに確定で送る・null を送らない・復元で決め直さない、等。

## 受け入れ基準との対応

- AC1: 作成の名前が無ければ `autoWorkspaceLabel(決めた場所)`。入力は作成の場所（前の work の `placeFor` の結果）。`findGitRoot` が親へたどるので
  サブディレクトリでも根。git のコマンドを使わない（D3）。サーバ単体・E2E。
- AC2: linked worktree の `.git` ファイルの `gitdir:` をたどって `HEAD` を見つける（ドメイン固有の考慮）。サーバ単体（本物の `git worktree add`）。
- AC3: `folderLabel`（ホーム `~`・根のパス）。サーバ単体。
- AC4: `ensureNotEmpty`・`recreateIfEmpty` が名前を渡さない。サーバ単体・E2E（既定の workspace の名前）。
- AC5: 付けた名前は `autoLabel: false` で保存され、復元で決め直さない。サーバ単体（保存 → 場所の git の状態を変えた偽の fs → 復元）。
- AC6: null → `autoLabel: true`・自動の名前。復元で決め直す。サーバ単体・E2E（空で確定 → 自動の名前）。
- AC7: `autoLabel` の無い古いファイル：`"1"` なら自動、それ以外は付けた名前。サーバ単体。
- AC8: 表示の 9 か所は `label` を読むだけ（変えない）。E2E でサイドバーの spaces 欄と goto の一覧・絞り込みを見る。agents 欄（エージェントを検出させる
  準備が要る）・モバイル・通知・タブの題名は、同じ `label` をそのまま読むことを読解（`Sidebar.vue:197`・`PanePicker.vue:93`・`:110`・`MobileShell.vue:46`・
  `describe.ts:40`・`main.ts:243`）で確かめる（test-result に書く）。
- AC9: 作成の応答と `workspace.created` に最初から自動の名前（D1・振る舞いの詳細）。E2E（ほかのブラウザが受けた `workspace.created` の `label`）。
- AC10: 名前の変更は `workspace.updated` ですべての接続へ（research F12）。E2E（ほかのブラウザのサイドバー）。
- AC11: `docs/herdr-parity.md` に行を足す（herdr との違い：`cd` に追従しない・自動の名前に戻せる・変えずに確定しても付けた名前にしない・worktree は
  ブランチ名・Windows のホームを大小を問わず `~` と見る）。
- AC12: `docs/verification.md` に規則と確かめ方。
- AC-I1: 既存の入口のまま（変えない）。既存の単体・E2E。
- AC-I2: web の `confirmRenameWorkspace`（D7）と `NameDialog` の手掛かり（D8）。web 単体・E2E（空で確定）。取り消しは既存。
- AC-I3: 名前を消して Enter（E2E）。
- AC-I4: 既存の作法のまま（変えない）。
- AC-I5: 既存の作法のまま（ダイアログ中は window の keydown が何もしない）。
