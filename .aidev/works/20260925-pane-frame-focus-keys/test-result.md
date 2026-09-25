# テスト結果: pane の枠にフォーカスがある間の prefix・後のキーの割り当てを保護する

## 実行したもの
- `cd packages/web && npx vitest run` — 1986 passed / 0 failed / 0 skipped（90 files。うち
  `assign.test.ts`・`keymap.test.ts` の新設ケース（AC1〜AC7 分）を含む）
- `pnpm --filter @wtm/protocol --filter @wtm/server --filter @wtm/cli run test`
  （この work は `packages/web/src/keys/` だけを変更しているが、`RESERVED_DIRECT` の型変更
  （`Set`→`Map`）という公開シンボルの変更を含むため、依存する他パッケージへの回帰も確認）
  — protocol 68/68・server 829/829・cli 133/133、すべて pass（exit 0）
- `pnpm -s typecheck`（root。web・server・cli・protocol をまとめて型検査） — exit 0
- `aidev coverage --strict` — `coverage-summary: ac=7 design=7/7(100%) tasks=7/7(100%)
  task_rows=1 no_ac=0 ac_none=0 gaps=0` / `coverage-gaps: struct=0 cover=0`（exit 0）
- `aidev smoke` — pass（web・cli の2本）
- `packages/e2e` は変更していないため、この work のスコープでは実行していない
  （E2E は利用者からの依頼があったときだけ実行する運用のため。「未検証の穴」も参照）。

## 受け入れ基準ごとの判定
- AC1: pass — `enter` を prefix の後のキーとして割り当てようとすると拒否される
  （`assign.test.ts` の新設テスト。`validateAssignment` の `reason` に「pane の枠のメニュー」
  を含むことを確認）。`keymap.test.ts` の `resolveKeymap` レベルでも、保存済み設定に
  `prefix+enter` が含まれていた場合に読み込み時に落ちることを確認。
- AC2: pass — 同様に `space`（`" "`）を確認。
- AC3: pass — 同様に `down`（`ArrowDown`）を確認。
- AC4: pass — 既存の `esc`（`assign.test.ts:217-224`）・`ctrl+shift+v`（prefix の後:
  `assign.test.ts:226-236`・直接: "(f) ctrl+shift+v は貼り付けに使うので拒否する"）の拒否
  テスト、`keymap.test.ts:245` の予約テストが、`RESERVED_DIRECT` の `Set`→`Map` 型変更後も
  無改修のまま通ることを確認（回帰なし。理由文言も変わらない）。
- AC5: pass — 直接のキーの割り当てに関する既存テストは、`shift+f10`（AC7 で新規に拒否対象へ
  加わった1件）を除き無改修のまま通ることを確認。
- AC6: pass — `shift+enter`・`shift+space`・`shift+down` を prefix の後のキーとして割り当てよう
  とすると拒否されることを `assign.test.ts`（`key({ key: "Enter", shift: true })` 等）・
  `keymap.test.ts`（`resolveKeymap` に `prefix+shift+enter` 等を含む `bindings` を渡す）の
  両方で確認（review round1 の指摘への対応）。
- AC7: pass — `shift+f10` を prefix の後のキー・直接のキーの両方で割り当てようとすると拒否
  されることを確認。直接のキー側は理由に「pane の枠のメニュー」を含み「貼り付け」を含まない
  ことも確認（`RESERVED_DIRECT` を `Map` 化し、`ctrl+shift+v` 専用だった固定文言をやめたことの
  検証）。`assign.test.ts`（prefix の後・直接の2テスト）・`keymap.test.ts`（shift 付き回帰
  テストへの追加・直接の `shift+f10` 単独の新設テスト）の両方で確認（T1 round2 taskcheck の
  指摘への対応）。

## 失敗の証跡

### T1 負の確認（1回目。D1。Enter/Space/ArrowDown 無修飾3エントリ）
`RESERVED_AFTER_PREFIX` の新設3エントリを一時的に削除し、`assign.test.ts`・`keymap.test.ts`
を実行:
```
FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)）
      > (c) prefix の後の Enter・Space・↓ も拒否する（pane の枠のメニューが先に取るので、
      割り当てても効かない。20260925-pane-frame-focus-keys）
Error: 通ってしまった: prefix+enter
 ❯ reason src/keys/assign.test.ts:44:19

FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
      予約：prefix の後の Enter・Space・↓ は落とす（pane の枠のメニューが先に取る。
      20260925-pane-frame-focus-keys）
AssertionError: expected [ Array(4) ] to deeply equal [ 'ctrl+alt+z' ]

 Test Files  2 failed (2)
      Tests  2 failed | 86 passed (88)
```
復元後、`git diff --stat`（`keymap.ts | 5 +++++`）が変更前と同一であることを確認し、
再実行して全88件が pass することを確認（decisions.md D1・T1 taskcheck が独自に再現し
一致を確認済み）。

