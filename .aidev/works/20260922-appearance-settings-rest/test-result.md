# テスト結果: 外観と設定の残り（H21/H22/H23/H25b）

## 実行したもの
- `pnpm -s typecheck` — exit 0
- `pnpm -s lint` — exit 0
- `cd packages/web && pnpm exec vitest run` — 77 files / 1504 tests passed / 0 failed
- `aidev smoke` — pass（exit 0）
- `pnpm --filter @wtm/web build` — 成功（`packages/web/dist` を最新化）
- E2E（`packages/e2e`）: 下記「未検証の穴」を参照。**このラウンドの途中でユーザーから
  「普段の検証は jsdom（vitest）だけにする（Playwright の E2E フル実行はユーザーの明示的な依頼が
  あるときだけ）」という方針転換の指示があり、以降の確認は指示に従い打ち切った**（[[e2e-only-on-request]]）。

## 受け入れ基準ごとの判定（unit test の範囲）
- AC1・AC2: pass — `Sidebar.test.ts`「spaces の並び順」
- AC3: pass — `view.test.ts`「loadWorkspaceSort」
- AC4〜AC6: pass — `TabBar.test.ts`「自動非表示」
- AC7・AC8: pass — `TabBar.test.ts`「現在時刻」
- AC9〜AC12: pass — `PaneFrame.test.ts`・`SettingsDialog.test.ts`・`settings.test.ts`
- AC13〜AC15: pass — `ActionDispatcher.test.ts`「reloadConfig」
- AC-I1〜AC-I6: pass — 上記各テストに含む（`SettingsDialog.test.ts`・`TabBar.test.ts`）

## 失敗の証跡
このラウンドで unit test の失敗は無かった（T7 昇格に伴う regression はすべて coding 工程内で
直し済み。`review.md`「タスク点検ログ」参照）。

E2E（下記「E2E について」の経緯で見つけた、この work の UI 変更が原因の回帰の一部。生出力）:

```
FAIL  src/specs/settings.spec.ts:187
  Error: locator.click: Error: strict mode violation: locator('dialog.settings-dialog')
  .locator('section[aria-labelledby="settings-display"] [role="switch"]') resolved to 2 elements:
    1) <button type="button" role="switch" ... aria-checked="true" class="settings-switch">…</button>
    2) <button type="button" role="switch" ... aria-checked="false" class="settings-switch">…</button>

FAIL  src/specs/keys-mouse-dialogs.spec.ts:510（旧行番号）
  Error: expect(locator).toHaveText(expected) failed
  Locator: locator('.sidebar-section-header .sidebar-sort-btn')
  （spaces 区画にも同名のボタンが増えたため、agents 側を意図していたセレクタが曖昧になった）

FAIL  src/specs/notifications.spec.ts:243（旧行番号。openNewTab ヘルパー経由で4テストに波及）
  Error: expect(locator).toHaveCount(expected) failed
  Locator: locator('.tab-bar-item')
  Expected: 1
  Received: 2
  （tab が1個のときは tab バー自体が無く .tab-bar-item の count は 0 になる、という新しい前提を
   ヘルパーの「before」計算が踏まえていなかった）

FAIL_自己修正分（1回目の fix 検証で発見。自分の追加コードの不具合）:
  keys-mouse-dialogs.spec.ts「分割した2つ目のpane」テスト
  Error: expect(received).toContain(expected) // indexOf
  Expected value: "p2"
  Received array: ["p1", "p3"]
  （`client.waitForEvent("pane.created")` は述語が無いと「直前に届いた最後の pane.created」を
   即座に返す仕様〔wsClient.ts〕を見落とし、自分が足した「2つ目の tab を作る」手順の
   pane.created を、分割の pane.created と取り違えていた）
```

## E2E について（このラウンドの経緯・未検証の穴）

