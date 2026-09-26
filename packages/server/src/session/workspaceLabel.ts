import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import * as nodePath from "node:path";
import { withTimeout } from "./withTimeout.js";

/**
 * workspace の自動の名前（20260921-workspace-auto-label。herdr の `automatic_workspace_label`・`fallback_label_from_cwd`）。
 * **規則はこの 1 か所**（design D3）——`SessionService` の作成・名前変更・復元はここを呼ぶだけ。
 *
 * - git のリポジトリの中なら、チェックアウトの根のフォルダ名（worktree ならその worktree の根）。根は `.git` をたどって見つけ、
 *   **git のコマンドは使わない**（herdr の `git_repo_root`・`git_dir_for_repo_root`・`git_dir_is_bare`。`discovery.rs:198-246`・`:311-329`）。
 * - git の外なら、その場所のフォルダ名。ホームなら `~`、フォルダ名が無い根（`/`・`C:\`）ならパスそのもの（`fallback_label_from_cwd`。`:30-43`）。
 *   Windows の UNC の共有の根（`\\srv\share\`）は `path.win32.basename` が共有名を返すので共有名になる（herdr はパスそのもの。読みやすいので受け入れる）。
 */

/** 名前を決めるのにかける時間の上限（design D4）。超えたらフォルダ名の規則（根を探さない）。 */
export const AUTO_LABEL_TIMEOUT_MS = 200;

type PathApi = typeof nodePath;

export interface WorkspaceLabelDeps {
  /** path が指すもの。無ければ（読めなければ）null。 */
  stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean } | null>;
  /** ファイルの中身。読めなければ null。 */
  readFile: (path: string) => Promise<string | null>;
  home: () => string;
  /**
   * シンボリックリンクを解決した実パス。読めなければ null。無ければ解決しない（文字列の比較だけ）。追従で「同じディレクトリか」を見るのに使う
   * （監視は `/proc/<pid>/cwd` の実パスを入れるので、リンクを含む論理パスで開いた場所と文字列が違う。20260926-workspace-label-follow-cwd）。
   */
  realpath?: (path: string) => Promise<string | null>;
  /** パスの扱い（既定は `node:path`＝サーバの OS。テストで `path.win32` を渡して Windows の形を確かめる）。 */
  path?: PathApi;
  timeoutMs?: number;
  /**
   * 上限を超えたときに呼ぶ。`settled` は待つのをやめた問い合わせが後から返ったときに解決する——呼ぶ側（`SessionService`）は、それが返るまで
   * 新しく根を探さない（止まった fs に問い合わせを重ねない）。
   */
  onTimeout?: (settled: Promise<void>) => void;
}

/** herdr の `fallback_label_from_cwd`：ホームなら `~`、そうでなければ末尾の名前、それも無ければパスそのもの。 */
export function folderLabel(cwd: string, home: string, path: PathApi = nodePath): string {
  const resolved = path.resolve(cwd);
  if (home && sameDir(resolved, path.resolve(home), path)) return "~";
  return path.basename(resolved) || resolved;
}

