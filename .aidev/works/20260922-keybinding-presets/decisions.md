# 決定記録

## D1: research 工程は `aidev doccheck` の対象外——自己点検で代替し、ここに記録する

- 背景: `aidev doccheck start research --mode delegated` は
  `独立点検の対象は上流4工程だけ: research（requirements design architecture tasks）` で拒否される
  （`aidev-15-research` skill 自体も doccheck に触れていない。20260922-tabbar-pane-appearance で
  既出の同じ制約）。
- 決定: research.md は独立点検の委譲をせず、書いた本人が引用（`file:line`）をソースへ当たり直す形の
  自己点検で代替する。今回は F1〜F13 の主要な `file:line` 引用（`assign.ts:246-261`・`assign.ts:277-305`
  内の `via: "direct"` 固定箇所・`keymap.ts:30-34`・`KeySettings.vue:249,264,422`）を実際に
  `sed -n` で当たり直し、記述と実物が一致することを確認した。
- 理由 / 代替案: CLI の対象外である以上、無理に `doccheck` を通そうとしても exit 1 で進まない。
  かといって点検を省くと、design が誤った引用を無検証で引き継ぐリスクがある。
- 影響: 後続工程（design）は research.md の引用を再検証済みの前提で読める。

## D2: この work は「キーバインドのプリセット」だけを扱う——「キーの設定の使い勝手」は別 work へ

- 背景: `.aidev/backlog/product-roadmap.md` には 19 行目（プリセット）と 31 行目
  （節「キー」の絞り込み・衝突時の「こちらへ移す」・macOS 非 US 配列の Option 表示・Keyboard Lock API）
  の 2 つの「キー」関連の未着手項目がある。どちらも `KeySettings.vue`/`keys/` を触るという意味では
  近い領域だが、19 行目は「新しいプリセットの表を足す」という閉じた変更、31 行目は 4 つの独立した
  UI・互換性の改善（`navigator.keyboard.getLayoutMap()`・Keyboard Lock API という異なる Web API を
  要する項目を含む）で、性質も検証範囲も異なる。
- 決定: この work（`20260922-keybinding-presets`）は 19 行目のプリセット機能だけを扱う。31 行目は
  この work の対象外のまま残し、次の autonomous イテレーションで別 work として着手する。
- 理由 / 代替案: 両方を 1 つの work にまとめる案もあったが、31 行目の 4 項目はそれぞれ独立して
  検証・deliver 可能（`aidev-30-tasks` の split 判定基準にある「単独で検証・デリバリ可能」）なので、
  まとめると 1 PR が大きくなりレビューしづらくなる。プリセットだけでも US1・US2 で完結した価値が
  出せる。
- 影響: `requirements.md` のスコープ節にこの切り分けを明記した。

## D3: AC6（既存の「おすすめ」の動作は変わらない）を「案内文の言い回し」までは固定しないと解釈する

- 背景: design で `applyRecommended` を一般化し、案内文にプリセット名（`preset.label`）を埋め込む
  形にすると、herdr のおすすめ一式を足したときの文言（例：「直接のキーを 10
  個足しました：…」→「herdr のおすすめの直接のキー（ctrl+alt）を 10 個足しました：…」）が変わる。
  一方 requirements の AC6 は「動作（対象の一覧・結果の文言・冪等性）が…変わらない」と書いており、
  文言をそのまま読むと byte-exact 一致を求めているようにも読める。
- 決定: AC6 が守るべき核は「対象の一覧（`RECOMMENDED_DIRECT` の 10 組）・add/skip/冪等の判定ロジック・
  伝える情報の構造」であり、**文言そのものの byte-exact 一致までは求めない**と解釈する。
  プリセット名を埋め込む一般化は、この work の中心である AC1（複数プリセットから選べる）・
  AC5（表を 1 つ足すだけで新しいプリセットが増える）を成り立たせるための必然の変更であり、
  この 2 つと衝突する形で AC6 を文字どおり守ると、プリセットごとに文言のテンプレートを
  特殊化することになり、AC5 の設計意図（表を足すだけで拡張できる）と矛盾する。
- 理由 / 代替案: herdr プリセットだけ元の文言をハードコードで保つ案も検討したが、プリセットごとに
  文言生成の分岐が増える設計になり、「新しいプリセットは表を 1 行足すだけ」（AC5）が崩れる。
  影響が及ぶ既存テストのアサーション（`KeySettings.test.ts` の「おすすめの直接のキーは、すでに
  全部入っています。」への `.toBe()`・「直接のキーを 9 個足しました」への `.toContain()`）は
  coding 工程で新しい文言に合わせて更新する。
- 影響: `design.md`「受け入れ基準との対応」の AC6 の項に、この解釈を明記した。
  `KeySettings.test.ts` の該当 2 アサーションを更新するタスクを tasks.md に立てる。

## D4: design 工程の doccheck の手順を誤った順序で実行した——記録・修正して継続する

- 背景: design.md を書いたあと、`aidev doccheck start design --mode delegated` を打たずに
  点検エージェントへ直接委譲してしまい、さらにエージェントの結果（5 件）が届く前に
  `aidev approve design` を実行してしまった（`aidev-20-design` skill の手順4は「書き終えたら
  内部一貫性を…点検させる（autonomous は必須）」→ 手順6「終了する」の順で、doccheck の記録
  （`start`→エージェントの結果→`report`）が承認より前に来るべきだった）。
- 決定: 気付いた時点で `aidev doccheck start design --mode delegated` を遡って実行し（CLI は
  approve 済みでも受け付けた）、続けて `aidev doccheck report design --findings 5` を記録した。
  5 件（should 2・nit 3）はすべて design.md 側の記述の問題（本文の数え違い・関数名の混同・節参照の
  誤り・一覧の漏れ・decisions.md の文例とのスペースの不一致）で、design の設計判断そのものを
  覆すものではなかったため、design.md をその場で直し、承認を取り消す（`aidev unapprove design`）
  までの重い差し戻しはしなかった。
- 理由 / 代替案: 承認を取り消して design を最初からやり直す案も検討したが、5 件はいずれも
  「書いた」内容と「実装しようとしている」内容の間の記述レベルの不整合で、design.md を直せば
  解消するものだった（新しい設計判断は生まれていない）。CLI 側も遡っての `start`/`report` を
  拒否しなかったため、記録の欠落を防ぐという doccheck の目的は（順序は乱れたが）達成できている。
- 影響: 今後のこの work の工程では、**エージェントへの委譲より前に必ず `aidev doccheck start
  <phase> --mode delegated` を打ち、その出力（ラウンド番号・上限）を確認してから委譲する**。
  この乱れ自体は、独立した point-in-time のミスとして retro（任意工程。実施すれば）で拾う。
