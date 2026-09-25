# タスク: keydown を止めるボタンにフォーカスが残っていても prefix・直接のキーを効かせる

## 実装方針

design.md の対象範囲は4つの独立したファイル群（`Sidebar.vue`+テスト、`TabBar.vue`+テスト、
`docs/verification.md`、`packages/e2e/.../key-bindings.spec.ts`）に分かれ、互いにファイルが
重ならないため、次の順で積む: (1) `Sidebar.vue`/`TabBar.vue` それぞれに `onButtonKeydown`
を新設し、既存の `@keydown.stop` をこの関数の参照に置き換える（design「インターフェース /
データ構造」のコード例をそのまま適用）、(2) 各コンポーネントの単体テストに
`PaneFrame.test.ts:101-111` と同型の確認テストを足す、(3) ドキュメント（`verification.md`・
e2e のテスト名）を実際の挙動に合わせて更新する。(1)〜(3) は4つのファイル群それぞれで
独立して行えるため `依存: なし`同士で並行可。最後に、触れた全ファイルが揃った状態で
回帰確認（T5）を行う。

## 作業順序と依存関係

下の `依存:` に従う。T1〜T4 は並行可（ファイルが重ならない）。

## リスク / 留意点

- **`onButtonKeydown` は `preventDefault()` を呼ばないこと**（design「設計方針」「依拠する
  既存の事実」）。ネイティブなボタンの活性化（Enter/Space での `click`）を妨げないため。
- **単体テストでは `click` の実発火ではなく `ev.defaultPrevented === false` を確認する**
  （design「依拠する既存の事実」）——テスト環境（happy-dom）は合成 keydown からのネイティブ
  なボタン活性化を再現しないため、`click` が実際に発火したかを直接アサートしても
  意味を持たない（実機確認済み。decisions.md 参照）。
- **`packages/e2e/src/specs/key-bindings.spec.ts` の検証内容（アサーション）自体は変えない**
  （requirements「対象外」）。変えるのは171行目のテスト名の注記だけ。

## テスト方針

- `Sidebar.test.ts`: `PaneFrame.test.ts:101-111` と同型のテスト（実際の
  `window.addEventListener` スパイ）を対象6箇所**全て**に適用する（コピー&ペーストの
  貼り忘れ検知のため。design「受け入れ基準との対応」AC1 が確認粒度をこう定めている）。
  各箇所で次を確認する: 無修飾の Enter/Space keydown を dispatch すると window の
  keydown スパイが呼ばれないこと（これが AC1・AC2 の成立条件——window まで届かなければ
  `main.ts` の `keys.handleDomKey` に渡らず、prefix・直接のキーとして処理される経路にも
  乗らない）・修飾付き（例 ctrl+alt+d）/他のキー（Tab 等）を dispatch すると window の
  keydown スパイが呼ばれること（AC2・AC5 の成立条件）・いずれの場合も
  `ev.defaultPrevented` が `false` のままであること（AC3）。
- `TabBar.test.ts`: 同じ観点を1箇所（＋ボタン）について確認する（AC4）。
- 全タスク完了後、`Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts`・
  `packages/e2e/src/specs/key-bindings.spec.ts` が全て無改修部分も含めて通ることを確認する
  （T5。coding ではなく test 工程で最終確認する——このセッションの他 work と同じ扱い）。

## タスク

- [x] T1: `Sidebar.vue` に `onButtonKeydown` を追加し、6箇所の `@keydown.stop` を
      `@keydown="onButtonKeydown"` に置き換える。`Sidebar.test.ts` に確認テストを足す。
      対象: `packages/web/src/components/Sidebar.vue`（372, 411, 425, 432, 442, 468行目）・
      `Sidebar.test.ts` / 根拠: design.md「インターフェース / データ構造 >
      packages/web/src/components/Sidebar.vue」
      依存: なし
      AC: AC1, AC2, AC3, AC5

- [x] T2: `TabBar.vue` に `onButtonKeydown` を追加し、157行目の `@keydown.stop` を
      `@keydown="onButtonKeydown"` に置き換える。`TabBar.test.ts` に確認テストを足す。
      対象: `packages/web/src/components/TabBar.vue:157`・`TabBar.test.ts` / 根拠:
      design.md「インターフェース / データ構造 > packages/web/src/components/TabBar.vue」
      依存: なし
      AC: AC4

- [x] T3: `docs/verification.md:897-899` の既知の制約の記述を、修正後の実際の挙動
      （ボタンにフォーカスが残っていても prefix・直接のキーは効くが、navigate モード中は
      ボタン自身の Enter/Space が優先される）に合わせて更新する。
      対象: `docs/verification.md:897-899` / 根拠: design.md「受け入れ基準との対応 AC6」
      依存: なし
      AC: AC6

- [x] T4: `packages/e2e/src/specs/key-bindings.spec.ts:171` のテスト名から「`keydown` を
      止めるボタンの上は既知の制約」という注記を外す（アサーション自体は変更しない）。
      対象: `packages/e2e/src/specs/key-bindings.spec.ts:171` / 根拠: design.md「受け入れ
      基準との対応 AC7」・「対象範囲」
      依存: なし
      AC: AC7

- [x] T5: `Sidebar.test.ts`・`TabBar.test.ts`・`PaneFrame.test.ts`・
      `packages/e2e/src/specs/key-bindings.spec.ts` が全て（無改修部分を含め）通ることを
      確認する（回帰確認）。**coding ではなく test 工程で消化する**（このセッションの他
      work と同じ扱い）。
      対象: 上記4ファイル（既存部分は変更せず実行するだけ） / 根拠: design.md「受け入れ
      基準との対応 AC7」・「対象範囲」
      依存: T1, T2, T3, T4
      AC: AC7

- [x] T6: `packages/e2e/src/specs/key-bindings.spec.ts` に、サイドバーの「並び順」ボタン
      （AC1: prefix 経由・AC2: 直接キー）・tab バーの「＋」ボタン（AC4: prefix 経由）へ
      フォーカスが残ったまま prefix・直接のキーが実際に効くことを実ブラウザで確認する
      新規テストを3件追加する（review 指摘。T6 taskcheck round1 の指摘で1件から3件へ
      分割）。
      対象: `packages/e2e/src/specs/key-bindings.spec.ts`（190行目付近に新規追加） / 根拠:
      design.md「受け入れ基準との対応 AC8」
      依存: T1, T2
      AC: AC8
