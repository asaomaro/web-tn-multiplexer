# 決定記録

## D1: requirements の独立点検は、委譲が停止したため同一セッションで行う

- 背景: `aidev doccheck start requirements --mode delegated` の後、点検を委譲したサブエージェントが約 8 分後に「stopped by user」で停止した。
  結果（指摘）は 1 件も返っていない。停止は私が行ったものではなく、理由も分からない。
- 決定: **委譲の点検は断念**（requirements）。同じ委譲を出し直さず、protocol-check.md「(a)」のフォールバックどおり、
  同一セッションで観点を切り替えて読み直し、`--mode same_session` で記録する。
- 理由 / 代替案: 停止が利用者の意図だった可能性を排せないので、同じ委譲の再実行は避けた。点検自体は `autonomous` で必須なので省かない。
  コンテキスト分離は失う（同じ書き手が読む）ので、点検の観点は文書の内部一貫性（AC↔ストーリー・スコープ↔AC・用語）に絞る。
- 影響: `metrics.yml` の requirements の点検は `delegated`（結果なし）と `same_session` の 2 つの start になる。

## D2: research の読解の大半は、requirements の点検の待ち時間に済ませた

- 背景: 委譲した点検を待つ間（約 8 分）に、herdr のソースの読解・Chromium の実測（キーの `event.key`・ダイアログの Esc）・実装の現物の確認を進め、
  `research.md` の下書きまで書いた。`aidev event research start` はその後（requirements の承認後）に打った。
- 決定: 記録は打った時刻のまま（ts は捏造しない）。
- 影響: `metrics.yml` の research の所要時間は、実際の調査時間より**短く見える**。定量分析では research の所要を過小評価として扱う。

## D3: T18（全体の回帰）は coding ではなく test 工程で消化する

- 背景: T18 は「単体・E2E の一式・smoke を走らせて受け入れ基準を判定する」実行だけのタスクで、書くコードが無い。`aidev coverage --strict` は AC12（既存の単体・E2E が通る）を
  タスクに落とすことを求める。
- 決定: T18 は tasks に立てるが、**coding では実行せず未チェックのまま承認し、test 工程で消化する**（`aidev-30-tasks` の手順 6・`aidev-40-coding` の完了の目安の例外）。
- 理由 / 代替案: coding の途中で一式を回すと、修正のたびに全部を回すことになり時間に見合わない（利用者の方針：該当 spec だけを回し、一式は deliver 直前に 1 回）。
- 影響: coding の承認時に T18 が未チェックで残る。test 工程の `test-result.md` に一式の結果を貼る。

## D4: design の点検（15 件）を受けた requirements への書き戻し

- 背景: design の独立点検（委譲。15 件）で、requirements の文言が design の決定より粗い箇所が見つかった。design の決定が妥当と判断し、requirements を**精密化する形で書き戻す**
  （受け入れ基準の意図は変えない）。書き戻したのは次の 5 か所。
  - AC5：直接のキーに使えないものに「名前のあるキー（tab・enter・矢印等）」を明記（design D4。修飾なしの名前つきキーも端末への入力を奪う）。
  - AC6(d)：修飾キー単体は「取り込まず、次のキーを待ち続けて理由を示す」（chord の途中で押されるため。AC-I2 も同じ）。
  - AC6(e)：「AltGr が押されたキー」を「AltGr で別の文字に合成されるキー」に（design D6a。Firefox・Windows は Ctrl+Alt を押すだけで AltGraph が真になるため、押されたこと自体では拒否できない）。
  - AC9：「戻した結果が AC2 と同じ」は**すべて**を戻すとき。操作ごと・prefix は、既定のキーを別の操作が使っていれば戻さず知らせる（design D10）。
  - AC-I4：押したボタンが作り直されるときは、新しい割り当ての同じ役目のボタンへ。
