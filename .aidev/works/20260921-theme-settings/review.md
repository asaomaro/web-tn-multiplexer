# レビュー: テーマを選び、OS の明暗に合わせて切り替える（herdr のテーマ）

## タスク点検ログ（coding 工程内・「3.3」(b)）

`mode: autonomous` なので、自前の差分を生むタスクはすべて点検する（T19 は差分を持たないので対象外）。指摘はその場で直した。

### T1（protocol の `color.ts`）

- [should][conv:-] 「全ての相手」のテストが比の下限しか見ず、2% 刻みの実装・最後の相手だけを見る実装が通った / 対応: 期待値を最初の色 `#ff9b9b` に固定し、
  1 つ手前が足りないこと・相手の順を逆にしても同じことを足した
- [should][conv:-] WCAG の式の直線の部分（`s / 12.92`）を通る値が無く、`s * 12.92` に書き換えても通った / 対応: `#0a0a0a` の輝度を見る 1 本を足した
- [nit][conv:-] テストの題名にある 4.27（0.6 に薄めた文字）を確かめていなかった / 対応: 検査を足した
- [nit][conv:-] 浮動小数の誤差でちょうど .5 が下がる（`mixHex("#000000", "#fafafa", 0.07)` が #e8e8e8）/ 対応: 1e-9 を足して丸め、その例をテストにした
- [nit][conv:-] 割合 `t` を検査せず、範囲外・NaN で #rrggbb でない文字列を返した / 対応: 0〜1 の外で投げ、テストを足した
- [nit][conv:-] 「足りていればそのまま」と書きつつ小文字に揃えて返していた / 対応: コメントに「小文字の #rrggbb で返す」と書き、テストを足した

### T2（protocol の `theme.ts`）

- [should][conv:regression-negative-control] 「見えるならそのまま」の検査が、カーソルと文字が同じ色の入力で何も確かめておらず、規則 (b) を無条件にしても通った
  （catppuccin・nord・kanagawa-lotus・vesper のカーソルが文字の色に置き換わる）/ 対応: 文字と違うカーソルの入力に替え、4 テーマのカーソルが上流のままで
  あることを足し、無条件にする変異で落ちることを確かめた（`nc-T2.txt`）
- [nit][conv:-] `THEME_NAMES` の順を固定しておらず、並べ替えても通った（設定の一覧の並びがこの順に依る）/ 対応: 17 個の並びごと固定した

### T3（protocol の `client.theme`）

- [nit][conv:-] 「17 のテーマの名前だけを受ける」テストが 2 つの名前しか受けておらず、一部の名前の列挙に替えても通った / 対応: `THEME_NAMES` の全部を受けることを見る
- [nit][conv:-] このファイルは work ごとの describe の前に `// <work-id>：…` を置く流儀なのに、work の名前をテストの題名に入れていた / 対応: 流儀に合わせた
- [nit][conv:-] 1 行が `printWidth: 100` を超え、HEAD では通っていた prettier の検査から外れた / 対応: 折り返した

### T4（server の `client.theme` の受け口）

- [nit][conv:-] 「知らないクライアントは無視する」テストが投げないことしか見ず、record を新しく作る実装でも通った。既存の「知らない id」のブロックと別の場所にあった /
  対応: 既存のブロックへ移し、record を作らないことを足した
- [nit][conv:-] あるクライアントの `setTheme` がほかのクライアントの `theme` を変えないことを確かめていなかった（D6 はクライアントごとに別の値を前提にする）/
  対応: 2 つ目のクライアントが null のままであることを足した

### T5（server の `answerPalette.ts`）

- [should][conv:-] 2 段目が比べる `lastInteractionAt` は、fit していないモバイルでは操作しても進まず（`SizeAuthority.noteInteraction` が資格の判定の
  後で `touch`）、2 台いると「最後に接続した人」で選んでいた（AC8 と合わない）/ 対応: `touch` を判定の前に移し（decisions D7）、実物の
  `SizeAuthority`・`ClientRegistry` で「後から入力したモバイルの配色で答える」テストを足し、戻すと落ちることを確かめた（`nc-T5.txt`）
