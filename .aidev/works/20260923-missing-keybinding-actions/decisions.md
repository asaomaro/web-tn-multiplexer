# 判断の記録

## D1: requirements 時点で research を前倒しして実施した

- **背景**: backlog の記述は `last_pane`・`previous_agent`/`next_agent`/`focus_agent` の正確な意味論
  （履歴スタックかトグルか／対象は agent の状態を問わないか／`focus_agent` は一覧を開くのか直接
  ジャンプするのか）を確定できていなかった。オーケストレーターの指示は「herdr 公式ドキュメント
  （`keyboard.mdx`・`concepts.mdx`・`agents.mdx`）を WebFetch で確認し、無ければ `agents.mdx` も見る」
  だったが、grep した結果この3ファイルに該当箇所の記載は無かった。
- **決定**: mdx が無いことを理由に止めず、herdr ソース本体
  （`da6bcd5969779bfe0396bcf89a8025d4375d611e`。前回 work `20260921-keybinding-customization` が確立した
  「scratchpad に `git clone --filter=blob:none` → 該当コミットを checkout」の手順を再利用）を直読して
  意味論を確定した。具体的には `src/config/model.rs`（doc コメント。既定が全て「割り当てなし」である
  ことの根拠）・`src/client/shell/actions.rs`（実行本体。`LastPane`・`PreviousAgent`/`NextAgent`/
  `FocusAgent`・`PreviousWorkspace`/`NextWorkspace`・`MoveTabPrevious`/`MoveTabNext` の各アーム）・
  `src/client/shell/agent_sidebar.rs`（`ordered_agent_pane_ids`）・`src/client/shell/state.rs`
  （`previous_pane_id` の更新タイミング）・`src/workspace.rs`（`Workspace::move_tab`）を読み、
  `research.md` F1〜F5 として記録した。
- **理由・代替案**: 代替案は「mdx に記載が無い＝不明のまま、本製品の既存挙動から最も自然な意味論を
  独自解釈で選ぶ」（オーケストレーターの指示が許容する経路）。しかし herdr は OSS でソース自体が
  一次資料として入手可能であり、実装本体を読めば「独自解釈」に頼らず正確な挙動が確定できたため、
  こちらを優先した。research 工程（任意工程）の発火条件（protocol.md「4.5」条件1「調査で解消すべき
  未確定事項が残る」）に該当すると判断し、autonomous のため承認を待たず自動で実施した
  （requirements.md の完了を待たずに調査自体は先行させたが、requirements.md の記述はこの調査結果を
  踏まえた確定版として書き、research.md はその根拠を索引付きで残す通常の工程順序に揃えた）。
- **影響**: requirements.md の機能要件・完了条件が最初から herdr の実際の挙動に基づく確定記述になり、
  「未確定事項」は解消済みとして閉じた。design 工程は意味論の選択ではなく実装方式（protocol の形・
  共有関数の置き場等）に専念できる。

## D2: doccheck（requirements）の指摘8件（must 2・should 3・nit 3）はその場で最小修正した

- **背景**: `aidev doccheck start requirements --mode delegated` で別コンテキストへ委譲した点検が、
  既存操作数の文書内矛盾（35 vs 34）・機能要件と「未確定事項」節の矛盾（解決済みなのに未確定と
  書いていた）・AC9 の参照範囲のずれ・AC10 の無参照・目的/ゴールへの実装詳細混入・操作数の数え方の
  曖昧さ（「8操作」なのに列挙は9〜12）・AC7 のエッジケース集約・wtmctl 除外の条件的表現、の8件を返した。
- **決定**: 全8件をその場で最小差分で修正した（差し戻し＝`aidev event requirements sent_back` は
  使わず、同じラウンド内で直して再提示する経路を選んだ）。must 2件のうち「既存操作数」は実際に
  `bindings.ts` を数え直して35が正（34は前work時点の値を引き写した誤記）と確認して修正、
  「未確定事項との矛盾」は D1 の調査結果に合わせて「未確定事項」節を解消済みとして書き換えた。
