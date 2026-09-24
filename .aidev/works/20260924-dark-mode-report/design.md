# 仕様: 明暗の変化を端末の中のアプリへ知らせる（DSR 996/mode 2031）

## 概要

pane の PTY 出力に現れる `CSI ? 996 n`（色スキームの問い合わせ）・`CSI ? 2031 h`/`l`
（継続通知の要求/解除）を、既存の `Mirror`（headless xterm.js）の OSC ハンドラと同じ形の
CSI ハンドラで検出し、`CSI ? 997 ; 1|2 n`（1=dark、2=light）で応答する。「今どちらの明暗で
見られているか」は、既存の色の問い合わせ（`answerPaletteFor`）と全く同じ優先順位で解決する
——新しい判定基準もクライアント→サーバの新しい通信路も作らない、サーバ側だけで完結する
変更。

## 設計方針

- **`answerPaletteFor`（既存）と解決ロジックを共有する**（research F4）。「その pane が今
  どちらの明暗で見られているか」を色の問い合わせと明暗の問い合わせで別の基準にする理由が
  無い。`answerPalette.ts` に `resolveThemeFor(paneId, deps): ThemeName | null`
  （4段階の優先順位の**結果そのもの**を返す。現状は各段階でいきなり `TERMINAL_PALETTES[...]`
  を返しており、`ThemeName` 自体は外に出てこない）を切り出し、`answerPaletteFor` はこれを
  `TERMINAL_PALETTES` で引き、新設の `answerAppearanceFor` は `THEME_APPEARANCE` で引く。
  優先順位の4段階（コメント）は変更しない——既存の `answerPalette.test.ts` の期待は保つ。
- **push のトリガーは `client.theme` RPC だけにする**（design 作成時に確認した事実——
  `packages/web/src/theme/ThemeController.ts:44-45`（クラス doc コメント）「当てる
  （`apply`）：... 名前をサーバへ」「OS の明暗を追う：`media` の change →
  `settings.systemDark` → `settings.effectiveTheme` が変われば当てる（**この `AC5` は
  `20260921-theme-settings` の受け入れ基準の番号——本書〔20260924-dark-mode-report〕の
  AC5 とは無関係**）」——**OS の `prefers-color-scheme` の自動切替も、既存の `apply()` が
  `client.theme` を送り直す既存経路に乗っており、新しいトリガーを足さなくても本書の AC2
  「OS の自動切替で変わる」は満たせる**）。`Tab.sizeOwnerClientId`/`ClientRecord.view` の
  変化（「表示者が変わったことで
  勝者の appearance が変わる」ケース）は push のトリガーに**含めない**——requirements の
  どの AC にも明記されておらず、`SizeAuthority` の複数の変化点（`onViewChanged`/
  `onFitChanged` 等）へ追加でフックすると影響範囲が広がる。そのケースでも `CSI ? 996 n` の
  オンデマンド問い合わせ（AC1）は常に最新の答えを返すため、正確性は失われない（push だけが
  即時ではなくなる）。
- **mode 2031 有効化そのものは即座に通知を送らない**（herdr の実際の挙動に合わせた——
  `scratchpad/herdr/src/pane/terminal.rs:6105-6138`（`color_scheme_queries_and_live_updates_
  follow_terminal_mode` テスト）で確認: `?2031h` の直後に同じ appearance で
  `apply_host_terminal_appearance` を呼んでも応答は無く〔`.is_none()`〕、実際に値が変わった
  ときだけ応答が出る〔`Some(...)`〕。**「値が変わったときだけ通知する」という herdr 自身の
  規則をそのまま踏襲する**——mode 2031 を要求した時点の appearance は、アプリ自身が
  `CSI ? 996 n` で明示的に問い合わせて確認する前提（実際に多くの実装がこの順で使う）。
- **RIS（`ESC c`。端末の完全リセット）で継続通知の登録も解除する**（同じ herdr のテストの
  末尾: `process_pty_bytes(..., b"\x1bc", ...)` の後は `apply_host_terminal_appearance`
  が通知を出さなくなる——RIS が `color_scheme_reporting` を含む端末状態全体をリセットする）。
  `mode2031Enabled` は xterm.js 自身のモード管理に乗らない独自のフラグ（design「依拠する
  既存の事実」）なので、`registerEscHandler({final:"c"})` で明示的にリセットする。
