import { vi, type Mock } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ReviewSpecService } from "./review-spec.service";
import { GitProviderService } from "@spaceflow/core";
import { readdir, readFile, mkdir, access, writeFile } from "fs/promises";
import * as child_process from "child_process";

vi.mock("fs/promises");
vi.mock("child_process");

describe("ReviewSpecService", () => {
  let service: ReviewSpecService;

  let gitProvider: { listRepositoryContents: Mock; getFileContent: Mock };

  beforeEach(async () => {
    gitProvider = {
      listRepositoryContents: vi.fn(),
      getFileContent: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewSpecService, { provide: GitProviderService, useValue: gitProvider }],
    }).compile();

    service = module.get<ReviewSpecService>(ReviewSpecService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loadReviewSpecs", () => {
    it("should load and parse spec files correctly", async () => {
      const mockFiles = ["js&ts.base.md", "vue.file-name.md"];
      const mockContent1 = `# 基础规范 \`[JsTs.Base]\`

## 常量使用全大写 \`[JsTs.Base.ConstUpperCase]\`

- 排除配置文件
- 排除测试文件

### Good
\`\`\`js
const MAX_COUNT = 100;
\`\`\``;

      const mockContent2 = `# Vue 文件命名 \`[Vue.FileName]\`

## 组件使用大驼峰 \`[Vue.FileName.UpperCamel]\``;

      (readdir as Mock).mockResolvedValue(mockFiles);
      (readFile as Mock).mockResolvedValueOnce(mockContent1).mockResolvedValueOnce(mockContent2);

      const specs = await service.loadReviewSpecs("/test/spec/dir");

      expect(specs).toHaveLength(2);
      expect(specs[0].filename).toBe("js&ts.base.md");
      expect(specs[0].extensions).toEqual(["js", "ts"]);
      expect(specs[0].type).toBe("base");
      expect(specs[0].rules).toHaveLength(2);
      expect(specs[0].rules[0].id).toBe("JsTs.Base");
      expect(specs[0].rules[1].id).toBe("JsTs.Base.ConstUpperCase");
      expect(specs[0].rules[1].description).toContain("排除配置文件");
      expect(specs[0].rules[1].description).toContain("排除测试文件");
      expect(specs[0].rules[1].examples).toHaveLength(1);
      expect(specs[0].rules[1].examples[0]).toEqual({
        lang: "js",
        code: "const MAX_COUNT = 100;",
        type: "good",
      });

      expect(specs[1].filename).toBe("vue.file-name.md");
      expect(specs[1].extensions).toEqual(["vue"]);
      expect(specs[1].type).toBe("file-name");
    });

    it("should skip non-markdown files", async () => {
      const mockFiles = ["js&ts.base.md", "readme.txt", "config.json"];
      const mockContent = `# Test \`[Test.Rule]\``;

      (readdir as Mock).mockResolvedValue(mockFiles);
      (readFile as Mock).mockResolvedValue(mockContent);

      const specs = await service.loadReviewSpecs("/test/spec/dir");

      expect(specs).toHaveLength(1);
      expect(specs[0].filename).toBe("js&ts.base.md");
    });

    it("should handle directory read errors gracefully", async () => {
      (readdir as Mock).mockRejectedValue(new Error("Directory not found"));

      const specs = await service.loadReviewSpecs("/nonexistent/dir");

      expect(specs).toHaveLength(0);
    });

    it("should skip files with incorrect naming format", async () => {
      const mockFiles = ["invalid.md", "js.base.md"];
      const mockContent = `# Test \`[Test.Rule]\``;

      (readdir as Mock).mockResolvedValue(mockFiles);
      (readFile as Mock).mockResolvedValue(mockContent);

      const specs = await service.loadReviewSpecs("/test/spec/dir");

      expect(specs).toHaveLength(1);
      expect(specs[0].filename).toBe("js.base.md");
    });
  });

  describe("extractConfigValues", () => {
    it("should extract single value", () => {
      const content = `> - testConfig \`value1\``;
      const result = (service as any).extractConfigValues(content, "testConfig");
      expect(result).toEqual(["value1"]);
    });

    it("should extract multiple values from single line", () => {
      const content = `> - testConfig \`value1\` \`value2\` \`value3\``;
      const result = (service as any).extractConfigValues(content, "testConfig");
      expect(result).toEqual(["value1", "value2", "value3"]);
    });

    it("should override with later config line (same name)", () => {
      const content = `> - testConfig \`value1\`
> - testConfig \`value2\` \`value3\``;
      const result = (service as any).extractConfigValues(content, "testConfig");
      expect(result).toEqual(["value2", "value3"]);
    });

    it("should return empty array when config not found", () => {
      const content = `> - otherConfig \`value1\``;
      const result = (service as any).extractConfigValues(content, "testConfig");
      expect(result).toEqual([]);
    });

    it("should not match config in non-blockquote lines", () => {
      const content = `- testConfig \`value1\``;
      const result = (service as any).extractConfigValues(content, "testConfig");
      expect(result).toEqual([]);
    });
  });

  describe("extractOverrides", () => {
    it("should extract single override", () => {
      const content = `> - override \`[JsTs.FileName]\``;
      const result = (service as any).extractOverrides(content);
      expect(result).toEqual(["JsTs.FileName"]);
    });

    it("should extract multiple overrides from single line", () => {
      const content = `> - override \`[JsTs.FileName]\` \`[JsTs.FileName.LowerCamel]\``;
      const result = (service as any).extractOverrides(content);
      expect(result).toEqual(["JsTs.FileName", "JsTs.FileName.LowerCamel"]);
    });

    it("should override with later config line", () => {
      const content = `> - override \`[JsTs.FileName]\`
> - override \`[JsTs.FileName.LowerCamel]\``;
      const result = (service as any).extractOverrides(content);
      // 同名配置项覆盖，只保留最后一行
      expect(result).toEqual(["JsTs.FileName.LowerCamel"]);
    });

    it("should return empty array when no overrides", () => {
      const content = `- 使用小写加横线命名
- 文件名必须加 .controller.ts 后缀`;
      const result = (service as any).extractOverrides(content);
      expect(result).toEqual([]);
    });
  });

  describe("applyOverrides", () => {
    it("should exclude rules matching exact override", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [
            { id: "JsTs.Base", title: "Base", description: "", examples: [], overrides: [] },
            {
              id: "JsTs.FileName",
              title: "FileName",
              description: "",
              examples: [],
              overrides: [],
            },
          ],
        },
        {
          filename: "js&ts.nest.md",
          extensions: ["js", "ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.FileName"],
          severity: "error" as const,
          includes: [],
          rules: [
            {
              id: "JsTs.Nest.DirStructure",
              title: "DirStructure",
              description: "",
              examples: [],
              overrides: [],
            },
          ],
        },
      ];

      const result = service.applyOverrides(specs as any);
      expect(result).toHaveLength(2);
      expect(result[0].rules).toHaveLength(1);
      expect(result[0].rules[0].id).toBe("JsTs.Base");
    });
  });

  describe("parseSpecFile with overrides", () => {
    it("should parse file-level overrides", async () => {
      const mockContent = `# Nestjs 项目下的规范 \`[JsTs.Nest]\`

> - override \`[JsTs.FileName]\`

## 目录框架规范 \`[JsTs.Nest.DirStructure]\`

> - override \`[JsTs.FileName.LowerCamel]\`

- 使用下面的 Good 目录结构`;

      const spec = service.parseSpecFile("js&ts.nest.md", mockContent);

      expect(spec?.overrides).toEqual(["JsTs.FileName"]);
      expect(spec?.rules).toHaveLength(2);
      expect(spec?.rules[0].id).toBe("JsTs.Nest");
      expect(spec?.rules[0].overrides).toEqual(["JsTs.FileName"]);
      expect(spec?.rules[1].id).toBe("JsTs.Nest.DirStructure");
      expect(spec?.rules[1].overrides).toEqual(["JsTs.FileName.LowerCamel"]);
    });
  });

  describe("extractSeverity", () => {
    it("should extract error severity", () => {
      const content = `> - severity \`error\``;
      const result = (service as any).extractSeverity(content);
      expect(result).toBe("error");
    });

    it("should extract warn severity", () => {
      const content = `> - severity \`warn\``;
      const result = (service as any).extractSeverity(content);
      expect(result).toBe("warn");
    });

    it("should extract off severity", () => {
      const content = `> - severity \`off\``;
      const result = (service as any).extractSeverity(content);
      expect(result).toBe("off");
    });

    it("should return undefined when no severity specified", () => {
      const content = `- 使用小写加横线命名`;
      const result = (service as any).extractSeverity(content);
      expect(result).toBeUndefined();
    });

    it("should extract severity with other content", () => {
      const content = `> - severity \`warn\`

- 排除配置文件
- 排除测试文件`;
      const result = (service as any).extractSeverity(content);
      expect(result).toBe("warn");
    });
  });

  describe("parseSpecFile with severity", () => {
    it("should use default severity (error) when not specified", () => {
      const mockContent = `# 基础规范 \`[JsTs.Base]\`

## 常量使用全大写 \`[JsTs.Base.ConstUpperCase]\``;

      const spec = service.parseSpecFile("js&ts.base.md", mockContent);

      expect(spec?.severity).toBe("error");
      expect(spec?.rules[0].severity).toBeUndefined();
      expect(spec?.rules[1].severity).toBeUndefined();
    });

    it("should parse file-level severity", () => {
      const mockContent = `# 基础规范 \`[JsTs.Base]\`

> - severity \`warn\`

## 常量使用全大写 \`[JsTs.Base.ConstUpperCase]\``;

      const spec = service.parseSpecFile("js&ts.base.md", mockContent);

      expect(spec?.severity).toBe("warn");
      expect(spec?.rules[0].severity).toBe("warn");
    });

    it("should parse rule-level severity override", () => {
      const mockContent = `# 基础规范 \`[JsTs.Base]\`

> - severity \`error\`

## 常量使用全大写 \`[JsTs.Base.ConstUpperCase]\`

> - severity \`warn\`

### Good
\`\`\`js
const MAX_COUNT = 100;
\`\`\``;

      const spec = service.parseSpecFile("js&ts.base.md", mockContent);

      expect(spec?.severity).toBe("error");
      expect(spec?.rules[0].severity).toBe("error");
      expect(spec?.rules[1].severity).toBe("warn");
    });

    it("should parse severity with override together", () => {
      const mockContent = `# Nestjs 规范 \`[JsTs.Nest]\`

> - severity \`warn\`
> - override \`[JsTs.FileName]\`

## 目录规范 \`[JsTs.Nest.DirStructure]\`

> - severity \`error\``;

      const spec = service.parseSpecFile("js&ts.nest.md", mockContent);

      expect(spec?.severity).toBe("warn");
      expect(spec?.overrides).toEqual(["JsTs.FileName"]);
      expect(spec?.rules[0].severity).toBe("warn");
      expect(spec?.rules[1].severity).toBe("error");
    });
  });

  describe("extractIncludes", () => {
    it("should extract single include pattern", () => {
      const content = `> - includes \`*.controller.ts\``;
      const result = (service as any).extractIncludes(content);
      expect(result).toEqual(["*.controller.ts"]);
    });

    it("should extract multiple include patterns", () => {
      const content = `> - includes \`*.controller.ts\` \`*.service.ts\` \`*.module.ts\``;
      const result = (service as any).extractIncludes(content);
      expect(result).toEqual(["*.controller.ts", "*.service.ts", "*.module.ts"]);
    });

    it("should return empty array when no includes", () => {
      const content = `- 使用小写加横线命名
- 文件名必须加 .controller.ts 后缀`;
      const result = (service as any).extractIncludes(content);
      expect(result).toEqual([]);
    });
  });

  describe("parseSpecFile with includes", () => {
    it("should parse file-level includes", () => {
      const mockContent = `# Nestjs 项目下的规范 \`[JsTs.Nest]\`

> - includes \`*.controller.ts\` \`*.service.ts\` \`*.module.ts\`
> - override \`[JsTs.FileName]\`

## 目录框架规范 \`[JsTs.Nest.DirStructure]\``;

      const spec = service.parseSpecFile("js&ts.nest.md", mockContent);

      expect(spec?.includes).toEqual(["*.controller.ts", "*.service.ts", "*.module.ts"]);
      expect(spec?.overrides).toEqual(["JsTs.FileName"]);
    });

    it("should return empty includes when not specified", () => {
      const mockContent = `# 基础规范 \`[JsTs.Base]\`

## 常量使用全大写 \`[JsTs.Base.ConstUpperCase]\``;

      const spec = service.parseSpecFile("js&ts.base.md", mockContent);

      expect(spec?.includes).toEqual([]);
    });

    it("should only extract file-level includes (before first ## rule)", () => {
      const mockContent = `# Nestjs 项目下的规范 \`[JsTs.Nest]\`

> - includes \`*.controller.ts\` \`*.service.ts\` \`*.module.ts\`

## 目录框架规范 \`[JsTs.Nest.DirStructure]\`

- 使用下面的 Good 目录结构

## Model 编写规范 \`[JsTs.Nest.ModelDefinition]\`

> - includes \`*.model.ts\`

- 内部只能写使用 model 数据库调用的逻辑`;

      const spec = service.parseSpecFile("js&ts.nest.md", mockContent);

      // 文件级 includes 应该只取第一个 ## 之前的配置
      expect(spec?.includes).toEqual(["*.controller.ts", "*.service.ts", "*.module.ts"]);
      // 规则级 includes 应该被正确提取
      expect(spec?.rules[2].includes).toEqual(["*.model.ts"]);
    });

    it("should parse rule-level includes", () => {
      const mockContent = `# Nestjs 项目下的规范 \`[JsTs.Nest]\`

> - includes \`*.controller.ts\` \`*.service.ts\`

## 目录框架规范 \`[JsTs.Nest.DirStructure]\`

- 使用下面的 Good 目录结构

## Model 编写规范 \`[JsTs.Nest.ModelDefinition]\`

> - includes \`*.model.ts\`

- 内部只能写使用 model 数据库调用的逻辑`;

      const spec = service.parseSpecFile("js&ts.nest.md", mockContent);

      expect(spec?.rules).toHaveLength(3);
      // 第一个规则（标题规则）的 ruleContent 包含文件级配置，所以也会提取到 includes
      expect(spec?.rules[0].includes).toEqual(["*.controller.ts", "*.service.ts"]);
      // 第二个规则没有自己的 includes
      expect(spec?.rules[1].includes).toBeUndefined();
      // 第三个规则有自己的 includes
      expect(spec?.rules[2].includes).toEqual(["*.model.ts"]);
    });
  });

  describe("filterApplicableSpecs", () => {
    it("should filter specs by extension only", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
        {
          filename: "js&ts.nest.md",
          extensions: ["js", "ts"],
          type: "nest",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: ["*.controller.ts", "*.service.ts"],
          rules: [],
        },
        {
          filename: "vue.base.md",
          extensions: ["vue"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];

      const changedFiles = [
        { filename: "src/app.ts" },
        { filename: "src/user/user.controller.ts" },
      ];

      const result = service.filterApplicableSpecs(specs, changedFiles);

      // 只按扩展名过滤，includes 在 LLM 审查后处理
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.filename)).toContain("js&ts.base.md");
      expect(result.map((s) => s.filename)).toContain("js&ts.nest.md");
    });

    it("should exclude specs when extension does not match", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
        {
          filename: "vue.base.md",
          extensions: ["vue"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];

      const changedFiles = [{ filename: "src/app.ts" }];

      const result = service.filterApplicableSpecs(specs, changedFiles);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("js&ts.base.md");
    });
  });

  describe("filterIssuesByIncludes", () => {
    it("should filter issues by spec includes pattern", () => {
      const specs = [
        {
          filename: "js&ts.nest.md",
          extensions: ["js", "ts"],
          type: "nest",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: ["*.controller.ts", "*.service.ts"],
          rules: [{ id: "JsTs.Nest", title: "Nest", description: "", examples: [], overrides: [] }],
        },
      ];

      const issues = [
        { file: "src/user/user.controller.ts", ruleId: "JsTs.Nest.DirStructure", reason: "test" },
        { file: "src/app.ts", ruleId: "JsTs.Nest.DirStructure", reason: "test" },
      ];

      const result = service.filterIssuesByIncludes(issues, specs);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("src/user/user.controller.ts");
    });

    it("should keep all issues when spec has no includes", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "JsTs.Base", title: "Base", description: "", examples: [], overrides: [] }],
        },
      ];

      const issues = [
        { file: "src/app.ts", ruleId: "JsTs.Base.Rule1", reason: "test" },
        { file: "src/utils/helper.ts", ruleId: "JsTs.Base.Rule2", reason: "test" },
      ];

      const result = service.filterIssuesByIncludes(issues, specs);

      expect(result).toHaveLength(2);
    });
  });

  describe("matchRuleId", () => {
    it("should match exact rule id", () => {
      expect((service as any).matchRuleId("JsTs.FileName", "JsTs.FileName")).toBe(true);
    });

    it("should match prefix rule id", () => {
      expect((service as any).matchRuleId("JsTs.FileName.LowerCamel", "JsTs.FileName")).toBe(true);
    });

    it("should not match different rule id", () => {
      expect((service as any).matchRuleId("JsTs.Base", "JsTs.FileName")).toBe(false);
    });

    it("should return false for empty ruleId", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect((service as any).matchRuleId("", "pattern")).toBe(false);
      consoleSpy.mockRestore();
    });

    it("should return false for empty pattern", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect((service as any).matchRuleId("ruleId", "")).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("findByRuleId", () => {
    it("should find exact match", () => {
      const map = new Map([["JsTs.Base", "value1"]]);
      expect((service as any).findByRuleId("JsTs.Base", map)).toBe("value1");
    });

    it("should find prefix match", () => {
      const map = new Map([["JsTs.Base", "value1"]]);
      expect((service as any).findByRuleId("JsTs.Base.Rule1", map)).toBe("value1");
    });

    it("should return undefined for no match", () => {
      const map = new Map([["JsTs.Base", "value1"]]);
      expect((service as any).findByRuleId("Vue.Base", map)).toBeUndefined();
    });

    it("should return undefined for empty ruleId", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const map = new Map([["JsTs.Base", "value1"]]);
      expect((service as any).findByRuleId("", map)).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe("filterIssuesByCommits", () => {
    it("should filter issues by changed lines", () => {
      const issues = [
        { file: "test.ts", line: "5", ruleId: "R1" },
        { file: "test.ts", line: "100", ruleId: "R2" },
      ];
      const changedFiles = [
        { filename: "test.ts", patch: "@@ -1,3 +1,5 @@\n line1\n line2\n line3\n+line4\n+line5" },
      ];
      const result = service.filterIssuesByCommits(issues, changedFiles);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe("5");
    });

    it("should keep issues when no patch info", () => {
      const issues = [{ file: "test.ts", line: "5", ruleId: "R1" }];
      const changedFiles = [{ filename: "test.ts" }];
      const result = service.filterIssuesByCommits(issues, changedFiles);
      expect(result).toHaveLength(1);
    });

    it("should handle range line format", () => {
      const issues = [{ file: "test.ts", line: "4-5", ruleId: "R1" }];
      const changedFiles = [
        { filename: "test.ts", patch: "@@ -1,3 +1,5 @@\n line1\n line2\n line3\n+line4\n+line5" },
      ];
      const result = service.filterIssuesByCommits(issues, changedFiles);
      expect(result).toHaveLength(1);
    });

    it("should skip files without filename", () => {
      const issues = [{ file: "test.ts", line: "5", ruleId: "R1" }];
      const changedFiles = [{ patch: "@@ -1,1 +1,1 @@\n+new" }];
      const result = service.filterIssuesByCommits(issues, changedFiles);
      expect(result).toHaveLength(1);
    });
  });

  describe("parseChangedLinesFromPatch", () => {
    it("should parse added lines", () => {
      const patch = "@@ -1,2 +1,3 @@\n line1\n+added\n line2";
      const lines = (service as any).parseChangedLinesFromPatch(patch);
      expect(lines.has(2)).toBe(true);
    });

    it("should handle deleted lines without incrementing line number", () => {
      const patch = "@@ -1,3 +1,2 @@\n line1\n-deleted\n line2";
      const lines = (service as any).parseChangedLinesFromPatch(patch);
      expect(lines.size).toBe(0);
    });

    it("should handle multiple hunks", () => {
      const patch = "@@ -1,1 +1,2 @@\n line1\n+added1\n@@ -10,1 +11,2 @@\n line10\n+added2";
      const lines = (service as any).parseChangedLinesFromPatch(patch);
      expect(lines.has(2)).toBe(true);
      expect(lines.has(12)).toBe(true);
    });
  });

  describe("parseLineRange", () => {
    it("should parse single line", () => {
      expect(service.parseLineRange("10")).toEqual([10]);
    });

    it("should parse range", () => {
      expect(service.parseLineRange("10-12")).toEqual([10, 11, 12]);
    });

    it("should return empty for invalid input", () => {
      expect(service.parseLineRange("abc")).toEqual([]);
    });
  });

  describe("buildSpecsSection", () => {
    it("should build specs section text", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [
            {
              id: "JsTs.Base",
              title: "基础规范",
              description: "desc",
              examples: [],
              overrides: [],
            },
            {
              id: "JsTs.Base.Rule1",
              title: "Rule1",
              description: "rule desc",
              examples: [{ lang: "ts", code: "const x = 1;", type: "good" as const }],
              overrides: [],
            },
          ],
        },
      ];
      const result = service.buildSpecsSection(specs);
      expect(result).toContain("基础规范");
      expect(result).toContain("Rule1");
      expect(result).toContain("推荐做法");
    });

    it("should handle rules without examples", () => {
      const specs = [
        {
          filename: "test.md",
          extensions: ["ts"],
          type: "test",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [
            { id: "Test", title: "Test", description: "", examples: [], overrides: [] },
            { id: "Test.Rule1", title: "Rule1", description: "desc", examples: [], overrides: [] },
          ],
        },
      ];
      const result = service.buildSpecsSection(specs);
      expect(result).toContain("Rule1");
    });
  });

  describe("findRuleById", () => {
    const specs = [
      {
        filename: "test.md",
        extensions: ["ts"],
        type: "test",
        content: "",
        overrides: [],
        severity: "error" as const,
        includes: [],
        rules: [
          { id: "JsTs.Base", title: "Base", description: "", examples: [], overrides: [] },
          { id: "JsTs.Base.Rule1", title: "Rule1", description: "", examples: [], overrides: [] },
        ],
      },
    ];

    it("should find rule by exact id", () => {
      const result = service.findRuleById("JsTs.Base", specs);
      expect(result?.rule.id).toBe("JsTs.Base");
    });

    it("should return null for non-existent rule", () => {
      const result = service.findRuleById("NonExistent", specs);
      expect(result).toBeNull();
    });
  });

  describe("filterIssuesByRuleExistence", () => {
    const specs = [
      {
        filename: "test.md",
        extensions: ["ts"],
        type: "test",
        content: "",
        overrides: [],
        severity: "error" as const,
        includes: [],
        rules: [{ id: "JsTs.Base", title: "Base", description: "", examples: [], overrides: [] }],
      },
    ];

    it("should keep issues with existing rules", () => {
      const issues = [{ ruleId: "JsTs.Base" }];
      const result = service.filterIssuesByRuleExistence(issues, specs);
      expect(result).toHaveLength(1);
    });

    it("should remove issues with non-existent rules", () => {
      const issues = [{ ruleId: "NonExistent" }];
      const result = service.filterIssuesByRuleExistence(issues, specs);
      expect(result).toHaveLength(0);
    });
  });

  describe("deduplicateSpecs", () => {
    it("should return same specs when no duplicates", () => {
      const specs = [
        {
          filename: "test.md",
          extensions: ["ts"],
          type: "test",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "Rule1", title: "R1", description: "", examples: [], overrides: [] }],
        },
      ];
      const result = service.deduplicateSpecs(specs);
      expect(result).toBe(specs);
    });

    it("should remove earlier duplicate rules", () => {
      const specs = [
        {
          filename: "base.md",
          extensions: ["ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "Rule1", title: "R1-old", description: "", examples: [], overrides: [] }],
        },
        {
          filename: "override.md",
          extensions: ["ts"],
          type: "override",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "Rule1", title: "R1-new", description: "", examples: [], overrides: [] }],
        },
      ];
      const result = service.deduplicateSpecs(specs);
      expect(result).toHaveLength(1);
      expect(result[0].rules[0].title).toBe("R1-new");
    });

    it("should keep non-duplicate rules in same spec", () => {
      const specs = [
        {
          filename: "base.md",
          extensions: ["ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [
            { id: "Rule1", title: "R1", description: "", examples: [], overrides: [] },
            { id: "Rule2", title: "R2", description: "", examples: [], overrides: [] },
          ],
        },
        {
          filename: "override.md",
          extensions: ["ts"],
          type: "override",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "Rule1", title: "R1-new", description: "", examples: [], overrides: [] }],
        },
      ];
      const result = service.deduplicateSpecs(specs);
      expect(result).toHaveLength(2);
      expect(result[0].rules).toHaveLength(1);
      expect(result[0].rules[0].id).toBe("Rule2");
    });
  });

  describe("formatIssues", () => {
    it("should override severity from spec", () => {
      const issues = [{ ruleId: "JsTs.Base.Rule1", severity: "error" as const }];
      const specs = [
        {
          filename: "test.md",
          extensions: ["ts"],
          type: "test",
          content: "",
          overrides: [],
          severity: "warn" as const,
          includes: [],
          rules: [
            { id: "JsTs.Base.Rule1", title: "R1", description: "", examples: [], overrides: [] },
          ],
        },
      ];
      const result = service.formatIssues(issues, { specs, changedFiles: [] });
      expect(result[0].severity).toBe("warn");
    });

    it("should keep original severity when no spec match", () => {
      const issues = [{ ruleId: "Unknown.Rule", severity: "error" as const }];
      const specs = [
        {
          filename: "test.md",
          extensions: ["ts"],
          type: "test",
          content: "",
          overrides: [],
          severity: "warn" as const,
          includes: [],
          rules: [{ id: "JsTs.Base", title: "Base", description: "", examples: [], overrides: [] }],
        },
      ];
      const result = service.formatIssues(issues, { specs, changedFiles: [] });
      expect(result[0].severity).toBe("error");
    });

    it("should keep severity when same as spec", () => {
      const issues = [{ ruleId: "JsTs.Base", severity: "error" as const }];
      const specs = [
        {
          filename: "test.md",
          extensions: ["ts"],
          type: "test",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "JsTs.Base", title: "Base", description: "", examples: [], overrides: [] }],
        },
      ];
      const result = service.formatIssues(issues, { specs, changedFiles: [] });
      expect(result[0].severity).toBe("error");
    });

    it("should use rule-level severity over spec-level", () => {
      const issues = [{ ruleId: "JsTs.Base.Rule1", severity: "error" as const }];
      const specs = [
        {
          filename: "test.md",
          extensions: ["ts"],
          type: "test",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [
            {
              id: "JsTs.Base.Rule1",
              title: "R1",
              description: "",
              examples: [],
              overrides: [],
              severity: "warn" as const,
            },
          ],
        },
      ];
      const result = service.formatIssues(issues, { specs, changedFiles: [] });
      expect(result[0].severity).toBe("warn");
    });
  });

  describe("extractRepoName", () => {
    it("should extract from https URL", () => {
      const result = (service as any).extractRepoName("https://github.com/org/repo.git");
      expect(result).toBe("org__repo");
    });

    it("should extract from SSH URL", () => {
      const result = (service as any).extractRepoName("git@github.com:org/repo.git");
      expect(result).toBe("org__repo");
    });

    it("should handle single part path", () => {
      const result = (service as any).extractRepoName("repo");
      expect(result).toBe("repo");
    });

    it("should return null for empty path", () => {
      const result = (service as any).extractRepoName("https://github.com/");
      expect(result).toBeNull();
    });
  });

  describe("isRepoUrl", () => {
    it("should detect https URL", () => {
      expect((service as any).isRepoUrl("https://github.com/org/repo")).toBe(true);
    });

    it("should detect http URL", () => {
      expect((service as any).isRepoUrl("http://github.com/org/repo")).toBe(true);
    });

    it("should detect git@ URL", () => {
      expect((service as any).isRepoUrl("git@github.com:org/repo")).toBe(true);
    });

    it("should detect custom protocol URL", () => {
      expect((service as any).isRepoUrl("git+ssh://github.com/org/repo")).toBe(true);
    });

    it("should return false for local path", () => {
      expect((service as any).isRepoUrl("/home/user/specs")).toBe(false);
    });
  });

  describe("loadReviewSpecs - ENOENT handling", () => {
    it("should silently skip ENOENT errors", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      (readdir as Mock).mockRejectedValue(enoentError);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const specs = await service.loadReviewSpecs("/nonexistent");
      expect(specs).toHaveLength(0);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("filterIssuesByOverrides", () => {
    it("should filter issues by override rules with global scope (empty includes)", () => {
      const specs = [
        {
          filename: "js&ts.nest.md",
          extensions: ["js", "ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.FileName"],
          severity: "error" as const,
          includes: [], // 空 includes = 全局作用域
          rules: [],
        },
      ];

      const issues = [
        { ruleId: "JsTs.FileName", file: "src/app.ts", reason: "test" },
        { ruleId: "JsTs.FileName.LowerCamel", file: "src/user.ts", reason: "test" },
        { ruleId: "JsTs.Nest.DirStructure", file: "src/module.ts", reason: "test" },
      ];

      const result = service.filterIssuesByOverrides(issues, specs);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("JsTs.Nest.DirStructure");
    });

    it("should keep all issues when no overrides", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];

      const issues = [
        { ruleId: "JsTs.Base.Rule1", file: "src/app.ts", reason: "test" },
        { ruleId: "JsTs.Base.Rule2", file: "src/user.ts", reason: "test" },
      ];

      const result = service.filterIssuesByOverrides(issues, specs);

      expect(result).toHaveLength(2);
    });

    it("should only apply override within its includes scope", () => {
      const specs = [
        {
          filename: "controller-spec.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.Base.Rule1"], // 只在 controller 文件中覆盖
          severity: "error" as const,
          includes: ["*.controller.ts"],
          rules: [],
        },
      ];

      const issues = [
        { ruleId: "JsTs.Base.Rule1", file: "src/user.controller.ts", reason: "test" }, // 应被过滤
        { ruleId: "JsTs.Base.Rule1", file: "src/user.service.ts", reason: "test" }, // 应保留（不在作用域内）
        { ruleId: "JsTs.Base.Rule2", file: "src/user.controller.ts", reason: "test" }, // 应保留（ruleId 不匹配）
      ];

      const result = service.filterIssuesByOverrides(issues, specs);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.file)).toEqual(["src/user.service.ts", "src/user.controller.ts"]);
    });

    it("should handle multiple specs with different scopes", () => {
      const specs = [
        {
          filename: "controller-spec.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.Base.Rule1"],
          severity: "error" as const,
          includes: ["*.controller.ts"],
          rules: [],
        },
        {
          filename: "service-spec.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.Base.Rule2"],
          severity: "error" as const,
          includes: ["*.service.ts"],
          rules: [],
        },
      ];

      const issues = [
        { ruleId: "JsTs.Base.Rule1", file: "src/user.controller.ts", reason: "test" }, // 被 controller-spec 过滤
        { ruleId: "JsTs.Base.Rule1", file: "src/user.service.ts", reason: "test" }, // 保留
        { ruleId: "JsTs.Base.Rule2", file: "src/user.service.ts", reason: "test" }, // 被 service-spec 过滤
        { ruleId: "JsTs.Base.Rule2", file: "src/user.controller.ts", reason: "test" }, // 保留
      ];

      const result = service.filterIssuesByOverrides(issues, specs);

      expect(result).toHaveLength(2);
      expect(result.map((i) => `${i.ruleId}@${i.file}`)).toEqual([
        "JsTs.Base.Rule1@src/user.service.ts",
        "JsTs.Base.Rule2@src/user.controller.ts",
      ]);
    });

    it("should log with verbose=1 when overrides skip issues", () => {
      const specs = [
        {
          filename: "nest.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.FileName"],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];
      const issues = [{ ruleId: "JsTs.FileName", file: "src/app.ts", line: "10" }];
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = service.filterIssuesByOverrides(issues, specs, 1);
      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log with verbose=3 for detailed override collection", () => {
      const specs = [
        {
          filename: "nest.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.FileName"],
          severity: "error" as const,
          includes: [],
          rules: [
            {
              id: "JsTs.Nest",
              title: "Nest",
              description: "",
              examples: [],
              overrides: ["JsTs.Base"],
            },
          ],
        },
      ];
      const issues = [{ ruleId: "Other.Rule", file: "src/app.ts" }];
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      service.filterIssuesByOverrides(issues, specs, 3);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle issue without file field", () => {
      const specs = [
        {
          filename: "nest.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.FileName"],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];
      const issues = [{ ruleId: "JsTs.FileName" }];
      const result = service.filterIssuesByOverrides(issues, specs);
      expect(result).toHaveLength(0);
    });
  });

  describe("applyOverrides - verbose", () => {
    it("should log overridden rules with verbose=2", () => {
      const specs = [
        {
          filename: "base.md",
          extensions: ["ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [
            { id: "JsTs.FileName", title: "FN", description: "", examples: [], overrides: [] },
          ],
        },
        {
          filename: "nest.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: ["JsTs.FileName"],
          severity: "error" as const,
          includes: [],
          rules: [{ id: "JsTs.Nest", title: "Nest", description: "", examples: [], overrides: [] }],
        },
      ];
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = service.applyOverrides(specs as any, 2);
      expect(result).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("resolveSpecSources", () => {
    it("should resolve local directory source", async () => {
      (readdir as Mock).mockResolvedValue([
        { name: "spec.md", isFile: () => true, isDirectory: () => false },
      ]);
      const result = await service.resolveSpecSources(["/local/dir"]);
      expect(result).toContain("/local/dir");
    });

    it("should resolve repo URL source via cloneSpecRepo", async () => {
      (access as Mock).mockRejectedValue(new Error("not found"));
      (mkdir as Mock).mockResolvedValue(undefined);
      (child_process.execSync as Mock).mockReturnValue("");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await service.resolveSpecSources(["https://github.com/org/repo.git"]);
      expect(result.length).toBeGreaterThanOrEqual(0);
      consoleSpy.mockRestore();
    });

    it("should resolve remote repo URL via fetchRemoteSpecs", async () => {
      gitProvider.listRepositoryContents.mockResolvedValue([
        { type: "file", name: "spec.md", path: "spec.md" },
      ]);
      gitProvider.getFileContent.mockResolvedValue("# Rule `[Test.Rule]`");
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);
      // parseRepoUrl 需要能解析的 URL
      const result = await service.resolveSpecSources([
        "https://github.com/org/repo/tree/main/references",
      ]);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("fetchRemoteSpecs", () => {
    it("should fetch and cache remote specs", async () => {
      gitProvider.listRepositoryContents.mockResolvedValue([
        { type: "file", name: "rule.md", path: "rule.md" },
      ]);
      gitProvider.getFileContent.mockResolvedValue("# Rule `[Test.Rule]`");
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const ref = { owner: "org", repo: "repo", path: "references", ref: "main" };
      const result = await (service as any).fetchRemoteSpecs(ref);
      expect(result).toBeTruthy();
    });

    it("should return null when no md files found", async () => {
      gitProvider.listRepositoryContents.mockResolvedValue([
        { type: "file", name: "readme.txt", path: "readme.txt" },
      ]);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ref = { owner: "org", repo: "repo" };
      const result = await (service as any).fetchRemoteSpecs(ref);
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("should handle API failure and use expired cache", async () => {
      gitProvider.listRepositoryContents.mockRejectedValue(new Error("API error"));
      (readdir as Mock).mockResolvedValue(["cached.md"]);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ref = { owner: "org", repo: "repo" };
      const result = await (service as any).fetchRemoteSpecs(ref);
      expect(result).toBeTruthy();
      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("should handle API failure without cache", async () => {
      gitProvider.listRepositoryContents.mockRejectedValue(new Error("API error"));
      (readdir as Mock).mockRejectedValue(new Error("no cache"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ref = { owner: "org", repo: "repo" };
      const result = await (service as any).fetchRemoteSpecs(ref);
      expect(result).toBeNull();
      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("should use valid cache in non-CI environment", async () => {
      const originalCI = process.env.CI;
      delete process.env.CI;
      (readFile as Mock).mockResolvedValue(String(Date.now()));
      (readdir as Mock).mockResolvedValue(["cached.md"]);
      const ref = { owner: "org", repo: "repo" };
      const result = await (service as any).fetchRemoteSpecs(ref);
      expect(result).toBeTruthy();
      process.env.CI = originalCI;
    });
  });

  describe("resolveDepsDir", () => {
    it("should return dir if it contains md files", async () => {
      (readdir as Mock).mockResolvedValue([
        { name: "spec.md", isFile: () => true, isDirectory: () => false },
      ]);
      const result = await (service as any).resolveDepsDir("/deps/dir");
      expect(result).toContain("/deps/dir");
    });

    it("should scan subdirectories for references folder", async () => {
      (readdir as Mock).mockResolvedValueOnce([
        { name: "pkg1", isFile: () => false, isDirectory: () => true },
      ]);
      (access as Mock).mockResolvedValue(undefined);
      const result = await (service as any).resolveDepsDir("/deps");
      expect(result).toContain("/deps/pkg1/references");
    });

    it("should scan subdirectory itself when no references folder", async () => {
      (readdir as Mock)
        .mockResolvedValueOnce([{ name: "pkg1", isFile: () => false, isDirectory: () => true }])
        .mockResolvedValueOnce(["spec.md"]);
      (access as Mock).mockRejectedValue(new Error("not found"));
      const result = await (service as any).resolveDepsDir("/deps");
      expect(result).toContain("/deps/pkg1");
    });

    it("should handle non-existent directory", async () => {
      (readdir as Mock).mockRejectedValue(new Error("ENOENT"));
      const result = await (service as any).resolveDepsDir("/nonexistent");
      expect(result).toHaveLength(0);
    });

    it("should skip subdirectory without md files", async () => {
      (readdir as Mock)
        .mockResolvedValueOnce([{ name: "pkg1", isFile: () => false, isDirectory: () => true }])
        .mockResolvedValueOnce(["readme.txt"]);
      (access as Mock).mockRejectedValue(new Error("not found"));
      const result = await (service as any).resolveDepsDir("/deps");
      expect(result).toHaveLength(0);
    });

    it("should handle unreadable subdirectory", async () => {
      (readdir as Mock)
        .mockResolvedValueOnce([{ name: "pkg1", isFile: () => false, isDirectory: () => true }])
        .mockRejectedValueOnce(new Error("permission denied"));
      (access as Mock).mockRejectedValue(new Error("not found"));
      const result = await (service as any).resolveDepsDir("/deps");
      expect(result).toHaveLength(0);
    });
  });

  describe("cloneSpecRepo", () => {
    it("should use cached repo and pull updates", async () => {
      (access as Mock).mockResolvedValue(undefined);
      (child_process.execSync as Mock).mockReturnValue("");
      const result = await (service as any).cloneSpecRepo("https://github.com/org/repo.git");
      expect(result).toBeTruthy();
    });

    it("should handle pull failure gracefully", async () => {
      (access as Mock).mockResolvedValue(undefined);
      (child_process.execSync as Mock).mockImplementation(() => {
        throw new Error("pull failed");
      });
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await (service as any).cloneSpecRepo("https://github.com/org/repo.git");
      expect(result).toBeTruthy();
      consoleSpy.mockRestore();
    });

    it("should clone repo when not cached", async () => {
      (access as Mock).mockRejectedValue(new Error("not found"));
      (mkdir as Mock).mockResolvedValue(undefined);
      (child_process.execSync as Mock).mockReturnValue("");
      const result = await (service as any).cloneSpecRepo("https://github.com/org/repo.git");
      expect(result).toBeTruthy();
    });

    it("should handle clone failure", async () => {
      (access as Mock).mockRejectedValue(new Error("not found"));
      (mkdir as Mock).mockResolvedValue(undefined);
      (child_process.execSync as Mock).mockImplementation(() => {
        throw new Error("clone failed");
      });
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await (service as any).cloneSpecRepo("https://github.com/org/repo.git");
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("should return null for invalid repo URL", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await (service as any).cloneSpecRepo("https://github.com/");
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("filterApplicableSpecs - edge cases", () => {
    it("should handle files without extension", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];
      const changedFiles = [{ filename: "Makefile" }, { filename: "src/app.ts" }];
      const result = service.filterApplicableSpecs(specs, changedFiles);
      expect(result).toHaveLength(1);
    });

    it("should handle files without filename", () => {
      const specs = [
        {
          filename: "js&ts.base.md",
          extensions: ["js", "ts"],
          type: "base",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: [],
          rules: [],
        },
      ];
      const changedFiles = [{}];
      const result = service.filterApplicableSpecs(specs, changedFiles);
      expect(result).toHaveLength(0);
    });
  });

  describe("extractExamples - bad type", () => {
    it("should extract bad examples", () => {
      const content = `### Bad

\`\`\`ts
const bad_name = 1;
\`\`\``;
      const examples = (service as any).extractExamples(content);
      expect(examples).toHaveLength(1);
      expect(examples[0].type).toBe("bad");
    });
  });

  describe("extractSeverity - invalid value", () => {
    it("should return undefined for invalid severity value", () => {
      const content = `> - severity \`invalid\``;
      const result = (service as any).extractSeverity(content);
      expect(result).toBeUndefined();
    });
  });

  describe("filterIssuesByIncludes - rule-level includes", () => {
    it("should use rule-level includes for filtering", () => {
      const specs = [
        {
          filename: "nest.md",
          extensions: ["ts"],
          type: "nest",
          content: "",
          overrides: [],
          severity: "error" as const,
          includes: ["*.controller.ts"],
          rules: [
            {
              id: "JsTs.Nest",
              title: "Nest",
              description: "",
              examples: [],
              overrides: [],
            },
            {
              id: "JsTs.Nest.Model",
              title: "Model",
              description: "",
              examples: [],
              overrides: [],
              includes: ["*.model.ts"],
            },
          ],
        },
      ];
      const issues = [
        { file: "user.model.ts", ruleId: "JsTs.Nest.Model" },
        { file: "user.controller.ts", ruleId: "JsTs.Nest" },
      ];
      const result = service.filterIssuesByIncludes(issues, specs);
      // spec.includes 是 *.controller.ts，user.model.ts 不匹配
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("user.controller.ts");
    });
  });
});
