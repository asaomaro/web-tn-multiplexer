# 要件: Workspace.git の即時化

## 背景 / 課題

サイドバーの workspace 行のコンテキストメニューは、「新しい worktree」「worktree を開く…」の
2項目を `Workspace.git != null`（`GitInfoPoller` が埋める）で出し分けている
（`packages/web/src/components/ContextMenu.vue:71-88`）。`GitInfoPoller` は5秒周期の
定期ポーリングしか行わないため（`packages/server/src/git/GitInfoPoller.ts`）、workspace を
作った直後は最大5秒 `git` が `null` のままで、その間はメニューにこの2項目が出ない。

20260920-git-worktree-actions の decisions.md D3 で一度検討され、「`Workspace.git` を使い、
遅れは受け入れる」と決定された（`prefix+G`〔キーボードでの worktree 作成〕は `git` の値を
見ずに常に効かせることで、この5秒の間も別の経路は使える形にした）。その際に検討して退けた
代替案は2つ:
1. メニューを開くたびにサーバへ問い合わせる → 「項目が出るまで待たされる」か「開いた後に
   項目が増える」のどちらかになり、操作として悪い。
2. `workspace.create` の応答に git の情報を含める → サーバ側の責務が増える割に
   「作った直後の5秒」しか救わない。

この2案とは別に、**workspace を作った直後にその workspace だけを対象にした即時の
git 問い合わせを行い、結果は既存の `workspace.updated` イベント（`Workspace.git` を含む）で
反映させる**という第3の案は検討されておらず、D3 は「backlog へ送る」として本項目
（`Workspace.git の即時化`）を残した。

## 目的 / ゴール

workspace を作った直後、実際に git リポジトリであれば、ほぼ即座に（定期ポーリングの5秒を
待たずに）そのメニューに「新しい worktree」「worktree を開く…」が出る状態にする。

## ユーザーストーリー

- US1: workspace を作ってすぐに worktree を作りたい利用者として、workspace を作った直後から
  右クリックのメニューに worktree の項目が出てほしい。なぜなら、5秒待つか `prefix+G`
  （キーのみの経路）を覚えておく必要があるという不便を無くしたいから。（受け入れ: AC1, AC2,
  AC3）

## スコープ

### 対象

- `workspace.create` の処理が完了した直後、その workspace を対象にした git 情報の即時取得を
  行う（既存の5秒周期の定期ポーリングとは別に、作成時にもう1回問い合わせる）。**「既存の
  全 workspace を巻き込まずに済むか」（新しく作った1件だけに絞れるか）は design で確定する**
  （「未確定事項」参照——既存の `pollNow()` は全 workspace を対象にするメソッドで、そのまま
  使うと workspace 数が多いときに無駄な再ポーリングが増える）。
- 取得した結果は、既存の `Workspace.git` の更新経路（`SessionService.updateWorkspaceGit`→
  `workspace.updated` イベント）にそのまま乗せる——新しい応答フィールド・新しいイベント種別は
  作らない。

### 対象外

- **`workspace.create` の応答（RPC の戻り値）に git の情報を含めること**: D3 で既に
  「サーバ側の責務が増える割に効果が限定的」として退けられている。この work でも同じ判断を
  踏襲し、応答を待たせない（fire-and-forget で即時取得を行う。理由は「非機能要件」参照）。
- **メニューを開くたびにサーバへ問い合わせること**: D3 で既に退けられている（待たされる・
  後から項目が増える、のどちらも操作として悪い）。
- **`GitInfoPoller` の定期周期（5秒）自体を短くすること**: 既存の全 workspace を巻き込む
  変更で、この work が対象とする「作成直後」というピンポイントな課題とは別の話。
- **`prefix+G`（キーのみで worktree を作る経路）の変更**: 既に `git` の値を見ずに常に効く
  設計になっており、この work の対象ではない。

## 機能要件

- `workspace.create` で新しい workspace が作られたら、その workspace の cwd に対して git
  情報の取得を、既存の定期ポーリングとは別に即座に行う。
- 取得した結果が既存の値と異なれば、既存の仕組み（`workspace.updated` イベント）で
  クライアントへ反映する（新しい伝達経路は作らない）。
- 対象の workspace が git リポジトリでなければ、`Workspace.git` は `null` のまま
  （既存の定期ポーリングと同じ挙動）。

## 非機能要件 / 制約

- `workspace.create` の RPC 応答を、この即時取得の完了まで待たせない（fire-and-forget。
  応答時間への影響を避ける——「対象外」で退けた代替案2と同じ理由を、実現方法を変えることで
  回避する）。
- 既存の定期ポーリング（5秒周期）と同時に走っても、二重更新・競合状態を起こさない
  （`updateWorkspaceGit` が差分ベースで冪等に更新する既存の仕組みにそのまま乗せる）。

## 完了条件 (受け入れ基準)

- [ ] AC1: git リポジトリの場所で workspace を作ると、定期ポーリングの5秒を待たずに
  `Workspace.git` が埋まる（ほぼ即座に更新される）。
- [ ] AC2: git リポジトリでない場所で workspace を作った場合、即時取得の追加によって
  新しいエラーが利用者に見える形で発生しない（`Workspace.git` は既存の定期ポーリングと
  同じく `null` のままで、`workspace.create` 自体は正常に完了する）。
- [ ] AC3: `workspace.create` の RPC 応答の速度は、この work の変更前後で変わらない
  （即時取得の完了を待たない）。
- [ ] AC4: 即時取得と既存の定期ポーリング（5秒周期）が同時期に走っても、二重更新や競合状態
  （`workspace.updated` イベントの矛盾した内容での多重発行等）を起こさない
  （「非機能要件」の対応する制約の直接の検証）。

## 未確定事項 / 確認したいこと

- 即時取得の実装方法（`GitInfoPoller` に新しい公開メソッドを足すか、`pollNow()`
  ——既存の「テスト・診断用に全 workspace を再ポーリングする」メソッド——をそのまま使うか）は
  design で確定する。既存の `pollNow()` は全 workspace を対象にするため、workspace 数が
  多い状況で作成のたびに全件再ポーリングするのは無駄が大きい——対象を1件に絞る方法を
  design で検討する。
