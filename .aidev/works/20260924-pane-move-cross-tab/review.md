# レビュー: D&D による pane の別 tab・別 workspace への移動

## タスク点検ログ

- [should][conv:-] `moveToNewTab` の「同一 workspace への移動」テストが、移動する pane が
  移動元 tab の唯一の pane ではないケースしか使っておらず、`closeEmptyTabShell` が同一
  workspace 内で呼ばれる経路（移動元 tab がその1枚だけの pane を失って空になり、かつ移動先が
  同じ workspace という組み合わせ）を実際には通っていなかった——この work が存在する理由
  そのもの（research.md R1）に最も近い、最も危ない分岐が未検証のまま残っていた（実装自体には
  バグは無いことを手でトレースして確認済み）。 / 対応: この経路を直接確かめる新しいテスト
  （「同一 workspace 内で、移動元 tab がその1枚だけの pane を失っても正しく畳まれる」）を
  追加した。 / src: T2 taskcheck round1
- [nit][conv:-] `closeEmptyTabShell` 内のコメント「pane は既に無いので…空振りになるだけで
  安全」が、実際には `skipTabCleanup: true` によりそのループ自体が実行されない（"空振り"では
  なく"スキップ"）ことを正確に表していなかった。 / 対応: コメントを「そもそもそこを通らない」
  形に修正した。 / src: T2 taskcheck round1
- [should][conv:-] `Sidebar.test.ts` の「手動グループのヘッダー行には付かない」テストが
  ヘッダー行（`rows[0]`）だけを見ており、同じセットアップで生成される非ヘッダー（メンバー）行
  （`rows[1]`）に `data-drop-workspace-id` が正しく付くことを確認していなかった——
  design.md/research.md F10・R2 が名指しする「ヘッダー行とメンバー行を混同しない」という
  区別を、実際には片側からしか検証できていなかった（実装自体は `Sidebar.vue` のトレースで
  正しいことを確認済み）。 / 対応: 同テストに `member`（`rows[1]`）の
  `data-drop-workspace-id === "w1"` の検証を追加し、ヘッダー/メンバーの対比を1テストで
  確認する形にした。 / src: T7 taskcheck round1
- [should][conv:-] `movePaneToTab` は `ok:true` でも移動先 tab がまだ `session.tabs` に
  同期されていない場合、`view.setView` はスキップするのに `view.focusPane`/`registry.focus`
  は無条件に実行していた——表示は元の tab のままなのに focus だけ移動先の（画面に見えていない）
  pane へ動き、以後のキー入力の宛先が画面と食い違う状態を作り得た。隣接する
  `movePaneToNewTab`（`!r.tab` で3呼び出しとも早期 return）と非対称だった。 / 対応:
  `if (!targetTab) return;` に変更し、3呼び出しをまとめて同じ条件下に入れた
  （`movePaneToNewTab` と対称に）。回帰確認: 修正前のコードに戻して新テストが実際に失敗する
  ことを確認済み（`view.focusedPaneId` が意図せず変わる）。 / src: T8 taskcheck round1
- [should][conv:-] 上記の防御分岐が新規テスト4本のいずれからもカバーされておらず、
  「ok:true だが対象 tab の情報が session に無い」ケースの挙動が未検証だった。 / 対応:
  そのケースを直接確かめる新しいテストを追加した（`registry.focus` が呼ばれないこと・
  `view.focusedPaneId` が変わらないことを検証）。 / src: T8 taskcheck round1
- [should][conv:-] `moveToNewTab` の3分岐（移動元 tab 生存／tab 閉鎖・workspace 生存／
  tab 閉鎖・workspace 連鎖閉鎖〔D18〕）のうち、workspace が連鎖して閉じるケースが
  `describe("moveToNewTab", ...)` にテストされていなかった（`moveToTab` 側は3分岐ともテスト
  済みだったのに非対称だった）。実際に `labelGen.delete` の行を一時的にコメントアウトして
  テストを実行しても全件 pass することで、そのケースが未検証だったことを実地確認済み。 /
  対応: 「移動元 workspace も連鎖して空になるとき（D18）」テストを追加した
  （`moveToTab` 側の同名テストと対にした）。 / src: T3 taskcheck round1