- 決定: 上記の書き戻しと、design の追記（範囲は shift 不可・直接のキーは「ctrl・alt・cmd を含む chord か F キー」・節の位置は最後・`prefixKeyInput()`・`isAltGrComposed` の US 配列の表・
  読み込みで全部落ちた操作は既定へ戻す・図に store を追加）を行う。
- 理由 / 代替案: requirements を直さずに design だけを直すと、AC の文言と design の対応が食い違ったまま残る。AC の**意図**は変えない（拒否する対象・戻す対象の範囲を正確にしただけ）。
- 影響: requirements の承認後の変更。`aidev coverage` の AC の ID は変わらない。tasks の T1・T5・T6 に追記した。

## D5: architecture 工程は挟まない

- 背景: autonomous では、protocol.md「4.5」の architecture の 4 条件のどれかを検知したら実施する。今回は「インターフェース／データモデルが複雑（型・スキーマ・状態遷移）」に当たりうる
  （`ResolvedKeymap`・`KeyPrefs`・取り込みの状態機械）。
- 決定: **挟まない**。
- 理由: その 3 つは design の「インターフェース / データ構造」（型・文法・カタログ）と「振る舞いの詳細」（Router の分岐・取り込みの状態遷移図・保存の読み書き）で、
  architecture.md が書く内容（構造・型・状態遷移・依存の向き）まで既に決めており、別の文書にすると再掲になる。ほかの条件は当たらない：モジュール間の境界は動かさない
  （純粋な `keys/*` は store・Vue に依存せず、`store/settings.ts` が `keys/*` に依存し、結線は `main.ts`。今の向きと同じ）、新しい構造・パターンの選択は D1〜D11 で済んでいる、
  tasks は 16 個に無理なく分解できた（`aidev coverage --strict` で被覆 100%）。
- 影響: `architecture.md` は作らない。`verify` は「承認済みかつ md が実在する工程」だけを見るので、architecture の点検記録は要らない。

## D6: tasks の点検（12 件）を受けた分解の組み直し

- 背景: tasks の独立点検（委譲。12 件）で、(1) 旧 `DEFAULT_KEYMAP` を置き換える時点が T4 か T5 かで、T4〜T11 の間に型が通らない区間が生じる、(2) T10 が 1 回で検証できない粒度（AC 13 個）、
  (3) 「直接のキーに使える形」の判定と「DOM イベント → `KeyInput`」の変換が複数タスクに分散、(4) 依存の過不足、(5) 各タスクのテストファイルが対象に無い、が指摘された。
- 決定: 16 個から **18 個へ組み直した**。(a) T4 は旧表を残して `DEFAULT_RESOLVED_KEYMAP` を足し、T7 で置き換える（`HelpDialog.vue:30` の 1 行を同時に直す。全面の書き換えは T13）。
  (b) T10 を「取り込み（T11）」と「戻し・おすすめ（T12）」に、T7 を「検証（T5）」と「戻し・おすすめ（T6）」に割った。(c) `isDirectChord` と `keyInputOf` を T1（chord.ts）に置いた。
  (d) T8（store）は T7（検証）に依存しない（store は検証を呼ばない）。backlog（T16）を文書（T17）より先に置いた（H12・H26 の行が新しい項目名を指すため）。
  (e) 各タスクの `対象:` に新規・既存のテストファイルを書いた。(f) 一式を回す時点を「test 工程の最後に 1 回（deliver 直前を兼ねる）」に 1 つにした。
- 理由 / 代替案: T7 を 1 つに保つ案（検証と戻しを同じタスクに）もあったが、1 回で検証できる単位を超える。旧表の置き換えを T4 に含める案は、T4〜T7 の間に Router の型が通らない。
- 影響: T の番号が変わった（decisions D3 の T16 → T18）。design の対象範囲・インターフェースに `isDirectChord`・`keyInputOf`・H12 の付け替えを足した。

## D7: macOS の非 US 配列の Option の表示は既知の制約として残す