- **appearance が不明（未解決）という状態は作らない**（herdr は「未解決なら問い合わせにも
  応答しない」設計だが、この work では `answerAppearanceFor` が常に `"light"|"dark"` の
  どちらかを返す——既存の `answerPaletteFor` と同じく「テーマを伝えたクライアントが1つも
  無ければ既定（dracula=dark）」という既存の第4段階のフォールバックをそのまま使う。
  問い合わせに応答しないケースを作らない方が、既存の色の問い合わせとの一貫性が高い）。

## 対象範囲

- `packages/server/src/clients/answerPalette.ts`: `resolveThemeFor` を切り出し、
  `answerPaletteFor` をそれを使う形にリファクタ。`answerAppearanceFor` を新設。
- `packages/server/src/terminal/Mirror.ts`: `Mirror` インターフェースに
  `notifyAppearanceMayHaveChanged()` を追加。`XtermMirror` に CSI ハンドラ3種
  （`?996n`・`?2031h`・`?2031l`）・`ESC c`（RIS）ハンドラ・`appearance` コンストラクタ引数・
  内部状態（`mode2031Enabled`・`lastReportedAppearance`）を追加。
- `packages/server/src/terminal/TerminalHost.ts`: `appearance` コンストラクタ引数を
  `XtermMirror` へ中継するだけ（`palette` と同じ形）。
- `packages/server/src/terminal/TerminalManager.ts`: `appearanceFor` コンストラクタ引数を
  `DefaultTerminalHost` へ中継するだけ（`paletteFor` と同じ形）。
- `packages/server/src/surface/methods/client.ts`: `client.theme` ハンドラに、全 pane へ
  `notifyAppearanceMayHaveChanged()` を呼ぶ処理を追加。
- `packages/server/src/composeServer.ts`: `createPaletteSource()` を拡張（または対にする
  形で）`appearanceFor` を `TerminalManager` へ渡す配線を追加。
- 変更しない: `packages/protocol/src/theme.ts`（`THEME_APPEARANCE`/`DEFAULT_THEME_NAME` は
  既存のまま使う）・`packages/web/*`（クライアント側の変更は不要。設計方針参照）。

## 依拠する既存の事実

- `IParser.registerCsiHandler(id: IFunctionIdentifier, callback: (params) => boolean):
  IDisposable` が xterm.js headless の公開 API として存在する
  （`node_modules/.pnpm/@xterm+headless@6.0.0/node_modules/@xterm/headless/typings/
  xterm-headless.d.ts:1242`。`IFunctionIdentifier`:1208-1223）。`prefix: "?"` は私用領域
  （`\x3c`〜`\x3f`）として明示的に許可されている。`false` を返すと以前に登録されたハンドラへ
  委譲する（同:1231-1238）——research F1・F3。
- `registerEscHandler(id: IFunctionIdentifier, handler: () => boolean): IDisposable`
  も同じファイルに存在する（同:1274）。doc コメントの例（同:1266-1267）は
  `{intermediates:'%', final:'G'}` のように `prefix` を使っていない——`IFunctionIdentifier`
  の `prefix` は「CSI と DCS で使える」（同:1214）とのみ書かれ ESC は挙げられていないため、
  ESC ハンドラでは `final`（必須）だけを指定する——RIS（`ESC c`。final `c`）のフックに使う。
- `Mirror.ts:68-94`（constructor 内）に、既存の OSC ハンドラ登録（4/7/9/10/11/12）と
  「headless が標準で応じない問い合わせは独自ハンドラで応答する」という既に確立した構造が
  ある。`emitResponse`（`Mirror.ts:158-160`）→`onResponse`→`TerminalHost.ts:66`
  `this.pty.write(data)` という応答の書き戻し経路も既存（research F2・F6）。
- `answerPaletteFor(paneId, deps): TerminalPalette`（`packages/server/src/clients/
  answerPalette.ts:33-44`）が、pane の明暗の判定に使うのと全く同じ4段階の優先順位を
  既に実装している（research F4）。
