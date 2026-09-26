# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [nit][conv:-] packages/web/src/store/onboarding.ts:28 `wtm.prefs.v1` が `{}` の既存の利用者（キーを既定に戻すと `keys` が落ちて `{}` が残る）を初めての利用者と誤る / 対応: 修正済（T1・ラウンド1。`wtm.prefs.v1` は中身を見ず、あれば痕跡。decisions D8）
- [nit][conv:-] packages/web/src/components/Toast.vue:14 定数の別名を 1 段挟んでいた / 対応: 修正済（T1・ラウンド1。`PREFIX_HELP_HINT_KEY` を直接使う）
- [nit][conv:-] packages/web/src/App.test.ts（末尾のはじめの案内のテスト） attachTo で置いたのに unmount しない（同じファイルの先例と揃わない） / 対応: 修正済（T2・ラウンド1）
- [nit][conv:-] packages/web/src/components/OnboardingDialog.vue（テーマの select） 「OS の明暗に合わせる」が入っている間、select は `settings.theme` を出すだけで注記が無く、同じテーマを選び直して確定しても `setTheme` が呼ばれず合わせたままになる / 対応: 修正済（T3・ラウンド1。注記と aria-describedby を足し、合わせている間は触ったら確定で `setTheme`）
- [should][conv:regression-negative-control] packages/web/src/components/OnboardingDialog.vue（マウスの操作の行） 行を消してもテストが通る（負の確認の網の外） / 対応: 修正済（T4・ラウンド1。`data-onboarding-mouse` とテストを足し、変異で検知を確認）
- [nit][conv:-] packages/web/src/components/OnboardingDialog.vue（`helpHow`/`settingsHow`） 割り当てが無いときの「サイドバーの［メニュー］」は、サイドバーを畳んでいると画面に無い / 対応: 許容（help と settings の両方の割り当てを外し、かつサイドバーを畳んでいる組み合わせに限られる。畳みは既存の操作〔`prefix+b` 等〕で戻せる）
- [nit][conv:-] packages/web/src/components/OnboardingDialog.test.ts（モバイルのテスト） 名前はスキップも確かめると言うが中身は確定だけ / 対応: 修正済（T4・ラウンド1。名前を直し、スキップのテストを足した）
- [should][conv:-] packages/web/src/components/SettingsDialog.vue（［はじめの案内を開く］） `cancel()` を通らずに設定画面を閉じるので、打ちかけの「指定した場所」を確定しない（ほかの閉じる経路と方針が違う） / 対応: 修正済（T5・ラウンド1。`openOnboarding` で `commitNewCwdPath` を先に呼び、テストと変異で確認）
- [nit][conv:-] packages/web/src/components/SettingsDialog.vue（同ボタン） ［閉じる］専用のクラス `settings-close` を流用していた / 対応: 修正済（T5・ラウンド1。`settings-reopen-button` を分けた）
- [nit][conv:-] docs/herdr-parity.md:51・docs/verification.md（はじめの案内の説明） モバイルで隠れるのはキーの説明だけでなくマウスの説明も / 対応: 修正済（T6・ラウンド1）
- [nit][conv:-] docs/herdr-parity.md:51・docs/verification.md 確定したときだけ OS 通知の問いかけを出さなくなることが書かれていない / 対応: 修正済（T6・ラウンド1）
- [nit][conv:-] docs/herdr-parity.md:51 AC の欄の work ID が日付なしの略称・区切りが「, 」 / 対応: 修正済（T6・ラウンド1）
- [should][conv:-] packages/web/src/components/OnboardingDialog.vue（説明の出し分け） 画面の配置（`isMobileViewport`・幅 768px 未満）と違う判定（`DeviceKindKey`＝指の操作）で「サイドバー／上のバー」を出し分け、狭いデスクトップの窓・幅の広いタブレットで画面に無い部品を案内する / 対応: 修正済（cross・ラウンド1。説明は画面幅、プリセットは指の操作で出し分ける。decisions D9）
- [nit][conv:-] packages/web/src/components/Toast.vue（キー一覧の案内のトースト） 初めての利用者では、はじめの案内の裏で出て使い切られる / 対応: 許容（はじめの案内がデスクトップでは同じキー一覧のキーを載せており情報は失われない。Toast に案内の状態を読ませると既存の Toast のテストの前提〔痕跡の無い localStorage で案内が出る〕も変わるので、この work では手を入れない。decisions D10）
- [should][conv:regression-negative-control] packages/server/src/smoke.ts:185-192 起動確認の「Esc で閉じると端末へフォーカスが戻る」判定を落とす負の確認が無かった（記録の変異は案内が開く前に落ちていた） / 対応: 修正済（T7・ラウンド1。閉じたあと blur する変異で、この判定が落ちることを確かめた）
- [nit][conv:-] packages/web/src/App.test.ts（はじめの案内の 2 本） `navigator.webdriver` の差し替えを it の末尾でしか戻さず、失敗すると後続へ漏れる / 対応: 修正済（T7・ラウンド1。describe の afterEach で戻す）
- [nit][conv:-] docs/verification.md（はじめの案内の手順） 「自動のテストでは確かめていない」が、起動確認で Esc の経路を確かめるようになったのと食い違う / 対応: 修正済（T7・ラウンド1）

