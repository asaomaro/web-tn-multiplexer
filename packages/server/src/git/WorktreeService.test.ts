import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Workspace } from "@wtm/protocol";
import { RpcError } from "@wtm/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryLogger } from "../log/Logger.js";
import type { SessionService } from "../session/SessionService.js";
import { makeTempDir } from "../persist/atomicFile.js";
import { ChildProcessGitRunner } from "../infra/GitRunner.js";
import { DefaultWorktreeService, classifyWorktreeError, defaultWorktreeRoot } from "./WorktreeService.js";

const git = new ChildProcessGitRunner();
async function runGit(cwd: string, args: string[]): Promise<void> {
  const r = await git.run(cwd, args, 10_000);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
}

/** `getWorkspace` しか使わないので、そこだけ持つ最小の代役にする（git の振る舞いに集中するため）。 */
function sessionWith(cwd: string | null): SessionService {
  return { getWorkspace: (): Workspace | undefined => (cwd === null ? undefined : ({ cwd } as Workspace)) } as unknown as SessionService;
}

describe("DefaultWorktreeService（本物の git を使う。既存の GitInfoPoller.test.ts と同じ流儀）", () => {
  let repo: string;
  let root: string;

  beforeEach(async () => {
    repo = await makeTempDir("wtm-worktree-repo-");
    root = await makeTempDir("wtm-worktree-root-");
    await runGit(repo, ["init", "-b", "main"]);
    await runGit(repo, ["config", "user.email", "t@example.com"]);
    await runGit(repo, ["config", "user.name", "t"]);
    await runGit(repo, ["commit", "-q", "--allow-empty", "-m", "init"]);
  });

  function make(cwd: string | null = repo): DefaultWorktreeService {
    return new DefaultWorktreeService(sessionWith(cwd), git, new MemoryLogger(), root, () => 0);
  }

  it("list：リポジトリ名と候補のブランチ名を返し、自分自身を一覧に載せる", async () => {
    const out = await make().list("w1");
    expect(out.repoName).not.toBe("."); // 直下で実行すると `--git-common-dir` は相対の `.git`。絶対化していないとこうなる
    expect(out.suggestedBranch).toBe("worktree/brave-river-0000"); // seed=0
    expect(out.worktreeRoot).toBe(root);
    expect(out.entries.map((e) => e.branch)).toEqual(["main"]);
  });

  it("create：新しいブランチで worktree ができ、一覧に増える", async () => {
    const created = await make().create("w1", "feature/x");
    expect(created.path).toBe(`${root}/${(await make().list("w1")).repoName}/feature-x`);
    const after = await make().list("w1");
    expect(after.entries.map((e) => e.branch).sort()).toEqual(["feature/x", "main"]);
  });

  it("create：既にあるブランチでも作れる（-b を付けない）", async () => {
    await runGit(repo, ["branch", "existing"]);
    const created = await make().create("w1", "existing");
    expect(created.path).toContain("/existing");
  });

  // ここが AC7 の核心：ケースごとに**別のコード**になる。文言は web が code から引く。
  // 実測（git 2.43）：**同じブランチを 2 回**作ると、git は「ブランチが使用中」ではなく
  // **「パスが既にある」**を返す——作成先がブランチ名から決まるので、先にパスがぶつかるため。
  it("create：同じブランチを 2 回なら worktree_path_exists（パスが先にぶつかる）", async () => {
    await make().create("w1", "dup");
    await expect(make().create("w1", "dup")).rejects.toMatchObject({ code: "worktree_path_exists" });
  });

  // ブランチだけが別の場所で使われていて、作成先は空いている場合。
  it("create：そのブランチが別の場所で使われていれば worktree_branch_in_use", async () => {
    const elsewhere = join(await makeTempDir("wtm-worktree-else-"), "co");
    await runGit(repo, ["worktree", "add", "-q", "-b", "taken", elsewhere, "HEAD"]);
    await expect(make().create("w1", "taken")).rejects.toMatchObject({ code: "worktree_branch_in_use" });
  });

  // 実測：**空のディレクトリへは成功する**（git が許す）ので、中身のあるディレクトリで確かめる。
  it("create：作成先に中身のあるディレクトリがあれば worktree_path_exists", async () => {
    const repoName = (await make().list("w1")).repoName;
    const dir = join(root, repoName, "occupied");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "f"), "x");
    await expect(make().create("w1", "occupied")).rejects.toMatchObject({ code: "worktree_path_exists" });
  });

  it("git でないディレクトリなら not_a_git_repository", async () => {
    const plain = await makeTempDir("wtm-worktree-plain-");
    await expect(make(plain).list("w1")).rejects.toMatchObject({ code: "not_a_git_repository" });
  });

  it("workspace が無ければ not_found", async () => {
    await expect(make(null).list("missing")).rejects.toBeInstanceOf(RpcError);
    await expect(make(null).list("missing")).rejects.toMatchObject({ code: "not_found" });
  });

  // cross 点検の must。**git は記録するパスの symlink を解決する**ので、`worktree add` に渡した文字列と
  // `worktree list --porcelain` が返す文字列は食い違いうる。web の「既に開いている」判定は cwd の完全一致
  // （`ActionDispatcher.confirmWorktreeOpen`）なので、ここが揃っていないと**作った worktree を一覧から
  // 選ぶと同じ場所に 2 つ目の workspace ができる**（AC6 が防ごうとした事象そのもの）。
  it("create：返すパスは、git が実際に記録したもの（root が symlink 経由でも一覧と一致する。AC6）", async () => {
    const real = await makeTempDir("wtm-worktree-real-");
    const link = join(await makeTempDir("wtm-worktree-link-"), "root");
    await symlink(real, link);
    const svc = new DefaultWorktreeService(sessionWith(repo), git, new MemoryLogger(), link, () => 0);

    const created = await svc.create("w1", "via-link");
    const listed = (await svc.list("w1")).entries.find((e) => e.branch === "via-link");
    expect(listed, "作ったものが一覧に出ている").toBeDefined();
    expect(created.path, "create の戻り値が list と同じ文字列").toBe(listed!.path);
    expect(created.path).toContain(real); // symlink 側ではなく解決後
  });

  // `--git-common-dir` は成功するので、ここまで来ないと分からない（メニューの出し分けとは判定が違う）。
  it("create：コミットが 1 つも無い repo なら worktree_no_commits", async () => {
    const empty = await makeTempDir("wtm-worktree-empty-");
    await runGit(empty, ["init", "-b", "main"]);
    await expect(make(empty).create("w1", "x")).rejects.toMatchObject({ code: "worktree_no_commits" });
  });

  // ダイアログは空白入りを素通しし、プレビューは `-` に畳んだもっともらしいパスを見せるので、
  // ここで分けないと「サーバのログを確かめてください」になり、名前を変えればよいと分からない。
  it("create：Git が受け付けないブランチ名なら worktree_invalid_branch", async () => {
    await expect(make().create("w1", "foo bar")).rejects.toMatchObject({ code: "worktree_invalid_branch" });
  });

  // Git のブランチは refs のディレクトリなので `foo` と `foo/bar` は同時に存在できない。
  // これも「名前を変えればよい」種類なので、catch-all に落とさない。
  it("create：既存ブランチと階層が衝突する名前も worktree_invalid_branch", async () => {
    await runGit(repo, ["branch", "foo"]);
    await expect(make().create("w1", "foo/bar")).rejects.toMatchObject({ code: "worktree_invalid_branch" });
  });

  // `recordedPath` は add が**成功した後**に呼ばれる。ここで投げると、worktree は作られているのに
  // 「失敗しました」になり、削除手段がこの work に無いので片付けられなくなる。
  it("create：記録パスを引けなくても、作成自体は失敗にしない（組み立てた文字列で返す）", async () => {
    const flaky = {
      run: (cwd: string, args: string[], ms: number) =>
        args[0] === "rev-parse" && args[1] === "--show-toplevel"
          ? Promise.reject(new Error("timeout"))
          : git.run(cwd, args, ms),
    };
    const svc = new DefaultWorktreeService(sessionWith(repo), flaky, new MemoryLogger(), root, () => 0);
    const created = await svc.create("w1", "flaky");
    expect(created.path).toBe(`${root}/${(await make().list("w1")).repoName}/flaky`);
  });

  // `GitRunner` が reject する経路（git が無い・時間切れ）。包まないと `ControlSurface` が `internal` に潰し、
  // 利用者には「サーバの内部でエラー」としか出ない（design「エラー処理 / 異常系」）。
  it("git を起動できなければ、素の Error ではなく RpcError(worktree_failed) にする", async () => {
    const broken = { run: () => Promise.reject(new Error("spawn git ENOENT")) };
    const svc = new DefaultWorktreeService(sessionWith(repo), broken, new MemoryLogger(), root, () => 0);
    await expect(svc.list("w1")).rejects.toBeInstanceOf(RpcError);
    await expect(svc.list("w1")).rejects.toMatchObject({ code: "worktree_failed" });
  });
});

