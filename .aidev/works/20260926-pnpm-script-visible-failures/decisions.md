# 決定記録

## D1: 原因調査（requirements 前の investigative work）で判明した2段構えの根本原因

- 背景: backlog の記述（「pnpm -s の再帰実行は失敗時に何も出力せず終了コードだけが変わる」）が
  具体的にどの条件で起きるか・なぜ起きるかが書かれていなかったため、requirements を書く前に
  最小の pnpm workspace（`/tmp/silent-probe2`）を作って実測した。
- 判明した事実（1段目）: `pnpm -s <script>`（`-r` で複数パッケージを対象）は、**対象パッケージが
  2つ以上のとき**だけ、子プロセスの出力を失敗時も含めて完全に抑制する。1パッケージだけなら
  子プロセスの出力は残る（pnpm 自身の飾り行だけが消える）。実測ログ（抜粋）:
  ```
  # 1パッケージのみ（pkgA だけ）
  $ pnpm -s probe
  THIS SHOULD BE VISIBLE ON FAILURE
  EXIT:1
  # 2パッケージ（pkgA + pkgB）
  $ pnpm -s typecheck
  EXIT:1    ← 出力なし
  ```
- 判明した事実（2段目。実装中に発見）: 対応として `scripts/run-quiet.mjs` を書き、内部で
  `pnpm -r --filter=./packages/* run typecheck` を spawn する方式にしたところ、**`-s` を付けた
  ときだけ**依然としてラッパーのバナー行しか出ず、中身（tsc のエラー）が消えたままだった。
  `process.env` をダンプして原因を特定: `pnpm run <script>` は `-s` 付き実行時に
  `npm_config_reporter=silent` という環境変数を子プロセスへ渡しており、ラッパーがこれを
  そのまま継承して内部の `pnpm -r …` を spawn していたため、**その内側の pnpm も silent
  reporter で動いてしまい、ラッパーが捕まえる前に子の出力そのものが無くなっていた**
  （1段目と同じ症状が、ラッパーの内側でもう一度再発していた）。
- 対応: `scripts/run-quiet.mjs` が子プロセスを spawn するとき、`process.env` から
  `npm_config_reporter`・`npm_config_loglevel` を明示的に削除した環境変数を渡す。これにより
  `-s` の有無に関わらず、内部で spawn する pnpm は常に非 silent で動き、ラッパーが出力を
  正しく捕まえられるようになった。
- 副次的に検討した仮説（誤りと判明）: 最初は「`process.stdout.write` が非同期のパイプで、
  `process.exit` を呼ぶ前に書き切れていない（stdout 打ち切りによる欠落）」という仮説を立て、
  write のコールバックを待ってから `process.exit` する修正を先に入れたが、それだけでは直らな
  かった（`npm_config_reporter` の継承が真因）。ただし write を待ってから exit する変更自体は
  正しい安全策なので、実装にはそのまま残した（実害は無く、pnpm を経由しない直接呼び出し時の
  安全性を上げる）。
- 影響: `test`（`vitest run`）・`lint`（`eslint . --ext .ts`）はこの一連のバグの対象外
  （pnpm の recursive runner を経由しないため、実測でも問題なし）。requirements/design の
  「対象外」に反映済み。

## D2: T1 の負の確認（規約 `regression-negative-control.md`）

- 手順（review round1 の差し戻し後に全面的にやり直した。D7 参照）: `packages/protocol/src/index.ts`
  に型エラーを一時的に仕込み、下記 A〜F を実行 → 型エラーを戻し、`cmp` で元のファイルと一致する
  ことを確認 → G・H を実行。E は `package.json` を HEAD の形（ラッパー無し）へ、F は
  `scripts/run-quiet.mjs` から `delete childEnv…` の2行だけを外した形へ一時的に戻して実行し、
  どちらも実行後に `cmp` で修正版と一致することを確認してから元に戻した。
