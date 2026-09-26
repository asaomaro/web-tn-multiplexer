import type { Action } from "./actions.js";
import { ACTIONS, actionFor, DEFAULT_PREFIX, type ActionDef, type ActionId } from "./bindings.js";
import {
  expandRange,
  formatBinding,
  isDirectChord,
  parseBinding,
  PREFIX_CANCEL_CHORD,
  prefixBytes,
} from "./chord.js";
import { emptyKeyPrefs, parsePrefix, type KeyPrefs } from "./keyPrefs.js";

/**
 * 解決した割り当ての表（20260921-keybinding-customization。design「解決した表」）。カタログ（`bindings.ts`）と、このブラウザの上書き（`keyPrefs.ts`）から 1 か所で作り、
 * `KeyRouter`・キー一覧・トースト・通知の案内文・モバイルの Prefix ボタンが同じ表を見る。
 *
 * それまでの `DEFAULT_KEYMAP`（prefix の後のキーだけの `Map`。herdr 互換の既定キー表。20260918-web-terminal-multiplexer の decisions D56 で herdr のソースと突き合わせて確定）は、
 * カタログの既定の割り当てに移り、**既定から解決した表は旧表と 1:1**（`keymap.test.ts` が旧表を固定した値と比べる）。
 */

/**
 * 「後続」の案内のキー（`notYet`。今の `NOT_YET` と同じ内容を正規形で持つ）。**どの操作にも使われていないときだけ** prefix の後のキーの表に入る
 * （別の操作に割り当てればそちらが優先。AC2）。カタログの外＝編集できず、`ownerOf` も返さない。
 */
const NOT_YET_BINDINGS: readonly (readonly [string, Action])[] = [
  // `shift+r`（reload_config）は 20260922-appearance-settings-rest で `ACTIONS`（bindings.ts）に
  // 正式登録したので、この案内からは外れた（上のコメントどおり「カタログに載れば自動的に外れる」）。
  ["e", { type: "notYet", work: "端末機能の拡張" }],
];

/**
 * prefix の後のキーとして予約された chord → 理由（画面の拒否にも、読み込みで落とした記録にも使う。prefix 自身は別に判定する）。
 * `ctrl+shift+v` は貼り付けのショートカットで、`KeyInputController` が prefix の状態に関わらず**ルーターより先に**取る——割り当てても prefix の後では効かない。
 * `enter`・`space`・`down`（と shift 付きの同キー）・`shift+f10` は pane の枠（`PaneFrame.vue`）のメニューを開くキーとして使う——枠が Tab で選べているときに割り当てても、その keydown は枠に止められて届かない
 * （20260925-pane-frame-focus-keys。`PaneFrame.vue` の判定は ctrl/alt/meta だけを見て shift は見ないため、無修飾と shift 付きの両方が対象。`F10` は shift 付きのときだけ枠のメニューを開く（`shift+f10` は `F_KEY` 扱いで chord として表現できるため予約が要る）。`ContextMenu` は `NAMED_KEYS`/`F_KEY` のどちらにも対応が無く chord として表現できないため予約は不要）。
 */
