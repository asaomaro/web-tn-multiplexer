import { join } from "node:path";
import { z } from "zod";
import type { LayoutNode, PaneStatus, SplitDirection } from "@wtm/protocol";
import type { NextIdCounters } from "@wtm/protocol";
import { readFileWithBackup, writeFileAtomic, type ReadResult } from "./atomicFile.js";

/**
 * `session.json` の保存形式（design.md「永続化の形式」。`nextId` は architecture.md の独立点検で
 * split/agent の id も持つよう拡張済み）。プロセスの実体は持たない（cwd から新しいシェルを起動して復元する）。
 */
export interface SessionFilePane {
  id: string;
  label: string | null;
  cwd: string;
  shell: string;
  status?: PaneStatus | undefined;
}
export interface SessionFileTab {
  id: string;
  label: string;
  focusedPaneId: string;
  zoomedPaneId: string | null;
  layout: LayoutNode;
  panes: SessionFilePane[];
}
export interface SessionFileWorkspace {
  id: string;
  label: string;
  cwd: string;
  activeTabId: string;
  tabs: SessionFileTab[];
}
export interface SessionFileData {
  schema: 1;
  savedAt: string;
  nextId: NextIdCounters;
  workspaces: SessionFileWorkspace[];
  focus: { workspaceId: string; tabId: string; paneId: string } | null;
}

export interface SessionFile {
  load(): Promise<ReadResult<SessionFileData>>;
  save(data: SessionFileData): Promise<void>;
}

// レビュー指摘：以前は schema===1 と workspaces が配列であることしか見ておらず、残りは無検証の `as` キャスト
// だった（D29 の zod パターンから外れていた）。手編集・破損したファイルがここを素通りすると、
// `SessionService.restore()` の中で不意な例外になる。ここで形を検証し、壊れていれば「壊れたファイル」の
// 扱い（バックアップへ退避してフレッシュ起動）に正しく合流させる。
const LayoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("pane"), paneId: z.string() }),
    z.object({
      type: z.literal("split"),
      id: z.string(),
      dir: z.enum(["right", "down"]),
      ratio: z.number(),
      a: LayoutNodeSchema,
      b: LayoutNodeSchema,
    }),
  ]),
);
const SessionFilePaneSchema: z.ZodType<SessionFilePane> = z.object({
  id: z.string(),
  label: z.string().nullable(),
  cwd: z.string(),
  shell: z.string(),
  status: z.enum(["running", "failed"]).optional(),
});
const SessionFileTabSchema: z.ZodType<SessionFileTab> = z.object({
  id: z.string(),
  label: z.string(),
  focusedPaneId: z.string(),
  zoomedPaneId: z.string().nullable(),
  layout: LayoutNodeSchema,
  panes: z.array(SessionFilePaneSchema),
});
const SessionFileWorkspaceSchema: z.ZodType<SessionFileWorkspace> = z.object({
  id: z.string(),
  label: z.string(),
  cwd: z.string(),
  activeTabId: z.string(),
  tabs: z.array(SessionFileTabSchema),
});
const NextIdCountersSchema: z.ZodType<NextIdCounters> = z.object({
  w: z.number(),
  t: z.number(),
  p: z.number(),
  s: z.number(),
  a: z.number(),
});
const SessionFileDataSchema: z.ZodType<SessionFileData> = z.object({
  schema: z.literal(1),
  savedAt: z.string(),
  nextId: NextIdCountersSchema,
  workspaces: z.array(SessionFileWorkspaceSchema),
  focus: z.object({ workspaceId: z.string(), tabId: z.string(), paneId: z.string() }).nullable(),
});

export class FsSessionFile implements SessionFile {
  private readonly filePath: string;
  private readonly backupsDir: string;

  constructor(stateDir: string) {
    this.filePath = join(stateDir, "session.json");
    this.backupsDir = join(stateDir, "session-backups");
  }

  async load(): Promise<ReadResult<SessionFileData>> {
    return readFileWithBackup(this.filePath, this.backupsDir, (raw) => {
      // `parse` が投げれば「壊れている」扱いになる（readFileWithBackup の契約）。
      return SessionFileDataSchema.parse(JSON.parse(raw));
    });
  }

  async save(data: SessionFileData): Promise<void> {
    await writeFileAtomic(this.filePath, JSON.stringify(data, null, 2));
  }
}

// re-export so callers only need to import from this module for the layout shape
export type { LayoutNode, SplitDirection };
