# 仕様: キーバインドのプリセット

## 概要

節「キー」の一括操作（`.keys-bulk`）にある、単一目的の
［herdr のおすすめの直接のキー（ctrl+alt）を足す］ボタンを、プリセットを選ぶ `<select>` +
［足す］ボタンへ一般化する。プリセットの表の形式を、`ActionDef.defaults` と同じ「割り当て文字列
（`prefix+…` も可）」に広げ、`applyRecommended`（`assign.ts`）の `via` 固定（`"direct"` 決め打ち）を
外して `parseBinding` で表側から読み取るようにする。新しいプリセット「tmux 風」を追加する。

## 設計方針

- **既存の「追加（非破壊）」semantics を維持する**（research F3）。プリセットの「置き換え」は行わない
  ——これは requirements のスコープで明示的に対象外とした判断で、design でも踏襲する。
- **表の形を一般化するだけで、検証・衝突判定のロジックは 1 つも増やさない**。`validateAssignment`・
  `resolveKeymap`・`RESERVED_AFTER_PREFIX` 等は変更しない（research F6）。プリセットの chord も
  通常の取り込みと同じ規則で検証される。
- **`RECOMMENDED_DIRECT` は変えない**（内容・エクスポート名とも）。既存のテスト
  （`assign.test.ts:534-547` が 10 組を固定）を壊さないための制約であり、AC6 の核（対象の一覧が
  変わらない）はこれで担保する。

## 対象範囲

- 変更: `packages/web/src/keys/assign.ts`（`applyRecommended` の一般化・`RecommendedResult` の
  フィールド名）。
- 新規: `packages/web/src/keys/presets.ts`（プリセットの表と一覧）。
- 変更: `packages/web/src/components/KeySettings.vue`（ボタン 1 つ → `<select>` + ボタン）。
- 変更（テスト）: `assign.test.ts`・`KeySettings.test.ts`（一般化・文言変更に追従）。
- 変更なし: `keymap.ts`・`chord.ts`・`keyPrefs.ts`・`store/settings.ts`（`resetAllKeys` を含め
  変更しない。AC7 の根拠）・サーバー・protocol。

## 依拠する既存の事実

- `applyRecommended` は `via` を `"direct"` に固定して `validateAssignment` を呼んでいる
  （`packages/web/src/keys/assign.ts:290-294`。research F2 で確認）。
- `RECOMMENDED_DIRECT` の全エントリは bare chord（`prefix+` 無し）で、`parseBinding` に通しても
  `via:"direct"` になる（`packages/web/src/keys/chord.ts:300-323` の実装。research F4）。
  → 一般化しても、既定の呼び出し（`set` 省略）は今と同じ結果になる（後方互換）。
- 節「キー」の一括操作は `KeySettings.vue:422-456` の `.keys-bulk` 内にある。
  `addRecommended`（249-264行）が `applyRecommended` を呼び `message.value` を組み立てる唯一の場所
  （research F8）。
- `RESERVED_AFTER_PREFIX`・`RESERVED_DIRECT`（`keymap.ts:30-34`）に tmux 風プリセットの候補 chord
  は 1 つも含まれない（research F6）。
- tmux 公式 man page（`tmux.1` の DEFAULT KEY BINDINGS。research F10。2026-09-22 取得）の
  既定キーは、`%`（左右分割）・`"`（上下分割）・矢印キー（pane 移動）・`x`（pane を閉じる）・
  `c`（新 window）・`n`/`p`（次/前 window）・`,`（window 名変更）・`&`（window を閉じる）・
  `z`（拡大表示切替）・`d`（デタッチ）。
- 候補 chord 文字列（`%`・`"`・`,`・`&`・`left`・`right`・`up`・`down`・`d`・`x`・`c`・`n`・`p`・`z`）は
  すべて `parseChord`／`parseBinding("prefix+"+c)`／`formatBinding` を実際に通して有効・往復することを
  確認済み（research F13。一時テストで 28 アサーション pass、commit はしていない）。

## インターフェース / データ構造

### `assign.ts` の一般化

