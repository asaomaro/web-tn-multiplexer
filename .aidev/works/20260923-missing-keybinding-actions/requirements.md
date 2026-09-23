# 要件: herdr にあって本製品に操作自体が無いものを足して割り当てられるようにする

## 背景 / 課題

20260921-keybinding-customization で本製品はキー割り当て全体をカスタマイズ可能にしたが（`bindings.ts` の
`ACTIONS`。2026-09-23 時点で35操作）、herdr の `[keys]` にあって本製品には**操作自体が実装されていない**
ものは対象外として見送っていた（`docs/herdr-parity.md` H26 の「対象外」注記）。それに当たるのが次の
操作群——前後の workspace 移動（`previous_workspace`・`next_workspace`）・直前の pane（`last_pane`）・
tab の並べ替え（`move_tab_previous`・`move_tab_next`）・pane の resize の直接キー
（`resize_pane_left/down/up/right`。方向ごとに4つ）・agent への移動（`previous_agent`・`next_agent`・
`focus_agent`）——で、herdr の操作名としては9個、本製品に追加する `ActionId` としては12個になる
（resize の4方向をそれぞれ別の `ActionId` として登録するため。詳細は「スコープ」節）。既定キー無しの
操作の割り当て UI 自体は既に確立している（`KeySettings.vue`）ので、これらの操作が動く実体さえ足せば、
利用者は自分の好きなキーを割り当てて使えるようになる。

`edit_scrollback`（scrollback を `$EDITOR` で開く）・`reload_config`（設定の再読み込み）も同じ
「対象外」注記に列挙されているが、**この2つは別の backlog 行が実装を担当する**（`edit_scrollback`＝
「端末機能の拡張」、`reload_config`＝「外観と設定の残り」。`reload_config` は既に実装済みで
`NOT_YET_BINDINGS` からも外れている）。本 work はこの2つには触れない。

## 目的 / ゴール

herdr にあって本製品に操作自体が無かった上記の操作群が実装され、節「キー」から利用者が任意のキーを
割り当てて使える状態にする。herdr の既定がすべて「割り当てなし」であるのに合わせ、本製品でも既定キーは
付けない状態で出荷する——割り当てて初めて効く（実装方法は機能要件・design で扱う）。

紐づく charter ゴール: charter.md がないため対象外（プロジェクトに `.aidev/charter.md` は存在しない）。

## ユーザーストーリー

- US1: tmux・herdr に慣れた利用者として、直前にフォーカスしていた pane へ 1 打で戻りたい
  （`last_pane`）。なぜなら、複数の pane を行き来する作業で、いちいち方向キーや goto を使わずに
  「さっきの場所」へすぐ戻れると効率が上がるから。（受け入れ: AC1, AC2, AC8）
- US2: 複数の workspace を並行して使う利用者として、前後の workspace へ 1 打で移動したい
  （`previous_workspace`・`next_workspace`）。なぜなら、`prefix+w` の navigate モードを経由せず、
  tab の `prefix+n`/`prefix+p` と同じ感覚で workspace も直接切り替えたいから。（受け入れ: AC3, AC4, AC8）
- US3: 1つの workspace に多くの tab を開く利用者として、tab の並び順を自分で入れ替えたい
  （`move_tab_previous`・`move_tab_next`）。なぜなら、作業の途中で tab の並びが使いにくくなったとき、
  閉じて作り直さずに並べ替えたいから。（受け入れ: AC5, AC8）
- US4: resize モード（`prefix+r` → h/j/k/l）を使わず pane の大きさを素早く調整したい利用者として、
  resize の各方向に直接キーを割り当てたい（`resize_pane_left/down/up/right`）。なぜなら、モードに
  入って抜けるより、1 打の chord のほうが手早い場面があるから。（受け入れ: AC6, AC8）
- US5: 複数の agent（Claude Code・Codex 等）を並行して動かす利用者として、agent が動いている pane
  だけを次々に移動したい（`previous_agent`・`next_agent`・`focus_agent`）。なぜなら、サイドバーの
  agents 区画をクリックしなくても、キーボードだけで手を動かす必要がある agent へ最短で辿り着きたいから。
  （受け入れ: AC7, AC8）

## スコープ

### 対象

