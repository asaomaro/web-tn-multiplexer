# 要件: 既読（wtm.seen.v1）の意味論を直す

## 背景 / 課題

`main.ts` の `markVisibleAgentsSeen`（既読を進める唯一の呼び出し元）は、ウィンドウに
フォーカスがありさえすれば、実際に画面に表示されているかを問わず session 内の**全 pane**の
既読（`seen.markSeen`）を進めてしまう（コード上のコメントで「意図的な簡略化」と明記されて
いる）。

このため、ブラウザのタブにフォーカスがある間（＝ほとんどの利用時間）は、pane が画面に
表示されていなくてもエージェントの完了が即座に既読扱いになり、`displayStateFor`
（`agent.state === "idle" && agent.completionSeq > seenSeq` で `"done"` を返す）が
`completionSeq > seenSeq` を満たせない。結果、`NotificationController`（実際の pane の
表示・ウィンドウのフォーカスを正しく見ている。`main.ts:215` で
`isPaneVisible: (paneId) => registry.isVisible(paneId)` を渡し済み）は「完了しました」と
通知するのに、サイドバーには完了の印（`done` 状態）が一度も出ない、という食い違いが起きる。

正しい規則 `shouldMarkSeen(paneVisible, windowFocused)`
（`packages/web/src/store/seen.ts:80-82`。`paneVisible && windowFocused`）は既に実装され
単体テストも通っているが、本番コードのどこからも呼ばれていない（`seen.test.ts` からの参照
のみ）。`paneVisible` を実際に求める手段（`TerminalRegistry.isVisible(paneId)`。
20260920-agent-notifications で追加済み。`TerminalPane.vue` の `onMounted`/`onBeforeUnmount`
だけが出し入れする、実際に画面にマウントされているかの正確な判定）も既に存在し、
`NotificationController` への配線（`main.ts:215`）で前例がある。

## 目的 / ゴール

サイドバーの完了の印（`done` 表示）が、実際に完了通知（「完了しました」）と一致する状態にする。
利用者が実際にその pane を見ていない間は、ウィンドウにフォーカスがあっても既読にならない
状態にする。

## ユーザーストーリー

- US1: 複数の pane・workspace を並行して使う利用者として、いま見ていない pane でエージェントが
  完了したら、実際にその pane を見るまでサイドバーに完了の印が残り続けてほしい。なぜなら、
  通知（「完了しました」）とサイドバーの印が食い違っていると、印を信用して他の完了に気づけなく
  なるから。（受け入れ: AC1, AC2, AC3, AC4）

## スコープ

### 対象

- `main.ts` の `markVisibleAgentsSeen` を、pane ごとに `shouldMarkSeen(registry.isVisible
  (pane.id), document.hasFocus())` で判定してから既読を進める形に直す（現状の「フォーカスが
  あれば全 pane」という簡略化をやめる）。
- **`TerminalRegistry.isVisible` は Vue の reactive ではなく `watch` できない**
  （`TerminalRegistry.ts` 自身のドキュメントコメントに明記）ため、既存の2つの発火点
  （`completionSeq` の変化・ウィンドウの `focus` イベント）だけでは「ウィンドウは既に
  フォーカスされたまま、利用者が pane を切り替えて表示する」という遷移を拾えない。この
  遷移を拾う新しい発火点を追加する（`TerminalPane.vue` の `onMounted`——pane が実際に
  画面にマウントされる、まさにその瞬間。design で具体的な配線を確定する）。

### 対象外

- **`TerminalRegistry.isVisible` 自体の reactive 化**: 非 reactive・pull 型という既存の設計は
  変えない（`acquire`/`release` の出し入れの仕組みも無改修）。
- **`displayStateFor`/`aggregate`/`STATE_PRIORITY` の判定ロジック**: 既に正しく実装されている
  （`done` の定義自体は変えない）。
- **`NotificationController` 自体の挙動**: 既に `isPaneVisible`/`hasFocus` を正しく使っており
  対象外（この work が可視性判定の配線として参考にする既存の precedent）。

## 機能要件

- 既読（`seen.markSeen`）を進めてよいかの判定は、常に「その pane が実際に画面に表示されて
  いるか」と「ウィンドウにフォーカスがあるか」の両方を見る（`shouldMarkSeen` を経由する）。
  session に存在するというだけで（表示されていなくても）既読にしない。
- 既に画面に表示されていてウィンドウにもフォーカスがある pane は、エージェントの
  `completionSeq` が進んだ時点で既読になる（既存の `watch` の発火点は維持する）。
- ウィンドウが（他のアプリ等からブラウザへ）フォーカスを取り戻したときは、その時点で実際に
  表示されている pane**だけ**を既読にする（表示されていない pane は対象外にする——現状は
  全 pane を既読にしていた挙動の変更）。
- ウィンドウに既にフォーカスがあるまま、利用者が pane を切り替えて新しい pane を表示した
  ときも、その pane がその時点で既読の条件を満たせば既読にする。

## 非機能要件 / 制約

- 追加する発火点（pane の表示切り替わり）は、`TerminalRegistry.isVisible` のドキュメント
  コメントが求める「pull で読む」「mount/unmount のフックは Vue のパッチ後に走るので、
  必要なら `nextTick()` の後に読む」という契約を守る。

## 完了条件 (受け入れ基準)

- [ ] AC1: 非表示の pane でエージェントが完了（`completionSeq` が進む）しても、ウィンドウに
  フォーカスがあるだけでは既読にならない——利用者が実際にその pane を表示するまで、
  サイドバーは `done`（完了の印）を示し続ける。
- [ ] AC2: 表示中かつウィンドウにフォーカスがある pane は、エージェントが完了すれば
  （`completionSeq` が進めば）既読になる（従来どおりの正常系を壊さない）。
- [ ] AC3: 完了直後に非表示だった pane を、ウィンドウが既にフォーカスされたまま利用者が
  実際に表示に切り替えると、その時点で既読になる。
- [ ] AC4: ウィンドウがフォーカスを取り戻したとき、その時点で実際に表示されている pane
  だけが既読になり、表示されていない pane は既読にならない。

## 未確定事項 / 確認したいこと

- 新しい発火点（`TerminalPane.vue` の `onMounted`）で、既読の判定・書き込みをどこに
  実装するか（`main.ts` の `markVisibleAgentsSeen` をそこから呼べるようにするか、
  `TerminalPane.vue` 側に同等のロジックを持つか）は design で確定する。
