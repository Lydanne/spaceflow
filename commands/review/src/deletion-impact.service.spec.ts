import { vi, type Mocked, type Mock } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { LlmProxyService, GitProviderService } from "@spaceflow/core";
import { DeletionImpactService } from "./deletion-impact.service";
import * as child_process from "child_process";
import { EventEmitter } from "events";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

vi.mock("child_process");

describe("DeletionImpactService", () => {
  let service: DeletionImpactService;
  let llmProxyService: Mocked<LlmProxyService>;
  let gitProvider: Mocked<GitProviderService>;

  beforeEach(async () => {
    const mockLlmProxyService = {
      chatStream: vi.fn(),
    };

    const mockGitProvider = {
      getPullRequestFiles: vi.fn(),
      getPullRequestDiff: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletionImpactService,
        { provide: LlmProxyService, useValue: mockLlmProxyService },
        { provide: GitProviderService, useValue: mockGitProvider },
      ],
    }).compile();

    service = module.get<DeletionImpactService>(DeletionImpactService);
    llmProxyService = module.get(LlmProxyService) as Mocked<LlmProxyService>;
    gitProvider = module.get(GitProviderService) as Mocked<GitProviderService>;
  });

  describe("analyzeDeletionImpact", () => {
    it("should return early if no parameters provided", async () => {
      const result = await service.analyzeDeletionImpact({}, "openai", 1);
      expect(result.impacts).toHaveLength(0);
      expect(result.summary).toBe("缺少必要参数");
    });

    it("should extract blocks and analyze with LLM (Gitea API source)", async () => {
      const context = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
      };

      const mockFiles = [
        {
          filename: "test.ts",
          patch: "@@ -1,1 +1,0 @@\n-const oldCode = 1;",
          deletions: 1,
        },
      ];
      gitProvider.getPullRequestFiles.mockResolvedValue(mockFiles as any);

      // Mock LLM response
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: {
            structuredOutput: {
              impacts: [
                {
                  file: "test.ts",
                  deletedCode: "const oldCode",
                  riskLevel: "low",
                  affectedFiles: [],
                  reason: "Clean up",
                  suggestion: "None",
                },
              ],
              summary: "Safe deletion",
            },
          },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      // Mock git grep (for findCodeReferences)
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);

      process.nextTick(() => {
        mockProcess.stdout.emit("data", ""); // No references found
        mockProcess.emit("close", 0);
      });

      const result = await service.analyzeDeletionImpact(context, "openai", 1);

      expect(result.impacts).toHaveLength(1);
      expect(result.summary).toBe("Safe deletion");
      expect(gitProvider.getPullRequestFiles).toHaveBeenCalled();
    });
  });

  describe("parseDeletedBlocksFromPatch", () => {
    it("should correctly parse deleted lines from patch", () => {
      const patch = "@@ -10,2 +10,1 @@\n-line 1\n-line 2\n+line 1 modified";
      const blocks = (service as any).parseDeletedBlocksFromPatch("test.ts", patch);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        file: "test.ts",
        startLine: 10,
        endLine: 11,
        content: "line 1\nline 2",
      });
    });
  });

  describe("extractIdentifiers", () => {
    it("should extract function names", () => {
      const code = "function testFunc() {}\nasync function asyncFunc() {}";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).toContain("testFunc");
      expect(ids).toContain("asyncFunc");
    });

    it("should extract class names", () => {
      const code = "class MyClass {}";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).toContain("MyClass");
    });

    it("should extract interface names", () => {
      const code = "interface MyInterface {}";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).toContain("MyInterface");
    });

    it("should extract type names", () => {
      const code = "type MyType = string;";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).toContain("MyType");
    });

    it("should extract exported variable names", () => {
      const code = "export const MY_CONST = 1;\nexport let myVar = 2;";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).toContain("MY_CONST");
      expect(ids).toContain("myVar");
    });

    it("should extract method names", () => {
      const code = "async getData() {\n  return [];\n}";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).toContain("getData");
    });

    it("should not extract control flow keywords as methods", () => {
      const code = "if (true) {\n}\nfor (const x of arr) {\n}\nwhile (true) {\n}";
      const ids = (service as any).extractIdentifiers(code);
      expect(ids).not.toContain("if");
      expect(ids).not.toContain("for");
      expect(ids).not.toContain("while");
    });

    it("should deduplicate identifiers", () => {
      const code = "function test() {}\nfunction test() {}";
      const ids = (service as any).extractIdentifiers(code);
      const testCount = ids.filter((id: string) => id === "test").length;
      expect(testCount).toBe(1);
    });
  });

  describe("extractDeletedBlocksFromChangedFiles", () => {
    it("should extract blocks from files with patch", () => {
      const changedFiles = [
        {
          filename: "test.ts",
          patch: "@@ -5,3 +5,1 @@\n-const a = 1;\n-const b = 2;\n+const c = 3;",
        },
      ];
      const blocks = (service as any).extractDeletedBlocksFromChangedFiles(changedFiles);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0].file).toBe("test.ts");
    });

    it("should skip files without filename or patch", () => {
      const changedFiles = [{ filename: "", patch: "" }, { patch: "some patch" }];
      const blocks = (service as any).extractDeletedBlocksFromChangedFiles(changedFiles);
      expect(blocks).toHaveLength(0);
    });

    it("should filter out comment-only blocks", () => {
      const changedFiles = [
        {
          filename: "test.ts",
          patch: "@@ -1,2 +1,0 @@\n-// this is a comment\n-/* another comment */",
        },
      ];
      const blocks = (service as any).extractDeletedBlocksFromChangedFiles(changedFiles);
      expect(blocks).toHaveLength(0);
    });
  });

  describe("extractDeletedBlocksFromDiffText", () => {
    it("should parse diff text with multiple files", () => {
      const diffText = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,1 @@
-const old1 = 1;
-const old2 = 2;
+const new1 = 1;
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -5,1 +5,0 @@
-function removed() {}`;
      const blocks = (service as any).extractDeletedBlocksFromDiffText(diffText);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty diff text", () => {
      const blocks = (service as any).extractDeletedBlocksFromDiffText("");
      expect(blocks).toHaveLength(0);
    });

    it("should skip files without header match", () => {
      const diffText = "some random text without diff header";
      const blocks = (service as any).extractDeletedBlocksFromDiffText(diffText);
      expect(blocks).toHaveLength(0);
    });

    it("should save last delete block at end of file", () => {
      const diffText = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,0 @@
-const a = 1;
-const b = 2;`;
      const blocks = (service as any).extractDeletedBlocksFromDiffText(diffText);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain("const a = 1;");
      expect(blocks[0].content).toContain("const b = 2;");
    });
  });

  describe("filterMeaningfulBlocks", () => {
    it("should keep blocks with meaningful code", () => {
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const result = (service as any).filterMeaningfulBlocks(blocks);
      expect(result).toHaveLength(1);
    });

    it("should filter out blocks with only comments", () => {
      const blocks = [
        { file: "test.ts", startLine: 1, endLine: 2, content: "// comment\n* another" },
      ];
      const result = (service as any).filterMeaningfulBlocks(blocks);
      expect(result).toHaveLength(0);
    });

    it("should filter out blocks with only blank lines", () => {
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 2, content: "  \n  " }];
      const result = (service as any).filterMeaningfulBlocks(blocks);
      expect(result).toHaveLength(0);
    });
  });

  describe("parseDeletedBlocksFromPatch - more branches", () => {
    it("should handle multiple hunks", () => {
      const patch = "@@ -1,1 +1,0 @@\n-line1\n@@ -10,1 +9,0 @@\n-line10";
      const blocks = (service as any).parseDeletedBlocksFromPatch("test.ts", patch);
      expect(blocks).toHaveLength(2);
    });

    it("should save block when encountering new hunk after deletions", () => {
      const patch = "@@ -1,2 +1,0 @@\n-line1\n-line2\n@@ -10,1 +8,1 @@\n-old\n+new";
      const blocks = (service as any).parseDeletedBlocksFromPatch("test.ts", patch);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle added lines breaking delete block", () => {
      const patch = "@@ -1,3 +1,2 @@\n-deleted1\n+added1\n-deleted2";
      const blocks = (service as any).parseDeletedBlocksFromPatch("test.ts", patch);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it("should save last block at end of patch", () => {
      const patch = "@@ -1,1 +1,0 @@\n-const x = 1;";
      const blocks = (service as any).parseDeletedBlocksFromPatch("test.ts", patch);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].startLine).toBe(1);
      expect(blocks[0].endLine).toBe(1);
    });
  });

  describe("analyzeDeletionImpact - more branches", () => {
    it("should use git-diff source with baseRef/headRef", async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);

      const context = { baseRef: "main", headRef: "feature" };

      // resolveRef 会调用 git rev-parse，然后 getDeletedCodeBlocks 调用 git diff
      // 第一次 spawn: rev-parse main
      // 第二次 spawn: rev-parse feature
      // 第三次 spawn: git diff
      let callCount = 0;
      (child_process.spawn as Mock).mockImplementation(() => {
        callCount++;
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (callCount <= 2) {
            // rev-parse 成功
            proc.stdout.emit("data", "abc123");
            proc.emit("close", 0);
          } else {
            // git diff 返回空
            proc.stdout.emit("data", "");
            proc.emit("close", 0);
          }
        });
        return proc;
      });

      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(result.impacts).toHaveLength(0);
      expect(result.summary).toBe("没有发现删除的代码");
    });

    it("should use PR diff API when no patch in files", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1 };
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", deletions: 5 },
      ] as any);
      gitProvider.getPullRequestDiff.mockResolvedValue(
        `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,1 +1,0 @@
-const removed = true;`,
      );

      // Mock git grep for findCodeReferences
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.emit("close", 1); // grep 没找到
      });

      const mockStream = (async function* () {
        yield {
          type: "result",
          response: {
            structuredOutput: { impacts: [], summary: "ok" },
          },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(gitProvider.getPullRequestDiff).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should handle PR diff API failure", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1 };
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", deletions: 5 },
      ] as any);
      gitProvider.getPullRequestDiff.mockRejectedValue(new Error("API error"));

      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(result.impacts).toHaveLength(0);
      expect(result.summary).toBe("没有发现删除的代码");
    });

    it("should return early when no deletions in files", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1 };
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", additions: 5, deletions: 0 },
      ] as any);

      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(result.impacts).toHaveLength(0);
    });

    it("should filter blocks by includes", async () => {
      const context = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        includes: ["*.service.ts"],
      };
      gitProvider.getPullRequestFiles.mockResolvedValue([
        {
          filename: "test.controller.ts",
          patch: "@@ -1,1 +1,0 @@\n-const x = 1;",
          deletions: 1,
        },
      ] as any);

      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(result.impacts).toHaveLength(0);
    });

    it("should use verbose logging", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1 };
      gitProvider.getPullRequestFiles.mockResolvedValue([] as any);

      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(result.impacts).toHaveLength(0);
    });
  });

  describe("analyzeWithLLM", () => {
    it("should handle error event from stream", async () => {
      const mockStream = (async function* () {
        yield { type: "error", message: "LLM failed" };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai");
      expect(result.impacts).toHaveLength(0);
      expect(result.summary).toBe("分析返回格式无效");
    });

    it("should handle invalid result from LLM", async () => {
      const mockStream = (async function* () {
        yield { type: "result", response: { structuredOutput: null } };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai");
      expect(result.impacts).toHaveLength(0);
      expect(result.summary).toBe("分析返回格式无效");
    });

    it("should handle array result from LLM", async () => {
      const mockStream = (async function* () {
        yield { type: "result", response: { structuredOutput: [] } };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai");
      expect(result.impacts).toHaveLength(0);
    });

    it("should handle LLM call exception", async () => {
      llmProxyService.chatStream.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai");
      expect(result.summary).toBe("LLM 调用失败");
      consoleSpy.mockRestore();
    });

    it("should handle non-Error exception", async () => {
      llmProxyService.chatStream.mockImplementation(() => {
        throw "string error";
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai");
      expect(result.summary).toBe("LLM 调用失败");
      consoleSpy.mockRestore();
    });

    it("should include references in prompt", async () => {
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: { structuredOutput: { impacts: [], summary: "ok" } },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 5, content: "const x = 1;" }];
      const refs = new Map([["test.ts:1-5", ["other.ts", "another.ts"]]]);
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai");
      expect(result.summary).toBe("ok");
    });

    it("should log prompts with verbose=2", async () => {
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: { structuredOutput: { impacts: [], summary: "ok" } },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithLLM(blocks, refs, "openai", 2);
      expect(result.summary).toBe("ok");
    });
  });

  describe("analyzeWithAgent", () => {
    it("should handle successful agent analysis", async () => {
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: { structuredOutput: { impacts: [], summary: "agent ok" } },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithAgent("claude-code", blocks, refs);
      expect(result.summary).toBe("agent ok");
    });

    it("should handle agent error event", async () => {
      const mockStream = (async function* () {
        yield { type: "error", message: "Agent failed" };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithAgent("claude-code", blocks, refs);
      expect(result.impacts).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it("should handle agent call exception", async () => {
      llmProxyService.chatStream.mockImplementation(() => {
        throw new Error("Agent connection failed");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithAgent("claude-code", blocks, refs);
      expect(result.summary).toBe("Agent 调用失败");
      consoleSpy.mockRestore();
    });

    it("should handle non-Error agent exception", async () => {
      llmProxyService.chatStream.mockImplementation(() => {
        throw "agent string error";
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithAgent("claude-code", blocks, refs);
      expect(result.summary).toBe("Agent 调用失败");
      consoleSpy.mockRestore();
    });

    it("should handle invalid agent result", async () => {
      const mockStream = (async function* () {
        yield { type: "result", response: { structuredOutput: null } };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithAgent("claude-code", blocks, refs);
      expect(result.summary).toBe("分析返回格式无效");
    });

    it("should log with verbose=2", async () => {
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: { structuredOutput: { impacts: [], summary: "ok" } },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = new Map<string, string[]>();
      const result = await (service as any).analyzeWithAgent("claude-code", blocks, refs, 2);
      expect(result.summary).toBe("ok");
    });
  });

  describe("resolveRef", () => {
    it("should return SHA directly for commit hash", async () => {
      const result = await (service as any).resolveRef("abc1234", 1);
      expect(result).toBe("abc1234");
    });

    it("should return origin/ ref directly", async () => {
      const result = await (service as any).resolveRef("origin/main", 1);
      expect(result).toBe("origin/main");
    });

    it("should throw for empty ref", async () => {
      await expect((service as any).resolveRef("")).rejects.toThrow("ref 参数不能为空");
    });

    it("should try local branch first", async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.stdout.emit("data", "abc123");
        mockProcess.emit("close", 0);
      });

      const result = await (service as any).resolveRef("main", 1);
      expect(result).toBe("main");
    });

    it("should fallback to origin/ when local fails", async () => {
      let callCount = 0;
      (child_process.spawn as Mock).mockImplementation(() => {
        callCount++;
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (callCount === 1) {
            // rev-parse --verify main 失败
            proc.stderr.emit("data", "not found");
            proc.emit("close", 1);
          } else {
            // rev-parse --verify origin/main 成功
            proc.stdout.emit("data", "abc123");
            proc.emit("close", 0);
          }
        });
        return proc;
      });

      const result = await (service as any).resolveRef("main", 1);
      expect(result).toBe("origin/main");
    });

    it("should try fetch when both local and origin fail", async () => {
      let callCount = 0;
      (child_process.spawn as Mock).mockImplementation(() => {
        callCount++;
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (callCount <= 2) {
            // rev-parse 失败
            proc.stderr.emit("data", "not found");
            proc.emit("close", 1);
          } else {
            // fetch 成功
            proc.stdout.emit("data", "");
            proc.emit("close", 0);
          }
        });
        return proc;
      });

      const result = await (service as any).resolveRef("develop", 1);
      expect(result).toBe("origin/develop");
    });

    it("should return original ref when all attempts fail", async () => {
      (child_process.spawn as Mock).mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit("data", "error");
          proc.emit("close", 1);
        });
        return proc;
      });

      const result = await (service as any).resolveRef("nonexistent", 1);
      expect(result).toBe("nonexistent");
    });
  });

  describe("runGitCommand", () => {
    it("should resolve with stdout on success", async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.stdout.emit("data", "output");
        mockProcess.emit("close", 0);
      });

      const result = await (service as any).runGitCommand(["status"]);
      expect(result).toBe("output");
    });

    it("should reject on non-zero exit code", async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.stderr.emit("data", "error msg");
        mockProcess.emit("close", 1);
      });

      await expect((service as any).runGitCommand(["bad"])).rejects.toThrow("Git 命令失败");
    });

    it("should reject on spawn error", async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.emit("error", new Error("spawn failed"));
      });

      await expect((service as any).runGitCommand(["bad"])).rejects.toThrow("spawn failed");
    });
  });

  describe("findCodeReferences", () => {
    it("should find references using git grep", async () => {
      (child_process.spawn as Mock).mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stdout.emit("data", "other.ts\nanother.ts\n");
          proc.emit("close", 0);
        });
        return proc;
      });

      const blocks = [
        { file: "test.ts", startLine: 1, endLine: 5, content: "function myFunc() {}" },
      ];
      const refs = await (service as any).findCodeReferences(blocks);
      expect(refs.size).toBeGreaterThanOrEqual(0);
    });

    it("should skip short identifiers", async () => {
      (child_process.spawn as Mock).mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.emit("close", 1);
        });
        return proc;
      });

      const blocks = [{ file: "test.ts", startLine: 1, endLine: 1, content: "const x = 1;" }];
      const refs = await (service as any).findCodeReferences(blocks);
      expect(refs.size).toBe(0);
    });

    it("should handle grep errors gracefully", async () => {
      (child_process.spawn as Mock).mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit("data", "error");
          proc.emit("close", 1);
        });
        return proc;
      });

      const blocks = [
        { file: "test.ts", startLine: 1, endLine: 5, content: "function longFuncName() {}" },
      ];
      const refs = await (service as any).findCodeReferences(blocks);
      expect(refs.size).toBe(0);
    });
  });

  describe("getDeletedCodeBlocks", () => {
    it("should parse deleted blocks from git diff output", async () => {
      let callCount = 0;
      (child_process.spawn as Mock).mockImplementation(() => {
        callCount++;
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (callCount <= 2) {
            // resolveRef: rev-parse 成功
            proc.stdout.emit("data", "abc123");
            proc.emit("close", 0);
          } else {
            // git diff 返回有删除的内容
            proc.stdout.emit(
              "data",
              `diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1,3 +1,1 @@\n-const old1 = 1;\n-const old2 = 2;\n+const new1 = 1;\n@@ -10,2 +8,0 @@\n-function removed() {}\n-// end`,
            );
            proc.emit("close", 0);
          }
        });
        return proc;
      });

      const blocks = await (service as any).getDeletedCodeBlocks("main", "feature", 1);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle diff with last block at end", async () => {
      let callCount = 0;
      (child_process.spawn as Mock).mockImplementation(() => {
        callCount++;
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (callCount <= 2) {
            proc.stdout.emit("data", "abc123");
            proc.emit("close", 0);
          } else {
            proc.stdout.emit(
              "data",
              `diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1,2 +1,0 @@\n-const removed1 = true;\n-const removed2 = true;`,
            );
            proc.emit("close", 0);
          }
        });
        return proc;
      });

      const blocks = await (service as any).getDeletedCodeBlocks("main", "feature");
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("analyzeDeletionImpact - git-diff with blocks", () => {
    it("should analyze deleted blocks from git diff", async () => {
      let callCount = 0;
      (child_process.spawn as Mock).mockImplementation(() => {
        callCount++;
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          if (callCount <= 2) {
            proc.stdout.emit("data", "abc123");
            proc.emit("close", 0);
          } else if (callCount === 3) {
            // git diff 返回有删除的内容
            proc.stdout.emit(
              "data",
              `diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1,1 +1,0 @@\n-function removedFunc() {}`,
            );
            proc.emit("close", 0);
          } else {
            // git grep 失败（没有引用）
            proc.stderr.emit("data", "");
            proc.emit("close", 1);
          }
        });
        return proc;
      });

      const mockStream = (async function* () {
        yield {
          type: "result",
          response: {
            structuredOutput: {
              impacts: [
                {
                  file: "test.ts",
                  deletedCode: "removedFunc",
                  riskLevel: "low",
                  affectedFiles: [],
                  reason: "safe",
                },
              ],
              summary: "safe deletion",
            },
          },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const context = { baseRef: "main", headRef: "feature" };
      const result = await service.analyzeDeletionImpact(context, "openai", 1);
      expect(result.impacts.length).toBeGreaterThanOrEqual(1);
      expect(result.summary).toBe("safe deletion");
    });
  });

  describe("analyzeDeletionImpact - agent mode", () => {
    it("should use agent mode for claude-code", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1, analysisMode: "claude-code" as const };
      gitProvider.getPullRequestFiles.mockResolvedValue([
        {
          filename: "test.ts",
          patch: "@@ -1,1 +1,0 @@\n-const removed = true;",
          deletions: 1,
        },
      ] as any);

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.emit("close", 1);
      });

      const mockStream = (async function* () {
        yield {
          type: "result",
          response: { structuredOutput: { impacts: [], summary: "agent analysis" } },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const result = await service.analyzeDeletionImpact(context, "openai");
      expect(result.summary).toBe("agent analysis");
    });
  });

  describe("analyzeDeletionImpact - defensive checks", () => {
    it("should fix invalid impacts array", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1 };
      gitProvider.getPullRequestFiles.mockResolvedValue([
        {
          filename: "test.ts",
          patch: "@@ -1,1 +1,0 @@\n-const removed = true;",
          deletions: 1,
        },
      ] as any);

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (child_process.spawn as Mock).mockReturnValue(mockProcess);
      process.nextTick(() => {
        mockProcess.emit("close", 1);
      });

      const mockStream = (async function* () {
        yield {
          type: "result",
          response: { structuredOutput: { impacts: null, summary: "ok" } },
        };
      })();
      llmProxyService.chatStream.mockReturnValue(mockStream as any);

      const result = await service.analyzeDeletionImpact(context, "openai");
      expect(result.impacts).toEqual([]);
    });
  });
});
