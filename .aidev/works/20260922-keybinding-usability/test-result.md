# テスト結果: キーの設定の使い勝手

## ラウンド2（review の must 指摘・D7の修正後）
review 工程で見つかった「こちらへ移す」ボタンが画面外に取り残される不具合（decisions D7・
review.md ラウンド1）を直した後の再確認。この修正は `KeySettings.vue`（CSS/テンプレート）と
その E2E spec だけに閉じるため、対象 spec のみ再実行した（全 spec の再実行は
`.aidev/conventions/e2e-affected-specs-only.md` の運用どおり、deliver 直前に 1 回で足りる。
ラウンド1で既に実施・記録済み）。

- `pnpm -s typecheck` — exit 0
- `pnpm exec playwright test src/specs/key-bindings.spec.ts`（新規テスト1本を含め **20 passed**）
- `aidev smoke` — PASS（exit 0）
- 新規テスト（「こちらへ移す」ボタンがダイアログの可視領域内に収まる）は、修正前の状態に戻す
  変異で実際に落ちることを確認済み（`Received: 1908.5` に対し期待 `<= 713`。review.md 参照）
- `packages/web` の `pnpm exec vitest run` は未再実行（この修正はスタイル/DOM 構造のみで、
  ロジック側の単体テストへは影響しない。ラウンド1の1505件 pass を維持）

## ラウンド1

## 実行したもの
- `pnpm -s typecheck`（ルート） — exit 0
- `packages/web`: `pnpm exec vitest run` — 79 files / **1505 passed** / 0 failed
- `packages/e2e`: `pnpm exec playwright test src/specs/key-bindings.spec.ts`（この work の対象 spec） — **19 passed** / 0 failed（`.aidev/conventions/e2e-affected-specs-only.md` 相当の運用どおり、coding〜test の途中は対象 spec だけを繰り返し実行）
- `packages/e2e`: `pnpm exec playwright test`（全 spec、deliver 直前の 1 回。`workers: 1`） — **121 tests**、後述のとおり判定
- `aidev smoke` — PASS（exit 0）
- `aidev coverage --strict` — `coverage-gaps: struct=0 cover=0`（AC1〜AC14・AC-I1〜AC-I12 すべて design/tasks に閉じている）

## 受け入れ基準ごとの判定
- AC1〜AC3（絞り込み。US1）: pass — `key-bindings.spec.ts` の絞り込みテスト（DOM の `.keys-details`/`.keys-group` 数で判定。AC-I3 の Tab 到達も実際に Tab で確認）。
- AC4〜AC7（こちらへ移す。US2）: pass — `assign.test.ts`（`conflict` の構造化。範囲の操作との衝突では `conflict` を付けない）・`KeySettings.test.ts`（「こちらへ移す」の一連。AC-I6〜AC-I10）・E2E（AC-I8 の Tab+Enter 到達を含む）。
- AC8〜AC10（macOS の Option chord 表示補正。US3）: pass — `chordDisplay.test.ts`（純粋関数の変換ロジック）・`KeySettings.test.ts`（`onMounted`/`displayFor` 経由。cross 点検で見つかった prefix 行・chip の `aria-label` の取りこぼしを直した後の回帰テストを含む）。E2E では isMacPlatform() が false になる Linux 環境の性質上、mac 分岐そのものを踏まないので「今までどおりの表示」側（AC9）だけを確認。
- AC11（Keyboard Lock の switch。US4）: pass — `store/settings.test.ts`（既定値・保存）・`KeySettings.test.ts`（switch の表示・切り替え）。
- AC12・AC13（全画面での実際の `lock()`/`unlock()`）: pass（呼び出しの発生自体） — `KeyboardLockController.test.ts`（`fullscreenchange` イベント・`watch` 経由での呼び出しをモックで確認）に加え、cross 点検の指摘を受けて **E2E でも実際に `document.documentElement.requestFullscreen()` へ入り `navigator.keyboard.lock()` が `LOCKED_CODES` で呼ばれ、抜けると `unlock()` が呼ばれることを実ブラウザで確認**（`key-bindings.spec.ts` の新規テスト。decisions D6）。**ただし「OS・ブラウザの予約キーが実際にページへ渡るようになるか」という効果自体は Playwright から観測できないため、この work の自動テストの対象外**（`docs/verification.md` の手動確認へ。deliver 時に追記）。
- AC14（API が無い・失敗する環境での安全性）: pass — `KeyboardLockController.test.ts`（`keyboard: null`・`lock()` の reject を `.catch()` する経路。reject の検証は「戻り値の `.catch` を差し替えて呼び出し回数を数える」手法で確立。詳細は review.md T4 参照）に加え、E2E でも `navigator.keyboard` を実地で `undefined` に差し替えて（`main.ts` の `navigator.keyboard ?? null` の配線ごと）例外なく動くことを確認。
- AC-I1〜AC-I12: pass（上記に含む。AC-I3・AC-I8 は cross 点検・T8 点検の指摘を受けて E2E でも実際の Tab 操作で確認するよう修正済み）。