- 背景: T1 の 2 ラウンド目の点検で、`recoverOptionKey`（Option の文字化けを `code` の英字・数字へ戻す）は、macOS でも Dvorak・QWERTZ・AZERTY では `code` が QWERTY の位置なので、
  化けた文字の chord の表示が押した字と食い違う（ドイツ語配列の Option+z＝`code:"KeyY"` が `alt+y` と表示される等）と指摘された。取り込みと照合は同じ変換（`chordOf`）を通るので、押して付けた割り当てを押して効かせる動作はそろう。
- 決定: **直さない**（設計上の制約）。`chord.ts` の doc と design D6(b) に書き、`docs/verification.md`（T17）の「手で確かめる項目」と「既知の制約」に載せる。
- 理由 / 代替案: 正しく直すには「押した字を得る」別の手段（`KeyboardLayoutMap` API は Chromium 系のみ）が要り、実機（macOS）で確かめられない今は見合わない。QWERTY 配列の macOS（多数派）は正しく動く想定。
- 影響: macOS の Dvorak・QWERTZ・AZERTY の利用者が Option を使う割り当ては、表示と実際の物理キーがずれうる（押せば効く）。

## D8: AC2 の例外——CapsLock を入れて Shift を押したときの文字キーは、shift 付きとして引く

- 背景: T7 の点検で、旧 `comboKey` と新 `chordOf` の引きが違う入力が 1 種類だけあると指摘された（旧表の全キー・Esc・修飾キー単体・CapsLock の大文字〔shift なし〕・`Dead`・F キー・名前付きキー×修飾の全数比較では一致）。
  「小文字の文字キー＋`shift:true`」——実機では CapsLock を入れて Shift を押したとき（`key` は小文字で `shiftKey` が真）。旧は shift を無視して `h`（focus）、新は `shift+h`（swap）。小文字の `ctrl+shift+b` も、旧は prefix に入り、新は入らない
  （実物の `Ctrl+Shift+B` は `key` が大文字 `B` で、旧でも prefix には入らなかったので、実機の挙動が変わるのは CapsLock＋Shift の組だけ）。
- 決定: **意図した差として受け入れる**。文字キーは「大文字か、shift が押されている」を shift 付きとして引く（D3）。
- 理由 / 代替案: 物理の Shift に従うほうが herdr の照合（`key_codes_match`。両方に shift があれば大小を無視）と同じで、利用者の意図（Shift を押した）に合う。旧の挙動（shift を無視）に合わせると、
  合成のキー（小文字＋shift。Playwright）と実物（大文字＋shift）を同じ正規形にする D3 が成り立たなくなる。
- 影響: AC2「今のキー操作は 1 つも変わらない」の例外（CapsLock を入れて Shift を押した文字キー）。verification.md に書く（T17）。

## D9: モバイルの Prefix ボタン（`injectPrefix`）は、待機中の Ctrl/Alt を重ねず、prefix に入れるモードでだけ働く

- 背景: design と tasks は `injectPrefix()`＝`injectKey(router.prefixKeyInput())` と書いたが、T8 の実装と点検で 2 点が見つかった。
  (1) prefix が F キーのような ctrl・alt を含まない形のとき、`injectKey` は待機中の Ctrl/Alt（`ExtraKeys` の Ctrl/Alt を armed にしたまま Prefix ボタンを押す）を重ねて `ctrl+f5` にしてしまい、prefix に入れなくなる
  （ctrl・alt を含む prefix は元から重ねない）。(2) navigate・resize モードは `k.key` だけを見て修飾キーを見ないので、変えた prefix のキー（`ctrl+l`・`alt+j`）を注入すると pane の移動・resize になる。
