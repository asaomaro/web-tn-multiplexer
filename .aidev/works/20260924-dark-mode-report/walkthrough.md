# レビューガイド: 明暗の変化を端末の中のアプリへ知らせる（DSR 996/mode 2031）

## 変更概要 / 目的

pane 内で動くプログラム（vim・bat・delta 等）が `CSI ?996n`（色スキームの問い合わせ）を
送ると、その pane を見ているブラウザの現在テーマに応じて `CSI ?997;1n`（dark）/
`CSI ?997;2n`（light）で応答する。`CSI ?2031h`（DECSET mode 2031。継続通知）を送っていれば、
以後テーマが変わるたびに（手動切替・OS の `prefers-color-scheme` 自動切替どちらも）自発的に
同じ形式で通知する。`CSI ?2031l` で止まる。herdr（Rust 版）の同機能とのパリティが目的。

## 重要ポイント

- **「どちらの明暗か」は色の問い合わせ（`answerPaletteFor`）と全く同じ4段階優先順位で解決する**
  （`resolveThemeFor` に切り出して共有。`answerPalette.ts`）。新しい判定基準は作っていない。
- **push（自発通知）のトリガーは `client.theme` RPC だけ**。OS の `prefers-color-scheme`
  自動切替も、既存の `ThemeController.apply()` が `client.theme` を送り直す経路に乗るため、
  クライアント側の変更は一切不要だった（`packages/web/*` は無改修）。
- **mode 2031 の有効化そのものは通知を出さない**。herdr の実際の挙動（Rust テストを直接読んで
  確認）に合わせ、「値が変わったときだけ通知する」規則を踏襲した。
- **decisions.md D1（coding 中に自分のテストで発見）**: `?2031h` 有効化時に
  `lastReportedAppearance` の基準値を捕捉していないと、事前に `?996n` 問い合わせが無い場合、
  有効化しただけで「変わった」と誤検知するバグがあった。
- **decisions.md D2（review round1 must）— このリストで最も重要**: xterm-headless の CSI
  ハンドラは **LIFO で実行され、`true` を返すとそこで連鎖が止まる**（`false` は以前に登録
  されたハンドラ、最終的には xterm 内蔵ハンドラへ委譲）。かつ CSI は複数の `Pm` を1つの
  シーケンスに束ねて送れる（`CSI ?2031;1049h` のように）。当初の実装は `params[0]` だけを
  見て一致すれば無条件に `true` を返していたため、**`?2031` を他のモード（例: 1049＝
  オルタネートスクリーン）と束ねて送ると、束ねられた側が黙って無効化される**バグがあった
  （逆順で束ねると 2031 自体が認識されない）。修正: `params` 全体を `includes()` で走査し、
  **マッチの有無に関わらず常に `false` を返す**（副作用だけ条件付きで実行）。この「LIFO・
  true で連鎖停止」という非自明な挙動は、既存コードを読むだけでは気づけず、xterm-headless の
  バンドル実装を直接読んで初めて判明した（review round1 の詳細）。次にこの近辺へ CSI ハンドラを
  足す人は同じ罠に注意すること。

## 処理フロー

```mermaid
sequenceDiagram
    participant App as pane 内プログラム
    participant Mirror as XtermMirror（headless）
    participant Client as client.theme RPC
    participant AP as answerPalette.ts

    App->>Mirror: CSI ?996n（PTY 出力）
    Mirror->>AP: appearance()（= answerAppearanceFor）
    AP-->>Mirror: resolveThemeFor の4段階優先順位 → "light"|"dark"
    Mirror-->>App: CSI ?997;1|2n（onResponse → pty.write）

    App->>Mirror: CSI ?2031h
    Mirror->>Mirror: mode2031Enabled = true<br/>lastReportedAppearance = appearance()（通知はしない）

    Note over Client: 利用者がテーマ変更 or OS 自動切替
    Client->>Client: clients.setTheme()
    Client->>Mirror: 全 pane へ notifyAppearanceMayHaveChanged()
    Mirror->>Mirror: 現在値が lastReportedAppearance と異なるか判定
    alt 変わっていた
        Mirror-->>App: CSI ?997;1|2n（自発）
    else 変わっていない
        Mirror->>Mirror: 何もしない
    end

    App->>Mirror: CSI ?2031l
    Mirror->>Mirror: mode2031Enabled = false（以後通知しない）
```

## 主要な変更箇所

- `packages/server/src/terminal/Mirror.ts` — CSI ハンドラ3種（`?996n`・`?2031h`・`?2031l`）・
  ESC ハンドラ（RIS）・`notifyAppearanceMayHaveChanged`。`handleAppearanceQuery`/
  `handleMode2031`（decisions.md D1・D2 両方がここに集約）が本体。
- `packages/server/src/clients/answerPalette.ts` — `resolveThemeFor` の切り出し・
  `answerAppearanceFor` の新設。
- `packages/server/src/surface/methods/client.ts` — `client.theme` ハンドラの push トリガー
  （全 pane ループ）。
- `packages/server/src/terminal/TerminalHost.ts`/`TerminalManager.ts`/`composeServer.ts` —
  `appearance`/`appearanceFor` の配線中継のみ（`palette`/`paletteFor` と同型）。

## リスク / 確認したい点

- 実際の端末アプリ（vim・bat・delta 等）や実ブラウザでのテーマ切替を使った目視確認は行って
  いない（test-result.md「未検証の穴」。このセッションの方針: E2E はユーザー依頼時のみ）。
- 複数クライアントが同じ pane を別々のテーマで見ている状況で、`Tab.sizeOwnerClientId`/
  `ClientRecord.view` の変化（表示者の交代）自体は push のトリガーにしていない——次に誰かが
  `client.theme` を送るまで通知が飛ばない残存ギャップ（design の意図的なスコープ限定。
  review round1 で追認）。オンデマンド問い合わせ（`?996n`）は常に最新の答えを返す。
