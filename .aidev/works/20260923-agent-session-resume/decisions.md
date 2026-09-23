# 決定記録

## D1: herdr 独自の socket プロトコルには依存せず、公式フックを本製品自身の受け口につなぐ

- 背景: research.md F1.4 で、herdr 自身も Claude Code・Codex の公式 `SessionStart`/`hooks` 機構を
  使っていること（herdr 独自のフック方式ではない）が判明した。
- 決定: 本製品は Claude Code・Codex の公式フック機構を直接使い、report 先を本製品自身のローカル
  socket にする。herdr のローカル socket プロトコル・herdr の実装には依存しない。
- 理由 / 代替案: herdr のプロトコルは非公開・herdr 側の内部実装であり、バージョン間の互換も
  保証されない。公式の拡張点だけに依存する方が安定する。
- 影響: hook スクリプト・report 受信の実装はすべて本製品の新規実装になる（design「インターフェース」4〜5）。

## D2: `SessionFilePane` へのフィールド追加は schema 番号を上げない

- 背景: 既存の `autoLabel?: boolean` が同じ方式（optional 追加）で導入されている
  （`packages/server/src/persist/SessionFile.ts`）。
- 決定: `agentSession?: { kind: string; sessionId: string; reportedAt: number } | undefined` を
  同じ方式で追加する。`schema: 1` のまま。
- 理由 / 代替案: 既存の互換方針と揃える。schema 番号を上げると、過去のファイルとの判別コード
  （zod スキーマの `optional()`）を二重に持つ理由が無い。
- 影響: 古い版の `session.json` を読んでも壊れない（フィールドが無いだけ）。

## D3: 自動再開の既定値は ON（herdr に合わせる）

- 背景: herdr の `resume_agents_on_restore` は既定 `true`（research.md F1.1）。
- 決定: 本製品も `autoResumeEnabled` の既定を `true` にする。ただし「導入（フックの登録）」自体は
  常に明示操作（D の対象外、requirements.md AC-I1 で確定済み）。
- 理由 / 代替案: 導入という明示操作を既にゲートにしているので、その後の既定動作まで
  無効にする必要は薄い。herdr との整合も優先した。
- 影響: 設定画面の初期表示は「自動再開: ON」。利用者が導入した瞬間から効く。

## D4: 「導入済みか」は永続化せず、対象ファイルを都度読んで判定する

- 背景: 利用者が `~/.claude/settings.json` を手動編集して本製品のフックを消す可能性がある。
- 決定: `installed` はローカルの記憶を持たず、対象の hooks 設定ファイルを都度読んでフックの
  有無を判定する。
- 理由 / 代替案: 別途フラグを持つ案は実装が単純だが、実体とズレたときに検知できない
  （「導入済みのはずなのに再起動しても再開されない」という原因不明のバグを生みやすい）。
- 影響: `agentIntegration.status` はファイル I/O を伴う（都度読む）。頻繁に呼ぶ RPC ではないため
  許容する。

## D5: report socket は同一利用者限定にする（Unix はファイル権限、Windows は DACL）

- 背景: 非機能要件「報告経路の安全性」（requirements.md）。ローカルの別利用者・別プロセスが
  任意の pane に偽の会話IDを報告できてはならない。
- 決定: Unix domain socket は作成後に `chmod 0600`。Windows の named pipe は現在の利用者に
  限定する security descriptor を明示的に設定する。
- 理由 / 代替案: 認証トークンを持たせる案もあるが、ローカルプロセス間通信の権限をOSのファイル/
  パイプの ACL に委ねる方が実装が単純で、既存の `StateDirLock`（state dir 自体のロック）とも
  発想が一貫する。
- 影響: 実装の詳細（Windows の DACL 設定コード）は tasks/coding で詰める。
- **coding 時点の追記**: Unix の `chmod 0600` は実装した（`AgentReportSocket.ts`）。**Windows の
  named pipe への DACL 設定は未実装のまま残した**——Node の `net` モジュールは named pipe の
  security descriptor を直接指定する API を持たず、ネイティブアドオン（例: `napi` 経由で
  `CreateNamedPipe` を呼び直す）が要る。この開発環境（Linux）では実装しても動作検証ができず、
  検証できないコードを書くと「直したつもりで直っていない」状態を作りかねないため、**既知の制約
  として明示し**（`docs/verification.md` の Windows 節）、後続（Windows 実機を持つ担当）に委ねる
  判断にした。現状の Windows での実害: 同一マシンの別ユーザーが（本製品と同じ named pipe 名を
  導出できれば）report を送りつけられる可能性がある——ただし送れる内容は `paneId`/`kind`/
  `sessionId` の組だけで、`paneId` が実在しなければ無視される（実害は「知らない pane に
  存在しない会話IDを紐付けようとして失敗する」程度。resume 時に無効な ID は AC6 のフォールバック
  で普通のシェルになるだけで、任意コード実行等には繋がらない）。

## D6: hook スクリプトは参照ではなくコピーで配置する

- 背景: 本製品の実行ファイルの実体（npm パッケージのインストール場所）は環境によって変わりうる。
- 決定: 導入時に、同梱の hook スクリプトを `~/.claude/hooks/` / `~/.codex/hooks/` へコピーする。
  参照（絶対パスで本製品のインストール場所を指す）はしない。
- 理由 / 代替案: 参照方式は、本製品をアンインストール・移動・バージョンアップで再インストール
  した際にフックが壊れる（存在しないパスを指す）。コピー方式なら hook 自体は独立して動き続ける
  （壊れても実害は「復元されずただのシェルになる」だけ。AC6 のフォールバックと同じ安全側）。