- 次の12個の `ActionId` を `bindings.ts` の `ACTIONS` に、既定キー無し（`defaults: []`）で登録する：
  `previous_workspace`・`next_workspace`・`last_pane`・`move_tab_previous`・`move_tab_next`・
  `resize_pane_left`・`resize_pane_down`・`resize_pane_up`・`resize_pane_right`・`previous_agent`・
  `next_agent`・`focus_agent`。
- 各操作の実際の振る舞い（`ActionDispatcher` への実装）。
- `move_tab_previous`/`move_tab_next` は、本製品にまだ無い「tab の並べ替え」自体をサーバ側に実装する
  （新しい protocol メソッド・`SessionModel`/`SessionService` の変更を含む）。
- `docs/herdr-parity.md` H26 の更新（「対象外」の列挙から本 work の対象操作分を外し、実装内容・herdr との違いを
  追記する新しい H26d 行を追加する）。

### 対象外

- `edit_scrollback`（scrollback を `$EDITOR` で開く）・`reload_config`（設定の再読み込み）の実装本体。
  別の backlog 行（前者は「端末機能の拡張」、後者は「外観と設定の残り」＝実装済み）。
  `keymap.ts` の `NOT_YET_BINDINGS`（現在 `"e"` の1件）は変更・削除しない。
- 独自コマンドのキー（`docs/herdr-parity.md` H12）。別の backlog 行。
- キー割り当ての仕組み自体の変更（取り込み UI・予約キー・衝突判定・prefix の記法等）。
  20260921-keybinding-customization で確立済みのものをそのまま使う——本 work は**操作を足す**work で
  あって**割り当てを変える**work ではない（出典: `.aidev/works/20260921-keybinding-customization/requirements.md`
  「対象外」）。
- E2E テストの新規追加・拡充（明示のユーザー依頼が無いため、単体テストと `aidev smoke` で検証する。
  `.aidev/conventions/e2e-observe-browser.md` の対象範囲外の判断）。
- `wtmctl`（外部操作 CLI。`packages/cli/`）への `tab.move` の対応追加。`packages/cli/src/commands/tab.ts`
  は `tab.create`/`tab.close` しか持たない**意図的な抜粋**で、protocol の全メソッドを機械的に反映しては
  いない（確認済み。2026-09-23 時点）。加えてこのパッケージは同じブランチの別 work
  （20260923-external-control-api）が所有するため、本 work では一切変更しない。

## 機能要件

- **`previous_workspace`/`next_workspace`**: 現在の workspace から、サイドバーの「spaces」に表示される
  順序（`view.workspaceSort` を反映した順）で前後の workspace へ直接切り替える（navigate モードを経由
  しない）。末尾・先頭で反対側へ巡回する。workspace が1つしか無ければ何も起きない。
- **`last_pane`**: 「直前にフォーカスしていた1つの pane」を workspace・tab をまたいで常に1つだけ覚え、
  1打でそこへフォーカスを移す（focus が変わるたびに「その前にいた pane」へ上書きする、tmux の
  `last-window` と同じトグル方式。履歴スタックではない）。直前の pane が既に閉じている、または現在の
  focus と同じ場合は何も起きない。
- **`move_tab_previous`/`move_tab_next`**: 現在の tab を、同じ workspace 内で隣の位置と入れ替える
  （前へ/後ろへ）。先頭の tab を「前へ」で末尾へ、末尾の tab を「後ろへ」で先頭へ巡回する。tab が1つしか
  無ければ何も起きない。並べ替えの結果は他のブラウザにも反映される（サーバ側の状態）。
- **`resize_pane_left`/`resize_pane_down`/`resize_pane_up`/`resize_pane_right`**: resize モードへ入らずに、
  フォーカス中の pane をその方向へ1段階だけ直接リサイズする（既存の resize モードの1段階と同じ量）。
- **`previous_agent`/`next_agent`**: サイドバーの「agents」区画に表示される順序（`view.agentSort` を
  反映した順。状態を問わず、agent が検出されている pane すべてが対象）で、前後の agent の pane へ
  workspace・tab をまたいで直接フォーカスを移す。対象が無ければ何も起きない。今フォーカス中の pane が
  agent の一覧に無いときは、`next_agent` は先頭へ・`previous_agent` は末尾へ移る。
- **`focus_agent`**: 上と同じ順序の一覧に対し、範囲キー（`prefix+1..9` 等。既存の `switch_tab` と同じ
  「範囲の操作」の仕組み）で 1〜9 番目の agent へ直接ジャンプする。該当する順位の agent が無ければ
  何も起きない。
