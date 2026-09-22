# 調査: キーバインドのプリセット

## 調査の問い

- Q1: 「プリセットを足す」の既存の実装（`applyRecommended`）はどんな形で、何をどこまで一般化すれば
  複数のプリセットに対応できるか。
- Q2: 衝突・予約の判定（`validateAssignment`）は、prefix 付きの割り当てにも直接のキーと同じ規則で
  使えるか（tmux 風プリセットは `%`・`"`・矢印キーなど、prefix の後のキーが中心になる見込みのため）。
- Q3: tmux の既定のキー割り当ては何か（対応表を作る一次資料）。
- Q4: 節「キー」の既存 UI（`KeySettings.vue`）で、プリセットを選ぶ入口をどこにどう差し込むのが
  既存のパターンと一貫するか。

## 判明した事実

- F1: 操作のカタログは `packages/web/src/keys/bindings.ts` の `ACTIONS`（34 個。`全体` 4・
  `workspace / tab` 12・`pane` 18）。各 `ActionDef` は `id`・`label`・`group`・`defaults`
  （`prefix+…` 形式の文字列の配列）・`indexed`（`switch_tab` だけ true）を持つ
  （`packages/web/src/keys/bindings.ts:12-28`、`bindings.test.ts:6-9` が 34 個・群の内訳を固定）。
- F2: `packages/web/src/keys/assign.ts` の `RECOMMENDED_DIRECT`（246-261行）は
  `ReadonlyArray<readonly [ActionId, string]>` 型の表で、10 組の `[操作 id, 直接の chord]`
  （`ctrl+alt+h` のような **prefix 無し**の bare chord）を持つ。`applyRecommended`（277-305行）が
  この表を 1 組ずつ回し、`validateAssignment(working, {kind:"binding", id, via:"direct"}, ...)` で
  検証してから足す。**`via` を `"direct"` に固定している**（290-294行）——tmux 風のように
  `prefix+%` のような prefix 付きの割り当てを足したいときは、この固定を外して `via` を表側の
  各エントリから読み取る必要がある。
- F3: `applyRecommended` は `already`（既に持っている）・`added`（足せた）・`skipped`
  （衝突・予約で足せなかった。理由つき）の 3 分類を返す（263-271行の `RecommendedResult`）。
  **足すたびに `working = resolveKeymap(current).keymap` で表を作り直す**（298-300行）ので、
  同じ一式の中で複数のエントリが同じ chord を取り合う場合も、先勝ちで衝突として扱える
  （`assign.test.ts:599-611` の「一式の中の重なり」テストが確認）。
- F4: chord の文字列表現は `packages/web/src/keys/chord.ts` が正規形を持つ。`parseBinding`
  （chord.ts:300-323）は `"prefix+"` で始まれば `via:"prefix"`、始まらなければ `via:"direct"` を
  返し、`formatBinding`（326-329行）がその逆。**`RECOMMENDED_DIRECT` の bare chord は
  `parseBinding` に通しても `via:"direct"` になる**ので、`RECOMMENDED_DIRECT` をそのまま
  `parseBinding` ベースの一般化された `applyRecommended` に渡しても、既存の挙動は変わらない
  （後方互換）。
- F5: `chordToKeyInput`（chord.ts:388-415）は chord 文字列から `KeyInput` を作る（`validateAssignment`
  に渡す形）。**bare chord だけを受け取る**——`via` は別途 `AssignTarget` に渡す設計なので、
  `parseBinding` で `via` と bare chord に分けたあと、bare chord の方を渡せばそのまま使える。
- F6: 予約チェックは `packages/web/src/keys/keymap.ts` の `RESERVED_AFTER_PREFIX`（30-33行。
  `esc` と `ctrl+shift+v` の 2 件だけ）・`RESERVED_DIRECT`（34行。`ctrl+shift+v` の 1 件だけ）。
  tmux 風プリセットの候補キー（`%`・`"`・`,`・`&`・矢印キー・`d`・`x`・`c`・`n`・`p`・`z`）は
  いずれも予約に当たらない。
