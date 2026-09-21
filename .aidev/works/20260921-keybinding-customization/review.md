# レビュー記録: キー割り当てのカスタマイズ

## タスク点検ログ

<!-- coding 工程内の独立点検（`protocol-check.md`「(b)」）で見つけて、その場で直した指摘。1 件 1 行。60 review のラウンド件数には数えない。 -->
- [should][conv:-] T1 chord.ts `recoverOptionKey`（D6b）が Option 以外の環境で正しい入力を書き換える（Windows/Linux の US 配列の Alt+Shift+数字が `alt+数字` になる・Dvorak の Alt+`,` が `alt+w` になる） / 対応: 復元を「key が非 ASCII の 1 文字か `Dead`」のときだけにし、shift 付きの数字は復元しない。反例のテストを足した
- [should][conv:-] T1 chord.ts `parseChord` が `shift+plus` を受ける（`chordOf` は shift を持たないので発火しない） / 対応: `plus` も数字・記号として shift を無効にした
- [nit][conv:-] T1 chord.ts 修飾・キー名の表をプロトタイプ経由で引いているので `constructor` 等が通る / 対応: 自分のプロパティだけを引く `own()` に統一した
- [nit][conv:-] T1 chord.ts `prefixBytes` が D5 とずれる（`ctrl+space` を通す・`alt+plus` が null） / 対応: `alt+plus` を通し、D5 に `ctrl+space` を書き足した
- [nit][conv:-] T1 chord.ts `parseChord` の到達しない分岐（空配列・`" "`・`space` の重複） / 対応: 削除した
- [nit][conv:-] T1 design.md の `formatBinding` のシグネチャが実装とずれる / 対応: design を実装（`ParsedBinding` を受ける形）に合わせた
- [should][conv:-] T2 bindings.ts `ActionDef` の型が design の判別共用体より緩い（`indexed` と `action` の形が食い違う定義を型で弾けない） / 対応: 判別共用体（`indexed?: undefined` ＋ `Action`／`indexed: true` ＋ 関数）にし、`actionFor` は `def.indexed` で判定する
- [nit][conv:-] T2 bindings.ts `actionFor` が `index` の省略を黙って 1 にする / 対応: 範囲の操作で省略したら例外にし、範囲でない操作は `index` を見ないと書いてテストした
- [should][conv:-] T4 keymap.ts `resolveKeymap` で上書きが全部落ちた操作が「割り当てなし」のままで、`loadKeyPrefs`（全部落ちたら既定へ）と結果が割れる / 対応: 上書きが 1 つ以上あり 1 つも登録できなかった操作は、既定を登録し直す（design の手順に書き足した）
- [nit][conv:-] T4 keymap.test.ts のテスト名と本文が食い違い、`chord !== prefix` の防御は到達しない / 対応: 名前を直し、到達しない条件を消した
- [nit][conv:-] T4 keymap.ts・keymap.test.ts が prettier に整形されていない（keymap.ts は HEAD で整形済み） / 対応: `prettier --write`（新規ファイルと HEAD で整形済みのファイルだけ）
- [nit][conv:-] T4 keymap.ts `problems` の文言に不要な空白・コメントの取り違え / 対応: 直した
- [nit][conv:-] T4 keymap.ts `resolveKeymap` が範囲の不変条件（範囲は範囲の操作だけ）を信用して、破れると黙って誤登録する / 対応: 範囲と操作の食い違いを検査し、`problems` に記録して落とす
- [should][conv:-] T3 keyPrefs.test.ts が「配列でない値を落とす」「bindings の形が違っても prefix は生かす」を実際には検証していない（変異させても通る） / 対応: 既定と違う有効値の文字列・オブジェクト・数値と、bindings の形違いで prefix が生きるケースを足した
- [should][conv:-] T3 keyPrefs.test.ts が `withBindings` の「無効な文字列は落として有効な分は反映する」を検証できていない（有効な 1 つが既定と同じで区別できない） / 対応: 既定と違う有効値＋無効値のケースを足した
- [nit][conv:-] T3 keyPrefs.test.ts が `with*` の「渡した KeyPrefs を書き換えない」契約を検証していない / 対応: 入力が変わらないことを確かめるテストを足した
- [should][conv:-] T5 assign.ts `validatePrefix` の理由文が実際の判定（端末へ送れる形）より広く書かれ、ctrl+shift+a・ctrl+1 等が「ctrl を含むのに拒否」と読める / 対応: 文面を実際の形（ctrl+英字・alt+1 文字・ctrl+alt+英字・修飾なしの F キー。shift・数字・名前のあるキー・cmd は不可）に合わせた
- [nit][conv:-] T5 予約の chord（`ctrl+shift+v`・`esc`）が assign.ts と keymap.ts の 2 か所にあり、片方だけ足すと「取り込みでは通るのに resolveKeymap が黙って落とす」状態になりうる / 対応: keymap.ts の定数を export して assign.ts が使い、「validateAssignment が通れば resolveKeymap の problems が空」を確かめるテストを足した
- [nit][conv:-] T5 テスト名「Dead・Unidentified は割り当てに使えない」が `Dead` しか検証していない / 対応: `Unidentified` も検証するようにした
- [should][conv:-] T6 assign.test.ts が「おすすめの一式の操作と chord の対応」を固定しておらず、取り違えても全部通る（focus_pane_down と up・previous_tab と next_tab の入れ替え等）。「足すたびに表を作り直す」も外しても通る / 対応: 一式を 10 組の期待値と `toEqual` で比べ、10 個すべての `bindingsOf` を確かめた。`applyRecommended` に一式を差し替えられる引数を足し、一式の中の重なりを検証するテストを足した
- [nit][conv:-] T6 assign.test.ts の `planReset` のテストが名前ほど検証していない（すべて戻すの比較が同義反復・prefix の戻しで prefix の後のキー側の衝突が無い） / 対応: `resolveKeymap(r.prefs)` で比べ、prefix の後のキー側の衝突も足した
- [nit][conv:-] T6 design・tasks の名前とシグネチャが実装と食い違う（`recommendedDirect()`・`applyRecommended(km)`） / 対応: 実装（定数 `RECOMMENDED_DIRECT`・`applyRecommended(km, prefs, set?)`）に文書を揃えた
- [should][conv:-] T1（2 ラウンド目）chord.test.ts が `prefixBytes` の cmd 拒否を検証していない（`p.cmd` を外しても通る） / 対応: `ctrl+cmd+b`・`alt+cmd+b` を null の一覧に足した
- [nit][conv:-] T1（2 ラウンド目）`prefixBytes` が shift を黙って落とす形を通す（`alt+shift+space`・`alt+shift+ß`）／`chordToKeyInput("shift+ß")` が `SS` になる / 対応: shift 付きは大文字が 1 文字になる文字だけ通し、それ以外は null。`chordToKeyInput` も同じ
- [nit][conv:-] T1（2 ラウンド目）`chordOf` の出力が `parseChord` で読み戻せない場合がある（`İ`・NBSP・U+3000） / 対応: 大小変換で 2 文字になる文字と空白の文字は引かない（null）。`chordOf` の出力は必ず読み戻せることを確かめるテストを足した
- [nit][conv:-] T1（2 ラウンド目）`recoverOptionKey` の前提が macOS の非 US 配列（Dvorak・QWERTZ・AZERTY）でも崩れる（表示が押した字と食い違う） / 対応: 設計上の既知の制約として design D6(b) と decisions D7 に書き、`docs/verification.md`（T17）へ回す
- [should][conv:-] T4（2 ラウンド目）keymap.test.ts が「既定へ戻す先の既定は、あとの操作の上書きにも負ける」（2 パスの順序）を守っていない（既定へ戻す側がカタログで前・上書き側が後ろの組が無く、1 パス目の中で戻す変異が通る） / 対応: その組（help が全部落ちる・zoom が `prefix+?` を持つ）を足した
- [nit][conv:-] T4（2 ラウンド目）`bindingsOf` が正規形で返すことを固定するテストが無い / 対応: 非正規形の入力（`prefix+H`・`control+alt+d`）で `bindingsOf` を検査するテストを足した
- [nit][conv:-] T4（2 ラウンド目）範囲の食い違いの `problems` の文言が両方向で同じ（範囲の操作に単独キーを与えた側でも「範囲は tab の番号選択だけ」） / 対応: 向きごとの文言にして、テストで文言も見る
- [nit][conv:-] T4（2 ラウンド目）`effective.set(def.id, [])` の 2 か所が不要で、コメントが誤解を招く / 対応: 削除し、コメントを直した
- [nit][conv:-] T4（2 ラウンド目）改名後の keymap.test.ts が prettier に整形されていない / 対応: `prettier --write`
- [should][conv:-] T7 KeyRouter.ts 直接のキーが `enterMode` の操作のとき、押しっぱなしの繰り返しが入ったばかりのモードのキーとして渡る（`ctrl+alt+r` の繰り返しで resize から抜ける等）。D4 の「繰り返しは食う」が terminal のときだけ / 対応: 直接のキーで action を返した chord を覚え、その chord の繰り返し（`repeat`）はモードに関わらず食う。次の繰り返しでない keydown で忘れる
- [should][conv:-] T7 KeyRouter.test.ts が「prefix 中の `Dead`・`Unidentified`（修飾キー単体でない null）は割り当てのないキーとして prefix を抜ける」を固定していない（待ち続ける変異が通る） / 対応: テストを足した
- [nit][conv:-] T7 旧 `comboKey` と新 `chordOf` で引きが違う入力が 1 種類ある（小文字の文字キー＋shift＝CapsLock を入れて Shift を押したとき）。旧は shift を無視して `h`（focus）、新は `shift+h`（swap） / 対応: 意図した差（物理の Shift に従う。herdr も同じ）として decisions D8 に残した
- [should][conv:-] T10 keys/platform.ts の `isMacPlatform` が既存の `term/MouseBridge.ts` の `isMacPlatform`（同名・同目的）と 2 つになり、「macOS か」の定義が 2 通りになる / 対応: 新規の `keys/platform.ts` とそのテストを削除し、既存の `isMacPlatform`（`userAgentData.platform` も見る）を `main.ts` で使う
- [nit][conv:-] T10 platform.test.ts の `isMacPlatform(undefined)` が「navigator が無い環境」を試していない / 対応: 該当のファイルごと削除（上の対応）
- [should][conv:-] T8 KeyInputController.test.ts が「待機は消費しない」を検証できていない（末尾の `mode` は消費してもしなくても terminal） / 対応: `action.runs` が空であることを確かめるようにした（消費されると `v` が右へ分割として実行される）
- [nit][conv:-] T8 Prefix ボタン（`injectPrefix`）が navigate・resize モードでも prefix のキーを注入し、そのモードのキーは修飾キーを見ないので、変えた prefix が pane の移動・resize になる / 対応: prefix に入れるモード（terminal・copy・prefix 中）でだけ働くようにし、テストを足した。物理の prefix はそのモードでは何も起きない（既存の挙動）
- [nit][conv:-] T8 design・tasks の `injectPrefix()`＝`injectKey(router.prefixKeyInput())` と実装（待機中の Ctrl/Alt を重ねない `inject(…, false)`）が食い違い、理由が記録されていない / 対応: design を実装に合わせ、decisions D9 に理由を書いた
- [nit][conv:-] T8 テスト名が AltGraph をうたうが検証していない・削除済みの `toKeyInput` の名前が残る / 対応: 名前を「IME の変換中（keyInputOf 経由）」に直した
- [should][conv:-] T11 KeySettings.vue の見出し・案内文に、親（SettingsDialog）の scoped CSS（`.settings-heading`・`.settings-note`）が当たらず、5 節目だけ見た目が揃わない（scoped は子のルートにしか親の属性が付かない） / 対応: 同じ規則を KeySettings の scoped CSS に持たせた
- [should][conv:-] T11 Esc の取り消しのテストが「取り消し」と「検証で拒否」を区別できない（Esc 分岐を消す変異が通る） / 対応: Esc のあと `role="status"` が空であることを確かめるようにした
- [should][conv:-] T11 SettingsDialog の `onNativeCancel` の抑止が、Esc で取り込みを終える場面では働かない（Firefox・Safari で keydown のあとに `cancel` が来る順序。推測） / 対応: Esc で終えたとき、親へ「取り込み待ちが終わった」と知らせるのを次のタスクまで遅らせ（`cancel` は同じタスクの中で来る）、その順序を再現するテストを足した
- [should][conv:-] T11 下に固定した結果の文が、フォーカスの隠れ（`scroll-padding-bottom` が無い）・ダイアログの padding の内側で止まって中身が透ける、を起こしうる / 対応: `scroll-padding-bottom` を足し、固定の帯をダイアログの下端まで伸ばした（`bottom: -1em`＋`padding-bottom: 1em`）。実ブラウザの確認は E2E（T15）
- [should][conv:-] T11 削除後のフォーカスが、最後の割り当てを消したとき仕様（同じ行の次の部品、無ければ［追加：prefix の後］）と食い違い、直前の［変更］へ移る / 対応: 仕様どおり、消えた位置に繰り上がった［変更］、無ければ［追加：prefix の後］にし、テストを直した
- [nit][conv:-] T11 結果の文が、設定画面を閉じても消えず、開き直すと前回の文が出る / 対応: 閉じたら消す
- [should][conv:-] T13 HelpDialog.test.ts の「後続」の出し分けが、ガード（`action?.type !== "notYet"`）の壊れた実装を落とせない（「未対応（後続: undefined）」の行が出ても通る） / 対応: e・shift+r それぞれ、別の操作に割り当てたら「後続」の行そのものが出ない・`undefined` が出ない、を確かめるテストを足した
- [nit][conv:-] T13 旧い一覧と並び・行の粒度が変わった（全体群の `shift+r` の後続の行が末尾へ・pane 群の `shift+p` がカタログ順へ・「n / p」「h / j / k / l」が操作ごとの行へ） / 対応: 意図した変化（design「操作ごとの行」）として decisions D10 に残した
- [should][conv:-] T14 NotificationController.test.ts が「現在の prefix に従う」（AC11）を検証していない（`setKeyPrefix` の行を消しても通る） / 対応: prefix を `alt+x` に変えると既定の `prefix+s` が `alt+x s` と案内される、を確かめるテストを足した
- [should][conv:-] T14 ExtraKeys の Prefix ボタンが注入後に one-shot を解除する動作が固定されておらず、`KeyInputController` の「待機は消費しない」の記述と食い違って読める / 対応: `ExtraKeys.test.ts` に「Ctrl を armed にして Prefix を押すと解除される（lock は残る）」を足し、`KeyInputController` の注記に「`ExtraKeys` が one-shot を解除する」と書いた
- [nit][conv:-] T14 Toast のコメントとテスト名の「割り当てたあとの最初のフォーカスで出る」が実際より広い（`closeDialog` は同じ値を代入し直すので発火しない） / 対応: 文言を「次に別の pane へフォーカスが移ったとき」に直した
- [should][conv:-] T12 KeySettings.test.ts のおすすめのメッセージが、足した数・すでにあった分・足さなかった分が混ざる組み合わせを見ていない（誤った文になる変異が通る）。prefix と同じ chord の足さない分も未検証 / 対応: 一部だけすでにある・全部あるうえで 1 個が別の操作の持ち物・prefix と同じ chord の 3 組を足した
- [should][conv:-] T12 `SettingsDialog.vue` から `KeySettings` へ `kind` を渡す結線（`:kind="kind"`）がどのテストでも守られていない / 対応: `SettingsDialog.test.ts` に、モバイルのときだけ節「キー」に一言が出ることを確かめるテストを足した
- [nit][conv:-] T12 `.keys-message` の「画面の下に固定する」コメントが `.keys-bulk` の直前に取り残された / 対応: `.keys-message` の直前へ戻した
- [nit][conv:-] T12 モバイルの一言の位置が設計（先頭）と違い、取り込めると言い切る文が先に読まれる / 対応: 先頭（案内の文より前）へ移し、テストで位置を確かめた
- [nit][conv:-] T12 操作ごとの戻しで、何も戻らなかったときも「既定へ戻しました」と言い、「戻せなかった分」でキーが二重に出る / 対応: 戻せなかった分があれば「上書きを外しました。戻せなかった既定のキー：…」にし、理由がそのキーで始まるときはキーを重ねない（`describeSkip`）
- [should][conv:-] T16 backlog の「herdr にあって本製品に無い操作」の「どれも既定では割り当てなし」が、`edit_scrollback`（herdr の既定 `prefix+e`）・`reload_config`（`prefix+shift+r`）には当てはまらない（いま「後続」の案内がそのキーを使う） / 対応: 既定なしの操作と、既定を持つ 2 つ（「後続」の案内を置き換える）を書き分けた
- [nit][conv:-] T16 同じ行が、既存の 2 行（端末機能の拡張・外観と設定の残り）と重なる機能を相互参照なしで含む / 対応: 「実装の本体は別の行で、この行はキーの割り当てに載せる分だけ」と書いた
- [nit][conv:-] T16 「キーの設定の使い勝手」の出典が、4 つの小項目のうち 2 つ（操作の絞り込み・こちらへ移す）を裏付けない / 対応: 出典に research F27 を併記し、その 2 つは実装で出た改善案と書いた
- [must][conv:-] T17 verification.md の手で確かめる項目の「`Ctrl+A` で右上に PREFIX が出て」が実装と違う（PREFIX の帯は画面の下の中央） / 対応: 位置を「画面の下の中央」に直した
- [should][conv:-] T17 herdr-parity.md H26 ④の「herdr は修飾なしの文字を無効にする。同じ」が不正確（herdr が拒むのは修飾なしの印字できる文字だけで、`tab`・`enter`・矢印・`esc` は通す。本製品はそれらも拒否＝より厳しい） / 対応: 違いとして書いた。③に `ctrl+[`・`ctrl+space` の制御文字も足した
- [should][conv:-] T17 手で確かめる項目の手順に抜けがあり、書いたとおりに実行できない（名前のダイアログを閉じる指示・設定の中では取り込みになる・設定を開き直す手順・`cat -v` が前面にない） / 対応: 番号付きの手順に書き直した（設定を閉じて pane で押す・`Ctrl+A s` で開き直す・ダイアログを Esc で閉じる）
- [should][conv:-] T17 既知の制約の 2〜4 番目の bullet が work の slug なしで「AC12」「decisions D9」等と書き、親 work（20260918）の AC12・D9 と取り違える / 対応: `20260921-keybinding-customization の …` と slug を付けた
- [should][conv:-] T17 既知の制約の新しい bullet の置き場所が、節の作法（「ほかに、各節に書いた制約」の段落の前）とずれ、参照の段落の下にぶら下がる / 対応: その段落の前へ移した
- [nit][conv:-] T17 macOS の項の「`Ctrl+T`・`Ctrl+W` が取り込まれない」は macOS では成り立たない（ブラウザが先に受けるのは `Cmd+T`・`Cmd+W`） / 対応: OS 別に書き分けた（Windows・Linux は `Ctrl+…`、macOS は `Cmd+…`）
- [should][conv:-] T11（2 ラウンド目）`endCapture` の遅らせた知らせの中の `if (target.value === null)`（Esc の直後、次のタスクの前に別の取り込みが始まったら、新しい取り込み待ちを終わらせない）を検証するテストが無い（条件を外す変異が全テストを通る） / 対応: 「Esc → 別の［追加］→ 次のタスクを待つ → 親には `true` のまま・取り込みの部品が残る」を足した。条件を外す変異で落ちることを確かめた（42 本中 1 本）
- [should][conv:-] T15 直接のキーの「端末へ届かない」の否定を、分割の応答（焦点が新しい pane へ移る＝入力の関所の解放）を待たずに行っており、漏れたキーは関所が応答まで溜めるので、否定が空振りで通りうる / 対応: 分割後に焦点の pane が 1 になるまで待ってから否定を確かめる
- [should][conv:-] T15 AC5「端末以外にフォーカスがあるときも効く」（`main.ts` の window keydown → `handleDomKey`）を E2E が通らない（直接のキーを押す箇所はどれも直前に端末へフォーカスしている） / 対応: サイドバーの行をクリックして端末から焦点を外し（焦点が端末でないことを待つ）、`Control+Alt+d` で分割できるテストを足した
- [should][conv:-] T15 キーボードだけのテストの題名に「→［既定に戻す］」とあるが押しておらず、［削除］も `.focus()` で直に当てている。AC9 の「操作ごと」「prefix」の［既定に戻す］は E2E に無い / 対応: 前の行の見出しから Tab で行へ・Shift+Tab で［削除］へ辿り、追加→削除→もう一度追加→Tab 2 回で［既定に戻す］→Enter まで通し、各所のフォーカス（AC-I4）を確かめる。操作ごと・prefix の［既定に戻す］は別のテストで、その分だけ戻ることとフォーカスを確かめる
- [should][conv:-] T15 「下に固定した結果の文は…隠さない」のテストが、`scroll-padding-bottom` を外しても通る（スクロール位置を自動に任せ、部品が帯の下に入る位置にならない） / 対応: ［追加：直接］が帯のすぐ上に見える位置までスクロールしてから押し、部品の中心を最前面で受けているのが部品自身であることも確かめる。`scroll-padding-bottom` を外した版で落ち（部品の下端 704.6 > 帯の上端 671.5）、戻した版で通ることを確かめた
- [nit][conv:-] T15 AC4 の振る舞い（置き換えた prefix の後のキーで動く／外したキーは黙って捨てられる）と［変更］（置き換え）の経路が E2E に無い / 対応: キー一覧の `prefix+?` を［変更］で `prefix+y` にし、`prefix+?` では開かず `prefix+y` で開くテストを足した（クライアントだけで開くので、否定が空振りにならない）。作り直された chip の［変更］へのフォーカスも確かめる
- [nit][conv:-] T15 「すべて既定に戻す」の［やめる］を `storedKeys` が `null` でないことだけで見ており、［戻す］側も zoom の行を見ていない / 対応: 保存値が seed と等しいこと・prefix と zoom の表示がそのままであること、［戻す］のあと zoom の行が既定へ戻ることまで確かめる
- [nit][conv:-] T15 ［変更］［追加］を押してすぐ次のキーを押す 3 か所で、取り込みの部品への焦点を待っていない / 対応: `toBeFocused` で待ってから押す
- [should][conv:-] cross AC5「サイドバー等にフォーカスがあるときも直接のキーが効く」が、`@keydown.stop` のボタン（サイドバーの［＋新規］［メニュー］［並び順］［«］・tab バーの［＋］）にフォーカスがある間は成り立たない（window の `handleDomKey` に届かない。prefix も同じ既存の挙動）。E2E の題名はフォーカスできない行をクリックした場合だけを検証していた / 対応: 既存の挙動なので触らず、AC5 の範囲を「フォーカスできない要素をクリックして端末から焦点が外れた状態」と書き（decisions D11）、E2E の題名を実際の範囲に直し、verification.md の既知の制約に足し、直す行を backlog に立てた
- [nit][conv:-] cross AC6(c)（prefix の後の Esc に理由を出す）が UI から届かない（取り込み待ちの Esc は取り消し）のに、verification.md が「理由を出して拒否する」と書く。Esc の文字列が KeyRouter・keymap・KeySettings に散っている / 対応: requirements の AC6(c) に「画面では取り消し・読み込みで落として記録する」と書き戻し、verification.md の列から外した。Esc の chord は `PREFIX_CANCEL_CHORD` にして KeyRouter・keymap が同じ定数を使う
- [nit][conv:-] cross prefix の後の `ctrl+shift+v` が、取り込みも解決も通るのに効かない（貼り付けの横取りがルーターより先に全モードで働く） / 対応: `RESERVED_AFTER_PREFIX` に足し（chord → 理由の表。画面の拒否と読み込みで落とした記録が同じ文を使う）、assign・keymap のテストを足した。予約を外す変異で 2 本が落ちることを確かめた
- [nit][conv:-] cross `parseChord` が `İ` を受け、読み戻せない正規形を作る（`chordOf` 側だけ直してあった） / 対応: 空白の文字・小文字にすると 2 文字になる文字の判定を `isChordChar` に集め、引く側・読む側の両方が使う。parseChord・parseBinding・normalizeBinding のテストを足し、読む側を元に戻す変異で 2 本が落ちることを確かめた
- [nit][conv:-] cross おすすめ一式（`applyRecommended`）が AC6(e)（AltGr で合成された文字は割り当てない）の検証を素通りし、`ctrl+alt+[`・`]` が AltGr で `[`・`]` を打つ配列で端末に打てなくなる（推測） / 対応: 実行時にも `KeyRouter.handleDirect` が `isAltGrComposed` で AltGr で合成された文字を直接のキーに当てず端末へ通す（素の `altGraph` では見ない）。US 配列の `ctrl+alt+[` は効くことも含めてテストを足し、ガードを外す変異で落ちることを確かめた。手の確認に「おすすめ一式のあと AltGr+8・9」を足した
- [nit][conv:-] cross Esc の保険（`holdCancel`・`onNativeCancel` のガード）が取り込み待ちにしか無く、［すべて既定に戻す］の確認の Esc は Chromium の実測だけに頼る / 対応: 確認の Esc に保険は足さず（取り込み待ちと確認が同時に開くと状態が二重になる）、Firefox・Safari の手の確認に確認の Esc を足した（decisions D11）
- [nit][conv:-] cross OS 通知の案内（sticky のトースト）が、出ている間に prefix を変えても古い文のまま（AC11） / 対応: `NotificationController` が現在の割り当てを `watch` し、出ている案内の文だけを書き直す。テストを足し、書き直しを外す変異で落ちることを確かめた
- [nit][conv:-] cross 「prefix にできる F キー」の記述が実際（F1〜F12）とずれ、F13 を押すと理由と矛盾する / 対応: 拒否の理由文と herdr-parity H26 ③ を「F1〜F12（修飾なし）」に直した
- [nit][conv:-] cross backlog の「実測」が実態とずれる（E2E は 14 本・全体の回帰は未実施） / 対応: 本数を 14 に直し「deliver 時に一式の結果で書き直す」とした
- [nit][conv:-] cross design D6(b) の「`navigator.platform` で有効にする」が実装（既存の `isMacPlatform()`）と違う / 対応: design D6(b) を直した
- [should][conv:-] T9（2 ラウンド目）`replaceKeyPrefs` の「変わらなければ何もしない（書かない・keymap を作り直さない）」がテストで固定されておらず、早期 return を消しても全テストが通る / 対応: 同じ内容を渡し直しても `keymap` が同一のまま・`watch` が動かない・`setItem` が呼ばれない、変えれば作り直され 1 回だけ動き・書かれる、をテストにした（`localStorage` のインスタンスに spy。プロトタイプへの spy は happy-dom では効かず、否定が空振りになるので、変えたときに呼ばれる側も同じテストで確かめる）。早期 return を消す変異で落ちることを確かめた
- [should][conv:-] T9 `replaceKeyPrefs` 自身の「読めない値は捨てる」が直に呼ぶテストで固定されていない（`setKeyPrefix`・`setKeyBindings` は手前で弾くので届かない。読み直しを外す 3 通りの変異が通る） / 対応: 読めない値だけ・一部だけ読めない値を直に渡すテストを足した。読み直しを外す・保存に生の値を書く変異で落ちることを確かめた
- [nit][conv:-] T9 「二重の守り」が構文の不正だけで、衝突・予約は通る（コメントと design の「通らない値は反映せず捨てる」より狭い） / 対応: コメントと design の文言を「読めない値」に狭め、衝突・予約は解決が同じ規則で落とす（保存は残る）と書いた
- [nit][conv:-] T9 メモリの状態が既定と同じだと、壊れた保存値（`keys: "x"`・送れない prefix）が残り、`resetAllKeys` の「`keys` を消す」と食い違う / 対応: 状態も保存も同じときだけ何もせず、保存だけが違えば状態はそのまま保存を直す（表は作り直さない）。テストを足し、保存の比較を外す変異で落ちることを確かめた
- [nit][conv:-] T9 「すべてを既定へ戻す」のテストが、先に prefix を戻してから呼ぶので、`resetAllKeys` の prefix の戻しを固定していない / 対応: prefix を変えたまま呼ぶテストを足し、prefix を残す変異で落ちることを確かめた
- [nit][conv:-] T9 design・tasks の store の関数名が実装とずれ、`replaceKeyPrefs` が design に無い / 対応: design を実装の名前（`setKeyPrefix`・`setKeyBindings`・`resetKeyPrefix`）に直し、`replaceKeyPrefs` を足した