- **理由・代替案**: `protocol-check.md`「(a)」が「指摘あり→その場で直して再提示、または差し戻す」の
  どちらでもよいとしており、指摘の性質（記述の整合性の是正で、設計判断のやり直しを要しない）から
  その場修正を選んだ。差し戻すと `aidev event requirements sent_back` を打ち直す分の手順が増えるだけで、
  得られるものが無い。
- **影響**: `aidev doccheck report requirements --findings 8` で件数を記録済み。requirements.md は
  8件反映後の状態で承認へ進む。

## D3: `tab.move` の protocol 形は herdr の `insert_index` ではなく `{tabId, direction}` を採る

- **背景**: `move_tab_previous`/`move_tab_next` は本製品にまだ無い機能で、新しい protocol メソッドが
  要る（唯一、既存メソッドの組み合わせだけでは終わらない操作。research F5・R1）。herdr の socket API は
  `tab.move` を `{tab_id, insert_index}` で持ち、クライアントが `source+2`/`source-1`/`0`/`len` という
  一見複雑な `insert_index` を計算し、サーバが `remove`→`insert` で反映する（`herdr:src/workspace.rs:591-611`）。
- **決定**: 本製品の `tab.move` は `{tabId, direction: "previous" | "next"}` とし、サーバ側
  （`SessionModel.moveTab`）は対象 tab とその隣（巡回込み）を `tabIds` 配列内で直接 swap する
  （`[tabIds[idx], tabIds[swapIdx]] = [tabIds[swapIdx], tabIds[idx]]`）。
- **理由・代替案**: 代替案（herdr と同じ `insertIndex` 方式）を退けた理由は、本製品の `Workspace.tabIds`
  が単純な `string[]` で、herdr のような複数要素シフトを要する構造ではないこと。research F5 で
  「herdr の `insert_index` 計算の結果は常に隣接swap＋巡回に等価」と机上で確認済みなので、
  最終結果を保ったまま実装だけを単純化できる。`{tabId, direction}` は既存の `pane.swap`
  （`{paneId, direction}`）と同じ形にもなり、protocol 全体の一貫性も保てる。
- **影響**: `packages/protocol/src/messages.ts` に `TabMoveParams`（`direction: z.enum(["previous", "next"])`）
  を追加。`SessionModel.moveTab`/`SessionService.moveTab`/`surface/methods/tab.ts` の実装は
  `design.md`「インターフェース / データ構造」に記載のとおり。

## D4: agent/workspace の順序ロジックは共有関数に一本化し、`Sidebar.vue` も使う形へ最小リファクタする

- **背景**: `previous_agent`/`next_agent`/`focus_agent` が対象とする順序は、非機能要件で
  「サイドバーの表示順序（`Sidebar.vue` の `agents` 計算）と食い違わない」ことを求めている。
  `previous_workspace`/`next_workspace` も同様に `Sidebar.vue` の `spaces` 計算と同じ順序を使う。
- **決定**: `orderedAgentPaneIds`（`store/agentOrder.ts`）・`orderedWorkspaceIds`（`store/workspaceOrder.ts`）
  を純関数として新規に切り出し、`ActionDispatcher` から呼ぶだけでなく、**`Sidebar.vue` の既存 computed
  もこれらを呼ぶ形に書き換える**（結果は現状と完全一致させ、`Sidebar.test.ts` の既存アサーションを
  回帰の網として使う）。
- **理由・代替案**: 代替案（`Sidebar.vue` は触らず `ActionDispatcher` 側に同じロジックを複製する）は
  実装は簡単だが、**非機能要件を構造的に保証できない**——2箇所が個別に同じ規則を書けば、将来どちらか
  一方だけ直されて表示順と操作順が静かにずれるリスクが残る。表示中の Vue コンポーネントを触るリスクは
  あるが、`Sidebar.test.ts` の既存アサーションでリファクタの安全性を確認できる（振る舞いを変えない
  リファクタなので、既存テストが1:1でそのまま通ることが確認手段になる）ため、共有関数への一本化を選んだ。
