import { vi, type Mock } from "vitest";
import { readFile } from "fs/promises";
import { ReviewContextBuilder } from "./review-context";

vi.mock("fs", () => ({
  globSync: vi.fn(),
}));

vi.mock("fs/promises");

describe("ReviewContextBuilder", () => {
  let builder: ReviewContextBuilder;
  let gitProvider: any;
  let configService: any;
  let mockGitSdkService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    gitProvider = {
      searchUsers: vi.fn().mockResolvedValue([]),
    };

    configService = {
      get: vi.fn(),
      getPluginConfig: vi.fn().mockReturnValue({}),
      registerSchema: vi.fn(),
    };

    mockGitSdkService = {
      getRemoteUrl: vi.fn().mockReturnValue(null),
      parseRepositoryFromRemoteUrl: vi.fn().mockReturnValue(null),
      getCurrentBranch: vi.fn().mockReturnValue("main"),
      getDefaultBranch: vi.fn().mockReturnValue("main"),
    };

    builder = new ReviewContextBuilder(
      gitProvider as any,
      configService as any,
      mockGitSdkService as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getPrNumberFromEvent", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return undefined if GITHUB_EVENT_PATH and GITEA_EVENT_PATH are not set", async () => {
      delete process.env.GITHUB_EVENT_PATH;
      delete process.env.GITEA_EVENT_PATH;
      const prNumber = await builder.getPrNumberFromEvent();
      expect(prNumber).toBeUndefined();
    });

    it("should parse prNumber from GITHUB_EVENT_PATH", async () => {
      const mockEventPath = "/tmp/event.json";
      process.env.GITHUB_EVENT_PATH = mockEventPath;
      const mockEventContent = JSON.stringify({ pull_request: { number: 456 } });

      (readFile as Mock).mockResolvedValue(mockEventContent);

      const prNumber = await builder.getPrNumberFromEvent();
      expect(prNumber).toBe(456);
    });

    it("should parse prNumber from GITEA_EVENT_PATH when GITHUB_EVENT_PATH is not set", async () => {
      delete process.env.GITHUB_EVENT_PATH;
      const mockEventPath = "/tmp/gitea-event.json";
      process.env.GITEA_EVENT_PATH = mockEventPath;
      const mockEventContent = JSON.stringify({ pull_request: { number: 789 } });

      (readFile as Mock).mockResolvedValue(mockEventContent);

      const prNumber = await builder.getPrNumberFromEvent();
      expect(prNumber).toBe(789);
    });
  });

  describe("resolveAnalyzeDeletions", () => {
    it("should return boolean directly", () => {
      expect(builder.resolveAnalyzeDeletions(true, { ci: false, hasPrNumber: false })).toBe(true);
      expect(builder.resolveAnalyzeDeletions(false, { ci: true, hasPrNumber: true })).toBe(false);
    });

    it("should resolve 'ci' mode", () => {
      expect(builder.resolveAnalyzeDeletions("ci", { ci: true, hasPrNumber: false })).toBe(true);
      expect(builder.resolveAnalyzeDeletions("ci", { ci: false, hasPrNumber: false })).toBe(false);
    });

    it("should resolve 'pr' mode", () => {
      expect(builder.resolveAnalyzeDeletions("pr", { ci: false, hasPrNumber: true })).toBe(true);
      expect(builder.resolveAnalyzeDeletions("pr", { ci: false, hasPrNumber: false })).toBe(false);
    });

    it("should resolve 'terminal' mode", () => {
      expect(builder.resolveAnalyzeDeletions("terminal", { ci: false, hasPrNumber: false })).toBe(
        true,
      );
      expect(builder.resolveAnalyzeDeletions("terminal", { ci: true, hasPrNumber: false })).toBe(
        false,
      );
    });

    it("should return false for unknown mode", () => {
      expect(
        builder.resolveAnalyzeDeletions("unknown" as any, { ci: false, hasPrNumber: false }),
      ).toBe(false);
    });
  });

  describe("normalizeFilePaths", () => {
    it("should return undefined for empty array", () => {
      expect(builder.normalizeFilePaths([])).toEqual([]);
    });

    it("should return undefined for undefined input", () => {
      expect(builder.normalizeFilePaths(undefined)).toBeUndefined();
    });

    it("should keep relative paths as-is", () => {
      const result = builder.normalizeFilePaths(["src/app.ts", "lib/util.ts"]);
      expect(result).toEqual(["src/app.ts", "lib/util.ts"]);
    });
  });

  describe("getContextFromEnv - includes 直接文件模式", () => {
    let globSync: Mock;

    const makeEntries = (paths: string[]) =>
      paths.map((p) => {
        const parts = p.split("/");
        const name = parts.pop()!;
        const parentPath = parts.join("/");
        const isFile = name.includes(".");
        return { name, parentPath, isFile: () => isFile };
      });

    beforeEach(async () => {
      const fs = await import("fs");
      globSync = fs.globSync as unknown as Mock;
      mockGitSdkService.getRemoteUrl.mockReturnValue("https://github.com/owner/repo.git");
      mockGitSdkService.parseRepositoryFromRemoteUrl.mockReturnValue({
        owner: "owner",
        repo: "repo",
      });
    });

    it("无 PR/base/head 上下文 + 有 includes → 展开 glob 写入 files", async () => {
      globSync.mockImplementation((pattern: string) => {
        if (pattern === "src/**/*.ts") return makeEntries(["src/a.ts", "src/b.ts"]);
        return [];
      });

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        includes: ["src/**/*.ts"],
      });

      expect(ctx.files).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("有 PR 上下文 + 有 includes → 不展开，files 为 undefined", async () => {
      globSync.mockReturnValue(makeEntries(["src/a.ts"]));

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        includes: ["src/**/*.ts"],
        prNumber: 42,
      });

      expect(ctx.files).toBeUndefined();
      expect(globSync).not.toHaveBeenCalled();
    });

    it("有 base/head + 有 includes → 不展开，files 为 undefined", async () => {
      globSync.mockReturnValue(makeEntries(["src/a.ts"]));

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        includes: ["src/**/*.ts"],
        base: "main",
        head: "feature",
      });

      expect(ctx.files).toBeUndefined();
      expect(globSync).not.toHaveBeenCalled();
    });

    it("ci 模式 + 有 includes → 不展开，files 为 undefined", async () => {
      globSync.mockReturnValue(makeEntries(["src/a.ts"]));
      gitProvider.validateConfig = vi.fn();
      configService.get.mockReturnValue({ repository: "owner/repo" });

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: true,
        includes: ["src/**/*.ts"],
      });

      expect(ctx.files).toBeUndefined();
      expect(globSync).not.toHaveBeenCalled();
    });

    it("includes + 同时指定 files → 合并展开结果与 files", async () => {
      globSync.mockImplementation((pattern: string) => {
        if (pattern === "src/**/*.ts") return makeEntries(["src/a.ts"]);
        return [];
      });

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        files: ["lib/util.ts"],
        includes: ["src/**/*.ts"],
      });

      expect(ctx.files).toEqual(["lib/util.ts", "src/a.ts"]);
    });

    it("includes glob 展开为空列表 → files 为空数组", async () => {
      globSync.mockReturnValue([] as any);

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        includes: ["src/**/*.ts"],
      });

      expect(ctx.files).toEqual([]);
    });

    it("glob 展开结果中包含目录 → 目录被过滤，只保留文件", async () => {
      globSync.mockReturnValue(makeEntries(["src/a.ts", "src/subdir", "src/b.ts"]));

      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        includes: ["src/**/*"],
      });

      expect(ctx.files).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("无 includes → globSync 不被调用，files 为 undefined", async () => {
      const ctx = await builder.getContextFromEnv({
        dryRun: false,
        ci: false,
        base: "main",
        head: "feature",
      });

      expect(globSync).not.toHaveBeenCalled();
      expect(ctx.files).toBeUndefined();
    });
  });

  describe("fillIssueAuthors", () => {
    it("should fill author from commit with platform user", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "abc1234" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: { id: 1, login: "dev1" },
          commit: { author: { name: "Dev", email: "dev@test.com" } },
        },
      ];
      const result = await builder.fillIssueAuthors(issues as any, commits, "o", "r");
      expect(result[0].author.login).toBe("dev1");
    });

    it("should use default author when commit not matched", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "zzz9999" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: { id: 1, login: "dev1" },
          commit: { author: { name: "Dev", email: "dev@test.com" } },
        },
      ];
      const result = await builder.fillIssueAuthors(issues as any, commits, "o", "r");
      expect(result[0].author.login).toBe("dev1");
    });

    it("should keep existing author", async () => {
      const issues = [{ file: "test.ts", line: "1", author: { id: "99", login: "existing" } }];
      const commits = [{ sha: "abc1234567890", author: { id: 1, login: "dev1" } }];
      const result = await builder.fillIssueAuthors(issues as any, commits, "o", "r");
      expect(result[0].author.login).toBe("existing");
    });

    it("should use git author name when no platform user", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "abc1234" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: null,
          committer: null,
          commit: { author: { name: "GitUser", email: "git@test.com" } },
        },
      ];
      const result = await builder.fillIssueAuthors(issues as any, commits, "o", "r");
      expect(result[0].author.login).toBe("GitUser");
    });

    it("should mark invalid when existing author but ------- commit hash", async () => {
      const issues = [
        { file: "test.ts", line: "1", commit: "-------", author: { id: "1", login: "dev1" } },
      ];
      const result = await builder.fillIssueAuthors(issues as any, [], "o", "r");
      expect(result[0].commit).toBeUndefined();
      expect(result[0].valid).toBe("false");
    });

    it("should handle issues with ------- commit hash", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "-------" }];
      const commits = [
        { sha: "abc1234567890", author: { id: 1, login: "dev1" }, commit: { author: {} } },
      ];
      const result = await builder.fillIssueAuthors(issues as any, commits, "o", "r");
      expect(result[0].commit).toBeUndefined();
      expect(result[0].valid).toBe("false");
    });

    it("should use searchUsers result for git-only authors", async () => {
      gitProvider.searchUsers.mockResolvedValue([{ id: 42, login: "found-user" }] as any);
      const issues = [{ file: "test.ts", line: "1", commit: "abc1234" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: null,
          committer: null,
          commit: { author: { name: "GitUser", email: "git@test.com" } },
        },
      ];
      const result = await builder.fillIssueAuthors(issues as any, commits, "o", "r");
      expect(result[0].author.login).toBe("found-user");
    });
  });
});