## ラウンド 1（review 工程。別のコンテキストに委ねた）

- [should][conv:-] packages/web/src/components/KeySettings.vue:323-325,374-376,416-418 取り込みの部品（`.keys-capture` の `<button>`＋`@keydown`＋`@blur`）が同じ記述で 3 か所（prefix・［変更］・［追加］）に複製され、`@blur` を prefix 用・［変更］用から外しても全単体が通る（AC-I1「別の操作へ移っても終わる」が 2 つの入口で未検証。blur が働かないと `capturing` が残り、親が Esc を無視し続ける）/ 対応: 属性とハンドラを 1 つの `captureAttrs` に集めて 3 入口が `v-bind` で共有し、blur で終わるテストを 3 入口に広げた
- [should][conv:-] packages/web/src/keys/assign.ts:250-261・packages/web/src/components/KeySettings.vue:239-255 ［herdr のおすすめを足す］は環境で届かないキーを含む（`ctrl+alt+l` は herdr 自身が「避けるもの」に挙げる KDE のロック〔research F9〕、`ctrl+alt+[`・`]` は AltGr で `[`・`]` を打つ配列では押せない）のに、「10 個足しました」とだけ知らせ、注意が UI にも docs にも無い / 対応: ボタンの脇に注記（届かないキーは［変更］で付け替える）を足し、verification.md の機能の説明と既知の制約に書いた
- [nit][conv:e2e-observe-browser] packages/e2e/src/specs/key-bindings.spec.ts:265-272 AC-I5 の「prefix の帯が出ない・送ったフレームが空」は、取り込みの keydown 処理が無くても成り立つ（設定画面は `showModal()` で背後が inert・window の listener はダイアログ中は何もしない・ルーターは dialog モード）。test-result.md の AC-I5 が E2E の証拠を数えすぎている / 対応: E2E のコメントに、この 2 つの否定が観測するのは何かを書き、test-result.md の AC-I5 を「E2E は Esc で閉じない・Tab でフォーカスが動かない・同じ prefix で何も変わらない、漏れの直接の守りは単体〔`stopPropagation`・`preventDefault` の変異で落ちる〕」に直した
- [nit][conv:-] packages/web/src/keys/chord.ts:415-442 `isAltGrComposed` の比較表がシフトなしの文字だけで、altGraph が真（Firefox・Windows は Ctrl+Alt だけで真）だと、US 配列の `ctrl+alt+shift+[`（`{`）・`?`・`<`・テンキーの記号が「AltGr で合成された文字」として拒否され、割り当て済みでも実行時に素通しになる（verification.md は「US 配列の記号は通す」と書く） / 対応: シフトありの US の記号とテンキーの記号も同じ物理キーの文字として通す表にした（ドイツ語配列の AltGr+7＝`{` は拒否のまま）。テストを足した
- [nit][conv:-] packages/web/src/keys/chord.ts:230 CapsLock が入ったまま `Ctrl+Alt+D` を押して `key` が大文字で届く環境（推測。実機は未確認）では `ctrl+alt+shift+d` に引かれ、おすすめ一式の対（右へ分割／下へ分割）が入れ替わる / 対応: 大文字は shift 付きとみなす（AC2＝今の `H`・`T` と同じ）のは設計どおりで、prefix の後のキーの CapsLock の挙動と同じ既存の規則。コードは変えず、decisions D13 と verification.md の既知の制約（CapsLock）に、この組を書いた
- [nit][conv:-] packages/web/src/store/settings.ts:168-178 `keys` は 1 つのまとまりをメモリの状態から丸ごと書くので、同じブラウザの別のウィンドウで開きっぱなしの古い状態から別の変更をすると、先に保存された変更を上書きする（`storage` イベントも聞かない。ほかの設定は 1 項目ずつ別のキー）/ 対応: `storage` イベントで、別のウィンドウの `keys` の変更に追従する（前の work のテーマの控えを保存から作る直しと同じ考え方）。テストを足した
- [nit][conv:-] packages/web/src/components/KeySettings.vue:387,396 ［追加：prefix の後］［追加：直接］の `aria-label` が見えているラベルを含まない（WCAG 2.5.3 Label in Name。音声操作で見えている名前を言っても当たらない） / 対応: 見えているラベルで始まる名前（「追加：prefix の後（「…」）」）にした
- [nit][conv:-] docs/verification.md:170,84 手順（4）「goto の［追加：prefix の後］」は行を開かないと押せない・機能の説明の「decisions D8」に work の slug が無い / 対応: 「行を開いて」を足し、slug を付けた

