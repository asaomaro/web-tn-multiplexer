/**
 * worktree の作成先を組み立てる規則（20260920-git-worktree-actions）。
 *
 * **server と web の両方が使う**——web は入力中のブランチ名からパスのプレビューを出し、
 * server は実際にそこへ作る。2 箇所に書くと必ずずれるので、ここ 1 つに置く。
 *
 * 規則は herdr（`da6bcd5`）の `src/worktree.rs:34-54`・`:171-173` を TypeScript へ移したもの
 * （Apache-2.0。`NOTICE` と `third_party/herdr/README.md` を参照）。
 *
 * **`node:*` を import しない**。この package は web のバンドルにも入るので、Node 固有の API を
 * 持ち込むとビルドが壊れる（依存は zod だけ）。パスは `/` で連結する。
 */

/**
 * ブランチ名をパスの一部にする。ASCII の英数字は小文字にしてそのまま、
 * **それ以外の連続は `-` 1 個に畳む**（`a//b` が `a--b` にならない）。前後の `-` は落とす。
 * 空になったら `"worktree"`。
 *
 * この畳み込みがあるので、**入力で `..` や `/` を使って親ディレクトリへ抜けられない**。
 */
export function branchToPathSlug(branch: string): string {
  let slug = "";
  let lastWasDash = false;
  for (const ch of branch) {
    if (/[0-9A-Za-z]/.test(ch)) {
      slug += ch.toLowerCase();
      lastWasDash = false;
    } else if (!lastWasDash) {
      slug += "-";
      lastWasDash = true;
    }
  }
  const trimmed = slug.replace(/^-+/, "").replace(/-+$/, "");
  return trimmed === "" ? "worktree" : trimmed;
}

/** 作成先は `<root>/<repo 名>/<ブランチのスラグ>`（herdr と同じ並び）。 */
export function defaultCheckoutPath(root: string, repoName: string, branch: string): string {
  const base = root.replace(/\/+$/, "");
  return `${base}/${repoName}/${branchToPathSlug(branch)}`;
}
