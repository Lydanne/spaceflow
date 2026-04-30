import { describe, it, expect, vi } from "vitest";
import { ReviewSourceResolver } from "./review-source-resolver";

describe("review-source-resolver", () => {
  describe("resolve", () => {
    it("本地 staged 模式应使用暂存区快照内容", async () => {
      const gitSdk = {
        getStagedFiles: vi.fn().mockReturnValue([{ filename: "test.ts", status: "modified" }]),
        getStagedDiff: vi.fn().mockReturnValue([
          {
            filename: "test.ts",
            patch: "@@ -1,2 +1,3 @@\n line1\n+staged\n line3",
          },
        ]),
        getStagedFileContent: vi.fn().mockReturnValue("line1\nstaged\nline3"),
        getWorkingFileContent: vi.fn(() => {
          throw new Error("不应读取工作区内容");
        }),
      };
      const resolver = new ReviewSourceResolver({} as any, gitSdk as any, {} as any);

      const result = await resolver.resolve({
        owner: "owner",
        repo: "repo",
        localMode: "staged",
        showAll: false,
      } as any);

      expect(gitSdk.getStagedFiles).toHaveBeenCalled();
      expect(gitSdk.getStagedDiff).toHaveBeenCalled();
      expect(gitSdk.getStagedFileContent).toHaveBeenCalledWith("test.ts");
      expect(gitSdk.getWorkingFileContent).not.toHaveBeenCalled();
      expect(result.fileContents.get("test.ts")?.[1]).toEqual(["+local+", "staged"]);
    });

    it("showAll=false 时应同步过滤掉仅由 merge commit 引入的文件", async () => {
      const issueFilter = {
        getFilesForCommit: vi.fn().mockResolvedValue(["src/pr.ts"]),
      };
      const resolver = new ReviewSourceResolver({} as any, {} as any, issueFilter as any);

      const result = await (resolver as any).applyPreFilters(
        {
          owner: "owner",
          repo: "repo",
          prNumber: 1,
          showAll: false,
        },
        [
          { sha: "merge1111", commit: { message: "Merge branch 'main' into feature" } },
          { sha: "feat2222", commit: { message: "feat: add pr change" } },
        ],
        [
          { filename: "src/from-main.ts", status: "modified" },
          { filename: "src/pr.ts", status: "modified" },
        ],
        false,
      );

      expect(result.commits.map((commit: any) => commit.sha)).toEqual(["feat2222"]);
      expect(result.changedFiles.map((file: any) => file.filename)).toEqual(["src/pr.ts"]);
      expect(issueFilter.getFilesForCommit).toHaveBeenCalledWith(
        "owner",
        "repo",
        "feat2222",
        1,
      );
    });
  });
});