## ラウンド 2（review 工程。別のコンテキストに委ねた。ラウンド 1 の直しの検証と、直しの周辺）

ラウンド 1 の 8 件のうち、#1（`captureAttrs` の `onBlur`・`onKeydown`・class を消す変異が全部落ちる）・#2・#3・#6・#7 は実物で解消を確認（レビュアー）。以下が新しい指摘。

- [should][conv:-] packages/web/src/keys/chord.ts:470-475（表は :441-463）ラウンド 1 の直し（`isAltGrComposed` の表にシフトありの記号を足した）が新しい退行を作った——シフト表を `shift` の有無を見ずに `key` だけで比べるので、AltGr の層が US のシフト記号と同じ文字になる配列（フランス語 AltGr+3＝`#`・スペイン語 AltGr+2＝`@`・AltGr+3＝`#`・北欧 AltGr+4＝`$`。実機は未確認）で「合成ではない」と誤判定し、取り込みが通り、実行時のガードも素通しになる。直す前は表に無く拒否されていた（AC6(e) の退行） / 対応: `isAltGrComposed` に `shift` を渡し、シフト表は `shift` が真のときだけ使う（US の `ctrl+alt+shift+[` は shift が真なので通る）。フランス語・スペイン語・北欧の AltGr の文字が合成になるテストを足し、`shift` を見ない変異で落ちることを確かめた
- [nit][conv:-] docs/verification.md:779,784 ラウンド 1 の直しで足した 2 つの既知の制約が「（decisions D13）」と work の slug なしで書かれ、親 work の D13 と取り違える（T17・ラウンド 1 #8 と同種の再発） / 対応: slug を付けた
- [nit][conv:-] docs/verification.md:784 CapsLock の追記の「おすすめ一式の右へ分割・下へ分割が入れ替わる」が不正確（CapsLock 中は `Ctrl+Alt+D` も `Ctrl+Alt+Shift+D` も `ctrl+alt+shift+d` になり、右へ分割に届かなくなる。入れ替わるのではない） / 対応: 文面を直した（decisions D13(6) も）
- [nit][conv:-] design.md・KeyRouter.ts:62・docs/verification.md ラウンド 1 の直し（D13）の書き戻しが無い：(a) design「store」に `storage` 追従 (b) design D6(a) の表が「小さな表」のまま (c) 「節『キー』の構成」に注記が無い (d) `setKeymap` のコメントの「設定画面が開いている間は dialog モードなので prefix 中には来ない」は、`storage` 追従で別ウィンドウの変更が任意のモードで届くので成り立たない（prefix 中の差し替えのテストも無い）(e) `storage` が実際に発火する経路の手の確認・機能の説明が無い (f) decisions D13 の (8) が「影響」の後ろにぶら下がる。加えて注記が `aria-describedby` でおすすめのボタンに結ばれていない / 対応: (a)(b)(c) を design に書き戻し、(d) のコメントを直して prefix 中に `setKeymap` しても状態を保ち次のキーから新しい表で引くテストを足し、(e) を verification.md の機能の説明と手で確かめる項目に足し、(f) を直し、注記を `aria-describedby` で結んだ

