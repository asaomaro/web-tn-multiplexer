# タスク: navigate モードの移動キーを変えられるようにする

## 実装方針

下から上へ積む: (1) カタログ・予約キー（`navigateKeys.ts`）→ (2) 解決した表（`navigateKeymap.ts`）→
(3) 消費側を並行で拡張（`NavigateMode.ts`／`keyPrefs.ts`＋`assign.ts`／`store/settings.ts`）→
(4) UI・配線（`KeySettings.vue`・`HelpDialog.vue`・`main.ts`。互いに依存が無いため並行可）→
(5) 文書更新（`docs/herdr-parity.md`）。
各実装タスクの直後にそのファイルの単体テストタスクを置く（design.md 通りの分離：既存34操作の体系
（`bindings.ts`・`keymap.ts`・`ResolvedKeymap`）には一切触れない）。**例外は T14**（`main.ts` の配線。
下記「作業順序と依存関係」参照）。

`KeyPrefs.navigateKeys` を既存の `bindings` と同じ**必須**フィールドにするため（design.md のインター
フェース定義どおり。オプショナルにすると「型は通るが実行時に navigateKeys が無い」という状態が起こり得る
既存の `bindings` の扱いと非対称になる）、`emptyKeyPrefs()` の戻り値の形が変わる。これに伴い、
`KeyPrefs` を直接リテラルで組み立てている既存テスト（`emptyKeyPrefs()` を経由しない箇所）が型エラー・
アサーション不一致になる。該当箇所は事前に特定済み（T9）。**新機能ではなく型・出力形状への機械的な
追従**であり、動作は一切変えない。

## 作業順序と依存関係

下の `依存:` に従う。並行できるのは対象ファイルが重ならないペアだけ（coding 工程の手順2で判定）。

- **T9（既存テストの機械的追従）は T7 の直後に単独で片付けてから、その後続に進む**——T9 を後回しに
  すると、T7 の変更で型が壊れた既存テストが残ったまま次の実装タスクへ進むことになり、どの失敗が
  新規実装のものか既存追従漏れのものか区別しづらくなる。この制約は `依存:` にも反映済み——
  T7 に依存する後続タスク（T10・T12）は `依存:` に **T9 も含める**（対象ファイルが重ならないので
  機械的な並行判定だけでは T9 を待たずに着手できてしまうため、明示的に依存として縛る）。
- **T14（`main.ts` の配線）に対応する単体テストタスクは無い**——`main.ts` はこのリポジトリの
  composition root で、既存にも `main.ts` 単体のテストファイルが無い（`packages/web/src` 直下に
  `main.test.ts` が存在しない。他の `*.ts` 全ファイルが対応する `*.test.ts` を持つのと対照的）。
  検証は test 工程の `aidev smoke`（起動確認）に委ねる（tasks.md「テスト方針」）。

## リスク / 留意点

- `KeyPrefs` を必須フィールドで拡張するため、既存テストへの機械的な追従（T9）が漏れると
  `pnpm -s typecheck`／既存テストが赤くなる（見た目は本 work の不具合に見えるが実体は型追従漏れ）。
  T9 は対象ファイル・行番号をあらかじめ列挙してあるので、それに漏れが無いかを coding 完了時に
  `pnpm -s typecheck` の exit code で確認する（`pnpm -s` は失敗時も無出力のことがあるため、
  `; echo $?` で終了コードを必ず見る。`.aidev/conventions` 相当の既知の落とし穴）。
- `ArrowLeft`/`ArrowRight` を表の外の固定 case として残す設計（decisions D3）を `NavigateMode.ts` で
  取り違えると（＝表からも消えるが固定 case でも拾わない、または固定 case が表より先に来ず表の割り当て次第で
  無効化される、等）、AC3（既存挙動の非破壊）が壊れる。`NavigateMode.test.ts` の既存アサーションを
  1件も変更せずに通すことを T6 の完了条件にする（regression の確認そのもの）。

## テスト方針