- [nit][conv:-] 1 段目のテストで権限者も同じ tab を見ており、「権限者が表示していること」を条件に足す変異が通った / 対応: 権限者が別の tab を見ている場合を足した
- [nit][conv:-] 「pane・tab が見つからなければ」のテストが tab の無い場合を見ていなかった / 対応: 足した
- [nit][conv:-] 箱の JSDoc が「復元した pane が問い合わせた場合」と書き、実際の順序（復元は attach の後）と食い違っていた / 対応: 保険であると書き直した
- [nit][conv:-] 引き方の説明の JSDoc が `answerPaletteFor` でなくインターフェースに付いていた / 対応: 関数の前へ移した

### T6（server の Mirror が配色を関数で受ける）

- [should][conv:regression-negative-control] TerminalManager の層で「作るときに 1 回引いて保持する」実装が通った（問い合わせの後にしか引いた記録を見ていない）/
  対応: 作った直後に引いていないことを足し、保持する変異で落ちることを確かめた（`nc-T6.txt`）
- [nit][conv:-] `palette()` が投げてはならない約束（xterm headless は OSC のハンドラを try/catch で囲わず、投げると書き込みの列が止まりサーバが落ちる）が
  書かれていなかった。OSC 4 で設定の OSC でも配色を引いていた / 対応: 約束を JSDoc に書き、OSC 4 は最初の問い合わせで 1 回だけ引く形にした

### T7（composeServer の結線）

- [should][conv:-] 新しい pane はシェルの起動の猶予の後にモデルへ入り、新しい tab は `client.view` が届くまで誰も見ていないので、その間の問い合わせに
  dracula で答えていた（明るいテーマの人が作った pane でも暗い背景の答え）/ 対応: 答えの引き方に「テーマを伝えた全員のうち最後に操作した人」の段を
  足した（decisions D8。design D6・AC8 に書き戻し、外すと落ちることを `nc-T5.txt` で確かめた）
- [nit][conv:-] 箱が要る理由を「`clients` は下で作る」とだけ書き、本当の理由（`session` が `terminals` を受けて作られる）が抜けていた / 対応: 書き足した

### T8（web の `theme/themes.ts`）

- [should][conv:-] 保存した `themeAuto: false` を読むケースが無く、「切」を「入」として読む変異が通った（再読み込みで自動の切替が入に戻る）/
  対応: 切を読むケースを足し、その変異で落ちることを確かめた（`nc-T8.txt`）
- [nit][conv:-] 「切なら OS の明暗に依らず」の暗い側の検査が、対の暗い側も同じ名前で何も確かめていなかった / 対応: 暗いときに別の名前を入れた
- [nit][conv:-] AC5 の「明るいとき・暗いときは 17 のどれでも」を検査していなかった / 対応: 明るいときに暗いテーマを入れるケースを足した
- [nit][conv:-] 表示名を固定していなかった / 対応: design の 17 個で固定した
- [nit][conv:-] 対の表を `string` にして `as never` で型の検査を外していた / 対応: `ThemeName` にした

### T9（web の `theme/uiTokens.ts`・`App.vue` の `:root`）

- [must][conv:-] 再接続の表示は幕（全テーマ黒 0.5）の上に文字を直に描くので、明るいテーマで 3.0〜3.5（注記は 2.7〜2.9）と AC9 を割った。表の相手に
  無く検査されていなかった / 対応: T10 の同じ指摘と合わせて直した（decisions D9）
- [should][conv:-] 「dracula は今の見た目」が 13 変数しか見ず、`--wtm-accent-fg`・淡い面・幕・color-scheme を定数と `App.vue` の両方で変えても通った /
  対応: 18 変数と color-scheme を丸ごと固定した
- [should][conv:regression-negative-control] 検査がコントラストの結果だけで、表の決め方（hover・bg の割合、accent-fg、淡い面、警告と idle の元の色、`overlay`）を
  変えても通った / 対応: 規則の検査・暗い 1 つと明るい 1 つの全値の固定・手で計算した重ねた色を足した
- [should][conv:regression-negative-control] 負の対照の記録が抜き出しで、件数の行・落ちたテーマ・失敗の中身が無かった（実際は明るい 7 テーマと one-dark・
  solarized の 9 つ）/ 対応: 変異の差分と出力を省かずに取り直し（`nc-T9.txt`）、tasks の記述を実際に合わせた
