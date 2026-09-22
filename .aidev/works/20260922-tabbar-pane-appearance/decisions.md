# 決定記録

## D1: requirements の独立点検（doccheck）はラウンド上限（2）で打ち切り、直して次工程へ進む

- 背景: `aidev doccheck` の `maxDocCheckRounds`（既定 2）に従い、requirements.md の内部一貫性点検を 2 ラウンド実施した。
  ラウンド 1（4 件: must 1・should 2・nit 1）・ラウンド 2（1 件: should 1）とも指摘はその場で修正した。
  ラウンド 2 の指摘（tab バー右端のホスト名表示の裏取りが「未確定事項」に列挙されていない）は修正済みだが、
  ラウンド上限のため 3 回目の再点検は行わない。
- 決定: ラウンド 2 の修正を最終版として requirements 工程を終了する。3 回目の doccheck は実施しない
  （`maxDocCheckRounds` の趣旨どおり、上限到達後は深追いしない）。
- 理由 / 代替案: 2 ラウンドとも指摘は用語・参照の整合性レベル（must 1 件を含むが、いずれも記述の訂正で解消済み）
  であり、内容そのものの欠陥ではなかった。3 回目を回しても収穫逓減と判断。
- 影響: 無し（requirements.md は指摘反映済みで承認へ進む）。

## D2: research.md にも独立点検を追加で行ったが、`aidev doccheck` には記録できない（対象外の工程）

- 背景: research.md を書いたあと、requirements と同じ要領でサブエージェントへ内部一貫性の点検を委譲し、
  4 件（should 2・nit 2）の指摘を得てその場で修正した。記録のため `aidev doccheck report research --findings 4`
  を実行したところ、`独立点検の対象は上流4工程だけ: research（requirements design architecture tasks）`
  という exit 1 のエラーで拒否された——**research は `aidev doccheck` の対象工程ではない**
  （`aidev-15-research` の手順にも doccheck の記載が無く、CLI の実装と一致している）。
- 決定: research.md への点検自体は品質向上として実施済みの修正を残すが、`aidev doccheck`／`task_check_*` の
  いずれのメトリクスにも計上しない（対象外の工程なので記録先が無い）。次工程以降は `aidev-20-design` が
  求める `doccheck design` から通常どおり実施する。
- 理由 / 代替案: 無理に記録先を作らず、CLI の不変条件（対象4工程）に従う。research.md の質は「判明した事実」に
  file:line の根拠を徹底することで別途担保する。
- 影響: metrics.yml の `task_check_*` 系には research 分の点検回数・件数は載らない（次の retro でこの旨を
  参照できるよう、ここに経緯を残す）。

## D3: design の独立点検（doccheck）はラウンド上限（2）で打ち切り、直して次工程へ進む

- 背景: design.md の内部一貫性点検を 2 ラウンド実施した。ラウンド 1（8 件: must 3・should 3・nit 2）・
  ラウンド 2（6 件: must 2・should 2・nit 2）とも指摘はその場で修正した。ラウンド 1 の指摘は主に
  ファイルパス・担当ファイルの節間不一致（`tabBarClock.ts` の配置・外周の border/outline の矛盾・
  `tabBarRight.ts` が対象範囲に無い等）、ラウンド 2 の指摘は `bordered`/`showLabel` prop の**受け渡し経路**
  （`App.vue` だけでなく `PaneLayout.vue` を再帰的に通す必要がある、という設計上の見落とし）と、
  「自動」判定が実際には「単独 pane で枠が消える」だけでなく「分割中の非選択 pane に新しく枠が付く」という
  AC9 の記述漏れという、内容に踏み込んだ指摘だった——**ラウンド 2 の方が実装上重要な発見**（`PaneFrame` の
  実インスタンス化位置が `PaneLayout.vue` 側だったことに気付けたのはこの点検のおかげ）。
- 決定: ラウンド 2 の修正（`multiPane` prop を `App.vue`→`PaneLayout.vue`（再帰）→`PaneFrame` と通す設計、
  非選択・`bordered=true` の新しい枠色 `--wtm-menu-border` の追加）を最終版として design 工程を終了する。
  3 回目の doccheck は実施しない（`maxDocCheckRounds` の上限どおり）。
- 理由 / 代替案: 2 ラウンドの指摘はいずれも記述の訂正・追記で解消済み。特にラウンド 2 の `PaneLayout.vue`
  経由の気付きは coding 工程での手戻りを防ぐ実質的な価値があった——点検の効果が出た例として retro で拾う。
- 影響: 「対象範囲」に `PaneLayout.vue`・`.aidev/backlog/product-roadmap.md` を追加済み。tasks 工程はこの
  修正後の design.md（`multiPane` prop の受け渡し経路）に基づいて分解する。