- **影響**: `Sidebar.vue` の `spaces`/`agents` computed の実装を差し替える（振る舞いは変えない）。
  `Sidebar.test.ts` が無変更で通ることをリファクタの正しさの確認とする。

## D5: doccheck（design）の指摘6件（must 2・should 2・nit 2）はその場で最小修正した

- **背景**: `aidev doccheck start design --mode delegated` の点検が、「概要」の算数の誤り
  （11個→正しくは10個）・「herdr の8操作群」という数値の誤り（requirements.md の「9個」と食い違う）・
  「UI 層は変更しない」という言い切りと `Sidebar.vue` 変更の並存・`view.focusPane` が「唯一の経路」で
  ある根拠の file:line 欠落・`Workspace.tabIds` の行番号欠落・`D88` コメントの所在不明、の6件を返した。
- **決定**: 全6件をその場で最小差分で修正した。「11個」は「`move_tab_previous`/`move_tab_next` を除く
  残り10個」に、「8操作群」は「9操作名（`resize_pane_*` を1つと数えた場合）」に訂正。「UI 層は変更しない」
  は「キー設定関連の UI（`KeySettings.vue`・`HelpDialog.vue`）は変更しない」に絞り、`Sidebar.vue` は
  別の理由（D4）で変更する旨を明記。`view.focusPane`/`Workspace.tabIds`/`D88` コメントの各項目に
  具体的な `file:line` を補った。
- **理由・代替案**: いずれも記述の精度・出所の明示の問題で、設計判断そのもののやり直しは不要と判断し、
  `protocol-check.md`「(a)」の「その場で直して再提示」を選んだ。
- **影響**: `aidev doccheck report design --findings 6` で件数を記録済み。design.md は6件反映後の状態で
  承認へ進む。

## D6: architecture（任意工程）は実施しない

- **背景**: design 終了時の自己評価（protocol.md「4.5」の4条件）のうち、条件1「モジュール間の境界を
  動かす（責務の移動・新しい依存の向き・共有部品の抽出）」に部分的に当たりうる——`agentOrder.ts`・
  `workspaceOrder.ts` という新規の共有純関数を切り出し、`Sidebar.vue` をそれらを使う形へリファクタする
  （D4）。
- **決定**: architecture（任意工程）は実施しない。
- **理由・代替案**: 条件1の除外規定「単に複数ファイルを触るだけでは当たらない」に照らすと、今回の
  「共有部品の抽出」は既存パターン（`term/layoutOrder.ts` の純関数切り出しと同型）をなぞるだけの小さな
  抽出で、新しい責務分割・新しい依存の向き・複数モジュールをまたぐ構造変更ではない。design.md は
  インターフェース（`orderedAgentPaneIds`/`orderedWorkspaceIds` のシグネチャ）・振る舞い・代替案
  （D4）まで既に具体化済みで、tasks 工程が直接分解できる粒度に達している（条件4に非該当）。
  条件2（新規アーキテクチャ判断）・条件3（複雑なインターフェース/データモデル）も該当しないと判断した。
- **影響**: 次工程は `tasks` に進む。

## D7: AC10（既存操作の回帰なし）は tasks の T15 として立てるが、消化は coding ではなく test 工程で行う

- **背景**: `aidev-30-tasks`「6.」は「coding ではなく test / deliver で消化する」AC がある場合、
  その旨を明記したタスクを立て、coding 承認時に未チェックで残る前提を decisions.md に記録するよう
  求めている。AC10（既存35操作・prefix・navigate・resize・copy モードのテストが無変更で通ること）は、
  T1〜T14 の実装が全て終わってから初めて意味のある形で検証できる「全体回帰」で、個別タスクの中では
  検証しきれない。
