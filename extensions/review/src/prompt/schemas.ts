import type { LlmJsonPutSchema } from "@spaceflow/core";

/**
 * 代码审查结果 JSON Schema
 */
export const REVIEW_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string", description: "发生问题的文件路径" },
          line: {
            type: "string",
            description:
              "问题所在的行号，只支持单行或多行 (如 123 或 123-125)，不允许使用 `,` 分隔多个行号",
          },
          ruleId: { type: "string", description: "违反的规则 ID（如 JsTs.FileName.UpperCamel）" },
          specFile: {
            type: "string",
            description: "规则来源的规范文件名（如 js&ts.file-name.md）",
          },
          reason: { type: "string", description: "问题的简要概括" },
          suggestion: {
            type: "string",
            description:
              "修改后的完整代码片段。要求以代码为主体，并在代码中使用详细的中文注释解释逻辑改进点。不要包含 Markdown 反引号。",
          },
          commit: { type: "string", description: "相关的 7 位 commit SHA" },
          severity: {
            type: "string",
            description: "问题严重程度，根据规则文档中的 severity 标记确定",
            enum: ["error", "warn"],
          },
        },
        required: ["file", "line", "ruleId", "specFile", "reason"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "本次代码审查的整体总结" },
  },
  required: ["issues", "summary"],
  additionalProperties: false,
};

/**
 * 删除影响分析结果 JSON Schema
 */
export const DELETION_IMPACT_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    impacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string", description: "被删除代码所在的文件路径" },
          deletedCode: { type: "string", description: "被删除的代码片段摘要（前50字符）" },
          riskLevel: {
            type: "string",
            enum: ["high", "medium", "low", "none"],
            description:
              "风险等级：high=可能导致功能异常，medium=可能影响部分功能，low=影响较小，none=无影响",
          },
          affectedFiles: {
            type: "array",
            items: { type: "string" },
            description: "可能受影响的文件列表",
          },
          reason: { type: "string", description: "影响分析的详细说明" },
          suggestion: { type: "string", description: "建议的处理方式" },
        },
        required: ["file", "deletedCode", "riskLevel", "affectedFiles", "reason"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "删除代码影响的整体总结" },
  },
  required: ["impacts", "summary"],
  additionalProperties: false,
};

/**
 * 问题验证结果 JSON Schema
 */
export const VERIFY_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    fixed: {
      type: "boolean",
      description: "问题是否已被修复",
    },
    valid: {
      type: "boolean",
      description: "问题是否有效，有效的条件就是你需要看看代码是否符合规范",
    },
    reason: {
      type: "string",
      description: "判断依据，说明为什么认为问题已修复或仍存在",
    },
  },
  required: ["fixed", "valid", "reason"],
  additionalProperties: false,
};
