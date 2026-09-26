# レビュー記録

## タスク点検ログ（coding 工程内・「3.3」(b)）
- [should][conv:regression-negative-control] packages/server/src/session/SessionService.test.ts AC15 の「待ち終えた時点の詰まりでは決めない」テストが、待ち終えた時点で判定する変異でも通る / 対応: 単体では順序を確実に作れないため捕まえられない理由を decisions D6 に記録し、テストの主張を狭めた（T1・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/session/SessionService.ts `followedLabel` の世代を待った後で取る変異が生き残る / 対応: 待ちの最中に名前変更を挟むテストを追加（T1・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/session/SessionService.ts degraded のとき labelCwd を記録しない処理のテストが作成の経路だけ / 対応: 追従・待つ前の詰まり・復元・名前を空にした経路のテストを追加。reject の経路は D6 に記録（T1・ラウンド1）
- [nit][conv:-] packages/server/src/session/SessionService.ts `forgetWorkspace` の labelCwd.delete を消しても落ちない / 対応: 許容（id は使い回されず、害は Map に残るだけ。D6）
- [should][conv:-] packages/e2e/src/specs/workspace-auto-label.spec.ts:122-133 左上の pane を起動した場所に残したため、goto の絞り込みが名前だけで当たることを確かめなくなった / 対応: この本で確かめる範囲（同じ名前が出る・当たらない workspace が消える）をコメントに明記した（T3・ラウンド1）
- [must][conv:-] docs/verification.md:240-249 前の work の手動の確かめ方が、左上の pane で `cd` する手順のまま（追従で名前が変わり期待が成り立たない） / 対応: 分割した pane で `cd` する手順に直した（T4・ラウンド1）
- [should][conv:-] docs/verification.md:250 追加した手順の `git commit` が利用者名の無い環境で失敗する / 対応: `-c user.name -c user.email` を付けた（T4・ラウンド1）
- [should][conv:-] docs/verification.md:63 見出しが「開いた場所から自動で名前が付く」のまま / 対応: 「いまの場所から」に直した（T4・ラウンド1）
- [should][conv:-] docs/herdr-parity.md:24 H01b の対応 AC の列にこの work の AC が無い / 対応: 追記（T4・ラウンド1）
- [nit][conv:-] docs/herdr-parity.md:24 macOS・Windows の OSC 7 の制約が herdr の括弧の中にある / 対応: 括弧の外へ出した（T4・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/git/GitInfoPoller.ts:15 購読から pane.closed・tab.closed を外してもテストが通る / 対応: 後に出るイベントと重なるため見分けられない理由を decisions D7 に記録し、テストのコメントを直した（T2・ラウンド1）
- [nit][conv:-] packages/server/src/git/GitInfoPoller.test.ts:383 AC6 のテストが固定の 300ms で待つ / 対応: 止めた見直しの git が 4 本走り終えるのを待つ形に直した（T2・ラウンド1）
- [should][conv:-] packages/server/src/composeServer.ts:342-344 保存の tab が作った順で、並べ替えた後に再起動すると最初の tab（名前と git を決める場所）が戻る / 対応: `ws.tabIds` の順で保存し、統合テストを追加（cross・ラウンド1）
- [nit][conv:-] docs/verification.md:240 前の work の手順の最初の `cd` がどの pane か指定していない / 対応: 分割した右の pane で行うよう直した（cross・ラウンド1）

## ラウンド 1（2026-09-26T03:13:31Z）
- [should][conv:-] packages/web/src/components/ContextMenu.vue:78・packages/server/src/git/WorktreeService.ts:98-101 worktree のメニューの出し分け（`ws.git`＝いまの場所）と worktree の操作（開いた場所）が食い違う。リポジトリへ移ると項目が出て選ぶと not_a_git_repository、別のリポジトリへ移ると一覧が元のリポジトリの worktree になる / 対応: 差し戻し（WorktreeService もいまの場所を使う。herdr も worktree の操作は追従した git の情報〔`ws.git_space()`・`resolved_identity_cwd_from`〕から取る——`src/app/api/worktrees.rs:323-326`・`:380-383`）
- [should][conv:-] packages/server/src/platform/LinuxProcessInspector.ts:65・packages/server/src/session/SessionService.ts:261 シンボリックリンクを含む場所で作ると、監視が入れる実パスが記録した論理パスと違い、`cd` しなくても名前が実パスのフォルダ名に変わる / 対応: 差し戻し（同じディレクトリなら決め直さない）
- backlog 候補（以前から）: `/proc/<pid>/cwd` の `" (deleted)"` がそのまま `Pane.cwd` に入る（この work で名前にも出うる）。空の作り直し・起動時の workspace は `pollWorkspaceNow` を呼ばない（最長 5 秒 git が空）。
- [should][conv:-] packages/server/src/git/WorktreeService.ts:102-105 最初の pane がいる worktree を消すと、web が開き直す一覧が消えた場所で git を起こして失敗する / 対応: いまの場所が使えなければ開いた場所で行う。テスト追加（T6・ラウンド1）
- [should][conv:-] .aidev/works/20260926-workspace-label-follow-cwd/design.md:30 D6 に worktree の一覧が開いた場所のまま残る / 対応: 取り消し線で D10 を指す（T6・ラウンド1）
- [nit][conv:-] packages/server/src/git/WorktreeService.test.ts:18-19 代役の説明が古い / 対応: 修正済（T6・ラウンド1）
- [should][conv:-] packages/server/src/session/SessionService.ts:337 リンクの解決が上限を超えても詰まりとして数えない / 対応: 名前を決める問い合わせと同じ onTimeout で数える（T7・ラウンド1）
- [should][conv:regression-negative-control] packages/server/src/session/SessionService.ts:336,338 解決できないとき・詰まっている間の守りを壊してもテストが通る / 対応: テスト 2 本を追加（T7・ラウンド1）

## ラウンド 2（2026-09-26T03:30:19Z）
- ラウンド 1 の 2 件は解消（T6・T7。変異 8 件がすべてテストで落ちることをレビュアーも確認）。
- [nit][conv:-] packages/server/src/session/SessionService.ts:308,322,340 リンクを含む論理パスで作ったときに名前を決める処理が詰まる・上限を超えると labelCwd が消え、以後は実パスで決め直される / 対応: 許容（まれな経路。decisions D13）
- [nit][conv:-] packages/server/src/git/WorktreeService.ts:108 いまの場所が使えるかを上限なしの stat・access で確かめる / 対応: 許容（newCwd の resolveNewCwd と同じ前例。decisions D13）