- 生ログ: 各コマンドの標準出力・標準エラー出力をファイルへリダイレクトし、その中身をそのまま
  （`cat` で）この節へ差し込んでいる（手で書き起こさない。D6 参照）。

  **A. `pnpm -s typecheck`（壊れた状態・修正後）** — exit 2:
  ```
  run-quiet: 失敗しました（exit 2）。捕捉した出力:
  Scope: 5 of 6 workspace projects
  packages/protocol typecheck$ tsc --noEmit -p tsconfig.typecheck.json
  packages/protocol typecheck: src/index.ts(11,7): error TS2322: Type 'number' is not assignable to type 'string'.
  packages/protocol typecheck: Failed
  /workspaces/web-tn-multiplexer/packages/protocol:
   ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @wtm/protocol@0.1.0 typecheck: `tsc --noEmit -p tsconfig.typecheck.json`
  Exit status 2
  ```

  **B. `pnpm -s build`（壊れた状態・修正後）** — exit 1（AC2 の本体）:
  ```
  run-quiet: 失敗しました（exit 1）。捕捉した出力:
  Scope: 5 of 6 workspace projects
  packages/protocol build$ tsc -b
  packages/protocol build: src/index.ts(11,7): error TS2322: Type 'number' is not assignable to type 'string'.
  packages/protocol build: Failed
  /workspaces/web-tn-multiplexer/packages/protocol:
   ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @wtm/protocol@0.1.0 build: `tsc -b`
  Exit status 1
  ```

  **C. `pnpm typecheck`（`-s` 無し・壊れた状態・修正後）** — exit 2。`-s` 無しでは素通しなので
  バナーは付かず、pnpm 自身の出力がそのまま流れる:
  ```

  > wtm-workspace@0.1.0 typecheck /workspaces/web-tn-multiplexer
  > node scripts/run-quiet.mjs "pnpm -r --filter=./packages/* run typecheck"

  Scope: 5 of 6 workspace projects
  packages/protocol typecheck$ tsc --noEmit -p tsconfig.typecheck.json
  packages/protocol typecheck: src/index.ts(11,7): error TS2322: Type 'number' is not assignable to type 'string'.
  packages/protocol typecheck: Failed
  /workspaces/web-tn-multiplexer/packages/protocol:
   ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @wtm/protocol@0.1.0 typecheck: `tsc --noEmit -p tsconfig.typecheck.json`
  Exit status 2
   ELIFECYCLE  Command failed with exit code 2.
  ```

  **D. `pnpm build`（`-s` 無し・壊れた状態・修正後）** — exit 1:
  ```

  > wtm-workspace@0.1.0 build /workspaces/web-tn-multiplexer
  > node scripts/run-quiet.mjs "pnpm -r --filter=./packages/* run build"

  Scope: 5 of 6 workspace projects
  packages/protocol build$ tsc -b
  packages/protocol build: src/index.ts(11,7): error TS2322: Type 'number' is not assignable to type 'string'.
  packages/protocol build: Failed
  /workspaces/web-tn-multiplexer/packages/protocol:
   ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @wtm/protocol@0.1.0 build: `tsc -b`
  Exit status 1
   ELIFECYCLE  Command failed with exit code 1.
  ```

  **E. 負の確認1: `package.json` を HEAD の形（ラッパー無し）に戻して `pnpm -s typecheck`** —
  exit 2、出力0バイト（元のバグの再現）:
  ```
  ```

  **F. 負の確認2: `scripts/run-quiet.mjs` から `delete childEnv.npm_config_reporter` /
  `delete childEnv.npm_config_loglevel` の2行だけを外して `pnpm -s typecheck`** — exit 2。
  バナー行だけが出て中身が空（D1 の2段目: 継承した `npm_config_reporter=silent` で内側の pnpm も
  黙る。review round1 の指摘で追加）:
  ```
  run-quiet: 失敗しました（exit 2）。捕捉した出力:
  ```

  **G. 型エラーを戻した状態で `pnpm -s typecheck` / `pnpm -s build`** — どちらも exit 0、
  出力0バイト（回帰なし）:
  ```
  ```

  **H. 型エラーを戻した状態で `pnpm build`（`-s` 無し・成功）** — exit 0。途中経過と vite の
  警告がそのまま流れる（review round1 の指摘1: 修正前のラッパーではここが全部消えていた）:
  ```

  > wtm-workspace@0.1.0 build /workspaces/web-tn-multiplexer
  > node scripts/run-quiet.mjs "pnpm -r --filter=./packages/* run build"

  Scope: 5 of 6 workspace projects
  packages/protocol build$ tsc -b
  packages/protocol build: Done
  packages/server build$ tsc -b
  packages/web build$ vue-tsc --noEmit -p tsconfig.typecheck.json && vite build
  packages/server build: Done
  packages/web build: vite v8.3.0 building client environment for production...
  packages/web build: transforming...
  packages/web build: ✓ 268 modules transformed.
  packages/web build: rendering chunks...
  packages/web build: computing gzip size...
  packages/web build: dist/index.html                   0.61 kB │ gzip:   0.44 kB
  packages/web build: dist/assets/index-BqjkBMvx.css   34.48 kB │ gzip:   6.12 kB
  packages/web build: dist/assets/index--OTmYgSe.js   898.95 kB │ gzip: 253.88 kB
  packages/web build: [plugin builtin:vite-reporter] 
  packages/web build: (!) Some chunks are larger than 500 kB after minification. Consider:
  packages/web build: - Using dynamic import() to code-split the application
  packages/web build: - Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
  packages/web build: - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
  packages/web build: ✓ built in 1.70s
  packages/web build: Done
  packages/cli build$ tsc -b
  packages/cli build: Done
  ```