- [nit][conv:-] `App.vue` のコメントが「控えが無ければずっと効く」と読めた（design D5 では `start()` が必ず当て直す）/ 対応: 直した

### T10（部品に直に書いた色の置き換え）

- [must][conv:-] （T9 の must と同じ）再接続の表示の文字が明るいテーマで AC9 を割った / 対応: 明るいテーマの強い幕を白い幕にし（decisions D9）、
  幕の上の文字を全テーマの検査に足した。戻すと 7 テーマで落ちることを確かめた（`nc-T10.txt`）
- [should][conv:regression-negative-control] goto の補足の透明度の直し（0.6 → 0.7）を守るテストが無かった / 対応: 部品の CSS を読み、対象外を除く
  `opacity` が 0.7 以上であることを確かめるテストを足し、0.6 に戻すと落ちることを確かめた（`nc-T10.txt`）

### T11（設定の store のテーマ）

- [should][conv:-] `setThemeAuto` が保存することを確かめておらず（見ていた値は `setTheme` が書いたもの）、保存を消しても通った / 対応: 入の保存と読み戻しを足した
- [should][conv:-] `setThemeDark` の保存と、null を入れた後の読み戻しを確かめていなかった / 対応: 足した
- [nit][conv:regression-negative-control] 負の対照の記録に変異の差分が無かった / 対応: 差分と出力を省かずに取り直した（`nc-T11.txt`）

### T12（web の端末の配色と入れ替え）

- [should][conv:-] ブロックカーソルの下の文字の色（`cursorAccent`）を渡しておらず xterm.js の既定の黒のままで、明るいテーマでは 1.5〜2.9 と読めなかった
  （規則 (b) の 2 テーマではかえって悪化）/ 対応: 端末の配色の規則 (c) として背景色にし（decisions D10）、外すと落ちることを確かめた（`nc-T12b.txt`）
- [should][conv:-] 入れ替えのテストが表示中の端末だけで、隠れた端末を替え損ねる変異・前の配色と混ぜる変異が通った / 対応: 隠れた端末と dracula へ戻す場合を足した
- [should][conv:-] 作るときの配色のテストが常に同じ値を返し、一度だけ読んで使い回す変異が通った / 対応: 途中で配色を替えて作る場合を足した
- [nit][conv:-] 書き込んだ中身を確かめておらず、中身を消してから替える変異が通った / 対応: 替えた後も中身が残ることを確かめた（3 つの変異は `nc-T12.txt`）
- [nit][conv:-] 16 色のうち 4 つしか見ていなかった / 対応: 16 個の名前すべてを比べる

### T13（web の `theme/ThemeController.ts`）

- [should][conv:-] 同期の watch（`flush: "sync"`）で、`setTheme` が 2 つの値を順に変える途中の状態のテーマ（新しいテーマの対）まで当て、間違った名前を
  サーバへ送り、全端末を 2 回描き直していた（自動の切替が入って既定の対のまま 1 つのテーマを選ぶ、AC7 のふつうの操作）/ 対応: 既定の `pre` にし、
  その操作で 1 回だけ当てることを確かめた
- [should][conv:regression-negative-control] 控えを書く時点（自動の切替・暗いときの変化）と控えの `dark` の組を確かめておらず、4 つの変異が通った
  （自動の切替を入れただけで再読み込みすると、固定のテーマが一瞬出る）/ 対応: 3 つの検査を足し、変異で落ちることを確かめた（`nc-T13.txt`）
- [nit][conv:-] 「1 回目は省略しない」が `applied` の初期値に頼るだけで、start の前に `apply` が呼ばれると省かれた / 対応: start の先頭で空にし、テストを足した
- [nit][conv:-] テストのコメントが jsdom と書いていた（実際は happy-dom）/ 対応: 直した
- [nit][conv:regression-negative-control] 負の対照の記録が抜き出しだった / 対応: 差分と出力を省かずに取り直した（`nc-T13.txt`）

### T14（`public/theme-boot.js`）

- [should][conv:regression-negative-control] テストの `matchMedia` の偽物が問い合わせの文字列を見ず、控えの側の問い合わせを `light` に変えても通った（実際には
  自動の切替が入っているときの最初の描画で明暗が逆になる）/ 対応: 本体と同じ問い合わせでなければ投げる偽物にし、変える変異で落ちることを確かめた（`nc-T14.txt`）