- 決定: `injectPrefix` は (1) 待機中の Ctrl/Alt を重ねず（`inject(k, false)`）、待機の状態も消費しない。(2) terminal・copy・prefix 中のモードでだけ働き、navigate・resize・dialog では何もしない
  （物理の prefix はそのモードでは prefix に入らない＝何も起きないのと同じ）。design の「案内の追従」の `ExtraKeys` の行を実装に合わせた。
- 理由 / 代替案: 物理のキーでも navigate・resize がキーの修飾を見ないのは既存の挙動（AC12 でそのモードの中のキーは変えない）で、変えると本 work の範囲を越える。ボタンだけをそのモードで無効にするのが最小。
- 影響: 物理のキーで、変えた prefix（`ctrl+l` 等）を navigate・resize モードの中で押すと、そのキーの文字（`l`）として扱われる（既存の挙動。prefix を `ctrl+b` のまま使う限り何も起きない）。docs/verification.md の既知の制約に書く（T17）。

## D10: キー一覧（`prefix+?`）の行の並びと粒度が、旧い直書きから変わる

- 背景: T13 の点検で、キー一覧を現在の割り当てから作ると、旧い直書きの一覧と次の違いが出ると指摘された。(1) 全体の群の「後続」の行（`shift+r`）が旧 4 番目（`s` と `o` の間）から末尾へ。(2) pane の群の `shift+p`（名前を変更）が
  旧 `x` の次から `r`（resize）の後ろへ（カタログ順）。(3) 旧 1 行だった「n / p」「h / j / k / l」が、操作ごとの行（次の tab・前の tab・左/下/上/右の pane へフォーカス）へ。「tab を切り替え」は「tab を切り替え（1〜9）」に。
  (4) 旧い「移動」の群の「tab / shift+tab（pane を巡回する）」の行は、navigate モードが Tab を扱わない（`NavigateMode.ts`）ので、pane の群の巡回の操作の行（`prefix+tab`・`prefix+shift+tab`）に置き換えた。
- 決定: **意図した変化として受け入れる**（design の D8「案内は現在の割り当てから作る」・「操作ごとの行」）。AC2（今のキー操作が変わらない）は**操作**の話で、案内の並びは含めない。内容の集合に抜けと重複は無い（旧い一覧の全キーが出る。swap は今までどおり出さない）。
- 理由 / 代替案: 「後続」の行の位置だけを旧に合わせる案もあったが、操作を現在の割り当てから生成する形（カタログ順）と、割り当てを変えたときの行の出し分けを素直にするため、カタログ順に従う。
- 影響: キー一覧の見た目が少し変わる（内容は同じ）。

## D11: coding の cross 点検（作業全体）で見つけたことの扱い