```ts
export interface RecommendedResult {
  prefs: KeyPrefs;
  /** 足せたもの（表に書かれた割り当て文字列そのまま。`ctrl+alt+h`・`prefix+%` 等）。 */
  added: string[];
  /** すでにその操作が持っていたもの（何もしない）。 */
  already: string[];
  /** 足せなかったもの（別の操作が使っている・prefix と同じ）と理由。 */
  skipped: { id: ActionId; binding: string; reason: string }[]; // ← `chord` から改名（入力が prefix 付きにもなるため）
}

export function applyRecommended(
  km: ResolvedKeymap,
  prefs: KeyPrefs,
  set: ReadonlyArray<readonly [ActionId, string]> = RECOMMENDED_DIRECT,
): RecommendedResult {
  let current = prefs;
  let working = km;
  const result: RecommendedResult = { prefs, added: [], already: [], skipped: [] };
  for (const [id, binding] of set) {
    if (working.bindingsOf(id).includes(binding)) {
      result.already.push(binding);
      continue;
    }
    const parsed = parseBinding(binding);
    if (parsed === null) {
      result.skipped.push({ id, binding, reason: "読めない割り当てです。" });
      continue;
    }
    const r = validateAssignment(
      working,
      { kind: "binding", id, via: parsed.via },
      chordToKeyInput(parsed.chord),
    );
    if (!r.ok) {
      result.skipped.push({ id, binding, reason: r.reason });
      continue;
    }
    current = withBindings(current, id, [...working.bindingsOf(id), r.binding]);
    working = resolveKeymap(current).keymap;
    result.added.push(binding);
  }
  result.prefs = current;
  return result;
}
```

**`applyRecommended` 本体（for ループ）の変更点は 3 つだけ**：(1) ループ変数を `chord` → `binding`
（表の値がもう bare chord とは限らないため）、(2) `via: "direct"` の決め打ちを `parseBinding(binding)`
の結果（`parsed.via`）に差し替え、(3) `chordToKeyInput(chord)` → `chordToKeyInput(parsed.chord)`
（bare chord 部分だけを渡す）。これとは別に、型定義 `RecommendedResult.skipped` のフィールド名も
`chord` → `binding` に改名する（上の「`RecommendedResult`」節。同じ理由——値が bare chord とは
限らないため）。`RECOMMENDED_DIRECT` はすべて bare chord なので `parseBinding` は必ず
`via:"direct"` を返し、既定呼び出しの結果は一切変わらない。

`parseBinding(binding)` が `null`（読めない文字列）を返すケースは、**プリセットの表の書き間違いを
実行時に検知する安全弁**であり、正しく書かれたプリセットの表では起こらない（`bindings.test.ts` と
同様に、新しいプリセットの表にも「全エントリが `parseBinding` を通る」ユニットテストを足す。AC5）。

### `presets.ts`（新規）

```ts
import { RECOMMENDED_DIRECT } from "./assign.js";
import type { ActionId } from "./bindings.js";

export interface KeyPreset {
  readonly id: string;
  /** `<option>` の表示にも、案内文の中の呼び名にも使う（1 か所で決める。AC5）。 */
  readonly label: string;
  readonly bindings: ReadonlyArray<readonly [ActionId, string]>;
}

/**
 * tmux の DEFAULT KEY BINDINGS に倣う一式（design「依拠する既存の事実」。research F10）。
 * この製品に 1:1 で対応する操作だけを拾う——方向つきでない swap・resize の連続キー・
 * 0 始まりの window 番号選択などは対応が作れないため含めない（research F11・F12）。
 */
export const PRESET_TMUX: ReadonlyArray<readonly [ActionId, string]> = [
  ["split_vertical", "prefix+%"],
  ["split_horizontal", 'prefix+"'],
  ["focus_pane_left", "prefix+left"],
  ["focus_pane_down", "prefix+down"],
  ["focus_pane_up", "prefix+up"],
  ["focus_pane_right", "prefix+right"],
  ["close_pane", "prefix+x"],
  ["new_tab", "prefix+c"],
  ["next_tab", "prefix+n"],
  ["previous_tab", "prefix+p"],
  ["rename_tab", "prefix+,"],
  ["close_tab", "prefix+&"],
  ["zoom", "prefix+z"],
  ["detach", "prefix+d"],
];

export const KEY_PRESETS: readonly KeyPreset[] = [
  { id: "herdr-ctrl-alt", label: "herdr のおすすめの直接のキー（ctrl+alt）", bindings: RECOMMENDED_DIRECT },
  { id: "tmux", label: "tmux 風", bindings: PRESET_TMUX },
];
```