- [nit][conv:-] localStorage の読み出しが投げる場合（プライベートモード等）を確かめていなかった / 対応: 足した

### T15（`main.ts` の結線）

- [should][conv:e2e-observe-browser] 起動の直後の `start()` は接続より前で送れないので、テーマがサーバに届く経路は `onOpened` の `resend()` だけなのに、
  予定の E2E（テーマを変えてから問い合わせる）ではそれを外しても通る / 対応: T18 で「保存したテーマのまま、設定に触れる前に問い合わせる」を入れ、
  `resend()` を外すと落ちることを確かめた（`nc-T18.txt`）
- [should][conv:e2e-observe-browser] 後から作る端末の色（`getTheme`）と控えの書き先（`storage`）も、E2E の書き方しだいで守られない / 対応: 開き直した後・
  分割した後の端末の背景と、本体が走る前の `<html>` の inline の変数を E2E で見て、それぞれ外すと落ちることを確かめた（`nc-T18.txt`）
- [nit][conv:-] `resend()` を `viewSync.onConnectionOpened()` と同じ listener に入れていた（片方が投げると飛ばされる）/ 対応: 別の 1 本にした

### T16（設定ダイアログの「テーマ」の節）

- [should][conv:-] 自動の切替の注記を切り替えの上に差し込み、押した切り替え自身が 40px 下へずれた / 対応: 注記と欄を切り替えの下に置いた
- [should][conv:-] 「テーマ」の選択肢の説明に、自動の切替中の注記（選ぶと切れる。AC7）が結び付いていなかった / 対応: `aria-describedby` に足した
- [should][conv:-] `max-width: 60%` で、幅 390 以下では「既定（〈対の名前〉）」が切れて読めなかった / 対応: 上限をやめ、狭いときは次の行へ回す
- [should][conv:-] 明るいとき・暗いときの `:value` の束縛を守るテストが無かった（外しても通った）/ 対応: store の値に追従することを確かめた
- [should][conv:-] `settings.spec.ts` の節の並びの判定が 3 節のまま（T18 の文言がそれを拾えない）/ 対応: T18 で 4 節に直した（decisions D11）
- [nit][conv:-] 名前付け・`aria-describedby`・`aria-live`・押した後のフォーカスを確かめていなかった / 対応: 足した
- [nit][conv:-] 「（既定）」を付ける先を `"dracula"` と直書きしていた / 対応: `DEFAULT_THEME_NAME` にした
- [nit][conv:-] 注記「選ぶと切れる」が、同じテーマを選び直しても `change` が出ない実際と合わなかった / 対応: 「ほかのテーマを選ぶと」にした
- [nit][conv:-] 部品の冒頭・CSS・テストの題の「3 節」が古いまま / 対応: 4 節に直した
- [nit][conv:-] ヒント「このブラウザにだけ効きます」が、テーマが色の問い合わせの答えにも使われることと合わなかった / 対応: 「残ります」とし、一言添えた
- （点検とは別に）直す途中で、整形の揃っていない既存のファイルに prettier を掛けて関係の無い行まで整形してしまい、HEAD から当て直した（差分はこの work の変更だけ）

### T17（文書と起票）

- [must][conv:-] 対応表 H24 の対象外 2 件に理由が無かった（AC11 は「対象外の理由」まで求める）/ 対応: 理由を添えた
- [should][conv:-] 「herdr はサーバの設定ファイル」が誤り（herdr はクライアントの機器の設定ファイル）/ 対応: 直した
- [should][conv:-] 「明るいテーマは濃く見える」だけで、暗いテーマでは明るく寄ることが抜けていた / 対応: 両方を書いた
- [should][conv:-] macOS・Safari・Firefox で確かめる項目が、Linux の手元の節（そこでは使えない）にしか無かった / 対応: 他の機器の節に 1 行足した
- [nit][conv:-] 端末の配色の規則の説明に、カーソルの下の文字の規則（decisions D10）が抜けていた / 対応: 足した
- [nit][conv:-] 「今までの見た目を変えない」が、dracula でも変わる 3 か所（decisions D1〜D3）と合わなかった / 対応: 括弧で添えた
- [nit][conv:-] OS に明暗の設定が無いときを事実として書き、確かめる形になっていなかった / 対応: 期待として書いた
- [nit][conv:-] backlog の 2 件の区切りが全角の「：」（既存は「: 」）/ 対応: 揃えた

