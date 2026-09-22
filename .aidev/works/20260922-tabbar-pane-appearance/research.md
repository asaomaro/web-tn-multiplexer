# 調査: タブバーと pane の枠の外観設定（herdr の `tab_bar_*`・`pane_*` 相当）

herdr の版は前 work（20260921-theme-settings・20260921-keybinding-customization 等）と同じ
`da6bcd5969779bfe0396bcf89a8025d4375d611e`。クローンは
`/tmp/claude-1000/-workspaces-web-tn-multiplexer/c9cb88b9-7a6c-4993-91e8-f1039355706b/scratchpad/herdr`
（セッションのスクラッチパッド。再現するにはこのコミットを別途取得する）。以下のパスは断りが無ければその配下からの相対。

## 調査の問い

- Q1: herdr の `ui.tab_bar_*` / `ui.pane_*` の各設定は、既定値・型・意味がそれぞれ何か（回答: F1〜F4）
- Q2: tab バー右端のホスト名表示は、本製品の既存の値で賄えるか（サーバ・protocol の変更なしに済むか）
  （回答: F5・F13・A6）
- Q3: pane の枠の描画（自動/常に/なし）・外周の枠・隙間は、本製品の既存のレイアウト（`PaneFrame.vue`・
  `Splitter.vue`・`PaneLayout.vue`）にどう乗せられるか。特に PTY の cols/rows を変えない制約と両立するか
  （回答: F6・F9・F11・F12）
- Q4: pane 枠へのエージェント名表示は、herdr ではどんな優先順位で、本製品の既存の名前解決とどう噛み合うか
  （回答: F7・F10）

## 判明した事実

### herdr 側（`ui.tab_bar_*` / `ui.pane_*`）

- F1: `UiConfig`（`src/config/model.rs:903-971`）に該当フィールドが揃っている。既定値は
  `src/config/model.rs:1176-1184`（テストの `defaults_match_documented_values` 相当。`:1478-1489` で確認）:
  - `pane_borders: PaneBordersConfig::Auto`
  - `pane_outer_borders: true`
  - `pane_gaps: true`
  - `show_agent_labels_on_pane_borders: false`
  - `hide_tab_bar_when_single_tab: false`。実際の判定は
    `show_tab_bar = rows > 1 && !(hide_tab_bar_when_single_tab && tab_count == 1)`
    （`src/client/shell/config.rs:393`）——**「隠す」を入にし、かつ tab が 1 個のときだけ**バーを消す
    （`tab_count` は tab の総数。`rows > 1` は端末自体の高さの下限で本設定とは無関係）
  - `tab_bar_position: TabBarPositionConfig::Top`
  - `tab_bar_right: Vec::new()`（既定は空。何も出さない）
  - `tab_bar_right_separator: " "`（半角スペース 1 つ）
- F2: `PaneBordersConfig`（`src/config/model.rs:847-861`）は `Auto | Always | Off` の 3 値。
  `draws_borders()` は `Off` 以外で真、`shows_borders(multi_pane)` は
  `draws_borders() && (multi_pane || Always)`（`:857-861`）——**「自動」は「分割しているときだけ」**、
  「常に」は単独 pane でも枠を出す、という意味。レガシーな旧 `bool` 値も受理し、
  `true→Auto` / `false→Off` に読み替える（`:1451-1465` のテスト）。
- F3: `TabBarPositionConfig`（`:841-846`）は `Top | Bottom` の 2 値（`#[serde(rename_all="snake_case")]`）。
- F4: `TabBarRightEntryConfig`（`src/config/tab_bar.rs:20-37`）は tagged union:
  `Zoom` / `Hostname` / `Datetime{format}`（既定 `"%H:%M"`。strftime 書式。`:9-11`）/ `Text{text}` /
  `Command{command,interval_seconds,timeout_seconds}`。上限 `MAX_TAB_BAR_RIGHT_ENTRIES=16`（`:7`）。
  **`Command` はサーバ側で任意のシェルコマンドを定期実行する**（`src/app/tab_bar_status.rs` の
  `TabBarCommandRuntime`。プロセスの起動・タイムアウト・強制終了を扱う、`:18-38`）——要件で対象外にした理由の裏付け。
- F5: `Zoom` エントリ・`Hostname` エントリの実装（`src/app/tab_bar_status.rs:60-71`）：
  - `Zoom`：`TabBarStatusSegment::Zoom`（`src/app/state.rs:784-787`）をそのまま積む。表示側で今の tab が
    zoom 中かどうかに応じた文字列に変換すると見られる（表示側の具体は未確認——本製品は独自に実装するため
    深追いしない。「zoom しているかどうかの真偽」だけが要る事実）。
  - `Hostname`：**herdr を動かしている（クライアント）マシンの OS ホスト名**（`crate::platform::hostname()`）を
    そのまま文字列として積む。**本製品の「サーバのホスト名」とは指しているものが違う**（herdr は
    クライアントローカル、本製品はリモートのサーバ）。design で「本製品では何を指すべきか」を明確にする必要がある。