/** win32 はドライブ文字・フォルダ名の大小を問わない（design「ドメイン固有の考慮」。herdr は `HOME` との完全一致——本製品との違い）。 */
function sameDir(a: string, b: string, path: PathApi): boolean {
  return path.sep === "\\" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** herdr の `git_repo_root`：cwd から親へたどって git の根を探す。無ければ null。 */
export async function findGitRoot(
  cwd: string,
  deps: WorkspaceLabelDeps,
  signal?: { cancelled: boolean },
): Promise<string | null> {
  const path = deps.path ?? nodePath;
  // 上限を超えた後（`signal.cancelled`）は fs に問い合わせず、無いものとして素早く終える（`rootWithin`）。
  if (signal) {
    const { stat, readFile } = deps;
    deps = {
      ...deps,
      stat: (p) => (signal.cancelled ? Promise.resolve(null) : stat(p)),
      readFile: (p) => (signal.cancelled ? Promise.resolve(null) : readFile(p)),
    };
  }
  const start = path.resolve(cwd);
  let current = (await deps.stat(start))?.isDirectory ? start : path.dirname(start);
  for (;;) {
    const gitDir = await gitDirFor(current, deps, path);
    if (gitDir !== null && (await deps.stat(path.join(gitDir, "HEAD")))?.isFile) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** herdr の `git_dir_for_repo_root`：その階層の git のディレクトリ。無ければ null。 */
async function gitDirFor(
  dir: string,
  deps: WorkspaceLabelDeps,
  path: PathApi,
): Promise<string | null> {
  const dotGit = path.join(dir, ".git");
  const st = await deps.stat(dotGit);
  if (st?.isDirectory) return dotGit;
  if (st?.isFile) {
    const text = await deps.readFile(dotGit);
    const trimmed = text?.trim() ?? "";
    if (trimmed.startsWith("gitdir:")) {
      const target = trimmed.slice("gitdir:".length).trim();
      // 相対は `dir` からの字面の結合（`join` は `..` を字面で畳むので、`dir` がシンボリックリンクの中だと herdr・git と答えが違いうる——
      // herdr は `..` をそのまま OS に解決させる。cwd にリンクが入るのは利用者が指定した場所・復元のときだけで、まれなので受け入れる）。
      return path.isAbsolute(target) ? target : path.join(dir, target);
    }
  }
  return (await isBareRepo(dir, deps, path)) ? dir : null;
}

/** herdr の `path_is_git_dir_layout` と `git_dir_is_bare`：`HEAD`・`objects`・`refs` があり、`config` の `core.bare` が true。 */
async function isBareRepo(dir: string, deps: WorkspaceLabelDeps, path: PathApi): Promise<boolean> {
  const [head, objects, refs] = await Promise.all([
    deps.stat(path.join(dir, "HEAD")),
    deps.stat(path.join(dir, "objects")),
    deps.stat(path.join(dir, "refs")),
  ]);
  if (!head?.isFile || !objects?.isDirectory || !refs?.isDirectory) return false;
  const config = await deps.readFile(path.join(dir, "config"));
  return config !== null && gitConfigValue(config, "core", "bare")?.toLowerCase() === "true";
}

/** herdr の `read_git_config_value`（`discovery.rs:253-276`）：`[section]` の `key = value`。節名・キーは大小を問わない。 */
export function gitConfigValue(text: string, sectionName: string, key: string): string | null {
  let inSection = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const section = simpleSection(line);
    if (section !== null) {
      inSection = section.toLowerCase() === sectionName.toLowerCase();
      continue;
    }
    // 引用符つきの節（`[remote "origin"]`）・閉じていない見出しは素通りし、前の節のまま（herdr の `simple_git_config_section` が None の場合と同じ）。
    if (!inSection) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    if (line.slice(0, eq).trim().toLowerCase() === key.toLowerCase())
      return stripComment(line.slice(eq + 1)).trim();
  }
  return null;
}

/** herdr の `simple_git_config_section`：`[name]` の name。引用符を含む・閉じていないなら null。 */
function simpleSection(line: string): string | null {
  if (!line.startsWith("[")) return null;
  const end = line.indexOf("]");
  if (end < 0) return null;
  const name = line.slice(1, end).trim();
  return name.includes('"') ? null : name;
}

/** 値の後ろの ` #…`・` ;…` を捨てる（herdr の `strip_git_config_comment`）。 */
function stripComment(value: string): string {
  const v = value.trim();
  for (const marker of ["#", ";"]) {
    const i = v.indexOf(marker);
    if (i > 0 && /\s/.test(v[i - 1]!)) return v.slice(0, i);
  }
  return v;
}

/**
 * 自動の名前。根があれば根の末尾の名前（空ならフォルダ名の規則）、無ければフォルダ名の規則。上限を超えたらフォルダ名の規則。**投げない**——
 * 代わりの処理（`folderLabel`・`deps.home()`）が投げても、最後はパスの末尾の名前かパスそのものを返す。
 */
export async function autoWorkspaceLabel(cwd: string, deps: WorkspaceLabelDeps): Promise<string> {
  const path = deps.path ?? nodePath;
  const root = await rootWithin(cwd, deps);
  if (root === null) return folderLabelOf(cwd, deps);
  return path.basename(root) || folderLabelOf(cwd, deps);
}

/** 根を探さずにフォルダ名の規則で決める。**投げない**（`deps.home()` が投げたら、パスの末尾の名前かパスそのもの）。 */
export function folderLabelOf(cwd: string, deps: WorkspaceLabelDeps): string {
  const path = deps.path ?? nodePath;
  try {
    return folderLabel(cwd, deps.home(), path);
  } catch {
    return path.basename(cwd) || cwd;
  }
}

/**
 * 上限つきで根を探す。**上限を超えたら、それ以上 fs に問い合わせない**（待つのをやめても出した stat は取り消されず、応答しないファイルシステムでは
 * libuv のスレッドを 1 本ずつ塞ぐ——止まった階層の後も親へ stat を出し続けると、塞がる数が増える。review ラウンド 1）。`deps.onTimeout` で呼ぶ側にも知らせる。
 */
function rootWithin(cwd: string, deps: WorkspaceLabelDeps): Promise<string | null> {
  const signal = { cancelled: false };
  return withTimeout(
    () => findGitRoot(cwd, deps, signal),
    deps.timeoutMs ?? AUTO_LABEL_TIMEOUT_MS,
    (settled) => {
      signal.cancelled = true;
      deps.onTimeout?.(settled);
    },
  );
}

/** 本番の deps（fs/promises・os.homedir）。`home` は中で捕まえ、投げたら `""`（ホームと一致しない）を返す。 */
export const defaultWorkspaceLabelDeps: WorkspaceLabelDeps = {
  stat: async (p) => {
    try {
      const st = await stat(p);
      return { isDirectory: st.isDirectory(), isFile: st.isFile() };
    } catch {
      return null;
    }
  },
  readFile: async (p) => {
    try {
      return await readFile(p, "utf8");
    } catch {
      return null;
    }
  },
  realpath: async (p) => {
    try {
      return await realpath(p);
    } catch {
      return null;
    }
  },
  home: () => {
    try {
      return homedir();
    } catch {
      return "";
    }
  },
};
