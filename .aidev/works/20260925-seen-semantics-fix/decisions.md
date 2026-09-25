# 決定記録

## D1: review round1 の should（regression-negative-control）への対応——`sweepMarkSeen`
   の負の確認を実施・記録する

- 背景: review round1 で、T1（`store/seen.ts` の `sweepMarkSeen`）が不具合修正の中核
  （「フォーカスがあれば全 pane を既読にする」という旧来のバグパターンを直接置き換える
  関数）であるにもかかわらず、負の確認（規約 `.aidev/conventions/
  regression-negative-control.md`）が生ログ付きで記録されていない、という指摘があった。
  T3（`TerminalPane.vue`）の負の確認は実施・記録済みだったが、T1 側が漏れていた。
- 決定: `sweepMarkSeen` の `isVisible(pane.id)` を一時的に `true`（旧来のバグと同じ
  「表示を見ずにフォーカスだけで判定する」形）に戻し、`seen.test.ts`「sweepMarkSeen」の
  4件中2件（表示中/非表示の混在を検証する2件）が実際に失敗することを確認した。修正を
  戻すと15件全て pass に戻ることも確認した。生ログは test-result.md に追記する。
- 理由 / 代替案: T2（`main.ts`）は export を持たず単体テストできないため対象外のままとする
  （design.md「リスク / 留意点」で既に明記済みの既知の制約。review もこれは妥当と評価
  している）。
- 影響: `packages/web/src/store/seen.ts` への一時的な変更（確認後に元に戻した。最終的な
  diff には影響なし）。`test-result.md` に生ログを追記。

### 負の確認の生ログ

```
FAIL  src/store/seen.test.ts > sweepMarkSeen > 表示中かつウィンドウにフォーカスがある pane だけ既読になる
AssertionError: expected [ [ 'a1', 3 ], [ 'a2', 5 ] ] to deeply equal [ [ 'a1', 3 ] ]

FAIL  src/store/seen.test.ts > sweepMarkSeen > 複数 pane をそれぞれ独立に判定する（表示中と非表示が混在）
AssertionError: expected [ [ 'a1', 1 ], [ 'a2', 2 ], [ 'a3', 3 ] ] to deeply equal [ [ 'a1', 1 ], [ 'a3', 3 ] ]

Test Files  1 failed (1)
     Tests  2 failed | 2 passed | 11 skipped (15)
```

修正（`isVisible(pane.id)` を実際に見る形）を戻すと `seen.test.ts` 全15件とも pass。

## D2: review round1 の should（保守性）・nit への対応

- **`main.ts` の配線に自動テストが無いことの記録**（should）: design.md「リスク / 留意点」に
  既に「T2 は export が無く単体テストできない」と明記済みで、review もこれを許容できる
  既知の制約と評価した——追加の抽出（配線関数化）はこの work のスコープでは行わない
  （過剰な抽象化になる。将来同種の配線バグが起きた場合の参考として、この decisions.md に
  記録しておく）。
- **`shouldMarkSeen` を将来の発火点も必ず経由させる旨のコメント**（nit）: `store/seen.ts`
  の `shouldMarkSeen` の docstring に、新しい発火点を足すときもここを経由すること、を
  追記した。
- **`nextTick()` 挿入による1 tick 分の表示の揺れ**（nit）: 表示中+フォーカスありの pane が
  完了した瞬間、理論上1 tick だけ `displayStateFor` が `"done"` を返しうる（直後に既読が
  反映され `"idle"` に戻る）。`TerminalRegistry.isVisible` の契約を守るための意図的な
  代償で、実害は無いと判断し、対応は見送る（design の既存の記述どおり）。
- **AC4 のテストが実配線ではなく `sweepMarkSeen` 単体を叩いている点**（nit）: `main.ts` が
  単体テストできないという既知の制約による代替手段で、test-result.md「未検証の穴」に
  既に明記済み。対応不要（確認のみの指摘）。
- 影響: `packages/web/src/store/seen.ts`（docstring のみ）。