### T1 負の確認（2回目。D2。review round1 指摘。shift+enter/space/down 3エントリ）
```
FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)）
      > (c) prefix の後の Shift+Enter・Shift+Space・Shift+↓ も拒否する（…）
Error: 通ってしまった: prefix+shift+enter

FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
      予約：prefix の後の Enter・Space・↓（shift 付きも含む）は落とす…
AssertionError: expected [ 'prefix+shift+enter', …(3) ] to deeply equal [ 'ctrl+alt+z' ]

 Test Files  2 failed (2)
      Tests  2 failed | 87 passed (89)
```
復元後、`git diff --stat`（`keymap.ts | 8 ++++++++`）が変更前と同一であることを確認し、
再実行して全89件が pass することを確認（decisions.md D2）。

### T1 負の確認（3回目。D3。T1 round2 taskcheck 指摘。shift+f10・RESERVED_DIRECT の Map 化）
`RESERVED_AFTER_PREFIX` から `shift+f10` を削除し、`RESERVED_DIRECT` を旧
`Set(["ctrl+shift+v"])` へ戻し、`assign.ts`・`keymap.ts` の参照を旧来の `.has()`＋固定文言へ
一時的に戻した状態で実行:
```
FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)）
      > (c) prefix の後の Shift+F10 も拒否する（…T1 round2 taskcheck 指摘）
Error: 通ってしまった: prefix+shift+f10
 ❯ reason src/keys/assign.test.ts:44:19

FAIL  src/keys/assign.test.ts > validateAssignment — 直接のキー（AC5・AC6 (d)(f)(g)）
      > (f) Shift+F10 は pane の枠のメニューを開くキーとして使うので拒否する（…）
Error: 通ってしまった: shift+f10
 ❯ reason src/keys/assign.test.ts:44:19

FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
      予約：prefix の後の Enter・Space・↓（shift 付きも含む）・Shift+F10 は落とす（…）
AssertionError: expected [ 'prefix+shift+f10', 'ctrl+alt+z' ] to deeply equal [ 'ctrl+alt+z' ]

FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
      予約：直接の Shift+F10 も落とす（…）
AssertionError: expected [ 'shift+f10', 'ctrl+alt+z' ] to deeply equal [ 'ctrl+alt+z' ]

 Test Files  2 failed (2)
      Tests  4 failed | 88 passed (92)
```
復元後、`git diff --stat`（`assign.ts | 4 ++--`・`keymap.ts | 26 +++++++++++++++++++++++---`）
が巻き戻し前と同一であることを確認し、再実行して全92件が pass することを確認
（decisions.md D3）。`pnpm -s typecheck` も exit 0 を確認（exit code で判定）。

## 起動確認（smoke）
`aidev smoke`（D3 の修正後、test フェーズ再承認前に再実行）:
```
$ pnpm -s build && pnpm -s smoke
smoke: agent manifests ok (22/22)
smoke: login ok
smoke: websocket connected
smoke: client.hello ok
smoke: workspace.create ok (pane p2)
smoke: pane.subscribe ok
smoke: echo round trip ok
smoke(web): auto-login (#token) → connect → pane 表示 ok
smoke(web): 端末の描画用 canvas が画面内にある（xterm.css 有効。D96）
smoke(web): tab title ok
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

## 未検証の穴（skip / 環境不足）
- この work は `KeySettings.vue`（画面）を変更していない（design「依拠する既存の事実」で、
  既存の配線がそのまま新しい拒否理由を表示することを確認済み）。画面での実地確認（実際に
  設定画面を開いて `enter`/`space`/`down`/`shift+f10` の取り込みを試す）は、`assign.ts`・
  `keymap.ts` の単体テストで検証済みのロジックを画面が素通りするだけなので、この work では
  追加の E2E は作成していない（`packages/e2e` に変更なし）。