## D4: `Splitter.vue` の `paneGaps` は store を直接読む。`PaneFrame.vue` の `bordered` は prop で受け取る（非対称）

- 背景: tasks の独立点検（ラウンド 1）で、`Splitter.vue`（T8）が `paneGaps` を「`App.vue`/`PaneLayout.vue`
  経由で渡す」と書きながら実際にはその経路がどのタスクにも実装されていない、という指摘を受けた。
- 決定: `paneGaps` は `Splitter.vue` が `useSettingsStore()` を自分で注入して直接読む（この component は
  既に `inject(ConnectionKey)` で共有の状態を直接取る前例がある。`Splitter.vue:15`）。一方 `bordered`
  （`PaneFrame.vue` が使う）は、design が明示的に「`PaneLayout.vue` が `paneBorders` の 3 値と `multiPane`
  から解決し、計算済みの boolean だけを `PaneFrame.vue` へ渡す」と決めているため、その経路のまま実装する
  （design.md「振る舞いの詳細 / pane の枠・外周・隙間」）。
- 理由 / 代替案: `paneGaps` は構造上の位置に依らない単純なグローバル設定で、`multiPane`（構造に依る値。
  store に無い）と組み合わせる必要が無い。無理に prop で通すと、使われない中継 prop が `App.vue`・
  `PaneLayout.vue` に増えるだけで得るものが無い。`bordered` の方は design で既に決めた経路を変える理由が
  無いので、そのまま踏襲する。
- 影響: `Splitter.vue`（T8）の依存は `T3`（store がある）のみで足り、`App.vue`（T5）・`PaneLayout.vue`（T6）
  を経由しないため T4〜T7 と並行できる（tasks.md「作業順序と依存関係」）。

## D5: tasks の独立点検（doccheck）はラウンド上限（2）で打ち切り、直して次工程（coding）へ進む

- 背景: tasks.md の内部一貫性点検を 2 ラウンド実施した。ラウンド 1（7 件: must 3・should 3・nit 1）・
  ラウンド 2（3 件: must 1・should 2）とも指摘はその場で修正した。ラウンド 1 は実装方針の番号の食い違いや
  `bordered`/`paneGaps` の受け渡し経路の未実装（D4 の題材）、ラウンド 2 は AC の割り当ての説明不足
  （T3 の除外理由・T9 が AC9 を持たない理由）と、T5 の単体テストの有無の記述の揺れ（`App.test.ts` は実在すると
  確認し断定に直した）だった。
- 決定: ラウンド 2 の修正を最終版として tasks 工程を終了する。3 回目の doccheck は実施しない。
- 理由 / 代替案: いずれの指摘も記述の訂正・注記の追加で解消済み。特に `Splitter.vue`/`PaneFrame.vue` の
  設計上の非対称性（D4）は、指摘を機に明文化できた——点検の効果が出た例として retro で拾う。
- 影響: `aidev coverage --strict` は gaps=0 で通過済み。coding 工程はこの最終版の tasks.md に基づいて進める。

## D6: `store/settings.ts` の 8 項目は「既定との差だけを持つ」構造にしない。常に書く単純な値にする

- 背景: T3（coding）で `store/settings.ts` に 8 つの設定値を足す際、`keyPrefs`（20260921-keybinding-customization）・
  `themeOverrides`（20260922-theme-custom-overrides）のような「既定との差だけを持ち、差が無くなれば
  キーごと消す」複合構造にするかどうかを検討した。
- 決定: しない。8 項目とも `statusSymbols`・`newCwdPolicy` と同じ「常に保存する単純な値」の形にする
  （`setTabBarPosition` 等は無条件で `writePrefs` する。既定値と同じでも保存キーが `wtm.prefs.v1` に残る）。
- 理由 / 代替案: 差分構造が要るのは「既定は空で、利用者が個別に足していく」形（キー割り当ての上書き・
  色の上書き）のときだけ。この work の 8 項目は複合キーではなく独立した単純値（文字列・真偽値・配列 1 本）で、
  差分構造にしても保存されるバイト数の節約以上の利点が無い一方、読み書きのコード（`sameState`/`sameStored`
  の二重比較・「差が無くなれば消す」判定）が増える。8 項目のうち `tabBarRight`（配列）だけは複合的に見えるが、
  「エントリの配列そのものが設定値」であって「差分」ではないため、他の単純値と同じ形で扱って問題ない。
- 影響: `store/settings.ts:198-202` のコメントがこの決定を指す（「decisions D の過剰設計の回避」→ D6）。
  taskcheck（T3 ラウンド1）で「参照先の decision が実在しない」と指摘され、この D6 を新設して直した。

