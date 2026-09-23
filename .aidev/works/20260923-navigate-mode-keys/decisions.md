# 判断の記録

## D1: research（任意工程）は実施しない

- **背景**: `mode: autonomous` では研究工程の要否も自律的に判定する（`protocol.md`「4.5」・「10.」）。
  オーケストレーターの指示にも「research は今回は不要と判断してよい」とあるが、判定は自分で行うよう明記されている。
- **決定**: `aidev-15-research` は実施しない。
- **理由・代替案**: `protocol.md`「4.5」の5条件を当てる。
  1. 調査で解消すべき未確定事項 → herdr 側の事実（`navigate_workspace_*`・`navigate_pane_*` の存在、
     予約キー `esc`/`enter`/`tab`/`shift+tab`/左右矢印/素の `1`〜`9`）は、`.aidev/works/20260921-keybinding-customization/research.md`
     の F7（`herdr:src/config/keybinds.rs:729-749` を実地に読んで確認済み）に既にある。backlog 項目自身も
     同じ内容を転記している。残る論点（矢印キーの扱いをどう既存動作と両立させるか）は事実確認ではなく
     **設計判断**であり、design 工程の責務。
  2. 未検証の既存挙動 → 変更対象の `NavigateMode.ts`・`bindings.ts`・`assign.ts`・`keymap.ts`・`keyPrefs.ts`・
     `KeySettings.vue`・`HelpDialog.vue`・`main.ts`・`store/settings.ts` は本工程で実物を直読済み。
  3. 技術的実現性 → `chord.ts`/`parseChord`/`chordOf` 等の既存基盤をそのまま使うだけで、新規 API・
     ライブラリの要否は無い。
  4. 影響の横断性 → 触るのは `packages/web/src/keys/` 配下と、それに依存する 2 画面
     （`KeySettings.vue`・`HelpDialog.vue`）に閉じる。34 操作の表（`ACTIONS`・`bindings.ts`）自体は変えない
     （別の表として増設するため）。
  5. 利用者操作の部品 → `KeySettings.vue` の「取り込んで割り当てる」UI パターンは
     20260921-keybinding-customization の research F28 で確立済み（macOS ショートカット・Discord Keybinds 相当）で、
     そのまま再利用する。新規パターンの調査は不要。
  → 5条件いずれも新規調査を要求しない。research はスキップする。
- **影響**: requirements は本 work 内の直読・prior research の転用で確定する。

## D2: navigate の6キーは「別の表」として設計する（既存34操作の `ACTIONS` には載せない）

- **背景**: backlog 項目・`docs/herdr-parity.md` H26 の「対象外」注記のいずれも「prefix なしの素のキーを
  書ける**別の表**」と明記している。既存の34操作（`bindings.ts` の `ACTIONS`）は prefix 系・
  `ctrl/alt/cmd` 必須の直接キー系の2系統の検証規則（`assign.ts` の `validateAssignment`）を持つが、
  navigate の6キーは「prefix 不要・単一文字も許す・`isDirectChord` の modifier 必須規則を課さない」という
  **第三の検証規則**が要る（navigate モードは prefix 状態機械の外＝`KeyRouter.currentMode==="navigate"` で
  独自に `delegateToSubMode` される。terminal モードで入力を奪う心配が無いため）。
- **決定**: `packages/web/src/keys/navigateKeys.ts`（カタログ）・`navigateKeymap.ts`（解決した表）を新設し、
  `ACTIONS`/`ResolvedKeymap`/`KeyPrefs.bindings` とは独立した並行構造にする。保存は同じ `wtm.prefs.v1.keys`
  バケツの下に `navigate` という新しいサブキーを足す（`prefix`/`bindings` と並ぶ3つ目。ブラウザごとの
  設定という性質は共通なので保存先のバケツ自体は分けない）。
- **理由・代替案**: 代替案として「34操作の `ACTIONS` に `group: "navigate"` を足して同じ検証規則に通す」も
  検討したが、(a) 既存の34操作はすべて「prefix の後」か「ctrl/alt/cmd 必須の直接キー」のいずれかで、
  bare な単一文字（`h` 単体等）を許す経路が無く、`isDirectChord` の分岐を navigate 専用に緩めると
  既存34操作の direct 判定まで揺らぐ回帰リスクがある。(b) 予約キー集合も既存の `RESERVED_AFTER_PREFIX`/
  `RESERVED_DIRECT` と別物（`esc`/`enter`/`tab`/`shift+tab`/`left`/`right`/素の `1`〜`9`）で、混ぜると
  どちらの予約規則か読み手が判別しづらくなる。分離のほうが「別の表」という要求にも素直で、
  既存34操作のコード・テストに触れずに済む（回帰面積を最小化）。
