# レビュー: 新しい workspace・tab・pane を、いま見ている場所で開く（herdr の `terminal.new_cwd`）

## タスク点検ログ（coding 工程内・「3.3」(b)）

`mode: autonomous` なので、自前の差分を生むタスクはすべて点検する（T10 は差分を持たないので対象外）。指摘はその場で直した。

### T1（protocol の `NewCwd`）

- [should][conv:regression-negative-control] 空文字の `path` をスキーマが通すことをテストが守っていなかった（`z.string().min(1)` に替えても通った）。
  「指定した場所」を選んだまま何も入れていないブラウザから実際に届く形で、弾くと作成が失敗する / 対応: 空文字と相対パスが通ることを見るテストを足し、
  JSDoc に「弾くのはサーバの検証」と書いた
- [nit][conv:-] `follow` の説明の「（既定）」がブラウザの設定の既定なのに、protocol の既定のように読めた（`newCwd` の無い要求は `follow` ではなく
  今までどおり）/ 対応: 書き分けた
- [nit][conv:-] 追加したテストの行が `printWidth: 100` を超えていた / 対応: prettier で整えた
- （点検の間の出来事）点検者が誤って `git stash` を実行し、すぐ `git stash pop` で戻したと報告した。protocol の差分が点検に渡した差分と一致すること、
  新しいファイル（`newCwd.ts`）が残っていることを確かめた

### T2（`session/newCwd.ts`）

- [should][conv:regression-negative-control] 相対パスを拒む規則（`isAbsolute`）をテストが守っていなかった（偽の `isUsableDir` が絶対パスの集合にしか
  true を返さないので、外しても通った）/ 対応: `isUsableDir` が「使える」と答えても `work/dir`・`~alice/work` を拒むテストを足した
- [should][conv:regression-negative-control] `makeNewCwdDeps` の「前面の cwd が先、無ければ OSC 7」の優先を入れ替えても通った / 対応: 両方に値がある場合のテストを足した
- [should][conv:regression-negative-control] `isUsableDir` に単体テストが無く、`return true` にしても、`isDirectory()`・`access(X_OK)` を外しても通った。
  既定のつなぎ（`home`・`isUsableDir`）も差し替えて通った / 対応: 一時ディレクトリで、ディレクトリ・実行できるファイル・無い場所・
  入れないディレクトリ（root と Windows では飛ばす）・シンボリックリンクを確かめるテストと、既定のつなぎのテストを足した。
  最初は `isDirectory()` を外しても通った（実行の権限の無いファイルは X_OK で落ちる）ので、ファイルに実行の権限を付けた
- [nit][conv:-] `cwdHint()` を `foreground()` を待つ前に読んでいた（design は待った後）。調べている間に届いた OSC 7 を取りこぼす /
  対応: 待った後に読み、それを守るテストを足した
- [nit][conv:-] `expandHome` の JSDoc「`~user` は…多くは使えない場所になる」は事実と違う（相対パスなので必ず使えない）/ 対応: 直した
- [nit][conv:-] サーバが Windows のとき、`isAbsolute` は `/foo`（ドライブ相対）も通し、`~/work` は区切りが混ざる /
  対応: しない。サーバはドライブを変えないので `/foo` はサーバのドライブの根として開き、区切りの混在も Windows は受け付ける。
  JSDoc に混在を書いた
- [nit][conv:-] 上限のタイマーの後始末（`clearTimeout`）をテストが守っていなかった / 対応: 先に読めたらタイマーが 0 本であることを見るテストを足した
- [nit][conv:-] （差分の外）Windows では OSC 7 の pathname が `/C:/Users/u` の形になり、「引き継ぐ」が必ず代わりの場所へ回る /
  対応: `parseOsc7` をサーバが Windows のときだけ直した（decisions D7）
- [nit][conv:-] `newCwd.ts` に `printWidth: 100` を超えるコードの行が残っていた / 対応: 折り返した

負の対照の生の出力は `nc2-T2b.txt`（test-result.md に貼る）。9 つの変異がすべて落ちた（`isDirectory` は直した後）。

### T3（`SessionService` の 3 つの作成）

- [should][conv:regression-negative-control] 新しい workspace の `cwdFallback` と 1 段目の代わり（`defaultCwd`）をどのテストも見ていなかった
  （応答から外しても、代わりをすり替えても通った）/ 対応: AC9 のテストに新しい workspace を足した