- 背景: T1〜T17 の点検を終えたあとの cross 点検（`taskcheck cross`）が 10 件を指摘した（should 1・nit 9）。コードで直したものと、書き戻し・記録で閉じたものがある。
- 決定:
  (1) **`keydown` を止めるボタンにフォーカスがある間は、prefix も直接のキーも届かない**（サイドバーの［＋新規］［メニュー］［並び順］［«］・tab バーの［＋］は `@keydown.stop`、pane の枠は Enter・Space・↓ を止める）。
  **既存の挙動**（prefix でも同じ）で、AC5 の「サイドバー等にあるときも効く」は、**フォーカスできない要素（サイドバーの行）をクリックして端末から焦点が外れた状態**（window の keydown → `handleDomKey`）までを範囲とする。
  ボタンにフォーカスが残る状態は verification.md の既知の制約に書き、backlog に直す行を立てた（`@keydown.stop` は入力欄・ボタンの Enter/Space を守るためにあるので、この work では触らない）。E2E の題名と注を実際の範囲に直した。
  (2) AC6(c)（prefix の後の Esc）は、画面の取り込みでは Esc が取り消し（AC-I1）になるので**理由は出ない**（`assign.ts` の分岐は保存値の読み込み〔`resolveKeymap`〕と同じ表を見る防御）。requirements の AC6(c) に書き戻し、verification.md の「理由を出して拒否する」の列から外した。
  Esc の文字列は `chord.ts` の `PREFIX_CANCEL_CHORD` に 1 か所にした（`KeyRouter`・`keymap.ts` が使う）。
  (3) **prefix の後の `ctrl+shift+v` も予約**にした（貼り付けの横取りがルーターより先に全モードで働くので、割り当てても効かない）。`RESERVED_AFTER_PREFIX` を chord → 理由の表にして、画面の拒否と読み込みで落とした記録が同じ文を使う。
  (4) **AltGr で合成された文字は、実行時にも直接のキーに当てない**（`KeyRouter.handleDirect` が `isAltGrComposed` を使う）。取り込みで拒否するだけでは、おすすめ一式の `ctrl+alt+[`・`]` が、AltGr で `[`・`]` を打つ配列で端末に打てなくなる。素の `altGraph` では見ない（Firefox・Windows は Ctrl+Alt だけで真になる）。
  (5) `parseChord` も `chordOf` と同じ規則（`isChordChar`：空白の文字と、小文字にすると 2 文字になる `İ` は不可）にした。手で書き換えた保存値が、読み込みは通り解決で落ちる、を起こさない。
  (6) prefix にできる F キーは F1〜F12 だけ（`prefixBytes` の表）。拒否の理由文・H26 ③ の「F キー」を「F1〜F12」に直した（直接のキーは F1〜F24 のまま）。
  (7) OS 通知の案内（sticky のトースト）は、出ている間に prefix・割り当てを変えたら文を書き直す（`NotificationController` の `watch`）。
  (8) ［すべて既定に戻す］の確認の Esc は、`keydown` の `preventDefault()` に頼る（Chromium の実測）。取り込み待ちのような `cancel` の保険（`holdCancel`）は持たない——Firefox・Safari は未確認で、verification.md の手の確認に足した。
  (9) backlog の実測の文面は、deliver の台帳の同期で最終の数字に書き直す（それまでは spec の本数だけを述べる）。design D6(b) の `navigator.platform` は既存の `isMacPlatform()` に直した。
- 理由 / 代替案: (1) の代案は window の keydown を capture フェーズにして `@keydown.stop` を越える方法だが、入力欄（名前の変更など）へ打つキーまで prefix・直接のキーに取られうる。既存のコンポーネントの
  キーの扱いを見直す別の work にする。(8) は Esc の遅延通知を確認にも広げる案があるが、二重に状態を持つ（取り込み待ちと確認が同時に開く）ので見送った。
- 影響: AC5・AC6(c)・AC10 の読み方（requirements・design に書き戻した）。verification.md の既知の制約と手の確認、backlog に 1 行、H26 ③ の文言。

## D12: T9（store）の点検は 2 ラウンド目で行い、cross は 1 ラウンドで止めた

- 背景: `taskcheck status` に T9 の `start` だけがあり `report` が無かった（1 ラウンド目の結果は記録に残っていない）。cross 点検（10 件）を直したあとで気づいた。
- 決定: T9 を**2 ラウンド目として**点検し直した（6 件：should 2・nit 4）。直した内容は review.md の「タスク点検ログ」。1 ラウンド目は**結果が記録に無いので「断念」ではなく「記録漏れ」**として扱い、件数には数えない。
  cross は 1 ラウンド（10 件）で止めた——直した内容は小さく（定数・判定の共通化・ガード・文言・記録）、変更は単体・変異で固定したうえ、review 工程が差分全体を独立に見る。
- 理由 / 代替案: T9 を点検なしで通す案は、autonomous では全タスクを点検する規約に反する。cross の 2 ラウンド目は、review と重なるので見送った。
- 影響: `task_check_findings` に T9 の 6 件が入る。

## D13: review ラウンド 1 の指摘の扱い（コードで直したもの・書いて受け入れたもの）

