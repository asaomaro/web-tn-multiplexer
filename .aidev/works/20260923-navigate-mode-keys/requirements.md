# 要件: navigate モードの移動キーを変えられるようにする

## 背景 / 課題

herdr は `navigate_workspace_up/down`・`navigate_pane_left/down/up/right` の6操作を、prefix を使わない
素のキーで個別に変更できる（`.aidev/works/20260921-keybinding-customization/research.md` F7）。
本製品は 20260921-keybinding-customization でキー割り当て全体をカスタマイズ可能にしたが、navigate
モードの中のこの6操作だけは対象外として明示的に見送っていた（同 requirements.md「対象外」・
`docs/herdr-parity.md` H26 の「対象外」注記）。navigate モード自体に入るキー（`prefix+w`）や resize・copy
モードに入るキーはすでに変更できるのに、navigate モードの中の6つの移動キーだけが固定のままなのは
一貫性を欠く。

## 目的 / ゴール

navigate モード（`prefix+w`）に入っている間の6つの移動操作（workspace の上下選択・pane の上下左右移動）
について、利用者が節「キー」から個別に別のキーへ変更・既定へ戻せる状態にする。ただし copy・resize モードの
中のキーは herdr でも固定なので、この work では変えない（backlog 自身の指定どおり）。

## ユーザーストーリー

- US1: キーボード配列や好みが herdr の既定（h/j/k/l 等）と合わない利用者として、navigate モードの
  6つの移動キーを自分の好きなキーへ変更したい。なぜなら、prefix・34操作は既に変更できるのに、
  navigate モードに入った後だけ操作方法が変えられないのは一貫性が無く、使いにくいから。
  （受け入れ: AC1, AC3, AC5, AC6）
- US2: 複数人でこのブラウザを共有する／既存の設定を壊したくない利用者として、この機能を使わなければ
  今までどおりの矢印キー・h/j/k/l が働き続けてほしい。なぜなら、意図せず既存の操作感が変わると
  混乱するから。（受け入れ: AC3, AC8）
- US3: 割り当てを変更した利用者として、その時点で navigate モードの中に何が割り当てられているかを
  キー一覧（`prefix+?`）で確認したい。なぜなら、変更した内容を忘れたり、他の端末・他の人の画面と
  食い違ったまま操作して混乱したくないから。（受け入れ: AC7）

## スコープ

### 対象

- navigate モードの6つの移動操作（`navigate_workspace_up`・`navigate_workspace_down`・
  `navigate_pane_left`・`navigate_pane_down`・`navigate_pane_up`・`navigate_pane_right`）を、
  prefix なしの素のキー1打として個別に変更・追加・削除・既定に戻せるようにする。
- この6操作専用の予約キー（`esc`・`enter`・`tab`・`shift+tab`・左右矢印・修飾無しの `1`〜`9`）を
  割り当て不可として検証・拒否する（herdr の予約と同じ。research F7）。
- 既存の34操作の割り当て体系（`bindings.ts` の `ACTIONS`・prefix・直接キー）とは別の表として実装する
  （backlog・H26 が明記する「別の表」）。
- 設定画面「キー」節への新しい編集 UI（新セクション）。
- キー一覧ダイアログ（`prefix+?`）の「移動」群を、固定の文言から現在の割り当てを反映する表示へ変える。
- `docs/herdr-parity.md` H26 の記述更新（「対象外」から navigate 移動キーの行を外し、実装内容を追記）。

### 対象外

- navigate モードの中の `Enter`（決定）・`Escape`（取消）の挙動・キー自体（この6操作に含まれない。
  今までどおり固定）。
- resize・copy モードの中のキー（herdr でも固定。backlog が明示的に対象外としている）。
- herdr にあって本製品に操作自体が無いもの（前後 workspace 移動・直前 pane・tab 並べ替え・resize の
  直接キー・agent 移動等。別の backlog 行）。
- 独自コマンドのキー（H12。別の backlog 行）。
- E2E テストの新規追加・拡充（このセッションでは明示のユーザー依頼が無いため、単体テストと
  `aidev smoke` で検証する。`.aidev/conventions/e2e-observe-browser.md` の対象範囲外の判断）。

## 機能要件

- 6操作それぞれに、1つ以上の bare キー（prefix なし・単一の chord。例: `h`・`ctrl+j`・`f2`）を
  割り当てられる。
- 予約キー（`esc`・`enter`・`tab`・`shift+tab`・`left`・`right`・修飾無しの `1`〜`9`）は、既定・利用者の
  割り当てのどちらでも登録できない（登録しようとすると理由付きで拒否する）。
