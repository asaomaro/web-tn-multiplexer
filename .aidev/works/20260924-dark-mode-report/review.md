# レビュー: 明暗の変化を端末の中のアプリへ知らせる（DSR 996/mode 2031）

## タスク点検ログ

T1〜T5・cross のいずれも taskcheck findings=0（指摘なし）。この節に記録する内容は無い
（正常な状態。`aidev-40-coding` 完了の目安どおり）。

## レビュー ラウンド1

- [must][conv:-] `Mirror.ts` の新規 CSI ハンドラ（`handleAppearanceQuery`:222-229・
  `handleMode2031`:231-241。登録: 110-112）が `params[0]` しか見ず、対象 `Ps`（996/2031）と
  一致すれば無条件に `true` を返して連鎖を止める実装になっている。xterm-headless の CSI
  ハンドラは1つの CSI シーケンスに複数の `Pm` を束ねて送れる仕様（`CSI ?Pm1;Pm2 h` 等）で、
  登録は LIFO（後から登録したハンドラが先に呼ばれ、`true` を返すとそこで連鎖が止まる）——
  実際に `@xterm/headless` のバンドル実装（`xterm-headless.js` の `setModePrivate`/
  `resetModePrivate`）を確認すると、複数の `Pm` を全て走査する作りになっている。
  この組み合わせにより、**`?2031` を他のモード（例: 1049＝オルタネートスクリーン）と同じ CSI に
  束ねて送ると、束ねられた他のモードが黙って無効化される**（`\x1b[?2031;1049h` を書き込む再現
  テストで実証: 単独の `\x1b[?1049h` では `buffer.active.type` が `"alternate"` になるのに、
  `2031` と束ねると `"alternate"` にならず 1049 が無視される）。逆順（`\x1b[?25;2031h`）では
  `handleMode2031` が `params[0]!==2031` で `false` を返して委譲するため他のモードは正しく
  適用されるが、**2031 自体が一切認識されず `mode2031Enabled` が false のまま**になることも
  実証済み。requirements.md の非機能要件「既存の pane の出力・入力の経路に、通知の追加以外の
  副作用を与えない」に反する実際のバグで、AC2/AC3 が黙って成立しなくなるケースも作る。
  同リポジトリ内の `handlePaletteQuery`（OSC 4。Mirror.ts:202-220）は `data.split(";")` で
  複数の問い合わせを全部処理しており、「束ねられたら全部見る」という前例が既にあるにも
  関わらず、今回の新規ハンドラだけがそれを踏襲していない。 / 対応: `handleMode2031`/
  `handleAppearanceQuery` を、`params` 全体を走査して対象 `Ps`（996/2031）の有無・値を
  判定する形に修正し、**常に `false` を返して委譲する**（xterm 内蔵の
  `setModePrivate`/`resetModePrivate` は未知のモード番号を無条件で無視するだけなので、
  2031/996 が他のモードと混ざっていても実害は無い。`true` を返して連鎖を止めているのが
  問題の本質）。負の確認: 修正前のコード（`params[0]` のみ判定・`true` で連鎖停止）に戻すと
  再現テストが実際に失敗することを確認し、修正後に pass することを確認する。
- [should][conv:-] `.aidev/conventions/regression-negative-control.md` は、負の確認で
  落ちたときの**生の出力**を記録に貼ることを求めているが、decisions.md D1・test-result.md の
  いずれも要約文のみで、実際の vitest 失敗出力（スタックトレース等）を貼っていない。
  この round の must 修正で改めて負の確認を行う際は、生の失敗出力を test-result.md に残す。
