# 仕様: 新しい workspace・tab・pane を、いま見ている場所で開く（herdr の `terminal.new_cwd`）

## 概要

**方針はブラウザごとの設定**（設定の「端末」の節）に置き、**場所を決めるのはサーバ**にする。

1. web は、新しい workspace・tab・分割を要求するときに、**方針と「元の pane」**を要求に載せる（`newCwd`）。
2. サーバは方針から場所を決める。「引き継ぐ」なら**その時点で元の pane の「いまの場所」を読み直す**——エージェントの監視が
   `Pane.cwd` を更新するのと同じ規則（前面プロセスグループの先頭の cwd、無ければシェルが出した OSC 7）を、作る時点で行う。
   Linux は `/proc` で遅れ無し。読めなければ記録された `Pane.cwd`。
3. サーバは決めた場所を**検証**し（ディレクトリで、入れるか）、使えなければ**代わりの場所**へ回す。**「引き継ぐ」以外の方針で
   代わりへ回したときだけ**、サーバが応答に `cwdFallback: true` を載せ、web がそれを知らせる（知らせるかどうかを決めるのはサーバ）。
4. **場所を明示する要求（`cwd`。worktree を開く）は今までどおり**——方針より優先し、代わりの場所へも回さない（使えなければ失敗する）。

## 設計方針

### D1: 方針はブラウザごとの設定に置く（herdr はサーバ側の設定）

herdr の `terminal.new_cwd` はサーバ側の設定（`[terminal]`。research F19）で、1 人で使う前提。本製品は複数のブラウザから繋がり、
直前の work で「このブラウザの設定」（通知・表示・端末）をそろえたところ。**携帯ではホーム、母艦では引き継ぐ**のように端末ごとに
変えられるほうが本製品の使い方に合い、サーバを起動し直さずに変えられる（decisions D2）。

- 退けた案: サーバの起動時の指定（`wtm serve --new-cwd …`）——herdr と同じだが、変えるたびに起動し直しになり、全ブラウザに効く。
- どちらにしても protocol に足すものは要る（元の pane をサーバは知らない。research F16）。

### D2: 「引き継ぐ」は、作る時点で元の pane の**前面プロセス**の cwd を読み直す

web が持っている `pane.cwd` は最大およそ 1 秒遅れる（research F4）。`cd` の直後に新しい tab を開くのはよくある操作なので、
**サーバが作成の時点で読み直す**。

- 読むのは**前面プロセスグループの先頭の cwd、無ければシェルが出した OSC 7**（既存の `ProcessInspector.foreground(shellPid)` の `cwd`
  ——`packages/server/src/platform/LinuxProcessInspector.ts:11-14`。プロンプトで待っているときはシェル自身、プログラムが動いているときは
  そのプログラム——と、`host.mirror.cwdHint()`）。**エージェントの監視が `Pane.cwd` を決める規則と同じ**
  （`packages/server/src/agent/AgentMonitor.ts:173` の `leader?.cwd ?? host.mirror.cwdHint()`）で、違いは「その時点で読む」ことだけ。
  OSC 7 の段があるので、macOS・Windows でもシェルが OSC 7 を出していれば**遅れ無し**で読める。
- **いちばん外側のシェル（`TerminalHost.pid`）の cwd は読まない**——入れ子のシェル（bash の中の bash・`nix develop` 等）や exec しない
  `--shell` のラッパーでは、外側の cwd は `cd` の前のまま。それが正しい記録を上書きすると、分割が今より悪くなる（design の点検の指摘）。
  同じ pty の中の入れ子なら、前面の先頭は内側のシェルになる。**ただし万能ではない**——`poetry shell` のように別の pty を開くもの（外側の
  前面は poetry のプロセス）や、`su` のように別のユーザーのプロセス（`/proc/<pid>/cwd` が EACCES で読めず null → OSC 7 → 記録）では、
  内側の `cd` は見えない。どちらも以前より悪くはならない（記録された場所に落ちる）。