- 6操作間で同じキーの取り合いは起きない（後から登録しようとした側を拒否し理由を示す。既存34操作の
  「先勝ち」の流儀に合わせる）。
- 既定の割り当ては現行の固定値と一致させる：`navigate_workspace_up`=`up`・`navigate_workspace_down`=`down`・
  `navigate_pane_left`=`h`・`navigate_pane_down`=`j`・`navigate_pane_up`=`k`・`navigate_pane_right`=`l`。
- `ArrowLeft`・`ArrowRight` は予約キーであるため上記の表には載らないが、pane の左右移動という**既存の
  挙動**は落とさない——表の外の固定動作として維持し、6操作の割り当てをどう変えても常に効く（decisions D3）。
- 割り当ては即座に反映・保存する（確定ボタンを置かない。既存34操作の流儀と同じ）。ブラウザごとに保存する
  （既定との差だけを持つ）。同じブラウザの別ウィンドウ・タブでの変更にも追従する（既存34操作の割り当て
  ＝`store/settings.ts` の `storage` イベント追従と同じ仕組みへ、この6操作の保存値も乗せる）。
- 操作ごとに既定へ戻せる。

## 非機能要件 / 制約

- 既存34操作・prefix・resize・copy モード・navigate モードの `Enter`/`Escape` の挙動は一切変えない
  （回帰させない。既存の単体テストが 1:1 で固定した値を守る）。
- 保存形式は後方互換を保つ（既存の `wtm.prefs.v1.keys.prefix`/`keys.bindings` は変えず、新しいサブキーを
  追加する形にする）。壊れた・読めない保存値は値ごとに落とし、他の設定に影響しない。

## 完了条件 (受け入れ基準)

- [ ] AC1: 節「キー」に、navigate モードの6操作それぞれの割り当てを変更・追加・削除できる新しいセクションがある。
- [ ] AC2: 予約キー（`esc`・`enter`・`tab`・`shift+tab`・`left`・`right`・修飾無しの `1`〜`9`）を割り当てようとすると、
      理由付きで拒否され、割り当ては変わらない。
- [ ] AC3: 何も変更していない状態での挙動は今までと完全に一致する（`navigate_workspace_up`=`up`・
      `navigate_workspace_down`=`down`・`navigate_pane_left`=`h`・`navigate_pane_down`=`j`・
      `navigate_pane_up`=`k`・`navigate_pane_right`=`l`・`ArrowLeft`/`ArrowRight` は常に pane 左右移動）。
- [ ] AC4: 6操作の間で同じキーを重ねて割り当てようとすると、理由付きで拒否される。
- [ ] AC5: 操作ごとに「既定に戻す」ができる。
- [ ] AC6: 割り当ての変更は即座に反映され（設定ダイアログを閉じ直さなくても navigate モードで効く）、
      ブラウザごとに保存される（別ウィンドウ・タブでの変更にも追従する）。
- [ ] AC7: キー一覧（`prefix+?`）の「移動」群が、現在の割り当てを反映して表示する。
- [ ] AC8: 6操作以外（`Enter`/`Escape`・resize・copy モードの中身）の挙動は変わらない。既存の単体テストが通る。
- [ ] AC9: `docs/herdr-parity.md` H26 を更新する（「対象外」から navigate 移動キーの記述を外し、実装内容・
      herdr との違いを追記する）。

## 相互作用の受け入れ基準（UI を伴う work のみ）

- [ ] AC-I1 開く / 閉じる: 設定ダイアログの節「キー」の新セクションから、押したい操作の［変更］／［追加］
      ボタンで取り込み待ちに入る。`Escape` で取り消す（既存34操作の取り込みと同じ経路・同じ部品を再利用する）。
- [ ] AC-I2 確定 / 取り消し: 押した瞬間のキーで確定する（確認ダイアログなし）。取り消し（`Escape`）では
      元の割り当てのまま変わらない。
- [ ] AC-I3 キーボードだけで完結するか: ボタンへのフォーカス移動・取り込み・結果の読み上げまで、
      マウス無しで完結する（既存34操作の編集と同じ部品・同じ `role="status"` を使う）。
- [ ] AC-I4 フォーカスの行き先: 変更確定後は変更後の割り当ての［変更］ボタンへ、削除後は次の部品へ戻る
      （既存34操作の挙動と同じ）。
- [ ] AC-I5 既存の操作を妨げないか: 取り込み待ちの間のキーは `preventDefault`/`stopPropagation` で
      端末・prefix 状態・ブラウザの標準動作へ漏らさない（既存の `captureAttrs`/`onCaptureKeydown` を再利用）。

## 未確定事項 / 確認したいこと

- なし（矢印キーの扱いは decisions D3 で設計判断として確定済み）。