- [nit][conv:-] packages/web/src/components/SettingsDialog.vue:105-124 同じ形の不具合（開いたまま 4401 → 戻ると showModal されずキーを食う）が設定画面など既存のダイアログに残る（HEAD から） （T8 のタスク点検） / 対応: backlog へ（product-roadmap.md の末尾。この work の範囲外の以前からある欠陥）
## ラウンド 1（2026-09-26T10:23:51Z）
- [should][conv:-] packages/web/src/components/OnboardingDialog.test.ts:623-626 it の中の `await import("./SettingsDialog.vue")` の初回の変換が既定 5 秒に入り、2 ファイルを一緒に流すと時間切れで落ちる（レビュアーの実行で 3 回中 2 回） / 対応: 差し戻し
- [should][conv:-] packages/web/src/components/OnboardingDialog.vue:142-159 案内が開いている間にログイン画面へ切り替わる（4401）と、戻ったあと `dialogContext` が "onboarding" のまま `showModal()` されず、KeyRouter が dialog モードのまま全キーを食う / 対応: 差し戻し
- [nit][conv:-] packages/web/src/components/OnboardingDialog.vue:88-106 テーマの選択肢の作り・OS 通知の注記の文言を SettingsDialog から写している / 対応: 許容（どちらも数行で、設定画面は「押した時点で効く」、案内は下書きで扱いが違う。共有にすると設定画面〔HEAD で prettier 未整形の 1200 行〕に手を入れる範囲が広がる）
- [nit][conv:-] packages/web/src/components/OnboardingDialog.vue:204-210 許可の問いかけを閉じただけ（default）でも「サイトの設定で許可したあと」と案内する / 対応: 差し戻し（default と denied で文を分ける）
- [nit][conv:e2e-observe-browser] packages/server/src/smoke.ts（再読み込み後に案内が出ないことの確認） タイトルの変化のあと固定の 500ms だけが根拠 / 対応: 差し戻し（端末の textarea にフォーカスが入るのを待ってから数える）

## ラウンド 2（2026-09-26T10:56:55Z）
指摘なし（ラウンド 1 の should 2 件・差し戻した nit 2 件の解消を確認し、このラウンドの差分〔`OnboardingDialog.vue`・`OnboardingDialog.test.ts`・`smoke.ts`〕に must/should は無かった）。

レビュー補助（walkthrough.md）: 書かない——差分の多くはテストで、責務や依存の向きは動かしていない（既存のダイアログの形に 1 つ足しただけ）。起動時の開く時機と自動操作の扱いは decisions D6・D11 に書いてある。