- **影響**: `KeySettings.vue` に新しい独立セクションを追加する（`AssignTarget` を拡張せず、navigate 専用の
  target 型・`validateNavigateAssignment` を `assign.ts` に併設）。`tasks.md` でタスクに分解する。

## D4: `NavigateResetTarget` から `"allNavigateKeys"` 分岐を外す（design.md からの実装時の縮小）

- **背景**: design.md の型スケッチは `NavigateResetTarget = { kind: "navigateKey"; id } | { kind: "allNavigateKeys" }`
  だった（T10 実装時）。しかし KeySettings.vue の UI 計画（design「KeySettings.vue の新セクション」）には
  navigate 6操作専用の「すべて戻す」ボタンは無く、既存の全体「すべて既定に戻す」ボタン
  （`settings.resetAllKeys()` → `emptyKeyPrefs()`）が `navigateKeys` も含めて丸ごと既定へ戻す
  （design「設計方針」に明記済み）。
- **決定**: `NavigateResetTarget` は `{ kind: "navigateKey"; id: NavigateKeyId }` の1種類だけにする。
  `planNavigateReset` も単一操作の戻しだけを行う関数にする。
- **理由・代替案**: design.md どおり `"allNavigateKeys"` 分岐を実装する案もあったが、呼び出し元が
  存在しない（UI に対応するボタンが無い）ため、テストで固めない限りデッドコードになる。使われない
  分岐を残すより、実際に使う形だけを実装し、必要になれば後から足す方が保守面で安全（YAGNI）。
  既存34〜35操作の `ResetTarget`（`{kind:"action"}|{kind:"prefix"}|{kind:"all"}`）と非対称になるが、
  `navigate` 側には「prefix 相当」の概念が無く、"all" 相当は上位の `resetAllKeys()` が兼ねるため、
  そもそも対称にする理由が無い。
- **影響**: `design.md` の該当スケッチと実装が一部食い違う（型定義のみ。振る舞い・AC には影響しない）。
  design.md 自体は書き換えない（coding 時点の判断として本ファイルに記録することで足りる。
  `aidev-60-review` で整合性を確認する）。

## D5: T12・T13 の独立点検（taskcheck）を実装直後に漏らし、cross 点検の後で気づいて追加実施した

- **背景**: T12（`store/settings.ts` 拡張）・T13（その単体テスト）を実装した直後、`aidev taskcheck
  start T12`/`T13` を打たずに次のタスク（T14）へ進んでしまった。全19タスク完了後、`aidev taskcheck
  status` で一覧を見て T12・T13 だけ行が無いことに気づいた（`cross`（手順5.5）は先に実施済みだったが、
  cross はタスク単位の欠陥を拾う射程ではないため、この漏れ自体は cross でも検出されない）。
- **決定**: 気づいた時点で T12・T13 の `aidev taskcheck start` を実施し、通常の1タスク点検と同じ
  手順で潰す（`cross` の再実施はしない——cross は「タスクをまたぐ不変条件」が射程で、T12・T13 単体の
  点検漏れを埋めても cross の観点は変わらないため、二重に回す必要は無いと判断）。
- **理由・代替案**: 「もう cross まで終えたので後回しにする」という選択肢もあったが、`mode: autonomous`
  では上流4文書と全タスクの独立点検が必須（`protocol-check.md`「(b)」「`mode: autonomous` では必須」）
  で、抜けたまま承認すると `aidev verify` が拾う可能性があり、何より「人間の目が入らない」という
  autonomous の前提そのものに反する。気づいた時点で埋めるのが唯一の妥当な対応。
- **影響**: T12・T13 の点検結果は本ファイルの後続、`review.md`「タスク点検ログ」に追記する。
  `metrics.yml`／`aidev approve coding` の `task_checks`/`task_check_findings` は最終的に19タスク分
  （+cross）を反映する。

## D6: `NavigateMode.ts` の `ArrowLeft`/`ArrowRight` 固定 case を「bare（修飾無し）のときだけ」に限定した
    （review ラウンド1の must 修正。既存動作への副作用を記録）

- **背景**: 60 review ラウンド1で、`NavigateMode.handle()` の `case "ArrowLeft":`/`case "ArrowRight":`
  が修飾キー（ctrl/alt/shift/meta）を見ずに `k.key` だけで分岐していたため、予約されていない修飾付き
  矢印 chord（`ctrl+left` 等）を他の navigate 操作へ割り当てても、実際に押すと表を無視して常に固定の
  pane 左右移動が起きる「幽霊バインディング」になることが判明した（must 指摘）。
- **決定**: 固定 case を「修飾キーが1つも無いとき（`!k.ctrl && !k.alt && !k.shift && !k.meta`）だけ」に
  限定し、修飾付きの矢印は他の bare でないキーと同様に `chordOf`→表引きの経路へ通す。
