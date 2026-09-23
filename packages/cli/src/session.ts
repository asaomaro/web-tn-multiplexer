import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * cookie のローカルキャッシュ（design.md「`SessionStore`」節・decisions.md D5）。**保存するのは session
 * cookie だけ**（token は保存しない）。キーは `url` を正規化した origin 文字列（`${protocol}//${host}`）。
 */

export interface CachedSession {
  cookie: string;
  createdAt: string;
}

interface SessionFile {
  sessions: Record<string, CachedSession>;
}

export interface SessionStore {
  get(url: string): Promise<string | undefined>;
  set(url: string, cookie: string): Promise<void>;
  clear(url: string): Promise<void>;
}

export function defaultSessionFilePath(): string {
  return join(homedir(), ".wtmctl", "session.json");
}

/** `url` を origin 文字列（`scheme://host`）へ正規化する。不正な URL ならそのまま返す（呼び出し側で弾かれる）。 */
function originOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

function isSessionFile(v: unknown): v is SessionFile {
  if (typeof v !== "object" || v === null) return false;
  const sessions = (v as { sessions?: unknown }).sessions;
  if (typeof sessions !== "object" || sessions === null) return false;
  return Object.values(sessions as Record<string, unknown>).every(
    (s) => typeof s === "object" && s !== null && typeof (s as CachedSession).cookie === "string" && typeof (s as CachedSession).createdAt === "string",
  );
}

export class FsSessionStore implements SessionStore {
  constructor(private readonly filePath: string = defaultSessionFilePath()) {}

  private async load(): Promise<SessionFile> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch {
      // 無い（初回）。壊れているのと同じ扱いで空から始める。
      return { sessions: {} };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      // ファイルが壊れている（JSON parse 失敗・形が違う）場合は空として扱う（design「`SessionStore`」節）。
      // 利用者が手で壊れた設定を直せるよう、次の `login`/自動ログインで上書きされる。
      return isSessionFile(parsed) ? parsed : { sessions: {} };
    } catch {
      return { sessions: {} };
    }
  }

  private async save(data: SessionFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  async get(url: string): Promise<string | undefined> {
    const data = await this.load();
    return data.sessions[originOf(url)]?.cookie;
  }

  async set(url: string, cookie: string): Promise<void> {
    const data = await this.load();
    data.sessions[originOf(url)] = { cookie, createdAt: new Date().toISOString() };
    await this.save(data);
  }

  async clear(url: string): Promise<void> {
    const data = await this.load();
    if (!(originOf(url) in data.sessions)) return;
    delete data.sessions[originOf(url)];
    await this.save(data);
  }
}
