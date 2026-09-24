# 仕様: worktree の削除

## 概要

既存の worktree 一覧ダイアログ（`WorktreeOpenDialog.vue`）の各行に削除操作を追加する。
サーバは新しい RPC `worktree.remove` で `git worktree remove` を実行し、対象が現在開いている
workspace の cwd と一致すれば、成功後にその workspace も閉じる（既存の
`SessionService.closeWorkspace` を再利用）。未コミットの変更（dirty）で失敗したら、利用者に
`--force` での再実行を確認する（herdr と同じ2段階式）。

## 設計方針

- **`WorktreeService` に `remove` を追加し、「git の実行」と「開いている workspace を閉じる」を
  1メソッドにまとめる**（research F3・F4）。`WorktreeService` は既に `SessionService` へ依存済み
  （`cwdOf` が読みに使っている）ので、新しい依存の向きを作らない。RPC ハンドラ
  （`surface/methods/worktree.ts`）は他の worktree メソッドと同じ1行の委譲のままにする。
- **`git worktree remove` を先に実行し、成功したときだけ workspace を閉じる**（research
  「実装時の注意」）。逆にすると、dirty で失敗した場合に動いているシェルを消してから
  「実は削除できませんでした」となる——先に close すると取り返しが付かない事故になる。
- **`view.dialogContext` は単一の値なので、確認ダイアログを一覧ダイアログの「上に重ねる」ことは
  しない**（requirements.md AC-I1 を design で修正済み——当初の想定はこの技術的事実と
  食い違っていた）。削除の確認・dirty 時の `--force` 確認はどちらも一覧ダイアログを一旦閉じて
  `ConfirmDialog.vue` の新しい `kind` として開き、確定・取り消し・（force 以外の）失敗のいずれの
  結末でも `openWorktree(sourceWorkspaceId)` を呼び直して一覧ダイアログへ戻る。これにより
  「元の一覧に戻れる」という体験を、新しい状態管理を増やさずに実現する。
- **dirty 判定はクライアントで先読みしない**（herdr も同じ。research「design への申し送り」）。
  `git status` を先に叩いて dirty かどうかを予測するのではなく、まず force 無しで `remove` を
  試み、失敗した理由をサーバの分類（`classifyWorktreeRemoveError`）で判定する。往復が1回増える
  代わりに、実際の git の判断と食い違う余地が無い。
- **一覧の即時同期（新しい push イベント）は作らない**（research F6）。`worktree.list` は元々
  request/response のみで、別クライアントの `worktree.create` も他クライアントには自動で
  伝わらない既存の非対称——削除だけ特別扱いすると一貫性が崩れる。開いていた workspace を
  閉じる副作用は、既存の `pane.closed`/`tab.closed`/`workspace.closed` イベントで全クライアントへ
  自動的に伝わる（AC10 はこの範囲で満たす）。

## 対象範囲

- `packages/protocol/src/errors.ts`: `ErrorCode` に `worktree_dirty`・`worktree_not_a_worktree`・
  `worktree_is_main` を追加。
- `packages/protocol/src/messages.ts`: `WorktreeRemoveParams` と、`MethodResultMap` への
  `Record<string, never>` エントリを追加。
- `packages/server/src/git/WorktreeService.ts`: `remove` メソッド・
  `classifyWorktreeRemoveError` 関数を追加。既存の `list`/`create`/`classifyWorktreeError` は
  変更しない。
- `packages/server/src/surface/methods/worktree.ts`: `worktree.remove` の RPC 登録を追加。
- `packages/web/src/store/view.ts`: `DialogContext` に `confirmWorktreeRemove`・
  `confirmWorktreeRemoveForce` を追加。
- `packages/web/src/components/WorktreeOpenDialog.vue`: 行ごとの削除ボタン・
  `Delete`/`Backspace` キーでの削除を追加。
- `packages/web/src/components/ConfirmDialog.vue`: 新しい2つの `kind` の message 分岐・
  `confirm()`/`cancel()` の分岐を追加。
- `packages/web/src/actions/ActionDispatcher.ts`: `removeWorktree`・`confirmWorktreeRemove`・
  `confirmWorktreeRemoveForce`・`sendWorktreeRemove`（private）を追加。
