# レビュー: 05-e2e-docs（E2E・性能計測・docs）

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/e2e/src/support/panes.ts `["?"]` の待ち（workspace・goto・mobile）は、p1 の要素が作り直されると印の無い p1 が `"?"` と読めてすぐ通るのに、コメントは「誤って通ることはない」としていた（T13） / 対応: 修正済
- [nit][conv:-] packages/e2e/src/specs/keys-mouse-dialogs.spec.ts goto の test が Enter の前に選択中の行が p1 の pane の行であることを確かめていない（初期選択の退行を見逃す）（T13） / 対応: 修正済
- [nit][conv:-] packages/e2e/src/specs/terminal-app.spec.ts 分割の段がテストのクライアントのイベントを待ってすぐブラウザを操作していた（同じ形の競合の点検漏れ）（T13） / 対応: 修正済
- [should][conv:-] docs/verification.md AC11 の期待（token 付きの `wtm: open` の行・ログイン画面を経ずに入れる）は token を初めて作る起動でしか成り立たず、前の手順で既定の state-dir を使った後だと先へ進めない。起動のコマンドに `--state-dir` も無い（T14） / 対応: 修正済
- [should][conv:-] docs/verification.md 「WSL2 は node-pty の ConPTY 経由」は誤り（WSL2 は Linux の PTY。ConPTY は Windows ネイティブだけ）（T14） / 対応: 修正済
- [nit][conv:-] docs 母艦の LAN の IP の例が 192.168.1.50 と 192.168.1.20 で食い違い、SAN と `--origin` が合わない（T14） / 対応: 修正済
- [nit][conv:-] docs/verification.md Windows ネイティブの AC11 の起動が `wtm` にそろっておらず、証明書の置き場所の前提も書いていない（T14） / 対応: 修正済
- [nit][conv:-] docs 別のマシンへ mkcert の CA を入れるやり方（OS の信頼ストア・Firefox・iOS の証明書信頼設定・Android）が無い（T14） / 対応: 修正済
- [nit][conv:-] docs/tls-setup.md `Get-NetFirewallApplicationFilter -Program (Get-Command node).Source` が nvm-windows・volta・fnm では空になりうる（未確認）（T14） / 対応: 修正済（見つからないときの探し方を添えた）

## ラウンド 1（2026-09-19）

対象: T1〜T12 の全実装（`packages/e2e/*` の新規パッケージ一式、`docs/*.md`）と、coding 中に
実バグを発見して修正した横断ファイル（`packages/server/src/session/SessionService.ts`（D88）・
`packages/web/src/keys/KeyInputController.ts`（D89）・`packages/web/src/components/PaneLayout.vue` ほか
（D91・D92）・`packages/web/src/keys/CopyMode.ts`（D93）・`packages/web/src/term/CopyTarget.ts`（D93・D94）・
`packages/web/src/actions/ActionDispatcher.ts`（D94）と、それぞれの回帰テスト）。観点は要件適合
（AC1〜AC18・AC-I1〜AC-I5）・価値適合・正確性・規約適合（`.aidev/conventions/` が空のため全件
`[conv:-]`）・保守性。decisions.md の D88〜D94（実地の E2E で発見した実バグとその修正の記録）を前提として
読んだ上で、それらでは拾われていない指摘を洗い出した。

- [should] `.gitignore` が Playwright（`packages/e2e`）の実行結果ディレクトリ（`test-results/`・
  `playwright-report/`・`blob-report/`）を除外していなかった。放置すると、テスト実行のたびに
  ローカルに生成される成果物（スクリーンショット・トレース等）が `deliver` 時に誤ってコミットされうる
  (.gitignore) [conv:-]
- [should] `grantClipboard`（clipboard 権限付与のヘルパー。M4・`Ctrl+Shift+V`・copy モードの yank の
  検証で使う）が `scrollback-copy.spec.ts` と `reconnect-restore.spec.ts` の2ファイルに一字一句
  同じ内容で重複していた（DRY 違反。保守性） (packages/e2e/src/specs/scrollback-copy.spec.ts,
  packages/e2e/src/specs/reconnect-restore.spec.ts) [conv:-]
