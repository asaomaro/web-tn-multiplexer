# 仕様: Workspace.git の即時化

## 概要

`GitInfoPoller`（既存。5秒周期の定期ポーリング）に、1つの workspace だけを対象にした
即時ポーリング用の公開メソッド `pollWorkspaceNow(workspaceId)` を追加する。
`workspace.create` の RPC ハンドラが、workspace の作成が成功した直後にこのメソッドを
fire-and-forget（応答を待たせない）で呼び、結果は既存の `Workspace.git` の更新経路
（`SessionService.updateWorkspaceGit`→`workspace.updated` イベント）へそのまま流す——
新しい応答フィールド・新しいイベント種別は一切作らない。新しい業務ロジックとしての
エラー処理（新しいエラー種別・リトライ等）も作らないが、応答を絶対にブロック・失敗させない
ための `.catch(() => undefined)`（既存の `GitInfoPoller.start()` と同じ確立済みの防御
パターン）は明示的に付ける（「エラー処理 / 異常系」参照）。

## 設計方針

- **既存の `pollWorkspace`（1 workspace を実際に probe する private メソッド）をそのまま
  再利用する**: 新しい git 取得ロジックは書かない。`pollNow()`（全 workspace を対象にする
  既存の公開メソッド）をそのまま使わず、1 workspace 用の新しい公開メソッドを追加する——
  requirements「未確定事項」への回答。理由: `pollNow()` を作成のたびに呼ぶと、workspace
  数が多い状況で無関係な既存 workspace まで毎回再ポーリングすることになり、無駄な git
  サブプロセス起動が積み重なる。1 workspace に絞ったメソッドなら、作成のたびに増えるのは
  その1件分の git 呼び出しだけで済む。
- **fire-and-forget にする**: `workspace.create` の RPC ハンドラで即時ポーリングの完了を
  `await` しない（requirements「非機能要件」——応答速度を変えない・D3 で退けられた
  「応答に git 情報を含める」案と同じ責務増加を避ける）。取得が終わり次第、既存の
  `workspace.updated` イベントで非同期にクライアントへ届く。
- **新しい業務ロジックとしてのエラー処理は新設しない**: `probe()`（既存）は git が無い・
  コミットが無い・時間切れのいずれも `try/catch` で拾い `null` を返す既存の実装のまま
  （`GitInfoPoller.ts:52-85`）。`pollWorkspaceNow` もこの既存の `probe`/`pollWorkspace` を
  そのまま呼ぶだけなので、workspace が git リポジトリでなくても・git コマンドが無くても、
  例外は外へ漏れない
  （requirements AC2 の直接の根拠）。
- **二重更新・競合状態は、既存の `updateWorkspaceGit` の差分ベースの冪等性にそのまま乗る**
  （requirements AC4 の直接の根拠）: `SessionService.updateWorkspaceGit`
  （`SessionService.ts:710-716`）は (1) workspace が既に無ければ何もしない、
  (2) 新しい値が既存の値と同じ（`sameGit`）なら何もしない、(3) 異なるときだけモデルを更新し
  `workspace.updated` を1回 publish する、という既存の作りになっている。即時ポーリングと
  定期ポーリングが偶然ほぼ同時に完了しても、後から届いた方が `sameGit` で無害に弾かれる
  だけで、二重の `workspace.updated` 発行や矛盾した状態は起きない——新しい排他制御コードは
  一切不要。
- **workspace が作成直後に閉じられた場合の防御も既存のまま**: `pollWorkspaceNow` は
  `session.getWorkspace(workspaceId)` が見つからなければ何もしない（`updateWorkspaceGit`
  自身も同じ防御を持つため、実質二重の安全策になる）。

## 対象範囲

- `packages/server/src/git/GitInfoPoller.ts`: `GitInfoPoller` インターフェースと
  `DefaultGitInfoPoller` に `pollWorkspaceNow(workspaceId: WorkspaceId): Promise<void>` を
  追加する。
- `packages/server/src/surface/methods/deps.ts`: `MethodDeps` に `gitPoller: GitInfoPoller`
  を追加する。
- `packages/server/src/surface/methods/workspace.ts`: `workspace.create` のハンドラを
  `async` にし、作成の完了後に `deps.gitPoller.pollWorkspaceNow(result.workspace.id)` を
  fire-and-forget で呼ぶ。