- 各実装タスクに対応する単体テストタスクで、design.md「受け入れ基準との対応」の各 AC を検証する。
- 全体回帰（`pnpm -s typecheck`・全パッケージの単体テスト・`aidev smoke`）は test 工程で実施する
  （`aidev-50-test`）。E2E 一式は本 work では対象外（requirements「対象外」。ユーザーの明示依頼が無い）。
- 予約キー拒否（AC2）は「値ごとに落とす」既存の流儀に合わせ、正常系・境界（`shift+tab` は予約だが
  `tab` 単体と別扱いになっていないか等）を単体テストで網羅する。

## タスク

- [x] T1: navigate 6操作のカタログ・既定値・予約キー集合を新設する
      対象: 新規 `packages/web/src/keys/navigateKeys.ts`（design.md「インターフェース / データ構造 > カタログ」）
      依存: なし
      AC: AC1, AC2, AC3

- [x] T2: T1 のカタログ・予約キー集合の単体テストを書く
      対象: 新規 `packages/web/src/keys/navigateKeys.test.ts`
      依存: T1
      AC: AC2, AC3

- [x] T3: navigate 用の解決した表（`resolveNavigateKeymap`／`DEFAULT_NAVIGATE_KEYMAP`）を新設する
      対象: 新規 `packages/web/src/keys/navigateKeymap.ts` / 参考アンカー: `packages/web/src/keys/keymap.ts:68-151`
            （`resolveKeymap` の登録アルゴリズムを prefix・indexed 無しに簡約して踏襲）
      依存: T1
      AC: AC2, AC3, AC4

- [x] T4: T3 の解決した表の単体テストを書く（既定が現行固定値と1:1・予約チェック・衝突の先勝ち・
      上書きが1つ以上あるのに1つも登録できなかった操作は既定へ戻る）
      対象: 新規 `packages/web/src/keys/navigateKeymap.test.ts`
      依存: T3
      AC: AC2, AC3, AC4, AC8

- [x] T5: `NavigateMode.ts` を表から引く形に変更する。`Enter`／`Escape`／`ArrowLeft`／`ArrowRight` は
      固定 case のまま残し（`ArrowLeft`→`paneDir left`・`ArrowRight`→`paneDir right`。decisions D3）、
      それ以外は `chordOf(k)` で正規化して表（`ResolvedNavigateKeymap.actionFor`）を引く
      対象: `packages/web/src/keys/NavigateMode.ts:1-35`
      依存: T3
      AC: AC3, AC8

- [x] T6: `NavigateMode.test.ts` を更新する。**既存のアサーション（Arrow/h/j/k/l/Enter/Escape の
      入出力。現状の `NavigateMode.test.ts:12-36`）は1件も変更しない**（既定表を介しても同じ入出力に
      なることの回帰確認）。加えて、カスタム表を渡したときに別のキーへ切り替わること・表から外した
      workspace 上下キーが無反応になること・矢印左右は表の内容に関わらず常に効くことを検証する新しい
      `it` を追加する
      対象: `packages/web/src/keys/NavigateMode.test.ts`
      依存: T5
      AC: AC3, AC8

- [x] T7: `keyPrefs.ts` を拡張する（共有モジュール変更のため coding 手順5の発火条件に該当。
      taskcheck 必須）。`KeyPrefs.navigateKeys: Partial<Record<NavigateKeyId, string[]>>`（必須
      フィールド）を追加。`emptyKeyPrefs()` に `navigateKeys: {}` を追加。`normalizeNavigateBinding`
      （文字列以外・`parseChord` が読めない・`NAVIGATE_RESERVED_CHORDS` に含まれるのいずれかで `null`）
      を新設。`loadKeyPrefs`/`serializeKeyPrefs` に `navigate` サブキーの読み書きを追加（`bindings` の
      既存ループと並行する形。空なら省略）。`withNavigateBinding`/`withoutNavigateBinding` を
      `withBindings`/`withoutBindings` と同型で新設
      対象: `packages/web/src/keys/keyPrefs.ts`（既存の `bindings` 関連ロジック全域に相当する追加。
      特に `emptyKeyPrefs`(旧26行)・`loadKeyPrefs`(旧80-96行)・`serializeKeyPrefs`(旧98-111行)）
      依存: T1
      AC: AC1, AC2, AC5, AC6

