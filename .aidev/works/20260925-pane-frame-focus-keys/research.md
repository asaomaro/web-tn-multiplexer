# 調査: pane の枠にフォーカスがある間の prefix・直接のキー

## 調査の問い
- Q1: backlog の記述（「pane の枠にフォーカスがある間、端末をクリックするまで prefix・直接の
  キーが届かない（prefix でも同じ既存の挙動）」）は、`PaneFrame.vue` の現在の実装と一致するか。
- Q2: 一致しないなら、実際に残っている問題は何か。
- Q3: その問題は、修正前の `Sidebar.vue`/`TabBar.vue`（20260925-focus-trapped-keybindings）と
  同じ修正（選択的な `stopPropagation`）で直すべきか、別の手段が適切か。

## 判明した事実

- F1: `PaneFrame.vue` の `pane-frame-edge`（`role="button"` の div）は、修正前の
  `Sidebar.vue`/`TabBar.vue` と違い、**マウスクリックではフォーカスを奪わない**。
  `onMouseDown`（`PaneFrame.vue:225-229`）が `ev.preventDefault()` を呼んでおり、これは
  ブラウザの既定のフォーカス付与を防ぐ（コメント「M1：枠の押下でも pane を選び、端末に
  フォーカスする（枠が Tab で止まる要素でも、クリックではフォーカスを奪わない）」が明記）。
  つまり D11(1) が報告した「マウスで押した後にフォーカスが残る」という経路そのものが、
  `PaneFrame.vue` には最初から存在しない。
- F2: `pane-frame-edge` の `tabindex` は `selected ? 0 : -1`（`PaneFrame.vue:265`）。
  `selected` は `view?.focusedPaneId === props.paneId`（`PaneFrame.vue:57`）——つまり
  **現在アプリが focus している pane の枠だけ**が Tab で止まる対象になる。フォーカスへ
  至る経路はマウスクリックではなく Tab キーでの移動のみ。
- F3: `PaneFrame.vue` の `onKeydown`（238-246行目）は既に**選択的**：
  Enter・Space・ArrowDown・ContextMenu・Shift+F10（APG の menu button の慣習キー）のときだけ
  `stopPropagation()`（と `preventDefault()`）を呼ぶ。`if (!opens || ev.ctrlKey ||
  ev.altKey || ev.metaKey) return;` により、**ctrl/alt/meta 付きは最初から無条件で
  bubble する**——20260925-focus-trapped-keybindings が直した「無条件に keydown を止める」
  という問題は、`PaneFrame.vue` には元から無い。**ただしこの判定条件は `ev.shiftKey` を
  見ていない**——Shift+Enter・Shift+Space・Shift+ArrowDown も `opens` が true になり、
  ctrl/alt/meta のいずれも押していなければ `stopPropagation()` される（review round1 の
  指摘で修正時に判明。当初 F3 は「修飾キー付きは無条件で bubble」と誤って一般化していたが、
  正確には「ctrl/alt/meta 付きは bubble、shift のみは bubble しない」）。
- F4: 既定の割り当て（`packages/web/src/keys/bindings.ts` の `ACTIONS`）に、Enter・Space・
  ArrowDown・ContextMenu・F10 を使うものは無い（`grep` で確認。全 `defaults:` を目視）。
- F5（T1 round2 taskcheck で訂正）: `packages/web/src/keys/chord.ts` の `NAMED_KEYS`
  （68-84行目）に `ContextMenu`・`F10` の対応は無い。**しかし `F10` は `NAMED_KEYS` とは別の
  `F_KEY` 正規表現（`chord.ts:122`。`/^[fF]([1-9]|1[0-9]|2[0-4])$/`）で扱われ、F1〜F24 として
  chord 文字列に表現できる**——ContextMenu と同列に「表現できない」とした当初の F5 は誤りだった。
  `chordOf`（`chord.ts:213-239`）の F-key 分岐は shift を保ったまま `name = key.toLowerCase()`
  にするため、`key({ key: "F10", shift: true })` は `"shift+f10"` になる（実測済み。下記
  F11 参照）。**表現する手段が無いのは `ContextMenu` だけ**（`NAMED_KEYS`・`F_KEY` のどちらにも
  対応が無い）。残る4キー（Enter→`enter`・Space→`space`・ArrowDown→`down`・F10→`f10`/`shift+f10`）
  は表現できる。