- [should] **decisions.md に D90 の記録が無い**のに、6 箇所以上が「decisions.md D90」を参照している
  （`tasks.md` T3 の完了メモ・`docs/verification.md`「Linux」・`packages/e2e/src/specs/terminal-app.spec.ts`
  の htop の代替・typed echo と実行後出力の取り違え・IME の `compositionend` の扱い・`tput cols` の
  読み取りの各注記）。番号が D89 → D91 へ飛んでおり、T3 の coding で D91・D92 を書いた際に D90 だけを
  書き漏らしたもの。参照先が存在しない判断記録は、後から読む人（親の統合 test・retro）が根拠を辿れない
  (.aidev/works/20260918-web-terminal-multiplexer/decisions.md) [conv:-]
  （coordinator によるディスク上の状態確認で発見。本ラウンドの自己レビューでは見落としていた——参照の
  存在確認を `grep '^## D90'` のような機械的な照合で行っていなかったため。）

上記 3 件は、coding へ差し戻して修正する（ラウンド 2 で修正を確認する）：
1. `.gitignore` に `test-results/`・`playwright-report/`・`blob-report/` を追加し、既に生成されていた
   `packages/e2e/test-results/` を削除する。
2. `grantClipboard` を `packages/e2e/src/support/keys.ts`（共有ヘルパー）へ移し、両 spec から
   import する形に統一する。
3. decisions.md の D89 と D91 の間に D90 を書き起こす（参照元の 6 箇所が言っている内容——htop の代替・
   typed echo の早期一致・IME の `compositionend`・`tput cols` の読み取り・マウス報告の自動検証の見送り・
   並列実行時の間欠的な失敗の切り分け——を、実際に下された判断として記録する）。

それ以外に確認した観点（指摘なし、または nit）:

- **(a) `packages/e2e/src/support/keys.ts` の `focusTerminal`（`.xterm-helper-textarea` の `.first()`
  クリック）が、複数 pane が同時に DOM に存在する状況で誤って別の pane を掴む不具合が無いか**
  （D86・`PaneLayout` の教訓、および本 work の T2 で一度踏んだ罠。decisions.md D89 の「教訓」参照）：
  全 spec の呼び出し箇所を洗い直した。複数 pane が存在する状態で `focusTerminal` を呼んでいるのは
  `terminal-app.spec.ts`「pane サイズ変更への追従」の1箇所だけで、これは `v`（右分割）の直後に
  **左側の p1 を意図的に掴む**ためのもの——`.terminal-pane` は DOM 順（レイアウト木の a→b）で並び、
  2 分割の左側は常に先頭なので `.first()` が p1 を指すことは保証されている（spec 自身のコメントにも
  理由と「3 分割以上では使えない」旨が明記されている）。それ以外の spec（`agent-detection.spec.ts`・
  `keys-mouse-dialogs.spec.ts`・`workspace-tab-pane.spec.ts` 等）は、分割より**前**に呼ぶか、
  分割後は明示的な再フォーカスを呼ばず `TerminalPane.vue` の `watch(view.focusedPaneId, ...)` による
  自動フォーカスに委ねる形が一貫して守られている（T2 で確立した規約どおり）。
- **(b) `wsClient.ts` の `waitForEvent`（predicate 無しでの誤った即時解決。T2 で発見した罠）が、
  T5 以降の新しい spec で再発していないか**：`agent-detection.spec.ts`・`multi-client.spec.ts`・
  `reconnect-restore.spec.ts` 等の `waitForEvent` 呼び出しを全て確認し、2 回目以降の同種イベント待ちには
  必ず `predicate` が付いていることを確認した。
- **(c) `mobile.spec.ts` の `defaultBrowserType: "chromium"` の上書き**：webkit が使える環境では
  この上書きが「実物の Safari エンジンでの検証」を妨げる可能性があるが、コメントで理由（この検証
  環境に webkit が無いため）を明記しており、意図的な簡略化として妥当——`docs/verification.md`
  「実機」の節が実際の WebKit・実機タッチの検証を別途明示的に求めているため、二重の安全網になっている。
- **(d) `performance.spec.ts` の 16 pane 生成が他の並行 spec と資源を奪い合わないか**：
  `appServer` は spec ごとに専用のポート・state dir を持つ設計（`support/appServer.ts`）のため、
  他の spec との資源競合はサーバプロセス・ポート単位では起きない。実行環境全体の CPU/メモリの
  競合（`--workers` の並列度）は、本 subtask の T3 で切り分けた間欠的な失敗パターン（このサンドボックスで
  Chromium・サーバを複数同時起動したときの資源競合。本 subtask の decisions.md D90——上記の指摘 3 で
  書き起こす）と同種で、`--workers=1` を判定基準にする運用で吸収している。
