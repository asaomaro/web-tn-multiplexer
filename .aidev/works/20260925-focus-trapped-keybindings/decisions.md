# 決定記録

## D0: 単体テストは `click` の実発火ではなく `ev.defaultPrevented` を確認する
   （happy-dom がネイティブなボタン活性化を再現しないため）

- 背景: design 段階で「ブラウザの標準動作（`<button>` 要素は Enter/Space で `click` を
  発火する）」の出所を doccheck に問われ、実機確認しようとしたところ、このセッションの
  テスト実行環境（`packages/web/vitest.config.ts` の `environment: "happy-dom"`）では、
  合成 `KeyboardEvent`（`dispatchEvent`）からのネイティブなボタン活性化が**再現されない**
  ことが分かった。
- 実機確認の生ログ（`packages/web/src/__scratch_native_button.test.ts` に一時的に置いて
  実行。確認後は削除済み——デリバラブルではない）:
  ```
  FAIL  src/__scratch_native_button.test.ts > native <button> keyboard activation (happy-dom) > Enter keydown fires a native click without JS calling .click()
  AssertionError: expected false to be true // Object.is equality
  - Expected: true
  + Received: false

  FAIL  src/__scratch_native_button.test.ts > native <button> keyboard activation (happy-dom) > stopPropagation() on keydown does not prevent the native click
  AssertionError: expected false to be true // Object.is equality
  - Expected: true
  + Received: false

   Test Files  1 failed (1)
        Tests  2 failed | 1 passed (3)
  ```
  （3件目「`preventDefault()` on keydown DOES suppress the native click」は pass したが、
  そもそも1件目の時点で `click` が一度も発火していないため、この pass は「妨げているから
  false」ではなく「元から発火していないから false」であり、意味を持たない。）
- 決定: 単体テスト（`Sidebar.test.ts`/`TabBar.test.ts`）では、`click` イベントが実際に
  発火することを直接アサートしない。代わりに `ev.defaultPrevented` が `false` のままで
  あることを確認する——これは「コード側がネイティブな既定動作を妨げていないか」という、
  コード側が実際に制御できる責務の範囲を正しく検証する。実ブラウザでの `click` 発火
  そのものは、既存の Vue コンポーネントの慣習上、この work では新たに e2e 化しない
  （requirements「対象外」が `key-bindings.spec.ts` のアサーション自体は変えないと
  明記している。理由: この既存の挙動〔`.stop` だけで `preventDefault` は呼ばない〕は
  この work が新たに導入するものではなく、変更前のコードも同様に非検証のまま依存して
  いた既存の前提であり、この work のスコープ〔伝播を止める条件を絞るだけ〕には
  含まれない）。
- 影響: design.md の「依拠する既存の事実」・「受け入れ基準との対応 AC3」に、この限界と
  対応方針を記録済み。

## D1: T1（`Sidebar.vue`）の負の確認（規約 `regression-negative-control.md`）

- 手順: `onButtonKeydown` の中身を `ev.stopPropagation()` 呼び出しごと空の関数
  （`function onButtonKeydown(_ev: KeyboardEvent): void {}`）に一時的に置き換え、
  `Sidebar.test.ts` を実行 → 新設の6テスト（`describe("Sidebar — ボタンの keydown：
  無修飾の Enter/Space だけ window へ渡さない（AC1・AC2・AC3・AC5）")`）が全て失敗し、
  既存の69テストは影響を受けないことを確認 → 元に戻し、`git diff --stat` が復元後も
  `packages/web/src/components/Sidebar.vue | 24 ++++++++++++++++++------` （変更前と同一）
  であることを確認 → 再実行して全75テストが pass することを確認。
- 失敗ログ（抜粋。6件とも同型——無修飾の Enter/Space で window の keydown スパイが呼ばれて
  しまう）:
  ```
  FAIL  src/components/Sidebar.test.ts > Sidebar — ボタンの keydown：無修飾の Enter/Space
        だけ window へ渡さない（AC1・AC2・AC3・AC5） > サイドバー折りたたみ«/»
  AssertionError: expected "vi.fn()" to be called 0 times, but got 2 times
   ❯ expectStopsOnlyUnmodifiedEnterSpace src/components/Sidebar.test.ts:368:33
      368|     expect(onWindowKeydown).not.toHaveBeenCalled(); // 無修飾の Enter/Space…

   Test Files  1 failed (1)
        Tests  6 failed | 69 passed (75)
  ```