- 新しい口は足さない（既存の `foreground()` を使う）。`ProcessInspector` の偽物（テスト）を変えずに済む。
- macOS は `LinuxProcessInspector` を通り（`composeServer.ts:64-68`）、`/proc` が無いので `readTpgid` が `null` を返し `foreground()` も `null`
  （`LinuxProcessInspector.ts:12-13`）。Windows は `cwd: null`（`WindowsProcessInspector.ts:40`）。どちらも OSC 7 → 記録された `Pane.cwd` に落ちる。
- 読むのにかける時間の上限は **200ms**。上限は `resolveNewCwd` の中で掛ける（単体で確かめられるように。D6）。Windows では `foreground()` の
  cwd は常に null だが、前面プロセスの特定そのものに時間がかかりうるので、作るたびに最大 200ms 待ちうる。
- **読み直しが失敗（reject）しても作成は失敗させない**——`null` として扱う。Windows の `@vscode/windows-process-tree` は
  optionalDependencies で、読み込めない環境では `foreground()` が reject する（`WindowsProcessInspector.ts:18-22`）。これで作成が失敗すると
  既定の「引き継ぐ」がすべて失敗し、以前より悪くなる。上限を過ぎて捨てた Promise も `.catch(() => undefined)` を付けて、後からの
  reject を未処理の拒否にしない（`AgentMonitor.ts:198-200` の先例）。

### D3: 代わりの場所は操作ごとの「以前と同じ場所」、それも使えなければサーバを起動した場所

- 1 段目の代わり（操作ごと）: workspace はサーバを起動した場所、tab はその workspace の場所（`ws.cwd`）、分割は元の pane の記録された場所（`source.cwd`）。
- **1 段目の代わりも検証し、使えなければ 2 段目としてサーバを起動した場所**。分割の「引き継ぐ」で `cd` した先が消されたとき、
  1 段目の `source.cwd` は同じ消えた場所（エージェントの監視が追従させている）なので、2 段目が要る（design の点検の指摘）。
- requirements の AC9 は、代わりの場所を AC5 と同じ「以前と同じ場所」にそろえた（decisions D1）。

### D4: 「いまの場所が分からない」ときは、元の pane の記録された場所で開く（requirements の AC5 を直す）

`Pane.cwd` は必ず値を持つ（起動した場所が入っていて、エージェントの監視が追従させる）。だから、元の pane がある限り「記録も無い」
ことは無い。**「いまの場所が読めない」ときは記録された場所で開く**——これは herdr の「元の pane を引き継ぐ」に最も近く、
macOS・Windows でもシェルが OSC 7 を出していれば追従している値。**「以前と同じ場所」で開くのは、元の pane が無いときだけ**。
requirements の AC5 をこの形に直す（decisions D4）。

### D5: `newCwd` は「方針」で、`cwd` は「明示した場所」。`cwd` が勝ち、代わりへは回さない

worktree を開く経路（F18）は `workspace.create { cwd }` で、場所そのものを選ぶ操作。**使えない場所を代わりの場所へ黙って回すと、
worktree ではない場所に開いてしまう**。だから:

- `cwd` があれば `newCwd` は見ない（herdr の「明示した `--cwd` が勝つ」と同じ）。検証も代わりもしない（今までどおり、使えなければ `spawn_failed`）。
- `newCwd` から決めた場所だけを検証し、使えなければ代わりの場所へ回す。
- どちらも無い要求（古いクライアント・テストのクライアント）は**今までどおり**（workspace は起動した場所、tab は workspace の場所、分割は元の pane）。

### D6: 場所を決める関数を 1 つにし、依存は `SessionService` の任意のオプションで渡す

- `session/newCwd.ts` の `resolveNewCwd` が方針 → 場所 → 検証 → 代わり、を 1 か所で行う（純粋に近い。依存は引数）。
- 依存（いまの場所を読む・ホーム・ディレクトリの検証）は `SessionServiceOptions.newCwdDeps`（**任意**）で渡し、
  `composeServer.ts` が作る（`ProcessInspector` と `TerminalManager` を持っているのはここ。`composeServer.ts:121-139`）。
  **無ければ `newCwd` を見ない**（今までどおり）——`SessionService` を作っているテストの 6 か所を変えずに済む。
