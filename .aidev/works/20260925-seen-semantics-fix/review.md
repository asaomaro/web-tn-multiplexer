# レビュー: 既読（wtm.seen.v1）の意味論を直す

## タスク点検ログ

- [nit][conv:-] T3（`TerminalPane.test.ts`）: 新規3件が `vi.spyOn(document, "hasFocus")` を
  貼るだけで `.mockRestore()` を呼んでいなかった。同じ「共有オブジェクトへの spy」を扱う
  既存テスト（`Sidebar.test.ts`・`PaneFrame.test.ts`・`LoginView.test.ts`・`TabBar.test.ts`）
  は一貫して `.mockRestore()` している。 / 対応: 3件とも spy を変数に受け、
  `wrapper.unmount()` の後に `.mockRestore()` を呼ぶ形に直した。 / src: T3 taskcheck round1

T1・T2 は findings 0 で通過。

## レビュー ラウンド1

要件適合・価値適合・正確性・規約適合・保守性の5観点を確認した（タスク点検ログに記録済みの
指摘は再掲しない）。must は無し。should 2件・nit 4件。

- [should][conv:regression-negative-control] T1（`sweepMarkSeen`）は不具合修正の中核
  （「フォーカスがあれば全 pane を既読にする」という旧来のバグパターンを直接置き換える
  関数）にもかかわらず、負の確認が生ログ付きで記録されていなかった。 / 対応:
  `isVisible(pane.id)` を旧来のバグパターンに一時的に戻し、`seen.test.ts` の4件中2件が
  実際に失敗することを確認、生ログを test-result.md に記録した（decisions.md D1）。
- [should][conv:-] `main.ts` の配線（`nextTick()` ラップ・`watch`/`focus` イベントの登録）に
  自動テストが一切無い（design.md「リスク / 留意点」に既に明記済みの既知の制約）。
  将来同種の配線バグが起きたときのために記録しておく価値がある。 / 対応: この work の
  スコープでは追加の抽出は行わない（過剰な抽象化になる）。decisions.md D2 に記録した。
- [nit][conv:-] AC4 の検証が実配線ではなく `sweepMarkSeen` 単体を叩くテストで代替されている
  （`main.ts` が単体テストできないための既知の制約。test-result.md に既に明記済み）。
  対応不要（確認のみ）。
- [nit][conv:-] `nextTick()` の挿入により、表示中+フォーカスありの pane が完了した瞬間、
  理論上1 tick だけ `displayStateFor` が `"done"` を返しうる。design の既定どおりの意図的な
  代償で実害は無いと判断し、対応は見送る（decisions.md D2）。
- [nit][conv:-] `sweepMarkSeen`（掃引）と `TerminalPane.vue`（1 pane の直接判定）の2箇所に
  「呼び出し方」が分かれている点について、将来3つ目の発火点が必要になったときも
  `shouldMarkSeen` を経由させることをコメントで残すとよい。 / 対応: `shouldMarkSeen` の
  docstring に追記した（decisions.md D2）。
- [nit][conv:-] AC1/AC2/AC4 が `sweepMarkSeen` 単体テストで裏付けられている点、
  `NotificationController` との論理的な対関係（`shouldQueue` が `shouldMarkSeen` の否定に
  一致）が確認された点は、いずれも「問題なし」の確認（対応不要）。

新たな must の指摘なし。全て解消済み。
