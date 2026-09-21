# タスク: 新しい workspace・tab・pane を、いま見ている場所で開く（herdr の `terminal.new_cwd`）

## 実装方針

**protocol → server の純粋な部分 → server の結線 → web の設定 → web の要求 → 設定の画面 → 文書 → E2E** の順に積む。
場所を決める規則は `session/newCwd.ts` の 1 か所（design D6）に置いて単体で総当たりし、`SessionService` と `composeServer` はそれを呼ぶだけにする。
**protocol を変えたら `pnpm -C packages/protocol build` で `dist` を作り直す**——server・web は `@wtm/protocol` を `dist` から読む
（型は `dist/*.d.ts`、vitest の実行時は `dist/index.js`）。作り直さないと以降の型検査が落ち、古い `z.object` が知らない `newCwd` を黙って捨てる。
web は既定が「引き継ぐ」なので、作成の要求にはいつも `newCwd` が載る——既存の完全一致の期待値は、**変わることを先に確かめてから**直す。
これとは別に、**回帰を守るテストは条項 `regression-negative-control` のとおり「直した箇所を戻すと落ちる」ことを確かめる**（各タスクの本文に的を書いた）。

## 作業順序と依存関係

下の `依存:` に従う。依存では表せない順序の理由だけ書く。

- **E2E の一式は deliver の直前に 1 回だけ回す**（利用者の指示）。直している間と test 工程では、この work の影響を受ける spec だけを走らせる——
  作成の経路をブラウザから通る spec（新しい spec・`workspace-tab-pane.spec.ts`・`keys-mouse-dialogs.spec.ts`〔`prefix+N`・`prefix+v`〕・
  `notifications.spec.ts`〔`prefix+c`〕・`mobile.spec.ts`〔分割〕）と、設定ダイアログの `settings.spec.ts`。

## リスク / 留意点

- **E2E の合図は、実行した結果にだけ出る印**（`printf 'cd-%s\n' done`）。`echo <印>` だと打った入力のエコーで立ち、`cd` の前に作る競走になる（design）。
- **E2E は読み直しを見分けない**。読み直しの見分けはサーバの単体（`liveCwd` と `recordedCwd` が違う値のとき）で行う。
- **`Workspace.cwd` は新しい workspace のときだけ**決めた場所で作る。tab・分割では書き換えない（git の情報と worktree が使う）。
- 読み直しの reject を作成の失敗にしない（Windows で部品が読めないと、既定の「引き継ぐ」がすべて失敗する）。
- 既存の `ActionDispatcher.test.ts` の完全一致の期待値（`:108`・`:327`・`:341`・`:351`・`:715`）が変わる。

## テスト方針

- server の純粋な部分（`expandHome`・`resolveNewCwd`・`makeNewCwdDeps`）は単体で総当たり（偽の deps・偽の `ProcessInspector`/`TerminalManager`）。
- `SessionService` は偽の `TerminalManager` が記録する起動の options と、モデルの `Pane.cwd` で見る。
- web は単体（設定のストア・`buildNewCwd`・`ActionDispatcher`・設定ダイアログ）。
- E2E は新しい spec 1 本。判定はブラウザが受けたフレーム（`pwd` の出力）と DOM（トースト）。
- 負の対照: 回帰を守るテストは、直した箇所を戻して落ちることを確かめ、生の出力を `test-result.md` に貼る。

## タスク

- [x] T1: protocol に `NewCwd`（4 つの方針）を足し、`workspace.create`・`tab.create`・`pane.split` の params に `newCwd?`、結果に
      `cwdFallback?: true` を足す。スキーマのテスト（4 つの形・知らない `policy` を弾く）。**最後に `pnpm -C packages/protocol build`** で `dist` を作り直し、
      server・web の型検査が通ることを確かめる
      対象: `packages/protocol/src/messages.ts:61-70` `:83-91` `:104-112` とそのテスト / 根拠: design「インターフェース」protocol、research F8
      依存: なし
      AC: AC1, AC2, AC3, AC6, AC7, AC8, AC9
- [x] T2: `packages/server/src/session/newCwd.ts` を作る（`expandHome`・`resolveNewCwd`・`makeNewCwdDeps`）。規則は design「インターフェース」の
      「規則（ここが正典）」。上限 200ms・reject を null に・捨てた Promise の catch・代わりの 2 段・`fellBack` は follow 以外だけ・相対パスを拒む
      **負の対照**: 読み直しを外す（`liveCwd` を見ない）と「`liveCwd` と `recordedCwd` が違うとき `liveCwd` が勝つ」が落ちる、代わりの 2 段目を外すと
      「1 段目も使えなければ起動した場所」が落ちる、`makeNewCwdDeps` で別の pid を読むと落ちる
      対象: `packages/server/src/session/newCwd.ts`（新規）とそのテスト、先例 `packages/server/src/agent/AgentMonitor.ts:171-173` `:198-200` /
      根拠: design D2・D3・D4・D6・D9、research F1〜F4・F11
      依存: T1
      AC: AC1, AC2, AC3, AC5, AC6, AC7, AC8, AC9
