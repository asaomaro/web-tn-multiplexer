# 決定記録

## D1: research 工程は `aidev doccheck` の対象外——自己点検で代替し、ここに記録する

- 背景: `aidev doccheck` は上流4工程（requirements design architecture tasks）だけが対象で、
  research は含まれない（20260922-tabbar-pane-appearance・20260922-keybinding-presets で既出の
  同じ制約）。
- 決定: research.md は独立点検の委譲をせず、書いた本人が主要な `file:line` 引用を実際に
  `sed -n` で当たり直す形の自己点検で代替する。今回は F2（`KeySettings.vue:35-38`）・F5
  （`assign.ts:111-177,166-172`）・F7（`KeySettings.vue:123-146`）・F10（`MouseBridge.ts:53`）・
  F12（`chord.ts:388-415`）・F16（`ThemeController.ts`・`main.ts:159-172`）を当たり直し、記述と
  実物が一致することを確認した。
- 理由 / 代替案: CLI の対象外である以上、無理に doccheck を通そうとしても進まない。点検を省くと
  design が誤った引用を無検証で引き継ぐリスクがあるため、自己点検で代替した。
- 影響: design 工程は research.md の引用を再検証済みの前提で読める。

## D2: `AssignResult` に衝突相手の構造化情報を足す設計判断は design で行う

- 背景: research F5 で、衝突判定（`validateBinding`）が現状「文字列の理由」しか返しておらず、
  「こちらへ移す」を機械的に実装するには衝突相手（owner の id・via・chord）を構造化して返す
  必要があることが分かった。この変更は `AssignResult` という既存の公開型を拡張するもので、
  既存の呼び出し元（`KeySettings.vue`・`assign.test.ts`）に影響しうる。
- 決定: 具体的な型・フィールド名・後方互換性の設計は design 工程で確定する（この時点では
  「構造化フィールドが要る」という事実だけを research に残す）。
- 理由 / 代替案: research は「どう作るか」を決める工程ではないため、設計判断は design に委ねる。
- 影響: design.md の「インターフェース / データ構造」節で `AssignResult` の変更を明示する。

## D3: macOS の Option chord 表示補正（US3）は節「キー」の一覧表示だけに限る

- 背景: research F13 で、chord の表示はキー一覧（ヘルプ）・トースト・通知の案内文・モバイルの
  Prefix ボタンなど複数箇所にあることが分かったが、それらの文言生成コードは未確認のまま
  requirements の対象範囲が確定していた（backlog の文言「Option の chord の表示」は範囲を
  明示していない）。
- 決定: この work では節「キー」の一覧表示（`bindingsText`/`summaryText`）だけを対象にする。
  ヘルプ・トースト・通知・モバイルの Prefix ボタンの表示補正は対象外とする。
- 理由 / 代替案: 全箇所を対象にする案も検討したが、各箇所の文言生成コードを新たに調査する
  ボリュームが this work の他の 3 機能と釣り合わず、範囲を広げるほど実機検証（Chromium・macOS・
  非 US 配列が要る）の負荷も増す。節「キー」は利用者が実際に割り当てを確認・変更する主戦場であり、
  最も価値の高い箇所に絞ることで、確実に検証できる形で着地させる。
- 影響: `requirements.md` のスコープには反映しない（requirements は「対象」を「節「キー」の一覧」
  と明記済みではないが、AC8〜AC10 の検証は節「キー」の範囲で行う。他箇所は将来の別 work の
  候補として `docs/herdr-parity.md`／backlog に残す）。

## D4: `keyboardLockInFullscreen` に専用の `storage` イベント追従は足さない（design の引用の訂正）

- 背景: design.md「依拠する既存の事実」は、`statusSymbols` パターンの一部として
  `settings.ts:186-193` の `storage` イベント追従を引用していたが、T3 の実装中に読み直すと、
  その箇所は `keyPrefs`（`keys`）専用のリスナーで、`statusSymbols` 自体には無いことが分かった
  （`writePrefs` は他の単純な設定は差分マージするので、`keys` のような「丸ごと 1 つの値」を持つ
  設定だけがこの特別な手当てを要る）。design の引用が誤っていた。
- 決定: `keyboardLockInFullscreen` も `statusSymbols` と同じ「単純な boolean」なので、専用の
  `storage` リスナーは足さない（別ウィンドウでの変更はページの再読み込みで拾う、という既存の
  暗黙の仕様に倣う）。