- **deps を組み立てる関数 `makeNewCwdDeps` も `newCwd.ts` に置く**。本番のつなぎ方（元の pane の `TerminalHost` を引き、**その pid で**
  `foreground()` を呼び、無ければ `mirror.cwdHint()`）を、既存の偽の `ProcessInspector`・`TerminalManager` で単体にできる
  （つなぎ方を誤っても——別の pid を読む・常に null——全テストが通る、を防ぐ。design の点検の指摘）。
  `composeServer.ts` は `defaultCwd` を 1 つの定数にして、`SessionService` と `makeNewCwdDeps` の両方へ同じ値を渡す（「起動した場所」を 2 か所で別々に持たない）。

### D7: 「元の pane」は web が決める

サーバはクライアントごとの焦点の pane を知らず、サーバの焦点は pane のクリックでは変わらない（F16）。**「いま見ている pane」を
知っているのはブラウザだけ**なので、web が元の pane を載せる。

- 新しい workspace: そのブラウザの焦点の pane（`view.focusedPaneId`）。
- 新しい tab: 焦点の pane が**作る先の workspace にあれば**それ、無ければ元の pane を載せない（→ 1 段目の代わり＝その workspace の場所）。
  tab の右クリックメニューの出所は、見ている workspace の tab だけを並べる TabBar だけ（`TabBar.vue:16-20`・`:32`）なので、
  ふつうは焦点の pane が作る先の workspace にある。無い場合は応答を待つ間に表示が変わった等の競走への守り（research F17 の「見ている
  workspace とは限らない」は誤りだった）。
- 分割: 分割する pane そのもの（`pane.split` の `paneId`。追加は要らない）。

### D8: 設定の「端末」の節に「新しく開く場所」を足す

直前の work の設定ダイアログ（見出しで 3 節。`SettingsDialog.vue`）の「端末」の節に、scrollback の下に並べる。

- ラジオの組（`<fieldset>`）: **引き継ぐ（既定）** ／ ホーム ／ サーバを起動した場所 ／ 指定した場所。選んだ時点で保存。
- 「指定した場所」の下に文字の入力欄。**入れ終えた時点（`change`＝Enter か入力欄を離れたとき）で保存**し、打ちかけの途中の値
  （`input`）では保存しない（AC-I2）。「指定した場所」以外が選ばれている間は `disabled`。

### D9: 知らせるのは「引き継ぐ」以外の方針で代わりへ回したとき（ホーム・起動した場所も含む）

requirements の AC9 は「指定した場所」だけを挙げるが、**ホームや起動した場所が使えない**（まれだが、消えた・権限が無い）ときも、
利用者が選んだ方針が効かなかったことに変わりはなく、知らせないと理由が分からない。**「引き継ぐ」だけは知らせない**（利用者の操作の
誤りではない。AC5）。requirements の AC9 は「指定した場所」の場合を必ず知らせることを求めており、ホーム・起動した場所で知らせることは
それに反しない（decisions D5）。なお workspace で「起動した場所」が使えないときは代わりの場所も同じなので、起動そのものが失敗する（今までどおり `spawn_failed`）。

## 対象範囲

- protocol: `packages/protocol/src/messages.ts`（`NewCwd`、`workspace.create`・`tab.create`・`pane.split` の params と結果）。
- server: `packages/server/src/session/newCwd.ts`（新規）、`packages/server/src/session/SessionService.ts`（3 つの作成と `newCwdDeps`）、
  `packages/server/src/composeServer.ts`（`newCwdDeps` を作る）、`packages/server/src/surface/methods/{workspace,tab,pane}.ts`（params を渡す）。
- web: `packages/web/src/store/settings.ts`（方針の設定）、`packages/web/src/actions/ActionDispatcher.ts`（3 つの作成）、
  `packages/web/src/components/SettingsDialog.vue`（端末の節）。
