# 決定記録

## D1: T1 の負の確認（規約 `regression-negative-control.md`）

- 手順: `RESERVED_AFTER_PREFIX` の新設3エントリ（`enter`・`space`・`down`）を一時的に削除し、
  `assign.test.ts`・`keymap.test.ts` を実行 → 新設した2テストが期待どおり失敗することを確認
  → 元に戻し、`git diff --stat` が `packages/web/src/keys/keymap.ts | 5 +++++`（変更前と
  同一）であることを確認 → 再実行して全88テストが pass することを確認。
- 失敗ログ（抜粋）:
  ```
  FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)）
        > (c) prefix の後の Enter・Space・↓ も拒否する（pane の枠のメニューが先に取るので、
        割り当てても効かない。20260925-pane-frame-focus-keys）
  Error: 通ってしまった: prefix+enter
   ❯ reason src/keys/assign.test.ts:44:19

  FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
        予約：prefix の後の Enter・Space・↓ は落とす（pane の枠のメニューが先に取る。
        20260925-pane-frame-focus-keys）
  AssertionError: expected [ Array(4) ] to deeply equal [ 'ctrl+alt+z' ]
  - Expected
  + Received
    [
  +   "prefix+enter",
  +   "prefix+space",
  +   "prefix+down",
      "ctrl+alt+z",
    ]

   Test Files  2 failed (2)
        Tests  2 failed | 86 passed (88)
  ```
- 結論: 新設テストは実際に `RESERVED_AFTER_PREFIX` の3エントリに依存しており、意味を持つ
  回帰検知になっている。復元後の差分・pass 件数（88/88）も確認済み。

## D2: review 指摘（must）への対応——shift 付きの Enter/Space/ArrowDown も予約する

- 背景: review（1回目）で、`PaneFrame.vue:239-240` の `onKeydown` の判定
  （`if (!opens || ev.ctrlKey || ev.altKey || ev.metaKey) return;`）が `ev.shiftKey` を
  見ていないため、`shift+enter`・`shift+space`・`shift+down` も同じ穴（pane の枠に
  Tab フォーカスが残っている間、理由不明にキーが効かない）を持つという `must` 指摘を
  受けた。`chord.ts` の `parseChord` の shift 禁止規則は数字・記号の1文字だけが対象で、
  `enter`/`space`/`down` のような名前付きキーには掛からないため、これらの shift 付き
  chord は画面から実際に取り込み・保存できる有効な値であり、当初の3エントリだけでは
  防げていなかった。
- 対応: `RESERVED_AFTER_PREFIX` に `shift+enter`・`shift+space`・`shift+down` の3エントリを
  追加（計6エントリ）。`research.md` F3 を訂正（「修飾キー付きは無条件で bubble」という
  誤った一般化を、「ctrl/alt/meta 付きは bubble、shift のみは bubble しない」に訂正）し、
  F10 を新設（`chord.ts` の shift 禁止規則の適用範囲の根拠）。`requirements.md`
  （目的・対象・機能要件・AC6を新設）・`design.md`（設計方針・依拠する既存の事実・
  インターフェース・振る舞いの詳細・AC6）・`tasks.md`（T1の対象・AC・テスト方針）を
  この修正に合わせて更新した。
- 負の確認（regression-negative-control.md）: 新設した `shift+enter`・`shift+space`・
  `shift+down` の3エントリを一時的に削除し、`assign.test.ts`・`keymap.test.ts` を実行 →
  新設した shift 付きテスト2件が期待どおり失敗（無修飾の既存テストは影響を受けない）ことを
  確認。失敗ログ（抜粋）:
  ```
  FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)）
        > (c) prefix の後の Shift+Enter・Shift+Space・Shift+↓ も拒否する（PaneFrame.vue の
        onKeydown は ctrl/alt/meta だけを見て shift は見ないので、shift 付きも枠に止められる。
        review 指摘）
  Error: 通ってしまった: prefix+shift+enter

  FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
        予約：prefix の後の Enter・Space・↓（shift 付きも含む）は落とす…
  AssertionError: expected [ 'prefix+shift+enter', …(3) ] to deeply equal [ 'ctrl+alt+z' ]

   Test Files  2 failed (2)
        Tests  2 failed | 87 passed (89)
  ```
  → 元に戻し、`git diff --stat` が `packages/web/src/keys/keymap.ts | 8 ++++++++`（6エントリ
  追加後の状態と同一）であることを確認 → 再実行して全89テストが pass することを確認。

## D3: T1 taskcheck round2（上限到達）の指摘への対応——Shift+F10 の予約漏れ・`RESERVED_DIRECT` の固定文言