- 結論: 修正は E（ラッパー無し）と F（環境変数を消さない）の両方で落ちる形の検査で裏付けられて
  いる。`packages/protocol/src/index.ts`・`package.json`・`scripts/run-quiet.mjs` はいずれも `cmp`
  で元と一致することを確認済み。

## D3: requirements doccheck round2（上限到達）の指摘への対応

- 背景: requirements の doccheck は `maxDocCheckRounds=2`。round1（5件: must2・should2・nit1）を
  修正して round2 を回したところ、round2 でも4件（must1・should3）の指摘を受けた。round2 が
  上限（2/2）のため、これ以上の doccheck ラウンドは委譲せず、指摘を直接直したうえでこの D3 に
  経緯を残す（`aidev-40-coding` の taskcheck 上限時の扱いに準じる。requirements/design/tasks の
  doccheck にも同じ「上限で止まったら深追いしない」規約が適用されると判断——後続の review 工程で
  文書の整合を最終確認する）。
- round2 の指摘4件と対応:
  1. (must) 「背景/課題」の backlog 引用に含まれる「（この work で誤った結論を decisions.md に
     書き、後で訂正した）」という注記が、引用元（20260918-web-terminal-multiplexer）自身の
     経緯なのか、本 work（20260926）の経緯なのか、文脈上あり得ない読み（本 work の decisions.md
     はその backlog 行が書かれた時点でまだ存在しない）を許してしまっていた。→ 引用直後に
     「「この work」は出典元の20260918自身を指す」という明示的な注記を追加した。
  2. (should) 「Linux（CI・手元）」節の参照が、背景（「太字『CI』で始まる段落」）と対象外
     （単に「CI 段落」）とで表記が揃っていなかった（round1 で「統一した」としていたが実際には
     対象外側の修正が漏れていた）。→ 対象外側も「太字『CI』で始まる段落」に揃えた。
  3. (should) 「exit code」の呼び方が、機能要件/AC1（「プロセスの終了コード」）と非機能要件/AC3
     （英語表記の「exit code」のまま）とで割れていた（round1 の修正が機能要件/AC1 にしか及んで
     いなかった）。→ 非機能要件・AC3 も「終了コード」に統一した（背景節の記述的な `exit code`
     言及は、pnpm 自体の挙動を説明する記述であり本件の対象外と判断し、そのまま残した）。
  4. (should) 機能要件が「`pnpm build`（`-s` 無し）が失敗しても出力が残る」ことを明記している
     のに、対応する AC が無かった（AC2 は `-s` ありの build だけ、AC5 は typecheck の `-s` 有無
     透過性だけを見ていた）。→ AC5 を「typecheck・build の両方について `-s` 有無どちらでも
     出力が残る」ことを確認する形に拡張し、build の `-s` 無しケースもここでカバーされるようにした。
- 上限到達についての明示: requirements の doccheck は round2 で上限（2/2）に到達し、round2 も
  4件の指摘があったため、CLI の規約上 round3 は実行できない。上記の対応は round2 の指摘を
  この D3 に基づいて直接修正したものであり、requirements について追加の doccheck ラウンドは
  委譲していない。この修正が指摘を正しく解消できているかの最終確認は、design/tasks/coding の
  各 doccheck・taskcheck、および review 工程に委ねる。

## D4: design doccheck round2（上限到達）の指摘への対応——build の型検査依存・グロブ説明の誤り

- 背景: design の doccheck も `maxDocCheckRounds=2`。round1（6件: must3・should2・nit1。
  「対象外」という存在しない節への参照・lint/`npm_config_loglevel` の未検証の断定・疑似コードと
  異常系節の不一致・異常系の AC 欠落・AC1 のファイル実在未確認）を修正して round2 を回したところ、
  round2 でも2件（must1・should1）の指摘を受けた。round2 が上限（2/2）のため、これ以上の
  doccheck ラウンドは委譲せず、指摘を直接直したうえでこの D4 に経緯を残す
  （D3 と同じ扱い。review 工程で最終確認する）。
