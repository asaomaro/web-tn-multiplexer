# テスト結果: タブバーと pane の枠の外観設定（20260922-tabbar-pane-appearance）

## 実行したもの

すべて `/workspaces/web-tn-multiplexer`（WSL の Linux・Chromium）。**判定は終了コード**で行った
（`pnpm -s typecheck` は失敗時に無出力になるため、`pnpm run typecheck`〔`-s` 無し〕で出力を確認した。
`pnpm-silent-hides-failures` の教訓）。

- `pnpm exec vitest run`（全パッケージ）— **133 files / 2230 tests passed / 0 failed**
- `pnpm run typecheck`・`pnpm run lint`・`pnpm -s build` — いずれも exit 0
- E2E 一式（`packages/e2e`。`pnpm exec playwright test --workers=1`）— **1 回目 123 本中 4 本 failed
  （下記「失敗の証跡」参照。すべてこの work が原因の既存 spec の退行で、修正済み）、2 回目（直した後）
  **123 passed / 0 failed**（8.8 分）
- `aidev smoke` — **pass**（下記）

```
$ pnpm exec vitest run
 Test Files  133 passed (133)
      Tests  2230 passed (2230)
exit=0
```

```
$ pnpm exec playwright test --workers=1   （2回目・直した後）
  123 passed (8.8m)
exit=0
```

## 受け入れ基準ごとの判定

- AC1: pass — `TabBar.vue` の `position` prop・`order` スタイル（`TabBar.test.ts`・E2E「位置を『下』に変えると…」）
- AC2: pass — `tabBarVisible` computed（`TabBar.test.ts`・E2E「tab が1つなら隠す…」）
- AC3: pass — 右端エントリ 4 種・追加/削除/並び替え（`tabBarRight.test.ts`・`settings.test.ts`・
  `SettingsDialog.test.ts`・`TabBar.test.ts`・E2E）
- AC4: pass — 区切り文字（同上）
- AC5: pass — `paneBorders` の 3 値の解決（`PaneLayout.test.ts`・E2E「pane の枠…」）
- AC6: pass — `paneOuterBorders`（`App.test.ts`・E2E「pane 領域の外周…」）
- AC7: pass — `paneGaps`（`Splitter.test.ts`・E2E「pane 間の隙間…」）
- AC8: pass — `showAgentLabelsOnPaneBorders`・`paneNameOf` の優先順位（`PaneFrame.test.ts`・`PaneLayout.test.ts`・
  E2E「エージェント名表示…」）
- AC9: pass — 既定値は現状維持（2 点の意図的な例外を除く。decisions D7・`settings.test.ts`）
- AC10: pass — 保存・追従（`settings.test.ts`「storage イベントで追従する」・E2E「再読み込みでも保たれる」）
- AC11: pass — `docs/herdr-parity.md`（H22・H23）・`docs/verification.md` を更新
- AC12: pass（deliver で backlog を消し込む。T12）
- AC-I1〜AC-I5: pass — `SettingsDialog.test.ts`「キーボードだけで…」・E2E

## 失敗の証跡

**このラウンドでは、テストが落ちて coding へ差し戻す事態は起きていない**（各タスクの独立点検〔T1〜T10・
cross〕で見つかった指摘はすべてその場で直し、`review.md`「タスク点検ログ」に記録済み）。以下は
`regression-negative-control` に準じる**負の確認**（配線を壊す→落ちる→戻す→`diff`）の生出力。

### `store/settings.ts` の `return {...}` から 8 項目を外す（コンポーネントが参照できなくなる）

`packages/web/src/store/settings.ts` の `return` から 8 つの設定値（`tabBarPosition`〜
`showAgentLabelsOnPaneBorders`）を外して typecheck：

```
$ pnpm run typecheck
packages/web typecheck: src/App.vue(57,37): error TS2551: Property 'tabBarPosition' does not exist on type 'Store<...>'. Did you mean 'setTabBarPosition'?
packages/web typecheck: src/App.vue(58,78): error TS2551: Property 'paneOuterBorders' does not exist on type 'Store<...>'. Did you mean 'setPaneOuterBorders'?
packages/web typecheck: src/App.vue(68,35): error TS2551: Property 'showAgentLabelsOnPaneBorders' does not exist on type 'Store<...>'. Did you mean 'setShowAgentLabelsOnPaneBorders'?
packages/web typecheck: src/components/PaneLayout.vue(133,20): error TS2551: Property 'paneBorders' does not exist on type 'Store<...>'. Did you mean 'setPaneBorders'?
packages/web typecheck: src/components/PaneLayout.vue(208,4): error TS2379: Argument of type '{ ...; bordered: boolean | undefined; ... }' is not assignable ...
packages/web typecheck: src/components/SettingsDialog.test.ts(744,36): error TS2551: Property 'tabBarPosition' does not exist ...
（以下、SettingsDialog.test.ts・SettingsDialog.vue にわたって計 25 箇所のエラー。先頭のみ抜粋）
exit=2
```