- `packages/server/src/composeServer.ts`: `registerAllMethods` の呼び出しに `gitPoller` を
  渡す（既に `gitPoller` は `registerAllMethods` 呼び出しより前に構築済み——配線を1箇所
  足すだけ）。
- 変更しない: `packages/server/src/session/SessionService.ts`（`updateWorkspaceGit`・
  `createWorkspace` は無改修——後者は戻り値をそのまま使うだけ）・
  `packages/web/src/components/ContextMenu.vue`（`Workspace.git != null` での出し分けは
  既存のまま。今回の変更でこの判定が早く成立するようになるだけ）・`prefix+G` の経路
  （requirements「対象外」）。

## 依拠する既存の事実

- `GitInfoPoller`（`packages/server/src/git/GitInfoPoller.ts`）: `pollNow()`（42-45行目）は
  `this.session.snapshot().workspaces` の**全件**を `Promise.all` で probe する既存の
  公開メソッド（doc コメントに「テスト・診断用に、間隔を待たず今すぐ1周する」と明記。
  9-15行目）。`pollWorkspace(ws: Workspace)`（47-50行目。private）が1 workspace 分の
  `probe`→`session.updateWorkspaceGit` を行う実体。`probe(cwd)`（52-85行目）は
  `try/catch` で全ての失敗（git 管理外・タイムアウト・git コマンド無し等）を拾い `null` を
  返す。「git 管理外」の判定は `git rev-parse --abbrev-ref HEAD` を実行し、終了コードが
  0 以外なら `null` を返す、という具体的な分岐（`GitInfoPoller.ts:54-55`）。
- `SessionService.updateWorkspaceGit`（`SessionService.ts:710-716`）: `getWorkspace` で
  存在確認→`sameGit` で差分確認→異なるときだけ `model.updateWorkspaceGit`＋
  `workspace.updated` の publish、という既存の冪等な更新経路。
- `SessionService.createWorkspace`（`SessionService.ts:206-245`）は `async` で
  `{workspace, tab, pane, cwdFallback?}` を返す。現在の `workspace.create` ハンドラ
  （`packages/server/src/surface/methods/workspace.ts:13-19`）は
  `return deps.session.createWorkspace(...)` と、Promise をそのまま返しているだけ
  （`async` 修飾は付いていない）。
- `MethodDeps`（`packages/server/src/surface/methods/deps.ts`）は `session`・`clients`・
  `sizeAuthority`・`terminals`・`worktrees`・`agentIntegrations` を持つが `gitPoller` は
  含まれていない。`composeServer.ts:189` で `gitPoller` は既に構築済み、`composeServer.
  ts:205` の `registerAllMethods(surface, {...})` 呼び出しには渡されていない（この
  呼び出しより前に `gitPoller` は構築されているため、渡すだけで配線できる）。
- `ContextMenu.vue:71-88` の「新しい worktree」「worktree を開く…」項目は
  `ws?.git != null`（`isGit`）で出し分けている。コメント（74-76行目）が
  `20260920-git-worktree-actions` decisions.md D3 を直接参照している。
- D3（`.aidev/works/20260920-git-worktree-actions/decisions.md:30-42`）: 「`Workspace.git`
  を使い、遅れは受け入れる」と決定。退けた代替案は「メニューを開くたびに問い合わせる」
  （待たされる／後から項目が増える）と「`workspace.create` の応答に git 情報を含める」
  （サーバの責務が増える割に効果が限定的）の2つ。この work が採る「作成直後に対象を絞った
  即時ポーリングを fire-and-forget で行う」は、この2案のどちらとも異なる第3の手段
  ——D3 の時点では検討されていない。

## インターフェース / データ構造

### `GitInfoPoller.ts`

```ts
export interface GitInfoPoller {
  start(): void;
  stop(): void;
  pollNow(): Promise<void>;
  /**
   * 1つの workspace だけを対象に、間隔を待たず今すぐ probe する（20260925-workspace-git-immediate。
   * design「設計方針」）。`workspace.create` 直後に呼ばれる想定——`pollNow()`（全件）と違い、
   * 他の workspace を巻き込まない。対象が見つからなければ何もしない。
   */
  pollWorkspaceNow(workspaceId: WorkspaceId): Promise<void>;
}

export class DefaultGitInfoPoller implements GitInfoPoller {
  // ...既存のまま

  async pollWorkspaceNow(workspaceId: WorkspaceId): Promise<void> {
    const ws = this.session.getWorkspace(workspaceId);
    if (!ws) return;
    await this.pollWorkspace(ws);
  }

  // pollNow・pollWorkspace・probe は無改修
}
```