- 結論: 新設テストは実際に `onButtonKeydown` の伝播停止に依存しており、意味を持つ
  回帰検知になっている。復元後の差分・pass 件数（75/75）も確認済み。

## D2: T2（`TabBar.vue`）の負の確認（規約 `regression-negative-control.md`）

- 手順: D1 と同じ手順。`onButtonKeydown` を空の関数に一時的に置き換え、
  `TabBar.test.ts` を実行 → 新設テスト（「keydown：無修飾の Enter/Space だけ window へ渡さ
  ない（AC4）」）が失敗し、既存24テストは影響を受けないことを確認 → 元に戻し、
  `git diff --stat` が復元後も `packages/web/src/components/TabBar.vue | 14 +++++++++++++-`
  （変更前と同一）であることを確認 → 再実行して全25テストが pass することを確認。
- 失敗ログ:
  ```
  FAIL  src/components/TabBar.test.ts > TabBar — 新しいタブのボタン >
        keydown：無修飾の Enter/Space だけ window へ渡さない（AC4）
  AssertionError: expected "vi.fn()" to be called 0 times, but got 2 times
   ❯ src/components/TabBar.test.ts:223:33
      223|     expect(onWindowKeydown).not.toHaveBeenCalled(); // 無修飾の Enter/Space…

   Test Files  1 failed (1)
        Tests  1 failed | 24 passed (25)
  ```
- 副次的な発見（テスト作成時）: `TabBar.vue` のルート要素は `v-if="tabs.length !== 1"`
  （タブが1個のときバー全体を自動的に隠す。既存の「自動非表示（AC4〜AC6）」仕様）で、
  タブ1つの workspace で mount すると `.tab-bar-new` 自体が存在せず `wrapper.get` が例外に
  なった。新設テストは（他の「新しいタブのボタン」テストと同じく）タブ2つの workspace で
  mount するよう修正済み。
- 結論: 新設テストは実際に `onButtonKeydown` の伝播停止に依存しており、意味を持つ回帰検知に
  なっている。復元後の差分・pass 件数（25/25）も確認済み。

## D3: T5 は coding ではなく test 工程で消化する

- tasks.md の T5（`Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts`・
  `key-bindings.spec.ts` の回帰確認）は、この work のタスク分解の時点で「coding ではなく
  test 工程で消化する」と明記済み（tasks.md「テスト方針」「タスク」節）。coding 承認時点で
  T5 は未チェックのまま残る（aidev-40-coding の完了の目安の例外に該当）。

## D4: T5（回帰確認）の結果

- `Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts`（vitest）: 3 files / 139 tests
  すべて pass（無改修部分も含む）。
- `key-bindings.spec.ts`（playwright、`--workers=1`）: 21 件中 20 件 pass。1件
  （`src/specs/key-bindings.spec.ts:777` 「モバイル › Prefix ボタンは現在の prefix を
  注入する…」）が失敗したが、この work とは無関係な**既存の失敗**であることを確認した。
  失敗の内容は、設定ダイアログの節見出し一覧（`dialog.settings-dialog section h3`）に
  「エージェント連携」という節が実際には出るのに、テストの期待値配列にその節が含まれて
  いない、というもの（`packages/web/src/components/SettingsDialog.vue:819` の
  `id="settings-agent-integration"`）。この節を追加したコミット（`239c41d` 「サーバ再起動後に
  Claude Code・Codex の会話を自動再開する」）は `git merge-base --is-ancestor 239c41d HEAD`
  で確認した通り、この work のブランチの起点（`main` の `eef8b50`）に既に含まれており、
  この work のどのタスクも `SettingsDialog.vue` や当該テストの期待値配列に触れていない
  （このworkが変更したのはこのテストファイルの171行目のテスト名のみ。T4参照）。
  よってこの失敗はこの work が持ち込んだ回帰ではなく、既存の未解消の欠陥。
- 対応: この work のスコープ（keydown 伝播の絞り込み）には含めず、修正しない。次に
  自律で拾う backlog 項目の候補として別途記録する（本 work の deliver では触れない）。

