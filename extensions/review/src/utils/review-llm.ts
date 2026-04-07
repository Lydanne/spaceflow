import type { PullRequestCommit } from "@spaceflow/core";

export function buildLinesWithNumbers(contentLines: [string, string][]): string {
  const padWidth = String(contentLines.length).length;
  return contentLines
    .map(([hash, line], index) => {
      const lineNum = index + 1;
      return `${hash} ${String(lineNum).padStart(padWidth)}| ${line}`;
    })
    .join("\n");
}

export function buildCommitsSection(
  contentLines: [string, string][],
  commits: PullRequestCommit[],
): string {
  const fileCommitHashes = new Set<string>();
  for (const [hash] of contentLines) {
    if (hash !== "-------") {
      fileCommitHashes.add(hash);
    }
  }
  const relatedCommits = commits.filter((c) => {
    const shortHash = c.sha?.slice(0, 7) || "";
    return fileCommitHashes.has(shortHash);
  });
  return relatedCommits.length > 0
    ? relatedCommits
        .map((c) => `- \`${c.sha?.slice(0, 7)}\` ${c.commit?.message?.split("\n")[0]}`)
        .join("\n")
    : "- 无相关 commits";
}