- 指摘1（must）: AC2・AC5 が「`packages/protocol/src/index.ts` に型エラーを仕込めば `build` も
  失敗する」という前提に依存しているのに、その前提（protocol の `build` スクリプト自体が
  型検査を伴うこと）を「依拠する既存の事実」がどこにも述べていなかった。
  → 私自身の独立検証: `packages/protocol/package.json` を実際に読み、`build` スクリプトが
  `"tsc -b"`（TypeScript のプロジェクトビルドモード。型検査を伴い、型エラーがあれば失敗する）
  であることを確認した。加えて、本 work の初期投機的調査（negative control 実施時）で実際に
  `pnpm -s build`／`pnpm build` の両方が同じ型エラーで失敗することを実測済みだった
  （D2 の負の確認ログ・後続の「pnpm build（no -s）」実測で確認済み）。指摘は正確だったため、
  この事実を「依拠する既存の事実」に追記した。
- 指摘2（should）: 「インターフェース / データ構造」節が、外側の二重引用符の役割を
  「グロブ展開を防ぐ」と説明していたが、疑似コード・振る舞いの詳細の記述だけからはその論拠が
  繋がらないという指摘。
  → 私自身の独立検証: `bash -c 'echo --filter=./packages/*'`・`bash -c 'echo x=./packages/*'`が
  いずれもパターンを展開せずそのまま出力し、一方 `bash -c 'echo ./packages/*'`（`--filter=` 等の
  prefix 無し）は5パッケージへ展開されることを実際に確認した。原因はグロブのパス segment 単位の
  マッチング規則——`--filter=./packages/*` の最初の path segment は `--filter=.` であり、
  そのようなディレクトリは存在しないため、既定の非 nullglob 動作でパターン全体が無展開のまま
  残る。**これは引用符の有無と無関係**で、当初の design.md の説明（「二重引用符がグロブ展開を
  防ぐ」）は誤りだった。実際の二重引用符の役割は、`pnpm -r --filter=./packages/* run typecheck`
  という文字列全体を `node scripts/run-quiet.mjs` への**1つの引数**としてまとめること
  （無ければ空白区切りで分割され、`process.argv[2]` が `"pnpm"` だけになってしまう）。
  design.md を訂正し、実測した具体的なコマンドと結果を明記した。
- 上限到達についての明示: design の doccheck は round2 で上限（2/2）に到達し、round2 も2件の
  指摘があったため、CLI の規約上 round3 は実行できない。上記の対応は round2 の指摘をこの D4 に
  基づいて直接修正したものであり、design について追加の doccheck ラウンドは委譲していない。
  この修正が指摘を正しく解消できているかの最終確認は、tasks/coding の doccheck・taskcheck、
  および review 工程に委ねる。

## D5: T1 taskcheck round1 の指摘への対応

- 指摘1（must、`conv:regression-negative-control!`）: 上記 D2 の「実測ログ」が、当初は
  `wc -c`/`wc -l` 相当の行数・バイト数と exit code だけの記載で、規約が明示的に禁じる
  「要約への置き換え」になっていた。「落ちたか」の外形は示していたが「何が落ちたか」を
  検証可能にしていなかった。
  → taskcheck が実機で再現して提示した実際の生ログ（`Scope: 5 of 6 workspace projects`・
  `packages/protocol typecheck: src/index.ts(11,7): error TS2322: ...`・
  `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` 等）を私自身も手元の `/tmp/wrapper-out*.txt`・
  `/tmp/negcontrol-out*.txt`・`/tmp/build-no-s.txt` で再確認し、D2 の該当箇所を上記の
  生テキストへ差し替えた（`pnpm build`（-s 無し）の完全な出力も追加）。
- 指摘2（should）: `scripts/run-quiet.mjs` の `close` イベントで、本体（body）の
  `process.stdout.write` だけがコールバックを待ってから `process.exit` していたが、
  同じハンドラ内のシグナル終了メッセージと `error` ハンドラのメッセージはコールバックを
  待たずに直後で `process.exit` していた——ファイル自身のコメントが述べる安全策
  （「write のコールバックを待たずに exit すると出力が途中で切れる可能性がある」）が
  一部にしか適用されていなかった。
  → `error` ハンドラ・シグナル終了メッセージの両方も、`process.exit` の前に
  `write` のコールバックを待つよう統一した。修正後、負の確認（型エラーを仕込む→
  `pnpm -s typecheck`・`pnpm -s build` で出力が残ることを確認→戻す→無出力で
  exit 0 に戻ることを確認）を再実行し、回帰が無いことを確認した。

## D6: T1 taskcheck round2（上限到達）の指摘への対応——負の確認ログの真正性