- F6: pane の枠・隙間・外周・ラベルの描画（`src/ui/panes.rs`）:
  - `bordered = pane_borders.shows_borders(multi_pane)`（`:99`）。
  - 枠が無くても隙間だけは残せる：`multi_pane && pane_gaps && !pane_borders.draws_borders()` のとき
    1 セル分の空白を挟む（`:119`）。`!pane_gaps` のときは逆に境界を共有し隙間を作らない（`:132`）。
  - `!pane_outer_borders` のときは外周（pane 領域全体の外縁）だけ描かない（`:140`、`:223`、`:288`）。
  - ラベルは `terminal.border_label(app.show_agent_labels_on_pane_borders)`（`:638`）を通す。
  - `render_pane_borders`（`:454-`）は `pane_borders.draws_borders()` が偽なら**枠を描く処理自体を丸ごと
    やらない**（`:461`）——「なし」は枠もラベルも出さない設定であることが分かる。
- F7: `border_label`（`src/terminal/state.rs:2143-2153`）の優先順位は
  **`effective_title()`（端末の OSC タイトル相当）→ `manual_label`（利用者が付けた名前）→
  （`show_agent_labels` が真のときだけ）エージェントの表示名 → 無し**。
  **herdr は既定（`show_agent_labels_on_pane_borders=false`）でも、タイトルや手動名があれば常に枠にラベルを出す**
  ——このトグルは「エージェント名まで出すか」だけを絞る飾りで、ラベル表示そのものの ON/OFF ではない。
  本製品は次の F10 のとおり、現状ラベルを一切描いていないため、この優先順位をそのまま持ち込むと
  「トグルを切っても手動名やタイトルは常に見える」という**新しい既定の挙動変化**になり、AC9（既定値は現状と
  変えない）に反する。design で意図的に外す必要がある（下記「design への申し送り」）。

### 本製品側（既存実装）

- F8: `packages/web/src/components/TabBar.vue`（130 行、全読）。tab の一覧を `role="tablist"` で描き、
  zoom 中の tab には `<span class="tab-bar-zoomed">Z</span>` を **tab 自身のラベルの隣**に出す（`:65`）
  ——herdr の「バー右端」とは別の場所・別の意味（herdr は bar 全体の右端に 1 箇所、本製品は tab ごと）。
  `<style>` は `.tab-bar { display:flex; ... }`（横並びの帯。上端固定は `App.vue` の親のレイアウト次第）。
  位置（top/bottom）・自動非表示・右端エントリの仕組みは**まだ無い**。
- F9: `packages/web/src/components/PaneFrame.vue`（160 行、全読）。
  - **枠は現状、常に描かれる**（`enabled` の pane は必ず `.pane-frame-edge` を持つ。`pane_borders` の
    3 値・`multi_pane` 判定・`pane_gaps`・`pane_outer_borders` は無い）。
  - **`.pane-frame-enabled { padding: 4px; }` が葉（端末を測る要素）の外側に必ず 4px を作る**——コメントに
    明記（`:10-11`,`:138-141`）：「外寸が変わると PTY の行・列が変わってしまう」。`PaneLayout.vue` の
    `ResizeObserver` は葉の要素を測って `client.view` に送るため（`PaneLayout.vue:26-38` 周辺のコメント。
    F11 参照）、**この 4px を条件分岐で無くす実装は禁物**——描くかどうかは色・線の有無（視覚）に留め、
    ボックスの大きさ（padding の量）は変えない。
  - `paneName`（ラベルの文字列）は現状 **`aria-label` にしか使っていない**（`:35`,`:39`）。可視のテキストとして
    枠に描画してはいない——`show_agent_labels_on_pane_borders` 相当の可視ラベルはゼロから追加する機能。
  - 枠の色は `--wtm-pane-current`（選択中のみ）。既定は非選択時 border 無し、選択時だけ 2px の枠
    （20260921-theme-settings の decisions D15。「強調はホバーではなく選択で起きる」）。