### T18（E2E）

- [should][conv:e2e-observe-browser!] 開き直しの最初の描画の検査が、どれも固定の組と OS で選ぶ組が同じ値になる条件で、控えの `auto` の扱いを壊しても通った /
  対応: OS の明暗と自動の切替の入切で値が分かれる条件に替え、両方向の変異で落ちることを確かめた（`nc-T18.txt`）
- [should][conv:-] 約 140 文字の問い合わせのコマンドを 2 つのブラウザで 4 回打ち、負荷の高い手元で 90 秒の上限の 3 秒前まで伸びた / 対応: スクリプトを
  ファイルに置き、打つ行を短くした（一式で約 40 秒）
- [should][conv:e2e-observe-browser!] `prefix+c` はタブを作らず名前のダイアログを開くだけで、タブの数の判定は漏れても必ず通った。「端末へ送らない」は固定の待ちだけが根拠 /
  対応: 名前のダイアログが開かないことを見て、閉じた後に打った印を送るまで待ってから、印より前に何も送っていないことを見る
- [should][conv:e2e-observe-browser!] 枠の比を実際のダイアログの背景でなく表の値と比べていた / 対応: 計算済みの背景を読み、表の値と一致することも見る
- [should][conv:-] 追加のキーの文字の色を「dracula でない」だけで見ていた / 対応: `<html>` の `--wtm-fg`・`--wtm-menu-active-bg` と一致することを見る
- [should][conv:-] AC-I3（切り替えを Space で入れ、明るいとき・暗いときをキーで選ぶ）・AC-I4（閉じたら端末へ戻る）・AC-I2（選び直せば元に戻る）を確かめていなかった /
  対応: 足した
- [nit][conv:-] テーマを替えた直後にスクロールのつまみの位置を読んでいた / 対応: 描画の 2 回分を待ってから読む
- [nit][conv:-] design の「`.xterm-viewport` の `scrollTop`」から替えた理由が残っていなかった / 対応: spec のコメントと decisions D12 に残した
- [nit][conv:e2e-observe-browser!] 開き直した後の待ちが前のページの値で即座に通り、表示の送信を待たずに分割していた / 対応: 開き直した後の `client.view` を待つ
- [nit][conv:-] 「開いている全 pane の端末の色が替わる」を 1 つの端末でしか見ていなかった / 対応: 先に分割し、2 つとも替わることを見る
- [nit][conv:regression-negative-control!] E2E の負の対照の記録が抜き出しで、どの判定が捕まえたかが分からなかった / 対応: 出力を省かずに取り直した（`nc-T18.txt`）

### cross（タスクをまたぐ不変条件）

- [should][conv:-] 答えの 3 段目は「作った人の操作の時刻が最新」を前提にしていたが、作る方式（tab・workspace）は時刻を進めず、分割も起動の猶予の後に
  進めていた（明るいテーマの人が作った pane なのに、ほかの暗いブラウザの答えになる）/ 対応: 3 つの受け口で作る前に `touch` し（decisions D13）、
  「別の人が後から操作していても作った人の配色で答える」テストを足し、外すと落ちることを確かめた（`nc-cross.txt`）
- [should][conv:-] 操作の時刻が接続の時刻から始まり、一度も操作していない後から来た（再接続した）クライアントが先に操作した人に勝っていた /
  対応: 答えに使う `lastActedAt`（初期 0）を足した（decisions D13。接続の時刻で選ぶ変異で落ちることを確かめた）
- [nit][conv:-] decisions D10（カーソルの下の文字の規則）が requirements・design に書き戻されていなかった / 対応: 書き戻した
- [nit][conv:-] decisions D12（スクロールの見方）・E2E の `prefix+c` への変更が design の AC 対応に書き戻されていなかった / 対応: 書き戻した
- [nit][conv:-] decisions D11（4 節）が design の対象範囲と対応表の H25 に書き戻されていなかった / 対応: 書き戻した
- [nit][conv:-] decisions D7（`SizeAuthority` の変更）が design の対象範囲・D6 に書き戻されていなかった / 対応: 書き戻した
- [nit][conv:-] 利用者向けの文書の「dracula で変わった箇所」の列挙が欠けていた / 対応: 押された状態の背景と goto の補足の文字を足した

