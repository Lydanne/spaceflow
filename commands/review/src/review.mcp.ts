/**
 * Review MCP 服务
 * 提供代码审查规则查询的 MCP 工具
 */

import { McpServer, McpTool, ConfigReaderService, t } from "@spaceflow/core";
import { ReviewSpecService } from "./review-spec/review-spec.service";
import { join } from "path";
import { existsSync } from "fs";
import { ListRulesInput, GetRulesForFileInput, GetRuleDetailInput } from "./dto/mcp.dto";
import type { ReviewConfig } from "./review.config";

@McpServer({ name: "review-mcp", version: "1.0.0", description: t("review:mcp.serverDescription") })
export class ReviewMcp {
  constructor(
    private readonly specService: ReviewSpecService,
    private readonly configReader: ConfigReaderService,
  ) {}

  /**
   * 获取项目的规则目录
   */
  private async getSpecDirs(cwd: string): Promise<string[]> {
    const dirs: string[] = [];

    // 1. 通过 ConfigReaderService 读取 review 配置
    try {
      const reviewConfig = this.configReader.getPluginConfig<ReviewConfig>("review");
      if (reviewConfig?.references?.length) {
        const resolved = await this.specService.resolveSpecSources(reviewConfig.references);
        dirs.push(...resolved);
      }
    } catch {
      // 忽略配置读取错误
    }

    // 2. 检查默认目录
    const defaultDirs = [
      join(cwd, ".claude", "skills"),
      join(cwd, ".cursor", "skills"),
      join(cwd, "review-specs"),
    ];

    for (const dir of defaultDirs) {
      if (existsSync(dir)) {
        dirs.push(dir);
      }
    }

    return [...new Set(dirs)]; // 去重
  }

  /**
   * 加载所有规则
   */
  private async loadAllSpecs(cwd: string) {
    const specDirs = await this.getSpecDirs(cwd);
    const allSpecs = [];

    for (const dir of specDirs) {
      const specs = await this.specService.loadReviewSpecs(dir);
      allSpecs.push(...specs);
    }

    // 只去重，不应用 override（MCP 工具应返回所有规则，override 在实际审查时应用）
    return this.specService.deduplicateSpecs(allSpecs);
  }

  @McpTool({
    name: "list_rules",
    description: t("review:mcp.listRules"),
    dto: ListRulesInput,
  })
  async listRules(input: ListRulesInput) {
    const workDir = input.cwd || process.cwd();
    const specs = await this.loadAllSpecs(workDir);

    const rules = specs.flatMap((spec) =>
      spec.rules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        description: rule.description.slice(0, 200) + (rule.description.length > 200 ? "..." : ""),
        severity: rule.severity || spec.severity,
        extensions: spec.extensions,
        specFile: spec.filename,
        includes: spec.includes,
        hasExamples: rule.examples.length > 0,
      })),
    );

    return {
      total: rules.length,
      rules,
    };
  }

  @McpTool({
    name: "get_rules_for_file",
    description: t("review:mcp.getRulesForFile"),
    dto: GetRulesForFileInput,
  })
  async getRulesForFile(input: GetRulesForFileInput) {
    const workDir = input.cwd || process.cwd();
    const allSpecs = await this.loadAllSpecs(workDir);

    // 根据文件过滤适用的规则
    const applicableSpecs = this.specService.filterApplicableSpecs(allSpecs, [
      { filename: input.filePath },
    ]);

    // 进一步根据 includes 过滤（支持规则级 includes 覆盖文件级）
    const micromatchModule = await import("micromatch");
    const micromatch = micromatchModule.default || micromatchModule;

    const rules = applicableSpecs.flatMap((spec) =>
      spec.rules
        .filter((rule) => {
          // 规则级 includes 优先于文件级
          const includes = rule.includes || spec.includes;
          if (includes.length === 0) return true;
          return micromatch.isMatch(input.filePath, includes, { matchBase: true });
        })
        .map((rule) => ({
          id: rule.id,
          title: rule.title,
          description: rule.description,
          severity: rule.severity || spec.severity,
          specFile: spec.filename,
          ...(input.includeExamples && rule.examples.length > 0
            ? {
                examples: rule.examples.map((ex) => ({
                  type: ex.type,
                  lang: ex.lang,
                  code: ex.code,
                })),
              }
            : {}),
        })),
    );

    return {
      file: input.filePath,
      total: rules.length,
      rules,
    };
  }

  @McpTool({
    name: "get_rule_detail",
    description: t("review:mcp.getRuleDetail"),
    dto: GetRuleDetailInput,
  })
  async getRuleDetail(input: GetRuleDetailInput) {
    const workDir = input.cwd || process.cwd();
    const specs = await this.loadAllSpecs(workDir);

    const result = this.specService.findRuleById(input.ruleId, specs);

    if (!result) {
      return { error: t("review:mcp.ruleNotFound", { ruleId: input.ruleId }) };
    }

    const { rule, spec } = result;

    return {
      id: rule.id,
      title: rule.title,
      description: rule.description,
      severity: rule.severity || spec.severity,
      specFile: spec.filename,
      extensions: spec.extensions,
      includes: spec.includes,
      overrides: rule.overrides,
      examples: rule.examples.map((ex) => ({
        type: ex.type,
        lang: ex.lang,
        code: ex.code,
      })),
    };
  }
}

// ReviewMcpService 类已通过 @McpServer 装饰器标记
// CLI 的 `spaceflow mcp` 命令会自动扫描并发现该类
