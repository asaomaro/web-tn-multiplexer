# 仕様: ロック済み worktree の削除

## 概要

`git worktree remove` はロック済みの対象に対しては `--force` を1回渡しても失敗し（`fatal: cannot
remove a locked working tree; use 'remove -f -f' to override or unlock first`）、`--force` を
**2回**渡す（`-f -f`）と成功する。サーバ側の `DefaultWorktreeService.remove()` は現在 `--force`
を最大1回しか渡さないため、ロック済み worktree の削除は常に失敗し、かつ `classifyWorktreeRemoveError`
にロック用の分岐が無いため汎用の `worktree_failed` に落ちる。

この work では: (1) `classifyWorktreeRemoveError` にロック用の分岐を追加し専用のエラーコード
`worktree_locked` を新設する、(2) `remove()` の `force` 引数の意味を「`--force` を2回渡す」に
変える（既存の dirty 系との後方互換は実機確認済み）、(3) クライアント側の既存の dirty 時
`--force` 確認フロー（`confirmWorktreeRemoveForce`）を、ロックの場合も同じダイアログ種別で
扱えるよう拡張する（メッセージだけ理由に応じて出し分ける）。新しいダイアログ種別・新しい
RPC は増やさない。

## 設計方針

- **`force: true` の意味を「`--force` を2回渡す」に変える**（1回ではなく）。既存の dirty
  worktree の削除は「`--force` 1回」を前提に実装・テストされているが、依拠する既存の事実
  （下記）で「`--force` を2回渡しても dirty 系の削除に副作用は無い」ことを実機確認済みなので、
  `force` 引数自体は増やさず、内部の `args` 組み立てだけを変える。
  - 代替案（`force` を2値から3値 `"none" | "force" | "force-force"` に増やす等）は退けた——
    実機確認により「2回渡すことは常に安全（1回で足りる場合も2回で問題ない）」と分かっている
    ため、呼び出し側に選択を持たせる必要が無く、単に不要な複雑さになる。
- **`classifyWorktreeRemoveError` に新しい分岐を1つ足すだけ**（既存の `worktree_dirty` 等と同じ
  パターンマッチ構造）。ロックと dirty が同時に成立する場合、実機確認で「ロックのエラーが
  常に先に（単独で）出る」ことを確認済みなので、分岐の順序に関わらず `worktree_locked` に
  正しく分類される（複合判定は不要）。
- **クライアント側は新しいダイアログ種別を増やさない**。既存の `confirmWorktreeRemoveForce`
  （`DialogContext`）に、確認理由を示す `reason: "dirty" | "locked"` フィールドを追加し、
  `ActionDispatcher.sendWorktreeRemove` の catch 内の分岐条件
  （`errorCodeOf(err) === "worktree_dirty"`）を `"worktree_dirty" | "worktree_locked"` の両方に
  広げ、どちらのコードだったかを `reason` として渡す。`ConfirmDialog.vue` は `reason` に応じて
  確認文言を出し分ける（AC5: 「ロックされている」ことが具体的に伝わる文言が必要なため、
  dirty 用の固定文言をそのまま流用できない）。

## 対象範囲

- `packages/server/src/git/WorktreeService.ts`（`classifyWorktreeRemoveError`・`remove()`）
- `packages/server/src/git/WorktreeService.test.ts`
- `packages/protocol/src/errors.ts`（`ErrorCode` に `worktree_locked` を追加）
- `packages/web/src/net/clientError.ts`（`worktree_locked` の日本語メッセージ）・
  対応する `.test.ts`
- `packages/web/src/store/view.ts`（`DialogContext` の `confirmWorktreeRemoveForce` に
  `reason` フィールドを追加）
- `packages/web/src/actions/ActionDispatcher.ts`（`sendWorktreeRemove` の分岐条件・
  `confirmWorktreeRemoveForce` context の組み立て）・対応する `.test.ts`
- `packages/web/src/components/ConfirmDialog.vue`（`reason` に応じた確認文言）・
  対応する `.test.ts`

## 依拠する既存の事実

- `classifyWorktreeRemoveError` は `stderr` を改行分割し、`^(fatal|error):` に最初にマッチする
  行だけを正規表現でパターンマッチして `ErrorCode` の部分集合に畳む純粋関数
  （`packages/server/src/git/WorktreeService.ts:56-67`）。既存の分岐（`worktree_dirty`・
  `worktree_not_a_worktree`・`worktree_is_main`）は全てこの同じ構造。
- `DefaultWorktreeService.remove()`（`WorktreeService.ts:150-161`）は
  `["worktree", "remove", ...(force ? ["--force"] : []), path]` で `args` を組み立て、`git`
  を実行する。成功したときだけ、その worktree の path と `cwd` が一致する workspace を探して
  閉じる。