### test ラウンド 1 の差し戻し（`mobile.spec.ts` の要求の並び）

- 同じコンテキストで点検した（T18 の 2 巡目。`same_session`）。指摘 0 件——`client.theme` は `client.hello` の直後（`client.view` より前）に送られるので、
  並びの poll が通った時点で記録に入っており、追加した `toContain` を待たずに読んでよい。

## ラウンド 1（review 工程。別のコンテキストに委ねた）

- [must][conv:-] packages/web/src/theme/uiTokens.ts:326（使う側 `PaneFrame.vue:145-147`）選ばれている pane の枠（`--wtm-menu-border`＝herdr の `surface0`）が周りの背景とほぼ同じ明るさ
  （one-light 1.00・rose-pine-dawn 1.00・solarized-light 1.04・gruvbox-light 1.11・rose-pine 1.13。dracula は 1.79）で、明るいテーマで分割して使う人が入力先の pane を
  見失う（前の work 20260920-ui-selection-visuals の US3・AC4）/ 対応: 専用の変数 `--wtm-pane-current` を足し、dracula 以外は背景・端末の背景に対して 3:1 に寄せる（decisions D15）
- [should][conv:-] packages/web/src/theme/uiTokens.ts:293 選択の面（`--wtm-menu-active-bg`＝`surface0`）と枠の背景の比が one-dark 1.07・rose-pine 1.07・tokyo-night 1.17 など低く、
  メニュー・goto・tab・サイドバーで選択が見分けにくい（dracula は 1.56）/ 対応: 枠の背景に対して 1.5 以上に寄せる（decisions D15）
- [nit][conv:-] packages/web/src/main.ts:176 「テーマがサーバに届く経路はここだけ」は、接続中にテーマを替えたときの `apply` からの送信と合わない / 対応: 「接続の直後に」に直す
- [nit][conv:-] decisions.md の D3・docs/verification.md で、dracula でも暗く描かれるようになったものの列挙から UA の既定のボタンが漏れていた / 対応: 足す
- [nit][conv:-] packages/e2e/src/specs/theme-settings.spec.ts のモバイルの 1 本が AC13 の「AC5 もモバイルで効く」を見ていない / 対応: 自動の切替と `emulateMedia` を足す
- [nit][conv:-] packages/web/src/theme/ThemeController.ts:106-121 同じブラウザの別のタブで設定を変えると、控えがこのタブの古い設定から作られ prefs と食い違う / 対応: 控えを
  保存された設定（`readPrefs`）から作る
- [nit][conv:-] packages/protocol/src/theme.ts 上流の選択の背景と端末の背景の比が低いテーマがある（one-light 1.11 等）。requirements・decisions D5 の決めごとの内側 / 対応: backlog に起票する

ラウンド 1 の対応の確かめ：変異を入れて落ちることを確かめた（`test-result.md` の「review ラウンド 1 の差し戻しの後」。PaneFrame の変数の取り違えは単体では捕まらず、
E2E で捕まる）。web の単体 1202 本・theme の E2E 8 本・`keys-mouse-dialogs`・`workspace-tab-pane` の 23 本が通った。

## ラウンド 2（review 工程。別のコンテキストに委ねた）

- [must][conv:regression-negative-control!] packages/web/src/theme/uiTokens.ts:340（描く側 `Sidebar.vue:203` の「未検証」。親の `.sidebar-row-line2` は `Sidebar.vue:295` で `opacity: 0.75`）
  警告の文字 `--wtm-warn-fg` を不透明のまま 4.5 に寄せていたが、実際は 0.75 に薄めて描かれ、8 テーマで枠の背景の上 3.84〜4.34、hover の上では 13 テーマが 4.5 を割る
  （AC9 の「薄めて描く文字も 4.5」に反する）。テストも不透明で比べていた / 対応: 下の「ラウンド 2 の対応」
- [nit][conv:-] design D5・「振る舞いの詳細」に、控えを保存された設定から作る変更（ラウンド 1）が書き戻されていない / 対応: 書き戻す
- [nit][conv:-] docs/verification.md の「コントラストのために寄せる」の列挙に、選ばれている pane の枠と選択の面（decisions D15）が無い / 対応: 足す