- [should][conv:regression-negative-control] 「deps はあるが要求に `newCwd` が無い」組を見ていなかった。`placeFor` の判定から `!newCwd` を外すと本番では
  TypeError になるのに通った（T4 の後は本番の `SessionService` が必ず deps を持つので、`newCwd` を載せないクライアントはこの組）/
  対応: 3 つの作成を `newCwd` なしで呼び、以前の場所で開くことを見るテストを足した
- [should][conv:-] `newCwdDeps?: NewCwdDeps` に `| undefined` が無く（すぐ上の `shell?` は付けている）、T4 のテストが
  `exactOptionalPropertyTypes` の下で TS2379 になっていた（`vitest` は型を見ないので通っていた）/ 対応: `| undefined` を足した。
  以後、型検査は各パッケージの `typecheck`（テストを含む `tsconfig.typecheck.json`）で見る
- [nit][conv:-] 分割で `Workspace.cwd` を書き換えないことを見ていなかった / 対応: AC3 のテストに 1 行足した
- [nit][conv:-] 分割は場所を決めた後に分割元を確かめ直さず、閉じられていてもシェルを起動してから猶予の後に破棄していた /
  対応: await の直後に `requirePane` を置き、起動しないことをテストで見るようにした（このテストは、閉じる側を待たずに見ていたため
  D24 の代わりの workspace を孤児と数えて一度落ちた。閉じる側も待つ形に直した）
- [nit][conv:-] import の並び（`NewCwd` がアルファベット順から外れていた）と、`followSource` がファイル末尾の export の後にあった / 対応: 並べ直した

負の対照の生の出力は `nc2-T3b.txt`（4 つの変異がすべて落ちた）。

### T4（入口の結線）

点検の前に負の対照を取った: `workspace.ts`・`tab.ts`・`pane.ts` のどれか 1 つから `newCwd` の受け渡しを外すと、
`surface/methods/index.test.ts` の「3 つの入口が newCwd の場所で開き…」が落ちる（`nc2-T4.txt`）。

- [should][conv:regression-negative-control] `composeServer` の結線のうち読み直しを担う部分（`terminals`・`inspector`・`getPane`）は、どれを壊しても
  単体でも E2E でも落ちない（E2E の時点ではエージェントの監視が `Pane.cwd` を追従させているので、記録の側だけで通る）/
  対応: `composeServer.integration.test.ts` に、`listen()` を呼ばずに（監視を動かさずに）組み立て、`cd` して待つだけのシェルの
  前面プロセスの cwd を読み直して開くことを見るテストを足した（Linux のみ）。4 つの変異（inspector・terminals・getPane・deps を渡さない）
  がすべて落ちた（`nc2-T4b.txt`）

### T5（web の設定のストア）

- [nit][conv:-] ファイル全体に prettier をかけたため、T5 と関係の無い既存テスト 3 か所の書式が変わっていた / 対応: 元に戻した
- [nit][conv:-] 新しいテストのループに、失敗したときの値を示すメッセージと波括弧が無く、周りとそろっていなかった / 対応: そろえた

### T6（web の 3 つの作成）

実装してから、既存の完全一致の期待値 5 件（`ActionDispatcher.test.ts` の `:108`・`:327`・`:341`・`:351`・`:715`）が落ちることを先に確かめてから直した
（`T6-before-expect.txt`）。負の対照 6 つ（worktree に newCwd を付ける・workspace/tab に元の pane を載せない・別の workspace の焦点の pane を
載せる・cwdFallback を知らせない・設定を読まない）はすべて落ちた（`nc2-T6.txt`）。

- [nit][conv:regression-negative-control] `confirmNewTab` が焦点の pane をダイアログを閉じた**後**で読む順序は正しいが、テストが守っていなかった
  （ダイアログの間に焦点の pane が閉じられると、閉じたときに戻す先へ差し替わる。閉じる前に読むと閉じた pane を拾って workspace の場所で開く）/
  対応: その場面のテストを足し、読む順序を前へ動かすと落ちることを確かめた（`nc2-T6b.txt`）。コードにも理由を書いた

### T7（設定ダイアログの「新しく開く場所」）

- [must][conv:e2e-observe-browser] 「打ちかけのまま Esc で閉じた値は保存しない」は実物の Chromium では成り立たなかった（閉じると入力欄から
  フォーカスが外れて `change` が立ち、保存される。happy-dom は立てないので単体テストは通っていた）/ 対応: design D8 の「離れたとき」に
  合わせ、閉じる操作（Esc・閉じる・背景）でも閉じる側で明示的に確定する形にした（decisions D8）。単体テストは閉じる 3 通りで確定することを見る
- [should][conv:-] `@keydown.enter` が IME の変換を確定する Enter でも保存していた / 対応: `isComposing || keyCode === 229` を除いた
  （`KeyInputController` の先例と同じ）。テストを足した