export const RESERVED_AFTER_PREFIX: ReadonlyMap<string, string> = new Map([
  [PREFIX_CANCEL_CHORD, "Esc は prefix の取り消しに使うので、prefix の後のキーにできません。"],
  ["ctrl+shift+v", "ctrl+shift+v は貼り付けに使うので、prefix の後のキーにできません。"],
  ["enter", "Enter は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["space", "Space は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["down", "↓ は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+enter", "Shift+Enter は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+space", "Shift+Space は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+down", "Shift+↓ は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
  ["shift+f10", "Shift+F10 は pane の枠のメニューを開くキーとして使うので、prefix の後のキーにできません。"],
]);
/**
 * 直接のキーとして予約された chord → 理由（`RESERVED_AFTER_PREFIX` と同型。理由が異なる2エントリを
 * 1つの固定文言では表せないため、20260925-pane-frame-focus-keys の T1 round2 taskcheck で
 * `ReadonlySet` から `ReadonlyMap` へ変更した——`ctrl+shift+v` は貼り付け、`shift+f10` は pane の枠の
 * メニューが理由で、両者は無関係）。
 */
export const RESERVED_DIRECT: ReadonlyMap<string, string> = new Map([
  ["ctrl+shift+v", "ctrl+shift+v は貼り付けに使うので、直接のキーにできません。"],
  [
    "shift+f10",
    "Shift+F10 は pane の枠のメニューを開くキーとして使うので、直接のキーにできません。",
  ],
]);

/**
 * 解決した割り当ての表（design「解決した表」）。`KeyRouter` はこれを引くだけ。**割り当てが変わったときに 1 回だけ作り、押すたびには作り直さない**。
 */
export interface ResolvedKeymap {
  /** prefix の chord（既定 `ctrl+b`）。 */
  readonly prefix: string;
  /** prefix を 2 度押したとき端末へ送る列（既定 `\x02`）。 */
  readonly prefixBytes: string;
  /** prefix の後のキー → 操作（「後続」の案内を含む）。 */
  readonly prefixMap: ReadonlyMap<string, Action>;
  /** 直接のキー → 操作。 */
  readonly directMap: ReadonlyMap<string, Action>;
  /** ある操作の有効な割り当て（表示用。`["prefix+v", "ctrl+alt+d"]`。範囲は `prefix+1..9`）。無ければ空。 */
  bindingsOf(id: ActionId): readonly string[];
  /** その chord を使っている操作（衝突の判定と案内）。「後続」の案内は操作ではないので null。 */
  ownerOf(via: "prefix" | "direct", chord: string): ActionId | null;
  /** 案内文用の先頭の割り当て（prefix の後は `ctrl+b ?`、直接は `ctrl+alt+d`）。割り当てが無ければ null。 */
  hintFor(id: ActionId): string | null;
}

/**
 * カタログと上書きから表を作る（純粋）。**上書きのある操作を先に（カタログ順）登録し、上書きのない操作の既定はその後**——上書きが既定に勝つ（herdr と同じ。D7）。
 * 予約・衝突・不正は `problems` に記録して**その割り当てだけ**落とす（範囲は 9 個のどれか 1 つでも駄目なら全体を落とす）。編集の画面は衝突を作らせないので、
 * これが働くのは壊れた保存値・古い版の値だけ。上書きに負けた既定（上書きに取られた既定のキー）は黙って落とす。
 * **上書きが 1 つ以上あるのに 1 つも登録できなかった操作は、既定を登録し直す**（`loadKeyPrefs` の「全部落ちたら既定へ」と結果をそろえる。元から `[]` の操作だけが「割り当てなし」）。
 */
export function resolveKeymap(prefs: KeyPrefs): { keymap: ResolvedKeymap; problems: string[] } {
  const problems: string[] = [];

  let prefix = DEFAULT_PREFIX;
  if (prefs.prefix !== null) {
    const parsed = parsePrefix(prefs.prefix);
    if (parsed === undefined)
      problems.push(
        `prefix「${prefs.prefix}」は使えない形なので、既定の ${DEFAULT_PREFIX} にしました`,
      );
    else prefix = parsed;
  }

  const prefixMap = new Map<string, Action>();
  const directMap = new Map<string, Action>();
  const prefixOwners = new Map<string, ActionId>();
  const directOwners = new Map<string, ActionId>();
  const effective = new Map<ActionId, string[]>();

  const register = (
    def: ActionDef,
    id: ActionId,
    raw: string,
    source: "user" | "default",
  ): void => {
    const b = parseBinding(raw);
    if (b === null) {
      if (source === "user") problems.push(`${id}: 「${raw}」は読めないので落としました`);
      return;
    }
    // 範囲は範囲の操作でだけ・範囲の操作は範囲でだけ（`normalizeBinding` が先に弾くが、手で作った KeyPrefs でも黙って誤登録しない）。
    if (b.range !== (def.indexed === true)) {
      if (source === "user") {
        const why = b.range
          ? "範囲 1..9 は、switch_tab・focus_agent のような範囲対応の操作にしか使えません"
          : "この操作は範囲 1..9 の形だけを割り当てられます";
        problems.push(`${id}: 「${raw}」を落としました（${why}）`);
      }
      return;
    }
    const chords = b.range ? expandRange(b.chord) : [b.chord];
    const owners = b.via === "prefix" ? prefixOwners : directOwners;
    const map = b.via === "prefix" ? prefixMap : directMap;
    for (const chord of chords) {
      let why: string | null = null;
      if (chord === prefix)
        why = `prefix（${prefix}）と同じキーは、${b.via === "prefix" ? "prefix の後" : "直接"}のキーにできません`;
      else if (b.via === "prefix" && RESERVED_AFTER_PREFIX.has(chord))
        why = (RESERVED_AFTER_PREFIX.get(chord) ?? "").replace(/。$/, "");
      else if (b.via === "direct" && RESERVED_DIRECT.has(chord))
        why = (RESERVED_DIRECT.get(chord) ?? "").replace(/。$/, "");
      else if (b.via === "direct" && !isDirectChord(chord))
        why = `${chord} は端末への入力を奪うので直接のキーにできません`;
      else if (owners.has(chord)) why = `${chord} はすでに ${owners.get(chord)} が使っています`;
      if (why !== null) {
        if (source === "user") problems.push(`${id}: 「${raw}」を落としました（${why}）`);
        return; // 範囲は全体を落とす（まだ何も登録していない）
      }
    }
    chords.forEach((chord, i) => {
      owners.set(chord, id);
      map.set(chord, actionFor(def, b.range ? i + 1 : undefined));
    });
    const list = effective.get(id) ?? [];
    list.push(formatBinding(b));
    effective.set(id, list);
  };

  // 1. 上書きのある操作（カタログ順）。 2. 上書きのない操作の既定（上書きが 1 つ以上あって 1 つも登録できなかった操作も、既定へ戻す）。
  for (const def of ACTIONS) {
    const list = prefs.bindings[def.id];
    if (list === undefined) continue;
    for (const raw of list) register(def, def.id, raw, "user");
  }
  for (const def of ACTIONS) {
    const list = prefs.bindings[def.id];
    if (list !== undefined && (list.length === 0 || (effective.get(def.id)?.length ?? 0) > 0))
      continue;
    for (const raw of def.defaults) register(def, def.id, raw, "default");
  }
  // 3. 「後続」の案内は、空いているキーにだけ。（`shift+r`・`e` は prefix の形〔ctrl・alt・F キー〕と重ならないので、prefix との衝突は見ない）
  for (const [chord, action] of NOT_YET_BINDINGS) {
    if (!prefixOwners.has(chord)) prefixMap.set(chord, action);
  }

  const keymap: ResolvedKeymap = {
    prefix,
    prefixBytes: prefixBytes(prefix) ?? "\x02",
    prefixMap,
    directMap,
    bindingsOf: (id) => effective.get(id) ?? [],
    ownerOf: (via, chord) => (via === "prefix" ? prefixOwners : directOwners).get(chord) ?? null,
    hintFor: (id) => {
      const first = effective.get(id)?.[0];
      if (first === undefined) return null;
      const b = parseBinding(first);
      if (b === null) return null;
      const label = formatBinding({ ...b, via: "direct" });
      return b.via === "prefix" ? `${prefix} ${label}` : label;
    },
  };
  return { keymap, problems };
}

/** 何も上書きしていない既定の表。 */
export const DEFAULT_KEYMAP: ResolvedKeymap = resolveKeymap(emptyKeyPrefs()).keymap;