- [x] T8: T7 の単体テストを書く。新規関数の正常系・境界に加え、既存の出力アサーション1箇所
      （`keyPrefs.test.ts:144` の `loadKeyPrefs` 出力の `toEqual` に `navigateKeys: {}` を追加）を直す
      対象: `packages/web/src/keys/keyPrefs.test.ts`
      依存: T7
      AC: AC1, AC2, AC5, AC6, AC8

- [x] T9: T7 の型変更に伴う、既存テストの機械的な追従（`emptyKeyPrefs()` を経由せず `KeyPrefs` を
      直接リテラルで組み立てている箇所に `navigateKeys: {}` を足す。**新機能の追加ではない**）
      対象: あらかじめ特定済みの以下の箇所（着手時に `pnpm -s typecheck` を通して漏れが無いか確認する。
      コミット時点の行番号なので多少ずれていたら周辺を検索する）——
      `packages/web/src/keys/assign.test.ts:480, 492-495, 505, 516, 522-525, 535, 537, 540, 547,
      600-603, 612` / `packages/web/src/keys/KeyRouter.test.ts:500, 512` /
      `packages/web/src/store/settings.test.ts:425, 490, 495, 540, 594` /
      `packages/web/src/components/KeySettings.test.ts:565`
      依存: T7
      AC: AC8

- [x] T10: `assign.ts` を拡張する（共有モジュール変更のため taskcheck 必須）。
      `NavigateAssignTarget`・`validateNavigateAssignment`（判定順は design.md「取り込みの検証」の
      手順1〜8。conflict は付けない）・`NavigateResetTarget`・`planNavigateReset` を新設
      対象: `packages/web/src/keys/assign.ts`（既存の `validateAssignment`/`validateBinding`/
      `planReset` と並行する新関数を追加。既存関数は変更しない）
      依存: T3, T7, T9
      AC: AC2, AC4, AC5

- [x] T11: T10 の単体テストを書く（予約キー拒否・6操作間の衝突拒否・`replacing` での自己置換・
      既定に戻す・「全操作を戻す」）。既存の34操作向けテストは変更しない（型追従は T9 で完了済み）
      対象: `packages/web/src/keys/assign.test.ts`
      依存: T10
      AC: AC2, AC4, AC5

- [x] T12: `store/settings.ts` を拡張する。`navigateKeymap` computed（`resolveNavigateKeymap(keyPrefs.value.navigateKeys)`）・
      `setNavigateKeyBindings(id, bindings)`・`resetNavigateKey(id)` を新設し、戻り値のオブジェクトに追加する
      （既存の `keyPrefs`／`keymap`／`replaceKeyPrefs`／`storage` 追従／`resetAllKeys` は無改造で流用できる
      設計。design.md「store」）
      対象: `packages/web/src/store/settings.ts:314-495`
      依存: T3, T7, T9
      AC: AC1, AC5, AC6

- [x] T13: T12 の単体テストを書く（`navigateKeymap` の初期値・`setNavigateKeyBindings`/`resetNavigateKey`
      の反映と保存・別ウィンドウの `storage` イベント追従・`resetAllKeys` で navigateKeys も既定へ戻ること）
      対象: `packages/web/src/store/settings.test.ts`
      依存: T12
      AC: AC1, AC5, AC6, AC8

- [x] T14: `main.ts` の配線を更新する。`NavigateMode` の生成時に `settings.navigateKeymap` を渡し、
      `watch(() => settings.navigateKeymap, (km) => navigateMode.setKeymap(km))` を追加する
      （`KeyRouter` と同じ流儀。design.md「main.ts の配線」）
      対象: `packages/web/src/main.ts:104-109`
      依存: T12
      AC: AC6