- 理由 / 代替案: 独自にリスナーを足す案もあったが、既存の大多数の単純設定と扱いを変える理由が
  無く、範囲を広げるだけになる。
- 影響: design.md の該当箇所を訂正した。`store/settings.test.ts` の新規テストは
  cross-window 追従を検証しない（`statusSymbols` の既存テストと同じ範囲に揃える）。

## D5: Keyboard Lock の switch は既存の `.settings-switch`（button + role="switch"）の形に揃える

- 背景: design.md は当初 `<input type="checkbox" role="switch">`（ネイティブのチェックボックス）を
  コード例にしていたが、T7 の実装中に `SettingsDialog.vue` を確認すると、この PJ の既存の switch
  （`statusSymbols`・`themeAuto` 等）はすべて `<button type="button" role="switch"
  :aria-checked="...">` ＋ `.settings-mark`（「入」「切」の表示）という独自の見た目で統一されて
  いた（ネイティブのチェックボックスは使われていない）。
- 決定: `KeySettings.vue` の Keyboard Lock の switch も、この既存の `.settings-switch` パターンに
  揃える。`scoped` CSS は親（`SettingsDialog.vue`）から子へ効かないため、`.settings-switch`/
  `.settings-mark` を `KeySettings.vue` 側にも再現する（`KeySettings.vue` 冒頭の注記が
  `.settings-heading`/`.settings-note` について述べているのと同じ理由・同じやり方）。
- 理由 / 代替案: ネイティブのチェックボックスのままにする案もあったが、同じダイアログの中で
  switch の見た目が 1 つだけ違う一貫性の無さを避けた。実験的機能という性質上は本質的な違いでは
  ないが、既存の UI 語彙を優先した。
- 影響: design.md の「US4」節のコード例・テンプレートを実装に合わせて訂正した。

## D6: この E2E 環境には実は `navigator.keyboard`（Keyboard Lock API）がある——tasks.md T8 の
  想定（「見込みが高く…持たない」）を訂正する

- 背景: tasks.md の T8 は「この E2E 環境（Linux headless Chromium）は `navigator.keyboard.lock`/
  `getLayoutMap` を持たない見込みが高い」という前提で書かれていた（design/tasks 時点では未検証の
  推測）。T8 の着手時に、実際の `appServer` 経由のページ（`http://127.0.0.1:<port>`）で
  `page.evaluate` により確かめたところ、**`isSecureContext: true`（127.0.0.1 は potentially
  trustworthy origin）・`navigator.keyboard` が存在し、`lock`/`getLayoutMap` とも関数として
  使える**ことが分かった。さらに `document.documentElement.requestFullscreen()` も
  `page.evaluate` から（実物のクリックすら介さずに）解決し、`fullscreenElement` が非 null に
  なり、そのうえで `navigator.keyboard.lock()` も実際に resolve することを確認した（この Chromium
  はヘッドレスでも fullscreen とその配下の権限を無条件で許すビルドらしい）。
- 決定:
  - AC9（`getLayoutMap()` が使えない条件の 1 つ＝「非 macOS」）の E2E 確認は、
    `isMacPlatform()` が Linux では false になることに依拠する（`getLayoutMap` 自体の有無とは
    無関係に、mac 分岐そのものに入らないので表示は今までどおりになる）——この理由なら
    実際の API の有無によらず成立するので、そのまま AC9 の確認として使う。
  - AC14（`navigator.keyboard.lock` が「存在しない」場合の分岐）は、この環境では自然には
    踏めない（実際に存在するため）。**`page.addInitScript` で `navigator.keyboard` を
    `Object.defineProperty(navigator, "keyboard", { value: undefined, configurable: true })` に
    差し替え、`main.ts` の `navigator.keyboard ?? null` の配線ごと「無い」を実地で再現する**
    （`"keyboard" in navigator` は真のままだが `.keyboard` 自体は `undefined` になるので、
    アプリのコード（`?? null` で読む）には効く。`notifications.spec.ts` の `Notification`/
    `AudioContext` の差し替えと同じ手法。probe で `pageerror` が 0 件・`.keyboard === undefined`
    を確認済み）。
  - AC12・AC13（実際に効く経路＝全画面での `lock()`／抜けた後の `unlock()`）は、この環境で
    `lock()` 自体は resolve することを確認したが、「OS・ブラウザの予約キーが実際にページへ
    届くようになったか」はブラウザの外側（OS/ブラウザ本体の処理)の効果であり、Playwright から
    観測する手立てが無い（`e2e-observe-browser.md` が言う「代わりに観測したもの」を作れない）。
    **この核心部分は D3 と同じ理由で、この work では `docs/verification.md` の手動確認へ回す
    （変更しない）**。ただし「呼ばれたか」自体（`lock`/`unlock` の呼び出しそのもの）は
    T4（`KeyboardLockController.test.ts`）が偽物の `keyboard`/`doc` で既に検証済み
    （AC12・AC13 は T4 の `AC:` に属し、T8 の `AC:` には含まれていない。tasks.md の記載どおり）。
  - T8(c) の「全画面でなければ既存のキー操作が壊れない」確認は、**実際に API がある状態のまま**
    （偽装しない）で、`navigator.keyboard.lock`/`unlock` を `addInitScript` でラップして呼び出しを
    記録し、switch を有効にしても `lock` が一度も呼ばれないこと（全画面に入っていないので）を
    直接確認する形にする（AC-I12）。
