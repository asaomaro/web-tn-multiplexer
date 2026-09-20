import type { DesktopNotifierPort, DesktopPermission } from "./ports.js";

/**
 * OS 通知（Notification API）。**ブラウザ API に触るのはこのファイルと `ToneSound.ts` だけ**。
 *
 * **`Notification` があっても使えるとは限らない**——Android の Chrome は
 * `new Notification()` が `Illegal constructor` を投げて Service Worker 経由を要求する。
 * 機能検出では捕まらないので、**実際に作ってみて失敗を返す**（`show()` が `false`）。
 */
export class DesktopNotifier implements DesktopNotifierPort {
  /** `tag` ごとに、出している通知を覚える（閉じるため。ブラウザは通知を列挙させてくれない）。 */
  readonly #open = new Map<string, Notification>();

  permission(): DesktopPermission {
    // 非セキュアな文脈（https でも localhost でもない）では、そもそも露出していないブラウザがある。
    if (typeof Notification === "undefined") return "unsupported";
    const p = Notification.permission;
    return p === "granted" || p === "denied" ? p : "default";
  }

  /**
   * 許可を求める。**利用者の操作からのみ呼ぶこと**——Firefox と Safari は一時的なユーザー操作を
   * 要求し、Chrome も操作の外から呼ぶと quiet UI にする（AC7）。
   */
  async request(): Promise<DesktopPermission> {
    if (typeof Notification === "undefined") return "unsupported";
    try {
      const p = await Notification.requestPermission();
      return p === "granted" || p === "denied" ? p : "default";
    } catch {
      return "default"; // 古い callback 版など。押し直せるように `default` で返す
    }
  }

  show(o: { title: string; body: string; tag: string; onClick: () => void }): boolean {
    if (this.permission() !== "granted") return false;
    try {
      // `tag` が同じ通知は同一オリジン内で置き換わる（同じ pane の知らせを重ねない）。
      const n = new Notification(o.title, { body: o.body, tag: o.tag });
      // **消すのは「いま登録されているのが自分自身のとき」だけ**。tag だけで消すと、
      // 同じ pane で出し直したとき**古い通知の close が新しい登録を消し**、
      // 以後 `closeByTag` が何もしなくなって OS 通知が画面に残り続ける。
      const forgetIfMine = (): void => {
        if (this.#open.get(o.tag) === n) this.#open.delete(o.tag);
      };
      n.onclick = () => {
        // 通知のクリックはユーザー操作として扱われるので `window.focus()` が働く。
        window.focus();
        n.close();
        forgetIfMine();
        o.onClick();
      };
      n.onclose = forgetIfMine;
      this.#open.set(o.tag, n);
      return true;
    } catch {
      // Android Chrome の `Illegal constructor` 等。**この環境では出せない**と呼ぶ側に伝える。
      return false;
    }
  }

  closeByTag(tag: string): void {
    const n = this.#open.get(tag);
    if (!n) return;
    this.#open.delete(tag);
    try {
      n.close();
    } catch {
      // 既に閉じられている等。閉じられなくても実害は無い。
    }
  }
}