## D5: review 指摘（should）への対応——AC1/AC2/AC4 を実ブラウザで裏付ける E2E を追加（AC8）

- 背景: review（1回目）で、この work の核心的価値（AC1/AC2/AC4）が happy-dom 上の間接的な
  signal（window の keydown スパイが呼ばれない）だけで確認されており、実ブラウザで「ボタンに
  フォーカスが残ったまま prefix キーを押すと実際に prefix モードへ入り、続くキーが効く」ことを
  示す E2E が無い、という `should` 指摘を受けた（review.md 参照）。
- 対応（1回目）: `requirements.md` AC7 を「既存テストのアサーションは変えない」に絞り込み、
  新たに AC8（新設 E2E テストが実ブラウザで通ること）を追加。design.md「受け入れ基準との
  対応」に AC8 の対応方法を追記。`packages/e2e/src/specs/key-bindings.spec.ts` に新規タスク
  T6 として1件の E2E テストを追加した。
- 対象ボタンの選定: review 指摘は「＋新規 or メニューボタン」を例示していたが、どちらも
  クリックすると別の UI（名前入力ダイアログ・コンテキストメニュー）を開き、フォーカスが
  そちらへ移ってしまうため「ボタンにフォーカスが残ったまま」という前提が崩れる。代わりに
  「並び順」ボタン（`.sidebar-spaces .sidebar-sort-btn`）を選んだ——クリックしても
  workspace の並び順を切り替えるだけで、ダイアログ等を開かずクリック後も自分自身へ
  フォーカスが残る。Sidebar.vue の対象6箇所は全て同一の `onButtonKeydown` を使うため
  （design「受け入れ基準との対応」AC1 参照）、代表1箇所としての妥当性は保たれる。
- T6 taskcheck round1 で4件（should 3・nit 1）の指摘を受けた（review.md 参照）。要旨:
  (1) テストが AC4（TabBar）を名乗っていたが、実際は Sidebar のボタンしか操作しておらず、
  design が「`Sidebar.vue`/`TabBar.vue` はモジュールを共有しない」としたとおり別々の
  `onButtonKeydown`（同型だが同一参照ではない）である以上、TabBar 側のコピペ漏れ等は
  検知できない。(2) AC2（修飾付きの直接のキー）を名乗っていたが、実際に送っていたのは
  prefix 経由（`prefixKey`）のみで、prefix を経由しない直接キーの経路を一度も送っていな
  かった。(3) requirements.md・design.md が旧記述（「＋新規ボタン」「`.focus()`」）のまま
  更新されておらず、decisions.md（本節）の実際の記述と食い違っていた。(4) 負の確認の
  ログが要約寄りで、規約が求める「生の出力」の水準に達していなかった。
- 対応（2回目）: 上記(1)(2)を解消するため、1テストを3テストに分割した——
  `Sidebar.vue`「並び順」ボタンで AC1（prefix 経由）・AC2（`openWithPrefs` で
  `ctrl+alt+d` を割り当て、prefix を経由しない直接キー）をそれぞれ独立に確認、
  `TabBar.vue`「＋」ボタンで AC4 を確認（`.click()` ではなく `.focus()` を使う——
  `.tab-bar-new` のクリックは新しい tab の名前入力ダイアログを開いてフォーカスを奪う
  副作用を持つため。`onButtonKeydown` は keydown だけを見るハンドラで、フォーカスへ
  至る経路（クリック／プログラムからの `.focus()`）を問わず同じに振る舞う）。
  上記(3)は本節・requirements.md・design.md を実装に合わせて更新し直した。(4)は下記の
  負の確認ログを生のまま貼ることで対応した。