- **決定**: T15「全体回帰確認（`pnpm -s -r test`）」を tasks.md に立てるが、coding 工程では未チェックの
  まま残し、`aidev-50-test` 工程で実行してチェックを入れる。
- **理由・代替案**: 各タスク（T1〜T14）の単体テストは個別には通すが、パッケージをまたぐ全体の回帰は
  test 工程の役割（`aidev-50-test` の完了の目安）と重複するため、coding 側で先取りして消化すると
  二重管理になる。
- **影響**: `tasks_planned`/`tasks_anchored` には T15 を含めて数える（対象は特定済みなので
  `未特定` 扱いにはしない）。coding 承認時、T15 は未チェックのまま `approve coding` を通す。

## D8: `closeDialog` の直接代入は `lastFocusedPaneId` の更新対象に含めない

- **背景**: tasks 工程の準備中（T7 の対象箇所を確認していたとき）に、design.md 承認時点の
  「`view.focusPane` が全てのフォーカス変更の唯一の経路」という記述が不正確だったと分かった
  （`closeDialog`（`view.ts:274`）も `preDialogFocusPaneId.value` を `focusedPaneId.value` へ
  `focusPane()` を経由せず直接代入している。`restoreView` の2箇所しか把握していなかった）。
- **決定**: `closeDialog` の直接代入は `lastFocusedPaneId` の更新対象に含めない（`focusPane()` の中にだけ
  追跡ロジックを置くという design の実装方針は変えない）。design.md の該当箇所を訂正した。
- **理由・代替案**: 実際の呼び出し元（grep で確認。`openDialogWithContext` を呼ぶコード全て）は
  ダイアログを開く時点で `focusedPaneId` を変えないため、`closeDialog` の直接代入は多くの場合
  同じ値への書き戻し（no-op）にしかならない。仮に途中で `focusedPaneId` が null になっていたとしても、
  それはダイアログの表示状態であって workspace/tab/pane 間のナビゲーションではないので、
  `last_pane` の「直前」に含めない方が意味的に正しい。`closeDialog` にも追跡を足す代替案は、
  「意味の無い直前」を作り込むだけで requirements のどの AC にも寄与しないため退けた。
- **影響**: design.md「依拠する既存の事実」の記述を訂正済み（承認済みの design.md への事後の事実訂正。
  設計判断そのものは変えていない）。実装（T7・T9）はこの整理どおりに進める。

## D9: doccheck（tasks）の指摘6件（must 3・should 3）はその場で最小修正した

- **背景**: `aidev doccheck start tasks --mode delegated` の点検が、T9/T10 の `AC:` 欄に
  design.md 上は担当外の AC6（`resize_pane_*`。`bindings.ts` の登録だけで完結し ActionDispatcher 側の
  変更が無いと design が明記）が紛れ込んでいたこと（must×2）・「作業順序と依存関係」の「4系統」という
  数値が直後の列挙（5項目）と食い違っていたこと（must×1）・T10 冒頭の「7操作分」が実際の列挙
  （5 Action 型／8 ActionId／11 テストケース）のどれとも一致しないこと（should×1）・T12/T13 の
  `AC:` 欄が AC8 だけで、design 上は `focus_agent`（AC7）の副作用として位置づけている記述と食い違って
  いたこと（should×2）、の6件を返した。
- **決定**: 全6件をその場で最小差分で修正した。T9/T10 から AC6 を削除、「4系統」を「5系統（タスクは
  T5・T6 の2件を含むため6件）」に訂正、T10 冒頭を具体的な数（5 Action 型・8 ActionId・11ケース）に
  書き換え、T12/T13 の `AC:` に AC7 を追加（AC8 は残す——節「キー」への登録という側面も引き続き妥当
  なため）。