- **(e) D88〜D94 の product 側の修正が、修正対象の subtask（`01-server-core`・`03-web-desktop`）の
  既存の単体テストを壊していないか**：`pnpm -s test` の全 752 件（`packages/server`・`packages/web`
  双方）が pass することを都度確認済み（各タスクの完了メモに記録）。`WsGateway.integration.test.ts`
  の3件（D88 の影響でメッセージの受信順が変わったため、固定順で読んでいたテストを手当てした）も
  含め、回帰は無い。
- **(f) `docs/herdr-parity.md` の対応表が research.md F7 の原文と食い違っていないか**：
  分類（MVP/後続/非対応/読み替え）と AC 対応の列を、H01・H16・H31・H35・H36・H49 について
  research.md・design.md の原文と突き合わせて確認した——文言は読みやすさのために整形しているが
  （引用元の列は意図的に省略。研究の一次資料は research.md に残っている）、分類と AC の対応関係は
  一致している。
- **(g) `docs/tls-setup.md` の手順が実際に動くか**：coding 中にこの検証環境で実地に辿って確認済み
  （tasks.md T12 の完了メモ参照。非ループバックホストへの証明書なし bind の拒否・自己署名証明書の
  生成・`--host 0.0.0.0 --cert --key` での実際の起動・HTTPS 接続まで確認した）。
- AC1〜AC18・AC-I1〜AC-I5：`aidev coverage --strict` で design/tasks の対応を確認済み（gaps=0）。

## ラウンド 2（2026-09-19）

対象: ラウンド 1 の指摘 3 件への修正（coding へ差し戻し後の再実装）と、test ラウンド 2 の結果。
修正は製品コードに触れていない（`.gitignore`・`packages/e2e/src/support/keys.ts`・2 つの spec の import・
decisions.md・tasks.md・test-result.md・review.md・`docs/verification.md`）。

指摘への修正の確認：

1. **`.gitignore`**：`test-results/`・`playwright-report/`・`blob-report/` の 3 行が入っている（14〜16 行目）。
   生成済みだった `packages/e2e/test-results/` も削除済み（存在しないことを確認）。— 解消。
2. **`grantClipboard` の重複**：定義は `packages/e2e/src/support/keys.ts` の 1 箇所だけになり、
   `scrollback-copy.spec.ts`（4 箇所）・`reconnect-restore.spec.ts`（1 箇所）はどちらもそこから import して
   いる（`grep -rn grantClipboard packages/e2e/src` で定義 1・import 2 を確認）。— 解消。
3. **decisions.md の D90 の欠落**：D89 と D91 の間に D90（AC4 の E2E の検証範囲と spec の書き方の判断：
   htop→`top` の代替・typed echo の早期一致を避ける needle の置き方・IME の `compositionend` の扱い・
   `tput cols` の読み取り・マウス報告の自動検証の見送り・並列実行時の間欠的な失敗→`--workers=1` を判定基準に）
   が入った。ラウンド 1 で見落とした原因（参照の存在確認を機械的にしていなかった）を踏まえ、今回は
   `docs/`・`packages/e2e/src`・`packages/web/src`・`packages/server/src`・本 subtask のディレクトリに現れる
   D 番号 48 種を全て抽出し、decisions.md の `## Dnn` 見出しと突き合わせた——**未解決の参照は 0 件**。— 解消。

指摘 3 の修正に付随して直した箇所（同じ根＝「D90 の中身がどこにも書かれていなかった」ことから来る
食い違いのため、別の指摘には数えず指摘 3 の修正の一部として扱う）：

- ラウンド 1 の (d) が間欠的な失敗の根拠を「04-mobile の decisions.md D90」としていた誤りを、本 subtask の
  D90 に直した。あわせて (a) の記述（`terminal-app.spec.ts` の 2 分割直後の `focusTerminal` が左の p1 を
  意図的に掴むこと）を実際のコードに合わせて書き直した。
- test-result.md（ラウンド 1）の実バグの一覧に D91・D92 が抜けていたこと、間欠的な失敗の根拠の出典の誤りを
  直した。tasks.md の T3 の完了メモも「製品側の実バグ 2 件（D91・D92）＋ spec 側の判断 D90」に揃えた。
- D90 がマウス報告（AC4・M11）の自動検証を見送った以上、それを人手で埋める手順が必要なので、
  `docs/verification.md`「Linux」にマウス報告（アプリへのクリック・ホイールの到達、Shift+クリックでの選択）の
  確認項目を追加した。

test ラウンド 2 の確認：

- typecheck・lint（0 件）・vitest 752 passed / 0 failed・`aidev coverage --strict` gaps=0・smoke pass。
- E2E は最終的な直列実行（`--workers=1`）で 28 passed / 0 failed。**ただしそれまでの 3 回の実行で、
  毎回違う spec が 1 件ずつ、ブラウザの WebSocket の切断（「再接続中…」）によって失敗した**
  （test-result.md ラウンド 2「失敗の証跡」「切り分け」）。原因は未確定で、test-result.md も
  「環境の資源競合による」とは断定していない。