- 文書: `docs/herdr-parity.md:61`（H36 を割る）、`docs/verification.md`。
- テスト: 各単体、E2E（新しい spec）。

## 依拠する既存の事実

- `workspace.create` は `cwd` を受け付け、`tab.create`・`pane.split` は受け付けない（`packages/protocol/src/messages.ts:61-64`・`:83-86`・`:104-108`）。
  zod の `z.object` は知らないキーを捨てるだけで弾かない（protocol に `strictObject` の先例は無い）。
- サーバの場所の決め方（`packages/server/src/session/SessionService.ts:121-122`・`:175-180`・`:235-245`）、`defaultCwd` は `process.cwd()`
  （`packages/server/src/composeServer.ts:136`）。`SessionServiceOptions` に `ProcessInspector`・ホーム・fs は無い（`SessionService.ts:38-51`）。
  `SessionService` を作っているのは本番の `composeServer.ts:128` とテストの 6 か所（計 7 か所）。
- 無い場所で起動すると `spawn_failed`（`SessionService.ts:133-136`・`:181-183`・`:239`、node-pty の `chdir` の失敗）。`chdir` に要るのは
  そのディレクトリの検索（実行）権限。
- `Pane.cwd` は `string`（必ず値を持つ。`packages/protocol/src/model.ts`・`SessionModel.ts:144`）で、`AgentMonitor` が 0.5〜1 秒おきに
  前面プロセスグループの先頭の cwd（無ければ OSC 7）へ更新する（`packages/server/src/agent/AgentMonitor.ts:171-173`・`:190`）。
- `ProcessInspector.foreground(shellPid)` は前面プロセスグループの先頭の `{ pid, exe, argv, cwd }` を返す（Linux: `LinuxProcessInspector.ts:11-14`・
  `:59-70`。macOS は `/proc` が無く `null`。Windows は `cwd: null`——`WindowsProcessInspector.ts:40`）。シェルの pid は pty の子の pid
  （`packages/server/src/pty/NodePtyBackend.ts:16`・`:32`）。
- `Workspace.cwd` は作ったときに固定され、git の情報と worktree が使う（`SessionModel.ts:162`・`GitInfoPoller.ts:47`・`WorktreeService.ts:72-75`）。
- web は焦点の pane をブラウザごとに持ち（`packages/web/src/store/view.ts` の `focusedPaneId`）、サーバは持たない（`messages.ts:31-35`）。
  TabBar は見ている workspace の tab だけを並べ（`packages/web/src/components/TabBar.vue:16-20`）、tab の右クリックメニューの出所はそこだけ（`:32`）。
- `confirmNewTab(label)` は作る先の workspace を `dialogContext` から取る（`packages/web/src/actions/ActionDispatcher.ts:168-175`）。
- worktree を開く経路は `workspace.create { cwd, label }`（`ActionDispatcher.ts:254-266`）。
- E2E のサーバはテストのプロセスの中で `composeServer` から起動する（`packages/e2e/src/support/appServer.ts:48-57`）ので、`defaultCwd` は
  テストのプロセスの `process.cwd()`、ホームは開発機の `$HOME`。ブラウザが受けたフレームは `watchReceivedFrames`（`packages/e2e/src/support/frames.ts:59`）で読める。
- 設定の読み書き（`packages/web/src/store/settings.ts`・`readPrefs`/`writePrefs`）と設定ダイアログ（`packages/web/src/components/SettingsDialog.vue`）は
  直前の work（`20260921-herdr-settings-gaps`）のもの。
- herdr の意味（`configuration.mdx:89-94`・`model.rs:220-241`）。

## インターフェース / データ構造

### protocol

