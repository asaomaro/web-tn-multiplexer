# テスト結果: 進行中の保存に相乗りした flush・予約保存が、その後の変更を落とさないようにする

## 実行したもの
- `npx vitest run src/session/PersistScheduler.test.ts`（packages/server）— 11 passed（うち新しいテスト 8 本）
- `pnpm -s typecheck` — exit 0 / `pnpm -s build` — exit 0
- `pnpm -s test`（全体）を2回 — 2回とも 165 files / 3163 tests passed（review round1 の修正後）。その直前の2回は、別 worktree の全体テストと同時に走らせたため `listen EADDRINUSE`（ポートの取り合い）で cli の結合テスト2件・server の D102 のテスト1件が落ちた。該当ファイルを修正版・修正前の main の両方で単独に3回ずつ流すと全件通ったので、この変更とは無関係と判断した
- `aidev smoke` — pass（web・cli の2本）

## 受け入れ基準ごとの判定
- AC1: pass — 「保存中に flush すると、その保存の後にもう1回保存し、それを待って解決する」。
- AC2: pass — 「保存中に予約の時刻が来ると、その保存の後にもう1回保存する」。
- AC3: pass — 「保存中の flush と予約を何度重ねても追加の保存は1回で、2つの保存が同時に走らない」と、その補強「保存中に続けて flush しても、先の flush は…その完了を待って解決する」。
- AC4: pass — 「進行中の保存が失敗しても、その間に要求した保存は行い、flush はその結果で解決する」と、失敗側の「追加の保存が失敗したら、それを待つ flush は失敗する（握りつぶさない）」（review round1 の指摘で追加）。
- AC5: pass — 下の負の確認（修正を HEAD に戻すと AC1・AC2・AC4 のテストが落ちる）と、全体テスト2回の通過。
- AC6: pass — 「保存中でなければ flush はすぐ1回だけ保存する」。
- AC7: pass — 「cancel は、まだ始まっていない追加の保存も取り消す」。

## 失敗の証跡（負の確認。regression-negative-control.md）

生ログは、各コマンドの出力をファイルへリダイレクトしたものから、落ちたテストの行と件数の行をそのまま抜き出して貼っている（手で書き起こしていない）。各回の後に `PersistScheduler.ts` を修正版へ戻し、`cmp` で一致を確認した。

### NC0: `PersistScheduler.ts` を HEAD（修正前）へ戻す
AC1・AC2・AC4 のテスト（と AC3 の補強）が落ちる:
```
     × 保存中に flush すると、その保存の後にもう1回保存し、それを待って解決する 17ms
     × 保存中に予約の時刻が来ると、その保存の後にもう1回保存する 8ms
     × 保存中に続けて flush しても、先の flush は後の flush に追加の保存を取り消されず、その完了を待って解決する 3ms
     × 進行中の保存が失敗しても、その間に要求した保存は行い、flush はその結果で解決する 8ms
     × 追加の保存が失敗したら、それを待つ flush は失敗する（握りつぶさない） 5ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
      Tests  5 failed | 6 passed (11)
exit:1
```

### 変異の網羅（修正箇所を1か所ずつ壊す。8 通りとも落ちる）

**M1_queuedに相乗りしない**
```
     × 保存中の flush と予約を何度重ねても追加の保存は1回で、2つの保存が同時に走らない 18ms
     × 保存中に続けて flush しても、先の flush は後の flush に追加の保存を取り消されず、その完了を待って解決する 15ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 9 passed (11)
exit:1
```

**M2_cancel後も追加保存を始める**
```
     × cancel は、まだ始まっていない追加の保存も取り消す 14ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed (11)
exit:1
```

**M3_追加保存の開始でqueuedを戻さない**
```
     × 保存中に flush すると、その保存の後にもう1回保存し、それを待って解決する 14ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed (11)
exit:1
```

**M4_flushがcancelを呼ぶ**
```
     × 保存中に続けて flush しても、先の flush は後の flush に追加の保存を取り消されず、その完了を待って解決する 20ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed (11)
exit:1
```

**M5_cancelがqueuedを消さない**
```
     × cancel は、まだ始まっていない追加の保存も取り消す 11ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed (11)
exit:1
```

**M6_失敗した保存を待たずに投げる**
```
     × 保存中の flush と予約を何度重ねても追加の保存は1回で、2つの保存が同時に走らない 5010ms
     × 進行中の保存が失敗しても、その間に要求した保存は行い、flush はその結果で解決する 9ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 9 passed (11)
exit:1
```

**M7_保存中でなくても即保存しない**
```
     × 取り消した後も、次の touch はふつうに保存する 15ms
     × 保存中に flush すると、その保存の後にもう1回保存し、それを待って解決する 8ms
     × 保存中に予約の時刻が来ると、その保存の後にもう1回保存する 2ms
     × 保存中の flush と予約を何度重ねても追加の保存は1回で、2つの保存が同時に走らない 3ms
     × 保存中に続けて flush しても、先の flush は後の flush に追加の保存を取り消されず、その完了を待って解決する 3ms
     × 進行中の保存が失敗しても、その間に要求した保存は行い、flush はその結果で解決する 2ms
     × 追加の保存が失敗したら、それを待つ flush は失敗する（握りつぶさない） 2ms
     × 保存中でなければ flush はすぐ1回だけ保存する 2ms
     × cancel は、まだ始まっていない追加の保存も取り消す 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 9 ⎯⎯⎯⎯⎯⎯⎯
      Tests  9 failed | 2 passed (11)
exit:1
```

**M8_追加保存の失敗を握りつぶす**
```
     × 追加の保存が失敗したら、それを待つ flush は失敗する（握りつぶさない） 30ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed (11)
exit:1
```

変異の中身: M1 `runSave` の `if (this.queued) return this.queued;` を削除／M2 追加の保存の `if (this.queued !== q) return;` を削除／M3 追加の保存の開始で `this.queued = null` を戻さない／M4 `flush()` の先頭で `this.cancel()` を呼ぶ／M5 `cancel()` の `this.queued = null` を削除／M6 進行中の保存の `.catch(() => undefined)` を削除／M7 保存中でなくても即保存しない（`Promise.resolve()` を返す）／M8 追加の保存の失敗を握りつぶす（`startSave().catch(() => undefined)`。review round1 の指摘で追加）。変異スクリプトは scratchpad（`persist-e/mutate.py`）。

## 起動確認（smoke）
```
smoke(cli): wtmctl agent list ok (no agents)
smoke(cli): PASS
smoke: pass (exit 0, 2 本)
```

## 未検証の穴（skip / 環境不足）
- 実際の終了時（SIGTERM）に保存が遅い状況での `flush()` の挙動は、単体テスト（手で解決する Promise）と統合テストで確かめたのみで、実機のディスク遅延では再現していない。
- E2E は走らせていない（利用者の方針）。