### `deps.ts`

```ts
export interface MethodDeps {
  // ...既存のまま
  /** 20260925-workspace-git-immediate: workspace.create 直後の即時ポーリング用。 */
  gitPoller: GitInfoPoller;
}
```

### `workspace.ts`

```ts
surface.register("workspace.create", {
  schema: WorkspaceCreateParams,
  handler: async (ctx, params) => {
    deps.clients.touch(ctx.clientId);
    const result = await deps.session.createWorkspace(params.cwd, params.label, params.newCwd);
    // 20260925-workspace-git-immediate（design「設計方針」）。応答は待たせない（fire-and-forget）。
    // 結果は既存の workspace.updated イベントで届く。
    void deps.gitPoller.pollWorkspaceNow(result.workspace.id).catch(() => undefined);
    return result;
  },
});
```

### `composeServer.ts`

```ts
registerAllMethods(surface, { session, clients, sizeAuthority, terminals, worktrees, agentIntegrations, gitPoller });
```

## 振る舞いの詳細

1. **git リポジトリで workspace を作る（AC1）**: `workspace.create` ハンドラが
   `session.createWorkspace(...)` の完了を待ってから応答を組み立てる（既存のまま）。
   応答を返す**前**に `pollWorkspaceNow` を呼ぶが、`await` しない（fire-and-forget）ので
   応答自体はブロックしない。`pollWorkspaceNow` は非同期に `probe(cwd)` を実行し、
   結果が既存の値（作成直後は `null`）と異なれば `workspace.updated` が publish され、
   クライアントの `Workspace.git` が埋まる。定期ポーリングの5秒を待たない。
2. **git リポジトリでない場所で workspace を作る（AC2）**: `probe` が `git 管理外` の
   分岐（`rev-parse --abbrev-ref HEAD` が非0）で `null` を返す。`updateWorkspaceGit` は
   `sameGit(null, null)` が真なので何もしない（`workspace.updated` すら発行しない）。
   例外は発生しない。
3. **応答速度（AC3）**: `pollWorkspaceNow(...).catch(...)` の呼び出しは `void` で
   捨てられ、`return result;` はその完了を待たない。応答は `session.createWorkspace` の
   完了だけで決まる——変更前と同じ。
4. **競合状態（AC4）**: `pollWorkspaceNow`（即時）と定期ポーリングの `pollNow()`
   （5秒周期）が同じ workspace をほぼ同時に probe しても、`updateWorkspaceGit` の
   `sameGit` 差分チェックが後着の同一内容の呼び出しを無害に弾く。probe の結果自体が
   食い違うことは無い（同じ `git` コマンドを同じ `cwd` に対して実行するだけで、
   結果は現在の git の状態を反映するだけ）。

## ドメイン固有の考慮

- 該当なし（PJ 固有の論点に直接紐づく判断はない。既存の `GitInfoPoller`/
  `updateWorkspaceGit` という確立済みの部品を、新しい呼び出し元から正しく呼ぶだけの work）。

## エラー処理 / 異常系

- `probe` が失敗する（git コマンドが無い・タイムアウト・対象ディレクトリが消えている等）:
  既存の `try/catch` が `null` を返すだけで、例外は伝播しない（既存のまま。新規コードなし）。
- `pollWorkspaceNow` の呼び出し中に workspace が閉じられる: `session.getWorkspace` が
  `undefined` を返せば何もしない。probe の完了後に `updateWorkspaceGit` を呼ぶ時点で
  workspace が既に無くなっていても、`updateWorkspaceGit` 自身が同じ防御を持つ。
- `pollWorkspaceNow(...).catch(() => undefined)`: `pollWorkspace`/`probe` 自体は例外を
  投げない設計だが、`workspace.create` ハンドラの応答を絶対にブロック・失敗させないための
  最終防御として `.catch` を明示的に付ける（`GitInfoPoller.start()` の定期呼び出し
  `this.pollNow().catch(() => undefined)` と同じパターン。`GitInfoPoller.ts:29`）。

## 受け入れ基準との対応

- AC1: 「振る舞いの詳細」手順1。
- AC2: 「振る舞いの詳細」手順2。
- AC3: 「振る舞いの詳細」手順3。
- AC4: 「振る舞いの詳細」手順4。