```ts
// messages.ts
export const NewCwd = z.discriminatedUnion("policy", [
  z.object({ policy: z.literal("follow"), sourcePaneId: paneId.optional() }), // 分割では付けない（paneId が元）
  z.object({ policy: z.literal("home") }),
  z.object({ policy: z.literal("current") }),
  z.object({ policy: z.literal("path"), path: z.string() }),
]);
export type NewCwd = z.infer<typeof NewCwd>;

WorkspaceCreateParams = { cwd?, label?, newCwd?: NewCwd }   // cwd が勝つ
TabCreateParams       = { workspaceId?, label?, newCwd?: NewCwd }
PaneSplitParams       = { paneId, direction, ratio?, newCwd?: NewCwd }

// 結果に 1 つ足す（任意）。「引き継ぐ」以外の方針で決めた場所が使えず、代わりの場所で開いたときだけ true（サーバが決める）。
WorkspaceCreateResult / TabCreateResult / PaneSplitResult に  cwdFallback?: true
```

### server

```ts
// session/newCwd.ts
export interface NewCwdDeps {
  /** 元の pane の前面プロセスの cwd（`ProcessInspector.foreground(host.pid)?.cwd`）。読めなければ null。 */
  liveCwd: (paneId: PaneId) => Promise<string | null>;
  /** 元の pane の記録された cwd（`Pane.cwd`）。pane が無ければ undefined。 */
  recordedCwd: (paneId: PaneId) => string | undefined;
  home: () => string;                                   // os.homedir()
  currentDir: string;                                   // defaultCwd（サーバを起動した場所）
  isUsableDir: (path: string) => Promise<boolean>;      // stat → isDirectory、access(X_OK)
  liveCwdTimeoutMs?: number;                            // 既定 200
}
/** "~" と "~/…"・"~\…" だけを展開する。"~user" は展開しない。 */
export function expandHome(path: string, home: string): string;
/**
 * 方針から場所を決める。fallback は操作ごとの 1 段目の代わり（呼ぶ側が渡す）。
 * 戻り値の fellBack は「引き継ぐ以外の方針で代わりへ回した」ときだけ true。
 */
export async function resolveNewCwd(
  req: NewCwd, sourcePaneId: PaneId | undefined, fallback: string, deps: NewCwdDeps,
): Promise<{ cwd: string; fellBack: boolean }>;
```

規則（ここが正典）:

1. 方針ごとの候補:
   - `follow`: 元の pane が無ければ候補なし。あれば `liveCwd(src)`（上限 `liveCwdTimeoutMs`。**超えた・reject した**ら `null`）→ `null` なら `recordedCwd(src)`。
   - `home`: `home()`。 `current`: `currentDir`。
   - `path`: `expandHome(path, home())`。**絶対パスでなければ使えない**（相対パスはサーバのプロセスの cwd から解決され、`Workspace.cwd` に
     相対のまま入ってしまう）。
2. 候補が `isUsableDir` なら それ（`fellBack: false`）。
3. 候補が無い・使えないなら、`fallback` が使えれば `fallback`、使えなければ `currentDir`（D3 の 2 段目）。
   **`fellBack` は `follow` 以外のときだけ true**。

`SessionService`:

```ts
SessionServiceOptions.newCwdDeps?: NewCwdDeps     // 任意。無ければ newCwd を見ない（今までどおり）
createWorkspace(cwd, label, newCwd?)   // cwd > newCwd（fallback = defaultCwd）> defaultCwd
createTab(workspaceId, label, newCwd?) // newCwd（fallback = ws.cwd。src = newCwd.sourcePaneId）> ws.cwd
splitPane(paneId, direction, ratio, newCwd?) // newCwd（fallback = source.cwd。src = paneId）> source.cwd
```

`newCwd.ts` の `makeNewCwdDeps({ terminals, inspector, getPane, currentDir })`（`composeServer.ts` が呼ぶ）:
`liveCwd = async (id) => { const h = terminals.get(id); if (!h) return null; const fg = await inspector.foreground(h.pid); return fg?.cwd ?? h.mirror.cwdHint() ?? null; }`、
`recordedCwd = (id) => getPane(id)?.cwd`、`home = os.homedir`、`currentDir` は `composeServer.ts` の `defaultCwd` と同じ値、
`isUsableDir` は `fs.promises.stat` → `isDirectory()` と `access(X_OK)`（どちらかが失敗したら false）。