- 負の確認（regression-negative-control.md）: `Sidebar.vue`「並び順」ボタン・`TabBar.vue`
  「＋」ボタンの両方を同時に `@keydown="onButtonKeydown"` → `@keydown.stop`（修正前の形）
  へ一時的に戻し、`packages/web` を再ビルド（`npx vite build`。**E2E は `packages/e2e` の
  `appServer` がビルド済み `dist` を配信するため、ソース編集だけでは反映されない**——
  1回目の負の確認ではこれを見落とし、壊れたコードのままテストが pass してしまった。原因を
  特定し、明示的な再ビルドを負の確認の手順に加えた）→ 3件の新設テストを実行し、3件とも
  期待どおり失敗することを確認。生ログ（抜粋。3件とも `paneCount` が2に増えず1のまま）:
  ```
  ✘  1 src/specs/key-bindings.spec.ts:201:1 › サイドバーのボタン（並び順）にフォーカスが
     残ったままでも prefix キーが実際に効く（AC1・AC8） (6.7s)
  ✘  2 src/specs/key-bindings.spec.ts:215:1 › サイドバーのボタン（並び順）にフォーカスが
     残ったままでも修飾付きの直接のキーが実際に効く（AC2・AC8） (6.8s)
  ✘  3 src/specs/key-bindings.spec.ts:232:1 › tab バーのボタン（＋）にフォーカスが残った
     ままでも prefix キーが実際に効く（AC4・AC8） (7.4s)

    1) …AC1・AC8 ──
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 2
    Received: 1
    Call Log:
    - Timeout 5000ms exceeded while waiting on the predicate
        210 |   // フォーカスが残ったまま prefix キーで実際に分割できる。
        211 |   await prefixKey(page, "v");
      > 212 |   await expect.poll(() => paneCount(page)).toBe(2);

    2) …AC2・AC8 ──
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 2
    Received: 1
    Call Log:
    - Timeout 5000ms exceeded while waiting on the predicate
        226 |   await expect(sortBtn).toBeFocused();
        227 |   await page.keyboard.press("Control+Alt+d");
      > 228 |   await expect.poll(() => paneCount(page)).toBe(2);

    3) …AC4・AC8 ──
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 2
    Received: 1
    Call Log:
    - Timeout 5000ms exceeded while waiting on the predicate
        251 |   await expect(newTabBtn).toBeFocused();
        252 |   await prefixKey(page, "v");
      > 253 |   await expect.poll(() => paneCount(page)).toBe(paneCountBefore + 1);

    3 failed
      src/specs/key-bindings.spec.ts:201:1 › …AC1・AC8
      src/specs/key-bindings.spec.ts:215:1 › …AC2・AC8
      src/specs/key-bindings.spec.ts:232:1 › …AC4・AC8
  ```
  → 両ファイルを元に戻し、`git diff --stat` が
  `packages/web/src/components/Sidebar.vue | 24 ++++++++++++++++++------`・
  `packages/web/src/components/TabBar.vue | 14 +++++++++++++-`（いずれも T1/T2 完了時点
  から変化なし）であることを確認 → 再ビルド → `key-bindings.spec.ts` 全体を再実行し、
  ```
  23 passed (1.1m)
  1 failed
      …モバイル › Prefix ボタンは現在の prefix を注入する…（D4記載の無関係な既存失敗）
  ```
  という結果（新設3テストを含む23件が pass、1件は D4 記載の無関係な既存失敗のみ）を確認
  （想定どおり）。

## D6: T6 追加後、cross taskcheck をラウンド上限（2/2）で打ち切り、判断を review へ委ねる

- 背景: T1〜T5 完了時点で `cross` taskcheck は round2（findings 0）まで完了していた。
  review 差し戻しで新設した T6 は「タスクをまたぐ不変条件」の観点でも点検が要るが、
  `aidev taskcheck start cross` を再度打つと `maxTaskCheckRounds`（2）に達しており
  `FAIL 点検ラウンドが上限に達しています（2/2）`（exit 4）で拒否された。
- 判断: protocol の指示（「深追いせず decisions.md に経緯を残して次のタスクへ進み、判断は
  60 review に委ねる」）に従い、これ以上 taskcheck ラウンドを重ねない。根拠:
  (1) T6 は `packages/e2e/src/specs/key-bindings.spec.ts`（テスト追加）・
  `packages/e2e/src/specs/appearance-settings.spec.ts`（コメント修正）のみに触れる加算的な
  変更で、T1・T2 が変更した `Sidebar.vue`・`TabBar.vue` の実装そのものには一切触れていない
  （diff は本節の負の確認で復元・確認済み）。(2) T6 自身は独立の2ラウンド taskcheck
  （round1: 4件指摘・round2: findings 0）を経ており、タスク単体としての正確性・規約適合は
  確認済み。(3) この後の review（2回目）で work 全体の差分を再び通しで見る予定であり、
  「タスクをまたぐ不変条件」に類する懸念はそこで拾われる。
