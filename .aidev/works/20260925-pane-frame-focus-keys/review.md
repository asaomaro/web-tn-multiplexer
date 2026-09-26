# レビュー: pane の枠にフォーカスがある間の prefix・後のキーの割り当てを保護する

## レビュー指摘（ラウンド1）

- [must][conv:-] `RESERVED_AFTER_PREFIX` に追加した3エントリ（`enter`・`space`・`down`）は
  無修飾の chord だけを予約しており、`shift+enter`・`shift+space`・`shift+down` を prefix
  の後のキーとして割り当てた場合、この work が閉じようとしている穴と同じ不具合（pane の枠に
  Tab フォーカスが残っている間だけ理由不明にキーが効かない）がそのまま再現する。
  `PaneFrame.vue:239-240` の `onKeydown` は `if (!opens || ev.ctrlKey || ev.altKey ||
  ev.metaKey) return;` で、除外条件に `ev.shiftKey` が無い（ctrl/alt/meta だけ判定）ため、
  Shift+Enter/Shift+Space/Shift+ArrowDown も `opens` が true になれば
  `stopPropagation()` される。`chord.ts` の `parseChord`（170-190行目）の shift 禁止規則は
  「大小のない1文字（数字・記号）」だけが対象で、`enter`/`space`/`down` のような複数文字の
  名前付きキーには掛からないため、`shift+enter` 等は画面から実際に取り込み・保存できる
  有効な chord であり、既存の `RESERVED_AFTER_PREFIX` にも無いので `validateAssignment` は
  通してしまう。research.md F3「修飾キー付き（prefix を含む）は最初から無条件で bubble
  する」はこの3キーに関して不正確（ctrl/alt/meta には当てはまるが shift には当てはまらない）。
  / 対応: `RESERVED_AFTER_PREFIX` に `shift+enter`・`shift+space`・`shift+down` の3エントリを
  追加。research.md F3 を訂正し、requirements.md・design.md・tasks.md・decisions.md を
  この修正に合わせて更新した。 / src: review round1

## タスク点検ログ（`aidev-40-coding` 手順5）

- [T1][round1] CHECK:ok FINDINGS:0 — 指摘なし。
- [T1][round2] CHECK:findings FINDINGS:2 — (must) `RESERVED_AFTER_PREFIX` に `shift+f10` が
  抜けている（`PaneFrame.vue` の F10 サブ条件は shift 付きのときだけ発火し enter/space/down
  と同型の穴。`shift+f10` は `F_KEY` で chord 化でき `isDirectChord` も通すため `RESERVED_DIRECT`
  側にも同じ穴）→ 両方の Map に `shift+f10` を追加し、`RESERVED_DIRECT` を `Set`→`Map` へ変更
  （実装時に自分で気付いた `ctrl+shift+v` 専用の固定文言問題も合わせて解消。research F11・F12、
  decisions.md D3）。(should) `test-result.md` の AC 別判定が AC6 欠落 → AC6・AC7 を追記して
  解消。round2 は `maxTaskCheckRounds=2` の上限到達（`at_max: yes`）のため、round3 は委譲せず
  上記を直接修正し、`aidev taskcheck report T1 --findings 2` で記録。最終確認は次の review
  ラウンドに委ねる（decisions.md D3）。

## レビュー指摘（ラウンド2）

スコープ: (a) ラウンド1指摘（shift+enter/space/down）の解消確認、(b) 最新差分
（shift+f10 の予約・`RESERVED_DIRECT` の `Map` 化）の must/should のみ（協定どおり絞った）。

- [nit][conv:-] `RESERVED_DIRECT` の `Set`→`Map` 変更に伴い、`keymap.ts` 内部の
  `problems` 配列（`resolveKeymap` の戻り値）の `ctrl+shift+v` 文言が
  `.replace(/。$/, "")` 整形により読点1つ分変わった（「ので直接」→「ので、直接」）。
  `assign.ts:138-139` が返す**ユーザー向け** reason は完全一致（回帰なし）だが、
  `problems` 配列はテスト以外から参照されない内部値のため実害はゼロ。decisions.md D3 の
  「挙動を変えていない」という記述は厳密には不正確だった。 / 対応: decisions.md D3 を
  「ユーザー向け reason は不変・内部 problems は読点のみ差分」と訂正。 / src: review round2
- [nit][conv:-] `assign.test.ts`・`keymap.test.ts` の direct 側 `shift+f10` 拒否テストが
  `.toContain("pane の枠のメニュー")` のみで、design.md/test-result.md の AC7 が明言する
  「『貼り付け』を含まないことも確認」という否定側アサーションが実装されていなかった
  （検知力は実質低下していなかったが、ドキュメントの主張とテスト内容が不一致）。 /
  対応: 両テストに `.not.toContain("貼り付け")` を追加。 / src: review round2

判定: 指摘は2件とも `nit` のみ（`must`/`should` 無し）。`aidev-60-review` 手順4の
「指摘なし（または nit のみ）」に該当するため coding へは差し戻さず、上記の軽微な修正を
そのまま適用したうえで review を承認する。