## ラウンド 3（review 工程。別のコンテキストに委ねた。ラウンド 2 の直しの検証と、`isAltGrComposed` の直しが退行を作っていないかの確認）

ラウンド 2 の 4 件は実物で解消を確認（レビュアー）。表の 2 つは独立の出典（Playwright の `USKeyboardLayout`）と突き合わせて記号 36 項が一致し、テストの真値の表も実装と同じ 21 キーで一致した（誤りは無い）。以下が新しい指摘。

- [should][conv:regression-negative-control] packages/web/src/keys/chord.test.ts:437-440,528-545,548-552（本体 chord.ts:474-479。docs/verification.md:175・KeyRouter.test.ts:420-425 も関連）D14 の「6 つの項を壊す変異が全部落ちる」は各項を**丸ごと消す**変異だけで確かめており、項の内側が守られていない。次の変異は web の単体が全部通る：(1) 英数字の門を `/^[a-z0-9]$/`（大文字を落とす）に変える——実物のキーボードは `Ctrl+Alt+Shift+D` で key＝`D`（大文字）を返すので、Firefox・Windows（altGraph 真）ではおすすめ一式の `ctrl+alt+shift+d`（下へ分割）が「AltGr の合成」になり、取り込みは拒否・実行時は端末へ素通しになる。(2) shift 真で表に無い `code` の枝を fail-open（`?? k.key`）にする——ポーランド語配列の AltGr+Shift+A＝`Ą`（shift 真・`KeyA`）が取り込まれる。(3) `NumpadEqual`・`NumpadComma` の項を消す・値を変える。テストの穴で、実装は正しい。手の確認（verification.md:175）に shift 付きの `Ctrl+Alt+Shift+D` が無い / 対応: 大文字＋shift＋altGraph（`D`/`KeyD`）が合成でないこと・shift 真で表に無い `code`（`Ą`/`KeyA`・`€`/`KeyE`）が合成であること・テンキーの列に 2 項、を `chord.test.ts` に、altGraph 付きの大文字＋shift を `assign.test.ts`・`KeyRouter.test.ts` に足し、各変異で落ちることを test-result.md に貼る。手の確認に `Ctrl+Alt+Shift+D` を足した

## ラウンド 4（review 工程。同一コンテキスト。ラウンド 3 の直しの確認）

指摘なし。ラウンド 3 のあとの差分は**テスト（`chord.test.ts`・`assign.test.ts`・`KeyRouter.test.ts`）と `docs/verification.md` の手の確認 1 行だけ**で、本番コードは 3 回目の test から変わっていない（`git diff` の差分を確認）。ラウンド 3 のレビュアーが再現した 4 つの変異は、足したテストで落ちる。加えて `isAltGrComposed` の本体と 2 つの表を 97 個の変異で網羅し、全部落ちる（test-result.md）。差し戻しは上限（3）に達したので、独立した 4 回目のレビューは委ねていない（decisions D15）。

**件数（通算・ラウンド 1〜3）**：must 0・should 4（R1: 2・R2: 1・R3: 1）・nit 9（R1: 6・R2: 3）。すべて解消済み。
