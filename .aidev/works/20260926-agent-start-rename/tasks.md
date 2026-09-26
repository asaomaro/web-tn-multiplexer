# タスク: エージェントの名前（`wtmctl agent rename` と名前による対象指定）

## 実装方針

protocol（型・書式の判定・RPC の型・エラー code）→ server（`SessionService` の名前の設定・引き継ぎ・比較、RPC の登録）→
cli（対象の解決・見え方・`agent rename`・help・smoke）→ web（呼び名・サイドバー）→ docs の順に積む。
subtask には割らない（1 PR に収まり、protocol の型を境に producer→consumer が 1 本に並ぶだけ）。

## 作業順序と依存関係

- 下の `依存:` に従う。T1（型）が全ての前提。T2（server の状態）と T4（cli の解決）と T7（web）は T1 の後なら互いに独立。
  T5（`agent rename`）は RPC（T3）と解決（T4）の両方を使うので両方の後。smoke（T6）はビルドした server と cli の両方を使うので T5 の後。
  docs（T8）は CLI の表面（T5）と web の表示（T7）が固まってから最後に書く。既定の直列で進める。
- T1・T4 は複数の変更を抱えるが、どれも型でつながり片方だけでは型検査が通らない（T1 は `METHOD_SCHEMAS` と `MethodResultMap` と
  `ErrorCode`、T4 は Command の改名と 5 つのサブコマンドの差し替え）ので 1 タスクにまとめる。

## リスク / 留意点

- `SessionService.updatePaneRuntime` の引き継ぎを忘れる・条件を誤ると、判定の周期ごとに名前が消える、または入れ替わった
  エージェントに名前が残る（research R1）。両方向をテストで押さえる。
- `sameAgent` に `name` を足し忘れると rename が他のクライアントに届かない（research R2）。
- 並行 work（`load-flaky-tests`）が cli・server・web のテストファイルを触る。既存テストの変更は Command の `paneId`→`target`
  の改名に伴う最小限に留める。
- `AgentInfo.name` は省略可（D3）。`--clear` で `name: undefined` の項目を残さない（`toEqual` と JSON の両方で名前なしになる形）。

## テスト方針

- 単体（vitest）: protocol の `isValidAgentName`（herdr のテストと同じ例）、`SessionService.renameAgent`（成功・外す・書式・
  一意性・付け直し・対象なし・instanceId 違い・発行）と引き継ぎ（同じ instanceId・別の instanceId・null）、RPC の登録、CLI の
  `resolveAgentTarget`（pane ID 優先・名前・曖昧・なし）・`agent rename` の解析・`runAgentRename`・既存サブコマンドの名前指定、
  web の `paneNameOf` とサイドバー。
- 負の確認（`.aidev/conventions/regression-negative-control.md`）: 足した判定・分岐を 1 つずつ壊してテストが落ちることを
  確かめ、生の出力を test-result.md に貼る。
- 全体: `pnpm -s build` → `pnpm -s typecheck` → `pnpm -s test` を 2 回（終了コードで判定）・`aidev smoke`（cli の smoke に rename を足す）。
  E2E は走らせない。

## タスク

- [x] T1: protocol に名前を足す——`AgentInfo.name?`、`agentName.ts`（`isValidAgentName`・`AGENT_NAME_MAX_LENGTH`）と
      テスト、`index.ts` の export、`AgentRenameParams`/`AgentRenameResult` と `METHOD_SCHEMAS`/`MethodResultMap`、
      `ErrorCode` に `invalid_agent_name`・`agent_name_taken`
      対象: `packages/protocol/src/model.ts:107` `AgentInfo`・`packages/protocol/src/agentName.ts`（新規）・`packages/protocol/src/index.ts`・`packages/protocol/src/messages.ts` `AgentSendKeysParams` の後・`METHOD_SCHEMAS`・`MethodResultMap`・`packages/protocol/src/errors.ts:23`・`packages/web/src/net/clientError.ts:13` `MESSAGES`（全 code の網羅。taskcheck T1 で判明） / 根拠: research A1〜A3
      依存: なし
      AC: AC3, AC15
- [x] T2: `SessionService` に `renameAgent` を足し、`updatePaneRuntime` に同じ instanceId の名前の引き継ぎ、`sameAgent` に `name` を
      足す。テストは新しいファイル `SessionService.agentName.test.ts`
      対象: `packages/server/src/session/SessionService.ts:888` `updatePaneRuntime`・`:1177` `sameAgent` / 根拠: research A4
      依存: T1
      AC: AC1, AC2, AC3, AC4, AC5, AC10, AC11, AC12
- [x] T3: RPC `agent.rename` を登録する。テストは新しいファイル `surface/methods/agentRename.test.ts`
      対象: `packages/server/src/surface/methods/agent.ts:57` `registerAgentMethods` / 根拠: research A5
      依存: T2
      AC: AC1, AC2, AC5, AC11
- [x] T4: CLI の対象の解決（`agentTarget.ts` の `resolveAgentTarget`）と見え方の `name`、既存の `agent get/wait/read/prompt/send-keys`
      を `target` で解決するよう差し替える（Command の `paneId`→`target`）。テストは `agentTarget.test.ts`（新規）と既存テストの改名
      対象: `packages/cli/src/commands/agent.ts:45` `requireAgentPane`・`packages/cli/src/agentStatus.ts:44` `AgentView`/`toAgentView`・`packages/cli/src/cliArgs.ts:327` `parseAgent`・`:25-30` USAGE / 根拠: research A6
      依存: T1
      AC: AC5, AC7, AC8, AC9, AC11, AC15
- [x] T5: `wtmctl agent rename <target> <name>|--clear`（解析・`runAgentRename`・main の switch と help）。テストは `cliArgs.test.ts` に
      新しい `it`、`commands/agentRename.test.ts`（新規）
      対象: `packages/cli/src/cliArgs.ts:327` `parseAgent`・`packages/cli/src/commands/agent.ts`・`packages/cli/src/main.ts:24-40`（help）・`:57-110`（switch） / 根拠: research A6
      依存: T3, T4
      AC: AC1, AC2, AC3, AC4, AC5, AC6, AC9, AC11
- [x] T6: cli の smoke に rename → 名前で get → `--clear` を足す
      対象: `packages/cli/src/smoke.ts:166-190` / 根拠: research A8
      依存: T5
      AC: AC1, AC2, AC7
- [x] T7: web の `paneNameOf` に名前を足し、サイドバーのエージェントの行に名前を出す。テストは既存ファイルに新しい `it`
      対象: `packages/web/src/store/paneName.ts:12` `paneNameOf`・`packages/web/src/components/Sidebar.vue:466`・`packages/web/src/components/GotoPicker.vue:80`（絞り込みに種類の表示名。taskcheck T7 で判明）・`packages/web/src/mobile/PanePicker.vue:110`（携帯のエージェント一覧。cross 点検で判明） / 根拠: research A7
      依存: T1
      AC: AC12, AC13, AC15
- [x] T8: `docs/wtmctl.md`（コマンド一覧・「エージェント（`agent`）」・「herdr との対応と違い」）と `docs/herdr-parity.md` の H39 を更新する
      対象: `docs/wtmctl.md:35-40, 69-130, 162-180`・`docs/herdr-parity.md:72` / 根拠: research F1.1〜F1.7（herdr との違い）
      依存: T5, T7
      AC: AC14