- [x] T15: `KeySettings.vue` に navigate 6操作の新セクションを追加する（画面操作を伴うため taskcheck
      必須）。`target` の型を `AssignTarget | NavigateAssignTarget | null` に広げ、既存の取り込み UI
      （`captureAttrs`/`onCaptureKeydown`/`endCapture`/`role="status"`）を `t.kind === "navigateKey"`
      の分岐で再利用する。［追加］ボタンは1種類（prefix/direct の区別なし）。「既定に戻す」ボタンを
      操作ごとに出す
      対象: `packages/web/src/components/KeySettings.vue`（design.md「KeySettings.vue の新セクション」）
      依存: T10, T12
      AC: AC1, AC2, AC4, AC5, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5

- [x] T16: T15 の単体テストを書く（新セクションの表示・取り込み確定・取り消し・予約キー拒否時の
      メッセージ表示・衝突拒否・既定に戻す・フォーカス遷移）
      対象: `packages/web/src/components/KeySettings.test.ts`
      依存: T15
      AC: AC1, AC2, AC4, AC5, AC-I1, AC-I2, AC-I3, AC-I4, AC-I5

- [x] T17: `HelpDialog.vue` の「移動」群を現在の割り当てから作る形に変更する（固定配列
      `NAVIGATE_ENTRIES` を computed へ。矢印左右の固定動作を「・ ←」「・ →」で明示。ヘッダー
      コメントの「固定の表記」という記述も実装に合わせて更新する）
      対象: `packages/web/src/components/HelpDialog.vue:11-12, 33-57, 71`
      依存: T12
      AC: AC7

- [x] T18: T17 の単体テストを更新する。既存の固定文言に対するアサーションを、割り当て変更後の
      表示に追従する形へ更新し、割り当てを変えたときに「移動」群の表示が変わることを検証する
      `it` を追加する
      対象: `packages/web/src/components/HelpDialog.test.ts`
      依存: T17
      AC: AC7, AC8

- [x] T19: `docs/herdr-parity.md` H26 を更新する。「対象外」列挙から navigate 移動キーの記述を外し、
      実装内容（別の表・予約キー・矢印固定）と herdr との違いを追記する（着手時に `grep -n "H26"
      docs/herdr-parity.md` で現在の行番号を確認する）
      対象: `docs/herdr-parity.md`（H26 行。行番号は着手時に確認）
      依存: T15, T17
      AC: AC9

- [x] T20: 60 review ラウンド1の must 修正①：`NavigateMode.ts` の `ArrowLeft`/`ArrowRight` 固定 case を
      「修飾キーが1つも無いときだけ」に限定する（修飾付き矢印は表引きへ通す。decisions D6）。
      回帰テストを追加し、修正前のコードで4件（本タスクとT21分）が落ちることを確認してから元に戻した
      （regression-negative-control。test-result.md 参照）
      対象: `packages/web/src/keys/NavigateMode.ts:32-41`・`NavigateMode.test.ts`
      依存: T5
      AC: AC2, AC3

- [x] T21: 60 review ラウンド1の must 修正②：`NAVIGATE_RESERVED_CHORDS` に `ctrl+shift+v` を追加する
      （`KeyInputController` がモードに関わらず貼り付けとして横取りするため、割り当てても発火しない。
      decisions D6 の隣接指摘）。加えて should 修正（`KeySettings.vue` の navigate 注記が
      `hintFor` の `null` を未解決のまま表示していた）も同じラウンドでここに含める
      対象: `packages/web/src/keys/navigateKeys.ts:77-106`・`navigateKeys.test.ts`・`assign.test.ts`・
      `packages/web/src/components/KeySettings.vue:114-121,609`
      依存: T7, T10, T15
      AC: AC2, AC1

- [x] T22: 60 review ラウンド2の should 修正：T21 の `navigateModeHint`（既定表示・`hintFor` が
      `null` のとき表記を出さない）にテストが1件も無かった。3件のテストを追加し、修正前のコードで
      回帰テストが落ちることを確認してから戻した（regression-negative-control。test-result.md
      「ラウンド3」参照）
      対象: `packages/web/src/components/KeySettings.test.ts`
      依存: T21
      AC: AC1