### web

```ts
// store/settings.ts
export type NewCwdPolicy = "follow" | "home" | "current" | "path";
newCwdPolicy: Ref<NewCwdPolicy>      // 既定 "follow"
newCwdPath: Ref<string>              // 既定 ""
setNewCwdPolicy(v), setNewCwdPath(v) // 反映と保存を同時に
export function loadNewCwdPolicy(raw: unknown): NewCwdPolicy;   // 4 つのどれかでなければ "follow"
export function loadNewCwdPath(raw: unknown): string;           // 文字列でなければ ""
/** 要求に載せる形を作る（sourcePaneId は follow のときだけ載せる。null なら載せない）。 */
export function buildNewCwd(policy: NewCwdPolicy, path: string, sourcePaneId: string | null): NewCwd;
```

`wtm.prefs.v1` に `newCwdPolicy`・`newCwdPath` を足す（直前の work のキーと衝突しない）。

## 振る舞いの詳細

### サーバ

- 3 つの作成は、`newCwdDeps` があり `newCwd` が来たら `resolveNewCwd` を呼び、決めた場所で起動する。結果の `cwdFallback` は `fellBack` から。
- **新しい pane のモデル上の `Pane.cwd` も決めた場所にする**（`reserveWorkspace`・`reserveTab`・`model.splitPane` に渡す `cwd` を、今の
  `defaultCwd`・`ws.cwd`・`source.cwd` から決めた場所に替える）。起動の場所と記録を食い違わせない——OSC 7 を出さない macOS・Windows では
  監視が記録を更新しないので、食い違うと次の「引き継ぐ」（D4 の記録された場所）・再起動後の復元・`pane.created` の表示がずれる。
- **`Workspace.cwd` は新しい workspace のときだけ決めた場所で作る**（tab や分割では書き換えない。research の注意）。
- 検証と起動の間に場所が消えた（競走）・代わりの場所でも起動に失敗した、ときは今までどおり `spawn_failed`（まれ。requirements の
  「開けなくなることは無い」は、検証で分かる範囲のことを指す——エラー処理の表）。

### web（`ActionDispatcher`）

- `newWorkspace`: `workspace.create { newCwd: buildNewCwd(policy, path, view.focusedPaneId) }`。
- `confirmNewTab(label)`: 作る先の workspace は `dialogContext` から。元の pane は D7 のとおり。`tab.create { workspaceId, label, newCwd }`。
- `splitPane(paneId, dir)`: `pane.split { paneId, direction, newCwd: buildNewCwd(policy, path, null) }`。
- `openWorkspaceAt(cwd, …)`（worktree）: 今までどおり `cwd` だけ。**`newCwd` を付けない**。
- 応答の `cwdFallback` が true なら、トースト「新しく開く場所が使えないため、代わりの場所で開きました（設定の「端末」で確かめてください）」。
  **知らせるかどうかはサーバが決めている**（`follow` では立たない）ので、web は方針を見直さない。

### 設定ダイアログ（端末の節）

- scrollback の組の下に `<fieldset>`「新しく開く場所（workspace・tab・分割）」。ラジオは `change` で保存。
- 「指定した場所」の入力欄は `change`（Enter・入力欄を離れたとき）で保存し、`input` では保存しない。`disabled` は「指定した場所」以外のとき。
  注記「絶対パスか ~ で始まるパス」。
- 入力欄の中のキーは、既存の作法どおり端末へ漏れない（ダイアログ中は window の keydown が何もしない）。

## ドメイン固有の考慮

- **Windows と macOS では、シェルが OSC 7 を出さない限り、記録された場所は起動した場所のまま**（F2〜F4）。そのときの「引き継ぐ」は
  元の pane を開いた場所で開く（以前の workspace・tab より元の pane に近く、以前の分割と同じ）。`docs/verification.md` に書く。
- 前面でプログラムが動いている間の「引き継ぐ」は、そのプログラムの cwd（エージェントならそれを起動した場所）。

## エラー処理 / 異常系

