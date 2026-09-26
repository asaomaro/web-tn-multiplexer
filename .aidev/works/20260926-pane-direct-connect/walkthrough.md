# レビューガイド: `wtmctl pane attach`（20260926-pane-direct-connect）

書く理由: 差分が大きく（テスト込みで約 2,500 行）、protocol → server → cli の 3 層にまたがり、所有者の状態とイベントの順序に依る判定がある。

## 読む順番

1. **protocol**（`packages/protocol/src/messages.ts`・`events.ts`・`errors.ts`）: RPC `pane.attach`／`pane.attach_resize`／`pane.detach`、イベント `pane.attach_changed {paneId, clientId|null}`、
   code `pane_attached`・`not_attached`。web は `clientError.ts` の網羅表に 2 行だけ（型が全 code を要求するため。decisions D7）。
2. **server `SizeAuthority`**（`packages/server/src/clients/SizeAuthority.ts`）: pane → 所有者の表 `attachments`。`applyOwnerSize` が直結中の pane を飛ばす
   （**大きさの鍵**。PTY の大きさを変える経路はここ 1 つ）。`onClientGone` は tab の権限の移譲の**後に**直結を解放する（戻す大きさは移譲後の権限者のもの）。
   方式の登録は `surface/methods/attach.ts`（薄い包み）。
3. **cli**（`packages/cli/src/commands/attach.ts`）: hello → `pane.attach`（ここで失敗すれば手元の端末に触らない）→ raw・代替画面 → `pane.subscribe`（SNAPSHOT＋出力）。
   出力は `TerminalQueryFilter`（`attachOutput.ts`）で**端末への問い合わせを取り除いてから**書く（答えるのはサーバのミラーだけ。D8）。
   終わり方は切り離し（0）／奪取・pane の終了・切断（1）。切り離しを始めたら後から何が来ても 0（D10）。どの終わり方でも finally で端末を戻す。

## 見てほしい点・リスク

- **所有者は安全の境界ではない**（INPUT は今までどおり認証済みの誰でも書ける）。排他は直結どうしの調停と大きさの鍵のため（herdr も同じ）。
- 奪取の判定は「自分が所有者になった知らせを見た**後に**、自分以外の非 null の clientId が来たら」。サーバは attach の処理の中で知らせを publish してから応答するので、
  同じ WebSocket 上の順序でこれが成り立つ（`attach.test.ts` の順序のテスト）。
- 生の出力を流すため、pane のアプリが代替画面から出ると手元も主画面に出る・kitty keyboard 等は戻さない（D4。docs に既知の違いとして記載）。
- 実物の PTY での確認は smoke（node-pty で `dist/main.js pane attach` を動かし、100x30・echo・resize・Ctrl+B q・代替画面から出る列）。本物の端末エミュレータ・Windows は未検証。