**新しいプリセットを足すときの変更点はこの表に 1 行足すだけ**（AC5）——`KeySettings.vue` 側は
`KEY_PRESETS` を `v-for` で回すだけで、プリセットごとの分岐を持たない。

### `KeySettings.vue` の変更

`.keys-bulk` 内、既存のボタン 1 つを次に差し替える（`data-recommended` は
`data-add-preset` へ改名。「プリセットを足すボタン」という実体に合わせる）。

```vue
<label class="keys-preset-label" for="keys-preset-select">プリセット</label>
<select id="keys-preset-select" v-model="selectedPresetId" class="keys-select">
  <option v-for="p in KEY_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
</select>
<button
  type="button"
  class="keys-btn"
  data-add-preset
  aria-describedby="keys-recommended-note"
  @click="addPreset"
>
  足す
</button>
```

```ts
const selectedPresetId = ref(KEY_PRESETS[0]!.id);

function addPreset(): void {
  const preset = KEY_PRESETS.find((p) => p.id === selectedPresetId.value) ?? KEY_PRESETS[0]!;
  const r = applyRecommended(settings.keymap, settings.keyPrefs, preset.bindings);
  settings.replaceKeyPrefs(r.prefs);
  const parts: string[] = [];
  if (r.added.length > 0)
    parts.push(`${preset.label}を ${r.added.length} 個足しました：${r.added.join("、")}。`);
  if (r.added.length === 0 && r.skipped.length === 0)
    parts.push(`${preset.label}は、すでに全部入っています。`);
  else if (r.already.length > 0) parts.push(`すでにあった分：${r.already.join("、")}。`);
  if (r.skipped.length > 0)
    parts.push(
      `足さなかった分：${r.skipped.map((k) => describeSkip(k.binding, k.reason)).join("、")}。`,
    );
  message.value = parts.join("");
}
```

構造は既存の `addRecommended` と同一（4 分岐・`describeSkip` の再利用）で、`preset.label` を
テンプレートに埋め込む点だけが変わる（decisions D3 参照）。

`#keys-recommended-note` の文言は「おすすめの一式には」→「プリセットには」に一般化する
（`KeySettings.test.ts:76-84` は `Ctrl+Alt+L`・`AltGr`・「［変更］で付け替えてください」の部分一致
だけを見ているので、この変更で既存テストは壊れない）。

## 振る舞いの詳細

- 既定選択は先頭のプリセット（`herdr-ctrl-alt`）——今までの唯一の選択肢だったものを、変更なしで
  そのまま初期状態にする。
- ［足す］を押すたびに、選択中のプリセットの表全体を `applyRecommended` に渡す。個別の chord を
  選んで足す UI は作らない（表単位の操作。requirements のスコープどおり）。
- 選択欄（`<select>`）の値は `capturing`（キー取り込み待ち）と独立した状態で、取り込み待ち中でも
  `<select>` 自体の操作は妨げない（取り込み待ちの `keydown` ハンドラは `.keys-capture` 部品にしか
  付いていないため。AC-I5）。
- ダイアログを閉じても選択中のプリセット ID は保持してよい（確定していない選択は「取り消すべき状態」
  を持たないため。AC-I1・requirements と同じ判断）。次に開いたときも直前の選択のまま
  （既存の `watch(() => view.openDialog, ...)` は `message`/`confirmingReset`/取り込み待ちだけを
  リセットしており、`selectedPresetId` はそのロジックに含めない）。

## ドメイン固有の考慮

- herdr 由来の既定キー配置（`ACTIONS[].defaults`）とは別に、tmux という「別ツールの既定」を
  取り込む初めてのケース。命名は `KeyPreset.id`/`label` に留め、tmux 固有の概念（session/window）を
  この製品の語彙（workspace/tab）に無理に対応させない（research F11・F12 で対応の薄い操作を除外
  した理由と同じ）。