- 影響: uninstall 操作でコピーしたスクリプトファイルも削除する。バージョンアップ時にスクリプトの
  中身を更新したい場合は、再導入（uninstall→install）が必要になる（既知の制約として残す）。

## D7: Codex 側は `config.toml` を編集せず、専用の `hooks.json` を使う

- 背景: research.md F5.2「置き場所は `~/.codex/hooks.json`・`~/.codex/config.toml`・…」。
  config.toml は TOML でコメント・他設定が混在し、部分編集の安全な実装が難しい。
- 決定: 本製品は `~/.codex/hooks.json`（JSON 専用ファイル）だけを対象にする。
- 理由 / 代替案: JSON の非破壊マージ（オブジェクトの深いマージ）は TOML の部分編集より
  実装・テストが容易で、他の Codex 設定を壊すリスクが低い。
- 影響: Codex の `[features] hooks` が明示的に `false` にされている環境では効かない
  （既定は true なので通常は問題ないが、既知の制約として design「エラー処理」に残す）。

## D8: `persist.touch()` の発火条件に会話IDの変化を追加する

- 背景: 現状 `updatePaneRuntime` は `cwdChanged` のときだけ保存を予約する（`SessionService.ts:484`）。
  会話IDが変わっても保存されなければ、サーバが不意に落ちたときに最新の会話IDが失われる。
- 決定: `agentSession` の変化（設定・消去）でも `persist.touch()` を呼ぶ。
- 理由 / 代替案: 既存の条件式にもう1つの条件を足すだけで済み、他の保存契機（pane 作成・close 等の
  既存の `touch()` 呼び出し）はそのまま。
- 影響: `SessionService.test.ts` の既存の cwd 変化テストへの回帰が無いことを確認する
  （タスク点検で確認）。

## D9: 画面判定でエージェントが消えたら会話IDも消す

- 背景: design「振る舞いの詳細・既存の agent 検出との連動」。
- 決定: `pane.agent` が非 null→null に遷移したら `pane.agentSession` も null にする。
- 理由 / 代替案: 何もしない案（古い会話IDを保持し続ける）は、エージェントを終了して別の作業をしている
  pane が、次のサーバ再起動で勝手に古い会話を再開してしまう事故につながる。利用者の直感（今動いている
  ものが再開される）に合わせた。
- 影響: `updatePaneRuntime` の実装に条件分岐が1つ増える。

## D10: 復元経路は分岐を増やさない（プレーンなシェル起動は必ず先に行う）

- 背景: design「振る舞いの詳細・復元」。既存の `spawnForPane`/D37（起動成功を確認してから
  モデルを更新する）の設計を尊重する。
- 決定: resume コマンドは、シェルの起動に成功した「後」に pane へ書き込む形にする
  （起動そのものの分岐は増やさない）。
- 理由 / 代替案: エージェントのバイナリを直接 pane のプロセスとして起動する案も検討したが、
  そのバイナリが無い・失敗した場合に pane が `failed` になり AC6（普通のシェルへのフォールバック）
  を満たせない。シェル起動+コマンド投入の方が既存の失敗処理をそのまま使い回せる。
- 影響: 復元の実装は `restorePaneProcess` への追記で済み、`spawnForPane` 自体は変更しない。

## D11: 同一 cwd・同一種別の複数 pane でも重複排除せず全 pane で再開を試みる

- 背景: 利用者との協議（本 work の requirements.md 決定事項）。ID なし方式（`--continue`/
  `resume --last`）では同一 cwd で複数 pane を区別できない問題があったが、本方式は pane ごとに
  一意な `sessionId` を持つため、その問題が構造的に発生しない。
- 決定: 復元時に重複排除ロジックを持たず、`agentSession` を持つ全 pane で resume コマンドを投入する。
- 理由 / 代替案: 一意な ID が前提なので、安全側に倒すための重複排除は不要な複雑さになる。
- 影響: 実装がシンプルになる（cwd を跨いだ照合ロジックが不要）。

## D12: report socket の stale ファイル（前回の不正終了の残骸）は起動時に検出して作り直す

- 背景: design「エラー処理」。Unix domain socket はプロセス終了時にファイルが残ることがある。
- 決定: サーバ起動時、socket のパスに既存ファイルがあれば bind を試み、`EADDRINUSE` なら
  そのファイルを削除して作り直す（`StateDirLock` が同じ state dir への二重起動を別途防いでいるため、
  安全に削除してよい）。
- 理由 / 代替案: 手動でのファイル削除を利用者に求めるのは非現実的。`StateDirLock` の保証
  （同じ state dir で2つ目のサーバは起動できない）に乗るため、安全に上書きできる。
- 影響: 具体的な削除・再 bind の手順は coding 工程で実装する。

## D13: `.aidev/backlog/product-roadmap.md` の消し込みは deliver 工程で行う

- 背景: tasks.md T14 は「backlog 行の分割」を coding のタスクとして書いていたが、
  `aidev-70-deliver`「3.5」の規約は backlog の `[x]` 化を deliver 工程の作業と定めており
  （PR/コミット参照を伴う記録のため）、coding 時点ではまだ書けない。
- 決定: T14 のうち `docs/herdr-parity.md`・`docs/verification.md` の更新は coding 工程で行い、
  `.aidev/backlog/product-roadmap.md` の該当行の `[x]`/`[ ]` 分割は deliver 工程に回す。
- 理由 / 代替案: プロトコルの規約に従う（`aidev-40-coding` の完了の目安の例外規定：
  「test / deliver で消化する」タスクは未チェックのまま承認してよいが、その旨をここに記録する）。
- 影響: T14 は coding 承認の時点では完全にはチェック済みにならない（backlog 分の消し込みは
  deliver 承認時に行う）。