- `packages/web/src/net/clientError.ts`: 新しい3つのエラーコードの日本語メッセージを追加。

## 依拠する既存の事実

- `SessionService.closeWorkspace(id, closeLinkedWorktrees=false)` は既に public な async
  メソッドで、`pane.closed`→`tab.closed`→`workspace.closed` の順にイベントを配布し
  `persist.touch()` も呼ぶ（`packages/server/src/session/SessionService.ts:285-298`。
  research F3 で確認）。
- `SessionService.snapshot()`（同ファイル:169）は `Workspace[]` を含む `SessionSnapshot` を返す。
  cwd→workspace の逆引き索引は既存に無く、`snapshot().workspaces.find(w => w.cwd === path)`
  で線形探索する（research F4）。クライアント側の `ActionDispatcher.confirmWorktreeOpen`
  （`packages/web/src/actions/ActionDispatcher.ts:280-284`）が同じパターンを既に使っている。
- `GitRunner.run(cwd, args, timeoutMs)` は `cwd` を子プロセスの起動時 cwd にそのまま渡す
  （`packages/server/src/infra/GitRunner.ts:9-10`。research F7）。
- `git worktree remove` の実際の挙動（このリポジトリの git 2.43.0 で実機確認。research F1）:
  - dirty: exit 128、`fatal: '<path>' contains modified or untracked files, use --force to
    delete it`。`--force` で成功する。
  - 存在しない／worktree でなくなっている: exit 128、`fatal: '<path>' is not a working tree`。
  - **main working tree（clone した元のディレクトリ）は削除できない**: exit 128、
    `fatal: '<path>' is a main working tree`（design 作成時に実機で追加確認）。
  - submodule を含む場合のエラー文字列（herdr のソースにのみ確認。このリポジトリでは
    submodule が無く実機未確認）: `working trees containing submodules cannot be moved or
    removed`。
- `view.dialogContext`/`openDialog` は単一の `ref`（`packages/web/src/store/view.ts:209-210`）。
  複数のダイアログを重ねて表示する仕組みは無い（design 作成時に確認。このリポジトリで初めて
  問題になった——既存の `confirmClose`/`confirmReplacePane` はどれも「別のダイアログの上に
  開く」使われ方をしていない）。
- `ConfirmDialog.vue` は `role="alertdialog"`・開いたら最初のフォーカスは「キャンセル」・
  `y`/`n` キーでも確定/取消できる（`packages/web/src/components/ConfirmDialog.vue:33-42,
  70-91`）。`message` の `computed`・`confirm()` に `kind` ごとの分岐を足すだけで新しい確認を
  追加できる既存の拡張点。
- `WorktreeOpenDialog.vue` の各行（`<li role="option">`）はクリックで即座に「開く」を実行する
  （`choose(index)`→`accept()`。`packages/web/src/components/WorktreeOpenDialog.vue:45-54`）。
  既存のキーボード操作は `onKeydown`（同ファイル:66-86）が `Escape`（cancel）・`Enter`（accept）・
  `ArrowDown`/`j`（次へ）・`ArrowUp`/`k`（前へ）を扱う。`Delete`/`Backspace` はこれらと重複しない
  未使用のキーである（AC-I5 の根拠）。
- `ErrorCode`（`packages/protocol/src/errors.ts:2-14`）は閉じた union 型で、
  `clientErrorMessage`（`packages/web/src/net/clientError.ts`）がコードごとに日本語を引く。
  サーバの生の message は利用者に見せない（D107）。
- **`worktreeErrorMessage`（`packages/web/src/actions/ActionDispatcher.ts:1032-1039`）は
  既存の関数**で、`errorCodeOf(err)`（`packages/web/src/net/clientError.ts:34`。RPC の失敗から
  `code` を取り出す既存のユーティリティ。同ファイルで `errorCodeOf`/`clientErrorMessage`
  両方をエクスポート済み）を取り出して `clientErrorMessage(code)` で日本語に変換する薄いラッパー
  ——`newWorktree`/`openWorktree`/`confirmWorktreeCreate`/`confirmWorktreeOpen`
  （`ActionDispatcher.ts:241-316`）が既に使っている。この work では**この2つの既存関数を
  そのまま呼ぶだけで新しい関数は作らない**——インターフェース節のコード例（`errorCodeOf`・
  `worktreeErrorMessage`）はどちらもこの既存の関数を指す。