- `packages/web/src/theme/ThemeController.ts:44-45`（`ThemeController` クラスの doc
  コメント）が「OS の明暗を追う：`media` の change → ... → 当てる」「当てる：... 名前を
  サーバへ」と明記しており、OS 側の `prefers-color-scheme` 変化も既存の `client.theme`
  送信経路を通ることを design 作成時に確認した（設計方針参照）。
- herdr の実際の応答規則（`scratchpad/herdr/src/pane/terminal.rs:6105-6138`
  `color_scheme_queries_and_live_updates_follow_terminal_mode` テスト。design 作成時に
  実際にテストコードを読んで確認）: (1) 問い合わせ（`?996n`）には現在値をそのまま返す、
  (2) `?2031h` を受けた直後、値が変わっていなければ通知は出ない（**mode 2031 の有効化
  そのものは通知の引き金にならない**）、(3) 実際に値が変わったときだけ通知が出る、
  (4) `ESC c`（RIS）の後は通知が止まる（継続通知の登録がリセットされる）。

## インターフェース / データ構造

### `answerPalette.ts`（リファクタ・新設）

```ts
/** 4段階の優先順位（コメントは既存のまま）で ThemeName を解決する。何も解決できなければ null。 */
function resolveThemeFor(paneId: PaneId, deps: AnswerPaletteDeps): ThemeName | null {
  const pane = deps.getPane(paneId);
  const tab = pane ? deps.getTab(pane.tabId) : undefined;
  if (tab) {
    const owner = tab.sizeOwnerClientId !== null ? deps.clients.get(tab.sizeOwnerClientId) : undefined;
    if (owner?.theme) return owner.theme;
    const viewer = latestWithTheme(deps.clients.list(), (c) => c.view?.tabId === tab.id);
    if (viewer) return viewer;
  }
  return latestWithTheme(deps.clients.list(), () => true);
}

export function answerPaletteFor(paneId: PaneId, deps: AnswerPaletteDeps): TerminalPalette {
  const name = resolveThemeFor(paneId, deps);
  return name ? TERMINAL_PALETTES[name] : DEFAULT_THEME;
}

/** 20260924-dark-mode-report。resolveThemeFor と同じ優先順位で明暗を答える。 */
export function answerAppearanceFor(paneId: PaneId, deps: AnswerPaletteDeps): "light" | "dark" {
  const name = resolveThemeFor(paneId, deps);
  return THEME_APPEARANCE[name ?? DEFAULT_THEME_NAME];
}
```

`createPaletteSource()` は `appearanceFor` も返すよう拡張する（`attach` は共通のまま）:

```ts
export function createPaletteSource(): {
  paletteFor(paneId: PaneId): TerminalPalette;
  appearanceFor(paneId: PaneId): "light" | "dark";
  attach(deps: AnswerPaletteDeps): void;
} {
  let deps: AnswerPaletteDeps | null = null;
  return {
    paletteFor: (paneId) => (deps ? answerPaletteFor(paneId, deps) : DEFAULT_THEME),
    appearanceFor: (paneId) => (deps ? answerAppearanceFor(paneId, deps) : THEME_APPEARANCE[DEFAULT_THEME_NAME]),
    attach: (d) => { deps = d; },
  };
}
```

### `Mirror.ts`（拡張）