- 背景: T1 の taskcheck は `maxTaskCheckRounds=2` で、round1 は `CHECK:ok, FINDINGS:0`
  だったが、review round1 の `must` 指摘（D2）を反映した差分に対する round2 で2件の指摘
  （`must` 1件・`should` 1件）を受けた。round2 が上限（2/2）のため、これ以上の
  taskcheck ラウンドは委譲せず、指摘を直接直したうえでこの D3 に経緯を残し、検証は
  60 review（次のラウンド）に委ねる（`aidev-40-coding` 手順5「上限で止まったら深追いしない」
  規約どおり）。
- 指摘1（must、要旨）: `RESERVED_AFTER_PREFIX` に `shift+f10` が抜けている。
  `PaneFrame.vue:239-240` の `opens` 条件のうち F10 だけは `(ev.key === "F10" &&
  ev.shiftKey)` という自分専用のサブ条件を持ち、shift 付きのときだけ発火する——enter/space/down
  と同じ形の穴が F10 にもある。さらに `chord.ts` の F キーは `NAMED_KEYS` ではなく独立した
  `F_KEY` 正規表現（`chord.ts:122`）で扱われるため `shift+f10` は chord として正規に
  生成・読み戻しでき、`isDirectChord("shift+f10")`（`chord.ts:282-286`）も `true` を返すため、
  `RESERVED_DIRECT`（当時は変更なしの想定）側にも同じ穴があった。
- 私自身の独立検証: `chord.ts:122` の `F_KEY` 正規表現（`/^[fF]([1-9]|1[0-9]|2[0-4])$/`）・
  `chordOf` の F-key 分岐（shift を保持したまま `name = key.toLowerCase()`）・
  `normalizeKeyToken` の F_KEY 受理経路・`isDirectChord` の正確な実装
  （`return p.ctrl || p.alt || p.cmd || F_KEY.test(p.key);`）を実際にファイルを読んで
  再確認し、指摘が正確であることを確認した（無印の `f10` は `PaneFrame.vue` の F10 サブ条件が
  shift を要求するため安全なままであることも確認）。
- 指摘2（should、要旨）: `test-result.md` の AC 別判定節が AC1〜AC5 までしかなく、AC6
  （review round1 で追加）が抜けている。→ 本 D3 の後続で test-result.md を更新して解消する。
- **実装時に自分で発見した追加の問題**（指摘1の対応中に判明。research F12）:
  `RESERVED_DIRECT` は当初 `ReadonlySet<string>` で、参照側2か所
  （`assign.ts:138-139`・`keymap.ts:126-127`）が「〜は貼り付けに使うので、直接のキーに
  できません。」という **`ctrl+shift+v` 専用の固定文言をハードコード**していた。指摘どおり
  `shift+f10` を `RESERVED_DIRECT` にそのまま足すと、画面に「shift+f10 は貼り付けに使うので、
  直接のキーにできません。」という**事実と異なる理由**が出てしまう。これは taskcheck の
  指摘には無かったが、修正を実装する過程で自分で気づいた（`assign.ts` を実際に読んで
  `RESERVED_DIRECT.has(chord)` の呼び出し元を確認した）ため、`RESERVED_DIRECT` の型を
  `RESERVED_AFTER_PREFIX` と同じ `ReadonlyMap<string, string>` へ変更し、参照側2か所を
  `.get()` ベースへ書き換えた（design「設計方針」「インターフェース / データ構造」参照）。