- **理由・代替案**: いずれも `対象`/`依存`/`AC` 欄という構造化データの正確性の問題で、タスク分解の
  やり直しは不要と判断し、`protocol-check.md`「(a)」の「その場で直して再提示」を選んだ。
- **影響**: `aidev doccheck report tasks --findings 6` で件数を記録済み。修正後に `aidev coverage --strict`
  を再実行して gap が増えていないことを確認してから承認へ進む。

## D10: `SessionModel.moveTab` は design.md の単純 2 要素 swap ではなく splice の remove→insert で実装した

- **背景**: coding 中（T2）に design.md「インターフェース / データ構造」の擬似コード
  （`[tabIds[idx], tabIds[swapIdx]] = [tabIds[swapIdx], tabIds[idx]]`、`swapIdx = (idx + delta + len) % len`）
  をそのまま実装すると、境界（先頭を「前へ」・末尾を「後ろへ」）で herdr の実際の挙動と食い違うことに
  気付いた。herdr の `Workspace::move_tab`（`herdr:src/workspace.rs:591-611`。research F5）は
  `remove(source_idx)` してから `insert(target_idx)` する方式で、3 要素以上のとき単純 swap とは異なる
  結果になる（例: `[t1,t2,t3]` で `t1` を「前へ」→ herdr は `[t2,t3,t1]`（末尾へ移し、間の要素を1つずつ
  詰める）だが、単純 swap 版は `[t3,t2,t1]`（先頭と末尾を丸ごと入れ替える）になり、`t2` の位置が
  design の意図（「間の要素は動かさない」）と食い違う）。
- **決定**: `SessionModel.moveTab` を `Array.prototype.splice` の remove→insert で実装し直した
  （`packages/server/src/session/SessionModel.ts` の `moveTab`。コード内の doc コメントに herdr との
  対応を明記済み）。内側（先頭/末尾以外）の tab を動かすときは結果的に隣接 swap と一致するので、
  design.md が「対象 tab と隣（巡回込み）を配列内で swap する」と書いた意図（`tab.move` の protocol 形を
  `insertIndex` ではなく `direction` にする、という D3 の結論）自体は変わらない——変えたのは
  「巡回時（境界）の具体的な計算式」だけ。
- **理由・代替案**: 代替案（design.md の単純 swap をそのまま実装する）は、3 tab 以上での巡回時に
  herdr と異なる並び順になり、research F5「結果は常に『focus 中の tab とその隣を入れ替える』に一致する」
  という調査結論（herdr の `insert_index` 方式を机上で追跡した帰結）を実装が裏切ることになる。
  splice 方式はこの調査結論と実装を一致させ、かつ `{tabId, direction}` という単純な protocol 形（D3）を
  保ったまま実現できる。
- **見つかった副作用（テストの誤り）**: `SessionModel.test.ts` の `moveTab > wraps around at the ends`
  テストは、design.md の単純 swap 版の想定値のまま書かれており（`[t2,t1,t3]`→`[t3,t1,t2]`）、
  splice 版の正しい挙動（`[t2,t3,t1]`→`[t1,t2,t3]`。上記の机上計算と一致）とは食い違っていた
  （`negative-control-mutation-sweep` の要領で実際に実行して確認——机上の期待値だけで済ませなかった）。
  テストを splice 版の正しい期待値に修正し、意図（境界の巡回が対称であること）が伝わるよう
  「前へ→末尾」「同じ tab を後ろへ→先頭に戻る」の往復に書き換えた。
  **負の確認**（`regression-negative-control` 条項）：修正後のテストが単純 swap 版の欠陥を
  実際に捕まえるか確かめるため、`SessionModel.moveTab` を一時的に単純 swap 版へ戻して実行——
  期待どおり `wraps around at the ends` テストが失敗（`[t2,t3,t1]` を期待するところ `[t3,t2,t1]` を
  受け取った）ことを確認してから splice 版へ戻した（`git diff` で復元後の一致も確認済み）。
