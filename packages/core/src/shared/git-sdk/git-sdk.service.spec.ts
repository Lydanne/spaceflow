import { GitSdkService } from "./git-sdk.service";

class TestGitSdkService extends GitSdkService {
  parseNameStatus(output: string) {
    return this.parseNameStatusOutput(output);
  }
}

describe("shared/git-sdk/git-sdk.service", () => {
  describe("parseNameStatusOutput", () => {
    const service = new TestGitSdkService();

    it("解析 rename 状态时应使用新文件路径", () => {
      const result = service.parseNameStatus("R100\told.ts\tnew.ts\n");

      expect(result).toEqual([{ filename: "new.ts", status: "renamed" }]);
    });

    it("解析 copy 状态时应使用复制后的文件路径", () => {
      const result = service.parseNameStatus("C75\told.ts\tcopy.ts\n");

      expect(result).toEqual([{ filename: "copy.ts", status: "copied" }]);
    });

    it("rename 缺少新路径时回退到旧路径", () => {
      const result = service.parseNameStatus("R100\told.ts\n");

      expect(result).toEqual([{ filename: "old.ts", status: "renamed" }]);
    });

    it("解析普通修改和删除状态", () => {
      const result = service.parseNameStatus("M\tsrc/a.ts\nD\tsrc/old.ts\n");

      expect(result).toEqual([
        { filename: "src/a.ts", status: "modified" },
        { filename: "src/old.ts", status: "deleted" },
      ]);
    });
  });
});