- [x] T3: `SessionService` に `newCwdDeps?` を足し、3 つの作成が `newCwd` から決めた場所で起動し、**新しい pane の `Pane.cwd` も同じ場所**にし、
      結果に `cwdFallback` を載せる。`cwd` は `newCwd` に勝つ。`newCwdDeps` が無ければ今までどおり
      **負の対照**: `cwd` の優先を外すと「worktree の `cwd` が `newCwd` に勝つ」が落ちる、新しい pane の `Pane.cwd` を以前の値のままにすると落ちる
      対象: `packages/server/src/session/SessionService.ts:38-51` `:121-136` `:175-183` `:235-245`、`packages/server/src/session/SessionService.test.ts:54-66` /
      根拠: design D5・「振る舞いの詳細」サーバ、research F9・F12・F13
      依存: T1, T2
      AC: AC1, AC2, AC3, AC5, AC6, AC7, AC8, AC9, AC11
- [x] T4: 入口の結線。`surface/methods` が `newCwd` を `SessionService` へ渡し、`composeServer` が `makeNewCwdDeps` で deps を作って渡す
      （`defaultCwd` を 1 つの定数にして両方へ）
      対象: `packages/server/src/surface/methods/workspace.ts:8` `packages/server/src/surface/methods/tab.ts:6-8` `packages/server/src/surface/methods/pane.ts:16-23`
      `packages/server/src/composeServer.ts:121-139`、`packages/server/src/surface/methods/index.test.ts` / 根拠: design D6、research F10
      依存: T3
      AC: AC1, AC2, AC3, AC6, AC7, AC8, AC9
- [x] T5: web の設定のストアに `newCwdPolicy`（既定 "follow"）・`newCwdPath` と読み込み・保存、`buildNewCwd` を足す
      対象: `packages/web/src/store/settings.ts` とそのテスト / 根拠: design「インターフェース」web、直前の work の `store/settings.ts`
      依存: T1
      AC: AC4, AC10
- [x] T6: web の 3 つの作成（`newWorkspace`・`confirmNewTab`・`splitPane`）が `newCwd` を載せ（元の pane は design D7）、worktree を開く経路は
      載せない。応答の `cwdFallback` でトースト（無ければ出さない——AC5）。設定を変えても既存の pane に要求が出ないこと（AC10）。
      既存の完全一致の期待値は、変わることを先に確かめてから直す。
      **負の対照**: worktree に `newCwd` を付けると落ちる、元の pane（`sourcePaneId`）を載せないと落ちる
      対象: `packages/web/src/actions/ActionDispatcher.ts:42-50`（コンストラクタで設定のストアを取る） `:168-185` `:254-266` `:301-313` `:435-448`、
      `packages/web/src/actions/ActionDispatcher.test.ts:108` `:327` `:341` `:351` `:715` / 根拠: design D5・D7・「振る舞いの詳細」web
      依存: T1, T5
      AC: AC1, AC2, AC3, AC5, AC9, AC10, AC11
- [x] T7: 設定ダイアログの「端末」の節に「新しく開く場所」（ラジオ 4 つ＋指定した場所の入力欄。入力欄は `change` で保存し `input` では保存しない、
      「指定した場所」以外では `disabled`）を足す
      対象: `packages/web/src/components/SettingsDialog.vue`・`packages/web/src/components/SettingsDialog.test.ts` / 根拠: design D8
      依存: T5
      AC: AC-I1, AC-I2, AC-I4, AC-I5
- [x] T8: 文書。`docs/herdr-parity.md` の H36 を H36（シェル・起動モード）／H36b（cwd の方針。この work。置き場所が herdr と違う）に割り、
      `docs/verification.md` に方針の説明・確かめ方（`cd` → 新しい tab → `pwd`）・Windows と macOS の制約を書く
      **既存の Windows の項目**（`docs/verification.md:145-149`。「cd の後に新しい pane・tab を作っても追従しない」を既知の制約として確かめる）と
      **既知の制約のまとめ**（`:649`）は、この work で意味が変わる（「引き継ぐ」が workspace・tab にも効き、OSC 7 を出すシェルなら追従する）ので書き直す
      対象: `docs/herdr-parity.md:61`・`docs/verification.md:145-149` `:649` ほか / 根拠: design AC12・AC13・「ドメイン固有の考慮」
      依存: T3, T6, T7
      AC: AC12, AC13
- [x] T9: E2E（新しい spec 1 本）。ブラウザで `cd <dir> && printf 'cd-%s\n' done` → 合図 → 新しい workspace・tab・分割 → `pwd` を
      ブラウザが受けたフレームで読む（AC1〜AC3・AC4）。方針をホーム・起動した場所（分割で前後を見分ける）・指定した場所にしたとき（AC6〜AC8）、
      使えない場所のトーストと代わりの場所（AC9）、キーだけで方針を選んでパスを入れる（AC-I3）
      対象: `packages/e2e/src/specs/`（新規 spec）、判定は `packages/e2e/src/support/frames.ts:59`（ブラウザが受けたフレーム）。
      `packages/e2e/src/specs/reconnect-restore.spec.ts:67-106` は `pwd` を打つ手順だけを借りる（あの spec はテストのクライアントで判定しているので、判定の先例にはしない） /
      根拠: design「テストの置き方」、条項 `e2e-observe-browser`
      依存: T4, T6, T7
      AC: AC1, AC2, AC3, AC4, AC6, AC7, AC8, AC9, AC-I3
- [x] T10: 全パッケージの単体テストと、この work の影響を受ける E2E の spec を走らせて結果を記録する（**test 工程で消化する**。coding では
      未チェックのまま承認してよい）。**`pnpm build` を通してから E2E を走らせる**。E2E の一式は deliver の直前に 1 回
      対象: 未特定（走らせるだけで自前の差分を持たない）
      依存: T8, T9
      AC: なし