- 背景: T1 の taskcheck も `maxTaskCheckRounds=2`。round1（2件: must1・should1。D5 で対応済み）を
  修正して round2 を回したところ、round2 でも2件（should1・nit1、いずれも `regression-
  negative-control` 関連）の指摘を受けた。round2 が上限（2/2）のため、これ以上の taskcheck
  ラウンドは委譲せず、指摘を直接直したうえでこの D6 に経緯を残す（review 工程で最終確認する）。
- 指摘1（should、`conv:regression-negative-control`）: D2 の「実際の標準出力の生テキスト」
  として貼っていた3ブロック（`git stash pop` 再現・`pnpm typecheck`（-s無し）・`pnpm build`
  （-s無し））が、内容自体は正しいものの、`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`・
  `ELIFECYCLE` の前後に pnpm が実際に出す U+2009（THIN SPACE）を、手で書き起こした際に
  通常の半角スペース（U+0020）に変えてしまっていた。
  → 私自身の独立検証: `packages/protocol/src/index.ts` に同じ型エラーを再度仕込み、
  `pnpm -s typecheck`/`pnpm typecheck`/`pnpm -s build`/`pnpm build` を実際に実行して出力を
  ファイルへリダイレクトし、`cat -A`/`grep -o` で `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` の前後に
  `M-bM-^@M-^I`（UTF-8 で U+2009 を表すバイト列）が実在することを確認した。その上で、D2 の
  該当ブロックを**手で書き起こすのではなく**、実際のコマンド出力ファイルの内容をそのまま
  （`cat` で）decisions.md へ差し込む形で全面的に貼り直した（`grep`/`cat -A` で最終的な
  decisions.md 側にも同じ U+2009 のバイト列が残っていることを確認済み）。型エラーを仕込んだ
  `packages/protocol/src/index.ts` は都度 `diff` で元の内容と一致することを確認してから
  元に戻した。
- 指摘2（nit）: D2 の「結論」が `package.json` の `git diff --stat` 一致確認だけを明記しており、
  規約が明示的に求める「（型エラーを仕込んで戻した）ファイルが元と一致することを diff/cmp で
  確認する」という手順の実施記録が無かった。
  → 「結論」に `packages/protocol/src/index.ts` の `diff` による一致確認を明記した
  （上記の指摘1対応時に実際に `diff /tmp/index.ts.bakOrig packages/protocol/src/index.ts` で
  確認済み。出力なし＝一致）。
- 上限到達についての明示: T1 の taskcheck は round2 で上限（2/2）に到達し、round2 も2件の
  指摘があったため、CLI の規約上 round3 は実行できない。上記の対応は round2 の指摘をこの D6 に
  基づいて直接修正したものであり、T1 について追加の taskcheck ラウンドは委譲していない。
  この修正が指摘を正しく解消できているかの最終確認は、次の review 工程に委ねる。

## D7: review round1 の指摘への対応——`-s` 無しの挙動を元に戻す

- 指摘1（should）: ラッパーが `-s` の有無に関わらず常にバッファしていたため、`-s` 無しの
  `pnpm build`／`pnpm typecheck` も成功時の出力が全部消え、途中経過もストリームされなくなっていた
  （vite の進捗・「Some chunks are larger than 500 kB」警告が見えない）。requirements は `-s` 時の
  挙動しか定めておらず、`-s` 無しの挙動を変えることは合意していなかった。
  → 私自身の検証: ルート `package.json` に一時的な検証用スクリプトを足し、`npm_config_reporter` が
  `pnpm -s` では `silent`、`pnpm`（無指定）では未設定、`pnpm --reporter=append-only` では
  `append-only` になることを確認した。そのうえで、ラッパーは `npm_config_reporter === "silent"`
  のときだけバッファし（環境変数も消す）、それ以外は `stdio: "inherit"` で素通しする形に変えた。
  D2 の H で `-s` 無しの成功時に vite の出力が流れることを確認済み。
  requirements.md・design.md に `-s` 無しは素通し（挙動を変えない）であることを明記した。
- 指摘2（should）: D1 の2段目（`npm_config_reporter` を消さないと内側でも出力が消える）に負の確認の
  生ログが無かった → D2 の F として追加した。
- 指摘3（should）: test-result が「4パターンの生ログ」と書くのに `pnpm -s build` 失敗時の生ログが
  無かった → D2 の B として追加し、test-result を実物に合わせた。
- 指摘4〜6（nit）: `scripts/run-quiet.mjs` 冒頭コメントに `npm_config_loglevel` を名前で挙げ防御的
  削除である旨を明記／test-result の他 OS の論拠から無関係な design 参照を外した／本ファイルの節を
  D1〜D7 の番号順に並べ替えた。