- 背景: 独立した review（ラウンド 1。must 0・should 2・nit 6）の指摘。コードで直したものと、設計どおりで記録に残したものがある。
- 決定:
  (1) 取り込みの部品は `captureAttrs` 1 つを 3 つの入口が `v-bind` で共有する（片方だけ `blur` が外れて、親が Esc を無視し続ける事故を作れない）。blur で終わるテストを 3 入口に広げた。
  (2) ［おすすめを足す］の脇に「環境によって届かないキーがある」注記を置き、verification.md に書いた。一式そのものは変えない（herdr の文書の一式。`ctrl+alt+l` は herdr 自身が避けるものに挙げるが、`focus_pane_right` の一式に含まれる）。
  (3) `isAltGrComposed` の比較表に、US 配列のシフトありの記号とテンキーの記号を足した（`ctrl+alt+shift+[`＝`{` 等が、Firefox・Windows の「Ctrl+Alt だけで AltGraph が真」で拒否・素通しにならない）。
  (4) `keys` は `storage` イベントで別のウィンドウの変更に追従する（古い状態から別の変更をして、先の変更を上書きしない）。
  (5) ［追加：…］の `aria-label` は見えているラベルで始める（WCAG 2.5.3）。
  (6) **CapsLock を入れたまま `Ctrl+Alt+D` を押して大文字で届く環境**では、大文字は shift 付きとして引く既存の規則（AC2＝今の `H`・`T` と同じ）により `ctrl+alt+shift+d` になる——**コードは変えない**。大文字を shift 付きとみなす規則を外すと、合成の大文字（ExtraKeys の `N` 等）や既存の
  prefix の後のキーの引き方が変わり AC2 を破る。実機は未確認（推測）なので、既知の制約に書いた。
  (7) E2E の AC-I5 の否定（帯が出ない・送ったフレームが空）は、取り込みの処理が無くても成り立つ——観測しているのは「同じ prefix で設定が変わらず取り込みが終わる」こと。漏れの直接の守りは単体（変異で落ちる）。test-result.md を直した。
  (8) この差し戻しの直しは tasks.md のタスクではないので、**タスク単位の独立点検は行わない**。直した内容は、変異で落ちるテスト（`captureAttrs` の blur・AltGr の表・`storage` の追従）を足して固め、再度の test（一式）と review のラウンド 2 で見る。
- 理由 / 代替案: (6) の代案（`getModifierState("CapsLock")` を `KeyInput` に足して、CapsLock による大文字は shift としない）は、実機の挙動が未確認のまま既存の引き方を変えるので見送った。
- 影響: verification.md の機能の説明・手で確かめる項目・既知の制約。

## D14: review ラウンド 2 の指摘（ラウンド 1 の直しが作った退行）の扱い

- 背景: ラウンド 2 が should 1・nit 3 を指摘した。should は**ラウンド 1 の直し（D13(3)）が作った退行**——`isAltGrComposed` の表にシフトありの記号を足したとき、`shift` の状態を見ずに `key` だけで両方の表と比べたので、
  AltGr の層が US のシフトの記号と同じ文字になる配列（フランス語 AltGr+3＝`#`・スペイン語 AltGr+2＝`@`・北欧 AltGr+4＝`$`。実機は未確認）が「合成ではない」と誤判定され、取り込みも実行時のガードも素通しになる。差し戻しは 2 回目。