- F6: `assign.ts` の直接のキーの検証（129-146行目）は `isDirectChord(chord)` で
  **修飾キーの無いキー・shift だけを付けたキー・矢印を一律拒否**する（「修飾キーの無い
  文字・shift だけを付けたキー・tab や矢印などは端末への入力を奪うので、直接のキーにできません」
  ——`assign.ts:140-145`）。よって**無修飾の Enter/Space/ArrowDown を direct（prefix 無し）
  キーとして割り当てることは、そもそも UI が拒否する**。
- F7: 一方、**prefix の後のキー**（`assign.ts` の `else` 分岐、149行目以降）にはこの
  修飾キー必須の制約が無い（既定の `prefix+v` 等がまさに無修飾の1文字）。予約
  （`RESERVED_AFTER_PREFIX`。`keymap.ts:35-38`）にあるのは `Esc`（prefix 取り消し）と
  `ctrl+shift+v`（貼り付け）の2つだけで、Enter・Space・ArrowDown は予約されていない。
  ユーザーは `prefix+enter`・`prefix+space`・`prefix+down`（chord 表記 `enter`/`space`/
  `down`）を任意の操作へ割り当てられる。
- F8: `RESERVED_AFTER_PREFIX`/`RESERVED_DIRECT` は既に「別の場所が先取りするキーは
  割り当てさせない」という前例を持つ（`ctrl+shift+v` — `KeyInputController` が
  ルーターより先に取るため）。`keymap.ts:33` のコメントが直接その理由を述べている。
- F9（navigate モードとの違い）: `navigate_open_menu`（20260925-sidebar-keyboard-menu で追加）
  の既定は `space`（`navigateKeys.ts:68`）だが、これは `navigateKeymap.ts`/`NavigateMode.ts`
  という**別のキーマップ・別のキー処理経路**（design「decisions D2」が「prefix 概念が無く、
  bare な単一文字も許す」ため既存操作の表とは独立と明記）。navigate モードの中では
  `pane-frame-edge` は関与しない（navigate モードの選択は `view.navigateSelection` という
  別の状態で、DOM フォーカスとは無関係）。よってこの work の対象（prefix 後のキー・直接の
  キー）とは独立しており、影響しない。
- F10（review round1 で追加。F3 訂正の裏付け）: `chord.ts` の `parseChord`（170-190行目）の
  shift 禁止規則（`if (parts.shift && (key === "plus" || (isSingleChar(key) &&
  !isCased(key)))) return null;`）は「大小のない1文字（数字・記号）」だけが対象で、
  `enter`/`space`/`down` のような複数文字の名前付きキーには掛からない。よって
  `shift+enter`・`shift+space`・`shift+down` は画面から実際に取り込み・保存できる有効な
  chord である（F6 の direct 側の拒否——`isDirectChord` が shift だけを付けたキーも
  一律拒否する——とは経路が異なる。F6 は direct、F7 は prefix-後 の話で、shift 禁止規則の
  対象になるのは `parseChord` の1文字限定ルールだけ）。`chordOf`（`chord.ts:213-239`）も
  named key（Enter 等）では `shift = k.shift` をそのまま使うため、`key({ key: "Enter",
  shift: true })` は `"shift+enter"` になる（`assign.test.ts`/`keymap.test.ts` の新設テスト
  で実測済み）。