describe("classifyWorktreeError", () => {
  // `git worktree add` は**失敗時も 1 行目が進行の表示**。理由は `fatal:` の行にある。
  it("1 行目の Preparing worktree に釣られず、fatal: の行を見る", () => {
    const stderr = "Preparing worktree (new branch 'x')\nfatal: 'x' is already used by worktree at '/w/x'\n";
    expect(classifyWorktreeError(stderr)).toBe("worktree_branch_in_use");
  });

  it("パスが既にある", () => {
    expect(classifyWorktreeError("Preparing worktree\nfatal: '/w/x' already exists\n")).toBe("worktree_path_exists");
  });

  it("コミットが 1 つも無い repo", () => {
    expect(classifyWorktreeError("Preparing worktree\nfatal: invalid reference: HEAD\n")).toBe("worktree_no_commits");
  });

  it("Git が受け付けないブランチ名", () => {
    expect(classifyWorktreeError("Preparing worktree\nfatal: 'foo bar' is not a valid branch name\n")).toBe("worktree_invalid_branch");
  });

  it("既存ブランチとの階層の衝突", () => {
    const stderr = "Preparing worktree\nfatal: cannot lock ref 'refs/heads/foo/bar': 'refs/heads/foo' exists; cannot create 'refs/heads/foo/bar'\n";
    expect(classifyWorktreeError(stderr)).toBe("worktree_invalid_branch");
  });

  it("知らない理由は worktree_failed", () => {
    expect(classifyWorktreeError("fatal: something else\n")).toBe("worktree_failed");
  });
});

describe("defaultWorktreeRoot", () => {
  it("ホームの下の .wtm/worktrees を / 区切りで返す", () => {
    expect(defaultWorktreeRoot("/home/me")).toBe("/home/me/.wtm/worktrees");
    expect(defaultWorktreeRoot("C:\\Users\\me")).toBe("C:/Users/me/.wtm/worktrees");
  });
});