- 理由 / 代替案: 誤った前提のまま「たぶん無い」で書いた確認は、たまたまこの環境で真になった
  だけの記述で、他の環境（実際に API を持たない CI・ブラウザ）に一般化できない。実地で確かめた
  事実に基づいて書き直すことで、E2E が実際に検証している内容とコメントが一致する
  （`e2e-observe-browser.md` の「何を代わりに観測したか」を書く趣旨にも合う）。
- 影響: `packages/e2e/src/specs/key-bindings.spec.ts` の T8(c) 相当のテストは、上記のとおり
  「API を消して存在しない場合（AC14）」と「API はあるが全画面でない場合（AC9・AC-I12）」の
  2 本に分けて書く。`docs/verification.md` の手動確認項目には、AC12・AC13 に加えて「実際に
  ブラウザ・OS の予約キーが解放されるか」を明記する（deliver 時に追記）。

## D7: 「こちらへ移す」ボタンを `.keys-message` と同じ sticky コンテナへまとめる（review の must 指摘）

- 背景: review 工程で差分全体を読み直した際、「こちらへ移す」ボタン（`data-move-here`）が
  `.keys-message`（画面下へ `position: sticky` で固定される案内文）のすぐ後ろに置かれているが、
  ボタン自身は sticky ではない普通の要素として `.keys-message` の「固定されていない本来の位置」の
  直後に続くことに気づいた。実測（`boundingBox()`）したところ、節「キー」の一覧を少しスクロール
  しただけで、案内の帯は画面下端に見えているのに、ボタンはダイアログの可視領域のかなり外
  （高さ 704px の可視領域に対し y 座標 1880px 前後）に取り残されていた。`toBeVisible()`（CSS の
  可視性だけを見る）や `.click()`（自動スクロールする）・Tab 到達のテストはこの種の不具合を
  検出できない——実測でしか見つからない類の欠陥だった。AC4・AC-I6 の文言（「案内文の直後に現れる」）
  は字面のうえでは満たしていたが、この work の目的そのもの（衝突をその場で解決する）を裏切る
  実質的な defect と判断した。
- 決定: `.keys-message` と「こちらへ移す」ボタンを `<div class="keys-status-band">` でまとめ、
  `position: sticky` をこの帯自身へ移す。両方が常に一緒に画面内へ来るようにする。既存の
  WCAG テスト（`key-bindings.spec.ts`「下に固定した結果の文は…隠さない」）は `.keys-status-band`
  の boundingBox を測るよう直し、新規に「ボタンが追加のスクロール無しでダイアログの可視領域内に
  収まる」ことを実測するテストを足した（review.md ラウンド1参照）。
- 理由 / 代替案: ボタン単体に別途 `position: sticky` を与えて隙間なく積む案も検討したが、
  メッセージの行数（折り返し）で高さが変わるため、固定のオフセットでは隙間・重なりが生じうる。
  共通の sticky コンテナへまとめる方が、内部の並びは通常のフローに任せられて壊れにくい。
- 影響: `packages/web/src/components/KeySettings.vue`・`packages/e2e/src/specs/key-bindings.spec.ts`
  を修正。unit テスト（1505件）・E2E（`key-bindings.spec.ts` 20件）は全部通ることを確認済み。