- F11（T1 round2 taskcheck で追加）: `PaneFrame.vue:239-240` の `opens` 条件のうち F10 だけは
  自分専用のサブ条件を持つ（`ev.key === "F10" && ev.shiftKey`）——**F10 は shift 付きのときだけ
  枠のメニューを開く**。無印の `F10`（shift 無し）は `opens` に含まれず、枠に止められない
  （安全）。一方 `shift+f10` は F5 の訂正どおり chord として表現でき、かつ
  `isDirectChord`（`chord.ts:282-286`。`return p.ctrl || p.alt || p.cmd || F_KEY.test(p.key);`）
  は F キーを shift の有無に関わらず direct として通すため、`shift+f10` は
  **prefix の後のキーとしても直接のキーとしても割り当てが通ってしまう**——F6・F7 で見た
  Enter/Space/ArrowDown の穴と同じ形が、direct 側にも及ぶ唯一のキーである。
- F12（T1 round2 taskcheck で追加。実装時に発見）: `RESERVED_DIRECT`（`keymap.ts:44`。当初は
  `ReadonlySet<string>`）を直接のキーの検証で参照する2か所（`assign.ts:138-139`・
  `keymap.ts:126-127`）は、いずれも「は貼り付けに使うので、直接のキーにできません」という
  **`ctrl+shift+v` 専用の固定文言**をハードコードしていた。`RESERVED_AFTER_PREFIX` と違い
  理由を持たない `Set` だったため——ここへ `shift+f10`（貼り付けと無関係）を素朴に足すと、
  画面に「shift+f10 は貼り付けに使うので、直接のキーにできません。」という**事実と異なる
  理由**が出てしまう。`RESERVED_DIRECT` も `RESERVED_AFTER_PREFIX` と同じ
  `ReadonlyMap<string, string>`（chord → 理由）へ変更し、2か所の参照を `.get()` ベースへ
  直した（design「インターフェース / データ構造」参照）。

## 影響範囲
- `packages/web/src/keys/keymap.ts`: `RESERVED_AFTER_PREFIX` に3エントリ（`enter`・`space`・
  `down`）を追加するだけで閉じる。`PaneFrame.vue`・`KeyRouter`・`KeyInputController`・
  `main.ts` は無改修で足りる（F1〜F3 の通り、実際のキー到達の挙動は既に正しいため）。
- `packages/web/src/keys/assign.ts` は `RESERVED_AFTER_PREFIX` を参照するだけなので無改修。
- 画面側（`KeySettings.vue`）は `assign.ts` の戻り値（`reason` 文字列）をそのまま表示する
  既存の配線（`.aidev/works/20260921-keybinding-customization/design.md` 参照）なので、
  ここも無改修で新しい拒否理由が反映される見込み（design 工程で確認する）。

## 実現性 / リスク
- 技術的には既存の `RESERVED_AFTER_PREFIX`/`RESERVED_DIRECT` の仕組みへ3エントリ足すだけで、
  新しい仕組みは不要。リスクは低い。
- **`PaneFrame.vue` を変更しない**という結論が、backlog の一文（「pane の枠にフォーカスが
  ある間も、prefix・直接のキーを効かせる」）の素直な読みと食い違って見えるおそれがある。
  この point は requirements.md の「背景 / 課題」に、上記 F1〜F3 を根拠として明記し、
  「対象外」で `PaneFrame.vue` 自体の変更をしないことと理由を書く。

## 実装アンカー
- A1: 予約の追加（`packages/web/src/keys/keymap.ts:35-38` `RESERVED_AFTER_PREFIX`）。
- A2: 既存の予約（`ctrl+shift+v`）のテスト・ドキュメントの書き方を参考にする
  （`packages/web/src/keys/assign.test.ts`・`keymap.test.ts` があれば、そこに同型のテストを足す
  ——coding 工程で実際のテストファイルを確認する）。

## design への申し送り
- 予約する3キー（`enter`・`space`・`down`）それぞれの拒否理由メッセージの文言を design で
  確定する（`ctrl+shift+v` の文言「〜は貼り付けに使うので、prefix の後のキーにできません。」
  と同じ調子で、「pane の枠のメニューを開くキーとして使うので」という趣旨にする）。
- `docs/verification.md`・`docs/herdr-parity.md` 等、既存の割り当て一覧・制約の記述に
  このドキュメントすべき既存の言及があるかは design/coding で確認する。