- 12個とも既定の割り当ては無し（herdr の既定にも本製品独自にも、割り当てなしのまま出荷する）。
- 12個とも節「キー」（`KeySettings.vue`）から追加・変更・削除・既定に戻す操作ができ、キー一覧
  （`prefix+?`）に現在の割り当て（未割り当てなら「なし」）が表示される——**これは既存の仕組みがそのまま
  面倒を見る**（`ACTIONS` に登録しさえすれば自動的に対応する）ので、UI 側の新規実装は不要と見込む
  （design で最終確認する）。

## 非機能要件 / 制約

- 既存35操作・prefix・navigate・resize・copy モードの挙動は一切変えない（回帰させない。既存の単体テストが
  1:1 で固定した値を守る）。
- `move_tab_previous`/`move_tab_next` で追加するサーバ側の並べ替えは、既存の workspace/tab の作成・削除・
  フォーカスの protocol パターン（`tab.rename`・`tab.focus` 等）に揃える。
- `previous_agent`/`next_agent`/`focus_agent` が参照する「agent の順序」は、サイドバーの表示順序
  （`Sidebar.vue` の `agents` 計算）と食い違わない（利用者が画面で見ている順と操作の対象順が一致する）。

## 完了条件 (受け入れ基準)

AC9・AC10 は特定のユーザーストーリーに紐づかない横断的な基準（ドキュメント整合性・回帰なしという、
全操作に共通の非機能要件から導かれるもの）として並べる。

- [ ] AC1: `last_pane` を割り当てて押すと、直前にフォーカスしていた pane（別の workspace・tab でもよい）
      へフォーカスが移る。
- [ ] AC2: `last_pane` を連続で2回押すと、元の pane へ戻る（トグル。直前の pane が既に閉じていれば
      何も起きない）。
- [ ] AC3: `previous_workspace`/`next_workspace` を割り当てて押すと、サイドバーの「spaces」の表示順で
      前後の workspace へ切り替わる（末尾・先頭で巡回する）。
- [ ] AC4: workspace が1つしか無いときに `previous_workspace`/`next_workspace` を押しても何も起きない
      （エラーにならない）。
- [ ] AC5: `move_tab_previous`/`move_tab_next` を割り当てて押すと、現在の tab が同じ workspace 内で
      隣の位置と入れ替わる（先頭/末尾で巡回する）。別のブラウザでも同じ並び順で見える。
- [ ] AC6: `resize_pane_left/down/up/right` をそれぞれ割り当てて押すと、resize モードに入らずに
      フォーカス中の pane がその方向へ1段階リサイズされる。
- [ ] AC7: `previous_agent`/`next_agent` を割り当てて押すと、サイドバーの「agents」の表示順で前後の
      agent の pane（workspace・tab をまたぐ）へフォーカスが移る。agent が1つも無ければ何も起きない
      （AC7a）。`focus_agent` に範囲キーを割り当てて対応する数字を押すと、その順位の agent の pane へ
      直接ジャンプする。agent は1つ以上あるが、その順位の agent が無い（例: agent が3つしか無いのに
      5番を押した）ときも何も起きない（AC7b）。
- [ ] AC8: 12個とも、節「キー」に「なし」（未割り当て）として現れ、追加・変更・削除・既定に戻す操作が
      できる。キー一覧（`prefix+?`）にも現在の割り当てが反映される。
- [ ] AC9: `docs/herdr-parity.md` H26 が更新され、本 work の対象操作が「対象外」の列挙から外れる
      （`edit_scrollback` は引き続き対象外のまま残す）。
- [ ] AC10: 既存35操作・prefix・navigate・resize・copy モードの単体テストが変更なく通る（回帰なし）。

## 未確定事項 / 確認したいこと

- なし。`last_pane`・`previous_agent`/`next_agent`/`focus_agent` の正確な意味論は backlog の一文だけでは
  確定できなかったが（履歴スタックかトグルか／対象は agent の状態を問わないか／`focus_agent` は一覧を
  開くのか直接ジャンプするのか）、herdr のソース（`da6bcd5969779bfe0396bcf89a8025d4375d611e`。
  `src/config/model.rs`・`src/client/shell/actions.rs`・`src/client/shell/agent_sidebar.rs`・
  `src/client/shell/state.rs`）を直読して解消済み（`research.md` F1〜F4）。上の機能要件・完了条件の
  記述はこの調査結果を反映した確定版である。