| 状況 | 扱い |
|---|---|
| `follow` で元の pane が無い | 候補なし → 代わり（1 段目 → 2 段目）。知らせない |
| `follow` で前面プロセスの cwd が読めない（macOS・Windows・シェルが終わった）・200ms を超えた | 記録された場所。知らせない |
| `follow` で決めた場所が消えている（`cd` した先が削除された） | 代わり（1 段目。分割ではそれも同じ消えた場所なので 2 段目の起動した場所）。知らせない |
| `home`・`current`・`path` の場所が無い・ディレクトリでない・入れない | 代わり ＋ `cwdFallback: true` → web がトースト |
| `path` が空文字・相対パス・`~user/…` | 使えない場所として扱う（代わり ＋ 知らせる） |
| `cwd`（worktree）が使えない | 今までどおり `spawn_failed`（代わりへ回さない。D5） |
| 検証の後に場所が消えた・代わりの場所でも起動に失敗 | 今までどおり `spawn_failed`（まれ） |

## テストの置き方

- **server 単体**: `resolveNewCwd`・`expandHome` を総当たり（偽の deps）。**`liveCwd` と `recordedCwd` が違う値を返すときに `liveCwd` が勝つ**こと
  （読み直しの負の対照の的）、`liveCwd` が上限を超える・reject すると `recordedCwd` に落ちること（決して解決しない Promise と偽のタイマー／
  reject する Promise）、代わりの 2 段、`fellBack` の立ち方。**`makeNewCwdDeps`**: 元の pane の `TerminalHost` の pid で `foreground()` を呼ぶこと、
  cwd が null なら `mirror.cwdHint()`、pane が無ければ null（既存の偽の `ProcessInspector`・`TerminalManager`）。`SessionService` の 3 つの作成が、
  方針ごとに正しい場所で起動し（偽の `TerminalManager` が options を記録）、**新しい pane の `Pane.cwd` も同じ場所**で、`cwdFallback` を返すこと、
  `cwd` が `newCwd` に勝つこと、`newCwdDeps` が無ければ今までどおりであること。
- **protocol**: `NewCwd` のスキーマ（4 つの形、**知らない `policy` を弾く**）。
- **web 単体**: 設定のストア（読み込み・保存・壊れた値）、`buildNewCwd`、`ActionDispatcher` の 3 つの作成が載せる `newCwd`（元の pane の
  選び方を含む）と worktree が載せないこと、`cwdFallback` のトースト、設定ダイアログの端末の節（`input` では保存しない）。
  **既定が「引き継ぐ」なので、作成の要求にはいつも `newCwd` が載る**——要求の params を完全一致で見ている既存の期待値
  （`ActionDispatcher.test.ts:108`・`:327`・`:341`・`:351`・`:715`。例 `["workspace.create", {}]`）が変わる。**先に落ちることを確かめてから直す**。
- **E2E**: **ブラウザで** `cd <dir> && printf 'cd-%s\n' done` のように**実行した結果にだけ出る印**を打ち（打った入力のエコーには `cd-done` が
  現れない。`echo <印>` だとエコーの時点で合図が立ち、`cd` の実行前に作ってしまう競走になる——`terminal-app.spec.ts:74-79` の先例・D90）、
  ブラウザが受けたフレーム（`watchReceivedFrames`）に印が出たのを合図に、
  新しい workspace・tab・分割を開き、新しい pane で `pwd` を打って、**ブラウザが受けたフレーム**でその出力を読む（条項 `e2e-observe-browser`：
  テストのクライアントで代用しない）。方針は、AC-I3 ではダイアログをキーだけで操作して選び、ほかは `storageState` で `wtm.prefs.v1` を
  先に入れておく（直前の work の流儀）。方針をホーム・起動した場所・指定した場所にしたとき、使えない場所のトースト。
  **「起動した場所」は分割で変更の前後を見分ける**——変更前も workspace は起動した場所、tab は最初の workspace の場所（＝起動した場所）なので
  見分けられないが、分割は変更前だと `cd` した先（`source.cwd`）になる。先に別の場所へ `cd` してから分割し、`pwd` が起動した場所であることを見る。
  - **E2E は「読み直し」を見分けない**（`cd` から作成までに記録の更新が間に合うと、読み直さなくても通る）。読み直しの見分けはサーバの単体で行う。
  - 分割（AC3）は以前から Linux では記録された場所を引き継いでいた（research F9）ので、E2E は「以前から通る」ことを承知で振る舞いを固定する。
