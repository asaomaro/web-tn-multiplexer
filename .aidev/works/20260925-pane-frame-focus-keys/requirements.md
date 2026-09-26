# 要件: pane の枠にフォーカスがある間の prefix・後のキーの割り当てを保護する

## 背景 / 課題

backlog（`.aidev/backlog/product-roadmap.md`）は「サイドバー・tab バーのボタンや pane の枠に
フォーカスがある間も、prefix・直接のキーを効かせる」を1項目として挙げていた。サイドバー・
tab バーの分は `20260925-focus-trapped-keybindings` で対応済み（`@keydown.stop` を無条件の
停止から、無修飾の Enter/Space のときだけ止める選択的な `onButtonKeydown` へ置き換えた）。

しかし `PaneFrame.vue`（pane の枠）を調査した結果（`research.md` 参照）、backlog の記述が
想定していた問題は**既に存在しない**ことが分かった:

（本節は着手時点の記述。T1 round2 taskcheck で `Shift+F10` にも同じ穴があると判明し、
`AC7`・下記「対象」「対象外」を更新した。経緯は `research.md` F5・F11・F12、
`decisions.md` D3 を参照。）

- `pane-frame-edge` はマウスクリックではフォーカスを奪わない設計（`onMouseDown` が
  `preventDefault()` でブラウザの既定のフォーカス付与を防ぐ。research F1）。D11(1) が報告した
  「マウスで押した後にフォーカスが残る」という経路自体が存在しない。
- `onKeydown` は既に選択的で、修飾キー付き（prefix を含む）は無条件で bubble する
  （research F3）。「無条件に keydown を止める」問題は `PaneFrame.vue` には元から無い。

一方で、調査によって**別の、より小さな穴**が見つかった（research F5〜F7・F11）:
`pane-frame-edge` が無修飾で止める5キー（Enter・Space・ArrowDown・ContextMenu・Shift+F10）の
うち、Enter・Space・ArrowDown の3つは、キーの割り当てカスタマイズ画面で**「prefix の後の
キー」として現在割り当て可能**（予約されていない）。ユーザーが `prefix+enter`・
`prefix+space`・`prefix+down` を何らかの操作へ割り当てた場合、Tab キーで pane の枠へ
フォーカスが移った状態（`selected` な pane の枠は tabindex 0 で Tab の対象になる。
research F2）でその prefix 列を押すと、2打目（Enter/Space/ArrowDown）が pane の枠の
`onKeydown` に伝播を止められ、割り当てた操作が実行されない。**Shift+F10 も同じ穴を持つ**——
`F10` は `PaneFrame.vue` 側では shift 付きのときだけ枠のメニューを開くが、`chord.ts` の
`F_KEY` 機構（`NAMED_KEYS` とは別枠）で chord 化できるため、`prefix+shift+f10` として
prefix の後のキーへ割り当てられるだけでなく、`isDirectChord` が F キーを無条件で direct
として通すため**直接のキー（prefix 無し）としても** `shift+f10` を割り当てられてしまう
（Enter/Space/ArrowDown には無い、F10 固有の direct 側の穴。research F11。
T1 round2 taskcheck で発見）。

紐づく charter ゴール: 該当なし（`charter.md` がリポジトリに無いため）。

## 目的 / ゴール

キーの割り当てカスタマイズ画面で、prefix の後のキーとして Enter・Space・ArrowDown・Shift+F10
（と shift 付きの同キー）を割り当てられない状態にし、直接のキー（prefix 無し）としても
Shift+F10 を割り当てられない状態にする（pane の枠のメニューを開く既存のキーと衝突しないように、
割り当ての入口で防ぐ）。

## ユーザーストーリー

- US1: web-tn-multiplexer の利用者として、キーの割り当て画面で prefix の後のキー・直接のキーを
  Enter・Space・ArrowDown・Shift+F10 に変えようとしたときに、割り当てられない理由がその場で
  分かるようにしたい。なぜなら、その状態のまま気づかず使うと、pane の枠にフォーカスが残っている
  ときにだけ理由不明に操作が効かなくなる、という再現しにくい不具合を後から踏むから。
  （受け入れ: AC1, AC2, AC3, AC4, AC5, AC6, AC7）

## スコープ

### 対象

- `packages/web/src/keys/keymap.ts` の `RESERVED_AFTER_PREFIX` に、Enter（`enter`）・
  Space（`space`）・ArrowDown（`down`）・Shift+F10（`shift+f10`）と、前3つの shift 付き
  （`shift+enter`・`shift+space`・`shift+down`）の計7エントリを追加する（`PaneFrame.vue` の
  判定は ctrl/alt/meta だけを見て shift は見ないため、無修飾・shift 付きの両方が対象。
  F10 だけは自分専用のサブ条件で shift 付きのときだけ対象になる。research F3・F10・F11）。
  既存の2エントリ（`esc`＝prefix 取り消し用・`ctrl+shift+v`＝貼り付け用）と同じ形
  （chord → 拒否理由の文字列）。
- `packages/web/src/keys/keymap.ts` の `RESERVED_DIRECT` に Shift+F10（`shift+f10`）を追加する
  （`isDirectChord` が F キーを shift の有無に関わらず direct として通すため。research F11）。
  既存は `ReadonlySet<string>`（`ctrl+shift+v` のみ、拒否理由は「貼り付け」に固定）だったが、
  `shift+f10` は貼り付けと無関係の理由を持つため、`RESERVED_AFTER_PREFIX` と同じ
  `ReadonlyMap<string, string>`（chord → 理由）へ変更する（research F12）。