- `packages/web/src/actions/ActionDispatcher.ts:338-365` の `sendWorktreeRemove`:
  まず `force: false` で `worktree.remove` を送り、失敗かつ `!force && errorCodeOf(err) ===
  "worktree_dirty"` のときだけ `confirmWorktreeRemoveForce` の `DialogContext` を開いて確認を
  挟み、確定すると同じ関数を `force: true` で呼び直す。それ以外のエラーコードは常に
  `worktreeErrorMessage(err)` のトーストと一覧ダイアログの開き直しになる（363行目）。
- `packages/web/src/components/ConfirmDialog.vue:51-53` が `confirmWorktreeRemoveForce` の
  固定文言「この worktree には未コミットの変更が残っています。変更を破棄して削除しますか？」を
  返している。`DialogContext` の型定義は `packages/web/src/store/view.ts:194`
  （`{ kind: "confirmWorktreeRemoveForce"; sourceWorkspaceId: string; path: string;
  openWorkspaceId: string | null }`）。
- `packages/web/src/actions/ActionDispatcher.ts:321-326` の `confirmWorktreeRemoveForce()`:
  `view.dialogContext` が `confirmWorktreeRemoveForce` でなければ何もしない、そうでなければ
  ダイアログを閉じて `sendWorktreeRemove(..., true, ...)` を呼ぶだけの薄いハンドラ。`ctx` から
  `reason` 以外のフィールド（`sourceWorkspaceId`/`path`/`openWorkspaceId`）だけを読んでおり、
  `reason` の追加はこの関数の中身に触れない。
- `packages/web/src/components/ConfirmDialog.vue` のキーボード処理:
  74-87行目の `watch(() => view.dialogContext, ...)` が、ダイアログが開くたびに
  `nextTick` 後 `cancelBtn.value?.focus()` で「キャンセル」ボタンへ最初のフォーカスを置く
  （安全側。AC-I4 の出所）。117-125行目の `onKeydown` が `y`/`Y` で確定・`n`/`N` で取り消し、
  136行目で `<dialog>` 要素に `@keydown="onKeydown"` として束ねてある。`Escape`（ネイティブの
  `dialog` の `cancel` イベント）は 112-115行目の `onNativeCancel` が受けて `cancel()` を呼ぶ。
  **`↑`/`↓` の矢印キーによる操作は無い**（`ConfirmDialog.vue` に一覧的な項目は無く、2つの
  ボタン間の移動はブラウザ既定の `Tab` に任せている）——design 初稿では herdr 由来の他の
  一覧ダイアログ（`WorktreeOpenDialog.vue` 等）の操作感と混同していたが、この文書が対象と
  する `ConfirmDialog.vue` の実際のキー操作は「`y`/`n`（確定/取り消し）・`Escape`
  （取り消し）・`Tab`+`Enter`（ボタンのネイティブ操作）」である（AC-I3 を下記で修正）。
- `packages/web/src/actions/ActionDispatcher.ts:303-311` の `removeWorktree(sourceWorkspaceId,
  path)`: worktree 一覧の行の削除操作から呼ばれ、対象 path と一致する開いている workspace を
  探し、`confirmWorktreeRemove` の `DialogContext` を開くだけの関数（`worktree.remove` はまだ
  送らない）。この work では変更しない。
- `packages/protocol/src/errors.ts:2-19` の `ErrorCode` union に既存の worktree 系コードが並ぶ。
  `packages/web/src/net/clientError.ts:13` の `MESSAGES`（`Record<ErrorCode, string>`）が
  code→日本語のテーブル（`worktree_dirty` は同ファイル30行目）。
- **実機確認**（この work の requirements/design 作成時にこのセッションで実施。使い捨て repo
  で `git worktree lock` した worktree に対して検証、git 2.43.0）:
  - `git worktree remove <path>`（force 無し）・`git worktree remove --force <path>`（force
    1回）は、ロック済みの対象に対してどちらも exit 128、stderr 1行目
    `fatal: cannot remove a locked working tree, lock reason: <reason>`
    （reason 無しでロックした場合は `fatal: cannot remove a locked working tree;`）。
  - `git worktree remove --force --force <path>`（`-f -f`）は成功する。ロック済みで
    clean（変更なし）・ロック済みで dirty（untracked ファイルあり）のどちらでも成功する。
  - **ロック済みかつ dirty な worktree**に対しては、force 無し・force 1回のどちらでも
    `fatal: cannot remove a locked working tree...` が返る（dirty のエラー
    `contains modified or untracked files` ではなく、常にロックのエラーが優先される）。
    よって `classifyWorktreeRemoveError` の分岐順序に関わらず、ロック済みの対象は必ず
    `worktree_locked` に分類され、`worktree_dirty` に落ちることは無い。
  - `--force` を2回渡しても、ロックされていない通常の dirty worktree の削除は変わらず成功する
    （副作用なし。後方互換）。