- **理由・代替案**: 代替案（a）「`NAVIGATE_RESERVED_CHORDS` に `ctrl+left`/`alt+left` 等の修飾付き
  バリエーションも網羅的に追加し、割り当て自体をそもそも拒否する」は、herdr の予約仕様（research F7）が
  bare な `left`/`right` だけを予約しており、修飾付きは意図的に予約されていないため、herdr 互換を
  損なう。今回の決定（表引きを優先し、固定 case は bare のときだけ）が herdr の仕様と実装の両方に
  忠実。
- **影響（既存動作への副作用）**: この修正により、**修飾付き矢印キー（例: Ctrl+ArrowLeft）を navigate
  モード中に押したときの挙動が、この work の着手前の実装（今回さかのぼって直した対象そのもの）から
  変わる**——旧実装では常に pane 左移動が起きていたが、修正後は既定の表に何も割り当てが無いため
  無反応になる（AC3 の回帰テスト対象である5件の既存 `NavigateMode.test.ts` アサーションはいずれも
  bare な `ArrowLeft`/`ArrowRight` しか使っておらず、この変更では1件も壊れない）。この副作用は
  意図的かつ必要——修正しなければ「割り当てたのに効かない」という新機能の信頼性そのものを損なう
  バグが残る。修飾付き矢印キーで navigate 移動する操作は本製品・herdr のどちらの文書にも記載が無い
  未定義の組み合わせであり、後方互換の対象にはならないと判断した。
- **回帰テスト**: `NavigateMode.test.ts`「修飾付きの矢印（ctrl+left 等）は『予約されていない』ので
  他の操作へ割り当てられ、実際に押すと表を引く」・「修飾付き矢印に何も割り当てていなければ無反応」、
  `assign.test.ts`「ctrl+shift+v も予約される」、`navigateKeys.test.ts` の予約個数（15→16）更新。
  いずれも `.aidev/conventions/regression-negative-control.md` に従い、修正前のコード（固定 case を
  bare 限定にする前・`ctrl+shift+v` を予約に入れる前）に戻して4件とも failed になることを確認して
  から元に戻した（`test-result.md` に生の出力を貼付）。

## D3: 矢印キー（left/right）は予約のまま、既存の pane 左右移動の挙動を「表の外の固定動作」として残す

- **背景**: 予約リスト（esc/enter/tab/shift+tab/left/right/素の1〜9）には左右の矢印が含まれるが、
  上下の矢印は含まれない。一方、現行の `NavigateMode.ts` は `ArrowLeft`/`ArrowRight` を `h`/`l` の別名として
  pane の左右移動に使っている（`ArrowUp`/`ArrowDown` は workspace の上下移動の唯一のキー）。予約キーは
  「この表に割り当てられない（読み込み・取り込みのどちらでも登録できない）」ものなので、`navigate_pane_left`/
  `navigate_pane_right` の既定値に `left`/`right` を含めると、既定登録の時点で予約チェックに落ちて
  何も登録されない矛盾が生じる。
- **決定**: `navigate_pane_left`/`navigate_pane_right` の**表としての既定**は `h`/`l` のみとする
  （ユーザーが変更・削除できる）。`ArrowLeft`/`ArrowRight` は表とは別に、`NavigateMode.handle()` に
  `Enter`/`Escape` と同格の**固定 case**として残し、常に pane 左右移動を行う（変更・削除できない）。
  `navigate_workspace_up`/`navigate_workspace_down` の既定は `up`/`down`（表に載る。ユーザーが変更・削除できる
  ——上下矢印は予約されていないため）。
- **理由・代替案**: 代替案（a）「矢印キーでの pane 左右移動を今回廃止し、`h`/`l` のみにする」は、
  `.aidev/works/20260921-keybinding-customization/requirements.md` 以来の「既存の挙動は変えない」という
  本リポジトリの一貫方針（旧 `DEFAULT_KEYMAP` を固定した値との 1:1 を単体テストで守る、という規約）に反し、
  かつ backlog にも既存挙動を壊す指示は無い。代替案（b）「予約リストを字面どおりに解釈せず矢印キーを
  表に含める」は、予約キーの意味（herdr 側で navigate モードの他機能のために取っておく枠）と矛盾する。
  固定動作として表の外に残す（決定どおり）が、予約の意味・既存挙動の両方を満たす。
  `tab`・素の `1`〜`9` は現行実装で使っていないため、対応する固定 case は追加しない（将来 herdr 追随機能の
  ための予約のまま）。`esc`/`enter` は既存どおり `NavigateMode` 自身の確定/取消に使うため触らない。
- **影響**: `NavigateMode.test.ts`・`NavigateMode.ts` を変更するが、**既存の入出力（Arrow/h/j/k/l/Enter/Escape
  の挙動）は変えない**——regression のための 1:1 テストは維持できる。design.md で図示する。