## インターフェース / データ構造

### protocol

```ts
// errors.ts
export type ErrorCode =
  | ... // 既存
  | "worktree_dirty"          // 未コミットの変更が残っている（--force で再実行できる）
  | "worktree_not_a_worktree" // 対象が既に worktree でない（一覧が古い）
  | "worktree_is_main";       // 対象が main working tree（削除できない）

// messages.ts
export const WorktreeRemoveParams = z.object({
  workspaceId, // 実行場所（repo root）を解決するための、操作元の workspace
  path: z.string().min(1), // 削除対象。WorktreeEntry.path
  force: z.boolean().optional(), // 省略時は false 扱い
});
export type WorktreeRemoveParams = z.infer<typeof WorktreeRemoveParams>;
```

`METHOD_SCHEMAS`/`MethodResultMap` に `"worktree.remove": WorktreeRemoveParams` /
`"worktree.remove": Record<string, never>` を追加する（成功時のみ返る・値を持たない結果型は
専用の interface を作らず `Record<string, never>` にする、という `pane.close` の既存の規約に
揃える形——T1 taskcheck round1 で発見・修正）。

### サーバ側

```ts
// WorktreeService.ts
export interface WorktreeService {
  list(workspaceId: string): Promise<WorktreeListResult>;
  create(workspaceId: string, branch: string): Promise<WorktreeCreateResult>;
  remove(workspaceId: string, path: string, force: boolean): Promise<void>; // 追加
}

export function classifyWorktreeRemoveError(
  stderr: string,
): "worktree_dirty" | "worktree_not_a_worktree" | "worktree_is_main" | "worktree_failed" {
  const line = stderr.split("\n").find((l) => /^(fatal|error):/.test(l.trim())) ?? "";
  if (/contains modified or untracked files/.test(line)) return "worktree_dirty";
  if (/working trees containing submodules cannot be moved or removed/.test(line)) return "worktree_dirty";
  if (/is not a working tree/.test(line)) return "worktree_not_a_worktree";
  if (/is a main working tree/.test(line)) return "worktree_is_main";
  return "worktree_failed";
}
```

`DefaultWorktreeService.remove`:
1. `cwd = this.cwdOf(workspaceId)`（既存の `create`/`list` と同じ。未知の workspaceId は
   `RpcError("not_found", ...)`）。
2. `args = ["worktree", "remove", ...(force ? ["--force"] : []), path]`。
3. `removed = await this.run(cwd, args)`。
4. `removed.code !== 0` なら `classifyWorktreeRemoveError(removed.stderr)` で分類し、
   ログに生の diagnostics を残してから `RpcError(code, ...)` を投げる（`create` の失敗処理と
   同じ形。ここで終わり、workspace は閉じない）。
5. 成功したら `this.session.snapshot().workspaces.find(w => w.cwd === path)` を探し、
   見つかれば `await this.session.closeWorkspace(found.id)`。

`surface/methods/worktree.ts`:
```ts
surface.register("worktree.remove", {
  schema: WorktreeRemoveParams,
  handler: async (_ctx, params) => {
    await deps.worktrees.remove(params.workspaceId, params.path, params.force ?? false);
    return {};
  },
});
```

### クライアント側

```ts
// view.ts の DialogContext に追加
| { kind: "confirmWorktreeRemove"; sourceWorkspaceId: string; path: string; openWorkspaceId: string | null }
| { kind: "confirmWorktreeRemoveForce"; sourceWorkspaceId: string; path: string; openWorkspaceId: string | null }
```

`sourceWorkspaceId` は「一覧を開いた元の workspace」（repo root 解決用。`worktree.list`/
`worktree.remove` の `workspaceId` パラメータと同じ意味）。`openWorkspaceId` は「削除対象の
path が現在開いている workspace と一致する場合、その workspace の id」（メッセージの出し分け用。
サーバ側の close は自動で行われるので、クライアントはこの id を使って別途 close 系 RPC を
呼ぶ必要は無い）。