- この事象を**本 subtask の指摘にはしなかった**理由：(1) 本ラウンドの修正は製品コードに触れておらず、
  同種の事象はラウンド 1 の T4 の時点でも観測されている——本 subtask が持ち込んだものではない。
  (2) 製品側の欠陥だとしても、箇所（WebSocket の接続管理は `01-server-core`・`03-web-desktop` の担当範囲）も
  原因も特定できておらず、`(path)` を持つ指摘として書けない。(3) E2E の spec 側で握りつぶす（リトライを
  足す等）のは、統合 test で再現させて close コードを採るべき事象を隠すことになるため、あえて何もしない。
  → 親の統合 test へ、観測の仕方（サーバの `conn.onClose` とブラウザの `onclose` の `ev.code` の両方を記録）
  とともに引き継ぐ（test-result.md ラウンド 2「未検証の穴」）。
- あわせて、切断中の入力を捨てる現在の設計（`net/Connection.ts` の `sendInput`）が、利用者には「打った文字の
  先頭が欠ける」形で見えることを実地で確認した（`ho: コマンドが見つかりません`）。design どおりの挙動なので
  本 subtask の指摘ではないが、再接続までの入力をバッファすべきかは親の統合 review の判断事項として引き継ぐ。

新たな指摘：なし。ラウンド 1 の 3 件（すべて `[should]`）が全て解消したことを確認した。
通算：must 0・should 3・nit 0。

## ラウンド 3（2026-09-19・T13／T14（D104）。親の統合 test ラウンド4 からの差し戻し）

見たもの：`aidev coverage`（gaps=0）・要件適合（AC17 の性能計測が単独で走る・AC11／AC16 の docs が 01 の D100〜D103 後のサーバの
挙動と一致）・価値適合（利用者が既定のコマンドで E2E を流して通る・実機の確認で docs の手順を順に辿れる——AC11 の Linux の
手順は一時の HOME でそのまま実行済み）・正確さ（タスク点検の 9 件を反映済み。直した spec は負の対照で「直す前の形は落ちる」
ことを確認）。

指摘なし。

件数（ラウンド1〜3 の通算。タスク点検ログは数えない）：must 0・should 3・nit 0。
- [should][conv:-] docs 実機の手順の正確さ（T15。独立点検で 9 件）：AC17 の状態反映の定義（spec はサーバの通知までの 2 秒で、サイドバーではない）・LAN の計測（近似であること・ping の max・Windows の ICMP）・16 pane の作り方（焦点が新しい pane へ移るので潰れる）・`--scrollback` の確認でページの開き直しが抜け・再起動で前の画面は戻らない・任意の手順が AC11 の wtm と state-dir／ポートで衝突・AC12 を 3 環境で行うことの曖昧さ・ピンチが `touch-action: pan-x` で空振りしうる・1 列のレイアウトの手順に期待が無い / 対応: 修正済
- [nit][conv:-] docs 実機の手順の細部（T15。独立点検で 9 件）：手がかりが出るまでの秒数・copy モードの ctrl+b・herdr-parity の参照先・PowerShell の関数の範囲・429 の条件・fit を手放したときの権限の移り方・`--headed` と画面・拒否のログの間引き・PowerShell の Ctrl+B / 対応: 修正済

## ラウンド 4（2026-09-20・T15（D109）。統合 review ラウンド1 からの差し戻し）

見たもの：統合 review ラウンド1 の 05 の範囲（should の手順の不足・nit の既知の制約）が解消したか——親の test-result.md ラウンド6 の
「未検証の穴」の各項目に手順と期待する結果がある（copy モードの一部の移動キーは実装していないと明記）。価値適合：利用者が実機で
docs を順に辿れる（独立点検で 18 件の正確さの穴を直し、このマシンで動く手順は実際に辿った）。

指摘なし。

件数（ラウンド1〜4 の通算。タスク点検ログは数えない）：must 0・should 3・nit 0。

## ラウンド 5（2026-09-20・T16。親の統合 test ラウンド7 からの差し戻し）

見たもの：原因（SNAPSHOT を出力として数えない）と修正の一致・決定的な再現が直した後に通ること・`rawOutput` の否定の確認への影響。

指摘なし。

件数（ラウンド1〜5 の通算。タスク点検ログは数えない）：must 0・should 3・nit 0。
