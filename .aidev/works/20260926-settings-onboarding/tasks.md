# タスク: 設定の onboarding（初回の案内。H25b）

## 実装方針

design の「対象範囲」を、判定（純粋関数とストア）→ ダイアログ → 設定画面からの開き直し → docs の順に組み立てる。コードを変える各タスクで回帰テスト
（vitest）を足し、足した箇所を 1 つずつ壊して落ちることを確かめる（`.aidev/conventions/regression-negative-control.md`）。

## 作業順序と依存関係

- 下の `依存:` に従う。判定（T1）を先に固めるのは、起動の配線（T2 の開く時機）と既存の利用者の互換（AC2・AC11）がここに乗るため。

## リスク / 留意点

- happy-dom は `<dialog>` の inert・閉じたときのフォーカスの戻りを再現しない見込み（research「実現性 / リスク」）。テストで確かめるのは
  `showModal` の呼び出し・`document.activeElement`（開いたとき）・`view` の状態まで。残りは test-result の「未検証の穴」へ。
- 既存の定数の export 化（`PREFS_KEY`・キー一覧の案内のキー・既読のキー）は値を変えない。既存のテストを全部流して確かめる。
- 並行する work（`packages/cli`）とファイルは重ならない。

## テスト方針

- `store/onboarding.test.ts`: `isFreshBrowser` の各分岐（痕跡ごと・空オブジェクト・壊れた JSON・配列・throw・null）、`markDone`。
- `components/OnboardingDialog.test.ts`: 起動時に開く／開かない、確定の反映（テーマ・プリセット・通知・OS 通知の許可）、スキップ・Esc で
  反映しない、背景クリックで閉じない、フォーカス、キーの表記（現在の割り当て・割り当てなし）、モバイル、OS 通知の案内の消費。
- `components/SettingsDialog.test.ts`: ［はじめの案内を開く］。
- 全体: `pnpm -s build` → `pnpm -s typecheck` → `pnpm -s test`（2 回）・`aidev smoke`。E2E は走らせない。

## タスク

- [x] T1: 既存の利用者の判定と案内済みの記録（`isFreshBrowser`・`useOnboardingStore`）を足し、痕跡のキーの定数を export して
      `Toast.vue` をそれに寄せ、`main.ts` で接続より前にストアを作る
      対象: `packages/web/src/store/onboarding.ts`（新規）・`packages/web/src/store/view.ts:47` `PREFS_KEY`・`packages/web/src/store/seen.ts:5`
      `STORAGE_KEY`・`packages/web/src/components/Toast.vue:14` `HINT_STORAGE_KEY`・`packages/web/src/main.ts:171-180` / 根拠: research A5
      依存: なし
      AC: AC1, AC2, AC5, AC8, AC11
- [x] T2: 案内のダイアログの骨組み（`OnboardingDialog.vue`）を足し、`DialogContext` に種類を足し、`App.vue` に置く。起動時に開く watch、
      スキップ・Esc（反映せず案内済み）・背景クリックで閉じない・開いたら見出しへフォーカス・閉じたら `closeDialog`
      対象: `packages/web/src/components/OnboardingDialog.vue`（新規）・`packages/web/src/store/view.ts:168-211` `DialogContext`・
      `packages/web/src/App.vue:81-92` / 根拠: research A1〜A4・A8
      依存: T1
      AC: AC1, AC4, AC5, AC-I1, AC-I3, AC-I4, AC-I5
- [x] T3: 案内の選択（テーマ・キーのプリセット・通知）と確定の反映。OS 通知の許可、`NotificationController.markHintAnswered`
      対象: `packages/web/src/components/OnboardingDialog.vue`・`packages/web/src/notify/NotificationController.ts:361-367` `#consumeHint` / 根拠: research A6・A7
      依存: T2
      AC: AC3, AC9, AC-I2
- [x] T4: 案内の説明文（主要な操作の入口を現在の割り当てで表記、割り当てなしの代わりの経路）と、モバイルでの出し分け・寸法
      対象: `packages/web/src/components/OnboardingDialog.vue` / 根拠: design「中身（上から）」
      依存: T3
      AC: AC7, AC10
- [x] T5: 設定画面に［はじめの案内を開く］を足す
      対象: `packages/web/src/components/SettingsDialog.vue:905-912`（`KeySettings` の後・`.settings-hint` の前） / 根拠: research F14
      依存: T2
      AC: AC6
- [x] T6: `docs/herdr-parity.md` の H25b 行と `docs/verification.md` を更新する（コードを変えないので回帰テストは無い）
      対象: `docs/herdr-parity.md:51`・`docs/verification.md:84-`（テーマの説明の近く）と Linux の確認手順（`:167-` の並び）
      依存: T4, T5
      AC: AC12
- [x] T7: 自動操作されているブラウザ（`navigator.webdriver`）では起動時の案内を出さず、起動確認で本物のブラウザの案内（開く・見出しへのフォーカス・Esc で端末へフォーカスが戻る・案内済みの保存・開き直しで出ない）を確かめる（test ラウンド 1 の差し戻し。decisions D11）
      対象: `packages/web/src/store/onboarding.ts` `useOnboardingStore`・`packages/server/src/smoke.ts` `checkWebUiRendersAndAcceptsInput` の後 / 根拠: test-result.md「失敗の証跡」
      依存: T2
      AC: AC1, AC11, AC-I4
- [x] T8: review ラウンド 1 の指摘を直す——置き直されたときに開いている案内を描き直す（`dialogContext` の watch を immediate）、OS 通知の答えが拒否か閉じただけかで文を分ける、テストの `SettingsDialog.vue` を静的に import する、起動確認の「再読み込みのあと出ない」を端末（または案内）のフォーカスの印を待ってから数える
      対象: `packages/web/src/components/OnboardingDialog.vue`・`packages/web/src/components/OnboardingDialog.test.ts`・`packages/server/src/smoke.ts` / 根拠: review.md「ラウンド 1」
      依存: T7
      AC: AC5, AC9, AC-I1, AC-I5