- **影響**: `SessionModel.ts` の実装・コメント、`SessionModel.test.ts` の `wraps around at the ends`
  テストの期待値。design.md 自体は「対象 tab と隣（巡回込み）を swap する」という要旨レベルでは
  誤りではない（誤っていたのは擬似コードの計算式のみ）ため、design.md 本文の訂正はしない
  （`decisions.md` にこの記録を残すことで足りると判断——D8 と同様、事後の事実訂正は decisions.md 側で
  行う）。

## D11: `KeySettings.test.ts` の総数アサーション（`toHaveLength(41)`）も更新した（tasks.md 未記載の追加修正）

- **背景**: T13 完了後に `pnpm -s test`（web パッケージ全体）を実行したところ、`KeySettings.test.ts` の
  3件が失敗した。`ACTIONS` の総数を前提にした `document.querySelectorAll(".keys-details")).toHaveLength(41)`
  （35 + navigate 6）が、`ACTIONS` が47個（35 + 12）になったことで実際は `53` になっていた。
  design「対象範囲」の単体テスト一覧にも tasks.md（T12/T13）にも `KeySettings.test.ts` は挙がって
  いなかった（design「`KeySettings.vue` は変更しない」という記述が「テストも触らない」であるかの
  ように読める書き方だった）。
- **決定**: `KeySettings.test.ts` の3箇所（`toHaveLength(41)`→`53`。テスト名の「35 個」→「47 個」）を
  最小差分で修正した。
- **理由・代替案**: `KeySettings.vue` 自体のコード（実装）は design のとおり無変更で正しく動く
  （`ACTIONS` を数えるだけで新しい12操作を自動的に拾う——design AC8 の意図どおり）。しかし
  「動く」ことと「既存のテストが通る」ことは別で、後者はカタログの総数に依存する決め打ちの
  アサーションを持っていたため、コード側は直さず**このテストの期待値だけ**を新しい総数に合わせた
  （実装を変える理由は無い——正しいのはテストの決め打ちの数値が古いこと）。
- **影響**: `packages/web/src/components/KeySettings.test.ts` の3箇所。他に同種の決め打ちが無いか
  `grep -rn "toHaveLength([0-9]" packages/web/src --include="*.test.ts"` で確認済み
  （`HelpDialog.test.ts` には総数のアサーションは無い）。

## D12: deliver の `aidev event deliver start` の打ち忘れ（所要時間は無効）

- **背景**: `aidev-70-deliver`「手順1」は `aidev guard deliver` の直後に `aidev event deliver start` を
  打つ規約だが、台帳の同期（`.aidev/backlog/product-roadmap.md` の消し込み）・変更規模の計測・
  `aidev approve deliver` を先に済ませてしまい、`start` を打たないまま `approved` を記録してしまった
  （`aidev verify` の WARN で気付いた）。
- **決定**: `aidev verify` の指摘どおり、後から辻褄を合わせて ts を捏造しない（protocol.md「8.」）。
  気付いた時点で `aidev event deliver start` を打った（`approved` より後の ts になる、順序が
  ねじれた記録として残る）が、**deliver の所要時間（`start`→`approved` の差）はこの work では
  無効として扱う**——実際の所要時間ではなく、記録漏れによる見かけ上の負の値になるため。
- **理由・代替案**: 過去の ts を推測で埋める代替案は、protocol.md が明示的に禁じている（捏造しない）。
  正直に「無効」と記録するほうが、後続の `aidev metrics`/insights が誤った所要時間を拾わずに済む。
- **影響**: `metrics.yml` の deliver 区間の所要時間は参照しないこと。retro（実施する場合）でこの記録
  漏れ自体を「PJ プロセス / 規約」または「ハーネス自体」の改善提案の材料にできる
  （`aidev-95-retro`「3.」の「記録欠落の検知」参照）。