`ActionDispatcher.ts`:
```ts
/** worktree 一覧の行から削除を実行する。開いていれば確認の文言でそれが伝わる（AC4）。 */
removeWorktree(sourceWorkspaceId: string, path: string): void {
  const openWorkspace = [...this.session.workspaces.values()].find((w) => w.cwd === path);
  this.view.openDialogWithContext({
    kind: "confirmWorktreeRemove",
    sourceWorkspaceId,
    path,
    openWorkspaceId: openWorkspace?.id ?? null,
  });
}

confirmWorktreeRemove(): void {
  const ctx = this.view.dialogContext;
  if (ctx?.kind !== "confirmWorktreeRemove") return;
  this.view.closeDialog();
  this.sendWorktreeRemove(ctx.sourceWorkspaceId, ctx.path, false, ctx.openWorkspaceId);
}

confirmWorktreeRemoveForce(): void {
  const ctx = this.view.dialogContext;
  if (ctx?.kind !== "confirmWorktreeRemoveForce") return;
  this.view.closeDialog();
  this.sendWorktreeRemove(ctx.sourceWorkspaceId, ctx.path, true, ctx.openWorkspaceId);
}

private sendWorktreeRemove(sourceWorkspaceId: string, path: string, force: boolean, openWorkspaceId: string | null): void {
  this.conn
    .request("worktree.remove", { workspaceId: sourceWorkspaceId, path, force })
    .then(() => this.openWorktree(sourceWorkspaceId)) // 更新された一覧を開き直す（AC2・AC3・AC-I1）
    .catch((err: unknown) => {
      if (!force && errorCodeOf(err) === "worktree_dirty") {
        this.view.openDialogWithContext({ kind: "confirmWorktreeRemoveForce", sourceWorkspaceId, path, openWorkspaceId });
        return;
      }
      this.view.toast(worktreeErrorMessage(err));
      this.openWorktree(sourceWorkspaceId); // 何も変わっていないので一覧を開き直して戻す（AC9・AC-I1）
    });
}
```

`WorktreeOpenDialog.vue`（削除ボタン・キー操作の追加）:
```ts
function remove(path: string): void {
  const ctx = view.dialogContext;
  if (ctx?.kind !== "worktreeOpen") return;
  actions?.removeWorktree(ctx.workspaceId, path);
}
```
```html
<li ...>
  <span class="worktree-open-dialog-branch">...</span>
  <span class="worktree-open-dialog-path">...</span>
  <button type="button" class="worktree-open-dialog-delete" tabindex="-1" @click.stop="remove(entry.path)">削除</button>
</li>
```
`onKeydown` に分岐を追加:
```ts
if (ev.key === "Delete" || ev.key === "Backspace") {
  ev.preventDefault();
  const entry = entries.value[selected.value];
  if (entry) remove(entry.path);
}
```
**`tabindex="-1"`**：ボタンをタブ順から外す（キーボードでの到達経路は `Delete`/`Backspace` に
一本化し、`listbox` の `option` の中に2つ目のタブ停止点を作らない——`role="option"` が
インタラクティブな子要素を持つのは ARIA 的に望ましくないため、視覚的なマウス操作の入口としてだけ
残す）。

`ConfirmDialog.vue`（message/confirm/cancel の分岐追加）:
```ts
const message = computed(() => {
  const ctx = view.dialogContext;
  if (ctx?.kind === "confirmClose") { /* 既存 */ }
  if (ctx?.kind === "confirmReplacePane") { /* 既存 */ }
  if (ctx?.kind === "confirmWorktreeRemove") {
    return ctx.openWorkspaceId
      ? "この worktree は現在 workspace として開いています。workspace を閉じて worktree を削除しますか？"
      : "この worktree を削除しますか？";
  }
  if (ctx?.kind === "confirmWorktreeRemoveForce") {
    return "この worktree には未コミットの変更が残っています。変更を破棄して削除しますか？";
  }
  return "";
});

const confirm = (): void => {
  const ctx = view.dialogContext;
  if (ctx?.kind === "confirmReplacePane") actions.confirmReplacePane();
  else if (ctx?.kind === "confirmWorktreeRemove") actions.confirmWorktreeRemove();
  else if (ctx?.kind === "confirmWorktreeRemoveForce") actions.confirmWorktreeRemoveForce();
  else actions.confirmClose(closeLinkedWorktrees.value);
};

function cancel(): void {
  const ctx = view.dialogContext;
  if (ctx?.kind === "confirmWorktreeRemove" || ctx?.kind === "confirmWorktreeRemoveForce") {
    actions.openWorktree(ctx.sourceWorkspaceId); // 一覧ダイアログへ戻る（AC-I1・AC-I2）
    return;
  }
  view.closeDialog();
}
```
`watch(() => view.dialogContext, ...)` の `if` 条件に `confirmWorktreeRemove`/
`confirmWorktreeRemoveForce` を追加する（`showModal()`・「キャンセル」へのフォーカスを
既存の2種と同じに揃える。AC-I4）。