- F7: 衝突の案内文は `packages/web/src/keys/assign.ts` の `validateBinding`（166-172行）が持つ
  唯一の場所：`${display(via, c)} は「${labelOf(owner)}」がすでに使っています。`
  （`display` は50行）。「こちらへ移す」のような、衝突相手の割り当てを動かす導線は
  **どこにも実装が無い**（`KeySettings.vue` を含め、この文言を出す以上のことをしていない。
  `KeySettings.vue:65-137` の grep で `replacing`/`owner`/`移す` を検索した結果、置き換え先の
  UI は無い）。この work では対象外（backlog 31 行目の別 work）。
- F8: 節「キー」の UI（`packages/web/src/components/KeySettings.vue`）は、既存の一括操作を
  `.keys-bulk` の中に並べている（422-456行）。現状は
  ［herdr のおすすめの直接のキー（ctrl+alt）を足す］ボタン 1 つ（`addRecommended()`。
  249-264行）と［すべて既定に戻す］ボタン（確認つき）。`addRecommended` は
  `applyRecommended(settings.keymap, settings.keyPrefs)`（`set` 省略＝既定の
  `RECOMMENDED_DIRECT`）を呼び、`added`/`already`/`skipped` を 1 つの案内文にまとめて
  `message.value` に出す（250-264行）。
- F9: `describeSkip`（213-217行）は「足せなかった・戻せなかった理由」を 1 つの節にする既存の
  汎用ヘルパーで、`resetAction`（既定へ戻す）・`addRecommended`（おすすめを足す）の両方が
  共有している。プリセットが増えても、この文言の組み立て方はそのまま再利用できる。
- F10: tmux の既定のキー割り当ては、tmux 公式リポジトリの man page（`tmux.1`。
  <https://raw.githubusercontent.com/tmux/tmux/master/tmux.1>）の DEFAULT KEY BINDINGS 節に
  ある（2026-09-22 に取得して確認）。本製品の操作と対応が明確なものだけを拾うと：
  | tmux の既定キー | tmux の操作 | 本製品の対応する操作 |
  |---|---|---|
  | `%` | split-window -h（左右に分割） | `split_vertical`（右へ分割） |
  | `"` | split-window -v（上下に分割） | `split_horizontal`（下へ分割） |
  | `←`/`→`/`↑`/`↓` | pane の方向移動 | `focus_pane_left`/`right`/`up`/`down` |
  | `x` | pane を閉じる（kill-pane） | `close_pane`（既定 `prefix+x` と同じ） |
  | `c` | 新しい window | `new_tab`（既定 `prefix+c` と同じ） |
  | `n` | 次の window | `next_tab`（既定 `prefix+n` と同じ） |
  | `p` | 前の window | `previous_tab`（既定 `prefix+p` と同じ） |
  | `,` | window の名前変更 | `rename_tab`（本製品の既定は `prefix+shift+t`。別の chord） |
  | `&` | window を閉じる | `close_tab`（本製品の既定は `prefix+shift+x`。別の chord） |
  | `z` | pane の拡大表示切り替え | `zoom`（既定 `prefix+z` と同じ） |
  | `d` | デタッチ | `detach`（本製品の既定は `prefix+q`。別の chord） |
  既定と同じもの（`x`・`c`・`n`・`p`・`z`）は「足す」操作をしても `already`（すでにあった分）に
  分類されるだけで、実害は無い（そのまま表に含めても壊れない。F3）。
- F11: tmux は `0`〜`9` で window 番号を直接選べる（0 始まり）が、本製品の `switch_tab` は
  `indexed: true` の範囲操作（`prefix+1..9`。1 始まり）で、`RECOMMENDED_DIRECT` の表の形
  （`[ActionId, 単一の chord]`）では範囲を表せない。**この work のプリセットの表には含めない**
  （対象外。0 始まりと 1 始まりの食い違いも、番号のずれを生むだけの価値の低い対応になる）。
