# 決定記録

## D1: `CSI ? 2031 h`（有効化）の時点で `lastReportedAppearance` を基準値として捕捉する
   （design のコード例には無かった、coding 中に自分のテストで発見した抜け）

- 背景: design.md のコード例（`handleMode2031`）は `mode2031Enabled` を切り替えるだけで、
  `lastReportedAppearance`（「変わったか」の基準点）には触れていなかった。実装をそのまま
  書いたところ、「`CSI ? 2031 h` の直後は、appearance が変わっていなければ通知しない」テスト
  （design「振る舞いの詳細」手順3・herdr の実際の挙動に合わせた仕様）が**実際に失敗した**。
  原因: コンストラクタでは `lastReportedAppearance` が `null` のままで、事前に
  `CSI ? 996 n` の問い合わせが一度も無い状態で `notifyAppearanceMayHaveChanged` を呼ぶと、
  「現在値（例: dark）」と「基準点（null）」が一致せず「変わった」と誤検知し、有効化した
  だけで通知が出てしまっていた。
- 決定: `handleMode2031` が `enable === true` を処理するとき、`lastReportedAppearance =
  this.appearance()` で現在値を基準として捕捉する（通知（`emitResponse`）はしない——
  あくまで基準点の初期化だけ）。
- 理由 / 代替案: 「コンストラクタで `appearance()` を呼んで初期値を入れる」代替案も考えたが、
  `appearance()` は「答える瞬間に呼ぶ」という既存の `palette` と同じ設計方針（design「依拠する
  既存の事実」）に反する——mode 2031 が一度も有効化されない pane で無駄に呼ぶことになる。
  「有効化された、まさにそのタイミングで」基準点を取るのが最小の変更で目的に合う。
- 影響: `packages/server/src/terminal/Mirror.ts` の `handleMode2031` のみ。design.md の
  該当コード例と実装が食い違うため、design.md を修正した（該当箇所にコメントで理由を追記）。
  test 工程・review でこの分岐（有効化直後に変化していなければ通知しない）が引き続き正しく
  検証されることを確認する。

## D2: `handleAppearanceQuery`/`handleMode2031` を、`params` 全体を走査し常に `false`
   を返す形に修正する（review round1 must への対応）

- 背景: review round1 で、両ハンドラが `params[0]` しか見ず、一致すれば無条件に `true` を
  返して CSI ハンドラの連鎖（xterm-headless は LIFO・`true` で連鎖停止）を止めてしまう
  ことが指摘された。`CSI ?2031;1049h` のように他のモードと束ねて送られると、束ねられた
  側（例: 1049＝オルタネートスクリーン）が黙って無効化される。逆順（`CSI ?25;2031h`）では
  `params[0]` 判定に一致せず `false` を返して委譲するため、2031 自体が一切認識されない。
  再現テストで両方向とも実際に壊れることを確認した（review round1 詳細参照）。
- 決定: 両ハンドラを `params.includes(996|2031)` で判定する形に変更し、**常に `false` を
  返して委譲する**（マッチしても・しなくても）。副作用（応答の送出・`mode2031Enabled` の
  更新）は判定がマッチしたときだけ行う。
- 理由 / 代替案: xterm 内蔵の `setModePrivate`/`resetModePrivate` は未知のモード番号を
  無条件で無視するだけなので、`false` を返して常に委譲しても 996/2031 自身の処理が失われる
  ことはない。「`true` を返して連鎖を止める」という判断そのものが不要だった——既存の
  `handlePaletteQuery`（OSC 4）が `data.split(";")` で複数の問い合わせを全部処理する前例に
  倣う形。
- 影響: `packages/server/src/terminal/Mirror.ts` の `handleAppearanceQuery`/`handleMode2031`
  とその登録箇所のコメント。design.md の該当コード例・「エラー処理」節を修正した。
  負の確認: 修正前のコード（`params[0]` のみ判定・`true` で連鎖停止）に戻して新規テスト2件が
  実際に失敗することを確認済み（下記「失敗の生ログ」）。修正を戻して pass することも確認済み。

### 失敗の生ログ（負の確認。regression-negative-control.md 準拠）

```
 FAIL  src/terminal/Mirror.test.ts > XtermMirror — appearance report (CSI ?996n / mode 2031) > CSI ?2031h が他のモードと同じ CSI に束ねられても、束ねられた側（1049＝オルタネートスクリーン）を無効化しない（review round1 must）
AssertionError: expected 'main-buffer-marker' not to contain 'main-buffer-marker'
 ❯ src/terminal/Mirror.test.ts:253:49
    251|     await writeAndWait(mirror, "\x1b[?2031;1049h");
    252|     // 1049 が適用されていれば、画面はオルタネートバッファ（空）に切り替わっているはず。
    253|     expect(mirror.bottomLines(24).join("")).not.toContain("main-buffer…
       |                                                 ^

 FAIL  src/terminal/Mirror.test.ts > XtermMirror — appearance report (CSI ?996n / mode 2031) > CSI ?2031h が他のモードの後ろに束ねられても、2031 自体が無視されない（review round1 must）
AssertionError: expected '' to be '\u001b[?997;2n' // Object.is equality

- Expected
+ Received

- [?997;2n

 ❯ src/terminal/Mirror.test.ts:275:32
    273|     appearance = "light";
    274|     mirror.notifyAppearanceMayHaveChanged();
    275|     expect(responses.join("")).toBe("\x1b[?997;2n"); // 2031 が認識されていれば…
       |                                ^

 Test Files  1 failed (1)
      Tests  2 failed | 21 skipped (23)
```
