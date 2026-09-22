# 調査: キーの設定の使い勝手

## 調査の問い

- Q1: 絞り込み（US1）は既存の `actionsByGroup` のどこに差し込めるか。
- Q2: 衝突の「こちらへ移す」（US2）は、衝突の判定・理由のどこから情報を得られるか。
  「移せる」条件（AC7）を機械的に判定できる形の情報が既存の戻り値にあるか。
- Q3: `getLayoutMap()`（US3）は具体的に何を返すか。macOS 判定は既存にあるか。
- Q4: Keyboard Lock（US4）は具体的にどう呼ぶか。全画面の検知・既存の似た構造（OS の明暗検知）は
  どんな形か。

## 判明した事実

### 共通

- F1: 節「キー」は `packages/web/src/components/KeySettings.vue`（611 行）1 ファイルに実装が
  まとまっている（script setup + template + scoped style）。
- F2: 操作の一覧は `actionsByGroup`（computed。`KeySettings.vue:36-38`）が
  `GROUPS.map((group) => ({ group, actions: ACTIONS.filter(...) }))` で作る。`GROUPS`
  （`KeySettings.vue:35`）は `["全体", "workspace / tab", "pane"]` の固定 3 要素。
  template（`:337-343`）は `v-for="g in actionsByGroup"` で群を、その中で `g.actions` を
  `v-for` して `<details>` を並べる。**絞り込みは `actionsByGroup` の計算に絞り込み条件を足すだけ**
  で実現できる（`GROUPS.map` の中で `actions` を絞り込み文字列でさらに `filter` し、0 件の群は
  `.filter((g) => g.actions.length > 0)` で除けばよい）。

### US1（絞り込み）

- F3: `ActionDef`（`packages/web/src/keys/bindings.ts:12-21`）は `id`・`label`・`group`・
  `defaults`・`helpHidden?` を持つ。絞り込みの一致対象にできるのは `label`（画面に出す名前）と
  `group`（群名。3 種）。`id`（`split_vertical` 等の内部名）は画面に出ていないので対象外
  （requirements のスコープどおり）。
- F4: `<details>` の開閉状態はブラウザのネイティブ属性（`open`）で、Vue 側で状態を持っていない
  （`KeySettings.vue:346` `<details class="keys-details" :data-action="def.id">` に `open` の
  バインディングが無い）。絞り込みで一覧の要素が増減しても、残った `<details>` の開閉状態は
  そのまま保たれる（DOM 要素自体は削除されず、`v-for` の key（`def.id`）で追跡されるため）。

### US2（こちらへ移す）

- F5: 衝突の判定は `packages/web/src/keys/assign.ts` の `validateBinding`
  （`:111-177`）にある。範囲でない chord・範囲の chord いずれも `chords = indexed ?
  expandRange(chord) : [chord]`（`:158`）で列挙し、各 `c` について `km.ownerOf(via, c)`
  （`:166`）を引く。`owner !== id`（別の操作が使っている）のとき
  `{ ok: false, reason: "${display(via,c)} は「${labelOf(owner)}」がすでに使っています。" }`
  （`:168-172`）を返す。**`AssignResult`（`assign.ts:44-45`）は現状 `reason` という文字列しか
  持たず、衝突相手の id・via・chord を**構造化した形**では返していない**——「こちらへ移す」を
  機械的に実装するには、この分岐に `conflict: { ownerId, via, chord }` のような構造化フィールドを
  足す必要がある（design への申し送り）。
- F6: `km.ownerOf(via, chord)`（`keymap.ts` の `ResolvedKeymap` インターフェース。`:56`）は
  その chord を使っている `ActionId` を返す（範囲の操作なら、展開した個々の chord がすべて同じ
  owner id を指す）。**owner の「持っている chord の並び」（`bindingsOf(ownerId)`）の中に、
  衝突した chord と完全一致する文字列があるかどうかで「移せるか」を判定できる**——完全一致
  すれば単純に `owner` から `withoutBindings`/`setKeyBindings` でその 1 件を外し、対象へ足せる。
  完全一致しない（owner の割り当てが範囲で、衝突した chord がその一部だけのとき）は、1 件だけを
  安全に外す手段が無い（`withBindings`/`withoutBindings` は文字列の配列を丸ごと置き換える設計。
  `keyPrefs.ts` に「範囲から 1 個だけ外す」関数は無い）——このケースは requirements AC7 で
  「移す先が単一の chord として特定できない」として対象外にした根拠。
- F7: `apply()`（`KeySettings.vue:123-140`）が既存の「割り当てを確定して store へ渡す」処理。
  `t.replacing` があるとき（＝［変更］の置き換え）は、置き換え後にフォーカスを
  `findChangeButton(t.id, binding)`（`:142-146`）で新しい割り当ての［変更］ボタンへ送る
  （`:138-139`）。「こちらへ移す」も同種の操作（衝突相手から外し、対象へ足す＝置き換えに近い）
  なので、この既存パターン（新しい割り当ての［変更］へフォーカス）を流用できる（design への申し送り。
  requirements AC-I9 の「候補」はこの事実に基づく）。