## インターフェース / データ構造

### `packages/server/src/git/WorktreeService.ts`

```ts
export function classifyWorktreeRemoveError(
  stderr: string,
): "worktree_dirty" | "worktree_not_a_worktree" | "worktree_is_main" | "worktree_locked" | "worktree_failed" {
  const line = stderr.split("\n").find((l) => /^(fatal|error):/.test(l.trim())) ?? "";
  if (/cannot remove a locked working tree/.test(line)) return "worktree_locked";
  if (/contains modified or untracked files/.test(line)) return "worktree_dirty";
  if (/working trees containing submodules cannot be moved or removed/.test(line)) return "worktree_dirty";
  if (/is not a working tree/.test(line)) return "worktree_not_a_worktree";
  if (/is a main working tree/.test(line)) return "worktree_is_main";
  return "worktree_failed";
}
```

（ロックの分岐を先頭に置くのは可読性のためだけ——依拠する既存の事実のとおり、ロック済みの
対象は dirty のエラー文言を返さないので、分岐の順序自体は判定結果を左右しない。）

`remove()`:

```ts
async remove(workspaceId: string, path: string, force: boolean): Promise<void> {
  const cwd = this.cwdOf(workspaceId);
  const args = ["worktree", "remove", ...(force ? ["--force", "--force"] : []), path];
  // 以下は変更なし
  ...
}
```

### `packages/protocol/src/errors.ts`

```ts
  | "worktree_dirty"
  | "worktree_not_a_worktree"
  | "worktree_is_main"
  | "worktree_locked"; // 20260925-worktree-remove-locked
```

### `packages/web/src/net/clientError.ts`

```ts
  worktree_locked: "この worktree はロックされています。",
```

（`errorCodeOf`/`clientErrorMessage` の既存の枠組みをそのまま使う。新しい関数は不要。）

### `packages/web/src/store/view.ts`

`DialogContext` の `confirmWorktreeRemoveForce` に `reason` を追加:

```ts
  | { kind: "confirmWorktreeRemoveForce"; sourceWorkspaceId: string; path: string; openWorkspaceId: string | null; reason: "dirty" | "locked" }
```

### `packages/web/src/actions/ActionDispatcher.ts`

`sendWorktreeRemove` の catch 内（`if (this.view.dialogContext === null)` は既存のガード
——「応答を待つ間に別の操作で他のダイアログが開いていたら、それを奪わない」という
既存のコメントと実装をそのまま残す。今回変更するのは `worktree_dirty` だけだった条件式と
`reason` フィールドの追加だけ）:

```ts
.catch((err: unknown) => {
  const code = errorCodeOf(err);
  if (!force && (code === "worktree_dirty" || code === "worktree_locked")) {
    if (this.view.dialogContext === null) {
      this.view.openDialogWithContext({
        kind: "confirmWorktreeRemoveForce",
        sourceWorkspaceId,
        path,
        openWorkspaceId,
        reason: code === "worktree_locked" ? "locked" : "dirty",
      });
    }
    return;
  }
  // 以下は変更なし
  ...
})
```

### `packages/web/src/components/ConfirmDialog.vue`

`confirmWorktreeRemoveForce` の文言分岐:

```ts
if (ctx?.kind === "confirmWorktreeRemoveForce") {
  return ctx.reason === "locked"
    ? "この worktree はロックされています。ロックを解除せずに強制的に削除しますか？"
    : "この worktree には未コミットの変更が残っています。変更を破棄して削除しますか？";
}
```

## 振る舞いの詳細

- 利用者が worktree 一覧から削除を選ぶ → 確認（`confirmWorktreeRemove`）→ 確定 →
  `force: false` で `worktree.remove` を送る（**変更なし**、AC-I5）。
- サーバはロック済みなら `worktree_locked` を返す（force 無しでは常にロックが dirty より
  優先して検出されるため、ロック済みかつ dirty でも `worktree_locked` になる。依拠する
  既存の事実の実機確認どおり）。
- クライアントは `worktree_locked` を受け取ったら、`confirmWorktreeRemoveForce`
  （`reason: "locked"`）を開く（AC1・AC2・AC5）。利用者が確定すると `force: true` で再送する
  （AC-I2）。
- サーバは `force: true` を受け取ると `--force --force` で `git worktree remove` を実行する。
  ロック済み（dirty の有無を問わず）の対象はこれで削除される（AC3）。
- 既存の dirty（ロックされていない）系の流れは、`reason` の値以外は変更なし（AC4・AC6）。
  `--force` を2回渡すようになった点も、依拠する既存の事実の実機確認により dirty 系の成功に
  影響しない。