`clientError.ts`（追加分）:
```ts
worktree_dirty: "この worktree には未コミットの変更が残っています。",
worktree_not_a_worktree: "この worktree は既に見つかりません。一覧を開き直しました。",
worktree_is_main: "これはメインの作業ツリーのため削除できません。",
```

## 振る舞いの詳細

### 通常の削除（dirty でない・開いていない）

1. 利用者が一覧の行の削除ボタン（または選択して Delete/Backspace）を押す。
2. `removeWorktree` → `confirmWorktreeRemove` ダイアログが開く（`openWorkspaceId: null`）。
3. 確定 → `worktree.remove({ workspaceId, path, force: false })`。
4. サーバ: `git worktree remove <path>` が成功 → 開いている workspace は無いので close はしない
   → `{}` を返す。
5. クライアント: 成功 → `openWorktree(sourceWorkspaceId)` で一覧を開き直す。削除された行は
   もう出ない（AC2・AC3）。

### 開いている workspace の worktree を削除

1〜3は同じ（`openWorkspaceId` に一致する workspace の id が入る。メッセージにそれが伝わる。AC4）。
4. サーバ: `git worktree remove` 成功 → `snapshot().workspaces` から一致を見つけ
   `session.closeWorkspace(id)` → 既存のイベント配布（`pane.closed`/`tab.closed`/
   `workspace.closed`）が全クライアントへ届く（AC5・AC10）。
5. 削除を実行したクライアント自身も、他クライアントと同じくこのイベントで自分の
   `session`/`view` の状態が更新される（既存の `StoreAdapter.ts` の仕組みそのまま。この work
   での変更は無い）。

### dirty な worktree の削除

1〜3は同じ。
4. サーバ: `git worktree remove <path>`（force 無し）が dirty で失敗 →
   `RpcError("worktree_dirty", ...)`。
5. クライアント: `catch` で `worktree_dirty` を検出 → `confirmWorktreeRemoveForce` ダイアログが
   開く（AC6・AC7）。
6. 確定 → `worktree.remove({ ..., force: true })` → 成功 → `openWorktree` で一覧を開き直す
   （AC8）。開いている workspace があれば、通常のケースと同じく閉じられる。
7. 取り消し → `openWorktree(sourceWorkspaceId)` で一覧ダイアログへ戻る。何も変わらない。

### dirty 以外の理由で失敗（対象が既に無い・main working tree）

`classifyWorktreeRemoveError` が `worktree_not_a_worktree`/`worktree_is_main`/
`worktree_failed` を返す → `--force` 確認へは進まず、`worktreeErrorMessage` でトースト表示
→ `openWorktree(sourceWorkspaceId)` で一覧を開き直す（AC9）。

## ドメイン固有の考慮

- **main working tree（元の clone）は一覧に含まれるが削除できない**（依拠する既存の事実）。
  一覧側で事前に除外する設計も検討したが、herdr も事前フィルタはせず git のエラーに任せている
  （scratchpad/herdr のソースに main working tree 用の事前フィルタは見当たらない）。この work も
  同じ方針——`worktree_is_main` の専用メッセージで十分に伝わる。
- **`git worktree remove` はブランチを削除しない**（requirements「対象外」）。checkout の
  ディレクトリと git 内部の worktree 登録だけが消え、ブランチ自体は残る。design 上の追加対応は
  不要（git の既定動作のまま）。

## エラー処理 / 異常系

- `workspaceId` が存在しない: 既存の `cwdOf` が `RpcError("not_found", ...)` を投げる
  （`create`/`list` と同じ）。
