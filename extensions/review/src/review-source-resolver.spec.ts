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
  });
});