- F10: `packages/web/src/store/paneName.ts`（11 行、全読）。**この製品で唯一の名前解決**：
  `pane.label || pane.agent?.label || pane.title || fallback`（`:11`）。以前は `GotoPicker.vue` と
  `PaneFrame.vue` に同じ式が複製されていて 1 つだけずれる不具合があった、と冒頭のコメントに明記——
  **この関数を経由しない独自の優先順位をこの work で作ると同じ過ちを繰り返す**（herdr の F7 の並びを
  そのまま真似ない理由）。
- F11: `packages/web/src/components/PaneLayout.vue` 冒頭のコメント（1-50 行）。`ResizeObserver` で葉
  （`PaneFrame` の中の `.pane-frame-body` 配下）を測り、`RESIZE_COMMIT_INTERVAL_MS` に 1 回まで
  `client.view` を commit する。**測る対象は `PaneFrame` の内側**なので、`PaneFrame` 自身の padding は
  測定に影響しない（padding は枠の外側、葉は枠の内側）が、**Splitter の太さ（4px）や `pane-frame-enabled`
  の padding（4px）の値そのものを変えると、葉に残る面積が変わり cols/rows が変わる**。
- F12: `packages/web/src/components/Splitter.vue`（全読。`<style>` は `:108-129`）。分割の境界は `PaneFrame`
  の padding とは**別の独立した要素**（`flex:none`（`:112`）; `width:4px`（`:120`。dir=right）/
  `height:4px`（`:124`。dir=down））。2 つの `PaneFrame`（各 4px padding）の間に Splitter
  （4px）が挟まる構造——**現状は常に「隙間あり（herdr の `pane_gaps:true` 相当）」の見た目に固定**されている。
  `pane_gaps:false`（隙間を無くし境界を共有）を作るには、Splitter とその両隣の PaneFrame の padding の
  意味を作り直す必要があり、**色を変えるだけでは表現しきれない**——「視覚的に隙間の色を無くす（周囲と同化させる）」
  という近似で `pane_gaps` を再現するのが、cols/rows を変えない制約と両立する現実的な線（design で確定する）。
- F13: `packages/web/src/main.ts:273-277`。ブラウザのタブタイトルを `${session.host.hostname}: ${workspaceLabel}`
  の形で更新済み（H14/AC4。20260918 由来）。`session.host.hostname`（型は `HostInfo.hostname`。
  `packages/protocol/src/model.ts:94`）は**サーバ側の `os.hostname()`**（`packages/server/src/composeServer.ts:133`
  `hostname: (await import("node:os")).hostname()`）をそのまま client.hello 等で送っている値——出処を確認済み。
  **この work では新しい通信を増やさず、既存のこの値をそのまま tab バー右端の「ホスト名」エントリに使う**
  （F5 のとおり herdr はクライアントローカルのホスト名を指すので意味が違うが、ブラウザには OS ホスト名を
  取得する手段が無く、リモートアクセスという本製品の性質上「接続先サーバのホスト名」の方が有用という判断——
  design で明記する）。
- F14: `packages/web/src/components/SettingsDialog.vue:353-364`。節「表示」の既存の1項目（状態を記号でも示す）は
  `role="switch"` のボタン（`settings-switch`）＋説明の `<p class="settings-note">`。この work で足す
  トグル類はこのパターンを踏襲できる。セレクト（top/bottom 等）・複数選択＋並び替え（右端エントリ）は
  この節にまだ前例が無い——design で決める。
- F15: `packages/web/src/store/settings.ts`（1-80 行）。既存の設定値は
  `ref(load<Xxx>(initial["<key>"]))` ＋ 個別の `load<Xxx>` 関数（壊れた値は既定へ）＋
  `readPrefs`/`writePrefs`（`store/view.ts`）に一元化、という決まった形。この work の新しい値もこの形に従う。
- F16: herdr の分割境界の色（`src/ui/panes.rs:481-495`）：**選ばれている（`focused`）pane に触れている線は
  `palette.accent`、それ以外は `palette.overlay0`**——「枠を出すか」（F6の`pane_borders`）とは別に、
  「出すと決まった枠の色」は選択中かどうかで変わる、という herdr の実装。F6 で判明した「分割中は枠が出る」
  （`multi_pane` かどうかによる有無）と合わせて読むと、herdr は**分割中の全 pane に枠を出しつつ、選択中と
  それ以外で色を変える**——本製品の「選択中だけ枠を出す」（`PaneFrame.vue:145` の `.pane-frame-edge-current`
  だけが色を持つ既存実装）とは異なる。design で、この work の「自動」判定にこの色分けをどこまで取り込むかを
  検討する。

## 影響範囲

