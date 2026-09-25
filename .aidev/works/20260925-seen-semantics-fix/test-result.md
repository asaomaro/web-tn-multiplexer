# テスト結果: 既読（wtm.seen.v1）の意味論を直す

## 実行したもの

- `packages/web`: `npx vue-tsc --noEmit` — 0 errors / `npx vitest run` — 1955 passed /
  0 failed / 0 skipped（1948→1955。内訳は下記 T4）
- ルート: `pnpm -s typecheck` — exit 0（3パッケージ横断の再確認）・`pnpm -s test` —
  2956 passed / 0 failed（protocol・server・web。この work の変更対象は web のみだが、
  無改修で server・protocol も全て pass することを確認）
- `aidev smoke` — PASS（web・CLI 双方。下記「起動確認」参照）
- `aidev coverage --strict` — ac=4 design=4/4(100%) tasks=4/4(100%) gaps=0

## T4（回帰確認）の実施内容

- `seen.test.ts`（既存部分。`useSeenStore`・`displayStateFor`・`aggregate`・
  `shouldMarkSeen`）: 無改修のまま全て pass。既読の記録・優先度判定・`shouldMarkSeen` の
  真偽表自体は影響を受けていない。
- `TerminalPane.test.ts`（既存部分。acquire/release・mousedown での focusPane・
  term.focus()・roving tabindex 等）: 無改修のまま全て pass。`onMounted` に追加した既読処理は
  既存の処理の後に続くだけで、既存の振る舞いを変えていない。
- `NotificationController.test.ts`（無改修）: 全て pass。`isPaneVisible`/`hasFocus` を
  使う既存の正しい実装（この work が参考にした precedent）は変更していない。

## 受け入れ基準ごとの判定

- AC1: pass — `seen.test.ts`「sweepMarkSeen」の「表示中かつウィンドウにフォーカスがある
  pane だけ既読になる」で、非表示 pane（`visible` に含まれない）が既読対象から外れることを
  確認。
- AC2: pass — 同テストで、表示中かつフォーカスありの pane が既読になることを確認。
- AC3: pass — `TerminalPane.test.ts`「mount 時の既読」の「ウィンドウにフォーカスがあれば、
  mount した pane のエージェントを既読にする」で、pane が新しくマウントされた瞬間に
  既読になることを確認（design が明記する「`onMounted` は paneVisible が自明に true」の
  経路）。
- AC4: pass — `seen.test.ts`「sweepMarkSeen」の「複数 pane をそれぞれ独立に判定する」で、
  表示中と非表示が混在する状況で、表示中の pane だけが対象になることを確認（`focus`
  イベント経由の掃引が対象を正しく絞ることの裏付け）。

## 失敗の証跡

T1・T2 taskcheck round1: findings 0（このラウンドでは失敗無し）。
T3 taskcheck round1（nit。決定なし——コメントのみの指摘のため decisions.md には記録して
いない）: 新規テストの `vi.spyOn` に `.mockRestore()` が無かった指摘。対応済み・実害は無し
（同一テストファイル内の後続テストは `document.hasFocus` を再度 spy し直すため）。

T3 の新規コード自体の負の確認（`onMounted` の追加分を一時的に外して実施）:

```
FAIL  src/components/TerminalPane.test.ts > TerminalPane > mount 時の既読（20260925-seen-semantics-fix） > ウィンドウにフォーカスがあれば、mount した pane のエージェントを既読にする
AssertionError: expected -1 to be 3 // Object.is equality
 ❯ src/components/TerminalPane.test.ts:108:41
```

修正を戻すと該当テスト・`TerminalPane.test.ts` 全12件とも pass を確認済み。

review round1 の should（decisions.md D1）: T1（`sweepMarkSeen`）の負の確認が未記録だった
指摘。`isVisible(pane.id)` を旧来のバグパターン（`true` 固定＝表示を見ずにフォーカスだけで
判定）に一時的に戻して実施:

```
FAIL  src/store/seen.test.ts > sweepMarkSeen > 表示中かつウィンドウにフォーカスがある pane だけ既読になる
AssertionError: expected [ [ 'a1', 3 ], [ 'a2', 5 ] ] to deeply equal [ [ 'a1', 3 ] ]

FAIL  src/store/seen.test.ts > sweepMarkSeen > 複数 pane をそれぞれ独立に判定する（表示中と非表示が混在）
AssertionError: expected [ [ 'a1', 1 ], [ 'a2', 2 ], [ 'a3', 3 ] ] to deeply equal [ [ 'a1', 1 ], [ 'a3', 3 ] ]

Test Files  1 failed (1)
     Tests  2 failed | 2 passed | 11 skipped (15)
```

修正を戻すと `seen.test.ts` 全15件とも pass を確認済み。

このラウンドでは他に失敗は発生していない。

## 起動確認（smoke）

```
$ aidev smoke
smoke: starting server on 127.0.0.1:38938 (state dir /tmp/wtm-smoke-sFxOgn)
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
`smokeCommands` への追記は不要。

## 未検証の穴（skip / 環境不足）

- **実際のブラウザで、複数 pane・複数 tab を行き来しながらエージェントを完了させ、サイドバーの
  完了の印と通知が実際に一致することを目視確認する検証は行っていない**（このセッションの
  既定方針: E2E はユーザー依頼のときだけ実施。AC1〜AC4 の検証は vitest/happy-dom
  （Vue Test Utils・pinia）でのストア・コンポーネントレベルの確認に留まる）。
- **`document.hasFocus()` の実ブラウザでの挙動（複数タブ・複数ウィンドウ間でのフォーカス
  移動）を実機で確認する検証は行っていない**（`vi.spyOn` によるモックでの確認のみ）。
- `TerminalRegistry.isVisible` の非 reactive・`nextTick()` 後に読むという既存の契約自体
  （`main.ts` の2つの発火点がこの契約を守っているか）は、design 段階でコードを読んで確認した
  ものであり、実際の Vue の描画タイミング（複数コンポーネントの mount/unmount が同一
  マイクロタスクで競合する場合）を実機で再現しての確認はしていない。
