import { parseTitleOptions } from "./parse-title-options";

describe("parseTitleOptions", () => {
  describe("基本解析", () => {
    it("应该从 PR 标题末尾解析命令参数 (/review)", () => {
      const title = "feat: 添加新功能 [/review -l openai -v 2]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("openai");
      expect(options.verbose).toBe(2);
    });

    it("应该支持旧的 /ai-review 格式", () => {
      const title = "feat: 添加新功能 [/ai-review -l openai -v 2]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("openai");
      expect(options.verbose).toBe(2);
    });

    it("没有命令参数时应返回空对象", () => {
      const title = "feat: 添加新功能";
      const options = parseTitleOptions(title);

      expect(options).toEqual({});
    });

    it("格式不正确时应返回空对象", () => {
      const title = "feat: 添加新功能 [ai-review -l openai]"; // 缺少 /
      const options = parseTitleOptions(title);

      expect(options).toEqual({});
    });
  });

  describe("LLM 模式参数", () => {
    it("应该解析 -l 短参数", () => {
      const title = "fix: bug [/ai-review -l claude-code]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("claude-code");
    });

    it("应该解析 --llm-mode 长参数", () => {
      const title = "fix: bug [/ai-review --llm-mode gemini]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("gemini");
    });

    it("无效的 LLM 模式应被忽略", () => {
      const title = "fix: bug [/ai-review -l invalid-mode]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBeUndefined();
    });
  });

  describe("详细输出级别参数", () => {
    it("应该解析 -v 1", () => {
      const title = "fix: bug [/ai-review -v 1]";
      const options = parseTitleOptions(title);

      expect(options.verbose).toBe(1);
    });

    it("应该解析 -v 2", () => {
      const title = "fix: bug [/ai-review -v 2]";
      const options = parseTitleOptions(title);

      expect(options.verbose).toBe(2);
    });

    it("-v 不带值时应默认为 1", () => {
      const title = "fix: bug [/ai-review -v]";
      const options = parseTitleOptions(title);

      expect(options.verbose).toBe(1);
    });

    it("-v 后跟其他参数时应默认为 1", () => {
      const title = "fix: bug [/ai-review -v -l openai]";
      const options = parseTitleOptions(title);

      expect(options.verbose).toBe(1);
      expect(options.llmMode).toBe("openai");
    });

    it("应该解析 --verbose 长参数", () => {
      const title = "fix: bug [/ai-review --verbose 2]";
      const options = parseTitleOptions(title);

      expect(options.verbose).toBe(2);
    });
  });

  describe("dry-run 参数", () => {
    it("应该解析 -d 短参数", () => {
      const title = "fix: bug [/ai-review -d]";
      const options = parseTitleOptions(title);

      expect(options.dryRun).toBe(true);
    });

    it("应该解析 --dry-run 长参数", () => {
      const title = "fix: bug [/ai-review --dry-run]";
      const options = parseTitleOptions(title);

      expect(options.dryRun).toBe(true);
    });
  });

  describe("includes 参数", () => {
    it("应该解析 -i 短参数", () => {
      const title = "fix: bug [/ai-review -i *.ts]";
      const options = parseTitleOptions(title);

      expect(options.includes).toEqual(["*.ts"]);
    });

    it("应该解析多个 includes", () => {
      const title = "fix: bug [/ai-review -i *.ts -i *.js]";
      const options = parseTitleOptions(title);

      expect(options.includes).toEqual(["*.ts", "*.js"]);
    });
  });

  describe("verify-fixes 参数", () => {
    it("应该解析 --verify-fixes", () => {
      const title = "fix: bug [/ai-review --verify-fixes]";
      const options = parseTitleOptions(title);

      expect(options.verifyFixes).toBe(true);
    });

    it("应该解析 --no-verify-fixes", () => {
      const title = "fix: bug [/ai-review --no-verify-fixes]";
      const options = parseTitleOptions(title);

      expect(options.verifyFixes).toBe(false);
    });
  });

  describe("删除代码分析参数", () => {
    it("应该解析 --analyze-deletions 无值时默认为 true", () => {
      const title = "fix: bug [/ai-review --analyze-deletions]";
      const options = parseTitleOptions(title);

      expect(options.analyzeDeletions).toBe(true);
    });

    it("应该解析 --analyze-deletions true", () => {
      const title = "fix: bug [/ai-review --analyze-deletions true]";
      const options = parseTitleOptions(title);

      expect(options.analyzeDeletions).toBe(true);
    });

    it("应该解析 --analyze-deletions false", () => {
      const title = "fix: bug [/ai-review --analyze-deletions false]";
      const options = parseTitleOptions(title);

      expect(options.analyzeDeletions).toBe(false);
    });

    it("应该解析 --analyze-deletions ci", () => {
      const title = "fix: bug [/ai-review --analyze-deletions ci]";
      const options = parseTitleOptions(title);

      expect(options.analyzeDeletions).toBe("ci");
    });

    it("应该解析 --analyze-deletions pr", () => {
      const title = "fix: bug [/ai-review --analyze-deletions pr]";
      const options = parseTitleOptions(title);

      expect(options.analyzeDeletions).toBe("pr");
    });

    it("应该解析 --analyze-deletions terminal", () => {
      const title = "fix: bug [/ai-review --analyze-deletions terminal]";
      const options = parseTitleOptions(title);

      expect(options.analyzeDeletions).toBe("terminal");
    });

    it("应该解析 --deletion-only", () => {
      const title = "fix: bug [/ai-review --deletion-only]";
      const options = parseTitleOptions(title);

      expect(options.deletionOnly).toBe(true);
    });

    it("应该解析 --deletion-analysis-mode", () => {
      const title = "fix: bug [/ai-review --deletion-analysis-mode claude-code]";
      const options = parseTitleOptions(title);

      expect(options.deletionAnalysisMode).toBe("claude-code");
    });
  });

  describe("组合参数", () => {
    it("应该正确解析多个参数组合", () => {
      const title = "feat: 新功能 [/ai-review -l openai -v 2 -d --no-verify-fixes]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("openai");
      expect(options.verbose).toBe(2);
      expect(options.dryRun).toBe(true);
      expect(options.verifyFixes).toBe(false);
    });

    it("应该处理带引号的参数值", () => {
      const title = 'fix: bug [/ai-review -i "src/**/*.ts"]';
      const options = parseTitleOptions(title);

      expect(options.includes).toEqual(["src/**/*.ts"]);
    });
  });

  describe("大小写不敏感", () => {
    it("命令名称应该大小写不敏感", () => {
      const title = "fix: bug [/AI-REVIEW -l openai]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("openai");
    });
  });

  describe("边界情况", () => {
    it("空标题应返回空对象", () => {
      const options = parseTitleOptions("");
      expect(options).toEqual({});
    });

    it("命令在标题中间也应该被解析", () => {
      const title = "feat: [/review -l openai] 替换 [/ai-review -l openai] 添加新功能";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("openai");
    });

    it("多个命令只解析第一个", () => {
      const title = "feat: [/review -l openai] 替换 [/ai-review -l openai] [/ai-review -l gemini]";
      const options = parseTitleOptions(title);

      expect(options.llmMode).toBe("openai");
    });
  });
});
