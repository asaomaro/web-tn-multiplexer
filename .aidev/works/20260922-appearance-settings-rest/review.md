# レビュー: 外観と設定の残り（サイドバー行・tab バー・pane 枠・設定の再読み込み）

## タスクをまたぐ不変条件の点検（cross）

指摘無し（`CHECK: ok`）。確認内容: reload_config が T1/T3 で新設した全ての永続設定
（`workspaceSort`・`paneFrameThickness`・`paneAgentNameVisible`）を漏れなく読み直している／
T3⇔T4・T5・T7 間・T1⇔T2・T7 間でキー名・型・既定値が一致している／D2（workspace 並び順トグルは
`Sidebar.vue` 自身。`SettingsDialog.vue` に二重実装なし）・D8（`PaneLayout.vue` の
`ResizeObserver`→`ViewSync.commit` の仕組みと T8 の E2E の想定が一致）・D9/D10（`TabBar.vue` に
両方とも矛盾なく反映）を実物のソースで確認／`bindings.ts` の `reload_config` の重複無し検査が
既存テストに含まれる／`KeySettings.test.ts` の「35個」が実際の `ACTIONS` 件数と一致。
`aidev coverage`：`ac=21 design=21/21(100%) tasks=21/21(100%) gaps=0`（`ac_none=1` は T3 の
想定どおり）。`pnpm -s typecheck`・`pnpm -s lint`・`vitest run`（77ファイル1504件）・E2E
（`appearance-settings.spec.ts` 6件）いずれも green。

## タスク点検ログ

- T1（`view.ts` の `workspaceSort`）: 0 件。
- T3（`settings.ts` の `paneFrameThickness`・`paneAgentNameVisible`）: 2 件（nit 2）。
  `PANE_FRAME_THICKNESSES`（許容値チェック用の配列）が `PANE_FRAME_THICKNESS_PX` と同じキー
  集合を別々にハードコードしていた点は、`Object.keys(PANE_FRAME_THICKNESS_PX)` から導く形に
  直した。`statusSymbols`/`newCwdPolicy` が持つ「壊れた保存値でも既定で起動する」store 統合
  テストが `paneFrameThickness`/`paneAgentNameVisible` に無かった点は、同型のテストを追加した。
- T2（`Sidebar.vue` の spaces 区画の並び順）: taskcheck 実施中に実装側で発見・自己修正した点
  （taskcheck の指摘としては未計上）：新しい並び順ボタンに既存の agents 区画と同じ CSS クラス
  （`.sidebar-sort-btn`。スタイルの使い回しのため意図的）を付けたところ、既存の
  `Sidebar.test.ts` のテストがクラスセレクタで最初の1つ（spaces 側）を拾ってしまい落ちることに
  気づいた。既存テストのセレクタを `.sidebar-agents .sidebar-sort-btn` に絞って直し、新しい
  spaces 側の同種のテストは `.sidebar-spaces .sidebar-sort-btn` で区別した。
- T5（`SettingsDialog.vue` の pane 設定 UI）: 2 件（should 1・nit 1）。新規テストの
  `agentNameSwitch` ヘルパーが「表示の節の中の switch の**末尾**（何番目か）」という位置依存の
  選び方をしており、将来 switch が増える・並びが変わると無言で違うボタンを拾う脆さがあった
  （この節の switch は今回まさに 1→2 に増えた実績がある）。ボタンの文言（「エージェント名」を
  含むか）で絞る形に直した。あわせて、直前のコメントに残っていた無関係な参照
  （「Sidebar.vue の後」という文脈違いの一節。コピペの残骸）も削除した。
- T4（`PaneFrame.vue`・`Splitter.vue`・`App.vue`）: 1 件（**must**）。`.pane-frame-name`
  （エージェント名の可視ラベル。AC11）を `.pane-frame-edge` の**中**（DOM 順で `.pane-frame-body`
  〔端末〕より前）に置いていたため、`z-index:auto` の重なり順（DOM 順で後のものが上）により
  端末の不透明な内容の**下に完全に隠れ**、実際には一切見えていなかった。taskcheck が実際に
  Playwright でスクリーンショットを撮って発見（jsdom の単体テストは DOM の有無・属性しか見ない
  ため検知できなかった）。`.pane-frame-name` を `.pane-frame-body` より**後**の兄弟要素へ移し、
  自分でも同じ手法（孤立させた HTML+CSS の実物をスクリーンショットで確認）で修正後は実際に
  端末の上に見えることを確認した。
- T6（`TabBar.vue` の自動非表示・フォーカス退避・現在時刻）: 2 件（should 1・nit 1）。
  should: `v-if`/`visible` の条件式が design.md・tasks.md の明記（`tabs.length > 1`）と実装
  （`tabs.length !== 1`）で食い違っており、decisions.md に記録が無かった。0個のときに表示を
  維持する（＋ ボタンの導線を保つ）実装自体は既存テスト・AC4 の文言と整合しており正しいと
  判断し、コードは変更せず [[D10]] としてこの乖離と判断根拠を decisions.md に追記した。
  nit: 新規テスト「0個・1個では非表示、2個以上で表示に戻る（AC4・AC5）」のタイトルが、
  実際のアサーション（0個は表示を維持）と逆に読めた。タイトルを
  「0個では表示（＋の導線）・1個では非表示、2個以上で表示に戻る（AC4・AC5）」に修正した。
  taskcheck は他にミューテーションテスト（`watch`→`onBeforeUnmount` に戻す／`clearInterval`
  呼び出しを削る／条件式を `> 1` に変える）で新規4テストの実効性を確認済み（D9 の主張の
  実証も兼ねた）。