（戻したあと `diff /tmp/settings.ts.bak packages/web/src/store/settings.ts` で完全一致（"RESTORE OK: identical"）、
typecheck exit 0 を確認）

**この負の確認では、意図した変異で落ちることを確認した**（生出力のとおり）。加えて、coding 中の各タスクの
独立点検（T1・T3・T6・T8・T9。`review.md`「タスク点検ログ」参照）でも、点検エージェントがそれぞれの
タスクの差分単位で同様の変異確認（`multiPane`/`showLabel` の配線・`paneGaps` の store 直読み・`position` の
`order` 等）を行い、いずれも意図した変異で確実に落ち、`cp`/`diff` で原本への完全復元を確認している。

### E2E 一式 1 回目：既存 3 spec（4 本）を退行させていた（decisions D8）

各タスクの独立点検・T10 の taskcheck ではこの work 用の新規 spec だけを走らせており、既存 spec への影響を
見ていなかった。test 工程で初めて一式を走らせたところ、新規 spec は 0 件・**既存 spec が 4 本 failed**：

```
$ pnpm exec playwright test --workers=1   （1回目）
  1) src/specs/settings.spec.ts:187:1 › 設定：別のブラウザ（別のプロファイル）では、設定は既定のまま（AC15）
    Error: locator.click: Error: strict mode violation: locator('dialog.settings-dialog').locator('section[aria-labelledby="settings-display"] [role="switch"]') resolved to 5 elements

  2) src/specs/settings.spec.ts:211:1 › 設定：何も設定しない利用者に記号が出る。…（AC5〜AC8）
    Error: locator.click: Error: strict mode violation: …resolved to 5 elements（同じセレクタ）

  3) src/specs/settings.spec.ts:273:1 › 設定：キーだけで端末の節のラジオへ入り、矢印で選べる（AC-I3）
    Error: Tab で入ると、選ばれている行（既定の「自動」）にフォーカスが来る
    expect(locator).toBeFocused() failed
    Received: "inactive"

  4) src/specs/theme-settings.spec.ts:175:1 › キーだけでテーマを選ぶと…
    Error: expect(locator).toBeEnabled() failed
    Error: strict mode violation: locator('dialog.settings-dialog').locator('input.settings-path') resolved to 2 elements

  4 failed
  119 passed (9.6m)
exit=1
```

原因と直し方は decisions D8 のとおり（節「表示」の switch が 1→5 個に増えたことによる strict mode 違反 2 件・
Tab の上限超過 1 件・`.settings-path` クラスの共有による strict mode 違反 1 件）。3 箇所を直し、
`settings.spec.ts`・`theme-settings.spec.ts` を単独で再実行して 19/19 pass を確認したあと、一式を再実行した
（下記「実行したもの」の 2 回目）。

## 起動確認（smoke）

```
$ aidev smoke
smoke: 20260922-tabbar-pane-appearance
$ pnpm -s build && pnpm -s smoke
smoke: starting server on 127.0.0.1:45059 (state dir /tmp/wtm-smoke-MOC8zX)
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
smoke: pass (exit 0)
```

この work は新しい入口（サブコマンド・オプション・API）を足していない（web の画面だけ。サーバ・protocol は
無変更）ので、`smokeCommands` への追加は無し。

## 未検証の穴（skip / 環境不足）

自動のテストは **Linux の Chromium だけ**。次は実機・別ブラウザで確かめていない。
- **Firefox・Safari・macOS・Windows**：この work は既存の `<select>`・`<input type="text">`・
  `<fieldset>`・ネイティブの `<dialog>` の組み合わせのみで、20260921-theme-settings・
  20260921-keybinding-customization・20260922-theme-custom-overrides が既に洗い出した環境差
  （ブラウザが描く入力欄の見た目等）と同じ範囲に留まる。個別の新しい環境差は増えていない、という判断で、
  実機の確認はしていない。
- IME・実機のモバイル（iOS Safari・Android Chrome）は確認していない（この work はデスクトップの設定画面が
  対象で、モバイルの表示に影響する変更は無い）。