```ts
export interface Mirror {
  // ...既存のまま
  /** 20260924-dark-mode-report。継続通知（mode 2031）が有効な pane へ、appearance が
   *  前回と変わっていれば通知する。変わっていなければ・無効なら何もしない。 */
  notifyAppearanceMayHaveChanged(): void;
}

export class XtermMirror implements Mirror {
  // ...既存のフィールドに追加
  private mode2031Enabled = false;
  private lastReportedAppearance: "light" | "dark" | null = null;

  constructor(
    cols: number, rows: number, scrollback: number,
    private readonly palette: () => TerminalPalette = () => DEFAULT_THEME,
    private readonly appearance: () => "light" | "dark" = () => THEME_APPEARANCE[DEFAULT_THEME_NAME],
  ) {
    // ...既存の内容に追加:
    this.disposables.push(this.term.parser.registerCsiHandler({ prefix: "?", final: "n" }, (params) => this.handleAppearanceQuery(params)));
    this.disposables.push(this.term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (params) => this.handleMode2031(params, true)));
    this.disposables.push(this.term.parser.registerCsiHandler({ prefix: "?", final: "l" }, (params) => this.handleMode2031(params, false)));
    this.disposables.push(this.term.parser.registerEscHandler({ final: "c" }, () => { this.mode2031Enabled = false; return false; }));
  }

  notifyAppearanceMayHaveChanged(): void {
    if (!this.mode2031Enabled) return;
    const next = this.appearance();
    if (next === this.lastReportedAppearance) return;
    this.lastReportedAppearance = next;
    this.emitResponse(appearanceReport(next));
  }

  // 常に false を返して委譲する（decisions.md D2——review round1 must。CSI は複数の Pm を
  // 束ねて送れる〔例 `?2031;1049h`〕うえハンドラは LIFO・true で連鎖停止するため、単純に
  // 「対象 Ps なら true」にすると束ねられた他のモードの処理を止めてしまう）。
  private handleAppearanceQuery(params: (number | number[])[]): boolean {
    if (params.includes(996)) {
      const current = this.appearance();
      this.lastReportedAppearance = current; // 問い合わせでも「最後に伝えた値」を更新する
      this.emitResponse(appearanceReport(current));
    }
    return false;
  }

  private handleMode2031(params: (number | number[])[], enable: boolean): boolean {
    if (params.includes(2031)) {
      this.mode2031Enabled = enable;
      // 有効化した時点の値を基準として捕捉する（通知はしない。decisions.md D1——coding 中の
      // テストで発見: これが無いと、事前に問い合わせが無い場合 lastReportedAppearance が null
      // のままで、有効化しただけで「変わった」と誤検知してしまう）。
      if (enable) this.lastReportedAppearance = this.appearance();
    }
    return false;
  }
}

function appearanceReport(a: "light" | "dark"): string {
  return a === "dark" ? "\x1b[?997;1n" : "\x1b[?997;2n";
}
```

`TerminalHost`/`TerminalManager` は `palette` と同じ形で `appearance`/`appearanceFor` を
1引数増やして中継するだけ（コード例は省略。既存の `palette`/`paletteFor` の配線をそのまま
複製する）。

### `client.ts`（push のトリガー）

```ts
surface.register("client.theme", {
  schema: ClientThemeParams,
  handler: (ctx, params) => {
    deps.clients.setTheme(ctx.clientId, params.theme);
    // 20260924-dark-mode-report: 継続通知を要求している pane へ、明暗が変わっていれば知らせる。
    for (const pane of deps.session.snapshot().panes) {
      deps.terminals.get(pane.id)?.mirror.notifyAppearanceMayHaveChanged();
    }
    return {};
  },
});
```

## 振る舞いの詳細

1. **問い合わせ（AC1）**: pane の PTY 出力に `CSI ? 996 n` が現れる → `handleAppearanceQuery`
   が `appearance()`（＝`answerAppearanceFor(paneId, deps)`。`resolveThemeFor` の4段階の
   優先順位で解決した `ThemeName` から `THEME_APPEARANCE` で引く）を呼んで即座に応答する。
   `lastReportedAppearance` も更新する（以後の継続通知の「変わったか」の基準点にする）。
2. **継続通知の登録（AC2・AC3）**: `CSI ? 2031 h` → `mode2031Enabled = true`（即座には通知
   しない）。`CSI ? 2031 l` → `mode2031Enabled = false`。
3. **通知（AC2）**: `client.theme` RPC を受けるたびに、全 pane の `Mirror.
   notifyAppearanceMayHaveChanged()` を呼ぶ。`mode2031Enabled` が false ならその場で何もしない
   （O(1)）。true なら現在の `appearance()` を再評価し、`lastReportedAppearance` と異なれば
   応答を書き戻す。OS の自動切替（`prefers-color-scheme`）も、既存の `ThemeController` が
   `client.theme` を送り直す経路に乗るため、同じ仕組みでそのまま伝わる。
4. **pane ごとの独立性（AC5）**: `mode2031Enabled`/`lastReportedAppearance` は
   `XtermMirror` インスタンスのフィールド（pane ごとに1インスタンス）——他の pane に影響しない。