- [should][conv:-] push トリガーを `client.theme` RPC だけに絞った設計判断（design.md
  「設計方針」）は、requirements.md の AC2 の文言上は成立するが、`Tab.sizeOwnerClientId`/
  `ClientRecord.view` の変化で「その pane の実効的な明暗の答え」自体が変わるケース
  （権限者の交代・別クライアントが同じ tab を見始める等）は、次に誰かが `client.theme` を
  送るまで通知が飛ばない。design はこれを認識済みで「AC1 のオンデマンド問い合わせは常に
  最新なので正確性は失われない」としており、範囲を広げるほどの重みは無いと判断し**対応は
  見送る**（design の判断を追認）——ただし実利用上、mode 2031 を要求するアプリは push だけを
  頼る前提であることとの食い違いが残存ギャップとして残ることは記録しておく。
- [nit][conv:-] Mirror.ts:107-109 付近のコメント「`Ps` が対象以外なら `false` を返して
  委譲する」は、上記の複数パラメータのケースを想定していない表現になっている。must の修正と
  合わせてコメントも直す。
- [nit][conv:-] CSI ハンドラの LIFO 実行順・「`false` で委譲、`true` で連鎖停止」という
  xterm-headless 側の非自明な挙動は、今回コードを読むだけでは気づけず、バンドル実装を直接
  読んで初めて判明した。must の修正箇所に、次に同じ場所へ CSI ハンドラを足す人が同じ罠を
  踏まないよう、この挙動を明示するコメントを残す。

以下、問題なし:
- 要件適合（上記 must/should を除く範囲）: AC1・AC4・AC5・AC6 は満たされている。
- 正確性・AC4（リーク無し）: `TerminalManager`/`TerminalHost`/`XtermMirror` の dispose 経路を
  確認。新規状態はインスタンスフィールドのみで専用の後始末は不要という design の主張どおり。
- 正確性・race condition: `client.theme` ハンドラ・`notifyAppearanceMayHaveChanged` は同期処理
  のみで、この work 固有の新規レースは見つからなかった。
- 規約適合（e2e-observe-browser.md）: 対象外（diff に `packages/e2e` の変更なし）。
- 規約適合（既存コーディングスタイルとの一貫性）: 高い。
- 保守性: design.md と実装（decisions.md D1 反映後）に乖離なし。`resolveThemeFor` の切り出しは
  DRY として良い設計。テストの意図も読みやすい。

walkthrough.md: 複数モジュール横断（answerPalette.ts → Mirror.ts → TerminalHost/
TerminalManager → composeServer.ts → client.ts）かつ、今回の must がまさにその複雑な制御
フロー（CSI ハンドラの LIFO・委譲）に起因して発生したため、作成する（CSI ハンドラの
LIFO・委譲の仕組みを明示し、同種の見落としの再発を防ぐ）。

## レビュー ラウンド2

round1 の must 1件・should 2件・nit 2件への対応を確認した。

- must（複数 Pm 束ねで他モードを無効化する）: `handleAppearanceQuery`/`handleMode2031`
  （Mirror.ts:226-253）を `params.includes(996|2031)` で判定し、マッチの有無に関わらず常に
  `false` を返す形に修正（decisions.md D2）。登録箇所のコメント（Mirror.ts:107-114）も
  修正済み。負の確認: 修正前のコード（`params[0]` のみ判定・`true` で連鎖停止）に戻すと、
  新規テスト2件（`Mirror.test.ts`「他のモードと同じ CSI に束ねられても…」
  「他のモードの後ろに束ねられても…」）が実際に失敗することを確認し（生ログは decisions.md
  D2 参照）、修正を戻すと pass することも確認済み。diff を再読し、意図どおりの修正であることを
  確認。
- should（負の確認の生ログ未記録）: decisions.md D2 に上記の生ログを追記済み。対応済み。
- should（push トリガー範囲の残存ギャップ）: round1 の判断（対応見送り・design の判断を追認）
  どおり。今回の修正では変更なし。
- nit 2件（コメントの不正確さ・LIFO/委譲の非自明さの明記）: must の修正コミットに含めて
  対応済み（Mirror.ts:107-114・226-253 のコメントで両方カバー）。

新たな指摘なし。coding → test の再実行（796→server・2937→root、いずれも 0 failed）も確認した。