ラウンド 2 の対応：2 回目の差し戻しなので、同じ不変条件（薄めて描く入れ物の中に、文字の色以外の色で描く文字・記号があるか）を支える箇所を全部洗った。
`opacity` を持つ入れ物（research F40）の中身を見ると、色の付いた文字はサイドバーの 2 行目の「未検証」（警告）だけで、エラーの文字（`LoginView.vue:189`・
`ReconnectOverlay.vue:104`・`TerminalPane.vue:94`）・状態の記号（Sidebar・goto・モバイルのピッカーの 1 行目）・押された状態の文字（アクセント）は、どれも
薄めた入れ物の外にある。~~「未検証」は dracula でも選ばれている行の上で 3.76 と割っていた（既存の穴）ので、~~（ラウンド 3 で訂正：「未検証」は agents の行にだけ出て
選択の面の上に来ない。dracula では 0.75 に薄めても menu-bg の上 5.39・hover の上 4.63 で以前から満たしており、割っていたのは明るいテーマなど——menu-bg の上で
8 テーマ・hover の上で 13 テーマ）色を寄せるのではなく薄めるのをやめた（decisions D16）。
行ごと薄める形・警告も薄める形の変異で、部品の CSS を読む単体テストが落ちることを確かめた（`test-result.md`）。nit 2 件は design D5 と `docs/verification.md` に書き戻した。

## ラウンド 3（review 工程。別のコンテキストに委ねた）

- [should][conv:-] packages/web/src/components/Sidebar.vue:302-303（同じ主張が decisions D16・review.md のラウンド 2 の対応にある）D16 の理由「dracula でも選ばれている行の上で 3.76」
  は誤り——「未検証」は agents の行にだけ出て、その行は選択の面（`sidebar-row-current`）にならない。dracula の実際の下地では menu-bg 5.39・hover 4.63 で以前から満たしていた。
  したがって dracula の「未検証」を濃くしたのはコントラストのための直しではなく、requirements の非機能要件・AC4 の例外の外で既定の見た目を変えている。dracula で変わった箇所の
  一覧（`docs/verification.md`・`docs/herdr-parity.md` の H24 ②・tasks.md のリスク・test-result.md の AC4）にも載っていない。明るいテーマで警告を薄めない判断そのものは正しい /
  対応: 下の「ラウンド 3 の対応」
- [nit][conv:-] test-result.md の「`notifications.spec.ts`（サイドバーの『未検証』を見る）」は誤り（その spec は「未検証」を見ない。守っているのは部品の CSS を読む単体テスト）/ 対応: 直す

ラウンド 3 の対応：実装の判断（全テーマで「未検証」を薄めない）と CSS の宣言・色の値は変えず、理由の記述と記録を事実に合わせた。decisions D16 の背景を実際の下地
（agents の行＝menu-bg・hover。dracula は 5.39・4.63 で以前から満たす）に直し、dracula の変化を「規則をそろえるための意図した例外」と決定・影響に書き、design の表が
選択の面（active）も見るのは行の下地になりうる 3 面をまとめて見るため、と 1 文残した。`Sidebar.vue` のコメントも同じ事実に直した。dracula で変わった箇所の一覧
（requirements の非機能要件と AC4・tasks のリスク・test-result の AC4・`docs/verification.md`・`docs/herdr-parity.md` の H24 ②）に D16 を足した。nit は test-result の
実行の記述を直し（守るのは `uiTokens.test.ts` の「警告の文字を薄めない（Sidebar.vue）」、E2E 16 本は見た目の回帰の確認）、ラウンド 2 の対応の誤りは取り消し線で訂正した。

## ラウンド 4（review 工程。同じコンテキストで確かめた）

指摘なし。ラウンド 3 の直し（新しいコンテキストに委ねた）は記述とコメントだけで、実装・CSS の宣言・色の値は変わっていない（`git diff` で確かめた）。
decisions D16 の理由は実際の下地（agents の行＝menu-bg・hover）と数値に合い、dracula で変わった箇所の一覧（requirements の非機能要件と AC4・tasks のリスク・
test-result の AC4・`docs/verification.md`・`docs/herdr-parity.md` の H24 ②）に D16 が載った。web の単体 1203 本・lint が通った。