## D7: T10（E2E）で、T4（TabBar.vue）の実装漏れ（`order` の未設定）を発見・修正した

- 背景: T4 で `TabBar.vue` に `position` prop を足した際、design.md の「振る舞いの詳細」に書いた
  「ルート要素に `:style="{ order: position === 'bottom' ? 1 : 0 }"` を設定する」を、実際には
  **クラス（境界線の位置。`tab-bar-top`/`tab-bar-bottom`）だけ実装し、`order` スタイル自体を書き忘れていた**。
  T4 の単体テスト（`TabBar.test.ts`）もクラスの有無しか確認しておらず、この欠落を検知できなかった。
  T10（E2E）で「position=bottom のとき実際に画面の下へ移る」を bounding box で確認するテストを書いたところ、
  `tab-bar` の実際の描画位置が変わっていないことで発覚した。
- 決定: `TabBar.vue` に `:style="{ order: props.position === 'bottom' ? 1 : 0 }"` を追加。合わせて
  `TabBar.test.ts` にも `order` の値を直接確認する回帰テストを 2 本追加した（クラスだけでなく実際の視覚順を
  確かめる）。
- 理由 / 代替案: 単体テストが「クラスが付いているか」までしか見ておらず、「そのクラス・スタイルが実際に
  意図した見た目を作るか」は E2E でしか捕まえられない実例——`e2e-observe-browser` 条項の存在意義そのもの。
- 影響: T4 の review.md 追記済み（下記）。design.md との整合は保たれている（design の記述どおりに直した）。
  taskcheck T4・T5・T6 のラウンドではこの欠落は指摘されなかった（単体テストの stub 経由では気付けない
  性質の不具合だった）——retro でこの再発防止（単体テストで見た目のスタイル値まで確認する習慣）を検討する
  余地がある。


## D8: test 工程の E2E 一式で、既存 3 spec（settings.spec.ts 2 本・theme-settings.spec.ts 1 本）を退行させていたことが発覚し、直した

- 背景: 各タスクの独立点検・T10 の taskcheck では、`packages/e2e/src/specs/tabbar-pane-appearance.spec.ts`
  （この work の新規 spec）だけを走らせており、**既存 spec への影響は見ていなかった**。test 工程で初めて
  E2E 一式（120 本超）を走らせたところ、4 本が落ちた（新規 spec 自体は 0 件）。
  - `settings.spec.ts` の 2 本：`section[aria-labelledby="settings-display"] [role="switch"]` を
    `.click()` していたが、この work で節「表示」の switch が 1 個→5 個に増え、Playwright の strict mode
    （複数要素に解決すると即エラー）に触れた。
  - `settings.spec.ts` の 1 本（AC-I3。キーだけで端末の節のラジオへ辿り着けるか）：Tab で辿る回数の上限
    （12 回）が、節「表示」に増えた約 10 個の新しいタブ停止点（select・switch・fieldset 内の select/
    button/input）を超えられなくなっていた。
  - `theme-settings.spec.ts` の 1 本：`input.settings-path`（既存の「指定した場所のパス」欄と同じ CSS
    クラス）で入力欄の枠色を確かめていたが、この work の tab バー右端の区切り文字欄も同じクラスを使うため
    2 要素に解決し、strict mode に触れた。
- 決定: 3 箇所とも直した——switch の 2 箇所は `.first()`（意図する対象＝先頭の「状態を記号でも示す」は
  今までどおり先頭のまま）、Tab の上限は 40 に広げる（早期に見つかれば抜けるので遅くならない）、
  `settings-path` の 1 箇所は `aria-label` で対象を明示（`.first()` だと DOM 順で自分の新しい区切り文字
  欄に化けてしまうため、**元の対象を明示して意図をすり替えない**形にした）。
- 理由 / 代替案: 自分の新しい CSS クラス名を別にする案（例 `tabbar-right-input`）も検討したが、
  `.settings-path` は「入力欄の見た目をそろえる」ための既存の共有スタイルクラスで、意図的に再利用している
  （design「振る舞いの詳細」）。クラスを分けると見た目をそろえる意図が薄れるため、既存テスト側を
  具体的にする方針にした。
- 影響: **単体テストは各タスクの独立点検で毎回走らせていたが、既存 E2E への影響は test 工程の一式実行まで
  気付けなかった**——「少しの修正ですべて回すのは時間とみあわない」という運用（`e2e-affected-specs-only`）の
  ぶん、この種の「新しい要素の追加が既存 spec の広いセレクタを直撃する」退行は、一式を回すまで発見が遅れる
  構造的なリスクとして残る。retro で拾う余地がある（例：新しい `role="switch"`/共有クラスを足すタスクでは、
  影響し得る既存 spec を grep する手順を taskcheck の観点に加える、等）。