- **負の対照**（条項 `regression-negative-control`）: 読み直しを外す（サーバ単体）・代わりの 2 段目を外す・worktree に `newCwd` を付ける・
  web が元の pane を載せない、等で落ちることを確かめる。

## 受け入れ基準との対応

- AC1: 入力は**焦点の pane**（web の `view.focusedPaneId` → `newCwd.sourcePaneId`）と**その前面プロセスの cwd**（サーバが `foreground()` で読み直す）。
  E2E で `cd` → `prefix+N` → 新しい pane で `pwd`（以前は起動した場所だったので、変更の前後を見分けられる）。
- AC2: 入力は D7 の元の pane。`tab.create` の `newCwd`。E2E で `cd` → `prefix+c` → `pwd`（以前は workspace の場所）。
- AC3: 入力は分割する pane（`pane.split` の `paneId`）。E2E で `cd` → `prefix+v` → `pwd`（以前からの振る舞いを固定）。
- AC4: `loadNewCwdPolicy(undefined) === "follow"`。E2E は何も設定しない context で AC1 を通す。
- AC5（D4 で直す）: 元の pane が無い → 代わり、前面の cwd が読めない・上限超え → 記録された場所。どちらも `fellBack: false`。サーバの単体で総当たり。
  web は `cwdFallback` が無いのでトーストを出さない（単体）。
- AC6: `home` → `os.homedir()`。E2E で方針をホームにして `pwd` がホーム。
- AC7: `current` → `defaultCwd`。E2E で**先に別の場所へ `cd` してから**新しい workspace・tab・**分割**を開き、`pwd` がサーバを起動した場所
  （E2E ではテストのプロセスの `process.cwd()`——`appServer.ts:48-57`・`composeServer.ts:136`）。変更の前後を見分けるのは分割（上の「テストの置き方」）。
- AC8: `path` → `expandHome` の後。E2E で一時ディレクトリを指定して `pwd`。`~` の展開と相対パスの拒否はサーバの単体。
- AC9（decisions D1 で「以前と同じ場所」に直した）: 使えない場所 → 代わり ＋ `cwdFallback: true` → トースト。E2E で無いパスを指定してトーストと `pwd`。
- AC10: 方針は要求のたびに載せるので、次の要求から効く。既に開いている pane には何もしない（単体で、設定を変えても要求が出ないこと）。
- AC11: worktree を開く経路は `cwd` だけを載せ（web の単体）、サーバは `cwd` を `newCwd` より優先する（サーバの単体）。負の対照つき。
- AC12: `docs/herdr-parity.md` の H36 を、H36（シェル・起動モード。MVP の既定の挙動のまま）と H36b（cwd の方針。この work。置き場所が herdr と違う）に割る。
- AC13: `docs/verification.md` に、方針の説明と確かめ方（`cd` → 新しい tab → `pwd`）、Windows・macOS の制約を書く。
- AC-I1: 設定ダイアログの端末の節に置く（新しい画面を増やさない）。閉じても保存済み。
- AC-I2: ラジオは `change` で保存、入力欄も `change`（Enter・離れたとき）で保存し、`input` では保存しない（単体）。
- AC-I3: Tab でラジオの組に入り、矢印で「指定した場所」を選び、Tab で入力欄へ、文字を打って Enter、Esc で閉じる（E2E）。
- AC-I4: 既存の作法のまま（直前の work の単体と E2E）。
- AC-I5: ダイアログ中は window の keydown が何もしない（既存）ので、入力欄の文字・Esc・Enter は端末へ漏れない。