- F8: `describeSkip`（`KeySettings.vue:213-217`）・`message.value` への代入はすべて同期的な文字列
  組み立てで、確認ダイアログを挟む操作は `askResetAll`/`confirmResetAll`（`:266-283`。「すべて
  既定に戻す」だけ）に限られる。「こちらへ移す」を確認ダイアログ無しの即時実行にする設計
  （requirements AC5・AC-I7）は、既存の大多数の操作（削除・変更・追加）と同じ流儀。

### US3（macOS の Option chord 表示）

- F9: `navigator.keyboard.getLayoutMap()`（2026-09-22 に MDN
  <https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap> を取得して確認）は
  `Promise<KeyboardLayoutMap>` を返す。`KeyboardLayoutMap` は `code`（`"KeyW"` 等の物理キー）→
  そのキーが今のキー配列で打つ文字（例：フランス語配列なら `"KeyW"` → `"z"`）の Map 状オブジェクト。
  **実験的機能・Limited availability・Not Baseline**（Chromium 系のみ、Firefox・Safari は非対応）。
  **セキュアコンテキスト（HTTPS）必須**。呼び出し自体に事前の許可は不要だが、
  Permissions Policy で拒否されると `SecurityError` を投げうる（feature-detect + try/catch が要る）。
- F10: macOS 判定はすでに `packages/web/src/term/MouseBridge.ts:53` の `isMacPlatform()`
  （`navigator.userAgentData?.platform || navigator.platform` を `/mac|iphone|ipad|ipod/i` で
  判定）としてエクスポートされている。`packages/web/src/main.ts:100` で
  `setOptionComposes(isMacPlatform())`（`chord.ts` の Option 文字化け復元を macOS だけで有効化）に
  既に使われている——**US3 も同じ関数を再利用すればよい**（新規の判定ロジックを作らない）。
- F11: 表示専用の変換であるべき理由：`chord.ts:242-245` のコメントが「取り込みと照合は同じ変換を
  通るので、動作はそろう」と明記——`chordOf`/`parseChord`/保存される chord 文字列（`alt+w` 等）は
  一切変えず、**画面に出す文字列だけ**を `code` から逆引きした表示用の文字へ置き換える設計に
  なる（requirements AC10 の根拠）。
- F12: chord 文字列から「英字の chord なら対応する `code`」への逆引きは
  `chord.ts` の `chordToKeyInput`（`:388-415`）が持つロジックと同じ形（`/^[a-z]$/.test(p.key) ?
  \`Key${p.key.toUpperCase()}\` : ...`）を使えば求まる（`chordToKeyInput` 自体は `KeyInput` を
  作る関数で、コード生成部分だけを再利用するか、同等の対応表を持てばよい）。
- F13: chord の表示が出る箇所は複数ある：節「キー」の一覧（`bindingsText`/`summaryText`。
  `KeySettings.vue:48-51`）・キー一覧（ヘルプ）・トースト・通知の案内文・モバイルの Prefix
  ボタンの案内（いずれも `keymap.ts` の `hintFor` や、各所が `bindingsOf`/`prefix` を直接文字列化
  している）。**requirements のスコープは「節「キー」の表示」に絞られていない**——backlog の
  文言は「Option の chord の表示」と広めに書かれている。design で対象範囲（節「キー」だけか、
  ヘルプ・トースト等も含むか）を確定する必要がある（design への申し送り。**未確認**：
  ヘルプ・トースト・通知の文言生成コードは本調査では読んでいない）。

### US4（Keyboard Lock）

- F14: `navigator.keyboard.lock(codes?)`（2026-09-22 に MDN
  <https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/lock> を取得して確認）は
  引数省略で全キーをロック、`code` の配列を渡すとその一覧だけをロックする（複数回呼ぶと最新の
  指定だけが有効）。**Transient user activation が必須**（「ユーザーがページや UI 要素を操作した
  結果として呼ばれる必要がある」）。**セキュアコンテキスト必須**。実験的・Limited availability。
  `unlock()` で解除。
- F15: 全画面状態の検知に使える `document.fullscreenElement`・`fullscreenchange` イベントは、
  本製品では**まだ一切使われていない**（`grep -rn "fullscreen\|Fullscreen" packages/web/src` が
  0 件）。全画面への入退場自体（`requestFullscreen()`）も本製品のコードには無い——利用者は
  ブラウザ既定の全画面操作（F11・ブラウザメニュー）を使う前提（requirements の対象外どおり）。