- `path` が最初から worktree でない（クライアントの一覧が古い・他クライアントが先に削除した）:
  `git worktree remove` 自身が `is not a working tree` で失敗し、`worktree_not_a_worktree` に
  分類される。サーバ側で事前の存在チェックは行わない（git 自身がその役割を果たす。
  二重の検証は不要）。
- **`path` の信頼性**: `git worktree remove` は、対象がその repo の登録済み worktree でなければ
  必ず失敗する（git 自身が worktree の administrative files を見て判定する）ため、
  クライアントから任意の path を渡されても、登録されていない任意のディレクトリを削除できる
  余地は無い（`create`/`replacePane` 等で確立した「未検証のドロップ先は `.get()` 相当で
  ガードする」パターンとは別の種類の安全性だが、同じ「信頼しない入力を安全に扱う」設計）。
- タイムアウト・git が実行できない: 既存の `run`（`WorktreeService.ts` の private メソッド）が
  `RpcError("worktree_failed", ...)` に包む（`create`/`list` と同じ）。

## 受け入れ基準との対応

- AC1: `WorktreeOpenDialog.vue` の各行に削除ボタンを追加（インターフェース節）。
- AC2: `worktree.remove` 成功で `git worktree remove` が実際に checkout を消す（振る舞いの詳細
  「通常の削除」手順4）。
- AC3: 成功後に `openWorktree` で一覧を開き直す（振る舞いの詳細「通常の削除」手順5）。
  「次に開いたとき」ではなく「即座に」満たす形を採った。
- AC4: `confirmWorktreeRemove` の message が `openWorkspaceId` の有無で分岐する
  （インターフェース節「クライアント側」）。
- AC5: `WorktreeService.remove` 成功後、一致する workspace を `session.closeWorkspace` で閉じる
  （振る舞いの詳細「開いている workspace の worktree を削除」手順4）。
- AC6: `classifyWorktreeRemoveError` が `worktree_dirty` を返し、クライアントが
  `worktreeErrorMessage`（`clientError.ts` の新エントリ）で伝える経路と、`--force` 確認へ進む
  経路の両方がある（振る舞いの詳細「dirty な worktree の削除」手順4〜5）。
- AC7: `confirmWorktreeRemoveForce` ダイアログ（振る舞いの詳細 手順5）。
- AC8: `force: true` での再実行（振る舞いの詳細 手順6）。
- AC9: dirty 以外の失敗で `openWorktree` により一覧を開き直し、レイアウトは変化しない
  （振る舞いの詳細「dirty 以外の理由で失敗」節・エラー処理節）。
- AC10: `closeWorkspace` が発行する既存イベント（`pane.closed`/`tab.closed`/`workspace.closed`）
  が全クライアントへ配布される（振る舞いの詳細「開いている workspace の worktree を削除」
  手順4〜5）。一覧自体の即時同期は対象外（設計方針「一覧の即時同期は作らない」）。
- AC11: `WorktreeService`/`ConfirmDialog.vue`/`WorktreeOpenDialog.vue` のいずれも既存の
  `list`/`create`/`confirmClose`/`confirmReplacePane`/既存のキー処理・D&D の分岐は変更せず、
  新しい分岐を追加するだけ（対象範囲節）。test 工程で既存テストの無改修実行により確認する。
- AC-I1: 設計方針「`view.dialogContext` は単一の値」の節。`ConfirmDialog.vue` の
  `confirm()`/`cancel()`・`ActionDispatcher.sendWorktreeRemove` がすべての結末で
  `openWorktree` を呼び直す。
- AC-I2: 同上（振る舞いの詳細の各手順）。
- AC-I3: `WorktreeOpenDialog.vue` の `onKeydown` に `Delete`/`Backspace` を追加
  （インターフェース節）。`confirmWorktreeRemove`/`confirmWorktreeRemoveForce` は
  `ConfirmDialog.vue` 既存の `y`/`n` キーがそのまま使える。
- AC-I4: `ConfirmDialog.vue` の `watch` に新しい2種を含める（最初のフォーカスは「キャンセル」。
  インターフェース節）。削除ボタンは `tabindex="-1"` でタブ順から外す。
- AC-I5: 削除ボタンは `@click.stop`（インターフェース節）。`Delete`/`Backspace` は既存の
  `ArrowUp/Down/j/k/Enter/Escape` と衝突しない新しいキー。
