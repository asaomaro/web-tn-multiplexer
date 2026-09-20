import { join } from "node:path";
import { z } from "zod";
import { readFileWithBackup, writeFileAtomic, type ReadResult } from "./atomicFile.js";

/** `auth.json` の保存形式（design.md「永続化の形式」）。 */
export interface AuthFileToken {
  salt: string;
  hash: string;
  createdAt: string;
}
export interface AuthFileSession {
  idHash: string;
  createdAt: string;
  lastSeenAt: string;
}
export interface AuthFileData {
  schema: 1;
  token: AuthFileToken | null;
  sessions: AuthFileSession[];
}

export interface AuthFile {
  load(): Promise<ReadResult<AuthFileData>>;
  save(data: AuthFileData): Promise<void>;
}

// レビュー指摘（SessionFile と同じ）：残りのフィールドを無検証の `as` キャストにしない。
const AuthFileDataSchema: z.ZodType<AuthFileData> = z.object({
  schema: z.literal(1),
  token: z.object({ salt: z.string(), hash: z.string(), createdAt: z.string() }).nullable(),
  sessions: z.array(z.object({ idHash: z.string(), createdAt: z.string(), lastSeenAt: z.string() })),
});

export function emptyAuthFileData(): AuthFileData {
  return { schema: 1, token: null, sessions: [] };
}

export class FsAuthFile implements AuthFile {
  private readonly filePath: string;
  private readonly backupsDir: string;

  constructor(stateDir: string) {
    this.filePath = join(stateDir, "auth.json");
    this.backupsDir = join(stateDir, "auth-backups");
  }

  async load(): Promise<ReadResult<AuthFileData>> {
    return readFileWithBackup(this.filePath, this.backupsDir, (raw) => {
      return AuthFileDataSchema.parse(JSON.parse(raw));
    });
  }

  async save(data: AuthFileData): Promise<void> {
    await writeFileAtomic(this.filePath, JSON.stringify(data, null, 2));
  }
}
