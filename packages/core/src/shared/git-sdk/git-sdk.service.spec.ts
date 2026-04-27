import { GitSdkService } from "./git-sdk.service";

class TestGitSdkService extends GitSdkService {
  parseNameStatus(output: string) {
    return this.parseNameStatusOutput(output);
  }
}

describe("shared/git-sdk/git-sdk.service", () => {
  it("解析 rename 状态时应使用新文件路径", () => {
    const service = new TestGitSdkService();

    const result = service.parseNameStatus("R100\told.ts\tnew.ts\n");

    expect(result).toEqual([{ filename: "new.ts", status: "renamed" }]);
  });
});
