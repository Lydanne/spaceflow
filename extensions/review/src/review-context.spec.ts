import { vi, type Mock } from "vitest";
import { readFile } from "fs/promises";
import { ReviewContextBuilder } from "./review-context";

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