- 決定: 「この指摘は前ラウンドの修正に由来しないか」の問いに **Yes**。直した項だけでなく、**同じ不変条件を支える項を全部列挙して 1 つずつ壊した**。不変条件は「AltGr で合成された文字 ⇔ AltGraph が真 ∧ 英数字以外の 1 文字 ∧ 同じ物理キーを**同じ shift の状態**で押した US 配列の文字と違う」。
  項＝(t1) AltGraph の門・(t2) 1 文字の門・(t3) 英数字を通す・(t4) `code` の表の引き・(t5) shift の状態の一致・(t6) shift に依らないキー（Space・テンキー）。US 配列の記号キーの真値の表（21 キー）を、shift の状態ごと（同じ状態なら通る・違う状態なら合成）に全部確かめるテストにし、
  6 つの項をそれぞれ壊す変異がすべて落ちることを確かめた（t5 が今回の退行）。`isAltGrComposed` は `shift` を受け取る（呼び出しの 2 か所〔`validateAssignment`・`KeyRouter.handleDirect`〕は完全な `KeyInput` を渡す）。
  nit は、design・verification.md への書き戻し（`storage` 追従・`isAltGrComposed` の表・注記・手の確認）、`setKeymap` のコメントと「prefix 中に差し替えても状態を保つ」テスト、注記の `aria-describedby`、既知の制約の slug と CapsLock の文面。
- 理由 / 代替案: shift の状態を見ずに表を 1 つの集合にまとめる案（`US_BASE ∪ US_SHIFT`）が退行の原因。表を 1 つにして `(code, shift)` をキーにする案もあるが、Space・テンキーの「shift に依らない」を別に持つ必要があり、いまの 2 表＋フォールバックのほうが短い。
- 影響: 取り込み・実行時の AltGr 判定が、US 配列の記号と AltGr の層を shift の状態まで含めて区別する（実機は未確認。verification.md の手の確認に既にある）。


## デバッグ D1: review の原因究明を省いた（2026-09-21T21:13:23Z）
- 背景: review の差し戻しが 3 回（上限 3）。
- 決定: 原因究明（aidev debug start）の委譲を省いた。
- 理由: 原因は特定済みで再現できている：ラウンド 3 の指摘はテストの穴（isAltGrComposed の項の内側〔大文字の英数字・shift 真で表に無い code のフェイルクローズ・テンキー 2 項〕を変異が通る）。変異はレビュアーが scratch で再現し、直し方も具体的（テストの追加）。本番コードに不具合は無い

## D15: review ラウンド 3 の指摘（テストの穴）の扱い——3 回目の差し戻しと、変異の網羅

- 背景: ラウンド 3 の should は、D14 の「6 つの項を壊す変異が全部落ちる」が各項を**丸ごと消す**変異だけの確認で、項の**内側**（英数字の門の大文字・shift 真で表に無い `code` のフェイルクローズ・テンキーの 2 項）が守られていない、というテストの穴（本番コードは正しい）。差し戻しは 3 回目で上限（3）に達した。
- 決定: `aidev debug skip` で省く（原因は特定済みで再現できている——レビュアーが scratch で再現し、直し方はテストの追加。記録は下の「デバッグ D1」）。
  テストを足した（大文字＋shift＋altGraph・shift 真で表に無い `code`・テンキーの 2 項・`assign`・`KeyRouter` の大文字＋shift＋altGraph）うえで、**手で項を挙げる方法をやめ、`isAltGrComposed` の本体と 2 つの表の各行・各記号を 1 つずつ壊す自動の変異の網羅**（97 個。行の削除・`return false`→`true`・`!==`→`===`・`k.shift` の反転・表の引きの取り違え・`??` のフェイルオープン・英数字の門・表の行の削除と値の変更）を回し、**全部落ちる**ことを確かめた
  （手で挙げた 6 項では、項の内側を取りこぼした。D14 の反省）。レビュアーの 4 つの変異（大文字の門・フェイルオープン・`NumpadEqual`・`NumpadComma`）は個別にも落ちることを確かめ、test-result.md に貼った。手の確認に `Ctrl+Alt+Shift+D` を足した。
- 理由 / 代替案: 上限に達したので、これ以上は差し戻しを重ねず、この直しを最後にする（次のレビューで新しい should が出ても、差し戻さずに報告する）。
- 影響: テストと verification.md の手の確認だけ（本番コードは変えていない）。