- 対応:
  - `RESERVED_AFTER_PREFIX` に `shift+f10` を8番目のエントリとして追加し、コメントを
    F10 の特殊性（shift 付きのときだけ発火・`F_KEY` で表現できる・ContextMenu との違い）を
    説明する形に更新。
  - `RESERVED_DIRECT` を `Set(["ctrl+shift+v"])` から `Map([["ctrl+shift+v", …],
    ["shift+f10", …]])` へ変更し、`assign.ts:138-139`・`keymap.ts:126-127` の参照を
    `.get()` ベースへ書き換え。**ユーザー向けの拒否理由**（`assign.ts:138-139` が返す
    `reason`）は `ctrl+shift+v` について変更前と完全一致（review round2 で確認）。
    `keymap.ts` 内部の `problems` 配列（`resolveKeymap` の戻り値。`packages/web/src` 内で
    `.keymap` しか参照されずテスト以外に読まれない）は、`RESERVED_AFTER_PREFIX` と同じ
    `.replace(/。$/, "")` 整形へそろえた結果、読点が1つ増える（「ので直接」→「ので、直接」）
    ——実害は無いが、review round2 の `nit` 指摘で判明。当初「挙動は変えていない」と書いたのは
    不正確だったため、この段落で訂正する。
  - `assign.test.ts` に4件のテストを追加: prefix の後の `shift+f10` 拒否（1件）・直接の
    `shift+f10` 拒否（1件、理由が「pane の枠のメニュー」を含み「貼り付け」を含まないことを
    確認）。
  - `keymap.test.ts` の既存の shift 付き回帰テストへ `prefix+shift+f10` を追加し
    `problems` の期待件数を6→7に更新、直接の `shift+f10` 単独の新設回帰テストを1件追加。
  - `research.md` F5 を訂正（F10 は ContextMenu と違い `F_KEY` で表現できる）・F11
    （F10 のサブ条件・direct 側の穴）・F12（`RESERVED_DIRECT` の固定文言問題）を新設。
  - `requirements.md`（目的・US1・対象・対象外・機能要件・非機能要件・AC7 新設）・
    `design.md`（概要・設計方針・対象範囲・依拠する既存の事実・インターフェース /
    データ構造・振る舞いの詳細・受け入れ基準との対応 AC4/AC5/AC7）・`tasks.md`
    （T1 の対象・AC・リスク/留意点・テスト方針）をこの修正に合わせて更新した。
- 負の確認（regression-negative-control.md）: `RESERVED_AFTER_PREFIX` から `shift+f10` の
  エントリを削除し、`RESERVED_DIRECT` を旧 `Set(["ctrl+shift+v"])` へ戻し、`assign.ts`・
  `keymap.ts` の参照を旧来の `.has()`＋固定文言へ一時的に戻した状態で
  `assign.test.ts`・`keymap.test.ts` を実行 → 新設した4テストが期待どおり失敗し、無改修の
  既存88テストは影響を受けないことを確認。失敗ログ（抜粋、実際の出力そのまま）:
  ```
  FAIL  src/keys/assign.test.ts > validateAssignment — prefix の後のキー（AC4・AC6 (a)(b)(c)）
        > (c) prefix の後の Shift+F10 も拒否する（…T1 round2 taskcheck 指摘）
  Error: 通ってしまった: prefix+shift+f10
   ❯ reason src/keys/assign.test.ts:44:19

  FAIL  src/keys/assign.test.ts > validateAssignment — 直接のキー（AC5・AC6 (d)(f)(g)）
        > (f) Shift+F10 は pane の枠のメニューを開くキーとして使うので拒否する（…）
  Error: 通ってしまった: shift+f10
   ❯ reason src/keys/assign.test.ts:44:19

  FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
        予約：prefix の後の Enter・Space・↓（shift 付きも含む）・Shift+F10 は落とす（…）
  AssertionError: expected [ 'prefix+shift+f10', 'ctrl+alt+z' ] to deeply equal [ 'ctrl+alt+z' ]

  FAIL  src/keys/keymap.test.ts > resolveKeymap — 上書きと衝突（AC4・AC6・AC8。D7） >
        予約：直接の Shift+F10 も落とす（…）
  AssertionError: expected [ 'shift+f10', 'ctrl+alt+z' ] to deeply equal [ 'ctrl+alt+z' ]

   Test Files  2 failed (2)
        Tests  4 failed | 88 passed (92)
  ```
  → 元に戻し（`RESERVED_AFTER_PREFIX` に `shift+f10` を復元、`RESERVED_DIRECT` を `Map` 化、
  参照側2か所を `.get()` ベースへ復元）、`git diff --stat` が
  `packages/web/src/keys/assign.ts | 4 ++--` `packages/web/src/keys/keymap.ts | 26
  +++++++++++++++++++++++---`（一時的な巻き戻し前と同一の差分規模）であることを確認 →
  再実行して全92テストが pass することを確認。`pnpm -s typecheck` も exit 0 を確認
  （exit code で判定。出力の有無だけで判断しない）。
- taskcheck ラウンド上限についての明示: T1 の `taskcheck` は round2 で上限（2/2）に到達し、
  round2 は `should`（test-result.md の AC6 欠落）を含め2件の指摘があったため、CLI の規約上
  round3 は実行できない（`aidev taskcheck start T1` は exit 4 で拒否される）。上記の対応は
  round2 の指摘をこの D3 に基づいて直接修正したものであり、**T1 について追加の taskcheck
  ラウンドは委譲していない**。この修正が指摘を正しく解消できているかの最終確認は、次の
  review ラウンド（review round1 が既に1回入っているため round2 相当）に委ねる。