## エラー処理 / 異常系

- プリセットの表に書き間違い（`parseBinding` が読めない文字列）があれば、その 1 件だけ `skipped` に
  「読めない割り当てです。」として積み、他のエントリの処理は続ける（1 件の異常で全体を止めない。
  既存の衝突時の扱いと同じ落とし方）。開発時に気づけるよう、プリセットの表を対象にした
  「全エントリが読める」ユニットテストを足す（実質的にはこの分岐が動かないことを保証するテスト）。
- `selectedPresetId` が `KEY_PRESETS` に存在しない値になることは無い（`<select>` の `<option>` から
  しか選べない）が、念のため `??  KEY_PRESETS[0]!` で先頭へフォールバックする。

## 受け入れ基準との対応

- AC1: `<select>`（`KEY_PRESETS` を `v-for`）+［足す］ボタンで、2 つ以上から選べる。
      入力の出所: `KEY_PRESETS`（`presets.ts`、新規）。
- AC2: `PRESET_TMUX` の表（research F10 の対応表をそのまま転記）を「インターフェース / データ構造」の
      `presets.ts` の tmux 風プリセットとして実装。
      入力の出所: research F10（tmux 公式 man page）。
- AC3: `applyRecommended` の冪等性は一般化しても変わらない（`working.bindingsOf(id).includes(binding)`
      のチェックは元のロジックのまま。入力の出所: `assign.ts` 既存実装 + research F3）。
- AC4: 衝突・予約の判定は `validateAssignment` を素通しで再利用（`applyRecommended` は
      `AssignTarget` を組み立てて `validateAssignment` を呼ぶだけで、通常の取り込みと同じ経路を通る。
      `validateAssignment` 自身は対象が `binding` のとき内部で `validateBinding` へ委譲する
      ——両者は同じ関数の呼び出し階層で、別のロジックではない。入力の出所:
      `assign.ts:62-84`〔`validateAssignment`〕・`assign.ts:111-177`〔`validateBinding`〕。
      research F7）。
- AC5: `presets.ts` の `KEY_PRESETS` に 1 行足すだけで新しいプリセットが増える設計（上記
      「新しいプリセットを足すときの変更点」節で示した。入力の出所: この design 自体）。
- AC6: `RECOMMENDED_DIRECT` の内容は変更しない。対象の一覧・skip/added の判定ロジック・冪等性は
      一般化の前後で同じ（`assign.test.ts` の既存アサーションで担保）。**案内文の文言は
      `preset.label` を埋め込む形へ一般化し、herdr プリセットの文言も変わる**
      （decisions D3 で、AC5 の拡張性要求と両立しない byte-exact 一致を明示的に緩めた理由を記録する）。
      伝える情報（足した個数・一覧・すでにあった分・足せなかった分と理由）の構造は変えない。
- AC7: 「すべて既定に戻す」（`resetAllKeys`）はプリセット由来の割り当ても含め `KeyPrefs` を空にする
      既存の実装のままで、変更不要（入力の出所: `store/settings.ts` の `resetAllKeys`。既存実装を
      変えないことをテストで確認する）。
- AC-I1: 上記「振る舞いの詳細」参照。
- AC-I2: ［足す］ボタンを押した時点で確定。確認ダイアログは挟まない（既存の `addRecommended` と同じ
      即時反映パターン）。
- AC-I3: `<select>` → Tab → ［足す］の順にネイティブなタブ順で並ぶ（DOM 順そのまま。追加の
      `tabindex` operationは不要）。
- AC-I4: `addPreset` は既存の `addRecommended` と同様、`endCapture` を経由しない単純な同期処理で、
      フォーカスは押したボタン（［足す］）に自然に残る（明示的な `focus()` 呼び出しをしない
      ＝ブラウザの既定の click 後フォーカス維持に任せる。既存の「おすすめ」ボタンと同じ挙動）。
- AC-I5: `<select>` の開閉・矢印キーは `.keys-capture` の `keydown` ハンドラの対象外
      （そのハンドラは取り込み待ちの間だけ存在する別要素に付く。両者が同時に存在することはない）。