- F16: OS の明暗の検知（`matchMedia` の `change` イベント）に、既存の**専用コントローラークラス**
  パターンがある：`packages/web/src/theme/ThemeController.ts`。
  - コンストラクタで依存（`settings` ストア・DOM 参照・副作用関数）を注入（`ThemeControllerOptions`。
    `:27-37`）——テストで偽物に差し替えられる形。
  - `start()`（`:56-86`）：初期状態を反映し、`media.addEventListener("change", onChange)` を登録
    しつつ `this.stops.push(() => media.removeEventListener(...))` で後始末を積む。Vue の `watch`
    でストアの派生状態を追う。
  - `stop()`（`:89-91`）：`this.stops` を全部実行して聞くのをやめる（テスト用）。
  - `main.ts:159-172` で `new ThemeController({...})` を作り `.start()` を呼ぶ（`app.mount` より
    前）。
  この構造は US4 の「`fullscreenchange` を聞いて `lock()`/`unlock()` を呼ぶ」ものと同型
  （`matchMedia` の変化 → 副作用、を `document` の `fullscreenchange` の変化 → 副作用、に
  置き換えるだけ）。**新規に `KeyboardLockController`（仮）を同じ形で作れる**（design への申し送り）。
- F17: `store/settings.ts` に opt-in の switch を 1 つ足す実装は、既存の
  `showAgentLabelsOnPaneBorders`・`hideTabBarWhenSingleTab` 等（20260922-tabbar-pane-appearance）
  と同型の「boolean の ref + `load*`/`set*` 関数 + `storage` イベントでの追従」パターンで作れる
  （既存の store のコードは本調査では該当ファイルを開いていないため、正確な `file:line` は design
  で確認する。**未確認**）。

## 影響範囲

- `packages/web/src/components/KeySettings.vue`: 絞り込み欄・「こちらへ移す」ボタン・
  macOS 表示置き換えの呼び出し、いずれもこのファイルが中心。
- `packages/web/src/keys/assign.ts`: `AssignResult`/`validateBinding` に構造化された衝突情報を
  足す（F5）。
- `packages/web/src/keys/chord.ts`: 表示用の変換関数を新規に足す（F12 を使う。取り込み・照合の
  既存関数は変えない）。
- `packages/web/src/keys/`（新規ファイル、名称は design で決める）: `KeyboardLockController`
  相当（F16 のパターンを踏襲）。
- `packages/web/src/store/settings.ts`・`packages/web/src/main.ts`: Keyboard Lock の opt-in
  switch の永続化と、コントローラーの生成・`start()` 呼び出し。

## 実現性 / リスク

- US1・US2 は既存の構造（`actionsByGroup`・`validateBinding`・`apply`）への局所的な拡張で、
  実現性は高い。
- US3・US4 はいずれも Chromium 系限定・実験的 API で、**実機（Chrome/Edge の macOS・全画面）での
  確認が必須**（自動テストは Linux Chromium の headless 環境で `getLayoutMap`/`keyboard.lock` が
  そもそも使えない可能性が高く、feature-detect の分岐＝「無いときの経路」しか自動では検証できない
  見込み。`docs/verification.md` の手動確認へ引き継ぐ）。
- US4 は transient user activation の要件（F14）が `fullscreenchange` イベント内の呼び出しで
  満たされるか、一次資料だけでは確定できない（requirements の未確定事項どおり）。design で
  実装しつつ確認し、満たされない場合の代替（例：全画面に入った直後に出す通知やボタンを経由する等）
  を検討する。

## 実装アンカー

- A1: 群と一覧の計算 — `packages/web/src/components/KeySettings.vue:35-38`（`GROUPS`・
  `actionsByGroup`）。
- A2: 衝突判定 — `packages/web/src/keys/assign.ts:111-177`（`validateBinding`）、特に
  `:166-172`（owner 判定の分岐）。
- A3: 置き換え後のフォーカス送り先の既存パターン — `packages/web/src/components/KeySettings.vue:123-146`
  （`apply`・`findChangeButton`）。
- A4: macOS 判定の既存関数 — `packages/web/src/term/MouseBridge.ts:53`（`isMacPlatform`）。
- A5: 表示専用変換であるべき根拠 — `packages/web/src/keys/chord.ts:242-245`（既知の制約の
  コメント）。
- A6: chord 文字と `code` の対応の既存ロジック — `packages/web/src/keys/chord.ts:388-415`
  （`chordToKeyInput`）。
- A7: 同型のコントローラークラスの実例 — `packages/web/src/theme/ThemeController.ts` 一式・
  `packages/web/src/main.ts:159-172`（生成・起動）。

## design への申し送り

- `AssignResult` への構造化フィールド追加（F5）の具体的な型・命名。
- macOS chord 表示の対象範囲（節「キー」だけか、ヘルプ・トースト・通知・モバイルの Prefix ボタンも
  含むか。F13）。
- `store/settings.ts` の switch 追加パターンの正確な `file:line`（F17。design 時に確認する）。
- `KeyboardLockController`（仮称）の正確なインターフェース（`ThemeController` を手本にする。F16）。
- transient user activation の条件を `fullscreenchange` ハンドラ内の呼び出しで満たせるかどうかの
  設計判断（満たせない場合の代替案。上記「実現性 / リスク」参照）。
