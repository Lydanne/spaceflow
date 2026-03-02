import { t, z, type SpaceflowContext, type GitProviderService } from "@spaceflow/core";
import { ReviewSpecService } from "../review-spec";
import type { ReviewConfig } from "../review.config";
import { join } from "path";
import { existsSync } from "fs";

/** MCP 工具输入 schema */
export const listRulesInputSchema = z.object({});

export const getRulesForFileInputSchema = z.object({
  filePath: z.string().describe(t("review:mcp.dto.filePath")),
  includeExamples: z.boolean().optional().describe(t("review:mcp.dto.includeExamples")),
});

export const getRuleDetailInputSchema = z.object({
  ruleId: z.string().describe(t("review:mcp.dto.ruleId")),
});

export const getRulesFromDirInputSchema = z.object({
  dirPath: z.string().describe(t("review:mcp.dto.dirPath")),
  includeExamples: z.boolean().optional().describe(t("review:mcp.dto.includeExamples")),
});

/**
 * 获取 GitProviderService（可选）
 */
function getGitProvider(ctx: SpaceflowContext): GitProviderService | undefined {
  try {
    return ctx.getService<GitProviderService>("gitProvider");
  } catch {
    return undefined;
  }
}

/**
 * 获取项目的规则目录
 */
async function getSpecDirs(cwd: string, ctx: SpaceflowContext): Promise<string[]> {
  const dirs: string[] = [];
  try {
    const reviewConfig = ctx.config.get<ReviewConfig>("review");
    if (reviewConfig?.references?.length) {
      const gitProvider = getGitProvider(ctx);
      const specService = new ReviewSpecService(gitProvider);
      const resolved = await specService.resolveSpecSources(reviewConfig.references);
      dirs.push(...resolved);
    }
  } catch {
    // 忽略配置读取错误
  }
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
  return [...new Set(dirs)];
}

/**
 * 加载所有规则
 */
async function loadAllSpecs(cwd: string, ctx: SpaceflowContext) {
  const gitProvider = getGitProvider(ctx);
  const specService = new ReviewSpecService(gitProvider);
  const specDirs = await getSpecDirs(cwd, ctx);
  const allSpecs = [];
  for (const dir of specDirs) {
    const specs = await specService.loadReviewSpecs(dir);
    allSpecs.push(...specs);
  }
  return specService.deduplicateSpecs(allSpecs);
}

export const tools = [
  {
    name: "list_rules",
    description: t("review:mcp.listRules"),
    inputSchema: listRulesInputSchema,
    handler: async (_input, ctx) => {
      const workDir = ctx.cwd;
      const specs = await loadAllSpecs(workDir, ctx);
      const rules = specs.flatMap((spec) =>
        spec.rules.map((rule) => ({
          id: rule.id,
          title: rule.title,
          description:
            rule.description.slice(0, 200) + (rule.description.length > 200 ? "..." : ""),
          severity: rule.severity || spec.severity,
          extensions: spec.extensions,
          specFile: spec.filename,
          includes: spec.includes,
          hasExamples: rule.examples.length > 0,
        })),
      );
      return { total: rules.length, rules };
    },
  },
  {
    name: "get_rules_for_file",
    description: t("review:mcp.getRulesForFile"),
    inputSchema: getRulesForFileInputSchema,
    handler: async (input, ctx) => {
      const { filePath, includeExamples } = input as z.infer<typeof getRulesForFileInputSchema>;
      const workDir = ctx.cwd;
      const allSpecs = await loadAllSpecs(workDir, ctx);
      const specService = new ReviewSpecService();
      const applicableSpecs = specService.filterApplicableSpecs(allSpecs, [{ filename: filePath }]);
      const micromatchModule = await import("micromatch");
      const micromatch = micromatchModule.default || micromatchModule;
      const rules = applicableSpecs.flatMap((spec) =>
        spec.rules
          .filter((rule) => {
            const includes = rule.includes || spec.includes;
            if (includes.length === 0) return true;
            return micromatch.isMatch(filePath, includes, { matchBase: true });
          })
          .map((rule) => ({
            id: rule.id,
            title: rule.title,
            description: rule.description,
            severity: rule.severity || spec.severity,
            specFile: spec.filename,
            ...(includeExamples && rule.examples.length > 0
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
      return { file: filePath, total: rules.length, rules };
    },
  },
  {
    name: "get_rule_detail",
    description: t("review:mcp.getRuleDetail"),
    inputSchema: getRuleDetailInputSchema,
    handler: async (input, ctx) => {
      const { ruleId } = input as z.infer<typeof getRuleDetailInputSchema>;
      const workDir = ctx.cwd;
      const specs = await loadAllSpecs(workDir, ctx);
      const specService = new ReviewSpecService();
      const result = specService.findRuleById(ruleId, specs);
      if (!result) {
        return { error: t("review:mcp.ruleNotFound", { ruleId }) };
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
    },
  },
  {
    name: "get_rules_from_dir",
    description: t("review:mcp.getRulesFromDir"),
    inputSchema: getRulesFromDirInputSchema,
    handler: async (input, ctx) => {
      const { dirPath, includeExamples } = input as z.infer<typeof getRulesFromDirInputSchema>;
      const workDir = ctx.cwd;
      const resolvedDir = dirPath.startsWith("/") ? dirPath : join(workDir, dirPath);

      if (!existsSync(resolvedDir)) {
        return { error: `Directory not found: ${resolvedDir}` };
      }

      const gitProvider = getGitProvider(ctx);
      const specService = new ReviewSpecService(gitProvider);
      const specs = await specService.loadReviewSpecs(resolvedDir);
      const dedupedSpecs = specService.deduplicateSpecs(specs);

      const rules = dedupedSpecs.flatMap((spec) =>
        spec.rules.map((rule) => ({
          id: rule.id,
          title: rule.title,
          description: includeExamples
            ? rule.description
            : rule.description.slice(0, 200) + (rule.description.length > 200 ? "..." : ""),
          severity: rule.severity || spec.severity,
          extensions: spec.extensions,
          specFile: spec.filename,
          includes: spec.includes,
          ...(includeExamples && rule.examples.length > 0
            ? {
                examples: rule.examples.map((ex) => ({
                  type: ex.type,
                  lang: ex.lang,
                  code: ex.code,
                })),
              }
            : { hasExamples: rule.examples.length > 0 }),
        })),
      );

      return {
        dir: resolvedDir,
        specFiles: dedupedSpecs.length,
        total: rules.length,
        rules,
      };
    },
  },
];