- F12: tmux の `{`/`}`（pane を配置順で前後に入れ替え）・resize の連続キー（`prefix+Ctrl+矢印`）は、
  本製品の `swap_pane_*`（方向つき）・`resize_mode`（モード）と概念が異なり、1:1 の対応が
  作れない。**この work のプリセットの表には含めない**（対象外。requirements のスコープ節と同じ）。
- F13: すべての候補 chord 文字列（`%`・`"`・`,`・`&`・`left`・`right`・`up`・`down`・`d`・`x`・`c`・
  `n`・`p`・`z`）を `parseChord`／`parseBinding("prefix+"+c)`／`formatBinding` に通して確認済み
  （このセッションの一時テストで 28 アサーション全て pass。commit はしていない）。すべて有効な
  chord で、`prefix+` を付けても往復（parse→format→同じ文字列）する。

## 影響範囲

- `packages/web/src/keys/assign.ts`: `applyRecommended` の `via` 固定を外す一般化（既存の
  `RECOMMENDED_DIRECT` の呼び出しと後方互換であることをテストで守る）。
- 新規: プリセットの表を持つ場所（`assign.ts` に増やすか、新規 `presets.ts` を作るか。design で決める）。
- `packages/web/src/components/KeySettings.vue`: `.keys-bulk` のボタン 1 つを、プリセットを選ぶ
  `<select>` + ［足す］ボタンへ差し替える。
- テスト: `assign.test.ts`（`applyRecommended` の一般化・新しい表の追加）、
  `KeySettings.test.ts`（UI の差し替え）、（あれば）`KeySettings.vue` の E2E。

## 実現性 / リスク

- 一般化そのものは小さい（`via` を表側から読むだけ）。既存の `RECOMMENDED_DIRECT` の形（bare chord
  ＝直接のキー）は変えずに済む後方互換な設計が取れることを F4 で確認済み。
- リスクは主に「対応表の正確さ」——tmux の一次資料（公式 man page）は確認済みだが、それ以外は
  合意された慣習が無いので、対応が薄いものは無理に埋めない（F11・F12）。

## 実装アンカー

- A1: `applyRecommended` の一般化本体 —
  `packages/web/src/keys/assign.ts:277-305`（`RECOMMENDED_DIRECT` の定義は 246-261行）。
- A2: プリセットを選ぶ UI の差し込み先 — `packages/web/src/components/KeySettings.vue:422-462`
  （`.keys-bulk` のブロックと、その直後の `#keys-recommended-note`）。
- A3: 「足す」のロジックの差し替え箇所 — `KeySettings.vue:249-264`（`addRecommended` 関数）。
- A4: 衝突・予約チェックの参照先（変更しない・そのまま使う）— `packages/web/src/keys/keymap.ts:30-34`。

## 実装時の注意

- `applyRecommended` の一般化で、`result.added`/`result.skipped` に積む文字列は「表に書かれた
  そのままの文字列」にする（既存テストが `RECOMMENDED_DIRECT` の bare chord をそのまま比較して
  いるため。`formatBinding` で作り直すと、丸めの過程で既存の文字列と一致しなくなるリスクがある
  ——実際には往復一致するはずだが、確認せずに作り直さない）。
- `KeySettings.vue` の `addRecommended` は `describeSkip` を再利用しているので、プリセット共通の
  文言組み立てはこの関数を壊さない形で拡張する。

## design への申し送り

- プリセットの表の置き場所（`assign.ts` に増やすか新規ファイルか）を決める。
- プリセット選択 UI の具体的な文言・`<select>` の並び順（herdr のおすすめが先頭）を決める。
- tmux 風プリセットの対応表は F10 の表を正典として design に転記する。
