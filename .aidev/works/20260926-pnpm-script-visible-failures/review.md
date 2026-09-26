# レビュー: pnpm のスクリプトを「失敗が見える」形にする

## タスク点検ログ（`aidev-40-coding` 手順5）

- [T1][round1] CHECK:findings FINDINGS:2 — (must, `conv:regression-negative-control!`)
  decisions.md D2 の負の確認ログが行数・バイト数だけの要約になっていて規約違反 →
  実際の生ログへ差し替え。(should) `scripts/run-quiet.mjs` の `close` イベントで、本体の
  write だけがコールバックを待ってから `process.exit` していた（シグナル終了メッセージ・
  `error` ハンドラのメッセージが未対応）→ 両方とも write のコールバックを待つよう統一。
  対応の詳細は decisions.md D5。
- [T1][round2] CHECK:findings FINDINGS:2 — (should, `conv:regression-negative-control`)
  D2 の生ログ3ブロックが、pnpm 自身が出す U+2009（THIN SPACE）を手起こしの際に半角スペースへ
  変えてしまっていた（内容は正しいが真の生コピーではなかった）→ 実際のコマンド出力ファイルを
  そのまま貼り直し、`cat -A` で該当バイト列の存在を確認。(nit) D2「結論」に、型エラーを
  仕込んで戻した `packages/protocol/src/index.ts` の diff 一致確認の記載が無かった →
  明記した。round2 は `maxTaskCheckRounds=2` の上限到達（`at_max: yes`）のため、round3 は
  委譲せず上記を直接修正し、`aidev taskcheck report T1 --findings 2` で記録。最終確認は
  次の review ラウンドに委ねる（decisions.md D6）。

## レビュー指摘（ラウンド1）

- [should][conv:-] `-s` 無しの `pnpm build`／`pnpm typecheck` も成功時の出力が全部消え、途中経過もストリームされなくなった（vite の進捗・chunk サイズ警告が見えない）。要件は `-s` 時の挙動しか定めておらず、`-s` 無しの挙動変更は未合意 / 対応: `npm_config_reporter === "silent"` のときだけバッファし、それ以外は `stdio: "inherit"` で素通しにする / src: review round1
- [should][conv:regression-negative-control!] D1 の2段目（`npm_config_reporter` を消さないとラッパー内部でも出力が消える）に負の確認の生ログが無い / 対応: `delete` を外した状態の再現ログを D2 に追加 / src: review round1
- [should][conv:regression-negative-control!] test-result が「4パターンの生ログ」と書くのに、D2 に `pnpm -s build` 失敗時の生ログが無い / 対応: D2 に追加し、test-result の記述を実物に合わせる / src: review round1
- [nit][conv:-] `scripts/run-quiet.mjs` 冒頭コメントの「この2つ」が1つしか名前を挙げていない / 対応: `npm_config_loglevel` を明記し、防御的な削除であることを添える / src: review round1
- [nit][conv:-] test-result の他 OS の論拠が design の無関係な節を参照している / 対応: 参照を外し、論拠を本文に書く / src: review round1
- [nit][conv:-] decisions.md の節順が D1・D2・D5・D3・D4・D6 / 対応: 番号順に並べ替え / src: review round1

## レビュー指摘（ラウンド2）

スコープ: (a) ラウンド1の6件の解消確認、(b) ラウンド1後の修正差分の must/should。
(a) は6件とも解消を確認（`pnpm build`（-s 無し）で vite の出力が流れることを実機で確認、D2 の A〜H を一字一句再現、E・F の負の確認も再現）。(b) に must/should は無し。

- [nit][conv:-] decisions.md D2 の生ログが、2字下げの箇条内の2字下げフェンスの中に0字下げで貼られており、CommonMark ではリスト項目が途中で終わって表示が崩れる / 対応: フェンス内のログ行を2字下げした（字下げ以外の内容は不変であることを diff で確認。U+2009 も保持）/ src: review round2

判定: nit のみのため差し戻さず、上記を修正して review を承認する。
