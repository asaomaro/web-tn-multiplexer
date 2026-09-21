import {
  DEFAULT_THEME,
  TERMINAL_PALETTES,
  type Pane,
  type PaneId,
  type Tab,
  type TabId,
  type TerminalPalette,
  type ThemeName,
} from "@wtm/protocol";
import type { ClientRecord, ClientRegistry } from "./ClientRegistry.js";

/** `answerPaletteFor` が引く先（`composeServer.ts` では `session` と `ClientRegistry`）。 */
export interface AnswerPaletteDeps {
  getPane(id: PaneId): Pane | undefined;
  getTab(id: TabId): Tab | undefined;
  clients: Pick<ClientRegistry, "get" | "list">;
}

/**
 * 色の問い合わせ（OSC 4/10/11/12）に答える配色の引き方（20260921-theme-settings の design D6）。**Mirror が問い合わせを受けた瞬間に呼ぶ**
 * （保持しない。権限者の移動・切断・テーマの変更がそのまま次の答えに効く）。
 *
 * 1. pane の tab のサイズを決めているクライアント（`Tab.sizeOwnerClientId`）が伝えたテーマ（`client.theme`）。
 * 2. その人がいない・まだ伝えていないなら、その tab を表示していて（`client.view` の `tabId`）テーマを伝えたクライアントのうち、
 *    `lastActedAt`（最後に入力・フォーカス・レイアウト・作る操作をした時刻。資格を問わず `ClientRegistry.touch` で進み、接続しただけでは 0。
 *    decisions D7・D13）が最新のもの——fit していないモバイル（サイズを決めない）だけが見ている場合もその配色になる。
 * 3. pane・tab がまだ引けない（新しい pane はシェルの起動の猶予の後にモデルへ入る）・その tab に答えられる人がいない（新しい tab は
 *    `client.view` が届くまで誰も見ていない）なら、テーマを伝えた全クライアントのうち `lastActedAt` が最新のもの——作った本人（作る方式の
 *    受け口が作る前に `touch` する。decisions D8・D13。起動の直後に明暗を調べるアプリにも、作った人の配色で答える）。
 * 4. それも無ければ dracula（今までの答え）。
 */
export function answerPaletteFor(paneId: PaneId, deps: AnswerPaletteDeps): TerminalPalette {
  const pane = deps.getPane(paneId);
  const tab = pane ? deps.getTab(pane.tabId) : undefined;
  if (tab) {
    const owner = tab.sizeOwnerClientId !== null ? deps.clients.get(tab.sizeOwnerClientId) : undefined;
    if (owner?.theme) return TERMINAL_PALETTES[owner.theme];
    const viewer = latestWithTheme(deps.clients.list(), (c) => c.view?.tabId === tab.id);
    if (viewer) return TERMINAL_PALETTES[viewer];
  }
  const anyone = latestWithTheme(deps.clients.list(), () => true);
  return anyone ? TERMINAL_PALETTES[anyone] : DEFAULT_THEME;
}

/** テーマを伝えたクライアントのうち、条件に合って `lastActedAt` が最新のもののテーマ（同じなら先に接続したほう）。 */
function latestWithTheme(clients: readonly ClientRecord[], match: (c: ClientRecord) => boolean): ThemeName | null {
  let latest: ClientRecord | undefined;
  for (const c of clients) {
    if (c.theme === null || !match(c)) continue;
    if (!latest || c.lastActedAt > latest.lastActedAt) latest = c;
  }
  return latest?.theme ?? null;
}

/**
 * `composeServer.ts` の「後から埋める箱」（design D6）。`TerminalManager` は `ClientRegistry` より先に作るので、配色を引く関数を先に渡し、
 * `attach` で中身を埋める。**埋まる前に呼ばれたら dracula**（保険。いまの `composeServer.ts` では pane を作る復元は `listen()` の中で、
 * `attach` より後なので起きない）。
 */
export function createPaletteSource(): { paletteFor(paneId: PaneId): TerminalPalette; attach(deps: AnswerPaletteDeps): void } {
  let deps: AnswerPaletteDeps | null = null;
  return {
    paletteFor: (paneId) => (deps ? answerPaletteFor(paneId, deps) : DEFAULT_THEME),
    attach: (d) => {
      deps = d;
    },
  };
}
