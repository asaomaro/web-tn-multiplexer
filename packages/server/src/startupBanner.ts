import { accessUrls, formatUrlHost } from "./util/net.js";

/** 起動時の表示の材料（`main.ts` が待ち受けに成功した後に集める）。 */
export interface StartupInfo {
  scheme: "http" | "https";
  host: string;
  port: number;
  /** `--origin`（`URL.origin` にそろえ済み）。 */
  extraOrigins: readonly string[];
  /** このマシンの LAN の IPv4（`NetworkInfo.lanAddresses()`）。 */
  lanAddresses: readonly string[];
  /** 今回作った token（作っていなければ `undefined`）。 */
  freshToken: string | undefined;
}

/**
 * 待ち受けに成功した後の表示（design「起動時の表示」・D101・D102・D103）。純関数（表示する行を返すだけ）。
 * - `wtm: listening on <host> port <port> (<scheme>)`（URL の形にしない。端末がリンクにして開けない `0.0.0.0` を開かせない）。
 * - 開ける URL（`accessUrls`）ごとに `wtm: open <URL>/`。token を作ったときだけ `#token=` を付ける。
 * - **URL が 1 つも組み立てられないとき（ゾーン付きの IPv6 の `--host` 等）も、作った token は必ず表示する**（以前は
 *   URL の組み立てが `Invalid URL` を投げ、token を一度も表示せずに終わっていた。D103）。
 */
export function startupLines(info: StartupInfo): string[] {
  const lines = [`wtm: listening on ${formatUrlHost(info.host)} port ${info.port} (${info.scheme})`];
  const urls = accessUrls(info.scheme, info.host, info.port, info.lanAddresses, info.extraOrigins);
  if (urls.length === 0) {
    lines.push("wtm: 開ける URL を表示できません（ゾーン付きの IPv6 アドレス等は URL にできません）。ブラウザで開く URL を --origin で渡すと、ここに表示します");
  }
  if (info.freshToken !== undefined) {
    if (urls.length === 0) {
      lines.push(`wtm: token（今回作成）: ${info.freshToken}`);
      lines.push("wtm: (token は今だけ表示します)");
    } else {
      for (const url of urls) lines.push(`wtm: open ${url}/#token=${info.freshToken}`);
      lines.push("wtm: (token 付きの URL は今だけ表示します)");
    }
  } else {
    for (const url of urls) lines.push(`wtm: open ${url}/`);
    lines.push("wtm: token を忘れた場合は「wtm token reset」で作り直せます");
  }
  return lines;
}

/**
 * 作った token を、起動の表示（`startupLines`）で出せないまま終わるときの表示（「作った token は必ず一度表示される」。
 * D102・D103）。token は auth.json に保存済みで、次の起動では表示されない。起動の途中で終了のシグナルを受けたときも出す。
 */
export function lastChanceTokenLines(token: string): string[] {
  return [
    `wtm: token（今回作成・この表示が最後）: ${token}`,
    // 起動の失敗・表示の失敗・起動の途中の終了のシグナルのどれでも出すので、理由は問わない言い方にする。
    "wtm: 起動を最後まで終えませんでしたが token は保存済みです。次の起動ではこの token でログインできます（失くしたら「wtm token reset」で作り直せます）",
  ];
}