- 上記追加により、`packages/web/src/keys/assign.ts` の既存の検証ロジック（`RESERVED_AFTER_PREFIX`/
  `RESERVED_DIRECT` を引くだけ。research 実装アンカー A1 参照）が自動的にこれらの chord を
  拒否するようになる——ただし `RESERVED_DIRECT` の型変更に伴い、`assign.ts:138-139` の
  直接のキー側の参照を `.has()` から `.get()` ベースへ書き換える（固定文言のハードコードを
  やめる）。
- 画面（`KeySettings.vue`）が拒否理由をそのまま表示する既存の配線を使う（design で実配線を
  確認し、変更が要るかを判断する）。

### 対象外

- `PaneFrame.vue`・`KeyRouter`・`KeyInputController`・`main.ts` の変更。research F1〜F3 が
  示すとおり、これらの既存の挙動（マウスではフォーカスを奪わない・修飾キー付きは無条件で
  bubble する）は正しく、変更の必要が無い。
- ContextMenu の予約。research F5（訂正後）のとおり、`NAMED_KEYS`・`F_KEY` のどちらにも
  対応が無く chord 文字列として表現する手段が無いため、ユーザーが割り当てようとする経路自体が
  存在せず、予約する対象が無い（F10 は `F_KEY` で表現できるため対象外ではない。上記「対象」参照）。
- 直接のキー（prefix 無し）としての Enter・Space・ArrowDown（と shift 付きの同キー）の予約
  （`RESERVED_DIRECT`）。research F6 のとおり、`assign.ts` の `isDirectChord` が修飾キーの
  無いキー・shift だけを付けたキーを一律拒否する既存の規則により、これらは既に direct として
  割り当て不可能（届かないコードになるので追加しない）。**Shift+F10 だけは例外**——`isDirectChord`
  が F キーを shift の有無に関わらず通すため、この一律拒否に掛からない（上記「対象」参照）。
- 既存の保存済み設定（`wtm.prefs.v1`）の移行。この3キーを既に prefix の後のキーとして
  割り当てているユーザーが実在する可能性は、機能の新しさ（20260921-keybinding-customization
  が起点）と対象キーの希少さから極めて低いと判断し、対応しない（読み込み時に拒否も削除も
  しない——既存の割り当てはそのまま動作し続け、新規の割り当てだけを画面で防ぐ）。
- navigate モード（`prefix+w`）内のキー割り当て（`navigate_open_menu` 等）。research F9 の
  とおり、navigate モードは別のキーマップ・別の処理経路であり、この work の対象
  （prefix 後のキー・直接のキー）とは独立している。

## 機能要件

- キーの割り当て画面で、prefix の後のキーとして `enter`・`space`・`down`・`shift+enter`・
  `shift+space`・`shift+down`・`shift+f10`（chord 正規形）を割り当てようとすると、
  `ctrl+shift+v` の既存の拒否と同じ経路で拒否され、理由が画面に出る。
- キーの割り当て画面で、直接のキー（prefix 無し）として `shift+f10` を割り当てようとすると、
  `ctrl+shift+v` の既存の拒否と同じ経路で拒否され、pane の枠のメニューが理由であることが
  画面に出る（「貼り付け」を理由にした誤った文言にならない）。
- 拒否理由の文言は、pane の枠のメニューを開く既存のキーと衝突するために予約されていることを
  説明する。

## 非機能要件 / 制約

- `PaneFrame.vue`・`KeyRouter`・`KeyInputController`・`main.ts` は無改修。
- 既定の割り当て（`bindings.ts` の `ACTIONS` の `defaults`）に、この7キーを使うものが無いこと
  を coding 工程で改めて確認する（research F4 で一度確認済みだが、変更が別の work で入って
  いないか coding 時点で再確認する）。
- `RESERVED_DIRECT` の型変更（`Set` → `Map`）は、既存の `ctrl+shift+v` の拒否理由文言・挙動を
  変えない（回帰なし。AC4 で確認）。

## 完了条件 (受け入れ基準)

- [ ] AC1: prefix の後のキーとして `enter`（Enter）を割り当てようとすると拒否され、理由が
  画面に出る。
- [ ] AC2: 同様に `space`（Space）を割り当てようとすると拒否される。
- [ ] AC3: 同様に `down`（ArrowDown）を割り当てようとすると拒否される。
- [ ] AC4: 既存の予約（`esc`・`ctrl+shift+v`。prefix の後・直接の両方）の拒否は変わらず動く
  （回帰なし）。
- [ ] AC5: 直接のキー（prefix 無し）の割り当て画面の挙動は、`shift+f10` 以外は変わらない
  （`RESERVED_DIRECT` に `shift+f10` だけを追加するため）。
- [ ] AC6: prefix の後のキーとして `shift+enter`・`shift+space`・`shift+down` を割り当てよう
  とすると拒否され、理由が画面に出る（review 指摘。`PaneFrame.vue` の判定は shift を見ないため、
  無修飾だけでなく shift 付きも同じ穴を持つ）。
- [ ] AC7: `shift+f10` を prefix の後のキー・直接のキーの両方で割り当てようとすると拒否され、
  pane の枠のメニューが理由であることを説明する理由が画面に出る（「貼り付け」の固定文言に
  ならない）。（T1 round2 taskcheck 指摘。research F11・F12）

## 未確定事項 / 確認したいこと

- `KeySettings.vue` が `assign.ts` の拒否理由をそのまま表示する既存の配線を使えるか
  （「スコープ / 対象」参照）は、design 工程で実配線を確認してから判断する。追加の変更が
  要る場合は design の対象範囲に加える。