## 失敗の証跡

### 対象 spec（`key-bindings.spec.ts`）
coding〜test を通じて失敗した実行は最終的に残っていない（taskcheck・cross 点検の過程で見つかった指摘はすべて review.md に記録し、直してから green を確認済み）。

### 全 spec 実行（deliver 直前の 1 回）
1 回目の全体実行（121 tests、`workers: 1`、25.9 分）で、この work と無関係な 3 つの spec で失敗が出た：

```
  3 failed
    src/specs/mobile.spec.ts:77:1 › 表示する pane を切り替えても、隠れた pane の PTY の大きさは変わらず、client.view にも載らない（D105）
    src/specs/new-terminal-cwd.spec.ts:128:1 › ホーム・サーバを起動した場所・指定した場所を選ぶと、そこで開く（AC6〜AC8）
    src/specs/notifications.spec.ts:243:1 › 通知：見ている pane では何も出ない（AC3 の (c)）
  118 passed (25.9m)
```

いずれもこの work の差分（`packages/web/src/{keys,store,components,main.ts}`・`packages/e2e/src/specs/key-bindings.spec.ts`）と無関係なファイルで、エラーの中身も PTY のサイズのずれ（`rows: 41` 期待 → `37`）・shell の応答待ちのタイムアウト（10s）・WebSocket イベント待ちのタイムアウト、といずれも**負荷下のタイミング競合の典型**。以下の手順で「この work の変更が原因ではない」ことを実地に確かめた。

1. 同じ 3 spec だけを単独で再実行 → 2 回とも同じ 3 件が失敗（`mobile.spec.ts:77`・`new-terminal-cwd.spec.ts:128`・`notifications.spec.ts:243`。再現性あり）。
2. **この work の変更を一切含まない状態**で切り分けるため、`git worktree add <scratchpad>/base-check main` で `main`（＝このブランチが分岐した地点そのもの。`git merge-base HEAD main` が `HEAD` と一致）のクリーンな worktree を作り、`pnpm install && pnpm -s build` してから同じ 3 spec を実行 → **`mobile.spec.ts:18`（AC12。3 で失敗した `:77` とは別のテスト）と `notifications.spec.ts:243` が失敗**（`new-terminal-cwd.spec.ts:128` はこの回は通った）。
3. 3 回の実行で失敗した個体（`mobile.spec.ts` の `:18` と `:77`・`new-terminal-cwd.spec.ts` の `:128`）が回ごとに入れ替わり、**`notifications.spec.ts:243` だけは 3 回とも失敗**——**この work の変更が一切無い `main` そのものでも再現する**ことから、この 3 件は**この work 由来の回帰ではなく、この検証環境固有の負荷依存の flaky**と判断した。
4. worktree は `git worktree remove --force` で撤去し、`packages/web` を再ビルドして `key-bindings.spec.ts` を単独でもう一度実行 → **19 件全部 pass**（この work の対象範囲に限れば安定して green）。

## 起動確認（smoke）

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
smoke(web): tab title ok ("OSK2-024680-2: smoke"。H14/AC4）
smoke(web): typed into pane p2
smoke(web): echo round trip ok（ブラウザでの入力が PTY まで届いた）
smoke: PASS
smoke: pass (exit 0)
```

## 未検証の穴（skip / 環境不足）
- **AC12・AC13の「OS・ブラウザの予約キーが実際にページへ渡るようになるか」という効果自体**：この検証環境（Linux headless Chromium）で `navigator.keyboard.lock()` の呼び出し自体は実地に確認できたが（上記）、その結果として実際に `Ctrl+T` 等のブラウザ予約キーがページへ届くようになるかは、Playwright から観測する手立てが無い（`e2e-observe-browser.md` が言う「代わりに観測したもの」を作れない）。**実際に効いているかは `docs/verification.md` の手動確認（Chromium 系ブラウザでの実機確認）へ回す**（decisions D6）。
- **AC8（macOS の Option chord 表示補正）の実機確認**：`chordDisplay.ts`・`onMounted` のロジック自体はテストで確認済みだが、**実際の macOS・非 US 配列のキーボードでの見え方**はこの検証環境（Linux）では確認できない。`docs/verification.md` の手動確認へ回す。
- 上記2点は deliver 時に `docs/verification.md` へ手動確認項目として追記する（decisions D6・D3 に理由を記録済み）。
- 全 spec 実行での 3 件の flaky（`mobile.spec.ts:18/:77`・`new-terminal-cwd.spec.ts:128`・`notifications.spec.ts:243`）は、この work の対象外（既存の別 work の範囲）。この work の変更由来でないことは上記の手順で確認済みだが、環境の負荷依存という性質上、次にこの全体実行をする人のために記録を残す（対処はこの work のスコープ外）。