- `packages/web/src/components/TabBar.vue`（位置・自動非表示・右端エントリの追加）
- `packages/web/src/components/PaneFrame.vue`（枠の 3 値・外周・隙間の視覚切り替え、エージェント名の可視ラベル追加）
- `packages/web/src/components/Splitter.vue`（隙間 off の視覚表現。padding/width 自体は変えない）
- `packages/web/src/store/settings.ts`（新しい設定値と load/save 関数）
- `packages/web/src/components/SettingsDialog.vue`（節「表示」に UI を追加）
- `docs/herdr-parity.md`（H22・H23）・`docs/verification.md`

## 実現性 / リスク

- **リスク**: `pane_gaps`/`pane_outer_borders`/`pane_borders` を「視覚だけ」の切り替えに留める設計は、
  herdr の「実際にレイアウトの余白を削る」実装より見た目の効果が弱い（padding は残ったまま色だけ変える）。
  ただし PTY の cols/rows を変えない制約（F9・F11）と両立させるには現実的な選択で、design でその旨を明記し、
  「本製品との違い」として docs にも残す（herdr-parity の記法に合わせる）。
- **リスク**: tab バー右端の `Zoom`/`Datetime` の具体的な表示文字列（フォーマット）は、herdr の
  strftime 書式をそのまま持ち込むか、簡略化した選択式にするかで実装量が変わる。design で決める。
- 技術的には全て web だけ（ブラウザの CSS・Vue コンポーネント・localStorage の設定）で完結し、
  サーバ・protocol の変更は無い（F13 で裏取り済み）。

## 実装アンカー

- A1: tab バーの位置・自動非表示・右端エントリの描画 —
  `packages/web/src/components/TabBar.vue`（全 130 行。F8）。**新規追加の機能で、既存コードの特定行への
  差し込みではなく `<template>`/`<style>` への新設が主**なので、上のとおりファイル全体を対象とする
  （個別行は無い。位置の入れ替えは親の `App.vue` 側のレイアウトも絡む可能性があり、そこは未特定——design で
  `App.vue` の `.app-main` 周辺を確認する）
- A2: pane の枠・外周・隙間・エージェント名ラベルの描画 —
  `packages/web/src/components/PaneFrame.vue:117-149`（`pane-frame-enabled`/`pane-frame-edge` 周辺。F9）
- A3: 隙間の視覚表現（枠の色を周囲に同化） —
  `packages/web/src/components/Splitter.vue:108-129`（`<style scoped>` の `.splitter`/`.splitter.right`/
  `.splitter.down`。F12）。**特定済み**（色を変える対象のクラスは上記で確定。`flex:none`・`width`/`height`の
  数値は変えない）
- A4: 設定値の追加 —
  `packages/web/src/store/settings.ts:1-80` 周辺の既存パターンの隣（F15）
- A5: 設定画面 UI の追加 —
  `packages/web/src/components/SettingsDialog.vue:353-364`（節「表示」。F14）
- A6: ホスト名の出処 — `packages/protocol/src/model.ts:94`（`HostInfo.hostname` の型）・
  `packages/server/src/composeServer.ts:133`（`os.hostname()` を積む箇所。F13）。確認済み・追加調査は不要。

## 実装時の注意

- **`paneNameOf`（F10）を必ず経由する**。herdr の `border_label`（F7）の優先順位をそのまま真似ない
  （タイトル最優先だと、この work の対象外である「常時ラベル表示」まで足すことになり AC9 に反する）。
- **`PaneFrame.vue`・`Splitter.vue` の padding/width の数値そのものは変えない**（F9・F11・F12）。
  変えるのは色・表示の有無だけ。
- 右端エントリの `Command` 種別は対象外（F4）。実装時に足したくなっても requirements の対象外を確認すること。

## design への申し送り

- pane 枠のラベル表示は、`show_agent_labels_on_pane_borders`（本製品では「pane の枠へのエージェント名表示」）を
  **「枠にラベルを出すかどうか」自体のトグルとして扱う**（herdr のように常時ラベル＋エージェント名の絞り込み、
  ではない）。この逸脱は herdr との違いとして docs（H23 相当行）に明記する。
- `Hostname` エントリは「接続先サーバのホスト名」（F13・A6）を指すと明記し、herdr（クライアントローカル）との
  違いを docs に残す。
- `pane_gaps`/`pane_borders`/`pane_outer_borders` の実装は「視覚のみ・ボックス寸法は不変」という制約を
  design の「依拠する既存の事実」に明記し、それに基づく具体的な CSS 切り替えの設計をそこで詰める。
- 未確定事項（requirements）のうち「`pane_borders` の自動判定」は F2 の `shows_borders(multi_pane)` を
  参考にしつつ、本製品での「分割」の定義（そのタブのレイアウト木が leaf 1 つだけか）を design で確定する。