- [should][conv:-] `:value` を保存値へ一方向に結んでいたため、ほかの状態で描き直されるたびに打ちかけの文字が保存値で上書きされた /
  対応: `NameDialog` と同じく下書きの ref と v-model で持ち、開くたびに保存値から始める形にした。テストを足した
- [should][conv:-] 入力欄の背景を透かし枠を薄くしていて、値が入ると欄であることを示すのが 1.56:1 の枠だけになっていた（WCAG 1.4.11）/
  対応: ほかの入力欄と同じく UA の見た目のまま（`font: inherit; padding`）にした
- [nit][conv:regression-negative-control] `@keydown` で毎キー保存する・同じ値の比較を外す・`aria-describedby` を外す、の 3 つの変異が通った /
  対応: Enter 以外のキーで保存しないこと・同じ値なら保存し直さないこと・注記が結び付いていることを見るテストを足した
- [nit][conv:-] 注記の「以前と同じ場所で開いて知らせます」は利用者向けに曖昧で、トーストの言い方ともそろっていなかった / 対応: 「代わりの場所」にそろえた
- [nit][conv:-] 2 つ目の fieldset の間隔を新しいクラスで付けていた / 対応: 隣接の組み合わせ（`.settings-fieldset + .settings-fieldset`）にそろえた

直した後の負の対照は `nc2-T7b.txt`。途中で「閉じるときに方針を見ずに確定する」変異が通り、調べると方針が「指定した場所」以外では
入力欄が使えず下書きも開くたびに保存値へ戻るので、条件そのものが要らなかった——条件とそのテストを外した。

### T8（文書）

- [should][conv:-] 「既知の制約」の macOS・Windows の項目の最後の一文（前面でプログラムが動いている間はそのプログラムの場所）は Linux でしか
  成り立たない（macOS・Windows は前面の cwd を読めない）/ 対応: 「Linux（WSL2 を含む）では」の別の項目に分けた
- [should][conv:-] 「既知の制約」の末尾の「ほかに、各節に書いた制約：Windows ネイティブの pane の cwd の追従…」が元のまま残り、直前の項目と
  重なっていた / 対応: 消して、新しい項目から Windows の節の項目を指すようにした
- [nit][conv:-] H36 の対応 AC が `AC3` だけになり、何を検証するのか読めなくなった / 対応: 「AC3・AC16（分割した pane・Windows ネイティブの pane が
  既定のシェルで起動する）」と書いた
- [nit][conv:-] H36b が herdr との違いを置き場所だけのように読めた / 対応: 元の pane が無いときの代わりの違い（herdr は `$HOME`）を書いた
- [nit][conv:-] トーストの文言の引用が途中で切れていた / 対応: 全文にした
- [nit][conv:-] 確かめ方の手順で、新しい tab は必ず名前を尋ねるのに条件つきで書き、入力欄の Enter の後に Esc で閉じる手順が抜けていた / 対応: 直した
- [nit][conv:-] 新しい workspace のキーの表記が同じ文書の既存の箇所（`N`）とそろっていなかった / 対応: `Ctrl+B N` にそろえた
- [nit][conv:-] 「decisions D7」がどの work のものか書いていなかった（MVP にも D7 がある）/ 対応: 「20260921-new-terminal-cwd の decisions D7」と書いた

### T7 の 2 ラウンド目

指摘なし。点検者は 12 通りの変異がすべて単体テストで落ちることと、実物の `SettingsDialog.vue` を Playwright の Chromium に載せて、
閉じる 3 通り・キーだけの操作のどれでも打ちかけの値の保存が 1 回だけ（閉じた後に Chromium が立てる `change` で保存し直さない）、
`cancel()` を通らずに閉じる経路（別のダイアログの文脈で上書き・認証切れや切断でダイアログごと外れる）でも Chromium の `change` で
確定することを確かめた。

### T9（E2E）

点検の前に、web が方針を読まずいつも `{ policy: "current" }` を送る変異を入れたビルドで、4 件とも落ちることを確かめた（`nc2-T9.txt`）。

- [should][conv:e2e-observe-browser!] AC-I5 の「漏れていない」を、閉じた直後に p1 の画面を 1 回見るだけで確かめていた（漏れた文字がエコーで戻る前に
  判定が済む。Enter と Esc は画面に出ないので見ていない）/ 対応: ブラウザが送った INPUT（`watchSentInput`）で、ダイアログの間に 1 つも
  送っていないことを見る形にした。閉じた後に打った印が p1 に届くのを待ってから画面にパスが無いことも見て、観測の手段が生きている対照も足した