- ロック以外の未知の失敗は、これまでどおり `worktree_failed` に分類され、一覧を開き直す
  既存の経路のまま（AC6）。

## ドメイン固有の考慮

- 該当なし（herdr 側に「ロック済み worktree の削除」に相当する UI 機能は確認できておらず
  （`docs/herdr-parity.md` に記載無し）、この work は git そのものの制約への対応であって
  herdr との機能差ではない。ただし backlog の位置づけ（`.aidev/works/20260924-worktree-remove`
  の review 由来）は変わらない）。

## エラー処理 / 異常系

- ロックの分類に失敗する（想定外の stderr 文言）場合は、既存の `worktree_failed` にそのまま
  落ちる（新しい分岐にマッチしなければ既存の `return "worktree_failed"` に到達する、という
  既存の構造をそのまま使う。新しいエラー処理は追加しない）。
- `git worktree remove --force --force` 自体が別の理由（例: パス自体が worktree でなくなって
  いる）で失敗した場合も、既存の `classifyWorktreeRemoveError` の他の分岐がそのまま働く
  （`worktree_not_a_worktree` 等）。ロック分岐を追加しても他の分岐の判定順序・条件は変えない。

## 受け入れ基準との対応

- AC1: `classifyWorktreeRemoveError` にロック検知の分岐を追加し、`worktree_locked` を返す
  （入力: `git worktree remove` の実際の stderr。依拠する既存の事実の実機確認どおりの文言）。
- AC2: `sendWorktreeRemove` の catch 分岐を `worktree_dirty` と `worktree_locked` の両方に
  広げ、`confirmWorktreeRemoveForce`（既存のダイアログ種別）を開く。
- AC3: `remove()` の `args` 組み立てを `force ? ["--force", "--force"] : []` に変える。
  `--force --force` はロック済み（dirty 併発を含む）を解決することを実機確認済み。
- AC4: 依拠する既存の事実の実機確認（`--force` を2回渡しても既存 dirty 系の成功は変わらない）
  を、`WorktreeService.test.ts` の既存の「dirty でも --force を付ければ削除できる」テストが
  無改修のまま通ることで確認する。
- AC5: `clientError.ts` に `worktree_locked` 専用の日本語メッセージを追加し、
  `ConfirmDialog.vue` の `confirmWorktreeRemoveForce` 文言を `reason` で出し分ける。
- AC6: `classifyWorktreeRemoveError`・`clientError.ts`・`ConfirmDialog.vue` の既存の
  dirty/not_a_worktree/is_main 分岐・文言・確認フロー・キーボード操作は変更しない
  （新しい分岐・新しい `reason` の値を1つ足すだけで、既存の分岐・既存の `reason: "dirty"`
  の文言は変えない）。既存テスト（`WorktreeService.test.ts`・`ConfirmDialog.test.ts`・
  `ActionDispatcher.test.ts`・`clientError.test.ts`）が無改修のまま通ることで確認する。

## 相互作用の受け入れ基準（AC-I1〜AC-I5）との対応

- AC-I1: `confirmWorktreeRemoveForce` という既存のダイアログ種別をそのまま使う（新種別を
  増やさない）。
- AC-I2: `confirmWorktreeRemoveForce` の確定/取り消しハンドラ（`ActionDispatcher.
  confirmWorktreeRemoveForce`。`ActionDispatcher.ts:321-326`。依拠する既存の事実、参照）は
  変更しない——`reason` を読むのは `ConfirmDialog.vue` の表示側（`message` computed）だけで、
  確定/取り消しの配線は既存のまま。
- AC-I3: `ConfirmDialog.vue` の既存のキー操作——`y`/`Y`（確定）・`n`/`N`（取り消し）・
  `Escape`（ネイティブの `cancel` イベント経由で取り消し）・`Tab`+`Enter`（ボタンのネイティブ
  操作）（`ConfirmDialog.vue:74-87,112-125,136`。依拠する既存の事実、参照）——は、
  `confirmWorktreeRemoveForce` が lock 理由で開いても dirty 理由で開いても同じで、`reason`
  の追加はこのキーボード処理に触れない。
- AC-I4: 最初のフォーカスは `ConfirmDialog.vue` の既存の実装（`watch` が `cancelBtn.focus()`
  を呼ぶ。`ConfirmDialog.vue:74-87`。依拠する既存の事実、参照）——安全側の「キャンセル」——に
  依存しており、`reason` の追加はこのフォーカス制御に触れない。
- AC-I5: `removeWorktree`（`ActionDispatcher.ts:303-311`。依拠する既存の事実、参照。一覧の
  「選んで開く」と別の操作）・`confirmWorktreeRemove`（通常削除確認）は変更しない。lock 判定は
  サーバの応答（エラーコード）で決まるだけで、一覧側の操作の分岐を増やさない。