- T7（`reload_config`。`actions.ts`/`bindings.ts`/`keymap.ts`/`ActionDispatcher.ts`/
  `view.ts`/regression 修正一式）: 1 件（should）。`reloadConfig()` が `readPrefs()` を
  実質2回呼んでいた（`const raw = readPrefs()` の後、`loadAgentSort()` が自己完結型
  〔decisions D7〕のため内部でもう一度 `readPrefs()` を呼んでいた）。`loadAgentSort` に
  任意の `raw` 引数を足し（省略時は今までどおり自分で `readPrefs()` を呼ぶので store 初期化側の
  呼び出しは無変更）、`reloadConfig()` からは既に読んだ `raw` を渡す形に直した。
  taskcheck はミューテーションテストで、`ActionDispatcher.test.ts` の新規3テストの実効性
  （`paneFrameThickness`/`workspaceSort`/`toast`/`statusSymbols` の代入を1つずつ削って
  落ちることを確認）と、`bindings.ts` の `reload_config` エントリを丸ごと戻す変異で
  regression 修正した5ファイル計11テストが正しく落ちることを確認済み。
- T8（E2E。`packages/e2e/src/specs/appearance-settings.spec.ts` 新規）: 1 件（should
  [conv:e2e-observe-browser]）。pane の枠・隙間の太さのテストが、decisions.md D8「影響」節の
  「実際にパネルのリサイズ要求が飛ぶこと（または少なくともクラッシュ・エラーが起きないこと）」の
  確認を欠いていた。`ViewSync.commit()` は測った cols/rows が変わらなければ `client.view` 自体を
  送らない（cell 境界を跨ぐかは px の実測次第で決定的でない）ため、D8 が許す「または」の側
  （クラッシュ・エラーが起きないこと）を軸に据え、`page.on("pageerror", ...)` で捕まらなかった
  例外を監視しつつ、太さを2回変えた後も端末が機能し続ける（実際に入力が届き出力が返る）ことまで
  確認するよう追加した。最初は `console` の error レベルも見ていたが、この操作と無関係な既存の
  雑音（CSP の既定の説明・トークン付与前の 401）まで拾って誤って落ちたため、`pageerror`
  （捕まらなかった例外）だけに絞った。
  taskcheck は他に、`.tab-bar-new` の `@keydown.stop` を踏まえた AC-I6 テストの妥当性・
  radio group の roving tabindex を踏まえた Tab/矢印キー操作・D2 の置き場所（Sidebar 自身）・
  `.toast`（`role="status"` ではない）判定の正しさ・E2E 対象外とした AC の unit test 実在
  （AC3, AC8, AC-I1, AC-I2, AC-I5）を確認済み。ミューテーションテスト
  （`TabBar.vue` の条件式・`Sidebar.vue` のソート分岐）で新規テストの検知力も確認済み
  （前者は `visible` 変数とテンプレートの `v-if` が同じ式を2箇所複製している構造のため
  単独の変異では検出できなかったが、テンプレート側を反転する変異では正しく検出——
  spec 自体の検出力に問題は無い）。

## レビュー ラウンド1

- **要件適合**: `aidev coverage` は `ac=21 design=21/21 tasks=21/21 gaps=0`（tasks 承認時と同じ被覆。
  乖離なし）。AC の各 ID がどのタスクで実装され、どの unit test で検証されているかは
  test-result.md「受け入れ基準ごとの判定」に整理済み。
- **価値適合**: requirements.md「目的 / ゴール」（workspace 行の並び・tab バーの自動非表示と
  時刻・pane 枠とエージェント名表示・設定の読み直しを1操作で反映できる状態）に対し、US1〜US5
  それぞれの実装（T1/T2, T6, T3/T4/T5, T7）が対応しており、価値に届いていると判断した。
- **正確性・規約適合・保守性**: T1〜T8・cross の taskcheck（本ページ上部「タスク点検ログ」・
  「タスクをまたぐ不変条件の点検」参照）で既に厚く点検済み（must 1・should 6・nit 2、全て解消
  済み）。この観点はそちらで担保されているため、このラウンドでは再掲しない。
- **test 工程で見つけた E2E の回帰への対応の点検**（taskcheck の対象外だった差分）:
  test 工程でフル E2E を回した際に見つかった、この work の UI 変更（tab バー自動非表示・spaces の
  並び順ボタン・表示の節の switch 追加）による既存 spec 6 ファイルの回帰修正（詳細は
  test-result.md「E2E について」）を diff で読み直した。いずれも `.tab-bar-item` の count を
  「tab 数」として使っていた箇所を実際の tab 数へ補正する／曖昧になったセレクタを区画・文言で
  絞る／`waitForEvent` の「述語なしは直前の1件を即返す」仕様を踏まえて述語を足す、という
  一貫した対症で、`e2e-observe-browser.md`（判定は DOM・実際のフレームで行う）に沿っている。
  must/should の指摘なし（nit も無し）。
- **未解決の指摘なし**。差し戻しは無い。

判定: 指摘なし（must 0・should 0・nit 0、このラウンド）。次工程 deliver へ進む。