coding 工程内で T8 として `packages/e2e/src/specs/appearance-settings.spec.ts`（新規、6テスト）を
書き、taskcheck で1件（should）の指摘を受けて直した（`review.md` T8 参照）。

test 工程に入ってから、deliver 前の慣例（[[e2e-affected-specs-only]]）に従いフル E2E スイート
（122本）を実行したところ 22 件失敗した。精査の結果、**うち 15 件はこの work の UI 変更
（tab バーの自動非表示・spaces の並び順ボタン追加・表示の節の switch 追加）が原因の本物の回帰**
と判明し、**既存の E2E spec（`notifications.spec.ts`・`key-bindings.spec.ts`・
`keys-mouse-dialogs.spec.ts`・`settings.spec.ts`・`terminal-app.spec.ts`・
`workspace-tab-pane.spec.ts`）を修正した**（詳細は各ファイルのコメント参照。要旨は decisions.md
には残していない——工程の記録としてはここに残す）:

- `.tab-bar-item` の count を「tab 数」の代わりに使っていた箇所（tab が1個のときは tab バー自体が
  無く count は 0 になる）を、実際の tab 数で補正、または tab を2個にしてから検証する形に直した。
- `.tab-bar-zoomed`（tab バー内の拡大表示の印）に依存していた検証を、tab バーに依存しない
  `.pane-layout-zoomed` に差し替えた。
- `.sidebar-sort-btn`／`[role="switch"]` の**曖昧なセレクタ**（この work で同種の部品が1つ増えた
  ため、絞らないと2つに一致する）を、区画・文言で絞る形に直した。
- Tab キーでの巡回順の期待値（`keys-mouse-dialogs.spec.ts`）を、増えた並び順ボタンを含む形に
  更新した。
- 残り 7 件（`agent-detection.spec.ts`・`auth-rejection.spec.ts`・`new-terminal-cwd.spec.ts`）は、
  エラー内容（`.xterm-helper-textarea` の visible 待ちタイムアウト・appServer の teardown タイム
  アウト・シェルの応答タイムアウト）と、この work が一切触れていないコード経路であることから、
  **このマシン（複数の Claude セッションが同時に動く共有環境）でのリソース競合による環境要因**と
  判断し、spec は変更していない。

修正後、対象ファイルだけの再実行を複数回行い、1回目（69本）は 66 passed / 3 failed
（自分の fix 自体に2件のバグ——`waitForEvent` が述語無しだと「直前の pane.created」を
即座に返す仕様を見落としていた／後続の `.tab-bar-item-active` assertion の直し漏れ——を発見し
直した）、2回目は環境の悪化（63/69 失敗。`.xterm-helper-textarea` が visible にならない等、
この work と無関係な範囲まで broad に落ちた）で判定不能、3回目を開始した直後に上記の方針転換の
指示を受けて打ち切った。

**結論として、E2E の新規・修正分（`appearance-settings.spec.ts` 6件＋既存 spec の修正 15箇所）は、
最後まで安定した完走で確認できていない**。1回目の 69→66 passed の結果と、各修正の個別の読解
（原因の特定に足る具体的なエラーメッセージを得た上での対症）から、**内容としては妥当と判断する**が、
「未検証の穴」として明記する。次に E2E を回す機会（ユーザーの明示的な依頼時）に、この work の
差分から確認すること。

## 起動確認（smoke）
```
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45709 (state dir /tmp/wtm-smoke-cSGuRF)
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
smoke: pass (exit 0)
```

## 未検証の穴（skip / 環境不足）
- **E2E のフル完走確認**（上記参照）。新規・修正分とも内容は個別に読解・検証済みだが、
  最後まで安定した実行での確認は取れていない。deliver の PR 本文の既知の制約に引き継ぐ。
- AC8（tab バーの時刻の定期更新）・AC3（並び順の既定値の永続化）は tasks.md の方針どおり
  E2E では確認せず unit test で代替している（意図的な skip。上記「受け入れ基準ごとの判定」参照）。
