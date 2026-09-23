import { join } from "node:path";
import { z } from "zod";
import { readFileWithBackup, writeFileAtomic, type ReadResult } from "./atomicFile.js";

/**
 * `integrations.json` の保存形式（20260923-agent-session-resume design「2. 自動再開の設定」）。
 * **「導入済みか」はここに持たない**——利用者が手動で対象の hooks 設定ファイルを編集する可能性があるため、
 * `AgentIntegrationInstaller` が都度読んで判定する（design D4）。ここに持つのは、サーバ全体に効く
 * 「自動再開の可否」という利用者の意思決定だけ（herdr の `resume_agents_on_restore` に相当。design D3）。
 */
export interface IntegrationFileData {
  schema: 1;
  autoResumeEnabled: boolean;
}

export interface IntegrationFile {
  load(): Promise<ReadResult<IntegrationFileData>>;
  save(data: IntegrationFileData): Promise<void>;
}

const IntegrationFileDataSchema: z.ZodType<IntegrationFileData> = z.object({
  schema: z.literal(1),
  autoResumeEnabled: z.boolean(),
});

/** 既定値（herdr の `resume_agents_on_restore` の既定 `true` に合わせる。decisions.md D3）。 */
export function defaultIntegrationFileData(): IntegrationFileData {
  return { schema: 1, autoResumeEnabled: true };
}

export class FsIntegrationFile implements IntegrationFile {
  private readonly filePath: string;
  private readonly backupsDir: string;

  constructor(stateDir: string) {
    this.filePath = join(stateDir, "integrations.json");
    this.backupsDir = join(stateDir, "integrations-backups");
  }

  async load(): Promise<ReadResult<IntegrationFileData>> {
    return readFileWithBackup(this.filePath, this.backupsDir, (raw) => {
      return IntegrationFileDataSchema.parse(JSON.parse(raw));
    });
  }

  async save(data: IntegrationFileData): Promise<void> {
    await writeFileAtomic(this.filePath, JSON.stringify(data, null, 2));
  }
}