5. **破棄時の後始末（AC4）**: 新しい状態はどちらも `XtermMirror` インスタンスのフィールドで、
   `dispose()` はインスタンスごと消える既存の経路（`TerminalHost.dispose()`→`Mirror.
   dispose()`）にそのまま乗る。新しい後始末コードは不要。
6. **RIS（`ESC c`）でのリセット**（どの AC にも直接紐づかない、herdr との挙動一致を目的とした
   追加——「受け入れ基準との対応」参照）: `mode2031Enabled = false` にする（herdr と同じ挙動）。
   `lastReportedAppearance` はリセットしない（次に mode 2031 が再度有効化されたとき、
   「前回問い合わせに答えた値」を基準にするのは herdr の挙動と矛盾しない——herdr のテストも
   `apply_host_terminal_appearance` の値そのものはリセットしていない）。

## ドメイン固有の考慮

- **herdr との差異（意図的）**: herdr は appearance が未解決のとき問い合わせに応答しない。
  この work は既存の `answerPaletteFor` と同じく「解決できなければ既定（dracula=dark）」に
  フォールバックする——常に何かを答える。既存の色の問い合わせとの一貫性を優先した（設計方針）。
- **push のトリガー範囲を `client.theme` だけに絞ったこと**は、herdr のホストと1対1の
  ローカル端末という前提（1つのホストの明暗だけを扱えばよい）と違い、web-tn-multiplexer は
  複数クライアント・複数 pane が絡む分だけ、全トリガーを漏れなく拾おうとすると複雑になる
  ——設計方針の理由をそのまま踏襲。

## エラー処理 / 異常系

- `params` に `996`/`2031` が含まれない CSI `?...n`/`?...h`/`?...l`: 何もせず `false` を
  返して委譲する（既存の他の私用シーケンスを壊さない。research F3・実装時の注意）。
- `996`/`2031` が他の Pm と同じ CSI に束ねられている（`?2031;1049h` 等）: 対象の副作用だけ
  実行し、**マッチしてもしなくても常に `false` を返して委譲する**（decisions.md D2。
  `true` を返すと束ねられた他のモードの処理が止まってしまうため）。
- `client.theme` の処理中に pane が既に破棄されていた: `deps.terminals.get(pane.id)` が
  `undefined` を返すので `?.` で素通りする（既存の防御パターン）。
- headless の CSI/ESC ハンドラは try/catch で囲まれない（`Mirror.ts:56` のコメント）ため、
  新しいハンドラも例外を投げない実装にする（数値比較と関数呼び出しだけなので、通常は
  投げる要素が無い）。

## 受け入れ基準との対応

- AC1: 「振る舞いの詳細」手順1・インターフェース節「Mirror.ts」の `handleAppearanceQuery`。
- AC2: 「振る舞いの詳細」手順2・3。OS の自動切替は「設計方針」で確認した既存の
  `ThemeController`/`client.theme` 経路にそのまま乗る。
- AC3: 「振る舞いの詳細」手順2（`CSI ? 2031 l`）。
- AC4: 「振る舞いの詳細」手順5。既存の pane 破棄の経路にそのまま乗る。
- AC5: 「振る舞いの詳細」手順4。pane ごとに独立した `XtermMirror` インスタンス。
- AC6: 対象範囲に無い箇所（既存の OSC/DSR ハンドラ・テーマ切替・pane 操作）は一切変更しない
  （対象範囲節）。test 工程で既存テストの無改修実行により確認する。
- （AC 番号なし）「振る舞いの詳細」手順6（RIS `ESC c` でのリセット）は、requirements.md の
  どの AC にも直接は紐づかない——herdr の実際の挙動（依拠する既存の事実）に合わせた追加の
  正確性向上で、`AC3`（`CSI ? 2031 l` での明示的な解除）とは別の経路（端末リセット）からも
  同じ「通知が止まる」結果を保証する。coding では実装し、test では確認するが、独立した AC
  としては requirements に立てない（RIS は非常に稀な操作で、これ単体を独立の受け入れ基準に
  するほどの重みは無いと判断）。