- [should][conv:-] AC1 の手順で、元になる焦点の pane（分割した pane）では `cd` していなかった（同じ tab のもう 1 つの pane と同じ場所にいて、
  元の pane の取り違えを見分けられない）/ 対応: 新しい workspace の直前に、焦点の pane で 3 つ目の場所へ移るようにした
- [nit][conv:e2e-observe-browser] AC7 が以前の振る舞いと見分けられていたのは、前の手順（AC6）で作った tab の pane の記録がホームだったからで、
  コメントの理由と違っていた / 対応: 分割の前に、元の pane の記録（`Pane.cwd`）が `cd` した先へ追従したことをテストのクライアントの
  `pane.updated` で待つ形にした（前提を作るためのサーバの状態の確認）

### cross（タスクをまたぐ不変条件）

- [nit][conv:-] Windows では OSC 7 の段が上限の 200ms の中に入っていて、プロセスの走査が上限を超えると同期で読める OSC 7 まで捨てていた
  （`newCwd.ts` の上限は `deps.liveCwd` 全体に掛かり、`makeNewCwdDeps` の `liveCwd` は `foreground()` を待ってから OSC 7 を読んでいた。
  T2 と T4 の境目で、どちらのタスクの差分だけからも見えない）/ 対応: 依存を `liveCwd`（前面プロセスの cwd。上限つき）と `hintCwd`（OSC 7）に
  分け、OSC 7 は上限を超えても待った後に読む形にした（decisions D9）。4 つの変異がすべて落ちた（`nc2-cross.txt`）
- [nit][conv:-] 知らせる範囲について、文書の説明がサーバ・web より狭かった（ホーム・起動した場所が使えないとき、「指定した場所」が空のとき、
  代わりの 2 段目に触れていなかった）/ 対応: 文書の概要に書き足した
- [nit][conv:-] 「指定した場所」に入れられるパスの説明（「絶対パスか ~ で始まるパス」）がサーバの規則より広かった（`~user` は相対パスとして
  拒まれる）/ 対応: 設定ダイアログの注記と文書を「絶対パスか ~/ で始まるパス（~ だけならホーム）」にそろえた

## ラウンド 1（review 工程）

差分全体を別のコンテキストに点検させ（正確性・保守性・規約・要件・価値）、要件適合と価値適合は自分でも見た。`aidev coverage` は tasks 承認時と同じ
（ac=18、design=18/18、tasks=18/18、gaps=0）。must・should は無し。

- [nit][conv:-] `design.md:173-217`・`:259-260` design が decisions D8・D9 と cross の直しの後の実装と合っていない（`NewCwdDeps` に `hintCwd` が無い・「規則（ここが正典）」の
  follow に OSC 7 の段が無い・`makeNewCwdDeps` の擬似コード・注記の「~ で始まる」・入力欄は `change` だけで保存）/ 対応: design を実装に合わせ、D8・D9 を指した
- [nit][conv:-] `packages/server/src/session/newCwd.ts:17-18` ほか コメントの「D◯」が design か decisions か書いていない（この work は両方に D1〜D9 があり中身が違う）/
  対応: 「design D◯」「decisions D◯」と書き分けた
- [nit][conv:e2e-observe-browser] `packages/e2e/src/specs/new-terminal-cwd.spec.ts:206` テンプレート文字列の中の `\n` が本物の改行になり、`printf` が PS2 の継続行で
  実行されていた（印が出たのは改行が引用符の中に入ったから）/ 対応: `\\n` にした
- [nit][conv:-] `packages/web/src/components/SettingsDialog.vue:295-296` パスの入力欄に `autocorrect="off"` が無く、iOS Safari がディレクトリ名を単語として
  直しうる / 対応: 足した
- [nit][conv:-] `packages/server/src/session/newCwd.ts:94` 「指定した場所」を正規化せずに返していた（`~/` は末尾に `/` が付き、`..` も残る。worktree が既に
  開いているかの完全一致の比較と食い違いうる）/ 対応: `isAbsolute` の後に `resolve` で正規化した。テストを足した
- [nit][conv:-] （自分で見た価値適合）新しい workspace の名前は、どのリポジトリで開いても一律に「1」で、別のリポジトリで開いた workspace がサイドバーで
  見分けられない（「複数のリポジトリを並行して見張る」の価値を半分しか満たさない）。herdr は repo 名かフォルダ名を自動の名前にする
  （`src/workspace.rs` の `display_name`・`automatic_workspace_label`）。この work の要件（開く場所）の外 / 対応: backlog（`product-roadmap.md`）に起票し、
  次の work で扱う