- [nit][conv:-] `Sidebar.vue` の `workspaceRowKeyAt` の JSDoc が、この T9 の差分で削除された
  `PaneFrame.vue` の旧関数 `paneIdAt` を名指しで参照しており、死んだ参照になっていた。 /
  対応: 参照先を現存する `dropTargetAt`（同じ形の `closest` 探索）に修正した。 /
  src: T9 taskcheck round1

## レビュー ラウンド1

- [should][conv:-] `ActionDispatcher.ts:575-606`（`movePaneToTab`/`movePaneToNewTab`）
  RPC の応答（`ok:true`）を待ってから `view.setView`/`focusPane`・`registry.focus` を
  無条件に呼んでいるが、その往復の間にユーザーが別の操作（tab クリック・キーバインドでの
  tab 切替等、同期的で RPC 不要な経路）で既に別の tab/workspace へ view を移していた場合、
  応答到着時に強制的に移動先 tab へ視点が引き戻される（decisions.md D2 が名指しした懸念
  そのもの）。 / 対応: RPC 発行時点の `view.workspaceId`/`view.tabId` を控えておき、応答到着
  時にそれが変わっていれば view の切り替え・focus を行わないよう変更した（pane の移動自体は
  成立させる——他クライアント・再訪時の表示は `layout.updated`/`tab.created` 等の既存の同期
  経路で正しく反映される）。
- [nit][conv:-] `TabBar.vue:147`（`:data-tab-id="tab.id"`） 全 tab（ドラッグ中の pane が
  今いる tab 自身を含む）にドロップ候補ハイライトが付き得る。サーバ側 `moveToTab` は
  `pane.tabId === targetTabId` で無視する（AC9 のとおり実害は無い）が、AC4 の「ドロップ候補が
  視覚的に分かる」ハイライトが、実際には何も起きない自分自身の tab にも表示されてしまう。 /
  対応: `PaneFrame.vue` の `onNamePointerMove` で、`hit.kind === "tab"` かつ
  `hit.tabId === session?.panes.get(props.paneId)?.tabId`（ドラッグ中の pane が今いる tab
  そのもの）のときは `overTabId` を立てないよう変更した。
- [nit][conv:-] `SessionModel.ts`（`moveToTab`/`moveToNewTab`） design「振る舞いの詳細」の
  「AC8 をサーバ側でも一貫させる」の実装は `tab.focusedPaneId` の更新のみで、セッション全体の
  グローバル focus（`this.focus`。`session.json` に永続化され、ローカル保存 view の無い新規
  クライアントの復元先になる）は更新していない。ただし `moveToEdge`/`replacePane`
  （前回作業 `20260924-pane-dnd-split-move`）も同様に `this.focus` を更新しておらず、既存の
  踏襲であって本 work 固有の後退ではない。 / 対応: 修正は見送る（既存の一貫した挙動に合わせる
  ——`this.focus` の扱いを変えるなら `moveToEdge`/`replacePane` も含めた横断的な設計判断が
  必要で、この work のスコープを超える）。design.md の当該記述と実装の粒度のずれは
  decisions.md に記録した（D4。将来の見直しは backlog に追加済み）。 / src: review round1

## レビュー ラウンド2

round1 の should 1件・nit 2件（うち1件は D4 として修正見送りを決定・記録済み）への対応を
確認した。`ActionDispatcher.ts`（RPC 応答待ち中の view 競合ガード）・`PaneFrame.vue`
（自分自身の tab へのハイライト抑制）の diff を再読し、意図どおりの修正であることを確認。
両修正とも負の確認（修正前に戻すと新テストが失敗する）済み（test-result.md 参照）。
新たな指摘なし。
